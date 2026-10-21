/* creator.js -- the Create panel: what the server accepts, and how to
   hand it something it will take.

   The editor can already open and write every format involved. What it
   could not do is tell you *which* files a given piece of content needs,
   how big they may be, and what the receiving end checks. That is the
   whole difficulty for someone making their first costume or bomb skin,
   and it is what this panel is for: pick what you are making, follow the
   steps, and leave with exactly the files to hand over.

   The names and numbers below are the receiving end's own, read from a
   live panel rather than guessed. Where something is a judgement rather
   than a measurement it says so.

   ASCII only: these files are served without a charset. */

/* --------------------------- the contract ------------------------ */

/* A costume is not artwork. The server keeps ten parts, each with a
   colour and some of them a pattern, and generates the sheets from the
   White's own shape. So what a maker hands over is either a painted
   copy of the template picture or this spec, and the spec is smaller,
   exact, and easy to review. */

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

/* The five the panel shows while you work. The save makes 37. */
const COSTUME_PREVIEWED = ['st_s', 'mo_s', 'mo_e', 'mo_n', 'mo_w'];
const COSTUME_SHEET_COUNT = 37;

/* The template picture: 432 x 640, with a 16 x 16 pure magenta square
   set 8 pixels in from each corner. Those four squares are how the
   receiving end finds the figure, so a picture missing one, or cropped
   past them, is refused. A larger copy is fine, because it rectifies by
   the corners, which is why the check below measures them rather than
   the picture. */
const COSTUME_TEMPLATE = { w: 432, h: 640, mark: 16, inset: 8, key: '#ff00ff' };

/* A bomb skin is real artwork: these file names, nothing else. The
   three sprites are the bomb itself; the nine effects are the flame it
   makes. Every one of them opens in this editor. */
const SKIN_FILES = [
  ['bomb.spr', 'the bomb resting and appearing', true],
  ['bomb_d.spr', 'the bomb about to go off', false],
  ['bomb_s.spr', 'the bomb while it slides', false],
  ['bomb_f.eft', 'the fuse', false],
  ['flame_center.eft', 'the blast under the bomb', false],
  ['flame_hor.eft', 'the arm running left and right', false],
  ['flame_ver.eft', 'the arm running up and down', false],
  ['flame_left.eft', 'the tip of the left arm', false],
  ['flame_right.eft', 'the tip of the right arm', false],
  ['flame_up.eft', 'the tip of the upward arm', false],
  ['flame_down.eft', 'the tip of the downward arm', false],
  ['boom_block.eft', 'a block breaking', false]
];
const SKIN_MAX = 524288;

/* Maps. The layout is one character per cell, row by row. */
const MAP_SIZES = [
  { size: 0, w: 17, h: 15, pw: 800, ph: 600, starts: 6, players: 'up to 6' },
  { size: 1, w: 21, h: 17, pw: 960, ph: 694, starts: 12, players: '7 to 12' },
  { size: 2, w: 25, h: 19, pw: 1120, ph: 770, starts: 12, players: '12' }
];
const MAP_CELLS = [
  ['9', 'Edge', 'the outer wall, only around the rim'],
  ['2', 'Pillar', 'solid, never breaks'],
  ['1', 'Block', 'breakable, hides the items'],
  ['0', 'Floor', 'walkable']
];
const MAP_THEMES = [
  [1, 'Standard'], [2, 'Pyramid'], [3, 'Laboratory'], [4, 'Village'],
  [5, 'Iceberg'], [6, 'Road'], [7, 'ToyBox']
];
const MAP_ITEMS = ['Fire', 'Speed', 'Bomb', 'Kick', 'Glove', 'Skull', 'Vest',
  'Full fire', 'Louie', 'Punch', 'Line bomb', 'Pierce bomb', 'Water bomb'];
const MAP_LIMITS = { name: 20, item: 40, picture: 5242880, block: 262144,
  side: 4194304, blockW: 40, blockH: [20, 76] };

