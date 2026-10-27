#pragma once

#include <Arduino.h>

// Per-unit OSCCAL lives in this EEPROM byte, written over USB by
// tools/osccal_reader.py --write. 0xFF (erased) means "not calibrated".
// A build flag -DOSC_CAL=0xNN still overrides it.
#ifndef OSC_CAL_EEPROM_ADDR
#define OSC_CAL_EEPROM_ADDR 0
#endif

// Calibration sweep settings (override via -D flags as needed).
#ifndef OSC_CAL_SWEEP_START
#define OSC_CAL_SWEEP_START 0x00
#endif
#ifndef OSC_CAL_SWEEP_END
#define OSC_CAL_SWEEP_END 0xFF
#endif
#ifndef OSC_CAL_SWEEP_STEP
#define OSC_CAL_SWEEP_STEP 1
#endif
#ifndef OSC_CAL_BURST_LEN
#define OSC_CAL_BURST_LEN 64
#endif
#ifndef OSC_CAL_BURST_GAP_MS
#define OSC_CAL_BURST_GAP_MS 20
#endif
// Must divide 8 MHz as exactly as the app's 9600 does (both +0.16 %);
// 115200 is -3.5 % at 8 MHz and would calibrate the clock 3.5 % fast.
#ifndef OSC_CAL_BAUD
#define OSC_CAL_BAUD 38400
#endif

// Apply the per-unit OSCCAL: build flag, else EEPROM, else factory value.
void applyOscCal();

// Run a UART-friendly OSCCAL sweep for offline analysis.
void runOscCalibrationSweep();

