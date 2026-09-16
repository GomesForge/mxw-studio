/* MXW Editor -- UI, 3D view and editing.
   Depends on three.js (global THREE), mxw.js and gifenc.js. */

/* ------------------------------ state ---------------------------- */
const loaded = [];            /* [{name, raw, mxw, meshIndex}] */
let current = null;
let scene, cam, rend, group, axes, ready = false;
let mesh = null, wireGroup = null, normHelper = null, boneLines = null;
let texMats = [];
/* The camera starts still and facing the model. It used to spin, which
   meant whatever you were inspecting rotated away from you. */
let spin = false, radius = 4, theta = -Math.PI / 2, phi = 1.5, targetY = 0;
/* Which texture to show on which material, while previewing. The
   file's own binding is untouched -- this only changes what is drawn.
   A body binds tex0 to the body and tex1 to the head, leaving the eight
   expressions in tex2..tex9 bound to nothing, so selecting one has to
   say where it should appear. */
let texPreview = null;        /* {mat, tex} or null for the file's own */
let selectedTex = 0;

/* ------------------------------ the rig -------------------------- */
/* One skeleton drives the whole scene, because item bone tables index
   the body's bones. `pose` is a rotation in degrees added to a bone's
   rest pose, which is exactly what a motion track carries, so the pose
   sliders and a playing motion are the same mechanism. */
let rig = null;
let skinned = [];            /* [{geo, src, vertexBone}] */
let pose = {};               /* {boneIndex: [x, y, z]} in degrees */
let skinMats = null;
let selectedBone = -1;
let motion = null;           /* the motion being played, or null */
let motionFrame = 0;
let motionPlaying = false;
let motionLast = 0;          /* performance.now() of the last step */

function rigOf(entry) {
  if (!entry._rig) entry._rig = buildRig(entry.mxw.skeletons[0]);
  return entry._rig;
}

/* Move every skinned piece to the current pose, and redraw the bone
   overlay to match. Runs from the pose sliders and from playback. */
function applyPose() {
  if (!rig || !skinned.length) return;
  skinMats = rigSkinMatrices(rig, pose, skinMats);
  for (const b of skinned) skinGeometry(b.geo, b.src, b.vertexBone, skinMats);
  if (boneLines) {
    const now = rigMatrices(rig, pose);
    const pts = [];
    for (const b of rig.bones) {
      if (b.parent < 0) continue;
      const a = now[b.index].elements, p = now[b.parent].elements;
      pts.push(p[12], p[13], p[14], a[12], a[13], a[14]);
    }
    boneLines.geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(pts, 3));
    boneLines.geometry.computeBoundingSphere();
  }
  if (wireGroup && wireGroup.children.length === skinned.length) {
    /* the wireframe is built from the rest geometry, so it has to be
       rebuilt rather than transformed */
    skinned.forEach((b, i) => {
      const w = wireGroup.children[i];
      if (!w) return;
      w.geometry.dispose();
      w.geometry = new THREE.WireframeGeometry(b.geo);
    });
  }
}

function resetPose() {
  pose = {};
  motion = null;
  motionPlaying = false;
  motionFrame = 0;
  applyPose();
}

/* Textures being edited right now.

   While an edit is open the model draws the editor's own canvas instead
   of the stored GIF, so a stroke lands on the character as you make it
   -- no encoding, no apply, no rebuild. Each entry keeps one canvas and
   one THREE.CanvasTexture for the life of the edit; a stroke only sets
   needsUpdate, which is a texture upload and nothing more. */
const live = [];             /* [{id, entry, tex, cv, ctex}] */

/* What a material should draw while edits are open.

   `bound` is the named slot the material binds -- 0 the body skin, 1
   the head. An edit of any texture in that slot is what the model
   should show there, which is what makes a face edit visible on the
   head even while the texture list has the body selected. Two edits in
   different slots therefore both show at once. */
function liveFor(entry, tex, bound) {
  if (!entry) return null;
  return live.find(x => x.entry === entry && x.tex === tex) ||
         (bound === undefined ? null
           : live.find(x => x.entry === entry && x.slot === bound)) || null;
}

const $ = id => document.getElementById(id);

/* ----------------------------- notices --------------------------- */
function notify(text, isError) {
  const m = $('msg');
  m.textContent = text;
  m.className = 'msg ' + (isError ? 'err' : 'warn');
  m.style.display = 'block';
  clearTimeout(notify._t);
  notify._t = setTimeout(() => { m.style.display = 'none'; }, 7000);
}

/* ---------------------------- downloads -------------------------- */
async function saveFile(name, data, mime) {
  const blob = new Blob([data], { type: mime });
  let dl = null;
  try {
    if (window.claude && claude.use) dl = await claude.use('downloads');
  } catch (e) { dl = null; }
  if (dl) {
    try {
      await dl.save({ filename: name, data: blob });
      notify('saved ' + name);
    } catch (e) {
      if (e && e.code === 'declined') return;
      notify('could not save: ' + ((e && e.message) || e), 1);
    }
    return;
  }
  /* running from a local file: a plain link works */
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  notify('saved ' + name);
}

/* One step of playback, from the render loop. Time-based rather than
   frame-based, so a motion runs at its own speed whatever the display
   is doing. */
function stepMotion() {
  if (!motionPlaying || !motion || !rig) return;
  const now = performance.now();
  const dt = motionLast ? (now - motionLast) / 1000 : 0;
  motionLast = now;
  const end = motionLength(motion);
  motionFrame += dt * motion.fps;
  if (motionFrame > end) {
    if (motion.loop && end > 0) motionFrame = motionFrame % end;
    else { motionFrame = end; motionPlaying = false; }
  }
  pose = motionPose(motion, motionFrame);
  applyPose();
  renderMotion();
}

/* ------------------------------ three ---------------------------- */
/* Size the renderer to whatever element currently holds its canvas. */
function fitRenderer() {
  if (!rend) return;
  const box = rend.domElement.parentElement;
  if (!box || !box.clientWidth || !box.clientHeight) return;
  cam.aspect = box.clientWidth / box.clientHeight;
  cam.updateProjectionMatrix();
  rend.setSize(box.clientWidth, box.clientHeight);
}

function initThree() {
  if (typeof THREE === 'undefined') throw new Error('three.js did not load');
  const host = $('view');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1524);
  cam = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.01, 500);
  /* preserveDrawingBuffer, because saving the view reads the canvas
     back, and without it a WebGL canvas reads back empty. */
  rend = new THREE.WebGLRenderer({ antialias: true, alpha: true,
                                   preserveDrawingBuffer: true });
  rend.setPixelRatio(Math.min(devicePixelRatio, 2));
  rend.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(rend.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2b3550, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35);
  fill.position.set(-4, 1, -3);
  scene.add(fill);

  axes = new THREE.AxesHelper(1.4);
  /* An axis cross floating over an empty viewport reads as a broken
     render. It appears once there is something to measure against. */
  axes.visible = false;
  scene.add(axes);
  group = new THREE.Group();
  scene.add(group);

  /* The canvas is sized from whichever box it is sitting in, because it
     moves: the viewport normally, the model panel while you paint. And
     the viewport changes width for more reasons than the window
     resizing -- the tool rail comes and goes with the pixel editor --
     so watch the elements, not the window. */
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(fitRenderer);
    ro.observe(host);
    ro.observe($('mvBody'));
  } else {
    addEventListener('resize', fitRenderer);
  }
  bindOrbit();
  ready = true;
  (function loop() {
    requestAnimationFrame(loop);
    stepMotion();
    if (spin) theta += 0.004;
    cam.position.set(radius * Math.sin(phi) * Math.cos(theta),
                     radius * Math.cos(phi) + targetY,
                     radius * Math.sin(phi) * Math.sin(theta));
    cam.lookAt(0, targetY, 0);
    rend.render(scene, cam);
  })();
}

let dragging = false, px = 0, py = 0, btn = 0;
function bindOrbit() {
  const el = rend.domElement;
  el.addEventListener('mousedown', e => {
    dragging = true; px = e.clientX; py = e.clientY; btn = e.button;
    spin = false; $('bSpin').classList.remove('on'); e.preventDefault();
  });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    if (btn === 2) targetY -= dy * radius * 0.002;
    else {
      theta -= dx * 0.008;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi - dy * 0.008));
    }
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => {
    radius = Math.max(0.3, Math.min(60, radius * (1 + Math.sign(e.deltaY) * 0.1)));
    e.preventDefault();
  }, { passive: false });
}

/* --------------------------- geometry ---------------------------- */
/* Every file is authored in one shared coordinate space -- a body runs
   Y 18..7090, shoes sit at Y -38..332, hair at Y 3067+, back items at
   positive Z -- so drawing several in raw coordinates lines them up
   with no fitting. That is what Dress-up does. */

function meshOf(m, gifs, entry) {
  const pos = [], nor = [], uv = [], groups = [];
  /* which bone each emitted corner follows, so the mesh can be posed.
     The geometry is non-indexed, so a vertex used by four faces appears
     four times and needs its bone recorded four times. */
  const own = boneOfVertex(m);
  const vertexBone = [];
  const push = (vi, u, v, su, sv) => {
    pos.push(m.verts[vi * 3], m.verts[vi * 3 + 1], m.verts[vi * 3 + 2]);
    nor.push(m.norms[vi * 3], m.norms[vi * 3 + 1], m.norms[vi * 3 + 2]);
    uv.push(u / su, 1 - v / sv);
    vertexBone.push(own[vi] === undefined ? -1 : own[vi]);
  };
  const nMat = Math.max(1, m.materials.length);
  for (let mi = 0; mi < nMat; mi++) {
    const [su, sv] = m.uvDivisor(mi, gifs);
    const start = pos.length / 3;
    for (const f of m.faces) {
      if (nMat > 1 && f.mat !== mi) continue;
      const v = f.vs;
      push(v[0].i, v[0].u, v[0].v, su, sv);
      push(v[1].i, v[1].u, v[1].v, su, sv);
      push(v[2].i, v[2].u, v[2].v, su, sv);
      if (v.length === 4) {
        push(v[0].i, v[0].u, v[0].v, su, sv);
        push(v[2].i, v[2].u, v[2].v, su, sv);
        push(v[3].i, v[3].u, v[3].v, su, sv);
      }
    }
    const count = pos.length / 3 - start;
    if (count) groups.push({ start, count, mi });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  groups.forEach((g, k) => geo.addGroup(g.start, g.count, k));
  geo.computeBoundingBox();

  const mats = groups.map(() => new THREE.MeshPhongMaterial({
    color: 0xffffff, side: THREE.DoubleSide, shininess: 12,
    transparent: true, alphaTest: 0.5
  }));
  if (!mats.length) mats.push(new THREE.MeshPhongMaterial({
    color: 0xffffff, side: THREE.DoubleSide, shininess: 12
  }));

  groups.forEach((g, k) => {
    const bound = m.materials[g.mi] ? m.materials[g.mi].tex : 0;
    let ti = bound;
    if (texPreview && texPreview.mat === g.mi) ti = texPreview.tex;
    /* an open edit wins over what the file holds */
    const lv = liveFor(entry, ti, bound);
    if (lv) {
      mats[k].userData.map = lv.ctex;
      if ($('bTex').classList.contains('on')) {
        mats[k].map = lv.ctex;
        mats[k].needsUpdate = true;
      }
      return;
    }
    const src = gifs[ti] || gifs[0];
    if (!src) return;
    const url = URL.createObjectURL(new Blob([src], { type: 'image/gif' }));
    new THREE.TextureLoader().load(url, t => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      mats[k].userData.map = t;
      if ($('bTex').classList.contains('on')) {
        mats[k].map = t; mats[k].needsUpdate = true;
      }
      URL.revokeObjectURL(url);
    });
  });

  return { geo, mats, obj: new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0]),
           /* the rest pose, kept so posing never accumulates error:
              every frame is computed from these, not from the last */
           src: { pos: Float32Array.from(pos), nor: Float32Array.from(nor) },
           vertexBone: Int16Array.from(vertexBone) };
}

