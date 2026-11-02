// Sugar Pipes: a candy-land pipe puzzle with 30 levels and a boss.
// Turn the candy-cane pipes so syrup flows from the lollipop fountains to the hungry cupcakes.
// Every level is built by this code from a "seed" number, so there are no level files and no pictures.
"use strict";

// ---------- 1. numbers you can change ----------
const HINTS_PER_LEVEL = 3;   // how many hints you get on each level (and each boss round)
const HINT_COST = 3;         // when stars are worked out, a hint counts as this many moves
const TURN_TIME = 0.14;      // how many seconds a pipe takes to turn
const BOSS_TIME = 420;       // seconds you get to beat all 3 boss rounds
const BOSS_HP = 3;           // the Sour King is beaten after this many fixed boards
const ZAP_EVERY = 10;        // the Sour King twists one of your pipes this often (seconds)
const ZAP_WARN = 1.6;        // ...and that pipe flashes for this long first, so you can see it coming
const MAX_TILE = 92;         // the biggest a tile can be on the screen, in pixels
const SAVE_KEY = "sugarpipes-save";
const TAU = Math.PI * 2;

// ---------- 2. pipes are made of 4 directions ----------
// Every tile remembers which sides have a pipe opening, as one number:
// north = 1, east = 2, south = 4, west = 8. A corner going north and east is 1 + 2 = 3.
const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit: N, dx: 0, dy: -1 },
  { bit: E, dx: 1, dy: 0 },
  { bit: S, dx: 0, dy: 1 },
  { bit: W, dx: -1, dy: 0 },
];
const opposite = b => (b === N ? S : b === S ? N : b === E ? W : E);
const turn = m => ((m << 1) | (m >> 3)) & 15;   // turn a tile a quarter clockwise
const turnBy = (m, q) => { for (let i = 0; i < ((q % 4) + 4) % 4; i++) m = turn(m); return m; };
const bits = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const FLAVORS = [
  { name: "strawberry", syrup: "#ff3f7f", dark: "#b5124d", light: "#ffc2d8" },
  { name: "blueberry", syrup: "#3f7dff", dark: "#1a43a8", light: "#c4d6ff" },
];
const MIXED = "#8d5b7f";     // the yucky colour you get when two flavours touch

// ---------- 3. the worlds and their levels ----------
// L(width, height, cupcakes for each flavour, how much of the board the answer covers,
//   sour drops, wrapped candies, how tricky the spare pipes are from 0 to 2)
function L(w, h, goals, fill, rocks = 0, locks = 0, mix = 0) { return { w, h, goals, fill, rocks, locks, mix }; }

const WORLDS = [
  { name: "Gumdrop Garden", icon: "🍬", sky: ["#ffeef6", "#ffc9e0"], tray: "#e89a5a", trayDark: "#b0622b",
    tile: ["#fff3dc", "#ffe6bd"],
    tip: "Tap a pipe to turn it. Get the strawberry syrup to the cupcake!",
    levels: [L(3, 3, [1], 0.6), L(4, 4, [1], 0.5), L(4, 5, [1], 0.5), L(5, 5, [1], 0.45),
      L(5, 5, [1], 0.5, 0, 0, 1), L(5, 6, [1], 0.5, 0, 0, 1)] },
  { name: "Lollipop Lane", icon: "🍭", sky: ["#f3ecff", "#d6c4ff"], tray: "#b07ad8", trayDark: "#74429e",
    tile: ["#fdf7ff", "#f0e2ff"],
    tip: "Sour drops block the way, and wrapped candies can't be turned.",
    levels: [L(5, 5, [1], 0.45, 2, 1), L(5, 6, [1], 0.45, 3, 1, 1), L(6, 6, [1], 0.45, 3, 2, 1),
      L(6, 6, [1], 0.5, 4, 2, 1), L(6, 7, [1], 0.5, 4, 3, 1), L(6, 7, [1], 0.55, 5, 2, 2)] },
  { name: "Chocolate Falls", icon: "🍫", sky: ["#fff0e0", "#f0c49a"], tray: "#7a4a2a", trayDark: "#4a2914",
    tile: ["#fff4e6", "#f6dfc4"],
    tip: "Two hungry cupcakes! Use a T-pipe to split the syrup.",
    levels: [L(5, 5, [2], 0.5, 0, 1, 1), L(6, 6, [2], 0.5, 2, 1, 1), L(6, 6, [2], 0.5, 3, 2, 1),
      L(6, 7, [2], 0.55, 3, 2, 2), L(6, 7, [3], 0.5, 2, 2, 1), L(7, 7, [3], 0.55, 4, 3, 2)] },
  { name: "Cotton Candy Clouds", icon: "☁️", sky: ["#e4f5ff", "#ffd6ee"], tray: "#6fb8e8", trayDark: "#3a7fb3",
    tile: ["#ffffff", "#eef7ff"],
    tip: "Two flavours now! Strawberry and blueberry must never mix.",
    levels: [L(5, 5, [1, 1], 0.5), L(6, 6, [1, 1], 0.5, 1, 1, 1), L(6, 6, [1, 1], 0.5, 2, 1, 1),
      L(6, 7, [1, 1], 0.55, 3, 2, 1), L(7, 7, [1, 1], 0.55, 3, 2, 2), L(7, 7, [2, 1], 0.55, 3, 2, 2)] },
  { name: "Jellybean Jungle", icon: "🌴", sky: ["#eaffea", "#b9ecbd"], tray: "#4fae5a", trayDark: "#2b7334",
    tile: ["#fbfff2", "#ecf9d8"],
    tip: "Everything at once. The Sour King's castle is close!",
    levels: [L(7, 7, [2, 1], 0.5, 3, 2, 1), L(7, 7, [2, 2], 0.55, 3, 3, 2), L(7, 8, [2, 1], 0.55, 4, 2, 2),
      L(7, 8, [2, 2], 0.55, 4, 3, 2), L(8, 8, [3, 1], 0.55, 5, 3, 2), L(8, 8, [2, 2], 0.6, 5, 4, 2)] },
  { name: "Sour King's Castle", icon: "🍋", boss: true, sky: ["#34284f", "#6b4f8a"], tray: "#c9a93a", trayDark: "#86701c",
    tile: ["#fffbe6", "#fff0b5"],
    tip: "The Sour King twists your pipes! Fix his boards 3 times to beat him.",
    rounds: [L(6, 6, [3], 0.5, 2, 2, 1), L(7, 7, [1, 2], 0.55, 3, 2, 2), L(8, 8, [2, 2], 0.55, 4, 3, 2)] },
];

