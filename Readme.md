# DSKY Replica
> This project is still a work-in-progress

This projects aims to create an affordable and easy to manufacture, yet as realistic as possible replica of the DSKY used in the Apollo program to interface with the Apollo Guidance Computer (AGC).

## Quick start

**Do you want a DSKY but can't build one? Buy one [here](https://shop.ortizma.com)**

**Need Help? Join our Discord [here](https://discord.gg/CHZaYj5UNu)**

**Do you just want to have a DSKY display in your web browser?**
  - Make sure you have NodeJS > 18
  - Run start.bat and answer the prompts

**Do you want to build the whole DSKY replica?**
  - Print the .3mf/.stl meshes found in the '3D Models' folder.
    - You will need to choose a display variant to print:
    - Currently supported displays are:
      - **960x544 AMOLED MIPI display (recommended)** — using an HDMI adapter board
      - 40-Pin 5" 800x480 LCD display — using an HDMI driver board
    - Both displays connect to the Orange Pi via HDMI through their respective adapter boards.
  - Order the PCB:
    - The board is designed to be ordered fully assembled from JLCPCB. The fabrication files (gerbers, BOM, pick-and-place positions) are in the ``Boards/Single_board/production`` folder.
  - Calibrate and flash the firmware:
    - Install PlatformIO into VSCode
    - File -> Open Workspace from File -> DSKY.code-workspace
    - Each ATmega328P has a slightly different internal oscillator. You must first determine your chip's optimal OSCCAL value:
      1. Flash the ``bare_calibration`` environment to run the OSCCAL sweep
      2. Use ``firmware/main/tools/osccal_reader.py`` to read the sweep results and find the best value
      3. Set the ``-DOSC_CAL=0xNN`` flag in ``platformio.ini`` with your value
      4. Flash the ``bare`` environment with your calibrated firmware
  - Set up the Orange Pi:
    - See the [Orange Pi setup guide](Documentation/orangepi-setup.md).
    - Pre-built .img files have been shared around the community, but they are not recommended as they may be out of date.
  - Make sure you have NodeJS > 18
  - Run start.bat on your PC to launch the web display

## Repository contents:
* **Documentation**: Useful information to better understand how the different pieces of the puzzle talk to each other
* **2D Models**: SVG files for alarm labels and backlights.
* **3D Models**:
  * **0.4 Nozzle:** All printable meshes (enclosure, display housing, keyboard plate, mounts, etc.) designed for a standard 0.4mm nozzle.
  * **Keys (0.2 Nozzle + AMS).3mf:** Multi-color key models for a 0.2mm nozzle with AMS.
  * **DSKY.7z:** Compressed assembly file in Autodesk Fusion format and STEP file.
* **Firmware:** PlatformIO project containing the firmware for the bare ATmega328P on the PCB. Includes OSCCAL calibration tooling.
* **Programs:**
  * **next-dsky**: Full-stack Next.js application that serves as the main DSKY UI and backend. Handles serial communication with the PCB, WebSocket connections to AGC simulators, display rendering, and configuration.    * Requirements: NodeJS >18
    * Running: ``npm install`` then ``npm start`` (or use ``start.bat`` from the repo root)
  * **DSKY-Bridge**: Submodule ([nhadrian/DSKY-Bridge](https://github.com/nhadrian/DSKY-Bridge)) — bridge utility for the DSKY.
  * **nassp-cloud**: Node.js service that monitors NASSP (orbiter simulator) telemetry via WebSocket and manages automatic restarts.
  * **click-generator**: Python program that procedurally generates relay clicking audio sequences to emulate the DSKY's relay boxes.
* **Boards**
  * **Single_board**: Unified KiCad PCB project containing the keyboard matrix, alarm lights, serial interface, and backlight driver. The ``production`` folder contains ready-to-order JLCPCB fabrication files.

## Repositories used as reference:
* [AGC_DSKY_Replica](https://github.com/ManoDaSilva/AGC_DSKY_Replica) by ManoDaSilva
* [agc-mechanical-cad](https://github.com/rrainey/agc-mechanical-cad) by rrainey
* [dsky-fonts](https://github.com/ehdorrii/dsky-fonts) by ehdorrii
