/* A pixel editor with layers, used for both mesh textures and sprite
   frames. Opens over the viewport, edits an RGBA bitmap, and hands the
   flattened result back through onApply so the caller can encode it
   into whichever format it came from.

   Layers live only inside this editor -- neither file format stores
   them -- so they are flattened on apply. That is still worth having:
   it lets you draw over the original without destroying it, and back
   out of a change you do not like.

   paintOpen({width, height, base, uv, title, onApply}) */

const paint = {
  open: false,
  w: 0, h: 0,
  layers: [],        /* [{name, visible, opacity, cv, ctx}] */
  active: 0,
  tool: 'brush',
  colour: '#e8464a',
  size: 1,
  zoom: 6,
  showUV: true,
  showGrid: true,
  uv: null,          /* [[{x,y}...]...] polygons, in image pixels */
  onApply: null,
  title: '',
  undo: [],
  redo: [],
  drawing: false,
  last: null,
  anchor: null,
  panning: false,
  panStart: null,
  scrollStart: null
};

const PAINT_UNDO_CAP = 40;

function paintLayer(name, w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return { name, visible: true, opacity: 1, cv, ctx };
}

function paintOpen(opts) {
  paint.w = opts.width;
  paint.h = opts.height;
  paint.uv = opts.uv || null;
  paint.onApply = opts.onApply;
  paint.title = opts.title || '';
  paint.layers = [];
  paint.active = 0;
  paint.undo = [];
  paint.redo = [];

  const base = paintLayer('base', paint.w, paint.h);
  if (opts.base) {
    base.ctx.putImageData(new ImageData(
      opts.base instanceof Uint8ClampedArray ? opts.base
        : new Uint8ClampedArray(opts.base), paint.w, paint.h), 0, 0);
  }
  paint.layers.push(base);

  paint.open = true;
  document.body.classList.add('paint-mode');
  $('paintTitle').textContent = paint.title +
    '   ' + paint.w + 'x' + paint.h;
  paintFit();
  paintRenderLayers();
  paintRenderTools();
  paintDraw();
}

function paintClose() {
  paint.open = false;
  paint.layers = [];
  paint.undo = [];
  paint.redo = [];
  document.body.classList.remove('paint-mode');
}

/* pick a zoom that makes the image fill a good part of the panel */
function paintFit() {
  const host = $('paintStage');
  const box = host.getBoundingClientRect();
  const fit = Math.min((box.width - 40) / paint.w, (box.height - 40) / paint.h);
  paint.zoom = Math.max(1, Math.min(16, Math.floor(fit) || 1));
  $('paintZoom').value = paint.zoom;
  $('paintZoomOut').textContent = paint.zoom + 'x';
}

/* ------------------------------ display -------------------------- */
function paintComposite() {
  const cv = document.createElement('canvas');
  cv.width = paint.w; cv.height = paint.h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const L of paint.layers) {
    if (!L.visible) continue;
    ctx.globalAlpha = L.opacity;
    ctx.drawImage(L.cv, 0, 0);
  }
  ctx.globalAlpha = 1;
  return cv;
}

