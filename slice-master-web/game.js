// Slice Master: the dojo throws things in the air and you slice them in half with your blade.
// Everything runs in the browser: no server, no downloads, so it works on GitHub Pages.
"use strict";

const W = 960;
const H = 560;
const GRAVITY = 620;          // pixels per second per second
const BLADE_SPEED = 260;      // the blade only cuts when it moves at least this fast (pixels per second)
const TRAIL_TIME = 0.16;      // how long the blade trail stays on screen
const COMBO_GAP = 0.35;       // slices closer together than this count as one combo
const PERFECT = 0.78;         // halves at least this even (small area / big area) are a perfect cut
const SLOW_TIME = 4;          // seconds of slow-motion from an hourglass
const SLOW_SPEED = 0.4;
const EGG_PENALTY = 5;        // seconds lost for cutting a dragon egg
const BELT_TIME = 40;
const BLITZ_TIME = 60;
const INK = "#2a1d14";

const SAVE_KEY = "slicemaster-save";

// the belts, easiest first. every = seconds between throws, volley = how many per throw,
// egg and iron = the chance each thrown thing is a dragon egg or an iron block
const BELTS = [
  { name: "White",  color: "#f4f1ea", goal: 150, every: 1.25, volley: [1, 2], egg: 0,    iron: 0 },
  { name: "Yellow", color: "#ffd84a", goal: 250, every: 1.15, volley: [1, 2], egg: 0.05, iron: 0.03 },
  { name: "Orange", color: "#ff9a3c", goal: 350, every: 1.05, volley: [1, 3], egg: 0.08, iron: 0.06 },
  { name: "Green",  color: "#5fcf6a", goal: 450, every: 1.0,  volley: [1, 3], egg: 0.1,  iron: 0.08 },
  { name: "Blue",   color: "#4aa8ff", goal: 560, every: 0.95, volley: [2, 3], egg: 0.12, iron: 0.1 },
  { name: "Purple", color: "#a56bff", goal: 680, every: 0.9,  volley: [2, 4], egg: 0.14, iron: 0.12 },
  { name: "Brown",  color: "#9a6a44", goal: 800, every: 0.85, volley: [2, 4], egg: 0.16, iron: 0.14 },
  { name: "Black",  color: "#1d1d24", goal: 950, every: 0.8,  volley: [2, 4], egg: 0.18, iron: 0.16 },
];

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---------- shapes ----------
// every thing is a convex outline (a list of points around its middle), so it can be cut along any line

