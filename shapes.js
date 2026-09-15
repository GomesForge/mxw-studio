/* Primitive geometry, so a mesh can be started from nothing.

   Each builder returns the same shape an OBJ parses into --
   {verts, norms, uvs, faces, materialNames} -- and then goes through
   objToMesh, which already knows how to quantise coordinates to i16,
   turn texture coordinates into whole pixels, keep faces at three or
   four corners and write a bone table the format accepts. Duplicating
   any of that here would be a second place for it to be wrong.

   Sizes are in the same units the meshes use, where a body runs about
   7090 tall. The defaults are sized against that: a 1000-unit box is
   about a hand.

   Depends on obj.js. */

/* An OBJ-shaped accumulator, so the builders below read as geometry
   rather than as bookkeeping. */
function shapeBuilder(name) {
  return {
    verts: [], norms: [], uvs: [], faces: [],
    materialNames: [name || 'shape'],
    /* a vertex, its normal and its texture coordinate, added together
       because a primitive knows all three at once */
    put(p, n, uv) {
      this.verts.push(p);
      this.norms.push(n);
      this.uvs.push(uv);
      return this.verts.length - 1;
    },
    /* Corners go in reversed.

       The builders below name them anticlockwise seen from outside,
       which is the convention most modellers use, and the format winds
       the other way -- checks.js caught every shape here as "wound
       against the normals stored at their own vertices", which is a
       mesh that lights as if it were inside out. Reversing once, in the
       one place faces are made, is better than remembering to do it
       six times. */
    quad(a, b, c, d) {
      this.faces.push({ mtl: this.materialNames[0],
                        corners: [d, c, b, a].map(i => ({ v: i, t: i, n: i })) });
    },
    tri(a, b, c) {
      this.faces.push({ mtl: this.materialNames[0],
                        corners: [c, b, a].map(i => ({ v: i, t: i, n: i })) });
    }
  };
}

/* A flat card facing the viewer.

   This is the shape most accessories actually are: a couple of quads
   with a cut-out texture. Two-sided, because a single quad disappears
   when you walk round it. */
function shapePlane(o) {
  o = o || {};
  const w = (o.width || 1200) / 2, h = (o.height || 1200) / 2;
  const s = shapeBuilder('plane');
  const front = [0, 0, -1], back = [0, 0, 1];
  const a = s.put([-w, -h, 0], front, [0, 1]);
  const b = s.put([w, -h, 0], front, [1, 1]);
  const c = s.put([w, h, 0], front, [1, 0]);
  const d = s.put([-w, h, 0], front, [0, 0]);
  s.quad(a, b, c, d);
  if (o.twoSided !== false) {
    const e = s.put([w, -h, 0], back, [1, 1]);
    const f = s.put([-w, -h, 0], back, [0, 1]);
    const g = s.put([-w, h, 0], back, [0, 0]);
    const i = s.put([w, h, 0], back, [1, 0]);
    s.quad(e, f, g, i);
  }
  return s;
}

/* A box, each face its own quad so the corners stay sharp: sharing
   vertices between faces would average their normals and round the
   edges off. */
function shapeBox(o) {
  o = o || {};
  const x = (o.width || 1000) / 2,
        y = (o.height || o.width || 1000) / 2,
        z = (o.depth || o.width || 1000) / 2;
  const s = shapeBuilder('box');
  const side = (n, p0, p1, p2, p3) => {
    const a = s.put(p0, n, [0, 1]), b = s.put(p1, n, [1, 1]);
    const c = s.put(p2, n, [1, 0]), d = s.put(p3, n, [0, 0]);
    s.quad(a, b, c, d);
  };
  side([0, 0, -1], [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z]);
  side([0, 0, 1], [x, -y, z], [-x, -y, z], [-x, y, z], [x, y, z]);
  side([-1, 0, 0], [-x, -y, z], [-x, -y, -z], [-x, y, -z], [-x, y, z]);
  side([1, 0, 0], [x, -y, -z], [x, -y, z], [x, y, z], [x, y, -z]);
  side([0, 1, 0], [-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]);
  side([0, -1, 0], [-x, -y, z], [x, -y, z], [x, -y, -z], [-x, -y, -z]);
  return s;
}

