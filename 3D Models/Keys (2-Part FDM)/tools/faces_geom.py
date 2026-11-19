# Inserted into build_faces.py: builds new_objs with the face caps of the two-piece key.
import manifold3d as mf
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
T, INS, CL, PW, PH = 2.1, 0.15, 0.10, 1.0, 2.0
IDT = '1 0 0 0 1 0 0 0 1 0 0 0'
def P(V):  # object-world <-> printed frame (rotation 180 deg about X, z' = BUILD_Z - z); self-inverse
    return np.c_[V[:, 0], -V[:, 1], BUILD_Z - V[:, 2]]
def to_mf(m): 
    M = mf.Manifold(mf.Mesh(vert_properties=np.asarray(m.vertices, np.float32), tri_verts=np.asarray(m.faces, np.uint32)))
    assert M.status() == mf.Error.NoError, M.status(); return M
def to_tm(M):
    r = M.to_mesh(); return trimesh.Trimesh(np.asarray(r.vert_properties)[:, :3], np.asarray(r.tri_verts), process=False)
def xs(poly): return mf.CrossSection([np.ascontiguousarray(np.asarray(orient(poly).exterior.coords)[:-1, :2], dtype=np.float64)])
def prism(poly, z0, z1): return mf.Manifold.extrude(xs(poly), z1 - z0).translate([0, 0, z0])
def box(z0, z1, cx, cy, s=40): return mf.Manifold.cube([s, s, z1 - z0]).translate([cx - s / 2, cy - s / 2, z0])
def loops(m, z):
    L = trimesh.intersections.mesh_plane(m, [0, 0, 1], [0, 0, z])
    from shapely.ops import polygonize, unary_union
    from shapely.geometry import LineString
    return sorted(polygonize(unary_union([LineString(l[:, :2]) for l in L])), key=lambda p: p.area)
bodies, small = [], []
for (oid, tr), o in zip(comps, objs):
    m, paint = mesh_of(o)
    t = list(map(float, tr.split())); assert t[0] == 1 and t[8] == 1
    mw = trimesh.Trimesh(P(m.vertices + np.array(t[9:12])), m.faces, process=False); mw.merge_vertices()  # printed frame, proper rotation keeps winding
    if paint == {'4'} and mw.bounds[1][2] > 5: bodies.append((oid, mw))
    else: small.append((oid, mw, paint))
assert len(bodies) == 19
centers = []
new_objs = []
tpl = dict(bodies)['42']; tc = tpl.bounds.mean(0)
TM = to_mf(tpl)
cs = TM.slice(6.0).to_polygons()
lp = [orient(Polygon(np.asarray(p))) for p in cs]
outer0 = max(lp, key=lambda p: p.area); inner0 = min(lp, key=lambda p: p.area)
assert len(lp) == 2 and abs((outer0.bounds[2]-outer0.bounds[0]) - 22.44) < 0.05
# legend + cores of the template key fill its letters -> plain solid cap
tsmall = [to_mf(mw) for oid, mw, paint in small if np.hypot(*(mw.bounds.mean(0)[:2] - tc[:2])) < 11]
cap0 = TM ^ box(-1, T, tc[0], tc[1])
for q in tsmall: cap0 = cap0 + q
H = tpl.bounds[1][2]
struts0 = (TM ^ box(T, H + 1, tc[0], tc[1])) ^ prism(inner0.buffer(-0.01), T, H + 1)
w = outer0.bounds[2] - outer0.bounds[0]; SC = (w - 2 * INS) / w
from shapely import affinity
for oid, mw in bodies:
    c = mw.bounds.mean(0); cx, cy = c[0], c[1]; centers.append((cx, cy))
    dx, dy = cx - tc[0], cy - tc[1]
    inner = affinity.translate(inner0, dx, dy)
    mine = [to_mf(m2) for o2, m2, p2 in small if np.hypot(*(m2.bounds.mean(0)[:2] - c[:2])) < 11]
    face = cap0.translate([dx, dy, 0]) - prism(inner.buffer(-0.01), 0.85, T + 1)
    for q in mine: face = face - q
    face = face.translate([-cx, -cy, 0]).scale([SC, SC, 1]).translate([cx, cy, 0])
    ring = prism(inner.buffer(-CL), T - 0.01, T + PH) - prism(inner.buffer(-CL - PW), T - 0.02, T + PH + 1)
    ring = ring - mf.Manifold.extrude(xs(inner.buffer(-CL)), 0.4).translate([0, 0, T + PH - 0.4]) + prism(inner.buffer(-CL - 0.25), T + PH - 0.4, T + PH) - prism(inner.buffer(-CL - PW), T + PH - 0.5, T + PH + 1)
    ip = struts0.translate([dx, dy, 0])
    for dd in ([0, 0, 0], [.25, 0, 0], [-.25, 0, 0], [0, .25, 0], [0, -.25, 0], [0, 0, -.25]):
        ring = ring - ip.translate(dd)
    base = prism(inner.buffer(0.02), 0.8, T) - prism(inner.buffer(-CL - PW), 0.7, T + 1)
    face = face + base + ring
    comps_ = sorted([p.volume() for p in face.decompose()], reverse=True)
    assert comps_[0] > 400 and (len(comps_) == 1 or comps_[1] < 3), (oid, comps_[:4])
    if len(comps_) > 1: print('tapa', oid, 'islas negras dentro de letras:', len(comps_) - 1, 'vol max %.2f' % comps_[1])
    pcs = sorted(face.decompose(), key=lambda p: -p.volume())
    face = pcs[0]
    for k, isl in enumerate(p for p in pcs[1:] if p.volume() > 0.05):   # real counter not covered by a core: same treatment as cores
        for lo_, hi_, ext in [(0.0, 0.14, 4), (0.14, 10.0, 1)]:
            part = to_tm(isl ^ box(lo_, hi_, cx, cy))
            if len(part.faces): part.vertices = P(part.vertices); new_objs.append((part, IDT, f'Isla {oid}.{k} {lo_:.2f}', ext))
    ft = to_tm(face); ft.vertices = P(ft.vertices)
    new_objs.append((ft, IDT, f'Tapa {oid}', 1))
def owner(mw):
    c = mw.bounds.mean(0)[:2]
    return min(centers, key=lambda q: (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2)
for oid, mw, paint in small:
    cx, cy = owner(mw)
    v = mw.vertices.copy(); v[:, 0] = cx + (v[:, 0] - cx) * SC; v[:, 1] = cy + (v[:, 1] - cy) * SC
    mw = trimesh.Trimesh(v, mw.faces, process=False)
    M = to_mf(mw); b = mw.bounds
    if paint == {'8'}:
        wins = CUTS
    else:
        assert paint == {'4'} and b[1][2] < 0.6
        wins = [(0.0, 0.14, 4), (0.14, 10.0, 1)]
    for lo_, hi_, ext in wins:
        bx = mf.Manifold.cube([b[1][0] - b[0][0] + 2, b[1][1] - b[0][1] + 2, hi_ - lo_]).translate([b[0][0] - 1, b[0][1] - 1, lo_])
        part = to_tm(M ^ bx)
        if len(part.faces) == 0: continue
        assert part.is_watertight
        part.vertices = P(part.vertices)
        new_objs.append((part, IDT, f'{"Leyenda" if paint == {"8"} else "Hueco"} {oid} {lo_:.2f}', ext))
