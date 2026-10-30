// Paperland: a world cut out of paper that you can dig, build and craft in.
// Everything runs in the browser: no server, no downloads, so it works on GitHub Pages.
"use strict";

const W = 960;
const H = 560;
const T = 24;                 // pixels per tile
const WW = 240;               // world width in tiles
const WH = 90;                // world height in tiles
const GRAV = 32;              // tiles per second per second
const JUMP = 11.2;            // enough to hop up one block
const WALK = 5.5;             // tiles per second
const MAX_FALL = 24;
const REACH = 5;              // how far away you can dig and build, in tiles
const HIT_REACH = 3.5;        // how far away you can bop an Ink Blot
const DAY_LENGTH = 300;       // seconds for a whole day and night
const MAX_HP = 20;            // counted in half-hearts
const MAX_BLOTS = 7;
const STACK = 99;
const SAVE_KEY = "paperland-save";
const INK = "#2e2418";
const EDGE = "#fffaf0";       // the white rim around every cut-out

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// a random number maker that always gives the same numbers for the same seed, so a world can be rebuilt
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth random hills: a random value at each whole number, blended in between
function hash2(i, j, s) {
  let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = lerp(hash2(i, j, s), hash2(i + 1, j, s), u);
  const b = lerp(hash2(i, j + 1, s), hash2(i + 1, j + 1, s), u);
  return lerp(a, b, v);
}
const noise1 = (x, s) => noise2(x, 0.5, s);

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (k) => clamp(Math.round(((n >> k) & 255) * f), 0, 255);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------- blocks and items ----------

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7, COAL: 8, IRON: 9,
  GOLD: 10, CRYSTAL: 11, BEDROCK: 12, BENCH: 13, FURNACE: 14, TORCH: 15, GLASS: 16, BRICKS: 17,
};

// hard = seconds to dig by hand, tier = pickaxe needed (1 wood, 2 stone, 3 iron),
// rocky = pickaxes dig it faster, see = light shines through, glow = light it gives off
const BLOCKS = [];
function block(id, o) {
  BLOCKS[id] = Object.assign({ id, hard: 1, tier: 0, rocky: false, solid: true, see: false, glow: 0, drop: id }, o);
}
block(B.AIR,     { name: "Air", color: "#000000", solid: false, see: true, drop: null });
block(B.GRASS,   { name: "Grass", color: "#8a5a36", hard: 0.6, drop: B.DIRT });
block(B.DIRT,    { name: "Dirt", color: "#8a5a36", hard: 0.5 });
block(B.STONE,   { name: "Stone", color: "#9a968f", hard: 2.4, tier: 1, rocky: true });
block(B.SAND,    { name: "Sand", color: "#e8cf8a", hard: 0.5 });
block(B.LOG,     { name: "Log", color: "#8b5a2b", hard: 1.5 });
block(B.LEAVES,  { name: "Leaves", color: "#3f8a3a", hard: 0.25, see: true, drop: null });
block(B.PLANKS,  { name: "Planks", color: "#c99a5e", hard: 1.2 });
block(B.COAL,    { name: "Coal Ore", color: "#9a968f", hard: 2.8, tier: 1, rocky: true, drop: 101 });
block(B.IRON,    { name: "Iron Ore", color: "#9a968f", hard: 3.4, tier: 2, rocky: true, drop: 106 });
block(B.GOLD,    { name: "Gold Ore", color: "#8c8880", hard: 3.8, tier: 3, rocky: true, drop: 107 });
block(B.CRYSTAL, { name: "Crystal Ore", color: "#5d5866", hard: 4.2, tier: 3, rocky: true, glow: 7, drop: 104 });
block(B.BEDROCK, { name: "Bedrock", color: "#3a3540", hard: Infinity, tier: 99 });
block(B.BENCH,   { name: "Workbench", color: "#c99a5e", hard: 1.2 });
block(B.FURNACE, { name: "Furnace", color: "#8d8a84", hard: 2.4, tier: 1, rocky: true, glow: 9 });
block(B.TORCH,   { name: "Torch", color: "#8b5a2b", hard: 0.05, solid: false, see: true, glow: 14 });
block(B.GLASS,   { name: "Glass", color: "#cfeeff", hard: 0.4, see: true });
block(B.BRICKS,  { name: "Stone Bricks", color: "#a8a49c", hard: 2.6, tier: 1, rocky: true });

const I = {
  STICK: 100, COAL: 101, IRON_BAR: 102, GOLD_BAR: 103, GEM: 104, INK: 105, RAW_IRON: 106, RAW_GOLD: 107,
  APPLE: 108, WOOD_PICK: 110, STONE_PICK: 111, IRON_PICK: 112, WOOD_SWORD: 120, STONE_SWORD: 121,
  IRON_SWORD: 122, QUILL: 130,
};
const ITEMS = {
  [I.STICK]: { name: "Stick" },
  [I.COAL]: { name: "Coal" },
  [I.IRON_BAR]: { name: "Iron Bar" },
  [I.GOLD_BAR]: { name: "Gold Bar" },
  [I.GEM]: { name: "Crystal" },
  [I.INK]: { name: "Ink" },
  [I.RAW_IRON]: { name: "Raw Iron" },
  [I.RAW_GOLD]: { name: "Raw Gold" },
  [I.APPLE]: { name: "Apple", food: 6 },
  [I.WOOD_PICK]: { name: "Wooden Pickaxe", tool: true, pick: { tier: 1, speed: 2 } },
  [I.STONE_PICK]: { name: "Stone Pickaxe", tool: true, pick: { tier: 2, speed: 3.2 } },
  [I.IRON_PICK]: { name: "Iron Pickaxe", tool: true, pick: { tier: 3, speed: 5 } },
  [I.WOOD_SWORD]: { name: "Wooden Sword", tool: true, dmg: 3 },
  [I.STONE_SWORD]: { name: "Stone Sword", tool: true, dmg: 4 },
  [I.IRON_SWORD]: { name: "Iron Sword", tool: true, dmg: 6 },
  [I.QUILL]: { name: "Golden Quill", tool: true },
};
const itemName = (id) => (id < 100 ? BLOCKS[id].name : ITEMS[id].name);
const stackable = (id) => !(ITEMS[id] && ITEMS[id].tool);
const TIER_PICK = { 1: "Wooden Pickaxe", 2: "Stone Pickaxe", 3: "Iron Pickaxe" };

// at = the block you have to stand near to craft it
const RECIPES = [
  { out: B.PLANKS, n: 4, need: [[B.LOG, 1]] },
  { out: I.STICK, n: 4, need: [[B.PLANKS, 2]] },
  { out: B.BENCH, n: 1, need: [[B.PLANKS, 4]] },
  { out: B.TORCH, n: 4, need: [[I.STICK, 1], [I.COAL, 1]] },
  { out: I.WOOD_PICK, n: 1, need: [[B.PLANKS, 3], [I.STICK, 2]], at: B.BENCH },
  { out: I.WOOD_SWORD, n: 1, need: [[B.PLANKS, 2], [I.STICK, 1]], at: B.BENCH },
  { out: I.STONE_PICK, n: 1, need: [[B.STONE, 3], [I.STICK, 2]], at: B.BENCH },
  { out: I.STONE_SWORD, n: 1, need: [[B.STONE, 2], [I.STICK, 1]], at: B.BENCH },
  { out: B.FURNACE, n: 1, need: [[B.STONE, 8]], at: B.BENCH },
  { out: B.BRICKS, n: 4, need: [[B.STONE, 4]], at: B.BENCH },
  { out: I.IRON_BAR, n: 1, need: [[I.RAW_IRON, 1], [I.COAL, 1]], at: B.FURNACE },
  { out: I.GOLD_BAR, n: 1, need: [[I.RAW_GOLD, 1], [I.COAL, 1]], at: B.FURNACE },
  { out: B.GLASS, n: 2, need: [[B.SAND, 2], [I.COAL, 1]], at: B.FURNACE },
  { out: I.IRON_PICK, n: 1, need: [[I.IRON_BAR, 3], [I.STICK, 2]], at: B.BENCH },
  { out: I.IRON_SWORD, n: 1, need: [[I.IRON_BAR, 2], [I.STICK, 1]], at: B.BENCH },
  { out: I.QUILL, n: 1, need: [[I.GOLD_BAR, 3], [I.GEM, 1], [I.INK, 5]], at: B.BENCH },
];

// ---------- the world ----------

let seed = 1;
let world = new Uint8Array(WW * WH);
let surf = new Int16Array(WW);      // where the ground started when the world was made
let skyL = new Uint8Array(WW * WH); // sunlight, 0 to 15
let blkL = new Uint8Array(WW * WH); // torch light, 0 to 15
let lightDirty = true;

