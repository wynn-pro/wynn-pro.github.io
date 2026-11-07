"""Redline Rush - a top-down arcade racer made with Ursina.

Run:  python main.py        (from the ursina-env virtual environment)

Controls
  W / Up      accelerate          S / Down   brake / reverse
  A D / Left Right   steer        Space      use item (oil slick / missile)
  R           put the car back on the track     Esc   pause
"""
from ursina import *  # noqa: F401,F403  (Ursina's usual star import)
import json
import math
import random
import struct
import sys
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAVE_FILE = HERE / 'save.json'
SND_DIR = HERE / 'sounds'
TEST = '--selftest' in sys.argv


def rgb(r, g, b, a=255):
    return color.rgba32(r, g, b, a)


def shade(c, f):
    return rgb(int(min(255, c[0] * f)), int(min(255, c[1] * f)), int(min(255, c[2] * f)))


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def wrap_angle(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


def kill(e):
    try:
        destroy(e)
    except Exception:
        pass


# ----------------------------------------------------------------------------
# Data: cars, tracks, rewards
# ----------------------------------------------------------------------------
# name, body colour, top speed (units/s), acceleration, handling, health, price
CARS = [
    dict(name='Compact',  col=(70, 130, 220),  top=30, accel=12, handling=0.95, hp=100, price=0),
    dict(name='Hatch',    col=(235, 190, 40),  top=32, accel=13, handling=1.00, hp=100, price=150),
    dict(name='Sedan',    col=(90, 170, 110),  top=34, accel=14, handling=1.00, hp=120, price=250),
    dict(name='Wagon',    col=(150, 110, 200), top=35, accel=14, handling=1.05, hp=140, price=400),
    dict(name='Coupe',    col=(230, 120, 40),  top=37, accel=16, handling=1.05, hp=100, price=600),
    dict(name='Rally',    col=(40, 110, 200),  top=38, accel=17, handling=1.12, hp=130, price=800),
    dict(name='Muscle',   col=(190, 40, 40),   top=41, accel=18, handling=0.88, hp=110, price=1000),
    dict(name='Sport',    col=(240, 240, 245), top=41, accel=19, handling=1.12, hp=100, price=1250),
    dict(name='Roadster', col=(30, 170, 160),  top=43, accel=21, handling=1.18, hp=90,  price=1500),
    dict(name='GT',       col=(25, 25, 30),    top=45, accel=23, handling=1.15, hp=110, price=1750),
    dict(name='Super',    col=(245, 215, 20),  top=47, accel=25, handling=1.20, hp=100, price=2000),
    dict(name='Hyper',    col=(200, 20, 70),   top=50, accel=28, handling=1.25, hp=100, price=2500),
]
AI_COLORS = [(220, 60, 60), (60, 160, 230), (240, 170, 30), (130, 200, 80), (200, 90, 220),
             (240, 240, 240), (255, 120, 160), (60, 60, 70), (50, 200, 200)]
AI_NAMES = ['Max', 'Luna', 'Rex', 'Zoe', 'Kai', 'Ava', 'Finn', 'Mia', 'Jax', 'Nova']
PLACE_COINS = [100, 70, 50, 30, 20, 10]
LAP_CHOICES = [1, 3, 5, 8, 10]
DIFFS = [('Easy', 0.80, (0, 6)), ('Medium', 0.90, (2, 9)), ('Hard', 0.985, (5, 11))]
NUM_AI = 5
SMOOTH_PASSES = 60

TRACKS = [
    dict(name='Downtown Dash', theme='city', width=14, pts=[
        (0, -90), (80, -90), (140, -60), (150, 0), (110, 50), (60, 40), (20, 70), (-30, 100),
        (-100, 90), (-140, 40), (-130, -30), (-90, -70)]),
    dict(name='Dune Run', theme='desert', width=15, pts=[
        (0, -100), (90, -110), (160, -70), (170, 0), (120, 30), (130, 90), (70, 130), (0, 100),
        (-40, 50), (-100, 70), (-160, 30), (-150, -50), (-80, -60), (-50, -100)]),
    dict(name='Frostpeak', theme='snow', width=15, pts=[
        (0, -120), (100, -100), (150, -40), (110, 10), (150, 70), (100, 130), (20, 110),
        (-30, 60), (-90, 110), (-150, 70), (-140, 0), (-90, -30), (-120, -80), (-60, -120)]),
]
THEMES = {
    'city':   dict(ground=(104, 110, 112), road=(58, 60, 64), barrier=(185, 185, 190), amp=10),
    'desert': dict(ground=(216, 178, 120), road=(92, 84, 80), barrier=(70, 52, 44), amp=14),
    'snow':   dict(ground=(232, 240, 248), road=(70, 76, 86), barrier=(250, 252, 255), amp=5),
}


# ----------------------------------------------------------------------------
# Generated sound effects (no asset files needed)
# ----------------------------------------------------------------------------
def _write_wav(name, samples, rate=22050):
    with wave.open(str(SND_DIR / name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b''.join(struct.pack('<h', int(clamp(s, -1, 1) * 32000)) for s in samples))


def make_sounds():
    SND_DIR.mkdir(exist_ok=True)
    R = 22050
    if not (SND_DIR / 'engine.wav').exists():
        s = []
        for i in range(R // 2):                      # 0.5 s, 60 Hz -> loops seamlessly
            t = i / R
            v = sum(a * math.sin(2 * math.pi * 60 * h * t)
                    for h, a in ((1, .5), (2, .32), (3, .26), (4, .16), (6, .1)))
            v += .15 * math.sin(2 * math.pi * 30 * t)
            s.append(math.tanh(v * 1.6) * .6)
        _write_wav('engine.wav', s)
    if not (SND_DIR / 'crash.wav').exists():
        s = [(random.uniform(-1, 1) * .8 + math.sin(2 * math.pi * 70 * i / R) * .7) * math.exp(-i / R * 11)
             for i in range(int(R * .4))]
        _write_wav('crash.wav', s)
    if not (SND_DIR / 'pickup.wav').exists():
        s = [math.sin(2 * math.pi * (660 + 700 * i / R) * i / R) * .5 * (1 - i / (R * .22))
             for i in range(int(R * .22))]
        _write_wav('pickup.wav', s)
    if not (SND_DIR / 'whoosh.wav').exists():
        s, lp = [], 0.0
        n = int(R * .6)
        for i in range(n):
            lp += (random.uniform(-1, 1) - lp) * (.05 + .25 * i / n)
            s.append(lp * 2.2 * math.sin(math.pi * i / n))
        _write_wav('whoosh.wav', s)
    if not (SND_DIR / 'beep.wav').exists():
        _write_wav('beep.wav', [math.sin(2 * math.pi * 880 * i / R) * .5 * (1 - i / (R * .18))
                                for i in range(int(R * .18))])
    if not (SND_DIR / 'go.wav').exists():
        _write_wav('go.wav', [math.sin(2 * math.pi * 1320 * i / R) * .5 * math.exp(-i / R * 5)
                              for i in range(int(R * .6))])
    if not (SND_DIR / 'splat.wav').exists():
        s = [math.sin(2 * math.pi * (700 - 500 * i / (R * .5)) * i / R) * .5 * (1 - i / (R * .5))
             for i in range(int(R * .5))]
        _write_wav('splat.wav', s)
    if not (SND_DIR / 'cash.wav').exists():
        s = [math.sin(2 * math.pi * (1200 if i < R * .08 else 1600) * i / R) * .4 * math.exp(-i / R * 9)
             for i in range(int(R * .35))]
        _write_wav('cash.wav', s)


SOUNDS = {}


def load_sounds():
    try:
        make_sounds()
    except Exception as e:                           # sound is optional
        print('could not generate sounds:', e)
        return
    for n in ('crash', 'pickup', 'whoosh', 'beep', 'go', 'splat', 'cash'):
        try:
            SOUNDS[n] = Audio(f'sounds/{n}.wav', autoplay=False)
        except Exception:
            SOUNDS[n] = None


def play(name, volume=.6, pitch=1.0):
    a = SOUNDS.get(name)
    if a:
        try:
            a.volume = volume
            a.pitch = pitch
            a.play()
        except Exception:
            pass


# ----------------------------------------------------------------------------
# Save game
# ----------------------------------------------------------------------------
class SaveData:
    def __init__(self):
        self.coins = 0
        self.owned = [0]
        self.selected = 0
        self.best = {}
        try:
            d = json.loads(SAVE_FILE.read_text())
            self.coins = int(d.get('coins', 0))
            self.owned = sorted(set(int(i) for i in d.get('owned', [0])) | {0})
            self.selected = int(d.get('selected', 0))
            self.best = {k: float(v) for k, v in d.get('best', {}).items()}
        except Exception:
            pass
        if self.selected not in self.owned:
            self.selected = 0

    def save(self):
        if TEST:
            return
        try:
            SAVE_FILE.write_text(json.dumps(dict(coins=self.coins, owned=self.owned,
                                                 selected=self.selected, best=self.best)))
        except Exception as e:
            print('could not save:', e)


# ----------------------------------------------------------------------------
# Track geometry
# ----------------------------------------------------------------------------
def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1))


class TrackData:
    SPACING = 2.5

    def __init__(self, spec):
        self.spec = spec
        self.half = spec['width'] / 2
        ctrl = spec['pts']
        n = len(ctrl)
        dense = []
        for i in range(n):
            for s in range(40):
                dense.append(catmull(ctrl[i - 1], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n], s / 40))
        cum = [0.0]
        for i in range(len(dense)):
            a, b = dense[i], dense[(i + 1) % len(dense)]
            cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        total = cum[-1]
        self.N = N = round(total / self.SPACING)
        self.length = total
        step = total / N
        self.p = []
        j = 0
        for i in range(N):
            d = i * step
            while cum[j + 1] < d:
                j += 1
            a, b = dense[j], dense[(j + 1) % len(dense)]
            t = (d - cum[j]) / max(1e-9, cum[j + 1] - cum[j])
            self.p.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        for _ in range(SMOOTH_PASSES):               # relax tight bends into driveable corners
            q = self.p
            self.p = [((q[i - 1][0] + 2 * q[i][0] + q[(i + 1) % N][0]) / 4,
                       (q[i - 1][1] + 2 * q[i][1] + q[(i + 1) % N][1]) / 4) for i in range(N)]
        self.hd, self.nor = [], []
        for i in range(N):
            a, b = self.p[i - 1], self.p[(i + 1) % N]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            self.hd.append(math.atan2(dx, dy))
            self.nor.append((-dy / L, dx / L))       # left-hand normal
        raw = [abs(wrap_angle(self.hd[(i + 1) % N] - self.hd[i])) / step for i in range(N)]
        self.curv = [sum(raw[(i + k) % N] for k in range(-2, 3)) / 5 for i in range(N)]
        xs, ys = [q[0] for q in self.p], [q[1] for q in self.p]
        self.bounds = (min(xs), max(xs), min(ys), max(ys))

    def nearest(self, x, y, hint, back=8, fwd=16):
        """Closest point on the centre line. Returns (float index, cx, cy, distance)."""
        N, p = self.N, self.p
        best, bi = 1e18, hint
        for k in range(-back, fwd + 1):
            i = (hint + k) % N
            d = (p[i][0] - x) ** 2 + (p[i][1] - y) ** 2
            if d < best:
                best, bi = d, i
        if best > (self.half * 3) ** 2:              # lost the car: search everywhere
            for i in range(N):
                d = (p[i][0] - x) ** 2 + (p[i][1] - y) ** 2
                if d < best:
                    best, bi = d, i
        res = None
        for j in (bi - 1, bi):
            a, b = p[j % N], p[(j + 1) % N]
            abx, aby = b[0] - a[0], b[1] - a[1]
            t = clamp(((x - a[0]) * abx + (y - a[1]) * aby) / (abx * abx + aby * aby), 0, 1)
            cx, cy = a[0] + abx * t, a[1] + aby * t
            d = math.hypot(x - cx, y - cy)
            if res is None or d < res[3]:
                res = ((j % N) + t, cx, cy, d)
        return res

    def pos_at(self, f, lateral=0.0):
        i = int(f) % self.N
        n = self.nor[i]
        return self.p[i][0] + n[0] * lateral, self.p[i][1] + n[1] * lateral, self.hd[i]


