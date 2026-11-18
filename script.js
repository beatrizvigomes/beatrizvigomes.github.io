/* =========================================================
   1. THE ROOM — pixel art drawn with code on a 320x180 grid.
   Dark room, muted red curtains, navy armchair, warm yellow lamp.
   ========================================================= */
const W = 400, H = 225;   // scene grid: bigger than the furniture needs, so everything has room to breathe
const OX = 40, OY = 22;   // the furniture is drawn in a 320x180 space, centred inside the grid
const FY = 162;           // y where the floor starts
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = document.getElementById('scene');
scene.width = W; scene.height = H;
const ctx = scene.getContext('2d');

const room = document.createElement('canvas');   // static layer, drawn once
room.width = W; room.height = H;
const rc = room.getContext('2d');
const R = (x, y, w, h, c) => { rc.fillStyle = c; rc.fillRect(x, y, w, h); };
const P = (x, y, c) => R(x, y, 1, 1, c);
function ellipse(cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    R(cx - w, cy + y, w * 2 + 1, 1, c);
  }
}
const shadow = (cx, cy, rx, ry) => ellipse(cx, cy, rx, ry, 'rgba(0,0,0,.5)');
function line(x0, y0, x1, y1, c) {                       // Bresenham
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    P(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// ----- palette: change colors here -----
const C = {
  wall: '#0b0709', floor: '#070405',
  drape: ['#14040a', '#22070d', '#310a12', '#420e18', '#52121e'],   // muted red velvet, dark -> light
  metal: '#2a2326', metalHi: '#4a4044',
  wood: '#1c1416', woodHi: '#30262a',
  shade: '#f2b94f', shadeHi: '#ffe08a', shadeDk: '#c98a2a', fringe: '#e0a640',
  screenBg: '#031008', green: '109,255,176',
};

// Armchair upholstery. Try the others by opening index.html?chair=green (or navy, burgundy)
// Armchair upholstery. Try the others with index.html?chair=burgundy (or plum, charcoal)
const CHAIRS = {
  green:    { base: '#12251e', hi: '#1a352b', dk: '#08130f', glow: '#2a5242', btn: '#040b08' },   // deep and muted: it sits in the shadows
  burgundy: { base: '#4a0f18', hi: '#6c1a26', dk: '#26070c', glow: '#9a2a38', btn: '#14040a' },
  plum:     { base: '#3a1a3a', hi: '#573057', dk: '#1e0c1e', glow: '#7e4a7e', btn: '#100610' },
  charcoal: { base: '#26262e', hi: '#3c3c48', dk: '#121218', glow: '#5a5a6a', btn: '#08080c' },
};
let CHAIR = CHAIRS[new URLSearchParams(location.search).get('chair')] || CHAIRS.green;

// filled polygon (scanline) — lets us draw curved silhouettes like the chair
function poly(pts, c) {
  const ys = pts.map(p => p[1]);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + .5 && by > y + .5) || (by <= y + .5 && ay > y + .5)) xs.push(ax + (y + .5 - ay) * (bx - ax) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) R(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, c);
  }
}

const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function light(cx, cy, rad, rgb, alpha) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.pow(Math.max(0, 1 - Math.hypot(x - cx, y - cy) / rad), 1.4);
    if (i * 16 > BAYER[y & 3][x & 3]) R(x, y, 1, 1, `rgba(${rgb},${alpha})`);
  }
}
function pine(x, base, h, c) {
  for (let r = 0; r < h; r++) { const w = 1 + 2 * Math.floor(r / 2); R(x - Math.floor(w / 2), base - h + r, w, 1, c); }
  R(x, base, 1, 1, c);
}