function ellipsePoly(rx, ry, n = 20) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
  });
}
function rectPoly(w, h) {
  return [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
}

// each kind paints itself around (0, 0). The painting is clipped to the outline, so it can spill over.
// juice = color of the bits that fly out, inside = color of the fresh cut
const KINDS = {
  log: {
    poly: ellipsePoly(36, 36), pts: 10, juice: "#d9a46b", inside: "#f3d2a2",
    draw(c) {
      c.fillStyle = "#6b4226"; c.fillRect(-60, -60, 120, 120);
      c.fillStyle = "#e2b07a"; circle(c, 0, 0, 30); c.fill();
      c.strokeStyle = "#b9844f"; c.lineWidth = 2.5;
      [22, 14, 6].forEach((r) => { circle(c, 1, -1, r); c.stroke(); });
    },
  },
  bamboo: {
    poly: rectPoly(26, 120), pts: 10, juice: "#b9e48a", inside: "#e9f7c8",
    draw(c) {
      c.fillStyle = "#6fbf4f"; c.fillRect(-20, -70, 40, 140);
      c.fillStyle = "#93d873"; c.fillRect(-8, -70, 6, 140);
      c.fillStyle = "#3f7d2b";
      [-28, 22].forEach((y) => c.fillRect(-20, y - 3, 40, 6));
    },
  },
  lantern: {
    poly: ellipsePoly(30, 38), pts: 12, juice: "#ffcf5a", inside: "#ffe6a8",
    draw(c) {
      c.fillStyle = "#e8433b"; c.fillRect(-40, -40, 80, 80);
      c.fillStyle = "rgba(255, 210, 120, 0.45)"; c.beginPath(); c.ellipse(0, 2, 16, 22, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#a8241f"; c.lineWidth = 2;
      [10, 20].forEach((rx) => { c.beginPath(); c.ellipse(0, 0, rx, 38, 0, 0, Math.PI * 2); c.stroke(); });
      c.fillStyle = "#2b2b2b"; c.fillRect(-12, -40, 24, 8); c.fillRect(-12, 32, 24, 8);
    },
  },
  pot: {
    poly: [{ x: -16, y: -34 }, { x: 16, y: -34 }, { x: 30, y: -6 }, { x: 26, y: 22 }, { x: 14, y: 34 },
      { x: -14, y: 34 }, { x: -26, y: 22 }, { x: -30, y: -6 }],
    pts: 12, juice: "#e08a5c", inside: "#f2b48f",
    draw(c) {
      c.fillStyle = "#c8643b"; c.fillRect(-40, -40, 80, 80);
      c.fillStyle = "#7a3a22"; c.fillRect(-40, -12, 80, 8); c.fillRect(-40, -34, 80, 5);
      c.fillStyle = "#f2d6a0";
      for (let x = -24; x <= 24; x += 12) { circle(c, x, 10, 2.5); c.fill(); }
    },
  },
  target: {
    poly: ellipsePoly(34, 34), pts: 15, juice: "#e8d39a", inside: "#f7ecc8",
    draw(c) {
      c.fillStyle = "#efdca6"; c.fillRect(-40, -40, 80, 80);
      c.fillStyle = "#d8443a"; circle(c, 0, 0, 26); c.fill();
      c.fillStyle = "#efdca6"; circle(c, 0, 0, 18); c.fill();
      c.fillStyle = "#d8443a"; circle(c, 0, 0, 9); c.fill();
    },
  },
  iron: {
    poly: rectPoly(56, 56), pts: 25, hp: 2, juice: "#ffd25a", inside: "#dfe6ee",
    draw(c, o) {
      c.fillStyle = "#6f7884"; c.fillRect(-30, -30, 60, 60);
      c.fillStyle = "#8d97a3"; c.fillRect(-22, -22, 44, 44);
      c.fillStyle = "#4a515a";
      [[-20, -20], [20, -20], [20, 20], [-20, 20]].forEach(([x, y]) => { circle(c, x, y, 3.5); c.fill(); });
      if (o.crack) {
        // a zig-zag crack along the first cut
        const [a, b] = o.crack;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        c.strokeStyle = "#1c2026"; c.lineWidth = 2.5; c.beginPath();
        for (let i = 0; i <= 6; i++) {
          const t = -0.6 + (i / 6) * 2.2;
          const wob = i % 2 ? 4 : -4;
          c.lineTo(a.x + dx * t - (dy / len) * wob, a.y + dy * t + (dx / len) * wob);
        }
        c.stroke();
      }
    },
  },
  coin: {
    poly: ellipsePoly(20, 20, 16), pts: 30, juice: "#ffe066", inside: "#fff0a8",
    draw(c) {
      c.fillStyle = "#ffcc33"; c.fillRect(-25, -25, 50, 50);
      c.strokeStyle = "#d49a12"; c.lineWidth = 2.5; circle(c, 0, 0, 14); c.stroke();
      c.fillStyle = "#5a3d0a"; c.fillRect(-5, -5, 10, 10);
    },
  },
  hourglass: {
    poly: rectPoly(34, 48), pts: 5, juice: "#f3d58a", inside: "#cfe9ff", power: "slow",
    draw(c) {
      c.fillStyle = "#bfe3ff"; c.fillRect(-20, -26, 40, 52);
      c.fillStyle = "#f0c860";
      c.beginPath(); c.moveTo(-10, -16); c.lineTo(10, -16); c.lineTo(0, -2); c.fill();
      c.beginPath(); c.moveTo(0, 6); c.lineTo(12, 18); c.lineTo(-12, 18); c.fill();
      c.fillStyle = "#7a4a25"; c.fillRect(-20, -26, 40, 8); c.fillRect(-20, 18, 40, 8);
    },
  },
  egg: {
    poly: ellipsePoly(28, 36), pts: 0, juice: "#ffe08a", inside: "#ffe9a6", hazard: true,
    draw(c) {
      c.fillStyle = "#f1e4ff"; c.fillRect(-35, -40, 70, 80);
      c.fillStyle = "#a46be0";
      [[-10, -18, 6], [12, -6, 8], [-8, 14, 7], [14, 22, 4], [-18, 0, 4]].forEach(([x, y, r]) => { circle(c, x, y, r); c.fill(); });
      c.fillStyle = "rgba(255, 255, 255, 0.7)"; c.beginPath(); c.ellipse(-12, -22, 5, 9, -0.4, 0, Math.PI * 2); c.fill();
    },
  },
};
const COMMON = ["log", "bamboo", "lantern", "pot", "target"];

// ---------- geometry ----------

function cross(ax, ay, bx, by) { return ax * by - ay * bx; }

function area(poly) {
  let s = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; s += cross(p.x, p.y, q.x, q.y); });
  return Math.abs(s) / 2;
}

