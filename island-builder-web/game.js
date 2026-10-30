// Island Builder: grow a tiny camp on a desert island into a busy town.
// Build huts for islanders, gather wood, stone, food and gold, raise new land from the sea,
// and finish your island by building the Great Lighthouse!
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const TILE = 32;              // every square on the map is 32 x 32 game pixels
const MAP_W = 48;             // the map is 48 squares wide...
const MAP_H = 36;             // ...and 36 squares tall
const DAY_LENGTH = 90;        // one day (and night) lasts 90 seconds
const START = { wood: 40, stone: 0, food: 20, gold: 0, pop: 3 };
const EAT = 0.05;             // how much food each islander eats every second
const GROW_EVERY = 3.5;       // a new islander arrives every 3.5 seconds (if there is a free home and food)
const LEAVE_EVERY = 4;        // with no food (or no homes), an islander sails away every 4 seconds
const LIGHTHOUSE_POP = 40;    // islanders you need before you can build the Great Lighthouse
const SAVE_KEY = "island-builder-save";
const CACHE_SCALE = 2;        // the ground picture is drawn 2x bigger, so it stays sharp when you zoom in

// ---------- 2. the kinds of ground ----------
const DEEP = 0, SHALLOW = 1, SAND = 2, GRASS = 3, FOREST = 4, ROCK = 5;
const GROUND_NAMES = ["deep sea", "shallow sea", "sand", "grass", "forest", "rocks"];
const GROUND_COLORS = [
  ["#2273b8", "#2476bb", "#2170b4"],
  ["#45ace0", "#47afe2", "#43a9dd"],
  ["#f2dc9b", "#f0d995", "#f3dfa2"],
  ["#79c75a", "#76c357", "#7cca5d"],
  ["#66b44c", "#63b049", "#69b74f"],
  ["#a3a09a", "#9f9c95", "#a7a49e"],
];
const isWater = k => k === DEEP || k === SHALLOW;
const isLand = k => k >= SAND;

// ---------- 3. the buildings ----------
// cost: what you pay. homes: how many islanders can live there. jobs: workers it needs.
// on: which ground it can sit on. near: what it has to be close to. make(b): what it makes every second.
const DEFS = {
  camp: { name: "Camp", icon: "⛺", homes: 3, desc: "Where your first 3 islanders live." },
  hut: {
    name: "Hut", icon: "🛖", cost: { wood: 10 }, homes: 4, on: [SAND, GRASS],
    desc: "A home for 4 islanders.",
  },
  farm: {
    name: "Farm", icon: "🌾", cost: { wood: 15 }, jobs: 2, on: [GRASS],
    make: () => ({ food: 0.7 }),
    desc: "Grows food. Goes on grass.",
  },
  dock: {
    name: "Fish Dock", icon: "🐟", cost: { wood: 20 }, jobs: 2, on: [SAND], near: "water",
    make: () => ({ food: 0.9 }),
    desc: "Catches fish for food. Goes on sand right next to the sea.",
  },
  lumber: {
    name: "Lumber Camp", icon: "🪓", cost: { wood: 10 }, jobs: 2, on: [SAND, GRASS], near: "forest",
    make: b => ({ wood: Math.min(8, countNear(b.x, b.y, 2, FOREST)) * 0.15 }),
    desc: "Chops wood. More forest close by means more wood.",
  },
  quarry: {
    name: "Quarry", icon: "⛏️", cost: { wood: 25 }, jobs: 3, on: [SAND, GRASS, ROCK], near: "rock",
    make: b => ({ stone: Math.min(6, countNear(b.x, b.y, 2, ROCK)) * 0.18 }),
    desc: "Digs stone. More rocks close by means more stone.",
  },
  house: {
    name: "Stone House", icon: "🏠", cost: { wood: 15, stone: 20 }, homes: 10, on: [SAND, GRASS],
    desc: "A big home for 10 islanders.",
  },
  market: {
    name: "Market", icon: "🏪", cost: { wood: 30, stone: 20 }, jobs: 3, on: [SAND, GRASS],
    make: () => ({ gold: 0.6 }),
    desc: "Islanders trade here and earn gold.",
  },
  harbor: {
    name: "Harbor", icon: "⛵", cost: { wood: 50, stone: 40, gold: 30 }, jobs: 4, on: [SAND], near: "water",
    make: () => ({ gold: 1.0, food: 0.4 }),
    desc: "Trading ships bring gold and food. Goes on sand next to the sea.",
  },
  lighthouse: {
    name: "Great Lighthouse", icon: "🗼", cost: { wood: 150, stone: 200, gold: 120 }, on: [SAND, GRASS, ROCK],
    near: "water", needPop: LIGHTHOUSE_POP, one: true,
    desc: "The wonder of your island! Needs " + LIGHTHOUSE_POP + " islanders and a spot next to the sea.",
  },
};
// tools that change the ground instead of building something
const TOOLS = {
  raise: { name: "Raise Land", icon: "🏝️", desc: "Turns shallow sea into sand (5 🪨), or deep sea into shallow sea (8 🪨)." },
  plant: { name: "Plant Tree", icon: "🌳", cost: { food: 3 }, desc: "Turns grass into forest. Lumber camps love forests." },
  clear: { name: "Clear", icon: "🧹", desc: "Knocks down a building (you get half the cost back), or chops a forest for 4 🪵." },
};
const TOOL_ORDER = ["hut", "farm", "dock", "lumber", "quarry", "house", "market", "harbor", "lighthouse", "raise", "plant", "clear"];
const TOOL_KEYS = { 1: "hut", 2: "farm", 3: "dock", 4: "lumber", 5: "quarry", 6: "house", 7: "market", 8: "harbor", 9: "lighthouse", r: "raise", t: "plant", c: "clear" };
const RES_ICON = { wood: "🪵", stone: "🪨", food: "🍞", gold: "🪙" };

// ---------- 4. goals: they guide you from a tiny camp to the Great Lighthouse ----------
const QUESTS = [
  { text: "Build a Hut 🛖 so more islanders can live here.", done: () => count("hut") >= 1, reward: { wood: 15 } },
  { text: "Build a Lumber Camp 🪓 close to the forest.", done: () => count("lumber") >= 1, reward: { food: 10 } },
  { text: "Build a Farm 🌾 or a Fish Dock 🐟 for food.", done: () => count("farm") + count("dock") >= 1, reward: { wood: 20 } },
  { text: "Grow your island to 10 islanders.", done: () => S.pop >= 10, reward: { wood: 30 } },
  { text: "Build a Quarry ⛏️ close to the rocks.", done: () => count("quarry") >= 1, reward: { food: 20 } },
  { text: "Raise 3 squares of new land from the sea 🏝️.", done: () => S.raised >= 3, reward: { stone: 15 } },
  { text: "Build a Stone House 🏠.", done: () => count("house") >= 1, reward: { gold: 10 } },
  { text: "Build a Market 🏪 to earn gold.", done: () => count("market") >= 1, reward: { stone: 20 } },
  { text: "Plant 3 trees 🌳.", done: () => S.planted >= 3, reward: { gold: 15 } },
  { text: "Grow your island to 25 islanders.", done: () => S.pop >= 25, reward: { wood: 40, stone: 30 } },
  { text: "Build a Harbor ⛵.", done: () => count("harbor") >= 1, reward: { gold: 30 } },
  { text: "Grow your island to " + LIGHTHOUSE_POP + " islanders.", done: () => S.pop >= LIGHTHOUSE_POP, reward: { wood: 50, stone: 50 } },
  { text: "Build the Great Lighthouse 🗼!", done: () => count("lighthouse") >= 1, reward: {} },
];

// ---------- 5. little helpers ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
// hash2 turns a square's position into a "random" number that is always the same for that square
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// smooth "value noise": random numbers on a grid, blended smoothly in between
function makeNoise(seed) {
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}
// add big bumpy noise and smaller bumpy noise together, like real coastlines
function fbm(noise, x, y) {
  let sum = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < 4; i++) { sum += noise(x * freq, y * freq) * amp; total += amp; amp *= 0.5; freq *= 2; }
  return sum / total;
}
function fmtCost(cost) {
  return Object.keys(cost).map(k => cost[k] + RES_ICON[k]).join(" ");
}

