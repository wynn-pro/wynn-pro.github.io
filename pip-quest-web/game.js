// Pip's Quest: a side-scrolling jump-and-run game with 20 levels.
// Grumbo the Rock Beetle King stole the Sun Bells. Run, jump, bonk boxes and stomp beetles
// until Pip the fox has rung all 20 bells again!
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const TILE = 16;              // every square in the world is 16 x 16 game pixels
const ROWS = 15;              // the world is 15 squares tall
const GRAVITY = 1800;         // how hard things fall (pixels per second, every second)
const GRAVITY_HOLD = 900;     // gravity is gentler while you hold jump on the way up, so you go higher
const MAX_FALL = 430;         // the fastest you can fall
const WALK = 90;              // top speed when walking
const RUN = 155;              // top speed when running
const ACCEL = 480;            // how quickly you speed up
const AIR_ACCEL = 360;        // ...and how quickly you can steer in the air
const FRICTION = 620;         // how quickly you stop when you let go
const JUMP = 350;             // jump power
const STOMP_BOUNCE = 240;     // how high you bounce off a beetle's head
const SPRING_JUMP = 520;      // spring power
const START_LIVES = 5;
const SAVE_KEY = "pipquest-save";
const STEP = 1 / 60;          // the game moves forward in tiny steps of 1/60 of a second

// ---------- 2. tiles: the squares the world is made of ----------
const AIR = 0, GROUND = 1, BRICK = 2, BOX_COIN = 3, BOX_POWER = 4, BOX_LIFE = 5, BOX_USED = 6,
  BLOCK = 7, CLOUD = 8, SPIKES = 9, LAVA = 10, GATE = 11, SPRING = 12, PILLAR = 13, PILLAR_TOP = 14, COIN = 15;
// SOLID[tile] says if you bump into that tile. Clouds are special: you can jump up through them.
const SOLID = [false, true, true, true, true, true, true, true, false, true, false, true, true, true, true, false];
const isBox = t => t === BOX_COIN || t === BOX_POWER || t === BOX_LIFE;

// ---------- 3. the 5 worlds ----------
const WORLDS = [
  { name: "Sunny Meadow", theme: "meadow", foes: ["beetle", "beetle", "snail", "hopper"] },
  { name: "Crystal Caves", theme: "caves", foes: ["beetle", "spiky", "bat", "snail"] },
  { name: "Cloud Kingdom", theme: "sky", foes: ["bat", "hopper", "beetle", "snail"] },
  { name: "Dune Desert", theme: "desert", foes: ["hopper", "spiky", "beetle", "snail", "bat"] },
  { name: "Volcano Peak", theme: "volcano", foes: ["spiky", "bat", "beetle", "hopper", "snail"] },
];
const FORT_FOES = ["beetle", "bat", "spiky"];
const LEVEL_NAMES = [
  "Hello, Meadow!", "Bouncy Hills", "Snail Trail", "Grumbo's Fort",
  "Into the Glow", "Spiky Tunnels", "Bat Cave", "Crystal Keep",
  "Above the Clouds", "Floating Islands", "Windy Steps", "Sky Castle",
  "Hot Sand", "Cactus Corner", "Jumping Dunes", "Desert Tower",
  "Lava Lane", "Fire Steps", "Smoky Summit", "Grumbo's Throne",
];

// colours for each place. dirt is the inside of the ground, top is the grass on top.
const THEMES = {
  meadow: { sky: ["#4fb3ff", "#c4ecff"], dirt: "#b06c34", dirtDark: "#8a4f22", top: "#52c447", topDark: "#349a33",
    brick: "#c8603a", block: "#a5784e", pillar: "log", far: "#9be08a", near: "#63c45a" },
  caves: { sky: ["#1b1033", "#3b2266"], dirt: "#5a4a7a", dirtDark: "#3f3260", top: "#8f7bd1", topDark: "#6a58ab",
    brick: "#6d5aa6", block: "#7a6c9c", pillar: "crystal", far: "#2c1d4f", near: "#3d2a69", ceiling: true },
  sky: { sky: ["#8ec5ff", "#ffe2f2"], dirt: "#e9f2ff", dirtDark: "#c8d9f2", top: "#ffffff", topDark: "#dce9fb",
    brick: "#ef8fb0", block: "#b9c7ec", pillar: "cloud", far: "#ffffff", near: "#f3f8ff" },
  desert: { sky: ["#ffb35c", "#ffe9b0"], dirt: "#e0a85a", dirtDark: "#c08a40", top: "#f6cf7c", topDark: "#dcae5a",
    brick: "#c9763c", block: "#b98a50", pillar: "cactus", far: "#f2c27a", near: "#e6ad60" },
  volcano: { sky: ["#3a0d12", "#a8371f"], dirt: "#4a3a3a", dirtDark: "#2e2222", top: "#6a5050", topDark: "#4c3838",
    brick: "#7a3a2a", block: "#5c4a4a", pillar: "stone", far: "#2a0d10", near: "#4a1a16", lava: true },
  castle: { sky: ["#141a2b", "#2b3550"], dirt: "#6d7488", dirtDark: "#4d5366", top: "#8a91a6", topDark: "#6d7488",
    brick: "#5f6680", block: "#7c8399", pillar: "stone", far: "#1e2539", near: "#2a3149", lava: true, ceiling: true },
};

