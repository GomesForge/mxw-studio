/* Character guides: where the drawing has to sit inside the sheet.

   A character sheet is not a picture of a character. It is a stamp the
   game presses at a fixed place against the board tile, and it has no
   skeleton, no origin and no idea where the head is. The only thing
   that decides where the character appears in play is where the pixels
   sit inside the 256 x 256. Two lines carry most of it -- the body on
   x = 128 and the sole of the foot on y = 195 -- and the rest of what
   is here is the furniture the game draws around that: the board tile,
   the 40 x 40 box the portrait is cut from, the name band, and the
   boxes the effects occupy. None of that furniture adapts to your
   drawing; the drawing has to meet it.

   Every number below comes from the community guide v3, which measured
   3995 official sheets and read them against the client's own
   renderer. Nothing here is this project's invention. Where a number
   is a measured median rather than a rule the game enforces, it is
   marked, because the two carry very different weight: miss the rule
   and the character is broken in play, miss the median and it is
   merely unusual.

   Guides draw over the artwork and never into it. The one thing in
   this file that does touch pixels is charAlign, and it moves the
   whole sheet by one offset so an animation keeps its own motion. */

const CHAR_SIDE = 256;        /* every sheet but the portrait */
const CHAR_FACE = 40;         /* face.gra, and the head box */
const CHAR_AXIS = 128;        /* the body's centre line, in every frame */
const CHAR_SOLE = 195;        /* the last row of the foot, standing */
const CHAR_SOLE_WALK = 193;   /* median while walking: the body rises */

/* The 37 sheets in the game's own order: index = group + facing, with
   the facings always s, w, n, e. The names are what the loader asks
   for, lowercase, and the server runs on a filesystem that cares. */
const CHAR_GROUPS = [
  { anim: 'mo',     slot: 0,  dirs: true,  need: 8,  label: 'Walk',
    when: 'the player moves' },
  { anim: 'st',     slot: 4,  dirs: true,  need: 3,  label: 'Stand',
    when: 'the player is still' },
  { anim: 'th',     slot: 8,  dirs: true,  want: 7,  max: 9, label: 'Throw',
    when: 'throwing a bomb with the glove' },
  { anim: 'pa',     slot: 12, dirs: true,  want: 8,  label: 'Stunned',
    when: 'a flying bomb landed on this square' },
  { anim: 'pu',     slot: 16, dirs: true,  want: 5,  max: 7, label: 'Punch',
    when: 'punching the bomb in front' },
  { anim: 'dd',     slot: 20, dirs: false, want: 21, min: 7, max: 30,
    label: 'Death', when: 'the player died' },
  { anim: 'wi',     slot: 21, dirs: false, want: 11, min: 8, max: 37,
    label: 'Victory', when: 'the player won the round' },
  { anim: 'wa',     slot: 22, dirs: false, want: 18, min: 13, max: 23,
    label: 'Teleport', when: 'entering the round, and teleporting' },
  { anim: 'msb_ch', slot: 23, dirs: true,  need: 1,  label: 'Revenge cart',
    when: 'dead, riding the cart around the edge' },
  { anim: 'rui_mo', slot: 27, dirs: true,  need: 8,  label: 'Louie walk',
    when: 'walking while mounted' },
  { anim: 'rui_st', slot: 31, dirs: true,  need: 3,  label: 'Louie stand',
    when: 'standing while mounted' },
  { anim: 'preview', slot: 35, dirs: false, need: 3, label: 'Room preview',
    when: 'the room card, the profile and the shop' },
  { anim: 'face',   slot: 36, dirs: false, need: 1, label: 'Portrait',
    when: 'the bar at the top of a match', side: CHAR_FACE }
];

const CHAR_DIRS = [
  ['s', 'front',  'facing the player; walks down the screen'],
  ['w', 'left',   'profile, looking left'],
  ['n', 'back',   'back turned; walks up the screen'],
  ['e', 'right',  'profile, looking right']
];

/* Why some counts are not negotiable: mounted, the game draws the
   Louie and the rider on the same frame number, and the clock that
   advances it counts by your own mo and st. A mo of ten freezes the
   Louie on frames 8 and 9; a rui_mo of six freezes the rider. The cart
   draws frame 0 and nothing else. */
const CHAR_WHY_FIXED = {
  mo: 'the Louie walks on your frame number',
  st: 'the hold on frame 0 counts by your own frame list',
  rui_mo: 'the rider has to keep up with the Louie\u2019s 8',
  rui_st: 'the rider has to keep up with the Louie\u2019s 3',
  msb_ch: 'the cart draws frame 0 and never any other',
  face: 'the portrait is pasted as it is into a 40 x 40 slot',
  preview: 'it is a copy of st_s, which has 3'
};

/* ---------------------------- the sheet list --------------------- */

/* The 37, built once, so the panel and the checks share one vocabulary
   rather than each parsing file names their own way. */
