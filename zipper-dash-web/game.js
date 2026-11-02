// Zipper Dash: a super-fast running and rolling game with 4 zones and 12 acts.
// Zipper the armadillo races through Wavy Cave, Spooky Cave, the Plains and the Jungle,
// curls up into a ball to bash enemies, rides loops and springs, and beats a boss in every zone.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const SEG = 16;               // the ground is made of columns 16 game pixels wide
const VIEW_H = 300;           // how many game pixels tall the screen is
const GRAVITY = 1000;         // how hard things fall
const JUMP = 430;             // jump power
const JUMP_CUT = 230;         // let go of jump early and you stop going up this fast (small jumps)
const ACCEL = 420;            // how quickly Zipper speeds up when running
const AIR_ACCEL = 520;        // ...and how quickly you can steer in the air
const BRAKE = 1600;           // how quickly you stop when you push the other way
const FRICTION = 520;         // how quickly you slow down when you let go
const TOP_RUN = 380;          // the fastest you can run with your own legs
const TOP_SPEED = 950;        // the fastest you can ever go (rolling downhill, speed pads)
const ROLL_FRICTION = 90;     // rolling hardly slows down at all
const SLOPE_WALK = 480;       // how much hills push you when you're running
const SLOPE_ROLL_DOWN = 1400; // ...and when you're rolling downhill (wheee!)
const SLOPE_ROLL_UP = 650;    // ...and rolling uphill
const LOOP_MIN = 320;         // how fast you need to go to run around a loop
const SPRING_POWER = 650;
const PAD_SPEED = 760;        // speed pads shoot you this fast
const START_LIVES = 5;
const MAX_HEARTS = 3;
const SEEDS_FOR_LIFE = 100;
const BOSS_HP = [5, 6, 7, 8];
const PIT = 3000;             // a pit is just ground that is very, very deep
const POOL_Y = 545;           // the water (or goo) at the bottom of the pits
const DEATH_Y = 580;          // fall below this and you lose a life
const HALF_W = 9;             // half of Zipper's width
const WALL = 40;              // a step taller than this between two columns is a wall, not a slope
const SAVE_KEY = "zipperdash-save";
const STEP = 1 / 120;         // the game moves in tiny steps, so fast Zipper never skips through things

// ---------- 2. the 4 zones ----------
const ZONES = [
  { name: "Wavy Cave", key: "wavy", cave: true, boss: "charger", bossName: "King Pinch the Crab",
    sky: ["#06283f", "#13698c"], top: "#62e3cf", dirt: "#2f7894", dirt2: "#24607a", dirt3: "#1b4a60",
    ceil: "#0f3347", ceilEdge: "#2b7c96", pool: "#2fb3e0", plat: "#3e93b0",
    weights: { hills: 5, flat: 2, gap: 2, plats: 2, cliff: 1, loop: 1, down: 2, spikes: 1 },
    foes: ["crawler", "crawler", "flier", "hopper", "spiky"] },
  { name: "Spooky Cave", key: "spooky", cave: true, boss: "flier", bossName: "Lady Lantern",
    sky: ["#0d0718", "#2c1640"], top: "#9be05a", dirt: "#4b3466", dirt2: "#3a2852", dirt3: "#2a1c3d",
    ceil: "#1a0f28", ceilEdge: "#4b3466", pool: "#56d16a", plat: "#6a5a80",
    weights: { flat: 3, gap: 2, plats: 3, spikes: 3, cliff: 2, hills: 2, down: 1 },
    foes: ["crawler", "flier", "flier", "spiky", "hopper"] },
  { name: "Plains", key: "plains", cave: false, boss: "charger", bossName: "Rumble the Ram",
    sky: ["#3fa8f0", "#c9efff"], top: "#5fcf4a", dirt: "#c98a4a", dirt2: "#a96f36", dirt3: "#8a5728",
    pool: "#3b8fd9", plat: "#7bc65a",
    weights: { hills: 4, loop: 2, down: 2, flat: 2, gap: 2, cliff: 1, spikes: 1, plats: 1 },
    foes: ["crawler", "flier", "hopper", "spiky"] },
  { name: "Jungle", key: "jungle", cave: false, boss: "flier", bossName: "Captain Beak",
    sky: ["#1f6b3a", "#9fdc8a"], top: "#3fbf3f", dirt: "#6b4a2a", dirt2: "#573b20", dirt3: "#432d18",
    pool: "#4a7a3a", plat: "#8a5a32",
    weights: { hills: 2, gap: 3, plats: 3, cliff: 2, loop: 1, down: 2, spikes: 2, flat: 1 },
    foes: ["crawler", "flier", "hopper", "hopper", "spiky"] },
];
const ACT_NAMES = ["Act 1", "Act 2", "Boss"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toward0 = (v, amount) => (v > 0 ? Math.max(0, v - amount) : Math.min(0, v + amount));
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
// a number between 0 and 1 that is always the same for the same k (for placing flowers and rocks)
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// a "seeded" random number maker: the same seed always gives the same numbers,
// so Plains Act 1 is the same level every time you play it.
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 3. building a level ----------
// The ground is a list of heights, one for every column. Smooth changes are hills and slopes,
// big jumps are walls and cliffs, and PIT means there's no ground at all.
function buildLevel(n) {
  const zi = Math.floor(n / 3), act = n % 3, zone = ZONES[zi];
  const isBoss = act === 2;
  const rand = makeRng(n * 9973 + 77);
  const r = (a, b) => a + Math.floor(rand() * (b - a + 1));   // a random whole number from a to b
  const chance = q => rand() < q;
  const pick = list => list[Math.floor(rand() * list.length)];
  const hard = n / 11;                 // 0 on the first level, 1 on the last one
  const H = [];
  const L = { n, zi, act, zone, isBoss, H, C: null, seeds: [], items: [], foes: [], springs: [], pads: [],
    spikes: [], loops: [], plats: [], posts: [], goalX: null, arena: null, boss: null, time: 0 };
  let h = 380;                         // the height of the ground we're building right now
  let gaveLife = false;
  const col = () => H.length;
  const at = c => c * SEG + SEG / 2;   // the middle of column c, in pixels
  const flat = k => { for (let i = 0; i < k; i++) H.push(h); };
  const seed = (x, y) => L.seeds.push({ x, y, got: false });
  const seedRow = (c, count, up = 34) => {
    for (let i = 0; i < count; i++) {
      const x = at(c) + i * 20, gy = H[Math.floor(x / SEG)];
      if (gy !== undefined && gy < PIT) seed(x, gy - up);
    }
  };
  const seedArc = (x0, y0, x1, y1, lift, count) => {
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      seed(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * lift);
    }
  };
  const foeKinds = n === 0 ? ["crawler", "flier"] : zone.foes;
  const foeMax = 1 + Math.round(hard * 2);
  function foes(c0, span) {
    const count = r(n === 0 ? 0 : 1, foeMax);
    for (let i = 0; i < count; i++) {
      const c = c0 + r(0, Math.max(0, span - 1));
      if (H[c] === undefined || H[c] >= PIT) continue;
      const kind = pick(foeKinds);
      L.foes.push(makeFoe(kind, at(c), kind === "flier" ? H[c] - r(34, 60) : H[c]));
    }
  }

  // the pieces. Each one adds some columns to the end of the level.
  const pieces = {
    flat() {
      const s = col(), k = r(8, 14);
      flat(k);
      if (chance(0.55)) seedRow(s + 2, r(3, 6));
      if (chance(0.12)) L.items.push({ kind: "berry", x: at(s + k - 3), y: h - 40, got: false });
      foes(s + 3, k - 4);
    },
    hills() {
      const s = col();
      for (let w = r(1, 3); w > 0; w--) {
        const len = r(14, 26), base = h;
        let amp = r(16, 44) * (chance(0.55) ? -1 : 1);       // minus = a hill, plus = a dip
        if (base + amp > 470 || base + amp < 200) amp = -amp;
        for (let i = 1; i <= len; i++) H.push(Math.round(base + amp * (1 - Math.cos(2 * Math.PI * i / len)) / 2));
        if (amp < 0 && chance(0.6)) seedArc(at(col() - len + 2), base - 30, at(col() - 2), base - 30, -amp, 5);
      }
      foes(s + 2, col() - s - 4);
    },
    down() {
      const goUp = h > 400 || (h > 300 && chance(0.3));
      let D = r(60, 120) * (goUp ? -1 : 1);
      if (h + D > 470) D = 470 - h;
      flat(3);
      if (!goUp) L.pads.push({ x: at(col() - 2), y: h, t: 0 });
      const k = Math.max(6, Math.round(Math.abs(D) / 8)), base = h;
      for (let i = 1; i <= k; i++) H.push(Math.round(base + D * (1 - Math.cos(Math.PI * i / k)) / 2));
      h = base + D;
      for (let i = 1; i < 5; i++) { const c = col() - k + Math.round(i * k / 5); seed(at(c), H[c] - 26); }
      flat(4);
    },
    gap() {
      flat(r(3, 5));
      if (chance(0.5)) for (let i = 0; i < 4; i++) { h -= 6; H.push(h); }   // a little ramp
      const s = col(), w = r(3, 4 + Math.round(hard * 3)), y0 = h;
      for (let i = 0; i < w; i++) H.push(PIT);
      h = clamp(h + r(-16, 40), 200, 470);
      flat(r(5, 7));
      seedArc(at(s - 1), y0 - 30, at(s + w), h - 30, 50, Math.min(7, w + 2));
    },
    plats() {
      flat(3);
      const s = col(), w = r(12, 18);
      for (let i = 0; i < w; i++) H.push(PIT);
      let c = s + 1;
      while (c + 3 <= s + w - 1) {
        const y = h - r(8, 56);
        const move = chance(0.2 + hard * 0.35) ? (chance(0.5) ? "side" : "updown") : null;
        L.plats.push(makePlat(c * SEG, y, 48, move, rand() * 6));
        for (let i = 0; i < 3; i++) seed(c * SEG + 8 + i * 16, y - 26);
        c += 3 + r(2, 3);
      }
      flat(r(5, 7));
    },
    cliff() {
      if (h - 130 >= 200 && chance(0.65)) {
        flat(4);
        L.springs.push({ x: at(col() - 1) - 10, y: h, t: 0 });   // right against the wall
        const s = col();
        h -= r(80, 128);
        flat(r(8, 12));
        seedRow(s + 2, 4);
        if (act === 1 && !gaveLife) { L.items.push({ kind: "life", x: at(s + 6), y: h - 40, got: false }); gaveLife = true; }
        foes(s + 4, 4);
      } else {
        flat(4);
        const nh = Math.min(470, h + r(64, 110));
        if (nh - h >= 48) h = nh;
        flat(r(6, 9));
      }
    },
    spikes() {
      flat(4);
      const s = col(), w = r(2, 3);
      flat(10);
      L.spikes.push({ x: (s + 3) * SEG, y: h, w: w * SEG });
      seedArc(at(s + 1), h - 30, at(s + 4 + w), h - 30, 46, 5);
    },
    loop() {
      flat(4);
      L.pads.push({ x: at(col() - 2), y: h, t: 0 });
      flat(4);
      const s = col();
      flat(18);
      const lp = { cx: (s + 9) * SEG, gy: h, r: 64, ready: true };
      L.loops.push(lp);
      for (let i = 1; i < 12; i++) {
        const th = i / 12 * Math.PI * 2;
        seed(lp.cx + (lp.r - 16) * Math.sin(th), lp.gy - lp.r + (lp.r - 16) * Math.cos(th));
      }
      flat(4);
    },
  };

  flat(18);
  const target = isBoss ? 150 : 430 + zi * 50 + act * 70;
  const weights = isBoss ? { flat: 3, hills: 3, gap: 1, spikes: 1, down: 1 } : zone.weights;
  const names = Object.keys(weights);
  const postCount = isBoss ? 0 : 2;
  let last = "", calm = 0;
  while (col() < target) {
    if (L.posts.length < postCount && col() > target * (L.posts.length + 1) / (postCount + 1)) {
      flat(2); L.posts.push({ x: at(col() - 1), y: h, lit: false }); flat(2);
    }
    let name = names[names.length - 1];
    if (calm > 0) {
      // just after a speed pad you're going super fast, so no pits or spikes for a little while
      name = chance(0.5) ? "hills" : "flat";
      calm--;
    } else {
      do {
        let roll = rand() * names.reduce((sum, k) => sum + weights[k], 0);
        for (const k of names) { roll -= weights[k]; if (roll < 0) { name = k; break; } }
      } while (name === last && (name === "loop" || name === "cliff" || name === "plats"));
    }
    pieces[name]();
    if (name === "down" || name === "loop") calm = 2;
    else if (name !== "flat" && name !== "hills") calm = 1;   // somewhere safe to land after every danger
    last = name;
  }

  if (isBoss) {
    flat(10);
    L.posts.push({ x: at(col() - 5), y: h, lit: false });
    const a0 = col(); flat(34);
    const a1 = col(); flat(14);
    L.arena = { x0: a0 * SEG, x1: a1 * SEG, gy: h };
    L.boss = makeBoss(zone.boss, zi, L.arena);
  } else {
    flat(12);
    L.goalX = at(col());
    flat(40);
  }
  L.width = H.length * SEG;

  // caves have a bumpy ceiling, always well above the highest ground nearby
  if (zone.cave) {
    L.C = new Float32Array(H.length);
    for (let i = 0; i < H.length; i++) {
      let m = Infinity;
      for (let j = i - 8; j <= i + 8; j++) if (H[j] !== undefined && H[j] < m) m = H[j];
      if (m >= PIT) m = 380;
      L.C[i] = m - 235 + Math.sin(i * 0.31) * 12 + Math.sin(i * 0.13) * 16;
    }
  }
  return L;
}