/* Side scenery: the frame drawn around the arena. One picture per
   screen size, and the arena sits in the middle of it. */
const SIDE_SIZES = MAP_SIZES.map(s => ({ w: s.pw, h: s.ph, players: s.players,
  cells: s.w + ' x ' + s.h }));
const SIDE_MAX = 4194304;

/* --------------------------- a zip writer ------------------------ */

/* Store-only, which is all that is needed to hand over a dozen small
   files and keeps this dependency-free. */

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
  const parts = [];
  const central = [];
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

/* ----------------------------- the panel ------------------------- */

const creator = {
  track: 'costume',
  costume: null,       /* the spec being built */
  picture: null,       /* a checked picture, once one passes */
  skin: {},            /* name -> {bytes, note, ok} */
  map: null            /* {size, theme, name, cells, starts, items} */
};

function crEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function crNote(parent, html) {
  const p = crEl('p', 'hint');
  p.innerHTML = html;
  parent.appendChild(p);
}

function crSteps(parent, steps) {
  const ol = crEl('ol', 'crSteps');
  for (const s of steps) {
    const li = document.createElement('li');
    li.innerHTML = s;
    ol.appendChild(li);
  }
  parent.appendChild(ol);
}

function crButton(parent, text, fn, cls) {
  const b = crEl('button', cls || '', text);
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}