// ---------- 6. making an island ----------
// Each square gets a height: high in the middle of the map, low at the edges, plus bumpy noise.
// Low squares are sea, a bit higher is sand, then grass, and the highest bits are rocks.
function generateIsland(seed) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = seed + attempt * 7919;
    const hN = makeNoise(s), mN = makeNoise(s + 101), rN = makeNoise(s + 202);
    const t = new Uint8Array(MAP_W * MAP_H);
    const heights = new Float32Array(MAP_W * MAP_H), wet = new Float32Array(MAP_W * MAP_H);
    let land = 0;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        const nx = (x + 0.5) / MAP_W * 2 - 1, ny = (y + 0.5) / MAP_H * 2 - 1;
        const d = Math.sqrt(nx * nx + ny * ny);
        let e = fbm(hN, x / 9, y / 9) * 0.7 + 0.62 - d * 0.95;
        if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) e = 0; // the edge of the map is always deep sea
        heights[i] = e;
        wet[i] = fbm(mN, x / 6, y / 6);
        let k;
        if (e < 0.30) k = DEEP;
        else if (e < 0.38) k = SHALLOW;
        else if (e < 0.43) k = SAND;
        else if (e > 0.7 && fbm(rN, x / 5, y / 5) > 0.55) k = ROCK;
        else if (wet[i] > 0.53) k = FOREST;
        else k = GRASS;
        t[i] = k;
        if (isLand(k)) land++;
      }
    }
    if (land < 300 || land > 750) continue; // too small or too big: try again
    // make sure there are enough rocks and forests to play with
    const kinds = k => { let n = 0; for (const v of t) if (v === k) n++; return n; };
    if (kinds(ROCK) < 10) {
      const spots = [...t.keys()].filter(i => t[i] === GRASS || t[i] === FOREST).sort((a, b) => heights[b] - heights[a]);
      spots.slice(0, 12).forEach(i => (t[i] = ROCK));
    }
    if (kinds(FOREST) < 30) {
      const spots = [...t.keys()].filter(i => t[i] === GRASS).sort((a, b) => wet[b] - wet[a]);
      spots.slice(0, 35).forEach(i => (t[i] = FOREST));
    }
    return t;
  }
  // we should never get here, but just in case: a plain round island
  const t = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = Math.hypot((x - MAP_W / 2) / 12, (y - MAP_H / 2) / 9);
    t[y * MAP_W + x] = d < 0.25 ? ROCK : d < 0.5 ? FOREST : d < 0.9 ? GRASS : d < 1 ? SAND : d < 1.15 ? SHALLOW : DEEP;
  }
  return t;
}

// ---------- 7. the game state ----------
let S = null;                                  // everything about the current island
let grid = new Array(MAP_W * MAP_H).fill(null); // which building sits on each square
let econ = { homes: 0, jobs: 0, base: { wood: 0, stone: 0, food: 0, gold: 0 } };
let econDirty = true;
let mode = "menu";                             // "menu", "play", "pause" or "won"
let tool = null;                               // the building or tool you are holding
const cam = { x: MAP_W * TILE / 2, y: MAP_H * TILE / 2, zoom: 1.2 };
let walkers = [], particles = [], floaters = [], bottles = [], birds = [];
let bottleTimer = 30, birdTimer = 5, questTimer = 0, saveTimer = 0, hudTimer = 0;
let hover = null;                              // the square under the mouse

function tAt(x, y) { return x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? DEEP : S.terrain[y * MAP_W + x]; }
function bAt(x, y) { return x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? null : grid[y * MAP_W + x]; }
function count(type) { let n = 0; for (const b of S.buildings) if (b.t === type) n++; return n; }
function countNear(x, y, r, kind) {
  let n = 0;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (tAt(x + i, y + j) === kind) n++;
  return n;
}
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function waterDir(x, y) {
  for (const d of DIRS) if (isWater(tAt(x + d[0], y + d[1]))) return d;
  return null;
}

function makeState(seed) {
  const terrain = generateIsland(seed);
  const st = {
    seed, terrain, buildings: [], res: { wood: START.wood, stone: START.stone, food: START.food, gold: START.gold },
    pop: START.pop, time: DAY_LENGTH * 0.1, quest: 0, raised: 0, planted: 0, won: false, growT: 0, leaveT: 0,
  };
  // put the camp on the grass square closest to the middle
  let best = null, bestD = 1e9;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (terrain[y * MAP_W + x] !== GRASS) continue;
    const d = Math.hypot(x - MAP_W / 2, y - MAP_H / 2);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  if (!best) best = { x: MAP_W >> 1, y: MAP_H >> 1 };
  st.buildings.push({ t: "camp", x: best.x, y: best.y });
  return st;
}

function useState(st) {
  S = st;
  grid = new Array(MAP_W * MAP_H).fill(null);
  for (const b of S.buildings) grid[b.y * MAP_W + b.x] = b;
  econDirty = true;
  walkers = []; particles = []; floaters = []; bottles = []; birds = [];
  bottleTimer = rand(20, 35);
  paintAllGround();
  const camp = S.buildings.find(b => b.t === "camp") || S.buildings[0];
  if (camp) { cam.x = (camp.x + 0.5) * TILE; cam.y = (camp.y + 0.5) * TILE; }
}

// ---------- 8. saving and loading (in this browser only) ----------
function save() {
  if (!S || mode === "menu") return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, seed: S.seed, terrain: Array.from(S.terrain).join(""), buildings: S.buildings.map(b => [b.t, b.x, b.y]),
      res: S.res, pop: S.pop, time: S.time, quest: S.quest, raised: S.raised, planted: S.planted, won: S.won,
    }));
  } catch (e) { /* the browser won't let us save: that's okay, the game still works */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== 1 || typeof d.terrain !== "string" || d.terrain.length !== MAP_W * MAP_H) return null;
    return {
      seed: d.seed, terrain: Uint8Array.from(d.terrain, c => +c),
      buildings: d.buildings.filter(b => DEFS[b[0]]).map(b => ({ t: b[0], x: b[1], y: b[2] })),
      res: d.res, pop: d.pop, time: d.time, quest: d.quest, raised: d.raised || 0, planted: d.planted || 0,
      won: !!d.won, growT: 0, leaveT: 0,
    };
  } catch (e) { return null; }
}

// ---------- 9. the economy: homes, jobs and what everything makes ----------
function computeEconomy() {
  const base = { wood: 0, stone: 0, food: 0, gold: 0 };
  let homes = 0, jobs = 0;
  for (const b of S.buildings) {
    const d = DEFS[b.t];
    homes += d.homes || 0;
    jobs += d.jobs || 0;
    b.make = d.make ? d.make(b) : null;
    if (b.make) for (const k in b.make) base[k] += b.make[k];
  }
  econ = { homes, jobs, base };
  econDirty = false;
}
// "efficiency": if there are fewer islanders than jobs, every building works a bit slower
function efficiency() { return econ.jobs === 0 ? 1 : Math.min(1, S.pop / econ.jobs); }
function rates() {
  const eff = efficiency(), r = {};
  for (const k in econ.base) r[k] = econ.base[k] * eff;
  r.food -= S.pop * EAT;
  return r;
}
function afford(cost) { for (const k in cost) if (S.res[k] < cost[k]) return false; return true; }
function missing(cost) {
  for (const k in cost) if (S.res[k] < cost[k]) return "You need " + Math.ceil(cost[k] - S.res[k]) + " more " + RES_ICON[k];
  return "";
}
function pay(cost) { for (const k in cost) S.res[k] -= cost[k]; }
function give(cost) { for (const k in cost) S.res[k] += cost[k]; }