function makePlat(x, y, w, move, phase) {
  return { x, y, w, bx: x, by: y, move, t: phase, dx: 0, dy: 0, prevY: y };
}
function makeFoe(kind, x, y) {
  return { kind, x, y, homeX: x, homeY: y, dir: -1, vy: 0, t: Math.random() * 6, alive: true, onGround: true, wait: 1 };
}
function makeBoss(kind, zi, a) {
  const b = { kind, zi, hp: BOSS_HP[zi], maxHp: BOSS_HP[zi], x: a.x1 - 90, y: a.gy, state: "wait", t: 1.5, clk: 0,
    dir: -1, flash: 0, active: false, dead: false, vy: 0, dropT: 2, swoopT: 3, tx: 0 };
  if (kind === "flier") { b.x = (a.x0 + a.x1) / 2; b.y = a.gy - 150; b.state = "hover"; }
  b.homeX = b.x; b.homeY = b.y;
  return b;
}

// ---------- 4. saving: which levels you've unlocked, and your best times ----------
let save = loadSave();
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.unlocked === "number") return { unlocked: s.unlocked, best: s.best || {} };
  } catch (e) { /* no save yet */ }
  return { unlocked: 0, best: {} };
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* the game still works without saving */ }
}

// ---------- 5. the game's state ----------
const $ = id => document.getElementById(id);
const canvas = $("view"), ctx = canvas.getContext("2d");
let scale = 1;
const cam = { x: 0, y: 0, w: 480, h: 300, shake: 0 };
let level = null, p = null;
let fx = [], shots = [];
let clock = 0, jumpBuf = 0;
const keys = { left: false, right: false, down: false, jump: false };
const game = { state: "menu", n: 0, lives: START_LIVES, score: 0, hearts: MAX_HEARTS, seedBank: 0,
  levelSeeds: 0, respawnX: 64, dyingT: 0, goalT: 0, pausedFrom: "play" };

// ---------- 6. the ground: heights, slopes and walls ----------
function hAt(i) {
  const H = level.H;
  return H[clamp(i, 0, H.length - 1)];
}
function groundY(x) {
  const i = Math.floor(x / SEG), t = x / SEG - i;
  const a = hAt(i), b = hAt(i + 1);
  if (Math.abs(b - a) > WALL) return t < 0.5 ? a : b;   // walls stand straight up in the middle
  return a + (b - a) * t;
}
function slopeAt(x) {
  const i = Math.floor(x / SEG), a = hAt(i), b = hAt(i + 1);
  return Math.abs(b - a) > WALL ? 0 : Math.atan2(b - a, SEG);
}
function ceilY(x) { return level.C[clamp(Math.floor(x / SEG), 0, level.C.length - 1)]; }

// Moving sideways from x0 to x1 with feet at y: is there a wall in the way? Returns where you end up.
function blockX(x0, x1, y) {
  if (x1 < HALF_W) return HALF_W;
  if (x1 > level.width - HALF_W) return level.width - HALF_W;
  const d = Math.sign(x1 - x0);
  if (!d) return x1;
  const e0 = x0 + d * HALF_W, e1 = x1 + d * HALF_W;       // the front edge of Zipper's body
  const i0 = Math.floor(Math.min(e0, e1) / SEG) - 1, i1 = Math.floor(Math.max(e0, e1) / SEG);
  for (let k = 0; k <= i1 - i0; k++) {
    const i = d > 0 ? i0 + k : i1 - k;
    const a = hAt(i), b = hAt(i + 1);
    if (Math.abs(b - a) <= WALL) continue;
    const xw = i * SEG + SEG / 2;
    const crosses = d > 0 ? e0 <= xw + 0.001 && xw < e1 : e1 < xw && xw <= e0 + 0.001;
    if (crosses && y > (d > 0 ? b : a) + 1) { wallTop = d > 0 ? b : a; return xw - d * (HALF_W + 0.01); }
  }
  return x1;
}
let wallTop = 0;   // blockX remembers the top of the last wall it found here

