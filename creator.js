/* creator.js -- the Workshop: make something the server will take.

   Two things this panel has to do, in this order.

   Say what to attach. Every page opens with the files it wants, by
   name, with their sizes and limits, and the place to drop them right
   there. "To make a bomb skin, attach these twelve" is the question
   people actually arrive with.

   Then show what arrived. The preview is the person's own work, not a
   drawing of ours: their painted template, their sprites playing,
   their grid, their scenery with the arena over it. An earlier version
   drew a schematic figure from the chosen colours, and it was the
   wrong idea -- an invented figure standing in for the thing someone
   is making is worse than no figure at all, because it looks like an
   answer and is not one.

   The names, sizes and limits below are the receiving end's own, read
   from a live panel rather than guessed.

   ASCII only: these files are served without a charset. Write the
   Portuguese normally and run python/ascii_escape.py. */

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

const COSTUME_OWN = {
  helmet: '#e0e0e0', suit: '#666666', chest: '#15377d', buckle: '#9a7316',
  face: '#de9c52', eyes: '#000208', pompom: '#f485c7', stem: '#d6e8e9',
  gloves: '#d670a7', boots: '#ec7dbb'
};

const COSTUME_DEFAULT_2 = {
  helmet: '#764e2e', suit: '#764e2e', chest: '#eee2c6', pompom: '#eee2c6',
  gloves: '#eee2c6', boots: '#eee2c6'
};

const COSTUME_SHEET_COUNT = 37;

/* The template: 432 x 640, with a 16 x 16 pure magenta square set 8
   pixels in from each corner. Those four squares are how the receiving
   end finds the figure, so a picture missing one, or cropped past them,
   is refused. A larger copy is fine, because it rectifies by the
   corners. */
const COSTUME_TEMPLATE = { w: 432, h: 640, mark: 16, inset: 8, key: '#ff00ff' };

const SKIN_FILES = [
  ['bomb.spr', 'The bomb sitting on the ground, and appearing', true],
  ['bomb_d.spr', 'The bomb in its last moment, about to go off', false],
  ['bomb_s.spr', 'The bomb while it slides after a kick', false],
  ['bomb_f.eft', 'The fuse burning on top of it', false],
  ['flame_center.eft', 'The blast where the bomb was', false],
  ['flame_hor.eft', 'The arm running left and right', false],
  ['flame_ver.eft', 'The arm running up and down', false],
  ['flame_left.eft', 'The tip of the arm going left', false],
  ['flame_right.eft', 'The tip of the arm going right', false],
  ['flame_up.eft', 'The tip of the arm going up', false],
  ['flame_down.eft', 'The tip of the arm going down', false],
  ['boom_block.eft', 'A breakable block coming apart', false]
];
const SKIN_MAX = 524288;

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

/* A character: the actions, whether each is one file or four, and
   whether it is one of the ones people actually look at. */
const CHAR_SETS = [
  ['st', 'Standing', true, true],
  ['mo', 'Walking', true, true],
  ['pu', 'Punching', true, true],
  ['pa', 'Struck', true, true],
  ['msb_ch', 'Riding', true, false],
  ['rui_st', 'Mounted, still', true, false],
  ['rui_mo', 'Mounted, walking', true, false],
  ['rui_ju', 'Mounting', true, false],
  ['add', 'Idle flourish', false, true],
  ['dd', 'Death', false, true],
  ['face', 'Portrait', false, true]
];

const CHAR_FACINGS = { e: 'facing east', n: 'facing north',
                       s: 'facing south', w: 'facing west' };

/* Every file name a character folder may hold. */
function charFileNames() {
  const out = [];
  for (const [key, label, perFacing, core] of CHAR_SETS) {
    if (perFacing) {
      for (const d of ['e', 'n', 's', 'w'])
        out.push([key + '_' + d, label, core, CHAR_FACINGS[d]]);
    } else {
      out.push([key, label, core, '']);
    }
  }
  return out;
}

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
    dv.setUint16(8, 0, true);
    dv.setUint16(12, 0x21, true);
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
  picture: null,       /* the attached template, checked */
  skin: {},            /* name -> {bytes, note, ok, gra} */
  chars: {},           /* base name -> {bytes, ok, note, gra} */
  play: null,          /* the interval animating what was attached */
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

