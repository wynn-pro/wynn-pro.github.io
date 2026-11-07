// Jungle Jam: a sliding-block puzzle game with 36 puzzles in 3 zones.
// Mango the monkey needs to roll a cart of bananas out through the gate, but logs and stone pillars
// are in the way. Sideways blocks slide left and right, standing-up blocks slide up and down.
// Everything you see is drawn by this code with the canvas, so there are no picture files at all.
// The puzzles themselves live in levels.js.
"use strict";

// ---------- 1. numbers you can change ----------
const N = 6;                 // the board is 6 squares by 6 squares
const EXIT_ROW = 2;          // the gate is on the right side of this row (rows count from 0 at the top)
const GOAL = N - 2;          // the cart is free when its left end reaches this column
const PER_ZONE = 12;         // puzzles in each zone
const SLIDE_SPEED = 18;      // how quickly blocks glide into place (bigger = snappier)
const SAVE_KEY = "junglejam-save";

// ---------- 2. the 3 zones ----------
const ZONES = [
  { name: "Riverbank", icon: "🌊", floor: ["#dcbb7e", "#d0ac6c"], frame: "#7a4f26", frameDark: "#4f3014",
    sky: ["#57b874", "#1f6b3a"] },
  { name: "Deep Jungle", icon: "🌿", floor: ["#6a9c48", "#5d8c3f"], frame: "#5a3a1c", frameDark: "#33200d",
    sky: ["#2f7a46", "#0f3320"] },
  { name: "Lost Temple", icon: "🗿", floor: ["#b3ad9e", "#a49e90"], frame: "#6d6a62", frameDark: "#3e3c37",
    sky: ["#3d6b4f", "#142a1e"] },
];

// ---------- 3. reading a puzzle ----------
// A level is 36 letters. Every letter is one block: "A" is Mango's cart, a 3-long block is a stone
// pillar, and everything else is a log. If the 2nd square is right next to the 1st, it lies sideways.
function parseLevel(grid) {
  const squares = {};
  for (let i = 0; i < N * N; i++) {
    if (grid[i] !== ".") (squares[grid[i]] = squares[grid[i]] || []).push(i);
  }
  return Object.keys(squares).sort().map((ch) => {
    const s = squares[ch];
    const h = s[1] - s[0] === 1;
    const row = Math.floor(s[0] / N), col = s[0] % N;
    return {
      h,
      len: s.length,
      fixed: h ? row : col,   // the row (or column) it can never leave
      start: h ? col : row,   // where along that row (or column) it starts
      kind: ch === "A" ? "cart" : s.length === 3 ? "stone" : "log",
      shade: ch.charCodeAt(0) % 5,
    };
  });
}

// ---------- 4. board rules ----------
// A block's position is just one number: how far along its row (or column) its first square is.
function squareOf(p, k) { return p.h ? p.fixed * N + k : k * N + p.fixed; }

function takenSquares(at) {
  const taken = new Array(N * N).fill(false);
  pieces.forEach((p, i) => { for (let k = 0; k < p.len; k++) taken[squareOf(p, at[i] + k)] = true; });
  return taken;
}

// how far can block i slide each way before it bumps into something?
function slideRange(at, i, taken = takenSquares(at)) {
  const p = pieces[i];
  let min = at[i], max = at[i];
  while (min > 0 && !taken[squareOf(p, min - 1)]) min--;
  while (max + p.len < N && !taken[squareOf(p, max + p.len)]) max++;
  return { min, max };
}

