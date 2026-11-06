/* The library: a shelf for everything that has been opened, in
   folders you make yourself.

   Thirty-seven files for one character, twelve for a bomb skin, and
   that is one of each -- somebody working on a character has the
   walk, the throw, the old version of the throw, three faces and a
   scratch sheet open at once. The tab strip across the top is the
   wrong shape for that: it is a row, and the work is a tree.

   So this is a window you can put where you want it, holding what you
   opened, arranged the way you decide. Folders nest, everything can
   be renamed, dragged somewhere else or thrown out, and clicking a
   file opens it the way dropping it would.

   What it is not: a disk. The bytes live in this page, so closing the
   tab loses the arrangement -- only where the window sits is
   remembered. A shelf whose contents could not be rebuilt from the
   files on your machine would be a filing system pretending to be a
   panel, and this is a panel. Save a folder as a zip and it is a
   folder again. */

const LIB_KEY = 'mxw.library';
/* Bumped when the default placement changes, so a position saved from
   an older default is replaced once rather than outliving it. */
const LIB_PLACE = 4;

const lib = {
  root: null,
  nodes: new Map(),       /* id -> node */
  seq: 1,
  open: false,
  sel: null,
  drag: null,
  closed: new Set(),      /* folders the user collapsed */
  pos: { x: 0, y: 0, w: 300, h: 420 },
  placed: false
};

/* A node is a folder or a file. A file carries its bytes, because the
   point of the shelf is that what you opened is still there after you
   opened something else. */
function libNode(kind, name, extra) {
  const n = Object.assign({
    id: 'n' + (lib.seq++), kind: kind, name: name, parent: null,
    children: kind === 'folder' ? [] : null
  }, extra || {});
  lib.nodes.set(n.id, n);
  return n;
}

function libInit() {
  if (lib.root) return;
  lib.root = libNode('folder', 'Library');
  lib.root.root = true;
  try {
    const saved = JSON.parse(localStorage.getItem(LIB_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      if (saved.v === LIB_PLACE) {
        for (const k of ['x', 'y', 'w', 'h'])
          if (typeof saved[k] === 'number') lib.pos[k] = saved[k];
        lib.placed = !!saved.placed;
        lib.pos.moved = !!saved.moved;
      }
      /* Whether it was open is deliberately not restored. The files do
         not survive a reload, so restoring it would open an empty
         window over the corner of a page with nothing in it. The shelf
         opens when it has something to show, or when it is asked for. */
    }
  } catch (e) { /* a browser that refuses storage still gets a panel */ }
}

function libSave() {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(Object.assign(
      { v: LIB_PLACE, placed: lib.placed, moved: !!lib.pos.moved },
      lib.pos)));
  } catch (e) { /* fine */ }
}

/* ---------------------------- the tree --------------------------- */

function libAttach(node, parent) {
  if (node.parent) {
    const old = lib.nodes.get(node.parent);
    if (old) old.children = old.children.filter(c => c !== node.id);
  }
  parent.children.push(node.id);
  node.parent = parent.id;
  return node;
}

/* A folder by path, made along the way. "archer/walk" under the root
   is two folders, and asking twice gives the same two. */
function libFolderAt(path, under) {
  libInit();
  let at = under || lib.root;
  for (const part of String(path || '').split('/')) {
    const name = part.trim();
    if (!name) continue;
    let found = at.children
      .map(id => lib.nodes.get(id))
      .find(c => c && c.kind === 'folder' && c.name === name);
    if (!found) found = libAttach(libNode('folder', name), at);
    at = found;
  }
  return at;
}

/* Shelve a file. The same name in the same folder replaces what was
   there, because opening a file twice should not shelve it twice. */
function libTake(name, buf, path) {
  libInit();
  const into = path ? libFolderAt(path) : lib.root;
  const raw = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const twin = into.children.map(id => lib.nodes.get(id))
    .find(c => c && c.kind === 'file' && c.name === name);
  if (twin) {
    twin.raw = raw;
    libRender();
    return twin;
  }
  const n = libAttach(libNode('file', name, { raw: raw }), into);
  libRender();
  return n;
}