const tileAt = (x, y) => (x < 0 || x >= WW || y >= WH ? B.BEDROCK : y < 0 ? B.AIR : world[y * WW + x]);
const solidAt = (x, y) => BLOCKS[tileAt(x, y)].solid;
function setTile(x, y, id) {
  world[y * WW + x] = id;
  lightDirty = true;
}

function surfaceHeights(s) {
  for (let x = 0; x < WW; x++) {
    surf[x] = Math.round(30 + (noise1(x / 26, s) - 0.5) * 16 + (noise1(x / 7, s + 1) - 0.5) * 4);
  }
}

function generate(s) {
  seed = s;
  const r = mulberry32(s);
  surfaceHeights(s);
  world.fill(B.AIR);
  for (let x = 0; x < WW; x++) {
    const desert = noise1(x / 45, s + 2) > 0.66;
    const dirtDepth = 3 + Math.floor(noise1(x / 5, s + 3) * 3);
    for (let y = surf[x]; y < WH; y++) {
      let id;
      if (y === surf[x]) id = desert ? B.SAND : B.GRASS;
      else if (y <= surf[x] + dirtDepth) id = desert ? B.SAND : B.DIRT;
      else id = B.STONE;
      // caves: wiggly holes, more of them deeper down
      if (y > surf[x] + 6 && y < WH - 2) {
        const v = noise2(x / 11, y / 7, s + 4) * 0.65 + noise2(x / 4, y / 4, s + 5) * 0.35;
        if (v > 0.68 - Math.min(0.06, (y - 40) * 0.002)) id = B.AIR;
      }
      world[y * WW + x] = id;
    }
  }
  // ores grow as little blobs inside stone
  const vein = (id, count, minY, size) => {
    for (let k = 0; k < count; k++) {
      let x = Math.floor(r() * WW), y = minY + Math.floor(r() * (WH - 2 - minY));
      const n = size[0] + Math.floor(r() * (size[1] - size[0] + 1));
      for (let i = 0; i < n; i++) {
        if (x >= 0 && x < WW && y > 0 && y < WH - 1 && world[y * WW + x] === B.STONE && y > surf[x] + 3) world[y * WW + x] = id;
        x += Math.floor(r() * 3) - 1; y += Math.floor(r() * 3) - 1;
      }
    }
  };
  vein(B.COAL, 170, 24, [4, 8]);
  vein(B.IRON, 110, 42, [3, 6]);
  vein(B.GOLD, 60, 58, [2, 5]);
  vein(B.CRYSTAL, 34, 74, [1, 3]);
  for (let x = 0; x < WW; x++) {
    world[(WH - 1) * WW + x] = B.BEDROCK;
    if (r() < 0.5) world[(WH - 2) * WW + x] = B.BEDROCK;
  }
  // trees on the grass, but not right where you start
  let last = -9;
  for (let x = 3; x < WW - 3; x++) {
    if (Math.abs(x - WW / 2) < 4 || x - last < 4) continue;
    if (world[surf[x] * WW + x] !== B.GRASS || r() > 0.16) continue;
    last = x;
    const h = 4 + Math.floor(r() * 3), top = surf[x] - h;
    for (let y = surf[x] - 1; y >= top; y--) world[y * WW + x] = B.LOG;
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 3 || (dy === 1 && Math.abs(dx) > 1)) continue;
        const i = (top + dy) * WW + x + dx;
        if (world[i] === B.AIR) world[i] = B.LEAVES;
      }
    }
  }
  lightDirty = true;
}

// sunlight falls straight down until something stops it, then spreads out into caves.
// torches spread their light the same way.
const lightQ = new Int32Array(WW * WH * 2);
function spread(L) {
  let head = 0, tail = 0;
  for (let i = 0; i < L.length; i++) if (L[i] > 1) lightQ[tail++] = i;
  while (head < tail) {
    const i = lightQ[head++], v = L[i];
    const x = i % WW;
    const next = [x > 0 ? i - 1 : -1, x < WW - 1 ? i + 1 : -1, i - WW, i + WW];
    for (const j of next) {
      if (j < 0 || j >= L.length) continue;
      const see = BLOCKS[world[j]].see;
      const nv = v - (see ? 1 : 3);
      if (nv > L[j]) {
        L[j] = nv;
        if (see && nv > 1) lightQ[tail++] = j;
      }
    }
  }
}
function computeLight() {
  skyL.fill(0);
  blkL.fill(0);
  for (let x = 0; x < WW; x++) {
    for (let y = 0; y < WH; y++) {
      const b = BLOCKS[world[y * WW + x]];
      if (!b.see) break;
      skyL[y * WW + x] = b.id === B.LEAVES ? 12 : 15;
    }
  }
  for (let i = 0; i < world.length; i++) {
    const g = BLOCKS[world[i]].glow;
    if (g) blkL[i] = g;
  }
  spread(skyL);
  spread(blkL);
  lightDirty = false;
}

// how bright the sun is: 1 at midday, 0.3 at night
function daylight() {
  const t = time;
  if (t < 0.05) return lerp(0.55, 1, t / 0.05);
  if (t < 0.55) return 1;
  if (t < 0.62) return lerp(1, 0.3, (t - 0.55) / 0.07);
  if (t < 0.95) return 0.3;
  return lerp(0.3, 0.55, (t - 0.95) / 0.05);
}
const isNight = () => time > 0.6 && time < 0.97;

// ---------- the player, Ink Blots and your bag ----------

let player, mobs = [], parts = [], pops = [];
let inv = new Array(27).fill(null);
let sel = 0;
let time = 0.05, day = 1;
let spawn = { x: WW / 2 + 0.5, y: 20 };
let got = {};        // every item you have ever had, for the goal list
let won = false;
let mode = "title";  // title, play, bag, dead, win
let cam = { x: 0, y: 0 };
let dig = { x: -1, y: -1, prog: 0 };
let attackCD = 0, placeCD = 0, swing = 0, hintCD = 0, saveCD = 15, spawnCD = 2, regenCD = 0, digSound = 0;
let toast = { text: "", life: 0 };

function newPlayer(x, y) {
  return { x, y, vx: 0, vy: 0, w: 0.7, h: 1.75, hp: MAX_HP, face: 1, onGround: false, peak: y, inv: 0, kb: 0, walk: 0, hurtAgo: 99 };
}

function count(id) {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}
function give(id, n = 1) {
  got[id] = true;
  while (n > 0) {
    let s = stackable(id) && inv.find((s) => s && s.id === id && s.n < STACK);
    if (!s) {
      const k = inv.indexOf(null);
      if (k < 0) { say("Your bag is full!"); return; }
      s = inv[k] = { id, n: 0 };
    }
    const add = stackable(id) ? Math.min(n, STACK - s.n) : 1;
    s.n += add;
    n -= add;
  }
  updateQuest();
}
function take(id, n) {
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i];
    if (!s || s.id !== id) continue;
    const k = Math.min(n, s.n);
    s.n -= k; n -= k;
    if (s.n === 0) inv[i] = null;
  }
}
const held = () => (inv[sel] ? inv[sel].id : null);
function bestPick() {
  let best = { tier: 0, speed: 1 };
  for (const s of inv) {
    const p = s && ITEMS[s.id] && ITEMS[s.id].pick;
    if (p && p.tier > best.tier) best = p;
  }
  return best;
}
function swordDamage() {
  const it = ITEMS[held()];
  return it && it.dmg ? it.dmg : 1;
}

function say(text) {
  toast = { text, life: 2.5 };
}
function pop(x, y, text, color = "#fff") {
  pops.push({ x, y, text, color, life: 1.1 });
}

function stationNear(id) {
  const px = Math.floor(player.x), py = Math.floor(player.y - 1);
  for (let y = py - 4; y <= py + 4; y++) {
    for (let x = px - 4; x <= px + 4; x++) if (tileAt(x, y) === id) return true;
  }
  return false;
}
const canCraft = (r) => (!r.at || stationNear(r.at)) && r.need.every(([id, n]) => count(id) >= n);

function craft(r) {
  if (!canCraft(r)) return;
  for (const [id, n] of r.need) take(id, n);
  give(r.out, r.n);
  tone(523, 0.08, "triangle", 0.1);
  tone(784, 0.14, "triangle", 0.1, null, 0.07);
  if (r.out === I.QUILL && !won) {
    won = true;
    showWin();
  }
}

// ---------- the goal list ----------