// rounded rectangle (r = corner radius in pixels)
function rr(x, y, w, h, r, c) {
  for (let j = 0; j < h; j++) {
    const d = j < r ? r - j : (j >= h - r ? j - (h - r - 1) : 0);
    const inset = d ? r - Math.round(Math.sqrt(Math.max(0, r * r - (d - .5) * (d - .5)))) : 0;
    R(x + inset, y + j, w - inset * 2, 1, c);
  }
}
// smooth curve (quadratic) and a little spiral: the wrought-iron vocabulary
function curve(x0, y0, cx, cy, x1, y1, c) {
  const n = Math.max(40, (Math.abs(x1 - x0) + Math.abs(y1 - y0)) * 2);   // enough samples that long cables have no gaps
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    P(Math.round(u * u * x0 + 2 * u * t * cx + t * t * x1), Math.round(u * u * y0 + 2 * u * t * cy + t * t * y1), c);
  }
}
function spiral(cx, cy, r, c) {
  for (let a = 0; a < 9.4; a += 0.3) {
    const rr_ = r * (1 - a / 10.5);
    P(Math.round(cx + rr_ * Math.cos(a)), Math.round(cy + rr_ * Math.sin(a)), c);
  }
}

// A full velvet drape. side = 0 (left) or 1 (right, mirrored)
function drape(side) {
  const X = x => (side ? W - 1 - x : x);
  for (let y = 0; y < FY - 1; y++) {
    // inner edge sways gently and flares out where the fabric pools on the floor
    const flare = y > FY - 40 ? Math.round(Math.pow((y - (FY - 40)) / 39, 2) * 6) : 0;
    const edge = 27 + Math.round(2 * Math.sin(y * 0.045)) + flare;
    for (let x = 0; x < edge; x++) {
      const phase = Math.sin(x * 0.55 + y * 0.012) + 0.5 * Math.sin(x * 0.21 + 1);   // folds, slightly slanted
      let v = (phase + 1.5) / 3;
      v *= 0.75 + 0.25 * (x / edge);                                // lighter toward the inside
      let idx = Math.round(v * 4 + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.7);
      if (y < 36 && (1 - y / 36) * 16 > BAYER[y & 3][x & 3]) idx -= 1;   // dark under the pelmet
      P(X(x), y, C.drape[Math.max(0, Math.min(4, idx))]);
    }
    P(X(edge), y, '#0a0204');                                       // soft edge shadow
  }
  for (let x = 0; x < 34; x++) { P(X(x), 0, '#10030a'); R(X(x), 0, 1, 5, '#10030a'); }   // pelmet
  for (let x = 0; x < 34; x++) P(X(x), 5, '#2e0a10');
}

