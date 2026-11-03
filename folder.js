/* A folder as one document.

   A character is not a sheet, it is thirty-seven of them that have to
   agree with each other, and a bomb skin is twelve files of which
   most are deliberately absent. Opening them one at a time hides
   exactly the faults that matter: the slot nobody drew, the preview
   that drifted from the stand it is supposed to copy, the file saved
   in capitals onto a server that cares about capitals. None of those
   are visible inside a single file, which is why they survive.

   So a folder opens as a set. The panel lists every slot the loader
   will ask for, says which are there, and runs the checks that need
   two files at once. Clicking a slot opens it the usual way, with the
   guides and the measurements -- the set view is a table of contents,
   not a second editor.

   A zip is read the same way, because that is how one of these gets
   sent to somebody. */

const folder = {
  kind: null,         /* 'character' | 'bomb' */
  name: '',
  files: new Map(),   /* lowercase base name -> {name, raw, gra, error} */
  extra: [],          /* names the loader will never ask for */
  caps: []            /* names with a capital in them */
};

/* The twelve files of a bomb skin, in the order the client lists them.
   Missing is not an error here: what a skin lacks stays the game's
   own, which is why thirty-seven of the forty that ship carry two
   files and no more. */
const BOMB_FILES = [
  ['bomb.spr', 'the bomb resting and appearing'],
  ['bomb_d.spr', 'the marker where it is being placed'],
  ['bomb_s.spr', 'its shadow'],
  ['bomb_f.eft', 'the fuse spark'],
  ['flame_center.eft', 'the fire at the bomb'],
  ['flame_hor.eft', 'the fire running across'],
  ['flame_ver.eft', 'the fire running up and down'],
  ['flame_right.eft', 'the right-hand tip'],
  ['flame_left.eft', 'the left-hand tip'],
  ['flame_up.eft', 'the top tip'],
  ['flame_down.eft', 'the bottom tip'],
  ['boom_block.eft', 'a block breaking']
];

/* ---------------------------- recognising ------------------------ */

/* What a pile of files is, decided by how many of them a loader would
   recognise rather than by what the folder is called. A folder of six
   character sheets is still a character folder, and saying so is more
   use than refusing it. */
function folderSniff(names) {
  const low = names.map(n => n.replace(/^.*[\\/]/, '').toLowerCase());
  let chars = 0, bombs = 0;
  const bombSet = new Set(BOMB_FILES.map(b => b[0]));
  for (const n of low) {
    const base = n.replace(/\.[^.]*$/, '');
    if (typeof CHAR_BY_FILE === 'object' && CHAR_BY_FILE[base]) chars++;
    if (bombSet.has(n)) bombs++;
  }
  if (chars >= 4 && chars >= bombs) return 'character';
  if (bombs >= 1 && bombs > chars) return 'bomb';
  return null;
}

/* entries: [{path, buf}] -- path may carry folders, which is how a
   directory drop and a zip both arrive. */
function folderOpen(label, entries) {
  const kind = folderSniff(entries.map(e => e.path));
  if (!kind) {
    notify('that folder has nothing a character or a bomb skin is made of', 1);
    return false;
  }
  folder.kind = kind;
  folder.name = label || 'folder';
  folder.files = new Map();
  folder.extra = [];
  folder.caps = [];
  folder.report = null;

  const want = kind === 'character'
    ? new Set(CHAR_SHEETS.map(s => s.file + '.gra')
        .concat(CHAR_SHEETS.map(s => s.file + '.spr')))
    : new Set(BOMB_FILES.map(b => b[0]));

  for (const e of entries) {
    const name = e.path.replace(/^.*[\\/]/, '');
    const low = name.toLowerCase();
    if (!want.has(low)) {
      if (/\.(gra|spr|eft)$/i.test(name)) folder.extra.push(name);
      continue;
    }
    if (name !== low) folder.caps.push(name);
    const rec = { name, raw: new Uint8Array(e.buf), gra: null, error: null };
    try { rec.gra = new GRA(e.buf); }
    catch (err) { rec.error = err.message; }
    folder.files.set(low, rec);
  }

  if (!folder.files.size) {
    notify('nothing in there parsed as a sprite', 1);
    folderClose();
    return false;
  }

  /* Open something at once: the panel lives in the sprite side of the
     window, and an empty window with a table of contents in it reads
     as though nothing happened. */
  const first = kind === 'character'
    ? (folderFile('st_s') || folderFile('mo_s') || folderAny())
    : (folderFile('bomb') || folderAny());
  if (first) folderPick(first.name);
  else folderRender();
  notify(folder.name + ': ' + folder.files.size + ' of ' +
    (kind === 'character' ? 37 : 12) + ' files');
  return true;
}

function folderFile(base) {
  return folder.files.get(base + '.gra') || folder.files.get(base + '.spr') ||
         folder.files.get(base) || null;
}

