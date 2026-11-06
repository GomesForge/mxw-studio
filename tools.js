/* The frames and the colours, in a column against the rail.

   The frame strip and the colours were on the far right, past the
   measurements and the checks, which is a long way from a drawing. So
   they move next to the rail: the frames you can edit and the colours
   you are using, immediately beside the brushes that use them.

   It is a grid column, not a window. Every complaint about panels
   covering buttons had one cause -- something always wanted, floating
   over something always wanted -- and a column cannot overlap
   anything. Only its width is draggable, because position is the one
   decision there is nothing to decide about.

   The two docks are not copied here, they are moved. They carry their
   own wiring, and a second frame strip that drifted from the first
   would be worse than no second frame strip at all.

   The whole-frame operations used to be a third dock here. They are
   on the rail now, as icons: move it a pixel, turn it, draw a line
   round it, take a colour out. A photo editor's tool list is mostly
   about photographs -- healing, dodging, lens blur, twenty-seven
   blend modes -- and none of that survives contact with a 40-pixel
   character drawn two colours at a time. What survives is small and
   dull, and small and dull fits on a rail. */

const TOOLS_KEY = 'mxw.tools';
const TOOLS_MIN = 190, TOOLS_MAX = 460;

const tools = {
  open: false,
  w: 286,
  undo: [],              /* [{frames:[{i, runs}]}] -- one step is enough */
  scope: 'frame'         /* 'frame' | 'all' */
};

function toolsLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(TOOLS_KEY) || 'null');
    if (s && typeof s === 'object') {
      /* older builds stored a whole window rectangle; its width is the
         only part of it that still means anything */
      const w = typeof s.w === 'number' ? s.w : null;
      if (w) tools.w = Math.max(TOOLS_MIN, Math.min(TOOLS_MAX, w));
      tools.shut = !!s.shut;
      if (s.scope) tools.scope = s.scope;
    }
  } catch (e) { /* a browser that refuses storage still gets a panel */ }
}

function toolsSave() {
  try {
    localStorage.setItem(TOOLS_KEY, JSON.stringify(
      { w: tools.w, scope: tools.scope, shut: !!tools.shut }));
  } catch (e) { /* fine */ }
}

/* --------------------------- the column -------------------------- */

/* The column is a CSS variable on the grid, so opening and closing it
   is the grid relaying out rather than anything being covered up. */
function toolsApply() {
  const app = $('app');
  if (app) app.style.setProperty('--toolsW',
    (tools.open ? Math.round(tools.w) : 0) + 'px');
}

function toolsShow(on, byUser) {
  tools.open = on === undefined ? !tools.open : !!on;
  if (byUser) {
    tools.shut = !tools.open;
    toolsSave();
  }
  const el = $('tools');
  if (!el) return;
  el.hidden = !tools.open;
  if (!tools.open) {
    toolsRelease();
    toolsApply();
    return;
  }
  toolsAdopt();
  toolsApply();
  toolsRender();
  toolsSave();
}

/* Drag the right edge. Nothing else about the shape is negotiable. */
function toolsGripWire() {
  const grip = $('toolsGrip'), el = $('tools');
  if (!grip || !el) return;
  grip.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    grip.setPointerCapture(ev.pointerId);
    const x0 = ev.clientX, w0 = tools.w;
    const move = e2 => {
      tools.w = Math.max(TOOLS_MIN,
        Math.min(TOOLS_MAX, w0 + (e2.clientX - x0)));
      toolsApply();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      toolsSave();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });
}

/* ------------------------- which frames ------------------------- */

function toolsTargets() {
  const e = sprite.entry;
  if (!e) return [];
  if (tools.scope === 'all') return e.gra.frames.map((f, i) => i);
  return [sprite.frame];
}

function toolsPush(indices) {
  const g = sprite.entry.gra;
  tools.undo = [{ frames: indices.map(i => ({ i: i, runs: g.frames[i].runs })) }];
  toolsRailSync();
}

