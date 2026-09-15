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
     0x07  u32      zero in 1421 of 1422 files; one sprite carries 71
                    here, so it is preserved rather than assumed
     0x0B  u16      width
     0x0D  u16      height
     0x0F  u32      zero everywhere seen, preserved anyway
     0x13  N x u32  cumulative frame end, in 16-bit words
     then the payload as 16-bit words

     size == 19 + 4*N + 2 * last cumulative count

   FRAME -- horizontal runs until the frame's words are used up
     u16 x, u16 y, u16 count, count x u16 pixel (RGB565)

   Pixels no run covers are transparent. Verified: 1419 of 1420
   accepted files round-trip byte-identical, 8057 frames. */

/* ------------------------- other formats -------------------------

   Several files in the same folders share these extensions without
   sharing the format. Saying which one you dropped is far more use
   than reporting the byte that failed, so they are named here.

   Each entry is checked against the head of the file. Nothing below is
   decoded -- this only produces a better refusal. */

const OTHER_FORMATS = [
  {
    /* The server's item index opens with the same "OK  " as a mesh, so
       the signature alone identified every mesh as the index. What
       separates them is the body: 9 bytes per record, and the u32 at
       0x04 is how many records there are. */
    test: u8 => {
      if (!(u8[0] === 0x4F && u8[1] === 0x4B && u8[2] === 0x20 && u8[3] === 0x20)) {
        return false;
      }
      const body = u8.length - 8;
      if (body <= 0 || body % 9 !== 0) return false;
      const count = (u8[4] << 24 | u8[5] << 16 | u8[6] << 8 | u8[7]) >>> 0;
      return count === body / 9;
    },
    name: 'the item index (get_item_list.bin)',
    note: 'It shares the mesh signature but holds 9-byte records: a type ' +
          'byte, a u32 item id and a u32 token. python/get_item_list_decoder.py ' +
          'reads and rebuilds it.'
  },
  {
    /* Effects. A 12-byte u32 header, then frames of [u32 words][runs]
       using the same run encoding as a sprite -- but what follows the
       first group is a section nobody has identified, so these are not
       decoded. */
    test: u8 => u8[2] === 0x00 && u8[3] === 0x00 && u8[0] > 0 && u8[0] < 64 &&
                u8[1] === 0x00,
    name: 'an effect file',
    note: 'Its first group decodes -- a u32 frame count, width and height, ' +
          'then frames of [u32 word count][the same runs a sprite uses] -- ' +
          'but a further section after it is undocumented, so it is not ' +
          'opened rather than opened wrongly. See docs/gra-format.md.'
  },
  {
    /* Map layout: a grid of tile bytes rather than an image. */
    test: u8 => u8[0] === u8[1] && u8[1] === u8[2] && u8[2] === u8[3] &&
                u8[0] !== 0 && u8[0] < 0x20,
    name: 'map layout data',
    note: 'It is a grid of tile values, not an image: the head is one byte ' +
          'repeated across a row. No map format is decoded yet.'
  },
  {
    test: u8 => u8[0] === 0x99 && u8[1] === 0x99,
    name: 'map block data',
    note: 'Values look packed two per byte. Not an image, and not decoded yet.'
  }
];

function identifyOther(buf) {
  const u8 = new Uint8Array(buf);
  if (u8.length < 8) return null;
  for (const f of OTHER_FORMATS) {
    try { if (f.test(u8)) return f; } catch (e) { /* keep looking */ }
  }
  return null;
}

function rgb565ToRgb(v) {
  return [((v >> 11) & 31) * 255 / 31 | 0,
          ((v >> 5) & 63) * 255 / 63 | 0,
          (v & 31) * 255 / 31 | 0];
}

/* ---------------------------- tint colours -----------------------

   64 of the 65536 RGB565 values are reserved. Left alone they read as
   a neutral ramp from black through grey to white in 64 steps, and the
   game substitutes a palette over them at run time -- which is how one
   character sheet serves every team colour.

   The original authoring tool's manual states the reservation and that
   it makes character work difficult, without naming the values. They
   are the neutral ramp: green carries 6 bits and red and blue 5, so
   step i is (i>>1, i, i>>1).

   Confirmed against 974 character sprite files: all 64 appear, they
   take ranking positions 1 through 20-plus among every colour used,
   and 56.5% of all character pixels are one of them -- 81.9% in the
   non-character graphics.

   The practical consequence: more than half of a character is recoloured
   by the game. Paint with one of these by accident and the result looks
   right in an editor and wrong in play. */

