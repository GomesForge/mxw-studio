# The GRA sprite format (`.gra`, `.spr`, `.eft`)

All the 2D artwork lives here: characters, projectiles, effects and
interface pieces. A frame is stored as a list of horizontal pixel runs,
so only the occupied pixels are kept — a 256×256 frame holding a small
icon costs about 300 words rather than 65536 pixels.

**Everything is little-endian.** The mesh container is big-endian, so
the two formats disagree and it is easy to carry the wrong habit over.

## Header

```
0x00  u16      0
0x02  u8       1
0x03  u8       1
0x04  u8       kind          0x00 or 0x03 in almost every file
0x05  u8       frame count N
0x06  u8       0x64, 0x00 or 0x01
0x07  u32      0
0x0B  u16      width
0x0D  u16      height
0x0F  u32      0
0x13  N x u32  cumulative frame end, counted in 16-bit words
0x13 + 4N      the payload, a stream of 16-bit words
```

The header is 19 bytes plus the frame table, which puts width and
height at **odd offsets**. Reading them two bytes later as big-endian
almost works — it gives plausible numbers on some files and nonsense on
others — so it is the easiest thing in this format to get wrong.

The size rule is exact:

```
file size == 19 + 4 * N + 2 * last cumulative count
```

Frame `i` owns the words in `[cum[i-1], cum[i])`, with `cum[-1]` taken
as 0.

## Frame payload

Horizontal runs, repeated until the frame's words are used up:

```
u16   x
u16   y
u16   count
count x u16   pixels, RGB565
```

Pixels no run covers are transparent; there is no alpha channel and no
transparent index. Runs appear in increasing `y`, and a row with a gap
in it simply produces two runs.

## Pixels are RGB565, not RGB555

```
r = (v >> 11) & 31      g = (v >> 5) & 63      b = v & 31
```

Bit 15 is in regular use — 45.2% of the 27.1 million pixel words in the
sample corpus have it set — and under a 555 reading, where that bit is
normally unused, the hues come out wrong.

## What was verified

`python/test_corpus.py` walks a directory, reads every file, writes it
back, compares byte for byte, and then checks the invariants the format
implies — runs inside their frame, frame counts inside a `u8` — before
simulating edits and re-reading the result.

Over the 1611 distinct files available while this was written:

- **1535 of 1535 sprites round-trip byte-identical**, covering 8732
  frames and 36.9 million pixels
- **50 of 50 meshes round-trip byte-identical**
- every remaining file is classified as another format rather than
  counted as a failure

Round-tripping only proves the reader and writer agree with each other;
both could share a wrong assumption. That is what the invariant checks
and the edit simulations are for, and they are what caught the `0x07`
field being overwritten with zero.

Frame counts run from 1 to 153. Common frame sizes are 256×256 (970
files), 80×80 (167), 800×600 (34), 40×38 (30) and 40×40 (25).

## Header fields that are not always zero

The `u32` at `0x07` is zero in 1421 of the 1422 files that satisfy the
size rule. One sprite carries **71** there. Whatever it means, both
readers keep it verbatim rather than writing zero — an earlier version
assumed zero and silently destroyed it, which is exactly the kind of
bug a round-trip check catches and an eyeball does not.

The `u32` at `0x0F` is zero everywhere seen, and is preserved anyway.

## Trailing bytes are kept

A frame table describing **fewer** bytes than the file holds is accepted
and the remainder kept verbatim. One hand-edited community sprite has
202 such bytes: its cumulative table was never updated when the file
grew, and every frame it does describe is intact. Keeping the remainder
means the file both opens and writes back unchanged.

A table describing **more** than the file holds is still refused — then
a frame really is missing.

## The 23 files this rejects

These are not broken sprites. They are **other formats sharing the
extension**, and the reader names them rather than reporting the byte
that failed. Counting by distinct content, the totals below come to 23;
the file counts in each heading are the totals including duplicates
across builds.

### Effects (`.eft`, 18 files)

Bytes 2–3 are `00 00`. The head is a `u32` frame count, a `u32` width
and a `u32` height — all plausible: 4 to 13 frames at 80x80, 64x64,
48x48, 133x197 or 256x256. What follows is a chain of
`[u32 word count][runs]`, using **the same run encoding a sprite uses**,
with empty frames written as a count of zero. That first group decodes
cleanly and the pixels come out right.

What is not known is the section **after** that first group. It is
large — 4664 of 5126 bytes in the smallest file — and reading it as
another group of the same shape produces nonsense. Until it is
identified these are refused rather than opened wrongly, since writing
one back would destroy whatever that section holds.

### Map layout (`map.spr`, 14 files)

Not an image at all: a grid of tile values, one byte per cell, and the
head is a single value repeated across a row. This is the first sight
of a map format in these files — the roadmap had it as not started.

### Map blocks (`block.spr`, 14 files)

Bytes 2–3 are `99 99`. Values look packed two per byte — `0x99` is two
nines, `0x22` two twos, `0x29` a two then a nine. 588800 bytes. Not an
image, and not decoded.

### Interface (`UI_userdraw.spr`, 12 files)

High entropy from the first byte, with no readable header. Either
compressed or encrypted; not decoded.

## Editing

Because pixels are stored as direct colour rather than palette indices,
a "palette edit" means remapping the colours that are actually present.
That is the right primitive for these files: a character's frames are
the same artwork in different poses, so a recolour belongs to the whole
animation. `GRA.mapColors(fn, frames)` applies a colour function to
chosen frames or to all of them, and it is what both the remap and the
hue shift in the editor are built on.

Rebuilding a frame from RGBA drops transparent pixels back into runs,
so importing a PNG and saving produces a file in the same shape as the
originals.
