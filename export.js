/* The export desk: one place that knows every way out of this editor.

   Exports had grown the way exports do -- a button per destination,
   each with its own idea of what "the file" means, and none of them
   able to produce two things at once. For somebody modding, that is
   the wrong shape. The work is rarely "give me this frame as a PNG";
   it is "give me this sheet, its frames, a contact sheet and the
   numbers, in a folder I can hand to somebody."

   So this is a catalogue instead. Everything that can come out of
   whatever is open is listed with what it is, you tick what you want,
   and one file comes out if you ticked one and a zip if you ticked
   several. Nothing here is a new format: it is the writers that
   already exist, finally reachable together.

   The zip is written here rather than pulled in, because store-only
   is forty lines and a dependency is forever. No compression: a zip
   of PNGs would not shrink anyway, and every tool on earth reads a
   stored entry. */

/* ============================== the zip =========================== */

const ZIP_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function zipCRC32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = ZIP_CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* MS-DOS packed date and time, which is what a zip carries. Before
   1980 it cannot say, so clamp rather than write a negative year. */
function zipStamp(d) {
  const y = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

/* entries: [{name, data: Uint8Array}] -> Uint8Array */
function zipBuild(entries) {
  const enc = new TextEncoder();
  const now = zipStamp(new Date());
  const parts = [], central = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = e.data;
    const crc = zipCRC32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);      /* bit 11: the name is UTF-8 */
    lv.setUint16(8, 0, true);           /* stored */
    lv.setUint16(10, now.time, true);
    lv.setUint16(12, now.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, now.time, true);
    cv.setUint16(14, now.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  const cenSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);

  const all = parts.concat(central, [end]);
  const total = all.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

/* ========================== pixels, with options ================== */

const xp = {
  scale: 1,
  trim: false,
  guides: false,
  cols: 0,            /* 0 = as many as there are frames */
  clock: false,       /* GIF at the game's timing rather than the slider */
  sheetDir: true      /* put a sheet's files in a folder inside the zip */
};

/* Every frame as RGBA, with the one being painted taken from the
   canvas rather than from the stored frame -- what is on screen is
   what somebody means by "this frame". */
function xpFrames(g, entry) {
  const out = g.frames.map(f => spriteFrameRGBA(g, f));
  if (typeof paint !== 'undefined' && paint.open && paint.owner &&
      paint.owner.kind === 'frame' && paint.owner.entry === entry) {
    const i = paint.owner.frame;
    const cv = paintComposite();
    if (i >= 0 && i < out.length && cv.width === g.width && cv.height === g.height)
      out[i] = cv.getContext('2d').getImageData(0, 0, g.width, g.height).data;
  }
  return out;
}

/* The box every frame together occupies, or the whole sheet. */
function xpBox(frames, w, h) {
  if (!xp.trim) return { x: 0, y: 0, w, h };
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (const px of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] >= 128) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  if (x1 < x0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* One frame onto a canvas, cropped, scaled and optionally with the
   character guides drawn on top. The guides are drawn at sheet
   coordinates, so they only make sense on an untrimmed sheet. */
function xpCanvas(rgba, w, h, box) {
  const s = Math.max(1, xp.scale | 0);
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  src.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);

  const cv = document.createElement('canvas');
  cv.width = box.w * s; cv.height = box.h * s;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, cv.width, cv.height);
  if (xp.guides && !xp.trim && typeof charPaint === 'function')
    charPaint(ctx, s, w, h);
  return cv;
}

function xpPNG(cv) {
  return new Promise(res => cv.toBlob(b => b.arrayBuffer()
    .then(ab => res(new Uint8Array(ab))), 'image/png'));
}

function xpScaleFrames(frames, w, h) {
  const s = Math.max(1, xp.scale | 0);
  if (s === 1) return { frames, w, h };
  const out = frames.map(px => {
    const big = new Uint8ClampedArray(w * s * h * s * 4);
    for (let y = 0; y < h * s; y++) {
      const sy = (y / s) | 0;
      for (let x = 0; x < w * s; x++) {
        const a = (sy * w + ((x / s) | 0)) * 4, b = (y * w * s + x) * 4;
        big[b] = px[a]; big[b + 1] = px[a + 1];
        big[b + 2] = px[a + 2]; big[b + 3] = px[a + 3];
      }
    }
    return big;
  });
  return { frames: out, w: w * s, h: h * s };
}