// ---------- 10. building rules ----------
function raiseCost(k) { return k === SHALLOW ? { stone: 5 } : { stone: 8 }; }
// canUse says if the tool you hold works on square x, y. It returns { ok, why }.
function canUse(name, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return { ok: false, why: "That's off the map!" };
  const k = tAt(x, y), here = bAt(x, y);
  if (name === "raise") {
    if (!isWater(k)) return { ok: false, why: "Raise Land only works on the sea." };
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return { ok: false, why: "That's too far out at sea." };
    const c = raiseCost(k);
    return afford(c) ? { ok: true, cost: c } : { ok: false, why: missing(c) };
  }
  if (name === "plant") {
    if (here) return { ok: false, why: "There's a building here." };
    if (k !== GRASS) return { ok: false, why: "Trees only grow on grass." };
    return afford(TOOLS.plant.cost) ? { ok: true, cost: TOOLS.plant.cost } : { ok: false, why: missing(TOOLS.plant.cost) };
  }
  if (name === "clear") {
    if (here && here.t === "camp") return { ok: false, why: "The camp is where it all started. Keep it!" };
    if (here) return { ok: true };
    if (k === FOREST) return { ok: true };
    return { ok: false, why: "Nothing to clear here." };
  }
  const d = DEFS[name];
  if (here) return { ok: false, why: "Something is already built here." };
  if (!d.on.includes(k)) return { ok: false, why: d.name + " can't go on " + GROUND_NAMES[k] + "." };
  if (d.near === "water" && !waterDir(x, y)) return { ok: false, why: d.name + " has to be right next to the sea." };
  if (d.near === "forest" && countNear(x, y, 2, FOREST) === 0) return { ok: false, why: "Put the Lumber Camp close to a forest." };
  if (d.near === "rock" && countNear(x, y, 2, ROCK) === 0) return { ok: false, why: "Put the Quarry close to some rocks." };
  if (d.one && count(name) > 0) return { ok: false, why: "You already have one!" };
  if (d.needPop && S.pop < d.needPop) return { ok: false, why: "You need " + d.needPop + " islanders first (you have " + S.pop + ")." };
  if (!afford(d.cost)) return { ok: false, why: missing(d.cost) };
  return { ok: true, cost: d.cost };
}

function useTool(name, x, y) {
  const r = canUse(name, x, y);
  const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
  if (!r.ok) { sfx.error(); toast(r.why); return; }
  if (name === "raise") {
    const k = tAt(x, y);
    pay(r.cost);
    S.terrain[y * MAP_W + x] = k === SHALLOW ? SAND : SHALLOW;
    if (k === SHALLOW) S.raised++;
    bottles = bottles.filter(b => Math.floor(b.x / TILE) !== x || Math.floor(b.y / TILE) !== y || !isLand(tAt(x, y)));
    repaintAround(x, y);
    splash(cx, cy, "#bfe9ff", 14);
    sfx.splash();
  } else if (name === "plant") {
    pay(r.cost);
    S.terrain[y * MAP_W + x] = FOREST;
    S.planted++;
    repaintAround(x, y);
    splash(cx, cy, "#4caf50", 10);
    sfx.pop();
  } else if (name === "clear") {
    const here = bAt(x, y);
    if (here) {
      const d = DEFS[here.t], back = {};
      for (const k in d.cost) back[k] = Math.floor(d.cost[k] / 2);
      give(back);
      S.buildings.splice(S.buildings.indexOf(here), 1);
      grid[y * MAP_W + x] = null;
      if (Object.keys(back).length) floatText(cx, cy, "+" + fmtCost(back));
    } else {
      S.terrain[y * MAP_W + x] = GRASS;
      S.res.wood += 4;
      floatText(cx, cy, "+4🪵");
    }
    repaintAround(x, y);
    splash(cx, cy, "#c9b08a", 14);
    sfx.clear();
  } else {
    pay(r.cost);
    const b = { t: name, x, y };
    S.buildings.push(b);
    grid[y * MAP_W + x] = b;
    repaintAround(x, y);
    splash(cx, cy + 8, "#f5f0e6", 16);
    sfx.build();
    if (name === "lighthouse") setTimeout(win, 900);
  }
  econDirty = true;
  updateHud(true);
}

function inspect(x, y) {
  const b = bAt(x, y);
  if (!b) {
    const k = tAt(x, y);
    if (k >= 0) toast(GROUND_NAMES[k][0].toUpperCase() + GROUND_NAMES[k].slice(1));
    return;
  }
  const d = DEFS[b.t];
  let msg = d.icon + " " + d.name + ": ";
  if (d.homes) msg += "home for " + d.homes + " islanders";
  if (b.make) {
    const eff = efficiency();
    msg += "makes " + Object.keys(b.make).map(k => (b.make[k] * eff).toFixed(1) + RES_ICON[k]).join(" ") + " every second";
    if (eff < 1) msg += " (needs more workers!)";
  }
  if (b.t === "lighthouse") msg += "the wonder of your island!";
  toast(msg);
}

function win() {
  if (S.won) return;
  S.won = true;
  S.quest = QUESTS.length;
  sfx.win();
  const day = Math.floor(S.time / DAY_LENGTH) + 1;
  document.getElementById("win-text").innerHTML =
    "You built the <b>Great Lighthouse</b> on day <b>" + day + "</b> with <b>" + S.pop + "</b> islanders. Ships from all over the sea can find your island now!";
  setMode("won");
  updateHud(true);
  save();
}

// ---------- 11. every frame: resources, islanders, goals ----------
function update(dt) {
  if (econDirty) computeEconomy();
  S.time += dt;

  // resources
  const eff = efficiency();
  for (const k in econ.base) S.res[k] += econ.base[k] * eff * dt;
  S.res.food -= S.pop * EAT * dt;
  if (S.res.food < 0) S.res.food = 0;

  // islanders arrive when there is a free home and some food
  if (S.pop < econ.homes && S.res.food >= 3) {
    S.growT += dt;
    if (S.growT >= GROW_EVERY) {
      S.growT = 0;
      S.pop++;
      const camp = S.buildings[0];
      if (camp) floatText((camp.x + 0.5) * TILE, camp.y * TILE, "+1👥");
    }
  } else S.growT = 0;

  // ...and leave when there is no food or not enough homes
  const hungry = S.res.food <= 0, crowded = S.pop > econ.homes;
  if ((hungry || crowded) && S.pop > 1) {
    S.leaveT += dt;
    if (S.leaveT >= LEAVE_EVERY) {
      S.leaveT = 0;
      S.pop--;
      toast(hungry ? "An islander sailed away hungry! Build more food 🌾🐟" : "An islander had no home and sailed away. Build more homes 🛖");
    }
  } else S.leaveT = 0;

  // goals
  questTimer -= dt;
  if (questTimer <= 0) {
    questTimer = 0.4;
    const q = QUESTS[S.quest];
    if (q && q.done()) {
      give(q.reward);
      S.quest++;
      if (S.quest < QUESTS.length) {
        sfx.quest();
        toast("Goal done! " + (Object.keys(q.reward).length ? "+" + fmtCost(q.reward) : ""));
      }
      updateHud(true);
      save();
    }
  }

  // message in a bottle: they float in now and then. Click one for a present!
  bottleTimer -= dt;
  if (bottleTimer <= 0) { bottleTimer = rand(35, 60); spawnBottle(); }
  for (const b of bottles) b.life -= dt;
  bottles = bottles.filter(b => b.life > 0);

  // auto save every 10 seconds
  saveTimer += dt;
  if (saveTimer > 10) { saveTimer = 0; save(); }

  // move the camera with the keyboard
  const sp = 520 / cam.zoom * dt;
  if (keys.left) cam.x -= sp;
  if (keys.right) cam.x += sp;
  if (keys.up) cam.y -= sp;
  if (keys.down) cam.y += sp;
  clampCam();

  updateLife(dt);
  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.25; updateHud(false); }
  music(dt);
}

function spawnBottle() {
  for (let tries = 0; tries < 300; tries++) {
    const x = 1 + Math.floor(Math.random() * (MAP_W - 2)), y = 1 + Math.floor(Math.random() * (MAP_H - 2));
    if (tAt(x, y) !== SHALLOW) continue;
    if (!DIRS.some(d => isLand(tAt(x + d[0], y + d[1])))) continue;
    bottles.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, life: 45, seed: Math.random() * 10 });
    return;
  }
}
function openBottle(b) {
  bottles.splice(bottles.indexOf(b), 1);
  const gifts = [{ wood: 20 }, { food: 20 }, { stone: 12 }, { gold: 12 }, { wood: 10, stone: 8 }];
  const g = gifts[Math.floor(Math.random() * gifts.length)];
  give(g);
  floatText(b.x, b.y - 10, "+" + fmtCost(g));
  toast("📜 A message in a bottle! It says: \"Here's a present!\"");
  sfx.coin();
  updateHud(true);
}

