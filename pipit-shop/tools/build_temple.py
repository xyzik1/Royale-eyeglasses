import numpy as np, time
from scipy import ndimage as ndi
from skimage import measure
from PIL import Image, ImageDraw, ImageFont
from build_front import mc, rounded_ext, sd_hi

Z0 = 61.0   # где дужка начинается (мм по Z), чуть внутри торца оправы
def sstep(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def xc(s): return 69.8 - 3.0 * (s / 142.0)
def a_(s): return 2.6 - 0.65 * sstep(s / 142.0)
def yc(s): return 31.0 - 22.0 * sstep((s - 78.0) / 62.0)
def b_(s): return np.interp(s, [0, 30, 80, 142], [6.8, 6.8, 5.4, 4.3])

def build_temple(g=0.17):
    xs = np.arange(58, 77, g); ys = np.arange(2, 42, g); zs = np.arange(-82.5, 63, g)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij", sparse=True)
    s = Z0 - Z
    rc = 1.5
    qx = np.abs(X - xc(s)) - (a_(s) - rc)
    qy = np.abs(Y - yc(s)) - (b_(s) - rc)
    dxy = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - rc
    r2 = 1.3
    q1 = dxy + r2
    q2 = np.abs(s - 71.0) - (71.0 - r2)
    vol = (np.hypot(np.maximum(q1, 0), np.maximum(q2, 0)) + np.minimum(np.maximum(q1, q2), 0) - r2).astype(np.float32)
    v, f = mc(vol, g, (xs[0], ys[0], zs[0]))
    return v, f

def smooth_poly(pts, r, res, S0, S1, D0, D1):
    W, H = int(round((S1 - S0) / res)), int(round((D1 - D0) / res))
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).polygon([((x - S0) / res, (D1 - y) / res) for x, y in pts], fill=255)
    m = np.array(im) > 127
    sd = sd_hi(m, res)
    m2 = sd < -r
    return sd_hi(m2, res) - r

def build_plate(g=0.06):
    S0, S1, D0, D1 = 0.0, 126.0, -6.5, 6.5
    hr = 0.03
    plate = [(2.0, 4.9), (29, 5.0), (44, 3.6), (57, -0.2), (47, -3.5), (34, -4.7), (2.0, -4.7)]
    sdp = smooth_poly(plate, 0.9, hr, S0, S1, D0, D1)
    line = [(52, -1.6), (100, -3.3), (124, -3.3), (124, -2.5), (100, -2.5), (52, -0.9)]
    sdl = smooth_poly(line, 0.3, hr, S0, S1, D0, D1)
    # текст PIPIT на табличке
    W, H = sdp.shape
    tm = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(tm)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(3.0 / hr))
    x = (6.0 - S0) / hr
    base_row = (D1 + 0.9) / hr          # базовая линия текста: dy = -0.9
    for ch in "PIPIT":
        d.text((x, base_row), ch, fill=255, font=font, anchor="ls")
        x += d.textlength(ch, font=font) + 0.9 / hr
    text = np.array(tm) > 127

    ss = np.arange(S0 + 0.1, S1 - 0.1, g); dd = np.arange(D0 + 0.1, D1 - 0.1, g); xl = np.arange(-0.8, 0.8, g)
    Sg, Dg = np.meshgrid(ss, dd, indexing="ij")
    def samp(arr):
        return ndi.map_coordinates(arr.astype(np.float32), [(D1 - Dg) / hr, (Sg - S0) / hr], order=1, mode="nearest")
    sp, sl, tx = samp(sdp), samp(sdl), samp(text)
    tg = sstep((Sg - 26.0) / 2.0)
    groove = 0.5 + 0.5 * np.cos(2 * np.pi * Dg / 1.15)
    hf = 0.32 + tg * (-0.12 + 0.14 * groove) + (1 - tg) * (0.0 + 0.12 * tx)
    hf_p = np.minimum(hf, 1.3 * (-sp))                 # скос по краю
    hf_l = np.minimum(np.full_like(hf, 0.26), 1.3 * (-sl))
    vol = np.empty((len(ss), len(dd), len(xl)), np.float32)
    for k, x_ in enumerate(xl):
        dp = np.maximum(x_ - hf_p, -(x_ + 0.6))
        dl = np.maximum(x_ - hf_l, -(x_ + 0.6))
        vol[:, :, k] = np.minimum(dp, dl)
    v, f = mc(vol, g, (ss[0], dd[0], xl[0]))
    # (s, dy, xl) -> мир
    s_ = v[:, 0]
    W_ = np.stack([xc(s_) + a_(s_) + v[:, 2] - 0.15, yc(s_) + v[:, 1], Z0 - s_], 1)
    return W_, f
