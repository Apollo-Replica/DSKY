"""Build the face caps of the two-piece key (legend part), all 19 keys on one plate.

Usage: python build_faces.py "Keys (0.2 Nozzle + AMS).3mf" out.3mf filament_keys.json
Same colour recipe as build_layered_keys.py (white x3 / transparent x2 / white x1, outside-in first layer),
but each body is replaced by the 2.1 mm cap with its 2 mm plug (geometry in faces_geom.py).
See Documentation/printing-keycaps.md.
"""
import json, re, sys, zipfile, io
import numpy as np
import trimesh, manifold3d
import xml.etree.ElementTree as ET

SRC, DST, FKEYS = sys.argv[1], sys.argv[2], sys.argv[3]
NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
ns = {'m': NS}
CUTS = [(0.0, 0.42, 2), (0.42, 0.70, 3), (0.70, 10.0, 2)]  # printed-z ranges -> filament
BUILD_Z = 7.20999908  # build transform: z_print = -z_obj_world + BUILD_Z (flip)

zin = zipfile.ZipFile(SRC)
files = {n: zin.read(n) for n in zin.namelist()}

# ---------- geometry ----------
obj_xml = files['3D/Objects/object_1.model'].decode()
root = ET.fromstring(obj_xml)
res = root.find('m:resources', ns)
objs = res.findall('m:object', ns)
main = files['3D/3dmodel.model'].decode()
comps = re.findall(r'<component [^>]*objectid="(\d+)"[^>]*transform="([^"]+)"[^>]*/>', main)
assert len(comps) == len(objs) == 55

def mesh_of(o):
    V = np.array([[float(v.get(a)) for a in 'xyz'] for v in o.find('m:mesh/m:vertices', ns)])
    F = np.array([[int(t.get(a)) for a in ('v1', 'v2', 'v3')] for t in o.find('m:mesh/m:triangles', ns)])
    paint = {t.get('paint_color') for t in o.find('m:mesh/m:triangles', ns)}
    return trimesh.Trimesh(V, F, process=False), paint

import os; exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'faces_geom.py')).read())
print('parts', len(new_objs))

