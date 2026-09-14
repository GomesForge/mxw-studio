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

Of 1444 distinct files, 1420 have a header that satisfies the size
rule. Of those:

- **1419 round-trip byte-identical** (99.93%) through the reader and
  writer in `python/gra.py` and `gra.js`
- 8057 frames decode with **exactly zero bytes left over**
- all 641465 runs fall inside their declared frame — none out of bounds

Frame counts run from 1 to 153. Common frame sizes are 256×256 (970
files), 80×80 (167), 800×600 (34), 40×38 (30) and 40×40 (25).

## The 24 files this rejects

Rather than guess at them, the reader refuses anything that does not
satisfy the size rule:

- **18 files** have `00 00` at bytes 2–3 instead of `01 01`
- **3 files** carry kind bytes `0x09`, `0x49` and `0x99`, outside the
  `0x00` / `0x03` pair everything else uses, and their frame tables do
  not satisfy the size rule. These are a different variant and are not
  decoded yet
- **2 files** contain a run with a count of zero
- **1 file** is a community-edited interface sprite whose cumulative
  table was never updated to match its new length — the frame data
  after the edit is intact, but the table says 39639 bytes where the
  file is 39841

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
