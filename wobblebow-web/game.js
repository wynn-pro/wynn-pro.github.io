// Wobblebow: two floppy archers take turns shooting across a windy valley.
// Everything runs in the browser: no server, no downloads, so it works on GitHub Pages.
"use strict";

const W = 960;
const H = 560;
const ARROW_GRAVITY = 900;    // pixels per second per second
const BODY_GRAVITY = 1500;    // ragdolls fall a bit faster than arrows, so they feel heavy
const SPEED_MAX = 1080;       // arrow speed at full power
const PHYS_DT = 1 / 120;      // the ragdolls are simulated in small fixed steps
const ARROW_LEN = 36;
const DRAG_FULL = 190;        // drag this far for full power
const GUIDE_TIME = 0.22;      // the aiming guide shows this many seconds of the flight
const TURN_PAUSE = 0.9;       // wait this long after the arrows land before the next turn
const MAX_STUCK = 40;         // arrows left in the ground before the oldest disappear

const SAVE_KEY = "wobblebow-best";

// damage for each body part, before perks
const DAMAGE = { head: 40, body: 22, limb: 12 };

// the rivals on the ladder, easiest first. err is how wobbly their aim is
const FOES = [
  { name: "Twig",           color: "#9ccc65", hp: 60,  err: 0.17, hat: "sprout" },
  { name: "Pip",            color: "#ffb74d", hp: 80,  err: 0.14, hat: "cap" },
  { name: "Bramble",        color: "#a1887f", hp: 100, err: 0.12, hat: "leaf" },
  { name: "Sir Plonk",      color: "#90a4ae", hp: 110, err: 0.10, hat: "pot", helmet: true },
  { name: "Mossy Meg",      color: "#81c784", hp: 120, err: 0.085, hat: "witch" },
  { name: "Captain Kettle", color: "#e57373", hp: 130, err: 0.075, hat: "pirate", dmg: 1.2 },
  { name: "Twin-String Tess", color: "#ba68c8", hp: 130, err: 0.07, hat: "bow", split: true },
  { name: "The Grand Wobbler", color: "#ffd54f", hp: 190, err: 0.055, hat: "crown", dmg: 1.25, helmet: true },
];

// perks you can pick after winning a duel. max is how many times you can take it
const PERKS = [
  { id: "tough",  icon: "💪", name: "Thick Skin",   desc: "+30 max health.", max: 3 },
  { id: "heavy",  icon: "🪨", name: "Heavy Tips",   desc: "Your arrows hit 25% harder.", max: 3 },
  { id: "eye",    icon: "🦅", name: "Eagle Eye",    desc: "Your aiming guide is much longer.", max: 2 },
  { id: "strong", icon: "🏋️", name: "Big Bow",      desc: "Your arrows fly 12% faster and farther.", max: 2 },
  { id: "split",  icon: "🔱", name: "Triple Shot",  desc: "Shoot 3 arrows at once. Each does 60% damage.", max: 1 },
  { id: "snack",  icon: "🍎", name: "Snack Pouch",  desc: "Heal a third of the damage you deal.", max: 1 },
  { id: "steady", icon: "🎯", name: "Steady Hands", desc: "Wind pushes your arrows half as much.", max: 1 },
  { id: "pot",    icon: "🪖", name: "Iron Pot",     desc: "Wear a pot: headshots only hurt you like body hits.", max: 1 },
];

// body joints
const HEAD = 0, NECK = 1, PELVIS = 2, ELB_F = 3, HAND_F = 4, ELB_B = 5, HAND_B = 6,
  KNEE_L = 7, FOOT_L = 8, KNEE_R = 9, FOOT_R = 10;
const JOINTS = 11;

// bones: [from, to, part, thickness]. Arms are "ropes" that can bend shorter, so the bow arm can draw
const BONES = [
  [HEAD, NECK, "head", 5],
  [NECK, PELVIS, "body", 9],
  [NECK, ELB_F, "limb", 6], [ELB_F, HAND_F, "limb", 5],
  [NECK, ELB_B, "limb", 6], [ELB_B, HAND_B, "limb", 5],
  [PELVIS, KNEE_L, "limb", 7], [KNEE_L, FOOT_L, "limb", 6],
  [PELVIS, KNEE_R, "limb", 7], [KNEE_R, FOOT_R, "limb", 6],
];
const ROPE_BONES = new Set([2, 3, 4, 5]);
const HEAD_R = 12;

// how strongly each joint is pulled back to its pose while standing (feet are pinned)
const POSE_PULL = [0.05, 0.07, 0.08, 0.2, 0.25, 0.2, 0.25, 0.12, 1, 0.12, 1];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;

// ---------- saved progress ----------

function readBest() {
  try { return Number(localStorage.getItem(SAVE_KEY)) || 0; } catch (e) { return 0; }
}
function writeBest(n) {
  try { localStorage.setItem(SAVE_KEY, String(n)); } catch (e) { /* storage blocked */ }
}

let best = readBest();

// ---------- game state ----------

let mode = "title";           // title, ladder, duo
let phase = "idle";           // idle, aim, flight, wait, ko
let turn = 0;                 // 0 = left archer shoots, 1 = right archer
let phaseTimer = 0;
let clock = 0;
let paused = true;
let wind = 0;                 // sideways push on arrows, pixels per second per second
let duel = 0;                 // ladder: which rival (0 to FOES.length - 1)
let duoScore = [0, 0];
let perks = {};               // ladder: how many of each perk you have
let shake = 0;

