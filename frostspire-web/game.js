// Frostspire: build a castle on a snowy mountain, then keep it standing while goblins, trolls and imps attack.
// You are the ice wizard. Spend gold on blocks between waves, then fight with freeze blasts, mending and a shield.
// The blocks really tumble because of Matter.js, a physics engine (matter.min.js, MIT licence).
// Everything you see is drawn by this code, so there are no pictures.
"use strict";

// ---------- 1. numbers you can change ----------
const W = 1600, H = 900;              // the size of the game world
const GROUND_Y = 800;                 // the top of the snow
const ZONE_LEFT = 130, ZONE_RIGHT = 650;  // you can only build between these...
const TOP_LIMIT = 150;                // ...and no higher than this
const PILLAR_X = 70, PILLAR_W = 80, PILLAR_TOP = 600;  // the ice pillar the wizard stands on
const LOSE_AT = 0.25;                 // the castle falls when its strength drops below this
const MANA_MAX = 100;
const FREEZE_COST = 8, MEND_COST = 30, SHIELD_COST = 50;
const FREEZE_DAMAGE = 25;             // how much a freeze blast hurts an enemy
const FREEZE_EVERY = 0.2;             // hold the mouse down to keep blasting, this often (seconds)
const MEND_RADIUS = 100;              // mending fixes every block this close to where you tap
const SHIELD_TIME = 5, SHIELD_COOLDOWN = 12;
const TOWER_EVERY = 2.2, TOWER_DAMAGE = 12;
const CRYSTAL_EVERY = 3.5, CRYSTAL_RANGE = 230;
const FLAG_GOLD = 10;                 // every flag still standing after a wave earns this
const WAVE_GOLD = 60;                 // gold for beating a wave (plus a bit more each wave)
const BOSS_GOLD = 500, BOSS_BONUS = 150;
const IMPACT_SPEED = 7;               // blocks that crash faster than this get hurt
const IMPACT_DAMAGE = 5;
const WIND_PUSH = 0.00007;            // how hard the blizzard pushes things that fly
const SAVE_KEY = "frostspire-save";
const STEP = 1 / 60;                  // the physics moves forward this much at a time
const TAU = Math.PI * 2;

// ---------- 2. the blocks you can buy ----------
// burns: fire does extra damage. turns: R turns it on its side.
const PIECES = [
  { id: "wood",    name: "Wood",    cost: 10, w: 40,  h: 40, hp: 60,  density: 0.0012, burns: true },
  { id: "plank",   name: "Plank",   cost: 15, w: 120, h: 20, hp: 50,  density: 0.0012, burns: true, turns: true },
  { id: "stone",   name: "Stone",   cost: 25, w: 40,  h: 40, hp: 160, density: 0.004 },
  { id: "beam",    name: "Beam",    cost: 35, w: 120, h: 28, hp: 140, density: 0.004, turns: true },
  { id: "crystal", name: "Crystal", cost: 45, w: 32,  h: 48, hp: 80,  density: 0.002 },
  { id: "tower",   name: "Tower",   cost: 60, w: 44,  h: 64, hp: 120, density: 0.0025 },
  { id: "flag",    name: "Flag",    cost: 15, w: 12,  h: 56, hp: 30,  density: 0.0008 },
];
const PIECE = Object.fromEntries(PIECES.map(p => [p.id, p]));

// ---------- 3. the enemies and what they throw ----------
// r is how big they are when you shoot them. every is how many seconds between attacks.
const FOES = {
  goblin: { hp: 40,  r: 34, every: 4.5, gold: 10, speed: 70 },
  troll:  { hp: 90,  r: 46, every: 6.5, gold: 20, speed: 45 },
  imp:    { hp: 30,  r: 24, every: 6,   gold: 15, speed: 90, flies: true },
  boss:   { hp: 600, r: 60, every: 4.5, gold: 0,  speed: 80, flies: true },
};
const SHOTS = {
  fireball: { r: 14, density: 0.004, damage: 30, splash: 55, splashDamage: 20, explodes: true },
  boulder:  { r: 24, density: 0.012, damage: 15 },
  meteor:   { r: 34, density: 0.012, damage: 40, splash: 85, splashDamage: 35, explodes: true },
};

// ---------- 4. the worlds and their levels ----------
// wave(fire goblins, snow trolls, ember imps, how many times each one attacks)
function wave(goblin, troll, imp, shots) { return { goblin, troll, imp, shots }; }
// L(gold you start with, then the waves)
function L(gold, ...waves) { return { gold, waves }; }

const WORLDS = [
  { name: "Frostpine Foothills", icon: "🌲", sky: ["#7fc6f5", "#e6f6ff"], far: "#a3c4e4", near: "#cfe5f6",
    tree: "#2f7a62", snow: "#f4fbff",
    tip: "Pick a block at the bottom, then tap the snow to build your castle!",
    levels: [L(150, wave(1, 0, 0, 3), wave(2, 0, 0, 3)),
      L(180, wave(2, 0, 0, 3), wave(2, 0, 0, 4), wave(3, 0, 0, 3)),
      L(200, wave(2, 0, 0, 4), wave(3, 0, 0, 4), wave(4, 0, 0, 3)),
      L(220, wave(3, 0, 0, 4), wave(4, 0, 0, 4), wave(5, 0, 0, 4))] },
  { name: "Troll Glacier", icon: "🧊", sky: ["#6fb8ea", "#d9f3ff"], far: "#8fb6dd", near: "#b9dcf2",
    tree: "#2c6a6e", snow: "#eef8ff",
    tip: "Snow trolls throw heavy boulders. Stone stands up to them better than wood!",
    levels: [L(240, wave(0, 1, 0, 3), wave(2, 1, 0, 3), wave(2, 2, 0, 3)),
      L(260, wave(1, 1, 0, 4), wave(2, 2, 0, 3), wave(3, 2, 0, 4)),
      L(280, wave(2, 2, 0, 4), wave(3, 2, 0, 4), wave(2, 3, 0, 4)),
      L(300, wave(3, 2, 0, 4), wave(3, 3, 0, 4), wave(4, 3, 0, 5))] },
  { name: "Moonlit Peaks", icon: "🌙", sky: ["#0f1d45", "#3a4f8f"], far: "#2c3f73", near: "#40568f",
    tree: "#1d3b4a", snow: "#d4e0f7", night: true,
    tip: "Ember imps call down lightning. When you see red marks, use your 🛡️ shield!",
    levels: [L(300, wave(0, 0, 1, 3), wave(2, 0, 2, 3), wave(2, 1, 2, 3)),
      L(320, wave(2, 1, 2, 4), wave(3, 1, 2, 4), wave(2, 2, 3, 4)),
      L(340, wave(3, 2, 2, 4), wave(3, 2, 3, 4), wave(4, 2, 3, 4)),
      L(360, wave(4, 2, 3, 4), wave(4, 3, 3, 5), wave(5, 3, 4, 5))] },
  { name: "Blizzard Pass", icon: "🌨️", sky: ["#8ea6c2", "#d5e2ee"], far: "#9fb3c8", near: "#c0cfdd",
    tree: "#3b5f63", snow: "#eef3f8", wind: 1.3, blizzard: true,
    tip: "The blizzard wind pushes everything that flies. Watch the 🌬️ arrow!",
    levels: [L(380, wave(3, 1, 1, 4), wave(3, 2, 2, 4), wave(4, 2, 2, 4)),
      L(400, wave(4, 2, 2, 4), wave(4, 3, 2, 5), wave(5, 3, 3, 5)),
      L(420, wave(4, 3, 3, 5), wave(5, 3, 3, 5), wave(5, 4, 3, 5)),
      L(450, wave(5, 3, 3, 5), wave(5, 4, 4, 5), wave(6, 4, 4, 6))] },
  { name: "Pyrrak's Storm", icon: "🔥", boss: true, sky: ["#3a1638", "#c75a3a"], far: "#5a2a4a", near: "#7a3b52",
    tree: "#2a2236", snow: "#f3dfe6", embers: true,
    tip: "Pyrrak the Ember Sorcerer! Freeze him and build towers to shoot him. Beat him 3 times!" },
];

// one long list of every level: 16 normal ones, then the boss
const LEVELS = [];
WORLDS.forEach((world, wi) => {
  if (world.boss) LEVELS.push({ world: wi, boss: true, name: "Pyrrak's Storm" });
  else world.levels.forEach((spec, k) => LEVELS.push({ world: wi, spec, k, name: `${world.name} ${k + 1}` }));
});

// endless mode makes up its waves: a few more enemies every time
function endlessWave(n) {
  return wave(Math.min(7, 1 + Math.floor(n * 0.7)), Math.min(5, Math.floor((n - 1) / 2)),
    Math.min(5, Math.max(0, Math.floor((n - 2) / 3))), 3 + Math.floor(n / 5));
}

// ---------- 5. easy, normal, hard ----------
// gold: how much gold you get. damage: how much enemy attacks hurt. rate: time between attacks.
// mana: magic you get back each second. aim: how far enemies miss by. slow: how slowly their shots fly.
const DIFFS = {
  easy:   { gold: 1.4, damage: 0.6,  rate: 1.35, mana: 14, aim: 55, slow: 1.2, hp: 0.8 },
  normal: { gold: 1,   damage: 1,    rate: 1,    mana: 10, aim: 35, slow: 1,   hp: 1 },
  hard:   { gold: 0.8, damage: 1.35, rate: 0.8,  mana: 8,  aim: 15, slow: 0.9, hp: 1.25 },
};

// ---------- 6. little helpers and saving ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let save = { unlocked: 0, stars: [], best: { easy: 0, normal: 0, hard: 0 }, diff: "normal", muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { /* no saving, that's ok */ }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
const diff = () => DIFFS[save.diff] || DIFFS.normal;

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
// a "shhh" sound, for crashes, whooshes and booms
function noise(dur, vol = 0.15, freq = 800, delay = 0) {
  if (save.muted || !actx) return;
  const t0 = actx.currentTime + delay;
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = actx.createBufferSource(), filter = actx.createBiquadFilter(), gain = actx.createGain();
  src.buffer = buf;
  filter.type = "lowpass";
  filter.frequency.value = freq;
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(actx.destination);
  src.start(t0);
}
const sfx = {
  place() { tone(180, 0.12, "triangle", 0.15, 90); noise(0.06, 0.08, 1200); },
  coin() { tone(988, 0.08, "square", 0.05); tone(1319, 0.15, "square", 0.05, 0, 0.07); },
  nope() { tone(160, 0.15, "square", 0.05); },
  click() { tone(660, 0.05, "triangle", 0.08); },
  horn() { tone(220, 0.5, "sawtooth", 0.06, 260); tone(330, 0.6, "sawtooth", 0.05, 390, 0.25); },
  launch() { noise(0.25, 0.06, 600); },
  boom() { noise(0.45, 0.25, 500); tone(90, 0.3, "sine", 0.2, 40); },
  thud() { noise(0.15, 0.14, 300); },
  crack() { noise(0.12, 0.15, 2500); tone(140, 0.15, "square", 0.05, 60); },
  freeze() { tone(1400, 0.15, "sine", 0.06, 2400); tone(2000, 0.1, "triangle", 0.04, 0, 0.03); },
  shatter() { [2600, 3100, 2200].forEach((f, i) => tone(f, 0.08, "triangle", 0.05, 0, i * 0.03)); },
  mend() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, "sine", 0.08, 0, i * 0.06)); },
  shield() { tone(200, 0.6, "sine", 0.12, 600); tone(300, 0.6, "triangle", 0.05, 900); },
  warn() { tone(880, 0.1, "square", 0.04); },
  zap() { noise(0.2, 0.2, 4000); tone(1200, 0.2, "sawtooth", 0.05, 200); },
  twang() { tone(700, 0.08, "triangle", 0.05, 300); },
  hurt() { tone(260, 0.12, "square", 0.05, 160); },
  poof() { tone(500, 0.2, "sine", 0.08, 120); },
  roar() { tone(110, 0.8, "sawtooth", 0.08, 70); noise(0.6, 0.08, 400); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, 0, i * 0.09)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, "triangle", 0.1, 0, i * 0.2)); },
};
// lots of blocks can crash at the same moment, so each sound plays at most every 60ms
const lastSound = {};
function play(name) {
  const now = performance.now();
  if (now - (lastSound[name] || 0) < 60) return;
  lastSound[name] = now;
  sfx[name]();
}