// which pieces each kind of level is built from. Bigger number = that piece shows up more often.
const PIECE_WEIGHTS = {
  meadow: { flat: 3, gap: 2, boxes: 3, stairs: 1, pillars: 2, hill: 2, floaters: 1, spring: 1 },
  caves: { flat: 2, gap: 2, boxes: 2, stairs: 1, pillars: 1, hill: 2, spikes: 3, floaters: 1, spring: 1 },
  sky: { flat: 1, gap: 3, boxes: 2, floaters: 4, mover: 3, spring: 1, hill: 1 },
  desert: { flat: 2, gap: 2, boxes: 2, pillars: 3, hill: 3, spring: 2, spikes: 1, stairs: 1 },
  volcano: { flat: 2, gap: 3, boxes: 2, firebar: 2, mover: 2, floaters: 2, stairs: 1, hill: 1 },
  castle: { flat: 2, gap: 3, boxes: 1, firebar: 3, floaters: 1, stairs: 1, spikes: 1, mover: 1 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// a "seeded" random number maker: the same seed always gives the same numbers,
// so level 7 is the same level 7 every time you play it.
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 4. building a level out of pieces, like snapping Lego together ----------
function buildLevel(n) {
  const worldNum = Math.floor(n / 4);
  const fort = n % 4 === 3;            // the 4th level of every world is a fort with a boss
  const world = WORLDS[worldNum];
  const themeName = fort ? "castle" : world.theme;
  const theme = THEMES[themeName];
  const rand = makeRng(n * 7919 + 1337);
  const r = (a, b) => a + Math.floor(rand() * (b - a + 1));   // a random whole number from a to b
  const chance = p => rand() < p;
  const pick = list => list[Math.floor(rand() * list.length)];
  const hard = n / 19;                 // 0 on the first level, 1 on the last one
  const goalLength = fort ? 100 + worldNum * 12 : 130 + n * 6;
  const stride = goalLength + 140;
  const tiles = new Uint8Array(stride * ROWS);
  const surface = new Int8Array(stride).fill(-1);   // the row you'd stand on in each column (-1 = a pit)
  const spawns = [];
  const foeKinds = n === 0 ? ["beetle"] : fort ? FORT_FOES : world.foes;
  const foeMax = 1 + Math.round(hard * 2);
  let x = 0;                           // the column we're building next
  let gy = 12;                         // the row the ground starts at (smaller = higher up)
  let powerWait = 0;
  let lifeBoxes = 0;

  const set = (tx, ty, t) => { if (tx >= 0 && tx < stride && ty >= 0 && ty < ROWS) tiles[ty * stride + tx] = t; };
  const get = (tx, ty) => (tx >= 0 && tx < stride && ty >= 0 && ty < ROWS ? tiles[ty * stride + tx] : AIR);

  function ground(count) {
    for (let i = 0; i < count; i++, x++) {
      for (let ty = gy; ty < ROWS; ty++) set(x, ty, GROUND);
      surface[x] = gy;
    }
  }
  function pit(count) {
    for (let i = 0; i < count; i++, x++) {
      if (theme.lava) { set(x, ROWS - 2, LAVA); set(x, ROWS - 1, LAVA); }
    }
  }
  // one column of stairs, i blocks tall
  function stairColumn(i) {
    for (let ty = gy; ty < ROWS; ty++) set(x, ty, GROUND);
    for (let ty = gy - i; ty < gy; ty++) set(x, ty, BLOCK);
    surface[x] = gy - i;
    x++;
  }
  function coins(tx, ty, count) {
    for (let i = 0; i < count; i++) if (get(tx + i, ty) === AIR) set(tx + i, ty, COIN);
  }
  function foes(from, span, count) {
    for (let i = 0; i < count; i++) {
      const tx = from + r(0, Math.max(0, span - 1));
      const top = surface[tx];
      if (top < 0) continue;
      const kind = pick(foeKinds);
      if (kind === "bat") spawns.push({ kind, x: tx * TILE + 1, bottom: (top - r(2, 4)) * TILE });
      else if (get(tx, top - 1) === AIR) spawns.push({ kind, x: tx * TILE + 1, bottom: top * TILE });
    }
  }
  function boxRow(tx, ty, count) {
    const special = r(0, count - 1);
    for (let i = 0; i < count; i++) {
      let t = chance(0.4) ? BOX_COIN : BRICK;
      if (i === special) {
        if (powerWait <= 0) { t = BOX_POWER; powerWait = 2; }
        else if (lifeBoxes === 0 && chance(0.25)) { t = BOX_LIFE; lifeBoxes++; }
        else t = BOX_COIN;
      }
      set(tx + i, ty, t);
    }
    powerWait--;
  }

  // the pieces. Each one adds a few columns to the end of the level.
  const pieces = {
    flat() {
      const start = x, len = r(6, 10);
      ground(len);
      foes(start + 2, len - 3, r(0, foeMax));
      if (chance(0.35)) coins(start + 2, gy - 3, r(3, 5));
    },
    gap() {
      const maxGap = n === 0 ? 2 : Math.min(4, 2 + Math.floor(hard * 3));
      const wide = r(2, maxGap), start = x;
      pit(wide);
      for (let i = 0; i < wide; i++) set(start + i, gy - 3 - (i > 0 && i < wide - 1 ? 1 : 0), COIN);
      if (foeKinds.includes("bat") && chance(0.3 + hard * 0.3)) spawns.push({ kind: "bat", x: start * TILE, bottom: (gy - 3) * TILE });
      if (chance(0.3)) gy = clamp(gy + pick([-1, 1]), 9, 12);
      ground(r(3, 4));
    },
    boxes() {
      const start = x, len = r(8, 11);
      ground(len);
      const bx = start + r(2, 3), bw = r(3, 5);
      boxRow(bx, gy - 4, bw);
      if (!theme.ceiling && gy >= 10 && chance(0.4)) {
        const bx2 = bx + bw - 1, bw2 = r(2, 4);
        for (let i = 0; i < bw2; i++) set(bx2 + i, gy - 7, chance(0.3) ? BOX_COIN : BRICK);
        coins(bx2, gy - 8, bw2);
      }
      foes(start + 1, len - 2, r(n === 0 ? 0 : 1, foeMax));
    },
    stairs() {
      const h = r(2, Math.min(5, 3 + Math.floor(hard * 3)));
      ground(1);
      for (let i = 1; i <= h; i++) stairColumn(i);
      if (chance(0.5)) stairColumn(h);
      if (chance(0.3 + hard * 0.4)) pit(r(1, 2));
      for (let i = h; i >= 1; i--) stairColumn(i);
      ground(2);
    },
    pillars() {
      const start = x;
      ground(13);
      for (const px of [start + 2, start + 8]) {
        const ph = r(2, n < 2 ? 2 : 3);
        for (let k = 0; k < 2; k++) {
          for (let ty = gy - ph + 1; ty < gy; ty++) set(px + k, ty, PILLAR);
          set(px + k, gy - ph, PILLAR_TOP);
          surface[px + k] = gy - ph;
        }
      }
      foes(start + 4, 4, r(1, foeMax));
      if (chance(0.5)) coins(start + 4, gy - 3, 4);
    },
    hill() {
      const dir = gy >= 12 ? -1 : gy <= 9 ? 1 : pick([-1, 1]);
      gy = clamp(gy + dir * r(1, 2), 9, 12);
      const start = x, len = r(5, 8);
      ground(len);
      foes(start + 1, len - 2, r(0, foeMax - 1));
      if (chance(0.3)) coins(start + 1, gy - 2, 3);
    },
    floaters() {
      const plat = themeName === "sky" ? CLOUD : BLOCK;
      let h = gy;
      const hops = r(2, 3);
      for (let i = 0; i < hops; i++) {
        const gapW = r(2, 3);
        pit(gapW);
        h = clamp(h - (gapW === 3 ? r(-1, 1) : r(-2, 2)), 7, 12);
        const pw = r(2, 3);
        for (let k = 0; k < pw; k++, x++) {
          set(x, h, plat);
          surface[x] = h;
          if (theme.lava) { set(x, ROWS - 2, LAVA); set(x, ROWS - 1, LAVA); }
        }
        if (chance(0.5)) coins(x - pw, h - 2, pw);
      }
      pit(2);
      gy = clamp(Math.max(gy, h - 2), 9, 12);
      ground(3);
    },
    mover() {
      const wide = r(7, 10), start = x;
      pit(wide);
      spawns.push({ kind: "platform", x: start * TILE, bottom: gy * TILE + 8, x0: start * TILE,
        x1: (start + wide - 3) * TILE, speed: 35 + hard * 25, cloud: themeName === "sky" });
      coins(start + 2, gy - 4, wide - 4);
      ground(3);
    },
    spikes() {
      const start = x, len = r(8, 11);
      ground(len);
      let sx = start + 2;
      const groups = hard > 0.4 ? 2 : 1;
      for (let g = 0; g < groups; g++) {
        const sw = r(2, 3);
        if (sx + sw > start + len - 2) break;
        for (let k = 0; k < sw; k++) { set(sx + k, gy - 1, SPIKES); surface[sx + k] = gy - 1; }
        coins(sx, gy - 4, sw);
        sx += sw + 2;
      }
    },
    firebar() {
      const start = x;
      ground(10);
      const bx = start + 5;
      set(bx, gy - 3, BLOCK);
      spawns.push({ kind: "firebar", x: bx * TILE + 8, y: (gy - 3) * TILE + 8,
        len: 4 + (hard > 0.5 ? 1 : 0), spin: (chance(0.5) ? 1 : -1) * (1.6 + hard) });
    },
    spring() {
      const start = x;
      ground(9);
      // the spring sits right next to a wall that's too tall to jump over without it
      set(start + 4, gy - 1, SPRING);
      surface[start + 4] = gy - 1;
      for (let k = 0; k < 2; k++) {
        for (let ty = gy - 5; ty < gy; ty++) set(start + 5 + k, ty, BLOCK);
        surface[start + 5 + k] = gy - 5;
      }
      for (let ty = gy - 9; ty <= gy - 7; ty++) if (ty > 1) set(start + 3, ty, COIN);
    },
  };

  const weights = PIECE_WEIGHTS[themeName];
  function choosePiece(last) {
    let total = 0;
    for (const k in weights) total += weights[k];
    for (let tries = 0; tries < 4; tries++) {
      let roll = rand() * total;
      for (const k in weights) {
        roll -= weights[k];
        if (roll < 0) {
          if (k === last && tries < 3) break;   // try not to use the same piece twice in a row
          return k;
        }
      }
    }
    return "flat";
  }

  // the start: some flat ground so you can get ready
  ground(14);
  let checkpoint = null, last = "";
  if (n === 0) { pieces.boxes(); last = "boxes"; }
  while (x < goalLength) {
    if (!checkpoint && x > goalLength / 2) {
      ground(1);
      checkpoint = { x: x * TILE, y: gy * TILE };
      spawns.push({ kind: "checkpoint", x: x * TILE + 4, bottom: gy * TILE });
      ground(3);
      continue;
    }
    const name = choosePiece(last);
    pieces[name]();
    last = name;
  }

  let gateX = -1;
  if (fort) {
    // the boss room: flat floor, a gate that only opens when Grumbo is beaten, then the bell
    gy = 12;
    ground(4);
    const arenaStart = x;
    ground(22);
    const arenaEnd = x;
    gateX = x;
    ground(1);
    for (let ty = 1; ty < gy; ty++) set(gateX, ty, GATE);
    spawns.push({ kind: "boss", x: (arenaStart + 15) * TILE, bottom: gy * TILE,
      minX: arenaStart * TILE, maxX: arenaEnd * TILE, power: worldNum });
    ground(4);
  } else {
    // a big staircase to jump off
    ground(3);
    const steps = Math.min(4 + Math.floor(worldNum / 2), gy - 3);
    for (let i = 1; i <= steps; i++) stairColumn(i);
    stairColumn(steps);
    ground(3);
  }
  const poleX = x;
  ground(1);
  set(poleX, gy - 1, BLOCK);
  surface[poleX] = gy - 1;
  const bell = { x: poleX * TILE, top: Math.max(1, gy - 10) * TILE, bottom: (gy - 1) * TILE };
  ground(4);
  const house = { x: x * TILE, y: gy * TILE };
  ground(12);

  if (theme.ceiling) for (let tx = 0; tx < x; tx++) set(tx, 0, themeName === "castle" ? BLOCK : GROUND);

  return {
    n, worldNum, fort, theme, themeName, w: x, stride, tiles, spawns, checkpoint, bell, house, gateX,
    start: { x: 3 * TILE, y: 12 * TILE },
    name: LEVEL_NAMES[n],
    label: `${worldNum + 1}-${(n % 4) + 1}`,
  };
}

// ---------- 5. the game's memory ----------
let level = null;
let entities = [];      // beetles, platforms, power-ups... anything that moves
let fx = [];            // sparkly bits that are just for looks
let bumps = new Map();  // boxes that are bouncing because you hit them
let player = null;
let cam = { x: 0 };
let time = 0;
const game = { state: "menu", n: 0, lives: START_LIVES, coins: 0, score: 0, checkpointLevel: -1,
  big: false, fire: false, combo: 0, goalTimer: 0, deathTimer: 0, levelCoins: 0, bellSwing: 0, walking: false };
let save = { unlocked: 0, done: [] };

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.unlocked === "number") save = { unlocked: clamp(s.unlocked, 0, 19), done: Array.isArray(s.done) ? s.done : [] };
  } catch (e) { /* no save yet, or the browser won't let us read it */ }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* the game still works without saving */ }
}

const tileAt = (tx, ty) => (tx >= 0 && tx < level.w && ty >= 0 && ty < ROWS ? level.tiles[ty * level.stride + tx] : AIR);
function setTile(tx, ty, t) { if (tx >= 0 && tx < level.w && ty >= 0 && ty < ROWS) level.tiles[ty * level.stride + tx] = t; }
// the two ends of the level are invisible walls
function solidAt(tx, ty) {
  if (tx < 0 || tx >= level.w) return true;
  if (ty < 0 || ty >= ROWS) return false;
  return SOLID[level.tiles[ty * level.stride + tx]];
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ---------- 6. moving things and bumping into walls ----------
// First we move sideways and push back out of any wall, then we move up/down and do the same.
// Doing the two directions one at a time is the trick that makes it work.
function moveBody(b, dt) {
  const prevBottom = b.y + b.h;
  b.hitWall = 0;
  b.x += b.vx * dt;
  const top = Math.floor(b.y / TILE), bot = Math.floor((b.y + b.h - 0.01) / TILE);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / TILE);
    for (let ty = top; ty <= bot; ty++) if (solidAt(tx, ty)) { b.x = tx * TILE - b.w; b.hitWall = 1; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE);
    for (let ty = top; ty <= bot; ty++) if (solidAt(tx, ty)) { b.x = (tx + 1) * TILE; b.hitWall = -1; break; }
  }
  if (b.hitWall) b.vx = 0;

  b.y += b.vy * dt;
  b.onGround = false;
  b.groundTile = AIR;
  b.headHits = null;
  const left = Math.floor(b.x / TILE), right = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const t = tileAt(tx, ty);
      if (solidAt(tx, ty) || (t === CLOUD && prevBottom <= ty * TILE + 0.5)) {
        b.y = ty * TILE - b.h;
        b.vy = 0;
        b.onGround = true;
        if (b.groundTile !== SPRING) { b.groundTile = t; b.groundTx = tx; }
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / TILE);
    for (let tx = left; tx <= right; tx++) if (solidAt(tx, ty)) (b.headHits ||= []).push(tx);
    if (b.headHits) { b.y = (ty + 1) * TILE; b.vy = 0; b.headRow = ty; }
  }
}

// ---------- 7. Pip ----------
function makePlayer(x, bottom) {
  const big = game.big;
  const h = big ? 26 : 14;
  return { x, y: bottom - h, w: 12, h, vx: 0, vy: 0, facing: 1, big, fire: game.fire && big,
    onGround: false, coyote: 0, invuln: 0, anim: 0, riding: null, growFlash: 0, dead: false, hidden: false };
}

const keys = { left: false, right: false, jump: false, run: false, jumpBuffer: 0, throwPressed: false };