let archers = [];
let arrows = [];
let particles = [];
let popups = [];
const ground = new Float32Array(W + 1);
let drag = null;              // the mouse drag while aiming
const keys = {};

const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 180 + rand(0, 80), y: rand(30, 140), s: rand(0.6, 1.2) }));
const hills = Array.from({ length: 7 }, (_, i) => ({ x: i * 170 + rand(-30, 30), r: rand(120, 200) }));

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
  twang: () => { tone(180, 0.25, "triangle", 0.14, 90); tone(1200, 0.06, "square", 0.03, 600); },
  thunk: () => tone(140, 0.12, "square", 0.08, 70),
  hit: () => { tone(260, 0.15, "sawtooth", 0.1, 120); tone(520, 0.08, "square", 0.05); },
  head: () => { tone(900, 0.08, "square", 0.08); setTimeout(() => tone(1300, 0.15, "square", 0.08), 70); },
  ko: () => tone(500, 0.6, "triangle", 0.14, 80),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.12), i * 90)),
  pick: () => { tone(660, 0.08, "square", 0.07); setTimeout(() => tone(990, 0.12, "square", 0.07), 80); },
};

// ---------- the valley ----------

const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const groundAt = (x) => ground[clamp(Math.round(x), 0, W)];

// builds the hills and returns where the two archers stand
function makeValley(level) {
  const leftTop = rand(300, 430);
  const rightTop = rand(300, 430);
  const leftEdge = rand(170, 220);
  const rightEdge = W - rand(170, 220);
  const floor = 525;
  // later duels sometimes have a rock spire in the middle
  const spire = level >= 2 && Math.random() < 0.55
    ? { x: W / 2 + rand(-60, 60), w: rand(36, 60), top: rand(250, 360) }
    : null;
  for (let x = 0; x <= W; x++) {
    let y = floor + Math.sin(x * 0.03) * 4;
    y -= (floor - leftTop) * (1 - smooth((x - leftEdge) / 60));
    y -= (floor - rightTop) * smooth((x - rightEdge + 60) / 60);
    if (spire) {
      const d = Math.abs(x - spire.x) / spire.w;
      if (d < 1) y = Math.min(y, spire.top + (floor - spire.top) * Math.pow(d, 2.5));
    }
    ground[x] = y;
  }
  return [leftEdge - rand(70, 110), rightEdge + rand(70, 110)];
}

// ---------- ragdolls ----------

function makeArcher(x, face, opts) {
  const a = {
    x, face,
    name: opts.name, color: opts.color, hat: opts.hat,
    cpu: !!opts.cpu, err: opts.err || 0,
    maxHp: opts.hp, hp: opts.hp,
    dmgMul: opts.dmg || 1, helmet: !!opts.helmet, split: !!opts.split,
    speedMul: opts.speedMul || 1, guide: opts.guide || 1, windMul: opts.windMul || 1, snack: !!opts.snack,
    angle: 0.6, power: 0.6, draw: 0,
    stiff: 1, phase: rand(0, 6), shownHp: opts.hp, blink: 0,
    cpuPlan: null, cpuTimer: 0, shots: 0,
    pts: [], sticks: [],
  };
  const t = poseTargets(a);
  a.pts = t.map((p) => ({ x: p.x, y: p.y, px: p.x, py: p.y }));
  const dist = (i, j) => Math.hypot(t[i].x - t[j].x, t[i].y - t[j].y);
  BONES.forEach(([i, j], k) => {
    const len = dist(i, j);
    a.sticks.push({ i, j, len, min: ROPE_BONES.has(k) ? len * 0.5 : len });
  });
  // keeps the head on top of the body
  a.sticks.push({ i: HEAD, j: PELVIS, len: dist(HEAD, PELVIS), min: dist(HEAD, PELVIS) });
  return a;
}

// where every joint wants to be while the archer stands and aims
function poseTargets(a) {
  const f = a.face;
  const gy = groundAt(a.x);
  const sway = Math.sin(clock * 2.1 + a.phase) * 1.6;
  const dx = Math.cos(a.angle) * f;
  const dy = -Math.sin(a.angle);
  const neck = { x: a.x + sway, y: gy - 72 };
  const v = (x, y) => ({ x, y });
  const pull = a.draw;
  return [
    v(a.x + sway * 1.2 + f, gy - 88),                                                 // head
    neck,                                                                              // neck
    v(a.x + sway * 0.3, gy - 38),                                                      // pelvis
    v(neck.x + dx * 15, neck.y + dy * 15 + 2),                                         // front elbow
    v(neck.x + dx * 30, neck.y + dy * 30),                                             // front hand (holds the bow)
    v(neck.x + dx * (13 - 21 * pull), neck.y + dy * (13 - 21 * pull) + 5 * pull),      // back elbow
    v(neck.x + dx * (27 - 26 * pull), neck.y + dy * (27 - 26 * pull)),                 // back hand (pulls the string)
    v(a.x - 7, gy - 19),
    v(a.x - 10, gy),
    v(a.x + 7, gy - 19),
    v(a.x + 10, gy),
  ];
}

const alive = (a) => a.hp > 0;

