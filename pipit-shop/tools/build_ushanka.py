"""Ушанка из чёрного меха: геометрия + карточки-пряди (hair cards). Запуск: python3 build_ushanka.py [out.glb]
Модель в метрах, начало координат в центре нижнего края шапки, +Z вперёд (как у остальных шапок)."""
import sys, json, struct, numpy as np
from PIL import Image, ImageDraw
rng = np.random.default_rng(7)
K, YREF = 0.100, -0.07           # единицы эскиза -> метры, сдвиг: нижний край шапки на y=0
S3 = lambda x: x*x*(3-2*x)
def smooth(a, b, x): return S3(np.clip((x-a)/(b-a), 0, 1))
def norm(v): return v/np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)

# ---------- поверхности (в единицах эскиза; v,u массивы) ----------
def sup(c, r, n, tmax=np.pi):
    """Суперэллипсоид: n=2 обычный эллипсоид, n>2 «скруглённый ящик». Возвращает точку и приблизительную нормаль."""
    c, r = np.array(c), np.array(r)
    def f(u, v):
        ct = 1-v*(1-np.cos(tmax)); st = np.sqrt(np.maximum(1-ct*ct, 0)); ph = u*2*np.pi
        d = np.stack([st*np.cos(ph), ct, st*np.sin(ph)], -1)
        k = (np.abs(d/r)**n).sum(-1, keepdims=True)**(-1/n)
        p = d*k
        nn = np.sign(p)*np.abs(p/r)**(n-1)/r
        return c+p, norm(nn)
    return f

def band(rx, rz, y0f, a, b, T, taper, sg=1.0, n=2.6):
    """Подвёрнутая меховая полоса вокруг купола (отворот спереди sg=1 или сзади sg=-1).
    Дуга t по эллипсу (rx, rz), сечение скруглённый прямоугольник a (наружу) x b (вверх), к концам сужается."""
    def f(u, v):
        t = (u-.5)*2*T; al = v*2*np.pi
        e = 1-(1-taper)*(np.abs(t)/T)**3
        o = sg*norm(np.stack([rz*np.sin(t), 0*t, rx*np.cos(t)], -1))
        C = np.stack([sg*rx*np.sin(t), y0f(t), sg*rz*np.cos(t)], -1)
        ca, sa = np.cos(al), np.sin(al)
        k1 = np.sign(ca)*np.abs(ca)**(2/n); k2 = np.sign(sa)*np.abs(sa)**(2/n)
        P = C+o*(a*e*k1)[..., None]+np.stack([0*t, b*e*k2, 0*t], -1)
        N = norm(o*(np.sign(ca)*np.abs(ca)**(n-1)/a)[..., None]+np.stack([0*t, np.sign(sa)*np.abs(sa)**(n-1)/b, 0*t], -1))
        return P, N
    return f

def seam(ph, k, w):          # узкие долины по швам: k панелей, острота w
    return ((1+np.cos(k*ph))/2)**w

def crown_f(u, v):
    p, n = sup([0, .30, -.01], [.80, .84, 1.02], 2.35, np.pi*.645)(u, v)
    ph = np.arctan2(p[..., 2], p[..., 0]); h = smooth(.0, .55, p[..., 1])          # складки сильнее на макушке
    hh = (1-smooth(.95, 1.12, p[..., 1]))                                            # у самой макушки сходятся в точку
    p = p-n*(.050*seam(ph*1.0, 6, 14)*h*hh)[..., None]                                # 6 швов-долин
    p = p+n*(.018*np.sin(p[..., 0]*7.3+p[..., 2]*4.1)*np.cos(p[..., 1]*6.1+p[..., 0]*3.7))[..., None]   # мягкие морщины
    return p, n

def flap_f(sign):
    base = sup([sign*.60, -.30, -.03], [.20, .80, .55], 3.2)
    HX, HY = sign*.62, .40
    ang = np.radians(6.0)*sign
    def f(u, v):
        p, n = base(u, v)
        zz = (p[..., 2]+.03)/.55
        p = p.copy(); p[..., 0] = p[..., 0]-sign*.12*zz**2                           # «ухо» огибает голову: передний и задний края ближе к ней
        top = smooth(-.25, .45, p[..., 1])                                           # у петли крепления складок больше
        p[..., 0] += sign*.032*np.sin(p[..., 1]*9.5+zz*1.7)*top*(np.abs(n[..., 0]) > .3)
        p[..., 2] += .022*np.sin(p[..., 1]*7.0+1.3)*top
        c, s_ = np.cos(ang), np.sin(ang)                                              # развод в стороны, чтобы было видно сбоку лица
        d = p-np.array([HX, HY, 0.])
        p = np.stack([HX+d[..., 0]*c-d[..., 1]*s_, HY+d[..., 0]*s_+d[..., 1]*c, d[..., 2]], -1)+np.array([sign*.03, 0, 0])
        return p, n
    return f