def corner_speed(radius, handling):
    """Highest speed at which the car's steering can still follow a curve of this radius."""
    k = 1.65 * handling * radius
    return (-1 + math.sqrt(1 + 4 * k / 55)) * 55 / 2


# ----------------------------------------------------------------------------
# Visuals
# ----------------------------------------------------------------------------
def quad(parent, x, y, w, h, col, z=0.0):
    return Entity(parent=parent, model='quad', position=(x, y, z), scale=(w, h), color=col)


def make_car_visual(parent, col, tier=0):
    """Top-down car, nose pointing +y, 1.8 wide x 3.7 long."""
    car = Entity(parent=parent)
    quad(car, .14, -.14, 2.05, 3.9, rgb(0, 0, 0, 70), .06)                   # shadow
    for sx in (-1, 1):
        for y in (-1.15, 1.2):
            quad(car, sx * .95, y, .42, .9, rgb(18, 18, 20), .03)            # wheels
    body = rgb(*col)
    quad(car, 0, -.05, 1.8, 3.0, body, -.01)
    quad(car, 0, 1.55, 1.5, .9, body, -.01)                                    # nose
    quad(car, 0, -1.6, 1.62, .7, body, -.01)                                   # tail
    if tier >= 5:                                                              # racing stripes
        for sx in (-.22, .22):
            quad(car, sx, 0, .16, 3.5, rgb(240, 240, 240), -.02)
    quad(car, 0, -.3, 1.4, 1.7, shade(col, .7), -.03)                          # cabin
    quad(car, 0, .62, 1.22, .5, rgb(45, 60, 85), -.04)                         # windscreen
    quad(car, 0, -1.12, 1.1, .36, rgb(40, 52, 75), -.04)                       # rear window
    quad(car, 0, .62, .5, .1, rgb(120, 150, 190), -.05)                        # glare
    for sx in (-.6, .6):
        quad(car, sx, 1.95, .34, .16, rgb(255, 245, 170), -.03)                # headlights
        quad(car, sx, -1.93, .38, .12, rgb(230, 30, 30), -.03)                 # tail lights
    if tier >= 3:
        quad(car, 0, -2.0, 1.7, .26, rgb(20, 20, 24), -.05)                    # spoiler
    return car


def noise_texture(base, amp, size=128, blotch=0):
    from PIL import Image, ImageChops, ImageFilter
    img = ImageChops.add(Image.new('RGB', (size, size), base),
                         Image.effect_noise((size, size), amp).convert('RGB'), 1.0, -128)
    if blotch:
        n = Image.effect_noise((size, size), 70).convert('L')
        big = Image.new('L', (size * 3, size * 3))
        for ix in range(3):
            for iy in range(3):
                big.paste(n, (ix * size, iy * size))
        big = big.filter(ImageFilter.GaussianBlur(size / 9)).crop((size, size, size * 2, size * 2))
        lo, hi = big.getextrema()
        big = big.point(lambda v: int(128 + (v - (lo + hi) / 2) * (blotch * 2 / max(1, hi - lo))))
        img = ImageChops.add(img, big.convert('RGB'), 1.0, -128)
    return Texture(img)


def ribbon(trk, off0, off1, runs, uv_scale=12.0):
    """Mesh strip following the centre line between two lateral offsets."""
    verts, tris, uvs = [], [], []
    N = trk.N
    for run in runs:
        base = len(verts)
        for a in run:
            px, py = trk.p[a % N]
            nx, ny = trk.nor[a % N]
            verts += [Vec3(px + nx * off0, py + ny * off0, 0), Vec3(px + nx * off1, py + ny * off1, 0)]
            s = a * trk.SPACING / uv_scale
            uvs += [(0, s), (1, s)]
        for k in range(len(run) - 1):
            i = base + 2 * k
            tris.append((i, i + 1, i + 3, i + 2))
    return Mesh(vertices=verts, triangles=tris, uvs=uvs, mode='triangle')


