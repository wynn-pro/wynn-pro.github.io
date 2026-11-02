// Block Blaster: aim, fire and bounce energy balls to knock the number blocks down to zero.
// Blip the robot sits at the bottom of the board. Every turn the blocks creep one row closer.
// 4 worlds of 5 levels, a new trick in every world, and a boss block at the end of each one.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const COLS = 7;                // how many blocks fit across the board
const ROWS = 10;               // a block that moves past row 10 hits the red line
const CELL = 48;               // how big one block space is, in game pixels
const GAP = 2;                 // the little gap around every block
const W = COLS * CELL;         // the board is this wide...
const DANGER_Y = ROWS * CELL;  // ...the red line is here...
const FLOOR_Y = DANGER_Y + 44; // ...Blip stands here...
const H = FLOOR_Y + 16;        // ...and the board is this tall
const BALL_R = 6;
const BALL_SPEED = 640;
const FIRE_GAP = 0.06;         // seconds between each ball leaving the blaster
const MIN_ANGLE = 0.12;        // you can't aim flatter than this (it would bounce sideways forever)
const AIM_TURN = 1.4;          // how fast the arrow keys turn the blaster
const SHIFT_TIME = 0.28;       // how long the blocks take to slide down one row
const MAX_HEARTS = 3;
const FAST_AFTER = [4, 9];     // after this many seconds the balls go 2 times, then 3 times faster
const LEVELS_PER_WORLD = 5;
const BOSS_HP = [110, 230, 380, 560];
const SAVE_KEY = "blockblaster-save";
const STEP = 1 / 240;          // the balls move in tiny steps, so they never skip through a block

// ---------- 2. the 4 worlds ----------
// bomb, zap and split are how often those things turn up in that world (0 means never).
const WORLDS = [
  { name: "Candy Cubes", bossName: "King Gumdrop", decor: "candy",
    bg: ["#ff9ad5", "#ffd6a5"], board: "rgba(58, 20, 74, 0.9)", ball: "#fff6b0", boss: "#ff5fb4",
    blocks: ["#7fe3ff", "#6ee08a", "#ffe14d", "#ffa94d", "#ff6b9a", "#c77dff"],
    bomb: 0, zap: 0, split: 0, news: "Grab the +1 rings to get more balls!" },
  { name: "Lava Lab", bossName: "Magma Max", decor: "lava",
    bg: ["#3a0a0a", "#a8320f"], board: "rgba(34, 10, 10, 0.9)", ball: "#ffe9a8", boss: "#ff5a1f",
    blocks: ["#ffd166", "#ffab40", "#ff7b39", "#ff4d4d", "#d6336c", "#9c36b5"],
    bomb: 0.18, zap: 0, split: 0, news: "Bomb blocks blow up everything next to them!" },
  { name: "Frost Peaks", bossName: "The Ice Fortress", decor: "snow",
    bg: ["#0b2a4a", "#7fc8f5"], board: "rgba(10, 24, 48, 0.9)", ball: "#ffffff", boss: "#5cc8ff",
    blocks: ["#d8f5ff", "#9ee7ff", "#5cc8ff", "#4d8bff", "#7a5cff", "#c35cff"],
    bomb: 0.1, zap: 0.4, split: 0, news: "Zappers hit a whole row or column when a ball touches them!" },
  { name: "Star Station", bossName: "The Mothercube", decor: "stars",
    bg: ["#05030f", "#2a1052"], board: "rgba(12, 8, 30, 0.9)", ball: "#b9fffb", boss: "#8a7cff",
    blocks: ["#5ef2c2", "#5ec8f2", "#8a7cff", "#e05cff", "#ff5c9d", "#ffb35c"],
    bomb: 0.1, zap: 0.25, split: 0.22, news: "Splitter blocks break into two smaller blocks!" },
];
const LEVEL_COUNT = WORLDS.length * LEVELS_PER_WORLD;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - (1 - t) * (1 - t);
// a number between 0 and 1 that is always the same for the same k (for placing background sparkles)
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// a "seeded" random number maker: the same seed always gives the same numbers,
// so Candy Cubes 1 has the same blocks every time you play it.
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 3. saving ----------
function loadSave() {
  const fresh = { unlocked: 0, stars: Array(LEVEL_COUNT).fill(0), best: Array(LEVEL_COUNT).fill(0) };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && Array.isArray(s.stars)) return Object.assign(fresh, s);
  } catch (e) { /* no save yet, or the browser won't let us read it */ }
  return fresh;
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* playing without saving is fine */ }
}
const save = loadSave();

// ---------- 4. sound ----------
// Every sound is made up on the spot by the computer, so there are no sound files either.
let audio = null, muted = false, lastHit = 0;
function ensureAudio() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  if (audio && audio.state === "suspended") audio.resume();
}
function beep(freq, dur, type = "square", vol = 0.06, slide = 0) {
  if (!audio || muted) return;
  const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur);
}
function boom(dur = 0.35, vol = 0.2) {
  if (!audio || muted) return;
  const len = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, len, audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = audio.createBufferSource(), g = audio.createGain();
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(g).connect(audio.destination);
  src.start();
}
const sfx = {
  fire: () => beep(520, 0.04, "square", 0.025, 200),
  hit: n => {   // the more blocks you break in one turn, the higher the hits go
    const now = performance.now();
    if (now - lastHit < 28) return;
    lastHit = now;
    beep(300 + Math.min(n, 30) * 18, 0.05, "triangle", 0.05);
  },
  pop: () => { beep(660, 0.08, "square", 0.05, 400); beep(990, 0.1, "triangle", 0.04); },
  plus: () => { beep(880, 0.07, "sine", 0.08); setTimeout(() => beep(1320, 0.1, "sine", 0.07), 60); },
  coin: () => { beep(1200, 0.06, "square", 0.04); setTimeout(() => beep(1600, 0.1, "square", 0.04), 50); },
  zap: () => beep(1400, 0.18, "sawtooth", 0.04, -1100),
  bomb: () => { boom(0.45, 0.25); beep(120, 0.3, "sawtooth", 0.08, -80); },
  crash: () => { boom(0.5, 0.3); beep(160, 0.4, "square", 0.08, -120); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, "square", 0.06), i * 110)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.08), i * 150)),
};