/* A whole import at once: paths become folders, and the panel opens
   itself, because this is the moment the shelf is worth looking at. */
function libTakeMany(entries, label) {
  libInit();
  if (!entries || !entries.length) return;
  const base = label ? libFolderAt(label) : lib.root;
  for (const e of entries) {
    const parts = String(e.path || e.name).split('/');
    const name = parts.pop();
    const raw = e.buf instanceof Uint8Array ? e.buf : new Uint8Array(e.buf);
    const into = parts.length ? libFolderAt(parts.join('/'), base) : base;
    const twin = into.children.map(id => lib.nodes.get(id))
      .find(c => c && c.kind === 'file' && c.name === name);
    if (twin) twin.raw = raw;
    else libAttach(libNode('file', name, { raw: raw }), into);
  }
  libShow(true);
  libRender();
  /* The arrows only answer to the tree, so an import hands it the
     keyboard: the point of a shelf full of sheets is stepping through
     them, and having to click first to do that is a step nobody asked
     for. */
  const tree = $('libTree');
  if (tree) tree.focus({ preventScroll: true });
}

function libDescends(id, ofId) {
  let at = lib.nodes.get(id);
  while (at && at.parent) {
    if (at.parent === ofId) return true;
    at = lib.nodes.get(at.parent);
  }
  return false;
}

function libMove(id, intoId) {
  const n = lib.nodes.get(id), into = lib.nodes.get(intoId);
  if (!n || !into || into.kind !== 'folder' || n.root) return false;
  /* A folder cannot go inside itself, and a folder cannot go inside
     something it contains -- that would cut the branch off the tree
     with everything still on it. */
  if (id === intoId || libDescends(intoId, id)) return false;
  libAttach(n, into);
  libRender();
  return true;
}

function libDrop(id) {
  const n = lib.nodes.get(id);
  if (!n || n.root) return;
  const kill = x => {
    if (x.children) for (const c of x.children.slice()) {
      const ch = lib.nodes.get(c);
      if (ch) kill(ch);
    }
    lib.nodes.delete(x.id);
  };
  const parent = lib.nodes.get(n.parent);
  if (parent) parent.children = parent.children.filter(c => c !== id);
  kill(n);
  if (lib.sel === id) lib.sel = null;
  libRender();
}

function libCount(node) {
  if (node.kind === 'file') return 1;
  let n = 0;
  for (const id of node.children) {
    const c = lib.nodes.get(id);
    if (c) n += libCount(c);
  }
  return n;
}

/* Every file under a node, with the path it would have on disk. */
function libFlatten(node, prefix, out) {
  out = out || [];
  prefix = prefix || '';
  if (node.kind === 'file') {
    out.push({ path: prefix + node.name, node: node });
    return out;
  }
  const at = node.root ? prefix : prefix + node.name + '/';
  for (const id of node.children) {
    const c = lib.nodes.get(id);
    if (c) libFlatten(c, at, out);
  }
  return out;
}

/* ------------------------- what a file is ------------------------ */

/* Enough to show a line of detail without opening anything: a sprite
   says how many frames it has, and something that will not parse says
   so here rather than when it is clicked. */
function libAbout(node) {
  if (node.about !== undefined) return node.about;
  node.about = null;
  if (/\.(gra|spr|eft)$/i.test(node.name)) {
    try {
      const g = new GRA(node.raw.buffer.slice(
        node.raw.byteOffset, node.raw.byteOffset + node.raw.byteLength));
      node.about = g.eft
        ? tf('{n} frames', { n: g.eft.per || g.frames.length })
        : tf(g.frames.length === 1 ? '{n} frame' : '{n} frames',
             { n: g.frames.length });
    } catch (e) { node.about = t('will not open'); }
  } else {
    node.about = tf('{n} KB', { n: Math.max(1, Math.round(node.raw.length / 1024)) });
  }
  return node.about;
}

/* --------------------------- the panel --------------------------- */

