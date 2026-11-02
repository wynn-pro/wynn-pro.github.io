// Cosmo Crates: an endless space puzzle. Cosmo the astronaut pushes cargo crates onto glowing landing pads.
// The computer makes every level itself. It starts with the crates already on their pads and walks Cosmo
// backwards, PULLING crates away. Because every pull can be undone by a push, every puzzle can be solved.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
"use strict";

// ---------- 1. numbers you can change ----------
const SAVE_KEY = "cosmocrates-save";
const STEP_TIME = 0.1;        // seconds for Cosmo to slide from one square to the next
const TRIES = 40;             // the puzzle maker builds this many puzzles and keeps the trickiest one
const SOLVER_LIMIT = 150000;  // the most positions the solver checks when it works out the 3-star goal
const MAX_TILE = 72;          // the biggest a square can get on screen, in pixels
const WALL = 1;
const FLOOR = 0;
const DX = [0, 1, 0, -1];     // the 4 directions: up, right, down, left
const DY = [-1, 0, 1, 0];

// how big and how hard level n is
function levelPlan(n) {
  return {
    boxes: n <= 2 ? 1 : n <= 6 ? 2 : n <= 14 ? 3 : n <= 30 ? 4 : 5,
    w: Math.min(7 + Math.floor(n / 5), 12),  // these sizes include the rock wall round the edge
    h: Math.min(6 + Math.floor(n / 6), 10),
    pulls: Math.min(30 + n * 12, 500),       // how many steps Cosmo walks backwards when making it
  };
}

// ---------- 2. random numbers you can repeat ----------
// the same seed always gives the same puzzle, so "start again" gives you the same level
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, n) => Math.floor(rng() * n);
function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
}
const hash = (n) => (Math.imul(n + 1, 2654435761) >>> 0);

// squares are numbered y * w + x, so moving one square is just adding a number
const offsets = (w) => DX.map((dx, d) => DY[d] * w + dx);

// ---------- 3. the puzzle maker ----------
function makeRoom(rng, w, h) {
  const cells = new Uint8Array(w * h).fill(WALL);
  // carve out a few overlapping rectangles
  const rects = 2 + randInt(rng, 3);
  for (let r = 0; r < rects; r++) {
    const rw = 2 + randInt(rng, w - 3);
    const rh = 2 + randInt(rng, h - 3);
    const x0 = 1 + randInt(rng, w - 1 - rw);
    const y0 = 1 + randInt(rng, h - 1 - rh);
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) cells[y * w + x] = FLOOR;
  }
  // drop a few space rocks inside so it isn't just a big empty box
  const floors = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === FLOOR) floors.push(i);
  const rocks = Math.floor(floors.length * 0.08);
  for (let i = 0; i < rocks; i++) cells[floors[randInt(rng, floors.length)]] = WALL;

  // keep only the biggest joined-up part, so Cosmo can reach every square
  const off = offsets(w);
  const group = new Int16Array(w * h).fill(-1);
  let best = -1, bestSize = 0, g = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== FLOOR || group[i] >= 0) continue;
    const stack = [i];
    group[i] = g;
    let size = 0;
    while (stack.length) {
      const c = stack.pop();
      size++;
      for (const o of off) {
        const n = c + o;
        if (cells[n] === FLOOR && group[n] < 0) { group[n] = g; stack.push(n); }
      }
    }
    if (size > bestSize) { bestSize = size; best = g; }
    g++;
  }
  for (let i = 0; i < cells.length; i++) if (cells[i] === FLOOR && group[i] !== best) cells[i] = WALL;
  return cells;
}

// how many steps it takes to walk from a to b without going through walls or crates (-1 if you can't)
function walkDistance(cells, boxAt, w, a, b) {
  if (a === b) return 0;
  const off = offsets(w);
  const dist = new Int16Array(cells.length).fill(-1);
  dist[a] = 0;
  const queue = [a];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    for (const o of off) {
      const n = c + o;
      if (cells[n] === WALL || boxAt[n] >= 0 || dist[n] >= 0) continue;
      dist[n] = dist[c] + 1;
      if (n === b) return dist[n];
      queue.push(n);
    }
  }
  return -1;
}

