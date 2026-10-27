#!/usr/bin/env python3
"""
DSKY Flasher — standalone GUI that sets up DSKY keyboard boards one by one.

Two tabs, one per way a board is connected:
  - Bootloader (USBasp): with a USBasp on the ICSP header (J2), each board
    that shows up gets the urboot bootloader and its fuses (internal 8 MHz).
    Boards that already carry both are skipped. Done once per board.
  - Firmware (USB): each board plugged in over its USB-C (CH340) gets its
    OSCCAL calibrated into EEPROM if it has none, then the firmware. Several
    boards can be plugged in at once.
No clicks per board: start the tab, then connect and disconnect boards.

A USBasp without a driver gets WinUSB installed through driver/wdi-simple.exe
(libwdi, Zadig's engine; see driver/build-wdi-simple.sh). Windows asks once
for administrator permission.

Dependencies (for running from source): pip install pyserial
"""

import csv
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import serial
import serial.tools.list_ports

# The sweep parser lives in osccal_reader.py, one folder up.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from osccal_reader import best_perfect_span, extract_frames, score_payload  # noqa: E402

try:
    import winsound
except ImportError:  # not on Windows: no beeps
    winsound = None

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MCU = "atmega328p"

# Must match env:bare_usb_bootloader (MiniCore picks these for internal 8 MHz).
FUSES = {"lfuse": 0xE2, "hfuse": 0xD7, "efuse": 0xFD}

UPLOAD_BAUD = 38400          # board_upload.speed of env:bare_usb
SWEEP_BAUD = 38400           # OSC_CAL_BAUD in osc_calibration.h
SWEEP_BURST_LEN = 64         # OSC_CAL_BURST_LEN
SWEEP_MAX_SECONDS = 30
SWEEP_IDLE_SECONDS = 2.0
OSCCAL_EEPROM_ADDR = 0       # OSC_CAL_EEPROM_ADDR

# WCH CH340, the board's USB-serial chip. Anything else is never touched.
CH340_VID = 0x1A86

OUTCOME_COLORS = {"done": "#1a7f37", "skipped": "#57606a", "failed": "#cf222e"}
BOARD_COLUMNS = (("#", 30), ("Port", 70), ("OSCCAL", 70), ("Progress", 160), ("Status", 260))

POLL_SECONDS = 1.0


# ---------------------------------------------------------------------------
# Files: avrdude and the three hex images
# ---------------------------------------------------------------------------
# The built exe carries avrdude/ and images/ next to it (see build.bat).
# Running from source falls back to PlatformIO's avrdude and to the repo's
# build outputs, so a `pio run` is all it takes to try it.

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
PIO_HOME = os.path.join(os.path.expanduser("~"), ".platformio")
URBOOT_HEX = os.path.join(
    PIO_HOME, "packages", "framework-arduino-avr-minicore", "bootloaders", "urboot", MCU,
    "watchdog_1_s", "autobaud", "uart0_rxd0_txd1", "led+b5", f"urboot_{MCU}_pr_ee_ce.hex")


def app_base_dir() -> str:
    """Folder holding avrdude/, images/ and the flash log: next to the exe or script."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def images_dir() -> str:
    return os.path.join(app_base_dir(), "images")


def default_image(name: str) -> str:
    """bootloader / calibration / firmware .hex: images/ first, then the repo's builds."""
    bundled = os.path.join(images_dir(), f"{name}.hex")
    if os.path.isfile(bundled):
        return bundled
    fallback = {
        "bootloader": URBOOT_HEX,
        "calibration": os.path.join(REPO_ROOT, ".pio", "build", "bare_usb_calibration", "firmware.hex"),
        "firmware": os.path.join(REPO_ROOT, ".pio", "build", "bare_usb", "firmware.hex"),
    }[name]
    return fallback if os.path.isfile(fallback) else ""


def find_avrdude() -> list[str]:
    """avrdude command prefix (exe plus its config)."""
    for d in (os.path.join(app_base_dir(), "avrdude"), os.path.join(PIO_HOME, "packages", "tool-avrdude")):
        exe = os.path.join(d, "avrdude.exe" if os.name == "nt" else "avrdude")
        if os.path.isfile(exe):
            return [exe, "-C", os.path.join(d, "avrdude.conf")]
    found = shutil.which("avrdude")
    if found:
        return [found]
    return []