function crDrop(parent, label, accept, multiple, take) {
  const drop = crEl('div', 'crDrop', label);
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

  body.appendChild(crEl('h3', '', 'A costume'));
  crNote(body, "A costume is not a drawing. The server keeps ten parts, each " +
    "with a colour and some of them a pattern, and makes the " +
    COSTUME_SHEET_COUNT + " sheets itself from the White's own shape. So what " +
    "you hand over is either a painted copy of the template picture or the " +
    "small file this page writes. The shape never changes: a hat, hair or a " +
    "cape outside the White's outline is not drawn.");

  body.appendChild(crEl('h4', '', 'The ten parts'));
  const tbl = crEl('div', 'crParts');
  for (const [id, label, patterned] of COSTUME_PARTS) {
    const p = spec.parts[id];
    const row = crEl('div', 'crPart');
    row.appendChild(crEl('span', 'crPartName', label));

    const mode = crEl('select', 'crMode');
    const opts = [['keep', "Keep the White's"], ['own', 'Colour']];
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

    mode.onchange = () => {
      if (mode.value === 'keep') p.colour = null;
      else if (mode.value === 'own') p.colour = pick.value;
      else p.colour = mode.value.slice(4);
      pick.style.visibility = mode.value === 'own' ? '' : 'hidden';
      costumeSummary();
    };
    pick.oninput = () => { p.colour = pick.value; costumeSummary(); };
    row.appendChild(mode);
    row.appendChild(pick);

    if (patterned) {
      const pat = crEl('select', 'crMode');
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
      pat.onchange = () => { p.pattern = pat.value; costumeSummary(); };
      pc.oninput = () => { p.colour2 = pc.value; costumeSummary(); };
      sz.oninput = () => { p.size = Number(sz.value); costumeSummary(); };
      an.oninput = () => { p.angle = Number(an.value); costumeSummary(); };
      row.appendChild(pat); row.appendChild(pc);
      row.appendChild(sz); row.appendChild(an);
    } else {
      row.appendChild(crEl('span', 'crNone', 'no pattern'));
    }
    tbl.appendChild(row);
  }
  body.appendChild(tbl);
  crNote(body, 'The four boxes on a patterned part are, in order: the ' +
    'pattern, the colour it is drawn in, how big it is, and the angle it ' +
    'runs at. Bandages at a small size is how the mummy is made.');

  body.appendChild(crEl('h4', '', 'Two extras'));
  const ex = crEl('div', 'crParts');
  const r1 = crEl('div', 'crPart');
  const cbe = crEl('input'); cbe.type = 'checkbox'; cbe.checked = spec.ends.on;
  cbe.onchange = () => { spec.ends.on = cbe.checked; costumeSummary(); };
  r1.appendChild(cbe);
  r1.appendChild(crEl('span', '', 'Loose ends beside the head: a headband, a ' +
    'trailing bandage'));
  ex.appendChild(r1);
  const r2 = crEl('div', 'crPart');
  const cbh = crEl('input'); cbh.type = 'checkbox'; cbh.checked = spec.hair.on;
  const hc = crEl('input', 'crColour'); hc.type = 'color';
  hc.value = spec.hair.colour;
  cbh.onchange = () => { spec.hair.on = cbh.checked; costumeSummary(); };
  hc.oninput = () => { spec.hair.colour = hc.value; costumeSummary(); };
  r2.appendChild(cbh);
  r2.appendChild(crEl('span', '', 'Hair under the helmet'));
  r2.appendChild(hc);
  ex.appendChild(r2);
  body.appendChild(ex);

  body.appendChild(crEl('h4', '', 'What you get'));
  const out = crEl('pre', 'crOut');
  out.id = 'crCostumeOut';
  body.appendChild(out);

  const acts = crEl('div', 'crActs');
  crButton(acts, 'Save costume.json', () => {
    const name = (prompt('Name for the costume', 'My costume') || '').trim();
    if (!name) return;
    const doc = { name: name, spec: creator.costume,
                  made_with: 'MXW Studio', sheets: COSTUME_SHEET_COUNT };
    saveFile('costume.json', JSON.stringify(doc, null, 1), 'application/json');
  }, 'primary');
  crButton(acts, 'Start again', () => {
    creator.costume = costumeBlank();
    creatorRender();
  });
  body.appendChild(acts);

  body.appendChild(crEl('h4', '', 'Or hand over a picture instead'));
  crSteps(body, [
    'Get <code>costume-template.png</code> from whoever runs the server. It ' +
      'is ' + COSTUME_TEMPLATE.w + ' x ' + COSTUME_TEMPLATE.h + '.',
    'Paint each part over it in flat colour. The shading is added later, so ' +
      'flat reads better than shaded.',
    'Leave the four magenta squares alone and do not crop. A bigger copy is ' +
      'fine: the squares are how the figure is found.',
    "A part you leave untouched stays the White's. Erase the pompom or the " +
      'antenna to leave it off altogether.',
    'Drop it below. This checks the four squares before you send it anywhere.'
  ]);
  const picOut = crEl('p', 'hint');
  crDrop(body, 'Drop the painted picture here', 'image/*', false,
         files => costumeTakePicture(files[0], picOut));
  body.appendChild(picOut);
  costumeSummary();
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
    if (p.colour === null) bits.push("the White's own");
    else if (/^#/.test(p.colour)) { bits.push(p.colour); changed++; }
    else { bits.push('same as the ' + p.colour); changed++; }
    if (patterned && p.pattern !== 'plain') {
      bits.push(p.pattern + ' in ' + p.colour2 + ', size ' + p.size +
                ', ' + p.angle + ' degrees');
      changed++;
    }
    lines.push(label.padEnd(20, ' ') + bits.join(', '));
  }
  if (spec.ends.on) { lines.push('loose ends'.padEnd(20, ' ') + 'on'); changed++; }
  if (spec.hair.on) { lines.push('hair'.padEnd(20, ' ') + spec.hair.colour); changed++; }
  lines.push('');
  lines.push(changed ? changed + ' thing(s) changed from the White'
                     : 'nothing changed yet: this is the White as it is');
  lines.push('the server makes ' + COSTUME_SHEET_COUNT + ' sheets from this; ' +
             'the page shows ' + COSTUME_PREVIEWED.join(', '));
  out.textContent = lines.join('\n');
}