function paintDraw() {
  if (!paint.open) return;
  const cv = $('paintCanvas');
  const z = paint.zoom;
  cv.width = paint.w * z;
  cv.height = paint.h * z;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(paintComposite(), 0, 0, cv.width, cv.height);

  /* the UV layout of the faces that use this texture, so a garment
     can be painted in the right place */
  if (paint.showUV && paint.uv && paint.uv.length) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(58,212,236,.8)';
    for (const poly of paint.uv) {
      ctx.beginPath();
      poly.forEach((p, i) => {
        const x = p.x * z, y = p.y * z;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }
  if (paint.showGrid && z >= 6) {
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= paint.w; x++) { ctx.moveTo(x * z, 0); ctx.lineTo(x * z, cv.height); }
    for (let y = 0; y <= paint.h; y++) { ctx.moveTo(0, y * z); ctx.lineTo(cv.width, y * z); }
    ctx.stroke();
  }
}

/* ------------------------------ history -------------------------- */
function paintPush() {
  const L = paint.layers[paint.active];
  if (!L) return;
  paint.undo.push({
    layer: paint.active,
    data: L.ctx.getImageData(0, 0, paint.w, paint.h)
  });
  if (paint.undo.length > PAINT_UNDO_CAP) paint.undo.shift();
  paint.redo = [];
  paintRenderTools();
}

function paintUndo() {
  const step = paint.undo.pop();
  if (!step) { notify('nothing to undo'); return; }
  const L = paint.layers[step.layer];
  if (L) {
    paint.redo.push({ layer: step.layer,
                      data: L.ctx.getImageData(0, 0, paint.w, paint.h) });
    L.ctx.putImageData(step.data, 0, 0);
  }
  paintDraw();
  paintRenderLayers();
  paintRenderTools();
}

function paintRedo() {
  const step = paint.redo.pop();
  if (!step) { notify('nothing to redo'); return; }
  const L = paint.layers[step.layer];
  if (L) {
    paint.undo.push({ layer: step.layer,
                      data: L.ctx.getImageData(0, 0, paint.w, paint.h) });
    L.ctx.putImageData(step.data, 0, 0);
  }
  paintDraw();
  paintRenderLayers();
  paintRenderTools();
}

/* ------------------------------- tools --------------------------- */
function paintPixelAt(ev) {
  const cv = $('paintCanvas');
  const r = cv.getBoundingClientRect();
  return {
    x: Math.floor((ev.clientX - r.left) / (r.width / paint.w)),
    y: Math.floor((ev.clientY - r.top) / (r.height / paint.h))
  };
}

function paintDot(ctx, x, y, erase) {
  const s = paint.size;
  const o = Math.floor((s - 1) / 2);
  ctx.save();
  if (erase) {
    ctx.clearRect(x - o, y - o, s, s);
  } else {
    ctx.fillStyle = paint.colour;
    ctx.fillRect(x - o, y - o, s, s);
  }
  ctx.restore();
}

function paintLine(ctx, a, b, erase) {
  /* Bresenham, so a fast drag still leaves a connected stroke */
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    paintDot(ctx, x0, y0, erase);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function paintRect(ctx, a, b, erase, filled) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x) + 1, h = Math.abs(b.y - a.y) + 1;
  if (erase) { ctx.clearRect(x, y, w, h); return; }
  ctx.fillStyle = paint.colour;
  if (filled) { ctx.fillRect(x, y, w, h); return; }
  const s = paint.size;
  ctx.fillRect(x, y, w, s);
  ctx.fillRect(x, y + h - s, w, s);
  ctx.fillRect(x, y, s, h);
  ctx.fillRect(x + w - s, y, s, h);
}