const QUEST = [
  { text: "Hold the mouse on a tree trunk to collect a Log.", done: () => got[B.LOG] },
  { text: "Press E, turn your logs into planks, then craft a Workbench.", done: () => got[B.BENCH] },
  { text: "Put the Workbench down, stand next to it and craft a Wooden Pickaxe.", done: () => got[I.WOOD_PICK] },
  { text: "Dig down to grey stone and craft a Stone Pickaxe.", done: () => got[I.STONE_PICK] },
  { text: "Craft a Furnace from 8 stone. Coal + sticks make torches!", done: () => got[B.FURNACE] },
  { text: "Find Iron Ore (deeper down), smelt 3 Iron Bars and craft an Iron Pickaxe.", done: () => got[I.IRON_PICK] },
  { text: "Dig deep for Gold Ore and smelt 3 Gold Bars.", done: () => got[I.QUILL] || count(I.GOLD_BAR) >= 3 },
  { text: "Find a glowing Crystal near the very bottom of the world.", done: () => got[I.QUILL] || got[I.GEM] },
  { text: "Bop Ink Blots at night and collect 5 Ink.", done: () => got[I.QUILL] || count(I.INK) >= 5 },
  { text: "Craft the Golden Quill at a Workbench!", done: () => got[I.QUILL] },
];
let questShown = -2;
function updateQuest() {
  const k = QUEST.findIndex((q) => !q.done());
  if (k === questShown) return;
  if (questShown >= 0 && k !== 0 && mode === "play") {
    tone(660, 0.1, "sine", 0.1);
    tone(990, 0.2, "sine", 0.1, null, 0.1);
    say("Goal done! ✨");
  }
  questShown = k;
  $("quest").innerHTML = k < 0
    ? "<em>🏆 You did it!</em> The Golden Quill is yours. Keep building your paper world!"
    : `<em>Goal ${k + 1} of ${QUEST.length}:</em> ${QUEST[k].text}`;
}

// ---------- pictures ----------

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// plain paper with fibres, a light top edge and a dark bottom edge, so each block looks cut out
function paper(c, col, r) {
  c.fillStyle = col;
  c.fillRect(0, 0, T, T);
  for (let i = 0; i < 16; i++) {
    c.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
    c.fillRect(Math.floor(r() * T), Math.floor(r() * T), 1 + Math.floor(r() * 3), 1);
  }
  c.fillStyle = "rgba(255,255,255,0.25)";
  c.fillRect(0, 0, T, 2); c.fillRect(0, 0, 2, T);
  c.fillStyle = "rgba(0,0,0,0.16)";
  c.fillRect(0, T - 2, T, 2); c.fillRect(T - 2, 0, 2, T);
}
function confetti(c, r, col, n, size) {
  for (let k = 0; k < n; k++) {
    const x = 4 + r() * 15, y = 4 + r() * 15, s = size + r() * 1.5;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r();
      c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    }
    c.closePath();
    c.strokeStyle = "rgba(255,250,240,0.7)"; c.lineWidth = 1; c.stroke();
    c.fillStyle = col; c.fill();
  }
}

function paintBlock(c, id, v, r) {
  const b = BLOCKS[id];
  const base = shade(b.color, 1 + (v - 1) * 0.05);
  switch (id) {
    case B.GRASS: {
      paper(c, base, r);
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(T, 0); c.lineTo(T, 6);
      for (let x = T; x >= 0; x -= 4) c.lineTo(x, x % 8 === 0 ? 6 : 9);
      c.closePath();
      c.fillStyle = "#6fbf4f"; c.fill();
      c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(0, 0, T, 2);
      break;
    }
    case B.DIRT: case B.SAND: case B.BEDROCK: {
      paper(c, base, r);
      const dot = id === B.DIRT ? "#6d4428" : id === B.SAND ? "#cfb06a" : "#26222b";
      for (let i = 0; i < 6; i++) {
        c.fillStyle = dot;
        c.beginPath(); c.arc(3 + r() * 18, 3 + r() * 18, 1 + r() * (id === B.BEDROCK ? 4 : 1.5), 0, 7); c.fill();
      }
      break;
    }
    case B.STONE: {
      paper(c, base, r);
      c.strokeStyle = "rgba(60,55,50,0.35)"; c.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        c.beginPath(); let x = 3 + r() * 16, y = 3 + r() * 16; c.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += r() * 6 - 3; y += r() * 6 - 1; c.lineTo(x, y); }
        c.stroke();
      }
      break;
    }
    case B.COAL: paper(c, base, r); confetti(c, r, "#2b2a2e", 4, 2.5); break;
    case B.IRON: paper(c, base, r); confetti(c, r, "#e0a27a", 4, 2.5); break;
    case B.GOLD: paper(c, base, r); confetti(c, r, "#ffcc33", 4, 2.5); break;
    case B.CRYSTAL: {
      paper(c, base, r);
      for (let k = 0; k < 3; k++) {
        const x = 5 + r() * 14, y = 5 + r() * 14;
        c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 3, y); c.lineTo(x, y + 5); c.lineTo(x - 3, y); c.closePath();
        c.strokeStyle = EDGE; c.lineWidth = 1; c.stroke();
        c.fillStyle = k % 2 ? "#c58bff" : "#7fe3ff"; c.fill();
      }
      break;
    }
    case B.LOG: {
      paper(c, base, r);
      c.fillStyle = "rgba(60,35,15,0.45)";
      for (const x of [5, 11, 17]) c.fillRect(x + (r() < 0.5 ? 0 : 1), 0, 2, T);
      break;
    }
    case B.LEAVES: {
      c.fillStyle = base; c.fillRect(0, 0, T, T);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i < 5 ? "#58a84a" : "#2f6e2c";
        c.beginPath(); c.arc(r() * T, r() * T, 3 + r() * 3, 0, 7); c.fill();
      }
      c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(0, T - 2, T, 2);
      break;
    }
    case B.PLANKS: {
      paper(c, base, r);
      c.fillStyle = "rgba(90,55,25,0.45)";
      c.fillRect(0, 7, T, 1.5); c.fillRect(0, 15, T, 1.5);
      c.fillRect(8 + r() * 4, 0, 1.5, 7); c.fillRect(14 + r() * 4, 8, 1.5, 7); c.fillRect(4 + r() * 4, 16, 1.5, 8);
      break;
    }
    case B.BENCH: {
      c.clearRect(0, 0, T, T);
      c.fillStyle = "#8b5a2b"; c.fillRect(3, 8, 4, 16); c.fillRect(17, 8, 4, 16);
      c.fillStyle = "#c99a5e"; c.fillRect(0, 3, T, 7);
      c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(0, 3, T, 2);
      c.fillStyle = "#b8b8c0"; c.fillRect(6, 0, 9, 3);   // a little saw on top
      c.fillStyle = "#8b5a2b"; c.fillRect(15, 0, 4, 3);
      break;
    }
    case B.FURNACE: {
      paper(c, base, r);
      c.fillStyle = "rgba(50,45,40,0.35)";
      c.fillRect(0, 7, T, 1); c.fillRect(0, 15, T, 1);
      c.fillStyle = "#2a2522"; c.fillRect(6, 10, 12, 10);
      c.fillStyle = "#ff8a2b"; c.fillRect(7, 16, 10, 4);
      c.fillStyle = "#ffd25a"; c.fillRect(9, 17, 6, 3);
      break;
    }
    case B.TORCH: {
      c.clearRect(0, 0, T, T);
      c.fillStyle = "#8b5a2b"; c.fillRect(10, 10, 4, 14);
      break;
    }
    case B.GLASS: {
      c.fillStyle = "rgba(200,235,255,0.35)"; c.fillRect(0, 0, T, T);
      c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 2; c.strokeRect(1, 1, T - 2, T - 2);
      c.beginPath(); c.moveTo(5, 12); c.lineTo(12, 5); c.moveTo(8, 17); c.lineTo(17, 8); c.lineWidth = 1.5; c.stroke();
      break;
    }
    case B.BRICKS: {
      paper(c, base, r);
      c.fillStyle = "rgba(60,55,50,0.4)";
      c.fillRect(0, 11, T, 1.5); c.fillRect(0, 23, T, 1);
      c.fillRect(11, 0, 1.5, 11); c.fillRect(5, 12, 1.5, 11); c.fillRect(18, 12, 1.5, 11);
      break;
    }
  }
}

const tex = [];
let wallTex = [];
function buildTextures() {
  for (let id = 1; id < BLOCKS.length; id++) {
    tex[id] = [0, 1, 2].map((v) => {
      const cv = makeCanvas(T, T);
      paintBlock(cv.getContext("2d"), id, v, mulberry32(id * 97 + v * 13 + 5));
      return cv;
    });
  }
  // the darker paper behind caves and tunnels
  wallTex = [0, 1, 2].map((v) => {
    const cv = makeCanvas(T, T), c = cv.getContext("2d");
    paper(c, shade("#5e4a3a", 1 + (v - 1) * 0.05), mulberry32(500 + v));
    return cv;
  });
}