function xpCrop(frames, w, h, box) {
  if (box.x === 0 && box.y === 0 && box.w === w && box.h === h) return frames;
  return frames.map(px => {
    const out = new Uint8ClampedArray(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) {
      const src = ((y + box.y) * w + box.x) * 4;
      out.set(px.subarray(src, src + box.w * 4), y * box.w * 4);
    }
    return out;
  });
}

/* ============================ the outputs ========================= */

const xpBase = n => String(n || 'file').replace(/\.[^.]+$/, '');

/* What can come out of the open sprite. Each entry makes its own
   files, so a zip is just the concatenation of the ticked ones. */
function xpSpriteOutputs() {
  const e = sprite.entry;
  if (!e) return [];
  const g = e.gra, base = xpBase(e.name);
  const dir = xp.sheetDir ? base + '/' : '';
  const isEft = !!g.eft;
  const sheet = typeof charSheetOf === 'function' ? charSheetOf(e.name) : null;
  const out = [];

  out.push({
    id: 'self', on: true,
    label: 'The sprite itself',
    note: g.frames.length + ' frames, ' + g.width + ' x ' + g.height +
      (isEft ? ', an effect' : ''),
    make: async () => [{ name: dir + e.name, data: spriteBytes(e) }]
  });

  if (!isEft) {
    out.push({
      id: 'twin', on: false,
      label: 'The same bytes as .' + (/\.spr$/i.test(e.name) ? 'gra' : 'spr'),
      note: 'one format, two extensions \u2014 the loader asks for the ' +
            'name the folder uses',
      make: async () => [{
        name: dir + base + (/\.spr$/i.test(e.name) ? '.gra' : '.spr'),
        data: spriteBytes(e)
      }]
    });
  }

  out.push({
    id: 'frames', on: false,
    label: 'Every frame, one PNG each',
    note: g.frames.length + ' files',
    make: async () => {
      const f = xpFrames(g, e), box = xpBox(f, g.width, g.height);
      const files = [];
      for (let i = 0; i < f.length; i++) {
        files.push({
          name: dir + base + '_' + String(i + 1).padStart(2, '0') + '.png',
          data: await xpPNG(xpCanvas(f[i], g.width, g.height, box))
        });
      }
      return files;
    }
  });

  out.push({
    id: 'strip', on: false,
    label: 'One strip, every frame side by side',
    note: 'drop it back in and it is sliced across the frames again',
    make: async () => {
      const f = xpFrames(g, e), box = xpBox(f, g.width, g.height);
      const s = Math.max(1, xp.scale | 0);
      const cv = document.createElement('canvas');
      cv.width = box.w * s * f.length;
      cv.height = box.h * s;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      f.forEach((px, i) =>
        ctx.drawImage(xpCanvas(px, g.width, g.height, box), i * box.w * s, 0));
      return [{ name: dir + base + '_strip.png', data: await xpPNG(cv) }];
    }
  });

  out.push({
    id: 'sheet', on: false,
    label: 'A contact sheet',
    note: 'every frame on a grid, numbered \u2014 for looking at, not for ' +
          'importing back',
    make: async () => {
      const f = xpFrames(g, e), box = xpBox(f, g.width, g.height);
      const s = Math.max(1, xp.scale | 0);
      const cols = xp.cols > 0 ? xp.cols : Math.ceil(Math.sqrt(f.length));
      const rows = Math.ceil(f.length / cols);
      const cw = box.w * s, ch = box.h * s, lab = 14;
      const cv = document.createElement('canvas');
      cv.width = cols * cw; cv.height = rows * (ch + lab);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '10px ui-monospace, monospace';
      ctx.textBaseline = 'top';
      f.forEach((px, i) => {
        const x = (i % cols) * cw, y = ((i / cols) | 0) * (ch + lab);
        ctx.drawImage(xpCanvas(px, g.width, g.height, box), x, y);
        ctx.fillStyle = '#8aa0c0';
        ctx.fillText(String(i + 1), x + 3, y + ch + 2);
      });
      return [{ name: dir + base + '_contact.png', data: await xpPNG(cv) }];
    }
  });

  if (g.frames.length > 1) {
    const ms = sheet && typeof charTiming === 'function'
      ? charTiming(sheet.anim, g.frames.length) : null;
    out.push({
      id: 'gif', on: false,
      label: 'The animation as a GIF',
      note: xp.clock && ms
        ? 'at the game\u2019s own timing: ' + ms.reduce((a, b) => a + b, 0) + ' ms a round'
        : 'at ' + sprite.fps + ' fps, the speed on the slider',
      make: async () => {
        const f = xpFrames(g, e), box = xpBox(f, g.width, g.height);
        const cut = xpCrop(f, g.width, g.height, box);
        const big = xpScaleFrames(cut, box.w, box.h);
        const opts = (xp.clock && ms)
          ? { delays: ms } : { delayMs: Math.round(1000 / sprite.fps) };
        return [{
          name: dir + base + '.gif',
          data: encodeAnimatedGIF(big.frames, big.w, big.h, opts)
        }];
      }
    });
  }

  /* An effect is eight alpha layers a frame, and the raw layers are
     not what anybody sees. Exporting only those would be exporting the
     working material and calling it the picture. */
  if (isEft && typeof eftCompositeRGBA === 'function') {
    const per = g.eft.per || Math.floor(g.frames.length / 8);
    out.push({
      id: 'eftpng', on: false,
      label: 'Composited, one PNG per frame',
      note: per + ' frames, the eight layers together \u2014 what a player sees',
      make: async () => {
        const files = [];
        for (let f = 0; f < per; f++) {
          const px = eftCompositeRGBA(g, f, xpEftTable(), xpEftBg());
          const cv = xpCanvas(px, g.width, g.height,
            { x: 0, y: 0, w: g.width, h: g.height });
          files.push({
            name: dir + base + '_comp_' + String(f + 1).padStart(2, '0') + '.png',
            data: await xpPNG(cv)
          });
        }
        return files;
      }
    });
    if (per > 1) {
      out.push({
        id: 'eftgif', on: false,
        label: 'Composited, as a GIF',
        note: 'the effect playing, the way the game draws it',
        make: async () => {
          const frames = [];
          for (let f = 0; f < per; f++)
            frames.push(eftCompositeRGBA(g, f, xpEftTable(), xpEftBg()));
          const big = xpScaleFrames(frames, g.width, g.height);
          return [{
            name: dir + base + '_comp.gif',
            data: encodeAnimatedGIF(big.frames, big.w, big.h,
              { delayMs: Math.round(1000 / sprite.fps) })
          }];
        }
      });
    }
  }

  out.push({
    id: 'json', on: false,
    label: 'The numbers, as JSON',
    note: 'size, frames, the slot it is, the clock, and every frame ' +
          'measured \u2014 for a script to read',
    make: async () => [{
      name: dir + base + '.json',
      data: new TextEncoder().encode(xpSpriteJSON(e))
    }]
  });

  return out;
}

