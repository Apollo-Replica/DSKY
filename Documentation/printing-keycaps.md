# Printing the keycaps

How the 19 keycaps are printed today, the settings that are saved in the slicer files, and what we tried before. Everything here comes from the 3MF files, Bambu Studio presets and test prints (collected 2026-11-01, updated 2026-11-19). Anything not yet confirmed says so.

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

## Layered legend: white, transparent, white (November 2026)

The legend is printed in three colours stacked by height, so the letters stay white when the key is off and light up evenly when it is on. The keys print face down at 0.14 mm per layer, and the legend part (letters 0–0.5 mm plus a full diffuser plate 0.5–0.8 mm) is cut by height:

| Layers | Printed height | Legend colour |
|---|---|---|
| 1–3 | 0–0.42 mm | white (cream PLA) |
| 4–5 | 0.42–0.70 mm | transparent PLA |
| 6 | 0.70–0.84 mm | white |
| 7 and up | | black body only |

Filament slots in the project (AMS slots as loaded on 2026-11-17):

| Filament | Use | AMS |
|---|---|---|
| 1 | black body, Bambu PLA Matte | A4 |
| 2 | white legend. Cream PLA `#FCECD6` was used until the official white PLA arrives | A3 |
| 3 | transparent PLA | A2 |
| 4 | black again, for the first layer of the letter counters (next section) | A4 |

The PETG HF white in A1 is not used: it sticks badly to PLA.

`tools/build_layered_keys.py` builds this project from the production 3MF. It cuts each legend with manifold3d, removes the colour painting, sets the extruder per part and adds the extra filaments.

### First layer from the outside in

On layer 1 the printer must lay down the black outline first, then the white letters, then the black islands inside the letters (the counters of 0, 4, 6, 8, 9, PRO, VERB, NOUN…). With this order every colour has a wall to lean on and layer 1 comes out clean.

- The 17 counters are separate small parts (0–0.5 mm). Their first layer (0–0.14 mm) is assigned to filament 4, a copy of the black mapped to the same AMS slot. The rest of each counter stays on filament 1.
- The first-layer filament order is set to `1, 2, 4, 3`.
- Cost: two more filament changes (9 in total). The 19 one-piece keys take about 23 h.

### Adhesion, flow and walls on the P2S (attempts of 2026-11-17/18)

- **Bed:** with the SuperTack at 60 °C on the first layer and 55 °C after, one key came loose and the rest were barely stuck. Use **65 °C** on the whole print. Bambu's stock SuperTack value for PLA is 45 °C, and the user presets `… Warm Supertack` use 60 °C.
- **Cream PLA flow:** this cream filament under-extrudes. Its flow ratio is set to **1.08** (was 0.98). Go back to the normal value with the official white.
- **Walls:** with `outer wall/inner wall` some layers stuck out more than others on the side walls. The G-code had the same outline on every layer, so the problem was how the wall was laid down, not the model. Use **`inner wall/outer wall`**.

## Two-piece keycap (November 2026)

The key is split into a face cap and a body:

- **Face cap:** carries the legend. It prints face down with the colour recipe above.
- **Body:** walls, struts and MX stem, all black. It prints on its side.

Printed on its side, the body's sliding walls have their layer lines running in the travel direction, so they do not catch on the ridges of the keyboard frame. The colour part is now only 4.1 mm tall instead of 14.4 mm, which makes it faster and gives less to come loose.

Files in `3D Models/Keys (2-Part FDM)/`:

- `Faces with legends (0.2 Nozzle + AMS).3mf`: the 19 caps on one plate, 29 layers, about 8 h 40 min, 9 filament changes.
- `Body - print on its side.stl`: one body, already lying on its side. The body is the same for all 19 keys.
- `Bodies x20 (0.4 nozzle).3mf`: 20 bodies for the P2S with a 0.4 nozzle on the textured PEI plate, ready to open in Bambu Studio (see below).
- `tools/`: `build_faces.py` + `faces_geom.py` (caps for all keys), `build_bodies.py` + `bodies_geom.py` (5 bodies with the 0.2 nozzle project) and `two_piece.py` (split of one key, with the body).
- `p04/`: how the 0.4 nozzle bodies project was made (`resolve.py`, the two preset override files and `add_blockers.py`).

Geometry (key "1", same for all):

| Part | Value |
|---|---|
| Body outside | 22.44 × 22.44 mm, 12.32 mm long |
| Face cap | 22.14 × 22.14 × 2.1 mm |
| Plug | 2 mm high, 1 mm wall, 0.10 mm clearance per side, chamfered lead-in |
| Seam | 2.1 mm from the face |
| Cap inset | 0.15 mm per side |
| Body edge chamfer | 0.25 mm |
| Light path | cavity above the 0.8 mm legend, kept open |

