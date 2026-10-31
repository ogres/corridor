(() => {
'use strict';

// ---------------------------------------------------------------------------
// Layout. The hallway is one big circle; you walk clockwise, so it curves to the right.
//   Rw  inner wall (right hand side): room doors in deep recesses, and after
//       every two doors a big column
//   Rf  edge of the hallway floor on the left hand side
//   Rk  outer back wall (left hand side): room doors, reached across the floor
// Between Rf and Rk, after every two doors, is a glass-railed opening (shaft)
// that looks down/up through the floors. There are no windows: nothing looks
// outside.
// All angles are measured as atan2(x, z); positions are (r sin a, r cos a).
// ---------------------------------------------------------------------------
const Rw = 64;                     // inner wall radius (m)
const HALL_W = 4.4;                // width of the main hallway
const Rf = Rw + HALL_W;
const ZONE_D = 3.2;                // depth of the zone beyond the hallway floor
const Rk = Rf + ZONE_D;
const FLOOR_H = 3.4;               // floor to floor
const CEIL = 3.0;                  // clear height
const LEVEL_MIN = -2, LEVEL_MAX = 2;
const BAY = 4.8;                   // width of one room bay
const VOID_W = 4.4;                // width of a glass opening (at the back wall)
const COL_W = 1.8;                 // width of a big column
const COL_OUT = 0.7;               // how far a column sticks out into the hallway
const WALL_RECESS = 0.55;          // depth of the recess in front of an inner-wall room door
const ZONE_RECESS = 0.35;
const FIRST_ROOM = 2700;
const START_ANGLE = Math.PI;       // you walk towards decreasing angles (clockwise)
const WALL_PATTERN = [['bay', BAY], ['bay', BAY], ['col', COL_W]];
const ZONE_PATTERN = [['bay', BAY], ['bay', BAY], ['void', VOID_W]];

const chordAngle = (w, r) => 2 * Math.asin(w / (2 * r));
const wrapAngle = (a) => { a %= 2 * Math.PI; return a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a; };

// Lay a whole number of pattern periods around the circle at radius r, stretching
// each item slightly so the pattern (two doors, then a column/opening) never breaks.
function layout(pattern, r) {
  const period = pattern.reduce((s, [, w]) => s + chordAngle(w, r), 0);
  const periods = Math.floor(2 * Math.PI / period);
  const k = 2 * Math.PI / (periods * period);
  const items = [];
  let cum = 0;
  for (let p = 0; p < periods; p++) {
    for (const [type, w0] of pattern) {
      const ang = chordAngle(w0, r) * k;
      items.push({ type, w: 2 * r * Math.sin(ang / 2), ang, mid: START_ANGLE - (cum + ang / 2) });
      cum += ang;
    }
  }
  return items;
}
const wallItems = layout(WALL_PATTERN, Rw);
const zoneItems = layout(ZONE_PATTERN, Rk);
const WALL_COUNT = wallItems.filter(i => i.type === 'bay').length;
const ZONE_COUNT = zoneItems.filter(i => i.type === 'bay').length;
const ROOM_COUNT = WALL_COUNT + ZONE_COUNT;
// inner-wall rooms are even, glass-side rooms are odd (like the real hotel: 2768 faces 2769)
// numbers go down as you walk (you walk clockwise, curving right)
const wallNumber = i => FIRST_ROOM + 2 * (WALL_COUNT - 1 - i);
const zoneNumber = j => FIRST_ROOM + 1 + 2 * (ZONE_COUNT - 1 - j);
const atlasNumber = i => (i < WALL_COUNT ? wallNumber(i) : zoneNumber(i - WALL_COUNT));

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function texture(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

const woodTex = texture(canvas(256, 512, (g, w, h) => {
  g.fillStyle = '#c98f4b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) {
    const x = rnd(0, w), lw = rnd(.6, 2.6);
    g.fillStyle = Math.random() < .5 ? `rgba(90,50,15,${rnd(.03, .13)})` : `rgba(255,220,160,${rnd(.03, .12)})`;
    g.fillRect(x, 0, lw, h);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(80,40,10,${rnd(.04, .1)})`;
    g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(30, 160));
  }
  g.fillStyle = 'rgba(70,35,8,.35)'; g.fillRect(0, 0, 2, h); g.fillRect(w / 2, 0, 1.5, h);
}));

const floorTex = texture(canvas(512, 256, (g, w, h) => {
  g.fillStyle = '#e9d3b1'; g.fillRect(0, 0, w, h);
  const tiles = [[0, 0], [256, 0], [-128, 128], [128, 128], [384, 128]];
  for (const [x, y] of tiles) {
    g.fillStyle = `rgba(${rnd(215, 240) | 0},${rnd(190, 212) | 0},${rnd(150, 175) | 0},.55)`;
    g.fillRect(x, y, 256, 128);
    const grad = g.createLinearGradient(x, y, x + 256, y + 128);
    grad.addColorStop(0, 'rgba(255,255,255,.12)'); grad.addColorStop(1, 'rgba(120,80,40,.1)');
    g.fillStyle = grad; g.fillRect(x, y, 256, 128);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(150,105,60,${rnd(.02, .06)})`;
      g.fillRect(x + rnd(0, 256), y + rnd(0, 120), rnd(40, 160), rnd(1, 3));
    }
  }
  g.strokeStyle = 'rgba(120,95,65,.7)'; g.lineWidth = 2;
  g.strokeRect(0, 0, w, h);
  g.beginPath(); g.moveTo(0, 128); g.lineTo(w, 128); g.stroke();
  g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 128); g.stroke();
  g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 256); g.moveTo(384, 128); g.lineTo(384, 256); g.stroke();
}));

