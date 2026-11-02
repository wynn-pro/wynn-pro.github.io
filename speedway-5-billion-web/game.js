// Speedway 5 Billion: a monster kart racing game with 3 tropical tracks.
// Six monsters race their karts round Coconut Beach, Jungle Jumble and Pirate Cove. Hold drift round corners
// for a spark boost, smash item boxes for rockets, slime, bouncy balls and shields, and race the computer
// or a friend on a split screen. The road is "pseudo-3D": it is drawn as lots of flat strips that get smaller
// the further away they are, just like old arcade racers. Everything is drawn by this code, with no picture files.
"use strict";

// ---------- 1. numbers you can change ----------
const LAPS = 3;
const SEG_LEN = 200;            // the track is made of strips this long
const ROAD_W = 1600;            // half the width of the road
const CAM_H = 1300;             // how high up the camera is
const CAM_DEPTH = 1 / Math.tan(50 * Math.PI / 180);   // a 100 degree wide view
const PLAYER_Z = CAM_H * CAM_DEPTH;                    // how far in front of the camera your kart is
const DRAW_DIST = 190;          // how many strips ahead you can see
const KART_W = 560;             // how wide a kart is, in road units
const KART_HALF = KART_W / ROAD_W / 2;   // ...and half of that, measured in road widths
const BASE_TOP = 6400;          // top speed before the monster's speed stat
const SAND_TOP = 0.45;          // off the road you can only go this fraction of top speed
const CENTRIFUGAL = 0.4;        // how hard corners push you outwards
const DRIFT_BLUE = 0.8;         // seconds of drifting for a small blue boost
const DRIFT_ORANGE = 1.9;       // ...and for a big orange boost
const ROCKET_TIME = 2.2;
const SHIELD_TIME = 12;
const SPIN_TIME = 1.3;
const BALL_SPEED = 10500;
const BOX_RESPAWN = 3;
const POINTS = [10, 8, 6, 4, 2, 1];
const SAVE_KEY = "speedway5b-save";
const STEP = 1 / 120;           // the game moves in tiny steps so fast karts never skip through things
const SPEEDS = [
  { name: "Chill", about: "Nice and easy", top: 0.85, ai: 0.86 },
  { name: "Zoom", about: "Fast!", top: 1, ai: 0.95 },
  { name: "5 Billion", about: "SUPER fast and tough", top: 1.18, ai: 1.02 },
];
const ITEMS = ["rocket", "slime", "ball", "shield"];
const ITEM_NAMES = { rocket: "Rocket boost", slime: "Slime splat", ball: "Bouncy ball", shield: "Shield bubble" };

// ---------- 2. little helpers ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (a, b, t) => a + (b - a) * t * t;
const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
const wrap = (v, m) => ((v % m) + m) % m;
const ordinal = n => n + (["th", "st", "nd", "rd"][n] || "th");
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}
function makeCanvas(w, h, fn) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  fn(cv.getContext("2d"), w, h);
  return cv;
}
// drawing shortcuts: make a shape, then paint() fills and outlines it
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
function oval(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function paint(c, fill, stroke, lw) {
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function star(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath();
}

// ---------- 3. the six monsters ----------
// speed = top speed, accel = how fast you pick up speed, turn = how sharply you can steer. They all add up to 9.
const MONSTERS = [
  { name: "Blorp", kind: "slime", color: "#5fd36a", dark: "#2a7a34", light: "#b8f5b0", kart: "#3a7bff",
    speed: 3, accel: 3, turn: 3, about: "A wobbly slime. Good at everything!" },
  { name: "Fuzzle", kind: "fuzz", color: "#ff7fbf", dark: "#a8326e", light: "#ffd0e8", kart: "#7a4cff",
    speed: 2, accel: 5, turn: 2, about: "Fluffy and super quick off the start." },
  { name: "Chompo", kind: "chomp", color: "#ff9a2a", dark: "#a8520c", light: "#ffd59a", kart: "#2fbf71",
    speed: 5, accel: 2, turn: 2, about: "Huge mouth, huge top speed." },
  { name: "Zib", kind: "cyclops", color: "#4aa8ff", dark: "#1a5aa8", light: "#bfe0ff", kart: "#ffcf3f",
    speed: 2, accel: 2, turn: 5, about: "One big eye for tight corners." },
  { name: "Grumble", kind: "horns", color: "#ff5a5a", dark: "#9a2222", light: "#ffb5b5", kart: "#4a5068",
    speed: 4, accel: 3, turn: 2, about: "Grumpy, strong and fast." },
  { name: "Wisp", kind: "ghost", color: "#c4a2ff", dark: "#6a45b8", light: "#efe4ff", kart: "#ff5aa0",
    speed: 2, accel: 3, turn: 4, about: "A floaty ghost that zips around." },
];

// Monsters are drawn around the point (0, 0), about 1 unit tall each way. front = true shows the face.
function drawMonster(c, m, front) {
  const k = m.kind, dk = m.dark, lw = 0.08;
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  // the bits that stick out from behind the head
  if (k === "fuzz") for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 0.35, -0.75); c.quadraticCurveTo(s * 0.55, -1.35, s * 0.25, -1.45);
    c.quadraticCurveTo(s * 0.3, -1.1, s * 0.08, -0.85); c.closePath(); paint(c, "#fff3c8", dk, lw);
  }
  if (k === "horns") for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 0.55, -0.6); c.quadraticCurveTo(s * 1.45, -0.8, s * 1.15, -1.55);
    c.quadraticCurveTo(s * 1.05, -1.0, s * 0.3, -0.85); c.closePath(); paint(c, "#fff0d0", "#8a6a3a", lw);
  }
  if (k === "cyclops") {
    c.beginPath(); c.moveTo(0, -0.95); c.quadraticCurveTo(0.2, -1.3, 0.05, -1.45); paint(c, null, dk, 0.09);
    circle(c, 0.05, -1.5, 0.15); paint(c, "#ffcf3f", dk, 0.06);
  }
  if (k === "chomp") for (const x of [-0.5, 0, 0.5]) {
    const lift = Math.abs(x) * 0.3;
    c.beginPath(); c.moveTo(x - 0.2, -0.82 + lift); c.lineTo(x, -1.28 + lift); c.lineTo(x + 0.2, -0.82 + lift);
    c.closePath(); paint(c, m.light, dk, lw);
  }
  // the body
  c.beginPath();
  if (k === "slime") {
    c.moveTo(-1, 0.8);
    c.bezierCurveTo(-1.1, -0.5, -0.6, -1.05, 0, -1.05);
    c.bezierCurveTo(0.6, -1.05, 1.1, -0.5, 1, 0.8);
    c.quadraticCurveTo(0.85, 1, 0.65, 0.85); c.quadraticCurveTo(0.45, 1.1, 0.2, 0.88);
    c.quadraticCurveTo(-0.1, 1.05, -0.35, 0.86); c.quadraticCurveTo(-0.7, 1.05, -1, 0.8);
  } else if (k === "fuzz") {
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * Math.PI * 2, r = i % 2 ? 0.86 : 1.02;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else if (k === "chomp") {
    c.arc(0, 0, 1, 0, Math.PI * 2);
  } else if (k === "cyclops") {
    c.ellipse(0, 0, 0.82, 1.02, 0, 0, Math.PI * 2);
  } else if (k === "horns") {
    rr(c, -0.95, -0.9, 1.9, 1.8, 0.55);
  } else {
    c.moveTo(-0.9, 0.85); c.lineTo(-0.9, -0.1); c.arc(0, -0.1, 0.9, Math.PI, 0); c.lineTo(0.9, 0.85);
    for (let i = 0; i < 3; i++) {
      const x = 0.9 - i * 0.6;
      c.quadraticCurveTo(x - 0.15, 0.62, x - 0.3, 0.85);
      c.quadraticCurveTo(x - 0.45, 1.08, x - 0.6, 0.85);
    }
  }
  c.closePath();
  paint(c, m.color, dk, lw);
  c.globalAlpha = 0.6;
  oval(c, -0.42, -0.55, 0.22, 0.12, -0.6); paint(c, m.light);
  c.globalAlpha = 1;
  if (front) drawFace(c, m); else drawBackside(c, m);
  c.restore();
}
function eye(c, x, y, r, dk) {
  circle(c, x, y, r); paint(c, "#fff", dk, 0.06);
  circle(c, x + r * 0.15, y + r * 0.1, r * 0.52); paint(c, "#1a1a22");
  circle(c, x + r * 0.32, y - r * 0.12, r * 0.18); paint(c, "#fff");
}
function drawFace(c, m) {
  const k = m.kind, dk = m.dark, P = Math.PI;
  if (k === "slime") {
    eye(c, -0.35, -0.25, 0.25, dk); eye(c, 0.35, -0.25, 0.25, dk);
    c.beginPath(); c.arc(0, 0.12, 0.38, 0.15 * P, 0.85 * P); paint(c, null, dk, 0.1);
  } else if (k === "fuzz") {
    eye(c, -0.32, -0.15, 0.23, dk); eye(c, 0.32, -0.15, 0.23, dk);
    for (const s of [-1, 1]) { oval(c, s * 0.6, 0.22, 0.14, 0.08); paint(c, "#ff4f9a"); }
    c.beginPath(); c.arc(0, 0.22, 0.24, 0.1 * P, 0.9 * P); paint(c, null, dk, 0.08);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.16, 0.44); c.lineTo(s * 0.1, 0.58); c.lineTo(s * 0.04, 0.45); c.closePath(); paint(c, "#fff", dk, 0.03); }
  } else if (k === "chomp") {
    eye(c, -0.38, -0.5, 0.2, dk); eye(c, 0.38, -0.5, 0.2, dk);
    c.beginPath(); c.moveTo(-0.8, -0.18); c.quadraticCurveTo(0, 1.3, 0.8, -0.18); c.closePath();
    paint(c, "#7a1020", dk, 0.08);
    oval(c, 0, 0.42, 0.3, 0.14); paint(c, "#ff7a9a");
    for (let i = 0; i < 5; i++) {
      const x = -0.6 + i * 0.3;
      c.beginPath(); c.moveTo(x - 0.1, -0.17); c.lineTo(x, 0.05); c.lineTo(x + 0.1, -0.17); c.closePath(); paint(c, "#fff");
    }
  } else if (k === "cyclops") {
    eye(c, 0, -0.3, 0.42, dk);
    c.beginPath(); c.arc(0, 0.3, 0.24, 0.15 * P, 0.85 * P); paint(c, null, dk, 0.08);
  } else if (k === "horns") {
    eye(c, -0.38, -0.18, 0.2, dk); eye(c, 0.38, -0.18, 0.2, dk);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.64, -0.52); c.lineTo(s * 0.16, -0.36); paint(c, null, dk, 0.11); }
    c.beginPath(); c.moveTo(-0.35, 0.42); c.lineTo(0.35, 0.42); paint(c, null, dk, 0.08);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.28, 0.42); c.lineTo(s * 0.22, 0.26); c.lineTo(s * 0.16, 0.42); c.closePath(); paint(c, "#fff"); }
  } else {
    for (const s of [-1, 1]) { oval(c, s * 0.3, -0.2, 0.13, 0.2); paint(c, "#2a1a40"); }
    oval(c, 0, 0.25, 0.12, 0.15); paint(c, "#2a1a40");
    for (const s of [-1, 1]) { oval(c, s * 0.58, 0.1, 0.12, 0.07); paint(c, "#ff8ac8"); }
  }
}
function drawBackside(c, m) {
  const k = m.kind, dk = m.dark;
  c.globalAlpha = 0.55;
  if (k === "slime") {
    for (const [x, y, r] of [[0.3, -0.2, 0.13], [-0.25, 0.3, 0.09], [0.45, 0.4, 0.07], [-0.5, -0.1, 0.06]]) { circle(c, x, y, r); paint(c, m.light); }
  } else if (k === "fuzz") {
    for (const [x, y] of [[-0.4, -0.3], [0.3, -0.4], [0, 0.1], [-0.3, 0.45], [0.45, 0.3]]) {
      c.beginPath(); c.moveTo(x - 0.12, y + 0.08); c.lineTo(x, y - 0.1); c.lineTo(x + 0.12, y + 0.08); paint(c, null, dk, 0.06);
    }
  } else if (k === "chomp") {
    for (const y of [-0.35, 0.05, 0.45]) { c.beginPath(); c.moveTo(-0.85 + Math.abs(y) * 0.3, y); c.quadraticCurveTo(0, y + 0.2, 0.85 - Math.abs(y) * 0.3, y); paint(c, null, dk, 0.12); }
  } else if (k === "cyclops") {
    for (const [x, y, r] of [[-0.3, -0.3, 0.15], [0.3, 0.1, 0.18], [-0.2, 0.5, 0.1], [0.35, -0.5, 0.08]]) { circle(c, x, y, r); paint(c, dk); }
  } else if (k === "horns") {
    for (const [x, y, r] of [[-0.4, 0.2, 0.16], [0.35, -0.2, 0.2], [0.2, 0.5, 0.1]]) { circle(c, x, y, r); paint(c, dk); }
  } else {
    c.beginPath(); c.arc(0.1, 0.1, 0.3, 0, Math.PI * 1.6); c.arc(0.1, 0.1, 0.12, Math.PI * 1.6, 0, true); paint(c, null, m.light, 0.08);
  }
  c.globalAlpha = 1;
}

