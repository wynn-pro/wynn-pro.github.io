// ---------- multiplayer ----------
// Two players, two castles. Each player defends their own castle like the normal game, and
// spends money to SEND soldiers and bosses onto the other player's battlefield.
// The players talk through Supabase Realtime (the same Supabase project as the leaderboard):
// a websocket "broadcast" channel per room, so messages arrive in a few dozen milliseconds.
// Nothing is stored in the database.

// what you can send, its price, and how to build it on the other player's field
const SEND_UNITS = [
  { kind: "normal",   name: "Soldier",      icon: "🪖", cost: 10 },
  { kind: "tough",    name: "Armored",      icon: "🛡", cost: 20 },
  { kind: "boss",     name: "Armored car",  icon: "🚙", cost: 60 },
  { kind: "megaboss", name: "Heavy tank",   icon: "🛞", cost: 200 },
  { kind: "giant",    name: "Giant boss",   icon: "👹", cost: 800 },
  { kind: "titan",    name: "Giant giant",  icon: "💀", cost: 5000 },
  { kind: "gorilla",  name: "Gorilla",      icon: "🦍", cost: 25000 },
];
const STATUS_EVERY = 150;   // ms between status updates (only sent when something changed)

const mp = {
  client: null,
  channel: null,
  bot: null,        // set when playing against the bot instead of a person
  room: "",
  me: Math.random().toString(36).slice(2, 10),
  name: "",
  host: false,
  started: false,   // a match is running (or just ended, waiting for a rematch)
  opponent: null,   // { name, castle, max, wave, money, score }
  lastStatus: "",
};

function mpActive() {
  return mp.started && playing;
}

// ---------- the page ----------

const levelsBox = document.getElementById("levels");
const mpPanel = document.createElement("div");
mpPanel.className = "mp-panel";
mpPanel.innerHTML = `
  <button class="level mp-open" id="mp-open" type="button">
    <span class="level-name">⚔ Multiplayer</span>
    <span class="level-info">Play a friend · send soldiers &amp; bosses at their castle</span>
  </button>
  <div class="mp-box" id="mp-box" hidden>
    <h3>⚔ Multiplayer</h3>
    <input id="mp-name" maxlength="16" placeholder="Your name" autocomplete="nickname">
    <div class="mp-row" id="mp-create-row">
      <button type="button" class="mp-btn mp-create" id="mp-create">Create room</button>
    </div>
    <div class="mp-row">
      <input id="mp-code" maxlength="4" placeholder="CODE" autocomplete="off">
      <button type="button" class="mp-btn" id="mp-join">Join</button>
    </div>
    <div class="mp-or">or play a bot</div>
    <div class="mp-row mp-bots" id="mp-bots">
      <button type="button" class="mp-btn mp-bot" data-bot="Easy">🤖 Easy</button>
      <button type="button" class="mp-btn mp-bot" data-bot="Medium">🤖 Medium</button>
      <button type="button" class="mp-btn mp-bot" data-bot="Hard">🤖 Hard</button>
    </div>
    <p class="mp-status" id="mp-status" aria-live="polite"></p>
    <button type="button" class="mp-link" id="mp-back">← Back</button>
  </div>`;
levelsBox.after(mpPanel);

const mpOpen = document.getElementById("mp-open");
const mpBox = document.getElementById("mp-box");
const mpName = document.getElementById("mp-name");
const mpCode = document.getElementById("mp-code");
const mpStatus = document.getElementById("mp-status");

// the "send to enemy" shop, just under the recruit cards
const sendShop = document.createElement("section");
sendShop.className = "send-shop";
sendShop.hidden = true;
sendShop.setAttribute("aria-label", "Send units at your opponent");
const sendLabel = document.createElement("div");
sendLabel.className = "send-label";
sendLabel.textContent = "SEND ➜";
sendShop.appendChild(sendLabel);
const sendButtons = {};
for (const unit of SEND_UNITS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "send-card";
  button.innerHTML = `<span class="send-icon">${unit.icon}</span><span class="send-name">${unit.name}</span>` +
                     `<span class="send-cost">$${unit.cost.toLocaleString()}</span>`;
  button.addEventListener("click", () => mpSend(unit));
  sendButtons[unit.kind] = button;
  sendShop.appendChild(button);
}
document.getElementById("shop").after(sendShop);

