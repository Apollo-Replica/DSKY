#!/usr/bin/env python3
"""
OSCCAL sweep reader for the calibration firmware.

The firmware emits bursts shaped like:
  0xA5 <cal_byte> 64 * 0x55 0x5A

This script listens on a serial port, parses bursts, scores them by how many
0x55 bytes were received correctly, and prints the best OSCCAL observed.

Usage:
  python osccal_reader.py --port COM3 --baud 115200 --bursts 40

Notes:
- Install dependency: pip install pyserial
- Match baud to the calibration firmware (default 115200).
- If your firmware uses a different burst length or markers, adjust constants
  below or override with CLI flags.
"""
from __future__ import annotations

import argparse
import collections
import sys
import time
from typing import Dict, List, Optional, Tuple

try:
    import serial  # type: ignore
    from serial.tools import list_ports  # type: ignore
except ImportError:
    print("pyserial is required. Install with: pip install pyserial", file=sys.stderr)
    sys.exit(1)


DEFAULT_BURST_LEN = 64
HEADER = 0xA5
FOOTER = 0x5A
PATTERN_BYTE = 0x55


Frame = Tuple[int, bytes]
Score = Tuple[int, int]  # (total correct, longest run)


def longest_run_of(byte_val: int, data: bytes) -> int:
    best = cur = 0
    for b in data:
        if b == byte_val:
            cur += 1
            if cur > best:
                best = cur
        else:
            cur = 0
    return best


def score_payload(payload: bytes) -> Score:
    correct = sum(1 for b in payload if b == PATTERN_BYTE)
    run = longest_run_of(PATTERN_BYTE, payload)
    return correct, run


def extract_frames(buf: bytearray, burst_len: int) -> Tuple[List[Frame], bytearray]:
    frames: List[Frame] = []
    i = 0
    min_frame = 2 + burst_len + 1  # header + cal + payload + footer
    while i <= len(buf) - min_frame:
        if buf[i] != HEADER:
            i += 1
            continue

        if i + min_frame > len(buf):
            break  # not enough data yet

        cal = buf[i + 1]
        payload = bytes(buf[i + 2 : i + 2 + burst_len])
        footer = buf[i + 2 + burst_len]
        if footer == FOOTER:
            frames.append((cal, payload))
            i += min_frame
        else:
            # Bad footer; discard this header and continue scanning
            i += 1

    # Trim processed bytes
    return frames, buf[i:]


def pick_best(scores: Dict[int, List[Score]]) -> Tuple[int, Score]:
    best_cal = None
    best_score: Score = (-1, -1)
    for cal, cal_scores in scores.items():
        cal_best = max(cal_scores)
        if cal_best > best_score:
            best_score = cal_best
            best_cal = cal
    if best_cal is None:
        raise RuntimeError("No valid frames decoded.")
    return best_cal, best_score


def summarize(scores: Dict[int, List[Score]], burst_len: int) -> Dict[int, Dict[str, float]]:
    summary: Dict[int, Dict[str, float]] = {}
    for cal, cal_scores in scores.items():
        corrects = [s[0] for s in cal_scores]
        runs = [s[1] for s in cal_scores]
        frames = len(cal_scores)
        summary[cal] = {
            "frames": frames,
            "avg_correct": sum(corrects) / frames,
            "min_correct": min(corrects),
            "max_correct": max(corrects),
            "avg_run": sum(runs) / frames,
            "max_run": max(runs),
            "perfect_frames": sum(1 for c in corrects if c == burst_len),
        }
    return summary


def best_perfect_span(scores: Dict[int, List[Score]], burst_len: int) -> Optional[Tuple[int, int, int]]:
    # Find the longest contiguous span of CAL values that had at least one perfect frame.
    perfect_cals = sorted(cal for cal, cal_scores in scores.items() if any(s[0] == burst_len for s in cal_scores))
    if not perfect_cals:
        return None
    best_span = (perfect_cals[0], perfect_cals[0])
    cur_start = cur_end = perfect_cals[0]
    for cal in perfect_cals[1:]:
        if cal == cur_end + 1:
            cur_end = cal
        else:
            if (cur_end - cur_start) > (best_span[1] - best_span[0]):
                best_span = (cur_start, cur_end)
            cur_start = cur_end = cal
    if (cur_end - cur_start) > (best_span[1] - best_span[0]):
        best_span = (cur_start, cur_end)
    mid = (best_span[0] + best_span[1]) // 2
    return best_span[0], best_span[1], mid


