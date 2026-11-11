'use strict';
/* The World's Last Dawn - authoritative game server (no npm dependencies).
   Run:  node server.js        then open http://localhost:8787   (PORT env var to change) */
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const PORT = +process.env.PORT || 8787;
const W = 48, H = 48, HZ = 20, DT = 1 / HZ, MAXP = 16, MAXWAVE = 10;
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
const R2 = v => Math.round(v * 100) / 100;

/* ---------------- data tables ---------------- */
const WEAP = [
  { dmg: 18, rate: .32, range: 30, spread: .015, pel: 1, max: 9999, start: 9999 },
  { dmg: 15, rate: .11, range: 30, spread: .035, pel: 1, max: 300, start: 150 },
  { dmg: 11, rate: .75, range: 11, spread: .13, pel: 7, max: 56, start: 28 },
  { dmg: 140, rate: 1.2, range: 60, spread: 0, pel: 1, max: 24, start: 12, pierce: 3 },
  { dmg: 6, rate: .09, range: 5, spread: 0, pel: 1, max: 240, start: 120 },
  { dmg: 170, rate: 1.1, range: 0, spread: 0, pel: 1, max: 14, start: 7 }
];
const ZT = {
  w: { hp: 60, spd: 1.35, dmg: 10, rate: .9, r: .3, coin: 10, reach: .55 },
  r: { hp: 38, spd: 3.2, dmg: 8, rate: .6, r: .28, coin: 12, reach: .55 },
  s: { hp: 50, spd: 1.5, dmg: 14, rate: 2.2, r: .3, coin: 22, reach: .55, ranged: 7.5 },
  t: { hp: 520, spd: 1.05, dmg: 34, rate: 1.2, r: .5, coin: 60, reach: .8 },
  b: { hp: 2600, spd: 1.5, dmg: 45, rate: 1.1, r: .7, coin: 400, reach: 1.1 }
};
const KIND = ['wall', 'turret', 'mine', 'spike', 'fire'], COST = [20, 150, 40, 30, 60];
const SHOP = { w1: 200, w2: 300, w3: 450, w4: 600, w5: 900, ammo: 40, heal: 40, hpup: 120, dmgup: 150, sheal: 100, rescue: 300 };
const BOTN = ['Rex', 'Mara', 'Jin', 'Dolores', 'Kade', 'Nova', 'Bear', 'Ivy', 'Sven', 'Pia', 'Tomo', 'Luz', 'Hana', 'Otto', 'Zed'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- map ---------------- */
function genMap(seed) {
  const r = rng(seed), g = new Uint8Array(W * H);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = v; };
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : g[y * W + x];
  for (let i = 0; i < W; i++) { set(i, 0, 1); set(i, H - 1, 1); set(0, i, 1); set(W - 1, i, 1); }
  for (let i = 16; i <= 31; i++) { set(i, 16, 2); set(i, 31, 2); set(16, i, 2); set(31, i, 2); }
  for (const q of [23, 24]) { set(q, 16, 0); set(q, 31, 0); set(16, q, 0); set(31, q, 0); }
  for (const [x, y] of [[18, 18], [29, 18], [18, 29], [29, 29]]) set(x, y, 3);
  let made = 0;
  for (let tries = 0; made < 9 && tries < 500; tries++) {
    const bw = 4 + (r() * 3 | 0), bh = 4 + (r() * 2 | 0), bx = 3 + (r() * (W - 6 - bw) | 0), by = 3 + (r() * (H - 6 - bh) | 0);
    if (bx + bw >= 12 && bx <= 36 && by + bh >= 12 && by <= 36) continue;
    let ok = true;
    for (let y = by - 1; y <= by + bh && ok; y++) for (let x = bx - 1; x <= bx + bw; x++) if (get(x, y) !== 0) { ok = false; break; }
    if (!ok) continue;
    for (let x = bx; x < bx + bw; x++) { set(x, by, 1); set(x, by + bh - 1, 1); }
    for (let y = by; y < by + bh; y++) { set(bx, y, 1); set(bx + bw - 1, y, 1); }
    const dx = bx + 1 + (r() * (bw - 3) | 0), dy = by + 1 + (r() * (bh - 3) | 0);
    set(dx, by, 0); set(dx + 1, by, 0); set(dx, by + bh - 1, 0); set(dx + 1, by + bh - 1, 0); set(bx, dy, 0); set(bx + bw - 1, dy, 0);
    made++;
  }
  for (let i = 0, n = 0; i < 400 && n < 28; i++) {
    const x = 2 + (r() * (W - 4) | 0), y = 2 + (r() * (H - 4) | 0);
    if (x >= 13 && x <= 34 && y >= 13 && y <= 34) continue;
    if (get(x, y) !== 0) continue;
    let adj = 0; for (let k = 0; k < 8; k++) if (get(x + DX[k], y + DY[k]) !== 0) adj++;
    if (adj > 0) continue;
    set(x, y, 3); n++;
  }
  // connectivity from the haven; seal unreachable pockets
  const seen = new Uint8Array(W * H), q = [20 * W + 23]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % W, cy = (c / W) | 0;
    for (let k = 0; k < 4; k++) { const nx = cx + DX[k], ny = cy + DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (seen[ni] || g[ni] > 0) continue; seen[ni] = 1; q.push(ni); }
  }
  for (let i = 0; i < W * H; i++) if (g[i] === 0 && !seen[i]) g[i] = 1;
  const spawns = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const m = Math.min(x, y, W - 1 - x, H - 1 - y); if (m <= 2 && g[y * W + x] === 0) spawns.push([x + .5, y + .5]); }
  const rows = []; for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) s += g[y * W + x]; rows.push(s); }
  return { g, spawns, rows };
}

function rc(x, y, dx, dy, cx, cy, r) {
  const tc = (cx - x) * dx + (cy - y) * dy; if (tc < 0) return -1;
  const d2 = (cx - x) * (cx - x) + (cy - y) * (cy - y) - tc * tc; if (d2 > r * r) return -1;
  return tc - Math.sqrt(r * r - d2);
}

