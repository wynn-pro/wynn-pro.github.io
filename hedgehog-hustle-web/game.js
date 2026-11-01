// Hedgehog Hustle: help Hazel the hedgehog eat every berry in the garden maze.
// Three kinds of fox are hunting her! Munch a mushroom and she curls into a spiky ball,
// and any fox that bumps into her runs home dizzy. Press Space to roll and zoom away.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const HEDGEHOG_SPEED = 5.2;   // squares per second
const ROLL_BOOST = 1.75;      // rolling makes Hazel this many times faster...
const ROLL_TIME = 0.8;        // ...for this many seconds...
const ROLL_COOLDOWN = 4;      // ...and then she needs this many seconds to get her breath back
const FOX_SPEED = 4.0;        // how fast foxes run in the first garden
const FOX_SPEED_UP = 0.18;    // foxes get this much faster every garden...
const FOX_SPEED_MAX = 5.0;    // ...but never faster than this
const HOME_SPEED = 11;        // a dizzy fox runs home this fast
const START_LIVES = 3;
const EXTRA_LIFE_EVERY = 5000;
const BERRY_POINTS = 10, MUSHROOM_POINTS = 50, APPLE_POINTS = 500, BONK_POINTS = 200;
const SAVE_KEY = "hedgehog-hustle";

// ---------- 2. the gardens ----------
// Each garden is written as its left half. The right half is a mirror image.
// # hedge   ~ pond   . berry   o mushroom   F fox den   H where Hazel starts
const GARDENS = [
  { name: "Berry Patch", night: false, foxes: ["red", "sleepy"], half: [
    "##########", "#o.......#", "#.##.###.#", "#.........", "#.##.#.###", "#....#...#", "####.###.#",
    "#F........", "####.#.###", "#....#...H", "#.##.###.#", "#o.......#", "#.###.####", "#.........", "##########"] },
  { name: "Cabbage Rows", night: false, foxes: ["red", "sly", "sleepy"], half: [
    "##########", "#F...#....", "#.##.#.##.", "#o#.......", "#.#.##.###", "#.........", "###.#.####",
    "#...#....H", "#.#####.#.", "#.........", "#.##.####.", "#o#.......", "#.#.#.###.", "#...#.....", "##########"] },
  { name: "Duck Pond", night: false, foxes: ["red", "sly", "sleepy"], half: [
    "##########", "#o.......#", "#.##.###.#", "#.........", "#.##.~~~~~", "#....~~~~~", "##.#.~~~~~",
    "#F.#.~~~~~", "##.#.~~~~~", "#....~~~~~", "#.##.~~~~~", "#.........", "#.##.###.#", "#o.......H", "##########"] },
  { name: "Twisty Thicket", night: false, foxes: ["red", "sly", "sleepy", "red"], half: [
    "##########", "#...#....#", "#.#.#.##.#", "#o#......#", "#.###.##.#", "#...#..#..", "###.##.#.#",
    "#F.......H", "###.##.#.#", "#...#..#..", "#.###.##.#", "#o#......#", "#.#.#.##.#", "#...#....#", "##########"] },
  { name: "Moonlit Meadow", night: true, foxes: ["red", "sly", "red", "sly"], half: [
    "##########", "#.....#...", "#.###.#.#.", "#.#o....#.", "#.#.###.#.", "#.........", "##.#.#.###",
    "#F.#.#...H", "##.#.#.###", "#.........", "#.#.###.#.", "#.#o....#.", "#.###.#.#.", "#.....#...", "##########"] },
];

// red foxes chase Hazel, sly foxes try to get in front of her, sleepy foxes wander and take naps
const FOX_KINDS = {
  red:    { name: "Rusty",  fur: "#e8672c", dark: "#a8431a", speed: 1.0 },
  sly:    { name: "Silver", fur: "#9aa8bd", dark: "#5f6b80", speed: 0.95 },
  sleepy: { name: "Dozy",   fur: "#e9b04a", dark: "#a8761f", speed: 0.85 },
};

const THEMES = {
  day:   { ground: "#e9d7a8", dots: "#dcc792", hedge: "#3f9a45", hedgeTop: "#5cbf55", leaf: "#2f7d36", pond: "#4fa8de", pondLight: "#8fd0f2", back: "#7cc464" },
  night: { ground: "#4d4a6b", dots: "#45425f", hedge: "#24563a", hedgeTop: "#2f7048", leaf: "#1b4029", pond: "#2a4f86", pondLight: "#4f79b8", back: "#1d2340" },
};

