/* The frame tools, in the corner where the work is.

   The frame strip and the colours were on the far right, past the
   measurements and the checks, which is a long way from a drawing. So
   they move into a window of their own in the near corner: the frames
   you can edit, the colours you are using, the brushes, and the
   handful of operations that act on a whole frame at once.

   The two docks are not copied here, they are moved. They carry their
   own wiring, and a second frame strip that drifted from the first
   would be worse than no second frame strip at all.

   The operations are the ones a sprite actually wants. A photo editor's
   tool list is mostly about photographs -- healing, dodging, lens
   blur, twenty-seven blend modes -- and none of that survives contact
   with a 40-pixel character drawn two colours at a time. What does
   survive is small and dull: move it a pixel, turn it, draw a line
   round it, take a colour out. Those are here. */

const TOOLS_KEY = 'mxw.tools';

const tools = {
  open: false,
  pos: { x: 0, y: 0, w: 304, h: 560 },
  placed: false,
  undo: [],              /* [{frames:[{i, runs}]}] -- one step is enough */
  scope: 'frame'         /* 'frame' | 'all' */
};

function toolsLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(TOOLS_KEY) || 'null');
    if (s && typeof s === 'object') {
      for (const k of ['x', 'y', 'w', 'h'])
        if (typeof s[k] === 'number') tools.pos[k] = s[k];
      tools.placed = !!s.placed;
      tools.pos.moved = !!s.moved;
      tools.shut = !!s.shut;
      if (s.scope) tools.scope = s.scope;
    }
  } catch (e) { /* a browser that refuses storage still gets a panel */ }
}

function toolsSave() {
  try {
    localStorage.setItem(TOOLS_KEY, JSON.stringify(Object.assign(
      { placed: tools.placed, scope: tools.scope, shut: !!tools.shut,
        moved: !!tools.pos.moved }, tools.pos)));
  } catch (e) { /* fine */ }
}

/* --------------------------- the window -------------------------- */

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
    if (typeof panelArrange === 'function') panelArrange();
    return;
  }
  toolsAdopt();
  if (!tools.placed) {
    Object.assign(tools.pos, panelCorner('left', 304, 560));
    tools.placed = true;
  }
  panelClamp(tools.pos, { w: 240, W: 520, h: 200 });
  panelApply(el, tools.pos);
  if (typeof panelArrange === 'function') panelArrange();
  toolsRender();
  toolsSave();
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
  const b = $('bToolUndo');
  if (b) b.disabled = false;
}

function toolsUndo() {
  const step = tools.undo.pop();
  if (!step || !sprite.entry) return;
  const g = sprite.entry.gra;
  for (const f of step.frames) if (g.frames[f.i]) g.frames[f.i].runs = f.runs;
  const b = $('bToolUndo');
  if (b) b.disabled = true;
  spriteRenderAll();
  spriteDraw();
  notify(t('put back'));
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
  toolsPush(idx);
  for (const i of idx) {
    const px = g.frames[i].toRGBA(w, h);
    const out = fn(px, w, h, i);
    if (out) g.replaceFrameRGBA(i, out);
  }
  spriteRenderAll();
  spriteDraw();
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
  let x0 = g.width, y0 = g.height, x1 = -1, y1 = -1;
  for (const i of idx) {
    const bb = g.frames[i].bbox();
    if (!bb) continue;
    x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]);
    x1 = Math.max(x1, bb[2] - 1); y1 = Math.max(y1, bb[3] - 1);
  }
  if (x1 < x0) { notify(t('nothing drawn to centre'), 1); return; }
  const dx = axis === 'v' ? 0 : Math.round((g.width - 1 - x1 - x0) / 2);
  const dy = axis === 'h' ? 0 : Math.round((g.height - 1 - y1 - y0) / 2);
  if (!dx && !dy) { notify(t('already centred')); return; }
  toolsNudge(dx, dy);
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
  const on = !!(sprite.entry && !sprite.entry.gra.eft);
  const panel = $('tools');
  if (!panel || panel.hidden) return;
  const empty = $('toolsEmpty');
  const docks = $('toolsDocks'), ops = $('toolsOps');
  if (empty) empty.hidden = !!sprite.entry;
  if (docks) docks.hidden = !sprite.entry;
  if (ops) ops.hidden = !on;
  const sq = sprite.entry && sprite.entry.gra.width === sprite.entry.gra.height;
  for (const id of ['bToolRotL', 'bToolRotR', 'bToolRot2']) {
    const b = $(id);
    if (b) b.disabled = !sq;
  }
}

/* Entering the pixel editor and choosing a tool in one click: the
   tools down the left only exist while a frame is open for editing,
   so asking for one is also asking to edit. */
function toolsPick(name) {
  if (!sprite.entry) { notify(t('open a sheet first'), 1); return; }
  if (!(typeof paint !== 'undefined' && paint.open && paint.owner &&
        paint.owner.kind === 'frame' && paint.owner.entry === sprite.entry &&
        paint.owner.frame === sprite.frame)) {
    spritePaintFrame();
  }
  const b = document.querySelector('#paintTools [data-tool="' + name + '"]');
  if (b) b.click();
}

function toolsWire() {
  toolsLoad();
  toolsRemember();
  const el = $('tools');
  if (el) {
    panelWindow({
      el: el, head: $('toolsHead'), grip: $('toolsGrip'),
      pos: tools.pos, min: { w: 240, W: 520, h: 200 }, order: 0,
      onDone: toolsSave
    });
  }
  const b = $('bTools');
  if (b) b.addEventListener('click', () => toolsShow(!tools.open, true));
  const x = $('toolsX');
  if (x) x.addEventListener('click', () => toolsShow(false, true));

  const pick = $('toolsPick');
  if (pick) pick.addEventListener('click', ev => {
    const b2 = ev.target.closest('[data-pick]');
    if (b2) toolsPick(b2.dataset.pick);
  });

  const scope = $('toolsScope');
  if (scope) {
    scope.value = tools.scope;
    scope.addEventListener('change', () => {
      tools.scope = scope.value;
      toolsSave();
    });
  }

  const on = (id, fn) => { const e2 = $(id); if (e2) e2.addEventListener('click', fn); };
  on('bToolUp', () => toolsNudge(0, -1));
  on('bToolDown', () => toolsNudge(0, 1));
  on('bToolLeft', () => toolsNudge(-1, 0));
  on('bToolRight', () => toolsNudge(1, 0));
  on('bToolRotL', () => toolsRotate(3));
  on('bToolRotR', () => toolsRotate(1));
  on('bToolRot2', () => toolsRotate(2));
  on('bToolOutline', () => toolsOutline(true));
  on('bToolInline', () => toolsOutline(false));
  on('bToolDrop', toolsDropColour);
  on('bToolCentreH', () => toolsCentre('h'));
  on('bToolCentreV', () => toolsCentre('v'));
  on('bToolUndo', toolsUndo);
  const u = $('bToolUndo');
  if (u) u.disabled = true;
}