/* Find the four registration squares and say whether the picture will
   be accepted. This is the one check worth doing before sending: a
   cropped picture is the usual reason a costume comes back wrong. */
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
    return { ok: false, why: 'the picture has been stretched: ' +
             sx.toFixed(2) + ' times across and ' + sy.toFixed(2) +
             ' times down. Scale both the same way.' };
  return { ok: true, scale: sx, size: c.width + ' x ' + c.height };
}

function costumeTakePicture(file, out) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const r = costumeCheckPicture(img);
    creator.picture = r.ok ? { name: file.name, scale: r.scale } : null;
    out.className = r.ok ? 'hint crOk' : 'hint crBad';
    out.textContent = r.ok
      ? 'Good: ' + file.name + ', ' + r.size + ', the four squares are there' +
        (Math.abs(r.scale - 1) < 0.01 ? " at the template's own size."
          : ' at ' + r.scale.toFixed(2) + ' times the template, which is fine.')
      : 'This will not import: ' + r.why;
  };
  img.onerror = () => {
    out.className = 'hint crBad';
    out.textContent = 'that file is not an image this browser can read';
  };
  img.src = URL.createObjectURL(file);
}

/* ----------------------------- bomb skin ------------------------- */

function skinBuild(body) {
  body.appendChild(crEl('h3', '', 'A bomb skin'));
  crNote(body, 'This one is real artwork, and it is a set: three sprites for ' +
    'the bomb and nine effects for the flame it makes. The names are fixed. ' +
    'Only <b>bomb.spr</b> is required, so a skin that changes nothing but the ' +
    'bomb is one file.');

  crSteps(body, [
    'Open an existing file of the same name from a copy of the game, so the ' +
      'frame count and the sizes already match.',
    'Recolour or repaint it here. <b>Palette</b> changes one colour across ' +
      'every frame at once, which is what a recolour usually wants.',
    'Watch the reserved ramp. Anything painted in those 64 neutral values is ' +
      'repainted at run time; the sprite panel reports how much of a sheet ' +
      'sits in it.',
    'Save each file back under its own name, then drop them all here.',
    'Export the set. Every file is checked for its name, its size and whether ' +
      'it still parses.'
  ]);

  const grid = crEl('div', 'crFiles');
  for (const [name, what, need] of SKIN_FILES) {
    const row = crEl('div', 'crFile');
    row.dataset.name = name;
    row.appendChild(crEl('span', 'crState', need ? 'needed' : 'optional'));
    row.appendChild(crEl('code', '', name));
    row.appendChild(crEl('span', 'crWhat', what));
    grid.appendChild(row);
  }
  body.appendChild(grid);

  const out = crEl('p', 'hint');
  const acts = crEl('div', 'crActs');

  const refresh = () => {
    let good = 0, bad = 0;
    for (const row of grid.children) {
      const e = creator.skin[row.dataset.name];
      const st = row.firstChild;
      row.classList.toggle('have', !!(e && e.ok));
      row.classList.toggle('bad', !!(e && !e.ok));
      if (e) {
        st.textContent = e.ok ? (e.bytes.length + ' B') : 'refused';
        st.title = e.note || '';
        if (e.ok) good++; else bad++;
      } else {
        const need = SKIN_FILES.find(f => f[0] === row.dataset.name)[2];
        st.textContent = need ? 'needed' : 'optional';
        st.title = '';
      }
    }
    const haveBomb = creator.skin['bomb.spr'] && creator.skin['bomb.spr'].ok;
    out.className = 'hint ' + (bad ? 'crBad' : (haveBomb ? 'crOk' : ''));
    out.textContent = good + ' file(s) ready' +
      (bad ? ', ' + bad + ' refused' : '') +
      (haveBomb ? '.' : '. bomb.spr is still missing, and the set needs it.');
    save.disabled = !good;
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
        let ok = true, note = '';
        if (bytes.length > SKIN_MAX) {
          ok = false;
          note = 'over the ' + SKIN_MAX + ' byte limit, so it would be refused';
        } else {
          try {
            const g = new GRA(bytes.buffer.slice(0));
            note = g.frames.length + ' frames, ' + g.width + ' x ' + g.height +
                   (g.eft ? ', ' + g.eft.groups + ' groups' : '');
          } catch (e) {
            ok = false;
            note = 'does not open: ' + e.message;
          }
        }
        creator.skin[want[0]] = { bytes: bytes, ok: ok, note: note };
        refresh();
      };
      r.readAsArrayBuffer(f);
    }
  };

  crDrop(body, 'Drop the files of the set here, all at once is fine',
         '.spr,.eft', true, take);
  body.appendChild(out);

  const save = crButton(acts, 'Export the set as a .zip', () => {
    const entries = Object.keys(creator.skin)
      .filter(n => creator.skin[n].ok)
      .map(n => ({ name: n, data: creator.skin[n].bytes }));
    if (!entries.length) { notify('nothing in the set yet', 1); return; }
    saveFile('bomb-skin.zip', zipStore(entries), 'application/zip');
  }, 'primary');
  crButton(acts, 'Clear', () => { creator.skin = {}; creatorRender(); });
  body.appendChild(acts);
  refresh();
}