const RIGHT = { x: 1, y: 0 }, LEFT = { x: -1, y: 0 }, DOWN = { x: 0, y: 1 }, UP = { x: 0, y: -1 };
const DIRS = [UP, LEFT, DOWN, RIGHT];
const KEY_DIRS = {
  ArrowRight: RIGHT, ArrowLeft: LEFT, ArrowDown: DOWN, ArrowUp: UP,
  d: RIGHT, a: LEFT, s: DOWN, w: UP, D: RIGHT, A: LEFT, S: DOWN, W: UP,
};

// ---------- 3. the game's memory ----------
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

let state = "menu";        // menu, ready, play, dying, clear, paused, over, won
let pausedFrom = "play";
let level = 0, score = 0, best = 0, lives = START_LIVES, nextLifeAt = EXTRA_LIFE_EVERY;
let rows = [], W = 19, H = 15, food = [], berriesLeft = 0, eaten = 0, dens = [], startTile = { x: 9, y: 9 };
let hazel = null, foxes = [], apple = null, popups = [];
let spikyT = 0, bonkChain = 0, rollT = 0, rollCd = 0;
let stateT = 0, clock = 0, munchFlip = false;
let tile = 24, offX = 0, offY = 0, mazePic = null;

try { best = Number(localStorage.getItem(SAVE_KEY + "-best")) || 0; } catch (e) { /* fine */ }

const garden = () => GARDENS[level % GARDENS.length];
const mirror = (row) => row + [...row.slice(0, 9)].reverse().join("");
const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || rows[y][x] === "#" || rows[y][x] === "~";
const opposite = (a, b) => a && b && a.x === -b.x && a.y === -b.y;

// ---------- 4. setting up a garden ----------
function loadGarden() {
  const g = garden();
  rows = g.half.map(mirror);
  H = rows.length;
  W = rows[0].length;
  food = [];
  dens = [];
  berriesLeft = 0;
  eaten = 0;
  for (let y = 0; y < H; y++) {
    food.push([]);
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      food[y].push(ch === "." || ch === "o" ? ch : null);
      if (food[y][x]) berriesLeft++;
      if (ch === "F") dens.push({ x, y });
      if (ch === "H") startTile = { x, y };
    }
  }
  foxes = g.foxes.map((kind, i) => {
    const den = dens[i % dens.length];
    return { kind, den, homeDist: distancesFrom(den), x: den.x, y: den.y, tx: den.x, ty: den.y, dir: null };
  });
  apple = null;
  buildMazePicture();
  resetPositions();
}

