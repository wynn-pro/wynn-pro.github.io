// Frostfall: keep a tiny town alive through 30 days of deadly cold.
// Everything runs in the browser: no server, no downloads, so it works on GitHub Pages.
"use strict";

const W = 960;
const H = 560;
const CX = 480;               // the beacon stands in the middle of town
const CY = 290;
const SQUASH = 0.6;           // the ground is drawn tilted, so circles look like flat ellipses

const DAY_LEN = 60;           // one day lasts 60 seconds at 1× speed
const WIN_DAY = 30;           // survive 30 days and the thaw comes
const WORK_START = 7;         // people work from 7:00...
const WORK_END = 19;          // ...until 19:00, then walk home
const RAID_HOUR = 21;         // on raid nights the wolves come at 21:00

const COMFY = -5;             // colder than -5° and people start to freeze
const FREEZE_RATE = 0.08;     // health lost per second for each degree below COMFY
const WARM_HEAL = 1.5;        // health gained per second when warm and fed
const HUNGER_HURT = 0.6;      // health lost per second when there is no food
const BED_HEAL = 5;           // health gained per second in an infirmary bed
const SICK_BELOW = 40;        // with less health than this a person is sick and can't work...
const WELL_ABOVE = 80;        // ...until their health is back above this

const COLD_PER_DAY = 1;       // every day is 1° colder than the day before
const NIGHT_DROP = 8;         // the coldest hour (4:00) is 8° colder than the afternoon
const BLIZZARD_COLD = 15;     // a blizzard day is 15° colder
const WHITEOUT_DAY = 28;      // the last 3 days are the Whiteout...
const WHITEOUT_COLD = 10;     // ...10° colder still

const BEACON_HEAT_PER_LEVEL = 6;    // each beacon level adds 6° of heat...
const BEACON_COAL_PER_LEVEL = 0.25; // ...and burns 25% more coal
const STRAIN_UP = 1;          // Overdrive adds 1 strain per second...
const STRAIN_DOWN = 1.5;      // ...any other setting cools it by 1.5 per second
const BROKEN_TIME = 20;       // at 100 strain the beacon cracks and goes cold for 20 seconds

const MAX_LEVEL = 3;          // buildings go up to level 3
const WALK_SPEED = 60;        // pixels per second
const TORCH_COOLDOWN = 0.25;  // seconds between torch swings when you click a wolf
const WOLF_BITE_EVERY = 1.2;  // seconds between wolf bites
const WOLF_STEALS = 2;        // food stolen by every bite
const WOLF_HURTS = 6;         // health lost by everyone at the building that gets bitten
const WOLF_MEAT = 3;          // food you get for every wolf you beat

const SAVE_KEY = "frostfall-save";
const BEST_KEY = "frostfall-best";

const LEVELS = {
  easy:   { name: "Easy",   base: -2,  start: { wood: 90, coal: 50, food: 35, steel: 10 }, desc: "Milder cold and more supplies. Good for your first winter." },
  medium: { name: "Medium", base: -9,  start: { wood: 60, coal: 30, food: 20, steel: 0 }, desc: "A real winter. Plan ahead or freeze." },
  hard:   { name: "Hard",   base: -14, start: { wood: 45, coal: 20, food: 14, steel: 0 }, desc: "Bitter cold from day one. Only for true survivors." },
};

// heat the beacon gives, and coal it burns every day, at level 1
const POWER = {
  off:  { name: "Off",       heat: 0,  coal: 0 },
  low:  { name: "Low",       heat: 14, coal: 6 },
  high: { name: "High",      heat: 24, coal: 12 },
  over: { name: "Overdrive", heat: 36, coal: 22 },
};
const POWER_ORDER = ["off", "low", "high", "over"];

// beacon upgrade costs, by the level it is now
const BEACON_COSTS = [null, { wood: 60, steel: 10 }, { wood: 120, steel: 25 }, { wood: 200, steel: 45 }, { wood: 300, steel: 70 }];

const ICONS = { wood: "🪵", coal: "🪨", food: "🍖", steel: "🔩" };

// every kind of building. Lists like [4, 6, 8] give the number for level 1, 2 and 3.
const BUILDINGS = {
  shelter: {
    name: "Shelter", icon: "🛖", cost: { wood: 30 }, wall: "#8a5a3c", roof: "#5b3a28",
    desc: "Beds for survivors. Warmer inside than out.", beds: [4, 6, 8], insulation: [5, 9, 13],
  },
  sawmill: {
    name: "Sawmill", icon: "🪓", cost: { wood: 20 }, wall: "#a8794f", roof: "#6d4b2f",
    desc: "Workers chop trees into wood.", workers: [3, 5, 7], makes: "wood", perDay: 10,
  },
  coalpit: {
    name: "Coal Pit", icon: "⛏️", cost: { wood: 30 }, wall: "#6b6f78", roof: "#3d4048",
    desc: "Workers dig coal to feed the beacon.", workers: [3, 5, 7], makes: "coal", perDay: 5,
  },
  lodge: {
    name: "Hunters' Lodge", icon: "🏹", cost: { wood: 25 }, wall: "#9b6b43", roof: "#4f6b3a",
    desc: "Hunters bring back food. Everyone eats 1 a day.", workers: [3, 5, 7], makes: "food", perDay: 6,
  },
  steelworks: {
    name: "Steelworks", icon: "🔩", cost: { wood: 40, coal: 10 }, wall: "#7d8796", roof: "#9a3b2e",
    desc: "Burns wood to make steel for upgrades.", workers: [2, 4, 6], makes: "steel", perDay: 4,
    uses: { wood: 2 },   // for every steel made
  },
  infirmary: {
    name: "Infirmary", icon: "⛑️", cost: { wood: 40, steel: 5 }, wall: "#e9e2d6", roof: "#b33a3a",
    desc: "Sick people rest here and get better fast.", beds: [3, 5, 7], insulation: [8, 10, 12],
  },
  tower: {
    name: "Watchtower", icon: "🗼", cost: { wood: 30, steel: 5 }, wall: "#7a5236", roof: "#4a2f1e",
    desc: "A guard keeps watch at night and shoots arrows at wolves.", workers: [1, 1, 1], range: [200, 230, 260],
    reload: [1.2, 0.8, 0.5],
  },
};
const BUILD_ORDER = ["shelter", "sawmill", "coalpit", "lodge", "steelworks", "infirmary", "tower"];

const NAMES = ["Ada", "Bram", "Cleo", "Dax", "Esme", "Finn", "Gus", "Hana", "Ivo", "June", "Kit", "Lars", "Mila",
  "Nico", "Opal", "Pip", "Quinn", "Rosa", "Sven", "Tova", "Ugo", "Vera", "Wren", "Yuri", "Zara", "Arlo", "Bea",
  "Cass", "Dino", "Elsa", "Fern", "Hugo", "Iris", "Jonas", "Kaia", "Leo", "Maya", "Nell", "Otto", "Rhea"];
const COATS = ["#c0392b", "#2e86c1", "#27ae60", "#d68910", "#8e44ad", "#16a085", "#cb4335", "#34495e"];

// building plots: an inner ring of 8 close to the beacon and an outer ring of 12
const PLOTS = [];
for (let i = 0; i < 8; i++) {
  const a = (i + 0.5) / 8 * Math.PI * 2;
  PLOTS.push({ x: CX + Math.cos(a) * 140, y: CY + Math.sin(a) * 140 * SQUASH });
}
for (let i = 0; i < 12; i++) {
  const a = (i + 0.5) / 12 * Math.PI * 2;
  PLOTS.push({ x: CX + Math.cos(a) * 265, y: CY + Math.sin(a) * 265 * SQUASH });
}

// pine trees around the edge of town (always in the same places)
const TREES = [];
{
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 400 && TREES.length < 46; n++) {
    const x = 10 + rand() * (W - 20), y = 30 + rand() * (H - 40);
    if (groundDist(x, y) < 335) continue;
    if (TREES.some((t) => Math.hypot(t.x - x, t.y - y) < 34)) continue;
    TREES.push({ x, y, s: 0.8 + rand() * 0.5 });
  }
  TREES.sort((a, b) => a.y - b.y);
}

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);
const panel = $("panel");

