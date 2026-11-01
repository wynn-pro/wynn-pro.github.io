// Pottery Master: make pots on a spinning potter's wheel for your customers.
// Center the clay, shape it with your hands, paint it with glaze and fire it in the kiln.
// Finish 15 orders (the last one is for the Queen!) to become a Pottery Master.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const N = 32;                 // a pot is made of 32 slices, from the bottom to the top
const START_COINS = 0;
const DRY_SPEED = 0.06;       // how fast the clay dries out while you shape it
const PULL_SPEED = 90;        // how fast the clay grows when you pull it up
const GRAB = 70;              // how close to the edge of the clay you have to be to shape it
const FIRE_TIME = 12;         // seconds in the kiln
const MASTER_STARS = 2;       // stars you need on the Queen's order to become Pottery Master
const SHELF_SIZE = 12;        // how many of your pots fit on the shelves
const SAVE_KEY = "pottery-master-save";
const STAGE_W = 720, STAGE_H = 640;   // the game is drawn on a 720 x 640 "stage", then stretched to fit
const CX = 360, BASE_Y = 470;         // the middle of the wheel, and where the bottom of the pot sits
const FLOOR_Y = 548;
const MIN_R = 14, MAX_R = 170, MIN_H = 30, MAX_H = 300;
const TAU = Math.PI * 2;

// ---------- 2. clay and glaze colors ----------
// Colors are [red, green, blue], from 0 to 255.
const CLAYS = {
  terracotta: { name: "Red clay", icon: "🟫", wet: [150, 86, 56], dry: [208, 122, 82], cost: 0 },
  porcelain: { name: "Porcelain", icon: "⬜", wet: [196, 188, 176], dry: [242, 238, 228], cost: 70, desc: "Pure white clay." },
  stoneware: { name: "Stoneware", icon: "⬛", wet: [88, 76, 70], dry: [128, 112, 100], cost: 70, desc: "Dark, earthy clay." },
};
const GLAZES = {
  white: { name: "white", rgb: [246, 243, 234], cost: 0 },
  blue: { name: "blue", rgb: [52, 108, 200], cost: 0 },
  green: { name: "green", rgb: [72, 162, 92], cost: 0 },
  yellow: { name: "yellow", rgb: [246, 198, 52], cost: 0 },
  red: { name: "red", rgb: [214, 62, 56], cost: 40 },
  pink: { name: "pink", rgb: [242, 140, 182], cost: 40 },
  purple: { name: "purple", rgb: [140, 84, 192], cost: 60 },
  teal: { name: "teal", rgb: [38, 168, 168], cost: 60 },
  black: { name: "black", rgb: [44, 42, 52], cost: 80 },
  gold: { name: "gold", rgb: [226, 178, 60], cost: 150, sparkle: true },
};
const CHALK = [236, 230, 220];   // glaze looks chalky and pale until it's fired
const PATTERNS = {
  stripe: { name: "stripes", icon: "➖" },
  dots: { name: "dots", icon: "⚫" },
  waves: { name: "waves", icon: "〰️" },
};

// ---------- 3. pot shapes ----------
// keys: [height from 0 (bottom) to 1 (top), radius]. The game draws a smooth line through them.
const SHAPES = {
  bowl: { name: "bowl", h: 110, keys: [[0, 55], [0.5, 105], [1, 135]] },
  cup: { name: "cup", h: 130, keys: [[0, 55], [1, 64]] },
  plate: { name: "plate", h: 40, keys: [[0, 90], [1, 160]] },
  flowerpot: { name: "flower pot", h: 160, keys: [[0, 55], [1, 95]] },
  mug: { name: "mug", h: 150, keys: [[0, 60], [1, 60]] },
  jar: { name: "jar", h: 190, keys: [[0, 65], [0.45, 105], [0.85, 62], [1, 66]] },
  tallvase: { name: "tall vase", h: 250, keys: [[0, 55], [0.15, 62], [0.8, 48], [1, 68]] },
  teabowl: { name: "tea bowl", h: 85, keys: [[0, 45], [0.6, 72], [1, 78]] },
  urn: { name: "urn", h: 230, keys: [[0, 55], [0.45, 115], [0.85, 55], [1, 78]] },
  bottle: { name: "bottle", h: 280, keys: [[0, 70], [0.3, 88], [0.55, 42], [0.85, 24], [1, 30]] },
  bigbowl: { name: "big bowl", h: 140, keys: [[0, 60], [0.5, 130], [1, 160]] },
  vase: { name: "vase", h: 240, keys: [[0, 50], [0.35, 100], [0.7, 40], [1, 62]] },
  royal: { name: "Royal Vase", h: 290, keys: [[0, 55], [0.25, 112], [0.55, 78], [0.78, 36], [0.92, 42], [1, 72]] },
};

// ---------- 4. customers and their orders ----------
// base: the glaze color they want ("any" = any color). pattern / pcolor: a pattern they want,
// and its color (no pcolor = any color). handle: true if it needs a handle.
const PEOPLE = {
  rosa: { name: "Grandma Rosa", face: "👵" },
  theo: { name: "Little Theo", face: "👦" },
  bo: { name: "Chef Bo", face: "👨‍🍳" },
  mira: { name: "Mira the Florist", face: "👩‍🌾" },
  gull: { name: "Captain Gull", face: "🧑‍✈️" },
  badger: { name: "Mr. Badger", face: "🦡" },
  owl: { name: "Professor Owl", face: "🦉" },
  ember: { name: "Ember the Dragon", face: "🐉" },
  robo: { name: "Robo-7", face: "🤖" },
  luna: { name: "Queen Luna", face: "👸" },
};
const LEVELS = [
  { who: "rosa", shape: "bowl", base: "any", pay: 20, say: "A bowl for my soup, dear. Any color is fine!" },
  { who: "theo", shape: "cup", base: "blue", pay: 25, say: "Can you make me a blue cup? Blue is my favorite!" },
  { who: "bo", shape: "plate", base: "white", pattern: "stripe", pay: 30, say: "A white plate with stripes, for my famous pancakes." },
  { who: "mira", shape: "flowerpot", base: "green", pay: 30, say: "My sunflowers need a green flower pot, please!" },
  { who: "gull", shape: "mug", base: "yellow", handle: true, pay: 35, say: "A yellow mug with a handle, for hot cocoa on my ship!" },
  { who: "badger", shape: "jar", base: "blue", pattern: "dots", pcolor: "white", pay: 40, say: "A blue jar with white dots, to keep my honey safe." },
  { who: "owl", shape: "tallvase", base: "any", pattern: "waves", pay: 45, say: "Hoo! A tall vase with waves on it, for my feathers." },
  { who: "theo", shape: "teabowl", base: "yellow", pattern: "dots", pay: 40, say: "A little yellow tea bowl with dots, for my teddy's tea party!" },
  { who: "ember", shape: "urn", base: "red", pay: 60, say: "A red urn! Red like fire! Rawr!" },
  { who: "robo", shape: "bottle", base: "white", pattern: "stripe", pcolor: "blue", pay: 60, say: "BEEP. REQUEST: ONE WHITE BOTTLE. BLUE STRIPES. BOOP." },
  { who: "rosa", shape: "jar", base: "pink", pattern: "dots", pcolor: "white", pay: 60, say: "A pink cookie jar with white dots for my grandkids!" },
  { who: "bo", shape: "bigbowl", base: "purple", pattern: "waves", pay: 70, say: "A big purple mixing bowl with waves. I'm making a giant cake!" },
  { who: "mira", shape: "vase", base: "teal", pattern: "stripe", pcolor: "white", pay: 70, say: "A teal vase with white stripes for my roses, please." },
  { who: "badger", shape: "mug", base: "black", pattern: "waves", pcolor: "white", handle: true, pay: 75, say: "A black mug with white waves, and a handle. Very fancy." },
  { who: "luna", shape: "royal", base: "gold", pattern: "stripe", pcolor: "purple", pay: 150, say: "Make me the Royal Vase: gold, with purple stripes. Only a true master can!" },
];
const ENDLESS_SHAPES = ["bowl", "cup", "plate", "flowerpot", "mug", "jar", "tallvase", "teabowl", "urn", "bottle", "bigbowl", "vase"];

// ---------- 5. the shop ----------
const SHOP = [
  ...Object.keys(GLAZES).filter(k => GLAZES[k].cost).map(k => ({
    id: k, kind: "glaze", name: GLAZES[k].name[0].toUpperCase() + GLAZES[k].name.slice(1) + " glaze",
    cost: GLAZES[k].cost, desc: GLAZES[k].sparkle ? "Shiny and sparkly!" : "A new glaze color.",
  })),
  ...Object.keys(CLAYS).filter(k => CLAYS[k].cost).map(k => ({ id: k, kind: "clay", icon: CLAYS[k].icon, name: CLAYS[k].name, cost: CLAYS[k].cost, desc: CLAYS[k].desc })),
  { id: "sponge", icon: "🧽", name: "Big Sponge", cost: 50, desc: "Your clay dries out slower." },
  { id: "wheel", icon: "⚙️", name: "Smooth Wheel", cost: 50, desc: "Centering is twice as fast." },
  { id: "gauge", icon: "🌡️", name: "Kiln Gauge", cost: 80, desc: "The green zone in the kiln is bigger." },
  { id: "plant", icon: "🪴", name: "Big Plant", cost: 20, desc: "Makes your studio cozy." },
  { id: "cat", icon: "🐈", name: "Studio Cat", cost: 30, desc: "A friendly cat who naps in your studio." },
  { id: "lights", icon: "✨", name: "Fairy Lights", cost: 40, desc: "Twinkly lights around the window." },
];

// ---------- 6. little helpers ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// rgb(color, k): k above 0 makes it lighter, below 0 makes it darker
function rgb(c, k, alpha) {
  k = k || 0;
  const f = v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return alpha === undefined ? `rgb(${f(c[0])},${f(c[1])},${f(c[2])})` : `rgba(${f(c[0])},${f(c[1])},${f(c[2])},${alpha})`;
}
// the radius a shape wants at height t (0 is the bottom, 1 is the top)
function shapeR(key, t) {
  const k = SHAPES[key].keys;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], smooth((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
  }
  return k[k.length - 1][1];
}
// the radius your pot has at height t
function potR(p, t) {
  const f = clamp(t, 0, 1) * (N - 1), i = Math.min(N - 2, Math.floor(f));
  return lerp(p.r[i], p.r[i + 1], f - i);
}
const owns = id => (GLAZES[id] && !GLAZES[id].cost) || (CLAYS[id] && !CLAYS[id].cost) || !!save.owned[id];
const aOrAn = word => (/^[aeiou]/i.test(word) ? "an " : "a ") + word;
const widest = p => Math.max(...p.r) + (p.handle ? 30 : 0);

