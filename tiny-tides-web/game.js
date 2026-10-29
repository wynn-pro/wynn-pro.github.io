// Tiny Tides: cast from a little boat, fight the fish on the line and fill your journal.
// Everything runs in the browser: no server, no downloads, so it works on GitHub Pages.
"use strict";

const W = 960;
const H = 560;
const SURFACE = 190;          // y of the water line
const BOTTOM = 548;           // y of the lake floor
const DEPTH_M = 40;           // the lake is 40 m deep
const PX_PER_M = (BOTTOM - SURFACE) / DEPTH_M;
const BOAT_X = 110;           // middle of the boat
const ROD_TIP = { x: 200, y: 92 };
const LANDING = { x: 205, y: SURFACE };   // reel the lure (or a fish) to here to pull it out

const DAY_LEN = 120;          // a whole day and night lasts 2 minutes
const SINK_SPEED = 60;        // pixels per second the lure sinks
const CAST_MIN = 90;          // the weakest cast lands this far past the rod tip...
const CAST_MAX = 720;         // ...the strongest this far
const CHARGE_SPEED = 1.1;     // the power meter fills (and empties again) this fast
const BITE_WINDOW = 0.8;      // seconds you have to click after a bite
const NOTICE_CHANCE = 0.7;    // chance per second that a fish near the lure goes for it
const CATCH_RANGE = 26;       // reel the lure this close to the boat and it comes out
const TENSION_EASE = 3;       // how fast the line tension follows the pull
const WARN_AT = 0.75;         // above 75% tension the line turns red

const SAVE_KEY = "tinytides-save";

// every upgrade has 4 levels; level 0 is what you start with
const GEAR = {
  rod:  { icon: "🎣", name: "Rod",  desc: "Pull harder before the line snaps.",
          levels: [["Twig Rod", 100], ["Bamboo Rod", 135, 40], ["Carbon Rod", 175, 150], ["Titan Rod", 230, 400]] },
  reel: { icon: "🌀", name: "Reel", desc: "Reel in faster.",
          levels: [["Squeaky Reel", 80], ["Smooth Reel", 110, 30], ["Turbo Reel", 145, 120], ["Hurricane Reel", 190, 320]] },
  line: { icon: "🧵", name: "Line", desc: "Longer line lets the lure sink deeper.",
          levels: [["10 m Line", 10], ["20 m Line", 20, 25], ["30 m Line", 30, 130], ["40 m Line", 40, 340]] },
  bait: { icon: "🪱", name: "Bait", desc: "Fish notice it from farther away, and rare fish bite more.",
          levels: [["Worm", 0], ["Shrimp", 1, 50], ["Glow Lure", 2, 170], ["Golden Lure", 3, 420]] },
};

const ZONES = ["Shallows", "Reef", "Deep", "Abyss"];
const ZONE_FISH = [5, 4, 4, 3];   // how many fish swim in each zone at once

const RARITY_WEIGHT = { common: 10, uncommon: 5, rare: 2, legendary: 0.7 };
const BAIT_BOOST = { common: 0, uncommon: 0.3, rare: 0.6, legendary: 1 };   // extra weight per bait level

// cm: normal length, size: how big it is drawn, strength: how hard it pulls
const FISH = [
  { id: "minnow",  name: "Minnow",        zone: 0, rarity: "common",    value: 2,   strength: 18,  speed: 80, cm: 8,   size: 0.55, shape: "fish",    color: "#c7d3dc", fin: "#93a9b8" },
  { id: "sunny",   name: "Sunny",         zone: 0, rarity: "common",    value: 4,   strength: 26,  speed: 55, cm: 14,  size: 0.75, shape: "fish",    color: "#ffcf5a", fin: "#ff8c42" },
  { id: "perch",   name: "Tiger Perch",   zone: 0, rarity: "uncommon",  value: 8,   strength: 40,  speed: 65, cm: 24,  size: 0.9,  shape: "fish",    color: "#9ccc65", fin: "#ff7043", stripes: true },
  { id: "snapper", name: "Coral Snapper", zone: 1, rarity: "common",    value: 12,  strength: 50,  speed: 60, cm: 35,  size: 1.0,  shape: "fish",    color: "#ff6f61", fin: "#c8443a" },
  { id: "puffer",  name: "Puffer",        zone: 1, rarity: "uncommon",  value: 18,  strength: 36,  speed: 35, cm: 22,  size: 0.9,  shape: "puffer",  color: "#ffe08a", fin: "#d9a640", spots: true },
  { id: "bass",    name: "Striped Bass",  zone: 1, rarity: "rare",      value: 26,  strength: 66,  speed: 70, cm: 55,  size: 1.2,  shape: "fish",    color: "#9fb6cc", fin: "#4f6b85", stripes: true },
  { id: "eel",     name: "Silver Eel",    zone: 2, rarity: "common",    value: 30,  strength: 72,  speed: 55, cm: 90,  size: 1.1,  shape: "eel",     color: "#b8c4cc", fin: "#7b8b96" },
  { id: "bluefin", name: "Bluefin",       zone: 2, rarity: "uncommon",  value: 45,  strength: 95,  speed: 85, cm: 110, size: 1.4,  shape: "fish",    color: "#2f6fb5", fin: "#1d4a80" },
  { id: "sword",   name: "Swordfish",     zone: 2, rarity: "rare",      value: 75,  strength: 125, speed: 95, cm: 180, size: 1.5,  shape: "sword",   color: "#4a5d8a", fin: "#2e3c60" },
  { id: "lantern", name: "Lanternfish",   zone: 3, rarity: "common",    value: 55,  strength: 78,  speed: 45, cm: 40,  size: 1.0,  shape: "lantern", color: "#3a3d66", fin: "#25274a" },
  { id: "ghost",   name: "Ghost Fish",    zone: 3, rarity: "uncommon",  value: 95,  strength: 112, speed: 60, cm: 70,  size: 1.2,  shape: "ghost",   color: "#d8eef7", fin: "#a8c8d8", night: true },
  { id: "gulper",  name: "Old Gulper",    zone: 3, rarity: "legendary", value: 300, strength: 165, speed: 30, cm: 240, size: 2.1,  shape: "gulper",  color: "#4a3b5c", fin: "#2c2238", night: true },
];

// half the body length of each shape at size 1 (the mouth is this far in front of the middle)
const HALF_LEN = { fish: 24, puffer: 16, eel: 38, sword: 24, lantern: 22, ghost: 24, gulper: 26 };

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