let state = null;     // the whole game, kept as plain data so it can be saved
let paused = false;
let speed = 1;
let muted = false;
let wolves = [];      // these are not saved: the game only saves at dawn, when there are none
let arrows = [];
let floaters = [];
let snow = [];
let selected = null;  // null, "beacon" or a plot number
let hovered = null;
let confirmDemolish = false;
let torchTimer = 0;
let animTime = 0;
let lastPanel = "";

// ---------- sound ----------

let audio = null;
function tone(freq, dur, type = "sine", vol = 0.08, slideTo = null) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (e) { /* no sound on this browser */ }
}
const sfx = {
  build: () => { tone(330, 0.12, "triangle"); setTimeout(() => tone(495, 0.15, "triangle"), 90); },
  click: () => tone(600, 0.05, "square", 0.03),
  dawn: () => { tone(523, 0.3); setTimeout(() => tone(659, 0.3), 150); setTimeout(() => tone(784, 0.5), 300); },
  howl: () => { tone(320, 0.6, "sine", 0.07, 620); setTimeout(() => tone(620, 0.9, "sine", 0.06, 380), 550); },
  hit: () => tone(180, 0.1, "sawtooth", 0.05, 90),
  death: () => tone(220, 0.8, "sine", 0.08, 110),
  crack: () => tone(90, 0.6, "sawtooth", 0.1, 40),
};

// ---------- helpers ----------

function groundDist(x, y) {
  // distance on the ground, undoing the tilt so the heat reaches as far up and down as sideways
  return Math.hypot(x - CX, (y - CY) / SQUASH);
}
function hourNow() { return (6 + state.time / DAY_LEN * 24) % 24; }
function isWorkHours(h) { return h >= WORK_START && h < WORK_END; }
function clockText(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}
function costText(cost) {
  return Object.keys(cost).map((r) => `${Math.ceil(cost[r])} ${ICONS[r]}`).join(" · ");
}
function canAfford(cost) { return Object.keys(cost).every((r) => state.res[r] >= cost[r]); }
function pay(cost) { for (const r in cost) state.res[r] -= cost[r]; }
function tempClass(t) { return t >= COMFY ? "warm" : t >= -20 ? "chilly" : "freezing"; }
function fmt(n) { return Math.floor(n).toLocaleString(); }

function beaconHeat() {
  const b = state.beacon;
  if (b.power === "off" || b.broken > 0 || state.res.coal <= 0) return 0;
  return POWER[b.power].heat + BEACON_HEAT_PER_LEVEL * (b.level - 1);
}
function beaconCoalPerDay() {
  const b = state.beacon;
  if (b.broken > 0) return 0;
  return POWER[b.power].coal * (1 + BEACON_COAL_PER_LEVEL * (b.level - 1));
}
function heatRadius() { return 120 + 35 * state.beacon.level; }
function heatAt(x, y) {
  // full heat inside the radius, then fading out until twice as far
  const h = beaconHeat();
  if (!h) return 0;
  const r = heatRadius(), d = groundDist(x, y);
  if (d <= r) return h;
  const fade = 1 - (d - r) / r;
  return fade > 0 ? h * fade : 0;
}
function outsideTemp(hour = hourNow()) {
  let t = LEVELS[state.diff].base - COLD_PER_DAY * (state.day - 1);
  t -= NIGHT_DROP * (1 + Math.cos((hour - 4) / 24 * Math.PI * 2)) / 2;
  if (state.blizzard) t -= BLIZZARD_COLD;
  if (state.day >= WHITEOUT_DAY) t -= WHITEOUT_COLD;
  return t;
}
function plotTemp(i) {
  const p = PLOTS[i], b = state.plots[i];
  const ins = b && BUILDINGS[b.type].insulation ? BUILDINGS[b.type].insulation[b.level - 1] : 0;
  return outsideTemp() + heatAt(p.x, p.y) + ins;
}
// people with no bed sleep in the open, next to the beacon
function campTemp() { return outsideTemp() + beaconHeat() - 4; }

function workersAt(i) { return state.people.filter((p) => p.job === i); }
function slots(b) { return BUILDINGS[b.type].workers ? BUILDINGS[b.type].workers[b.level - 1] : 0; }
function beds(b) { return BUILDINGS[b.type].beds ? BUILDINGS[b.type].beds[b.level - 1] : 0; }
function totalBeds(type) {
  return state.plots.reduce((n, b) => n + (b && b.type === type ? beds(b) : 0), 0);
}
function idlePeople() { return state.people.filter((p) => p.job == null && !p.sick); }
function coldFactor(t) { return t < -20 ? 0.6 : t < COMFY ? 0.85 : 1; }
function outputMult(b) { return 1 + 0.2 * (b.level - 1); }

function upgradeCost(b) {
  const base = BUILDINGS[b.type].cost, k = b.level === 1 ? 1.5 : 2.5;
  const cost = {};
  for (const r in base) cost[r] = Math.round(base[r] * k);
  cost.steel = (cost.steel || 0) + (b.level === 1 ? 8 : 20);
  return cost;
}

// how much the town makes and uses in one day, with the people it has right now
function dailyRates() {
  const make = { wood: 0, coal: 0, food: 0, steel: 0 };
  const use = { wood: 0, coal: beaconCoalPerDay(), food: state.people.length, steel: 0 };
  state.plots.forEach((b, i) => {
    if (!b || !BUILDINGS[b.type].makes) return;
    const def = BUILDINGS[b.type];
    const n = workersAt(i).filter((p) => !p.sick).length;
    const amount = n * def.perDay * outputMult(b) * coldFactor(plotTemp(i));
    make[def.makes] += amount;
    if (def.uses) for (const r in def.uses) use[r] += amount * def.uses[r];
  });
  return { make, use };
}

// ---------- people ----------

function addPerson(x, y) {
  const used = new Set(state.people.map((p) => p.name));
  const free = NAMES.filter((n) => !used.has(n));
  const name = free.length ? free[Math.floor(Math.random() * free.length)] : NAMES[state.nextId % NAMES.length];
  const p = { id: state.nextId++, name, x, y, health: 100, sick: false, job: null, home: null };
  state.people.push(p);
  return p;
}

// give a bed to everyone who doesn't have one, if there is room
function assignHomes() {
  const room = state.plots.map((b) => (b && b.type === "shelter" ? beds(b) : 0));
  for (const p of state.people) {
    if (p.home != null && room[p.home] > 0) room[p.home]--;
    else p.home = null;
  }
  for (const p of state.people) {
    if (p.home != null) continue;
    const i = room.findIndex((r) => r > 0);
    if (i < 0) break;
    p.home = i;
    room[i]--;
  }
}

// sick people take infirmary beds, the sickest first
function assignInfirmary() {
  const room = state.plots.map((b) => (b && b.type === "infirmary" ? beds(b) : 0));
  const sick = state.people.filter((p) => p.sick).sort((a, b) => a.health - b.health);
  for (const p of state.people) p.bed = null;
  for (const p of sick) {
    const i = room.findIndex((r) => r > 0);
    if (i < 0) break;
    p.bed = i;
    room[i]--;
  }
}

function spot(i, p, outside) {
  const pl = PLOTS[i], a = p.id * 1.7;
  if (!outside) return { x: pl.x, y: pl.y + 4, temp: plotTemp(i), inside: true, plot: i };
  return { x: pl.x + Math.cos(a) * 30, y: pl.y + 8 + Math.abs(Math.sin(a)) * 12, temp: plotTemp(i), inside: false, plot: i };
}

// where a person wants to be right now, and how cold it is there
function personTarget(p) {
  const hour = hourNow();
  if (p.bed != null) return spot(p.bed, p, false);
  if (!p.sick && p.job != null) {
    const nightShift = state.plots[p.job].type === "tower";
    const onDuty = nightShift ? !isWorkHours(hour) : isWorkHours(hour);
    if (onDuty) return spot(p.job, p, !nightShift);
  }
  if (p.home != null) return spot(p.home, p, false);
  const a = p.id * 2.4;
  return { x: CX + Math.cos(a) * 50, y: CY + 10 + Math.sin(a) * 50 * SQUASH, temp: campTemp(), inside: false, plot: null };
}