// ---------- 7. the game state ----------
let save = freshSave();
let mode = "title";        // title | play | pause | result | shop | win
let step = "center";       // center | shape | glaze | fire | reveal
let order = null;          // what the customer wants (null when you make anything you like)
let pot = null;
let spin = 0, spinSpeed = 0, time = 0;
let wobble = 1, wet = 0.75, crackT = 0, sculpting = false;
let pull = 0;              // +1 pulling up, -1 pressing down
let btnHold = false, keyHold = false;
let glazeColor = "blue", glazeTool = "dip";
let fire = null, revealT = 0, resultShown = false, pendingWin = false;
let parts = [];
const pointer = { x: 0, y: 0, down: false };

function freshSave() {
  return { level: 0, coins: START_COINS, best: [], extraStars: 0, owned: {}, shelf: [], master: false, clay: "terracotta", made: 0 };
}

// every pot starts as a round lump of clay
function newPot() {
  const r = [];
  for (let i = 0; i < N; i++) { const t = i / (N - 1); r.push(100 - 42 * t * t); }
  return { h: 90, r, clay: owns(save.clay) ? save.clay : "terracotta", base: null, marks: [], handle: false, cracks: [], fired: false };
}

function makeOrder() {
  if (save.level < LEVELS.length) return Object.assign({ num: save.level + 1 }, LEVELS[save.level]);
  // after the Queen's vase, customers keep coming with random orders
  const who = pick(Object.keys(PEOPLE).filter(k => k !== "luna"));
  const colors = Object.keys(GLAZES).filter(owns);
  const o = { num: save.level + 1, who, shape: pick(ENDLESS_SHAPES), base: pick(colors.concat("any")), pay: Math.round(rand(50, 90)) };
  if (Math.random() < 0.6) {
    o.pattern = pick(Object.keys(PATTERNS));
    if (Math.random() < 0.5) o.pcolor = pick(colors.filter(c => c !== o.base));
  }
  if (o.shape === "mug" || (o.shape === "cup" && Math.random() < 0.5)) o.handle = true;
  o.say = "I'd like " + wantText(o) + ", please!";
  return o;
}
function wantText(o) {
  let s = aOrAn((o.base !== "any" ? o.base + " " : "") + SHAPES[o.shape].name);
  if (o.pattern) s += " with " + (o.pcolor ? o.pcolor + " " : "") + PATTERNS[o.pattern].name;
  if (o.handle) s += (o.pattern ? " and" : " with") + " a handle";
  return s;
}
const totalStars = () => save.best.reduce((a, b) => a + (b || 0), 0) + save.extraStars;
// how picky the customer is: early customers are kind, the Queen is very picky
const tolFor = o => o.num > LEVELS.length ? 0.32 : lerp(0.5, 0.3, (o.num - 1) / (LEVELS.length - 1));

// ---------- 8. saving and loading (in this browser only) ----------
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* no saving, that's okay */ }
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.level === "number") save = Object.assign(freshSave(), s);
  } catch (e) { /* broken save: start fresh */ }
}
// a pot on the shelf only needs its shape and colors
function packPot(p) {
  return { h: Math.round(p.h), r: p.r.map(Math.round), clay: p.clay, base: p.base, marks: p.marks, handle: p.handle, cracks: p.cracks, fired: true };
}

// ---------- 9. scoring: how close is your pot to the order? ----------
// We measure the pot at 21 heights and add up how far its edge is from the dotted line.
function shapeScore(p, o) {
  const s = SHAPES[o.shape];
  let diff = 0, total = 0;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, want = shapeR(o.shape, t);
    diff += Math.abs(potR(p, t) - want);
    total += want;
  }
  const err = diff / total + 0.6 * Math.abs(p.h - s.h) / s.h;
  return clamp(1 - err / tolFor(o), 0, 1);
}
function glazeScore(p, o) {
  let s = 0;
  if (p.base && (o.base === "any" || p.base === o.base)) s += 0.6;
  else if (p.base) s += 0.2;
  if (!o.pattern) s += 0.4;
  else {
    const m = p.marks.filter(x => x.kind === o.pattern);
    if (m.some(x => !o.pcolor || x.color === o.pcolor)) s += 0.4;
    else if (m.length) s += 0.25;
  }
  if (o.handle && !p.handle) s *= 0.6;
  return s;
}
function tipsFor(p, o, sh, fs) {
  const tips = [];
  if (sh < 0.75) {
    const want = SHAPES[o.shape].h;
    if (p.h < want * 0.85) tips.push("It was too short. Hold ⬆️ Pull up to make it taller.");
    else if (p.h > want * 1.15) tips.push("It was too tall. Hold ⬇️ Press down to make it shorter.");
    else tips.push("Drag the clay so its edges sit right on the dotted line.");
  }
  if (o.base !== "any" && p.base !== o.base) {
    tips.push(`They wanted ${o.base}. ${owns(o.base) ? "Dip the pot in " + o.base + "!" : "You can buy " + o.base + " glaze in the 🛒 shop."}`);
  }
  if (o.base === "any" && !p.base) tips.push("They wanted it glazed. Use 🪣 Dip to color it.");
  if (o.pattern && !p.marks.some(x => x.kind === o.pattern && (!o.pcolor || x.color === o.pcolor))) {
    tips.push(`They wanted ${o.pcolor ? o.pcolor + " " : ""}${PATTERNS[o.pattern].name}. Pick ${PATTERNS[o.pattern].icon} and click the pot.`);
  }
  if (o.handle && !p.handle) tips.push("It needed a handle! Click ➰ Handle when glazing.");
  if (fire.cracked) tips.push("The kiln got too hot and the pot cracked. Let go before the top!");
  else if (fs < 0.6) tips.push("Keep the kiln heat inside the green zone.");
  if (p.cracks.length && !fire.cracked) tips.push("The clay got too dry and cracked. Tap 💧 Water more often.");
  return tips;
}

// ---------- 10. the steps: center, shape, glaze, fire ----------
function startOrder(isFree) {
  order = isFree ? null : makeOrder();
  pot = newPot();
  wobble = 1; wet = 0.75; crackT = 0;
  parts = [];
  glazeTool = "dip";
  if (!owns(glazeColor)) glazeColor = "blue";
  updateOrderCard();
  setMode("play");
  goStep("center");
}

const STEPS = ["center", "shape", "glaze", "fire", "reveal"];
function goStep(s) {
  step = s;
  btnHold = false; pull = 0;
  if (s === "fire") fire = { T: 0.15, t: 0, inZone: 0, hot: 0, cracked: false, heating: false };
  if (s === "reveal") {
    revealT = 0; resultShown = false; pot.fired = true;
    burst(CX, BASE_Y - pot.h / 2, 30, ["#ffe66b", "#fff", "#ffb347"]);
    sfx.reveal();
  }
  document.querySelectorAll("#steps span").forEach(el => {
    const i = STEPS.indexOf(el.dataset.step), now = STEPS.indexOf(s);
    el.className = i === now ? "on" : i < now ? "done" : "";
  });
  buildToolbar();
}

// hold the clay while it spins, and it slowly stops wobbling
function updateCenter(dt) {
  if (btnHold || keyHold || pointer.down) {
    wobble -= dt * (save.owned.wheel ? 0.7 : 0.35);
    if (Math.random() < dt * 8) spatter(1, rgb(CLAYS[pot.clay].wet));
  } else wobble = Math.min(1, wobble + dt * 0.04);
  if (wobble <= 0) {
    wobble = 0;
    sfx.step();
    toast("Centered! Now shape it 👐");
    goStep("shape");
  }
}

function updateShape(dt) {
  sculpting = pointer.down && sculptAt(pointer.x, pointer.y, dt);
  if (pull) pullClay(pull, dt);
  const working = sculpting || pull;
  wet = Math.max(0, wet - dt * (working ? (save.owned.sponge ? 0.035 : DRY_SPEED) : 0.006));
  if (sculpting && Math.random() < dt * 10) spatter(1, rgb(CLAYS[pot.clay].wet));
  if (sculpting && Math.random() < dt * 6) sfx.squish();
  if (wet < 0.12 && working) {
    crackT += dt;
    if (crackT > 1.2 && pot.cracks.length < 4) {
      crackT = 0;
      pot.cracks.push({ t: rand(0.3, 0.9), u: rand(-0.55, 0.55), seed: rand(1, 99) });
      sfx.crack();
      toast("Too dry! It's cracking. Tap 💧 Water!");
    }
  }
}

// your hands push the clay (at the pointer's height) toward the pointer's distance from the middle.
// They only grab when the pointer is close to the edge of the clay, so a tap in the middle does nothing.
function sculptAt(x, y, dt) {
  const t = (BASE_Y - y) / pot.h;
  if (t < -0.08 || t > 1.12) return false;
  const want = clamp(Math.abs(x - CX), MIN_R, MAX_R);
  if (Math.abs(want - potR(pot, t)) > GRAB) return false;
  const at = clamp(t, 0, 1) * (N - 1);
  const power = wet < 0.12 ? 2 : 7;   // dry clay is hard to move
  for (let i = 0; i < N; i++) {
    const d = i - at, w = Math.exp(-d * d / 8);
    pot.r[i] += (want - pot.r[i]) * Math.min(1, dt * power * w);
  }
  // wet clay smooths itself out a little, so the sides don't get bumpy
  for (let i = 1; i < N - 1; i++) pot.r[i] = lerp(pot.r[i], (pot.r[i - 1] + pot.r[i + 1]) / 2, Math.min(1, dt * 4));
  return true;
}