def front_y(t): return .15+.10*(t/1.25)**2                                          # отворот спереди чуть поднимается к вискам
def back_y(t): return .10+.05*(t/1.0)**2
FRONT = band(.74, .95, front_y, .17, .22, 1.25, .35)
BACK = band(.74, .95, back_y, .13, .18, 1.0, .4, sg=-1.0)

def wrinkle(f, amp, fx, fy):
    def g(u, v):
        p, n = f(u, v)
        p = p+n*(amp*np.sin(p[..., 0]*fx+1.1)*np.cos(p[..., 1]*fy))[..., None]
        return p, n
    return g
def fin(f):
    def g(u, v):
        p, n = f(u, v)
        return (p-np.array([0, YREF, 0]))*K, n
    return g
# нижний край купола: считаем сразу, чтобы поставить его на y=0
_pp, _ = crown_f(*np.meshgrid(np.linspace(0, 1, 60), np.array([1.0])))
YREF = float(_pp[..., 1].min())
PARTS = {  # имя: (функция, множитель длины меха)
 'crown': (fin(crown_f), 1.0),
 'flapL': (fin(flap_f(-1)), 1.25),
 'flapR': (fin(flap_f(1)), 1.25),
 'brim':  (fin(wrinkle(FRONT, .018, 9.0, 12.0)), 1.05),
 'back':  (fin(wrinkle(BACK, .015, 8.0, 11.0)), 1.05)}
HINGE = {'flapL': np.array([-.62, .40, 0.]), 'flapR': np.array([.62, .40, 0.])}   # где «ухо» крепится к куполу (эскиз)
PLATE = {'c': np.array([0, front_y(0)+.01, .95+.17+.03]), 'r': (.19, .12, .028)}  # металлический шильдик на отвороте

def calc_normals(P, N0):
    dU = np.gradient(P, axis=1); dV = np.gradient(P, axis=0)
    n = np.cross(dU, dV); ln = np.linalg.norm(n, axis=-1, keepdims=True)
    n = np.where(ln > 1e-9, n/np.maximum(ln, 1e-9), N0)
    flip = np.sign((n*N0).sum(-1, keepdims=True)); flip[flip == 0] = 1
    return n*flip
def grid(f, nu=110, nv=76):
    u, v = np.meshgrid(np.linspace(0, 1, nu+1), np.linspace(0, 1, nv+1)); P, N = f(u, v)
    N = calc_normals(P, N)                       # нормали считаем по уже смятой поверхности: пряди ложатся по складкам
    idx = []
    for j in range(nv):
        for i in range(nu):
            a = j*(nu+1)+i; b = a+1; c = a+nu+1; d = c+1; idx += [a, c, b, b, c, d]
    return P.reshape(-1, 3), N.reshape(-1, 3), np.array(idx, np.uint32).reshape(-1, 3)
G = {k: grid(v[0]) for k, v in PARTS.items()}
def area(P, T): return .5*np.linalg.norm(np.cross(P[T[:, 1]]-P[T[:, 0]], P[T[:, 2]]-P[T[:, 0]]), axis=1)
AREA = {k: area(G[k][0], G[k][2]) for k in G}
def sample(k, n):
    P, N, T = G[k]; a = AREA[k]; ti = rng.choice(len(T), n, p=a/a.sum())
    r1, r2 = rng.random(n), rng.random(n); s = np.sqrt(r1); w = np.stack([1-s, s*(1-r2), s*r2], -1)
    p = sum(P[T[ti, i]]*w[:, i:i+1] for i in range(3)); nn = norm(sum(N[T[ti, i]]*w[:, i:i+1] for i in range(3)))
    return p, nn