function toolsUndo() {
  const step = tools.undo.pop();
  if (!step || !sprite.entry) return;
  const g = sprite.entry.gra;
  for (const f of step.frames) if (g.frames[f.i]) g.frames[f.i].runs = f.runs;
  toolsRailSync();
  spriteRenderAll();
  spriteDraw();
  notify(t('put back'));
}

/* The pixel editor holds a copy of the frame it opened and writes it
   back when you apply. An operation on that same frame underneath it
   would be thrown away by that write, silently -- so land the editor's
   work first, and open it again on the result. Nothing is lost and the
   operation means the same thing whether or not the editor is open. */
function toolsSettle(idx) {
  if (typeof paint === 'undefined' || !paint.sessions ||
      typeof paintFind !== 'function') return false;
  const s = paintFind(x => x.owner && x.owner.kind === 'frame' &&
    x.owner.entry === sprite.entry && idx.indexOf(x.owner.frame) >= 0);
  if (!s) return false;
  if (s.id !== paint.id) paintSelect(s.id);
  paintApply();
  return true;
}

/* Every operation here is the same shape: read the frame as pixels,
   hand them to a function, write them back. Doing it in one place
   means the undo step and the redraw are never forgotten. */
function toolsOn(fn, say) {
  const e = sprite.entry;
  if (!e) return;
  const g = e.gra, w = g.width, h = g.height;
  const idx = toolsTargets();
  if (!idx.length) return;
  const reopen = toolsSettle(idx);
  toolsPush(idx);
  for (const i of idx) {
    const px = g.frames[i].toRGBA(w, h);
    const out = fn(px, w, h, i);
    if (out) g.replaceFrameRGBA(i, out);
  }
  spriteRenderAll();
  spriteDraw();
  if (reopen && typeof spritePaintFrame === 'function') spritePaintFrame();
  if (say) notify(say);
}

/* ------------------------- the operations ------------------------ */

/* Move the drawing inside the sheet. The sheet is a stamp pressed at
   a fixed place, so a pixel here is a pixel in the game -- this is
   the fine adjustment that Align does in one go for a whole sheet. */
function toolsNudge(dx, dy) {
  toolsOn((px, w, h) => {
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < h; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) {
        const sx = x - dx;
        if (sx < 0 || sx >= w) continue;
        const a = (sy * w + sx) * 4, b = (y * w + x) * 4;
        out[b] = px[a]; out[b + 1] = px[a + 1];
        out[b + 2] = px[a + 2]; out[b + 3] = px[a + 3];
      }
    }
    return out;
  }, tf('moved {dx}, {dy}', { dx: dx, dy: dy }));
}

/* Quarter turns, and only on a square sheet: on an oblong one a turn
   changes which side is which, and nothing in this format has a way
   to say that happened. */
function toolsRotate(quarters) {
  const e = sprite.entry;
  if (!e) return;
  const g = e.gra;
  if (g.width !== g.height) {
    notify(tf('a {w} x {h} sheet is not square, so a quarter turn would ' +
      'change its size', { w: g.width, h: g.height }), 1);
    return;
  }
  toolsOn((px, w, h) => {
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sx, sy;
        if (quarters === 1) { sx = y; sy = h - 1 - x; }
        else if (quarters === 2) { sx = w - 1 - x; sy = h - 1 - y; }
        else { sx = w - 1 - y; sy = x; }
        const a = (sy * w + sx) * 4, b = (y * w + x) * 4;
        out[b] = px[a]; out[b + 1] = px[a + 1];
        out[b + 2] = px[a + 2]; out[b + 3] = px[a + 3];
      }
    }
    return out;
  }, tf('turned {n} degrees', { n: quarters * 90 }));
}

/* A line round the silhouette, in the brush colour. Every sprite in
   this game has one; drawing it by hand on thirty-seven sheets is the
   kind of work a tool exists for. The four-way neighbourhood is the
   right one here -- eight would round the corners off a drawing made
   of squares. */