function build(items) {
  if (!ready) return;
  group.clear();
  mesh = wireGroup = normHelper = boneLines = null;
  texMats = [];

  const stage = new THREE.Group();
  const union = new THREE.Box3();
  const built = [];
  skinned = [];
  /* One rig for the whole scene. Items carry bone tables that index the
     body's skeleton -- hair follows bone 18, a jacket follows the hips,
     spine, chest, arms and wrists -- so posing the body moves everything
     worn on it. */
  rig = null;
  for (const it of items) {
    if (it.mxw.skeletons.length) { rig = rigOf(it); break; }
  }
  for (const it of items) {
    const m = it.mxw.meshes[it.meshIndex || 0];
    if (!m || !m.faces.length) continue;
    const b = meshOf(m, it.mxw.gifs, it);
    built.push(b);
    if (b.vertexBone && b.vertexBone.length) skinned.push(b);
    texMats = texMats.concat(b.mats);
    stage.add(b.obj);
    union.union(b.geo.boundingBox);
  }
  if (!built.length) return;

  /* one centre-and-scale for the whole set keeps the pieces in place */
  const c = new THREE.Vector3();
  union.getCenter(c);
  const size = Math.max(union.max.x - union.min.x,
                        union.max.y - union.min.y,
                        union.max.z - union.min.z) || 1;
  const s = 2 / size;
  stage.position.set(-c.x * s, -c.y * s, -c.z * s);
  stage.scale.setScalar(s);
  group.add(stage);
  mesh = built[0].obj;
  if (axes) axes.visible = $('bAxes').classList.contains('on');

  wireGroup = new THREE.Group();
  for (const b of built) {
    wireGroup.add(new THREE.LineSegments(new THREE.WireframeGeometry(b.geo),
      new THREE.LineBasicMaterial({ color: 0x3ad4ec, transparent: true, opacity: 0.35 })));
  }
  wireGroup.position.copy(stage.position);
  wireGroup.scale.copy(stage.scale);
  wireGroup.visible = $('bWire').classList.contains('on');
  group.add(wireGroup);

  if (THREE.VertexNormalsHelper) {
    normHelper = new THREE.VertexNormalsHelper(mesh, 120, 0xffc93c);
    normHelper.visible = $('bNorm').classList.contains('on');
    stage.add(normHelper);
  }

  /* The skeleton, drawn from the rig's world matrices.

     It used to plot the six i16 of each bone as if the first three were
     a world position. They are not: they are an offset from the parent
     and a rotation, so the overlay was a scribble. */
  if (rig) {
    boneLines = new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xff7ac8 }));
    boneLines.visible = $('bBone').classList.contains('on');
    stage.add(boneLines);
  }
  radius = 4; targetY = 0;
  applyPose();
}


/* Named viewpoints.

   The characters face -Z, not +Z. Measured on the files rather than
   assumed: the toes of both bodies reach z -584 against only +196
   behind the heel; the head material is biased to z -275; item
   Back0046, worn on the back, lies entirely at z +390..+1176; and the
   Katyusha20035 hair band -- bangs, worn at the front of the head --
   lies entirely at z -880..-470. An earlier reading of this had it the
   other way round, from the Back0039..0056 group, whose sixteen files
   share one placeholder mesh and sit in front of the shins.

   theta = pi/2 puts the camera at +Z, which is behind the model, so the
   front views take -pi/2. The model's own right hand is at +X, so
   right/left stay at theta 0 and pi.

   The model is normalised to two units tall and centred, which puts the
   head near y = +0.8. */
const FRONT = -Math.PI / 2;
const VIEWS = {
  face:  { theta: FRONT,        phi: 1.5,  radius: 1.15, targetY: 0.8 },
  front: { theta: FRONT,        phi: 1.45, radius: 3.2,  targetY: 0 },
  back:  { theta: Math.PI / 2,  phi: 1.45, radius: 3.2,  targetY: 0 },
  left:  { theta: Math.PI,      phi: 1.45, radius: 3.2,  targetY: 0 },
  right: { theta: 0,            phi: 1.45, radius: 3.2,  targetY: 0 },
  top:   { theta: FRONT,        phi: 0.2,  radius: 3.2,  targetY: 0 },
  whole: { theta: FRONT,        phi: 1.45, radius: 4,    targetY: 0 }
};

function setView(name) {
  const v = VIEWS[name];
  if (!v) return;
  spin = false;
  $('bSpin').classList.remove('on');
  theta = v.theta; phi = v.phi; radius = v.radius; targetY = v.targetY;
  document.querySelectorAll('#viewRow button').forEach(b =>
    b.classList.toggle('primary', b.dataset.view === name));
}

/* The readers enforce what the format needs to parse. This surfaces
   what parses fine and is still worth knowing before you save. */
/* The status bar carries what used to be scattered across panel
   headers: what is open and how big it is. */
function renderStatus() {
  const el = $('statMesh');
  if (!el) return;
  const c = current;
  if (!c) { el.textContent = ''; return; }
  const m = c.mxw.meshes[c.meshIndex || 0];
  const bits = [c.name];
  if (m) bits.push(m.kind, m.nv + ' vert', m.faces.length + ' faces');
  if (c.mxw.skeletons.length)
    bits.push(c.mxw.skeletons[0].bones.length + ' bones');
  bits.push(c.mxw.gifs.length + ' tex');
  el.textContent = bits.join('  ');
}

function renderHealth() {
  const panel = $('healthPanel');
  const c = current;
  if (!c || !c.mxw.meshes.length) { panel.style.display = 'none'; return; }
  let rep = null;
  try { rep = meshReport(c.mxw, c.meshIndex || 0); }
  catch (e) { panel.style.display = 'none'; return; }
  if (!rep) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const s = rep.stats;
  const wind = s.winding === null ? '-' : s.winding.toFixed(3);
  $('healthStats').innerHTML =
    '<dl><dt>quads</dt><dd>' + s.quads + ' of ' + s.faces + '</dd>' +
    '<dt>duplicate positions</dt><dd>' + s.duplicateVertices + '</dd>' +
    '<dt>winding</dt><dd>' + wind + '</dd></dl>' +
    '<p class="hint">Winding is how closely each face agrees with the ' +
    'normals stored at its own vertices: near 1 is consistent, negative ' +
    'means inverted.</p>';

  $('healthNotes').innerHTML = rep.notes.length
    ? rep.notes.map(n => '<p class="note ' + n.level + '">' + esc(n.text) +
        '</p>').join('')
    : '<p class="note good">Nothing to flag: no faces without area, no ' +
      'texture corners outside their texture, the bone table covers ' +
      'every vertex, and every count is inside its field.</p>';
}

function renderAll() {
  renderList();
  renderPosePanel();
  renderHeader();
  renderMesh();
  renderTextures();
  renderSkeleton();
  renderHealth();
  renderStatus();
  renderUV();
  checkRoundTrip();
}

/* One tab per open file, and -- while a texture or a frame is being
   edited -- two tabs inside that file's own group, so the edit reads as
   part of the file rather than as something that replaced it. You move
   between the model and the texture as often as you like; nothing is
   discarded until you apply or close the edit. */
function renderList() {

  const subs = (hostLabel, list) => !list.length ? '' :
    '<div class="subs">' +
    '<div class="sub' + (paint.shown ? '' : ' sel') + '" data-show="host"' +
    ' title="back to the file -- the edits stay open">' + hostLabel + '</div>' +
    list.map(x =>
      '<div class="sub' + (paint.shown && x.id === paint.id ? ' sel' : '') +
      '" data-sid="' + x.id + '" title="the pixel editor for ' +
      esc(x.label) + '">' + esc(x.label) +
      (sessionDirty(x) ? '<span class="dot" title="not applied yet"></span>' : '') +
      '<button class="rm" data-rmpaint="' + x.id +
      '" title="discard this edit">&times;</button></div>').join('') +
    '</div>';

  const rows = loaded.map((c, i) =>
    '<div class="tabGroup">' +
    '<div class="tab ' + (current === c ? 'sel' : '') + '" data-i="' + i +
    '" title="' + esc(c.name + (slotOfId(c.name) && slotOfId(c.name).name
      ? '  --  ' + slotOfId(c.name).name : '')) + '">' +
    esc(c.name) + '<span class="dim">' +
    (c.mxw.meshes[0] ? c.mxw.meshes[0].nv + 'v ' : '- ') +
    c.mxw.gifs.length + 't' +
    (c.mxw.skeletons.length ? ' &middot; skel' : '') +
    ' <button class="rm" data-rm="' + i + '" title="close this file">&times;</button>' +
    '</span></div>' +
    subs('model', paint.sessions.filter(x => x.owner &&
      x.owner.kind === 'texture' && x.owner.entry === c)) +
    '</div>');

  if (sprite.entry) {
    rows.push('<div class="tabGroup">' +
      '<div class="tab sel" data-sprite="1">' + esc(sprite.entry.name) +
      '<span class="dim">' + sprite.entry.gra.frames.length + 'f' +
      ' <button class="rm" data-rmsprite="1" title="close this file">&times;</button>' +
      '</span></div>' +
      subs('frames', paint.sessions.filter(x => x.owner &&
        x.owner.kind === 'frame')) +
      '</div>');
  }
  $('list').innerHTML = rows.join('');

  $('list').querySelectorAll('.tab').forEach(d => {
    d.onclick = e => {
      if (e.target.classList.contains('rm')) return;
      if (d.dataset.sprite) { paintSuspend(); return; }
      paintSuspend();
      spriteClose();
      select(+d.dataset.i);
    };
    d.oncontextmenu = e => {
      if (d.dataset.sprite) {
        menuAt(e, sprite.entry.name, [
          { label: 'Save the sprite', run: spriteSave },
          { label: 'Edit the current frame', run: spritePaintFrame },
          { label: 'Save the animation as .GIF', run: spriteExportGIF },
          '-',
          { label: 'Close this sprite', run: closeSprite },
          { label: 'Close every file', run: clearAll }
        ]);
        return;
      }
      tabMenu(e, +d.dataset.i);
    };
  });

  $('list').querySelectorAll('.sub').forEach(d => {
    d.onclick = e => {
      if (e.target.classList.contains('rm')) return;
      if (d.dataset.show === 'host') { paintSuspend(); return; }
      goToEdit(+d.dataset.sid);
    };
    d.oncontextmenu = e => {
      if (d.dataset.show === 'host') {
        menuAt(e, 'the file itself', [
          { label: 'Show it', run: paintSuspend }]);
        return;
      }
      const id = +d.dataset.sid;
      const sess = paint.sessions.find(x => x.id === id);
      if (!sess) return;
      menuAt(e, sess.title || sess.label, [
        { label: 'Open this edit', run: () => goToEdit(id) },
        { label: 'Apply it', run: () => { goToEdit(id); paintApply(); } },
        '-',
        { label: 'Discard it', run: () => dropEdit(id) }
      ]);
    };
  });

  $('list').querySelectorAll('.rm:not([data-rmpaint])').forEach(b =>
    b.onclick = e => {
      e.stopPropagation();
      if (b.dataset.rmsprite) { closeSprite(); return; }
      removeFile(+b.dataset.rm);
    });

  $('list').querySelectorAll('[data-rmpaint]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    dropEdit(+b.dataset.rmpaint);
  });

  enableActions();
}