function updatePeople(s) {
  assignInfirmary();
  const hungry = state.res.food <= 0;
  for (const p of [...state.people]) {
    const t = personTarget(p);
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
    const step = WALK_SPEED * s;
    if (d > step) { p.x += dx / d * step; p.y += dy / d * step; p.walking = true; }
    else { p.x = t.x; p.y = t.y; p.walking = false; }
    p.hidden = !p.walking && t.inside;
    p.at = p.walking ? null : t.plot;

    if (p.bed != null && !p.walking) {
      p.health += BED_HEAL * s;
    } else if (t.temp < COMFY) {
      p.health -= (COMFY - t.temp) * FREEZE_RATE * s;
    } else if (!hungry) {
      p.health += WARM_HEAL * s;
    }
    if (hungry) p.health -= HUNGER_HURT * s;
    p.health = Math.min(100, p.health);

    if (!p.sick && p.health < SICK_BELOW) {
      p.sick = true;
      toast(`${p.name} is sick from the ${hungry ? "hunger" : "cold"}.`, "warn");
    } else if (p.sick && p.health >= WELL_ABOVE) {
      p.sick = false;
      toast(`${p.name} is feeling better.`, "good");
    }
    if (p.health <= 0) personDies(p, hungry && t.temp >= COMFY ? "starved" : "froze to death");
  }
}

function personDies(p, how) {
  state.people = state.people.filter((q) => q !== p);
  state.stats.deaths++;
  state.hope = Math.max(0, state.hope - 8);
  floaters.push({ x: p.x, y: p.y - 20, text: "💀", color: "#fff", life: 2 });
  toast(`${p.name} ${how}.`, "bad");
  sfx.death();
  assignHomes();
}

// ---------- the beacon and buildings ----------

function updateBeacon(s) {
  const b = state.beacon;
  if (b.broken > 0) {
    b.broken -= s;
    if (b.broken <= 0) toast("The beacon is fixed and burning again.", "good");
    return;
  }
  state.res.coal = Math.max(0, state.res.coal - beaconCoalPerDay() / DAY_LEN * s);
  if (b.power === "over" && state.res.coal > 0) {
    b.strain += STRAIN_UP * s;
    if (b.strain >= 100) {
      b.broken = BROKEN_TIME;
      b.strain = 50;
      toast("CRACK! The beacon broke from the strain. It's cold until it's fixed!", "bad");
      sfx.crack();
    }
  } else {
    b.strain = Math.max(0, b.strain - STRAIN_DOWN * s);
  }
  if (state.res.coal <= 0 && b.power !== "off" && !state.warnedCoal) {
    state.warnedCoal = true;
    toast("Out of coal! The beacon has gone out. Dig more coal!", "bad");
  }
  if (state.res.coal > 5) state.warnedCoal = false;
}

function updateWork(s) {
  if (!isWorkHours(hourNow())) return;
  state.plots.forEach((b, i) => {
    if (!b) return;
    const def = BUILDINGS[b.type];
    if (!def.makes) return;
    const n = workersAt(i).filter((p) => !p.sick).length;
    if (!n) return;
    // perDay is for a whole day, but people only work half of it
    let amount = n * def.perDay * outputMult(b) * coldFactor(plotTemp(i)) / (DAY_LEN * 0.5) * s;
    if (def.uses) {
      for (const r in def.uses) amount = Math.min(amount, state.res[r] / def.uses[r]);
      for (const r in def.uses) state.res[r] -= amount * def.uses[r];
    }
    state.res[def.makes] += amount;
    b.made = (b.made || 0) + amount;
  });
}

function eat(s) {
  state.res.food = Math.max(0, state.res.food - state.people.length / DAY_LEN * s);
  if (state.res.food <= 0 && state.people.length) state.hungryToday = true;
}

// ---------- wolves ----------

function spawnWolves() {
  const n = Math.min(12, 2 + Math.floor(state.day / 3));
  const alpha = state.day === 15 || state.day === 24 || state.day === WIN_DAY;
  const targets = state.plots.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  const lodges = targets.filter((i) => state.plots[i].type === "lodge");
  for (let k = 0; k < n + (alpha ? 1 : 0); k++) {
    const big = alpha && k === n;
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? -30 : side === 1 ? W + 30 : Math.random() * W;
    const y = side === 2 ? -30 : side === 3 ? H + 30 : 60 + Math.random() * (H - 120);
    // wolves can smell meat: half of them go for a hunters' lodge
    const pool = lodges.length && Math.random() < 0.5 ? lodges : targets;
    const hp = big ? 30 : 3 + Math.floor(state.day / 5);
    wolves.push({
      x, y, hp, maxHp: hp, big, bite: 0, flee: false, face: 1,
      target: pool.length ? pool[Math.floor(Math.random() * pool.length)] : null,
      speed: big ? 34 : 42 + Math.random() * 12,
    });
  }
  toast(alpha ? "A huge ALPHA WOLF leads the pack tonight!" : `${n} wolves are coming out of the forest!`, "bad");
  sfx.howl();
}

function updateWolves(s) {
  for (const w of wolves) {
    const tx = w.flee ? (w.x < CX ? -60 : W + 60) : w.target != null ? PLOTS[w.target].x : CX;
    const ty = w.flee ? w.y : w.target != null ? PLOTS[w.target].y + 6 : CY + 20;
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1) w.face = dx > 0 ? 1 : -1;
    if (d > 22 || w.flee) {
      w.x += dx / d * w.speed * s;
      w.y += dy / d * w.speed * s;
      w.biting = false;
    } else {
      w.biting = true;
      w.bite -= s;
      if (w.bite <= 0) {
        w.bite = WOLF_BITE_EVERY;
        const stolen = Math.min(state.res.food, WOLF_STEALS * (w.big ? 3 : 1));
        state.res.food -= stolen;
        if (stolen > 0.5) floaters.push({ x: w.x, y: w.y - 24, text: `-${Math.round(stolen)} ${ICONS.food}`, color: "#ff6a5a", life: 1.2 });
        for (const p of state.people) if (p.at === w.target) p.health -= WOLF_HURTS * (w.big ? 2 : 1);
      }
    }
    if (w.target != null && !state.plots[w.target]) w.target = null;
  }
  wolves = wolves.filter((w) => w.hp > 0 && w.x > -80 && w.x < W + 80);

  // watchtowers shoot when a guard is on duty
  if (!isWorkHours(hourNow())) {
    state.plots.forEach((b, i) => {
      if (!b || b.type !== "tower") return;
      if (!workersAt(i).some((p) => !p.sick)) return;
      b.reload = (b.reload || 0) - s;
      if (b.reload > 0) return;
      const pl = PLOTS[i], range = BUILDINGS.tower.range[b.level - 1];
      let best = null, bestD = range;
      for (const w of wolves) {
        const d = Math.hypot(w.x - pl.x, w.y - pl.y);
        if (d < bestD && !w.flee) { best = w; bestD = d; }
      }
      if (best) {
        b.reload = BUILDINGS.tower.reload[b.level - 1];
        arrows.push({ x: pl.x, y: pl.y - 60, target: best });
      }
    });
  }
}

function hurtWolf(w, dmg) {
  w.hp -= dmg;
  sfx.hit();
  if (w.hp <= 0) {
    const meat = WOLF_MEAT * (w.big ? 5 : 1);
    state.res.food += meat;
    state.stats.wolves++;
    state.hope = Math.min(100, state.hope + (w.big ? 10 : 1));
    floaters.push({ x: w.x, y: w.y - 20, text: `+${meat} ${ICONS.food}`, color: "#6fd38a", life: 1.5 });
    if (w.big) toast("The alpha wolf is beaten! Everyone cheers.", "good");
  }
}

function updateArrows(s) {
  for (const a of arrows) {
    const w = a.target;
    const dx = w.x - a.x, dy = w.y - 10 - a.y, d = Math.hypot(dx, dy);
    a.angle = Math.atan2(dy, dx);
    if (d < 12 || w.hp <= 0) { if (w.hp > 0) hurtWolf(w, 1); a.done = true; continue; }
    a.x += dx / d * 420 * s;
    a.y += dy / d * 420 * s;
  }
  arrows = arrows.filter((a) => !a.done);
}