// ---------- 5. the hint finder ----------
// Tries every possible move, then every move after those, and so on (a "breadth-first search").
// The first time it finds the cart at the gate, it has found the shortest way. It gives back the list
// of moves, and the hint is just the first one.
function solve(start) {
  const key = (at) => at.reduce((k, v) => k * N + v, 0);
  const came = new Map([[key(start), null]]);
  let layer = [start];
  while (layer.length) {
    const next = [];
    for (const at of layer) {
      if (at[0] === GOAL) {
        const path = [];
        for (let step = came.get(key(at)); step; step = came.get(key(step.prev))) path.unshift(step);
        return path;
      }
      const taken = takenSquares(at);
      for (let i = 0; i < pieces.length; i++) {
        const { min, max } = slideRange(at, i, taken);
        for (let to = min; to <= max; to++) {
          if (to === at[i]) continue;
          const n = at.slice();
          n[i] = to;
          const k = key(n);
          if (!came.has(k)) { came.set(k, { prev: at, piece: i, to }); next.push(n); }
        }
      }
    }
    layer = next;
  }
  return null;
}

// ---------- 6. saving ----------
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.unlocked === "number") return { unlocked: s.unlocked, best: s.best || {}, sound: s.sound !== false };
  } catch (e) { /* no save yet */ }
  return { unlocked: 1, best: {}, sound: true };
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* the game still works without saving */ }
}

// ---------- 7. the game's state ----------
const $ = (id) => document.getElementById(id);
const canvas = $("view");
const ctx = canvas.getContext("2d");
let save = loadSave();
let screen = "title";
let levelIndex = 0;
let pieces = [];     // the blocks of this puzzle
let pos = [];        // where each block really is
let shown = [];      // where each block is drawn (it glides towards pos)
let history = [];    // every move, so Undo can take it back
let moves = 0, hintsUsed = 0;
let selected = -1;   // the block the arrow keys move
let drag = null;     // the block your finger or mouse is holding
let hint = null;     // { piece, to } while a hint is showing
let won = 0;         // counts up while the cart rolls out of the gate
let particles = [];
let clock = 0, lastTime = 0;
let toastTimer = 0;

function zoneOf(i) { return ZONES[Math.floor(i / PER_ZONE)]; }

function loadLevel(i) {
  levelIndex = i;
  pieces = parseLevel(LEVELS[i].grid);
  pos = pieces.map((p) => p.start);
  shown = pos.slice();
  history = [];
  moves = 0;
  hintsUsed = 0;
  selected = -1;
  drag = null;
  hint = null;
  won = 0;
  particles = [];
  updateHud();
}

function moveBlock(i, to) {
  if (won || to === pos[i]) return;
  const last = history[history.length - 1];
  if (last && last.piece === i) {
    // sliding the same block again straight away still counts as one move,
    // and sliding it right back to where it was takes that move away
    if (to === last.from) { history.pop(); moves--; }
  } else {
    history.push({ piece: i, from: pos[i] });
    moves++;
  }
  pos[i] = to;
  hint = null;
  sfx.slide();
  if (pos[0] === GOAL) winLevel();
  updateHud();
}

function undo() {
  if (won || !history.length) return;
  const { piece, from } = history.pop();
  pos[piece] = from;
  moves--;
  hint = null;
  selected = piece;
  sfx.undo();
  updateHud();
}

function restart() {
  if (won) return;
  const used = hintsUsed;
  loadLevel(levelIndex);
  hintsUsed = used;  // starting again doesn't wipe out the hints you already used
  updateHud();
  sfx.undo();
}

function showHint() {
  if (won) return;
  if (hint) {
    // pressing Hint again: Mango does the move for you
    moveBlock(hint.piece, hint.to);
    return;
  }
  const path = solve(pos);
  if (!path || !path.length) return;
  hint = path[0];
  hintsUsed++;
  selected = hint.piece;
  toast("Slide the glowing block! Press Hint again and Mango will do it.");
  sfx.hint();
  updateHud();
}

function winLevel() {
  won = 0.001;
  drag = null;
  selected = -1;
  const best = save.best[levelIndex];
  if (best === undefined || moves < best) save.best[levelIndex] = moves;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  writeSave();
  sfx.win();
}