// item pictures are drawn on a 24 by 24 grid: white rim first, then the colour on top
function cut(c, fill, path) {
  c.beginPath(); path();
  c.strokeStyle = EDGE; c.lineWidth = 3; c.stroke();
  c.fillStyle = fill; c.fill();
}
function rotated(c, angle, fn) {
  c.save(); c.translate(12, 12); c.rotate(angle); fn(); c.restore();
}
function paintItem(c, id) {
  c.lineJoin = "round"; c.lineCap = "round";
  const stick = () => cut(c, "#8b5a2b", () => c.rect(-1.8, -9, 3.6, 19));
  switch (id) {
    case I.STICK: rotated(c, Math.PI / 4, stick); break;
    case I.COAL:
      cut(c, "#2b2a2e", () => { c.moveTo(5, 13); c.lineTo(9, 6); c.lineTo(16, 5); c.lineTo(20, 11); c.lineTo(17, 19); c.lineTo(8, 19); c.closePath(); });
      c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(9, 8, 4, 2);
      break;
    case I.RAW_IRON: case I.RAW_GOLD:
      cut(c, "#9a968f", () => { c.moveTo(5, 14); c.lineTo(8, 6); c.lineTo(16, 5); c.lineTo(20, 12); c.lineTo(16, 20); c.lineTo(8, 19); c.closePath(); });
      c.fillStyle = id === I.RAW_IRON ? "#e0a27a" : "#ffcc33";
      for (const [x, y] of [[10, 9], [15, 13], [9, 15]]) { c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); }
      break;
    case I.IRON_BAR: case I.GOLD_BAR:
      cut(c, id === I.IRON_BAR ? "#d5d8de" : "#ffcc33", () => { c.moveTo(3, 18); c.lineTo(7, 9); c.lineTo(17, 9); c.lineTo(21, 18); c.closePath(); });
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(8, 11, 8, 2);
      break;
    case I.GEM:
      cut(c, "#7fe3ff", () => { c.moveTo(12, 3); c.lineTo(20, 10); c.lineTo(12, 21); c.lineTo(4, 10); c.closePath(); });
      c.fillStyle = "#c58bff"; c.beginPath(); c.moveTo(12, 3); c.lineTo(20, 10); c.lineTo(12, 10); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.moveTo(4, 10); c.lineTo(12, 10); c.lineTo(12, 21); c.closePath(); c.fill();
      break;
    case I.INK:
      cut(c, "#1c1a2b", () => {
        c.moveTo(12, 3); c.bezierCurveTo(16, 9, 19, 12, 19, 15.5); c.bezierCurveTo(19, 19.5, 15.5, 22, 12, 22);
        c.bezierCurveTo(8.5, 22, 5, 19.5, 5, 15.5); c.bezierCurveTo(5, 12, 8, 9, 12, 3);
      });
      c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.arc(9.5, 15, 1.8, 0, 7); c.fill();
      break;
    case I.APPLE:
      cut(c, "#e23b3b", () => c.arc(12, 14, 7.5, 0, 7));
      c.fillStyle = "#6b4226"; c.fillRect(11, 3, 2, 5);
      c.fillStyle = "#5cb04a"; c.beginPath(); c.ellipse(16, 5, 3.5, 1.8, -0.5, 0, 7); c.fill();
      c.fillStyle = "rgba(255,255,255,0.45)"; c.beginPath(); c.arc(9, 11, 2, 0, 7); c.fill();
      break;
    case I.WOOD_PICK: case I.STONE_PICK: case I.IRON_PICK: {
      const col = { [I.WOOD_PICK]: "#c99a5e", [I.STONE_PICK]: "#9a968f", [I.IRON_PICK]: "#e3e6ec" }[id];
      rotated(c, Math.PI / 4, () => {
        stick();
        cut(c, col, () => { c.moveTo(-10, -4); c.quadraticCurveTo(0, -15, 10, -4); c.quadraticCurveTo(0, -9, -10, -4); c.closePath(); });
      });
      break;
    }
    case I.WOOD_SWORD: case I.STONE_SWORD: case I.IRON_SWORD: {
      const col = { [I.WOOD_SWORD]: "#c99a5e", [I.STONE_SWORD]: "#9a968f", [I.IRON_SWORD]: "#e3e6ec" }[id];
      rotated(c, Math.PI / 4, () => {
        cut(c, col, () => { c.moveTo(-2.6, 3); c.lineTo(-2.6, -8); c.lineTo(0, -11.5); c.lineTo(2.6, -8); c.lineTo(2.6, 3); c.closePath(); });
        cut(c, "#8b5a2b", () => c.rect(-1.6, 5, 3.2, 6));
        cut(c, "#4a3b28", () => c.rect(-6, 3, 12, 2.5));
      });
      break;
    }
    case I.QUILL:
      cut(c, "#ffcc33", () => { c.moveTo(5, 20); c.quadraticCurveTo(6, 7, 20, 3); c.quadraticCurveTo(18, 15, 5, 20); c.closePath(); });
      c.strokeStyle = "#c98a00"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(5, 20); c.quadraticCurveTo(11, 11, 19, 4); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.moveTo(3, 22); c.lineTo(5, 18); c.lineTo(7, 20); c.closePath(); c.fill();
      break;
  }
}

const icons = {};
const iconURLs = {};
function icon(id) {
  if (!icons[id]) {
    const cv = makeCanvas(48, 48), c = cv.getContext("2d");
    c.scale(2, 2);
    if (id < 100) {
      c.drawImage(tex[id][1], 2, 2, 20, 20);
      if (id === B.TORCH) drawFlame(c, 12, 9, 1, 0);
    } else {
      paintItem(c, id);
    }
    icons[id] = cv;
  }
  return icons[id];
}
function iconURL(id) {
  if (!iconURLs[id]) iconURLs[id] = icon(id).toDataURL();
  return iconURLs[id];
}

function drawFlame(c, x, y, s, t) {
  const f = 1 + Math.sin(t * 17 + x) * 0.12;
  c.fillStyle = "#ff8a2b";
  c.beginPath(); c.ellipse(x, y, 4 * s, 6 * s * f, 0, 0, 7); c.fill();
  c.fillStyle = "#ffe066";
  c.beginPath(); c.ellipse(x, y + 1 * s, 2.2 * s, 3.5 * s * f, 0, 0, 7); c.fill();
}

// ---------- sound ----------

let audio = null;
let muted = false;
function tone(freq, dur, type = "sine", vol = 0.1, slideTo = null, delay = 0) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audio.currentTime + delay;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) { /* no sound on this browser */ }
}

// ---------- saving ----------

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(s);
}
function fromBase64(str) {
  const s = atob(str), bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function save() {
  if (!player) return;
  const data = {
    v: 1, seed, tiles: toBase64(world),
    player: { x: player.x, y: player.y, hp: player.hp }, spawn,
    inv: inv.map((s) => (s ? [s.id, s.n] : null)), sel, time, day, got, won, muted,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage blocked */ }
}

function startNew() {
  generate(Math.floor(Math.random() * 1e9));
  spawn = { x: WW / 2 + 0.5, y: surf[WW / 2] };
  player = newPlayer(spawn.x, spawn.y);
  inv = new Array(27).fill(null);
  sel = 0; time = 0.05; day = 1; got = {}; won = false; mobs = []; parts = []; pops = [];
  questShown = -2;
  begin();
  say("Welcome to Paperland! Find a tree to start.");
}
function startSaved(s) {
  seed = s.seed;
  surfaceHeights(seed);
  world = fromBase64(s.tiles);
  spawn = s.spawn;
  player = newPlayer(s.player.x, s.player.y);
  player.hp = s.player.hp || MAX_HP;
  inv = s.inv.map((e) => (e ? { id: e[0], n: e[1] } : null));
  sel = s.sel || 0; time = s.time; day = s.day; got = s.got || {}; won = !!s.won;
  mobs = []; parts = []; pops = [];
  questShown = -2;
  lightDirty = true;
  begin();
}
function begin() {
  cam.x = clamp(player.x * T - W / 2, 0, WW * T - W);
  cam.y = clamp((player.y - 1) * T - H / 2, -4 * T, WH * T - H);
  dig = { x: -1, y: -1, prog: 0 };
  updateQuest();
  show(null);
}

// ---------- input ----------

const $ = (id) => document.getElementById(id);
const canvas = $("board");
const ctx = canvas.getContext("2d");
const keys = {};
const mouse = { x: W / 2, y: H / 2, left: false, right: false, touch: false };
const touchKeys = { left: false, right: false, jump: false };
let touchBuild = false;

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
}