const CHAR_SHEETS = (() => {
  const out = [];
  for (const g of CHAR_GROUPS) {
    if (g.dirs) {
      CHAR_DIRS.forEach(([d, name, how], i) => {
        out.push(Object.assign({}, g, {
          file: g.anim + '_' + d, dir: d, dirName: name, dirHow: how,
          slot: g.slot + i
        }));
      });
    } else {
      out.push(Object.assign({}, g, { file: g.anim, dir: null }));
    }
  }
  return out;
})();

const CHAR_BY_FILE = (() => {
  const m = {};
  for (const s of CHAR_SHEETS) m[s.file] = s;
  return m;
})();

/* A name is one of the 37 or it is not. Case and extension are
   forgiven here because the originals are inconsistent about both --
   MO_S.GRA in one folder, MO_S.gra in another -- but the checklist
   still says to write them lowercase, because the web client asks for
   them that way and Linux agrees with the web client. */
function charSheetOf(name) {
  const base = String(name || '').replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '').toLowerCase();
  return CHAR_BY_FILE[base] || null;
}

/* --------------------------- the guides -------------------------- */

/* Boxes are written the way the guide writes them: inclusive pixel
   columns and rows, so 108..147 is the 40 wide tile. */
const B = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

const CHAR_GUIDES = {
  anchor: {
    label: 'Axis and sole', on: true,
    draw: [
      { kind: 'vline', x: CHAR_AXIS, colour: '#4aa8ff', text: 'x 128' },
      { kind: 'hline', y: CHAR_SOLE, colour: '#49d17a', text: 'y 195' }
    ]
  },
  tile: {
    label: 'The board tile', on: true,
    draw: [
      { kind: 'box', box: B(108, 162, 147, 199), colour: '#e8b43c',
        text: 'this square' },
      { kind: 'box', box: B(68, 162, 107, 199), colour: '#5b6b88', faint: 1 },
      { kind: 'box', box: B(148, 162, 187, 199), colour: '#5b6b88', faint: 1 },
      { kind: 'box', box: B(108, 124, 147, 161), colour: '#5b6b88', faint: 1 },
      { kind: 'box', box: B(108, 200, 147, 237), colour: '#5b6b88', faint: 1 }
    ]
  },
  head: {
    label: 'Head box and name band', on: true,
    draw: [
      { kind: 'box', box: B(108, 108, 147, 147), colour: '#c08cf0',
        text: 'head 40 x 40' },
      { kind: 'band', box: B(96, 123, 161, 135), colour: '#c08cf0',
        text: 'the name goes here' }
    ]
  },
  safe: {
    label: 'Safe area for ground actions', on: true,
    draw: [
      { kind: 'box', box: B(80, 88, 176, 216), colour: '#3ad4ec', dash: 1,
        text: 'safe area' }
    ]
  },
  furniture: {
    label: 'What the game draws around you', on: false,
    draw: [
      { kind: 'box', box: B(113, 180, 143, 195), colour: '#8aa0c0',
        text: 'shadow' },
      { kind: 'box', box: B(98, 126, 157, 193), colour: '#8aa0c0',
        text: 'team ring' },
      { kind: 'box', box: B(92, 102, 163, 151), colour: '#8aa0c0',
        text: 'stunned stars' },
      { kind: 'box', box: B(110, 164, 145, 187), colour: '#8aa0c0',
        text: 'you marker' },
      { kind: 'box', box: B(80, 118, 174, 202), colour: '#8aa0c0', faint: 1,
        text: 'Hyper Bomb orbit' },
      { kind: 'box', box: B(147, 138, 215, 163), colour: '#8aa0c0', faint: 1,
        text: 'you arrow' }
    ]
  },
  cover: {
    label: 'The block in front covers your feet', on: false,
    draw: [
      { kind: 'fill', box: B(108, 200, 147, 237), colour: '#e8603c' }
    ]
  }
};

/* ------------------- what the officials measure out -------------- */

/* Medians across the official sheets, frame by frame. These are for
   comparison, never a target: the officials themselves scatter around
   them, and a sheet one or two pixels off is ordinary. Standing, the
   sole sits at 194 from the front and 192 from behind, because the
   body hides the foot. In profile the foot sits a little behind the
   body -- 124 looking left, 131 looking right -- while the body stays
   on 128. */
