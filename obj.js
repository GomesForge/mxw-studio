/* Wavefront OBJ import.

   The point of this is the round trip: export a mesh, edit it in
   whatever modeller you like, bring it back. So the numbers have to
   land where the exporter left them.

   What the format costs you, and why:

   - Vertex coordinates are i16. The exporter divides by 1000, so this
     multiplies by 1000 and rounds. Anything beyond +/-32767 is clipped
     and reported rather than silently wrapped.
   - Vertex and face counts are u16, so 65535 each is the ceiling.
   - A face carries 3 or 4 corners and nothing else, so n-gons are
     triangulated by fanning from the first corner.
   - Texture coordinates are a single byte per axis, in texture pixels.
     A 128x128 texture gives 0..128, so the precision you get back is
     whole pixels -- fine for these textures, lossy for anything finer.
   - There are no per-vertex UVs in this format, they are per corner,
     which is why the exporter duplicates them and this reads them back
     per corner.

   Replacing the geometry of a loaded mesh keeps its textures, material
   names and skeleton, because an OBJ carries none of those. Importing
   on its own produces a mesh with no texture, which a reader may well
   refuse -- so the caller is told to add one. */

function parseOBJ(text) {
  const verts = [];      /* [[x,y,z]] in OBJ units */
  const norms = [];
  const uvs = [];
  const faces = [];      /* [{corners:[{v,t,n}], mtl}] */
  let mtl = null;
  const names = [];

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    const sp = t.split(/\s+/);
    const k = sp[0];
    if (k === 'v') {
      verts.push([+sp[1] || 0, +sp[2] || 0, +sp[3] || 0]);
    } else if (k === 'vn') {
      norms.push([+sp[1] || 0, +sp[2] || 0, +sp[3] || 0]);
    } else if (k === 'vt') {
      uvs.push([+sp[1] || 0, +sp[2] || 0]);
    } else if (k === 'usemtl') {
      mtl = sp.slice(1).join(' ');
      if (mtl && names.indexOf(mtl) < 0) names.push(mtl);
    } else if (k === 'f') {
      const corners = [];
      for (let i = 1; i < sp.length; i++) {
        /* v, v/vt, v//vn and v/vt/vn are all legal */
        const bits = sp[i].split('/');
        const raw = bits.map(b => parseInt(b, 10));
        const fix = (x, len) => !isFinite(x) ? -1 : (x < 0 ? len + x : x - 1);
        corners.push({
          v: fix(raw[0], verts.length),
          t: fix(raw[1], uvs.length),
          n: fix(raw[2], norms.length)
        });
      }
      if (corners.length >= 3) faces.push({ corners, mtl });
    }
  }
  return { verts, norms, uvs, faces, materialNames: names };
}

/* Build an MXW Mesh from a parsed OBJ.
   opts.texSize   [w,h] the texture the UVs should be expressed in
   opts.scale     OBJ units to model units, default 1000 to match export
   opts.kind      resource type string, default MXW3DHUD
   Returns {mesh, warnings}. */