/* The effect view's own choices, so what comes out matches what is on
   screen rather than a second opinion about it. */
function xpEftTable() {
  const s = $('eftTable');
  return (s && s.value) || 'std';
}

/* Only what the layers blend against: the PNG is transparent wherever
   no layer landed either way, so "nothing" and "dark" differ only at
   the edges of a stroke. */
function xpEftBg() {
  const s = $('eftBg');
  return (s && s.value) === 'light' ? 0xffff : 0x0000;
}

function xpSpriteJSON(e) {
  const g = e.gra;
  const sheet = typeof charSheetOf === 'function' ? charSheetOf(e.name) : null;
  const doc = {
    file: e.name,
    kind: g.eft ? 'effect' : 'sprite',
    width: g.width, height: g.height,
    frames: g.frames.length,
    pixelsPerFrame: g.frames.map(f => f.pixelCount),
    colours: null
  };
  const seen = new Set();
  for (const f of g.frames) for (const r of f.runs) for (const v of r.px) seen.add(v);
  doc.colours = seen.size;

  if (g.eft) doc.effect = { layersPerFrame: 8, blocks: g.frames.length };

  if (sheet) {
    doc.sheet = {
      slot: sheet.slot, animation: sheet.anim, facing: sheet.dir,
      shows: sheet.label, expectedFrames: sheet.need != null ? sheet.need : sheet.want
    };
    const ms = charTiming(sheet.anim, g.frames.length);
    doc.clock = ms
      ? { perFrameMs: ms, totalMs: ms.reduce((a, b) => a + b, 0),
          loops: charLoops(sheet.anim) }
      : { static: true };
  }
  if (typeof charMeasure === 'function' && g.width === 256 && g.height === 256) {
    doc.guides = { axisX: 128, soleY: 195,
                   safeArea: [80, 88, 176, 216] };
    doc.measured = g.frames.map((f, i) => {
      const m = charMeasure(g, f);
      return m.empty ? { frame: i + 1, empty: true } : {
        frame: i + 1, sole: m.sole, top: m.top, centreX: m.cx,
        footX: m.foot, width: m.w, height: m.h
      };
    });
  }
  if (typeof charProblems === 'function')
    doc.problems = charProblems(e.name, g).map(p => ({ level: p.level, say: p.text }));
  return JSON.stringify(doc, null, 2);
}