const CHAR_MEDIAN = {
  st_s: { sole: [194, 194, 194], foot: 127.3, top: [123, 124, 124.5] },
  st_w: { sole: [195, 195, 195], foot: 124.1, top: [128, 129, 130] },
  st_n: { sole: [192, 192, 192], foot: 127.5, top: [131.5, 132, 132] },
  st_e: { sole: [195, 195.5, 196], foot: 130.9, top: [129, 129, 129.5] },

  mo_s: { sole: [191.5, 193, 192.5, 193, 191, 193, 193, 195.5] },
  mo_w: { sole: [193, 192.5, 195, 192, 193, 193, 193, 194.5] },
  mo_n: { sole: [195.5, 194, 193, 194, 195, 195, 193.5, 192.5] },
  mo_e: { sole: [192.5, 193, 192, 193, 192.5, 192, 195, 194.5] },

  th_s: { sole: [192.5, 191, 185.5, 187, 186, 189, 192],
          top: [123, 117.5, 118.5, 117, 117.5, 120, 124] },
  th_w: { sole: [193, 187.5, 186, 184, 184.5, 190, 191.5],
          top: [123.5, 122, 120, 120.5, 126, 125, 124.5] },
  th_n: { sole: [192, 189, 188, 185, 185.5, 186, 188.5],
          top: [126.5, 123.5, 120.5, 119, 124.5, 122.5, 124] },
  th_e: { sole: [192.5, 192, 186, 185.5, 188, 189, 191],
          top: [126, 122, 117.5, 117.5, 121, 120, 122] },

  pu_s: { sole: [194, 193, 195, 195, 194], top: [125, 126, 126, 127, 125] },
  pu_w: { sole: [193, 191, 192, 193, 194], top: [129.5, 128, 128, 129, 129.5] },
  pu_n: { sole: [194, 194.5, 195, 194, 194.5], top: [132, 131, 128, 128, 129.5] },
  pu_e: { sole: [196, 195.5, 193.5, 193.5, 193.5], top: [129, 129, 129, 128, 129] },

  pa_s: { sole: [194, 194, 194, 194, 194, 194, 194, 194],
          top: [124.5, 124, 125, 125, 127, 126, 125, 124] },
  pa_w: { sole: [195, 195, 195, 195, 195, 195, 195, 195],
          top: [125.5, 125.5, 128.5, 132.5, 134, 135, 134, 129] },
  pa_n: { sole: [192, 192, 192, 192, 192, 192, 192, 192],
          top: [129, 131, 133, 135, 137, 135, 132, 130] },
  pa_e: { sole: [195.5, 195, 195, 195, 195, 195, 195, 195],
          top: [126, 130.5, 133, 132.5, 131, 130, 127, 125] }
};

/* Where 98% of the official pixels fall, per animation: the 1st and
   99th percentile of x and y over every frame of every sheet. A frame
   outside this is not wrong -- death is supposed to leave it -- but it
   is worth seeing. */
const CHAR_ENVELOPE = {
  st:     { x: [85, 169], y: [103, 203], ground: true },
  mo:     { x: [81, 177], y: [103, 203], ground: true },
  th:     { x: [60, 195], y: [96, 213],  ground: true },
  pu:     { x: [71, 184], y: [106, 207], ground: true },
  pa:     { x: [79, 177], y: [103, 220], ground: true },
  dd:     { x: [67, 191], y: [16, 213] },
  wi:     { x: [67, 182], y: [64, 217] },
  wa:     { x: [86, 165], y: [80, 199] },
  msb_ch: { x: [77, 177], y: [106, 207] },
  rui_st: { x: [84, 171], y: [110, 186] },
  rui_mo: { x: [85, 173], y: [110, 184] }
};

const CHAR_SAFE = B(80, 88, 176, 216);

/* Typical body, standing, front, frame 0: the median official is 72
   tall and 44 wide, and the range runs 55 to 91 tall. Taller than
   about 72 and the name band starts crossing the head, which no file
   can change. */
const CHAR_BODY = { h: 72, w: 44, hMin: 55, hMax: 91 };

/* ---------------------------- the clock -------------------------- */

/* The file carries pixels and a frame count, and no timing at all.
   The game decides, per animation, the same for every character, in
   steps of 20 ms. Frame 0 is held for an extra step in the animations
   that start from rest, which is why the first entry is longer. */
function charTiming(anim, n) {
  const flat = ms => new Array(n).fill(ms);
  const held = (first, rest) => {
    const a = flat(rest);
    if (a.length) a[0] = first;
    return a;
  };
  switch (anim) {
    case 'st': case 'rui_st': return held(240, 120);
    case 'mo': case 'rui_mo': return flat(60);
    case 'th': return held(120, 60);
    case 'pu': return held(140, 70);
    case 'pa': return flat(50);
    case 'dd': return held(210, 70);
    case 'wi': return flat(80);
    case 'wa': return flat(40);
    default: return null;        /* static: cart, preview, portrait */
  }
}

function charLoops(anim) {
  return anim === 'st' || anim === 'mo' || anim === 'rui_st' ||
         anim === 'rui_mo' || anim === 'pa' || anim === 'wi';
}

/* --------------------------- measurement ------------------------- */

/* What the guide measures on every frame: the lowest row of pixels
   (the sole), the highest (the top of the head), the centre of the
   box, and the centre of the bottom rows, which is the foot. The box
   centre and the foot centre disagree in profile, and that is normal
   -- the guide prints both. */
function charMeasure(g, f) {
  const bb = f.bbox();
  if (!bb) return { empty: true };
  const [x0, y0, x1, y1] = bb;
  const sole = y1 - 1, top = y0;
  let fx0 = Infinity, fx1 = -Infinity;
  for (const r of f.runs) {
    if (r.y < sole - 2 || r.y > sole) continue;
    if (r.x < fx0) fx0 = r.x;
    if (r.x + r.px.length - 1 > fx1) fx1 = r.x + r.px.length - 1;
  }
  return {
    empty: false, x0, y0, x1: x1 - 1, y1: sole, sole, top,
    cx: (x0 + x1 - 1) / 2,
    foot: fx1 >= fx0 ? (fx0 + fx1) / 2 : (x0 + x1 - 1) / 2,
    w: x1 - x0, h: y1 - y0,
    touches: x0 === 0 || y0 === 0 || x1 >= g.width || y1 >= g.height
  };
}