const SCALE = [440, 523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7];
const BASS = [110, 87.3, 98.0, 82.4];
let tune = [], beat = 0;
function makeTune(seed) {
  const rng = makeRng(seed);
  let n = 3;
  tune = [];
  for (let i = 0; i < 16; i++) {
    if (rng() < 0.3) { tune.push(-1); continue; }
    n = clamp(n + ((rng() * 5) | 0) - 2, 0, SCALE.length - 1);
    tune.push(n);
  }
}
setInterval(() => {
  if (!actx || save.muted || !["build", "battle", "cleared"].includes(game.state)) return;
  const n = tune[beat % 16];
  if (n >= 0) tone(SCALE[n], 0.5, "sine", 0.025);
  if (beat % 4 === 0) tone(BASS[(beat >> 4) % 4], 0.7, "triangle", 0.03);
  beat++;
}, 320);

// ---------- 8. the physics world ----------
const { Engine, Bodies, Body, Composite, Events, Query, Sleeping } = Matter;
const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
const CAT_WORLD = 1, CAT_BLOCK = 2, CAT_SHOT = 4;   // shots hit the ground and blocks, but not each other
const ground = Bodies.rectangle(W / 2, GROUND_Y + 100, W + 2000, 200,
  { isStatic: true, friction: 1, label: "ground", collisionFilter: { category: CAT_WORLD } });
const pillar = Bodies.rectangle(PILLAR_X, (PILLAR_TOP + GROUND_Y) / 2, PILLAR_W, GROUND_Y - PILLAR_TOP,
  { isStatic: true, friction: 1, label: "pillar", collisionFilter: { category: CAT_WORLD } });

// after a block breaks or gets sold, wake every block up so the ones it held up can fall
function wakeAll() { for (const b of blocks) Sleeping.set(b.body, false); }

// ---------- 9. the game state ----------
const game = {
  state: "menu",        // menu, build, battle, cleared, fallen, paused, won, over
  mode: "story",        // story or endless
  level: 0, info: null, world: WORLDS[0],
  waves: [], waveNo: 0, gold: 0, mana: MANA_MAX,
  baseHp: 0, minStrength: 1, wind: 0, kills: 0,
  tool: "wood", turned: false, spell: "freeze",
  shield: 0, shieldCool: 0, castCool: 0, castAnim: 0, dome: null,
  boss: null, bossBeaten: false,
  after: null,          // something to do in a little while: { t, fn }
  pausedFrom: null, t: 0, shake: 0,
};
let blocks = [], shots = [], enemies = [], bolts = [], arrows = [], strikes = [], zaps = [], particles = [], popups = [];
const pointer = { x: 0, y: 0, inside: false, down: false };

function clearBattlefield() {
  Composite.clear(engine.world, false);
  Composite.add(engine.world, [ground, pillar]);
  blocks = []; shots = []; enemies = []; bolts = []; arrows = []; strikes = []; zaps = []; particles = []; popups = [];
  Object.assign(game, { waveNo: 0, minStrength: 1, kills: 0, shield: 0, shieldCool: 0, castCool: 0,
    boss: null, bossBeaten: false, after: null, shake: 0, tool: "wood", turned: false, spell: "freeze" });
}

function startLevel(idx) {
  const info = LEVELS[idx];
  clearBattlefield();
  game.mode = "story";
  game.level = idx;
  game.info = info;
  game.world = WORLDS[info.world];
  game.waves = info.boss ? [{ boss: 0 }, { boss: 1 }, { boss: 2 }] : info.spec.waves;
  game.gold = Math.round((info.boss ? BOSS_GOLD : info.spec.gold) * diff().gold / 5) * 5;
  makeTune(info.world * 31 + 7);
  show(null);
  beginBuild(info.boss || info.k === 0 ? game.world.tip : "Build your castle, then press ⚔️ Fight!");
}

function startEndless() {
  clearBattlefield();
  game.mode = "endless";
  game.info = null;
  game.world = WORLDS[0];
  game.waves = [];
  game.gold = Math.round(300 * diff().gold / 5) * 5;
  makeTune(99);
  show(null);
  beginBuild("Endless mode! How many waves can your castle survive?");
}

function beginBuild(message) {
  game.state = "build";
  game.mana = MANA_MAX;
  game.shield = 0;
  game.spell = "freeze";
  if (game.mode === "endless") {
    const n = game.waveNo + 1;
    const world = WORLDS[Math.floor((n - 1) / 4) % 4];
    if (world !== game.world) { game.world = world; makeTune(n * 13); }
    game.wind = n >= 6 ? rand(-1, 1) * Math.min(1.5, n / 10) : 0;
  } else {
    game.wind = game.world.wind ? (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1) * game.world.wind : 0;
  }
  setPhase("build");
  if (message) toast(message, 3.5);
}

function startWave() {
  if (game.state !== "build") return;
  if (!blocks.length) { toast("Build something first!"); play("nope"); return; }
  game.state = "battle";
  game.baseHp = blocks.reduce((sum, b) => sum + b.maxHp, 0);
  game.kills = 0;
  game.castCool = 0;
  setPhase("battle");
  play("horn");
  if (game.mode === "endless") spawnWave(endlessWave(game.waveNo + 1));
  else if (game.info.boss) spawnBoss(game.waveNo);
  else spawnWave(game.waves[game.waveNo]);
  const first = game.mode === "story" && game.level === 0 && game.waveNo === 0;
  toast(first ? "Tap the sky to shoot freeze blasts at the fireballs!" : `Wave ${game.waveNo + 1}!`, first ? 3.5 : 1.6);
}

// how strong the castle is: all its health now, out of all its health when the wave started
function castleHp() { let sum = 0; for (const b of blocks) sum += Math.max(0, b.hp); return sum; }
function strength() {
  if (game.state === "build" || game.state === "menu") {
    const max = blocks.reduce((sum, b) => sum + b.maxHp, 0);
    return max ? castleHp() / max : 1;
  }
  return game.baseHp > 0 ? clamp(castleHp() / game.baseHp, 0, 1) : 1;
}

function waveCleared() {
  const flags = blocks.filter(b => b.kind === "flag" && upright(b)).length;
  const reward = Math.round((WAVE_GOLD + 15 * game.waveNo) * diff().gold)
    + flags * FLAG_GOLD + (game.info && game.info.boss ? BOSS_BONUS : 0);
  game.minStrength = Math.min(game.minStrength, strength());
  game.waveNo++;
  if (game.mode === "endless") {
    if (game.waveNo > (save.best[save.diff] || 0)) { save.best[save.diff] = game.waveNo; writeSave(); }
  } else if (game.waveNo >= game.waves.length || game.bossBeaten) {
    levelWon();
    return;
  }
  game.gold += reward;
  play("coin");
  const flagText = flags ? ` (🚩 ×${flags})` : "";
  const bossText = game.info && game.info.boss ? " Pyrrak will be back. Build fast!" : "";
  beginBuild(`Wave beaten! +${reward} 🪙${flagText}${bossText}`);
}

function levelWon() {
  game.state = "won";
  const stars = game.minStrength >= 0.7 ? 3 : game.minStrength >= 0.45 ? 2 : 1;
  save.stars[game.level] = Math.max(save.stars[game.level] || 0, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(game.level + 1, LEVELS.length - 1));
  writeSave();
  play("win");
  const starHtml = [1, 2, 3].map(i => `<span class="${i <= stars ? "on" : ""}" style="animation-delay:${i * 0.15}s">★</span>`).join("");
  const pct = Math.round(game.minStrength * 100);
  if (game.info.boss) {
    $("end-stars").innerHTML = starHtml;
    $("end-text").innerHTML = `You beat <b>Pyrrak the Ember Sorcerer</b>! The mountain is safe, and the snow can fall in peace.
      At its weakest, your castle still had <b>${pct}%</b> of its strength.`;
    show("end-screen");
  } else {
    $("clear-stars").innerHTML = starHtml;
    $("clear-text").innerHTML = `Your castle beat all <b>${game.waves.length} waves</b>. At its weakest it still had
      <b>${pct}%</b> of its strength. ${stars < 3 ? "Keep it above 70% for ⭐⭐⭐." : "Amazing building!"}`;
    show("clear-screen");
  }
}

function castleFalls() {
  game.state = "fallen";
  play("lose");
  toast("Oh no, the castle is falling!", 2);
  for (const f of enemies) f.cheer = true;
  game.after = { t: 2, fn: showOver };
}

function showOver() {
  game.state = "over";
  if (game.mode === "endless") {
    const best = save.best[save.diff] || 0;
    $("over-text").innerHTML = `Your castle survived <b>${game.waveNo} wave${game.waveNo === 1 ? "" : "s"}</b>.
      Your best on ${save.diff} is <b>${best}</b>.`;
    $("over-map").textContent = "🏠 Title";
  } else {
    $("over-text").innerHTML = "Too much of your castle broke. Try <b>stone</b> walls, a <b>crystal</b> to zap fireballs, and <b>💚 Mend</b> when things crack!";
    $("over-map").textContent = "🗺️ Levels";
  }
  show("over-screen");
}

// ---------- 10. building ----------
function upright(b) {
  const a = ((b.body.angle % TAU) + TAU) % TAU;
  return a < 0.5 || a > TAU - 0.5;
}

function addBlock(kind, x, y, angle) {
  const p = PIECE[kind];
  const body = Bodies.rectangle(x, y, p.w, p.h, {
    angle, density: p.density, friction: 0.9, frictionStatic: 1.2, restitution: 0.02, label: "block",
    collisionFilter: { category: CAT_BLOCK, mask: CAT_WORLD | CAT_BLOCK | CAT_SHOT },
  });
  const b = { body, kind, p, hp: p.hp, maxHp: p.hp, flash: 0, boughtAt: game.waveNo,
    seed: (Math.random() * 1e9) | 0, cool: rand(0.5, 1.5) };
  body.plugin.block = b;
  Composite.add(engine.world, body);
  blocks.push(b);
  return b;
}

// where the block you picked would go. If something is in the way, it slides up until it fits,
// so pointing at the top of your castle puts the new block on top.
function ghostAt(px, py) {
  const p = PIECE[game.tool];
  if (!p) return null;
  const turned = p.turns && game.turned;
  const w = turned ? p.h : p.w, h = turned ? p.w : p.h;
  const x = clamp(Math.round(px / 5) * 5, ZONE_LEFT + w / 2, ZONE_RIGHT - w / 2);
  const startY = Math.min(Math.round(py / 5) * 5, GROUND_Y - h / 2);
  const solid = [ground, pillar];
  for (const b of blocks) solid.push(b.body);
  for (let y = startY; y - h / 2 >= TOP_LIMIT && y > startY - 160; y -= 5) {
    const test = Bodies.rectangle(x, y, w - 4, h - 4);
    if (Query.collides(test, solid).length === 0) return { x, y, p, angle: turned ? Math.PI / 2 : 0, ok: true };
  }
  return { x, y: startY, p, angle: turned ? Math.PI / 2 : 0, ok: false };
}