/* Go to one open edit, bringing its file forward with it -- the edit
   belongs to a file, and applying it writes to that file. */
function goToEdit(id) {
  const sess = paint.sessions.find(x => x.id === id);
  if (!sess) return;
  const o = sess.owner;
  if (o && o.kind === 'texture' && (o.entry !== current || o.tex !== selectedTex)) {
    /* the edit's own file and its own texture, so every panel agrees
       with what is on the canvas */
    if (o.entry !== current) { current = o.entry; }
    selectTexture(o.tex);
    renderAll();
  }
  paintSelect(id);
}

function dropEdit(id) {
  const sess = paint.sessions.find(x => x.id === id);
  if (!sess) return;
  if (sessionDirty(sess) &&
      !confirm('Discard the unapplied changes to ' + sess.label + '?')) return;
  paintCloseSession(id);
  notify('closed the edit without applying');
}

/* The action bar is always on screen, so anything that cannot apply
   right now has to read as unavailable rather than fail when clicked.
   While the buttons lived inside the panels, hiding the panel did this
   on its own. */
function enableActions() {
  const hasFile = !!current;
  const hasMesh = hasFile && current.mxw.meshes.length > 0;
  const hasTex  = hasFile && current.mxw.gifs.length > 0;
  const off = (id, ok) => { const b = $(id); if (b) b.disabled = !ok; };
  off('bSave', hasFile);
  off('bObj', hasMesh);
  off('bPaintTex', hasTex);
  off('bTexIn', hasTex);
  off('bTexOut', hasFile);
  off('bUV', hasMesh && hasTex);
  off('bClear', hasFile || !!sprite.entry);
  const head = $('containerHead');
  if (head) head.style.display = hasFile ? '' : 'none';
  /* the "no file open" hint is handled by a rule on #list:not(:empty),
     so nothing here needs to remember to hide it */
}

/* Closing a file has to clear the viewport too, or the previous one
   stays on screen underneath the next. */
function resetPanels() {
  if (group) group.clear();
  if (axes) axes.visible = false;
  $('healthPanel').style.display = 'none';
  mesh = wireGroup = normHelper = boneLines = null;
  texMats = [];
  $('meshPanel').style.display = 'none';
  $('texPanel').style.display = 'none';
  $('skelPanel').style.display = 'none';
  $('hdr').innerHTML = '';
  $('rt').textContent = '';
  $('rt').className = 'rt';
  if ($('statMesh')) $('statMesh').textContent = '';
}

function removeFile(i) {
  if (i < 0 || i >= loaded.length) return;
  const mine = paint.sessions.filter(x => x.owner && x.owner.entry === loaded[i]);
  if (mine.length) {
    const dirty = mine.filter(sessionDirty);
    if (dirty.length && !confirm('Closing ' + loaded[i].name +
        ' discards the unapplied changes to ' +
        dirty.map(x => x.label).join(', ') + '. Close it?')) return;
    for (const x of mine) paintCloseSession(x.id);
  }
  const wasCurrent = loaded[i] === current;
  loaded.splice(i, 1);
  if (!loaded.length) {
    current = null;
    resetPanels();
    if (!sprite.entry) $('empty').style.display = 'flex';
    renderList();
    return;
  }
  if (wasCurrent) current = loaded[Math.max(0, i - 1)];
  selectedTex = 0;
  rebuild();
  renderAll();
}

function closeSprite() {
  const frames = paint.sessions.filter(x => x.owner && x.owner.kind === 'frame');
  if (frames.length) {
    const dirty = frames.filter(sessionDirty);
    if (dirty.length && !confirm('Closing this sprite discards the ' +
        'unapplied changes to ' + dirty.map(x => x.label).join(', ') +
        '. Close it?')) return;
    for (const x of frames) paintCloseSession(x.id);
  }
  spriteClose();
  if (loaded.length) {
    current = current || loaded[0];
    rebuild();
    renderAll();
  } else {
    resetPanels();
    $('empty').style.display = 'flex';
    renderList();
  }
}

function clearAll() {
  const dirty = paint.sessions.filter(sessionDirty);
  if (dirty.length && !confirm('There are unapplied changes to ' +
      dirty.map(x => x.label).join(', ') +
      '. Close everything anyway?')) return;
  paintClose();
  loaded.length = 0;
  current = null;
  spriteClose();
  resetPanels();
  $('empty').style.display = 'flex';
  renderList();
}

function renderHeader() {
  const c = current;
  if (!c) { $('hdr').innerHTML = ''; return; }
  $('hdr').innerHTML = `
    <label>mesh ID <input id="fMeshId" value="0x${c.mxw.meshId.toString(16).toUpperCase()}"></label>
    <dl><dt>version</dt><dd>${c.mxw.version}</dd>
        <dt>chunks</dt><dd>${c.mxw.meshes.length} mesh &middot;
          ${c.mxw.skeletons.length} skeleton &middot; ${c.mxw.gifs.length} texture${
          c.mxw.blobs.length ? ' &middot; ' + c.mxw.blobs.length + ' unknown' : ''}</dd>
        ${c.mxw.truncated ? `<dt class="bad">truncated</dt><dd class="bad">${
          c.mxw.truncated} chunk(s) the header promises are not in the file</dd>` : ''}
    </dl>`;
  $('fMeshId').onchange = e => {
    const v = parseInt(e.target.value.replace(/^0x/i, ''), 16);
    if (!isFinite(v) || v < 0 || v > 0xFFFFFFFF) { notify('mesh ID must be hex in 0..FFFFFFFF', 1); renderHeader(); return; }
    c.mxw.meshId = v >>> 0;
    renderAll();
  };
}

/* Texture and material names come out of the file, so they go through
   this before reaching innerHTML. */
function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* What slot a file belongs to, from its own id.

   An item id is [class][4 digits], and the female counterpart of a
   class is that class plus 100 -- jackets are 6xxxx on the boy and
   106xxxx on the girl. The classes were settled by looking at the shop
   thumbnails in the 4.x client's items.dat, one per class, rather than
   by reading the texture name: the name carries a global asset counter
   that only agrees with the id by accident. See
   docs/items-dat-format.md. */
const SLOTS = {
  1: 'hair', 2: 'hat or headband', 4: 'face', 5: 'glasses', 6: 'jacket',
  7: 'shirt', 8: 'trousers', 9: 'shoes', 10: 'back item', 21: 'body'
};

function slotOfId(name) {
  const m = /(\d{5,8})(?:\.[a-z]+)?$/i.exec(String(name || ''));
  if (!m) return null;
  const digits = m[1];
  const cls = parseInt(digits.slice(0, -4), 10);
  const number = parseInt(digits.slice(-4), 10);
  if (!cls) return null;
  const female = cls > 100 && SLOTS[cls - 100] !== undefined;
  const slot = female ? cls - 100 : cls;
  const what = SLOTS[slot];
  /* class + 100 means female only for a class we can name. 221 and 222
     are neither, so claiming a sex for them would be inventing one. */
  if (!what) return { cls: cls, number: number, female: null, name: null };
  return { cls: cls, slot: slot, number: number, female: female,
           name: (slot === 21 ? (female ? 'girl ' : 'boy ') : '') + what };
}

function renderMesh() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!m) { $('meshPanel').style.display = 'none'; return; }
  $('meshPanel').style.display = 'block';
  const bb = m.bbox();
  const dim = bb ? bb[1].map((v, k) => v - bb[0][k]).join(' &times; ') : '-';
  const slot = slotOfId(c.name);
  $('meshInfo').innerHTML = `
    <dl>${slot ? `<dt>slot</dt><dd>${esc(slot.name ||
          ('class ' + slot.cls + ', unidentified'))}</dd>` : ''}
        <dt>type</dt><dd>${m.kind}</dd>
        <dt>vertices</dt><dd>${m.nv}</dd>
        <dt>faces</dt><dd>${m.faces.length}</dd>
        <dt>bone ranges</dt><dd>${m.bones.length}</dd>
        <dt>size</dt><dd>${dim}</dd></dl>` +
    (slot && slot.name ? '' : '<p class="hint">The file name carries no ' +
      'id this recognises, so the slot is unknown. Ids are ' +
      '[class][4 digits], female = class + 100.</p>');

  $('texNames').innerHTML = m.textures.map((t, i) =>
    `<label>tex${i} <input data-t="${i}" value="${esc(t)}" maxlength="255"></label>`
  ).join('');
  $('texNames').querySelectorAll('input').forEach(inp =>
    inp.onchange = () => {
      m.textures[+inp.dataset.t] = inp.value;
      renderAll();
    });

  $('matList').innerHTML = m.materials.map((x, i) => `
    <div class="row"><span>${esc(x.name)}</span>
      <select data-m="${i}">${m.textures.map((t, k) =>
        `<option value="${k}" ${x.tex === k ? 'selected' : ''}>tex${k} &mdash; ${esc(t)}</option>`
      ).join('')}</select></div>`).join('');
  $('matList').querySelectorAll('select').forEach(sel =>
    sel.onchange = () => {
      m.materials[+sel.dataset.m].tex = +sel.value;
      rebuild();
      renderAll();
    });
}

function renderSkeleton() {
  const sk = current && current.mxw.skeletons[0];
  if (!sk) { $('skelPanel').style.display = 'none'; return; }
  $('skelPanel').style.display = 'block';
  $('skelInfo').innerHTML =
    `<dl><dt>bones</dt><dd>${sk.bones.length}</dd>
         <dt>roots</dt><dd>${sk.roots()}</dd></dl>`;
}

function renderTextures() {
  const c = current;
  if (!c) { $('texPanel').style.display = 'none'; return; }
  $('texPanel').style.display = 'block';
  if (!c.mxw.gifs.length) {
    $('texGrid').innerHTML = '<p class="hint">This file carries no texture.' +
      (c.mxw.truncated ? ' Its texture chunk is missing from the file.' : '') + '</p>';
    return;
  }
  const m0 = c.mxw.meshes[c.meshIndex || 0];
  $('texGrid').innerHTML = c.mxw.gifs.map((g, i) => {
    const [w, h] = gifSize(g);
    const url = URL.createObjectURL(new Blob([g], { type: 'image/gif' }));
    const role = textureRole(m0, i);
    return `<figure data-t="${i}" class="${selectedTex === i ? 'sel' : ''}">
      <img src="${url}" alt="texture ${i}">
      <figcaption>tex${i}${role ? '<br><b>' + esc(role) + '</b>' : ''}
      <br><span class="dim">${w}&times;${h} &middot; ${
        (g.length / 1024).toFixed(1)}K</span></figcaption></figure>`;
  }).join('');
  $('texGrid').querySelectorAll('figure').forEach(f => {
    f.onclick = () => { selectTexture(+f.dataset.t); };
    f.oncontextmenu = e => textureMenu(e, +f.dataset.t);
  });
  renderTexPreview();
}

/* Which material should draw a given image.

   The mesh names its textures and then carries however many images it
   likes: a body names two, girl_01 and girl_01_f, and ships ten. So
   image i belongs to the named slot min(i, names - 1) -- image 0 is the
   body skin, and every image from 1 up is a variant of the head
   texture. The material that binds that slot is the one to show it on.

   This matters because it is what stops the body skin being offered as
   a face: it belongs to slot 0, which the body material binds. */