function xpMeshOutputs() {
  const c = current;
  if (!c) return [];
  const base = xpBase(c.name);
  const dir = xp.sheetDir ? base + '/' : '';
  const m = c.mxw.meshes[c.meshIndex || 0];
  const out = [];

  out.push({
    id: 'bin', on: true,
    label: 'The container itself',
    note: c.mxw.meshes.length + ' mesh(es), ' + c.mxw.gifs.length + ' texture(s)',
    make: async () => [{ name: dir + c.name, data: c.mxw.write() }]
  });

  if (m) {
    out.push({
      id: 'obj', on: false,
      label: 'The geometry as .obj',
      note: m.nv + ' vertices, ' + m.faces.length + ' faces \u2014 opens in ' +
            'any modeller, and comes back in',
      make: async () => [{
        name: dir + base + '.obj',
        data: new TextEncoder().encode(objTextOf(c))
      }]
    });
  }

  if (c.mxw.gifs.length) {
    out.push({
      id: 'tex', on: false,
      label: 'Every texture',
      note: c.mxw.gifs.length + ' file(s), exactly the bytes the container holds',
      make: async () => c.mxw.gifs.map((gif, i) => ({
        name: dir + base + '_tex' + i + '.gif',
        data: gif.data || gif
      }))
    });
  }

  const uv = $('uv');
  if (uv && uv.style.display !== 'none' && uv.width) {
    out.push({
      id: 'uv', on: false,
      label: 'The UV layout, as a PNG',
      note: 'texture ' + selectedTex + ', the layout drawn over it \u2014 ' +
            'the guide for painting a garment in the right place',
      make: async () => [{
        name: dir + base + '_uv_tex' + selectedTex + '.png',
        data: await xpPNG(uv)
      }]
    });
  }

  out.push({
    id: 'meshjson', on: false,
    label: 'The numbers, as JSON',
    note: 'meshes, vertices, faces, bones, textures and the material bindings',
    make: async () => [{
      name: dir + base + '.json',
      data: new TextEncoder().encode(JSON.stringify({
        file: c.name,
        meshId: c.mxw.meshId,
        meshes: c.mxw.meshes.map(x => ({
          kind: x.kind, vertices: x.nv, faces: x.faces.length,
          bones: x.bones.length, textures: x.textures,
          materials: x.materials.map(mm => ({ name: mm.name, texture: mm.tex }))
        })),
        textures: c.mxw.gifs.length
      }, null, 2))
    }]
  });

  return out;
}