function charMedianOf(list) {
  const a = list.slice().sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/* ------------------------- the walk measure ---------------------- */

/* A character that slides instead of walking is the commonest thing
   wrong with a first sheet, and it is invisible frame by frame. The
   guide's measure looks only at the legs: the pixels from the 70th
   percentile of y downwards. Between neighbouring frames, including
   the wrap from 7 back to 0, the difference is how much of the union
   of the two silhouettes is not shared. A human walk passes with eight
   distinct lower silhouettes, a median difference of at least 0.12 and
   a largest of at least 0.20. Across the officials the median is 0.31,
   and 162 of 202 walk files pass all three. */
function charLowerSilhouette(g, f) {
  const ys = [];
  for (const r of f.runs) for (let i = 0; i < r.px.length; i++) ys.push(r.y);
  if (!ys.length) return null;
  ys.sort((a, b) => a - b);
  const cut = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.7))];
  const set = new Set();
  for (const r of f.runs) {
    if (r.y < cut) continue;
    for (let i = 0; i < r.px.length; i++) set.add(r.y * g.width + r.x + i);
  }
  return set;
}

function charStride(g) {
  const n = g.frames.length;
  if (n < 2) return null;
  const sil = g.frames.map(f => charLowerSilhouette(g, f));
  if (sil.some(s => !s || !s.size)) return null;
  const diffs = [];
  for (let i = 0; i < n; i++) {
    const a = sil[i], b = sil[(i + 1) % n];
    let shared = 0;
    for (const k of a) if (b.has(k)) shared++;
    const union = a.size + b.size - shared;
    diffs.push(union ? 1 - shared / union : 0);
  }
  const keys = new Set(sil.map(s => Array.from(s).sort((p, q) => p - q).join(',')));
  return {
    distinct: keys.size, frames: n,
    median: charMedianOf(diffs), max: Math.max(...diffs), diffs,
    pass: keys.size === n && charMedianOf(diffs) >= 0.12 &&
          Math.max(...diffs) >= 0.20
  };
}

/* ---------------------------- the checks ------------------------- */

/* Phrased as sentences, because a list of codes helps nobody drawing.
   Each one says what the game will do, not merely that a number is
   off. Severity: 'bad' breaks it in play, 'odd' is outside what the
   officials do. */