function blockAt(x, y) {
  const hit = Query.point(blocks.map(b => b.body), { x, y })[0];
  return hit ? hit.plugin.block : null;
}

function sellPrice(b) {
  return b.boughtAt === game.waveNo && b.hp >= b.maxHp ? b.p.cost : Math.floor(b.p.cost / 2 * b.hp / b.maxHp);
}
function fixPrice(b) { return Math.max(1, Math.ceil(b.p.cost * (1 - b.hp / b.maxHp))); }

function buildTap(x, y) {
  if (game.tool === "sell" || game.tool === "fix") {
    const b = blockAt(x, y);
    if (!b) { play("nope"); return; }
    if (game.tool === "sell") {
      const price = sellPrice(b);
      game.gold += price;
      b.dead = true;
      popup(b.body.position.x, b.body.position.y, `+${price} 🪙`, "#ffd23f");
      burst(b.body.position.x, b.body.position.y, 10, ["#ffd23f", "#fff"], 3, 4);
      play("coin");
    } else if (b.hp >= b.maxHp) {
      toast("That block isn't broken!", 1.4);
      play("nope");
    } else if (game.gold < fixPrice(b)) {
      toast("Not enough gold to fix it", 1.4);
      play("nope");
    } else {
      game.gold -= fixPrice(b);
      b.hp = b.maxHp;
      sparkle(b.body.position.x, b.body.position.y);
      play("mend");
    }
    return;
  }
  const g = ghostAt(x, y);
  if (!g || !g.ok) { play("nope"); return; }
  if (game.gold < g.p.cost) { toast("Not enough gold! Sell something, or beat a wave.", 1.8); play("nope"); return; }
  game.gold -= g.p.cost;
  addBlock(g.p.id, g.x, g.y, g.angle);
  burst(g.x, g.y + 10, 6, ["#ffffff", "#dff3ff"], 2, 3);
  play("place");
}

function pickTool(tool) {
  game.tool = tool;
  play("click");
}

function turnPiece() {
  game.turned = !game.turned;
  play("click");
}

// ---------- 11. enemies ----------
function makeFoe(kind, delay, ammo) {
  const f = FOES[kind];
  const hp = f.hp * diff().hp;
  const foe = { kind, hp, maxHp: hp, delay, ammo, state: "coming", x: W + 120, y: GROUND_Y, homeX: 0, homeY: GROUND_Y,
    timer: rand(0.8, f.every) * diff().rate, anim: 0, hurt: 0, bob: rand(0, TAU), cheer: false };
  if (f.flies) foe.homeY = foe.y = rand(230, 430);
  return foe;
}

function spawnWave(spec) {
  const slots = { goblin: 0, troll: 0, imp: 0 };
  const list = [];
  for (const kind of ["troll", "goblin", "imp"]) for (let i = 0; i < spec[kind]; i++) list.push(kind);
  list.forEach((kind, i) => {
    const f = makeFoe(kind, i * 1.1, spec.shots);
    const s = slots[kind]++;
    f.homeX = kind === "goblin" ? 1040 + (s % 6) * 62 + rand(-10, 10)
      : kind === "troll" ? 1300 + (s % 5) * 58 + rand(-10, 10)
      : 1000 + (s % 5) * 90 + rand(-20, 20);
    enemies.push(f);
  });
}

function spawnBoss(phase) {
  if (!game.boss) {
    game.boss = makeFoe("boss", 0.5, 0);
    game.boss.hp = game.boss.maxHp = FOES.boss.hp * diff().hp;
  }
  const b = game.boss;
  Object.assign(b, { phase, state: "coming", x: W + 150, homeX: 1320, homeY: 330, y: 330, delay: 0.5,
    volleyT: 2, boltT: 4, meteorT: 6, summonT: 3, gone: false });
  enemies.push(b);
  play("roar");
}

function foeCenter(f) {
  if (f.kind === "goblin") return { x: f.x + 6, y: GROUND_Y - 34 };
  if (f.kind === "troll") return { x: f.x, y: GROUND_Y - 70 };
  return { x: f.x, y: f.y };
}

// pick a block to aim at. Blocks near the top get picked more, so tall towers are risky!
function pickTarget() {
  if (!blocks.length) return { block: null, x: rand(ZONE_LEFT, ZONE_RIGHT), y: GROUND_Y - 20 };
  const sorted = blocks.slice().sort((a, b) => a.body.position.y - b.body.position.y);
  const b = sorted[Math.floor(Math.random() ** 2 * sorted.length)];
  return { block: b, x: b.body.position.x, y: b.body.position.y };
}

// throw something in an arc, so it lands near (tx, ty) after a while.
// Matter adds gravity g to the speed every step, so after T steps it has fallen g*T*(T+1)/2.
function launch(kind, x, y, tx, ty, speed) {
  const s = SHOTS[kind];
  const T = clamp(Math.abs(tx - x) / speed, 45, 140) * diff().slow;
  const g = engine.gravity.y * engine.gravity.scale * (1000 / 60) ** 2;
  const body = Bodies.circle(x, y, s.r, { density: s.density, frictionAir: 0, restitution: 0.15, friction: 0.6,
    label: "shot", collisionFilter: { category: CAT_SHOT, mask: CAT_WORLD | CAT_BLOCK } });
  Body.setVelocity(body, { x: (tx - x) / T, y: (ty - y) / T - g * (T + 1) / 2 });
  Body.setAngularVelocity(body, rand(-0.2, 0.2));
  const shot = { body, kind, s, life: 9, hits: 0, dead: false };
  body.plugin.shot = shot;
  Composite.add(engine.world, body);
  shots.push(shot);
}

function aimNoise() { return rand(-diff().aim, diff().aim); }

function foeAttacks(f) {
  const t = pickTarget();
  f.anim = 0.5;
  if (f.kind === "goblin") { launch("fireball", f.x - 39, GROUND_Y - 76, t.x + aimNoise(), t.y, 10); play("launch"); }
  else if (f.kind === "troll") { launch("boulder", f.x - 10, GROUND_Y - 140, t.x + aimNoise(), t.y, 7); play("launch"); }
  else if (f.kind === "imp") callLightning(t);
}

function callLightning(t) {
  strikes.push({ block: t.block, x: t.x + aimNoise() * 0.3, y: t.y, warn: 1.4 * diff().slow, flash: 0 });
  play("warn");
}

function bossAttacks(b) {
  const d = diff();
  if ((b.volleyT -= STEP) <= 0) {
    for (let i = 0; i <= b.phase; i++) {
      const t = pickTarget();
      launch("fireball", b.x - 50, b.y - 30 + i * 20, t.x + aimNoise(), t.y, 9 + i * 1.5);
    }
    b.volleyT = FOES.boss.every * d.rate;
    b.anim = 0.5;
    play("launch");
  }
  if (b.phase >= 1 && (b.boltT -= STEP) <= 0) {
    for (let i = 0; i < b.phase; i++) callLightning(pickTarget());
    b.boltT = 7 * d.rate;
  }
  if (b.phase >= 2 && (b.meteorT -= STEP) <= 0) {
    const t = pickTarget();
    launch("meteor", W + 60, -150, t.x + aimNoise(), t.y, 9);
    toast("☄️ Meteor! Freeze it!", 1.2);
    b.meteorT = 9 * d.rate;
  }
  if (b.phase >= 1 && (b.summonT -= STEP) <= 0) {
    const helpers = enemies.filter(e => e.minion && !e.gone).length;
    if (helpers < b.phase + 1) {
      const kind = b.phase === 2 && Math.random() < 0.5 ? "troll" : "goblin";
      const m = makeFoe(kind, 0, 99);
      m.minion = true;
      m.homeX = kind === "goblin" ? rand(1040, 1180) : rand(1180, 1260);
      enemies.push(m);
    }
    b.summonT = 9;
  }
}

function updateFoes() {
  for (const f of enemies) {
    if (f.gone) continue;
    if (f.delay > 0) { f.delay -= STEP; continue; }
    const kind = FOES[f.kind];
    f.hurt = Math.max(0, f.hurt - STEP);
    f.anim = Math.max(0, f.anim - STEP);
    if (kind.flies) f.y = f.homeY + Math.sin(game.t * 2 + f.bob) * 12;
    if (f.state === "coming") {
      f.x -= kind.speed * STEP;
      if (f.x <= f.homeX) { f.x = f.homeX; f.state = "fight"; }
    } else if (f.state === "leaving") {
      f.x += kind.speed * 1.6 * STEP;
      if (f.x > W + 160) f.gone = true;
    } else if (f.cheer) {
      // the castle fell, so they just jump up and down
    } else if (f.kind === "boss") {
      bossAttacks(f);
    } else if ((f.timer -= STEP) <= 0) {
      if (f.ammo > 0) { foeAttacks(f); f.ammo--; f.timer = kind.every * diff().rate * rand(0.85, 1.15); }
      else f.state = "leaving";
    }
  }
  enemies = enemies.filter(f => !f.gone);
}

function hurtFoe(f, dmg) {
  if (f.gone || f.delay > 0) return;
  const c = foeCenter(f);
  if (f.kind === "boss") {
    if (f.state === "leaving") return;
    f.hp -= dmg;
    f.hurt = 0.15;
    play("hurt");
    const floor = f.maxHp * (2 - f.phase) / 3;   // he runs away at 2/3 and 1/3 of his health
    if (f.hp <= floor + 0.01) {
      f.hp = floor;
      for (const m of enemies) if (m.minion) m.state = "leaving";
      if (f.phase < 2) {
        f.state = "leaving";
        toast("Pyrrak flies away to get his strength back...", 2.2);
        play("roar");
      } else {
        f.gone = true;
        game.bossBeaten = true;
        game.shake = 1;
        burst(c.x, c.y, 80, ["#ffb347", "#ff4d2e", "#fff3b0", "#7a1424"], 9, 7, 0.1, 1.6);
        toast("🎉 Pyrrak is beaten! 🎉", 3);
        play("boom");
        play("roar");
      }
    }
    return;
  }
  f.hp -= dmg;
  f.hurt = 0.15;
  play("hurt");
  if (f.hp <= 0) {
    f.gone = true;
    game.gold += FOES[f.kind].gold;
    game.kills++;
    popup(c.x, c.y - 30, `+${FOES[f.kind].gold} 🪙`, "#ffd23f");
    burst(c.x, c.y, 26, f.kind === "troll" ? ["#eaf4ff", "#9cc3e6"] : f.kind === "imp" ? ["#e2463a", "#ffb347"] : ["#5aa64a", "#7a4a24", "#d33"], 5, 5);
    play("poof");
  }
}

// ---------- 12. shots, lightning, crashes and damage ----------
function hurtBlock(b, dmg) {
  if (b.dead || dmg <= 0) return;
  b.hp -= dmg;
  b.flash = 0.15;
  if (b.hp <= 0) breakBlock(b);
}

function breakBlock(b) {
  b.dead = true;
  const p = b.body.position;
  const colors = b.p.burns ? ["#c08448", "#6b4423", "#ffb347"] : b.kind === "crystal" ? ["#7fe8ff", "#ffffff", "#6d5cff"] : ["#93a7c0", "#4d6080", "#ffffff"];
  burst(p.x, p.y, 18, colors, 4, 5, 0.25);
  play("crack");
}

