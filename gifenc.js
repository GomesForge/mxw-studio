/* GIF89a encoder, for writing a new texture back into an MXW file.

   These textures are 128x128 GIF89a with a 64, 128 or 256 entry
   global colour table, no interlacing, and -- in 36 of the 58 in the
   archive -- a transparent index. Hair, headbands and back items rely
   on that transparency for their cut-out silhouette, so an encoder
   that drops it turns them into solid blocks. This one keeps it.

   encodeGIF(rgba, w, h, opts) -> Uint8Array
     rgba    Uint8ClampedArray from a canvas, 4 bytes per pixel
     opts    maxColors   palette ceiling, default 256
             alphaCutoff pixels with alpha below this become
                         transparent, default 128; pass 0 to ignore
                         alpha entirely */

function encodeGIF(rgba, w, h, opts) {
  opts = opts || {};
  /* A zero dimension writes a file no decoder will open, and the cause
     is always upstream -- a size read from the wrong field, say. Better
     to say so here than to hand back 246 bytes of nothing. */
  if (!(w > 0 && h > 0)) {
    throw new Error('a GIF cannot be ' + w + 'x' + h);
  }
  if (rgba.length < w * h * 4) {
    throw new Error('the pixels do not fill ' + w + 'x' + h +
                    ': ' + rgba.length + ' bytes for ' + (w * h * 4));
  }
  const cutoff = opts.alphaCutoff === undefined ? 128 : opts.alphaCutoff;
  const maxColors = Math.min(256, opts.maxColors || 256);

  /* --- which pixels are transparent --- */
  const n = w * h;
  const clear = new Uint8Array(n);
  let anyClear = false;
  if (cutoff > 0) {
    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] < cutoff) { clear[i] = 1; anyClear = true; }
    }
  }

  /* --- histogram of the opaque colours --- */
  const hist = new Map();
  for (let i = 0; i < n; i++) {
    if (clear[i]) continue;
    const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  const unique = [];
  for (const [key, count] of hist) {
    unique.push([(key >> 16) & 255, (key >> 8) & 255, key & 255, count]);
  }

  /* one slot is spent on the transparent colour when we need it */
  const room = anyClear ? maxColors - 1 : maxColors;
  const palette = unique.length <= room ? unique.map(c => c.slice(0, 3))
                                        : medianCut(unique, room);
  const transparentIndex = anyClear ? palette.length : -1;
  if (anyClear) palette.push([0, 0, 0]);

  /* GIF colour tables are a power of two, at least 2 entries */
  let bits = 1;
  while ((1 << bits) < Math.max(2, palette.length)) bits++;
  const tableSize = 1 << bits;

  /* --- map every pixel to a palette index --- */
  const indices = new Uint8Array(n);
  const lookup = paletteLookup(palette, transparentIndex, unique.length);
  for (let i = 0; i < n; i++) {
    if (clear[i]) { indices[i] = transparentIndex; continue; }
    indices[i] = lookup(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }

  /* --- assemble the file --- */
  const out = [];
  const push = (...v) => out.push(...v);
  const u16 = v => push(v & 255, (v >> 8) & 255);

  push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);      /* "GIF89a" */
  u16(w); u16(h);
  push(0x80 | (bits - 1));                        /* global table, size */
  push(0x00, 0x00);                               /* background, aspect */
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] || [0, 0, 0];
    push(c[0], c[1], c[2]);
  }
  if (transparentIndex >= 0) {
    push(0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, transparentIndex, 0x00);
  }
  push(0x2C); u16(0); u16(0); u16(w); u16(h); push(0x00);  /* image descriptor */

  const minCodeSize = Math.max(2, bits);
  push(minCodeSize);
  const lzw = lzwEncode(indices, minCodeSize);
  for (let i = 0; i < lzw.length; i += 255) {
    const chunk = lzw.subarray(i, Math.min(i + 255, lzw.length));
    push(chunk.length);
    for (const b of chunk) push(b);
  }
  push(0x00);                                     /* end of image data */
  push(0x3B);                                     /* trailer */
  return new Uint8Array(out);
}

/* An animation, as one GIF.

   Every frame of a sprite is the same artwork in a different pose, so
   they share one global colour table: quantising each frame on its own
   makes the colours crawl between frames. Frames whose pixels are
   partly transparent need disposal method 2, or each frame paints over
   the last and the character smears.

   encodeAnimatedGIF(frames, w, h, opts) -> Uint8Array
     frames  [Uint8ClampedArray] each w*h*4, RGBA
     opts    delayMs     per frame, default 80
             delays      per-frame override, an array of ms
             maxColors   palette ceiling, default 256
             alphaCutoff below this alpha a pixel is transparent,
                         default 128
             loop        0 = forever (the default) */
