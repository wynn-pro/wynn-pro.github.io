// Castle Defense: the web version of defence.py.
// Everything runs in the browser: no server, no downloads, so it works on GitHub Pages.
"use strict";

const WIDTH = 600;
const HEIGHT = 400;
const CASTLE_X = WIDTH - 60;

const BOSS_HEALTH = 12;
const BOSS_WAVE = 5;          // every 5th wave ends with an armored car
const MEGA_BOSS_WAVE = 2;     // every 2nd wave ends with the giant heavy tank
const MEGA_BOSS_HEALTH = 60;
const MEGA_BOSS_DAMAGE = 10;  // castle health lost if the heavy tank gets through (a third of the castle!)
const GIANT_BOSS_WAVE = 3;    // every 3rd wave ends with the giant boss tank
const GIANT_BOSS_HEALTH = 90000;
const GIANT_BOSS_DAMAGE = 30; // castle health lost if the giant boss gets through (the whole castle!)
const TITAN_WAVE = 6;         // every 6th wave, the giant GIANT boss comes instead of the giant boss
const TITAN_HEALTH = 900000;  // it acts like the giant boss, only bigger: a Golem needs 3 hits, a Mech 20
// enemies shoot back at your soldiers:
// damage per shot, ticks between shots, how far they can shoot, shot speed, shot size and color
const ENEMY_GUNS = {
  normal:   { damage: 1, reload: 40, range: 220, speed: 14, size: 2, color: "yellow" },
  tough:    { damage: 2, reload: 40, range: 220, speed: 14, size: 2, color: "orange" },
  boss:     { damage: 6, reload: 50, range: 350, speed: 11, size: 4, color: "orange" },
  megaboss: { damage: 15, reload: 60, range: 450, speed: 10, size: 5, color: "orangered" },
  // each giant boss shell takes 150,000 health: more than a whole mech
  giant:    { damage: 150000, reload: 60, range: 2000, speed: 10, size: 6, color: "red" },
  titan:    { damage: 250000, reload: 70, range: 2000, speed: 10, size: 9, color: "magenta" },
};
const CASTLE_HEALTH = 30;     // the castle starts with 30 health
const HARD_WAVE = 5;          // from wave 5 on...
const HARD_HEALTH = 10;       // ...every enemy (except the giant boss) has 10 times more health

const BOSS_DAMAGE = 5;        // castle health lost if an armored car gets through

const SLOW_FACTOR = 0.4;      // enemies in tear gas move at 40% of their normal speed
const POISON_TICK = 20;       // a poisoned enemy loses 1 health every 20 ticks (1 second)

const CLOUD_EVERY = 400;      // a gas grenadier launches a big cloud every 400 ticks (20 seconds)
const CLOUD_LIFE = 100;       // a big cloud stays for 100 ticks (5 seconds)
const CLOUD_RADIUS = 90;      // how big the big cloud is
const CLOUD_POISON = 30;      // poison time given to enemies inside a toxic cloud

// real physics: everything that flies is pulled down by gravity
const GRAVITY = 0.25;         // pixels per tick, added to the falling speed every tick
const CORPSE_LIFE = 160;      // a fallen enemy lies on the ground for 8 seconds
const STUCK_LIFE = 120;       // an arrow stuck in the ground stays for 6 seconds

const MAX_SOLDIERS = 10;      // you can have at most 10 soldiers at once
const UPGRADE_COST = 20;      // each weapon upgrade costs $20...
const MAX_WEAPON_LEVEL = 5;   // ...and adds +1 damage to every shot, up to level 5
const ARMOR_COST = 30;        // castle armor costs $30...
const ARMOR_PACK = 5;         // ...for 5 armor points; each point blocks 1 damage to the castle
const MAX_ARMOR = 20;
const AMMO_PACK = 5;          // the ammo button buys 5 sniper bullets...
const AMMO_COST = 5;          // ...for $5
// with 2 or more mechs, one of them can walk the battlefield picking up coins instead of shooting
const COLLECTOR_SPEED = 3;           // pixels per tick
const COLLECTOR_REACH = 22;          // how close it has to get to grab a coin
const COLLECTOR_ARMOR_PACK = 20000;  // the Mech armor button buys 20,000 armor points...
const COLLECTOR_ARMOR_COST = 50;     // ...for $50
const COLLECTOR_ARMOR_MAX = 200000;  // enough to survive one giant boss shell (150,000)
const GOLEM_MIN = 3;          // you need at least 3 soldiers to combine them into a golem
const GOLEM_BONUS = 60000;    // every soldier that joins the golem adds its own health plus 60,000

const SKIN = "#e0b48a";
const SHADOW = "#3f6e2b";

// Each soldier type has its own stats.
// weapon: "bullet" flies straight and fast, "arrow" and "grenade" are lobbed in an arc,
// "shell" flies straight and explodes. spread is how much the soldier's aim wobbles.
// muzzle is how far the weapon sticks out in front of the soldier's front hand.
const SOLDIER_TYPES = {
  "strong": { health: 30, name: "Rifleman", cost: 35, damage: 2, reload: 12, range: 320, color: "olivedrab",
              weapon: "bullet", speed: 26, spread: 0.02, muzzle: 22, shot: "gold" },
  // the ragdoll archer has a floppy, wobbly body and lobs real arrows that can miss
  "archer": { health: 25, name: "Archer", cost: 40, damage: 3, reload: 24, range: 400, color: "forestgreen",
              weapon: "arrow", arc: 0.6, spread: 0.025, muzzle: 6, shot: "saddlebrown" },
  // the gas grenadier lobs a canister that poisons every enemy near where it lands for 100 ticks
  "poison": { health: 25, name: "Gas grenadier", cost: 45, damage: 0, poison: 100, blast: 40, reload: 25, range: 300,
              color: "#c9b02a", weapon: "grenade", arc: 0.9, spread: 0.03, muzzle: 14, shot: "chartreuse" },
  // tear gas does no damage: it slows every enemy near where the canister lands for 60 ticks (3 seconds)
  "freezer": { health: 25, name: "Tear gas", cost: 50, damage: 0, freeze: 60, blast: 80, reload: 20, range: 300,
               color: "slategray", weapon: "grenade", arc: 0.9, spread: 0.03, muzzle: 14, shot: "white" },
  // the sniper comes with 5 bullets and stops shooting when they run out
  "boss killer": { health: 20, name: "Sniper", cost: 70, damage: BOSS_HEALTH, reload: 40, range: 450, color: "#3b4a2f",
                   weapon: "bullet", speed: 40, spread: 0.004, muzzle: 36, shot: "white", ammo: 5 },
  // the mech is a giant walking robot: its cannon shell takes half of the giant boss's health (2 hits kill it)
  "mech": { name: "Mech", cost: 200, damage: 20, giantHalf: true, health: 9000, blast: 50, reload: 40,
            range: 520, color: "#5b6b7a", weapon: "shell", speed: 20, spread: 0.008, shot: "cyan" },
  // the golem is every soldier combined into one giant stone giant (see combineSoldiers): it can't be bought.
  // Its boulder smashes the giant boss in one hit and takes half of a heavy tank's health.
  "golem": { name: "Golem", cost: 0, damage: 40, megaHalf: true, giantKill: true, health: 1, blast: 70, reload: 45,
             range: 600, color: "#7d7466", weapon: "shell", speed: 16, spread: 0.01, shot: "#5e554a" },
};
// the mech is bought with its own button at the top right
const SHOP_ORDER = ["strong", "archer", "poison", "freezer", "boss killer"];

// enemy foot soldiers: uniform color and helmet color
const ENEMY_LOOK = {
  normal: { uniform: "#6b2b2b", helmet: "#3b3b3b" },
  tough: { uniform: "#4a4a4a", helmet: "#2b2b2b" },
};

// the title screen lets you pick one of these
const DIFFICULTIES = {
  Easy: { castle: 40, monsters: 0.7, speed: 0.8, money: 60 },
  Medium: { castle: 30, monsters: 1.0, speed: 1.0, money: 0 },
  Hard: { castle: 20, monsters: 1.4, speed: 1.2, money: 0 },
};

let difficulty = DIFFICULTIES.Medium;
let maxCastleHealth = CASTLE_HEALTH;
let castleHealth = CASTLE_HEALTH;
let score = 0;
let money = 0;
let playing = false;
let paused = false;
let sellMode = false;
let deleteMode = false;   // like sell mode, but the soldier is just removed with no money back
let collectMode = false;  // the next mech you click becomes the coin collector
let monsterSpeedUp = 1;   // the Speed button cycles this through 1, 2 and 3
let weaponLevel = 0;      // how many weapon upgrades you have bought this game
let castleArmor = 0;      // armor points left on the castle
let wave = 0;
let waveTotal = 0;        // how many enemies this wave has
let waveSpawned = 0;      // how many have appeared so far

// each enemy is {x, y, health, max, speed, slowed, poison, kind, push, step, gunTime, carried}
let monsters = [];
// each soldier is {x, y, reload, kind, cloudTime, ragdoll, recoil, ammo (null = never runs out), health,
//                   collector, returning, homeX, homeY, armor}; the last five are only used by mechs
let soldiers = [];
let projectiles = [];   // bullets, arrows, grenades and shells that are flying right now
let enemyShells = [];   // enemy shots flying at your soldiers
let clouds = [];        // each gas cloud is {x, y, life, kind: "toxic" or "tear", radius}
let particles = [];     // smoke, fire, dust, flashes and flying debris
let corpses = [];       // fallen enemies (floppy ragdolls) and burning wrecks
let coins = [];         // coins dropped by dead enemies: click one to turn it into money
let stuck = [];         // arrows that missed and stuck in the ground
let floaters = [];      // floating "+$50" words that rise and fade: {x, y, words, color, life}
let lastCastleHealth = CASTLE_HEALTH;   // so the screen can flash when the castle loses health

// Positions use the ground: x goes toward the castle, y is how far down the field,
// and z is how high something is above the ground. On screen it is drawn at (x, y - z).

// ragdoll soldiers: every body part is [offset_x, offset_y, speed_x, speed_y] and is
// pulled back to its resting spot by a spring, so the whole body wobbles and flops
const RAGDOLL_REST = {
  head: [-1, -17], bowHand: [-18, -4], stringHand: [-6, -4],
  leftFoot: [-6, 22], rightFoot: [6, 22], hip: [0, 10],
};
const SPRING = 0.22;   // how hard a body part is pulled back to its resting spot
const DAMPING = 0.12;  // how quickly the wobbling dies down

// fallen enemies are real ragdolls: points joined by bones of fixed length, falling under gravity
const CORPSE_POINTS = {
  head: [1, 38], shoulder: [0, 30], hip: [0, 17],
  handL: [-7, 19], handR: [9, 24], footL: [-4, 0], footR: [4, 0],
};
const CORPSE_BONES = [["head", "shoulder"], ["shoulder", "hip"], ["shoulder", "handL"],
                      ["shoulder", "handR"], ["hip", "footL"], ["hip", "footR"]];

// ---------- small helpers ----------

function uniform(a, b) {
  return a + Math.random() * (b - a);
}

function randint(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function gauss(spread) {
  // a bell-curve random number: usually close to 0, now and then further away
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * spread;
}

function seededRandom(seed) {
  // the same seed always gives the same numbers, so the background looks the same every time
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random: next,
    uniform: (lo, hi) => lo + next() * (hi - lo),
    randint: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    choice: (list) => list[Math.floor(next() * list.length)],
  };
}

// ---------- sound (made by the browser, no sound files needed) ----------

let audio = null;
let soundOn = true;

function startAudio() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      audio = null;
    }
  }
  if (audio && audio.state === "suspended") {
    audio.resume();
  }
}

function tone(startFreq, endFreq, duration, type, volume, delay = 0) {
  if (!audio || !soundOn) {
    return;
  }
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, start);
  osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration);
}

// one death sound per enemy type
const KILL_SOUNDS = {
  normal: () => tone(700, 250, 0.09, "sine", 0.12),
  tough: () => tone(420, 380, 0.18, "triangle", 0.15),
  boss: () => {
    tone(523, 523, 0.15, "square", 0.06);
    tone(659, 659, 0.15, "square", 0.06, 0.12);
    tone(784, 784, 0.3, "square", 0.06, 0.24);
  },
  megaboss: () => tone(140, 35, 0.9, "sawtooth", 0.18),
  giant: () => {
    tone(110, 25, 1.4, "sawtooth", 0.2);
    tone(220, 60, 1.0, "square", 0.08, 0.1);
  },
};
KILL_SOUNDS.titan = KILL_SOUNDS.giant;

function buySound() {
  tone(520, 780, 0.07, "square", 0.05);
  tone(780, 1040, 0.08, "square", 0.04, 0.05);
}

function deniedSound() {
  tone(180, 120, 0.12, "square", 0.06);
}

function coinSound() {
  tone(1200, 1800, 0.08, "sine", 0.1);
  tone(1800, 2400, 0.1, "sine", 0.08, 0.06);
}

function soldierDiedSound(kind) {
  if (kind === "mech" || kind === "golem") {
    tone(90, 30, 1.0, "sawtooth", 0.2);
  } else {
    tone(900, 500, 0.12, "triangle", 0.1);
  }
}

// ---------- the soldiers' wobbly ragdolls ----------

function newRagdoll() {
  const ragdoll = {};
  for (const [name, [rx, ry]] of Object.entries(RAGDOLL_REST)) {
    ragdoll[name] = [rx, ry, 0, 0];
  }
  return ragdoll;
}

function updateRagdolls() {
  for (const s of soldiers) {
    if (s.recoil > 0) {
      s.recoil -= 1;   // the mech's cannon slides back into place
    }
    if (!s.ragdoll) {
      continue;
    }
    for (const [name, part] of Object.entries(s.ragdoll)) {
      const [rx, ry] = RAGDOLL_REST[name];
      part[2] += -SPRING * (part[0] - rx) - DAMPING * part[2] + uniform(-0.12, 0.12);
      part[3] += -SPRING * (part[1] - ry) - DAMPING * part[3] + uniform(-0.12, 0.12) + 0.05;   // a bit of gravity
      part[0] += part[2];
      part[1] += part[3];
    }
  }
}

function kickRagdoll(ragdoll) {
  // shooting makes the soldier recoil: the back hand flies back, the head snaps, the feet hop
  ragdoll.stringHand[2] += 7;
  ragdoll.bowHand[2] += 3;
  ragdoll.head[2] += 3;
  ragdoll.head[3] -= 2;
  ragdoll.hip[2] += 2;
  ragdoll.leftFoot[3] -= 3;
  ragdoll.rightFoot[3] -= 3;
}

// ---------- starting, resetting and the info line ----------

