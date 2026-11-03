/* map.js -- the map editor.

   Two different things share this editor because they are the same
   picture underneath: a grid of four tile kinds.

   - `block.spr`, the game's own layouts. 46 sets of 100 variants, each
     a 17 x 15 grid packed two tiles per byte. A match picks a variant,
     so a set is a theme with a hundred rooms.
   - A **custom map**, which is not that file at all: a record the
     server keeps, with three screens at three sizes, a theme, where
     people start and what the breakable blocks hide. It leaves here as
     the JSON the panel takes.

   `map.spr` is read when it is offered, but not written. It holds the
   spawns, the gimmick objects and the item counts of each set, and
   showing them next to a layout is most of why anyone opens one. The
   writer is deliberately missing: the editor should not rewrite a file
   whose unknown fourteenth item slot it cannot account for.

   See docs/map-format.md for the layout of both files and how it was
   confirmed. */

const MAP_W = 17, MAP_H = 15;                /* block.spr is always this */
const MAP_SETS = 46, MAP_VARIANTS = 100, MAP_VAR_BYTES = 128;
const MAP_BLOCK_BYTES = MAP_SETS * MAP_VARIANTS * MAP_VAR_BYTES;

const T_FLOOR = 0, T_SOFT = 1, T_HARD = 2, T_BORDER = 9;

/* The four tiles, in the order the palette shows them. The colours are
   the editor's own: the game draws these from a theme's sprites, and
   picking theme colours here would promise a fidelity this view does
   not have. */
const MAP_TILES = [
  { v: T_FLOOR,  key: '0', name: 'Floor',  hint: 'Walkable.' },
  { v: T_SOFT,   key: '1', name: 'Block',  hint: 'Breaks. The items are hidden in these.' },
  { v: T_HARD,   key: '2', name: 'Pillar', hint: 'Solid. Never breaks, never hides anything.' },
  { v: T_BORDER, key: '9', name: 'Wall',   hint: 'The outer wall. Normally the rim.' }
];

/* The three screens a custom map carries, from the panel's own
   custommaps.json: one per field size, and a map uses the one that
   matches the room. */
const MAP_SIZES = [
  { w: 17, h: 15, pw: 800,  ph: 600, starts: 6,  players: 'up to 6' },
  { w: 21, h: 17, pw: 960,  ph: 694, starts: 12, players: '7 to 12' },
  { w: 25, h: 19, pw: 1120, ph: 770, starts: 12, players: '12' }
];

const MAP_THEMES = ['Standard', 'Pyramid', 'Laboratory', 'Village',
                    'Iceberg', 'Road', 'ToyBox'];

/* Thirteen the panel names. map.spr carries fourteen counts and the
   last is not identified, so the block view shows it as a number
   without a name rather than inventing one. */
const MAP_ITEMS = ['Fire', 'Speed', 'Bomb', 'Kick', 'Glove', 'Skull', 'Vest',
                   'Full fire', 'Louie', 'Punch', 'Line bomb', 'Pierce bomb',
                   'Water bomb'];

const MAP_LIMITS = { name: 20, item: 40 };

/* gimmicks.js, which creates these from map.spr every round. Types the
   client dispatches but the shipped file never uses are here too, so a
   file from somewhere else still reads. */
const MAP_OBJECTS = {
  0:  'Warp, to a destination', 1:  'Warp', 2:  'Drift sand',
  3:  'Conveyor belt', 4:  'Direction switch', 6:  'Arrow',
  7:  'Arrow, rotating', 8:  'Tunnel or Soccer goal', 9:  'Cracking ice',
  12: 'Speed panel', 14: 'Tunnel', 15: 'Drift sand, whole floor',
  16: 'Count tile', 17: 'Hyper Bomb goal'
};

const map = {
  kind: null,        /* 'block' | 'custom' */
  name: '',
  raw: null,         /* block.spr as loaded, for the round-trip check */
  blocks: null,      /* the working copy */
  set: 0, variant: 0,
  records: null,     /* map.spr, when one has been offered */
  doc: null,         /* the custom map */
  screen: 0,
  tile: T_SOFT,
  painting: 0,       /* 0 none, 1 painting, 2 erasing to floor */
  placing: -1,       /* which start point is being placed, -1 none */
  dirty: false
};

/* ------------------------------ opening -------------------------- */

/* By content, not by name. Both map files wear a sprite extension, and
   a sprite reader will take `block.spr` as far as byte 2 before it
   fails -- which is a worse failure than not offering to open it. A
   real sprite has 01 01 there; these have the border tile repeating. */
function mapSniff(name, buf) {
  const b = new Uint8Array(buf);
  if (/\.json$/i.test(name)) return 'custom';
  if (b.length >= 4 && b[2] === 1 && b[3] === 1) return null;   /* a sprite */
  if (b.length === MAP_BLOCK_BYTES) return 'block';
  if (/block\.spr$/i.test(name) && b.length % MAP_VAR_BYTES === 0) return 'block';
  if (/map\.spr$/i.test(name) || (b.length && b[0] === 0x09)) {
    return mapParseRecords(buf) ? 'records' : null;
  }
  return null;
}