// ---------- days ----------

function update(s) {
  const before = hourNow();
  state.time += s;
  if (state.time >= DAY_LEN) { state.time -= DAY_LEN; newDay(); if (state.over) return; }
  const hour = hourNow();
  const crossed = (h) => (before < h && hour >= h) || (before > hour && hour >= h);

  updateBeacon(s);
  updateWork(s);
  eat(s);
  updatePeople(s);
  updateWolves(s);
  updateArrows(s);

  if (crossed(WORK_END)) {
    // show what every building made today
    state.plots.forEach((b, i) => {
      if (b && b.made >= 1) {
        const r = BUILDINGS[b.type].makes;
        floaters.push({ x: PLOTS[i].x, y: PLOTS[i].y - 70, text: `+${Math.floor(b.made)} ${ICONS[r]}`, color: "#fff", life: 2.5 });
      }
      if (b) b.made = 0;
    });
    if (state.raidTonight) { toast("Howls in the distance... wolves will come tonight!", "warn"); sfx.howl(); }
  }
  if (crossed(RAID_HOUR) && state.raidTonight) spawnWolves();

  if (!state.people.length) return gameOver(false, "Nobody is left in Frostfall.");
  if (state.hope <= 0) return gameOver(false, "Your people lost hope and walked off into the snow.");
}

function newDay() {
  state.day++;
  for (const w of wolves) w.flee = true;
  if (state.day > WIN_DAY) return gameOver(true, "The sun breaks through. The thaw has come!");

  // how did yesterday go?
  const homeless = state.people.filter((p) => p.home == null).length;
  const sick = state.people.filter((p) => p.sick).length;
  let mood = 4;                               // a good day gives hope...
  if (state.hungryToday) mood -= 10;          // ...and every problem takes some away
  mood -= Math.min(4, homeless);
  if (sick > state.people.length / 3) mood -= 5;
  state.hope = Math.max(0, Math.min(100, state.hope + mood));
  state.hungryToday = false;

  state.blizzard = state.blizzardTomorrow;
  state.blizzardTomorrow = state.day >= 4 && !state.blizzard && state.day < WHITEOUT_DAY - 1 && Math.random() < 0.25;
  state.raidTonight = state.day >= 3 && (state.day % 3 === 0 || Math.random() < 0.2);

  // new survivors follow the light of the beacon
  if (state.day >= 2 && state.hope >= 25) {
    const n = 1 + Math.floor(Math.random() * 3) + (state.day % 5 === 0 ? 3 : 0);
    const room = totalBeds("shelter") + 1 - state.people.length;
    const came = Math.max(0, Math.min(n, room));
    for (let k = 0; k < came; k++) addPerson(CX - 60 + Math.random() * 120, H + 20 + k * 14);
    state.stats.arrived += came;
    if (came) toast(`${came} survivor${came > 1 ? "s" : ""} followed the beacon's light to town!`, "good");
    if (came < n) toast("Some survivors were turned away: there is no room. Build shelters!", "warn");
    assignHomes();
  }

  let sub = state.blizzard ? "❄️ BLIZZARD! 15° colder today" : "";
  if (state.day >= WHITEOUT_DAY) sub = "🌨 THE WHITEOUT: the coldest days of all";
  else if (state.blizzardTomorrow) sub += (sub ? " · " : "") + "Scouts see a blizzard coming tomorrow";
  banner(`DAY ${state.day}`, sub);
  if (state.day === WHITEOUT_DAY - 1) toast("The Whiteout starts tomorrow. Upgrade the beacon and stock up on coal!", "warn");
  sfx.dawn();
  save();
}

// ---------- start, save, end ----------

function newGame(diff) {
  const lv = LEVELS[diff];
  state = {
    diff, day: 1, time: 0, res: { ...lv.start }, hope: 60,
    beacon: { level: 1, power: "low", strain: 0, broken: 0 },
    plots: PLOTS.map(() => null),
    people: [], nextId: 1,
    blizzard: false, blizzardTomorrow: false, raidTonight: false, hungryToday: false,
    stats: { deaths: 0, arrived: 0, wolves: 0 }, over: false,
  };
  state.plots[1] = { type: "shelter", level: 1 };
  state.plots[3] = { type: "sawmill", level: 1 };
  state.plots[6] = { type: "lodge", level: 1 };
  for (let k = 0; k < 6; k++) addPerson(CX - 40 + k * 16, CY + 40);
  state.people[0].job = 3;
  state.people[1].job = 3;
  state.people[2].job = 6;
  assignHomes();
  startPlaying();
  banner("DAY 1", "Keep the beacon burning. Build a Coal Pit soon!");
}

function startPlaying() {
  wolves = []; arrows = []; floaters = [];
  selected = null;
  paused = false;
  $("title").hidden = true;
  $("pause-screen").hidden = true;
  $("pause").textContent = "⏸";
  lastPanel = "";
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function bestDay() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
}

function gameOver(won, message) {
  state.over = true;
  const reached = won ? WIN_DAY : state.day;
  try {
    localStorage.removeItem(SAVE_KEY);
    if (reached > bestDay()) localStorage.setItem(BEST_KEY, String(reached));
  } catch (e) { /* storage blocked */ }
  if (won) sfx.dawn(); else sfx.death();
  showTitle(won ? "YOU SURVIVED!" : "FROZEN OUT", message,
    `Days survived: ${reached} · Survivors: ${state.people.length} · Lost: ${state.stats.deaths} · Wolves beaten: ${state.stats.wolves}`);
}

function showTitle(heading, message, summary) {
  const title = $("title");
  title.querySelector("h1").innerHTML = heading || "FROST<br>FALL";
  $("title-message").textContent = message || "The world froze. Keep the beacon burning for 30 days.";
  $("summary").hidden = !summary;
  $("summary").textContent = summary || "";
  const saved = loadSave();
  $("continue").hidden = !(saved && !saved.over);
  if (saved) $("continue-day").textContent = saved.day;
  const best = bestDay();
  $("best").textContent = best >= WIN_DAY ? "🏆 You have survived all 30 days before!" : best ? `Your best: day ${best}` : "";
  title.hidden = false;
}

// ---------- the side panel ----------

function panelHtml() {
  if (!state || state.over) return "<h2>❄️ Frostfall</h2><p>Pick a difficulty to start.</p>";
  if (selected === "beacon") return beaconPanel();
  if (selected != null) return state.plots[selected] ? buildingPanel(selected) : buildPanel(selected);
  return townPanel();
}