const ATLAS = 1024, CELL_W = 80, CELL_H = 60, ATLAS_COLS = 12;
const atlasTex = texture(canvas(ATLAS, ATLAS, (g) => {
  g.fillStyle = '#b9bcc0'; g.fillRect(0, 0, ATLAS, ATLAS);
  g.fillStyle = '#23262a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 26px Helvetica, Arial, sans-serif';
  for (let i = 0; i < ROOM_COUNT; i++) {
    const cx = (i % ATLAS_COLS) * CELL_W + CELL_W / 2;
    const cy = ((i / ATLAS_COLS) | 0) * CELL_H + CELL_H * 0.62;
    g.fillText(String(atlasNumber(i)), cx, cy);
  }
}));
atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping;

// ---------------------------------------------------------------------------
// Merged static geometry, one batch per material
// ---------------------------------------------------------------------------
class Batch {
  constructor(material, uvScale = [1, 1]) {
    this.material = material; this.s = uvScale;
    this.p = []; this.n = []; this.uv = []; this.i = [];
  }
  quad(pts, n, uvs) {
    const base = this.p.length / 3;
    for (const v of pts) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    for (const t of uvs) this.uv.push(t[0], t[1]);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(new THREE.Uint32BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, this.material);
  }
}

const lambert = (o) => new THREE.MeshLambertMaterial(o);
const B = {
  floor: new Batch(lambert({ map: floorTex, color: 0xf0e8da }), [2.4, 1.2]),
  ceil: new Batch(lambert({ color: 0xfff1d8 }), [1, 1]),
  white: new Batch(lambert({ color: 0xf4e9d2 }), [1, 1]),
  skirt: new Batch(lambert({ color: 0xe3d8c0 }), [1, 1]),
  wood: new Batch(lambert({ map: woodTex, color: 0xeadcc4 }), [1.2, 2.4]),
  door: new Batch(lambert({ map: woodTex, color: 0xdcc3a0 }), [1.0, 2.2]),
  groove: new Batch(lambert({ color: 0x5e3b1b }), [1, 1]),
  steel: new Batch(new THREE.MeshPhongMaterial({ color: 0xcfd2d6, shininess: 90, specular: 0x888888 }), [1, 1]),
  black: new Batch(lambert({ color: 0x141414 }), [1, 1]),
  switchPlate: new Batch(lambert({ color: 0xf6f4ec }), [1, 1]),
  plate: new Batch(lambert({ color: 0xb9bcc0 }), [1, 1]),
  signText: new Batch(lambert({ map: atlasTex }), [1, 1]),
  light: new Batch(new THREE.MeshBasicMaterial({ color: 0xffd48e }), [1, 1]),
  sky: new Batch(new THREE.MeshBasicMaterial({ color: 0xfff3da }), [1, 1]),
  glass: new Batch(new THREE.MeshPhongMaterial({
    color: 0xcfe9e4, transparent: true, opacity: 0.2, depthWrite: false,
    shininess: 100, specular: 0xffffff,
  }), [1, 1]),
};