/* The first thing on every page: what to attach, and where to put it.
   One row per file, and the drop zone immediately under them, because
   the question people arrive with is "what do I send". */
function crNeeds(body, wants, drop) {
  const box = crEl('div', 'crNeeds');
  box.appendChild(crEl('h4', 'crNeedsTitle', 'What to attach'));
  const list = crEl('div', 'crFiles');
  for (const w of wants) {
    const row = crEl('div', 'crFile');
    if (w.id) row.dataset.name = w.id;
    row.appendChild(crEl('span', 'crState',
                         w.tag || (w.need ? 'needed' : 'optional')));
    row.appendChild(crEl('code', '', w.name));
    row.appendChild(crEl('span', 'crWhat', w.what));
    list.appendChild(row);
  }
  box.appendChild(list);
  if (drop) {
    const d = crEl('div', 'crDrop crDropBig');
    d.appendChild(crEl('b', '', drop.label));
    d.appendChild(crEl('span', 'crDropHint', 'drop here, or click to choose'));
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
    d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => {
      e.preventDefault();
      d.classList.remove('over');
      drop.take(e.dataTransfer.files);
    };
    d.onclick = () => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = drop.accept;
      i.multiple = !!drop.multiple;
      i.onchange = () => drop.take(i.files);
      i.click();
    };
    box.appendChild(d);
  }
  body.appendChild(box);
  return box;
}

function crPage(body, title, lead) {
  body.appendChild(crEl('h3', '', title));
  body.appendChild(crHTML('p', 'crLead', lead));
}

function crStage(body) {
  const stage = crEl('div', 'crStage');
  const left = crEl('div', 'crView');
  const right = crEl('div', 'crSide');
  stage.appendChild(left);
  stage.appendChild(right);
  body.appendChild(stage);
  return { left, right };
}

/* The preview before anything has been attached: it says what will
   appear here rather than showing something invented. */
function crEmpty(parent, text) {
  const e = crEl('div', 'crEmpty');
  e.appendChild(crEl('span', '', text));
  parent.appendChild(e);
  return e;
}

function crStopPlay() {
  if (creator.play) { clearInterval(creator.play); creator.play = null; }
}

/* Animate the sprites that were attached, side by side. */
function crPlaySprites(parent, items, caption) {
  crStopPlay();
  if (!items.length) return;
  if (caption) parent.appendChild(crEl('p', 'crCap', caption));
  const strip = crEl('div', 'crStrip');
  const live = [];
  for (const { name, gra } of items) {
    const cell = crEl('div', 'crStripCell');
    const cv = crEl('canvas', 'crStripCanvas');
    const z = Math.max(1, Math.min(4,
      Math.floor(80 / Math.max(gra.width, gra.height))));
    cv.width = gra.width * z;
    cv.height = gra.height * z;
    cell.appendChild(cv);
    cell.appendChild(crEl('span', '', name));
    strip.appendChild(cell);
    live.push({ gra, cv, f: 0 });
  }
  parent.appendChild(strip);
  const tick = () => {
    for (const it of live) {
      const ctx = it.cv.getContext('2d');
      ctx.clearRect(0, 0, it.cv.width, it.cv.height);
      const fr = it.gra.frames[it.f % it.gra.frames.length];
      const img = new ImageData(
        new Uint8ClampedArray(fr.toRGBA(it.gra.width, it.gra.height)),
        it.gra.width, it.gra.height);
      const tmp = document.createElement('canvas');
      tmp.width = it.gra.width;
      tmp.height = it.gra.height;
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, it.cv.width, it.cv.height);
      it.f++;
    }
  };
  tick();
  creator.play = setInterval(tick, 90);
}

/* Read an attached sprite or effect through the editor's own reader, so
   "it opens" means the same here as everywhere else. */
function crReadSprite(file, done) {
  const r = new FileReader();
  r.onload = () => {
    const bytes = new Uint8Array(r.result);
    let ok = true, note = '', gra = null;
    try {
      gra = new GRA(bytes.buffer.slice(0));
      note = gra.frames.length + ' fr ' + gra.width + 'x' + gra.height +
             (gra.eft ? ', ' + gra.eft.groups + ' gr' : '');
    } catch (e) { ok = false; note = 'does not open'; }
    done({ bytes, ok, note, gra });
  };
  r.readAsArrayBuffer(file);
}

