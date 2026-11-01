// Star Snackers: hungry space blobs are flying in to steal the cookies from your moon bakery!
// Zip along the bottom in your little rocket, zap every snacker, and keep the cookie jar safe.
// 15 waves and 3 bosses. Everything you see is drawn by this code with the canvas, so there are no picture files.
"use strict";

// ---------- 1. numbers you can change ----------
const W = 600, H = 800;          // the game is 600 x 800 game pixels, stretched to fit the window
const PLAYER_SPEED = 380;        // how fast your rocket moves (game pixels per second)
const FIRE_DELAY = 0.3;          // seconds between shots
const RAPID_DELAY = 0.12;        // seconds between shots with ⚡ Rapid Fire
const SHOT_SPEED = 720;          // how fast your shots fly
const START_HEARTS = 3;
const MAX_HEARTS = 5;
const START_COOKIES = 10;        // cookies in the jar at the start
const POWER_TIME = 10;           // how long ⚡ and 🌟 last, in seconds
const DROP_CHANCE = 0.09;        // chance that a snacker drops a power-up when you zap it
const DIVE_SPEED = 330;          // how fast divers swoop at you
const SNATCH_SPEED = 160;        // how fast snatchers fly down to the cookie jar
const BEST_KEY = "star-snackers-best";

const GROUND_Y = H - 36;         // where the moon's ground starts
const PLAYER_Y = H - 140;        // your rocket flies along this line
const JAR_X = W / 2;             // the cookie jar sits in the middle of the ground
const DANGER_Y = H - 230;        // a snacker in the swarm that gets this low swoops down for a cookie
const TOP_Y = 120;               // the top row of the swarm
const COL_GAP = 54, ROW_GAP = 46;

// ---------- 2. the snackers ----------
// hp: hits it takes. points: score for zapping it. r: how big it is. shot: what it shoots.
const TYPES = {
  m: { name: "Muncher", hp: 1, points: 10, r: 18, color: "#6fdc5a", dark: "#2f8a2a", shot: "goo" },
  z: { name: "Zapper", hp: 1, points: 20, r: 17, color: "#b679ff", dark: "#6a34b8", shot: "zap" },
  d: { name: "Diver", hp: 1, points: 30, r: 17, color: "#ff9a3c", dark: "#b8561a", dives: true },
  t: { name: "Tank", hp: 3, points: 40, r: 21, color: "#4fb3ff", dark: "#1f6aa8", shot: "ball" },
  s: { name: "Splitter", hp: 1, points: 25, r: 18, color: "#ff6fb5", dark: "#b02f74", splits: true },
  n: { name: "Snatcher", hp: 1, points: 50, r: 17, color: "#ffd84a", dark: "#b8901a", snatches: true },
  b: { name: "Baby", hp: 1, points: 10, r: 11, color: "#ff9fd0", dark: "#b02f74", dives: true },
};

// ---------- 3. the waves ----------
// Each letter is one snacker (see TYPES above), and a space is an empty spot. boss: which boss comes.
const WAVES = [
  { rows: ["mmmmmmm", "mmmmmmm"], tip: "Zap the Munchers! Don't let them get low, or they grab cookies." },
  { rows: ["zzzzz", "mmmmmmm", "mmmmmmm"], tip: "New: Zappers shoot right at you. Dodge!" },
  { rows: ["n ddd n", "mmmmmmmm", "mmmmmmmm"], tip: "New: Snatchers steal cookies. Zap them to get the cookie back!" },
  { rows: ["ttttt", "zzzzzzz", "mmmmmmmm"], tip: "New: Tanks need 3 hits." },
  { boss: 1, tip: "Here comes the Mega Muncher!" },
  { rows: ["sssssss", "dmmmmmd", "mmmmmmm"], tip: "New: Splitters pop into two babies!" },
  { rows: ["n zzz n", "ttttttt", "mmmmmmmm", "mmmmmmmm"] },
  { rows: ["ddddddd", "sssssss", "zzzzzzz"], tip: "Lots of divers. Keep moving!" },
  { rows: ["nn ttt nn", "zzzzzzzzz", "sssssssss", "mmmmmmmmm"] },
  { boss: 2, tip: "The Mega Muncher is back, and it's angry!" },
  { rows: ["ttttttt", "ttttttt", "zzzzzzz"], tip: "A wall of Tanks!" },
  { rows: ["nnnnnnn", "ddddddd", "mmmmmmmm"], tip: "Snatcher party! Guard the jar!" },
  { rows: ["zzzzzzzzz", "sssssssss", "ttttttttt", "ddddddddd"] },
  { rows: ["n t z t n", "sdsdsdsds", "zzzzzzzzz", "ttttttttt", "mmmmmmmmm"], tip: "The biggest swarm yet!" },
  { boss: 3, tip: "Final boss: King Cruncher!" },
];
const LAST_WAVE = WAVES.length;

// the bosses. every: seconds between attacks
const BOSSES = [null,
  { name: "Mega Muncher", hp: 60, color: "#6fdc5a", dark: "#2f8a2a", speed: 0.55, every: 1.6 },
  { name: "Angry Mega Muncher", hp: 90, color: "#ff7a4a", dark: "#a8381a", speed: 0.75, every: 1.3 },
  { name: "King Cruncher", hp: 140, color: "#b679ff", dark: "#5b2aa8", speed: 0.9, every: 1.05 },
];

// the power-ups that snackers sometimes drop
const POWERS = {
  rapid: { icon: "⚡", name: "Rapid Fire!" },
  triple: { icon: "🌟", name: "Triple Shot!" },
  bubble: { icon: "🛡️", name: "Bubble Shield!" },
  heart: { icon: "❤️", name: "+1 Heart!" },
  cookie: { icon: "🍪", name: "+1 Cookie!" },
};

// ---------- 4. little helpers ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = list => list[Math.floor(Math.random() * list.length)];

