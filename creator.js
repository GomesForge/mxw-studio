/* creator.js -- the Workshop: make something the server will take.

   The editor can already open and write every format involved. What it
   could not do is tell you *which* files a given piece of content needs,
   how big they may be, and what the receiving end checks.

   The first version of this panel answered that in prose, and prose is
   the wrong answer: a page of rules with no picture is not something a
   person can follow. Every page here now leads with a preview on the
   left and the controls on the right, so a change shows up as a change
   rather than as a line of text.

   The costume figure is drawn here rather than loaded, because the real
   sheets are generated at the other end and this editor has no copy of
   that generator. It is a schematic: the right parts in the right
   places with the right colours and patterns, which is what you need
   while choosing them. It is labelled as a schematic wherever it
   appears, and the page also takes the real template picture and checks
   it.

   The names, sizes and limits below are the receiving end's own, read
   from a live panel rather than guessed.

   ASCII only: these files are served without a charset. */

/* --------------------------- the contract ------------------------ */

const COSTUME_PARTS = [
  ['helmet', 'Helmet', true],
  ['suit', 'Suit (arms, legs)', true],
  ['chest', 'Chest', true],
  ['buckle', 'Buckle', false],
  ['face', 'Face', false],
  ['eyes', 'Eyes', false],
  ['pompom', 'Pompom', true],
  ['stem', 'Antenna', false],
  ['gloves', 'Gloves', true],
  ['boots', 'Boots', true]
];

const COSTUME_PATTERNS = [
  ['plain', 'Plain'], ['stripes', 'Stripes'], ['band', 'Band'],
  ['spots', 'Spots'], ['checks', 'Checks'], ['bandages', 'Bandages'],
  ['clouds', 'Clouds']
];

/* The White's own colour for each part. A part left on "keep" inherits
   this, which is what a null colour means in the file. */
const COSTUME_OWN = {
  helmet: '#e0e0e0', suit: '#666666', chest: '#15377d', buckle: '#9a7316',
  face: '#de9c52', eyes: '#000208', pompom: '#f485c7', stem: '#d6e8e9',
  gloves: '#d670a7', boots: '#ec7dbb'
};

const COSTUME_DEFAULT_2 = {
  helmet: '#764e2e', suit: '#764e2e', chest: '#eee2c6', pompom: '#eee2c6',
  gloves: '#eee2c6', boots: '#eee2c6'
};

/* The five the panel at the other end shows while you work. The save
   makes 37. */
const COSTUME_PREVIEWED = ['st_s', 'mo_s', 'mo_e', 'mo_n', 'mo_w'];
const COSTUME_SHEET_COUNT = 37;

/* The template picture: 432 x 640, with a 16 x 16 pure magenta square
   set 8 pixels in from each corner. Those four squares are how the
   receiving end finds the figure, so a picture missing one, or cropped
   past them, is refused. A larger copy is fine, because it rectifies by
   the corners, which is why the check measures them rather than the
   picture. */
const COSTUME_TEMPLATE = { w: 432, h: 640, mark: 16, inset: 8, key: '#ff00ff' };

/* A bomb skin is real artwork: these file names, nothing else. */
const SKIN_FILES = [
  ['bomb.spr', 'The bomb sitting on the ground, and appearing', true, 'bomb'],
  ['bomb_d.spr', 'The bomb in its last moment, about to go off', false, 'bomb'],
  ['bomb_s.spr', 'The bomb while it slides after a kick', false, 'bomb'],
  ['bomb_f.eft', 'The fuse burning on top of it', false, 'bomb'],
  ['flame_center.eft', 'The blast where the bomb was', false, 'centre'],
  ['flame_hor.eft', 'The arm running left and right', false, 'hor'],
  ['flame_ver.eft', 'The arm running up and down', false, 'ver'],
  ['flame_left.eft', 'The tip of the arm going left', false, 'left'],
  ['flame_right.eft', 'The tip of the arm going right', false, 'right'],
  ['flame_up.eft', 'The tip of the arm going up', false, 'up'],
  ['flame_down.eft', 'The tip of the arm going down', false, 'down'],
  ['boom_block.eft', 'A breakable block coming apart', false, 'block']
];
const SKIN_MAX = 524288;

/* Maps. The layout is one character per cell, row by row. */
const MAP_SIZES = [
  { size: 0, w: 17, h: 15, pw: 800, ph: 600, starts: 6, players: 'up to 6' },
  { size: 1, w: 21, h: 17, pw: 960, ph: 694, starts: 12, players: '7 to 12' },
  { size: 2, w: 25, h: 19, pw: 1120, ph: 770, starts: 12, players: '12' }
];
const MAP_CELLS = [
  ['9', 'Edge', 'The outer wall. It stays around the rim.', '#11151f'],
  ['2', 'Pillar', 'Solid. Never breaks, never hides anything.', '#596274'],
  ['1', 'Block', 'Breaks. The items are hidden in these.', '#8a6a3c'],
  ['0', 'Floor', 'Walkable.', '#2b3346']
];
const MAP_THEMES = [
  [1, 'Standard'], [2, 'Pyramid'], [3, 'Laboratory'], [4, 'Village'],
  [5, 'Iceberg'], [6, 'Road'], [7, 'ToyBox']
];
const MAP_ITEMS = ['Fire', 'Speed', 'Bomb', 'Kick', 'Glove', 'Skull', 'Vest',
  'Full fire', 'Louie', 'Punch', 'Line bomb', 'Pierce bomb', 'Water bomb'];
const MAP_LIMITS = { name: 20, item: 40, picture: 5242880, block: 262144,
  side: 4194304, blockW: 40, blockH: [20, 76] };

const SIDE_SIZES = MAP_SIZES.map(s => ({ w: s.pw, h: s.ph, players: s.players,
  cells: s.w + ' x ' + s.h, cw: s.w, ch: s.h }));
const SIDE_MAX = 4194304;

/* A character: about forty files, grouped by what they do. */
const CHAR_SETS = [
  ['st', 'Standing', 'It breathes rather than holding still.', true, true],
  ['mo', 'Walking', 'The longest set, and the one people see most.', true, true],
  ['pu', 'Punching', 'Hitting a bomb away.', true, true],
  ['pa', 'Struck', 'Caught by a thrown bomb.', true, true],
  ['msb_ch', 'Riding', 'On the mount.', true, false],
  ['rui_st', 'Mounted, still', '', true, false],
  ['rui_mo', 'Mounted, walking', '', true, false],
  ['rui_ju', 'Mounting', 'Marked in the original manual as possibly unused.',
   true, false],
  ['add', 'Idle flourish', 'Played after standing still for a while.', false, true],
  ['dd', 'Death', 'Travels a long way across the frame.', false, true],
  ['face', 'Portrait', 'The head at the top of the screen during a match.',
   false, true]
];

/* --------------------------- a zip writer ------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipStore(entries) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let off = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034B50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(8, 0, true);          /* stored, not deflated */
    dv.setUint16(12, 0x21, true);      /* a fixed date keeps zips stable */
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, off, true);
    cen.set(name, 46);
    central.push(cen);
    off += local.length + data.length;
  }
  const cenSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054B50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, off, true);
  const all = parts.concat(central, [end]);
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const chunk of all) { out.set(chunk, p); p += chunk.length; }
  return out;
}