# write object_1.model
def mesh_xml(i, m):
    vs = ''.join(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>' for x, y, z in m.vertices)
    ts = ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
    return f'<object id="{i}" type="model"><mesh><vertices>{vs}</vertices><triangles>{ts}</triangles></mesh></object>'
head = obj_xml[:obj_xml.index('<resources>') + len('<resources>')]
tail = obj_xml[obj_xml.index('</resources>'):]
files['3D/Objects/object_1.model'] = (head + ''.join(mesh_xml(i + 1, m) for i, (m, *_r) in enumerate(new_objs)) + tail).encode()

# components in 3dmodel.model
comp_tpl = re.search(r'<component [^>]*/>', main).group(0)
new_comps = []
for i, (_m, tr, _n, _e) in enumerate(new_objs):
    c = re.sub(r'objectid="\d+"', f'objectid="{i+1}"', comp_tpl)
    c = re.sub(r'p:UUID="[^"]+"', f'p:UUID="{0x00010000 + i:08x}-b206-40ff-9872-83e8017abed1"', c)
    c = re.sub(r'transform="[^"]+"', f'transform="{tr}"', c)
    new_comps.append(c)
a = main.index('<components>') + len('<components>'); b = main.index('</components>')
main = main[:a] + '\n    ' + '\n    '.join(new_comps) + '\n   ' + main[b:]
main = re.sub(r'<object id="56"', '<object id="%d"' % (len(new_objs) + 1), main)
main = re.sub(r'(<item objectid=")56(")', r'\g<1>%d\2' % (len(new_objs) + 1), main)
files['3D/3dmodel.model'] = main.encode()

# model_settings.config
ms = files['Metadata/model_settings.config'].decode()
part_tpl = re.search(r'<part id="1".*?</part>', ms, re.S).group(0)
parts = []
for i, (m, tr, name, ext) in enumerate(new_objs):
    p = re.sub(r'<part id="1"', f'<part id="{i+1}"', part_tpl)
    p = re.sub(r'(key="name" value=")[^"]*', r'\g<1>' + name, p)
    t = list(map(float, tr.split()))
    mat = f'1 0 0 {t[9]} 0 1 0 {t[10]} 0 0 1 {t[11]} 0 0 0 1'
    p = re.sub(r'(key="matrix" value=")[^"]*', r'\g<1>' + mat, p)
    p = re.sub(r'(key="extruder" value=")\d+', r'\g<1>' + str(ext), p)
    p = re.sub(r'\s*<metadata key="source_[^/]*/>', '', p)
    p = re.sub(r'<mesh_stat [^/]*/>', f'<mesh_stat face_count="{len(m.faces)}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>', p)
    parts.append(p)
a = ms.index('<part id="1"'); b = ms.rindex('</part>') + len('</part>')
ms = ms[:a] + '\n    '.join(parts) + ms[b:]
ms = ms.replace('<object id="56">', '<object id="%d">' % (len(new_objs) + 1))
ms = re.sub(r'(<metadata key="object_id" value=")56', r'\g<1>%d' % (len(new_objs) + 1), ms)
ms = ms.replace('<assemble_item object_id="56"', '<assemble_item object_id="%d"' % (len(new_objs) + 1))
ms = re.sub(r'<metadata face_count="\d+"/>', f'<metadata face_count="{sum(len(m.faces) for m, *_ in new_objs)}"/>', ms)
ms = ms.replace('key="filament_maps" value="1 1"', 'key="filament_maps" value="1 1 1 1"')
# plate-level first-layer order: the GUI uses this when re-slicing (the global first_layer_print_sequence is only honoured by the CLI)
ms = ms.replace('<metadata key="filament_maps"', '<metadata key="first_layer_sequence_choice" value="customize"/>\n    <metadata key="first_layer_print_sequence" value="1 2 4 3"/>\n    <metadata key="filament_maps"', 1)
ms = ms.replace('key="filament_volume_maps" value="0 0"', 'key="filament_volume_maps" value="0 0 0 0"')
files['Metadata/model_settings.config'] = ms.encode()
# drop stale thumbnails / cut info referencing old ids
for n in ['Metadata/cut_information.xml']:
    files.pop(n, None)

# ---------- settings: add filament 3 as a copy of filament 2 ----------
d = json.loads(files['Metadata/project_settings.config'])
fkeys = set(json.load(open(FKEYS)))
nvar = len(d['filament_extruder_variant']) // 2   # variants per filament
changed = []
for k, v in list(d.items()):
    if not isinstance(v, list) or not v:
        continue
    if k in ('flush_volumes_matrix', 'flush_volumes_vector', 'different_settings_to_system', 'inherits_group'):
        continue
    if k in fkeys or k.startswith('filament_') or k in ('default_filament_colour',):
        if len(v) == 2:
            d[k] = v + [v[1]]
        elif len(v) == 2 * nvar:
            d[k] = v + v[nvar:2 * nvar]
        elif len(v) == 8 and nvar == 2:  # 4 per filament
            d[k] = v + v[4:8]
        elif len(v) == 1:
            continue
        else:
            raise SystemExit(f'unexpected length {k} {len(v)}')
        changed.append(k)
d['filament_self_index'] = d['filament_self_index'][:2 * nvar] + ['3'] * nvar if len(d['filament_self_index']) == 3 * nvar else d['filament_self_index']
d['filament_colour'] = ['#000000', '#FCECD6', '#FFF144']
d['filament_multi_colour'] = ['#000000', '#FCECD6', '#FFF144']
d['filament_map'] = ['1', '1', '1']
# flush matrix 3x3 (black->light needs a lot; light<->light little)
m = d['flush_volumes_matrix']; assert len(m) == 4
# from\to   black  cream  transp
d['flush_volumes_matrix'] = ['0', '670', '670',
                             '190', '0', '250',
                             '190', '250', '0']
d['flush_volumes_vector'] = d['flush_volumes_vector'] + d['flush_volumes_vector'][2:4]
for k in ('different_settings_to_system', 'inherits_group'):
    v = d[k]; assert len(v) == 4
    d[k] = v[:3] + [v[2]] + v[3:]
# ---- filament 4 = copy of filament 1 (black, same AMS tray), used for letter counters on layer 1
nf = 3
for k, v in list(d.items()):
    if not isinstance(v, list) or not v or k in ('flush_volumes_matrix', 'flush_volumes_vector', 'different_settings_to_system', 'inherits_group', 'filament_self_index'):
        continue
    if k in fkeys or k.startswith('filament_') or k in ('default_filament_colour',):
        if len(v) == nf: d[k] = v + [v[0]]
        elif len(v) % nf == 0 and len(v) > nf:
            per = len(v) // nf; d[k] = v + v[0:per]
        elif len(v) == 1: continue
        else: raise SystemExit(f'unexpected4 {k} {len(v)}')
fsi = d['filament_self_index']; d['filament_self_index'] = fsi + ['4'] * (len(fsi) // nf)
d['filament_colour'] = ['#000000', '#FCECD6', '#FFF144', '#000000']
d['filament_multi_colour'] = list(d['filament_colour'])
d['filament_map'] = ['1'] * 4
#            to: black  cream transp black2
d['flush_volumes_matrix'] = ['0', '670', '670', '0',
                             '190', '0', '250', '190',
                             '190', '250', '0', '190',
                             '0', '670', '670', '0']
d['flush_volumes_vector'] = d['flush_volumes_vector'] + d['flush_volumes_vector'][0:2]
for k in ('different_settings_to_system', 'inherits_group'):
    v = d[k]; assert len(v) == 5, (k, v)
    d[k] = v[:4] + [v[1]] + v[4:]
d['first_layer_print_sequence'] = ['1', '2', '4', '3']
d['supertack_plate_temp'] = ['65'] * 4; d['supertack_plate_temp_initial_layer'] = ['65'] * 4
fr = d['filament_flow_ratio']; fr[2] = fr[3] = '1.08'
d['wall_sequence'] = 'inner wall/outer wall'
d['different_settings_to_system'][2] = 'filament_flow_ratio;supertack_plate_temp;supertack_plate_temp_initial_layer'
files['Metadata/project_settings.config'] = json.dumps(d, indent=4).encode()
files['Metadata/filament_settings_3.config'] = files['Metadata/filament_settings_2.config']
files['Metadata/filament_settings_4.config'] = files['Metadata/filament_settings_1.config']
for i in range(1, 5):
    n = f'Metadata/filament_settings_{i}.config'; fs = json.loads(files[n])
    fs['supertack_plate_temp'] = ['65']; fs['supertack_plate_temp_initial_layer'] = ['65']
    if i == 2: fs['filament_flow_ratio'] = ['1.08']
    files[n] = json.dumps(fs, indent=4).encode()
print('extended keys', len(changed))

ct = files['[Content_Types].xml']
out = zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED)
for n, data in files.items():
    out.writestr(n, data)
out.close()
print('written', DST)