function toolsOutline(outside) {
  const rgb = hexToRgb(($('paintColour') && $('paintColour').value) || '#000000');
  toolsOn((px, w, h) => {
    const out = new Uint8ClampedArray(px);
    const on = i => px[i * 4 + 3] >= 128;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (outside ? on(i) : !on(i)) continue;
        const near = (x > 0 && on(i - 1)) || (x < w - 1 && on(i + 1)) ||
                     (y > 0 && on(i - w)) || (y < h - 1 && on(i + w));
        /* outside: an empty pixel touching the drawing. inside: a
           drawn pixel touching the outside, which is the same line
           one step in, and keeps the silhouette the size it was. */
        const edge = outside ? near
          : !((x > 0 && on(i - 1)) && (x < w - 1 && on(i + 1)) &&
              (y > 0 && on(i - w)) && (y < h - 1 && on(i + w)));
        if (!edge) continue;
        out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1];
        out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = 255;
      }
    }
    return out;
  }, t('outlined'));
}

/* Take one colour out of a frame, which is how a sprite loses a
   background somebody left behind, or a stray from an import. */
function toolsDropColour() {
  if (sprite.selected == null) {
    notify(t('pick a colour in the palette first'), 1);
    return;
  }
  const want = rgb565ToRgb(sprite.selected);
  toolsOn((px, w, h) => {
    const out = new Uint8ClampedArray(px);
    for (let i = 0; i < w * h; i++) {
      if (px[i * 4 + 3] < 128) continue;
      if (px[i * 4] === want[0] && px[i * 4 + 1] === want[1] &&
          px[i * 4 + 2] === want[2]) out[i * 4 + 3] = 0;
    }
    return out;
  }, t('that colour is gone'));
}

/* Trim what is drawn back to the middle of the sheet, by its own box.
   Useful on something imported from elsewhere, which lands wherever
   the other program had it. */
function toolsCentre(axis) {
  const e = sprite.entry;
  if (!e) return;
  const g = e.gra;
  const idx = toolsTargets();
  /* measuring comes after landing the editor's work, or the box is
     the one from before the last few strokes */
  const reopen = toolsSettle(idx);
  const back = () => {
    if (reopen && typeof spritePaintFrame === 'function') spritePaintFrame();
  };
  let x0 = g.width, y0 = g.height, x1 = -1, y1 = -1;
  for (const i of idx) {
    const bb = g.frames[i].bbox();
    if (!bb) continue;
    x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]);
    x1 = Math.max(x1, bb[2] - 1); y1 = Math.max(y1, bb[3] - 1);
  }
  if (x1 < x0) { notify(t('nothing drawn to centre'), 1); back(); return; }
  const dx = axis === 'v' ? 0 : Math.round((g.width - 1 - x1 - x0) / 2);
  const dy = axis === 'h' ? 0 : Math.round((g.height - 1 - y1 - y0) / 2);
  if (!dx && !dy) { notify(t('already centred')); back(); return; }
  toolsNudge(dx, dy);
  back();
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
           : [0, 0, 0];
}

/* ---------------------------- the panel -------------------------- */

/* The docks move rather than being rebuilt, so every listener they
   already carry keeps working and there is only ever one frame strip.
   Moving means they are somewhere, never nowhere: where they came
   from is remembered, and closing the window puts them back.

   The first version of this did not, and the frames and the colours
   simply vanished -- the window they had moved into starts closed. A
   panel that can take something away has to be able to give it back
   in the same gesture. */
const TOOLS_HOME = [];

function toolsRemember() {
  if (TOOLS_HOME.length) return;
  for (const id of ['frameDock', 'colourDock']) {
    const dock = $(id);
    if (dock) TOOLS_HOME.push({ dock: dock, parent: dock.parentNode,
                                before: dock.nextElementSibling });
  }
}

function toolsAdopt() {
  const body = $('toolsDocks');
  if (!body) return;
  toolsRemember();
  for (const h of TOOLS_HOME)
    if (h.dock.parentNode !== body) body.appendChild(h.dock);
}