// ---------- saved progress ----------

function freshSave() {
  return { coins: 0, day: 1, time: 0, gear: { rod: 0, reel: 0, line: 0, bait: 0 }, journal: {}, won: false };
}

let save = freshSave();

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ }
}
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}

const gearValue = (key) => GEAR[key].levels[save.gear[key]][1];
const rodMax = () => gearValue("rod");
const reelSpeed = () => gearValue("reel");
const lineDepth = () => gearValue("line");
const baitLevel = () => gearValue("bait");
const foundCount = () => FISH.filter((sp) => save.journal[sp.id]).length;

// ---------- game state ----------

let playing = false;          // false on the title screen
let paused = false;           // true while a panel (shop, journal, catch) is open
let phase = "ready";          // ready, charging, flying, sinking, bite, fight
let holding = false;
let power = 0;
let powerDir = 1;
let clock = 0;                // seconds since the page opened, for wiggles and waves
let saveTimer = 0;

const lure = { x: ROD_TIP.x, y: ROD_TIP.y + 30, fromX: 0, fromY: 0, toX: 0, t: 0, dur: 1, arc: 0 };
let fishes = [];
let target = null;            // the fish going for the lure, biting it, or on the hook
let biteTimer = 0;
let tension = 0;
let reelTick = 0;

let particles = [];
let ripples = [];
let toasts = [];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const depthToY = (m) => SURFACE + m * PX_PER_M;

// scenery that never changes
const seaweed = Array.from({ length: 18 }, (_, i) => ({ x: 240 + i * 40 + rand(-12, 12), h: rand(30, 75), phase: rand(0, 6) }));
const rocks = Array.from({ length: 9 }, () => ({ x: rand(220, W - 10), r: rand(10, 24) }));
const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 220 + rand(0, 80), y: rand(25, 95), s: rand(0.7, 1.2) }));
const stars = Array.from({ length: 50 }, () => ({ x: rand(0, W), y: rand(0, SURFACE - 40), r: rand(0.6, 1.6) }));

// ---------- time of day ----------

function hour() {
  return (6 + save.time * 24) % 24;
}

// 1 in full daylight, 0 at night, in between at sunrise and sunset
function daylight() {
  const h = hour();
  if (h < 5 || h >= 21) return 0;
  if (h < 7) return (h - 5) / 2;
  if (h < 19) return 1;
  return (21 - h) / 2;
}

const isNight = () => daylight() < 0.25;

// ---------- sound ----------

let audio = null;
let muted = false;

function tone(freq, dur, type = "sine", vol = 0.12, slideTo = null) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* no sound on this browser */ }
}

const sfx = {
  splash: () => { tone(500, 0.25, "triangle", 0.15, 90); tone(900, 0.12, "sine", 0.05, 300); },
  bite: () => { tone(880, 0.08, "square", 0.08); setTimeout(() => tone(1175, 0.1, "square", 0.08), 90); },
  hook: () => tone(300, 0.15, "sawtooth", 0.1, 600),
  tick: () => tone(1400, 0.02, "square", 0.025),
  pull: () => tone(220, 0.3, "sawtooth", 0.05, 140),
  snap: () => tone(900, 0.35, "sawtooth", 0.12, 60),
  lost: () => tone(400, 0.4, "triangle", 0.1, 150),
  catch: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.12), i * 90)),
  buy: () => { tone(660, 0.08, "square", 0.07); setTimeout(() => tone(990, 0.12, "square", 0.07), 80); },
};

// ---------- fish ----------

function pickSpecies(zone) {
  const night = isNight();
  const bait = baitLevel();
  const options = FISH.filter((sp) => sp.zone === zone && (!sp.night || night));
  const weights = options.map((sp) => RARITY_WEIGHT[sp.rarity] * (1 + bait * BAIT_BOOST[sp.rarity]));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return options[i];
  }
  return options[0];
}

function spawnFish(zone) {
  const sp = pickSpecies(zone);
  const sizeF = rand(0.75, 1.35);
  const scale = sp.size * sizeF;
  const pad = 10 * scale;
  const top = depthToY(zone * 10 + 1.5) + pad;
  const bottom = Math.min(depthToY(zone * 10 + 8.5), BOTTOM - 14) - pad;
  const y = rand(top, Math.max(top, bottom));
  fishes.push({
    sp, sizeF, scale,
    x: rand(260, W - 40),
    y,
    baseY: y,
    dir: Math.random() < 0.5 ? -1 : 1,
    alpha: 0,
    life: rand(25, 55),
    scared: 0,
    state: "swim",       // swim, chase, bite, hooked, flee
    chaseTime: 0,
    seed: rand(0, 100),
    pulling: false,
    pullTimer: 0,
    stamina: 0,
    maxStamina: 0,
  });
}

const mouthOffset = (f) => HALF_LEN[f.sp.shape] * f.scale;

function updateFish(f, dt) {
  const sp = f.sp;
  f.alpha = Math.min(1, f.alpha + dt);
  f.scared = Math.max(0, f.scared - dt);

  if (f.state === "swim" || f.state === "flee") {
    const speed = sp.speed * (f.state === "flee" ? 1.8 : 0.45);
    f.x += f.dir * speed * dt;
    f.y += (f.baseY + Math.sin(clock * 1.4 + f.seed) * 6 - f.y) * Math.min(1, dt * 2);
    if (f.x < 250 && f.dir < 0) f.dir = 1;
    if (f.x > W - 30 && f.dir > 0) f.dir = -1;
    if (f.state === "swim" && Math.random() < dt * 0.08) f.dir *= -1;
    if (f.state === "flee" && f.scared <= 0) f.state = "swim";
    f.life -= dt;
    // night fish swim off when the sun comes up
    if (sp.night && !isNight()) f.life = Math.min(f.life, 1);
  } else if (f.state === "chase") {
    const mx = f.x + f.dir * mouthOffset(f);
    const dx = lure.x - mx;
    const dy = lure.y - f.y;
    const d = Math.hypot(dx, dy);
    f.chaseTime += dt;
    if (Math.abs(lure.x - f.x) > 4) f.dir = Math.sign(lure.x - f.x);
    const step = sp.speed * 0.7 * dt;
    if (d < 6) {
      startBite(f);
    } else if (f.chaseTime > 7) {
      scare(f);
    } else {
      f.x += (dx / d) * Math.min(step, d);
      f.y += (dy / d) * Math.min(step, d);
    }
  } else if (f.state === "bite") {
    // nibbling: little jerks at the lure
    f.x = lure.x - f.dir * mouthOffset(f) + Math.sin(clock * 30) * 2;
    f.y = lure.y;
  }

  if (Math.random() < dt * 0.15) bubble(f.x, f.y - 6 * f.scale);
}

