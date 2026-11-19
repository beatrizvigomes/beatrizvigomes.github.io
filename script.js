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

// Armchair upholstery: charcoal is the one in use. To preview another, open index.html?chair=plum (or green, burgundy)
const CHAIRS = {
  green:    { base: '#12251e', hi: '#1a352b', dk: '#08130f', glow: '#2a5242', btn: '#040b08' },   // deep and muted: it sits in the shadows
  burgundy: { base: '#4a0f18', hi: '#6c1a26', dk: '#26070c', glow: '#9a2a38', btn: '#14040a' },
  plum:     { base: '#3a1a3a', hi: '#573057', dk: '#1e0c1e', glow: '#7e4a7e', btn: '#100610' },
  charcoal: { base: '#292530', hi: '#3c3745', dk: '#131018', glow: '#5a5266', btn: '#08060b' },   // grey with a touch of purple, like the cables
};
const CHAIR = CHAIRS[new URLSearchParams(location.search).get('chair')] || CHAIRS.charcoal;

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

  // ---- the picture (opens "off-screen"): simple dark frame, dusk mountain ----
  rc.save(); rc.translate(OX + 66, OY + 24);  // on the right wall, above the cat bed, clear of the computer
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

  // Victorian touches, kept quiet: same wood tones as the frame (no gold). Beaded moulding, corner rosettes, a small crest and a title plate.
  const FB = '#3d3033', FD = '#2c2124';
  for (let x = 171; x <= 208; x += 2) { P(x, 23, FB); P(x, 60, FB); }          // beads along the top and bottom of the frame
  for (let y = 25; y <= 58; y += 2) { P(169, y, FB); P(210, y, FB); }          // beads down the sides
  [[168, 22], [209, 22], [168, 59], [209, 59]].forEach(([x, y]) => { R(x, y, 3, 3, FD); P(x + 1, y + 1, FB); });   // corner rosettes
  R(188, 20, 4, 2, FD); P(189, 19, FD); P(190, 19, FD); P(186, 21, FD); P(193, 21, FD); P(189, 20, FB);          // a little crest on top
  R(184, 62, 12, 3, FD); R(184, 62, 12, 1, FB);                                // title plate under the frame
  R(172, 26, 36, 1, '#241b1e'); R(172, 57, 36, 1, '#241b1e'); R(172, 26, 1, 32, '#241b1e'); R(207, 26, 1, 32, '#241b1e');   // a fine inner line around the painting
  rc.restore();

  // ---- a small Victorian cat bed, with the cat in it (replaces the armchair) ----
  const K = CHAIR, WD = '#2a1a14', WDH = '#4a3028';
  const CX = 308;                                            // centre of the bed, on the right-hand side of the room
  const CK = '#100e13', CW = '#cfcac2', CWS = '#a39e98', CG = '#82d9a4', CP = '#d98c98', CPI = '#6a3d49';   // cat: black, white, shade, green eyes, pink nose, ear
  shadow(CX, 178, 31, 3);
  // carved wooden base with a scalloped edge and four stubby legs
  R(CX - 26, 171, 52, 3, WD); R(CX - 26, 171, 52, 1, WDH);
  for (let x = CX - 24; x <= CX + 22; x += 6) ellipse(x + 2, 174, 3, 2, WD);
  R(CX - 25, 175, 4, 3, WD); R(CX + 21, 175, 4, 3, WD);
  // the cushion: a lit back rim, and a dark hollow where she lies
  ellipse(CX, 157, 27, 10, K.hi);
  ellipse(CX, 158, 23, 7, '#232029');                       // the hollow of the cushion: a shade darker than the fabric, not black
  // the front rim of the cushion, with two buttons
  rr(CX - 27, 161, 54, 11, 5, K.base);
  R(CX - 22, 162, 44, 1, K.glow);
  [CX - 19, CX + 19].forEach(x => { P(x, 167, K.btn); P(x - 1, 166, K.glow); });

  // ---- the cat, drawn as ONE pixel sprite (46 x 22): a long low loaf, head resting on the right, tail wrapped round behind ----
  // Each part is described by columns, so it is easy to tweak: the body is a list of [first column, last column] per row.
  const SX = CX - 23, SY = 144;                              // top-left corner of the sprite in the room
  const cell = (x, y, c) => P(SX + x, SY + y, c);
  const BODY = {                                              // white body, row -> [from, to]
    8: [12, 24], 9: [8, 27], 10: [6, 29], 11: [5, 30], 12: [4, 31], 13: [3, 32], 14: [3, 33], 15: [3, 34],
    16: [3, 37], 17: [3, 40], 18: [4, 41], 19: [5, 41], 20: [7, 40],
  };
  const TAIL = [                                              // black tail: starts behind the body, wraps round the left, curls under
    [4, 9], [3, 10], [2, 11], [1, 12], [1, 13], [1, 14], [1, 15], [1, 16], [1, 17], [2, 18], [2, 19], [3, 20],
    [4, 21], [5, 21], [6, 21], [7, 21], [8, 21], [9, 21],
  ];
  const HEAD = [                                              // 16 x 13: K black, W white, G green eye, S pupil, P pink nose, I inner ear
    '.KK..........KK.',
    '.KKK........KKK.',
    '.KIKK......KKIK.',
    '.KKKKKKKKKKKKKK.',
    '.KKKKKKWWKKKKKK.',
    'KKKKKKKWWKKKKKKK',
    'KKKGGGKWWKGGGKKK',
    'KKKGSGKWWKGSGKKK',
    '.KKKKKWWWWKKKKK.',
    '..KWWWWWWWWWWK..',
    '...WWWWPPWWWW...',
    '....WWWWWWWW....',
    '.....WWWWWW.....',
  ];
  const HX = 30, HY = 3;                                      // where the head sits inside the sprite
  const HC = { K: CK, I: CPI, G: CG, S: CK, W: CW, P: CP };

  // 1) tail first (it is behind the body), with a faint outline so the black does not vanish into the dark room
  const tailAt = new Set(TAIL.flatMap(([x, y]) => [`${x},${y}`, `${x + 1},${y}`]));
  tailAt.forEach(k => { const [x, y] = k.split(',').map(Number); [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx, dy]) => { if (!tailAt.has(`${x+dx},${y+dy}`)) cell(x + dx, y + dy, '#2e2a37'); }); });
  tailAt.forEach(k => { const [x, y] = k.split(',').map(Number); cell(x, y, CK); });
  // 2) the white body, with a soft shade along the bottom and the left edge
  Object.entries(BODY).forEach(([y, [a, b]]) => { y = +y; for (let x = a; x <= b; x++) cell(x, y, (y === 20 || (x === a && y > 14)) ? CWS : CW); });
  // 3) the small black patch on the top of her back
  [[12, 8], [13, 8], [11, 9], [12, 9], [13, 9], [14, 9]].forEach(([x, y]) => cell(x, y, CK));
  // 4) the head, with a faint outline on its black parts
  const solid = (i, j) => !!(HEAD[j] && HEAD[j][i] && HEAD[j][i] !== '.');
  HEAD.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.' && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) cell(HX + i, HY + j, '#2e2a37');
  }));
  HEAD.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') cell(HX + i, HY + j, HC[ch]); }));
  [[-1, 11], [-2, 12], [-1, 13], [16, 11], [17, 12], [16, 13]].forEach(([dx, dy]) => cell(HX + dx, HY + dy, CWS));   // whiskers
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
  light(227, 97, 68, '255,200,90', 0.07);                                // lamp (yellow)
  light(190, 108, 34, '109,255,176', 0.06);                               // screen

  // ---- a corner for music and films: stack of sleeves, vintage radio, vinyl, film reel (opens "off-screen") ----
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
  rr(19, 119, 34, 10, 2, '#2a1810'); R(19, 119, 34, 1, '#3a2417');                    // walnut plinth
  R(22, 129, 4, 1, '#16100c'); R(46, 129, 4, 1, '#16100c');                           // feet
  poly([[21, 108], [51, 108], [54, 119], [18, 119]], '#3a2417');                      // top surface, seen from above
  ellipse(33, 114, 13, 4, '#0b0b0f'); ellipse(33, 114, 10, 3, '#17171d');             // vinyl on the platter, with a groove ring
  ellipse(33, 114, 4, 2, '#6a1a20'); P(33, 114, '#0b0b0f');                           // label + spindle
  R(48, 109, 4, 5, '#3e383c');                                                         // tonearm pivot
  line(49, 111, 41, 115, '#756c72'); line(49, 112, 41, 116, '#4e484d'); R(39, 115, 3, 2, '#85795f');   // tonearm + cartridge
  P(25, 124, '#85795f'); P(28, 124, '#85795f');                                        // knobs on the front
  rc.restore();

  // ---- candelabra: slender wrought iron, one candle (the flame is animated in render()) ----
  rc.save(); rc.translate(OX - 40, OY);
  const LX = 227, IR = '#4d4448', IRH = '#80767c', WAX = '#e8dcc0', WAXD = '#b8a888';
  R(221, 96, 12, 2, IR); R(223, 95, 8, 1, IRH);                          // foot
  spiral(219, 95, 3, IR); spiral(235, 95, 3, IR);                        // curls at the foot
  for (let y = 78; y <= 95; y++) { const o = Math.round(1.1 * Math.sin(y * 0.8)); P(LX - o, y, IR); P(LX + o, y, IRH); }   // slender twisted stem (shorter now)
  ellipse(LX, 80, 2, 2, IR); P(LX - 1, 79, IRH);                         // knop under the cup
  ellipse(LX, 91, 2, 3, IR); P(LX - 1, 90, IRH);                         // lower knop
  // two arms that sweep out from the stem and curl inward into a spiral, like a pair of scrolls
  [-1, 1].forEach(side => {
    curve(LX + side, 87, LX + side * 5, 89, LX + side * 9, 86, IR);      // leaves the stem and dips outwards
    const cx = LX + side * 9, cy = 79, R0 = 7;                           // the circle the scroll winds round
    for (let a = 0; a <= 1; a += 0.004) {
      const ang = Math.PI / 2 - side * a * Math.PI * 2.5, r = R0 * (1 - 0.75 * a);   // out, up, over and back in
      P(Math.round(cx + r * Math.cos(ang)), Math.round(cy + r * Math.sin(ang)), IR);
    }
  });
  R(224, 77, 7, 1, IRH);                                                 // the one candle cup
  R(226, 69, 3, 8, WAX); R(226, 69, 1, 8, WAXD); P(227, 68, '#2a1a14');  // the candle + its wick
  P(228, 72, WAXD); P(228, 73, WAXD);                                    // a little wax
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
const WICKS = [[227, 90]];   // where the candle flame sits (x, wick y)
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
  if (!reduceMotion && frame % 48 < 2) { ctx.fillStyle = '#100e13'; ctx.fillRect(318, 153, 3, 2); ctx.fillRect(325, 153, 3, 2); ctx.fillStyle = '#4f9a73'; ctx.fillRect(318, 154, 3, 1); ctx.fillRect(325, 154, 3, 1); }   // she blinks: happy closed eyes now and then
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
// The photographs in "off-screen". To add one: put the file in the images/ folder and add a line here.
// (Keep them around 1100px on the long side and under ~300 KB so the site stays fast.)
// place = the caption shown under the photo; alt = a description for screen readers (not shown).
const PHOTOS = [
  { src: 'images/offscreen-01.jpg', place: 'Pyrenees',    alt: 'a mountain river running between forested slopes' },
  { src: 'images/offscreen-02.jpg', place: 'Switzerland', alt: 'wooden farmhouses in a green valley below a waterfall' },
  { src: 'images/offscreen-03.jpg', place: 'Menorca',     alt: 'sunset over the sea, seen through a rock arch' },
  { src: 'images/offscreen-04.jpg', place: 'Tanzania',    alt: 'zebras walking across a plain below distant hills' },
  { src: 'images/offscreen-05.jpg', place: 'Pyrenees',    alt: 'a turquoise river below rocky mountains' },
  { src: 'images/offscreen-06.jpg', place: 'Croatia',     alt: 'waterfalls in a snowy gorge above turquoise pools' },
];

