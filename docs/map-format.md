# The map files

`Data/map/` holds two files that are not images despite the `.spr`
extension. Both are now fully decoded: `block.spr` holds the layouts,
`map.spr` holds everything else about a map set. An earlier version of
this page had the two the wrong way round — it read the grid at the
head of each `map.spr` record and concluded that file held the
layouts. It holds one layout per set; `block.spr` holds a hundred.

Telling them apart from a sprite is easy and worth doing, because a
sprite extension invites a sprite reader: a real sprite has `01 01` at
bytes 2-3. `block.spr` starts `99 99`, `map.spr` starts `09 09`, and
in both cases that is the border tile repeating, not a header.

## `block.spr` — the layouts

**46 map sets x 100 variants x 128 bytes**, exactly 588800 bytes. Each
variant is a 17 x 15 grid of **nibbles, high nibble first**, so 255
tiles in 127.5 bytes and the last nibble is padding.

| value | tile |
|-------|------|
| `0` | floor |
| `1` | soft block, breakable, hides the items |
| `2` | hard block, a pillar |
| `9` | border wall |

```
index  = set * 100 + variant
offset = index * 128
tile(i) = i even ? byte[offset + i/2] >> 4
                 : byte[offset + i/2] & 15
```

at `i = y * 17 + x`.

Measured across all 4600 boards: 4500 have a closed border of `9`. The
hundred that do not are **set 21**, whose left and right edges open at
two rows — a tunnel map, where walking off one side returns you at the
other. An editor must not close those automatically.

Sixteen sets carry one layout repeated a hundred times: 0 to 9, 18,
27, 36, 43, 44 and 45. The other thirty vary, 64 distinct variants on
average and up to the full hundred. A match picks a variant, so a set
is a theme with a hundred rooms, not one room.

## `map.spr` — one record per set

46 records, 16649 bytes, consumed exactly with nothing left over.

| bytes | what |
|-------|------|
| 255 | the legacy grid: 17 x 15, **one byte per tile** |
| 2 | skipped |
| 2 | `u16 n`, the object count |
| 7 x n | the objects, below |
| 14 | how many of each item the soft blocks hide |
| 1 | skipped |
| 24 | six spawn tiles, `{s16 x, s16 y}` each |
| 2 | skipped |

The 255-byte head is the layout the original executable used, and the
web client steps over it: `block.spr` supersedes it. It encodes the
same four tiles **differently** — `0` floor, `2` hard, `3` soft, `9`
border — so soft and hard swap meaning between the two files. Translate
it and it matches `block.spr`'s variant 0 in the sixteen sets that have
only one variant, which is the arrangement you would expect.

Of the six spawn slots, 246 are in use across the 46 sets and every one
of them lands inside the board. An unused slot holds a negative x.

### Objects

Each is `{s16 x, s16 y, s16 param, u8 type}` — a tile position, one
parameter whose meaning depends on the type, and the type. 407 of them
across 29 of the 46 sets.

| type | what it is | param | seen |
|------|------------|-------|------|
| `0` | warp, with a destination | the destination | 12 |
| `1` | warp, no destination | | 9 |
| `2` | drift sand | | 0 |
| `3` | conveyor belt | belt type, 0 to 19 | 126 |
| `4` | direction switch, at most two | | 1 |
| `6` | arrow, fixed | `& 3` is the facing | 133 |
| `7` | arrow, rotating | | 51 |
| `8` | tunnel, or a Soccer goal | | 20 |
| `9` | cracking ice | | 6 |
| `12` | speed panel | | 7 |
| `14` | tunnel, the other kind | | 30 |
| `15` | drift sand over the whole floor | | 1 |
| `16` | count tile, at most five | | 4 |
| `17` | the Hyper Bomb goal and its four drills | | 7 |

Type `8` reads as a Soccer goal on sets 7, 16 and 25 and as a tunnel
elsewhere; type `14` is always the third kind. The caps — 20 warps, 40
arrows, 2 switches, 20 ice, 10 panels, 5 count tiles — are the
client's, not the file's. Type `2` is in the client's dispatch but
appears nowhere in the shipped file.

### The item counts

Fourteen bytes, one per item, saying how many of that item the set's
soft blocks hide. 41 of the 46 sets fill them in. The panel names
thirteen items — Fire, Speed, Bomb, Kick, Glove, Skull, Vest, Full
fire, Louie, Punch, Line bomb, Pierce bomb, Water bomb — and the
fourteenth slot is **not identified**; it carries 35 across the file,
so it is in use.

## The Korean sets

The client loads `kr/map/block.spr` and `kr/map/map.spr` when they are
there and appends sets 46 to 49, of which 47 to 49 are the Boss Battle
caves. Same layout, 50 sets instead of 46. A server without those files
runs on 46 and the client carries on.

## Custom maps are a different thing

A custom map is not either of these files. It is a record the server
keeps, drawn by the GM panel and served as JSON, and it has its own
three screens at three sizes. See
[creating-for-the-server.md](creating-for-the-server.md).

## Where this came from

The server serves the client's modules unbundled, and
`js/game/mapdata.js` states the layout of both files in its header
comment and then parses them. Everything above was then measured
against the files themselves: the sizes, the border survey, the variant
counts, the object histogram, and a parse of `map.spr` that consumes
every byte. The spec and the data agree.

Work on copies.