function objToMesh(obj, opts) {
  opts = opts || {};
  const scale = opts.scale === undefined ? 1000 : opts.scale;
  const tex = opts.texSize || [128, 128];
  const warnings = [];

  if (!obj.verts.length) throw new Error('this OBJ has no vertices');
  if (!obj.faces.length) throw new Error('this OBJ has no faces');
  if (obj.verts.length > 65535)
    throw new Error('this OBJ has ' + obj.verts.length +
                    ' vertices; the format stores the count in a u16, ' +
                    'so 65535 is the most it can hold');

  let clipped = 0;
  const q = x => {
    let v = Math.round(x * scale);
    if (v > 32767) { v = 32767; clipped++; }
    if (v < -32768) { v = -32768; clipped++; }
    return v;
  };

  const mesh = new Mesh();
  mesh.kind = opts.kind || 'MXW3DHUD';
  mesh.nv = obj.verts.length;
  mesh.verts = new Int16Array(mesh.nv * 3);
  mesh.norms = new Float32Array(mesh.nv * 3);
  obj.verts.forEach((p, i) => {
    mesh.verts[i * 3] = q(p[0]);
    mesh.verts[i * 3 + 1] = q(p[1]);
    mesh.verts[i * 3 + 2] = q(p[2]);
  });

  /* normals per vertex: take the OBJ's where a corner names one,
     otherwise accumulate the face normals */
  const acc = new Float32Array(mesh.nv * 3);
  let named = 0;
  for (const f of obj.faces) {
    for (const c of f.corners) {
      if (c.n >= 0 && c.n < obj.norms.length && c.v >= 0 && c.v < mesh.nv) {
        const n = obj.norms[c.n];
        acc[c.v * 3] += n[0]; acc[c.v * 3 + 1] += n[1]; acc[c.v * 3 + 2] += n[2];
        named++;
      }
    }
  }
  if (!named) {
    warnings.push('the OBJ carries no vertex normals, so they were ' +
                  'computed from the faces');
    for (const f of obj.faces) {
      const a = obj.verts[f.corners[0].v], b = obj.verts[f.corners[1].v],
            c = obj.verts[f.corners[2].v];
      if (!a || !b || !c) continue;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * w[2] - u[2] * w[1],
                 u[2] * w[0] - u[0] * w[2],
                 u[0] * w[1] - u[1] * w[0]];
      for (const cr of f.corners) {
        if (cr.v < 0 || cr.v >= mesh.nv) continue;
        acc[cr.v * 3] += n[0]; acc[cr.v * 3 + 1] += n[1]; acc[cr.v * 3 + 2] += n[2];
      }
    }
  }
  for (let i = 0; i < mesh.nv; i++) {
    const x = acc[i * 3], y = acc[i * 3 + 1], z = acc[i * 3 + 2];
    const len = Math.hypot(x, y, z) || 1;
    mesh.norms[i * 3] = x / len;
    mesh.norms[i * 3 + 1] = y / len;
    mesh.norms[i * 3 + 2] = z / len;
  }

  /* faces: fan any n-gon down to triangles, and put the UVs back into
     texture pixels */
  const noUV = !obj.uvs.length;
  if (noUV) warnings.push('the OBJ carries no texture coordinates, so ' +
                          'every corner was given 0,0 -- the mesh will ' +
                          'draw one colour until you set them');
  const toUV = t => {
    if (t < 0 || t >= obj.uvs.length) return [0, 0];
    const p = obj.uvs[t];
    const u = Math.max(0, Math.min(255, Math.round(p[0] * tex[0])));
    const v = Math.max(0, Math.min(255, Math.round((1 - p[1]) * tex[1])));
    return [u, v];
  };

  const matIndex = {};
  (obj.materialNames.length ? obj.materialNames : ['mesh']).forEach((n, i) =>
    matIndex[n] = i);
  mesh.faces = [];
  let ngons = 0;
  for (const f of obj.faces) {
    const mi = f.mtl && matIndex[f.mtl] !== undefined ? matIndex[f.mtl] : 0;
    const cs = f.corners;
    const emit = idx => {
      const vs = idx.map(k => {
        const c = cs[k];
        const uv = toUV(c.t);
        return { i: Math.max(0, Math.min(mesh.nv - 1, c.v)), u: uv[0], v: uv[1] };
      });
      mesh.faces.push({ mat: mi, vs });
    };
    if (cs.length === 3) emit([0, 1, 2]);
    else if (cs.length === 4) emit([0, 1, 2, 3]);
    else {
      ngons++;
      for (let k = 1; k + 1 < cs.length; k++) emit([0, k, k + 1]);
    }
  }
  if (ngons) warnings.push(ngons + ' face(s) had more than four corners ' +
                           'and were split into triangles');
  if (mesh.faces.length > 65535)
    throw new Error('that comes to ' + mesh.faces.length +
                    ' faces; the count is a u16, so 65535 is the ceiling');
  if (clipped)
    warnings.push(clipped + ' coordinate(s) fell outside the i16 range at ' +
                  'this scale and were clipped -- scale the model down ' +
                  'before exporting');

  mesh.materials = (obj.materialNames.length ? obj.materialNames : ['mesh'])
    .map(n => ({ name: n.slice(0, 255), props: [0, 0xBF, 0xBF, 0xBF, 0, 0xFF], tex: 0 }));

  /* One range covering every vertex is the simplest table the format
     accepts: contiguous, and ending exactly at the vertex count. */
  mesh.bones = [{ from: 0, to: mesh.nv, bone: 0 }];

  return { mesh, warnings };
}

/* Replace a loaded container's geometry, keeping everything an OBJ
   cannot carry: the textures, the material bindings and the skeleton. */
function objReplaceGeometry(mxw, meshIndex, obj, opts) {
  const old = mxw.meshes[meshIndex];
  if (!old) throw new Error('there is no mesh at index ' + meshIndex);
  const texSize = mxw.gifs.length ? gifSize(mxw.gifs[old.materials.length
    ? old.materials[0].tex : 0]) : [128, 128];
  const res = objToMesh(obj, Object.assign({ texSize, kind: old.kind }, opts));
  const fresh = res.mesh;
  /* The texture name list is not something an OBJ can carry, and a mesh
     with an empty list references no texture at all -- so it is carried
     over rather than dropped. */
  if (old.textures.length) {
    fresh.textures = old.textures.slice();
  }
  /* Same for the bone table: the OBJ importer can only produce the one
     range covering every vertex, which loses the original skinning. */
  if (old.bones.length > 1) {
    res.warnings.push('the original bone table had ' + old.bones.length +
      ' ranges and an OBJ cannot carry it, so it was replaced by a single ' +
      'range over every vertex -- the mesh will follow one bone');
  }
  /* keep the original materials where the counts allow it, so texture
     bindings survive */
  if (old.materials.length) {
    const keep = old.materials.map(m => ({ name: m.name, props: m.props.slice(), tex: m.tex }));
    const used = new Set(fresh.faces.map(f => f.mat));
    if (Math.max(...used) < keep.length) {
      fresh.materials = keep;
      res.warnings.push('kept the original ' + keep.length +
                        ' material(s) and their texture bindings');
    } else {
      res.warnings.push('the OBJ needs ' + (Math.max(...used) + 1) +
                        ' materials but the file had ' + keep.length +
                        ', so the OBJ names were used and the texture ' +
                        'bindings all point at tex0');
    }
  }
  mxw.meshes[meshIndex] = fresh;
  return res.warnings;
}

/* A container holding just this mesh. It has no texture, which a reader
   may refuse, so the caller should say so. */
function objToContainer(obj, opts) {
  const res = objToMesh(obj, opts);
  const m = new MXW(null);
  m.version = 1;
  m.meshId = (opts && opts.meshId) || 0;
  m.meshes = [res.mesh];
  m.gifs = [];
  m.skeletons = [];
  m.blobs = [];
  m.order = [['mesh', 0]];
  m.truncated = 0;
  m.trailing = new Uint8Array(0);
  return { mxw: m, warnings: res.warnings };
}