function clearBattlefield() {
  monsters = [];
  soldiers = [];
  projectiles = [];
  enemyShells = [];
  clouds = [];
  particles = [];
  corpses = [];
  coins = [];
  stuck = [];
  floaters = [];
}

function startGame(level) {
  startAudio();
  difficulty = DIFFICULTIES[level];
  weaponLevel = 0;
  castleArmor = 0;
  maxCastleHealth = difficulty.castle;
  castleHealth = maxCastleHealth;
  lastCastleHealth = castleHealth;
  score = 0;
  money = difficulty.money;
  playing = true;
  setPaused(false);
  clearBattlefield();
  wave = 0;
  startWave();
  titleBox.hidden = true;
  lastEntry = null;
  pendingScore = null;   // starting again without writing a name skips the leaderboard
  if (sellMode) {
    toggleSellMode();
  }
  if (deleteMode) {
    toggleDeleteMode();
  }
  if (collectMode) {
    toggleCollectMode();
  }
  updateInfo();
}

function resetGame() {
  // stop the current game and go back to the title screen
  playing = false;
  setPaused(false);
  weaponLevel = 0;
  castleArmor = 0;
  wave = 0;
  score = 0;
  castleHealth = maxCastleHealth;
  clearBattlefield();
  if (sellMode) {
    toggleSellMode();
  }
  if (deleteMode) {
    toggleDeleteMode();
  }
  if (collectMode) {
    toggleCollectMode();
  }
  showTitle("Choose your difficulty");
  money = 0;
  updateInfo();
}

function setText(el, words) {
  // updateInfo runs 20 times a second, so only touch the page when something changed
  if (el.textContent !== words) {
    el.textContent = words;
  }
}

function setLocked(el, locked) {
  // locked buttons still take clicks, so they can say why you can't buy yet
  el.classList.toggle("locked", locked);
  el.setAttribute("aria-disabled", locked ? "true" : "false");
}

function updateMoney() {
  if (moneyText.textContent !== "$" + money) {
    moneyText.textContent = "$" + money;
    bump(moneyText);
  }
  const full = soldiers.length >= MAX_SOLDIERS;
  for (const [kind, card] of Object.entries(buyButtons)) {
    const cost = SOLDIER_TYPES[kind].cost;
    setLocked(card, !playing || money < cost || full);
    card.classList.toggle("short", playing && money < cost);
    setText(card.badge, playing && full ? "ARMY FULL" : "");
  }
  const hasSniper = soldiers.some((s) => s.ammo !== null);
  setLocked(ammoButton, !playing || money < AMMO_COST || !hasSniper);
  const maxed = weaponLevel >= MAX_WEAPON_LEVEL;
  setText(upgradeButton.label, maxed ? "Weapons maxed" : "Weapons Lv " + (weaponLevel + 1));
  setText(upgradeButton.price, maxed ? "" : "$" + UPGRADE_COST);
  setLocked(upgradeButton, !playing || money < UPGRADE_COST || maxed);
  setLocked(armorButton, !playing || money < ARMOR_COST || castleArmor >= MAX_ARMOR);
  // the collector buttons only show up once they can be used
  const collector = soldiers.find((s) => s.collector);
  collectorButton.hidden = !collectMode && !collector && mechCount() < 2;
  collectorButton.classList.toggle("ready", playing && !collector && mechCount() >= 2 && !collectMode);
  collectorArmorButton.hidden = !collector;
  const golem = soldiers.some((s) => s.kind === "golem");
  const canCombine = soldiers.length >= GOLEM_MIN || (golem && soldiers.length >= 2);
  setLocked(combineButton, !playing || !canCombine);
  if (!combineArmedAt) {
    setText(combineButton.label, golem ? "🗿 Add to Golem" : "🗿 Combine");
  }
  combineButton.classList.toggle("ready", playing && canCombine && !!strongestBoss() && isGiant(strongestBoss()));
  setLocked(collectorArmorButton, !collector || money < COLLECTOR_ARMOR_COST || collector.armor >= COLLECTOR_ARMOR_MAX);
}

function strongestBoss() {
  // the boss bar shows the biggest boss on the field
  const rank = { titan: 4, giant: 3, megaboss: 2, boss: 1 };
  let best = null;
  for (const m of monsters) {
    if (rank[m.kind] && (!best || rank[m.kind] > rank[best.kind])) {
      best = m;
    }
  }
  return best;
}

function updateInfo() {
  setText(waveText, String(wave));
  setText(scoreText, score.toLocaleString());
  const health = Math.max(castleHealth, 0);
  setText(castleText, health + " / " + maxCastleHealth);
  castleFill.style.width = (100 * health / maxCastleHealth) + "%";
  castleStat.classList.toggle("hurt", health <= maxCastleHealth * 0.6);
  castleStat.classList.toggle("danger", health <= maxCastleHealth * 0.3);
  setText(armorText, "🛡 " + castleArmor);
  setText(armyText, soldiers.length + "/" + MAX_SOLDIERS);
  setText(weaponsText, "Lv " + weaponLevel);
  if (playing && castleHealth < lastCastleHealth) {
    replay(stage, "hit");
  }
  lastCastleHealth = castleHealth;

  const boss = playing ? strongestBoss() : null;
  bossBox.hidden = !boss;
  if (boss) {
    setText(bossName, { titan: "GIANT GIANT BOSS", giant: "GIANT BOSS", megaboss: "HEAVY TANK", boss: "ARMORED CAR" }[boss.kind]);
    bossFill.style.width = (100 * Math.max(boss.health, 0) / boss.max) + "%";
    setText(bossHp, Math.max(boss.health, 0).toLocaleString() + " / " + boss.max.toLocaleString());
  }
  // while the giant boss is out, make the Mech card glow so you know what to buy
  mechButton.classList.toggle("callout", !!boss && isGiant(boss));
  updateMoney();
}

// ---------- enemies ----------

function isMega(m) {
  return m.kind === "megaboss";
}

function isGiant(m) {
  return m.kind === "giant" || m.kind === "titan";   // the giant giant boss does everything the giant boss does
}

function isBoss(m) {
  return m.kind === "boss" || isMega(m) || isGiant(m);
}

function isTough(m) {
  return m.kind === "tough";
}

function monsterSize(m) {
  if (m.kind === "titan") return 200;
  if (isGiant(m)) return 150;
  if (isMega(m)) return 100;
  if (isBoss(m)) return 55;
  if (isTough(m)) return 30;
  return 20;
}

function monsterHeight(m) {
  return { normal: 38, tough: 54, boss: 64, megaboss: 104, giant: 156, titan: 208 }[m.kind];
}

function monsterHalfWidth(m) {
  return { normal: 11, tough: 16, boss: 50, megaboss: 95, giant: 143, titan: 190 }[m.kind];
}

function groundY(m) {
  // m.y is the middle of the enemy's body, so its feet are half its height lower
  return m.y + monsterHeight(m) / 2;
}

function monsterSpeed(m) {
  let speed = m.speed * monsterSpeedUp;
  if (m.slowed > 0) {
    speed *= SLOW_FACTOR;
  }
  return speed;
}

function buySoldier(kind) {
  const cost = SOLDIER_TYPES[kind].cost;
  if (!playing) {
    return;
  }
  if (soldiers.length >= MAX_SOLDIERS) {
    // the army is full: sell a soldier to make room
    denied(buyButtons[kind], "Army is full (" + MAX_SOLDIERS + "/" + MAX_SOLDIERS + "). Sell a soldier to make room.");
    return;
  }
  if (money < cost) {
    denied(buyButtons[kind], "Need $" + (cost - money) + " more for a " + SOLDIER_TYPES[kind].name + ".");
    return;
  }
  {
    money -= cost;
    const y = 30 + (soldiers.length * 60) % (HEIGHT - 60);
    soldiers.push({ x: CASTLE_X - 40, y, reload: 0, kind, cloudTime: CLOUD_EVERY,
                    ragdoll: kind === "mech" ? null : newRagdoll(), recoil: 0,
                    ammo: SOLDIER_TYPES[kind].ammo ?? null, health: SOLDIER_TYPES[kind].health,
                    collector: false, returning: false, homeX: CASTLE_X - 40, homeY: y, armor: 0 });
    buySound();
    if (kind === "mech" && mechCount() === 2) {
      toast("2 Mechs! Press Collector (C) and click one to send it collecting coins", "good");
    }
    updateInfo();
  }
}

function buyUpgrade() {
  // better weapons: every soldier that does damage does 1 more per shot
  if (!playing || weaponLevel >= MAX_WEAPON_LEVEL) {
    return;
  }
  if (money < UPGRADE_COST) {
    denied(upgradeButton, "Need $" + (UPGRADE_COST - money) + " more to upgrade weapons.");
    return;
  }
  money -= UPGRADE_COST;
  weaponLevel += 1;
  buySound();
  toast("Weapons upgraded to level " + weaponLevel + ": +1 damage on every shot", "good");
  updateInfo();
}

function buyArmor() {
  // steel plates for the castle walls
  if (!playing) {
    return;
  }
  if (castleArmor >= MAX_ARMOR) {
    denied(armorButton, "The castle already has the most armor (" + MAX_ARMOR + ").");
    return;
  }
  if (money < ARMOR_COST) {
    denied(armorButton, "Need $" + (ARMOR_COST - money) + " more for armor.");
    return;
  }
  money -= ARMOR_COST;
  castleArmor = Math.min(castleArmor + ARMOR_PACK, MAX_ARMOR);
  buySound();
  updateInfo();
}

function damageCastle(damage) {
  // armor soaks up hits before the castle walls do
  const blocked = Math.min(castleArmor, damage);
  castleArmor -= blocked;
  castleHealth -= damage - blocked;
}

function shotDamage(stats) {
  return stats.damage > 0 ? stats.damage + weaponLevel : 0;
}

function buyCollectorArmor() {
  // armor plates for the collecting mech: armor is used up before its health
  const collector = soldiers.find((s) => s.collector);
  if (!playing || !collector) {
    return;
  }
  if (collector.armor >= COLLECTOR_ARMOR_MAX) {
    denied(collectorArmorButton, "The collector already has the most armor (" + COLLECTOR_ARMOR_MAX.toLocaleString() + ").");
    return;
  }
  if (money < COLLECTOR_ARMOR_COST) {
    denied(collectorArmorButton, "Need $" + (COLLECTOR_ARMOR_COST - money) + " more for Mech armor.");
    return;
  }
  money -= COLLECTOR_ARMOR_COST;
  collector.armor = Math.min(collector.armor + COLLECTOR_ARMOR_PACK, COLLECTOR_ARMOR_MAX);
  buySound();
  updateInfo();
}

function buyAmmo() {
  // 5 more bullets for the sniper who has the fewest left
  const snipers = soldiers.filter((s) => s.ammo !== null);
  if (!playing) {
    return;
  }
  if (snipers.length === 0) {
    denied(ammoButton, "Recruit a Sniper first: ammo is for snipers.");
    return;
  }
  if (money < AMMO_COST) {
    denied(ammoButton, "Need $" + (AMMO_COST - money) + " more for ammo.");
    return;
  }
  {
    money -= AMMO_COST;
    buySound();
    const neediest = snipers.reduce((a, b) => (b.ammo < a.ammo ? b : a));
    neediest.ammo += AMMO_PACK;
    updateInfo();
  }
}

function startWave() {
  // every wave has more enemies than the one before
  wave += 1;
  waveTotal = Math.round((5 + 3 * wave) * difficulty.monsters);
  waveSpawned = 0;
  // the same order spawnMonster uses to pick the boss at the end of the wave
  if (wave % TITAN_WAVE === 0) {
    showBanner("WAVE " + wave, "The GIANT GIANT BOSS is coming: 900,000 health! Build a Golem!", true);
  } else if (wave % GIANT_BOSS_WAVE === 0) {
    showBanner("WAVE " + wave, "A GIANT BOSS is coming. Only a Mech can stop it!", true);
  } else if (wave % MEGA_BOSS_WAVE === 0) {
    showBanner("WAVE " + wave, "A heavy tank ends this wave", true);
  } else if (wave % BOSS_WAVE === 0) {
    showBanner("WAVE " + wave, "An armored car ends this wave", true);
  } else if (wave === HARD_WAVE) {
    showBanner("WAVE " + wave, "Enemies now have " + HARD_HEALTH + "× health!", true);
  } else {
    showBanner("WAVE " + wave, waveTotal + " enemies incoming");
  }
}

function addMonster(y, health, speed, kind) {
  if (wave >= HARD_WAVE && !["giant", "titan"].includes(kind)) {
    health *= HARD_HEALTH;   // the giant boss stays the same: a Mech still kills it in 2 hits
  }
  // gunTime is random so enemies do not all shoot at once; carried holds the coins it has picked up
  monsters.push({ x: 0, y, health, max: health, speed, slowed: 0, poison: 0, kind, push: 0, step: uniform(0, 6),
                  gunTime: randint(10, ENEMY_GUNS[kind].reload), carried: [] });
}

function spawnMonster() {
  // runs once per second
  if (!playing || paused) {
    return;
  }
  if (waveSpawned >= waveTotal) {
    // wave is fully spawned: once every enemy is dead, get a bonus and the next wave starts right away
    if (monsters.length === 0) {
      money += 10 * wave;
      toast("Wave " + wave + " cleared! +$" + 10 * wave + " bonus", "good");
      startWave();
      updateInfo();
    }
    return;
  }
  waveSpawned += 1;
  const y = randint(60, HEIGHT - 60);
  const speed = Math.min(3 + 0.25 * (wave - 1), 6) * difficulty.speed;   // enemies get faster
  const toughChance = Math.min(0.08 * wave, 0.6);                        // and more of them are armored
  if (wave % TITAN_WAVE === 0 && waveSpawned === waveTotal) {
    // the giant giant boss: even bigger and slower than the giant boss
    addMonster(HEIGHT / 2, TITAN_HEALTH, 0.3, "titan");
  } else if (wave % GIANT_BOSS_WAVE === 0 && waveSpawned === waveTotal) {
    // the giant boss is huge and very slow, but almost impossible to destroy
    addMonster(HEIGHT / 2, GIANT_BOSS_HEALTH, 0.4, "giant");
  } else if (wave % MEGA_BOSS_WAVE === 0 && waveSpawned === waveTotal) {
    // the heavy tank is so big it drives down the middle of the field
    const health = MEGA_BOSS_HEALTH + 10 * (Math.floor(wave / MEGA_BOSS_WAVE) - 1);   // later ones are even tougher
    addMonster(HEIGHT / 2, health, 0.8, "megaboss");
  } else if (wave % BOSS_WAVE === 0 && waveSpawned === waveTotal) {
    const health = BOSS_HEALTH + 4 * (Math.floor(wave / BOSS_WAVE) - 1);   // later armored cars have more health
    addMonster(y, health, 1.5 + 0.1 * Math.floor(wave / BOSS_WAVE), "boss");
  } else if (Math.random() < toughChance) {
    addMonster(y, 2 + Math.floor((wave - 1) / 2), speed, "tough");
  } else {
    addMonster(y, 1 + Math.floor((wave - 1) / 3), speed, "normal");
  }
}

