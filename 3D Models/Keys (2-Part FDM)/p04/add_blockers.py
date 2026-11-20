"""Add an MX-cross support blocker to every body object of a Bambu 3MF made from 'Body - print on its side.stl'."""
import zipfile, re, sys, uuid
import numpy as np, trimesh
src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src); files = {n: z.read(n) for n in z.namelist() if not n.startswith('Metadata/plate_1.gcode')}
main = files['3D/3dmodel.model'].decode(); ms = files['Metadata/model_settings.config'].decode()
box = trimesh.creation.box(extents=[4.4, 7.8, 4.6]); box.apply_translation([0, -6.16 - 0.4 + 7.8 / 2, 0])
def mesh_xml(oid):
    vs = ''.join(f'<vertex x="{a:.5f}" y="{b:.5f}" z="{c:.5f}"/>' for a, b, c in box.vertices)
    ts = ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in box.faces)
    return f'<object id="{oid}" p:UUID="{uuid.uuid4()}" type="model"><mesh><vertices>{vs}</vertices><triangles>{ts}</triangles></mesh></object>'
n = 0
for m in re.finditer(r'<object id="(\d+)"[^>]*type="model">\s*<components>\s*(<component [^>]*/>)\s*</components>', main):
    obj_id, comp = m.group(1), m.group(2)
    path = re.search(r'p:path="/([^"]+)"', comp).group(1); cid = int(re.search(r'objectid="(\d+)"', comp).group(1))
    tr = re.search(r'transform="([^"]+)"', comp).group(1)
    new_id = 1000 + cid
    om = files[path].decode(); om = om.replace('</resources>', mesh_xml(new_id) + '</resources>'); files[path] = om.encode()
    newcomp = comp.replace(f'objectid="{cid}"', f'objectid="{new_id}"')
    newcomp = re.sub(r'p:UUID="[^"]+"', f'p:UUID="{uuid.uuid4()}"', newcomp)
    main = main.replace(comp, comp + '\n    ' + newcomp, 1)
    t = list(map(float, tr.split())); mat = f'1 0 0 {t[9]} 0 1 0 {t[10]} 0 0 1 {t[11]} 0 0 0 1'
    part = (f'<part id="{new_id}" subtype="support_blocker" uuid="{uuid.uuid4()}">\n      <metadata key="name" value="Bloqueo cruz"/>\n'
            f'      <metadata key="matrix" value="{mat}"/>\n      <mesh_stat face_count="12" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n    </part>\n  ')
    ms = re.sub(rf'(<object id="{obj_id}">.*?</part>\s*)(</object>)', lambda mm: mm.group(1) + part + mm.group(2), ms, count=1, flags=re.S)
    n += 1
files['3D/3dmodel.model'] = main.encode(); files['Metadata/model_settings.config'] = ms.encode()
for k in [k for k in files if k.startswith('Metadata/slice_info') or k.endswith('.md5')]: files.pop(k)
out = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for k, b in files.items(): out.writestr(k, b)
out.close(); print('blockers', n, 'support_blocker parts', ms.count('support_blocker'))
