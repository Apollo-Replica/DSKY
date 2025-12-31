#pragma once

#include <Arduino.h>

// Build-time override: set with -DOSC_CAL=0xNN
#ifndef OSC_CAL
#define OSC_CAL 0x80
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
#ifndef OSC_CAL_BAUD
#define OSC_CAL_BAUD 115200
#endif

// Apply the per-unit OSCCAL value set at build time.
void applyOscCalFromBuildFlag();

// Run a UART-friendly OSCCAL sweep for offline analysis.
void runOscCalibrationSweep();

