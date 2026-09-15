/* The rig: turning a body's skeleton chunk into something that moves.

   A mesh carries a bone table that partitions its vertex list into
   contiguous spans, one span per bone, so skinning here is rigid --
   every vertex follows exactly one bone, with no weights to blend. That
   is simpler than a modern rig and it is what the format gives us.

   The rest pose comes out of the skeleton chunk, six i16 per bone. What
   those six mean was derived rather than assumed: every candidate
   reading was scored by how far each bone's joint landed from the
   vertices that bone owns, over all 149 bones of the two bodies. One
   reading won by two orders of magnitude, at 60 units of mean error on
   a body 7090 tall, and it puts the joints exactly where a skeleton
   should have them -- the head bone at the neck, the arm bone at the
   shoulder, the toe bone at the ball of the foot.

       offset   (0, field1, field2)
       rotation rx = field4, ry = field3, rz = field5
       order    R = Ry * Rx * Rz, which is three.js Euler order 'YXZ'
       local    T(offset) * R,  world = parent * local
       unit     PI / 2047 radians, so +-2047 is half a turn

   See docs/mxw-format.md. Depends on three.js. */

/* +-2047 is half a turn. */
const BONE_UNIT = Math.PI / 2047;

/* One bone, ready to pose: its rest transform relative to its parent,
   and the children that follow it. */
function buildRig(skel) {
  if (!skel || !skel.bones || !skel.bones.length) return null;
  /* The two readers hand the same six fields over differently -- the
     browser's as {a..f, parent}, the Python one as a tuple -- so take
     either rather than making the callers convert. */
  const six = b => Array.isArray(b) ? b.slice(0, 6)
                                    : [b.a, b.b, b.c, b.d, b.e, b.f];
  const parentOf = b => {
    const p = Array.isArray(b) ? b[6] : b.parent;
    return p === 0xFF ? -1 : p;
  };
  const bones = skel.bones.map((b, i) => {
    const f = six(b);
    return {
      index: i,
      parent: parentOf(b),
      /* kept as read, so a writer can put them back untouched */
      raw: f,
      offset: new THREE.Vector3(0, f[1], f[2]),
      rest: new THREE.Euler(f[4] * BONE_UNIT, f[3] * BONE_UNIT,
                            f[5] * BONE_UNIT, 'YXZ'),
      children: []
    };
  });
  const roots = [];
  for (const b of bones) {
    if (b.parent >= 0 && b.parent < bones.length) bones[b.parent].children.push(b.index);
    else roots.push(b.index);
  }
  /* parents before children, so one pass composes the whole tree */
  const order = [];
  const walk = i => { order.push(i); for (const k of bones[i].children) walk(k); };
  for (const r of roots) walk(r);
  /* a cycle or an orphan would leave bones out; take them in file order
     rather than dropping them */
  if (order.length !== bones.length) {
    for (let i = 0; i < bones.length; i++) if (order.indexOf(i) < 0) order.push(i);
  }
  return { bones: bones, roots: roots, order: order,
           rest: null, restInverse: null };
}

/* World matrices for a rig, with an optional rotation added to each
   bone on top of its rest rotation. `pose` is {boneIndex: [x, y, z]} in
   degrees; anything absent keeps its rest pose. */
function rigMatrices(rig, pose, out) {
  const m = out && out.length === rig.bones.length ? out
          : rig.bones.map(() => new THREE.Matrix4());
  const local = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const extra = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const D = Math.PI / 180;
  /* Rotations alone cannot lower a character to the floor, so a motion
     may move the root as well. It is the one translation in the format
     and it applies to the whole body. */
  const root = pose && pose.root;
  const rootShift = root
    ? new THREE.Matrix4().makeTranslation(root[0] || 0, root[1] || 0, root[2] || 0)
    : null;
  for (const i of rig.order) {
    const b = rig.bones[i];
    q.setFromEuler(b.rest);
    const p = pose && pose[i];
    if (p && (p[0] || p[1] || p[2])) {
      e.set(p[0] * D, p[1] * D, p[2] * D);
      extra.setFromEuler(e);
      /* the pose turns the bone in its own frame, after the rest
         rotation -- so a shoulder slider swings the arm rather than
         sweeping it through the body */
      q.multiply(extra);
    }
    local.compose(b.offset, q, one);
    if (b.parent >= 0) m[i].multiplyMatrices(m[b.parent], local);
    else if (rootShift) m[i].multiplyMatrices(rootShift, local);
    else m[i].copy(local);
  }
  return m;
}

