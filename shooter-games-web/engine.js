// Shared cartoon shooter engine for all 10 games.
// Controls: keyboard (WASD/arrows + Space), mouse (aim + click), touch (left stick + tap to aim), gamepad.
(function () {
  const KINDS = {
    blob:   { type: 'alien', hp: 2,  speed: 70,  r: 17, color: '#7ed957', score: 10, coin: 1 },
    zippy:  { type: 'alien', hp: 1,  speed: 150, r: 12, color: '#c77dff', score: 15, coin: 1 },
    ufo:    { type: 'alien', hp: 3,  speed: 80,  r: 18, color: '#4dd4c6', score: 20, coin: 2, shoot: true },
    robo:   { type: 'robot', hp: 4,  speed: 60,  r: 18, color: '#b0b7c3', score: 15, coin: 2 },
    tank:   { type: 'robot', hp: 12, speed: 35,  r: 28, color: '#ff9f43', score: 40, coin: 4 },
    zapper: { type: 'robot', hp: 3,  speed: 55,  r: 16, color: '#54a0ff', score: 25, coin: 2, shoot: true },
  };
  const PW = {
    triple:  { c: '#ff9f43', l: '3', name: 'Triple Shot' },
    shield:  { c: '#54a0ff', l: 'S', name: 'Shield' },
    laser:   { c: '#ff4d6d', l: 'L', name: 'Laser' },
    rockets: { c: '#a55eea', l: 'R', name: 'Rockets' },
    speed:   { c: '#feca57', l: '⚡', name: 'Speed Boost' },
  };
  const PW_KEYS = Object.keys(PW);
  const FONT = '"Comic Sans MS","Chalkboard SE","Marker Felt",sans-serif';
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  window.ShooterGame = function (cfg) {
    const C = Object.assign({
      id: 'game', title: 'Shooter', view: 'top', bg: ['#7dd3fc', '#bae6fd'], deco: 'clouds',
      playerColor: '#ff6b6b', kinds: ['blob', 'robo'], bossEvery: 5, bossType: 'alien', ramp: 1,
      fireRate: 5, startBots: 1, countMult: 1, speedMult: 1, bossHp: 1, startPw: null, turretRadius: 80,
      blurb: 'Blast the invaders!',
    }, cfg);
    document.title = C.title;

    // ---------- page setup ----------
    const style = document.createElement('style');
    style.textContent = `
      html,body{margin:0;height:100%;overflow:hidden;background:${C.bg[1]};font-family:${FONT};touch-action:none;user-select:none;-webkit-user-select:none}
      canvas{display:block}
      .ov{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(20,20,40,.55);z-index:5;padding:16px;box-sizing:border-box}
      .card{background:#fff8e7;border:5px solid #222;border-radius:24px;padding:20px;max-width:640px;width:100%;max-height:92vh;overflow:auto;text-align:center;box-shadow:0 10px 0 #222}
      .card h1{margin:0 0 6px;font-size:34px;color:#ff6b6b;text-shadow:3px 3px 0 #222;-webkit-text-stroke:1px #222}
      .card h2{margin:4px 0 10px;font-size:22px}
      .card p{margin:6px 0;font-size:16px}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}
      .ov button{font-family:inherit;font-size:17px;font-weight:bold;padding:10px 12px;border:4px solid #222;border-radius:14px;background:#ffd166;cursor:pointer;box-shadow:0 4px 0 #222}
      .ov button:active{transform:translateY(3px);box-shadow:0 1px 0 #222}
      .ov button:disabled{background:#ddd;color:#888}
      .ov button.go{background:#06d6a0;font-size:22px;padding:12px 26px}
      .ov button.focus{outline:4px solid #ff4d6d;outline-offset:2px}
      .ov small{display:block;font-weight:normal;font-size:13px}
      .hudbtns{position:fixed;top:10px;right:10px;display:flex;gap:8px;z-index:4}
      .hudbtns button{font-size:22px;width:46px;height:46px;border:4px solid #222;border-radius:14px;background:#fff;cursor:pointer;box-shadow:0 3px 0 #222}
      .toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 18px;border-radius:14px;font-size:20px;z-index:9;pointer-events:none;transition:opacity .3s}
      .ctl{font-size:14px;text-align:left;background:#fff;border:3px solid #222;border-radius:14px;padding:8px 12px;margin:10px 0}
    `;
    document.head.appendChild(style);
    const cv = document.createElement('canvas');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const ov = document.createElement('div'); ov.className = 'ov'; document.body.appendChild(ov);
    const hudBtns = document.createElement('div'); hudBtns.className = 'hudbtns';
    hudBtns.innerHTML = '<button data-act="code" title="Secret code (C)">🔑</button><button data-act="pause" title="Pause (P)">⏸</button>';
    document.body.appendChild(hudBtns);
    const toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.style.opacity = 0; document.body.appendChild(toastEl);

    let W, H;
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (S && C.view === 'turret') { S.p.cx = W / 2; S.p.cy = H / 2; }
    }
    addEventListener('resize', resize);

    const bestKey = 'shooter_best_' + C.id;
    const getBest = () => { try { return +localStorage.getItem(bestKey) || 0; } catch (e) { return 0; } };
    const setBest = (v) => { try { localStorage.setItem(bestKey, v); } catch (e) {} };

    let toastT;
    function toast(msg) {
      toastEl.textContent = msg; toastEl.style.opacity = 1;
      clearTimeout(toastT); toastT = setTimeout(() => (toastEl.style.opacity = 0), 1800);
    }

    // ---------- input ----------
    const keys = {};
    const mouse = { x: 0, y: 0, down: false };
    let aimSrc = 'auto';
    let joy = null, touchAim = null, touchUsed = false;
    let pad = null, prevBtn = [];

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) aimSrc = 'auto';
      if (e.code === 'KeyC') return askCode();
      if (e.code === 'KeyP' || e.code === 'Escape') return togglePause();
      if (e.code === 'KeyF' && S) { S.auto = !S.auto; toast(S.auto ? '🔫 Auto-fire ON' : '🔫 Auto-fire OFF (hold to shoot)'); }
      if (ovOpen()) {
        if (e.code === 'Enter') { e.preventDefault(); clickPrimary(); }
        const n = parseInt(e.key, 10);
        if (S && S.state === 'shop' && n >= 1 && n <= ITEMS.length) buy(ITEMS[n - 1].id);
      }
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
    cv.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; aimSrc = 'mouse'; });
    cv.addEventListener('mousedown', (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; aimSrc = 'mouse'; });
    addEventListener('mouseup', () => { mouse.down = false; });

    function onTouch(e) {
      e.preventDefault(); touchUsed = true;
      for (const t of e.changedTouches) {
        if (e.type === 'touchstart') {
          if (t.clientX < W / 2 && !joy) joy = { id: t.identifier, sx: t.clientX, sy: t.clientY, x: t.clientX, y: t.clientY };
          else touchAim = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else if (e.type === 'touchmove') {
          if (joy && t.identifier === joy.id) { joy.x = t.clientX; joy.y = t.clientY; }
          if (touchAim && t.identifier === touchAim.id) { touchAim.x = t.clientX; touchAim.y = t.clientY; }
        } else {
          if (joy && t.identifier === joy.id) joy = null;
          if (touchAim && t.identifier === touchAim.id) touchAim = null;
        }
      }
      aimSrc = 'touch';
    }
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((n) => cv.addEventListener(n, onTouch, { passive: false }));

    // overlay buttons (mouse / touch / keyboard / gamepad)
    let focusIdx = 0;
    const ovOpen = () => ov.style.display === 'flex';
    const ovButtons = () => [...ov.querySelectorAll('button:not(:disabled)')];
    function setFocus(i) {
      const b = ovButtons(); if (!b.length) return;
      focusIdx = (i + b.length) % b.length;
      b.forEach((x, j) => x.classList.toggle('focus', j === focusIdx));
    }
    function clickPrimary() { const b = ov.querySelector('button.go'); if (b) b.click(); }
    function showOverlay(html) { ov.innerHTML = '<div class="card">' + html + '</div>'; ov.style.display = 'flex'; setFocus(0); }
    function hideOverlay() { ov.style.display = 'none'; ov.innerHTML = ''; }
    function onAct(act) {
      if (!act) return;
      if (act === 'start' || act === 'restart') newGame();
      else if (act === 'next') nextWave();
      else if (act === 'resume' || act === 'pause') togglePause();
      else if (act === 'code') askCode();
      else if (act.startsWith('buy:')) buy(act.slice(4));
    }
    ov.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) onAct(b.dataset.act); });
    hudBtns.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { onAct(b.dataset.act); b.blur(); } });

    function pollPad() {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      let g = null;
      for (const x of gps) if (x) { g = x; break; }
      if (!g) { pad = null; return; }
      const btn = g.buttons.map((b) => b.pressed);
      const pressed = (i) => btn[i] && !prevBtn[i];
      const ax = g.axes.map((v) => (Math.abs(v) > 0.2 ? v : 0));
      pad = { ax, fire: btn[0] || btn[5] || btn[6] || btn[7] };
      if (ax[0] || ax[1] || btn.some(Boolean)) { if (aimSrc === 'mouse' || aimSrc === 'touch') aimSrc = 'auto'; }
      if (ovOpen()) {
        if (pressed(12) || pressed(14)) setFocus(focusIdx - 1);
        if (pressed(13) || pressed(15)) setFocus(focusIdx + 1);
        if (pressed(0)) { const b = ovButtons()[focusIdx]; if (b) b.click(); }
        if (pressed(9)) clickPrimary();
      } else if (pressed(9)) togglePause();
      else if (pressed(3)) askCode();
      prevBtn = btn;
    }

    function getMove() {
      let x = 0, y = 0;
      if (keys.KeyA || keys.ArrowLeft) x--;
      if (keys.KeyD || keys.ArrowRight) x++;
      if (keys.KeyW || keys.ArrowUp) y--;
      if (keys.KeyS || keys.ArrowDown) y++;
      if (joy) { x += (joy.x - joy.sx) / 50; y += (joy.y - joy.sy) / 50; }
      if (pad) { x += pad.ax[0] || 0; y += pad.ax[1] || 0; }
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y };
    }
    const shootHeld = () => mouse.down || keys.Space || !!touchAim || (pad && pad.fire);

    function nearestEnemy(from, maxD = 1e9) {
      let best = null, bd = maxD;
      for (const e of S.enemies) { const d = dist(from, e); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    function getAim(p) {
      if (C.view === 'space') return -Math.PI / 2;
      if (C.view === 'side') return 0;
      if (pad && (Math.abs(pad.ax[2] || 0) > 0.4 || Math.abs(pad.ax[3] || 0) > 0.4)) return Math.atan2(pad.ax[3], pad.ax[2]);
      if (touchAim) return Math.atan2(touchAim.y - p.y, touchAim.x - p.x);
      if (aimSrc === 'mouse') return Math.atan2(mouse.y - p.y, mouse.x - p.x);
      const t = nearestEnemy(p);
      return t ? Math.atan2(t.y - p.y, t.x - p.x) : p.angle;
    }

    // ---------- game state ----------
    let S = null;
    const ITEMS = [
      { id: 'dmg',  name: '💥 Damage +1',      base: 20, buy: () => (S.p.dmg += 1) },
      { id: 'rate', name: '🔫 Fire Rate +20%', base: 20, buy: () => (S.p.rate *= 1.2) },
      { id: 'hp',   name: '❤️ Max HP +25',      base: 25, buy: () => { S.p.maxHp += 25; S.p.hp += 25; } },
      { id: 'heal', name: '🩹 Full Heal',       base: 15, flat: true, buy: () => (S.p.hp = S.p.maxHp) },
      { id: 'spd',  name: '👟 Speed +10%',      base: 15, buy: () => (S.p.speed *= 1.1) },
      { id: 'bot',  name: '🤖 New Bot Buddy',   base: 40, max: 6, buy: () => S.bots.push({ cd: 0 }) },
      { id: 'botp', name: '🔧 Bot Power +1',    base: 30, buy: () => (S.botLvl += 1) },
      { id: 'pw',   name: '🎁 Power-up Next Wave', base: 25, flat: true, buy: () => S.startPw.push(pick(PW_KEYS)) },
    ];
    const cost = (it) => Math.round(it.base * (it.flat ? 1 : Math.pow(1.45, S.lv[it.id] || 0)));

    function newGame() {
      hideOverlay();
      const p = {
        x: W / 2, y: H / 2, r: 20, hp: 100, maxHp: 100, dmg: 1, rate: C.fireRate, speed: 270,
        cd: 0, rcd: 0, angle: -Math.PI / 2, inv: 0, cx: W / 2, cy: H / 2,
      };
      if (C.view === 'space') { p.y = H * 0.8; }
      if (C.view === 'side') { p.x = W * 0.15; p.angle = 0; }
      S = {
        state: 'play', wave: 0, score: 0, coins: 0, t: 0, p, auto: true, god: false, shake: 0,
        pw: { triple: 0, shield: 0, laser: 0, rockets: 0, speed: 0 },
        bots: [], botLvl: 1, lv: {}, startPw: C.startPw ? [C.startPw] : [],
        enemies: [], bullets: [], ebullets: [], drops: [], parts: [], texts: [],
        toSpawn: 0, spawnCd: 0, clearT: 0, banner: null,
      };
      for (let i = 0; i < C.startBots; i++) S.bots.push({ cd: 0 });
      nextWave();
    }

    function nextWave() {
      hideOverlay();
      S.wave++;
      S.state = 'play';
      const boss = S.wave % C.bossEvery === 0;
      S.toSpawn = Math.round((5 + S.wave * 3) * C.countMult * (boss ? 0.5 : 1));
      S.spawnCd = 1;
      S.ebullets = [];
      for (const k of S.startPw) S.pw[k] = 15;
      S.startPw = [];
      S.banner = { text: boss ? '⚠️ BOSS WAVE ' + S.wave + '!' : 'WAVE ' + S.wave, t: 2 };
      if (boss) spawnBoss();
    }

    const scale = () => 1 + (S.wave - 1) * 0.18 * C.ramp;
    const spdScale = () => (1 + (S.wave - 1) * 0.04 * C.ramp) * C.speedMult;

    function spawnPos(e) {
      if (C.view === 'space') { e.x = rand(30, W - 30); e.y = -40; }
      else if (C.view === 'side') { e.x = W + 40; e.y = rand(40, H - 40); }
      else {
        const s = Math.floor(Math.random() * 4);
        e.x = s === 0 ? -40 : s === 1 ? W + 40 : rand(0, W);
        e.y = s === 2 ? -40 : s === 3 ? H + 40 : rand(0, H);
      }
    }
    function pickKind() {
      const n = Math.min(C.kinds.length, 1 + Math.floor((S.wave + 1) / 2));
      return C.kinds[Math.floor(Math.random() * n)];
    }
    function spawnEnemy(kind) {
      const d = KINDS[kind];
      const e = {
        kind, type: d.type, color: d.color, r: d.r, hp: d.hp * scale(), maxHp: d.hp * scale(),
        speed: d.speed * spdScale(), shoot: d.shoot, score: d.score, coin: d.coin,
        fireCd: rand(1.5, 3.5), t: rand(0, 6), flash: 0, boss: false,
      };
      spawnPos(e);
      S.enemies.push(e);
    }
    function spawnBoss() {
      let type = C.bossType;
      if (type === 'mix') type = S.wave % 2 ? 'alien' : 'robot';
      const hp = 45 * (1 + S.wave * 0.35) * C.bossHp;
      const e = {
        kind: 'boss', type, color: type === 'alien' ? '#ff6bcb' : '#8395a7', r: 58, hp, maxHp: hp,
        speed: 45 * C.speedMult, shoot: true, score: 500, coin: 0, fireCd: 2, t: 0, flash: 0, boss: true,
      };
      spawnPos(e);
      if (C.view === 'space') e.y = -70; else if (C.view === 'side') e.x = W + 70;
      S.enemies.push(e);
    }

    // ---------- update ----------
    function hurt(n) {
      if (S.god || S.p.inv > 0 || S.state !== 'play') return;
      S.p.inv = 0.6;
      if (S.pw.shield > 0) { burst(S.p.x, S.p.y, '#54a0ff', 8); return; }
      S.p.hp -= n; S.shake = 10;
      burst(S.p.x, S.p.y, '#ff4d6d', 12);
      if (S.p.hp <= 0) { S.p.hp = 0; gameOver(); }
    }
    function burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(60, 260);
        S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), color, r: rand(3, 7) });
      }
    }
    function floatText(x, y, text, color = '#fff') { S.texts.push({ x, y, text, color, life: 0.9 }); }

    function damage(e, d) {
      if (e.hp <= 0) return;
      e.hp -= d; e.flash = 0.08;
      if (e.hp <= 0) kill(e);
    }
    function kill(e) {
      const pts = Math.round(e.score * (1 + S.wave * 0.1));
      S.score += pts;
      floatText(e.x, e.y - e.r, '+' + pts, '#ffd166');
      burst(e.x, e.y, e.color, e.boss ? 60 : 14);
      if (e.boss) {
        S.shake = 16;
        floatText(e.x, e.y, 'KABOOM!', '#ff4d6d');
        for (let i = 0; i < 12; i++) S.drops.push(mkDrop(e.x, e.y, 'coin', 5 * S.wave));
        for (let i = 0; i < 2; i++) S.drops.push(mkDrop(e.x, e.y, pick(PW_KEYS)));
      } else {
        S.drops.push(mkDrop(e.x, e.y, 'coin', e.coin * (1 + Math.floor(S.wave / 3))));
        if (Math.random() < 0.08) S.drops.push(mkDrop(e.x, e.y, pick(PW_KEYS)));
      }
    }
    function mkDrop(x, y, type, value = 0) {
      const a = rand(0, Math.PI * 2), s = rand(40, 160);
      return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, type, value, life: 12 };
    }
    function explode(x, y, rad, dmg) {
      burst(x, y, '#ff9f43', 16);
      S.parts.push({ x, y, vx: 0, vy: 0, life: 0.25, color: 'ring', r: rad });
      for (const e of S.enemies) if (dist({ x, y }, e) < rad + e.r) damage(e, dmg);
    }

    function fire() {
      const p = S.p;
      const angs = S.pw.triple > 0 ? [-0.22, 0, 0.22] : [0];
      const laser = S.pw.laser > 0;
      for (const da of angs) {
        const a = p.angle + da, sp = laser ? 1100 : 650;
        S.bullets.push({
          x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: laser ? 5 : 6, dmg: laser ? p.dmg * 0.8 : p.dmg, laser, pierce: laser, hits: laser ? new Set() : null, life: 2,
        });
      }
    }
    function fireRocket(off) {
      const p = S.p, a = p.angle + off;
      S.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 7, dmg: p.dmg * 3, rocket: true, life: 2.5 });
    }
    function home(b, dt) {
      const t = nearestEnemy(b, 700);
      if (!t) return;
      const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(t.y - b.y, t.x - b.x);
      let d = want - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const na = cur + Math.max(-6 * dt, Math.min(6 * dt, d)), sp = Math.hypot(b.vx, b.vy) + 300 * dt;
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }

    function clampPlayer(p) {
      if (C.view === 'turret') {
        const dx = p.x - p.cx, dy = p.y - p.cy, d = Math.hypot(dx, dy);
        if (d > C.turretRadius) { p.x = p.cx + dx / d * C.turretRadius; p.y = p.cy + dy / d * C.turretRadius; }
        return;
      }
      const minY = C.view === 'space' ? H * 0.35 : 20;
      const maxX = C.view === 'side' ? W * 0.6 : W - 20;
      p.x = Math.max(20, Math.min(maxX, p.x));
      p.y = Math.max(minY, Math.min(H - 20, p.y));
    }

    function updateEnemy(e, dt) {
      const p = S.p;
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      if (e.boss) {
        if (C.view === 'space') { e.y += (H * 0.2 - e.y) * dt; e.x = W / 2 + Math.sin(e.t * 0.7) * W * 0.32; }
        else if (C.view === 'side') { e.x += (W * 0.82 - e.x) * dt; e.y = H / 2 + Math.sin(e.t * 0.7) * H * 0.32; }
        else { const a = Math.atan2(p.y - e.y, p.x - e.x); e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
      } else if (C.view === 'space') {
        e.y += e.speed * dt;
        e.x += (Math.sin(e.t * 2) * 0.6 + Math.sign(p.x - e.x) * 0.25) * e.speed * dt;
        if (e.y > H + 40) { e.y = -40; e.x = rand(30, W - 30); }
      } else if (C.view === 'side') {
        e.x -= e.speed * dt;
        e.y += (Math.sin(e.t * 2) * 0.6 + Math.sign(p.y - e.y) * 0.25) * e.speed * dt;
        if (e.x < -40) { e.x = W + 40; e.y = rand(40, H - 40); }
      } else {
        const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.t * 3) * 0.4;
        e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      }
      if (e.shoot) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          if (e.boss) {
            e.fireCd = Math.max(0.8, 1.8 - S.wave * 0.05);
            const ring = e.t % 6 < 3;
            const n = ring ? 12 : 5;
            for (let i = 0; i < n; i++) {
              const aa = ring ? (i / n) * Math.PI * 2 + e.t : a + (i - 2) * 0.18;
              S.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 210, vy: Math.sin(aa) * 210, r: 9, dmg: 12 });
            }
          } else {
            e.fireCd = rand(1.8, 3.2) / (1 + S.wave * 0.05);
            S.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 7, dmg: 10 });
          }
        }
      }
      if (dist(e, p) < e.r + p.r) {
        if (e.boss) {
          hurt(30);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          p.x += Math.cos(a) * 60; p.y += Math.sin(a) * 60; clampPlayer(p);
        } else {
          hurt(15); e.gone = true; burst(e.x, e.y, e.color, 10);
        }
      }
    }

    function updateBots(dt) {
      const p = S.p, n = S.bots.length;
      S.bots.forEach((b, i) => {
        const a = S.t * 1.5 + (i / n) * Math.PI * 2;
        b.x = p.x + Math.cos(a) * 58; b.y = p.y + Math.sin(a) * 58;
        b.cd -= dt;
        const t = nearestEnemy(b, 650);
        b.angle = t ? Math.atan2(t.y - b.y, t.x - b.x) : a;
        if (t && b.cd <= 0) {
          b.cd = 0.45;
          S.bullets.push({ x: b.x, y: b.y, vx: Math.cos(b.angle) * 600, vy: Math.sin(b.angle) * 600, r: 5, dmg: 0.4 + 0.4 * S.botLvl, life: 1.5, bot: true });
        }
      });
    }

    const off = (o, m = 60) => o.x < -m || o.x > W + m || o.y < -m || o.y > H + m;

    function update(dt) {
      const p = S.p;
      S.t += dt;
      for (const k in S.pw) if (S.pw[k] > 0) S.pw[k] = Math.max(0, S.pw[k] - dt);
      p.inv = Math.max(0, p.inv - dt);
      S.shake = Math.max(0, S.shake - dt * 30);
      if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }

      const mv = getMove();
      const spd = p.speed * (S.pw.speed > 0 ? 1.6 : 1);
      p.x += mv.x * spd * dt; p.y += mv.y * spd * dt;
      clampPlayer(p);
      p.angle = getAim(p);

      p.cd -= dt;
      if ((S.auto || shootHeld()) && p.cd <= 0) { p.cd = 1 / (p.rate * (S.pw.speed > 0 ? 1.5 : 1)); fire(); }
      if (S.pw.rockets > 0) { p.rcd -= dt; if (p.rcd <= 0) { p.rcd = 0.55; fireRocket(-0.6); fireRocket(0.6); } }

      updateBots(dt);

      if (S.toSpawn > 0) {
        S.spawnCd -= dt;
        if (S.spawnCd <= 0) {
          S.spawnCd = Math.max(0.15, 1.1 - S.wave * 0.06) / C.countMult;
          S.toSpawn--; spawnEnemy(pickKind());
        }
      }
      for (const e of S.enemies) updateEnemy(e, dt);

      for (const b of S.bullets) {
        if (b.rocket) home(b, dt);
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (off(b)) b.life = 0;
        if (b.life <= 0) continue;
        for (const e of S.enemies) {
          if (e.hp <= 0 || e.gone) continue;
          if (b.hits && b.hits.has(e)) continue;
          const rr = e.r + b.r;
          if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
            if (b.rocket) { explode(b.x, b.y, 70, b.dmg); b.life = 0; break; }
            damage(e, b.dmg);
            if (b.pierce) b.hits.add(e); else { b.life = 0; break; }
          }
        }
      }
      for (const b of S.ebullets) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (off(b, 40)) b.dead = true;
        else if (dist(b, p) < b.r + p.r - 4) { b.dead = true; hurt(b.dmg); }
      }
      for (const d of S.drops) {
        d.life -= dt;
        const dd = dist(d, p);
        if (dd < 140) { const a = Math.atan2(p.y - d.y, p.x - d.x); d.vx = Math.cos(a) * 420; d.vy = Math.sin(a) * 420; }
        else { d.vx *= 0.94; d.vy *= 0.94; }
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (dd < p.r + 14) { d.life = 0; pickup(d); }
      }
      for (const q of S.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt; }
      for (const t of S.texts) { t.y -= 40 * dt; t.life -= dt; }

      S.enemies = S.enemies.filter((e) => e.hp > 0 && !e.gone);
      S.bullets = S.bullets.filter((b) => b.life > 0);
      S.ebullets = S.ebullets.filter((b) => !b.dead);
      S.drops = S.drops.filter((d) => d.life > 0);
      S.parts = S.parts.filter((q) => q.life > 0);
      S.texts = S.texts.filter((t) => t.life > 0);

      if (S.state === 'play' && S.toSpawn === 0 && S.enemies.length === 0) {
        S.clearT += dt;
        if (S.clearT > 1.3) {
          S.clearT = 0;
          for (const d of S.drops) if (d.type === 'coin') S.coins += d.value;
          S.drops = [];
          openShop();
        }
      }
    }

    function pickup(d) {
      if (d.type === 'coin') { S.coins += d.value; return; }
      S.pw[d.type] = 10;
      floatText(S.p.x, S.p.y - 30, PW[d.type].name + '!', PW[d.type].c);
    }

    // ---------- menus ----------
    function openShop() {
      S.state = 'shop';
      renderShop();
    }
    function renderShop() {
      const btns = ITEMS.map((it, i) => {
        const c = cost(it);
        const maxed = it.max && S.bots.length >= it.max && it.id === 'bot';
        return `<button data-act="buy:${it.id}" ${S.coins < c || maxed ? 'disabled' : ''}>${i + 1}. ${it.name}<small>${maxed ? 'MAX' : '🪙 ' + c.toLocaleString()}</small></button>`;
      }).join('');
      const keepFocus = focusIdx;
      showOverlay(`
        <h1>🛒 SHOP</h1>
        <h2>Wave ${S.wave} cleared! 🪙 ${S.coins.toLocaleString()} coins</h2>
        <p>❤️ ${Math.ceil(S.p.hp)}/${S.p.maxHp} · 💥 ${S.p.dmg} · 🤖 x${S.bots.length} (lvl ${S.botLvl})</p>
        <div class="grid">${btns}</div>
        <button class="go" data-act="next">▶ Next Wave</button>
        <button data-act="code">🔑 Code</button>`);
      setFocus(Math.min(keepFocus, ovButtons().length - 1));
    }
    function buy(id) {
      if (!S || S.state !== 'shop') return;
      const it = ITEMS.find((x) => x.id === id);
      if (!it) return;
      const c = cost(it);
      if (S.coins < c) return;
      if (it.id === 'bot' && S.bots.length >= it.max) return;
      S.coins -= c;
      S.lv[id] = (S.lv[id] || 0) + 1;
      it.buy();
      renderShop();
    }
    function togglePause() {
      if (!S) return;
      if (S.state === 'play') {
        S.state = 'paused';
        showOverlay(`<h1>⏸ Paused</h1><button class="go" data-act="resume">▶ Resume</button> <button data-act="code">🔑 Code</button>`);
      } else if (S.state === 'paused') { S.state = 'play'; hideOverlay(); }
    }
    function gameOver() {
      S.state = 'over';
      const best = Math.max(getBest(), S.score);
      setBest(best);
      setTimeout(() => showOverlay(`
        <h1>💀 GAME OVER</h1>
        <h2>Score: ${S.score.toLocaleString()}</h2>
        <p>Reached wave ${S.wave} · Best: ${best.toLocaleString()}</p>
        <button class="go" data-act="restart">🔄 Play Again</button>`), 600);
    }
    function askCode() {
      if (!S) return toast('Start the game first!');
      const wasPlaying = S.state === 'play';
      if (wasPlaying) S.state = 'paused';
      const raw = prompt('🔑 Enter a secret code:');
      for (const k in keys) keys[k] = false;
      mouse.down = false;
      if (wasPlaying && S.state === 'paused') S.state = 'play';
      if (!raw) return;
      const code = raw.trim().toUpperCase();
      if (code === '123.456') { S.coins += 100000; toast('💰 +100,000 coins!'); }
      else if (code === 'GODMODE') { S.god = !S.god; toast(S.god ? '😇 God mode ON' : 'God mode OFF'); }
      else if (code === 'POWERUP') { for (const k of PW_KEYS) S.pw[k] = 30; toast('🌈 ALL power-ups for 30s!'); }
      else if (code === 'BUDDIES') { for (let i = 0; i < 2; i++) S.bots.push({ cd: 0 }); toast('🤖🤖 +2 bot buddies!'); }
      else if (code === 'SKIP') { S.toSpawn = 0; for (const e of S.enemies) e.gone = true; toast('⏭ Wave skipped!'); }
      else if (code === 'BOSS') { spawnBoss(); toast('👹 Boss summoned!'); }
      else toast('❌ Wrong code');
      if (S.state === 'shop') renderShop();
    }

    // ---------- drawing ----------
    function txt(s, x, y, size, color, align = 'left') {
      ctx.font = `bold ${size}px ${FONT}`;
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#222'; ctx.lineJoin = 'round';
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
    }
    function rrect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function circle(x, y, r, fill, stroke = '#222', lw = 3) {
      ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    }

    const decos = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.5, 1.5), sp: rand(0.5, 1.5) }));
    function drawBg(t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, C.bg[0]); g.addColorStop(1, C.bg[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const scroll = (d, axisLen, v) => (((v * axisLen + t * d.sp * 40) % (axisLen + 120)) + axisLen + 120) % (axisLen + 120) - 60;
      for (const d of decos) {
        let x = d.x * W, y = d.y * H;
        if (C.view === 'space') y = scroll(d, H, d.y);
        else if (C.view === 'side') x = W - scroll(d, W, 1 - d.x);
        else y += Math.sin(t + d.x * 10) * 4;
        if (C.deco === 'stars') {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + d.x * 20);
          circle(x, y, 2 * d.s, '#fff', null);
          ctx.globalAlpha = 1;
        } else if (C.deco === 'clouds') {
          ctx.globalAlpha = 0.75;
          const s = 18 * d.s;
          circle(x, y, s, '#fff', null); circle(x + s, y + 4, s * 0.8, '#fff', null); circle(x - s, y + 4, s * 0.7, '#fff', null);
          ctx.globalAlpha = 1;
        } else if (C.deco === 'dots') {
          ctx.globalAlpha = 0.18; circle(x, y, 14 * d.s, '#fff', null); ctx.globalAlpha = 1;
        }
      }
      if (C.deco === 'grid') {
        ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2;
        const o = (t * 20) % 60;
        ctx.beginPath();
        for (let x = -60 + o; x < W + 60; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = -60 + o; y < H + 60; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
      }
      if (C.view === 'turret') {
        const cx = S ? S.p.cx : W / 2, cy = S ? S.p.cy : H / 2;
        circle(cx, cy, C.turretRadius + 30, '#6ab04c', '#222', 5);
        circle(cx - 25, cy - 20, 18, '#badc58', null); circle(cx + 30, cy + 25, 12, '#badc58', null);
      }
    }

    function drawAlien(e, look) {
      const { x, y, r } = e;
      const bob = Math.sin(e.t * 6) * 2;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x + s * r * 0.4, y - r * 0.7 + bob); ctx.lineTo(x + s * r * 0.7, y - r * 1.4 + bob); ctx.stroke();
        circle(x + s * r * 0.7, y - r * 1.4 + bob, r * 0.18, '#ffd166');
      }
      if (e.kind === 'ufo' || (e.boss && e.type === 'alien')) {
        ctx.beginPath(); ctx.ellipse(x, y + r * 0.35 + bob, r * 1.4, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#c8d6e5'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.stroke();
      }
      circle(x, y + bob, r, e.flash > 0 ? '#fff' : e.color);
      circle(x, y - r * 0.15 + bob, r * 0.45, '#fff');
      circle(x + Math.cos(look) * r * 0.18, y - r * 0.15 + bob + Math.sin(look) * r * 0.18, r * 0.2, '#222', null);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y + r * 0.45 + bob, r * 0.25, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    }
    function drawRobot(e, look) {
      const { x, y, r } = e;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r * 1.4); ctx.stroke();
      circle(x, y - r * 1.45, r * 0.18, Math.sin(e.t * 8) > 0 ? '#ff4d6d' : '#ffd166');
      rrect(x - r, y - r, r * 2, r * 2, r * 0.35);
      ctx.fillStyle = e.flash > 0 ? '#fff' : e.color; ctx.fill(); ctx.strokeStyle = '#222'; ctx.stroke();
      const ex = Math.cos(look) * r * 0.1, ey = Math.sin(look) * r * 0.1;
      for (const s of [-1, 1]) {
        rrect(x + s * r * 0.45 - r * 0.22 + ex, y - r * 0.4 + ey, r * 0.44, r * 0.4, 4);
        ctx.fillStyle = e.kind === 'zapper' || e.boss ? '#ff4d6d' : '#48dbfb'; ctx.fill(); ctx.stroke();
      }
      rrect(x - r * 0.5, y + r * 0.3, r, r * 0.3, 4); ctx.fillStyle = '#576574'; ctx.fill(); ctx.stroke();
    }
    function drawBot(b) {
      const r = 11;
      rrect(b.x - r, b.y - r, r * 2, r * 2, 5); ctx.fillStyle = '#48dbfb'; ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.stroke();
      circle(b.x - 4, b.y - 2, 2.5, '#222', null); circle(b.x + 4, b.y - 2, 2.5, '#222', null);
      ctx.strokeStyle = '#222';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.angle || 0) * 18, b.y + Math.sin(b.angle || 0) * 18);
      ctx.lineWidth = 5; ctx.stroke();
      ctx.lineWidth = 3;
      const sp = S.t * 20;
      ctx.beginPath(); ctx.moveTo(b.x - Math.cos(sp) * 12, b.y - r - 4); ctx.lineTo(b.x + Math.cos(sp) * 12, b.y - r - 4); ctx.stroke();
    }
    function drawPlayer(p) {
      if (p.inv > 0 && Math.floor(p.inv * 20) % 2 === 0) return;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      rrect(8, -7, 26, 14, 5); ctx.fillStyle = '#576574'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      circle(p.x, p.y, p.r, C.playerColor);
      ctx.beginPath(); ctx.ellipse(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6 - 2, 11, 7, p.angle, 0, Math.PI * 2);
      ctx.fillStyle = '#c7ecee'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.stroke();
      if (S.pw.shield > 0 || S.god) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(S.t * 8);
        circle(p.x, p.y, p.r + 14, S.god ? '#ffd166' : '#54a0ff', '#fff', 3);
        ctx.globalAlpha = 1;
      }
    }

    function drawHud() {
      const p = S.p;
      ctx.fillStyle = 'rgba(255,255,255,.85)'; rrect(10, 10, 230, 104, 16); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.stroke();
      rrect(22, 20, 206, 20, 8); ctx.fillStyle = '#ddd'; ctx.fill();
      rrect(22, 20, Math.max(16, 206 * Math.max(0, p.hp / p.maxHp)), 20, 8); ctx.fillStyle = p.hp / p.maxHp > 0.3 ? '#06d6a0' : '#ff4d6d'; ctx.fill();
      rrect(22, 20, 206, 20, 8); ctx.strokeStyle = '#222'; ctx.stroke();
      txt(`❤️ ${Math.ceil(p.hp)}`, 30, 30, 14, '#fff');
      txt(`⭐ ${S.score.toLocaleString()}`, 22, 58, 18, '#ffd166');
      txt(`🪙 ${S.coins.toLocaleString()}`, 22, 84, 18, '#feca57');
      txt(`🌊 ${S.wave}`, 160, 84, 18, '#48dbfb');
      let x = 22;
      for (const k of PW_KEYS) {
        if (S.pw[k] <= 0) continue;
        circle(x + 12, 136, 14, PW[k].c);
        txt(PW[k].l, x + 12, 136, 14, '#fff', 'center');
        txt(Math.ceil(S.pw[k]) + '', x + 12, 160, 12, '#fff', 'center');
        x += 34;
      }
      if (S.god) txt('😇 GOD', W - 20, 80, 18, '#ffd166', 'right');
      txt(`🏆 ${getBest().toLocaleString()}`, W - 20, 104, 16, '#fff', 'right');
      const boss = S.enemies.find((e) => e.boss);
      if (boss) {
        const bw = Math.min(400, W - 280), bx = W / 2 - bw / 2;
        rrect(bx, 14, bw, 18, 8); ctx.fillStyle = '#ddd'; ctx.fill();
        rrect(bx, 14, Math.max(16, bw * Math.max(0, boss.hp / boss.maxHp)), 18, 8); ctx.fillStyle = '#ff4d6d'; ctx.fill();
        rrect(bx, 14, bw, 18, 8); ctx.strokeStyle = '#222'; ctx.stroke();
        txt('BOSS', W / 2, 44, 14, '#fff', 'center');
      }
      if (S.banner) {
        const s = 1 + Math.max(0, S.banner.t - 1.7) * 2;
        txt(S.banner.text, W / 2, H * 0.35, Math.min(48, W / 12) * s, '#ffd166', 'center');
      }
    }
    function drawJoy() {
      if (!joy) return;
      ctx.globalAlpha = 0.4;
      circle(joy.sx, joy.sy, 50, '#fff');
      const dx = joy.x - joy.sx, dy = joy.y - joy.sy, d = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      circle(joy.sx + Math.cos(a) * d, joy.sy + Math.sin(a) * d, 22, '#ffd166');
      ctx.globalAlpha = 1;
    }

    function draw() {
      const t = S ? S.t : performance.now() / 1000;
      ctx.save();
      if (S && S.shake > 0) ctx.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake));
      drawBg(t);
      if (S) {
        for (const d of S.drops) {
          if (d.life < 3 && Math.floor(d.life * 8) % 2) continue;
          if (d.type === 'coin') { circle(d.x, d.y, 8, '#feca57'); txt('$', d.x, d.y + 1, 10, '#fff', 'center'); }
          else { circle(d.x, d.y, 15 + Math.sin(S.t * 6) * 2, PW[d.type].c); txt(PW[d.type].l, d.x, d.y + 1, 15, '#fff', 'center'); }
        }
        for (const b of S.bullets) {
          if (b.laser) {
            ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 8; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
          } else if (b.rocket) {
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
            rrect(-10, -5, 20, 10, 4); ctx.fillStyle = '#a55eea'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke();
            circle(-13, 0, 4 + Math.random() * 3, '#ff9f43', null);
            ctx.restore();
          } else circle(b.x, b.y, b.r, b.bot ? '#48dbfb' : '#ffd166', '#222', 2.5);
        }
        for (const e of S.enemies) {
          const look = Math.atan2(S.p.y - e.y, S.p.x - e.x);
          if (e.type === 'alien') drawAlien(e, look); else drawRobot(e, look);
          if (!e.boss && e.hp < e.maxHp) {
            ctx.fillStyle = '#222'; ctx.fillRect(e.x - e.r, e.y + e.r + 6, e.r * 2, 5);
            ctx.fillStyle = '#06d6a0'; ctx.fillRect(e.x - e.r, e.y + e.r + 6, e.r * 2 * Math.max(0, e.hp / e.maxHp), 5);
          }
        }
        for (const b of S.bots) if (b.x !== undefined) drawBot(b);
        if (S.state !== 'over') drawPlayer(S.p);
        for (const b of S.ebullets) circle(b.x, b.y, b.r, '#ff6bcb', '#222', 2.5);
        for (const q of S.parts) {
          ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2));
          if (q.color === 'ring') circle(q.x, q.y, q.r * (1 - q.life * 2), null, '#ff9f43', 6);
          else circle(q.x, q.y, q.r, q.color, null);
          ctx.globalAlpha = 1;
        }
        for (const tx of S.texts) { ctx.globalAlpha = Math.max(0, Math.min(1, tx.life * 2)); txt(tx.text, tx.x, tx.y, 18, tx.color, 'center'); ctx.globalAlpha = 1; }
      }
      ctx.restore();
      if (S) drawHud();
      if (touchUsed) drawJoy();
    }

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pollPad();
      if (S && S.state === 'play') update(dt);
      draw();
      requestAnimationFrame(loop);
    }

    resize();
    const viewName = { space: 'Space shooter', side: 'Side scroller', top: 'Top-down arena', turret: 'Base defense' }[C.view];
    showOverlay(`
      <h1>${C.title}</h1>
      <h2>${viewName}</h2>
      <p>${C.blurb}</p>
      <div class="ctl">
        ⌨️ <b>Move</b> WASD / arrows · <b>Shoot</b> auto (F toggles) or Space<br>
        🖱️ <b>Aim</b> mouse · click to shoot<br>
        📱 <b>Touch</b> left side = joystick · right side = aim<br>
        🎮 <b>Gamepad</b> left stick move · right stick aim · Start = pause<br>
        🔑 <b>C</b> = secret code · <b>P</b> = pause · 🏆 Best: ${getBest().toLocaleString()}
      </div>
      <p>Power-ups: <b style="color:#ff9f43">3</b> Triple · <b style="color:#54a0ff">S</b> Shield · <b style="color:#ff4d6d">L</b> Laser · <b style="color:#a55eea">R</b> Rockets · <b style="color:#c9a000">⚡</b> Speed</p>
      <button class="go" data-act="start">▶ PLAY</button>`);
    requestAnimationFrame(loop);
  };
})();