function mapOpen(name, buf, kind) {
  if (kind === 'records') {
    const recs = mapParseRecords(buf);
    if (!recs) { notify(t('that is not map.spr'), 1); return; }
    map.records = recs;
    /* on its own it is not a document: it describes sets, and a set is
       a thing you look at in block.spr */
    if (map.kind !== 'block') {
      notify(tf('map.spr read: {n} sets. Open block.spr to see them',
        { n: recs.length }));
      return;
    }
    notify(tf('map.spr read: spawns, objects and items for {n} sets',
      { n: recs.length }));
    mapRenderAll();
    return;
  }
  if (kind === 'block') {
    const raw = new Uint8Array(buf);
    map.kind = 'block';
    map.name = name;
    map.raw = raw;
    map.blocks = raw.slice();
    map.set = 0; map.variant = 0;
    map.doc = null;
    map.dirty = false;
  } else {
    let d;
    try { d = JSON.parse(new TextDecoder().decode(buf)); }
    catch (e) { notify(tf('that JSON will not parse: {why}',
      { why: e.message }), 1); return; }
    const doc = mapAdoptCustom(d);
    if (!doc) { notify(t('that JSON is not a custom map'), 1); return; }
    map.kind = 'custom';
    map.name = name;
    map.doc = doc;
    map.screen = 0;
    map.raw = null; map.blocks = null;
    map.dirty = false;
  }
  if (typeof spriteClose === 'function') spriteClose();
  document.body.classList.add('map-mode');
  const e = $('empty');
  if (e) e.style.display = 'none';
  mapRenderAll();
}

function mapClose() {
  map.kind = null; map.raw = null; map.blocks = null; map.doc = null;
  map.records = null; map.dirty = false;
  document.body.classList.remove('map-mode');
  const st = $('mapStat'), rt = $('mapRt');
  if (st) st.textContent = '';
  if (rt) { rt.textContent = ''; rt.className = 'rt'; }
}

/* --------------------------- block.spr --------------------------- */

function mapIndex() { return map.set * MAP_VARIANTS + map.variant; }

/* A variant as a flat array of MAP_W * MAP_H, high nibble first. */
function mapLayout(index) {
  const base = index * MAP_VAR_BYTES, g = new Uint8Array(MAP_W * MAP_H);
  for (let i = 0; i < g.length; i++) {
    const b = map.blocks[base + (i >> 1)];
    g[i] = (i & 1) ? (b & 15) : (b >> 4);
  }
  return g;
}

function mapSetTile(index, i, v) {
  const at = index * MAP_VAR_BYTES + (i >> 1), b = map.blocks[at];
  map.blocks[at] = (i & 1) ? ((b & 0xf0) | (v & 15))
                           : ((b & 0x0f) | ((v & 15) << 4));
}

/* How many of a set's hundred variants differ. Sixteen sets repeat one
   layout a hundred times and the rest vary, so saying which you are in
   stops a pointless hunt through identical rooms. */
function mapDistinct(set) {
  const seen = new Set();
  for (let v = 0; v < MAP_VARIANTS; v++) {
    const base = (set * MAP_VARIANTS + v) * MAP_VAR_BYTES;
    seen.add(String.fromCharCode.apply(null,
      map.blocks.subarray(base, base + MAP_VAR_BYTES)));
  }
  return seen.size;
}

/* ---------------------------- map.spr ---------------------------- */

/* Returns the records, or null if the bytes do not fit the shape. A
   parse that does not consume the file exactly is a parse that is
   wrong, so the length is the test. */
function mapParseRecords(buf) {
  const v = new DataView(buf), n = v.byteLength;
  const out = [];
  let off = 0;
  try {
    while (off < n && out.length < 64) {
      off += 0xff + 2;
      if (off + 2 > n) return null;
      const count = v.getInt16(off, true);
      if (count < 0 || off + 2 + count * 7 > n) return null;
      const objects = [];
      for (let i = 0; i < count; i++) {
        const o = off + 2 + i * 7;
        objects.push({ x: v.getInt16(o, true), y: v.getInt16(o + 2, true),
                       param: v.getInt16(o + 4, true), type: v.getUint8(o + 6) });
      }
      off += 2 + count * 7;
      if (off + 14 + 1 + 24 + 2 > n) return null;
      const items = [];
      for (let i = 0; i < 14; i++) items.push(v.getUint8(off + i));
      off += 15;
      const spawns = [];
      for (let i = 0; i < 6; i++)
        spawns.push([v.getInt16(off + 4 * i, true), v.getInt16(off + 4 * i + 2, true)]);
      off += 26;
      out.push({ objects, items, spawns });
    }
  } catch (e) { return null; }
  return off === n && out.length ? out : null;
}

function mapRecord() {
  return (map.records && map.kind === 'block') ? map.records[map.set] || null : null;
}

