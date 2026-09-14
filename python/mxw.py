#!/usr/bin/env python3
"""Reader and writer for the MXW mesh format.

The game stored every 3D item --
hair, hats, jackets, shoes, back items, cards and the two character
bodies -- in one container. This module reads it, writes it back
byte-for-byte, and lets you change it.

All multi-byte integers are BIG-ENDIAN.

CONTAINER -- a list of chunks

    0x00  char[4]  "OK  "
    0x04  u32      version (1 everywhere)
    0x08  u32      mesh id
    0x0C  u32      chunk count
    0x10  chunks, each:
              u32   size
              size bytes of content

A chunk holding geometry starts with an 8-byte resource type:

    "MXW3DHUD"   items, accessories, cards, and the female body
    "MXW3DAVA"   the male body ("AVA" = avatar)

Any other chunk is a raw GIF89a: the textures, stored in declaration
order. So a pair of shoes is chunk count 2 (one mesh, one texture) and
a body is chunk count 12 (two meshes, ten textures).

MESH PAYLOAD, after the 8-byte type

    u16       vertex count N
    N x 12    i16 x, y, z, nx, ny, nz    normals are unit * 32767
    u8        texture count T
    T x       u8 length + name
    u8        material count M
    M x       u8 length + name + u8[6] properties
              properties[4] indexes the texture list
    u16       face count F
    F x       u8 corner count (3 or 4), u8 material,
              corners x (u16 vertex index, u8 u, u8 v)
    u8        bone count B
    B x       u16 vertex start, u16 vertex end, u8 bone id

u and v are texture PIXELS, not normalised: on a 128x128 texture they
run 0..128. Divide by the size of the GIF that material points at.

The bone table partitions the vertex list into contiguous ranges, each
tagged with a bone id -- every range's start equals the previous
range's end. That is how the game skins a mesh to the skeleton.

THREE THINGS THAT ARE EASY TO GET WRONG

1. The byte after the vertex list is a texture COUNT, not a flag.
   Accessories declare 1, so treating it as a flag appears to work
   until you open a body, which declares 2 (`girl_01` for the body
   material and `girl_01_f` for the head).

2. A GIF cannot be delimited by searching for the 00 3B byte pair.
   A 0x00 data byte can be followed by a sub-block whose length byte
   is 0x3B, which looks identical to a terminator plus a trailer.
   That truncates about a third of these textures, and a truncated
   GIF still decodes -- the missing rows come out black. Walk the
   block structure instead, or trust the chunk size.

3. The six .MXW files that circulated in `mxw.zip` are truncated.
   They declare 2 chunks and contain only the first; the missing one
   is the 8-9 KB texture. The mesh in them is intact.

usage
    python mxw.py <file> [...]              inspect
    python mxw.py --obj <file>              write .obj per mesh chunk
    python mxw.py --gif <file>              write every texture
    python mxw.py --check <file> [...]      prove the round-trip
"""
import os
import struct
import sys

TYPES = (b'MXW3DHUD', b'MXW3DAVA')
SIG = b'OK  '


class MXWError(Exception):
    pass


def gif_size(blob):
    """(width, height) from a GIF's logical screen descriptor."""
    if len(blob) < 10:
        return None
    return struct.unpack_from('<HH', blob, 6)


