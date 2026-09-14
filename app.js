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
let spin = false, radius = 4, theta = Math.PI / 2, phi = 1.5, targetY = 0;
/* Which texture to show on which material, while previewing. The
   file's own binding is untouched -- this only changes what is drawn.
   A body binds tex0 to the body and tex1 to the head, leaving the eight
   expressions in tex2..tex9 bound to nothing, so selecting one has to
   say where it should appear. */
let texPreview = null;        /* {mat, tex} or null for the file's own */
let selectedTex = 0;

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

/* ------------------------------ three ---------------------------- */
function initThree() {
  if (typeof THREE === 'undefined') throw new Error('three.js did not load');
  const host = $('view');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1524);
  cam = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.01, 500);
  rend = new THREE.WebGLRenderer({ antialias: true });
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
  scene.add(axes);
  group = new THREE.Group();
  scene.add(group);

  addEventListener('resize', () => {
    if (!rend) return;
    cam.aspect = host.clientWidth / host.clientHeight;
    cam.updateProjectionMatrix();
    rend.setSize(host.clientWidth, host.clientHeight);
  });
  bindOrbit();
  ready = true;
  (function loop() {
    requestAnimationFrame(loop);
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
   negative Z -- so drawing several in raw coordinates lines them up
   with no fitting. That is what Dress-up does. */

function meshOf(m, gifs) {
  const pos = [], nor = [], uv = [], groups = [];
  const push = (vi, u, v, su, sv) => {
    pos.push(m.verts[vi * 3], m.verts[vi * 3 + 1], m.verts[vi * 3 + 2]);
    nor.push(m.norms[vi * 3], m.norms[vi * 3 + 1], m.norms[vi * 3 + 2]);
    uv.push(u / su, 1 - v / sv);
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
    let ti = m.materials[g.mi] ? m.materials[g.mi].tex : 0;
    if (texPreview && texPreview.mat === g.mi) ti = texPreview.tex;
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

  return { geo, mats, obj: new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0]) };
}

function build(items) {
  if (!ready) return;
  group.clear();
  mesh = wireGroup = normHelper = boneLines = null;
  texMats = [];

  const stage = new THREE.Group();
  const union = new THREE.Box3();
  const built = [];
  for (const it of items) {
    const m = it.mxw.meshes[it.meshIndex || 0];
    if (!m || !m.faces.length) continue;
    const b = meshOf(m, it.mxw.gifs);
    built.push(b);
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

  /* the skeleton, when the file carries one */
  const sk = current && current.mxw.skeletons[0];
  if (sk) {
    const pts = [];
    const at = b => [b.a, b.b, b.c];
    for (const b of sk.bones) {
      if (b.parent === 0xFF || b.parent >= sk.bones.length) continue;
      pts.push(...at(b), ...at(sk.bones[b.parent]));
    }
    if (pts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      boneLines = new THREE.LineSegments(g,
        new THREE.LineBasicMaterial({ color: 0xff7ac8 }));
      boneLines.visible = $('bBone').classList.contains('on');
      stage.add(boneLines);
    }
  }
  radius = 4; targetY = 0;
}


/* Named viewpoints. Back items sit at negative Z in every file measured,
   so +Z is the front and theta = pi/2 looks at it. The model is
   normalised to two units tall and centred, which puts the head near
   y = +0.8. */
const VIEWS = {
  face:  { theta: Math.PI / 2,  phi: 1.5,  radius: 1.15, targetY: 0.8 },
  front: { theta: Math.PI / 2,  phi: 1.45, radius: 3.2,  targetY: 0 },
  back:  { theta: -Math.PI / 2, phi: 1.45, radius: 3.2,  targetY: 0 },
  left:  { theta: Math.PI,      phi: 1.45, radius: 3.2,  targetY: 0 },
  right: { theta: 0,            phi: 1.45, radius: 3.2,  targetY: 0 },
  top:   { theta: Math.PI / 2,  phi: 0.2,  radius: 3.2,  targetY: 0 },
  whole: { theta: Math.PI / 2,  phi: 1.45, radius: 4,    targetY: 0 }
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

function renderAll() {
  renderList();
  renderHeader();
  renderMesh();
  renderTextures();
  renderSkeleton();
  renderUV();
  checkRoundTrip();
}

function renderList() {
  const rows = loaded.map((c, i) =>
    '<div data-i="' + i + '" class="' + (current === c ? 'sel' : '') + '">' +
    esc(c.name) + '<span class="dim">' +
    (c.mxw.meshes[0] ? c.mxw.meshes[0].nv + 'v ' : '- ') +
    c.mxw.gifs.length + 't' +
    (c.mxw.skeletons.length ? ' &middot; skel' : '') +
    ' <button class="rm" data-rm="' + i + '" title="close this file">&times;</button>' +
    '</span></div>');
  if (sprite.entry) {
    rows.push('<div class="sel" data-sprite="1">' + esc(sprite.entry.name) +
      '<span class="dim">' + sprite.entry.gra.frames.length + 'f' +
      ' <button class="rm" data-rmsprite="1" title="close this file">&times;</button>' +
      '</span></div>');
  }
  $('list').innerHTML = rows.join('');
  $('list').querySelectorAll('div').forEach(d => d.onclick = e => {
    if (e.target.classList.contains('rm')) return;
    if (d.dataset.sprite) return;
    spriteClose();
    select(+d.dataset.i);
  });
  $('list').querySelectorAll('.rm').forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (b.dataset.rmsprite) { closeSprite(); return; }
    removeFile(+b.dataset.rm);
  });
}

/* Closing a file has to clear the viewport too, or the previous one
   stays on screen underneath the next. */
function resetPanels() {
  if (group) group.clear();
  mesh = wireGroup = normHelper = boneLines = null;
  texMats = [];
  $('meshPanel').style.display = 'none';
  $('texPanel').style.display = 'none';
  $('skelPanel').style.display = 'none';
  $('hdr').innerHTML = '';
  $('rt').textContent = '';
  $('rt').className = 'rt';
}

function removeFile(i) {
  if (i < 0 || i >= loaded.length) return;
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

function renderMesh() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!m) { $('meshPanel').style.display = 'none'; return; }
  $('meshPanel').style.display = 'block';
  const bb = m.bbox();
  const dim = bb ? bb[1].map((v, k) => v - bb[0][k]).join(' &times; ') : '-';
  $('meshInfo').innerHTML = `
    <dl><dt>type</dt><dd>${m.kind}</dd>
        <dt>vertices</dt><dd>${m.nv}</dd>
        <dt>faces</dt><dd>${m.faces.length}</dd>
        <dt>bone ranges</dt><dd>${m.bones.length}</dd>
        <dt>size</dt><dd>${dim}</dd></dl>`;

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
  $('texGrid').querySelectorAll('figure').forEach(f =>
    f.onclick = () => { selectTexture(+f.dataset.t); });
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
function paintTexture() {
  const c = current;
  const m = c && c.mxw.meshes[c.meshIndex || 0];
  if (!c || !c.mxw.gifs.length) {
    notify('this file has no texture to paint', 1);
    return;
  }
  const g = c.mxw.gifs[selectedTex];
  const size = gifSize(g);
  const w = size[0], h = size[1];
  const polys = [];
  if (m) {
    for (const f of m.faces) {
      const mt = m.materials[f.mat] ? m.materials[f.mat].tex : 0;
      if (m.materials.length > 1 && mt !== selectedTex) continue;
      polys.push(f.vs.map(v => ({ x: v.u, y: v.v })));
    }
  }
  decodeImage(new Blob([g], { type: 'image/gif' })).then(img => {
    paintOpen({
      width: w, height: h, base: img.rgba, uv: polys,
      title: c.name + '  tex' + selectedTex,
      onApply: rgba => {
        try {
          const out = encodeGIF(rgba, w, h, { maxColors: 256 });
          c.mxw.replaceGif(selectedTex, out);
          rebuild();
          renderAll();
          notify('tex' + selectedTex + ' updated, re-encoded to ' +
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
             'which the game may refuse -- add one before saving' +
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
function describeRefusal(name, buf, err) {
  let other = null;
  try { other = identifyOther(buf); } catch (e) { other = null; }
  if (other) return name + ' is ' + other.name + '. ' + other.note;
  return name + ': ' + err.message;
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
const showOver = on => { $('over').style.display = on ? 'flex' : 'none'; };
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
$('bTexOut').onclick = exportTexture;
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
try {
  initThree();
} catch (e) {
  notify('3D view unavailable: ' + e.message + ' -- sprites, inspecting, editing and exporting still work', 1);
}
