/* Reader and writer for the MXW mesh format of Bomberman Online.
   Mirrors python/mxw.py; see docs/MXW-format.md for the layout.

   Everything is BIG-ENDIAN. The container is a chunk list:

     0x00  "OK  "
     0x04  u32 version
     0x08  u32 mesh id
     0x0C  u32 chunk count
     0x10  chunks: u32 size, then that many bytes

   A chunk opening with "MXW3DHUD" or "MXW3DAVA" holds either geometry
   or a skeleton; anything starting "GIF8" is a texture. Chunks that
   parse as neither are kept verbatim so a file always writes back
   byte-for-byte.

   Verified: all 46 files in the archive round-trip identical. */

const MXW_TYPES = ['MXW3DHUD', 'MXW3DAVA'];

function ascii(u8, o, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(u8[o + i]);
  return s;
}

/* ---------------------------- writing ---------------------------- */

class Writer {
  constructor() { this.b = []; }
  u8(v)  { this.b.push(v & 0xFF); }
  u16(v) { this.b.push((v >> 8) & 0xFF, v & 0xFF); }
  u32(v) { this.b.push((v >>> 24) & 0xFF, (v >>> 16) & 0xFF,
                       (v >>> 8) & 0xFF, v & 0xFF); }
  i16(v) { this.u16(v < 0 ? v + 0x10000 : v); }
  str(s) { for (let i = 0; i < s.length; i++) this.b.push(s.charCodeAt(i) & 0xFF); }
  pstr(s) { this.u8(s.length); this.str(s); }
  raw(a) { for (let i = 0; i < a.length; i++) this.b.push(a[i]); }
  bytes() { return new Uint8Array(this.b); }
}

/* ---------------------------- geometry --------------------------- */

class Mesh {
  constructor(content) {
    const dv = new DataView(content.buffer, content.byteOffset, content.byteLength);
    this.kind = ascii(content, 0, 8);
    if (MXW_TYPES.indexOf(this.kind) < 0) throw new Error('unknown type ' + this.kind);
    let p = 8;
    const nv = dv.getUint16(p); p += 2;
    this.verts = new Int16Array(nv * 3);
    this.norms = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      this.verts[i * 3]     = dv.getInt16(p);
      this.verts[i * 3 + 1] = dv.getInt16(p + 2);
      this.verts[i * 3 + 2] = dv.getInt16(p + 4);
      this.norms[i * 3]     = dv.getInt16(p + 6) / 32767;
      this.norms[i * 3 + 1] = dv.getInt16(p + 8) / 32767;
      this.norms[i * 3 + 2] = dv.getInt16(p + 10) / 32767;
      p += 12;
    }
    this.nv = nv;

    /* a texture COUNT, not a flag: accessories declare 1, bodies 2 */
    const nt = content[p++];
    this.textures = [];
    for (let i = 0; i < nt; i++) {
      const l = content[p++];
      this.textures.push(ascii(content, p, l)); p += l;
    }

    const nm = content[p++];
    this.materials = [];
    for (let i = 0; i < nm; i++) {
      const l = content[p++];
      const name = ascii(content, p, l); p += l;
      const props = Array.from(content.subarray(p, p + 6)); p += 6;
      /* props[4] indexes the texture list: body -> 0, head -> 1 */
      this.materials.push({ name, props, tex: props[4] });
    }

    const nf = dv.getUint16(p); p += 2;
    this.faces = [];
    for (let i = 0; i < nf; i++) {
      const cnt = content[p], mat = content[p + 1]; p += 2;
      if (cnt !== 3 && cnt !== 4) throw new Error('face ' + i + ' has ' + cnt + ' corners');
      const vs = [];
      for (let j = 0; j < cnt; j++) {
        /* u,v are texture PIXELS, divided later by that material's GIF size */
        vs.push({ i: dv.getUint16(p), u: content[p + 2], v: content[p + 3] });
        p += 4;
      }
      this.faces.push({ mat, vs });
    }

    /* contiguous vertex ranges tagged with a bone id -- the skinning */
    const nb = content[p++];
    this.bones = [];
    for (let i = 0; i < nb; i++) {
      this.bones.push({ from: dv.getUint16(p), to: dv.getUint16(p + 2),
                        bone: content[p + 4] });
      p += 5;
    }
    if (p !== content.length)
      throw new Error('mesh has ' + (content.length - p) + ' trailing bytes');
  }

  get texture() { return this.textures[0] || ''; }

  write() {
    const w = new Writer();
    w.str(this.kind);
    w.u16(this.nv);
    for (let i = 0; i < this.nv; i++) {
      w.i16(this.verts[i * 3]); w.i16(this.verts[i * 3 + 1]); w.i16(this.verts[i * 3 + 2]);
      w.i16(Math.round(this.norms[i * 3] * 32767));
      w.i16(Math.round(this.norms[i * 3 + 1] * 32767));
      w.i16(Math.round(this.norms[i * 3 + 2] * 32767));
    }
    w.u8(this.textures.length);
    for (const t of this.textures) w.pstr(t);
    w.u8(this.materials.length);
    for (const m of this.materials) {
      w.pstr(m.name);
      const props = m.props.slice();
      props[4] = m.tex;
      w.raw(props);
    }
    w.u16(this.faces.length);
    for (const f of this.faces) {
      w.u8(f.vs.length); w.u8(f.mat);
      for (const v of f.vs) { w.u16(v.i); w.u8(v.u); w.u8(v.v); }
    }
    w.u8(this.bones.length);
    for (const b of this.bones) { w.u16(b.from); w.u16(b.to); w.u8(b.bone); }
    return w.bytes();
  }

  /* the texture size this material's u,v pairs are relative to */
  uvDivisor(materialIndex, gifs) {
    const t = this.materials[materialIndex] ? this.materials[materialIndex].tex : 0;
    const g = gifs[t] || gifs[0];
    return g ? gifSize(g) : [128, 128];
  }

  bbox() {
    if (!this.nv) return null;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.nv; i++) for (let k = 0; k < 3; k++) {
      const v = this.verts[i * 3 + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
    return [lo, hi];
  }
}