function drawRoom() {
  R(0, 0, W, H, C.wall);
  drape(0); drape(1);

  // floor with a very faint digital grid
  R(0, FY - 1, W, 1, '#020203');
  R(0, FY, W, H - FY, C.floor);
  const g = 'rgba(109,255,176,.06)';
  for (let k = 1; k <= 9; k++) { const y = FY + 1 + Math.round(k * k * 0.8); if (y < H) R(0, y, W, 1, g); }
  for (let xb = -400; xb <= 800; xb += 44) {
    for (let y = FY + 1; y < H; y++) {
      const x = Math.round(W / 2 + (xb - W / 2) * (y - (FY - 40)) / 80);
      if (x >= 0 && x < W) P(x, y, g);
    }
  }

  // ---- the picture (opens "trails"): simple dark frame, dusk mountain ----
  rc.save(); rc.translate(OX + 66, OY - 14);  // high on the right wall, above the chair, clear of the computer
  line(176, 22, 190, 11, C.metal); line(204, 22, 190, 11, C.metal);   // hanging cord
  R(168, 22, 44, 40, C.wood); R(168, 22, 44, 1, C.woodHi);
  R(169, 23, 42, 38, '#2a2023');
  R(171, 25, 38, 34, '#0a0709');                                        // mat
  const PX = 173, PY = 27, PW = 34, PH = 30;
  for (let y = PY; y < PY + PH; y++) for (let x = PX; x < PX + PW; x++) {   // dusk sky (dithered)
    const t = (y - PY) / PH;
    P(x, y, t * 16 > BAYER[y & 3][x & 3] ? '#3a0c13' : '#07100e');
  }
  [[178, 32], [186, 30], [200, 33], [195, 36]].forEach(([x, y]) => P(x, y, '#6a7a74'));   // stars
  for (let y = 37; y < 46; y++) for (let x = 185; x < 196; x++)              // muted red moon
    if (Math.hypot(x - 190, y - 41) <= 3.6) P(x, y, '#a3262e');
  for (let i = 0; i < PW; i++) {
    const x = PX + i, base = PY + PH;
    const far = 9 + Math.round(5 * Math.sin(i * .22) + 3 * Math.sin(i * .6 + 1));
    R(x, base - far, 1, far, '#0f1a17');
    const near = 4 + Math.round(3 * Math.sin(i * .35 + 2) + 1.5 * Math.sin(i * .9));
    R(x, base - near, 1, near, '#050808');
  }
  pine(178, PY + PH, 9, '#030505'); pine(182, PY + PH, 6, '#030505'); pine(202, PY + PH, 10, '#030505');
  rc.restore();

  // ---- armchair: Victorian parlour chair, front view: carved wood frame, tufted back, cabriole legs ----
  rc.save(); rc.translate(OX + 143, OY);      // the chair sits to the right so the computer is the focus
  const K = CHAIR, WD = '#2a1a14', WDH = '#4a3028';
  const mir = pts => pts.map(([x, y]) => [250 - x, y]);              // mirror around the chair's centre (x=125)
  shadow(125, 157, 36, 3);
  const leg = [[100, 132], [107, 132], [106, 139], [103, 146], [106, 152], [109, 155], [97, 155], [99, 151], [101, 146], [99, 139]];
  poly(leg, WD); poly(mir(leg), WD);                                  // cabriole legs
  poly([[103, 120], [100, 92], [102, 74], [109, 63], [125, 58], [141, 63], [148, 74], [150, 92], [147, 120]], WD);          // carved frame
  poly([[106, 120], [104, 92], [106, 76], [112, 66], [125, 62], [138, 66], [144, 76], [146, 92], [144, 120]], K.base);      // upholstered back
  ellipse(125, 56, 4, 2, WD); P(125, 54, WDH);                        // carved crest
  line(125, 58, 141, 63, WDH); line(141, 63, 148, 74, WDH);          // light catching the frame
  line(138, 66, 144, 76, K.hi); line(144, 76, 146, 92, K.hi);
  const bt = [[125, 73], [117, 84], [133, 84], [125, 95], [117, 106], [133, 106]];                                           // tufting (restrained)
  [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]].forEach(([a, b]) => line(bt[a][0], bt[a][1], bt[b][0], bt[b][1], K.dk));
  bt.forEach(([x, y]) => { P(x, y, K.btn); P(x - 1, y - 1, K.glow); });
  R(97, 104, 4, 26, WD); R(149, 104, 4, 26, WD); R(100, 104, 1, 26, WDH);                                                    // arm posts
  poly([[103, 118], [147, 118], [152, 126], [98, 126]], K.hi); R(110, 119, 30, 1, K.glow);                                   // seat (top face)
  rr(98, 126, 54, 5, 2, K.base);                                      // seat front lip
  rr(92, 98, 14, 9, 4, K.hi); R(95, 99, 8, 1, K.glow);                // arm pads
  rr(144, 98, 14, 9, 4, K.hi); R(147, 99, 8, 1, K.glow);
  R(97, 131, 56, 5, WD); R(97, 131, 56, 1, WDH);                      // apron
  for (let x = 100; x <= 148; x += 6) ellipse(x + 2, 136, 3, 2, WD);
  rc.restore();  // scalloped edge

  // ---- larger side table with the computer ----
  rc.save(); rc.translate(OX - 40, OY);
  shadow(206, 157, 38, 2);
  R(166, 98, 80, 2, C.wood); R(166, 98, 80, 1, C.woodHi);               // top
  R(171, 100, 70, 3, '#150f11');                                         // apron
  R(204, 103, 4, 47, C.wood);                                            // pedestal
  R(190, 150, 32, 2, C.wood); R(188, 152, 10, 2, C.wood); R(214, 152, 10, 2, C.wood);
  R(167, 95, 6, 3, '#3b0b12'); R(168, 92, 5, 3, '#1c2a24');             // books
  R(173, 72, 34, 25, '#161214'); R(173, 72, 34, 1, '#2a2326');          // CRT body
  R(175, 74, 30, 21, '#07080a');
  R(180, 97, 20, 1, '#07080a');
  P(203, 95, '#a3262e');

  // ---- cables hanging off the computer: a quiet nod to Ghost in the Shell / Lain ----
  const CB = '#1f1b24', PLUG = '#363139';   // barely lighter than the room: you find them rather than see them
  const cable = segs => segs.forEach(([x0, y0, cx, cy, x1, y1]) => curve(x0, y0, cx, cy, x1, y1, CB));
  // 1) runs down the table edge and along the floor towards the record player, ending in a plug (with an LED, see render())
  cable([[176, 89, 170, 92, 166, 99], [166, 99, 163, 125, 158, 148], [158, 148, 156, 156, 146, 154], [146, 154, 140, 150, 135, 154]]);
  R(132, 153, 4, 3, PLUG);
  // 2) a loose one that trails off on the floor
  cable([[178, 95, 172, 98, 168, 101], [168, 101, 166, 128, 170, 150], [170, 150, 172, 157, 162, 156], [162, 156, 156, 158, 152, 156]]);
  R(150, 155, 2, 2, PLUG);
  // 3) one dangling in mid-air, plug swinging
  cable([[174, 84, 167, 88, 164, 97], [164, 97, 151, 114, 152, 139]]);
  R(150, 139, 3, 3, PLUG);
  rc.restore();                                                 // power LED

  // light passes
  // light passes: a dithered (stippled) pool of light, like the first version, plus the smooth CSS glow on top
  light(227, 86, 68, '255,200,90', 0.07);                                // lamp (yellow)
  light(190, 108, 34, '109,255,176', 0.06);                               // screen

  // ---- a corner for records and films: stack of sleeves, vintage radio, vinyl, film reel (opens "trails") ----
  rc.save(); rc.translate(OX + 24, OY);
  shadow(36, 155, 32, 3);
  // film reel, standing to the left
  ellipse(13, 146, 7, 7, '#3a3a44'); ellipse(13, 146, 6, 6, '#26262e');
  for (let k = 0; k < 5; k++) { const a = k * 1.2566; R(13 + Math.round(4.2 * Math.cos(a)) - 1, 146 + Math.round(4.2 * Math.sin(a)) - 1, 2, 2, '#0c0c10'); }
  ellipse(13, 146, 2, 2, '#4a4a56'); P(13, 146, '#0c0c10');
  // vinyl record leaning against the stack, on the right
  ellipse(58, 144, 9, 9, '#0b0b0f'); ellipse(58, 144, 6, 6, '#15151b'); ellipse(58, 144, 3, 3, '#a3262e'); P(58, 144, '#0b0b0f');
  line(51, 141, 54, 137, '#2a2a34');
  // the stack of record sleeves
  [['#3a1218', 0], ['#1d3d33', -2], ['#a89c86', 1], ['#26262e', -1], ['#4a2a3a', 2], ['#2e3a24', 0], ['#6a5a46', -1], ['#2a1a24', 1]].forEach(([c, dx], i) => {
    const y = 150 - i * 3;
    R(23 + dx, y, 26, 3, c);
    R(23 + dx, y, 26, 1, 'rgba(255,255,255,.14)');
    R(23 + dx, y + 2, 26, 1, 'rgba(0,0,0,.25)');
  });
  // record player (turntable) on top of the stack
  rr(19, 119, 34, 10, 2, '#3a2216'); R(19, 119, 34, 1, '#5a3a28');                    // walnut plinth
  R(22, 129, 4, 1, '#16100c'); R(46, 129, 4, 1, '#16100c');                           // feet
  poly([[21, 108], [51, 108], [54, 119], [18, 119]], '#5a3a28');                      // top surface, seen from above
  ellipse(33, 114, 13, 4, '#0b0b0f'); ellipse(33, 114, 10, 3, '#22222a');             // vinyl on the platter, with a groove ring
  ellipse(33, 114, 4, 2, '#a3262e'); P(33, 114, '#0b0b0f');                           // label + spindle
  R(48, 109, 4, 5, '#6a5e63');                                                         // tonearm pivot
  line(49, 111, 41, 115, '#c8bfc4'); line(49, 112, 41, 116, '#8a8086'); R(39, 115, 3, 2, '#d8c9a0');   // tonearm + cartridge
  P(25, 124, '#d8c9a0'); P(28, 124, '#d8c9a0');                                        // knobs on the front
  rc.restore();

  // ---- candelabra: slender wrought iron, three candles (the flames are animated in render()) ----
  rc.save(); rc.translate(OX - 40, OY);
  const LX = 227, IR = '#4d4448', IRH = '#80767c', WAX = '#e8dcc0', WAXD = '#b8a888';
  R(221, 96, 12, 2, IR); R(223, 95, 8, 1, IRH);                          // foot
  spiral(219, 95, 3, IR); spiral(235, 95, 3, IR);                        // curls at the foot
  for (let y = 70; y <= 95; y++) { const o = Math.round(1.1 * Math.sin(y * 0.8)); P(LX - o, y, IR); P(LX + o, y, IRH); }   // slender twisted stem
  ellipse(LX, 88, 2, 3, IR); P(LX - 1, 87, IRH);                         // knops
  ellipse(LX, 80, 2, 2, IR);
  curve(LX, 79, 217, 79, 214, 72, IR); curve(LX, 79, 237, 79, 240, 72, IR);     // graceful arms
  spiral(219, 83, 2, IR); spiral(235, 83, 2, IR); line(221, 83, 225, 83, IR); line(229, 83, 233, 83, IR);
  R(224, 69, 7, 1, IRH); R(212, 71, 5, 1, IRH); R(238, 71, 5, 1, IRH);   // candle cups
  R(226, 60, 3, 9, WAX); R(226, 60, 1, 9, WAXD); P(227, 59, '#2a1a14');  // candles + wicks
  R(213, 63, 3, 8, WAX); R(213, 63, 1, 8, WAXD); P(214, 62, '#2a1a14');
  R(239, 63, 3, 8, WAX); R(239, 63, 1, 8, WAXD); P(240, 62, '#2a1a14');
  P(228, 64, WAXD); P(215, 67, WAXD);                                    // a little wax
  rc.restore();
}