function hexToRgba(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/* Flood fill on the active layer, four-connected, with a tolerance so
   an anti-aliased edge does not stop it dead. */
function paintFill(ctx, start) {
  const img = ctx.getImageData(0, 0, paint.w, paint.h);
  const d = img.data;
  const at = (x, y) => (y * paint.w + x) * 4;
  const o = at(start.x, start.y);
  const target = [d[o], d[o + 1], d[o + 2], d[o + 3]];
  const fill = hexToRgba(paint.colour);
  if (target[0] === fill[0] && target[1] === fill[1] &&
      target[2] === fill[2] && target[3] === fill[3]) return;
  const tol = 24;
  const match = i =>
    Math.abs(d[i] - target[0]) <= tol &&
    Math.abs(d[i + 1] - target[1]) <= tol &&
    Math.abs(d[i + 2] - target[2]) <= tol &&
    Math.abs(d[i + 3] - target[3]) <= tol;
  const stack = [[start.x, start.y]];
  const seen = new Uint8Array(paint.w * paint.h);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= paint.w || y >= paint.h) continue;
    const k = y * paint.w + x;
    if (seen[k]) continue;
    const i = k * 4;
    if (!match(i)) continue;
    seen[k] = 1;
    d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = fill[3];
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

function paintPick(pt) {
  const cv = paintComposite();
  const d = cv.getContext('2d').getImageData(pt.x, pt.y, 1, 1).data;
  if (!d[3]) { notify('that pixel is transparent'); return; }
  paint.colour = '#' + [d[0], d[1], d[2]]
    .map(x => x.toString(16).padStart(2, '0')).join('');
  $('paintColour').value = paint.colour;
  paint.tool = 'brush';
  paintRenderTools();
}

/* ------------------------------ pointer -------------------------- */
function paintDown(ev) {
  if (!paint.open) return;
  if (ev.button === 1 || ev.shiftKey) {       /* pan */
    paint.panning = true;
    const host = $('paintStage');
    paint.panStart = { x: ev.clientX, y: ev.clientY };
    paint.scrollStart = { x: host.scrollLeft, y: host.scrollTop };
    ev.preventDefault();
    return;
  }
  const L = paint.layers[paint.active];
  if (!L) return;
  if (!L.visible) { notify('the active layer is hidden', 1); return; }
  const pt = paintPixelAt(ev);
  if (pt.x < 0 || pt.y < 0 || pt.x >= paint.w || pt.y >= paint.h) return;

  if (paint.tool === 'picker') { paintPick(pt); return; }

  paintPush();
  paint.drawing = true;
  paint.last = pt;
  paint.anchor = pt;
  const erase = paint.tool === 'eraser';
  if (paint.tool === 'brush' || erase) paintDot(L.ctx, pt.x, pt.y, erase);
  else if (paint.tool === 'fill') { paintFill(L.ctx, pt); paint.drawing = false; }
  paintDraw();
}

function paintMove(ev) {
  if (paint.panning) {
    const host = $('paintStage');
    host.scrollLeft = paint.scrollStart.x - (ev.clientX - paint.panStart.x);
    host.scrollTop = paint.scrollStart.y - (ev.clientY - paint.panStart.y);
    return;
  }
  if (!paint.drawing) return;
  const L = paint.layers[paint.active];
  const pt = paintPixelAt(ev);
  const erase = paint.tool === 'eraser';
  if (paint.tool === 'brush' || erase) {
    paintLine(L.ctx, paint.last, pt, erase);
    paint.last = pt;
    paintDraw();
  } else if (paint.tool === 'line' || paint.tool === 'rect' ||
             paint.tool === 'rectfill') {
    /* preview from the snapshot so the shape follows the cursor */
    const snap = paint.undo[paint.undo.length - 1];
    if (snap && snap.layer === paint.active) L.ctx.putImageData(snap.data, 0, 0);
    if (paint.tool === 'line') paintLine(L.ctx, paint.anchor, pt, false);
    else paintRect(L.ctx, paint.anchor, pt, false, paint.tool === 'rectfill');
    paintDraw();
  }
}

function paintUp() {
  paint.panning = false;
  if (!paint.drawing) return;
  paint.drawing = false;
  paintRenderLayers();
}

/* ------------------------------ layers --------------------------- */
function paintRenderLayers() {
  const host = $('layerList');
  host.innerHTML = '';
  /* topmost first, which is how every editor shows a stack */
  for (let i = paint.layers.length - 1; i >= 0; i--) {
    const L = paint.layers[i];
    const row = document.createElement('div');
    row.className = 'layer' + (i === paint.active ? ' sel' : '');
    const thumb = document.createElement('canvas');
    thumb.width = 28; thumb.height = 28;
    const tc = thumb.getContext('2d');
    tc.imageSmoothingEnabled = false;
    tc.drawImage(L.cv, 0, 0, 28, 28);
    row.innerHTML =
      '<button class="eye" title="show or hide">' + (L.visible ? '&#9679;' : '&#9675;') + '</button>' +
      '<span class="lname">' + L.name + '</span>' +
      '<input class="lop" type="range" min="0" max="100" value="' +
      Math.round(L.opacity * 100) + '" title="opacity">';
    row.insertBefore(thumb, row.firstChild);
    row.onclick = e => {
      if (e.target.classList.contains('eye') ||
          e.target.classList.contains('lop')) return;
      paint.active = i;
      paintRenderLayers();
    };
    row.querySelector('.eye').onclick = () => {
      L.visible = !L.visible;
      paintRenderLayers();
      paintDraw();
    };
    row.querySelector('.lop').oninput = e => {
      L.opacity = (+e.target.value) / 100;
      paintDraw();
    };
    host.appendChild(row);
  }
  $('layerCount').textContent = paint.layers.length +
    (paint.layers.length === 1 ? ' layer' : ' layers') +
    ' — flattened when you apply';
}

function paintAddLayer() {
  const L = paintLayer('layer ' + paint.layers.length, paint.w, paint.h);
  paint.layers.push(L);
  paint.active = paint.layers.length - 1;
  paintRenderLayers();
  notify('added an empty layer on top -- draw over the original without touching it');
}

function paintDeleteLayer() {
  if (paint.layers.length < 2) { notify('the base layer cannot be removed', 1); return; }
  paint.layers.splice(paint.active, 1);
  paint.active = Math.max(0, paint.active - 1);
  paint.undo = paint.undo.filter(s => s.layer < paint.layers.length);
  paint.redo = [];
  paintRenderLayers();
  paintDraw();
}

function paintMergeDown() {
  if (paint.active === 0) { notify('the base layer has nothing under it', 1); return; }
  const top = paint.layers[paint.active];
  const under = paint.layers[paint.active - 1];
  under.ctx.globalAlpha = top.opacity;
  under.ctx.drawImage(top.cv, 0, 0);
  under.ctx.globalAlpha = 1;
  paint.layers.splice(paint.active, 1);
  paint.active -= 1;
  paint.undo = [];
  paint.redo = [];
  paintRenderLayers();
  paintDraw();
  notify('merged down');
}

/* ------------------------------ toolbar -------------------------- */
function paintRenderTools() {
  document.querySelectorAll('#paintTools button[data-tool]').forEach(b =>
    b.classList.toggle('on', b.dataset.tool === paint.tool));
  $('bPaintUndo').disabled = !paint.undo.length;
  $('bPaintRedo').disabled = !paint.redo.length;
  $('paintSizeOut').textContent = paint.size + ' px';
  paintRenderTint();
}

/* The 64 values the game substitutes at run time, as a strip you can
   paint from deliberately -- and a warning when the current colour
   happens to be one of them. */
function paintRenderTint() {
  const host = $('tintRamp');
  if (!host) return;
  const cur = paintColourAs565();
  if (host.childElementCount !== TINT_STEPS) {
    host.innerHTML = '';
    for (let i = 0; i < TINT_STEPS; i++) {
      const v = tintColour(i);
      const c = rgb565ToRgb(v);
      const b = document.createElement('button');
      b.dataset.i = i;
      b.title = 'reserved step ' + i + ' of 63';
      b.style.background = '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
      b.onclick = () => {
        const cc = rgb565ToRgb(tintColour(+b.dataset.i));
        paint.colour = '#' + cc.map(x => x.toString(16).padStart(2, '0')).join('');
        $('paintColour').value = paint.colour;
        paintRenderTools();
      };
      host.appendChild(b);
    }
  }
  const idx = tintIndexOf(cur);
  host.querySelectorAll('button').forEach(b =>
    b.classList.toggle('sel', +b.dataset.i === idx));
  const warn = $('tintWarn');
  if (!warn) return;
  if (idx >= 0) {
    warn.style.display = 'block';
    warn.textContent = 'The current colour is reserved step ' + idx +
      '. Anything you paint with it will be recoloured by the game.';
  } else {
    warn.style.display = 'none';
  }
}

function paintColourAs565() {
  const m = /^#?([0-9a-f]{6})$/i.exec(paint.colour);
  if (!m) return -1;
  const n = parseInt(m[1], 16);
  return rgbToRgb565((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function paintApply() {
  if (!paint.onApply) return;
  const cv = paintComposite();
  const rgba = cv.getContext('2d').getImageData(0, 0, paint.w, paint.h).data;
  paint.onApply(rgba);
  paintClose();
}

function paintWire() {
  $('paintCanvas').addEventListener('mousedown', paintDown);
  addEventListener('mousemove', paintMove);
  addEventListener('mouseup', paintUp);
  $('paintCanvas').addEventListener('contextmenu', e => e.preventDefault());

  document.querySelectorAll('#paintTools button[data-tool]').forEach(b =>
    b.onclick = () => { paint.tool = b.dataset.tool; paintRenderTools(); });
  $('paintColour').oninput = e => {
    paint.colour = e.target.value;
    paintRenderTint();
  };
  $('paintSize').oninput = e => {
    paint.size = Math.max(1, Math.min(32, +e.target.value || 1));
    paintRenderTools();
  };
  $('paintZoom').oninput = e => {
    paint.zoom = Math.max(1, Math.min(16, +e.target.value || 6));
    $('paintZoomOut').textContent = paint.zoom + 'x';
    paintDraw();
  };
  $('bPaintUndo').onclick = paintUndo;
  $('bPaintRedo').onclick = paintRedo;
  $('bLayerAdd').onclick = paintAddLayer;
  $('bLayerDel').onclick = paintDeleteLayer;
  $('bLayerMerge').onclick = paintMergeDown;
  $('bPaintUV').onclick = () => {
    paint.showUV = !paint.showUV;
    $('bPaintUV').classList.toggle('on', paint.showUV);
    paintDraw();
  };
  $('bPaintGrid').onclick = () => {
    paint.showGrid = !paint.showGrid;
    $('bPaintGrid').classList.toggle('on', paint.showGrid);
    paintDraw();
  };
  $('bPaintApply').onclick = paintApply;
  $('bPaintCancel').onclick = () => {
    paintClose();
    notify('closed without applying');
  };

  addEventListener('keydown', e => {
    if (!paint.open) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? paintRedo() : paintUndo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault(); paintRedo();
    } else if (e.key === 'Escape') {
      paintClose();
    } else if (!mod) {
      const k = { b: 'brush', e: 'eraser', g: 'fill', i: 'picker',
                  l: 'line', r: 'rect', f: 'rectfill' }[e.key.toLowerCase()];
      if (k) { paint.tool = k; paintRenderTools(); }
    }
  });
}