// one long list of every level: 30 normal ones, then the boss
const LEVELS = [];
WORLDS.forEach((world, wi) => {
  if (world.boss) LEVELS.push({ world: wi, boss: true, name: "Sour King" });
  else world.levels.forEach((spec, k) => LEVELS.push({ world: wi, spec, name: `${world.name} ${k + 1}` }));
});

// ---------- 4. seeded random numbers ----------
// the same seed always gives the same numbers, so level 7 is the same puzzle every time you play it
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickWeighted(list, rng) {
  let total = 0;
  for (const [, weight] of list) total += weight;
  let r = rng() * total;
  for (const [name, weight] of list) if ((r -= weight) < 0) return name;
  return list[0][0];
}

// ---------- 5. building a level ----------
// 1. put down a lollipop and a cupcake, and wiggle a path between them
// 2. more cupcakes get a branch path that joins on to the first path (that makes a T-pipe)
// 3. fill the empty squares with sour drops and spare pipes that aren't part of the answer
// 4. spin every pipe to a random direction. Now it's a puzzle, and we know it has an answer!
const SHAPES = { straight: N | S, corner: N | E, tee: N | E | S, cross: N | E | S | W };
const MIXES = [
  [["corner", 5], ["straight", 4], ["tee", 1]],
  [["corner", 4], ["straight", 3], ["tee", 2], ["cross", 1]],
  [["corner", 3], ["straight", 3], ["tee", 3], ["cross", 1]],
];

// a twisty path from `start` to a square where isEnd() says yes. The squares in the middle
// must be empty, and there must be between minLen and maxLen of them.
function findPath(w, h, used, start, isEnd, minLen, maxLen, rng) {
  let budget = 20000;
  const seen = new Uint8Array(w * h);
  const path = [start];
  seen[start] = 1;
  function dig(c) {
    if (--budget < 0) return false;
    for (const d of shuffled(DIRS, rng)) {
      const x = (c % w) + d.dx, y = ((c / w) | 0) + d.dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const n = y * w + x, middle = path.length - 1;
      if (seen[n]) continue;
      if (isEnd(n)) {
        if (middle >= minLen) { path.push(n); return true; }
        continue;
      }
      if (used[n] || middle + 1 > maxLen) continue;
      seen[n] = 1;
      path.push(n);
      if (dig(n)) return true;
      path.pop();
      seen[n] = 0;
    }
    return false;
  }
  return dig(start) ? path : null;
}

function makeBoard(spec, seed) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = tryBoard(spec, makeRng(seed * 7919 + attempt));
    if (board) return board;
  }
  throw new Error("could not build level " + seed);
}

function tryBoard(spec, rng) {
  const { w, h } = spec, size = w * h;
  const used = new Uint8Array(size);
  const sol = new Array(size).fill(0);       // the answer: which way every pipe should point
  const kind = new Array(size).fill(null);
  const flavorOf = new Array(size).fill(-1);
  const specials = [];
  const totalGoals = spec.goals.reduce((a, b) => a + b, 0);
  const per = (spec.fill * size) / totalGoals;
  const mainMin = Math.max(1, Math.round(per) - 2), mainMax = Math.round(per * 1.6) + 2;
  const branchMin = Math.max(1, Math.round(per * 0.6) - 1), branchMax = Math.round(per) + 2;

  const far = c => specials.every(s => Math.abs((s % w) - (c % w)) + Math.abs(((s / w) | 0) - ((c / w) | 0)) >= 2);
  function pickFree() {
    for (let i = 0; i < 60; i++) { const c = (rng() * size) | 0; if (!used[c] && far(c)) return c; }
    for (let i = 0; i < 60; i++) { const c = (rng() * size) | 0; if (!used[c]) return c; }
    return -1;
  }
  function place(c, what, f) { used[c] = 1; kind[c] = what; flavorOf[c] = f; specials.push(c); }
  function lay(path, f) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const d = DIRS.find(d => (a % w) + d.dx === b % w && ((a / w) | 0) + d.dy === ((b / w) | 0));
      sol[a] |= d.bit;
      sol[b] |= opposite(d.bit);
    }
    for (const c of path) { used[c] = 1; kind[c] = kind[c] || "pipe"; flavorOf[c] = f; }
  }

  for (let f = 0; f < spec.goals.length; f++) {
    const src = pickFree();
    if (src < 0) return null;
    place(src, "source", f);
    const goal = pickFree();
    if (goal < 0) return null;
    place(goal, "goal", f);
    const path = findPath(w, h, used, src, c => c === goal, mainMin, mainMax, rng);
    if (!path) return null;
    lay(path, f);
    for (let g = 1; g < spec.goals[f]; g++) {
      const extra = pickFree();
      if (extra < 0) return null;
      place(extra, "goal", f);
      const joins = c => kind[c] === "pipe" && flavorOf[c] === f && bits(sol[c]) < 3;
      const branch = findPath(w, h, used, extra, joins, branchMin, branchMax, rng);
      if (!branch) return null;
      lay(branch, f);
    }
  }

  const tiles = [];
  for (let c = 0; c < size; c++) {
    const special = kind[c] === "source" || kind[c] === "goal";
    tiles.push({ kind: kind[c] || "pipe", mask: sol[c], sol: sol[c], flavor: flavorOf[c], locked: special,
      anim: 0, fill: 0, wet: 0, dist: 0, order: 0, flash: 0, shake: 0, bounce: 0, done: false });
  }

  // sour drops and spare pipes go in the empty squares
  const free = shuffled([...Array(size).keys()].filter(c => !used[c]), rng);
  for (let k = 0; k < spec.rocks && free.length > 2; k++) {
    const t = tiles[free.pop()];
    t.kind = "rock";
    t.locked = true;
  }
  for (const c of free) tiles[c].mask = turnBy(SHAPES[pickWeighted(MIXES[spec.mix], rng)], (rng() * 4) | 0);

  // wrapped candies: some answer pipes are already pointing the right way, and a few spare ones too
  const answerPipes = shuffled(tiles.filter(t => t.kind === "pipe" && t.sol), rng);
  for (let k = 0; k < spec.locks && answerPipes.length > 3; k++) answerPipes.pop().locked = true;
  for (let k = 0; k < spec.locks >> 1 && k < free.length; k++) tiles[free[k]].locked = true;

  // spin the answer pipes. Most of them get spun away from the answer.
  for (const t of tiles) {
    if (t.kind !== "pipe" || !t.sol || t.locked || t.sol === 15) continue;
    let q;
    do q = (rng() * 4) | 0; while (turnBy(t.sol, q) === t.sol && rng() < 0.85);
    t.mask = turnBy(t.sol, q);
  }

  const board = { w, h, tiles, spec };
  if (computeFlow(board).solved) return null;
  // `order` is how far along the answer each pipe is, so hints start near the lollipop
  for (const t of tiles) { t.real = t.mask; t.mask = t.sol; }
  computeFlow(board);
  for (const t of tiles) { t.order = t.dist; t.mask = t.real; delete t.real; }
  return board;
}