function tryPuzzle(rng, plan) {
  const { w, h, boxes: count } = plan;
  const cells = makeRoom(rng, w, h);
  const floors = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === FLOOR) floors.push(i);
  if (floors.length < count * 3 + 4) return null;

  shuffle(rng, floors);
  const targets = floors.slice(0, count);
  const boxes = targets.slice();
  const boxAt = new Int8Array(w * h).fill(-1);
  boxes.forEach((c, i) => { boxAt[c] = i; });
  const off = offsets(w);

  // walk backwards, pulling crates off their pads
  let p = floors[count];
  let d = randInt(rng, 4);
  const pushes = [];  // the pushes you would do going forwards (in backwards order)
  for (let s = 0; s < plan.pulls; s++) {
    if (rng() < 0.45) d = randInt(rng, 4);
    const next = p + off[d];
    if (cells[next] === WALL || boxAt[next] >= 0) { d = randInt(rng, 4); continue; }
    const behind = p - off[d];
    const b = boxAt[behind];
    if (b >= 0 && rng() < 0.8) {
      boxAt[behind] = -1;
      boxAt[p] = b;
      boxes[b] = p;
      pushes.push({ box: p, dir: (d + 2) % 4 });
    }
    p = next;
  }

  const isTarget = new Uint8Array(w * h);
  targets.forEach((t) => { isTarget[t] = 1; });
  const away = boxes.filter((c) => !isTarget[c]).length;
  if (away < Math.min(count, 1 + (count >> 1))) return null;

  // now play it forwards to count the moves, and how often you swap to a different crate
  const fb = Int8Array.from(boxAt);
  let pl = p, moves = 0, swaps = 0, last = -1;
  for (let i = pushes.length - 1; i >= 0; i--) {
    const { box, dir } = pushes[i];
    const dist = walkDistance(cells, fb, w, pl, box - off[dir]);
    if (dist < 0) return null;
    moves += dist + 1;
    const id = fb[box];
    fb[box] = -1;
    fb[box + off[dir]] = id;
    pl = box;
    if (id !== last) swaps++;
    last = id;
  }
  const score = away * 15 + swaps * 5 + Math.min(moves, 200) * 0.2;
  return { w, h, cells, targets, boxes: boxes.slice(), player: p, par: moves, score };
}

// a crate in a corner that isn't on a pad can never move again
function cornered(cells, w, c) {
  const up = cells[c - w] === WALL, down = cells[c + w] === WALL;
  const left = cells[c - 1] === WALL, right = cells[c + 1] === WALL;
  return (up || down) && (left || right);
}

// the solver tries every possible move, one step at a time, to find the fewest moves to win
function solvePuzzle(puz) {
  const { w, cells, targets } = puz;
  const off = offsets(w);
  const isTarget = new Uint8Array(cells.length);
  targets.forEach((t) => { isTarget[t] = 1; });
  const byNum = (a, b) => a - b;
  const keyOf = (p, bs) => { let k = p; for (const b of bs) k = k * 128 + b; return k; };

  const start = puz.boxes.slice().sort(byNum);
  let frontier = [{ p: puz.player, b: start }];
  const seen = new Set([keyOf(puz.player, start)]);
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const s of frontier) {
      for (let d = 0; d < 4; d++) {
        const np = s.p + off[d];
        if (cells[np] === WALL) continue;
        let bs = s.b;
        const hit = bs.indexOf(np);
        if (hit >= 0) {
          const nb = np + off[d];
          if (cells[nb] === WALL || bs.includes(nb)) continue;
          if (!isTarget[nb] && cornered(cells, w, nb)) continue;
          bs = bs.slice();
          bs[hit] = nb;
          bs.sort(byNum);
          if (bs.every((c) => isTarget[c])) return depth;
        }
        const k = keyOf(np, bs);
        if (seen.has(k)) continue;
        seen.add(k);
        if (seen.size > SOLVER_LIMIT) return -1;
        next.push({ p: np, b: bs });
      }
    }
    frontier = next;
  }
  return -1;
}

function buildLevel(n) {
  const rng = makeRng(save.salt + n * 7919 + save.swaps * 104729);
  const plan = levelPlan(n);
  let best = null;
  for (let i = 0; i < TRIES; i++) {
    const puz = tryPuzzle(rng, plan);
    if (puz && (!best || puz.score > best.score)) best = puz;
  }
  // tiny emergency room, in case every try failed (it basically never happens)
  while (!best) best = tryPuzzle(rng, { boxes: 1, w: 7, h: 6, pulls: 40 });

  const fewest = solvePuzzle(best);
  best.goal = fewest > 0 ? fewest + Math.ceil(fewest * 0.2) : best.par;
  best.goal2 = Math.round(best.goal * 1.6) + 4;
  return best;
}

