#!/usr/bin/env python3
"""Run the readers and writers over a directory of real files.

Round-tripping byte-for-byte proves the reader and writer agree with
each other, which is necessary but not sufficient: both could share a
wrong assumption. So each file is also checked against the invariants
the format implies, and a few edits are simulated and re-read.

    python test_corpus.py <directory> [--verbose] [--limit N]

Read-only on the directory. Nothing is written anywhere.
"""
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mxw import MXW, Mesh, MXWError, gif_size          # noqa: E402
from gra import GRA, GRAError, tint_index_of           # noqa: E402

MESH_EXT = ('.bin', '.mxw')
SPRITE_EXT = ('.gra', '.spr', '.eft')


class Result:
    def __init__(self):
        self.counts = {}
        self.problems = []      # (path, kind, detail)

    def bump(self, key, n=1):
        self.counts[key] = self.counts.get(key, 0) + n

    def fail(self, path, kind, detail):
        self.problems.append((path, kind, detail))
        self.bump('problems')


# --------------------------------------------------------------- meshes

def check_mesh_invariants(m, gifs, tag, r, path):
    """Everything the format implies but the reader does not enforce."""
    nv = len(m.vertices)
    if nv != len(m.normals):
        r.fail(path, tag, 'vertex and normal counts differ')

    for i, f in enumerate(m.faces):
        if len(f['verts']) not in (3, 4):
            r.fail(path, tag, 'face %d has %d corners' % (i, len(f['verts'])))
        if f['mat'] >= max(1, len(m.materials)):
            r.fail(path, tag, 'face %d uses material %d of %d'
                   % (i, f['mat'], len(m.materials)))
        for idx, u, v in f['verts']:
            if idx >= nv:
                r.fail(path, tag, 'face %d names vertex %d of %d'
                       % (i, idx, nv))
                break

    for i, mat in enumerate(m.materials):
        if gifs and mat['texture'] >= len(gifs):
            r.fail(path, tag, 'material %d (%s) points at texture %d of %d'
                   % (i, mat['name'], mat['texture'], len(gifs)))

    # the bone table partitions the vertex list: contiguous, from 0 to nv
    if m.bones:
        if m.bones[0][0] != 0:
            r.fail(path, tag, 'bone table starts at vertex %d, not 0'
                   % m.bones[0][0])
        if m.bones[-1][1] != nv:
            r.fail(path, tag, 'bone table ends at %d but there are %d vertices'
                   % (m.bones[-1][1], nv))
        for i in range(len(m.bones) - 1):
            if m.bones[i][1] != m.bones[i + 1][0]:
                r.fail(path, tag, 'bone range %d ends at %d, %d starts at %d'
                       % (i, m.bones[i][1], i + 1, m.bones[i + 1][0]))
                break

    # u,v are texture pixels, so they should land inside the texture a
    # material actually draws from
    for mi in range(max(1, len(m.materials))):
        su, sv = m.uv_divisor(mi, gifs)
        over = 0
        for f in m.faces:
            if len(m.materials) > 1 and f['mat'] != mi:
                continue
            for _, u, v in f['verts']:
                if u > su or v > sv:
                    over += 1
        if over:
            r.bump('uv outside the texture')
            r.fail(path, tag, 'material %d has %d corner(s) whose u,v fall '
                              'outside its %dx%d texture' % (mi, over, su, sv))


def check_skeleton_invariants(sk, meshes, tag, r, path):
    n = len(sk.bones)
    for i, b in enumerate(sk.bones):
        if b[6] != 0xFF and b[6] >= n:
            r.fail(path, tag, 'bone %d names parent %d of %d' % (i, b[6], n))
    if not sk.roots():
        r.fail(path, tag, 'skeleton has no root (no parent 0xFF)')
    # a mesh's bone ids index this list
    for mi, m in enumerate(meshes):
        for rng in m.bones:
            if rng[2] >= n:
                r.fail(path, tag, 'mesh %d uses bone %d but the skeleton '
                                  'has %d' % (mi, rng[2], n))
                break