// how many steps every square is from the fox's den, so dizzy foxes can find the way home
function distancesFrom(from) {
  const dist = rows.map((r) => r.split("").map(() => Infinity));
  dist[from.y][from.x] = 0;
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    for (const d of DIRS) {
      const nx = p.x + d.x, ny = p.y + d.y;
      if (!isWall(nx, ny) && dist[ny][nx] === Infinity) {
        dist[ny][nx] = dist[p.y][p.x] + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

function resetPositions() {
  hazel = { x: startTile.x, y: startTile.y, tx: startTile.x, ty: startTile.y, dir: null, want: null, face: LEFT };
  foxes.forEach((f, i) => {
    Object.assign(f, { x: f.den.x, y: f.den.y, tx: f.den.x, ty: f.den.y, dir: null,
      mode: "wait", wait: 1.2 + i * 2.4, dizzy: false, nap: 0 });
  });
  spikyT = 0;
  rollT = 0;
  rollCd = 0;
  popups = [];
}

function foxSpeed() {
  const loop = Math.floor(level / GARDENS.length);
  return Math.min(FOX_SPEED_MAX, FOX_SPEED + FOX_SPEED_UP * level + 0.1 * loop);
}

// ---------- 5. moving along the maze ----------
// Everyone walks from the middle of one square to the middle of the next.
// In the middle of a square, choose() picks where to go next (or null to stop there).
function walk(who, dist, choose, arrive) {
  for (let guard = 0; dist > 0 && guard < 8; guard++) {
    if (who.x === who.tx && who.y === who.ty) {
      const d = choose(who);
      if (!d) return;
      who.dir = d;
      who.tx = who.x + d.x;
      who.ty = who.y + d.y;
    }
    const left = Math.abs(who.tx - who.x) + Math.abs(who.ty - who.y);
    const step = Math.min(dist, left);
    who.x += Math.sign(who.tx - who.x) * step;
    who.y += Math.sign(who.ty - who.y) * step;
    dist -= step;
    if (step === left) {
      who.x = who.tx;
      who.y = who.ty;
      arrive(who);
    }
  }
}

// turn around right away, even between two squares
function turnAround(who) {
  if (!who.dir || (who.x === who.tx && who.y === who.ty)) return;
  who.tx -= who.dir.x;
  who.ty -= who.dir.y;
  who.dir = { x: -who.dir.x, y: -who.dir.y };
}

function hazelChoose(h) {
  if (h.want && !isWall(h.x + h.want.x, h.y + h.want.y)) return h.want;
  if (h.dir && !isWall(h.x + h.dir.x, h.y + h.dir.y)) return h.dir;
  return null;
}

function hazelArrive(h) {
  const what = food[h.y][h.x];
  if (!what) return;
  food[h.y][h.x] = null;
  berriesLeft--;
  eaten++;
  if (what === ".") {
    addScore(BERRY_POINTS);
    munchFlip = !munchFlip;
    tone(munchFlip ? 520 : 640, 0.05, "triangle", 0.05);
  } else {
    addScore(MUSHROOM_POINTS);
    curlUp();
  }
  if (eaten === 50 || eaten === 100) dropApple();
  if (berriesLeft === 0) {
    setState("clear");
    jingle([523, 659, 784, 1047], 0.12);
  }
}

function curlUp() {
  spikyT = Math.max(3, 7 - level * 0.6);
  bonkChain = 0;
  for (const f of foxes) {
    if (f.dizzy || f.mode === "wait") continue;
    f.mode = "scared";
    turnAround(f);
  }
  tone(300, 0.35, "sawtooth", 0.06, 900);
}

function foxChoose(f) {
  const open = DIRS.filter((d) => !isWall(f.x + d.x, f.y + d.y));
  // foxes don't turn back, unless they are going home or are stuck
  let choices = f.mode === "home" ? open : open.filter((d) => !opposite(d, f.dir));
  if (!choices.length) choices = open;
  if (!choices.length) return null;
  const pick = (score) => choices.reduce((a, b) => (score(b) < score(a) ? b : a));
  if (f.mode === "home") return pick((d) => f.homeDist[f.y + d.y][f.x + d.x]);
  const hx = Math.round(hazel.x), hy = Math.round(hazel.y);
  const far = (d, tx, ty) => (f.x + d.x - tx) ** 2 + (f.y + d.y - ty) ** 2;
  if (f.mode === "scared") {
    if (Math.random() < 0.2) return choices[Math.floor(Math.random() * choices.length)];
    return pick((d) => -far(d, hx, hy));
  }
  if (f.kind === "sleepy" && Math.random() < 0.55) return choices[Math.floor(Math.random() * choices.length)];
  let tx = hx, ty = hy;
  if (f.kind === "sly" && hazel.dir) {
    tx += hazel.dir.x * 4;
    ty += hazel.dir.y * 4;
  }
  return pick((d) => far(d, tx, ty) + Math.random() * 0.5);
}

function foxArrive(f) {
  if (f.mode === "home" && f.x === f.den.x && f.y === f.den.y) {
    f.mode = "wait";
    f.wait = 1.5;
  } else if (f.kind === "sleepy" && f.mode === "chase" && Math.random() < 0.04) {
    f.nap = 1.6;
  }
}

// ---------- 6. points, apples and lives ----------
function addScore(n, x, y) {
  score += n;
  if (x !== undefined) popups.push({ text: String(n), x, y, t: 0 });
  if (score >= nextLifeAt) {
    nextLifeAt += EXTRA_LIFE_EVERY;
    lives++;
    jingle([784, 988, 1175], 0.08);
    popups.push({ text: "+1 🦔", x: hazel.x, y: hazel.y - 0.6, t: 0 });
  }
  if (score > best) {
    best = score;
    try { localStorage.setItem(SAVE_KEY + "-best", String(best)); } catch (e) { /* fine */ }
  }
}

function dropApple() {
  const spots = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isWall(x, y) && !food[y][x] && rows[y][x] !== "F" && Math.abs(x - hazel.x) + Math.abs(y - hazel.y) > 5) spots.push({ x, y });
    }
  }
  if (!spots.length) return;
  apple = { ...spots[Math.floor(Math.random() * spots.length)], t: 10 };
  tone(880, 0.12, "triangle", 0.05, 1200);
}

