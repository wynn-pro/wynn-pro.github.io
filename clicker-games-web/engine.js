// Shared engine for all 10 clicker games.
const GAMES = {
  cookie:  { name: "Cookie Bakery",  icon: "🍪", unit: "cookies",  color: "#c98a4b",
             power: ["Bigger Oven", "Golden Spatula", "Chef Hat"], auto: ["Grandma", "Bakery", "Cookie Factory"], code: "CHOCOCHIP" },
  pizza:   { name: "Pizza Party",    icon: "🍕", unit: "slices",   color: "#e0613a",
             power: ["Sharp Cutter", "Hot Oven", "Pizza Wheel"], auto: ["Delivery Kid", "Pizza Shop", "Pizza Robot"], code: "EXTRACHEESE" },
  donut:   { name: "Donut Shop",     icon: "🍩", unit: "donuts",   color: "#e07aa8",
             power: ["Sprinkles", "Glaze Gun", "Donut Press"], auto: ["Baker", "Fryer", "Donut Machine"], code: "SPRINKLES" },
  icecream:{ name: "Ice Cream Stand",icon: "🍦", unit: "scoops",   color: "#4a9cc4",
             power: ["Big Scoop", "Waffle Cone", "Freezer"], auto: ["Ice Cream Cart", "Parlor", "Ice Cream Plant"], code: "BRAINFREEZE" },
  candy:   { name: "Candy Factory",  icon: "🍬", unit: "candies",  color: "#9a5fd0",
             power: ["Sugar Spoon", "Candy Mold", "Rainbow Mixer"], auto: ["Candy Elf", "Candy Shop", "Sweet Factory"], code: "SUGARRUSH" },
  coin:    { name: "Coin Collector", icon: "🪙", unit: "coins",    color: "#c39a1f",
             power: ["Magnet", "Metal Detector", "Lucky Glove"], auto: ["Coin Finder", "Coin Press", "Mint"], code: "JACKPOT" },
  gem:     { name: "Gem Mine",       icon: "💎", unit: "gems",     color: "#2f9a93",
             power: ["Iron Pickaxe", "Diamond Pickaxe", "Laser Drill"], auto: ["Miner", "Mine Cart", "Drill Rig"], code: "SHINY" },
  gold:    { name: "Gold Bank",      icon: "💰", unit: "gold",     color: "#b8921c",
             power: ["Gold Pan", "Vault Key", "Golden Touch"], auto: ["Bank Teller", "Gold Vault", "Gold Tower"], code: "MIDAS" },
  piggy:   { name: "Piggy Bank",     icon: "🐷", unit: "pennies",  color: "#d9707f",
             power: ["Bigger Slot", "Allowance", "Lemonade Stand"], auto: ["Chores", "Paper Route", "Piggy Empire"], code: "OINK" },
  diamond: { name: "Diamond Tycoon", icon: "👑", unit: "diamonds", color: "#4f72cc",
             power: ["Polish Cloth", "Cutting Wheel", "Royal Jeweler"], auto: ["Jewel Shop", "Diamond Store", "Crown Company"], code: "BLING" },
};

// Codes that work in every game (each once per game).
const SHARED_CODES = { RICH: "money", DOUBLE: "double", AUTO: "auto" };

const id = new URLSearchParams(location.search).get("g");
const G = GAMES[id];
if (!G) location.replace("index.html");

const KEY = "clicker-" + id;
const fresh = () => ({ n: 0, total: 0, power: [0, 0, 0], auto: [0, 0, 0], rebirths: 0, used: [], boost: 0 });
let S = fresh();
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const POWER_BASE = [15, 200, 3000], POWER_ADD = [1, 5, 40];
const AUTO_BASE = [50, 600, 8000], AUTO_ADD = [1, 8, 60];
const cost = (base, owned) => Math.floor(base * Math.pow(1.4, owned));
const mult = () => (1 + S.rebirths) * (Date.now() < S.boost ? 2 : 1);
const perClick = () => (1 + S.power.reduce((a, o, i) => a + o * POWER_ADD[i], 0)) * mult();
const perSec = () => S.auto.reduce((a, o, i) => a + o * AUTO_ADD[i], 0) * mult();
const rebirthCost = () => 10000 * Math.pow(5, S.rebirths);

const fmt = (x) => {
  x = Math.floor(x);
  if (x < 1e4) return x.toLocaleString();
  const u = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"];
  let i = -1;
  while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return x.toFixed(2) + u[i];
};

function gain(x) { S.n += x; S.total += x; }