function centroid(poly) {
  let a = 0, cx = 0, cy = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const k = cross(p.x, p.y, q.x, q.y);
    a += k; cx += (p.x + q.x) * k; cy += (p.y + q.y) * k;
  });
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// where along a->b (0 to 1) it crosses the edge p->q, or null
function segHit(a, b, p, q) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = q.x - p.x, sy = q.y - p.y;
  const den = cross(rx, ry, sx, sy);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(p.x - a.x, p.y - a.y, sx, sy) / den;
  const u = cross(p.x - a.x, p.y - a.y, rx, ry) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// cuts a convex outline along the line through p going in direction d.
// returns the two halves (the one on the left of d first) and the two ends of the cut
function splitPoly(poly, p, d) {
  const left = [], right = [], cut = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const sa = cross(d.x, d.y, a.x - p.x, a.y - p.y);
    const sb = cross(d.x, d.y, b.x - p.x, b.y - p.y);
    if (sa >= 0) left.push(a);
    if (sa <= 0) right.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      left.push(m); right.push(m); cut.push(m);
    }
  });
  if (left.length < 3 || right.length < 3 || cut.length < 2) return null;
  return { left, right, cut };
}

// the world is the dojo; "local" is the thing's own painting space, which turns with it
function toLocal(o, p) {
  const dx = p.x - o.x, dy = p.y - o.y, c = Math.cos(-o.rot), s = Math.sin(-o.rot);
  return { x: dx * c - dy * s + o.ox, y: dx * s + dy * c + o.oy };
}
function toWorld(o, p) {
  const dx = p.x - o.ox, dy = p.y - o.oy, c = Math.cos(o.rot), s = Math.sin(o.rot);
  return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
}

// ---------- saved progress ----------

function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    return { belts: Number(s.belts) || 0, blitz: Number(s.blitz) || 0 };
  } catch (e) { return { belts: 0, blitz: 0 }; }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ }
}

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

let save = readSave();

// ---------- game state ----------

let mode = "title";           // title, belts, blitz
let phase = "idle";           // idle, play, wrap (time is up, letting things fall), done
let paused = true;
let belt = 0;                 // belts: which belt you are trying to earn
let score = 0;
let timeLeft = 0;
let elapsed = 0;
let spawnTimer = 0;
let slow = 0;                 // seconds of slow-motion left
let shake = 0;
let clock = 0;
let wrapTimer = 0;
let lastTick = 0;
let chain = 0;                // slices in the current combo
let chainTimer = 0;
let chainX = 0, chainY = 0;
let stats = null;
let banner = null;
let againAction = null;

let things = [];              // whole things and cut halves
let particles = [];
let popups = [];
let dragons = [];             // grumpy baby dragons flying away
let trail = [];               // recent blade points
let blade = null;             // the pointer while it is held down

// ---------- sound ----------

let audio = null;
let muted = false;

function tone(freq, dur, type = "sine", vol = 0.12, slideTo = null) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* no sound on this browser */ }
}

const sfx = {
  swish: () => tone(1800, 0.12, "sawtooth", 0.025, 500),
  slice: () => { tone(700, 0.1, "triangle", 0.12, 220); tone(2400, 0.04, "square", 0.03); },
  perfect: () => { tone(1046, 0.1, "triangle", 0.1); setTimeout(() => tone(1568, 0.16, "triangle", 0.1), 60); },
  clank: () => { tone(300, 0.15, "square", 0.1, 180); tone(1900, 0.1, "square", 0.04, 1200); },
  coin: () => { tone(988, 0.08, "square", 0.07); setTimeout(() => tone(1319, 0.2, "square", 0.07), 70); },
  slow: () => tone(600, 0.6, "sine", 0.12, 150),
  egg: () => { tone(400, 0.3, "sawtooth", 0.1, 90); setTimeout(() => tone(220, 0.3, "square", 0.08, 120), 120); },
  combo: (n) => [0, 1, 2].forEach((i) => setTimeout(() => tone(523 * (1 + n * 0.08) * (1 + i * 0.25), 0.12, "triangle", 0.1), i * 70)),
  tick: () => tone(880, 0.05, "square", 0.05),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.12), i * 90)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.11), i * 130)),
};

// ---------- throwing things ----------

// difficulty: the belt you are on, or in blitz it climbs from Yellow to Brown over the minute
function level() {
  if (mode === "belts") return BELTS[belt];
  if (mode === "blitz") return BELTS[clamp(1 + Math.floor(elapsed / 10), 1, 6)];
  return { every: 1.4, volley: [1, 2], egg: 0.08, iron: 0.06 };
}