/* ---------------- game ---------------- */
class Game {
  constructor(room) {
    this.room = room; this.cfg = room.cfg;
    const m = genMap((Math.random() * 1e9) | 0);
    this.g = m.g; this.spawns = m.spawns; this.rows = m.rows;
    this.dyn = new Uint8Array(W * H); this.st = new Map(); this.stVer = 1; this.stJV = 0; this.stJson = '[]';
    this.nid = 1; this.pl = new Map(); this.zs = []; this.sv = []; this.pj = []; this.ev = [];
    this.wave = 1; this.phase = 'day'; this.timer = 75; this.queue = []; this.spT = 0; this.cap = 60;
    this.tick = 0; this.flow = new Float32Array(W * H); this.flowDirty = true; this.overTicks = 0; this.result = null;
    this.dm = [0.8, 1, 1.35][this.cfg.diff | 0] || 1;
    for (let i = 0; i < 6; i++) this.addSurvivor();
    // bot build spots: turrets just inside the gates, barricades in the gate openings
    this.spots = [];
    for (const [x, y] of [[21, 18], [26, 18], [21, 29], [26, 29], [18, 21], [18, 26], [29, 21], [29, 26]]) this.spots.push({ k: 1, x, y });
    for (const [x, y] of [[23, 16], [24, 16], [23, 31], [24, 31], [16, 23], [16, 24], [31, 23], [31, 24]]) this.spots.push({ k: 0, x, y });
    this.computeFlow();
  }
  /* --- helpers --- */
  solid(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H || this.g[ty * W + tx] > 0 || this.dyn[ty * W + tx] > 0; }
  blocked(x, y, r) { const f = Math.floor; return this.solid(f(x - r), f(y - r)) || this.solid(f(x + r), f(y - r)) || this.solid(f(x - r), f(y + r)) || this.solid(f(x + r), f(y + r)); }
  moveE(e, dx, dy, r) { if (!this.blocked(e.x + dx, e.y, r)) e.x += dx; if (!this.blocked(e.x, e.y + dy, r)) e.y += dy; }
  wallDist(x, y, dx, dy, max) {
    let mx = Math.floor(x), my = Math.floor(y);
    const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
    let sx, sy, sdx, sdy;
    if (dx < 0) { sx = -1; sdx = (x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - x) * ddx; }
    if (dy < 0) { sy = -1; sdy = (y - my) * ddy; } else { sy = 1; sdy = (my + 1 - y) * ddy; }
    let d = 0;
    while (d < max) {
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; } else { d = sdy; sdy += ddy; my += sy; }
      if (mx < 0 || my < 0 || mx >= W || my >= H) return Math.min(d, max);
      if (this.g[my * W + mx] > 0) return Math.min(d, max);
    }
    return max;
  }
  los(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy); if (d < .01) return true; return this.wallDist(x1, y1, dx / d, dy / d, d) >= d - .05; }
  stAt(tx, ty) { return this.st.get(ty * W + tx); }
  hum() { return [...this.pl.values()].filter(p => !p.bot); }
  computeFlow() {
    const d = this.flow; d.fill(1e9); const q = [];
    for (let y = 17; y < 31; y++) for (let x = 17; x < 31; x++) if (this.g[y * W + x] === 0) { d[y * W + x] = 0; q.push(y * W + x); }
    for (let h = 0; h < q.length && h < 60000; h++) {
      const c = q[h], cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx; if (this.g[ni] > 0) continue;
        if (k >= 4 && (this.g[cy * W + nx] > 0 || this.g[ny * W + cx] > 0)) continue;
        const cost = (k < 4 ? 1 : 1.414) + (this.dyn[ni] ? 7 : 0);
        if (d[c] + cost < d[ni] - 1e-6) { d[ni] = d[c] + cost; q.push(ni); }
      }
    }
  }
  flowDir(z) {
    const tx = z.x | 0, ty = z.y | 0, d = this.flow; let best = d[ty * W + tx], bx = -1, by = -1;
    for (let k = 0; k < 8; k++) {
      const nx = tx + DX[k], ny = ty + DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (this.g[ni] > 0) continue;
      if (k >= 4 && (this.g[ty * W + nx] > 0 || this.g[ny * W + tx] > 0)) continue;
      if (d[ni] < best - 1e-6) { best = d[ni]; bx = nx; by = ny; }
    }
    return bx < 0 ? null : [bx + .5, by + .5];
  }
  /* --- entities --- */
  addSurvivor() { const s = { id: this.nid++, x: 20 + Math.random() * 8, y: 20 + Math.random() * 8, a: 0, hp: 100, cd: 1, wt: 0, tx: 24, ty: 24, sv: 1 }; this.sv.push(s); return s; }
  spawnPos() { for (let i = 0; i < 30; i++) { const x = 18.5 + Math.random() * 11, y = 18.5 + Math.random() * 11; if (!this.blocked(x, y, .4)) return [x, y]; } return [23.5, 22.5]; }
  addPlayer(id, name, skin, bot) {
    const [x, y] = this.spawnPos();
    const p = { id, name, skin, bot: !!bot, x, y, a: Math.random() * 6.28, hp: 100, mhp: 100, alive: true, coins: 100 + (this.wave - 1) * 80, own: [1, 0, 0, 0, 0, 0], ammo: [9999, 0, 0, 0, 0, 0], cur: 0, cd: 0, f: 0, mx: 0, my: 0, kills: 0, score: 0, deaths: 0, rs: 0, ready: false, dl: 0, hl: 0, snap: 1, lt: Date.now(), bt: 0, sd: Math.random() < .5 ? 1 : -1 };
    this.pl.set(id, p); return p;
  }
  waveList(n) {
    const hum = Math.max(1, this.hum().length), m = (1 + .15 * (hum - 1)) * this.dm, L = [];
    const add = (t, c) => { for (let i = 0; i < Math.round(c); i++) L.push(t); };
    add('w', (5 + 3.2 * n) * m);
    if (n >= 2) add('r', 1.5 * n * m);
    if (n >= 3) add('s', (n - 1) * .9 * m);
    if (n >= 4) add('t', (n - 2) * .5 * m + (n >= 6 ? 1 : 0));
    if (n % 5 === 0) add('b', (n / 5) * Math.max(1, Math.round(m)));
    for (let i = L.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [L[i], L[j]] = [L[j], L[i]]; }
    L.sort((a, b) => (a === 'b') - (b === 'b'));   // bosses last in list...
    return L.reverse();                            // ...so they are popped (spawned) last
  }
  startNight() {
    this.phase = 'night'; this.queue = this.waveList(this.wave); this.spT = 2;
    for (const p of this.pl.values()) p.ready = false;
    this.ev.push(['night', this.wave]);
    if (this.queue.includes('b')) this.ev.push(['msg', 'boss']);
  }
  endNight() {
    if (this.wave >= MAXWAVE) { this.finish(true); return; }
    const bonus = 50 + 10 * this.wave;
    this.wave++; this.phase = 'day'; this.timer = 55;
    for (const p of this.pl.values()) {
      p.ready = false; p.coins += bonus;
      if (!p.alive) { p.alive = true; p.hp = p.mhp; const [x, y] = this.spawnPos(); p.x = x; p.y = y; p.snap++; }
      else p.hp = Math.min(p.mhp, p.hp + p.mhp * .4);
      for (let i = 1; i < 6; i++) if (p.own[i]) p.ammo[i] = Math.min(WEAP[i].max, p.ammo[i] + Math.ceil(WEAP[i].max * .3));
    }
    for (const s of this.sv) s.hp = Math.min(100, s.hp + 30);
    this.ev.push(['dawn', this.wave, bonus]);
  }
  finish(win) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.result = { win, wave: win ? MAXWAVE : this.wave };
    this.room.state = 'over';
  }
  /* --- combat --- */
  hurtZ(z, d, owner) {
    if (z.dead) return; z.hp -= d; z.lo = owner || z.lo;
    if (z.hp <= 0) {
      z.dead = true; const T = ZT[z.t], o = z.lo;
      if (o && o.coins !== undefined) { o.coins += T.coin; o.score += T.coin; o.kills++; }
      this.ev.push(['dead', R2(z.x), R2(z.y), z.t]);
      if (z.t === 'b') this.ev.push(['msg', 'bossdead']);
    }
  }
  hurtS(s, d) { if (s.hp <= 0) return; s.hp -= d; if (s.hp <= 0) { this.ev.push(['msg', 'svd']); this.ev.push(['dead', R2(s.x), R2(s.y), 'p']); } }
  hurtP(q, d, src) {
    if (!q.alive || this.phase === 'over') return; q.hp -= d; this.ev.push(['hurt', q.id, Math.round(d)]);
    if (q.hp <= 0) {
      q.alive = false; q.rs = 6; q.deaths++; q.coins = Math.floor(q.coins * .8); q.f = 0;
      this.ev.push(['dead', R2(q.x), R2(q.y), 'p']);
      if (src && src !== q && src.coins !== undefined) { src.kills++; src.coins += 100; src.score += 150; this.ev.push(['msg', 'kfp', src.name, q.name]); }
      else this.ev.push(['msg', 'kfz', q.name]);
    }
  }
  hurtSt(s, d) { s.hp -= d; this.stVer++; if (s.hp <= 0) this.removeSt(s, true); }
  removeSt(s, broke) {
    this.st.delete(s.y * W + s.x); if (s.k <= 1) { this.dyn[s.y * W + s.x] = 0; this.flowDirty = true; }
    this.stVer++; if (broke) this.ev.push(['brk', s.x, s.y, s.k]);
  }
  explode(x, y, r, dmg, owner, pvp) {
    for (const z of this.zs) { if (z.dead) continue; const d = Math.hypot(z.x - x, z.y - y); if (d < r + ZT[z.t].r) this.hurtZ(z, dmg * (1 - .65 * Math.min(1, d / (r + .5))), owner); }
    for (const p of this.pl.values()) {
      if (!p.alive || p.bot) continue; const d = Math.hypot(p.x - x, p.y - y); if (d >= r) continue;
      let f = 0; if (p === owner) f = .35; else if (pvp && owner && !owner.bot) f = 1; if (!f) continue;
      this.hurtP(p, dmg * f * (1 - .6 * d / r), owner);
    }
    this.ev.push(['boom', R2(x), R2(y), r, 0]);
  }
  hitscan(o, x, y, ang, range, dmg, pierce, vis, wi, fall, pvp) {
    const dx = Math.cos(ang), dy = Math.sin(ang), wd = Math.min(range, this.wallDist(x, y, dx, dy, range)), c = [];
    for (const z of this.zs) { if (z.dead) continue; const t = rc(x, y, dx, dy, z.x, z.y, ZT[z.t].r); if (t >= 0 && t < wd) c.push([t, z]); }
    if (pvp && o && !o.bot) for (const q of this.pl.values()) { if (q === o || q.bot || !q.alive) continue; const t = rc(x, y, dx, dy, q.x, q.y, .3); if (t >= 0 && t < wd) c.push([t, q]); }
    c.sort((a, b) => a[0] - b[0]);
    let end = wd, n = 0;
    for (const [t, e] of c) {
      if (n >= pierce) break; const d = fall ? dmg * (1 - .6 * t / range) : dmg;
      if (e.t) this.hurtZ(e, d, o); else this.hurtP(e, d, o);
      this.ev.push(['hit', R2(x + dx * t), R2(y + dy * t), e.t ? 0 : 1, o ? o.id : -1]); n++; if (n >= pierce) end = t;
    }
    if (vis) this.ev.push(['sh', o ? o.id : wi === 6 ? -1 : -2, R2(x), R2(y), R2(x + dx * end), R2(y + dy * end), wi]);
  }
  fire(p) {
    const w = WEAP[p.cur]; if (!p.own[p.cur]) return;
    if (p.cur > 0 && p.ammo[p.cur] <= 0) { p.cd = .3; this.ev.push(['dry', p.id]); return; }
    p.cd = w.rate; if (p.cur > 0) p.ammo[p.cur]--;
    const dm = w.dmg * (1 + .15 * p.dl), pvp = this.cfg.pvp;
    if (p.cur === 4) {
      const cs = Math.cos(p.a), sn = Math.sin(p.a);
      const hit = (e, r) => { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d > w.range + r || d < .01) return false; const dot = (dx * cs + dy * sn) / d; return dot > .93 && this.los(p.x, p.y, e.x, e.y); };
      for (const z of this.zs) if (!z.dead && hit(z, ZT[z.t].r)) { this.hurtZ(z, dm, p); z.burn = 3; z.bo = p; }
      if (pvp && !p.bot) for (const q of this.pl.values()) if (q !== p && !q.bot && q.alive && hit(q, .3)) this.hurtP(q, dm * .8, p);
      this.ev.push(['fl', p.id, R2(p.x), R2(p.y), R2(p.a)]);
    } else if (p.cur === 5) {
      this.pj.push({ id: this.nid++, t: 'rk', x: p.x + Math.cos(p.a) * .5, y: p.y + Math.sin(p.a) * .5, vx: Math.cos(p.a) * 14, vy: Math.sin(p.a) * 14, life: 2.5, dmg: dm, o: p });
      this.ev.push(['rk', R2(p.x), R2(p.y), R2(p.a)]);
    } else {
      for (let i = 0; i < w.pel; i++) this.hitscan(p, p.x, p.y, p.a + (Math.random() - .5) * 2 * w.spread, w.range, dm, w.pierce || 1, i === 0, p.cur, w.pel > 1, pvp);
    }
  }
  /* --- economy / building --- */
  buy(p, k) {
    if (!p.alive || !(k in SHOP)) return false; const c = SHOP[k]; if (p.coins < c) return false;
    if (k[0] === 'w') { const i = +k[1]; if (p.own[i]) return false; p.own[i] = 1; p.ammo[i] = WEAP[i].start; }
    else if (k === 'ammo') { let any = false; for (let i = 1; i < 6; i++) if (p.own[i] && p.ammo[i] < WEAP[i].max) { p.ammo[i] = WEAP[i].max; any = true; } if (!any) return false; }
    else if (k === 'heal') { if (p.hp >= p.mhp) return false; p.hp = p.mhp; }
    else if (k === 'hpup') { if (p.hl >= 3) return false; p.hl++; p.mhp += 25; p.hp += 25; }
    else if (k === 'dmgup') { if (p.dl >= 3) return false; p.dl++; }
    else if (k === 'sheal') { if (!this.sv.some(s => s.hp < 100)) return false; for (const s of this.sv) s.hp = Math.min(100, s.hp + 50); }
    else if (k === 'rescue') { if (this.sv.length >= 6) return false; this.addSurvivor(); this.ev.push(['msg', 'rescue', p.name]); }
    p.coins -= c; this.ev.push(['buy', p.id]); return true;
  }
  place(p, kk, tx, ty) {
    const k = typeof kk === 'number' ? kk : KIND.indexOf(kk);
    if (k < 0 || k > 4 || !p.alive || this.phase !== 'day') return false;
    tx |= 0; ty |= 0;
    if (tx < 2 || ty < 2 || tx > W - 3 || ty > H - 3) return false;
    if (this.g[ty * W + tx] !== 0 || this.st.has(ty * W + tx)) return false;
    if (Math.hypot(tx + .5 - p.x, ty + .5 - p.y) > 5.6 || p.coins < COST[k]) return false;
    if (k <= 1) {
      for (const q of this.pl.values()) if (q.alive && Math.hypot(tx + .5 - q.x, ty + .5 - q.y) < .85) return false;
      for (const z of this.zs) if (!z.dead && Math.hypot(tx + .5 - z.x, ty + .5 - z.y) < .85) return false;
      for (const s of this.sv) if (s.hp > 0 && Math.hypot(tx + .5 - s.x, ty + .5 - s.y) < .85) return false;
    }
    let mine = 0; for (const s of this.st.values()) if (s.o === p.id && s.k === k) mine++;
    if (mine >= (k === 0 ? 60 : k === 1 ? 6 : 24)) return false;
    const s = { id: this.nid++, k, x: tx, y: ty, hp: k === 0 ? 260 : 160, mhp: k === 0 ? 260 : 160, o: p.id, cd: 0, dur: 40, life: 25 };
    this.st.set(ty * W + tx, s); if (k <= 1) { this.dyn[ty * W + tx] = 1; this.flowDirty = true; }
    p.coins -= COST[k]; this.stVer++; this.ev.push(['place', tx, ty, k]); return true;
  }
  sell(p, tx, ty) {
    const s = this.stAt(tx | 0, ty | 0); if (!s || s.o !== p.id) return;
    p.coins += Math.floor(COST[s.k] * .5); this.removeSt(s, false);
  }
  /* --- bots --- */
  botThink(p) {
    if (!p.alive) return;
    p.f = 0; p.mx = 0; p.my = 0; p.bt -= DT;
    let best = null, bd = 18;
    for (const z of this.zs) { if (z.dead) continue; const d = Math.hypot(z.x - p.x, z.y - p.y); if (d < bd && this.los(p.x, p.y, z.x, z.y)) { bd = d; best = z; } }
    const cd = Math.hypot(24 - p.x, 24 - p.y);
    if (best) {
      const ang = Math.atan2(best.y - p.y, best.x - p.x); p.a = ang + (Math.random() - .5) * .08;
      p.cur = (bd < 6 && p.own[2] && p.ammo[2] > 0) ? 2 : (p.own[3] && p.ammo[3] > 0 && bd > 9 && p.ammo[1] <= 0) ? 3 : (p.own[1] && p.ammo[1] > 0) ? 1 : 0;
      p.f = 1;
      if (bd < 5) { p.mx = -Math.cos(ang); p.my = -Math.sin(ang); } else if (bd > 10 && cd < 13) { p.mx = Math.cos(ang); p.my = Math.sin(ang); } else { p.mx = -Math.sin(ang) * p.sd * .6; p.my = Math.cos(ang) * p.sd * .6; }
      if (Math.random() < .005) p.sd = -p.sd;
      if (cd > 13) { p.mx = (24 - p.x) / cd; p.my = (24 - p.y) / cd; }
    } else if (this.phase === 'day') {
      if (p.bt <= 0) { p.bt = 1; for (const k of ['ammo', 'w1', 'hpup', 'w2', 'dmgup', 'w3']) { if (k === 'ammo' && !(p.own[1] && p.ammo[1] < WEAP[1].max * .5)) continue; if (this.buy(p, k)) break; } }
      let spot = null;
      for (const s of this.spots) {
        if (this.stAt(s.x, s.y) || p.coins < COST[s.k]) continue;
        let mine = 0; for (const t of this.st.values()) if (t.o === p.id && t.k === s.k) mine++;
        if (mine >= (s.k ? 2 : 4)) continue; spot = s; break;
      }
      if (spot) {
        const dx = spot.x + .5 - p.x, dy = spot.y + .5 - p.y, d = Math.hypot(dx, dy); p.a = Math.atan2(dy, dx);
        if (d > 3.4) { p.mx = dx / d; p.my = dy / d; } else this.place(p, spot.k, spot.x, spot.y);
      } else if (cd > 7) { p.mx = (24 - p.x) / cd; p.my = (24 - p.y) / cd; p.a = Math.atan2(24 - p.y, 24 - p.x); }
      p.ready = true;
    } else if (cd > 6) { p.mx = (24 - p.x) / cd; p.my = (24 - p.y) / cd; p.a = Math.atan2(24 - p.y, 24 - p.x); }
    const m = Math.hypot(p.mx, p.my); if (m > 0) this.moveE(p, p.mx / Math.max(1, m) * 3.8 * DT, p.my / Math.max(1, m) * 3.8 * DT, .3);
    if (this.phase === 'night') p.ready = false;
  }
  /* --- per-tick updates --- */
  updPlayer(p) {
    if (p.bot) this.botThink(p);
    if (!p.alive) {
      p.rs -= DT;
      if (p.rs <= 0 && this.phase !== 'over') { p.alive = true; p.hp = p.mhp; const [x, y] = this.spawnPos(); p.x = x; p.y = y; p.snap++; this.ev.push(['msg', 'resp', p.name]); }
      return;
    }
    p.cd -= DT;
    if (p.f && p.cd <= 0) this.fire(p);
  }
  updSurvivors() {
    for (const s of this.sv) {
      if (s.hp <= 0) continue; s.cd -= DT; s.wt -= DT;
      if (s.wt <= 0) { s.wt = 3 + Math.random() * 4; s.tx = 18.5 + Math.random() * 11; s.ty = 18.5 + Math.random() * 11; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
      if (d > .2) { this.moveE(s, dx / d * 1.1 * DT, dy / d * 1.1 * DT, .3); s.a = Math.atan2(dy, dx); }
      if (s.cd <= 0) {
        let best = null, bd = 8;
        for (const z of this.zs) { if (z.dead) continue; const dd = Math.hypot(z.x - s.x, z.y - s.y); if (dd < bd && this.los(s.x, s.y, z.x, z.y)) { bd = dd; best = z; } }
        if (best) { s.cd = .8; s.a = Math.atan2(best.y - s.y, best.x - s.x); this.hitscan(null, s.x, s.y, s.a + (Math.random() - .5) * .12, 9, 9, 1, true, 7, false, false); } else s.cd = .25;
      }
    }
    this.sv = this.sv.filter(s => s.hp > 0);
    if (!this.sv.length) this.finish(false);
  }
  pickTarget(z, pls) {
    const inH = z.x > 16 && z.x < 32 && z.y > 16 && z.y < 32, ag = inH ? 60 : (z.t === 'r' ? 13 : 11);
    let best = null, bd = 1e9;
    for (const s of this.sv) { const d = Math.hypot(s.x - z.x, s.y - z.y), w = d * .8; if (w < bd && d < ag && (inH || this.los(z.x, z.y, s.x, s.y))) { bd = w; best = s; } }
    for (const p of pls) { const d = Math.hypot(p.x - z.x, p.y - z.y); if (d < bd && d < ag && (inH || this.los(z.x, z.y, p.x, p.y))) { bd = d; best = p; } }
    return best;
  }
  spawnZ(t, near) {
    const T = ZT[t], hpm = (1 + .12 * (this.wave - 1)) * this.dm; let x, y;
    if (near) { x = near.x + (Math.random() - .5) * 2; y = near.y + (Math.random() - .5) * 2; if (this.blocked(x, y, T.r)) { x = near.x; y = near.y; } }
    else { const sp = this.spawns[(Math.random() * this.spawns.length) | 0]; x = sp[0]; y = sp[1]; for (let i = 0; i < 8 && this.blocked(x, y, T.r); i++) { x += Math.sign(24 - x); y += Math.sign(24 - y); } }
    const hp = T.hp * (t === 'b' ? (1 + .15 * (this.wave - 1)) * this.dm : hpm);
    this.zs.push({ id: this.nid++, t, x, y, a: 0, hp, mhp: hp, cd: 1, slow: 0, burn: 0, rt: Math.random() * .3, tg: null, sm: 6, sl: 3, lo: null, stk: 0 });
  }
  updZombies() {
    const pls = [...this.pl.values()].filter(p => p.alive);
    for (const z of this.zs) {
      if (z.dead) continue; const T = ZT[z.t];
      z.cd -= DT; if (z.slow > 0) z.slow -= DT;
      if (z.burn > 0) { z.burn -= DT; this.hurtZ(z, 9 * DT, z.bo); if (z.dead) continue; }
      z.rt -= DT; if (z.rt <= 0) { z.rt = .3 + Math.random() * .2; z.tg = this.pickTarget(z, pls); }
      let tg = z.tg; if (tg && (tg.hp <= 0 || tg.alive === false)) tg = z.tg = null;
      let tx, ty;
      if (tg) { tx = tg.x; ty = tg.y; } else { const f = this.flowDir(z); if (f) { tx = f[0]; ty = f[1]; } else { tx = 24; ty = 24; } }
      const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy) || 1e-6; let ux = dx / d, uy = dy / d, moving = true;
      z.a = Math.atan2(dy, dx);
      if (tg) {
        if (T.ranged) {
          if (d < T.ranged && this.los(z.x, z.y, tx, ty)) { moving = false; if (z.cd <= 0) { z.cd = T.rate; this.pj.push({ id: this.nid++, t: 'ac', x: z.x, y: z.y, vx: ux * 7, vy: uy * 7, life: 2, dmg: T.dmg, o: null }); this.ev.push(['spit', R2(z.x), R2(z.y)]); } }
          if (d < 3.5) { ux = -ux; uy = -uy; moving = true; }
        } else if (d < T.reach + T.r + .3) {
          moving = false; if (z.cd <= 0) { z.cd = T.rate; if (tg.sv) this.hurtS(tg, T.dmg); else this.hurtP(tg, T.dmg, null); }
        }
      }
      if (moving) {
        const s = this.stAt(Math.floor(z.x + ux * (T.r + .3)), Math.floor(z.y + uy * (T.r + .3)));
        if (s && s.k <= 1) { moving = false; if (z.cd <= 0) { z.cd = T.rate; this.hurtSt(s, T.dmg * (z.t === 't' || z.t === 'b' ? 2 : 1)); } }
      }
      if (moving) {
        const sp = T.spd * (z.slow > 0 ? .5 : 1) * DT, ox = z.x, oy = z.y; this.moveE(z, ux * sp, uy * sp, T.r);
        if (Math.hypot(z.x - ox, z.y - oy) < sp * .3) z.stk += DT; else z.stk = Math.max(0, z.stk - DT);
        if (z.stk > 6) { z.stk = 0; const q = this.spawns[(Math.random() * this.spawns.length) | 0]; z.x = q[0]; z.y = q[1]; for (let i = 0; i < 8 && this.blocked(z.x, z.y, T.r); i++) { z.x += Math.sign(24 - z.x); z.y += Math.sign(24 - z.y); } }
      }
      if (z.t === 'b') {
        z.sm -= DT; if (z.sm <= 0 && this.zs.length < 90) { z.sm = 10; for (let i = 0; i < 3; i++) this.spawnZ('w', z); }
        z.sl -= DT;
        if (z.sl <= 0 && tg && d < 3.2) {
          z.sl = 4;
          for (const p of pls) if (Math.hypot(p.x - z.x, p.y - z.y) < 3.2) this.hurtP(p, 35, null);
          for (const s of this.sv) if (Math.hypot(s.x - z.x, s.y - z.y) < 3.2) this.hurtS(s, 35);
          for (const s of [...this.st.values()]) if (s.k <= 1 && Math.hypot(s.x + .5 - z.x, s.y + .5 - z.y) < 3.2) this.hurtSt(s, 90);
          this.ev.push(['boom', R2(z.x), R2(z.y), 3.2, 1]);
        }
      }
    }
    for (let i = 0; i < this.zs.length; i++) {
      const a = this.zs[i]; if (a.dead) continue; const ra = ZT[a.t].r;
      for (let j = i + 1; j < this.zs.length; j++) {
        const b = this.zs[j]; if (b.dead) continue; const dx = b.x - a.x, dy = b.y - a.y, m = ra + ZT[b.t].r - .08;
        if (Math.abs(dx) > m || Math.abs(dy) > m) continue; const d = Math.hypot(dx, dy); if (d >= m || d < .001) continue;
        const o = (m - d) / 2 / d; const wa = a.t === 'b' || a.t === 't' ? .3 : 1, wb = b.t === 'b' || b.t === 't' ? .3 : 1;
        this.moveE(a, -dx * o * wa, -dy * o * wa, ra); this.moveE(b, dx * o * wb, dy * o * wb, ZT[b.t].r);
      }
    }
  }
  updStructs() {
    for (const s of [...this.st.values()]) {
      const cx = s.x + .5, cy = s.y + .5;
      if (s.k === 1) {
        s.cd -= DT; if (s.cd > 0) continue;
        let best = null, bd = 10;
        for (const z of this.zs) { if (z.dead) continue; const d = Math.hypot(z.x - cx, z.y - cy); if (d < bd && this.los(cx, cy, z.x, z.y)) { bd = d; best = z; } }
        if (best) { const o = this.pl.get(s.o); this.hitscan(o || null, cx, cy, Math.atan2(best.y - cy, best.x - cx) + (Math.random() - .5) * .07, 12, 9 * (1 + .15 * (o ? o.dl : 0)), 1, true, 6, false, false); s.cd = .2; } else s.cd = .12;
      } else if (s.k === 2) {
        let trig = false;
        for (const z of this.zs) if (!z.dead && Math.hypot(z.x - cx, z.y - cy) < .7) { trig = true; break; }
        if (!trig && this.cfg.pvp) for (const q of this.pl.values()) if (q.alive && !q.bot && q.id !== s.o && Math.hypot(q.x - cx, q.y - cy) < .6) { trig = true; break; }
        if (trig) { this.removeSt(s, false); this.explode(cx, cy, 2.6, 190, this.pl.get(s.o) || null, true); }
      } else if (s.k === 3) {
        let hit = false;
        for (const z of this.zs) if (!z.dead && Math.hypot(z.x - cx, z.y - cy) < .55) { this.hurtZ(z, 14 * DT, this.pl.get(s.o)); z.slow = .3; hit = true; }
        if (hit) { s.dur -= DT; if (s.dur <= 0) this.removeSt(s, true); }
      } else if (s.k === 4) {
        s.life -= DT;
        for (const z of this.zs) if (!z.dead && Math.hypot(z.x - cx, z.y - cy) < 1.1) { const o = this.pl.get(s.o); this.hurtZ(z, 28 * DT, o); z.burn = 2; z.bo = o; }
        if (s.life <= 0) this.removeSt(s, false);
      }
    }
  }
  updProj() {
    for (const j of this.pj) {
      for (let n = 0; n < 3 && !j.dead; n++) {
        j.x += j.vx * DT / 3; j.y += j.vy * DT / 3; j.life -= DT / 3;
        const tx = Math.floor(j.x), ty = Math.floor(j.y);
        if (tx < 0 || ty < 0 || tx >= W || ty >= H || this.g[ty * W + tx] > 0) { if (j.t === 'rk') this.explode(j.x - j.vx * .02, j.y - j.vy * .02, 3, j.dmg, j.o, this.cfg.pvp); j.dead = true; break; }
        if (j.t === 'ac') {
          const st = this.stAt(tx, ty); if (st && st.k <= 1) { this.hurtSt(st, j.dmg); j.dead = true; break; }
          for (const p of this.pl.values()) if (p.alive && Math.hypot(p.x - j.x, p.y - j.y) < .4) { this.hurtP(p, j.dmg, null); j.dead = true; break; }
          if (!j.dead) for (const s of this.sv) if (Math.hypot(s.x - j.x, s.y - j.y) < .4) { this.hurtS(s, j.dmg); j.dead = true; break; }
        } else {
          for (const z of this.zs) if (!z.dead && Math.hypot(z.x - j.x, z.y - j.y) < ZT[z.t].r + .25) { this.explode(j.x, j.y, 3, j.dmg, j.o, this.cfg.pvp); j.dead = true; break; }
          if (!j.dead && this.cfg.pvp) for (const p of this.pl.values()) if (p !== j.o && !p.bot && p.alive && Math.hypot(p.x - j.x, p.y - j.y) < .45) { this.explode(j.x, j.y, 3, j.dmg, j.o, true); j.dead = true; break; }
        }
        if (!j.dead && j.life <= 0) { if (j.t === 'rk') this.explode(j.x, j.y, 3, j.dmg, j.o, this.cfg.pvp); j.dead = true; }
      }
    }
    this.pj = this.pj.filter(j => !j.dead);
  }
  step() {
    if (this.phase === 'over') { this.overTicks++; return; }
    this.tick++;
    if (this.phase === 'day') {
      this.timer -= DT;
      const al = this.hum().filter(p => p.alive);
      if (al.length && al.every(p => p.ready) && this.timer > 3) this.timer = 3;
      if (this.timer <= 0) this.startNight();
    } else {
      this.spT -= DT;
      if (this.queue.length && this.spT <= 0 && this.zs.length < this.cap) { this.spawnZ(this.queue.pop()); this.spT = Math.max(.15, .7 - this.wave * .04); }
      if (!this.queue.length && !this.zs.length) this.endNight();
    }
    for (const p of this.pl.values()) this.updPlayer(p);
    this.updSurvivors(); this.updZombies(); this.updStructs(); this.updProj();
    this.zs = this.zs.filter(z => !z.dead);
    if (this.flowDirty && this.tick % 4 === 0) { this.computeFlow(); this.flowDirty = false; }
  }
  /* --- snapshots --- */
  send(clients) {
    if (this.phase === 'over' && this.overTicks > 6) return;
    if (this.stJV !== this.stVer) { this.stJson = JSON.stringify([...this.st.values()].map(s => [s.id, s.k, s.x, s.y, Math.ceil(s.hp), s.mhp, s.o])); this.stJV = this.stVer; }
    const base = {
      t: 's', k: this.tick, ph: this.phase, tm: Math.max(0, Math.ceil(this.timer)), wv: this.wave, zl: this.zs.length + this.queue.length,
      pl: [...this.pl.values()].map(p => [p.id, R2(p.x), R2(p.y), R2(p.a), Math.ceil(p.hp), p.alive ? 1 : 0, p.cur, p.f ? 1 : 0]),
      zb: this.zs.map(z => [z.id, z.t, R2(z.x), R2(z.y), R2(z.a), R2(Math.max(0, z.hp) / z.mhp), z.burn > 0 ? 1 : 0]),
      sv: this.sv.map(s => [s.id, R2(s.x), R2(s.y), R2(s.a), Math.ceil(s.hp)]),
      pj: this.pj.map(j => [j.id, j.t === 'rk' ? 1 : 0, R2(j.x), R2(j.y)]),
      ev: this.ev
    };
    if (this.tick % 10 === 1 || this.phase === 'over') base.ro = [...this.pl.values()].map(p => [p.id, p.name, p.skin, p.bot ? 1 : 0, p.score, p.kills, p.deaths, p.coins]);
    if (this.phase === 'over') base.ov = { win: this.result.win, wave: this.result.wave };
    const bs = JSON.stringify(base).slice(0, -1);
    for (const c of clients) {
      if (!c.inGame || c.sock.destroyed || c.sock.writableLength > 1.5e6) continue;
      const p = this.pl.get(c.id); let s = bs;
      if (p) s += ',"me":' + JSON.stringify({ c: p.coins, am: p.ammo.map(a => a > 9000 ? -1 : a), ow: p.own, cu: p.cur, hl: p.hl, dl: p.dl, mhp: p.mhp, hp: Math.ceil(p.hp), rs: Math.ceil(Math.max(0, p.rs)), sn: p.snap, rd: p.ready ? 1 : 0, al: p.alive ? 1 : 0, x: R2(p.x), y: R2(p.y), a: R2(p.a) });
      if (c.stv !== this.stVer) { s += ',"st":' + this.stJson; c.stv = this.stVer; }
      sendRaw(c, s + '}');
    }
    this.ev.length = 0;
  }
}

