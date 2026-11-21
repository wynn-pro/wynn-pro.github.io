// Shared engine for all clicker games. Game list lives in games.js.

// Codes that work in every game (each once per game).
const SHARED_CODES = { RICH: "money", DOUBLE: "double", AUTO: "auto", MEGA: "mega" };

const id = new URLSearchParams(location.search).get("g");
const G = GAMES[id];
if (!G) location.replace("index.html");

const TIERS = 6;
const KEY = "clicker-" + id;
const zeros = () => Array(TIERS).fill(0);
const fresh = () => ({ n: 0, total: 0, power: zeros(), auto: zeros(), rebirths: 0, used: [], boost: 0 });
let S = fresh();
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
// Old saves had 3 upgrades — pad them out to 6.
S.power = [...S.power, ...zeros()].slice(0, TIERS);
S.auto = [...S.auto, ...zeros()].slice(0, TIERS);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const POWER_BASE = [15, 150, 2000, 25000, 300000, 4e6];
const POWER_ADD  = [2, 15, 120, 1000, 9000, 80000];
const AUTO_BASE  = [40, 500, 6000, 80000, 1e6, 1.5e7];
const AUTO_ADD   = [3, 25, 200, 1800, 16000, 150000];
const cost = (base, owned) => Math.floor(base * Math.pow(1.35, owned));
const mult = () => Math.pow(2, S.rebirths) * (Date.now() < S.boost ? 2 : 1);
const perClick = () => (1 + S.power.reduce((a, o, i) => a + o * POWER_ADD[i], 0)) * mult();
const perSec = () => S.auto.reduce((a, o, i) => a + o * AUTO_ADD[i], 0) * mult();
const rebirthCost = () => 1e6 * Math.pow(10, S.rebirths);

const fmt = (x) => {
  x = Math.floor(x);
  if (x < 1e4) return x.toLocaleString();
  const u = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let i = -1;
  while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return x.toFixed(2) + u[i];
};

function gain(x) { S.n += x; S.total += x; }

if (G) {
const powerNames = [...G.power, "Mega " + G.power[0], "Ultra " + G.power[1], "Galaxy " + G.power[2]];
const autoNames  = [...G.auto,  "Mega " + G.auto[0],  "Ultra " + G.auto[1],  "Galaxy " + G.auto[2]];

document.title = G.name;
document.documentElement.style.setProperty("--accent", G.color);
document.body.innerHTML = `
  <a class="back" href="index.html">← All games</a>
  <h1>${G.icon} ${G.name}</h1>
  <div class="count"><span id="n">0</span></div>
  <div class="unit">${G.unit}</div>
  <div class="rates"><b id="pc"></b> per click · <b id="ps"></b> per second</div>
  <div id="boost" class="boost"></div>
  <button id="big" class="big" aria-label="Click">${G.icon}</button>
  <div class="cols">
    <section><h2>Click power</h2><div id="power"></div></section>
    <section><h2>Auto-clickers</h2><div id="auto"></div></section>
  </div>
  <section class="wide">
    <h2>Rebirth</h2>
    <p>Reset your ${G.unit} and upgrades to <b>DOUBLE everything</b> forever. Rebirths: <b id="rb"></b> (×<span id="rbm"></span>)</p>
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
     <span>+${fmt(add[i])} ${label}</span> · <span class="c"></span></button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const i = +b.dataset.i, c = cost(base[i], owned[i]);
    if (S.n < c) return;
    S.n -= c; owned[i]++; save(); render(true);
  };
}

function render(full) {
  if (full) {
    shop($("power"), powerNames, POWER_BASE, POWER_ADD, S.power, "per click");
    shop($("auto"), autoNames, AUTO_BASE, AUTO_ADD, S.auto, "per sec");
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
  $("rbm").textContent = fmt(Math.pow(2, S.rebirths));
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
  if (!confirm(`Rebirth? You lose your ${G.unit} and upgrades but get ×${fmt(Math.pow(2, S.rebirths + 1))} forever.`)) return;
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
  if (c === G.code) { gain(perClick() * 1000 + 50000); S.power[2] += 1; say(`🎉 Secret code! Huge bonus + a free ${powerNames[2]}!`); }
  else if (SHARED_CODES[c] === "money") { gain(100000); say(`💸 +100,000 ${G.unit}!`); }
  else if (SHARED_CODES[c] === "double") { S.boost = Date.now() + 120000; say("⚡ Double everything for 2 minutes!"); }
  else if (SHARED_CODES[c] === "auto") { S.auto[0] += 10; S.auto[1] += 3; say(`🤖 +10 ${autoNames[0]} and +3 ${autoNames[1]}!`); }
  else if (SHARED_CODES[c] === "mega") { S.power[3] += 1; S.auto[3] += 1; say(`🚀 Free ${powerNames[3]} and ${autoNames[3]}!`); }
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