/* =========================================================
   2. THE SCREEN — the only moving pixels
   ========================================================= */
const SCR = { x: 177, y: 76 + OY, w: 26, h: 18 };   // the screen, in the same shifted space as the table
let screenHot = false;
const makeRow = () => {
  const words = []; let x = 2 + Math.floor(Math.random() * 3) * 2;
  while (x < SCR.w - 5) {
    const w = 2 + Math.floor(Math.random() * 7);
    words.push([x, Math.min(w, SCR.w - 3 - x)]); x += w + 2;
    if (Math.random() < .2) break;
  }
  return words;
};
const rows = Array.from({ length: 4 }, makeRow);
const glowScreen = document.getElementById('glowScreen');
const glowLamp = document.querySelector('.glow-lamp');
const WICKS = [[227, 81], [214, 84], [240, 84]];   // where the three candle flames sit (x, wick y)
let frame = 0;

// dust motes drifting in the candlelight (the speckles from the first version)
const dust = Array.from({ length: 22 }, () => ({
  x: 190 + Math.random() * 90, y: 40 + Math.random() * 110,
  vx: (Math.random() - .5) * .05, vy: -0.015 - Math.random() * .04, t: Math.random() * 6,
}));

// a tiny pixel flame that wavers a little each frame
function flame(x, y) {
  const tall = !reduceMotion && Math.random() < .5, sway = reduceMotion ? 0 : (Math.random() < .25 ? (Math.random() < .5 ? -1 : 1) : 0);
  ctx.fillStyle = '#ff9f1c'; ctx.fillRect(x - 1, y - 1, 3, 1);
  ctx.fillStyle = '#ffd36b'; ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1 + sway, y - 2, 3, 1);
  ctx.fillStyle = '#fff3c4'; ctx.fillRect(x + sway, y - 3, 1, 1);
  if (tall) { ctx.fillStyle = '#ffd36b'; ctx.fillRect(x + sway, y - 4, 1, 1); }
}