// Wall frame: local (u along the wall, y up, d from the wall face into the hallway).
// Rotation about Y only, so box winding stays correct.
function frame(theta, a) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    pt: (u, y, d) => [c * u + s * d - s * a, y, -s * u + c * d - c * a],
    nm: (nu, ny, nd) => [c * nu + s * nd, ny, -s * nu + c * nd],
  };
}

// [normal axis, sign, tangent1, tangent2] with t1 x t2 = normal
const FACES = [[0, 1, 1, 2], [0, -1, 2, 1], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];

function box(b, F, u0, u1, y0, y1, d0, d1) {
  const mn = [u0, y0, d0], mx = [u1, y1, d1];
  for (const [ax, sg, t1, t2] of FACES) {
    const fixed = sg > 0 ? mx[ax] : mn[ax];
    const pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => {
      const c = [0, 0, 0];
      c[ax] = fixed; c[t1] = i ? mx[t1] : mn[t1]; c[t2] = j ? mx[t2] : mn[t2];
      return c;
    });
    const nl = [0, 0, 0]; nl[ax] = sg;
    const h = ax === 0 ? 2 : 0, v = ax === 1 ? 2 : 1;
    b.quad(pts.map(c => F.pt(c[0], c[1], c[2])), F.nm(nl[0], nl[1], nl[2]),
      pts.map(c => [c[h] / b.s[0], c[v] / b.s[1]]));
  }
}

// Annular wedge (floor or ceiling) between radii r0..r1 and angles a0..a1, in 1 degree steps.
function wedge(b, r0, r1, a0, a1, y, up) {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 180)));
  const P = (r, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  for (let i = 0; i < steps; i++) {
    const s0 = a0 + (a1 - a0) * i / steps, s1 = a0 + (a1 - a0) * (i + 1) / steps;
    const pts = [P(r0, s0), P(r1, s0), P(r1, s1), P(r0, s1)];
    const ux = pts[1][0] - pts[0][0], uz = pts[1][2] - pts[0][2];
    const vx = pts[2][0] - pts[1][0], vz = pts[2][2] - pts[1][2];
    if ((uz * vx - ux * vz > 0) !== up) pts.reverse();
    b.quad(pts, [0, up ? 1 : -1, 0], pts.map(p => [p[0] / b.s[0], p[2] / b.s[1]]));
  }
}

function signQuad(F, u0, u1, y0, y1, d, index) {
  const c = index % ATLAS_COLS, r = (index / ATLAS_COLS) | 0;
  const l = c * CELL_W / ATLAS, rr = (c + 1) * CELL_W / ATLAS;
  const bt = 1 - (r + 1) * CELL_H / ATLAS, tp = 1 - r * CELL_H / ATLAS;
  B.signText.quad(
    [F.pt(u0, y0, d), F.pt(u1, y0, d), F.pt(u1, y1, d), F.pt(u0, y1, d)],
    F.nm(0, 0, 1), [[l, bt], [rr, bt], [rr, tp], [l, tp]]);
}

// ---------------------------------------------------------------------------
// Build the building
// ---------------------------------------------------------------------------
const doors = [];      // interactive doors on the player's floor
const columns = [];    // big columns on the outer wall (player's floor): { mid, half }
const voids = [];      // glass openings on the player's floor: { mid, half }
const lampSpots = [];  // light positions along the hallway (player's floor)