function updatePlayer(dt) {
  const p = player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.growFlash = Math.max(0, p.growFlash - dt);
  const max = keys.run ? RUN : WALK;
  const accel = p.onGround ? ACCEL : AIR_ACCEL;
  const goLeft = keys.left && !keys.right, goRight = keys.right && !keys.left;
  if (goRight) {
    p.vx += accel * dt * (p.vx < 0 ? 2 : 1);
    p.facing = 1;
  } else if (goLeft) {
    p.vx -= accel * dt * (p.vx > 0 ? 2 : 1);
    p.facing = -1;
  } else {
    const slow = (p.onGround ? FRICTION : 160) * dt;
    p.vx = Math.abs(p.vx) <= slow ? 0 : p.vx - Math.sign(p.vx) * slow;
  }
  // if you're faster than the top speed (say you let go of run), slow down smoothly
  if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - FRICTION * dt);

  // jumping. "coyote time" lets you still jump a tiny moment after running off a ledge.
  keys.jumpBuffer = Math.max(0, keys.jumpBuffer - dt);
  if (keys.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = -(JUMP + Math.abs(p.vx) * 0.15);
    p.onGround = false;
    p.coyote = 0;
    keys.jumpBuffer = 0;
    p.riding = null;
    sfx.jump();
  }
  const g = p.vy < 0 && keys.jump ? GRAVITY_HOLD : GRAVITY;
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);

  // standing on a moving platform carries you along with it
  if (p.riding) {
    p.x += p.riding.moved;
    p.riding = null;
  }
  const prevBottom = p.y + p.h;
  moveBody(p, dt);
  landOnPlatforms(p, prevBottom);

  if (p.onGround) {
    p.coyote = 0.08;
    game.combo = 0;
    if (p.groundTile === SPRING) {
      p.vy = -SPRING_JUMP;
      p.onGround = false;
      bumps.set(level.stride * ROWS + p.groundTx, 0.25);  // makes the spring squish
      sfx.spring();
    }
  } else {
    p.coyote -= dt;
  }

  if (p.headHits) {
    const cx = p.x + p.w / 2;
    let best = p.headHits[0];
    for (const tx of p.headHits) if (Math.abs(tx * TILE + 8 - cx) < Math.abs(best * TILE + 8 - cx)) best = tx;
    bumpTile(best, p.headRow);
  }

  // throwing sparks when you have the Ember Flower power
  if (keys.throwPressed) {
    keys.throwPressed = false;
    if (p.fire && entities.filter(e => e.kind === "spark").length < 2) {
      entities.push({ kind: "spark", x: p.x + (p.facing > 0 ? p.w : -6), y: p.y + 6, w: 6, h: 6,
        vx: p.facing * 240, vy: 60, t: 0, awake: true });
      sfx.spark();
    }
  }

  // collecting coins, and checking for lava
  const l = Math.floor(p.x / TILE), rr = Math.floor((p.x + p.w - 0.01) / TILE);
  const t0 = Math.floor(p.y / TILE), b0 = Math.floor((p.y + p.h - 0.01) / TILE);
  let hurtBySpikes = false, inLava = false;
  for (let tx = l; tx <= rr; tx++) {
    for (let ty = t0; ty <= b0; ty++) {
      const t = tileAt(tx, ty);
      if (t === COIN) { setTile(tx, ty, AIR); addCoin(tx * TILE + 8, ty * TILE + 8, false); }
      if (t === LAVA && p.y + p.h > ty * TILE + 4) inLava = true;
    }
  }
  // touching spikes: look one pixel around Pip
  for (let tx = Math.floor((p.x - 1) / TILE); tx <= Math.floor((p.x + p.w) / TILE); tx++) {
    for (let ty = Math.floor(p.y / TILE); ty <= Math.floor((p.y + p.h + 1) / TILE); ty++) {
      if (tileAt(tx, ty) === SPIKES) hurtBySpikes = true;
    }
  }
  if (inLava) return killPlayer();
  if (hurtBySpikes) hurtPlayer();
  if (p.y > ROWS * TILE + 16) return killPlayer();

  p.anim += dt * (Math.abs(p.vx) / 60 + 0.2);

  // checkpoint flag
  for (const e of entities) {
    if (e.kind === "checkpoint" && !e.reached && p.x > e.x - 4) {
      e.reached = true;
      game.checkpointLevel = level.n;
      sfx.checkpoint();
      popup(e.x + 4, e.y - 8, "CHECKPOINT!");
    }
  }

  // the bell pole
  if (p.x + p.w >= level.bell.x - 1) startGoal();
}

function landOnPlatforms(p, prevBottom) {
  if (p.vy < 0) return;
  for (const e of entities) {
    if (e.kind !== "platform") continue;
    if (p.x + p.w > e.x && p.x < e.x + e.w && prevBottom <= e.y + 1 && p.y + p.h >= e.y) {
      p.y = e.y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.groundTile = AIR;
      p.riding = e;
    }
  }
}

function growPlayer() {
  const p = player;
  if (p.big) return;
  p.big = true;
  p.y -= 12;
  p.h = 26;
  p.growFlash = 0.6;
}
function hurtPlayer() {
  const p = player;
  if (p.invuln > 0 || game.state !== "play") return;
  if (p.fire) {
    p.fire = false;
  } else if (p.big) {
    p.big = false;
    p.y += 12;
    p.h = 14;
  } else {
    return killPlayer();
  }
  p.invuln = 1.6;
  p.growFlash = 0.4;
  sfx.hurt();
}
function killPlayer() {
  if (game.state !== "play") return;
  game.state = "dying";
  game.deathTimer = 0;
  player.dead = true;
  player.vy = -360;
  player.vx = 0;
  game.big = false;
  game.fire = false;
  stopMusic();
  sfx.die();
}

// ---------- 8. boxes, bricks and coins ----------
function bumpTile(tx, ty) {
  const t = tileAt(tx, ty);
  const key = ty * level.stride + tx;
  if (t === BRICK) {
    if (player.big) {
      setTile(tx, ty, AIR);
      for (let i = 0; i < 4; i++) {
        fx.push({ kind: "shard", x: tx * TILE + 4 + (i % 2) * 8, y: ty * TILE + 4 + Math.floor(i / 2) * 8,
          vx: (i % 2 ? 1 : -1) * (40 + Math.random() * 40), vy: -260 + Math.floor(i / 2) * 80, t: 1.2,
          color: level.theme.brick });
      }
      addScore(50);
      sfx.breakBrick();
    } else {
      bumps.set(key, 0.15);
      sfx.bump();
    }
  } else if (isBox(t)) {
    setTile(tx, ty, BOX_USED);
    bumps.set(key, 0.15);
    if (t === BOX_COIN) {
      addCoin(tx * TILE + 8, ty * TILE, true);
    } else {
      const kind = t === BOX_LIFE ? "leaf" : player.big ? "flower" : "acorn";
      entities.push({ kind, x: tx * TILE + 1, y: ty * TILE, w: 14, h: 14, vx: 0, vy: 0, dir: 1,
        rise: 14, awake: true, t: 0 });
      sfx.sprout();
    }
  } else {
    sfx.bump();
    return;
  }
  // anything standing on top of the box gets bonked too
  if (tileAt(tx, ty - 1) === COIN) { setTile(tx, ty - 1, AIR); addCoin(tx * TILE + 8, (ty - 1) * TILE, true); }
  const area = { x: tx * TILE, y: ty * TILE - 4, w: TILE, h: 4 };
  for (const e of entities) {
    if (isFoe(e) && !e.dying && overlap(area, e)) { flipFoe(e, 200); addScore(100); }
    if ((e.kind === "acorn" || e.kind === "leaf") && overlap(area, e)) { e.vy = -220; e.dir = e.x + 7 < tx * TILE + 8 ? -1 : 1; }
  }
}

function addCoin(x, y, pop) {
  game.coins++;
  game.levelCoins++;
  addScore(10);
  if (game.coins % 100 === 0) addLife(x, y);
  if (pop) fx.push({ kind: "coinpop", x, y, vy: -260, t: 0.45 });
  sfx.coin();
}
function addScore(n) { game.score += n; }
function addLife(x, y) {
  game.lives++;
  popup(x, y, "1UP!");
  sfx.oneUp();
}
function popup(x, y, text) { fx.push({ kind: "popup", x, y, text, t: 0.9 }); }

// ---------- 9. beetles, snails, bats and friends ----------
const FOES = ["beetle", "snail", "shell", "spiky", "bat", "hopper"];
const isFoe = e => FOES.includes(e.kind);

function makeEntity(s) {
  const e = { kind: s.kind, x: s.x, y: 0, w: 14, h: 12, vx: 0, vy: 0, dir: -1, awake: false, t: Math.random() * 10 };
  switch (s.kind) {
    case "beetle": e.speed = 30; break;
    case "snail": e.h = 14; e.speed = 24; e.smart = true; break;
    case "spiky": e.speed = 28; e.smart = true; break;
    case "bat": e.h = 10; e.speed = 34; e.homeX = s.x; break;
    case "hopper": e.speed = 50; e.hopTimer = 1 + Math.random(); break;
    case "platform":
      Object.assign(e, { w: 48, h: 8, x0: s.x0, x1: s.x1, speed: s.speed, cloud: s.cloud, dir: 1, awake: true, moved: 0 });
      break;
    case "firebar":
      Object.assign(e, { cx: s.x, cy: s.y, len: s.len, spin: s.spin, angle: Math.random() * 6, w: 0, h: 0, awake: true });
      break;
    case "checkpoint":
      Object.assign(e, { w: 8, h: 40, reached: game.checkpointLevel === level.n, awake: true });
      break;
    case "boss": {
      const hp = 3 + s.power;
      Object.assign(e, { w: 30, h: 26, hp, maxHp: hp, power: s.power, minX: s.minX, maxX: s.maxX,
        hurt: 0, jumpTimer: 2, throwTimer: 3 });
      break;
    }
  }
  e.y = s.bottom - e.h;
  if (e.kind === "bat") e.baseY = e.y;
  return e;
}

function updateEntities(dt) {
  const viewRight = cam.x + viewW + 32;
  for (const e of entities) {
    if (!e.awake) {
      if (e.x < viewRight) e.awake = true;
      else continue;
    }
    e.t += dt;
    switch (e.kind) {
      case "beetle": case "snail": case "spiky": case "hopper": case "bat": case "shell": updateFoe(e, dt); break;
      case "platform": {
        const before = e.x;
        e.x += e.dir * e.speed * dt;
        if (e.x > e.x1) { e.x = e.x1; e.dir = -1; }
        if (e.x < e.x0) { e.x = e.x0; e.dir = 1; }
        e.moved = e.x - before;
        break;
      }
      case "firebar": {
        e.angle += e.spin * dt;
        if (game.state === "play") {
          for (let i = 1; i <= e.len; i++) {
            const bx = e.cx + Math.cos(e.angle) * i * 8, by = e.cy + Math.sin(e.angle) * i * 8;
            if (overlap({ x: bx - 3, y: by - 3, w: 6, h: 6 }, player)) hurtPlayer();
          }
        }
        break;
      }
      case "acorn": case "leaf": case "flower": updatePowerUp(e, dt); break;
      case "spark": updateSpark(e, dt); break;
      case "rock": updateRock(e, dt); break;
      case "boss": updateBoss(e, dt); break;
    }
  }
  entities = entities.filter(e => !e.gone);
}