def build_world(trk, theme_name, parent):
    th = THEMES[theme_name]
    N, half = trk.N, trk.half
    x0, x1, y0, y1 = trk.bounds
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    size = max(x1 - x0, y1 - y0) + 420
    ground_tex = noise_texture(th['ground'], th['amp'], blotch=th['amp'] * 1.5)
    Entity(parent=parent, model='quad', texture=ground_tex, position=(cx, cy, 5),
           scale=(size, size), texture_scale=(size / 40, size / 40))
    road_tex = noise_texture(th['road'], 9)
    full = [list(range(N + 1))]
    Entity(parent=parent, model=ribbon(trk, -half, half, full), texture=road_tex, z=4, double_sided=True)
    for side in (1, -1):                                                       # barriers
        a, b = (half, half + 1.1) if side > 0 else (-half - 1.1, -half)
        Entity(parent=parent, model=ribbon(trk, a, b, full), color=rgb(*th['barrier']), z=3.8, double_sided=True)
        a, b = (half + 1.1, half + 1.35) if side > 0 else (-half - 1.35, -half - 1.1)
        Entity(parent=parent, model=ribbon(trk, a, b, full), color=rgb(0, 0, 0, 90), z=3.75, double_sided=True)
    red = [[k, k + 1, k + 2] for k in range(0, N, 4)]                          # kerbs
    white = [[k, k + 1, k + 2] for k in range(2, N, 4)]
    for side in (1, -1):
        a, b = (half - 1.1, half) if side > 0 else (-half, -half + 1.1)
        Entity(parent=parent, model=ribbon(trk, a, b, red), color=rgb(205, 40, 40), z=3.9, double_sided=True)
        Entity(parent=parent, model=ribbon(trk, a, b, white), color=rgb(240, 240, 240), z=3.9, double_sided=True)
    dashes = [[k, k + 1, k + 2] for k in range(0, N, 5)]
    Entity(parent=parent, model=ribbon(trk, -.14, .14, dashes), color=rgb(235, 235, 220, 220), z=3.85,
           double_sided=True)
    # start / finish line
    px, py, hd = trk.pos_at(0)
    line = Entity(parent=parent, position=(px, py, 3.6), rotation_z=math.degrees(hd))
    cols = 10
    cw = (trk.half * 2 - 2.2) / cols
    for r in range(2):
        for c in range(cols):
            quad(line, (c - (cols - 1) / 2) * cw, (r - .5) * .9, cw, .9,
                 rgb(245, 245, 245) if (r + c) % 2 else rgb(20, 20, 20))
    # scenery away from the track
    rnd = random.Random(7)
    sample = trk.p[::2]

    def clear_of_track(x, y, r):
        lim = (half + 4 + r) ** 2
        return all((q[0] - x) ** 2 + (q[1] - y) ** 2 > lim for q in sample)

    spread = size * .5 - 40
    placed = 0
    tries = 0
    want = 85
    while placed < want and tries < 1500:
        tries += 1
        x, y = cx + rnd.uniform(-spread, spread), cy + rnd.uniform(-spread, spread)
        if theme_name == 'city':
            w, h = rnd.uniform(14, 30), rnd.uniform(14, 30)
            if not clear_of_track(x, y, max(w, h) * .55):
                continue
            g = rnd.randint(110, 175)
            quad(parent, x + 1.5, y - 1.5, w, h, rgb(0, 0, 0, 80), 1.2)
            quad(parent, x, y, w, h, rgb(g, g, g + 6), 1.0)
            quad(parent, x, y, w - 3, h - 3, rgb(g - 25, g - 25, g - 20), .95)
            quad(parent, x + rnd.uniform(-3, 3), y + rnd.uniform(-3, 3), w * .22, h * .22, rgb(70, 74, 80), .9)
        elif theme_name == 'desert':
            if not clear_of_track(x, y, 6):
                continue
            kind = rnd.random()
            if kind < .45:
                r = rnd.uniform(4, 9)
                Entity(parent=parent, model='circle', position=(x + .8, y - .8, 1.1), scale=r, color=rgb(0, 0, 0, 60))
                Entity(parent=parent, model='circle', position=(x, y, 1), scale=r, color=rgb(150, 118, 88))
                Entity(parent=parent, model='circle', position=(x - r * .1, y + r * .1, .95), scale=r * .6,
                       color=rgb(176, 142, 108))
            elif kind < .75:
                quad(parent, x, y, 1.1, 5, rgb(60, 130, 70), 1.0)
                quad(parent, x, y + .6, 4, 1, rgb(60, 130, 70), 1.0)
                Entity(parent=parent, model='circle', position=(x, y, .95), scale=1.6, color=rgb(84, 160, 92))
            else:
                r = rnd.uniform(14, 28)
                Entity(parent=parent, model='circle', position=(x, y, 4.5), scale=(r, r * .55),
                       color=rgb(226, 192, 140, 160), rotation_z=rnd.uniform(0, 180))
        else:
            if not clear_of_track(x, y, 6):
                continue
            if rnd.random() < .7:
                r = rnd.uniform(5, 8)
                Entity(parent=parent, model='circle', position=(x + 1, y - 1, 1.1), scale=r, color=rgb(0, 0, 0, 60))
                Entity(parent=parent, model='circle', position=(x, y, 1), scale=r, color=rgb(34, 92, 58))
                Entity(parent=parent, model='circle', position=(x, y, .95), scale=r * .66, color=rgb(48, 120, 76))
                Entity(parent=parent, model='circle', position=(x - .3, y + .3, .9), scale=r * .3, color=rgb(236, 244, 250))
            else:
                r = rnd.uniform(10, 22)
                Entity(parent=parent, model='circle', position=(x, y, 4.5), scale=(r, r * .6),
                       color=rgb(255, 255, 255, 150), rotation_z=rnd.uniform(0, 180))
        placed += 1