// A kart seen from behind, with its monster driving. pose is -1 (turning left), 0 or 1 (turning right).
const KART_IMG_W = 240, KART_IMG_H = 210;
function drawKartBack(c, m, pose) {
  c.translate(120, 200);
  c.scale(100, 100);
  c.lineJoin = "round";
  oval(c, 0, -0.02, 1.12, 0.1); paint(c, "rgba(0,0,0,0.3)");
  // the monster sits in the seat, leaning into the turn
  c.save();
  c.translate(pose * 0.14, -1.12);
  c.rotate(pose * 0.12);
  c.scale(0.6, 0.6);
  drawMonster(c, m, false);
  c.restore();
  const sh = pose * 0.05;
  for (const side of [-1, 1]) {
    const big = 1 + side * pose * 0.08;
    rr(c, side * 0.9 - 0.19 * big + sh, -0.46 * big, 0.38 * big, 0.46 * big, 0.1); paint(c, "#1d1d24");
    for (let i = 1; i < 4; i++) {
      c.beginPath(); c.moveTo(side * 0.9 - 0.15 * big + sh, -i * 0.11 * big); c.lineTo(side * 0.9 + 0.15 * big + sh, -i * 0.11 * big);
      paint(c, null, "#3e3e4c", 0.04);
    }
  }
  // spoiler wing
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.45 + sh, -0.86); c.lineTo(s * 0.45 + sh * 2, -1.0); paint(c, null, "#1a1a22", 0.07); }
  rr(c, -0.78 + sh * 2, -1.08, 1.56, 0.12, 0.05); paint(c, m.kart, "#1a1a22", 0.05);
  // body
  c.beginPath(); c.moveTo(-0.62 + sh, -0.86); c.lineTo(0.62 + sh, -0.86); c.lineTo(0.84 + sh, -0.22); c.lineTo(-0.84 + sh, -0.22); c.closePath();
  paint(c, m.kart, "#1a1a22", 0.06);
  c.globalAlpha = 0.7;
  rr(c, -0.72 + sh, -0.66, 1.44, 0.09, 0.04); paint(c, "#fff");
  c.globalAlpha = 1;
  for (const s of [-1, 1]) { rr(c, s * 0.62 - 0.09 + sh, -0.52, 0.18, 0.1, 0.03); paint(c, "#ff3a3a", "#1a1a22", 0.03); }
  // number plate
  rr(c, -0.22 + sh, -0.52, 0.44, 0.2, 0.04); paint(c, "#fff", "#1a1a22", 0.03);
  c.save();
  c.scale(0.01, 0.01);
  c.fillStyle = "#1a1a22";
  c.font = "bold 16px Arial, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("5B", sh * 100, -41);
  c.restore();
  // bumper and exhaust pipes
  rr(c, -0.9 + sh, -0.27, 1.8, 0.14, 0.06); paint(c, "#2a2a33");
  for (const s of [-1, 1]) { circle(c, s * 0.42 + sh, -0.31, 0.08); paint(c, "#9a9aa8", "#1a1a22", 0.03); circle(c, s * 0.42 + sh, -0.31, 0.045); paint(c, "#1a1a22"); }
}

// ---------- 4. pictures of everything beside the road, drawn once when the game starts ----------
const SPRITES = {};
// w = how wide it is in road units, solid = karts crash into it
function sprite(name, cw, ch, w, solid, fn) { SPRITES[name] = { img: makeCanvas(cw, ch, fn), w, solid }; }