function encodeAnimatedGIF(frames, w, h, opts) {
  opts = opts || {};
  if (!frames || !frames.length) throw new Error('no frames to encode');
  if (!(w > 0 && h > 0)) throw new Error('a GIF cannot be ' + w + 'x' + h);
  for (const f of frames) {
    if (f.length < w * h * 4) {
      throw new Error('a frame does not fill ' + w + 'x' + h +
                      ': ' + f.length + ' bytes for ' + (w * h * 4));
    }
  }
  const cutoff = opts.alphaCutoff === undefined ? 128 : opts.alphaCutoff;
  const maxColors = Math.min(256, opts.maxColors || 256);
  const n = w * h;

  /* one histogram over the whole animation */
  const hist = new Map();
  const clears = [];
  let anyClear = false;
  for (const rgba of frames) {
    const clear = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (cutoff > 0 && rgba[i * 4 + 3] < cutoff) {
        clear[i] = 1; anyClear = true; continue;
      }
      const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
      hist.set(key, (hist.get(key) || 0) + 1);
    }
    clears.push(clear);
  }
  const unique = [];
  for (const [key, count] of hist) {
    unique.push([(key >> 16) & 255, (key >> 8) & 255, key & 255, count]);
  }
  const room = anyClear ? maxColors - 1 : maxColors;
  const palette = unique.length <= room ? unique.map(c => c.slice(0, 3))
                                        : medianCut(unique, room);
  const transparentIndex = anyClear ? palette.length : -1;
  if (anyClear) palette.push([0, 0, 0]);

  let bits = 1;
  while ((1 << bits) < Math.max(2, palette.length)) bits++;
  const tableSize = 1 << bits;

  const out = [];
  const push = (...v) => out.push(...v);
  const u16 = v => push(v & 255, (v >> 8) & 255);

  push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
  u16(w); u16(h);
  push(0x80 | (bits - 1));
  push(0x00, 0x00);
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] || [0, 0, 0];
    push(c[0], c[1], c[2]);
  }

  /* loop for ever unless told otherwise */
  const loop = opts.loop === undefined ? 0 : opts.loop;
  push(0x21, 0xFF, 0x0B);
  for (const ch of 'NETSCAPE2.0') push(ch.charCodeAt(0));
  push(0x03, 0x01); u16(loop); push(0x00);

  /* one lookup, shared across frames: the same colours recur in every
     one, so whichever strategy it picks is paid for once */
  const nearest = paletteLookup(palette, transparentIndex, unique.length);

  const minCodeSize = Math.max(2, bits);
  frames.forEach((rgba, fi) => {
    const ms = (opts.delays && opts.delays[fi] !== undefined)
             ? opts.delays[fi]
             : (opts.delayMs === undefined ? 80 : opts.delayMs);
    /* GIF counts hundredths, and a delay under two is treated as ten
       by most viewers -- so the floor is two, not zero */
    const delay = Math.max(2, Math.round(ms / 10));
    const disposal = anyClear ? 2 : 1;
    push(0x21, 0xF9, 0x04,
         (disposal << 2) | (transparentIndex >= 0 ? 1 : 0));
    u16(delay);
    push(transparentIndex >= 0 ? transparentIndex : 0, 0x00);

    push(0x2C); u16(0); u16(0); u16(w); u16(h); push(0x00);
    const indices = new Uint8Array(n);
    const clear = clears[fi];
    for (let i = 0; i < n; i++) {
      indices[i] = clear[i] ? transparentIndex
                            : nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    }
    push(minCodeSize);
    const lzw = lzwEncode(indices, minCodeSize);
    for (let i = 0; i < lzw.length; i += 255) {
      const chunk = lzw.subarray(i, Math.min(i + 255, lzw.length));
      push(chunk.length);
      for (const b of chunk) push(b);
    }
    push(0x00);
  });

  push(0x3B);
  return new Uint8Array(out);
}

/* Median cut: split the colour cloud along its longest axis at the
   population median until there are `target` boxes, then average
   each one. */
