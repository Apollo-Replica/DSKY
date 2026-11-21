# Orange Pi Zero 2W Setup Guide

This guide walks you through setting up an Orange Pi Zero 2W from scratch to run the DSKY software. This is the recommended approach over using pre-built .img files, which may be out of date.

## Base OS

Flash the official **Orange Pi Zero 2W** image (Ubuntu Jammy desktop, arm64, version 1.0.2 or newer) to your SD card using your preferred tool (e.g. balenaEtcher, dd).

> Use a recent image: older builds ship U-Boot 2021.07, which does not boot on newer Zero 2W boards (e.g. the 1.5 GB model). The board then shows only the red power LED, with no HDMI output.

Default credentials are typically `orangepi` / `orangepi`.

## Initial setup

After first boot, connect via SSH or a monitor and keyboard.

```bash
# Set hostname
sudo hostnamectl set-hostname dsky

# Update the system
sudo apt update && sudo apt upgrade -y
```

### Create a swap file

The Orange Pi Zero 2W has limited RAM. A swap file helps prevent out-of-memory issues during `npm install` and builds.

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile swap swap sw 0 0' | sudo tee -a /etc/fstab
```

## Install dependencies

```bash
sudo apt install -y git x11vnc wmctrl curl software-properties-common

# brltty grabs the board's CH340 USB-serial adapter and /dev/ttyUSB0 vanishes
sudo apt purge -y brltty

# Node.js 20 (next-dsky runtime)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Chromium as a native .deb (Ubuntu's own package is a slow snap on the Zero 2W)
sudo add-apt-repository -y ppa:xtradeb/apps
printf 'Package: chromium-browser\nPin: release o=Ubuntu\nPin-Priority: -1\n' | sudo tee /etc/apt/preferences.d/no-snap-chromium
sudo apt update && sudo apt install -y chromium
sudo ln -sf /usr/bin/chromium /usr/local/bin/chromium-browser   # name used by orangepi.sh
```

### VirtualAGC (optional)

If you want to run the AGC simulator locally on the Orange Pi:

```bash
sudo apt-get install -y wx2.8-headers libwxgtk2.8-0 libsdl1.2debian libncurses5
```

Build VirtualAGC from source or use a pre-built release. The binaries should end up in `~/VirtualAGC/bin/` (notably `yaAGC`).

## Clone the DSKY repository

```bash
cd ~
git clone https://github.com/Apollo-Replica/DSKY.git
cd DSKY/Programs/next-dsky
npm install
npm run build
```

## Configure appliance-mode boot

Appliance mode boots the Orange Pi straight to the DSKY UI — no desktop, no login prompt, no visible Linux. A helper script does all the setup:

```bash
cd ~/DSKY
bash Programs/orangepi-utilities/setup-appliance-mode.sh
sudo reboot
```

What the script does:

- Installs `openbox`, `feh`, and `unclutter` (minimal WM, splash loader, cursor hider).
- Disables `apt-daily.timer` / `apt-daily-upgrade.timer` and removes `update-manager`/`update-notifier` so auto-updates don't fight the appliance.
- Purges `brltty`, which otherwise takes over the board's CH340 serial adapter (see Notes).
- Sets silent kernel boot args in `/boot/orangepiEnv.txt` (`quiet splash loglevel=0`, hides console cursor and blanking).
- Registers a custom `dsky` X session and configures LightDM to auto-login the `orangepi` user into it.
- Creates `~/.xsession`, which launches `openbox` and runs `~/DSKY/orangepi.sh`.
- Silences the `getty@tty1` login banner.
- Swaps the Plymouth boot watermark to the DSKY mission patch.

After reboot: power on → splash image (or black screen) → DSKY UI.

The splash image lives at `~/DSKY/Programs/orangepi-utilities/splash.png`. Use portrait orientation matching your display (e.g. 544×960). If the file is missing the screen stays black until the UI is ready.

## Display rotation

The DSKY display is mounted in portrait orientation, so the HDMI output needs to be rotated 90° counterclockwise. `orangepi.sh` applies an xrandr transform automatically at startup.

The default transform is `0,-1,544,1,0,0,0,0,1`, where `544` is the height of the recommended 960×544 AMOLED display. Override via environment variables in `~/.xsession` (created by the appliance-mode script) only if your display differs:

```bash
#!/bin/bash
export DSKY_XRANDR_OUTPUT=HDMI-1                    # default: HDMI-1
export DSKY_XRANDR_TRANSFORM=0,-1,544,1,0,0,0,0,1   # match your display height
export DSKY_DISPLAY=amoled544                       # or lcd480 for the legacy 800×480 panel
openbox &
~/DSKY/orangepi.sh
```

> For the legacy 800×480 LCD: use `480` in place of `544` in the transform and set `DSKY_DISPLAY=lcd480`. Exporting `DSKY_DISPLAY` in `~/.xsession` is preferred over editing `Programs/next-dsky/.env` — `.xsession` env vars propagate through `orangepi.sh` into `next-dsky` at runtime.

## VNC access (optional)

To remotely view and control the Orange Pi's display:

```bash
# Set a VNC password
x11vnc -storepasswd

