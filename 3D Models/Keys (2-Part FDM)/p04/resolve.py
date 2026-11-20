import json, os, sys
BASE = os.path.expanduser("~/.local/share/flatpak/app/com.bambulab.BambuStudio/current/active/files/share/BambuStudio/profiles/BBL")  # Bambu Studio flatpak (user install)
idx = {}
for sub in ("machine", "process", "filament"):
    for root, _, fs in os.walk(os.path.join(BASE, sub)):
        for f in fs:
            if f.endswith(".json"):
                try: d = json.load(open(os.path.join(root, f)))
                except Exception: continue
                if "name" in d: idx[(sub, d["name"])] = d
def resolve(sub, name):
    d = idx[(sub, name)]
    out = resolve(sub, d["inherits"]) if d.get("inherits") else {}
    out.update({k: v for k, v in d.items()})
    return out
def flat(sub, name, overrides, newname, outpath):
    r = resolve(sub, name); r.update(overrides)
    r.pop("inherits", None); r["name"] = newname; r["from"] = "User"; r["instantiation"] = "true"
    json.dump(r, open(outpath, "w"), indent=1)
    print(outpath, len(r), "keys")
m = flat("machine", "Bambu Lab P2S 0.4 nozzle", {}, "Bambu Lab P2S 0.4 nozzle", "m04.json")
po = json.load(open("p04_process.json")); [po.pop(k, None) for k in ("type","name","inherits","from","instantiation")]
flat("process", "0.16mm High Quality @BBL P2S", po, "Cuerpos teclas 0.4", "proc04.json")
fo = json.load(open("p04_filament.json")); [fo.pop(k, None) for k in ("type","name","inherits","from","instantiation")]
flat("filament", "Bambu PLA Matte @BBL P2S", fo, "PLA Matte cuerpos 0.4", "fil04.json")
