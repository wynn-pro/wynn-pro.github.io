// Pickaxe Miner: dig down through the mountain, fill your bag with shiny ore, sell it at camp
// and buy better gear, until you reach the Heart of the Mountain at the very bottom.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const W = 48;                 // the mine is 48 squares wide
const SKY = 6;                // rows of sky above the ground
const CORE_DEPTH = 150;       // how deep the Heart of the Mountain is
const H = SKY + CORE_DEPTH + 10;
const CAMP_X = 6;             // the column you stand on to visit camp
const START_X = 10;
const FALL_SPEED = 14;        // squares per second
const WALK_TIME = 0.13;       // seconds to walk one square
const CLIMB_TIME = 0.17;      // seconds to climb one square
const HURT_FALL = 6;          // falling this many squares or more hurts
const FUSE = 1.6;             // seconds before dynamite goes boom
const START_LADDERS = 15;
const CORE_PRIZE = 5000;
const SAVE_KEY = "pickaxe-miner-save";
const STEP = 1 / 60;          // the game moves forward in tiny steps of 1/60 of a second

// ---------- 2. tiles: the squares the mountain is made of ----------
const AIR = 0, GROUND = 1, BOULDER = 2, LAVA = 3, BEDROCK = 4, CHEST = 5, CORE = 6, ORE = 10; // ORE + n is ore number n

// the mountain gets harder the deeper you go. tier = the pickaxe you need.
const LAYERS = [
  { name: "Topsoil", from: 0, tier: 1, color: "#9a6236", dark: "#6e4222", wall: "#3b2414" },
  { name: "Red Clay", from: 20, tier: 2, color: "#b5583a", dark: "#7e3522", wall: "#3d1a12" },
  { name: "Grey Stone", from: 45, tier: 3, color: "#7d7f88", dark: "#55575f", wall: "#26272d" },
  { name: "Deep Slate", from: 75, tier: 4, color: "#4f5774", dark: "#343a52", wall: "#171a26" },
  { name: "Magma Rock", from: 105, tier: 5, color: "#653232", dark: "#40201f", wall: "#1c0d0e" },
  { name: "Crystal Depths", from: 135, tier: 6, color: "#4e3d80", dark: "#33275a", wall: "#140e26" },
];

// from = the first depth it shows up at. weight = how common it is (bigger = more).
const ORES = [
  { name: "Coal", color: "#262626", shine: "#7a7a7a", value: 4, from: 1, tier: 1, weight: 10 },
  { name: "Copper", color: "#e07a3a", shine: "#ffc08a", value: 10, from: 6, tier: 1, weight: 8 },
  { name: "Iron", color: "#c49a7c", shine: "#f3dcc8", value: 22, from: 16, tier: 2, weight: 7 },
  { name: "Silver", color: "#d6dee8", shine: "#ffffff", value: 40, from: 32, tier: 2, weight: 5 },
  { name: "Gold", color: "#ffc61a", shine: "#fff3a0", value: 70, from: 48, tier: 3, weight: 4 },
  { name: "Emerald", color: "#2fd67a", shine: "#b5ffd5", value: 120, from: 68, tier: 3, weight: 3 },
  { name: "Ruby", color: "#ff2f55", shine: "#ffb3c2", value: 190, from: 88, tier: 4, weight: 2.5 },
  { name: "Sapphire", color: "#3a6bff", shine: "#b8ccff", value: 280, from: 108, tier: 5, weight: 2 },
  { name: "Diamond", color: "#8ff0ff", shine: "#ffffff", value: 420, from: 122, tier: 5, weight: 1.5 },
  { name: "Starstone", color: "#ff9cf2", shine: "#fff0fd", value: 700, from: 136, tier: 6, weight: 1.2 },
];

// things you can buy at camp. value is what that level gives you.
const UPGRADES = {
  pick: { name: "Pickaxe", icon: "⛏️", what: "Digs harder rock, faster.", levels: [
    { label: "Wooden", cost: 0, value: 1 }, { label: "Copper", cost: 120, value: 2 },
    { label: "Iron", cost: 450, value: 3 }, { label: "Steel", cost: 1300, value: 4 },
    { label: "Crystal", cost: 3500, value: 5 }, { label: "Starforged", cost: 9000, value: 6 }] },
  bag: { name: "Bag", icon: "🎒", what: "Carries more ore.", levels: [
    { label: "Pouch (12)", cost: 0, value: 12 }, { label: "Sack (20)", cost: 80, value: 20 },
    { label: "Backpack (32)", cost: 300, value: 32 }, { label: "Big Pack (50)", cost: 800, value: 50 },
    { label: "Huge Pack (75)", cost: 2000, value: 75 }, { label: "Mega Pack (110)", cost: 4500, value: 110 }] },
  lamp: { name: "Lamp", icon: "🔦", what: "See further in the dark.", levels: [
    { label: "Candle", cost: 0, value: 3 }, { label: "Oil Lamp", cost: 100, value: 4.5 },
    { label: "Bright Lamp", cost: 350, value: 6 }, { label: "Miner's Beam", cost: 1000, value: 8 },
    { label: "Sunstone", cost: 2600, value: 11 }] },
  energy: { name: "Lunchbox", icon: "🥪", what: "More energy for digging.", levels: [
    { label: "Snack (50)", cost: 0, value: 50 }, { label: "Lunch (90)", cost: 120, value: 90 },
    { label: "Picnic (140)", cost: 400, value: 140 }, { label: "Feast (210)", cost: 1100, value: 210 },
    { label: "Dragon Stew (300)", cost: 2800, value: 300 }] },
  helmet: { name: "Helmet", icon: "⛑️", what: "More hearts.", levels: [
    { label: "Cap (3 ❤️)", cost: 0, value: 3 }, { label: "Hard Hat (4 ❤️)", cost: 180, value: 4 },
    { label: "Iron Helm (5 ❤️)", cost: 650, value: 5 }, { label: "Dragon Helm (6 ❤️)", cost: 1800, value: 6 }] },
};
const ITEMS = {
  ladders: { name: "10 Ladders", icon: "🪜", cost: 15, amount: 10, max: 99 },
  dynamite: { name: "Dynamite", icon: "🧨", cost: 35, amount: 1, max: 9 },
  rope: { name: "Rescue Rope", icon: "🪢", cost: 50, amount: 1, max: 5 },
};
const PICK_COLORS = ["#a0703c", "#e07a3a", "#c0c4cc", "#8fa3b8", "#8ff0ff", "#ffb8f6"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x, y) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0);