function scare(f, time = 3) {
  f.state = "flee";
  f.scared = time;
  f.baseY = f.y;
  f.dir = f.x < 300 ? 1 : f.x < lure.x ? -1 : 1;
  if (target === f) target = null;
}

function startBite(f) {
  phase = "bite";
  biteTimer = BITE_WINDOW;
  f.state = "bite";
  sfx.bite();
  ripples.push({ x: lure.x, y: SURFACE, r: 4, life: 0.8 });
}

// ---------- casting, hooking, catching ----------

function startCharge() {
  phase = "charging";
  power = 0;
  powerDir = 1;
}

function cast() {
  const tip = rodTip();
  phase = "flying";
  lure.fromX = tip.x;
  lure.fromY = tip.y;
  lure.toX = Math.min(W - 30, tip.x + CAST_MIN + power * (CAST_MAX - CAST_MIN));
  lure.t = 0;
  lure.dur = 0.45 + power * 0.45;
  lure.arc = 70 + power * 110;
  tone(300 + power * 300, 0.25, "sine", 0.06, 900);
}

function hook() {
  const f = target;
  phase = "fight";
  f.state = "hooked";
  f.maxStamina = 2 + f.sp.strength / 30;
  f.stamina = f.maxStamina;
  f.pulling = true;
  f.pullTimer = rand(0.6, 1.2);
  tension = 25;
  sfx.hook();
  splash(lure.x, SURFACE, 6);
}

function endLine() {
  phase = "ready";
  target = null;
  tension = 0;
  const tip = rodTip();
  lure.x = tip.x;
  lure.y = tip.y + 30;
}

function loseFish(text) {
  const f = target;
  if (f) scare(f, 4);
  toast(text, "#ff8a7a");
  endLine();
}

function landFish() {
  const f = target;
  fishes = fishes.filter((x) => x !== f);
  const sp = f.sp;
  const cm = Math.round(sp.cm * f.sizeF * 10) / 10;
  const value = Math.max(1, Math.round(sp.value * f.sizeF));
  const entry = save.journal[sp.id];
  const isNew = !entry;
  const record = entry && cm > entry.best;
  save.journal[sp.id] = { count: (entry ? entry.count : 0) + 1, best: entry ? Math.max(entry.best, cm) : cm };
  save.coins += value;
  writeSave();
  splash(LANDING.x, SURFACE, 14);
  sfx.catch();
  endLine();

  $("catch-name").textContent = sp.name;
  $("catch-rarity").textContent = sp.rarity;
  $("catch-rarity").className = "rarity " + sp.rarity;
  $("catch-size").textContent = cm + " cm";
  $("catch-value").textContent = "+" + value + " 🪙";
  $("catch-new").classList.toggle("hidden", !isNew);
  $("catch-note").textContent = isNew
    ? "A new fish for your journal! (" + foundCount() + "/" + FISH.length + ")"
    : record ? "New size record!" : "You've caught " + save.journal[sp.id].count + " of these.";
  drawCard($("catch-art"), sp, false);
  openPanel("catch-screen");
}

// ---------- update ----------

function rodTip() {
  // the rod bends down as the line gets tight
  const bend = phase === "fight" ? tension / rodMax() : phase === "bite" ? 0.2 : 0;
  return { x: ROD_TIP.x - bend * 14, y: ROD_TIP.y + bend * 30 + Math.sin(clock * 1.3) * 1.5 };
}

function update(dt) {
  clock += dt;
  save.time += dt / DAY_LEN;
  if (save.time >= 1) {
    save.time -= 1;
    save.day++;
    toast("Day " + save.day, "#ffcf5a");
  }
  saveTimer += dt;
  if (saveTimer > 10) {
    saveTimer = 0;
    writeSave();
  }

  // keep every zone full of fish
  for (let z = 0; z < ZONES.length; z++) {
    const count = fishes.filter((f) => f.sp.zone === z).length;
    if (count < ZONE_FISH[z] && Math.random() < dt * 0.8) spawnFish(z);
  }
  fishes.forEach((f) => updateFish(f, dt));
  // old fish fade away (but never the one on your line)
  fishes.forEach((f) => { if (f.life < 0 && f !== target) f.alpha -= dt * 2; });
  fishes = fishes.filter((f) => f === target || f.life >= 0 || f.alpha > 0);

  const tip = rodTip();
  if (phase === "ready") {
    lure.x = tip.x + Math.sin(clock * 2) * 3;
    lure.y = tip.y + 30;
  } else if (phase === "charging") {
    power += powerDir * CHARGE_SPEED * dt;
    if (power >= 1) { power = 1; powerDir = -1; }
    if (power <= 0) { power = 0; powerDir = 1; }
    lure.x = tip.x - 10;
    lure.y = tip.y + 26;
  } else if (phase === "flying") {
    lure.t += dt / lure.dur;
    const t = Math.min(1, lure.t);
    lure.x = lure.fromX + (lure.toX - lure.fromX) * t;
    lure.y = lure.fromY + (SURFACE - lure.fromY) * t - Math.sin(t * Math.PI) * lure.arc;
    if (t >= 1) {
      phase = "sinking";
      lure.y = SURFACE;
      splash(lure.x, SURFACE, 10);
      sfx.splash();
    }
  } else if (phase === "sinking") {
    if (holding) {
      if (target) scare(target, 1.5);
      tickReel(dt);
      if (reelTowardBoat(reelSpeed(), dt)) endLine();
    } else {
      const maxY = Math.min(depthToY(lineDepth()) - 2, BOTTOM - 8);
      if (lure.y < maxY) {
        lure.y = Math.min(maxY, lure.y + SINK_SPEED * dt);
        if (Math.random() < dt * 3) bubble(lure.x, lure.y);
      }
      lookForFish(dt);
    }
  } else if (phase === "bite") {
    biteTimer -= dt;
    if (biteTimer <= 0) {
      scare(target, 4);
      phase = "sinking";
      toast("Too slow!", "#ff8a7a");
      sfx.lost();
    }
  } else if (phase === "fight") {
    fight(dt);
  }

  particles.forEach((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "drop") p.vy += 500 * dt;
    else if (p.y < SURFACE + 3) p.life = 0;
  });
  particles = particles.filter((p) => p.life > 0);
  ripples.forEach((r) => { r.life -= dt; r.r += 40 * dt; });
  ripples = ripples.filter((r) => r.life > 0);
  toasts.forEach((t) => { t.life -= dt; });
  toasts = toasts.filter((t) => t.life > 0);
}