def auto_detect_port(preferred: Optional[str] = None) -> str:
    if preferred and preferred.lower() != "auto":
        return preferred

    ports = list(list_ports.comports())
    if not ports:
        raise RuntimeError("No serial ports found. Specify --port explicitly.")

    # Heuristic: prefer CH340/USB-Serial/USBasp-like descriptors.
    def weight(p) -> int:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        score = 0
        if "ch340" in desc or "ch341" in desc:
            score += 4
        if "usb" in desc:
            score += 2
        if "usb" in hwid:
            score += 1
        return score

    ports.sort(key=weight, reverse=True)

    chosen = ports[0]
    print("Auto-selected port:", chosen.device)
    if len(ports) > 1:
        print("Other candidates:")
        for p in ports[1:]:
            print(f"  {p.device}: {p.description}")
    return chosen.device


def main() -> int:
    parser = argparse.ArgumentParser(description="Read OSCCAL sweep bursts and pick the best value.")
    parser.add_argument("--port", help="Serial port (e.g., COM3 or /dev/ttyUSB0). Use 'auto' or omit to auto-detect.")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (matches calibration firmware)")
    parser.add_argument("--bursts", type=int, default=40, help="Target bursts to collect before deciding")
    parser.add_argument("--timeout", type=float, default=0.2, help="Serial read timeout seconds")
    parser.add_argument("--burst-len", type=int, default=DEFAULT_BURST_LEN, help="Payload length in bytes")
    parser.add_argument("--max-seconds", type=float, default=30.0, help="Stop after this many seconds even if bursts not reached")
    args = parser.parse_args()

    try:
        port = auto_detect_port(args.port)
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 1

    ser = serial.Serial(port, args.baud, timeout=args.timeout)
    buf = bytearray()
    scores: Dict[int, List[Score]] = collections.defaultdict(list)

    print(f"Listening on {port} at {args.baud} baud...")
    start = time.time()
    frames_seen = 0
    try:
        while frames_seen < args.bursts and (time.time() - start) < args.max_seconds:
            chunk = ser.read(512)
            if chunk:
                buf.extend(chunk)
                frames, buf = extract_frames(buf, args.burst_len)
                for cal, payload in frames:
                    s = score_payload(payload)
                    scores[cal].append(s)
                    # Live feedback per burst
                    print(f"cal=0x{cal:02X} correct={s[0]:3d} run={s[1]:3d}")
                frames_seen += len(frames)
    finally:
        ser.close()

    if not scores:
        print("No valid bursts received. Check wiring/baud and try again.", file=sys.stderr)
        return 1

    best_cal, best_score = pick_best(scores)
    total_frames = sum(len(v) for v in scores.values())
    summary = summarize(scores, args.burst_len)
    span = best_perfect_span(scores, args.burst_len)

    print(f"\nFrames decoded: {total_frames}")
    print(f"Unique OSCCAL values seen: {len(scores)}")
    print(f"Best OSCCAL (max score): 0x{best_cal:02X}  (score: correct={best_score[0]}, longest_run={best_score[1]})")
    if span:
        lo, hi, mid = span
        print(f"Longest perfect span: 0x{lo:02X} - 0x{hi:02X} (midpoint 0x{mid:02X})")

    print("\nTop candidates by avg_correct then max_run:")
    ranked = sorted(
        summary.items(),
        key=lambda item: (item[1]["avg_correct"], item[1]["max_run"]),
        reverse=True,
    )
    for cal, stats in ranked[:15]:
        print(
            f"  0x{cal:02X} -> avg_correct={stats['avg_correct']:.1f}, "
            f"min={stats['min_correct']}, max={stats['max_correct']}, "
            f"avg_run={stats['avg_run']:.1f}, max_run={stats['max_run']}, "
            f"perfect_frames={int(stats['perfect_frames'])}, frames={int(stats['frames'])}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