// follow the syrup out of every lollipop and see which tiles it reaches
function computeFlow(board) {
  const { w, h, tiles } = board;
  for (const t of tiles) { t.wet = 0; t.dist = 99; }
  tiles.forEach((src, s) => {
    if (src.kind !== "source") return;
    const flag = 1 << src.flavor;
    const dist = new Map([[s, 0]]);
    const queue = [s];
    while (queue.length) {
      const c = queue.shift(), t = tiles[c], x = c % w, y = (c / w) | 0;
      t.wet |= flag;
      t.dist = Math.min(t.dist, dist.get(c));
      for (const d of DIRS) {
        if (!(t.mask & d.bit)) continue;
        const nx = x + d.dx, ny = y + d.dy, n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist.has(n)) continue;
        if (!(tiles[n].mask & opposite(d.bit))) continue;
        dist.set(n, dist.get(c) + 1);
        queue.push(n);
      }
    }
  });
  let goals = 0, done = 0, mixed = false, wet = 0;
  for (const t of tiles) {
    if (t.wet === 3) mixed = true;
    if (t.wet) wet++;
    if (t.kind === "goal") { goals++; if (t.wet === 1 << t.flavor) done++; }
  }
  return { solved: done === goals && !mixed, mixed, goals, done, wet };
}

// the fewest clockwise taps that would solve the board
function parOf(board) {
  let par = 0;
  for (const t of board.tiles) {
    if (t.kind !== "pipe" || !t.sol || t.locked) continue;
    let m = t.mask, k = 0;
    while (m !== t.sol && k < 4) { m = turn(m); k++; }
    par += k;
  }
  return par;
}

// ---------- 6. saving your stars ----------
let save = { unlocked: 0, stars: [], best: [], muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { /* no saving, that's ok */ }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------- 7. sounds and music, made up by the computer ----------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function tone(freq, dur, type = "sine", vol = 0.12, slideTo = 0, delay = 0) {
  if (save.muted || !actx) return;
  const t0 = actx.currentTime + delay;
  const osc = actx.createOscillator(), gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(actx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
const sfx = {
  turn() { tone(520, 0.07, "triangle", 0.12, 780); },
  back() { tone(780, 0.07, "triangle", 0.1, 520); },
  locked() { tone(180, 0.12, "square", 0.05); },
  glug() { tone(220, 0.12, "sine", 0.12, 140); },
  goal() { [784, 988, 1175].forEach((f, i) => tone(f, 0.18, "triangle", 0.1, 0, i * 0.07)); },
  yuck() { tone(300, 0.3, "sawtooth", 0.05, 120); },
  hint() { [880, 1320, 1760].forEach((f, i) => tone(f, 0.12, "sine", 0.08, 0, i * 0.05)); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, 0, i * 0.09)); },
  warn() { tone(440, 0.15, "square", 0.04); tone(440, 0.15, "square", 0.04, 0, 0.25); },
  zap() { tone(900, 0.3, "sawtooth", 0.07, 90); },
  hit() { tone(300, 0.4, "square", 0.08, 60); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, "triangle", 0.1, 0, i * 0.2)); },
};

const SCALE = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5];
const BASS = [130.8, 98.0, 110.0, 87.3];
let tune = [], beat = 0;
function makeTune(seed) {
  const rng = makeRng(seed);
  let n = 2;
  tune = [];
  for (let i = 0; i < 16; i++) {
    if (rng() < 0.22) { tune.push(-1); continue; }
    n = clamp(n + ((rng() * 5) | 0) - 2, 0, SCALE.length - 1);
    tune.push(n);
  }
}
setInterval(() => {
  if (!actx || save.muted || game.state !== "play") return;
  const n = tune[beat % 16];
  if (n >= 0) tone(SCALE[n], 0.4, "sine", 0.03);
  if (beat % 4 === 0) tone(BASS[(beat >> 4) % 4], 0.6, "triangle", 0.03);
  beat++;
}, 280);

// ---------- 8. the game state ----------
const game = {
  state: "menu",          // menu, play, won, paused, over
  level: 0, world: WORLDS[0], board: null, flow: null,
  moves: 0, hints: 0, hintsLeft: HINTS_PER_LEVEL, history: [],
  timeLeft: 0, timeLimit: 0, par: 0, boss: null,
  after: null,            // something to do in a little while: { t, fn }
  cursor: 0, showCursor: false, t: 0,
};
let particles = [];

function timeFor(board) { return Math.ceil((20 + parOf(board) * 4 + board.w * board.h * 0.6) / 5) * 5; }
function starTargets(par) { return [par + Math.max(2, Math.ceil(par * 0.25)), par * 2 + 3]; }