function explode(pos, spec, direct) {
  const d = diff();
  if (direct) hurtBlock(direct, spec.damage * d.damage * (direct.p.burns ? 1.8 : 1));
  for (const b of blocks) {
    const away = dist(b.body.position, pos);
    if (away > spec.splash) continue;
    const k = 1 - away / spec.splash;
    hurtBlock(b, spec.splashDamage * k * d.damage * (b.p.burns ? 1.8 : 1));
    Sleeping.set(b.body, false);
    const push = 0.006 * k * b.body.mass / Math.max(away, 10);
    Body.applyForce(b.body, b.body.position, { x: (b.body.position.x - pos.x) * push, y: (b.body.position.y - pos.y) * push });
  }
  burst(pos.x, pos.y, spec.splash > 60 ? 50 : 26, ["#ffb347", "#ff6a3d", "#fff3b0", "#666"], 5, 5, 0.12);
  game.shake = Math.max(game.shake, spec.splash > 60 ? 0.6 : 0.3);
  play("boom");
}

// Matter tells us every time two things bump into each other
Events.on(engine, "collisionStart", e => {
  for (const pair of e.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
    if (a.plugin.shot) shotHits(a.plugin.shot, b, speed);
    else if (b.plugin.shot) shotHits(b.plugin.shot, a, speed);
    else if (fighting() && speed > IMPACT_SPEED) {
      // blocks that crash hard get hurt, so falling towers do damage
      const dmg = (speed - IMPACT_SPEED) * IMPACT_DAMAGE;
      if (a.plugin.block) hurtBlock(a.plugin.block, dmg);
      if (b.plugin.block) hurtBlock(b.plugin.block, dmg);
      play("thud");
    }
  }
});

function shotHits(s, other, speed) {
  if (s.dead) return;
  const blk = other.plugin.block;
  if (s.s.explodes) { s.dead = true; explode(s.body.position, s.s, blk); return; }
  // boulders don't explode: they smash and push, then roll for a bit
  if (blk && speed > 2) { hurtBlock(blk, (s.s.damage + speed * 2.5) * diff().damage); play("thud"); }
  if (!s.hits) game.shake = Math.max(game.shake, 0.25);
  s.hits++;
  s.life = Math.min(s.life, 2.5);
}

function shatter(s) {
  s.dead = true;
  const p = s.body.position;
  burst(p.x, p.y, 18, ["#ffffff", "#bfeaff", "#7fd0ff"], 4, 4, 0.12);
  play("shatter");
}

function updateShots() {
  for (const s of shots) {
    if (s.dead) continue;
    const p = s.body.position;
    s.life -= STEP;
    if (s.s.explodes && Math.random() < 0.7) {
      particles.push({ x: p.x + rand(-5, 5), y: p.y + rand(-5, 5), vx: rand(-0.5, 0.5), vy: rand(-1, 0), g: -0.02,
        size: rand(3, s.s.r * 0.6), color: Math.random() < 0.5 ? "#ffb347" : "#ff6a3d", life: 0.4, max: 0.4 });
    }
    if (game.shield > 0 && insideShield(p)) { shatter(s); continue; }
    if (s.life <= 0 || p.x < -300 || p.x > W + 300 || p.y > H + 200) {
      s.dead = true;
      if (s.kind === "boulder") burst(p.x, p.y, 10, ["#8d8d9a", "#cfd6e0"], 2, 5);
    }
  }
  for (const s of shots) if (s.dead) Composite.remove(engine.world, s.body);
  shots = shots.filter(s => !s.dead);
}

function updateStrikes() {
  const d = diff();
  for (const s of strikes) {
    if (s.flash > 0) { if ((s.flash -= STEP) <= 0) s.done = true; continue; }
    if (s.block && !s.block.dead) { s.x = s.block.body.position.x; s.y = s.block.body.position.y; }
    if ((s.warn -= STEP) > 0) continue;
    s.flash = 0.3;
    play("zap");
    if (game.shield > 0 && insideShield(s)) {
      s.y = shieldTopAt(s.x);
      burst(s.x, s.y, 16, ["#ffffff", "#bfeaff"], 4, 3);
      continue;
    }
    game.shake = Math.max(game.shake, 0.3);
    for (const b of blocks) {
      if (dist(b.body.position, s) < 50) hurtBlock(b, (b === s.block ? 60 : 25) * d.damage);
    }
    burst(s.x, s.y, 20, ["#fff3b0", "#ffffff", "#ffb347"], 5, 3);
  }
  strikes = strikes.filter(s => !s.done);
}

// ---------- 13. the wizard's magic, towers and crystals ----------
const STAFF = { x: PILLAR_X + 30, y: PILLAR_TOP - 96 };

function castFreeze(x, y, quiet) {
  if (game.castCool > 0) return;
  if (game.mana < FREEZE_COST) { if (!quiet) { toast("Out of magic! Wait for it to fill up.", 1.2); play("nope"); } return; }
  game.mana -= FREEZE_COST;
  game.castCool = FREEZE_EVERY;
  game.castAnim = 0.25;
  const a = Math.atan2(y - STAFF.y, x - STAFF.x);
  bolts.push({ x: STAFF.x, y: STAFF.y, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, life: 1.4 });
  play("freeze");
}

function castMend(x, y) {
  game.spell = "freeze";
  if (game.mana < MEND_COST) { toast("Not enough magic to mend", 1.2); play("nope"); return; }
  const hurt = blocks.filter(b => b.hp < b.maxHp && dist(b.body.position, { x, y }) < MEND_RADIUS);
  if (!hurt.length) { toast("Nothing is broken there", 1.2); play("nope"); return; }
  game.mana -= MEND_COST;
  game.castAnim = 0.4;
  for (const b of hurt) { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.5); sparkle(b.body.position.x, b.body.position.y); }
  play("mend");
}

function castShield() {
  if (game.state !== "battle") return;
  if (game.shieldCool > 0) { toast(`The shield is resting (${Math.ceil(game.shieldCool)}s)`, 1.2); play("nope"); return; }
  if (game.mana < SHIELD_COST) { toast("Not enough magic for a shield", 1.2); play("nope"); return; }
  game.mana -= SHIELD_COST;
  game.shield = SHIELD_TIME;
  game.shieldCool = SHIELD_COOLDOWN;
  game.castAnim = 0.4;
  play("shield");
}

function pickSpell(spell) {
  if (spell === "shield") { castShield(); return; }
  game.spell = game.spell === spell ? "freeze" : spell;
  play("click");
}

// the shield is a bubble over the whole castle, a bit taller than the highest block
function updateDome() {
  let top = GROUND_Y - 200;
  for (const b of blocks) top = Math.min(top, b.body.bounds.min.y);
  game.dome = { cx: (ZONE_LEFT + ZONE_RIGHT) / 2, cy: GROUND_Y, rx: (ZONE_RIGHT - ZONE_LEFT) / 2 + 60, ry: GROUND_Y - top + 70 };
}
function insideShield(p) {
  const d = game.dome;
  return d && ((p.x - d.cx) / d.rx) ** 2 + ((p.y - d.cy) / d.ry) ** 2 < 1;
}
function shieldTopAt(x) {
  const d = game.dome;
  return d.cy - d.ry * Math.sqrt(Math.max(0, 1 - ((x - d.cx) / d.rx) ** 2));
}

function nearestFoe(pos) {
  let best = null, bestD = Infinity;
  for (const f of enemies) {
    if (f.gone || f.delay > 0 || f.x > W + 30 || (f.kind === "boss" && f.state === "leaving")) continue;
    const d = dist(foeCenter(f), pos);
    if (d < bestD) { best = f; bestD = d; }
  }
  return best;
}

function updateMagic() {
  const d = diff();
  if (game.state === "battle") game.mana = Math.min(MANA_MAX, game.mana + d.mana * STEP);
  game.shield = Math.max(0, game.shield - STEP);
  game.shieldCool = Math.max(0, game.shieldCool - STEP);
  game.castCool = Math.max(0, game.castCool - STEP);
  game.castAnim = Math.max(0, game.castAnim - STEP);
  updateDome();
  // hold the mouse (or your finger) down to keep blasting
  if (game.state === "battle" && pointer.down && game.spell === "freeze") castFreeze(pointer.x, pointer.y, true);

  // freeze blasts move in two half-steps so they don't skip over small fireballs
  for (const b of bolts) {
    for (let half = 0; half < 2 && b.life > 0; half++) {
      b.x += b.vx / 2;
      b.y += b.vy / 2;
      for (const s of shots) {
        if (!s.dead && dist(s.body.position, b) < s.s.r + 14) { shatter(s); b.life = 0; break; }
      }
      if (b.life <= 0) break;
      for (const f of enemies) {
        if (!f.gone && f.delay <= 0 && dist(foeCenter(f), b) < FOES[f.kind].r) {
          hurtFoe(f, FREEZE_DAMAGE);
          burst(b.x, b.y, 10, ["#ffffff", "#bfeaff"], 3, 3);
          b.life = 0;
          break;
        }
      }
    }
    b.life -= STEP;
    if (Math.random() < 0.6) particles.push({ x: b.x, y: b.y, vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), g: 0, size: rand(2, 4), color: "#dff6ff", life: 0.35, max: 0.35 });
  }
  bolts = bolts.filter(b => b.life > 0);

  // tower arrows follow their enemy
  for (const a of arrows) {
    a.life -= STEP;
    if (a.target && !a.target.gone) {
      const c = foeCenter(a.target);
      const ang = Math.atan2(c.y - a.y, c.x - a.x);
      a.vx = Math.cos(ang) * 16;
      a.vy = Math.sin(ang) * 16;
      if (dist(c, a) < FOES[a.target.kind].r) { hurtFoe(a.target, TOWER_DAMAGE); a.life = 0; }
    }
    a.x += a.vx;
    a.y += a.vy;
  }
  arrows = arrows.filter(a => a.life > 0);

  for (const z of zaps) z.life -= STEP;
  zaps = zaps.filter(z => z.life > 0);
}

// every block, every step: lost off the edge? broken? and towers and crystals do their jobs
function updateBlocks() {
  const fightingNow = fighting();
  for (const b of blocks) {
    b.flash = Math.max(0, b.flash - STEP);
    const p = b.body.position;
    if (!b.dead && (p.x < ZONE_LEFT - 90 || p.x > ZONE_RIGHT + 90 || p.y > H + 60)) {
      b.dead = true;
      popup(clamp(p.x, 40, W - 40), Math.min(p.y, GROUND_Y - 20), "lost!", "#ff6a3d");
      if (game.state === "build" && b.boughtAt === game.waveNo) game.gold += b.p.cost;   // a free refund while building
      play("poof");
    }
    if (b.dead || !fightingNow || game.state === "fallen") continue;
    if (b.kind === "tower" && upright(b) && (b.cool -= STEP) <= 0) {
      const top = { x: p.x, y: p.y - 30 };
      const foe = nearestFoe(top);
      if (foe) {
        arrows.push({ x: top.x, y: top.y, vx: 0, vy: 0, target: foe, life: 2.5 });
        b.cool = TOWER_EVERY;
        play("twang");
      } else b.cool = 0.3;
    }
    if (b.kind === "crystal" && (b.cool -= STEP) <= 0) {
      let target = null, bestD = CRYSTAL_RANGE;
      for (const s of shots) {
        if (s.dead || s.hits) continue;
        const d = dist(s.body.position, p);
        if (d < bestD) { target = s; bestD = d; }
      }
      if (target) {
        zaps.push({ x1: p.x, y1: p.y - 20, x2: target.body.position.x, y2: target.body.position.y, life: 0.25 });
        shatter(target);
        b.cool = CRYSTAL_EVERY;
      } else b.cool = 0.1;
    }
  }
  if (blocks.some(b => b.dead)) {
    for (const b of blocks) if (b.dead) Composite.remove(engine.world, b.body);
    blocks = blocks.filter(b => !b.dead);
    wakeAll();
  }
}

