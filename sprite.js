/* Sprite mode: frame playback, palette editing that propagates across
   an animation, and PNG import/export. Depends on gra.js.

   Editing one frame in isolation is usually the wrong unit of work --
   a character's frames are the same artwork in different poses, so a
   recolour has to reach every frame at once. These files store direct
   RGB565 rather than palette indices, so "palette editing" here means
   remapping the colours that are actually present, which is exactly
   what propagates cleanly. */

const sprite = {
  entry: null,          /* {name, raw, gra} */
  frame: 0,
  playing: false,
  fps: 12,
  zoom: 3,
  timer: null,
  selected: null,       /* the rgb565 value picked in the palette */
  applyAll: true,
  team: 'none'          /* preview a team palette over the reserved ramp */
};

/* Render a frame to RGBA, optionally substituting a team palette over
   the reserved colours so the sheet can be judged the way the runtime
   will show it. */
function spriteFrameRGBA(g, f) {
  if (sprite.team === 'none') return f.toRGBA(g.width, g.height);
  const buf = new Uint8ClampedArray(g.width * g.height * 4);
  for (const r of f.runs) {
    if (r.y >= g.height) continue;
    let o = (r.y * g.width + r.x) * 4;
    for (const v of r.px) {
      if (o >= 0 && o + 3 < buf.length) {
        const c = rgb565ToRgb(teamTint(v, sprite.team));
        buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
      }
      o += 4;
    }
  }
  return buf;
}

function isSpriteName(name) {
  return /\.(gra|spr|eft)$/i.test(name);
}

function spriteOpen(name, buf) {
  const raw = new Uint8Array(buf);
  const gra = new GRA(buf);
  sprite.entry = { name, raw, gra };
  sprite.frame = 0;
  sprite.selected = null;
  document.body.classList.add('sprite-mode');
  $('empty').style.display = 'none';
  spriteRenderAll();
  spriteDraw();
}

function spriteClose() {
  spritePause();
  sprite.entry = null;
  document.body.classList.remove('sprite-mode');
  /* the status bar is shared, so its sprite half has to be cleared or
     it keeps describing a file that is no longer open */
  const st = $('spriteStat'), rt = $('spriteRt');
  if (st) st.textContent = '';
  if (rt) { rt.textContent = ''; rt.className = 'rt'; }
}

/* ------------------------------ drawing -------------------------- */
function spriteDraw() {
  const e = sprite.entry;
  if (!e) return;
  const cv = $('spriteView');
  const g = e.gra;
  const z = sprite.zoom;
  cv.width = g.width * z;
  cv.height = g.height * z;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);

  const f = g.frames[sprite.frame];
  if (!f) return;
  const tmp = document.createElement('canvas');
  tmp.width = g.width; tmp.height = g.height;
  tmp.getContext('2d').putImageData(
    new ImageData(spriteFrameRGBA(g, f), g.width, g.height), 0, 0);
  ctx.drawImage(tmp, 0, 0, cv.width, cv.height);

  const bb = f.bbox();
  $('spriteStat').textContent = e.name + '  frame ' + (sprite.frame + 1) +
    '/' + g.frames.length + '  ' + g.width + 'x' + g.height +
    '  ' + f.runs.length + ' runs  ' + f.pixelCount + ' px' +
    (bb ? '  bounds x ' + bb[0] + '..' + bb[2] + ' y ' + bb[1] + '..' + bb[3]
        : '  empty');
}

/* ----------------------------- playback -------------------------- */
function spritePlay() {
  const e = sprite.entry;
  if (!e || e.gra.frames.length < 2) return;
  sprite.playing = true;
  $('bPlay').textContent = 'Pause';
  $('bPlay').classList.add('on');
  clearInterval(sprite.timer);
  sprite.timer = setInterval(() => {
    sprite.frame = (sprite.frame + 1) % e.gra.frames.length;
    spriteDraw();
    spriteMarkStrip();
  }, 1000 / sprite.fps);
}

function spritePause() {
  sprite.playing = false;
  clearInterval(sprite.timer);
  sprite.timer = null;
  const b = $('bPlay');
  if (b) { b.textContent = 'Play'; b.classList.remove('on'); }
}