function showClear() {
  const par = LEVELS[levelIndex].par;
  if (levelIndex === LEVELS.length - 1) {
    const perfect = LEVELS.filter((l, i) => save.best[i] !== undefined && save.best[i] <= l.par).length;
    $("end-text").innerHTML = `Mango got every cart out of the jungle! You solved all <b>${LEVELS.length}</b> puzzles, ` +
      `and <b>${perfect}</b> of them in the fewest moves possible. 🍌`;
    showScreen("end");
    return;
  }
  const perfect = moves <= par;
  $("clear-title").innerHTML = perfect ? "PERFECT <span>SOLVE!</span>" : "YOU <span>DID IT!</span>";
  let text = `You got Mango out in <b>${moves}</b> move${moves === 1 ? "" : "s"}.`;
  text += perfect ? " That's the fewest possible! 🌟" : ` The fewest possible is <b>${par}</b>. Can you do it?`;
  if (hintsUsed) text += ` You used ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"}.`;
  $("clear-text").innerHTML = text;
  $("clear-retry").classList.toggle("hidden", perfect);
  showScreen("clear");
}

// ---------- 8. screens, HUD and buttons ----------
const OVERLAYS = ["title", "map", "pause", "clear", "end"];

function showScreen(name) {
  screen = name;
  OVERLAYS.forEach((s) => $(s + "-screen").classList.toggle("hidden", s !== name));
  document.body.classList.toggle("in-menu", name !== "play");
  if (name === "map") buildMap();
}

function startLevel(i) {
  ensureAudio();
  loadLevel(i);
  showScreen("play");
  toast(i === 0 ? "Slide the logs so Mango's cart can roll out the gate! ➜" : `${zoneOf(i).name} ${(i % PER_ZONE) + 1}`);
}

function updateHud() {
  $("level-label").textContent = `${zoneOf(levelIndex).name} ${(levelIndex % PER_ZONE) + 1}`;
  $("moves").textContent = moves;
  $("par").textContent = LEVELS[levelIndex].par;
  $("hints").textContent = hintsUsed;
  $("undo-btn").disabled = !history.length;
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function buildMap() {
  const map = $("map");
  map.innerHTML = "";
  ZONES.forEach((z, zi) => {
    const box = document.createElement("div");
    box.innerHTML = `<div class="zone-name">${z.icon} ${z.name}</div>`;
    const row = document.createElement("div");
    row.className = "zone-levels";
    for (let k = 0; k < PER_ZONE; k++) {
      const i = zi * PER_ZONE + k;
      const best = save.best[i];
      const perfect = best !== undefined && best <= LEVELS[i].par;
      const b = document.createElement("button");
      b.className = "lvl" + (perfect ? " perfect" : best !== undefined ? " done" : "");
      b.disabled = i >= save.unlocked;
      b.innerHTML = `${k + 1}<small>${perfect ? "🌟 " + best : best !== undefined ? "✓ " + best : b.disabled ? "🔒" : ""}</small>`;
      b.onclick = () => startLevel(i);
      row.appendChild(b);
    }
    box.appendChild(row);
    map.appendChild(box);
  });
}

$("play").onclick = () => {
  ensureAudio();
  if (save.unlocked === 1 && save.best[0] === undefined) startLevel(0);
  else showScreen("map");
};
$("map-back").onclick = () => showScreen("title");
$("resume").onclick = () => showScreen("play");
$("pause-map").onclick = () => showScreen("map");
$("next").onclick = () => startLevel(Math.min(levelIndex + 1, LEVELS.length - 1));
$("clear-retry").onclick = () => startLevel(levelIndex);
$("clear-map").onclick = () => showScreen("map");
$("end-map").onclick = () => showScreen("map");
$("undo-btn").onclick = undo;
$("hint-btn").onclick = showHint;
$("restart-btn").onclick = restart;
$("menu-btn").onclick = () => showScreen("pause");

// ---------- 9. dragging blocks with a mouse or finger ----------
const board = { x: 0, y: 0, cell: 60 };

function blockAt(x, y) {
  const c = Math.floor((x - board.x) / board.cell), r = Math.floor((y - board.y) / board.cell);
  if (c < 0 || c >= N || r < 0 || r >= N) return -1;
  return pieces.findIndex((p, i) => {
    for (let k = 0; k < p.len; k++) if (squareOf(p, pos[i] + k) === r * N + c) return true;
    return false;
  });
}

canvas.addEventListener("pointerdown", (e) => {
  if (screen !== "play" || won) return;
  const i = blockAt(e.clientX, e.clientY);
  selected = i;
  if (i < 0) return;
  ensureAudio();
  const { min, max } = slideRange(pos, i);
  drag = { i, x: e.clientX, y: e.clientY, from: pos[i], min, max };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag) {
    canvas.style.cursor = screen === "play" && blockAt(e.clientX, e.clientY) >= 0 ? "grab" : "default";
    return;
  }
  canvas.style.cursor = "grabbing";
  const along = pieces[drag.i].h ? e.clientX - drag.x : e.clientY - drag.y;
  shown[drag.i] = Math.max(drag.min, Math.min(drag.max, drag.from + along / board.cell));
});