function townPanel() {
  const { make, use } = dailyRates();
  const pop = state.people.length;
  const sick = state.people.filter((p) => p.sick).length;
  const homeless = state.people.filter((p) => p.home == null).length;
  const idle = idlePeople().length;
  const row = (label, r) => {
    const net = make[r] - use[r];
    return `<div class="row"><span>${ICONS[r]} ${label}</span><b class="${net < 0 ? "freezing" : "warm"}">${net >= 0 ? "+" : ""}${Math.round(net)}/day</b></div>`;
  };
  const tips = [];
  if (!state.plots.some((b) => b && b.type === "coalpit")) tips.push("Build a <b>Coal Pit</b>: the beacon needs coal or everyone freezes.");
  else if (make.coal < use.coal) tips.push("The beacon burns more coal than you dig. Add coal workers.");
  if (make.food < use.food) tips.push("You eat more food than you hunt. Add hunters.");
  if (homeless) tips.push(`${homeless} ${homeless > 1 ? "people sleep" : "person sleeps"} outside. Build a <b>Shelter</b>.`);
  if (idle) tips.push(`${idle} ${idle > 1 ? "people are" : "person is"} idle. Click a building and press <b>+</b>.`);
  if (sick && !totalBeds("infirmary")) tips.push("Sick people heal much faster in an <b>Infirmary</b>.");
  if (state.day >= 2 && !state.plots.some((b) => b && b.type === "tower")) tips.push("Wolves raid at night. A <b>Watchtower</b> helps.");
  if (outsideTemp() + beaconHeat() < COMFY) tips.push("It's too cold! Turn the beacon up or upgrade it.");
  const warnings = [];
  if (state.raidTonight) warnings.push("🐺 Wolves will raid tonight.");
  if (state.blizzardTomorrow) warnings.push("❄️ A blizzard is coming tomorrow.");
  if (state.day === WHITEOUT_DAY - 1) warnings.push("🌨 The Whiteout starts tomorrow!");
  return `
    <h2>🏘 Frostfall</h2>
    <p>Click the beacon, a building or an empty plot.</p>
    <h3>Survivors</h3>
    <div class="row"><span>👥 People</span><b>${pop}</b></div>
    <div class="row"><span>🛏 Beds</span><b>${totalBeds("shelter")}</b></div>
    <div class="row"><span>🧍 Idle</span><b>${idle}</b></div>
    <div class="row"><span>🤒 Sick</span><b class="${sick ? "chilly" : ""}">${sick}</b></div>
    <h3>Each day</h3>
    ${row("Wood", "wood")}${row("Coal", "coal")}${row("Food", "food")}${row("Steel", "steel")}
    ${warnings.length ? `<div class="alert">${warnings.join("<br>")}</div>` : ""}
    ${tips.length ? `<h3>Tips</h3><ul class="tips">${tips.slice(0, 3).map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}`;
}

function beaconPanel() {
  const b = state.beacon;
  const heat = beaconHeat();
  const perDay = beaconCoalPerDay();
  const days = perDay ? state.res.coal / perDay : Infinity;
  const cost = BEACON_COSTS[b.level];
  const buttons = POWER_ORDER.map((p, k) =>
    `<button data-act="power" data-p="${p}" aria-pressed="${b.power === p}" title="Key ${k + 1}">${POWER[p].name}</button>`).join("");
  return `
    <h2>🔥 Beacon <span class="lvl">Lv ${b.level}</span></h2>
    <p>The heart of town. It burns coal to keep everyone warm. The dashed circle shows how far its heat reaches.</p>
    ${b.broken > 0 ? `<div class="alert">Broken! Fixed in ${Math.ceil(b.broken)} seconds.</div>` : ""}
    <h3>Power</h3>
    <div class="power">${buttons}</div>
    <div class="row"><span>Heat</span><b class="warm">+${Math.round(heat)}°</b></div>
    <div class="row"><span>Burns</span><b>${Math.round(perDay)} ${ICONS.coal}/day</b></div>
    <div class="row"><span>Coal lasts</span><b class="${days < 1.5 ? "freezing" : ""}">${days === Infinity ? "–" : days < 1 ? "less than a day" : `${Math.floor(days)} days`}</b></div>
    <div class="row"><span>Next to the beacon</span><b class="${tempClass(outsideTemp() + heat)}">${Math.round(outsideTemp() + heat)}°</b></div>
    <div class="strain">
      <p>Strain${b.power === "over" ? ": Overdrive is hard on the beacon!" : ""}</p>
      <div class="bar"><div class="bar-fill" style="width:${Math.floor(b.strain)}%"></div><span class="bar-text">${Math.floor(b.strain)}%</span></div>
    </div>
    ${cost ? `<button class="big" data-act="beacon-up" ${canAfford(cost) ? "" : "disabled"}>⬆ Upgrade to Lv ${b.level + 1}<small>${costText(cost)} · more heat, reaches farther</small></button>`
      : `<p>The beacon is at its biggest size.</p>`}`;
}

function buildPanel(i) {
  const temp = plotTemp(i);
  const cards = BUILD_ORDER.map((type) => {
    const def = BUILDINGS[type];
    return `<button class="big" data-act="build" data-type="${type}" ${canAfford(def.cost) ? "" : "disabled"}>
      <span class="icon">${def.icon}</span><span>${def.name}</span><small>${costText(def.cost)} · ${def.desc}</small></button>`;
  }).join("");
  return `
    <h2>Empty plot</h2>
    <p>It's <b class="${tempClass(temp)}">${Math.round(temp)}°</b> here right now. Plots close to the beacon are warmer.</p>
    <h3>Build</h3>
    <div class="build-list">${cards}</div>`;
}

function buildingPanel(i) {
  const b = state.plots[i], def = BUILDINGS[b.type];
  const temp = plotTemp(i);
  const workers = workersAt(i);
  const idle = idlePeople().length;
  let html = `
    <h2>${def.icon} ${def.name} <span class="lvl">Lv ${b.level}</span></h2>
    <p>${def.desc}</p>
    <div class="row"><span>🌡 ${def.insulation ? "Inside" : "Here"}</span><b class="${tempClass(temp)}">${Math.round(temp)}°</b></div>`;
  if (def.workers) {
    const healthy = workers.filter((p) => !p.sick).length;
    html += `<div class="row"><span>${b.type === "tower" ? "Guard (night watch)" : "Workers"}</span>
      <span class="stepper"><button data-act="fire" aria-label="Remove a worker" ${workers.length ? "" : "disabled"}>−</button>
      <b>${workers.length}/${slots(b)}</b>
      <button data-act="hire" aria-label="Add a worker" ${workers.length < slots(b) && idle ? "" : "disabled"}>+</button></span></div>`;
    if (workers.length > healthy) html += `<p class="chilly">${workers.length - healthy} sick, can't work.</p>`;
    html += `<p>${idle} idle ${idle === 1 ? "person" : "people"} in town.</p>`;
  }
  if (def.makes) {
    const amount = workers.filter((p) => !p.sick).length * def.perDay * outputMult(b) * coldFactor(temp);
    html += `<div class="row"><span>Makes</span><b>${Math.round(amount)} ${ICONS[def.makes]}/day</b></div>`;
    if (coldFactor(temp) < 1) html += `<p class="chilly">It's cold here, so work is slow.</p>`;
    if (def.uses && amount) html += `<p>Uses ${costText(Object.fromEntries(Object.entries(def.uses).map(([r, k]) => [r, amount * k])))} a day.</p>`;
  }
  if (def.beds) {
    const used = b.type === "shelter" ? state.people.filter((p) => p.home === i).length : state.people.filter((p) => p.bed === i).length;
    html += `<div class="row"><span>${b.type === "shelter" ? "🛏 Beds" : "🛏 Patients"}</span><b>${used}/${beds(b)}</b></div>`;
    html += `<div class="row"><span>Walls keep in</span><b>+${def.insulation[b.level - 1]}°</b></div>`;
  }
  if (b.type === "tower") html += `<div class="row"><span>Range</span><b>${def.range[b.level - 1]}</b></div>`;
  if (b.level < MAX_LEVEL) {
    const cost = upgradeCost(b);
    html += `<button class="big" data-act="upgrade" ${canAfford(cost) ? "" : "disabled"}>⬆ Upgrade to Lv ${b.level + 1}<small>${costText(cost)}</small></button>`;
  }
  html += `<button class="big danger" data-act="demolish">${confirmDemolish ? "Click again to tear it down" : "🔨 Tear down"}<small>Get half of what it cost back</small></button>`;
  return html;
}

function renderPanel(force) {
  const html = panelHtml();
  if (force || html !== lastPanel) {
    panel.innerHTML = html;
    lastPanel = html;
  }
}

panel.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn || btn.disabled || !state || state.over) return;
  const act = btn.dataset.act;
  if (act === "power") setPower(btn.dataset.p);
  else if (act === "beacon-up") upgradeBeacon();
  else if (act === "build") build(selected, btn.dataset.type);
  else if (act === "hire") hire(selected);
  else if (act === "fire") fire(selected);
  else if (act === "upgrade") upgrade(selected);
  else if (act === "demolish") demolish(selected);
  renderPanel(true);
});

