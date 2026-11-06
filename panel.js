/* What is left of the floating windows: the arranging, the clamping
   and the wheel zoom.

   There were three -- the shelf, the frame tools and the model panel.
   The first two are a dock and a grid column now, because a thing
   that is always wanted should not be laid over another thing that is
   always wanted, and the complaint that windows covered buttons was
   always going to be true of a window. The model panel still floats,
   and still has to be kept on screen: a panel dragged past the edge,
   or left there when the browser window got smaller, is a panel you
   cannot get back. */

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