function xpMapOutputs() {
  if (typeof map === 'undefined' || !map || (!map.blocks && !map.doc)) return [];
  const out = [];
  if (map.doc) {
    out.push({
      id: 'mapjson', on: true,
      label: 'The custom map, as the panel takes it',
      note: map.doc.screens.length + ' screens',
      make: async () => [{
        name: (map.doc.name || 'map').replace(/[^\w-]+/g, '_') + '.json',
        data: new TextEncoder().encode(mapCustomJSON())
      }]
    });
  }
  if (map.blocks) {
    out.push({
      id: 'blockspr', on: true,
      label: 'block.spr',
      note: '46 sets x 100 variants, written back byte for byte',
      make: async () => [{ name: 'block.spr', data: map.blocks }]
    });
    out.push({
      id: 'blockjson', on: false,
      label: 'This set, as JSON',
      note: 'set ' + map.set + ': every distinct variant as a row of ' +
            'digits, 0 floor, 1 soft, 2 pillar, 9 wall',
      make: async () => [{
        name: 'set_' + String(map.set).padStart(2, '0') + '.json',
        data: new TextEncoder().encode(xpSetJSON())
      }]
    });
  }
  if (map.records) {
    /* No map.spr here: the editor parses it and keeps the records, not
       the bytes, because it has never had a reason to write one back. */
    out.push({
      id: 'mapsprjson', on: false,
      label: 'What map.spr says, as JSON',
      note: 'the spawns, the gimmicks and the item counts, every set',
      make: async () => [{
        name: 'map_records.json',
        data: new TextEncoder().encode(JSON.stringify(map.records, null, 2))
      }]
    });
  }
  const board = $('mapView');
  if (board && board.width) {
    out.push({
      id: 'boardpng', on: false,
      label: 'The board on screen, as a PNG',
      note: map.kind === 'custom'
        ? 'screen ' + (map.screen + 1) + ' of ' + map.doc.screens.length
        : 'set ' + map.set + ', variant ' + (map.variant + 1),
      make: async () => [{
        name: (map.kind === 'custom'
          ? 'screen_' + (map.screen + 1)
          : 'set' + map.set + '_var' + String(map.variant + 1).padStart(3, '0')) +
          '.png',
        data: await xpPNG(board)
      }]
    });
  }
  return out;
}

/* One set's hundred variants, deduplicated: sixteen of the forty-six
   repeat a single layout a hundred times, and a hundred copies of the
   same row helps nobody. */
function xpSetJSON() {
  const rows = [], seen = new Map();
  for (let v = 0; v < MAP_VARIANTS; v++) {
    const g = mapLayout(map.set * MAP_VARIANTS + v);
    const s = Array.from(g).join('');
    if (!seen.has(s)) { seen.set(s, rows.length); rows.push({ first: v, layout: [] }); }
    const row = rows[seen.get(s)];
    if (row.layout.length === 0)
      for (let y = 0; y < MAP_H; y++)
        row.layout.push(s.slice(y * MAP_W, (y + 1) * MAP_W));
    row.count = (row.count || 0) + 1;
  }
  return JSON.stringify({
    set: map.set, variants: MAP_VARIANTS, distinct: rows.length,
    width: MAP_W, height: MAP_H,
    legend: { 0: 'floor', 1: 'breaks', 2: 'pillar', 9: 'wall' },
    layouts: rows
  }, null, 2);
}

/* A set is the unit somebody actually sends: thirty-seven files that
   only mean something together, or the handful a bomb skin ships. */
function xpFolderOutputs() {
  if (typeof folder === 'undefined' || !folder.kind || !folder.files.size)
    return [];
  const dir = folder.name.replace(/[^\w.-]+/g, '_') + '/';
  return [{
    id: 'setfiles', on: true,
    label: 'Every file in the set',
    note: folder.files.size + ' file(s), exactly as they were opened',
    make: async () => [...folder.files.values()].map(f => ({
      name: dir + f.name, data: f.raw
    }))
  }, {
    id: 'setjson', on: false,
    label: 'What the set is, as JSON',
    note: 'which slots are filled, the frame counts, and what the ' +
          'cross-file checks found',
    make: async () => [{
      name: dir + 'set.json',
      data: new TextEncoder().encode(xpFolderJSON())
    }]
  }];
}

