// Colour Match: mix drops of paint in a bowl until it matches the colour you see.
// Play 20 levels and earn up to 3 stars on each, or race the clock in Colour Rush!
// There are no picture files: every colour you see is worked out by this code.
"use strict";

// ---------- 1. numbers you can change ----------
const MAX_DROPS = 24;     // the bowl holds 24 drops
const PASS = 75;          // you need a 75% match to pass a level...
const STAR2 = 88;         // ...88% for 2 stars...
const STAR3 = 95;         // ...and 95% for 3 stars
const RUSH_TIME = 90;     // Colour Rush lasts 90 seconds
const RUSH_MATCH = 95;    // in Colour Rush the bowl counts as a match at 95%
const SKIP_COST = 3;      // skipping a colour in Colour Rush costs 3 seconds
const SAVE_KEY = "colour-match-save";

// ---------- 2. mixing paint ----------
// Paint doesn't mix like the light on a screen. With light, blue + yellow makes grey,
// but with PAINT, blue + yellow makes green. So we use a painter's colour cube called "RYB"
// (red, yellow, blue). Each corner of the cube is a colour we picked by hand, and any mix in
// between is worked out by sliding smoothly between the corners.
const RYB_CUBE = {
  white: [1, 1, 1], red: [1, 0, 0], yellow: [1, 1, 0], orange: [1, 0.5, 0],
  blue: [0.1, 0.36, 0.75], purple: [0.5, 0, 0.5], green: [0, 0.62, 0.25], brown: [0.36, 0.22, 0.1],
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function rybToRgb(r, y, b) {
  const C = RYB_CUBE;
  return [0, 1, 2].map(i => {
    const noBlue = lerp(lerp(C.white[i], C.red[i], r), lerp(C.yellow[i], C.orange[i], r), y);
    const allBlue = lerp(lerp(C.blue[i], C.purple[i], r), lerp(C.green[i], C.brown[i], r), y);
    return lerp(noBlue, allBlue, b);
  });
}

// d holds how many drops of each paint: { r: red, y: yellow, b: blue, w: white, k: black }.
// Only the amounts compared to each other matter, so 2 red + 2 yellow is the same as 1 + 1.
function mix(d) {
  const r = d.r || 0, y = d.y || 0, b = d.b || 0, w = d.w || 0, k = d.k || 0;
  const n = r + y + b + w + k;
  if (n === 0) return null;
  const c = r + y + b;
  let rgb = [1, 1, 1];
  if (c > 0) {
    const top = Math.max(r, y, b);
    const keep = c / (c + w);           // white makes the colour paler
    rgb = rybToRgb(r / top * keep, y / top * keep, b / top * keep);
  }
  const dark = 1 - 0.9 * k / n;         // black makes everything darker
  return rgb.map(v => v * dark);
}

// ---------- 3. the paints ----------
const PAINTS = [
  { id: "r", name: "Red", key: "1" },
  { id: "y", name: "Yellow", key: "2" },
  { id: "b", name: "Blue", key: "3" },
  { id: "w", name: "White", key: "4" },
  { id: "k", name: "Black", key: "5" },
];
const PAINT = {};
for (const p of PAINTS) {
  p.rgb = mix({ [p.id]: 1 });
  PAINT[p.id] = p;
}

const toCss = rgb => "rgb(" + rgb.map(v => Math.round(clamp(v, 0, 1) * 255)).join(",") + ")";

// ---------- 4. how close are two colours? ----------
// Our eyes don't see red, green and blue equally, so we turn both colours into "Lab":
// L is how light it is, a goes from green to red, and b goes from blue to yellow.
// In Lab, the distance between two colours is close to how different they LOOK.
function toLab(rgb) {
  const lin = rgb.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function matchPercent(a, b) {
  if (!a || !b) return 0;
  const p = toLab(a), q = toLab(b);
  const diff = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  return clamp(Math.round(100 - diff * 0.8), 0, 100);
}
function starsFor(pct) {
  return pct >= STAR3 ? 3 : pct >= STAR2 ? 2 : pct >= PASS ? 1 : 0;
}

// A friendly tip that says what your mix is missing.
function tipFor(mixRgb, targetRgb) {
  const m = toLab(mixRgb), t = toLab(targetRgb);
  const dL = t[0] - m[0], da = t[1] - m[1], db = t[2] - m[2];
  const big = Math.max(Math.abs(dL), Math.abs(da), Math.abs(db));
  if (big === Math.abs(dL)) {
    return dL > 0 ? "Your mix is too dark. Try more white, or less black." : "Your mix is too light. Try less white, or a drop of black.";
  }
  if (big === Math.abs(da)) {
    if (da > 0) return "It needs to be more red.";
    return m[1] > 20 ? "It's too red. Try adding a different colour." : "It needs to be more green (yellow and blue).";
  }
  return db > 0 ? "It needs to be more yellow." : "It needs to be more blue.";
}

// ---------- 5. giving colours fun names ----------
// Every colour family has two names, so levels that look a bit alike don't get the same name.
// taken: names already used, so we pick the other one.
function colourName(rgb, taken) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  let hue = 0;
  if (max === min) hue = 0;
  else if (max === r) hue = 60 * (((g - b) / (max - min)) % 6);
  else if (max === g) hue = 60 * ((b - r) / (max - min) + 2);
  else hue = 60 * ((r - g) / (max - min) + 4);
  if (hue < 0) hue += 360;

  let names;
  if (sat < 0.15) names = light > 0.8 ? ["Cloud", "Snowman"] : light > 0.55 ? ["Pebble", "Koala"] : light > 0.3 ? ["Storm", "Elephant"] : ["Midnight", "Cave"];
  else if (hue >= 15 && hue < 50 && light < 0.38) names = ["Cocoa", "Tree Bark"];
  else {
    const families = [[12, "Cherry", "Fire Truck"], [40, "Pumpkin", "Tangerine"], [68, "Banana", "Honey"],
      [100, "Lime", "Pear"], [165, "Leaf", "Frog Pond"], [205, "Lagoon", "Peacock"], [255, "Ocean", "Denim"],
      [290, "Grape", "Violet"], [335, "Berry", "Flamingo"], [361, "Cherry", "Fire Truck"]];
    names = families.find(([h]) => hue < h).slice(1);
    const extra = light > 0.75 ? "Pale " : light < 0.3 ? "Deep " : sat < 0.45 ? "Dusty " : "";
    names = names.map(n => extra + n);
  }
  return names.find(n => !(taken || []).includes(n)) || names[0];
}

// ---------- 6. the levels ----------
// The first 12 levels are made by hand, to teach you one new idea at a time.
// paints: which paint pots you get. recipe: one way to make the colour.
const LEVELS = [
  { name: "Orange Juice", paints: "ry", recipe: { r: 1, y: 1 }, tip: "Red and yellow make orange!" },
  { name: "Frog", paints: "yb", recipe: { y: 1, b: 1 }, tip: "Yellow and blue make green!" },
  { name: "Grape", paints: "rb", recipe: { r: 1, b: 1 }, tip: "Red and blue make purple!" },
  { name: "Bubblegum", paints: "rw", recipe: { r: 1, w: 2 }, tip: "White makes colours paler." },
  { name: "Sky", paints: "bw", recipe: { b: 1, w: 2 } },
  { name: "Sunflower", paints: "ry", recipe: { r: 1, y: 3 }, tip: "More of one paint pulls the colour its way." },
  { name: "Lime", paints: "ybw", recipe: { y: 3, b: 1 } },
  { name: "Storm Cloud", paints: "wk", recipe: { w: 2, k: 1 }, tip: "Black makes colours darker." },
  { name: "Forest", paints: "ybk", recipe: { y: 1, b: 1, k: 1 } },
  { name: "Lavender", paints: "rbw", recipe: { r: 1, b: 1, w: 2 } },
  { name: "Chocolate", paints: "ryb", recipe: { r: 1, y: 1, b: 1 }, tip: "All three colours together make brown." },
  { name: "Peach", paints: "ryw", recipe: { r: 1, y: 2, w: 3 } },
];
const LEVEL_COUNT = 20;

// A "seeded" random number maker: the same seed always gives the same numbers,
// so level 15 is the same colour every time you play it.
function seededRandom(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Make up a recipe: 1 or 2 of red/yellow/blue, and maybe some white and black.
function makeRecipe(rand, hard) {
  const most = hard ? 3 : 2;
  const colours = ["r", "y", "b"].sort(() => rand() - 0.5).slice(0, rand() < 0.2 ? 1 : 2);
  const recipe = {};
  for (const p of colours) recipe[p] = 1 + Math.floor(rand() * most);
  if (rand() < 0.6 || colours.length === 1) recipe.w = 1 + Math.floor(rand() * (most + 1));
  if (rand() < (hard ? 0.5 : 0.25)) recipe.k = 1;
  const g = Object.values(recipe).reduce(gcd);
  for (const p in recipe) recipe[p] /= g;
  return recipe;
}

// The rest of the levels are made up, but they're the same every time because of the seed.
// A made-up colour is thrown away if it's too easy (fewer than 3 paints) or looks like a level we already have.
for (let seed = 1; LEVELS.length < LEVEL_COUNT; seed++) {
  const recipe = makeRecipe(seededRandom(seed * 7919), LEVELS.length >= 16);
  const rgb = mix(recipe);
  if (Object.keys(recipe).length < 3 || LEVELS.some(L => matchPercent(mix(L.recipe), rgb) > 80)) continue;
  LEVELS.push({ name: colourName(rgb, LEVELS.map(L => L.name)), paints: "rybwk", recipe });
}

// ---------- 7. saving your stars ----------
let save = { stars: [], bestRush: 0 };
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (raw && Array.isArray(raw.stars)) save = { stars: raw.stars, bestRush: raw.bestRush || 0 };
} catch (e) { /* no save yet */ }
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* fine */ }
}
const isUnlocked = i => i === 0 || (save.stars[i - 1] || 0) > 0;
const totalStars = () => save.stars.reduce((a, s) => a + (s || 0), 0);