function setPower(p) {
  state.beacon.power = p;
  sfx.click();
}
function upgradeBeacon() {
  const cost = BEACON_COSTS[state.beacon.level];
  if (!cost || !canAfford(cost)) return;
  pay(cost);
  state.beacon.level++;
  toast(`The beacon is now level ${state.beacon.level}. Its heat reaches farther!`, "good");
  sfx.build();
}
function build(i, type) {
  const def = BUILDINGS[type];
  if (state.plots[i] || !canAfford(def.cost)) return;
  pay(def.cost);
  state.plots[i] = { type, level: 1 };
  assignHomes();
  sfx.build();
  // put idle people to work straight away
  if (def.workers && type !== "tower") for (let k = 0; k < 2; k++) hire(i, true);
}
function hire(i, quiet) {
  const b = state.plots[i];
  if (!b || workersAt(i).length >= slots(b)) return;
  const free = idlePeople();
  if (!free.length) return;
  free.sort((a, c) => Math.hypot(a.x - PLOTS[i].x, a.y - PLOTS[i].y) - Math.hypot(c.x - PLOTS[i].x, c.y - PLOTS[i].y));
  free[0].job = i;
  if (!quiet) sfx.click();
}
function fire(i) {
  const list = workersAt(i);
  if (!list.length) return;
  list[list.length - 1].job = null;
  sfx.click();
}
function upgrade(i) {
  const b = state.plots[i];
  if (!b || b.level >= MAX_LEVEL) return;
  const cost = upgradeCost(b);
  if (!canAfford(cost)) return;
  pay(cost);
  b.level++;
  assignHomes();
  sfx.build();
}
function demolish(i) {
  if (!confirmDemolish) { confirmDemolish = true; return; }
  const b = state.plots[i];
  for (const r in BUILDINGS[b.type].cost) state.res[r] += BUILDINGS[b.type].cost[r] / 2;
  for (const p of state.people) {
    if (p.job === i) p.job = null;
    if (p.home === i) p.home = null;
  }
  state.plots[i] = null;
  confirmDemolish = false;
  assignHomes();
  sfx.hit();
}

// ---------- clicking the town ----------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function thingAt(x, y) {
  for (const w of wolves) if (Math.hypot(w.x - x, w.y - 10 - y) < (w.big ? 30 : 20)) return { wolf: w };
  if (Math.abs(x - CX) < 32 && y > CY - 95 && y < CY + 12) return { pick: "beacon" };
  for (let i = 0; i < PLOTS.length; i++) {
    const p = PLOTS[i];
    if (Math.abs(x - p.x) < 36 && y > p.y - 60 && y < p.y + 14) return { pick: i };
  }
  return null;
}

canvas.addEventListener("click", (e) => {
  if (!state || state.over || paused) return;
  const pt = canvasPoint(e);
  const hit = thingAt(pt.x, pt.y);
  if (hit && hit.wolf) {
    if (torchTimer <= 0) {
      torchTimer = TORCH_COOLDOWN;
      hurtWolf(hit.wolf, 1);
      floaters.push({ x: pt.x, y: pt.y, text: "🔥", color: "#fff", life: 0.6 });
    }
    return;
  }
  select(hit ? hit.pick : null);
});
canvas.addEventListener("mousemove", (e) => {
  if (!state) return;
  const pt = canvasPoint(e);
  const hit = thingAt(pt.x, pt.y);
  hovered = hit && !hit.wolf ? hit.pick : null;
  canvas.style.cursor = hit ? "pointer" : "default";
});
canvas.addEventListener("mouseleave", () => { hovered = null; });

function select(what) {
  if (selected !== what) confirmDemolish = false;
  selected = what;
  renderPanel(true);
}

// ---------- drawing ----------

function darkness(h) { // 0 = bright day, 1 = darkest night
  if (h >= 8 && h < 17) return 0;
  if (h >= 17 && h < 21) return (h - 17) / 4;
  if (h >= 21 || h < 4) return 1;
  return 1 - (h - 4) / 4;
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function drawGround() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#d6e3ef");
  g.addColorStop(1, "#f3f7fb");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // trodden paths in the snow
  ctx.strokeStyle = "rgba(140, 160, 185, 0.22)";
  ctx.lineWidth = 16;
  ellipse(CX, CY + 6, 140, 140 * SQUASH); ctx.stroke();
  ellipse(CX, CY + 6, 265, 265 * SQUASH); ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * 40, CY + 6 + Math.sin(a) * 40 * SQUASH);
    ctx.lineTo(CX + Math.cos(a) * 265, CY + 6 + Math.sin(a) * 265 * SQUASH);
    ctx.stroke();
  }
}

function drawHeat() {
  const h = beaconHeat();
  if (!h) return;
  const r = heatRadius();
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(1, SQUASH);
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, r * 2);
  const a = 0.12 + h / 260;
  g.addColorStop(0, `rgba(255, 170, 80, ${a})`);
  g.addColorStop(0.5, `rgba(255, 150, 60, ${a * 0.55})`);
  g.addColorStop(1, "rgba(255, 140, 60, 0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, Math.PI * 2); ctx.fill();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "rgba(230, 120, 40, 0.45)";
  ctx.lineWidth = 2 / SQUASH;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTree(t) {
  const x = t.x, y = t.y, s = t.s;
  ctx.fillStyle = "rgba(60, 80, 110, 0.15)";
  ellipse(x, y + 2, 16 * s, 5 * s); ctx.fill();
  ctx.fillStyle = "#5b3a28";
  ctx.fillRect(x - 3 * s, y - 8 * s, 6 * s, 9 * s);
  for (let k = 0; k < 3; k++) {
    const top = y - 8 * s - (k + 1) * 14 * s, wide = (18 - k * 4) * s;
    ctx.fillStyle = "#2f5d4a";
    ctx.beginPath();
    ctx.moveTo(x - wide, top + 18 * s); ctx.lineTo(x, top); ctx.lineTo(x + wide, top + 18 * s);
    ctx.fill();
    ctx.fillStyle = "#f4f8fb";
    ctx.beginPath();
    ctx.moveTo(x - wide * 0.45, top + 8 * s); ctx.lineTo(x, top); ctx.lineTo(x + wide * 0.45, top + 8 * s);
    ctx.fill();
  }
}

function drawPlot(i) {
  const p = PLOTS[i];
  const on = hovered === i || selected === i;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = on ? "rgba(40, 90, 150, 0.9)" : "rgba(90, 120, 150, 0.45)";
  ctx.lineWidth = 2;
  ellipse(p.x, p.y, 30, 14); ctx.stroke();
  ctx.setLineDash([]);
  if (on) {
    ctx.fillStyle = "rgba(40, 90, 150, 0.9)";
    ctx.font = "bold 20px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", p.x, p.y + 7);
  }
}

function drawHut(x, y, w, h, wall, roof, lit) {
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(x + w / 6, y - h, w / 3, h);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 7, y - h + 2); ctx.lineTo(x, y - h - 24); ctx.lineTo(x + w / 2 + 7, y - h + 2);
  ctx.fill();
  ctx.fillStyle = "#f7fafc";
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5, y - h - 2); ctx.lineTo(x, y - h - 25); ctx.lineTo(x + w / 2 + 5, y - h - 2);
  ctx.lineTo(x + w / 4, y - h - 8); ctx.lineTo(x, y - h - 4); ctx.lineTo(x - w / 4, y - h - 9);
  ctx.fill();
  ctx.fillStyle = "#3a2618";
  ctx.fillRect(x - 6, y - 15, 12, 15);
  ctx.fillStyle = lit ? "#ffd27a" : "#4a6680";
  ctx.fillRect(x - w / 2 + 6, y - h + 7, 9, 8);
  ctx.fillRect(x + w / 2 - 15, y - h + 7, 9, 8);
}

