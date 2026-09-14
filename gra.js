/* Reader and writer for the GRA sprite format (.gra, .spr, .eft).
   Mirrors python/gra.py; see docs/gra-format.md for the layout.

   LITTLE-endian throughout -- the mesh format in mxw.js is big-endian,
   so the two disagree and it is easy to carry the wrong habit over.

   HEADER
     0x00  u16      0
     0x02  u8       1
     0x03  u8       1
     0x04  u8       kind
     0x05  u8       frame count N
     0x06  u8       0x64, 0x00 or 0x01
     0x07  u32      0
     0x0B  u16      width
     0x0D  u16      height
     0x0F  u32      0
     0x13  N x u32  cumulative frame end, in 16-bit words
     then the payload as 16-bit words

     size == 19 + 4*N + 2 * last cumulative count

   FRAME -- horizontal runs until the frame's words are used up
     u16 x, u16 y, u16 count, count x u16 pixel (RGB565)

   Pixels no run covers are transparent. Verified: 1419 of 1420
   accepted files round-trip byte-identical, 8057 frames. */

function rgb565ToRgb(v) {
  return [((v >> 11) & 31) * 255 / 31 | 0,
          ((v >> 5) & 63) * 255 / 63 | 0,
          (v & 31) * 255 / 31 | 0];
}

function rgbToRgb565(r, g, b) {
  return (((r * 31 + 127) / 255 | 0) << 11)
       | (((g * 63 + 127) / 255 | 0) << 5)
       | ((b * 31 + 127) / 255 | 0);
}

class GraFrame {
  constructor(runs) { this.runs = runs || []; }

  get words() {
    let n = 0;
    for (const r of this.runs) n += 3 + r.px.length;
    return n;
  }

  get pixelCount() {
    let n = 0;
    for (const r of this.runs) n += r.px.length;
    return n;
  }

  bbox() {
    if (!this.runs.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const r of this.runs) {
      if (r.x < x0) x0 = r.x;
      if (r.x + r.px.length > x1) x1 = r.x + r.px.length;
      if (r.y < y0) y0 = r.y;
      if (r.y + 1 > y1) y1 = r.y + 1;
    }
    return [x0, y0, x1, y1];
  }

  /* Uint8ClampedArray of RGBA, ready for putImageData */
  toRGBA(w, h) {
    const buf = new Uint8ClampedArray(w * h * 4);
    for (const r of this.runs) {
      if (r.y >= h) continue;
      let o = (r.y * w + r.x) * 4;
      for (const v of r.px) {
        if (o >= 0 && o + 3 < buf.length) {
          const c = rgb565ToRgb(v);
          buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
        }
        o += 4;
      }
    }
    return buf;
  }

  /* Rebuild runs from RGBA. Transparent pixels are dropped, which is
     what keeps these files small. */
  static fromRGBA(rgba, w, h, alphaCutoff) {
    const cut = alphaCutoff === undefined ? 128 : alphaCutoff;
    const runs = [];
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        if (rgba[(y * w + x) * 4 + 3] < cut) { x++; continue; }
        const start = x;
        const px = [];
        while (x < w) {
          const o = (y * w + x) * 4;
          if (rgba[o + 3] < cut) break;
          px.push(rgbToRgb565(rgba[o], rgba[o + 1], rgba[o + 2]));
          x++;
        }
        runs.push({ x: start, y, px });
      }
    }
    return new GraFrame(runs);
  }

  mapColors(fn) {
    for (const r of this.runs) {
      for (let i = 0; i < r.px.length; i++) r.px[i] = fn(r.px[i]) & 0xFFFF;
    }
  }
}

class GRA {
  constructor(buf) {
    this.kind = 0x03;
    this.b6 = 0x64;
    this.width = 0;
    this.height = 0;
    this.frames = [];
    if (buf) this.read(buf);
  }

  read(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 24) throw new Error('too short to be a sprite file');
    if (u8[2] !== 1 || u8[3] !== 1)
      throw new Error('bytes 2-3 are ' + u8[2].toString(16) + ' ' +
                      u8[3].toString(16) + ', expected 01 01');
    const n = u8[5];
    if (!n) throw new Error('frame count is zero');
    if (u8.length < 19 + 4 * n)
      throw new Error('frame table runs past the end of the file');
    this.kind = u8[4];
    this.b6 = u8[6];
    this.width = dv.getUint16(11, true);
    this.height = dv.getUint16(13, true);
    const cum = [];
    for (let i = 0; i < n; i++) cum.push(dv.getUint32(19 + 4 * i, true));
    const base = 19 + 4 * n;
    if (base + 2 * cum[n - 1] !== u8.length)
      throw new Error('size is ' + u8.length + ', the frame table implies ' +
                      (base + 2 * cum[n - 1]));
    for (let i = 1; i < n; i++)
      if (cum[i - 1] > cum[i]) throw new Error('frame table is not monotonic');

    for (let i = 0; i < n; i++) {
      let p = base + 2 * (i ? cum[i - 1] : 0);
      const end = base + 2 * cum[i];
      const runs = [];
      while (p + 6 <= end) {
        const x = dv.getUint16(p, true);
        const y = dv.getUint16(p + 2, true);
        const c = dv.getUint16(p + 4, true);
        p += 6;
        if (!c || p + 2 * c > end)
          throw new Error('frame ' + i + ' has a run of ' + c +
                          ' pixels that does not fit');
        const px = new Array(c);
        for (let k = 0; k < c; k++) px[k] = dv.getUint16(p + 2 * k, true);
        p += 2 * c;
        runs.push({ x, y, px });
      }
      if (p !== end)
        throw new Error('frame ' + i + ' leaves ' + (end - p) + ' bytes unread');
      this.frames.push(new GraFrame(runs));
    }
  }

  write() {
    const bodies = this.frames.map(f => {
      const words = [];
      for (const r of f.runs) {
        words.push(r.x, r.y, r.px.length);
        for (const v of r.px) words.push(v);
      }
      return words;
    });
    const total = 19 + 4 * bodies.length +
                  2 * bodies.reduce((s, b) => s + b.length, 0);
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint16(0, 0, true);
    out[2] = 1; out[3] = 1;
    out[4] = this.kind;
    out[5] = this.frames.length;
    out[6] = this.b6;
    dv.setUint32(7, 0, true);
    dv.setUint16(11, this.width, true);
    dv.setUint16(13, this.height, true);
    dv.setUint32(15, 0, true);
    let acc = 0;
    bodies.forEach((b, i) => {
      acc += b.length;
      dv.setUint32(19 + 4 * i, acc, true);
    });
    let p = 19 + 4 * bodies.length;
    for (const b of bodies) {
      for (const v of b) { dv.setUint16(p, v, true); p += 2; }
    }
    return out;
  }

  /* every colour present, most used first -- these files store direct
     colour, so a palette edit means remapping what is actually there */
  palette() {
    const c = new Map();
    for (const f of this.frames)
      for (const r of f.runs)
        for (const v of r.px) c.set(v, (c.get(v) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }

  /* recolour some frames, or all of them when `frames` is null --
     this is how one edit propagates across an animation */
  mapColors(fn, frames) {
    this.frames.forEach((f, i) => {
      if (!frames || frames.indexOf(i) >= 0) f.mapColors(fn);
    });
  }

  replaceFrameRGBA(index, rgba, alphaCutoff) {
    this.frames[index] = GraFrame.fromRGBA(rgba, this.width, this.height,
                                           alphaCutoff);
  }
}

function graRoundTrips(buf) {
  const a = new Uint8Array(buf), b = new GRA(buf).write();
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