// ---------- 12. little islanders, birds and puffs of dust ----------
const SHIRTS = ["#e4572e", "#3d7dd8", "#f5b82e", "#8e5bd8", "#2bb39b", "#ff7fa8", "#ffffff"];
function landPath(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 0; i <= n; i++) {
    const x = lerp(ax, bx, i / n), y = lerp(ay, by, i / n);
    if (!isLand(tAt(Math.floor(x / TILE), Math.floor(y / TILE)))) return false;
  }
  return true;
}
function pickTarget(w) {
  for (let tries = 0; tries < 6; tries++) {
    const b = S.buildings[Math.floor(Math.random() * S.buildings.length)];
    if (!b) return;
    const tx = (b.x + 0.5) * TILE + rand(-10, 10), ty = (b.y + 0.85) * TILE + rand(-3, 3);
    if (Math.hypot(tx - w.x, ty - w.y) > 9 * TILE) continue;
    if (!landPath(w.x, w.y, tx, ty)) continue;
    w.tx = tx; w.ty = ty;
    return;
  }
  w.wait = rand(1, 3);
}
function updateLife(dt) {
  // keep the number of walking islanders matched to the population (up to 40)
  const want = Math.min(S.pop, 40);
  while (walkers.length < want && S.buildings.length) {
    const b = S.buildings[Math.floor(Math.random() * S.buildings.length)];
    const w = { x: (b.x + 0.5) * TILE, y: (b.y + 0.85) * TILE, tx: 0, ty: 0, wait: rand(0, 2), speed: rand(14, 24), shirt: SHIRTS[walkers.length % SHIRTS.length], step: Math.random() * 6 };
    w.tx = w.x; w.ty = w.y;
    walkers.push(w);
  }
  if (walkers.length > want) walkers.length = want;
  for (const w of walkers) {
    if (w.wait > 0) { w.wait -= dt; if (w.wait <= 0) pickTarget(w); continue; }
    const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { w.wait = rand(1, 4); continue; }
    w.x += dx / d * w.speed * dt;
    w.y += dy / d * w.speed * dt;
    w.step += dt * 10;
    if (!isLand(tAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE)))) { w.tx = w.x; w.ty = w.y; w.wait = 0.5; } // the land changed under them
  }

  birdTimer -= dt;
  if (birdTimer <= 0) {
    birdTimer = rand(8, 20);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const n = 2 + Math.floor(Math.random() * 3), y0 = rand(0, MAP_H * TILE);
    for (let i = 0; i < n; i++) birds.push({ x: dir > 0 ? -40 - i * 18 : MAP_W * TILE + 40 + i * 18, y: y0 + i * 10, vx: dir * rand(55, 70), flap: Math.random() * 6 });
  }
  for (const b of birds) { b.x += b.vx * dt; b.flap += dt * 9; }
  birds = birds.filter(b => b.x > -200 && b.x < MAP_W * TILE + 200);

  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const f of floaters) { f.y -= 18 * dt; f.life -= dt; }
  floaters = floaters.filter(f => f.life > 0);
}
function splash(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(15, 45);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 15, life: rand(0.4, 0.8), max: 0.8, r: rand(2, 4), color });
  }
}
function floatText(x, y, text) { floaters.push({ x, y, text, life: 1.6 }); }

// ---------- 13. drawing the ground ----------
// The ground hardly ever changes, so we paint it once onto a hidden canvas (the "cache") and
// copy that picture every frame. When you raise land or plant a tree, we repaint just those squares.
const cache = document.createElement("canvas");
cache.width = MAP_W * TILE * CACHE_SCALE;
cache.height = MAP_H * TILE * CACHE_SCALE;
const cg = cache.getContext("2d");