function updateFoe(e, dt) {
  if (e.dying) {   // knocked upside down: fall off the screen
    e.vy += GRAVITY * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.y > ROWS * TILE + 40) e.gone = true;
    return;
  }
  if (e.squash > 0) {   // stomped flat
    e.squash -= dt;
    if (e.squash <= 0) e.gone = true;
    return;
  }
  if (e.kind === "bat") {
    e.x += e.dir * e.speed * dt;
    if (e.x < e.homeX - 64) e.dir = 1;
    if (e.x > e.homeX + 32) e.dir = -1;
    e.y = e.baseY + Math.sin(e.t * 3) * 14;
  } else if (e.kind === "hopper") {
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    moveBody(e, dt);
    if (e.hitWall) e.dir = -e.dir;
    if (e.onGround) {
      e.vx = 0;
      e.hopTimer -= dt;
      if (e.hopTimer <= 0) {
        e.dir = player.x < e.x ? -1 : 1;
        e.vy = -300;
        e.vx = e.dir * e.speed;
        e.hopTimer = 1.1 + Math.random() * 0.6;
      }
    } else if (e.vx === 0 && !e.hitWall) {
      e.vx = e.dir * e.speed;
    }
  } else {
    const speed = e.kind === "shell" ? (e.moving ? 230 : 0) : e.speed;
    e.vx = e.dir * speed;
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    moveBody(e, dt);
    if (e.hitWall) {
      e.dir = -e.dir;
      if (e.kind === "shell" && onScreen(e)) sfx.bump();
    }
    // smart ones turn around at the edge of a cliff instead of walking off
    if (e.smart && e.onGround) {
      const ahead = Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / TILE);
      const below = Math.floor((e.y + e.h + 1) / TILE);
      if (!solidAt(ahead, below) && tileAt(ahead, below) !== CLOUD) e.dir = -e.dir;
    }
    if (e.kind === "shell") {
      e.kickGrace = Math.max(0, (e.kickGrace || 0) - dt);
      if (e.moving) {
        for (const o of entities) {
          if (o !== e && isFoe(o) && !o.dying && o.awake && overlap(e, o)) { flipFoe(o, 180); addScore(200); popup(o.x, o.y, "200"); }
        }
      }
    }
  }
  if (e.y > ROWS * TILE + 32) e.gone = true;

  // walkers bounce off each other
  if (e.kind === "beetle" || e.kind === "snail" || e.kind === "spiky") {
    for (const o of entities) {
      if (o !== e && (o.kind === "beetle" || o.kind === "snail" || o.kind === "spiky") && !o.dying && !o.squash && overlap(e, o)) {
        e.dir = e.x < o.x ? -1 : 1;
        o.dir = -e.dir;
      }
    }
  }

  if (game.state === "play" && overlap(e, player)) touchFoe(e);
}

function touchFoe(e) {
  const p = player;
  const stomp = p.vy > 0 && p.y + p.h - p.vy * STEP <= e.y + 7;
  if (e.kind === "spiky") return hurtPlayer();
  if (e.kind === "shell") {
    if (e.kickGrace > 0) return;   // you just stomped it, give Pip a moment to bounce away
    if (!e.moving) {
      e.moving = true;
      e.dir = p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1;
      e.kickGrace = 0.25;
      addScore(100);
      sfx.kick();
      if (stomp) bounce();
    } else if (stomp) {
      e.moving = false;
      e.kickGrace = 0.25;
      bounce();
      sfx.stomp();
    } else {
      hurtPlayer();
    }
    return;
  }
  if (stomp) {
    if (e.kind === "snail") {
      e.kind = "shell";
      e.y += 4;
      e.h = 10;
      e.moving = false;
      e.kickGrace = 0.25;
    } else if (e.kind === "bat") {
      flipFoe(e, 0);
    } else {
      e.squash = 0.4;
    }
    bounce();
    sfx.stomp();
    const points = [100, 200, 400, 800, 1000][Math.min(4, game.combo)];
    game.combo++;
    addScore(points);
    popup(e.x + 7, e.y, String(points));
  } else {
    hurtPlayer();
  }
}

function bounce() {
  player.vy = -(keys.jump ? JUMP * 0.95 : STOMP_BOUNCE);
  player.y -= 1;
}

function flipFoe(e, up) {
  e.dying = true;
  e.vy = -up;
  e.vx = (Math.random() - 0.5) * 60;
  if (onScreen(e)) sfx.stomp();
}

const onScreen = e => e.x + e.w > cam.x && e.x < cam.x + viewW;

function updatePowerUp(e, dt) {
  if (e.rise > 0) {   // slowly coming out of the box
    const d = Math.min(e.rise, 30 * dt);
    e.y -= d;
    e.rise -= d;
  } else if (e.kind !== "flower") {
    e.vx = e.dir * (e.kind === "leaf" ? 65 : 50);
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    moveBody(e, dt);
    if (e.hitWall) e.dir = -e.dir;
    if (e.y > ROWS * TILE + 16) e.gone = true;
  }
  if (game.state === "play" && e.rise <= 0 && overlap(e, player)) {
    e.gone = true;
    if (e.kind === "leaf") return addLife(e.x, e.y);
    if (e.kind === "flower") {
      growPlayer();
      player.fire = true;
      player.growFlash = 0.6;
      popup(e.x, e.y, "SPARKS!");
    } else {
      growPlayer();
      popup(e.x, e.y, "1000");
    }
    addScore(1000);
    sfx.powerUp();
  }
}

function updateSpark(e, dt) {
  e.vy = Math.min(MAX_FALL, e.vy + 1400 * dt);
  moveBody(e, dt);
  if (e.onGround) e.vy = -190;
  if (e.hitWall || e.t > 2 || !onScreen(e)) { e.gone = true; fx.push({ kind: "puff", x: e.x + 3, y: e.y + 3, t: 0.25 }); }
  for (const o of entities) {
    if (e.gone) break;
    if (isFoe(o) && !o.dying && o.awake && overlap(e, o)) {
      flipFoe(o, 200);
      addScore(200);
      popup(o.x, o.y, "200");
      e.gone = true;
    } else if (o.kind === "boss" && o.active && !o.defeated && overlap(e, o)) {
      e.gone = true;
      if (o.hurt <= 0) hitBoss(o, 0.5);
    }
  }
}

function updateRock(e, dt) {
  e.vy = Math.min(MAX_FALL, e.vy + 900 * dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.fire && e.y + e.h >= e.floor && e.vy > 0) { e.y = e.floor - e.h; e.vy = -260; e.bounces = (e.bounces || 0) + 1; }
  if (e.y > ROWS * TILE + 16 || e.t > 4 || (e.bounces || 0) > 3) e.gone = true;
  if (game.state === "play" && overlap(e, player)) hurtPlayer();
}

// ---------- 10. Grumbo the Rock Beetle King ----------
function updateBoss(b, dt) {
  if (b.defeated) {
    b.vy += GRAVITY * dt;
    b.y += b.vy * dt;
    if (b.y > ROWS * TILE + 60) b.gone = true;
    return;
  }
  if (!b.active) {
    if (player.x > b.minX) { b.active = true; sfx.bossRoar(); setMusic("boss"); }
    return;
  }
  b.hurt = Math.max(0, b.hurt - dt);
  const speed = 45 + b.power * 10 + (b.maxHp - b.hp) * 8;
  if (b.onGround && Math.random() < dt * 0.6) b.dir = player.x < b.x ? -1 : 1;
  b.vx = b.dir * speed;
  b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
  moveBody(b, dt);
  if (b.x < b.minX) { b.x = b.minX; b.dir = 1; }
  if (b.x + b.w > b.maxX) { b.x = b.maxX - b.w; b.dir = -1; }
  if (b.hitWall) b.dir = -b.dir;

  // from world 2 on, Grumbo jumps. From world 3 on, he throws rocks. In world 5, fireballs!
  if (b.power >= 1 && b.onGround) {
    b.jumpTimer -= dt;
    if (b.jumpTimer <= 0) { b.vy = -380; b.jumpTimer = 1.6 + Math.random() * 1.4; }
  }
  if (b.power >= 2) {
    b.throwTimer -= dt;
    if (b.throwTimer <= 0) {
      const fire = b.power >= 4;
      const dx = player.x - b.x;
      entities.push({ kind: "rock", fire, x: b.x + b.w / 2 - 5, y: b.y - 4, w: 10, h: 10,
        vx: clamp(dx * 0.9, -170, 170), vy: fire ? -200 : -330, floor: 12 * TILE, t: 0, awake: true });
      b.throwTimer = 2.4 - b.power * 0.25 + Math.random();
      sfx.throwRock();
    }
  }

  if (game.state === "play" && overlap(b, player)) {
    const p = player;
    const stomp = p.vy > 0 && p.y + p.h - p.vy * STEP <= b.y + 10;
    if (stomp) {
      if (b.hurt <= 0) hitBoss(b, 1);
      p.vy = -JUMP;
      p.y = b.y - p.h - 1;
    } else if (b.hurt <= 0) {
      hurtPlayer();
    }
  }
}

function hitBoss(b, hurtTime) {
  b.hp--;
  b.hurt = hurtTime;
  sfx.bossHit();
  addScore(500);
  if (b.hp <= 0) {
    b.defeated = true;
    b.vy = -300;
    addScore(5000);
    popup(b.x + 15, b.y, "5000");
    // open the gate
    for (let ty = 0; ty < ROWS; ty++) {
      if (tileAt(level.gateX, ty) === GATE) {
        setTile(level.gateX, ty, AIR);
        fx.push({ kind: "puff", x: level.gateX * TILE + 8, y: ty * TILE + 8, t: 0.5 });
      }
    }
    sfx.bossDown();
    setMusic(level.themeName);
    toast("Grumbo ran away! The gate is open!");
  }
}

// ---------- 11. starting, dying and winning ----------
function startLevel(n) {
  ensureAudio();
  game.n = n;
  level = buildLevel(n);
  if (game.checkpointLevel !== n) game.checkpointLevel = -1;
  entities = level.spawns.map(makeEntity);
  fx = [];
  bumps = new Map();
  const at = game.checkpointLevel === n ? level.checkpoint : level.start;
  player = makePlayer(at.x, at.y);
  cam.x = clamp(player.x - viewW * 0.42, 0, Math.max(0, level.w * TILE - viewW));
  keys.jumpBuffer = 0;
  keys.throwPressed = false;
  game.state = "play";
  game.goalTimer = 0;
  game.walking = false;
  game.levelCoins = 0;
  showScreen(null);
  setMusic(level.themeName);
  toast(`${level.label}  ${level.name}`);
}

function startGoal() {
  if (game.state !== "play") return;
  game.state = "goal";
  game.goalTimer = 0;
  game.walking = false;
  const height = clamp((level.bell.bottom - player.y) / (level.bell.bottom - level.bell.top), 0, 1);
  const bonus = [100, 400, 800, 2000, 5000][Math.min(4, Math.floor(height * 5))];
  addScore(bonus);
  popup(level.bell.x + 8, player.y, String(bonus));
  player.x = level.bell.x - player.w + 4;
  player.vx = 0;
  player.vy = 0;
  game.bellSwing = 1;
  stopMusic();
  sfx.bell();
}

function updateGoal(dt) {
  const p = player;
  game.goalTimer += dt;
  game.bellSwing = Math.max(0, game.bellSwing - dt * 0.4);
  if (game.goalTimer < 0.4) return;
  // slide down the pole, then walk to the little bell house
  if (!game.walking && p.y + p.h < level.bell.bottom) {
    p.y = Math.min(level.bell.bottom - p.h, p.y + 150 * dt);
    return;
  }
  if (!game.walking) { game.walking = true; p.x = level.bell.x + 18; p.y = level.house.y - p.h; p.facing = 1; }
  p.vx = 60;
  p.x += p.vx * dt;
  p.anim += dt * 1.2;
  p.onGround = true;
  if (p.x > level.house.x + 22) p.hidden = true;
  if (game.goalTimer > 3.2) finishLevel();
}