sprite("palm", 240, 340, 1100, true, c => {
  c.lineCap = "round";
  const trunk = () => { c.beginPath(); c.moveTo(110, 336); c.quadraticCurveTo(80, 210, 120, 96); };
  trunk(); paint(c, null, "#6e4220", 26);
  c.setLineDash([7, 9]); trunk(); paint(c, null, "#b07a40", 14); c.setLineDash([]);
  const leaf = (a, flip) => {
    c.save(); c.translate(120, 96); c.scale(flip, 1); c.rotate(a);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(50, -34, 98, 12); c.quadraticCurveTo(52, 10, 0, 0); paint(c, "#2fae4a", "#1d7a33", 3);
    c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(50, -16, 94, 10); paint(c, null, "#1d7a33", 2);
    c.restore();
  };
  for (const f of [-1, 1]) for (const a of [-0.9, -0.35, 0.2]) leaf(a, f);
  leaf(-1.45, 1);
  for (const [x, y] of [[112, 104], [128, 108], [120, 116]]) { circle(c, x, y, 9); paint(c, "#6b4220", "#3a2410", 2); }
});
sprite("umbrella", 200, 240, 760, true, c => {
  c.beginPath(); c.moveTo(100, 100); c.lineTo(104, 238); paint(c, null, "#e8e8e8", 7);
  const cx = 100, cy = 100, r = 90, P = Math.PI;
  c.beginPath(); c.moveTo(cx - r, cy); c.arc(cx, cy, r, P, 0); c.closePath(); paint(c, "#fff");
  for (let i = 0; i < 6; i += 2) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, P + i * P / 6, P + (i + 1) * P / 6); c.closePath(); paint(c, "#ff4a5a"); }
  c.beginPath(); c.arc(cx, cy, r, P, 0); c.closePath(); paint(c, null, "#a82a36", 3);
  circle(c, cx, cy - r, 6); paint(c, "#ff4a5a", "#a82a36", 2);
});
sprite("hut", 320, 260, 1700, true, c => {
  rr(c, 40, 120, 240, 136, 6); paint(c, "#f0b86a", "#9a6a2a", 4);
  for (let y = 145; y < 250; y += 22) { c.beginPath(); c.moveTo(44, y); c.lineTo(276, y); paint(c, null, "#c98a3a", 2); }
  rr(c, 135, 165, 50, 91, 6); paint(c, "#7a4a22", "#5a3010", 3);
  rr(c, 62, 152, 54, 40, 4); paint(c, "#7ad0ff", "#9a6a2a", 3);
  rr(c, 204, 152, 54, 40, 4); paint(c, "#7ad0ff", "#9a6a2a", 3);
  c.beginPath(); c.moveTo(8, 132); c.lineTo(160, 30); c.lineTo(312, 132); c.closePath(); paint(c, "#e2b34a", "#a8781a", 4);
  c.globalAlpha = 0.5;
  for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(160, 34); c.lineTo(14 + i * 29.2, 130); paint(c, null, "#a8781a", 2); }
  c.globalAlpha = 1;
  rr(c, 95, 98, 130, 28, 6); paint(c, "#ff5aa0", "#fff", 3);
  c.fillStyle = "#fff"; c.font = "bold 17px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("SMOOTHIES", 160, 113);
});
sprite("surf", 150, 240, 560, false, c => {
  for (const [x, col, rot] of [[42, "#ff5a5a", -0.12], [75, "#3fb6f0", 0], [108, "#ffcf3f", 0.12]]) {
    oval(c, x, 125, 22, 104, rot); paint(c, col, "#333", 3);
    oval(c, x, 125, 5, 96, rot); paint(c, "#fff");
  }
  oval(c, 75, 232, 72, 12); paint(c, "#e8c872");
});
sprite("castle", 200, 170, 720, false, c => {
  const sand = "#efcf86", edge = "#b8944a";
  const tower = (x, y, w, h) => {
    rr(c, x, y, w, h, 4); paint(c, sand, edge, 3);
    for (let j = 0; j < 3; j++) { c.fillStyle = sand; c.fillRect(x + 2 + j * 15, y - 10, 10, 12); c.strokeStyle = edge; c.lineWidth = 2; c.strokeRect(x + 2 + j * 15, y - 10, 10, 12); }
  };
  tower(78, 32, 44, 138);
  rr(c, 40, 96, 120, 74, 4); paint(c, sand, edge, 3);
  tower(18, 62, 44, 108); tower(138, 62, 44, 108);
  c.beginPath(); c.moveTo(86, 170); c.lineTo(86, 142); c.arc(100, 142, 14, Math.PI, 0); c.lineTo(114, 170); paint(c, "#8a6a3a");
  c.beginPath(); c.moveTo(100, 22); c.lineTo(100, 2); paint(c, null, "#6e4220", 3);
  c.beginPath(); c.moveTo(100, 2); c.lineTo(122, 8); c.lineTo(100, 14); c.closePath(); paint(c, "#ff4a5a");
});
sprite("lifeguard", 200, 300, 900, true, c => {
  c.lineCap = "round";
  for (const [x1, x2] of [[45, 70], [155, 130]]) { c.beginPath(); c.moveTo(x1, 298); c.lineTo(x2, 160); paint(c, null, "#fff", 10); }
  c.beginPath(); c.moveTo(55, 250); c.lineTo(145, 210); c.moveTo(145, 250); c.lineTo(55, 210); paint(c, null, "#ddd", 6);
  rr(c, 40, 150, 120, 16, 4); paint(c, "#fff", "#999", 2);
  rr(c, 55, 70, 90, 82, 6); paint(c, "#ff4a4a", "#a82a2a", 4);
  rr(c, 70, 84, 60, 30, 4); paint(c, "#7ad0ff", "#a82a2a", 3);
  c.beginPath(); c.moveTo(42, 74); c.lineTo(100, 28); c.lineTo(158, 74); c.closePath(); paint(c, "#fff", "#a82a2a", 4);
  circle(c, 100, 132, 13); paint(c, null, "#ff8a2a", 8);
});
sprite("jtree", 340, 420, 2000, true, c => {
  c.beginPath(); c.moveTo(138, 420); c.lineTo(155, 200); c.lineTo(185, 200); c.lineTo(202, 420); c.closePath(); paint(c, "#6e4a2a", "#3a2410", 4);
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(170 + s * 25, 380); c.lineTo(170 + s * 60, 420); c.lineTo(170 + s * 20, 420); c.closePath(); paint(c, "#6e4a2a", "#3a2410", 3); }
  for (const [x, y, r, col] of [[170, 160, 105, "#25742f"], [80, 185, 70, "#25742f"], [260, 185, 70, "#25742f"], [170, 115, 85, "#3a9a44"],
    [105, 145, 60, "#3a9a44"], [235, 145, 60, "#3a9a44"], [155, 90, 50, "#56c25a"], [215, 110, 30, "#56c25a"]]) { circle(c, x, y, r); paint(c, col); }
  c.lineCap = "round";
  for (const [x, len] of [[90, 120], [250, 140], [200, 90], [130, 70]]) {
    c.beginPath(); c.moveTo(x, 220); c.quadraticCurveTo(x + 10, 220 + len / 2, x - 4, 220 + len); paint(c, null, "#2f8a3a", 4);
    for (let y = 235; y < 220 + len; y += 22) { oval(c, x + 4, y, 7, 4, 0.5); paint(c, "#56c25a"); }
  }
});
sprite("fern", 220, 140, 900, false, c => {
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + 0.25 + i * (Math.PI - 0.5) / 8;
    c.save(); c.translate(110, 138); c.rotate(a);
    oval(c, 60, 0, 62, 13); paint(c, i % 2 ? "#3fae4a" : "#4cc257", "#237a2f", 2);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(118, 0); paint(c, null, "#237a2f", 2);
    c.restore();
  }
});
sprite("tiki", 130, 260, 560, true, c => {
  const cols = ["#ff5a5a", "#ffcf3f", "#2fbf71"];
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(18 + i * 20, 62); c.lineTo(28 + i * 20, 8 + (i % 2) * 18); c.lineTo(38 + i * 20, 62); c.closePath(); paint(c, cols[i % 3], "#5a3a1a", 2); }
  rr(c, 20, 50, 90, 208, 14); paint(c, "#a8743a", "#5a3a1a", 4);
  for (const x of [32, 72]) { rr(c, x, 80, 26, 18, 4); paint(c, "#5a3a1a"); circle(c, x + 13, 89, 4); paint(c, "#fff"); }
  rr(c, 57, 100, 16, 40, 6); paint(c, "#8a5a2a", "#5a3a1a", 3);
  rr(c, 35, 150, 60, 34, 8); paint(c, "#5a3a1a");
  c.fillStyle = "#fff"; for (let i = 0; i < 5; i++) c.fillRect(40 + i * 10.5, 152, 8, 9);
  for (const y of [205, 228]) { c.beginPath(); c.moveTo(28, y); c.lineTo(102, y); paint(c, null, "#5a3a1a", 4); }
});
sprite("rock", 230, 150, 1000, true, c => {
  c.beginPath(); c.moveTo(10, 148); c.lineTo(25, 70); c.lineTo(80, 22); c.lineTo(150, 18); c.lineTo(205, 60); c.lineTo(225, 148); c.closePath();
  paint(c, "#8a8f9a", "#4a4f5a", 4);
  c.beginPath(); c.moveTo(45, 80); c.lineTo(85, 36); c.lineTo(140, 32); c.lineTo(110, 70); c.closePath(); paint(c, "#b0b5c0");
  c.beginPath(); c.moveTo(70, 34); c.quadraticCurveTo(115, 10, 175, 36); c.quadraticCurveTo(140, 44, 120, 34); c.quadraticCurveTo(95, 46, 70, 34); paint(c, "#5fae4a");
});
sprite("flowers", 170, 120, 700, false, c => {
  for (const [x, y, r] of [[50, 80, 40], [120, 80, 40], [85, 60, 45]]) { circle(c, x, y, r); paint(c, "#2f8a3a"); }
  c.fillRect(10, 100, 150, 20);
  const cols = ["#ff5aa0", "#ffcf3f", "#ff5a5a", "#fff"];
  for (const [i, [x, y]] of [[40, 50], [90, 30], [130, 60], [70, 80], [115, 95], [30, 95], [150, 90]].entries()) {
    for (let p = 0; p < 5; p++) { const a = p * Math.PI * 0.4; circle(c, x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6); paint(c, cols[i % 4]); }
    circle(c, x, y, 4); paint(c, "#ff8a2a");
  }
});
sprite("ship", 460, 400, 4200, false, c => {
  c.lineCap = "round";
  for (const [x, top] of [[170, 30], [300, 70]]) { c.beginPath(); c.moveTo(x, top); c.lineTo(x, 300); paint(c, null, "#5a3010", 10); }
  const sail = (mx, y0, y1, w) => {
    c.beginPath(); c.moveTo(mx - w, y0); c.quadraticCurveTo(mx, y0 + 20, mx + w, y0); c.lineTo(mx + w + 5, y1);
    c.quadraticCurveTo(mx, y1 + 30, mx - w - 5, y1); c.closePath(); paint(c, "#f2e6c8", "#8a7a5a", 3);
  };
  sail(170, 60, 125, 70); sail(170, 145, 225, 85); sail(300, 90, 150, 60); sail(300, 168, 235, 75);
  circle(c, 170, 180, 18); paint(c, "#2a1a10"); circle(c, 163, 177, 5); paint(c, "#f2e6c8"); circle(c, 177, 177, 5); paint(c, "#f2e6c8");
  c.beginPath(); c.moveTo(170, 30); c.lineTo(222, 36); c.lineTo(170, 56); c.closePath(); paint(c, "#1a1a1a");
  rr(c, 330, 228, 110, 52, 6); paint(c, "#7a4420", "#3a1a08", 4);
  c.beginPath(); c.moveTo(20, 280); c.lineTo(445, 270); c.lineTo(400, 372); c.lineTo(70, 372); c.closePath(); paint(c, "#6b3a1a", "#3a1a08", 5);
  c.fillStyle = "#e8b84a"; c.fillRect(38, 300, 385, 9);
  for (let x = 100; x < 380; x += 55) { circle(c, x, 335, 10); paint(c, "#2a1a10", "#e8b84a", 3); }
  c.beginPath(); c.moveTo(0, 366);
  for (let x = 0; x <= 460; x += 10) c.lineTo(x, 366 + Math.sin(x / 18) * 6);
  c.lineTo(460, 400); c.lineTo(0, 400); c.closePath(); paint(c, "#2fb0c4");
});
sprite("barrel", 110, 132, 450, true, c => {
  c.beginPath(); c.moveTo(18, 12); c.quadraticCurveTo(0, 68, 18, 126); c.lineTo(92, 126); c.quadraticCurveTo(110, 68, 92, 12); c.closePath();
  paint(c, "#a8622a", "#5a3010", 4);
  for (const y of [34, 102]) { c.beginPath(); c.moveTo(8, y); c.lineTo(102, y); paint(c, null, "#4a4a55", 7); }
  oval(c, 55, 12, 37, 9); paint(c, "#c8823a", "#5a3010", 3);
});
sprite("chest", 160, 130, 620, true, c => {
  rr(c, 15, 8, 130, 44, 12); paint(c, "#9a5a2a", "#4a2408", 4);
  oval(c, 80, 62, 60, 22); paint(c, "#ffcf3f", "#b8860b", 3);
  for (const [x, y] of [[50, 52], [80, 46], [108, 54], [66, 60], [96, 62]]) { circle(c, x, y, 8); paint(c, "#ffe36b", "#b8860b", 2); }
  rr(c, 15, 62, 130, 64, 6); paint(c, "#8a4a1a", "#4a2408", 4);
  c.fillStyle = "#ffcf3f"; c.fillRect(34, 62, 10, 64); c.fillRect(116, 62, 10, 64);
  rr(c, 70, 72, 20, 22, 4); paint(c, "#ffcf3f", "#b8860b", 2);
});
sprite("skull", 330, 280, 1600, true, c => {
  c.beginPath(); c.moveTo(10, 278); c.lineTo(30, 120); c.quadraticCurveTo(60, 18, 165, 14); c.quadraticCurveTo(270, 18, 300, 120); c.lineTo(320, 278); c.closePath();
  paint(c, "#a8a6b8", "#4a4858", 5);
  for (const x of [115, 215]) { oval(c, x, 120, 32, 38); paint(c, "#2a2838"); }
  c.beginPath(); c.moveTo(165, 150); c.lineTo(150, 186); c.lineTo(180, 186); c.closePath(); paint(c, "#2a2838");
  rr(c, 100, 198, 130, 42, 8); paint(c, "#2a2838");
  for (let i = 0; i < 6; i++) { rr(c, 106 + i * 20, 200, 16, 24, 3); paint(c, "#ece8f4", "#4a4858", 2); }
});
sprite("torch", 70, 240, 280, false, c => {
  rr(c, 29, 70, 12, 170, 4); paint(c, "#6e4220", "#3a2410", 2);
  c.beginPath(); c.moveTo(14, 60); c.lineTo(56, 60); c.lineTo(46, 86); c.lineTo(24, 86); c.closePath(); paint(c, "#666", "#222", 3);
  c.beginPath(); c.moveTo(35, 4); c.quadraticCurveTo(64, 40, 52, 60); c.lineTo(18, 60); c.quadraticCurveTo(6, 40, 35, 4); paint(c, "#ff7a1a");
  c.beginPath(); c.moveTo(35, 24); c.quadraticCurveTo(52, 48, 44, 60); c.lineTo(26, 60); c.quadraticCurveTo(18, 48, 35, 24); paint(c, "#ffd23f");
});
sprite("flag", 140, 240, 560, false, c => {
  c.beginPath(); c.moveTo(16, 10); c.lineTo(16, 240); paint(c, null, "#6e4220", 8);
  c.beginPath(); c.moveTo(20, 14); c.quadraticCurveTo(75, 0, 135, 20); c.lineTo(135, 92); c.quadraticCurveTo(75, 72, 20, 88); c.closePath(); paint(c, "#1a1a1a");
  circle(c, 76, 44, 16); paint(c, "#fff"); rr(c, 66, 52, 20, 12, 3); paint(c, "#fff");
  for (const x of [70, 82]) { circle(c, x, 42, 4); paint(c, "#1a1a1a"); }
  c.beginPath(); c.moveTo(52, 62); c.lineTo(100, 80); c.moveTo(100, 62); c.lineTo(52, 80); paint(c, null, "#fff", 5);
});
sprite("cannon", 180, 130, 680, true, c => {
  c.save(); c.translate(90, 70); c.rotate(-0.25); rr(c, -70, -22, 140, 44, 20); paint(c, "#2a2a33", "#111", 4); circle(c, 70, 0, 14); paint(c, "#111"); c.restore();
  for (const x of [55, 120]) {
    circle(c, x, 102, 26); paint(c, "#8a5a2a", "#4a2408", 4);
    for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(x, 102); c.lineTo(x + Math.cos(a) * 24, 102 + Math.sin(a) * 24); paint(c, null, "#4a2408", 3); }
  }
});
for (const [name, dir] of [["signR", 1], ["signL", -1]]) sprite(name, 170, 160, 560, false, c => {
  for (const x of [40, 130]) { c.beginPath(); c.moveTo(x, 70); c.lineTo(x, 160); paint(c, null, "#555", 8); }
  rr(c, 8, 12, 154, 72, 10); paint(c, "#ffcf3f", "#333", 5);
  c.save(); c.translate(85, 48); c.scale(dir, 1);
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 40 - 14, -24); c.lineTo(i * 40 + 12, 0); c.lineTo(i * 40 - 14, 24); paint(c, null, "#1a1a22", 11); }
  c.restore();
});
sprite("gate", 900, 360, 4400, false, c => {
  for (const x of [18, 842]) {
    rr(c, x, 60, 40, 300, 6); paint(c, "#fff", "#333", 4);
    c.fillStyle = "#ff4a5a";
    for (let y = 80; y < 350; y += 50) c.fillRect(x + 3, y, 34, 22);
  }
  rr(c, 4, 18, 892, 96, 16); paint(c, "#163a6b", "#ffcf3f", 6);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    c.fillStyle = (i + j) % 2 ? "#fff" : "#1a1a22";
    c.fillRect(24 + i * 14, 38 + j * 28, 14, 28); c.fillRect(820 + i * 14, 38 + j * 28, 14, 28);
  }
  c.font = "bold 58px Impact, 'Arial Black', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.lineWidth = 8; c.strokeStyle = "#0b1d3a"; c.strokeText("SPEEDWAY 5 BILLION", 450, 68);
  c.fillStyle = "#ffcf3f"; c.fillText("SPEEDWAY 5 BILLION", 450, 68);
});
sprite("box", 110, 110, 440, false, c => {
  const g = c.createLinearGradient(0, 0, 110, 110);
  ["#ff5a5a", "#ffcf3f", "#5fd36a", "#4aa8ff", "#c46aff"].forEach((col, i) => g.addColorStop(i / 4, col));
  c.globalAlpha = 0.92;
  rr(c, 8, 8, 94, 94, 18); paint(c, g, "#fff", 6);
  c.globalAlpha = 1;
  oval(c, 34, 30, 16, 8, -0.6); paint(c, "rgba(255,255,255,0.6)");
  c.font = "bold 62px Impact, 'Arial Black', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.lineWidth = 6; c.strokeStyle = "#5a2a6a"; c.strokeText("?", 55, 58); c.fillStyle = "#fff"; c.fillText("?", 55, 58);
});
sprite("slime", 200, 80, 620, false, c => {
  c.beginPath(); c.moveTo(10, 62);
  c.bezierCurveTo(0, 30, 50, 14, 100, 18); c.bezierCurveTo(160, 14, 205, 34, 190, 62); c.quadraticCurveTo(100, 82, 10, 62);
  paint(c, "#7ae05a", "#2f8a2a", 4);
  oval(c, 60, 32, 20, 7, -0.2); paint(c, "#c8ffb0");
  for (const [x, r] of [[150, 7], [40, 5], [125, 4]]) { circle(c, x, 50, r); paint(c, "#b8f5a0"); }
  eye(c, 86, 36, 12, "#2f8a2a"); eye(c, 116, 34, 12, "#2f8a2a");
});
sprite("ball", 100, 100, 330, false, c => {
  circle(c, 50, 50, 44); paint(c, "#ff3a4a", "#8a1020", 4);
  c.beginPath(); c.arc(50, 50, 44, -0.4, 0.9); c.arc(50, 50, 26, 0.9, -0.4, true); c.closePath(); paint(c, "#fff");
  oval(c, 34, 32, 12, 7, -0.6); paint(c, "rgba(255,255,255,0.75)");
});