function paintAllGround() {
  cg.setTransform(CACHE_SCALE, 0, 0, CACHE_SCALE, 0, 0);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) paintTile(x, y);
}
function repaintAround(x, y) {
  cg.setTransform(CACHE_SCALE, 0, 0, CACHE_SCALE, 0, 0);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    if (x + i >= 0 && y + j >= 0 && x + i < MAP_W && y + j < MAP_H) paintTile(x + i, y + j);
  }
}
function paintTile(x, y) {
  const g = cg, k = tAt(x, y), px = x * TILE, py = y * TILE;
  const h = hash2(x, y, 7), h2 = hash2(x, y, 11), h3 = hash2(x, y, 13);
  const shades = GROUND_COLORS[k];
  g.fillStyle = shades[Math.floor(h * shades.length)];
  g.fillRect(px, py, TILE, TILE);
  const built = !!bAt(x, y);

  if (k === SHALLOW) {
    // the sea gets lighter near the beach
    for (const d of DIRS) {
      if (!isLand(tAt(x + d[0], y + d[1]))) continue;
      g.fillStyle = "rgba(160, 230, 245, 0.45)";
      if (d[0] === 1) g.fillRect(px + TILE - 8, py, 8, TILE);
      if (d[0] === -1) g.fillRect(px, py, 8, TILE);
      if (d[1] === 1) g.fillRect(px, py + TILE - 8, TILE, 8);
      if (d[1] === -1) g.fillRect(px, py, TILE, 8);
    }
  }
  if (k === DEEP) {
    for (const d of DIRS) {
      if (tAt(x + d[0], y + d[1]) !== SHALLOW) continue;
      g.fillStyle = "rgba(70, 170, 225, 0.35)";
      if (d[0] === 1) g.fillRect(px + TILE - 6, py, 6, TILE);
      if (d[0] === -1) g.fillRect(px, py, 6, TILE);
      if (d[1] === 1) g.fillRect(px, py + TILE - 6, TILE, 6);
      if (d[1] === -1) g.fillRect(px, py, TILE, 6);
    }
  }
  if (isLand(k)) {
    // wet sand where the land meets the sea
    for (const d of DIRS) {
      if (!isWater(tAt(x + d[0], y + d[1]))) continue;
      g.fillStyle = k === SAND ? "#e2c27c" : "#d7c48a";
      if (d[0] === 1) g.fillRect(px + TILE - 3, py, 3, TILE);
      if (d[0] === -1) g.fillRect(px, py, 3, TILE);
      if (d[1] === 1) g.fillRect(px, py + TILE - 4, TILE, 4);
      if (d[1] === -1) g.fillRect(px, py, TILE, 3);
    }
  }
  if (k === SAND) {
    g.fillStyle = "#e0c57f";
    for (let i = 0; i < 4; i++) g.fillRect(px + 4 + hash2(x, y, 20 + i) * 22, py + 4 + hash2(x, y, 30 + i) * 22, 2, 2);
    if (h3 > 0.93) { g.fillStyle = "#ffb3a7"; g.beginPath(); g.arc(px + 8 + h * 14, py + 10 + h2 * 12, 2.5, 0, Math.PI * 2); g.fill(); } // a shell
    if (!built && h2 > 0.82) palmTree(g, px + 10 + h * 12, py + 24);
  }
  if (k === GRASS) {
    g.strokeStyle = "#5ea944";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const gx = px + 4 + hash2(x, y, 40 + i) * 24, gy = py + 6 + hash2(x, y, 50 + i) * 22;
      g.moveTo(gx - 2, gy - 3); g.lineTo(gx, gy); g.lineTo(gx + 2, gy - 3);
    }
    g.stroke();
    if (!built && h3 > 0.8) {
      g.fillStyle = ["#fff6a8", "#ff8fb1", "#ffffff", "#b7a4ff"][Math.floor(h2 * 4)];
      g.beginPath(); g.arc(px + 6 + h2 * 20, py + 6 + h * 20, 2, 0, Math.PI * 2); g.fill();
    }
  }
  if (k === FOREST) {
    const n = 2 + Math.floor(h * 2);
    const spots = [[9, 11], [22, 12], [15, 22], [24, 23], [8, 23]];
    for (let i = 0; i < n; i++) {
      const s = spots[(Math.floor(h2 * 5) + i * 2) % spots.length];
      tree(g, px + s[0] + (hash2(x, y, 60 + i) - 0.5) * 3, py + s[1] + (hash2(x, y, 70 + i) - 0.5) * 3, 6 + hash2(x, y, 80 + i) * 2);
    }
  }
  if (k === ROCK) {
    for (let i = 0; i < 2; i++) {
      const rx = px + 9 + hash2(x, y, 90 + i) * 14, ry = py + 10 + hash2(x, y, 95 + i) * 12, rr = 5 + hash2(x, y, 99 + i) * 3;
      g.fillStyle = "#7f7c75"; g.beginPath(); g.ellipse(rx + 1, ry + 2, rr, rr * 0.75, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#bdbab2"; g.beginPath(); g.ellipse(rx, ry, rr, rr * 0.75, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#d6d3cc"; g.beginPath(); g.ellipse(rx - rr * 0.3, ry - rr * 0.3, rr * 0.4, rr * 0.25, 0, 0, Math.PI * 2); g.fill();
    }
  }
}
function tree(g, x, y, r) {
  g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(x + 1, y + r * 0.8, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a4e2a"; g.fillRect(x - 1.5, y, 3, r * 0.8);
  g.fillStyle = "#2f7d32"; g.beginPath(); g.arc(x, y - 1, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#43a047"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.4, r * 0.55, 0, Math.PI * 2); g.fill();
}
function palmTree(g, x, y) {
  g.strokeStyle = "#9b6b3c"; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 9, x + 2, y - 17); g.stroke();
  g.fillStyle = "#3e9a3a";
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.75;
    g.beginPath();
    g.ellipse(x + 2 + Math.cos(a) * 5, y - 17 + Math.sin(a) * 3 + 2, 6, 2.2, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#6b4423"; g.beginPath(); g.arc(x + 2, y - 15, 1.6, 0, Math.PI * 2); g.fill();
}

// ---------- 14. drawing the buildings ----------
function shadow(g, x, y, rx, ry) { g.fillStyle = "rgba(0,0,0,0.2)"; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function poly(g, c, p) { g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); }
function circ(g, c, x, y, r) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function box(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function line(g, c, w, x1, y1, x2, y2) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }

const DRAW = {
  camp(g, x, y, t) {
    shadow(g, x + 15, y + 27, 13, 4);
    poly(g, "#e8873a", [x + 3, y + 26, x + 14, y + 6, x + 25, y + 26]);
    poly(g, "#c9692a", [x + 14, y + 6, x + 25, y + 26, x + 18, y + 26]);
    poly(g, "#5b3a1f", [x + 11, y + 26, x + 14, y + 16, x + 17, y + 26]);
    line(g, "#7a4e2a", 1.5, x + 14, y + 6, x + 14, y + 3);
    box(g, "#6b4423", x + 23, y + 27, 8, 2.5);
    const f = Math.sin(t * 13) * 0.6 + Math.sin(t * 7) * 0.4;
    circ(g, "#ff8a2b", x + 27, y + 24.5, 3.2 + f * 0.5);
    circ(g, "#ffe066", x + 27, y + 25.5, 1.6);
  },
  hut(g, x, y) {
    shadow(g, x + 16, y + 28, 12, 3.5);
    box(g, "#b07a45", x + 7, y + 15, 18, 13);
    box(g, "#8c5d31", x + 7, y + 25, 18, 3);
    box(g, "#5a3a1e", x + 14, y + 20, 5, 8);
    poly(g, "#e2b65a", [x + 3, y + 17, x + 16, y + 4, x + 29, y + 17]);
    poly(g, "#c99a3c", [x + 16, y + 4, x + 29, y + 17, x + 22, y + 17]);
    line(g, "#b88a35", 1, x + 8, y + 14, x + 13, y + 9);
    line(g, "#b88a35", 1, x + 12, y + 16, x + 17, y + 10);
  },
  farm(g, x, y, t) {
    box(g, "#a0703f", x + 2, y + 4, 28, 25);
    for (let i = 0; i < 4; i++) {
      const yy = y + 9 + i * 6;
      box(g, "#7d5530", x + 3, yy + 2, 26, 1.5);
      for (let j = 0; j < 6; j++) {
        const xx = x + 5 + j * 4.4, sw = Math.sin(t * 2 + j * 0.7 + i) * 1.1;
        line(g, "#c9a83a", 1, xx, yy + 3, xx + sw, yy - 2);
        circ(g, "#f4d860", xx + sw, yy - 2.5, 1.4);
      }
    }
    for (const fx of [2, 15.5, 29]) box(g, "#e6d0a8", x + fx - 1, y + 3, 2, 27);
    box(g, "#e6d0a8", x + 1, y + 29, 30, 1.5);
  },
  dock(g, x, y, t, b) {
    const d = waterDir(b.x, b.y) || [1, 0];
    g.save();
    g.translate(x + 16, y + 16);
    g.rotate(Math.atan2(d[1], d[0]));
    shadow(g, 8, 3, 18, 5);
    box(g, "#a0703f", -6, -5, 30, 10);
    for (let i = -4; i < 24; i += 5) line(g, "#7d5530", 1, i, -5, i, 5);
    circ(g, "#6b4423", 23, -5, 1.8); circ(g, "#6b4423", 23, 5, 1.8);
    const bob = Math.sin(t * 2) * 1.2;
    // a little fishing boat
    g.fillStyle = "#c8553d"; g.beginPath(); g.ellipse(28, 11 + bob, 8, 3.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4f1ea"; g.beginPath(); g.ellipse(28, 10.5 + bob, 5, 1.8, 0, 0, Math.PI * 2); g.fill();
    // a crate of fish
    box(g, "#8c5d31", -14, -12, 8, 7);
    circ(g, "#9fd3f0", -12, -10, 1.3); circ(g, "#9fd3f0", -9, -9, 1.3);
    g.restore();
  },
  lumber(g, x, y) {
    shadow(g, x + 15, y + 28, 14, 3.5);
    box(g, "#8a5a32", x + 3, y + 13, 15, 14);
    for (let i = 0; i < 4; i++) line(g, "#6b4423", 1, x + 3, y + 16 + i * 3.3, x + 18, y + 16 + i * 3.3);
    box(g, "#4a2f18", x + 8, y + 20, 5, 7);
    poly(g, "#5d3b1f", [x + 1, y + 14, x + 10.5, y + 5, x + 20, y + 14]);
    for (const [lx, ly] of [[22, 26], [28, 26], [25, 21]]) { circ(g, "#a8743f", x + lx, y + ly, 3.2); circ(g, "#e0b47a", x + lx, y + ly, 1.6); }
    box(g, "#7a4e2a", x + 21, y + 9, 7, 5);
    box(g, "#c49a6c", x + 21, y + 8, 7, 1.5);
    line(g, "#8a5a32", 1.5, x + 24.5, y + 9, x + 28, y + 3);
    poly(g, "#cfd6dc", [x + 26, y + 2, x + 30, y + 3.5, x + 28.5, y + 6]);
  },
  quarry(g, x, y) {
    g.fillStyle = "#7d7972"; g.beginPath(); g.ellipse(x + 16, y + 17, 13, 9.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5b5751"; g.beginPath(); g.ellipse(x + 16, y + 18, 8, 5.5, 0, 0, Math.PI * 2); g.fill();
    box(g, "#d6d1c6", x + 3, y + 23, 7, 6); box(g, "#b9b3a6", x + 3, y + 28, 7, 1.5);
    box(g, "#d6d1c6", x + 22, y + 4, 7, 6); box(g, "#b9b3a6", x + 22, y + 9, 7, 1.5);
    box(g, "#cfcac0", x + 23, y + 24, 6, 5);
    line(g, "#8a5a32", 2, x + 6, y + 15, x + 12, y + 5);
    g.strokeStyle = "#8f98a3"; g.lineWidth = 2.2; g.beginPath(); g.arc(x + 12, y + 9, 5, -Math.PI * 0.95, -Math.PI * 0.05); g.stroke();
  },
  house(g, x, y, t) {
    shadow(g, x + 16, y + 29, 13, 3.5);
    box(g, "#d6d1c6", x + 5, y + 14, 22, 15);
    g.strokeStyle = "#b9b3a6"; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 3; i++) { g.moveTo(x + 5, y + 18.5 + i * 4); g.lineTo(x + 27, y + 18.5 + i * 4); }
    g.stroke();
    box(g, "#6b4423", x + 13, y + 21, 6, 8);
    box(g, "#5b7fa3", x + 7, y + 17, 4, 4); box(g, "#5b7fa3", x + 21, y + 17, 4, 4);
    box(g, "#8f8a80", x + 21, y + 4, 4, 8);
    poly(g, "#c8553d", [x + 2, y + 15, x + 16, y + 3, x + 30, y + 15]);
    poly(g, "#a8432f", [x + 16, y + 3, x + 30, y + 15, x + 23, y + 15]);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.45 + i / 3) % 1;
      circ(g, "rgba(235,235,235," + (0.55 * (1 - p)).toFixed(2) + ")", x + 23 + p * 5, y + 3 - p * 13, 1.8 + p * 3);
    }
  },
  market(g, x, y, t) {
    shadow(g, x + 16, y + 29, 14, 3.5);
    box(g, "#7a4e2a", x + 4, y + 6, 2, 12); box(g, "#7a4e2a", x + 26, y + 6, 2, 12);
    box(g, "#9b6a3c", x + 4, y + 18, 24, 10);
    box(g, "#c08a52", x + 3, y + 16, 26, 3);
    const fruit = ["#e94f4f", "#ffa62b", "#7bc043", "#f4d03f", "#e94f4f", "#ffa62b"];
    fruit.forEach((c, i) => circ(g, c, x + 6 + i * 4, y + 14.5, 2));
    for (let i = 0; i < 6; i++) {
      const a = x + 2 + i * 4.67, b = a + 4.67;
      poly(g, i % 2 ? "#ffffff" : "#e94f4f", [a, y + 4, b, y + 4, b, y + 9, a, y + 9]);
      circ(g, i % 2 ? "#ffffff" : "#e94f4f", (a + b) / 2, y + 9, 2.33);
    }
    line(g, "#6b4423", 1, x + 16, y + 4, x + 16, y - 3);
    poly(g, "#ffcf3f", [x + 16, y - 3, x + 22 + Math.sin(t * 5) * 1.5, y - 1.5, x + 16, y]);
  },
  harbor(g, x, y, t, b) {
    const d = waterDir(b.x, b.y) || [1, 0];
    g.save();
    g.translate(x + 16, y + 16);
    g.rotate(Math.atan2(d[1], d[0]));
    shadow(g, 10, 4, 22, 7);
    box(g, "#946639", -10, -8, 38, 16);
    for (let i = -8; i < 28; i += 5) line(g, "#6f4a27", 1, i, -8, i, 8);
    for (const py of [-8, 8]) for (const px of [-8, 8, 26]) circ(g, "#5a3a1e", px, py, 2);
    // a trading ship
    const bob = Math.sin(t * 1.6) * 1.5;
    g.save();
    g.translate(36, 14 + bob);
    g.fillStyle = "#7a4e2a"; g.beginPath(); g.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#a0703f"; g.beginPath(); g.ellipse(0, -1, 12, 3.6, 0, 0, Math.PI * 2); g.fill();
    line(g, "#5a3a1e", 1.5, 0, -1, 0, -14);
    poly(g, "#f4f1ea", [1, -14, 1, -3, 11, -4]);
    poly(g, "#e94f4f", [0, -14, -6, -12, 0, -10]);
    g.restore();
    // crates and a crane
    box(g, "#c08a52", -8, -16, 7, 7); box(g, "#a0703f", -1, -15, 6, 6);
    line(g, "#5a3a1e", 2, 18, -10, 18, -22);
    line(g, "#5a3a1e", 1.5, 18, -22, 28, -18);
    line(g, "#5a3a1e", 1, 28, -18, 28, -12);
    g.restore();
  },
  lighthouse(g, x, y) {
    shadow(g, x + 16, y + 29, 13, 4);
    box(g, "#8f8a80", x + 4, y + 22, 24, 8);
    box(g, "#a7a297", x + 4, y + 22, 24, 2);
    const W = yy => { const k = (y + 24 - yy) / 50; return [lerp(x + 8.5, x + 11, k), lerp(x + 23.5, x + 21, k)]; };
    const [l0, r0] = W(y + 24), [l1, r1] = W(y - 26);
    poly(g, "#f4f1ea", [l0, y + 24, l1, y - 26, r1, y - 26, r0, y + 24]);
    for (const [a, b] of [[y + 14, y + 5], [y - 5, y - 14]]) {
      const [la, ra] = W(a), [lb, rb] = W(b);
      poly(g, "#d64545", [la, a, lb, b, rb, b, ra, a]);
    }
    poly(g, "rgba(0,0,0,0.08)", [(l0 + r0) / 2 + 2, y + 24, (l1 + r1) / 2 + 2, y - 26, r1, y - 26, r0, y + 24]);
    box(g, "#5a3a1e", x + 14, y + 17, 4, 7);
    box(g, "#3b3b4f", x + 9, y - 28, 14, 2.5);
    box(g, "#3b3b4f", x + 10.5, y - 36, 11, 8);
    box(g, "#ffe680", x + 12, y - 35, 8, 6);
    poly(g, "#d64545", [x + 9, y - 36, x + 16, y - 44, x + 23, y - 36]);
    circ(g, "#ffcf3f", x + 16, y - 45, 1.5);
  },
};
// where each building glows at night: [x, y, size]
const LIGHTS = {
  camp: [[27, 24, 30]], hut: [[16, 23, 16]], house: [[9, 19, 14], [23, 19, 14]],
  market: [[16, 15, 20]], lumber: [[10, 21, 12]], harbor: [[16, 16, 18]], dock: [[16, 16, 12]], lighthouse: [[16, -32, 28]],
};

function drawBuilding(g, b, t) {
  DRAW[b.t](g, b.x * TILE, b.y * TILE, t, b);
}

// ---------- 15. drawing everything ----------
const view = document.getElementById("view");
const ctx = view.getContext("2d");
let cw = 0, ch = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = window.innerWidth; ch = window.innerHeight;
  view.width = Math.round(cw * dpr); view.height = Math.round(ch * dpr);
  clampCam();
}
window.addEventListener("resize", resize);