# ---------------------------------------------------------------------------
# USBasp driver
# ---------------------------------------------------------------------------
# avrdude needs WinUSB on the USBasp. A USBasp Windows has no driver for
# shows up in avrdude as "cannot open USB device" (it's enumerated but can't
# be opened); an unplugged one only as "cannot find USB device".

USBASP_VID, USBASP_PID = 0x16C0, 0x05DC


def usbasp_without_driver(avrdude_err: str) -> bool:
    return "cannot open usb device" in avrdude_err.lower()


def run_elevated(exe: str, params: str) -> int | None:
    """Run exe as administrator and wait for it. Returns its exit code, or
    None if it didn't start (UAC declined)."""
    import ctypes
    from ctypes import wintypes

    class SHELLEXECUTEINFOW(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.DWORD), ("fMask", ctypes.c_ulong), ("hwnd", wintypes.HWND),
                    ("lpVerb", wintypes.LPCWSTR), ("lpFile", wintypes.LPCWSTR),
                    ("lpParameters", wintypes.LPCWSTR), ("lpDirectory", wintypes.LPCWSTR),
                    ("nShow", ctypes.c_int), ("hInstApp", wintypes.HINSTANCE), ("lpIDList", ctypes.c_void_p),
                    ("lpClass", wintypes.LPCWSTR), ("hkeyClass", wintypes.HKEY), ("dwHotKey", wintypes.DWORD),
                    ("hIconOrMonitor", wintypes.HANDLE), ("hProcess", wintypes.HANDLE)]

    SEE_MASK_NOCLOSEPROCESS, SW_HIDE, INFINITE = 0x40, 0, 0xFFFFFFFF
    info = SHELLEXECUTEINFOW(cbSize=ctypes.sizeof(SHELLEXECUTEINFOW), fMask=SEE_MASK_NOCLOSEPROCESS,
                             lpVerb="runas", lpFile=exe, lpParameters=params, nShow=SW_HIDE)
    if not ctypes.windll.shell32.ShellExecuteExW(ctypes.byref(info)) or not info.hProcess:
        return None
    k32 = ctypes.windll.kernel32
    k32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    k32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    k32.WaitForSingleObject(info.hProcess, INFINITE)
    code = wintypes.DWORD()
    k32.GetExitCodeProcess(info.hProcess, ctypes.byref(code))
    k32.CloseHandle(info.hProcess)
    return ctypes.c_int32(code.value).value


def install_usbasp_driver() -> str:
    """Install WinUSB for the USBasp; returns "" on success, else why not."""
    exe = os.path.join(app_base_dir(), "driver", "wdi-simple.exe")
    if not os.path.isfile(exe):
        return f"{exe} not found"
    dest = tempfile.mkdtemp(prefix="dsky-usbasp-driver-")
    try:
        rc = run_elevated(exe, f'-n "USBasp" -m "www.fischl.de" -v 0x{USBASP_VID:04x} '
                               f'-p 0x{USBASP_PID:04x} -t 0 -d "{dest}" -s')
    finally:
        shutil.rmtree(dest, ignore_errors=True)
    if rc is None:
        return "administrator permission was not given"
    return "" if rc == 0 else f"wdi-simple failed (libwdi error {rc})"


# ---------------------------------------------------------------------------
# avrdude
# ---------------------------------------------------------------------------
def run_avrdude(prefix: list[str], args: list[str], timeout: float = 120) -> tuple[int, str, str]:
    """Run avrdude; returns (exit code, stdout, stderr)."""
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        p = subprocess.run([*prefix, *args], capture_output=True, text=True, errors="replace",
                           timeout=timeout, creationflags=flags)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "avrdude timed out"


def avrdude_error(err: str) -> str:
    """The line that says why avrdude failed, for the status column."""
    lines = [l.strip() for l in err.strip().splitlines() if l.strip()]
    for l in lines:
        if l.lower().startswith("error"):
            return l
    return lines[-1] if lines else "no output"


def usbasp(prefix: list[str], *args: str, timeout: float = 60) -> tuple[int, str, str]:
    return run_avrdude(prefix, ["-c", "usbasp", "-p", MCU, *args], timeout=timeout)


def urclock(prefix: list[str], port: str, *args: str, timeout: float = 120) -> tuple[int, str, str]:
    return run_avrdude(prefix, ["-c", "urclock", "-p", MCU, "-P", port, "-b", str(UPLOAD_BAUD),
                                "-xnometadata", *args], timeout=timeout)