// small item pictures for the item slot
const ICONS = {
  rocket: makeCanvas(80, 80, c => {
    c.translate(40, 40); c.rotate(Math.PI / 4);
    c.beginPath(); c.moveTo(-8, 22); c.quadraticCurveTo(0, 42, 8, 22); paint(c, "#ff8a2a");
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 10, 8); c.lineTo(s * 22, 26); c.lineTo(s * 10, 22); c.closePath(); paint(c, "#ff4a5a", "#7a1020", 2); }
    c.beginPath(); c.moveTo(0, -32); c.quadraticCurveTo(14, -16, 12, 24); c.lineTo(-12, 24); c.quadraticCurveTo(-14, -16, 0, -32); paint(c, "#eef2ff", "#3a3f5a", 3);
    c.beginPath(); c.moveTo(0, -32); c.quadraticCurveTo(9, -22, 10, -14); c.lineTo(-10, -14); c.quadraticCurveTo(-9, -22, 0, -32); paint(c, "#ff4a5a");
    circle(c, 0, 0, 6); paint(c, "#4aa8ff", "#3a3f5a", 2);
  }),
  slime: makeCanvas(80, 80, c => c.drawImage(SPRITES.slime.img, 0, 20, 80, 32)),
  ball: makeCanvas(80, 80, c => c.drawImage(SPRITES.ball.img, 10, 10, 60, 60)),
  shield: makeCanvas(80, 80, c => {
    const g = c.createRadialGradient(30, 28, 4, 40, 40, 34);
    g.addColorStop(0, "rgba(220,245,255,0.9)"); g.addColorStop(1, "rgba(90,180,255,0.6)");
    circle(c, 40, 40, 32); paint(c, g, "#bfe8ff", 4);
    star(c, 40, 42, 14); paint(c, "#ffcf3f", "#b8860b", 2);
  }),
};
const FACES = MONSTERS.map(m => makeCanvas(120, 120, c => { c.translate(60, 66); c.scale(46, 46); drawMonster(c, m, true); }));
const KARTS = MONSTERS.map(m => [0, -1, 1].map(p => makeCanvas(KART_IMG_W, KART_IMG_H, c => drawKartBack(c, m, p))));

// ---------- 5. the three tracks ----------
// Each piece of track is [how long, how much it curves (+ is right), how much it goes up (- is down)]
const TRACKS = [
  { key: "beach", name: "Coconut Beach", about: "Sunny and smooth. A great first race!", seed: 11,
    pieces: [[40, 0, 0], [100, 2, 0], [60, 0, 10], [100, -3, 0], [40, 0, -10], [120, 3, 15], [60, 0, 0], [80, -2, -15],
      [60, 0, 0], [100, 4, 0], [60, 0, 10], [100, -3, -10], [40, 0, 0], [80, 2, 0]] },
  { key: "jungle", name: "Jungle Jumble", about: "Big bumpy hills and twisty turns.", seed: 23,
    pieces: [[40, 0, 0], [80, -3, 25], [60, 0, -25], [100, 4, 0], [50, -4, 0], [60, 0, 30], [80, 0, -30], [100, -5, 0],
      [60, 3, 15], [60, -3, -15], [80, 0, 25], [80, 4, -25], [60, 0, 0], [100, -4, 0], [60, 2, 0]] },
  { key: "pirate", name: "Pirate Cove", about: "Wooden boardwalks over the sea, and sharp corners!", seed: 37,
    pieces: [[40, 0, 0], [80, 5, 0], [40, 0, 0], [80, -5, 0], [60, 0, 20], [60, 0, -20], [120, 3, 0], [40, -5, 0],
      [40, 5, 0], [60, 0, 15], [100, -4, -15], [60, 0, 0], [80, 5, 10], [60, -2, -10], [40, 0, 0], [80, -3, 0]] },
];

// colours and scenery for each track. deco = [sprite, how often]
const THEMES = {
  beach: {
    sky: ["#2f9be8", "#c9f0ff"], fog: "#d6f2ff", grass: ["#f4dc95", "#ecd085"], rumble: ["#ff5a5a", "#ffffff"],
    road: ["#8d93a3", "#878d9d"], lane: "#ffffff", density: 0.75,
    deco: [["palm", 8], ["umbrella", 3], ["surf", 2], ["castle", 2], ["hut", 1], ["lifeguard", 1]], far: [["hut", 1], ["palm", 2]],
    music: { root: 62, scale: [0, 2, 4, 7, 9], step: 0.12, seed: 4, chords: [0, 9, 5, 7], lead: "square" },
  },
  jungle: {
    sky: ["#2f9a9a", "#d8f5c0"], fog: "#cdeccd", grass: ["#3f9a3a", "#368a33"], rumble: ["#ffd23f", "#2a6a2a"],
    road: ["#a27a4f", "#9a724a"], lane: "#d9b98a", density: 0.9,
    deco: [["jtree", 6], ["fern", 4], ["tiki", 1], ["rock", 2], ["flowers", 3]], far: [["jtree", 3]],
    music: { root: 59, scale: [0, 3, 5, 7, 10], step: 0.12, seed: 15, chords: [0, 10, 8, 7], lead: "triangle" },
  },
  pirate: {
    sky: ["#3b1f5e", "#ff9a5a"], fog: "#f2a07a", grass: ["#2a9ab0", "#2590a6"], rumble: ["#4a2a10", "#e8d0a0"],
    road: ["#9a6a3a", "#8a5c30"], planks: true, density: 0.45,
    deco: [["barrel", 3], ["chest", 1], ["cannon", 2], ["flag", 2], ["skull", 1]], far: [["ship", 1]], posts: "torch",
    music: { root: 57, scale: [0, 2, 3, 7, 8], step: 0.13, seed: 31, chords: [0, 8, 5, 7], lead: "sawtooth" },
  },
};

function buildTrack(def) {
  const segs = [];
  const lastY = () => (segs.length ? segs[segs.length - 1].p2.wy : 0);
  function add(curve, y) {
    const i = segs.length;
    segs.push({ i, curve, p1: { wy: lastY(), wz: i * SEG_LEN }, p2: { wy: y, wz: (i + 1) * SEG_LEN },
      sprites: [], cars: [], things: [], clip: 0, cx1: 0, cx2: 0 });
  }
  // a piece eases into its curve, holds it, then eases out again, while smoothly going up or down
  function piece(len, curve, hill) {
    const enter = Math.floor(len / 4), hold = Math.floor(len / 2), leave = len - enter - hold;
    const y0 = lastY(), y1 = y0 + hill * SEG_LEN;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, (n + 1) / len));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n + 1) / len));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n + 1) / len));
  }
  for (const p of def.pieces) piece(...p);
  piece(40, 0, -lastY() / SEG_LEN);   // get back to the same height as the start line

  const theme = THEMES[def.key], N = segs.length, rng = makeRng(def.seed);
  const put = (i, name, offset) => segs[i % N].sprites.push({ name, offset, w: SPRITES[name].w, solid: SPRITES[name].solid });
  const pick = list => {
    let total = 0;
    for (const [, w] of list) total += w;
    let r = rng() * total;
    for (const [name, w] of list) { r -= w; if (r < 0) return name; }
    return list[0][0];
  };
  put(0, "gate", 0);
  for (let i = 12; i < N - 3; i += 3) {
    for (const side of [-1, 1]) {
      if (rng() > theme.density) continue;
      const name = pick(theme.deco);
      put(i, name, side * (1.25 + SPRITES[name].w / ROAD_W / 2 + rng() * 1.4));
    }
  }
  for (let i = 20; i < N; i += 14 + Math.floor(rng() * 10)) {
    const name = pick(theme.far);
    put(i, name, (rng() < 0.5 ? -1 : 1) * (4 + rng() * 2.5));
  }
  if (theme.posts) for (let i = 8; i < N; i += 10) { put(i, theme.posts, -1.18); put(i, theme.posts, 1.18); }
  // arrow signs on the outside of the sharp corners
  for (let i = 0; i < N; i += 8) {
    const cv = segs[i].curve;
    if (Math.abs(cv) >= 3) put(i, cv > 0 ? "signR" : "signL", -Math.sign(cv) * 1.5);
  }
  // three rows of item boxes
  const boxes = [];
  for (const f of [0.17, 0.45, 0.72]) {
    const z = Math.floor(N * f) * SEG_LEN + SEG_LEN / 2;
    for (const x of [-0.6, -0.2, 0.2, 0.6]) boxes.push({ kind: "box", z, x, t: 0 });
  }
  return { def, theme, segs, N, length: N * SEG_LEN, boxes };
}

// ---------- 6. saving: best times and cup trophies ----------
let save = loadSave();
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.best === "object") return { best: s.best, cups: s.cups || {}, speed: s.speed ?? 1 };
  } catch (e) { /* no save yet */ }
  return { best: {}, cups: {}, speed: 1 };
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* the game still works without saving */ }
}

// ---------- 7. the game's state ----------
const game = {
  state: "menu",     // menu (the demo race behind the title), count, race, done, pause, results
  demo: true,
  players: 1,
  picks: [0, 1],     // which monster each player picked
  speed: clamp(save.speed, 0, 2),
  trackIdx: 0,
  cup: null,         // { race, pts } while you're playing the Monster Cup
  count: 4, time: 0, goT: 0, doneT: 0,
};
let track = null, racers = [], things = [], clock = 0, lastResults = [];

function makeRacer(mon, human, slot) {
  const m = MONSTERS[mon], sp = SPEEDS[game.demo ? 1 : game.speed];
  const top = BASE_TOP * (0.92 + m.speed * 0.04) * sp.top;
  const row = Math.floor(slot / 2);
  return {
    mon, human, top, accel: top * (0.24 + m.accel * 0.07), handling: 1.6 + m.turn * 0.18,
    z: track.length - 300 - row * 700, x: slot % 2 ? 0.45 : -0.45, lap: 0, speed: 0, pose: 0,
    drift: 0, charge: 0, driftHeld: false, hop: 0, boost: 0, boostPow: 1, boostKind: "",
    spin: 0, spinAng: 0, shield: 0, item: null, roulette: 0, itemHeld: false, bonk: 0,
    finished: false, finishTime: 0, place: slot + 1, lapStart: 0, bestLap: 0, bg: 0, msg: "", msgT: 0,
    ai: { lane: 0, laneT: 0, useT: 0, skill: 0.97 + Math.random() * 0.06 },
  };
}
function startDemo() {
  game.demo = true;
  game.state = "menu";
  game.cup = null;
  track = buildTrack(TRACKS[Math.floor(Math.random() * TRACKS.length)]);
  racers = shuffle(MONSTERS.map((m, i) => i)).map((mon, k) => makeRacer(mon, 0, k));
  for (const r of racers) r.speed = r.top * 0.6;
  things = [];
  game.time = 0;
  game.goT = 0;
  setMusic(null);
}
function startRace(trackIdx) {
  game.demo = false;
  game.trackIdx = trackIdx;
  track = buildTrack(TRACKS[trackIdx]);
  const humans = game.picks.slice(0, game.players);
  const others = shuffle(MONSTERS.map((m, i) => i).filter(i => !humans.includes(i)));
  racers = [];
  others.forEach((mon, k) => racers.push(makeRacer(mon, 0, k)));
  humans.forEach((mon, k) => racers.push(makeRacer(mon, k + 1, others.length + k)));
  things = [];
  game.state = "count";
  game.count = 4;
  game.time = 0;
  game.goT = 0;
  game.doneT = 0;
  stopMusic();
  showScreen(null);
  $("touch").classList.toggle("hidden", !(touchy && game.players === 1));
  startEngines();
}
const humansOf = () => racers.filter(r => r.human).sort((a, b) => a.human - b.human);
const seen = r => r.human && !game.demo;   // only make sounds and messages for the players' karts
function say(r, text, t = 1.6) { r.msg = text; r.msgT = t; }

// ---------- 8. moving the karts ----------
const segAt = z => track.segs[Math.floor(wrap(z, track.length) / SEG_LEN) % track.N];
function wrapDz(a, b) {   // how far a is in front of b, going the short way round the lap
  const L = track.length;
  let d = a - b;
  if (d > L / 2) d -= L;
  if (d < -L / 2) d += L;
  return d;
}
const NO_INPUT = { left: false, right: false, brake: false, drift: false, item: false };

function update(dt) {
  if (game.state === "count") {
    const before = Math.ceil(game.count);
    game.count -= dt;
    if (Math.ceil(game.count) !== before) {
      if (game.count > 0) sfx.beep();
      else { sfx.go(); game.state = "race"; game.goT = 1; setMusic(track.def.key); }
    }
    return;
  }
  if (!game.demo) game.time += dt;
  game.goT -= dt;
  for (const r of racers) updateRacer(r, dt);
  bumpRacers();
  updateBoxes(dt);
  updateThings(dt);
  updatePlaces();
  if (game.state === "race" && racers.every(r => !r.human || r.finished)) { game.state = "done"; game.doneT = 3; }
  if (game.state === "done") { game.doneT -= dt; if (game.doneT <= 0) showResults(); }
}

