import numpy as np
def mirrored(v, f):
    v2 = v.copy(); v2[:, 0] *= -1
    return v2, f[:, ::-1].copy()
def load():
    d = np.load('parts.npz')
    tv, tf = d['tv'], d['tf']; pv, pf = d['pv'], d['pf']
    tl = mirrored(tv, tf); pl = mirrored(pv, pf)
    frame = [(d['fv'], d['ff']), (tv, tf), tl]
    lens = [(d['lv'], d['lf'])]
    metal = [(pv, pf), pl]
    return frame, lens, metal
def merge(lst):
    vs, fs, o = [], [], 0
    for v, f in lst:
        vs.append(v); fs.append(f + o); o += len(v)
    return np.concatenate(vs), np.concatenate(fs)