function textureSlot(m, tex) {
  const names = m && m.textures.length ? m.textures.length : 1;
  return Math.min(tex, names - 1);
}

function defaultPreviewMat(m, tex) {
  if (!m || !m.materials.length) return 0;
  const slot = textureSlot(m, tex);
  const exact = m.materials.findIndex(x => x.tex === slot);
  if (exact >= 0) return exact;
  /* no material binds that slot, so fall back to the nearest below */
  let best = 0, bestTex = -1;
  m.materials.forEach((x, i) => {
    if (x.tex <= tex && x.tex > bestTex) { bestTex = x.tex; best = i; }
  });
  return best;
}

/* What this image is for, in the file's own terms. */
function textureRole(m, tex) {
  if (!m || !m.materials.length) return '';
  const mi = defaultPreviewMat(m, tex);
  const name = m.materials[mi] ? m.materials[mi].name : '';
  const bound = m.materials.some(x => x.tex === tex);
  return bound ? name : name + ' alt';
}

function selectTexture(i) {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  selectedTex = i;
  /* a texture a material already binds needs no override -- the model
     is showing it as the file says. Choosing one never moves the
     camera: you are picking what to look at, not where to look from. */
  const bound = m && m.materials.some(x => x.tex === i);
  texPreview = bound ? null : { mat: defaultPreviewMat(m, i), tex: i };
  rebuild();
  renderTextures();
  renderUV();
}

function renderTexPreview() {
  const host = $('texPreview');
  if (!host) return;
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!m || !m.materials.length) { host.innerHTML = ''; return; }
  const bound = m.materials.filter(x => x.tex === selectedTex)
                           .map(x => x.name);
  if (bound.length) {
    host.innerHTML = '<p class="hint">tex' + selectedTex + ' is bound to <b>' +
      bound.map(esc).join(', ') + '</b>, so the model already shows it.</p>';
    return;
  }
  const opts = m.materials.map((x, i) =>
    '<option value="' + i + '"' +
    (texPreview && texPreview.mat === i ? ' selected' : '') + '>' +
    esc(x.name) + '</option>').join('');
  host.innerHTML =
    '<div class="row" style="margin-top:8px"><span>show on</span>' +
    '<select id="previewMat">' + opts + '</select></div>' +
    '<p class="hint">No material binds tex' + selectedTex + ', so it is ' +
    'being previewed. The file is unchanged; to make it permanent, set the ' +
    'material above in <b>Materials</b>.</p>';
  const sel = $('previewMat');
  if (sel) sel.onchange = () => {
    texPreview = { mat: +sel.value, tex: selectedTex };
    rebuild();
    renderTextures();
  };
}

/* --------------------------- the UV map -------------------------- */
/* Draws the selected texture with the mesh's UV edges over it, which
   is what you need to paint a new one that lands in the right place. */
function renderUV() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  const cv = $('uv');
  if (!m) { cv.style.display = 'none'; return; }
  cv.style.display = 'block';
  const g = c.mxw.gifs[selectedTex];
  const [w, h] = g ? gifSize(g) : [128, 128];
  const S = 4;                              /* draw at 4x for clarity */
  cv.width = w * S; cv.height = h * S;
  cv.style.aspectRatio = w + '/' + h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#10182a';
  ctx.fillRect(0, 0, cv.width, cv.height);

  const drawLines = () => {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(58,212,236,.85)';
    for (const f of m.faces) {
      /* only the faces whose material uses the selected texture */
      const mt = m.materials[f.mat] ? m.materials[f.mat].tex : 0;
      if (m.materials.length > 1 && mt !== selectedTex) continue;
      ctx.beginPath();
      f.vs.forEach((v, k) => {
        const x = v.u * S, y = v.v * S;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  };

  if (g) {
    const url = URL.createObjectURL(new Blob([g], { type: 'image/gif' }));
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      drawLines();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { drawLines(); URL.revokeObjectURL(url); };
    img.src = url;
  } else {
    drawLines();
  }
}

/* ------------------------- round-trip check ---------------------- */
function checkRoundTrip() {
  const c = current;
  const el = $('rt');
  if (!c) { el.textContent = ''; return; }
  const out = c.mxw.write();
  let same = out.length === c.raw.length;
  if (same) for (let i = 0; i < out.length; i++) {
    if (out[i] !== c.raw[i]) { same = false; break; }
  }
  c.edited = !same;
  el.className = 'rt ' + (same ? 'ok' : 'changed');
  el.textContent = same
    ? 'unchanged -- writes back byte-identical (' + out.length + ' bytes)'
    : 'edited -- ' + out.length + ' bytes, was ' + c.raw.length;
  $('bSave').classList.toggle('primary', !same);
}

/* ---------------------------- editing ---------------------------- */
async function replaceTexture(file) {
  const c = current;
  if (!c) return;
  if (!c.mxw.gifs.length) { notify('this file has no texture chunk to replace', 1); return; }
  const buf = new Uint8Array(await file.arrayBuffer());
  const target = gifSize(c.mxw.gifs[selectedTex]);

  /* a GIF of the right size goes in untouched, which is always the
     safest path -- no requantising, no palette loss */
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    const [w, h] = gifSize(buf);
    if (w === target[0] && h === target[1]) {
      c.mxw.replaceGif(selectedTex, buf);
      notify('tex' + selectedTex + ' replaced with your GIF as-is (' + w + 'x' + h + ')');
      showSelectedTexture();
      return;
    }
    notify('that GIF is ' + w + 'x' + h + ' but tex' + selectedTex +
           ' is ' + target[0] + 'x' + target[1] + ' -- rescaling and re-encoding');
  }

  let img;
  try { img = await decodeImage(new Blob([buf])); }
  catch (e) { notify('could not read that image', 1); return; }

  /* scale to the slot's size, then quantise and encode */
  const cv = document.createElement('canvas');
  cv.width = target[0]; cv.height = target[1];
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = img.w; tmp.height = img.h;
  tmp.getContext('2d').putImageData(new ImageData(img.rgba, img.w, img.h), 0, 0);
  ctx.drawImage(tmp, 0, 0, target[0], target[1]);
  const data = ctx.getImageData(0, 0, target[0], target[1]).data;

  try {
    const gif = encodeGIF(data, target[0], target[1], { maxColors: 256 });
    c.mxw.replaceGif(selectedTex, gif);
    notify('tex' + selectedTex + ' re-encoded to GIF89a, ' +
           (gif.length / 1024).toFixed(1) + 'K');
  } catch (e) {
    notify('encoding failed: ' + e.message, 1);
    return;
  }
  showSelectedTexture();
}

/* Paint the selected texture, with the UV layout of the faces that
   use it drawn on top so a garment lands in the right place. */
/* --------------------------- create and move --------------------- */
/* A shape opens as its own file rather than replacing what is loaded:
   starting a new piece should never cost you the one you had open. */
function makeShape(kind) {
  const opts = {
    width: +$('shapeSize').value,
    height: +$('shapeSize').value,
    depth: +$('shapeSize').value,
    radius: +$('shapeSize').value / 2,
    tube: +$('shapeSize').value / 5,
    segments: +$('shapeSeg').value,
    rings: Math.max(3, Math.round(+$('shapeSeg').value / 2)),
    at: [0, +$('shapeAt').value, 0]
  };
  let res;
  try { res = shapeContainer(kind, opts); }
  catch (e) { notify('could not build that shape: ' + e.message, 1); return; }
  const entry = { name: kind + '.bin', raw: res.mxw.write(), mxw: res.mxw,
                  meshIndex: 0 };
  loaded.push(entry);
  current = entry;
  selectedTex = 0;
  texPreview = null;
  setView('whole');
  rebuild();
  renderAll();
  $('empty').style.display = 'none';
  const m = res.mxw.meshes[0];
  notify(SHAPES[kind].label.toLowerCase() + ': ' + m.nv + ' vertices, ' +
         m.faces.length + ' faces. It has no texture yet -- drop an image ' +
         'on it, or use Replace texture.');
}

/* Every transform runs through here so one place reports the clamping
   and keeps the panels in step. */
function transform(label, fn) {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!m) { notify('open a mesh first', 1); return; }
  let clipped = 0;
  try { clipped = fn(m) || 0; }
  catch (e) { notify(label + ' failed: ' + e.message, 1); return; }
  /* the rig is built from the rest pose, so a moved mesh needs it again */
  if (c._rig) c._rig = null;
  rebuild();
  renderAll();
  notify(label + (clipped ? ' -- ' + clipped + ' coordinate(s) hit the ' +
         '16-bit limit and were clamped' : ''));
}

function makeWire() {
  $('shapeList').innerHTML = Object.keys(SHAPES).map(k =>
    '<button data-shape="' + k + '" title="' + esc(SHAPES[k].note) + '">' +
    esc(SHAPES[k].label) + '</button>').join('');
  $('shapeList').querySelectorAll('button').forEach(b =>
    b.onclick = () => makeShape(b.dataset.shape));
  const show = (id, suffix) => {
    $(id).oninput = () => { $(id + 'Out').textContent = $(id).value + (suffix || ''); };
    $(id).oninput();
  };
  show('shapeSize'); show('shapeSeg'); show('shapeAt'); show('xMove');

  $('bXbigger').onclick = () => transform('scaled up', m => meshScale(m, 1.1));
  $('bXsmaller').onclick = () => transform('scaled down', m => meshScale(m, 1 / 1.1));
  for (const ax of ['X', 'Y', 'Z']) {
    $('bXrot' + ax).onclick = () =>
      transform('turned 90 degrees about ' + ax,
                m => meshRotate(m, ax.toLowerCase(), 90));
    $('bXmir' + ax).onclick = () =>
      transform('mirrored on ' + ax, m => meshMirror(m, ax.toLowerCase()));
  }
  $('xMove').onchange = e => {
    const d = +e.target.value;
    if (!d) return;
    transform('raised by ' + d, m => meshMove(m, [0, d, 0]));
    e.target.value = 0;
    $('xMoveOut').textContent = '0';
  };
  $('bXcentre').onclick = () => transform('centred', meshCentre);
  $('bXfloor').onclick = () => transform('dropped to the floor', meshToFloor);
  if ($('bPaintGif')) $('bPaintGif').onclick = saveContextGIF;
}

/* --------------------------- the size prompt ---------------------- */
/* Saving asks how big first, because a GIF is a fixed number of pixels
   and the one you want depends on what it is for: a thumbnail, a forum
   post, a poster. The percentage works the way the wheel does, scaling
   what is on screen, and the dialog shows the pixels it will produce so
   there is no guessing.

   Resolves to a scale factor, or null if the prompt was dismissed. */
let askPending = null;

function askForScale(what, baseW, baseH) {
  const box = $('ask');
  if (!box) return Promise.resolve(1);
  if (askPending) askPending(null);
  $('askWhat').textContent = what;
  const show = () => {
    const pct = +$('askPct').value;
    $('askPctOut').textContent = pct + '%';
    const w = Math.max(1, Math.round(baseW * pct / 100));
    const h = Math.max(1, Math.round(baseH * pct / 100));
    $('askSize').textContent = w + ' by ' + h + ' pixels' +
      (w * h > 640 * 640 ? '  --  large, so the file will be too' : '');
  };
  $('askPct').oninput = show;
  show();
  box.hidden = false;
  $('askOK').focus();
  return new Promise(resolve => {
    askPending = resolve;
    const close = v => {
      box.hidden = true;
      askPending = null;
      resolve(v);
    };
    $('askOK').onclick = () => close(+$('askPct').value / 100);
    $('askCancel').onclick = () => close(null);
    box.onclick = e => { if (e.target === box) close(null); };
    $('askPresets').querySelectorAll('button').forEach(b => b.onclick = () => {
      $('askPct').value = b.dataset.pct;
      show();
    });
    box.onkeydown = e => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') close(+$('askPct').value / 100);
    };
  });
}