// ---------- 8. the game state ----------
let mode = "levels";       // "levels" or "rush"
let levelIndex = 0;
let target = null;         // { name, paints, recipe, rgb }
let drops = [];            // the paints in the bowl, in the order you added them
let hintUsed = false;
let busy = false;          // true for a moment after a match, so extra clicks don't count
const rush = { time: 0, score: 0, running: false, last: 0 };

function counts() {
  const c = { r: 0, y: 0, b: 0, w: 0, k: 0 };
  for (const p of drops) c[p]++;
  return c;
}
const currentMix = () => mix(counts());

// ---------- 9. finding things on the page ----------
const $ = id => document.getElementById(id);
const screens = ["title-screen", "levels-screen", "result-screen", "rush-screen"];
function show(id) {
  for (const s of screens) $(s).classList.toggle("hidden", s !== id);
  document.body.classList.toggle("in-menu", !!id);
}

// ---------- 10. drawing the bowl, pots and drops ----------
function buildTubes() {
  const box = $("tubes");
  box.innerHTML = "";
  for (const p of PAINTS) {
    const btn = document.createElement("button");
    btn.className = "pot";
    btn.id = "pot-" + p.id;
    btn.setAttribute("aria-label", "Add a drop of " + p.name);
    btn.innerHTML = '<span class="blob"></span><span class="pot-name">' + p.name +
      '</span><kbd>' + p.key + '</kbd><span class="count"></span>';
    btn.querySelector(".blob").style.background = toCss(p.rgb);
    btn.addEventListener("click", () => addDrop(p.id));
    box.appendChild(btn);
  }
}