/* A cylinder, open or capped. */
function shapeCylinder(o) {
  o = o || {};
  const r = (o.radius || 500), h = (o.height || 1400) / 2;
  const n = Math.max(3, Math.min(64, o.segments || 16));
  const s = shapeBuilder('cylinder');
  const ring = (y, v) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const c = Math.cos(a), si = Math.sin(a);
      out.push(s.put([c * r, y, si * r], [c, 0, si], [i / n, v]));
    }
    return out;
  };
  const low = ring(-h, 1), high = ring(h, 0);
  for (let i = 0; i < n; i++) s.quad(low[i], low[i + 1], high[i + 1], high[i]);
  if (o.caps !== false) {
    const top = s.put([0, h, 0], [0, 1, 0], [0.5, 0.5]);
    const bot = s.put([0, -h, 0], [0, -1, 0], [0.5, 0.5]);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
      const ta = s.put([Math.cos(a) * r, h, Math.sin(a) * r], [0, 1, 0],
                       [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]);
      const tb = s.put([Math.cos(b) * r, h, Math.sin(b) * r], [0, 1, 0],
                       [0.5 + Math.cos(b) * 0.5, 0.5 + Math.sin(b) * 0.5]);
      s.tri(top, ta, tb);
      const ba = s.put([Math.cos(a) * r, -h, Math.sin(a) * r], [0, -1, 0],
                       [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]);
      const bb = s.put([Math.cos(b) * r, -h, Math.sin(b) * r], [0, -1, 0],
                       [0.5 + Math.cos(b) * 0.5, 0.5 + Math.sin(b) * 0.5]);
      s.tri(bot, bb, ba);
    }
  }
  return s;
}

/* A cone, or a pyramid at three or four segments. */
function shapeCone(o) {
  o = o || {};
  const r = (o.radius || 500), h = (o.height || 1400);
  const n = Math.max(3, Math.min(64, o.segments || 16));
  const s = shapeBuilder('cone');
  const bot = s.put([0, 0, 0], [0, -1, 0], [0.5, 0.5]);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
    const pa = [Math.cos(a) * r, 0, Math.sin(a) * r];
    const pb = [Math.cos(b) * r, 0, Math.sin(b) * r];
    const mid = (a + b) / 2;
    const nrm = [Math.cos(mid) * 0.7, 0.7, Math.sin(mid) * 0.7];
    const tip = s.put([0, h, 0], nrm, [(i + 0.5) / n, 0]);
    s.tri(tip, s.put(pa, nrm, [i / n, 1]), s.put(pb, nrm, [(i + 1) / n, 1]));
    s.tri(bot, s.put(pb, [0, -1, 0], [0.5 + Math.cos(b) * 0.5, 0.5 + Math.sin(b) * 0.5]),
          s.put(pa, [0, -1, 0], [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]));
  }
  return s;
}

/* A sphere by latitude and longitude. The poles are triangles, since a
   quad there would have two corners in the same place. */
function shapeSphere(o) {
  o = o || {};
  const r = o.radius || 600;
  const seg = Math.max(3, Math.min(64, o.segments || 16));
  const rings = Math.max(2, Math.min(64, o.rings || Math.round(seg / 2)));
  const s = shapeBuilder('sphere');
  const grid = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, phi = v * Math.PI;
    const row = [];
    for (let x = 0; x <= seg; x++) {
      const u = x / seg, theta = u * Math.PI * 2;
      const n = [Math.sin(phi) * Math.cos(theta), Math.cos(phi),
                 Math.sin(phi) * Math.sin(theta)];
      row.push(s.put([n[0] * r, n[1] * r, n[2] * r], n, [u, v]));
    }
    grid.push(row);
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < seg; x++) {
      const a = grid[y][x], b = grid[y][x + 1];
      const c = grid[y + 1][x + 1], d = grid[y + 1][x];
      /* this grid runs the opposite way round from the other
         builders, so its corners are named in the other order */
      if (y === 0) s.tri(d, c, a);
      else if (y === rings - 1) s.tri(c, b, a);
      else s.quad(d, c, b, a);
    }
  }
  return s;
}

/* A ring, for a halo or a wheel. */
function shapeTorus(o) {
  o = o || {};
  const R = o.radius || 700, r = o.tube || 180;
  const big = Math.max(3, Math.min(64, o.segments || 20));
  const small = Math.max(3, Math.min(32, o.rings || 10));
  const s = shapeBuilder('torus');
  const grid = [];
  for (let i = 0; i <= big; i++) {
    const u = i / big, a = u * Math.PI * 2;
    const row = [];
    for (let j = 0; j <= small; j++) {
      const v = j / small, b = v * Math.PI * 2;
      const nx = Math.cos(b) * Math.cos(a), nz = Math.cos(b) * Math.sin(a);
      const ny = Math.sin(b);
      row.push(s.put([(R + r * Math.cos(b)) * Math.cos(a),
                      r * Math.sin(b),
                      (R + r * Math.cos(b)) * Math.sin(a)],
                     [nx, ny, nz], [u, v]));
    }
    grid.push(row);
  }
  for (let i = 0; i < big; i++) {
    for (let j = 0; j < small; j++) {
      s.quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
    }
  }
  return s;
}

const SHAPES = {
  plane: { label: 'Card', build: shapePlane,
           note: 'a flat two-sided quad -- what most accessories are' },
  box: { label: 'Box', build: shapeBox, note: 'six quads, sharp edges' },
  cylinder: { label: 'Cylinder', build: shapeCylinder, note: 'capped' },
  cone: { label: 'Cone', build: shapeCone, note: 'a pyramid at 3 or 4 sides' },
  sphere: { label: 'Sphere', build: shapeSphere, note: 'latitude by longitude' },
  torus: { label: 'Ring', build: shapeTorus, note: 'a halo or a wheel' }
};