function finishLevel() {
  game.walking = false;
  game.big = player.big;
  game.fire = player.fire;
  game.checkpointLevel = -1;
  const n = game.n;
  if (!save.done.includes(n)) save.done.push(n);
  save.unlocked = Math.max(save.unlocked, Math.min(19, n + 1));
  writeSave();
  if (n === 19) {
    game.state = "end";
    $("end-text").innerHTML = `Pip rang all <b>20 Sun Bells</b> and the sun is shining again!<br>Final score: <b>${game.score}</b>. You collected <b>${game.coins}</b> coins.`;
    showScreen("end-screen");
    sfx.win();
    return;
  }
  game.state = "clear";
  $("clear-title").innerHTML = `${level.label} <span>CLEAR!</span>`;
  $("clear-text").innerHTML = `You rang the bell in <b>${level.name}</b>!<br>Coins this level: <b>${game.levelCoins}</b> · Score: <b>${game.score}</b>` +
    (n % 4 === 3 ? `<br>Next up: <b>${WORLDS[Math.floor(n / 4) + 1].name}</b>!` : "");
  showScreen("clear-screen");
}

function updateDying(dt) {
  const p = player;
  game.deathTimer += dt;
  if (game.deathTimer > 0.5) {
    p.vy += GRAVITY * 0.7 * dt;
    p.y += p.vy * dt;
  }
  if (game.deathTimer > 2.2) {
    game.lives--;
    if (game.lives <= 0) {
      game.state = "over";
      game.checkpointLevel = -1;
      showScreen("over-screen");
    } else {
      startLevel(game.n);
    }
  }
}

// ---------- 12. the camera and drawing everything ----------
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
let scale = 3, viewW = 400, offsetY = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  scale = canvas.height / (ROWS * TILE);
  viewW = canvas.width / scale;
  offsetY = 0;
  if (viewW < 260) {   // a tall, thin phone screen: show 260 pixels across and put the world in the middle
    scale = canvas.width / 260;
    viewW = 260;
    offsetY = (canvas.height / scale - ROWS * TILE) / 2;
  }
}
window.addEventListener("resize", resize);
resize();

// a tiny helper for random-looking-but-always-the-same numbers, used for the scenery
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function ell(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); }
function circ(x, y, rad) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, rad), 0, Math.PI * 2); ctx.fill(); }
function tri(ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
function rect(x, y, w, h) { ctx.fillRect(x, y, w, h); }

// repeat a bit of scenery across the screen. "depth" makes far things move slower (that's parallax).
function repeat(depth, spacing, draw) {
  const off = cam.x * depth;
  const first = Math.floor(off / spacing) - 1;
  for (let i = first; i * spacing - off < viewW + spacing; i++) draw(i * spacing - off, i);
}

function drawBackground() {
  const T = level.theme;
  const H = ROWS * TILE;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, T.sky[0]);
  grad.addColorStop(1, T.sky[1]);
  ctx.fillStyle = grad;
  rect(0, -offsetY, viewW, H + offsetY * 2);

  switch (level.themeName) {
    case "meadow":
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      repeat(0.1, 150, (x, i) => cloudShape(x + hash(i) * 60, 25 + hash(i + 3) * 50, 1));
      ctx.fillStyle = T.far;
      repeat(0.25, 170, (x, i) => ell(x, H - 40, 70 + hash(i) * 30, 70 + hash(i + 1) * 40));
      ctx.fillStyle = T.near;
      repeat(0.5, 120, (x, i) => ell(x + hash(i) * 40, H - 30, 40 + hash(i + 5) * 20, 34 + hash(i + 2) * 20));
      break;
    case "caves":
      ctx.fillStyle = "rgba(170,130,255,0.18)";
      repeat(0.2, 110, (x, i) => {
        const h = 50 + hash(i) * 70;
        tri(x - 14, H, x, H - h, x + 14, H);
        tri(x + 10, H, x + 22, H - h * 0.6, x + 34, H);
      });
      ctx.fillStyle = T.near;
      repeat(0.45, 46, (x, i) => tri(x, 0, x + 10, 22 + hash(i) * 40, x + 20, 0));
      ctx.fillStyle = "rgba(200,170,255,0.7)";
      repeat(0.3, 37, (x, i) => circ(x, 40 + hash(i) * 150, 1.2 + Math.sin(time * 2 + i) * 0.6));
      break;
    case "sky":
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      repeat(0.12, 130, (x, i) => cloudShape(x, 30 + hash(i) * 120, 1.4));
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      repeat(0.3, 160, (x, i) => cloudShape(x + 40, 60 + hash(i + 9) * 130, 1));
      break;
    case "desert":
      ctx.fillStyle = "#fff4c2";
      circ(viewW * 0.75, 50, 26);
      ctx.fillStyle = T.far;
      repeat(0.2, 200, (x, i) => { if (hash(i) > 0.5) tri(x, H - 50, x + 50, H - 110, x + 100, H - 50); });
      duneLayer(0.2, H - 60, T.far, 30);
      duneLayer(0.45, H - 35, T.near, 22);
      break;
    case "volcano":
      repeat(0.15, 260, (x, i) => {
        const top = H - 150 - hash(i) * 30;
        ctx.fillStyle = T.far;
        tri(x - 120, H, x, top, x + 120, H);
        ctx.fillStyle = "#ff6a1a";
        tri(x - 12, top + 12, x, top, x + 12, top + 12);
      });
      ctx.fillStyle = T.near;
      repeat(0.4, 90, (x, i) => tri(x - 50, H, x, H - 50 - hash(i) * 40, x + 50, H));
      ctx.fillStyle = "rgba(255,170,60,0.8)";
      for (let k = 0; k < 24; k++) {
        const ex = hash(k) * viewW + time * 8 * (hash(k + 50) - 0.5);
        const ey = H - ((time * (20 + hash(k + 7) * 30) + hash(k + 3) * H) % H);
        rect(((ex % viewW) + viewW) % viewW, ey, 2, 2);
      }
      break;
    case "castle":
      ctx.fillStyle = T.near;
      repeat(0.5, 32, x => {
        for (let row = 0; row < 15; row++) rect(x + (row % 2) * 16, row * 16, 30, 14);
      });
      repeat(0.5, 160, (x, i) => {
        ctx.fillStyle = "#0d1120";
        rect(x + 40, 60, 20, 34);
        ell(x + 50, 60, 10, 10);
        ctx.fillStyle = "#4b3a2a";
        rect(x + 108, 110, 4, 10);
        ctx.fillStyle = "#ff8a2a";
        tri(x + 105, 111, x + 110, 100 + Math.sin(time * 9 + i) * 2, x + 115, 111);
        ctx.fillStyle = "#ffd66b";
        circ(x + 110, 108, 2 + Math.sin(time * 12 + i) * 0.8);
      });
      break;
  }
}

function cloudShape(x, y, s) {
  ell(x, y, 22 * s, 10 * s);
  ell(x - 12 * s, y + 2 * s, 12 * s, 8 * s);
  ell(x + 6 * s, y - 7 * s, 13 * s, 10 * s);
  ell(x + 18 * s, y + 2 * s, 12 * s, 8 * s);
}

function duneLayer(depth, y, color, amp) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, ROWS * TILE);
  for (let sx = 0; sx <= viewW + 8; sx += 8) {
    const wx = sx + cam.x * depth;
    ctx.lineTo(sx, y - Math.sin(wx / 70) * amp * 0.5 - Math.sin(wx / 31) * amp * 0.2);
  }
  ctx.lineTo(viewW + 8, ROWS * TILE);
  ctx.fill();
}

function drawTiles() {
  const T = level.theme;
  const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + viewW) / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = 0; ty < ROWS; ty++) {
      const t = tileAt(tx, ty);
      if (t === AIR) continue;
      let y = ty * TILE;
      const b = bumps.get(ty * level.stride + tx);
      if (b) y -= Math.sin((b / 0.15) * Math.PI) * 5;
      drawTile(t, tx, ty, tx * TILE, y, T);
    }
  }
}