// pulling up makes the clay taller and thinner, pressing down makes it shorter and fatter.
// The amount of clay stays the same: height x radius x radius doesn't change.
function pullClay(dir, dt) {
  const h0 = pot.h, h1 = clamp(h0 + dir * PULL_SPEED * dt, MIN_H, MAX_H);
  if (h1 === h0) return;
  const k = Math.sqrt(h0 / h1);
  const avg = pot.r.reduce((a, b) => a + b, 0) / N;
  if (dir > 0 && avg * k < 30) { toast("The clay is too thin to pull any higher!"); return; }
  pot.h = h1;
  for (let i = 0; i < N; i++) pot.r[i] = clamp(pot.r[i] * k, MIN_R, MAX_R);
  if (Math.random() < dt * 5) sfx.squish();
}

function addWater() {
  wet += 0.25;
  sfx.splash();
  for (let i = 0; i < 10; i++) {
    parts.push({ x: CX + rand(-30, 30), y: BASE_Y - pot.h - 30, vx: rand(-40, 40), vy: rand(20, 120), life: 0.8, max: 0.8, color: "#7cc7ff", size: rand(3, 5) });
  }
  if (wet > 1.05) {
    pot.h = Math.max(MIN_H, pot.h * 0.82);
    for (let i = 0; i < N; i++) pot.r[i] = clamp(pot.r[i] * (1 + 0.14 * (1 - i / N)), MIN_R, MAX_R);
    wet = 0.8;
    sfx.slump();
    toast("Too much water! Your clay slumped 😅");
  }
}

function glazeAt(x, y) {
  const t = (BASE_Y - y) / pot.h;
  if (t < -0.06 || t > 1.1 || Math.abs(x - CX) > potR(pot, t) + 24) return;
  if (glazeTool === "dip") {
    pot.base = glazeColor;
    sfx.splash();
    burst(CX, BASE_Y - pot.h / 2, 14, [rgb(GLAZES[glazeColor].rgb)]);
    return;
  }
  const tt = clamp(t, 0.04, 0.96);
  pot.marks = pot.marks.filter(m => !(m.kind === glazeTool && Math.abs(m.t - tt) < 0.07));
  pot.marks.push({ kind: glazeTool, t: Math.round(tt * 100) / 100, color: glazeColor });
  if (pot.marks.length > 14) pot.marks.shift();
  sfx.pop();
  burst(x, y, 6, [rgb(GLAZES[glazeColor].rgb)]);
}

// hold to pump the bellows: the kiln gets hotter. Let go and it cools down.
function updateFire(dt) {
  const f = fire;
  f.heating = btnHold || keyHold || pointer.down;
  f.T = clamp(f.T + (f.heating ? 0.42 : -0.26) * dt + rand(-0.2, 0.2) * dt, 0, 1);
  f.t += dt;
  const zone = fireZone();
  if (Math.abs(f.T - zone.mid) < zone.half) f.inZone += dt;
  if (f.T > 0.96) {
    f.hot += dt;
    if (f.hot > 1 && !f.cracked) {
      f.cracked = true;
      for (let i = 0; i < 3; i++) pot.cracks.push({ t: rand(0.2, 0.9), u: rand(-0.5, 0.5), seed: rand(1, 99) });
      sfx.crack();
      toast("Too hot! CRACK! 💥");
    }
  }
  if (f.heating && Math.random() < dt * 14) {
    parts.push({ x: CX + rand(-60, 60), y: 500, vx: rand(-15, 15), vy: rand(-90, -40), life: 0.7, max: 0.7, color: pick(["#ffb347", "#ffd56b", "#ff7b3a"]), size: rand(2, 4) });
  }
  if (Math.random() < dt * (1 + f.T * 5)) {
    parts.push({ x: CX + 110 + rand(-6, 6), y: 50, vx: rand(5, 25), vy: rand(-40, -20), life: 2, max: 2, color: "rgba(120,110,105,0.5)", size: rand(8, 14), smoke: true });
  }
  if (f.t >= FIRE_TIME) goStep("reveal");
}
// the green zone slowly moves up and down, so you have to keep watching it
function fireZone() {
  return { mid: 0.6 + 0.14 * Math.sin(fire.t * 0.55), half: save.owned.gauge ? 0.11 : 0.075 };
}

function updateReveal(dt) {
  revealT += dt;
  if (Math.random() < dt * 6) {
    const a = rand(0, TAU);
    parts.push({ x: CX + Math.cos(a) * rand(60, 160), y: BASE_Y - pot.h / 2 + Math.sin(a) * rand(40, 140), vx: 0, vy: -10, life: 1, max: 1, color: "#fff7c2", size: rand(3, 6), star: true });
  }
  if (revealT > 1.6 && !resultShown) { resultShown = true; finishPot(); }
}

function finishPot() {
  save.made++;
  save.shelf.unshift(packPot(pot));
  save.shelf.length = Math.min(save.shelf.length, SHELF_SIZE);
  if (!order) {
    saveGame();
    showResult({ free: true });
    return;
  }
  const sh = Math.max(0, shapeScore(pot, order) - (fire.cracked ? 0 : pot.cracks.length * 0.05));
  const gl = glazeScore(pot, order);
  let fs = clamp(fire.inZone / (FIRE_TIME * 0.75), 0, 1);
  if (fire.cracked) fs *= 0.4;
  const total = sh * 0.5 + gl * 0.3 + fs * 0.2;
  const stars = total >= 0.85 ? 3 : total >= 0.65 ? 2 : total >= 0.4 ? 1 : 0;
  const isFinal = order.num === LEVELS.length;
  const passed = stars >= (isFinal ? MASTER_STARS : 1);
  let coins = Math.round(order.pay * (0.5 + 0.5 * total));
  if (stars === 3) coins += Math.round(order.pay * 0.25);
  if (!passed) coins = Math.round(order.pay * 0.2);
  save.coins += coins;
  if (passed) {
    if (order.num <= LEVELS.length) save.best[order.num - 1] = Math.max(save.best[order.num - 1] || 0, stars);
    else save.extraStars += stars;
    save.level++;
    if (isFinal && !save.master) { save.master = true; pendingWin = true; }
  }
  saveGame();
  if (coins) sfx.coin();
  showResult({ sh, gl, fs, stars, coins, passed, isFinal, tips: tipsFor(pot, order, sh, fs) });
}

