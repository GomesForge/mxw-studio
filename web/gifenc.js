/* GIF89a encoder, for writing a new texture back into an MXW file.

   The game's textures are 128x128 GIF89a with a 64, 128 or 256 entry
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
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    if (clear[i]) { indices[i] = transparentIndex; continue; }
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const key = (r << 16) | (g << 8) | b;
    let idx = cache.get(key);
    if (idx === undefined) {
      idx = 0;
      let best = Infinity;
      for (let k = 0; k < palette.length; k++) {
        if (k === transparentIndex) continue;
        const dr = palette[k][0] - r, dg = palette[k][1] - g, db = palette[k][2] - b;
        const d = dr * dr + dg * dg + db * db;
        if (d < best) { best = d; idx = k; }
      }
      cache.set(key, idx);
    }
    indices[i] = idx;
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

/* Median cut: split the colour cloud along its longest axis at the
   population median until there are `target` boxes, then average
   each one. */
function medianCut(colors, target) {
  let boxes = [colors];
  while (boxes.length < target) {
    /* split the box holding the most pixels that still can be split */
    let pick = -1, most = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const w = boxes[i].reduce((s, c) => s + c[3], 0);
      if (w > most) { most = w; pick = i; }
    }
    if (pick < 0) break;
    const box = boxes[pick];
    let axis = 0, span = -1;
    for (let k = 0; k < 3; k++) {
      let lo = 255, hi = 0;
      for (const c of box) { if (c[k] < lo) lo = c[k]; if (c[k] > hi) hi = c[k]; }
      if (hi - lo > span) { span = hi - lo; axis = k; }
    }
    box.sort((a, b) => a[axis] - b[axis]);
    const half = box.reduce((s, c) => s + c[3], 0) / 2;
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i][3];
      if (acc >= half) { cut = i + 1; break; }
    }
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map(box => {
    let r = 0, g = 0, b = 0, t = 0;
    for (const c of box) { r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; t += c[3]; }
    return t ? [Math.round(r / t), Math.round(g / t), Math.round(b / t)] : [0, 0, 0];
  });
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