def plate_mesh(nu=48, nv=28):
    """Металлический шильдик: тонкий скруглённый овал на отвороте."""
    c = (PLATE['c']-np.array([0, YREF, 0]))*K; r = np.array(PLATE['r'])*K
    u, v = np.meshgrid(np.linspace(0, 1, nu+1), np.linspace(0, 1, nv+1))
    P, N = sup(c, r, 3.0)(u, v)
    idx = []
    for j in range(nv):
        for i in range(nu):
            a = j*(nu+1)+i; b = a+1; cc = a+nu+1; dd = cc+1; idx += [a, cc, b, b, cc, dd]
    return P.reshape(-1, 3).astype(np.float32), N.reshape(-1, 3).astype(np.float32), np.array(idx, np.uint32)

# ---------- текстура-атлас прядей ----------
NV, TW, TH, SS = 8, 256, 1024, 3
def clump(seed, silver):
    r = np.random.default_rng(seed); W, H = TW*SS, TH*SS
    im = Image.new('RGBA', (W, H), (12, 12, 13, 0)); d = ImageDraw.Draw(im)
    for _ in range(95):
        x0 = np.clip(W*(.5+r.normal(0, .19)), .08*W, .92*W); xt = W*(.5+(x0/W-.5)*.62+r.normal(0, .06))
        ln = H*r.uniform(.45, 1.0); bend = r.normal(0, .05)*W; ts = np.linspace(0, 1, 220)
        ys = H-ts*ln; xs = x0+(xt-x0)*ts+bend*np.sin(np.pi*ts)+r.normal(0, .004*W)*np.sin(ts*9)
        w0 = r.uniform(.008, .015)*W; g0 = r.uniform(5, 10)
        g1 = r.uniform(78, 112) if (silver and r.random() < .3) else r.uniform(34, 56)
        for t, x, y in zip(ts, xs, ys):
            w = max(1.1*SS, w0*(1-t)**.9); g = g0+(g1-g0)*t**1.5
            d.ellipse((x-w/2, y-w/2, x+w/2, y+w/2), fill=(int(g), int(g), int(g*1.04), 255))
    return im.resize((TW, TH), Image.LANCZOS)
atlas = Image.new('RGBA', (TW*NV, TH))
for i in range(NV): atlas.paste(clump(100+i, silver=(i % 4 >= 2)), (i*TW, 0))

# ---------- затемнение в складках: швы купола и морщины читаются тоном меха ----------
def crease_ao(k, p):
    q = p/K+np.array([0, YREF, 0])
    if k == 'crown':
        ph = np.arctan2(q[:, 2], q[:, 0]); h = smooth(.0, .55, q[:, 1]); hh = 1-smooth(.95, 1.12, q[:, 1])
        return 1-.55*seam(ph, 6, 10)*h*hh
    if k in ('flapL', 'flapR'):
        top = smooth(-.25, .45, q[:, 1])
        return 1-.4*top*np.clip(-np.sin(q[:, 1]*9.5), 0, 1)
    return 1-.35*np.clip(-np.sin(q[:, 0]*9.0+1.1)*np.cos(q[:, 1]*12.0), 0, 1)