/* -------------------------- custom maps -------------------------- */

function mapBlankScreen(size) {
  const s = MAP_SIZES[size], cells = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const edge = x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1;
      cells.push(edge ? T_BORDER : (x % 2 === 0 && y % 2 === 0) ? T_HARD : T_FLOOR);
    }
  }
  /* The corners, spread along the rim, which is where every shipped
     layout puts them. */
  const starts = mapCornerStarts(s);
  return { cells, starts, items: MAP_ITEMS.map(() => 2) };
}

/* A new map starts playable, not empty. A field of pillars with no
   breakable blocks cannot hide the items it is carrying, so a blank
   screen fails its own check the moment it is made -- which is a poor
   thing to hand somebody. This lays the blocks the way every shipped
   layout does and keeps a cross clear around each start. */
function mapClassicScreen(size) {
  const scr = mapBlankScreen(size);
  mapLayBlocks(scr, MAP_SIZES[size]);
  return scr;
}

/* Floor becomes breakable except where somebody starts and the tile
   next to it, so nobody opens the round walled in. */
function mapLayBlocks(scr, z) {
  const safe = new Set();
  for (const p of scr.starts) {
    safe.add(p[1] * z.w + p[0]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p[0] + dx, y = p[1] + dy;
      if (x >= 0 && y >= 0 && x < z.w && y < z.h) safe.add(y * z.w + x);
    }
  }
  for (let i = 0; i < scr.cells.length; i++)
    if (scr.cells[i] === T_FLOOR && !safe.has(i)) scr.cells[i] = T_SOFT;
}

function mapCornerStarts(s) {
  const all = [[1, 1], [s.w - 2, s.h - 2], [s.w - 2, 1], [1, s.h - 2],
               [(s.w - 1) >> 1, 1], [(s.w - 1) >> 1, s.h - 2],
               [1, (s.h - 1) >> 1], [s.w - 2, (s.h - 1) >> 1],
               [3, 3], [s.w - 4, s.h - 4], [s.w - 4, 3], [3, s.h - 4]];
  return all.slice(0, s.starts);
}

function mapNewCustom() {
  return { name: 'My map', theme: 1,
           screens: MAP_SIZES.map((_, i) => mapClassicScreen(i)) };
}

/* Takes either the panel's shape or this editor's own. The panel sends
   the cells as a string of digits; keeping them as numbers here means
   one drawing path for both kinds of document. */
function mapAdoptCustom(d) {
  const src = (d && d.screens) ? d : (d && d.maps && d.maps[0]) || null;
  if (!src || !Array.isArray(src.screens) || !src.screens.length) return null;
  const screens = [];
  for (let i = 0; i < MAP_SIZES.length; i++) {
    const s = src.screens[i], want = MAP_SIZES[i].w * MAP_SIZES[i].h;
    if (!s || !s.layout || s.layout.length !== want) {
      screens.push(mapBlankScreen(i));
      continue;
    }
    const cells = [];
    for (const ch of String(s.layout)) {
      const t = MAP_TILES.find(t => t.key === ch);
      cells.push(t ? t.v : T_FLOOR);
    }
    screens.push({
      cells,
      starts: (s.starts || []).map(p => [p[0] | 0, p[1] | 0])
                              .slice(0, MAP_SIZES[i].starts),
      items: MAP_ITEMS.map((_, k) => (s.items && s.items[k]) | 0)
    });
  }
  return { name: String(src.name || 'My map').slice(0, MAP_LIMITS.name),
           theme: Math.min(7, Math.max(1, src.theme | 0 || 1)), screens };
}

function mapCustomJSON() {
  const d = map.doc;
  return JSON.stringify({
    name: d.name, theme: d.theme,
    screens: d.screens.map((s, i) => ({
      layout: s.cells.map(v => (MAP_TILES.find(t => t.v === v) || MAP_TILES[0]).key).join(''),
      starts: s.starts.map(p => [p[0], p[1]]),
      items: s.items.slice()
    }))
  }, null, 2);
}

/* What the server will refuse, said before it refuses it. Each entry
   is one sentence naming the screen, because "too many items" with no
   screen attached sends people looking at the wrong one. */