// ---------- 5. the screen ----------
// The game is always 600 x 800 inside. We work out how much to stretch it so it fits the window.
const canvas = $("view");
const ctx = canvas.getContext("2d");
let scale = 1, offX = 0, offY = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  scale = Math.min(innerWidth / W, innerHeight / H);
  offX = (innerWidth - W * scale) / 2;
  offY = (innerHeight - H * scale) / 2;
}
addEventListener("resize", resize);
resize();

// ---------- 6. sound ----------
// All the sounds are made by the browser's synthesizer, so there are no sound files either.
let audio = null, soundOn = true, noiseBuf = null;
function initAudio() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  if (audio && audio.state === "suspended") audio.resume();
}
function tone(freq, dur, type = "square", vol = 0.06, slideTo = 0, delay = 0) {
  if (!audio || !soundOn) return;
  const t = audio.currentTime + delay;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function boom(dur = 0.3, vol = 0.15) {
  if (!audio || !soundOn) return;
  if (!noiseBuf) {
    noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = audio.currentTime;
  const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
  s.buffer = noiseBuf;
  f.type = "lowpass";
  f.frequency.setValueAtTime(2000, t);
  f.frequency.exponentialRampToValueAtTime(150, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(audio.destination);
  s.start(t);
  s.stop(t + dur);
}
const SFX = {
  shoot: () => tone(900, 0.07, "square", 0.025, 1500),
  hit: () => tone(260, 0.06, "square", 0.05, 180),
  pop: () => { tone(500, 0.12, "triangle", 0.09, 1100); boom(0.15, 0.06); },
  enemyShot: () => tone(400, 0.12, "sawtooth", 0.02, 200),
  hurt: () => { boom(0.45, 0.2); tone(300, 0.4, "sawtooth", 0.06, 60); },
  bubble: () => tone(700, 0.3, "sine", 0.1, 200),
  grab: () => { tone(500, 0.12, "square", 0.05, 300); tone(300, 0.2, "square", 0.05, 150, 0.1); },
  cookie: () => { tone(660, 0.1, "triangle", 0.09); tone(990, 0.15, "triangle", 0.09, 0, 0.08); },
  power: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "triangle", 0.08, 0, i * 0.06)),
  wave: () => [392, 523, 659].forEach((f, i) => tone(f, 0.16, "square", 0.04, 0, i * 0.1)),
  clear: () => [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, 0.14, "triangle", 0.09, 0, i * 0.09)),
  bossDie: () => { boom(1.2, 0.3); [784, 659, 523, 392].forEach((f, i) => tone(f, 0.25, "square", 0.05, 0, 0.3 + i * 0.12)); },
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "triangle", 0.1, 0, i * 0.22)),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.1, 0, i * 0.13)),
};
function toggleSound() {
  soundOn = !soundOn;
  $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
}

// ---------- 7. keys, mouse and fingers ----------
const keys = {};
const pointer = { down: false, x: W / 2 };
addEventListener("keydown", e => {
  initAudio();
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === "KeyM") toggleSound();
  if (e.code === "KeyP" || e.code === "Escape") {
    if (state === "play") pause();
    else if (state === "paused") resume();
  }
  if (e.code === "Enter" && (state === "menu" || state === "over" || state === "win")) startGame();
});
addEventListener("keyup", e => { keys[e.code] = false; });
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  pointer.down = false;
  if (state === "play") pause();
});
// the game's x position under a finger or the mouse
const toGameX = clientX => (clientX - offX) / scale;
canvas.addEventListener("pointerdown", e => {
  initAudio();
  pointer.down = true;
  pointer.x = toGameX(e.clientX);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => { if (pointer.down) pointer.x = toGameX(e.clientX); });
canvas.addEventListener("pointerup", () => { pointer.down = false; });
canvas.addEventListener("pointercancel", () => { pointer.down = false; });

// ---------- 8. the stars and the moon ----------
const STAR_SPEED = [12, 30, 70], STAR_SIZE = [1, 1.6, 2.4];
const stars = [];
for (let i = 0; i < 130; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, layer: i % 3 });
const craters = [];
for (let i = 0; i < 14; i++) craters.push({ x: rand(0, W), y: rand(GROUND_Y + 10, H - 6), r: rand(4, 11) });

function updateStars(dt) {
  for (const s of stars) {
    s.y += STAR_SPEED[s.layer] * dt;
    if (s.y > H) { s.y -= H; s.x = Math.random() * W; }
  }
}

// ---------- 9. starting a game and a wave ----------
let state = "menu";   // menu, play, paused, over or win
let G = null;         // everything about the game being played
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { best = 0; }

function newGame() {
  G = {
    score: 0, wave: 0, hearts: START_HEARTS, cookies: START_COOKIES, streak: 0, time: 0,
    player: { x: W / 2, cool: 0, inv: 0, rapid: 0, triple: 0, bubble: false, tilt: 0 },
    enemies: [], shots: [], bombs: [], drops: [], parts: [], floats: [], boss: null,
    form: { t: 0, ox: 0, oy: 0, amp: 30 },
    fireT: 0, diveT: 0, lowT: 0, banner: "", tip: "", bannerT: 0, clearing: false, clearT: 0, shake: 0,
  };
  startWave(1);
}

function makeEnemy(k, extra) {
  return Object.assign({ k, hp: TYPES[k].hp, x: -60, y: -60, vx: 0, vy: 0, t: 0, flash: 0,
    phase: Math.random() * 6.28, carrying: false, baby: false, dead: false }, extra);
}