function folderAny() {
  for (const v of folder.files.values()) return v;
  return null;
}

function folderClose() {
  folder.kind = null;
  folder.files = new Map();
  folder.extra = [];
  folder.caps = [];
  folder.report = null;
  const d = $('folderDock');
  if (d) d.classList.remove('on');
}

/* Opening one of the set is opening a file, with everything that
   normally comes with it. */
function folderPick(name) {
  const rec = folder.files.get(name.toLowerCase());
  if (!rec) return;
  if (rec.error) { notify(rec.name + ' will not parse: ' + rec.error, 1); return; }
  if (typeof mapClose === 'function') mapClose();
  spriteOpen(rec.name, rec.raw.buffer.slice(
    rec.raw.byteOffset, rec.raw.byteOffset + rec.raw.byteLength));
  if (typeof renderList === 'function') renderList();
  folderRender();
}

/* --------------------------- the checks -------------------------- */

/* A frame's pixels as a comparable string, for the seams that only
   show up between two files. */
function folderFrameKey(g, i) {
  const f = g && g.frames[i];
  if (!f) return null;
  return f.runs.map(r => r.y + ':' + r.x + ':' + r.px.join(',')).join('|');
}

function folderProblems() {
  const out = [];
  const say = (level, text) => out.push({ level, text });
  if (folder.kind === 'bomb') {
    const have = BOMB_FILES.filter(b => folder.files.has(b[0])).length;
    if (!folder.files.has('bomb.spr')) {
      say('bad', 'no bomb.spr. That one is the skin: without it there is ' +
        'nothing to put on a bomb.');
    }
    if (have < 12) {
      say('note', (12 - have) + ' of the twelve ' +
        (have === 11 ? 'is' : 'are') + ' not here, and that is ' +
        'normal \u2014 what a skin lacks stays the game\u2019s own. Of the ' +
        'forty skins the server ships, every one has bomb.spr, thirty-one ' +
        'have bomb_d.spr, three have the flames and none has bomb_s.spr.');
    }
    const flames = BOMB_FILES.slice(4, 11).filter(b => folder.files.has(b[0])).length;
    if (flames > 0 && flames < 7) {
      say('odd', 'only ' + flames + ' of the seven flame pieces are here. ' +
        'The fire is drawn from all seven, so a partial set shows this ' +
        'skin\u2019s fire in some directions and the game\u2019s in others.');
    }
    return out.concat(folderCommonProblems());
  }

  /* a character: which of the thirty-seven the loader will not find */
  const missing = CHAR_SHEETS.filter(s => !folderFile(s.file));
  if (missing.length) {
    say('bad', missing.length + ' of the 37 are missing: ' +
      missing.map(s => s.file).join(', ') +
      '. The loader asks for every one by name.');
  }

  /* the seams a player sees, which no single file can show */
  const st = folderFile('st_s'), pv = folderFile('preview');
  if (st && pv && st.gra && pv.gra) {
    const same = st.raw.length === pv.raw.length &&
      st.raw.every((v, i) => v === pv.raw[i]);
    if (!same) {
      const f0 = folderFrameKey(st.gra, 0) === folderFrameKey(pv.gra, 0);
      say(f0 ? 'odd' : 'bad',
        'preview is not a copy of st_s' + (f0
          ? ', though frame 0 matches. Of 41 officials, 41 are an exact copy.'
          : ', and frame 0 differs too. This is the card in the room, the ' +
            'profile and the shop \u2014 it should be the stand, exactly.'));
    }
  }
  const wa = folderFile('wa');
  if (st && wa && st.gra && wa.gra) {
    if (folderFrameKey(wa.gra, 0) !== folderFrameKey(st.gra, 0)) {
      say('odd', 'wa frame 0 is not st_s frame 0. Every round ends its ' +
        'entrance on wa frame 0 and the next step draws st_s frame 0, so ' +
        'the difference shows as a jump at the start of every round.');
    }
  }

  return out.concat(folderCommonProblems());
}