function charProblems(name, g) {
  const sheet = charSheetOf(name);
  const out = [];
  const say = (level, text) => out.push({ level, text });
  if (!sheet) return out;

  const side = sheet.side || CHAR_SIDE;
  if (g.width !== side || g.height !== side) {
    say('bad', tf('{file} has to be {side} x {side}; this one is {w} x {h}. ' +
      'The game stamps the whole sheet at a fixed place, so a different ' +
      'size moves the character.',
      { file: sheet.file, side: side, w: g.width, h: g.height }));
  }

  const n = g.frames.length;
  if (sheet.need != null && n !== sheet.need) {
    say('bad', tf('{file} needs exactly {want} frames, not {got} \u2014 {why}.',
      { file: sheet.file, want: sheet.need, got: n,
        why: t(CHAR_WHY_FIXED[sheet.anim] || 'the game counts on it') }));
  } else if (sheet.want != null) {
    const lo = sheet.min != null ? sheet.min : sheet.want;
    const hi = sheet.max != null ? sheet.max : sheet.want;
    if (n < lo || n > hi) {
      say('odd', tf(lo === hi
        ? '{file} usually has {want} frames; this one has {got}. Every frame ' +
          'costs time: the clock is fixed, so more frames is a longer ' +
          'animation, not a slower one.'
        : '{file} usually has {want} frames (the officials run {lo} to {hi}); ' +
          'this one has {got}. Every frame costs time: the clock is fixed, ' +
          'so more frames is a longer animation, not a slower one.',
        { file: sheet.file, want: sheet.want, got: n, lo: lo, hi: hi }));
    }
  }
  if ((sheet.anim === 'th' || sheet.anim === 'pu') && n > 7) {
    say('odd', tf(sheet.anim === 'th'
      ? 'while throwing the game ignores the player\u2019s direction, so ' +
        '{n} frames pins them for {ms} ms in the middle of a match.'
      : 'while punching the game ignores the player\u2019s direction, so ' +
        '{n} frames pins them for {ms} ms in the middle of a match.',
      { n: n, ms: n * (sheet.anim === 'th' ? 60 : 70) }));
  }

  if (sheet.anim === 'face') return out;   /* 40 x 40, no guides apply */

  /* the drawing itself, frame by frame */
  const env = CHAR_ENVELOPE[sheet.anim];
  /* Which sheets these two measures are allowed to judge.

     The floor is for a character standing on the ground on its own
     feet. Throwing, punching, being stunned, dying, winning and
     warping all lift the body on purpose, and the guide gives
     per-frame medians for them rather than a floor. Mounted is not on
     the ground at all -- rui_st and rui_mo are the rider WITHOUT the
     Louie, sitting where the Louie's back will be, which is why the
     officials put their soles around 147 to 168 -- and msb_ch is a
     character in a cart. Judging any of those against 195 was wrong,
     and said so about thirteen of one official's thirty-seven sheets.

     The axis is the same story from the other side. The measure here
     is the centre of the box, which is what the guide measured its
     own band from, over 606 standing frames and 1616 walking ones. It
     published no such band for an action, and the box centre is the
     wrong instrument there anyway: the guide's own advice is to
     centre the body, not the box with the prop in it, and a throw is
     an outstretched arm. So both are measured on every sheet and
     shown in the table; only these two judge. */
  const onFoot = sheet.anim === 'st' || sheet.anim === 'mo';
  let offAxis = 0, border = 0, outside = 0, empty = 0;
  const soles = [];
  g.frames.forEach(f => {
    const m = charMeasure(g, f);
    if (m.empty) { empty++; return; }
    soles.push(m.sole);
    if (onFoot && Math.abs(m.cx - CHAR_AXIS) > 7.5) offAxis++;
    if (m.touches) border++;
    if (env && env.ground &&
        (m.x0 < CHAR_SAFE.x0 || m.x1 > CHAR_SAFE.x1 ||
         m.y0 < CHAR_SAFE.y0 || m.y1 > CHAR_SAFE.y1)) outside++;
  });

  if (empty) {
    say('bad', tf(empty === 1
      ? '{n} frame is empty. The game shows it anyway, as a gap in the animation.'
      : '{n} frames are empty. The game shows them anyway, as a gap in the ' +
        'animation.', { n: empty }));
  }
  if (offAxis) {
    say('bad', tf(offAxis === 1
      ? '{n} frame sits more than 7 px off the axis. Collision is computed ' +
        'from the player\u2019s square, never from the pixels, so an ' +
        'off-axis body looks like it walks through walls and bombs.'
      : '{n} frames sit more than 7 px off the axis. Collision is computed ' +
        'from the player\u2019s square, never from the pixels, so an ' +
        'off-axis body looks like it walks through walls and bombs.',
      { n: offAxis }));
  }
  const med = charMedianOf(soles);
  if (med != null && onFoot) {
    const walk = sheet.anim === 'mo';
    const want = walk ? CHAR_SOLE_WALK : CHAR_SOLE;
    const lo = walk ? 187 : 190, hi = walk ? 200 : 199;
    if (med < lo || med > hi) {
      say('bad', tf('the sole sits at {at} on the median frame, and the floor ' +
        'is {want}. Higher and the character floats over the block in front; ' +
        'lower and it sinks into it.', { at: med, want: want }));
    }
  }
  if (border) {
    say('bad', tf(border === 1
      ? '{n} frame touches the edge of the sheet. That is where grid cuts ' +
        'show up.'
      : '{n} frames touch the edge of the sheet. That is where grid cuts ' +
        'show up.', { n: border }));
  }
  if (outside) {
    say('odd', tf(outside === 1
      ? '{n} frame leaves the safe area (80, 88) to (176, 216). Ground ' +
        'animations are expected to stay inside it; death and victory are not.'
      : '{n} frames leave the safe area (80, 88) to (176, 216). Ground ' +
        'animations are expected to stay inside it; death and victory are not.',
      { n: outside }));
  }

  /* the seams the player actually sees, where one file can show them */
  if (sheet.anim === 'dd' && n >= 2) {
    const a = spriteBytesOfFrame(g, n - 1), b = spriteBytesOfFrame(g, n - 2);
    if (a !== b) {
      say('odd', t('the last frame of a death never reaches the screen ' +
        '\u2014 the player has already turned into the cart. Draw the end ' +
        'of the fall on the second to last and repeat it on the last.'));
    }
  }
  if (sheet.anim === 'mo' && n === 8) {
    const s = charStride(g);
    if (s && !s.pass) {
      say('odd', tf('the legs barely change between frames ({d} distinct ' +
        'lower silhouettes, median {med}, largest {max}; a walk passes at ' +
        '8, 0.12 and 0.20). This is what reads as sliding rather than ' +
        'walking.', { d: s.distinct, med: s.median.toFixed(2),
                      max: s.max.toFixed(2) }));
    }
  }
  return out;
}

/* A frame's pixels as a comparable string. Cheap, and only used on two
   frames of a death, so it does not need to be clever. */
function spriteBytesOfFrame(g, i) {
  const f = g.frames[i];
  if (!f) return '';
  return f.runs.map(r => r.y + ':' + r.x + ':' + r.px.join(',')).join('|');
}

/* ----------------------------- alignment ------------------------- */

/* Moving the sheet, not the frame. A walk rises and falls by a few
   pixels on purpose, and pinning every frame's sole to one row would
   flatten exactly the thing that makes it a walk. So the offset is
   computed once, from the median frame, and applied to all of them:
   the animation keeps its own motion and lands on the floor. */