// ---------- 11. sparkles, splashes and bits of clay ----------
function burst(x, y, n, colors) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(60, 220);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.5, 1), max: 1, color: pick(colors), size: rand(3, 6), grav: true });
  }
}
function spatter(n, color) {
  for (let i = 0; i < n; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    parts.push({ x: CX + side * rand(40, 90), y: BASE_Y - rand(5, 30), vx: side * rand(80, 200), vy: rand(-120, -40), life: 0.6, max: 0.6, color, size: rand(2, 4), grav: true });
  }
}
function updateParts(dt) {
  for (const p of parts) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.grav) p.vy += 500 * dt;
    if (p.smoke) p.size += dt * 10;
    p.life -= dt;
  }
  parts = parts.filter(p => p.life > 0);
}
function drawParts(g) {
  for (const p of parts) {
    g.globalAlpha = clamp(p.life / p.max, 0, 1);
    g.fillStyle = p.color;
    if (p.star) drawSparkle(g, p.x, p.y, p.size);
    else { g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1;
}
function drawSparkle(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s * 2, y); g.quadraticCurveTo(x, y, x, y + s * 2);
  g.quadraticCurveTo(x, y, x - s * 2, y); g.quadraticCurveTo(x, y, x, y - s * 2);
  g.fill();
}

// ---------- 12. drawing a pot ----------
// The pot is drawn one slice at a time. Every slice is dark at the edges and light on the left,
// which makes a flat drawing look round.
function surface(p, t, o) {
  const clay = CLAYS[p.clay];
  let c = p.fired ? clay.dry : mix(clay.wet, clay.dry, 0.2 + 0.6 * (1 - (o.wet === undefined ? 0.7 : o.wet)));
  let glazed = false;
  if (p.base) { c = GLAZES[p.base].rgb; glazed = true; }
  for (const m of p.marks) if (m.kind === "stripe" && Math.abs(t - m.t) < 0.035) { c = GLAZES[m.color].rgb; glazed = true; }
  return glazed && !p.fired ? mix(c, CHALK, 0.4) : c;
}
function shadeFill(g, c, x, r) {
  const gr = g.createLinearGradient(x - r, 0, x + r, 0);
  gr.addColorStop(0, rgb(c, -0.42));
  gr.addColorStop(0.28, rgb(c, 0.12));
  gr.addColorStop(0.4, rgb(c, 0.2));
  gr.addColorStop(0.72, rgb(c, -0.05));
  gr.addColorStop(1, rgb(c, -0.5));
  return gr;
}
function drawPot(g, p, cx, by, s, o) {
  o = o || {};
  const ang = o.angle || 0, wob = o.wobble || 0, h = p.h * s;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push({ t, y: by - t * h, r: p.r[i] * s, x: cx + wob * s * 18 * Math.sin(ang * 0.5 + t * 2) * (0.4 + t) });
  }
  const at = t => pts[Math.round(clamp(t, 0, 1) * (N - 1))];
  // the handle goes first, so the pot covers the ends of it
  if (p.handle) {
    const a = at(0.72), b = at(0.26), c = surface(p, 0.5, o), out = 46 * s;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(a.x + a.r - 4 * s, a.y);
    g.bezierCurveTo(a.x + a.r + out, a.y - 12 * s, b.x + b.r + out, b.y + 8 * s, b.x + b.r - 4 * s, b.y);
    g.strokeStyle = rgb(c, -0.35); g.lineWidth = 14 * s; g.stroke();
    g.strokeStyle = rgb(c, 0.05); g.lineWidth = 8 * s; g.stroke();
  }
  // the body, slice by slice
  for (let i = 0; i < N - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const c = surface(p, (a.t + b.t) / 2, o);
    g.fillStyle = shadeFill(g, c, (a.x + b.x) / 2, Math.max(a.r, b.r));
    g.beginPath();
    g.moveTo(a.x - a.r, a.y + 0.6); g.lineTo(a.x + a.r, a.y + 0.6);
    g.lineTo(b.x + b.r, b.y - 0.6); g.lineTo(b.x - b.r, b.y - 0.6);
    g.closePath(); g.fill();
  }
  // a rounded bottom
  const f0 = pts[0];
  g.fillStyle = shadeFill(g, surface(p, 0, o), f0.x, f0.r);
  g.beginPath(); g.ellipse(f0.x, f0.y, f0.r, f0.r * 0.2, 0, 0, Math.PI); g.fill();
  // throwing rings, and specks that whizz round on wet clay
  if (!p.fired && !p.base) {
    g.fillStyle = "rgba(0,0,0,0.07)";
    for (let i = 3; i < N - 1; i += 4) g.fillRect(pts[i].x - pts[i].r, pts[i].y, pts[i].r * 2, Math.max(1, 1.5 * s));
    if (o.spin) {
      g.strokeStyle = "rgba(60,30,15,0.28)";
      g.lineWidth = Math.max(1, 2 * s);
      for (let k = 0; k < 18; k++) {
        const t = (k * 0.618) % 0.9 + 0.05, a = k * 2.4 + ang, fr = Math.cos(a);
        if (fr < 0.1) continue;
        const q = at(t), x = q.x + q.r * Math.sin(a) * 0.96, len = clamp(o.spin * 0.8, 1, 9) * s * fr;
        g.beginPath(); g.moveTo(x - len, q.y); g.lineTo(x + len, q.y); g.stroke();
      }
    }
  }
  // dots and waves go all the way round, so they move as the pot spins
  for (const m of p.marks) {
    if (m.kind === "stripe") continue;
    const c = p.fired ? GLAZES[m.color].rgb : mix(GLAZES[m.color].rgb, CHALK, 0.4);
    const q = at(m.t), r = potR(p, m.t) * s;
    if (m.kind === "dots") {
      const rad = Math.max(1.5, 6 * s);
      for (let k = 0; k < 9; k++) {
        const a = ang + k * TAU / 9, fr = Math.cos(a);   // fr is how much the dot faces you
        if (fr < 0.08) continue;
        g.fillStyle = rgb(c, -0.3 * (1 - fr));
        g.beginPath(); g.ellipse(q.x + r * Math.sin(a), q.y, rad * fr, rad, 0, 0, TAU); g.fill();
      }
    } else {
      g.strokeStyle = rgb(c);
      g.lineWidth = Math.max(1.5, 4 * s);
      g.lineCap = "round";
      g.beginPath();
      for (let j = 0; j <= 28; j++) {
        const th = -Math.PI / 2 + Math.PI * j / 28;
        const x = q.x + r * Math.sin(th) * 0.97, y = q.y + Math.sin((th + ang) * 5) * 5 * s;
        if (j) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
  }
  // fired glaze is shiny
  if (p.fired && p.base) {
    g.fillStyle = "rgba(255,255,255,0.26)";
    g.beginPath();
    for (let i = 1; i < N - 1; i++) g.lineTo(pts[i].x - pts[i].r * 0.52, pts[i].y);
    for (let i = N - 2; i >= 1; i--) g.lineTo(pts[i].x - pts[i].r * 0.38, pts[i].y);
    g.fill();
    if (GLAZES[p.base].sparkle) {
      g.fillStyle = "#fffbe0";
      for (let k = 0; k < 9; k++) {
        const tw = Math.sin(time * 3 + k * 2.1);
        if (tw < 0.3) continue;
        const q = at((k * 0.37) % 0.9 + 0.05);
        drawSparkle(g, q.x + q.r * (((k * 0.61) % 1) * 1.2 - 0.6), q.y, 2.2 * s * tw + 0.5);
      }
    }
  }
  // cracks
  if (p.cracks.length) {
    g.strokeStyle = "rgba(50,25,15,0.85)";
    g.lineWidth = Math.max(1, 1.8 * s);
    g.lineCap = "round";
    for (const ck of p.cracks) {
      const q = at(ck.t);
      let x = q.x + q.r * ck.u, y = q.y;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 1; k <= 5; k++) { x += Math.sin(ck.seed * k) * 5 * s; y += 8 * s; g.lineTo(x, y); }
      g.stroke();
    }
  }
  // the rim at the top, with the dark inside of the pot
  const top = pts[N - 1], ct = surface(p, 1, o), ry = Math.max(2, top.r * 0.26);
  g.fillStyle = rgb(ct, 0.18);
  g.beginPath(); g.ellipse(top.x, top.y, top.r, ry, 0, 0, TAU); g.fill();
  const wall = Math.min(top.r * 0.8, Math.max(3, 7 * s));
  if (top.r - wall > 1) {
    const ir = top.r - wall, iry = ry * ir / top.r;
    const gr = g.createLinearGradient(0, top.y - iry, 0, top.y + iry);
    gr.addColorStop(0, rgb(ct, -0.7)); gr.addColorStop(1, rgb(ct, -0.35));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(top.x, top.y, ir, iry, 0, 0, TAU); g.fill();
  }
}

// the dotted line that shows the shape the customer wants
function drawGhost(g, key) {
  const s = SHAPES[key];
  g.beginPath();
  for (let i = 0; i <= 30; i++) { const t = i / 30; g.lineTo(CX - shapeR(key, t), BASE_Y - t * s.h); }
  for (let i = 30; i >= 0; i--) { const t = i / 30; g.lineTo(CX + shapeR(key, t), BASE_Y - t * s.h); }
  g.fillStyle = "rgba(255,255,255,0.1)";
  g.fill();
  g.setLineDash([9, 7]);
  g.lineDashOffset = -time * 18;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 3;
  g.stroke();
  g.setLineDash([]);
}

// ---------- 13. drawing the studio ----------
let cw = 0, ch = 0, dpr = 1, S = 1, ox = 0, oy = 0;
const canvas = $("view"), ctx = canvas.getContext("2d");

function drawStudio(g) {
  // the stage is 720 x 640, but the wall and floor stretch out to the edges of the window
  const L = -ox / S, R = (cw - ox) / S, T = -oy / S, B = (ch - oy) / S;
  const wall = g.createLinearGradient(0, T, 0, FLOOR_Y);
  wall.addColorStop(0, "#f4dfc4"); wall.addColorStop(1, "#e6c39c");
  g.fillStyle = wall;
  g.fillRect(L, T, R - L, FLOOR_Y - T);
  g.fillStyle = "rgba(255,255,255,0.16)";
  for (let x = Math.floor(L / 44) * 44; x < R; x += 44) g.fillRect(x, T, 16, FLOOR_Y - T);
  // wooden floor
  g.fillStyle = "#b47c4b";
  g.fillRect(L, FLOOR_Y, R - L, B - FLOOR_Y);
  g.strokeStyle = "rgba(80,45,20,0.3)";
  g.lineWidth = 2;
  for (let y = FLOOR_Y + 24, row = 0; y < B + 26; y += 26, row++) {
    g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
    for (let x = Math.floor(L / 150) * 150 + (row % 2) * 75; x < R; x += 150) { g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x, y); g.stroke(); }
  }
  g.fillStyle = "#8a5a34";
  g.fillRect(L, FLOOR_Y - 10, R - L, 12);
  drawWindow(g);
  drawShelf(g, 18, 214, 236, 0);
  drawShelf(g, 506, 702, 236, 3);
  drawShelf(g, 18, 214, 380, 6);
  drawShelf(g, 506, 702, 380, 9);
  if (save.owned.plant) drawPlant(g, 640, FLOOR_Y + 36);
  if (save.owned.cat) drawCat(g, 100, FLOOR_Y + 42);
}

function drawWindow(g) {
  const x = 280, y = 40, w = 160, h = 118;
  const sky = g.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, "#8fd3ff"); sky.addColorStop(1, "#d8f1ff");
  g.fillStyle = sky;
  g.fillRect(x, y, w, h);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = "#ffe680";
  g.beginPath(); g.arc(x + 120, y + 30, 14, 0, TAU); g.fill();
  g.fillStyle = "#fff";
  const cx = x + ((time * 6) % (w + 80)) - 40;
  for (const [dx, dy, r] of [[0, 0, 12], [14, -5, 14], [28, 0, 11]]) { g.beginPath(); g.arc(cx + dx, y + 58 + dy, r, 0, TAU); g.fill(); }
  g.fillStyle = "#86c46a";
  g.beginPath(); g.ellipse(x + 40, y + h + 10, 90, 34, 0, 0, TAU); g.fill();
  g.fillStyle = "#6fb357";
  g.beginPath(); g.ellipse(x + 130, y + h + 14, 80, 30, 0, 0, TAU); g.fill();
  g.restore();
  g.strokeStyle = "#8a5a34";
  g.lineWidth = 8;
  g.strokeRect(x, y, w, h);
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
  g.fillStyle = "#8a5a34";
  g.fillRect(x - 10, y + h + 2, w + 20, 8);
  if (save.owned.lights) {
    g.strokeStyle = "#5b4a3a"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - 20, y - 8); g.quadraticCurveTo(x + w / 2, y + 20, x + w + 20, y - 8); g.stroke();
    const colors = ["#ff6b6b", "#ffd93b", "#6bd36b", "#6bb8ff", "#d68cff"];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, lx = lerp(x - 20, x + w + 20, u);
      const ly = (1 - u) * (1 - u) * (y - 8) + 2 * u * (1 - u) * (y + 20) + u * u * (y - 8);
      const on = Math.sin(time * 2.5 + i * 1.7) > -0.3;
      g.fillStyle = on ? colors[i % 5] : "#7a6a5a";
      g.beginPath(); g.arc(lx, ly + 4, 4, 0, TAU); g.fill();
      if (on) { g.fillStyle = colors[i % 5] + "44"; g.beginPath(); g.arc(lx, ly + 4, 9, 0, TAU); g.fill(); }
    }
  }
}

// a shelf holds 3 of the pots you made. "first" is which pot goes first (0 is the newest).
function drawShelf(g, x0, x1, y, first) {
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(x0 + 4, y + 10, x1 - x0, 6);
  g.fillStyle = "#a36a3c";
  g.fillRect(x0, y, x1 - x0, 11);
  g.fillStyle = "#c38a55";
  g.fillRect(x0, y, x1 - x0, 3);
  g.fillStyle = "#7d4f2c";
  g.fillRect(x0 + 20, y + 11, 8, 18);
  g.fillRect(x1 - 28, y + 11, 8, 18);
  for (let k = 0; k < 3; k++) {
    const p = save.shelf[first + k];
    if (!p) continue;
    const s = Math.min(0.26, 30 / widest(p), 96 / p.h);
    drawPot(g, p, x0 + 33 + k * 65, y + 1, s, { angle: 1 + k });
  }
}