# ----------------------------------------------------------------------------
# Cars (simulation)
# ----------------------------------------------------------------------------
class Car:
    def __init__(self, spec, tier, col, name, ai, trk, slot, laps):
        self.spec, self.tier, self.col, self.name, self.ai = spec, tier, col, name, ai
        self.trk = trk
        row, side = slot // 2, slot % 2
        f = (trk.N - 3 - 3 * row) % trk.N
        self.x, self.y, self.h = trk.pos_at(f, (-2.6, 2.6)[side])
        self.vx = self.vy = 0.0
        self.hp = self.maxhp = spec['hp']
        self.spin = 0.0
        self.spin_dir = 1
        self.imm = 0.0
        self.item = None
        self.f = float(f)
        self.lap = -1
        self.max_lap = -1
        self.finished = False
        self.fin_time = 0.0
        self.lap_start = 0.0
        self.last_lap = None
        self.best_lap = None
        self.lane = random.uniform(-3, 3)
        self.lane_t = 0.0
        self.pace = 1.0
        self.stuck = 0.0
        self.item_t = random.uniform(1.5, 4)
        self.smoke_t = 0.0
        self.vf = 0.0
        self.vl = 0.0
        self.dmg = {}
        self.ent = make_car_visual(None, col, tier)
        self.ent.position = (self.x, self.y, 2)
        self.ent.rotation_z = math.degrees(self.h)

    @property
    def progress(self):
        return self.lap * self.trk.N + self.f

    def hurt(self, amount, src='wall'):
        self.hp = max(0.0, self.hp - amount)
        self.dmg[src] = self.dmg.get(src, 0) + amount

    def spin_out(self, secs):
        if self.imm > 0 or self.spin > 0:
            return False
        self.spin = secs
        self.imm = secs + 1.2
        self.spin_dir = random.choice((-1, 1))
        return True

    def step(self, dt, thr, steer, brk):
        sp = self.spec
        top = sp['top'] * (0.5 if self.hp <= 0 else 1.0)
        sh, ch = math.sin(self.h), math.cos(self.h)
        vf = self.vx * sh + self.vy * ch
        vl = self.vx * ch - self.vy * sh
        self.imm = max(0.0, self.imm - dt)
        if self.spin > 0:
            self.spin -= dt
            self.h += self.spin_dir * 10.0 * dt
            vf *= max(0.0, 1 - 1.3 * dt)
            vl *= max(0.0, 1 - 1.3 * dt)
        else:
            if thr:
                if vf < top:
                    vf += sp['accel'] * (1 - .8 * max(vf, 0) / top) * dt
            if brk:
                vf -= 32 * dt if vf > .5 else sp['accel'] * .7 * dt
                vf = max(vf, -top * .3)
            if not thr and not brk:
                vf *= max(0.0, 1 - .5 * dt)
            if vf > top:
                vf -= 25 * dt
            if abs(vf) > .3:
                rate = steer * sp['handling'] * 2.6 * min(1.0, abs(vf) / 7) / (1 + abs(vf) / 55)
                self.h += rate * dt * (1 if vf > 0 else -1)
            vl *= max(0.0, 1 - 6.0 * dt)
        sh, ch = math.sin(self.h), math.cos(self.h)
        self.vx = sh * vf + ch * vl
        self.vy = ch * vf - sh * vl
        self.vf, self.vl = vf, vl
        self.x += self.vx * dt
        self.y += self.vy * dt

    def sync(self):
        self.ent.x, self.ent.y = self.x, self.y
        self.ent.rotation_z = math.degrees(self.h)