function drawTile(t, tx, ty, x, y, T) {
  const castle = level.themeName === "castle";
  switch (t) {
    case GROUND: {
      ctx.fillStyle = T.dirt;
      rect(x, y, 16, 16);
      if (castle || level.themeName === "volcano") {
        ctx.fillStyle = T.dirtDark;
        rect(x, y + 7, 16, 1);
        rect(x, y + 15, 16, 1);
        rect(x + (ty % 2 ? 4 : 11), y, 1, 7);
        rect(x + (ty % 2 ? 11 : 4), y + 8, 1, 7);
      } else {
        const h = (tx * 7 + ty * 13) % 5;
        ctx.fillStyle = T.dirtDark;
        rect(x + 2 + h * 2, y + 5 + (h % 3) * 3, 3, 2);
        rect(x + 11 - h, y + 11, 2, 2);
      }
      if (ty > 0 && tileAt(tx, ty - 1) !== GROUND && !castle) {
        ctx.fillStyle = T.topDark;
        rect(x, y + 4, 16, 2);
        ctx.fillStyle = T.top;
        rect(x, y, 16, 5);
        if (level.themeName === "meadow") {
          rect(x + 2, y - 2, 1, 2);
          rect(x + 9, y - 2, 1, 2);
          rect(x + 13, y - 1, 1, 1);
        } else if (level.themeName === "caves" && (tx * 5) % 7 === 0 && tileAt(tx, ty - 1) === AIR) {
          ctx.fillStyle = "#c9a6ff";
          tri(x + 5, y, x + 8, y - 7, x + 11, y);
        }
      }
      break;
    }
    case BRICK:
      ctx.fillStyle = T.brick;
      rect(x, y, 16, 16);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      rect(x, y + 7, 16, 1);
      rect(x, y + 15, 16, 1);
      rect(x + 7, y, 1, 7);
      rect(x + 3, y + 8, 1, 7);
      rect(x + 12, y + 8, 1, 7);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      rect(x, y, 16, 1);
      break;
    case BOX_COIN: case BOX_POWER: case BOX_LIFE: {
      ctx.fillStyle = "#b9791a";
      rect(x, y, 16, 16);
      ctx.fillStyle = "#f5b82e";
      rect(x + 1, y + 1, 14, 14);
      ctx.fillStyle = "#ffd970";
      rect(x + 1, y + 1, 14, 2);
      ctx.fillStyle = "#b9791a";
      rect(x + 2, y + 2, 1, 1); rect(x + 13, y + 2, 1, 1); rect(x + 2, y + 13, 1, 1); rect(x + 13, y + 13, 1, 1);
      // a sparkling gem in the middle
      const glow = 0.5 + Math.sin(time * 5) * 0.5;
      ctx.fillStyle = `rgb(${Math.round(120 + glow * 135)},${Math.round(230 + glow * 25)},255)`;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 3); ctx.lineTo(x + 12, y + 8); ctx.lineTo(x + 8, y + 13); ctx.lineTo(x + 4, y + 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      rect(x + 7, y + 6, 2, 2);
      break;
    }
    case BOX_USED:
      ctx.fillStyle = "#6e5232";
      rect(x, y, 16, 16);
      ctx.fillStyle = "#9c7a54";
      rect(x + 1, y + 1, 14, 14);
      ctx.fillStyle = "#6e5232";
      rect(x + 3, y + 3, 2, 2); rect(x + 11, y + 3, 2, 2); rect(x + 3, y + 11, 2, 2); rect(x + 11, y + 11, 2, 2);
      break;
    case BLOCK:
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      rect(x, y, 16, 16);
      ctx.fillStyle = T.block;
      rect(x, y, 15, 15);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      rect(x, y, 15, 2);
      rect(x, y, 2, 15);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      rect(x + 4, y + 4, 7, 7);
      break;
    case CLOUD:
      ctx.fillStyle = "#dbe7fb";
      ell(x + 8, y + 7, 9, 6);
      ctx.fillStyle = "#fff";
      ell(x + 8, y + 5, 9, 5);
      circ(x + 4, y + 3, 4);
      circ(x + 11, y + 2, 5);
      break;
    case SPIKES:
      ctx.fillStyle = "#4a4f60";
      rect(x, y + 12, 16, 4);
      ctx.fillStyle = "#d8dde6";
      tri(x, y + 12, x + 2.7, y + 2, x + 5.3, y + 12);
      tri(x + 5.3, y + 12, x + 8, y + 2, x + 10.7, y + 12);
      tri(x + 10.7, y + 12, x + 13.3, y + 2, x + 16, y + 12);
      ctx.fillStyle = "#fff";
      rect(x + 2, y + 5, 1, 3); rect(x + 7, y + 5, 1, 3); rect(x + 12, y + 5, 1, 3);
      break;
    case LAVA: {
      ctx.fillStyle = "#d8361a";
      rect(x, y, 16, 16);
      if (tileAt(tx, ty - 1) !== LAVA) {
        ctx.fillStyle = "#ff8a1a";
        const wave = Math.sin(time * 3 + tx) * 2;
        rect(x, y + 2 + wave, 16, 6);
        ctx.fillStyle = "#ffd23f";
        rect(x + ((tx * 5 + Math.floor(time * 4)) % 12), y + 3 + wave, 3, 2);
      }
      break;
    }
    case GATE:
      ctx.fillStyle = "rgba(20,24,36,0.6)";
      rect(x, y, 16, 16);
      ctx.fillStyle = "#9aa3b8";
      rect(x + 2, y, 3, 16);
      rect(x + 7, y, 3, 16);
      rect(x + 12, y, 3, 16);
      rect(x, y + 6, 16, 2);
      break;
    case SPRING: {
      const squish = bumps.get(level.stride * ROWS + tx) ? 5 : 0;
      ctx.fillStyle = "#555b6e";
      rect(x + 1, y + 13, 14, 3);
      ctx.strokeStyle = "#ff4d5e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 13);
      for (let k = 0; k < 4; k++) ctx.lineTo(k % 2 ? x + 4 : x + 12, y + 13 - ((k + 1) * (9 - squish)) / 4);
      ctx.stroke();
      ctx.fillStyle = "#ffd23f";
      rect(x, y + 1 + squish, 16, 3);
      break;
    }
    case PILLAR: case PILLAR_TOP:
      drawPillar(t === PILLAR_TOP, x, y, T);
      break;
    case COIN: {
      const spin = Math.abs(Math.cos(time * 4 + tx * 0.7));
      ctx.fillStyle = "#c98a0c";
      ell(x + 8, y + 8, 1 + spin * 5, 6.5);
      ctx.fillStyle = "#ffd23f";
      ell(x + 8, y + 8, 0.5 + spin * 4, 5.5);
      ctx.fillStyle = "#fff3a6";
      rect(x + 8 - spin * 2, y + 4, Math.max(1, spin * 1.5), 6);
      break;
    }
  }
}

function drawPillar(top, x, y, T) {
  switch (T.pillar) {
    case "log":
      ctx.fillStyle = "#8b5a2b";
      rect(x, y, 16, 16);
      ctx.fillStyle = "#6e4420";
      rect(x + 3, y, 2, 16);
      rect(x + 10, y, 1, 16);
      if (top) {
        ctx.fillStyle = "#e0b47a";
        rect(x, y, 16, 5);
        ctx.fillStyle = "#b9874d";
        rect(x + 3, y + 1, 10, 1);
        rect(x + 5, y + 3, 6, 1);
      }
      break;
    case "crystal":
      ctx.fillStyle = "#7c4fd6";
      rect(x, y, 16, 16);
      ctx.fillStyle = "#b78bff";
      rect(x + 2, y, 4, 16);
      ctx.fillStyle = "#e3d1ff";
      rect(x + 3, y + 2, 1, 10);
      if (top) { ctx.fillStyle = "#d9c2ff"; rect(x, y, 16, 3); }
      break;
    case "cloud":
      ctx.fillStyle = "#cfdcf5";
      rect(x, y, 16, 16);
      ctx.fillStyle = "#fff";
      rect(x + 2, y, 8, 16);
      if (top) { circ(x + 4, y + 3, 5); circ(x + 12, y + 3, 5); }
      break;
    case "cactus":
      ctx.fillStyle = "#3da34a";
      rect(x, y + (top ? 3 : 0), 16, top ? 13 : 16);
      if (top) ell(x + 8, y + 4, 8, 4);
      ctx.fillStyle = "#2c7e37";
      rect(x + 4, y + 3, 1, 13);
      rect(x + 11, y + 3, 1, 13);
      ctx.fillStyle = "#fff6c9";
      rect(x + 1, y + 8, 1, 1); rect(x + 14, y + 11, 1, 1);
      break;
    default:
      ctx.fillStyle = T.block;
      rect(x + 1, y, 14, 16);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      rect(x + 10, y, 3, 16);
      if (top) { ctx.fillStyle = T.top; rect(x, y, 16, 4); }
  }
}

// Pip the fox. Drawn facing right in a little 28-pixel-tall box, then flipped and shrunk as needed.
function drawPip(p) {
  if (p.hidden) return;
  if (p.invuln > 0 && Math.floor(time * 16) % 2) return;
  const s = p.big ? 1 : 0.55;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h);
  if (p.dead) { ctx.translate(0, -p.h / 2); ctx.rotate(Math.PI); ctx.translate(0, -p.h / 2); }
  ctx.scale(p.facing * s, s);
  const moving = Math.abs(p.vx) > 5 && p.onGround;
  const step = moving ? Math.sin(p.anim * 14) : 0;
  const air = !p.onGround && !p.dead;
  const flash = p.growFlash > 0 && Math.floor(time * 20) % 2;
  const fur = flash ? "#ffd27a" : "#ff8a2a", furDark = "#d9661a", cream = "#fff3e0", ink = "#2a1b12";
  // tail
  ctx.fillStyle = furDark;
  ell(-9, -11 + (air ? -2 : 0), 7, 3.5, -0.5 + step * 0.25);
  ctx.fillStyle = cream;
  ell(-15, -14.5 + (air ? -2 : 0), 2.5, 2, -0.5);
  // legs
  ctx.fillStyle = ink;
  if (air) { rect(-5, -6, 4, 4); rect(2, -7, 4, 4); }
  else { rect(-5 + step * 2.5, -5, 4, 5); rect(2 - step * 2.5, -5, 4, 5); }
  // body and belly
  ctx.fillStyle = fur;
  ell(0, -10, 7, 7);
  ctx.fillStyle = cream;
  ell(2.5, -9, 4, 5);
  // scarf: blue normally, flashing fire colours with spark power
  ctx.fillStyle = p.fire ? (Math.floor(time * 8) % 2 ? "#ffe14d" : "#ff4d2e") : "#2f7bff";
  rect(-6, -17, 13, 3);
  rect(-10, -17 + Math.sin(time * 10) * 1.2, 5, 2);
  // head and ears
  ctx.fillStyle = fur;
  circ(2, -22, 7);
  tri(-4, -25, -2, -33, 3, -27);
  tri(2, -27, 7, -33, 9, -24);
  ctx.fillStyle = ink;
  tri(-2.5, -26, -1.5, -31, 1.5, -27);
  tri(4, -27, 6.5, -31, 7.5, -25.5);
  // face
  ctx.fillStyle = cream;
  ell(6.5, -19.5, 4.5, 3);
  ctx.fillStyle = ink;
  circ(10.5, -20.5, 1.7);
  if (p.dead) { rect(3, -25, 3, 1); rect(4, -26, 1, 3); }
  else { ell(5, -24, 1.4, 2); ctx.fillStyle = "#fff"; rect(5, -25, 1, 1); }
  ctx.restore();
}

function drawFoe(e) {
  const x = e.x, y = e.y, cx = x + e.w / 2;
  const ink = "#1d1426";
  ctx.save();
  if (e.dying) {   // upside down
    ctx.translate(cx, y + e.h / 2);
    ctx.scale(1, -1);
    ctx.translate(-cx, -(y + e.h / 2));
  }
  const walk = Math.sin(e.t * 12);
  const face = e.dir;
  switch (e.kind) {
    case "beetle":
      if (e.squash > 0) { ctx.fillStyle = "#6b3fa0"; ell(cx, y + e.h - 2, 8, 3); break; }
      ctx.fillStyle = ink;
      rect(x + 2 + walk, y + 9, 3, 3);
      rect(x + 9 - walk, y + 9, 3, 3);
      ctx.fillStyle = "#6b3fa0";
      ctx.beginPath(); ctx.ellipse(cx, y + 10, 7.5, 9, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#a173e0";
      ell(cx - 2, y + 4, 2.5, 1.5, -0.4);
      eyes(cx + face * 3, y + 7, face, true);
      break;
    case "snail":
      ctx.fillStyle = "#8fd14f";
      rect(x, y + 10, e.w, 4);
      rect(x + (face > 0 ? e.w - 4 : 0), y + 4, 4, 8);
      rect(x + (face > 0 ? e.w - 3 : 1), y, 1, 5);
      rect(x + (face > 0 ? e.w - 1 : 3), y + 1, 1, 4);
      ctx.fillStyle = ink;
      rect(x + (face > 0 ? e.w - 3 : 1), y, 2, 2);
      drawShell(cx - face * 2, y + 7, 6, 0);
      break;
    case "shell":
      drawShell(cx, y + 5, 6, e.moving ? e.t * 15 * e.dir : 0);
      break;
    case "spiky":
      ctx.fillStyle = ink;
      rect(x + 2 + walk, y + 10, 3, 2);
      rect(x + 9 - walk, y + 10, 3, 2);
      ctx.fillStyle = "#e6e9f0";
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + (k + 0.5) * (Math.PI / 5);
        const sx = cx + Math.cos(a) * 6, sy = y + 7 + Math.sin(a) * 6;
        tri(sx - 2, sy + 1, cx + Math.cos(a) * 11, y + 7 + Math.sin(a) * 11, sx + 2, sy + 1);
      }
      ctx.fillStyle = "#c0392b";
      circ(cx, y + 7, 6.5);
      eyes(cx + face * 2.5, y + 6, face, true);
      break;
    case "bat": {
      const flap = Math.sin(e.t * 18) * 4;
      ctx.fillStyle = "#3e2a66";
      tri(cx - 2, y + 4, cx - 11, y + 1 + flap, cx - 6, y + 8);
      tri(cx + 2, y + 4, cx + 11, y + 1 + flap, cx + 6, y + 8);
      ctx.fillStyle = "#5b3b8c";
      circ(cx, y + 5, 5);
      tri(cx - 4, y + 2, cx - 3, y - 3, cx - 1, y + 1);
      tri(cx + 4, y + 2, cx + 3, y - 3, cx + 1, y + 1);
      ctx.fillStyle = "#ffe36b";
      rect(cx - 3, y + 4, 2, 2); rect(cx + 1, y + 4, 2, 2);
      break;
    }
    case "hopper": {
      if (e.squash > 0) { ctx.fillStyle = "#3fbf5f"; ell(cx, y + e.h - 2, 8, 3); break; }
      const up = !e.onGround;
      ctx.fillStyle = "#2f9a4a";
      if (up) { rect(x + 1, y + 10, 3, 5); rect(x + 10, y + 10, 3, 5); }
      else { ell(x + 3, y + 10, 4, 2); ell(x + 11, y + 10, 4, 2); }
      ctx.fillStyle = "#3fbf5f";
      ell(cx, y + 7, 7, up ? 6 : 5);
      ctx.fillStyle = "#fff";
      circ(cx - 3, y + 2, 3); circ(cx + 3, y + 2, 3);
      ctx.fillStyle = ink;
      circ(cx - 3 + face, y + 2, 1.4); circ(cx + 3 + face, y + 2, 1.4);
      ctx.fillStyle = "#ff8fa8";
      rect(cx - 2, y + 8, 4, 1);
      break;
    }
  }
  ctx.restore();
}