function chooseKind(lv) {
  const r = Math.random();
  if (r < lv.egg) return "egg";
  if (r < lv.egg + lv.iron) return "iron";
  if (r < lv.egg + lv.iron + 0.06) return "coin";
  if (r < lv.egg + lv.iron + 0.1 && slow <= 0 && mode !== "title") return "hourglass";
  return pick(COMMON);
}

function throwThing(kind) {
  const k = KINDS[kind];
  const x = rand(130, W - 130);
  const y = H + 60;
  const top = kind === "coin" ? rand(70, 160) : rand(80, 260);
  things.push({
    kind, whole: true, hp: k.hp || 1, crack: null, entry: null,
    poly: k.poly, ox: 0, oy: 0, x, y,
    vx: (W / 2 - x) * rand(0.15, 0.45) + rand(-40, 40),
    vy: -Math.sqrt(2 * GRAVITY * (y - top)),
    rot: rand(0, Math.PI * 2), spin: rand(-3, 3) * (kind === "coin" ? 2 : 1),
  });
}

function spawn(dt) {
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  const lv = level();
  spawnTimer = lv.every * rand(0.8, 1.2);
  const n = randInt(lv.volley[0], lv.volley[1]);
  for (let i = 0; i < n; i++) throwThing(chooseKind(lv));
}

// ---------- slicing ----------

const canSlice = () => !paused && phase === "play";

function popup(x, y, text, color, size = 22) {
  popups.push({ x, y, text, color, size, life: 0.9 });
}

function burst(x, y, color, n, speed = 220) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, speed);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: rand(0.4, 0.8), color, size: rand(2, 5) });
  }
}

// checks one blade move (a -> b) against a whole thing. Returns the cut line, or null.
// The blade can enter on one move and leave on a later one, so the entry point is remembered.
function bladeThrough(o, a, b) {
  const la = toLocal(o, a), lb = toLocal(o, b);
  if (!inPoly(la, o.poly)) o.entry = null;
  else if (!o.entry) o.entry = la;
  const hits = [];
  o.poly.forEach((p, i) => {
    const t = segHit(la, lb, p, o.poly[(i + 1) % o.poly.length]);
    if (t !== null) hits.push(t);
  });
  hits.sort((x, y) => x - y);
  for (const t of hits) {
    const pt = { x: la.x + (lb.x - la.x) * t, y: la.y + (lb.y - la.y) * t };
    if (!o.entry) o.entry = pt;
    else if (Math.hypot(pt.x - o.entry.x, pt.y - o.entry.y) > 6) {
      const e = o.entry;
      o.entry = null;
      return [e, pt];
    }
  }
  return null;
}

// splits a whole thing into two halves that fly apart. Returns how even the halves are (0 to 1)
function cutApart(o, e, pt) {
  const d = { x: pt.x - e.x, y: pt.y - e.y };
  const s = splitPoly(o.poly, e, d);
  if (!s) return -1;
  const len = Math.hypot(d.x, d.y);
  const nx = -d.y / len, ny = d.x / len;
  const c = Math.cos(o.rot), sn = Math.sin(o.rot);
  [s.left, s.right].forEach((half, i) => {
    const side = i === 0 ? 1 : -1;
    const mid = centroid(half);
    const w = toWorld(o, mid);
    const pushX = (nx * c - ny * sn) * side, pushY = (nx * sn + ny * c) * side;
    things.push({
      kind: o.kind, whole: false, crack: o.crack, cut: s.cut,
      poly: half, ox: mid.x, oy: mid.y, x: w.x, y: w.y,
      vx: o.vx * 0.6 + pushX * 150, vy: Math.min(o.vy, 0) * 0.4 + pushY * 150 - 80,
      rot: o.rot, spin: o.spin + side * rand(2, 4),
    });
  });
  things.splice(things.indexOf(o), 1);
  const a1 = area(s.left), a2 = area(s.right);
  return Math.min(a1, a2) / Math.max(a1, a2);
}

