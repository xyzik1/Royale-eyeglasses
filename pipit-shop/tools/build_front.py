import numpy as np, trimesh, time
from scipy import ndimage as ndi
from skimage import measure
import shapes as S

def sd_hi(m, res):
    din = ndi.distance_transform_edt(m) * res
    dout = ndi.distance_transform_edt(~m) * res
    return dout - din   # внутри < 0

def sample(sd, x0, y1, res, X, Y):
    # X,Y в мм -> индексы hi-res маски
    cols = (X - x0) / res
    rows = (y1 - Y) / res
    return ndi.map_coordinates(sd, [rows, cols], order=1, mode="nearest")

def rounded_ext(sd2, z, h, r):
    q1 = sd2 + r
    q2 = np.abs(z) - (h - r)
    return np.hypot(np.maximum(q1, 0), np.maximum(q2, 0)) + np.minimum(np.maximum(q1, q2), 0) - r

def mc(vol, g, origin):
    v, f, n, _ = measure.marching_cubes(vol, 0.0, spacing=(g, g, g))
    v = v + np.array(origin)
    return v, f

def decimate(v, f, target):
    m = trimesh.Trimesh(v, f, process=False)
    if len(f) > target:
        m = m.simplify_quadric_decimation(face_count=target)
    return np.asarray(m.vertices), np.asarray(m.faces)

K_WRAP = 12.0 / 72.7**2

def build_front(g=0.18):
    res = 0.05
    X0, X1, Y0, Y1 = -76, 76, -3, 57
    outer = S.outer_poly(); l, r = S.lens_polys(); k = S.key_poly()
    m = S.mask([outer], [l, r, k], X0, X1, Y0, Y1, res)
    sd = sd_hi(m, res)
    xs = np.arange(X0 + 1, X1 - 1, g); ys = np.arange(Y0 + 1, Y1 - 1, g); zs = np.arange(-7.0, 7.0 + g, g)
    X, Y = np.meshgrid(xs, ys, indexing="ij")
    sd2 = sample(sd, X0, Y1, res, X, Y)
    h = 3.3 + 2.4 * np.clip(np.abs(X) / 70.0, 0, 1) ** 1.6      # полутолщина: у висков толще
    vol = np.empty((len(xs), len(ys), len(zs)), np.float32)
    for k_, z in enumerate(zs):
        vol[:, :, k_] = rounded_ext(sd2, z, h, 1.9)
    v, f = mc(vol, g, (xs[0], ys[0], zs[0]))
    return v, f

def build_lenses(g=0.14):
    res = 0.05
    X0, X1, Y0, Y1 = -76, 76, -3, 57
    l, r = S.lens_polys()
    m = S.mask([l, r], [], X0, X1, Y0, Y1, res)
    sd = sd_hi(m, res) - 1.1                       # линза чуть больше проёма: край прячется в оправе
    xs = np.arange(X0 + 1, X1 - 1, g); ys = np.arange(Y0 + 1, Y1 - 1, g); zs = np.arange(-1.6, 1.6 + g, g)
    X, Y = np.meshgrid(xs, ys, indexing="ij")
    sd2 = sample(sd, X0, Y1, res, X, Y)
    vol = np.empty((len(xs), len(ys), len(zs)), np.float32)
    for k_, z in enumerate(zs):
        vol[:, :, k_] = rounded_ext(sd2, z, 1.0, 0.8)
    v, f = mc(vol, g, (xs[0], ys[0], zs[0]))
    return v, f

if __name__ == "__main__":
    t = time.time()
    v, f = build_front(); print("front", len(v), len(f), time.time() - t)
    np.savez("front_raw.npz", v=v, f=f)
    v, f = build_lenses(); print("lens", len(v), len(f), time.time() - t)
    np.savez("lens_raw.npz", v=v, f=f)