// One recessed room door: wooden panel, door in an alcove, white wall strip,
// cove light above, number plate and card slot.
function roomBay(ctx, ub, rec, extra = 0) {
  const { bx, world, F, detail, record } = ctx;
  const AD = ctx.recess;                       // how deep the door is set back
  const o = ub + extra;                        // bays are stretched a little: the extra goes into the white strip

  bx(B.white, ub, o + 1.8, 0, CEIL, -0.35, 0);
  bx(B.skirt, ub, o + 1.8, 0, 0.08, 0, 0.015);
  bx(B.wood, o + 1.8, o + 2.02, 0, 2.7, -AD, 0.08);
  bx(B.wood, o + 3.18, o + BAY, 0, 2.7, -AD, 0.08);
  bx(B.wood, o + 2.02, o + 3.18, 2.1, 2.7, -AD, 0.08);
  bx(B.white, o + 1.8, o + BAY, 2.7, CEIL, -0.35, 0);
  bx(B.door, o + 2.02, o + 3.18, 0, 2.1, -AD, -AD + 0.05);
  bx(B.light, ub, o + BAY, 2.72, 2.78, 0, 0.18);
  bx(B.plate, o + 3.5, o + 3.78, 1.55, 1.76, 0.08, 0.09);
  bx(B.switchPlate, o + 3.55, o + 3.65, 1.1, 1.2, 0.08, 0.095);

  if (detail) {
    bx(B.groove, o + 2.38, o + 2.395, 0, 2.1, -AD + 0.05, -AD + 0.055);
    bx(B.groove, o + 2.78, o + 2.795, 0, 2.1, -AD + 0.05, -AD + 0.055);
    bx(B.steel, o + 2.95, o + 3.1, 1.0, 1.04, -AD + 0.05, -AD + 0.12);
    bx(B.black, o + 2.98, o + 3.06, 1.3, 1.45, -AD + 0.05, -AD + 0.06);
  }
  if (record && rec) {
    signQuad(F, o + 3.52, o + 3.76, 1.57, 1.74, 0.0905, rec.atlas);
    const n = F.nm(0, 0, 1);
    doors.push({
      kind: 'room', number: rec.number,
      pos: world(o + 2.6, 1.05, -AD + 0.05),
      normal: new THREE.Vector3(n[0], 0, n[2]),
    });
  }
}

// Glass-railed opening into a vertical shaft that runs through all floors.
// Seen from the hallway it is in the left wall; the sides are radial.
function voidOpening(ctx, level, item) {
  const { bx, record } = ctx;
  const half = item.ang / 2;
  const hw = item.w / 2;
  const front = Rk - Rf * Math.cos(half);          // distance from the back wall to the front glass chord
  const fh = Rf * Math.sin(half);
  const Y = level * FLOOR_H;

  bx(B.white, -hw - 0.3, hw + 0.3, -0.4, CEIL, -0.45, 0);

  // front glass, handrail, standoffs and slab edge
  bx(B.glass, -fh, fh, 0.12, 1.12, front - 0.006, front + 0.006);
  bx(B.steel, -fh, fh, 1.08, 1.14, front - 0.025, front + 0.025);
  bx(B.white, -fh, fh, -0.4, 0, front - 0.14, front - 0.04);
  if (level === LEVEL_MAX) bx(B.white, -fh, fh, CEIL, CEIL + 0.4, front - 0.14, front - 0.04);
  const posts = Math.ceil(2 * fh / 1.4) + 1;
  for (let k = 0; k < posts; k++) {
    const pu = -fh + 0.12 + (2 * fh - 0.24) * k / (posts - 1);
    bx(B.steel, pu - 0.035, pu + 0.035, 0, 0.2, front - 0.04, front + 0.04);
  }

  // radial side glass
  for (const sgn of [-1, 1]) {
    const beta = item.mid + sgn * half;
    const Fs = frame(beta - Math.PI / 2, 0);
    const sb = (b, ua, ub, ya, yb, da, db) => box(b, Fs, ua, ub, ya + Y, yb + Y, da, db);
    sb(B.glass, Rf, Rk, 0.12, 1.12, -0.006, 0.006);
    sb(B.steel, Rf, Rk, 1.08, 1.14, -0.025, 0.025);
    sb(B.white, Rf, Rk, -0.4, 0, -0.06, 0.06);
    if (level === LEVEL_MAX) sb(B.white, Rf, Rk, CEIL, CEIL + 0.4, -0.06, 0.06);
    const n = Math.ceil((Rk - Rf) / 1.4) + 1;
    for (let k = 0; k < n; k++) {
      const pu = Rf + 0.12 + (Rk - Rf - 0.24) * k / (n - 1);
      sb(B.steel, pu - 0.035, pu + 0.035, 0, 0.2, -0.04, 0.04);
    }
  }

  if (level === LEVEL_MIN) wedge(B.floor, Rf, Rk, item.mid - half, item.mid + half, Y, true);
  if (level === LEVEL_MAX) {
    wedge(B.ceil, Rf, Rk, item.mid - half, item.mid + half, Y + CEIL, false);
    wedge(B.sky, Rf + 0.3, Rk - 0.3, item.mid - half + 0.01, item.mid + half - 0.01, Y + CEIL - 0.02, false);
  }
  if (record) voids.push({ mid: item.mid, half });
}