function startLevel(idx) {
  const info = LEVELS[idx];
  game.level = idx;
  game.world = WORLDS[info.world];
  game.after = null;
  particles = [];
  if (info.boss) {
    game.boss = { round: 0, hp: BOSS_HP, zapT: ZAP_EVERY, target: -1, warn: 0, hitT: 0, bolt: 0, boltTo: -1 };
    loadBoard(makeBoard(game.world.rounds[0], 9001));
    game.timeLimit = BOSS_TIME;
  } else {
    game.boss = null;
    loadBoard(makeBoard(info.spec, idx + 1));
    game.timeLimit = timeFor(game.board);
  }
  game.timeLeft = game.timeLimit;
  makeTune(info.world * 31 + 7);
  game.state = "play";
  showScreen(null);
  const firstOfWorld = info.boss || LEVELS[idx - 1]?.world !== info.world;
  if (firstOfWorld) toast(game.world.tip, 4);
  updateHud();
}

function loadBoard(board) {
  game.board = board;
  game.moves = 0;
  game.hints = 0;
  game.hintsLeft = HINTS_PER_LEVEL;
  game.history = [];
  game.par = parOf(board);
  game.flow = computeFlow(board);
  for (const t of board.tiles) { t.fill = t.wet ? 1 : 0; t.done = t.kind === "goal" && t.wet === 1 << t.flavor; }
  game.cursor = ((board.h / 2) | 0) * board.w + ((board.w / 2) | 0);
  layout();
}

// ---------- 9. turning pipes, undo and hints ----------
function turnTile(i, q) {
  if (game.state !== "play") return;
  const t = game.board.tiles[i];
  if (!t || t.kind !== "pipe") return;
  if (t.locked) { t.shake = 0.35; sfx.locked(); return; }
  t.mask = turnBy(t.mask, q);
  t.anim -= 90 * q;
  game.moves++;
  game.history.push({ i, q });
  q > 0 ? sfx.turn() : sfx.back();
  afterChange();
}

function undo() {
  if (game.state !== "play") return;
  const step = game.history.pop();
  if (!step) { toast("Nothing to undo", 1.2); return; }
  const t = game.board.tiles[step.i];
  t.mask = turnBy(t.mask, -step.q);
  t.anim += 90 * step.q;
  if (!step.hint) game.moves--;
  sfx.back();
  afterChange();
}

function hint() {
  if (game.state !== "play") return;
  if (game.hintsLeft <= 0) { toast("No hints left on this board!", 1.6); return; }
  const tiles = game.board.tiles;
  let best = -1;
  tiles.forEach((t, i) => {
    if (t.kind === "pipe" && t.sol && !t.locked && t.mask !== t.sol && (best < 0 || t.order < tiles[best].order)) best = i;
  });
  if (best < 0) return;
  const t = tiles[best];
  let m = t.mask, k = 0;
  while (m !== t.sol) { m = turn(m); k++; }
  const q = k === 3 ? -1 : k;
  t.mask = t.sol;
  t.anim -= 90 * q;
  t.flash = 1.4;
  game.hintsLeft--;
  game.hints++;
  game.history.push({ i: best, q, hint: true });
  sfx.hint();
  afterChange();
}

function afterChange() {
  const before = game.flow;
  game.flow = computeFlow(game.board);
  game.board.tiles.forEach((t, i) => {
    if (t.kind !== "goal") return;
    const done = t.wet === 1 << t.flavor;
    if (done && !t.done) { t.bounce = 1; burst(i, 18); sfx.goal(); }
    t.done = done;
  });
  if (game.flow.mixed && !before.mixed) { toast("Yuck! The flavours are mixing!", 1.8); sfx.yuck(); }
  else if (game.flow.wet > before.wet) sfx.glug();
  updateHud();
  if (game.flow.solved) solved();
}

function solved() {
  game.state = "won";
  sfx.win();
  game.board.tiles.forEach((t, i) => { if (t.wet) burst(i, 3); });
  const B = game.boss;
  if (B) {
    B.hp--;
    B.hitT = 1;
    B.target = -1;
    setTimeout(() => sfx.hit(), 300);
    toast(B.hp > 0 ? "Take that, Sour King!" : "The Sour King is beaten!", 1.6);
    game.after = { t: 1.8, fn: B.hp > 0 ? nextRound : bossBeaten };
  } else {
    toast("Sweet!", 1.2);
    game.after = { t: 1.4, fn: levelCleared };
  }
}

function earnStars(stars) {
  const i = game.level, time = game.timeLimit - game.timeLeft;
  const newBest = !save.best[i] || time < save.best[i];
  save.stars[i] = Math.max(save.stars[i] || 0, stars);
  if (newBest) save.best[i] = Math.round(time * 10) / 10;
  save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
  writeSave();
  return { time, newBest };
}

function levelCleared() {
  const [three, two] = starTargets(game.par);
  const score = game.moves + game.hints * HINT_COST;
  const stars = score <= three ? 3 : score <= two ? 2 : 1;
  const { time, newBest } = earnStars(stars);
  showStars("clear-stars", stars);
  const hintText = game.hints ? ` and ${game.hints} hint${game.hints > 1 ? "s" : ""}` : "";
  $("clear-text").innerHTML = `You used <b>${game.moves} moves</b>${hintText} in <b>${clock(time)}</b>.` +
    (newBest ? "<br>⏱ New best time!" : "") +
    (stars < 3 ? `<br>Get ⭐⭐⭐ with ${three} moves or fewer.` : "");
  $("next").classList.toggle("hidden", game.level >= LEVELS.length - 1);
  showScreen("clear-screen");
  game.state = "over";
}

function nextRound() {
  const B = game.boss;
  B.round++;
  B.zapT = ZAP_EVERY;
  B.target = -1;
  loadBoard(makeBoard(game.world.rounds[B.round], 9001 + B.round));
  game.state = "play";
  toast(`Round ${B.round + 1}! He's getting angrier...`, 2);
  updateHud();
}

function bossBeaten() {
  const part = game.timeLeft / BOSS_TIME;
  const stars = part >= 0.45 ? 3 : part >= 0.2 ? 2 : 1;
  const { time } = earnStars(stars);
  showStars("end-stars", stars);
  const total = save.stars.reduce((a, b) => a + (b || 0), 0);
  $("end-text").innerHTML = `You fixed all 3 of the Sour King's boards in <b>${clock(time)}</b>, and Candy Land
    is sweet again! You have <b>${total} of ${LEVELS.length * 3}</b> stars.`;
  showScreen("end-screen");
  game.state = "over";
}

