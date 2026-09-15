"""Judge a motion against the body it drives, frame by frame.

    python check_motion.py <body.bin> <motion.json> [--frames 12]

Posing by eye in a 3D view is how a run cycle ends up with the torso
tipped over and the arms buried in the chest: it looks plausible from
the one angle you happened to be looking from. These are the things a
character cannot get wrong, measured on the posed skeleton itself and
compared against the same body's bind pose rather than against numbers
picked out of the air.

Every measurement comes from joint positions, never from a bone's local
axes. These bones point along their own Z, so reading a bone's local Y
as "up" says nothing about the body -- doing that measured a perfectly
upright bind pose as 110 degrees off vertical, which is what sent the
first version of this looking for a bug in the wrong place.
"""

import sys, json, math, collections
from mxw import MXW

BONE_UNIT = math.pi / 2047.0
DEG = math.pi / 180.0

HEAD, HIPS, NECK, CHEST = 18, 3, 12, 9
THIGH_R, THIGH_L = 10, 11
ANKLE_R, ANKLE_L = 21, 22
TOE_R, TOE_L = 32, 33
FOOT_R, FOOT_L = 25, 26
HAND_R, HAND_L = 36, 37


# ----------------------------------------------------------- matrices
def ident():
    return [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]


def mul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(4)) for j in range(4)]
            for i in range(4)]


def trans(x, y, z):
    m = ident()
    m[0][3], m[1][3], m[2][3] = x, y, z
    return m


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    m = ident(); m[1][1] = c; m[1][2] = -s; m[2][1] = s; m[2][2] = c
    return m


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    m = ident(); m[0][0] = c; m[0][2] = s; m[2][0] = -s; m[2][2] = c
    return m


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    m = ident(); m[0][0] = c; m[0][1] = -s; m[1][0] = s; m[1][1] = c
    return m


def euler_yxz(rx, ry, rz):
    """R = Ry * Rx * Rz, the order the rest pose uses."""
    return mul(mul(rot_y(ry), rot_x(rx)), rot_z(rz))


def point(M, p):
    return tuple(M[i][0] * p[0] + M[i][1] * p[1] + M[i][2] * p[2] + M[i][3]
                 for i in range(3))


def invert(M):
    """Inverse of a rigid transform: transpose the rotation, move back."""
    out = ident()
    for i in range(3):
        for j in range(3):
            out[i][j] = M[j][i]
    for i in range(3):
        out[i][3] = -sum(M[k][i] * M[k][3] for k in range(3))
    return out


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def norm(v):
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])


def dist_to_line(p, a, b):
    """How far p sits from the infinite line through a and b."""
    ab = sub(b, a)
    L = norm(ab)
    if L < 1e-6:
        return norm(sub(p, a))
    ap = sub(p, a)
    cross = (ap[1] * ab[2] - ap[2] * ab[1],
             ap[2] * ab[0] - ap[0] * ab[2],
             ap[0] * ab[1] - ap[1] * ab[0])
    return norm(cross) / L


# --------------------------------------------------------------- rig
class Rig:
    def __init__(self, path):
        mx = MXW(open(path, 'rb').read())
        if not mx.skeletons:
            raise SystemExit('%s carries no skeleton' % path)
        self.path = path
        self.skel = mx.skeletons[0]
        self.mesh = mx.meshes[0]
        self.kids = collections.defaultdict(list)
        for i, b in enumerate(self.skel.bones):
            if b[6] != 0xFF:
                self.kids[b[6]].append(i)
        self.owned = collections.defaultdict(list)
        for v0, v1, bid in self.mesh.bones:
            self.owned[bid] += list(range(v0, v1))
        self.rest = self.world({})
        self.rest_inv = {i: invert(m) for i, m in self.rest.items()}

    def world(self, pose):
        W = {}

        def walk(i, P):
            b = self.skel.bones[i]
            R = euler_yxz(b[4] * BONE_UNIT, b[3] * BONE_UNIT, b[5] * BONE_UNIT)
            p = pose.get(i, pose.get(str(i)))
            if p:
                R = mul(R, euler_yxz(p[0] * DEG, p[1] * DEG, p[2] * DEG))
            M = mul(P, mul(trans(0.0, float(b[1]), float(b[2])), R))
            W[i] = M
            for k in self.kids.get(i, []):
                walk(k, M)

        root = pose.get('root')
        base = trans(root[0], root[1], root[2]) if root else ident()
        for i, b in enumerate(self.skel.bones):
            if b[6] == 0xFF:
                walk(i, base)
        return W

    def vertices(self, pose):
        W = self.world(pose)
        out = list(self.mesh.vertices)
        for bid, idx in self.owned.items():
            if bid not in W:
                continue
            M = mul(W[bid], self.rest_inv[bid])
            for i in idx:
                out[i] = point(M, self.mesh.vertices[i])
        return out