// ---------- 7. Zipper ----------
function makePlayer(x) {
  return { x, y: groundY(x), vx: 0, vy: 0, gs: 0, on: "ground", angle: 0, face: 1,
    ball: false, rolling: false, crouch: false, jumping: false, spring: false, hurt: false,
    inv: 0, loop: null, theta: 0, run: 0, spin: 0, trail: [], trailT: 0 };
}
function inputDir() {
  if (game.state === "goal") return 1;
  if (p.hurt) return 0;
  return (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
}
// the middle of Zipper's body (feet are at p.x, p.y, and Zipper leans with the ground)
function playerCenter() { return { x: p.x + Math.sin(p.angle) * 12, y: p.y - Math.cos(p.angle) * 12 }; }
function playerBox() {
  const c = playerCenter(), hh = p.ball ? 11 : 12;
  return { x0: c.x - HALF_W, x1: c.x + HALF_W, y0: c.y - hh, y1: c.y + hh };
}

function updatePlayer(dt) {
  const input = inputDir();
  if (p.loop) updateLoop(dt);
  else if (p.on) groundMove(dt, input);
  else airMove(dt, input);
  for (const lp of level.loops) if (!lp.ready && Math.abs(p.x - lp.cx) > lp.r + 30) lp.ready = true;
  const speed = p.on ? p.gs : p.vx;
  if (p.ball) p.spin += (Math.abs(speed) / 11 + (p.on ? 0 : 12)) * dt;
  p.run += (Math.abs(speed) * 0.06 + 1) * dt;
  if (!p.on) p.angle -= p.angle * Math.min(1, dt * 10);
  p.inv = Math.max(0, p.inv - dt);
  // speedy after-images
  p.trailT -= dt;
  if (p.trailT <= 0) {
    p.trailT = 0.03;
    if (Math.abs(speed) > 480) p.trail.push({ x: p.x, y: p.y, angle: p.angle, ball: p.ball, spin: p.spin, run: p.run, face: p.face });
    if (p.trail.length > 5 || (p.trail.length && Math.abs(speed) <= 480)) p.trail.shift();
  }
  if (p.y > DEATH_Y) { splash(p.x); killPlayer(); }
}

function groundMove(dt, input) {
  const plat = p.on === "ground" ? null : p.on;
  const a = plat ? 0 : slopeAt(p.x);
  const sa = Math.sin(a), ca = Math.cos(a);
  const playing = game.state === "play";
  if (jumpBuf > 0 && playing) {
    jumpBuf = 0;
    p.vx = p.gs * ca + (plat ? plat.dx / STEP : 0);
    p.vy = p.gs * sa - JUMP;
    p.on = null; p.ball = true; p.rolling = false; p.crouch = false; p.jumping = true;
    sfx.jump();
    return;
  }
  if (keys.down && playing && !p.rolling && Math.abs(p.gs) > 80) { p.rolling = true; p.ball = true; sfx.roll(); }
  p.crouch = keys.down && playing && !p.rolling && Math.abs(p.gs) <= 80;

  if (p.rolling) {
    const downhill = Math.sign(p.gs) === Math.sign(sa);
    p.gs += sa * (downhill ? SLOPE_ROLL_DOWN : SLOPE_ROLL_UP) * dt;
    p.gs = toward0(p.gs, ROLL_FRICTION * dt);
    if (input && input * p.gs < 0) p.gs = toward0(p.gs, 500 * dt);
    if (Math.abs(p.gs) < 40 && Math.abs(sa) < 0.15) { p.rolling = false; p.ball = false; }
  } else {
    p.gs += sa * SLOPE_WALK * dt;
    if (input && !p.crouch) {
      if (input * p.gs < 0) p.gs += input * BRAKE * dt;
      else if (Math.abs(p.gs) < TOP_RUN) p.gs = clamp(p.gs + input * ACCEL * dt, -TOP_RUN, TOP_RUN);
      p.face = input;
    } else {
      p.gs = toward0(p.gs, FRICTION * dt);
      if (Math.abs(p.gs) > 20) p.face = Math.sign(p.gs);
    }
    if (Math.abs(p.gs) > TOP_RUN) p.gs = toward0(p.gs, 140 * dt);   // speed from a pad wears off slowly
    p.ball = false;
  }
  p.gs = clamp(p.gs, -TOP_SPEED, TOP_SPEED);

  if (plat) {
    const want = p.x + plat.dx + p.gs * dt;
    const nx = blockX(p.x, want, p.y);
    if (nx !== want) p.gs = 0;
    p.x = nx; p.y = plat.y; p.angle = 0;
    if (p.x < plat.x - 6 || p.x > plat.x + plat.w + 6) { p.on = null; p.vx = p.gs + plat.dx / dt; p.vy = Math.max(0, plat.dy / dt); }
    return;
  }

  const dx = p.gs * ca * dt;
  let nx = p.x + dx;
  const bx = blockX(p.x, nx, p.y);
  if (bx !== nx) { nx = bx; p.gs = 0; }
  // fast enough to run into a loop?
  if (p.gs >= LOOP_MIN) {
    for (const lp of level.loops) {
      if (lp.ready && p.x < lp.cx && nx >= lp.cx) { p.loop = lp; p.theta = 0; p.x = lp.cx; p.y = lp.gy; return; }
    }
  }
  const na = slopeAt(nx), ny = groundY(nx), d = Math.sign(p.gs);
  // going over the top of a bump super fast (faster than running) throws you into the air
  const bend = (na - a) * d;
  if (bend > 0.02 && Math.abs(p.gs) > TOP_RUN + 20 && p.gs * p.gs * bend / SEG > GRAVITY * ca * 1.3) { leaveGround(nx, a); return; }
  // the ground drops away (a cliff, or the edge of a pit)
  if (ny - p.y > Math.abs(dx) * 1.5 + 3) { leaveGround(nx, a); return; }
  p.x = nx; p.y = ny; p.angle = na;
}
function leaveGround(nx, a) {
  p.on = null;
  p.vx = p.gs * Math.cos(a);
  p.vy = p.gs * Math.sin(a);
  p.x = nx;
}

// Running round a loop: Zipper follows a circle. Going up slows you down, coming down speeds you up.
function updateLoop(dt) {
  const lp = p.loop;
  p.gs = Math.max(260, p.gs - GRAVITY * 0.5 * Math.sin(p.theta) * dt);
  p.theta += p.gs / lp.r * dt;
  if (p.theta >= Math.PI * 2) { p.loop = null; lp.ready = false; p.x = lp.cx + 1; p.y = lp.gy; p.angle = 0; return; }
  p.x = lp.cx + lp.r * Math.sin(p.theta);
  p.y = lp.gy - lp.r + lp.r * Math.cos(p.theta);
  p.angle = -p.theta;
}

function airMove(dt, input) {
  if (p.jumping && !keys.jump && p.vy < -JUMP_CUT) p.vy = -JUMP_CUT;
  if (input) {
    if (input * p.vx < TOP_RUN) p.vx += input * AIR_ACCEL * dt;
    p.face = input;
  }
  p.vy = Math.min(p.vy + GRAVITY * dt, 900);
  const nx = p.x + p.vx * dt;
  const bx = blockX(p.x, nx, p.y);
  if (bx === nx) p.x = nx;
  else if (p.y - wallTop <= 16) { p.x = nx; p.y = wallTop; }   // only just missed the ledge? hop up onto it
  else { p.x = bx; p.vx = 0; }
  const prevY = p.y;
  p.y += p.vy * dt;
  if (level.C) {
    const c = ceilY(p.x) + 24;
    if (p.y < c) { p.y = c; if (p.vy < 0) p.vy = 0; }
  }
  if (p.vy >= 0) {
    for (const pl of level.plats) {
      if (p.x > pl.x - 6 && p.x < pl.x + pl.w + 6 && prevY <= pl.prevY + 0.5 && p.y >= pl.y) {
        p.y = pl.y; p.on = pl; p.gs = p.vx - pl.dx / dt; p.angle = 0;
        land();
        return;
      }
    }
  }
  const g = groundY(p.x);
  if (p.y >= g) {
    const a = slopeAt(p.x);
    p.y = g; p.on = "ground"; p.angle = a;
    p.gs = p.vx * Math.cos(a) + p.vy * Math.sin(a);   // a steep landing turns falling into speed
    land();
  }
}
function land() {
  p.vy = 0; p.jumping = false; p.spring = false;
  if (p.hurt) { p.hurt = false; p.gs = 0; }
  if (keys.down && Math.abs(p.gs) > 80) { p.rolling = true; p.ball = true; }
  else { p.rolling = false; p.ball = false; }
}

function hurtPlayer(fromX) {
  if (p.inv > 0 || game.state !== "play") return;
  game.hearts--;
  if (game.hearts <= 0) { killPlayer(); return; }
  const d = p.x < fromX ? -1 : 1;
  p.loop = null; p.on = null; p.hurt = true; p.ball = false; p.rolling = false; p.jumping = false;
  p.vx = d * 200; p.vy = -320; p.inv = 1.8;
  sfx.hurt();
  burst(p.x, p.y - 12, "#ff6b6b", 8);
}
function killPlayer() {
  if (game.state === "dying") return;
  game.state = "dying";
  game.dyingT = 2;
  game.hearts = 0;
  p.loop = null; p.ball = false; p.rolling = false; p.dead = true;
  p.vy = p.y > DEATH_Y - 10 ? 0 : -420;
  stopMusic();
  sfx.die();
}
function updateDying(dt) {
  game.dyingT -= dt;
  if (p.y < DEATH_Y + 100) { p.vy += GRAVITY * dt; p.y += p.vy * dt; }
  if (game.dyingT > 0) return;
  game.lives--;
  if (game.lives <= 0) { game.state = "over"; showScreen("over-screen"); return; }
  respawn();
}

function updatePlats(dt) {
  for (const pl of level.plats) {
    const ox = pl.x, oy = pl.y;
    pl.prevY = pl.y;
    pl.t += dt;
    if (pl.move === "side") pl.x = pl.bx + Math.sin(pl.t * 1.4) * 28;
    if (pl.move === "updown") pl.y = pl.by + Math.sin(pl.t * 1.6) * 30;
    pl.dx = pl.x - ox; pl.dy = pl.y - oy;
  }
}

// ---------- 8. enemies ----------
function foeBox(f) {
  if (f.kind === "flier") return { x0: f.x - 12, x1: f.x + 12, y0: f.y - 12, y1: f.y + 12 };
  return { x0: f.x - 11, x1: f.x + 11, y0: f.y - (f.kind === "spiky" ? 18 : 16), y1: f.y };
}
function updateFoes(dt) {
  const left = cam.x - 200, right = cam.x + cam.w + 200;
  for (const f of level.foes) {
    if (!f.alive || f.x < left || f.x > right) continue;
    f.t += dt;
    if (f.kind === "crawler" || f.kind === "spiky") {
      const nx = f.x + f.dir * (f.kind === "spiky" ? 26 : 42) * dt;
      const ahead = groundY(nx + f.dir * 10);
      if (Math.abs(ahead - f.y) > 14 || Math.abs(nx - f.homeX) > 64) f.dir = -f.dir;
      else { f.x = nx; f.y = groundY(nx); }
    } else if (f.kind === "hopper") {
      if (f.onGround) {
        f.wait -= dt;
        if (f.wait <= 0) { f.vy = -340; f.onGround = false; }
      } else {
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        const g = groundY(f.x);
        if (f.y >= g) { f.y = g; f.onGround = true; f.wait = 1 + Math.random() * 0.8; }
      }
      f.dir = p.x < f.x ? -1 : 1;
    } else {
      f.x = f.homeX + Math.sin(f.t * 1.1) * 50;
      f.y = f.homeY + Math.sin(f.t * 2.3) * 12;
      f.dir = Math.cos(f.t * 1.1) < 0 ? -1 : 1;
    }
  }
}
function touchFoes() {
  const pb = playerBox();
  for (const f of level.foes) {
    if (!f.alive) continue;
    const fb = foeBox(f);
    if (!overlap(pb, fb)) continue;
    const stomping = !p.on && p.vy > 0 && p.y < fb.y0 + 10;   // landing on its head
    if (f.kind === "spiky") {
      if (p.rolling && p.on) defeatFoe(f);                    // only a roll beats spiky ones
      else hurtPlayer(f.x);
    } else if (p.ball || stomping) {
      defeatFoe(f);
      if (!p.on) { p.vy = keys.jump ? -420 : -300; p.jumping = false; }
    } else hurtPlayer(f.x);
  }
}
function defeatFoe(f) {
  f.alive = false;
  game.score += 100;
  popup(f.x, f.y - 24, "100");
  burst(f.x, f.y - 8, "#ffffff", 10);
  sfx.pop();
}

// ---------- 9. the zone boss ----------
function bossBox(b) {
  if (b.kind === "charger") return { x0: b.x - 30, x1: b.x + 30, y0: b.y - 44, y1: b.y };
  return { x0: b.x - 24, x1: b.x + 24, y0: b.y - 22, y1: b.y + 22 };
}
function resetBoss(b) {
  b.active = false; b.flash = 0; b.x = b.homeX; b.y = b.homeY; b.vy = 0;
  b.state = b.kind === "flier" ? "hover" : "wait"; b.t = 1.5; b.swoopT = 3; b.dropT = 2;
}
function updateBoss(dt) {
  const b = level.boss;
  if (!b) return;
  const a = level.arena;
  if (!b.active && !b.dead) {
    if (p.x < a.x0 + 70) return;
    b.active = true;
    toast(ZONES[b.zi].bossName + "!");
    setMusic("boss");
    sfx.roar();
  }
  b.flash = Math.max(0, b.flash - dt);
  if (b.dead) {
    b.t -= dt;
    b.vy += GRAVITY * 0.6 * dt;
    b.y += b.vy * dt;
    if (Math.random() < dt * 14) burst(b.x + (Math.random() - 0.5) * 60, b.y - 20 - Math.random() * 30, "#ffd25a", 6);
    if (b.t <= 0 && level.goalX === null) { level.goalX = a.x1 - 70; setMusic(level.zone.key); toast("Run to the goal!"); }
    return;
  }
  const fast = 1 + (b.maxHp - b.hp) * 0.08 + b.zi * 0.08;   // bosses get quicker as they get hurt
  if (b.kind === "charger") updateCharger(b, dt, fast);
  else updateFlier(b, dt, fast);
  touchBoss(b);
}
// a charger stomps its feet, then charges from one side to the other
function updateCharger(b, dt, fast) {
  const a = level.arena;
  b.t -= dt;
  if (b.state === "wait") {
    b.dir = p.x < b.x ? -1 : 1;
    if (b.t <= 0) { b.state = "wind"; b.t = 0.7 / fast; sfx.stomp(); }
  } else if (b.state === "wind") {
    if (b.t <= 0) b.state = "charge";
  } else {
    b.x += b.dir * 250 * fast * dt;
    if (b.x < a.x0 + 44 || b.x > a.x1 - 44) {
      b.x = clamp(b.x, a.x0 + 44, a.x1 - 44);
      b.state = "wait"; b.t = 1.1;
      cam.shake = 0.3;
      sfx.thud();
      // bonk! rocks fall down
      for (let i = 0; i < 1 + b.zi; i++) {
        shots.push({ kind: "rock", x: a.x0 + 40 + Math.random() * (a.x1 - a.x0 - 80), y: cam.y - 10 - i * 50, vx: 0, vy: 0, r: 7 });
      }
    }
  }
  b.y = a.gy;
}
// a flier floats high up dropping things, then swoops down low. That's your chance!
function updateFlier(b, dt, fast) {
  const a = level.arena, mid = (a.x0 + a.x1) / 2, half = (a.x1 - a.x0) / 2 - 60;
  if (b.state === "hover") {
    b.clk += dt * fast;
    const tx = mid + Math.sin(b.clk * 0.8) * half, ty = a.gy - 150 + Math.sin(b.clk * 2.2) * 10;
    b.x += (tx - b.x) * Math.min(1, dt * 3);
    b.y += (ty - b.y) * Math.min(1, dt * 3);
    b.dir = p.x < b.x ? -1 : 1;
    b.dropT -= dt;
    if (b.dropT <= 0) {
      b.dropT = 1.6 / fast;
      shots.push({ kind: b.zi === 1 ? "wisp" : "nut", x: b.x, y: b.y + 20, vx: 0, vy: 40, r: 7 });
      sfx.drop();
    }
    b.swoopT -= dt;
    if (b.swoopT <= 0) { b.state = "dive"; b.tx = clamp(p.x, a.x0 + 40, a.x1 - 40); sfx.roar(); }
  } else if (b.state === "dive") {
    const ty = a.gy - 30, dx = b.tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy), sp = 260 * fast * dt;
    if (dist <= sp) { b.x = b.tx; b.y = ty; b.state = "low"; b.t = 1.2; }
    else { b.x += dx / dist * sp; b.y += dy / dist * sp; }
  } else if (b.state === "low") {
    b.t -= dt;
    if (b.t <= 0) b.state = "rise";
  } else {
    b.y -= 160 * dt;
    if (b.y <= a.gy - 140) { b.state = "hover"; b.swoopT = 3 / fast + 1; }
  }
}
function touchBoss(b) {
  if (b.flash > 0) return;
  const bb = bossBox(b);
  if (!overlap(playerBox(), bb)) return;
  const fromTop = !p.on && p.vy > 0 && p.y < bb.y0 + 16;
  // the charger can only be hurt by landing on its head; the flier by hitting it as a ball
  if (b.kind === "charger" ? fromTop : p.ball || fromTop) {
    b.hp--;
    b.flash = 1.1;
    game.score += 200;
    popup(b.x, b.y - 60, "200");
    sfx.bossHit();
    burst(b.x, bb.y0, "#ffffff", 12);
    p.on = null; p.loop = null; p.ball = true; p.rolling = false; p.jumping = false;
    p.vy = -380;
    p.vx = (p.x < b.x ? -1 : 1) * 170;
    if (b.hp <= 0) {
      b.dead = true; b.t = 1.8; b.vy = -250;
      game.score += 1000;
      popup(b.x, b.y - 80, "1000");
      stopMusic();
      sfx.boom();
    }
  } else hurtPlayer(b.x);
}
function updateShots(dt) {
  const pb = playerBox();
  for (const s of shots) {
    if (s.kind === "wisp") { s.vx = clamp(s.vx + Math.sign(p.x - s.x) * 80 * dt, -60, 60); s.vy = 70; }
    else s.vy += GRAVITY * 0.7 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.y >= groundY(s.x)) { s.dead = true; burst(s.x, s.y - 4, s.kind === "wisp" ? "#9bff9b" : "#c9b8a0", 6); }
    else if (overlap(pb, { x0: s.x - s.r, x1: s.x + s.r, y0: s.y - s.r, y1: s.y + s.r })) { s.dead = true; hurtPlayer(s.x); }
  }
  shots = shots.filter(s => !s.dead);
}