function drawPlant(g, x, y) {
  g.fillStyle = "#3f9a4a";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.38 + Math.sin(time * 1.2 + i) * 0.04;
    g.save(); g.translate(x, y - 40); g.rotate(a);
    g.beginPath(); g.ellipse(36, 0, 36, 11, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.fillStyle = "#c8693a";
  g.beginPath(); g.moveTo(x - 32, y - 46); g.lineTo(x + 32, y - 46); g.lineTo(x + 24, y + 6); g.lineTo(x - 24, y + 6); g.fill();
  g.fillStyle = "#a9522a";
  g.fillRect(x - 35, y - 50, 70, 10);
}

function drawCat(g, x, y) {
  const fur = "#f0a050", dark = "#c07030", swish = Math.sin(time * 2);
  g.strokeStyle = fur; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.moveTo(x + 30, y); g.quadraticCurveTo(x + 64, y - 6 + swish * 10, x + 52, y - 30 + swish * 8); g.stroke();
  g.fillStyle = fur;
  g.beginPath(); g.ellipse(x, y - 8, 40, 20, 0, 0, TAU); g.fill();
  g.beginPath(); g.arc(x - 34, y - 18, 17, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x - 48, y - 28); g.lineTo(x - 46, y - 46); g.lineTo(x - 34, y - 33); g.fill();
  g.beginPath(); g.moveTo(x - 30, y - 34); g.lineTo(x - 20, y - 46); g.lineTo(x - 20, y - 27); g.fill();
  g.strokeStyle = dark; g.lineWidth = 3;
  for (const dx of [-8, 6, 20]) { g.beginPath(); g.moveTo(x + dx, y - 27); g.lineTo(x + dx + 4, y - 16); g.stroke(); }
  g.strokeStyle = "#5a3418"; g.lineWidth = 2;
  g.beginPath(); g.arc(x - 41, y - 19, 4, 0.2, Math.PI - 0.2); g.stroke();
  g.beginPath(); g.arc(x - 29, y - 19, 4, 0.2, Math.PI - 0.2); g.stroke();
  const z = (time * 0.6) % 3;
  if (z < 1.6) {
    g.fillStyle = `rgba(90,60,40,${1 - z / 1.6})`;
    g.font = "bold 16px Nunito, sans-serif";
    g.textAlign = "left";
    g.fillText("z", x - 20 + z * 12, y - 50 - z * 22);
  }
}

// ---------- 14. drawing the wheel, the kiln and your hands ----------
function drawWheel(g) {
  // the body and the foot pedal
  g.fillStyle = "#4f6475";
  g.beginPath(); g.moveTo(CX - 120, BASE_Y + 40); g.lineTo(CX + 120, BASE_Y + 40); g.lineTo(CX + 100, FLOOR_Y + 48); g.lineTo(CX - 100, FLOOR_Y + 48); g.fill();
  g.fillStyle = "#3d4f5e";
  g.fillRect(CX - 100, FLOOR_Y + 40, 200, 10);
  g.fillStyle = "#2d3a45";
  g.beginPath(); g.ellipse(CX + 170, FLOOR_Y + 44, 34, 10, 0, 0, TAU); g.fill();
  g.strokeStyle = "#2d3a45"; g.lineWidth = 6;
  g.beginPath(); g.moveTo(CX + 112, FLOOR_Y + 20); g.lineTo(CX + 160, FLOOR_Y + 40); g.stroke();
  // the splash pan that catches the mess
  g.fillStyle = "#5d7486";
  g.beginPath(); g.ellipse(CX, BASE_Y + 28, 230, 50, 0, 0, TAU); g.fill();
  g.fillStyle = "#3c4c59";
  g.beginPath(); g.ellipse(CX, BASE_Y + 20, 210, 40, 0, 0, TAU); g.fill();
  g.fillStyle = "rgba(150,90,60,0.35)";
  g.beginPath(); g.ellipse(CX, BASE_Y + 24, 190, 30, 0, 0, TAU); g.fill();
  // the wheel head that spins
  g.fillStyle = "#7d8f9c";
  g.beginPath(); g.ellipse(CX, BASE_Y + 12, 160, 28, 0, 0, TAU); g.fill();
  g.fillStyle = "#b6c3cc";
  g.beginPath(); g.ellipse(CX, BASE_Y + 4, 160, 28, 0, 0, TAU); g.fill();
  g.strokeStyle = "rgba(60,80,95,0.35)"; g.lineWidth = 2;
  g.beginPath(); g.ellipse(CX, BASE_Y + 4, 110, 19, 0, 0, TAU); g.stroke();
  g.fillStyle = "#7d8f9c";
  for (let k = 0; k < 4; k++) {
    const a = spin + k * Math.PI / 2;
    g.beginPath(); g.ellipse(CX + 135 * Math.sin(a), BASE_Y + 4 + 23 * Math.cos(a), 5, 3, 0, 0, TAU); g.fill();
  }
}

function drawStand(g) {
  g.fillStyle = "#8a5a34";
  g.fillRect(CX - 110, BASE_Y + 14, 14, FLOOR_Y + 40 - BASE_Y - 14);
  g.fillRect(CX + 96, BASE_Y + 14, 14, FLOOR_Y + 40 - BASE_Y - 14);
  g.fillStyle = "#a36a3c";
  g.beginPath(); g.ellipse(CX, BASE_Y + 12, 160, 26, 0, 0, TAU); g.fill();
  g.fillStyle = "#c38a55";
  g.beginPath(); g.ellipse(CX, BASE_Y + 4, 160, 26, 0, 0, TAU); g.fill();
}

function drawKiln(g) {
  const f = fire, x0 = CX - 170, x1 = CX + 170, top = 120, bot = FLOOR_Y + 36;
  g.fillStyle = "#7f3a24";
  g.fillRect(CX + 90, 50, 40, 100);
  // the brick body with a round top
  g.fillStyle = "#a84f30";
  g.beginPath();
  g.moveTo(x0, bot); g.lineTo(x0, top + 70);
  g.quadraticCurveTo(x0, top, CX, top);
  g.quadraticCurveTo(x1, top, x1, top + 70);
  g.lineTo(x1, bot); g.closePath(); g.fill();
  g.save(); g.clip();
  g.strokeStyle = "rgba(70,25,10,0.35)"; g.lineWidth = 2;
  for (let y = top, row = 0; y < bot; y += 24, row++) {
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    for (let x = x0 + (row % 2) * 24; x < x1; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 24); g.stroke(); }
  }
  g.restore();
  // the glowing window, with your pot inside
  const wx = CX - 115, wy = 190, ww = 230, wh = 230;
  const glow = f.T < 0.5 ? mix([60, 20, 12], [255, 120, 40], f.T * 2) : mix([255, 120, 40], [255, 238, 180], (f.T - 0.5) * 2);
  g.fillStyle = "#4a2a1c";
  g.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
  g.fillStyle = rgb(glow);
  g.fillRect(wx, wy, ww, wh);
  g.save();
  g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  drawPot(g, pot, CX, wy + wh - 18, Math.min(0.62, 190 / pot.h, 90 / widest(pot)), {});
  g.fillStyle = rgb(glow, 0, 0.25 + f.T * 0.45);
  g.fillRect(wx, wy, ww, wh);
  g.restore();
  g.strokeStyle = "#2e1a10"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(CX, wy); g.lineTo(CX, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
  // the firebox and its flames
  g.fillStyle = "#2a140c";
  g.fillRect(CX - 90, 456, 180, 60);
  for (let i = 0; i < 6; i++) {
    const fx = CX - 72 + i * 29, fh = 10 + f.T * 44 + Math.sin(time * 18 + i * 2) * 5;
    g.fillStyle = "#ff7b3a";
    g.beginPath(); g.moveTo(fx - 11, 514); g.quadraticCurveTo(fx - 9, 514 - fh * 0.6, fx, 514 - fh); g.quadraticCurveTo(fx + 9, 514 - fh * 0.6, fx + 11, 514); g.fill();
    g.fillStyle = "#ffd56b";
    g.beginPath(); g.moveTo(fx - 6, 514); g.quadraticCurveTo(fx - 4, 514 - fh * 0.35, fx, 514 - fh * 0.6); g.quadraticCurveTo(fx + 4, 514 - fh * 0.35, fx + 6, 514); g.fill();
  }
  // the bellows: squeeze them to blow air on the fire
  const sq = f.heating ? 0.15 + 0.1 * Math.sin(time * 20) : 0.5;
  g.save(); g.translate(60, 480);
  g.fillStyle = "#c9a07a";
  g.beginPath(); g.moveTo(8, 0); g.lineTo(96 * Math.cos(sq), -96 * Math.sin(sq)); g.lineTo(96 * Math.cos(sq), 96 * Math.sin(sq)); g.fill();
  g.fillStyle = "#6b3f22";
  g.save(); g.rotate(-sq); g.fillRect(0, -10, 100, 10); g.restore();
  g.save(); g.rotate(sq); g.fillRect(0, 0, 100, 10); g.restore();
  g.fillStyle = "#555"; g.fillRect(-26, -4, 30, 8);
  g.restore();
  // the thermometer
  const tx = 610, ty0 = 160, ty1 = 470, H = ty1 - ty0, zone = fireZone();
  const vy = v => ty1 - v * H;
  g.fillStyle = "#fff";
  g.beginPath(); g.roundRect(tx - 18, ty0 - 10, 36, H + 20, 18); g.fill();
  g.fillStyle = "rgba(255,80,60,0.3)";
  g.fillRect(tx - 14, vy(1), 28, vy(0.96) - vy(1));
  g.fillStyle = "rgba(60,200,90,0.75)";
  g.fillRect(tx - 14, vy(zone.mid + zone.half), 28, zone.half * 2 * H);
  g.fillStyle = "#e5432f";
  g.fillRect(tx - 6, vy(f.T), 12, f.T * H);
  g.beginPath(); g.arc(tx, ty1 + 18, 18, 0, TAU); g.fill();
  g.fillStyle = "#222";
  g.beginPath(); g.moveTo(tx - 22, vy(f.T)); g.lineTo(tx - 32, vy(f.T) - 7); g.lineTo(tx - 32, vy(f.T) + 7); g.fill();
  // how long is left
  g.fillStyle = "rgba(40,20,10,0.5)";
  g.beginPath(); g.roundRect(CX - 150, 96, 300, 14, 7); g.fill();
  g.fillStyle = "#ffcf3f";
  g.beginPath(); g.roundRect(CX - 150, 96, 300 * clamp(f.t / FIRE_TIME, 0, 1), 14, 7); g.fill();
  const inZone = Math.abs(f.T - zone.mid) < zone.half;
  label(g, f.T > 0.96 ? "TOO HOT! 🔥" : inZone ? "Perfect! 👍" : f.T < zone.mid ? "Hotter! ⬆️" : "Cooler! ⬇️",
    CX, 160, 26, f.T > 0.96 ? "#ff5a4a" : inZone ? "#7dff8a" : "#fff");
}

// a hand with clay on its fingertips. dir is -1 for the left hand and 1 for the right hand.
function drawHand(g, x, y, dir, sc) {
  g.save();
  g.translate(x, y);
  g.scale(dir * sc, sc);
  g.fillStyle = "#f3c29c";
  g.strokeStyle = "#c88b62";
  g.lineWidth = 2;
  g.beginPath(); g.roundRect(30, -12, 60, 24, 10); g.fill(); g.stroke();
  g.beginPath(); g.roundRect(-2, -18, 44, 36, 14); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(26, -18, 12, 6, -0.5, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = "rgba(150,86,56,0.6)";
  g.beginPath(); g.roundRect(-2, -18, 14, 36, 8); g.fill();
  g.strokeStyle = "rgba(160,100,70,0.6)";
  for (const fy of [-8, 0, 8]) { g.beginPath(); g.moveTo(2, fy); g.lineTo(18, fy); g.stroke(); }
  g.restore();
}

function label(g, text, x, y, size, color) {
  g.font = `${size}px "Lilita One", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 5;
  g.lineJoin = "round";
  g.strokeStyle = "rgba(60,30,15,0.8)";
  g.strokeText(text, x, y);
  g.fillStyle = color || "#fff";
  g.fillText(text, x, y);
}

function drawMeter(g, x, y0, y1, v, color, icon, warnBelow) {
  const h = y1 - y0, fill = clamp(v, 0, 1) * h;
  g.fillStyle = "rgba(60,30,15,0.45)";
  g.beginPath(); g.roundRect(x - 13, y0 - 4, 26, h + 8, 12); g.fill();
  g.fillStyle = "rgba(255,80,60,0.4)";
  g.fillRect(x - 9, y1 - warnBelow * h, 18, warnBelow * h);
  if (fill > 1) { g.fillStyle = color; g.beginPath(); g.roundRect(x - 9, y1 - fill, 18, fill, 8); g.fill(); }
  label(g, icon, x, y0 - 22, 24);
}

// ---------- 15. drawing everything ----------
const TITLE_POT = (() => {
  const p = {
    h: 230, r: [], clay: "terracotta", base: "teal", handle: false, cracks: [], fired: true,
    marks: [{ kind: "dots", t: 0.18, color: "white" }, { kind: "waves", t: 0.42, color: "white" }, { kind: "stripe", t: 0.82, color: "yellow" }],
  };
  for (let i = 0; i < N; i++) p.r.push(shapeR("vase", i / (N - 1)));
  return p;
})();

function draw() {
  ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * ox, dpr * oy);
  drawStudio(ctx);
  if (mode === "title" || !pot) {
    drawWheel(ctx);
    drawPot(ctx, TITLE_POT, CX, BASE_Y, 1, { angle: spin });
  } else if (step === "fire") {
    drawKiln(ctx);
  } else if (step === "reveal") {
    drawStand(ctx);
    const y = BASE_Y - pot.h / 2;
    const glow = ctx.createRadialGradient(CX, y, 10, CX, y, 220);
    glow.addColorStop(0, "rgba(255,240,170,0.6)"); glow.addColorStop(1, "rgba(255,240,170,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(CX - 240, y - 240, 480, 480);
    drawPot(ctx, pot, CX, BASE_Y, 0.6 + 0.4 * smooth(clamp(revealT / 0.5, 0, 1)), { angle: spin });
  } else {
    drawWheel(ctx);
    if (step === "shape" && order) drawGhost(ctx, order.shape);
    drawPot(ctx, pot, CX, BASE_Y, 1, { angle: spin, wobble: step === "center" ? wobble : 0, wet, spin: step === "glaze" ? 0 : spinSpeed });
    if (step === "center") drawCenterHelp(ctx);
    if (step === "shape") drawShapeHelp(ctx);
    if (step === "glaze") drawGlazeHelp(ctx);
  }
  drawParts(ctx);
}

function drawCenterHelp(g) {
  if (btnHold || keyHold || pointer.down) {
    const y = BASE_Y - pot.h * 0.45, r = potR(pot, 0.45) + 6;
    drawHand(g, CX - r, y, -1, 0.9);
    drawHand(g, CX + r, y, 1, 0.9);
  } else {
    label(g, "Hold on the clay!", CX, BASE_Y - pot.h - 50 + Math.sin(time * 4) * 4, 28, "#ffe66b");
  }
  // a ring that fills up as the clay gets centered
  const x = 600, y = 300;
  g.lineWidth = 12;
  g.strokeStyle = "rgba(60,30,15,0.35)";
  g.beginPath(); g.arc(x, y, 40, 0, TAU); g.stroke();
  g.strokeStyle = "#7dd65a";
  g.beginPath(); g.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - wobble)); g.stroke();
  label(g, Math.round((1 - wobble) * 100) + "%", x, y, 22);
  label(g, "Centered", x, y + 62, 18);
}

function drawShapeHelp(g) {
  if (sculpting) {
    const t = clamp((BASE_Y - pointer.y) / pot.h, 0, 1), r = potR(pot, t) + 4, y = BASE_Y - t * pot.h;
    drawHand(g, CX - r, y, -1, 0.75);
    drawHand(g, CX + r, y, 1, 0.75);
  } else if (pull > 0) {
    const t = 0.15 + 0.75 * ((time * 1.5) % 1), r = potR(pot, t) + 4, y = BASE_Y - t * pot.h;
    drawHand(g, CX - r, y, -1, 0.75);
    drawHand(g, CX + r, y, 1, 0.75);
  } else if (pull < 0) {
    g.save(); g.translate(CX, BASE_Y - pot.h - 10); g.rotate(Math.PI / 2); drawHand(g, 0, 0, -1, 0.8); g.restore();
  } else if (pointer.down) {
    label(g, "Grab the edge of the clay!", CX, BASE_Y - pot.h - 40, 24, "#ffe66b");
  }
  drawMeter(g, 100, 250, 450, wet, wet < 0.12 ? "#ff7a5a" : "#5ab8ff", "💧", 0.12);
  label(g, "Water", 100, 474, 16);
  if (order) {
    const m = Math.round(shapeScore(pot, order) * 100);
    label(g, "Match", 605, 270, 20);
    label(g, m + "%", 605, 305, 40, m < 50 ? "#ff8a6a" : m < 75 ? "#ffd34d" : "#7dff8a");
  }
}

function drawGlazeHelp(g) {
  // a bucket of the glaze you picked
  g.fillStyle = "#8b9aa6";
  g.beginPath(); g.moveTo(70, 400); g.lineTo(150, 400); g.lineTo(140, 470); g.lineTo(80, 470); g.fill();
  g.fillStyle = rgb(GLAZES[glazeColor].rgb);
  g.beginPath(); g.ellipse(110, 400, 40, 10, 0, 0, TAU); g.fill();
  g.strokeStyle = "#5d6b75"; g.lineWidth = 3;
  g.beginPath(); g.arc(110, 400, 44, Math.PI, TAU); g.stroke();
  label(g, glazeTool === "dip" ? "🪣 Dip" : PATTERNS[glazeTool].icon + " " + PATTERNS[glazeTool].name, 110, 330, 20);
  // show where a pattern will go
  if (glazeTool !== "dip") {
    const t = (BASE_Y - pointer.y) / pot.h;
    if (t > -0.06 && t < 1.1 && Math.abs(pointer.x - CX) < potR(pot, t) + 24) {
      const tt = clamp(t, 0.04, 0.96), y = BASE_Y - tt * pot.h, r = potR(pot, tt);
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.setLineDash([6, 5]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(CX - r - 14, y); g.lineTo(CX + r + 14, y); g.stroke();
      g.setLineDash([]);
    }
  }
}

// ---------- 16. the HUD, the order card and the toolbar ----------
function updateHud() {
  $("coins").textContent = save.coins;
  $("stars").textContent = totalStars();
  $("order-no").textContent = !order ? "🎨" : order.num <= LEVELS.length ? `${order.num}/${LEVELS.length}` : order.num;
}

function updateOrderCard() {
  if (!order) {
    $("order-face").textContent = "🎨";
    $("order-name").textContent = "Free clay";
    $("order-text").textContent = "No customer. Make anything you like for your shelf!";
    $("order-pay").textContent = "";
    $("order-tip").textContent = "";
    $("order-target").classList.add("hidden");
  } else {
    const who = PEOPLE[order.who];
    $("order-face").textContent = who.face;
    $("order-name").textContent = who.name;
    $("order-text").textContent = "“" + order.say + "”";
    $("order-pay").textContent = "Pays 🪙 " + order.pay;
    const need = [order.base, order.pcolor].filter(c => c && c !== "any" && !owns(c));
    $("order-tip").textContent = need.length ? `Tip: ${need.join(" and ")} glaze is in the 🛒 shop!` : "";
    $("order-target").classList.remove("hidden");
    drawTarget($("order-target"), order.shape);
  }
  updateHud();
}

// the little picture of the shape on the order card
function drawTarget(cv, key) {
  const r = window.devicePixelRatio || 1, w = 64, h = 72;
  cv.width = w * r; cv.height = h * r;
  const g = cv.getContext("2d");
  g.setTransform(r, 0, 0, r, 0, 0);
  const s = SHAPES[key], k = Math.min(56 / (2 * Math.max(...s.keys.map(q => q[1]))), 62 / s.h);
  g.beginPath();
  for (let i = 0; i <= 30; i++) g.lineTo(w / 2 - shapeR(key, i / 30) * k, h - 5 - (i / 30) * s.h * k);
  for (let i = 30; i >= 0; i--) g.lineTo(w / 2 + shapeR(key, i / 30) * k, h - 5 - (i / 30) * s.h * k);
  g.fillStyle = "#c8693a"; g.fill();
  g.strokeStyle = "#7a3a1c"; g.lineWidth = 2; g.stroke();
}

function buildToolbar() {
  const bar = $("toolbar"), sw = $("swatches");
  bar.innerHTML = "";
  sw.innerHTML = "";
  sw.classList.toggle("hidden", step !== "glaze");
  bar.classList.toggle("hidden", step === "reveal");
  for (const t of toolsFor(step)) {
    const b = document.createElement("button");
    b.className = "tool" + (t.on ? " on" : "") + (t.cls ? " " + t.cls : "");
    b.innerHTML = `<span class="ti">${t.icon}</span><span class="tn">${t.name}</span>` + (t.key ? `<kbd>${t.key}</kbd>` : "");
    if (t.hold) {
      // hold buttons work while your finger or mouse button is down
      b.addEventListener("pointerdown", e => { e.preventDefault(); ac(); t.down(); b.classList.add("on"); });
      const up = () => { t.up(); b.classList.remove("on"); };
      b.addEventListener("pointerup", up);
      b.addEventListener("pointerleave", up);
      b.addEventListener("pointercancel", up);
    } else b.addEventListener("click", () => { ac(); t.click(); });
    bar.appendChild(b);
  }
  if (step === "glaze") {
    Object.keys(GLAZES).filter(owns).forEach((k, i) => {
      const b = document.createElement("button");
      b.className = "sw" + (k === glazeColor ? " on" : "");
      b.style.background = rgb(GLAZES[k].rgb);
      b.title = GLAZES[k].name + (i < 10 ? ` (${(i + 1) % 10})` : "");
      b.setAttribute("aria-label", GLAZES[k].name + " glaze");
      b.addEventListener("click", () => pickColor(k));
      sw.appendChild(b);
    });
  }
  $("tool-info").innerHTML = {
    center: "<b>Hold</b> on the clay (or hold <kbd>Space</kbd>) to center it. Wobbly clay can't be shaped!",
    shape: order
      ? "<b>Drag</b> on the clay to shape it. Hold <b>⬆️ Pull up</b> to make it taller. Fit it to the <b>dotted line</b>!"
      : "<b>Drag</b> on the clay to shape it. Hold <b>⬆️ Pull up</b> to make it taller. Make anything!",
    glaze: "Pick a color and a tool, then <b>click the pot</b>. <b>🪣 Dip</b> colors the whole pot.",
    fire: "<b>Hold</b> anywhere (or <kbd>Space</kbd>) to pump the bellows. Keep the heat in the <b>green zone</b>!",
    reveal: "Ta-da! ✨",
  }[step];
}

function toolsFor(s) {
  if (s === "center") {
    const clays = Object.keys(CLAYS).filter(owns);
    const list = clays.length < 2 ? [] : clays.map(k => ({
      icon: CLAYS[k].icon, name: CLAYS[k].name, on: pot.clay === k,
      click: () => { pot.clay = save.clay = k; sfx.pop(); buildToolbar(); },
    }));
    list.push({ icon: "✋", name: "Hold to center", key: "Space", hold: true, cls: "wide", down: () => { btnHold = true; }, up: () => { btnHold = false; } });
    return list;
  }
  if (s === "shape") {
    return [
      { icon: "⬆️", name: "Pull up", key: "W", hold: true, down: () => { pull = 1; }, up: () => { if (pull > 0) pull = 0; } },
      { icon: "⬇️", name: "Press down", key: "S", hold: true, down: () => { pull = -1; }, up: () => { if (pull < 0) pull = 0; } },
      { icon: "💧", name: "Water", key: "E", click: addWater },
      { icon: "↩️", name: "New clay", click: () => { const c = pot.clay; pot = newPot(); pot.clay = c; wet = 0.75; sfx.slump(); } },
      { icon: "✅", name: "Done!", key: "↵", cls: "go", click: () => { sfx.step(); goStep("glaze"); } },
    ];
  }
  if (s === "glaze") {
    const list = [{ icon: "🪣", name: "Dip", key: "Z", on: glazeTool === "dip", click: () => pickTool("dip") }];
    for (const [k, key] of [["stripe", "X"], ["dots", "C"], ["waves", "V"]]) {
      const name = PATTERNS[k].name;
      list.push({ icon: PATTERNS[k].icon, name: name[0].toUpperCase() + name.slice(1), key, on: glazeTool === k, click: () => pickTool(k) });
    }
    list.push(
      { icon: "➰", name: pot.handle ? "Remove handle" : "Handle", key: "H", on: pot.handle, click: toggleHandle },
      { icon: "🧽", name: "Wash off", click: () => { pot.base = null; pot.marks = []; sfx.clear(); } },
      { icon: "🔥", name: "Into the kiln!", key: "↵", cls: "go", click: () => { sfx.step(); goStep("fire"); } },
    );
    return list;
  }
  if (s === "fire") return [{ icon: "🔥", name: "Hold to heat", key: "Space", hold: true, cls: "wide", down: () => { btnHold = true; }, up: () => { btnHold = false; } }];
  return [];
}
function pickTool(k) { glazeTool = k; sfx.pop(); buildToolbar(); }
function pickColor(k) { glazeColor = k; sfx.pop(); buildToolbar(); }
function toggleHandle() { pot.handle = !pot.handle; sfx.pop(); buildToolbar(); }

let toastTimer = 0;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  toastTimer = 2.2;
}

// ---------- 17. the result, shop and win screens ----------
function showResult(info) {
  $("res-face").textContent = order ? PEOPLE[order.who].face : "🎨";
  const bars = $("res-bars"), tips = $("res-tips"), btns = $("res-buttons");
  bars.innerHTML = ""; tips.innerHTML = ""; btns.innerHTML = "";
  if (info.free) {
    $("res-title").innerHTML = "NICE <span>POT!</span>";
    $("res-say").textContent = "It's on your shelf now. You've made " + save.made + (save.made === 1 ? " pot!" : " pots!");
    $("res-stars").textContent = "";
    $("res-coins").textContent = "";
    addButton(btns, "🎨 Make another", () => startOrder(true));
    addButton(btns, "🏠 Title screen", () => setMode("title"), true);
  } else {
    const lines = info.isFinal
      ? ["Hmm… try again, please.", "Hmm, not quite royal enough.", "Splendid! You are a master!", "MAGNIFICENT! The finest vase in the land!"]
      : ["Oh no… this isn't what I asked for.", "Hmm, it's okay. Thank you!", "Lovely! I like it!", "PERFECT! You're amazing!"];
    $("res-title").innerHTML = info.passed ? "ORDER <span>DONE!</span>" : "TRY <span>AGAIN</span>";
    $("res-say").textContent = "“" + lines[info.stars] + "”";
    $("res-stars").textContent = "★".repeat(info.stars) + "☆".repeat(3 - info.stars);
    for (const [name, v] of [["Shape", info.sh], ["Glaze", info.gl], ["Firing", info.fs]]) {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `<span>${name}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div><b>${Math.round(v * 100)}%</b>`;
      bars.appendChild(row);
    }
    $("res-coins").textContent = info.coins ? `+🪙 ${info.coins} coins` : "";
    const list = info.tips.slice(0, 3);
    if (info.isFinal && !info.passed) list.unshift(`The Queen wants at least ${MASTER_STARS} stars ⭐⭐.`);
    for (const t of list) { const li = document.createElement("li"); li.textContent = t; tips.appendChild(li); }
    if (pendingWin) addButton(btns, "👑 Next", () => { pendingWin = false; setMode("win"); });
    else addButton(btns, info.passed ? "▶ Next order" : "🔁 Try again", () => startOrder(false));
    addButton(btns, "🛒 Shop", () => openShop("result"), true);
  }
  setMode("result");
}
function addButton(parent, text, fn, ghost) {
  const b = document.createElement("button");
  b.className = "big" + (ghost ? " ghost" : "");
  b.textContent = text;
  b.addEventListener("click", () => { ac(); fn(); });
  parent.appendChild(b);
}
// your finished pot spins on the result card
function drawResultPot() {
  const cv = $("result-pot"), r = window.devicePixelRatio || 1, w = 150, h = 170;
  if (cv.width !== w * r) { cv.width = w * r; cv.height = h * r; }
  const g = cv.getContext("2d");
  g.setTransform(r, 0, 0, r, 0, 0);
  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgba(60,20,5,0.25)";
  g.beginPath(); g.ellipse(w / 2, h - 14, 62, 10, 0, 0, TAU); g.fill();
  const s = Math.min(0.6, 62 / widest(pot), 145 / pot.h);
  drawPot(g, pot, w / 2 - (pot.handle ? 12 * s : 0), h - 14, s, { angle: spin });
}

let shopFrom = "title";
function openShop(from) {
  shopFrom = from;
  renderShop();
  setMode("shop");
}
function renderShop() {
  $("shop-coins").textContent = save.coins;
  const list = $("shop-list");
  list.innerHTML = "";
  for (const it of SHOP) {
    const have = !!save.owned[it.id];
    const el = document.createElement("div");
    el.className = "item" + (have ? " have" : "");
    const icon = it.kind === "glaze"
      ? `<span class="item-swatch" style="background:${rgb(GLAZES[it.id].rgb)}"></span>`
      : `<span class="item-icon">${it.icon}</span>`;
    el.innerHTML = `${icon}<div class="item-text"><b>${it.name}</b><small>${it.desc}</small></div>`;
    const b = document.createElement("button");
    b.className = "buy";
    b.textContent = have ? "✔ Yours" : "🪙 " + it.cost;
    b.disabled = have || save.coins < it.cost;
    b.addEventListener("click", () => {
      if (save.owned[it.id] || save.coins < it.cost) return;
      save.coins -= it.cost;
      save.owned[it.id] = true;
      saveGame();
      sfx.coin();
      renderShop();
    });
    el.appendChild(b);
    list.appendChild(el);
  }
  updateHud();
}
function closeShop() {
  if (shopFrom === "play") { updateOrderCard(); buildToolbar(); }
  setMode(shopFrom);
}

// ---------- 18. sound: little beeps made by the computer, plus a calm tune ----------
let audio = null, soundOn = true, loopsNode = null;
try { soundOn = localStorage.getItem(SAVE_KEY + "-sound") !== "off"; } catch (e) { /* fine */ }
function ac() {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (audio.state === "suspended") audio.resume();
  return audio;
}
function tone(freq, dur, type, vol, when, slide) {
  if (!soundOn) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (when || 0);
  const o = a.createOscillator(), gn = a.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
const sfx = {
  pop() { tone(700, 0.07, "sine", 0.1, 0, 1.4); },
  squish() { tone(rand(110, 160), 0.12, "sine", 0.06, 0, 0.6); },
  splash() { tone(500, 0.25, "sine", 0.12, 0, 0.4); tone(300, 0.2, "triangle", 0.08, 0.05, 0.5); },
  slump() { tone(260, 0.4, "triangle", 0.12, 0, 0.4); },
  crack() { tone(180, 0.1, "square", 0.08, 0, 0.5); tone(120, 0.15, "sawtooth", 0.06, 0.06, 0.5); },
  clear() { tone(220, 0.18, "sawtooth", 0.06, 0, 0.5); },
  step() { tone(392, 0.12, "triangle", 0.16); tone(523, 0.18, "triangle", 0.14, 0.08); },
  coin() { tone(988, 0.08, "square", 0.07); tone(1319, 0.2, "square", 0.07, 0.08); },
  reveal() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, "triangle", 0.15, i * 0.09)); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, "triangle", 0.16, i * 0.14)); },
};
// The wheel hums and the kiln roars. These two sounds never stop: we just turn them up and down.
function loops(hum, roar) {
  const a = audio;
  if (!a) return;
  if (!loopsNode) {
    const o = a.createOscillator(), lp = a.createBiquadFilter(), g1 = a.createGain();
    o.type = "sawtooth"; o.frequency.value = 62; lp.type = "lowpass"; lp.frequency.value = 240; g1.gain.value = 0;
    o.connect(lp).connect(g1).connect(a.destination); o.start();
    // "noise" is random numbers played as sound: it sounds like rushing air or fire
    const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = a.createBufferSource(), bp = a.createBiquadFilter(), g2 = a.createGain();
    n.buffer = buf; n.loop = true; bp.type = "bandpass"; bp.frequency.value = 400; g2.gain.value = 0;
    n.connect(bp).connect(g2).connect(a.destination); n.start();
    loopsNode = { o, g1, g2 };
  }
  const on = soundOn ? 1 : 0;
  loopsNode.g1.gain.setTargetAtTime(hum * 0.035 * on, a.currentTime, 0.1);
  loopsNode.o.frequency.setTargetAtTime(50 + hum * 20, a.currentTime, 0.1);
  loopsNode.g2.gain.setTargetAtTime(roar * 0.12 * on, a.currentTime, 0.1);
}
// The tune wanders up and down a "pentatonic" scale: 5 notes that always sound nice together.
const SCALE = [0, 2, 4, 7, 9];
let musicT = 0, musicStep = 0, musicNote = 5;
function music(dt) {
  musicT -= dt;
  if (musicT > 0) return;
  musicT = 0.42;
  musicStep++;
  const base = 247;
  if (musicStep % 8 === 0) tone(base / 2 * Math.pow(2, SCALE[(musicStep / 8) % 2 ? 3 : 0] / 12), 1.4, "sine", 0.045);
  if (Math.random() < 0.5) {
    musicNote = clamp(musicNote + Math.floor(rand(-2, 3)), 0, 9);
    tone(base * Math.pow(2, (SCALE[musicNote % 5] + 12 * Math.floor(musicNote / 5)) / 12), 0.4, "triangle", 0.03);
  }
}
function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem(SAVE_KEY + "-sound", soundOn ? "on" : "off"); } catch (e) { /* fine */ }
  $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
  toast(soundOn ? "Sound on 🔊" : "Sound off 🔇");
}

// ---------- 19. mouse, touch and keyboard ----------
const toStage = e => ({ x: (e.clientX - ox) / S, y: (e.clientY - oy) / S });
canvas.addEventListener("pointerdown", e => {
  ac();
  if (mode !== "play") return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  Object.assign(pointer, toStage(e), { down: true });
  if (step === "glaze") glazeAt(pointer.x, pointer.y);
});
canvas.addEventListener("pointermove", e => Object.assign(pointer, toStage(e)));
const pointerUp = () => { pointer.down = false; };
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
canvas.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("keydown", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "Escape" || k === "p") {
    if (mode === "play") setMode("pause");
    else if (mode === "pause") setMode("play");
    else if (mode === "shop") closeShop();
    return;
  }
  if (k === "m") { toggleSound(); return; }
  if (mode !== "play") return;
  if (k === " ") { keyHold = true; e.preventDefault(); return; }
  if (step === "shape") {
    if (k === "w" || k === "ArrowUp") { pull = 1; e.preventDefault(); }
    if (k === "s" || k === "ArrowDown") { pull = -1; e.preventDefault(); }
    if (k === "e" && !e.repeat) addWater();
    if (k === "Enter") { sfx.step(); goStep("glaze"); }
  } else if (step === "glaze") {
    const colors = Object.keys(GLAZES).filter(owns);
    if (/^[0-9]$/.test(k) && colors[(Number(k) + 9) % 10]) pickColor(colors[(Number(k) + 9) % 10]);
    const tool = { z: "dip", x: "stripe", c: "dots", v: "waves" }[k];
    if (tool) pickTool(tool);
    if (k === "h") toggleHandle();
    if (k === "Enter") { sfx.step(); goStep("fire"); }
  }
});
window.addEventListener("keyup", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === " ") keyHold = false;
  if ((k === "w" || k === "ArrowUp") && pull > 0) pull = 0;
  if ((k === "s" || k === "ArrowDown") && pull < 0) pull = 0;
});
window.addEventListener("blur", () => { keyHold = false; btnHold = false; pull = 0; pointer.down = false; });

// ---------- 20. screens and buttons ----------
const SCREENS = { title: "title-screen", pause: "pause-screen", result: "result-screen", shop: "shop-screen", win: "win-screen" };
function setMode(m) {
  mode = m;
  for (const k in SCREENS) $(SCREENS[k]).classList.toggle("hidden", k !== m);
  document.body.classList.toggle("in-menu", m === "title");
  if (m === "title") refreshTitle();
  if (m === "win") {
    sfx.win();
    $("win-text").textContent = `You made ${save.made} pots and earned ${totalStars()} stars. Queen Luna names you a Pottery Master! Customers will keep coming, so keep making pots.`;
  }
  if (m !== "play") { pointer.down = false; keyHold = false; btnHold = false; pull = 0; }
  updateHud();
}
function refreshTitle() {
  const started = save.level > 0 || save.made > 0;
  $("btn-play").textContent = started ? "▶ Next order" : "▶ Start";
  $("btn-reset").classList.toggle("hidden", !started);
  $("title-progress").textContent = !started ? "" :
    (save.master ? "👑 Pottery Master · " : "") +
    (save.level < LEVELS.length ? `Order ${save.level + 1}/${LEVELS.length}` : `Order ${save.level + 1}`) +
    ` · ⭐ ${totalStars()} · 🪙 ${save.coins}`;
}
$("btn-play").addEventListener("click", () => { ac(); startOrder(false); });
$("btn-free").addEventListener("click", () => { ac(); startOrder(true); });
$("btn-title-shop").addEventListener("click", () => { ac(); openShop("title"); });
$("btn-reset").addEventListener("click", () => {
  if (!confirm("Start over? Your coins, stars and pots will be gone.")) return;
  save = freshSave();
  saveGame();
  refreshTitle();
});
$("btn-resume").addEventListener("click", () => setMode("play"));
$("btn-pause-title").addEventListener("click", () => setMode("title"));
$("btn-pause").addEventListener("click", () => setMode("pause"));
$("btn-sound").addEventListener("click", toggleSound);
$("btn-shop").addEventListener("click", () => { if (mode === "play") openShop("play"); });
$("btn-shop-close").addEventListener("click", closeShop);
$("btn-win-keep").addEventListener("click", () => startOrder(false));
$("btn-win-title").addEventListener("click", () => setMode("title"));

// ---------- 21. go! ----------
function resize() {
  dpr = window.devicePixelRatio || 1;
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  // the middle 600 of the 720 stage must fit, so on a narrow phone the shelves go off the edges
  S = Math.min(cw / 600, ch / STAGE_H);
  ox = (cw - STAGE_W * S) / 2;
  // on a tall phone, slide the studio down so the wheel sits just above the toolbar
  oy = Math.max((ch - STAGE_H * S) / 2, ch - 130 - (FLOOR_Y + 60) * S);
}
window.addEventListener("resize", resize);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const playing = mode === "play";
  // how fast the wheel should spin right now
  const want = mode === "title" || !pot ? 1.2 : step === "center" || step === "shape" ? 10 : step === "glaze" ? 1.6 : step === "fire" ? 0 : 0.9;
  spinSpeed = lerp(spinSpeed, want, Math.min(1, dt * 3));
  spin += spinSpeed * dt;
  if (playing) {
    if (step === "center") updateCenter(dt);
    else if (step === "shape") updateShape(dt);
    else if (step === "fire") updateFire(dt);
    else if (step === "reveal") updateReveal(dt);
    music(dt);
  }
  updateParts(dt);
  loops(playing && (step === "center" || step === "shape") ? spinSpeed / 10 : 0,
    playing && step === "fire" ? 0.2 + fire.T * (fire.heating ? 1 : 0.5) : 0);
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $("toast").classList.remove("show"); }
  draw();
  if (mode === "result" && pot) drawResultPot();
  requestAnimationFrame(frame);
}

resize();
loadGame();
$("btn-sound").textContent = soundOn ? "🔊" : "🔇";
setMode("title");
requestAnimationFrame(frame);
