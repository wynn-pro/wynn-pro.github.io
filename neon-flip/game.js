"use strict";

// ================= Neon Flip =================
// Block stacking in space, but gravity can flip to any of the 4 sides of the board.
//
// The trick that keeps 4-way gravity simple: the game always thinks blocks fall DOWN.
// The grid is stored in a "gravity frame" where row 0 is the sky and row N-1 is the floor.
// When gravity flips, the grid is turned so every block stays in the same place on screen,
// and the board is drawn turned by the same amount. All the normal rules stay the same.

// ---------- settings ----------
const N = 14;                 // the board is square, so it's the same size whichever way gravity points
const CELL = 33;              // pixels per block
const BOARD_PX = N * CELL;
const LOCK_DELAY = 0.5;       // seconds a piece can slide on the floor before it locks
const MAX_LOCK_RESETS = 15;   // moving on the floor restarts the lock timer, but only this many times
const CLEAR_TIME = 0.3;       // how long full lines flash before they disappear
const COLLAPSE_STEP = 0.04;   // seconds per step while blocks fall to the new floor after a flip
const FLIP_WARNING = 3;       // seconds of countdown before gravity flips
const SLOWMO_TIME = 10;

// gravity directions, in the order the board turns (each one is a quarter turn more).
// dx/dy is the way blocks fall on screen, rx/ry is the way "move right" goes on screen.
const GRAVITY = [
  { name: "Down", dx: 0, dy: 1, rx: 1, ry: 0 },
  { name: "Left", dx: -1, dy: 0, rx: 0, ry: 1 },
  { name: "Up", dx: 0, dy: -1, rx: -1, ry: 0 },
  { name: "Right", dx: 1, dy: 0, rx: 0, ry: -1 },
];
const ARROWS = { "0,1": "⬇", "-1,0": "⬅", "0,-1": "⬆", "1,0": "➡" };

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
// X is junk the boss throws at you
const COLORS = {
  I: "#2ef6ff", O: "#ffe23d", T: "#c45cff", S: "#3dff8b",
  Z: "#ff3d7f", J: "#4d7cff", L: "#ff9b2e", X: "#6d6f9c",
};

const DIFFICULTIES = {
  easy: {
    label: "Easy", fall: 0.9, flipWait: [35, 50],
    bossEvery: 10, bossHp: 8, attackEvery: 16, junkRows: 1, meteors: 0,
    coinBonus: 1, scoreBonus: 1,
  },
  medium: {
    label: "Medium", fall: 0.65, flipWait: [25, 40],
    bossEvery: 12, bossHp: 14, attackEvery: 11, junkRows: 1, meteors: 3,
    coinBonus: 1.5, scoreBonus: 1.5,
  },
  hard: {
    label: "Hard", fall: 0.45, flipWait: [15, 28],
    bossEvery: 12, bossHp: 22, attackEvery: 7, junkRows: 2, meteors: 5,
    coinBonus: 2, scoreBonus: 2,
  },
};

// bosses come in this order, then start again with more health
const BOSSES = [
  { name: "Zorb the Blob", kind: "blob", color: "#3dff8b", eyes: 1 },
  { name: "Squidra", kind: "squid", color: "#c45cff", eyes: 2 },
  { name: "Black Hole King", kind: "king", color: "#ff3d7f", eyes: 3 },
];

// ---------- shop ----------
const POWERUPS = [
  { id: "lasers", icon: "🔫", name: "Laser", price: 40, info: "Blasts away the whole line on the floor. Press 1." },
  { id: "slowmos", icon: "🐢", name: "Slow-mo", price: 30, info: "Blocks fall half as fast for 10 seconds. Press 2." },
  { id: "hold2", icon: "📦", name: "Extra Hold slot", price: 150, info: "Keep 2 pieces on hold. Press V for the second one.", once: true },
];
const PETS = [
  { id: "scout", icon: "🛸", name: "Scout Ship", price: 120, every: 20, zaps: 1, color: "#7dfcff", info: "Zaps 1 block every 20 seconds." },
  { id: "wing", icon: "🚀", name: "Laser Wing", price: 300, every: 12, zaps: 1, color: "#ff6bf0", info: "Zaps 1 block every 12 seconds." },
  { id: "mother", icon: "🌟", name: "Mothership", price: 600, every: 8, zaps: 2, color: "#ffd84d", info: "Zaps 2 blocks every 8 seconds." },
];

// ---------- saved progress (coins, shop items, best score) ----------
const SAVE_KEY = "neonFlipSave";

function loadSave() {
  const fresh = {
    coins: 0, lasers: 1, slowmos: 1, hold2: false, pets: [], pet: null,
    best: 0, difficulty: "medium", sound: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved && typeof saved === "object" ? { ...fresh, ...saved } : fresh;
  } catch (error) {
    return fresh;
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    // private windows can block storage: progress just isn't remembered
  }
}

const save = loadSave();
if (!DIFFICULTIES[save.difficulty]) {
  save.difficulty = "medium";
}

// ---------- game state ----------
let state = "menu";        // "menu" | "playing" | "paused" | "over"
let diff = DIFFICULTIES[save.difficulty];
let grid = emptyGrid();    // grid[row][col] is null or a COLORS key, in the gravity frame
let current = null;        // the falling piece: {type, matrix, row, col}
let bag = [];
let queue = [];
let holds = [null];
let holdUsed = false;
let gravity = 0;           // index into GRAVITY
let phase = "falling";     // "falling" | "clearing" | "collapsing"
let clearingRows = [];
let clearTimer = 0;
let clearFromFlip = false;
let collapseTimer = 0;
let score = 0;
let lines = 0;
let level = 1;
let combo = 0;
let gameCoins = 0;
let dropTimer = 0;
let lockTimer = 0;
let lockResets = 0;
let flipTimer = 0;
let flipCountdown = 0;
let nextGravity = 0;
let boss = null;
let bossNumber = 0;
let bossesBeaten = 0;
let linesSinceBoss = 0;
let slowmoTime = 0;
let petTimer = 0;
let time = 0;              // seconds since the page loaded, for wobbly animations

// effects, all in screen pixels on the board
let particles = [];
let floaters = [];
let beams = [];
let bossBits = [];
let shake = 0;

function emptyGrid() {
  return Array.from({ length: N }, () => Array(N).fill(null));
}

function randomBetween(low, high) {
  return low + Math.random() * (high - low);
}

function randomInt(count) {
  return Math.floor(Math.random() * count);
}

// ---------- pieces ----------
function rotateMatrix(matrix) {
  // clockwise
  const size = matrix.length;
  return matrix.map((row, r) => row.map((_, c) => matrix[size - 1 - c][r]));
}