// ---------- 5. the page bits we need ----------
const $ = id => document.getElementById(id);
const canvas = $("view"), ctx = canvas.getContext("2d");
const ui = {
  level: $("level-label"), balls: $("balls"), hearts: $("hearts"), rows: $("rows"), rowsPill: $("rows-pill"),
  score: $("score"), recall: $("recall"), toast: $("toast"), hudTop: document.querySelector(".hud-top"),
};
const screens = ["title-screen", "map-screen", "pause-screen", "clear-screen", "over-screen", "end-screen"];
function show(id) {
  for (const s of screens) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", id === "title-screen" || id === "map-screen" || id === "end-screen");
  if (id === "map-screen") buildMap();
  layout();
}
const setText = (el, v) => { v = String(v); if (el.textContent !== v) el.textContent = v; };
let toastTimer = 0;
function toast(text, time = 1.8) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  toastTimer = time;
}

// ---------- 6. making a level ----------
let G = null;        // everything about the level being played right now
let paused = false;

function levelInfo(n) {
  const w = Math.floor(n / LEVELS_PER_WORLD), i = n % LEVELS_PER_WORLD;
  return { w, i, isBoss: i === LEVELS_PER_WORLD - 1, rows: 8 + i * 2 + w, startBalls: 3 + w * 4 + i * 2 };
}
function levelName(n) {
  const { w, i, isBoss } = levelInfo(n);
  return isBoss ? "Boss: " + WORLDS[w].bossName : WORLDS[w].name + " " + (i + 1);
}

function startLevel(n) {
  const info = levelInfo(n), world = WORLDS[info.w];
  G = {
    n, w: info.w, world, isBoss: info.isBoss, rand: makeRng(n * 7919 + 13),
    blocks: [], items: [], balls: [], parts: [], texts: [], beams: [],
    startBalls: info.startBalls, ballCount: info.startBalls, pendingPlus: 0,
    hearts: MAX_HEARTS, score: 0, rowsLeft: info.isBoss ? 0 : info.rows, spawned: 0,
    bx: W / 2, bxDraw: W / 2, nextX: null, aim: Math.PI / 2, showAim: false, aimOk: true,
    state: "aim", fireT: 0, toFire: 0, fireClock: 0, acc: 0, speedMul: 1, shiftT: 0,
    broken: 0, boardClear: false, boss: null, shake: 0, endT: 0, time: 0,
  };
  if (G.isBoss) {
    G.boss = { kind: "boss", c: 2, fromC: 2, r: 0, w: 3, h: 2, hp: BOSS_HP[G.w], max: BOSS_HP[G.w], flash: 0 };
    G.blocks.push(G.boss);
  }
  // start with two rows already on the board
  const first = G.isBoss ? 2 : 0;
  spawnRow(first);
  for (const k of G.blocks) if (k !== G.boss) k.r++;
  for (const it of G.items) it.r++;
  spawnRow(first);
  paused = false;
  show(null);
  toast(G.isBoss ? "👑 " + world.bossName + "!" : info.i === 0 ? world.name + ": " + world.news : levelName(n), 2.6);
}

// put a new row of blocks (and goodies) at row r
function spawnRow(r) {
  const rand = G.rand, wd = G.world;
  // roughly how many balls you'll have (boss levels go easier on the rows, so you can reach the boss)
  const base = (G.startBalls + G.spawned * 0.9) * (1 + G.w * 0.05) * (G.isBoss ? 0.6 : 1);
  const cols = [...Array(COLS).keys()];
  for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  const count = G.isBoss ? 1 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * (2 + Math.min(G.w, 2)));
  for (let k = 0; k < count; k++) {
    let kind = "block", hp = Math.max(1, Math.round(base * (0.4 + rand() * 0.8)));
    if (rand() < 0.15) hp *= 2;                         // a tough one
    const roll = rand();
    if (roll < wd.bomb) { kind = "bomb"; hp = Math.max(1, Math.round(base * 0.5)); }
    else if (roll < wd.bomb + wd.split) kind = "split";
    G.blocks.push({ kind, c: cols[k], r, w: 1, h: 1, hp, max: hp, flash: 0 });
  }
  // the empty spaces get the goodies: always one +1 ring, sometimes a coin or a zapper
  const free = cols.slice(count);
  G.items.push({ kind: "plus", c: free[0], r });
  if (free[1] !== undefined && rand() < wd.zap) G.items.push({ kind: rand() < 0.5 ? "zapH" : "zapV", c: free[1], r });
  else if (free[1] !== undefined && rand() < 0.35) G.items.push({ kind: "coin", c: free[1], r });
  G.spawned++;
  if (!G.isBoss) G.rowsLeft--;
}

const blockRect = k => ({ x0: k.c * CELL + GAP, y0: k.r * CELL + GAP, x1: (k.c + k.w) * CELL - GAP, y1: (k.r + k.h) * CELL - GAP });
const occupied = (c, r) => G.blocks.some(k => !k.dead && c >= k.c && c < k.c + k.w && r >= k.r && r < k.r + k.h);
const itemX = it => it.c * CELL + CELL / 2, itemY = it => it.r * CELL + CELL / 2;