/* Drop vertices no face refers to, renumbering the ones that stay.

   The sphere's pole rows leave a couple behind, since a pole is a
   triangle where the grid wants a quad. Two stray vertices hurt
   nothing, but checks.js reports them on every sphere anybody makes,
   and a warning you learn to ignore is worse than no warning. */
function shapeCompact(obj) {
  const used = new Set();
  for (const f of obj.faces) for (const c of f.corners) used.add(c.v);
  if (used.size === obj.verts.length) return obj;
  const map = new Map();
  const verts = [], norms = [], uvs = [];
  obj.verts.forEach((p, i) => {
    if (!used.has(i)) return;
    map.set(i, verts.length);
    verts.push(p);
    norms.push(obj.norms[i]);
    uvs.push(obj.uvs[i]);
  });
  obj.verts = verts;
  obj.norms = norms;
  obj.uvs = uvs;
  for (const f of obj.faces) {
    for (const c of f.corners) {
      const k = map.get(c.v);
      c.v = k; c.t = k; c.n = k;
    }
  }
  return obj;
}

/* Build one, as a container ready to open. `at` shifts it, which is
   how a new piece lands at head height rather than at the feet. */
function shapeContainer(kind, opts) {
  const spec = SHAPES[kind];
  if (!spec) throw new Error('no such shape: ' + kind);
  const obj = shapeCompact(spec.build(opts || {}));
  const at = (opts && opts.at) || [0, 0, 0];
  if (at[0] || at[1] || at[2]) {
    obj.verts = obj.verts.map(p => [p[0] + at[0], p[1] + at[1], p[2] + at[2]]);
  }
  /* objToMesh quantises by multiplying, and these are already in model
     units, so it must not scale them again */
  return objToContainer(obj, { scale: 1, kind: (opts && opts.kind) || 'MXW3DHUD' });
}

/* ------------------------- whole-mesh edits ---------------------- */
/* Moving a finished mesh about, which is otherwise a trip out to a
   modeller and back. Every one of these writes i16 coordinates, so a
   file stays a file. */
function meshBounds(mesh) {
  if (!mesh.nv) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.nv; i++) {
    for (let k = 0; k < 3; k++) {
      const v = mesh.verts[i * 3 + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  }
  return { lo, hi };
}

/* Apply a function to every vertex, clamping to the i16 the format
   stores and reporting how much had to be clamped. */
function meshMap(mesh, fn) {
  let clipped = 0;
  for (let i = 0; i < mesh.nv; i++) {
    const p = fn([mesh.verts[i * 3], mesh.verts[i * 3 + 1], mesh.verts[i * 3 + 2]], i);
    for (let k = 0; k < 3; k++) {
      let v = Math.round(p[k]);
      if (v > 32767) { v = 32767; clipped++; }
      if (v < -32768) { v = -32768; clipped++; }
      mesh.verts[i * 3 + k] = v;
    }
  }
  return clipped;
}

function meshScale(mesh, f) {
  return meshMap(mesh, p => [p[0] * f, p[1] * f, p[2] * f]);
}

/* Rotate about an axis, in degrees. Normals turn with the geometry, or
   the lighting comes out of step with the shape. */
function meshRotate(mesh, axis, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const turn = p => {
    if (axis === 'x') return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    if (axis === 'y') return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  };
  const clipped = meshMap(mesh, turn);
  for (let i = 0; i < mesh.nv; i++) {
    const n = turn([mesh.norms[i * 3], mesh.norms[i * 3 + 1], mesh.norms[i * 3 + 2]]);
    mesh.norms[i * 3] = n[0]; mesh.norms[i * 3 + 1] = n[1]; mesh.norms[i * 3 + 2] = n[2];
  }
  return clipped;
}

/* Mirror, and flip every face's winding with it -- a mirrored mesh
   whose faces still wind the old way is inside out. */
function meshMirror(mesh, axis) {
  const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let i = 0; i < mesh.nv; i++) {
    mesh.verts[i * 3 + k] = -mesh.verts[i * 3 + k];
    mesh.norms[i * 3 + k] = -mesh.norms[i * 3 + k];
  }
  for (const f of mesh.faces) f.vs.reverse();
  return 0;
}

function meshMove(mesh, d) {
  return meshMap(mesh, p => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
}

/* Centre on x and z but not y: a piece is worn at a height, and moving
   it vertically would take it off the body. */
function meshCentre(mesh) {
  const b = meshBounds(mesh);
  if (!b) return 0;
  return meshMove(mesh, [-(b.lo[0] + b.hi[0]) / 2, 0, -(b.lo[2] + b.hi[2]) / 2]);
}

function meshToFloor(mesh) {
  const b = meshBounds(mesh);
  if (!b) return 0;
  return meshMove(mesh, [0, -b.lo[1], 0]);
}
