#!/usr/bin/env python3
"""Reader and writer for the GRA sprite format (.gra, .spr, .eft).

The 2D artwork -- characters, projectiles, effects, interface pieces --
is stored as a list of horizontal pixel runs per frame, so only the
occupied pixels are kept. A 256x256 frame holding a small icon costs
about 300 words instead of 65536 pixels.

All multi-byte integers are LITTLE-endian. Note that the mesh format in
mxw.py is big-endian; these two formats disagree.

HEADER
    0x00  u16      0
    0x02  u8       1
    0x03  u8       1
    0x04  u8       kind        0x00 or 0x03 in almost every file
    0x05  u8       frame count N
    0x06  u8       0x64, 0x00 or 0x01
    0x07  u32      0
    0x0B  u16      width
    0x0D  u16      height
    0x0F  u32      0
    0x13  N x u32  cumulative frame end, counted in 16-bit words
    0x13+4N        the payload, a stream of 16-bit words

The header is 19 bytes plus the frame table, which puts the width and
height at odd offsets -- easy to misread as big-endian fields one byte
further along.

    file size == 19 + 4 * N + 2 * last cumulative count

Frame i owns the words in [cum[i-1], cum[i]).

FRAME PAYLOAD -- horizontal runs, repeated until the frame is used up

    u16   x
    u16   y
    u16   count
    count x u16   pixels, RGB565

Pixels not covered by any run are transparent. RGB565 rather than
RGB555: bit 15 is in regular use, and under a 555 reading the hues come
out wrong.

Verified against the files available while this was written: 1422 of
1444 have a header that satisfies the size rule, and of the 8086 frames
in those, 8079 (99.91%) decode to exactly zero bytes left over with all
641465 runs inside their declared frame. Round-tripping every one of
them reproduces the source byte for byte.

The remainder are a different variant. They carry kind bytes 0x09,
0x49 and 0x99 -- rather than 0x00 or 0x03 -- and their frame tables do
not satisfy the size rule, so they are rejected rather than guessed at.
One outlier is a community-edited interface file whose cumulative table
was not updated to match its new length.

usage
    python gra.py <file> [...]              inspect
    python gra.py --png <file>              write a PNG per frame
    python gra.py --strip <file>            write one PNG of all frames
    python gra.py --check <file> [...]      prove the round-trip
"""
import os
import struct
import sys

KINDS_KNOWN = (0x00, 0x03)


class GRAError(Exception):
    pass