/* ------------------------------ panels --------------------------- */
function spriteRenderAll() {
  spriteRenderInfo();
  spriteRenderStrip();
  spriteRenderPalette();
  spriteRenderTint();
  spriteCheckRoundTrip();
}

/* How much of this sheet the runtime will recolour, and whether the
   frame size is within what the format tolerates. */
function spriteRenderTint() {
  const g = sprite.entry.gra;
  let total = 0, tinted = 0;
  const steps = new Set();
  for (const f of g.frames) {
    for (const r of f.runs) {
      for (const v of r.px) {
        total++;
        const i = tintIndexOf(v);
        if (i >= 0) { tinted++; steps.add(i); }
      }
    }
  }
  $('tintStat').innerHTML = total
    ? '<b>' + (100 * tinted / total).toFixed(1) + '%</b> of this sheet is in the '
      + 'reserved ramp (' + steps.size + ' of 64 steps used), so the runtime '
      + 'recolours it. The preview above is an approximation -- the real '
      + 'substitution tables are not known.'
    : 'no pixels';

  /* the same health notes the mesh side gets */
  let rep = null;
  try { rep = spriteReport(g); } catch (e) { rep = null; }
  if (rep) {
    const extra = rep.notes.map(n =>
      '<p class="note ' + n.level + '">' + n.text.replace(/[&<>]/g, ch =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])) + '</p>').join('');
    $('tintStat').innerHTML += extra;
  }

  const warn = $('sizeWarn');
  const cap = [64, 80];
  if (g.width > cap[0] || g.height > cap[1]) {
    warn.style.display = 'block';
    warn.textContent = "This frame is " + g.width + "x" + g.height +
      ". The original authoring tool's manual reports a failure on " +
      "frames around 60x100, and recommends staying at or under " +
      cap[0] + "x" + cap[1] + ". Files this size that shipped with the " +
      "set are fine; newly grown ones may not be.";
  } else {
    warn.style.display = 'none';
  }
}

function spriteRenderInfo() {
  const g = sprite.entry.gra;
  $('spriteInfo').innerHTML =
    '<dl><dt>frames</dt><dd>' + g.frames.length + '</dd>' +
    '<dt>size</dt><dd>' + g.width + ' &times; ' + g.height + '</dd>' +
    '<dt>kind</dt><dd>0x' + g.kind.toString(16).toUpperCase().padStart(2, '0') +
    '</dd><dt>colours</dt><dd>' + g.palette().length + '</dd></dl>';
}

function spriteRenderStrip() {
  const g = sprite.entry.gra;
  const host = $('strip');
  host.innerHTML = '';
  g.frames.forEach((f, i) => {
    const c = document.createElement('canvas');
    const bb = f.bbox() || [0, 0, 1, 1];
    const w = Math.max(1, bb[2] - bb[0]), h = Math.max(1, bb[3] - bb[1]);
    c.width = w; c.height = h;
    const tmp = document.createElement('canvas');
    tmp.width = g.width; tmp.height = g.height;
    tmp.getContext('2d').putImageData(
      new ImageData(spriteFrameRGBA(g, f), g.width, g.height), 0, 0);
    c.getContext('2d').drawImage(tmp, -bb[0], -bb[1]);
    const fig = document.createElement('figure');
    fig.dataset.i = i;
    fig.className = i === sprite.frame ? 'sel' : '';
    const img = document.createElement('img');
    img.src = c.toDataURL();
    fig.appendChild(img);
    const cap = document.createElement('figcaption');
    cap.textContent = i + 1;
    fig.appendChild(cap);
    fig.onclick = () => {
      spritePause();
      sprite.frame = i;
      spriteDraw();
      spriteMarkStrip();
    };
    fig.oncontextmenu = ev => {
      if (typeof menuAt !== 'function') return;
      spritePause();
      sprite.frame = i;
      spriteDraw();
      spriteMarkStrip();
      const open = typeof paintFind === 'function' && paintFind(x =>
        x.owner && x.owner.kind === 'frame' && x.owner.frame === i);
      menuAt(ev, 'frame ' + (i + 1) + ' of ' + g.frames.length, [
        open
          ? { label: 'Go back to this edit', run: () => goToEdit(open.id) }
          : { label: 'Edit this frame', run: spritePaintFrame },
        open && { label: 'Discard this edit', run: () => dropEdit(open.id) },
        '-',
        { label: 'Duplicate it', run: spriteFrameDup },
        { label: 'Delete it', disabled: g.frames.length < 2,
          run: spriteFrameDel },
        { label: 'Add an empty frame after the last', run: spriteFrameAdd },
        '-',
        { label: 'Save it as .PNG', run: spriteExportFrame },
        { label: 'Replace it from an image\u2026',
          run: () => $('spriteFile').click() },
        '-',
        { label: 'Save the animation as .GIF', run: spriteExportGIF },
        { label: 'Save every frame as one .PNG strip', run: spriteExportStrip }
      ]);
    };
    host.appendChild(fig);
  });
}