// ---------- 7. aiming and firing ----------
function setAimFrom(px, py) {
  const dy = (FLOOR_Y - BALL_R) - py;
  G.aimOk = dy > 10;                                     // pointing below Blip means "don't fire"
  G.aim = clamp(Math.atan2(Math.max(dy, 1), px - G.bx), MIN_ANGLE, Math.PI - MIN_ANGLE);
}

function fire() {
  if (!G || paused || G.state !== "aim" || !G.aimOk) return;
  G.state = "fire";
  G.toFire = G.ballCount;
  G.fireClock = 0;
  G.fireT = 0;
  G.acc = 0;
  G.speedMul = 1;
  G.nextX = null;
  G.broken = 0;
  G.boardClear = false;
  G.fireAim = G.aim;
  if (pointer.type !== "mouse") G.showAim = false;
}

// "bring the balls back": every ball flies straight home
function recall() {
  if (!G || G.state !== "fire") return;
  G.toFire = 0;
  if (G.nextX === null) G.nextX = G.bx;
  for (const b of G.balls) b.home = true;
}

// ---------- 8. the balls bouncing ----------
// One tiny step for everything. The game does 240 of these every second (more when it speeds up).
function simStep() {
  if (G.toFire > 0) {
    G.fireClock -= STEP;
    if (G.fireClock <= 0) {
      G.fireClock += FIRE_GAP;
      G.toFire--;
      G.balls.push({ x: G.bx, y: FLOOR_Y - BALL_R, vx: Math.cos(G.fireAim) * BALL_SPEED,
        vy: -Math.sin(G.fireAim) * BALL_SPEED, home: false, inside: new Set(), age: 0 });
      sfx.fire();
    }
  }
  for (const b of G.balls) {
    if (b.home) goHome(b);
    else moveBall(b);
  }
  G.balls = G.balls.filter(b => !b.done);
  G.items = G.items.filter(it => !it.gone);
  if (G.blocks.some(k => k.dead)) G.blocks = G.blocks.filter(k => !k.dead);
  if (G.state !== "fire") return;

  if (G.blocks.length === 0 && !G.isBoss) {
    if (G.rowsLeft === 0) return winLevel();
    if (!G.boardClear) {
      G.boardClear = true;
      G.score += 100;
      floatText(W / 2, DANGER_Y / 2, "BOARD CLEAR! +100", "#ffe36b", 22);
      sfx.coin();
    }
  }
  if (G.toFire === 0 && G.balls.length === 0) endTurn();
}

function moveBall(b) {
  b.age += STEP;
  b.x += b.vx * STEP;
  b.y += b.vy * STEP;
  let bounced = false;
  if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); bounced = true; }
  if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); bounced = true; }
  if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); bounced = true; }
  for (const k of G.blocks) {
    if (!k.dead && bounceOff(b, blockRect(k))) { damage(k, 1); bounced = true; }
  }
  for (const it of G.items) {
    if (it.gone) continue;
    const d = Math.hypot(b.x - itemX(it), b.y - itemY(it));
    if (d < BALL_R + 12) {
      if (!b.inside.has(it)) { b.inside.add(it); touchItem(it); }
    } else if (b.inside.has(it)) b.inside.delete(it);
  }
  if (bounced) unflatten(b);
  if (b.vy > 0 && b.y >= FLOOR_Y - BALL_R && b.age > 0.05) {
    b.y = FLOOR_Y - BALL_R;
    b.home = true;
    if (G.nextX === null) G.nextX = clamp(b.x, 16, W - 16);   // the first ball back decides where Blip goes
  }
}

// Bounce a ball off a block. The closest point of the block to the ball tells us which way to bounce,
// so hitting a corner sends the ball off at an angle, just like real life.
// It only says "yes, hit" if the ball was moving into the block, so a ball can't hit twice.
function bounceOff(b, r) {
  const cx = clamp(b.x, r.x0, r.x1), cy = clamp(b.y, r.y0, r.y1);
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= BALL_R) return false;
  if (d < 0.001) {
    // the middle of the ball got inside the block: push it out the nearest side
    const sides = [[b.x - r.x0, -1, 0], [r.x1 - b.x, 1, 0], [b.y - r.y0, 0, -1], [r.y1 - b.y, 0, 1]];
    sides.sort((a, z) => a[0] - z[0]);
    [, nx, ny] = sides[0];
    if (nx) b.x = nx < 0 ? r.x0 - BALL_R : r.x1 + BALL_R;
    if (ny) b.y = ny < 0 ? r.y0 - BALL_R : r.y1 + BALL_R;
  } else {
    nx /= d; ny /= d;
    b.x = cx + nx * BALL_R;
    b.y = cy + ny * BALL_R;
  }
  const dot = b.vx * nx + b.vy * ny;
  if (dot >= 0) return false;
  b.vx -= 2 * dot * nx;
  b.vy -= 2 * dot * ny;
  return true;
}

// a ball going almost flat would bounce side to side for ages, so give it a little push up or down
function unflatten(b) {
  const minVy = BALL_SPEED * 0.14;
  if (Math.abs(b.vy) < minVy) b.vy = b.vy > 0 ? minVy : -minVy;
  const s = Math.hypot(b.vx, b.vy);
  b.vx *= BALL_SPEED / s;
  b.vy *= BALL_SPEED / s;
}

function goHome(b) {
  const tx = G.nextX, ty = FLOOR_Y - BALL_R;
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), move = 1100 * STEP;
  if (d <= move) { b.done = true; return; }
  b.x += dx / d * move;
  b.y += dy / d * move;
}

