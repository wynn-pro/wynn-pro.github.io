// Dragon Blocks: a 3D world made of blocks. Dig down, build anything, and find the 5 Dragon Crystals
// hidden deep underground so the dragon egg can hatch.
// It is drawn with WebGL, the part of the browser that talks to the graphics card. No downloads needed.
"use strict";

// ---------- 1. the world is a big box full of numbers ----------
// The world is 96 blocks wide, 96 deep and 48 tall. Every spot holds ONE number that says which
// block is there (0 means empty air). That's the big secret of every block game!
const W = 96;
const D = 96;
const H = 48;
const CHUNK = 16;             // we draw the world in 16 x 16 pieces called chunks
const SEA = 13;               // land lower than this turns into sandy beach
const CRYSTALS_TO_FIND = 5;
const DAY_LENGTH = 300;       // seconds for one whole day and night
const REACH = 6;              // how many blocks away you can dig or build

const GRAVITY = 28;
const JUMP = 8.6;
const WALK = 4.5;
const SPRINT = 7;
const FLY = 10;
const EYE = 1.6;              // how high your eyes are above your feet
const HALF = 0.3;             // you are 0.6 blocks wide...
const TALL = 1.8;             // ...and 1.8 blocks tall

const SAVE_KEY = "dragonblocks-save";

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAVES = 5, SAND = 6,
  PLANKS = 7, BRICKS = 8, GLASS = 9, CRYSTAL = 10, BEDROCK = 11;

// tiles = which little picture goes on the [top, sides, bottom] of each block
const BLOCKS = [
  null,
  { name: "Grass", tiles: [0, 1, 2] },
  { name: "Dirt", tiles: [2, 2, 2] },
  { name: "Stone", tiles: [3, 3, 3] },
  { name: "Log", tiles: [5, 4, 5] },
  { name: "Leaves", tiles: [6, 6, 6], seeThrough: true },
  { name: "Sand", tiles: [7, 7, 7] },
  { name: "Planks", tiles: [8, 8, 8] },
  { name: "Bricks", tiles: [9, 9, 9] },
  { name: "Glass", tiles: [10, 10, 10], seeThrough: true },
  { name: "Dragon Crystal", tiles: [11, 11, 11], glows: true },
  { name: "Bedrock", tiles: [12, 12, 12], unbreakable: true },
];
const HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, PLANKS, BRICKS, GLASS, LEAVES];

let world = new Uint8Array(W * D * H);
let crystals = [];            // where the crystals are, and which ones you found
const index = (x, y, z) => (x * D + z) * H + y;
const inside = (x, y, z) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H;

function getBlock(x, y, z) {
  return inside(x, y, z) ? world[index(x, y, z)] : AIR;
}

// solid means you bump into it. The edges of the world are invisible walls.
function isSolid(x, y, z) {
  if (y < 0 || x < 0 || x >= W || z < 0 || z >= D) return true;
  if (y >= H) return false;
  return world[index(x, y, z)] !== AIR;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// a random number maker that gives the same numbers every time for the same seed,
// so a world seed always grows the same world
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 2. growing hills with "noise" ----------
// Noise is randomness that changes smoothly, like rolling hills, instead of jumping around.
function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  let fx = x - xi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

// big bumps + medium bumps + small bumps = nice natural hills
function fbm(x, z, seed) {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let o = 0; o < 4; o++) {
    total += smoothNoise(x * freq, z * freq, seed + o * 17) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / max;
}

function generateWorld(seed) {
  world = new Uint8Array(W * D * H);
  const rand = mulberry32(seed);
  const height = new Int32Array(W * D);

  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const hills = fbm(x / 28, z / 28, seed);
      const mountain = smoothNoise(x / 45, z / 45, seed + 99);
      const h = Math.min(H - 10, Math.floor(4 + hills * 24 + Math.max(0, mountain - 0.62) * 45));
      height[x * D + z] = h;
      const beach = h <= SEA;
      // fill the column from the bottom up: bedrock, stone, dirt, then grass on top
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === 0 || (y === 1 && rand() < 0.5)) b = BEDROCK;
        else if (y < h - 3) b = STONE;
        else if (y < h) b = beach ? SAND : DIRT;
        else b = beach ? SAND : GRASS;
        world[index(x, y, z)] = b;
      }
    }
  }

  for (let x = 3; x < W - 3; x++) {
    for (let z = 3; z < D - 3; z++) {
      const h = height[x * D + z];
      if (world[index(x, h, z)] !== GRASS || rand() > 0.012) continue;
      if (Math.abs(x - W / 2) < 3 && Math.abs(z - D / 2) < 3) continue; // keep the start spot clear
      growTree(x, h + 1, z, rand);
    }
  }

  // hide the crystals deep in the stone, far apart and not right under where you start
  crystals = [];
  for (let tries = 0; crystals.length < CRYSTALS_TO_FIND && tries < 3000; tries++) {
    const x = 6 + Math.floor(rand() * (W - 12));
    const z = 6 + Math.floor(rand() * (D - 12));
    const y = 2 + Math.floor(rand() * 5);
    if (y > height[x * D + z] - 5) continue;
    if (Math.hypot(x - W / 2, z - D / 2) < 10) continue;
    if (!crystals.every((c) => Math.hypot(c.x - x, c.z - z) > 18)) continue;
    world[index(x, y, z)] = CRYSTAL;
    crystals.push({ x, y, z, found: false });
  }
}

