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
- **18 of 18 effects round-trip byte-identical**
- every remaining file is classified as another format rather than
  counted as a failure

`test_corpus.py` run over the whole archive as it stands, 2295 distinct
files: **1635 of 1635 sprites and effects round-trip byte-identical**,
along with 652 of 652 meshes, covering 10586 frames and 41.0 million
pixels, of which 9.1 million sit in the reserved ramp. Nothing is
counted as a failure: the handful that do not open are classified as
the other formats named below.

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

## Effects (`.eft`) — frames of eight alpha layers

An effect is not a sprite with a different head. It is the same
horizontal runs, grouped differently:

```
u32  frame count N
u32  width
u32  height
N x 8 x [u32 word count][runs]
```

An empty block is a word count of zero. Nothing else is in the file.

**A frame is eight layers, and a layer is a transparency level.** The
game composites all eight of a frame in order, each at a weight from a
table of eight values on a 0..32 scale, and skips any entry above 32.
Three tables ship:

| table | weights | used by |
|-------|---------|---------|
| standard | 2, 7, 10, 15, 18, 22, 28, 30 | most effects |
| player | 1, 4, 7, 10, 13, 17, 20, 25 | effects on a player |
| item | 1, 3, 6, 8, 10, 12, 15, 25 | item effects |

The blend is per channel on 5/6/5, against whatever is already on
screen — so the backdrop is part of the result, and a flame over the
dark field is not the same flame over a light one.

One more thing the blit does: it takes **the first source pixel of
every pair**, so an effect is drawn at half the horizontal resolution
of its own runs. Leaving that out makes a flame look sharper in an
editor than it ever does in play.

### This page was wrong twice

First it said a first group decoded and what followed was
unidentified. Then it said eight groups of N frames, and guessed the
difference was blast reach: *"each group reaches further across the
frame than the one before"*. The second reading had the axes swapped.
Blocks are frame-major and layer-minor — block `f * 8 + l` — not
`g * N + f`, so the "groups" were windows sliding across frame
boundaries, and the reach that seemed to grow was an artefact of that.

The byte order is identical either way, which is exactly why a
round-trip test never caught it: the same blocks come back in the same
places. A round trip proves a writer, not an interpretation.

Settled from the client's own renderer, which the server serves
unbundled: `js/game/fb565.js` parses the file and composites it, and
its `eft()` takes one frame index and walks eight layers.

Measured over every effect available, 18 distinct files:

| | |
|---|---|
| parse to the last byte | **18 of 18** |
| blocks per frame | **8** in every one |
| write back byte-identical | **18 of 18** |

Frame counts run 4 to 13, at 80x80, 64x64, 48x48, 133x197 and 256x256.

The editor keeps the flat block list in file order, so the writer is
untouched and a recolour still reaches every layer. The frame strip
shows the layers one at a time, which is what a brush can reach, and a
separate view composites them, which is what a player sees.

## The 5 files this rejects

These are not broken sprites. They are **other formats sharing the
extension**, and the reader names them rather than reporting the byte
that failed. Counting by distinct content there are 5 of them: two map
layouts, two block files and one interface file.

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