function libShow(on) {
  libInit();
  lib.open = on === undefined ? !lib.open : !!on;
  const el = $('lib');
  if (el) el.hidden = !lib.open;
  if (lib.open) {
    libPlace();
    libRender();
  } else if (typeof panelArrange === 'function') {
    panelArrange();
  }
  libSave();
}

/* First time it opens, it sits in the top right corner of the work
   area. The near corner belongs to the frame tools, which are what a
   hand reaches for while drawing; a list of files is read, not
   reached for. After that it is wherever it was dragged. */
function libPlace() {
  const el = $('lib');
  if (!el) return;
  if (!lib.placed) {
    Object.assign(lib.pos, panelCorner('right', 300, 520, 8));
    lib.placed = true;
  }
  libClamp();
  panelApply(el, lib.pos);
  if (typeof panelArrange === 'function') panelArrange();
}

function libClamp() {
  panelClamp(lib.pos, { w: 200, W: 900, h: 120 });
}

function libRender() {
  libInit();
  const host = $('libTree');
  if (!host) return;
  const badge = $('libCount');
  const total = libCount(lib.root);
  if (badge) badge.textContent = total ? String(total) : '';
  const b = $('bLib');
  if (b) b.classList.toggle('has', total > 0);
  if (!lib.open) return;

  /* Where the selection is, which a deep tree stops making obvious. */
  const where = $('libWhere');
  if (where) where.textContent = lib.sel ? libPath(lib.sel) : '';

  if (!total) {
    host.innerHTML = '<p class="hint">' + t('Nothing here yet. Everything ' +
      'you open is shelved, and a folder or a zip keeps the folders it ' +
      'came in.') + '</p>';
    return;
  }
  const rows = [];
  libRows(lib.root, 0, rows);
  host.innerHTML = rows.join('');
  libWireRows(host);
}

function libRows(node, depth, out) {
  const openName = sprite.entry ? sprite.entry.name : null;
  for (const id of node.children) {
    const n = lib.nodes.get(id);
    if (!n) continue;
    const pad = 'style="padding-left:' + (6 + depth * 13) + 'px"';
    if (n.kind === 'folder') {
      const shut = lib.closed.has(n.id);
      out.push('<div class="libRow folder' +
        (lib.sel === n.id ? ' sel' : '') + '" data-id="' + n.id +
        '" draggable="true" ' + pad + '>' +
        '<span class="tw">' + (shut ? '\u25b8' : '\u25be') + '</span>' +
        '<span class="nm">' + libEsc(n.name) + '</span>' +
        '<span class="ct">' + libCount(n) + '</span></div>');
      if (!shut) libRows(n, depth + 1, out);
    } else {
      out.push('<div class="libRow file' +
        (lib.sel === n.id ? ' sel' : '') +
        (n.name === openName ? ' live' : '') + '" data-id="' + n.id +
        '" draggable="true" ' + pad + '>' +
        '<span class="tw"></span>' +
        '<span class="nm">' + libEsc(n.name) + '</span>' +
        '<span class="ct">' + libEsc(libAbout(n) || '') + '</span></div>');
    }
  }
}

/* The path to a node, the root left out because naming it in every
   line would say nothing. */
function libPath(id) {
  const parts = [];
  let at = lib.nodes.get(id);
  while (at && !at.root) {
    parts.unshift(at.name);
    at = lib.nodes.get(at.parent);
  }
  return parts.join(' / ');
}

function libEsc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------------------- the rows --------------------------- */

