import numpy as np, time, trimesh
import build_front as BF, build_temple as BT

t0 = time.time()
K = BF.K_WRAP; ZC = 74.3
def wrap_front(v):
    v = v.copy(); v[:, 2] += ZC - K * v[:, 0] ** 2; return v

fv, ff = BF.decimate(*np.load('front_raw.npz').values() if False else (np.load('front_raw.npz')['v'], np.load('front_raw.npz')['f']), 100000)
lv, lf = BF.decimate(np.load('lens_raw.npz')['v'], np.load('lens_raw.npz')['f'], 18000)
fv = wrap_front(fv); lv = wrap_front(lv)
print("front/lens", len(ff), len(lf), time.time() - t0)

tv, tf = BT.build_temple(); print("temple raw", len(tf), time.time() - t0)
tv, tf = BF.decimate(tv, tf, 34000)
pv, pf = BT.build_plate(); print("plate raw", len(pf), time.time() - t0)
pv, pf = BF.decimate(pv, pf, 36000)
np.savez('parts.npz', fv=fv, ff=ff, lv=lv, lf=lf, tv=tv, tf=tf, pv=pv, pf=pf)
print("done", time.time() - t0)