function mapProblems() {
  const d = map.doc, out = [];
  if (!d.name.trim()) out.push(t('The map has no name.'));
  if (d.name.length > MAP_LIMITS.name)
    out.push(tf('The name is longer than {n} characters.',
                { n: MAP_LIMITS.name }));
  d.screens.forEach((s, i) => {
    const z = MAP_SIZES[i], where = z.w + ' x ' + z.h;
    /* Every line names the screen it is about, because three screens
       of one map produce three sets of these. The translation is asked
       for at the call rather than inside at(), so that a sweep over
       this file can see every line it has to carry. */
    const at = line => out.push(where + ': ' + line);
    if (s.starts.length < 2) at(t('fewer than two start points.'));
    if (s.starts.length > z.starts)
      at(tf('{n} start points, and this size takes {max}.',
            { n: s.starts.length, max: z.starts }));
    s.starts.forEach((p, k) => {
      const v = s.cells[p[1] * z.w + p[0]];
      if (v === undefined) at(tf('start {n} is off the field.', { n: k + 1 }));
      else if (v !== T_FLOOR) at(tf('start {n} is not on floor.', { n: k + 1 }));
    });
    const dup = new Set();
    for (const p of s.starts) {
      const k = p[0] + ',' + p[1];
      if (dup.has(k)) { at(t('two starts on the same tile.')); break; }
      dup.add(k);
    }
    const over = s.items.findIndex(n => n > MAP_LIMITS.item);
    if (over >= 0)
      at(tf('{item} is over {max}.',
            { item: t(MAP_ITEMS[over]), max: MAP_LIMITS.item }));
    const soft = s.cells.filter(v => v === T_SOFT).length;
    const items = s.items.reduce((a, b) => a + b, 0);
    if (items > soft)
      at(tf('{items} items but only {soft} breakable blocks to hide them in.',
            { items: items, soft: soft }));
  });
  return out;
}

/* ---------------------------- drawing ---------------------------- */

function mapSize() {
  return map.kind === 'custom' ? MAP_SIZES[map.screen] : { w: MAP_W, h: MAP_H };
}

function mapCells() {
  return map.kind === 'custom' ? map.doc.screens[map.screen].cells
                               : mapLayout(mapIndex());
}

function mapStarts() {
  if (map.kind === 'custom') return map.doc.screens[map.screen].starts;
  const r = mapRecord();
  return r ? r.spawns.filter(p => p[0] >= 0) : [];
}

function mapCSS(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v && v.trim()) || fallback;
}

function mapDraw() {
  const cv = $('mapView');
  if (!cv || !map.kind) return;
  const z = mapSize(), cells = mapCells();
  const box = cv.parentElement.getBoundingClientRect();
  /* The game's cell is 40 x 38, and keeping that ratio means a layout
     drawn here is the shape it will be in play rather than a square
     approximation of it. */
  const cw = Math.max(8, Math.floor(Math.min((box.width - 24) / z.w,
                                             (box.height - 24) / z.h * (40 / 38))));
  const ch = Math.max(8, Math.round(cw * 38 / 40));
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(z.w * cw * dpr);
  cv.height = Math.round(z.h * ch * dpr);
  cv.style.width = (z.w * cw) + 'px';
  cv.style.height = (z.h * ch) + 'px';
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const col = {
    floor:  mapCSS('--mapFloor',  '#2b3346'),
    soft:   mapCSS('--mapSoft',   '#8a6a3c'),
    hard:   mapCSS('--mapHard',   '#596274'),
    border: mapCSS('--mapBorder', '#11151f'),
    line:   mapCSS('--edge',      '#2a3142')
  };

  for (let y = 0; y < z.h; y++) {
    for (let x = 0; x < z.w; x++) {
      const v = cells[y * z.w + x], px = x * cw, py = y * ch;
      g.fillStyle = v === T_SOFT ? col.soft : v === T_HARD ? col.hard
                  : v === T_BORDER ? col.border : col.floor;
      g.fillRect(px, py, cw, ch);
      /* A bevel on the solid kinds: colour alone stops telling them
         apart the moment someone turns the theme down or prints it */
      if (v === T_SOFT || v === T_HARD) {
        g.fillStyle = 'rgba(255,255,255,.14)';
        g.fillRect(px, py, cw, Math.max(1, ch * 0.16));
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(px, py + ch - Math.max(1, ch * 0.16), cw, Math.max(1, ch * 0.16));
      }
      if (v === T_SOFT) {                       /* a seam, so it reads as a crate */
        g.strokeStyle = 'rgba(0,0,0,.28)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px + 0.5, py + ch / 2 + 0.5);
        g.lineTo(px + cw - 0.5, py + ch / 2 + 0.5);
        g.stroke();
      }
    }
  }

  g.strokeStyle = col.line;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= z.w; x++) { g.moveTo(x * cw + 0.5, 0); g.lineTo(x * cw + 0.5, z.h * ch); }
  for (let y = 0; y <= z.h; y++) { g.moveTo(0, y * ch + 0.5); g.lineTo(z.w * cw, y * ch + 0.5); }
  g.stroke();

  /* the objects, under the starts: a start on a gimmick is worth
     seeing, and the number has to stay readable over it */
  const rec = mapRecord();
  if (rec) {
    g.font = '600 ' + Math.max(8, Math.round(cw * 0.34)) + 'px system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const o of rec.objects) {
      if (o.x < 0 || o.y < 0 || o.x >= z.w || o.y >= z.h) continue;
      const px = o.x * cw + cw / 2, py = o.y * ch + ch / 2;
      g.fillStyle = mapCSS('--help', '#8b7cf6');
      g.beginPath();
      g.arc(px, py, Math.max(5, cw * 0.3), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(String(o.type), px, py + 0.5);
    }
  }

  const starts = mapStarts();
  g.font = '700 ' + Math.max(9, Math.round(cw * 0.4)) + 'px system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  starts.forEach((p, i) => {
    if (p[0] < 0 || p[1] < 0 || p[0] >= z.w || p[1] >= z.h) return;
    const px = p[0] * cw + cw / 2, py = p[1] * ch + ch / 2;
    g.fillStyle = mapCSS('--make', '#22c07a');
    g.beginPath();
    g.arc(px, py, Math.max(6, cw * 0.36), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#04120b';
    g.fillText(String(i + 1), px, py + 0.5);
  });

  cv.dataset.cw = cw;
  cv.dataset.ch = ch;
}