function updateRacer(r, dt) {
  const L = track.length, seg = segAt(r.z);
  const pct = r.speed / r.top;
  const driver = r.human && !r.finished && !game.demo;
  let ctl = driver ? pads[game.players === 1 ? 0 : r.human - 1] : aiControl(r, dt);
  r.boost = Math.max(0, r.boost - dt);
  r.shield = Math.max(0, r.shield - dt);
  r.bonk = Math.max(0, r.bonk - dt);
  r.hop = Math.max(0, r.hop - dt);
  r.msgT -= dt;
  if (r.spin > 0) { r.spin -= dt; r.spinAng += dt * 16; ctl = NO_INPUT; }

  // speed: karts drive forward by themselves
  const sand = Math.abs(r.x) > 1.05;
  let top = r.top;
  if (!driver) top *= aiTop(r);
  let max = top * (r.boost > 0 ? r.boostPow : 1);
  if (sand && !(r.boost > 0 && r.boostKind === "rocket")) max = Math.min(max, top * SAND_TOP);
  if (ctl.brake) r.speed -= top * 1.4 * dt;
  else if (r.spin > 0) r.speed -= r.speed * 1.5 * dt;
  else if (r.speed < max) r.speed = Math.min(max, r.speed + (r.boost > 0 ? r.top * 2 : r.accel * (1 - 0.55 * r.speed / r.top)) * dt);
  if (r.speed > max) r.speed = Math.max(max, r.speed - top * (sand ? 1.6 : 0.5) * dt);
  r.speed = Math.max(0, r.speed);

  // steering (computer karts can steer a little bit, not just all the way)
  const steer = ctl.steer ?? ((ctl.right ? 1 : 0) - (ctl.left ? 1 : 0));
  const dir = Math.sign(steer);
  // drifting: hold drift while turning and you slide round the corner, building up sparks
  if (ctl.drift && !r.driftHeld && dir && !r.drift && pct > 0.4 && r.spin <= 0) {
    r.drift = dir;
    r.charge = 0;
    r.hop = 0.2;
    if (seen(r)) sfx.hop();
  }
  r.driftHeld = !!ctl.drift;
  if (r.drift) {
    if (!ctl.drift || pct < 0.3 || r.spin > 0) {
      if (r.spin <= 0 && r.charge >= DRIFT_ORANGE) giveBoost(r, 1.1, 1.3, "orange");
      else if (r.spin <= 0 && r.charge >= DRIFT_BLUE) giveBoost(r, 0.55, 1.25, "blue");
      r.drift = 0;
      r.charge = 0;
    } else {
      const before = r.charge;
      r.charge += dt * (dir === r.drift ? 1.25 : 0.8);
      if (seen(r) && before < DRIFT_BLUE && r.charge >= DRIFT_BLUE) sfx.spark(0);
      if (seen(r) && before < DRIFT_ORANGE && r.charge >= DRIFT_ORANGE) sfx.spark(1);
    }
  }
  const side = r.drift ? r.drift * (0.55 + 0.5 * steer * r.drift) : steer;
  r.x += side * r.handling * dt * Math.min(1, pct * 1.6);
  const grip = driver ? 1 : 0.6;
  r.x -= seg.curve * pct * pct * CENTRIFUGAL * dt * (r.drift ? 0.55 : 1) * grip;
  r.x = clamp(r.x, -2.6, 2.6);
  r.pose += ((r.drift || steer) - r.pose) * Math.min(1, dt * 10);
  r.bg += seg.curve * r.speed / SEG_LEN * 0.0015 * dt;

  // items: the roulette spins, then you can use what you got
  if (r.roulette > 0) {
    r.roulette -= dt;
    if (r.roulette <= 0) { r.item = pickItem(r); r.ai.useT = 1 + Math.random() * 3; if (seen(r)) sfx.got(); }
  }
  if (ctl.item && !r.itemHeld && r.item && r.spin <= 0) useItem(r);
  r.itemHeld = !!ctl.item;

  hitScenery(r);
  r.z += r.speed * dt;
  if (r.z >= L) { r.z -= L; crossLine(r); }
}

function giveBoost(r, time, pow, kind) {
  if (r.boost > 0 && r.boostKind === "rocket") return;
  r.boost = time;
  r.boostPow = pow;
  r.boostKind = kind;
  if (seen(r)) sfx.boost();
}

function crossLine(r) {
  r.lap++;
  if (game.demo) return;
  if (r.lap >= 2) {
    const t = game.time - r.lapStart;
    if (!r.bestLap || t < r.bestLap) r.bestLap = t;
  }
  r.lapStart = game.time;
  if (r.lap > LAPS && !r.finished) {
    r.finished = true;
    r.finishTime = game.time;
    const place = racers.filter(o => o.finished).length;
    if (seen(r)) { say(r, place === 1 ? "YOU WIN!" : `FINISHED ${ordinal(place)}!`, 99); if (place === 1) sfx.win(); else sfx.finish(); }
  } else if (seen(r) && r.lap === LAPS) { say(r, "FINAL LAP!", 2); sfx.final(); }
  else if (seen(r) && r.lap > 1) { say(r, `LAP ${r.lap}`, 1.5); sfx.lap(); }
}

function updatePlaces() {
  const L = track.length;
  const order = racers.slice().sort((a, b) => (b.finished - a.finished) ||
    (a.finished ? a.finishTime - b.finishTime : (b.lap * L + b.z) - (a.lap * L + a.z)));
  order.forEach((r, i) => { r.place = i + 1; });
}

// karts that touch get pushed apart, and the one behind loses a little speed
function bumpRacers() {
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j];
    const dz = wrapDz(a.z, b.z);
    if (Math.abs(dz) > 220) continue;
    const dx = a.x - b.x, overlap = KART_HALF * 1.8 - Math.abs(dx);
    if (overlap <= 0) continue;
    const dir = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
    a.x += dir * overlap * 0.5;
    b.x -= dir * overlap * 0.5;
    const back = dz < 0 ? a : b;
    back.speed *= 0.92;
    if ((seen(a) || seen(b)) && a.bonk <= 0 && b.bonk <= 0) sfx.bump();
    a.bonk = b.bonk = Math.max(a.bonk, b.bonk, 0.25);
  }
}

// crash into palm trees, huts and rocks at the side of the road
function hitScenery(r) {
  if (r.bonk > 0 || Math.abs(r.x) < 1) return;
  for (const s of segAt(r.z).sprites) {
    if (!s.solid || Math.abs(r.x - s.offset) > KART_HALF + s.w / ROAD_W * 0.3) continue;
    r.speed *= 0.3;
    r.bonk = 0.6;
    r.x += r.x > 0 ? -0.15 : 0.15;
    if (seen(r)) { sfx.thud(); say(r, "OOF!", 0.8); }
    return;
  }
}

// ---------- 9. item boxes, slime and bouncy balls ----------
function pickItem(r) {
  // the further back you are, the better your items
  const t = (r.place - 1) / (racers.length - 1);
  const weights = { rocket: 0.4 + 4.5 * t, ball: 2 + 2 * t, slime: 5 - 4 * t, shield: 3 - 2 * t };
  let total = 0;
  for (const k of ITEMS) total += weights[k];
  let x = Math.random() * total;
  for (const k of ITEMS) { x -= weights[k]; if (x < 0) return k; }
  return "slime";
}
function useItem(r) {
  const it = r.item, L = track.length;
  r.item = null;
  if (it === "rocket") { r.boost = ROCKET_TIME; r.boostPow = 1.45; r.boostKind = "rocket"; if (seen(r)) sfx.rocket(); }
  else if (it === "slime") { things.push({ kind: "slime", z: wrap(r.z - 380, L), x: r.x, owner: r, age: 0, life: 45 }); if (seen(r)) sfx.splat(); }
  else if (it === "ball") {
    things.push({ kind: "ball", z: wrap(r.z + 380, L), x: r.x, owner: r, age: 0, life: 5, speed: Math.max(BALL_SPEED, r.speed * 1.5) });
    if (seen(r)) sfx.shoot();
  } else if (it === "shield") { r.shield = SHIELD_TIME; if (seen(r)) sfx.shield(); }
}
function hit(r, kind, by) {
  if (r.shield > 0) {
    r.shield = 0;
    if (seen(r)) { sfx.pop(); say(r, "SHIELD SAVED YOU!", 1.2); }
    return;
  }
  r.spin = SPIN_TIME;
  r.spinAng = 0;
  r.speed *= 0.5;
  r.drift = 0;
  r.charge = 0;
  r.boost = 0;
  if (seen(r)) { sfx.spin(); say(r, kind === "slime" ? "SLIMED!" : "BONK!", 1.2); }
  if (by && by !== r && seen(by)) say(by, `GOT ${MONSTERS[r.mon].name.toUpperCase()}!`, 1.2);
}
function updateBoxes(dt) {
  for (const b of track.boxes) {
    if (b.t > 0) { b.t -= dt; continue; }
    for (const r of racers) {
      if (Math.abs(wrapDz(r.z, b.z)) > 160 || Math.abs(r.x - b.x) > KART_HALF + 0.08) continue;
      b.t = BOX_RESPAWN;
      if (!r.item && r.roulette <= 0) r.roulette = 1.1;
      if (seen(r)) sfx.box();
      break;
    }
  }
}
function updateThings(dt) {
  const L = track.length;
  for (const t of things) {
    t.age += dt;
    t.life -= dt;
    if (t.kind === "ball") {
      t.z = wrap(t.z + t.speed * dt, L);
      // bouncy balls steer towards the nearest kart in front of them
      let best = null, bestDz = 7000;
      for (const r of racers) {
        if (r === t.owner && t.age < 1) continue;
        const dz = wrapDz(r.z, t.z);
        if (dz > 0 && dz < bestDz) { best = r; bestDz = dz; }
      }
      if (best) t.x += clamp(best.x - t.x, -1, 1) * dt * 2.4;
    }
    for (const r of racers) {
      if (r === t.owner && t.age < 0.6) continue;
      if (Math.abs(wrapDz(r.z, t.z)) < (t.kind === "ball" ? 180 : 150) && Math.abs(r.x - t.x) < KART_HALF + 0.1) {
        t.dead = true;
        hit(r, t.kind, t.owner);
        break;
      }
    }
  }
  things = things.filter(t => !t.dead && t.life > 0);
}

// ---------- 10. the computer drivers ----------
function aiTop(r) {
  if (game.demo) return 0.95 * r.ai.skill;
  if (r.human) return 0.88;   // a player who has finished cruises round
  // rubber band: computer karts slow down a bit when far ahead of the players, and speed up when far behind
  const L = track.length;
  let lead = -Infinity;
  for (const h of racers) if (h.human) lead = Math.max(lead, h.lap * L + h.z);
  const gap = (r.lap * L + r.z - lead) / L;
  return SPEEDS[game.speed].ai * r.ai.skill * clamp(1 - gap * 0.35, 0.82, 1.12);
}
function aiControl(r, dt) {
  const ai = r.ai, segs = track.segs, N = track.N, i = Math.floor(r.z / SEG_LEN);
  ai.laneT -= dt;
  if (ai.laneT <= 0) { ai.laneT = 2 + Math.random() * 4; ai.lane = (Math.random() - 0.5) * 0.9; }
  // cut to the inside of the corners coming up
  let ahead = 0;
  for (let k = 4; k < 30; k++) ahead += segs[(i + k) % N].curve;
  let target = clamp(ai.lane + ahead * 0.012, -0.75, 0.75);
  // go for item boxes when empty-handed, and steer round slime
  if (!r.item && r.roulette <= 0) {
    for (const b of track.boxes) {
      const dz = wrapDz(b.z, r.z);
      if (b.t <= 0 && dz > 0 && dz < 3000 && Math.abs(b.x - target) < 0.3) { target = b.x; break; }
    }
  }
  for (const t of things) {
    const dz = wrapDz(t.z, r.z);
    if (t.kind === "slime" && dz > 0 && dz < 2500 && Math.abs(t.x - target) < 0.4) target = t.x + (target > t.x ? 0.45 : -0.45);
  }
  const pct = r.speed / r.top;
  const push = segs[i % N].curve * pct * pct * CENTRIFUGAL * 0.6;
  const steer = clamp(((target - r.x) * 4 + push) / r.handling, -1, 1);
  // use items
  let item = false;
  if (r.item) {
    ai.useT -= dt;
    if (ai.useT <= 0) {
      if (r.item !== "ball") item = true;
      else {
        const targetAhead = racers.some(o => o !== r && wrapDz(o.z, r.z) > 0 && wrapDz(o.z, r.z) < 6000);
        item = targetAhead || ai.useT < -5;
      }
    }
  }
  return { steer, brake: false, drift: false, item, left: false, right: false };
}

// ---------- 11. drawing the road ----------
const canvas = $("view");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
window.addEventListener("resize", resize);
resize();

function viewports() {
  if (game.demo || game.players === 1) {
    const me = game.demo ? racers[0] : humansOf()[0];
    return [{ x: 0, y: 0, w: W, h: H, r: me }];
  }
  const [p1, p2] = humansOf();
  // two players: one above the other on a wide screen, side by side on a tall one
  if (W >= H) {
    const h = Math.floor(H / 2) - 2;
    return [{ x: 0, y: 0, w: W, h, r: p1 }, { x: 0, y: H - h, w: W, h, r: p2 }];
  }
  const w = Math.floor(W / 2) - 2;
  return [{ x: 0, y: 0, w, h: H, r: p1 }, { x: W - w, y: 0, w, h: H, r: p2 }];
}