// ---------- 9. hitting blocks and goodies ----------
function damage(k, amount) {
  if (k.dead) return;
  k.hp -= amount;
  k.flash = 0.1;
  G.score += 1;
  if (k.hp > 0) { sfx.hit(G.broken); return; }
  k.dead = true;
  G.broken++;
  G.score += 10;
  const r = blockRect(k);
  burst((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, blockColor(k, k.max), k.kind === "boss" ? 60 : 14);
  sfx.pop();
  if (G.broken === 5) floatText(W / 2, DANGER_Y * 0.55, "BLAST!", "#ffe36b", 28);
  if (G.broken === 10) floatText(W / 2, DANGER_Y * 0.55, "MEGA BLAST!", "#ff9a3c", 30);
  if (G.broken === 20) floatText(W / 2, DANGER_Y * 0.55, "ULTRA BLAST!!", "#ff5fb4", 32);

  if (k.kind === "bomb") explode(k);
  if (k.kind === "split") {
    for (const c of [k.c - 1, k.c + 1]) {
      if (c < 0 || c >= COLS || occupied(c, k.r)) continue;
      const hp = Math.max(1, Math.ceil(k.max / 2));
      G.blocks.push({ kind: "block", c, r: k.r, w: 1, h: 1, hp, max: hp, flash: 0.2 });
    }
  }
  if (k.kind === "boss") {
    for (const o of G.blocks) {
      if (o.dead) continue;
      o.dead = true;
      const or = blockRect(o);
      burst((or.x0 + or.x1) / 2, (or.y0 + or.y1) / 2, blockColor(o, o.max), 10);
    }
    G.score += 500;
    sfx.bomb();
    G.shake = 0.6;
    winLevel();
  }
}

// a bomb block smashes every block around it (and can set off other bombs!)
function explode(k) {
  sfx.bomb();
  G.shake = Math.max(G.shake, 0.3);
  const cx = k.c * CELL + CELL / 2, cy = k.r * CELL + CELL / 2;
  G.beams.push({ kind: "ring", x: cx, y: cy, t: 0.35 });
  for (const o of G.blocks) {
    if (o.dead || o === k) continue;
    const near = o.c <= k.c + 1 && o.c + o.w - 1 >= k.c - 1 && o.r <= k.r + 1 && o.r + o.h - 1 >= k.r - 1;
    if (!near) continue;
    damage(o, o.kind === "boss" ? Math.ceil(o.max * 0.1) : o.hp);
  }
}

function touchItem(it) {
  const x = itemX(it), y = itemY(it);
  if (it.kind === "plus") {
    it.gone = true;
    G.pendingPlus++;
    floatText(x, y, "+1", "#9cff8a", 20);
    sfx.plus();
  } else if (it.kind === "coin") {
    it.gone = true;
    G.score += 25;
    floatText(x, y, "+25", "#ffe36b", 18);
    burst(x, y, "#ffd23f", 8);
    sfx.coin();
  } else {
    // a zapper stays for the whole turn and zaps every time a ball goes through it
    it.used = true;
    G.beams.push({ kind: it.kind, x, y, t: 0.22 });
    sfx.zap();
    for (const k of G.blocks) {
      if (k.dead) continue;
      const inRow = it.r >= k.r && it.r < k.r + k.h, inCol = it.c >= k.c && it.c < k.c + k.w;
      if (it.kind === "zapH" ? inRow : inCol) damage(k, 1);
    }
  }
}

// ---------- 10. between turns ----------
function endTurn() {
  G.ballCount += G.pendingPlus;
  G.pendingPlus = 0;
  G.items = G.items.filter(it => !it.used);
  if (G.nextX !== null) G.bx = G.nextX;
  for (const k of G.blocks) if (k !== G.boss) k.r++;
  for (const it of G.items) it.r++;
  if (G.boss) {
    // the boss shuffles to a new spot
    G.boss.fromC = G.boss.c;
    const spots = [0, 1, 2, 3, 4].filter(c => c !== G.boss.c && c + G.boss.w <= COLS);
    G.boss.c = spots[Math.floor(G.rand() * spots.length)];
  }
  if (G.isBoss || G.rowsLeft > 0) spawnRow(G.isBoss ? 2 : 0);
  G.state = "shift";
  G.shiftT = 0;
}

function afterShift() {
  if (G.boss) G.boss.fromC = G.boss.c;
  for (const k of G.blocks) {
    if (k === G.boss || k.r < ROWS) continue;
    // this block reached the red line: it smashes a shield
    k.dead = true;
    G.hearts--;
    const r = blockRect(k);
    burst((r.x0 + r.x1) / 2, DANGER_Y, "#ff4d4d", 20);
    G.shake = 0.5;
    sfx.crash();
  }
  for (const it of G.items) {
    if (it.r < ROWS) continue;
    it.gone = true;
    if (it.kind === "plus") { G.ballCount++; floatText(itemX(it), DANGER_Y - 10, "+1", "#9cff8a", 18); }
  }
  G.blocks = G.blocks.filter(k => !k.dead);
  G.items = G.items.filter(it => !it.gone);
  if (G.hearts <= 0) {
    G.hearts = 0;
    G.state = "lost";
    G.endT = 1.4;
    toast("Oh no! 💥", 1.4);
    sfx.lose();
  } else if (!G.isBoss && G.rowsLeft === 0 && G.blocks.length === 0) {
    winLevel();
  } else {
    G.state = "aim";
  }
}

function winLevel() {
  G.state = "won";
  G.endT = 1.5;
  G.balls = [];
  toast(G.isBoss ? "BOSS BLASTED! 👑" : "LEVEL CLEAR! 🎉", 1.5);
  sfx.win();
}

function finishLevel() {
  const n = G.n, stars = G.hearts;
  save.stars[n] = Math.max(save.stars[n] || 0, stars);
  save.best[n] = Math.max(save.best[n] || 0, G.score);
  save.unlocked = Math.max(save.unlocked, Math.min(n + 1, LEVEL_COUNT - 1));
  writeSave();
  if (n === LEVEL_COUNT - 1) {
    const total = save.stars.reduce((a, b) => a + b, 0);
    $("end-text").innerHTML = `You blasted <b>The Mothercube</b> and saved Blip's world!<br>
      You have <b>${total}</b> of ${LEVEL_COUNT * 3} stars. Can you get them all?`;
    G = null;
    show("end-screen");
    return;
  }
  $("clear-title").innerHTML = G.isBoss ? "BOSS <span>BLASTED!</span>" : "LEVEL <span>CLEAR!</span>";
  $("clear-stars").innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? "" : "off"}">⭐</span>`).join("");
  const nextWorld = G.isBoss ? `<br>Next stop: <b>${WORLDS[G.w + 1].name}</b>!` : "";
  $("clear-text").innerHTML = `Score <b>${G.score}</b> (best ${save.best[n]}).` +
    (stars === 3 ? " Perfect, no shields lost!" : "") + nextWorld;
  show("clear-screen");
}