/* ------------------------------ state ---------------------------- */

const creator = {
  track: 'costume',
  costume: null,
  picture: null,       /* {name, url} once one passes the check */
  skin: {},            /* name -> {bytes, note, ok, gra} */
  skinPlay: null,
  map: null,
  side: null
};

/* --------------------------- small helpers ----------------------- */

function crEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* A sentence with markup inside it is several text nodes, which cannot
   be translated one at a time. Keeping the English it was built from on
   the element lets i18n.js swap the whole thing at once. */
function crHTML(tag, cls, html) {
  const e = crEl(tag, cls);
  e.innerHTML = html;
  e.dataset.i18nHtml = html;
  return e;
}

function crButton(parent, text, fn, cls) {
  const b = crEl('button', cls || '', text);
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}

/* Every page is the same shape: a heading, one line saying what the
   thing is, then preview on the left and controls on the right. */
function crPage(body, title, lead) {
  body.appendChild(crEl('h3', '', title));
  body.appendChild(crHTML('p', 'crLead', lead));
  const stage = crEl('div', 'crStage');
  const left = crEl('div', 'crView');
  const right = crEl('div', 'crSide');
  stage.appendChild(left);
  stage.appendChild(right);
  body.appendChild(stage);
  return { left, right };
}

function crSection(parent, title) {
  parent.appendChild(crEl('h4', '', title));
  return parent;
}

function crSteps(parent, steps) {
  const ol = crEl('ol', 'crSteps');
  for (const s of steps) {
    const li = document.createElement('li');
    li.innerHTML = s;
    ol.appendChild(li);
  }
  parent.appendChild(ol);
  return ol;
}

/* One row of "this is the file, this is what it is for". */
function crFileRow(parent, name, what, need) {
  const row = crEl('div', 'crFile');
  row.dataset.name = name;
  row.appendChild(crEl('span', 'crState', need ? 'needed' : 'optional'));
  row.appendChild(crEl('code', '', name));
  row.appendChild(crEl('span', 'crWhat', what));
  parent.appendChild(row);
  return row;
}

function crDrop(parent, label, accept, multiple, take) {
  const drop = crEl('div', 'crDrop');
  drop.appendChild(crEl('b', '', label));
  drop.appendChild(crEl('span', 'crDropHint', 'drop here, or click to choose'));
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => {
    e.preventDefault();
    drop.classList.remove('over');
    take(e.dataTransfer.files);
  };
  drop.onclick = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = !!multiple;
    i.onchange = () => take(i.files);
    i.click();
  };
  parent.appendChild(drop);
  return drop;
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const x = amount > 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(x)));
  });
  return 'rgb(' + c.join(',') + ')';
}

/* ------------------------- the costume figure -------------------- */

/* Resolve what a part is actually painted in: nothing means the
   White's own, a name means follow that part. */