function fillQueue() {
  while (queue.length < 5) {
    if (!bag.length) {
      // every 7 pieces you get one of each, in a random order
      bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    queue.push(bag.pop());
  }
}

function pieceCells(piece, matrix = piece.matrix, dr = 0, dc = 0) {
  const cells = [];
  matrix.forEach((row, i) => row.forEach((filled, j) => {
    if (filled) {
      cells.push([piece.row + i + dr, piece.col + j + dc]);
    }
  }));
  return cells;
}

function collides(piece, dr = 0, dc = 0, matrix = piece.matrix) {
  return pieceCells(piece, matrix, dr, dc).some(([r, c]) =>
    r < 0 || r >= N || c < 0 || c >= N || grid[r][c]);
}

function spawn(type) {
  if (!type) {
    type = queue.shift();
  }
  fillQueue();
  const matrix = SHAPES[type].map((row) => [...row]);
  const topRow = matrix.findIndex((row) => row.some(Boolean));
  current = { type, matrix, row: -topRow, col: Math.floor((N - matrix.length) / 2) };
  holdUsed = false;
  dropTimer = 0;
  lockTimer = 0;
  lockResets = 0;
  if (collides(current)) {
    current = null;
    gameOver("Your stack reached the sky!");
  }
}

function canAct() {
  return state === "playing" && phase === "falling" && current;
}

function touchedFloor() {
  // moving or turning on the floor gives the player a little more time
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) {
    lockTimer = 0;
    lockResets++;
  }
}

function move(dc) {
  if (!canAct() || collides(current, 0, dc)) {
    return;
  }
  current.col += dc;
  touchedFloor();
  sfx("move");
}

function rotate(turns) {
  if (!canAct() || current.type === "O") {
    return;
  }
  let matrix = current.matrix;
  for (let i = 0; i < turns; i++) {
    matrix = rotateMatrix(matrix);
  }
  // if the turned piece hits something, try nudging it sideways or up a little
  for (const [dr, dc] of [[0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0]]) {
    if (!collides(current, dr, dc, matrix)) {
      current.matrix = matrix;
      current.row += dr;
      current.col += dc;
      touchedFloor();
      sfx("rotate");
      return;
    }
  }
}

function softDrop() {
  if (!canAct()) {
    return;
  }
  if (collides(current, 1, 0)) {
    lockPiece();
    return;
  }
  current.row++;
  dropTimer = 0;
  score += 1;
}

function hardDrop() {
  if (!canAct()) {
    return;
  }
  let rows = 0;
  while (!collides(current, 1, 0)) {
    current.row++;
    rows++;
  }
  score += rows * 2;
  lockPiece();
}

function ghostRow() {
  let rows = 0;
  while (!collides(current, rows + 1, 0)) {
    rows++;
  }
  return current.row + rows;
}

function hold(slot) {
  if (!canAct() || holdUsed || slot >= holds.length) {
    return;
  }
  const stored = holds[slot];
  holds[slot] = current.type;
  spawn(stored);
  holdUsed = true;
  sfx("rotate");
}

// what an arrow key (a direction on screen) does depends on which way gravity points
function screenArrow(dx, dy, repeat) {
  const g = GRAVITY[gravity];
  if (dx === g.dx && dy === g.dy) {
    softDrop();
  } else if (dx === -g.dx && dy === -g.dy) {
    if (!repeat) {
      rotate(1);
    }
  } else if (dx === g.rx && dy === g.ry) {
    move(1);
  } else {
    move(-1);
  }
}

// ---------- locking and clearing lines ----------
function lockPiece() {
  for (const [r, c] of pieceCells(current)) {
    grid[r][c] = current.type;
  }
  current = null;
  sfx("lock");
  const full = fullRows();
  if (full.length) {
    startClear(full, false);
  } else {
    combo = 0;
    spawn();
  }
}

function fullRows() {
  const rows = [];
  grid.forEach((row, r) => {
    if (row.every(Boolean)) {
      rows.push(r);
    }
  });
  return rows;
}

function startClear(rows, fromFlip) {
  phase = "clearing";
  clearingRows = rows;
  clearTimer = CLEAR_TIME;
  clearFromFlip = fromFlip;
  sfx("clear");
  for (const r of rows) {
    for (let c = 0; c < N; c++) {
      burst(cellToScreen(r, c), COLORS[grid[r][c]], 3);
    }
  }
}

function finishClear() {
  const count = clearingRows.length;
  grid = grid.filter((_, r) => !clearingRows.includes(r));
  while (grid.length < N) {
    grid.unshift(Array(N).fill(null));
  }
  clearingRows = [];
  phase = "falling";
  awardLines(count, clearFromFlip);
  if (state === "playing") {
    spawn();
  }
}

function awardLines(count, fromFlip) {
  combo++;
  lines += count;
  linesSinceBoss += count;
  const oldLevel = level;
  level = 1 + Math.floor(lines / 10);

  const base = count <= 4 ? [0, 100, 300, 500, 800][count] : count * 250;
  let points = base * oldLevel * (fromFlip ? 2 : 1);
  if (combo > 1) {
    points += 50 * (combo - 1) * oldLevel;
  }
  points = Math.round(points * diff.scoreBonus);
  score += points;

  const coins = Math.round((count + (count >= 4 ? 3 : 0)) * (fromFlip ? 2 : 1) * diff.coinBonus);
  addCoins(coins);

  const middle = BOARD_PX / 2;
  if (fromFlip) {
    floater("FLIP CLEAR ×2!", middle, middle - 40, "#ff3dd8", 26);
  } else if (count >= 4) {
    floater("NEON FLIP!", middle, middle - 40, "#2ef6ff", 30);
  } else if (combo > 1) {
    floater(`COMBO ×${combo}`, middle, middle - 40, "#ffe23d", 22);
  }
  floater(`+${points.toLocaleString()}`, middle, middle, "#ffffff", 24);
  floater(`+${coins} 🪙`, middle, middle + 30, "#ffe23d", 18);
  if (level > oldLevel) {
    floater(`LEVEL ${level}`, middle, middle + 70, "#3dff8b", 24);
  }

  if (boss) {
    const damage = (count <= 4 ? [0, 1, 3, 5, 8][count] : count * 2) * (fromFlip ? 2 : 1);
    hitBoss(damage);
  } else if (linesSinceBoss >= diff.bossEvery) {
    summonBoss();
  }
}

function addCoins(amount) {
  save.coins += amount;
  gameCoins += amount;
  writeSave();
  updateWallet();
}

// ---------- gravity flips ----------
function rotateGrid(old, turns) {
  // turns the grid a quarter turn at a time, the same way the board is drawn turned
  let result = old;
  for (let t = 0; t < turns; t++) {
    const turned = emptyGrid();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        turned[c][N - 1 - r] = result[r][c];
      }
    }
    result = turned;
  }
  return result;
}

function randomFlipWait() {
  return randomBetween(...diff.flipWait);
}

function startFlipCountdown() {
  nextGravity = (gravity + 1 + randomInt(3)) % 4;
  flipCountdown = FLIP_WARNING;
  sfx("alarm");
}

function doFlip() {
  // turning the grid by (old - new) keeps every block where it is on screen
  grid = rotateGrid(grid, (gravity - nextGravity + 4) % 4);
  if (current) {
    queue.unshift(current.type);   // the falling piece warps back and comes again after the flip
    current = null;
  }
  gravity = nextGravity;
  phase = "collapsing";
  collapseTimer = 0;
  flipTimer = randomFlipWait();
  shake = 0.5;
  sfx("flip");
  floater(`GRAVITY ${gravityArrow()}`, BOARD_PX / 2, BOARD_PX / 2, "#2ef6ff", 34);
  renderControls();
}

function collapseStep() {
  // every block with empty space under it falls one row. Returns true if anything moved.
  let moved = false;
  for (let r = N - 2; r >= 0; r--) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] && !grid[r + 1][c]) {
        grid[r + 1][c] = grid[r][c];
        grid[r][c] = null;
        moved = true;
      }
    }
  }
  return moved;
}

