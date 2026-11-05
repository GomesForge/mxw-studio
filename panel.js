/* A floating window: dragged by its head, resized by its grip, kept
   on screen, and remembered where it was put.

   There are two of these now -- the shelf and the frame tools -- and
   a third would be the moment somebody fixed a bug in one copy and
   not the other. The behaviour that has to be identical is the part
   nobody notices: a window dragged past the edge, or left there when
   the browser window got smaller, is a window you cannot get back. */

function panelClamp(pos, min) {
  min = min || {};
  pos.w = Math.max(min.w || 200, Math.min(min.W || 720, pos.w));
  pos.h = Math.max(min.h || 140, Math.min(innerHeight - 40, pos.h));
  pos.x = Math.max(4, Math.min(innerWidth - 80, pos.x));
  pos.y = Math.max(4, Math.min(innerHeight - 40, pos.y));
  return pos;
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
  addEventListener('mouseup', () => { if (from) { from = null; done(); } });

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
    addEventListener('mouseup', () => { if (size) { size = null; done(); } });
  }

  addEventListener('resize', () => {
    if (el.hidden) return;
    panelClamp(pos, opts.min);
    panelApply(el, pos);
  });
}