// ---------- 4. saving ----------
let save = { level: 1, score: 0, salt: 0, swaps: 0, stars: {}, sound: true };
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.level) save = Object.assign(save, s);
  } catch (e) { /* no save yet */ }
  if (!save.salt) save.salt = 1 + Math.floor(Math.random() * 1e6);
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* the game still works without saving */ }
}

// ---------- 5. the game ----------
const $ = (id) => document.getElementById(id);
const canvas = $("view");
const ctx = canvas.getContext("2d");

const game = {
  state: "menu",  // menu, play, pause, clear
  level: 1,
  puz: null,
  player: 0,
  boxes: [],
  facing: 1,
  moves: 0,
  history: [],
  anim: { t: 1, from: 0, to: 0, box: -1, boxFrom: 0, boxTo: 0 },
  queued: -1,
  winTimer: 0,
  stuckShown: false,
  time: 0,
};
let particles = [];

function startLevel(n) {
  game.level = n;
  game.puz = buildLevel(n);
  resetBoard();
  game.state = "play";
  showOnly(null);
  document.body.classList.remove("in-menu");
  updateHud();
  layout();
  toast(n === 1 ? "Push the crates onto the pads!" : "Level " + n);
}

function resetBoard() {
  game.player = game.puz.player;
  game.boxes = game.puz.boxes.slice();
  game.moves = 0;
  game.history = [];
  game.anim.t = 1;
  game.queued = -1;
  game.winTimer = 0;
  game.stuckShown = false;
  particles = [];
}

const isTarget = (c) => game.puz.targets.includes(c);
const boxAt = (c) => game.boxes.indexOf(c);

function tryMove(d) {
  if (game.state !== "play" || game.winTimer) return;
  if (game.anim.t < 1) { game.queued = d; return; }
  const puz = game.puz;
  const off = offsets(puz.w);
  const next = game.player + off[d];
  game.facing = d;
  if (puz.cells[next] === WALL) { sfx("bump"); return; }

  const id = boxAt(next);
  if (id >= 0) {
    const beyond = next + off[d];
    if (puz.cells[beyond] === WALL || boxAt(beyond) >= 0) { sfx("bump"); return; }
  }
  game.history.push({ player: game.player, boxes: game.boxes.slice(), moves: game.moves, facing: game.facing });
  game.anim = { t: 0, from: game.player, to: next, box: -1, boxFrom: 0, boxTo: 0 };
  game.player = next;
  game.moves++;

  if (id >= 0) {
    const beyond = next + off[d];
    game.anim.box = id;
    game.anim.boxFrom = next;
    game.anim.boxTo = beyond;
    game.boxes[id] = beyond;
    if (isTarget(beyond)) {
      sfx("pad");
      sparkle(beyond, "#7dffb0");
    } else {
      sfx("push");
    }
    checkBoard();
  } else {
    sfx("step");
  }
  updateHud();
}

function checkBoard() {
  if (game.boxes.every(isTarget)) {
    game.winTimer = 0.7;
    sfx("win");
    game.puz.targets.forEach((t) => sparkle(t, "#ffe36b"));
    return;
  }
  const { cells, w } = game.puz;
  if (!game.stuckShown && game.boxes.some((c) => !isTarget(c) && cornered(cells, w, c))) {
    game.stuckShown = true;
    sfx("stuck");
    toast("Uh oh, a crate is stuck! Press ↶ to undo");
  }
}

function undo() {
  if (game.state !== "play" || game.winTimer) return;
  const last = game.history.pop();
  if (!last) return;
  game.player = last.player;
  game.boxes = last.boxes;
  game.moves = last.moves;
  game.facing = last.facing;
  game.anim.t = 1;
  game.queued = -1;
  game.stuckShown = false;
  sfx("undo");
  updateHud();
}

function restart() {
  if (game.state !== "play") return;
  resetBoard();
  sfx("undo");
  updateHud();
}