// ---------- 11. the main loop ----------
function update(dt) {
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) ui.toast.classList.remove("show");
  if (!G || paused) return;
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt);
  G.bxDraw = lerp(G.bxDraw, G.bx, Math.min(1, dt * 10));
  for (const k of G.blocks) k.flash = Math.max(0, k.flash - dt);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.y -= 30 * dt; t.life -= dt; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const b of G.beams) b.t -= dt;
  G.beams = G.beams.filter(b => b.t > 0);

  if (G.state === "aim") {
    const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    if (turn) {
      G.aim = clamp(G.aim + turn * AIM_TURN * (keys.shift ? 0.3 : 1) * dt, MIN_ANGLE, Math.PI - MIN_ANGLE);
      G.showAim = true;
      G.aimOk = true;
    }
  } else if (G.state === "fire") {
    G.fireT += dt;
    G.speedMul = G.fireT > FAST_AFTER[1] ? 3 : G.fireT > FAST_AFTER[0] ? 2 : 1;
    if (G.fireT > 30) recall();
    G.acc = Math.min(G.acc + dt * G.speedMul, STEP * 60);
    while (G.acc >= STEP && G.state === "fire") { G.acc -= STEP; simStep(); }
  } else if (G.state === "shift") {
    G.shiftT += dt;
    if (G.shiftT >= SHIFT_TIME) afterShift();
  } else if (G.state === "won" || G.state === "lost") {
    G.endT -= dt;
    if (G.endT <= 0) {
      const won = G.state === "won";
      G.state = "done";     // so we only show the end screen once
      if (won) finishLevel();
      else show("over-screen");
    }
  }
}

function updateHud() {
  if (!G) return;
  setText(ui.level, levelName(G.n));
  setText(ui.balls, G.ballCount + (G.pendingPlus ? " +" + G.pendingPlus : ""));
  setText(ui.hearts, "❤️".repeat(G.hearts) + "🖤".repeat(MAX_HEARTS - G.hearts));
  setText(ui.rows, G.rowsLeft);
  ui.rowsPill.classList.toggle("hidden", G.isBoss);
  setText(ui.score, G.score);
  ui.recall.classList.toggle("hidden", G.state !== "fire");
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  updateHud();
  draw();
  requestAnimationFrame(frame);
}

// ---------- 12. little effects ----------
function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.5 + Math.random() * 0.5,
      color, size: 3 + Math.random() * 5 });
  }
}
function floatText(x, y, text, color, size) {
  G.texts.push({ x, y, text, color, size, life: 1.1 });
}

// ---------- 13. drawing ----------
let scale = 1, offX = 0, offY = 0, dpr = 1;
function layout() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  const top = document.body.classList.contains("in-menu") ? 12 : ui.hudTop.getBoundingClientRect().bottom + 10;
  scale = Math.min((innerWidth - 16) / W, (innerHeight - top - 10) / H);
  offX = (innerWidth - W * scale) / 2;
  offY = top + (innerHeight - top - 10 - H * scale) / 2;
}
addEventListener("resize", layout);

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// blocks with bigger numbers get "hotter" colours
function blockColor(k, hp = k.hp) {
  if (k.kind === "boss") return G.world.boss;
  if (k.kind === "bomb") return "#3b3b4a";
  const top = G.startBalls + G.spawned + 4;
  const pal = G.world.blocks;
  return pal[clamp(Math.floor(hp / top * pal.length), 0, pal.length - 1)];
}