// ---------- 14. the main loop ----------
function fighting() { return game.state === "battle" || game.state === "cleared" || game.state === "fallen"; }
function running() { return game.state === "build" || fighting(); }

function step() {
  game.t += STEP;
  // the blizzard pushes on everything that's still flying
  if (game.wind && fighting()) {
    for (const s of shots) if (!s.hits) Body.applyForce(s.body, s.body.position, { x: s.body.mass * game.wind * WIND_PUSH, y: 0 });
  }
  Engine.update(engine, 1000 / 60);
  if (fighting()) { updateFoes(); updateShots(); updateStrikes(); }
  updateMagic();
  updateBlocks();
  updateParticles();
  game.shake = Math.max(0, game.shake - STEP * 2);
  if (game.after && (game.after.t -= STEP) <= 0) { const fn = game.after.fn; game.after = null; fn(); }
  if (game.state === "battle") {
    if (strength() < LOSE_AT) castleFalls();
    else if (!enemies.length && !shots.length && !strikes.length) {
      game.state = "cleared";
      game.after = { t: 1.2, fn: waveCleared };
    }
  }
}

// ---------- 15. particles and pop-up words ----------
function burst(x, y, n, colors, speed = 4, size = 4, gravity = 0.15, life = 0.8) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = Math.random() * speed;
    const l = life * rand(0.6, 1.2);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g: gravity,
      size: size * rand(0.5, 1.5), color: colors[i % colors.length], life: l, max: l, square: Math.random() < 0.5 });
  }
  if (particles.length > 700) particles.splice(0, particles.length - 700);
}
function sparkle(x, y) { burst(x, y, 14, ["#9cff8a", "#ffffff", "#d8ffd0"], 2.5, 3, -0.03); }
function popup(x, y, text, color) { popups.push({ x, y, text, color, life: 1.2 }); }

function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= STEP; }
  particles = particles.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 0.8; p.life -= STEP; }
  popups = popups.filter(p => p.life > 0);
}

// ---------- 16. drawing ----------
const $ = id => document.getElementById(id);
const canvas = $("view"), ctx = canvas.getContext("2d");
let view = { s: 1, ox: 0, oy: 0, cw: 1, ch: 1, dpr: 1 };

function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  // leave room under the castle for the buttons
  const bar = document.body.classList.contains("in-menu") ? null
    : $(document.body.classList.contains("phase-build") ? "build-bar" : "battle-bar");
  const barH = bar ? bar.offsetHeight + 18 : 0;
  const s = Math.min(cw / W, (ch - barH - 50) / (GROUND_Y - 120));
  view = { s, ox: (cw - W * s) / 2, oy: ch - barH - GROUND_Y * s, cw, ch, dpr };
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// the mountains, stars and trees never change, so they are made once
const FAR = [], NEAR = [], TREES = [], STARS = [], FLAKES = [];
(function makeScenery() {
  const rng = makeRng(77);
  for (let x = -900; x <= 2500; x += 170) FAR.push([x + rng() * 80, 280 + rng() * 220, 160 + rng() * 80]);
  for (let x = -900; x <= 2500; x += 120) NEAR.push([x + rng() * 50, 90 + rng() * 110, 120 + rng() * 60]);
  for (let x = 720; x < 2300; x += 45 + rng() * 60) TREES.push([x, 40 + rng() * 50]);
  for (let x = -900; x < 20; x += 50 + rng() * 60) TREES.push([x, 40 + rng() * 50]);
  for (let i = 0; i < 90; i++) STARS.push([rng(), rng() * 0.6, rng() * 1.5 + 0.5]);
  for (let i = 0; i < 160; i++) FLAKES.push({ x: rng() * 3400 - 900, y: rng() * H, r: rng() * 2.5 + 1, s: rng() * 0.6 + 0.4, ph: rng() * TAU });
})();

function drawRange(points, baseY, color, cap) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [x, h, w] of points) { ctx.moveTo(x - w, baseY); ctx.lineTo(x, baseY - h); ctx.lineTo(x + w, baseY); }
  ctx.fill();
  ctx.fillStyle = cap;
  ctx.beginPath();
  for (const [x, h, w] of points) {
    const k = 0.32;
    ctx.moveTo(x - w * k, baseY - h * (1 - k));
    ctx.lineTo(x, baseY - h);
    ctx.lineTo(x + w * k, baseY - h * (1 - k));
    ctx.lineTo(x + w * k * 0.4, baseY - h * (1 - k) + 12);
    ctx.lineTo(x, baseY - h * (1 - k) - 2);
    ctx.lineTo(x - w * k * 0.5, baseY - h * (1 - k) + 14);
  }
  ctx.fill();
}

function drawTree(x, h, color, snow) {
  ctx.fillStyle = "#5b3b25";
  ctx.fillRect(x - 3, GROUND_Y - 28, 6, 10);
  for (let k = 0; k < 3; k++) {
    const y = GROUND_Y - 24 - k * h * 0.3, w = h * (0.42 - k * 0.1);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h * 0.45); ctx.lineTo(x + w, y); ctx.fill();
    ctx.fillStyle = snow;
    ctx.beginPath(); ctx.moveTo(x - w * 0.45, y - h * 0.25); ctx.lineTo(x, y - h * 0.45); ctx.lineTo(x + w * 0.45, y - h * 0.25); ctx.fill();
  }
}

function drawBackdrop(left, right, bottom) {
  const w = game.world;
  drawRange(FAR, GROUND_Y - 40, w.far, w.night ? "#c9d6f2" : "#ffffff");
  drawRange(NEAR, GROUND_Y - 10, w.near, w.night ? "#dfe7fa" : "#ffffff");
  for (const [x, h] of TREES) drawTree(x, h, w.tree, w.night ? "#c9d6f2" : "#ffffff");
  // the snow you build on
  ctx.fillStyle = w.snow;
  ctx.fillRect(left, GROUND_Y, right - left, bottom - GROUND_Y);
  ctx.fillStyle = w.night ? "rgba(120,140,200,0.35)" : "rgba(150,200,240,0.35)";
  ctx.fillRect(left, GROUND_Y, right - left, 6);
  // little bumps in the snow
  ctx.fillStyle = w.snow;
  for (let x = Math.floor(left / 60) * 60; x < right; x += 60) {
    ctx.beginPath(); ctx.ellipse(x + 30, GROUND_Y + 1, 34, 6, 0, Math.PI, TAU); ctx.fill();
  }
}

function drawPillar() {
  const x = PILLAR_X - PILLAR_W / 2;
  const g = ctx.createLinearGradient(x, 0, x + PILLAR_W, 0);
  g.addColorStop(0, "#bfe7ff"); g.addColorStop(0.5, "#e9f8ff"); g.addColorStop(1, "#8fcff5");
  ctx.fillStyle = g;
  ctx.fillRect(x, PILLAR_TOP, PILLAR_W, GROUND_Y - PILLAR_TOP);
  ctx.strokeStyle = "rgba(60,140,200,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, PILLAR_TOP + 30); ctx.lineTo(x + 30, PILLAR_TOP + 90); ctx.lineTo(x + 22, PILLAR_TOP + 140);
  ctx.moveTo(x + 58, PILLAR_TOP + 60); ctx.lineTo(x + 50, PILLAR_TOP + 120);
  ctx.stroke();
  ctx.strokeStyle = "#5aa6d8";
  ctx.strokeRect(x, PILLAR_TOP, PILLAR_W, GROUND_Y - PILLAR_TOP);
  ctx.fillStyle = "#ffffff";
  rr(ctx, x - 4, PILLAR_TOP - 6, PILLAR_W + 8, 12, 6);
  ctx.fill();
}

function drawWizard(c, x, y, cast, t) {
  c.save();
  c.translate(x, y);
  const lift = cast > 0 ? -12 : 0;
  // robe
  c.fillStyle = "#4b3bc7";
  c.beginPath(); c.moveTo(-24, 0); c.lineTo(24, 0); c.lineTo(11, -58); c.lineTo(-11, -58); c.closePath(); c.fill();
  c.fillStyle = "#9fd8ff";
  c.fillRect(-24, -6, 48, 6);
  c.fillStyle = "#ffd23f";
  c.beginPath(); c.arc(-6, -30, 3, 0, TAU); c.arc(8, -18, 2.5, 0, TAU); c.fill();
  // arm holding the staff
  c.strokeStyle = "#4b3bc7"; c.lineWidth = 9; c.lineCap = "round";
  c.beginPath(); c.moveTo(6, -48); c.lineTo(24, -44 + lift); c.stroke();
  // staff with its glowing ice orb
  c.strokeStyle = "#8a5a35"; c.lineWidth = 5;
  c.beginPath(); c.moveTo(20, -4); c.lineTo(30, -88 + lift); c.stroke();
  const glow = 9 + Math.sin(t * 5) * 1.5 + (cast > 0 ? 5 : 0);
  const g = c.createRadialGradient(30, -96 + lift, 1, 30, -96 + lift, glow * 2.2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(127,232,255,0.9)"); g.addColorStop(1, "rgba(127,232,255,0)");
  c.fillStyle = g;
  c.beginPath(); c.arc(30, -96 + lift, glow * 2.2, 0, TAU); c.fill();
  // face and beard
  c.fillStyle = "#ffd9b8";
  c.beginPath(); c.arc(0, -66, 11, 0, TAU); c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath(); c.moveTo(-11, -64); c.quadraticCurveTo(0, -28, 11, -64); c.closePath(); c.fill();
  c.fillStyle = "#17375e";
  c.beginPath(); c.arc(-4, -68, 1.8, 0, TAU); c.arc(5, -68, 1.8, 0, TAU); c.fill();
  // pointy hat with stars
  c.fillStyle = "#3a2ca8";
  c.beginPath(); c.ellipse(0, -75, 20, 5, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-14, -76); c.quadraticCurveTo(-4, -100, -10, -122); c.quadraticCurveTo(6, -104, 14, -76); c.closePath(); c.fill();
  c.fillStyle = "#ffd23f";
  c.beginPath(); c.arc(-2, -92, 2.5, 0, TAU); c.arc(5, -82, 2, 0, TAU); c.fill();
  c.restore();
}

function drawCracks(c, w, h, ratio, seed) {
  if (ratio > 0.7) return;
  const rng = makeRng(seed);
  c.strokeStyle = "rgba(30,30,50,0.6)";
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < (ratio > 0.4 ? 1 : 3); i++) {
    let x = (rng() - 0.5) * w * 0.6, y = -h / 2;
    c.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x = clamp(x + (rng() - 0.5) * w * 0.4, -w / 2, w / 2); y += h / 4; c.lineTo(x, y); }
  }
  c.stroke();
}