class Mesh:
    """One geometry chunk."""

    def __init__(self, content=None, kind='MXW3DHUD'):
        self.kind = kind
        self.vertices = []      # [(x, y, z)]
        self.normals = []       # [(nx, ny, nz)] unit
        self.textures = []      # ['girl_01', 'girl_01_f']
        self.materials = []     # [{'name', 'texture', 'props'}]
        self.faces = []         # [{'mat', 'verts': [(idx, u, v)]}]
        self.bones = []         # [(vertex_start, vertex_end, bone_id)]
        if content is not None:
            self._read(content)

    def _read(self, c):
        self.kind = c[:8].decode('latin1')
        if c[:8] not in TYPES:
            raise MXWError('unknown resource type %r' % self.kind)
        p = 8
        nv = struct.unpack_from('>H', c, p)[0]
        p += 2
        for _ in range(nv):
            x, y, z, nx, ny, nz = struct.unpack_from('>6h', c, p)
            p += 12
            self.vertices.append((x, y, z))
            self.normals.append((nx / 32767.0, ny / 32767.0, nz / 32767.0))

        nt = c[p]
        p += 1
        for _ in range(nt):
            ln = c[p]
            p += 1
            self.textures.append(c[p:p + ln].decode('latin1'))
            p += ln

        nm = c[p]
        p += 1
        for _ in range(nm):
            ln = c[p]
            p += 1
            name = c[p:p + ln].decode('latin1')
            p += ln
            props = c[p:p + 6]
            p += 6
            self.materials.append({'name': name, 'texture': props[4],
                                   'props': props})

        nf = struct.unpack_from('>H', c, p)[0]
        p += 2
        for _ in range(nf):
            cnt, mat = c[p], c[p + 1]
            p += 2
            if cnt not in (3, 4):
                raise MXWError('face %d has %d corners' % (len(self.faces), cnt))
            verts = []
            for _ in range(cnt):
                verts.append(struct.unpack_from('>HBB', c, p))
                p += 4
            self.faces.append({'mat': mat, 'verts': verts})

        nb = c[p]
        p += 1
        for _ in range(nb):
            self.bones.append(struct.unpack_from('>HHB', c, p))
            p += 5
        if p != len(c):
            raise MXWError('mesh payload has %d trailing bytes' % (len(c) - p))

    def write(self):
        """Serialise back to chunk content."""
        o = bytearray(self.kind.encode('latin1').ljust(8, b'\0')[:8])
        o += struct.pack('>H', len(self.vertices))
        for (x, y, z), (nx, ny, nz) in zip(self.vertices, self.normals):
            o += struct.pack('>6h', x, y, z,
                             int(round(nx * 32767)), int(round(ny * 32767)),
                             int(round(nz * 32767)))
        o.append(len(self.textures))
        for t in self.textures:
            b = t.encode('latin1')
            o.append(len(b))
            o += b
        o.append(len(self.materials))
        for m in self.materials:
            b = m['name'].encode('latin1')
            o.append(len(b))
            o += b
            props = bytearray(m['props'])
            props[4] = m['texture']
            o += bytes(props)
        o += struct.pack('>H', len(self.faces))
        for f in self.faces:
            o += bytes((len(f['verts']), f['mat']))
            for idx, u, v in f['verts']:
                o += struct.pack('>HBB', idx, u, v)
        o.append(len(self.bones))
        for a, b_, c_ in self.bones:
            o += struct.pack('>HHB', a, b_, c_)
        return bytes(o)

    @property
    def texture(self):
        return self.textures[0] if self.textures else ''

    def bbox(self):
        if not self.vertices:
            return None
        xs, ys, zs = zip(*self.vertices)
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

    def uv_divisor(self, material_index, gifs):
        """The texture size a material's u,v pairs are relative to."""
        t = self.materials[material_index]['texture'] \
            if material_index < len(self.materials) else 0
        blob = gifs[t] if t < len(gifs) else (gifs[0] if gifs else None)
        return gif_size(blob) if blob else (128, 128)

    def to_obj(self, gifs=(), name=''):
        """Wavefront OBJ, grouped by material. Coordinates / 1000."""
        L = ['# %s -> OBJ   %s' % (self.kind, name),
             '# textures: %s' % (', '.join(self.textures) or '-'),
             '# vertices: %d   faces: %d   bones: %d'
             % (len(self.vertices), len(self.faces), len(self.bones))]
        for x, y, z in self.vertices:
            L.append('v %.4f %.4f %.4f' % (x / 1000.0, y / 1000.0, z / 1000.0))
        for nx, ny, nz in self.normals:
            L.append('vn %.4f %.4f %.4f' % (nx, ny, nz))
        out = []
        k = 1
        for mi in range(max(1, len(self.materials))):
            su, sv = self.uv_divisor(mi, gifs)
            sel = [f for f in self.faces
                   if len(self.materials) < 2 or f['mat'] == mi]
            if not sel:
                continue
            out.append('usemtl %s' % (self.materials[mi]['name']
                                      if mi < len(self.materials)
                                      else 'material%d' % mi))
            for f in sel:
                parts = []
                for idx, u, v in f['verts']:
                    L.append('vt %.4f %.4f' % (u / float(su), 1.0 - v / float(sv)))
                    parts.append('%d/%d/%d' % (idx + 1, k, idx + 1))
                    k += 1
                out.append('f ' + ' '.join(parts))
        return '\n'.join(L + out)