# ---------- карточки ----------
def cards(layer, n, L, Wd, lift, droop, roll, jit):
    """Возвращает по каждой части (купол, «уши», отворот, задняя полоса) свои массивы вершин: «уши» потом качаются отдельно."""
    shares = {k: AREA[k].sum() for k in G}; tot = sum(shares.values())
    out = {}; R = 4
    for k in G:
        m = int(n*shares[k]/tot); p, nn = sample(k, m); lm = PARTS[k][1]
        if k == 'brim':      # вокруг шильдика мех убираем: чистая площадка
            pc = (PLATE['c']-np.array([0, YREF, 0]))*K
            q = (p-pc)/(np.array([PLATE['r'][0], PLATE['r'][1], 1e3])*K*1.55)
            keep = ((q[:, 0]**2+q[:, 1]**2) > 1) | (p[:, 2] < 0.05)
            p, nn = p[keep], nn[keep]; m = len(p)
        V, Nn, U, C, I = [], [], [], [], []
        g = np.array([0, -1, 0.]); vec = g+(np.array([0, 0, -1.2]) if k == 'crown' else 0)
        f = vec-nn*np.sum(nn*vec, -1, keepdims=True); bad = np.linalg.norm(f, axis=1) < .2
        rad = norm(np.stack([p[:, 0], 0*p[:, 0], p[:, 2]-.01], -1)); f[bad] = rad[bad]; f = norm(f)
        a = rng.uniform(*lift, m)[:, None]; f = norm(f+rng.normal(0, jit, (m, 3)))
        d = norm(f*np.cos(a)+nn*np.sin(a)); Ls = rng.uniform(*L, m)*lm; Ws = rng.uniform(*Wd, m)
        b = norm(np.cross(d, nn)); rl = rng.uniform(-roll, roll, m)[:, None]
        s = norm(b*np.cos(rl)+np.cross(d, b)*np.sin(rl))
        c = p-nn*.0018; rows = []
        for i in range(R):
            t = i/(R-1); wi = Ws*(1-.2*t*t)
            sd = norm(s-d*np.sum(s*d, -1, keepdims=True))
            rows.append((c+sd*wi[:, None]/2, c-sd*wi[:, None]/2, t))
            c = c+d*(Ls/(R-1))[:, None]; d = norm(d+g*(droop*.5)+rng.normal(0, .06, (m, 3))*(i+1)*.3)
        var = rng.integers(0, NV, m); u0 = (var/NV+.003)[:, None]; u1 = ((var+1)/NV-.003)[:, None]
        ao = (.6+.4*smooth(-.05, .075, p[:, 1]))*(1 if k not in ('flapL', 'flapR') else (.7+.3*smooth(-.8, .2, nn[:, 0]*np.sign(p[:, 0]))))
        tone = rng.uniform(.7, 1.0, m)*ao*crease_ao(k, p)
        for (pa, pb, t) in rows:
            V += [pa, pb]; Nn += [nn, nn]; C += [np.repeat(tone[:, None], 3, 1)]*2
            U += [np.concatenate([u0, np.full((m, 1), 1-t)], 1), np.concatenate([u1, np.full((m, 1), 1-t)], 1)]
        def vi(row, side, ci): return (row*2+side)*m+ci
        ci = np.arange(m)
        for row in range(R-1):
            a0, b0, a1, b1 = vi(row, 0, ci), vi(row, 1, ci), vi(row+1, 0, ci), vi(row+1, 1, ci)
            I += [np.stack([a0, b0, a1], 1), np.stack([b0, b1, a1], 1)]
        out[k] = ([np.concatenate(x).astype(np.float32) for x in (V, Nn, U, C)], np.concatenate(I).astype(np.uint32))
    return out
N_SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
LAYERS = [  # имя, число, длина, ширина, подъём от поверхности, провисание, разброс поворота, шум направления, тон
 ('fur_under', int(12500*N_SCALE), (.010, .016), (.009, .013), (.08, .25), .30, 1.0, .07, .55),
 ('fur_mid',   int(11000*N_SCALE), (.016, .026), (.011, .016), (.12, .32), .50, 1.1, .09, .9),
 ('fur_guard', int(5500*N_SCALE),  (.026, .040), (.011, .016), (.18, .42), .75, 1.2, .14, 1.0)]