// the hotbar along the bottom of the board
const HOT = { size: 44, gap: 4, y: H - 54 };
const hotX = (i) => W / 2 - (9 * HOT.size + 8 * HOT.gap) / 2 + i * (HOT.size + HOT.gap);
function hotbarAt(x, y) {
  if (y < HOT.y || y > HOT.y + HOT.size) return -1;
  for (let i = 0; i < 9; i++) if (x >= hotX(i) && x <= hotX(i) + HOT.size) return i;
  return -1;
}

canvas.addEventListener("pointerdown", (e) => {
  if (mode !== "play") return;
  toCanvas(e);
  const h = hotbarAt(mouse.x, mouse.y);
  if (h >= 0) { sel = h; return; }
  canvas.setPointerCapture(e.pointerId);
  mouse.touch = e.pointerType !== "mouse";
  if (mouse.touch ? touchBuild : e.button === 2) {
    mouse.right = true;
    placeCD = 0;
  } else if (e.button === 0) {
    mouse.left = true;
  }
});
canvas.addEventListener("pointermove", toCanvas);
const release = () => { mouse.left = false; mouse.right = false; };
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => {
  if (mode !== "play") return;
  e.preventDefault();
  sel = (sel + (e.deltaY > 0 ? 1 : 8)) % 9;
}, { passive: false });

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "m") { toggleMute(); return; }
  if (k === "e" && (mode === "play" || mode === "bag")) { mode === "bag" ? closeBag() : openBag(); return; }
  if (k === "escape") {
    if (mode === "bag") closeBag();
    else if (mode === "play") goToTitle();
    return;
  }
  if (mode !== "play") return;
  if (k >= "1" && k <= "9") sel = Number(k) - 1;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  keys[k] = true;
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; release(); });

if ("ontouchstart" in window || matchMedia("(pointer: coarse)").matches) {
  $("touch").classList.remove("hidden");
  for (const b of document.querySelectorAll("#touch [data-key]")) {
    const k = b.dataset.key;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); touchKeys[k] = true; });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => { touchKeys[k] = false; });
  }
  $("touch-mode").addEventListener("click", () => {
    touchBuild = !touchBuild;
    $("touch-mode").textContent = touchBuild ? "🧱" : "⛏️";
    say(touchBuild ? "Building: tap to put blocks down" : "Digging: hold on a block to dig");
  });
}

// ---------- screens ----------

function show(id) {
  for (const s of ["title-screen", "bag-screen", "dead-screen", "win-screen"]) $(s).classList.toggle("hidden", s !== id);
  mode = { "title-screen": "title", "bag-screen": "bag", "dead-screen": "dead", "win-screen": "win" }[id] || "play";
  release();
}
function goToTitle() {
  save();
  $("play-continue").disabled = !loadSave();
  show("title-screen");
}
function toggleMute() {
  muted = !muted;
  $("mute").textContent = muted ? "🔇" : "🔊";
  save();
}

let picked = -1;
function openBag() {
  picked = -1;
  show("bag-screen");
  renderBag();
}
function closeBag() {
  show(null);
}
function renderBag() {
  const slots = $("slots");
  slots.innerHTML = "";
  inv.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "slot" + (i < 9 ? " hot" : "") + (i === picked ? " picked" : "") + (i === sel ? " current" : "");
    if (s) {
      b.title = itemName(s.id);
      b.innerHTML = `<img src="${iconURL(s.id)}" alt="${itemName(s.id)}">` + (s.n > 1 ? `<b>${s.n}</b>` : "");
    }
    b.addEventListener("click", () => {
      if (picked < 0) {
        if (inv[i]) picked = i;
      } else {
        const a = inv[picked], c = inv[i];
        if (a && c && a.id === c.id && stackable(a.id) && picked !== i) {
          const k = Math.min(a.n, STACK - c.n);
          c.n += k; a.n -= k;
          if (a.n === 0) inv[picked] = null;
        } else {
          inv[picked] = c; inv[i] = a;
        }
        picked = -1;
      }
      renderBag();
    });
    slots.appendChild(b);
  });

  const bench = stationNear(B.BENCH), furnace = stationNear(B.FURNACE);
  $("station-hint").textContent = `Crafting · ${bench ? "✅" : "❌"} near a workbench · ${furnace ? "✅" : "❌"} near a furnace`;
  const list = $("recipes");
  list.innerHTML = "";
  for (const r of RECIPES) {
    const row = document.createElement("div");
    const ok = canCraft(r), stationOk = !r.at || stationNear(r.at);
    row.className = "recipe" + (stationOk ? "" : " locked");
    const needs = r.need.map(([id, n]) => {
      const have = count(id);
      return `<span class="${have < n ? "short" : ""}" title="${itemName(id)}"><img src="${iconURL(id)}" alt="">${have}/${n}</span>`;
    }).join("");
    const at = r.at ? `<span class="at">${r.at === B.BENCH ? "🪚 at a workbench" : "🔥 at a furnace"}</span>` : "";
    row.innerHTML = `<div class="out"><img src="${iconURL(r.out)}" alt="">${r.n > 1 ? r.n + " " : ""}${itemName(r.out)}</div>
      <div class="needs">${needs}${at}</div><button ${ok ? "" : "disabled"}>Craft</button>`;
    row.querySelector("button").addEventListener("click", () => {
      craft(r);
      if (mode === "bag") renderBag();
    });
    list.appendChild(row);
  }
}
function showWin() {
  $("win-text").textContent = `You crafted the Golden Quill on day ${day}! Paperland is yours to build. ` +
    "Try making a castle out of stone bricks, or a glass tower full of torches.";
  tone(523, 0.15, "triangle", 0.12);
  tone(659, 0.15, "triangle", 0.12, null, 0.15);
  tone(784, 0.15, "triangle", 0.12, null, 0.3);
  tone(1047, 0.4, "triangle", 0.12, null, 0.45);
  save();
  show("win-screen");
}

$("play-continue").addEventListener("click", () => { const s = loadSave(); if (s) startSaved(s); });
$("play-new").addEventListener("click", () => {
  if (loadSave() && !confirm("Start a brand new world? Your saved world will be replaced.")) return;
  startNew();
  save();
});
$("open-bag").addEventListener("click", () => { if (mode === "play") openBag(); else if (mode === "bag") closeBag(); });
$("bag-close").addEventListener("click", closeBag);
$("open-menu").addEventListener("click", () => { if (mode !== "title") goToTitle(); });
$("mute").addEventListener("click", toggleMute);
$("respawn").addEventListener("click", () => {
  player = newPlayer(spawn.x, spawn.y);
  mobs = [];
  begin();
});
$("win-keep").addEventListener("click", () => show(null));
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

// ---------- moving things ----------

// moves something with a box around it, first sideways and then up or down, stopping at solid blocks.
// x is the middle of its feet, y is the bottom of its feet.
function move(e, dt) {
  e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
  e.hitWall = false;
  e.x += e.vx * dt;
  const ty0 = Math.floor(e.y - e.h + 0.01), ty1 = Math.floor(e.y - 0.01);
  if (e.vx !== 0) {
    const right = e.vx > 0;
    const tx = Math.floor(right ? e.x + e.w / 2 : e.x - e.w / 2);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (!solidAt(tx, ty)) continue;
      e.x = right ? tx - e.w / 2 - 0.001 : tx + 1 + e.w / 2 + 0.001;
      e.hitWall = true;
      break;
    }
  }
  const wasGround = e.onGround;
  e.onGround = false;
  e.y += e.vy * dt;
  const tx0 = Math.floor(e.x - e.w / 2 + 0.01), tx1 = Math.floor(e.x + e.w / 2 - 0.01);
  if (e.vy > 0) {
    const ty = Math.floor(e.y);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (solidAt(tx, ty)) { e.y = ty; e.vy = 0; e.onGround = true; break; }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y - e.h);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (solidAt(tx, ty)) { e.y = ty + 1 + e.h; e.vy = 0; break; }
    }
  }
  // remember the highest point of a fall, so a long drop hurts
  let fell = 0;
  if (!e.onGround) e.peak = Math.min(e.peak, e.y);
  else if (!wasGround) fell = e.y - e.peak;
  if (e.onGround) e.peak = e.y;
  return fell;
}

const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y - a.h < b.y && b.y - b.h < a.y;
function boxHitsTile(e, tx, ty) {
  return e.x + e.w / 2 > tx && e.x - e.w / 2 < tx + 1 && e.y > ty && e.y - e.h < ty + 1;
}

function hurt(dmg, fromX) {
  if (player.inv > 0 || mode !== "play") return;
  player.hp -= dmg;
  player.inv = 0.8;
  player.hurtAgo = 0;
  if (fromX !== undefined) {
    player.kb = Math.sign(player.x - fromX || 1) * 9;
    player.vy = -6;
  }
  tone(220, 0.25, "sawtooth", 0.1, 90);
  burst(player.x, player.y - 0.9, "#e4572e", 8);
  if (player.hp <= 0) {
    player.hp = 0;
    tone(300, 0.6, "sawtooth", 0.1, 60);
    save();
    show("dead-screen");
  }
}

