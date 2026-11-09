"""2D-контуры очков в пикселях эталонного фото (вид спереди), затем перевод в мм."""
import numpy as np
from PIL import Image, ImageDraw

PX_MM = 0.1908          # мм на пиксель эталона
CX, BY = 425.0, 372.0   # центр по X и низ оправы в пикселях эталона

def catmull(pts, n=24, closed=True):
    p = np.asarray(pts, float)
    m = len(p)
    out = []
    for i in range(m if closed else m - 1):
        p0, p1, p2, p3 = p[(i - 1) % m], p[i % m], p[(i + 1) % m], p[(i + 2) % m]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)

def mirror(pts):
    return [(2 * CX - x, y) for x, y in pts]

OUTER_L = [(425,92),(330,92),(240,93),(160,98),(110,108),(78,124),(54,150),(44,185),(50,235),(65,285),(85,325),(115,352),(160,367),(220,372),(290,371),(335,364),(367,348),(388,320),(403,276),(408,250),(416,230)]
# центр снизу (носовая дуга) добавляем отдельно
OUTER_C_BOTTOM = [(425,218)]
LENS_L = [(375,128),(373,200),(370,262),(362,305),(340,335),(300,348),(240,352),(170,350),(125,335),(100,305),(90,260),(88,200),(95,160),(115,135),(160,122),(250,117),(330,119)]
KEY = [(387,126),(425,121),(463,126),(458,150),(450,174),(425,178),(400,174),(392,150)]

def outer_poly():
    left = OUTER_L
    right = mirror(OUTER_L)[::-1]
    pts = left + OUTER_C_BOTTOM + right[:]   # right уже снизу вверх
    return catmull(pts, 16)

def lens_polys():
    l = catmull(LENS_L, 14)
    r = catmull(mirror(LENS_L)[::-1], 14)
    return l, r

def key_poly():
    return catmull(KEY, 14)

def to_mm(poly):
    p = np.asarray(poly, float)
    return np.stack([(p[:, 0] - CX) * PX_MM, (BY - p[:, 1]) * PX_MM], 1)

def mask(polys_add, polys_sub, x0, x1, y0, y1, res):
    """Бинарная маска в мм: область [x0,x1]x[y0,y1], res мм/пиксель."""
    W, H = int(round((x1 - x0) / res)), int(round((y1 - y0) / res))
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    tr = lambda p: [((x - x0) / res, (y1 - y) / res) for x, y in to_mm(p)]
    for p in polys_add: d.polygon(tr(p), fill=255)
    for p in polys_sub: d.polygon(tr(p), fill=0)
    return np.array(im) > 127

if __name__ == "__main__":
    ref = Image.open("/mnt/user-data/uploads/Снимок_экрана_2026-11-06_151312.png").convert("RGB")
    d = ImageDraw.Draw(ref)
    for p, c in [(outer_poly(), (255,0,0)), (lens_polys()[0], (0,200,255)), (lens_polys()[1], (0,200,255)), (key_poly(), (255,200,0))]:
        d.line([tuple(q) for q in p] + [tuple(p[0])], fill=c, width=2)
    ref.save("/home/claude/gen/overlay.png")
    print(ref.size)