// moves the lure toward the boat; true when it gets there
function reelTowardBoat(speed, dt) {
  const dx = LANDING.x - lure.x;
  const dy = LANDING.y - lure.y;
  const d = Math.hypot(dx, dy);
  if (d < CATCH_RANGE) return true;
  const step = Math.min(d, speed * dt);
  lure.x += (dx / d) * step;
  lure.y = Math.max(SURFACE, lure.y + (dy / d) * step);
  return false;
}

function tickReel(dt) {
  reelTick -= dt;
  if (reelTick <= 0) {
    reelTick = 0.09;
    sfx.tick();
  }
}

function lookForFish(dt) {
  if (target || lure.y <= SURFACE + 2) return;
  const reach = 70 + baitLevel() * 28;
  for (const f of fishes) {
    if (f.state !== "swim" || f.scared > 0 || f.alpha < 0.9 || f.life < 0) continue;
    if (Math.hypot(f.x - lure.x, f.y - lure.y) < reach && Math.random() < NOTICE_CHANCE * dt) {
      target = f;
      f.state = "chase";
      f.chaseTime = 0;
      return;
    }
  }
}

function fight(dt) {
  const f = target;
  const sp = f.sp;
  f.pullTimer -= dt;
  if (f.pullTimer <= 0) {
    if (f.stamina > 0) {
      f.pulling = !f.pulling;
      f.pullTimer = f.pulling ? rand(0.8, 1.8) : rand(0.6, 1.3);
      if (f.pulling) {
        sfx.pull();
        splash(lure.x, Math.max(SURFACE, lure.y), 3);
      }
    } else {
      f.pulling = false;
      f.pullTimer = 1;
    }
  }
  if (f.pulling) f.stamina = Math.max(0, f.stamina - dt * (holding ? 1.5 : 1));

  // a tired fish hardly pulls at all
  let force = f.pulling ? sp.strength * (0.55 + 0.45 * f.stamina / f.maxStamina) : sp.strength * 0.18;
  if (f.stamina <= 0) force = sp.strength * 0.12;

  const max = rodMax();
  if (holding) {
    tickReel(dt);
    const speed = reelSpeed() * clamp(1 - force / (max * 1.1), 0.12, 1);
    if (reelTowardBoat(speed, dt)) {
      landFish();
      return;
    }
  } else if (f.pulling) {
    lure.x += force * 0.5 * dt;
    lure.y += force * 0.15 * dt * Math.sin(clock * 2 + f.seed);
  }
  lure.y = clamp(lure.y, SURFACE + 4, BOTTOM - 10);

  const goal = holding ? 22 + force : force * 0.3;
  tension += (goal - tension) * Math.min(1, dt * TENSION_EASE);

  // pulling, it swims away from the boat; resting, it gets dragged in head first
  f.dir = f.pulling ? 1 : -1;
  f.x = lure.x - f.dir * mouthOffset(f) + Math.sin(clock * 18) * (f.pulling ? 3 : 1);
  f.y = lure.y;

  if (tension >= max) {
    sfx.snap();
    loseFish("SNAP! The line broke.");
  } else if (lure.x > W + 10) {
    sfx.lost();
    loseFish("It got away...");
  }
}

// ---------- effects ----------

function splash(x, y, n) {
  for (let i = 0; i < n; i++) {
    particles.push({ kind: "drop", x, y, vx: rand(-90, 90), vy: rand(-220, -80), life: rand(0.4, 0.8), r: rand(1.5, 3) });
  }
  ripples.push({ x, y: SURFACE, r: 4, life: 1 });
}

function bubble(x, y) {
  if (y < SURFACE + 6) return;
  particles.push({ kind: "bubble", x, y, vx: rand(-5, 5), vy: rand(-40, -25), life: 3, r: rand(1.5, 3) });
}

function toast(text, color) {
  toasts.push({ text, color, life: 2 });
}

// ---------- drawing ----------

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const r = Math.round(ch(pa, 16) + (ch(pb, 16) - ch(pa, 16)) * t);
  const g = Math.round(ch(pa, 8) + (ch(pb, 8) - ch(pa, 8)) * t);
  const bl = Math.round(ch(pa, 0) + (ch(pb, 0) - ch(pa, 0)) * t);
  return `rgb(${r},${g},${bl})`;
}