const SECTIONS = {
  about: {
    title: 'about',
    lines: [
      '<span class="eyebrow">01 — about</span>',
      '<h2>Frontend developer driven by human-centred design.</h2>',
      "<p>I'm Beatriz, a frontend developer and UX/UI designer. I'm interested in the intersection of technology, UX and design, and in creating digital experiences that are both <span class=hl>functional and human</span>.</p>",
      "<p>My master's thesis focused on designing and studying an <span class=hl>explainable, AI-assisted</span> application for breast cancer diagnosis. I also have a weakness for immersive, creative web experiences, and I'm comfortable working with AI-powered engineering tools.</p>",
      "<p>I'm a <span class=hl>creative who loves to paint</span>, and that side of art and creation is present in everything I do.</p>",
      '<ul><li><b>MSc, Computer Science and Engineering</b>Instituto Superior Técnico · 2023–2025</li>' +
      '<li><b>BSc, Informatics Engineering</b>Faculdade de Ciências de Lisboa · 2019–2023</li>' +
      '<li><b>Minor, Entrepreneurship and Innovation</b>Instituto Superior Técnico · 2023–2024</li>' +
      '<li><b>Languages</b>Portuguese, English</li>' +
      '<li><b>Volunteering</b>Casa de Saúde do Telhal, Serve The City, Refood</li></ul>',
    ],
  },
  work: {
    title: 'work',
    lines: [
      '<span class="eyebrow">02 — selected work</span>',
      '<h2>Where I’ve worked and what I’ve built.</h2>',
      '<ul><li><b>Frontend Developer &amp; UX/UI Designer</b><span class=hl>Accenture</span> · Oct 2025 – present. I designed an energy data management application from scratch, from UX/UI in Figma to the frontend implementation, including unit tests, working in a cross-functional team that brings business and data processes into the interface. Client work is confidential, so there are no screenshots or links. Stack: Angular, TypeScript, D3.js, REST APIs, AWS.</li>' +
      '<li><b>Website for a local guesthouse</b>In progress; the link is coming soon.</li>' +
      '<li><b>Master’s thesis</b><a href="https://www.researchgate.net/publication/397756928_Towards_Ambiguity-aware_AI_Assistants_for_Breast_Cancer_Diagnosis" target="_blank" rel="noopener">“Towards Ambiguity-aware AI Assistants for Breast Cancer Diagnosis”</a>, Instituto Superior Técnico. Final grade 18/20.</li>' +
      '<li><b>Cultural Manager &amp; Marketing Collaborator</b><span class=hl>Diferencial</span> · Jan 2024 – Jun 2025. Led a team of 25 members running cultural events and initiatives across Lisbon, and managed social media and branding for the Instituto Superior Técnico newspaper.</li>' +
      '<li><b>Teacher</b><span class=hl>Happy Code</span> · Nov 2022 – Jul 2023. Taught programming and robotics to children.</li></ul>',
    ],
  },
  skills: {
    title: 'skills',
    lines: [
      '<span class="eyebrow">03 — skills</span>',
      '<h2>How I work, and what I work with.</h2>',
      "<p>I'm <span class=hl>curious</span>, <span class=hl>attentive to my colleagues' feedback</span> and <span class=hl>communicative</span>. I value <span class=hl>open and honest communication</span>, and I adapt easily to new teams and contexts.</p>",
      "<p>I studied UX and interface design throughout my bachelor's and master's degrees, and I use those best practices to deliver end-to-end visual solutions independently, and then build them. My work experience and my minor taught me the steps to create a product adapted to the client's needs, through <span class=hl>refined iterations</span>.</p>",
      '<ul><li><b>Design</b>Figma, UX best practices, interface design</li>' +
      '<li><b>Frontend</b>JavaScript, TypeScript, React, Angular, D3.js</li>' +
      '<li><b>Also</b>Java, Python, MySQL, REST APIs, AWS</li>' +
      '<li><b>Workflow</b>Git / GitHub, Confluence, Jira, and GenAI as a tool for code generation, refactoring, debugging and documentation</li></ul>',
    ],
  },
  offscreen: {
    title: 'off-screen',
    lines: [
      '<span class="eyebrow">04 — off-screen</span>',
      '<h2>Off-screen.</h2>',
      '<p>Outside of technology, I’m drawn to cinema, music and the outdoors, particularly to the ways they shape how we see and experience our surroundings.</p>',
      // The wall is built from the PHOTOS list above. Click one and the lightbox opens.
      '<div class="photos">' +
        PHOTOS.map((p, i) =>
          `<button class="photo" type="button" data-i="${i}" aria-label="Look closer: ${p.place}. ${p.alt}"><img src="${p.src}" alt="${p.alt}" loading="lazy"></button>`
        ).join('') +
      '</div>',
      '<p class="photos-hint">click a photo to look closer</p>',
    ],
  },
  contact: {
    title: 'contact',
    lines: [
      '<span class="eyebrow">05 — contact</span>',
      '<h2>Get in touch.</h2>',
      '<ul><li><b>Email</b><a href="mailto:beatrizvigomes@gmail.com">beatrizvigomes@gmail.com</a></li>' +
      '<li><b>GitHub</b><a href="https://github.com/beatrizvigomes" target="_blank" rel="noopener">github.com/beatrizvigomes</a></li>' +
      '<li><b>LinkedIn</b><a href="https://www.linkedin.com/in/beatriz-gomes-03163620b" target="_blank" rel="noopener">linkedin.com/in/beatriz-gomes-03163620b</a></li></ul>',
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
  b.innerHTML = `<span>${i + 1}.</span>${SECTIONS[k].title}`;
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
function goTo(key) { if (key !== current) show(key); page.scrollIntoView({ behavior }); }   // only re-render if the section really changes
document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => goTo(el.dataset.open)));
document.getElementById('scrollCue').addEventListener('click', () => goTo(current));
/* ---------- Lightbox: click a photo to look at it properly ---------- */
const lbEl = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCap = document.getElementById('lbCap');
let lbIndex = 0, lbReturnFocus = null;
const lbOpen = () => lbEl.classList.contains('open');

function lbShow(i) {
  lbIndex = (i + PHOTOS.length) % PHOTOS.length;
  const p = PHOTOS[lbIndex];
  lbImg.src = p.src; lbImg.alt = p.alt;
  lbCap.innerHTML = `<span class="lb-count">${String(lbIndex + 1).padStart(2, '0')} / ${String(PHOTOS.length).padStart(2, '0')}</span> ${p.place}`;
}
function lbOpenAt(i) {
  lbReturnFocus = document.activeElement;
  lbShow(i);
  lbEl.classList.add('open'); lbEl.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden';          // no page scroll behind it
  lbEl.querySelector('.lb-close').focus();
}
function lbClose() {
  lbEl.classList.remove('open'); lbEl.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  if (lbReturnFocus) lbReturnFocus.focus();
}
panel.addEventListener('click', e => { const b = e.target.closest('.photo'); if (b) lbOpenAt(+b.dataset.i); });
lbEl.addEventListener('click', e => {
  if (e.target.closest('.lb-prev')) lbShow(lbIndex - 1);
  else if (e.target.closest('.lb-next') || e.target === lbImg) lbShow(lbIndex + 1);
  else if (!e.target.closest('figcaption')) lbClose();            // click on the dark backdrop or the close button
});
document.addEventListener('keydown', e => {
  if (!lbOpen()) return;
  if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
  if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
  if (e.key === 'Escape') lbClose();
});
let touchX = null;                                                // swipe on a phone
lbEl.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
lbEl.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) > 40) lbShow(lbIndex + (dx < 0 ? 1 : -1));
}, { passive: true });

document.getElementById('toRoom').addEventListener('click', () => window.scrollTo({ top: 0, behavior }));
document.getElementById('termExit').addEventListener('click', () => window.scrollTo({ top: 0, behavior }));   // "[esc] exit" in the terminal bar
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !lbOpen()) window.scrollTo({ top: 0, behavior });
});


const mon = document.querySelector('.hs-monitor');
mon.addEventListener('mouseenter', () => screenHot = true);
mon.addEventListener('mouseleave', () => screenHot = false);

show('about');
// Deep link: index.html#work opens that section directly
if (SECTIONS[location.hash.slice(1)]) { show(location.hash.slice(1)); page.scrollIntoView(); }