function folderCommonProblems() {
  const out = [];
  const say = (level, text) => out.push({ level, text });

  if (folder.caps.length) {
    say('bad', folder.caps.length + ' file' +
      (folder.caps.length === 1 ? ' has' : 's have') + ' a capital in the ' +
      'name (' + folder.caps.slice(0, 4).join(', ') +
      (folder.caps.length > 4 ? '\u2026' : '') + '). The server runs on a ' +
      'filesystem where MO_S.GRA and mo_s.gra are different files, and the ' +
      'client asks for the lowercase one.');
  }
  const broken = [...folder.files.values()].filter(f => f.error);
  if (broken.length) {
    say('bad', broken.length + ' file' + (broken.length === 1 ? '' : 's') +
      ' will not parse: ' + broken.map(f => f.name).join(', '));
  }
  if (folder.extra.length) {
    const add = folder.extra.filter(n => /^add\./i.test(n));
    say('note', folder.extra.length + ' file' +
      (folder.extra.length === 1 ? '' : 's') + ' here the loader never asks ' +
      'for: ' + folder.extra.slice(0, 6).join(', ') +
      (folder.extra.length > 6 ? '\u2026' : '') + '.' +
      (add.length ? ' add.gra is the sleep pose of the 2003 game; this ' +
        'client has no such state and the 37-file package has no room ' +
        'for it.' : ''));
  }

  /* every sheet's own checks, rolled up: the set view should say that
     something is wrong somewhere, and where to click */
  if (folder.kind === 'character' && typeof charProblems === 'function') {
    const bad = [];
    for (const rec of folder.files.values()) {
      if (!rec.gra) continue;
      const p = charProblems(rec.name, rec.gra);
      if (p.some(x => x.level === 'bad')) bad.push(rec.name);
    }
    if (bad.length) {
      say('odd', bad.length + ' sheet' + (bad.length === 1 ? ' has' : 's have') +
        ' something the game will show wrong: ' + bad.slice(0, 8).join(', ') +
        (bad.length > 8 ? '\u2026' : '') + '. Open one to see what.');
    }
  }
  return out;
}

/* The colours the whole set uses. A character is supposed to wear one
   palette across every sheet; this does not judge that, it reports it,
   because a sheet with its own fire legitimately brings its own. */
function folderPalette() {
  const all = new Set(), per = [];
  for (const rec of folder.files.values()) {
    if (!rec.gra) continue;
    const mine = new Set();
    for (const f of rec.gra.frames) for (const r of f.runs) for (const v of r.px) {
      mine.add(v); all.add(v);
    }
    per.push({ name: rec.name, colours: mine.size, set: mine });
  }
  let only = 0;
  for (const v of all) {
    let n = 0;
    for (const p of per) if (p.set.has(v)) n++;
    if (n === 1) only++;
  }
  return { total: all.size, onlyOne: only, per };
}

/* ---------------------------- the panel -------------------------- */

/* The checks read every file in the set, so they run once when it is
   opened rather than on every redraw. Editing a sheet from here opens
   a copy, so the set does not change under them -- and when that stops
   being true, this is the line that has to move. */
function folderScan() {
  folder.report = { problems: folderProblems(), palette: folderPalette() };
}

function folderRender() {
  const dock = $('folderDock');
  if (!dock) return;
  dock.classList.toggle('on', !!folder.kind);
  if (!folder.kind) return;
  if (!folder.report) folderScan();

  const head = $('folderHead');
  const want = folder.kind === 'character' ? 37 : 12;
  if (head) {
    const pal = folder.report.palette;
    head.innerHTML = '<dl class="what">' +
      '<dt>' + folder.name + '</dt><dd>' +
      (folder.kind === 'character' ? 'a character' : 'a bomb skin') + '</dd>' +
      '<dt>files</dt><dd>' + folder.files.size + ' of ' + want + '</dd>' +
      '<dt>colours</dt><dd>' + pal.total + ' across the set, ' + pal.onlyOne +
      ' in one file only</dd></dl>';
  }

  const list = $('folderList');
  if (list) {
    const openName = sprite.entry ? sprite.entry.name.toLowerCase() : '';
    const rows = folder.kind === 'character'
      ? CHAR_SHEETS.map(s => {
          const rec = folderFile(s.file);
          return {
            label: s.file, note: s.label + (s.dir ? ' ' + s.dirName : ''),
            rec, sheet: s, want: s.need != null ? s.need : s.want
          };
        })
      : BOMB_FILES.map(([n, note]) => ({
          label: n.replace(/\.[^.]+$/, ''), note,
          rec: folder.files.get(n), sheet: null, want: null
        }));
    list.innerHTML = rows.map(r => {
      const on = r.rec && r.rec.name.toLowerCase() === openName;
      const n = r.rec && r.rec.gra ? r.rec.gra.frames.length : null;
      /* A count the game enforces has to match; one it merely prefers
         has a range the officials and the panel both live inside, and
         marking a legal seven-frame punch red would be a lie. */
      const s = r.sheet;
      const bad = n != null && s && (s.need != null
        ? n !== s.need
        : n < (s.min != null ? s.min : s.want) ||
          n > (s.max != null ? s.max : s.want));
      return '<button class="fRow' + (on ? ' sel' : '') +
        (r.rec ? '' : ' gone') + '"' +
        (r.rec ? ' data-pick="' + r.rec.name + '"' : ' disabled') + '>' +
        '<b>' + r.label + '</b><span>' + r.note + '</span>' +
        '<i class="' + (bad ? 'no' : '') + '">' +
        (r.rec ? (n == null ? 'unreadable'
          : n + (bad ? '/' + r.want : '') + (n === 1 ? ' frame' : ' frames'))
         : 'not here') + '</i></button>';
    }).join('');
    list.querySelectorAll('[data-pick]').forEach(b =>
      b.addEventListener('click', () => folderPick(b.dataset.pick)));
  }

  const checks = $('folderChecks');
  if (checks) {
    const probs = folder.report.problems;
    checks.innerHTML = probs.length
      ? probs.map(p => '<p class="note ' +
          (p.level === 'bad' ? 'bad' : p.level === 'odd' ? 'warn' : '') +
          '">' + p.text + '</p>').join('')
      : '<p class="note good">The set is complete and the files agree ' +
        'with each other.</p>';
  }
}