function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    parts.push({ x, y, vx: rand(-4, 4), vy: rand(-7, -1), life: rand(0.4, 0.8), col, s: rand(2, 5), rot: rand(0, 6) });
  }
}

// a torch with nothing to hang on falls off, and sand with nothing under it drops down
function settle(x, y) {
  for (let k = 0; k < WH && y >= 0; k++, y--) {
    const id = tileAt(x, y);
    if (id === B.TORCH && !torchSupported(x, y)) {
      setTile(x, y, B.AIR);
      give(B.TORCH);
    } else if (id === B.SAND && tileAt(x, y + 1) === B.AIR) {
      let ny = y;
      while (tileAt(x, ny + 1) === B.AIR) ny++;
      setTile(x, y, B.AIR);
      setTile(x, ny, B.SAND);
    } else {
      return;
    }
  }
}
const torchSupported = (x, y) => solidAt(x, y + 1) || solidAt(x - 1, y) || solidAt(x + 1, y);

function breakTile(x, y) {
  const id = tileAt(x, y), b = BLOCKS[id];
  setTile(x, y, B.AIR);
  burst(x + 0.5, y + 0.5, id === B.GRASS ? "#6fbf4f" : shade(b.color, 1), 7);
  tone(180, 0.12, "triangle", 0.1, 90);
  let drop = b.drop;
  if (id === B.LEAVES && Math.random() < 0.12) drop = I.APPLE;
  if (drop !== null) {
    give(drop);
    pop(x + 0.5, y, `+1 ${itemName(drop)}`);
    if (drop >= 100) tone(880, 0.08, "sine", 0.08, null, 0.05);
  }
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) settle(x + dx, y + dy);
}

function tryPlace(x, y) {
  const id = held();
  if (id === null) return;
  if (ITEMS[id] && ITEMS[id].food) {
    if (player.hp >= MAX_HP) { say("You're not hungry right now."); return; }
    take(id, 1);
    player.hp = Math.min(MAX_HP, player.hp + ITEMS[id].food);
    tone(500, 0.08, "square", 0.06); tone(400, 0.08, "square", 0.06, null, 0.1);
    pop(player.x, player.y - 2, "Yum! ❤", "#ffb3b3");
    return;
  }
  if (id >= 100) return;
  if (x < 0 || x >= WW || y < 0 || y >= WH || tileAt(x, y) !== B.AIR) return;
  const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => tileAt(x + dx, y + dy) !== B.AIR);
  if (!near) return;
  if (id === B.TORCH && !torchSupported(x, y)) return;
  if (BLOCKS[id].solid && (boxHitsTile(player, x, y) || mobs.some((m) => boxHitsTile(m, x, y)))) return;
  take(id, 1);
  setTile(x, y, id);
  settle(x, y);
  tone(330, 0.07, "sine", 0.1);
}

function mouseTile() {
  return { x: Math.floor((mouse.x + cam.x) / T), y: Math.floor((mouse.y + cam.y) / T) };
}
function inReach(tx, ty) {
  return Math.hypot(tx + 0.5 - player.x, ty + 0.5 - (player.y - 0.9)) <= REACH;
}
function mobUnderMouse() {
  const wx = (mouse.x + cam.x) / T, wy = (mouse.y + cam.y) / T;
  return mobs.find((m) => Math.abs(wx - m.x) < m.w / 2 + 0.25 && wy > m.y - m.h - 0.25 && wy < m.y + 0.1);
}

function spawnBlot(x, y) {
  mobs.push({ x, y, vx: 0, vy: 0, w: 0.9, h: 0.8, hp: 6, hop: rand(0.4, 1.2), onGround: false, peak: y, hurt: 0, squash: 0, t: rand(0, 6) });
}
function trySpawn() {
  if (mobs.length >= MAX_BLOTS) return;
  const px = Math.floor(player.x), py = Math.floor(player.y);
  // at night they come over the hills from off-screen
  if (isNight() && Math.random() < 0.7) {
    const x = clamp(px + (Math.random() < 0.5 ? -1 : 1) * randInt(20, 28), 1, WW - 2);
    let y = 0;
    while (y < WH - 1 && !solidAt(x, y)) y++;
    if (Math.abs(y - py) < 25 && blkL[(y - 1) * WW + x] < 5) spawnBlot(x + 0.5, y);
    return;
  }
  // and any time in dark caves, but never close to a torch
  for (let tries = 0; tries < 10; tries++) {
    const x = px + randInt(-26, 26), y = py + randInt(-14, 14);
    if (x < 1 || x >= WW - 1 || y < 2 || y >= WH - 1) continue;
    if (Math.hypot(x - px, y - py) < 13) continue;
    const i = y * WW + x;
    if (world[i] !== B.AIR || world[i - WW] !== B.AIR || !solidAt(x, y + 1)) continue;
    if (skyL[i] > 3 || blkL[i] > 4) continue;
    spawnBlot(x + 0.5, y + 1);
    return;
  }
}

// ---------- the main loop ----------

function update(dt) {
  time += dt / DAY_LENGTH;
  if (time >= 1) { time -= 1; day++; say(`Day ${day}! ☀️`); }
  if (lightDirty) computeLight();
  const dl = daylight();

  // walking and jumping
  const left = keys.a || keys.arrowleft || touchKeys.left;
  const right = keys.d || keys.arrowright || touchKeys.right;
  const jump = keys.w || keys[" "] || keys.arrowup || touchKeys.jump;
  const want = (right ? 1 : 0) - (left ? 1 : 0);
  if (want) player.face = want;
  player.kb *= Math.pow(0.02, dt);
  player.vx = want * WALK + player.kb;
  if (jump && player.onGround) {
    player.vy = -JUMP;
    tone(260, 0.06, "sine", 0.04, 360);
  }
  const fell = move(player, dt);
  if (fell > 4.5) hurt(Math.round((fell - 4) * 2));
  player.walk += Math.abs(player.vx) * dt * 2.2;
  player.inv -= dt;
  player.hurtAgo += dt;
  if (player.y > WH + 5) { player.x = spawn.x; player.y = spawn.y; }

  // slowly heal when nothing has hurt you for a while
  regenCD -= dt;
  if (player.hurtAgo > 6 && player.hp < MAX_HP && regenCD <= 0) { player.hp++; regenCD = 3; }

  // digging, bopping and building
  attackCD -= dt; placeCD -= dt; hintCD -= dt; swing = Math.max(0, swing - dt);
  const mt = mouseTile();
  if (mouse.left) {
    const m = mobUnderMouse();
    if (m && Math.hypot(m.x - player.x, m.y - player.y) < HIT_REACH) {
      dig.prog = 0;
      if (attackCD <= 0) {
        attackCD = 0.35; swing = 0.25;
        m.hp -= swordDamage();
        m.hurt = 0.2;
        m.vx = Math.sign(m.x - player.x || 1) * 7; m.vy = -6;
        tone(320, 0.1, "square", 0.08, 140);
        burst(m.x, m.y - 0.4, "#1c1a2b", 5);
        if (m.hp <= 0) {
          const n = randInt(1, 2);
          give(I.INK, n);
          pop(m.x, m.y - 1, `+${n} Ink`);
        }
      }
    } else {
      const id = tileAt(mt.x, mt.y);
      if (dig.x !== mt.x || dig.y !== mt.y) dig = { x: mt.x, y: mt.y, prog: 0 };
      if (id !== B.AIR && inReach(mt.x, mt.y) && mt.y >= 0) {
        const b = BLOCKS[id], pick = bestPick();
        swing = 0.25;
        if (b.tier > pick.tier) {
          if (hintCD <= 0) {
            say(id === B.BEDROCK ? "Bedrock is too tough for anything!" : `You need a ${TIER_PICK[b.tier]} to dig ${b.name}.`);
            hintCD = 2;
          }
        } else {
          dig.prog += dt / (b.hard / (b.rocky ? pick.speed : Math.max(1, pick.speed * 0.6)));
          digSound -= dt;
          if (digSound <= 0) { tone(rand(110, 160), 0.05, "square", 0.04); digSound = 0.17; }
          if (dig.prog >= 1) { breakTile(mt.x, mt.y); dig.prog = 0; }
        }
      }
    }
  } else {
    dig.prog = 0;
  }
  if (mouse.right && placeCD <= 0) {
    if (inReach(mt.x, mt.y)) { tryPlace(mt.x, mt.y); swing = 0.2; }
    placeCD = 0.22;
    if (mouse.touch) mouse.right = false;
  }

  // Ink Blots
  spawnCD -= dt;
  if (spawnCD <= 0) { trySpawn(); spawnCD = isNight() ? 1.6 : 4; }
  for (const m of mobs) {
    m.t += dt;
    m.hurt -= dt;
    m.squash *= Math.pow(0.002, dt);
    m.hop -= dt;
    if (m.onGround) m.vx *= Math.pow(0.001, dt);
    const dx = player.x - m.x, dist = Math.hypot(dx, player.y - m.y);
    if (m.onGround && m.hop <= 0) {
      const dir = dist < 18 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
      m.vy = -rand(8.5, 11);
      m.vx = dir * rand(3, 4.5);
      m.hop = rand(0.5, 1.2);
      m.squash = -0.3;
    }
    const wasGround = m.onGround;
    move(m, dt);
    if (m.onGround && !wasGround) m.squash = 0.35;
    if (m.hitWall && m.onGround) m.hop = 0;
    // sunshine dries them out
    const i = clamp(Math.floor(m.y - 0.5), 0, WH - 1) * WW + clamp(Math.floor(m.x), 0, WW - 1);
    if (dl > 0.6 && skyL[i] >= 13) {
      m.hp -= dt * 3;
      if (Math.random() < dt * 10) parts.push({ x: m.x + rand(-0.4, 0.4), y: m.y - 0.8, vx: 0, vy: -2, life: 0.6, col: "rgba(220,220,230,0.8)", s: 4, rot: 0, float: true });
    }
    if (overlaps(m, player)) hurt(2, m.x);
    if (m.hp <= 0) { burst(m.x, m.y - 0.4, "#1c1a2b", 12); tone(150, 0.25, "sine", 0.1, 60); }
  }
  mobs = mobs.filter((m) => m.hp > 0 && Math.abs(m.x - player.x) < 45 && m.y < WH + 2);

  // bits of paper flying about
  for (const p of parts) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.float) p.vy += GRAV * 0.7 * dt;
    p.rot += dt * 6;
  }
  parts = parts.filter((p) => p.life > 0);
  for (const p of pops) { p.life -= dt; p.y -= dt * 1.2; }
  pops = pops.filter((p) => p.life > 0);
  toast.life -= dt;

  // the camera follows you around
  const tx = clamp(player.x * T - W / 2, 0, WW * T - W);
  const ty = clamp((player.y - 1) * T - H / 2, -4 * T, WH * T - H);
  const k = 1 - Math.pow(0.0005, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);

  saveCD -= dt;
  if (saveCD <= 0) { save(); saveCD = 15; }
  updateHud();
}