function drawSky(light) {
  const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
  sky.addColorStop(0, mix("#08112a", "#62bfe9", light));
  sky.addColorStop(1, mix("#1d2c55", "#d2f0fb", light));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, SURFACE);

  // orange glow at sunrise and sunset
  const dusk = 1 - Math.abs(light * 2 - 1);
  if (dusk > 0.01) {
    const glow = ctx.createLinearGradient(0, SURFACE - 120, 0, SURFACE);
    glow.addColorStop(0, "rgba(255,140,80,0)");
    glow.addColorStop(1, `rgba(255,140,80,${dusk * 0.55})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, SURFACE - 120, W, 120);
  }

  ctx.fillStyle = "#fff";
  stars.forEach((s) => {
    ctx.globalAlpha = (1 - light) * (0.5 + 0.5 * Math.sin(clock * 2 + s.x));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  const h = hour();
  if (h >= 5 && h <= 21) {
    const p = (h - 5) / 16;
    const x = 60 + p * (W - 120);
    const y = SURFACE - 20 - Math.sin(p * Math.PI) * 140;
    ctx.fillStyle = "rgba(255,220,120,0.25)";
    ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd75e";
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
  }
  if (h >= 19 || h <= 7) {
    const p = ((h - 19 + 24) % 24) / 12;
    const x = 60 + p * (W - 120);
    const y = SURFACE - 20 - Math.sin(p * Math.PI) * 140;
    ctx.fillStyle = "#eef3ff";
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix("#08112a", "#62bfe9", light);
    ctx.beginPath(); ctx.arc(x + 7, y - 4, 13, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = `rgba(255,255,255,${0.35 + light * 0.55})`;
  clouds.forEach((c) => {
    const x = ((c.x + clock * 8 * c.s) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.ellipse(x, c.y, 40 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 25 * c.s, c.y - 8 * c.s, 26 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * c.s, c.y - 4 * c.s, 20 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // far shore with pine trees
  ctx.fillStyle = mix("#0f2a2a", "#4f9a63", light);
  ctx.beginPath();
  ctx.moveTo(0, SURFACE);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, SURFACE - 22 - Math.sin(x * 0.012) * 14 - Math.sin(x * 0.031) * 6);
  ctx.lineTo(W, SURFACE);
  ctx.fill();
  ctx.fillStyle = mix("#0a1f1f", "#2f7448", light);
  for (let x = 330; x < W; x += 57) {
    const base = SURFACE - 18 - Math.sin(x * 0.012) * 12;
    ctx.beginPath();
    ctx.moveTo(x - 10, base); ctx.lineTo(x, base - 30 - (x % 3) * 6); ctx.lineTo(x + 10, base);
    ctx.fill();
  }
}

function drawWater(light) {
  const water = ctx.createLinearGradient(0, SURFACE, 0, H);
  water.addColorStop(0, mix("#123a5a", "#3fc0d6", light));
  water.addColorStop(0.45, mix("#0b2742", "#1d78a0", light));
  water.addColorStop(1, mix("#040d1c", "#0a2c4a", light));
  ctx.fillStyle = water;
  ctx.fillRect(0, SURFACE, W, H - SURFACE);

  // sun rays in the shallows
  if (light > 0.1) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 * light})`;
    for (let i = 0; i < 6; i++) {
      const x = 260 + i * 120 + Math.sin(clock * 0.3 + i) * 30;
      ctx.beginPath();
      ctx.moveTo(x, SURFACE); ctx.lineTo(x + 40, SURFACE); ctx.lineTo(x + 110, SURFACE + 220); ctx.lineTo(x + 50, SURFACE + 220);
      ctx.fill();
    }
  }

  // zone names and depth marks
  ctx.font = "700 11px Inter, sans-serif";
  ctx.textAlign = "left";
  for (let z = 0; z < ZONES.length; z++) {
    const y = depthToY(z * 10);
    if (z > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(ZONES[z].toUpperCase() + "  " + z * 10 + "–" + (z + 1) * 10 + " m", 10, y + (z === 0 ? 46 : 16));
  }

  // how deep the line reaches
  if (lineDepth() < DEPTH_M) {
    const y = depthToY(lineDepth());
    ctx.strokeStyle = "rgba(255,207,90,0.35)";
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(220, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,207,90,0.6)";
    ctx.fillText("your line ends here · buy a longer line to go deeper", 230, y - 5);
  }

  // lake floor
  ctx.fillStyle = mix("#1a1a24", "#c9b27a", light * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, BOTTOM + Math.sin(x * 0.05) * 4);
  ctx.lineTo(W, H);
  ctx.fill();
  ctx.fillStyle = mix("#15151c", "#7d7a73", light * 0.8);
  rocks.forEach((r) => {
    ctx.beginPath(); ctx.ellipse(r.x, BOTTOM + 4, r.r, r.r * 0.6, 0, Math.PI, 0); ctx.fill();
  });
  ctx.strokeStyle = mix("#0f3020", "#3e9a5a", light * 0.9);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  seaweed.forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s.x, BOTTOM + 2);
    for (let i = 1; i <= 4; i++) {
      ctx.lineTo(s.x + Math.sin(clock * 1.2 + s.phase + i) * i * 3, BOTTOM + 2 - (s.h / 4) * i);
    }
    ctx.stroke();
  });
  ctx.lineWidth = 1;
}