function buildSides(level) {
  const Y = level * FLOOR_H;
  const detail = Math.abs(level) <= 1;
  const record = level === 0;
  const makeCtx = (F, recess) => ({
    F, detail, record, recess,
    bx: (b, ua, ub, ya, yb, da, db) => box(b, F, ua, ub, ya + Y, yb + Y, da, db),
    world: (u, y, d) => { const p = F.pt(u, y + Y, d); return new THREE.Vector3(p[0], p[1], p[2]); },
  });

  // ---- inner wall (right hand side): two recessed doors, then a big column --
  let i = 0;
  for (const it of wallItems) {
    const ctx = makeCtx(frame(it.mid, -Rw), WALL_RECESS);
    const { bx } = ctx;
    const hw = it.w / 2;
    if (it.type === 'bay') {
      bx(B.white, -hw - 0.1, hw + 0.1, 0, CEIL, -WALL_RECESS - 0.1, -WALL_RECESS);
      roomBay(ctx, -hw, { atlas: i, number: wallNumber(i) }, it.w - BAY);
      if (record) {
        const r = Rw + HALL_W / 2;
        lampSpots.push(new THREE.Vector3(r * Math.sin(it.mid), 2.55, r * Math.cos(it.mid)));
      }
      i++;
    } else {
      bx(B.white, -hw, hw, 0, CEIL, -0.45, COL_OUT);
      bx(B.skirt, -hw - 0.01, hw + 0.01, 0, 0.08, COL_OUT, COL_OUT + 0.015);
      if (record) columns.push({ mid: it.mid, half: it.ang / 2 });
    }
  }

  // ---- outer back wall (left hand side): two doors, then a glass opening ----
  let j = 0;
  for (const it of zoneItems) {
    const ctx = makeCtx(frame(it.mid + Math.PI, Rk), ZONE_RECESS);
    const { bx } = ctx;
    const hw = it.w / 2;
    if (it.type === 'bay') {
      bx(B.white, -hw - 0.1, hw + 0.1, 0, CEIL, -0.45, -0.35);
      roomBay(ctx, -hw, { atlas: WALL_COUNT + j, number: zoneNumber(j) }, it.w - BAY);
      j++;
    } else {
      voidOpening(ctx, level, it);
    }
  }
}

function buildLevel(level) {
  const Y = level * FLOOR_H;
  // floor and ceiling reach into every recess so alcoves never show a hole
  const rIn = Rw - WALL_RECESS - 0.05;
  wedge(B.floor, rIn, Rf, 0, 2 * Math.PI, Y, true);
  wedge(B.ceil, rIn, Rf, 0, 2 * Math.PI, Y + CEIL, false);
  for (const it of zoneItems) {
    if (it.type === 'void') continue;
    wedge(B.floor, Rf, Rk + 0.4, it.mid - it.ang / 2, it.mid + it.ang / 2, Y, true);
    wedge(B.ceil, Rf, Rk + 0.4, it.mid - it.ang / 2, it.mid + it.ang / 2, Y + CEIL, false);
  }
  buildSides(level);
}

// level 0 first so the rooms are numbered in order
buildLevel(0);
for (let k = LEVEL_MIN; k <= LEVEL_MAX; k++) if (k !== 0) buildLevel(k);

// ---------------------------------------------------------------------------
// Renderer, scene, lights
// ---------------------------------------------------------------------------
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2013);
scene.fog = new THREE.Fog(0x4a3a24, 40, 320);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 500);
camera.rotation.order = 'YXZ';
scene.add(camera);

for (const k of Object.keys(B)) {
  const m = B[k].build();
  if (k === 'glass') m.renderOrder = 2;
  scene.add(m);
}