class Skeleton:
    """The bone hierarchy. Bodies carry one of these in a second chunk
    that opens with the same 8-byte resource type as a mesh.

        u8        bone count B
        B x       i16 a, b, c, i16 d, e, f, u8 parent

    Parent 0xFF marks a root. The bone ids in a mesh's bone table
    index this list: the female body has 75 bones, the male 74.
    """

    def __init__(self, content=None, kind='MXW3DHUD'):
        self.kind = kind
        self.bones = []         # [(a, b, c, d, e, f, parent)]
        if content is not None:
            self._read(content)

    @staticmethod
    def looks_like(content):
        n = len(content) - 9
        return (len(content) > 9 and n % 13 == 0
                and content[8] == n // 13)

    def _read(self, c):
        self.kind = c[:8].decode('latin1')
        n = c[8]
        p = 9
        for _ in range(n):
            self.bones.append(struct.unpack_from('>6hB', c, p))
            p += 13
        if p != len(c):
            raise MXWError('skeleton has %d trailing bytes' % (len(c) - p))

    def write(self):
        o = bytearray(self.kind.encode('latin1').ljust(8, b'\0')[:8])
        o.append(len(self.bones))
        for b in self.bones:
            o += struct.pack('>6hB', *b)
        return bytes(o)

    def roots(self):
        return [i for i, b in enumerate(self.bones) if b[6] == 0xFF]


class MXW:
    """The container: a version, a mesh id, and a list of chunks."""

    def __init__(self, data=None):
        self.version = 1
        self.mesh_id = 0
        self.meshes = []        # [Mesh]
        self.gifs = []          # [bytes]
        self.skeletons = []     # [Skeleton]
        self.blobs = []         # [bytes] chunks we do not recognise
        self.order = []         # (kind, index) in file order
        self.truncated = 0      # chunks the file claimed but did not hold
        if data is not None:
            self._read(data)

    def _read(self, d):
        if d[:4] != SIG:
            raise MXWError('not an MXW container (signature %r)' % d[:4])
        self.version, self.mesh_id, count = struct.unpack_from('>3I', d, 4)
        p = 0x10
        for _ in range(count):
            if p + 4 > len(d):
                self.truncated += 1
                continue
            size = struct.unpack_from('>I', d, p)[0]
            if p + 4 + size > len(d):
                self.truncated += 1
                break
            content = d[p + 4:p + 4 + size]
            p += 4 + size
            self._add(content)
        self.trailing = d[p:]

    def _add(self, content):
        """Classify one chunk. Geometry and skeletons share a type
        string, so a mesh is tried first -- its payload has to be
        consumed exactly -- and a skeleton second. Anything still
        unrecognised is kept verbatim so the file still round-trips."""
        if content[:8] in TYPES:
            try:
                self.meshes.append(Mesh(content))
                self.order.append(('mesh', len(self.meshes) - 1))
                return
            except (MXWError, struct.error):
                pass
            try:
                self.skeletons.append(Skeleton(content))
                self.order.append(('skeleton', len(self.skeletons) - 1))
                return
            except (MXWError, struct.error):
                pass
        elif content[:4] == b'GIF8':
            self.gifs.append(content)
            self.order.append(('gif', len(self.gifs) - 1))
            return
        self.blobs.append(content)
        self.order.append(('blob', len(self.blobs) - 1))

    def write(self):
        """Serialise the container. Round-trips byte-for-byte when
        nothing has been changed."""
        src = {'mesh': self.meshes, 'skeleton': self.skeletons,
               'gif': self.gifs, 'blob': self.blobs}
        chunks = []
        for kind, i in self.order:
            part = src[kind][i]
            chunks.append(part if isinstance(part, bytes) else part.write())
        o = bytearray(SIG)
        o += struct.pack('>3I', self.version, self.mesh_id,
                         len(chunks) + self.truncated)
        for c in chunks:
            o += struct.pack('>I', len(c))
            o += c
        o += getattr(self, 'trailing', b'')
        return bytes(o)

    # --- editing -------------------------------------------------

    def replace_gif(self, index, blob):
        """Swap one texture. The chunk size follows automatically."""
        if not 0 <= index < len(self.gifs):
            raise MXWError('no texture %d (file has %d)' % (index, len(self.gifs)))
        if blob[:4] != b'GIF8':
            raise MXWError('replacement is not a GIF (starts %r)' % blob[:4])
        self.gifs[index] = blob

    def add_gif(self, blob):
        """Append a texture and register the chunk."""
        if blob[:4] != b'GIF8':
            raise MXWError('not a GIF')
        self.gifs.append(blob)
        self.order.append(('gif', len(self.gifs) - 1))
        return len(self.gifs) - 1

    def rename_texture(self, mesh_index, texture_index, name):
        self.meshes[mesh_index].textures[texture_index] = name

    def set_material_texture(self, mesh_index, material_index, texture_index):
        self.meshes[mesh_index].materials[material_index]['texture'] = \
            texture_index


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    want = {f: ('--' + f) in sys.argv for f in ('obj', 'gif', 'check')}
    if not args:
        print(__doc__)
        return
    good = bad = 0
    for a in args:
        raw = open(a, 'rb').read()
        try:
            m = MXW(raw)
        except MXWError as e:
            print('%-16s ERROR: %s' % (os.path.basename(a), e))
            bad += 1
            continue
        good += 1
        if want['check']:
            same = m.write() == raw
            print('%-16s round-trip %-9s  %d mesh  %d skel  %d gif  %d blob%s'
                  % (os.path.basename(a), 'IDENTICAL' if same else 'DIFFERS',
                     len(m.meshes), len(m.skeletons), len(m.gifs),
                     len(m.blobs),
                     '  (%d chunk(s) missing from the file)' % m.truncated
                     if m.truncated else ''))
            if not same:
                bad += 1
                good -= 1
            continue
        print('%s   v%d   id 0x%X   %d mesh  %d skeleton  %d gif%s'
              % (os.path.basename(a), m.version, m.mesh_id, len(m.meshes),
                 len(m.skeletons), len(m.gifs),
                 '   TRUNCATED: %d chunk(s) missing' % m.truncated
                 if m.truncated else ''))
        for i, sk in enumerate(m.skeletons):
            print('   skeleton %d  %d bones, %d root(s)'
                  % (i, len(sk.bones), len(sk.roots())))
        for i, me in enumerate(m.meshes):
            bb = me.bbox()
            dim = '%d x %d x %d' % (bb[1][0] - bb[0][0], bb[1][1] - bb[0][1],
                                    bb[1][2] - bb[0][2]) if bb else '-'
            print('   mesh %d  %s  %4d vert  %4d faces  %2d bones   %s'
                  % (i, me.kind, len(me.vertices), len(me.faces),
                     len(me.bones), dim))
            print('           textures: %s' % (', '.join(me.textures) or '-'))
            print('           materials: %s'
                  % (', '.join('%s -> tex%d' % (x['name'], x['texture'])
                               for x in me.materials) or '-'))
        for i, g in enumerate(m.gifs):
            w, h = gif_size(g) or (0, 0)
            print('   tex %d   %dx%d   %d bytes' % (i, w, h, len(g)))
        stem = os.path.splitext(a)[0]
        if want['obj']:
            for i, me in enumerate(m.meshes):
                out = ('%s_mesh%d.obj' % (stem, i)) if len(m.meshes) > 1 \
                    else stem + '.obj'
                with open(out, 'w') as f:
                    f.write(me.to_obj(m.gifs, os.path.basename(a)))
                print('   -> %s' % os.path.basename(out))
        if want['gif']:
            for i, g in enumerate(m.gifs):
                out = ('%s_tex%d.gif' % (stem, i)) if len(m.gifs) > 1 \
                    else stem + '.gif'
                with open(out, 'wb') as f:
                    f.write(g)
                print('   -> %s' % os.path.basename(out))
    print()
    print('ok=%d  failed=%d' % (good, bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main() or 0)