function costumeColour(spec, id, depth) {
  const p = spec.parts[id];
  if (!p || p.colour == null) return COSTUME_OWN[id];
  if (/^#/.test(p.colour)) return p.colour;
  if ((depth || 0) > 3) return COSTUME_OWN[id];
  return costumeColour(spec, p.colour, (depth || 0) + 1);
}

/* The pattern drawn over a part, clipped to whatever shape is current.
   These are the seven the receiving end knows; they are drawn here the
   way they read rather than pixel-for-pixel the way it draws them. */
function paintPattern(ctx, kind, colour, size, angle, box) {
  if (!kind || kind === 'plain') return;
  const s = Math.max(2, 7 * (size || 1));
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const reach = Math.max(box.w, box.h) * 1.6;
  ctx.translate(cx, cy);
  ctx.rotate((angle || 0) * Math.PI / 180);
  if (kind === 'stripes' || kind === 'bandages') {
    const gap = kind === 'bandages' ? s * 0.55 : s;
    ctx.lineWidth = kind === 'bandages' ? s * 1.15 : s * 0.55;
    ctx.lineCap = 'butt';
    for (let x = -reach; x < reach; x += s + gap) {
      ctx.beginPath();
      ctx.moveTo(x, -reach);
      ctx.lineTo(x + (kind === 'bandages' ? s * 0.4 : 0), reach);
      ctx.stroke();
    }
  } else if (kind === 'band') {
    ctx.fillRect(-reach, -s * 0.9, reach * 2, s * 1.8);
  } else if (kind === 'spots') {
    for (let y = -reach; y < reach; y += s * 2.1) {
      for (let x = -reach; x < reach; x += s * 2.1) {
        ctx.beginPath();
        ctx.arc(x + ((Math.round(y / (s * 2.1)) % 2) ? s : 0), y, s * 0.52, 0, 7);
        ctx.fill();
      }
    }
  } else if (kind === 'checks') {
    for (let y = -reach, j = 0; y < reach; y += s, j++) {
      for (let x = -reach, i = 0; x < reach; x += s, i++) {
        if ((i + j) % 2) ctx.fillRect(x, y, s, s);
      }
    }
  } else if (kind === 'clouds') {
    for (let y = -reach; y < reach; y += s * 2.4) {
      for (let x = -reach; x < reach; x += s * 2.8) {
        const o = (Math.round(y / (s * 2.4)) % 2) ? s * 1.4 : 0;
        ctx.beginPath();
        ctx.arc(x + o, y, s * 0.7, 0, 7);
        ctx.arc(x + o + s * 0.7, y - s * 0.25, s * 0.52, 0, 7);
        ctx.arc(x + o - s * 0.65, y - s * 0.15, s * 0.45, 0, 7);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* Fill the current path with a part's colour and then its pattern. */
function costumePart(ctx, spec, id, box) {
  const col = costumeColour(spec, id, 0);
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  g.addColorStop(0, shade(col, 0.22));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, -0.26));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  const p = spec.parts[id];
  if (p && p.pattern && p.pattern !== 'plain') {
    ctx.save();
    paintPattern(ctx, p.pattern, p.colour2 || '#ffffff', p.size, p.angle, box);
    ctx.restore();
  }
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(0,0,0,.38)';
  ctx.stroke();
  ctx.restore();
}

/* A schematic of the figure: the right parts, in the right places, in
   the colours and patterns chosen. Not the artwork -- the sheets are
   generated at the other end -- but enough to choose by. */
function drawCostumeFigure(canvas, spec) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const s = Math.min(W / 180, H / 250);
  ctx.save();
  ctx.translate((W - 180 * s) / 2, (H - 250 * s) / 2);
  ctx.scale(s, s);

  const has = id => {
    const p = spec.parts[id];
    return !(p && p.off);
  };

  /* legs, then arms, then the body, so the trunk sits on top */
  for (const x of [62, 96]) {
    roundRect(ctx, x, 178, 22, 30, 8);
    costumePart(ctx, spec, 'suit', { x: x, y: 178, w: 22, h: 30 });
  }
  for (const x of [70, 110]) {
    ctx.beginPath();
    ctx.ellipse(x, 214, 23, 15, 0, 0, 7);
    costumePart(ctx, spec, 'boots', { x: x - 23, y: 199, w: 46, h: 30 });
  }
  for (const x of [26, 128]) {
    roundRect(ctx, x, 134, 26, 36, 12);
    costumePart(ctx, spec, 'suit', { x: x, y: 134, w: 26, h: 36 });
  }
  for (const x of [36, 144]) {
    ctx.beginPath();
    ctx.arc(x, 176, 17, 0, 7);
    costumePart(ctx, spec, 'gloves', { x: x - 17, y: 159, w: 34, h: 34 });
  }

  roundRect(ctx, 56, 130, 68, 54, 12);
  costumePart(ctx, spec, 'suit', { x: 56, y: 130, w: 68, h: 54 });
  roundRect(ctx, 63, 136, 54, 28, 7);
  costumePart(ctx, spec, 'chest', { x: 63, y: 136, w: 54, h: 28 });
  roundRect(ctx, 80, 163, 20, 15, 4);
  costumePart(ctx, spec, 'buckle', { x: 80, y: 163, w: 20, h: 15 });

  /* the antenna and its pompom sit behind the helmet */
  if (has('stem')) {
    roundRect(ctx, 86, 36, 7, 22, 3);
    costumePart(ctx, spec, 'stem', { x: 86, y: 36, w: 7, h: 22 });
  }
  if (has('pompom')) {
    ctx.beginPath();
    ctx.arc(90, 24, 16, 0, 7);
    costumePart(ctx, spec, 'pompom', { x: 74, y: 8, w: 32, h: 32 });
  }

  roundRect(ctx, 36, 52, 108, 80, 52);
  costumePart(ctx, spec, 'helmet', { x: 36, y: 52, w: 108, h: 80 });
  roundRect(ctx, 49, 80, 82, 56, 13);
  costumePart(ctx, spec, 'face', { x: 49, y: 80, w: 82, h: 56 });
  for (const x of [66, 104]) {
    roundRect(ctx, x, 90, 11, 35, 5);
    costumePart(ctx, spec, 'eyes', { x: x, y: 90, w: 11, h: 35 });
  }
  ctx.restore();
}

/* ------------------------------ costume -------------------------- */

function costumeBlank() {
  const spec = { parts: {}, ends: { on: false, colour: null },
                 hair: { on: false, colour: '#c8692e', line: -10, length: 1 } };
  for (const [id, , patterned] of COSTUME_PARTS) {
    spec.parts[id] = patterned
      ? { colour: null, pattern: 'plain', colour2: COSTUME_DEFAULT_2[id],
          size: 1, angle: 0, place: 0 }
      : { colour: null };
  }
  return spec;
}

function costumeBuild(body) {
  if (!creator.costume) creator.costume = costumeBlank();
  const spec = creator.costume;

  const { left, right } = crPage(body, 'A costume',
    'A costume is <b>not a drawing</b>. The server keeps ten parts, each ' +
    'with a colour and some of them a pattern, and makes the ' +
    COSTUME_SHEET_COUNT + ' sheets itself from the White\'s own shape. You ' +
    'choose the parts; it does the rest.');

  /* ---- the preview */
  const fig = crEl('canvas', 'crCanvas');
  fig.width = 320; fig.height = 420;
  left.appendChild(fig);
  left.appendChild(crEl('p', 'crCap',
    'A schematic, drawn here from your choices. The real sheets are made ' +
    'at the other end, so this shows the parts and not the final artwork.'));

  const pic = crEl('div', 'crPicBox');
  pic.hidden = true;
  left.appendChild(pic);

  const redraw = () => { drawCostumeFigure(fig, spec); costumeSummary(); };

  /* ---- the controls */
  crSection(right, 'The ten parts');
  right.appendChild(crHTML('p', 'crHint',
    'Each row is one part. <b>Keep the White\'s</b> leaves it alone; ' +
    '<b>Colour</b> gives it your own; <b>Same as</b> makes it follow ' +
    'another part, which is how a belt and a buckle match.'));

  const head = crEl('div', 'crPart crPartHead');
  head.appendChild(crEl('span', 'crPartName', 'Part'));
  head.appendChild(crEl('span', 'crColHead', 'Colour'));
  head.appendChild(crEl('span', 'crColHead', 'Pattern, its colour, size, angle'));
  right.appendChild(head);

  const tbl = crEl('div', 'crParts');
  for (const [id, label, patterned] of COSTUME_PARTS) {
    const p = spec.parts[id];
    const row = crEl('div', 'crPart');
    const dot = crEl('i', 'crDot');
    dot.style.background = costumeColour(spec, id, 0);
    row.appendChild(dot);
    row.appendChild(crEl('span', 'crPartName', label));

    const mode = crEl('select', 'crMode');
    const opts = [['keep', 'Keep the White\'s'], ['own', 'Colour']];
    for (const [other, otherLabel] of COSTUME_PARTS)
      if (other !== id)
        opts.push(['ref:' + other, 'Same as ' + otherLabel.toLowerCase()]);
    for (const [v, t] of opts) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      mode.appendChild(o);
    }
    mode.value = p.colour === null ? 'keep'
      : (/^#/.test(p.colour) ? 'own' : 'ref:' + p.colour);

    const pick = crEl('input', 'crColour');
    pick.type = 'color';
    pick.value = /^#/.test(p.colour || '') ? p.colour : COSTUME_OWN[id];
    pick.style.visibility = mode.value === 'own' ? '' : 'hidden';

    const sync = () => {
      dot.style.background = costumeColour(spec, id, 0);
      redraw();
    };
    mode.onchange = () => {
      if (mode.value === 'keep') p.colour = null;
      else if (mode.value === 'own') p.colour = pick.value;
      else p.colour = mode.value.slice(4);
      pick.style.visibility = mode.value === 'own' ? '' : 'hidden';
      sync();
    };
    pick.oninput = () => { p.colour = pick.value; sync(); };
    row.appendChild(mode);
    row.appendChild(pick);

    if (patterned) {
      const pat = crEl('select', 'crMode crPat');
      for (const [v, t] of COSTUME_PATTERNS) {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        pat.appendChild(o);
      }
      pat.value = p.pattern;
      const pc = crEl('input', 'crColour');
      pc.type = 'color';
      pc.value = p.colour2 || '#eee2c6';
      pc.title = 'the colour the pattern is drawn in';
      const sz = crEl('input', 'crNum');
      sz.type = 'number'; sz.step = '0.1'; sz.min = '0.2'; sz.max = '4';
      sz.value = p.size;
      sz.title = 'how big the pattern is drawn';
      const an = crEl('input', 'crNum');
      an.type = 'number'; an.step = '15'; an.min = '-180'; an.max = '180';
      an.value = p.angle;
      an.title = 'the angle it runs at, in degrees';
      pat.onchange = () => { p.pattern = pat.value; redraw(); };
      pc.oninput = () => { p.colour2 = pc.value; redraw(); };
      sz.oninput = () => { p.size = Number(sz.value); redraw(); };
      an.oninput = () => { p.angle = Number(an.value); redraw(); };
      row.appendChild(pat); row.appendChild(pc);
      row.appendChild(sz); row.appendChild(an);
    } else {
      row.appendChild(crEl('span', 'crNone', 'no pattern'));
    }
    tbl.appendChild(row);
  }
  right.appendChild(tbl);

  crSection(right, 'Two extras');
  const ex = crEl('div', 'crParts');
  const r1 = crEl('div', 'crPart');
  const cbe = crEl('input'); cbe.type = 'checkbox'; cbe.checked = spec.ends.on;
  cbe.onchange = () => { spec.ends.on = cbe.checked; redraw(); };
  r1.appendChild(cbe);
  r1.appendChild(crEl('span', '', 'Loose ends beside the head: a headband, ' +
    'a trailing bandage'));
  ex.appendChild(r1);
  const r2 = crEl('div', 'crPart');
  const cbh = crEl('input'); cbh.type = 'checkbox'; cbh.checked = spec.hair.on;
  const hc = crEl('input', 'crColour'); hc.type = 'color';
  hc.value = spec.hair.colour;
  cbh.onchange = () => { spec.hair.on = cbh.checked; redraw(); };
  hc.oninput = () => { spec.hair.colour = hc.value; redraw(); };
  r2.appendChild(cbh);
  r2.appendChild(crEl('span', '', 'Hair under the helmet'));
  r2.appendChild(hc);
  ex.appendChild(r2);
  right.appendChild(ex);

  crSection(right, 'What you hand over');
  right.appendChild(crHTML('p', 'crHint',
    'One file, <code>costume.json</code>. It holds the ten parts and ' +
    'nothing else, so it is small and easy to read before anyone imports ' +
    'it.'));
  const out = crEl('pre', 'crOut');
  out.id = 'crCostumeOut';
  right.appendChild(out);

  const acts = crEl('div', 'crActs');
  crButton(acts, 'Save costume.json', () => {
    const name = (prompt('Name for the costume', 'My costume') || '').trim();
    if (!name) return;
    saveFile('costume.json', JSON.stringify(
      { name: name, spec: creator.costume, made_with: 'MXW Studio',
        sheets: COSTUME_SHEET_COUNT }, null, 1), 'application/json');
  }, 'primary');
  crButton(acts, 'Start again', () => {
    creator.costume = costumeBlank();
    creatorRender();
  });
  right.appendChild(acts);

  /* ---- the other way in */
  body.appendChild(crEl('h4', '', 'Or paint it instead'));
  body.appendChild(crHTML('p', 'crHint',
    'If you would rather paint than pick, the other end reads the colours ' +
    'back off a picture. <b>You need exactly one file:</b> a PNG based on ' +
    '<code>costume-template.png</code>, which is <b>' +
    COSTUME_TEMPLATE.w + ' x ' + COSTUME_TEMPLATE.h + '</b> and comes ' +
    'from whoever runs the server.'));
  crSteps(body, [
    'Paint each part over the template in <b>flat colour</b>. The shading ' +
      'is added later, so flat reads better than shaded.',
    'Leave the <b>four magenta squares</b> in the corners alone, and do ' +
      'not crop. They are how the figure is found. A bigger copy is fine.',
    'A part you do not touch stays the White\'s. Erase the pompom or the ' +
      'antenna to leave it off altogether.',
    'Drop it below. This checks the four squares and the scaling <b>before' +
      '</b> you send it anywhere, which is the mistake that wastes the ' +
      'most time.'
  ]);
  const picOut = crEl('p', 'crHint');
  crDrop(body, 'The painted picture', 'image/*', false,
         files => costumeTakePicture(files[0], picOut, pic));
  body.appendChild(picOut);

  redraw();
}

function costumeSummary() {
  const out = $('crCostumeOut');
  if (!out) return;
  const spec = creator.costume;
  const lines = [];
  let changed = 0;
  for (const [id, label, patterned] of COSTUME_PARTS) {
    const p = spec.parts[id];
    const bits = [];
    if (p.colour === null) bits.push('the White\'s own');
    else if (/^#/.test(p.colour)) { bits.push(p.colour); changed++; }
    else { bits.push('same as the ' + p.colour); changed++; }
    if (patterned && p.pattern !== 'plain') {
      bits.push(p.pattern + ' in ' + p.colour2 + ', size ' + p.size +
                ', ' + p.angle + ' deg');
      changed++;
    }
    lines.push(label.padEnd(20, ' ') + bits.join(', '));
  }
  if (spec.ends.on) { lines.push('loose ends'.padEnd(20, ' ') + 'on'); changed++; }
  if (spec.hair.on) { lines.push('hair'.padEnd(20, ' ') + spec.hair.colour); changed++; }
  lines.push('');
  lines.push(changed ? changed + ' thing(s) changed from the White'
                     : 'nothing changed yet: this is the White as it is');
  out.textContent = lines.join('\n');
}

function costumeCheckPicture(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const o = (y * c.width + x) * 4;
      if (d[o + 3] > 128 && d[o] > 200 && d[o + 2] > 200 && d[o + 1] < 80)
        pts.push([x, y]);
    }
  }
  if (!pts.length) return { ok: false, why: 'no magenta square found at all' };
  const mx = c.width / 2, my = c.height / 2;
  const quad = [[], [], [], []];
  for (const [x, y] of pts) quad[(x < mx ? 0 : 1) + (y < my ? 0 : 2)].push([x, y]);
  const missing = quad.filter(q => !q.length).length;
  if (missing)
    return { ok: false, why: missing + ' of the four squares is missing, so ' +
             'the picture has been cropped or painted over' };
  const box = quad.map(q => {
    const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
             y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  });
  const cx = box.map(b => (b.x0 + b.x1) / 2), cy = box.map(b => (b.y0 + b.y1) / 2);
  const spanX = (cx[1] + cx[3]) / 2 - (cx[0] + cx[2]) / 2;
  const spanY = (cy[2] + cy[3]) / 2 - (cy[0] + cy[1]) / 2;
  const wantX = COSTUME_TEMPLATE.w - 2 * COSTUME_TEMPLATE.inset - COSTUME_TEMPLATE.mark;
  const wantY = COSTUME_TEMPLATE.h - 2 * COSTUME_TEMPLATE.inset - COSTUME_TEMPLATE.mark;
  const sx = spanX / wantX, sy = spanY / wantY;
  if (!(sx > 0.05 && sy > 0.05))
    return { ok: false, why: 'the four squares are not where the corners of ' +
             'the template are' };
  const skew = Math.abs(sx - sy) / Math.max(sx, sy);
  if (skew > 0.02)
    return { ok: false, why: 'the picture is stretched: ' + sx.toFixed(2) +
             ' times across and ' + sy.toFixed(2) + ' down. Scale both the ' +
             'same way.' };
  return { ok: true, scale: sx, size: c.width + ' x ' + c.height };
}

function costumeTakePicture(file, out, box) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const r = costumeCheckPicture(img);
    out.className = 'crHint ' + (r.ok ? 'crOk' : 'crBad');
    out.textContent = r.ok
      ? 'Good: ' + file.name + ', ' + r.size + ', the four squares are there' +
        (Math.abs(r.scale - 1) < 0.01 ? ' at the template\'s own size.'
          : ' at ' + r.scale.toFixed(2) + ' times the template, which is fine.')
      : 'This will not import: ' + r.why;
    if (box) {
      box.hidden = false;
      box.innerHTML = '';
      const shown = crEl('img', 'crPic');
      shown.src = img.src;
      box.appendChild(shown);
      box.appendChild(crEl('p', 'crCap',
        r.ok ? 'Your picture, checked. This is what gets uploaded.'
             : 'Your picture. It will not import as it stands.'));
    }
  };
  img.onerror = () => {
    out.className = 'crHint crBad';
    out.textContent = 'that file is not an image this browser can read';
  };
  img.src = URL.createObjectURL(file);
}