// ---------- 10. touching things: seeds, springs, spikes... ----------
function addSeeds(k) {
  game.levelSeeds += k;
  game.seedBank += k;
  if (game.seedBank >= SEEDS_FOR_LIFE) {
    game.seedBank -= SEEDS_FOR_LIFE;
    game.lives++;
    toast("100 seeds = extra life!");
    sfx.life();
  }
}
function touchStuff() {
  const c = playerCenter(), pb = playerBox();
  for (const s of level.seeds) {
    if (!s.got && Math.abs(s.x - c.x) < 16 && Math.abs(s.y - c.y) < 18) {
      s.got = true; addSeeds(1); sfx.seed();
      fx.push({ kind: "twinkle", x: s.x, y: s.y, t: 0.3, max: 0.3 });
    }
  }
  for (const it of level.items) {
    if (it.got || Math.abs(it.x - c.x) > 16 || Math.abs(it.y - c.y) > 20) continue;
    it.got = true;
    if (it.kind === "berry") {
      if (game.hearts < MAX_HEARTS) { game.hearts++; toast("❤️ Heart back!"); } else { game.score += 500; popup(it.x, it.y - 16, "500"); }
      sfx.berry();
    } else { game.lives++; toast("Extra life!"); sfx.life(); }
  }
  if (!p.loop) {
    for (const sp of level.springs) {
      if (Math.abs(p.x - sp.x) < 13 && p.y >= sp.y - 14 && p.y <= sp.y + 2 && (p.on || p.vy >= 0)) {
        p.on = null; p.vy = -SPRING_POWER; p.ball = false; p.rolling = false; p.spring = true; p.jumping = false;
        if (Math.abs(p.vx) < 1) p.vx = 0;
        sp.t = 0.3;
        sfx.spring();
      }
    }
  }
  for (const pad of level.pads) {
    pad.t = Math.max(0, pad.t - STEP);
    if (p.on === "ground" && !p.loop && Math.abs(p.x - pad.x) < 16 && Math.abs(p.y - pad.y) < 6 && p.gs < PAD_SPEED) {
      p.gs = PAD_SPEED; p.face = 1;
      if (pad.t <= 0) sfx.pad();
      pad.t = 0.4;
    }
  }
  for (const sk of level.spikes) {
    if (overlap(pb, { x0: sk.x + 2, x1: sk.x + sk.w - 2, y0: sk.y - 11, y1: sk.y + 2 })) hurtPlayer(sk.x + sk.w / 2);
  }
  for (const post of level.posts) {
    if (!post.lit && p.x > post.x) {
      post.lit = true;
      game.respawnX = post.x;
      sfx.post();
      burst(post.x, post.y - 52, "#ffe36b", 10);
    }
  }
  touchFoes();
  if (level.goalX !== null && game.state === "play" && p.x >= level.goalX) startGoal();
}

// ---------- 11. starting, finishing and coming back ----------
function startLevel(n) {
  game.n = n;
  level = buildLevel(n);
  game.hearts = MAX_HEARTS;
  game.respawnX = 64;
  game.levelSeeds = 0;
  fx = []; shots = [];
  p = makePlayer(64);
  game.state = "play";
  showScreen(null);
  snapCamera();
  setMusic(level.zone.key);
  toast(`${level.zone.name} · ${ACT_NAMES[level.act]}`);
}
function respawn() {
  p = makePlayer(game.respawnX);
  game.hearts = MAX_HEARTS;
  shots = [];
  if (level.boss && !level.boss.dead) resetBoss(level.boss);
  game.state = "play";
  snapCamera();
  setMusic(level.zone.key);
}
function startGoal() {
  game.state = "goal";
  game.goalT = 1.4;
  sfx.goal();
  for (let i = 0; i < 4; i++) burst(level.goalX + (Math.random() - 0.5) * 50, groundY(level.goalX) - 90, ["#ffd25a", "#ff6b6b", "#62e3cf", "#ffffff"][i], 10);
}
function finishLevel() {
  const n = game.n, t = level.time;
  const par = level.width / 240;
  const timeBonus = Math.max(0, Math.round(par - t)) * 50;
  const seedBonus = game.levelSeeds * 10;
  game.score += timeBonus + seedBonus;
  const best = save.best[n];
  const newBest = best === undefined || t < best;
  if (newBest) save.best[n] = t;
  save.unlocked = Math.max(save.unlocked, Math.min(11, n + 1));
  writeSave();
  stopMusic();
  const lines = `⏱ Time <b>${fmtTime(t)}</b>${newBest ? " 🏅 new best!" : ""}<br>` +
    `✨ ${game.levelSeeds} seeds: <b>+${seedBonus}</b> &nbsp; ⚡ speed bonus: <b>+${timeBonus}</b><br>⭐ Score <b>${game.score}</b>`;
  if (n === 11) {
    game.state = "end";
    $("end-text").innerHTML = `Zipper beat all 4 zone bosses and is the new <b>Champion of the Dash!</b><br>${lines}`;
    showScreen("end-screen");
    sfx.win();
  } else {
    game.state = "clear";
    $("clear-title").innerHTML = level.isBoss ? "ZONE <span>CLEAR!</span>" : "ACT <span>CLEAR!</span>";
    $("clear-text").innerHTML = lines;
    showScreen("clear-screen");
  }
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

// ---------- 12. the camera and the screen size ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  scale = Math.min(canvas.height / VIEW_H, canvas.width / 400);   // phones held upright still see enough
  cam.w = canvas.width / scale;
  cam.h = canvas.height / scale;
}
window.addEventListener("resize", resize);
resize();

function cameraTarget() {
  const speed = p.on ? p.gs * Math.cos(p.angle) : p.vx;
  let tx = p.x - cam.w * 0.42 + clamp(speed * 0.3, -90, 120);
  const b = level.boss;
  if (b && (b.active || b.dead)) {
    const a = level.arena;
    if (cam.w >= a.x1 - a.x0) tx = (a.x0 + a.x1) / 2 - cam.w / 2;
    else tx = clamp(tx, a.x0, a.x1 - cam.w);
  }
  tx = clamp(tx, 0, Math.max(0, level.width - cam.w));
  // tall phone screens may look further down, so Zipper isn't squashed against the top
  let ty = Math.min(p.y - cam.h * 0.6, POOL_Y + 30 - Math.min(cam.h, 360));
  if (b && b.active && !b.dead) ty = level.arena.gy - cam.h * 0.72;   // look up a bit to see flying bosses
  return { tx, ty };
}
function snapCamera() { const t = cameraTarget(); cam.x = t.tx; cam.y = t.ty; }
function updateCamera(dt) {
  const t = cameraTarget();
  cam.x += (t.tx - cam.x) * Math.min(1, dt * 9);
  cam.y += (t.ty - cam.y) * Math.min(1, dt * 5);
  cam.shake = Math.max(0, cam.shake - dt);
}

// ---------- 13. one tiny step of the game ----------
function update(dt) {
  if (game.state === "dying") { updateDying(dt); updateFx(dt); return; }
  level.time += game.state === "play" ? dt : 0;
  if (jumpBuf > 0) jumpBuf -= dt;
  updatePlats(dt);
  updatePlayer(dt);
  if (game.state === "dying") return;
  const b = level.boss;
  if (b && (b.active || b.dead)) p.x = clamp(p.x, level.arena.x0 + 12, level.arena.x1 - 12);
  updateFoes(dt);
  updateBoss(dt);
  updateShots(dt);
  touchStuff();
  for (const sp of level.springs) sp.t = Math.max(0, sp.t - dt);
  updateFx(dt);
  updateCamera(dt);
  if (game.state === "goal") {
    game.goalT -= dt;
    if (game.goalT <= 0) finishLevel();
  }
}

// ---------- 14. little effects: sparkles, puffs and score numbers ----------
function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 120;
    fx.push({ kind: "bit", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0.6, max: 0.6, color });
  }
}
function popup(x, y, text) { fx.push({ kind: "popup", x, y, text, t: 0.9, max: 0.9 }); }
function splash(x) {
  for (let i = 0; i < 12; i++) fx.push({ kind: "bit", x: x + (Math.random() - 0.5) * 16, y: POOL_Y, vx: (Math.random() - 0.5) * 120, vy: -150 - Math.random() * 150, t: 0.8, max: 0.8, color: level.zone.pool });
  sfx.splash();
}
function updateFx(dt) {
  for (const f of fx) {
    f.t -= dt;
    if (f.kind === "bit") { f.vy += 500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.kind === "popup") f.y -= 30 * dt;
  }
  fx = fx.filter(f => f.t > 0);
}

// ---------- 15. drawing ----------
function ell(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2); ctx.fill(); }
function circ(x, y, rad) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, rad), 0, Math.PI * 2); ctx.fill(); }
function tri(ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
function rect(x, y, w, h) { ctx.fillRect(x, y, w, h); }
// draw something again and again across the screen, moving slower than the ground (far away things)
function repeat(par, spacing, draw) {
  const off = cam.x * par;
  for (let k = Math.floor(off / spacing) - 1; k * spacing - off < cam.w + spacing; k++) draw(k * spacing - off, k);
}

function drawBackground() {
  const Z = level.zone, W = cam.w, Hh = cam.h;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, Hh);
  g.addColorStop(0, Z.sky[0]);
  g.addColorStop(1, Z.sky[1]);
  ctx.fillStyle = g;
  rect(0, 0, W, Hh);
  const horizon = Hh * 0.55 - (cam.y - 200) * 0.15;   // far things move up and down a little bit too
  if (Z.key === "wavy") {
    ctx.fillStyle = "rgba(160, 240, 255, 0.07)";        // light coming down through the water
    for (let i = 0; i < 4; i++) {
      const x = ((i * 190 - cam.x * 0.05) % (W + 200) + W + 200) % (W + 200) - 100;
      tri(x, 0, x + 60, 0, x + 140, Hh);
    }
    ["#0e4a6b", "#13597e", "#186b93"].forEach((color, k) => {
      const par = 0.15 + k * 0.15;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, Hh);
      for (let x = 0; x <= W + 8; x += 8) {
        const wx = x + cam.x * par;
        ctx.lineTo(x, horizon + k * 30 + Math.sin(wx * 0.018 + clock * 0.6 + k) * 14 + Math.sin(wx * 0.05) * 5);
      }
      ctx.lineTo(W, Hh);
      ctx.fill();
    });
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const bx = ((hash(i) * W * 1.5 - cam.x * 0.3) % W + W) % W;
      const by = Hh - ((clock * 22 * (0.5 + hash(i + 40)) + hash(i + 9) * Hh) % (Hh + 20));
      ctx.beginPath(); ctx.arc(bx + Math.sin(clock * 2 + i) * 4, by, 1.5 + hash(i + 3) * 3, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (Z.key === "spooky") {
    repeat(0.15, 130, (x, k) => {
      ctx.fillStyle = "#1d1029";
      const w = 26 + hash(k) * 30, top = horizon - 120 - hash(k + 5) * 60;
      rect(x, top, w, Hh - top);
      ell(x + w / 2, top, w / 2, 10);
    });
    repeat(0.3, 90, (x, k) => {
      if (Math.sin(clock * 1.3 + k * 2.1) < 0.6) return;   // eyes in the dark, blinking
      ctx.fillStyle = "#b6ff6a";
      const y = horizon - 40 + hash(k + 2) * 90;
      circ(x + 20, y, 2.2); circ(x + 29, y, 2.2);
    });
    repeat(0.45, 160, (x, k) => {
      ctx.fillStyle = "#26163a";
      ctx.beginPath();
      ctx.moveTo(x, Hh);
      ctx.lineTo(x + 20, horizon + 30 + hash(k) * 40);
      ctx.lineTo(x + 50, horizon + 50 + hash(k + 1) * 40);
      ctx.lineTo(x + 90, horizon + 20 + hash(k + 2) * 50);
      ctx.lineTo(x + 160, Hh);
      ctx.fill();
    });
    const fog = ctx.createLinearGradient(0, Hh * 0.6, 0, Hh);
    fog.addColorStop(0, "rgba(120, 255, 140, 0)");
    fog.addColorStop(1, "rgba(120, 255, 140, 0.12)");
    ctx.fillStyle = fog;
    rect(0, Hh * 0.6, W, Hh * 0.4);
  } else if (Z.key === "plains") {
    ctx.fillStyle = "rgba(255, 240, 150, 0.35)";
    circ(W * 0.8, 52, 34);
    ctx.fillStyle = "#fff6b0";
    circ(W * 0.8, 52, 22);
    repeat(0.08, 190, (x, k) => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      const y = 30 + hash(k) * 70;
      ell(x, y, 26, 10); ell(x + 18, y - 8, 18, 12); ell(x + 36, y, 22, 9);
    });
    [["#9fe08a", 0.2, 0, 40], ["#6fc75c", 0.4, 40, 30]].forEach(([color, par, dy, amp]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, Hh);
      for (let x = 0; x <= W + 8; x += 8) {
        const wx = x + cam.x * par;
        ctx.lineTo(x, horizon + dy - Math.abs(Math.sin(wx * 0.006)) * amp - Math.sin(wx * 0.017) * 8);
      }
      ctx.lineTo(W, Hh);
      ctx.fill();
    });
    repeat(0.4, 34, (x, k) => {
      const wx = k * 34;
      ctx.fillStyle = ["#ffffff", "#ffe066", "#ff8ac2"][Math.floor(hash(k) * 3)];
      circ(x, horizon + 52 - Math.abs(Math.sin(wx * 0.006)) * 30 - Math.sin(wx * 0.017) * 8 + hash(k + 1) * 30, 1.6);
    });
  } else {
    ctx.fillStyle = "rgba(255, 255, 200, 0.08)";
    for (let i = 0; i < 3; i++) {
      const x = ((i * 240 - cam.x * 0.05) % (W + 260) + W + 260) % (W + 260) - 130;
      tri(x, 0, x + 50, 0, x - 60, Hh);
    }
    repeat(0.2, 70, (x, k) => {
      ctx.fillStyle = "#2f7a44";
      rect(x, 0, 8 + hash(k) * 14, Hh);
    });
    repeat(0.35, 110, (x, k) => {
      ctx.fillStyle = "#245f35";
      rect(x, 0, 14 + hash(k + 3) * 16, Hh);
    });
    ctx.fillStyle = "#1c5a2f";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, 26 + Math.sin((x + cam.x * 0.5) * 0.05) * 10 + Math.sin((x + cam.x * 0.5) * 0.13) * 5);
    ctx.lineTo(W, 0);
    ctx.fill();
    repeat(0.5, 80, (x, k) => {
      const len = 40 + hash(k) * 90, sway = Math.sin(clock * 1.2 + k) * 4;
      ctx.strokeStyle = "#2e8a3c";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 20); ctx.quadraticCurveTo(x + sway, 20 + len / 2, x + sway * 2, 20 + len); ctx.stroke();
      ctx.fillStyle = "#4cbf4c";
      for (let j = 30; j < len; j += 22) ell(x + sway * (j / len) * 2 + 4, 20 + j, 5, 2.5, 0.5);
    });
  }
}

