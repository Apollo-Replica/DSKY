#include <Arduino.h>

#define LED_PIN 5 // PD5 pin for SK8612 data line.
#define NUM_LEDS 34 // 14 original LEDs + 20 for the keyboard.

void initAlarms();
void setAlarm(uint8_t alarm, uint32_t alarmColor, bool enabled);
uint32_t adjustBrightness(uint32_t color, uint8_t brightness);
void updateAlarms(uint8_t *dskyState);
void colorWheel(uint8_t *dskyState);
void christmasEffect();