// a "seeded" random number maker: the same seed always gives the same mountain
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// which layer each row is in, worked out once
const ROW_LAYER = new Int8Array(H);
for (let y = 0; y < H; y++) {
  const d = y - SKY;
  let li = 0;
  LAYERS.forEach((L, i) => { if (d >= L.from) li = i; });
  ROW_LAYER[y] = li;
}

// ---------- 3. building the mountain ----------
function generate(seed) {
  const rand = makeRng(seed);
  const r = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const tiles = new Uint8Array(W * H);
  const set = (x, y, t) => { if (x > 0 && x < W - 1 && y >= SKY && y < H) tiles[y * W + x] = t; };
  const get = (x, y) => (x >= 0 && x < W && y >= 0 && y < H ? tiles[y * W + x] : BEDROCK);
  const floor = SKY + CORE_DEPTH + 6;

  // solid ground everywhere, with unbreakable walls at the sides and the bottom
  for (let y = SKY; y < H; y++) {
    for (let x = 0; x < W; x++) tiles[y * W + x] = x === 0 || x === W - 1 || y >= floor ? BEDROCK : GROUND;
  }

  // caves: little diggers that wander around and leave tunnels behind them
  for (let i = 0; i < 75; i++) {
    let x = r(2, W - 3), y = SKY + r(8, CORE_DEPTH - 4);
    const len = r(6, 26);
    for (let s = 0; s < len; s++) {
      set(x, y, AIR);
      if (rand() < 0.5) set(x + 1, y, AIR);
      if (rand() < 0.5) x += rand() < 0.5 ? -1 : 1;
      else if (rand() < 0.4) y += rand() < 0.5 ? -1 : 1;
      x = clamp(x, 2, W - 3);
      y = clamp(y, SKY + 6, SKY + CORE_DEPTH - 2);
    }
  }

  // ore veins: pick an ore that belongs at this depth, then sprinkle a little clump of it
  for (let i = 0; i < 300; i++) {
    const y = SKY + r(1, CORE_DEPTH - 1);
    const d = y - SKY;
    const choices = [];
    let total = 0;
    ORES.forEach((o, n) => {
      if (d < o.from) return;
      const w = o.weight * (d > o.from + 70 ? 0.3 : 1);   // shallow ores get rare when you're very deep
      choices.push([n, w]);
      total += w;
    });
    let roll = rand() * total, n = choices[0][0];
    for (const [c, w] of choices) { if ((roll -= w) < 0) { n = c; break; } }
    let x = r(1, W - 2), vy = y;
    const size = r(1, 4) + (n < 2 ? 2 : 0);
    for (let s = 0; s < size; s++) {
      if (get(x, vy) === GROUND) set(x, vy, ORE + n);
      if (rand() < 0.5) x += rand() < 0.5 ? -1 : 1; else vy += rand() < 0.5 ? -1 : 1;
    }
  }

  // lava pools, only deep down
  for (let i = 0; i < 28; i++) {
    let x = r(2, W - 3), y = SKY + r(95, CORE_DEPTH - 6);
    for (let s = r(2, 6); s > 0; s--) {
      if (get(x, y) === GROUND || get(x, y) === AIR) set(x, y, LAVA);
      x += rand() < 0.5 ? -1 : 1;
      if (rand() < 0.3) y++;
    }
  }

  // boulders sit in the ground and fall when you dig out what's under them
  for (let y = SKY + 9; y < SKY + CORE_DEPTH; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (get(x, y) === GROUND && get(x, y + 1) !== AIR && rand() < 0.025) set(x, y, BOULDER);
    }
  }

  // treasure chests
  for (let i = 0; i < 20; i++) set(r(2, W - 3), SKY + r(10, CORE_DEPTH - 6), CHEST);

  // the big chamber at the bottom, with the Heart of the Mountain in the middle
  for (let y = SKY + CORE_DEPTH; y < floor; y++) for (let x = 1; x < W - 1; x++) set(x, y, AIR);
  const cx = W >> 1;
  for (let y = floor - 3; y < floor; y++) for (let x = cx - 1; x <= cx + 1; x++) set(x, y, CORE);

  // keep the ground near the top solid, so nobody falls into a hole right away
  for (let y = SKY; y < SKY + 4; y++) for (let x = 1; x < W - 1; x++) if (get(x, y) < ORE) set(x, y, GROUND);
  return tiles;
}

// ---------- 4. the save: everything that is remembered between visits ----------
let S = null;          // the save
let world = null;      // the tiles, one byte per square
let ladderMap = null;  // 1 where there's a ladder

function newSave() {
  return {
    v: 1, seed: (Math.random() * 1e9) | 0, cash: 0, bag: ORES.map(() => 0),
    up: { pick: 0, bag: 0, lamp: 0, energy: 0, helmet: 0 },
    items: { ladders: START_LADDERS, dynamite: 2, rope: 1 },
    energy: 50, hearts: 3, x: START_X, y: SKY - 1, deepest: 0, earned: 0, layer: 0, won: false,
  };
}

function toB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function fromB64(str, n) {
  const s = atob(str), u8 = new Uint8Array(n);
  for (let i = 0; i < n && i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

function saveGame() {
  if (!S) return;
  S.x = p.x;
  S.y = p.y;
  S.tiles = toB64(world);
  S.ladders = toB64(ladderMap);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private window: nothing is saved */ }
}

function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data && data.v === 1 && data.tiles) return data;
  } catch (e) { /* no save, or a broken one */ }
  return null;
}

const stat = key => UPGRADES[key].levels[S.up[key]].value;
const bagCount = () => S.bag.reduce((a, b) => a + b, 0);

// ---------- 5. looking at and changing the mountain ----------
function tileAt(x, y) {
  if (x < 0 || x >= W || y >= H) return BEDROCK;
  if (y < 0) return AIR;
  return world[y * W + x];
}
const setTile = (x, y, t) => { world[y * W + x] = t; };
const ladderAt = (x, y) => x >= 0 && x < W && y >= 0 && y < H && ladderMap[y * W + x] === 1;

function tierOf(x, y) {
  const t = tileAt(x, y), layerTier = LAYERS[ROW_LAYER[y]].tier;
  if (t === CORE) return 6;
  if (t >= ORE) return Math.max(layerTier, ORES[t - ORE].tier);
  return layerTier;
}
const digTime = tier => 0.15 + 0.4 * Math.pow(tier / stat("pick"), 1.5);

// you're held up by solid ground under you, a ladder where you are, or the top of a ladder below you
function supported(x, y) {
  if (y + 1 >= H) return true;
  return tileAt(x, y + 1) !== AIR || ladderAt(x, y) || ladderAt(x, y + 1);
}

// ---------- 6. the miner ----------
const p = { x: START_X, y: SKY - 1, fromX: START_X, fromY: SKY - 1, t: 0, dur: 1, moving: false,
  falling: 0, face: 1, dig: null, hurtT: 0, atCamp: false };
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