/* ------------------------------ a map ---------------------------- */

/* A usable map rather than an empty one: the rim, the fixed pillars,
   breakable blocks everywhere else, and the corner each player starts
   in left clear so nobody opens the round boxed in. */
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

  body.appendChild(crEl('h3', '', 'A map'));
  crNote(body, 'A map is a grid of cells, where people start, and which items ' +
    'the breakable blocks hide. There is no artwork in it: the theme decides ' +
    'which set of tiles draws it.');

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
  szSel.onchange = () => {
    creator.map = mapBlank(Number(szSel.value));
    creatorRender();
  };
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
  body.appendChild(bar);

  let brush = '1';
  const pal = crEl('div', 'crBar');
  pal.appendChild(crEl('span', 'crLabel', 'Draw'));
  const brushBtns = [];
  const setBrush = ch => {
    brush = ch;
    brushBtns.forEach(x => x.classList.toggle('on', x.dataset.ch === brush));
  };
  for (const [ch, label, what] of MAP_CELLS) {
    const b = crEl('button', 'crBrush' + (ch === brush ? ' on' : ''), label);
    b.title = what;
    b.dataset.ch = ch;
    b.onclick = () => setBrush(ch);
    brushBtns.push(b);
    pal.appendChild(b);
  }
  const startBtn = crEl('button', 'crBrush', 'Start point');
  startBtn.dataset.ch = 'S';
  startBtn.title = 'click a cell to put one down or take it away';
  startBtn.onclick = () => setBrush('S');
  brushBtns.push(startBtn);
  pal.appendChild(startBtn);
  body.appendChild(pal);

  const grid = crEl('div', 'crGrid');
  grid.style.gridTemplateColumns = 'repeat(' + s.w + ', 18px)';
  const stat = crEl('p', 'hint');

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
    stat.className = 'hint ' + (wrong ? 'crBad' : 'crOk');
    stat.textContent = m.starts.length + ' start point(s) of up to ' +
      s.starts + ', ' + soft + ' breakable block(s), ' + need +
      ' item(s) hidden in them' +
      (need > soft ? '. More items than blocks to hide them in.' : '') +
      (m.starts.length < 2 ? '. At least two start points are needed.' : '');
  }

  const paint = (x, y) => {
    if (brush === 'S') {
      const at = m.starts.findIndex(p => p[0] === x && p[1] === y);
      if (at >= 0) m.starts.splice(at, 1);
      else if (m.cells[y][x] !== '0') notify('a start point needs floor under it', 1);
      else if (m.starts.length >= s.starts)
        notify('this size takes at most ' + s.starts + ' start points', 1);
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
  body.appendChild(grid);
  body.appendChild(stat);

  body.appendChild(crEl('h4', '', 'What the blocks hide'));
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
  body.appendChild(items);

  const acts = crEl('div', 'crActs');
  crButton(acts, 'Save map.json', () => {
    const doc = {
      name: m.name.slice(0, MAP_LIMITS.name),
      size: m.size,
      theme: m.theme,
      layout: m.cells.map(r => r.join('')).join(''),
      starts: m.starts,
      items: m.items,
      made_with: 'MXW Studio'
    };
    saveFile('map.json', JSON.stringify(doc, null, 1), 'application/json');
  }, 'primary');
  crButton(acts, 'Start again', () => {
    creator.map = mapBlank(m.size);
    creatorRender();
  });
  body.appendChild(acts);
  drawGrid();

  crNote(body, 'A map can also carry its own block tiles and its own scenery. ' +
    'The tiles are one picture ' + MAP_LIMITS.blockW + ' wide, each row ' +
    MAP_LIMITS.blockH[0] + ' to ' + MAP_LIMITS.blockH[1] + ' tall, at most ' +
    Math.round(MAP_LIMITS.block / 1024) + ' kB. The scenery is on the ' +
    'Scenery page here.');
}

/* ----------------------------- scenery --------------------------- */

function sideBuild(body) {
  body.appendChild(crEl('h3', '', 'Scenery around the arena'));
  crNote(body, 'One picture per screen size. The arena is drawn on top of it, ' +
    'in the middle, so the part of the picture that shows is the border. ' +
    'Nothing is scaled: paint it at the size it will be shown.');

  const tbl = crEl('div', 'crFiles');
  for (const s of SIDE_SIZES) {
    const row = crEl('div', 'crFile');
    row.appendChild(crEl('span', 'crState', s.w + ' x ' + s.h));
    row.appendChild(crEl('code', '', s.cells + ' cells'));
    row.appendChild(crEl('span', 'crWhat', s.players + ' players'));
    tbl.appendChild(row);
  }
  body.appendChild(tbl);

  crSteps(body, [
    'Pick the size you are making. A map only uses the one that matches it.',
    'Paint at that exact size, as a PNG, up to ' +
      Math.round(SIDE_MAX / 1048576) + ' MB.',
    'Drop it below to check it before you hand it over.'
  ]);

  const out = crEl('p', 'hint');
  crDrop(body, 'Drop the scenery here', 'image/*', false, files => {
    const file = files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const hit = SIDE_SIZES.find(s => s.w === img.width && s.h === img.height);
      const big = file.size > SIDE_MAX;
      out.className = 'hint ' + (hit && !big ? 'crOk' : 'crBad');
      out.textContent = hit
        ? (big ? 'The size is right but the file is ' +
                 (Math.round(file.size / 1048576 * 10) / 10) +
                 ' MB, over the limit.'
               : 'Good: ' + img.width + ' x ' + img.height + ', the ' +
                 hit.cells + ' size, ' + Math.round(file.size / 1024) + ' kB.')
        : img.width + ' x ' + img.height + ' is not one of the sizes. It has ' +
          'to be exactly ' + SIDE_SIZES.map(s => s.w + ' x ' + s.h).join(', ') + '.';
    };
    img.onerror = () => {
      out.className = 'hint crBad';
      out.textContent = 'that file is not an image this browser can read';
    };
    img.src = URL.createObjectURL(file);
  });
  body.appendChild(out);
}

