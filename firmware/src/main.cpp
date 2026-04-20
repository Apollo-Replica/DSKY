#include <Arduino.h>
#include "alarms.h"
#include "keyboard.h"
#include "osc_calibration.h"

using namespace std;

const uint8_t PACKET_SIZE = 16;
constexpr uint32_t SERIAL_BAUD = 9600;
uint8_t dskyState[PACKET_SIZE];
uint8_t memoryLocation = 0;
uint8_t verbPresses = 0; // RGB Mode
uint8_t lightMode = 0;

void setup() {
#if defined(OSC_CAL_SWEEP)
  runOscCalibrationSweep();
  while (true) {}
#endif

  // Initialize state as only the RESTART alarm at low brightness.
  // This improves the chances that the OrangePi will boot successfully
  // while indicating correct Atmega power up.
  for(uint8_t i = 0; i<PACKET_SIZE;i++) dskyState[i] = 0x00;
  dskyState[12] = 0x04;
  dskyState[14] = 20;

  applyOscCalFromBuildFlag();
  Serial.begin(SERIAL_BAUD);
  initAlarms();
}

bool proPressed = false;
void loop() {
  // Serial input
  if(Serial.available() > 0){
    uint8_t receivedByte = Serial.read(); // Read the incoming byte

    if (receivedByte == 0xFF) { // Check if received byte is 0xFF
      memoryLocation = 0; // Reset the array index
    } else {
      dskyState[memoryLocation] = receivedByte; // Store the byte in the array
      memoryLocation = (memoryLocation + 1) % PACKET_SIZE; // Increment array index and wrap around if necessary
    }
  }

  // Keyboard input
  char pressedKey = getKey();
  if(pressedKey){
    Serial.println(pressedKey);
    if(pressedKey == 'P') proPressed = true;
    if(pressedKey != 'V') verbPresses = 0;
    if(pressedKey == 'V') verbPresses++;
  }
  if(getState() == RELEASED && proPressed){
    proPressed = false;
    Serial.println("O");
  }

  // Lighting
  if(verbPresses == 3){
    lightMode = (lightMode + 1) % 3;
    verbPresses = 0;
  }
  if(pressedKey == '+' && lightMode != 0){
    dskyState[14] = min(dskyState[14] + 20, 127);
    dskyState[15] = dskyState[14];
  }
  if(pressedKey == '-' && lightMode != 0){
    dskyState[14] = max(dskyState[14] - 20, 0);
    dskyState[15] = dskyState[14];
  }

  if (lightMode == 0) {
    // Display dsky state using neopixels
    updateAlarms(dskyState);
  }else if(lightMode == 1){
    // Display colorwheel effect
    colorWheel(dskyState);
  }else if(lightMode == 2){
    // Display colorwheel effect
    christmasEffect();
  }
}