# ------------------------------------------------------------ checks
def judge(rig, pose):
    W = rig.world(pose)
    verts = rig.vertices(pose)
    out = {}

    hips = point(W[HIPS], (0, 0, 0))
    neck = point(W[NECK], (0, 0, 0))
    spine = sub(neck, hips)
    L = norm(spine) or 1.0
    out['upright'] = round(math.degrees(math.acos(
        max(-1.0, min(1.0, spine[1] / L)))), 1)

    feet = (rig.owned.get(TOE_R, []) + rig.owned.get(TOE_L, []) +
            rig.owned.get(FOOT_R, []) + rig.owned.get(FOOT_L, []))
    out['lowest_foot'] = round(min(verts[i][1] for i in feet)) if feet else 0

    # A knee bends one way, and only so far.
    #
    # Measured as the angle at the joint -- 180 is a straight leg -- so
    # it means the same whatever direction the leg happens to be
    # pointing. Projecting the knee onto the hip-to-toe line, which is
    # what this did first, blows up as that line approaches horizontal:
    # a perfectly ordinary sitting pose reported -1276.
    for side, thigh, ankle, toe in (('R', THIGH_R, ANKLE_R, TOE_R),
                                    ('L', THIGH_L, ANKLE_L, TOE_L)):
        hip = point(W[thigh], (0, 0, 0))
        knee = point(W[ankle], (0, 0, 0))
        tip = point(W[toe], (0, 0, 0))
        a, b = sub(hip, knee), sub(tip, knee)
        la, lb = norm(a), norm(b)
        if la < 1 or lb < 1:
            out['knee_' + side] = None
            continue
        dot = sum(a[k] * b[k] for k in range(3)) / (la * lb)
        angle = math.degrees(math.acos(max(-1.0, min(1.0, dot))))
        # which side of the thigh the knee leads: forward is -Z, and a
        # knee that leads backward is the broken one
        fwd = sub(knee, hip)
        lead = -(fwd[2] - (tip[2] - hip[2]) * 0.5)
        # a straight leg has no lead direction to be wrong about, so
        # only a bent knee is judged on which way it points
        bent = angle < 165
        out['knee_' + side] = round(angle if (not bent or lead >= -40) else -angle)

    for side, hand in (('R', HAND_R), ('L', HAND_L)):
        out['hand_' + side] = round(dist_to_line(point(W[hand], (0, 0, 0)),
                                                 hips, neck))

    out['head_above_hips'] = round(point(W[HEAD], (0, 0, 0))[1] - hips[1])
    # a walk where the standing foot leaves the floor reads as skating
    out['floating'] = out['lowest_foot']
    return out


def limits(rest, doc=None):
    """What counts as wrong, for this body.

    A motion may say that two of these do not apply to it: `air` for a
    run, which really does leave the ground, and `grounded` for a motion
    that ends lying down, where a horizontal torso is the point."""
    doc = doc or {}
    out = {
        'upright': ('torso tilted', 'max', rest['upright'] + 45,
                    'degrees off vertical'),
        'lowest_foot': ('a foot through the floor', 'min',
                        rest['lowest_foot'] - 220, 'units'),
        'hand_R': ('right hand inside the torso', 'min', 380, 'units clear'),
        'hand_L': ('left hand inside the torso', 'min', 380, 'units clear'),
        # 180 is straight; below 35 is further than a knee folds, and a
        # negative reading is a knee leading the wrong way
        'knee_R': ('right knee', 'min', 35, 'degrees at the joint'),
        'knee_L': ('left knee', 'min', 35, 'degrees at the joint'),
        'head_above_hips': ('head dropped', 'min',
                            rest['head_above_hips'] * 0.55, 'units'),
        'floating': ('both feet off the ground', 'max',
                     rest['lowest_foot'] + 260, 'units up'),
    }
    if doc.get('air'):
        out.pop('floating', None)
    if doc.get('grounded'):
        out.pop('upright', None)
        out.pop('head_above_hips', None)
    return out