function letGo() {
  if (!drag) return;
  const i = drag.i;
  drag = null;
  moveBlock(i, Math.round(shown[i]));
}
canvas.addEventListener("pointerup", letGo);
canvas.addEventListener("pointercancel", letGo);

// ---------- 10. the keyboard ----------
const ARROWS = { ArrowLeft: [-1, true], ArrowRight: [1, true], ArrowUp: [-1, false], ArrowDown: [1, false] };

addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "m" || k === "M") { save.sound = !save.sound; writeSave(); toast(save.sound ? "🔊 Sound on" : "🔇 Sound off"); return; }
  if (screen === "clear" && k === "Enter") { $("next").click(); return; }
  if (screen === "pause" && (k === "Escape" || k === "p" || k === "P")) { showScreen("play"); return; }
  if (screen !== "play") return;
  if (k === "Escape" || k === "p" || k === "P") showScreen("pause");
  else if (k === "u" || k === "U" || ((k === "z" || k === "Z") && (e.ctrlKey || e.metaKey))) undo();
  else if (k === "r" || k === "R") restart();
  else if (k === "h" || k === "H") showHint();
  else if (k === "Tab") {
    e.preventDefault();
    selected = (selected + (e.shiftKey ? pieces.length - 1 : 1) + pieces.length) % pieces.length;
  } else if (ARROWS[k]) {
    e.preventDefault();
    if (won) return;
    if (selected < 0) selected = 0;
    const [step, sideways] = ARROWS[k];
    const { min, max } = slideRange(pos, selected);
    const to = pos[selected] + step;
    if (sideways !== pieces[selected].h || to < min || to > max) { sfx.bonk(); return; }
    moveBlock(selected, to);
  }
});

// ---------- 11. drawing ----------
let W = 0, H = 0;
let leaves = [];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = 60, bottom = 80;  // room for the HUD and the buttons
  const size = Math.min(W - 24, H - top - bottom);
  board.cell = Math.floor(size / (N + 1));  // a bit extra for the frame and the gate
  board.x = Math.round((W - board.cell * N) / 2 - board.cell * 0.25);
  board.y = Math.round(top + (H - top - bottom - board.cell * N) / 2);
  makeLeaves();
}
addEventListener("resize", resize);

// the jungle leaves round the edge are the same every time, thanks to a "seeded" random number
function makeLeaves() {
  let s = 7;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  leaves = [];
  for (let i = 0; i < 48; i++) {
    const side = i % 4;
    leaves.push({
      x: side === 2 ? r() * 80 : side === 3 ? W - r() * 80 : r() * W,
      y: side === 0 ? r() * 60 : side === 1 ? H - r() * 60 : r() * H,
      a: r() * Math.PI * 2,
      size: 34 + r() * 56,
      shade: r(),
    });
  }
}

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawLeaf(g, x, y, size, a, shade) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = `hsl(${105 + shade * 35}, ${45 + shade * 20}%, ${20 + shade * 18}%)`;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(size * 0.5, -size * 0.36, size, 0);
  g.quadraticCurveTo(size * 0.5, size * 0.36, 0, 0);
  g.fill();
  g.strokeStyle = "rgba(255, 255, 255, 0.18)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(size * 0.9, 0);
  g.stroke();
  g.restore();
}