function playerPos() {
  if (!p.moving) return { x: p.x, y: p.y };
  const k = clamp(p.t / p.dur, 0, 1);
  return { x: lerp(p.fromX, p.x, k), y: lerp(p.fromY, p.y, k) };
}

function startMove(nx, ny, dur) {
  p.fromX = p.x; p.fromY = p.y;
  p.x = nx; p.y = ny;
  p.t = 0; p.dur = dur; p.moving = true;
}

function teleportHome() {
  p.x = p.fromX = CAMP_X;
  p.y = p.fromY = SKY - 1;
  p.moving = false; p.dig = null; p.falling = 0; p.atCamp = false;
  cam.snap = true;
}

function updatePlayer(dt) {
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.moving) {
    p.t += dt;
    if (p.t < p.dur) return;
    p.moving = false;
    arrive();
  }

  if (!supported(p.x, p.y)) {
    p.dig = null;
    p.falling++;
    startMove(p.x, p.y + 1, 1 / FALL_SPEED);
    return;
  }
  if (p.falling) {
    const f = p.falling;
    p.falling = 0;
    if (f >= HURT_FALL) hurt(f >= 11 ? 2 : 1, "Ouch! What a fall!");
    else if (f >= 2) sfx("land");
  }
  if (tileAt(p.x, p.y + 1) === LAVA) hurt(1, "Hot hot hot! Get off the lava!");
  if (mode !== "play") return;

  const home = p.x === CAMP_X && p.y === SKY - 1;
  if (home && !p.atCamp) { p.atCamp = true; visitCamp(); return; }
  if (!home) p.atCamp = false;

  const dir = heldDir();
  if (p.dig) {
    const d = DIRS[dir];
    if (!d || p.x + d[0] !== p.dig.x || p.y + d[1] !== p.dig.y) {
      p.dig = null;           // let go, or turned around: start over
    } else {
      p.dig.t += dt;
      if (time - p.dig.tick > 0.13) {
        p.dig.tick = time;
        sfx("dig");
        chips(p.dig.x, p.dig.y, 2);
      }
      if (p.dig.t >= p.dig.need) finishDig();
      return;
    }
  }
  if (dir) tryAct(dir);
}

function arrive() {
  const d = p.y - SKY;
  if (d > S.deepest) S.deepest = d;
  const li = ROW_LAYER[Math.max(0, p.y)];
  if (d >= 0 && li > S.layer) {
    S.layer = li;
    toast(`${LAYERS[li].name} · ${d + 1} m`);
  }
}

function tryAct(dir) {
  const [dx, dy] = DIRS[dir];
  if (dx) p.face = dx;
  const nx = p.x + dx, ny = p.y + dy;
  if (nx < 0 || nx >= W || ny < 0) return;
  const t = tileAt(nx, ny);

  if (t === AIR) {
    if (dy < 0) {
      if (p.y <= SKY - 1) return;       // no climbing into the sky
      if (!ladderAt(p.x, p.y)) {
        if (S.items.ladders <= 0) { toastOnce("No ladders left! Use a rope (R), or dig a way up."); return; }
        S.items.ladders--;
        ladderMap[p.y * W + p.x] = 1;
        sfx("ladder");
      }
      startMove(nx, ny, CLIMB_TIME);
    } else {
      startMove(nx, ny, dy ? CLIMB_TIME : WALK_TIME);
    }
    return;
  }
  if (t === LAVA) { hurt(1, "Lava! Too hot!"); return; }
  if (t === BEDROCK) { toastOnce("Bedrock! Nothing can break that."); return; }
  const tier = tierOf(nx, ny);
  if (tier > stat("pick")) {
    const need = UPGRADES.pick.levels.find(l => l.value >= tier);
    toastOnce(`Too hard! You need the ${need.label} Pickaxe.`);
    sfx("clunk");
    return;
  }
  if (S.energy <= 0) { toastOnce("Too tired to dig! Go back to camp, or use a rope (R)."); return; }
  p.dig = { x: nx, y: ny, t: 0, need: digTime(tier), tick: 0 };
}

function finishDig() {
  const { x, y } = p.dig;
  p.dig = null;
  S.energy = Math.max(0, S.energy - 1);
  if (S.energy === 10) toast("Getting tired... 10 energy left!");
  if (S.energy === 0) toast("Out of energy! Head home.");
  breakTile(x, y);
}

function breakTile(x, y) {
  const t = tileAt(x, y);
  const color = t >= ORE ? ORES[t - ORE].color : t === BOULDER ? "#8a8a90" : LAYERS[ROW_LAYER[y]].color;
  setTile(x, y, AIR);
  chips(x, y, 10, color);
  sfx("break");
  if (t >= ORE) collect(t - ORE, x, y);
  else if (t === CHEST) {
    const prize = 30 + (y - SKY) * 5;
    S.cash += prize;
    S.earned += prize;
    floatText(x, y, `Treasure! +$${prize}`, "#ffd23f");
    sfx("cash");
  } else if (t === CORE) winGame();
}

function collect(n, x, y) {
  if (bagCount() >= stat("bag")) {
    floatText(x, y, "Bag full!", "#ff8080");
    toastOnce("Your bag is full! Go sell your ore at camp.");
    sfx("clunk");
    return;
  }
  S.bag[n]++;
  floatText(x, y, `+${ORES[n].name}`, ORES[n].shine);
  sfx("ore");
}

function hurt(n, msg) {
  if (p.hurtT > 0 || mode !== "play") return;
  S.hearts -= n;
  p.hurtT = 1.2;
  shake = 9;
  sfx("hurt");
  toast(msg);
  if (S.hearts <= 0) faint("You ran out of hearts!");
}

// ---------- 7. boulders, dynamite and the rope ----------
const wobble = new Map();   // boulders about to fall: square number -> seconds left
let boulderClock = 0;

function updateBoulders(dt) {
  boulderClock += dt;
  if (boulderClock < 0.09) return;
  boulderClock = 0;
  const top = Math.max(SKY, p.y - 30), bottom = Math.min(H - 2, p.y + 30);
  // go from the bottom up, so a boulder that just moved down doesn't move again in the same tick
  for (let y = bottom; y >= top; y--) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (world[i] !== BOULDER) continue;
      if (world[i + W] !== AIR) { wobble.delete(i); continue; }
      if (!wobble.has(i)) { wobble.set(i, 0.5); continue; }   // shake for a moment first, as a warning
      const left = wobble.get(i) - 0.09;
      if (left > 0) { wobble.set(i, left); continue; }
      wobble.delete(i);
      const hitsMiner = (x === p.x && y + 1 === p.y) || (p.moving && x === p.fromX && y + 1 === p.fromY);
      setTile(x, y, AIR);
      if (hitsMiner) {
        chips(x, y + 1, 12, "#8a8a90");
        hurt(1, "Bonk! A falling rock!");
      } else {
        setTile(x, y + 1, BOULDER);
        wobble.set(i + W, 0);     // already falling, so no more waiting
      }
    }
  }
}