function spriteMarkStrip() {
  $('strip').querySelectorAll('figure').forEach(f =>
    f.classList.toggle('sel', +f.dataset.i === sprite.frame));
}

function hex565(v) {
  const c = rgb565ToRgb(v);
  return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
}

function spriteRenderPalette() {
  const g = sprite.entry.gra;
  const pal = g.palette();
  const host = $('palette');
  const shown = pal.slice(0, 96);
  host.innerHTML = shown.map(([v, n]) =>
    `<button class="sw ${sprite.selected === v ? 'sel' : ''}"
       data-v="${v}" title="0x${v.toString(16).toUpperCase().padStart(4, '0')} -- ${n} px"
       style="background:${hex565(v)}"></button>`).join('');
  host.querySelectorAll('button').forEach(b => b.onclick = () => {
    sprite.selected = +b.dataset.v;
    $('newColour').value = hex565(sprite.selected);
    spriteRenderPalette();
  });
  $('palCount').textContent = pal.length > shown.length
    ? shown.length + ' of ' + pal.length + ' colours' : pal.length + ' colours';
}

function spriteCheckRoundTrip() {
  const e = sprite.entry;
  const out = e.gra.write();
  let same = out.length === e.raw.length;
  if (same) for (let i = 0; i < out.length; i++) {
    if (out[i] !== e.raw[i]) { same = false; break; }
  }
  const el = $('spriteRt');
  el.className = 'rt ' + (same ? 'ok' : 'changed');
  el.textContent = same
    ? 'unchanged -- writes back byte-identical (' + out.length + ' bytes)'
    : 'edited -- ' + out.length + ' bytes, was ' + e.raw.length;
  $('bSpriteSave').classList.toggle('primary', !same);
}

