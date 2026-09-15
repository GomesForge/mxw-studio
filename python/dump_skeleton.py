"""Print a body's bone hierarchy, with what each bone actually moves.

    python dump_skeleton.py <file.bin> [--csv out.csv]

Nothing in the format carries a bone name, so the body parts here are
read off the vertices each bone owns: the mesh's bone table partitions
the vertex list into contiguous spans, one span per bone, so the extent
of a bone's vertices says what it is. Useful when you have a motion
file and need to know which track drives which limb.
"""

import sys, collections, csv
from mxw import MXW

LABEL = {0: 'root', 1: 'root 2', 2: 'root 3', 3: 'hips', 4: 'spine',
         5: 'pelvis (leg split)', 6: 'spine 2', 7: 'leg root R',
         8: 'leg root L', 9: 'chest', 10: 'thigh R', 11: 'thigh L',
         12: 'neck', 13: 'shoulder root R', 14: 'shoulder root L',
         15: 'shin R', 16: 'shin L', 17: 'chest branch', 18: 'head',
         19: 'upper arm R', 20: 'upper arm L', 21: 'ankle R',
         22: 'ankle L', 23: 'forearm R', 24: 'forearm L', 25: 'foot R',
         26: 'foot L', 30: 'wrist R', 31: 'wrist L', 32: 'toe R',
         33: 'toe L', 36: 'hand R', 37: 'hand L'}

# +-2047 is half a turn: every value in both bodies divides cleanly by
# that into whole degrees.
HALF_TURN = 2047.0


def read(path):
    mx = MXW(open(path, 'rb').read())
    if not mx.skeletons:
        raise SystemExit('%s carries no skeleton' % path)
    sk, me = mx.skeletons[0], mx.meshes[0]
    owned = collections.defaultdict(list)
    for v0, v1, bid in me.bones:
        owned[bid] += me.vertices[v0:v1]
    kids = collections.defaultdict(list)
    for i, b in enumerate(sk.bones):
        if b[6] != 0xFF:
            kids[b[6]].append(i)
    return sk, owned, kids


def label(i, verts):
    if i in LABEL:
        return LABEL[i]
    if i >= 39:
        side = 'R' if any(v[0] > 0 for v in verts) else ('L' if verts else '?')
        return 'finger joint ' + side
    if 27 <= i <= 29 or i in (34, 35, 38):
        return 'head joint'
    return 'unnamed joint'


def main(argv):
    if not argv:
        raise SystemExit(__doc__)
    path = argv[0]
    out = argv[argv.index('--csv') + 1] if '--csv' in argv else None
    sk, owned, kids = read(path)
    rows = []

    def walk(i, depth):
        b = sk.bones[i]
        v = owned.get(i, [])
        name = label(i, v)
        deg = tuple(round(b[k] * 180.0 / HALF_TURN, 1) for k in (3, 4, 5))
        if v:
            span = 'n=%-4d x %6d..%-6d y %5d..%-5d z %6d..%-6d' % (
                len(v), min(p[0] for p in v), max(p[0] for p in v),
                min(p[1] for p in v), max(p[1] for p in v),
                min(p[2] for p in v), max(p[2] for p in v))
        else:
            span = '(drives no vertices of its own)'
        print('%3d %s%-*s len %-5d rot %7.1f %6.1f %6.1f  %s' % (
            i, '  ' * depth, 28 - 2 * depth, name, b[2],
            deg[0], deg[1], deg[2], span))
        rows.append(dict(track=i, parent='root' if b[6] == 0xFF else b[6],
                         depth=depth, part=name, length=b[2],
                         rot_x=b[3], rot_y=b[4], rot_z=b[5],
                         deg_x=deg[0], deg_y=deg[1], deg_z=deg[2],
                         vertices=len(v)))
        for k in kids.get(i, []):
            walk(k, depth + 1)

    print('%s: %d bones' % (path, len(sk.bones)))
    for i, b in enumerate(sk.bones):
        if b[6] == 0xFF:
            walk(i, 0)

    if out:
        with open(out, 'w', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print('\nwrote %s' % out)


if __name__ == '__main__':
    main(sys.argv[1:])