function drawPool() {
  const Z = level.zone, x0 = cam.x - 10, x1 = cam.x + cam.w + 10, bottom = Math.max(POOL_Y + 100, cam.y + cam.h + 20);
  ctx.fillStyle = Z.pool;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = Math.floor(x0 / 8) * 8; x <= x1; x += 8) ctx.lineTo(x, POOL_Y + Math.sin(x * 0.06 + clock * 3) * 3);
  ctx.lineTo(x1, bottom);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function terrainPath(i0, i1, bottom) {
  const path = new Path2D();
  path.moveTo(i0 * SEG, bottom);
  path.lineTo(i0 * SEG, Math.min(groundY(i0 * SEG + 0.01), bottom));
  for (let i = i0; i <= i1; i++) {
    const a = hAt(i), b = hAt(i + 1);
    if (Math.abs(b - a) > WALL) {
      path.lineTo(i * SEG + SEG / 2, Math.min(a, bottom));
      path.lineTo(i * SEG + SEG / 2, Math.min(b, bottom));
    }
    path.lineTo((i + 1) * SEG, Math.min(b, bottom));
  }
  path.lineTo((i1 + 1) * SEG, bottom);
  path.closePath();
  return path;
}
function drawTerrain() {
  const Z = level.zone;
  const i0 = Math.floor(cam.x / SEG) - 1, i1 = Math.ceil((cam.x + cam.w) / SEG) + 1;
  const bottom = cam.y + cam.h + 120;
  const path = terrainPath(i0, i1, bottom);
  ctx.fillStyle = Z.top;
  ctx.fill(path);
  ctx.save();
  ctx.translate(0, 8); ctx.fillStyle = Z.dirt; ctx.fill(path);
  ctx.translate(0, 30); ctx.fillStyle = Z.dirt2; ctx.fill(path);
  ctx.translate(0, 50); ctx.fillStyle = Z.dirt3; ctx.fill(path);
  ctx.restore();
  // a few pebbles in the dirt
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  for (let i = i0; i <= i1; i++) {
    const top = hAt(i);
    if (top >= PIT || hash(i * 3.7) > 0.5) continue;
    ell(i * SEG + 8, top + 18 + hash(i) * 60, 3 + hash(i + 1) * 3, 2);
  }
  // a shiny line along the top of the grass
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const a = hAt(i), b = hAt(i + 1);
    if (a >= PIT || b >= PIT || Math.abs(b - a) > WALL) continue;
    ctx.moveTo(i * SEG, a + 1);
    ctx.lineTo((i + 1) * SEG, b + 1);
  }
  ctx.stroke();
}
// little things growing on the ground, different in every zone
function drawDecor() {
  const key = level.zone.key;
  const i0 = Math.floor(cam.x / SEG) - 1, i1 = Math.ceil((cam.x + cam.w) / SEG) + 1;
  for (let i = i0; i <= i1; i++) {
    const a = hAt(i), b = hAt(i + 1);
    if (a >= PIT || b >= PIT || Math.abs(b - a) > WALL) continue;
    const r = hash(i + level.n * 1000), x = i * SEG + 8, y = (a + b) / 2;
    if (key === "wavy") {
      if (r < 0.1) { ctx.fillStyle = "#ff9fb8"; ctx.beginPath(); ctx.arc(x, y, 6, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#e0708e"; rect(x - 1, y - 6, 2, 6); }
      else if (r < 0.32) {
        ctx.strokeStyle = "#3fbf8f"; ctx.lineWidth = 2.5;
        const sway = Math.sin(clock * 2 + i) * 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 4, y - 10, x + sway, y - 20 - r * 20); ctx.stroke();
      }
    } else if (key === "spooky") {
      if (r < 0.12) {
        ctx.fillStyle = "#d8d0e8"; rect(x - 1.5, y - 7, 3, 7);
        const glow = 0.6 + Math.sin(clock * 3 + i) * 0.4;
        ctx.fillStyle = `rgba(120, 255, 150, ${0.25 * glow})`; circ(x, y - 9, 10);
        ctx.fillStyle = "#7dff8a"; ctx.beginPath(); ctx.arc(x, y - 7, 6, Math.PI, 0); ctx.fill();
      } else if (r < 0.17) {
        ctx.fillStyle = "#6e6480"; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 7, y - 14); ctx.arc(x, y - 14, 7, Math.PI, 0); ctx.lineTo(x + 7, y); ctx.fill();
        ctx.fillStyle = "#4b4260"; rect(x - 1, y - 18, 2, 8); rect(x - 4, y - 15, 8, 2);
      }
    } else if (key === "plains") {
      if (r < 0.2) {
        ctx.strokeStyle = "#3f9a35"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 10); ctx.stroke();
        ctx.fillStyle = ["#ffffff", "#ffe066", "#ff6fa8", "#a98bff"][Math.floor(r * 20)];
        for (let k = 0; k < 5; k++) circ(x + Math.cos(k * 1.26) * 3, y - 11 + Math.sin(k * 1.26) * 3, 2.2);
        ctx.fillStyle = "#ffb627"; circ(x, y - 11, 1.8);
      } else if (r < 0.45) {
        ctx.fillStyle = "#4cb43c"; tri(x - 4, y, x - 1, y - 7, x + 1, y); tri(x, y, x + 3, y - 9, x + 5, y);
      }
    } else {
      if (r < 0.25) {
        ctx.fillStyle = r < 0.12 ? "#2f9a3a" : "#3fbf4f";
        for (let k = -2; k <= 2; k++) ell(x + k * 4, y - 6 - (2 - Math.abs(k)) * 3, 3, 8, k * 0.4);
      } else if (r < 0.3) {
        ctx.fillStyle = "#f2f2f2"; rect(x - 1.5, y - 6, 3, 6);
        ctx.fillStyle = "#e53b3b"; ctx.beginPath(); ctx.arc(x, y - 5, 6, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#fff"; circ(x - 2, y - 8, 1.2); circ(x + 2.5, y - 7, 1);
      }
    }
  }
}
// big things standing behind the ground (jungle trees, sea kelp)
function drawBackDecor() {
  const key = level.zone.key;
  if (key !== "jungle" && key !== "wavy") return;
  const i0 = Math.floor(cam.x / SEG) - 4, i1 = Math.ceil((cam.x + cam.w) / SEG) + 4;
  for (let i = i0; i <= i1; i++) {
    const top = hAt(i);
    if (top >= PIT || hash(i * 5.3 + 2) > 0.07) continue;
    const x = i * SEG + 8;
    if (key === "jungle") {
      ctx.fillStyle = "#5a3a1e"; rect(x - 7, top - 170, 14, 175);
      ctx.fillStyle = "#4a2f18"; rect(x - 2, top - 160, 3, 160);
      ctx.fillStyle = "#2d8a3a"; ell(x, top - 175, 40, 20); ell(x - 26, top - 162, 24, 14); ell(x + 26, top - 162, 24, 14);
      ctx.fillStyle = "#3aa64a"; ell(x - 6, top - 182, 26, 12);
    } else {
      ctx.strokeStyle = "#1f8f6f"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, top);
      for (let k = 1; k <= 8; k++) ctx.lineTo(x + Math.sin(clock * 1.5 + k * 0.7 + i) * k * 1.2, top - k * 16);
      ctx.stroke();
    }
  }
}
function drawCeiling() {
  const Z = level.zone, C = level.C;
  const i0 = Math.max(0, Math.floor(cam.x / SEG) - 1), i1 = Math.min(C.length - 1, Math.ceil((cam.x + cam.w) / SEG) + 1);
  const top = cam.y - 20;
  ctx.fillStyle = Z.ceil;
  ctx.beginPath();
  ctx.moveTo(i0 * SEG, top);
  for (let i = i0; i <= i1; i++) ctx.lineTo(i * SEG + 8, C[i]);
  ctx.lineTo(i1 * SEG + 16, top);
  ctx.fill();
  ctx.strokeStyle = Z.ceilEdge;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) ctx.lineTo(i * SEG + 8, C[i] - 2);
  ctx.stroke();
  ctx.fillStyle = Z.ceil;
  for (let i = i0; i <= i1; i++) {
    const r = hash(i * 7.1);
    if (r < 0.3) tri(i * SEG + 2, C[i] - 2, i * SEG + 14, C[i] - 2, i * SEG + 8, C[i] + 10 + r * 50);
  }
}
function drawLoops() {
  const Z = level.zone;
  for (const lp of level.loops) {
    if (lp.cx + lp.r + 20 < cam.x || lp.cx - lp.r - 20 > cam.x + cam.w) continue;
    const cy = lp.gy - lp.r;
    ctx.strokeStyle = Z.dirt2; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(lp.cx, cy, lp.r + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = Z.dirt; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(lp.cx, cy, lp.r + 11, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = Z.top; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(lp.cx, cy, lp.r + 2, 0, Math.PI * 2); ctx.stroke();
  }
}
function drawPlats() {
  const Z = level.zone;
  for (const pl of level.plats) {
    if (pl.x + pl.w < cam.x || pl.x > cam.x + cam.w) continue;
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; rect(pl.x + 2, pl.y + 3, pl.w, 12);
    ctx.fillStyle = Z.plat; rect(pl.x, pl.y, pl.w, 12);
    ctx.fillStyle = Z.top; rect(pl.x, pl.y, pl.w, 4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (let k = 12; k < pl.w; k += 12) rect(pl.x + k, pl.y + 5, 1.5, 7);
  }
}
function drawThings() {
  const left = cam.x - 40, right = cam.x + cam.w + 40;
  for (const sp of level.springs) {
    if (sp.x < left || sp.x > right) continue;
    const up = sp.t > 0 ? 10 : 0;
    ctx.fillStyle = "#7d8597"; rect(sp.x - 12, sp.y - 4, 24, 4);
    ctx.strokeStyle = "#c0c6d4"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) ctx.lineTo(sp.x + (k % 2 ? 6 : -6), sp.y - 4 - k * (2 + up / 4));
    ctx.stroke();
    ctx.fillStyle = "#ff4d5e"; rect(sp.x - 13, sp.y - 16 - up, 26, 6);
    ctx.fillStyle = "#ffd25a"; rect(sp.x - 13, sp.y - 16 - up, 26, 2);
  }
  for (const pad of level.pads) {
    if (pad.x < left || pad.x > right) continue;
    ctx.fillStyle = "#3a3f55"; rect(pad.x - 14, pad.y - 3, 28, 4);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = Math.floor(clock * 8 - k) % 3 === 0 ? "#fff36b" : "#ffb627";
      const x = pad.x - 9 + k * 7;
      tri(x, pad.y - 6, x + 5, pad.y - 3, x, pad.y);
    }
  }
  for (const sk of level.spikes) {
    if (sk.x + sk.w < left || sk.x > right) continue;
    for (let x = sk.x; x < sk.x + sk.w; x += 8) {
      ctx.fillStyle = "#c9ced8"; tri(x, sk.y, x + 4, sk.y - 12, x + 8, sk.y);
      ctx.fillStyle = "#8a91a3"; tri(x + 4, sk.y, x + 4, sk.y - 12, x + 8, sk.y);
    }
  }
  for (const post of level.posts) {
    if (post.x < left || post.x > right) continue;
    ctx.fillStyle = "#5a4a3a"; rect(post.x - 2, post.y - 44, 4, 44);
    if (post.lit) { ctx.fillStyle = "rgba(255, 220, 90, 0.3)"; circ(post.x, post.y - 52, 14 + Math.sin(clock * 5) * 2); }
    ctx.fillStyle = "#3a3348"; rect(post.x - 7, post.y - 60, 14, 3); rect(post.x - 6, post.y - 46, 12, 3);
    ctx.fillStyle = post.lit ? "#ffd25a" : "#77708a"; rect(post.x - 5, post.y - 57, 10, 11);
  }
  if (level.goalX !== null) drawGoal(level.goalX, groundY(level.goalX));
  for (const s of level.seeds) {
    if (s.got || s.x < left || s.x > right) continue;
    drawSeed(s.x, s.y + Math.sin(clock * 4 + s.x * 0.05) * 2, s.x);
  }
  for (const it of level.items) {
    if (it.got || it.x < left || it.x > right) continue;
    const y = it.y + Math.sin(clock * 3) * 3;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)"; circ(it.x, y, 12);
    if (it.kind === "berry") {
      ctx.fillStyle = "#e8344a"; circ(it.x - 3, y + 2, 5); circ(it.x + 3, y + 2, 5); tri(it.x - 8, y + 3, it.x + 8, y + 3, it.x, y + 10);
      ctx.fillStyle = "#3fbf3f"; ell(it.x + 3, y - 5, 4, 2, -0.5);
    } else {
      ctx.save(); ctx.translate(it.x, y + 9); ctx.scale(0.75, 0.75); drawZipper(ctx, { run: 0 }); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = "9px 'Lilita One', sans-serif"; ctx.textAlign = "center"; ctx.fillText("1UP", it.x, y - 12);
    }
  }
}
function drawSeed(x, y, phase) {
  const w = Math.abs(Math.cos(clock * 3 + phase * 0.02));
  ctx.fillStyle = "rgba(255, 220, 80, 0.25)"; circ(x, y, 8);
  ctx.fillStyle = "#b8860b"; ell(x, y, 4.5 * w + 1.2, 6.2);
  ctx.fillStyle = "#ffd23f"; ell(x, y, 3.5 * w + 0.8, 5.2);
  ctx.fillStyle = "#fff6c0"; ell(x - w, y - 2, 1.2 * w + 0.3, 1.8);
}
function drawGoal(x, y) {
  ctx.fillStyle = "#e9e3d6"; rect(x - 30, y - 96, 6, 96); rect(x + 24, y - 96, 6, 96);
  ctx.fillStyle = "#ff4d5e"; ctx.beginPath(); ctx.arc(x - 27, y - 98, 5, 0, Math.PI * 2); ctx.arc(x + 27, y - 98, 5, 0, Math.PI * 2); ctx.fill();
  const wave = Math.sin(clock * 4) * 2;
  ctx.fillStyle = "#ffd25a";
  ctx.beginPath();
  ctx.moveTo(x - 24, y - 92); ctx.quadraticCurveTo(x, y - 86 + wave, x + 24, y - 92);
  ctx.lineTo(x + 24, y - 72); ctx.quadraticCurveTo(x, y - 66 + wave, x - 24, y - 72);
  ctx.fill();
  ctx.fillStyle = "#b84a00";
  ctx.font = "13px 'Lilita One', sans-serif"; ctx.textAlign = "center";
  ctx.fillText("GOAL", x, y - 76 + wave / 2);
}