function drawBackground() {
  const wd = G ? G.world : WORLDS[0], t = G ? G.time : performance.now() / 1000;
  const g = ctx.createLinearGradient(0, 0, 0, innerHeight);
  g.addColorStop(0, wd.bg[0]);
  g.addColorStop(1, wd.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  // floating bits that match the world
  for (let i = 0; i < 40; i++) {
    const hx = hash(i), hy = hash(i + 100), hs = hash(i + 200);
    let x = hx * innerWidth, y = hy * innerHeight;
    ctx.globalAlpha = 0.35;
    if (wd.decor === "candy") {
      y = (hy * innerHeight - t * (10 + hs * 20)) % innerHeight; if (y < 0) y += innerHeight;
      ctx.fillStyle = ["#fff", "#ffe14d", "#7fe3ff", "#c77dff"][i % 4];
      ctx.beginPath(); ctx.arc(x, y, 4 + hs * 10, 0, Math.PI * 2); ctx.fill();
    } else if (wd.decor === "lava") {
      y = innerHeight - ((t * (20 + hs * 40) + hy * innerHeight) % innerHeight);
      ctx.fillStyle = "#ffb347";
      ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 8, y, 2 + hs * 6, 0, Math.PI * 2); ctx.fill();
    } else if (wd.decor === "snow") {
      y = (t * (20 + hs * 30) + hy * innerHeight) % innerHeight;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 0.8 + i) * 14, y, 1.5 + hs * 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + hs) + i));
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 1 + hs * 2.5, 1 + hs * 2.5);
    }
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground();
  if (!G) return;
  const sx = G.shake > 0 ? (Math.random() - 0.5) * 12 * G.shake : 0;
  const sy = G.shake > 0 ? (Math.random() - 0.5) * 12 * G.shake : 0;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + sx), dpr * (offY + sy));

  // the board
  ctx.fillStyle = G.world.board;
  rr(ctx, -8, -8, W + 16, H + 16, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  rr(ctx, -8, -8, W + 16, H + 16, 16);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, DANGER_Y); ctx.stroke(); }
  for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
  // the red line
  ctx.strokeStyle = "rgba(255, 77, 77, " + (0.55 + 0.3 * Math.sin(G.time * 4)) + ")";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(W, DANGER_Y); ctx.stroke();
  ctx.setLineDash([]);
  // the floor
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, FLOOR_Y + 1, W, H - FLOOR_Y + 8);

  // while sliding down, everything starts one row higher and glides into place
  const k = G.state === "shift" ? ease(Math.min(1, G.shiftT / SHIFT_TIME)) : 1;
  const slide = (k - 1) * CELL;
  for (const it of G.items) drawItem(it, slide);
  for (const b of G.blocks) if (b !== G.boss) drawBlock(b, slide);
  if (G.boss) drawBoss(G.boss, k);
  for (const b of G.beams) drawBeam(b);
  if (G.state === "aim" && G.showAim) drawAimLine();

  for (const b of G.balls) {
    ctx.fillStyle = G.world.ball;
    ctx.shadowColor = G.world.ball;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  drawBlip(ctx, G.bxDraw, FLOOR_Y, G.state === "fire" ? G.fireAim : G.aim, G.world.ball);
  // how many balls Blip has
  const count = G.state === "fire" ? G.toFire : G.ballCount;
  if (count > 0 && G.state !== "won" && G.state !== "done") {
    const right = G.bxDraw > W - 60;
    ctx.font = "16px 'Lilita One', sans-serif";
    ctx.textAlign = right ? "right" : "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText("×" + count, G.bxDraw + (right ? -24 : 24), FLOOR_Y - 4);
  }
  if (G.state === "fire" && G.speedMul > 1) {
    ctx.font = "16px 'Lilita One', sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffe36b";
    ctx.fillText("⏩ ×" + G.speedMul, W - 6, DANGER_Y + 20);
  }

  for (const p of G.parts) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of G.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.font = t.size + "px 'Lilita One', sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBlockShape(c, x, y, w, h, color, label, flash) {
  rr(c, x, y, w, h, 7);
  c.fillStyle = color;
  c.fill();
  // a shiny top and a shadowy bottom make it look 3D
  c.fillStyle = "rgba(255,255,255,0.28)";
  rr(c, x + 3, y + 3, w - 6, h * 0.32, 5);
  c.fill();
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.fillRect(x + 4, y + h - 6, w - 8, 3);
  if (flash > 0) {
    c.fillStyle = "rgba(255,255,255," + flash * 6 + ")";
    rr(c, x, y, w, h, 7);
    c.fill();
  }
  if (label !== undefined) {
    const s = String(label);
    c.font = (s.length > 3 ? 15 : 19) + "px 'Lilita One', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 4;
    c.strokeStyle = "rgba(0,0,0,0.45)";
    c.strokeText(s, x + w / 2, y + h / 2 + 2);
    c.fillStyle = "#fff";
    c.fillText(s, x + w / 2, y + h / 2 + 2);
  }
}

function drawBlock(k, slide) {
  const r = blockRect(k), x = r.x0, y = r.y0 + slide, w = r.x1 - r.x0, h = r.y1 - r.y0;
  drawBlockShape(ctx, x, y, w, h, blockColor(k), k.hp, k.flash);
  if (k.kind === "bomb") {
    // a fizzing fuse in the corner
    ctx.strokeStyle = "#c9a36b";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w - 10, y + 10); ctx.quadraticCurveTo(x + w - 2, y + 6, x + w - 4, y - 2); ctx.stroke();
    ctx.fillStyle = Math.sin(G.time * 20) > 0 ? "#ffe14d" : "#ff7b39";
    ctx.beginPath(); ctx.arc(x + w - 4, y - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ff4d4d";
    ctx.lineWidth = 2;
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 6);
    ctx.stroke();
  } else if (k.kind === "split") {
    // a zig-zag crack down the middle
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 2);
    ctx.lineTo(x + w / 2 - 4, y + 10); ctx.lineTo(x + w / 2 + 3, y + 14);
    ctx.moveTo(x + w / 2 + 3, y + h - 14); ctx.lineTo(x + w / 2 - 4, y + h - 10); ctx.lineTo(x + w / 2, y + h - 2);
    ctx.stroke();
  }
}