/* ----------------------------- bomb skin ------------------------- */

/* Where each file is drawn when a bomb goes off: the diagram is the
   explanation. A list of twelve names is not. */
const SKIN_MAP = {
  bomb: [2, 2], centre: [2, 2], left: [0, 2], right: [4, 2],
  up: [2, 0], down: [2, 4], hor: [1, 2], ver: [2, 1], block: [4, 0]
};

function drawSkinDiagram(canvas, have, hot) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cell = Math.min(W, H) / 5.6;
  const ox = (W - cell * 5) / 2, oy = (H - cell * 5) / 2;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#fff';
  const dim = css.getPropertyValue('--dim').trim() || '#889';
  const edge = css.getPropertyValue('--edge').trim() || '#333';

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      ctx.fillStyle = 'rgba(255,255,255,.03)';
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
      ctx.strokeRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
    }
  }
  const paint = (kind, label, colour) => {
    const spots = kind === 'hor' ? [[1, 2], [3, 2]]
                : kind === 'ver' ? [[2, 1], [2, 3]]
                : [SKIN_MAP[kind]];
    for (const [gx, gy] of spots) {
      const x = ox + gx * cell, y = oy + gy * cell;
      ctx.fillStyle = colour;
      ctx.fillRect(x + 2, y + 2, cell - 5, cell - 5);
      ctx.fillStyle = '#0b0f18';
      ctx.font = '600 ' + Math.round(cell * 0.21) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + cell / 2, y + cell / 2 + cell * 0.07);
    }
  };
  const colourFor = kind => {
    const files = SKIN_FILES.filter(f => f[3] === kind);
    const any = files.some(f => have[f[0]] && have[f[0]].ok);
    if (hot === kind) return '#ffd166';
    return any ? '#3ecb8a' : 'rgba(255,255,255,.14)';
  };
  paint('block', 'block', colourFor('block'));
  paint('hor', 'hor', colourFor('hor'));
  paint('ver', 'ver', colourFor('ver'));
  paint('left', 'left', colourFor('left'));
  paint('right', 'right', colourFor('right'));
  paint('up', 'up', colourFor('up'));
  paint('down', 'down', colourFor('down'));
  paint('centre', 'bomb', colourFor('bomb'));

  ctx.fillStyle = dim;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('one bomb going off, and which file draws each part',
               ox, oy + cell * 5 + 16);
  ctx.fillStyle = ink;
}