/* ---------------------------- the input -------------------------- */

/* A directory from the picker, a directory dragged in, or a zip: three
   ways to hand over the same thing, so they all end up here. */
async function folderFromFileList(files) {
  const arr = Array.from(files || []);
  if (!arr.length) return false;
  const entries = [];
  let label = '';
  for (const f of arr) {
    const path = f.webkitRelativePath || f.name;
    if (!label && path.includes('/')) label = path.split('/')[0];
    if (!/\.(gra|spr|eft)$/i.test(f.name)) continue;
    entries.push({ path, buf: await f.arrayBuffer() });
  }
  if (!entries.length) { notify('no sprites in that folder', 1); return false; }
  return folderOpen(label || 'folder', entries);
}

/* A zip, read here rather than pulled in. Store needs no help and
   deflate is what the browser's own DecompressionStream does, so the
   whole reader is the central directory plus one call. */
async function zipRead(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  /* find the end-of-central-directory, scanning back past any comment */
  let end = -1;
  for (let i = u8.length - 22; i >= 0 && i > u8.length - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('that is not a zip');
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const out = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('the zip index is damaged');
    const method = dv.getUint16(p + 10, true);
    const packed = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true);
    const eLen = dv.getUint16(p + 30, true);
    const cLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + eLen + cLen;
    if (name.endsWith('/')) continue;
    /* the name and extra fields are allowed to differ between the
       local header and the index, so the data starts past the local
       header's own lengths, not the index's */
    const lnLen = dv.getUint16(local + 26, true);
    const leLen = dv.getUint16(local + 28, true);
    const at = local + 30 + lnLen + leLen;
    const comp = u8.subarray(at, at + packed);
    if (method === 0) {
      out.push({ path: name, buf: comp.slice().buffer });
    } else if (method === 8) {
      const st = new Blob([comp]).stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      out.push({ path: name, buf: await new Response(st).arrayBuffer() });
    } else {
      throw new Error(name + ' uses a compression this reader does not know');
    }
  }
  return out;
}

async function folderFromZip(name, buf) {
  let entries;
  try { entries = await zipRead(buf); }
  catch (e) { notify('could not read that zip: ' + e.message, 1); return false; }
  const keep = entries.filter(e => /\.(gra|spr|eft)$/i.test(e.path));
  if (!keep.length) { notify('no sprites in that zip', 1); return false; }
  return folderOpen(name.replace(/\.zip$/i, ''), keep);
}

/* A directory dragged onto the page arrives as an entry tree rather
   than a file list, and only if it is asked for before the event is
   over -- so the caller hands over the entries it already took. */
async function folderFromEntries(items) {
  const files = [];
  const walk = (entry, path) => new Promise(res => {
    if (entry.isFile) {
      entry.file(f => { files.push({ f, path: path + f.name }); res(); }, res);
    } else if (entry.isDirectory) {
      const rd = entry.createReader();
      const all = [];
      const step = () => rd.readEntries(async es => {
        if (!es.length) {
          await Promise.all(all.map(e => walk(e, path + entry.name + '/')));
          res();
          return;
        }
        all.push(...es);
        step();
      }, res);
      step();
    } else res();
  });
  await Promise.all(items.map(e => walk(e, '')));
  const entries = [];
  let label = '';
  for (const { f, path } of files) {
    if (!label && path.includes('/')) label = path.split('/')[0];
    if (!/\.(gra|spr|eft)$/i.test(f.name)) continue;
    entries.push({ path, buf: await f.arrayBuffer() });
  }
  if (!entries.length) return false;
  return folderOpen(label || 'folder', entries);
}

function folderWire() {
  const inp = $('dirFile');
  if (inp) inp.addEventListener('change', async e => {
    await folderFromFileList(e.target.files);
    e.target.value = '';
  });
  const b = $('bOpenFolder');
  if (b) b.addEventListener('click', () => {
    const i = $('dirFile');
    if (i) i.click();
  });
  const c = $('bFolderClose');
  if (c) c.addEventListener('click', () => { folderClose(); folderRender(); });
}
