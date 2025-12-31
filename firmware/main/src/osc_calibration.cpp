#include "osc_calibration.h"

void applyOscCalFromBuildFlag() {
  OSCCAL = OSC_CAL;
}

static void sendBurst(uint8_t cal) {
  OSCCAL = cal;
  Serial.end();               // Re-sync UART to new clock value.
  Serial.begin(OSC_CAL_BAUD);
  delay(5);

  Serial.write(0xA5);         // Header marker.
  Serial.write(cal);          // Current OSCCAL value.
  for (uint16_t i = 0; i < OSC_CAL_BURST_LEN; i++) {
    Serial.write(0x55);       // Known pattern for timing checks.
  }
  Serial.write(0x5A);         // Footer marker.
}

void runOscCalibrationSweep() {
  Serial.begin(OSC_CAL_BAUD);
  delay(50);

  for (uint16_t cal = OSC_CAL_SWEEP_START; cal < OSC_CAL_SWEEP_END; cal += OSC_CAL_SWEEP_STEP) {
    sendBurst(static_cast<uint8_t>(cal));
    delay(OSC_CAL_BURST_GAP_MS);
  }
}