/* ---------------------------- characters ------------------------- */

function charBuild(body) {
  body.appendChild(crEl('h3', '', 'A character of your own'));
  crNote(body, 'Worth knowing what this costs before starting. A costume ' +
    'recolours the White and the server draws it. A character is its own ' +
    'drawing in every pose and every facing, and they all have to agree with ' +
    'one another.');

  body.appendChild(crEl('h4', '', 'The files'));
  const sets = [
    ['st_e st_n st_s st_w', 'standing, one per facing. It breathes rather ' +
      'than holding still.'],
    ['mo_e mo_n mo_s mo_w', 'walking, one per facing. The longest of them.'],
    ['add', 'an idle flourish while stopped'],
    ['dd', 'the death, which travels a long way across the frame'],
    ['face', 'the portrait at the top of the screen'],
    ['pu_e pu_n pu_s pu_w', 'punching a bomb'],
    ['pa_e pa_n pa_s pa_w', 'being hit by one'],
    ['msb_ch_e .. _w', 'riding'],
    ['rui_st_e .. _w', 'mounted and standing'],
    ['rui_mo_e .. _w', 'mounted and walking'],
    ['rui_ju_e .. _w', 'mounting. The original manual marks these as ' +
      'possibly unused.']
  ];
  const tbl = crEl('div', 'crFiles');
  for (const [names, what] of sets) {
    const row = crEl('div', 'crFile');
    row.appendChild(crEl('span', 'crState', ''));
    row.appendChild(crEl('code', '', names));
    row.appendChild(crEl('span', 'crWhat', what));
    tbl.appendChild(row);
  }
  body.appendChild(tbl);
  crNote(body, 'About forty files. They have to share a silhouette, a palette ' +
    'and the same use of the reserved ramp, or the character reads as a ' +
    'different one depending on which way it faces.');

  body.appendChild(crEl('h4', '', 'Two rules that are easy to miss'));
  crSteps(body, [
    '<b>Sixty-four colours are not yours.</b> A neutral ramp from black to ' +
      'white, 64 steps, is repainted at run time with the team colour. Paint ' +
      'in it on purpose for the parts that should follow the team; paint in ' +
      'it by accident and that part changes colour in play. The sprite panel ' +
      'reports how much of a sheet sits in the ramp, and <b>Nudge off the ' +
      'ramp</b> moves a colour out of it.',
    '<b>Keep a frame at or under 64 x 80.</b> The original tool reports the ' +
      'game failing to start on frames much past that, with trouble around ' +
      '60 x 100. Files that already ship larger are fine; newly grown ones ' +
      'may not be.'
  ]);

  body.appendChild(crEl('h4', '', 'A way in that is not forty files'));
  crSteps(body, [
    'Open an existing character of a similar build. Every frame is then ' +
      'already the right size and the ramp is already where it belongs.',
    'Recolour it first with <b>Palette</b>, which reaches every frame at ' +
      'once, and look at it in motion before touching a single pixel.',
    'Then repaint the frames that carry the character: the standing set and ' +
      'the portrait. Those two decide whether people recognise it.',
    'Leave the mounted sets until last. They are the least seen and the ' +
      'fiddliest.'
  ]);
  crNote(body, 'There is no import for a whole character on the receiving end ' +
    'yet, so a finished one is handed over as its folder of files. Worth ' +
    'asking before starting a big one.');
}