function startWave(n) {
  G.wave = n;
  G.enemies = [];
  G.bombs = [];
  G.boss = null;
  G.form = { t: 0, ox: 0, oy: 0, amp: 30 };
  const def = WAVES[n - 1];
  if (def.boss) {
    G.boss = makeBoss(def.boss);
  } else {
    // the swarm can sway left and right as far as the widest row allows
    const widest = Math.max(...def.rows.map(r => r.length));
    G.form.amp = Math.max(16, (W - widest * COL_GAP) / 2 - 8);
    def.rows.forEach((row, r) => {
      const fromLeft = r % 2 === 0;
      for (let c = 0; c < row.length; c++) {
        if (row[c] === " ") continue;
        // every snacker flies in along a curve, one after another, to its spot in the swarm
        G.enemies.push(makeEnemy(row[c], {
          row: r, col: c, cols: row.length, state: "enter", t: -(r * 0.35 + c * 0.08),
          sx: fromLeft ? -40 : W + 40, sy: rand(40, 200),
          cx: fromLeft ? W * 0.85 : W * 0.15, cy: rand(320, 440),
        }));
      }
    });
  }
  G.fireT = 2.2;
  G.diveT = 3.5;
  G.banner = def.boss === 3 ? "FINAL BOSS" : def.boss ? "BOSS WAVE" : "WAVE " + n;
  G.tip = def.tip || "";
  G.bannerT = 3;
  G.clearing = false;
  SFX.wave();
}

// where a snacker's spot in the swarm is right now
const slotX = e => W / 2 + (e.col - (e.cols - 1) / 2) * COL_GAP + G.form.ox;
const slotY = e => TOP_Y + e.row * ROW_GAP + G.form.oy;

// ---------- 10. your rocket ----------
function updatePlayer(dt) {
  const p = G.player;
  let move = 0;
  if (keys.ArrowLeft || keys.KeyA) move -= 1;
  if (keys.ArrowRight || keys.KeyD) move += 1;
  if (pointer.down) {
    // with a finger or the mouse, the rocket slides toward it
    const dx = pointer.x - p.x;
    move = Math.abs(dx) < 3 ? 0 : clamp(dx / 40, -1.3, 1.3);
  }
  p.x = clamp(p.x + move * PLAYER_SPEED * dt, 26, W - 26);
  p.tilt += (move * 0.3 - p.tilt) * Math.min(1, dt * 10);
  p.cool -= dt;
  p.inv -= dt;
  p.rapid -= dt;
  p.triple -= dt;
  const firing = keys.Space || keys.ArrowUp || keys.KeyW || keys.KeyZ || pointer.down;
  if (firing && p.cool <= 0) fire();
}

function fire() {
  const p = G.player;
  p.cool = p.rapid > 0 ? RAPID_DELAY : FIRE_DELAY;
  G.shots.push({ x: p.x, y: PLAYER_Y - 26, vx: 0 });
  if (p.triple > 0) {
    // side shots don't break your combo when they miss
    G.shots.push({ x: p.x - 10, y: PLAYER_Y - 16, vx: -170, side: true });
    G.shots.push({ x: p.x + 10, y: PLAYER_Y - 16, vx: 170, side: true });
  }
  SFX.shoot();
}

function hurtPlayer() {
  const p = G.player;
  if (p.inv > 0 || state !== "play") return;
  if (p.bubble) {
    p.bubble = false;
    p.inv = 1;
    burst(p.x, PLAYER_Y, "#9fe8ff", 18);
    SFX.bubble();
    return;
  }
  G.hearts--;
  G.streak = 0;
  p.inv = 2;
  G.shake = 14;
  burst(p.x, PLAYER_Y, "#ffb02e", 26);
  SFX.hurt();
  if (G.hearts <= 0) gameOver("hearts");
}

// the combo: every 5 hits in a row without missing adds 1 to how much each snacker is worth (up to x5)
const combo = () => 1 + Math.min(4, Math.floor(G.streak / 5));

function addScore(n, x, y) {
  G.score += n;
  floatText(x, y, "+" + n, "#fff3a0");
}