function render() {
  frame++;
  ctx.drawImage(room, 0, 0);
  ctx.fillStyle = C.screenBg;
  ctx.fillRect(SCR.x, SCR.y, SCR.w, SCR.h);
  const a = screenHot ? .95 : .7;
  ctx.fillStyle = `rgba(${C.green},${a})`;
  ctx.fillRect(SCR.x + 2, SCR.y + 2, 10, 1);                                  // header
  rows.forEach((words, i) => {
    if (!reduceMotion && frame % 30 === i * 7) rows[i] = makeRow();
    ctx.fillStyle = `rgba(${C.green},${a * .8})`;
    words.forEach(([x, w]) => ctx.fillRect(SCR.x + x, SCR.y + 5 + i * 3, w, 1));
  });
  ctx.fillStyle = `rgba(${C.green},.25)`;
  ctx.fillRect(SCR.x + 2, SCR.y + 16, SCR.w - 4, 1);                          // progress track
  ctx.fillStyle = `rgba(${C.green},${a})`;
  ctx.fillRect(SCR.x + 2, SCR.y + 16, Math.floor(((frame * 0.5) % 100) / 100 * (SCR.w - 4)), 1);
  if (Math.floor(frame / 5) % 2) ctx.fillRect(SCR.x + 2, SCR.y + 5 + 4 * 3, 2, 1);   // cursor
  dust.forEach(p => {
    if (!reduceMotion) {
      p.x += p.vx; p.y += p.vy; p.t += .05;
      if (p.y < 36) { p.y = 150; p.x = 190 + Math.random() * 90; }
    }
    ctx.fillStyle = `rgba(255,205,150,${0.25 + 0.4 * Math.abs(Math.sin(p.t))})`;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  });
  if (reduceMotion || Math.floor(frame / 8) % 3 !== 0) { ctx.fillStyle = `rgba(${C.green},.7)`; ctx.fillRect(134, 174, 1, 1); }   // the cable's LED, blinking
  WICKS.forEach(([x, y]) => flame(x, y));
  glowScreen.style.opacity = screenHot ? 1.6 : 1;
  if (!reduceMotion) glowLamp.style.opacity = (0.8 + Math.random() * 0.2).toFixed(2);   // candlelight breathes unevenly
}

