"""Build the one-piece DSKY keys 3MF with layered legends and an outside-in first layer.

Usage: python build_layered_keys.py "Keys (0.2 Nozzle + AMS).3mf" out.3mf filament_keys.json
Input: the production keys 3MF (legend parts painted filament 2, bodies and letter counters painted filament 1).
Output: 4-filament project, 0.14 mm layers, face down.
  1 = black body (AMS A4), 2 = cream/white PLA (A3), 3 = transparent PLA (A2), 4 = black again (A4) for the
  first layer of the letter counters, so layer 1 prints black outline -> legend -> counters.
Legends span printed z 0..0.8 and are cut at 0.42 and 0.70: layers 1-3 white, 4-5 transparent, 6 white.
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

new_objs = []   # (mesh, transform_str, name, extruder)
for (oid, tr), o in zip(comps, objs):
    assert oid == o.get('id')
    m, paint = mesh_of(o)
    t = list(map(float, tr.split()))
    sz = t[8]; dz = t[11]
    assert t[0] == 1 and sz == 1, tr
    if paint == {'8'}:  # legend
        zp = BUILD_Z - (m.vertices[:, 2] + dz)
        assert zp.min() > -1e-3 and zp.max() < 0.81, (zp.min(), zp.max())
        for lo, hi, ext in CUTS:
            # object z for printed-z plane p: z_obj = BUILD_Z - dz - p
            mf = manifold3d.Manifold(manifold3d.Mesh(vert_properties=np.asarray(m.vertices, np.float32), tri_verts=np.asarray(m.faces, np.uint32)))
            assert mf.status() == manifold3d.Error.NoError, mf.status()
            zlo, zhi = BUILD_Z - dz - hi, BUILD_Z - dz - lo   # object-z window
            b = m.bounds
            box = manifold3d.Manifold.cube([b[1][0] - b[0][0] + 2, b[1][1] - b[0][1] + 2, zhi - zlo]).translate([b[0][0] - 1, b[0][1] - 1, zlo])
            r = (mf ^ box).to_mesh()
            part = trimesh.Trimesh(np.asarray(r.vert_properties)[:, :3], np.asarray(r.tri_verts), process=False)
            if len(part.faces) == 0:
                continue
            assert part.is_watertight, ('not watertight', oid, lo)
            new_objs.append((part, tr, f'Leyenda {oid} {lo:.2f}-{min(hi,0.8):.2f}', ext))
    else:
        assert paint == {'4'}, paint
        zp = BUILD_Z - (m.vertices[:, 2] + dz)
        if zp.max() < 0.6:  # counter (hole inside a letter): layer 1 -> filament 4 (2nd black)
            mf = manifold3d.Manifold(manifold3d.Mesh(vert_properties=np.asarray(m.vertices, np.float32), tri_verts=np.asarray(m.faces, np.uint32)))
            assert mf.status() == manifold3d.Error.NoError, mf.status()
            b = m.bounds
            for lo, hi, ext in [(0.0, 0.14, 4), (0.14, 10.0, 1)]:
                zlo, zhi = BUILD_Z - dz - hi, BUILD_Z - dz - lo
                box = manifold3d.Manifold.cube([b[1][0] - b[0][0] + 2, b[1][1] - b[0][1] + 2, zhi - zlo]).translate([b[0][0] - 1, b[0][1] - 1, zlo])
                r = (mf ^ box).to_mesh()
                part = trimesh.Trimesh(np.asarray(r.vert_properties)[:, :3], np.asarray(r.tri_verts), process=False)
                if len(part.faces) == 0: continue
                assert part.is_watertight, ('core not watertight', oid, lo)
                new_objs.append((part, tr, f'Hueco {oid} {lo:.2f}', ext))
        else:
            new_objs.append((m, tr, f'Tecla {oid}', 1))
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
files['Metadata/project_settings.config'] = json.dumps(d, indent=4).encode()
files['Metadata/filament_settings_3.config'] = files['Metadata/filament_settings_2.config']
files['Metadata/filament_settings_4.config'] = files['Metadata/filament_settings_1.config']
print('extended keys', len(changed))

ct = files['[Content_Types].xml']
out = zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED)
for n, data in files.items():
    out.writestr(n, data)
out.close()
print('written', DST)
