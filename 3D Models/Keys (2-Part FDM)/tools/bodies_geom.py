# Inserted into build_bodies.py: 5 key bodies of the two-piece key, lying on their side (-Y wall on the bed).
N_BODIES = 5
IDT = '1 0 0 0 1 0 0 0 1 0 0 0'
def P(V): return np.c_[V[:, 0], -V[:, 1], BUILD_Z - V[:, 2]]
body = trimesh.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Body - print on its side.stl'))
# place around the centre of the original key layout (printed frame)
allv = []
for (oid, tr), o in zip(comps, objs):
    m, _ = mesh_of(o); t = list(map(float, tr.split()))
    allv.append(P(m.vertices + np.array(t[9:12])))
allv = np.vstack(allv); cx, cy = (allv.min(0) + allv.max(0))[:2] / 2
sx, sy = body.extents[0], body.extents[1]
gap = 6.0
new_objs = []
for i in range(N_BODIES):
    v = body.vertices.copy()
    v[:, 0] += cx - (N_BODIES * sx + (N_BODIES - 1) * gap) / 2 + i * (sx + gap)
    v[:, 1] += cy - sy / 2
    m = trimesh.Trimesh(P(v), body.faces, process=False)
    new_objs.append((m, IDT, f'Cuerpo {i+1}', 1))
# support blockers inside each MX cross hole (supports there could not be removed)
_blk = []
for i in range(N_BODIES):
    v = body.vertices.copy()
    ox = cx - (N_BODIES * sx + (N_BODIES - 1) * gap) / 2 + i * (sx + gap); oy = cy - sy / 2
    bcx = ox + sx / 2; zc = body.extents[2] / 2; y0 = oy
    box = trimesh.creation.box(extents=[4.4, 7.8, 4.6]); box.apply_translation([bcx, y0 + 7.8 / 2 - 0.4, zc])
    _blk.append((trimesh.Trimesh(P(box.vertices), box.faces, process=False), IDT, f'Bloqueo soporte cruz {i+1}', 1))
new_objs += _blk
