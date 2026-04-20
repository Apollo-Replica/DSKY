#include "keyboard.h"

const byte ROWS = 5; //four rows
const byte COLS = 4; //four columns

char hexaKeys[ROWS][COLS] = {
    {'+','V','N','0'},
    {'7','-','4','1'},
    {'8','5',' ','2'},
    {'9','P','6','3'},
    {'C','E','R','K'}
};
byte rowPins[ROWS] = { 7, 6, 4, 3, 2 }; 
byte colPins[COLS] = { A0, A1, 9, 10 };

//initialize an instance of class NewKeypad
Keypad customKeypad = Keypad( makeKeymap(hexaKeys), rowPins, colPins, ROWS, COLS);

char getKey(){
    return customKeypad.getKey();
}

KeyState getState(){
    return customKeypad.getState();
}