function roll() {
  if (state !== "play" || rollCd > 0 || !hazel.dir) return;
  rollT = ROLL_TIME;
  rollCd = ROLL_COOLDOWN;
  tone(200, 0.25, "sawtooth", 0.04, 600);
}

// ---------- 7. every frame ----------
function update(dt) {
  clock += dt;
  stateT += dt;
  for (const p of popups) p.t += dt;
  popups = popups.filter((p) => p.t < 1);

  if (state === "ready" && stateT > 1.8) state = "play";
  if (state === "dying" && stateT > 1.8) {
    lives--;
    if (lives <= 0) return gameOver();
    resetPositions();
    setState("ready");
  }
  if (state === "clear" && stateT > 2.2) {
    level++;
    if (level === GARDENS.length) return showWin();
    loadGarden();
    setState("ready");
  }
  if (state !== "play") return;

  // Hazel
  if (opposite(hazel.want, hazel.dir)) turnAround(hazel);
  rollT = Math.max(0, rollT - dt);
  rollCd = Math.max(0, rollCd - dt);
  const speed = HEDGEHOG_SPEED * (spikyT > 0 ? 1.08 : 1) * (rollT > 0 ? ROLL_BOOST : 1);
  walk(hazel, speed * dt, hazelChoose, hazelArrive);
  if (hazel.dir) hazel.face = hazel.dir;
  if (state !== "play") return; // she just ate the last berry

  if (spikyT > 0) {
    spikyT -= dt;
    if (spikyT <= 0) for (const f of foxes) if (f.mode === "scared") f.mode = "chase";
  }

  // foxes
  for (const f of foxes) {
    if (f.mode === "wait") {
      f.wait -= dt;
      if (f.wait <= 0) {
        f.mode = "chase";
        f.dizzy = false;
      }
      continue;
    }
    if (f.nap > 0) {
      f.nap -= dt;
      continue;
    }
    let s = foxSpeed() * FOX_KINDS[f.kind].speed;
    if (f.mode === "scared") s *= 0.6;
    if (f.mode === "home") s = HOME_SPEED;
    walk(f, s * dt, foxChoose, foxArrive);
  }

  // bumping into things
  for (const f of foxes) {
    if (f.dizzy || Math.hypot(f.x - hazel.x, f.y - hazel.y) > 0.65) continue;
    if (spikyT > 0) {
      const pts = BONK_POINTS * 2 ** Math.min(bonkChain, 3);
      bonkChain++;
      addScore(pts, f.x, f.y);
      f.mode = "home";
      f.dizzy = true;
      f.nap = 0;
      tone(900, 0.2, "square", 0.06, 200);
    } else {
      setState("dying");
      tone(500, 1.1, "triangle", 0.08, 80);
      return;
    }
  }
  if (apple) {
    apple.t -= dt;
    if (apple.t <= 0) apple = null;
    else if (Math.hypot(apple.x - hazel.x, apple.y - hazel.y) < 0.6) {
      addScore(APPLE_POINTS, apple.x, apple.y);
      jingle([660, 880], 0.07);
      apple = null;
    }
  }
}

// ---------- 8. drawing ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const touch = document.body.classList.contains("touch");
  const top = 64, bottom = touch && innerHeight > innerWidth ? 190 : 14;
  tile = Math.max(8, Math.floor(Math.min((innerWidth - 16) / W, (innerHeight - top - bottom) / H)));
  offX = Math.floor((innerWidth - tile * W) / 2);
  offY = Math.floor(top + (innerHeight - top - bottom - tile * H) / 2);
  if (rows.length) buildMazePicture();
}