/* Nearest neighbour, because these are pixel images and anything
   smoother turns a crisp edge into a smear. */
function scaleFrames(frames, w, h, f) {
  if (f === 1) return { frames, w, h };
  const nw = Math.max(1, Math.round(w * f)), nh = Math.max(1, Math.round(h * f));
  const out = frames.map(src => {
    const dst = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(h - 1, Math.floor(y / f));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(w - 1, Math.floor(x / f));
        const si = (sy * w + sx) * 4, di = (y * nw + x) * 4;
        dst[di] = src[si]; dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3];
      }
    }
    return dst;
  });
  return { frames: out, w: nw, h: nh };
}

/* ------------------------- Save .GIF, in context ------------------ */
/* One action, and it saves what is in front of you.

   Which is not the same thing in each place, and the rule that makes
   them consistent is: **whatever is on screen, and if it is one of a
   set, the whole set**. So the model saves as its motion rather than a
   still; a sprite saves as its animation; and a texture saves with its
   siblings, because the nine images in a head slot are one set even
   though only one is drawn at a time.

   The tab you are on decides between the model and a texture, which is
   what the sub-tabs are for. */

/* Which textures share a slot with this one.

   A body names two textures and ships ten: image i belongs to named
   slot min(i, names - 1), so tex1 through tex9 are all the head. That
   is the set worth saving together. */
function texturesInSlotOf(entry, tex) {
  const m = entry && entry.mxw.meshes[entry.meshIndex || 0];
  if (!m) return [tex];
  const slot = textureSlot(m, tex);
  const out = [];
  for (let i = 0; i < entry.mxw.gifs.length; i++) {
    if (textureSlot(m, i) === slot) out.push(i);
  }
  return out.length ? out : [tex];
}

/* The texture set, as one GIF -- with whatever is being edited right
   now standing in for the stored image, so what you save is what you
   see. */
async function saveTextureSetGIF(entry, tex) {
  const list = texturesInSlotOf(entry, tex);
  /* An open edit stands in for the stored image -- but only once it has
     actually been painted on. An untouched session composites to the
     same pixels, and keeping the stored bytes beats re-encoding them. */
  const live = new Map();
  for (const l of live_edits_of(entry)) {
    const sess = paint.sessions.find(x => x.id === l.id);
    if (sess && sessionDirty(sess)) live.set(l.tex, l.cv);
  }

  const frames = [];
  let w = 0, h = 0, skipped = 0;
  for (const i of list) {
    let rgba, sw, sh;
    const cv = live.get(i);
    if (cv) {
      rgba = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      sw = cv.width; sh = cv.height;
    } else {
      const g = entry.mxw.gifs[i];
      if (!g) continue;
      let img;
      try { img = await decodeImage(new Blob([g], { type: 'image/gif' })); }
      catch (e) { skipped++; continue; }
      /* decodeImage names them w and h, not width and height -- reading
         the wrong pair produced a 0x0 GIF that no decoder would open */
      rgba = img.rgba; sw = img.w; sh = img.h;
    }
    if (!w) { w = sw; h = sh; }
    /* a set of mixed sizes cannot be one animation; the odd one out is
       left out rather than stretched */
    if (sw !== w || sh !== h) { skipped++; continue; }
    frames.push(rgba);
  }
  if (!frames.length) { notify('that texture could not be decoded', 1); return; }

  const scale = await askForScale(frames.length > 1
    ? frames.length + ' textures of this slot' : 'one texture', w, h);
  if (scale === null) return;
  /* A texture is a bitmap with a size of its own, so above 100 per cent
     there is nothing to do but repeat pixels. Nearest neighbour keeps
     the edges hard, which is what these images want. */
  const big = scaleFrames(frames, w, h, scale);

  const name = entry.name.replace(/\.[^.]+$/, '');
  if (frames.length === 1) {
    /* one image is not an animation: save the GIF the file already
       holds, byte for byte, unless it is being edited */
    const cv = live.get(tex);
    /* at 100% with nothing edited, the stored GIF is already the
       answer and copying it beats re-encoding it */
    const asStored = !cv && scale === 1;
    const out = asStored ? entry.mxw.gifs[tex]
                         : encodeGIF(big.frames[0], big.w, big.h, { maxColors: 256 });
    saveFile(name + '.tex' + tex + '.gif', out, 'image/gif');
    notify('tex' + tex + ', ' + big.w + 'x' + big.h +
           (asStored ? ', exactly as stored'
                     : cv ? ', re-encoded with your edit' : ', re-encoded'));
    return;
  }
  let gif;
  try { gif = encodeAnimatedGIF(big.frames, big.w, big.h, { delayMs: 500 }); }
  catch (e) { notify('could not encode that set: ' + e.message, 1); return; }
  saveFile(name + '.textures.gif', gif, 'image/gif');
  notify(frames.length + ' textures in that slot, ' + big.w + 'x' + big.h +
         ', half a second each' + (skipped ? ' -- ' + skipped +
         ' left out for not matching' : ''));
}

/* The live edits belonging to one file. */
function live_edits_of(entry) {
  return live.filter(x => x.entry === entry);
}

/* The one entry point the buttons call. */
async function saveContextGIF() {
  /* a sprite is open: its animation, edits included */
  if (sprite.entry) { spriteExportGIF(); return; }
  if (!current) { notify('nothing is open', 1); return; }
  /* the pixel editor is on a texture: that texture and its siblings */
  if (paint.open && paint.shown && paint.owner &&
      paint.owner.kind === 'texture') {
    await saveTextureSetGIF(paint.owner.entry, paint.owner.tex);
    return;
  }
  /* otherwise you are looking at the model */
  await exportViewGIF();
}

/* ------------------------ the view, as a GIF --------------------- */
/* What is on screen, turned into an animated GIF: the motion that is
   loaded, or a turntable when there is none. Renders off to the side
   at a fixed square size and puts everything back, so the viewport is
   not disturbed. */
async function exportViewGIF() {
  if (!rend || !current) { notify('open a mesh first', 1); return; }
  const BASE = 320;
  const host = rend.domElement.parentElement;
  const keep = {
    w: rend.domElement.clientWidth, h: rend.domElement.clientHeight,
    bg: scene.background, theta: theta, spin: spin,
    playing: motionPlaying, frame: motionFrame, aspect: cam.aspect,
    axes: axes ? axes.visible : false,
    bones: boneLines ? boneLines.visible : false
  };
  const steps = motion && motionLength(motion) > 0 ? 24 : 36;
  const fps = motion && motionLength(motion) > 0 ? motion.fps : 18;

  const scale = await askForScale(
    (motion && motionLength(motion) > 0 ? motion.name + ', ' + steps + ' frames'
                                        : 'a turn, ' + steps + ' frames'),
    BASE, BASE);
  if (scale === null) return;

  /* Render at the size asked for.

     It used to render at 320 and enlarge the pixels afterwards, which
     is not a bigger picture, it is the same picture magnified: asking
     for 400 per cent gave back something visibly worse than the view it
     came from. A 3D scene has no fixed resolution, so the honest answer
     to "bigger" is to draw it bigger. Nothing is enlarged here now. */
  const size = Math.max(64, Math.min(1400, Math.round(BASE * scale)));

  spin = false;
  motionPlaying = false;
  /* The guides come out. They belong to the editor, not to the model:
     the axis cross is three coloured lines through the middle of the
     figure and the skeleton overlay is a pink scribble over it, and
     both landed in the first exported GIF looking like a fault. */
  if (axes) axes.visible = false;
  if (boneLines) boneLines.visible = false;
  /* a transparent ground, so the GIF drops onto any page */
  scene.background = null;
  rend.setClearColor(0x000000, 0);
  cam.aspect = 1;
  cam.updateProjectionMatrix();
  rend.setSize(size, size, false);

  const flat = document.createElement('canvas');
  flat.width = flat.height = size;
  const fx = flat.getContext('2d', { willReadFrequently: true });
  const frames = [];
  const say = t => {
    const m = $('msg');
    if (!m) return;
    m.textContent = t;
    m.className = 'msg';
    m.style.display = 'block';
  };
  try {
    for (let i = 0; i < steps; i++) {
      /* One frame per animation frame, so the page keeps painting and
         the progress can actually be seen. Twenty-four renders at 1280
         square is not instant and a frozen window reads as a crash. */
      if (i % 2 === 0) {
        say('rendering ' + (i + 1) + ' of ' + steps + ' at ' + size + ' by ' + size);
        await new Promise(r => requestAnimationFrame(r));
      }
      if (motion && motionLength(motion) > 0) {
        motionFrame = motionLength(motion) * i / steps;
        pose = motionPose(motion, motionFrame);
        applyPose();
      } else {
        theta = keep.theta + i / steps * Math.PI * 2;
      }
      cam.position.set(radius * Math.sin(phi) * Math.cos(theta),
                       radius * Math.cos(phi) + targetY,
                       radius * Math.sin(phi) * Math.sin(theta));
      cam.lookAt(0, targetY, 0);
      rend.render(scene, cam);
      fx.clearRect(0, 0, size, size);
      fx.drawImage(rend.domElement, 0, 0, size, size);
      frames.push(fx.getImageData(0, 0, size, size).data);
    }
  } catch (e) {
    notify('could not read the view back: ' + e.message, 1);
  } finally {
    scene.background = keep.bg;
    if (axes) axes.visible = keep.axes;
    if (boneLines) boneLines.visible = keep.bones;
    rend.setClearColor(0x000000, 1);
    theta = keep.theta;
    spin = keep.spin;
    motionPlaying = keep.playing;
    motionFrame = keep.frame;
    if (motion) { pose = motionPose(motion, motionFrame); applyPose(); }
    cam.aspect = keep.aspect;
    cam.updateProjectionMatrix();
    if (host) fitRenderer();
  }
  if (!frames.length) return;
  /* every frame is mostly empty, so trim to what is actually drawn --
     the same crop the sprite exporter uses, and for the same reason */
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (const px of frames) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (px[(y * size + x) * 4 + 3] >= 128) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  if (x1 < x0) { notify('the view came back empty', 1); return; }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const cropped = frames.map(px => {
    const out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      const src = ((y + y0) * size + x0) * 4;
      out.set(px.subarray(src, src + cw * 4), y * cw * 4);
    }
    return out;
  });
  /* already rendered at the size asked for, so nothing is resampled */
  const big = { frames: cropped, w: cw, h: ch };
  say('encoding ' + steps + ' frames at ' + cw + ' by ' + ch);
  await new Promise(r => requestAnimationFrame(r));
  let gif;
  try {
    gif = encodeAnimatedGIF(big.frames, big.w, big.h,
                            { delayMs: Math.round(1000 / fps) });
  }
  catch (e) { notify('could not encode the view: ' + e.message, 1); return; }
  saveFile(current.name.replace(/\.[^.]+$/, '') +
           (motion ? '.' + motion.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '.turntable') +
           '.gif', gif, 'image/gif');
  notify(steps + ' frames at ' + big.w + 'x' + big.h +
         (motion && motionLength(motion) > 0 ? ', ' + motion.name : ', turning'));
}