function skinBuild(body) {
  const { left, right } = crPage(body, 'A bomb skin',
    'This one <b>is</b> real artwork, and it is a set: the bomb itself and ' +
    'the flame it makes. Only <code>bomb.spr</code> is required, so a skin ' +
    'that changes nothing but the bomb is <b>one file</b>.');

  const diag = crEl('canvas', 'crCanvas');
  diag.width = 320; diag.height = 340;
  left.appendChild(diag);
  left.appendChild(crEl('p', 'crCap',
    'Green is a file you have dropped in. Grey is one that falls back to ' +
    'the ordinary bomb.'));

  const playBox = crEl('div', 'crPlay');
  playBox.hidden = true;
  left.appendChild(playBox);

  crSection(right, 'The twelve files');
  right.appendChild(crHTML('p', 'crHint',
    'The names are fixed: the server looks for exactly these. Three are ' +
    'sprites (<code>.spr</code>) and nine are effects (<code>.eft</code>), ' +
    'and <b>all twelve open in this editor</b>. Each is capped at ' +
    Math.round(SKIN_MAX / 1024) + ' kB.'));

  const grid = crEl('div', 'crFiles');
  const rows = {};
  for (const [name, what, need, kind] of SKIN_FILES) {
    const row = crFileRow(grid, name, what, need);
    row.onmouseenter = () => drawSkinDiagram(diag, creator.skin, kind);
    row.onmouseleave = () => drawSkinDiagram(diag, creator.skin, null);
    rows[name] = row;
  }
  right.appendChild(grid);

  crSection(right, 'How to make one');
  crSteps(right, [
    'Open the file of the same name from a copy of the game, with ' +
      '<b>Open...</b> above. Starting from the real one means the frame ' +
      'count and the sizes already match.',
    'Recolour it with <b>Palette</b> in the sprite panel. That changes one ' +
      'colour across every frame at once, which is what a recolour wants.',
    'Watch the <b>reserved ramp</b>: 64 neutral values are repainted at ' +
      'run time. The sprite panel says how much of a sheet sits in it.',
    '<b>Save sprite</b> under the same name, then drop the files here.'
  ]);

  const out = crEl('p', 'crHint');
  const acts = crEl('div', 'crActs');

  const refresh = () => {
    let good = 0, bad = 0;
    for (const [name] of SKIN_FILES) {
      const e = creator.skin[name], row = rows[name];
      const st = row.firstChild;
      row.classList.toggle('have', !!(e && e.ok));
      row.classList.toggle('bad', !!(e && !e.ok));
      if (e) {
        st.textContent = e.ok ? e.note : 'refused';
        st.title = e.note || '';
        if (e.ok) good++; else bad++;
      } else {
        st.textContent = SKIN_FILES.find(f => f[0] === name)[2]
          ? 'needed' : 'optional';
        st.title = '';
      }
    }
    const haveBomb = creator.skin['bomb.spr'] && creator.skin['bomb.spr'].ok;
    out.className = 'crHint ' + (bad ? 'crBad' : (haveBomb ? 'crOk' : ''));
    out.textContent = good + ' file(s) ready' +
      (bad ? ', ' + bad + ' refused' : '') +
      (haveBomb ? '.' : '. bomb.spr is still missing, and the set needs it.');
    save.disabled = !good;
    drawSkinDiagram(diag, creator.skin, null);
    skinShowPlay(playBox);
  };

  const take = files => {
    for (const f of files) {
      const want = SKIN_FILES.find(s => s[0].toLowerCase() === f.name.toLowerCase());
      if (!want) {
        notify(f.name + ' is not one of the names a skin uses', 1);
        continue;
      }
      const r = new FileReader();
      r.onload = () => {
        const bytes = new Uint8Array(r.result);
        let ok = true, note = '', g = null;
        if (bytes.length > SKIN_MAX) {
          ok = false;
          note = 'over the ' + SKIN_MAX + ' byte limit';
        } else {
          try {
            g = new GRA(bytes.buffer.slice(0));
            note = g.frames.length + ' fr ' + g.width + 'x' + g.height;
          } catch (e) { ok = false; note = 'does not open'; }
        }
        creator.skin[want[0]] = { bytes: bytes, ok: ok, note: note, gra: g };
        refresh();
      };
      r.readAsArrayBuffer(f);
    }
  };

  crDrop(right, 'The files of the set', '.spr,.eft', true, take);
  right.appendChild(out);

  const save = crButton(acts, 'Export the set as a .zip', () => {
    const entries = Object.keys(creator.skin)
      .filter(n => creator.skin[n].ok)
      .map(n => ({ name: n, data: creator.skin[n].bytes }));
    if (!entries.length) { notify('nothing in the set yet', 1); return; }
    saveFile('bomb-skin.zip', zipStore(entries), 'application/zip');
  }, 'primary');
  crButton(acts, 'Clear', () => {
    creator.skin = {};
    creatorRender();
  });
  right.appendChild(acts);
  refresh();
}