function timeUp() {
  game.state = "over";
  sfx.lose();
  $("over-text").textContent = game.boss
    ? "The Sour King laughed and turned all the syrup sour. Try again, you can beat him!"
    : "The syrup went hard before it reached the cupcakes. Try again!";
  showScreen("over-screen");
}

// ---------- 10. the Sour King ----------
function updateBoss(dt) {
  const B = game.boss;
  B.hitT = Math.max(0, B.hitT - dt * 0.8);
  B.bolt = Math.max(0, B.bolt - dt);
  if (game.state !== "play") return;
  B.zapT -= dt;
  const tiles = game.board.tiles;
  if (B.target < 0 && B.zapT <= ZAP_WARN) {
    // he likes to twist pipes you've already got right. How sour!
    const turnable = tiles.map((t, i) => i).filter(i => tiles[i].kind === "pipe" && !tiles[i].locked && tiles[i].mask !== 15);
    const right = turnable.filter(i => tiles[i].sol && tiles[i].mask === tiles[i].sol);
    const pool = right.length ? right : turnable;
    if (!pool.length) { B.zapT = ZAP_EVERY; return; }
    B.target = pool[(Math.random() * pool.length) | 0];
    B.warn = ZAP_WARN;
    sfx.warn();
  }
  if (B.target >= 0) B.warn -= dt;
  if (B.target >= 0 && B.zapT <= 0) {
    const t = tiles[B.target];
    const q = Math.random() < 0.5 ? 1 : -1;
    t.mask = turnBy(t.mask, q);
    t.anim -= 90 * q;
    t.shake = 0.4;
    B.bolt = 0.35;
    B.boltTo = B.target;
    B.target = -1;
    B.zapT = ZAP_EVERY - B.round * 1.5;
    sfx.zap();
    afterChange();
  }
}

// ---------- 11. sprinkles and confetti ----------
const SPRINKLE_COLORS = ["#ff6fa5", "#ffd23f", "#5fe3b4", "#6fb8ff", "#ffffff", "#b98cff"];
const sprinkles = Array.from({ length: 70 }, (_, i) => ({
  x: Math.random(), y: Math.random(), a: Math.random() * TAU, spin: (Math.random() - 0.5) * 1.5,
  c: SPRINKLE_COLORS[i % SPRINKLE_COLORS.length], speed: 0.01 + Math.random() * 0.02,
}));

function burst(i, count) {
  const { x, y } = tileCenter(i);
  for (let k = 0; k < count; k++) {
    const a = Math.random() * TAU, sp = 60 + Math.random() * 200;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 1 + Math.random() * 0.6,
      c: SPRINKLE_COLORS[(Math.random() * SPRINKLE_COLORS.length) | 0], rot: a, vr: (Math.random() - 0.5) * 12,
      size: Math.max(3, layoutInfo.ts * 0.07) });
  }
}

// ---------- 12. drawing ----------
const canvas = document.getElementById("view");
const mainCtx = canvas.getContext("2d");
let ctx = mainCtx;
let screenW = 0, screenH = 0;
const layoutInfo = { ts: 60, bx: 0, by: 0, kingY: 0 };

function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  screenW = window.innerWidth;
  screenH = window.innerHeight;
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;
  mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const b = game.board;
  if (!b) return;
  const hudBottom = $("hud-top").getBoundingClientRect().bottom || 50;
  const barTop = $("bar").getBoundingClientRect().top || screenH - 70;
  const kingSpace = game.boss ? 110 : 0;
  const top = hudBottom + 18 + kingSpace, bottom = screenH - barTop + 18;
  const availW = screenW - 44, availH = screenH - top - bottom;
  // + 0.4 leaves room for the tray around the tiles
  const ts = Math.max(24, Math.floor(Math.min(availW / (b.w + 0.4), availH / (b.h + 0.4), MAX_TILE)));
  layoutInfo.ts = ts;
  layoutInfo.bx = Math.round((screenW - ts * b.w) / 2);
  layoutInfo.by = Math.round(top + Math.max(0, (availH - ts * b.h) / 2));
  layoutInfo.kingY = layoutInfo.by - 66;
}