// the hedges and ponds never move, so they are drawn once into a picture and reused every frame
function buildMazePicture() {
  const theme = THEMES[garden().night ? "night" : "day"];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  mazePic = document.createElement("canvas");
  mazePic.width = W * tile * dpr;
  mazePic.height = H * tile * dpr;
  const g = mazePic.getContext("2d");
  g.scale(dpr, dpr);
  const T = tile;
  g.fillStyle = theme.ground;
  g.fillRect(0, 0, W * T, H * T);
  // little pebbles in the dirt path
  let seed = level * 97 + 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = theme.dots;
  for (let i = 0; i < W * H; i++) g.fillRect(rand() * W * T, rand() * H * T, 2, 2);

  const same = (x, y, ch) => x >= 0 && y >= 0 && x < W && y < H && rows[y][x] === ch;
  for (const ch of ["~", "#"]) {
    const base = ch === "#" ? theme.hedge : theme.pond;
    const top = ch === "#" ? theme.hedgeTop : theme.pondLight;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (rows[y][x] !== ch) continue;
        const px = x * T, py = y * T, pad = T * 0.1;
        g.fillStyle = base;
        roundRect(g, px + pad, py + pad, T - pad * 2, T - pad * 2, T * 0.3);
        // join up with the hedge (or pond) next door
        if (same(x + 1, y, ch)) g.fillRect(px + T / 2, py + pad, T, T - pad * 2);
        if (same(x, y + 1, ch)) g.fillRect(px + pad, py + T / 2, T - pad * 2, T);
        if (same(x + 1, y, ch) && same(x, y + 1, ch) && same(x + 1, y + 1, ch)) g.fillRect(px + T / 2, py + T / 2, T, T);
      }
    }
    // a lighter top, a little smaller, so it looks puffy
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (rows[y][x] !== ch) continue;
        const px = x * T, py = y * T, pad = T * 0.22;
        g.fillStyle = top;
        roundRect(g, px + pad, py + pad, T - pad * 2, T - pad * 2.4, T * 0.22);
        if (same(x + 1, y, ch)) g.fillRect(px + T / 2, py + pad, T, T - pad * 2.4);
        if (same(x, y + 1, ch)) g.fillRect(px + pad, py + T / 2, T - pad * 2, T);
        if (ch === "#") {
          g.fillStyle = theme.leaf;
          for (let i = 0; i < 2; i++) {
            g.beginPath();
            g.arc(px + T * (0.3 + rand() * 0.4), py + T * (0.3 + rand() * 0.4), T * 0.06, 0, Math.PI * 2);
            g.fill();
          }
        } else if (rand() < 0.35) {
          g.strokeStyle = "rgba(255,255,255,0.55)";
          g.lineWidth = Math.max(1, T * 0.05);
          g.beginPath();
          g.arc(px + T / 2, py + T / 2, T * 0.18, Math.PI * 1.1, Math.PI * 1.9);
          g.stroke();
        }
      }
    }
  }
  // fox dens are little holes in the ground
  for (const d of dens) {
    g.fillStyle = "rgba(60, 35, 15, 0.55)";
    g.beginPath();
    g.ellipse((d.x + 0.5) * T, (d.y + 0.55) * T, T * 0.4, T * 0.28, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

const cx = (x) => offX + (x + 0.5) * tile;
const cy = (y) => offY + (y + 0.5) * tile;

function draw() {
  const theme = THEMES[garden().night ? "night" : "day"];
  ctx.fillStyle = theme.back;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  if (!mazePic) return;
  ctx.drawImage(mazePic, offX, offY, W * tile, H * tile);
  if (state === "clear" && Math.floor(stateT * 6) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(offX, offY, W * tile, H * tile);
  }
  const T = tile;

  // berries and mushrooms
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (food[y][x] === ".") drawBerry(cx(x), cy(y), T);
      else if (food[y][x] === "o") drawMushroom(cx(x), cy(y) + Math.sin(clock * 4 + x) * T * 0.05, T);
    }
  }
  if (apple && (apple.t > 3 || Math.floor(clock * 8) % 2 === 0)) drawApple(cx(apple.x), cy(apple.y), T);

  for (const f of foxes) drawFox(f, T);
  drawHazel(T);

  // floating points
  ctx.textAlign = "center";
  ctx.font = `${Math.round(T * 0.6)}px "Lilita One", sans-serif`;
  for (const p of popups) {
    ctx.globalAlpha = 1 - p.t;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#5a2a00";
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, cx(p.x), cy(p.y) - p.t * T);
    ctx.fillText(p.text, cx(p.x), cy(p.y) - p.t * T);
  }
  ctx.globalAlpha = 1;

  if (state === "ready") banner(stateT < 0.9 ? garden().name : "Go!");
  if (state === "clear") banner("Garden clear!");
}