/* Animate whatever has been dropped, so the set can be judged moving
   rather than as a list of names. */
function skinShowPlay(box) {
  if (creator.skinPlay) { clearInterval(creator.skinPlay); creator.skinPlay = null; }
  const ready = Object.keys(creator.skin).filter(n => creator.skin[n].ok &&
                                                     creator.skin[n].gra);
  box.innerHTML = '';
  if (!ready.length) { box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(crEl('p', 'crCap', 'What you dropped, playing:'));
  const strip = crEl('div', 'crStrip');
  const items = [];
  for (const name of ready) {
    const g = creator.skin[name].gra;
    const cell = crEl('div', 'crStripCell');
    const cv = crEl('canvas', 'crStripCanvas');
    const z = Math.max(1, Math.min(3, Math.floor(72 / Math.max(g.width, g.height))));
    cv.width = g.width * z; cv.height = g.height * z;
    cell.appendChild(cv);
    cell.appendChild(crEl('span', '', name));
    strip.appendChild(cell);
    items.push({ g, cv, z, f: 0 });
  }
  box.appendChild(strip);
  const tick = () => {
    for (const it of items) {
      const ctx = it.cv.getContext('2d');
      ctx.clearRect(0, 0, it.cv.width, it.cv.height);
      const fr = it.g.frames[it.f % it.g.frames.length];
      const rgba = fr.toRGBA(it.g.width, it.g.height);
      const img = new ImageData(new Uint8ClampedArray(rgba), it.g.width, it.g.height);
      const tmp = document.createElement('canvas');
      tmp.width = it.g.width; tmp.height = it.g.height;
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, it.cv.width, it.cv.height);
      it.f++;
    }
  };
  tick();
  creator.skinPlay = setInterval(tick, 90);
}

/* ------------------------------ a map ---------------------------- */

function mapBlank(size) {
  const s = MAP_SIZES[size];
  const starts = [[1, 1], [s.w - 2, s.h - 2], [s.w - 2, 1], [1, s.h - 2]];
  const clear = (x, y) => starts.some(p =>
    Math.abs(p[0] - x) + Math.abs(p[1] - y) <= 1);
  const cells = [];
  for (let y = 0; y < s.h; y++) {
    const row = [];
    for (let x = 0; x < s.w; x++) {
      const edge = x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      row.push(edge ? '9' : (pillar ? '2' : (clear(x, y) ? '0' : '1')));
    }
    cells.push(row);
  }
  return { size: size, theme: 1, name: 'My map', cells: cells,
           starts: starts, items: MAP_ITEMS.map(() => 2) };
}

function mapBuild(body) {
  if (!creator.map) creator.map = mapBlank(0);
  const m = creator.map;
  const s = MAP_SIZES[m.size];

  const { left, right } = crPage(body, 'A map',
    'A map is a grid, where people start, and what the breakable blocks ' +
    'hide. <b>There is no artwork in it</b>: the theme decides which set ' +
    'of tiles draws it, so you are laying out a room, not painting one.');

  const grid = crEl('div', 'crGrid');
  grid.style.gridTemplateColumns = 'repeat(' + s.w + ', var(--cell))';
  left.appendChild(grid);
  const stat = crEl('p', 'crCap');
  left.appendChild(stat);

  const legend = crEl('div', 'crLegend');
  for (const [, label, what, colour] of MAP_CELLS) {
    const it = crEl('span', 'crLegItem');
    const sw = crEl('i', 'crLegDot');
    sw.style.background = colour;
    it.appendChild(sw);
    it.appendChild(crEl('b', '', label));
    it.appendChild(crEl('span', '', what));
    legend.appendChild(it);
  }
  const st = crEl('span', 'crLegItem');
  const sd = crEl('i', 'crLegDot crLegStart');
  st.appendChild(sd);
  st.appendChild(crEl('b', '', 'Start'));
  st.appendChild(crEl('span', '', 'Where a player appears. Needs floor.'));
  legend.appendChild(st);
  left.appendChild(legend);

  crSection(right, 'The room');
  const bar = crEl('div', 'crBar');
  bar.appendChild(crEl('span', 'crLabel', 'Size'));
  const szSel = crEl('select', 'crMode');
  MAP_SIZES.forEach((o, i) => {
    const op = document.createElement('option');
    op.value = i;
    op.textContent = o.w + ' x ' + o.h + ', ' + o.players;
    szSel.appendChild(op);
  });
  szSel.value = m.size;
  szSel.onchange = () => { creator.map = mapBlank(Number(szSel.value)); creatorRender(); };
  bar.appendChild(szSel);
  bar.appendChild(crEl('span', 'crLabel', 'Theme'));
  const thSel = crEl('select', 'crMode');
  for (const [v, t] of MAP_THEMES) {
    const op = document.createElement('option');
    op.value = v; op.textContent = t;
    thSel.appendChild(op);
  }
  thSel.value = m.theme;
  thSel.onchange = () => { m.theme = Number(thSel.value); };
  bar.appendChild(thSel);
  bar.appendChild(crEl('span', 'crLabel', 'Name'));
  const nm = crEl('input', 'crName');
  nm.value = m.name;
  nm.maxLength = MAP_LIMITS.name;
  nm.oninput = () => { m.name = nm.value; };
  bar.appendChild(nm);
  right.appendChild(bar);

  crSection(right, 'Draw it');
  let brush = '1';
  const pal = crEl('div', 'crBar');
  const brushBtns = [];
  const setBrush = ch => {
    brush = ch;
    brushBtns.forEach(x => x.classList.toggle('on', x.dataset.ch === brush));
  };
  for (const [ch, label, what, colour] of MAP_CELLS) {
    const b = crEl('button', 'crBrush' + (ch === brush ? ' on' : ''));
    const d = crEl('i', 'crLegDot');
    d.style.background = colour;
    b.appendChild(d);
    b.appendChild(document.createTextNode(label));
    b.title = what;
    b.dataset.ch = ch;
    b.onclick = () => setBrush(ch);
    brushBtns.push(b);
    pal.appendChild(b);
  }
  const startBtn = crEl('button', 'crBrush');
  const sdot = crEl('i', 'crLegDot crLegStart');
  startBtn.appendChild(sdot);
  startBtn.appendChild(document.createTextNode('Start'));
  startBtn.dataset.ch = 'S';
  startBtn.title = 'click a cell to put one down or take it away';
  startBtn.onclick = () => setBrush('S');
  brushBtns.push(startBtn);
  pal.appendChild(startBtn);
  right.appendChild(pal);
  right.appendChild(crHTML('p', 'crHint',
    'Drag to paint. The rim has to stay the outer wall, and a start needs ' +
    'floor under it, so the editor refuses both rather than letting you ' +
    'make a map that will be rejected.'));

  crSection(right, 'What the blocks hide');
  right.appendChild(crHTML('p', 'crHint',
    'These go inside the breakable blocks, so there has to be room for ' +
    'them. At most ' + MAP_LIMITS.item + ' of any one.'));
  const items = crEl('div', 'crItems');
  MAP_ITEMS.forEach((label, i) => {
    const w = crEl('label', 'crItem');
    w.appendChild(crEl('span', '', label));
    const n = crEl('input', 'crNum');
    n.type = 'number'; n.min = '0'; n.max = String(MAP_LIMITS.item);
    n.value = m.items[i];
    n.oninput = () => {
      m.items[i] = Math.max(0, Math.min(MAP_LIMITS.item, Number(n.value) | 0));
      drawGrid();
    };
    w.appendChild(n);
    items.appendChild(w);
  });
  right.appendChild(items);

  crSection(right, 'What you hand over');
  right.appendChild(crHTML('p', 'crHint',
    'One file, <code>map.json</code>: the layout as a single string of ' +
    (s.w * s.h) + ' characters, the starts, the item counts and the theme. ' +
    'A map may also bring its own block tiles, one picture <b>' +
    MAP_LIMITS.blockW + '</b> wide with rows <b>' + MAP_LIMITS.blockH[0] +
    ' to ' + MAP_LIMITS.blockH[1] + '</b> tall and at most ' +
    Math.round(MAP_LIMITS.block / 1024) + ' kB, and its own scenery, which ' +
    'is the next page.'));

  const acts = crEl('div', 'crActs');
  crButton(acts, 'Save map.json', () => {
    saveFile('map.json', JSON.stringify({
      name: m.name.slice(0, MAP_LIMITS.name),
      size: m.size, theme: m.theme,
      layout: m.cells.map(r => r.join('')).join(''),
      starts: m.starts, items: m.items, made_with: 'MXW Studio'
    }, null, 1), 'application/json');
  }, 'primary');
  crButton(acts, 'Start again', () => {
    creator.map = mapBlank(m.size);
    creatorRender();
  });
  right.appendChild(acts);

  function drawGrid() {
    let i = 0;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const c = grid.children[i++];
        c.className = 'crCell c' + m.cells[y][x];
        if (m.starts.some(p => p[0] === x && p[1] === y)) c.className += ' start';
      }
    }
    let soft = 0;
    for (const row of m.cells) for (const v of row) if (v === '1') soft++;
    const need = m.items.reduce((a, b) => a + b, 0);
    const wrong = m.starts.length < 2 || need > soft;
    stat.className = 'crCap ' + (wrong ? 'crBad' : 'crOk');
    stat.textContent = m.starts.length + ' start(s) of up to ' + s.starts +
      ', ' + soft + ' breakable block(s), ' + need + ' item(s) inside them' +
      (need > soft ? '. More items than blocks to hide them in.' : '') +
      (m.starts.length < 2 ? '. At least two starts are needed.' : '');
  }

  const paint = (x, y) => {
    if (brush === 'S') {
      const at = m.starts.findIndex(p => p[0] === x && p[1] === y);
      if (at >= 0) m.starts.splice(at, 1);
      else if (m.cells[y][x] !== '0') notify('a start needs floor under it', 1);
      else if (m.starts.length >= s.starts)
        notify('this size takes at most ' + s.starts + ' starts', 1);
      else m.starts.push([x, y]);
    } else {
      const edge = x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1;
      if (edge) { notify('the rim has to stay the outer wall', 1); return; }
      if (brush === '9') { notify('the outer wall only goes around the rim', 1); return; }
      m.cells[y][x] = brush;
      const at = m.starts.findIndex(p => p[0] === x && p[1] === y);
      if (at >= 0 && brush !== '0') m.starts.splice(at, 1);
    }
    drawGrid();
  };

  let down = false;
  document.addEventListener('mouseup', () => { down = false; });
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const c = crEl('i', 'crCell');
      const cx = x, cy = y;
      c.onmousedown = e => { e.preventDefault(); down = true; paint(cx, cy); };
      c.onmouseenter = () => { if (down && brush !== 'S') paint(cx, cy); };
      grid.appendChild(c);
    }
  }
  drawGrid();
}

