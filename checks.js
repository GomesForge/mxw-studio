/* Mesh and sprite health checks.

   The readers enforce what the format requires to parse. These are the
   things that parse fine and are still wrong, or are fine but worth
   knowing before you save: geometry a modeller would flag, and counts
   that are close to a field's ceiling.

   Everything here is a pure function over a parsed file, so it can be
   run from the page or from a test. */

/* A face whose corners do not name three distinct vertices has no area.
   It costs bytes, renders nothing, and usually means something upstream
   collapsed two vertices. */
function degenerateFaces(m) {
  const out = [];
  m.faces.forEach((f, i) => {
    const ids = f.vs.map(v => v.i);
    if (new Set(ids).size < 3) out.push(i);
  });
  return out;
}

function unusedVertices(m) {
  const used = new Uint8Array(m.nv);
  for (const f of m.faces) for (const v of f.vs) {
    if (v.i < m.nv) used[v.i] = 1;
  }
  const out = [];
  for (let i = 0; i < m.nv; i++) if (!used[i]) out.push(i);
  return out;
}

/* Vertices at the same coordinate. Not an error -- a hard edge or a UV
   seam needs them -- but a large count next to a small face count means
   geometry that could be welded. */
function duplicateVertices(m) {
  const seen = new Map();
  let dup = 0;
  for (let i = 0; i < m.nv; i++) {
    const k = m.verts[i * 3] + ',' + m.verts[i * 3 + 1] + ',' + m.verts[i * 3 + 2];
    if (seen.has(k)) dup++; else seen.set(k, i);
  }
  return dup;
}

/* u,v are texture pixels, so a corner past the texture's size samples
   outside it. The reader cannot catch this: both values fit in a byte. */
function uvOutOfBounds(m, gifs) {
  let bad = 0;
  const nMat = Math.max(1, m.materials.length);
  for (let mi = 0; mi < nMat; mi++) {
    const [su, sv] = m.uvDivisor(mi, gifs);
    for (const f of m.faces) {
      if (m.materials.length > 1 && f.mat !== mi) continue;
      for (const v of f.vs) if (v.u > su || v.v > sv) bad++;
    }
  }
  return bad;
}

/* How well each face's geometric normal agrees with the normals stored
   at its own vertices. Near +1 means the winding matches; near -1 means
   the face is inverted and would vanish under backface culling even
   though it looks fine here, because the viewer draws both sides.

   Quads are triangulated by fanning from the first corner. That is the
   right order for these files: measured over 3543 quads it agrees with
   the stored normals at +0.75, where treating them as a strip gives
   +0.0008 -- indistinguishable from random. */