function isAlive(m) {
  return monsters.includes(m);
}

function hitMonster(m, damage, pushX = 0, pushZ = 0) {
  // pushX and pushZ are how hard the hit shoves the enemy (and its ragdoll if it dies)
  if (!isAlive(m)) {
    return;   // two shots hit at once and the first one already killed it
  }
  m.health -= damage;
  if (isBoss(m)) {
    for (let i = 0; i < 3; i++) {
      addParticle("fire", m.x, groundY(m), monsterHeight(m) / 2, uniform(-2, 2), 0, uniform(1, 3), 6, 3);
    }
  } else {
    m.push += pushX * 0.12 * 20 / monsterSize(m);   // knocked back a little
    addParticle("dust", m.x, groundY(m), monsterHeight(m) / 2, 0, 0, 0.3, 10, 3);
  }
  if (m.health <= 0) {
    monsters = monsters.filter((other) => other !== m);
    let value = 5;
    if (m.kind === "titan") {
      score += 2000;
      value = 10000;
    } else if (isGiant(m)) {
      score += 500;
      value = 2000;
    } else if (isMega(m)) {
      score += 50;
      value = 250;
    } else if (isBoss(m)) {
      score += 10;
      value = 50;
    } else {
      score += 1;
    }
    // it drops its own coin plus every coin it picked up
    for (const v of [value, ...m.carried]) {
      dropCoin(m.x + uniform(-12, 12), groundY(m) + uniform(-6, 6), v);
    }
    if (isBoss(m)) {
      blowUpVehicle(m);
    } else {
      corpses.push(newCorpse(m, pushX, pushZ));
    }
    KILL_SOUNDS[m.kind]();
  }
}

function distanceTo(s, m) {
  return Math.hypot(s.x - m.x, s.y - m.y);
}

function findClosest(s, stats, skip = null) {
  // skip: skip enemies that already have that effect ("slowed" or "poison")
  let target = null;
  let best = stats.range;
  for (const m of monsters) {
    if (skip && m[skip] > 0) {
      continue;
    }
    const distance = distanceTo(s, m);
    if (distance < best) {
      best = distance;
      target = m;
    }
  }
  return target;
}

// ---------- real physics: aiming and flying ----------

function muzzle(s) {
  // where the shot leaves the weapon, as [x, ground_y, height]
  if (s.kind === "mech") {
    return [s.x - 44, s.y + 22, 44];
  }
  if (s.kind === "golem") {
    return [s.x - 40, s.y + 22, 100];   // the boulder is thrown from above its head
  }
  const hand = s.ragdoll.bowHand;
  return [s.x + hand[0] - SOLDIER_TYPES[s.kind].muzzle, s.y + 22, 22 - hand[1]];
}

function aim(sx, sy, sz, target, stats) {
  // lead the target: guess the flight time, see where the enemy will be by then, and repeat
  const tz = stats.weapon === "grenade" ? 0 : monsterHeight(target) * 0.5;
  const ty = groundY(target);
  let flightTime = 0;
  let dx = 0;
  let dy = 0;
  let flatSpeed = 0;
  let vz = 0;
  for (let i = 0; i < 4; i++) {
    const tx = Math.min(target.x + monsterSpeed(target) * flightTime, CASTLE_X);
    dx = tx - sx;
    dy = ty - sy;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    if (stats.arc) {
      // lobbed at a fixed angle: work out how long it must fly to come down on the target
      const lift = distance * Math.tan(stats.arc) + sz - tz;
      flightTime = Math.sqrt(2 * Math.max(lift, 1) / GRAVITY);
      flatSpeed = distance / flightTime;
      vz = flatSpeed * Math.tan(stats.arc);
    } else {
      flightTime = distance / stats.speed;
      flatSpeed = stats.speed;
      vz = (tz - sz) / flightTime;
    }
  }
  // nobody aims perfectly: add a little random error, so shots can really miss
  const angle = Math.atan2(dy, dx) + gauss(stats.spread);
  flatSpeed *= 1 + gauss(stats.spread);
  vz += gauss(stats.spread) * flatSpeed * 0.5;
  return [flatSpeed * Math.cos(angle), flatSpeed * Math.sin(angle), vz];
}

function fire(s, stats, target, big = false) {
  const [x, y, z] = muzzle(s);
  const [vx, vy, vz] = aim(x, y, z, target, stats);
  projectiles.push({ x, y, z, vx, vy, vz, g: stats.arc ? GRAVITY : 0, kind: s.kind, big, age: 0, done: false });
  if (s.ragdoll) {
    kickRagdoll(s.ragdoll);
  } else {
    s.recoil = 8;   // the mech's cannon kicks back
  }
  if (stats.weapon === "bullet" || stats.weapon === "shell") {
    addParticle("flash", x, y, z, 0, 0, 0, 2, stats.weapon === "shell" ? 8 : 5);
    addParticle("smoke", x, y, z, uniform(-0.5, 0), 0, 0.4, 20, 3);
  }
}

function projectileHits(p) {
  for (const m of monsters) {
    if (Math.abs(p.x - m.x) < monsterHalfWidth(m)
        && Math.abs(p.y - groundY(m)) < 10 + monsterHalfWidth(m) * 0.3
        && p.z >= 0 && p.z <= monsterHeight(m)) {
      return m;
    }
  }
  return null;
}

function updateProjectiles() {
  for (const p of projectiles) {
    const stats = SOLDIER_TYPES[p.kind];
    p.age += 1;
    // fast things move in small steps so they cannot jump through an enemy
    const steps = Math.floor(Math.hypot(p.vx, p.vy) / 6) + 1;
    for (let i = 0; i < steps; i++) {
      p.x += p.vx / steps;
      p.y += p.vy / steps;
      p.z += p.vz / steps;
      p.vz -= p.g / steps;
      const target = stats.weapon === "grenade" ? null : projectileHits(p);
      if (target || p.z <= 0) {
        land(p, stats, target);
        p.done = true;
        break;
      }
    }
    if (p.x < -30 || p.x > WIDTH || p.y < -30 || p.y > HEIGHT + 30 || p.age > 150) {
      p.done = true;
    }
  }
  projectiles = projectiles.filter((p) => !p.done);
}

function land(p, stats, target) {
  const z = Math.max(p.z, 0);
  if (stats.weapon === "shell") {
    explode(p.x, p.y, z, stats.blast, shotDamage(stats), Boolean(stats.megaHalf), Boolean(stats.giantHalf),
            Boolean(stats.giantKill));
  } else if (stats.weapon === "grenade") {
    gasBurst(p, stats);
  } else if (target) {
    hitMonster(target, shotDamage(stats), p.vx, p.vz);
  } else if (stats.weapon === "arrow") {
    stuck.push({ x: p.x, y: p.y, vx: p.vx, vz: p.vz, life: STUCK_LIFE });
  } else {
    addParticle("dust", p.x, p.y, 0, 0, 0, 0.3, 14, 3);   // the bullet kicks up dirt
  }
}

function gasBurst(p, stats) {
  const kind = stats.poison ? "toxic" : "tear";
  addParticle("dust", p.x, p.y, 0, 0, 0, 0.5, 12, 5);
  if (p.big) {
    clouds.push({ x: p.x, y: p.y, life: CLOUD_LIFE, kind: "toxic", radius: CLOUD_RADIUS });
    return;
  }
  for (const m of monsters) {
    if (Math.hypot(m.x - p.x, groundY(m) - p.y) < stats.blast + monsterHalfWidth(m)) {
      if (kind === "toxic") {
        m.poison = Math.max(m.poison, stats.poison);
      } else {
        m.slowed = Math.max(m.slowed, stats.freeze);
      }
    }
  }
  clouds.push({ x: p.x, y: p.y, life: 30, kind, radius: stats.blast });
}

function launchClouds() {
  // every 20 seconds a gas grenadier lobs a big toxic cloud at the closest enemy
  for (const s of soldiers) {
    const stats = SOLDIER_TYPES[s.kind];
    if (stats.poison) {
      s.cloudTime -= 1;
      if (s.cloudTime <= 0) {
        const target = findClosest(s, stats);
        if (target) {
          fire(s, stats, target, true);
          s.cloudTime = CLOUD_EVERY;
        }
      }
    }
  }
}

function updateClouds() {
  for (const c of clouds) {
    c.life -= 1;
    for (const m of monsters) {
      if (Math.hypot(c.x - m.x, c.y - groundY(m)) < c.radius) {
        if (c.kind === "toxic") {
          if (m.poison <= 0) {
            m.poison = CLOUD_POISON;
          }
        } else {
          m.slowed = Math.max(m.slowed, 10);
        }
      }
    }
  }
  clouds = clouds.filter((c) => c.life > 0);
}

function soldiersShoot() {
  for (const s of soldiers) {
    if (s.collector) {
      continue;   // the collecting mech is busy picking up coins
    }
    const stats = SOLDIER_TYPES[s.kind];
    s.reload -= 1;
    if (s.reload > 0) {
      continue;
    }
    if (s.ammo !== null && s.ammo <= 0) {
      continue;   // out of ammo: buy more with the ammo button
    }
    let skip = null;
    if (stats.poison) {
      skip = "poison";   // do not waste gas on enemies that are already poisoned
    } else if (stats.freeze) {
      skip = "slowed";   // or tear gas on enemies that are already slowed
    }
    let target = findClosest(s, stats, skip);
    if (stats.giantHalf || stats.giantKill) {
      // the mech and the golem always shoot the giant boss first if they can reach it
      const giant = monsters.find((m) => isGiant(m) && distanceTo(s, m) < stats.range);
      if (giant) {
        target = giant;
      }
    }
    if (target) {
      fire(s, stats, target);
      s.reload = stats.reload;
      if (s.ammo !== null) {
        s.ammo -= 1;
      }
    }
  }
}

// ---------- explosions, smoke and fire ----------

function addParticle(kind, x, y, z, vx, vy, vz, life, size, color = "#3a3a3a") {
  particles.push({ kind, x, y, z, vx, vy, vz, life, max: life, size, color });
}

function explode(x, y, z, radius, damage = 0, megaHalf = false, giantHalf = false, giantKill = false) {
  addParticle("flash", x, y, z, 0, 0, 0, 4, radius * 0.8);
  for (let i = 0; i < Math.floor(6 + radius / 4); i++) {
    const angle = uniform(0, 2 * Math.PI);
    const speed = uniform(1, 4);
    addParticle("fire", x, y, z, Math.cos(angle) * speed, Math.sin(angle) * speed * 0.5,
                uniform(1, 4), randint(8, 16), uniform(4, 9));
    addParticle("smoke", x + uniform(-radius, radius) / 2, y + uniform(-radius, radius) / 4, z,
                uniform(-0.5, 0.5), 0, uniform(0.5, 1.2), randint(25, 45), uniform(6, 12));
  }
  for (let i = 0; i < Math.floor(radius / 5); i++) {
    addParticle("debris", x, y, z, uniform(-5, 5), uniform(-2, 2), uniform(3, 8), 40, 2);
  }
  if (damage > 0) {
    for (const m of [...monsters]) {
      if (Math.hypot(m.x - x, groundY(m) - y) < radius + monsterHalfWidth(m)) {
        let hurt = damage;
        if (megaHalf && isMega(m)) {
          hurt = Math.ceil(m.max / 2);   // half of the heavy tank's max health, rounded up
        }
        if (giantHalf && isGiant(m)) {
          // half of the giant boss's max health, rounded up; only a twentieth of the giant giant boss's
          hurt = Math.ceil(m.max / (m.kind === "titan" ? 20 : 2));
        }
        if (giantKill && isGiant(m)) {
          // the golem's boulder smashes the giant boss in one hit, and the giant giant boss in three
          hurt = m.kind === "titan" ? Math.ceil(m.max / 3) : m.health;
        }
        const away = m.x >= x ? 1 : -1;   // the blast pushes enemies away from it
        hitMonster(m, hurt, away * 6, 6);
      }
    }
  }
}

function blowUpVehicle(m) {
  const gy = groundY(m);
  explode(m.x, gy, monsterHeight(m) * 0.5, monsterHalfWidth(m));
  for (let i = 0; i < 8; i++) {
    addParticle("debris", m.x, gy, monsterHeight(m) * 0.6, uniform(-6, 6), uniform(-2, 2),
                uniform(4, 10), 60, 6, "#2e2a26");
  }
  corpses.push({ wreck: true, kind: m.kind, x: m.x, y: gy, life: CORPSE_LIFE,
                 width: monsterHalfWidth(m), height: monsterHeight(m) });
}

function updateParticles() {
  for (const q of particles) {
    q.life -= 1;
    q.x += q.vx;
    q.y += q.vy;
    q.z += q.vz;
    if (q.kind === "debris") {
      q.vz -= GRAVITY;
      if (q.z < 0) {
        // bounce, and slide to a stop on the ground
        q.z = 0;
        q.vz = -q.vz * 0.4;
        q.vx *= 0.6;
        q.vy *= 0.6;
      }
    } else if (q.kind === "smoke" || q.kind === "fire" || q.kind === "dust") {
      q.vx *= 0.95;
      q.vy *= 0.95;
    }
  }
  particles = particles.filter((q) => q.life > 0);
}

// ---------- ragdoll corpses ----------

function newCorpse(m, pushX, pushZ) {
  const k = monsterSize(m) / 20;
  const points = {};
  for (const [name, [dx, dz]] of Object.entries(CORPSE_POINTS)) {
    // the higher up the body part, the harder the hit throws it
    const share = 0.3 + dz / 38;
    const speedX = (pushX * 0.35 + uniform(-1, 1)) * share;
    const speedZ = (Math.abs(pushZ) * 0.2 + 2.5) * share + uniform(0, 1);
    const x = m.x + dx * k;
    const z = dz * k;
    points[name] = [x, z, x - speedX, z - speedZ];   // [x, z, last_x, last_z]
  }
  const bones = CORPSE_BONES.map(([a, b]) => {
    const [ax, az] = CORPSE_POINTS[a];
    const [bx, bz] = CORPSE_POINTS[b];
    return { a, b, length: Math.hypot(ax - bx, az - bz) * k };
  });
  return { kind: m.kind, y: groundY(m), points, bones, k, life: CORPSE_LIFE };
}