drawRoom();
render();
if (!reduceMotion) setInterval(render, 120);


/* =========================================================
   3. THE CONTENT — edit the text below with your real info!
   Same panel whether you click the screen or just scroll down.
   (each array item is one block; keep a whole <ul> in ONE item)
   ========================================================= */
const SECTIONS = {
  about: {
    title: 'about',
    lines: [
      '<span class="eyebrow">01 — about</span>',
      '<h2>Frontend engineer with a designer’s eye.</h2>',
      "<p>Hi, I'm Beatriz. I build interfaces that feel considered: clear structure, calm motion, and a lot of care about the details people only notice when they're missing.</p>",
      '<p class="note">// TODO: replace with your own story</p>',
    ],
  },
  work: {
    title: 'work',
    lines: [
      '<span class="eyebrow">02 — selected work</span>',
      '<h2>Things I’ve built.</h2>',
      '<ul><li><b>Project One</b>Short description, stack, your role.</li>' +
      '<li><b>Project Two</b>Short description, stack, your role.</li>' +
      '<li><b>Project Three</b>Short description, stack, your role.</li></ul>',
    ],
  },
  design: {
    title: 'design',
    lines: [
      '<span class="eyebrow">03 — design</span>',
      '<h2>UX/UI, from research to polish.</h2>',
      '<p>Research, wireframes, interface design, prototyping and design systems, with accessibility built in from the start.</p>',
      '<ul><li><b>Process</b>Discovery, flows, prototypes, testing.</li><li><b>Tools</b>Figma, design tokens, handoff in both directions.</li></ul>',
    ],
  },
  trails: {
    title: 'trails',
    lines: [
      '<span class="eyebrow">04 — trails, records &amp; films</span>',
      '<h2>Away from the screen.</h2>',
      "<p>I'm usually somewhere quiet and far from a desk. It's where most of my good ideas show up.</p>",
      '<ul><li><b>Trails</b>Mountains, silence, long climbs. A favourite hike goes here.</li>' +
      '<li><b>Records</b>The albums on repeat while I work. A playlist or a favourite record goes here.</li>' +
      '<li><b>Films</b>Slow, strange, atmospheric cinema. A few favourites go here.</li></ul>',
      '<p class="note">// TODO: add your own picks, photos or links</p>',
    ],
  },
  contact: {
    title: 'contact',
    lines: [
      '<span class="eyebrow">05 — contact</span>',
      '<h2>Let’s talk.</h2>',
      '<p>Want to work together, or just say hi?</p>',
      '<ul><li><b>Email</b><a href="mailto:hello@example.com">hello@example.com</a></li>' +
      '<li><b>GitHub</b><a href="#">github.com/your-handle</a></li>' +
      '<li><b>LinkedIn</b><a href="#">linkedin.com/in/your-handle</a></li></ul>',
    ],
  },
};