function eyes(x, y, face, angry) {
  ctx.fillStyle = "#fff";
  ell(x - 1.8, y, 1.6, 2.2);
  ell(x + 1.8, y, 1.6, 2.2);
  ctx.fillStyle = "#1d1426";
  rect(x - 2 + face * 0.6, y - 0.5, 1.2, 2);
  rect(x + 1.4 + face * 0.6, y - 0.5, 1.2, 2);
  if (angry) {
    rect(x - 3.4, y - 3, 2.5, 1);
    rect(x + 1, y - 3, 2.5, 1);
  }
}

function drawShell(x, y, rad, spin) {
  ctx.fillStyle = "#ff7aa2";
  circ(x, y, rad);
  ctx.strokeStyle = "#b8406a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let a = 0; a < 9; a += 0.4) {
    const rr = rad * (1 - a / 10);
    const px = x + Math.cos(a + spin) * rr, py = y + Math.sin(a + spin) * rr;
    if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawBoss(b) {
  if (b.hurt > 0 && Math.floor(time * 18) % 2) return;
  const cx = b.x + b.w / 2, y = b.y;
  ctx.save();
  if (b.defeated) { ctx.translate(cx, y + b.h / 2); ctx.rotate(Math.PI); ctx.translate(-cx, -(y + b.h / 2)); }
  const walk = Math.sin(b.t * 10) * 2;
  ctx.fillStyle = "#1d1426";
  rect(b.x + 3 + walk, y + 21, 6, 5);
  rect(b.x + 12 - walk, y + 21, 6, 5);
  rect(b.x + 21 + walk, y + 21, 6, 5);
  ctx.fillStyle = "#8e1f2f";
  ctx.beginPath(); ctx.ellipse(cx, y + 23, 16, 21, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#c9384e";
  ell(cx - 5, y + 9, 5, 3, -0.5);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  rect(cx - 1, y + 4, 2, 19);
  // crown
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(cx - 8, y + 2); ctx.lineTo(cx - 8, y - 6); ctx.lineTo(cx - 4, y - 2); ctx.lineTo(cx, y - 8);
  ctx.lineTo(cx + 4, y - 2); ctx.lineTo(cx + 8, y - 6); ctx.lineTo(cx + 8, y + 2);
  ctx.fill();
  ctx.fillStyle = "#4fd1ff";
  rect(cx - 1, y - 3, 2, 2);
  // big angry eyes that watch Pip
  const look = player.x < b.x ? -1 : 1;
  ctx.fillStyle = "#fff";
  ell(cx - 6 + look * 2, y + 14, 3.5, 4);
  ell(cx + 6 + look * 2, y + 14, 3.5, 4);
  ctx.fillStyle = "#1d1426";
  circ(cx - 6 + look * 3, y + 15, 1.8);
  circ(cx + 6 + look * 3, y + 15, 1.8);
  rect(cx - 10 + look * 2, y + 9, 7, 2);
  rect(cx + 3 + look * 2, y + 9, 7, 2);
  ctx.restore();
}

function drawEntity(e) {
  if (!e.awake && e.kind !== "checkpoint") return;
  switch (e.kind) {
    case "platform":
      if (e.cloud) {
        ctx.fillStyle = "#fff";
        ell(e.x + 24, e.y + 4, 25, 6);
        circ(e.x + 12, e.y + 1, 6); circ(e.x + 30, e.y, 7);
      } else {
        ctx.fillStyle = "#7a4a22";
        rect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = "#b07a45";
        rect(e.x, e.y, e.w, 3);
        ctx.fillStyle = "#4a2a10";
        rect(e.x + 3, e.y + 4, 2, 2); rect(e.x + e.w - 5, e.y + 4, 2, 2);
      }
      break;
    case "firebar":
      ctx.fillStyle = "rgba(255,120,30,0.35)";
      for (let i = 1; i <= e.len; i++) circ(e.cx + Math.cos(e.angle) * i * 8, e.cy + Math.sin(e.angle) * i * 8, 5);
      for (let i = 1; i <= e.len; i++) {
        const bx = e.cx + Math.cos(e.angle) * i * 8, by = e.cy + Math.sin(e.angle) * i * 8;
        ctx.fillStyle = "#ff7a1a"; circ(bx, by, 3.5);
        ctx.fillStyle = "#ffe36b"; circ(bx, by, 1.8);
      }
      break;
    case "checkpoint": {
      ctx.fillStyle = "#e6e9f0";
      rect(e.x + 3, e.y, 2, e.h);
      ctx.fillStyle = e.reached ? "#3fd36a" : "#9aa3b8";
      const wave = Math.sin(time * 6) * 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x + 5, e.y + 1);
      ctx.lineTo(e.x + 18, e.y + 5 + wave);
      ctx.lineTo(e.x + 5, e.y + 11);
      ctx.fill();
      ctx.fillStyle = "#ffd23f";
      circ(e.x + 4, e.y, 2.5);
      break;
    }
    case "acorn":
      ctx.fillStyle = "#c98f4f"; ell(e.x + 7, e.y + 9, 6, 5.5);
      ctx.fillStyle = "#6e4420"; ell(e.x + 7, e.y + 4.5, 7, 3.5); rect(e.x + 6, e.y, 2, 3);
      ctx.fillStyle = "#2a1b12"; rect(e.x + 4, e.y + 8, 1.5, 2); rect(e.x + 8.5, e.y + 8, 1.5, 2);
      break;
    case "leaf":
      ctx.fillStyle = "#3fd36a"; ell(e.x + 7, e.y + 7, 7, 4.5, -0.6);
      ctx.fillStyle = "#b6ffc6"; rect(e.x + 2, e.y + 9, 10, 1);
      ctx.fillStyle = "#fff"; ctx.font = "bold 6px sans-serif"; ctx.fillText("1UP", e.x + 1, e.y - 1);
      break;
    case "flower": {
      const fx2 = e.x + 7, fy = e.y + 6;
      ctx.fillStyle = "#2f9a4a"; rect(fx2 - 1, fy + 3, 2, 6);
      ctx.fillStyle = Math.floor(time * 6) % 2 ? "#ff4d2e" : "#ff8a1a";
      for (let k = 0; k < 5; k++) circ(fx2 + Math.cos(k * 1.256 + time) * 4, fy + Math.sin(k * 1.256 + time) * 4, 3);
      ctx.fillStyle = "#ffe36b"; circ(fx2, fy, 2.5);
      break;
    }
    case "spark":
      ctx.fillStyle = "rgba(255,200,60,0.4)"; circ(e.x + 3, e.y + 3, 5);
      ctx.fillStyle = "#ffe36b"; circ(e.x + 3, e.y + 3, 3);
      ctx.fillStyle = "#fff"; circ(e.x + 3, e.y + 3, 1.3);
      break;
    case "rock":
      if (e.fire) {
        ctx.fillStyle = "rgba(255,120,30,0.4)"; circ(e.x + 5, e.y + 5, 8);
        ctx.fillStyle = "#ff7a1a"; circ(e.x + 5, e.y + 5, 5);
        ctx.fillStyle = "#ffe36b"; circ(e.x + 5, e.y + 5, 2.5);
      } else {
        ctx.fillStyle = "#7d7f8c"; circ(e.x + 5, e.y + 5, 5);
        ctx.fillStyle = "#5a5c68"; circ(e.x + 3, e.y + 6, 1.5); circ(e.x + 7, e.y + 3, 1);
      }
      break;
    case "boss": drawBoss(e); break;
    default: drawFoe(e);
  }
}

function drawBellAndHouse() {
  const b = level.bell;
  // the little bell house where the bell belongs
  const hx = level.house.x, hy = level.house.y;
  ctx.fillStyle = "#e9d7b8";
  rect(hx, hy - 40, 56, 40);
  ctx.fillStyle = "#c8603a";
  tri(hx - 6, hy - 40, hx + 28, hy - 64, hx + 62, hy - 40);
  ctx.fillStyle = "#5a3a20";
  rect(hx + 20, hy - 22, 16, 22);
  ell(hx + 28, hy - 22, 8, 6);
  ctx.fillStyle = "#7fc8ff";
  rect(hx + 6, hy - 32, 9, 9);
  rect(hx + 41, hy - 32, 9, 9);
  ctx.fillStyle = "#ffd23f";
  circ(hx + 28, hy - 50, 4);
  // pole
  ctx.fillStyle = "#e6e9f0";
  rect(b.x + 7, b.top, 2, b.bottom - b.top);
  // the bell (it swings when you ring it)
  ctx.save();
  ctx.translate(b.x + 8, b.top);
  ctx.rotate(Math.sin(time * 14) * 0.5 * game.bellSwing);
  ctx.fillStyle = "#c98a0c";
  ctx.beginPath();
  ctx.moveTo(-7, 12); ctx.quadraticCurveTo(-7, 0, 0, 0); ctx.quadraticCurveTo(7, 0, 7, 12); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(-5.5, 11); ctx.quadraticCurveTo(-5.5, 1.5, 0, 1.5); ctx.quadraticCurveTo(3, 1.5, 4, 8); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a5a00";
  circ(0, 13, 2);
  ctx.restore();
}

function drawFx() {
  for (const f of fx) {
    switch (f.kind) {
      case "shard": ctx.fillStyle = f.color; rect(f.x, f.y, 6, 6); break;
      case "coinpop": ctx.fillStyle = "#ffd23f"; ell(f.x, f.y, 1 + Math.abs(Math.cos(f.t * 20)) * 4, 6); break;
      case "puff": ctx.fillStyle = `rgba(255,255,255,${Math.min(1, f.t * 2)})`; circ(f.x, f.y, 8 - f.t * 10); break;
      case "popup":
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText(f.text, f.x + 0.7, f.y + 0.7);
        ctx.fillStyle = "#fff";
        ctx.fillText(f.text, f.x, f.y);
        ctx.textAlign = "left";
        break;
    }
  }
}

function updateFx(dt) {
  for (const f of fx) {
    f.t -= dt;
    if (f.kind === "shard") { f.vy += GRAVITY * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.kind === "coinpop") { f.vy += 900 * dt; f.y += f.vy * dt; }
    if (f.kind === "popup") f.y -= 30 * dt;
  }
  fx = fx.filter(f => f.t > 0);
  for (const [k, v] of bumps) { if (v - dt <= 0) bumps.delete(k); else bumps.set(k, v - dt); }
}

function drawBossBar() {
  const b = entities.find(e => e.kind === "boss" && e.active && !e.defeated);
  if (!b) return;
  const w = 120, x = (viewW - w) / 2, y = ROWS * TILE - 18;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  rect(x - 4, y - 12, w + 8, 22);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GRUMBO", viewW / 2, y - 3);
  ctx.textAlign = "left";
  ctx.fillStyle = "#3a1018";
  rect(x, y, w, 6);
  ctx.fillStyle = "#ff4d5e";
  rect(x, y, w * (b.hp / b.maxHp), 6);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!level) return;
  ctx.setTransform(scale, 0, 0, scale, 0, offsetY * scale);
  drawBackground();
  ctx.save();
  ctx.translate(-Math.round(cam.x * scale) / scale, 0);
  drawBellAndHouse();
  drawTiles();
  for (const e of entities) drawEntity(e);
  drawPip(player);
  drawFx();
  ctx.restore();
  drawBossBar();
}