function drawBackground(z) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, z.sky[0]);
  g.addColorStop(1, z.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sunbeams poking through the trees
  ctx.fillStyle = "rgba(255, 250, 200, 0.05)";
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + i * 0.3) + Math.sin(clock * 0.3 + i) * 20;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 60, 0);
    ctx.lineTo(x + 260, H);
    ctx.lineTo(x + 120, H);
    ctx.fill();
  }
  leaves.forEach((l, i) => drawLeaf(ctx, l.x, l.y, l.size, l.a + Math.sin(clock * 0.8 + i) * 0.06, l.shade));
}

function drawBoard(z) {
  const { x, y, cell } = board, S = cell * N, f = Math.round(cell * 0.3);
  const gy = y + EXIT_ROW * cell;
  // the frame round the board
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  rr(ctx, x - f, y - f + 10, S + f * 2, S + f * 2, f);
  ctx.fill();
  ctx.fillStyle = z.frameDark;
  rr(ctx, x - f, y - f + 5, S + f * 2, S + f * 2, f);
  ctx.fill();
  ctx.fillStyle = z.frame;
  rr(ctx, x - f, y - f, S + f * 2, S + f * 2, f);
  ctx.fill();
  // the ground squares
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = z.floor[(r + c) % 2];
      ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 1.5, y - 1.5, S + 3, S + 3);
  // the gate: a gap in the frame, a path going out, and two posts
  ctx.fillStyle = z.floor[(EXIT_ROW + N - 1) % 2];
  ctx.fillRect(x + S - 2, gy, f + 4, cell);
  const path = ctx.createLinearGradient(x + S + f, 0, x + S + f + cell * 1.4, 0);
  path.addColorStop(0, z.floor[0]);
  path.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = path;
  ctx.fillRect(x + S + f, gy, cell * 1.4, cell);
  ctx.fillStyle = "#3d2410";
  [gy - f * 0.7, gy + cell - f * 0.3].forEach((py) => {
    rr(ctx, x + S - f * 0.15, py, f * 1.3, f, f * 0.25);
    ctx.fill();
  });
  ctx.fillStyle = "#ffd23f";
  [gy - f * 0.7, gy + cell - f * 0.3].forEach((py) => {
    ctx.beginPath();
    ctx.arc(x + S + f * 0.5, py + f * 0.5, f * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // a bouncing arrow showing the way out
  const ax = x + S + f + cell * 0.25 + Math.sin(clock * 4) * cell * 0.08, ay = gy + cell / 2;
  ctx.fillStyle = "rgba(255, 230, 100, 0.9)";
  ctx.beginPath();
  ctx.moveTo(ax, ay - cell * 0.18);
  ctx.lineTo(ax + cell * 0.28, ay);
  ctx.lineTo(ax, ay + cell * 0.18);
  ctx.fill();
}

const LOG_COLOURS = [["#a0683a", "#6e4320"], ["#b07640", "#774a24"], ["#94602f", "#5f3b1b"], ["#b8834a", "#7d5128"], ["#9c6534", "#664020"]];

// draws one block at x, y, w wide and h tall. g is the canvas to draw on, s is one square's size.
function drawPiece(g, p, x, y, w, h, s) {
  const pad = s * 0.07;
  x += pad; y += pad; w -= pad * 2; h -= pad * 2;
  const long = p.h ? w : h, short = p.h ? h : w;
  // shadow
  g.fillStyle = "rgba(0, 0, 0, 0.3)";
  rr(g, x + 2, y + 5, w, h, s * 0.18);
  g.fill();

  if (p.kind === "log") {
    const [light, dark] = LOG_COLOURS[p.shade];
    const grad = p.h ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, light);
    grad.addColorStop(1, dark);
    g.fillStyle = grad;
    rr(g, x, y, w, h, short * 0.45);
    g.fill();
    // bark lines
    g.strokeStyle = "rgba(60, 30, 10, 0.45)";
    g.lineWidth = Math.max(1.5, s * 0.03);
    for (let k = 1; k <= 3; k++) {
      const off = (short * k) / 4;
      g.beginPath();
      for (let t = short * 0.5; t <= long - short * 0.5; t += 4) {
        const wob = Math.sin(t * 0.09 + k * 2 + p.shade) * s * 0.025;
        if (p.h) g.lineTo(x + t, y + off + wob);
        else g.lineTo(x + off + wob, y + t);
      }
      g.stroke();
    }
    // the cut ends, with tree rings
    [short * 0.32, long - short * 0.32].forEach((e) => {
      const cx = p.h ? x + e : x + w / 2, cy = p.h ? y + h / 2 : y + e;
      const rx = p.h ? short * 0.2 : short * 0.38, ry = p.h ? short * 0.38 : short * 0.2;
      g.fillStyle = "#e6be82";
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#b8844a";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      g.stroke();
    });
    // some logs have a little sprout growing on them
    if (p.shade % 2) drawLeaf(g, p.h ? x + long / 2 : x + w * 0.4, p.h ? y + h * 0.4 : y + long / 2, s * 0.3, -0.9, 0.7);
  } else if (p.kind === "stone") {
    const grad = g.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "#a9a9a3");
    grad.addColorStop(1, "#6e6e68");
    g.fillStyle = grad;
    rr(g, x, y, w, h, s * 0.16);
    g.fill();
    g.strokeStyle = "#55554f";
    g.lineWidth = 3;
    g.stroke();
    // carved swirls, one on each square
    g.strokeStyle = "rgba(50, 50, 45, 0.55)";
    g.lineWidth = Math.max(2, s * 0.04);
    for (let k = 0; k < 3; k++) {
      const cx = p.h ? x + w * (k + 0.5) / 3 : x + w / 2, cy = p.h ? y + h / 2 : y + h * (k + 0.5) / 3;
      g.beginPath();
      for (let t = 0; t < 12; t += 0.3) g.lineTo(cx + Math.cos(t) * t * s * 0.022, cy + Math.sin(t) * t * s * 0.022);
      g.stroke();
    }
    // moss on top
    g.fillStyle = "#5fae3e";
    [[0.15, 0.1, 0.16], [0.35, 0.05, 0.12], [0.08, 0.3, 0.1]].forEach(([a, b, r]) => {
      g.beginPath();
      g.arc(x + w * a, y + h * b + s * 0.05, s * r, 0, Math.PI * 2);
      g.fill();
    });
  } else {
    drawCart(g, x, y, w, h, s);
  }
}