function finishLevel() {
  const puz = game.puz;
  const stars = game.moves <= puz.goal ? 3 : game.moves <= puz.goal2 ? 2 : 1;
  const old = save.stars[game.level] || 0;
  let points;
  if (game.level === save.level) {
    points = 100 * puz.boxes.length + 10 * game.level + 50 * stars;
    save.level++;
    save.swaps = 0;
  } else {
    points = 50 * Math.max(0, stars - old);
  }
  save.stars[game.level] = Math.max(old, stars);
  save.score += points;
  writeSave();

  game.state = "clear";
  $("clear-stars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
  let text = `You did it in <b>${game.moves}</b> moves.`;
  text += stars < 3 ? ` Do it in <b>${puz.goal}</b> or fewer for 3 stars!` : " Super smart!";
  text += points ? `<br>+${points} points` : "";
  $("clear-text").innerHTML = text;
  showOnly("clear-screen");
  updateHud();
}

function nextLevel() { startLevel(save.level); }

// ---------- 6. screens and HUD ----------
function showOnly(id) {
  for (const s of ["title-screen", "pause-screen", "clear-screen"]) $(s).classList.toggle("hidden", s !== id);
}

function showTitle() {
  game.state = "menu";
  document.body.classList.add("in-menu");
  showOnly("title-screen");
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $("progress-text").innerHTML = save.level > 1
    ? `You're on <b>level ${save.level}</b> with <b>${save.score}</b> points and <b>${total}</b> ⭐`
    : "";
  $("play").textContent = save.level > 1 ? `▶ Play level ${save.level}` : "▶ Play";
  $("reset").classList.toggle("hidden", save.level <= 1);
}

function pause() {
  if (game.state !== "play") return;
  game.state = "pause";
  showOnly("pause-screen");
}
function resume() {
  if (game.state !== "pause") return;
  game.state = "play";
  showOnly(null);
}

function updateHud() {
  $("level-label").textContent = "Level " + game.level;
  $("moves").textContent = game.moves;
  $("goal").textContent = game.puz ? game.puz.goal : 0;
  $("score").textContent = save.score;
  $("sound-btn").textContent = save.sound ? "🔊" : "🔇";
}

let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- 7. drawing ----------
const view = { w: 0, h: 0, tile: 40, ox: 0, oy: 0 };
const stars = Array.from({ length: 180 }, (_, i) => ({
  x: (hash(i) % 10000) / 10000,
  y: (hash(i + 999) % 10000) / 10000,
  r: 0.4 + (hash(i + 77) % 100) / 70,
  phase: (hash(i + 5) % 628) / 100,
}));

function layout() {
  const dpr = window.devicePixelRatio || 1;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!game.puz) return;

  const { w, h, cells } = game.puz;
  // only show the part of the map near the floor
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== FLOOR) continue;
    const x = i % w, y = Math.floor(i / w);
    x0 = Math.min(x0, x - 1); x1 = Math.max(x1, x + 1);
    y0 = Math.min(y0, y - 1); y1 = Math.max(y1, y + 1);
  }
  const touch = !$("touch").classList.contains("hidden");
  // leave room for the HUD at the top (it can wrap onto 2 rows on a phone) and the buttons at the bottom
  const top = Math.max(64, $("hud-top").getBoundingClientRect().bottom + 12);
  const bottom = touch ? 200 : 20, side = 16;
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  view.tile = Math.max(12, Math.min(MAX_TILE,
    Math.floor((view.w - side * 2) / cols), Math.floor((view.h - top - bottom) / rows)));
  view.ox = Math.round((view.w - cols * view.tile) / 2) - x0 * view.tile;
  view.oy = Math.round(top + (view.h - top - bottom - rows * view.tile) / 2) - y0 * view.tile;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const cellX = (c) => view.ox + (c % game.puz.w) * view.tile;
const cellY = (c) => view.oy + Math.floor(c / game.puz.w) * view.tile;

function drawSpace() {
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, "#070a1c");
  g.addColorStop(1, "#1a0f3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
  // two soft nebula clouds
  for (const [fx, fy, col] of [[0.18, 0.3, "rgba(255, 90, 200, 0.16)"], [0.85, 0.75, "rgba(70, 160, 255, 0.16)"]]) {
    const r = Math.max(view.w, view.h) * 0.45;
    const n = ctx.createRadialGradient(view.w * fx, view.h * fy, 0, view.w * fx, view.h * fy, r);
    n.addColorStop(0, col);
    n.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = n;
    ctx.fillRect(0, 0, view.w, view.h);
  }
  for (const s of stars) {
    ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(game.time * 1.3 + s.phase));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x * view.w, s.y * view.h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // a ringed planet far away
  const px = view.w * 0.9, py = view.h * 0.16, pr = Math.min(view.w, view.h) * 0.07;
  ctx.fillStyle = "#ff8ad8";
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath(); ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255, 209, 241, 0.8)";
  ctx.lineWidth = Math.max(2, pr * 0.12);
  ctx.beginPath(); ctx.ellipse(px, py, pr * 1.7, pr * 0.35, -0.3, 0, Math.PI * 2); ctx.stroke();
}