/* ---------------------------- the panel -------------------------- */

function mapEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function mapRenderAll() {
  mapRenderPanel();
  mapRenderStatus();
  mapDraw();
}

function mapRenderStatus() {
  const st = $('mapStat'), rt = $('mapRt');
  if (!st) return;
  if (map.kind === 'block') {
    const d = mapDistinct(map.set);
    st.textContent = map.name + ' -- set ' + map.set + ', variant ' + map.variant
      + ' of ' + MAP_VARIANTS + ' (' + d + ' distinct)';
  } else if (map.kind === 'custom') {
    const z = MAP_SIZES[map.screen];
    st.textContent = map.doc.name + ' -- ' + z.w + ' x ' + z.h + ', '
      + z.pw + ' x ' + z.ph + ' px, ' + z.players + ' players';
  }
  if (!rt) return;
  if (map.kind !== 'block') { rt.textContent = ''; rt.className = 'rt'; return; }
  const same = mapSameAsLoaded();
  rt.textContent = same ? 'unchanged' : 'edited';
  rt.className = 'rt ' + (same ? 'ok' : 'warn');
}

function mapSameAsLoaded() {
  if (!map.raw || !map.blocks || map.raw.length !== map.blocks.length) return false;
  for (let i = 0; i < map.raw.length; i++)
    if (map.raw[i] !== map.blocks[i]) return false;
  return true;
}

function mapRenderPanel() {
  const p = $('mapPanel');
  if (!p || !map.kind) return;
  p.innerHTML = '';

  if (map.kind === 'block') mapPanelBlock(p);
  else mapPanelCustom(p);

  /* the palette is the same question in both documents */
  const d = mapEl('details', 'dock');
  d.open = true;
  d.appendChild(mapEl('summary', null, 'Tiles'));
  const body = mapEl('div', 'dockBody');
  for (const t of MAP_TILES) {
    const b = mapEl('button', 'mapTile' + (map.tile === t.v ? ' on' : ''));
    const sw = mapEl('i', 'mapSw mapSw' + t.v);
    b.appendChild(sw);
    b.appendChild(mapEl('b', null, t.name));
    b.appendChild(mapEl('span', null, t.hint));
    b.onclick = () => { map.tile = t.v; mapRenderPanel(); };
    body.appendChild(b);
  }
  body.appendChild(mapEl('p', 'hint',
    'Drag to paint. Right-drag lays floor.'));
  d.appendChild(body);
  p.appendChild(d);

  mapPanelFormat(p);
}

/* What the open file actually is. The mesh side has a note like this
   and it earns its place: these two documents look the same on screen
   and are nothing alike on disk. */
function mapPanelFormat(p) {
  const d = mapEl('details', 'dock');
  d.appendChild(mapEl('summary', null, 'Format'));
  const b = mapEl('div', 'dockBody');
  if (map.kind === 'block') {
    b.appendChild(mapEl('p', 'hint',
      'block.spr is ' + MAP_SETS + ' sets x ' + MAP_VARIANTS + ' variants x '
      + MAP_VAR_BYTES + ' bytes: a 17 x 15 grid packed two tiles to a byte, '
      + 'high nibble first. 0 floor, 1 block, 2 pillar, 9 wall.'));
    b.appendChild(mapEl('p', 'hint',
      'Saving writes the whole file back. Anything you did not touch comes '
      + 'out byte for byte as it went in -- Check says so.'));
    b.appendChild(mapEl('p', 'hint',
      'map.spr is a different file: one record per set with the spawns, the '
      + 'gimmicks and the item counts. It is read here, never written.'));
  } else {
    b.appendChild(mapEl('p', 'hint',
      'A custom map is a record the server keeps, not a game file. It leaves '
      + 'here as JSON: the name, the theme and three screens, each a string '
      + 'of digits with the starts and the item counts beside it.'));
    b.appendChild(mapEl('p', 'hint',
      'The picture behind the field and the block artwork are uploaded in the '
      + 'panel, not here.'));
  }
  d.appendChild(b);
  p.appendChild(d);
}