// Mango's banana cart: Mango on the left, a pile of bananas on the right
function drawCart(g, x, y, w, h, s) {
  // wheels peeking out at the top and bottom
  g.fillStyle = "#3a2410";
  [x + w * 0.2, x + w * 0.8].forEach((wx) => {
    rr(g, wx - s * 0.13, y - s * 0.05, s * 0.26, h + s * 0.1, s * 0.08);
    g.fill();
  });
  g.fillStyle = "#e0442a";
  rr(g, x, y, w, h, s * 0.16);
  g.fill();
  g.strokeStyle = "#ffd23f";
  g.lineWidth = Math.max(2, s * 0.05);
  rr(g, x + s * 0.06, y + s * 0.06, w - s * 0.12, h - s * 0.12, s * 0.12);
  g.stroke();
  // bananas
  const bx = x + w * 0.72, by = y + h * 0.5;
  for (let k = 0; k < 5; k++) {
    const a = -0.9 + k * 0.45, r = s * 0.24;
    const cx = bx + Math.cos(a + 1.6) * s * 0.08, cy = by + Math.sin(a + 1.6) * s * 0.08;
    g.strokeStyle = "#a07a00";
    g.lineWidth = s * 0.12;
    g.lineCap = "round";
    g.beginPath();
    g.arc(cx, cy - s * 0.04, r, a, a + 1.5);
    g.stroke();
    g.strokeStyle = "#ffe14a";
    g.lineWidth = s * 0.085;
    g.stroke();
  }
  g.lineCap = "butt";
  drawMango(g, x + w * 0.27, y + h * 0.5, s * 0.36);
}