/* ------------------------------ editing -------------------------- */
function hexToRgb565(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgbToRgb565((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function spriteRecolour() {
  const e = sprite.entry;
  if (!e) return;
  if (sprite.selected === null) { notify('pick a colour from the palette first', 1); return; }
  const to = hexToRgb565($('newColour').value);
  if (to === null) { notify('that is not a hex colour', 1); return; }
  const from = sprite.selected;
  if (to === from) { notify('that is the same colour'); return; }
  const frames = sprite.applyAll ? null : [sprite.frame];
  let hit = 0;
  e.gra.mapColors(v => { if (v === from) { hit++; return to; } return v; }, frames);
  sprite.selected = to;
  notify('remapped ' + hit + ' pixels ' +
         (sprite.applyAll ? 'across all ' + e.gra.frames.length + ' frames'
                          : 'in frame ' + (sprite.frame + 1)));
  spriteRenderAll();
  spriteDraw();
}

/* A hue and brightness shift over every colour at once. This is the
   quickest way to recolour a whole character and it lands on every
   frame by construction. */
function spriteShift() {
  const e = sprite.entry;
  if (!e) return;
  const dh = (+$('shHue').value || 0) / 360;
  const ds = (+$('shSat').value || 0) / 100;
  const dv = (+$('shVal').value || 0) / 100;
  if (!dh && !ds && !dv) { notify('all three sliders are at zero'); return; }
  const frames = sprite.applyAll ? null : [sprite.frame];
  e.gra.mapColors(v => {
    const c = rgb565ToRgb(v);
    let [h, s, l] = rgbToHsv(c[0], c[1], c[2]);
    h = (h + dh + 1) % 1;
    s = Math.max(0, Math.min(1, s + ds));
    l = Math.max(0, Math.min(1, l + dv));
    const o = hsvToRgb(h, s, l);
    return rgbToRgb565(o[0], o[1], o[2]);
  }, frames);
  notify('shifted ' + (sprite.applyAll ? 'all ' + e.gra.frames.length + ' frames'
                                       : 'frame ' + (sprite.frame + 1)));
  spriteRenderAll();
  spriteDraw();
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, mx ? d / mx : 0, mx];
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return m.map(x => Math.round(x * 255));
}

async function spriteImport(file) {
  const e = sprite.entry;
  if (!e) return;
  let img;
  try { img = await decodeImage(file); }
  catch (err) { notify('could not read that image', 1); return; }
  const g = e.gra;
  /* a strip whose width is an exact multiple of the frame width is
     sliced across frames; anything else replaces the current frame */
  const asStrip = img.w === g.width * g.frames.length && img.h === g.height;
  const src = document.createElement('canvas');
  src.width = img.w; src.height = img.h;
  src.getContext('2d').putImageData(new ImageData(img.rgba, img.w, img.h), 0, 0);

  const take = (sx, sw, sh) => {
    const c = document.createElement('canvas');
    c.width = g.width; c.height = g.height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, sx, 0, sw, sh, 0, 0, g.width, g.height);
    return ctx.getImageData(0, 0, g.width, g.height).data;
  };

  if (asStrip) {
    for (let i = 0; i < g.frames.length; i++)
      g.replaceFrameRGBA(i, take(i * g.width, g.width, g.height));
    notify('imported a strip of ' + g.frames.length + ' frames');
  } else {
    g.replaceFrameRGBA(sprite.frame, take(0, img.w, img.h));
    notify('replaced frame ' + (sprite.frame + 1) +
           (img.w !== g.width || img.h !== g.height
             ? ' (scaled from ' + img.w + 'x' + img.h + ')' : ''));
  }
  spriteRenderAll();
  spriteDraw();
}

function spriteExportFrame() {
  const e = sprite.entry;
  if (!e) return;
  const g = e.gra, f = g.frames[sprite.frame];
  const c = document.createElement('canvas');
  c.width = g.width; c.height = g.height;
  c.getContext('2d').putImageData(
    new ImageData(f.toRGBA(g.width, g.height), g.width, g.height), 0, 0);
  c.toBlob(b => b.arrayBuffer().then(ab => saveFile(
    e.name.replace(/\.[^.]+$/, '') + '_' +
    String(sprite.frame + 1).padStart(2, '0') + '.png',
    new Uint8Array(ab), 'image/png')));
}

function spriteExportStrip() {
  const e = sprite.entry;
  if (!e) return;
  const g = e.gra;
  const c = document.createElement('canvas');
  c.width = g.width * g.frames.length;
  c.height = g.height;
  const ctx = c.getContext('2d');
  g.frames.forEach((f, i) => {
    const t = document.createElement('canvas');
    t.width = g.width; t.height = g.height;
    t.getContext('2d').putImageData(
      new ImageData(f.toRGBA(g.width, g.height), g.width, g.height), 0, 0);
    ctx.drawImage(t, i * g.width, 0);
  });
  c.toBlob(b => b.arrayBuffer().then(ab => saveFile(
    e.name.replace(/\.[^.]+$/, '') + '_strip.png',
    new Uint8Array(ab), 'image/png')));
  notify('the strip is ' + c.width + 'x' + c.height +
         ' -- drop it back on the page to import every frame at once');
}

/* The animation as one GIF, at the speed set on the slider.

   The canvas is mostly empty -- a figure occupies about 34x52 of a
   256x256 sheet -- so the result is cropped to the box every frame
   together occupies. Cropping per frame would be smaller still and
   would also throw the poses out of register with each other, which is
   the one thing an animation cannot afford. The team preview is
   honoured: what you see playing is what you get. */
async function spriteExportGIF() {
  const e = sprite.entry;
  if (!e) return;
  const g = e.gra, W = g.width, H = g.height;
  if (!g.frames.length) { notify('this sprite has no frames', 1); return; }

  const rgbas = g.frames.map(f => spriteFrameRGBA(g, f));
  /* A frame part-way through being edited is what is on screen, so it
     is what gets saved -- the stored frame is the one before the edit. */
  if (typeof paint !== 'undefined' && paint.open && paint.owner &&
      paint.owner.kind === 'frame' && paint.owner.entry === e) {
    const i = paint.owner.frame;
    if (i >= 0 && i < rgbas.length) {
      const cv = paintComposite();
      if (cv.width === W && cv.height === H) {
        rgbas[i] = cv.getContext('2d').getImageData(0, 0, W, H).data;
      }
    }
  }

  /* the union of every frame's drawn pixels */
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const px of rgbas) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (px[(y * W + x) * 4 + 3] >= 128) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  if (x1 < x0) { x0 = y0 = 0; x1 = W - 1; y1 = H - 1; }   /* all blank */
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  const cropped = rgbas.map(px => {
    const out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      const src = ((y + y0) * W + x0) * 4;
      out.set(px.subarray(src, src + cw * 4), y * cw * 4);
    }
    return out;
  });

  const scale = typeof askForScale === 'function'
    ? await askForScale(g.frames.length + ' frames at ' + sprite.fps + ' fps',
                        cw, ch)
    : 1;
  if (scale === null) return;
  const big = scaleFrames(cropped, cw, ch, scale);
  let gif;
  try {
    gif = encodeAnimatedGIF(big.frames, big.w, big.h,
      { delayMs: Math.round(1000 / sprite.fps) });
  } catch (err) {
    notify('could not encode the animation: ' + err.message, 1);
    return;
  }
  saveFile(e.name.replace(/\.[^.]+$/, '') + '.gif', gif, 'image/gif');
  notify(g.frames.length + ' frames at ' + sprite.fps + ' fps, ' +
         big.w + 'x' + big.h + ' from ' + W + 'x' + H +
         (sprite.team === 'none' ? '' : ', in the ' + sprite.team + ' team colours'));
}