function mapPanelBlock(p) {
  const d = mapEl('details', 'dock');
  d.open = true;
  d.appendChild(mapEl('summary', null, 'Set and variant'));
  const body = mapEl('div', 'dockBody');

  const row = mapEl('div', 'slider');
  row.appendChild(mapEl('span', null, 'set'));
  const si = document.createElement('input');
  si.type = 'range'; si.min = 0; si.max = MAP_SETS - 1; si.value = map.set;
  const so = mapEl('b', null, String(map.set));
  si.oninput = () => {
    map.set = si.valueAsNumber; so.textContent = map.set;
    mapRenderStatus(); mapDraw();
  };
  row.appendChild(si); row.appendChild(so);
  body.appendChild(row);

  const row2 = mapEl('div', 'slider');
  row2.appendChild(mapEl('span', null, 'variant'));
  const vi = document.createElement('input');
  vi.type = 'range'; vi.min = 0; vi.max = MAP_VARIANTS - 1; vi.value = map.variant;
  const vo = mapEl('b', null, String(map.variant));
  vi.oninput = () => {
    map.variant = vi.valueAsNumber; vo.textContent = map.variant;
    mapRenderStatus(); mapDraw();
  };
  row2.appendChild(vi); row2.appendChild(vo);
  body.appendChild(row2);

  body.appendChild(mapEl('p', 'hint',
    'A match picks a variant, so a set is a theme with a hundred rooms. '
    + 'Sixteen of the 46 repeat one layout a hundred times.'));

  const acts = mapEl('div', 'setActs');
  const bCopy = mapEl('button', null, 'Copy to every variant');
  bCopy.title = 'Make the whole set this one layout';
  bCopy.onclick = mapCopyAcrossSet;
  acts.appendChild(bCopy);
  const bRevert = mapEl('button', null, 'Revert this variant');
  bRevert.onclick = mapRevertVariant;
  acts.appendChild(bRevert);
  body.appendChild(acts);
  d.appendChild(body);
  p.appendChild(d);

  const rec = mapRecord();
  const info = mapEl('details', 'dock');
  info.open = true;
  info.appendChild(mapEl('summary', null, 'What map.spr says'));
  const ib = mapEl('div', 'dockBody');
  if (!rec) {
    ib.appendChild(mapEl('p', 'hint',
      'Open map.spr as well and the spawns, the gimmicks and the item '
      + 'counts of this set appear here and on the board.'));
  } else {
    const live = rec.spawns.filter(s => s[0] >= 0);
    ib.appendChild(mapEl('p', 'hint',
      live.length + ' start points, ' + rec.objects.length + ' objects.'));
    if (rec.objects.length) {
      const ul = mapEl('div', 'mapList');
      const byType = {};
      for (const o of rec.objects) (byType[o.type] = byType[o.type] || []).push(o);
      for (const t of Object.keys(byType).sort((a, b) => a - b)) {
        const line = mapEl('div', 'mapListRow');
        line.appendChild(mapEl('b', null, MAP_OBJECTS[t] || ('type ' + t)));
        line.appendChild(mapEl('span', null, byType[t].length + ' x'));
        ul.appendChild(line);
      }
      ib.appendChild(ul);
    }
    const counts = rec.items;
    const any = counts.some(n => n);
    if (any) {
      const ul = mapEl('div', 'mapList');
      counts.forEach((n, i) => {
        if (!n) return;
        const line = mapEl('div', 'mapListRow');
        line.appendChild(mapEl('b', null, MAP_ITEMS[i] || ('item ' + i)));
        line.appendChild(mapEl('span', null, String(n)));
        ul.appendChild(line);
      });
      ib.appendChild(ul);
    }
    ib.appendChild(mapEl('p', 'hint',
      'Read only. map.spr carries a fourteenth item slot nobody has '
      + 'identified, so this editor will not write the file back.'));
  }
  info.appendChild(ib);
  p.appendChild(info);
}