scene.add(new THREE.HemisphereLight(0xfff0d6, 0x8a7656, 0.5));
scene.add(new THREE.AmbientLight(0xffe9c8, 0.3));
const lamp = new THREE.PointLight(0xffe2b0, 0.1, 9, 1.5);
camera.add(lamp);
const LIGHTS = 6;
const bayLights = [];
for (let i = 0; i < LIGHTS; i++) {
  const l = new THREE.PointLight(0xffc477, 0, 18, 1.2);
  scene.add(l); bayLights.push(l);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Player state and collisions
// ---------------------------------------------------------------------------
const R = 0.3, EYE = 1.65;
const player = { x: 0, z: -(Rw + HALL_W / 2), yaw: -Math.PI / 2, pitch: 0, vx: 0, vz: 0 };

const BLOCK = { NONE: 0, OUTER: 1, GLASS: 2, WALL: 3 };
function blocked(x, z) {
  const r = Math.hypot(x, z);
  if (r > Rk - R) return BLOCK.OUTER;
  if (r < Rw + R) return BLOCK.WALL;
  if (r < Rw + COL_OUT + R) {
    const a = Math.atan2(x, z);
    for (const c of columns) {
      if (Math.abs(wrapAngle(a - c.mid)) < c.half + R / r) return BLOCK.WALL;
    }
  }
  if (r > Rf - R) {
    const a = Math.atan2(x, z);
    for (const v of voids) {
      if (Math.abs(wrapAngle(a - v.mid)) < v.half + (R + 0.05) / r) return BLOCK.GLASS;
    }
  }
  return BLOCK.NONE;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = {};
let started = false, locked = false, dragMode = false, dragging = false;
const overlay = document.getElementById('overlay');

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!started) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyN') audio.toggle();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

window.addEventListener('mousemove', (e) => {
  if (!started || !(locked || dragging)) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - e.movementY * 0.0022));
});
view.addEventListener('mousedown', () => { if (dragMode) dragging = true; });
window.addEventListener('mouseup', () => { dragging = false; });
view.addEventListener('click', () => { if (started && (locked || dragMode)) interact(); });

function begin() {
  audio.start();
  started = true;
  overlay.classList.add('hidden');
  if (!clock.running) { clock.start(); firstToast(); }
  view.requestPointerLock && view.requestPointerLock();
}
overlay.addEventListener('click', () => {
  if (!started) begin();
  else if (!dragMode) view.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === view;
  if (started) overlay.classList.toggle('hidden', locked || dragMode);
});
document.addEventListener('pointerlockerror', () => {
  dragMode = true;
  overlay.classList.add('hidden');
  toast('Pointer lock unavailable: drag the mouse to look around.', 5000);
});

// ---------------------------------------------------------------------------
// Audio: faint hum and footsteps
// ---------------------------------------------------------------------------
const audio = {
  ctx: null, master: null, noise: null, on: true,
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.12;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const hum = this.ctx.createGain(); hum.gain.value = 0.012; hum.connect(this.master);
    for (const f of [58, 117, 175]) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.connect(hum); o.start();
    }
  },
  toggle() {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 1 : 0;
    toast(this.on ? 'Sound on.' : 'Sound off. The hum is still in your head.', 2200);
  },
  step(run) {
    if (!this.ctx || !this.on) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = rnd(0.8, 1.1);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = this.ctx.createGain(); g.gain.value = run ? 0.28 : 0.18;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  },
};