# ----------------------------------------------------------------------------
# A race
# ----------------------------------------------------------------------------
class Race:
    shake = 0.0
    msg_t = 0.0
    go_t = 0.0

    def __init__(self, game, track_i, laps, diff_i, car_i, player_ai=False):
        self.game = game
        self.track_i, self.laps, self.diff_i = track_i, laps, diff_i
        spec = TRACKS[track_i]
        self.trk = TrackData(spec)
        self.world = Entity()
        build_world(self.trk, spec['theme'], self.world)
        self.t = 0.0
        self.cd = 3.0
        self.last_cd = 4
        self.state = 'countdown'
        self.paused = False
        self.over_t = 0.0
        self.finish_order = []
        self.oils, self.missiles, self.boxes = [], [], []
        self.skids = []
        self.skid_i = 0

        slots = list(range(NUM_AI + 1))
        random.shuffle(slots)
        player_spec = CARS[car_i]
        self.player = Car(player_spec, car_i, player_spec['col'], 'You', player_ai, self.trk, slots[0], laps)
        self.player.is_player = True
        self.cars = [self.player]
        _, pace, (lo, hi) = DIFFS[diff_i]
        colors = AI_COLORS[:]
        random.shuffle(colors)
        names = AI_NAMES[:]
        random.shuffle(names)
        for k in range(NUM_AI):
            ci = random.randint(lo, hi)
            c = Car(CARS[ci], ci, colors[k], names[k], True, self.trk, slots[k + 1], laps)
            c.pace = pace * random.uniform(.96, 1.0)
            c.is_player = False
            self.cars.append(c)
        for c in self.cars:
            c.ent.parent = self.world
            c.sync()
        self.player.pace = pace

        # item boxes: three across the road at seven spots
        for s in range(7):
            idx = self.trk.N * (s + .5) // 7
            for lat in (-3.6, 0, 3.6):
                x, y, _ = self.trk.pos_at(idx, lat)
                e = Entity(parent=self.world, model='quad', position=(x, y, 3.0), scale=1.7,
                           color=rgb(255, 205, 40), rotation_z=45)
                Entity(parent=e, model='quad', scale=.55, color=rgb(255, 255, 255), z=-.1)
                self.boxes.append(dict(e=e, x=x, y=y, t=0.0))

        # skid mark pool
        for _ in range(110):
            s = Entity(parent=self.world, model='quad', scale=(.28, .8), color=rgb(10, 10, 10, 90),
                       z=3.5, enabled=False)
            self.skids.append(s)

        self.build_hud()
        self.engine = None
        if SOUNDS.get('beep'):
            try:
                self.engine = Audio('sounds/engine.wav', loop=True, autoplay=True, volume=.0)
            except Exception:
                self.engine = None
        camera.orthographic = True
        camera.fov = 46
        camera.position = (self.player.x, self.player.y, -30)
        camera.rotation = (0, 0, 0)

    # ---- HUD -------------------------------------------------------------
    def build_hud(self):
        self.hud = Entity(parent=camera.ui)
        h = self.hud
        self.t_lap = Text(parent=h, text='', position=(-.86, .47), scale=1.7, color=color.white)
        self.t_pos = Text(parent=h, text='', position=(-.86, .41), scale=1.7, color=rgb(255, 215, 60))
        self.t_time = Text(parent=h, text='', position=(.86, .47), origin=(.5, .5), scale=1.4, color=color.white)
        self.t_best = Text(parent=h, text='', position=(.86, .43), origin=(.5, .5), scale=1.1, color=rgb(190, 220, 255))
        self.t_last = Text(parent=h, text='', position=(.86, .40), origin=(.5, .5), scale=1.1, color=rgb(190, 220, 255))
        self.t_big = Text(parent=h, text='', origin=(0, 0), position=(0, .12), scale=7, color=rgb(255, 235, 80))
        self.t_msg = Text(parent=h, text='', origin=(0, 0), position=(0, .30), scale=1.8, color=rgb(255, 120, 90))
        self.t_speed = Text(parent=h, text='', position=(-.86, -.36), scale=2.2, color=color.white)
        Text(parent=h, text='HEALTH', position=(-.86, -.42), scale=.9, color=rgb(200, 200, 200))
        quad(h, -.69, -.455, .3, .026, rgb(0, 0, 0, 150), 1)
        self.hp_bar = Entity(parent=h, model='quad', origin=(-.5, 0), position=(-.84, -.455, .5),
                             scale=(.3, .02), color=rgb(80, 220, 90))
        self.item_box = Entity(parent=h, model='quad', position=(-.12, .42, 1), scale=(.16, .1), color=rgb(0, 0, 0, 140))
        self.item_txt = Text(parent=h, text='', origin=(0, 0), position=(-.12, .42), scale=1.0, color=color.white)
        # minimap
        x0, x1, y0, y1 = self.trk.bounds
        span = max(x1 - x0, y1 - y0)
        self.mm_scale = .30 / span
        self.mm_c = ((x0 + x1) / 2, (y0 + y1) / 2)
        self.mm_o = (.72, -.27)
        quad(h, self.mm_o[0], self.mm_o[1], .36, .36, rgb(0, 0, 0, 130), 1)
        pts = [Vec3((q[0] - self.mm_c[0]) * self.mm_scale + self.mm_o[0],
                    (q[1] - self.mm_c[1]) * self.mm_scale + self.mm_o[1], .9) for q in self.trk.p]
        pts.append(pts[0])
        Entity(parent=h, model=Mesh(vertices=pts, mode='line', thickness=3), color=rgb(210, 210, 215))
        self.dots = []
        for c in self.cars:
            big = c.is_player
            self.dots.append(Entity(parent=h, model='circle', scale=.02 if big else .014, z=.5 if big else .6,
                                    color=rgb(255, 255, 255) if big else rgb(*c.col)))
        self.pause_ui = None

    def mm_pos(self, c):
        return ((c.x - self.mm_c[0]) * self.mm_scale + self.mm_o[0],
                (c.y - self.mm_c[1]) * self.mm_scale + self.mm_o[1])

    # ---- helpers ---------------------------------------------------------
    def rank_of(self, car):
        if car in self.finish_order:
            return self.finish_order.index(car) + 1
        rest = sorted([c for c in self.cars if c not in self.finish_order], key=lambda c: -c.progress)
        return len(self.finish_order) + rest.index(car) + 1

    def puff(self, x, y, col, size=1.0, grow=3.0, life=.6, z=1.6):
        e = Entity(parent=self.world, model='circle', position=(x, y, z), scale=size, color=col)
        e.animate_scale(size * grow, duration=life)
        e.fade_out(duration=life)
        destroy(e, delay=life + .1)

    def respawn(self, c):
        f, cx, cy, d = self.trk.nearest(c.x, c.y, int(c.f))
        c.x, c.y, c.h = self.trk.pos_at(f, 0)
        c.vx = c.vy = 0.0
        c.spin = 0.0
        c.stuck = 0.0

    # ---- AI --------------------------------------------------------------
    def ai_control(self, c, dt):
        trk, sp = self.trk, c.spec
        base = int(c.f)
        vf = max(c.vf, 0)
        # lane choice: dodge a slower car right in front
        c.lane_t -= dt
        if c.lane_t <= 0:
            c.lane_t = random.uniform(.4, 1.0)
            for o in self.cars:
                if o is c:
                    continue
                gap = (o.progress - c.progress) * trk.SPACING
                if 0 < gap < 14 and abs(o.vf) < vf + 4:
                    lat = (o.x - c.x) * trk.nor[base][0] + (o.y - c.y) * trk.nor[base][1]
                    if abs(lat) < 3.2:
                        c.lane = clamp(c.lane + (-3.4 if lat > 0 else 3.4), -trk.half + 3.4, trk.half - 3.4)
                        break
        la = int(3 + vf * .13)
        ti = (base + la) % trk.N
        lane = c.lane * (.4 if trk.curv[ti] > .02 else 1.0)
        tx = trk.p[ti][0] + trk.nor[ti][0] * lane
        ty = trk.p[ti][1] + trk.nor[ti][1] * lane
        diff = wrap_angle(math.atan2(tx - c.x, ty - c.y) - c.h)
        steer = clamp(diff * 2.6, -1, 1)
        tgt = sp['top'] * c.pace
        skill = .9 + .1 * c.pace
        for j in range(0, 24, 2):
            R = 1 / max(trk.curv[(base + j) % trk.N], 1e-4)
            a = corner_speed(R, sp['handling']) * skill
            tgt = min(tgt, math.sqrt(a * a + 2 * 20 * j * trk.SPACING))
        if c.finished:
            tgt = sp['top'] * .5
        thr = 1 if c.vf < tgt else 0
        brk = 1 if c.vf > tgt + 3 else 0
        return thr, steer, brk

    def ai_items(self, c, dt):
        if not c.item or c.spin > 0:
            return
        c.item_t -= dt
        if c.item_t > 0:
            return
        if c.item == 'missile':
            use = any(0 < (o.progress - c.progress) * self.trk.SPACING < 90 for o in self.cars if o is not c)
        else:
            use = any(0 < (c.progress - o.progress) * self.trk.SPACING < 35 for o in self.cars if o is not c)
        if use or c.item_t < -7:
            self.use_item(c)

    # ---- items -----------------------------------------------------------
    def use_item(self, c):
        item = c.item
        if not item:
            return
        c.item = None
        c.item_t = random.uniform(1.5, 4)
        sh, ch = math.sin(c.h), math.cos(c.h)
        if item == 'oil':
            x, y = c.x - sh * 3.6, c.y - ch * 3.6
            e = Entity(parent=self.world, model='circle', position=(x, y, 3.4), scale=.5, color=rgb(12, 12, 16, 235))
            e.animate_scale(4.6, duration=.25)
            Entity(parent=e, model='circle', position=(-.12, .14, -.1), scale=.42, color=rgb(60, 50, 90, 170))
            self.oils.append(dict(e=e, x=x, y=y, t=16.0, owner=c, grace=.7))
            play('splat', .3, 1.4)
        else:
            m = Entity(parent=self.world, position=(c.x + sh * 2.4, c.y + ch * 2.4, 1.5), rotation_z=math.degrees(c.h))
            quad(m, 0, 0, .55, 1.7, rgb(200, 200, 205))
            quad(m, 0, 1.0, .55, .5, rgb(220, 40, 40), -.1)
            quad(m, 0, -1.0, .9, .4, rgb(90, 90, 95), -.1)
            tgt = None
            best = 1e9
            for o in self.cars:
                gap = (o.progress - c.progress) * self.trk.SPACING
                if o is not c and 3 < gap < 160 and gap < best:
                    best, tgt = gap, o
            self.missiles.append(dict(e=m, x=m.x, y=m.y, h=c.h, owner=c, target=tgt, life=4.0, age=0.0))
            play('whoosh', .5)

    def explode(self, x, y):
        self.puff(x, y, rgb(255, 150, 30, 230), 1.5, 5.5, .35, 1.0)
        self.puff(x, y, rgb(255, 230, 120, 230), 1.0, 3.0, .25, .9)
        self.puff(x, y, rgb(60, 60, 60, 160), 1.5, 5.0, .8, 1.1)

    def update_items(self, dt):
        for b in self.boxes:
            if b['t'] > 0:
                b['t'] -= dt
                if b['t'] <= 0:
                    b['e'].enabled = True
            else:
                b['e'].rotation_z += 90 * dt
                for c in self.cars:
                    if c.item is None and not c.finished and (c.x - b['x']) ** 2 + (c.y - b['y']) ** 2 < 5.5:
                        c.item = random.choice(('oil', 'missile'))
                        c.item_t = random.uniform(1.5, 4)
                        b['t'] = 5.0
                        b['e'].enabled = False
                        if c is self.player:
                            play('pickup', .5)
                        break
        for o in self.oils[:]:
            o['t'] -= dt
            o['grace'] -= dt
            if o['t'] <= 0:
                kill(o['e'])
                self.oils.remove(o)
                continue
            for c in self.cars:
                if (c is o['owner'] and o['grace'] > 0) or c.spin > 0:
                    continue
                if (c.x - o['x']) ** 2 + (c.y - o['y']) ** 2 < 5.0 ** 2 * .75:
                    if c.spin_out(1.5) and c is self.player:
                        play('splat', .6)
        for m in self.missiles[:]:
            m['age'] += dt
            m['life'] -= dt
            tgt = m['target']
            if tgt is not None and not tgt.finished:
                want = math.atan2(tgt.x - m['x'], tgt.y - m['y'])
            else:
                f, cx, cy, d = self.trk.nearest(m['x'], m['y'], int(m['owner'].f))
                ti = (int(f) + 6) % self.trk.N
                want = math.atan2(self.trk.p[ti][0] - m['x'], self.trk.p[ti][1] - m['y'])
            m['h'] += clamp(wrap_angle(want - m['h']), -4 * dt, 4 * dt)
            m['x'] += math.sin(m['h']) * 64 * dt
            m['y'] += math.cos(m['h']) * 64 * dt
            e = m['e']
            e.x, e.y, e.rotation_z = m['x'], m['y'], math.degrees(m['h'])
            if int(m['age'] * 30) % 3 == 0:
                self.puff(m['x'] - math.sin(m['h']) * 1.6, m['y'] - math.cos(m['h']) * 1.6,
                          rgb(220, 220, 220, 150), .6, 2.2, .35, 1.4)
            hit = None
            for c in self.cars:
                if c is m['owner'] and m['age'] < .5:
                    continue
                if (c.x - m['x']) ** 2 + (c.y - m['y']) ** 2 < 2.6 ** 2:
                    hit = c
                    break
            if hit or m['life'] <= 0:
                if hit:
                    self.explode(m['x'], m['y'])
                    hit.imm = 0
                    hit.spin_out(1.4)
                    hit.hurt(10, 'missile')
                    hit.vx *= .35
                    hit.vy *= .35
                    play('crash', .6, 1.2)
                kill(e)
                self.missiles.remove(m)

    # ---- main per-car step -------------------------------------------------
    def drive(self, c, dt):
        trk = self.trk
        racing = self.state != 'countdown'
        if not racing:
            thr = steer = brk = 0
        elif c.ai or c.finished:
            thr, steer, brk = self.ai_control(c, dt)
            if not c.finished:
                self.ai_items(c, dt)
        else:
            thr = 1 if (held_keys['w'] or held_keys['up arrow']) else 0
            brk = 1 if (held_keys['s'] or held_keys['down arrow']) else 0
            steer = (held_keys['d'] or held_keys['right arrow']) - (held_keys['a'] or held_keys['left arrow'])
        if c.spin > 0:
            thr = steer = brk = 0
        c.step(dt, thr, steer, brk)
        # keep the car on the road: walls
        f, cx, cy, d = trk.nearest(c.x, c.y, int(c.f))
        lim = trk.half - .55
        if d > lim:
            nx, ny = (c.x - cx) / d, (c.y - cy) / d
            c.x, c.y = cx + nx * lim, cy + ny * lim
            vn = c.vx * nx + c.vy * ny
            if vn > 0:
                c.vx -= 1.3 * vn * nx
                c.vy -= 1.3 * vn * ny
                c.vx *= 1 - .9 * dt
                c.vy *= 1 - .9 * dt
                if vn > 6:
                    c.hurt((vn - 5) * .6)
                    if c is self.player:
                        play('crash', clamp(vn / 25, .2, .8), random.uniform(.9, 1.1))
                        self.shake = clamp(vn / 40, .1, .6)
                    for _ in range(2):
                        self.puff(c.x + nx * .6, c.y + ny * .6, rgb(255, 210, 90, 220), .5, 1.8, .3, 1.5)
        # lap progress
        if f - c.f < -trk.N / 2:
            c.lap += 1
            self.on_line(c)
        elif f - c.f > trk.N / 2:
            c.lap -= 1
        c.f = f
        # stuck?
        if racing and abs(c.vf) < 2.5 and c.spin <= 0 and (c.ai or c.finished):
            c.stuck += dt
            if c.stuck > 1.8:
                self.respawn(c)
        else:
            c.stuck = 0.0
        # effects
        if c.hp < c.maxhp * .35:
            c.smoke_t -= dt
            if c.smoke_t <= 0:
                c.smoke_t = .09 if c.hp <= 0 else .16
                self.puff(c.x - math.sin(c.h) * 1.5, c.y - math.cos(c.h) * 1.5,
                          rgb(40, 40, 40, 170) if c.hp <= 0 else rgb(150, 150, 150, 150), .8, 2.8, .7, 1.4)
        if abs(c.vl) > 4.5 or (c.spin > 0 and abs(c.vf) > 6):
            sh, chh = math.sin(c.h), math.cos(c.h)
            for sx in (-.7, .7):
                s = self.skids[self.skid_i % len(self.skids)]
                self.skid_i += 1
                s.enabled = True
                s.position = (c.x - sh * 1.2 + chh * sx, c.y - chh * 1.2 - sh * sx, 3.5)
                s.rotation_z = math.degrees(c.h)
        c.sync()

    def on_line(self, c):
        if c.lap > c.max_lap:
            c.max_lap = c.lap
            if c.lap >= 1:
                lt = self.t - c.lap_start
                c.last_lap = lt
                c.best_lap = lt if c.best_lap is None else min(c.best_lap, lt)
                c.lap_start = self.t
                if c is self.player and c.lap < self.laps:
                    self.t_msg.text = f'Lap {c.lap} done  {fmt_time(lt)}'
                    self.msg_t = 2.0
            if c.lap >= self.laps and not c.finished:
                c.finished = True
                c.fin_time = self.t
                self.finish_order.append(c)
                if c is self.player:
                    self.state = 'finished'
                    self.over_t = 3.0
                    self.t_big.text = 'FINISH!'

    # ---- per frame -------------------------------------------------------
    def update(self, dt):
        if self.paused:
            return
        dt = min(dt, 1 / 20)
        if self.state == 'countdown':
            self.cd -= dt
            n = math.ceil(self.cd)
            if n != self.last_cd:
                self.last_cd = n
                if n > 0:
                    self.t_big.text = str(n)
                    play('beep', .5)
                else:
                    self.t_big.text = 'GO!'
                    play('go', .6)
                    self.state = 'racing'
                    self.t = 0.0
                    self.go_t = 1.0
        else:
            self.t += dt
            if self.go_t > 0:
                self.go_t -= dt
                if self.go_t <= 0 and self.state == 'racing':
                    self.t_big.text = ''
        if self.msg_t > 0:
            self.msg_t -= dt
            if self.msg_t <= 0:
                self.t_msg.text = ''
        for c in self.cars:
            self.drive(c, dt)
        # car vs car
        cs = self.cars
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                a, b = cs[i], cs[j]
                dx, dy = a.x - b.x, a.y - b.y
                d2 = dx * dx + dy * dy
                if 1e-6 < d2 < 2.9 * 2.9:
                    d = math.sqrt(d2)
                    nx, ny = dx / d, dy / d
                    push = (2.9 - d) / 2
                    a.x += nx * push
                    a.y += ny * push
                    b.x -= nx * push
                    b.y -= ny * push
                    vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
                    if vn < 0:
                        j_ = -(1 + .35) * vn / 2
                        a.vx += j_ * nx
                        a.vy += j_ * ny
                        b.vx -= j_ * nx
                        b.vy -= j_ * ny
                        if -vn > 7:
                            a.hurt(-vn * .2, 'car')
                            b.hurt(-vn * .2, 'car')
                            if a is self.player or b is self.player:
                                play('crash', clamp(-vn / 30, .2, .6), 1.3)
                                self.shake = clamp(-vn / 50, .1, .4)
        self.update_items(dt)
        self.update_hud(dt)
        # camera follows the player
        p = self.player
        tx, ty = p.x + p.vx * .3, p.y + p.vy * .3
        k = min(1.0, 6 * dt)
        camera.x += (tx - camera.x) * k
        camera.y += (ty - camera.y) * k
        if self.shake > 0:
            self.shake = max(0.0, self.shake - dt * 2)
            camera.x += random.uniform(-1, 1) * self.shake
            camera.y += random.uniform(-1, 1) * self.shake
        if self.engine:
            self.engine.volume = .22
            self.engine.pitch = .6 + 1.5 * clamp(abs(p.vf) / p.spec['top'], 0, 1.1)
        if self.state == 'finished':
            self.over_t -= dt
            if self.over_t <= 0:
                self.state = 'over'
                self.game.race_finished(self)

    def update_hud(self, dt):
        p = self.player
        lap_n = clamp(p.lap + 1, 1, self.laps)
        self.t_lap.text = f'LAP {lap_n}/{self.laps}'
        self.t_pos.text = f'POS {self.rank_of(p)}/{len(self.cars)}'
        self.t_time.text = f'TIME {fmt_time(max(self.t, 0))}'
        saved = self.game.save.best.get(self.trk.spec['name'])
        cands = [v for v in (saved, p.best_lap) if v]
        self.t_best.text = 'BEST ' + (fmt_time(min(cands)) if cands else '--')
        self.t_last.text = 'LAST ' + (fmt_time(p.last_lap) if p.last_lap else '--')
        self.t_speed.text = f'{int(abs(p.vf) * 3.6)} km/h'
        frac = p.hp / p.maxhp
        self.hp_bar.scale_x = max(.001, .3 * frac)
        self.hp_bar.color = rgb(80, 220, 90) if frac > .5 else rgb(240, 200, 40) if frac > .25 else rgb(230, 60, 50)
        self.item_txt.text = {'oil': 'OIL SLICK\n[SPACE]', 'missile': 'MISSILE\n[SPACE]'}.get(p.item, '')
        self.item_box.color = rgb(0, 0, 0, 140) if not p.item else rgb(40, 60, 110, 220)
        for c, dot in zip(self.cars, self.dots):
            dot.x, dot.y = self.mm_pos(c)
        if p.hp <= 0 and not self.t_msg.text:
            self.t_msg.text = 'ENGINE DAMAGED - top speed halved'
            self.msg_t = 3.0

    def key(self, key):
        if key == 'escape':
            self.toggle_pause()
        if self.paused or self.state != 'racing':
            return
        if key in ('space', 'left shift', 'enter') and not self.player.ai and self.player.spin <= 0:
            self.use_item(self.player)
        if key == 'r':
            self.respawn(self.player)

    def toggle_pause(self):
        if self.state == 'over':
            return
        self.paused = not self.paused
        if self.paused:
            self.pause_ui = Entity(parent=camera.ui)
            quad(self.pause_ui, 0, 0, 2, 1.2, rgb(0, 0, 0, 170), -1)
            Text(parent=self.pause_ui, text='PAUSED', origin=(0, 0), position=(0, .2), scale=4, color=color.white)
            self.game.button(self.pause_ui, 'RESUME', (0, .02), (.3, .07), self.toggle_pause)
            self.game.button(self.pause_ui, 'QUIT TO MENU', (0, -.08), (.3, .07), self.game.quit_race)
            if self.engine:
                self.engine.volume = 0
        else:
            kill(self.pause_ui)
            self.pause_ui = None

    def cleanup(self):
        if self.engine:
            try:
                self.engine.stop()
                destroy(self.engine)
            except Exception:
                pass
        for e in (self.world, self.hud, self.pause_ui):
            if e:
                kill(e)