// ---------- 11. the snackers move ----------
function updateEnemies(dt) {
  const f = G.form;
  f.t += dt;
  f.ox = Math.sin(f.t * 0.7) * f.amp;
  // once everyone has arrived, the whole swarm slowly creeps down
  if (!G.enemies.some(e => e.state === "enter")) f.oy += (3 + G.wave * 0.6) * dt;

  for (let i = 0; i < G.enemies.length; i++) {
    const e = G.enemies[i];
    e.flash -= dt;
    switch (e.state) {
      case "enter": {
        e.t += dt;
        if (e.t < 0) { e.x = e.sx; e.y = -60; break; }
        // a curve from where it starts, bending past (cx, cy), to its spot in the swarm
        const k = Math.min(1, e.t / 1.3), u = 1 - k;
        e.x = u * u * e.sx + 2 * u * k * e.cx + k * k * slotX(e);
        e.y = u * u * e.sy + 2 * u * k * e.cy + k * k * slotY(e);
        if (k >= 1) e.state = "form";
        break;
      }
      case "form":
        e.x = slotX(e) + Math.sin(G.time * 2 + e.phase) * 3;
        e.y = slotY(e) + Math.cos(G.time * 2.6 + e.phase) * 3;
        break;
      case "dive": {
        // swoop down and steer toward your rocket
        e.vy = Math.min(e.vy + 700 * dt, DIVE_SPEED + G.wave * 10);
        if (e.y < PLAYER_Y - 40) e.vx = clamp(e.vx + Math.sign(G.player.x - e.x) * 520 * dt, -230, 230);
        e.x = clamp(e.x + e.vx * dt, 16, W - 16);
        e.y += e.vy * dt;
        if (e.y > H + 40) backToTop(e);
        break;
      }
      case "snatch": {
        // fly straight to the cookie jar
        const dx = e.tx - e.x, dy = GROUND_Y - 84 - e.y, d = Math.hypot(dx, dy);
        const step = (SNATCH_SPEED + G.wave * 5) * dt;
        if (d <= step) grabCookie(e);
        else { e.x += dx / d * step; e.y += dy / d * step; }
        break;
      }
      case "escape":
        e.y -= 230 * dt;
        if (e.y < -40) backToTop(e);
        break;
      case "return": {
        const dx = slotX(e) - e.x, dy = slotY(e) - e.y, d = Math.hypot(dx, dy);
        const step = 260 * dt;
        if (d <= step) e.state = "form";
        else { e.x += dx / d * step; e.y += dy / d * step; }
        break;
      }
    }
  }

  // every now and then, a snacker leaves the swarm to dive at you or go for the cookies
  G.diveT -= dt;
  if (G.diveT <= 0) {
    G.diveT = Math.max(0.9, 3.6 - G.wave * 0.18) * rand(0.7, 1.3);
    const ready = G.enemies.filter(e => e.state === "form");
    const keen = ready.filter(e => TYPES[e.k].dives || TYPES[e.k].snatches);
    const e = keen.length && (Math.random() < 0.8 || G.wave < 2) ? pick(keen) : G.wave >= 2 && ready.length ? pick(ready) : null;
    if (e) {
      if (TYPES[e.k].snatches) startSnatch(e);
      else { e.state = "dive"; e.vx = 0; e.vy = -140; }
    }
  }

  // the swarm got too low! one snacker at a time swoops down to grab a cookie
  G.lowT -= dt;
  const low = G.enemies.filter(e => e.state === "form" && slotY(e) > DANGER_Y);
  if (low.length && G.lowT <= 0) {
    startSnatch(pick(low));
    G.lowT = 1.5;
  }

  // snackers in the swarm (and divers) shoot at you
  G.fireT -= dt;
  if (G.fireT <= 0) {
    G.fireT = Math.max(0.35, 1.5 - G.wave * 0.07) * rand(0.6, 1.4);
    const shooters = G.enemies.filter(e => TYPES[e.k].shot && (e.state === "form" || e.state === "dive") && e.y > 0);
    if (shooters.length) {
      // half the time it's the one closest to you
      const e = Math.random() < 0.5
        ? shooters.reduce((a, b) => Math.abs(a.x - G.player.x) < Math.abs(b.x - G.player.x) ? a : b)
        : pick(shooters);
      enemyShoot(e.x, e.y + TYPES[e.k].r, TYPES[e.k].shot);
    }
  }

  G.enemies = G.enemies.filter(e => !e.dead);
}

function startSnatch(e) {
  e.state = "snatch";
  e.tx = JAR_X + rand(-14, 14);
}

function grabCookie(e) {
  e.state = "escape";
  if (G.cookies <= 0) return;
  G.cookies--;
  e.carrying = true;
  floatText(e.x, e.y + 30, "-1 🍪", "#ff9c9c");
  SFX.grab();
  if (G.cookies <= 0) gameOver("cookies");
}

// a snacker that went off the screen comes back in at the top
function backToTop(e) {
  e.carrying = false;      // a snacker that gets away eats the cookie it took
  if (e.baby) { e.dead = true; return; }
  e.state = "return";
  e.x = slotX(e);
  e.y = -40;
}

function enemyShoot(x, y, kind) {
  if (kind === "goo") G.bombs.push({ x, y, vx: 0, vy: 200, r: 7, kind });
  if (kind === "ball") G.bombs.push({ x, y, vx: 0, vy: 240, r: 9, kind });
  if (kind === "zap") aimShot(x, y, 300);
  SFX.enemyShot();
}
function aimShot(x, y, speed) {
  const dx = G.player.x - x, dy = PLAYER_Y - y, d = Math.hypot(dx, dy) || 1;
  G.bombs.push({ x, y, vx: dx / d * speed, vy: dy / d * speed, r: 5, kind: "zap" });
}

function killEnemy(e, byPlayer) {
  if (e.dead) return;
  e.dead = true;
  const T = TYPES[e.k];
  burst(e.x, e.y, T.color, 14);
  SFX.pop();
  if (e.carrying) {
    G.cookies++;
    floatText(e.x, e.y + 26, "+1 🍪", "#ffd27a");
    SFX.cookie();
  }
  if (!byPlayer) return;
  G.streak++;
  // snackers that are swooping are worth double
  const swooping = e.state === "dive" || e.state === "snatch" || e.state === "escape";
  addScore(T.points * combo() * (swooping ? 2 : 1), e.x, e.y);
  if (T.splits) {
    for (const s of [-1, 1]) {
      G.enemies.push(makeEnemy("b", { state: "dive", x: e.x + s * 10, y: e.y, vx: s * 170, vy: -140, baby: true }));
    }
  }
  if (!e.baby && Math.random() < DROP_CHANCE) dropPower(e.x, e.y);
}

// ---------- 12. the bosses ----------
function makeBoss(level) {
  const B = BOSSES[level];
  return { level, B, x: W / 2, y: -120, hp: B.hp, t: 0, patT: 2.5, pat: 0, burst: 0, burstT: 0, flash: 0 };
}

function updateBoss(dt) {
  const b = G.boss;
  b.t += dt;
  b.flash -= dt;
  b.y += (175 - b.y) * Math.min(1, dt * 1.5);
  b.x = W / 2 + Math.sin(b.t * b.B.speed) * (W / 2 - 100);
  if (b.y > 110) {
    b.patT -= dt;
    if (b.patT <= 0) {
      bossAttack(b);
      b.patT = b.B.every * rand(0.85, 1.15);
    }
  }
  // a burst is a few zaps in a row, aimed at you
  if (b.burst > 0) {
    b.burstT -= dt;
    if (b.burstT <= 0) {
      b.burst--;
      b.burstT = 0.18;
      aimShot(b.x, b.y + 40, 330);
      SFX.enemyShot();
    }
  }
}