// ---------------------------------------------------------------------------
// Jokes
// ---------------------------------------------------------------------------
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const LINES = {
  intro: [
    'Reception said: “Your room is just down the hall.”',
    'Check-in took two minutes. Finding the room will surely take less.',
  ],
  outer: [
    'That is the outside. Not allowed.',
    'There is no outside. Only hallway.',
    'You push the wall. The wall wins.',
    'Management has decided that outside is optional. And unavailable.',
  ],
  glass: [
    'Please do not jump. The lobby is far, but the hallway is farther.',
    'The glass railing says: “No.”',
    'You look down the shaft. The other floors also have this hallway.',
    'The shaft is for looking at, not for leaving.',
  ],
  wall: [
    'A wall. Solid. Unlike your sense of direction.',
    'Behind this wall: more rooms. Not yours.',
    'You bump into the wall. It has seen worse.',
  ],
  wrong: [
    'Room {n}: nobody answers. Or they know you will come back in 6 minutes.',
    'Room {n}: “Housekeeping?” “No, I am just passing. Again.”',
    'Room {n}: “Are you the guy who keeps walking past every few minutes?”',
    'Room {n}: not yours. Yours is {t}. Keep looking.',
    'Room {n}: a TV is playing. Someone inside is also very comfortable. Jealous.',
    'Room {n}: the Do Not Disturb sign is a polite suggestion, but the door is locked.',
    'Room {n}: someone inside says “wrong door” without opening it.',
    'Room {n}: it smells like a nice room. You are not in it.',
  ],
  lapMilestones: {
    1: 'Lap 1. These doors look strangely familiar...',
    2: 'Lap 2. You feel as if you have been here before. You have.',
    3: 'Lap 3. The glass railings are starting to judge you.',
    5: 'Lap 5. The buffet is closing. You are not going to make it.',
    7: 'Lap 7. You say hello to a door. The door does not answer.',
    10: 'Lap 10. You can now give directions to the hallway to anyone. In circles.',
    15: 'Lap 15. The hallway thanks you for your loyalty.',
    25: 'Lap 25. Your room is probably 25 laps from here. Or 0.',
    50: 'Lap 50. A staff member asks if you live here now.',
    96: 'Lap 96. Marathon distance. A medal is available at reception. Reception: not found.',
  },
  lapGeneric: [
    'Another lap. Another day.',
    'Still the same hallway.',
    'You pass door {n} again. Door {n} remembers you.',
    'The hallway is long. The hallway is patient.',
  ],
  distance: {
    500: '500 m of hallway. Almost a light workout.',
    1000: '1 km walked. The hotel gym would like to talk.',
    2000: '2 km. You could have walked to a different hotel.',
    5000: '5 km. There is a real 5K race you could have run.',
    10000: '10 km. You could have crossed a small city.',
  },
};

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
// Your room does not exist: pick a believable number inside the range that no door has.
const existing = new Set(doors.map(d => d.number));
const maxNumber = Math.max(...existing);
const missing = [];
for (let n = FIRST_ROOM + Math.floor((maxNumber - FIRST_ROOM) / 2); n <= maxNumber; n++) {
  if (!existing.has(n)) missing.push(n);
}
const targetNumber = missing.length ? pick(missing) : maxNumber + 1;

const game = {
  laps: 0, dist: 0, angle: 0, lastAngle: null,
  nextDist: [500, 1000, 2000, 5000, 10000],
};

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const hudTarget = $('hudTarget'), hudDist = $('hudDist'),
  hudTime = $('hudTime'), hudNear = $('hudNear'), promptEl = $('prompt'), toastEl = $('toast');
hudTarget.innerHTML = `Your room: <b>${targetNumber}</b>`;

let toastTimer = 0;
function toast(text, ms = 4800) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function firstToast() {
  toast(pick(LINES.intro), 5000);
  setTimeout(() => toast(`Your room is ${targetNumber}. How far could it be?`, 5500), 5600);
}

const clock = { running: false, t: 0, start() { this.running = true; } };

function interact() {
  const d = facingDoor();
  if (!d) return;
  toast(pick(LINES.wrong).replace('{n}', d.number).replace('{t}', targetNumber));
}

let nearDoor = null;
function facingDoor() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let best = null, bestD = 2.4;
  for (const d of doors) {
    const dx = d.pos.x - player.x, dz = d.pos.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > bestD) continue;
    // player must be on the hallway side and looking towards the door
    if (dx * d.normal.x + dz * d.normal.z > 0) continue;
    if ((dx * fx + dz * fz) / (dist || 1) < 0.72) continue;
    best = d; bestD = dist;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
let bob = 0, lastStepSign = 0, hudAcc = 0;
let bumpTimer = 0, bumpCooldown = 0;

function lightsFollow() {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < lampSpots.length; i++) {
    const d = (lampSpots[i].x - player.x) ** 2 + (lampSpots[i].z - player.z) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  const used = new Set();
  for (let j = -2; j <= 3; j++) {
    const idx = (bi + j + lampSpots.length) % lampSpots.length;
    const l = bayLights[idx % LIGHTS];
    if (used.has(l)) continue;
    used.add(l);
    l.position.copy(lampSpots[idx]);
    l.intensity = 0.28;
  }
  for (const l of bayLights) if (!used.has(l)) l.intensity = 0;
}