def simulate_mesh_edits(raw, m, tag, r, path):
    """Change something, write it, read it back, compare."""
    # 1. swap a texture for a copy of itself: the bytes must be stable
    if m.gifs:
        edited = MXW(raw)
        edited.replace_gif(0, m.gifs[0])
        if edited.write() != raw:
            r.fail(path, tag, 'replacing a texture with itself changed the file')

    # 2. change the mesh id and read it back
    edited = MXW(raw)
    edited.mesh_id = (edited.mesh_id ^ 0x1234) & 0xFFFFFFFF
    try:
        again = MXW(edited.write())
    except MXWError as e:
        r.fail(path, tag, 'the file stopped parsing after a mesh id change: %s' % e)
        return
    if again.mesh_id != edited.mesh_id:
        r.fail(path, tag, 'the mesh id did not survive a write')

    # 3. rename a texture, which changes a length-prefixed string and so
    #    the size of the whole chunk
    if m.meshes and m.meshes[0].textures:
        edited = MXW(raw)
        edited.meshes[0].textures[0] = 'x' * 40
        try:
            again = MXW(edited.write())
        except MXWError as e:
            r.fail(path, tag, 'renaming a texture broke the file: %s' % e)
            return
        if again.meshes[0].textures[0] != 'x' * 40:
            r.fail(path, tag, 'a texture rename did not survive a write')
        if len(again.meshes[0].vertices) != len(m.meshes[0].vertices):
            r.fail(path, tag, 'a texture rename disturbed the geometry')


def do_mesh(path, raw, r, verbose):
    try:
        m = MXW(raw)
    except MXWError as e:
        # A .bin is not always a mesh. Classifying the ones that are
        # known to be something else keeps the report honest: these are
        # not failures, they are other formats sharing an extension.
        if b'GIF8' in raw[:32]:
            r.bump('.bin holding only a texture')
        elif raw[:4] == b'OK  ':
            r.bump('.bin that is the item index, not a mesh')
        elif os.path.basename(path).lower() == 'layout.bin':
            r.bump('.bin from an installer, not game data')
        else:
            r.bump('mesh rejected')
            r.fail(path, 'mesh', str(e))
        return
    r.bump('meshes read')
    if m.truncated:
        r.bump('truncated (chunks promised but absent)')

    if m.write() != raw:
        r.fail(path, 'mesh', 'does not write back byte-identical')
    else:
        r.bump('mesh round-trip identical')

    for me in m.meshes:
        check_mesh_invariants(me, m.gifs, 'mesh', r, path)
    for sk in m.skeletons:
        check_skeleton_invariants(sk, m.meshes, 'mesh', r, path)
    if m.blobs:
        r.bump('unrecognised chunks kept verbatim', len(m.blobs))

    simulate_mesh_edits(raw, m, 'mesh', r, path)

    for g in m.gifs:
        w, h = gif_size(g) or (0, 0)
        if not w or not h:
            r.fail(path, 'mesh', 'a texture has no readable size')


# -------------------------------------------------------------- sprites

def check_sprite_invariants(g, r, path):
    for i, f in enumerate(g.frames):
        for x, y, px in f.runs:
            if y >= g.height:
                r.fail(path, 'sprite', 'frame %d has a run at y=%d, height %d'
                       % (i, y, g.height))
                break
            if x + len(px) > g.width:
                r.fail(path, 'sprite', 'frame %d has a run reaching x=%d, '
                                       'width %d' % (i, x + len(px), g.width))
                break
    if len(g.frames) > 255:
        r.fail(path, 'sprite', '%d frames, but the count is a u8'
               % len(g.frames))


def simulate_sprite_edits(raw, g, r, path):
    # 1. recolour a colour to itself: stable
    pal = g.palette()
    if pal:
        edited = GRA(raw)
        first = pal[0][0]
        edited.map_colors(lambda v: v)
        if edited.write() != raw:
            r.fail(path, 'sprite', 'an identity recolour changed the file')

        # 2. recolour for real, then read back and count
        edited = GRA(raw)
        target = 0xF81F if first != 0xF81F else 0x07E0
        edited.map_colors(lambda v, a=first, b=target: b if v == a else v)
        try:
            again = GRA(edited.write())
        except GRAError as e:
            r.fail(path, 'sprite', 'a recolour broke the file: %s' % e)
            return
        got = dict(again.palette()).get(target, 0)
        want = pal[0][1] + dict(pal).get(target, 0)
        if got != want:
            r.fail(path, 'sprite', 'a recolour moved %d pixels, expected %d'
                   % (got, want))
        if len(again.frames) != len(g.frames):
            r.fail(path, 'sprite', 'a recolour changed the frame count')

    # 3. rebuild a frame from its own pixels: the drawn result must match
    if g.frames and g.frames[0].runs:
        edited = GRA(raw)
        rgba = edited.frames[0].to_rgba(g.width, g.height)
        edited.replace_frame_rgba(0, rgba)
        try:
            again = GRA(edited.write())
        except GRAError as e:
            r.fail(path, 'sprite', 'rebuilding a frame broke the file: %s' % e)
            return
        before = g.frames[0].to_rgba(g.width, g.height)
        after = again.frames[0].to_rgba(g.width, g.height)
        if before != after:
            diff = sum(1 for i in range(0, len(before), 4)
                       if before[i:i + 4] != after[i:i + 4])
            r.fail(path, 'sprite', 'a frame rebuilt from its own pixels '
                                   'differs in %d pixel(s)' % diff)