function project(p, camX, camY, camZ, v) {
  p.tz = p.wz - camZ;
  p.sc = CAM_DEPTH / p.tz;
  p.sx = Math.round(v.w / 2 - p.sc * camX * v.u);
  p.sy = Math.round(v.hz - p.sc * (p.wy - camY) * v.u);
  p.sw = Math.round(p.sc * ROAD_W * v.u);
}
function quad(color, x1, w1, y1, x2, w2, y2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}
function drawSegment(v, seg, n) {
  const t = track.theme, p1 = seg.p1, p2 = seg.p2;
  const stripe = Math.floor(seg.i / 3) % 2;
  ctx.fillStyle = t.grass[stripe];
  ctx.fillRect(0, p2.sy, v.w, p1.sy - p2.sy);
  const r1 = p1.sw / 7, r2 = p2.sw / 7;
  quad(t.rumble[stripe], p1.sx, p1.sw + r1, p1.sy, p2.sx, p2.sw + r2, p2.sy);
  quad(t.planks ? t.road[seg.i % 2] : t.road[stripe], p1.sx, p1.sw, p1.sy, p2.sx, p2.sw, p2.sy);
  if (seg.i < 2) {
    // the chequered start line
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = (k + seg.i) % 2 ? "#fff" : "#1a1a22";
      const a = -1 + k * 0.2, b = a + 0.2;
      ctx.beginPath();
      ctx.moveTo(p1.sx + p1.sw * a, p1.sy); ctx.lineTo(p1.sx + p1.sw * b, p1.sy);
      ctx.lineTo(p2.sx + p2.sw * b, p2.sy); ctx.lineTo(p2.sx + p2.sw * a, p2.sy);
      ctx.fill();
    }
  } else if (t.lane && stripe) {
    quad(t.lane, p1.sx, p1.sw / 40, p1.sy, p2.sx, p2.sw / 40, p2.sy);
  }
  if (n > DRAW_DIST * 0.3) {
    ctx.globalAlpha = Math.min(1, Math.pow((n / DRAW_DIST - 0.3) / 0.7, 1.4));
    ctx.fillStyle = t.fog;
    ctx.fillRect(0, p2.sy, v.w, p1.sy - p2.sy);
    ctx.globalAlpha = 1;
  }
}

function renderView(v) {
  const r = v.r, segs = track.segs, N = track.N, L = track.length;
  v.u = Math.min(v.w / 2, v.h * 0.62);
  v.hz = Math.min(v.h * 0.93 - v.u, v.h * 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ctx.translate(v.x, v.y);

  const camZ = wrap(r.z - PLAYER_Z, L);
  const base = segAt(camZ), basePct = (camZ % SEG_LEN) / SEG_LEN;
  const me = segAt(r.z), mePct = (r.z % SEG_LEN) / SEG_LEN;
  const camY = lerp(me.p1.wy, me.p2.wy, mePct) + CAM_H;
  const camX = r.x * ROAD_W;
  drawBackground(v, r);

  // the road, from near to far. Strips hidden behind a hill are skipped.
  let maxy = v.h, x = 0, dx = -base.curve * basePct;
  for (let n = 0; n < DRAW_DIST; n++) {
    const seg = segs[(base.i + n) % N];
    const loop = seg.i < base.i ? L : 0;
    seg.cx1 = x;
    seg.cx2 = x + dx;
    project(seg.p1, camX - x, camY, camZ - loop, v);
    project(seg.p2, camX - x - dx, camY, camZ - loop, v);
    x += dx;
    dx += seg.curve;
    seg.clip = maxy;
    if (seg.p1.tz <= CAM_DEPTH || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxy) continue;
    drawSegment(v, seg, n);
    maxy = seg.p2.sy;
  }

  // where on the screen something at (z, x) is
  const at = (seg, z, xr) => {
    const pct = (wrap(z, L) % SEG_LEN) / SEG_LEN;
    const tz = seg.p1.tz + pct * SEG_LEN;
    if (tz < 300) return null;
    const sc = CAM_DEPTH / tz;
    return { sc,
      sx: v.w / 2 + sc * (lerp(seg.cx1, seg.cx2, pct) + xr * ROAD_W - camX) * v.u,
      sy: v.hz - sc * (lerp(seg.p1.wy, seg.p2.wy, pct) - camY) * v.u };
  };

  // then everything standing on the road, from far to near so near things cover far ones
  for (let n = DRAW_DIST - 1; n > 0; n--) {
    const seg = segs[(base.i + n) % N];
    ctx.globalAlpha = n > DRAW_DIST * 0.75 ? (DRAW_DIST - n) / (DRAW_DIST * 0.25) : 1;
    for (const s of seg.sprites) {
      const p = at(seg, seg.p1.wz, s.offset);
      if (p) drawImg(SPRITES[s.name].img, s.w, p, seg.clip, v, 0);
    }
    for (const t of seg.things) {
      const p = at(seg, t.z, t.x);
      if (p) drawThing(t, p, seg.clip, v);
    }
    if (seg.cars.length > 1) seg.cars.sort((a, b) => b.z - a.z);
    for (const c of seg.cars) {
      const p = at(seg, c.z, c.x);
      if (p) drawRacer(c, p, seg.clip, v, c === r);
    }
  }
  ctx.globalAlpha = 1;
  if (r.boost > 0 && r.boostKind === "rocket") speedLines(v);
  if (!game.demo) drawHUD(v, r);
  ctx.restore();
}

// draws a picture standing on the ground at p, cutting off any part that's hidden behind a hill
function drawImg(img, worldW, p, clipY, v, lift) {
  const dw = worldW * p.sc * v.u;
  if (dw < 1.5) return null;
  const dh = dw * img.height / img.width;
  const x = p.sx - dw / 2, y = p.sy - dh - lift;
  if (x > v.w || x + dw < 0 || y > v.h) return null;
  const cut = Math.max(0, y + dh - clipY);
  if (cut >= dh) return null;
  ctx.drawImage(img, 0, 0, img.width, img.height * (1 - cut / dh), x, y, dw, dh - cut);
  return { x, y, dw, dh };
}
function shadow(p, w, v) {
  const dw = w * p.sc * v.u;
  oval(ctx, p.sx, p.sy, dw * 0.4, dw * 0.08);
  paint(ctx, "rgba(0,0,0,0.25)");
}
function drawThing(t, p, clipY, v) {
  if (t.kind === "box") {
    if (t.t > 0) return;
    const dw = SPRITES.box.w * p.sc * v.u;
    shadow(p, SPRITES.box.w, v);
    drawImg(SPRITES.box.img, SPRITES.box.w, p, clipY, v, dw * (0.3 + 0.12 * Math.sin(clock * 3 + t.x * 5)));
  } else if (t.kind === "slime") {
    drawImg(SPRITES.slime.img, SPRITES.slime.w, p, clipY, v, 0);
  } else {
    const dw = SPRITES.ball.w * p.sc * v.u;
    shadow(p, SPRITES.ball.w, v);
    drawImg(SPRITES.ball.img, SPRITES.ball.w, p, clipY, v, dw * Math.abs(Math.sin(t.age * 9)) * 1.2);
  }
}

function drawRacer(r, p, clipY, v, self) {
  const pose = r.spin > 0 ? [0, 1, 0, 2][Math.floor(r.spinAng) % 4] : r.pose < -0.35 ? 1 : r.pose > 0.35 ? 2 : 0;
  const img = KARTS[r.mon][pose];
  const ww = KART_W * KART_IMG_W / 220;
  const dw = ww * p.sc * v.u;
  if (dw < 2) return;
  const hop = r.hop > 0 ? Math.sin(r.hop / 0.2 * Math.PI) * dw * 0.12 : 0;
  const shake = Math.abs(r.x) > 1.05 && r.speed > 500 ? Math.abs(Math.sin(clock * 40 + r.mon)) * dw * 0.025 : 0;
  const box = drawImg(img, ww, p, clipY, v, hop + shake);
  if (!box) return;
  const { x, y, dw: bw, dh } = box;
  const cx = x + bw / 2, ground = y + dh;
  const unit = bw / 2.4;   // one kart-drawing unit, in pixels
  // boost flames out of the exhaust pipes
  if (r.boost > 0) {
    const cols = r.boostKind === "rocket" ? ["#ff4a1a", "#ffd23f"] : r.boostKind === "orange" ? ["#ff8a2a", "#ffe36b"] : ["#3a8cff", "#bfe8ff"];
    for (const s of [-1, 1]) {
      const fx = cx + s * 0.42 * unit + r.pose * 0.05 * unit, fy = ground - 0.31 * unit;
      const len = unit * (0.35 + Math.random() * 0.25) * (r.boostKind === "rocket" ? 1.6 : 1);
      oval(ctx, fx, fy + len * 0.5, unit * 0.11, len * 0.6); paint(ctx, cols[0]);
      oval(ctx, fx, fy + len * 0.35, unit * 0.06, len * 0.35); paint(ctx, cols[1]);
    }
  }
  // drift sparks from the back wheels
  if (r.drift && r.charge > DRIFT_BLUE * 0.4) {
    const col = r.charge >= DRIFT_ORANGE ? "#ff9a2a" : r.charge >= DRIFT_BLUE ? "#4ad0ff" : "#ffffff";
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, unit * 0.04);
    ctx.beginPath();
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const sx = cx + s * 0.9 * unit, sy = ground - unit * 0.05;
      const a = -Math.PI / 2 + s * (0.4 + Math.random() * 1.2), l = unit * (0.15 + Math.random() * 0.3);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
    }
    ctx.stroke();
  }
  if (r.shield > 0 && (r.shield > 2 || Math.floor(clock * 8) % 2)) {
    circle(ctx, cx, ground - unit * 0.75, unit * 1.25);
    paint(ctx, "rgba(120,210,255,0.22)", "rgba(190,240,255,0.85)", Math.max(1, unit * 0.06));
    oval(ctx, cx - unit * 0.5, ground - unit * 1.45, unit * 0.3, unit * 0.14, -0.6); paint(ctx, "rgba(255,255,255,0.6)");
  }
  if (r.spin > 0) {
    for (let k = 0; k < 3; k++) {
      const a = clock * 6 + k * Math.PI * 2 / 3;
      star(ctx, cx + Math.cos(a) * unit * 0.6, ground - unit * 1.95 + Math.sin(a) * unit * 0.15, unit * 0.14);
      paint(ctx, "#ffe36b", "#b8860b", Math.max(1, unit * 0.03));
    }
  }
  // name tags over the other player's kart
  if (!game.demo && game.players === 2 && r.human && !self && unit > 6) {
    const tag = "P" + r.human, ty = ground - unit * 2.25, fs = Math.max(11, unit * 0.4);
    ctx.font = `${fs}px "Lilita One", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = fs * 0.2;
    ctx.strokeStyle = "#0b1d3a";
    ctx.strokeText(tag, cx, ty);
    ctx.fillStyle = r.human === 1 ? "#ffcf3f" : "#7fe0ff";
    ctx.fillText(tag, cx, ty);
  }
}

function speedLines(v) {
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const a = Math.random() * Math.PI * 2, r1 = Math.max(v.w, v.h) * (0.38 + Math.random() * 0.1);
    ctx.moveTo(v.w / 2 + Math.cos(a) * r1, v.hz + Math.sin(a) * r1);
    ctx.lineTo(v.w / 2 + Math.cos(a) * r1 * 1.4, v.hz + Math.sin(a) * r1 * 1.4);
  }
  ctx.stroke();
}

// ---------- 12. the sky and far-away scenery ----------
// a bumpy line of hills. bumpy = true makes separate islands instead of a joined-up range.
function ridge(color, baseY, amp, w, shift, f, seed, bumpy) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 2);
  for (let x = 0; x <= w + 8; x += 8) {
    const a = (x + shift) * f;
    const h = bumpy ? Math.max(0, Math.sin(a + seed) * 1.6 - 0.6) : 0.55 + 0.3 * Math.sin(a + seed) + 0.15 * Math.sin(a * 2.7 + seed * 2);
    ctx.lineTo(x, baseY - amp * h);
  }
  ctx.lineTo(w + 8, baseY + 2);
  ctx.closePath();
  ctx.fill();
}
function cloud(x, y, s) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.75], [-0.9, 0.2, 0.7], [0.4, -0.45, 0.7]]) { circle(ctx, x + dx * s, y + dy * s, r * s); ctx.fill(); }
}
function sun(x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
  g.addColorStop(0, "rgba(255,250,210,0.6)");
  g.addColorStop(1, "rgba(255,250,210,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  circle(ctx, x, y, r); paint(ctx, col);
}
function shipShape(x, y, s) {
  ctx.fillStyle = "#2a1838";
  ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.3); ctx.lineTo(x + s, y - s * 0.35); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x - s * 0.8, y); ctx.fill();
  ctx.fillRect(x - s * 0.3 - s * 0.03, y - s * 1.5, s * 0.06, s * 1.2);
  ctx.fillRect(x + s * 0.3 - s * 0.03, y - s * 1.3, s * 0.06, s * 1.0);
  ctx.beginPath(); ctx.moveTo(x - s * 0.7, y - s * 1.35); ctx.quadraticCurveTo(x - s * 0.3, y - s * 1.1, x + s * 0.1, y - s * 1.35); ctx.lineTo(x + s * 0.1, y - s * 0.5); ctx.lineTo(x - s * 0.7, y - s * 0.5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.05, y - s * 1.15); ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.95, x + s * 0.65, y - s * 1.15); ctx.lineTo(x + s * 0.65, y - s * 0.5); ctx.lineTo(x - s * 0.05, y - s * 0.5); ctx.fill();
}
function drawBackground(v, r) {
  const t = track.theme, w = v.w, hz = v.hz, u = v.u, off = r.bg * w;
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, t.sky[0]);
  g.addColorStop(1, t.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, hz + 2);
  ctx.fillStyle = t.grass[0];
  ctx.fillRect(0, hz, w, v.h - hz);
  const key = track.def.key;
  if (key === "beach") {
    sun(wrap(w * 0.72 - off * 0.05, w * 1.2) - w * 0.1, hz * 0.3, u * 0.08, "#fff6b0");
    for (let k = 0; k < 6; k++) cloud(wrap(k * w * 0.27 - off * 0.25, w * 1.6) - w * 0.3, hz * (0.15 + (k % 3) * 0.14), u * 0.06);
    ridge("#4fae7a", hz - u * 0.05, u * 0.09, w, off * 0.5, 3 / u, 1, true);
    ctx.fillStyle = "#2a8fd0";
    ctx.fillRect(0, hz - u * 0.05, w, u * 0.05 + 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let k = 0; k < 10; k++) ctx.fillRect(wrap(k * w * 0.13 - off * 0.7 + Math.sin(clock + k) * 6, w), hz - u * (0.012 + (k % 3) * 0.013), u * 0.05, 2);
  } else if (key === "jungle") {
    for (let k = 0; k < 4; k++) cloud(wrap(k * w * 0.4 - off * 0.2, w * 1.6) - w * 0.3, hz * (0.15 + (k % 2) * 0.15), u * 0.05);
    // a smoking volcano far away
    const vx = wrap(w * 0.3 - off * 0.15, w * 1.5) - w * 0.25, vb = hz - u * 0.12;
    ctx.fillStyle = "#6a7a8a";
    ctx.beginPath(); ctx.moveTo(vx - u * 0.45, vb + 2); ctx.lineTo(vx - u * 0.08, vb - u * 0.3); ctx.lineTo(vx + u * 0.08, vb - u * 0.3); ctx.lineTo(vx + u * 0.45, vb + 2); ctx.fill();
    ctx.fillStyle = "#ff7a2a";
    ctx.beginPath(); ctx.moveTo(vx - u * 0.08, vb - u * 0.3); ctx.lineTo(vx + u * 0.08, vb - u * 0.3); ctx.lineTo(vx + u * 0.04, vb - u * 0.24); ctx.lineTo(vx - u * 0.05, vb - u * 0.22); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const s = ((clock * 0.15 + k / 4) % 1);
      circle(ctx, vx + s * u * 0.12, vb - u * 0.32 - s * u * 0.25, u * (0.03 + s * 0.05)); paint(ctx, `rgba(120,120,130,${0.6 * (1 - s)})`);
    }
    ridge("#6aa88a", hz - u * 0.04, u * 0.2, w, off * 0.3, 1.5 / u, 2);
    ridge("#2f7a3a", hz, u * 0.1, w, off * 0.6, 6 / u, 5);
  } else {
    sun(wrap(w * 0.6 - off * 0.05, w * 1.2) - w * 0.1, hz - u * 0.05, u * 0.16, "#ffd27a");
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = "rgba(255,180,200,0.5)";
      oval(ctx, wrap(k * w * 0.3 - off * 0.2, w * 1.6) - w * 0.3, hz * (0.2 + (k % 3) * 0.12), u * 0.16, u * 0.02); ctx.fill();
    }
    ridge("#4a2a5a", hz - u * 0.05, u * 0.12, w, off * 0.4, 2.5 / u, 3, true);
    ctx.fillStyle = "#3a4f9a";
    ctx.fillRect(0, hz - u * 0.05, w, u * 0.05 + 2);
    for (let k = 0; k < 3; k++) shipShape(wrap(k * w * 0.45 - off * 0.55, w * 1.4) - w * 0.2, hz - u * 0.02, u * 0.05);
    ctx.fillStyle = "rgba(255,210,140,0.6)";
    for (let k = 0; k < 8; k++) ctx.fillRect(wrap(k * w * 0.17 - off * 0.7 + Math.sin(clock + k) * 6, w), hz - u * (0.01 + (k % 3) * 0.013), u * 0.06, 2);
  }
}

// ---------- 13. the HUD: lap, position, item and messages, drawn on top of each player's view ----------
function hudText(str, x, y, size, color, align = "center") {
  ctx.font = `${size}px "Lilita One", sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = "rgba(11,29,58,0.9)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function drawHUD(v, r) {
  const s = clamp(Math.min(v.w / 820, v.h / 380), 0.55, 1.4), pad = 12 * s;
  ctx.textBaseline = "top";
  // lap and time
  rr(ctx, pad, pad, 160 * s, 66 * s, 12 * s); paint(ctx, "rgba(11,29,58,0.55)", "rgba(255,255,255,0.25)", 2);
  hudText(`${game.players === 2 ? "P" + r.human + "  " : ""}LAP ${clamp(r.lap, 1, LAPS)}/${LAPS}`, pad + 12 * s, pad + 8 * s, 26 * s, "#fff", "left");
  hudText("⏱ " + fmtTime(r.finished ? r.finishTime : game.time), pad + 12 * s, pad + 38 * s, 19 * s, "#ffe36b", "left");
  // position
  const placeCol = ["#ffcf3f", "#dfe6f2", "#ff9a5a"][r.place - 1] || "#fff";
  ctx.drawImage(FACES[r.mon], v.w - pad - 165 * s, pad, 56 * s, 56 * s);
  hudText(String(r.place), v.w - pad - 52 * s, pad - 4 * s, 64 * s, placeCol, "right");
  hudText(ordinal(r.place).slice(-2), v.w - pad - 50 * s, pad + 8 * s, 26 * s, placeCol, "left");
  hudText(`of ${racers.length}`, v.w - pad - 24 * s, pad + 40 * s, 15 * s, "#fff");
  // item slot
  const bs = 72 * s, bx = v.w / 2 - bs / 2;
  rr(ctx, bx, pad, bs, bs, 14 * s); paint(ctx, "rgba(11,29,58,0.55)", "#ffcf3f", 3 * s);
  const shown = r.roulette > 0 ? ITEMS[Math.floor(clock * 14) % ITEMS.length] : r.item;
  if (shown) ctx.drawImage(ICONS[shown], bx + 6 * s, pad + 6 * s, bs - 12 * s, bs - 12 * s);
  if (r.item && r.roulette <= 0 && s > 0.7) hudText(ITEM_NAMES[r.item], v.w / 2, pad + bs + 4 * s, 15 * s, "#fff");
  // drift sparks meter
  if (r.drift) {
    const f = Math.min(1, r.charge / DRIFT_ORANGE), mw = 120 * s, mx = v.w / 2 - mw / 2, my = v.h - 30 * s;
    rr(ctx, mx, my, mw, 12 * s, 6 * s); paint(ctx, "rgba(11,29,58,0.6)");
    rr(ctx, mx, my, Math.max(12 * s, mw * f), 12 * s, 6 * s); paint(ctx, r.charge >= DRIFT_ORANGE ? "#ff9a2a" : r.charge >= DRIFT_BLUE ? "#4ad0ff" : "#fff");
  }
  // countdown and messages
  ctx.textBaseline = "middle";
  if (game.state === "count") {
    const c = Math.ceil(game.count);
    hudText(c > 3 ? "READY?" : String(c), v.w / 2, v.h * 0.32, (c > 3 ? 60 : 110) * s, c > 3 ? "#fff" : "#ffcf3f");
  } else if (game.goT > 0) {
    hudText("GO!", v.w / 2, v.h * 0.32, 120 * s * (1 + (1 - game.goT) * 0.3), "#5fd36a");
  }
  if (r.msgT > 0) hudText(r.msg, v.w / 2, v.h * (r.finished ? 0.36 : 0.42), (r.finished ? 56 : 44) * s, r.finished ? "#ffcf3f" : "#fff");
  if (r.spin <= 0 && Math.abs(r.x) > 1.6 && game.state === "race") hudText("Back to the road!", v.w / 2, v.h * 0.55, 26 * s, "#fff");
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#0b1d3a";
  ctx.fillRect(0, 0, W, H);
  if (!track) return;
  for (const s of track.segs) { s.cars.length = 0; s.things.length = 0; }
  for (const r of racers) segAt(r.z).cars.push(r);
  for (const t of things) segAt(t.z).things.push(t);
  for (const b of track.boxes) segAt(b.z).things.push(b);
  for (const v of viewports()) renderView(v);
}