function stepBody(a) {
  const standing = alive(a);
  const pts = a.pts;
  const damp = standing ? 0.94 : 0.992;
  const g = BODY_GRAVITY * (standing ? 0.2 : 1) * PHYS_DT * PHYS_DT;
  for (const p of pts) {
    const vx = (p.x - p.px) * damp;
    const vy = (p.y - p.py) * damp;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + g;
  }
  if (standing) {
    // springs pull the body back into its pose, weaker for a moment after a hit so it wobbles
    const t = poseTargets(a);
    for (let i = 0; i < JOINTS; i++) {
      const k = i === FOOT_L || i === FOOT_R ? 1 : POSE_PULL[i] * a.stiff;
      pts[i].x += (t[i].x - pts[i].x) * k;
      pts[i].y += (t[i].y - pts[i].y) * k;
    }
  }
  for (let n = 0; n < 5; n++) {
    for (const s of a.sticks) {
      const p = pts[s.i], q = pts[s.j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      let want;
      if (d > s.len) want = s.len;
      else if (d < s.min) want = s.min;
      else continue;
      const k = ((d - want) / d) * 0.5;
      p.x += dx * k; p.y += dy * k;
      q.x -= dx * k; q.y -= dy * k;
    }
    for (const p of pts) {
      p.x = clamp(p.x, 4, W - 4);
      const gy = groundAt(p.x) - 2;
      if (p.y > gy) {
        p.y = gy;
        p.px = p.x - (p.x - p.px) * 0.6;   // friction on the grass
      }
    }
  }
}

// shove the joint that was hit, and the rest of the body a little
function shove(a, joint, vx, vy, strength) {
  const k = strength * PHYS_DT;
  for (let i = 0; i < JOINTS; i++) {
    const w = i === joint ? 1 : 0.25;
    a.pts[i].px -= vx * k * w;
    a.pts[i].py -= vy * k * w;
  }
}

// ---------- arrows ----------

function fire(a) {
  const speed = SPEED_MAX * a.power * a.speedMul;
  const spread = a.split ? [-0.05, 0, 0.05] : [0];
  const hand = a.pts[HAND_F];
  spread.forEach((s) => {
    const ang = a.angle + s;
    const vx = Math.cos(ang) * speed * a.face;
    const vy = -Math.sin(ang) * speed;
    arrows.push({
      x: hand.x + vx * 0.012, y: hand.y + vy * 0.012, vx, vy, owner: a,
      dmg: a.dmgMul * (a.split ? 0.6 : 1), windMul: a.windMul,
      flying: true, stuck: null, age: 0, trail: [],
    });
  });
  a.draw = 0;
  a.shots++;
  sfx.twang();
  phase = "flight";
}

// which bone (index into BONES) is at this point, or -1
function boneAt(a, x, y) {
  const h = a.pts[HEAD];
  if (Math.hypot(x - h.x, y - h.y) < HEAD_R) return 0;
  for (let k = 1; k < BONES.length; k++) {
    const [i, j, , thick] = BONES[k];
    const p = a.pts[i], q = a.pts[j];
    const dx = q.x - p.x, dy = q.y - p.y;
    const t = clamp(((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    if (Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t)) < thick / 2 + 2) return k;
  }
  return -1;
}

// remember where on the bone the arrow went in, so it moves with the body
function stickToBone(arrow, a, k) {
  const [i, j] = BONES[k];
  const p = a.pts[i], q = a.pts[j];
  const bx = q.x - p.x, by = q.y - p.y;
  const len = Math.hypot(bx, by) || 1;
  const ux = bx / len, uy = by / len;
  const rx = arrow.x - p.x, ry = arrow.y - p.y;
  arrow.stuck = {
    a, k,
    along: (rx * ux + ry * uy) / len,
    side: rx * -uy + ry * ux,
    rel: Math.atan2(arrow.vy, arrow.vx) - Math.atan2(by, bx),
  };
}

function stuckPose(arrow) {
  const s = arrow.stuck;
  const [i, j] = BONES[s.k];
  const p = s.a.pts[i], q = s.a.pts[j];
  const bx = q.x - p.x, by = q.y - p.y;
  const len = Math.hypot(bx, by) || 1;
  const ux = bx / len, uy = by / len;
  return {
    x: p.x + bx * s.along - uy * s.side,
    y: p.y + by * s.along + ux * s.side,
    ang: Math.atan2(by, bx) + s.rel,
  };
}

function damage(arrow, target, k) {
  const part = BONES[k][2];
  const headshot = part === "head" && !target.helmet;
  const base = headshot ? DAMAGE.head : part === "head" ? DAMAGE.body : DAMAGE[part];
  const dealt = Math.round(base * arrow.dmg);
  target.hp = Math.max(0, target.hp - dealt);
  target.stiff = 0.15;
  target.blink = 0.4;
  const shooter = arrow.owner;
  if (shooter.snack && shooter !== target && alive(shooter)) {
    shooter.hp = Math.min(shooter.maxHp, shooter.hp + Math.round(dealt / 3));
  }
  const joint = part === "head" ? HEAD : part === "body" ? (Math.random() < 0.5 ? NECK : PELVIS) : BONES[k][1];
  shove(target, joint, arrow.vx, arrow.vy, 0.35 * arrow.dmg);

  const label = headshot ? "HEADSHOT! -" + dealt : part === "head" ? "CLANG! -" + dealt : "-" + dealt;
  popup(arrow.x, arrow.y - 20, label, headshot ? "#ffcf5a" : "#ffffff", headshot ? 26 : 20);
  burst(arrow.x, arrow.y, headshot ? "#ffcf5a" : target.color, headshot ? 16 : 9);
  shake = headshot ? 10 : 5;
  if (headshot) sfx.head();
  else sfx.hit();

  if (target.hp <= 0) {
    // go floppy and fly back with the hit
    shove(target, joint, arrow.vx, arrow.vy, 1.1);
    sfx.ko();
    shake = 14;
  }
}

function updateArrows(dt) {
  const steps = 4;
  const h = dt / steps;
  for (const ar of arrows) {
    if (!ar.flying) continue;
    for (let s = 0; s < steps && ar.flying; s++) {
      ar.vx += wind * ar.windMul * h;
      ar.vy += ARROW_GRAVITY * h;
      ar.x += ar.vx * h;
      ar.y += ar.vy * h;
      ar.age += h;
      for (const a of archers) {
        if (a === ar.owner && ar.age < 0.35) continue;
        const k = boneAt(a, ar.x, ar.y);
        if (k < 0) continue;
        const sp = Math.hypot(ar.vx, ar.vy) || 1;
        ar.x += (ar.vx / sp) * 7;
        ar.y += (ar.vy / sp) * 7;
        stickToBone(ar, a, k);
        ar.flying = false;
        if (alive(a)) damage(ar, a, k);
        else shove(a, BONES[k][1], ar.vx, ar.vy, 0.5);
        break;
      }
      if (!ar.flying) break;
      if (ar.x >= 0 && ar.x <= W && ar.y >= groundAt(ar.x)) {
        ar.flying = false;
        ar.stuck = { ang: Math.atan2(ar.vy, ar.vx) };
        ar.y = groundAt(ar.x) + 6;
        dust(ar.x, groundAt(ar.x));
        sfx.thunk();
      } else if (ar.x < -60 || ar.x > W + 60 || ar.y > H + 60) {
        ar.flying = false;
        ar.gone = true;
      }
    }
    ar.trail.push({ x: ar.x, y: ar.y });
    if (ar.trail.length > 12) ar.trail.shift();
  }
  arrows = arrows.filter((ar) => !ar.gone);
  const inGround = arrows.filter((ar) => ar.stuck && ar.stuck.k === undefined);
  if (inGround.length > MAX_STUCK) arrows.splice(arrows.indexOf(inGround[0]), 1);
}

// ---------- the CPU archer ----------

// fly an imaginary arrow and see how close it gets to the target
function simulate(a, angle, power, tx, ty) {
  let x = a.pts[HAND_F].x, y = a.pts[HAND_F].y;
  const speed = SPEED_MAX * power * a.speedMul;
  let vx = Math.cos(angle) * speed * a.face;
  let vy = -Math.sin(angle) * speed;
  const h = 1 / 120;
  let closest = 1e9;
  for (let t = 0; t < 4; t += h) {
    vx += wind * a.windMul * h;
    vy += ARROW_GRAVITY * h;
    x += vx * h;
    y += vy * h;
    closest = Math.min(closest, Math.hypot(x - tx, y - ty));
    if (x < 0 || x > W || y > H || y >= groundAt(x)) break;
  }
  return closest;
}

function planShot(a) {
  const foe = archers.find((o) => o !== a);
  const tx = foe.pts[NECK].x * 0.6 + foe.pts[PELVIS].x * 0.4;
  const ty = foe.pts[NECK].y * 0.6 + foe.pts[PELVIS].y * 0.4;
  let plan = { angle: 0.7, power: 0.8, d: 1e9 };
  for (let ang = 0.15; ang < 1.35; ang += 0.08) {
    for (let pw = 0.3; pw <= 1; pw += 0.02) {
      const d = simulate(a, ang, pw, tx, ty);
      if (d < plan.d - 0.5) plan = { angle: ang, power: pw, d };
    }
  }
  // rivals get better at judging the shot the longer a duel goes on
  const err = a.err * Math.pow(0.82, a.shots);
  return {
    angle: clamp(plan.angle + gauss() * err, -0.3, 1.45),
    power: clamp(plan.power + gauss() * err * 0.45, 0.2, 1),
  };
}

function cpuThink(a, dt) {
  if (!a.cpuPlan) {
    a.cpuPlan = planShot(a);
    a.cpuTimer = 0;
  }
  a.cpuTimer += dt;
  // swing the bow round to the planned shot, then draw it back
  a.angle += (a.cpuPlan.angle - a.angle) * Math.min(1, dt * 5);
  a.power = a.cpuPlan.power;
  a.draw = smooth((a.cpuTimer - 0.5) / 0.6) * a.power;
  if (a.cpuTimer > 1.3) {
    a.angle = a.cpuPlan.angle;
    a.cpuPlan = null;
    fire(a);
  }
}

// ---------- effects ----------

function popup(x, y, text, color, size = 20) {
  popups.push({ x, y, text, color, size, life: 1.2 });
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2);
    const sp = rand(80, 260);
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, life: rand(0.4, 0.8), color, r: rand(2, 4), star: Math.random() < 0.4 });
  }
}