const page = document.getElementById('content');
const nav = document.getElementById('termNav');
const panel = document.getElementById('termPanel');
const keys = Object.keys(SECTIONS);
const behavior = reduceMotion ? 'auto' : 'smooth';
let current = 'about';

keys.forEach((k, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<span>0${i + 1}</span>${SECTIONS[k].title}`;
  b.dataset.key = k;
  b.addEventListener('click', () => show(k));
  nav.appendChild(b);
});

function show(key) {
  current = key;
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.key === key));
  panel.innerHTML = '';
  panel.scrollTop = 0;
  SECTIONS[key].lines.forEach((html, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'line';
    wrap.style.animationDelay = `${i * 90}ms`;
    wrap.innerHTML = html;
    panel.appendChild(wrap);
  });
}

// Clicking the screen / picture (or the scroll cue) glides down to the panel
function goTo(key) { show(key); page.scrollIntoView({ behavior }); }
document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => goTo(el.dataset.open)));
document.getElementById('scrollCue').addEventListener('click', () => goTo(current));
document.getElementById('toRoom').addEventListener('click', () => window.scrollTo({ top: 0, behavior }));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.scrollTo({ top: 0, behavior });
  // press C to try the armchair in each colour (a design tool; delete this block once you've chosen)
  if (e.key === 'c' || e.key === 'C') {
    const names = Object.keys(CHAIRS), next = names[(names.findIndex(n => CHAIRS[n] === CHAIR) + 1) % names.length];
    CHAIR = CHAIRS[next]; drawRoom(); render();
  }
});

// Replay the little reveal each time the panel scrolls into view
new IntersectionObserver(([e]) => { if (e.isIntersecting) show(current); }, { threshold: 0.6 }).observe(page);

const mon = document.querySelector('.hs-monitor');
mon.addEventListener('mouseenter', () => screenHot = true);
mon.addEventListener('mouseleave', () => screenHot = false);

show('about');
// Deep link: index.html#work opens that section directly
if (SECTIONS[location.hash.slice(1)]) { show(location.hash.slice(1)); page.scrollIntoView(); }