/* ----------------------------- scenery --------------------------- */

function sideBuild(body) {
  const { left, right } = crPage(body, 'Scenery',
    'The picture drawn <b>around</b> the arena. The grid sits on top of it, ' +
    'in the middle, so the part of your picture that shows is the border. ' +
    '<b>One file</b>, a PNG, at one of three exact sizes.');

  const cv = crEl('canvas', 'crCanvas');
  cv.width = 340; cv.height = 260;
  left.appendChild(cv);
  const cap = crEl('p', 'crCap',
    'The dark rectangle is where the arena covers your picture. Paint ' +
    'outside it.');
  left.appendChild(cap);

  let pick = 0;
  const draw = img => {
    const ctx = cv.getContext('2d');
    const s = SIDE_SIZES[pick];
    ctx.clearRect(0, 0, cv.width, cv.height);
    const k = Math.min((cv.width - 20) / s.w, (cv.height - 20) / s.h);
    const w = s.w * k, h = s.h * k;
    const ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, ox, oy, w, h);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(ox, oy, w, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + .5, oy + .5, w - 1, h - 1);
    /* the arena: the cell grid centred in the screen */
    const cell = Math.min(w / (s.cw + 4), h / (s.ch + 3));
    const aw = cell * s.cw, ah = cell * s.ch;
    const ax = ox + (w - aw) / 2, ay = oy + (h - ah) / 2;
    ctx.fillStyle = 'rgba(6,9,16,.76)';
    ctx.fillRect(ax, ay, aw, ah);
    ctx.strokeStyle = '#3ecb8a';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ax + .5, ay + .5, aw - 1, ah - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = '#9aa7bd';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('the arena, ' + s.cells, ax + aw / 2, ay + ah / 2 + 4);
    ctx.textAlign = 'left';
    ctx.fillText(s.w + ' x ' + s.h, ox, oy - 6);
  };

  crSection(right, 'Which size');
  right.appendChild(crHTML('p', 'crHint',
    'A map uses only the size that matches it, so make the one you need. ' +
    'Nothing is scaled: paint at the size it will be shown. Up to ' +
    Math.round(SIDE_MAX / 1048576) + ' MB.'));
  const sizes = crEl('div', 'crFiles');
  const rows = SIDE_SIZES.map((s, i) => {
    const row = crEl('div', 'crFile' + (i === pick ? ' have' : ''));
    row.appendChild(crEl('span', 'crState', s.w + ' x ' + s.h));
    row.appendChild(crEl('code', '', s.cells + ' cells'));
    row.appendChild(crEl('span', 'crWhat', s.players + ' players'));
    row.style.cursor = 'pointer';
    row.onclick = () => {
      pick = i;
      rows.forEach((r, j) => r.classList.toggle('have', j === pick));
      draw(creator.side);
    };
    sizes.appendChild(row);
    return row;
  });
  right.appendChild(sizes);

  crSection(right, 'Check it before you send it');
  const out = crEl('p', 'crHint');
  crDrop(right, 'Your scenery', 'image/*', false, files => {
    const file = files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const hit = SIDE_SIZES.findIndex(s => s.w === img.width && s.h === img.height);
      const big = file.size > SIDE_MAX;
      if (hit >= 0) {
        pick = hit;
        rows.forEach((r, j) => r.classList.toggle('have', j === pick));
      }
      creator.side = img;
      draw(img);
      out.className = 'crHint ' + (hit >= 0 && !big ? 'crOk' : 'crBad');
      out.textContent = hit >= 0
        ? (big ? 'The size is right but the file is ' +
                 (Math.round(file.size / 1048576 * 10) / 10) + ' MB, over the limit.'
               : 'Good: ' + img.width + ' x ' + img.height + ', the ' +
                 SIDE_SIZES[hit].cells + ' size, ' +
                 Math.round(file.size / 1024) + ' kB.')
        : img.width + ' x ' + img.height + ' is not one of the sizes. It has ' +
          'to be exactly ' + SIDE_SIZES.map(s => s.w + ' x ' + s.h).join(', ') + '.';
    };
    img.onerror = () => {
      out.className = 'crHint crBad';
      out.textContent = 'that file is not an image this browser can read';
    };
    img.src = URL.createObjectURL(file);
  });
  right.appendChild(out);
  draw(creator.side);
}

