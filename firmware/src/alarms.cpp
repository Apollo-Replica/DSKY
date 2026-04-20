#include "alarms.h"
#include "Adafruit_NeoPixel.h"

Adafruit_NeoPixel leds(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// Initialize LEDs and set all to off.
void initAlarms() {
  leds.begin();      // Initialize the NeoPixel library.
  leds.show();       // Ensure all LEDs are off initially.
  leds.setBrightness(255); // Set full brightness.
}

uint32_t adjustBrightness(uint32_t color, uint8_t brightness) {
    // Normalize brightness to the range 0–1
    uint8_t scale = (uint8_t)((brightness * 255) / 130); // Dont scale to max brightness because it causes issues

    // Extract the red, green, and blue components
    uint8_t red = (color >> 16) & 0xFF;
    uint8_t green = (color >> 8) & 0xFF;
    uint8_t blue = color & 0xFF;

    // Scale each color component
    red = (red * scale) / 255;
    green = (green * scale) / 255;
    blue = (blue * scale) / 255;

    // Combine the components back into a 32-bit color
    return leds.Color(red,green,blue);
}

void setAlarm(uint8_t alarm, uint32_t alarmColor, bool enabled){
  if(enabled) leds.setPixelColor(alarm, alarmColor);
  else leds.setPixelColor(alarm, leds.Color(0,0,0));
}

// Smoothly updates the LED colors in the animation cycle.
void updateAlarms(uint8_t *dskyState) {
  leds.setBrightness(255);

  // Dimming byte goes from 1 to 127
  uint8_t alarmBrightness = dskyState[14];
  uint8_t keyboardBrightness = dskyState[15];
  uint32_t white = leds.Color(255, 255, 35); // White color
  uint32_t orange = leds.Color(255, 60, 0); // Orange color
  uint32_t alarmWhite = adjustBrightness(white,alarmBrightness);
  uint32_t alarmOrange = adjustBrightness(orange,alarmBrightness);
  uint32_t keyboardWhite = adjustBrightness(white,keyboardBrightness);
  
  // B6 Parsing
  uint8_t B6 = dskyState[6]; // B6 Value
  uint8_t UpLink = (B6 >> 4) & 0x01; // UpLink(A1) Value
  setAlarm(6,alarmWhite,UpLink);

  // B9 Parsing
  uint8_t B9 = dskyState[9]; // B9 Value
  uint8_t OprErr = (B9 >> 4) & 0x01; // OprErr(A5) Value
  uint8_t KeyRel = (B9 >> 5) & 0x01; // KeyRel(A4) Value
  uint8_t Stby = (B9 >> 6) & 0x01; // KeyRel(A3) Value
  uint8_t NoAtt = (B9 >> 7) & 0x01; // NoAtt(A2) Value
  setAlarm(2,alarmWhite,OprErr);
  setAlarm(3,alarmWhite,KeyRel);
  setAlarm(4,alarmWhite,Stby);
  setAlarm(5,alarmWhite,NoAtt);

  // B12 Parsing
  uint8_t B12 = dskyState[12]; // B12 Value
  uint8_t Tracker = (B12 >> 1) & 0x01; // Tracker(A12) Value
  uint8_t Restart = (B12 >> 2) & 0x01; // Restart(A11) Value
  uint8_t Prog = (B12 >> 3) & 0x01; // Prog(A10) Value
  uint8_t GimbalLock = (B12 >> 4) & 0x01; // GimbalLock(A9) Value
  uint8_t Temp = (B12 >> 5) & 0x01; // Temp(A8) Value
  uint8_t PrioDisp = (B12 >> 6) & 0x01; // PrioDisp(A7) Value
  uint8_t NoDap = (B12 >> 7) & 0x01; // NoDap(A6) Value
  setAlarm(11,alarmOrange,Tracker);
  setAlarm(10,alarmOrange,Restart);
  setAlarm(9,alarmOrange,Prog);
  setAlarm(8,alarmOrange,GimbalLock);
  setAlarm(7,alarmOrange,Temp);
  setAlarm(1,alarmOrange,PrioDisp);
  setAlarm(0,alarmOrange,NoDap);

  // B13 Parsing
  uint8_t B13 = dskyState[13]; // B13 Value
  uint8_t Vel = (B13 >> 6) & 0x01; // Vel(A14) Value
  uint8_t Alt = (B13 >> 7) & 0x01; // Vel(A13) Value
  setAlarm(13,alarmOrange,Vel);
  setAlarm(12,alarmOrange,Alt);

  // Set all LEDs to the updated color.
  for (int i = 14; i < NUM_LEDS; i++) {
    leds.setPixelColor(i, keyboardWhite);
  }
  leds.show();
}

// Effects
uint8_t r = 255, g = 0, b = 0; // Initial color state.
int8_t deltaR = -1, deltaG = 1, deltaB = 0; // Direction of color changes.

// Smoothly updates the LED colors in the animation cycle.
void colorWheel(uint8_t *dskyState) {
  uint8_t brightness = dskyState[15];
  // Update color values for the animation.
  r += deltaR;
  g += deltaG;
  b += deltaB;
  uint32_t color = adjustBrightness(leds.Color(r, g, b), brightness);

  // Transition logic: when one color channel saturates, switch directions.
  if (r == 255 && g == 0 && b == 0) { deltaR = -1; deltaG = 1; deltaB = 0; } // Red to Green.
  if (r == 0 && g == 255 && b == 0) { deltaR = 0; deltaG = -1; deltaB = 1; } // Green to Blue.
  if (r == 0 && g == 0 && b == 255) { deltaR = 1; deltaG = 0; deltaB = -1; } // Blue to Red.

  // Set all LEDs to the updated color.
  for (int i = 0; i < NUM_LEDS; i++) {
    leds.setPixelColor(i, color);
  }
  leds.show();
}

void christmasEffect() {
  static uint8_t brightness = 0; // Current brightness level.
  static int8_t fadeDirection = 1; // Direction of brightness change (+1 or -1).
  
  // Update brightness for fading effect.
  brightness += fadeDirection;
  if (brightness == 255 || brightness == 0) fadeDirection *= -1; // Reverse fade direction.

  uint32_t red = leds.Color(255, 0, 0);     // Red color.
  uint32_t green = leds.Color(0, 255, 0);   // Green color.

  // Set alternating red and green colors with current brightness.
  for (int i = 0; i < NUM_LEDS; i++) {
    if (i % 2 == 0) {
      leds.setPixelColor(i, adjustBrightness(red, brightness));
    } else {
      leds.setPixelColor(i, adjustBrightness(green, brightness));
    }
  }

  leds.show();
}