let hudCache = "";
function updateHud() {
  const hour = Math.floor((time * 24 + 6) % 24);
  const clock = `${isNight() ? "🌙" : "☀️"} ${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`;
  const depth = Math.floor(player.y) - surf[clamp(Math.floor(player.x), 0, WW - 1)];
  const depthText = depth <= 0 ? "Surface" : `${depth} down`;
  const key = day + clock + depthText;
  if (key === hudCache) return;
  hudCache = key;
  $("day").textContent = day;
  $("clock").textContent = clock;
  $("depth").textContent = depthText;
}

// ---------- drawing ----------

const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.6, s: rand(1, 2.4) }));
const lightCanvas = makeCanvas(Math.ceil(W / T) + 2, Math.ceil(H / T) + 2);
const lightCtx = lightCanvas.getContext("2d");
const lightImg = lightCtx.createImageData(lightCanvas.width, lightCanvas.height);

function drawSky(dl) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const sunset = time > 0.52 && time < 0.64 ? 1 - Math.abs(time - 0.58) / 0.06 : 0;
  g.addColorStop(0, shade("#7cc6ee", dl));
  g.addColorStop(1, sunset > 0 ? `rgba(255,${Math.round(190 - sunset * 60)},120,1)` : shade("#cdeefc", dl));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // the sun crosses the sky in the day, the moon at night
  const night = isNight();
  const ang = night ? ((time - 0.6) / 0.4) * Math.PI : (time / 0.6) * Math.PI;
  const sx = W / 2 - Math.cos(ang) * W * 0.42, sy = H * 0.62 - Math.sin(ang) * H * 0.5;
  if (time < 0.6) {
    ctx.fillStyle = EDGE; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd447"; ctx.beginPath(); ctx.arc(sx, sy, 31, 0, 7); ctx.fill();
  }
  return { sx, sy, night };
}

// two layers of paper hills far away, which move slower than you
function drawHills() {
  const layers = [
    { f: 0.2, col: "#9ccf8a", base: 0.55, amp: 90, scale: 260, s: seed + 10 },
    { f: 0.45, col: "#7dbb6a", base: 0.68, amp: 70, scale: 170, s: seed + 11 },
  ];
  for (const L of layers) {
    const yOff = (30 * T - cam.y) * L.f * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 16; x += 16) {
      const y = H * L.base - noise1((x + cam.x * L.f) / L.scale, L.s) * L.amp + yOff - 60;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.lineWidth = 4; ctx.strokeStyle = EDGE; ctx.stroke();
    ctx.fillStyle = L.col; ctx.fill();
  }
}

function drawWorld(x0, y0, x1, y1, t) {
  // dark paper behind holes in the ground
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= WW || y < 0 || y >= WH) continue;
      const id = world[y * WW + x];
      if ((id === B.AIR || BLOCKS[id].see) && y > surf[x]) {
        ctx.drawImage(wallTex[(x * 7 + y * 3) % 3], x * T - cam.x, y * T - cam.y);
      }
    }
  }
  // every block throws a little shadow, which makes it look cut out and stuck on
  ctx.fillStyle = "rgba(40,28,15,0.3)";
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const id = tileAt(x, y);
      if (id !== B.AIR && id !== B.TORCH && id !== B.GLASS) ctx.fillRect(x * T - cam.x + 3, y * T - cam.y + 3, T, T);
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= WW || y < 0 || y >= WH) continue;
      const id = world[y * WW + x];
      if (id === B.AIR) continue;
      const px = x * T - cam.x, py = y * T - cam.y;
      ctx.drawImage(tex[id][(x * 5 + y * 11) % 3], px, py);
      if (id === B.TORCH) drawFlame(ctx, px + 12, py + 8, 1, t);
      if (id === B.CRYSTAL && Math.sin(t * 3 + x * 7 + y) > 0.85) {
        ctx.fillStyle = "#fff"; ctx.fillRect(px + 10, py + 6, 3, 3);
      }
    }
  }
}

function drawCracks() {
  if (dig.prog <= 0) return;
  const px = dig.x * T - cam.x, py = dig.y * T - cam.y;
  const r = mulberry32(dig.x * 31 + dig.y);
  ctx.strokeStyle = "rgba(30,20,10,0.75)";
  ctx.lineWidth = 1.5;
  const n = Math.ceil(dig.prog * 6);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    let x = 12, y = 12;
    ctx.moveTo(px + x, py + y);
    const a = r() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      x += Math.cos(a + r() - 0.5) * 4.5; y += Math.sin(a + r() - 0.5) * 4.5;
      ctx.lineTo(px + x, py + y);
    }
    ctx.stroke();
  }
}

function drawCursor() {
  if (mode !== "play" || mouse.touch) return;
  const { x, y } = mouseTile();
  if (!inReach(x, y)) return;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x * T - cam.x + 1, y * T - cam.y + 1, T - 2, T - 2);
  ctx.setLineDash([]);
}