function updateCorpses() {
  for (const c of corpses) {
    c.life -= 1;
    if (c.wreck) {
      // the wreck keeps burning
      if (c.life % 3 === 0 && c.life > 40) {
        const x = c.x + uniform(-c.width, c.width) / 2;
        addParticle("fire", x, c.y, c.height * 0.6, 0, 0, uniform(0.8, 1.6), 12, uniform(4, 7));
        addParticle("smoke", x, c.y, c.height * 0.8, uniform(-0.3, 0.3), 0, 1, 40, 8);
      }
      continue;
    }
    // every point keeps its speed (how far it moved last tick) and gravity pulls it down
    for (const p of Object.values(c.points)) {
      const vx = (p[0] - p[2]) * 0.98;
      const vz = (p[1] - p[3]) * 0.98 - GRAVITY;
      p[2] = p[0];
      p[3] = p[1];
      p[0] += vx;
      p[1] += vz;
      if (p[1] < 0) {
        p[1] = 0;
        p[3] = 0.3 * vz;          // bounce a little
        p[2] = p[0] - vx * 0.5;   // and the ground slows it down
      }
    }
    // the bones keep the body parts the right distance apart
    for (let i = 0; i < 3; i++) {
      for (const bone of c.bones) {
        const pa = c.points[bone.a];
        const pb = c.points[bone.b];
        const dx = pb[0] - pa[0];
        const dz = pb[1] - pa[1];
        const distance = Math.hypot(dx, dz) || 0.001;
        const fix = (distance - bone.length) / distance / 2;
        pa[0] += dx * fix;
        pa[1] += dz * fix;
        pb[0] -= dx * fix;
        pb[1] -= dz * fix;
      }
    }
    for (const p of Object.values(c.points)) {
      p[1] = Math.max(p[1], 0);
    }
  }
  corpses = corpses.filter((c) => c.life > 0);
}

function gameLoop() {
  if (playing && !paused) {
    update();
  }
  drawAll();
}

function update() {
  for (const m of monsters) {
    const speed = monsterSpeed(m);
    m.x += speed + m.push;
    m.push *= 0.75;   // knockback fades away
    m.step += speed * 0.12;
    if (m.slowed > 0) {
      m.slowed -= 1;
    }
  }
  const reached = monsters.filter((m) => m.x + monsterHalfWidth(m) >= CASTLE_X - 14);
  for (const m of reached) {
    monsters = monsters.filter((other) => other !== m);
    if (isGiant(m)) {
      damageCastle(GIANT_BOSS_DAMAGE);
    } else if (isMega(m)) {
      damageCastle(MEGA_BOSS_DAMAGE);
    } else if (isBoss(m)) {
      damageCastle(BOSS_DAMAGE);
    } else {
      damageCastle(1);
    }
    addParticle("dust", CASTLE_X - 14, groundY(m), 10, -0.5, 0, 0.5, 20, 8);
  }
  // poison hurts a little every second
  for (const m of [...monsters]) {
    if (m.poison > 0) {
      m.poison -= 1;
      if (m.poison % POISON_TICK === 0) {
        hitMonster(m, 1);
      }
    }
  }
  pickUpCoins();
  moveCollectors();
  soldiersShoot();
  enemiesShoot();
  giantCrushes();
  updateEnemyShells();
  launchClouds();
  updateProjectiles();
  updateClouds();
  updateParticles();
  updateCorpses();
  for (const a of stuck) {
    a.life -= 1;
  }
  stuck = stuck.filter((a) => a.life > 0);
  for (const f of floaters) {
    f.y -= 0.8;
    f.life -= 1;
  }
  floaters = floaters.filter((f) => f.life > 0);
  updateRagdolls();
  updateInfo();
  if (castleHealth <= 0) {
    playing = false;
    monsters = [];
    gameOver();
    updateInfo();
  }
}

// ---------- enemies shoot back ----------

function enemiesShoot() {
  // every enemy shoots at the closest soldier it can reach; the giant boss goes for a mech first
  for (const m of monsters) {
    const gun = ENEMY_GUNS[m.kind];
    m.gunTime -= 1;
    if (m.gunTime > 0 || soldiers.length === 0) {
      continue;
    }
    let targets = soldiers;
    if (isGiant(m)) {
      const mechs = soldiers.filter((s) => s.kind === "mech" || s.kind === "golem");
      if (mechs.length > 0) {
        targets = mechs;
      }
    }
    const target = targets.reduce((a, b) => (distanceTo(b, m) < distanceTo(a, m) ? b : a));
    if (distanceTo(target, m) > gun.range) {
      continue;
    }
    m.gunTime = gun.reload;
    const x = m.x + monsterHalfWidth(m);
    const y = groundY(m);
    const z = monsterHeight(m) * (isBoss(m) ? 0.95 : 0.6);
    addParticle("flash", x, y, z, 0, 0, 0, 3, gun.size * 2 + 2);
    enemyShells.push({ x, y, z, target, gun, done: false });
  }
}

function giantCrushes() {
  // the giant boss flattens any soldier it drives over
  for (const m of monsters) {
    if (!isGiant(m)) {
      continue;
    }
    for (const s of [...soldiers]) {
      if (s.kind === "golem") {
        continue;   // the golem is too big to be driven over
      }
      if (Math.abs(s.x - m.x) < monsterHalfWidth(m) && Math.abs(s.y + 22 - groundY(m)) < 30) {
        hurtSoldier(s, s.health + s.armor);   // armor can't stop being driven over
      }
    }
  }
}

function updateEnemyShells() {
  for (const e of enemyShells) {
    const s = e.target;
    if (!soldiers.includes(s)) {
      e.done = true;   // the soldier was sold or already destroyed
      continue;
    }
    // the shot homes in on the soldier's body
    const speed = e.gun.speed;
    const dx = s.x - e.x;
    const dy = s.y + 22 - e.y;
    const dz = { mech: 40, golem: 70 }[s.kind] ?? 20;
    const dz2 = dz - e.z;
    const distance = Math.hypot(dx, dy, dz2);
    if (distance <= speed) {
      e.done = true;
      hurtSoldier(s, e.gun.damage);
      continue;
    }
    e.x += dx / distance * speed;
    e.y += dy / distance * speed;
    e.z += dz2 / distance * speed;
  }
  enemyShells = enemyShells.filter((e) => !e.done);
}

function hurtSoldier(s, damage) {
  const gy = s.y + 22;
  if (s.kind === "mech") {
    explode(s.x, gy, 40, 30);   // just the fire and smoke, no damage to enemies
  } else if (s.kind === "golem") {
    addParticle("debris", s.x, gy, 70, uniform(-3, 3), uniform(-1, 1), uniform(2, 5), 30, 4, "#7d7466");
  } else {
    addParticle("dust", s.x, gy, 20, 0, 0, 0.5, 10, 4);
    if (s.ragdoll) {
      kickRagdoll(s.ragdoll);
    }
  }
  if (s.armor > 0) {
    const blocked = Math.min(s.armor, damage);
    s.armor -= blocked;
    damage -= blocked;
  }
  s.health -= damage;
  if (s.health <= 0) {
    soldiers = soldiers.filter((other) => other !== s);
    if (s.kind === "golem") {
      // the golem crumbles into a pile of rocks
      for (let i = 0; i < 30; i++) {
        addParticle("debris", s.x + uniform(-30, 30), gy, uniform(10, 110), uniform(-4, 4), uniform(-2, 2),
                    uniform(1, 6), 70, uniform(4, 9), i % 2 ? "#7d7466" : "#544c42");
      }
      addParticle("dust", s.x, gy, 10, 0, 0, 0.5, 40, 50);
    } else if (s.kind === "mech") {
      explode(s.x, gy, 30, 50);
      for (let i = 0; i < 8; i++) {
        addParticle("debris", s.x, gy, 40, uniform(-6, 6), uniform(-2, 2), uniform(4, 10), 60, 6, "#39434d");
      }
    } else {
      for (let i = 0; i < 6; i++) {
        addParticle("debris", s.x, gy, 20, uniform(-3, 3), uniform(-1, 1), uniform(2, 5), 40, 3, SOLDIER_TYPES[s.kind].color);
      }
    }
    soldierDiedSound(s.kind);
    if (s.collector) {
      toast("Your collector Mech was destroyed!", "bad");
    } else if (s.kind === "mech") {
      toast("Your Mech was destroyed!", "bad");
    } else if (s.kind === "golem") {
      toast("Your Golem crumbled!", "bad");
    }
    updateInfo();
  }
}

// ---------- coins ----------

function dropCoin(x, y, value) {
  coins.push({ x, y: Math.min(Math.max(y, 20), HEIGHT - 5), value, spin: uniform(0, 6) });
}

function pickUpCoins() {
  // enemies grab any coin they walk over and carry it until they die
  for (const m of monsters) {
    for (const c of [...coins]) {
      if (Math.abs(c.x - m.x) < monsterHalfWidth(m) && Math.abs(c.y - groundY(m)) < 12) {
        coins = coins.filter((other) => other !== c);
        m.carried.push(c.value);
      }
    }
  }
}

function combineSoldiers() {
  // every soldier (and any golem you already have) melts together into one giant golem
  const golem = soldiers.find((s) => s.kind === "golem");
  let health = golem ? golem.health : 0;
  let maxHealth = golem ? golem.maxHealth : 0;
  let cost = golem ? golem.cost : 0;
  for (const s of soldiers) {
    if (s === golem) {
      continue;
    }
    health += s.health + GOLEM_BONUS;
    maxHealth += SOLDIER_TYPES[s.kind].health + GOLEM_BONUS;
    cost += SOLDIER_TYPES[s.kind].cost;
    // each soldier flies into the golem in a puff of sparks
    addParticle("flash", s.x, s.y + 22, 20, 0, 0, 0, 6, 16);
    for (let i = 0; i < 8; i++) {
      addParticle("fire", s.x, s.y + 22, 20, uniform(-2, 2), uniform(-1, 1), uniform(1, 4), 14, 4, "#ffb347");
    }
  }
  const y = HEIGHT / 2 - 30;
  soldiers = [{ x: CASTLE_X - 70, y, reload: 0, kind: "golem", cloudTime: 0, ragdoll: null, recoil: 0, ammo: null,
                health, maxHealth, cost, collector: false, returning: false, homeX: CASTLE_X - 70, homeY: y, armor: 0 }];
  addParticle("flash", CASTLE_X - 70, y + 22, 60, 0, 0, 0, 10, 80);
  for (let i = 0; i < 24; i++) {
    addParticle("dust", CASTLE_X - 70 + uniform(-40, 40), y + 22, 5, uniform(-3, 3), uniform(-1, 1), uniform(0.5, 2),
                40, uniform(8, 16));
  }
  tone(60, 30, 1.2, "sawtooth", 0.2);
  tone(120, 240, 0.6, "square", 0.06, 0.3);
  showBanner("GOLEM!", health.toLocaleString() + " health · smashes the giant boss in one hit", true);
}

function mechCount() {
  return soldiers.filter((s) => s.kind === "mech").length;
}

function walkTo(s, x, y) {
  // move a mech a step toward (x, y); returns true once it is there
  const dx = x - s.x;
  const dy = y - s.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return true;
  }
  const step = Math.min(COLLECTOR_SPEED, distance);
  s.x += dx / distance * step;
  s.y += dy / distance * step;
  return false;
}

function moveCollectors() {
  for (const s of soldiers) {
    if (s.collector && mechCount() < 2) {
      // with only one mech left, it has to go back and fight
      s.collector = false;
      s.returning = true;
      toast("Only one Mech left: the collector goes back to fighting", "warn");
    }
    if (s.collector) {
      // head for the closest coin; the coin lies on the ground, at the mech's feet (s.y + 22)
      let goal = null;
      for (const c of coins) {
        if (!goal || Math.hypot(c.x - s.x, c.y - 22 - s.y) < Math.hypot(goal.x - s.x, goal.y - 22 - s.y)) {
          goal = c;
        }
      }
      if (goal) {
        walkTo(s, goal.x, goal.y - 22);
        if (Math.hypot(goal.x - s.x, goal.y - 22 - s.y) < COLLECTOR_REACH) {
          collectCoin(goal);
        }
      } else {
        walkTo(s, s.homeX, s.homeY);   // nothing to pick up: wait by the castle
      }
    } else if (s.returning && walkTo(s, s.homeX, s.homeY)) {
      s.returning = false;
    }
  }
}

function coinRadius(c) {
  return { 5: 6, 50: 9, 250: 12 }[c.value] ?? 16;
}

function collectCoin(c) {
  coins = coins.filter((other) => other !== c);
  money += c.value;
  floaters.push({ x: c.x, y: c.y - 14, words: "+$" + c.value, color: "#ffd84d", life: 24 });
  for (let i = 0; i < 6; i++) {
    addParticle("fire", c.x, c.y, 6, uniform(-2, 2), uniform(-1, 1), uniform(1, 3), 10, 3, "gold");
  }
  coinSound();
  updateInfo();
}

// ---------- drawing ----------

const board = document.getElementById("board");
const SCALE = 2;   // draw at double size so the picture stays sharp on big and high-resolution screens
board.width = WIDTH * SCALE;
board.height = HEIGHT * SCALE;
const screenCtx = board.getContext("2d");
const background = document.createElement("canvas");
background.width = WIDTH * SCALE;
background.height = HEIGHT * SCALE;
const backgroundCtx = background.getContext("2d");
let ctx = screenCtx;   // the drawing helpers draw on whichever canvas this points at

function oval(x1, y1, x2, y2, color, outline = false, outlineColor = "black") {
  ctx.beginPath();
  ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();
  }
}

function rect(x1, y1, x2, y2, color, outline = false, outlineColor = "black") {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, w, h);
  if (outline) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = outlineColor;
    ctx.strokeRect(left, top, w, h);
  }
}