function bossAttack(b) {
  const attacks = b.level === 1 ? ["fan", "aim", "babies"] : ["fan", "aim", "babies", "ring"];
  const a = attacks[b.pat++ % attacks.length];
  if (a === "fan") {
    // a spray of goo
    const n = 3 + b.level * 2;
    for (let i = 0; i < n; i++) {
      const ang = Math.PI / 2 + (i / (n - 1) - 0.5) * 1.1;
      G.bombs.push({ x: b.x, y: b.y + 45, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, r: 7, kind: "goo" });
    }
    SFX.enemyShot();
  } else if (a === "aim") {
    b.burst = 2 + b.level;
    b.burstT = 0;
  } else if (a === "babies") {
    for (let i = 0; i <= b.level; i++) {
      G.enemies.push(makeEnemy("b", { state: "dive", x: b.x + rand(-40, 40), y: b.y + 30, vx: rand(-180, 180), vy: -160, baby: true }));
    }
    SFX.grab();
  } else if (a === "ring") {
    // a ring of balls flying out in every direction
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + b.t;
      G.bombs.push({ x: b.x, y: b.y, vx: Math.cos(ang) * 170, vy: Math.sin(ang) * 170, r: 9, kind: "ball" });
    }
    SFX.enemyShot();
  }
}

function hitBoss(b) {
  b.hp--;
  b.flash = 0.06;
  SFX.hit();
  if (b.hp > 0) return;
  // boss beaten! a big explosion, lots of points, and a heart
  for (let i = 0; i < 6; i++) burst(b.x + rand(-60, 60), b.y + rand(-40, 40), i % 2 ? b.B.color : "#ffd27a", 20);
  addScore(1000 * b.level, b.x, b.y);
  G.shake = 22;
  for (const e of G.enemies) killEnemy(e, false);
  G.enemies = [];
  if (G.hearts < MAX_HEARTS) {
    G.hearts++;
    floatText(b.x, b.y + 40, "+1 ❤️", "#ff9c9c");
  }
  G.boss = null;
  SFX.bossDie();
}

// ---------- 13. shots, goo and power-ups ----------
function updateShots(dt) {
  for (const s of G.shots) {
    s.x += s.vx * dt;
    s.y -= SHOT_SPEED * dt;
    // did it hit the boss? (the boss is an oval, 80 wide and 58 tall from its middle)
    const b = G.boss;
    if (b && ((s.x - b.x) / 80) ** 2 + ((s.y - b.y) / 58) ** 2 < 1) {
      s.dead = true;
      G.streak++;
      sparks(s.x, s.y, b.B.color);
      hitBoss(b);
      continue;
    }
    for (const e of G.enemies) {
      if (e.dead || e.y < -20) continue;
      const r = TYPES[e.k].r + 4;
      if ((s.x - e.x) ** 2 + (s.y - e.y) ** 2 < r * r) {
        s.dead = true;
        e.hp--;
        e.flash = 0.08;
        if (e.hp <= 0) killEnemy(e, true);
        else { SFX.hit(); sparks(s.x, s.y, TYPES[e.k].color); }
        break;
      }
    }
    if (!s.dead && (s.y < -20 || s.x < -20 || s.x > W + 20)) {
      s.dead = true;
      if (!s.side) G.streak = 0;     // a miss breaks your combo
    }
  }
  G.shots = G.shots.filter(s => !s.dead);
  G.enemies = G.enemies.filter(e => !e.dead);
}

function updateBombs(dt) {
  const p = G.player;
  for (const b of G.bombs) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > GROUND_Y) { b.dead = true; sparks(b.x, GROUND_Y, b.kind === "goo" ? "#6fdc5a" : "#c8b8ff"); continue; }
    if (b.y < -30 || b.x < -30 || b.x > W + 30) { b.dead = true; continue; }
    const r = b.r + 14;
    if (p.inv <= 0 && (b.x - p.x) ** 2 + (b.y - PLAYER_Y) ** 2 < r * r) {
      b.dead = true;
      hurtPlayer();
    }
  }
  G.bombs = G.bombs.filter(b => !b.dead);

  // snackers that crash into your rocket
  if (p.inv <= 0) {
    for (const e of G.enemies) {
      if (e.state === "form" || e.state === "enter") continue;
      const r = TYPES[e.k].r + 14;
      if ((e.x - p.x) ** 2 + (e.y - PLAYER_Y) ** 2 < r * r) {
        killEnemy(e, false);
        hurtPlayer();
        break;
      }
    }
    G.enemies = G.enemies.filter(e => !e.dead);
  }
}

function dropPower(x, y) {
  const list = ["rapid", "rapid", "triple", "triple", "bubble"];
  if (G.hearts < MAX_HEARTS) list.push("heart");
  if (G.cookies < START_COOKIES) list.push("cookie", "cookie");
  G.drops.push({ x, y, kind: pick(list), t: 0 });
}

function updateDrops(dt) {
  const p = G.player;
  for (const d of G.drops) {
    d.t += dt;
    d.y += 130 * dt;
    if (d.y > GROUND_Y) { d.dead = true; continue; }
    if (Math.abs(d.x - p.x) < 34 && Math.abs(d.y - PLAYER_Y) < 34) {
      d.dead = true;
      if (d.kind === "rapid") p.rapid = POWER_TIME;
      if (d.kind === "triple") p.triple = POWER_TIME;
      if (d.kind === "bubble") p.bubble = true;
      if (d.kind === "heart") G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
      if (d.kind === "cookie") G.cookies = Math.min(START_COOKIES, G.cookies + 1);
      floatText(p.x, PLAYER_Y - 40, POWERS[d.kind].name, "#aef3ff");
      SFX.power();
    }
  }
  G.drops = G.drops.filter(d => !d.dead);
}

// ---------- 14. sparkles and floating words ----------
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = rand(60, 260);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 0.8), max: 0.8, color, r: rand(2, 4.5) });
  }
}
function sparks(x, y, color) {
  for (let i = 0; i < 5; i++) {
    G.parts.push({ x, y, vx: rand(-90, 90), vy: rand(-120, 20), life: 0.3, max: 0.3, color, r: 2 });
  }
}
function floatText(x, y, text, color) {
  G.floats.push({ x, y, text, color, life: 1 });
}
function updateParts(dt) {
  for (const p of G.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const f of G.floats) { f.y -= 40 * dt; f.life -= dt; }
  G.floats = G.floats.filter(f => f.life > 0);
}