/* ---------------------------- characters ------------------------- */

function charBuild(body) {
  const { left, right } = crPage(body, 'A character',
    'The big one. A costume recolours the White and the server draws it; ' +
    'a character is <b>its own drawing in every pose and every facing</b>. ' +
    'About forty files, and they all have to agree with one another.');

  const cv = crEl('canvas', 'crCanvas');
  cv.width = 320; cv.height = 300;
  left.appendChild(cv);
  left.appendChild(crEl('p', 'crCap',
    'Each square is one file. Four across means one per facing: east, ' +
    'north, south, west.'));
  drawCharMap(cv);

  crSection(right, 'What the set is');
  right.appendChild(crHTML('p', 'crHint',
    'A character is a folder. The name of each file says the action and ' +
    'the direction, so <code>mo_s</code> is walking while facing south. ' +
    'Four of these sets are a single file rather than four.'));

  const grid = crEl('div', 'crFiles');
  for (const [key, label, what, perFacing, core] of CHAR_SETS) {
    const row = crEl('div', 'crFile' + (core ? ' have' : ''));
    row.appendChild(crEl('span', 'crState', perFacing ? '4 files' : '1 file'));
    row.appendChild(crEl('code', '',
      perFacing ? key + '_e  ' + key + '_n  ' + key + '_s  ' + key + '_w' : key));
    row.appendChild(crEl('span', 'crWhat', label + (what ? '. ' + what : '')));
    grid.appendChild(row);
  }
  right.appendChild(grid);
  right.appendChild(crHTML('p', 'crHint',
    'The rows marked green are the ones people actually look at. If you ' +
    'only ever finish those, the character still works.'));

  crSection(right, 'Two rules that catch everyone');
  crSteps(right, [
    '<b>Sixty-four colours are not yours.</b> A neutral ramp from black to ' +
      'white, 64 steps, is repainted at run time with the team colour. ' +
      'Paint in it on purpose for the parts that should follow the team; ' +
      'paint in it by accident and that part changes colour in play. The ' +
      'sprite panel reports how much of a sheet sits in the ramp, and ' +
      '<b>Nudge off the ramp</b> moves a colour out of it.',
    '<b>Keep a frame at or under 64 x 80.</b> The original tool reports ' +
      'the game failing to start on frames much past that, with trouble ' +
      'around 60 x 100. Files that already ship larger are fine; newly ' +
      'grown ones may not be.'
  ]);

  crSection(right, 'A way in that is not forty files');
  crSteps(right, [
    'Open an existing character of a similar build with <b>Open...</b>. ' +
      'Every frame is then already the right size and the ramp is already ' +
      'where it belongs.',
    'Recolour the whole thing first with <b>Palette</b>, and watch it ' +
      'move, before touching a single pixel.',
    'Then repaint the two sets that carry the character: <b>standing</b> ' +
      'and the <b>portrait</b>. Those decide whether people recognise it.',
    'Leave the mounted sets until last. Least seen, fiddliest.'
  ]);
  right.appendChild(crHTML('p', 'crHint',
    'There is <b>no import for a whole character</b> at the other end yet, ' +
    'so a finished one is handed over as its folder. Worth asking before ' +
    'starting a big one.'));
}

function drawCharMap(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const dim = css.getPropertyValue('--dim').trim() || '#889';
  const ink = css.getPropertyValue('--ink').trim() || '#fff';
  const cw = 46, ch = 20, gap = 5;
  let y = 8;
  ctx.font = '11px system-ui, sans-serif';
  for (const [key, label, , perFacing, core] of CHAR_SETS) {
    const n = perFacing ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const x = 96 + i * (cw + gap);
      ctx.fillStyle = core ? 'rgba(62,203,138,.26)' : 'rgba(255,255,255,.07)';
      ctx.strokeStyle = core ? 'rgba(62,203,138,.6)' : 'rgba(255,255,255,.16)';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeRect(x + .5, y + .5, cw - 1, ch - 1);
      ctx.fillStyle = core ? ink : dim;
      ctx.textAlign = 'center';
      ctx.fillText(perFacing ? key + '_' + 'ensw'[i] : key, x + cw / 2, y + 14);
    }
    ctx.fillStyle = dim;
    ctx.textAlign = 'right';
    ctx.fillText(label, 88, y + 14);
    y += ch + gap;
  }
  ctx.textAlign = 'left';
}

/* ----------------------------- the shell ------------------------- */

const CREATOR_TRACKS = [
  ['costume', 'A costume', 'recolour the White', '1 file', costumeBuild],
  ['skin', 'A bomb skin', 'the bomb and its flame', 'up to 12', skinBuild],
  ['map', 'A map', 'the grid and the items', '1 file', mapBuild],
  ['side', 'Scenery', 'the border around it', '1 file', sideBuild],
  ['char', 'A character', 'the whole set', 'about 40', charBuild]
];

function creatorRender() {
  const nav = $('crNav'), body = $('crBody');
  if (!nav || !body) return;
  if (creator.skinPlay) { clearInterval(creator.skinPlay); creator.skinPlay = null; }
  nav.innerHTML = '';
  CREATOR_TRACKS.forEach(([id, title, blurb, count]) => {
    const b = document.createElement('button');
    b.className = id === creator.track ? 'on' : '';
    const t = crEl('span', 'crT', title);
    const s = crEl('span', 'crB', blurb);
    const c = crEl('span', 'crCount', count);
    b.appendChild(t); b.appendChild(s); b.appendChild(c);
    b.onclick = () => { creator.track = id; creatorRender(); };
    nav.appendChild(b);
  });
  body.innerHTML = '';
  body.scrollTop = 0;
  const track = CREATOR_TRACKS.find(t => t[0] === creator.track);
  if (track) track[4](body);
  if (typeof i18nApply === 'function') i18nApply(body);
}

function creatorOpen(id) {
  if (id) creator.track = id;
  $('cr').hidden = false;
  creatorRender();
}

function creatorClose() {
  if (creator.skinPlay) { clearInterval(creator.skinPlay); creator.skinPlay = null; }
  $('cr').hidden = true;
}

function creatorWire() {
  const b = $('bCreate');
  if (b) b.onclick = () => creatorOpen();
  const x = $('crX');
  if (x) x.onclick = creatorClose;
  const panel = $('cr');
  if (panel) panel.addEventListener('click', e => {
    if (e.target === panel) creatorClose();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('cr') && !$('cr').hidden) creatorClose();
  });
}