function gravityArrow(index = gravity) {
  const g = GRAVITY[index];
  return ARROWS[`${g.dx},${g.dy}`];
}

// ---------- boss ----------
function summonBoss() {
  bossNumber++;
  const type = BOSSES[(bossNumber - 1) % BOSSES.length];
  const hp = Math.round(diff.bossHp * (1 + 0.5 * (bossNumber - 1)));
  boss = { ...type, hp, maxHp: hp, attackTimer: diff.attackEvery, attacks: 0, flash: 0, t: 0 };
  sfx("boss");
  shake = 0.4;
  floater("⚠ BOSS ⚠", BOARD_PX / 2, BOARD_PX / 2 - 20, "#ff3d6a", 34);
  floater(boss.name, BOARD_PX / 2, BOARD_PX / 2 + 20, "#ffffff", 20);
  toast(`${boss.name} is here! Clear lines to hurt it.`);
}

function hitBoss(damage) {
  if (!boss || damage <= 0) {
    return;
  }
  boss.hp -= damage;
  boss.flash = 0.25;
  sfx("hit");
  if (boss.hp <= 0) {
    defeatBoss();
  }
}

function defeatBoss() {
  bossesBeaten++;
  const coins = Math.round(25 * bossNumber * diff.coinBonus);
  const points = Math.round(2000 * bossNumber * diff.scoreBonus);
  score += points;
  addCoins(coins);
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(40, 160);
    bossBits.push({
      x: 88, y: 65, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, color: i % 2 ? boss.color : "#ffffff",
    });
  }
  floater("BOSS DEFEATED!", BOARD_PX / 2, BOARD_PX / 2 - 20, "#3dff8b", 30);
  floater(`+${points.toLocaleString()}  +${coins} 🪙`, BOARD_PX / 2, BOARD_PX / 2 + 20, "#ffe23d", 20);
  sfx("win");
  boss = null;
  linesSinceBoss = 0;
}

function bossAttack() {
  const useMeteors = diff.meteors > 0 && boss.attacks % 2 === 1;
  boss.attacks++;
  shake = 0.3;
  sfx("attack");
  if (useMeteors) {
    dropMeteors(diff.meteors);
    floater("☄ METEORS!", BOARD_PX / 2, 60, "#ff9b2e", 22);
  } else {
    addJunkRows(diff.junkRows);
    floater("JUNK ATTACK!", BOARD_PX / 2, 60, "#ff3d6a", 22);
  }
}

function addJunkRows(count) {
  for (let i = 0; i < count; i++) {
    if (grid[0].some(Boolean)) {
      gameOver(`${boss.name} buried you in junk!`);
      return;
    }
    grid.shift();
    const gap = randomInt(N);
    grid.push(Array.from({ length: N }, (_, c) => (c === gap ? null : "X")));
  }
  if (current) {
    // push the falling piece up out of the way
    let tries = count;
    while (collides(current) && tries-- > 0) {
      current.row--;
    }
    if (collides(current)) {
      gameOver(`${boss.name} buried you in junk!`);
    }
  }
}

function dropMeteors(count) {
  const pieceColumns = current ? pieceCells(current).map(([, c]) => c) : [];
  for (let i = 0; i < count; i++) {
    const c = randomInt(N);
    if (pieceColumns.includes(c)) {
      continue;   // don't drop a meteor through the falling piece
    }
    let top = grid.findIndex((row) => row[c]);
    if (top === -1) {
      top = N;
    }
    if (top === 0) {
      continue;   // this column is full
    }
    grid[top - 1][c] = "X";
    burst(cellToScreen(top - 1, c), "#ff9b2e", 8);
  }
}

// ---------- power-ups and pets ----------
function useLaser() {
  if (!canAct() || save.lasers <= 0) {
    return;
  }
  save.lasers--;
  writeSave();
  const floor = N - 1;
  for (let c = 0; c < N; c++) {
    if (grid[floor][c]) {
      burst(cellToScreen(floor, c), COLORS[grid[floor][c]], 3);
    }
  }
  const start = cellToScreen(floor, 0);
  const end = cellToScreen(floor, N - 1);
  beams.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, life: 0.35, color: "#ff3dd8", width: CELL });
  grid.pop();
  grid.unshift(Array(N).fill(null));
  let tries = 2;
  while (collides(current) && tries-- > 0) {
    current.row--;
  }
  sfx("laser");
  hitBoss(2);
  updatePowerups();
}

function useSlowmo() {
  if (!canAct() || save.slowmos <= 0 || slowmoTime > 0) {
    return;
  }
  save.slowmos--;
  writeSave();
  slowmoTime = SLOWMO_TIME;
  sfx("slowmo");
  floater("SLOW-MO", BOARD_PX / 2, BOARD_PX / 2, "#3dff8b", 28);
  updatePowerups();
}

function equippedPet() {
  return PETS.find((pet) => pet.id === save.pet && save.pets.includes(pet.id)) || null;
}

function petPosition() {
  // the pet flies a loop over the board
  return {
    x: BOARD_PX / 2 + Math.cos(time * 0.7) * BOARD_PX * 0.36,
    y: BOARD_PX / 2 + Math.sin(time * 1.1) * BOARD_PX * 0.3,
  };
}

function petZap(pet) {
  for (let z = 0; z < pet.zaps; z++) {
    // aim at the highest block, junk first
    const top = grid.findIndex((row) => row.some(Boolean));
    if (top === -1) {
      return;
    }
    const columns = grid[top].map((cell, c) => (cell ? c : -1)).filter((c) => c >= 0);
    const junk = columns.filter((c) => grid[top][c] === "X");
    const choices = junk.length ? junk : columns;
    const c = choices[randomInt(choices.length)];
    const from = petPosition();
    const to = cellToScreen(top, c);
    beams.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, life: 0.25, color: pet.color, width: 4 });
    burst(to, COLORS[grid[top][c]], 10);
    grid[top][c] = null;
    sfx("zap");
    hitBoss(1);
  }
}

// ---------- starting, pausing and ending ----------
function newGame() {
  diff = DIFFICULTIES[save.difficulty];
  grid = emptyGrid();
  bag = [];
  queue = [];
  fillQueue();
  holds = save.hold2 ? [null, null] : [null];
  gravity = 0;
  phase = "falling";
  clearingRows = [];
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  gameCoins = 0;
  flipTimer = randomFlipWait();
  flipCountdown = 0;
  boss = null;
  bossNumber = 0;
  bossesBeaten = 0;
  linesSinceBoss = 0;
  slowmoTime = 0;
  petTimer = equippedPet()?.every || 0;
  particles = [];
  floaters = [];
  beams = [];
  bossBits = [];
  pendingScore = null;
  lastEntry = null;
  state = "playing";
  showScreen(null);
  document.activeElement?.blur();   // so Space doesn't press the button that was just clicked
  spawn();
  renderControls();
  updatePowerups();
  updateHud();
}

function pauseGame() {
  if (state !== "playing") {
    return;
  }
  state = "paused";
  showScreen("pause-screen");
}

function resumeGame() {
  if (state !== "paused") {
    return;
  }
  state = "playing";
  showScreen(null);
  document.activeElement?.blur();
}

function quitToMenu() {
  state = "menu";
  current = null;
  boss = null;
  flipCountdown = 0;
  grid = emptyGrid();
  gravity = 0;
  renderControls();
  showScreen("menu-screen");
  updateMenu();
}