function windingAgreement(m) {
  if (!m.faces.length) return null;
  let sum = 0, n = 0, inverted = 0;
  const at = i => [m.verts[i * 3], m.verts[i * 3 + 1], m.verts[i * 3 + 2]];
  for (const f of m.faces) {
    const ids = f.vs.map(v => v.i);
    if (new Set(ids).size < 3 || Math.max(...ids) >= m.nv) continue;
    const a = at(ids[0]), b = at(ids[1]), c = at(ids[2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const g = [u[1] * w[2] - u[2] * w[1],
               u[2] * w[0] - u[0] * w[2],
               u[0] * w[1] - u[1] * w[0]];
    const gl = Math.hypot(g[0], g[1], g[2]);
    if (gl < 1e-9) continue;
    let s = [0, 0, 0];
    for (const i of ids) {
      s[0] += m.norms[i * 3]; s[1] += m.norms[i * 3 + 1]; s[2] += m.norms[i * 3 + 2];
    }
    const sl = Math.hypot(s[0], s[1], s[2]);
    if (sl < 1e-9) continue;
    const d = (g[0] * s[0] + g[1] * s[1] + g[2] * s[2]) / (gl * sl);
    sum += d;
    if (d < -0.2) inverted++;
    n++;
  }
  return n ? { mean: sum / n, inverted, counted: n } : null;
}

/* The bone table has to partition the vertex list: start at 0, run
   contiguously, and end exactly at the vertex count. */
function boneTableProblem(m) {
  if (!m.bones.length) return 'no bone table';
  if (m.bones[0].from !== 0)
    return 'starts at vertex ' + m.bones[0].from + ', not 0';
  if (m.bones[m.bones.length - 1].to !== m.nv)
    return 'ends at ' + m.bones[m.bones.length - 1].to + ' but there are ' +
           m.nv + ' vertices';
  for (let i = 0; i < m.bones.length - 1; i++) {
    if (m.bones[i].to !== m.bones[i + 1].from)
      return 'range ' + i + ' ends at ' + m.bones[i].to + ' and ' + (i + 1) +
             ' starts at ' + m.bones[i + 1].from;
  }
  return null;
}

/* How close each count is to the ceiling of the field that stores it.
   Worth seeing before an import, not after a save fails. */
const FIELD_LIMITS = [
  ['vertices', m => m.nv, 65535, 'u16'],
  ['faces', m => m.faces.length, 65535, 'u16'],
  ['textures named', m => m.textures.length, 255, 'u8'],
  ['materials', m => m.materials.length, 255, 'u8'],
  ['bone ranges', m => m.bones.length, 255, 'u8']
];

function meshReport(mxw, meshIndex) {
  const m = mxw.meshes[meshIndex || 0];
  if (!m) return null;
  const deg = degenerateFaces(m);
  const unused = unusedVertices(m);
  const wind = windingAgreement(m);
  const notes = [];

  if (deg.length)
    notes.push({ level: 'warn', text: deg.length +
      ' face(s) have no area: their corners do not name three distinct ' +
      'vertices. They cost bytes and draw nothing.' });
  if (unused.length)
    notes.push({ level: 'info', text: unused.length +
      ' vertex/vertices are never used by a face.' });
  const uv = uvOutOfBounds(m, mxw.gifs);
  if (uv)
    notes.push({ level: 'warn', text: uv +
      ' texture corner(s) fall outside the texture their material draws ' +
      'from, so they sample past its edge.' });
  if (wind && wind.inverted)
    notes.push({ level: 'warn', text: wind.inverted + ' of ' + wind.counted +
      ' face(s) are wound against the normals stored at their own ' +
      'vertices. They look right here because both sides are drawn, and ' +
      'would disappear anywhere that culls backfaces.' });
  const bone = boneTableProblem(m);
  if (bone)
    notes.push({ level: m.bones.length ? 'warn' : 'info',
      text: 'bone table: ' + bone });
  for (const [name, get, cap, field] of FIELD_LIMITS) {
    const v = get(m);
    if (v > cap)
      notes.push({ level: 'bad', text: name + ': ' + v + ' exceeds ' + cap +
        ', the most a ' + field + ' can hold. This file cannot be saved.' });
    else if (v > cap * 0.9)
      notes.push({ level: 'warn', text: name + ': ' + v + ' of a possible ' +
        cap + ' (' + field + ')' });
  }

  return {
    notes,
    stats: {
      vertices: m.nv,
      faces: m.faces.length,
      quads: m.faces.filter(f => f.vs.length === 4).length,
      duplicateVertices: duplicateVertices(m),
      winding: wind ? wind.mean : null
    }
  };
}

function spriteReport(gra) {
  const notes = [];
  const empty = gra.frames.filter(f => !f.runs.length).length;
  const pal = gra.palette();
  let total = 0, tinted = 0;
  for (const f of gra.frames) {
    for (const r of f.runs) {
      total += r.px.length;
      for (const v of r.px) if (tintIndexOf(v) >= 0) tinted++;
    }
  }
  if (empty)
    notes.push({ level: 'info', text: empty + ' frame(s) hold no pixels.' });
  if (pal.length > 4096)
    notes.push({ level: 'warn', text: pal.length + ' distinct colours. ' +
      'These files store colour per pixel, so a photographic import ' +
      'inflates both the palette and the file. Flatten it first.' });
  if (gra.frames.length > 230)
    notes.push({ level: 'warn', text: gra.frames.length +
      ' frames of a possible 255 (u8).' });
  if (gra.trailing && gra.trailing.length)
    notes.push({ level: 'info', text: gra.trailing.length +
      ' byte(s) sit past the last frame the table describes, and are ' +
      'kept as they are.' });
  return {
    notes,
    stats: {
      frames: gra.frames.length,
      colours: pal.length,
      pixels: total,
      reservedShare: total ? tinted / total : 0
    }
  };
}
