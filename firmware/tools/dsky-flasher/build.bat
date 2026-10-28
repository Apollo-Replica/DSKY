@echo off
cd /d "%~dp0"
echo Installing dependencies...
pip install pyinstaller pyserial platformio

echo.
echo Building firmware and calibration images...
python -m platformio run -d ..\..\.. -e bare_usb -e bare_usb_calibration || goto :error

echo.
echo Building DSKYFlasher.exe...
python -m PyInstaller --onefile --windowed --name DSKYFlasher --distpath dist --paths .. dsky_flasher.py || goto :error

echo.
echo Copying avrdude and images next to the exe...
set PIO_PKGS=%USERPROFILE%\.platformio\packages
if not exist dist\avrdude mkdir dist\avrdude
if not exist dist\images mkdir dist\images
if not exist dist\driver mkdir dist\driver
copy /y driver\wdi-simple.exe dist\driver\ >nul || goto :error
copy /y "%PIO_PKGS%\tool-avrdude\avrdude.exe" dist\avrdude\ >nul || goto :error
copy /y "%PIO_PKGS%\tool-avrdude\avrdude.conf" dist\avrdude\ >nul || goto :error
copy /y "%PIO_PKGS%\framework-arduino-avr-minicore\bootloaders\urboot\atmega328p\watchdog_1_s\autobaud\uart0_rxd0_txd1\led+b5\urboot_atmega328p_pr_ee_ce.hex" dist\images\bootloader.hex >nul || goto :error
copy /y ..\..\..\.pio\build\bare_usb\firmware.hex dist\images\firmware.hex >nul || goto :error
copy /y ..\..\..\.pio\build\bare_usb_calibration\firmware.hex dist\images\calibration.hex >nul || goto :error

echo.
echo Done! Portable folder: dist\ (DSKYFlasher.exe + avrdude\ + images\ + driver\)
pause
exit /b 0

:error
echo.
echo Build failed.
pause
exit /b 1