def sample(t, frame):
    if not t:
        return None
    a, b = t[0], t[-1]
    if frame <= a[0]:
        return [a[1], a[2], a[3]]
    if frame >= b[0]:
        return [b[1], b[2], b[3]]
    for i in range(len(t) - 1):
        if t[i][0] <= frame <= t[i + 1][0]:
            a, b = t[i], t[i + 1]
            break
    span = b[0] - a[0]
    u = (frame - a[0]) / span if span else 0
    return [a[1] + (b[1] - a[1]) * u,
            a[2] + (b[2] - a[2]) * u,
            a[3] + (b[3] - a[3]) * u]


def pose_at(tracks, frame, root=None):
    pose = {}
    if root:
        r = sample(root, frame)
        if r:
            pose['root'] = r
    for k, t in tracks.items():
        if not t:
            continue
        a, b = t[0], t[-1]
        if frame <= a[0]:
            pose[int(k)] = [a[1], a[2], a[3]]
            continue
        if frame >= b[0]:
            pose[int(k)] = [b[1], b[2], b[3]]
            continue
        for i in range(len(t) - 1):
            if t[i][0] <= frame <= t[i + 1][0]:
                a, b = t[i], t[i + 1]
                break
        span = b[0] - a[0]
        u = (frame - a[0]) / span if span else 0
        pose[int(k)] = [a[1] + (b[1] - a[1]) * u,
                        a[2] + (b[2] - a[2]) * u,
                        a[3] + (b[3] - a[3]) * u]
    return pose


def run(rig, doc, steps=12, quiet=False):
    tracks = doc['tracks']
    root = doc.get('root')
    end = 0
    for t in tracks.values():
        if t:
            end = max(end, t[-1][0])
    if root:
        end = max(end, root[-1][0])
    rows, hdr = [], None
    for s in range(steps):
        f = end * s / float(max(1, steps - 1)) if end else 0
        r = judge(rig, pose_at(tracks, f, root))
        if hdr is None:
            hdr = list(r.keys())
            if not quiet:
                print('%-7s ' % 'frame' + ' '.join('%16s' % k for k in hdr))
        if not quiet:
            print('%-7.1f ' % f + ' '.join('%16s' % r[k] for k in hdr))
        rows.append(r)

    rest = judge(rig, {})
    bad = []
    for key, (label, way, limit, unit) in limits(rest, doc).items():
        vals = [r[key] for r in rows if r.get(key) is not None]
        if not vals:
            continue
        worst = min(vals) if way == 'min' else max(vals)
        if (way == 'min' and worst < limit) or (way == 'max' and worst > limit):
            bad.append('%-30s %7s %-18s (limit %s %s)' % (
                label, worst, unit, way, round(limit)))
    return rest, hdr, bad


def main(argv):
    if len(argv) < 2:
        raise SystemExit(__doc__)
    steps = 12
    if '--frames' in argv:
        steps = int(argv[argv.index('--frames') + 1])
    rig = Rig(argv[0])
    doc = json.load(open(argv[1], encoding='utf-8'))
    print('%s   %s' % (doc.get('name', '?'), argv[0]))
    rest, hdr, bad = run(rig, doc, steps)
    print()
    print('bind pose:  ' + '  '.join('%s %s' % (k, rest[k]) for k in hdr))
    print()
    if bad:
        print('problems:')
        for b in bad:
            print('  ' + b)
    else:
        print('nothing out of range')


if __name__ == '__main__':
    main(sys.argv[1:])