/* ------------------------------ motion UI ------------------------ */
/* Bone names are read off the vertices each bone drives, since nothing
   in the format carries a name -- python/dump_skeleton.py shows how,
   and docs/mxw-format.md has the tree. */
const BONE_NAMES = {
  0: 'root', 1: 'root 2', 2: 'root 3', 3: 'hips', 4: 'spine',
  5: 'pelvis', 6: 'spine 2', 7: 'leg root R', 8: 'leg root L',
  9: 'chest', 10: 'thigh R', 11: 'thigh L', 12: 'neck', 13: 'shoulder R',
  14: 'shoulder L', 15: 'shin R', 16: 'shin L', 17: 'chest branch',
  18: 'head', 19: 'upper arm R', 20: 'upper arm L', 21: 'ankle R',
  22: 'ankle L', 23: 'forearm R', 24: 'forearm L', 25: 'foot R',
  26: 'foot L', 30: 'wrist R', 31: 'wrist L', 32: 'toe R', 33: 'toe L',
  36: 'hand R', 37: 'hand L'
};

function boneName(i) {
  return BONE_NAMES[i] || ('bone ' + i);
}

/* Named bones first: those are the ones anyone wants to pose. */
function poseBones() {
  if (!rig) return [];
  return rig.bones.map(b => b.index).sort((a, b) => {
    const na = BONE_NAMES[a] !== undefined, nb = BONE_NAMES[b] !== undefined;
    if (na !== nb) return na ? -1 : 1;
    return a - b;
  });
}

function renderPosePanel() {
  const has = !!rig;
  if (!$('motionPanel')) return;
  $('motionPanel').style.display = has ? 'block' : 'none';
  $('motionNone').style.display = has ? 'none' : 'block';
  if (!has) return;

  if (!$('motionList').childElementCount) {
    /* The action set found in the sprite files first, under the
       names and frame counts those files use. Then everything else. */
    const chip = (m, i) =>
      '<button data-mo="' + i + '" title="' + esc(m.note || '') + '">' +
      esc(m.name) + (m.action ? ' <span class="dim">' + m.action + '</span>' : '') +
      '</button>';
    const known = [], extra = [];
    BUILT_IN_MOTIONS.forEach((m, i) =>
      (m.action ? known : extra).push(chip(m, i)));
    $('motionList').innerHTML =
      '<div class="moGroup">' + known.join('') + '</div>' +
      '<p class="hint">Those eight are the actions the 2D sprite sets ' +
      'carry, under the names and frame counts found in those files. ' +
      'The joint angles are ours: no motion data for the 3D bodies ' +
      'survives, and a sprite drawn in one projection a few dozen ' +
      'pixels tall cannot be read back into a skeleton.</p>' +
      '<div class="moGroup">' + extra.join('') + '</div>';
    $('motionList').querySelectorAll('button').forEach(b =>
      b.onclick = () => playMotion(BUILT_IN_MOTIONS[+b.dataset.mo]));
  }
  const sel = $('boneSel');
  const want = poseBones();
  if (sel.options.length !== want.length) {
    sel.innerHTML = want.map(i =>
      '<option value="' + i + '">' + esc(boneName(i)) + '</option>').join('');
  }
  if (want.indexOf(selectedBone) < 0) selectedBone = want[0];
  sel.value = String(selectedBone);
  renderBoneSliders();
  renderMotion();
}

function renderBoneSliders() {
  const p = (pose && pose[selectedBone]) || [0, 0, 0];
  const set = (id, v) => {
    if ($(id)) $(id).value = Math.round(v);
    if ($(id + 'Out')) $(id + 'Out').textContent = Math.round(v) + '\u00b0';
  };
  set('boneX', p[0]); set('boneY', p[1]); set('boneZ', p[2]);
}

function renderMotion() {
  if (!$('moFrame')) return;
  const end = motion ? motionLength(motion) : 0;
  const f = $('moFrame');
  f.max = Math.max(1, Math.round(end));
  f.value = Math.min(end, motionFrame);
  $('moFrameOut').textContent = motionFrame.toFixed(1) + (end ? ' / ' + end : '');
  $('bMoPlay').textContent = motionPlaying ? 'Pause' : 'Play';
  $('bMoPlay').classList.toggle('on', motionPlaying);
  $('motionNote').textContent = motion
    ? motion.name + (motion.note ? ' -- ' + motion.note : '') +
      '  (' + Object.keys(motion.tracks).length + ' tracks)'
    : 'no motion chosen; the sliders below pose one bone at a time';
  $('motionList').querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', !!motion && BUILT_IN_MOTIONS[+b.dataset.mo] === motion));
  $('moFps').value = motion ? motion.fps : 12;
  $('moFpsOut').textContent = (motion ? motion.fps : 12) + ' fps';
  $('moLoop').checked = motion ? motion.loop !== false : true;
}

function playMotion(m) {
  if (!rig || !m) return;
  motion = m;
  motionFrame = 0;
  motionLast = 0;
  const end = motionLength(m);
  motionPlaying = end > 0;
  pose = motionPose(m, 0);
  applyPose();
  renderBoneSliders();
  renderMotion();
  if (!end) notify(m.name + ' is a single pose, so there is nothing to play');
}

function poseWire() {
  $('bMoPlay').onclick = () => {
    if (!motion) { notify('pick a motion first'); return; }
    motionPlaying = !motionPlaying;
    motionLast = 0;
    renderMotion();
  };
  $('bMoStop').onclick = () => {
    motionPlaying = false;
    motionFrame = 0;
    if (motion) { pose = motionPose(motion, 0); applyPose(); }
    renderBoneSliders();
    renderMotion();
  };
  $('bMoRest').onclick = () => {
    resetPose();
    renderBoneSliders();
    renderMotion();
  };
  $('moFrame').oninput = e => {
    if (!motion) return;
    motionPlaying = false;
    motionFrame = +e.target.value;
    pose = motionPose(motion, motionFrame);
    applyPose();
    renderBoneSliders();
    renderMotion();
  };
  $('moFps').oninput = e => {
    if (motion) motion.fps = Math.max(1, Math.min(60, +e.target.value || 12));
    renderMotion();
  };
  $('moLoop').onchange = e => { if (motion) motion.loop = e.target.checked; };
  $('boneSel').onchange = e => {
    selectedBone = +e.target.value;
    renderBoneSliders();
  };
  const axes = [['boneX', 0], ['boneY', 1], ['boneZ', 2]];
  for (let k = 0; k < axes.length; k++) {
    const id = axes[k][0], slot = axes[k][1];
    $(id).oninput = e => {
      if (!rig) return;
      /* posing by hand steps out of playback rather than fighting it */
      motionPlaying = false;
      const p = (pose[selectedBone] || [0, 0, 0]).slice();
      p[slot] = +e.target.value;
      pose[selectedBone] = p;
      applyPose();
      renderBoneSliders();
      renderMotion();
    };
  }
  $('bBoneZero').onclick = () => {
    delete pose[selectedBone];
    applyPose();
    renderBoneSliders();
  };
  $('bMoSave').onclick = () => {
    const m = poseToMotion(motion ? motion.name + ' pose' : 'pose', pose);
    if (!Object.keys(m.tracks).length) {
      notify('nothing to save -- the model is in its bind pose', 1);
      return;
    }
    saveFile((current ? current.name.replace(/\.[^.]+$/, '') : 'pose') +
             '.motion.json',
             new TextEncoder().encode(JSON.stringify(m, null, 1)),
             'application/json');
  };
  $('bMoIn').onclick = () => $('moFile').click();
  $('moFile').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const m = parseMotion(await f.text());
      m.note = 'loaded from ' + f.name;
      playMotion(m);
      notify('loaded ' + m.name + ', ' + Object.keys(m.tracks).length +
             ' tracks, ' + motionLength(m) + ' frames');
    } catch (err) {
      notify(f.name + ': ' + err.message, 1);
    }
  };
}

/* ---------------------------- context menu ----------------------- */
/* One menu, filled by whatever was right-clicked. Items are
   {label, run, disabled} or the string '-' for a rule; a leading
   {head} labels what the menu is acting on, which matters when the
   thing under the cursor is one thumbnail among twenty. */
function menuAt(ev, head, items) {
  ev.preventDefault();
  ev.stopPropagation();
  const el = $('menu');
  if (!el) return;
  const live = items.filter(Boolean);
  el.innerHTML = (head ? '<div class="mHead">' + esc(head) + '</div>' : '') +
    live.map((it, i) => it === '-' ? '<hr>' :
      '<button data-k="' + i + '"' + (it.disabled ? ' disabled' : '') +
      (it.title ? ' title="' + esc(it.title) + '"' : '') + '>' +
      esc(it.label) + '</button>').join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const it = live[+b.dataset.k];
    menuClose();
    if (it && it.run) it.run();
  });
  /* placed so it always fits, which means flipping it near an edge */
  el.classList.add('on');
  const r = el.getBoundingClientRect();
  el.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, ev.clientX)) + 'px';
  el.style.top = Math.max(4, Math.min(innerHeight - r.height - 4, ev.clientY)) + 'px';
}

function menuClose() {
  const el = $('menu');
  if (el) el.classList.remove('on');
}