/* The rest pose, cached: skinning needs its inverse. */
function rigRest(rig) {
  if (!rig.rest) {
    rig.rest = rigMatrices(rig, null);
    rig.restInverse = rig.rest.map(x => new THREE.Matrix4().copy(x).invert());
  }
  return rig.rest;
}

/* What to multiply a vertex by: where its bone is now, undoing where
   its bone was at rest. */
function rigSkinMatrices(rig, pose, out) {
  rigRest(rig);
  const now = rigMatrices(rig, pose, rig._scratch ||
    (rig._scratch = rig.bones.map(() => new THREE.Matrix4())));
  const m = out && out.length === rig.bones.length ? out
          : rig.bones.map(() => new THREE.Matrix4());
  for (let i = 0; i < rig.bones.length; i++) {
    m[i].multiplyMatrices(now[i], rig.restInverse[i]);
  }
  return m;
}

/* Which bone owns each vertex of a mesh.

   The bone table is a list of contiguous spans; a vertex outside every
   span follows no bone and stays put, which is what -1 means here. */
function boneOfVertex(mesh) {
  const own = new Int16Array(mesh.nv).fill(-1);
  for (const r of mesh.bones) {
    /* the browser reader gives {bone, from, to}, the Python one a
       [from, to, bone] tuple */
    const from = Math.max(0, Array.isArray(r) ? r[0] : r.from);
    const to = Math.min(mesh.nv, Array.isArray(r) ? r[1] : r.to);
    const id = Array.isArray(r) ? r[2] : r.bone;
    for (let i = from; i < to; i++) own[i] = id;
  }
  return own;
}

/* Move a geometry to a pose.

   `src` holds the rest positions and normals as they were built, and
   `vertexBone` says which bone each emitted vertex follows -- the
   geometry is non-indexed, so one source vertex appears once per face
   corner that uses it. Positions and normals are written in place and
   the attributes marked dirty; nothing is reallocated, so this is cheap
   enough to run every frame. */
function skinGeometry(geo, src, vertexBone, skinMats) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal ? geo.attributes.normal.array : null;
  const n = vertexBone.length;
  for (let i = 0; i < n; i++) {
    const b = vertexBone[i];
    const o = i * 3;
    if (b < 0 || !skinMats[b]) {
      pos[o] = src.pos[o]; pos[o + 1] = src.pos[o + 1]; pos[o + 2] = src.pos[o + 2];
      if (nor) { nor[o] = src.nor[o]; nor[o + 1] = src.nor[o + 1]; nor[o + 2] = src.nor[o + 2]; }
      continue;
    }
    const m = skinMats[b].elements;
    const x = src.pos[o], y = src.pos[o + 1], z = src.pos[o + 2];
    pos[o]     = m[0] * x + m[4] * y + m[8]  * z + m[12];
    pos[o + 1] = m[1] * x + m[5] * y + m[9]  * z + m[13];
    pos[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (nor) {
      const nx = src.nor[o], ny = src.nor[o + 1], nz = src.nor[o + 2];
      /* the rotation part only: a normal has no position */
      nor[o]     = m[0] * nx + m[4] * ny + m[8]  * nz;
      nor[o + 1] = m[1] * nx + m[5] * ny + m[9]  * nz;
      nor[o + 2] = m[2] * nx + m[6] * ny + m[10] * nz;
    }
  }
  geo.attributes.position.needsUpdate = true;
  if (geo.attributes.normal) geo.attributes.normal.needsUpdate = true;
}

/* ------------------------------ motions -------------------------- */
/* A motion is rotations over time, one track per bone:

     { name, fps, loop, tracks: { "<bone>": [[frame, rx, ry, rz], ...] } }

   Rotations are degrees added to the bone's rest pose, which is the
   same thing the pose sliders produce, so a pose you build by hand can
   be saved as a one-frame motion and back. Frames between keys are
   interpolated linearly; a track with one key is a constant offset.

   This format is ours. An original motion file has one track per bone
   too -- the count matches the skeleton, 74 on one body and 75 on the
   other -- but none has ever surfaced, so nothing here claims to be the
   original animation data. */