function onSlice(o, e, pt) {
  const k = KINDS[o.kind];
  if (o.hp > 1) {
    // iron: the first cut only cracks it
    o.hp--;
    o.crack = [e, pt];
    o.vy -= 120;
    o.spin += rand(-4, 4);
    burst(o.x, o.y, k.juice, 14, 260);
    popup(o.x, o.y - 30, "CLANK!", "#dfe6ee", 20);
    sfx.clank();
    shake = Math.max(shake, 4);
    return;
  }
  const x = o.x, y = o.y;
  const even = cutApart(o, e, pt);
  if (even < 0) return;
  burst(x, y, k.juice, 18);

  if (k.hazard) {
    timeLeft = Math.max(0, timeLeft - EGG_PENALTY);
    chain = 0;
    shake = 12;
    stats.eggs++;
    dragons.push({ x, y, vx: rand(-80, 80), vy: -60, t: 0, face: Math.random() < 0.5 ? 1 : -1 });
    popup(x, y - 40, "GRR! -" + EGG_PENALTY + "s", "#ff6a5a", 28);
    sfx.egg();
    return;
  }

  const perfect = even >= PERFECT;
  const pts = k.pts * (perfect ? 2 : 1);
  score += pts;
  stats.slices++;
  if (perfect) stats.perfect++;
  popup(x, y - 10, "+" + pts, perfect ? "#ffe066" : "#ffffff", perfect ? 26 : 20);
  if (perfect) { popup(x, y - 40, "PERFECT!", "#ffe066", 22); sfx.perfect(); } else sfx.slice();
  if (o.kind === "coin") sfx.coin();
  if (k.power === "slow") {
    slow = SLOW_TIME;
    popup(x, y - 66, "SLOW-MO!", "#9fd8ff", 26);
    sfx.slow();
  }
  chain++;
  chainTimer = COMBO_GAP;
  chainX = x; chainY = y;
}

function endChain() {
  if (chain >= 3) {
    const bonus = chain * 10;
    score += bonus;
    stats.combo = Math.max(stats.combo, chain);
    popup(clamp(chainX, 140, W - 140), clamp(chainY - 80, 60, H - 60), `COMBO x${chain}  +${bonus}`, "#ff9a3c", 32);
    sfx.combo(chain);
  }
  chain = 0;
}

function bladeMove(a, b, speed) {
  if (!canSlice() || speed < BLADE_SPEED) return;
  // copy the list: slicing adds and removes things while we look
  things.slice().forEach((o) => {
    if (!o.whole || !things.includes(o)) return;
    const line = bladeThrough(o, a, b);
    if (line) onSlice(o, line[0], line[1]);
  });
}

// ---------- rounds ----------

function freshStats() {
  return { slices: 0, perfect: 0, combo: 0, eggs: 0, missed: 0 };
}

function startRound(m, beltIndex) {
  mode = m;
  belt = beltIndex;
  score = 0;
  elapsed = 0;
  timeLeft = m === "belts" ? BELT_TIME : BLITZ_TIME;
  lastTick = Math.ceil(timeLeft);
  spawnTimer = 1.2;
  slow = 0;
  chain = 0;
  stats = freshStats();
  things = [];
  dragons = [];
  phase = "play";
  banner = m === "belts"
    ? { text: BELTS[belt].name.toUpperCase() + " BELT", sub: "Score " + BELTS[belt].goal + " in " + BELT_TIME + " seconds", t: 0 }
    : { text: "BLITZ!", sub: "Slice everything for " + BLITZ_TIME + " seconds", t: 0 };
  closePanels();
  paused = false;
}

function finishRound() {
  phase = "done";
  endChain();
  const chips = [
    `🔪 <b>${stats.slices}</b> slices`,
    `✨ <b>${stats.perfect}</b> perfect`,
    `🔥 best combo <b>${stats.combo || "-"}</b>`,
    `🥚 <b>${stats.eggs}</b> eggs cut`,
  ];
  if (mode === "blitz") {
    const record = score > save.blitz;
    if (record) { save.blitz = score; writeSave(); }
    sfx.win();
    showResult("BLITZ<span>OVER</span>",
      `You scored <b>${score}</b> points.` + (record ? " That's a new best!" : ` Your best is ${save.blitz}.`),
      chips, "Play again", () => startRound("blitz", 0));
    return;
  }
  const b = BELTS[belt];
  if (score >= b.goal) {
    if (belt + 1 > save.belts) { save.belts = belt + 1; writeSave(); }
    sfx.win();
    if (belt === BELTS.length - 1) {
      showResult("SLICE<span>MASTER</span>",
        `You earned the Black Belt with <b>${score}</b> points. You are a true Slice Master!`,
        chips, "Play again", () => startRound("belts", 0));
    } else {
      showResult("BELT<span>EARNED</span>",
        `<b>${b.name} Belt!</b> You scored ${score} of ${b.goal}. Next up: ${BELTS[belt + 1].name}.`,
        chips, "Next belt", () => startRound("belts", belt + 1));
    }
  } else {
    sfx.lose();
    showResult("NOT<span>YET</span>",
      `You scored ${score}, but the ${b.name} Belt needs <b>${b.goal}</b>. Aim for the middle!`,
      chips, "Try again", () => startRound("belts", belt));
  }
}