const TINT_STEPS = 64;

function tintColour(i) {
  i = Math.max(0, Math.min(63, i | 0));
  return ((i >> 1) << 11) | (i << 5) | (i >> 1);
}

const TINT_SET = (() => {
  const m = new Map();
  for (let i = 0; i < TINT_STEPS; i++) m.set(tintColour(i), i);
  return m;
})();

/* the tint step this colour is, or -1 */
function tintIndexOf(v) {
  const i = TINT_SET.get(v);
  return i === undefined ? -1 : i;
}

/* The nearest non-reserved colour, for when a paint or import lands on
   a tint value unintentionally. Green is nudged because it has the
   spare bit. */
function avoidTint(v) {
  if (tintIndexOf(v) < 0) return v;
  const g = (v >> 5) & 63;
  return (v & ~(63 << 5)) | ((g < 63 ? g + 1 : g - 1) << 5);
}

/* An approximate preview of how a team palette lands on the ramp.
   The real substitution tables are not known -- the manual lists the
   sets (white, black, red, blue, green, yellow and several per
   character) without their values -- so this tints the ramp's own
   luminance and is labelled as a guess wherever it is shown. */
const TEAM_PREVIEWS = {
  none:   null,
  white:  [1.00, 1.00, 1.00],
  black:  [0.45, 0.45, 0.50],
  red:    [1.00, 0.35, 0.35],
  blue:   [0.40, 0.55, 1.00],
  green:  [0.40, 0.95, 0.45],
  yellow: [1.00, 0.90, 0.35]
};

function teamTint(v, team) {
  const i = tintIndexOf(v);
  const k = TEAM_PREVIEWS[team];
  if (i < 0 || !k) return v;
  const l = i / 63;
  return rgbToRgb565(Math.min(255, 255 * l * k[0]),
                     Math.min(255, 255 * l * k[1]),
                     Math.min(255, 255 * l * k[2]));
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
    this.head7 = 0;      /* the u32 at 0x07, preserved */
    this.head15 = 0;     /* the u32 at 0x0F, preserved */
    this.trailing = new Uint8Array(0);   /* bytes past the last frame */
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
    this.head7 = dv.getUint32(7, true);
    this.head15 = dv.getUint32(15, true);
    this.width = dv.getUint16(11, true);
    this.height = dv.getUint16(13, true);
    const cum = [];
    for (let i = 0; i < n; i++) cum.push(dv.getUint32(19 + 4 * i, true));
    const base = 19 + 4 * n;
    const end = base + 2 * cum[n - 1];
    if (end > u8.length)
      throw new Error('the frame table implies ' + end +
                      ' bytes but the file is ' + u8.length);
    /* Extra bytes after the last frame are kept rather than refused. A
       hand-edited community sprite has 202 of them: its table was never
       updated when the file grew, and every frame it describes is
       intact. Keeping them means the file opens and still writes back
       unchanged. */
    this.trailing = u8.subarray(end);
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
        if (p + 2 * c > end)
          throw new Error('frame ' + i + ' has a run of ' + c +
                          ' pixels that does not fit');
        /* A zero-length run carries no pixels and draws nothing.
           Hand-edited community files contain them, so they are kept
           rather than rejected -- keeping them also means the file
           still writes back byte-identical. */
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
                  2 * bodies.reduce((s, b) => s + b.length, 0) +
                  this.trailing.length;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint16(0, 0, true);
    out[2] = 1; out[3] = 1;
    out[4] = this.kind;
    out[5] = this.frames.length;
    out[6] = this.b6;
    /* 0x07 overlaps the width, so it goes down first */
    dv.setUint32(7, this.head7, true);
    dv.setUint16(11, this.width, true);
    dv.setUint16(13, this.height, true);
    dv.setUint32(15, this.head15, true);
    let acc = 0;
    bodies.forEach((b, i) => {
      acc += b.length;
      dv.setUint32(19 + 4 * i, acc, true);
    });
    let p = 19 + 4 * bodies.length;
    for (const b of bodies) {
      for (const v of b) { dv.setUint16(p, v, true); p += 2; }
    }
    out.set(this.trailing, p);
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