// the opponent's castle, in the top left corner of the battlefield
const vsBox = document.createElement("div");
vsBox.className = "vs";
vsBox.hidden = true;
vsBox.innerHTML = `<div class="vs-name" id="vs-name">Opponent</div>
  <div class="bar"><div class="bar-fill" id="vs-fill"></div><span class="bar-text" id="vs-castle">0/0</span></div>
  <div class="vs-info" id="vs-info"></div>`;
document.getElementById("stage").appendChild(vsBox);
const vsName = document.getElementById("vs-name");
const vsFill = document.getElementById("vs-fill");
const vsCastle = document.getElementById("vs-castle");
const vsInfo = document.getElementById("vs-info");

const rematchButton = document.createElement("button");
rematchButton.type = "button";
rematchButton.className = "mp-btn mp-create";
rematchButton.textContent = "Rematch";
rematchButton.hidden = true;
document.getElementById("mp-create-row").appendChild(rematchButton);

try {
  mpName.value = localStorage.getItem("castleDefenseName") || "";
} catch (e) {
  // private window: no saved name
}

function mpSay(words) {
  mpStatus.textContent = words;
}

function opponentName() {
  return mp.opponent ? mp.opponent.name : "Your opponent";
}

function showMpBox(open) {
  mpBox.hidden = !open;
  mpOpen.hidden = open;
  levelsBox.hidden = open;
  leaderboard.hidden = open;
}

mpOpen.addEventListener("click", () => showMpBox(true));
document.getElementById("mp-back").addEventListener("click", () => {
  mpLeave();
  rematchButton.hidden = true;
  showMpBox(false);
  showTitle("Choose your difficulty");
  mpSay("");
});
document.getElementById("mp-create").addEventListener("click", () => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  mpJoin(code, true);
});
document.getElementById("mp-join").addEventListener("click", () => {
  const code = mpCode.value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) {
    mpSay("Type the 4-letter room code your friend sees.");
    return;
  }
  mpJoin(code, false);
});
mpCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    document.getElementById("mp-join").click();
  }
});
rematchButton.addEventListener("click", () => {
  if (mp.bot) {
    botStart(mp.bot.level);
    return;
  }
  if (!mp.channel || !mp.opponent) {
    mpSay("Your opponent has left. Make a new room.");
    return;
  }
  mpPost({ type: "again" });
  mpStart();
});

// ---------- the connection ----------

function mpJoin(code, host) {
  if (!window.supabase) {
    mpSay("Couldn't load the multiplayer library. Check your internet and reload.");
    return;
  }
  mpLeave();
  rematchButton.hidden = true;
  mp.name = (mpName.value.trim() || "Player").slice(0, 16);
  try {
    localStorage.setItem("castleDefenseName", mp.name);
  } catch (e) {
    // fine: the name just isn't remembered
  }
  mp.room = code;
  mp.host = host;
  if (!mp.client) {
    mp.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: { params: { eventsPerSecond: 30 } },
    });
  }
  const channel = mp.client.channel("castle-mp-" + code, {
    config: { broadcast: { self: false, ack: false }, presence: { key: mp.me } },
  });
  mp.channel = channel;
  channel
    .on("broadcast", { event: "msg" }, ({ payload }) => {
      if (channel === mp.channel) {
        mpReceive(payload);
      }
    })
    .on("presence", { event: "sync" }, () => {
      if (channel === mp.channel) {
        mpPresence();
      }
    })
    .subscribe(async (state) => {
      if (channel !== mp.channel) {
        return;
      }
      if (state === "SUBSCRIBED") {
        await channel.track({ name: mp.name, at: Date.now() });
        mpSay(host ? `Room code: ${code} — tell your friend to join it. Waiting…` : `Joining room ${code}…`);
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        mpSay("Couldn't connect to the multiplayer server. Try again.");
      }
    });
  mpSay("Connecting…");
}

function mpLeave() {
  if (mp.channel) {
    mp.client.removeChannel(mp.channel);
  }
  mp.channel = null;
  mp.bot = null;
  mp.started = false;
  mp.opponent = null;
  sendShop.hidden = true;
  vsBox.hidden = true;
}

function mpPost(payload) {
  if (mp.bot) {
    botReceive(payload);
  } else if (mp.channel) {
    mp.channel.send({ type: "broadcast", event: "msg", payload });
  }
}