The cap inset means only the body touches the frame when the key travels, and a small mismatch between the parts disappears in the step.

The previous two-piece attempt is `Keys (FDM 2-Part).3mf` and `keybody1.3mf` (April–May 2026). Its cap was a 0.65 mm plate of 22.44 mm, and its body measured 22.64 mm, wider than the cap, so the parts never sat flush.

**Printing the body on its side:**

- Lay the body on the wall the two stem struts run down to (−Y in the model). The struts then grow from the bed up to the stem.
- The MX cross uses the profile from `keybody1.3mf`. The top of the horizontal arm is raised from 0.64 to 0.78 mm, and a 45° roof rises to the vertical arm, which is widened from 1.28 to 1.40 mm. The roof of the hole then holds itself up with no bridge. Print with the roof up.
- The stem lies horizontal and needs normal (not tree) supports under it, and so do the lower tips of the two struts. With a 30° support angle the slicer leaves them unsupported.
- Raising the angle also puts support inside the cross hole: on its flat 1.4 mm top and, above about 45°, on the roof. Support there cannot be removed. So each body gets a **support blocker** (a 4.4 × 7.8 × 4.6 mm box over the cross hole, `<part subtype="support_blocker">` in `model_settings.config`).

**Body print settings.** The bodies printed with the 0.2 nozzle (0.14 mm layers, 4 walls of 0.2 mm) came out flimsy. The bodies are printed with the **0.4 nozzle**:

| Setting | Value |
|---|---|
| Printer / process / filament | Bambu Lab P2S 0.4 nozzle / 0.16mm High Quality @BBL P2S / Bambu PLA Matte @BBL P2S |
| Walls | 4 (the 1.4 mm walls come out nearly solid) |
| Sparse infill | 40 % |
| Support | normal(auto), threshold angle 44°, no support under bridges, blocker in the cross |
| Plate | Textured PEI, 60 °C |
| Time | 20 bodies in about 4 h 53 min, 53 g plus 19 g of support |

With the 0.2 nozzle project (`tools/build_bodies.py`) the threshold is 55°. The 0.2 nozzle bodies were too weak, so it is only kept for reference.

**Build note:** body 55 of the production 3MF is not watertight. So every cap is built from the clean body of key 42, minus that key's own legend and counters.

## Bambu Studio pitfalls when printing from the GUI

The projects are sliced with the CLI (`bambu-studio --slice 0 --export-3mf`) and checked there. Bambu Studio then re-slices when the file is opened to print, and some settings change:

- **Plate type:** the GUI loads the project as **"Placa de ingeniería"** (Engineering plate, 55 °C), not SuperTack. Before slicing, pick **"Placa enfriamiento de Bambu SuperTack"** in the plate drop-down. Otherwise the bed runs at 55 °C even though the project says 65 °C.
- **Settings that disappear on re-slice:** the GUI rebuilds each preset from the system preset and keeps only the changes listed in `different_settings_to_system` in `project_settings.config` (entry 0 for the process, one entry per filament, the last one for the printer). A change that is not listed there is silently reverted. On 2026-11-19 this undid the first-layer order (the white printed first), the supports and the bed temperature. The build scripts now add every key they change to that list. The first-layer order is also written on the plate (`first_layer_sequence_choice = customize`, `first_layer_print_sequence = "1 2 4 3"` in `<plate>` of `model_settings.config`).
- **Number of filament changes:** compare it between the CLI slice and the GUI slice. A different count (8 instead of 9) means the order changed.
- **Printer in the send dialog:** a freshly started Bambu Studio may show no printer there. Pick it from the drop-down.
- **AMS slot in the send dialog:** when a spool is not identified (no RFID), Bambu Studio maps the black filament to another slot (A2 or A3). Check the mapping and set it to the black spool by hand.
- **Nozzle diameter:** the printer reports its nozzle over MQTT (`device.nozzle.info[0].diameter`). After changing the nozzle, set the new diameter on the printer screen and check it before sending.
- **Raw G-code:** Bambu Studio does not print a loose `.gcode` file, it only uploads it. Send a 3MF project.
- **CLI with other presets:** `--load-settings` with system preset files does not resolve their `inherits` chain (it sliced with a generic start G-code at 200 °C). `p04/resolve.py` writes fully resolved presets that still name their parent.
- **SuperTack plate warning:** the printer sometimes reports a false "plate does not match" (0500-8051 090402) a few minutes in. If the SuperTack really is on the bed, choose "ignore and resume".
- **Bed temperature check:** read it over MQTT as soon as the print starts. Remote G-code (`gcode_line`) is rejected by the firmware ("mqtt message verify failed"), so a wrong temperature has to be fixed from Bambu Studio's Device tab.