/* Backwards, because each one is put back in front of the one that
   followed it: the last has to be home before the one before it can
   aim at it. Forwards, the first lands at the end and the order comes
   back shuffled. */
function toolsRelease() {
  for (let i = TOOLS_HOME.length - 1; i >= 0; i--) {
    const h = TOOLS_HOME[i];
    if (!h.parent || h.dock.parentNode === h.parent) continue;
    h.parent.insertBefore(h.dock,
      h.before && h.before.parentNode === h.parent ? h.before : null);
  }
}

/* A sheet arriving opens the window, unless it was closed on purpose.
   The frames and the colours have to be somewhere the moment there is
   something to use them on. */
function toolsMaybeOpen() {
  if (sprite.entry && !tools.open && !tools.shut) toolsShow(true);
}

function toolsRender() {
  toolsRailSync();
  const panel = $('tools');
  if (!panel || panel.hidden) return;
  const empty = $('toolsEmpty');
  const docks = $('toolsDocks');
  if (empty) empty.hidden = !!sprite.entry;
  if (docks) docks.hidden = !sprite.entry;
}

/* The rail's lower half acts on the frames of a sheet, so it is dark
   until there is a sheet, and the turns are dark unless the frame is
   square -- a quarter turn of a 40 by 56 frame has nowhere to put the
   corners. The first button is not an action but a statement of how
   many frames the rest of them mean. */
function toolsRailSync() {
  const e = typeof sprite !== 'undefined' ? sprite.entry : null;
  const live = !!(e && !e.gra.eft);
  const sq = !!(live && e.gra.width === e.gra.height);
  const all = tools.scope === 'all';

  const set = (id, ok) => { const b = $(id); if (b) b.disabled = !ok; };
  for (const id of ['bRailLeft', 'bRailUp', 'bRailDown', 'bRailRight',
                    'bRailOutline', 'bRailInline', 'bRailDrop',
                    'bRailScope']) set(id, live);
  for (const id of ['bRailRotL', 'bRailRotR', 'bRailRot2']) set(id, sq);
  set('bRailUndoOp', live && tools.undo.length > 0);

  const sc = $('bRailScope');
  if (sc) {
    sc.classList.toggle('on', all);
    const use = sc.querySelector('use');
    if (use) use.setAttribute('href', all ? '#i-all' : '#i-one');
    sc.title = all
      ? t('These act on every frame -- click for this frame only')
      : t('These act on this frame -- click for every frame');
  }
}

function toolsWire() {
  toolsLoad();
  toolsRemember();
  toolsGripWire();
  toolsApply();

  const b = $('bTools');
  if (b) b.addEventListener('click', () => toolsShow(!tools.open, true));
  const x = $('toolsX');
  if (x) x.addEventListener('click', () => toolsShow(false, true));

  const on = (id, fn) => { const e2 = $(id); if (e2) e2.addEventListener('click', fn); };
  on('bRailScope', () => {
    tools.scope = tools.scope === 'all' ? 'frame' : 'all';
    toolsSave();
    toolsRailSync();
    notify(t(tools.scope === 'all'
      ? 'the frame tools now act on every frame'
      : 'the frame tools now act on this frame'));
  });
  on('bRailUp', () => toolsNudge(0, -1));
  on('bRailDown', () => toolsNudge(0, 1));
  on('bRailLeft', () => toolsNudge(-1, 0));
  on('bRailRight', () => toolsNudge(1, 0));
  on('bRailRotL', () => toolsRotate(3));
  on('bRailRotR', () => toolsRotate(1));
  on('bRailRot2', () => toolsRotate(2));
  on('bRailOutline', () => toolsOutline(true));
  on('bRailInline', () => toolsOutline(false));
  on('bRailDrop', toolsDropColour);
  on('bRailUndoOp', toolsUndo);
  toolsRailSync();
}