function mpPresence() {
  const state = mp.channel.presenceState();
  const players = Object.entries(state).map(([id, metas]) => ({ id, ...metas[0] }));
  players.sort((a, b) => a.at - b.at);
  const mine = players.findIndex((p) => p.id === mp.me);
  if (mine >= 2) {
    mpLeave();
    mpSay("That room is full. Make your own room instead.");
    return;
  }
  const other = players.slice(0, 2).find((p) => p.id !== mp.me);
  if (mp.started) {
    if (!other) {
      if (playing) {
        mpWin(opponentName() + " left the game.");
      } else {
        mpSay(opponentName() + " has left. Press Back to leave.");
      }
      mp.opponent = null;
    }
    return;
  }
  if (!other) {
    if (!mp.host && mine >= 0) {
      mpSay(`Nobody else is in room ${mp.room} yet. Check the code, or wait for your friend.`);
    }
    return;
  }
  mp.opponent = { name: other.name || "Opponent", castle: 0, max: 0, wave: 0, money: 0, score: 0 };
  // the player who joined first starts the match for both
  if (players[0].id === mp.me) {
    mpPost({ type: "start", name: mp.name });
    mpStart();
  } else {
    mpSay(`Found ${mp.opponent.name}! Starting…`);
  }
}

function mpReceive(msg) {
  if (!msg) {
    return;
  }
  if (msg.type === "start" && !mp.started) {
    mp.opponent = mp.opponent || { name: String(msg.name || "Opponent").slice(0, 16), castle: 0, max: 0, wave: 0, money: 0, score: 0 };
    mpStart();
  } else if (msg.type === "status" && mp.started && msg.status) {
    // the "start" message can arrive before presence says who the other player is
    mp.opponent = mp.opponent || { name: "Opponent", castle: 0, max: 0, wave: 0, money: 0, score: 0 };
    Object.assign(mp.opponent, msg.status);
    mp.opponent.name = String(mp.opponent.name || "Opponent").slice(0, 16);
    drawVs();
  } else if (msg.type === "send" && mpActive()) {
    mpArrive(msg.kind, msg.from);
  } else if (msg.type === "dead" && mpActive()) {
    mpWin(opponentName() + "'s castle has fallen!");
  } else if (msg.type === "again" && mp.started && !playing) {
    mpStart();
  }
}

// ---------- the match ----------

function mpStart() {
  showMpBox(false);
  rematchButton.hidden = true;
  mp.started = true;
  mp.lastStatus = "";
  startGame("Medium");
  sendShop.hidden = false;
  vsBox.hidden = false;
  drawVs();
  showBanner("VS " + opponentName(), "Defend your castle · spend money to send units at theirs!", true);
  mpSendStatus(true);
}

function mpSend(unit) {
  if (!mpActive()) {
    return;
  }
  if (money < unit.cost) {
    denied(sendButtons[unit.kind], "Not enough money to send a " + unit.name + ".");
    return;
  }
  money -= unit.cost;
  mpPost({ type: "send", kind: unit.kind, from: mp.name });
  buySound();
  toast(unit.icon + " " + unit.name + " sent at " + opponentName() + "!", "good");
  updateInfo();
  mpSendStatus(true);
}

function mpArrive(kind, from) {
  const unit = SEND_UNITS.find((u) => u.kind === kind);
  if (!unit) {
    return;
  }
  // build the unit the way a normal wave would, so it fits the wave you are on
  const y = randint(60, HEIGHT - 60);
  const speed = Math.min(3 + 0.25 * (wave - 1), 6) * difficulty.speed;
  const before = monsters.length;
  if (kind === "normal") {
    addMonster(y, 1 + Math.floor((wave - 1) / 3), speed, "normal");
  } else if (kind === "tough") {
    addMonster(y, 2 + Math.floor((wave - 1) / 2), speed, "tough");
  } else if (kind === "boss") {
    addMonster(y, BOSS_HEALTH + 4 * Math.floor(wave / BOSS_WAVE), 1.5, "boss");
  } else if (kind === "megaboss") {
    addMonster(HEIGHT / 2, MEGA_BOSS_HEALTH + 10 * Math.floor(wave / MEGA_BOSS_WAVE), 0.8, "megaboss");
  } else if (kind === "giant") {
    addMonster(HEIGHT / 2, GIANT_BOSS_HEALTH, 0.4, "giant");
  } else if (kind === "titan") {
    addMonster(HEIGHT / 2, TITAN_HEALTH, 0.3, "titan");
  } else if (kind === "gorilla") {
    addMonster(HEIGHT / 2 - 40, GORILLA_HEALTH, 0.25, "gorilla");
  }
  for (const m of monsters.slice(before)) {
    m.sent = true;   // sent units don't drop their own coin, so sending never pays the defender
  }
  const words = (from || "Opponent") + " sent a " + unit.name + "!";
  if (unit.cost >= 200) {
    showBanner(unit.icon + " INCOMING", words, true);
  } else {
    toast(unit.icon + " " + words, "warn");
  }
}