function gameOver(reason) {
  if (state === "over") {
    return;
  }
  state = "over";
  current = null;
  flipCountdown = 0;
  shake = 0.6;
  sfx("over");
  save.best = Math.max(save.best, score);
  writeSave();
  overReason.textContent = reason;
  overScore.textContent = score.toLocaleString();
  overLines.textContent = lines;
  overBosses.textContent = bossesBeaten;
  overCoins.textContent = gameCoins;
  // wait a moment so the player can see what happened
  setTimeout(() => {
    if (state !== "over") {
      return;
    }
    showScreen("over-screen");
    if (makesLeaderboard(score)) {
      pendingScore = { score, lines, difficulty: diff.label };
      askForName();
    } else {
      nameForm.hidden = true;
    }
  }, 900);
  refreshLeaderboard();
}

// ---------- the main loop ----------
function fallInterval() {
  const interval = Math.max(0.06, diff.fall * Math.pow(0.85, level - 1));
  return slowmoTime > 0 ? interval * 2 : interval;
}

function update(dt) {
  time += dt;
  shake = Math.max(0, shake - dt);
  updateEffects(dt);
  if (state !== "playing") {
    return;
  }

  slowmoTime = Math.max(0, slowmoTime - dt);

  // gravity flips: wait, then count down 3-2-1, then flip
  if (flipCountdown > 0) {
    const before = Math.ceil(flipCountdown);
    flipCountdown -= dt;
    if (Math.ceil(flipCountdown) !== before && flipCountdown > 0) {
      sfx("tick");
    }
    if (flipCountdown <= 0) {
      if (phase === "falling") {
        doFlip();
      } else {
        flipCountdown = 0.01;   // wait for the lines to finish clearing
      }
    }
  } else if (phase === "falling") {
    flipTimer -= dt;
    if (flipTimer <= 0) {
      startFlipCountdown();
    }
  }

  if (phase === "clearing") {
    clearTimer -= dt;
    if (clearTimer <= 0) {
      finishClear();
    }
  } else if (phase === "collapsing") {
    collapseTimer -= dt;
    if (collapseTimer <= 0) {
      collapseTimer = COLLAPSE_STEP;
      if (!collapseStep()) {
        const full = fullRows();
        if (full.length) {
          startClear(full, true);
        } else {
          phase = "falling";
          spawn();
        }
      }
    }
  } else if (current) {
    if (collides(current, 1, 0)) {
      lockTimer += dt;
      if (lockTimer >= LOCK_DELAY) {
        lockPiece();
      }
    } else {
      dropTimer += dt;
      if (dropTimer >= fallInterval()) {
        dropTimer = 0;
        current.row++;
        lockTimer = 0;
      }
    }
  }
  if (state !== "playing") {
    return;
  }

  if (boss) {
    boss.flash = Math.max(0, boss.flash - dt);
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0 && phase === "falling") {
      boss.attackTimer = diff.attackEvery;
      bossAttack();
    }
  }
  if (state !== "playing") {
    return;
  }

  const pet = equippedPet();
  if (pet) {
    petTimer -= dt;
    if (petTimer <= 0 && phase === "falling") {
      petTimer = pet.every;
      petZap(pet);
    }
  }
}

function updateEffects(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const f of floaters) {
    f.y -= 30 * dt;
    f.life -= dt;
  }
  floaters = floaters.filter((f) => f.life > 0);
  for (const b of beams) {
    b.life -= dt;
  }
  beams = beams.filter((b) => b.life > 0);
  for (const b of bossBits) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  bossBits = bossBits.filter((b) => b.life > 0);
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);   // a long pause shouldn't jump the game ahead
  lastFrame = now;
  update(dt);
  drawStars(dt);
  drawBoard();
  drawPreviews();
  drawBoss(dt);
  updateHud();
  requestAnimationFrame(frame);
}

// ---------- effects ----------
function cellToScreen(r, c) {
  // the middle of a grid cell, turned from the gravity frame to the screen
  let x = c * CELL + CELL / 2 - BOARD_PX / 2;
  let y = r * CELL + CELL / 2 - BOARD_PX / 2;
  for (let t = 0; t < gravity; t++) {
    [x, y] = [-y, x];
  }
  return { x: x + BOARD_PX / 2, y: y + BOARD_PX / 2 };
}

function burst(at, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(40, 200);
    const life = randomBetween(0.4, 0.8);
    particles.push({
      x: at.x, y: at.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life, max: life, color, size: randomBetween(2, 4),
    });
  }
}

function floater(text, x, y, color, size) {
  floaters.push({ text, x, y, color, size, life: 1.3 });
}

function toast(message, kind = "") {
  const note = document.createElement("div");
  note.className = `toast ${kind}`;
  note.textContent = message;
  toasts.appendChild(note);
  setTimeout(() => note.remove(), 3200);
}

// ---------- drawing ----------
const dpr = Math.min(window.devicePixelRatio || 1, 2);