function menuWire() {
  addEventListener('mousedown', e => {
    if (!$('menu').contains(e.target)) menuClose();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') menuClose(); });
  addEventListener('blur', menuClose);
  addEventListener('wheel', menuClose, { passive: true });
}

/* What right-clicking a texture thumbnail offers. */
function textureMenu(ev, i) {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!c) return;
  const sess = paintFind(x => x.owner && x.owner.kind === 'texture' &&
    x.owner.entry === c && x.owner.tex === i);
  const bound = m && m.materials.some(x => x.tex === i);
  const role = textureRole(m, i);
  menuAt(ev, 'tex' + i + (role ? '  ' + role : ''), [
    sess
      ? { label: 'Go back to this edit', run: () => goToEdit(sess.id) }
      : { label: 'Edit this texture', run: () => { selectTexture(i); paintTexture(); } },
    sess && { label: 'Discard this edit', run: () => dropEdit(sess.id) },
    '-',
    { label: bound ? 'Already on the model' : 'Show it on the model',
      disabled: !!bound || selectedTex === i,
      run: () => selectTexture(i) },
    { label: 'Replace from an image\u2026',
      run: () => { selectTexture(i); $('texFile').click(); } },
    '-',
    { label: 'Save this one as .GIF',
      run: () => { selectTexture(i); exportTexture(); } },
    { label: 'Save every texture of this slot as one .GIF',
      disabled: texturesInSlotOf(c, i).length < 2,
      run: () => saveTextureSetGIF(c, i) },
    { label: 'Save its UV layout as .PNG',
      disabled: !m, run: () => { selectTexture(i); exportUV(); } }
  ]);
}

/* What right-clicking a file tab offers. */
function tabMenu(ev, i) {
  const c = loaded[i];
  if (!c) return;
  const mine = paint.sessions.filter(x => x.owner && x.owner.entry === c);
  menuAt(ev, c.name, [
    { label: 'Save .bin', run: () => { select(i); saveBin(); } },
    { label: 'Export .OBJ', disabled: !c.mxw.meshes.length,
      run: () => { select(i); exportOBJ(); } },
    { label: 'Import .OBJ\u2026', run: () => { select(i); $('objFile').click(); } },
    '-',
    { label: 'Edit the selected texture', disabled: !c.mxw.gifs.length,
      run: () => { select(i); paintTexture(); } },
    mine.length && { label: 'Discard every open edit of this file',
      run: () => { for (const x of mine.slice()) dropEdit(x.id); } },
    '-',
    { label: 'Close this file', run: () => removeFile(i) },
    { label: 'Close every file', run: clearAll }
  ]);
}

/* What right-clicking inside the 3D view offers. */
function viewMenu(ev) {
  if (!current) return;
  const on = id => $(id).classList.contains('on');
  menuAt(ev, current.name, [
    { label: 'Face', run: () => setView('face') },
    { label: 'Front', run: () => setView('front') },
    { label: 'Back', run: () => setView('back') },
    { label: 'Whole model', run: () => setView('whole') },
    '-',
    { label: (on('bWire') ? 'Hide' : 'Show') + ' the wireframe',
      run: () => $('bWire').click() },
    { label: (on('bBone') ? 'Hide' : 'Show') + ' the skeleton',
      disabled: !current.mxw.skeletons.length,
      run: () => $('bBone').click() },
    { label: (on('bAxes') ? 'Hide' : 'Show') + ' the axes',
      run: () => $('bAxes').click() },
    { label: (on('bSpin') ? 'Stop spinning' : 'Spin'),
      run: () => $('bSpin').click() },
    { label: (on('bAll') ? 'Turn off Dress-up' : 'Dress-up: draw every file'),
      disabled: loaded.length < 2, run: () => $('bAll').click() },
    '-',
    { label: 'Edit the selected texture', disabled: !current.mxw.gifs.length,
      run: paintTexture },
    { label: 'Save UV .PNG', disabled: !current.mxw.gifs.length, run: exportUV }
  ]);
}

/* What right-clicking the pixel canvas offers. */
function canvasMenu(ev) {
  if (!paint.open || !paint.shown) return;
  const sel = paintHasSel();
  menuAt(ev, paint.title, [
    { label: 'Undo', disabled: !paint.undo.length, run: paintUndo },
    { label: 'Redo', disabled: !paint.redo.length, run: paintRedo },
    '-',
    { label: 'Erase the selection', disabled: !sel, run: paintEraseSel },
    { label: 'Clear the selection', disabled: !sel, run: paintClearSelection },
    '-',
    { label: 'Flip horizontally', run: () => paintFlip('h') },
    { label: 'Flip vertically', run: () => paintFlip('v') },
    { label: 'Centre horizontally', run: () => paintCentre('h') },
    { label: 'Centre vertically', run: () => paintCentre('v') },
    '-',
    { label: 'Add a layer', run: paintAddLayer },
    { label: 'Merge down', disabled: paint.active === 0, run: paintMergeDown },
    '-',
    { label: 'Apply and close', run: paintApply },
    { label: 'Back to the model, keeping this edit', run: paintSuspend },
    { label: 'Discard this edit', run: () => dropEdit(paint.id) }
  ]);
}

/* --------------------- the editor's hooks back ------------------- */
/* A texture edit opens: give it a canvas the model can draw from. */
function onPaintSessionStart(sess) {
  if (!sess.owner || sess.owner.kind !== 'texture') return;
  const cv = document.createElement('canvas');
  cv.width = sess.w; cv.height = sess.h;
  const ctex = new THREE.CanvasTexture(cv);
  ctex.magFilter = THREE.NearestFilter;
  ctex.minFilter = THREE.LinearMipmapLinearFilter;
  ctex.flipY = true;
  const owner = sess.owner.entry;
  const om = owner.mxw.meshes[owner.meshIndex || 0];
  live.push({ id: sess.id, entry: owner, tex: sess.owner.tex,
              slot: textureSlot(om, sess.owner.tex), cv, ctex });
  paintCompositeInto(cv, sess);
  ctex.needsUpdate = true;
  rebuild();
}

/* It ends: the model goes back to what the file holds. */
function onPaintSessionEnd(sess) {
  const i = live.findIndex(x => x.id === sess.id);
  if (i < 0) return;
  live[i].ctex.dispose();
  live.splice(i, 1);
  rebuild();
}

/* The pixels changed. Only the canvas and one texture upload -- no
   encode, no rebuild, so it keeps up with the brush. */
function onPaintPixels() {
  const lv = live.find(x => x.id === paint.id);
  if (!lv) return;
  paintCompositeInto(lv.cv);
  lv.ctex.needsUpdate = true;
}

/* The canvas came or went: the model panel follows it. */
function onPaintShown(on) {
  mvSet(on && mvWanted);
  requestAnimationFrame(fitRenderer);
}

/* ------------------------- the model panel ----------------------- */
/* The renderer's own canvas moves in and out of this panel, so there
   is one GL context and one copy of each texture, and the orbit
   handlers -- already bound to that canvas -- keep working inside it. */
let mvWanted = true;

function mvSet(on) {
  const pop = $('mv');
  if (!pop || !rend) return;
  const inPanel = rend.domElement.parentElement === $('mvBody');
  if (on && !inPanel) $('mvBody').appendChild(rend.domElement);
  if (!on && inPanel) $('view').appendChild(rend.domElement);
  pop.hidden = !on;
  if ($('bMV')) $('bMV').classList.toggle('on', mvWanted);
  if (on) {
    $('mvTitle').textContent = current ? current.name : 'Model';
    mvClamp();
  }
  requestAnimationFrame(fitRenderer);
}

/* Keep the panel on screen. Its resting place is measured from the
   right edge to clear the docked panels, which on a narrow window puts
   it off the left edge instead. */
function mvClamp() {
  const pop = $('mv');
  if (!pop || pop.hidden) return;
  const r = pop.getBoundingClientRect();
  if (r.left >= 0 && r.top >= 0 &&
      r.right <= innerWidth && r.bottom <= innerHeight) return;
  const w = Math.min(r.width || 300, innerWidth - 16);
  const h = Math.min(r.height || 330, innerHeight - 16);
  pop.style.right = 'auto';
  pop.style.bottom = 'auto';
  pop.style.width = w + 'px';
  pop.style.height = h + 'px';
  pop.style.left = Math.max(8, innerWidth - w - 8) + 'px';
  pop.style.top = Math.max(8, innerHeight - h - 40) + 'px';
}

function mvWire() {
  const pop = $('mv'), bar = $('mvBar');
  if (!pop || !bar) return;

  /* dragged by its bar, anywhere in the window, and kept on screen */
  let from = null;
  bar.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    const r = pop.getBoundingClientRect();
    from = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    pop.style.right = 'auto';
    pop.style.bottom = 'auto';
    e.preventDefault();
  });
  addEventListener('mousemove', e => {
    if (!from) return;
    const x = Math.max(0, Math.min(innerWidth - from.w, e.clientX - from.dx));
    const y = Math.max(0, Math.min(innerHeight - from.h, e.clientY - from.dy));
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  });
  addEventListener('mouseup', () => { from = null; });

  /* zoom is the camera's distance, the same thing the wheel moves */
  const zoomBy = f => { radius = Math.max(0.15, Math.min(40, radius * f)); };
  $('bMVIn').onclick = () => zoomBy(1 / 1.3);
  $('bMVOut').onclick = () => zoomBy(1.3);
  $('bMVFit').onclick = () => setView('whole');
  $('bMVClose').onclick = () => { mvWanted = false; mvSet(false); };
  $('bMV').onclick = () => {
    mvWanted = !mvWanted;
    mvSet(mvWanted && paint.open && paint.shown);
  };
}

function paintTexture() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!c || !c.mxw.gifs.length) {
    notify('this file has no texture to paint', 1);
    return;
  }
  /* Several edits can be open at once, but only one per slot: a face
     and a body together make sense, two faces do not -- the model can
     only wear one of them, and both would fight over the same
     material. So the same texture reopens its own edit, and a
     different texture in the same slot replaces it. */
  const slot = 'tex:' + textureSlot(m, selectedTex);
  const same = paintFind(x => x.owner && x.owner.kind === 'texture' &&
    x.owner.entry === c && x.owner.tex === selectedTex);
  if (same) { paintSelect(same.id); return; }
  const rival = paintFind(x => x.owner && x.owner.kind === 'texture' &&
    x.owner.entry === c && x.slot === slot);
  if (rival) {
    const name = m && m.textures[textureSlot(m, selectedTex)];
    if (sessionDirty(rival) && !confirm('An unapplied edit of ' +
        rival.label + ' is open, and only one ' +
        (name ? name : 'texture of that slot') +
        ' can be edited at a time. Discard it and edit tex' +
        selectedTex + '?')) return;
    paintCloseSession(rival.id);
  }
  const g = c.mxw.gifs[selectedTex];
  const size = gifSize(g);
  const w = size[0], h = size[1];
  /* The UV layout of the faces that use this texture, and which of
     them share their texels with another face.

     Half of a head is mirrored: the forehead, cheeks and back map to
     the same texels on both sides, so painting there appears twice,
     while each eye has its own space and does not. Measured on the boy:
     texel (12,20) is sampled by faces at x +820 and -820, texel (34,72)
     by one face at x -369 only. Worth seeing rather than discovering by
     surprise. */
  const polys = [];
  if (m) {
    const slot = textureSlot(m, selectedTex);
    const mine = m.faces.filter(f =>
      m.materials.length <= 1 ||
      (m.materials[f.mat] ? m.materials[f.mat].tex : 0) === slot);
    const seen = new Map();
    const key = f => f.vs.map(v => v.u + ',' + v.v).sort().join(' ');
    for (const f of mine) {
      const k = key(f);
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    for (const f of mine) {
      const poly = f.vs.map(v => ({ x: v.u, y: v.v }));
      poly.shared = seen.get(key(f)) > 1;
      polys.push(poly);
    }
  }
  /* Which texture this edit is of, fixed now.

     It used to read selectedTex when the edit was applied, which is a
     different thing: with two edits open, or after clicking another
     thumbnail, Apply wrote the face over whatever happened to be
     selected. */
  const tex = selectedTex;

  decodeImage(new Blob([g], { type: 'image/gif' })).then(img => {
    paintOpen({
      width: w, height: h, base: img.rgba, uv: polys,
      title: c.name + '  tex' + tex,
      owner: { kind: 'texture', entry: c, tex: tex },
      label: 'tex' + tex,
      slot: slot,
      onApply: rgba => {
        try {
          const out = encodeGIF(rgba, w, h, { maxColors: 256 });
          c.mxw.replaceGif(tex, out);
          rebuild();
          renderAll();
          notify('tex' + tex + ' updated, re-encoded to ' +
                 (out.length / 1024).toFixed(1) + 'K');
        } catch (e) {
          notify('encoding failed: ' + e.message, 1);
        }
      }
    });
  }).catch(() => notify('could not decode that texture', 1));
}

/* After editing a texture, make sure the result is actually on screen:
   an unbound one has to be previewed or the model never changes, which
   reads as the edit having done nothing. */
function showSelectedTexture() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (m && !m.materials.some(x => x.tex === selectedTex)) {
    texPreview = { mat: defaultPreviewMat(m, selectedTex), tex: selectedTex };
  }
  rebuild();
  renderAll();
}

function exportUV() {
  const cv = $('uv');
  if (cv.style.display === 'none') { notify('nothing to export yet', 1); return; }
  cv.toBlob(b => b.arrayBuffer().then(ab =>
    saveFile((current.name.replace(/\.[^.]+$/, '') || 'mxw') +
             '_uv_tex' + selectedTex + '.png', new Uint8Array(ab), 'image/png')));
}

function exportTexture() {
  const c = current;
  if (!c || !c.mxw.gifs.length) { notify('no texture to export', 1); return; }
  saveFile((c.name.replace(/\.[^.]+$/, '') || 'mxw') + '_tex' + selectedTex + '.gif',
           c.mxw.gifs[selectedTex], 'image/gif');
}