// ---------- 15. one step of the game ----------
function update(dt) {
  G.time += dt;
  G.bannerT -= dt;
  G.shake = Math.max(0, G.shake - dt * 40);
  updatePlayer(dt);
  updateEnemies(dt);
  if (G.boss) updateBoss(dt);
  updateShots(dt);
  updateBombs(dt);
  updateDrops(dt);
  updateParts(dt);
  if (state !== "play") return;   // you might have just lost

  // every snacker gone? wave clear! you get a bonus for every cookie still in the jar
  if (!G.clearing && G.enemies.length === 0 && !G.boss) {
    const bonus = G.cookies * 25;
    G.score += bonus;
    G.clearing = true;
    G.clearT = 2.6;
    G.bombs = [];
    G.banner = "WAVE CLEAR!";
    G.tip = "Cookie bonus: " + G.cookies + " 🍪 = +" + bonus;
    G.bannerT = 2.6;
    SFX.clear();
  }
  if (G.clearing) {
    G.clearT -= dt;
    if (G.clearT <= 0) {
      if (G.wave >= LAST_WAVE) winGame();
      else startWave(G.wave + 1);
    }
  }
  updateHud();
}

// ---------- 16. drawing ----------
function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
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
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0626");
  g.addColorStop(1, "#2a1150");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a far-away ringed planet
  ctx.fillStyle = "rgba(255, 140, 190, 0.18)";
  circle(500, 150, 46);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 210, 230, 0.2)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(500, 150, 78, 16, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  for (const s of stars) {
    ctx.fillStyle = s.layer === 2 ? "#fff" : "rgba(220, 210, 255, 0.7)";
    ctx.fillRect(s.x, s.y, STAR_SIZE[s.layer], STAR_SIZE[s.layer]);
  }
  // the moon's ground
  ctx.fillStyle = "#8d88a8";
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = "#a7a2c2";
  ctx.fillRect(0, GROUND_Y, W, 5);
  ctx.fillStyle = "#77728f";
  for (const c of craters) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.r, c.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCookie(x, y, r) {
  ctx.fillStyle = "#d9a05b";
  ctx.strokeStyle = "#9b6630";
  ctx.lineWidth = 1.5;
  circle(x, y, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4a2a12";
  for (const [a, b] of [[-0.35, -0.3], [0.3, -0.1], [-0.1, 0.35], [0.35, 0.4]]) {
    circle(x + a * r, y + b * r, r * 0.14);
    ctx.fill();
  }
}

function drawJar() {
  const x = JAR_X, y = GROUND_Y + 2;
  const spots = [[-17, -11], [0, -11], [17, -11], [-9, -26], [9, -26], [-17, -41], [0, -41], [17, -41], [-9, -55], [9, -55]];
  for (let i = 0; i < Math.min(G ? G.cookies : START_COOKIES, spots.length); i++) drawCookie(x + spots[i][0], y + spots[i][1], 8);
  ctx.fillStyle = "rgba(200, 235, 255, 0.16)";
  ctx.strokeStyle = "rgba(220, 245, 255, 0.85)";
  ctx.lineWidth = 3;
  roundRect(x - 32, y - 66, 64, 66, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e2574c";
  roundRect(x - 27, y - 76, 54, 12, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 54);
  ctx.lineTo(x - 22, y - 16);
  ctx.stroke();
}

function drawPlayer() {
  const p = G.player;
  if (p.bubble) {
    ctx.fillStyle = "rgba(150, 230, 255, 0.15)";
    ctx.strokeStyle = "rgba(170, 235, 255, 0.85)";
    ctx.lineWidth = 2.5;
    circle(p.x, PLAYER_Y, 34);
    ctx.fill();
    ctx.stroke();
  }
  if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) return;   // blink after being hit
  ctx.save();
  ctx.translate(p.x, PLAYER_Y);
  ctx.rotate(p.tilt);
  // flame
  const f = 12 + Math.random() * 10;
  ctx.fillStyle = "#ff8a2a";
  ctx.beginPath();
  ctx.moveTo(-8, 17); ctx.lineTo(8, 17); ctx.lineTo(0, 17 + f);
  ctx.fill();
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.moveTo(-4, 17); ctx.lineTo(4, 17); ctx.lineTo(0, 12 + f * 0.6);
  ctx.fill();
  // fins
  ctx.fillStyle = "#e2574c";
  ctx.strokeStyle = "#3b2350";
  ctx.lineWidth = 2.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 10, 0); ctx.lineTo(s * 24, 20); ctx.lineTo(s * 10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // body
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.quadraticCurveTo(15, -8, 12, 18);
  ctx.lineTo(-12, 18);
  ctx.quadraticCurveTo(-15, -8, 0, -28);
  ctx.fill();
  ctx.stroke();
  // red nose
  ctx.fillStyle = "#e2574c";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.quadraticCurveTo(7, -20, 9, -14);
  ctx.lineTo(-9, -14);
  ctx.quadraticCurveTo(-7, -20, 0, -28);
  ctx.fill();
  ctx.stroke();
  // window
  ctx.fillStyle = "#5fd0ff";
  circle(0, 0, 6);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSnacker(e) {
  const T = TYPES[e.k], r = T.r;
  const mouth = (Math.sin(G.time * 9 + e.phase) + 1) / 2;
  const body = e.flash > 0 ? "#ffffff" : T.color;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = T.dark;
  ctx.lineWidth = 3;
  if (e.k === "m" || e.k === "n") {
    // little wiggly feet
    ctx.fillStyle = T.dark;
    const w = Math.sin(G.time * 10 + e.phase) * 3;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.5 + s * w * 0.5, r * 0.9, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (e.k === "z") {
    // antenna with a blinking light
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, -r - 10);
    ctx.stroke();
    ctx.fillStyle = `hsl(${(G.time * 300) % 360}, 100%, 70%)`;
    circle(0, -r - 12, 4);
    ctx.fill();
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  if (e.k === "d") {
    // pointy diver
    ctx.moveTo(0, r + 7);
    ctx.quadraticCurveTo(r + 8, -r * 0.2, r * 0.6, -r);
    ctx.quadraticCurveTo(0, -r - 6, -r * 0.6, -r);
    ctx.quadraticCurveTo(-r - 8, -r * 0.2, 0, r + 7);
  } else if (e.k === "t") {
    roundRect(-r, -r, r * 2, r * 2, 8);
  } else if (e.k === "s") {
    ctx.arc(-r * 0.4, 0, r * 0.8, 0, Math.PI * 2);
    ctx.moveTo(r * 0.4 + r * 0.8, 0);
    ctx.arc(r * 0.4, 0, r * 0.8, 0, Math.PI * 2);
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  if (e.k === "t") {
    // rivets, and cracks when it's been hit
    ctx.fillStyle = T.dark;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(a * (r - 5), b * (r - 5), 2); ctx.fill(); }
    if (e.hp < T.hp) {
      ctx.strokeStyle = "#123";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r); ctx.lineTo(r * 0.1, -r * 0.6); ctx.lineTo(r * 0.4, -r * 0.4);
      if (e.hp < 2) { ctx.moveTo(-r, r * 0.2); ctx.lineTo(-r * 0.6, r * 0.4); ctx.lineTo(-r * 0.7, r * 0.7); }
      ctx.stroke();
    }
  }
  const ey = e.k === "d" ? -r * 0.35 : -r * 0.22;
  if (e.k === "n") {
    // a bandit mask, because it's a cookie thief
    ctx.fillStyle = "#26203a";
    roundRect(-r * 0.95, ey - 6, r * 1.9, 11, 5);
    ctx.fill();
  }
  // eyes that watch your rocket
  const look = clamp((G.player.x - e.x) / 200, -1, 1) * r * 0.1;
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#fff";
    circle(s * r * 0.38, ey, r * 0.27);
    ctx.fill();
    ctx.fillStyle = "#1a1030";
    circle(s * r * 0.38 + look, ey + 1, r * 0.13);
    ctx.fill();
  }
  // a munching mouth with one tooth
  const mh = 2 + mouth * r * 0.25;
  ctx.fillStyle = "#3a0d1e";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.38, r * 0.4, mh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-r * 0.12, r * 0.38 - mh, r * 0.18, Math.min(mh, 5));
  if (e.carrying) drawCookie(0, r + 9, 8);
  ctx.restore();
}

function drawBoss(b) {
  const B = b.B, mouth = (Math.sin(b.t * 6) + 1) / 2;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.strokeStyle = B.dark;
  ctx.lineWidth = 5;
  // feet
  ctx.fillStyle = B.dark;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 42 + Math.sin(b.t * 8) * s * 4, 56, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = b.flash > 0 ? "#fff" : B.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 82, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (b.level === 3) {
    // King Cruncher's crown
    ctx.fillStyle = "#ffd34d";
    ctx.strokeStyle = "#b8861a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-34, -52); ctx.lineTo(-34, -86); ctx.lineTo(-17, -66); ctx.lineTo(0, -92);
    ctx.lineTo(17, -66); ctx.lineTo(34, -86); ctx.lineTo(34, -52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff5a7a";
    circle(0, -64, 5);
    ctx.fill();
  }
  // eyes and eyebrows
  const look = clamp((G.player.x - b.x) / 200, -1, 1) * 5;
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#fff";
    circle(s * 28, -16, 15);
    ctx.fill();
    ctx.fillStyle = "#1a1030";
    circle(s * 28 + look, -12, 7);
    ctx.fill();
    if (b.level > 1) {
      ctx.strokeStyle = "#1a1030";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s * 44, -38);
      ctx.lineTo(s * 14, -28);
      ctx.stroke();
    }
  }
  // a big chomping mouth full of teeth
  const mh = 6 + mouth * 18;
  ctx.fillStyle = "#3a0d1e";
  ctx.beginPath();
  ctx.ellipse(0, 26, 40, mh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = -3; i <= 3; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i * 9 - 5, 26 - mh + 2); ctx.lineTo(i * 9 + 5, 26 - mh + 2); ctx.lineTo(i * 9, 26 - mh + 10);
    ctx.fill();
  }
  ctx.restore();

  // the boss's health bar
  const bw = 360, bx = (W - bw) / 2, by = 76;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  roundRect(bx - 3, by - 3, bw + 6, 18, 8);
  ctx.fill();
  ctx.fillStyle = B.color;
  roundRect(bx, by, Math.max(0, bw * b.hp / B.hp), 12, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "16px 'Lilita One', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(B.name, W / 2, by - 8);
}