const bombs = [];
function dropDynamite() {
  if (mode !== "play") return;
  if (S.items.dynamite <= 0) { toastOnce("No dynamite! Buy some at camp."); return; }
  if (p.y < SKY) { toastOnce("Use dynamite underground!"); return; }
  if (bombs.some(b => b.x === p.x && b.y === p.y)) return;
  S.items.dynamite--;
  bombs.push({ x: p.x, y: p.y, t: FUSE });
  toast("Run!");
  sfx("fuse");
}

function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.t -= dt;
    if (b.t > 0) continue;
    bombs.splice(i, 1);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = b.x + dx, y = b.y + dy;
        if (x < 1 || x >= W - 1 || y < SKY || y >= H) continue;
        const t = tileAt(x, y);
        if (t === AIR || t === BEDROCK || t === CORE) continue;
        if (t === LAVA) setTile(x, y, AIR); else breakTile(x, y);
      }
    }
    chips(b.x, b.y, 30, "#ffb347");
    shake = 16;
    sfx("boom");
    if (Math.abs(p.x - b.x) <= 1 && Math.abs(p.y - b.y) <= 1) hurt(1, "Boom! Too close!");
  }
}

function useRope() {
  if (mode !== "play") return;
  if (p.y <= SKY - 1) { toastOnce("You're already at the top!"); return; }
  if (S.items.rope <= 0) { toastOnce("No rescue rope! Buy one at camp."); return; }
  S.items.rope--;
  sfx("rope");
  teleportHome();
}

// ---------- 8. camp, fainting and winning ----------
function visitCamp() {
  let count = 0, total = 0;
  S.bag.forEach((n, i) => { count += n; total += n * ORES[i].value; });
  S.bag = ORES.map(() => 0);
  S.cash += total;
  S.earned += total;
  S.energy = stat("energy");
  S.hearts = stat("helmet");
  if (total) sfx("cash");
  saveGame();
  openShop(total ? `Sold ${count} ore for <b>$${total}</b>! Energy and hearts are full again.`
    : "Welcome to camp! Energy and hearts are full again.");
}

function faint(reason) {
  let lost = 0;
  S.bag = S.bag.map(n => { lost += n - Math.floor(n / 2); return Math.floor(n / 2); });
  setMode("faint");
  $("faint-text").innerHTML = `${reason} The camp crew carried you home${lost ? `, but you dropped <b>${lost} ore</b> on the way` : ""}.`;
  sfx("hurt");
}

function wakeUp() {
  teleportHome();
  setMode("play");
}

function winGame() {
  for (let i = 0; i < world.length; i++) if (world[i] === CORE) world[i] = AIR;
  S.cash += CORE_PRIZE;
  S.earned += CORE_PRIZE;
  S.won = true;
  saveGame();
  $("end-text").innerHTML = `You dug all the way to the <b>Heart of the Mountain</b> and got a <b>$${CORE_PRIZE}</b>` +
    ` reward! You've earned <b>$${S.earned}</b> in all. Keep mining as long as you like.`;
  setMode("win");
  sfx("win");
}

// ---------- 9. the camera, sparkles and floating words ----------
const cam = { x: 0, y: 0, snap: true };
let shake = 0;
const parts = [];
const floats = [];

function chips(x, y, count, color) {
  const c = color || LAYERS[ROW_LAYER[y]].color;
  for (let i = 0; i < count; i++) {
    parts.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6,
      life: 0.4 + Math.random() * 0.4, color: c, size: 0.06 + Math.random() * 0.08 });
  }
}
function floatText(x, y, text, color) { floats.push({ x: x + 0.5, y: y + 0.3, text, color, life: 1.2 }); }

function updateEffects(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.vy += 22 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if ((q.life -= dt) <= 0) parts.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].y -= dt * 0.9;
    if ((floats[i].life -= dt) <= 0) floats.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 40);
}

// ---------- 10. drawing ----------
const view = document.getElementById("view");
const ctx = view.getContext("2d");
const dark = document.createElement("canvas");
const dctx = dark.getContext("2d");
let vw = 0, vh = 0, dpr = 1, TS = 40;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth;
  vh = window.innerHeight;
  view.width = dark.width = Math.round(vw * dpr);
  view.height = dark.height = Math.round(vh * dpr);
  TS = Math.round(clamp(Math.min(vw / 15, vh / 10), 30, 56));
  cam.snap = true;
}

function updateCamera(dt) {
  const pos = playerPos();
  let tx = (pos.x + 0.5) * TS - vw / 2;
  let ty = (pos.y + 0.5) * TS - vh / 2;
  tx = W * TS <= vw ? (W * TS - vw) / 2 : clamp(tx, 0, W * TS - vw);
  ty = clamp(ty, 0, H * TS - vh);
  if (cam.snap) { cam.x = tx; cam.y = ty; cam.snap = false; }
  const k = 1 - Math.pow(0.0005, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, vh);
  sky.addColorStop(0, "#5fb8ff");
  sky.addColorStop(1, "#d4f0ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, vh);
  if (!world) return;

  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  const ox = Math.round(cam.x - sx), oy = Math.round(cam.y - sy);
  ctx.translate(-ox, -oy);

  drawSkyStuff(ox);
  const x0 = Math.max(0, Math.floor(ox / TS)), x1 = Math.min(W - 1, Math.floor((ox + vw) / TS));
  const y0 = Math.max(0, Math.floor(oy / TS)), y1 = Math.min(H - 1, Math.floor((oy + vh) / TS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(x, y);
  drawCamp();
  bombs.forEach(drawBomb);
  if (p.dig) drawCracks(p.dig.x, p.dig.y, p.dig.t / p.dig.need);
  drawPlayer();
  for (const q of parts) {
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x * TS, q.y * TS, q.size * TS, q.size * TS);
  }
  drawDarkness(ox, oy, x0, x1, y0, y1);

  ctx.textAlign = "center";
  ctx.font = `${Math.round(TS * 0.42)}px "Lilita One", sans-serif`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life * 2, 0, 1);
    ctx.strokeText(f.text, f.x * TS, f.y * TS);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x * TS, f.y * TS);
  }
  ctx.globalAlpha = 1;
}