function mpSendStatus(force = false) {
  if (!mpActive()) {
    return;
  }
  const status = { name: mp.name, castle: castleHealth, max: maxCastleHealth, wave, money, score };
  const key = JSON.stringify(status);
  if (force === true || key !== mp.lastStatus) {
    mp.lastStatus = key;
    mpPost({ type: "status", status });
  }
}

function drawVs() {
  const o = mp.opponent;
  if (!o) {
    return;
  }
  vsName.textContent = "VS " + o.name;
  vsCastle.textContent = Math.max(0, o.castle) + "/" + o.max;
  vsFill.style.width = (o.max ? Math.max(0, o.castle) / o.max * 100 : 0) + "%";
  vsInfo.textContent = "Wave " + o.wave + " · $" + o.money.toLocaleString() + " · " + o.score.toLocaleString() + " pts";
}

function mpLockButtons() {
  if (sendShop.hidden) {
    return;
  }
  for (const unit of SEND_UNITS) {
    sendButtons[unit.kind].classList.toggle("locked", money < unit.cost);
  }
}

function mpEnd(won, why) {
  playing = false;
  monsters = [];
  sendShop.hidden = true;
  showTitle(won ? "🏆 YOU WIN! " + why : "Your castle has fallen. " + opponentName() + " wins!", [
    ["Result", won ? "Victory" : "Defeat"],
    ["Wave reached", String(wave)],
    ["Score", score.toLocaleString()],
  ]);
  showMpBox(true);
  rematchButton.hidden = !mp.opponent;
  mpSay(mp.opponent ? "Press Rematch to play again, or Back to leave." : "Press Back to leave.");
  updateInfo();
}

function mpWin(why) {
  mpEnd(true, why);
  tone(500, 1000, 0.6, "square", 0.12);
}

// ---------- hooks into the normal game ----------

const soloGameOver = gameOver;
gameOver = function () {
  if (mp.started) {
    mpPost({ type: "dead" });
    mpEnd(false, "");
    tone(400, 90, 1.2, "sawtooth", 0.12);
    return;
  }
  soloGameOver();
};

// no pausing in a match: the other player's game keeps going
const soloSetPaused = setPaused;
setPaused = function (on) {
  soloSetPaused(mpActive() ? false : on);
};

// Reset leaves the room too
const soloResetGame = resetGame;
resetGame = function () {
  if (mp.started) {
    mpLeave();
    rematchButton.hidden = true;
    showMpBox(false);
  }
  soloResetGame();
};

// starting a solo game from the title screen leaves the room
const soloStartGame = startGame;
startGame = function (level) {
  if (!mp.started) {
    mpLeave();
    showMpBox(false);
  }
  soloStartGame(level);
};

// sent units drop only the coins they stole, not their own
const soloHitMonster = hitMonster;
hitMonster = function (m, ...rest) {
  const before = coins.length;
  soloHitMonster(m, ...rest);
  if (m.sent && !isAlive(m) && coins.length > before) {
    coins.splice(before, 1);
  }
};

const soloUpdateInfo = updateInfo;
updateInfo = function () {
  soloUpdateInfo();
  mpLockButtons();
};