// Zipper, drawn facing right with feet at (0, 0)
function drawZipper(c, pose) {
  if (pose.ball) {
    c.save();
    c.translate(0, -11);
    c.rotate(pose.spin || 0);
    c.fillStyle = "#b85a14"; c.beginPath(); c.arc(0, 0, 11.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#f08a2c"; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#b85a14"; c.lineWidth = 2;
    for (const k of [-5, 0, 5]) {
      const hy = Math.sqrt(100 - k * k);
      c.beginPath(); c.moveTo(k, -hy); c.quadraticCurveTo(k + 3, 0, k, hy); c.stroke();
    }
    c.fillStyle = "#f2c38b"; c.beginPath(); c.arc(7, 5, 3.5, 0, Math.PI * 2); c.fill();   // tucked-in nose
    c.fillStyle = "#2fbf71"; c.beginPath(); c.arc(-6, 6, 2.5, 0, Math.PI * 2); c.fill();  // a bit of scarf
    c.fillStyle = "rgba(255, 255, 255, 0.4)"; c.beginPath(); c.arc(-3, -5, 3, 0, Math.PI * 2); c.fill();
    c.restore();
    return;
  }
  const ph = pose.run || 0, low = pose.crouch ? 4 : 0;
  const stride = pose.spring ? 0 : Math.sin(ph * 6) * 5;
  // scarf tails flapping behind
  c.fillStyle = "#23a35e";
  const flap = Math.sin(ph * 9) * 2;
  c.beginPath(); c.moveTo(4, -13 + low); c.lineTo(-7 - (pose.speedy ? 6 : 0), -16 + flap + low); c.lineTo(-5 - (pose.speedy ? 6 : 0), -11 + flap + low); c.closePath(); c.fill();
  // legs
  c.fillStyle = "#7a4515";
  if (pose.spring) { c.fillRect(-7, -6, 4, 8); c.fillRect(3, -6, 4, 8); }
  else { c.beginPath(); c.ellipse(-5 + stride, -2, 4.5, 3, 0, 0, Math.PI * 2); c.ellipse(5 - stride, -2, 4.5, 3, 0, 0, Math.PI * 2); c.fill(); }
  // tail
  c.fillStyle = "#d97a22";
  c.beginPath(); c.moveTo(-11, -7 + low); c.lineTo(-20, -3 + Math.sin(ph * 5)); c.lineTo(-11, -3 + low); c.closePath(); c.fill();
  // belly
  c.fillStyle = "#f6d7a8"; c.beginPath(); c.ellipse(1, -9 + low / 2, 10, 7 - low / 3, 0, 0, Math.PI * 2); c.fill();
  // the shell, with its bands
  c.save();
  c.beginPath(); c.ellipse(-2, -10 + low, 13, 11 - low / 2, 0, Math.PI, 0); c.closePath();
  c.fillStyle = "#f08a2c"; c.fill();
  c.clip();
  c.fillStyle = "#c4661a";
  for (const bx of [-9, -4, 1, 6]) c.fillRect(bx, -24, 2, 16);
  c.fillStyle = "rgba(255, 255, 255, 0.3)"; c.beginPath(); c.ellipse(-5, -17 + low, 5, 2.5, -0.2, 0, Math.PI * 2); c.fill();
  c.restore();
  c.fillStyle = "#b85a14"; c.fillRect(-15, -11 + low, 26, 2);
  // head
  c.fillStyle = "#f2c38b"; c.beginPath(); c.ellipse(10, -13 + low, 7, 6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(16, -11 + low, 4.5, 3, 0.15, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#4a2a14"; c.beginPath(); c.arc(20, -11.5 + low, 1.8, 0, Math.PI * 2); c.fill();
  // ear
  c.fillStyle = "#e9a46a"; c.beginPath(); c.ellipse(6, -20 + low, 3, 5.5, -0.35, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffb3b3"; c.beginPath(); c.ellipse(6.3, -19.5 + low, 1.4, 3.4, -0.35, 0, Math.PI * 2); c.fill();
  // eye
  if (pose.hurt) {
    c.strokeStyle = "#3a1f0e"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(10, -18 + low); c.lineTo(14, -14 + low); c.moveTo(14, -18 + low); c.lineTo(10, -14 + low); c.stroke();
  } else {
    c.fillStyle = "#fff"; c.beginPath(); c.ellipse(12, -15.5 + low, 2.6, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#1d1d2b"; c.beginPath(); c.arc(13, -15.5 + low, 1.5, 0, Math.PI * 2); c.fill();
  }
  // scarf knot
  c.fillStyle = "#2fbf71"; c.fillRect(3, -15 + low, 5, 6);
}
function drawPlayer() {
  const blink = p.inv > 0 && Math.floor(clock * 14) % 2 === 0 && game.state === "play";
  for (let i = 0; i < p.trail.length; i++) {
    const t = p.trail[i];
    ctx.save();
    ctx.globalAlpha = 0.1 + i * 0.05;
    ctx.translate(t.x, t.y);
    if (!t.ball) ctx.rotate(t.angle);
    ctx.scale(t.face, 1);
    drawZipper(ctx, { ball: t.ball, spin: t.spin, run: t.run });
    ctx.restore();
  }
  if (blink) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (!p.ball) ctx.rotate(p.angle);
  ctx.scale(p.face, 1);
  const speed = Math.abs(p.on ? p.gs : p.vx);
  drawZipper(ctx, { ball: p.ball, spin: p.spin, run: p.run * (p.on ? 1 : 0.3), crouch: p.crouch,
    hurt: p.hurt || p.dead, spring: p.spring, speedy: speed > 300 });
  ctx.restore();
}

// enemies: each zone has its own creatures, but they behave the same way
function drawFoe(f) {
  const key = level.zone.key;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.dir < 0 ? 1 : -1, 1);   // drawn facing left
  const step = Math.sin(f.t * 10) * 2;
  if (f.kind === "crawler") {
    if (key === "wavy") {          // a crab
      ctx.strokeStyle = "#b8322a"; ctx.lineWidth = 2;
      ctx.beginPath(); for (const k of [-7, -2, 3, 8]) { ctx.moveTo(k, -5); ctx.lineTo(k - 2 + step, 0); } ctx.stroke();
      ctx.fillStyle = "#e8483a"; ell(0, -8, 11, 6.5);
      ell(-12, -12 + step, 4.5, 3.5); ell(12, -12 - step, 4.5, 3.5);
      ctx.fillStyle = "#fff"; circ(-3, -15, 2.5); circ(3, -15, 2.5);
      ctx.fillStyle = "#222"; circ(-3.5, -15, 1.2); circ(2.5, -15, 1.2);
    } else if (key === "spooky") { // a bone beetle
      ctx.fillStyle = "#5a3a7a"; for (const k of [-6, 0, 6]) rect(k + step / 2, -3, 2, 3);
      ctx.fillStyle = "#ece6d6"; ctx.beginPath(); ctx.arc(0, -3, 11, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#2a1c3d"; ell(-4, -8, 2.5, 3); ell(4, -8, 2.5, 3); tri(-1, -4, 1, -4, 0, -6);
    } else if (key === "plains") { // a ladybug
      ctx.fillStyle = "#222"; for (const k of [-6, 0, 6]) rect(k + step / 2, -3, 2, 3); ell(-10, -6, 5, 4.5);
      ctx.fillStyle = "#e8343a"; ctx.beginPath(); ctx.arc(1, -3, 10, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#222"; rect(0.5, -13, 1, 10); circ(-4, -8, 2); circ(5, -7, 2); circ(2, -11, 1.5);
      ctx.fillStyle = "#fff"; circ(-11, -7, 1.6);
    } else {                       // a snail
      ctx.fillStyle = "#9bd14a"; ell(-2, -3, 12, 3.5); ell(-11, -7, 3.5, 5);
      ctx.strokeStyle = "#9bd14a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(-13, -16); ctx.stroke();
      ctx.fillStyle = "#222"; circ(-13, -16, 1.5);
      ctx.fillStyle = "#c27a3a"; circ(2, -10, 8);
      ctx.strokeStyle = "#7a4515"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(2, -10, 4.5, 0, Math.PI * 1.5); ctx.stroke();
    }
  } else if (f.kind === "flier") {
    if (key === "wavy") {          // a jellyfish
      ctx.strokeStyle = "rgba(255, 170, 220, 0.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (const k of [-6, -2, 2, 6]) { ctx.moveTo(k, 0); ctx.quadraticCurveTo(k + Math.sin(f.t * 5 + k) * 3, 7, k, 13); } ctx.stroke();
      ctx.fillStyle = "rgba(255, 140, 210, 0.85)"; ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#fff"; circ(-3, -4, 1.6); circ(3, -4, 1.6);
    } else if (key === "spooky") { // a ghost
      ctx.fillStyle = "rgba(240, 240, 255, 0.9)";
      ctx.beginPath(); ctx.arc(0, -3, 10, Math.PI, 0); ctx.lineTo(10, 9);
      for (let k = 0; k < 4; k++) ctx.lineTo(10 - (k + 0.5) * 5, 9 - (k % 2 ? 0 : 4) + Math.sin(f.t * 6 + k) * 1.5);
      ctx.lineTo(-10, 9); ctx.fill();
      ctx.fillStyle = "#2a1c3d"; ell(-4, -3, 2, 3); ell(3, -3, 2, 3); ell(-1, 3, 2, 1.5);
    } else if (key === "plains") { // a bee
      const flap = Math.sin(f.t * 40) * 3;
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; ell(2, -8 - flap / 2, 5, 3 + flap / 2, -0.4); ell(6, -7, 4, 2.5, 0.3);
      ctx.fillStyle = "#ffcf2a"; ell(0, 0, 10, 7);
      ctx.fillStyle = "#222"; rect(-2, -6.5, 3, 13); rect(4, -5.5, 3, 11); tri(9, -1, 9, 1, 14, 0);
      ctx.fillStyle = "#fff"; circ(-6, -2, 2.2); ctx.fillStyle = "#222"; circ(-6.5, -2, 1.1);
    } else {                       // a little parrot
      const flap = Math.sin(f.t * 14) * 5;
      ctx.fillStyle = "#2f8fff"; ell(4, -2 - flap, 8, 3.5, 0.3 - flap * 0.05);
      ctx.fillStyle = "#e53b3b"; ell(0, 0, 9, 7); tri(7, 2, 16, 6, 7, -2);
      ctx.fillStyle = "#ffcf2a"; tri(-8, -3, -15, 0, -8, 2);
      ctx.fillStyle = "#fff"; circ(-4, -3, 2.2); ctx.fillStyle = "#222"; circ(-4.5, -3, 1.1);
    }
  } else if (f.kind === "hopper") {
    if (key === "wavy") {          // a jumping fish
      ctx.fillStyle = "#ffb03a"; ell(0, -8, 10, 7); tri(8, -8, 16, -14, 16, -2);
      ctx.fillStyle = "#fff"; rect(-2, -14, 2, 12);
      ctx.fillStyle = "#fff"; circ(-5, -10, 2.4); ctx.fillStyle = "#222"; circ(-5.5, -10, 1.2);
    } else if (key === "spooky") { // a hopping pumpkin
      ctx.fillStyle = "#ff8a1f"; ell(-4, -8, 6, 8); ell(4, -8, 6, 8); ell(0, -8, 6, 8.5);
      ctx.fillStyle = "#3f8a2a"; rect(-1, -19, 3, 4);
      ctx.fillStyle = "#ffe36b"; tri(-6, -11, -2, -11, -4, -7); tri(1, -11, 5, -11, 3, -7); rect(-5, -5, 10, 2);
    } else {                       // a frog
      const legs = f.onGround ? 0 : 4;
      ctx.fillStyle = key === "plains" ? "#5fcf4a" : "#e53b3b";
      ell(-6, -2 + legs, 5, 3); ell(6, -2 + legs, 5, 3); ell(0, -8, 10, 7);
      circ(-5, -14, 4); circ(5, -14, 4);
      ctx.fillStyle = "#fff"; circ(-5, -14, 2.6); circ(5, -14, 2.6);
      ctx.fillStyle = "#222"; circ(-5.5, -14, 1.3); circ(4.5, -14, 1.3);
      ctx.fillStyle = key === "plains" ? "#c7f2a8" : "#ffd25a"; ell(0, -5, 6, 3);
    }
  } else {                         // spiky: different colours in every zone, but always spiky
    const col = { wavy: ["#7a3aa6", "#b678e0"], spooky: ["#5c5470", "#a59cc0"], plains: ["#7a5a2a", "#cfb07a"], jungle: ["#2a7a3a", "#9bd14a"] }[key];
    ctx.fillStyle = col[1];
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k + 0.5) / 7 * Math.PI;
      tri(Math.cos(a - 0.2) * 9, -3 + Math.sin(a - 0.2) * 9, Math.cos(a) * 18, -3 + Math.sin(a) * 18, Math.cos(a + 0.2) * 9, -3 + Math.sin(a + 0.2) * 9);
    }
    ctx.fillStyle = col[0]; ctx.beginPath(); ctx.arc(0, -3, 11, Math.PI, 0); ctx.fill(); rect(-11, -3, 22, 3);
    ctx.fillStyle = "#fff"; circ(-5, -6, 2.4); ctx.fillStyle = "#222"; circ(-5.5, -6, 1.2);
    ctx.fillStyle = "#222"; for (const k of [-6, 0, 6]) rect(k + step / 2, 0, 2, 2);
  }
  ctx.restore();
}

function drawBoss(b) {
  if (b.flash > 0 && Math.floor(clock * 16) % 2 === 0) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir < 0 ? 1 : -1, 1);
  if (b.dead) ctx.rotate(Math.min(1, (1.8 - b.t)) * 0.8);
  const shake = b.state === "wind" ? Math.sin(clock * 60) * 2 : 0;
  const step = b.state === "charge" ? Math.sin(clock * 30) * 4 : 0;
  if (b.zi === 0) {                 // King Pinch the Crab
    ctx.translate(shake, 0);
    ctx.strokeStyle = "#a82a22"; ctx.lineWidth = 4;
    ctx.beginPath(); for (const k of [-22, -10, 10, 22]) { ctx.moveTo(k, -14); ctx.lineTo(k * 1.3 + step, 0); } ctx.stroke();
    ctx.fillStyle = "#e8483a"; ell(0, -22, 32, 18);
    ctx.fillStyle = "#ff7a5c"; ell(-6, -28, 16, 6);
    ctx.fillStyle = "#e8483a"; ell(-38, -32 + step, 12, 9, 0.3); ell(36, -30, 10, 8, -0.3);
    ctx.fillStyle = "#fff"; tri(-48, -34 + step, -38, -36 + step, -46, -26 + step);
    ctx.strokeStyle = "#e8483a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -36); ctx.lineTo(-10, -48); ctx.moveTo(8, -36); ctx.lineTo(10, -48); ctx.stroke();
    ctx.fillStyle = "#fff"; circ(-10, -50, 5); circ(10, -50, 5);
    ctx.fillStyle = "#222"; circ(-11, -50, 2.5); circ(9, -50, 2.5);
    ctx.fillStyle = "#ffd25a"; ctx.beginPath(); ctx.moveTo(-12, -38); ctx.lineTo(-12, -46); ctx.lineTo(-6, -41); ctx.lineTo(0, -48); ctx.lineTo(6, -41); ctx.lineTo(12, -46); ctx.lineTo(12, -38); ctx.fill();
    ctx.fillStyle = "#7a1a14"; ctx.beginPath(); ctx.arc(-4, -16, 6, 0, Math.PI); ctx.fill();
  } else if (b.zi === 2) {          // Rumble the Ram
    ctx.translate(shake, 0);
    ctx.fillStyle = "#4a3a3a"; for (const k of [-18, -8, 10, 20]) rect(k + (k < 0 ? step : -step), -12, 5, 12);
    ctx.fillStyle = "#f4f1ea"; for (const [x, y, r] of [[-14, -28, 13], [0, -32, 14], [14, -28, 13], [-6, -18, 13], [10, -18, 12], [20, -22, 10]]) circ(x, y, r);
    ctx.fillStyle = "#e4dfd2"; circ(-2, -24, 9);
    ctx.fillStyle = "#5a4a4a"; ell(-26, -30, 10, 12, 0.3);
    ctx.lineWidth = 6; ctx.strokeStyle = "#c48a3a";
    ctx.beginPath(); ctx.arc(-24, -40, 9, Math.PI * 0.2, Math.PI * 1.7); ctx.stroke();
    ctx.fillStyle = "#fff"; circ(-30, -32, 3); ctx.fillStyle = b.state === "wind" ? "#e8343a" : "#222"; circ(-31, -32, 1.6);
    ctx.fillStyle = "#3a2a2a"; ell(-34, -24, 3, 2);
    if (b.state === "charge") { ctx.fillStyle = "rgba(255,255,255,0.6)"; circ(-40, -26, 3); circ(-44, -22, 2); }
  } else if (b.zi === 1) {          // Lady Lantern
    const bob = Math.sin(clock * 3) * 2;
    ctx.fillStyle = "rgba(150, 255, 110, 0.14)"; circ(0, 0, 40);
    ctx.fillStyle = "#8a6ac0";
    ctx.beginPath(); ctx.arc(0, -6 + bob, 24, Math.PI, 0); ctx.lineTo(24, 22);
    for (let k = 0; k < 6; k++) ctx.lineTo(24 - (k + 0.5) * 8, 22 - (k % 2 ? 0 : 7) + Math.sin(clock * 6 + k) * 2);
    ctx.lineTo(-24, 22); ctx.fill();
    ctx.fillStyle = "#5a3a8a"; tri(-24, -10 + bob, -4, -34 + bob, 4, -26 + bob);
    ctx.fillStyle = "#c8ff6a"; ell(-9, -8 + bob, 4, 5); ell(6, -8 + bob, 4, 5);
    ctx.fillStyle = "#2a1c3d"; ell(-2, 6 + bob, 5, 4);
    ctx.strokeStyle = "#5a4a3a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, 8); ctx.lineTo(-34, 14); ctx.stroke();
    ctx.fillStyle = "#3a3348"; rect(-40, 14, 12, 3); rect(-40, 27, 12, 3);
    ctx.fillStyle = "#c8ff6a"; rect(-39, 17, 10, 10);
  } else {                          // Captain Beak
    const flap = Math.sin(clock * 10) * 10;
    ctx.fillStyle = "#1d1d2b"; ell(10, -4 - flap, 22, 9, 0.4 - flap * 0.03);
    ell(0, 0, 22, 18);
    ctx.fillStyle = "#fff"; ell(-10, 2, 10, 12);
    ctx.fillStyle = "#ff8a1f"; ctx.beginPath(); ctx.moveTo(-16, -10); ctx.quadraticCurveTo(-46, -8, -48, 4); ctx.quadraticCurveTo(-30, 0, -16, 2); ctx.fill();
    ctx.fillStyle = "#ffd25a"; ctx.beginPath(); ctx.moveTo(-16, -10); ctx.quadraticCurveTo(-36, -10, -46, -2); ctx.lineTo(-20, -4); ctx.fill();
    ctx.fillStyle = "#fff"; circ(-11, -8, 4.5); ctx.fillStyle = "#222"; circ(-12, -8, 2.2);
    ctx.fillStyle = "#2a2a3a"; ctx.beginPath(); ctx.moveTo(-18, -16); ctx.lineTo(16, -16); ctx.lineTo(4, -32); ctx.lineTo(-10, -30); ctx.fill();
    ctx.fillStyle = "#fff"; circ(-2, -24, 3);
    ctx.fillStyle = "#ffd25a"; for (const k of [-4, 6]) rect(k, 16, 3, 8);
  }
  ctx.restore();
}
function drawShots() {
  for (const s of shots) {
    if (s.kind === "wisp") {
      ctx.fillStyle = "rgba(160, 255, 140, 0.3)"; circ(s.x, s.y, 10);
      ctx.fillStyle = "#c8ff6a"; circ(s.x, s.y, 5);
    } else if (s.kind === "nut") {
      ctx.fillStyle = "#7a4a22"; circ(s.x, s.y, 7);
      ctx.fillStyle = "#5a3416"; circ(s.x - 2, s.y - 2, 1.5); circ(s.x + 2, s.y - 2, 1.5); circ(s.x, s.y + 1, 1.5);
    } else {
      ctx.fillStyle = "#8a8070"; circ(s.x, s.y, 7);
      ctx.fillStyle = "#b0a690"; circ(s.x - 2, s.y - 2, 3);
    }
  }
}
function drawFx() {
  for (const f of fx) {
    const a = f.t / f.max;
    if (f.kind === "bit") { ctx.globalAlpha = a; ctx.fillStyle = f.color; rect(f.x - 1.5, f.y - 1.5, 3, 3); }
    else if (f.kind === "twinkle") {
      ctx.globalAlpha = a; ctx.fillStyle = "#fff6c0";
      const s = (1 - a) * 12;
      tri(f.x - s, f.y, f.x, f.y - 2, f.x + s, f.y); tri(f.x, f.y - s, f.x + 2, f.y, f.x, f.y + s); tri(f.x - s, f.y, f.x, f.y + 2, f.x + s, f.y);
    } else {
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.fillStyle = "#fff"; ctx.font = "12px 'Lilita One', sans-serif"; ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
  }
  ctx.globalAlpha = 1;
}
function drawBossBar() {
  const b = level.boss;
  if (!b || !b.active || b.dead) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const w = Math.min(220, cam.w - 40), x = (cam.w - w) / 2, y = cam.h - 26;
  ctx.fillStyle = "rgba(16, 20, 34, 0.7)"; rect(x - 4, y - 16, w + 8, 26);
  ctx.fillStyle = "#fff"; ctx.font = "10px 'Lilita One', sans-serif"; ctx.textAlign = "center";
  ctx.fillText(ZONES[b.zi].bossName, cam.w / 2, y - 5);
  ctx.fillStyle = "#3a2030"; rect(x, y, w, 6);
  ctx.fillStyle = "#ff4d5e"; rect(x, y, w * b.hp / b.maxHp, 6);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!level) { ctx.fillStyle = "#111522"; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
  drawBackground();
  const sx = cam.shake > 0 ? (Math.random() - 0.5) * 6 : 0, sy = cam.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
  ctx.setTransform(scale, 0, 0, scale, -Math.round((cam.x + sx) * scale), -Math.round((cam.y + sy) * scale));
  drawBackDecor();
  drawPool();
  drawLoops();
  drawTerrain();
  drawDecor();
  if (level.C) drawCeiling();
  drawPlats();
  drawThings();
  for (const f of level.foes) if (f.alive && f.x > cam.x - 30 && f.x < cam.x + cam.w + 30) drawFoe(f);
  if (level.boss && (level.boss.active || level.boss.dead || level.boss.x < cam.x + cam.w + 60)) drawBoss(level.boss);
  drawShots();
  if (p) drawPlayer();
  drawFx();
  drawBossBar();
  if (p) updateHud();
}

// the HUD is plain HTML on top of the canvas. Only change the text when it really changes.
const hudCache = {};
function setHud(id, text) { if (hudCache[id] !== text) { hudCache[id] = text; $(id).textContent = text; } }
function updateHud() {
  setHud("level-label", `${level.zone.name} ${level.isBoss ? "Boss" : level.act + 1}`);
  setHud("time", fmtTime(level.time));
  setHud("seeds", String(game.levelSeeds));
  setHud("hearts", "❤️".repeat(Math.max(0, game.hearts)) + "🖤".repeat(MAX_HEARTS - Math.max(0, game.hearts)));
  setHud("lives", String(game.lives));
  setHud("score", String(game.score));
}
let toastTimer = 0;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ---------- 16. sounds and music, made from scratch with the Web Audio API ----------
let audio = null, muted = false;
function ensureAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (e) { audio = null; }
}
function tone(freq, dur, type = "square", vol = 0.1, slideTo = 0, at = 0) {
  if (!audio || muted) return;
  const t0 = at || audio.currentTime;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audio.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.15) {
  if (!audio || muted) return;
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.createBufferSource(), g = audio.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g).connect(audio.destination);
  src.start();
}
const later = (ms, fn) => setTimeout(fn, ms);
const notes = (list, gap, type = "square", vol = 0.05, len = 0.12) => list.forEach((f, i) => later(i * gap, () => tone(f, len, type, vol)));
const sfx = {
  jump: () => tone(330, 0.14, "square", 0.05, 700),
  roll: () => tone(180, 0.18, "sawtooth", 0.04, 420),
  seed: () => { tone(1320, 0.05, "square", 0.035); later(45, () => tone(1980, 0.09, "square", 0.035)); },
  spring: () => tone(260, 0.3, "triangle", 0.15, 1100),
  pad: () => tone(400, 0.35, "sawtooth", 0.05, 1600),
  pop: () => { noise(0.12, 0.1); tone(700, 0.1, "square", 0.05, 250); },
  hurt: () => tone(520, 0.35, "sawtooth", 0.07, 130),
  die: () => notes([523, 440, 349, 262, 196], 110, "square", 0.06, 0.16),
  splash: () => noise(0.4, 0.15),
  post: () => notes([784, 1047, 1319], 80, "triangle", 0.12, 0.16),
  berry: () => notes([659, 880, 1175], 60, "triangle", 0.1),
  life: () => notes([523, 659, 784, 1047, 784, 1047], 80, "square", 0.05),
  roar: () => { tone(120, 0.5, "sawtooth", 0.07, 60); noise(0.3, 0.06); },
  stomp: () => tone(90, 0.15, "square", 0.1, 50),
  thud: () => { noise(0.3, 0.2); tone(80, 0.3, "triangle", 0.2, 40); },
  drop: () => tone(600, 0.2, "triangle", 0.06, 200),
  bossHit: () => { tone(320, 0.2, "square", 0.08, 90); noise(0.15, 0.12); },
  boom: () => { noise(0.9, 0.25); notes([392, 330, 262, 196, 131], 110, "sawtooth", 0.06, 0.25); },
  goal: () => notes([523, 659, 784, 1047, 1319], 70, "square", 0.05, 0.18),
  win: () => notes([523, 659, 784, 1047, 784, 1047, 1319, 1568], 140, "square", 0.06, 0.25),
};

// Background music is made up by the computer! It wanders up and down a scale of notes that sound
// nice together. Each zone has its own seed, so each zone gets its own song.
const TUNE_SPECS = {
  wavy: { root: 62, scale: [0, 2, 4, 7, 9], step: 0.13, seed: 3, chords: [0, 9, 5, 7], lead: "triangle" },
  spooky: { root: 57, scale: [0, 1, 3, 7, 8], step: 0.17, seed: 9, chords: [0, 8, 1, 7], lead: "square" },
  plains: { root: 64, scale: [0, 2, 4, 7, 9], step: 0.11, seed: 21, chords: [0, 5, 9, 7], lead: "square" },
  jungle: { root: 59, scale: [0, 3, 5, 7, 10], step: 0.12, seed: 5, chords: [0, 10, 8, 7], lead: "triangle" },
  boss: { root: 50, scale: [0, 1, 3, 6, 7], step: 0.1, seed: 66, chords: [0, 1, 6, 1], lead: "sawtooth" },
};
function makeTune(spec) {
  const rand = makeRng(spec.seed);
  const melody = [];
  const len = spec.scale.length;
  let deg = len;
  for (let i = 0; i < 32; i++) {
    if (i % 4 !== 0 && rand() < 0.25) { melody.push(0); continue; }   // 0 means a rest
    deg = clamp(deg + Math.floor(rand() * 5) - 2, 0, len * 2);
    melody.push(spec.root + spec.scale[deg % len] + 12 * Math.floor(deg / len));
  }
  for (let i = 0; i < 8; i++) melody[16 + i] = melody[i];   // repeat the start so it feels like a song
  return { melody, step: spec.step, lead: spec.lead, bass: spec.chords.map(c => spec.root - 24 + c) };
}
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
let tune = null, musicTime = 0, musicStep = 0;
function setMusic(name) { tune = makeTune(TUNE_SPECS[name]); musicStep = 0; if (audio) musicTime = audio.currentTime + 0.1; }
function stopMusic() { tune = null; }
function musicTick() {
  if (!audio || muted || !tune || (game.state !== "play" && game.state !== "goal")) return;
  if (musicTime < audio.currentTime) musicTime = audio.currentTime + 0.05;
  while (musicTime < audio.currentTime + 0.25) {
    const s = musicStep % 32;
    if (tune.melody[s]) tone(midi(tune.melody[s]), tune.step * 0.9, tune.lead, tune.lead === "sawtooth" ? 0.018 : 0.025, 0, musicTime);
    if (s % 2 === 0) tone(midi(tune.bass[Math.floor(s / 8)]), tune.step * 1.7, "triangle", 0.07, 0, musicTime);
    if (s % 4 === 2) tone(midi(tune.bass[Math.floor(s / 8)] + 12), tune.step * 0.5, "triangle", 0.04, 0, musicTime);
    musicTime += tune.step;
    musicStep++;
  }
}
setInterval(musicTick, 60);

// ---------- 17. keyboard, touch and menus ----------
const KEYMAP = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowDown: "down", KeyS: "down",
  Space: "jump", ArrowUp: "jump", KeyW: "jump", KeyZ: "jump", KeyK: "jump",
};
function press(name, down) {
  if (down && !keys[name] && name === "jump") jumpBuf = 0.12;
  keys[name] = down;
}
window.addEventListener("keydown", e => {
  ensureAudio();
  const name = KEYMAP[e.code];
  if (name && game.state !== "menu") e.preventDefault();
  if (name && !e.repeat) press(name, true);
  if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) togglePause();
  if (e.code === "KeyM" && !e.repeat) { muted = !muted; toast(muted ? "🔇 Sound off" : "🔊 Sound on"); }
  if (e.code === "Enter" && game.state === "clear") { e.preventDefault(); startLevel(game.n + 1); }
});
window.addEventListener("keyup", e => { const name = KEYMAP[e.code]; if (name) press(name, false); });
window.addEventListener("blur", () => { for (const k of Object.keys(keys)) keys[k] = false; });