const ROCK = ["#5d4f7c", "#66588a", "#544770"];
function drawRock(c) {
  const t = view.tile, x = cellX(c), y = cellY(c), r = hash(c);
  ctx.fillStyle = "#2b2244";
  roundRect(x, y + t * 0.06, t, t, t * 0.26);
  ctx.fill();
  ctx.fillStyle = ROCK[r % 3];
  roundRect(x + 1, y + 1, t - 2, t - 4, t * 0.26);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  roundRect(x + t * 0.14, y + t * 0.1, t * 0.5, t * 0.16, t * 0.08);
  ctx.fill();
  // craters
  ctx.fillStyle = "rgba(20, 12, 40, 0.35)";
  for (let k = 0; k < 2; k++) {
    const cx = x + t * (0.25 + ((r >> (k * 4)) % 10) / 20);
    const cy = y + t * (0.4 + ((r >> (k * 4 + 8)) % 8) / 20);
    ctx.beginPath();
    ctx.arc(cx, cy, t * (0.07 + k * 0.04), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloor(c) {
  const t = view.tile, x = cellX(c), y = cellY(c);
  ctx.fillStyle = "#252d4d";
  ctx.fillRect(x, y, t, t);
  ctx.fillStyle = "#2f3960";
  roundRect(x + t * 0.06, y + t * 0.06, t * 0.88, t * 0.88, t * 0.1);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (const [a, b] of [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]]) {
    ctx.beginPath();
    ctx.arc(x + t * a, y + t * b, t * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPad(c) {
  const t = view.tile, x = cellX(c) + t / 2, y = cellY(c) + t / 2;
  const glow = 0.6 + 0.4 * Math.sin(game.time * 3 + c);
  ctx.save();
  ctx.shadowColor = "#4ff0ff";
  ctx.shadowBlur = t * 0.35 * glow;
  ctx.strokeStyle = `rgba(79, 240, 255, ${0.6 + 0.4 * glow})`;
  ctx.lineWidth = t * 0.07;
  ctx.beginPath(); ctx.arc(x, y, t * 0.32, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(79, 240, 255, 0.18)";
  ctx.beginPath(); ctx.arc(x, y, t * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(79, 240, 255, 0.8)";
  ctx.beginPath(); ctx.arc(x, y, t * 0.06, 0, Math.PI * 2); ctx.fill();
}

function drawCrate(px, py, onPad) {
  const t = view.tile, s = t * 0.8, x = px + (t - s) / 2, y = py + (t - s) / 2;
  ctx.save();
  if (onPad) { ctx.shadowColor = "#7dffb0"; ctx.shadowBlur = t * 0.4; }
  ctx.fillStyle = onPad ? "#2a9c55" : "#b8641a";
  roundRect(x, y, s, s, s * 0.14);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = onPad ? "#5be38a" : "#f39a2b";
  roundRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, s * 0.06);
  ctx.fill();
  ctx.strokeStyle = onPad ? "#2a9c55" : "#b8641a";
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.16, y + s * 0.16); ctx.lineTo(x + s * 0.84, y + s * 0.84);
  ctx.moveTo(x + s * 0.84, y + s * 0.16); ctx.lineTo(x + s * 0.16, y + s * 0.84);
  ctx.stroke();
  // a little glowing light on top
  ctx.fillStyle = onPad ? "#eafff1" : "#ffe36b";
  ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.1, 0, Math.PI * 2); ctx.fill();
}

function drawCosmo(px, py) {
  const t = view.tile, d = game.facing;
  const cx = px + t / 2, cy = py + t / 2 + Math.sin(game.time * 5) * t * 0.025;
  const fx = DX[d], fy = DY[d];
  // jetpack on the back
  ctx.fillStyle = "#9aa6c8";
  roundRect(cx - fx * t * 0.26 - t * 0.12, cy - fy * t * 0.26 - t * 0.12, t * 0.24, t * 0.24, t * 0.06);
  ctx.fill();
  // little flame from the jetpack
  ctx.fillStyle = `rgba(255, 150, 60, ${0.5 + 0.5 * Math.random()})`;
  ctx.beginPath();
  ctx.arc(cx - fx * t * 0.4, cy - fy * t * 0.4 + (fy === 0 ? t * 0.06 : 0), t * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // body and helmet
  ctx.fillStyle = "#c8d0ea";
  ctx.beginPath(); ctx.arc(cx, cy + t * 0.03, t * 0.31, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f4f6ff";
  ctx.beginPath(); ctx.arc(cx, cy, t * 0.29, 0, Math.PI * 2); ctx.fill();
  // visor looks the way Cosmo is facing
  ctx.fillStyle = "#4fc3ff";
  ctx.beginPath();
  ctx.ellipse(cx + fx * t * 0.1, cy + fy * t * 0.1 - t * 0.02, t * 0.17, t * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.ellipse(cx + fx * t * 0.1 + t * 0.06, cy + fy * t * 0.1 - t * 0.07, t * 0.05, t * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  // antenna with a blinking light
  ctx.strokeStyle = "#9aa6c8";
  ctx.lineWidth = Math.max(1, t * 0.03);
  ctx.beginPath(); ctx.moveTo(cx - t * 0.08, cy - t * 0.26); ctx.lineTo(cx - t * 0.12, cy - t * 0.42); ctx.stroke();
  ctx.fillStyle = Math.sin(game.time * 6) > 0 ? "#ff5d73" : "#7a2a3a";
  ctx.beginPath(); ctx.arc(cx - t * 0.12, cy - t * 0.43, t * 0.05, 0, Math.PI * 2); ctx.fill();
}

const ease = (k) => 1 - (1 - k) * (1 - k);
function lerpCell(a, b, k) {
  return [cellX(a) + (cellX(b) - cellX(a)) * k, cellY(a) + (cellY(b) - cellY(a)) * k];
}

function draw() {
  ctx.clearRect(0, 0, view.w, view.h);
  drawSpace();
  if (!game.puz || game.state === "menu") return;
  const { w, cells, targets } = game.puz;

  // rocks first, only the ones touching the floor, so the base looks like a lumpy asteroid
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== WALL) continue;
    const x = i % w;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, n = i + dy * w + dx;
        if (nx >= 0 && nx < w && n >= 0 && n < cells.length && cells[n] === FLOOR) { near = true; break; }
      }
    }
    if (near) drawRock(i);
  }
  for (let i = 0; i < cells.length; i++) if (cells[i] === FLOOR) drawFloor(i);
  targets.forEach(drawPad);

  const k = ease(game.anim.t);
  game.boxes.forEach((c, id) => {
    const moving = id === game.anim.box && game.anim.t < 1;
    const [x, y] = moving ? lerpCell(game.anim.boxFrom, game.anim.boxTo, k) : [cellX(c), cellY(c)];
    drawCrate(x, y, !moving && isTarget(c));
  });
  const [px, py] = game.anim.t < 1 ? lerpCell(game.anim.from, game.anim.to, k) : [cellX(game.player), cellY(game.player)];
  drawCosmo(px, py);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function sparkle(c, color) {
  const t = view.tile, x = cellX(c) + t / 2, y = cellY(c) + t / 2;
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, sp = t * (1 + Math.random() * 2.5);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: t * (0.03 + Math.random() * 0.05), color });
  }
}

// ---------- 8. the main loop ----------
let lastTime = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  game.time += dt;

  if (game.state === "play") {
    if (game.anim.t < 1) {
      game.anim.t = Math.min(1, game.anim.t + dt / STEP_TIME);
      if (game.anim.t >= 1 && game.queued >= 0) {
        const d = game.queued;
        game.queued = -1;
        tryMove(d);
      }
    }
    if (game.winTimer) {
      game.winTimer -= dt;
      if (game.winTimer <= 0) { game.winTimer = 0; finishLevel(); }
    }
  }
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt * 1.4;
  }
  particles = particles.filter((p) => p.life > 0);

  draw();
  requestAnimationFrame(frame);
}