function setupCanvas(canvas, width, height) {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function roundRect(context, x, y, w, h, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

// glowing blocks are slow to draw, so each colour and size is drawn once and copied after that
const sprites = new Map();
const GLOW = 8;

function blockSprite(color, size) {
  const key = `${color}-${size}`;
  if (sprites.has(key)) {
    return sprites.get(key);
  }
  const sprite = document.createElement("canvas");
  const g = setupCanvas(sprite, size + GLOW * 2, size + GLOW * 2);
  g.shadowColor = color;
  g.shadowBlur = GLOW;
  g.fillStyle = color;
  roundRect(g, GLOW + 1, GLOW + 1, size - 2, size - 2, size * 0.18);
  g.fill();
  g.shadowBlur = 0;
  const shine = g.createLinearGradient(0, GLOW, 0, GLOW + size);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.55)");
  shine.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
  shine.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  g.fillStyle = shine;
  roundRect(g, GLOW + 1, GLOW + 1, size - 2, size - 2, size * 0.18);
  g.fill();
  g.fillStyle = "rgba(10, 6, 30, 0.35)";
  const inset = size * 0.25;
  roundRect(g, GLOW + inset, GLOW + inset, size - inset * 2, size - inset * 2, size * 0.1);
  g.fill();
  sprites.set(key, sprite);
  return sprite;
}

function drawBlock(context, x, y, size, color, alpha = 1) {
  context.globalAlpha = alpha;
  context.drawImage(blockSprite(color, size), x - GLOW, y - GLOW, size + GLOW * 2, size + GLOW * 2);
  context.globalAlpha = 1;
}

function drawBoard() {
  const g = boardCtx;
  g.clearRect(0, 0, BOARD_PX, BOARD_PX);
  g.save();
  if (shake > 0) {
    g.translate(randomBetween(-1, 1) * shake * 10, randomBetween(-1, 1) * shake * 10);
  }
  g.fillStyle = "rgba(8, 5, 28, 0.85)";
  g.fillRect(0, 0, BOARD_PX, BOARD_PX);

  // everything in the gravity frame is drawn turned, so "down" points at the real floor
  g.save();
  g.translate(BOARD_PX / 2, BOARD_PX / 2);
  g.rotate((gravity * Math.PI) / 2);
  g.translate(-BOARD_PX / 2, -BOARD_PX / 2);

  g.strokeStyle = "rgba(120, 90, 255, 0.12)";
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < N; i++) {
    g.moveTo(i * CELL, 0);
    g.lineTo(i * CELL, BOARD_PX);
    g.moveTo(0, i * CELL);
    g.lineTo(BOARD_PX, i * CELL);
  }
  g.stroke();

  // the glowing floor
  const floorGlow = g.createLinearGradient(0, BOARD_PX - 24, 0, BOARD_PX);
  floorGlow.addColorStop(0, "rgba(46, 246, 255, 0)");
  floorGlow.addColorStop(1, "rgba(46, 246, 255, 0.55)");
  g.fillStyle = floorGlow;
  g.fillRect(0, BOARD_PX - 24, BOARD_PX, 24);
  g.fillStyle = "#2ef6ff";
  g.shadowColor = "#2ef6ff";
  g.shadowBlur = 12;
  g.fillRect(0, BOARD_PX - 3, BOARD_PX, 3);
  g.shadowBlur = 0;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) {
        drawBlock(g, c * CELL, r * CELL, CELL, COLORS[grid[r][c]]);
      }
    }
  }

  if (phase === "clearing") {
    g.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.4 * Math.sin(time * 40)})`;
    for (const r of clearingRows) {
      g.fillRect(0, r * CELL, BOARD_PX, CELL);
    }
  }

  if (current && state !== "menu") {
    const ghost = ghostRow();
    g.strokeStyle = COLORS[current.type];
    g.globalAlpha = 0.45;
    g.lineWidth = 2;
    for (const [r, c] of pieceCells(current, current.matrix, ghost - current.row, 0)) {
      g.strokeRect(c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6);
    }
    g.globalAlpha = 1;
    for (const [r, c] of pieceCells(current)) {
      drawBlock(g, c * CELL, r * CELL, CELL, COLORS[current.type]);
    }
  }
  g.restore();

  // the rest is drawn straight on the screen
  if (slowmoTime > 0) {
    g.fillStyle = "rgba(61, 255, 139, 0.06)";
    g.fillRect(0, 0, BOARD_PX, BOARD_PX);
  }

  for (const b of beams) {
    g.globalAlpha = Math.min(1, b.life * 4);
    g.strokeStyle = b.color;
    g.shadowColor = b.color;
    g.shadowBlur = 16;
    g.lineWidth = b.width;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(b.x1, b.y1);
    g.lineTo(b.x2, b.y2);
    g.stroke();
  }
  g.shadowBlur = 0;
  g.globalAlpha = 1;

  for (const p of particles) {
    g.globalAlpha = Math.max(0, p.life / p.max);
    g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;

  const pet = equippedPet();
  if (pet && state !== "menu") {
    drawPet(g, pet);
  }

  if (flipCountdown > 0) {
    drawFlipWarning(g);
  }

  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const f of floaters) {
    g.globalAlpha = Math.min(1, f.life * 2);
    g.font = `900 ${f.size}px Orbitron, sans-serif`;
    g.fillStyle = f.color;
    g.shadowColor = f.color;
    g.shadowBlur = 12;
    g.fillText(f.text, f.x, f.y);
  }
  g.shadowBlur = 0;
  g.globalAlpha = 1;
  g.restore();
}

function drawPet(g, pet) {
  const { x, y } = petPosition();
  // point the ship the way it's flying
  const vx = -Math.sin(time * 0.7) * 0.7 * 0.36;
  const vy = Math.cos(time * 1.1) * 1.1 * 0.3;
  g.save();
  g.translate(x, y);
  g.rotate(Math.atan2(vy, vx));
  g.shadowColor = pet.color;
  g.shadowBlur = 14;
  g.fillStyle = pet.color;
  g.beginPath();
  g.moveTo(14, 0);
  g.lineTo(-10, -9);
  g.lineTo(-5, 0);
  g.lineTo(-10, 9);
  g.closePath();
  g.fill();
  if (pet.id === "mother") {
    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.strokeStyle = pet.color;
    g.lineWidth = 2;
    g.stroke();
  }
  g.fillStyle = "#ff9b2e";
  g.beginPath();
  g.arc(-8, 0, 3 + Math.random() * 2, 0, Math.PI * 2);   // engine flame
  g.fill();
  g.restore();
}

function drawFlipWarning(g) {
  const middle = BOARD_PX / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 14);
  g.fillStyle = `rgba(255, 61, 216, ${0.08 + pulse * 0.08})`;
  g.fillRect(0, 0, BOARD_PX, BOARD_PX);

  // light up the edge that will become the floor
  const next = GRAVITY[nextGravity];
  g.fillStyle = `rgba(255, 61, 216, ${0.5 + pulse * 0.5})`;
  g.shadowColor = "#ff3dd8";
  g.shadowBlur = 20;
  const edge = 6;
  if (next.dy === 1) g.fillRect(0, BOARD_PX - edge, BOARD_PX, edge);
  if (next.dy === -1) g.fillRect(0, 0, BOARD_PX, edge);
  if (next.dx === 1) g.fillRect(BOARD_PX - edge, 0, edge, BOARD_PX);
  if (next.dx === -1) g.fillRect(0, 0, edge, BOARD_PX);

  // a big arrow pointing at the new floor
  g.save();
  g.translate(middle, middle);
  g.rotate((nextGravity * Math.PI) / 2);
  g.globalAlpha = 0.85;
  g.fillStyle = "#ff3dd8";
  g.beginPath();
  g.moveTo(-22, -60);
  g.lineTo(22, -60);
  g.lineTo(22, 10);
  g.lineTo(50, 10);
  g.lineTo(0, 70);
  g.lineTo(-50, 10);
  g.lineTo(-22, 10);
  g.closePath();
  g.fill();
  g.restore();
  g.globalAlpha = 1;

  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.font = "900 64px Orbitron, sans-serif";
  g.fillText(Math.ceil(flipCountdown), middle, middle);
  g.font = "900 20px Orbitron, sans-serif";
  g.fillText("GRAVITY FLIP!", middle, 40);
  g.shadowBlur = 0;
}

function drawPiecePreview(g, type, x, y, size, alpha) {
  const cells = [];
  SHAPES[type].forEach((row, r) => row.forEach((filled, c) => {
    if (filled) {
      cells.push([r, c]);
    }
  }));
  const top = Math.min(...cells.map(([r]) => r));
  const left = Math.min(...cells.map(([, c]) => c));
  const width = (Math.max(...cells.map(([, c]) => c)) - left + 1) * size;
  const height = (Math.max(...cells.map(([r]) => r)) - top + 1) * size;
  for (const [r, c] of cells) {
    drawBlock(g, x - width / 2 + (c - left) * size, y - height / 2 + (r - top) * size, size, COLORS[type], alpha);
  }
}

function drawPreviews() {
  nextCtx.clearRect(0, 0, 176, 190);
  if (state !== "menu") {
    queue.slice(0, 3).forEach((type, i) => {
      drawPiecePreview(nextCtx, type, 88, 34 + i * 62, i === 0 ? 22 : 17, i === 0 ? 1 : 0.7);
    });
  }
  holdCtxs.forEach((g, slot) => {
    g.clearRect(0, 0, 72, 52);
    if (holds[slot]) {
      drawPiecePreview(g, holds[slot], 36, 26, 14, holdUsed ? 0.35 : 1);
    }
  });
}

function drawBoss(dt) {
  const g = bossCtx;
  const W = 176;
  const H = 130;
  g.clearRect(0, 0, W, H);
  for (const b of bossBits) {
    g.globalAlpha = Math.max(0, b.life);
    g.fillStyle = b.color;
    g.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  g.globalAlpha = 1;
  if (!boss) {
    return;
  }
  boss.t += dt;
  const t = boss.t;
  const cx = W / 2;
  const cy = H / 2 - 4 + Math.sin(t * 2) * 5;
  const radius = 34;
  const charging = boss.attackTimer < 2;
  const body = boss.flash > 0 ? "#ffffff" : boss.color;

  g.save();
  g.shadowColor = boss.color;
  g.shadowBlur = charging ? 24 + Math.sin(t * 20) * 10 : 14;
  g.strokeStyle = body;
  g.fillStyle = body;
  g.lineCap = "round";

  if (boss.kind === "squid") {
    g.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const startX = cx - 25 + i * 10;
      g.beginPath();
      g.moveTo(startX, cy + 20);
      g.quadraticCurveTo(startX + Math.sin(t * 4 + i) * 14, cy + 40, startX + Math.sin(t * 3 + i) * 8, cy + 56);
      g.stroke();
    }
  } else if (boss.kind === "blob") {
    for (let i = 0; i < 5; i++) {
      const dripY = cy + radius - 4 + ((t * 30 + i * 13) % 26);
      g.beginPath();
      g.arc(cx - 24 + i * 12, dripY, 4, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // the king has a ring around him
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(cx, cy + 4, radius + 22, 12, Math.sin(t) * 0.15, 0, Math.PI * 2);
    g.stroke();
  }

  const shade = g.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, radius);
  shade.addColorStop(0, "#ffffff");
  shade.addColorStop(0.25, body);
  shade.addColorStop(1, "rgba(20, 5, 40, 1)");
  g.fillStyle = shade;
  g.beginPath();
  if (boss.kind === "blob") {
    // wobbly blob
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) {
      const wobble = radius + Math.sin(a * 5 + t * 4) * 3;
      g.lineTo(cx + Math.cos(a) * wobble, cy + Math.sin(a) * wobble);
    }
  } else {
    g.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  g.fill();

  if (boss.kind === "king") {
    // crown
    g.fillStyle = "#ffe23d";
    g.shadowColor = "#ffe23d";
    g.beginPath();
    g.moveTo(cx - 20, cy - radius + 6);
    g.lineTo(cx - 22, cy - radius - 16);
    g.lineTo(cx - 10, cy - radius - 4);
    g.lineTo(cx, cy - radius - 20);
    g.lineTo(cx + 10, cy - radius - 4);
    g.lineTo(cx + 22, cy - radius - 16);
    g.lineTo(cx + 20, cy - radius + 6);
    g.closePath();
    g.fill();
  }
  g.shadowBlur = 0;

  // eyes look toward the board
  const eyeY = cy - 6;
  const spacing = 18;
  for (let i = 0; i < boss.eyes; i++) {
    const eyeX = cx + (i - (boss.eyes - 1) / 2) * spacing;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(eyeX, eyeY, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = charging ? "#ff3d6a" : "#120624";
    g.beginPath();
    g.arc(eyeX - 2 + Math.sin(t) * 1.5, eyeY + 1, 3.5, 0, Math.PI * 2);
    g.fill();
  }

  // mouth: a grin, or wide open with teeth when it's about to attack
  g.strokeStyle = "#120624";
  g.fillStyle = "#120624";
  g.lineWidth = 3;
  if (charging) {
    g.beginPath();
    g.ellipse(cx, cy + 15, 14, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(cx - 10 + i * 6, cy + 8);
      g.lineTo(cx - 7 + i * 6, cy + 13);
      g.lineTo(cx - 4 + i * 6, cy + 8);
      g.fill();
    }
  } else {
    g.beginPath();
    g.arc(cx, cy + 6, 12, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  }
  g.restore();
}

// stars stream past in the direction gravity is pulling
const stars = Array.from({ length: 150 }, () => ({
  x: Math.random(), y: Math.random(), z: randomBetween(0.2, 1),
}));

function drawStars(dt) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const g = starsCtx;
  g.clearRect(0, 0, width, height);
  const pull = GRAVITY[gravity];
  const speed = state === "playing" ? 0.04 : 0.015;
  for (const s of stars) {
    s.x = (s.x + pull.dx * s.z * dt * speed + 1) % 1;
    s.y = (s.y + pull.dy * s.z * dt * speed + 1) % 1;
    const x = s.x * width;
    const y = s.y * height;
    g.strokeStyle = `rgba(200, 220, 255, ${s.z * 0.8})`;
    g.lineWidth = s.z * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - pull.dx * s.z * 8, y - pull.dy * s.z * 8);
    g.stroke();
  }
}

function resizeStars() {
  starsCtx = setupCanvas(starsCanvas, window.innerWidth, window.innerHeight);
}

// ---------- HUD and panels ----------
function setText(element, text) {
  const value = String(text);
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function updateHud() {
  setText(scoreEl, score.toLocaleString());
  setText(linesEl, lines);
  setText(levelEl, level);
  setText(modeEl, diff.label);
  setText(gravityTag, `Gravity ${gravityArrow()} ${GRAVITY[gravity].name}`);

  if (boss) {
    bossPanel.classList.add("active");
    bossPanel.classList.toggle("charging", boss.attackTimer < 2);
    bossBar.hidden = false;
    setText(bossName, boss.name);
    bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    setText(bossHp, `${Math.max(0, boss.hp)} / ${boss.maxHp}`);
    setText(bossNote, `Attacks in ${Math.max(0, Math.ceil(boss.attackTimer))}s`);
  } else {
    bossPanel.classList.remove("active", "charging");
    bossBar.hidden = true;
    setText(bossName, "Boss");
    setText(bossNote, state === "menu"
      ? "Bosses appear as you clear lines."
      : `Next boss in ${Math.max(0, diff.bossEvery - linesSinceBoss)} lines`);
  }

  slowmoBar.hidden = slowmoTime <= 0;
  slowmoFill.style.width = `${(slowmoTime / SLOWMO_TIME) * 100}%`;
}

function updateWallet() {
  for (const element of document.querySelectorAll(".coin-total")) {
    setText(element, save.coins.toLocaleString());
  }
  setText(coinsEl, save.coins.toLocaleString());
}

function updatePowerups() {
  setText(laserCount, save.lasers);
  setText(slowmoCount, save.slowmos);
  laserBtn.disabled = save.lasers <= 0;
  slowmoBtn.disabled = save.slowmos <= 0;
  hold1Canvas.hidden = !save.hold2;
  hold2Hint.hidden = !save.hold2;
  const pet = equippedPet();
  setText(petInfo, pet ? `${pet.icon} ${pet.name}: ${pet.info}` : "No pet yet. Buy one in the shop!");
}

function renderControls() {
  const g = GRAVITY[gravity];
  const arrow = (x, y) => ARROWS[`${x},${y}`];
  setText(ctlMove, `${arrow(-g.rx, -g.ry)} ${arrow(g.rx, g.ry)}`);
  setText(ctlTurn, arrow(-g.dx, -g.dy));
  setText(ctlDrop, arrow(g.dx, g.dy));
}

function updateMenu() {
  for (const button of difficultyButtons) {
    button.setAttribute("aria-checked", String(button.dataset.difficulty === save.difficulty));
  }
  setText(bestEl, save.best.toLocaleString());
  updateWallet();
}

let shopReturn = "menu-screen";   // where the Back button in the shop goes

function showScreen(id) {
  for (const screen of document.querySelectorAll(".screen")) {
    screen.hidden = screen.id !== id;
  }
}

function openShop(from) {
  shopReturn = from;
  renderShop();
  showScreen("shop-screen");
}

function closeShop() {
  showScreen(shopReturn);
  if (shopReturn === "menu-screen") {
    updateMenu();
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function shopCard(item, isPet) {
  const card = makeElement("div", "shop-card");
  card.append(
    makeElement("span", "icon", item.icon),
    makeElement("span", "name", item.name),
    makeElement("span", "info", isPet ? `${item.info} Hits bosses too.` : item.info),
  );
  const button = makeElement("button", "");
  if (isPet) {
    const owned = save.pets.includes(item.id);
    if (owned && save.pet === item.id) {
      card.classList.add("equipped");
      card.append(makeElement("span", "owned", "Flying with you"));
      button.textContent = "Unequip";
    } else if (owned) {
      card.append(makeElement("span", "owned", "Owned"));
      button.textContent = "Equip";
    } else {
      button.textContent = `Buy 🪙 ${item.price}`;
      button.disabled = save.coins < item.price;
    }
  } else if (item.once && save[item.id]) {
    card.append(makeElement("span", "owned", "Owned"));
    button.textContent = "Owned";
    button.disabled = true;
  } else {
    if (!item.once) {
      card.append(makeElement("span", "owned", `You have ${save[item.id]}`));
    }
    button.textContent = `Buy 🪙 ${item.price}`;
    button.disabled = save.coins < item.price;
  }
  button.addEventListener("click", () => buy(item, isPet));
  card.append(button);
  return card;
}

function renderShop() {
  shopPowerups.replaceChildren(...POWERUPS.map((item) => shopCard(item, false)));
  shopPets.replaceChildren(...PETS.map((pet) => shopCard(pet, true)));
  updateWallet();
}

function buy(item, isPet) {
  if (isPet && save.pets.includes(item.id)) {
    save.pet = save.pet === item.id ? null : item.id;
    petTimer = item.every;
  } else {
    if (save.coins < item.price || (item.once && save[item.id])) {
      return;
    }
    save.coins -= item.price;
    if (isPet) {
      save.pets.push(item.id);
      save.pet = item.id;
      petTimer = item.every;
    } else if (item.once) {
      save[item.id] = true;
    } else {
      save[item.id]++;
    }
    sfx("coin");
  }
  if (item.id === "hold2" && holds.length < 2) {
    holds.push(null);   // bought during a game: the slot works right away
  }
  writeSave();
  renderShop();
  updatePowerups();
}

// ---------- sound ----------
// little synth beeps: [start pitch, seconds, wave, volume, end pitch]
const SOUNDS = {
  move: [260, 0.03, "square", 0.025],
  rotate: [520, 0.05, "square", 0.035],
  lock: [130, 0.08, "triangle", 0.09],
  clear: [660, 0.3, "sawtooth", 0.06, 1320],
  alarm: [880, 0.25, "square", 0.06, 440],
  tick: [990, 0.08, "square", 0.05],
  flip: [900, 0.6, "sawtooth", 0.07, 70],
  boss: [110, 0.7, "sawtooth", 0.1, 40],
  attack: [200, 0.35, "sawtooth", 0.08, 60],
  hit: [320, 0.12, "square", 0.07, 160],
  win: [440, 0.6, "triangle", 0.1, 1760],
  coin: [1200, 0.12, "square", 0.05, 1800],
  zap: [1600, 0.15, "sawtooth", 0.04, 500],
  laser: [2200, 0.4, "sawtooth", 0.06, 200],
  slowmo: [600, 0.5, "sine", 0.08, 150],
  over: [400, 1.1, "triangle", 0.1, 60],
};
let audio = null;

function sfx(name) {
  if (!save.sound) {
    return;
  }
  const [start, length, wave, volume, end] = SOUNDS[name];
  try {
    audio ||= new AudioContext();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(start, now);
    if (end) {
      osc.frequency.exponentialRampToValueAtTime(end, now + length);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + length);
  } catch (error) {
    // no sound on this browser, that's fine
  }
}

function toggleSound() {
  save.sound = !save.sound;
  writeSave();
  soundBtn.textContent = save.sound ? "🔊" : "🔇";
}

// ---------- leaderboard ----------
// Scores are shared between all players through the same Supabase database as Castle Defense,
// in its own table. Every score is also kept in this browser, so the leaderboard still works
// offline or before the table is made (see README.md).

const SUPABASE_URL = "https://havjhzdkkpbftmimnsbm.supabase.co";
// the publishable key is meant to be public: the database only lets it read scores and add new ones
const SUPABASE_KEY = "sb_publishable_IhIlOX6AEPUwMZVO7i_iTA_W5bpHvHJ";
const SCORES_URL = `${SUPABASE_URL}/rest/v1/neon_flip_scores`;

const LEADERBOARD_SIZE = 10;
let topScores = [];        // what the leaderboard shows: [{name, score, lines, difficulty}]
let leaderboardNote = "Loading scores…";
let pendingScore = null;   // the finished game waiting for a name
let lastEntry = null;      // the entry just saved, so it can be highlighted

async function fetchOnlineScores() {
  const response = await fetch(
    `${SCORES_URL}?select=name,score,lines,difficulty&order=score.desc&limit=${LEADERBOARD_SIZE}`,
    { headers: { apikey: SUPABASE_KEY } },
  );
  if (!response.ok) {
    throw new Error(`Supabase said ${response.status}`);
  }
  return response.json();
}

async function sendOnlineScore(entry) {
  const response = await fetch(SCORES_URL, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    throw new Error(`Supabase said ${response.status}`);
  }
}

function loadLocalScores() {
  try {
    const list = JSON.parse(localStorage.getItem("neonFlipLeaderboard"));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function saveLocalScore(entry) {
  const list = [...loadLocalScores(), entry];
  list.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem("neonFlipLeaderboard", JSON.stringify(list.slice(0, LEADERBOARD_SIZE)));
  } catch (error) {
    // private windows can block storage: the score just isn't kept in this browser
  }
}

async function refreshLeaderboard() {
  try {
    topScores = await fetchOnlineScores();
    leaderboardNote = topScores.length ? "" : "No scores yet. Be the first!";
  } catch (error) {
    topScores = loadLocalScores();
    leaderboardNote = topScores.length ? "Offline: showing scores from this computer" : "No scores yet. Be the first!";
  }
  showLeaderboard();
}

function makesLeaderboard(points) {
  return points > 0 &&
    (topScores.length < LEADERBOARD_SIZE || points > topScores[topScores.length - 1].score);
}

async function addToLeaderboard(name, result) {
  lastEntry = { name, ...result };
  saveLocalScore(lastEntry);
  try {
    localStorage.setItem("neonFlipName", name);   // fill it in for next time
  } catch (error) {
    // not remembered, that's fine
  }
  try {
    await sendOnlineScore(lastEntry);
  } catch (error) {
    toast("Couldn't reach the online leaderboard. Saved on this computer only.", "warn");
  }
  await refreshLeaderboard();
}

function isLastEntry(entry) {
  return lastEntry && entry.name === lastEntry.name && entry.score === lastEntry.score &&
    entry.lines === lastEntry.lines && entry.difficulty === lastEntry.difficulty;
}

function showLeaderboard() {
  for (const list of document.querySelectorAll(".leaderboard-list")) {
    list.replaceChildren(...topScores.map((entry) => {
      const row = document.createElement("li");
      if (isLastEntry(entry)) {
        row.className = "mine";
      }
      // textContent, so a name can't break the page
      row.append(
        makeElement("span", "who", entry.name),
        makeElement("span", "how", `${entry.lines} lines · ${entry.difficulty}`),
        makeElement("b", "", entry.score.toLocaleString()),
      );
      return row;
    }));
  }
  for (const status of document.querySelectorAll(".leaderboard-status")) {
    status.textContent = leaderboardNote;
    status.hidden = !leaderboardNote;
  }
}

function askForName() {
  nameForm.hidden = false;
  try {
    playerName.value = localStorage.getItem("neonFlipName") || "";
  } catch (error) {
    playerName.value = "";
  }
  playerName.focus();
  playerName.select();
}

function saveName(event) {
  event.preventDefault();   // stop the form from reloading the page
  const name = playerName.value.trim().slice(0, 16);
  if (!name || !pendingScore) {
    return;
  }
  const result = pendingScore;
  pendingScore = null;   // so pressing Save twice doesn't add the score twice
  nameForm.hidden = true;
  playerName.blur();
  addToLeaderboard(name, result);
}

// ---------- keyboard and touch ----------
const ARROW_KEYS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
};

document.addEventListener("keydown", (event) => {
  if (event.target === playerName) {
    return;   // typing a name for the leaderboard, so the letters aren't shortcuts
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === "m") {
    toggleSound();
    return;
  }
  if (state === "paused") {
    if (key === "p" || key === "Escape") {
      resumeGame();
    }
    return;
  }
  if (state !== "playing") {
    if (key === "Enter" && (state === "menu" || state === "over") && !event.target.closest?.("button, a")) {
      newGame();
    }
    return;
  }
  if (ARROW_KEYS[key]) {
    screenArrow(...ARROW_KEYS[key], event.repeat);
  } else if (key === " ") {
    if (!event.repeat) {
      hardDrop();
    }
  } else if (key === "x") {
    if (!event.repeat) {
      rotate(1);
    }
  } else if (key === "z") {
    if (!event.repeat) {
      rotate(3);
    }
  } else if (key === "c" || key === "Shift") {
    hold(0);
  } else if (key === "v") {
    hold(1);
  } else if (key === "1") {
    useLaser();
  } else if (key === "2") {
    useSlowmo();
  } else if (key === "p" || key === "Escape") {
    pauseGame();
  } else {
    return;
  }
  event.preventDefault();   // stop arrows and Space from scrolling the page
});

// touch buttons repeat while you hold them down, like a key
let touchRepeat = null;

function stopTouchRepeat() {
  clearTimeout(touchRepeat);
  clearInterval(touchRepeat);
  touchRepeat = null;
}

for (const button of document.querySelectorAll(".touch button")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    stopTouchRepeat();
    const action = button.dataset.action;
    if (action === "drop") {
      hardDrop();
    } else if (action === "turn") {
      rotate(1);
    } else if (action === "hold") {
      hold(0);
    } else {
      const [dx, dy] = button.dataset.arrow.split(",").map(Number);
      screenArrow(dx, dy, false);
      touchRepeat = setTimeout(() => {
        touchRepeat = setInterval(() => screenArrow(dx, dy, true), 55);
      }, 180);
    }
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
    button.addEventListener(type, stopTouchRepeat);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseGame();
  }
});

// ---------- page setup ----------
const starsCanvas = document.getElementById("stars");
let starsCtx = null;
const boardCtx = setupCanvas(document.getElementById("board"), BOARD_PX, BOARD_PX);
const nextCtx = setupCanvas(document.getElementById("next"), 176, 190);
const bossCtx = setupCanvas(document.getElementById("boss"), 176, 130);
const hold1Canvas = document.getElementById("hold-1");
const holdCtxs = [
  setupCanvas(document.getElementById("hold-0"), 72, 52),
  setupCanvas(hold1Canvas, 72, 52),
];

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const coinsEl = document.getElementById("coins");
const modeEl = document.getElementById("mode");
const bestEl = document.getElementById("best");
const gravityTag = document.getElementById("gravity-tag");
const bossPanel = document.getElementById("boss-panel");
const bossName = document.getElementById("boss-name");
const bossBar = document.getElementById("boss-bar");
const bossFill = document.getElementById("boss-fill");
const bossHp = document.getElementById("boss-hp");
const bossNote = document.getElementById("boss-note");
const laserBtn = document.getElementById("laser-btn");
const slowmoBtn = document.getElementById("slowmo-btn");
const laserCount = document.getElementById("laser-count");
const slowmoCount = document.getElementById("slowmo-count");
const slowmoBar = document.getElementById("slowmo-bar");
const slowmoFill = document.getElementById("slowmo-fill");
const hold2Hint = document.getElementById("hold2-hint");
const petInfo = document.getElementById("pet-info");
const ctlMove = document.getElementById("ctl-move");
const ctlTurn = document.getElementById("ctl-turn");
const ctlDrop = document.getElementById("ctl-drop");
const soundBtn = document.getElementById("sound-btn");
const shopPowerups = document.getElementById("shop-powerups");
const shopPets = document.getElementById("shop-pets");
const overReason = document.getElementById("over-reason");
const overScore = document.getElementById("over-score");
const overLines = document.getElementById("over-lines");
const overBosses = document.getElementById("over-bosses");
const overCoins = document.getElementById("over-coins");
const nameForm = document.getElementById("name-form");
const playerName = document.getElementById("player-name");
const toasts = document.getElementById("toasts");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");

for (const button of difficultyButtons) {
  button.addEventListener("click", () => {
    save.difficulty = button.dataset.difficulty;
    diff = DIFFICULTIES[save.difficulty];
    writeSave();
    updateMenu();
  });
}
document.getElementById("play-btn").addEventListener("click", newGame);
document.getElementById("again-btn").addEventListener("click", newGame);
document.getElementById("menu-shop-btn").addEventListener("click", () => openShop("menu-screen"));
document.getElementById("pause-shop-btn").addEventListener("click", () => openShop("pause-screen"));
document.getElementById("over-shop-btn").addEventListener("click", () => openShop("over-screen"));
document.getElementById("shop-back").addEventListener("click", closeShop);
document.getElementById("resume-btn").addEventListener("click", resumeGame);
document.getElementById("quit-btn").addEventListener("click", quitToMenu);
document.getElementById("over-menu-btn").addEventListener("click", quitToMenu);
document.getElementById("pause-btn").addEventListener("click", () => {
  if (state === "paused") {
    resumeGame();
  } else {
    pauseGame();
  }
});
soundBtn.addEventListener("click", toggleSound);
laserBtn.addEventListener("click", useLaser);
slowmoBtn.addEventListener("click", useSlowmo);
nameForm.addEventListener("submit", saveName);
window.addEventListener("resize", resizeStars);

soundBtn.textContent = save.sound ? "🔊" : "🔇";
resizeStars();
renderControls();
updateMenu();
updatePowerups();
showLeaderboard();
refreshLeaderboard();
requestAnimationFrame(frame);