// no Tab cheat in a match
document.addEventListener("keydown", (event) => {
  if (mpActive() && event.key === "Tab") {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

setInterval(mpSendStatus, STATUS_EVERY);

// ---------- the bot ----------
// The bot doesn't run a real battlefield. It simulates one: it earns money, saves up and sends
// units at you, and its "defense" chews through what you send it. Whatever gets through hurts
// its castle, the same amount a real enemy would hurt yours.

const BOT_LEVELS = {
  //          money per second, defense per second, how quickly it sends, its name
  Easy:   { income: 0.7, defense: 0.8, think: 6, name: "Rookie Bot" },
  Medium: { income: 1.0, defense: 1.0, think: 4, name: "Captain Bot" },
  Hard:   { income: 1.5, defense: 1.3, think: 2, name: "Warlord Bot" },
};
// how hard each unit is for the bot to stop, how long it takes to walk over, and the castle damage
const BOT_THREAT = {
  normal:   { hp: 1,    walk: 12, hurt: 1 },
  tough:    { hp: 3,    walk: 12, hurt: 1 },
  boss:     { hp: 10,   walk: 18, hurt: BOSS_DAMAGE },
  megaboss: { hp: 40,   walk: 30, hurt: MEGA_BOSS_DAMAGE },
  giant:    { hp: 200,  walk: 45, hurt: GIANT_BOSS_DAMAGE },
  titan:    { hp: 900,  walk: 55, hurt: GIANT_BOSS_DAMAGE },
  gorilla:  { hp: 4000, walk: 60, hurt: GIANT_BOSS_DAMAGE },
};

for (const button of document.querySelectorAll(".mp-bot")) {
  button.addEventListener("click", () => {
    mpLeave();
    mp.name = (mpName.value.trim() || "Player").slice(0, 16);
    botStart(button.dataset.bot);
  });
}

function botStart(level) {
  const lvl = BOT_LEVELS[level] || BOT_LEVELS.Medium;
  mp.bot = { level, lvl, time: 0, money: 0, score: 0, wave: 1, castle: CASTLE_HEALTH, max: CASTLE_HEALTH,
             incoming: [], target: null, nextThink: lvl.think };
  mp.opponent = { name: lvl.name, castle: CASTLE_HEALTH, max: CASTLE_HEALTH, wave: 1, money: 0, score: 0 };
  mpStart();
}

function botReceive(msg) {
  const bot = mp.bot;
  if (msg.type === "send" && BOT_THREAT[msg.kind]) {
    const t = BOT_THREAT[msg.kind];
    bot.incoming.push({ hp: t.hp, left: t.walk, hurt: t.hurt });
  }
  // "status", "dead" and "again" need no answer from the bot
}

function botPickTarget(bot) {
  // mostly cheap units early, and it saves up for bosses as the game goes on
  const choices = SEND_UNITS.filter((u) => u.cost <= 60 + bot.wave * bot.wave * 40);
  const weights = choices.map((u, i) => 1 + i * (bot.wave / 4));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < choices.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return choices[i];
    }
  }
  return choices[0];
}

function botTick() {
  const bot = mp.bot;
  if (!bot || !mpActive()) {
    return;
  }
  const lvl = bot.lvl;
  bot.time += 1;
  bot.wave = 1 + Math.floor(bot.time / 30);
  bot.money += Math.round((3 + bot.wave * 1.5) * lvl.income);
  bot.score += bot.wave;
  // its soldiers fight what you sent, oldest first
  let defense = (2 + 2 * bot.wave + bot.wave * bot.wave * 0.3) * lvl.defense;
  for (const u of bot.incoming) {
    const hit = Math.min(defense, u.hp);
    u.hp -= hit;
    defense -= hit;
    u.left -= 1;
    if (u.hp > 0 && u.left <= 0) {
      bot.castle -= u.hurt;
      u.hp = 0;
    } else if (u.hp <= 0) {
      bot.score += 5;
    }
  }
  bot.incoming = bot.incoming.filter((u) => u.hp > 0);
  // now and then, it sends something at you
  bot.nextThink -= 1;
  if (bot.nextThink <= 0) {
    bot.target = bot.target || botPickTarget(bot);
    if (bot.money >= bot.target.cost) {
      bot.money -= bot.target.cost;
      mpArrive(bot.target.kind, mp.opponent.name);
      bot.target = null;
    }
    bot.nextThink = lvl.think + randint(0, 2);
  }
  Object.assign(mp.opponent, { castle: Math.max(0, bot.castle), max: bot.max, wave: bot.wave,
                               money: bot.money, score: bot.score });
  drawVs();
  if (bot.castle <= 0) {
    mpWin(mp.opponent.name + "'s castle has fallen!");
  }
}

setInterval(botTick, 1000);