function dust(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({ x, y, vx: rand(-70, 70), vy: rand(-110, -30), life: rand(0.3, 0.6), color: "#c9b48a", r: rand(2, 4) });
  }
}

// ---------- turns ----------

const shooter = () => archers[turn];

function newWind() {
  const strength = mode === "ladder" ? 25 + duel * 22 : 110;
  wind = Math.round(rand(-strength, strength) / 10) * 10;
}

function startTurn(next) {
  turn = next;
  phase = "aim";
  newWind();
  const a = shooter();
  a.draw = 0;
  a.cpuPlan = null;
  drag = null;
}

function checkTurnEnd(dt) {
  if (phase === "flight" && arrows.every((ar) => !ar.flying)) {
    phase = "wait";
    phaseTimer = TURN_PAUSE;
  }
  if (phase === "wait") {
    phaseTimer -= dt;
    if (archers.some((a) => !alive(a))) {
      phase = "ko";
      phaseTimer = 2.2;
      const winner = archers.find(alive);
      popup(W / 2, 170, winner ? winner.name + (winner.name === "You" ? " win!" : " wins!") : "Double knockout!", "#ffcf5a", 34);
      if (winner && !winner.cpu) sfx.win();
    } else if (phaseTimer <= 0) {
      startTurn(1 - turn);
    }
  } else if (phase === "ko") {
    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      phase = "idle";
      endMatch();
    }
  }
}