function costumeColour(spec, id, depth) {
  const p = spec.parts[id];
  if (!p || p.colour == null) return COSTUME_OWN[id];
  if (/^#/.test(p.colour)) return p.colour;
  if ((depth || 0) > 3) return COSTUME_OWN[id];
  return costumeColour(spec, p.colour, (depth || 0) + 1);
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

  crPage(body, 'A costume',
    'A costume is <b>not a drawing of your own</b>. The server keeps ten ' +
    'parts, each with a colour and some of them a pattern, and makes the ' +
    COSTUME_SHEET_COUNT + ' sheets itself from the White\'s own shape. You ' +
    'paint the template it gives you, or you set the ten parts by hand.');

  crNeeds(body, [
    { name: 'costume-template.png', need: true,
      what: 'The template, painted. ' + COSTUME_TEMPLATE.w + ' x ' +
            COSTUME_TEMPLATE.h + ', with the four magenta corner squares ' +
            'left alone. Ask whoever runs the server for the blank one.' }
  ], {
    label: 'Attach the painted template',
    accept: 'image/*',
    take: files => costumeTake(files[0])
  });

  const { left, right } = crStage(body);
  const view = crEl('div', 'crViewInner');
  left.appendChild(view);
  costumeShow(view);

  right.appendChild(crEl('h4', '', 'Or set the ten parts by hand'));
  right.appendChild(crHTML('p', 'crHint',
    'If you would rather not paint, choose the parts here and hand over ' +
    '<code>costume.json</code> instead. <b>Keep the White\'s</b> leaves a ' +
    'part alone; <b>Colour</b> gives it your own; <b>Same as</b> makes it ' +
    'follow another part.'));

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
      costumeSummary();
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
  right.appendChild(tbl);

  const ex = crEl('div', 'crParts');
  const r1 = crEl('div', 'crPart');
  const cbe = crEl('input'); cbe.type = 'checkbox'; cbe.checked = spec.ends.on;
  cbe.onchange = () => { spec.ends.on = cbe.checked; costumeSummary(); };
  r1.appendChild(cbe);
  r1.appendChild(crEl('span', '', 'Loose ends beside the head: a headband, ' +
    'a trailing bandage'));
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
  right.appendChild(ex);

  right.appendChild(crEl('h4', '', 'What you hand over'));
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

  body.appendChild(crEl('h4', '', 'Painting the template'));
  crSteps(body, [
    'Paint each part over it in <b>flat colour</b>. The shading is added ' +
      'later, so flat reads better than shaded.',
    'Leave the <b>four magenta squares</b> alone and do not crop. They are ' +
      'how the figure is found. A bigger copy is fine.',
    'A part you do not touch stays the White\'s. Erase the pompom or the ' +
      'antenna to leave it off altogether.',
    'A hat, hair or a cape drawn outside the outline is <b>not drawn</b>: ' +
      'the shape never changes.'
  ]);

  costumeSummary();
}

/* The preview is the attached picture, checked, or nothing. */
function costumeShow(view) {
  view.innerHTML = '';
  const p = creator.picture;
  if (!p) {
    crEmpty(view, 'Attach the painted template and it appears here, ' +
                  'checked before you send it anywhere.');
    return;
  }
  const img = crEl('img', 'crPic');
  img.src = p.url;
  view.appendChild(img);
  const note = crEl('p', 'crCap ' + (p.ok ? 'crOk' : 'crBad'));
  note.textContent = p.note;
  view.appendChild(note);
}

function costumeTake(file) {
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const r = costumeCheckPicture(img);
    creator.picture = {
      name: file.name, url: url, ok: r.ok,
      note: r.ok
        ? file.name + ', ' + r.size + '. The four squares are there' +
          (Math.abs(r.scale - 1) < 0.01 ? ', at the template\'s own size.'
            : ', at ' + r.scale.toFixed(2) + ' times the template, which is fine.')
        : 'This will not import: ' + r.why
    };
    const view = document.querySelector('.crViewInner');
    if (view) {
      costumeShow(view);
      if (typeof i18nApply === 'function') i18nApply(view);
    }
  };
  img.onerror = () => notify('that file is not an image this browser can read', 1);
  img.src = url;
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

/* ----------------------------- bomb skin ------------------------- */

function skinBuild(body) {
  crPage(body, 'A bomb skin',
    'This one <b>is</b> your own artwork, and it is a set: the bomb itself ' +
    'and the flame it makes. The names are fixed. Only ' +
    '<code>bomb.spr</code> is required, so a skin that changes nothing but ' +
    'the bomb is <b>one file</b>.');

  const box = crNeeds(body,
    SKIN_FILES.map(([name, what, need]) =>
      ({ id: name, name: name, what: what, need: need })),
    {
      label: 'Attach the files of the set',
      accept: '.spr,.eft',
      multiple: true,
      take: files => skinTake(files, refresh)
    });
  body.appendChild(crHTML('p', 'crHint',
    'Three are sprites (<code>.spr</code>), nine are effects ' +
    '(<code>.eft</code>), and <b>all twelve open in this editor</b>. Each ' +
    'is capped at ' + Math.round(SKIN_MAX / 1024) + ' kB. Anything left out ' +
    'falls back to the ordinary bomb.'));

  const { left, right } = crStage(body);
  const view = crEl('div', 'crViewInner');
  left.appendChild(view);

  right.appendChild(crEl('h4', '', 'How to make one'));
  crSteps(right, [
    'Open the file of the same name from a copy of the game, with ' +
      '<b>Open...</b> above. Starting from the real one means the frame ' +
      'count and the sizes already match.',
    'Recolour it with <b>Palette</b> in the sprite panel. That changes one ' +
      'colour across every frame at once, which is what a recolour wants.',
    'Watch the <b>reserved ramp</b>: 64 neutral values are repainted at run ' +
      'time. The sprite panel says how much of a sheet sits in it.',
    '<b>Save sprite</b> under the same name, then attach it above.'
  ]);

  const out = crEl('p', 'crHint');
  right.appendChild(out);
  const acts = crEl('div', 'crActs');
  const save = crButton(acts, 'Export the set as a .zip', () => {
    const entries = Object.keys(creator.skin)
      .filter(n => creator.skin[n].ok)
      .map(n => ({ name: n, data: creator.skin[n].bytes }));
    if (!entries.length) { notify('nothing in the set yet', 1); return; }
    saveFile('bomb-skin.zip', zipStore(entries), 'application/zip');
  }, 'primary');
  crButton(acts, 'Clear', () => { creator.skin = {}; creatorRender(); });
  right.appendChild(acts);

  function refresh() {
    let good = 0, bad = 0;
    for (const row of box.querySelectorAll('.crFile')) {
      const e = creator.skin[row.dataset.name];
      const st = row.firstChild;
      row.classList.toggle('have', !!(e && e.ok));
      row.classList.toggle('bad', !!(e && !e.ok));
      if (e) {
        st.textContent = e.ok ? e.note : 'refused';
        st.title = e.note || '';
        if (e.ok) good++; else bad++;
      } else {
        const want = SKIN_FILES.find(f => f[0] === row.dataset.name);
        st.textContent = want && want[2] ? 'needed' : 'optional';
        st.title = '';
      }
    }
    const haveBomb = creator.skin['bomb.spr'] && creator.skin['bomb.spr'].ok;
    out.className = 'crHint ' + (bad ? 'crBad' : (haveBomb ? 'crOk' : ''));
    out.textContent = good + ' file(s) attached' +
      (bad ? ', ' + bad + ' refused' : '') +
      (haveBomb ? '.' : '. bomb.spr is still missing, and the set needs it.');
    save.disabled = !good;

    view.innerHTML = '';
    const items = Object.keys(creator.skin)
      .filter(n => creator.skin[n].ok && creator.skin[n].gra)
      .map(n => ({ name: n, gra: creator.skin[n].gra }));
    if (!items.length)
      crEmpty(view, 'Attach the files and they play here, so you can judge ' +
                    'the set moving.');
    else
      crPlaySprites(view, items, 'Your files, playing:');
    if (typeof i18nApply === 'function') i18nApply(view);
  }
  refresh();
}

function skinTake(files, done) {
  let left = files.length;
  if (!left) return;
  for (const f of files) {
    const want = SKIN_FILES.find(s => s[0].toLowerCase() === f.name.toLowerCase());
    if (!want) {
      notify(f.name + ' is not one of the names a skin uses', 1);
      if (!--left) done();
      continue;
    }
    if (f.size > SKIN_MAX) {
      creator.skin[want[0]] = { bytes: new Uint8Array(0), ok: false,
                                note: 'over the limit' };
      if (!--left) done();
      continue;
    }
    crReadSprite(f, r => {
      creator.skin[want[0]] = r;
      if (!--left) done();
    });
  }
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

  crPage(body, 'A map',
    'The one page with <b>nothing to attach</b>: you draw the map here and ' +
    'leave with the file. It is a grid, where people start, and what the ' +
    'breakable blocks hide. The theme decides which tiles draw it, so you ' +
    'are laying out a room rather than painting one.');

  crNeeds(body, [
    { name: '(nothing)', tag: 'none',
      what: 'Draw the map below. What you hand over is one small .json.' },
    { name: 'block tiles', tag: 'optional',
      what: 'A map may bring its own blocks: one picture ' + MAP_LIMITS.blockW +
            ' wide, rows ' + MAP_LIMITS.blockH[0] + ' to ' +
            MAP_LIMITS.blockH[1] + ' tall, up to ' +
            Math.round(MAP_LIMITS.block / 1024) + ' kB.' },
    { name: 'scenery', tag: 'optional',
      what: 'And its own border, which is the Scenery page here.' }
  ], null);

  const { left, right } = crStage(body);
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
  const stIt = crEl('span', 'crLegItem');
  stIt.appendChild(crEl('i', 'crLegDot crLegStart'));
  stIt.appendChild(crEl('b', '', 'Start'));
  stIt.appendChild(crEl('span', '', 'Where a player appears. Needs floor.'));
  legend.appendChild(stIt);
  left.appendChild(legend);

  right.appendChild(crEl('h4', '', 'The room'));
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
  right.appendChild(bar);

  right.appendChild(crEl('h4', '', 'Draw it'));
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
  startBtn.appendChild(crEl('i', 'crLegDot crLegStart'));
  startBtn.appendChild(document.createTextNode('Start'));
  startBtn.dataset.ch = 'S';
  startBtn.onclick = () => setBrush('S');
  brushBtns.push(startBtn);
  pal.appendChild(startBtn);
  right.appendChild(pal);
  right.appendChild(crHTML('p', 'crHint',
    'Drag to paint. The rim has to stay the outer wall, and a start needs ' +
    'floor under it, so the editor refuses both rather than letting you ' +
    'make a map that will be rejected.'));

  right.appendChild(crEl('h4', '', 'What the blocks hide'));
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
      if (brush === '9') {
        notify('the outer wall only goes around the rim', 1);
        return;
      }
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
  crPage(body, 'Scenery',
    'The picture drawn <b>around</b> the arena. The grid sits on top of it, ' +
    'in the middle, so the part of your picture that shows is the border.');

  crNeeds(body, [
    { name: '800 x 600', need: true,
      what: 'For a 17 x 15 map, up to 6 players. Up to ' +
            Math.round(SIDE_MAX / 1048576) + ' MB.' },
    { name: '960 x 694', tag: 'or',
      what: 'For a 21 x 17 map, 7 to 12 players.' },
    { name: '1120 x 770', tag: 'or',
      what: 'For a 25 x 19 map.' }
  ], {
    label: 'Attach your scenery',
    accept: 'image/*',
    take: files => sideTake(files[0])
  });
  body.appendChild(crHTML('p', 'crHint',
    'One picture per size, and a map uses only the one that matches it. ' +
    '<b>Nothing is scaled</b>: paint at the size it will be shown.'));

  const { left, right } = crStage(body);
  const view = crEl('div', 'crViewInner');
  left.appendChild(view);
  sideShow(view);

  right.appendChild(crEl('h4', '', 'What the check says'));
  const out = crEl('p', 'crHint');
  out.id = 'crSideOut';
  if (creator.side) {
    out.className = 'crHint ' + (creator.side.ok ? 'crOk' : 'crBad');
    out.textContent = creator.side.note;
  } else {
    out.textContent = 'Attach a picture and this says whether the size is ' +
                      'one the server takes, before you send it.';
  }
  right.appendChild(out);
  right.appendChild(crHTML('p', 'crHint',
    'The dark rectangle over your picture is where the arena covers it. ' +
    'Paint outside it.'));
}

function sideShow(view) {
  view.innerHTML = '';
  const s = creator.side;
  if (!s) {
    crEmpty(view, 'Attach your scenery and it appears here with the arena ' +
                  'drawn over it.');
    return;
  }
  const cv = crEl('canvas', 'crCanvas');
  cv.width = 340; cv.height = 262;
  view.appendChild(cv);
  const ctx = cv.getContext('2d');
  const size = SIDE_SIZES[s.pick];
  const k = Math.min((cv.width - 16) / size.w, (cv.height - 16) / size.h);
  const w = size.w * k, h = size.h * k;
  const ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
  ctx.drawImage(s.img, ox, oy, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.strokeRect(ox + .5, oy + .5, w - 1, h - 1);
  const cell = Math.min(w / (size.cw + 4), h / (size.ch + 3));
  const aw = cell * size.cw, ah = cell * size.ch;
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
  ctx.fillText(size.cells, ax + aw / 2, ay + ah / 2 + 4);
  const note = crEl('p', 'crCap ' + (s.ok ? 'crOk' : 'crBad'));
  note.textContent = s.note;
  view.appendChild(note);
}

function sideTake(file) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const hit = SIDE_SIZES.findIndex(s => s.w === img.width && s.h === img.height);
    const big = file.size > SIDE_MAX;
    creator.side = {
      img: img, pick: hit >= 0 ? hit : 0, ok: hit >= 0 && !big,
      note: hit >= 0
        ? (big ? 'The size is right but the file is ' +
                 (Math.round(file.size / 1048576 * 10) / 10) +
                 ' MB, over the limit.'
               : img.width + ' x ' + img.height + ', the ' +
                 SIDE_SIZES[hit].cells + ' size, ' +
                 Math.round(file.size / 1024) + ' kB. Good.')
        : img.width + ' x ' + img.height + ' is not one of the sizes. It has ' +
          'to be exactly ' + SIDE_SIZES.map(s => s.w + ' x ' + s.h).join(', ') + '.'
    };
    const view = document.querySelector('.crViewInner');
    if (view) sideShow(view);
    const out = $('crSideOut');
    if (out) {
      out.className = 'crHint ' + (creator.side.ok ? 'crOk' : 'crBad');
      out.textContent = creator.side.note;
    }
  };
  img.onerror = () => notify('that file is not an image this browser can read', 1);
  img.src = URL.createObjectURL(file);
}