function clampCam() {
  cam.zoom = clamp(cam.zoom, 0.5, 2.6);
  cam.x = clamp(cam.x, 0, MAP_W * TILE);
  cam.y = clamp(cam.y, 0, MAP_H * TILE);
}
function toWorld(sx, sy) { return { x: (sx - cw / 2) / cam.zoom + cam.x, y: (sy - ch / 2) / cam.zoom + cam.y }; }

function nightAmount() {
  const phase = (S.time % DAY_LENGTH) / DAY_LENGTH;
  return clamp((Math.cos(Math.PI * 2 * (phase - 0.85)) - 0.5) * 2, 0, 1);
}

function draw(t) {
  const g = ctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = GROUND_COLORS[DEEP][0];
  g.fillRect(0, 0, cw, ch);
  if (!S) return;

  const z = cam.zoom;
  g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cw / 2 - cam.x * z), dpr * (ch / 2 - cam.y * z));
  g.imageSmoothingEnabled = true;
  g.drawImage(cache, 0, 0, MAP_W * TILE, MAP_H * TILE);

  // which squares are on the screen?
  const tl = toWorld(0, 0), br = toWorld(cw, ch);
  const x0 = Math.max(0, Math.floor(tl.x / TILE) - 1), y0 = Math.max(0, Math.floor(tl.y / TILE) - 1);
  const x1 = Math.min(MAP_W - 1, Math.floor(br.x / TILE) + 1), y1 = Math.min(MAP_H - 1, Math.floor(br.y / TILE) + 2);

  drawWater(g, t, x0, y0, x1, y1);

  // bottles bobbing in the sea
  for (const b of bottles) {
    const bob = Math.sin(t * 2 + b.seed) * 1.5, blink = b.life < 8 && Math.floor(t * 4) % 2 === 0;
    if (blink) continue;
    g.save();
    g.translate(b.x, b.y + bob);
    g.rotate(Math.sin(t * 1.5 + b.seed) * 0.3 + 0.6);
    circ(g, "rgba(255,255,255,0.35)", 0, 3, 7);
    box(g, "#7fd7a8", -6, -3, 10, 6);
    box(g, "#bff0d4", -5, -2, 4, 1.5);
    box(g, "#8a5a32", 4, -1.5, 3, 3);
    g.restore();
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    g.strokeStyle = "rgba(255,255,200," + (0.3 + pulse * 0.4).toFixed(2) + ")";
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(b.x, b.y + bob, 11 + pulse * 2, 0, Math.PI * 2); g.stroke();
  }

  // the area a lumber camp or quarry would work in
  if (hover && (tool === "lumber" || tool === "quarry")) {
    g.fillStyle = "rgba(255,255,255,0.13)";
    g.fillRect((hover.x - 2) * TILE, (hover.y - 2) * TILE, 5 * TILE, 5 * TILE);
  }

  // buildings, one row at a time from the top, so things in front cover things behind
  for (let y = y0; y <= y1 + 2 && y < MAP_H; y++) {
    for (let x = x0; x <= x1; x++) {
      const b = grid[y * MAP_W + x];
      if (b) drawBuilding(g, b, t);
    }
    // islanders walking in this row
    for (const w of walkers) if (Math.floor(w.y / TILE) === y) drawWalker(g, w);
  }

  drawGhost(g, t);

  for (const p of particles) {
    g.globalAlpha = clamp(p.life / p.max, 0, 1);
    circ(g, p.color, p.x, p.y, p.r);
  }
  g.globalAlpha = 1;

  // seagulls
  g.strokeStyle = "#ffffff"; g.lineWidth = 1.6;
  for (const b of birds) {
    const f = Math.sin(b.flap) * 3;
    g.beginPath();
    g.moveTo(b.x - 6, b.y - f); g.quadraticCurveTo(b.x - 3, b.y - 3, b.x, b.y);
    g.quadraticCurveTo(b.x + 3, b.y - 3, b.x + 6, b.y - f);
    g.stroke();
  }

  // night: darken everything, then add the glowing windows on top
  const night = nightAmount();
  if (night > 0.01) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "rgba(10, 22, 64, " + (night * 0.5).toFixed(3) + ")";
    g.fillRect(0, 0, cw, ch);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cw / 2 - cam.x * z), dpr * (ch / 2 - cam.y * z));
    g.globalCompositeOperation = "lighter";
    for (let y = y0; y <= y1 + 2 && y < MAP_H; y++) for (let x = x0; x <= x1; x++) {
      const b = grid[y * MAP_W + x];
      if (!b || !LIGHTS[b.t]) continue;
      for (const [lx, ly, r] of LIGHTS[b.t]) {
        const cx = x * TILE + lx, cy = y * TILE + ly;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, "rgba(255, 200, 90, " + (night * 0.55).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(255, 160, 40, 0)");
        g.fillStyle = grad;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
    g.globalCompositeOperation = "source-over";
  }
  // the lighthouse beam turns round and round at night (we draw it even off screen, it's long!)
  const lh = S.buildings.find(b => b.t === "lighthouse");
  if (lh && night > 0.05) {
    const cx = lh.x * TILE + 16, cy = lh.y * TILE - 32, a = t * 0.9;
    g.globalCompositeOperation = "lighter";
    for (const side of [0, Math.PI]) {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 260);
      grad.addColorStop(0, "rgba(255, 240, 160, " + (night * 0.45).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(255, 240, 160, 0)");
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 260, a + side - 0.12, a + side + 0.12); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  // floating "+1" texts
  g.textAlign = "center";
  g.font = "bold 13px Nunito, sans-serif";
  for (const f of floaters) {
    g.globalAlpha = clamp(f.life, 0, 1);
    g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,0.55)";
    g.strokeText(f.text, f.x, f.y);
    g.fillStyle = "#fff6c2";
    g.fillText(f.text, f.x, f.y);
  }
  g.globalAlpha = 1;
}