// ---------- matches ----------

const perkLevel = (id) => perks[id] || 0;

function playerOpts() {
  return {
    name: "You", color: "#4fc3f7", hat: perkLevel("pot") ? "pot" : "band",
    hp: 100 + 30 * perkLevel("tough"),
    dmg: 1 + 0.25 * perkLevel("heavy"),
    speedMul: 1 + 0.12 * perkLevel("strong"),
    guide: 1 + 1.3 * perkLevel("eye"),
    windMul: perkLevel("steady") ? 0.5 : 1,
    split: !!perkLevel("split"), snack: !!perkLevel("snack"), helmet: !!perkLevel("pot"),
  };
}

function setupMatch() {
  arrows = [];
  particles = [];
  popups = [];
  const [lx, rx] = makeValley(mode === "ladder" ? duel : Math.floor(rand(0, 5)));
  if (mode === "ladder") {
    archers = [makeArcher(lx, 1, playerOpts()), makeArcher(rx, -1, Object.assign({ cpu: true }, FOES[duel]))];
  } else {
    archers = [
      makeArcher(lx, 1, { name: "Player 1", color: "#4fc3f7", hat: "band", hp: 100 }),
      makeArcher(rx, -1, { name: "Player 2", color: "#ff8a65", hat: "cap", hp: 100 }),
    ];
  }
  closePanels();
  paused = false;
  startTurn(0);
}

function endMatch() {
  const [left, right] = archers;
  if (mode === "duo") {
    if (alive(left)) duoScore[0]++;
    if (alive(right)) duoScore[1]++;
    const winner = alive(left) ? left : alive(right) ? right : null;
    const score = `Score: Player 1 ${duoScore[0]} - ${duoScore[1]} Player 2.`;
    if (winner) showResult(winner.name.toUpperCase(), "WINS", `${winner.name} knocked the other archer over! ${score}`, "Rematch");
    else showResult("DOUBLE", "KO", `You both fell over at once! ${score}`, "Rematch");
    return;
  }
  if (!alive(left)) {
    showResult("KNOCKED", "OUT", `${FOES[duel].name} knocked you over in duel ${duel + 1} of ${FOES.length}. Your best run: ${best} duel${best === 1 ? "" : "s"} won.`, "Try again");
    return;
  }
  duel++;
  if (duel > best) { best = duel; writeBest(best); }
  if (duel >= FOES.length) {
    showResult("GOLDEN", "BOW", "You beat all 8 rivals, even the Grand Wobbler! You are the floppiest archer in the land.", "New run");
    return;
  }
  showPerks();
}

function showPerks() {
  const open = PERKS.filter((p) => perkLevel(p.id) < p.max);
  const picks = [];
  while (picks.length < 3 && open.length) picks.push(open.splice(Math.floor(Math.random() * open.length), 1)[0]);
  $("perk-title").textContent = "You beat " + FOES[duel - 1].name + "!";
  $("perk-sub").textContent = `Next up: ${FOES[duel].name} (duel ${duel + 1} of ${FOES.length}). Pick a perk:`;
  const list = $("perk-list");
  list.innerHTML = "";
  picks.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "perk";
    const lvl = perkLevel(p.id);
    btn.innerHTML = `<span class="perk-icon">${p.icon}</span><b>${p.name}${p.max > 1 ? " " + "I".repeat(lvl + 1) : ""}</b><small>${p.desc}</small>`;
    btn.addEventListener("click", () => {
      perks[p.id] = lvl + 1;
      sfx.pick();
      setupMatch();
    });
    list.appendChild(btn);
  });
  openPanel("perk-screen");
}

let againAction = null;

function showResult(a, b, text, againLabel) {
  $("result-title").innerHTML = `${a}<span>${b}</span>`;
  $("result-text").textContent = text;
  $("result-again").textContent = againLabel;
  againAction = mode === "duo" ? setupMatch : startLadder;
  openPanel("result-screen");
}

function startLadder() {
  mode = "ladder";
  duel = 0;
  perks = {};
  setupMatch();
}

function startDuo() {
  mode = "duo";
  duoScore = [0, 0];
  setupMatch();
}

// ---------- update ----------

let physAcc = 0;

function stepPhysics(dt) {
  physAcc += dt;
  while (physAcc >= PHYS_DT) {
    physAcc -= PHYS_DT;
    archers.forEach(stepBody);
  }
}

function update(dt) {
  clock += dt;
  const a = shooter();
  if (phase === "aim" && a) {
    if (a.cpu) cpuThink(a, dt);
    else keyAim(a, dt);
  }
  stepPhysics(dt);
  archers.forEach((ar) => {
    ar.stiff = Math.min(1, ar.stiff + dt * 0.9);
    ar.shownHp += (ar.hp - ar.shownHp) * Math.min(1, dt * 6);
    ar.blink = Math.max(0, ar.blink - dt);
  });
  updateArrows(dt);
  checkTurnEnd(dt);

  for (const p of particles) {
    p.vy += 500 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const p of popups) { p.y -= 30 * dt; p.life -= dt; }
  popups = popups.filter((p) => p.life > 0);
  for (const c of clouds) {
    c.x += (8 + wind * 0.08) * dt * c.s;
    if (c.x > W + 120) c.x = -120;
    if (c.x < -120) c.x = W + 120;
  }
  shake = Math.max(0, shake - dt * 30);
}