function banner(text) {
  const T = tile;
  ctx.font = `${Math.round(T * 1.3)}px "Lilita One", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(4, T * 0.25);
  ctx.strokeStyle = "#3b1d00";
  ctx.fillStyle = "#ffe066";
  const y = offY + H * tile * 0.5;
  ctx.strokeText(text, innerWidth / 2, y);
  ctx.fillText(text, innerWidth / 2, y);
  ctx.textBaseline = "alphabetic";
}

function drawBerry(x, y, T) {
  ctx.fillStyle = "#d6264f";
  ctx.beginPath();
  ctx.arc(x, y, T * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x - T * 0.06, y - T * 0.07, T * 0.05, T * 0.05);
  ctx.fillStyle = "#3b8a2e";
  ctx.fillRect(x - T * 0.02, y - T * 0.19, T * 0.05, T * 0.07);
}

function drawMushroom(x, y, T) {
  ctx.fillStyle = "#f6ead4";
  ctx.fillRect(x - T * 0.1, y - T * 0.02, T * 0.2, T * 0.26);
  ctx.fillStyle = "#c93a3a";
  ctx.beginPath();
  ctx.arc(x, y, T * 0.3, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  for (const [dx, dy, r] of [[-0.14, -0.1, 0.06], [0.1, -0.16, 0.05], [0.15, -0.05, 0.04]]) {
    ctx.beginPath();
    ctx.arc(x + dx * T, y + dy * T, r * T, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawApple(x, y, T) {
  ctx.fillStyle = "#e33b2e";
  ctx.beginPath();
  ctx.arc(x - T * 0.1, y + T * 0.03, T * 0.24, 0, Math.PI * 2);
  ctx.arc(x + T * 0.1, y + T * 0.03, T * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b3e1a";
  ctx.fillRect(x - T * 0.025, y - T * 0.32, T * 0.05, T * 0.14);
  ctx.fillStyle = "#4caf3e";
  ctx.beginPath();
  ctx.ellipse(x + T * 0.1, y - T * 0.27, T * 0.12, T * 0.06, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

const angleOf = (d) => Math.atan2(d.y, d.x);

function drawHazel(T) {
  const h = hazel;
  ctx.save();
  ctx.translate(cx(h.x), cy(h.y));
  if (state === "dying") {
    // spin and shrink
    ctx.rotate(stateT * 10);
    const s = Math.max(0, 1 - stateT / 1.4);
    ctx.scale(s, s);
  }
  const spiky = spikyT > 0 && (spikyT > 1.5 || Math.floor(clock * 10) % 2 === 0);
  if (spiky) {
    // curled up into a spiky ball
    ctx.rotate(clock * 12);
    ctx.fillStyle = "#3a2414";
    spikes(T * 0.46, T * 0.3, 14);
    ctx.fillStyle = "#c79bff";
    ctx.beginPath();
    ctx.arc(0, 0, T * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a35";
    ctx.beginPath();
    ctx.arc(0, 0, T * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angleOf(h.face));
  const wiggle = h.x !== h.tx || h.y !== h.ty ? Math.sin(clock * 30) * 0.03 : 0;
  if (rollT > 0) {
    // speed lines
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    for (const k of [-0.2, 0, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(-T * 0.55, k * T);
      ctx.lineTo(-T * 0.85, k * T);
      ctx.stroke();
    }
  }
  // spiky back
  ctx.fillStyle = "#5b3a22";
  ctx.save();
  ctx.translate(-T * 0.06, 0);
  spikes(T * (0.42 + wiggle), T * 0.28, 11);
  ctx.restore();
  ctx.fillStyle = "#7a5233";
  ctx.beginPath();
  ctx.ellipse(-T * 0.06, 0, T * 0.3, T * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // face
  ctx.fillStyle = "#e9c99a";
  ctx.beginPath();
  ctx.ellipse(T * 0.2, 0, T * 0.2, T * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(T * 0.3, -T * 0.1);
  ctx.lineTo(T * 0.46, 0);
  ctx.lineTo(T * 0.3, T * 0.1);
  ctx.fill();
  ctx.fillStyle = "#222";
  for (const [ex, ey, r] of [[0.46, 0, 0.05], [0.24, -0.08, 0.035], [0.24, 0.08, 0.035]]) {
    ctx.beginPath();
    ctx.arc(ex * T, ey * T, r * T, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ff9fb0";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(T * 0.16, s * T * 0.12, T * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function spikes(outer, inner, count) {
  ctx.beginPath();
  for (let i = 0; i < count * 2; i++) {
    const a = (i / (count * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function drawFox(f, T) {
  const kind = FOX_KINDS[f.kind];
  const x = cx(f.x), y = cy(f.y);
  const scared = f.mode === "scared";
  const blinkWhite = scared && spikyT < 1.5 && Math.floor(clock * 8) % 2 === 0;
  const fur = f.dizzy ? "rgba(255,255,255,0.35)" : blinkWhite ? "#f2f2ff" : scared ? "#7b8de0" : kind.fur;
  const dark = f.dizzy ? "rgba(255,255,255,0.2)" : scared ? "#4a5bb0" : kind.dark;
  ctx.save();
  ctx.translate(x, y);
  if (scared) ctx.translate(Math.sin(clock * 50) * T * 0.03, 0);
  if (f.mode === "wait" && !f.dizzy) ctx.translate(0, Math.sin(clock * 6 + f.wait) * T * 0.06);
  ctx.rotate(angleOf(f.dir || (hazel.x < f.x ? LEFT : RIGHT)));
  // bushy tail
  ctx.save();
  ctx.translate(-T * 0.22, 0);
  ctx.rotate(Math.sin(clock * 10) * 0.35);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-T * 0.2, 0, T * 0.22, T * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = f.dizzy ? "rgba(255,255,255,0.4)" : "#fff";
  ctx.beginPath();
  ctx.arc(-T * 0.36, 0, T * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-T * 0.06, 0, T * 0.24, T * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.fillStyle = dark;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(T * 0.1, s * T * 0.08);
    ctx.lineTo(T * 0.06, s * T * 0.32);
    ctx.lineTo(T * 0.24, s * T * 0.14);
    ctx.fill();
  }
  // head and pointy nose
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(T * 0.18, 0, T * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(T * 0.26, -T * 0.11);
  ctx.lineTo(T * 0.48, 0);
  ctx.lineTo(T * 0.26, T * 0.11);
  ctx.fill();
  ctx.fillStyle = f.dizzy ? "rgba(255,255,255,0.5)" : "#fff";
  ctx.beginPath();
  ctx.moveTo(T * 0.3, -T * 0.06);
  ctx.lineTo(T * 0.45, 0);
  ctx.lineTo(T * 0.3, T * 0.06);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(T * 0.48, 0, T * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // eyes: closed when napping, big and worried when scared
  const napping = f.nap > 0;
  for (const s of [-1, 1]) {
    if (napping) {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = Math.max(1, T * 0.04);
      ctx.beginPath();
      ctx.moveTo(T * 0.2, s * T * 0.12);
      ctx.lineTo(T * 0.2, s * T * 0.04);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(T * 0.2, s * T * 0.08, T * (scared ? 0.065 : 0.05), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(T * 0.22, s * T * 0.08, T * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.font = `${Math.round(T * 0.4)}px sans-serif`;
  if (f.dizzy) {
    // little stars spinning round its head
    for (let i = 0; i < 3; i++) {
      const a = clock * 6 + (i * Math.PI * 2) / 3;
      ctx.fillText("⭐", x + Math.cos(a) * T * 0.3, y - T * 0.35 + Math.sin(a) * T * 0.1);
    }
  } else if (napping) {
    ctx.fillText("💤", x + T * 0.3, y - T * 0.4 - (f.nap % 0.8) * T * 0.3);
  }
}

// ---------- 9. the HUD and screens ----------
let lastHud = "";
function updateHud() {
  const roll = rollT > 0 ? 1 : 1 - rollCd / ROLL_COOLDOWN;
  const hud = [score, best, lives, level, Math.round(roll * 20)].join("|");
  if (hud === lastHud) return;
  lastHud = hud;
  $("score").textContent = score;
  $("best").textContent = best;
  $("lives").textContent = "🦔".repeat(Math.min(lives, 6)) + (lives > 6 ? "+" : "");
  $("level").textContent = level + 1;
  $("garden-name").textContent = garden().name;
  $("roll-bar").style.width = Math.round(roll * 100) + "%";
  $("roll-pill").classList.toggle("ready", roll >= 1);
}

function setState(s) {
  state = s;
  stateT = 0;
  document.body.classList.toggle("in-menu", s === "menu" || s === "over");
  for (const id of ["title-screen", "pause-screen", "over-screen", "win-screen"]) $(id).classList.add("hidden");
  if (s === "menu") {
    $("title-screen").classList.remove("hidden");
    $("best-title").textContent = best;
  }
  if (s === "paused") $("pause-screen").classList.remove("hidden");
  if (s === "over") $("over-screen").classList.remove("hidden");
}

function newGame() {
  unlockAudio();
  level = 0;
  score = 0;
  lives = START_LIVES;
  nextLifeAt = EXTRA_LIFE_EVERY;
  loadGarden();
  resize();
  setState("ready");
}

function gameOver() {
  setState("over");
  $("over-text").textContent = `You scored ${score} points and reached garden ${level + 1}. Your best is ${best}.`;
}

function showWin() {
  state = "won";
  $("win-screen").classList.remove("hidden");
  $("win-text").textContent = `Hazel ate every berry in all ${GARDENS.length} gardens and scored ${score} points! ` +
    "The foxes get faster from here. Can you keep going?";
  jingle([523, 659, 784, 1047, 784, 1047], 0.13);
}

function keepGoing() {
  loadGarden();
  setState("ready");
}

function togglePause() {
  if (state === "paused") {
    setState(pausedFrom);
  } else if (["play", "ready", "dying", "clear"].includes(state)) {
    pausedFrom = state;
    setState("paused");
  }
}

// ---------- 10. sound ----------
let audio = null, soundOn = true;
try { soundOn = localStorage.getItem(SAVE_KEY + "-sound") !== "off"; } catch (e) { /* fine */ }

function unlockAudio() {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
  if (audio.state === "suspended") audio.resume();
}

function tone(freq, dur, type = "square", vol = 0.06, slideTo = 0, delay = 0) {
  if (!soundOn || !audio) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function jingle(notes, gap) {
  notes.forEach((n, i) => tone(n, gap * 1.4, "triangle", 0.07, 0, i * gap));
}

function toggleSound() {
  soundOn = !soundOn;
  $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
  try { localStorage.setItem(SAVE_KEY + "-sound", soundOn ? "on" : "off"); } catch (e) { /* fine */ }
}

// ---------- 11. controls ----------
function steer(d) {
  if (hazel) hazel.want = d;
}

addEventListener("keydown", (e) => {
  if (KEY_DIRS[e.key]) {
    steer(KEY_DIRS[e.key]);
    e.preventDefault();
  } else if (e.key === " ") {
    if (state === "menu" || state === "over") newGame();
    else roll();
    e.preventDefault();
  } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
    togglePause();
  } else if (e.key === "m" || e.key === "M") {
    toggleSound();
  } else if (e.key === "Enter" && (state === "menu" || state === "over")) {
    newGame();
  }
});

// swipe anywhere to steer, tap to roll
let swipe = null;
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  swipe = { x: e.clientX, y: e.clientY, moved: false };
});
canvas.addEventListener("pointermove", (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < 22) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP));
  swipe = { x: e.clientX, y: e.clientY, moved: true };
});
canvas.addEventListener("pointerup", () => {
  if (swipe && !swipe.moved) roll();
  swipe = null;
});

for (const btn of document.querySelectorAll("[data-dir]")) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    unlockAudio();
    steer({ up: UP, down: DOWN, left: LEFT, right: RIGHT }[btn.dataset.dir]);
  });
}
$("btn-roll").addEventListener("pointerdown", (e) => { e.preventDefault(); roll(); });
$("btn-play").addEventListener("click", newGame);
$("btn-again").addEventListener("click", newGame);
$("btn-over-title").addEventListener("click", () => setState("menu"));
$("btn-resume").addEventListener("click", togglePause);
$("btn-pause").addEventListener("click", togglePause);
$("btn-pause-title").addEventListener("click", () => setState("menu"));
$("btn-sound").addEventListener("click", toggleSound);
$("btn-keep").addEventListener("click", keepGoing);
$("btn-win-title").addEventListener("click", () => setState("menu"));
$("btn-sound").textContent = soundOn ? "🔊" : "🔇";
// stop when you switch to another tab
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") togglePause(); });

if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
addEventListener("resize", resize);

// ---------- 12. start! ----------
loadGarden();
resize();
setState("menu");
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state !== "paused" && state !== "won") update(dt);
  draw();
  if (state !== "menu") updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