// ---------- update ----------

function update(dt) {
  clock += dt;
  const wdt = slow > 0 ? dt * SLOW_SPEED : dt;
  slow = Math.max(0, slow - dt);
  shake = Math.max(0, shake - dt * 30);

  if (mode === "title") spawn(dt);
  if (phase === "play" && !paused) {
    timeLeft -= dt;
    elapsed += dt;
    spawn(dt);
    if (timeLeft <= 5 && Math.ceil(timeLeft) < lastTick) { lastTick = Math.ceil(timeLeft); if (lastTick > 0) sfx.tick(); }
    if (timeLeft <= 0) {
      timeLeft = 0;
      phase = "wrap";
      wrapTimer = 1.2;
      banner = { text: "TIME!", sub: "", t: 0 };
    }
  } else if (phase === "wrap") {
    wrapTimer -= dt;
    if (wrapTimer <= 0) finishRound();
  }
  if (chain > 0) {
    chainTimer -= dt;
    if (chainTimer <= 0) endChain();
  }

  things.forEach((o) => {
    o.vy += GRAVITY * wdt;
    o.x += o.vx * wdt;
    o.y += o.vy * wdt;
    o.rot += o.spin * wdt;
  });
  things = things.filter((o) => {
    if (o.y < H + 140 || o.vy < 0) return true;
    if (o.whole && phase === "play" && !KINDS[o.kind].hazard && !KINDS[o.kind].power) stats.missed++;
    return false;
  });

  particles.forEach((p) => { p.vy += GRAVITY * wdt; p.x += p.vx * wdt; p.y += p.vy * wdt; p.life -= dt; });
  particles = particles.filter((p) => p.life > 0);
  popups.forEach((p) => { p.y -= 40 * dt; p.life -= dt; });
  popups = popups.filter((p) => p.life > 0);
  dragons.forEach((d) => { d.t += dt; d.vy -= 160 * dt; d.x += d.vx * dt; d.y += d.vy * dt; });
  dragons = dragons.filter((d) => d.y > -60);
  trail = trail.filter((p) => clock - p.t < TRAIL_TIME);
  if (banner) { banner.t += dt; if (banner.t > 2) banner = null; }
}

// ---------- input ----------

function toBoard(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

let strokeId = 0;
let lastSwish = 0;

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = toBoard(e);
  strokeId++;
  blade = { x: p.x, y: p.y, time: performance.now() };
  trail.push({ x: p.x, y: p.y, t: clock, id: strokeId });
});
canvas.addEventListener("pointermove", (e) => {
  if (!blade) return;
  const p = toBoard(e);
  const now = performance.now();
  const dist = Math.hypot(p.x - blade.x, p.y - blade.y);
  if (dist < 2) return;
  const speed = dist / Math.max(0.004, (now - blade.time) / 1000);
  if (speed >= BLADE_SPEED && canSlice() && clock - lastSwish > 0.18) { lastSwish = clock; sfx.swish(); }
  bladeMove({ x: blade.x, y: blade.y }, p, speed);
  blade = { x: p.x, y: p.y, time: now };
  trail.push({ x: p.x, y: p.y, t: clock, id: strokeId, fast: speed >= BLADE_SPEED });
});
function release() {
  blade = null;
  things.forEach((o) => { o.entry = null; });
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "m") toggleMute();
  else if (key === "escape") openPanel("title-screen");
});
window.addEventListener("blur", release);

const PANELS = ["title-screen", "result-screen"];

function beltChips(el) {
  el.innerHTML = BELTS.map((b, i) =>
    `<span class="belt-chip${i < save.belts ? " earned" : ""}" style="background:${b.color}" title="${b.name} Belt"></span>`).join("");
}

function openPanel(id) {
  PANELS.forEach((p) => $(p).classList.toggle("hidden", p !== id));
  paused = true;
  release();
  if (id === "title-screen") {
    mode = "title";
    phase = "idle";
    banner = null;
    beltChips($("title-belts"));
  }
}

function closePanels() {
  PANELS.forEach((p) => $(p).classList.add("hidden"));
}

function showResult(title, text, chips, againLabel, again) {
  $("result-title").innerHTML = title;
  $("result-text").innerHTML = text;
  $("result-stats").innerHTML = chips.map((c) => `<span>${c}</span>`).join("");
  $("result-belts").classList.toggle("hidden", mode !== "belts");
  beltChips($("result-belts"));
  $("result-again").textContent = againLabel;
  againAction = again;
  openPanel("result-screen");
}