// ---------- 9. sound and music ----------
let audio = null, master = null;
const music = { timer: 0, next: 0, beat: 0 };
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

function startAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.connect(audio.destination);
  }
  if (audio.state === "suspended") audio.resume();
  master.gain.value = save.sound ? 1 : 0;
  if (!music.timer) {
    music.next = audio.currentTime + 0.2;
    music.timer = setInterval(scheduleMusic, 120);
  }
}

function note(freq, when, dur, type, vol, slideTo) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(master);
  o.start(when);
  o.stop(when + dur + 0.05);
}

// a slow dreamy tune that plays forever
function scheduleMusic() {
  const pattern = [0, 2, 4, 5, 4, 2, 3, 1];
  while (music.next < audio.currentTime + 0.5) {
    const b = music.beat++;
    const lift = Math.floor(b / 16) % 2;
    note(SCALE[pattern[b % 8] + lift], music.next, 0.9, "sine", 0.035);
    if (b % 8 === 0) note(lift ? 98 : 110, music.next, 3.4, "triangle", 0.045);
    music.next += 0.42;
  }
}

function sfx(name) {
  if (!audio || !save.sound) return;
  const t = audio.currentTime;
  switch (name) {
    case "step": note(520, t, 0.05, "square", 0.025); break;
    case "push": note(150, t, 0.16, "triangle", 0.18, 90); break;
    case "bump": note(90, t, 0.1, "sawtooth", 0.05); break;
    case "pad": note(660, t, 0.18, "sine", 0.15); note(990, t + 0.09, 0.25, "sine", 0.15); break;
    case "undo": note(700, t, 0.15, "sine", 0.07, 300); break;
    case "stuck": note(300, t, 0.18, "triangle", 0.12, 200); note(200, t + 0.18, 0.3, "triangle", 0.12, 120); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.1, 0.35, "square", 0.06)); break;
  }
}

