# Bill of materials

Everything needed to build one DSKY replica (AMOLED variant).

## Electronics

| Qty | Part | Notes | Where we bought it |
|---:|---|---|---|
| 1 | DSKY PCB, rev 1.0.0, fully assembled | Order from JLCPCB with the files in `Boards/Single_board/production`. See [PCB](#pcb) below. | JLCPCB |
| 1 | Orange Pi Zero 2W (Allwinner H618) | Any RAM size works; we use the 4 GB one. | Shenzhen Lingyi (Orange Pi store) |
| 1 | MicroSD, 32 GB | For the Orange Pi OS. A reputable brand (SanDisk Ultra, Transcend…). | Any |
| 1 | 5" AMOLED panel, 960×544 | Bought as a kit with its HDMI driver board. | AliExpress (Wisecoco) or Taobao |
| 1 | HDMI driver board for the 960×544 panel | Comes with the panel. | AliExpress (Wisecoco) or Taobao |
| 1 | HDMI flex cable kit: ribbon + HDMI Type-A 90° up + Mini-HDMI (Type-C) 90° up | Sold as one assembled pack ("HDMI flex A2-B1 0.5 m, 上弯转 miniHDMI"). Mini-HDMI end goes to the Orange Pi, Type-A end to the driver board. | Taobao |
| 19 | Cherry MX Blue switch, RGB (clear housing), MX1A-E1NN | Clear housing so the per-key SK6812 shows through. Hot-swapped into the PCB's Kailh sockets. | AliExpress |
| 3 | USB-C to USB-C cable, short (25 cm) | J3 (USB serial) → Orange Pi data port; J4 and J5 (5 V out) → Orange Pi power port and driver board. | AliExpress |
| 1 | USB adapter, Micro-B male → USB-C female, U-shape (180°) | For the driver board's Micro-USB power input, so the cable doesn't stick out. Taobao code 480-26. | Taobao |
| 1 | Power supply 5 V 10 A (50 W), 100-240 V AC in | Enclosed switching PSU with screw terminals. | AliExpress |
| 1 | DC harness: KF2EDGK-5.08 2-pin plug → 2× M4 ring terminals, 500 mm, 20 AWG | PSU 5 V output → PCB J1 (POWER). Custom: HECON HC-WH50802D500-X0279. | Shenzhen Xinpengbo (custom) |
| 1 | AC harness: IEC C14 inlet (AC-14-F16C, 3× 187 faston) → 3× M4 ring terminals, 500 mm, 20 AWG | Panel inlet → PSU AC input. Custom: HECON HC-WH03D500-X0278. | Shenzhen Xinpengbo (custom) |
| 1 | Mains cable with IEC C13 plug | EU (Schuko) or US (NEMA 5-15) depending on where the DSKY goes. | AliExpress |

The two harnesses are custom-made in batches of 100. For a one-off build, any 20 AWG wire with M4 ring terminals, a 2-pin 5.08 mm pluggable terminal plug, and a panel-mount C14 inlet with faston tabs does the same job.

## Hardware

All screws are stainless steel A2 / 304.

| Qty | Part |
|---:|---|
| 17 | M3×18 countersunk hex socket (DIN 7991 / ISO 10642) |
| 11 | M3×30 countersunk hex socket (DIN 7991 / ISO 10642) |
| 7 | M3×22 socket head cap (DIN 912 / ISO 4762) |
| 6 | M3×40 socket head cap (DIN 912 / ISO 4762) |
| 12 | M3×6 button head hex socket (DIN 7380 / ISO 7380); M3×8 also fits |

## Printed parts

### Enclosure (FDM, 0.4 mm nozzle, PLA) — `3D Models/0.4 Nozzle.3mf`

| Part (object in the 3MF) | Color | PLA, g |
|---|---|---:|
| Compact Enclosure | Black | 159 |
| Cover (LCD) | Grey | 66 |
| Mount Bottom | Grey | 63 |
| Mount Top | Grey | 52 |
| Gasket Bottom | Grey | 40 |
| Display Housing (OLED) | Grey | 37 |
| Alarm Housing Bottom | Grey | 25 |
| Alarm Splitter | Grey | 23 |
| Gasket Top | Grey | 17 |
| Alarm Housing Top | Grey | 10 |
| Keyboard Plate | Grey | 10 |
| Keyboard Holder | Grey | 10 |
| Frame (LCD) | Grey | 4 |

About **360 g of grey and 160 g of black PLA** (estimates: 55 % of the solid volume at 1.24 g/cm³). We use Bambu Lab PLA Matte in Nardo Grey and Charcoal.

`Replica Enclosure.3mf` (Enclosure bottom + middle) is an alternative, more faithful outer shell. `(OLD) Display Housing (LCD).3mf` is only for the legacy 800×480 LCD.

### Keycaps (FDM, 0.2 mm nozzle, multi-color/AMS) — `3D Models/Keys (0.2 Nozzle + AMS).3mf`

19 keycaps with the legends printed in. `(TOOL) Key Shipping Holder.stl` is only for shipping.

### Alarm panel — `2D Models/`

- `Alarms.svg`: the alarm labels, printed on an A4 sheet.
- `Backlights for SLA.svg`: the backlight shapes for the alarm panel.

## PCB

The board is ordered **fully assembled** from JLCPCB: gerbers, BOM and pick-and-place are in `Boards/Single_board/production` (`bom.csv`, `positions.csv`, `DSKY_Keyboard_1.0.0.zip`). It carries the ATmega328P, the CH340C USB-serial chip, 34 SK6812-MINI-E LEDs (keys and alarms), 19 Kailh MX hot-swap sockets, three USB-C ports and the 5 V screw terminal.

Some lines in `bom.csv` have no LCSC part number, so pick a part for them in JLCPCB's BOM step:

| Designator | Part | Suggested |
|---|---|---|
| J3, J4, J5 | USB-C receptacle, 16-pin USB 2.0, through-hole (918-468K2029E50001) | Same MPN |
| R2, R3, R9, R10, R44, R45 | 5.1 kΩ 0603 (USB-C CC pull-downs) | Any 1 % 0603 |
| D35 | MBR0520LT1G Schottky, SOD-123 | Same MPN |

## Tools

- **USBasp programmer** (with a 6-pin ICSP cable): the ATmega328P is flashed through the ICSP header (J2), see the firmware steps in the [README](../Readme.md). Do not use "Burn bootloader".
- A 3D printer, with AMS or another multi-color system for the keycaps.