/* Hand the current frame to the paint editor and take back whatever
   comes out. Layers are flattened on the way in. */
function spritePaintFrame() {
  const e = sprite.entry;
  if (!e) return;
  spritePause();
  /* The frame already being edited is the one to go back to. Frames all
     occupy the same slot -- one sheet, one frame on screen -- so a
     different frame replaces the edit rather than joining it. */
  const same = paintFind(x => x.owner && x.owner.kind === 'frame' &&
    x.owner.entry === e && x.owner.frame === sprite.frame);
  if (same) { paintSelect(same.id); return; }
  const rival = paintFind(x => x.owner && x.owner.kind === 'frame');
  if (rival) {
    if (sessionDirty(rival) && !confirm('An unapplied edit of ' +
        rival.label + ' is open. Discard it and edit frame ' +
        (sprite.frame + 1) + '?')) return;
    paintCloseSession(rival.id);
  }
  const g = e.gra;
  const f = g.frames[sprite.frame];
  /* the frames either side, for onion skin -- a pose is judged against
     the one before it, not on its own */
  const neighbour = i => (i >= 0 && i < g.frames.length)
    ? new ImageData(g.frames[i].toRGBA(g.width, g.height), g.width, g.height)
    : null;
  paintOpen({
    width: g.width, height: g.height,
    base: f.toRGBA(g.width, g.height),
    onion: { prev: neighbour(sprite.frame - 1),
             next: neighbour(sprite.frame + 1) },
    title: e.name + '  frame ' + (sprite.frame + 1) + '/' + g.frames.length,
    owner: { kind: 'frame', entry: e, frame: sprite.frame },
    label: 'frame ' + (sprite.frame + 1),
    slot: 'frame',
    onApply: rgba => {
      g.replaceFrameRGBA(sprite.frame, rgba);
      spriteRenderAll();
      spriteDraw();
      notify('frame ' + (sprite.frame + 1) + ' updated');
    }
  });
}

function spriteFrameAdd() {
  const e = sprite.entry;
  if (!e) return;
  if (e.gra.frames.length >= 255) { notify('the frame count is a single byte, so 255 is the ceiling', 1); return; }
  e.gra.frames.splice(sprite.frame + 1, 0, new GraFrame([]));
  sprite.frame += 1;
  spriteRenderAll();
  spriteDraw();
  notify('inserted an empty frame at ' + (sprite.frame + 1));
}