function libWireRows(host) {
  host.querySelectorAll('.libRow').forEach(row => {
    const id = row.dataset.id;
    row.addEventListener('click', ev => {
      lib.sel = id;
      const n = lib.nodes.get(id);
      if (!n) return;
      const tree = $('libTree');
      if (tree) tree.focus({ preventScroll: true });
      if (n.kind === 'folder') {
        /* the twisty folds; the name only selects, because a
           double-click on it renames */
        if (ev.target.classList.contains('tw')) libFold(id);
        libRender();
        return;
      }
      /* One click changes file. Browsing a character means looking at
         thirty-seven sheets in a row, and asking for two clicks each
         time turns reading into typing. */
      libOpenNode(id);
    });
    row.addEventListener('dblclick', () => {
      const n = lib.nodes.get(id);
      if (n && n.kind === 'folder') libRenameStart(id);
    });
    row.addEventListener('contextmenu', ev => {
      lib.sel = id;
      libRender();
      libMenu(ev, id);
    });
    /* dragging within the panel moves things; the page's own drop
       handler must not see it as a file arriving from outside */
    row.addEventListener('dragstart', ev => {
      lib.drag = id;
      ev.stopPropagation();
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        try { ev.dataTransfer.setData('text/plain', id); } catch (e) { /* fine */ }
      }
    });
    row.addEventListener('dragover', ev => {
      if (!lib.drag) return;
      const n = lib.nodes.get(id);
      const into = n && n.kind === 'folder' ? id : (n && n.parent);
      if (!into || into === lib.drag || libDescends(into, lib.drag)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      row.classList.add('into');
    });
    row.addEventListener('dragleave', () => row.classList.remove('into'));
    row.addEventListener('drop', ev => {
      row.classList.remove('into');
      if (!lib.drag) return;
      ev.preventDefault();
      ev.stopPropagation();
      const n = lib.nodes.get(id);
      const into = n && n.kind === 'folder' ? id : (n && n.parent);
      if (into) libMove(lib.drag, into);
      lib.drag = null;
    });
    row.addEventListener('dragend', () => { lib.drag = null; libRender(); });
  });
}

function libOpenNode(id) {
  const n = lib.nodes.get(id);
  if (!n || n.kind !== 'file') return;
  const buf = n.raw.buffer.slice(n.raw.byteOffset,
    n.raw.byteOffset + n.raw.byteLength);
  if (typeof openBuffer === 'function') openBuffer(n.name, buf);
  libRender();
}

/* ------------------------- renaming in place --------------------- */

function libRenameStart(id) {
  const row = $('libTree').querySelector('[data-id="' + id + '"] .nm');
  const n = lib.nodes.get(id);
  if (!row || !n || n.root) return;
  const input = document.createElement('input');
  input.className = 'libName';
  input.value = n.name;
  row.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = keep => {
    if (done) return;
    done = true;
    if (keep) {
      const v = input.value.trim();
      /* A name is what the loader will ask for, so an empty one is
         not a name and a slash would invent a folder. */
      if (v) n.name = v.replace(/[\\/]+/g, '-');
    }
    libRender();
  };
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    ev.stopPropagation();
  });
  input.addEventListener('blur', () => finish(true));
}

/* ------------------------- walking the tree ---------------------- */

function libFold(id) {
  if (lib.closed.has(id)) lib.closed.delete(id);
  else lib.closed.add(id);
}

/* The rows as they are on screen, in order, with a shut folder's
   children left out -- which is what an arrow key has to move
   through, not the tree as it is stored. */
function libVisible(node, out) {
  out = out || [];
  node = node || lib.root;
  for (const id of node.children) {
    const n = lib.nodes.get(id);
    if (!n) continue;
    out.push(n);
    if (n.kind === 'folder' && !lib.closed.has(id)) libVisible(n, out);
  }
  return out;
}

function libReveal(id) {
  const row = $('libTree') && $('libTree').querySelector('[data-id="' + id + '"]');
  if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
}

/* Moving the selection opens what it lands on, because that is what
   the arrow keys are for here: stepping through a character's sheets
   and watching each one. Folders only select; they have no sheet. */
function libGo(id, open) {
  if (!id) return;
  lib.sel = id;
  const n = lib.nodes.get(id);
  libRender();
  libReveal(id);
  if (open && n && n.kind === 'file') libOpenNode(id);
}

function libStep(by) {
  const rows = libVisible();
  if (!rows.length) return;
  let at = rows.findIndex(n => n.id === lib.sel);
  if (at < 0) at = by > 0 ? -1 : rows.length;
  const next = rows[Math.max(0, Math.min(rows.length - 1, at + by))];
  if (next) libGo(next.id, true);
}