function line(x1, y1, x2, y2, color = "black", width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function text(x, y, words, color, size) {
  ctx.font = "bold " + size + "px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.fillText(words, x, y);
}

function polygon(coords, color, outline = false, outlineColor = "black") {
  ctx.beginPath();
  ctx.moveTo(coords[0], coords[1]);
  for (let i = 2; i < coords.length; i += 2) {
    ctx.lineTo(coords[i], coords[i + 1]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();
  }
}

function poly(x, gy, k, face, points, color) {
  // draws a shape from [forward, height] points; face is 1 for facing right, -1 for facing left
  const coords = [];
  for (const [dx, dz] of points) {
    coords.push(x + face * dx * k, gy - dz * k);
  }
  polygon(coords, color, true);
}

function drawTankShape(x, gy, k, face, body, dark, recoil = 0) {
  const pt = (dx, dz) => [x + face * dx * k, gy - dz * k];
  oval(x - 50 * k, gy - 7 * k, x + 50 * k, gy + 7 * k, SHADOW);
  poly(x, gy, k, face, [[-44, 2], [44, 2], [49, 9], [44, 16], [-44, 16], [-49, 9]], "#2a2a2a");   // tracks
  for (let dx = -36; dx <= 36; dx += 12) {
    const [cx, cz] = pt(dx, 8);
    oval(cx - 5 * k, cz - 5 * k, cx + 5 * k, cz + 5 * k, "#4a4a4a", true);
    oval(cx - 2 * k, cz - 2 * k, cx + 2 * k, cz + 2 * k, "#7a7a7a");
  }
  poly(x, gy, k, face, [[-46, 15], [42, 15], [50, 22], [40, 30], [-44, 30]], body);              // hull
  const start = pt(14 - recoil, 37);
  const end = pt(70 - recoil * 1.5, 37);
  line(start[0], start[1], end[0], end[1], dark, Math.max(5 * k, 2));                            // main gun
  oval(end[0] - 4 * k, end[1] - 4 * k, end[0] + 4 * k, end[1] + 4 * k, dark);                   // muzzle brake
  poly(x, gy, k, face, [[-24, 30], [14, 30], [22, 38], [14, 46], [-20, 46], [-26, 40]], body);   // turret
  const hatch = pt(-6, 47);
  oval(hatch[0] - 6 * k, hatch[1] - 3 * k, hatch[0] + 6 * k, hatch[1] + 2 * k, dark);
  const gunStart = pt(-4, 50);
  const gunEnd = pt(12, 51);
  line(gunStart[0], gunStart[1], gunEnd[0], gunEnd[1], "#1c1c1c", Math.max(2 * k, 1));
  const stripeA = pt(-36, 22);
  const stripeB = pt(-20, 26);
  rect(stripeA[0], stripeB[1], stripeB[0], stripeA[1], dark);
}

function drawApc(x, gy, body) {
  oval(x - 58, gy - 8, x + 58, gy + 8, SHADOW);
  poly(x, gy, 1, 1, [[-50, 10], [46, 10], [56, 24], [44, 44], [-50, 44]], body);   // hull
  poly(x, gy, 1, 1, [[-50, 10], [46, 10], [50, 16], [-50, 16]], "#2a2a2a");        // dark skirt
  for (const dx of [-34, -12, 12, 34]) {
    oval(x + dx - 11, gy - 22, x + dx + 11, gy, "#1c1c1c");
    oval(x + dx - 4, gy - 15, x + dx + 4, gy - 7, "#6a6a6a");
  }
  poly(x, gy, 1, 1, [[-16, 44], [14, 44], [18, 50], [14, 56], [-16, 56]], body);   // turret
  line(x + 16, gy - 51, x + 46, gy - 51, "#1c1c1c", 3);                             // machine gun
  rect(x + 30, gy - 34, x + 40, gy - 30, "#111111");                                 // vision slit
  rect(x - 38, gy - 32, x - 22, gy - 26, "#8b1a1a");                                 // red marking
  oval(x - 8, gy - 60, x + 4, gy - 55, "#2a2a2a");                                   // hatch
}

function drawInfantry(m) {
  const x = m.x;
  const gy = groundY(m);
  const k = monsterSize(m) / 20;
  let { uniform: coat, helmet } = ENEMY_LOOK[m.kind];
  if (m.slowed > 0) {
    coat = "#8fa3b5";   // coughing in tear gas
  } else if (m.poison > 0) {
    coat = "#5f7a2e";   // poisoned
  }
  const swing = Math.sin(m.step) * 7;
  const pt = (dx, dz) => [x + dx * k, gy - dz * k];

  oval(x - 13 * k, gy - 4 * k, x + 13 * k, gy + 4 * k, SHADOW);
  const hip = pt(0, 17);
  const shoulder = pt(1, 31);
  // back arm swings opposite to the legs
  const backHand = pt(-swing * 0.6 - 2, 19);
  line(shoulder[0], shoulder[1], backHand[0], backHand[1], coat, 4 * k);
  // walking legs that bend at the knee
  for (const footDx of [swing, -swing]) {
    const knee = pt(footDx * 0.5 + 2, 8);
    const foot = pt(footDx, 0);
    line(hip[0], hip[1], knee[0], knee[1], "#2e2e2e", 4 * k);
    line(knee[0], knee[1], foot[0], foot[1], "#2e2e2e", 4 * k);
    oval(foot[0] - 3 * k, foot[1] - 2.5 * k, foot[0] + 4 * k, foot[1] + 1.5 * k, "black");
  }
  line(hip[0], hip[1], shoulder[0], shoulder[1], coat, 9 * k);
  line(hip[0] - 4 * k, hip[1] - k, hip[0] + 4 * k, hip[1] - k, "#2b1d12", 2 * k);   // belt
  if (isTough(m)) {
    rect(x - 5 * k, gy - 30 * k, x + 6 * k, gy - 19 * k, "#55595e", true);          // armor vest
  }
  // rifle pointed at the castle
  const stock = pt(-6, 21);
  const grip = pt(3, 24);
  const barrel = pt(22, 26);
  line(stock[0], stock[1], grip[0], grip[1], "#5a3b1e", 4 * k);
  line(grip[0], grip[1], barrel[0], barrel[1], "#1e1e1e", 3 * k);
  const frontHand = pt(12, 25);
  line(shoulder[0], shoulder[1], frontHand[0], frontHand[1], coat, 4 * k);
  oval(frontHand[0] - 2 * k, frontHand[1] - 2 * k, frontHand[0] + 2 * k, frontHand[1] + 2 * k, SKIN);
  // head with a helmet
  const [hx, hy] = pt(2, 38);
  oval(hx - 6 * k, hy - 6 * k, hx + 6 * k, hy + 6 * k, "#e8957a", true);   // red with anger
  oval(hx - 7 * k, hy - 9 * k, hx + 7 * k, hy + k, helmet, true);
  line(hx - 8 * k, hy - k, hx + 8 * k, hy - k, helmet, 2 * k);
  // angry face: eyebrow slanting down toward the nose, glaring eye and a frown
  line(hx + k, hy + 0.2 * k, hx + 5.5 * k, hy + 1.8 * k, "black", 1.5 * k);
  oval(hx + 2.5 * k, hy + 1.5 * k, hx + 4.5 * k, hy + 3.3 * k, "black");
  line(hx + 2.5 * k, hy + 5 * k, hx + 4 * k, hy + 4 * k, "#5a1a1a", k);
  line(hx + 4 * k, hy + 4 * k, hx + 5.5 * k, hy + 5 * k, "#5a1a1a", k);
  if (isTough(m)) {
    // riot shield carried in front
    rect(x + 15 * k, gy - 40 * k, x + 20 * k, gy - 4 * k, "#3c4248", true);
    rect(x + 16 * k, gy - 34 * k, x + 19 * k, gy - 30 * k, "#9fc3d6");
  }
}

function drawMonster(m) {
  let body = null;
  if (m.slowed > 0) {
    body = "#8fa3b5";
  } else if (m.poison > 0) {
    body = "#5f7a2e";
  }
  const gy = groundY(m);
  if (m.kind === "titan") {
    drawTankShape(m.x, gy, 4.0, 1, body || "#3a1f4a", "#1a0d22");
  } else if (isGiant(m)) {
    drawTankShape(m.x, gy, 3.0, 1, body || "#5a2a26", "#2e1614");
  } else if (isMega(m)) {
    drawTankShape(m.x, gy, 2.0, 1, body || "#5a5a52", "#33332e");
  } else if (isBoss(m)) {
    drawApc(m.x, gy, body || "#5d6150");
  } else {
    drawInfantry(m);
  }
  if (m.carried.length > 0) {
    // a little coin above the head shows it is carrying stolen money
    const cx = m.x;
    const cy = gy - monsterHeight(m) - (isBoss(m) ? 24 : 8);
    oval(cx - 4, cy - 4, cx + 4, cy + 4, "gold", true);
    text(cx + 5, cy - 8, "$" + m.carried.reduce((a, b) => a + b, 0), "gold", 8);
  }
  if (isBoss(m)) {
    // health bar above the vehicle
    const half = monsterHalfWidth(m);
    const top = gy - monsterHeight(m) - 14;
    rect(m.x - half, top, m.x + half, top + 8, "black");
    rect(m.x - half, top, m.x - half + half * 2 * m.health / m.max, top + 8, "lime");
  }
}

function drawCorpse(c) {
  if (c.wreck) {
    if (c.kind === "boss") {
      drawApc(c.x, c.y, "#2e2a26");
    } else if (c.kind === "titan") {
      drawTankShape(c.x, c.y, 4.0, 1, "#2e2a26", "#1b1917");
    } else if (c.kind === "giant") {
      drawTankShape(c.x, c.y, 3.0, 1, "#2e2a26", "#1b1917");
    } else {
      drawTankShape(c.x, c.y, 2.0, 1, "#2e2a26", "#1b1917");
    }
    return;
  }
  const k = c.k;
  const { uniform: coat, helmet } = ENEMY_LOOK[c.kind];
  const sp = (name) => [c.points[name][0], c.y - c.points[name][1]];
  const hip = sp("hip");
  const shoulder = sp("shoulder");
  const head = sp("head");
  oval(hip[0] - 14 * k, c.y - 4 * k, hip[0] + 14 * k, c.y + 4 * k, SHADOW);
  for (const footName of ["footL", "footR"]) {
    const foot = sp(footName);
    line(hip[0], hip[1], foot[0], foot[1], "#2e2e2e", 4 * k);
    oval(foot[0] - 3 * k, foot[1] - 2 * k, foot[0] + 3 * k, foot[1] + 2 * k, "black");
  }
  for (const handName of ["handL", "handR"]) {
    const hand = sp(handName);
    line(shoulder[0], shoulder[1], hand[0], hand[1], coat, 4 * k);
    oval(hand[0] - 2 * k, hand[1] - 2 * k, hand[0] + 2 * k, hand[1] + 2 * k, SKIN);
  }
  line(hip[0], hip[1], shoulder[0], shoulder[1], coat, 9 * k);
  // the helmet sits on the top of the head, whichever way the head has flopped
  const dx = head[0] - shoulder[0];
  const dy = head[1] - shoulder[1];
  const length = Math.hypot(dx, dy) || 1;
  oval(head[0] - 6 * k, head[1] - 6 * k, head[0] + 6 * k, head[1] + 6 * k, SKIN, true);
  const hx = head[0] + dx / length * 3 * k;
  const hy = head[1] + dy / length * 3 * k;
  oval(hx - 6 * k, hy - 6 * k, hx + 6 * k, hy + 6 * k, helmet, true);
}

function drawPerson(s) {
  const x = s.x;
  const y = s.y;
  const kind = s.kind;
  const stats = SOLDIER_TYPES[kind];
  const coat = stats.color;
  const p = s.ragdoll;
  const at = (name) => [x + p[name][0], y + p[name][1]];
  const hip = at("hip");
  const head = at("head");
  const shoulder = [x + (hip[0] - x) * 0.4, y - 5];
  const bow = at("bowHand");          // front hand
  const string = at("stringHand");    // back hand
  const pants = kind === "poison" ? coat : "#3b3b2e";
  const hands = kind === "poison" || kind === "freezer" ? "#2e2e2e" : SKIN;

  oval(x - 14, y + 18, x + 14, y + 26, SHADOW);
  // floppy legs, torso and arms are all lines joined to the wobbling body parts
  for (const foot of [at("leftFoot"), at("rightFoot")]) {
    line(hip[0], hip[1], foot[0], foot[1], pants, 5);
    oval(foot[0] - 5, foot[1] - 2, foot[0] + 3, foot[1] + 3, "black");
  }
  if (kind === "archer") {
    line(shoulder[0] + 7, shoulder[1] - 9, hip[0] + 8, hip[1] - 2, "#6b4423", 5);   // quiver
    line(shoulder[0] + 7, shoulder[1] - 9, shoulder[0] + 9, shoulder[1] - 15, "white", 2);
  } else if (kind === "poison") {
    oval(shoulder[0] + 3, shoulder[1] - 5, shoulder[0] + 13, hip[1], "#6b8e23", true);   // gas tank
  }
  line(hip[0], hip[1], shoulder[0], shoulder[1], coat, 9);
  if (kind === "strong") {
    line(shoulder[0] - 4, shoulder[1] + 1, hip[0] + 4, hip[1] - 2, "#3b3b2e", 2);   // webbing
  }
  line(shoulder[0], shoulder[1], string[0], string[1], coat, 4);
  oval(string[0] - 3, string[1] - 3, string[0] + 3, string[1] + 3, hands);

  // the weapon
  if (kind === "archer") {
    const top = [bow[0] + 3, bow[1] - 18];
    const bottom = [bow[0] + 3, bow[1] + 18];
    line(top[0], top[1], bow[0] - 5, bow[1], "saddlebrown", 3);
    line(bow[0] - 5, bow[1], bottom[0], bottom[1], "saddlebrown", 3);
    line(top[0], top[1], string[0], string[1], "white");
    line(bottom[0], bottom[1], string[0], string[1], "white");
    if (s.reload <= 0) {
      line(string[0], string[1], bow[0] - 12, bow[1], "dimgray", 2);   // arrow ready to fire
    }
  } else if (kind === "strong" || kind === "boss killer") {
    line(string[0] + 9, string[1] + 4, string[0] - 2, string[1], "#6b4423", 6);   // wooden stock
    line(string[0], string[1], bow[0] - stats.muzzle, bow[1] - 1, "#222222", kind === "strong" ? 4 : 3);
    if (kind === "strong") {
      line(bow[0] + 4, bow[1], bow[0] + 6, bow[1] + 8, "#222222", 4);   // magazine
    } else {
      rect(bow[0] + 1, bow[1] - 7, bow[0] + 13, bow[1] - 3, "#111111");   // scope
      oval(bow[0] - 1, bow[1] - 7, bow[0] + 2, bow[1] - 3, "#7fdfff");
      line(bow[0] - 26, bow[1], bow[0] - 30, bow[1] + 10, "#222222");    // bipod
    }
  } else {
    // grenade launcher with a colored band near the end
    const end = bow[0] - stats.muzzle;
    line(string[0] + 6, string[1] + 2, end, bow[1] - 1, "#3a3a3a", 7);
    line(end + 2, bow[1] - 1, end + 6, bow[1] - 1, stats.shot, 7);
    oval(bow[0] + 2, bow[1] - 2, bow[0] + 10, bow[1] + 6, "#2b2b2b");
  }
  line(shoulder[0], shoulder[1], bow[0], bow[1], coat, 4);
  oval(bow[0] - 3, bow[1] - 3, bow[0] + 3, bow[1] + 3, hands);

  // head and headgear
  const [hx, hy] = head;
  if (kind === "poison") {
    oval(hx - 9, hy - 9, hx + 9, hy + 9, coat, true);              // hazmat hood
    oval(hx - 8, hy - 4, hx + 1, hy + 4, "#9be7ff", true);         // visor
    oval(hx - 12, hy + 2, hx - 5, hy + 8, "#556b2f", true);        // filter
  } else if (kind === "freezer") {
    oval(hx - 8, hy - 8, hx + 8, hy + 8, SKIN, true);
    oval(hx - 9, hy - 12, hx + 9, hy + 1, "#2f3a46", true);        // helmet
    oval(hx - 8, hy - 5, hx + 5, hy + 8, "#4a4a4a", true);         // gas mask
    oval(hx - 7, hy - 4, hx - 3, hy, "#b0d8e8");
    oval(hx - 2, hy - 4, hx + 2, hy, "#b0d8e8");
    oval(hx - 13, hy + 1, hx - 6, hy + 8, "#2b2b2b");              // filter
  } else {
    oval(hx - 8, hy - 8, hx + 8, hy + 8, SKIN, true);
    oval(hx - 6, hy - 2, hx - 2, hy + 2, "black");   // eye looking left at the enemies
    if (kind === "archer") {
      polygon([hx - 9, hy - 2, hx + 9, hy - 2, hx, hy - 16], "forestgreen", true);   // hood
    } else if (kind === "strong") {
      oval(hx - 10, hy - 12, hx + 10, hy + 1, "#556b2f", true);   // helmet
      line(hx - 11, hy - 1, hx + 10, hy - 1, "#3e4f22", 2);
      line(hx + 6, hy, hx + 2, hy + 7, "#2e2e2e");                 // chin strap
    } else if (kind === "boss killer") {
      oval(hx - 8, hy - 13, hx + 8, hy - 2, "#4a5a35", true);     // boonie hat
      line(hx - 13, hy - 3, hx + 12, hy - 3, "#4a5a35", 3);
      line(hx - 7, hy + 3, hx - 1, hy + 3, "#3e4f22", 2);          // face paint
    }
  }
}

function drawMech(s) {
  // a big walking robot facing left, with a cannon on its arm
  const x = s.x;
  const gy = s.y + 22;
  const body = SOLDIER_TYPES.mech.color;
  const dark = "#39434d";
  const recoil = s.recoil;
  oval(x - 26, gy - 5, x + 26, gy + 5, SHADOW);
  for (const dx of [-12, 8]) {
    rect(x + dx, gy - 30, x + dx + 8, gy - 4, dark, true);                 // legs
    rect(x + dx - 4, gy - 6, x + dx + 12, gy, "#2a2f35");                   // feet
  }
  rect(x - 18, gy - 58, x + 18, gy - 28, body, true);                       // body
  rect(x - 10, gy - 70, x + 8, gy - 58, body, true);                        // head
  rect(x - 9, gy - 66, x - 1, gy - 62, "cyan");                             // eye
  rect(x + 18, gy - 56, x + 26, gy - 36, dark, true);                       // back arm
  rect(x - 26 + recoil, gy - 50, x - 14 + recoil, gy - 38, dark, true);     // cannon arm
  rect(x - 44 + recoil, gy - 47, x - 26 + recoil, gy - 41, "#2a2f35");      // cannon barrel
}

function drawGolem(s) {
  // a giant stone golem facing left, with glowing cracks; its throwing arm swings back when it throws
  const x = s.x;
  const gy = s.y + 22;
  const stone = "#7d7466";
  const dark = "#544c42";
  const glow = "#ff9a2e";
  const swing = s.recoil * 2;
  oval(x - 44, gy - 8, x + 44, gy + 8, SHADOW);
  for (const dx of [-24, 6]) {
    polygon([x + dx, gy - 40, x + dx + 20, gy - 40, x + dx + 22, gy, x + dx - 4, gy], dark, true);   // legs
  }
  rect(x + 18, gy - 92, x + 34, gy - 44, dark, true);                                              // back arm
  polygon([x - 30, gy - 96, x + 30, gy - 100, x + 34, gy - 40, x - 32, gy - 36], stone, true);     // body
  polygon([x - 14, gy - 118, x + 12, gy - 120, x + 14, gy - 96, x - 16, gy - 94], stone, true);    // head
  rect(x - 12, gy - 112, x - 4, gy - 107, glow);                                                   // eyes
  rect(x + 1, gy - 112, x + 8, gy - 107, glow);
  line(x - 10, gy - 84, x + 2, gy - 70, glow, 2);                                                  // glowing cracks
  line(x + 2, gy - 70, x - 6, gy - 54, glow, 2);
  line(x + 12, gy - 90, x + 20, gy - 76, glow, 2);
  rect(x - 50 + swing, gy - 94, x - 26 + swing, gy - 50, dark, true);                              // throwing arm
  oval(x - 56 + swing, gy - 58, x - 34 + swing, gy - 38, stone, true);                             // fist
  for (const [rx, ry] of [[-20, -80], [16, -60], [-6, -46], [22, -88]]) {
    oval(x + rx - 3, gy + ry - 2, x + rx + 3, gy + ry + 2, dark);                                  // rocky bumps
  }
}

function drawSoldier(s) {
  let top = s.y - 42;
  let half = 12;
  if (s.kind === "mech") {
    drawMech(s);
    top = s.y - 58;
    half = 22;
  } else if (s.kind === "golem") {
    drawGolem(s);
    top = s.y - 112;
    half = 34;
  } else {
    drawPerson(s);
  }
  // health bar above the soldier's head
  rect(s.x - half, top, s.x + half, top + 4, "black");
  rect(s.x - half, top, s.x - half + 2 * half * Math.max(s.health, 0) / (s.maxHealth ?? SOLDIER_TYPES[s.kind].health), top + 4, "lime");
  if (s.collector) {
    rect(s.x - 8, s.y - 30, s.x + 8, s.y - 16, "gold", true, "#6b4f00");
    text(s.x - 4, s.y - 29, "$", "#6b4f00", 12);
  }
  if (s.armor > 0) {
    // armor bar above the health bar
    rect(s.x - half, top - 6, s.x + half, top - 2, "black");
    rect(s.x - half, top - 6, s.x - half + 2 * half * s.armor / COLLECTOR_ARMOR_MAX, top - 2, "#8fb3d9");
  }
  if (s.ammo !== null) {
    // bullets left, shown next to the sniper's head
    if (s.ammo > 0) {
      text(s.x - 58, s.y - 30, "ammo " + s.ammo, "white", 9);
    } else {
      text(s.x - 62, s.y - 30, "NO AMMO", "red", 9);
    }
  }
}

function drawCoin(c) {
  // the coin spins: it gets thinner and wider as it turns
  c.spin += 0.15;
  const r = coinRadius(c);
  const w = Math.max(Math.abs(Math.cos(c.spin)) * r, 1.5);
  const x = c.x;
  const y = c.y - r - 2;
  oval(x - r, c.y - 2, x + r, c.y + 2, SHADOW);
  oval(x - w, y - r, x + w, y + r, "gold", true);
  if (w > r * 0.6) {
    text(x - r * 0.35, y - r * 0.8, "$", "#8a6d00", Math.max(Math.floor(r * 0.9), 6) * 1.3);
  }
}

function drawBricks(x1, y1, x2, y2, rng, shades) {
  let row = 0;
  for (let y = y1; y < y2; y += 16) {
    let bx = x1 - (row % 2 === 1 ? 12 : 0);
    while (bx < x2) {
      rect(Math.max(bx, x1), y, Math.min(bx + 24, x2), Math.min(y + 16, y2), rng.choice(shades), true, "#5c5853");
      bx += 24;
    }
    row += 1;
  }
}

function drawBackground() {
  // drawn once at the start onto its own canvas; it never changes, so it is not redrawn every tick
  ctx = backgroundCtx;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const rng = seededRandom(42);
  // mowed grass in stripes
  for (let i = 0; i * 20 < HEIGHT; i++) {
    rect(0, i * 20, WIDTH, i * 20 + 20, i % 2 === 0 ? "#5e9140" : "#58893a");
  }
  // a dirt battlefield with bumpy edges
  const coords = [];
  for (let x = 0; x <= CASTLE_X + 30; x += 30) {
    coords.push(x, 118 + rng.randint(-6, 6));
  }
  for (let x = CASTLE_X + 30; x >= 0; x -= 30) {
    coords.push(x, 282 + rng.randint(-6, 6));
  }
  polygon(coords, "#9c8358");
  for (let i = 0; i < 12; i++) {
    const px = rng.randint(0, CASTLE_X);
    const py = rng.randint(135, 265);
    oval(px - 30, py - 8, px + 30, py + 8, "#a68e62");
  }
  // tire ruts
  for (const lane of [165, 235]) {
    for (let x = 0; x < CASTLE_X; x += 20) {
      line(x, lane + Math.sin(x / 50) * 3, x + 20, lane + Math.sin((x + 20) / 50) * 3, "#87714b", 3);
    }
  }
  // pebbles
  for (let i = 0; i < 70; i++) {
    const px = rng.randint(0, CASTLE_X);
    const py = rng.randint(125, 275);
    const r = rng.uniform(1, 2.5);
    oval(px - r, py - r * 0.7, px + r, py + r * 0.7, rng.choice(["#7d7468", "#8f8678", "#6b6359"]));
  }
  // grass tufts and flowers
  for (let i = 0; i < 160; i++) {
    const px = rng.randint(0, CASTLE_X);
    const py = rng.random() < 0.5 ? rng.randint(5, 108) : rng.randint(294, HEIGHT);
    const color = rng.choice(["#3f6e28", "#6aa04a", "#4d7f31"]);
    line(px, py, px - 2, py - 5, color);
    line(px, py, px, py - 6, color);
    line(px, py, px + 2, py - 5, color);
  }
  for (let i = 0; i < 15; i++) {
    const px = rng.randint(0, CASTLE_X - 30);
    const py = rng.random() < 0.5 ? rng.randint(50, 105) : rng.randint(300, 360);
    oval(px - 2, py - 2, px + 2, py + 2, rng.choice(["white", "#ffe066", "#ff9ecb"]));
  }
  // rocks
  for (let i = 0; i < 7; i++) {
    const px = rng.randint(20, CASTLE_X - 60);
    const py = rng.random() < 0.5 ? rng.randint(60, 100) : rng.randint(300, 350);
    polygon([px - 9, py + 3, px - 6, py - 5, px + 3, py - 7, px + 10, py - 1, px + 7, py + 4], "#8a857c", true);
    line(px - 5, py - 4, px + 2, py - 6, "#b3aea4", 2);
  }
  // trees along the top edge
  for (let x = 30; x < 500; x += 75) {
    const tx = x + rng.randint(-15, 15);
    const ty = rng.randint(14, 28);
    oval(tx - 18, ty + 6, tx + 26, ty + 20, SHADOW);
    rect(tx - 3, ty, tx + 3, ty + 16, "#5a3d22");
    oval(tx - 18, ty - 22, tx + 8, ty + 4, "#2f5e22");
    oval(tx - 6, ty - 28, tx + 18, ty, "#356b26");
    oval(tx - 12, ty - 16, tx + 14, ty + 8, "#3f7a2c");
    oval(tx - 8, ty - 22, tx + 4, ty - 12, "#4f8f38");
  }
  // bushes along the bottom edge
  for (let x = 20; x < 500; x += 90) {
    const bx = x + rng.randint(-15, 15);
    const by = rng.randint(380, 394);
    oval(bx - 16, by - 10, bx + 4, by + 6, "#2f5e22");
    oval(bx - 6, by - 14, bx + 16, by + 6, "#3f7a2c");
  }

  // the castle casts a shadow on the grass
  ["#55863a", "#4e7d35", "#467330"].forEach((color, i) => {
    rect(CASTLE_X - 44 + i * 10, 0, CASTLE_X - 34 + i * 10, HEIGHT, color);
  });
  // stone wall, every brick a slightly different gray
  drawBricks(CASTLE_X, 0, WIDTH, HEIGHT, rng, ["#8f8b84", "#99958d", "#857f78", "#a39f97", "#7d7871"]);
  // battlements sticking out on the enemy side, lit from the top
  for (let y = 0; y < HEIGHT; y += 40) {
    rect(CASTLE_X - 14, y + 6, CASTLE_X, y + 28, "#99958d", true, "#5c5853");
    rect(CASTLE_X - 14, y + 6, CASTLE_X, y + 9, "#b3afa6");
    rect(CASTLE_X - 14, y + 25, CASTLE_X, y + 28, "#6d6963");
  }
  // arrow slits
  for (const top of [38, 328]) {
    rect(CASTLE_X + 23, top, CASTLE_X + 35, top + 34, "#6e6a64");
    rect(CASTLE_X + 26, top + 3, CASTLE_X + 32, top + 31, "black");
  }
  // gate tower in the middle
  drawBricks(CASTLE_X - 18, 112, WIDTH, 288, rng, ["#86827b", "#7e7a73", "#8e8a82", "#77736c"]);
  for (let y = 112; y < 288; y += 36) {
    rect(CASTLE_X - 30, y + 4, CASTLE_X - 18, y + 24, "#8e8a82", true, "#5c5853");
    rect(CASTLE_X - 30, y + 4, CASTLE_X - 18, y + 7, "#aaa69d");
  }
  // wooden gate made of planks, with iron bands
  oval(CASTLE_X + 6, 146, WIDTH - 6, 198, "#4a4540");
  rect(CASTLE_X + 6, 172, WIDTH - 6, 274, "#4a4540");
  oval(CASTLE_X + 10, 150, WIDTH - 10, 194, "#7a4e2a");
  let plank = 0;
  for (let px = CASTLE_X + 10; px < WIDTH - 10; px += 8) {
    rect(px, 172, Math.min(px + 8, WIDTH - 10), 270, plank % 2 === 0 ? "#7a4e2a" : "#6c4322", true, "#4a2e16");
    plank += 1;
  }
  for (const band of [196, 240]) {
    rect(CASTLE_X + 10, band, WIDTH - 10, band + 4, "#2e2e2e");
    for (let rx = CASTLE_X + 14; rx < WIDTH - 10; rx += 8) {
      oval(rx - 1, band + 1, rx + 1, band + 3, "#777777");
    }
  }
  oval(CASTLE_X + 36, 215, CASTLE_X + 42, 221, "gold", true);
  // torch brackets and the flag pole
  for (const ty of [150, 250]) {
    rect(CASTLE_X - 8, ty, CASTLE_X - 4, ty + 16, "#3a3a3a");
  }
  line(WIDTH - 30, 120, WIDTH - 30, 78, "#333333", 3);
  oval(WIDTH - 33, 73, WIDTH - 27, 79, "gold");
  ctx = screenCtx;
}

function drawCastleDetails() {
  // the parts of the castle that move or change
  for (const ty of [150, 250]) {
    const flicker = uniform(0.8, 1.2);
    oval(CASTLE_X - 10, ty - 12 * flicker, CASTLE_X - 2, ty + 1, "#ff8c1a");
    oval(CASTLE_X - 8, ty - 7 * flicker, CASTLE_X - 4, ty, "#ffe066");
  }
  // the flag waves in the wind
  const t = performance.now() / 1000;
  const top = [];
  const bottom = [];
  for (let i = 0; i < 6; i++) {
    const fx = WIDTH - 30 - i * 5;
    const waveY = Math.sin(t * 6 - i) * i * 0.6;
    top.push(fx, 80 + waveY);
    bottom.unshift(fx, 98 + waveY);   // the bottom edge goes back the other way
  }
  polygon(top.concat(bottom), "#b22222", true);
  // steel armor plates on the battlements: one plate for every 2 armor points
  for (let i = 0; i < Math.min(10, Math.floor((castleArmor + 1) / 2)); i++) {
    const y = i * 40;
    rect(CASTLE_X - 16, y + 5, CASTLE_X + 2, y + 29, "#7f8c99", true, "#3c4650");
    rect(CASTLE_X - 16, y + 5, CASTLE_X + 2, y + 8, "#b8c4cf");
    for (const ry of [y + 12, y + 24]) {
      oval(CASTLE_X - 13, ry - 1, CASTLE_X - 11, ry + 1, "#3c4650");
      oval(CASTLE_X - 3, ry - 1, CASTLE_X - 1, ry + 1, "#3c4650");
    }
  }
  // cracks appear when the castle is damaged
  if (castleHealth <= maxCastleHealth * 0.6) {
    line(CASTLE_X, 90, CASTLE_X + 18, 105, "black", 2);
    line(CASTLE_X + 18, 105, CASTLE_X + 8, 125, "black", 2);
  }
  if (castleHealth <= maxCastleHealth * 0.3) {
    line(CASTLE_X + 60, 300, CASTLE_X + 40, 320, "black", 2);
    line(CASTLE_X + 40, 320, CASTLE_X + 55, 345, "black", 2);
    line(CASTLE_X, 20, CASTLE_X + 15, 35, "black", 2);
  }
}

function drawCloud(c) {
  // a gas cloud is a bunch of puffs; the same cloud always has the same puffs
  const rng = seededRandom(Math.floor(c.x * 7 + c.y * 13));
  const fade = Math.min(c.life / 20, 1);
  const colors = c.kind === "toxic" ? ["#a8d84a", "#9ac43a"] : ["#dadddd", "#c8cccc"];
  for (let i = 0; i < 8; i++) {
    const px = c.x + rng.uniform(-0.7, 0.7) * c.radius;
    const py = c.y + rng.uniform(-0.35, 0.35) * c.radius;
    const r = c.radius * rng.uniform(0.25, 0.45) * (0.6 + 0.4 * fade);
    oval(px - r, py - r * 0.7, px + r, py + r * 0.5, rng.choice(colors));
  }
}

function drawProjectile(p) {
  const stats = SOLDIER_TYPES[p.kind];
  const weapon = stats.weapon;
  const sx = p.x;
  const sy = p.y - p.z;
  const dx = p.vx;
  const dy = p.vy - p.vz;   // how it moves on screen
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  if (weapon === "arrow" || weapon === "grenade") {
    oval(p.x - 2, p.y - 1, p.x + 2, p.y + 1, SHADOW);   // shadow on the ground
  }
  if (weapon === "arrow") {
    const tail = [sx - ux * 16, sy - uy * 16];
    line(tail[0], tail[1], sx, sy, "#8b5a2b", 2);
    line(sx - ux * 4, sy - uy * 4, sx + ux * 2, sy + uy * 2, "#3a3a3a", 3);
    line(tail[0], tail[1], tail[0] - ux * 4 - uy * 3, tail[1] - uy * 4 + ux * 3, "white", 2);
    line(tail[0], tail[1], tail[0] - ux * 4 + uy * 3, tail[1] - uy * 4 - ux * 3, "white", 2);
  } else if (weapon === "grenade") {
    oval(sx - 3.5, sy - 3.5, sx + 3.5, sy + 3.5, "#333333");
    oval(sx - 1.5, sy - 1.5, sx + 1.5, sy + 1.5, stats.shot);
  } else if (weapon === "shell" && p.kind === "golem") {
    oval(sx - 8, sy - 7, sx + 8, sy + 7, stats.shot, true);   // a big boulder
    oval(sx - 4, sy - 4, sx, sy - 1, "#8a8072");
  } else if (weapon === "shell") {
    line(sx - dx * 0.8, sy - dy * 0.8, sx, sy, stats.shot, 3);
    oval(sx - 3, sy - 3, sx + 3, sy + 3, "#2a2a2a");
  } else {
    line(sx - dx * 0.7, sy - dy * 0.7, sx, sy, stats.shot, 2);   // tracer
  }
}

function drawParticle(q) {
  const x = q.x;
  const y = q.y - q.z;
  const left = q.life / q.max;   // 1 when new, 0 when gone
  if (q.kind === "flash") {
    const r = q.size * (0.5 + left * 0.5);
    oval(x - r, y - r, x + r, y + r, "#fff6c8");
  } else if (q.kind === "fire") {
    let color = "#b8321a";
    if (left > 0.75) color = "#fff2a8";
    else if (left > 0.5) color = "#ffc23d";
    else if (left > 0.25) color = "#ff7b1c";
    const r = q.size * (0.5 + left * 0.5);
    oval(x - r, y - r, x + r, y + r, color);
  } else if (q.kind === "smoke") {
    let color = "#949494";
    if (left > 0.66) color = "#4d4d4d";
    else if (left > 0.33) color = "#6f6f6f";
    const r = q.size * (1.6 - left * 0.6);
    oval(x - r, y - r, x + r, y + r, color);
  } else if (q.kind === "dust") {
    const r = q.size * (1.8 - left * 0.8);
    oval(x - r, y - r * 0.7, x + r, y + r * 0.7, "#b39a6e");
  } else {
    const r = q.size;
    rect(x - r, y - r * 0.6, x + r, y + r * 0.6, q.color);
  }
}

function drawAll() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(background, 0, 0);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawCastleDetails();
  for (const c of clouds) {
    drawCloud(c);
  }
  for (const a of stuck) {
    // the arrow is stuck in the ground at the angle it came down
    const length = Math.hypot(a.vx, a.vz) || 1;
    const ux = a.vx / length;
    const uz = a.vz / length;
    line(a.x, a.y, a.x - ux * 12, a.y + uz * 12, "#8b5a2b", 2);
    line(a.x - ux * 12, a.y + uz * 12, a.x - ux * 15, a.y + uz * 15, "white", 3);
  }
  // draw from the back of the field to the front, so nearer things cover farther ones
  const things = [];
  for (const c of corpses) {
    things.push([c.y, drawCorpse, c]);
  }
  for (const m of monsters) {
    things.push([groundY(m), drawMonster, m]);
  }
  for (const s of soldiers) {
    things.push([s.y + 22, drawSoldier, s]);
  }
  things.sort((a, b) => a[0] - b[0]);
  for (const [, draw, thing] of things) {
    draw(thing);
  }
  for (const c of coins) {
    drawCoin(c);
  }
  for (const p of projectiles) {
    drawProjectile(p);
  }
  for (const e of enemyShells) {
    const r = e.gun.size;
    oval(e.x - r, e.y - e.z - r, e.x + r, e.y - e.z + r, e.gun.color, r > 3);
  }
  for (const q of particles) {
    drawParticle(q);
  }
  ctx.textAlign = "center";
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.strokeText(f.words, f.x, f.y);
    text(f.x, f.y, f.words, f.color, 13);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

// ---------- feedback: toasts, banners, flashes ----------

function replay(el, className) {
  // restart a CSS animation, even if it is already running
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function bump(el) {
  replay(el, "bump");
}

function toast(words, kind = "info") {
  const note = document.createElement("div");
  note.className = "toast " + kind;
  note.textContent = words;
  toasts.appendChild(note);
  while (toasts.children.length > 3) {
    toasts.firstChild.remove();
  }
  note.addEventListener("animationend", () => note.remove());
}

let lastDenied = "";
let lastDeniedTime = 0;

function denied(el, words) {
  // shake the button and say why, but don't repeat the same message over and over
  replay(el, "shake-once");
  deniedSound();
  const now = performance.now();
  if (words !== lastDenied || now - lastDeniedTime > 1500) {
    toast(words, "warn");
    lastDenied = words;
    lastDeniedTime = now;
  }
}

function showBanner(title, sub, bossWave = false) {
  bannerTitle.textContent = title;
  bannerSub.textContent = sub;
  banner.classList.toggle("boss-wave", bossWave);
  banner.hidden = true;
  void banner.offsetWidth;   // hiding and showing again restarts the animation
  banner.hidden = false;
}

// ---------- title and game over screens ----------

function loadBest() {
  try {
    return Number(localStorage.getItem("castleDefenseBest")) || 0;
  } catch (error) {
    return 0;
  }
}

function saveBest(best) {
  try {
    localStorage.setItem("castleDefenseBest", String(best));
  } catch (error) {
    // private windows can block storage: the best score just isn't remembered
  }
}

// ---------- leaderboard ----------
// Scores are shared between all players through a Supabase database. GitHub Pages can't
// store anything itself, so the game talks to Supabase directly. Every score is also kept
// in this browser, so the leaderboard still works offline or if Supabase is down.

const SUPABASE_URL = "https://havjhzdkkpbftmimnsbm.supabase.co";
// the publishable key is meant to be public: the database only lets it read scores and add new ones
const SUPABASE_KEY = "sb_publishable_IhIlOX6AEPUwMZVO7i_iTA_W5bpHvHJ";
const SCORES_URL = `${SUPABASE_URL}/rest/v1/scores`;

const LEADERBOARD_SIZE = 10;
let topScores = [];        // what the leaderboard shows: [{name, score, wave, level}]
let leaderboardNote = "Loading scores…";   // shown under the leaderboard, "" for nothing
let pendingScore = null;   // the finished game waiting for a name: {score, wave, level}
let lastEntry = null;      // the entry just saved, so it can be highlighted

async function fetchOnlineScores() {
  const response = await fetch(
    `${SCORES_URL}?select=name,score,wave,level&order=score.desc&limit=${LEADERBOARD_SIZE}`,
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
    const list = JSON.parse(localStorage.getItem("castleDefenseLeaderboard"));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function saveLocalScore(entry) {
  const list = [...loadLocalScores(), entry];
  list.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem("castleDefenseLeaderboard", JSON.stringify(list.slice(0, LEADERBOARD_SIZE)));
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
    leaderboardNote = "Offline: showing scores from this computer";
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
    localStorage.setItem("castleDefenseName", name);   // fill it in for next time
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
    entry.wave === lastEntry.wave && entry.level === lastEntry.level;
}

function showLeaderboard() {
  leaderboardList.replaceChildren();
  for (const entry of topScores) {
    const row = document.createElement("li");
    if (isLastEntry(entry)) {
      row.className = "mine";
    }
    const name = document.createElement("span");
    name.className = "who";
    name.textContent = entry.name;   // textContent, so a name can't break the page
    const info = document.createElement("span");
    info.className = "how";
    info.textContent = `wave ${entry.wave} · ${entry.level}`;
    const points = document.createElement("b");
    points.textContent = entry.score.toLocaleString();
    row.append(name, info, points);
    leaderboardList.appendChild(row);
  }
  leaderboardStatus.textContent = leaderboardNote;
  leaderboardStatus.hidden = !leaderboardNote;
}

function askForName() {
  nameForm.hidden = false;
  try {
    playerName.value = localStorage.getItem("castleDefenseName") || "";
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
  titleMessage.textContent = "Saved! Play again?";
  addToLeaderboard(name, result);
}

function showTitle(message, stats = null) {
  titleHeading.textContent = stats ? "GAME OVER" : "CASTLE DEFENSE";
  titleMessage.textContent = message;
  summary.hidden = !stats;
  summary.replaceChildren();
  if (stats) {
    for (const [label, value] of stats) {
      const box = document.createElement("div");
      const big = document.createElement("b");
      big.textContent = value;
      const small = document.createElement("span");
      small.textContent = label;
      box.append(big, small);
      summary.appendChild(box);
    }
  }
  nameForm.hidden = true;
  showLeaderboard();
  titleBox.hidden = false;
}

function gameOver() {
  const best = loadBest();
  const newBest = score > best;
  if (newBest) {
    saveBest(score);
  }
  showTitle(newBest ? "New best score! Play again?" : "The castle has fallen. Play again?", [
    ["Wave reached", String(wave)],
    ["Score", score.toLocaleString()],
    ["Best", Math.max(best, score).toLocaleString()],
  ]);
  pendingScore = null;
  if (makesLeaderboard(score)) {
    const level = Object.keys(DIFFICULTIES).find((name) => DIFFICULTIES[name] === difficulty);
    pendingScore = { score, wave, level };
    askForName();
  }
  refreshLeaderboard();   // pick up scores other players added during this game
  tone(400, 90, 1.2, "sawtooth", 0.12);
}

// ---------- buttons and clicks ----------

function setSpeed(level) {
  monsterSpeedUp = level;
  for (const button of speedGroup.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.speed) === level));
  }
}

function changeMonsterSpeed() {
  // each press: x1 -> x2 -> x3 -> back to x1
  setSpeed(monsterSpeedUp % 3 + 1);
}

function showModeHint() {
  stage.classList.toggle("mode-sell", sellMode);
  stage.classList.toggle("mode-delete", deleteMode);
  stage.classList.toggle("mode-collect", collectMode);
  modeHint.hidden = !sellMode && !deleteMode && !collectMode;
  modeHint.classList.toggle("delete", deleteMode);
  if (sellMode) {
    modeHint.textContent = "SELL: click a soldier for a full refund · Esc to cancel";
  } else if (deleteMode) {
    modeHint.textContent = "DELETE: click a soldier to remove it (no refund) · Esc to cancel";
  } else if (collectMode) {
    modeHint.textContent = "COLLECTOR: click a Mech to send it collecting coins · Esc to cancel";
  }
}

function toggleCollectMode() {
  if (!collectMode && mechCount() < 2 && !soldiers.some((s) => s.collector)) {
    denied(collectorButton, "You need 2 Mechs to send one collecting coins.");
    return;
  }
  collectMode = !collectMode;
  if (collectMode && sellMode) {
    toggleSellMode();
  }
  if (collectMode && deleteMode) {
    toggleDeleteMode();
  }
  collectorButton.classList.toggle("active", collectMode);
  showModeHint();
}

function chooseCollectorAt(x, y) {
  // click a mech to make it the collector; click the collector again to send it back to fight
  const mech = soldiers.find((s) => s.kind === "mech" && Math.abs(s.x - x) < 30 && y - s.y > -60 && y - s.y < 26);
  if (!mech) {
    toast("Click one of your Mechs", "warn");
    return;
  }
  if (mech.collector) {
    mech.collector = false;
    mech.returning = true;
    toast("The Mech is going back to fighting");
  } else {
    for (const other of soldiers) {
      if (other.collector) {
        other.collector = false;
        other.returning = true;
      }
    }
    if (!mech.returning) {
      mech.homeX = mech.x;   // remember where it stood, so it can come back
      mech.homeY = mech.y;
    }
    mech.collector = true;
    mech.returning = false;
    toast("Collector Mech is out! It picks up coins but won't shoot", "good");
  }
  toggleCollectMode();
  updateInfo();
}

function toggleDeleteMode() {
  deleteMode = !deleteMode;
  if (deleteMode && sellMode) {
    toggleSellMode();
  }
  if (deleteMode && collectMode) {
    toggleCollectMode();
  }
  deleteButton.classList.toggle("active", deleteMode);
  showModeHint();
}

function toggleSellMode() {
  sellMode = !sellMode;
  if (sellMode && deleteMode) {
    toggleDeleteMode();
  }
  if (sellMode && collectMode) {
    toggleCollectMode();
  }
  sellButton.classList.toggle("active", sellMode);
  showModeHint();
}

function setPaused(on) {
  paused = on && playing;
  pauseScreen.hidden = !paused;
  pauseButton.querySelector(".label").textContent = paused ? "▶" : "⏸";
  pauseButton.title = paused ? "Resume (P)" : "Pause (P)";
}

function togglePause() {
  setPaused(!paused);
}

function toggleSound() {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "🔊" : "🔇";
  soundButton.setAttribute("aria-label", soundOn ? "Sound on" : "Sound off");
  if (soundOn) {
    startAudio();
  }
}

let combineArmedAt = 0;

function askCombine() {
  // combining can't be undone, so it needs a second click to make sure
  if (!playing) {
    return;
  }
  const golem = soldiers.some((s) => s.kind === "golem");
  if (soldiers.length < GOLEM_MIN && !(golem && soldiers.length >= 2)) {
    denied(combineButton, golem ? "Recruit more soldiers to add to the Golem."
                                : "You need at least " + GOLEM_MIN + " soldiers to make a Golem.");
    return;
  }
  if (combineArmedAt && performance.now() - combineArmedAt < 2500) {
    combineArmedAt = 0;
    combineButton.classList.remove("armed");
    combineSoldiers();
    updateInfo();
    return;
  }
  combineArmedAt = performance.now();
  combineButton.label.textContent = "Combine all " + soldiers.length + "?";
  combineButton.classList.add("armed");
  setTimeout(() => {
    if (combineArmedAt && performance.now() - combineArmedAt >= 2500) {
      combineArmedAt = 0;
      combineButton.classList.remove("armed");
      updateInfo();
    }
  }, 2600);
}

let resetArmedAt = 0;

function askReset() {
  // in the middle of a game, Reset needs a second click so you don't lose your game by accident
  if (!playing || (resetArmedAt && performance.now() - resetArmedAt < 2500)) {
    resetArmedAt = 0;
    resetButton.textContent = "Reset";
    resetButton.classList.remove("armed");
    resetGame();
    return;
  }
  resetArmedAt = performance.now();
  resetButton.textContent = "Sure?";
  resetButton.classList.add("armed");
  setTimeout(() => {
    if (resetArmedAt && performance.now() - resetArmedAt >= 2500) {
      resetArmedAt = 0;
      resetButton.textContent = "Reset";
      resetButton.classList.remove("armed");
    }
  }, 2600);
}

function sellSoldierAt(x, y, refund = true) {
  // check the newest soldier first, because it is drawn on top
  for (let i = soldiers.length - 1; i >= 0; i--) {
    const s = soldiers[i];
    const reach = { mech: 30, golem: 45 }[s.kind] ?? 25;
    const top = { mech: -60, golem: -120 }[s.kind] ?? -37;
    if (Math.abs(s.x - x) < reach && y - s.y > top && y - s.y < 26) {
      const value = s.cost ?? SOLDIER_TYPES[s.kind].cost;   // a golem is worth what its soldiers cost
      if (refund) {
        money += value;   // full money back
        floaters.push({ x: s.x, y: s.y - 50, words: "+$" + value, color: "#9be36b", life: 24 });
        coinSound();
      } else {
        floaters.push({ x: s.x, y: s.y - 50, words: "removed", color: "#ff8a80", life: 24 });
      }
      soldiers.splice(i, 1);
      updateInfo();
      return;
    }
  }
}

function clicked(event) {
  if (!playing) {
    return;
  }
  // the canvas may be shown smaller or bigger than 600x400, so scale the click back
  const box = board.getBoundingClientRect();
  const x = (event.clientX - box.left) * WIDTH / box.width;
  const y = (event.clientY - box.top) * HEIGHT / box.height;
  // coins come first: a click on a coin turns it into money
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (Math.hypot(c.x - x, c.y - 6 - y) < coinRadius(c) + 6) {
      collectCoin(c);
      return;
    }
  }
  if (sellMode) {
    sellSoldierAt(x, y);
    return;
  }
  if (deleteMode) {
    sellSoldierAt(x, y, false);
    return;
  }
  if (collectMode) {
    chooseCollectorAt(x, y);
    return;
  }
  for (const m of monsters) {
    const reach = monsterSize(m) + 15;
    if (Math.abs(m.x - x) < reach && Math.abs(m.y - y) < reach) {
      hitMonster(m, 1, -4, 2);
      break;
    }
  }
}

function keyPressed(event) {
  if (event.target.tagName === "INPUT") {
    return;   // typing a name for the leaderboard, so the letters aren't shortcuts
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "tab") {
    // cheat key: Tab kills every enemy on the field, and they all drop their coins
    event.preventDefault();   // stop Tab from moving between the buttons
    if (playing && !paused) {
      for (const m of [...monsters]) {
        hitMonster(m, m.health);
      }
      updateInfo();
    }
    return;
  }
  if (key === "escape") {
    if (sellMode) {
      toggleSellMode();
    } else if (deleteMode) {
      toggleDeleteMode();
    } else if (collectMode) {
      toggleCollectMode();
    } else {
      togglePause();
    }
    return;
  }
  if (key === "m") {
    toggleSound();
    return;
  }
  if (!playing) {
    return;
  }
  const recruit = RECRUIT_ORDER[Number(key) - 1];
  if (recruit) {
    buySoldier(recruit);
    return;
  }
  const actions = { p: togglePause, " ": togglePause, f: changeMonsterSpeed, s: toggleSellMode,
                    d: toggleDeleteMode, c: toggleCollectMode, u: buyUpgrade, a: buyArmor, b: buyAmmo,
                    k: buyCollectorArmor, g: askCombine };
  if (actions[key]) {
    event.preventDefault();   // stop Space from scrolling the page or clicking a focused button
    actions[key]();
  }
}

// ---------- building the shop ----------

// a short line under each card's name
const ROLES = {
  "strong": "Fast, accurate rifle",
  "archer": "Arcing arrows, long range",
  "poison": "Poison gas + toxic clouds",
  "freezer": "Slows enemies down",
  "boss killer": "Kills armored cars, 5 shots",
  "mech": "Beats the giant boss in 2 hits",
};
const RECRUIT_ORDER = [...SHOP_ORDER, "mech"];

function drawPortrait(kind) {
  // draw the soldier with the game's own drawing code onto a small canvas for its card
  const portrait = document.createElement("canvas");
  portrait.width = 112;
  portrait.height = 112;
  const saved = ctx;
  ctx = portrait.getContext("2d");
  const fake = { x: 0, y: 0, kind, ragdoll: newRagdoll(), recoil: 0 };
  if (kind === "mech") {
    ctx.setTransform(1.3, 0, 0, 1.3, 66, 66);
    drawMech(fake);
  } else {
    ctx.setTransform(1.5, 0, 0, 1.5, 64, 58);
    drawPerson(fake);
  }
  ctx = saved;
  return portrait;
}

function makeCard(kind, key) {
  const stats = SOLDIER_TYPES[kind];
  const card = document.createElement("button");
  card.className = "card" + (kind === "mech" ? " mech" : "");
  const range = stats.range;
  card.title = stats.name + ": " + stats.health.toLocaleString() + " health, range " + range +
               (stats.damage ? ", " + stats.damage + " damage per shot" : "");
  const hotkey = document.createElement("kbd");
  hotkey.textContent = key;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = stats.name;
  const role = document.createElement("span");
  role.className = "role";
  role.textContent = ROLES[kind];
  const cost = document.createElement("span");
  cost.className = "cost";
  cost.textContent = "$" + stats.cost;
  card.badge = document.createElement("span");
  card.badge.className = "badge";
  card.append(hotkey, drawPortrait(kind), name, role, cost, card.badge);
  card.addEventListener("click", () => buySoldier(kind));
  return card;
}

function makeTool(words, price, key, action) {
  const button = document.createElement("button");
  button.className = "tool";
  button.label = document.createElement("span");
  button.label.textContent = words;
  button.price = document.createElement("span");
  button.price.className = "price";
  button.price.textContent = price;
  const hotkey = document.createElement("kbd");
  hotkey.textContent = key;
  button.append(button.label, button.price, hotkey);
  button.addEventListener("click", action);
  upgrades.appendChild(button);
  return button;
}

const shop = document.getElementById("shop");
const upgrades = document.getElementById("upgrades");
const buyButtons = {};
RECRUIT_ORDER.forEach((kind, i) => {
  buyButtons[kind] = makeCard(kind, String(i + 1));
  shop.appendChild(buyButtons[kind]);
});
const mechButton = buyButtons.mech;
const upgradeButton = makeTool("Weapons Lv 1", "$" + UPGRADE_COST, "U", buyUpgrade);
upgradeButton.title = "+1 damage on every shot, up to level " + MAX_WEAPON_LEVEL;
const armorButton = makeTool("Armor +" + ARMOR_PACK, "$" + ARMOR_COST, "A", buyArmor);
armorButton.title = "Each armor point blocks 1 damage to the castle (max " + MAX_ARMOR + ")";
const ammoButton = makeTool("Ammo ×" + AMMO_PACK, "$" + AMMO_COST, "B", buyAmmo);
ammoButton.title = "Gives " + AMMO_PACK + " bullets to the sniper who has the fewest";
const collectorArmorButton = makeTool("Mech armor +20k", "$" + COLLECTOR_ARMOR_COST, "K", buyCollectorArmor);
collectorArmorButton.title = "Armor for the collector Mech: used up before its health (max " +
                             COLLECTOR_ARMOR_MAX.toLocaleString() + ")";

const LEVEL_INFO = {
  Easy: "40 castle health · $60 to start · fewer, slower enemies",
  Medium: "30 castle health · the classic fight",
  Hard: "20 castle health · 40% more enemies, and faster",
};
const levels = document.getElementById("levels");
for (const level of Object.keys(DIFFICULTIES)) {
  const button = document.createElement("button");
  button.className = "level " + level.toLowerCase();
  const name = document.createElement("span");
  name.className = "level-name";
  name.textContent = level;
  const info = document.createElement("span");
  info.className = "level-info";
  info.textContent = LEVEL_INFO[level];
  button.append(name, info);
  button.addEventListener("click", () => startGame(level));
  levels.appendChild(button);
}

const deleteButton = document.getElementById("delete");
const combineButton = document.getElementById("combine");
combineButton.label = combineButton.querySelector(".label");
const collectorButton = document.getElementById("collector");
const sellButton = document.getElementById("sell");
const pauseButton = document.getElementById("pause");
const speedGroup = document.getElementById("speed");
const soundButton = document.getElementById("sound");
const resetButton = document.getElementById("reset");
const moneyText = document.getElementById("money");
const waveText = document.getElementById("wave");
const scoreText = document.getElementById("score");
const castleStat = document.getElementById("castle-stat");
const castleText = document.getElementById("castle");
const castleFill = document.getElementById("castle-fill");
const armorText = document.getElementById("armor");
const armyText = document.getElementById("army");
const weaponsText = document.getElementById("weapons");
const stage = document.getElementById("stage");
const bossBox = document.getElementById("boss");
const bossName = document.getElementById("boss-name");
const bossFill = document.getElementById("boss-fill");
const bossHp = document.getElementById("boss-hp");
const modeHint = document.getElementById("mode-hint");
const banner = document.getElementById("banner");
const bannerTitle = document.getElementById("banner-title");
const bannerSub = document.getElementById("banner-sub");
const toasts = document.getElementById("toasts");
const pauseScreen = document.getElementById("pause-screen");
const titleBox = document.getElementById("title");
const titleHeading = titleBox.querySelector("h1");
const titleMessage = document.getElementById("title-message");
const summary = document.getElementById("summary");
const nameForm = document.getElementById("name-form");
const playerName = document.getElementById("player-name");
const leaderboard = document.getElementById("leaderboard");
const leaderboardList = document.getElementById("leaderboard-list");
const leaderboardStatus = document.getElementById("leaderboard-status");

sellButton.addEventListener("click", toggleSellMode);
deleteButton.addEventListener("click", toggleDeleteMode);
collectorButton.addEventListener("click", toggleCollectMode);
combineButton.addEventListener("click", askCombine);
pauseButton.addEventListener("click", togglePause);
pauseScreen.addEventListener("click", togglePause);
speedGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) {
    setSpeed(Number(button.dataset.speed));
  }
});
soundButton.addEventListener("click", toggleSound);
resetButton.addEventListener("click", askReset);
document.addEventListener("keydown", keyPressed);
nameForm.addEventListener("submit", saveName);
board.addEventListener("pointerdown", clicked);
banner.addEventListener("animationend", () => { banner.hidden = true; });
// pause by itself when you switch to another tab
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    setPaused(true);
  }
});

drawBackground();
updateInfo();
showLeaderboard();
refreshLeaderboard();
drawAll();
setInterval(gameLoop, 50);
setInterval(spawnMonster, 1000);