function medianCut(colors, target) {
  /* Each box carries its own pixel weight.

     The first version recomputed every box's weight on every split, to
     find the heaviest one. That is 255 splits by however many colours
     the image has, and on a 7-megapixel export with 399,238 distinct
     colours it came to about 100 million additions: two seconds, all of
     it rediscovering numbers it already knew. Carrying the weight is
     the same algorithm, to the same palette, without that. */
  const weigh = box => {
    let w = 0;
    for (const c of box) w += c[3];
    return w;
  };
  const boxes = [{ c: colors, w: weigh(colors) }];
  while (boxes.length < target) {
    let pick = -1, most = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].c.length < 2) continue;
      if (boxes[i].w > most) { most = boxes[i].w; pick = i; }
    }
    if (pick < 0) break;
    const box = boxes[pick].c;
    let axis = 0, span = -1;
    for (let k = 0; k < 3; k++) {
      let lo = 255, hi = 0;
      for (const c of box) { if (c[k] < lo) lo = c[k]; if (c[k] > hi) hi = c[k]; }
      if (hi - lo > span) { span = hi - lo; axis = k; }
    }
    box.sort((a, b) => a[axis] - b[axis]);
    const half = boxes[pick].w / 2;
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i][3];
      if (acc >= half) { cut = i + 1; break; }
    }
    const lower = box.slice(0, cut), upper = box.slice(cut);
    boxes.splice(pick, 1, { c: lower, w: acc },
                          { c: upper, w: boxes[pick].w - acc });
  }
  return boxes.map(({ c: box }) => {
    let r = 0, g = 0, b = 0, t = 0;
    for (const c of box) { r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; t += c[3]; }
    return t ? [Math.round(r / t), Math.round(g / t), Math.round(b / t)] : [0, 0, 0];
  });
}

/* Turning a colour into a palette index, as fast as the picture allows.

   Searching the palette for every pixel is the other half of an
   export's cost, and a plain Map of colour to index spends most of its
   time in the Map rather than in the search: 7.1 million lookups came
   to 1.7 seconds.

   So there are two strategies, and the picture chooses:

   - **exact**, a Map keyed by the full colour. Used when the image has
     few enough distinct colours that the Map is cheap anyway, which is
     every piece of pixel art here. It has to be exact for those: the 64
     reserved values are spaced as little as four apart, and anything
     that merged two of them would quietly cost a step of the ramp the
     runtime recolours.
   - **binned**, a lookup table over the top five bits of each channel.
     One typed-array read per pixel. Two colours within eight of each
     other on every channel share an entry, which on a photographic
     render is invisible and on 400,000 distinct colours is the
     difference between a second and a fifth of one.

   8192 distinct colours is the line. A sprite sheet has about 1,400, a
   texture set a few thousand, a 3D render hundreds of thousands. */
function paletteLookup(palette, transparentIndex, uniqueCount) {
  const nearest = (r, g, b) => {
    let idx = 0, best = Infinity;
    for (let k = 0; k < palette.length; k++) {
      if (k === transparentIndex) continue;
      const dr = palette[k][0] - r, dg = palette[k][1] - g, db = palette[k][2] - b;
      const d = dr * dr + dg * dg + db * db;
      if (d < best) { best = d; idx = k; }
    }
    return idx;
  };
  if (uniqueCount <= 8192) {
    const cache = new Map();
    return (r, g, b) => {
      const key = (r << 16) | (g << 8) | b;
      let v = cache.get(key);
      if (v === undefined) { v = nearest(r, g, b); cache.set(key, v); }
      return v;
    };
  }
  const lut = new Int16Array(32768).fill(-1);
  return (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = lut[key];
    if (v < 0) { v = nearest(r, g, b); lut[key] = v; }
    return v;
  };
}

/* GIF-flavoured LZW: codes grow from minCodeSize+1 bits, a clear code
   resets the dictionary, and bits pack least-significant-first. */
function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const out = [];
  let cur = 0, curBits = 0;
  const emit = (code, size) => {
    cur |= code << curBits;
    curBits += size;
    while (curBits >= 8) { out.push(cur & 255); cur >>= 8; curBits -= 8; }
  };

  let dict = new Map();
  let next = eoiCode + 1;
  let codeSize = minCodeSize + 1;
  const reset = () => { dict = new Map(); next = eoiCode + 1; codeSize = minCodeSize + 1; };

  emit(clearCode, codeSize);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix, codeSize);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clearCode, codeSize);
      reset();
    }
    prefix = k;
  }
  emit(prefix, codeSize);
  emit(eoiCode, codeSize);
  if (curBits > 0) out.push(cur & 255);
  return new Uint8Array(out);
}

/* Decode a GIF to RGBA by letting the browser do it. Resolves with
   {rgba, w, h}; rejects if the image will not load. */
function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ rgba: d.data, w: c.width, h: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not decode image')); };
    img.src = url;
  });
}