// draws one fish facing right (dir 1) or left (dir -1) with its middle at x, y
function drawFish(c, sp, x, y, dir, scale, opts = {}) {
  const sil = opts.silhouette;
  const col = (v) => (sil ? "#2a4459" : v);
  const L = HALF_LEN[sp.shape] * scale;
  const t = opts.time || 0;
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  c.globalAlpha = (opts.alpha ?? 1) * (sp.shape === "ghost" && !sil ? 0.7 : 1);

  if (sp.shape === "eel") {
    const hh = 5 * scale;
    c.fillStyle = col(sp.color);
    c.beginPath();
    c.moveTo(L, 0);
    for (let i = 0; i <= 10; i++) {
      const px = L - (i / 10) * L * 2;
      c.lineTo(px, -hh * (1 - i / 14) + Math.sin(t * 6 + i * 0.8) * 3 * scale);
    }
    for (let i = 10; i >= 0; i--) {
      const px = L - (i / 10) * L * 2;
      c.lineTo(px, hh * (1 - i / 14) + Math.sin(t * 6 + i * 0.8) * 3 * scale);
    }
    c.fill();
    c.strokeStyle = col(sp.fin);
    c.lineWidth = 2 * scale;
    c.beginPath(); c.moveTo(L * 0.4, -hh); c.lineTo(-L, -hh * 0.5 + Math.sin(t * 6 + 8) * 3 * scale); c.stroke();
    if (!sil) {
      c.fillStyle = "#101820";
      c.beginPath(); c.arc(L * 0.8, -hh * 0.2 + Math.sin(t * 6) * 3 * scale, 1.5 * scale, 0, Math.PI * 2); c.fill();
    }
  } else {
    const hh = (sp.shape === "puffer" ? 14 : sp.shape === "gulper" ? 17 : 10) * scale;
    const wag = Math.sin(t * 8) * 0.25;

    // tail
    c.fillStyle = col(sp.fin);
    c.save();
    c.translate(-L + 2 * scale, 0);
    c.rotate(wag);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-13 * scale, -9 * scale);
    c.lineTo(-10 * scale, 0);
    c.lineTo(-13 * scale, 9 * scale);
    c.fill();
    c.restore();

    // fin on top
    c.beginPath();
    c.moveTo(-L * 0.4, -hh * 0.8);
    c.lineTo(L * 0.05, -hh * 1.45);
    c.lineTo(L * 0.35, -hh * 0.8);
    c.fill();

    // puffer spikes
    if (sp.shape === "puffer") {
      c.strokeStyle = col(sp.fin);
      c.lineWidth = 1.5 * scale;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
        c.beginPath();
        c.moveTo(Math.cos(a) * L * 0.9, Math.sin(a) * hh * 0.9);
        c.lineTo(Math.cos(a) * (L + 4 * scale), Math.sin(a) * (hh + 4 * scale));
        c.stroke();
      }
    }

    // body
    c.fillStyle = col(sp.color);
    c.beginPath();
    c.ellipse(0, 0, L, hh, 0, 0, Math.PI * 2);
    c.fill();

    if (!sil) {
      // lighter belly
      c.save();
      c.beginPath();
      c.ellipse(0, 0, L, hh, 0, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = "rgba(255,255,255,0.22)";
      c.fillRect(-L, hh * 0.25, L * 2, hh);
      if (sp.stripes) {
        c.fillStyle = "rgba(20,30,40,0.35)";
        for (let i = -1; i <= 1; i++) c.fillRect(i * L * 0.4 - 2 * scale, -hh, 4 * scale, hh * 2);
      }
      if (sp.spots) {
        c.fillStyle = "rgba(120,80,20,0.45)";
        [[-0.4, -0.3], [0, -0.5], [0.2, 0.1], [-0.2, 0.3], [0.45, -0.2]].forEach(([a, b]) => {
          c.beginPath(); c.arc(a * L, b * hh, 2 * scale, 0, Math.PI * 2); c.fill();
        });
      }
      if (sp.shape === "ghost") {
        c.strokeStyle = "rgba(120,160,190,0.6)";
        c.lineWidth = 1.2 * scale;
        c.beginPath(); c.moveTo(-L * 0.7, 0); c.lineTo(L * 0.5, 0); c.stroke();
        for (let i = -3; i <= 2; i++) {
          c.beginPath(); c.moveTo(i * L * 0.18, -hh * 0.6); c.lineTo(i * L * 0.18, hh * 0.6); c.stroke();
        }
      }
      c.restore();
    }

    // swordfish bill
    if (sp.shape === "sword") {
      c.strokeStyle = col(sp.fin);
      c.lineWidth = 2.5 * scale;
      c.beginPath(); c.moveTo(L * 0.8, -hh * 0.1); c.lineTo(L + 24 * scale, -hh * 0.15); c.stroke();
    }

    // gulper's huge mouth with teeth
    if (sp.shape === "gulper") {
      c.fillStyle = sil ? "#1d3446" : "#120c18";
      c.beginPath();
      c.moveTo(L + 2 * scale, -hh * 0.5);
      c.lineTo(L * 0.15, hh * 0.05);
      c.lineTo(L + 2 * scale, hh * 0.55);
      c.fill();
      if (!sil) {
        c.fillStyle = "#f2efe6";
        for (let i = 0; i < 4; i++) {
          const px = L * 0.35 + i * L * 0.17;
          c.beginPath(); c.moveTo(px, -hh * 0.2 - i * hh * 0.07); c.lineTo(px + 2 * scale, -hh * 0.05); c.lineTo(px + 4 * scale, -hh * 0.22 - i * hh * 0.07); c.fill();
        }
      }
    }

    // lanternfish light on a stalk
    if (sp.shape === "lantern") {
      c.strokeStyle = col(sp.fin);
      c.lineWidth = 1.5 * scale;
      c.beginPath();
      c.moveTo(L * 0.3, -hh * 0.9);
      c.quadraticCurveTo(L * 0.7, -hh * 2.6, L + 8 * scale, -hh * 1.4);
      c.stroke();
      c.fillStyle = sil ? "#2a4459" : "#fff3a0";
      c.beginPath(); c.arc(L + 8 * scale, -hh * 1.4, 3 * scale, 0, Math.PI * 2); c.fill();
    }

    // eye
    if (!sil) {
      const ex = L * (sp.shape === "gulper" ? 0.15 : 0.55);
      const ey = -hh * (sp.shape === "gulper" ? 0.55 : 0.25);
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(ex, ey, 2.8 * scale, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#101820";
      c.beginPath(); c.arc(ex + 0.6 * scale, ey, 1.5 * scale, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

function drawBoat() {
  const bob = Math.sin(clock * 1.6) * 2;
  const y = SURFACE + bob;
  ctx.save();
  // angler
  ctx.fillStyle = "#ff7a4a";
  ctx.fillRect(BOAT_X - 4, y - 52, 22, 30);
  ctx.fillStyle = "#ffd9b0";
  ctx.beginPath(); ctx.arc(BOAT_X + 7, y - 62, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffcf5a";
  ctx.beginPath(); ctx.ellipse(BOAT_X + 7, y - 70, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(BOAT_X - 3, y - 80, 20, 10);
  ctx.fillStyle = "#101820";
  ctx.beginPath(); ctx.arc(BOAT_X + 12, y - 63, 1.6, 0, Math.PI * 2); ctx.fill();

  // rod
  const tip = rodTip();
  const hand = { x: BOAT_X + 18, y: y - 40 };
  ctx.strokeStyle = "#6b4a2f";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hand.x - 8, hand.y + 8);
  ctx.quadraticCurveTo((hand.x + tip.x) / 2 + 10, (hand.y + tip.y) / 2 - 20, tip.x, tip.y);
  ctx.stroke();
  ctx.strokeStyle = "#ffd9b0";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(BOAT_X + 10, y - 44); ctx.lineTo(hand.x, hand.y); ctx.stroke();

  // hull
  ctx.fillStyle = "#a0603a";
  ctx.beginPath();
  ctx.moveTo(BOAT_X - 75, y - 22);
  ctx.lineTo(BOAT_X + 75, y - 22);
  ctx.lineTo(BOAT_X + 55, y + 10);
  ctx.lineTo(BOAT_X - 55, y + 10);
  ctx.fill();
  ctx.fillStyle = "#7a4426";
  ctx.fillRect(BOAT_X - 75, y - 24, 150, 6);
  ctx.fillStyle = "#ffcf5a";
  ctx.fillRect(BOAT_X - 60, y - 10, 120, 4);
  ctx.restore();
  ctx.lineWidth = 1;
}

function drawLine() {
  const tip = rodTip();
  const max = rodMax();
  const tight = phase === "fight" ? tension / max : 0;
  const sag = phase === "fight" ? (1 - tight) * 40 : phase === "sinking" || phase === "bite" ? 30 : 6;
  ctx.strokeStyle = tight > WARN_AT ? `rgba(255,90,80,${0.7 + Math.sin(clock * 30) * 0.3})` : "rgba(255,255,255,0.75)";
  ctx.lineWidth = tight > WARN_AT ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo((tip.x + lure.x) / 2, Math.max(tip.y, lure.y) - Math.abs(lure.y - tip.y) * 0.1 + sag, lure.x, lure.y);
  ctx.stroke();
  ctx.lineWidth = 1;

  // the lure itself
  const bait = baitLevel();
  ctx.fillStyle = ["#d97a7a", "#ff9d7a", "#7affd4", "#ffd75e"][bait];
  ctx.beginPath(); ctx.arc(lure.x, lure.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ccd6dd";
  ctx.beginPath(); ctx.arc(lure.x + 2, lure.y + 5, 3, 0, Math.PI); ctx.stroke();
}

// lights that shine through the dark at night
function drawGlows(light) {
  const dark = 1 - light;
  if (dark < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  fishes.forEach((f) => {
    const L = HALF_LEN[f.sp.shape] * f.scale;
    ctx.globalAlpha = dark * Math.max(0, f.alpha);
    if (f.sp.shape === "lantern") glow(f.x + f.dir * (L + 8 * f.scale), f.y - 14 * f.scale, 40 * f.scale, "rgba(255,240,140,0.7)");
    if (f.sp.shape === "ghost") glow(f.x, f.y, 34 * f.scale, "rgba(170,230,255,0.35)");
  });
  if (baitLevel() >= 2 && lure.y > SURFACE) {
    ctx.globalAlpha = dark;
    glow(lure.x, lure.y, 30, baitLevel() === 3 ? "rgba(255,215,94,0.6)" : "rgba(122,255,212,0.5)");
  }
  ctx.restore();
}

function drawMeters() {
  if (phase === "charging") {
    const x = BOAT_X;
    const y = SURFACE - 120;
    ctx.fillStyle = "rgba(10,20,30,0.6)";
    ctx.fillRect(x - 60, y - 10, 120, 18);
    const g = ctx.createLinearGradient(x - 56, 0, x + 56, 0);
    g.addColorStop(0, "#6fd38a"); g.addColorStop(0.6, "#ffcf5a"); g.addColorStop(1, "#ff6a5a");
    ctx.fillStyle = g;
    ctx.fillRect(x - 56, y - 6, 112 * power, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "800 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POWER", x, y - 14);
  }

  if (phase === "fight" && target) {
    const x = W - 46;
    const top = 26;
    const h = 140;
    const max = rodMax();
    ctx.fillStyle = "rgba(10,20,30,0.65)";
    ctx.fillRect(x - 6, top - 6, 30, h + 12);
    ctx.fillStyle = "rgba(255,90,80,0.35)";
    ctx.fillRect(x, top, 18, h * (1 - WARN_AT));
    const frac = clamp(tension / max, 0, 1);
    ctx.fillStyle = frac > WARN_AT ? "#ff6a5a" : frac > 0.5 ? "#ffcf5a" : "#6fd38a";
    ctx.fillRect(x, top + h * (1 - frac), 18, h * frac);
    ctx.fillStyle = "#fff";
    ctx.font = "800 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LINE", x + 9, top + h + 20);

    // how much fight the fish has left
    const fx = x - 40;
    ctx.fillStyle = "rgba(10,20,30,0.65)";
    ctx.fillRect(fx - 6, top - 6, 30, h + 12);
    const st = target.stamina / target.maxStamina;
    ctx.fillStyle = "#4fd1d9";
    ctx.fillRect(fx, top + h * (1 - st), 18, h * st);
    ctx.fillStyle = "#fff";
    ctx.fillText("FISH", fx + 9, top + h + 20);
  }

  if (phase === "bite") {
    const s = 1 + Math.sin(clock * 20) * 0.15;
    ctx.save();
    ctx.translate(lure.x, lure.y - 30);
    ctx.scale(s, s);
    ctx.fillStyle = "#ffcf5a";
    ctx.font = "34px 'Russo One', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 0, 0);
    ctx.restore();
  }
}

function hintText() {
  if (phase === "ready") return "Hold to charge your cast";
  if (phase === "charging") return "Let go to cast!";
  if (phase === "flying") return "";
  if (phase === "sinking") return holding ? "Reeling in..." : "Wait for a bite · hold to reel the lure up";
  if (phase === "bite") return "BITE! Click now!";
  if (phase === "fight") {
    if (tension / rodMax() > WARN_AT) return "Let go! The line is about to snap!";
    return target && target.pulling ? "It's pulling! Careful..." : "Hold to reel it in!";
  }
  return "";
}

function drawText() {
  const hint = playing ? hintText() : "";
  if (hint) {
    ctx.font = "700 15px Inter, sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(hint).width + 28;
    ctx.fillStyle = "rgba(5,16,24,0.6)";
    ctx.fillRect(W / 2 - w / 2, H - 44, w, 30);
    ctx.fillStyle = phase === "bite" || (phase === "fight" && tension / rodMax() > WARN_AT) ? "#ffcf5a" : "#eef7fb";
    ctx.fillText(hint, W / 2, H - 24);
  }
  toasts.forEach((t, i) => {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.font = "26px 'Russo One', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(5,16,24,0.7)";
    const y = 140 - i * 34 - (2 - t.life) * 10;
    ctx.strokeText(t.text, W / 2, y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, W / 2, y);
  });
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

function draw() {
  const light = daylight();
  drawSky(light);
  drawWater(light);

  fishes.forEach((f) => {
    if (f !== target) drawFish(ctx, f.sp, f.x, f.y, f.dir, f.scale, { alpha: Math.max(0, f.alpha), time: clock + f.seed });
  });
  if (target) drawFish(ctx, target.sp, target.x, target.y, target.dir, target.scale, { time: clock * (phase === "fight" ? 2 : 1) });

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  particles.forEach((p) => {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    if (p.kind === "drop") ctx.fill();
    else ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ripples.forEach((r) => {
    ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.6})`;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
  });

  drawLine();

  // the night makes everything darker
  const dark = 1 - light;
  if (dark > 0) {
    ctx.fillStyle = `rgba(4,10,30,${dark * 0.45})`;
    ctx.fillRect(0, SURFACE, W, H - SURFACE);
  }
  drawGlows(light);

  // surface shine
  ctx.strokeStyle = `rgba(255,255,255,${0.25 + light * 0.35})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, SURFACE + Math.sin(x * 0.05 + clock * 2) * 1.5);
  ctx.stroke();
  ctx.lineWidth = 1;

  drawBoat();
  drawMeters();
  drawText();
}

// a fish on a small card, for the catch screen and the journal
function drawCard(cv, sp, silhouette) {
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, "#1f7fa6");
  g.addColorStop(1, "#0b2c48");
  c.fillStyle = g;
  c.fillRect(0, 0, cv.width, cv.height);
  const nose = sp.shape === "sword" ? 24 : sp.shape === "lantern" ? 11 : 0;
  const tail = sp.shape === "eel" ? 0 : 13;
  const half = (HALF_LEN[sp.shape] * 2 + nose + tail) / 2;
  const scale = Math.min(2.4, (cv.width * 0.4) / half, (cv.height * 0.3) / (sp.shape === "gulper" ? 17 : 14));
  // shift so the whole fish, tail to nose, is centred
  const shift = ((tail - nose) / 2) * scale;
  drawFish(c, sp, cv.width / 2 + shift, cv.height / 2 + 4, 1, scale, { silhouette, time: 0.3 });
}

// ---------- HUD and panels ----------

function updateHud() {
  $("coins").textContent = save.coins;
  const h = hour();
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 6) * 10;
  $("clock").textContent = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  $("sky-icon").textContent = (isNight() ? "🌙" : "☀️") + " Day " + save.day;
  const inWater = (phase === "sinking" || phase === "bite" || phase === "fight") && lure.y > SURFACE;
  $("depth").textContent = inWater ? ((lure.y - SURFACE) / PX_PER_M).toFixed(1) + " m" : "-";
  $("found").textContent = foundCount() + "/" + FISH.length;
}

const PANELS = ["catch-screen", "shop-screen", "journal-screen", "win-screen"];

function openPanel(id) {
  PANELS.forEach((p) => $(p).classList.toggle("hidden", p !== id));
  paused = true;
  holding = false;
  if (phase === "charging") phase = "ready";
}

function closePanels() {
  const wasCatch = !$("catch-screen").classList.contains("hidden");
  PANELS.forEach((p) => $(p).classList.add("hidden"));
  paused = false;
  if (wasCatch && foundCount() === FISH.length && !save.won) {
    save.won = true;
    writeSave();
    sfx.catch();
    openPanel("win-screen");
  }
}

function renderShop() {
  $("shop-coins").textContent = save.coins;
  const list = $("shop-list");
  list.innerHTML = "";
  Object.entries(GEAR).forEach(([key, gear]) => {
    const lvl = save.gear[key];
    const next = gear.levels[lvl + 1];
    const row = document.createElement("div");
    row.className = "shop-item";
    const pips = gear.levels.map((_, i) => `<span class="pip${i <= lvl ? " on" : ""}"></span>`).join("");
    row.innerHTML = `
      <div class="shop-icon">${gear.icon}</div>
      <div class="shop-info">
        <b>${gear.levels[lvl][0]}</b>
        <small>${gear.desc}${next ? " Next: " + next[0] + "." : ""}</small>
        <div class="pips">${pips}</div>
      </div>`;
    const btn = document.createElement("button");
    btn.className = "big";
    if (next) {
      btn.textContent = "Buy · " + next[2] + " 🪙";
      btn.disabled = save.coins < next[2];
      btn.addEventListener("click", () => {
        if (save.coins < next[2]) return;
        save.coins -= next[2];
        save.gear[key]++;
        writeSave();
        sfx.buy();
        renderShop();
      });
    } else {
      btn.textContent = "Max";
      btn.disabled = true;
    }
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function renderJournal() {
  const grid = $("journal-grid");
  grid.innerHTML = "";
  $("journal-summary").textContent = "You have found " + foundCount() + " of " + FISH.length + " fish.";
  FISH.forEach((sp) => {
    const entry = save.journal[sp.id];
    const div = document.createElement("div");
    div.className = "entry" + (entry ? "" : " locked");
    const cv = document.createElement("canvas");
    cv.width = 150;
    cv.height = 80;
    drawCard(cv, sp, !entry);
    div.appendChild(cv);
    const where = ZONES[sp.zone] + (sp.night ? " · night only" : "");
    const info = document.createElement("div");
    info.innerHTML = entry
      ? `<b>${sp.name}</b>${sp.rarity} · ${where}<br>Caught ${entry.count} · best ${entry.best} cm`
      : `<b>???</b>${sp.rarity} · ${where}<br>Not caught yet`;
    div.appendChild(info);
    grid.appendChild(div);
  });
}

// ---------- input ----------

function press() {
  if (!playing || paused || holding) return;
  holding = true;
  if (phase === "ready") startCharge();
  else if (phase === "bite") hook();
}

function release() {
  if (!holding) return;
  holding = false;
  if (phase === "charging") cast();
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  press();
});
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("blur", release);

function openShop() {
  if (!playing) return;
  renderShop();
  openPanel("shop-screen");
}

function openJournal() {
  if (!playing) return;
  renderJournal();
  openPanel("journal-screen");
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) press();
    return;
  }
  const key = e.key.toLowerCase();
  if (key === "escape") closePanels();
  else if (key === "s") openShop();
  else if (key === "j") openJournal();
  else if (key === "m") toggleMute();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") release();
});

function toggleMute() {
  muted = !muted;
  $("mute").textContent = muted ? "🔇" : "🔊";
}

$("mute").addEventListener("click", toggleMute);
$("open-shop").addEventListener("click", openShop);
$("open-journal").addEventListener("click", openJournal);
$("catch-ok").addEventListener("click", closePanels);
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closePanels));

function startGame(loaded) {
  save = loaded || freshSave();
  // fill in anything an older save is missing
  save.gear = Object.assign({ rod: 0, reel: 0, line: 0, bait: 0 }, save.gear);
  save.journal = save.journal || {};
  fishes = [];
  endLine();
  fillLake();
  playing = true;
  paused = false;
  $("title-screen").classList.add("hidden");
  writeSave();
}

function fillLake() {
  for (let z = 0; z < ZONES.length; z++) {
    for (let i = 0; i < ZONE_FISH[z]; i++) spawnFish(z);
  }
  fishes.forEach((f) => { f.alpha = 1; });
}

$("new-game").addEventListener("click", () => {
  const old = readSave();
  if (old && Object.keys(old.journal || {}).length > 0 && !confirm("Start over? Your old journal and coins will be lost.")) return;
  startGame(null);
});
$("continue").addEventListener("click", () => startGame(readSave()));
$("continue").disabled = !readSave();

// ---------- main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing && !paused) update(dt);
  else clock += dt;
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

// some fish to look at behind the title screen
fillLake();
requestAnimationFrame(frame);