/* ---------------------------- skeleton --------------------------- */

class Skeleton {
  /* u8 bone count, then per bone: i16 a,b,c, i16 d,e,f, u8 parent.
     Parent 0xFF is a root. The female body has 75 bones, the male 74,
     and a mesh's bone ids index this list. */
  static looksLike(content) {
    const n = content.length - 9;
    return content.length > 9 && n % 13 === 0 && content[8] === n / 13;
  }

  constructor(content) {
    const dv = new DataView(content.buffer, content.byteOffset, content.byteLength);
    this.kind = ascii(content, 0, 8);
    const n = content[8];
    let p = 9;
    this.bones = [];
    for (let i = 0; i < n; i++) {
      this.bones.push({
        a: dv.getInt16(p), b: dv.getInt16(p + 2), c: dv.getInt16(p + 4),
        d: dv.getInt16(p + 6), e: dv.getInt16(p + 8), f: dv.getInt16(p + 10),
        parent: content[p + 12]
      });
      p += 13;
    }
    if (p !== content.length)
      throw new Error('skeleton has ' + (content.length - p) + ' trailing bytes');
  }

  write() {
    const w = new Writer();
    w.str(this.kind);
    w.u8(this.bones.length);
    for (const b of this.bones) {
      w.i16(b.a); w.i16(b.b); w.i16(b.c);
      w.i16(b.d); w.i16(b.e); w.i16(b.f);
      w.u8(b.parent);
    }
    return w.bytes();
  }

  roots() { return this.bones.filter(b => b.parent === 0xFF).length; }
}

/* ----------------------------- textures -------------------------- */

function gifSize(u8) {
  if (!u8 || u8.length < 10) return [128, 128];
  return [u8[6] | (u8[7] << 8), u8[8] | (u8[9] << 8)];
}

/* ---------------------------- container -------------------------- */

class MXW {
  constructor(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (ascii(u8, 0, 4) !== 'OK  ')
      throw new Error('not an MXW container (starts "' + ascii(u8, 0, 4) + '")');
    this.version = dv.getUint32(4);
    this.meshId  = dv.getUint32(8);
    const count  = dv.getUint32(12);

    this.meshes = []; this.skeletons = []; this.gifs = []; this.blobs = [];
    this.order = [];
    this.truncated = 0;

    let p = 0x10;
    for (let i = 0; i < count; i++) {
      if (p + 4 > u8.length) { this.truncated++; continue; }
      const size = dv.getUint32(p);
      if (p + 4 + size > u8.length) { this.truncated++; break; }
      this.add(u8.subarray(p + 4, p + 4 + size));
      p += 4 + size;
    }
    this.trailing = u8.subarray(p);
  }

  add(content) {
    if (MXW_TYPES.indexOf(ascii(content, 0, 8)) >= 0) {
      /* geometry and skeletons share the type string, so try the mesh
         first -- its payload must be consumed exactly -- then the
         skeleton */
      try {
        this.meshes.push(new Mesh(content));
        this.order.push(['mesh', this.meshes.length - 1]);
        return;
      } catch (e) { /* fall through */ }
      try {
        this.skeletons.push(new Skeleton(content));
        this.order.push(['skeleton', this.skeletons.length - 1]);
        return;
      } catch (e) { /* fall through */ }
    } else if (ascii(content, 0, 4) === 'GIF8') {
      this.gifs.push(content);
      this.order.push(['gif', this.gifs.length - 1]);
      return;
    }
    this.blobs.push(content);
    this.order.push(['blob', this.blobs.length - 1]);
  }

  write() {
    const src = { mesh: this.meshes, skeleton: this.skeletons,
                  gif: this.gifs, blob: this.blobs };
    const parts = this.order.map(([k, i]) => {
      const x = src[k][i];
      return x instanceof Uint8Array ? x : x.write();
    });
    const w = new Writer();
    w.str('OK  ');
    w.u32(this.version);
    w.u32(this.meshId);
    w.u32(parts.length + this.truncated);
    for (const part of parts) { w.u32(part.length); w.raw(part); }
    w.raw(this.trailing);
    return w.bytes();
  }

  /* --- editing --- */

  replaceGif(index, u8) {
    if (index < 0 || index >= this.gifs.length)
      throw new Error('no texture ' + index + ' (file has ' + this.gifs.length + ')');
    if (ascii(u8, 0, 4) !== 'GIF8') throw new Error('replacement is not a GIF');
    this.gifs[index] = u8;
  }

  addGif(u8) {
    if (ascii(u8, 0, 4) !== 'GIF8') throw new Error('not a GIF');
    this.gifs.push(u8);
    this.order.push(['gif', this.gifs.length - 1]);
    return this.gifs.length - 1;
  }
}

/* True when writing the file back reproduces the source exactly. */
function roundTrips(buf) {
  const a = new Uint8Array(buf), b = new MXW(buf).write();
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