function spriteFrameDup() {
  const e = sprite.entry;
  if (!e) return;
  if (e.gra.frames.length >= 255) { notify('255 frames is the ceiling', 1); return; }
  const src = e.gra.frames[sprite.frame];
  const copy = new GraFrame(src.runs.map(r => ({ x: r.x, y: r.y, px: r.px.slice() })));
  e.gra.frames.splice(sprite.frame + 1, 0, copy);
  sprite.frame += 1;
  spriteRenderAll();
  spriteDraw();
  notify('duplicated to frame ' + (sprite.frame + 1));
}

function spriteFrameDel() {
  const e = sprite.entry;
  if (!e) return;
  if (e.gra.frames.length < 2) { notify('a sprite needs at least one frame', 1); return; }
  e.gra.frames.splice(sprite.frame, 1);
  sprite.frame = Math.min(sprite.frame, e.gra.frames.length - 1);
  spriteRenderAll();
  spriteDraw();
}

/* Start a sheet from nothing. */
function spriteNew(w, h, frames, name) {
  const g = new GRA();
  g.width = w; g.height = h;
  g.kind = 0x03; g.b6 = 0x64;
  g.frames = [];
  for (let i = 0; i < frames; i++) g.frames.push(new GraFrame([]));
  const raw = g.write();
  sprite.entry = { name: name || 'new.gra', raw, gra: g };
  sprite.frame = 0;
  sprite.selected = null;
  document.body.classList.add('sprite-mode');
  $('empty').style.display = 'none';
  spriteRenderAll();
  spriteDraw();
}

function spriteSave() {
  const e = sprite.entry;
  if (!e) return;
  saveFile(e.name, e.gra.write(), 'application/octet-stream');
}

/* ----------------------------- wiring ---------------------------- */
function spriteWire() {
  $('bPlay').onclick = () => sprite.playing ? spritePause() : spritePlay();
  $('bPrev').onclick = () => {
    spritePause();
    const n = sprite.entry.gra.frames.length;
    sprite.frame = (sprite.frame - 1 + n) % n;
    spriteDraw(); spriteMarkStrip();
  };
  $('bNext').onclick = () => {
    spritePause();
    const n = sprite.entry.gra.frames.length;
    sprite.frame = (sprite.frame + 1) % n;
    spriteDraw(); spriteMarkStrip();
  };
  $('fps').oninput = e => {
    sprite.fps = Math.max(1, Math.min(60, +e.target.value || 12));
    $('fpsOut').textContent = sprite.fps + ' fps';
    if (sprite.playing) spritePlay();
  };
  $('zoom').oninput = e => {
    sprite.zoom = Math.max(1, Math.min(10, +e.target.value || 3));
    $('zoomOut').textContent = sprite.zoom + 'x';
    spriteDraw();
  };
  $('applyAll').onchange = e => { sprite.applyAll = e.target.checked; };
  $('bRecolour').onclick = spriteRecolour;
  $('bShift').onclick = spriteShift;
  $('bSpriteIn').onclick = () => $('spriteFile').click();
  $('spriteFile').onchange = e => {
    if (e.target.files[0]) spriteImport(e.target.files[0]);
    e.target.value = '';
  };
  $('bPaintFrame').onclick = spritePaintFrame;
  $('bFrameAdd').onclick = spriteFrameAdd;
  $('bFrameDup').onclick = spriteFrameDup;
  $('bFrameDel').onclick = spriteFrameDel;
  document.querySelectorAll('#teamRow button[data-team]').forEach(b =>
    b.onclick = () => {
      sprite.team = b.dataset.team;
      document.querySelectorAll('#teamRow button').forEach(x =>
        x.classList.toggle('on', x === b));
      spriteRenderStrip();
      spriteDraw();
    });
  $('bFrameOut').onclick = spriteExportFrame;
  $('bSpriteGif').onclick = spriteExportGIF;
  $('bStripOut').onclick = spriteExportStrip;
  $('bSpriteSave').onclick = spriteSave;
}