function drawWater(g, t, x0, y0, x1, y1) {
  // little waves that come and go
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1.3;
  g.beginPath();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!isWater(tAt(x, y))) continue;
    const h = hash2(x, y, 3), s = Math.sin(t * 1.2 + h * 6.283);
    if (s < 0.25) continue;
    const wx = x * TILE + 4 + h * 18, wy = y * TILE + 6 + hash2(x, y, 5) * 18 + Math.sin(t * 0.8 + h * 9) * 1.5;
    g.moveTo(wx, wy);
    g.quadraticCurveTo(wx + 4, wy - 3 * s, wx + 8, wy);
  }
  g.stroke();
  // white foam where waves hit the beach
  g.fillStyle = "#ffffff";
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!isWater(tAt(x, y))) continue;
    for (const d of DIRS) {
      if (!isLand(tAt(x + d[0], y + d[1]))) continue;
      const w = 2.5 + 1.5 * Math.sin(t * 2 + x * 0.9 + y * 1.3);
      g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2.4 + x + y);
      if (d[0] === 1) g.fillRect((x + 1) * TILE - w, y * TILE, w, TILE);
      if (d[0] === -1) g.fillRect(x * TILE, y * TILE, w, TILE);
      if (d[1] === 1) g.fillRect(x * TILE, (y + 1) * TILE - w, TILE, w);
      if (d[1] === -1) g.fillRect(x * TILE, y * TILE, TILE, w);
    }
  }
  g.globalAlpha = 1;
}

function drawWalker(g, w) {
  const moving = w.wait <= 0, bob = moving ? Math.abs(Math.sin(w.step)) * 1.2 : 0;
  circ(g, "rgba(0,0,0,0.2)", w.x, w.y + 1, 2.4);
  box(g, "#3d3a4f", w.x - 1.6, w.y - 3, 1.3, 3);
  box(g, "#3d3a4f", w.x + 0.3, w.y - 3, 1.3, 3);
  box(g, w.shirt, w.x - 2.3, w.y - 7 - bob, 4.6, 4.5);
  circ(g, "#f2c9a0", w.x, w.y - 9 - bob, 2);
}

function drawGhost(g, t) {
  if (!hover || !tool || mode !== "play") return;
  const { x, y } = hover;
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
  const r = canUse(tool, x, y);
  if (DEFS[tool] && !bAt(x, y)) {
    g.globalAlpha = 0.6;
    drawBuilding(g, { t: tool, x, y }, t);
    g.globalAlpha = 1;
  }
  g.lineWidth = 2;
  g.strokeStyle = r.ok ? "rgba(120,255,140,0.95)" : "rgba(255,90,90,0.95)";
  g.fillStyle = r.ok ? "rgba(120,255,140,0.18)" : "rgba(255,90,90,0.18)";
  g.fillRect(x * TILE, y * TILE, TILE, TILE);
  g.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
}

// ---------- 16. the HUD and the toolbar ----------
const $ = id => document.getElementById(id);
const toolbar = $("toolbar");
for (const name of TOOL_ORDER) {
  const d = DEFS[name] || TOOLS[name];
  const key = Object.keys(TOOL_KEYS).find(k => TOOL_KEYS[k] === name);
  const btn = document.createElement("button");
  btn.className = "tool";
  btn.dataset.tool = name;
  const cost = name === "raise" ? "5🪨+" : name === "clear" ? "free" : fmtCost(d.cost);
  btn.innerHTML = '<span class="ti">' + d.icon + '</span><span class="tn">' + d.name + '</span><span class="tc">' + cost + '</span><kbd>' + key.toUpperCase() + "</kbd>";
  btn.title = d.name + ": " + d.desc;
  btn.addEventListener("click", () => selectTool(tool === name ? null : name));
  toolbar.appendChild(btn);
}
function selectTool(name) {
  tool = name;
  for (const b of toolbar.children) b.classList.toggle("on", b.dataset.tool === name);
  const info = $("tool-info");
  if (!name) { info.classList.add("hidden"); return; }
  const d = DEFS[name] || TOOLS[name];
  let cost = "";
  if (d.cost) cost = " Cost: " + fmtCost(d.cost) + ".";
  info.innerHTML = "<b>" + d.icon + " " + d.name + "</b> " + d.desc + cost + ' <span class="hint">Esc or right-click to stop.</span>';
  info.classList.remove("hidden");
  sfx.pop();
}

let lastQuest = -1;
function updateHud(force) {
  if (!S) return;
  if (econDirty) computeEconomy();
  const r = rates();
  $("pop").textContent = S.pop;
  $("homes").textContent = econ.homes;
  $("jobs").textContent = Math.min(S.pop, econ.jobs) + "/" + econ.jobs;
  $("jobs-pill").classList.toggle("warn", econ.jobs > S.pop);
  for (const k of ["wood", "stone", "food", "gold"]) {
    $(k).textContent = Math.floor(S.res[k]);
    const v = r[k], el = $(k + "-rate");
    el.textContent = Math.abs(v) < 0.05 ? "" : (v > 0 ? "+" : "") + v.toFixed(1) + "/s";
    el.className = v < 0 ? "neg" : "";
  }
  $("day").textContent = Math.floor(S.time / DAY_LENGTH) + 1;
  $("day-icon").textContent = nightAmount() > 0.5 ? "🌙" : "☀️";
  if (force || lastQuest !== S.quest) {
    lastQuest = S.quest;
    const q = QUESTS[S.quest];
    $("quest-text").textContent = q ? q.text : "Your island is finished! Keep building if you like. 🏝️";
    $("quest-reward").textContent = q && Object.keys(q.reward).length ? "Reward: " + fmtCost(q.reward) : "";
    $("quest-step").textContent = q ? "Goal " + (S.quest + 1) + " of " + QUESTS.length : "All goals done!";
  }
  for (const b of toolbar.children) {
    const name = b.dataset.tool, d = DEFS[name] || TOOLS[name];
    let can = d.cost ? afford(d.cost) : true;
    if (name === "raise") can = S.res.stone >= 5;
    if (d.needPop && S.pop < d.needPop) can = false;
    b.classList.toggle("cant", !can);
  }
}