// ---------- 14. sounds and music, made from scratch with the Web Audio API ----------
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
  beep: () => tone(440, 0.2, "square", 0.08),
  go: () => tone(880, 0.5, "square", 0.08),
  hop: () => tone(500, 0.08, "square", 0.03, 800),
  spark: big => tone(big ? 1800 : 1300, 0.08, "square", 0.035),
  boost: () => { tone(300, 0.35, "sawtooth", 0.05, 900); noise(0.2, 0.05); },
  rocket: () => { tone(180, 0.7, "sawtooth", 0.06, 900); noise(0.6, 0.08); },
  box: () => notes([660, 880, 1100], 45, "square", 0.04, 0.08),
  got: () => tone(1250, 0.1, "triangle", 0.08),
  splat: () => tone(300, 0.3, "sine", 0.15, 70),
  shoot: () => tone(700, 0.18, "square", 0.05, 300),
  shield: () => notes([523, 784, 1047], 60, "triangle", 0.09),
  pop: () => { noise(0.12, 0.1); tone(900, 0.12, "triangle", 0.08, 300); },
  spin: () => tone(800, 0.7, "sawtooth", 0.05, 150),
  bump: () => noise(0.08, 0.12),
  thud: () => { noise(0.25, 0.2); tone(90, 0.25, "triangle", 0.2, 40); },
  lap: () => notes([784, 988], 90, "square", 0.05),
  final: () => notes([523, 659, 784, 1047, 784, 1047], 80, "square", 0.05),
  finish: () => notes([523, 659, 784, 1047], 100, "square", 0.05, 0.2),
  win: () => notes([523, 659, 784, 1047, 784, 1047, 1319, 1568], 130, "square", 0.06, 0.25),
};

// each player's engine hums higher the faster they go
let engines = [];
function startEngines() {
  stopEngines();
  if (!audio) return;
  for (const r of humansOf()) {
    const o = audio.createOscillator(), f = audio.createBiquadFilter(), g = audio.createGain();
    o.type = "sawtooth";
    f.type = "lowpass";
    f.frequency.value = 500;
    g.gain.value = 0;
    o.connect(f).connect(g).connect(audio.destination);
    o.start();
    engines.push({ o, g, r });
  }
}
function stopEngines() {
  for (const e of engines) { try { e.o.stop(); } catch (err) { /* already stopped */ } }
  engines = [];
}
function engineTick() {
  if (!audio) return;
  const on = !muted && (game.state === "count" || game.state === "race" || game.state === "done");
  for (const e of engines) {
    const pct = e.r.speed / e.r.top;
    e.o.frequency.setTargetAtTime(50 + e.r.human * 6 + pct * 110 + (e.r.boost > 0 ? 35 : 0), audio.currentTime, 0.05);
    e.g.gain.setTargetAtTime(on ? 0.02 + pct * 0.012 : 0, audio.currentTime, 0.05);
  }
}