function drawShotsAndBombs() {
  ctx.fillStyle = "#ffe066";
  ctx.shadowColor = "#ffb02e";
  ctx.shadowBlur = 10;
  for (const s of G.shots) {
    roundRect(s.x - 2.5, s.y - 9, 5, 18, 2.5);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const b of G.bombs) {
    if (b.kind === "goo") {
      ctx.fillStyle = "#7fe86a";
      circle(b.x, b.y, b.r);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      circle(b.x - 2, b.y - 2, 2.2);
      ctx.fill();
    } else if (b.kind === "zap") {
      ctx.fillStyle = "#e0b3ff";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 8); ctx.lineTo(b.x + 5, b.y); ctx.lineTo(b.x, b.y + 8); ctx.lineTo(b.x - 5, b.y);
      ctx.fill();
    } else {
      ctx.fillStyle = "#4fb3ff";
      ctx.strokeStyle = "#cbe9ff";
      ctx.lineWidth = 2;
      circle(b.x, b.y, b.r);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawDrops() {
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const d of G.drops) {
    const glow = 0.5 + Math.sin(d.t * 8) * 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.35})`;
    circle(d.x, d.y, 20);
    ctx.fill();
    ctx.fillText(POWERS[d.kind].icon, d.x + Math.sin(d.t * 4) * 4, d.y);
  }
  ctx.textBaseline = "alphabetic";
}

function drawPowerTimers() {
  const p = G.player;
  let x = 14;
  ctx.font = "18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const [kind, t] of [["rapid", p.rapid], ["triple", p.triple]]) {
    if (t <= 0) continue;
    ctx.fillText(POWERS[kind].icon, x, H - 18);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(x + 24, H - 21, 50, 6);
    ctx.fillStyle = "#ffe066";
    ctx.fillRect(x + 24, H - 21, 50 * t / POWER_TIME, 6);
    x += 86;
  }
  if (p.bubble) ctx.fillText(POWERS.bubble.icon, x, H - 18);
  ctx.textBaseline = "alphabetic";
}

function drawBanner() {
  if (G.bannerT <= 0) return;
  ctx.globalAlpha = Math.min(1, G.bannerT);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd34d";
  ctx.strokeStyle = "#170b3d";
  ctx.lineWidth = 8;
  ctx.font = "56px 'Lilita One', sans-serif";
  ctx.strokeText(G.banner, W / 2, H * 0.44);
  ctx.fillText(G.banner, W / 2, H * 0.44);
  if (G.tip) {
    ctx.font = "bold 20px Nunito, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 5;
    wrapText(G.tip, W / 2, H * 0.44 + 40, 480, 26);
  }
  ctx.globalAlpha = 1;
}
function wrapText(text, x, y, maxW, lineH) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = test;
  }
  ctx.strokeText(line, x, y);
  ctx.fillText(line, x, y);
}

function draw() {
  // outside the game area is plain dark space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#07041a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = G && G.shake ? rand(-G.shake, G.shake) * 0.5 : 0, sy = G && G.shake ? rand(-G.shake, G.shake) * 0.5 : 0;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + sx * scale), dpr * (offY + sy * scale));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  drawBackground();
  drawJar();
  if (G) {
    drawDrops();
    for (const e of G.enemies) if (e.y > -50) drawSnacker(e);
    if (G.boss) drawBoss(G.boss);
    drawShotsAndBombs();
    if (state !== "over") drawPlayer();
    for (const p of G.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.r);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.font = "18px 'Lilita One', sans-serif";
    for (const f of G.floats) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    drawPowerTimers();
    drawBanner();
  }
  ctx.restore();
}

// ---------- 17. the HUD ----------
const shown = {};
function setText(id, value) {
  if (shown[id] === value) return;
  shown[id] = value;
  $(id).textContent = value;
}
function updateHud() {
  setText("score", G.score.toLocaleString());
  setText("best", Math.max(best, G.score).toLocaleString());
  setText("wave", String(G.wave));
  setText("combo", "x" + combo());
  setText("hearts", "❤️".repeat(Math.max(0, G.hearts)) || "💔");
  setText("cookies", String(G.cookies));
  $("combo-pill").classList.toggle("hot", combo() > 1);
}

// ---------- 18. screens ----------
const SCREENS = ["title-screen", "pause-screen", "over-screen", "win-screen"];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", id === "title-screen");
}
function saveBest() {
  if (G.score <= best) return false;
  best = G.score;
  try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* the browser won't save, that's ok */ }
  return true;
}
function startGame() {
  initAudio();
  newGame();
  pointer.down = false;
  state = "play";
  showScreen(null);
  updateHud();
}
function pause() {
  state = "paused";
  showScreen("pause-screen");
}
function resume() {
  state = "play";
  showScreen(null);
}
function toTitle() {
  state = "menu";
  G = null;
  $("title-best").textContent = best ? "🏆 Your best score: " + best.toLocaleString() : "";
  showScreen("title-screen");
}
function gameOver(reason) {
  state = "over";
  const isBest = saveBest();
  updateHud();
  $("over-hero").textContent = reason === "cookies" ? "😱🍪" : "💥🚀";
  $("over-text").innerHTML = (reason === "cookies"
    ? "Oh no! The snackers ate <b>all your cookies</b>!"
    : "Your rocket ran out of hearts!") +
    `<br>You reached <b>wave ${G.wave}</b> with <b>${G.score.toLocaleString()}</b> points.` +
    (isBest ? "<br>🏆 <b>New best score!</b>" : "");
  SFX.lose();
  showScreen("over-screen");
}
function winGame() {
  state = "win";
  const isBest = saveBest();
  updateHud();
  $("win-text").innerHTML = `You beat King Cruncher and saved the moon bakery with <b>${G.cookies} cookies</b>
    left in the jar!<br>Final score: <b>${G.score.toLocaleString()}</b>` + (isBest ? "<br>🏆 <b>New best score!</b>" : "");
  SFX.win();
  showScreen("win-screen");
}

$("btn-play").onclick = startGame;
$("btn-again").onclick = startGame;
$("btn-win-again").onclick = startGame;
$("btn-resume").onclick = resume;
$("btn-quit").onclick = toTitle;
$("btn-over-title").onclick = toTitle;
$("btn-pause").onclick = () => { if (state === "play") pause(); };
$("btn-sound").onclick = () => { initAudio(); toggleSound(); };
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") pause(); });

// ---------- 19. the game loop ----------
// about 60 times a second: move everything a little, then draw it all
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  if (state !== "paused") updateStars(dt);
  if (state === "play") update(dt);
  draw();
  requestAnimationFrame(frame);
}
toTitle();
requestAnimationFrame(frame);