function charAlignOffset(name, g) {
  const sheet = charSheetOf(name);
  /* Only a sheet whose character stands on its own feet has a floor
     to be put on. A rider sits on a Louie that is not in the file, a
     cart carries one, and an action lifts one -- see charProblems. */
  if (!sheet || (sheet.anim !== 'st' && sheet.anim !== 'mo')) return null;
  const soles = [], centres = [];
  for (const f of g.frames) {
    const m = charMeasure(g, f);
    if (!m.empty) { soles.push(m.sole); centres.push(m.cx); }
  }
  if (!soles.length) return null;
  const walk = sheet.anim === 'mo' || sheet.anim === 'rui_mo';
  const target = walk ? CHAR_SOLE_WALK : CHAR_SOLE;
  return {
    dx: Math.round(CHAR_AXIS - charMedianOf(centres)),
    dy: Math.round(target - charMedianOf(soles)),
    from: { sole: charMedianOf(soles), cx: charMedianOf(centres) },
    target
  };
}

function charApplyOffset(g, dx, dy) {
  let lost = 0;
  for (const f of g.frames) {
    const keep = [];
    for (const r of f.runs) {
      const y = r.y + dy;
      if (y < 0 || y >= g.height) { lost += r.px.length; continue; }
      let x = r.x + dx, px = r.px;
      if (x < 0) { px = px.slice(-x); lost += Math.min(-x, r.px.length); x = 0; }
      if (x + px.length > g.width) {
        lost += x + px.length - g.width;
        px = px.slice(0, g.width - x);
      }
      if (px.length) keep.push({ x, y, px });
    }
    keep.sort((a, b) => a.y - b.y || a.x - b.x);
    f.runs = keep;
  }
  return lost;
}

/* ============================ the drawing ========================= */

const chr = {
  sheet: null,          /* the matched entry of the 37, or null */
  show: {},             /* guide group -> on */
  clock: false,         /* play at the game's own timings */
  timer: null,
  labels: true
};
for (const k in CHAR_GUIDES) chr.show[k] = CHAR_GUIDES[k].on;

/* Guides go on top of the artwork at whatever zoom the view is at, in
   sheet coordinates scaled by z. Half-pixel offsets keep a one-pixel
   line crisp instead of smeared across two. */
function charPaint(ctx, z, w, h) {
  if (w !== CHAR_SIDE || h !== CHAR_SIDE) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  for (const key in CHAR_GUIDES) {
    if (!chr.show[key]) continue;
    for (const d of CHAR_GUIDES[key].draw) charPaintOne(ctx, z, d);
  }
  ctx.restore();
}

function charPaintOne(ctx, z, d) {
  const a = d.faint ? 0.3 : 0.85;
  ctx.strokeStyle = d.colour;
  ctx.fillStyle = d.colour;
  ctx.globalAlpha = a;
  ctx.setLineDash(d.dash ? [5, 4] : []);
  if (d.kind === 'vline') {
    const x = Math.round(d.x * z) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CHAR_SIDE * z); ctx.stroke();
    charLabel(ctx, d.text, x + 3, 3, d.colour);
  } else if (d.kind === 'hline') {
    const y = Math.round(d.y * z) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHAR_SIDE * z, y); ctx.stroke();
    charLabel(ctx, d.text, 3, y + 3, d.colour);
  } else {
    const b = d.box;
    const x = Math.round(b.x0 * z) + 0.5, y = Math.round(b.y0 * z) + 0.5;
    const bw = (b.x1 - b.x0 + 1) * z - 1, bh = (b.y1 - b.y0 + 1) * z - 1;
    if (d.kind === 'fill') {
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, y, bw, bh);
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(x, y, bw, bh);
    } else if (d.kind === 'band') {
      ctx.globalAlpha = 0.14;
      ctx.fillRect(x, y, bw, bh);
      ctx.globalAlpha = a;
      ctx.strokeRect(x, y, bw, bh);
    } else {
      ctx.strokeRect(x, y, bw, bh);
    }
    charLabel(ctx, d.text, x + 3, y + 3, d.colour);
  }
  ctx.setLineDash([]);
}

/* A label the artwork cannot swallow: dark plate, light text.

   Painted, not written, so the interface sweep that translates nodes
   never sees it -- the translation has to be asked for here, and
   i18nSetLang redraws so a language change reaches the canvas. */