/* ---------------------------- characters ------------------------- */

function charBuild(body) {
  crPage(body, 'A character',
    'The big one, and <b>all your own artwork</b>. A costume recolours the ' +
    'White and the server draws it; a character is its own drawing in every ' +
    'pose and every facing. About forty files, named for the action and the ' +
    'direction.');

  const names = charFileNames();
  const box = crNeeds(body, names.map(([n, label, core, facing]) => ({
    id: n, name: n + '.gra', need: core,
    what: label + (facing ? ', ' + facing : '')
  })), {
    label: 'Attach the character folder',
    accept: '.gra,.spr',
    multiple: true,
    take: files => charTake(files, refresh)
  });
  body.appendChild(crHTML('p', 'crHint',
    'Select every file in the folder at once. The rows marked ' +
    '<b>needed</b> are the ones people actually look at: finish only those ' +
    'and the character still works. There is <b>no import for a whole ' +
    'character</b> at the other end yet, so a finished one is handed over as ' +
    'its folder.'));

  const { left, right } = crStage(body);
  const view = crEl('div', 'crViewInner');
  left.appendChild(view);

  right.appendChild(crEl('h4', '', 'Two rules that catch everyone'));
  crSteps(right, [
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

  right.appendChild(crEl('h4', '', 'A way in that is not forty files'));
  crSteps(right, [
    'Open an existing character of a similar build with <b>Open...</b>. ' +
      'Every frame is then already the right size and the ramp is already ' +
      'where it belongs.',
    'Recolour the whole thing first with <b>Palette</b>, and watch it move, ' +
      'before touching a single pixel.',
    'Then repaint the two sets that carry the character: <b>standing</b> and ' +
      'the <b>portrait</b>.',
    'Leave the mounted sets until last. Least seen, fiddliest.'
  ]);

  const out = crEl('p', 'crHint');
  right.appendChild(out);
  const acts = crEl('div', 'crActs');
  const save = crButton(acts, 'Export the folder as a .zip', () => {
    const entries = Object.keys(creator.chars)
      .filter(n => creator.chars[n].ok)
      .map(n => ({ name: n + '.gra', data: creator.chars[n].bytes }));
    if (!entries.length) { notify('nothing attached yet', 1); return; }
    saveFile('character.zip', zipStore(entries), 'application/zip');
  }, 'primary');
  crButton(acts, 'Clear', () => { creator.chars = {}; creatorRender(); });
  right.appendChild(acts);

  function refresh() {
    let good = 0, bad = 0, core = 0, coreNeed = 0;
    for (const row of box.querySelectorAll('.crFile')) {
      const key = row.dataset.name;
      const want = names.find(n => n[0] === key);
      if (want && want[2]) coreNeed++;
      const e = creator.chars[key];
      const st = row.firstChild;
      row.classList.toggle('have', !!(e && e.ok));
      row.classList.toggle('bad', !!(e && !e.ok));
      if (e) {
        st.textContent = e.ok ? e.note : 'refused';
        st.title = e.note || '';
        if (e.ok) { good++; if (want && want[2]) core++; } else bad++;
      } else {
        st.textContent = want && want[2] ? 'needed' : 'optional';
        st.title = '';
      }
    }
    out.className = 'crHint ' + (bad ? 'crBad' : (good ? 'crOk' : ''));
    out.textContent = good + ' of ' + names.length + ' attached, ' + core +
      ' of ' + coreNeed + ' of the ones that matter' +
      (bad ? ', ' + bad + ' refused' : '') + '.';
    save.disabled = !good;

    view.innerHTML = '';
    const items = Object.keys(creator.chars)
      .filter(n => creator.chars[n].ok && creator.chars[n].gra)
      .sort()
      .slice(0, 12)
      .map(n => ({ name: n, gra: creator.chars[n].gra }));
    if (!items.length)
      crEmpty(view, 'Attach the folder and the frames play here, so you can ' +
                    'see whether the facings agree with one another.');
    else
      crPlaySprites(view, items, 'Your character, playing:');
    if (typeof i18nApply === 'function') i18nApply(view);
  }
  refresh();
}

function charTake(files, done) {
  const names = charFileNames();
  let left = files.length;
  if (!left) return;
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    const want = names.find(n => n[0].toLowerCase() === base);
    if (!want) {
      notify(f.name + ' is not one of the names a character uses', 1);
      if (!--left) done();
      continue;
    }
    crReadSprite(f, r => {
      creator.chars[want[0]] = r;
      if (!--left) done();
    });
  }
}

/* ----------------------------- the shell ------------------------- */

const CREATOR_TRACKS = [
  ['costume', 'A costume', 'recolour the White', '1 file', costumeBuild],
  ['skin', 'A bomb skin', 'the bomb and its flame', 'up to 12', skinBuild],
  ['map', 'A map', 'the grid and the items', 'nothing', mapBuild],
  ['side', 'Scenery', 'the border around it', '1 file', sideBuild],
  ['char', 'A character', 'the whole folder', '35 files', charBuild]
];

function creatorRender() {
  const nav = $('crNav'), body = $('crBody');
  if (!nav || !body) return;
  crStopPlay();
  nav.innerHTML = '';
  CREATOR_TRACKS.forEach(([id, title, blurb, count]) => {
    const b = document.createElement('button');
    b.className = id === creator.track ? 'on' : '';
    b.appendChild(crEl('span', 'crT', title));
    b.appendChild(crEl('span', 'crB', blurb));
    b.appendChild(crEl('span', 'crCount', count));
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
  crStopPlay();
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