let toastTimer = 0;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- 17. sound: little beeps made by the computer, plus a sunny tune ----------
let audio = null, soundOn = true;
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
  build() { tone(330, 0.12, "triangle", 0.2); tone(495, 0.16, "triangle", 0.16, 0.07); tone(660, 0.2, "triangle", 0.12, 0.14); },
  error() { tone(150, 0.22, "square", 0.06, 0, 0.8); },
  coin() { tone(988, 0.08, "square", 0.07); tone(1319, 0.2, "square", 0.07, 0.08); },
  pop() { tone(700, 0.07, "sine", 0.1, 0, 1.4); },
  splash() { tone(500, 0.25, "sine", 0.12, 0, 0.4); tone(300, 0.2, "triangle", 0.08, 0.05, 0.5); },
  clear() { tone(220, 0.18, "sawtooth", 0.06, 0, 0.5); },
  quest() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.16, i * 0.1)); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, "triangle", 0.16, i * 0.14)); },
};
// The tune wanders up and down a "pentatonic" scale: 5 notes that always sound nice together.
const SCALE = [0, 2, 4, 7, 9];
let musicT = 0, musicStep = 0, musicNote = 5;
function music(dt) {
  musicT -= dt;
  if (musicT > 0) return;
  musicT = 0.36;
  musicStep++;
  const night = nightAmount() > 0.5;
  const base = night ? 220 : 262;
  if (musicStep % 8 === 0) tone(base / 2 * Math.pow(2, SCALE[(musicStep / 8) % 2 ? 3 : 0] / 12), 1.2, "sine", 0.05);
  if (Math.random() < (night ? 0.35 : 0.6)) {
    musicNote = clamp(musicNote + Math.floor(rand(-2, 3)), 0, 9);
    const semis = SCALE[musicNote % 5] + 12 * Math.floor(musicNote / 5);
    tone(base * Math.pow(2, semis / 12), 0.35, "triangle", 0.035);
  }
}
function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem(SAVE_KEY + "-sound", soundOn ? "on" : "off"); } catch (e) { /* fine */ }
  $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
  toast(soundOn ? "Sound on 🔊" : "Sound off 🔇");
}

// ---------- 18. mouse, touch and keyboard ----------
const keys = { left: false, right: false, up: false, down: false };
const KEYMAP = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", ArrowDown: "down", s: "down" };
window.addEventListener("keydown", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "Escape" || k === "p") {
    if (mode === "play" && tool && k === "Escape") selectTool(null);
    else if (mode === "play") setMode("pause");
    else if (mode === "pause") setMode("play");
    return;
  }
  if (k === "m") { toggleSound(); return; }
  if (mode !== "play") return;
  if (KEYMAP[k]) { keys[KEYMAP[k]] = true; e.preventDefault(); return; }
  if (TOOL_KEYS[k]) { selectTool(tool === TOOL_KEYS[k] ? null : TOOL_KEYS[k]); return; }
  if (k === "+" || k === "=") zoomAt(cw / 2, ch / 2, 1.2);
  if (k === "-" || k === "_") zoomAt(cw / 2, ch / 2, 1 / 1.2);
});
window.addEventListener("keyup", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYMAP[k]) keys[KEYMAP[k]] = false;
});
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

function zoomAt(sx, sy, factor) {
  const before = toWorld(sx, sy);
  cam.zoom = clamp(cam.zoom * factor, 0.5, 2.6);
  const after = toWorld(sx, sy);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
  clampCam();
}
view.addEventListener("wheel", e => {
  e.preventDefault();
  if (mode === "menu") return;
  zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });
view.addEventListener("contextmenu", e => e.preventDefault());

// One finger (or the mouse) drags the map, or taps to build. Two fingers pinch to zoom.
const pointers = new Map();
let drag = null, pinch = null;
view.addEventListener("pointerdown", e => {
  if (mode !== "play") return;
  ac();
  view.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false, button: e.button };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom };
    drag = null;
  }
});
view.addEventListener("pointermove", e => {
  const w = toWorld(e.clientX, e.clientY);
  if (e.pointerType === "mouse") hover = { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const target = clamp(pinch.zoom * d / pinch.d, 0.5, 2.6);
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / cam.zoom);
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) {
      cam.x = drag.cx - dx / cam.zoom;
      cam.y = drag.cy - dy / cam.zoom;
      clampCam();
    }
  }
});
function endPointer(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (drag && !drag.moved && !cancelled && pointers.size === 0) {
    if (drag.button === 2) selectTool(null);
    else tapAt(e.clientX, e.clientY);
  }
  if (pointers.size === 0) drag = null;
}
view.addEventListener("pointerup", e => endPointer(e, false));
view.addEventListener("pointercancel", e => endPointer(e, true));
view.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hover = null; });

function tapAt(sx, sy) {
  if (mode !== "play") return;
  const w = toWorld(sx, sy);
  for (const b of bottles) if (Math.hypot(b.x - w.x, b.y - w.y) < 16) { openBottle(b); return; }
  const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
  hover = { x: tx, y: ty };
  if (tool) useTool(tool, tx, ty);
  else inspect(tx, ty);
}

// ---------- 19. screens and buttons ----------
function setMode(m) {
  mode = m;
  document.body.classList.toggle("in-menu", m === "menu");
  $("title-screen").classList.toggle("hidden", m !== "menu");
  $("pause-screen").classList.toggle("hidden", m !== "pause");
  $("win-screen").classList.toggle("hidden", m !== "won");
  if (m !== "play") { for (const k in keys) keys[k] = false; }
  if (m === "pause") save();
}
function startNew() {
  useState(makeState(Math.floor(Math.random() * 1e9)));
  selectTool(null);
  setMode("play");
  updateHud(true);
  save();
  toast("Welcome to your island! Follow the 🎯 goals to grow it.");
}
function startSaved() {
  const st = loadSave();
  if (!st) { startNew(); return; }
  useState(st);
  selectTool(null);
  setMode("play");
  updateHud(true);
  toast("Welcome back! 🏝️");
}
$("btn-new").addEventListener("click", () => {
  if (loadSave() && !confirm("Start a brand new island? Your old island will be gone.")) return;
  ac(); startNew();
});
$("btn-continue").addEventListener("click", () => { ac(); startSaved(); });
$("btn-resume").addEventListener("click", () => setMode("play"));
$("btn-pause-title").addEventListener("click", () => { save(); showTitle(); });
$("btn-keep").addEventListener("click", () => setMode("play"));
$("btn-win-new").addEventListener("click", () => startNew());
$("btn-sound").addEventListener("click", toggleSound);
$("btn-pause").addEventListener("click", () => setMode("pause"));
$("btn-zoom-in").addEventListener("click", () => zoomAt(cw / 2, ch / 2, 1.25));
$("btn-zoom-out").addEventListener("click", () => zoomAt(cw / 2, ch / 2, 1 / 1.25));
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
window.addEventListener("pagehide", save);

function showTitle() {
  setMode("menu");
  // a pretty island slowly drifts by behind the title screen
  useState(makeState(Math.floor(Math.random() * 1e9)));
  cam.zoom = 0.9;
  $("btn-continue").classList.toggle("hidden", !loadSave());
}

// ---------- 20. go! ----------
$("btn-sound").textContent = soundOn ? "🔊" : "🔇";
resize();
showTitle();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "play") update(dt);
  else if (mode === "menu" && S) {
    S.time += dt * 0.3;
    cam.x = MAP_W * TILE / 2 + Math.sin(now / 9000) * 220;
    cam.y = MAP_H * TILE / 2 + Math.cos(now / 11000) * 120;
    updateLife(dt);
  }
  draw(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