// the shadow under each part makes the paper doll look layered
function paperShadow(on) {
  ctx.shadowColor = on ? "rgba(30,20,10,0.35)" : "transparent";
  ctx.shadowOffsetX = on ? 2 : 0;
  ctx.shadowOffsetY = on ? 2 : 0;
}
function part(fill, x, y, w, h) {
  ctx.fillStyle = EDGE;
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function drawPlayer(t) {
  const p = player;
  if (p.inv > 0 && Math.floor(t * 20) % 2) return;
  const px = p.x * T - cam.x, py = p.y * T - cam.y;
  const step = p.onGround && Math.abs(p.vx) > 0.5 ? Math.sin(p.walk * 3) * 0.5 : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(p.face, 1);
  paperShadow(true);
  // two legs, then the body
  ctx.save(); ctx.translate(-2, -14); ctx.rotate(-step); part("#2f4a6e", -3, 0, 6, 14); ctx.restore();
  ctx.save(); ctx.translate(2, -14); ctx.rotate(step); part("#3d5a80", -3, 0, 6, 14); ctx.restore();
  part("#e4572e", -7, -29, 14, 16);
  // head with hair and an eye
  part("#f2c9a0", -7, -42, 14, 13);
  ctx.fillStyle = "#3b2a1e"; ctx.fillRect(-7, -42, 14, 4); ctx.fillRect(-7, -42, 4, 8);
  paperShadow(false);
  ctx.fillStyle = INK; ctx.fillRect(3, -36, 2, 3);
  ctx.fillStyle = "#e88"; ctx.fillRect(2, -32, 3, 1.5);
  // arm, swinging while you dig or build, holding whatever is picked in the hotbar
  const armA = swing > 0 ? -1.6 + Math.sin(t * 30) * 0.9 : 0.2 + step * 0.6;
  ctx.save();
  ctx.translate(0, -26);
  ctx.rotate(armA);
  paperShadow(true);
  part("#d34a24", -2, 0, 5, 12);
  paperShadow(false);
  const h = held();
  if (h !== null) ctx.drawImage(icon(h), -6, 6, 18, 18);
  ctx.restore();
  ctx.restore();
}

function drawBlot(m) {
  const px = m.x * T - cam.x, py = m.y * T - cam.y;
  const sq = m.squash, r = 12;
  const body = m.hurt > 0 ? "#a03030" : "#1c1a2b";
  ctx.save();
  ctx.translate(px, py - r * (1 - sq));
  ctx.scale(1 + sq, 1 - sq);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = r + Math.sin(a * 3 + m.t * 4) * 1.6 + Math.sin(a * 5 - m.t * 3) * 0.8;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  paperShadow(true);
  ctx.lineWidth = 3; ctx.strokeStyle = EDGE; ctx.stroke();
  ctx.fillStyle = body; ctx.fill();
  paperShadow(false);
  // a drip on the bottom
  ctx.beginPath(); ctx.arc(-5, r - 1, 2.5 + Math.sin(m.t * 2) * 0.8, 0, 7); ctx.fill();
  // eyes that follow you
  const look = clamp(player.x - m.x, -1, 1) * 2;
  for (const ex of [-4.5, 4.5]) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, -2, 3.2, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + look, -1.5, 1.7, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// darkness is worked out once per tile, then stretched smoothly over the screen
function drawLight(x0, y0, dl) {
  const d = lightImg.data, w = lightCanvas.width, h = lightCanvas.height;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i, y = y0 + j;
      let b;
      if (x >= 0 && x < WW && y >= 0 && y < WH) {
        const k = y * WW + x;
        // a little daylight soaks into the top of the ground, so it fades to dark instead of going black at once
        const soak = clamp(1 - (y - surf[x]) / 14, 0, 1) * 0.6 * dl;
        b = Math.max((skyL[k] / 15) * dl, (blkL[k] / 15) * 1.05, soak);
      } else {
        b = y >= WH ? 0 : dl;
      }
      const o = (j * w + i) * 4;
      d[o] = 10; d[o + 1] = 12; d[o + 2] = 34;
      d[o + 3] = Math.round(clamp(1 - b, 0, 1) * 0.93 * 255);
    }
  }
  lightCtx.putImageData(lightImg, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, x0 * T - cam.x - T / 2, y0 * T - cam.y - T / 2, w * T, h * T);
}

// stars and the moon go on top of the darkness, but only where you can see open sky
function drawNightSky(sky) {
  const dark = 1 - (daylight() - 0.3) / 0.7;
  if (dark <= 0.05) return;
  const open = (sx, sy) => {
    const x = Math.floor((sx + cam.x) / T), y = Math.floor((sy + cam.y) / T);
    if (y < 0) return true;
    return x >= 0 && x < WW && y < WH && world[y * WW + x] === B.AIR && skyL[y * WW + x] === 15;
  };
  ctx.fillStyle = `rgba(255,250,220,${dark * 0.9})`;
  for (const s of stars) if (open(s.x, s.y)) ctx.fillRect(s.x, s.y, s.s, s.s);
  if (sky.night && open(sky.sx, sky.sy)) {
    ctx.fillStyle = EDGE; ctx.beginPath(); ctx.arc(sky.sx, sky.sy, 26, 0, 7); ctx.fill();
    ctx.fillStyle = "#f2efe0"; ctx.beginPath(); ctx.arc(sky.sx, sky.sy, 24, 0, 7); ctx.fill();
    ctx.fillStyle = "#d9d4bf";
    ctx.beginPath(); ctx.arc(sky.sx - 7, sky.sy - 4, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(sky.sx + 6, sky.sy + 7, 3.5, 0, 7); ctx.fill();
  }
}

function drawHearts() {
  for (let i = 0; i < MAX_HP / 2; i++) {
    const x = 14 + i * 26, y = 14;
    const fill = player.hp - i * 2;
    heart(x, y, "rgba(30,20,10,0.45)", 1, true);
    if (fill >= 2) heart(x, y, "#e4572e", 1);
    else if (fill === 1) heart(x, y, "#e4572e", 0.5);
  }
}
function heart(x, y, col, part, rim) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - 4, 4 + 22 * part, 30);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 19);
  ctx.bezierCurveTo(x - 2, y + 10, x + 1, y - 1, x + 11, y + 5);
  ctx.bezierCurveTo(x + 21, y - 1, x + 24, y + 10, x + 11, y + 19);
  if (rim) { ctx.lineWidth = 3; ctx.strokeStyle = EDGE; ctx.stroke(); }
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

function drawHotbar() {
  for (let i = 0; i < 9; i++) {
    const x = hotX(i), y = HOT.y, s = inv[i];
    ctx.fillStyle = "rgba(30,20,10,0.35)";
    ctx.fillRect(x + 3, y + 3, HOT.size, HOT.size);
    ctx.fillStyle = i === sel ? "#fffaf0" : "rgba(251,246,234,0.82)";
    ctx.fillRect(x, y, HOT.size, HOT.size);
    if (i === sel) { ctx.strokeStyle = "#e4572e"; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, HOT.size - 3, HOT.size - 3); }
    ctx.fillStyle = "rgba(46,36,24,0.45)";
    ctx.font = "10px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(i + 1, x + 4, y + 12);
    if (!s) continue;
    ctx.drawImage(icon(s.id), x + 6, y + 6, 32, 32);
    if (s.n > 1) {
      ctx.font = "800 13px Nunito, sans-serif";
      ctx.textAlign = "right";
      ctx.lineWidth = 3; ctx.strokeStyle = "#fffaf0"; ctx.strokeText(s.n, x + HOT.size - 3, y + HOT.size - 4);
      ctx.fillStyle = INK; ctx.fillText(s.n, x + HOT.size - 3, y + HOT.size - 4);
    }
  }
  const h = held();
  if (h !== null) label(itemName(h), W / 2, HOT.y - 10, 18);
}
function label(text, x, y, size) {
  ctx.font = `${size}px "Patrick Hand", sans-serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(46,36,24,0.8)"; ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fffaf0"; ctx.fillText(text, x, y);
}

function render(t) {
  const dl = daylight();
  const sky = drawSky(dl);
  drawHills();
  const x0 = Math.floor(cam.x / T) - 1, y0 = Math.floor(cam.y / T) - 1;
  const x1 = x0 + Math.ceil(W / T) + 2, y1 = y0 + Math.ceil(H / T) + 2;
  drawWorld(x0, y0, x1, y1, t);
  drawCracks();
  if (player && mode !== "title") {
    for (const m of mobs) drawBlot(m);
    drawPlayer(t);
  }
  for (const p of parts) {
    ctx.save();
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.translate(p.x * T - cam.x, p.y * T - cam.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.col;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    ctx.restore();
  }
  drawLight(x0 + 1, y0 + 1, dl);
  drawNightSky(sky);
  if (!player || mode === "title") return;
  drawCursor();
  for (const p of pops) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    label(p.text, p.x * T - cam.x, p.y * T - cam.y, 18);
    ctx.globalAlpha = 1;
  }
  drawHearts();
  drawHotbar();
  if (toast.life > 0) {
    ctx.globalAlpha = clamp(toast.life * 2, 0, 1);
    label(toast.text, W / 2, 70, 26);
    ctx.globalAlpha = 1;
  }
}

// ---------- start ----------

buildTextures();
const saved = loadSave();
if (saved) {
  muted = !!saved.muted;
  $("mute").textContent = muted ? "🔇" : "🔊";
} else {
  $("play-continue").disabled = true;
}
// a world to look at behind the title screen
generate(saved ? saved.seed : 7);
if (saved) world = fromBase64(saved.tiles);
computeLight();
cam.x = (WW / 2) * T - W / 2;
cam.y = 22 * T - H / 2;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (mode === "play") {
    update(dt);
  } else if (mode === "title") {
    cam.x = (cam.x + dt * 30) % (WW * T - W);
    if (lightDirty) computeLight();
  }
  render(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