def do_sprite(path, raw, r, verbose):
    try:
        g = GRA(raw)
    except GRAError as e:
        # The same classification applies here: effects, map layout and
        # map block data share these extensions without sharing the
        # format, and none of them is decoded yet.
        head = raw[:4]
        name = os.path.basename(path).lower()
        if head[2] == 0 and head[3] == 0 and 0 < head[0] < 64 and head[1] == 0:
            r.bump('effect file, a format not decoded yet')
        elif name == 'map.spr' or (head[0] == head[1] == head[2] == head[3]
                                   and 0 < head[0] < 0x20):
            r.bump('map layout data, not an image')
        elif name == 'block.spr' or head[:2] == b'\x99\x99':
            r.bump('map block data, not an image')
        elif name == 'ui_userdraw.spr':
            r.bump('interface file in an unknown encoding')
        else:
            r.bump('sprite rejected')
            r.fail(path, 'sprite', str(e))
        return
    r.bump('sprites read')
    r.bump('frames read', len(g.frames))

    if g.write() != raw:
        r.fail(path, 'sprite', 'does not write back byte-identical')
    else:
        r.bump('sprite round-trip identical')

    check_sprite_invariants(g, r, path)
    simulate_sprite_edits(raw, g, r, path)

    tinted = 0
    total = 0
    for f in g.frames:
        for _, _, px in f.runs:
            for v in px:
                total += 1
                if tint_index_of(v) >= 0:
                    tinted += 1
    r.bump('pixels', total)
    r.bump('pixels in the reserved ramp', tinted)


# ------------------------------------------------------------------ run

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    verbose = '--verbose' in sys.argv
    limit = 0
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])
    if not args:
        print(__doc__)
        return 0
    root = args[0]

    r = Result()
    seen = set()
    n = 0
    for dirpath, _, names in os.walk(root):
        if '_QUARENTENA' in dirpath or 'QUARANTINE' in dirpath.upper():
            continue
        for name in names:
            ext = os.path.splitext(name)[1].lower()
            if ext not in MESH_EXT and ext not in SPRITE_EXT:
                continue
            path = os.path.join(dirpath, name)
            try:
                size = os.path.getsize(path)
                if size < 16 or size > 80 * 1024 * 1024:
                    continue
                with open(path, 'rb') as fh:
                    raw = fh.read()
            except OSError as e:
                r.fail(path, 'io', str(e))
                continue
            key = (size, zlib.crc32(raw))
            if key in seen:
                r.bump('duplicate content skipped')
                continue
            seen.add(key)
            n += 1
            if limit and n > limit:
                break
            if ext in MESH_EXT:
                do_mesh(path, raw, r, verbose)
            else:
                do_sprite(path, raw, r, verbose)
        if limit and n > limit:
            break

    print('=' * 72)
    print(' %d distinct files under %s' % (len(seen), root))
    print('=' * 72)
    for k in sorted(r.counts):
        print('  %-40s %d' % (k, r.counts[k]))
    print()
    if r.problems:
        print('%d problem(s):' % len(r.problems))
        bykind = {}
        for path, kind, detail in r.problems:
            head = detail.split(',')[0][:64]
            bykind.setdefault(head, []).append(path)
        for head in sorted(bykind, key=lambda h: -len(bykind[h])):
            paths = bykind[head]
            print('  %-58s %d file(s)' % (head[:58], len(paths)))
            for p in paths[:3 if not verbose else 20]:
                print('        %s' % p)
            if not verbose and len(paths) > 3:
                print('        ... and %d more' % (len(paths) - 3))
        return 1
    print('no problems found')
    return 0


if __name__ == '__main__':
    sys.exit(main())