function keyAim(a, dt) {
  const before = a.angle + a.power;
  if (keys.ArrowUp) a.angle = clamp(a.angle + dt * 1.1, -0.5, 1.5);
  if (keys.ArrowDown) a.angle = clamp(a.angle - dt * 1.1, -0.5, 1.5);
  if (keys.ArrowRight) a.power = clamp(a.power + dt * 0.6, 0.1, 1);
  if (keys.ArrowLeft) a.power = clamp(a.power - dt * 0.6, 0.1, 1);
  if (a.angle + a.power !== before) a.usedKeys = true;
  if (!drag && a.usedKeys) a.draw = a.power;
}

// ---------- input ----------

function toBoard(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

const humanAiming = () => !paused && phase === "aim" && shooter() && !shooter().cpu;

function aimFromDrag(a) {
  const dx = drag.sx - drag.x;
  const dy = drag.sy - drag.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return;
  a.power = clamp(dist / DRAG_FULL, 0.1, 1);
  a.angle = clamp(Math.atan2(-dy, dx * a.face), -0.5, 1.5);
  a.draw = a.power;
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (!humanAiming()) return;
  canvas.setPointerCapture(e.pointerId);
  const p = toBoard(e);
  drag = { sx: p.x, sy: p.y, x: p.x, y: p.y };
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || !humanAiming()) return;
  const p = toBoard(e);
  drag.x = p.x;
  drag.y = p.y;
  aimFromDrag(shooter());
});
function release() {
  if (!drag) return;
  const pulled = Math.hypot(drag.sx - drag.x, drag.sy - drag.y) >= 15;
  drag = null;
  if (humanAiming() && pulled) fire(shooter());
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", () => { drag = null; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow") || e.code === "Space") e.preventDefault();
  keys[e.key] = true;
  if (e.code === "Space" && !e.repeat && humanAiming() && !drag) fire(shooter());
  const key = e.key.toLowerCase();
  if (key === "m") toggleMute();
  else if (key === "escape") openPanel("title-screen");
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });
window.addEventListener("blur", () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); drag = null; });

const PANELS = ["title-screen", "perk-screen", "result-screen"];

function openPanel(id) {
  PANELS.forEach((p) => $(p).classList.toggle("hidden", p !== id));
  paused = true;
  drag = null;
}

function closePanels() {
  PANELS.forEach((p) => $(p).classList.add("hidden"));
}

function toggleMute() {
  muted = !muted;
  $("mute").textContent = muted ? "🔇" : "🔊";
}

$("mute").addEventListener("click", toggleMute);
$("open-menu").addEventListener("click", () => openPanel("title-screen"));
$("play-ladder").addEventListener("click", startLadder);
$("play-duo").addEventListener("click", startDuo);
$("result-again").addEventListener("click", () => againAction && againAction());
$("result-menu").addEventListener("click", () => openPanel("title-screen"));

// ---------- drawing ----------

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ff9e7a");
  g.addColorStop(0.45, "#ffcf9a");
  g.addColorStop(1, "#ffe8c2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255, 245, 200, 0.9)";
  ctx.beginPath();
  ctx.arc(W * 0.72, 150, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 50 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 24 * c.s, c.y - 10 * c.s, 30 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#c98b8f";
  for (const h of hills) {
    ctx.beginPath();
    ctx.arc(h.x, 470, h.r, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = "#a56f80";
  for (const h of hills) {
    ctx.beginPath();
    ctx.arc(h.x + 85, 520, h.r * 0.8, Math.PI, 0);
    ctx.fill();
  }
}

function drawGround() {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ground[x]);
  ctx.lineTo(W, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 280, 0, H);
  g.addColorStop(0, "#7a5a44");
  g.addColorStop(1, "#4a3428");
  ctx.fillStyle = g;
  ctx.fill();
  // grass on top
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ground[x] + 2);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#6fbf5a";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = "#8fdc6e";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawArrow(x, y, ang) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-ARROW_LEN, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.fillStyle = "#cfd8dc";
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5, 4);
  ctx.fill();
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.moveTo(-ARROW_LEN + 9, 0);
  ctx.lineTo(-ARROW_LEN - 1, -5);
  ctx.lineTo(-ARROW_LEN + 3, 0);
  ctx.lineTo(-ARROW_LEN - 1, 5);
  ctx.fill();
  ctx.restore();
}

function drawArrows() {
  for (const ar of arrows) {
    if (ar.flying) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ar.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      drawArrow(ar.x, ar.y, Math.atan2(ar.vy, ar.vx));
      // a little marker when the arrow is above the top of the screen
      if (ar.y < 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(ar.x, 6);
        ctx.lineTo(ar.x - 7, 18);
        ctx.lineTo(ar.x + 7, 18);
        ctx.fill();
      }
    } else if (ar.stuck && ar.stuck.k === undefined) {
      drawArrow(ar.x, ar.y, ar.stuck.ang);
    }
  }
}