function libKeys(ev) {
  if (!lib.open) return;
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  /* Only while the shelf has the keyboard: the arrows belong to
     whatever else is focused the rest of the time. */
  const tree = $('libTree');
  if (!tree || !tree.contains(el)) return;
  const n = lib.sel && lib.nodes.get(lib.sel);

  switch (ev.key) {
    case 'ArrowDown': ev.preventDefault(); libStep(1); return;
    case 'ArrowUp': ev.preventDefault(); libStep(-1); return;
    case 'Home': ev.preventDefault(); {
      const rows = libVisible();
      if (rows.length) libGo(rows[0].id, true);
      return;
    }
    case 'End': ev.preventDefault(); {
      const rows = libVisible();
      if (rows.length) libGo(rows[rows.length - 1].id, true);
      return;
    }
    case 'ArrowRight': ev.preventDefault();
      if (!n) return;
      if (n.kind === 'folder' && lib.closed.has(n.id)) { libFold(n.id); libRender(); }
      else if (n.kind === 'folder' && n.children.length) libGo(n.children[0], true);
      return;
    case 'ArrowLeft': ev.preventDefault();
      if (!n) return;
      if (n.kind === 'folder' && !lib.closed.has(n.id) && n.children.length) {
        libFold(n.id); libRender();
      } else if (n.parent && !lib.nodes.get(n.parent).root) {
        libGo(n.parent, false);
      }
      return;
    case 'Enter': ev.preventDefault();
      if (!n) return;
      if (n.kind === 'file') libOpenNode(n.id);
      else { libFold(n.id); libRender(); }
      return;
    case 'F2': ev.preventDefault(); if (lib.sel) libRenameStart(lib.sel); return;
    case 'Delete': ev.preventDefault(); if (lib.sel) libAsk(lib.sel); return;
    default: return;
  }
}

/* --------------------------- the actions ------------------------- */

function libNewFolder(parentId) {
  libInit();
  const parent = lib.nodes.get(parentId) || lib.root;
  const into = parent.kind === 'folder' ? parent
    : (lib.nodes.get(parent.parent) || lib.root);
  const n = libAttach(libNode('folder', t('New folder')), into);
  lib.closed.delete(into.id);
  lib.sel = n.id;
  libRender();
  libRenameStart(n.id);
  return n;
}

/* A character's thirty-seven sheets, filed by what they are. This is
   the shape the work has -- somebody draws the walk, then the throw --
   and it is the one thing the shelf can arrange better than a person
   dragging thirty-seven rows. */
function libGroupByAnimation(id) {
  const node = lib.nodes.get(id) || lib.root;
  if (node.kind !== 'folder') return;
  const files = libFlatten(node).filter(f => f.node.kind === 'file');
  let moved = 0;
  for (const f of files) {
    const sheet = typeof charSheetOf === 'function'
      ? charSheetOf(f.node.name) : null;
    if (!sheet) continue;
    const into = libFolderAt(t(sheet.label), node);
    if (f.node.parent !== into.id) { libAttach(f.node, into); moved++; }
  }
  /* folders that gave up every file are now noise */
  libPrune(node);
  libRender();
  notify(moved
    ? tf('{n} files filed by animation', { n: moved })
    : t('nothing here is one of the 37 sheets'));
}

function libPrune(node) {
  if (node.kind !== 'folder') return;
  for (const cid of node.children.slice()) {
    const c = lib.nodes.get(cid);
    if (!c) continue;
    libPrune(c);
    if (c.kind === 'folder' && !c.children.length && !c.root) libDropQuiet(cid);
  }
}

function libDropQuiet(id) {
  const n = lib.nodes.get(id);
  if (!n || n.root) return;
  const p = lib.nodes.get(n.parent);
  if (p) p.children = p.children.filter(c => c !== id);
  lib.nodes.delete(id);
}

function libSaveZip(id) {
  const node = lib.nodes.get(id) || lib.root;
  const files = libFlatten(node);
  if (!files.length) { notify(t('nothing in there to save'), 1); return; }
  if (files.length === 1 && node.kind === 'file') {
    saveFile(node.name, node.raw, 'application/octet-stream');
    return;
  }
  const name = (node.root ? 'library' : node.name).replace(/[^\w.-]+/g, '_');
  const zip = zipBuild(files.map(f => ({ name: name + '/' + f.path,
                                         data: f.node.raw })));
  saveFile(name + '.zip', zip, 'application/zip');
  notify(tf('{n} files, {kb} KB',
    { n: files.length, kb: (zip.length / 1024).toFixed(0) }));
}