function growTree(x, y, z, rand) {
  const trunk = 4 + Math.floor(rand() * 2);
  for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
    const r = dy >= trunk ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        // nibble the corners so the tree looks round
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === trunk + 1 || rand() < 0.5)) continue;
        if (inside(x + dx, y + dy, z + dz) && getBlock(x + dx, y + dy, z + dz) === AIR) {
          world[index(x + dx, y + dy, z + dz)] = LEAVES;
        }
      }
    }
  }
  for (let dy = 0; dy < trunk; dy++) world[index(x, y + dy, z)] = LOG;
}

// ---------- 3. painting the block pictures ----------
// Every block picture is only 16 x 16 pixels. We paint them all with code into one long strip
// called an atlas, and the graphics card cuts out the picture each face needs.
const TILE = 16;

function makeAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = TILE * 16;
  canvas.height = TILE;
  const g = canvas.getContext("2d");
  const rnd = mulberry32(7);
  const px = (t, x, y, c, v = 0) => {
    g.fillStyle = `rgb(${clamp(c[0] + v, 0, 255) | 0},${clamp(c[1] + v, 0, 255) | 0},${clamp(c[2] + v, 0, 255) | 0})`;
    g.fillRect(t * TILE + x, y, 1, 1);
  };
  const each = (fn) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y);
  };
  const jiggle = (amount) => (rnd() - 0.5) * amount;

  const green = [92, 166, 60], dirt = [134, 96, 67];
  each((x, y) => px(0, x, y, green, jiggle(40)));                       // 0 grass top
  each((x, y) => px(2, x, y, dirt, jiggle(30)));                        // 2 dirt
  for (let x = 0; x < TILE; x++) {                                      // 1 grass side
    const grassDepth = 3 + Math.floor(rnd() * 2);
    for (let y = 0; y < TILE; y++) px(1, x, y, y < grassDepth ? green : dirt, jiggle(30));
  }
  each((x, y) => px(3, x, y, [128, 128, 132], rnd() < 0.08 ? -45 : jiggle(26))); // 3 stone
  each((x, y) => px(4, x, y, x % 4 === 0 ? [78, 56, 34] : [108, 80, 50], jiggle(18))); // 4 log side
  each((x, y) => {                                                      // 5 log top: tree rings
    const d = Math.hypot(x - 7.5, y - 7.5);
    const c = d > 6.8 ? [108, 80, 50] : Math.floor(d) % 2 ? [176, 140, 90] : [150, 116, 72];
    px(5, x, y, c, jiggle(12));
  });
  each((x, y) => {                                                      // 6 leaves, with see-through holes
    if (rnd() < 0.16) return;
    px(6, x, y, [56, 132, 48], jiggle(50));
  });
  each((x, y) => px(7, x, y, [222, 208, 150], jiggle(22)));            // 7 sand
  each((x, y) => {                                                      // 8 planks
    const row = Math.floor(y / 4);
    const seam = (row * 5 + 3) % TILE;
    const line = y % 4 === 3 || x === seam;
    px(8, x, y, line ? [120, 86, 50] : [184, 142, 86], line ? 0 : jiggle(16));
  });
  each((x, y) => {                                                      // 9 bricks
    const row = Math.floor(y / 4);
    const mortar = y % 4 === 3 || (x + (row % 2 ? 4 : 0)) % 8 === 7;
    px(9, x, y, mortar ? [196, 190, 180] : [164, 70, 56], mortar ? jiggle(10) : jiggle(24));
  });
  each((x, y) => {                                                      // 10 glass: just a frame and a shine
    const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
    const shine = (x - y === 3 || x - y === 4) && x > 4 && x < 10;
    if (edge) px(10, x, y, [210, 236, 255]);
    else if (shine) px(10, x, y, [255, 255, 255]);
  });
  each((x, y) => px(11, x, y, [70, 58, 92], jiggle(20)));              // 11 dragon crystal
  for (const [cx, cy] of [[4, 4], [11, 5], [6, 11], [12, 12]]) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > 2) continue;
        px(11, cx + dx, cy + dy, d === 0 ? [255, 255, 255] : d === 1 ? [240, 140, 255] : [150, 230, 255]);
      }
    }
  }
  each((x, y) => px(12, x, y, [52, 52, 56], jiggle(56)));              // 12 bedrock
  return canvas;
}