function tileCenter(i) {
  const { ts, bx, by } = layoutInfo, w = game.board.w;
  return { x: bx + (i % w) * ts + ts / 2, y: by + ((i / w) | 0) * ts + ts / 2 };
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

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, screenH);
  sky.addColorStop(0, game.world.sky[0]);
  sky.addColorStop(1, game.world.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, screenW, screenH);
  // soft polka dots
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < 18; i++) {
    const x = ((i * 0.37) % 1) * screenW, y = ((i * 0.61 + 0.1) % 1) * screenH;
    ctx.beginPath();
    ctx.arc(x, y, 30 + (i % 4) * 14, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  for (const s of sprinkles) {
    const x = s.x * screenW, y = s.y * screenH;
    ctx.strokeStyle = s.c;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(s.a) * 5, y - Math.sin(s.a) * 5);
    ctx.lineTo(x + Math.cos(s.a) * 5, y + Math.sin(s.a) * 5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// the candy-cane pipe: a dark edge, white tube, pink stripes, and syrup inside when it's wet
function drawPipe(mask, s, fill, syrup, locked, wave) {
  const arms = DIRS.filter(d => mask & d.bit);
  if (!arms.length) return;
  const half = s / 2, pw = s * 0.36;
  const trace = () => { ctx.beginPath(); for (const a of arms) { ctx.moveTo(0, 0); ctx.lineTo(a.dx * half, a.dy * half); } };
  const layer = (width, color, joint = true) => {
    trace();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (joint) { ctx.beginPath(); ctx.arc(0, 0, width / 2, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  };
  ctx.lineCap = "butt";
  layer(pw + s * 0.08, "rgba(110,40,70,0.55)");
  layer(pw, "#ffffff");
  ctx.setLineDash([s * 0.07, s * 0.08]);
  layer(pw, locked ? "#f2b632" : "#ff8ab3", false);
  ctx.setLineDash([]);
  if (fill > 0) {
    ctx.globalAlpha = fill * (0.85 + 0.15 * wave);
    layer(pw * 0.58, syrup);
    ctx.globalAlpha = fill * 0.5;
    layer(pw * 0.16, "#ffffff", false);
    ctx.globalAlpha = 1;
  }
}

function drawLolly(s, flavor) {
  const f = FLAVORS[flavor], k = s / 100;
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = f.light;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = f.syrup;
  ctx.strokeStyle = f.dark;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.rotate(game.t * 1.5);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let a = 0; a < TAU * 2.4; a += 0.15) {
    const r = 3 + a * 1.75;
    a === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.13, s * 0.08, s * 0.05, -0.6, 0, TAU); ctx.fill();
}

function drawCupcake(s, flavor, done, bounce) {
  const f = FLAVORS[flavor], k = s / 100;
  ctx.save();
  ctx.scale(k * (1 + bounce * 0.18), k * (1 - bounce * 0.12));
  ctx.fillStyle = f.light;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // the paper case
  ctx.beginPath();
  ctx.moveTo(-26, 4); ctx.lineTo(26, 4); ctx.lineTo(19, 33); ctx.lineTo(-19, 33); ctx.closePath();
  ctx.fillStyle = f.light; ctx.strokeStyle = f.dark; ctx.lineWidth = 3;
  ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 0.45;
  for (const x of [-13, 0, 13]) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x * 0.75, 31); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // the frosting: white and empty, or full of syrup
  ctx.strokeStyle = done ? f.dark : "#d4bfae";
  ctx.fillStyle = done ? f.syrup : "#fffaf3";
  for (const [y, rx, ry] of [[2, 31, 12], [-9, 24, 11], [-19, 15, 9]]) {
    ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  if (done) {
    ctx.fillStyle = "#e8263f";
    ctx.beginPath(); ctx.arc(0, -30, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#3d8a2c"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(1, -36); ctx.quadraticCurveTo(5, -44, 11, -44); ctx.stroke();
    ctx.lineWidth = 3; ctx.lineCap = "round";
    [[-14, -4, "#ffd23f"], [10, -2, "#5fe3b4"], [-4, -14, "#fff"], [8, -16, "#ffd23f"]].forEach(([x, y, c]) => {
      ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y + 2); ctx.stroke();
    });
  } else {
    ctx.fillStyle = f.syrup;
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(game.t * 4);
    ctx.beginPath(); ctx.arc(0, -9, 5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// a sour drop: a grumpy green gummy that blocks the way
function drawRock(s) {
  const k = s / 100;
  ctx.save();
  ctx.scale(k, k);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU, r = 31 + (i % 2 ? 3 : -2);
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + 2) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + 2);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-10, -10, 4, 0, 0, 36);
  g.addColorStop(0, "#efff8a"); g.addColorStop(1, "#a8d12e");
  ctx.fillStyle = g; ctx.strokeStyle = "#79991c"; ctx.lineWidth = 3;
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  for (const [x, y] of [[-18, -12], [14, -18], [20, 8], [-20, 14], [2, 22], [-4, -24]]) ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = "#3d4a12";
  ctx.beginPath(); ctx.arc(-9, -3, 3.5, 0, TAU); ctx.arc(9, -3, 3.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#3d4a12"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-10, 11); ctx.quadraticCurveTo(-5, 7, 0, 11); ctx.quadraticCurveTo(5, 15, 10, 11); ctx.stroke();
  ctx.restore();
}

// the little wrapped sweet in the corner of tiles that can't be turned
function drawWrapper(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ff5a5a";
  ctx.strokeStyle = "#a82020";
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.4, 0); ctx.lineTo(side * s, -s * 0.5); ctx.lineTo(side * s, s * 0.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawTile(t, x, y, s, shade, world) {
  const pad = s * 0.04;
  x += t.shake > 0 ? Math.sin(t.shake * 60) * s * 0.04 : 0;
  ctx.fillStyle = shade ? world.tile[1] : world.tile[0];
  roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.16);
  ctx.fill();
  if (t.locked && t.kind === "pipe") {
    ctx.strokeStyle = "#e0a526";
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.setLineDash([s * 0.08, s * 0.06]);
    roundRect(x + pad * 2.5, y + pad * 2.5, s - pad * 5, s - pad * 5, s * 0.13);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const cx = x + s / 2, cy = y + s / 2;
  if (t.kind === "rock") {
    ctx.save(); ctx.translate(cx, cy); drawRock(s); ctx.restore();
    return;
  }
  const special = t.kind === "source" || t.kind === "goal";
  const syrup = t.kind === "source" ? FLAVORS[t.flavor].syrup : t.wet === 3 ? MIXED : FLAVORS[t.wet === 2 ? 1 : 0].syrup;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((t.anim * Math.PI) / 180);
  drawPipe(t.mask, s, t.kind === "source" ? 1 : t.fill, syrup, t.locked && !special, Math.sin(game.t * 5 - t.dist * 0.9));
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  if (t.kind === "source") drawLolly(s, t.flavor);
  if (t.kind === "goal") drawCupcake(s, t.flavor, t.done, Math.sin(t.bounce * 9) * t.bounce);
  ctx.restore();
  if (t.locked && t.kind === "pipe") drawWrapper(x + s * 0.8, y + s * 0.2, s * 0.13);
  if (t.flash > 0) {
    ctx.strokeStyle = `rgba(255, 215, 64, ${Math.min(1, t.flash)})`;
    ctx.lineWidth = s * 0.08;
    roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.16);
    ctx.stroke();
  }
}

function drawBoard() {
  const b = game.board, { ts, bx, by } = layoutInfo, world = game.world;
  const bw = ts * b.w, bh = ts * b.h, m = Math.max(8, ts * 0.16);
  ctx.fillStyle = world.trayDark;
  roundRect(bx - m, by - m + 7, bw + m * 2, bh + m * 2, m * 1.6);
  ctx.fill();
  ctx.fillStyle = world.tray;
  roundRect(bx - m, by - m, bw + m * 2, bh + m * 2, m * 1.6);
  ctx.fill();
  b.tiles.forEach((t, i) => drawTile(t, bx + (i % b.w) * ts, by + ((i / b.w) | 0) * ts, ts, (i % b.w + ((i / b.w) | 0)) % 2, world));

  const B = game.boss;
  if (B && B.target >= 0 && game.state === "play") {
    const { x, y } = tileCenter(B.target);
    ctx.strokeStyle = `rgba(160, 255, 40, ${0.5 + 0.5 * Math.sin(game.t * 25)})`;
    ctx.lineWidth = ts * 0.09;
    roundRect(x - ts / 2 + 2, y - ts / 2 + 2, ts - 4, ts - 4, ts * 0.16);
    ctx.stroke();
  }
  if (game.showCursor && game.state === "play") {
    const { x, y } = tileCenter(game.cursor);
    ctx.strokeStyle = "#3a2a6a";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    roundRect(x - ts / 2 + 1, y - ts / 2 + 1, ts - 2, ts - 2, ts * 0.18);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawKing() {
  const B = game.boss, cx = screenW / 2, cy = layoutInfo.kingY;
  const shake = B.hitT > 0 ? Math.sin(game.t * 70) * 7 * B.hitT : 0;
  const angry = B.target >= 0 && game.state === "play";
  ctx.save();
  ctx.translate(cx + shake, cy + Math.sin(game.t * 2) * 3);
  if (B.hp <= 0) { ctx.rotate(0.3); ctx.globalAlpha = 0.85; }
  // lemon body
  const g = ctx.createRadialGradient(-14, -12, 6, 0, 0, 50);
  g.addColorStop(0, B.hitT > 0.6 ? "#ffffff" : "#fff68a");
  g.addColorStop(1, "#f2c400");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#a88600";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 34, 0, 0, TAU);
  ctx.fill(); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * 47, 0, 7, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // crown
  ctx.fillStyle = "#ffcf3f";
  ctx.strokeStyle = "#a0700a";
  ctx.beginPath();
  ctx.moveTo(-22, -26); ctx.lineTo(-26, -50); ctx.lineTo(-12, -38); ctx.lineTo(0, -56);
  ctx.lineTo(12, -38); ctx.lineTo(26, -50); ctx.lineTo(22, -26); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e8263f";
  for (const [x, y] of [[-25, -50], [0, -56], [25, -50]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
  // face
  ctx.strokeStyle = "#3b2a00";
  ctx.fillStyle = "#3b2a00";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  if (B.hitT > 0.2 || B.hp <= 0) {
    for (const ex of [-15, 15]) {
      ctx.beginPath(); ctx.moveTo(ex - 6, -10); ctx.lineTo(ex + 6, 0); ctx.moveTo(ex + 6, -10); ctx.lineTo(ex - 6, 0); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(-15, -4, 5, 0, TAU); ctx.arc(15, -4, 5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-25, -18); ctx.lineTo(-7, -11); ctx.moveTo(25, -18); ctx.lineTo(7, -11); ctx.stroke();
  }
  ctx.beginPath();
  if (angry) {
    ctx.moveTo(-14, 14);
    for (let i = 1; i <= 6; i++) ctx.lineTo(-14 + i * 4.7, i % 2 ? 9 : 16);
  } else {
    ctx.moveTo(-13, 17);
    ctx.quadraticCurveTo(0, 7, 13, 17);
  }
  ctx.stroke();
  ctx.restore();
  // his health: lemon slices that go grey when you beat a board
  ctx.font = "16px 'Lilita One', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const hx = cx + 64;
  ctx.fillStyle = "#fff";
  ctx.fillText("SOUR KING", hx, cy - 14);
  for (let i = 0; i < BOSS_HP; i++) {
    ctx.fillStyle = i < B.hp ? "#ffe14d" : "rgba(255,255,255,0.25)";
    ctx.strokeStyle = i < B.hp ? "#a88600" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx + 10 + i * 26, cy + 10, 10, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // the zap
  if (B.bolt > 0 && B.boltTo >= 0) {
    const { x, y } = tileCenter(B.boltTo);
    ctx.strokeStyle = "#c6ff3a";
    ctx.lineWidth = 4;
    ctx.globalAlpha = B.bolt / 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 34);
    for (let i = 1; i < 8; i++) {
      const p = i / 8;
      ctx.lineTo(cx + (x - cx) * p + (Math.random() - 0.5) * 30, cy + 34 + (y - cy - 34) * p);
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size * 0.66);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx = mainCtx;
  drawBackground();
  if (!game.board || document.body.classList.contains("in-menu")) return;
  drawBoard();
  if (game.boss) drawKing();
  drawParticles();
}

// the little picture on the title screen: a lollipop, two pipes and a cupcake
function drawHeroArt() {
  const art = $("hero-art");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  art.width = 280 * dpr;
  art.height = 76 * dpr;
  ctx = art.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = 70;
  const pieces = [
    { kind: "source", mask: E, flavor: 0 },
    { kind: "pipe", mask: E | W },
    { kind: "pipe", mask: E | W },
    { kind: "goal", mask: W, flavor: 0, done: true },
  ];
  pieces.forEach((p, i) => drawTile({ anim: 0, wet: 1, fill: 1, dist: i, bounce: 0, flash: 0, shake: 0, ...p },
    i * s, 3, s, i % 2, WORLDS[0]));
  ctx = mainCtx;
}

// ---------- 13. every frame ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function update(dt) {
  if (game.state === "paused") return;
  game.t += dt;
  for (const s of sprinkles) {
    s.y += s.speed * dt;
    s.a += s.spin * dt;
    if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
  }
  if (game.board) {
    for (const t of game.board.tiles) {
      // a pipe that is still turning catches up faster if you tapped it lots of times
      const spin = (90 / TURN_TIME) * dt * Math.max(1, Math.abs(t.anim) / 90);
      t.anim = t.anim > 0 ? Math.max(0, t.anim - spin) : Math.min(0, t.anim + spin);
      t.fill = t.wet ? Math.min(1, t.fill + dt * 6) : Math.max(0, t.fill - dt * 6);
      t.flash = Math.max(0, t.flash - dt);
      t.shake = Math.max(0, t.shake - dt);
      t.bounce = Math.max(0, t.bounce - dt * 1.4);
    }
  }
  for (const p of particles) {
    p.vy += 420 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  if (game.boss) updateBoss(dt);
  if (game.state === "play") {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) { game.timeLeft = 0; timeUp(); }
    updateClock();
  }
  if (game.after) {
    game.after.t -= dt;
    if (game.after.t <= 0) { const fn = game.after.fn; game.after = null; fn(); }
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $("toast").classList.remove("show"); }
}

// ---------- 14. tapping, clicking and keys ----------
canvas.addEventListener("pointerdown", e => {
  audio();
  if (game.state !== "play") return;
  const { ts, bx, by } = layoutInfo, b = game.board;
  const col = Math.floor((e.clientX - bx) / ts), row = Math.floor((e.clientY - by) / ts);
  if (col < 0 || row < 0 || col >= b.w || row >= b.h) return;
  game.showCursor = false;
  game.cursor = row * b.w + col;
  turnTile(game.cursor, e.button === 2 || e.shiftKey ? -1 : 1);
});
canvas.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("keydown", e => {
  audio();
  const k = e.key;
  if (k === "m" || k === "M") { toggleSound(); return; }
  if (game.state === "paused") { if (k === "Escape" || k === "p" || k === "P") resume(); return; }
  if (!$("clear-screen").classList.contains("hidden") && k === "Enter") { $("next").click(); return; }
  if (game.state !== "play") return;
  const b = game.board;
  const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (steps[k]) {
    e.preventDefault();
    if (game.showCursor) {
      const x = clamp((game.cursor % b.w) + steps[k][0], 0, b.w - 1);
      const y = clamp(((game.cursor / b.w) | 0) + steps[k][1], 0, b.h - 1);
      game.cursor = y * b.w + x;
    }
    game.showCursor = true;
  } else if (k === " " || k === "Enter") {
    e.preventDefault();
    if (game.showCursor) turnTile(game.cursor, e.shiftKey ? -1 : 1);
    game.showCursor = true;
  } else if (k === "z" || k === "Z" || k === "Backspace") undo();
  else if (k === "h" || k === "H") hint();
  else if (k === "r" || k === "R") restart();
  else if (k === "Escape" || k === "p" || k === "P") pause();
});

// ---------- 15. the screens and buttons ----------
function $(id) { return document.getElementById(id); }
let toastT = 0;
function toast(text, seconds = 2) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  toastT = seconds;
}

const clock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function showScreen(id) {
  for (const el of document.querySelectorAll(".overlay")) el.classList.toggle("hidden", el.id !== id);
  const menu = id && id !== "pause-screen";
  document.body.classList.toggle("in-menu", !!menu);
  if (!menu) requestAnimationFrame(layout);
}

function showStars(id, n) {
  $(id).innerHTML = [0, 1, 2].map(i => `<span class="${i < n ? "on" : ""}" style="animation-delay:${0.15 + i * 0.2}s">★</span>`).join("");
}

function updateClock() {
  $("time").textContent = clock(game.timeLeft);
  $("time-pill").classList.toggle("low", game.timeLeft < 15);
}

function updateHud() {
  const info = LEVELS[game.level];
  $("level-label").textContent = game.boss ? `${game.world.icon} Sour King · Round ${game.boss.round + 1}/3` : `${game.world.icon} ${info.name}`;
  $("moves").textContent = game.moves;
  $("target-pill").classList.toggle("hidden", !!game.boss);
  $("target").textContent = starTargets(game.par)[0];
  $("goals").textContent = `${game.flow.done}/${game.flow.goals}`;
  $("hint").innerHTML = `💡 Hint <small>${game.hintsLeft}</small>`;
  $("hint").disabled = game.hintsLeft <= 0;
  $("undo").disabled = !game.history.length;
  updateClock();
}

function buildMap() {
  const map = $("map");
  map.innerHTML = "";
  WORLDS.forEach((world, wi) => {
    const row = document.createElement("div");
    row.className = "world" + (world.boss ? " boss" : "");
    row.innerHTML = `<div class="world-name">${world.icon} ${world.name}</div>`;
    LEVELS.forEach((info, i) => {
      if (info.world !== wi) return;
      const btn = document.createElement("button");
      const stars = save.stars[i] || 0;
      btn.className = "lvl" + (stars ? " done" : "") + (info.boss ? " king" : "");
      btn.disabled = i > save.unlocked;
      btn.innerHTML = `${info.boss ? "🍋 Boss" : i + 1}<small>${"★".repeat(stars)}${"☆".repeat(3 - stars)}</small>`;
      btn.addEventListener("click", () => { audio(); startLevel(i); });
      row.appendChild(btn);
    });
    map.appendChild(row);
  });
  const total = save.stars.reduce((a, b) => a + (b || 0), 0);
  $("map-stars").textContent = `⭐ ${total} / ${LEVELS.length * 3}`;
}

function openMap() {
  game.state = "menu";
  game.after = null;
  buildMap();
  showScreen("map-screen");
}
function pause() {
  if (game.state !== "play") return;
  game.state = "paused";
  showScreen("pause-screen");
}
function resume() {
  if (game.state !== "paused") return;
  game.state = "play";
  showScreen(null);
}
function restart() {
  if (game.state === "play" || game.state === "paused" || game.state === "over") startLevel(game.level);
}
function toggleSound() {
  save.muted = !save.muted;
  writeSave();
  $("sound").textContent = save.muted ? "🔇" : "🔊";
  toast(save.muted ? "Sound off" : "Sound on", 1);
}

$("play").addEventListener("click", () => { audio(); openMap(); });
$("map-back").addEventListener("click", () => showScreen("title-screen"));
$("resume").addEventListener("click", resume);
$("pause-map").addEventListener("click", openMap);
$("pause-restart").addEventListener("click", restart);
$("next").addEventListener("click", () => startLevel(game.level + 1));
$("replay").addEventListener("click", () => startLevel(game.level));
$("clear-map").addEventListener("click", openMap);
$("retry").addEventListener("click", () => startLevel(game.level));
$("over-map").addEventListener("click", openMap);
$("end-map").addEventListener("click", openMap);
$("undo").addEventListener("click", undo);
$("hint").addEventListener("click", hint);
$("restart").addEventListener("click", restart);
$("pause").addEventListener("click", pause);
$("sound").addEventListener("click", toggleSound);
$("sound").textContent = save.muted ? "🔇" : "🔊";

window.addEventListener("resize", layout);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

layout();
drawHeroArt();
document.fonts?.ready.then(drawHeroArt);
requestAnimationFrame(frame);