/* Bring geometry back in from a modeller. Importing into a loaded file
   swaps only the geometry, because an OBJ cannot carry the textures,
   the material bindings or the skeleton -- losing those silently would
   be worse than refusing. */
async function importOBJ(file) {
  let text;
  try { text = await file.text(); }
  catch (e) { notify('could not read ' + file.name, 1); return; }
  let obj;
  try { obj = parseOBJ(text); }
  catch (e) { notify(file.name + ': ' + e.message, 1); return; }

  try {
    if (current) {
      const warn = objReplaceGeometry(current.mxw, current.meshIndex || 0, obj);
      const m = current.mxw.meshes[current.meshIndex || 0];
      selectedTex = 0;
      texPreview = null;
      rebuild();
      renderAll();
      notify('replaced the geometry of ' + current.name + ' with ' +
             m.nv + ' vertices and ' + m.faces.length + ' faces' +
             (warn.length ? ' -- ' + warn.join('; ') : ''));
    } else {
      const res = objToContainer(obj);
      const entry = { name: file.name.replace(/\.obj$/i, '.bin'),
                      raw: res.mxw.write(), mxw: res.mxw, meshIndex: 0 };
      loaded.push(entry);
      current = entry;
      selectedTex = 0;
      texPreview = null;
      setView('whole');
      rebuild();
      renderAll();
      $('empty').style.display = 'none';
      notify('imported ' + res.mxw.meshes[0].nv + ' vertices and ' +
             res.mxw.meshes[0].faces.length + ' faces. It has no texture, ' +
             'which a reader may refuse -- add one before saving' +
             (res.warnings.length ? '. ' + res.warnings.join('; ') : ''));
    }
  } catch (e) {
    notify(file.name + ': ' + e.message, 1);
  }
}

function exportOBJ() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!m) { notify('no mesh to export', 1); return; }
  const L = [`# ${m.kind} -> OBJ   ${c.name}   id=0x${c.mxw.meshId.toString(16).toUpperCase()}`,
             `# textures: ${m.textures.join(', ') || '-'}`,
             `# vertices: ${m.nv}   faces: ${m.faces.length}   bones: ${m.bones.length}`];
  for (let i = 0; i < m.nv; i++)
    L.push(`v ${(m.verts[i * 3] / 1000).toFixed(4)} ${(m.verts[i * 3 + 1] / 1000).toFixed(4)} ${(m.verts[i * 3 + 2] / 1000).toFixed(4)}`);
  for (let i = 0; i < m.nv; i++)
    L.push(`vn ${m.norms[i * 3].toFixed(4)} ${m.norms[i * 3 + 1].toFixed(4)} ${m.norms[i * 3 + 2].toFixed(4)}`);
  const fl = [];
  let k = 1;
  for (let mi = 0; mi < Math.max(1, m.materials.length); mi++) {
    const [su, sv] = m.uvDivisor(mi, c.mxw.gifs);
    const sel = m.faces.filter(f => m.materials.length < 2 || f.mat === mi);
    if (!sel.length) continue;
    fl.push('usemtl ' + (m.materials[mi] ? m.materials[mi].name : 'material' + mi));
    for (const f of sel) {
      const parts = [];
      for (const v of f.vs) {
        L.push(`vt ${(v.u / su).toFixed(4)} ${(1 - v.v / sv).toFixed(4)}`);
        parts.push(`${v.i + 1}/${k}/${v.i + 1}`);
        k++;
      }
      fl.push('f ' + parts.join(' '));
    }
  }
  saveFile((c.name.replace(/\.[^.]+$/, '') || 'mesh') + '.obj',
           new TextEncoder().encode(L.concat(fl).join('\n')), 'text/plain');
}

function saveBin() {
  const c = current;
  if (!c) { notify('nothing loaded', 1); return; }
  saveFile(c.name, c.mxw.write(), 'application/octet-stream');
}

/* ----------------------------- loading --------------------------- */
function addFile(name, buf) {
  try {
    const raw = new Uint8Array(buf);
    const entry = { name, raw, mxw: new MXW(buf), meshIndex: 0 };
    loaded.push(entry);
    current = entry;
    selectedTex = 0;
    texPreview = null;
    setView('whole');
    rebuild();
    renderAll();
    $('empty').style.display = 'none';
    if (entry.mxw.truncated)
      notify(name + ': the header promises ' + entry.mxw.truncated +
             ' more chunk(s) than the file holds -- it is a truncated dump');
  } catch (e) {
    notify(describeRefusal(name, buf, e), 1);
  }
}

/* A refusal is far more useful when it names the format you actually
   dropped. Several files share these extensions without sharing the
   format. */
/* Why a file was not opened.

   When the bytes are recognisably another format, say so -- that is
   more use than a parse error. But keep the error either way: a bug in
   this program once surfaced as a confident and wrong "this is the item
   index", because the guess was allowed to replace the message rather
   than lead it. */
function describeRefusal(name, buf, err) {
  let other = null;
  try { other = identifyOther(buf); } catch (e) { other = null; }
  const why = (err && err.message) ? err.message : String(err);
  if (other) return name + ' is ' + other.name + '. ' + other.note +
                    ' (' + why + ')';
  return name + ': ' + why;
}

function select(i) {
  const c = loaded[i];
  if (!c) return;
  current = c;
  selectedTex = 0;
  texPreview = null;
  rebuild();
  renderAll();
}

function rebuild() {
  if (!current) { if (group) group.clear(); return; }
  const dress = $('bAll').classList.contains('on') && loaded.length > 1;
  build(dress ? loaded : [current]);
}

function readFiles(files) {
  const arr = Array.from(files || []);
  if (!arr.length) { notify('no files received', 1); return; }
  for (const f of arr) {
    const r = new FileReader();
    r.onerror = () => notify('could not read ' + f.name, 1);
    r.onload = () => {
      /* sprites and meshes disagree on almost everything, starting
         with byte order, so route by extension */
      if (isSpriteName(f.name)) {
        try { spriteOpen(f.name, r.result); renderList(); }
        catch (e) { notify(describeRefusal(f.name, r.result, e), 1); }
        return;
      }
      if (/\.obj$/i.test(f.name)) {
        spriteClose();
        importOBJ(f);
        return;
      }
      spriteClose();
      addFile(f.name, r.result);
    };
    r.readAsArrayBuffer(f);
  }
}

/* ----------------------------- wiring ---------------------------- */
$('file').addEventListener('change', e => {
  readFiles(e.target.files);
  e.target.value = '';
});
$('texFile').addEventListener('change', e => {
  if (e.target.files[0]) replaceTexture(e.target.files[0]);
  e.target.value = '';
});
$('bTexIn').onclick = () => $('texFile').click();
$('bPaintTex').onclick = paintTexture;
document.querySelectorAll('#viewRow button[data-view]').forEach(b =>
  b.onclick = () => setView(b.dataset.view));
$('bClear').onclick = clearAll;
$('bNewSprite').onclick = () => {
  const w = parseInt(prompt('frame width in pixels', '64') || '', 10);
  const h = parseInt(prompt('frame height in pixels', '80') || '', 10);
  const n = parseInt(prompt('how many frames', '4') || '', 10);
  if (!(w > 0 && h > 0 && n > 0)) { notify('cancelled'); return; }
  if (w > 4096 || h > 4096 || n > 255) {
    notify('out of range: width and height up to 4096, frames up to 255', 1);
    return;
  }
  spriteClose();
  spriteNew(w, h, n, 'new.gra');
  renderList();
  notify('empty sheet ' + w + 'x' + h + ', ' + n + ' frame(s) -- press "Edit this frame" to draw');
};

let dragDepth = 0;
const showOver = on => {
  $('over').style.display = on ? 'flex' : 'none';
  /* the empty card lights up too, so the drop target is obvious even
     before the overlay registers */
  document.body.classList.toggle('dragging', !!on);
};
document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; showOver(true); });
document.addEventListener('dragover', e => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  showOver(true);
});
document.addEventListener('dragleave', e => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) showOver(false);
});
document.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0; showOver(false);
  const dt = e.dataTransfer;
  if (!dt) return;
  let files = dt.files && dt.files.length ? Array.from(dt.files) : [];
  if (!files.length && dt.items) {
    for (const it of dt.items) if (it.kind === 'file') {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  }
  if (!files.length) { notify('nothing usable in the drop', 1); return; }
  /* an image dropped while something is open goes into it: the chosen
     texture in mesh mode, the current frame or a strip in sprite mode */
  const imgs = files.filter(f => /^image\//.test(f.type)
    && !/\.bin$|\.mxw$|\.gra$|\.spr$|\.eft$|\.obj$/i.test(f.name));
  if (imgs.length === files.length && imgs.length) {
    if (sprite.entry) { spriteImport(imgs[0]); return; }
    if (current) { replaceTexture(imgs[0]); return; }
  }
  readFiles(files);
});

function toggle(id, fn) {
  const el = $(id);
  el.onclick = () => { el.classList.toggle('on'); fn(el.classList.contains('on')); };
}
toggle('bTex', on => {
  for (const mm of texMats) {
    mm.map = on ? (mm.userData.map || null) : null;
    mm.needsUpdate = true;
  }
});
toggle('bWire', on => { if (wireGroup) wireGroup.visible = on; });
toggle('bNorm', on => {
  if (normHelper) normHelper.visible = on;
  else if (on) notify('the normals helper is not in this three.js build');
});
toggle('bBone', on => {
  if (boneLines) boneLines.visible = on;
  else if (on) notify('this file carries no skeleton');
});
toggle('bAxes', on => { if (axes) axes.visible = on; });
toggle('bSpin', on => { spin = on; });
toggle('bAll', on => {
  if (on && loaded.length < 2) notify('load a body and some items, then Dress-up stacks them');
  rebuild();
});
$('bObj').onclick = exportOBJ;
$('bObjIn').onclick = () => $('objFile').click();
$('objFile').addEventListener('change', e => {
  if (e.target.files[0]) importOBJ(e.target.files[0]);
  e.target.value = '';
});
$('bUV').onclick = exportUV;
$('bTexOut').onclick = saveContextGIF;
$('bSave').onclick = saveBin;

/* Each subsystem wires itself independently: one failing must not
   stop the others, and the page has to say which one broke. */
for (const [name, fn] of [['sprites', () => spriteWire()],
                          ['paint editor', () => paintWire()]]) {
  try { fn(); }
  catch (e) { notify(name + ' failed to start: ' + e.message, 1); }
}

/* three.js last, and guarded: if it fails, the sprite editor, the
   inspectors and every export must still work, and the page has to say
   what broke rather than dying silently */
enableActions();
menuWire();
for (const [what, fn] of [['motion panel', poseWire], ['create panel', makeWire],
                          ['tutorial', typeof tutWire === 'function' ? tutWire : () => {}]]) {
  try { fn(); }
  catch (e) { notify('the ' + what + ' failed to start: ' + e.message, 1); }
}

try {
  initThree();
  mvWire();
  /* right-clicking the viewport is about the model, so it waits until
     there is a renderer to talk about */
  $('view').addEventListener('contextmenu', e => {
    if (paint.open && paint.shown) return;   /* the canvas has its own */
    if (document.body.classList.contains('sprite-mode')) return;
    viewMenu(e);
  });
} catch (e) {
  notify('3D view unavailable: ' + e.message + ' -- sprites, inspecting, editing and exporting still work', 1);
}