function motionLength(motion) {
  let last = 0;
  for (const k in motion.tracks) {
    const t = motion.tracks[k];
    if (t.length) last = Math.max(last, t[t.length - 1][0]);
  }
  if (motion.root && motion.root.length) {
    last = Math.max(last, motion.root[motion.root.length - 1][0]);
  }
  return last;
}

/* The pose a motion holds at a given frame. */
/* One [frame, x, y, z] track, sampled. */
function sampleTrack(t, frame) {
  if (!t || !t.length) return null;
  let a = t[0], b = t[t.length - 1];
  if (frame <= a[0]) return [a[1], a[2], a[3]];
  if (frame >= b[0]) return [b[1], b[2], b[3]];
  for (let i = 0; i < t.length - 1; i++) {
    if (frame >= t[i][0] && frame <= t[i + 1][0]) { a = t[i]; b = t[i + 1]; break; }
  }
  const span = b[0] - a[0];
  const u = span > 0 ? (frame - a[0]) / span : 0;
  return [a[1] + (b[1] - a[1]) * u,
          a[2] + (b[2] - a[2]) * u,
          a[3] + (b[3] - a[3]) * u];
}

function motionPose(motion, frame) {
  const pose = {};
  if (motion.root) {
    const r = sampleTrack(motion.root, frame);
    if (r) pose.root = r;
  }
  for (const k in motion.tracks) {
    const t = motion.tracks[k];
    if (!t.length) continue;
    let a = t[0], b = t[t.length - 1];
    if (frame <= a[0]) { pose[k] = [a[1], a[2], a[3]]; continue; }
    if (frame >= b[0]) { pose[k] = [b[1], b[2], b[3]]; continue; }
    for (let i = 0; i < t.length - 1; i++) {
      if (frame >= t[i][0] && frame <= t[i + 1][0]) { a = t[i]; b = t[i + 1]; break; }
    }
    const span = b[0] - a[0];
    const u = span > 0 ? (frame - a[0]) / span : 0;
    pose[k] = [a[1] + (b[1] - a[1]) * u,
               a[2] + (b[2] - a[2]) * u,
               a[3] + (b[3] - a[3]) * u];
  }
  return pose;
}

/* A pose, as a motion of one frame. */
function poseToMotion(name, pose) {
  const tracks = {};
  let root = null;
  for (const k in pose) {
    const p = pose[k];
    if (!p || !(p[0] || p[1] || p[2])) continue;
    if (k === 'root') root = [[0, p[0], p[1], p[2]]];
    else tracks[k] = [[0, p[0], p[1], p[2]]];
  }
  const out = { name: name || 'pose', fps: 12, loop: false, tracks: tracks };
  if (root) out.root = root;
  return out;
}

/* Reject anything that is not this format, with a reason, rather than
   half-loading it. */
function parseMotion(text) {
  let j;
  try { j = JSON.parse(text); }
  catch (e) { throw new Error('not JSON: ' + e.message); }
  if (!j || typeof j !== 'object' || !j.tracks || typeof j.tracks !== 'object') {
    throw new Error('no "tracks" object -- see docs/motion-format.md');
  }
  const tracks = {};
  for (const k in j.tracks) {
    const b = parseInt(k, 10);
    if (!(b >= 0 && b < 256)) throw new Error('track "' + k + '" is not a bone index');
    const rows = j.tracks[k];
    if (!Array.isArray(rows)) throw new Error('track ' + k + ' is not a list of keys');
    tracks[b] = rows.map(r => {
      if (!Array.isArray(r) || r.length < 4) {
        throw new Error('track ' + k + ' has a key that is not [frame, x, y, z]');
      }
      return [+r[0], +r[1], +r[2], +r[3]];
    }).sort((a, b2) => a[0] - b2[0]);
  }
  let root = null;
  if (j.root) {
    if (!Array.isArray(j.root)) throw new Error('"root" is not a list of keys');
    root = j.root.map(r => {
      if (!Array.isArray(r) || r.length < 4) {
        throw new Error('a root key is not [frame, x, y, z]');
      }
      return [+r[0], +r[1], +r[2], +r[3]];
    }).sort((a, b) => a[0] - b[0]);
  }
  return { name: String(j.name || 'motion'),
           fps: Math.max(1, Math.min(60, +j.fps || 12)),
           loop: j.loop !== false,
           root: root,
           tracks: tracks };
}