function drawSkyStuff(ox) {
  const ground = SKY * TS;
  // the sun
  ctx.fillStyle = "#fff4b0";
  ctx.beginPath();
  ctx.arc(ox + vw * 0.8, ground - TS * 4.6, TS * 0.8, 0, Math.PI * 2);
  ctx.fill();
  // far mountains, sliding at half speed so they look far away
  const off = ox * 0.5, span = TS * 4;
  const k0 = Math.floor((ox - off) / span) - 1;
  ctx.fillStyle = "#9cc6e6";
  ctx.beginPath();
  ctx.moveTo(ox - 10, ground);
  for (let k = k0; k < k0 + vw / span + 3; k++) {
    const bx = off + k * span;
    ctx.lineTo(bx + span / 2, ground - TS * (2.2 + (k & 1) * 0.9));
    ctx.lineTo(bx + span, ground);
  }
  ctx.lineTo(ox + vw + 10, ground);
  ctx.fill();
  // clouds
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 380 + time * 12) % (W * TS + 400)) - 200, cy = TS * (0.8 + (i % 3) * 0.7);
    ctx.beginPath();
    ctx.arc(cx, cy, TS * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + TS * 0.55, cy - TS * 0.2, TS * 0.6, 0, Math.PI * 2);
    ctx.arc(cx + TS * 1.1, cy, TS * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTile(x, y) {
  if (y < SKY) return;
  const t = world[y * W + x];
  const px = x * TS, py = y * TS;
  const L = LAYERS[ROW_LAYER[y]];
  if (t === GROUND || t >= ORE) {
    drawGround(px, py, x, y, L);
    if (t >= ORE) drawOre(px, py, x, y, ORES[t - ORE]);
  } else {
    ctx.fillStyle = L.wall;
    ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    if (t === BOULDER) drawBoulder(px, py, y * W + x);
    else if (t === LAVA) drawLava(px, py, x);
    else if (t === BEDROCK) drawBedrock(px, py, x, y);
    else if (t === CHEST) drawChest(px, py);
    else if (t === CORE) drawCore(px, py, x, y);
  }
  if (ladderMap[y * W + x]) drawLadder(px, py);
}

function drawGround(px, py, x, y, L) {
  const s = TS / 8, h = hash(x, y);
  ctx.fillStyle = L.color;
  ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
  ctx.fillStyle = L.dark;
  ctx.fillRect(px + (h % 5 + 1) * s, py + ((h >> 3) % 5 + 1) * s, s, s);
  ctx.fillRect(px + ((h >> 6) % 5 + 1) * s, py + ((h >> 9) % 5 + 1) * s, s * 1.6, s);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(px, py, TS, s * 0.5);
  ctx.fillStyle = "rgba(0,0,0,0.13)";
  ctx.fillRect(px, py + TS - s * 0.5, TS, s * 0.5);
  if (y === SKY) {   // grass on top
    ctx.fillStyle = "#4cbb3f";
    ctx.fillRect(px, py, TS + 0.5, s * 2);
    ctx.fillStyle = "#3a9a31";
    for (let i = 0; i < 4; i++) ctx.fillRect(px + i * s * 2 + ((h >> i) & 1) * s, py + s * 2, s, s);
  }
}

function drawOre(px, py, x, y, o) {
  const h = hash(x, y);
  const spots = [[0.28, 0.3], [0.68, 0.36], [0.4, 0.7], [0.74, 0.74]];
  for (let i = 0; i < 3; i++) {
    const [a, b] = spots[(i + h) % 4];
    const cx = px + a * TS, cy = py + b * TS, rr = TS * (0.12 + ((h >> (i * 3)) % 3) * 0.025);
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr);
    ctx.lineTo(cx + rr, cy);
    ctx.lineTo(cx, cy + rr);
    ctx.lineTo(cx - rr, cy);
    ctx.fill();
    ctx.fillStyle = o.shine;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 3 + h + i);
    ctx.fillRect(cx - rr * 0.35, cy - rr * 0.55, rr * 0.4, rr * 0.4);
    ctx.globalAlpha = 1;
  }
}

function drawBoulder(px, py, i) {
  const w = wobble.has(i) ? Math.sin(time * 60) * TS * 0.05 : 0;
  const cx = px + TS / 2 + w, cy = py + TS / 2 + 1;
  const g = ctx.createRadialGradient(cx - TS * 0.12, cy - TS * 0.14, TS * 0.05, cx, cy, TS * 0.46);
  g.addColorStop(0, "#b4b4bc");
  g.addColorStop(1, "#5c5c66");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, TS * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, TS / 22);
  ctx.beginPath();
  ctx.moveTo(cx - TS * 0.1, cy - TS * 0.3);
  ctx.lineTo(cx, cy - TS * 0.05);
  ctx.lineTo(cx + TS * 0.18, cy + TS * 0.05);
  ctx.stroke();
}