# Create a systemd service (more reliable than autostart desktop entries)
sudo tee /etc/systemd/system/x11vnc.service << 'EOF'
[Unit]
Description=x11vnc VNC server
After=display-manager.service

[Service]
Type=simple
ExecStart=/usr/bin/x11vnc -forever -usepw -display :0 -auth guess
User=orangepi
Restart=on-failure
RestartSec=3

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable x11vnc
sudo systemctl start x11vnc
```

## WiFi Connect (optional)

[wifi-connect](https://github.com/balena-os/wifi-connect) provides a captive portal for configuring WiFi on a headless device. The DSKY's configuration UI can trigger it.

Install the prebuilt arm64 binary from its releases (no Rust toolchain needed):

```bash
curl -fsSL https://github.com/balena-os/wifi-connect/releases/download/v4.11.91/wifi-connect-aarch64-unknown-linux-gnu.tar.gz \
  | sudo tar -xz -C /usr/local/sbin wifi-connect
sudo chown root:root /usr/local/sbin/wifi-connect
```

The appliance-mode script (step 8) then installs the DSKY-styled portal page from `Programs/orangepi-utilities/wifi-portal/` into `/usr/local/share/wifi-connect/ui`, adds the password-less sudo rule the app needs to launch `wifi-connect`, and turns off WiFi power saving. If you install `wifi-connect` after running it, simply run the script again; it is safe to re-run.

The `orangepi.sh` launcher script already passes `--wifi-connect` to `next-dsky` when needed. From the DSKY menu, **SETTINGS → WIFI** starts a "DSKY Replica" access point; join it from a phone and pick your network on the page that opens (or browse to `http://192.168.42.1`).

## Software updates

After this initial setup the device updates itself over the air: new versions published as GitHub releases can be installed from the DSKY's own menu (**SETTINGS → UPDATE**), with automatic rollback if anything goes wrong. The git clone made above acts as the permanent factory fallback — don't delete it. See [updates.md](updates.md) for details.

## Notes

- The Orange Pi connects to the PCB via USB serial (`/dev/ttyUSB0`, a CH340 adapter).
- If the keypad does nothing and `/dev/ttyUSB0` is missing, check `sudo dmesg | grep ttyUSB`: a line like
  `usbfs: interface 0 claimed by ch341 while 'brltty' sets config #1` followed by
  `ch341-uart converter now disconnected from ttyUSB0` means brltty took the port. Fix it with
  `sudo apt purge -y brltty` and a reboot.
- The `orangepi.sh` script handles display rotation, splash, starting `next-dsky` with the correct serial port, opening Chromium fullscreen, and restarting on crash.
- `unclutter` is launched by `orangepi.sh` to hide the mouse cursor immediately.
- The fstab uses `noatime,commit=600` to reduce SD card writes.
- To revert appliance mode: remove `~/.xsession`, `/etc/lightdm/lightdm.conf.d/50-appliance.conf`, `/usr/share/xsessions/dsky.desktop`, and `/etc/systemd/system/getty@tty1.service.d/override.conf`, then reboot.