// draws one block, centred on (0, 0) and not turned. o can have: ratio (health), seed, flash, t, ready
function drawPiece(c, kind, w, h, o = {}) {
  const x = -w / 2, y = -h / 2, t = o.t || 0;
  if (kind === "wood" || kind === "plank") {
    c.fillStyle = "#c08448"; rr(c, x, y, w, h, 4); c.fill();
    c.strokeStyle = "rgba(107,64,30,0.55)"; c.lineWidth = 2;
    c.beginPath();
    if (kind === "wood") {
      c.rect(x + 6, y + 6, w - 12, h - 12);
      c.moveTo(x + 6, y + 6); c.lineTo(x + w - 6, y + h - 6);
    } else {
      c.moveTo(x + 6, 0); c.lineTo(x + w - 6, 0);
    }
    c.stroke();
    c.strokeStyle = "#6b4423"; c.lineWidth = 2.5; rr(c, x, y, w, h, 4); c.stroke();
  } else if (kind === "stone" || kind === "beam") {
    c.fillStyle = "#93a7c0"; rr(c, x, y, w, h, 3); c.fill();
    c.strokeStyle = "rgba(60,78,105,0.5)"; c.lineWidth = 1.5;
    c.beginPath();
    if (kind === "stone") {
      c.moveTo(x, 0); c.lineTo(x + w, 0);
      c.moveTo(-4, y); c.lineTo(-4, 0); c.moveTo(8, 0); c.lineTo(8, y + h);
    } else {
      for (let k = 1; k < 4; k++) { c.moveTo(x + (w * k) / 4, y); c.lineTo(x + (w * k) / 4, y + h); }
    }
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.55)";
    const rng = makeRng(o.seed || 3);
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + rng() * w, y + rng() * h, 1.5, 0, TAU); c.fill(); }
    c.strokeStyle = "#4d6080"; c.lineWidth = 2.5; rr(c, x, y, w, h, 3); c.stroke();
  } else if (kind === "crystal") {
    c.fillStyle = "#5d6f8f"; rr(c, x, y + h - 9, w, 9, 3); c.fill();
    const pulse = 0.6 + Math.sin(t * 3 + (o.seed || 0)) * 0.25;
    c.save();
    c.shadowColor = "#7fe8ff"; c.shadowBlur = 14 * pulse;
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#e9fbff"); g.addColorStop(0.5, "#7fe8ff"); g.addColorStop(1, "#6d5cff");
    c.fillStyle = g;
    const top = y, bot = y + h - 9, mid = (top + bot) / 2;
    c.beginPath();
    c.moveTo(0, top); c.lineTo(w / 2, mid - 8); c.lineTo(w / 2 - 3, bot); c.lineTo(-w / 2 + 3, bot); c.lineTo(-w / 2, mid - 8);
    c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, top); c.lineTo(-3, bot); c.moveTo(w / 2, mid - 8); c.lineTo(-3, mid); c.stroke();
  } else if (kind === "tower") {
    c.fillStyle = "#a9c4dd";
    c.fillRect(x, y + 8, w, h - 8);
    for (let k = 0; k < 3; k++) c.fillRect(x + k * (w / 2.5), y, w / 5, 10);
    c.strokeStyle = "rgba(77,106,138,0.5)"; c.lineWidth = 1.5;
    c.beginPath();
    for (let k = 1; k < 4; k++) { c.moveTo(x, y + 8 + k * (h - 8) / 4); c.lineTo(x + w, y + 8 + k * (h - 8) / 4); }
    c.stroke();
    c.fillStyle = "#24365a";
    c.beginPath(); c.moveTo(-7, y + 40); c.lineTo(-7, y + 26); c.arc(0, y + 26, 7, Math.PI, 0); c.lineTo(7, y + 40); c.fill();
    if (o.ready) { c.fillStyle = "rgba(127,232,255,0.85)"; c.beginPath(); c.arc(0, y + 30, 4, 0, TAU); c.fill(); }
    c.strokeStyle = "#4d6a8a"; c.lineWidth = 2.5; c.strokeRect(x, y + 8, w, h - 8);
  } else if (kind === "flag") {
    c.fillStyle = "#d9dde6"; c.fillRect(-2, y, 4, h);
    c.fillStyle = "#ffd23f"; c.beginPath(); c.arc(0, y, 4, 0, TAU); c.fill();
    const wave = Math.sin(t * 6 + (o.seed || 0)) * 4;
    c.fillStyle = "#7b5cff";
    c.beginPath(); c.moveTo(2, y + 4); c.quadraticCurveTo(18, y + 4 + wave, 34, y + 13 + wave * 0.5);
    c.quadraticCurveTo(18, y + 22 - wave, 2, y + 22); c.closePath(); c.fill();
    c.fillStyle = "#fff";
    c.beginPath(); c.arc(14, y + 13 + wave * 0.3, 3, 0, TAU); c.fill();
  }
  // snow on top of everything except crystals and flags
  if (kind !== "crystal" && kind !== "flag") {
    c.fillStyle = "#ffffff";
    rr(c, x - 1, y - 3, w + 2, 7, 3.5); c.fill();
    c.beginPath(); c.arc(x + w * 0.3, y + 4, 2.5, 0, TAU); c.arc(x + w * 0.75, y + 4, 2, 0, TAU); c.fill();
  }
  drawCracks(c, w, h, o.ratio ?? 1, o.seed || 1);
  if (o.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(0.8, o.flash * 5)})`; rr(c, x, y, w, h, 3); c.fill(); }
}

function drawBlock(b) {
  const p = b.body.position;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(b.body.angle);
  drawPiece(ctx, b.kind, b.p.w, b.p.h, { ratio: b.hp / b.maxHp, seed: b.seed, flash: b.flash, t: game.t,
    ready: b.kind === "tower" && b.cool < 0.6 && upright(b) });
  ctx.restore();
}

function drawGoblin(f) {
  const x = f.x, y = GROUND_Y;
  const hop = f.cheer ? Math.abs(Math.sin(game.t * 10)) * -10 : 0;
  ctx.save();
  ctx.translate(x, y);
  // the catapult
  const spin = x / 12;
  for (const wx of [-26, 14]) {
    ctx.fillStyle = "#5b3b25";
    ctx.beginPath(); ctx.arc(wx, -10, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#c08448"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx + Math.cos(spin) * 8, -10 + Math.sin(spin) * 8); ctx.lineTo(wx - Math.cos(spin) * 8, -10 - Math.sin(spin) * 8); ctx.stroke();
  }
  ctx.fillStyle = "#7a4a24";
  ctx.fillRect(-36, -26, 60, 10);
  ctx.fillRect(-6, -52, 8, 28);
  const k = f.anim / 0.5;   // 1 just after throwing, then back to 0
  const a = 0.3 + (-2.5 - 0.3) * k;
  ctx.save();
  ctx.translate(-2, -48);
  ctx.rotate(a);
  ctx.fillStyle = "#9a6232";
  ctx.fillRect(0, -3, 44, 6);
  ctx.fillStyle = "#5b3b25";
  ctx.beginPath(); ctx.arc(44, -4, 8, Math.PI, TAU); ctx.fill();
  if (k < 0.1 && f.ammo > 0 && f.state === "fight") {
    ctx.fillStyle = "#ff6a3d";
    ctx.beginPath(); ctx.arc(44, -9, 7 + Math.sin(game.t * 20), 0, TAU); ctx.fill();
  }
  ctx.restore();
  // the goblin
  ctx.translate(36, hop);
  ctx.fillStyle = f.hurt > 0 ? "#ffffff" : "#5aa64a";
  ctx.beginPath(); ctx.ellipse(0, -20, 11, 15, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -40, 10, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, -42); ctx.lineTo(-20, -48); ctx.lineTo(-8, -36); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8, -42); ctx.lineTo(20, -48); ctx.lineTo(8, -36); ctx.fill();
  ctx.fillStyle = "#d33a2c";
  ctx.beginPath(); ctx.moveTo(-11, -42); ctx.lineTo(0, -62); ctx.lineTo(11, -42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffe14d";
  ctx.beginPath(); ctx.arc(-4, -40, 2.5, 0, TAU); ctx.arc(4, -40, 2.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(-8, -6, 6, 6); ctx.fillRect(2, -6, 6, 6);
  ctx.restore();
}

function drawTroll(f) {
  const hop = f.cheer ? Math.abs(Math.sin(game.t * 8)) * -12 : 0;
  ctx.save();
  ctx.translate(f.x, GROUND_Y + hop);
  const fur = f.hurt > 0 ? "#ffffff" : "#e6f2ff";
  ctx.fillStyle = "#8fb0d0";
  ctx.fillRect(-22, -20, 16, 20); ctx.fillRect(6, -20, 16, 20);
  ctx.fillStyle = fur; ctx.strokeStyle = "#8fb0d0"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -66, 36, 50, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // arms: up holding a boulder just before throwing, down the rest of the time
  const holding = f.state === "fight" && f.ammo > 0 && f.timer < 1;
  ctx.strokeStyle = fur; ctx.lineWidth = 14; ctx.lineCap = "round";
  ctx.beginPath();
  if (holding) { ctx.moveTo(-28, -80); ctx.lineTo(-22, -128); ctx.moveTo(28, -80); ctx.lineTo(22, -128); }
  else if (f.anim > 0) { ctx.moveTo(-28, -80); ctx.lineTo(-58, -100); ctx.moveTo(28, -80); ctx.lineTo(-10, -110); }
  else { ctx.moveTo(-30, -78); ctx.lineTo(-40, -40); ctx.moveTo(30, -78); ctx.lineTo(40, -40); }
  ctx.stroke();
  if (holding) {
    ctx.fillStyle = "#8d8d9a";
    ctx.beginPath(); ctx.arc(0, -140, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(0, -158, 14, 6, 0, 0, TAU); ctx.fill();
  }
  // face
  ctx.fillStyle = "#9cc3e6";
  ctx.beginPath(); ctx.ellipse(-8, -92, 20, 15, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#17375e";
  ctx.beginPath(); ctx.arc(-16, -96, 3, 0, TAU); ctx.arc(-2, -96, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#17375e"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-22, -103); ctx.lineTo(-11, -100); ctx.moveTo(4, -103); ctx.lineTo(-6, -100); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(-18, -84); ctx.lineTo(-15, -76); ctx.lineTo(-12, -84); ctx.moveTo(0, -84); ctx.lineTo(3, -76); ctx.lineTo(6, -84); ctx.fill();
  // horns
  ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(-26, -116, 10, Math.PI * 0.2, Math.PI * 1.2); ctx.moveTo(30, -112); ctx.arc(22, -116, 10, -0.2, Math.PI * 0.8, true); ctx.stroke();
  ctx.restore();
}

function drawImp(f) {
  const flap = Math.sin(game.t * 22 + f.bob) * 0.6;
  ctx.save();
  ctx.translate(f.x, f.y + (f.cheer ? Math.sin(game.t * 10) * 8 : 0));
  ctx.fillStyle = "#7a1424";
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(flap);
    ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(38, -22); ctx.lineTo(32, -6); ctx.lineTo(40, 2); ctx.lineTo(10, 6); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = f.hurt > 0 ? "#ffffff" : "#e2463a";
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ffb347";
  ctx.beginPath(); ctx.ellipse(0, 6, 9, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#3a0a10";
  ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-14, -26); ctx.lineTo(-4, -15); ctx.moveTo(10, -12); ctx.lineTo(14, -26); ctx.lineTo(4, -15); ctx.fill();
  ctx.fillStyle = "#ffe14d";
  ctx.beginPath(); ctx.arc(-6, -4, 3, 0, TAU); ctx.arc(6, -4, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#e2463a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 16); ctx.quadraticCurveTo(14, 30, 22, 22); ctx.stroke();
  // a little flame on its head, brighter when it is calling lightning
  ctx.fillStyle = f.anim > 0 ? "#fff3b0" : "#ffb347";
  ctx.beginPath(); ctx.moveTo(-5, -16); ctx.quadraticCurveTo(0, -34 - Math.sin(game.t * 15) * 4, 5, -16); ctx.fill();
  ctx.restore();
}

function drawBoss(f) {
  ctx.save();
  ctx.translate(f.x, f.y);
  const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 120);
  aura.addColorStop(0, "rgba(255,120,60,0.45)"); aura.addColorStop(1, "rgba(255,120,60,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, 120, 0, TAU); ctx.fill();
  // robe
  const g = ctx.createLinearGradient(0, -50, 0, 70);
  g.addColorStop(0, f.hurt > 0 ? "#ffffff" : "#7a1424"); g.addColorStop(1, "#c2410c");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(20, -40); ctx.lineTo(42, 66);
  for (let k = 0; k < 6; k++) ctx.lineTo(42 - k * 14 - 7, 66 + (k % 2 ? 0 : 12) + Math.sin(game.t * 6 + k) * 4);
  ctx.lineTo(-42, 66); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffb347"; ctx.fillRect(-4, -36, 8, 96);
  // hood and glowing eyes
  ctx.fillStyle = "#4a0d18";
  ctx.beginPath(); ctx.arc(0, -50, 26, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18, -66); ctx.lineTo(0, -98); ctx.lineTo(18, -66); ctx.fill();
  ctx.fillStyle = "#14040a";
  ctx.beginPath(); ctx.ellipse(-2, -46, 16, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ffb347";
  ctx.beginPath(); ctx.arc(-8, -48, 3.5, 0, TAU); ctx.arc(4, -48, 3.5, 0, TAU); ctx.fill();
  // fire staff
  const lift = f.anim > 0 ? -20 : 0;
  ctx.strokeStyle = "#3a1a10"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-36, 60); ctx.lineTo(-46, -70 + lift); ctx.stroke();
  const flame = 14 + Math.sin(game.t * 18) * 3 + (f.anim > 0 ? 8 : 0);
  const fg = ctx.createRadialGradient(-46, -80 + lift, 2, -46, -80 + lift, flame * 1.8);
  fg.addColorStop(0, "#fff3b0"); fg.addColorStop(0.4, "#ffb347"); fg.addColorStop(1, "rgba(255,77,46,0)");
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(-46, -80 + lift, flame * 1.8, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawFoeBar(f) {
  if (f.kind === "boss" || f.hp >= f.maxHp) return;
  const c = foeCenter(f), r = FOES[f.kind].r;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(c.x - 22, c.y - r - 18, 44, 6);
  ctx.fillStyle = "#ff5a4f";
  ctx.fillRect(c.x - 22, c.y - r - 18, 44 * Math.max(0, f.hp / f.maxHp), 6);
}

function drawShot(s) {
  const p = s.body.position;
  if (s.kind === "boulder" || s.kind === "meteor") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(s.body.angle);
    ctx.fillStyle = s.kind === "meteor" ? "#5a3a32" : "#8d8d9a";
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU, r = s.s.r * (k % 2 ? 0.92 : 1.05);
      k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath(); ctx.arc(-s.s.r * 0.3, -s.s.r * 0.3, s.s.r * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (s.kind === "fireball" || s.kind === "meteor") {
    const r = s.kind === "meteor" ? s.s.r * 1.5 : s.s.r * 1.6;
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
    g.addColorStop(0, "#fff3b0"); g.addColorStop(0.45, "rgba(255,140,50,0.95)"); g.addColorStop(1, "rgba(255,77,46,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
}

function drawLightning(s) {
  if (s.flash <= 0) {
    // the warning: a red circle that gets smaller as the strike gets closer
    const k = clamp(s.warn / 1.4, 0, 1);
    ctx.strokeStyle = `rgba(255,60,40,${0.5 + Math.sin(game.t * 20) * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(s.x, s.y, 20 + k * 30, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#ff3c28";
    ctx.font = "bold 28px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", s.x, s.y - 34 - k * 30);
    return;
  }
  const rng = makeRng((s.x * 7) | 0);
  ctx.save();
  ctx.strokeStyle = "#fff8d0";
  ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 20;
  ctx.lineWidth = 5 * (s.flash / 0.3) + 1;
  ctx.beginPath();
  let x = s.x + 60, y = -40;
  ctx.moveTo(x, y);
  while (y < s.y) { y = Math.min(s.y, y + 40); x += (rng() - 0.5) * 50 + (s.x - x) * 0.25; ctx.lineTo(y >= s.y ? s.x : x, y); }
  ctx.stroke();
  ctx.restore();
}