function drawMango(g, cx, cy, r) {
  g.fillStyle = "#7a4a22";
  [-1, 1].forEach((side) => {      // ears
    g.beginPath();
    g.arc(cx + side * r * 0.95, cy - r * 0.1, r * 0.32, 0, Math.PI * 2);
    g.fill();
  });
  g.beginPath();                   // head
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f1c58e";         // face
  g.beginPath();
  g.ellipse(cx, cy + r * 0.15, r * 0.72, r * 0.68, 0, 0, Math.PI * 2);
  g.fill();
  [-1, 1].forEach((side) => {      // inside the ears
    g.beginPath();
    g.arc(cx + side * r * 0.95, cy - r * 0.1, r * 0.16, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#2a1608";         // eyes
  [-1, 1].forEach((side) => {
    g.beginPath();
    g.arc(cx + side * r * 0.3, cy - r * 0.05, r * 0.13, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#fff";
  [-1, 1].forEach((side) => {
    g.beginPath();
    g.arc(cx + side * r * 0.3 + r * 0.04, cy - r * 0.1, r * 0.05, 0, Math.PI * 2);
    g.fill();
  });
  g.strokeStyle = "#2a1608";       // smile
  g.lineWidth = Math.max(1.5, r * 0.08);
  g.beginPath();
  g.arc(cx, cy + r * 0.25, r * 0.3, 0.2, Math.PI - 0.2);
  g.stroke();
}

function pieceRect(i, at) {
  const p = pieces[i], { x, y, cell } = board;
  return p.h
    ? { x: x + at * cell, y: y + p.fixed * cell, w: p.len * cell, h: cell }
    : { x: x + p.fixed * cell, y: y + at * cell, w: cell, h: p.len * cell };
}

function drawPieces() {
  const cell = board.cell;
  if (hint) {
    // a dashed outline where the hint block should go
    const to = pieceRect(hint.piece, hint.to);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#ffe14a";
    ctx.lineWidth = 3;
    rr(ctx, to.x + 5, to.y + 5, to.w - 10, to.h - 10, cell * 0.15);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  pieces.forEach((p, i) => {
    const r = pieceRect(i, shown[i]);
    ctx.save();
    if (i === 0 && won) ctx.globalAlpha = Math.max(0, Math.min(1, 1 - (shown[0] - N) / 1.5));
    if (drag && drag.i === i) ctx.translate(0, -3);  // lift the block you're holding a little
    drawPiece(ctx, p, r.x, r.y, r.w, r.h, cell);
    ctx.restore();
    if (hint && hint.piece === i) {
      ctx.strokeStyle = `rgba(255, 225, 74, ${0.6 + Math.sin(clock * 8) * 0.4})`;
      ctx.lineWidth = 5;
      rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, cell * 0.2);
      ctx.stroke();
    } else if (i === selected && !won) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3;
      rr(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, cell * 0.2);
      ctx.stroke();
    }
  });
  if (hint) {
    // an arrow from the glowing block to where it should go
    const from = pieceRect(hint.piece, pos[hint.piece]), to = pieceRect(hint.piece, hint.to);
    const fx = from.x + from.w / 2, fy = from.y + from.h / 2, tx = to.x + to.w / 2, ty = to.y + to.h / 2;
    const a = Math.atan2(ty - fy, tx - fx), bob = Math.sin(clock * 6) * 4;
    const ex = tx - Math.cos(a) * cell * 0.3 + Math.cos(a) * bob, ey = ty - Math.sin(a) * cell * 0.3 + Math.sin(a) * bob;
    ctx.strokeStyle = "#ffe14a";
    ctx.fillStyle = "#ffe14a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14);
    ctx.lineTo(ex + Math.cos(a + 2.4) * 14, ey + Math.sin(a + 2.4) * 14);
    ctx.lineTo(ex + Math.cos(a - 2.4) * 14, ey + Math.sin(a - 2.4) * 14);
    ctx.fill();
  }
}

function drawParticles() {
  particles.forEach((q) => {
    ctx.fillStyle = q.colour;
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.spin * clock);
    ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
    ctx.restore();
  });
}

function draw() {
  const z = zoneOf(levelIndex);
  drawBackground(z);
  drawBoard(z);
  drawPieces();
  drawParticles();
}

// ---------- 12. the game loop ----------
function update(dt) {
  shown.forEach((s, i) => {
    if (!drag || drag.i !== i) shown[i] += (pos[i] - s) * Math.min(1, dt * SLIDE_SPEED);
  });
  if (won) {
    won += dt;
    if (won > 0.3) shown[0] = GOAL + (won - 0.3) ** 2 * 14;  // the cart rolls away, faster and faster
    if (won > 0.35 && won - dt <= 0.35) {
      // a burst of confetti at the gate
      const gx = board.x + board.cell * N, gy = board.y + board.cell * (EXIT_ROW + 0.5);
      for (let k = 0; k < 60; k++) {
        particles.push({
          x: gx, y: gy,
          vx: (Math.random() - 0.3) * 420, vy: -Math.random() * 480 - 80,
          size: 6 + Math.random() * 8, spin: Math.random() * 10 - 5,
          colour: ["#ffe14a", "#ff8a2a", "#5fd36a", "#ffffff"][k % 4],
        });
      }
    }
    if (won > 1.4 && screen === "play") showClear();
  }
  particles.forEach((q) => { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; });
  particles = particles.filter((q) => q.y < H + 40);
}

function frame(t) {
  const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
  lastTime = t;
  clock += dt;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------- 13. sounds, made from scratch with the Web Audio API ----------
let audio = null;
function ensureAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (e) { /* no sound on this browser, that's OK */ }
}

function tone(freq, dur, type = "sine", vol = 0.12, slideTo = 0, at = 0) {
  if (!audio || !save.sound) return;
  const t = audio.currentTime + at, o = audio.createOscillator(), v = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  v.gain.setValueAtTime(vol, t);
  v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(v).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const sfx = {
  slide() { tone(240, 0.1, "triangle", 0.2, 150); },  // a wooden "tok"
  bonk() { tone(110, 0.12, "square", 0.06, 80); },
  undo() { tone(520, 0.14, "sine", 0.1, 260); },
  hint() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.2, "sine", 0.08, 0, i * 0.07)); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.24, "triangle", 0.12, 0, i * 0.1)); },
};

// ---------- 14. the picture on the title screen ----------
function drawTitleArt() {
  const g = $("hero-art").getContext("2d");
  drawLeaf(g, 10, 20, 70, 0.3, 0.3);
  drawLeaf(g, 250, 90, 70, Math.PI + 0.3, 0.6);
  drawLeaf(g, 240, 14, 50, 2.6, 0.9);
  drawPiece(g, { h: false, len: 2, kind: "log", shade: 1 }, 14, 30, 34, 76, 34);
  drawPiece(g, { h: true, len: 2, kind: "cart" }, 60, 22, 140, 70, 70);
  g.fillStyle = "#ffe14a";
  g.beginPath();
  g.moveTo(214, 40);
  g.lineTo(238, 57);
  g.lineTo(214, 74);
  g.fill();
}

resize();
loadLevel(0);
drawTitleArt();
requestAnimationFrame(frame);