function mapPanelCustom(p) {
  const d = mapEl('details', 'dock');
  d.open = true;
  d.appendChild(mapEl('summary', null, 'The map'));
  const body = mapEl('div', 'dockBody');

  const nameRow = mapEl('div', 'ctl');
  nameRow.appendChild(mapEl('label', null, 'Name'));
  const ni = document.createElement('input');
  ni.type = 'text'; ni.maxLength = MAP_LIMITS.name; ni.value = map.doc.name;
  ni.oninput = () => { map.doc.name = ni.value; map.dirty = true; mapRenderStatus(); };
  nameRow.appendChild(ni);
  body.appendChild(nameRow);

  const themeRow = mapEl('div', 'ctl');
  themeRow.appendChild(mapEl('label', null, 'Theme'));
  const sel = document.createElement('select');
  MAP_THEMES.forEach((t, i) => {
    const o = document.createElement('option');
    o.value = i + 1; o.textContent = t;
    if (map.doc.theme === i + 1) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => { map.doc.theme = sel.value | 0; map.dirty = true; };
  themeRow.appendChild(sel);
  body.appendChild(themeRow);

  const tabs = mapEl('div', 'setChoice');
  MAP_SIZES.forEach((z, i) => {
    const b = mapEl('button', map.screen === i ? 'on' : null, z.w + ' x ' + z.h);
    b.title = z.pw + ' x ' + z.ph + ' px, ' + z.players + ' players';
    b.onclick = () => { map.screen = i; mapRenderAll(); };
    tabs.appendChild(b);
  });
  body.appendChild(tabs);
  body.appendChild(mapEl('p', 'hint',
    'Three screens, one per field size. A room uses the one that fits it, '
    + 'so all three want a layout.'));

  const acts = mapEl('div', 'setActs');
  const bClear = mapEl('button', null, 'Start this screen over');
  bClear.title = 'Back to the standard field, blocks and all';
  bClear.onclick = () => {
    map.doc.screens[map.screen] = mapClassicScreen(map.screen);
    map.dirty = true;
    mapRenderAll();
  };
  acts.appendChild(bClear);
  const bFill = mapEl('button', null, 'Fill with blocks');
  bFill.title = 'Every free floor tile becomes a breakable block, except around the starts';
  bFill.onclick = mapFillBlocks;
  acts.appendChild(bFill);
  const bBare = mapEl('button', null, 'Clear the blocks');
  bBare.title = 'Leave the pillars and the wall, take the breakable blocks away';
  bBare.onclick = () => {
    const cells = map.doc.screens[map.screen].cells;
    for (let i = 0; i < cells.length; i++)
      if (cells[i] === T_SOFT) cells[i] = T_FLOOR;
    map.dirty = true;
    mapRenderAll();
  };
  acts.appendChild(bBare);
  body.appendChild(acts);
  d.appendChild(body);
  p.appendChild(d);

  /* starts */
  const sd = mapEl('details', 'dock');
  sd.open = true;
  sd.appendChild(mapEl('summary', null, 'Start points'));
  const sb = mapEl('div', 'dockBody');
  const z = MAP_SIZES[map.screen], scr = map.doc.screens[map.screen];
  const list = mapEl('div', 'mapList');
  scr.starts.forEach((pt, i) => {
    const row = mapEl('div', 'mapListRow');
    row.appendChild(mapEl('b', null, 'Start ' + (i + 1)));
    row.appendChild(mapEl('span', null, pt[0] + ', ' + pt[1]));
    const place = mapEl('button', map.placing === i ? 'on' : null,
                        map.placing === i ? 'click the board' : 'move');
    place.onclick = () => { map.placing = map.placing === i ? -1 : i; mapRenderPanel(); };
    row.appendChild(place);
    const del = mapEl('button', null, 'x');
    del.title = 'Remove this start';
    del.onclick = () => {
      scr.starts.splice(i, 1); map.dirty = true; map.placing = -1; mapRenderAll();
    };
    row.appendChild(del);
    list.appendChild(row);
  });
  sb.appendChild(list);
  if (scr.starts.length < z.starts) {
    const add = mapEl('button', null, 'Add a start');
    add.onclick = () => {
      scr.starts.push([1, 1]);
      map.placing = scr.starts.length - 1;
      map.dirty = true;
      mapRenderAll();
    };
    sb.appendChild(add);
  }
  sb.appendChild(mapEl('p', 'hint',
    'This size takes up to ' + z.starts + '. A start has to sit on floor.'));
  sd.appendChild(sb);
  p.appendChild(sd);

  /* items */
  const id = mapEl('details', 'dock');
  id.appendChild(mapEl('summary', null, 'What the blocks hide'));
  const ib = mapEl('div', 'dockBody');
  const soft = scr.cells.filter(v => v === T_SOFT).length;
  const total = scr.items.reduce((a, b) => a + b, 0);
  ib.appendChild(mapEl('p', 'hint',
    total + ' items in ' + soft + ' breakable blocks.'));
  MAP_ITEMS.forEach((nm, i) => {
    const row = mapEl('div', 'slider');
    row.appendChild(mapEl('span', null, nm));
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = MAP_LIMITS.item; r.value = scr.items[i];
    const out = mapEl('b', null, String(scr.items[i]));
    r.oninput = () => {
      scr.items[i] = r.valueAsNumber; out.textContent = r.value;
      map.dirty = true;
    };
    r.onchange = () => mapRenderPanel();
    row.appendChild(r); row.appendChild(out);
    ib.appendChild(row);
  });
  id.appendChild(ib);
  p.appendChild(id);

  /* what the server will say */
  const pd = mapEl('details', 'dock');
  pd.open = true;
  pd.appendChild(mapEl('summary', null, 'Before you hand it over'));
  const pb = mapEl('div', 'dockBody');
  const problems = mapProblems();
  if (!problems.length) {
    pb.appendChild(mapEl('p', 'mapOk', 'Nothing here would be refused.'));
  } else {
    for (const t of problems) pb.appendChild(mapEl('p', 'mapBad', t));
  }
  pd.appendChild(pb);
  p.appendChild(pd);
}

/* --------------------------- operations -------------------------- */

function mapCopyAcrossSet() {
  if (map.kind !== 'block') return;
  const from = mapIndex() * MAP_VAR_BYTES;
  const one = map.blocks.slice(from, from + MAP_VAR_BYTES);
  for (let v = 0; v < MAP_VARIANTS; v++)
    map.blocks.set(one, (map.set * MAP_VARIANTS + v) * MAP_VAR_BYTES);
  map.dirty = true;
  notify(tf('set {n}: every variant is now this layout',
    { n: map.set }));
  mapRenderStatus();
}

function mapRevertVariant() {
  if (map.kind !== 'block' || !map.raw) return;
  const at = mapIndex() * MAP_VAR_BYTES;
  map.blocks.set(map.raw.subarray(at, at + MAP_VAR_BYTES), at);
  mapRenderAll();
}

function mapFillBlocks() {
  mapLayBlocks(map.doc.screens[map.screen], MAP_SIZES[map.screen]);
  map.dirty = true;
  mapRenderAll();
}

function mapPaintAt(ev, value) {
  const cv = $('mapView');
  if (!cv || !map.kind) return;
  const r = cv.getBoundingClientRect();
  const cw = +cv.dataset.cw, ch = +cv.dataset.ch, z = mapSize();
  const x = Math.floor((ev.clientX - r.left) / cw);
  const y = Math.floor((ev.clientY - r.top) / ch);
  if (x < 0 || y < 0 || x >= z.w || y >= z.h) return;
  const i = y * z.w + x;

  if (map.placing >= 0 && map.kind === 'custom') {
    const scr = map.doc.screens[map.screen];
    if (scr.starts[map.placing]) {
      scr.starts[map.placing] = [x, y];
      map.placing = -1;
      map.dirty = true;
      mapRenderAll();
    }
    return;
  }

  if (map.kind === 'custom') {
    const cells = map.doc.screens[map.screen].cells;
    if (cells[i] === value) return;
    cells[i] = value;
  } else {
    const g = mapLayout(mapIndex());
    if (g[i] === value) return;
    mapSetTile(mapIndex(), i, value);
  }
  map.dirty = true;
  mapDraw();
  mapRenderStatus();
}

/* ----------------------------- saving ---------------------------- */

function mapSave() {
  if (map.kind === 'block') {
    saveFile(map.name || 'block.spr', map.blocks, 'application/octet-stream');
  } else if (map.kind === 'custom') {
    const problems = mapProblems();
    if (problems.length)
      notify(problems.length + ' thing(s) the server would refuse -- see the panel', 1);
    const name = (map.doc.name || 'map').replace(/[^\w -]+/g, '').trim() || 'map';
    saveFile(name + '.json', new TextEncoder().encode(mapCustomJSON()),
             'application/json');
  }
}

/* The same check every other format here carries: write what was read
   and compare. Nothing has been edited yet means the bytes have to
   come back identical. */
function mapCheckRoundTrip() {
  if (map.kind !== 'block') {
    notify(t('only block.spr has a round trip')); return;
  }
  notify(mapSameAsLoaded()
    ? 'byte for byte the file that was opened'
    : 'edited -- ' + mapChangedCount() + ' variant(s) differ from the file as loaded');
}

function mapChangedCount() {
  let n = 0;
  for (let i = 0; i < map.blocks.length; i += MAP_VAR_BYTES) {
    for (let k = 0; k < MAP_VAR_BYTES; k++) {
      if (map.blocks[i + k] !== map.raw[i + k]) { n++; break; }
    }
  }
  return n;
}

/* ----------------------------- wiring ---------------------------- */

function mapWire() {
  const cv = $('mapView');
  if (!cv) return;

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!map.kind) return;
    cv.setPointerCapture(e.pointerId);
    map.painting = e.button === 2 ? 2 : 1;
    mapPaintAt(e, map.painting === 2 ? T_FLOOR : map.tile);
  });
  cv.addEventListener('pointermove', e => {
    if (!map.painting) return;
    mapPaintAt(e, map.painting === 2 ? T_FLOOR : map.tile);
  });
  const stop = () => {
    if (map.painting) { map.painting = 0; mapRenderPanel(); }
  };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);

  const nb = $('bMapNew');
  if (nb) nb.onclick = () => {
    map.kind = 'custom';
    map.name = 'map.json';
    map.doc = mapNewCustom();
    map.screen = 0;
    map.raw = null; map.blocks = null; map.dirty = false;
    if (typeof spriteClose === 'function') spriteClose();
    document.body.classList.add('map-mode');
    const e = $('empty');
    if (e) e.style.display = 'none';
    mapRenderAll();
  };
  const sb = $('bMapSave');
  if (sb) sb.onclick = mapSave;
  const rb = $('bMapRt');
  if (rb) rb.onclick = mapCheckRoundTrip;
  const xb = $('bMapClose');
  if (xb) xb.onclick = mapClose;

  window.addEventListener('resize', () => { if (map.kind) mapDraw(); });
}