def read_fuses(prefix: list[str]) -> tuple[dict[str, int] | None, str]:
    """Fuses of the chip on the USBasp, or (None, avrdude's whole stderr)."""
    rc, out, err = usbasp(prefix, "-U", "lfuse:r:-:h", "-U", "hfuse:r:-:h", "-U", "efuse:r:-:h",
                          timeout=20)
    values = [l.strip() for l in out.splitlines() if l.strip().startswith("0x")]
    if rc != 0 or len(values) != 3:
        return None, err or "no output"
    return dict(zip(("lfuse", "hfuse", "efuse"), (int(v, 16) for v in values))), ""


def fuses_text(f: dict[str, int]) -> str:
    return "/".join(f"{f[k]:02X}" for k in ("lfuse", "hfuse", "efuse"))


def read_osccal(prefix: list[str], port: str) -> tuple[int | None, str]:
    """OSCCAL byte from the board's EEPROM through the bootloader (0xFF = none)."""
    fd, path = tempfile.mkstemp(prefix="dsky-eeprom-", suffix=".bin")
    os.close(fd)
    try:
        rc, _, err = urclock(prefix, port, "-U", f"eeprom:r:{path}:r", timeout=30)
        if rc != 0:
            return None, avrdude_error(err)
        with open(path, "rb") as f:
            data = f.read()
        if len(data) <= OSCCAL_EEPROM_ADDR:
            return 0xFF, ""  # avrdude trims trailing 0xFF: an empty EEPROM reads short
        return data[OSCCAL_EEPROM_ADDR], ""
    finally:
        os.remove(path)


def run_sweep(port: str, on_progress) -> tuple[int | None, int]:
    """Read the calibration firmware's OSCCAL sweep; returns (best value, frames).

    Opening the port pulses DTR, which resets the board, so the sweep is read
    from its start: the bootloader waits ~1 s, then the sweep firmware runs.
    """
    scores: dict[int, list] = {}
    frames_seen = 0
    with serial.Serial(port, SWEEP_BAUD, timeout=0.2) as ser:
        buf = bytearray()
        start, last_frame = time.time(), None
        while time.time() - start < SWEEP_MAX_SECONDS:
            if last_frame is not None and time.time() - last_frame > SWEEP_IDLE_SECONDS:
                break
            chunk = ser.read(512)
            if not chunk:
                continue
            buf.extend(chunk)
            frames, buf = extract_frames(buf, SWEEP_BURST_LEN)
            for cal, payload in frames:
                scores.setdefault(cal, []).append(score_payload(payload))
                on_progress(cal / 255)
            if frames:
                frames_seen += len(frames)
                last_frame = time.time()
    span = best_perfect_span(scores, SWEEP_BURST_LEN) if scores else None
    return (span[2] if span else None), frames_seen


def beep(ok: bool):
    if winsound is None:
        return
    try:
        if ok:
            winsound.Beep(1800, 120)
            winsound.Beep(2400, 160)
        else:
            winsound.Beep(400, 700)
    except RuntimeError:
        pass


# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------
class BoardList:
    """One grid row per board handled this session, with a real progress bar
    (Treeview cells can't hold a ttk.Progressbar)."""

    def __init__(self, app, parent, title: str):
        self.app = app
        frame = ttk.LabelFrame(parent, text=title, padding=4)
        frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 4))
        canvas = tk.Canvas(frame, highlightthickness=0, height=220)
        vscroll = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=canvas.yview)
        canvas.configure(yscrollcommand=vscroll.set)
        vscroll.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.rows_frame = ttk.Frame(canvas)
        window = canvas.create_window((0, 0), window=self.rows_frame, anchor="nw")
        self.rows_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda e: canvas.itemconfigure(window, width=e.width))
        self.canvas = canvas
        self.rows: dict[str, dict] = {}
        self.count = 0
        self.lock = threading.Lock()
        for col, (title, minsize) in enumerate(BOARD_COLUMNS):
            ttk.Label(self.rows_frame, text=title, font=("Segoe UI", 9, "bold")).grid(
                row=0, column=col, sticky="w", padx=4, pady=(0, 2))
            self.rows_frame.columnconfigure(col, minsize=minsize)
        self.rows_frame.columnconfigure(len(BOARD_COLUMNS) - 1, weight=1)

    def new_row(self, port: str) -> str:
        with self.lock:
            self.count += 1
            iid = str(self.count)

        def _do():
            f, r = self.rows_frame, int(iid)
            row = {
                "n": ttk.Label(f, text=iid),
                "port": ttk.Label(f, text=port),
                "osccal": ttk.Label(f, text="", font=("Consolas", 9)),
                "progress": ttk.Progressbar(f, length=150, maximum=100),
                "status": ttk.Label(f, text="connecting..."),
            }
            for col, key in enumerate(("n", "port", "osccal", "progress", "status")):
                row[key].grid(row=r, column=col, sticky="we" if key == "progress" else "w", padx=4, pady=1)
            self.rows[iid] = row
            self.canvas.update_idletasks()
            self.canvas.yview_moveto(1.0)
        self.app.root.after(0, _do)
        return iid

    def update(self, iid: str, progress=None, outcome=None, **fields):
        """Update a row from any thread. progress: 0..1, or "none" to hide the bar."""
        def _do():
            row = self.rows.get(iid)
            if row is None:
                return
            for key, val in fields.items():
                row[key].configure(text=val)
            if progress == "none":
                row["progress"].grid_remove()
            elif progress is not None:
                row["progress"]["value"] = max(0.0, min(1.0, progress)) * 100
            if outcome is not None:
                row["status"].configure(foreground=OUTCOME_COLORS[outcome])
        self.app.root.after(0, _do)


class DskyFlasherApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("DSKY Flasher")
        self.root.geometry("820x640")
        self.avrdude = find_avrdude()
        self.counts = {"done": 0, "skipped": 0, "failed": 0}
        self.counts_lock = threading.Lock()

        self.bl_hex = default_image("bootloader")
        self.cal_hex = default_image("calibration")
        self.fw_hex = default_image("firmware")
        self._bl_running = False
        self._fw_running = False
        self._fw_ports: set[str] = set()
        self._fw_lock = threading.Lock()
        self._driver_tried = False

        self._build_ui()
        if not self.avrdude:
            self._log("avrdude not found: put it in avrdude/ next to this program, or install PlatformIO")

    def _build_ui(self):
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=8, pady=(8, 4))
        bl = ttk.Frame(notebook)
        fw = ttk.Frame(notebook)
        notebook.add(bl, text="Bootloader (USBasp)")
        notebook.add(fw, text="Firmware (USB)")
        self._build_bootloader_tab(bl)
        self._build_firmware_tab(fw)

        log_frame = ttk.LabelFrame(self.root, text="Log", padding=4)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 8))
        self.log_text = tk.Text(log_frame, height=7, state=tk.DISABLED, font=("Consolas", 9))
        scroll = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.pack(fill=tk.BOTH, expand=True)

    def _image_row(self, parent, label: str, attr: str):
        bar = ttk.Frame(parent, padding=(8, 2))
        bar.pack(fill=tk.X)
        ttk.Label(bar, text=label, width=12).pack(side=tk.LEFT)
        name = ttk.Label(bar)
        name.pack(side=tk.LEFT, padx=(4, 8))
        btn = ttk.Button(bar, text="Browse...")
        btn.pack(side=tk.LEFT)

        def _show():
            path = getattr(self, attr)
            if path:
                name.configure(text=os.path.basename(os.path.dirname(path)) + os.sep + os.path.basename(path),
                               foreground="black")
            else:
                name.configure(text="(not found — build it or Browse)", foreground="gray")

        def _browse():
            path = filedialog.askopenfilename(title=f"Select {label}", initialdir=images_dir(),
                                              filetypes=[("Intel hex", "*.hex"), ("All files", "*.*")])
            if path:
                setattr(self, attr, path)
                _show()
        btn.configure(command=_browse)
        _show()
        return btn

    def _build_bootloader_tab(self, parent):
        ttk.Label(parent, padding=(8, 8, 8, 4), wraplength=760, text=(
            "Plug the USBasp into this PC and onto each new board's ICSP header (J2), one at a time. "
            f"Each board gets the bootloader and fuses {fuses_text(FUSES)} (internal 8 MHz); "
            "unplug it when the row turns green and plug in the next.")).pack(fill=tk.X)
        self.bl_browse = self._image_row(parent, "Bootloader:", "bl_hex")
        opts = ttk.Frame(parent, padding=(8, 4))
        opts.pack(fill=tk.X)
        self.bl_force_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, variable=self.bl_force_var,
                        text="Re-burn boards that already have the bootloader (erases their firmware)"
                        ).pack(anchor=tk.W)
        bar = ttk.Frame(parent, padding=8)
        bar.pack(fill=tk.X)
        self.bl_btn = ttk.Button(bar, text="Start", command=self._on_bl_toggle)
        self.bl_btn.pack(side=tk.LEFT)
        self.bl_state = ttk.Label(bar, foreground="gray")
        self.bl_state.pack(side=tk.LEFT, padx=12)
        self.bl_list = BoardList(self, parent, "Boards")

    def _build_firmware_tab(self, parent):
        ttk.Label(parent, padding=(8, 8, 8, 4), wraplength=760, text=(
            "Plug boards that already have the bootloader into this PC through their USB-C (J3). "
            "A board without OSCCAL in EEPROM is calibrated first (~20 s), then gets the firmware.")
        ).pack(fill=tk.X)
        self.fw_browse = self._image_row(parent, "Firmware:", "fw_hex")
        self.cal_browse = self._image_row(parent, "Calibration:", "cal_hex")
        opts = ttk.Frame(parent, padding=(8, 4))
        opts.pack(fill=tk.X)
        self.fw_recal_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, variable=self.fw_recal_var,
                        text="Recalibrate OSCCAL even if the board already has one").pack(anchor=tk.W)
        self.fw_force_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, variable=self.fw_force_var,
                        text="Re-flash boards that already carry this firmware").pack(anchor=tk.W)
        bar = ttk.Frame(parent, padding=8)
        bar.pack(fill=tk.X)
        self.fw_btn = ttk.Button(bar, text="Start", command=self._on_fw_toggle)
        self.fw_btn.pack(side=tk.LEFT)
        self.counts_label = ttk.Label(bar)
        self.counts_label.pack(side=tk.LEFT, padx=12)
        self._show_counts()
        self.fw_list = BoardList(self, parent, "Boards")

    # --- Helpers ---
    def _log(self, msg: str):
        def _do():
            self.log_text.configure(state=tk.NORMAL)
            self.log_text.insert(tk.END, msg + "\n")
            self.log_text.see(tk.END)
            self.log_text.configure(state=tk.DISABLED)
        self.root.after(0, _do)

    def _show_counts(self):
        c = self.counts
        self.counts_label.configure(text=f"Done: {c['done']}   Skipped: {c['skipped']}   Failed: {c['failed']}")

    def _finish(self, blist: BoardList, iid: str, mode: str, port: str, osccal: str,
                outcome: str, status: str):
        blist.update(iid, status=status, outcome=outcome,
                     progress=1.0 if outcome == "done" else None)
        self._log(f"[{port}] {status}")
        with self.counts_lock:
            if mode == "firmware":
                self.counts[outcome] += 1
            log_path = os.path.join(app_base_dir(), "flash_log.csv")
            new_file = not os.path.exists(log_path)
            try:
                with open(log_path, "a", newline="", encoding="utf-8") as f:
                    w = csv.writer(f)
                    if new_file:
                        w.writerow(["time", "mode", "port", "osccal", "outcome", "image", "status"])
                    image = self.bl_hex if mode == "bootloader" else self.fw_hex
                    w.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), mode, port, osccal, outcome,
                                os.path.basename(image), status])
            except OSError as e:
                self._log(f"  can't write {log_path}: {e}")
        self.root.after(0, self._show_counts)
        beep(outcome != "failed")

    def _check_files(self, *paths: str) -> bool:
        if not self.avrdude:
            messagebox.showwarning("No avrdude", "avrdude not found (avrdude/ next to this program, or PlatformIO).")
            return False
        missing = [p or "(none selected)" for p in paths if not p or not os.path.isfile(p)]
        if missing:
            messagebox.showwarning("Missing images", "Not found:\n" + "\n".join(missing))
            return False
        return True

    # --- Bootloader (USBasp) ---
    def _on_bl_toggle(self):
        if self._bl_running:
            self._bl_running = False
            self.bl_btn.configure(text="Start")
            self.bl_browse.configure(state="normal")
            self.bl_state.configure(text="")
            self._log("Bootloader mode stopped (a board in progress will finish)")
            return
        if not self._check_files(self.bl_hex):
            return
        self._bl_running = True
        self._driver_tried = False
        self.bl_btn.configure(text="Stop")
        self.bl_browse.configure(state="disabled")
        self._log("Bootloader mode started — connect boards to the USBasp one at a time")
        threading.Thread(target=self._bl_loop, daemon=True).start()

    def _bl_state(self, text: str):
        self.root.after(0, lambda: self.bl_state.configure(text=text))

    def _bl_loop(self):
        """Poll the USBasp: a chip that answers is a new board; after handling it,
        wait until it stops answering (unplugged) before taking the next one."""
        while self._bl_running:
            fuses, err = read_fuses(self.avrdude)
            if fuses is None:
                if usbasp_without_driver(err):
                    if self._driver_tried:
                        self._bl_state("USBasp has no driver — installing it failed, see the log")
                    else:
                        # Once per Start, so a failed or declined install doesn't loop.
                        self._driver_tried = True
                        self._bl_state("USBasp has no driver — installing it (Windows asks for permission)...")
                        self._log("[USBasp] no driver: installing WinUSB")
                        why = install_usbasp_driver()
                        self._log("[USBasp] driver installed" if not why else f"[USBasp] driver NOT installed: {why}")
                elif "cannot find usb device" in err.lower():
                    self._bl_state("USBasp not found — is it plugged in?")
                else:
                    self._bl_state("waiting for a board...")
                time.sleep(POLL_SECONDS)
                continue
            self._bl_burn(fuses)
            self._bl_state("done — unplug the board")
            while self._bl_running and read_fuses(self.avrdude)[0] is not None:
                time.sleep(POLL_SECONDS)
            self._log("[USBasp] board unplugged")

    def _bl_burn(self, fuses: dict[str, int]):
        blist, port = self.bl_list, "USBasp"
        iid = blist.new_row(port)
        self._bl_state("working...")
        self._log(f"[USBasp] board found, fuses {fuses_text(fuses)}")
        blist.update(iid, progress=0.1, status=f"found (fuses {fuses_text(fuses)})")

        # 1. Already set up? Fuses right and the bootloader bytes in place
        # (an ISP upload with chip erase, e.g. env:bare, wipes it but keeps fuses).
        if fuses == FUSES and not self.bl_force_var.get():
            rc, _, _ = usbasp(self.avrdude, "-U", f"flash:v:{self.bl_hex}:i")
            if rc == 0:
                blist.update(iid, progress="none")
                self._finish(blist, iid, "bootloader", port, "", "skipped",
                             "already has the bootloader — skipped")
                return

        # 2. Erase and set the fuses, then write the bootloader (as `pio run -t bootloader`).
        blist.update(iid, progress=0.3, status="erasing, writing fuses...")
        rc, _, err = usbasp(self.avrdude, "-e", "-U", "lock:w:0xff:m",
                            *(a for k in ("hfuse", "lfuse", "efuse") for a in ("-U", f"{k}:w:0x{FUSES[k]:02x}:m")))
        if rc != 0:
            self._finish(blist, iid, "bootloader", port, "", "failed", f"FAILED writing fuses ({avrdude_error(err)})")
            return
        blist.update(iid, progress=0.6, status="writing bootloader...")
        rc, _, err = usbasp(self.avrdude, "-U", f"flash:w:{self.bl_hex}:i", "-U", "lock:w:0xff:m")
        if rc != 0:
            self._finish(blist, iid, "bootloader", port, "", "failed",
                         f"FAILED writing bootloader ({avrdude_error(err)})")
            return

        # 3. Read the fuses back.
        after, why = read_fuses(self.avrdude)
        if after != FUSES:
            self._finish(blist, iid, "bootloader", port, "", "failed",
                         f"FAILED: fuses read back {fuses_text(after) if after else avrdude_error(why)}")
            return
        self._finish(blist, iid, "bootloader", port, "", "done",
                     "OK — bootloader + fuses (now use the Firmware tab)")

    # --- Firmware (USB) ---
    def _on_fw_toggle(self):
        if self._fw_running:
            self._fw_running = False
            self.fw_btn.configure(text="Start")
            for b in (self.fw_browse, self.cal_browse):
                b.configure(state="normal")
            self._log("Firmware mode stopped (boards in progress will finish)")
            return
        if not self._check_files(self.fw_hex, self.cal_hex):
            return
        self._fw_running = True
        self.fw_btn.configure(text="Stop")
        for b in (self.fw_browse, self.cal_browse):
            b.configure(state="disabled")
        self._log(f"Firmware mode started with {os.path.basename(self.fw_hex)} "
                  "— plug boards in; each one is handled once per connection")
        threading.Thread(target=self._fw_poll_loop, daemon=True).start()

    def _fw_poll_loop(self):
        while self._fw_running:
            present = {p.device for p in serial.tools.list_ports.comports() if p.vid == CH340_VID}
            with self._fw_lock:
                for port in sorted(self._fw_ports - present):
                    self._fw_ports.discard(port)
                    self._log(f"[{port}] unplugged")
                new = sorted(present - self._fw_ports)
                self._fw_ports.update(new)
            for port in new:
                threading.Thread(target=self._fw_board, args=(port,), daemon=True).start()
            time.sleep(POLL_SECONDS)

    def _fw_board(self, port: str):
        blist = self.fw_list
        iid = blist.new_row(port)
        self._log(f"[{port}] board connected")
        time.sleep(1.0)  # let the driver settle after enumeration

        # 1. Talk to the bootloader and read the stored OSCCAL.
        blist.update(iid, progress=0.05, status="reading EEPROM...")
        cal, why = read_osccal(self.avrdude, port)
        if cal is None:
            self._finish(blist, iid, "firmware", port, "", "failed",
                         f"FAILED: no bootloader answered ({why}) — burn it in the Bootloader tab")
            return

        # 2. Calibrate if there's no value (or asked to).
        calibrated = False
        if cal == 0xFF or self.fw_recal_var.get():
            blist.update(iid, progress=0.1, status="uploading calibration sweep...")
            rc, _, err = urclock(self.avrdude, port, "-U", f"flash:w:{self.cal_hex}:i")
            if rc != 0:
                self._finish(blist, iid, "firmware", port, "", "failed",
                             f"FAILED uploading the sweep ({avrdude_error(err)})")
                return
            blist.update(iid, progress=0.2, status="calibrating OSCCAL...")
            try:
                best, frames = run_sweep(port, lambda f: blist.update(iid, progress=0.2 + 0.4 * f))
            except serial.SerialException as e:
                self._finish(blist, iid, "firmware", port, "", "failed", f"FAILED reading the sweep ({e})")
                return
            if best is None:
                self._finish(blist, iid, "firmware", port, "", "failed",
                             f"FAILED: no OSCCAL gave a clean burst ({frames} bursts read)")
                return
            blist.update(iid, progress=0.65, osccal=f"0x{best:02X}", status="storing OSCCAL...")
            rc, _, err = urclock(self.avrdude, port, "-U", f"eeprom:w:0x{best:02x}:m")
            if rc != 0:
                self._finish(blist, iid, "firmware", port, f"0x{best:02X}", "failed",
                             f"FAILED writing EEPROM ({avrdude_error(err)})")
                return
            cal, calibrated = best, True
        blist.update(iid, osccal=f"0x{cal:02X}")

        # 3. Skip the upload when the board already runs this firmware.
        if not calibrated and not self.fw_force_var.get():
            blist.update(iid, progress=0.7, status="comparing firmware...")
            rc, _, _ = urclock(self.avrdude, port, "-U", f"flash:v:{self.fw_hex}:i")
            if rc == 0:
                blist.update(iid, progress="none")
                self._finish(blist, iid, "firmware", port, f"0x{cal:02X}", "skipped",
                             "already has this firmware — skipped")
                return

        # 4. Upload the firmware (avrdude verifies it) and check OSCCAL survived.
        blist.update(iid, progress=0.75, status="uploading firmware...")
        rc, _, err = urclock(self.avrdude, port, "-U", f"flash:w:{self.fw_hex}:i")
        if rc != 0:
            self._finish(blist, iid, "firmware", port, f"0x{cal:02X}", "failed",
                         f"FAILED uploading firmware ({avrdude_error(err)})")
            return
        after, why = read_osccal(self.avrdude, port)
        if after != cal:
            self._finish(blist, iid, "firmware", port, f"0x{cal:02X}", "failed",
                         f"FAILED: OSCCAL reads back {why or f'0x{after:02X}'}")
            return
        how = "calibrated" if calibrated else "kept"
        self._finish(blist, iid, "firmware", port, f"0x{cal:02X}", "done",
                     f"OK — firmware + OSCCAL 0x{cal:02X} ({how})")


def main():
    root = tk.Tk()
    DskyFlasherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