// Background music is made up by the computer! It wanders up and down a scale of notes that sound
// nice together. Each track has its own seed, so each track gets its own song.
const MENU_TUNE = { root: 64, scale: [0, 2, 4, 7, 9], step: 0.14, seed: 8, chords: [0, 5, 9, 7], lead: "triangle" };
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
function setMusic(key) {
  tune = makeTune(key ? THEMES[key].music : MENU_TUNE);
  musicStep = 0;
  if (audio) musicTime = audio.currentTime + 0.1;
}
function stopMusic() { tune = null; }
function musicTick() {
  if (!audio || muted || !tune || !["menu", "race", "done"].includes(game.state)) return;
  if (musicTime < audio.currentTime) musicTime = audio.currentTime + 0.05;
  while (musicTime < audio.currentTime + 0.25) {
    const s = musicStep % 32;
    if (tune.melody[s]) tone(midi(tune.melody[s]), tune.step * 0.9, tune.lead, tune.lead === "sawtooth" ? 0.016 : 0.024, 0, musicTime);
    if (s % 2 === 0) tone(midi(tune.bass[Math.floor(s / 8)]), tune.step * 1.7, "triangle", 0.07, 0, musicTime);
    if (s % 4 === 2) tone(midi(tune.bass[Math.floor(s / 8)] + 12), tune.step * 0.5, "triangle", 0.04, 0, musicTime);
    musicTime += tune.step;
    musicStep++;
  }
}
setInterval(musicTick, 60);

// ---------- 15. keyboard and touch ----------
// [which player in a 2 player game, what it does]. In a 1 player game every key works for you.
const KEYS = {
  KeyA: [0, "left"], KeyD: [0, "right"], KeyS: [0, "brake"], Space: [0, "drift"], ShiftLeft: [0, "drift"],
  KeyW: [0, "item"], KeyE: [0, "item"], KeyQ: [0, "item"],
  ArrowLeft: [1, "left"], ArrowRight: [1, "right"], ArrowDown: [1, "brake"], Slash: [1, "drift"], ShiftRight: [1, "drift"],
  Period: [1, "drift"], ArrowUp: [1, "item"], Enter: [1, "item"],
  "touch-left": [0, "left"], "touch-right": [0, "right"], "touch-brake": [0, "brake"], "touch-drift": [0, "drift"], "touch-item": [0, "item"],
};
const held = new Set();
const pads = [{ ...NO_INPUT }, { ...NO_INPUT }];
function readPads() {
  for (const p of pads) Object.assign(p, NO_INPUT);
  for (const code of held) {
    const [who, act] = KEYS[code];
    pads[game.players === 1 ? 0 : who][act] = true;
  }
}
const racing = () => game.state === "count" || game.state === "race" || game.state === "done";
window.addEventListener("keydown", e => {
  ensureAudio();
  if (KEYS[e.code] && racing()) { e.preventDefault(); held.add(e.code); }
  if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) togglePause();
  if (e.code === "KeyM" && !e.repeat) muted = !muted;
  if (e.code === "Enter" && game.state === "results" && !(document.activeElement instanceof HTMLButtonElement)) {
    e.preventDefault();
    const next = $("res-next");
    (next.classList.contains("hidden") ? $("res-again") : next).click();
  }
});
window.addEventListener("keyup", e => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

const touchy = window.matchMedia("(pointer: coarse)").matches;
for (const btn of document.querySelectorAll("#touch button")) {
  const code = "touch-" + btn.dataset.key;
  btn.addEventListener("pointerdown", e => { e.preventDefault(); ensureAudio(); held.add(code); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) btn.addEventListener(ev, e => { e.preventDefault(); held.delete(code); });
}

// ---------- 16. menus ----------
const SCREENS = ["title-screen", "pick-screen", "track-screen", "pause-screen", "results-screen"];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", !!id && id !== "pause-screen");
}
function togglePause() {
  if (racing()) { game.pausedFrom = game.state; game.state = "pause"; showScreen("pause-screen"); }
  else if (game.state === "pause") { game.state = game.pausedFrom; showScreen(null); held.clear(); }
}
function toTitle() {
  stopEngines();
  startDemo();
  showScreen("title-screen");
}

let picking = 0;
function openPick(p) {
  picking = p;
  $("pick-title").textContent = game.players === 1 ? "Pick your monster!" : `Player ${p + 1}, pick your monster!`;
  const box = $("monsters");
  box.innerHTML = "";
  MONSTERS.forEach((m, i) => {
    const b = document.createElement("button");
    b.className = "mon";
    const taken = p === 1 && game.picks[0] === i;
    b.disabled = taken;
    const bars = (label, n) => `<div class="stat"><span>${label}</span><span class="bar">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= n ? "on" : ""}"></i>`).join("")}</span></div>`;
    b.innerHTML = (taken ? '<span class="taken">P1</span>' : "") +
      `<div class="name" style="color:${m.color}">${m.name}</div><div class="about">${m.about}</div>` +
      bars("Speed", m.speed) + bars("Pickup", m.accel) + bars("Turning", m.turn);
    const art = makeCanvas(200, 130, c => {
      c.drawImage(KARTS[i][0], 40, 0, 120, 105);
      c.translate(100, 70);
      c.scale(38, 38);
      drawMonster(c, m, true);
    });
    b.insertBefore(art, b.querySelector(".name"));
    b.addEventListener("click", () => {
      game.picks[p] = i;
      sfx.got();
      if (p === 0 && game.players === 2) openPick(1); else openTracks();
    });
    box.appendChild(b);
  });
  showScreen("pick-screen");
}
function openTracks() {
  const sp = $("speeds");
  sp.innerHTML = "";
  SPEEDS.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "pick" + (i === game.speed ? " on" : "");
    b.innerHTML = `${s.name}<small>${s.about}${save.cups[i] === 1 ? " · 🏆" : ""}</small>`;
    b.addEventListener("click", () => { game.speed = i; save.speed = i; writeSave(); openTracks(); });
    sp.appendChild(b);
  });
  const tr = $("tracks");
  tr.innerHTML = "";
  TRACKS.forEach((t, i) => {
    const best = save.best[t.key];
    const b = document.createElement("button");
    b.className = "pick " + t.key;
    b.innerHTML = `${t.name}<small>${t.about}${best ? `<br>Best race ⏱ ${fmtTime(best.race)} · best lap ${fmtTime(best.lap)}` : ""}</small>`;
    b.addEventListener("click", () => { ensureAudio(); game.cup = null; startRace(i); });
    tr.appendChild(b);
  });
  const cup = document.createElement("button");
  cup.className = "pick cup";
  cup.innerHTML = `🏆 Monster Cup<small>All 3 tracks in a row. Most points wins!</small>`;
  cup.addEventListener("click", () => { ensureAudio(); game.cup = { race: 0, pts: MONSTERS.map(() => 0) }; startRace(0); });
  tr.appendChild(cup);
  showScreen("track-screen");
}

function resultRow(place, r, extra, pts) {
  const m = MONSTERS[r.mon];
  const who = r.human ? (game.players === 1 ? "You" : "Player " + r.human) : "Computer";
  const face = makeCanvas(112, 84, c => c.drawImage(FACES[r.mon], 14, 0, 84, 84));
  const row = document.createElement("div");
  row.className = "row" + (r.human ? " you" : "");
  row.innerHTML = `<span class="place">${ordinal(place)}</span><span class="face"></span>` +
    `<span class="who" style="color:${m.color}">${m.name}<small>${who}</small></span><span class="time">${extra}</span><span class="pts">${pts}</span>`;
  row.querySelector(".face").replaceWith(face);
  return row;
}
function showResults() {
  stopMusic();
  stopEngines();
  game.state = "results";
  const L = track.length, def = track.def;
  // karts still racing get a time worked out from how far they had left to go
  for (const r of racers) if (!r.finished) r.finishTime = game.time + ((LAPS + 1) * L - (r.lap * L + r.z)) / (r.top * 0.85);
  const order = racers.slice().sort((a, b) => a.finishTime - b.finishTime);
  lastResults = order;
  for (const r of order) if (r.human && r.finished) {
    const best = save.best[def.key] || {};
    save.best[def.key] = { race: Math.min(best.race || Infinity, r.finishTime), lap: Math.min(best.lap || Infinity, r.bestLap || Infinity) };
  }
  writeSave();
  const table = $("res-table");
  table.innerHTML = "";
  order.forEach((r, i) => {
    let pts = "";
    if (game.cup) { game.cup.pts[r.mon] += POINTS[i]; pts = "+" + POINTS[i]; }
    table.appendChild(resultRow(i + 1, r, fmtTime(r.finishTime) + (r.finished ? "" : " *"), pts));
  });
  const win = order[0];
  $("res-title").innerHTML = win.human ? (game.players === 1 ? "YOU <span>WIN!</span>" : `PLAYER ${win.human} <span>WINS!</span>`)
    : `${MONSTERS[win.mon].name.toUpperCase()} <span>WINS!</span>`;
  $("res-trophy").classList.toggle("hidden", !win.human);
  const me = humansOf().map(h => `${game.players === 2 ? "Player " + h.human : "You"}: ${ordinal(order.indexOf(h) + 1)} place, best lap ${h.bestLap ? fmtTime(h.bestLap) : "-"}`);
  $("res-note").innerHTML = `<b>${def.name}</b><br>${me.join("<br>")}`;
  const inCup = !!game.cup;
  $("res-next").classList.toggle("hidden", !inCup);
  $("res-next").textContent = inCup && game.cup.race === TRACKS.length - 1 ? "Cup standings ▶" : "Next race ▶";
  $("res-again").classList.toggle("hidden", inCup);
  if (win.human) sfx.win(); else sfx.finish();
  showScreen("results-screen");
}
function showCupStandings() {
  const cup = game.cup;
  const order = MONSTERS.map((m, i) => i).sort((a, b) => cup.pts[b] - cup.pts[a]);
  const table = $("res-table");
  table.innerHTML = "";
  const byMon = {};
  for (const r of lastResults) byMon[r.mon] = r;
  order.forEach((mon, i) => table.appendChild(resultRow(i + 1, byMon[mon], "", cup.pts[mon] + " pts")));
  const champ = byMon[order[0]];
  $("res-title").innerHTML = champ.human ? (game.players === 1 ? "CUP <span>CHAMPION!</span>" : `PLAYER ${champ.human} <span>CHAMPION!</span>`)
    : `${MONSTERS[champ.mon].name.toUpperCase()} <span>WINS THE CUP</span>`;
  $("res-trophy").classList.toggle("hidden", !champ.human);
  const bestHuman = Math.min(...order.map((mon, i) => (byMon[mon].human ? i + 1 : 99)));
  if (!save.cups[game.speed] || bestHuman < save.cups[game.speed]) save.cups[game.speed] = bestHuman;
  writeSave();
  $("res-note").innerHTML = `<b>Monster Cup</b> on <b>${SPEEDS[game.speed].name}</b> speed. ` +
    (bestHuman === 1 ? "You won the golden trophy! 🏆" : `Best player finished ${ordinal(bestHuman)}. Try again for the trophy!`);
  $("res-next").classList.add("hidden");
  $("res-again").classList.add("hidden");
  game.cup = null;
  if (champ.human) sfx.win();
}

$("play1").addEventListener("click", () => { ensureAudio(); game.players = 1; openPick(0); });
$("play2").addEventListener("click", () => { ensureAudio(); game.players = 2; openPick(0); });
$("pick-back").addEventListener("click", () => { if (picking === 1) openPick(0); else showScreen("title-screen"); });
$("track-back").addEventListener("click", () => openPick(game.players === 2 ? 1 : 0));
$("resume").addEventListener("click", togglePause);
$("restart").addEventListener("click", () => startRace(game.trackIdx));
$("quit").addEventListener("click", toTitle);
$("res-next").addEventListener("click", () => {
  if (!game.cup) return;
  if (game.cup.race >= TRACKS.length - 1) { showCupStandings(); return; }
  game.cup.race++;
  startRace(game.cup.race);
});
$("res-again").addEventListener("click", () => startRace(game.trackIdx));
$("res-menu").addEventListener("click", toTitle);

// three karts zooming along on the title screen
function drawLogo() {
  const c = $("logo-art").getContext("2d");
  c.clearRect(0, 0, 520, 170);
  c.strokeStyle = "rgba(255,255,255,0.7)";
  c.lineWidth = 4;
  c.lineCap = "round";
  for (const [x, y, l] of [[20, 70, 70], [10, 100, 90], [30, 130, 60], [300, 60, 50], [330, 150, 40]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
  for (const [mon, x, y, s, p] of [[3, 330, 30, 0.55, 2], [2, 70, 40, 0.6, 1], [0, 170, 20, 0.75, 0]]) {
    c.drawImage(KARTS[mon][p], x, y, KART_IMG_W * s, KART_IMG_H * s);
  }
  c.drawImage(SPRITES.box.img, 450, 70, 50, 50);
  c.drawImage(ICONS.rocket, 20, 10, 46, 46);
}

// ---------- 17. the main loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (game.state === "menu" || racing()) {
    readPads();
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  }
  engineTick();
  draw();
  requestAnimationFrame(frame);
}
startDemo();
drawLogo();
requestAnimationFrame(frame);