function drawLava(px, py, x) {
  const g = ctx.createLinearGradient(0, py, 0, py + TS);
  g.addColorStop(0, "#ffcf3a");
  g.addColorStop(0.4, "#ff7a1a");
  g.addColorStop(1, "#c42a12");
  ctx.fillStyle = g;
  ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
  ctx.fillStyle = "rgba(255,240,150,0.8)";
  for (let i = 0; i < 2; i++) {
    const k = (time * 0.7 + i * 0.5 + x * 0.37) % 1;
    ctx.beginPath();
    ctx.arc(px + TS * (0.25 + i * 0.5), py + TS * (0.9 - k * 0.8), TS * 0.07 * (1 - k), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBedrock(px, py, x, y) {
  ctx.fillStyle = "#1b1b22";
  ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
  ctx.fillStyle = "#30303a";
  const h = hash(x, y), s = TS / 4;
  for (let i = 0; i < 4; i++) ctx.fillRect(px + ((h >> (i * 2)) & 3) * s, py + i * s, s * 1.4, s * 0.6);
}

function drawChest(px, py) {
  const s = TS;
  ctx.fillStyle = "#8b4f22";
  ctx.fillRect(px + s * 0.14, py + s * 0.38, s * 0.72, s * 0.48);
  ctx.fillStyle = "#a8642e";
  ctx.fillRect(px + s * 0.14, py + s * 0.24, s * 0.72, s * 0.2);
  ctx.fillStyle = "#ffcc33";
  ctx.fillRect(px + s * 0.14, py + s * 0.42, s * 0.72, s * 0.06);
  ctx.fillRect(px + s * 0.45, py + s * 0.4, s * 0.1, s * 0.16);
}

function drawCore(px, py, x, y) {
  const glow = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.fillStyle = `rgba(255,140,240,${0.25 + glow * 0.2})`;
  ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
  const h = hash(x, y), cx = px + TS / 2, cy = py + TS / 2;
  ctx.fillStyle = (h & 1) ? "#ffd6ff" : "#ff8cf0";
  ctx.beginPath();
  ctx.moveTo(cx, py + TS * 0.05);
  ctx.lineTo(px + TS * 0.9, cy);
  ctx.lineTo(cx, py + TS * 0.95);
  ctx.lineTo(px + TS * 0.1, cy);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = glow;
  ctx.fillRect(cx - TS * 0.12, cy - TS * 0.25, TS * 0.12, TS * 0.12);
  ctx.globalAlpha = 1;
}

function drawLadder(px, py) {
  ctx.fillStyle = "#c08a4a";
  ctx.fillRect(px + TS * 0.2, py, TS * 0.08, TS + 0.5);
  ctx.fillRect(px + TS * 0.72, py, TS * 0.08, TS + 0.5);
  ctx.fillStyle = "#e0aa66";
  for (let i = 0; i < 3; i++) ctx.fillRect(px + TS * 0.2, py + TS * (0.12 + i * 0.33), TS * 0.6, TS * 0.08);
}

function drawCracks(x, y, k) {
  const px = x * TS, py = y * TS, c = TS / 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = Math.max(1.5, TS / 18);
  ctx.beginPath();
  const lines = [[0.5, 0.5, 0.15, 0.2], [0.5, 0.5, 0.85, 0.3], [0.5, 0.5, 0.3, 0.85], [0.5, 0.5, 0.8, 0.8],
    [0.15, 0.2, 0.1, 0.5], [0.85, 0.3, 0.95, 0.1]];
  const n = Math.ceil(clamp(k, 0, 1) * lines.length);
  for (let i = 0; i < n; i++) {
    const [a, b, e, f] = lines[i];
    ctx.moveTo(px + a * TS, py + b * TS);
    ctx.lineTo(px + e * TS, py + f * TS);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${k * 0.15})`;
  ctx.fillRect(px + c - c * k, py + c - c * k, TS * k, TS * k);
}

function drawCamp() {
  const s = TS, base = SKY * TS, left = 2.6 * TS;
  // the cabin
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(left, base - s * 2.2, s * 3.4, s * 2.2);
  ctx.fillStyle = "#6e4420";
  for (let i = 1; i < 5; i++) ctx.fillRect(left, base - s * 2.2 + i * s * 0.44, s * 3.4, s * 0.05);
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.moveTo(left - s * 0.3, base - s * 2.2);
  ctx.lineTo(left + s * 1.7, base - s * 3.4);
  ctx.lineTo(left + s * 3.7, base - s * 2.2);
  ctx.fill();
  // the door (stand here to visit camp)
  ctx.fillStyle = "#3d230f";
  ctx.fillRect(CAMP_X * TS + s * 0.2, base - s * 1.3, s * 0.6, s * 1.3);
  ctx.fillStyle = "#ffcc33";
  ctx.fillRect(CAMP_X * TS + s * 0.66, base - s * 0.7, s * 0.08, s * 0.08);
  // a window with a warm light
  ctx.fillStyle = "#ffe08a";
  ctx.fillRect(left + s * 0.4, base - s * 1.6, s * 0.7, s * 0.6);
  // the sign
  ctx.fillStyle = "#f5deb3";
  ctx.fillRect(left + s * 0.6, base - s * 2.95, s * 2.2, s * 0.55);
  ctx.fillStyle = "#5a3518";
  ctx.font = `${Math.round(s * 0.42)}px "Lilita One", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("CAMP", left + s * 1.7, base - s * 2.52);
  // a minecart full of gold
  const mx = 8.1 * TS;
  ctx.fillStyle = "#ffc61a";
  ctx.beginPath();
  ctx.arc(mx + s * 0.4, base - s * 0.75, s * 0.3, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#5c5c66";
  ctx.fillRect(mx, base - s * 0.75, s * 0.8, s * 0.5);
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(mx + s * 0.2, base - s * 0.15, s * 0.13, 0, Math.PI * 2);
  ctx.arc(mx + s * 0.6, base - s * 0.15, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  if (S && p.y === SKY - 1 && Math.abs(p.x - CAMP_X) <= 4 && p.x !== CAMP_X) {
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.round(s * 0.34)}px "Lilita One", sans-serif`;
    ctx.fillText("▼ shop", CAMP_X * TS + s / 2, base - s * 1.45 + Math.sin(time * 5) * 3);
  }
}

function drawBomb(b) {
  const px = b.x * TS, py = b.y * TS, s = TS;
  ctx.fillStyle = b.t % 0.3 < 0.15 ? "#ff3b30" : "#c0261c";
  ctx.fillRect(px + s * 0.38, py + s * 0.45, s * 0.24, s * 0.55);
  ctx.fillStyle = "#ffcf3a";
  ctx.beginPath();
  ctx.arc(px + s * 0.5 + (Math.random() - 0.5) * 4, py + s * 0.38, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const pos = playerPos(), s = TS;
  if (p.hurtT > 0 && Math.floor(time * 16) % 2) return;
  ctx.save();
  ctx.translate(pos.x * TS + s / 2, pos.y * TS + s);
  if (p.face < 0) ctx.scale(-1, 1);
  const step = p.moving && !p.falling && p.fromY === p.y ? Math.sin(p.t / p.dur * Math.PI) * s * 0.06 : 0;
  // boots and legs
  ctx.fillStyle = "#3d2a1a";
  ctx.fillRect(-s * 0.2, -s * 0.12 - step, s * 0.16, s * 0.12);
  ctx.fillRect(s * 0.04, -s * 0.12 + step, s * 0.16, s * 0.12);
  ctx.fillStyle = "#2f5fa8";
  ctx.fillRect(-s * 0.19, -s * 0.32, s * 0.14, s * 0.2);
  ctx.fillRect(s * 0.05, -s * 0.32, s * 0.14, s * 0.2);
  // body: red shirt and blue overalls
  ctx.fillStyle = "#d9452b";
  ctx.fillRect(-s * 0.23, -s * 0.62, s * 0.46, s * 0.32);
  ctx.fillStyle = "#3a6fc4";
  ctx.fillRect(-s * 0.2, -s * 0.5, s * 0.4, s * 0.2);
  ctx.fillRect(-s * 0.16, -s * 0.62, s * 0.06, s * 0.14);
  ctx.fillRect(s * 0.1, -s * 0.62, s * 0.06, s * 0.14);
  // head
  ctx.fillStyle = "#f2c49b";
  ctx.beginPath();
  ctx.arc(0, -s * 0.76, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.fillRect(s * 0.06, -s * 0.8, s * 0.05, s * 0.06);
  ctx.fillStyle = "#7a4a22";
  ctx.fillRect(-s * 0.04, -s * 0.68, s * 0.14, s * 0.035);
  // helmet with a lamp on the front
  ctx.fillStyle = "#ffcc1f";
  ctx.beginPath();
  ctx.arc(0, -s * 0.82, s * 0.18, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-s * 0.22, -s * 0.84, s * 0.46, s * 0.05);
  ctx.fillStyle = "#fffbe0";
  ctx.beginPath();
  ctx.arc(s * 0.13, -s * 0.9, s * 0.055, 0, Math.PI * 2);
  ctx.fill();
  // the pickaxe: resting on your shoulder, or swinging at the square you're digging
  let aim = -2.2;
  if (p.dig) {
    const dy = p.dig.y - p.y;
    const base = dy > 0 ? 1.3 : dy < 0 ? -1.6 : 0;
    aim = base - 1.1 + Math.abs(Math.sin(time * 14)) * 1.1;
  }
  ctx.translate(s * 0.18, -s * 0.46);
  ctx.rotate(aim);
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(0, -s * 0.03, s * 0.42, s * 0.06);
  ctx.fillStyle = PICK_COLORS[S ? S.up.pick : 0];
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.2);
  ctx.quadraticCurveTo(s * 0.5, 0, s * 0.4, s * 0.2);
  ctx.lineTo(s * 0.46, 0);
  ctx.fill();
  ctx.restore();
}

// underground it gets dark, and your lamp makes a circle of light around you
function drawDarkness(ox, oy, x0, x1, y0, y1) {
  const pos = playerPos();
  const a = clamp((pos.y - SKY - 1) / 10, 0, 1) * 0.97;
  if (a <= 0 || !S) return;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.globalCompositeOperation = "source-over";
  dctx.clearRect(0, 0, vw, vh);
  const top = Math.max(0, SKY * TS - oy);
  dctx.fillStyle = `rgba(4,3,10,${a})`;
  dctx.fillRect(0, top, vw, vh - top);
  dctx.globalCompositeOperation = "destination-out";
  const light = (wx, wy, radius) => {
    const cx = wx - ox, cy = wy - oy;
    const g = dctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.85)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    dctx.fillStyle = g;
    dctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  };
  light((pos.x + 0.5) * TS, (pos.y + 0.3) * TS, stat("lamp") * TS * (1 + Math.sin(time * 9) * 0.015));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = world[y * W + x];
      if (t === LAVA) light((x + 0.5) * TS, (y + 0.5) * TS, TS * 1.6);
      else if (t === CORE) light((x + 0.5) * TS, (y + 0.5) * TS, TS * 3.5);
    }
  }
  for (const b of bombs) light((b.x + 0.5) * TS, (b.y + 0.4) * TS, TS * 1.2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(dark, 0, 0);
  ctx.restore();
}

// ---------- 11. sound: little beeps made up on the spot ----------
let audio = null, muted = false;
function initAudio() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (audio.state === "suspended") audio.resume();
}

function tone(freq, dur, type, vol, slide, delay) {
  const t = audio.currentTime + (delay || 0);
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol) {
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.createBufferSource(), g = audio.createGain(), f = audio.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(f).connect(g).connect(audio.destination);
  src.start();
}

function sfx(name) {
  if (muted || !audio) return;
  switch (name) {
    case "dig": tone(110 + Math.random() * 80, 0.05, "square", 0.035, -40); break;
    case "break": tone(220, 0.09, "triangle", 0.09, -140); break;
    case "ore": tone(880, 0.08, "sine", 0.1); tone(1320, 0.14, "sine", 0.08, 0, 0.07); break;
    case "clunk": tone(140, 0.12, "square", 0.05, -50); break;
    case "cash": [1046, 1318, 1568].forEach((f, i) => tone(f, 0.14, "triangle", 0.08, 0, i * 0.08)); break;
    case "buy": tone(660, 0.08, "square", 0.05); tone(990, 0.12, "square", 0.05, 0, 0.07); break;
    case "hurt": tone(320, 0.28, "sawtooth", 0.09, -230); break;
    case "land": tone(90, 0.08, "triangle", 0.1, -30); break;
    case "ladder": tone(520, 0.04, "square", 0.04); break;
    case "fuse": noise(0.3, 0.08); break;
    case "boom": noise(0.7, 0.5); tone(70, 0.5, "sine", 0.3, -40); break;
    case "rope": tone(300, 0.45, "sine", 0.1, 700); break;
    case "win": [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "triangle", 0.09, 0, i * 0.12)); break;
  }
}

// ---------- 12. menus, the shop and the HUD ----------
const $ = id => document.getElementById(id);
const screens = { title: "title-screen", shop: "shop-screen", pause: "pause-screen", faint: "faint-screen", win: "end-screen" };
let mode = "title";

function setMode(m) {
  mode = m;
  for (const [name, id] of Object.entries(screens)) $(id).classList.toggle("hidden", name !== m);
  document.body.classList.toggle("in-menu", m === "title");
  dirs.length = 0;
  if (m !== "play") p.dig = null;
}

let shopNote = "";
function openShop(note) {
  shopNote = note;
  renderShop();
  setMode("shop");
}

function renderShop() {
  $("shop-note").innerHTML = shopNote;
  $("shop-cash").textContent = "$" + S.cash;
  let html = "";
  for (const [key, u] of Object.entries(UPGRADES)) {
    const cur = u.levels[S.up[key]], next = u.levels[S.up[key] + 1];
    html += `<div class="row"><div class="icon">${u.icon}</div><div class="info"><b>${u.name}: ${cur.label}</b>` +
      `<small>${next ? `Next: ${next.label}. ${u.what}` : "Fully upgraded!"}</small></div>` +
      (next ? `<button class="buy" data-up="${key}" ${S.cash < next.cost ? "disabled" : ""}>$${next.cost}</button>`
        : `<span class="maxed">MAX</span>`) + "</div>";
  }
  for (const [key, it] of Object.entries(ITEMS)) {
    const full = S.items[key] >= it.max;
    html += `<div class="row"><div class="icon">${it.icon}</div><div class="info"><b>${it.name}</b>` +
      `<small>You have ${S.items[key]}${full ? " (that's the most you can carry)" : ""}</small></div>` +
      `<button class="buy" data-item="${key}" ${S.cash < it.cost || full ? "disabled" : ""}>$${it.cost}</button></div>`;
  }
  $("shop-list").innerHTML = html;
}

$("shop-list").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;
  if (btn.dataset.up) {
    const key = btn.dataset.up, next = UPGRADES[key].levels[S.up[key] + 1];
    if (!next || S.cash < next.cost) return;
    S.cash -= next.cost;
    S.up[key]++;
    if (key === "energy") S.energy = stat("energy");
    if (key === "helmet") S.hearts = stat("helmet");
    shopNote = `${UPGRADES[key].icon} You got the <b>${next.label}</b> ${UPGRADES[key].name.toLowerCase()}!`;
  } else {
    const key = btn.dataset.item, it = ITEMS[key];
    if (S.cash < it.cost || S.items[key] >= it.max) return;
    S.cash -= it.cost;
    S.items[key] = Math.min(it.max, S.items[key] + it.amount);
    shopNote = `${it.icon} Bought ${it.name.toLowerCase()}.`;
  }
  sfx("buy");
  saveGame();
  renderShop();
});

function startGame(fresh) {
  initAudio();
  const old = fresh ? null : loadSave();
  if (old) {
    S = Object.assign(newSave(), old);
    world = fromB64(old.tiles, W * H);
    ladderMap = old.ladders ? fromB64(old.ladders, W * H) : new Uint8Array(W * H);
  } else {
    S = newSave();
    world = generate(S.seed);
    ladderMap = new Uint8Array(W * H);
  }
  p.x = p.fromX = clamp(S.x, 0, W - 1);
  p.y = p.fromY = clamp(S.y, 0, H - 2);
  p.moving = false; p.dig = null; p.falling = 0; p.hurtT = 0;
  p.atCamp = p.x === CAMP_X && p.y === SKY - 1;   // don't pop the shop open the moment you load
  bombs.length = 0;
  wobble.clear();
  cam.snap = true;
  saveGame();
  setMode("play");
  if (!old) toast("Hold ⬇ to dig down and find ore!");
}

let toastTimer = 0, lastToast = "", lastToastAt = -9;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  lastToast = text;
  lastToastAt = time;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
function toastOnce(text) { if (text !== lastToast || time - lastToastAt > 2.5) toast(text); }

const hudCache = {};
function setText(id, text) {
  if (hudCache[id] === text) return;
  hudCache[id] = text;
  $(id).textContent = text;
}
function updateHud() {
  if (!S) return;
  setText("depth", Math.max(0, p.y - SKY + 1) + " m");
  setText("cash", "$" + S.cash);
  setText("bag", bagCount() + "/" + stat("bag"));
  setText("hearts", "❤️".repeat(Math.max(0, S.hearts)) + "🖤".repeat(Math.max(0, stat("helmet") - Math.max(0, S.hearts))));
  setText("ladders", String(S.items.ladders));
  setText("dynamite", String(S.items.dynamite));
  setText("rope", String(S.items.rope));
  const e = S.energy / stat("energy");
  const fill = $("energy-fill");
  fill.style.width = (e * 100).toFixed(1) + "%";
  fill.style.background = e > 0.3 ? "#5fd36a" : e > 0.1 ? "#ffcf3f" : "#ff5a4a";
}

// ---------- 13. keyboard and touch ----------
const dirs = [];   // the arrow keys being held, the newest last
const heldDir = () => dirs[dirs.length - 1];
const press = d => { if (!dirs.includes(d)) dirs.push(d); };
const release = d => { const i = dirs.indexOf(d); if (i >= 0) dirs.splice(i, 1); };
const KEY_DIRS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };

window.addEventListener("keydown", e => {
  initAudio();
  if (KEY_DIRS[e.code]) {
    e.preventDefault();
    if (mode === "play") press(KEY_DIRS[e.code]);
    return;
  }
  if (e.repeat) return;
  if (e.code === "KeyM") { muted = !muted; toast(muted ? "Sound off" : "Sound on"); return; }
  if (mode === "play") {
    if (e.code === "Space" || e.code === "KeyB") { e.preventDefault(); dropDynamite(); }
    else if (e.code === "KeyR") useRope();
    else if (e.code === "Escape" || e.code === "KeyP") setMode("pause");
    else if ((e.code === "KeyE" || e.code === "Enter") && p.x === CAMP_X && p.y === SKY - 1) openShop("Welcome to camp!");
  } else if (mode === "shop" && (e.code === "Escape" || e.code === "Enter")) setMode("play");
  else if (mode === "pause" && (e.code === "Escape" || e.code === "KeyP")) setMode("play");
  else if (mode === "faint" && e.code === "Enter") wakeUp();
});
window.addEventListener("keyup", e => { if (KEY_DIRS[e.code]) release(KEY_DIRS[e.code]); });
window.addEventListener("blur", () => { dirs.length = 0; });

const touch = $("touch");
if ("ontouchstart" in window || matchMedia("(pointer: coarse)").matches) touch.classList.remove("hidden");
touch.querySelectorAll("button").forEach(btn => {
  const key = btn.dataset.key;
  btn.addEventListener("pointerdown", e => {
    e.preventDefault();
    initAudio();
    if (mode !== "play") return;
    if (DIRS[key]) press(key);
    else if (key === "bomb") dropDynamite();
    else if (key === "rope") useRope();
    else if (key === "pause") setMode("pause");
  });
  const up = () => { if (DIRS[key]) release(key); };
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
});

// title screen: "Keep digging" if there's a save, and "New mine" asks twice before wiping it
let confirmNew = false;
function setupTitle() {
  const has = !!loadSave();
  $("play").textContent = has ? "▶ Keep digging" : "▶ Play";
  $("new").classList.toggle("hidden", !has);
  $("new").textContent = "✨ New mine";
  confirmNew = false;
}
$("play").addEventListener("click", () => startGame(false));
$("new").addEventListener("click", () => {
  if (!confirmNew) { confirmNew = true; $("new").textContent = "Sure? Tap again!"; return; }
  startGame(true);
});
$("shop-close").addEventListener("click", () => setMode("play"));
$("resume").addEventListener("click", () => setMode("play"));
$("rescue").addEventListener("click", () => { setMode("play"); faint("You called for help."); });
$("to-title").addEventListener("click", () => { saveGame(); setupTitle(); setMode("title"); });
$("wake").addEventListener("click", wakeUp);
$("keep-going").addEventListener("click", () => setMode("play"));

// ---------- 14. the game loop ----------
let time = 0, last = performance.now(), acc = 0, saveClock = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    acc -= STEP;
    time += STEP;
    if (mode === "play") {
      updatePlayer(STEP);
      updateBoulders(STEP);
      updateBombs(STEP);
      if ((saveClock += STEP) > 15) { saveClock = 0; saveGame(); }
    }
    updateEffects(STEP);
  }
  if (world) updateCamera(1 / 60);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("pagehide", saveGame);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveGame(); });
resize();
setupTitle();
// a mountain to show behind the title screen, so it isn't empty
world = generate(12345);
ladderMap = new Uint8Array(W * H);
requestAnimationFrame(frame);