/* ---------------- websocket / rooms ---------------- */
const clients = new Map(), rooms = new Map(); let nextId = 1;
function sendFrame(c, op, payload) {
  if (c.sock.destroyed) return; const l = payload.length; let h;
  if (l < 126) h = Buffer.from([128 | op, l]); else if (l < 65536) { h = Buffer.alloc(4); h[0] = 128 | op; h[1] = 126; h.writeUInt16BE(l, 2); } else { h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(l), 2); }
  c.sock.write(Buffer.concat([h, payload]));
}
const sendRaw = (c, s) => sendFrame(c, 1, Buffer.from(s));
const send = (c, o) => sendRaw(c, JSON.stringify(o));
function parseFrames(c) {
  for (; ;) {
    const b = c.buf; if (b.length < 2) return;
    const fin = !!(b[0] & 128), op = b[0] & 15, masked = !!(b[1] & 128); let len = b[1] & 127, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > 65536) { c.sock.destroy(); return; }
    const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
    const payload = Buffer.from(b.subarray(off + (masked ? 4 : 0), need));
    if (masked) { const mk = b.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3]; }
    c.buf = b.subarray(need);
    if (op === 8) { c.sock.end(); return; }
    if (op === 9) { sendFrame(c, 10, payload); continue; }
    if (op === 1 || op === 0) { c.frag.push(payload); if (fin) { const s = Buffer.concat(c.frag).toString('utf8'); c.frag = []; try { onMsg(c, JSON.parse(s)); } catch (e) { console.error('msg error', e.message); } } }
  }
}
function wsAccept(req, sock) {
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  const c = { id: nextId++, sock, buf: Buffer.alloc(0), frag: [], name: 'Survivor', skin: 0, room: null, stv: 0, inGame: false };
  clients.set(c.id, c); sock.setNoDelay(true);
  sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); if (c.buf.length > (1 << 20)) { sock.destroy(); return; } parseFrames(c); });
  sock.on('close', () => drop(c)); sock.on('error', () => sock.destroy());
  send(c, { t: 'hi', id: c.id });
}
const cleanName = s => String(s || 'Survivor').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14) || 'Survivor';
function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; for (; ;) { let s = ''; for (let i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0]; if (!rooms.has(s)) return s; } }
function roomInfo(room) {
  const m = { t: 'room', code: room.code, host: room.host, state: room.state, cfg: room.cfg, pl: [...room.clients.values()].map(c => ({ id: c.id, name: c.name, skin: c.skin })) };
  for (const c of room.clients.values()) send(c, m);
}
function joinRoom(c, room) {
  c.room = room; room.clients.set(c.id, c);
  if (room.state === 'play' && room.game) { room.game.addPlayer(c.id, c.name, c.skin, false); c.stv = 0; c.inGame = true; send(c, { t: 'init', map: room.game.rows, id: c.id }); room.game.ev.push(['msg', 'join', c.name]); }
  roomInfo(room);
}
function leaveRoom(c) {
  const room = c.room; if (!room) return; c.room = null; c.inGame = false; room.clients.delete(c.id);
  if (room.game) { room.game.pl.delete(c.id); room.game.ev.push(['msg', 'left', c.name]); }
  if (!room.clients.size) { rooms.delete(room.code); return; }
  if (room.host === c.id) room.host = room.clients.keys().next().value;
  roomInfo(room);
}
function drop(c) { leaveRoom(c); clients.delete(c.id); }
function startGame(room) {
  const g = new Game(room); room.game = g; room.state = 'play';
  for (const c of room.clients.values()) { g.addPlayer(c.id, c.name, c.skin, false); c.stv = 0; c.inGame = true; }
  const nb = Math.max(0, Math.min(room.cfg.bots | 0, MAXP - room.clients.size));
  for (let i = 0; i < nb; i++) g.addPlayer(100 + i, BOTN[i % BOTN.length], (i + 3) % 8, true);
  for (const c of room.clients.values()) send(c, { t: 'init', map: g.rows, id: c.id });
  roomInfo(room);
}
function onMsg(c, m) {
  const room = c.room, g = room && room.game;
  switch (m.t) {
    case 'create': case 'quick': {
      leaveRoom(c); c.name = cleanName(m.name); c.skin = (m.skin | 0) & 7;
      const r = { code: newCode(), host: c.id, clients: new Map(), cfg: { bots: m.t === 'quick' ? 3 : 2, pvp: m.t !== 'quick', diff: 1 }, state: 'lobby', game: null };
      rooms.set(r.code, r); joinRoom(c, r); if (m.t === 'quick') startGame(r); break;
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return send(c, { t: 'err', k: 'nf' });
      if (r.clients.size >= MAXP) return send(c, { t: 'err', k: 'full' });
      leaveRoom(c); c.name = cleanName(m.name); c.skin = (m.skin | 0) & 7; joinRoom(c, r); break;
    }
    case 'cfg': if (room && room.host === c.id && room.state === 'lobby') { room.cfg = { bots: Math.max(0, Math.min(15, m.bots | 0)), pvp: !!m.pvp, diff: Math.max(0, Math.min(2, m.diff | 0)) }; roomInfo(room); } break;
    case 'start': if (room && room.host === c.id && room.state === 'lobby') startGame(room); break;
    case 'again': if (room && room.host === c.id && room.state === 'over') { room.state = 'lobby'; room.game = null; for (const x of room.clients.values()) x.inGame = false; roomInfo(room); } break;
    case 'leave': leaveRoom(c); break;
    case 'in': {
      if (!g) return; const p = g.pl.get(c.id); if (!p) return;
      const now = Date.now(), el = Math.min(.5, (now - p.lt) / 1000); p.lt = now;
      if (!p.alive) return;
      if (isFinite(m.x) && isFinite(m.y)) {
        const md = Math.hypot(m.x - p.x, m.y - p.y);
        if (md <= 7.5 * el + .6 && !g.blocked(m.x, m.y, .29)) { p.x = m.x; p.y = m.y; } else if (md > 0.05) p.snap++;
      }
      if (isFinite(m.a)) p.a = m.a; p.f = m.f ? 1 : 0;
      const w = m.w | 0; if (w >= 0 && w < 6 && p.own[w]) p.cur = w;
      break;
    }
    case 'buy': if (g) { const p = g.pl.get(c.id); if (p) g.buy(p, String(m.k)); } break;
    case 'place': if (g) { const p = g.pl.get(c.id); if (p) g.place(p, m.k | 0, m.x, m.y); } break;
    case 'sell': if (g) { const p = g.pl.get(c.id); if (p) g.sell(p, m.x, m.y); } break;
    case 'ready': if (g) { const p = g.pl.get(c.id); if (p && g.phase === 'day') p.ready = !p.ready; } break;
  }
}
setInterval(() => {
  for (const room of rooms.values()) {
    const g = room.game; if (!g || (room.state !== 'play' && room.state !== 'over')) continue;
    try { g.step(); g.send(room.clients.values()); } catch (e) { console.error('tick error', e); }
  }
}, 1000 / HZ);

if (require.main === module) {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') { fs.readFile(path.join(__dirname, 'index.html'), (e, d) => { if (e) { res.writeHead(404); res.end('index.html missing'); } else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d); } }); }
    else if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok rooms=' + rooms.size); }
    else { res.writeHead(404); res.end('not found'); }
  });
  server.on('upgrade', wsAccept);
  server.listen(PORT, () => console.log("The World's Last Dawn server on http://localhost:" + PORT));
}
module.exports = { Game, genMap };