// rotate the canvas so "up" is the way the head points, and "forward" is the way the archer faces
function headSpace(a) {
  const h = a.pts[HEAD], n = a.pts[NECK];
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(Math.atan2(h.y - n.y, h.x - n.x) + Math.PI / 2);
  ctx.scale(a.face, 1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a1f2f";
  ctx.fillStyle = "#2a1f2f";
}

function drawHat(a) {
  headSpace(a);
  const R = HEAD_R;
  const shape = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  switch (a.hat) {
    case "band":
      ctx.fillStyle = "#e53935";
      ctx.fillRect(-R, -7, R * 2, 5);
      shape([[-R, -5], [-R - 10, -2 + Math.sin(clock * 8) * 2], [-R - 9, -8 + Math.sin(clock * 8 + 1) * 2]]);
      break;
    case "cap":
      ctx.fillStyle = a.color === "#ff8a65" ? "#5c6bc0" : "#ef6c00";
      ctx.beginPath();
      ctx.arc(0, -4, R, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(0, -6, R + 8, 4);
      break;
    case "sprout":
      ctx.strokeStyle = "#558b2f";
      ctx.beginPath();
      ctx.moveTo(0, -R);
      ctx.lineTo(0, -R - 8);
      ctx.stroke();
      ctx.fillStyle = "#7cb342";
      ctx.beginPath();
      ctx.ellipse(-5, -R - 9, 6, 3, -0.5, 0, Math.PI * 2);
      ctx.ellipse(5, -R - 9, 6, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "leaf":
      ctx.fillStyle = "#6d8b3a";
      ctx.beginPath();
      ctx.ellipse(0, -R + 1, R + 3, 6, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#c0ca33";
      ctx.beginPath();
      ctx.ellipse(6, -R - 4, 8, 3, -0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "pot":
      ctx.fillStyle = "#9e9e9e";
      ctx.beginPath();
      ctx.arc(0, -3, R + 2, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#616161";
      ctx.fillRect(R, -6, 10, 3);
      ctx.fillRect(-2, -R - 6, 4, 4);
      break;
    case "witch":
      ctx.fillStyle = "#4a148c";
      ctx.beginPath();
      ctx.ellipse(0, -R + 2, R + 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      shape([[-R + 2, -R + 2], [R - 2, -R + 2], [-6, -R - 24]]);
      break;
    case "pirate":
      ctx.fillStyle = "#212121";
      ctx.beginPath();
      ctx.moveTo(-R - 6, -R + 4);
      ctx.quadraticCurveTo(0, -R - 18, R + 6, -R + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, -R - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "bow":
      ctx.fillStyle = "#f06292";
      shape([[0, -R], [-9, -R - 7], [-9, -R + 3]]);
      shape([[0, -R], [9, -R - 7], [9, -R + 3]]);
      break;
    case "crown":
      ctx.fillStyle = "#ffca28";
      shape([[-R + 1, -R + 3], [-R + 1, -R - 9], [-5, -R - 3], [0, -R - 12], [5, -R - 3], [R - 1, -R - 9], [R - 1, -R + 3]]);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawFace(a) {
  headSpace(a);
  if (!alive(a)) {
    for (const ex of [1, 7]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, -4); ctx.lineTo(ex + 2.5, 1);
      ctx.moveTo(ex + 2.5, -4); ctx.lineTo(ex - 2.5, 1);
      ctx.stroke();
    }
  } else if (a.blink > 0) {
    // ouch face
    ctx.beginPath();
    ctx.moveTo(-1, -2); ctx.lineTo(4, -1);
    ctx.moveTo(6, -1); ctx.lineTo(10, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, 5, 3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(2, -2, 1.8, 0, Math.PI * 2);
    ctx.arc(8, -2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, 3, 3.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBow(a) {
  const hand = a.pts[HAND_F], back = a.pts[HAND_B];
  const ang = Math.atan2(-Math.sin(a.angle), Math.cos(a.angle) * a.face);
  const cx = Math.cos(ang), cy = Math.sin(ang);
  const nx = -cy, ny = cx;
  const r = 26;
  const t1 = { x: hand.x + nx * r - cx * 8, y: hand.y + ny * r - cy * 8 };
  const t2 = { x: hand.x - nx * r - cx * 8, y: hand.y - ny * r - cy * 8 };
  ctx.strokeStyle = "#8d5a2b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.quadraticCurveTo(hand.x + cx * 10, hand.y + cy * 10, t2.x, t2.y);
  ctx.stroke();
  // the string goes back to the pulling hand while drawing
  const pulling = a.draw > 0.05;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  if (pulling) ctx.lineTo(back.x, back.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.stroke();
  if (pulling) drawArrow(hand.x + cx * 6, hand.y + cy * 6, ang);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => clamp(Math.round(c + c * amt), 0, 255);
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// back arm and leg first, a bit darker, then the body and the front limbs
const DRAW_ORDER = [4, 5, 6, 7, 8, 9, 1, 2, 3];
const BACK_BONES = new Set([4, 5, 6, 7]);

function drawArcher(a) {
  const p = a.pts;
  const flash = a.blink > 0 && Math.floor(a.blink * 20) % 2 === 0;
  ctx.lineCap = "round";
  for (const k of DRAW_ORDER) {
    const [i, j, , thick] = BONES[k];
    ctx.strokeStyle = flash ? "#ffffff" : BACK_BONES.has(k) ? shade(a.color, -0.25) : a.color;
    ctx.lineWidth = thick + 1;
    ctx.beginPath();
    ctx.moveTo(p[i].x, p[i].y);
    ctx.lineTo(p[j].x, p[j].y);
    ctx.stroke();
  }
  for (const ar of arrows) {
    if (ar.stuck && ar.stuck.a === a) {
      const s = stuckPose(ar);
      drawArrow(s.x, s.y, s.ang);
    }
  }
  const h = p[HEAD];
  ctx.fillStyle = flash ? "#ffffff" : "#ffd9b0";
  ctx.strokeStyle = "#2a1f2f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(h.x, h.y, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawFace(a);
  drawHat(a);
  if (alive(a)) drawBow(a);
}

function drawGuide() {
  if (!humanAiming()) return;
  const a = shooter();
  if (a.draw < 0.05) return;
  let x = a.pts[HAND_F].x, y = a.pts[HAND_F].y;
  const speed = SPEED_MAX * a.power * a.speedMul;
  const vx = Math.cos(a.angle) * speed * a.face;
  let vy = -Math.sin(a.angle) * speed;
  const h = 1 / 60;
  const steps = Math.round((GUIDE_TIME * a.guide) / h);
  ctx.fillStyle = "#ffffff";
  // the guide ignores the wind: judging that is up to you
  for (let i = 0; i < steps; i++) {
    vy += ARROW_GRAVITY * h;
    x += vx * h;
    y += vy * h;
    if (i % 2 === 0) {
      ctx.globalAlpha = 1 - i / steps;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.font = "700 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  const deg = Math.round((a.angle * 180) / Math.PI);
  ctx.fillText(`${Math.round(a.power * 100)}% · ${deg}°`, a.x, groundAt(a.x) + 24);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (w <= 0) return;
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function drawHealth(a, left) {
  const w = 260, h = 14;
  const x = left ? 20 : W - 20 - w;
  const y = 18;
  ctx.fillStyle = "rgba(42, 31, 47, 0.75)";
  roundRect(x - 6, y - 6, w + 12, h + 34, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  roundRect(x, y + 18, w, h, 6);
  ctx.fill();
  const frac = clamp(a.shownHp / a.maxHp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? "#6fd38a" : frac > 0.25 ? "#ffcf5a" : "#ff6a5a";
  roundRect(left ? x : x + w * (1 - frac), y + 18, w * frac, h, 6);
  ctx.fill();
  ctx.font = "700 14px Inter, sans-serif";
  ctx.fillStyle = archers[turn] === a && phase === "aim" && !paused ? "#ffcf5a" : "#ffffff";
  ctx.textAlign = left ? "left" : "right";
  ctx.fillText(a.name, left ? x : x + w, y + 10);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = left ? "right" : "left";
  ctx.fillText(Math.ceil(a.hp) + "/" + a.maxHp, left ? x + w : x, y + 10);
}

function drawWind() {
  const cx = W / 2, cy = 34;
  ctx.fillStyle = "rgba(42, 31, 47, 0.75)";
  roundRect(cx - 80, cy - 22, 160, 44, 10);
  ctx.fill();
  ctx.font = "700 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(wind === 0 ? "NO WIND" : "WIND " + Math.abs(wind / 10), cx, cy - 5);
  if (wind === 0) return;
  const len = 10 + Math.min(60, Math.abs(wind) * 0.3);
  const dir = Math.sign(wind);
  const wob = Math.sin(clock * 6) * 2;
  const tip = cx + (len / 2) * dir + wob;
  ctx.strokeStyle = "#7be0a0";
  ctx.fillStyle = "#7be0a0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - (len / 2) * dir + wob, cy + 9);
  ctx.lineTo(tip, cy + 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tip + 7 * dir, cy + 9);
  ctx.lineTo(tip, cy + 3);
  ctx.lineTo(tip, cy + 15);
  ctx.fill();
}

function drawEffects() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if (p.star) {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? p.r : p.r * 2.4;
        const ang = (i / 10) * Math.PI * 2 + p.life * 6;
        ctx.lineTo(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r);
      }
    } else {
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.textAlign = "center";
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.font = `${p.size}px "Russo One", Impact, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#2a1f2f";
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawHint() {
  if (paused || phase !== "aim") return;
  const a = shooter();
  let text = "";
  if (a.cpu) text = a.name + " is aiming...";
  else if (mode === "duo") text = a.name + ": drag back and let go to shoot";
  else if (a.shots === 0 && duel === 0) text = "Drag back anywhere, then let go to shoot!";
  if (!text) return;
  ctx.font = "700 16px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(42, 31, 47, 0.8)";
  ctx.strokeText(text, W / 2, 104);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, W / 2, 104);
}

function drawDrag() {
  if (!drag || !humanAiming()) return;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(drag.sx, drag.sy);
  ctx.lineTo(drag.x, drag.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.arc(drag.sx, drag.sy, 5, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  drawSky();
  drawGround();
  archers.forEach(drawArcher);
  drawArrows();
  drawEffects();
  drawGuide();
  drawDrag();
  ctx.restore();
  if (mode !== "title") {
    drawHealth(archers[0], true);
    drawHealth(archers[1], false);
    drawWind();
    drawHint();
  }
}

function updateHud() {
  $("duel").textContent = mode === "ladder" ? `${Math.min(duel + 1, FOES.length)}/${FOES.length}`
    : mode === "duo" ? `${duoScore[0]} - ${duoScore[1]}` : "-";
  $("wind").textContent = mode === "title" ? "-"
    : wind === 0 ? "calm" : (wind < 0 ? "← " : "") + Math.abs(wind / 10) + (wind > 0 ? " →" : "");
  $("best").textContent = best + "/" + FOES.length;
}

// ---------- main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) update(dt);
  else {
    clock += dt;
    stepPhysics(dt);
  }
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

// two archers to look at behind the title screen
const [titleL, titleR] = makeValley(0);
archers = [
  makeArcher(titleL, 1, { name: "You", color: "#4fc3f7", hat: "band", hp: 100 }),
  makeArcher(titleR, -1, Object.assign({ cpu: true }, FOES[0])),
];
requestAnimationFrame(frame);