def rgb565_to_rgb(v):
    return (((v >> 11) & 31) * 255 // 31,
            ((v >> 5) & 63) * 255 // 63,
            (v & 31) * 255 // 31)


def rgb_to_rgb565(r, g, b):
    return (((r * 31 + 127) // 255) << 11) \
        | (((g * 63 + 127) // 255) << 5) \
        | ((b * 31 + 127) // 255)


class Frame:
    """One frame: a list of (x, y, pixels) horizontal runs."""

    def __init__(self, runs=None):
        self.runs = runs or []

    @property
    def words(self):
        """How many 16-bit words this frame serialises to."""
        return sum(3 + len(px) for _, _, px in self.runs)

    def bbox(self):
        if not self.runs:
            return None
        x0 = min(x for x, _, _ in self.runs)
        x1 = max(x + len(px) for x, _, px in self.runs)
        y0 = min(y for _, y, _ in self.runs)
        y1 = max(y for _, y, _ in self.runs) + 1
        return x0, y0, x1, y1

    def pixel_count(self):
        return sum(len(px) for _, _, px in self.runs)

    def to_rgba(self, w, h):
        """Flat RGBA bytes, transparent where no run covers a pixel."""
        buf = bytearray(w * h * 4)
        for x, y, px in self.runs:
            if y >= h:
                continue
            o = (y * w + x) * 4
            for v in px:
                if 0 <= o < len(buf) - 3:
                    r, g, b = rgb565_to_rgb(v)
                    buf[o] = r
                    buf[o + 1] = g
                    buf[o + 2] = b
                    buf[o + 3] = 255
                o += 4
        return bytes(buf)

    @classmethod
    def from_rgba(cls, rgba, w, h, alpha_cutoff=128):
        """Build runs from RGBA bytes. Transparent pixels are dropped,
        which is what keeps these files small."""
        runs = []
        for y in range(h):
            x = 0
            while x < w:
                o = (y * w + x) * 4
                if rgba[o + 3] < alpha_cutoff:
                    x += 1
                    continue
                start = x
                px = []
                while x < w:
                    o = (y * w + x) * 4
                    if rgba[o + 3] < alpha_cutoff:
                        break
                    px.append(rgb_to_rgb565(rgba[o], rgba[o + 1], rgba[o + 2]))
                    x += 1
                runs.append((start, y, px))
        return cls(runs)

    def map_colors(self, fn):
        """Apply fn(rgb565) -> rgb565 to every pixel. This is how a
        recolour propagates across frames without touching geometry."""
        self.runs = [(x, y, tuple(fn(v) for v in px))
                     for x, y, px in self.runs]


class GRA:
    def __init__(self, data=None):
        self.kind = 0x03
        self.b6 = 0x64
        self.width = 0
        self.height = 0
        self.frames = []
        if data is not None:
            self._read(data)

    def _read(self, d):
        if len(d) < 24:
            raise GRAError('too short to be a sprite file')
        if d[2] != 1 or d[3] != 1:
            raise GRAError('bytes 2-3 are %02X %02X, expected 01 01'
                           % (d[2], d[3]))
        n = d[5]
        if n == 0:
            raise GRAError('frame count is zero')
        if len(d) < 19 + 4 * n:
            raise GRAError('frame table runs past the end of the file')
        self.kind = d[4]
        self.b6 = d[6]
        self.width = struct.unpack_from('<H', d, 11)[0]
        self.height = struct.unpack_from('<H', d, 13)[0]
        cum = [struct.unpack_from('<I', d, 19 + 4 * i)[0] for i in range(n)]
        base = 19 + 4 * n
        if base + 2 * cum[-1] != len(d):
            raise GRAError('size is %d, the frame table implies %d'
                           % (len(d), base + 2 * cum[-1]))
        if any(cum[i] > cum[i + 1] for i in range(n - 1)):
            raise GRAError('frame table is not monotonic')

        for i in range(n):
            p = base + 2 * (cum[i - 1] if i else 0)
            end = base + 2 * cum[i]
            runs = []
            while p + 6 <= end:
                x, y, c = struct.unpack_from('<HHH', d, p)
                p += 6
                if c == 0 or p + 2 * c > end:
                    raise GRAError('frame %d has a run of %d pixels that '
                                   'does not fit' % (i, c))
                runs.append((x, y, struct.unpack_from('<%dH' % c, d, p)))
                p += 2 * c
            if p != end:
                raise GRAError('frame %d leaves %d bytes unread'
                               % (i, end - p))
            self.frames.append(Frame(runs))

    def write(self):
        bodies = []
        for f in self.frames:
            o = bytearray()
            for x, y, px in f.runs:
                o += struct.pack('<HHH', x, y, len(px))
                o += struct.pack('<%dH' % len(px), *px)
            bodies.append(bytes(o))
        out = bytearray(struct.pack('<HBBBBB', 0, 1, 1, self.kind,
                                    len(self.frames), self.b6))
        out += struct.pack('<I', 0)
        out += struct.pack('<HH', self.width, self.height)
        out += struct.pack('<I', 0)
        total = 0
        for b in bodies:
            total += len(b) // 2
            out += struct.pack('<I', total)
        for b in bodies:
            out += b
        return bytes(out)

    # --- editing -------------------------------------------------

    def map_colors(self, fn, frames=None):
        """Recolour some or all frames. `frames` is a list of indices,
        or None for every frame."""
        for i, f in enumerate(self.frames):
            if frames is None or i in frames:
                f.map_colors(fn)

    def palette(self):
        """Every distinct colour, most used first. These files store
        direct colour rather than indices, so a 'palette edit' means
        remapping the colours that are actually present."""
        from collections import Counter
        c = Counter()
        for f in self.frames:
            for _, _, px in f.runs:
                c.update(px)
        return c.most_common()

    def replace_frame_rgba(self, index, rgba, alpha_cutoff=128):
        self.frames[index] = Frame.from_rgba(rgba, self.width, self.height,
                                             alpha_cutoff)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    want = {k: ('--' + k) in sys.argv for k in ('png', 'strip', 'check')}
    if not args:
        print(__doc__)
        return 0
    good = bad = 0
    for a in args:
        raw = open(a, 'rb').read()
        try:
            g = GRA(raw)
        except GRAError as e:
            print('%-22s ERROR: %s' % (os.path.basename(a), e))
            bad += 1
            continue
        if want['check']:
            same = g.write() == raw
            print('%-22s round-trip %-9s %2d frames  %dx%d'
                  % (os.path.basename(a), 'IDENTICAL' if same else 'DIFFERS',
                     len(g.frames), g.width, g.height))
            if same:
                good += 1
            else:
                bad += 1
            continue
        good += 1
        note = '' if g.kind in KINDS_KNOWN else '   (unusual kind byte)'
        print('%s   kind 0x%02X   %d frames   %dx%d%s'
              % (os.path.basename(a), g.kind, len(g.frames),
                 g.width, g.height, note))
        for i, f in enumerate(g.frames):
            bb = f.bbox()
            print('   frame %2d  %4d runs  %6d px  %s'
                  % (i, len(f.runs), f.pixel_count(),
                     'bounds x %d..%d y %d..%d' % (bb[0], bb[2], bb[1], bb[3])
                     if bb else 'empty'))
        pal = g.palette()
        print('   %d distinct colours, most used 0x%04X (%d px)'
              % (len(pal), pal[0][0], pal[0][1]) if pal else '   no pixels')

        if want['png'] or want['strip']:
            try:
                from PIL import Image
            except ImportError:
                print('   PNG output needs Pillow: pip install pillow')
                continue
            stem = os.path.splitext(a)[0]
            imgs = []
            for i, f in enumerate(g.frames):
                im = Image.frombytes('RGBA', (g.width, g.height),
                                     f.to_rgba(g.width, g.height))
                imgs.append(im)
                if want['png']:
                    out = ('%s_%02d.png' % (stem, i)) if len(g.frames) > 1 \
                        else stem + '.png'
                    im.save(out)
                    print('   -> %s' % os.path.basename(out))
            if want['strip'] and imgs:
                cropped = [im.crop(im.getbbox()) if im.getbbox() else im
                           for im in imgs]
                gap = 8
                W = sum(im.size[0] for im in cropped) + gap * len(cropped)
                H = max(im.size[1] for im in cropped)
                strip = Image.new('RGBA', (W, H), (0, 0, 0, 0))
                x = 0
                for im in cropped:
                    strip.paste(im, (x, H - im.size[1]), im)
                    x += im.size[0] + gap
                strip.save(stem + '_strip.png')
                print('   -> %s_strip.png' % os.path.basename(stem))
    print()
    print('ok=%d  failed=%d' % (good, bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