if (window.matchMedia("(pointer: coarse)").matches) $("touch").classList.remove("hidden");
for (const btn of document.querySelectorAll("#touch button")) {
  const name = btn.dataset.key;
  const down = e => { e.preventDefault(); ensureAudio(); press(name, true); };
  const up = e => { e.preventDefault(); press(name, false); };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

const SCREENS = ["title-screen", "map-screen", "pause-screen", "clear-screen", "over-screen", "end-screen"];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", !!id && id !== "pause-screen");
}
function togglePause() {
  if (game.state === "play" || game.state === "goal") { game.pausedFrom = game.state; game.state = "pause"; showScreen("pause-screen"); }
  else if (game.state === "pause") { game.state = game.pausedFrom; showScreen(null); }
}
function openMap() {
  game.state = "menu";
  stopMusic();
  const map = $("map");
  map.innerHTML = "";
  ZONES.forEach((z, zi) => {
    const row = document.createElement("div");
    row.className = "world";
    const name = document.createElement("div");
    name.className = "world-name";
    name.textContent = z.name;
    row.appendChild(name);
    for (let a = 0; a < 3; a++) {
      const n = zi * 3 + a, best = save.best[n];
      const b = document.createElement("button");
      b.className = "lvl" + (a === 2 ? " fort" : "") + (best !== undefined ? " done" : "");
      b.disabled = n > save.unlocked;
      b.innerHTML = `${a === 2 ? "BOSS" : "ACT " + (a + 1)}<small>${best !== undefined ? "⏱ " + fmtTime(best) : n > save.unlocked ? "🔒" : "&nbsp;"}</small>`;
      b.addEventListener("click", () => { ensureAudio(); game.lives = START_LIVES; game.score = 0; game.seedBank = 0; startLevel(n); });
      row.appendChild(b);
    }
    map.appendChild(row);
  });
  showScreen("map-screen");
}
$("play").addEventListener("click", () => { ensureAudio(); openMap(); });
$("map-back").addEventListener("click", () => { showScreen("title-screen"); });
$("resume").addEventListener("click", togglePause);
$("pause-map").addEventListener("click", openMap);
$("next").addEventListener("click", () => startLevel(game.n + 1));
$("clear-map").addEventListener("click", openMap);
$("retry").addEventListener("click", () => { game.lives = START_LIVES; game.score = 0; game.seedBank = 0; startLevel(game.n); });
$("over-map").addEventListener("click", openMap);
$("end-map").addEventListener("click", openMap);

// Zipper on the title screen
(function drawTitleHero() {
  const c = $("hero-art").getContext("2d");
  c.setTransform(3, 0, 0, 3, 70, 84);
  drawZipper(c, { run: 0.2, speedy: true });
  c.setTransform(2.4, 0, 0, 2.4, 190, 82);
  drawZipper(c, { ball: true, spin: 0.6 });
})();

// ---------- 18. the main loop ----------
// behind the title screen, the camera glides slowly through the first level
level = buildLevel(0);
cam.y = 380 - cam.h * 0.6;
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (game.state === "play" || game.state === "dying" || game.state === "goal") {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  } else if (game.state === "menu" && !p) {
    cam.x = (cam.x + 60 * dt) % (level.width - cam.w);
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