def fmt_time(t):
    m = int(t // 60)
    return f'{m}:{t - m * 60:05.2f}'


# ----------------------------------------------------------------------------
# Menus and game flow
# ----------------------------------------------------------------------------
class Game:
    def __init__(self):
        self.save = SaveData()
        self.ui = None
        self.race = None
        self.sel = dict(track=0, laps=3, diff=1)
        self.garage_i = self.save.selected
        self.garage_back = None
        camera.orthographic = True
        camera.fov = 46
        window.color = rgb(14, 16, 24)
        self.main_menu()

    # ---- widgets ---------------------------------------------------------
    def button(self, parent, label, pos, scale, cb, col=None):
        b = Button(parent=parent, text=label, position=pos, scale=scale,
                   color=col or rgb(36, 42, 62), highlight_color=rgb(70, 84, 130), pressed_color=rgb(50, 60, 100))
        b.on_click = cb or (lambda: None)
        return b

    def new_screen(self, title=None):
        if self.ui:
            kill(self.ui)
        self.garage_back = None
        self.ui = Entity(parent=camera.ui)
        quad(self.ui, 0, 0, 2.2, 1.3, rgb(14, 16, 24), 2)
        quad(self.ui, 0, -.5, 2.2, .26, rgb(46, 48, 54), 1.5)                  # road strip for flavour
        for i in range(-9, 10):
            quad(self.ui, i * .2, -.5, .1, .015, rgb(230, 230, 215), 1.4)
        if title:
            Text(parent=self.ui, text=title, origin=(0, 0), position=(0, .43), scale=3, color=rgb(255, 215, 60))
        Text(parent=self.ui, text=f'COINS  {self.save.coins}', origin=(.5, .5), position=(.86, .47),
             scale=1.6, color=rgb(255, 215, 60))
        return self.ui

    def car_preview(self, i, pos, scale, rot=0):
        e = make_car_visual(self.ui, CARS[i]['col'], i)
        e.position = (pos[0], pos[1], 0)
        e.scale = scale
        e.rotation_z = rot
        return e

    # ---- screens -----------------------------------------------------------
    def main_menu(self):
        camera.position = (0, 0, -30)
        ui = self.new_screen()
        Text(parent=ui, text='REDLINE', origin=(0, 0), position=(0, .33), scale=6, color=rgb(235, 60, 50))
        Text(parent=ui, text='R U S H', origin=(0, 0), position=(0, .23), scale=3.2, color=rgb(255, 235, 200))
        self.car_preview(self.save.selected, (.5, -.12), .12, 28)
        self.car_preview(min(11, self.save.selected + 3), (-.5, -.05), .1, -20)
        self.button(ui, 'RACE', (0, .06), (.32, .08), self.setup_screen, rgb(190, 40, 40))
        self.button(ui, 'GARAGE', (0, -.05), (.32, .08), lambda: self.garage_screen())
        self.button(ui, 'QUIT', (0, -.16), (.32, .08), application.quit)
        Text(parent=ui, text='WASD / arrows drive   SPACE item   R reset   ESC pause',
             origin=(0, 0), position=(0, -.34), scale=1.0, color=rgb(200, 200, 210))

    def setup_screen(self):
        ui = self.new_screen('CHOOSE YOUR RACE')
        s = self.sel
        track_btns, lap_btns, diff_btns = [], [], []

        def refresh():
            for i, b in enumerate(track_btns):
                b.color = rgb(190, 40, 40) if i == s['track'] else rgb(36, 42, 62)
            for v, b in lap_btns:
                b.color = rgb(190, 40, 40) if v == s['laps'] else rgb(36, 42, 62)
            for i, b in enumerate(diff_btns):
                b.color = rgb(190, 40, 40) if i == s['diff'] else rgb(36, 42, 62)

        for i, t in enumerate(TRACKS):
            x = (i - 1) * .4
            b = self.button(ui, f"{t['name']}\n{t['theme'].title()}", (x, .22), (.36, .22), None)
            b.on_click = (lambda i=i: (s.__setitem__('track', i), refresh()))
            track_btns.append(b)
            best = self.save.best.get(t['name'])
            Text(parent=ui, text='Best ' + (fmt_time(best) if best else '--'), origin=(0, 0),
                 position=(x, .08), scale=1.0, color=rgb(190, 220, 255))
        Text(parent=ui, text='LAPS', origin=(0, 0), position=(-.42, -.04), scale=1.4, color=color.white)
        for k, v in enumerate(LAP_CHOICES):
            b = self.button(ui, str(v), (-.2 + k * .1, -.04), (.08, .07), None)
            b.on_click = (lambda v=v: (s.__setitem__('laps', v), refresh()))
            lap_btns.append((v, b))
        Text(parent=ui, text='AI SKILL', origin=(0, 0), position=(-.42, -.14), scale=1.4, color=color.white)
        for k, (nm, _, _) in enumerate(DIFFS):
            b = self.button(ui, nm, (-.15 + k * .21, -.14), (.19, .07), None)
            b.on_click = (lambda k=k: (s.__setitem__('diff', k), refresh()))
            diff_btns.append(b)
        c = CARS[self.save.selected]
        Text(parent=ui, text=f"Your car: {c['name']}", origin=(0, 0), position=(0, -.24), scale=1.3,
             color=rgb(255, 215, 60))
        self.button(ui, 'START RACE', (0, -.34), (.34, .08), self.start_race, rgb(40, 150, 70))
        self.button(ui, 'BACK', (-.7, -.42), (.16, .06), self.main_menu)
        self.button(ui, 'GARAGE', (.7, -.42), (.16, .06), lambda: self.garage_screen(back=self.setup_screen))
        refresh()

    def garage_screen(self, back=None):
        back = back or self.garage_back or self.main_menu
        ui = self.new_screen('GARAGE')
        self.garage_back = back
        i = self.garage_i
        c = CARS[i]
        owned = i in self.save.owned
        self.car_preview(i, (0, .1), .1, 0)
        Text(parent=ui, text=c['name'].upper(), origin=(0, 0), position=(0, .31), scale=2.4, color=color.white)
        stats = {'Top speed': (c['top'], 50), 'Acceleration': (c['accel'], 28),
                 'Handling': (c['handling'], 1.25), 'Armour': (c['hp'], 140)}
        for k, (lab, (v, mx)) in enumerate(stats.items()):
            y = .2 - k * .075
            Text(parent=ui, text=lab, origin=(-.5, 0), position=(.2, y + .028), scale=1.0, color=rgb(200, 200, 210))
            quad(ui, .36, y - .015, .26, .02, rgb(40, 44, 60), 0)
            Entity(parent=ui, model='quad', origin=(-.5, 0), position=(.23, y - .015, -.1),
                   scale=(.26 * v / mx, .02), color=rgb(255, 170, 40))
        if owned:
            if self.save.selected == i:
                self.button(ui, 'SELECTED', (0, -.27), (.34, .08), None, rgb(40, 110, 60))
            else:
                self.button(ui, 'SELECT', (0, -.27), (.34, .08), lambda: self.garage_select(i), rgb(40, 150, 70))
        else:
            afford = self.save.coins >= c['price']
            self.button(ui, f"BUY  -  {c['price']} coins", (0, -.27), (.34, .08), lambda: self.garage_buy(i),
                        rgb(190, 140, 20) if afford else rgb(80, 60, 60))
            Text(parent=ui, text='Not enough coins' if not afford else 'You can afford this!', origin=(0, 0),
                 position=(0, -.2), scale=1.1, color=rgb(255, 120, 100) if not afford else rgb(120, 255, 140))
        Text(parent=ui, text=f'{i + 1} / {len(CARS)}', origin=(0, 0), position=(0, -.16), scale=1.0,
             color=rgb(180, 180, 190))
        self.button(ui, 'PREV', (-.38, .1), (.12, .1), lambda: self.garage_move(-1))
        self.button(ui, 'NEXT', (.38, .1), (.12, .1), lambda: self.garage_move(1))
        self.button(ui, 'BACK', (-.7, -.42), (.16, .06), back)

    def garage_move(self, d):
        self.garage_i = (self.garage_i + d) % len(CARS)
        self.garage_screen(self.garage_back)

    def garage_select(self, i):
        self.save.selected = i
        self.save.save()
        self.garage_screen(self.garage_back)

    def garage_buy(self, i):
        price = CARS[i]['price']
        if self.save.coins >= price and i not in self.save.owned:
            self.save.coins -= price
            self.save.owned.append(i)
            self.save.selected = i
            self.save.save()
            play('cash', .6)
        self.garage_screen(self.garage_back)

    def start_race(self):
        if self.ui:
            kill(self.ui)
            self.ui = None
        s = self.sel
        self.race = Race(self, s['track'], s['laps'], s['diff'], self.save.selected)

    def quit_race(self):
        if self.race:
            self.race.cleanup()
            self.race = None
        self.main_menu()

    def race_finished(self, race):
        p = race.player
        place = race.rank_of(p)
        earned = PLACE_COINS[min(place, len(PLACE_COINS)) - 1]
        self.save.coins += earned
        name = race.trk.spec['name']
        if p.best_lap and (name not in self.save.best or p.best_lap < self.save.best[name]):
            self.save.best[name] = p.best_lap
        self.save.save()
        order = sorted(race.cars, key=lambda c: race.rank_of(c))
        rows = [(race.rank_of(c), c.name, c.spec['name'], c is p, c.fin_time if c.finished else None)
                for c in order]
        best_lap = p.best_lap
        race.cleanup()
        self.race = None
        camera.position = (0, 0, -30)
        self.results_screen(rows, place, earned, best_lap)

    def results_screen(self, rows, place, earned, best_lap):
        ui = self.new_screen('RACE RESULTS')
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(place, 'th')
        Text(parent=ui, text=f'You finished {place}{suffix}!', origin=(0, 0), position=(0, .35), scale=2.2,
             color=rgb(255, 235, 120) if place <= 3 else color.white)
        Text(parent=ui, text=f'+{earned} coins' + (f'     best lap {fmt_time(best_lap)}' if best_lap else ''),
             origin=(0, 0), position=(0, .29), scale=1.4, color=rgb(120, 255, 150))
        for k, (pl, nm, car, me, ft) in enumerate(rows):
            y = .2 - k * .06
            if me:
                quad(ui, 0, y, .9, .05, rgb(60, 80, 140, 200), 1)
            col = rgb(255, 235, 120) if me else color.white
            Text(parent=ui, text=f'{pl}', origin=(0, 0), position=(-.38, y), scale=1.3, color=col)
            Text(parent=ui, text=f'{nm}', origin=(-.5, 0), position=(-.3, y), scale=1.3, color=col)
            Text(parent=ui, text=car, origin=(-.5, 0), position=(-.05, y), scale=1.1, color=rgb(190, 190, 205))
            Text(parent=ui, text=fmt_time(ft) if ft else 'racing', origin=(.5, 0), position=(.4, y), scale=1.2,
                 color=col)
        self.button(ui, 'RACE AGAIN', (-.3, -.26), (.28, .07), self.start_race, rgb(40, 150, 70))
        self.button(ui, 'GARAGE', (0, -.26), (.22, .07), lambda: self.garage_screen(back=self.main_menu))
        self.button(ui, 'MENU', (.28, -.26), (.2, .07), self.main_menu)
        play('cash', .5)

    # ---- per frame -------------------------------------------------------
    def update(self, dt):
        if self.race:
            self.race.update(dt)

    def key(self, key):
        if self.race:
            self.race.key(key)
        elif self.garage_back and key in ('left arrow', 'right arrow'):
            self.garage_move(-1 if key == 'left arrow' else 1)


game = None


def update():
    if game and not TEST:
        game.update(min(time.dt, 1 / 20))


def input(key):  # noqa: A001  (Ursina looks for this name)
    if game:
        game.key(key)


# ----------------------------------------------------------------------------
# Self test (python main.py --selftest): headless race with an AI-driven player
# ----------------------------------------------------------------------------
def selftest():
    import os
    from panda3d.core import Filename
    out = Path(os.environ.get('RR_SHOTS', '/tmp'))

    def shot(name):
        if not base.win.get_gsg():
            return
        base.graphicsEngine.render_frame()
        base.graphicsEngine.render_frame()
        base.win.save_screenshot(Filename.from_os_specific(str(out / f'{name}.png')))

    for spec in TRACKS:
        trk = TrackData(spec)
        mind = 1e9
        for i in range(0, trk.N, 3):
            for j in range(i + 40, trk.N, 3):
                if min(j - i, trk.N - (j - i)) < 40:
                    continue
                mind = min(mind, math.hypot(trk.p[i][0] - trk.p[j][0], trk.p[i][1] - trk.p[j][1]))
        print(f"{spec['name']}: length {trk.length:.0f}  N={trk.N}  min radius {1 / max(trk.curv):.1f}  "
              f"closest approach {mind:.1f} (road width {spec['width']})")
    for tr in range(len(TRACKS)):
        race = Race(game, tr, 2, 2, 11, player_ai=True)
        game.race = race
        frames = 0
        while race.state != 'over' and frames < 60 * 300:
            race.update(1 / 60)
            frames += 1
            if tr == 0 and frames in (30, 400, 900):
                if frames == 400:
                    race.player.item = 'missile'
                    race.use_item(race.player)
                    race.player.item = 'oil'
                shot(f'race_{frames}')
        order = [(c.name, c.spec['name'], c.lap, round(c.hp), {k: round(v) for k, v in c.dmg.items()}) for c in sorted(race.cars, key=race.rank_of)]
        print(f"track {tr}: state={race.state} t={race.t:.1f}s best lap={race.player.best_lap}")
        print('   order:', order)
        if race.state != 'over':
            race.cleanup()
        game.race = None
    for name, fn in (('menu', game.main_menu), ('setup', game.setup_screen), ('garage', game.garage_screen)):
        fn()
        shot(name)


if __name__ == '__main__':
    app = Ursina(title='Redline Rush', borderless=False, size=(1280, 720),
                 window_type='onscreen', development_mode=False)
    window.fps_counter.enabled = False
    window.exit_button.visible = False
    load_sounds()
    game = Game()
    if TEST:
        selftest()
        sys.exit(0)
    app.run()