function drawShield() {
  if (game.shield <= 0 || !game.dome) return;
  const d = game.dome;
  const fade = Math.min(1, game.shield * 2);
  ctx.save();
  ctx.globalAlpha = fade;
  const g = ctx.createRadialGradient(d.cx, d.cy, d.ry * 0.2, d.cx, d.cy, Math.max(d.rx, d.ry));
  g.addColorStop(0, "rgba(140,220,255,0.05)"); g.addColorStop(1, "rgba(140,220,255,0.3)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(d.cx, d.cy, d.rx, d.ry, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(200,240,255,${0.6 + Math.sin(game.t * 8) * 0.3})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 10]);
  ctx.lineDashOffset = -game.t * 40;
  ctx.beginPath(); ctx.ellipse(d.cx, d.cy, d.rx, d.ry, 0, Math.PI, TAU); ctx.stroke();
  ctx.restore();
}

function drawGhost() {
  if (game.state !== "build" || !pointer.inside) return;
  if (game.tool === "sell" || game.tool === "fix") {
    const b = blockAt(pointer.x, pointer.y);
    if (!b) return;
    const p = b.body.position;
    const text = game.tool === "sell" ? `Sell +${sellPrice(b)} 🪙` : b.hp >= b.maxHp ? "Not broken" : `Fix −${fixPrice(b)} 🪙`;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(b.body.angle);
    ctx.strokeStyle = game.tool === "sell" ? "#ffd23f" : "#9cff8a"; ctx.lineWidth = 4;
    ctx.strokeRect(-b.p.w / 2 - 3, -b.p.h / 2 - 3, b.p.w + 6, b.p.h + 6);
    ctx.restore();
    label(text, p.x, p.y - b.p.h / 2 - 22);
    return;
  }
  const g = ghostAt(pointer.x, pointer.y);
  if (!g) return;
  const bad = !g.ok || game.gold < g.p.cost;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.translate(g.x, g.y);
  ctx.rotate(g.angle);
  drawPiece(ctx, g.p.id, g.p.w, g.p.h, { t: game.t });
  if (bad) { ctx.fillStyle = "rgba(255,60,40,0.55)"; ctx.fillRect(-g.p.w / 2, -g.p.h / 2, g.p.w, g.p.h); }
  ctx.restore();
}

function label(text, x, y) {
  ctx.font = "bold 20px Nunito, sans-serif";
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  rr(ctx, x - w / 2, y - 16, w, 26, 10); ctx.fill();
  ctx.fillStyle = "#17375e";
  ctx.fillText(text, x, y + 3);
}

function drawZone() {
  // ice posts at the edges of where you can build
  for (const x of [ZONE_LEFT, ZONE_RIGHT]) {
    ctx.fillStyle = "#bfe7ff"; ctx.fillRect(x - 5, GROUND_Y - 40, 10, 40);
    ctx.fillStyle = "#7b5cff";
    ctx.beginPath(); ctx.moveTo(x + 5, GROUND_Y - 40); ctx.lineTo(x + 22, GROUND_Y - 34); ctx.lineTo(x + 5, GROUND_Y - 28); ctx.fill();
  }
  if (game.state !== "build") return;
  ctx.save();
  ctx.strokeStyle = "rgba(60,140,220,0.45)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.strokeRect(ZONE_LEFT, TOP_LIMIT, ZONE_RIGHT - ZONE_LEFT, GROUND_Y - TOP_LIMIT);
  ctx.restore();
}

function drawAim() {
  if (game.state !== "battle" || !pointer.inside) return;
  if (game.spell === "mend") {
    ctx.save();
    ctx.strokeStyle = "rgba(120,255,120,0.9)"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, MEND_RADIUS, 0, TAU); ctx.stroke();
    ctx.restore();
    label("Tap to mend 💚", pointer.x, pointer.y - MEND_RADIUS - 14);
    return;
  }
  const a = Math.atan2(pointer.y - STAFF.y, pointer.x - STAFF.x);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let k = 1; k < 7; k++) { ctx.beginPath(); ctx.arc(STAFF.x + Math.cos(a) * k * 26, STAFF.y + Math.sin(a) * k * 26, 3, 0, TAU); ctx.fill(); }
}

let lastDraw = performance.now();
function draw() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastDraw) / 1000);
  lastDraw = now;
  const { s, ox, oy, cw, ch, dpr } = view;
  const w = game.world;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, w.sky[0]); sky.addColorStop(1, w.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cw, ch);
  if (w.night) {
    ctx.fillStyle = "#ffffff";
    for (const [x, y, r] of STARS) { ctx.globalAlpha = 0.5 + Math.sin(game.t * 2 + x * 50) * 0.4; ctx.beginPath(); ctx.arc(x * cw, y * ch, r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff8dc";
    ctx.beginPath(); ctx.arc(cw * 0.8, ch * 0.15, 34, 0, TAU); ctx.fill();
  }
  const shake = game.shake * 8;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (ox + rand(-shake, shake)), dpr * (oy + rand(-shake, shake)));
  const left = -ox / s - 40, right = (cw - ox) / s + 40, bottom = (ch - oy) / s + 40;

  drawBackdrop(left, right, bottom);
  drawZone();
  drawPillar();
  drawWizard(ctx, PILLAR_X, PILLAR_TOP, game.castAnim, game.t);
  for (const b of blocks) drawBlock(b);
  drawGhost();
  for (const f of enemies) {
    if (f.delay > 0) continue;
    if (f.kind === "goblin") drawGoblin(f);
    else if (f.kind === "troll") drawTroll(f);
    else if (f.kind === "imp") drawImp(f);
    else drawBoss(f);
    drawFoeBar(f);
  }
  for (const sh of shots) drawShot(sh);
  for (const st of strikes) drawLightning(st);

  // freeze blasts, tower arrows and crystal zaps
  for (const b of bolts) {
    const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 16);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "rgba(127,232,255,0.9)"); g.addColorStop(1, "rgba(127,232,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = "#dff6ff"; ctx.lineWidth = 3; ctx.lineCap = "round";
  for (const a of arrows) {
    const len = Math.hypot(a.vx, a.vy) || 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - (a.vx / len) * 18, a.y - (a.vy / len) * 18); ctx.stroke();
  }
  ctx.strokeStyle = "#7fe8ff"; ctx.lineWidth = 3;
  for (const z of zaps) {
    ctx.globalAlpha = z.life / 0.25;
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
    for (let k = 1; k <= 5; k++) ctx.lineTo(z.x1 + (z.x2 - z.x1) * k / 5 + (k < 5 ? rand(-10, 10) : 0), z.y1 + (z.y2 - z.y1) * k / 5 + (k < 5 ? rand(-10, 10) : 0));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    if (p.square) ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  drawShield();
  drawAim();

  ctx.font = "bold 24px Nunito, sans-serif";
  ctx.textAlign = "center";
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.lineWidth = 4; ctx.strokeStyle = "#17375e"; ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // falling snow (and embers in Pyrrak's storm)
  const blow = (game.wind || 0) * 60 + (w.blizzard ? 40 : 0);
  ctx.fillStyle = w.embers ? "#ffb347" : "#ffffff";
  for (const f of FLAKES) {
    f.y += (30 + f.s * 50) * dt * (w.embers ? -0.6 : 1) * (w.blizzard ? 2 : 1);
    f.x += (Math.sin(game.t + f.ph) * 15 + blow) * dt;
    if (f.y > GROUND_Y + 60) f.y = -20;
    if (f.y < -40) f.y = GROUND_Y + 40;
    if (f.x > right + 40) f.x = left - 20;
    if (f.x < left - 40) f.x = right + 20;
    ctx.globalAlpha = w.embers ? 0.7 : 0.85;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (w.embers ? 0.7 : 1), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- 17. the HUD, buttons and menus ----------
function setText(el, text) { if (el._t !== text) { el.textContent = text; el._t = text; } }
let toastTimer = 0;
function toast(text, time = 2.2) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), time * 1000);
}

