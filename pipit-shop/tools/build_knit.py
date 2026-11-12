"""Вязаная фактура для models/beanie.glb: бесшовные карты нормалей и цвета (V-петли, ворс).
Раньше в модели была карта с прямыми вертикальными полосами, и шапка выглядела как дерево.
Запуск: python3 build_knit.py ../models/beanie.glb   (перезаписывает файл; нужны numpy и pillow)"""
import sys, io, json, struct, numpy as np
from PIL import Image, ImageFilter

SIZE, COLS, ROWS = 512, 5, 4        # одна плитка: 5 петель по ширине, 4 ряда по высоте (UV повторяется 10x5)
rng = np.random.default_rng(11)

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx-ax, by-ay; L2 = dx*dx+dy*dy
    t = np.clip(((px-ax)*dx+(py-ay)*dy)/L2, 0, 1)
    return np.hypot(px-(ax+t*dx), py-(ay+t*dy)), t

def knit_height():
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    cw, ch = SIZE/COLS, SIZE/ROWS
    X, Y = x/cw, y/ch                       # координаты в петлях
    H = np.zeros((SIZE, SIZE)); occl = np.zeros((SIZE, SIZE))
    for oy in (-1, 0, 1, 2):
        for ox in (-1, 0, 1):
            cx, cy = np.floor(X)+ox, np.floor(Y)+oy
            fx, fy = X-cx, (Y-cy)*0.82          # лёгкое сжатие по высоте: петли шире, чем выше
            for side in (-1, 1):                # левая и правая «ножка» буквы V
                ax, ay = 0.5+side*0.40, 0.0
                bx, by = 0.5+side*0.02, 1.0
                d, t = seg_dist(fx, fy, ax, ay, bx, by*0.82+0.0)
                r = 0.20*(0.75+0.5*np.sin(np.pi*np.clip(t, 0, 1)))      # ножка толще в середине
                core = np.clip(1-(d/r)**2, 0, 1)**1.4
                twist = 1+0.10*np.sin(t*34+side*1.3+cx*1.7)             # скрутка пряжи вдоль ножки
                h = core*twist*(0.85+0.15*t)
                H = np.maximum(H, h)
    return H

def to_png(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def build():
    H = knit_height()
    # ворс: тонкий направленный шум вдоль петель и общий мелкий
    n1 = rng.random((SIZE, SIZE)); n1 = np.array(Image.fromarray((n1*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9)), float)/255
    n2 = rng.random((SIZE, SIZE)); n2 = np.array(Image.fromarray((n2*255).astype(np.uint8)).resize((SIZE, SIZE//4), Image.BILINEAR).resize((SIZE, SIZE), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.6)), float)/255
    Hf = H*1.0+0.10*(n1-.5)+0.07*(n2-.5)
    Hf = np.array(Image.fromarray(np.clip(Hf*255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), float)/255
    S = 9.0
    dx = (np.roll(Hf, -1, 1)-np.roll(Hf, 1, 1))*0.5*SIZE/ (SIZE/ (COLS*1.0)) * 0.12
    dy = (np.roll(Hf, -1, 0)-np.roll(Hf, 1, 0))*0.5*SIZE/ (SIZE/ (COLS*1.0)) * 0.12
    nx, ny, nz = -dx*S, dy*S, np.ones_like(dx)         # OpenGL: зелёный вверх, ось y картинки вниз
    ln = np.sqrt(nx*nx+ny*ny+nz*nz); nx, ny, nz = nx/ln, ny/ln, nz/ln
    normal = np.stack([(nx*.5+.5)*255, (ny*.5+.5)*255, (nz*.5+.5)*255], -1)
    # цвет: затемнение во впадинах между петлями, чуть светлее на гребнях
    Hs = np.array(Image.fromarray(np.clip(Hf*255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), float)/255
    ao = 0.40+0.60*np.clip(Hs*1.3, 0, 1)**0.9
    ao *= 0.92+0.08*n1
    base = np.stack([ao*255]*3, -1)
    return to_png(normal), to_png(base)

def patch(path):
    d = open(path, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20+jl]); off = 20+jl+8
    binchunk = d[off:]
    nimg, bimg = build()
    def png(im):
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b.getvalue()
    pn, pb = png(nimg), png(bimg)
    bvs = j['bufferViews']; i0, i1 = j['images'][0]['bufferView'], j['images'][1]['bufferView']
    keep = {k: binchunk[v['byteOffset']:v['byteOffset']+v['byteLength']] for k, v in enumerate(bvs) if k not in (i0,)}
    # перестроить буфер: всё как было, но нормаль-карта новая, добавлена карта цвета
    blob = bytearray(); newbvs = []
    def put(data, extra=None):
        while len(blob) % 4: blob.append(0)
        o = len(blob); blob.extend(data); e = {'buffer': 0, 'byteOffset': o, 'byteLength': len(data)}
        if extra: e.update(extra)
        newbvs.append(e); return len(newbvs)-1
    for k, v in enumerate(bvs):
        data = pn if k == i0 else binchunk[v['byteOffset']:v['byteOffset']+v['byteLength']]
        put(data, {'target': v['target']} if 'target' in v else None)
    ibase = put(pb)
    j['bufferViews'] = newbvs
    if len(j['images']) < 3: j['images'].append({'bufferView': ibase, 'mimeType': 'image/png'})
    else: j['images'][2]['bufferView'] = ibase
    if len(j['textures']) < 3: j['textures'].append({'sampler': 0, 'source': 2})
    m = j['materials'][0]
    m['pbrMetallicRoughness']['baseColorFactor'] = [0.075, 0.075, 0.082, 1]
    m['pbrMetallicRoughness']['baseColorTexture'] = {'index': 2}
    m['normalTexture'] = {'index': 0, 'scale': 1.7}
    j['buffers'][0]['byteLength'] = len(blob)
    jb = json.dumps(j, separators=(',', ':')).encode(); jb += b' '*((4-len(jb) % 4) % 4)
    while len(blob) % 4: blob.append(0)
    tot = 12+8+len(jb)+8+len(blob)
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, tot)+struct.pack('<I', len(jb))+b'JSON'+jb+struct.pack('<I', len(blob))+b'BIN\0'+bytes(blob))
    nimg.save('/tmp/knit_normal.png'); bimg.save('/tmp/knit_base.png')
    print(path, len(d), '->', 20+len(jb)+8+len(blob))

if __name__ == '__main__':
    patch(sys.argv[1] if len(sys.argv) > 1 else '../models/beanie.glb')