function toggleMute() {
  muted = !muted;
  $("mute").textContent = muted ? "🔇" : "🔊";
}

$("mute").addEventListener("click", toggleMute);
$("open-menu").addEventListener("click", () => openPanel("title-screen"));
$("play-belts").addEventListener("click", () => startRound("belts", Math.min(save.belts, BELTS.length - 1)));
$("play-blitz").addEventListener("click", () => startRound("blitz", 0));
$("result-again").addEventListener("click", () => againAction && againAction());
$("result-menu").addEventListener("click", () => openPanel("title-screen"));

// ---------- drawing ----------

function circle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
}

function polyPath(c, poly) {
  c.beginPath();
  poly.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
}

// the dojo never changes, so paint it once into a hidden canvas
const backdrop = (() => {
  const b = document.createElement("canvas");
  b.width = W; b.height = H;
  const c = b.getContext("2d");
  c.fillStyle = "#2a2238"; c.fillRect(0, 0, W, H);

  // paper screens glowing on both sides
  [[40, 260], [700, 920]].forEach(([x0, x1]) => {
    c.fillStyle = "#4a3646"; c.fillRect(x0, 50, x1 - x0, 330);
    c.fillStyle = "rgba(255, 190, 120, 0.16)"; c.fillRect(x0, 50, x1 - x0, 330);
    c.strokeStyle = "#1e1626"; c.lineWidth = 4;
    for (let x = x0; x <= x1; x += (x1 - x0) / 4) { c.beginPath(); c.moveTo(x, 50); c.lineTo(x, 380); c.stroke(); }
    for (let y = 50; y <= 380; y += 55) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
    c.lineWidth = 10; c.strokeStyle = "#3a2618"; c.strokeRect(x0, 50, x1 - x0, 330);
  });

  // a round window with the moon and bamboo
  c.save();
  circle(c, 480, 215, 150); c.clip();
  const sky = c.createLinearGradient(0, 65, 0, 365);
  sky.addColorStop(0, "#1b2b55"); sky.addColorStop(1, "#4a5f8f");
  c.fillStyle = sky; c.fillRect(330, 65, 300, 300);
  c.fillStyle = "rgba(255, 243, 196, 0.25)"; circle(c, 540, 150, 58); c.fill();
  c.fillStyle = "#fff3c4"; circle(c, 540, 150, 40); c.fill();
  c.fillStyle = "#14202f";
  [[380, 10], [410, 7], [585, 9]].forEach(([x, w]) => {
    c.fillRect(x, 60, w, 320);
    for (let y = 100; y < 380; y += 60) c.fillRect(x - 2, y, w + 4, 4);
  });
  c.beginPath(); c.ellipse(435, 120, 30, 7, -0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(565, 230, 28, 6, 0.6, 0, Math.PI * 2); c.fill();
  c.restore();
  c.strokeStyle = "#3a2618"; c.lineWidth = 16; circle(c, 480, 215, 150); c.stroke();

  // posts and a beam
  c.fillStyle = "#3a2618";
  c.fillRect(0, 30, W, 20);
  [[14, 26], [290, 22], [648, 22], [920, 26]].forEach(([x, w]) => c.fillRect(x, 30, w, 400));

  // hanging lanterns
  [180, 780].forEach((x) => {
    c.strokeStyle = "#1e1626"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 50); c.lineTo(x, 80); c.stroke();
    c.fillStyle = "rgba(255, 160, 80, 0.25)"; circle(c, x, 108, 44); c.fill();
    c.fillStyle = "#e8433b"; c.beginPath(); c.ellipse(x, 108, 20, 26, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffd27a"; c.beginPath(); c.ellipse(x, 108, 9, 14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#1e1626"; c.fillRect(x - 8, 80, 16, 5); c.fillRect(x - 8, 131, 16, 5);
  });

  // wooden floor
  const floor = c.createLinearGradient(0, 420, 0, H);
  floor.addColorStop(0, "#7a4e2e"); floor.addColorStop(1, "#4e2f1a");
  c.fillStyle = floor; c.fillRect(0, 420, W, H - 420);
  c.fillStyle = "#2e1c10"; c.fillRect(0, 416, W, 6);
  c.strokeStyle = "rgba(0, 0, 0, 0.25)"; c.lineWidth = 2;
  for (let i = -8; i <= 8; i++) {
    c.beginPath(); c.moveTo(W / 2 + i * 70, 422); c.lineTo(W / 2 + i * 150, H); c.stroke();
  }
  return b;
})();

function drawThing(o) {
  const k = KINDS[o.kind];
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot);
  ctx.translate(-o.ox, -o.oy);
  polyPath(ctx, o.poly);
  ctx.save();
  ctx.clip();
  k.draw(ctx, o);
  ctx.restore();
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  polyPath(ctx, o.poly);
  ctx.stroke();
  if (o.cut) {
    // the fresh, bright cut edge
    ctx.strokeStyle = k.inside;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(o.cut[0].x, o.cut[0].y);
    ctx.lineTo(o.cut[1].x, o.cut[1].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDragon(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.face, 1);
  const flap = Math.sin(d.t * 22) * 0.6;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  // wings
  [-1, 1].forEach((s) => {
    ctx.save();
    ctx.rotate(s * (0.4 + flap));
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(s * 10, -30, s * 26, -18); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = "#0a84ff"; ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = "#36b3ff";
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(0, 4, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
  // grumpy eyebrows
  ctx.fillStyle = INK;
  circle(ctx, -5, -3, 2); ctx.fill(); circle(ctx, 5, -3, 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(-2, -6); ctx.moveTo(9, -9); ctx.lineTo(2, -6); ctx.stroke();
  // a puff of smoke
  ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
  circle(ctx, 18, -10 - (d.t * 20) % 10, 4); ctx.fill();
  ctx.restore();
}

function drawTrail() {
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i];
    if (a.id !== b.id) continue;
    const fade = 1 - (clock - b.t) / TRAIL_TIME;
    ctx.strokeStyle = `rgba(160, 220, 255, ${0.35 * fade})`;
    ctx.lineWidth = 14 * fade;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${(b.fast ? 1 : 0.4) * fade})`;
    ctx.lineWidth = 5 * fade;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

function drawEffects() {
  particles.forEach((p) => {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  popups.forEach((p) => {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.font = `${p.size}px "Russo One", Impact, sans-serif`;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  });
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// belt trials: a bar showing how close you are to the goal
function drawGoal() {
  if (mode !== "belts" || phase === "idle") return;
  const b = BELTS[belt];
  const w = 360, x = (W - w) / 2, y = 14;
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  roundRect(x - 4, y - 4, w + 8, 24, 10); ctx.fill();
  const fill = w * clamp(score / b.goal, 0, 1);
  if (fill > 0) {
    ctx.fillStyle = b.color === "#1d1d24" ? "#555566" : b.color;
    roundRect(x, y, fill, 16, 7); ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.font = '13px "Russo One", Impact, sans-serif';
  ctx.textAlign = "center";
  const label = `${b.name} Belt  ${score} / ${b.goal}`;
  ctx.strokeText(label, W / 2, y + 13);
  ctx.fillText(label, W / 2, y + 13);
}

function drawBanner() {
  if (!banner || paused) return;
  const a = clamp(Math.min(banner.t * 4, (2 - banner.t) * 2), 0, 1);
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.font = '54px "Russo One", Impact, sans-serif';
  ctx.strokeStyle = INK; ctx.lineWidth = 8;
  ctx.strokeText(banner.text, W / 2, H / 2 - 20);
  ctx.fillStyle = "#f6efe2";
  ctx.fillText(banner.text, W / 2, H / 2 - 20);
  if (banner.sub) {
    ctx.font = '22px "Russo One", Impact, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeText(banner.sub, W / 2, H / 2 + 18);
    ctx.fillStyle = "#ff6b5a";
    ctx.fillText(banner.sub, W / 2, H / 2 + 18);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  ctx.drawImage(backdrop, 0, 0);
  if (slow > 0) {
    ctx.fillStyle = `rgba(80, 160, 255, ${0.18 * Math.min(1, slow)})`;
    ctx.fillRect(0, 0, W, H);
  }
  things.forEach(drawThing);
  dragons.forEach(drawDragon);
  drawEffects();
  ctx.restore();
  drawTrail();
  drawGoal();
  drawBanner();
}

function updateHud() {
  $("belt").textContent = mode === "belts" ? BELTS[belt].name : mode === "blitz" ? "Blitz" : "-";
  $("score").textContent = mode === "title" ? "-" : mode === "belts" ? `${score}/${BELTS[belt].goal}` : score;
  $("time").textContent = mode === "title" ? "-" : Math.ceil(timeLeft);
  $("time").classList.toggle("low", mode !== "title" && timeLeft <= 5);
  $("best").textContent = mode === "blitz" ? save.blitz : `${save.belts}/${BELTS.length}`;
}

// ---------- main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

stats = freshStats();
openPanel("title-screen");
requestAnimationFrame(frame);