/* The whole set as one document, from the shelf: a folder of
   thirty-seven is exactly what the set view wants. */
function libOpenAsSet(id) {
  const node = lib.nodes.get(id) || lib.root;
  if (node.kind !== 'folder' || typeof folderOpen !== 'function') return;
  const files = libFlatten(node);
  if (!files.length) { notify(t('nothing in there to open'), 1); return; }
  folderOpen(node.root ? t('Library') : node.name, files.map(f => ({
    path: f.path,
    buf: f.node.raw.buffer.slice(f.node.raw.byteOffset,
      f.node.raw.byteOffset + f.node.raw.byteLength)
  })));
}

function libMenu(ev, id) {
  const n = lib.nodes.get(id);
  if (!n || typeof menuAt !== 'function') return;
  const items = [];
  if (n.kind === 'file') {
    items.push({ label: t('Open'), run: () => libOpenNode(id) });
  } else {
    items.push({ label: t('Open as a set'), run: () => libOpenAsSet(id) });
    items.push({ label: t('File by animation'),
                 run: () => libGroupByAnimation(id) });
  }
  items.push('-');
  items.push({ label: t('New folder inside'), run: () => libNewFolder(id) });
  items.push({ label: t('Rename'), run: () => libRenameStart(id) });
  items.push({ label: t('Save as .zip'), run: () => libSaveZip(id) });
  items.push('-');
  items.push({ label: t('Remove from the shelf'), run: () => libAsk(id) });
  menuAt(ev, n.name, items);
}

/* Throwing out a folder throws out what is in it, and the panel is
   the only copy in the page -- so it says how much before it does. */
function libAsk(id) {
  const n = lib.nodes.get(id);
  if (!n) return;
  const count = libCount(n);
  if (n.kind === 'folder' && count > 0 &&
      !confirm(tf('Remove "{name}" and the {n} files in it? They stay on ' +
        'your disk; this only clears the shelf.',
        { name: n.name, n: count }))) return;
  libDrop(id);
}

function libClear() {
  const n = libCount(lib.root);
  if (!n) return;
  if (!confirm(tf('Clear the shelf? {n} files go, and they stay on your ' +
    'disk either way.', { n: n }))) return;
  for (const id of lib.root.children.slice()) libDrop(id);
}

/* --------------------------- moving it --------------------------- */

/* The window itself, which is the same window the frame tools use. */
function libWireWindow() {
  panelWindow({
    el: $('lib'), head: $('libHead'), grip: $('libGrip'),
    pos: lib.pos, min: { w: 200, W: 900, h: 120 }, order: 0,
    side: 'right',
    onDone: libSave
  });
}

function libWire() {
  libInit();
  libWireWindow();
  const b = $('bLib');
  if (b) b.addEventListener('click', () => libShow());
  const x = $('libX');
  if (x) x.addEventListener('click', () => libShow(false));
  const nf = $('bLibFolder');
  if (nf) nf.addEventListener('click', () => libNewFolder(lib.sel));
  const gr = $('bLibGroup');
  if (gr) gr.addEventListener('click', () =>
    libGroupByAnimation(lib.sel && lib.nodes.get(lib.sel) &&
      lib.nodes.get(lib.sel).kind === 'folder' ? lib.sel : lib.root.id));
  const zp = $('bLibZip');
  if (zp) zp.addEventListener('click', () => libSaveZip(lib.sel || lib.root.id));
  const cl = $('bLibClear');
  if (cl) cl.addEventListener('click', libClear);

  /* The arrows, Enter, Home, End, F2 and Delete, all of them only
     while the tree itself has the keyboard. */
  addEventListener('keydown', libKeys);

  /* It starts closed, every time: see libInit. */
  libRender();
}