# ---------- запись GLB ----------
def write_glb(path, nodes_spec, mats, png):
    """nodes_spec: список узлов верхнего уровня. Узел меша: ('mesh', имя, материал, V, N, U, C, I);
    узел-шарнир: ('hinge', имя, (x,y,z), [дочерние узлы меша]) — «ухо» крутится вокруг шарнира в AR."""
    blob = bytearray(); bvs, accs = [], []
    def add(arr, target=None):
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob.extend(arr.tobytes()); bvs.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, **({'target': target} if target else {})}); return len(bvs)-1
    def acc(arr, ctype, typ, target, mm=False, nrm=False):
        a = {'bufferView': add(arr, target), 'componentType': ctype, 'count': len(arr), 'type': typ}
        if nrm: a['normalized'] = True
        if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a); return len(accs)-1
    jm, jn = [], []
    def mesh_node(spec, shift=None):
        _, name, mat, V, N, U, C, I = spec
        at = {'POSITION': acc(V, 5126, 'VEC3', 34962, True)}
        if U is not None:       # пряди: нормали int8, UV uint16 (KHR_mesh_quantization), файл втрое легче по этим атрибутам
            n4 = np.zeros((len(N), 4), np.int8); n4[:, :3] = np.clip(np.round(N*127), -127, 127)
            bi = add(n4, 34962); bvs[bi]['byteStride'] = 4
            accs.append({'bufferView': bi, 'componentType': 5120, 'count': len(N), 'type': 'VEC3', 'normalized': True}); at['NORMAL'] = len(accs)-1
            at['TEXCOORD_0'] = acc(np.clip(np.round(U*65535), 0, 65535).astype(np.uint16), 5123, 'VEC2', 34962, nrm=True)
        else:
            at['NORMAL'] = acc(N, 5126, 'VEC3', 34962)
        if C is not None: at['COLOR_0'] = acc(np.concatenate([np.clip(C*255, 0, 255), np.full((len(C), 1), 255)], 1).astype(np.uint8), 5121, 'VEC4', 34962, nrm=True)
        ii = acc(I.reshape(-1), 5125, 'SCALAR', 34963)
        jm.append({'name': name, 'primitives': [{'attributes': at, 'indices': ii, 'material': mat}]})
        node = {'name': name, 'mesh': len(jm)-1}
        if shift is not None: node['translation'] = [float(-x) for x in shift]
        jn.append(node); return len(jn)-1
    top = []
    for sp in nodes_spec:
        if sp[0] == 'mesh': top.append(mesh_node(sp))
        else:
            _, name, pos, kids = sp
            ch = [mesh_node(k, pos) for k in kids]
            jn.append({'name': name, 'translation': [float(x) for x in pos], 'children': ch}); top.append(len(jn)-1)
    img = add(np.frombuffer(png, np.uint8))
    jn.append({'name': 'Ushanka', 'children': top})
    j = {'asset': {'version': '2.0', 'generator': 'pipit tools/build_ushanka.py'}, 'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'], 'scene': 0, 'scenes': [{'nodes': [len(jn)-1]}],
         'nodes': jn, 'meshes': jm, 'materials': mats,
         'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
         'images': [{'bufferView': img, 'mimeType': 'image/png'}], 'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(blob)}]}
    jb = json.dumps(j, separators=(',', ':')).encode(); jb += b' '*((4-len(jb) % 4) % 4)
    while len(blob) % 4: blob.append(0)
    tot = 12+8+len(jb)+8+len(blob)
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, tot)+struct.pack('<I', len(jb))+b'JSON'+jb+struct.pack('<I', len(blob))+b'BIN\0'+bytes(blob))

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'ushanka.glb'
    import io; bio = io.BytesIO(); atlas.save(bio, 'PNG', optimize=True)
    mats = [{'name': 'Fur_base', 'pbrMetallicRoughness': {'baseColorFactor': [.012, .012, .013, 1], 'metallicFactor': 0, 'roughnessFactor': 1}, 'doubleSided': True},
            {'name': 'Steel_plate', 'pbrMetallicRoughness': {'baseColorFactor': [.82, .83, .85, 1], 'metallicFactor': 1, 'roughnessFactor': .28}}]
    per = {k: [] for k in G}            # части -> список мешей-слоёв
    for k in G:                         # основа (кожа) под мехом
        P, N, T = G[k]
        per[k].append(('mesh', 'fur_base_'+k, 0, (P*.995).astype(np.float32), N.astype(np.float32), None, None, T.reshape(-1, 3).astype(np.uint32)))
    for li, (nm, n, L, Wd, lift, dr, roll, jit, tone) in enumerate(LAYERS):
        mats.append({'name': 'Fur_'+nm[4:], 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'baseColorFactor': [tone, tone, tone, 1], 'metallicFactor': 0, 'roughnessFactor': .9},
                     'alphaMode': 'MASK', 'alphaCutoff': .5, 'doubleSided': True})
        res = cards(nm, n, L, Wd, lift, dr, roll, jit)
        for k, ((V, N, U, C), I) in res.items():
            per[k].append(('mesh', nm+'_'+k, li+2, V, N, U, C, I))
    nodes = []
    for k in ('crown', 'brim', 'back'): nodes += per[k]
    pv, pn, pi = plate_mesh(); nodes.append(('mesh', 'plate', 1, pv, pn, None, None, pi))
    for k in ('flapL', 'flapR'):
        hp = (HINGE[k]-np.array([0, YREF, 0]))*K
        nodes.append(('hinge', 'hinge_'+k, hp, per[k]))
    write_glb(out, nodes, mats, bio.getvalue())
    tr = sum(len(sp[7])//3 for sp in nodes if sp[0] == 'mesh')+sum(len(m[7])//3 for sp in nodes if sp[0] == 'hinge' for m in sp[3])
    print(out, tr, 'tris')