// ---------- 13. sounds and music, made from scratch with the Web Audio API ----------
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
  jump: () => tone(300, 0.16, "square", 0.06, 620),
  coin: () => { tone(988, 0.07, "square", 0.05); later(70, () => tone(1319, 0.18, "square", 0.05)); },
  stomp: () => tone(220, 0.12, "square", 0.08, 70),
  kick: () => tone(500, 0.08, "triangle", 0.12, 200),
  bump: () => tone(130, 0.08, "triangle", 0.15, 90),
  breakBrick: () => { noise(0.18, 0.18); tone(160, 0.1, "square", 0.05, 60); },
  sprout: () => tone(400, 0.4, "triangle", 0.1, 800),
  powerUp: () => notes([523, 659, 784, 1047, 1319], 60),
  oneUp: () => notes([659, 784, 1319, 1047, 1175, 1568], 80),
  hurt: () => tone(600, 0.35, "square", 0.07, 150),
  die: () => notes([523, 494, 466, 440, 330, 262], 120, "square", 0.06, 0.16),
  spark: () => tone(900, 0.08, "square", 0.04, 1500),
  spring: () => tone(200, 0.3, "triangle", 0.15, 900),
  checkpoint: () => notes([784, 988, 1175], 90, "triangle", 0.12, 0.15),
  bell: () => { tone(880, 1.6, "sine", 0.2); tone(1320, 1.2, "sine", 0.08); later(400, () => tone(1047, 1.4, "sine", 0.15)); },
  bossRoar: () => { tone(110, 0.6, "sawtooth", 0.08, 55); noise(0.4, 0.08); },
  bossHit: () => { tone(300, 0.2, "square", 0.08, 100); noise(0.15, 0.1); },
  bossDown: () => notes([392, 330, 262, 196, 131], 110, "sawtooth", 0.07, 0.25),
  throwRock: () => tone(180, 0.15, "triangle", 0.12, 320),
  win: () => notes([523, 659, 784, 1047, 784, 1047, 1319], 140, "square", 0.06, 0.25),
};

// Background music is made up by the computer! It takes a "scale" of notes that sound nice together
// and wanders up and down it. Each world has its own seed, so each world gets its own song.
const TUNE_SPECS = {
  meadow: { root: 60, scale: [0, 2, 4, 7, 9], step: 0.15, seed: 11, chords: [0, 9, 5, 7] },
  caves: { root: 57, scale: [0, 3, 5, 7, 10], step: 0.19, seed: 22, chords: [0, 8, 5, 7] },
  sky: { root: 65, scale: [0, 2, 4, 7, 9], step: 0.16, seed: 37, chords: [0, 5, 9, 7] },
  desert: { root: 62, scale: [0, 3, 5, 7, 10], step: 0.17, seed: 44, chords: [0, 10, 8, 7] },
  volcano: { root: 52, scale: [0, 3, 5, 6, 7, 10], step: 0.14, seed: 55, chords: [0, 3, 5, 7] },
  castle: { root: 55, scale: [0, 1, 3, 7, 8], step: 0.18, seed: 66, chords: [0, 1, 0, 8] },
  boss: { root: 50, scale: [0, 1, 3, 6, 7], step: 0.12, seed: 77, chords: [0, 1, 6, 1] },
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
  return { melody, step: spec.step, bass: spec.chords.map(c => spec.root - 24 + c) };
}
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
let tune = null, musicTime = 0, musicStep = 0;
function setMusic(name) { tune = makeTune(TUNE_SPECS[name]); musicStep = 0; if (audio) musicTime = audio.currentTime + 0.1; }
function stopMusic() { tune = null; }
function musicTick() {
  if (!audio || muted || !tune || game.state !== "play") return;
  if (musicTime < audio.currentTime) musicTime = audio.currentTime + 0.05;
  while (musicTime < audio.currentTime + 0.25) {
    const s = musicStep % 32;
    if (tune.melody[s]) tone(midi(tune.melody[s]), tune.step * 0.9, "square", 0.025, 0, musicTime);
    if (s % 2 === 0) tone(midi(tune.bass[Math.floor(s / 8)]), tune.step * 1.7, "triangle", 0.07, 0, musicTime);
    musicTime += tune.step;
    musicStep++;
  }
}
setInterval(musicTick, 60);

// ---------- 14. keyboard, touch and menus ----------
const $ = id => document.getElementById(id);
const KEYMAP = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump", KeyZ: "jump", KeyK: "jump",
  ShiftLeft: "run", ShiftRight: "run", KeyX: "run", KeyJ: "run",
};
function press(name, down) {
  if (down && !keys[name]) {
    if (name === "jump") keys.jumpBuffer = 0.12;
    if (name === "run") keys.throwPressed = true;
  }
  keys[name] = down;
}
window.addEventListener("keydown", e => {
  const name = KEYMAP[e.code];
  if (name && game.state !== "menu") e.preventDefault();
  if (name && !e.repeat) press(name, true);
  if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) togglePause();
  if (e.code === "KeyM" && !e.repeat) { muted = !muted; toast(muted ? "🔇 Sound off" : "🔊 Sound on"); }
  if (e.code === "Enter" && game.state === "clear") { e.preventDefault(); startLevel(game.n + 1); }
});
window.addEventListener("keyup", e => { const name = KEYMAP[e.code]; if (name) press(name, false); });
window.addEventListener("blur", () => { for (const k of ["left", "right", "jump", "run"]) keys[k] = false; });

if (window.matchMedia("(pointer: coarse)").matches) $("touch").classList.remove("hidden");
for (const btn of document.querySelectorAll("#touch button")) {
  const name = btn.dataset.key;
  const down = e => { e.preventDefault(); ensureAudio(); btn.classList.add("down"); press(name, true); };
  const up = e => { e.preventDefault(); btn.classList.remove("down"); press(name, false); };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

const SCREENS = ["title-screen", "map-screen", "pause-screen", "clear-screen", "over-screen", "end-screen"];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", id !== null && id !== "pause-screen");
}

function togglePause() {
  if (game.state === "play") {
    game.state = "paused";
    showScreen("pause-screen");
  } else if (game.state === "paused") {
    game.state = "play";
    showScreen(null);
  }
}

function openMap() {
  game.state = "menu";
  stopMusic();
  const map = $("map");
  map.innerHTML = "";
  WORLDS.forEach((w, wi) => {
    const row = document.createElement("div");
    row.className = "world";
    row.innerHTML = `<div class="world-name">World ${wi + 1}<br>${w.name}</div>`;
    for (let s = 0; s < 4; s++) {
      const n = wi * 4 + s;
      const done = save.done.includes(n);
      const b = document.createElement("button");
      b.className = "lvl" + (s === 3 ? " fort" : "") + (done ? " done" : "");
      b.disabled = n > save.unlocked;
      b.innerHTML = b.disabled ? `🔒<small>${wi + 1}-${s + 1}</small>`
        : `${wi + 1}-${s + 1}<small>${done ? "🔔 rung" : s === 3 ? "boss!" : LEVEL_NAMES[n]}</small>`;
      b.title = LEVEL_NAMES[n];
      b.addEventListener("click", () => startLevel(n));
      row.appendChild(b);
    }
    map.appendChild(row);
  });
  showScreen("map-screen");
}

let toastTimer = 0;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

$("play").addEventListener("click", () => { ensureAudio(); openMap(); });
$("map-back").addEventListener("click", () => showScreen("title-screen"));
$("resume").addEventListener("click", togglePause);
$("pause-map").addEventListener("click", openMap);
$("next").addEventListener("click", () => startLevel(game.n + 1));
$("clear-map").addEventListener("click", openMap);
$("retry").addEventListener("click", () => { game.lives = START_LIVES; game.score = 0; startLevel(game.n); });
$("over-map").addEventListener("click", () => { game.lives = START_LIVES; game.score = 0; openMap(); });
$("end-map").addEventListener("click", openMap);

// the HUD only changes the page when a number actually changes
const hudCache = {};
function setHud(id, value) {
  if (hudCache[id] !== value) { hudCache[id] = value; $(id).textContent = value; }
}

// ---------- 15. the main loop: runs about 60 times every second ----------
function update(dt) {
  time += dt;
  if (game.state === "play") updatePlayer(dt);
  else if (game.state === "goal") updateGoal(dt);
  else if (game.state === "dying") return updateDying(dt);
  else return;
  updateEntities(dt);
  updateFx(dt);
  // the camera follows Pip, a bit left of the middle so you can see what's coming
  const target = clamp(player.x + player.w / 2 - viewW * 0.42, 0, Math.max(0, level.w * TILE - viewW));
  cam.x += (target - cam.x) * Math.min(1, dt * 8);
}

let lastTime = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  setHud("level-label", level.label);
  setHud("lives", String(game.lives));
  setHud("coins", String(game.coins));
  setHud("score", String(game.score));
  draw();
  requestAnimationFrame(frame);
}

// the title screen shows the first level behind it, like a poster
loadSave();
level = buildLevel(0);
entities = level.spawns.map(makeEntity);
player = makePlayer(level.start.x, level.start.y);
requestAnimationFrame(frame);
