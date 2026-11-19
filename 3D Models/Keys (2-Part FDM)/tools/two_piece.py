"""Split one key into face cap + body (two-piece keycap) and export STLs.

Usage: python two_piece.py [T]   (T = seam height from the face, default 2.1 mm)
Inputs in the working directory: body42.stl and leg42.stl (key "1" body and legend, face at z=0).
Outputs: face.stl, sleeve.stl (body), legend_c.stl, plus preview/section STLs.
The body carries the MX stem with the cross modified to print on its side (45 deg roof, from keybody1.3mf).
"""
import sys, numpy as np, trimesh, manifold3d as mf
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize, unary_union
from shapely.geometry.polygon import orient
T   = float(sys.argv[1]) if len(sys.argv)>1 else 2.1   # face piece height (seam position from face)
CH  = 0.25     # chamfer on the body edge at the seam
INS = 0.15     # face cap inset per side: only the body touches the frame when the key travels
CL  = 0.10     # plug clearance per side
PW  = 1.0      # plug wall
PH  = 2.0      # plug height
b=trimesh.load('body42.stl'); l=trimesh.load('leg42.stl')
c=b.bounds.mean(0); c[2]=0
b.apply_translation(-c); l.apply_translation(-c)
H=b.bounds[1][2]
def to_mf(m): return mf.Manifold(mf.Mesh(vert_properties=np.asarray(m.vertices,np.float32), tri_verts=np.asarray(m.faces,np.uint32)))
def to_tm(M):
    r=M.to_mesh(); return trimesh.Trimesh(np.asarray(r.vert_properties)[:,:3], np.asarray(r.tri_verts), process=False)
def loops(z):
    s=b.section([0,0,z],[0,0,1]); polys=[orient(Polygon(d[:,:2])) for d in s.discrete]
    return sorted(polys,key=lambda p:p.area)
inner, outer = loops(13.0)[0], loops(7.0)[-1]
print('outer',[round(v,2) for v in outer.bounds],'inner',[round(v,2) for v in inner.bounds])
def xs(poly): return mf.CrossSection([np.ascontiguousarray(np.asarray(orient(poly).exterior.coords)[:-1,:2],dtype=np.float64)])
def prism(poly,z0,z1): return mf.Manifold.extrude(xs(poly), z1-z0).translate([0,0,z0])
def box(z0,z1,s=40): return mf.Manifold.cube([s,s,z1-z0]).translate([-s/2,-s/2,z0])
M=to_mf(b)
s=(outer.bounds[2]-outer.bounds[0]-2*CH)/(outer.bounds[2]-outer.bounds[0])
outer_s=xs(outer)
loft_down=mf.Manifold.extrude(outer_s,CH,scale_top=[s,s]).translate([0,0,T-CH])          # O at T-CH -> sO at T
loft_up  =mf.Manifold.extrude(outer_s.scale([s,s]),CH,scale_top=[1/s,1/s]).translate([0,0,T])  # sO at T -> O at T+CH
SC=(outer.bounds[2]-outer.bounds[0]-2*INS)/(outer.bounds[2]-outer.bounds[0])
face = ((M ^ box(-1,T)) - prism(inner.buffer(-0.01),0.85,T+1)).scale([SC,SC,1])   # drop strut stubs: cavity goes straight to the legend
ring = prism(inner.buffer(-CL),T-0.01,T+PH) - prism(inner.buffer(-CL-PW),T-0.02,T+PH+1)
ring = ring - mf.Manifold.extrude(xs(inner.buffer(-CL)),0.4).translate([0,0,T+PH-0.4]) + prism(inner.buffer(-CL-0.25),T+PH-0.4,T+PH) - prism(inner.buffer(-CL-PW),T+PH-0.5,T+PH+1)  # small lead-in at plug tip
sleeve = (M ^ box(T,H+1)) - (box(T,T+CH) - loft_up)
# MX cross for printing on its side (+Y up), as in keybody1.3mf: 45 deg roof over the horizontal arm, no bridge
ROOF=Polygon([(-2.06,0.5),(2.06,0.5),(2.06,0.78),(0.70,2.14),(-0.70,2.14),(-2.06,0.78)])
sleeve = sleeve - prism(ROOF,7.40,H+1)
inner_parts = sleeve ^ prism(inner.buffer(-0.01),T,H+1)
print('ring/inner overlap vol %.2f' % (ring ^ inner_parts).volume())
for d in ([0,0,0],[.25,0,0],[-.25,0,0],[0,.25,0],[0,-.25,0],[0,0,-.25]):
    ring = ring - inner_parts.translate(d)
base = prism(inner.buffer(0.02),0.8,T) - prism(inner.buffer(-CL-PW),0.7,T+1)   # plug root fused to the face wall
face = face + base + ring
print('sleeve bodies',len(sleeve.decompose()),'face bodies',len(face.decompose()))
for n,m in (('face',face),('sleeve',sleeve)):
    t=to_tm(m); print(n,'vol %.0f'%t.volume,'wt',t.is_watertight,'z %.2f..%.2f'%(t.bounds[0][2],t.bounds[1][2])); t.export(f'{n}.stl')
l.apply_scale([SC,SC,1]); l.export('legend_c.stl')
# exploded copies
to_tm(sleeve.translate([0,0,12])).export('sleeve_up.stl')
# section (half) for assembled view
half=box(-1,30,60).translate([0,30,0])
to_tm(face ^ half).export('face_half.stl'); to_tm(sleeve ^ half).export('sleeve_half.stl'); to_tm(to_mf(l) ^ half).export('legend_half.stl')
# print orientation: sleeve on its side
sv=to_tm(sleeve); sv.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/2,[1,0,0])); sv.apply_translation([0,0,-sv.bounds[0][2]]); sv.export('sleeve_print.stl')
