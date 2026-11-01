# Printing the keycaps

How the 19 keycaps are printed today, the settings that are saved in the slicer files, and what we tried before. Everything here comes from the 3MF files and Bambu Studio presets (collected 2026-11-01). Nothing below is a guess.

## Current production — `3D Models/Keys (0.2 Nozzle + AMS).3mf`

- **Printer:** Bambu Lab P2S with a **0.2 mm nozzle** and AMS, on the **SuperTack plate**. Printer preset `Bambu Lab P2S 0.2 nozzle Supertack` (stock P2S 0.2 with only the bed model and start G-code changed).
- **Two materials, both PLA:**
  - Filament 1, body: **black**, Bambu PLA Matte (preset `Bambu PLA Matte @BBL P2S 0.2 nozzle - Apollo`).
  - Filament 2, legend: **white**, generic PLA (preset `Generic PLA @BBL P2S 0.2 nozzle - Apollo`).
  - Both "Apollo" presets only change the SuperTack bed temperature: **60 °C on the first layer, 55 °C after**. Nozzle **220 °C**.
- **How the colour is set:** by **colour painting on the mesh**, not by filament changes at a given height. There is no layer-change G-code, no M600 and no height-range modifier in the file. The legend is a white core through each key, with a black body around it. The keys print **face down**, with the stems up.
- **No translucent filament** is used. The light from the SK6812 under each key comes through the white legend core.
- **Process preset `Teclas Apollo 0.2`** (user preset, inherits `0.12mm Balanced Quality @BBL P2S 0.2 nozzle`):

| Setting | Value |
|---|---|
| Layer height / first layer | 0.14 mm / 0.14 mm |
| Line width | 0.20 mm (outer wall 0.22, first layer 0.25, top surface 0.20) |
| Walls | 4, Arachne, outer wall first (`outer wall/inner wall`) |
| Top / bottom shells | 7 / 5 layers |
| Sparse infill | 15 % |
| Ironing | top-most surface only, zig-zag, 30 mm/s, 10 % flow, 0.15 mm spacing |
| Top surface pattern | monotonic line |
| Seam | nearest |
| Speeds (mm/s) | outer wall 20, inner wall 30, top surface 15, small perimeters 15, bridges 25, gap fill 25, sparse infill 40, internal solid infill 40, first layer 10 (infill 10) |
| Accelerations (mm/s²) | default 1500, outer wall 500, top surface 500, first layer 200, first-layer travel 500 |
| Other | reduce crossing walls on, resolution 0.002, min bead width 35 %, min feature size 20 %, infill/wall overlap 20 % |
| Supports | off |
| Brim | auto |
| Prime tower | on (60 mm wide) |

Known drawbacks of this method (from the 2026-05 key RFQ, `OneDrive\DSKY\Key_Faces_RFQ`):

- At this layer height, bed levelling with the 0.2 mm nozzle is fragile. Plates with many bodies fail often.
- The layer lines on the side walls rub against the ridges of the keyboard frame. Each key is sanded by hand.

## Earlier attempt: PETG (`OneDrive\3D Objects\DSKY`, March–April 2026)

`Keys (FDM).3mf` and `Noun_Test.3mf` used the same P2S 0.2 setup and process preset, but with **PETG**. The body was black `#000000` and the legend cream `#FCECD6`. Six user filament presets came from a flow-ratio test: `PETG Keycaps 0.2` at 87 %, 94 %, 97 %, 100 % and 103 % flow, plus `103% Flow (Text)`. The pair that was chosen:

- **Body:** `PETG Keycaps 0.2 97% flow`.
- **Legend:** `PETG Keycaps 0.2 103% Flow (Text)`.
- **Both:** 232 °C (240 °C first layer), SuperTack plate at 65 °C, fan max 50 %, retraction 0.6 mm.
- **Body only:** wipe 1 mm, z-hop 0.3 mm.
- **Text, different per file:**
  - In `Keys (FDM).3mf`: no wipe and no z-hop, retraction speed 15 mm/s.
  - In `Noun_Test.3mf`: 0.5 mm wipe and 0.12 mm spiral z-hop.

`Keys (FDM).3mf` sets the keys object to a 0.10 mm layer height. Other files in that folder (`Keys (FDM 2-Part).3mf`, `Keys (FDM) (Sideways).3mf`, `keybody*.3mf`, `noun.3mf`) contain geometry only, with no slicer settings.

## Not found

We have no recorded print that stacked **white, then translucent, then white PLA** by layer height. We searched the 3MFs in this repo and its git history, `OneDrive\3D Objects\DSKY`, `OneDrive\DSKY`, the Bambu Studio presets and recent projects, and earlier work notes. If that variant gets printed, save its 3MF here and add its layer heights and filament changes to this page.