function xpFolderJSON() {
  const slots = folder.kind === 'character'
    ? CHAR_SHEETS.map(s => {
        const rec = folderFile(s.file);
        return {
          slot: s.slot, file: s.file, shows: s.label, facing: s.dir,
          present: !!rec,
          frames: rec && rec.gra ? rec.gra.frames.length : null,
          expected: s.need != null ? s.need : s.want
        };
      })
    : BOMB_FILES.map(([n, note]) => ({
        file: n, is: note, present: folder.files.has(n),
        frames: folder.files.has(n) && folder.files.get(n).gra
          ? folder.files.get(n).gra.frames.length : null
      }));
  return JSON.stringify({
    name: folder.name, kind: folder.kind,
    files: folder.files.size,
    of: folder.kind === 'character' ? 37 : 12,
    slots,
    extra: folder.extra,
    uppercase: folder.caps,
    colours: folder.report ? folder.report.palette.total : null,
    findings: (folder.report ? folder.report.problems : [])
      .map(p => ({ level: p.level, say: p.text }))
  }, null, 2);
}

function xpOutputs() {
  const groups = [];
  const fo = xpFolderOutputs();
  if (fo.length) groups.push({ title: 'The whole set', items: fo });
  const sp = xpSpriteOutputs();
  if (sp.length) groups.push({ title: 'This sprite', items: sp });
  const me = xpMeshOutputs();
  if (me.length) groups.push({ title: 'This model', items: me });
  const mp = xpMapOutputs();
  if (mp.length) groups.push({ title: 'This map', items: mp });

  /* every other container that is open, which only makes sense as a
     zip and so is one tick rather than a list */
  const others = loaded.filter(x => x !== current);
  if (others.length) {
    groups.push({
      title: 'Also open', items: [{
        id: 'others', on: false,
        label: others.length + ' other file' + (others.length === 1 ? '' : 's'),
        note: others.map(x => x.name).join(', ').slice(0, 90),
        make: async () => others.map(x => ({ name: x.name, data: x.mxw.write() }))
      }]
    });
  }
  return groups;
}

/* ============================== the desk ========================== */

function xpOpen() {
  const groups = xpOutputs();
  const body = $('xpBody');
  if (!body) return;
  if (!groups.length) {
    notify('nothing is open to export', 1);
    return;
  }
  xp.groups = groups;
  body.innerHTML = groups.map(gr =>
    '<h4>' + gr.title + '</h4>' + gr.items.map(it =>
      '<label class="setRow xpItem"><span class="setControl">' +
      '<input type="checkbox" data-out="' + it.id + '"' +
      (it.on ? ' checked' : '') + '></span>' +
      '<span class="setLabel"><b>' + it.label + '</b>' +
      '<span>' + it.note + '</span></span></label>').join('')
  ).join('') + xpOptionsHTML();
  $('xp').hidden = false;
  xpWireBody();
  xpCount();
}

function xpOptionsHTML() {
  const sp = !!sprite.entry;
  return '<h4>How</h4>' +
    (sp ? '<div class="setRow"><span class="setLabel"><b>Scale</b>' +
      '<span>nearest neighbour, so a pixel stays a square</span></span>' +
      '<span class="setControl setChoice" id="xpScale">' +
      [1, 2, 4, 8].map(s => '<button data-scale="' + s + '"' +
        (xp.scale === s ? ' class="on"' : '') + '>' + s + 'x</button>').join('') +
      '</span></div>' +
      '<label class="setRow"><span class="setControl">' +
      '<input type="checkbox" id="xpTrim"' + (xp.trim ? ' checked' : '') +
      '></span><span class="setLabel"><b>Crop to the drawing</b>' +
      '<span>the box every frame together fills, instead of the whole ' +
      'sheet. Leave it off to keep the sheet\u2019s own coordinates</span>' +
      '</span></label>' +
      '<label class="setRow"><span class="setControl">' +
      '<input type="checkbox" id="xpGuides"' + (xp.guides ? ' checked' : '') +
      '></span><span class="setLabel"><b>Draw the guides on</b>' +
      '<span>for a reference image, never for a sheet you will import ' +
      'back. Needs the full sheet</span></span></label>' +
      '<label class="setRow"><span class="setControl">' +
      '<input type="checkbox" id="xpClock"' + (xp.clock ? ' checked' : '') +
      '></span><span class="setLabel"><b>GIF at the game\u2019s timing</b>' +
      '<span>rather than the speed on the slider</span></span></label>' +
      '<div class="setRow"><span class="setLabel"><b>Contact sheet columns</b>' +
      '<span>0 keeps it square</span></span><span class="setControl">' +
      '<input type="number" id="xpCols" min="0" max="32" value="' + xp.cols +
      '" style="width:64px"></span></div>' : '') +
    '<label class="setRow"><span class="setControl">' +
    '<input type="checkbox" id="xpDir"' + (xp.sheetDir ? ' checked' : '') +
    '></span><span class="setLabel"><b>A folder per file, inside the zip</b>' +
    '<span>off puts everything at the top level</span></span></label>';
}