const SCREENS = ["title-screen", "map-screen", "pause-screen", "clear-screen", "over-screen", "end-screen"];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", !!id && id !== "pause-screen");
  layout();
}
function setPhase(phase) {
  document.body.classList.toggle("phase-build", phase === "build");
  document.body.classList.toggle("phase-battle", phase === "battle");
  layout();
}

function updateHud() {
  if (document.body.classList.contains("in-menu")) return;
  setText($("level-label"), game.mode === "endless" ? "♾️ Endless" : `${game.world.icon} ${game.info.name}`);
  setText($("wave"), game.mode === "endless" ? `${game.waveNo + 1}` : `${Math.min(game.waveNo + 1, game.waves.length)}/${game.waves.length}`);
  setText($("gold"), `${Math.floor(game.gold)}`);
  const st = strength();
  setText($("strength"), blocks.length ? `${Math.round(st * 100)}%` : "—");
  $("strength-pill").classList.toggle("low", fighting() && st < 0.45);
  $("wind-pill").classList.toggle("hidden", !game.wind);
  if (game.wind) setText($("wind"), (game.wind > 0 ? "→" : "←").repeat(Math.abs(game.wind) > 1 ? 2 : 1));
  // the build buttons
  for (const btn of document.querySelectorAll("[data-tool]")) {
    btn.classList.toggle("on", btn.dataset.tool === game.tool);
    const p = PIECE[btn.dataset.tool];
    if (p) btn.classList.toggle("poor", game.gold < p.cost);
  }
  $("turn").classList.toggle("on", game.turned && !!PIECE[game.tool] && !!PIECE[game.tool].turns);
  // the spell buttons and magic bar
  for (const btn of document.querySelectorAll("[data-spell]")) btn.classList.toggle("on", btn.dataset.spell === game.spell);
  $("shield-btn").classList.toggle("cool", game.shieldCool > 0 || game.mana < SHIELD_COST);
  setText($("shield-cost"), game.shieldCool > 0 ? `${Math.ceil(game.shieldCool)}s` : `${SHIELD_COST}`);
  $("mana-fill").style.width = `${game.mana}%`;
  setText($("mana-text"), `${Math.floor(game.mana)}`);
  const boss = game.boss && game.info && game.info.boss && !game.bossBeaten && fighting();
  $("boss-bar").classList.toggle("hidden", !boss);
  if (boss) $("boss-fill").style.width = `${(game.boss.hp / game.boss.maxHp) * 100}%`;
}

// the block buttons, each with a little drawing of its block
for (const [i, p] of PIECES.entries()) {
  const btn = document.createElement("button");
  btn.className = "piece";
  btn.dataset.tool = p.id;
  btn.title = `${p.name} (${i + 1})`;
  const icon = document.createElement("canvas");
  icon.width = 88; icon.height = 64;
  const c = icon.getContext("2d");
  const k = Math.min(76 / (p.w + 30), 54 / p.h, 1.3);
  c.translate(44 - (p.id === "flag" ? 10 * k : 0), 34);
  c.scale(k, k);
  drawPiece(c, p.id, p.w, p.h, { seed: 5, t: 1 });
  const cost = document.createElement("span");
  cost.textContent = p.cost;
  btn.append(icon, cost);
  $("pieces").append(btn);
}
for (const btn of document.querySelectorAll("[data-tool]")) btn.addEventListener("click", () => pickTool(btn.dataset.tool));
for (const btn of document.querySelectorAll("[data-spell]")) btn.addEventListener("click", () => pickSpell(btn.dataset.spell));
$("turn").addEventListener("click", turnPiece);
$("fight").addEventListener("click", startWave);

function buildMap() {
  const map = $("map");
  map.innerHTML = "";
  let total = 0;
  WORLDS.forEach((world, wi) => {
    const row = document.createElement("div");
    row.className = "world" + (world.boss ? " boss" : "");
    row.innerHTML = `<div class="world-name">${world.icon} ${world.name}</div>`;
    LEVELS.forEach((info, idx) => {
      if (info.world !== wi) return;
      const btn = document.createElement("button");
      const stars = save.stars[idx] || 0;
      total += stars;
      btn.className = "lvl" + (info.boss ? " king" : stars ? " done" : "");
      btn.disabled = idx > save.unlocked;
      btn.innerHTML = `${info.boss ? "🔥 Pyrrak" : info.k + 1}<small>${btn.disabled ? "🔒" : "★".repeat(stars) + "☆".repeat(3 - stars)}</small>`;
      btn.addEventListener("click", () => { audio(); startLevel(idx); });
      row.append(btn);
    });
    map.append(row);
  });
  setText($("map-stars"), `⭐ ${total} / ${LEVELS.length * 3}`);
}

function showTitle() {
  game.state = "menu";
  for (const btn of document.querySelectorAll("[data-diff]")) btn.classList.toggle("on", btn.dataset.diff === save.diff);
  const best = save.best[save.diff] || 0;
  $("best-text").textContent = best ? `♾️ Endless best on ${save.diff}: wave ${best}` : "Endless mode: survive as many waves as you can!";
  show("title-screen");
}
function showMap() { game.state = "menu"; buildMap(); show("map-screen"); }

function togglePause() {
  if (game.state === "paused") {
    game.state = game.pausedFrom;
    show(null);
  } else if (running()) {
    game.pausedFrom = game.state;
    game.state = "paused";
    pointer.down = false;
    $("pause-map").textContent = game.mode === "endless" ? "🏠 Title" : "🗺️ Levels";
    show("pause-screen");
  }
}
function restart() { if (game.mode === "endless") startEndless(); else startLevel(game.level); }
function toggleSound() {
  save.muted = !save.muted;
  writeSave();
  $("sound").textContent = save.muted ? "🔇" : "🔊";
}

for (const btn of document.querySelectorAll("[data-diff]")) {
  btn.addEventListener("click", () => { audio(); save.diff = btn.dataset.diff; writeSave(); play("click"); showTitle(); });
}
$("play").addEventListener("click", () => { audio(); showMap(); });
$("endless").addEventListener("click", () => { audio(); startEndless(); });
$("map-back").addEventListener("click", showTitle);
$("resume").addEventListener("click", togglePause);
$("pause-restart").addEventListener("click", restart);
$("pause-map").addEventListener("click", () => (game.mode === "endless" ? showTitle() : showMap()));
$("next").addEventListener("click", () => (game.level + 1 < LEVELS.length ? startLevel(game.level + 1) : showMap()));
$("replay").addEventListener("click", restart);
$("clear-map").addEventListener("click", showMap);
$("retry").addEventListener("click", restart);
$("over-map").addEventListener("click", () => (game.mode === "endless" ? showTitle() : showMap()));
$("end-map").addEventListener("click", showMap);
$("end-endless").addEventListener("click", startEndless);
$("pause").addEventListener("click", togglePause);
$("sound").addEventListener("click", () => { audio(); toggleSound(); });
$("sound").textContent = save.muted ? "🔇" : "🔊";

// ---------- 18. mouse, fingers and keys ----------
function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = (e.clientX - r.left - view.ox) / view.s;
  pointer.y = (e.clientY - r.top - view.oy) / view.s;
  pointer.inside = true;
}
canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerleave", () => { pointer.inside = false; pointer.down = false; });
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("pointerdown", e => {
  audio();
  setPointer(e);
  if (game.state === "build") {
    if (e.button === 2) turnPiece();
    else buildTap(pointer.x, pointer.y);
  } else if (game.state === "battle") {
    if (game.spell === "mend") castMend(pointer.x, pointer.y);
    else { pointer.down = true; castFreeze(pointer.x, pointer.y); }
  }
});
window.addEventListener("pointerup", () => { pointer.down = false; });
window.addEventListener("pointercancel", () => { pointer.down = false; });
canvas.addEventListener("wheel", () => { if (game.state === "build") turnPiece(); }, { passive: true });

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === "m") { audio(); toggleSound(); return; }
  if (k === "escape" || k === "p") { togglePause(); return; }
  if (game.state === "build") {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= PIECES.length) pickTool(PIECES[n - 1].id);
    else if (k === "x") pickTool("sell");
    else if (k === "f") pickTool("fix");
    else if (k === "r") turnPiece();
    else if (k === "enter" || k === " ") { e.preventDefault(); startWave(); }
  } else if (game.state === "battle") {
    if (k === "1") pickSpell("freeze");
    else if (k === "2") pickSpell("mend");
    else if (k === "3" || k === " ") { e.preventDefault(); castShield(); }
  } else if (game.state === "won" && k === "enter") {
    $("next").click();
  }
});

// stop the game if you switch to another tab
document.addEventListener("visibilitychange", () => { if (document.hidden && running()) togglePause(); });
window.addEventListener("resize", layout);

// ---------- 19. the title picture and a castle to look at behind the menus ----------
function drawHeroArt() {
  const c = $("hero-art").getContext("2d");
  c.clearRect(0, 0, 560, 170);
  c.save();
  c.fillStyle = "#ffffff";
  c.beginPath(); c.ellipse(280, 168, 290, 22, 0, Math.PI, TAU); c.fill();
  drawWizard(c, 70, 160, 1, 1);
  const piece = (kind, x, y, turned) => {
    c.save(); c.translate(x, y); if (turned) c.rotate(Math.PI / 2);
    const p = PIECE[kind]; drawPiece(c, kind, p.w, p.h, { seed: x | 0, t: 1, ready: true }); c.restore();
  };
  piece("stone", 200, 136); piece("wood", 240, 136); piece("stone", 280, 136); piece("crystal", 320, 132); piece("stone", 360, 136);
  piece("beam", 240, 102); piece("beam", 340, 102);
  piece("tower", 220, 56); piece("wood", 280, 68); piece("tower", 360, 56); piece("flag", 286, 20);
  // a fireball and a freeze blast meeting in the sky
  const fg = c.createRadialGradient(500, 50, 2, 500, 50, 24);
  fg.addColorStop(0, "#fff3b0"); fg.addColorStop(0.45, "rgba(255,140,50,0.95)"); fg.addColorStop(1, "rgba(255,77,46,0)");
  c.fillStyle = fg; c.beginPath(); c.arc(500, 50, 24, 0, TAU); c.fill();
  const ig = c.createRadialGradient(440, 40, 1, 440, 40, 16);
  ig.addColorStop(0, "#ffffff"); ig.addColorStop(0.5, "rgba(127,232,255,0.9)"); ig.addColorStop(1, "rgba(127,232,255,0)");
  c.fillStyle = ig; c.beginPath(); c.arc(440, 40, 16, 0, TAU); c.fill();
  c.restore();
}

function demoCastle() {
  clearBattlefield();
  const y0 = GROUND_Y;
  const put = (kind, x, y, turned) => {
    const b = addBlock(kind, x, y, turned ? Math.PI / 2 : 0);
    Sleeping.set(b.body, true);
  };
  put("stone", 230, y0 - 20); put("stone", 270, y0 - 20); put("wood", 330, y0 - 20); put("crystal", 390, y0 - 24);
  put("wood", 450, y0 - 20); put("stone", 510, y0 - 20); put("stone", 550, y0 - 20);
  put("beam", 270, y0 - 54); put("beam", 510, y0 - 54);
  put("tower", 250, y0 - 100); put("tower", 530, y0 - 100); put("plank", 390, y0 - 58);
  put("stone", 370, y0 - 88); put("stone", 410, y0 - 88); put("flag", 390, y0 - 136);
}

// ---------- 20. start ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running()) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps++ < 6) { step(); acc -= STEP; }
    if (steps >= 6) acc = 0;
  } else {
    acc = 0;
    if (game.state === "menu" || game.state === "won" || game.state === "over") game.t += dt;
  }
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

drawHeroArt();
demoCastle();
layout();
showTitle();
requestAnimationFrame(frame);
