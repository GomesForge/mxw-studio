/* A floating window: dragged by its head, resized by its grip, kept
   on screen, and remembered where it was put.

   There are two of these now -- the shelf and the frame tools -- and
   a third would be the moment somebody fixed a bug in one copy and
   not the other. The behaviour that has to be identical is the part
   nobody notices: a window dragged past the edge, or left there when
   the browser window got smaller, is a window you cannot get back. */

/* The area a floating window is allowed to live in: the viewport, not
   the browser window. Everything outside it is a bar, a rail, a panel
   or a status line -- things with buttons on them, which a window
   that floats over them hides. */
function panelArea() {
  const view = $('view');
  if (!view) return { left: 4, top: 4, right: innerWidth - 4,
                      bottom: innerHeight - 4 };
  const r = view.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function panelClamp(pos, min) {
  min = min || {};
  const a = panelArea();
  const aw = Math.max(120, a.right - a.left), ah = Math.max(120, a.bottom - a.top);
  pos.w = Math.max(min.w || 200, Math.min(min.W || 720, Math.min(pos.w, aw)));
  pos.h = Math.max(min.h || 140, Math.min(pos.h, ah));
  /* fully inside, not merely touching: a window whose title bar is
     under the action bar cannot be dragged back out */
  pos.x = Math.round(Math.max(a.left, Math.min(a.right - pos.w, pos.x)));
  pos.y = Math.round(Math.max(a.top, Math.min(a.bottom - pos.h, pos.y)));
  return pos;
}

/* Every floating window registers itself, so they can be laid out
   against each other rather than each one against the viewport. */
const PANELS = [];

function panelRegister(p) {
  PANELS.push(p);
  return p;
}

/* Lay out the open windows so they do not cover each other.

   Each one belongs to a side of the viewport and a place in that
   side's column. Windows on the same side stack down it, and if the
   column is taller than the viewport they share the height. Nothing
   is ever placed outside, so nothing is ever over the action bar, the
   tabs, the tool rail, the side panel or the status line -- those are
   all outside the viewport, and the viewport is all these windows
   get.

   A window that has been dragged keeps where it was put. Moving
   somebody's window because another one opened is its own kind of
   rude, so only the ones still in their automatic places are
   arranged; a dragged one is merely kept on screen. */
function panelArrange() {
  const a = panelArea();
  const pad = 8, gap = 10;
  const live = PANELS.filter(p => p.isOpen() && !p.pos.moved)
    .sort((x, y) => (x.order || 0) - (y.order || 0));
  if (!live.length) return;

  for (const side of ['left', 'right']) {
    const col = live.filter(p => (p.side || 'left') === side);
    if (!col.length) continue;
    const room = (a.bottom - a.top) - pad * 2 - gap * (col.length - 1);
    const want = col.reduce((n, p) => n + p.pos.h, 0);
    const scale = want > room ? room / want : 1;
    let y = a.top + pad;
    for (const p of col) {
      const min = p.min || {};
      if (scale < 1)
        p.pos.h = Math.max(min.h || 140, Math.floor(p.pos.h * scale));
      p.pos.w = Math.min(p.pos.w, (a.right - a.left) - pad * 2);
      p.pos.x = Math.round(side === 'right'
        ? a.right - p.pos.w - pad : a.left + pad);
      p.pos.y = Math.round(y);
      panelClamp(p.pos, min);
      /* clamping may have pushed it back; the side still decides x */
      p.pos.x = Math.round(side === 'right'
        ? Math.max(a.left, a.right - p.pos.w - pad) : a.left + pad);
      panelApply(p.el, p.pos);
      y = p.pos.y + p.pos.h + gap;
    }
  }
}


function panelApply(el, pos) {
  if (!el) return;
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.style.width = pos.w + 'px';
  el.style.height = pos.h + 'px';
}

/* The corner of the work area, which is where a panel that has never
   been placed belongs: the viewport is what it floats over, not the
   browser window, and the bars above it move with the layout. */
function panelCorner(side, w, h, inset) {
  const view = $('view');
  const r = view ? view.getBoundingClientRect()
                 : { left: 0, top: 64, right: innerWidth, bottom: innerHeight };
  const i = inset === undefined ? 8 : inset;
  return {
    x: Math.round(side === 'right' ? r.right - w - i : r.left + i),
    y: Math.round(r.top + i),
    w: w,
    h: Math.min(h, Math.max(200, Math.round(r.bottom - r.top) - i * 2))
  };
}

/* opts: {el, head, grip, pos, min, onDone} -- pos is mutated in place,
   onDone is called when a drag or a resize finishes. */
function panelWindow(opts) {
  const el = opts.el, head = opts.head, pos = opts.pos;
  if (!el || !head) return;
  const done = () => { if (opts.onDone) opts.onDone(); };

  let from = null;
  head.addEventListener('mousedown', ev => {
    if (ev.target.closest('button')) return;
    from = { x: ev.clientX, y: ev.clientY, ox: pos.x, oy: pos.y };
    ev.preventDefault();
  });
  addEventListener('mousemove', ev => {
    if (!from) return;
    pos.x = from.ox + (ev.clientX - from.x);
    pos.y = from.oy + (ev.clientY - from.y);
    panelClamp(pos, opts.min);
    panelApply(el, pos);
  });
  addEventListener('mouseup', () => {
    if (!from) return;
    from = null;
    pos.moved = true;      /* put here on purpose; leave it alone */
    done();
  });

  /* the corner grip: the same gesture, against the size */
  let size = null;
  if (opts.grip) {
    opts.grip.addEventListener('mousedown', ev => {
      size = { x: ev.clientX, y: ev.clientY, w: pos.w, h: pos.h };
      ev.preventDefault();
      ev.stopPropagation();
    });
    addEventListener('mousemove', ev => {
      if (!size) return;
      pos.w = size.w + (ev.clientX - size.x);
      pos.h = size.h + (ev.clientY - size.y);
      panelClamp(pos, opts.min);
      panelApply(el, pos);
    });
    addEventListener('mouseup', () => {
      if (!size) return;
      size = null;
      pos.moved = true;
      done();
    });
  }

  panelRegister({
    el: el, pos: pos, min: opts.min, order: opts.order || 0,
    side: opts.side || 'left',
    isOpen: () => !el.hidden
  });

  addEventListener('resize', () => {
    if (el.hidden) return;
    panelClamp(pos, opts.min);
    panelApply(el, pos);
    panelArrange();
  });
}

/* ------------------------- the wheel, as zoom -------------------- */

/* On a flat view the wheel zooms, which is what every drawing program
   does and what a hand expects. The 3D viewport is left alone: there
   the wheel already means dolly, and taking it over would break the
   one view where it was already doing something.

   The point under the cursor stays under the cursor. Without that,
   zooming into a 256-pixel sheet walks the thing you were looking at
   off the edge, and you spend the zoom scrolling back.

   wrap is the scrolling box, get/set read and write the zoom. */

/* ------------------------- the wheel, as zoom -------------------- */

/* On a flat view the wheel zooms, which is what every drawing program
   does and what a hand expects. The 3D viewport is left alone: there
   the wheel already means dolly, and taking it over would break the
   one view where it was already doing something.

   The point under the cursor stays under the cursor. Without that,
   zooming into a 256-pixel sheet walks the thing you were looking at
   off the edge, and you spend the zoom scrolling back.

   wrap is the scrolling box, get/set read and write the zoom. */
function panelWheelZoom(wrap, get, set, lo, hi) {
  if (!wrap) return;
  wrap.addEventListener('wheel', ev => {
    if (!ev.deltaY) return;
    const was = get();
    const now = Math.max(lo, Math.min(hi, was + (ev.deltaY < 0 ? 1 : -1)));
    if (now === was) { ev.preventDefault(); return; }
    ev.preventDefault();

    /* where the cursor is over the content, in content units */
    const r = wrap.getBoundingClientRect();
    const cx = (wrap.scrollLeft + ev.clientX - r.left) / was;
    const cy = (wrap.scrollTop + ev.clientY - r.top) / was;
    set(now);
    /* after the redraw the box is a different size; put that same
       point back under the cursor */
    wrap.scrollLeft = cx * now - (ev.clientX - r.left);
    wrap.scrollTop = cy * now - (ev.clientY - r.top);
  }, { passive: false });
}