// ---------- 4. turning blocks into triangles ----------
// Graphics cards only draw triangles. Each side of a block is a square = 2 triangles.
// We skip any side that touches another solid block, because nobody can see it anyway.
// c = the 4 corners of the side, n = which way it faces, light = how bright that side is
const FACES = [
  { n: [1, 0, 0], light: 0.8, part: 1, c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], light: 0.8, part: 1, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 0, 1], light: 0.68, part: 1, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], light: 0.68, part: 1, c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  { n: [0, 1, 0], light: 1.0, part: 0, c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], light: 0.55, part: 2, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
];
const CORNER_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const SHADOW = [0.5, 0.68, 0.84, 1];   // corners squeezed between blocks get darker

function faceShows(block, next) {
  if (next === AIR) return true;
  if (!BLOCKS[next].seeThrough) return false;
  return !(block === GLASS && next === GLASS);
}

function buildChunkMesh(cx, cz) {
  const out = [];
  const pos = [0, 0, 0], a = [0, 0, 0];
  for (let x = cx * CHUNK; x < cx * CHUNK + CHUNK; x++) {
    for (let z = cz * CHUNK; z < cz * CHUNK + CHUNK; z++) {
      for (let y = 0; y < H; y++) {
        const block = world[index(x, y, z)];
        if (block === AIR) continue;
        const info = BLOCKS[block];
        for (const f of FACES) {
          const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
          if (!faceShows(block, getBlock(nx, ny, nz))) continue;
          const tile = info.tiles[f.part];
          const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
          const s1 = (axis + 1) % 3, s2 = (axis + 2) % 3;
          const corners = [];
          for (let i = 0; i < 4; i++) {
            const c = f.c[i];
            let light = 2; // above 1.5 means "glows by itself" in the shader
            if (!info.glows) {
              // ambient shadow: look at the blocks touching this corner
              a[0] = nx; a[1] = ny; a[2] = nz;
              const d1 = c[s1] ? 1 : -1, d2 = c[s2] ? 1 : -1;
              pos[0] = a[0]; pos[1] = a[1]; pos[2] = a[2]; pos[s1] += d1;
              const side1 = getBlock(pos[0], pos[1], pos[2]) !== AIR;
              pos[0] = a[0]; pos[1] = a[1]; pos[2] = a[2]; pos[s2] += d2;
              const side2 = getBlock(pos[0], pos[1], pos[2]) !== AIR;
              pos[s1] += d1;
              const corner = getBlock(pos[0], pos[1], pos[2]) !== AIR;
              const open = side1 && side2 ? 0 : 3 - side1 - side2 - corner;
              light = f.light * SHADOW[open];
            }
            const [u, v] = CORNER_UV[i];
            corners.push([
              x + c[0], y + c[1], z + c[2],
              (tile + 0.002 + u * 0.996) / 16, 1 - (0.002 + v * 0.996),
              light,
            ]);
          }
          for (const i of [0, 1, 2, 0, 2, 3]) out.push(...corners[i]);
        }
      }
    }
  }
  return new Float32Array(out);
}