function xpWireBody() {
  const body = $('xpBody');
  body.querySelectorAll('[data-out]').forEach(cb =>
    cb.addEventListener('change', xpCount));
  const sc = $('xpScale');
  if (sc) sc.addEventListener('click', ev => {
    const b = ev.target.closest('[data-scale]');
    if (!b) return;
    xp.scale = +b.dataset.scale;
    sc.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
  const flag = (id, key) => {
    const el = $(id);
    if (el) el.addEventListener('change', () => { xp[key] = el.checked; xpCount(); });
  };
  flag('xpTrim', 'trim'); flag('xpGuides', 'guides');
  flag('xpClock', 'clock'); flag('xpDir', 'sheetDir');
  const c = $('xpCols');
  if (c) c.addEventListener('change', () => { xp.cols = Math.max(0, +c.value || 0); });
}

function xpPicked() {
  const on = new Set();
  $('xpBody').querySelectorAll('[data-out]:checked')
    .forEach(cb => on.add(cb.dataset.out));
  const items = [];
  for (const gr of (xp.groups || []))
    for (const it of gr.items) if (on.has(it.id)) items.push(it);
  return items;
}

function xpCount() {
  const n = xpPicked().length;
  const b = $('xpGo');
  if (!b) return;
  b.disabled = n === 0;
  b.textContent = n === 0 ? 'Nothing ticked'
    : n === 1 ? 'Export' : 'Export ' + n + ' as a .zip';
}

function xpClose() { const el = $('xp'); if (el) el.hidden = true; }

async function xpRun() {
  const picked = xpPicked();
  if (!picked.length) return;
  const go = $('xpGo');
  go.disabled = true;
  const was = go.textContent;
  go.textContent = 'Working\u2026';
  let files = [];
  try {
    for (const it of picked) files = files.concat(await it.make());
  } catch (err) {
    go.disabled = false; go.textContent = was;
    notify('export failed: ' + (err && err.message || err), 1);
    return;
  }
  go.textContent = was;
  go.disabled = false;
  if (!files.length) { notify('that produced nothing', 1); return; }

  if (files.length === 1) {
    const f = files[0];
    xpClose();
    saveFile(f.name.replace(/^.*\//, ''), f.data, xpMime(f.name));
    return;
  }
  /* A zip keeps the names, and the names are the point: a folder of
     frames is only useful if they are still numbered in order. */
  const name = (typeof folder !== 'undefined' && folder.kind
    ? folder.name.replace(/[^\w.-]+/g, '_')
    : xpBase(sprite.entry ? sprite.entry.name
      : current ? current.name : 'export')) + '.zip';
  const zip = zipBuild(files);
  xpClose();
  saveFile(name, zip, 'application/zip');
  notify(files.length + ' files, ' + (zip.length / 1024).toFixed(0) + ' KB');
}

function xpMime(name) {
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.gif$/i.test(name)) return 'image/gif';
  if (/\.json$/i.test(name)) return 'application/json';
  if (/\.obj$/i.test(name)) return 'text/plain';
  return 'application/octet-stream';
}

function xpWire() {
  const b = $('bExportAll');
  if (b) b.addEventListener('click', xpOpen);
  const x = $('xpX');
  if (x) x.addEventListener('click', xpClose);
  const go = $('xpGo');
  if (go) go.addEventListener('click', xpRun);
  const wrap = $('xp');
  if (wrap) wrap.addEventListener('mousedown', ev => {
    if (ev.target === wrap) xpClose();
  });
  addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && wrap && !wrap.hidden) xpClose();
  });
}