function toggleSound() {
  save.sound = !save.sound;
  writeSave();
  if (master) master.gain.value = save.sound ? 1 : 0;
  updateHud();
}

// ---------- 10. controls ----------
const KEY_DIRS = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
};

window.addEventListener("keydown", (e) => {
  startAudio();
  if (e.code in KEY_DIRS) {
    e.preventDefault();
    tryMove(KEY_DIRS[e.code]);
  } else if (e.code === "KeyZ" || e.code === "KeyU" || e.code === "Backspace") {
    e.preventDefault();
    undo();
  } else if (e.code === "KeyR") {
    restart();
  } else if (e.code === "KeyM") {
    toggleSound();
  } else if (e.code === "Escape" || e.code === "KeyP") {
    if (game.state === "play") pause(); else resume();
  } else if (e.code === "Enter" && game.state === "clear") {
    nextLevel();
  }
});

// swipe on the screen to move
let swipe = null;
canvas.addEventListener("pointerdown", (e) => { startAudio(); swipe = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : 3); else tryMove(dy > 0 ? 2 : 0);
});

// the on-screen arrow buttons: hold one down to keep walking
let holdTimer = 0;
document.querySelectorAll(".dpad button").forEach((b) => {
  const d = Number(b.dataset.dir);
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startAudio();
    tryMove(d);
    clearInterval(holdTimer);
    holdTimer = setInterval(() => tryMove(d), 180);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => clearInterval(holdTimer));
});

const click = (id, fn) => $(id).addEventListener("click", () => { startAudio(); fn(); });
click("play", () => startLevel(save.level));
click("reset", () => {
  if (!confirm("Start over from level 1? Your score and stars will go back to 0.")) return;
  save = { level: 1, score: 0, salt: 1 + Math.floor(Math.random() * 1e6), swaps: 0, stars: {}, sound: save.sound };
  writeSave();
  showTitle();
});
click("undo-btn", undo);
click("touch-undo", undo);
click("restart-btn", restart);
click("sound-btn", toggleSound);
click("pause-btn", pause);
click("resume", resume);
click("pause-title", () => { writeSave(); showTitle(); });
click("swap", () => {
  save.swaps++;
  writeSave();
  startLevel(game.level);
});
click("next", nextLevel);
click("again", () => {
  game.state = "play";
  showOnly(null);
  resetBoard();
  updateHud();
});

if (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) $("touch").classList.remove("hidden");
window.addEventListener("resize", layout);

// ---------- 11. start! ----------
loadSave();
layout();
showTitle();
requestAnimationFrame(frame);