function drawBoss(b, k) {
  const c = lerp(b.fromC, b.c, k);
  const x = c * CELL + GAP, y = b.r * CELL + GAP, w = b.w * CELL - GAP * 2, h = b.h * CELL - GAP * 2;
  drawBlockShape(ctx, x, y, w, h, G.world.boss, undefined, b.flash);
  // an angry face that watches Blip
  const look = clamp((G.bxDraw - (x + w / 2)) / 80, -1, 1) * 3;
  for (const ex of [x + w * 0.32, x + w * 0.68]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(ex, y + 28, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1030";
    ctx.beginPath(); ctx.arc(ex + look, y + 31, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#1a1030";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + 12); ctx.lineTo(x + w * 0.42, y + 19);
  ctx.moveTo(x + w * 0.8, y + 12); ctx.lineTo(x + w * 0.58, y + 19);
  ctx.stroke();
  ctx.lineCap = "butt";
  // its number and a health bar
  ctx.font = "20px 'Lilita One', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.strokeText(b.hp, x + w / 2, y + 58);
  ctx.fillStyle = "#fff";
  ctx.fillText(b.hp, x + w / 2, y + 58);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 10, y + h - 12, w - 20, 6);
  ctx.fillStyle = "#9cff8a";
  ctx.fillRect(x + 10, y + h - 12, (w - 20) * Math.max(0, b.hp / b.max), 6);
}

function drawItem(it, slide) {
  const x = itemX(it), y = itemY(it) + slide, t = G.time;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (it.kind === "plus") {
    const pulse = 11 + Math.sin(t * 5 + it.c) * 1.5;
    ctx.strokeStyle = "#9cff8a";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.font = "14px 'Lilita One', sans-serif";
    ctx.fillStyle = "#9cff8a";
    ctx.fillText("+1", x, y + 1);
  } else if (it.kind === "coin") {
    const squish = Math.abs(Math.cos(t * 3 + it.c));
    ctx.fillStyle = "#ffd23f";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, 9 * squish + 1, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    // zappers: a glowing orb with arrows that show which way it zaps
    ctx.fillStyle = it.used ? "#ffffff" : "#7ff6ff";
    ctx.shadowColor = "#7ff6ff";
    ctx.shadowBlur = 10 + Math.sin(t * 8) * 4;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#7ff6ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (it.kind === "zapH") { ctx.moveTo(x - 20, y); ctx.lineTo(x - 12, y); ctx.moveTo(x + 12, y); ctx.lineTo(x + 20, y); }
    else { ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 12); ctx.moveTo(x, y + 12); ctx.lineTo(x, y + 20); }
    ctx.stroke();
  }
}

function drawBeam(b) {
  if (b.kind === "ring") {
    const p = 1 - b.t / 0.35;
    ctx.strokeStyle = "rgba(255, 160, 60, " + (1 - p) + ")";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(b.x, b.y, 10 + p * CELL * 1.6, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  ctx.fillStyle = "rgba(127, 246, 255, " + (b.t / 0.22) * 0.7 + ")";
  if (b.kind === "zapH") ctx.fillRect(0, b.y - 5, W, 10);
  else ctx.fillRect(b.x - 5, 0, 10, DANGER_Y);
}

// the dotted line that shows where your shot will go, up to the first bounce and a little after it
function drawAimLine() {
  let x = G.bx, y = FLOOR_Y - BALL_R, dx = Math.cos(G.aim), dy = -Math.sin(G.aim);
  let len = 0, maxLen = 900, bounced = false, nextDot = 14;
  ctx.fillStyle = G.aimOk ? "#ffffff" : "rgba(255,255,255,0.25)";
  for (let s = 0; s < 400 && len < maxLen; s++) {
    x += dx * 3; y += dy * 3; len += 3;
    let nx = 0, ny = 0;
    if (x < BALL_R) nx = 1;
    else if (x > W - BALL_R) nx = -1;
    else if (y < BALL_R) ny = 1;
    else {
      for (const k of G.blocks) {
        const r = blockRect(k), cx = clamp(x, r.x0, r.x1), cy = clamp(y, r.y0, r.y1), d = Math.hypot(x - cx, y - cy);
        if (d < BALL_R && d > 0) { nx = (x - cx) / d; ny = (y - cy) / d; break; }
      }
    }
    const dot = dx * nx + dy * ny;
    if (dot < 0) {
      dx -= 2 * dot * nx;
      dy -= 2 * dot * ny;
      if (bounced) break;
      bounced = true;
      maxLen = len + 70;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (len >= nextDot) {
      nextDot += 13;
      ctx.globalAlpha = bounced ? Math.max(0, (maxLen - len) / 70) : 1;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// Blip the robot with the blaster on its head
function drawBlip(c, x, y, aim, glow) {
  c.save();
  c.translate(x, y);
  // the blaster barrel
  c.save();
  c.rotate(-aim);
  c.fillStyle = "#5a6688";
  rr(c, 0, -5, 26, 10, 4);
  c.fill();
  c.fillStyle = glow;
  c.fillRect(22, -5, 4, 10);
  c.restore();
  // wheels
  c.fillStyle = "#2a2f45";
  c.beginPath(); c.arc(-10, 5, 5, 0, Math.PI * 2); c.arc(10, 5, 5, 0, Math.PI * 2); c.fill();
  // the round body
  c.fillStyle = "#e9eefc";
  c.beginPath(); c.arc(0, 0, 15, Math.PI, 0); c.lineTo(15, 3); c.lineTo(-15, 3); c.closePath(); c.fill();
  c.fillStyle = "#c7cfea";
  c.fillRect(-15, -1, 30, 4);
  // the face screen, with eyes that look where you aim
  c.fillStyle = "#1d2240";
  rr(c, -10, -12, 20, 9, 4);
  c.fill();
  const lx = Math.cos(aim) * 2.5;
  c.fillStyle = glow;
  c.beginPath(); c.arc(-4 + lx, -7.5, 2, 0, Math.PI * 2); c.arc(4 + lx, -7.5, 2, 0, Math.PI * 2); c.fill();
  // antenna
  c.strokeStyle = "#c7cfea";
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -15); c.lineTo(0, -21); c.stroke();
  c.fillStyle = "#ff5fb4";
  c.beginPath(); c.arc(0, -22, 3, 0, Math.PI * 2); c.fill();
  c.restore();
}

// the little picture on the title screen
function drawHero() {
  const h = $("hero-art"), c = h.getContext("2d");
  c.clearRect(0, 0, h.width, h.height);
  const pal = WORLDS[0].blocks;
  const blocks = [[20, 6, 3, 12], [66, 6, 5, 7], [158, 6, 2, 25], [204, 6, 4, 3], [112, 50, 1, 9], [204, 50, 0, 4]];
  for (const [x, y, ci, n] of blocks) drawBlockShape(c, x, y, 40, 40, pal[ci], n, 0);
  c.fillStyle = "#fff";
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(130 - i * 9, 100 - i * 10, 2.5, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#fff6b0";
  c.shadowColor = "#fff6b0";
  c.shadowBlur = 8;
  for (const [bx, by] of [[86, 54], [98, 42], [180, 60]]) { c.beginPath(); c.arc(bx, by, 5, 0, Math.PI * 2); c.fill(); }
  c.shadowBlur = 0;
  drawBlip(c, 130, 96, 2.1, "#7fe3ff");
}

// ---------- 14. keyboard, mouse and touch ----------
const keys = { left: false, right: false, shift: false };
const pointer = { down: false, type: "mouse" };

function toWorld(e) {
  return { x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale };
}
canvas.addEventListener("pointerdown", e => {
  ensureAudio();
  pointer.type = e.pointerType;
  if (!G || paused || G.state !== "aim") return;
  pointer.down = true;
  canvas.setPointerCapture(e.pointerId);
  const p = toWorld(e);
  setAimFrom(p.x, p.y);
  G.showAim = true;
});
canvas.addEventListener("pointermove", e => {
  pointer.type = e.pointerType;
  if (!G || paused || G.state !== "aim") return;
  if (!pointer.down && e.pointerType !== "mouse") return;
  const p = toWorld(e);
  setAimFrom(p.x, p.y);
  G.showAim = true;
});
canvas.addEventListener("pointerup", e => {
  if (!pointer.down) return;
  pointer.down = false;
  if (!G || paused || G.state !== "aim") return;
  if (G.aimOk) fire();
  else if (e.pointerType !== "mouse") G.showAim = false;
});
canvas.addEventListener("pointercancel", () => { pointer.down = false; });

function setKey(e, down) {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = down;
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = down;
  else if (e.key === "Shift") keys.shift = down;
  else return false;
  return true;
}
addEventListener("keydown", e => {
  ensureAudio();
  if (setKey(e, true)) { e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  if (k === "m") { muted = !muted; toast(muted ? "🔇 Sound off" : "🔊 Sound on", 1); return; }
  if (!$("clear-screen").classList.contains("hidden") && k === "enter") { $("next").click(); return; }
  if (!G) return;
  if (k === "escape" || k === "p") { e.preventDefault(); togglePause(); return; }
  if (paused) return;
  if (k === " " || k === "enter" || k === "arrowup" || k === "w") { e.preventDefault(); G.aimOk = true; fire(); }
  else if (k === "r" || k === "arrowdown" || k === "s") recall();
});
addEventListener("keyup", e => setKey(e, false));
addEventListener("blur", () => { keys.left = keys.right = keys.shift = false; });

function togglePause() {
  if (!G || !["aim", "fire", "shift"].includes(G.state)) return;
  paused = !paused;
  show(paused ? "pause-screen" : null);
}

// ---------- 15. menus ----------
function buildMap() {
  const map = $("map");
  map.innerHTML = "";
  WORLDS.forEach((wd, w) => {
    const row = document.createElement("div");
    row.className = "world";
    row.innerHTML = `<div class="world-name">${w + 1}. ${wd.name}</div>`;
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const n = w * LEVELS_PER_WORLD + i, info = levelInfo(n);
      const b = document.createElement("button");
      const stars = save.stars[n] || 0;
      b.className = "lvl" + (info.isBoss ? " boss" : "") + (stars ? " done" : "");
      b.disabled = n > save.unlocked;
      b.innerHTML = (info.isBoss ? "👑" : `${w + 1}-${i + 1}`) +
        `<small>${stars ? "⭐".repeat(stars) : info.isBoss ? "Boss" : ""}</small>`;
      b.title = levelName(n);
      b.addEventListener("click", () => { ensureAudio(); startLevel(n); });
      row.appendChild(b);
    }
    map.appendChild(row);
  });
}

$("play").addEventListener("click", () => { ensureAudio(); show("map-screen"); });
$("map-back").addEventListener("click", () => show("title-screen"));
$("resume").addEventListener("click", togglePause);
$("pause").addEventListener("click", togglePause);
$("recall").addEventListener("click", recall);
$("pause-restart").addEventListener("click", () => startLevel(G.n));
$("pause-map").addEventListener("click", () => { G = null; paused = false; show("map-screen"); });
$("next").addEventListener("click", () => startLevel(Math.min(save.unlocked, G.n + 1)));
$("clear-map").addEventListener("click", () => { G = null; show("map-screen"); });
$("retry").addEventListener("click", () => startLevel(G.n));
$("over-map").addEventListener("click", () => { G = null; show("map-screen"); });
$("end-map").addEventListener("click", () => show("map-screen"));

// ---------- 16. off we go! ----------
layout();
drawHero();
if (document.fonts) document.fonts.ready.then(drawHero);
requestAnimationFrame(frame);