function drawMine(x, y, lit) {
  ctx.fillStyle = "#6b6f78";
  ctx.beginPath(); ctx.ellipse(x, y, 38, 34, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#f7fafc";
  ctx.beginPath(); ctx.ellipse(x, y - 22, 26, 12, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#1d1f24";
  ctx.beginPath(); ctx.ellipse(x, y, 13, 18, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = "#7a5236"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 14, y - 18); ctx.lineTo(x + 14, y - 18); ctx.lineTo(x + 14, y); ctx.stroke();
  // a cart full of coal
  ctx.fillStyle = "#4a3a2c"; ctx.fillRect(x + 20, y - 10, 18, 9);
  ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(x + 29, y - 11, 6, Math.PI, 0); ctx.fill();
  if (lit) { ctx.fillStyle = "#ffd27a"; ctx.fillRect(x - 3, y - 10, 6, 6); }
}

function drawTower(x, y, lit) {
  ctx.strokeStyle = "#5b3a28"; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 14, y); ctx.lineTo(x - 9, y - 52);
  ctx.moveTo(x + 14, y); ctx.lineTo(x + 9, y - 52);
  ctx.moveTo(x - 12, y - 14); ctx.lineTo(x + 12, y - 34);
  ctx.moveTo(x + 12, y - 14); ctx.lineTo(x - 12, y - 34);
  ctx.stroke();
  ctx.fillStyle = "#7a5236"; ctx.fillRect(x - 17, y - 60, 34, 10);
  ctx.fillStyle = "#4a2f1e";
  ctx.beginPath(); ctx.moveTo(x - 20, y - 70); ctx.lineTo(x, y - 86); ctx.lineTo(x + 20, y - 70); ctx.fill();
  ctx.fillStyle = "#f7fafc";
  ctx.beginPath(); ctx.moveTo(x - 12, y - 76); ctx.lineTo(x, y - 86); ctx.lineTo(x + 12, y - 76); ctx.fill();
  ctx.strokeStyle = "#5b3a28"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 15, y - 60); ctx.lineTo(x - 15, y - 70); ctx.moveTo(x + 15, y - 60); ctx.lineTo(x + 15, y - 70); ctx.stroke();
  if (lit) { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(x, y - 65, 4, 0, Math.PI * 2); ctx.fill(); }
}

function drawBuilding(i) {
  const b = state.plots[i], p = PLOTS[i], def = BUILDINGS[b.type];
  const x = p.x, y = p.y;
  const night = darkness(hourNow()) > 0.3;
  const someoneHome = state.people.some((q) => q.hidden && q.at === i);
  const working = workersAt(i).some((q) => !q.sick);

  if (selected === i || hovered === i) {
    ctx.strokeStyle = selected === i ? "#ffcf5a" : "rgba(40, 90, 150, 0.7)";
    ctx.lineWidth = 3;
    ellipse(x, y + 2, 42, 16); ctx.stroke();
  }
  ctx.fillStyle = "rgba(60, 80, 110, 0.2)";
  ellipse(x, y + 2, 38, 11); ctx.fill();

  let top;
  if (b.type === "coalpit") { drawMine(x, y, night && working); top = y - 50; }
  else if (b.type === "tower") { drawTower(x, y, night && working); top = y - 92; }
  else {
    const w = 52 + b.level * 6, h = 26 + b.level * 4;
    drawHut(x, y, w, h, def.wall, def.roof, night && (someoneHome || working));
    top = y - h - 30;
  }
  ctx.font = "16px serif";
  ctx.textAlign = "center";
  ctx.fillText(def.icon, x, top);
  // level pips
  for (let k = 0; k < b.level; k++) {
    ctx.fillStyle = "#ffcf5a";
    ctx.beginPath(); ctx.arc(x - (b.level - 1) * 5 + k * 10, y + 16, 3, 0, Math.PI * 2); ctx.fill();
  }
  // temperature tag
  const t = Math.round(plotTemp(i));
  ctx.font = "bold 11px Inter, sans-serif";
  const label = `${t}°`, lw = ctx.measureText(label).width + 10;
  ctx.fillStyle = t >= COMFY ? "rgba(46, 140, 80, 0.85)" : t >= -20 ? "rgba(200, 140, 20, 0.9)" : "rgba(200, 50, 40, 0.9)";
  ctx.beginPath(); ctx.roundRect(x + 24, y - 6, lw, 15, 7); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + 24 + lw / 2, y + 5);
}