function charLabel(ctx, text, x, y, colour) {
  if (!text || !chr.labels) return;
  if (typeof t === 'function') text = t(text);
  const w = ctx.measureText(text).width;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(x - 2, y - 1, w + 4, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/* ============================ the clock =========================== */

/* Playing at the game's own timings rather than at a flat frame rate.
   The point is not accuracy for its own sake: an animation that reads
   well at 12 fps can read badly at the 60 ms the walk actually gets,
   and the only way to know is to watch it at the right speed. */
function charClockStop() {
  clearTimeout(chr.timer);
  chr.timer = null;
}

function charClockPlay() {
  const e = sprite.entry;
  if (!e || !chr.sheet) return false;
  const ms = charTiming(chr.sheet.anim, e.gra.frames.length);
  if (!ms) return false;
  charClockStop();
  const loops = charLoops(chr.sheet.anim);
  const tick = () => {
    const n = e.gra.frames.length;
    const next = sprite.frame + 1;
    if (next >= n && !loops) { spritePause(); return; }
    sprite.frame = next % n;
    spriteDraw();
    spriteMarkStrip();
    chr.timer = setTimeout(tick, ms[sprite.frame] || 60);
  };
  chr.timer = setTimeout(tick, ms[sprite.frame] || 60);
  return true;
}

/* ============================ the panel =========================== */

function charSync() {
  const e = sprite.entry;
  chr.sheet = e ? charSheetOf(e.name) : null;
  charClockStop();
  /* Closing the sheet does not run the panel renderers, so the dock
     has to be told itself or it stays switched on for a file that is
     no longer open. */
  if (!e) {
    const d = $('charDock');
    if (d) d.classList.remove('on');
  }
}

function charRenderPanel() {
  const dock = $('charDock');
  if (!dock) return;
  const e = sprite.entry;
  const on = !!(e && e.gra && !e.gra.eft &&
    ((e.gra.width === CHAR_SIDE && e.gra.height === CHAR_SIDE) || chr.sheet));
  dock.classList.toggle('on', on);
  /* Aligning needs to know which sheet this is, because the floor it
     aims at is 195 standing and 193 walking. Without a name there is
     no answer, so the button says so by being unavailable. */
  const a = $('bCharAlign'), m = $('bCharMould');
  if (a) a.disabled = !(on && chr.sheet &&
    (chr.sheet.anim === 'st' || chr.sheet.anim === 'mo'));
  if (m) m.disabled = !on;
  if (!on) return;
  charRenderWho();
  charRenderFrames();
  charRenderChecks();
}

function charRenderWho() {
  const el = $('charWho');
  const e = sprite.entry;
  if (!el || !e) return;
  const s = chr.sheet;
  if (!s) {
    el.innerHTML = '<p class="hint">' + tf('This is a {w} x {h} sheet, so ' +
      'the guides apply, but the name is not one of the 37 the loader asks ' +
      'for. Rename it and the frame counts, the timings and the measured ' +
      'medians come with it.', { w: e.gra.width, h: e.gra.height }) + '</p>';
    return;
  }
  const count = s.need != null ? String(s.need)
    : s.want + (s.min != null ? ' (' + s.min + '\u2013' + s.max + ')' : '');
  const ms = charTiming(s.anim, e.gra.frames.length);
  const total = ms ? ms.reduce((a, b) => a + b, 0) : 0;
  el.innerHTML =
    '<dl class="what">' +
    '<dt>' + tf('slot {n}', { n: s.slot }) + '</dt><dd>' + t(s.label) +
      (s.dir ? ', ' + t(s.dirName) : '') + '</dd>' +
    '<dt>' + t('plays') + '</dt><dd>' + t(s.when) + '</dd>' +
    (s.dir ? '<dt>' + t('facing') + '</dt><dd>' + t(s.dirHow) + '</dd>' : '') +
    '<dt>' + t('frames') + '</dt><dd>' +
      tf('{here} here, {want} expected',
         { here: e.gra.frames.length, want: count }) + '</dd>' +
    '<dt>' + t('clock') + '</dt><dd>' + (ms
      ? tf(charLoops(s.anim) ? '{ms} ms a round, looping'
                             : '{ms} ms a round, once', { ms: total })
      : t('static \u2014 the game draws frame 0 and no other')) + '</dd>' +
    '</dl>';
}

/* Frame by frame: what this sheet measures, and what the officials
   measured at the same frame. The delta column is the useful one. */
function charRenderFrames() {
  const el = $('charFrames');
  const e = sprite.entry;
  if (!el || !e) return;
  const g = e.gra;
  const s = chr.sheet;
  const med = s ? CHAR_MEDIAN[s.file] : null;
  const ms = s ? charTiming(s.anim, g.frames.length) : null;
  /* The floor only colours a column where the floor applies: see the
     note in charProblems about mounted, carted and airborne sheets. */
  const onFoot = s && (s.anim === 'st' || s.anim === 'mo');
  const floor = s && s.anim === 'mo' ? CHAR_SOLE_WALK : CHAR_SOLE;
  let html = '<table class="tbl"><thead><tr><th>#</th>' +
    (ms ? '<th>ms</th>' : '') +
    '<th>' + t('sole') + '</th><th>' + t('axis') + '</th><th>' + t('top') +
    '</th><th>' + t('size') + '</th>' +
    (med ? '<th>' + t('vs official') + '</th>' : '') + '</tr></thead><tbody>';
  g.frames.forEach((f, i) => {
    const m = charMeasure(g, f);
    const cur = i === sprite.frame ? ' class="hot"' : '';
    if (m.empty) {
      html += '<tr' + cur + '><td>' + (i + 1) + '</td><td colspan="' +
        (4 + (ms ? 1 : 0) + (med ? 1 : 0)) + '">' + t('empty') + '</td></tr>';
      return;
    }
    let delta = '';
    if (med) {
      const parts = [];
      if (med.sole && med.sole[i] != null) {
        const d = m.sole - med.sole[i];
        parts.push(t('sole') + ' ' + (d > 0 ? '+' : '') + d);
      }
      if (med.foot != null) {
        const d = +(m.foot - med.foot).toFixed(1);
        parts.push(t('foot') + ' ' + (d > 0 ? '+' : '') + d);
      }
      delta = '<td class="' + charDeltaClass(m, med, i) + '">' +
        parts.join(', ') + '</td>';
    }
    html += '<tr' + cur + '><td>' + (i + 1) + '</td>' +
      (ms ? '<td>' + ms[i] + '</td>' : '') +
      '<td class="' + (onFoot && Math.abs(m.sole - floor) > 5 ? 'no' : '') + '">' +
      m.sole + '</td>' +
      '<td class="' + (onFoot && Math.abs(m.cx - CHAR_AXIS) > 7.5 ? 'no' : '') + '">' +
      m.cx + '</td><td>' + m.top + '</td><td>' + m.w + ' x ' + m.h + '</td>' +
      delta + '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function charDeltaClass(m, med, i) {
  let worst = 0;
  if (med.sole && med.sole[i] != null) worst = Math.abs(m.sole - med.sole[i]);
  if (med.foot != null) worst = Math.max(worst, Math.abs(m.foot - med.foot));
  return worst > 6 ? 'no' : worst > 3 ? 'meh' : 'ok';
}

function charRenderChecks() {
  const el = $('charChecks');
  const e = sprite.entry;
  if (!el || !e) return;
  if (!chr.sheet) { el.innerHTML = ''; return; }
  const probs = charProblems(e.name, e.gra);
  if (!probs.length) {
    el.innerHTML = '<p class="note good">' + t('Nothing to flag: the counts, ' +
      'the size, the axis and the sole all read the way the game wants ' +
      'them.') + '</p>';
    return;
  }
  el.innerHTML = probs.map(p =>
    '<p class="note ' + (p.level === 'bad' ? 'bad' : 'warn') + '">' +
    p.text + '</p>').join('');
}

/* ------------------------- the drawing aids ---------------------- */

/* The template, as a transparent PNG at sheet size, so the same guides
   can go under the artwork in whatever program somebody draws in. */
function charSaveMould() {
  const c = document.createElement('canvas');
  c.width = CHAR_SIDE; c.height = CHAR_SIDE;
  const ctx = c.getContext('2d');
  const keep = chr.show, labels = chr.labels;
  chr.show = {}; chr.labels = true;
  for (const k in CHAR_GUIDES) chr.show[k] = k !== 'cover';
  charPaint(ctx, 1, CHAR_SIDE, CHAR_SIDE);
  chr.show = keep; chr.labels = labels;
  c.toBlob(b => b.arrayBuffer().then(ab => saveFile(
    'character_guides_256.png', new Uint8Array(ab), 'image/png')));
}

function charAlign() {
  const e = sprite.entry;
  if (!e || !chr.sheet) return;
  const off = charAlignOffset(e.name, e.gra);
  if (!off) { notify(t('nothing drawn to align'), 1); return; }
  if (!off.dx && !off.dy) { notify(t('already on the axis and the floor')); return; }
  const lost = charApplyOffset(e.gra, off.dx, off.dy);
  spriteRenderAll();
  spriteDraw();
  notify(tf(lost
    ? 'moved the whole sheet {dx} across and {dy} down; the sole now sits ' +
      'at {at} on the median frame, and {lost} pixels fell off the sheet'
    : 'moved the whole sheet {dx} across and {dy} down; the sole now sits ' +
      'at {at} on the median frame',
    { dx: off.dx, dy: off.dy, at: off.target, lost: lost }));
}

/* ----------------------------- wiring ---------------------------- */

function charWire() {
  const box = $('charGuides');
  if (box) {
    box.innerHTML = Object.keys(CHAR_GUIDES).map(k =>
      '<label class="check"><input type="checkbox" data-guide="' + k + '"' +
      (CHAR_GUIDES[k].on ? ' checked' : '') + '> ' +
      CHAR_GUIDES[k].label + '</label>').join('');
    box.addEventListener('change', ev => {
      const k = ev.target.getAttribute('data-guide');
      if (!k) return;
      chr.show[k] = ev.target.checked;
      spriteDraw();
      if (typeof paintDraw === 'function') paintDraw();
    });
  }
  const lab = $('charLabels');
  if (lab) lab.addEventListener('change', () => {
    chr.labels = lab.checked;
    spriteDraw();
    if (typeof paintDraw === 'function') paintDraw();
  });
  const clk = $('charClock');
  if (clk) clk.addEventListener('change', () => {
    chr.clock = clk.checked;
    if (sprite.playing) { spritePause(); spritePlay(); }
  });
  const a = $('bCharAlign');
  if (a) a.addEventListener('click', charAlign);
  const m = $('bCharMould');
  if (m) m.addEventListener('click', charSaveMould);
}