function render() {
  const rgb = currentMix();
  const c = counts();
  $("mix").style.background = rgb ? toCss(rgb) : "transparent";
  $("bowl").classList.toggle("empty", !rgb);
  $("target").style.background = toCss(target.rgb);
  for (const p of PAINTS) {
    const pot = $("pot-" + p.id);
    pot.classList.toggle("hidden", !target.paints.includes(p.id));
    pot.querySelector(".count").textContent = c[p.id] ? c[p.id] : "";
  }
  const dots = $("drops");
  dots.innerHTML = "";
  for (const p of drops) {
    const d = document.createElement("span");
    d.style.background = toCss(PAINT[p].rgb);
    dots.appendChild(d);
  }
  $("drop-count").textContent = drops.length + " / " + MAX_DROPS + " drops";
  $("btn-undo").disabled = $("btn-empty").disabled = drops.length === 0;
}

// A drop flies from the paint pot into the bowl, then the bowl changes colour.
function flyDrop(id) {
  const from = $("pot-" + id).querySelector(".blob").getBoundingClientRect();
  const to = $("bowl").getBoundingClientRect();
  const d = document.createElement("div");
  d.className = "flying";
  d.style.background = toCss(PAINT[id].rgb);
  document.body.appendChild(d);
  const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
  const x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
  const anim = d.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)` },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1.2)`, offset: 0.5 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.6)` },
  ], { duration: 380, easing: "ease-in" });
  anim.onfinish = () => {
    d.remove();
    $("ripple").classList.remove("go");
    void $("ripple").offsetWidth;   // restart the ripple animation
    $("ripple").classList.add("go");
    render();
    if (mode === "rush") checkRush();
  };
}

// ---------- 11. adding and taking away paint ----------
function addDrop(id) {
  if (busy || !target.paints.includes(id)) return;
  if (drops.length >= MAX_DROPS) {
    toast("The bowl is full! Undo or empty it.");
    sfx.error();
    return;
  }
  drops.push(id);
  sfx.drop(drops.length);
  flyDrop(id);
}
function undo() {
  if (busy || !drops.length) return;
  drops.pop();
  sfx.undo();
  render();
}
function emptyBowl() {
  if (busy || !drops.length) return;
  drops = [];
  sfx.splash();
  render();
}

function showHint() {
  if (busy || mode !== "levels") return;
  hintUsed = true;
  const used = Object.keys(target.recipe).map(p => PAINT[p].name);
  const list = used.length > 1 ? used.slice(0, -1).join(", ") + " and " + used[used.length - 1] : used[0];
  $("hint-text").textContent = "💡 This colour uses " + list + ". (Now you can get 2 stars at most.)";
  for (const p of PAINTS) $("pot-" + p.id).classList.toggle("hinted", !!target.recipe[p.id]);
  sfx.pop();
}

function recipeHtml(recipe) {
  return PAINTS.filter(p => recipe[p.id]).map(p =>
    '<span class="ing"><i style="background:' + toCss(p.rgb) + '"></i>' + recipe[p.id] + " " + p.name + "</span>"
  ).join(" + ");
}

// ---------- 12. playing the levels ----------
function startLevel(i) {
  mode = "levels";
  levelIndex = i;
  const L = LEVELS[i];
  target = { name: L.name, paints: L.paints, recipe: L.recipe, rgb: mix(L.recipe) };
  drops = [];
  hintUsed = false;
  busy = false;
  document.body.classList.remove("rush");
  $("play-title").textContent = "Level " + (i + 1) + " · " + L.name;
  $("hint-text").textContent = L.tip ? "🖌️ " + L.tip : "";
  for (const p of PAINTS) $("pot-" + p.id).classList.remove("hinted");
  show(null);
  render();
}

function finishLevel() {
  if (busy) return;
  const rgb = currentMix();
  if (!rgb) {
    toast("Add some paint first!");
    sfx.error();
    $("bowl").classList.remove("shake");
    void $("bowl").offsetWidth;
    $("bowl").classList.add("shake");
    return;
  }
  const pct = matchPercent(rgb, target.rgb);
  let stars = starsFor(pct);
  if (hintUsed) stars = Math.min(stars, 2);
  const before = save.stars[levelIndex] || 0;
  if (stars > before) {
    save.stars[levelIndex] = stars;
    writeSave();
  }

  $("res-target").style.background = toCss(target.rgb);
  $("res-mix").style.background = toCss(rgb);
  $("res-title").innerHTML = ["SO <span>CLOSE!</span>", "NICE <span>ONE!</span>", "GREAT <span>MIX!</span>", "PERFECT <span>MATCH!</span>"][stars];
  $("res-stars").innerHTML = [0, 1, 2].map(n => '<span class="' + (n < stars ? "on" : "") + '">★</span>').join("");
  $("res-pct").textContent = pct + "% match";
  $("res-recipe").innerHTML = stars > 0
    ? "One way to make it: " + recipeHtml(target.recipe)
    : "You need " + PASS + "% to pass. " + tipFor(rgb, target.rgb);
  const last = levelIndex === LEVEL_COUNT - 1;
  $("btn-next").classList.toggle("hidden", stars === 0 || last);
  $("btn-retry").textContent = stars === 3 ? "🔁 Play again" : "🔁 Try again";
  if (stars > 0 && last) $("res-recipe").innerHTML += "<br><b>You finished every level! 🎉</b>";
  show("result-screen");
  if (stars > 0) {
    sfx.stars(stars);
    if (stars === 3) confetti();
  } else {
    sfx.fail();
  }
}

function buildLevelGrid() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const btn = document.createElement("button");
    const open = isUnlocked(i);
    const s = save.stars[i] || 0;
    btn.className = "lvl" + (open ? "" : " locked");
    btn.disabled = !open;
    btn.innerHTML = '<span class="lvl-swatch"></span><b>' + (i + 1) + "</b>" +
      '<span class="lvl-stars">' + (open ? "★".repeat(s) + "☆".repeat(3 - s) : "🔒") + "</span>";
    // you only get to see the colour once the level is open
    btn.querySelector(".lvl-swatch").style.background = open ? toCss(mix(L.recipe)) : "#bfb4d6";
    btn.setAttribute("aria-label", "Level " + (i + 1) + (open ? ", " + s + " stars" : ", locked"));
    btn.addEventListener("click", () => { sfx.pop(); startLevel(i); });
    grid.appendChild(btn);
  });
  $("star-total").textContent = totalStars() + " / " + LEVEL_COUNT * 3;
}
function openLevels() {
  stopRush();
  buildLevelGrid();
  show("levels-screen");
}

// ---------- 13. Colour Rush: match as many colours as you can before time runs out ----------
function newRushTarget() {
  const recipe = makeRecipe(Math.random, rush.score >= 6);
  // all 5 pots, so you have to work out which paints you need
  target = { name: colourName(mix(recipe)), paints: "rybwk", recipe, rgb: mix(recipe) };
  drops = [];
  busy = false;
  $("play-title").textContent = "Colour Rush · " + target.name;
  render();
}
function startRush() {
  mode = "rush";
  rush.time = RUSH_TIME;
  rush.score = 0;
  rush.running = true;
  rush.last = performance.now();
  document.body.classList.add("rush");
  $("hint-text").textContent = "Match " + RUSH_MATCH + "% and it counts by itself!";
  for (const p of PAINTS) $("pot-" + p.id).classList.remove("hinted");
  show(null);
  newRushTarget();
  updateRushPill();
  requestAnimationFrame(rushTick);
}
function stopRush() {
  rush.running = false;
  document.body.classList.remove("rush");
}
function rushTick(now) {
  if (!rush.running) return;
  rush.time -= (now - rush.last) / 1000;
  rush.last = now;
  if (rush.time <= 0) {
    rush.time = 0;
    endRush();
    return;
  }
  updateRushPill();
  requestAnimationFrame(rushTick);
}
function updateRushPill() {
  $("rush-time").textContent = Math.ceil(rush.time);
  $("rush-score").textContent = rush.score;
  $("rush-pill").classList.toggle("hurry", rush.time < 10);
}
function checkRush() {
  if (busy || !rush.running) return;
  const pct = matchPercent(currentMix(), target.rgb);
  if (pct < RUSH_MATCH) return;
  busy = true;
  rush.score++;
  updateRushPill();
  sfx.stars(1);
  toast("MATCH! " + pct + "% 🎉");
  $("bowl").classList.add("matched");
  setTimeout(() => {
    $("bowl").classList.remove("matched");
    if (rush.running) newRushTarget();
  }, 650);
}
function skipRush() {
  if (busy || !rush.running) return;
  rush.time = Math.max(0.1, rush.time - SKIP_COST);
  toast("Skipped! −" + SKIP_COST + " seconds");
  sfx.undo();
  newRushTarget();
}
function endRush() {
  stopRush();
  const best = rush.score > save.bestRush;
  if (best) {
    save.bestRush = rush.score;
    writeSave();
  }
  $("rush-final").textContent = rush.score;
  $("rush-best").textContent = best && rush.score > 0 ? "🏆 New best score!" : "Best: " + save.bestRush;
  show("rush-screen");
  sfx.stars(rush.score >= 5 ? 3 : 1);
  if (best && rush.score > 0) confetti();
}

// ---------- 14. little extras: messages and confetti ----------
let toastTimer = 0;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}
function confetti() {
  for (let i = 0; i < 40; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.background = toCss(mix({ [PAINTS[i % 3].id]: 1, w: i % 2 }));
    document.body.appendChild(c);
    const x = Math.random() * innerWidth;
    const drift = (Math.random() - 0.5) * 200;
    c.animate([
      { transform: `translate(${x}px, -20px) rotate(0deg)` },
      { transform: `translate(${x + drift}px, ${innerHeight + 20}px) rotate(${Math.random() * 720}deg)` },
    ], { duration: 1600 + Math.random() * 1200, easing: "cubic-bezier(.3,.6,.6,1)" }).onfinish = () => c.remove();
  }
}

// ---------- 15. sound: little beeps made by the computer ----------
let audio = null, soundOn = true;
try { soundOn = localStorage.getItem(SAVE_KEY + "-sound") !== "off"; } catch (e) { /* fine */ }
function ac() {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (audio.state === "suspended") audio.resume();
  return audio;
}
function tone(freq, dur, type, vol, when, slide) {
  if (!soundOn) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (when || 0);
  const o = a.createOscillator(), gn = a.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
const sfx = {
  // each drop plips a little higher than the one before
  drop(n) { tone(520 + (n % 8) * 40, 0.09, "sine", 0.16, 0, 1.6); tone(900, 0.06, "sine", 0.06, 0.33, 0.5); },
  undo() { tone(500, 0.1, "triangle", 0.1, 0, 0.6); },
  splash() { tone(500, 0.25, "sine", 0.12, 0, 0.4); tone(300, 0.2, "triangle", 0.08, 0.05, 0.5); },
  pop() { tone(700, 0.07, "sine", 0.1, 0, 1.4); },
  error() { tone(150, 0.22, "square", 0.06, 0, 0.8); },
  fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, i * 0.14)); },
  stars(n) { [523, 659, 784, 1047, 1319].slice(0, n + 2).forEach((f, i) => tone(f, 0.3, "triangle", 0.15, i * 0.11)); },
};
function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem(SAVE_KEY + "-sound", soundOn ? "on" : "off"); } catch (e) { /* fine */ }
  $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
  toast(soundOn ? "Sound on 🔊" : "Sound off 🔇");
}

// ---------- 16. buttons and keys ----------
function goTitle() {
  stopRush();
  $("title-best").textContent = save.bestRush ? "Colour Rush best: " + save.bestRush + " colours" : "";
  $("title-stars").textContent = totalStars() ? "⭐ " + totalStars() + " stars so far" : "";
  show("title-screen");
}

$("btn-play").addEventListener("click", () => { sfx.pop(); openLevels(); });
$("btn-rush").addEventListener("click", () => { sfx.pop(); startRush(); });
$("btn-levels-back").addEventListener("click", goTitle);
$("btn-menu").addEventListener("click", () => (mode === "rush" ? goTitle() : openLevels()));
$("btn-sound").addEventListener("click", toggleSound);
$("btn-undo").addEventListener("click", undo);
$("btn-empty").addEventListener("click", emptyBowl);
$("btn-hint").addEventListener("click", showHint);
$("btn-skip").addEventListener("click", skipRush);
$("btn-done").addEventListener("click", finishLevel);
$("btn-next").addEventListener("click", () => startLevel(levelIndex + 1));
$("btn-retry").addEventListener("click", () => startLevel(levelIndex));
$("btn-res-levels").addEventListener("click", openLevels);
$("btn-rush-again").addEventListener("click", startRush);
$("btn-rush-title").addEventListener("click", goTitle);

addEventListener("keydown", e => {
  if (e.key === "m" || e.key === "M") return toggleSound();
  if (document.body.classList.contains("in-menu")) {
    if (e.key === "Escape" && $("title-screen").classList.contains("hidden")) goTitle();
    return;
  }
  const paint = PAINTS.find(p => p.key === e.key);
  if (paint) addDrop(paint.id);
  else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") undo();
  else if (e.key === "x" || e.key === "X" || e.key === "Delete") emptyBowl();
  else if (e.key === "h" || e.key === "H") showHint();
  else if (e.key === "s" || e.key === "S") skipRush();
  else if (e.key === "Enter" && mode === "levels") finishLevel();
  else if (e.key === "Escape") mode === "rush" ? goTitle() : openLevels();
  else return;
  e.preventDefault();
});

// ---------- 17. start! ----------
buildTubes();
$("btn-sound").textContent = soundOn ? "🔊" : "🔇";
// paint the title screen's splats with real mixes, just for fun
document.querySelectorAll(".splat").forEach((s, i) => {
  s.style.background = toCss(mix([{ r: 1, y: 1 }, { y: 1, b: 1 }, { r: 1, b: 1 }, { r: 1, w: 2 }, { b: 1, w: 1 }][i % 5]));
});
target = { name: "", paints: "", recipe: {}, rgb: [1, 1, 1] };
goTitle();