function step(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
  player.yaw += turn * 1.8 * dt;

  const run = keys.ShiftLeft || keys.ShiftRight;
  const speed = run ? 6.5 : 3.4;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  let tx = fx * f + rx * s, tz = fz * f + rz * s;
  const m = Math.hypot(tx, tz);
  if (m > 0) { tx = tx / m * speed; tz = tz / m * speed; }
  const k = 1 - Math.exp(-12 * dt);
  player.vx += (tx - player.vx) * k;
  player.vz += (tz - player.vz) * k;

  const dx = player.vx * dt, dz = player.vz * dt;
  let hit = 0;
  const nx = player.x + dx;
  const bxk = blocked(nx, player.z);
  if (!bxk) player.x = nx; else hit = bxk;
  const nz = player.z + dz;
  const bzk = blocked(player.x, nz);
  if (!bzk) player.z = nz; else hit = hit || bzk;

  const moved = Math.hypot(dx, dz);
  if (hit && m > 0) {
    bumpTimer += dt;
    if (bumpTimer > 0.5 && bumpCooldown <= 0) {
      const kind = hit === BLOCK.OUTER ? 'outer' : hit === BLOCK.GLASS ? 'glass' : 'wall';
      toast(pick(LINES[kind]), 3800);
      bumpCooldown = 6; bumpTimer = 0;
    }
  } else bumpTimer = 0;
  bumpCooldown -= dt;

  // lap counting by accumulated angle around the building
  const ang = Math.atan2(player.x, player.z);
  if (game.lastAngle !== null) {
    let da = ang - game.lastAngle;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    game.angle += da;
  }
  game.lastAngle = ang;
  const laps = Math.floor(Math.abs(game.angle) / (2 * Math.PI));
  if (laps > game.laps) {
    game.laps = laps;
    const line = LINES.lapMilestones[laps] ||
      pick(LINES.lapGeneric).replace(/\{n\}/g, nearDoor ? nearDoor.number : targetNumber);
    toast(line, 5500);
  }
  game.dist += moved;
  while (game.nextDist.length && game.dist >= game.nextDist[0]) {
    toast(LINES.distance[game.nextDist.shift()], 5500);
  }

  // head bob and steps
  if (moved > 0.0005) bob += moved * (run ? 1.9 : 2.3);
  const bs = Math.sin(bob * Math.PI);
  const sign = bs >= 0 ? 1 : -1;
  if (sign !== lastStepSign && moved > 0.0005) audio.step(run);
  lastStepSign = sign;

  camera.position.set(player.x, EYE + Math.abs(bs) * 0.035 * (moved > 0.0005 ? 1 : 0), player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function updateHud(dt) {
  clock.t += dt;
  hudAcc += dt;
  if (hudAcc < 0.2) return;
  hudAcc = 0;

  hudDist.textContent = game.dist < 1000 ? `${Math.round(game.dist)} m` : `${(game.dist / 1000).toFixed(2)} km`;
  const t = Math.floor(clock.t);
  hudTime.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

  let nd = null, best = Infinity;
  for (const d of doors) {
    if (d.kind !== 'room') continue;
    const dist = (d.pos.x - player.x) ** 2 + (d.pos.z - player.z) ** 2;
    if (dist < best) { best = dist; nd = d; }
  }
  nearDoor = nd;
  hudNear.textContent = nd ? nd.number : '----';

  const fd = facingDoor();
  if (fd) {
    promptEl.classList.remove('hidden');
    promptEl.textContent = `[E] Try door ${fd.number}`;
  } else promptEl.classList.add('hidden');
}

let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (started && (locked || dragMode)) { step(dt); updateHud(dt); }
  else if (!started) {
    // slow idle drift behind the title card
    player.yaw += dt * 0.04;
    camera.position.set(player.x, EYE, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }
  lightsFollow();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

camera.position.set(player.x, EYE, player.z);
camera.rotation.set(0, player.yaw, 0);
requestAnimationFrame(loop);
})();