/* ----------------------------- the shell ------------------------- */

const CREATOR_TRACKS = [
  ['costume', 'A costume', 'recolour the White', costumeBuild],
  ['skin', 'A bomb skin', 'the bomb and its flame', skinBuild],
  ['map', 'A map', 'the grid, the starts, the items', mapBuild],
  ['side', 'Scenery', 'the border around the arena', sideBuild],
  ['char', 'A character', 'the whole set, and what it costs', charBuild]
];

function creatorRender() {
  const nav = $('crNav'), body = $('crBody');
  if (!nav || !body) return;
  nav.innerHTML = '';
  CREATOR_TRACKS.forEach(([id, title, blurb]) => {
    const b = document.createElement('button');
    b.className = id === creator.track ? 'on' : '';
    b.innerHTML = '<span class="crT"></span><span class="crB"></span>';
    b.firstChild.textContent = title;
    b.lastChild.textContent = blurb;
    b.onclick = () => { creator.track = id; creatorRender(); };
    nav.appendChild(b);
  });
  body.innerHTML = '';
  body.scrollTop = 0;
  const track = CREATOR_TRACKS.find(t => t[0] === creator.track);
  if (track) track[3](body);
}

function creatorOpen(id) {
  if (id) creator.track = id;
  $('cr').hidden = false;
  creatorRender();
}

function creatorClose() {
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