if (G) {
document.title = G.name;
document.documentElement.style.setProperty("--accent", G.color);
document.body.innerHTML = `
  <a class="back" href="index.html">← All games</a>
  <h1>${G.icon} ${G.name}</h1>
  <div class="count"><span id="n">0</span> ${G.unit}</div>
  <div class="rates"><span id="pc"></span> per click · <span id="ps"></span> per second</div>
  <div id="boost" class="boost"></div>
  <button id="big" class="big" aria-label="Click">${G.icon}</button>
  <div class="cols">
    <section><h2>Click power</h2><div id="power"></div></section>
    <section><h2>Auto-clickers</h2><div id="auto"></div></section>
  </div>
  <section class="wide">
    <h2>Rebirth</h2>
    <p>Reset your ${G.unit} and upgrades to get <b>+1× everything</b> forever. Rebirths: <b id="rb"></b> (×<span id="rbm"></span>)</p>
    <button id="rebirth" class="buy"></button>
  </section>
  <section class="wide">
    <h2>Secret code</h2>
    <form id="codeForm"><input id="code" placeholder="Type a code…" autocomplete="off"><button class="buy">Use</button></form>
    <div id="msg" class="msg"></div>
  </section>
  <button id="reset" class="reset">Erase save</button>`;

const $ = (s) => document.getElementById(s);

function shop(el, names, base, add, owned, label) {
  el.innerHTML = names.map((nm, i) =>
    `<button class="buy" data-i="${i}"><b>${nm}</b> <small>(${owned[i]})</small><br>
     <span>+${add[i]} ${label}</span> · <span class="c"></span></button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const i = +b.dataset.i, c = cost(base[i], owned[i]);
    if (S.n < c) return;
    S.n -= c; owned[i]++; save(); render(true);
  };
}

function render(full) {
  if (full) {
    shop($("power"), G.power, POWER_BASE, POWER_ADD, S.power, "per click");
    shop($("auto"), G.auto, AUTO_BASE, AUTO_ADD, S.auto, "per sec");
  }
  $("n").textContent = fmt(S.n);
  $("pc").textContent = fmt(perClick());
  $("ps").textContent = fmt(perSec());
  [["power", POWER_BASE, S.power], ["auto", AUTO_BASE, S.auto]].forEach(([k, base, owned]) => {
    $(k).querySelectorAll("button").forEach((b, i) => {
      const c = cost(base[i], owned[i]);
      b.querySelector(".c").textContent = fmt(c) + " " + G.unit;
      b.disabled = S.n < c;
    });
  });
  $("rb").textContent = S.rebirths;
  $("rbm").textContent = 1 + S.rebirths;
  $("rebirth").textContent = `Rebirth for ${fmt(rebirthCost())} ${G.unit}`;
  $("rebirth").disabled = S.n < rebirthCost();
  const left = Math.ceil((S.boost - Date.now()) / 1000);
  $("boost").textContent = left > 0 ? `⚡ Double boost: ${left}s` : "";
}

$("big").onclick = (e) => {
  const x = perClick();
  gain(x);
  const f = document.createElement("div");
  f.className = "float";
  f.textContent = "+" + fmt(x);
  f.style.left = (e.clientX || innerWidth / 2) + "px";
  f.style.top = (e.clientY || innerHeight / 2) + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 800);
  render();
};

$("rebirth").onclick = () => {
  if (S.n < rebirthCost()) return;
  if (!confirm(`Rebirth? You lose your ${G.unit} and upgrades but get ×${S.rebirths + 2} forever.`)) return;
  const r = S.rebirths + 1, used = S.used;
  S = fresh(); S.rebirths = r; S.used = used;
  save(); render(true);
};

$("codeForm").onsubmit = (e) => {
  e.preventDefault();
  const c = $("code").value.trim().toUpperCase();
  $("code").value = "";
  const say = (t) => { $("msg").textContent = t; };
  if (!c) return;
  if (S.used.includes(c)) return say("You already used that code!");
  if (c === G.code) { gain(perClick() * 500 + 5000); S.power[2] += 1; say(`🎉 Secret code! Big bonus + a free ${G.power[2]}!`); }
  else if (SHARED_CODES[c] === "money") { gain(1000); say(`💸 +1,000 ${G.unit}!`); }
  else if (SHARED_CODES[c] === "double") { S.boost = Date.now() + 60000; say("⚡ Double everything for 60 seconds!"); }
  else if (SHARED_CODES[c] === "auto") { S.auto[0] += 5; say(`🤖 +5 free ${G.auto[0]}!`); }
  else return say("Nope, that's not a code.");
  S.used.push(c); save(); render(true);
};

$("reset").onclick = () => {
  if (!confirm("Erase all progress in this game?")) return;
  S = fresh(); save(); render(true);
};

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  gain(perSec() * (now - last) / 1000);
  last = now;
  render();
}, 100);
setInterval(save, 3000);
addEventListener("beforeunload", save);
render(true);
}