// ---------- 5. WebGL setup ----------
const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl", { antialias: false });

const BLOCK_VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute float aLight;
uniform mat4 uMVP; uniform vec3 uEye;
varying vec2 vUV; varying float vLight; varying float vDist;
void main() {
  vUV = aUV; vLight = aLight; vDist = distance(aPos, uEye);
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;
const BLOCK_FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uDaylight; uniform vec3 uFog; uniform float uFogFar;
varying vec2 vUV; varying float vLight; varying float vDist;
void main() {
  vec4 c = texture2D(uTex, vUV);
  if (c.a < 0.5) discard;
  float light = vLight > 1.5 ? 1.0 : vLight * uDaylight;
  float fog = clamp((vDist - uFogFar * 0.55) / (uFogFar * 0.45), 0.0, 1.0);
  gl_FragColor = vec4(mix(c.rgb * light, uFog, fog), 1.0);
}`;
const LINE_VS = `
attribute vec3 aPos; uniform mat4 uMVP; uniform vec3 uOffset;
void main() { gl_Position = uMVP * vec4(aPos + uOffset, 1.0); }`;
const LINE_FS = `
precision mediump float;
void main() { gl_FragColor = vec4(0.05, 0.05, 0.08, 1.0); }`;

function makeProgram(vsText, fsText, attribs) {
  const program = gl.createProgram();
  for (const [type, text] of [[gl.VERTEX_SHADER, vsText], [gl.FRAGMENT_SHADER, fsText]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  attribs.forEach((name, i) => gl.bindAttribLocation(program, i, name));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const u = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(program, i).name;
    u[name] = gl.getUniformLocation(program, name);
  }
  return { program, u };
}

let blockProg, lineProg, lineBuffer;
const atlas = makeAtlas();

function setupGL() {
  blockProg = makeProgram(BLOCK_VS, BLOCK_FS, ["aPos", "aUV", "aLight"]);
  lineProg = makeProgram(LINE_VS, LINE_FS, ["aPos"]);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // NEAREST keeps the pixels crisp
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // the 12 edges of a cube, for the outline around the block you are pointing at
  const lo = -0.003, hi = 1.003, edges = [];
  const p = (x, y, z) => [x ? hi : lo, y ? hi : lo, z ? hi : lo];
  for (let i = 0; i < 4; i++) {
    const a = i & 1, b = i >> 1;
    edges.push(...p(0, a, b), ...p(1, a, b), ...p(a, 0, b), ...p(a, 1, b), ...p(a, b, 0), ...p(a, b, 1));
  }
  lineBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges), gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);
}

const chunks = [];            // one drawing buffer per chunk
const dirtyChunks = new Set(); // chunks that changed and need new triangles
const CX = W / CHUNK, CZ = D / CHUNK;

function markAllDirty() {
  for (let cx = 0; cx < CX; cx++) for (let cz = 0; cz < CZ; cz++) dirtyChunks.add(cx * CZ + cz);
}

function rebuildDirtyChunks() {
  for (const id of dirtyChunks) {
    const cx = Math.floor(id / CZ), cz = id % CZ;
    const data = buildChunkMesh(cx, cz);
    if (!chunks[id]) chunks[id] = { buffer: gl.createBuffer(), count: 0 };
    gl.bindBuffer(gl.ARRAY_BUFFER, chunks[id].buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    chunks[id].count = data.length / 6;
  }
  dirtyChunks.clear();
}

function setBlock(x, y, z, block) {
  world[index(x, y, z)] = block;
  needsSave = true;
  // a change can also change shadows next door, so redraw the chunks around it too
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const cx = Math.floor((x + dx) / CHUNK), cz = Math.floor((z + dz) / CHUNK);
      if (cx >= 0 && cx < CX && cz >= 0 && cz < CZ) dirtyChunks.add(cx * CZ + cz);
    }
  }
}

// ---------- 6. 3D math: where the camera is and what it sees ----------
// A matrix is a grid of 16 numbers that moves, turns and squishes points. Multiply
// a block corner by it and you get where that corner lands on your screen.
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function lookAt(eye, dir) {
  const z = [-dir[0], -dir[1], -dir[2]];
  let x = [z[2], 0, -z[0]];                 // up (0, 1, 0) crossed with z
  const len = Math.hypot(x[0], x[2]) || 1;
  x = [x[0] / len, 0, x[2] / len];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const dot = (a) => a[0] * eye[0] + a[1] * eye[1] + a[2] * eye[2];
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x), -dot(y), -dot(z), 1]);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

// ---------- 7. you, the player ----------
const player = { x: W / 2 + 0.5, y: 30, z: D / 2 + 0.5, vy: 0, yaw: 0.6, pitch: -0.2, onGround: false, flying: false };
let slot = 0;
let target = null;            // the block you are pointing at
let dayT = 0.3;               // 0 to 1: where we are in the day
let playTime = 0;
let state = "title";          // title, playing, paused or won
let needsSave = false;
const keys = {};

function lookDir() {
  const cp = Math.cos(player.pitch);
  return [cp * Math.sin(player.yaw), Math.sin(player.pitch), -cp * Math.cos(player.yaw)];
}

// does your body (a box 0.6 wide and 1.8 tall) touch any solid block?
function bodyHitsBlock(px, py, pz) {
  for (let x = Math.floor(px - HALF); x <= Math.floor(px + HALF); x++) {
    for (let y = Math.floor(py); y <= Math.floor(py + TALL); y++) {
      for (let z = Math.floor(pz - HALF); z <= Math.floor(pz + HALF); z++) {
        if (isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

function bodyOverlapsCell(x, y, z) {
  return x < player.x + HALF && x + 1 > player.x - HALF &&
    y < player.y + TALL && y + 1 > player.y &&
    z < player.z + HALF && z + 1 > player.z - HALF;
}

// move one direction at a time. If we bump into a block, slide back right up against it.
function moveAxis(axis, amount) {
  const p = player;
  p[axis] += amount;
  if (!bodyHitsBlock(p.x, p.y, p.z)) return false;
  if (axis === "y") {
    p.y = amount < 0 ? Math.floor(p.y) + 1 : Math.floor(p.y + TALL) - TALL - 0.001;
  } else if (amount > 0) {
    p[axis] = Math.floor(p[axis] + HALF) - HALF - 0.001;
  } else {
    p[axis] = Math.floor(p[axis] - HALF) + 1 + HALF + 0.001;
  }
  return true;
}

function updatePlayer(dt) {
  const p = player;
  let fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp) fz += 1;
  if (keys.KeyS || keys.ArrowDown) fz -= 1;
  if (keys.KeyD || keys.ArrowRight) fx += 1;
  if (keys.KeyA || keys.ArrowLeft) fx -= 1;
  const len = Math.hypot(fx, fz) || 1;
  const speed = p.flying ? FLY : keys.ShiftLeft || keys.ShiftRight ? SPRINT : WALK;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  // forward is (sin, -cos) and right is (cos, sin) on the ground
  const vx = ((fz * sin + fx * cos) / len) * speed;
  const vz = ((-fz * cos + fx * sin) / len) * speed;

  if (p.flying) {
    p.vy = ((keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0)) * FLY;
  } else {
    if (keys.Space && p.onGround) p.vy = JUMP;
    p.vy = Math.max(p.vy - GRAVITY * dt, -40);
  }

  // split big moves into small steps so you never zoom straight through a block
  const steps = Math.ceil(Math.max(Math.abs(vx), Math.abs(p.vy), Math.abs(vz)) * dt / 0.4) || 1;
  p.onGround = false;
  for (let i = 0; i < steps; i++) {
    moveAxis("x", (vx * dt) / steps);
    moveAxis("z", (vz * dt) / steps);
    if (moveAxis("y", (p.vy * dt) / steps)) {
      if (p.vy < 0) p.onGround = true;
      p.vy = 0;
    }
  }

  if (p.y < -20) respawn();

  const eye = [p.x, p.y + EYE, p.z];
  const dir = lookDir();
  target = raycast(eye, dir, REACH);
}

function respawn() {
  const x = Math.floor(W / 2), z = Math.floor(D / 2);
  let y = H - 1;
  while (y > 0 && !isSolid(x, y - 1, z)) y--;
  while (y < H - 2 && (isSolid(x, y, z) || isSolid(x, y + 1, z))) y++;
  Object.assign(player, { x: x + 0.5, y, z: z + 0.5, vy: 0 });
}

// shoot an invisible laser from your eyes, hopping one block at a time, until it hits a block
function raycast(origin, dir, maxDist) {
  let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
  const step = dir.map((d) => (d > 0 ? 1 : -1));
  const delta = dir.map((d) => (d === 0 ? Infinity : Math.abs(1 / d)));
  const cell = [x, y, z];
  const tMax = dir.map((d, i) => {
    if (d === 0) return Infinity;
    return d > 0 ? (cell[i] + 1 - origin[i]) * delta[i] : (origin[i] - cell[i]) * delta[i];
  });
  let normal = [0, 0, 0], t = 0;
  while (t <= maxDist) {
    const block = getBlock(x, y, z);
    if (block !== AIR) return { x, y, z, normal, block };
    const i = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
    if (i === 0) x += step[0];
    else if (i === 1) y += step[1];
    else z += step[2];
    t = tMax[i];
    tMax[i] += delta[i];
    normal = [0, 0, 0];
    normal[i] = -step[i];
  }
  return null;
}

// ---------- 8. digging and building ----------
function dig() {
  if (!target) return;
  const { x, y, z, block } = target;
  if (BLOCKS[block].unbreakable) {
    toast("Bedrock is too hard to break!");
    sound(90, 0.12, "square", 0.08);
    return;
  }
  setBlock(x, y, z, AIR);
  if (block === CRYSTAL) foundCrystal(x, y, z);
  else sound(150 + Math.random() * 40, 0.08, "square", 0.06);
}

function build() {
  if (!target) return;
  const x = target.x + target.normal[0], y = target.y + target.normal[1], z = target.z + target.normal[2];
  if (!inside(x, y, z) || getBlock(x, y, z) !== AIR || bodyOverlapsCell(x, y, z)) return;
  setBlock(x, y, z, HOTBAR[slot]);
  sound(320, 0.06, "triangle", 0.08);
}

function foundCrystal(x, y, z) {
  const c = crystals.find((c) => c.x === x && c.y === y && c.z === z);
  if (c) c.found = true;
  const count = crystals.filter((c) => c.found).length;
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sound(f, 0.25, "sine", 0.1), i * 90));
  if (count >= crystals.length) {
    setTimeout(win, 700);
  } else {
    toast(`💎 You found a Dragon Crystal! ${crystals.length - count} more to go.`);
  }
  updateHud();
}

function win() {
  state = "won";
  needsSave = true;
  const mins = Math.floor(playTime / 60), secs = Math.floor(playTime % 60);
  document.getElementById("win-text").textContent =
    `You found all ${crystals.length} Dragon Crystals in ${mins} min ${secs} sec. The egg cracks open... a baby dragon is born!`;
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen("win-screen");
}

// ---------- 9. sound ----------
let audio = null;
let muted = false;

function sound(freq, length, type, volume) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator(), amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(volume, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + length);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + length);
  } catch (e) {
    // no sound on this browser, that's fine
  }
}

// ---------- 10. saving your world ----------
// Lots of the world is the same block in a row (like 20 airs). Instead of writing "air" 20 times
// we write "air, 20". This trick is called run-length encoding, and it makes the save small.
function packWorld() {
  const bytes = new Uint8Array(world.length * 2);
  let n = 0;
  for (let i = 0; i < world.length;) {
    let run = 1;
    while (i + run < world.length && world[i + run] === world[i] && run < 255) run++;
    bytes[n++] = world[i];
    bytes[n++] = run;
    i += run;
  }
  let text = "";
  for (let i = 0; i < n; i += 8192) text += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(n, i + 8192)));
  return btoa(text);
}

function unpackWorld(packed) {
  const text = atob(packed);
  const out = new Uint8Array(W * D * H);
  let at = 0;
  for (let i = 0; i < text.length; i += 2) {
    const block = text.charCodeAt(i), run = text.charCodeAt(i + 1);
    if (block >= BLOCKS.length || at + run > out.length) throw new Error("bad save");
    out.fill(block, at, at + run);
    at += run;
  }
  if (at !== out.length) throw new Error("bad save");
  return out;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      world: packWorld(), crystals, dayT, playTime, slot,
      player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    }));
    needsSave = false;
  } catch (e) {
    // the browser won't let us save (private window?), the game still works
  }
}

function loadGame() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!save) return false;
    world = unpackWorld(save.world);
    crystals = save.crystals;
    dayT = save.dayT || 0.3;
    playTime = save.playTime || 0;
    slot = save.slot || 0;
    Object.assign(player, save.player, { vy: 0 });
    return true;
  } catch (e) {
    return false;
  }
}

function newWorld() {
  generateWorld(Math.floor(Math.random() * 1e9));
  dayT = 0.3;
  playTime = 0;
  player.flying = false;
  respawn();
  markAllDirty();
  saveGame();
  updateHud();
}

// ---------- 11. the screen: HUD, menus and drawing ----------
const $ = (id) => document.getElementById(id);
const DAY_SKY = [0.53, 0.78, 0.98], NIGHT_SKY = [0.03, 0.04, 0.12];

function sunLight() {
  return clamp(0.5 + Math.sin(dayT * Math.PI * 2) * 0.8, 0, 1);
}

function buildHotbar() {
  const bar = $("hotbar");
  const url = atlas.toDataURL();
  HOTBAR.forEach((block, i) => {
    const el = document.createElement("button");
    el.className = "slot";
    el.title = BLOCKS[block].name;
    el.innerHTML = `<span class="num">${i + 1}</span><span class="icon"></span>`;
    const icon = el.querySelector(".icon");
    icon.style.backgroundImage = `url(${url})`;
    icon.style.setProperty("--tile", BLOCKS[block].tiles[1]);
    el.addEventListener("click", () => selectSlot(i));
    bar.appendChild(el);
  });
}

function selectSlot(i) {
  slot = (i + HOTBAR.length) % HOTBAR.length;
  document.querySelectorAll(".slot").forEach((el, j) => el.classList.toggle("selected", j === slot));
  $("block-name").textContent = BLOCKS[HOTBAR[slot]].name;
}

let toastTimer = 0;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function updateHud() {
  const found = crystals.filter((c) => c.found).length;
  $("crystals").textContent = `${found} / ${crystals.length}`;
  let nearest = Infinity;
  for (const c of crystals) {
    if (!c.found) nearest = Math.min(nearest, Math.hypot(c.x + 0.5 - player.x, c.y + 0.5 - player.y, c.z + 0.5 - player.z));
  }
  $("radar").textContent = nearest === Infinity ? "✅ All found!" :
    nearest < 6 ? "🔥 HOT!" : nearest < 14 ? "♨️ Warm" : nearest < 28 ? "🌤️ Cool" : "🧊 Cold";
  $("clock").textContent = sunLight() > 0.35 ? "☀️ Day" : "🌙 Night";
  $("fly").classList.toggle("hidden", !player.flying);
}

function showScreen(id) {
  for (const el of document.querySelectorAll(".overlay")) el.classList.toggle("hidden", el.id !== id);
  document.body.classList.toggle("in-menu", Boolean(id));
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * ratio), h = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function render() {
  resize();
  const light = sunLight();
  const sky = DAY_SKY.map((d, i) => lerp(NIGHT_SKY[i], d, light));
  gl.clearColor(sky[0], sky[1], sky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const eye = [player.x, player.y + EYE, player.z];
  const proj = perspective((70 * Math.PI) / 180, canvas.width / canvas.height, 0.05, 200);
  const mvp = multiply(proj, lookAt(eye, lookDir()));

  gl.useProgram(blockProg.program);
  gl.uniformMatrix4fv(blockProg.u.uMVP, false, mvp);
  gl.uniform3fv(blockProg.u.uEye, eye);
  gl.uniform1f(blockProg.u.uDaylight, 0.28 + 0.72 * light);
  gl.uniform3fv(blockProg.u.uFog, sky);
  gl.uniform1f(blockProg.u.uFogFar, 80);
  gl.uniform1i(blockProg.u.uTex, 0);
  for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
  for (const chunk of chunks) {
    if (!chunk || !chunk.count) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.buffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
    gl.drawArrays(gl.TRIANGLES, 0, chunk.count);
  }
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);

  if (state === "playing" && target) {
    gl.useProgram(lineProg.program);
    gl.uniformMatrix4fv(lineProg.u.uMVP, false, mvp);
    gl.uniform3f(lineProg.u.uOffset, target.x, target.y, target.z);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, 24);
  }
}

// ---------- 12. keyboard and mouse ----------
let held = -1;                // which mouse button is held down (-1 = none)
let holdTimer = 0;

function startPlaying() {
  const lock = canvas.requestPointerLock && canvas.requestPointerLock();
  if (lock && lock.catch) lock.catch(() => toast("Click again to play"));
}

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    state = "playing";
    showScreen(null);
  } else if (state === "playing") {
    state = "paused";
    held = -1;
    for (const k in keys) keys[k] = false;
    saveGame();
    showScreen("pause-screen");
  }
});

document.addEventListener("mousemove", (e) => {
  if (state !== "playing") return;
  player.yaw += e.movementX * 0.0025;
  player.pitch = clamp(player.pitch - e.movementY * 0.0025, -1.55, 1.55);
});

canvas.addEventListener("mousedown", (e) => {
  if (state !== "playing") return;
  // a Mac trackpad can Ctrl+click instead of right-clicking
  held = e.button === 2 || e.ctrlKey ? 2 : 0;
  held === 2 ? build() : dig();
  holdTimer = 0.3;
});
document.addEventListener("mouseup", () => { held = -1; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("wheel", (e) => {
  if (state !== "playing") return;
  e.preventDefault();
  selectSlot(slot + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "Space" && state === "playing") e.preventDefault();
  if (e.code.startsWith("Digit")) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1);
  }
  if (e.code === "KeyF" && state === "playing") {
    player.flying = !player.flying;
    player.vy = 0;
    toast(player.flying ? "🪽 Flying! Space goes up, Shift goes down. Press F to land." : "Back on your feet");
    updateHud();
  }
  if (e.code === "KeyM") {
    muted = !muted;
    toast(muted ? "🔇 Sound off" : "🔊 Sound on");
  }
});
document.addEventListener("keyup", (e) => { keys[e.code] = false; });

$("play").addEventListener("click", startPlaying);
$("resume").addEventListener("click", startPlaying);
$("keep-building").addEventListener("click", startPlaying);
for (const id of ["new-world", "pause-new-world", "win-new-world"]) {
  $(id).addEventListener("click", () => {
    if (id !== "win-new-world" && !confirm("Start a brand new world? This world will be gone forever.")) return;
    newWorld();
    toast("🌍 A brand new world!");
    startPlaying();
  });
}
window.addEventListener("pagehide", () => { if (needsSave) saveGame(); });

// ---------- 13. the game loop: runs about 60 times every second ----------
let last = performance.now();
let saveTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === "playing") {
    updatePlayer(dt);
    if (held >= 0) {
      holdTimer -= dt;
      if (holdTimer <= 0) {
        held === 2 ? build() : dig();
        holdTimer = 0.22;
      }
    }
    dayT = (dayT + dt / DAY_LENGTH) % 1;
    playTime += dt;
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      if (needsSave) saveGame();
    }
    updateHud();
  } else if (state === "title") {
    player.yaw += dt * 0.06;  // slowly look around behind the title screen
  }
  rebuildDirtyChunks();
  render();
  requestAnimationFrame(frame);
}

if (!gl) {
  $("title-text").textContent = "Oh no! This browser can't draw 3D. Try Chrome, Edge, Firefox or Safari.";
  $("play").disabled = true;
} else {
  setupGL();
  buildHotbar();
  if (loadGame()) {
    $("play").textContent = "▶ Keep playing";
  } else {
    generateWorld(Math.floor(Math.random() * 1e9));
    respawn();
  }
  selectSlot(slot);
  markAllDirty();
  updateHud();
  requestAnimationFrame(frame);
}