function drawBeacon() {
  const b = state.beacon, x = CX, y = CY;
  const heat = beaconHeat();
  if (selected === "beacon" || hovered === "beacon") {
    ctx.strokeStyle = selected === "beacon" ? "#ffcf5a" : "rgba(40, 90, 150, 0.7)";
    ctx.lineWidth = 3;
    ellipse(x, y + 4, 40, 15); ctx.stroke();
  }
  ctx.fillStyle = "rgba(60, 80, 110, 0.25)";
  ellipse(x, y + 4, 34, 11); ctx.fill();
  // stone tower, taller with every level
  const tall = 40 + b.level * 6;
  ctx.fillStyle = "#7d8796";
  ctx.beginPath();
  ctx.moveTo(x - 24, y); ctx.lineTo(x - 15, y - tall); ctx.lineTo(x + 15, y - tall); ctx.lineTo(x + 24, y);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)"; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    const yy = y - tall * k / 4;
    ctx.beginPath(); ctx.moveTo(x - 24 + 9 * k / 4, yy); ctx.lineTo(x + 24 - 9 * k / 4, yy); ctx.stroke();
  }
  ctx.fillStyle = "#4c5563";
  ctx.fillRect(x - 21, y - tall - 8, 42, 10);
  const fy = y - tall - 8;
  if (b.broken > 0) {
    for (let k = 0; k < 3; k++) {
      const t = (animTime * 0.6 + k / 3) % 1;
      ctx.fillStyle = `rgba(90, 90, 100, ${0.5 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 6 + k) * 8, fy - t * 50, 6 + t * 12, 0, Math.PI * 2); ctx.fill();
    }
  } else if (heat > 0) {
    const size = 10 + heat * 0.55;
    const flick = Math.sin(animTime * 13) * 2 + Math.sin(animTime * 7.3) * 2;
    const g = ctx.createLinearGradient(0, fy - size * 1.6, 0, fy);
    g.addColorStop(0, "rgba(255, 230, 120, 0.2)");
    g.addColorStop(0.5, "#ffb03b");
    g.addColorStop(1, "#e2461d");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 18, fy);
    ctx.quadraticCurveTo(x - 16, fy - size, x + flick, fy - size * 1.6);
    ctx.quadraticCurveTo(x + 16, fy - size, x + 18, fy);
    ctx.fill();
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.moveTo(x - 7, fy); ctx.quadraticCurveTo(x, fy - size * 0.8 + flick, x + 7, fy); ctx.fill();
  } else {
    ctx.fillStyle = "#c0502a";
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x - 12 + k * 8, fy - 2, 2, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawPerson(p) {
  const bob = p.walking ? Math.abs(Math.sin(animTime * 10 + p.id)) * 2 : 0;
  const shiver = p.sick ? Math.sin(animTime * 40 + p.id) * 0.8 : 0;
  const x = p.x + shiver, y = p.y - bob;
  ctx.fillStyle = "rgba(60, 80, 110, 0.2)";
  ellipse(p.x, p.y + 1, 5, 2); ctx.fill();
  ctx.strokeStyle = "#2b2b33"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x - 2, y - 5); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y - 5); ctx.stroke();
  ctx.fillStyle = p.sick ? "#7fa6c9" : COATS[p.id % COATS.length];
  ctx.fillRect(x - 4, y - 13, 8, 9);
  ctx.fillStyle = "#f1c9a5";
  ctx.beginPath(); ctx.arc(x, y - 16, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.sick ? "#5c7c99" : "#3d3d48";
  ctx.fillRect(x - 3.5, y - 20, 7, 3);
  if (p.health < 60) {
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x - 6, y - 26, 12, 2.5);
    ctx.fillStyle = p.health < SICK_BELOW ? "#ff6a5a" : "#ffcf5a"; ctx.fillRect(x - 6, y - 26, 12 * p.health / 100, 2.5);
  }
}

function drawWolf(w) {
  const s = w.big ? 1.7 : 1, x = w.x, y = w.y, f = w.face;
  const step = Math.sin(animTime * 14 + x) * 3 * s;
  ctx.fillStyle = "rgba(40, 50, 70, 0.25)";
  ellipse(x, y + 1, 16 * s, 4 * s); ctx.fill();
  ctx.strokeStyle = w.big ? "#2a2d33" : "#4a4f58"; ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(x - 8 * s, y - 6 * s); ctx.lineTo(x - 8 * s - step * 0.5, y);
  ctx.moveTo(x + 8 * s, y - 6 * s); ctx.lineTo(x + 8 * s + step * 0.5, y);
  ctx.stroke();
  ctx.fillStyle = w.big ? "#2a2d33" : "#6b717c";
  ellipse(x, y - 10 * s, 14 * s, 6 * s); ctx.fill();
  ctx.beginPath();  // tail
  ctx.moveTo(x - f * 13 * s, y - 12 * s); ctx.lineTo(x - f * 24 * s, y - 16 * s - step * 0.3); ctx.lineTo(x - f * 14 * s, y - 8 * s); ctx.fill();
  ellipse(x + f * 15 * s, y - 15 * s, 7 * s, 5 * s); ctx.fill();  // head
  ctx.beginPath();  // snout and ears
  ctx.moveTo(x + f * 19 * s, y - 17 * s); ctx.lineTo(x + f * 27 * s, y - 13 * s); ctx.lineTo(x + f * 19 * s, y - 11 * s);
  ctx.moveTo(x + f * 11 * s, y - 18 * s); ctx.lineTo(x + f * 12 * s, y - 25 * s); ctx.lineTo(x + f * 16 * s, y - 19 * s);
  ctx.fill();
  ctx.fillStyle = "#ffe14d";
  ctx.beginPath(); ctx.arc(x + f * 18 * s, y - 16 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
  if (w.hp < w.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - 14 * s, y - 32 * s, 28 * s, 3);
    ctx.fillStyle = "#ff6a5a"; ctx.fillRect(x - 14 * s, y - 32 * s, 28 * s * w.hp / w.maxHp, 3);
  }
}

function drawSnow(dt) {
  const stormy = state && (state.blizzard || state.day >= WHITEOUT_DAY);
  const want = stormy ? 360 : 110;
  while (snow.length < want) snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2, v: 20 + Math.random() * 40 });
  if (snow.length > want) snow.length = want;
  const wind = stormy ? 140 : 20;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (const f of snow) {
    f.y += f.v * dt * (stormy ? 2 : 1);
    f.x += (wind + Math.sin(f.y / 30) * 15) * dt;
    if (f.y > H) { f.y = -5; f.x = Math.random() * W; }
    if (f.x > W) f.x -= W;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
}

function draw(dt) {
  if (!state) {
    drawGround();
    for (const t of TREES) drawTree(t);
    drawSnow(dt);
    return;
  }
  drawGround();
  drawHeat();
  for (let i = 0; i < PLOTS.length; i++) if (!state.plots[i]) drawPlot(i);

  // draw things further back first, so things in front cover them
  const things = [];
  for (const t of TREES) things.push({ y: t.y, f: () => drawTree(t) });
  state.plots.forEach((b, i) => { if (b) things.push({ y: PLOTS[i].y, f: () => drawBuilding(i) }); });
  things.push({ y: CY, f: drawBeacon });
  for (const p of state.people) if (!p.hidden) things.push({ y: p.y, f: () => drawPerson(p) });
  for (const w of wolves) things.push({ y: w.y, f: () => drawWolf(w) });
  things.sort((a, b) => a.y - b.y);
  for (const t of things) t.f();

  ctx.strokeStyle = "#3a2618"; ctx.lineWidth = 2;
  for (const a of arrows) {
    ctx.beginPath();
    ctx.moveTo(a.x - Math.cos(a.angle || 0) * 10, a.y - Math.sin(a.angle || 0) * 10);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  }

  // night falls, then the fire and the wolves' eyes glow through it
  const dark = darkness(hourNow());
  if (dark > 0) {
    ctx.fillStyle = `rgba(12, 22, 52, ${0.55 * dark})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const heat = beaconHeat();
    if (heat) {
      const g = ctx.createRadialGradient(CX, CY - 60, 5, CX, CY - 60, 90 + heat * 2);
      g.addColorStop(0, `rgba(255, 150, 60, ${0.35 * dark})`);
      g.addColorStop(1, "rgba(255, 150, 60, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    for (const w of wolves) {
      ctx.fillStyle = `rgba(255, 230, 80, ${0.8 * dark})`;
      const s = w.big ? 1.7 : 1;
      ctx.beginPath(); ctx.arc(w.x + w.face * 18 * s, w.y - 16 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  drawSnow(dt);
  if (state.blizzard || state.day >= WHITEOUT_DAY) {
    ctx.fillStyle = "rgba(235, 242, 250, 0.18)";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = "center";
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.font = "bold 15px Inter, sans-serif";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD, toasts and banners ----------

function updateHud() {
  if (!state) return;
  $("day").textContent = `Day ${Math.min(state.day, WIN_DAY)}/${WIN_DAY}`;
  $("time").textContent = clockText(hourNow()) + (isWorkHours(hourNow()) ? " · work" : " · rest");
  $("temp").textContent = `${Math.round(outsideTemp())}°`;
  $("temp").classList.toggle("storm", state.blizzard || state.day >= WHITEOUT_DAY);
  for (const r of ["wood", "coal", "food", "steel"]) $(r).textContent = fmt(state.res[r]);
  $("coal").classList.toggle("low", state.res.coal < beaconCoalPerDay());
  $("food").classList.toggle("low", state.res.food < state.people.length);
  const sick = state.people.filter((p) => p.sick).length;
  $("people").textContent = state.people.length + (sick ? ` (${sick}🤒)` : "");
  $("hope").textContent = Math.round(state.hope);
  $("hope-fill").style.width = `${state.hope}%`;
  $("hope-fill").classList.toggle("low", state.hope < 25);
}

function toast(words, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = words;
  const box = $("toasts");
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 5000);
}

function banner(title, sub) {
  const el = $("banner");
  $("banner-title").textContent = title;
  $("banner-sub").textContent = sub || "";
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;  // restart the animation
  el.style.animation = "";
  clearTimeout(banner.timer);
  banner.timer = setTimeout(() => { el.hidden = true; }, 2400);
}

// ---------- controls ----------

function setPaused(p) {
  if (!state || state.over || !$("title").hidden) return;
  paused = p;
  $("pause-screen").hidden = !p;
  $("pause").textContent = p ? "▶" : "⏸";
}
function setSpeed(n) {
  speed = n;
  for (const b of $("speed").children) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === n));
}
function toggleSound() {
  muted = !muted;
  $("sound").textContent = muted ? "🔇" : "🔊";
  $("sound").setAttribute("aria-label", muted ? "Sound off" : "Sound on");
}

$("pause").addEventListener("click", () => setPaused(!paused));
$("pause-screen").addEventListener("click", () => setPaused(false));
$("sound").addEventListener("click", toggleSound);
$("speed").addEventListener("click", (e) => { if (e.target.dataset.speed) setSpeed(Number(e.target.dataset.speed)); });
$("continue").addEventListener("click", () => {
  const saved = loadSave();
  if (!saved) return;
  state = saved;
  startPlaying();
  banner(`DAY ${state.day}`, "Welcome back");
});

for (const key of Object.keys(LEVELS)) {
  const lv = LEVELS[key];
  const btn = document.createElement("button");
  btn.className = "level";
  btn.innerHTML = `<strong>${lv.name}</strong><span>${lv.desc}</span>`;
  btn.addEventListener("click", () => newGame(key));
  $("levels").appendChild(btn);
}

document.addEventListener("keydown", (e) => {
  if (!state || state.over || !$("title").hidden) return;
  const k = e.key.toLowerCase();
  if (k === "p" || k === " ") { e.preventDefault(); setPaused(!paused); }
  else if (paused) return;
  else if (k === "f") setSpeed(speed % 3 + 1);
  else if (k === "m") toggleSound();
  else if (k === "b") select("beacon");
  else if (k === "escape") select(null);
  else if (k >= "1" && k <= "4") { setPower(POWER_ORDER[Number(k) - 1]); renderPanel(true); }
  else if ((k === "+" || k === "=") && typeof selected === "number") { hire(selected); renderPanel(true); }
  else if ((k === "-" || k === "_") && typeof selected === "number") { fire(selected); renderPanel(true); }
});

// pause by itself when you switch tabs
document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });

// ---------- the main loop ----------

let last = performance.now();
let panelTimer = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  animTime += dt;
  if (state && !state.over && !paused && $("title").hidden) {
    let s = dt * speed;
    while (s > 0 && !state.over) {
      const step = Math.min(s, 0.05);
      update(step);
      s -= step;
    }
    torchTimer -= dt;
    for (const f of floaters) { f.y -= 22 * dt; f.life -= dt; }
    floaters = floaters.filter((f) => f.life > 0);
  }
  draw(dt);
  updateHud();
  panelTimer -= dt;
  if (panelTimer <= 0) { panelTimer = 0.25; renderPanel(); }
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
