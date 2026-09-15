# The map files

`Data/map/` holds two files, and neither is an image despite the `.spr`
extension. This is a partial decode: the tile grid is settled, the rest
is not.

## `map.spr` — tile grids

16649 bytes, identical across every build checked (6 distinct copies of
the same content).

**One byte per tile, 17 columns per row.** Autocorrelation over the
file peaks at a stride of 34 with harmonics at 17 and 68; laying the
bytes out at 17 makes the structure plain:

```
row  0   XXXXXXXXXXXXXXXXX
row  1   XoooooooooooooooX
row  2   Xo.............oX
row  3   Xo.o.o.o.o.o.o.oX
row  4   Xo.............oX
row  5   Xo.o.o.o.o.o.o.oX
   ...
row 13   XoooooooooooooooX
row 14   XXXXXXXXXXXXXXXXX
```

A solid border, a ring inside it, and alternating cells across the
interior — the arrangement any tile-based map uses. So a grid is
**17 x 15 = 255 bytes**, and the file holds a series of them.

### Tile values

56 distinct values appear, but four account for 89% of the file:

| value | share | reads as |
|-------|-------|----------|
| `0x00` | 28.0% | open floor |
| `0x03` | 25.7% | a second block type |
| `0x09` | 18.5% | the hard border and the interior lattice |
| `0x02` | 16.6% | the destructible ring |

The rest are rare — `0x01` at 1.7%, then `0x06`, `0x07`, `0x04`, `0x0D`
and `0xFF` around 1% each. Those are likely spawn points, item
placements and per-tile flags, and are **not** identified.

### What is not settled

The grids are not simply concatenated. The first occupies bytes
`0..254` exactly, and what follows is not another grid: there is a run
of a single repeated value and then a short stretch that does not look
like tiles before grids resume. `16649` is not a multiple of 255
(65 grids would be 16575, leaving 74 bytes), so some interstitial data
exists and its size is not fixed.

Until that is understood the file is **not parsed** — writing one back
would destroy whatever those stretches hold. The editor identifies it
by name instead.

Next step: find every offset where a 255-byte window has a complete
border of `0x09`, list them, and see what sits between. That gives the
grid count and the shape of the interstitials at the same time.

## `block.spr` — packed values

588800 bytes, also identical across builds. Bytes 2-3 are `99 99`, and
the values look packed two per byte: `0x99` is two nines, `0x22` two
twos, `0x29` a two then a nine — the same small numbers the tile grid
uses, at half the width. Nothing else about it is known.

If it is a tile *appearance* table to the layout file's *structure*,
the two should line up once the packing is confirmed.

## How this was found

Every file in the archive went through `python/test_corpus.py`, which
reads, writes, compares byte for byte, and checks the format's
invariants. These two failed as sprites, which is how they surfaced at
all — they had been sitting behind a sprite extension.

Work on copies. The originals in an archive are the only ones there
are, and none of this analysis needs to write to them.
