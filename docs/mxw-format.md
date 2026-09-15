# The MXW mesh format

Every 3D object — hair, hats, headbands, jackets,
shoes, back items, the collectible cards, and the two character bodies —
sits in one container. The client fetched item files over HTTP from the asset server's
`/itemids/<id>.bin` path, so the on-disk extension is `.bin` for items
and `.MXW` for the few loose dumps that circulated.

**All multi-byte integers are big-endian.**

## Container: a chunk list

```
0x00  char[4]  "OK  "
0x04  u32      version            1 in every file seen
0x08  u32      mesh id
0x0C  u32      chunk count
0x10  chunks, each:
          u32  size
          size bytes of content
```

That is the whole container. A chunk's content is identified by what it
starts with:

| starts with | it is |
|-------------|-------|
| `MXW3DHUD` | geometry or a skeleton — items, cards, the female body |
| `MXW3DAVA` | geometry or a skeleton — the male body ("AVA" = avatar) |
| `GIF8` | a texture, GIF89a |

So an accessory is chunk count 2 (one mesh, one texture) and a body is
chunk count 12 (one mesh, one skeleton, ten textures).

Geometry and skeletons carry the *same* 8-byte type string, so they are
told apart by parsing: a mesh payload has to be consumed exactly, and
what is left over is tried as a skeleton.

## Mesh payload, after the 8-byte type

```
u16       vertex count N
N x 12    i16 x, y, z, i16 nx, ny, nz      normals are unit * 32767
u8        texture count T
T x       u8 length + name
u8        material count M
M x       u8 length + name + u8[6] properties
u16       face count F
F x       u8 corner count (3 or 4), u8 material,
          corners x (u16 vertex index, u8 u, u8 v)
u8        bone range count B
B x       u16 vertex from, u16 vertex to, u8 bone id
```

`properties[4]` is an index into the texture list. On a body the `body`
material points at texture 0 and `head` at texture 1.

`u` and `v` are texture **pixels**, not normalised: on a 128x128 texture
they run 0..128, on a 256x256 one up to 253. Divide by the size of the
GIF that material points at.

The bone ranges partition the vertex list into contiguous spans — every
range's `from` equals the previous range's `to`, and the last `to` is the
vertex count. That is the skinning: each span follows one bone.

## Skeleton payload, after the 8-byte type

```
u8        bone count B
B x       i16 0, i16 offset y, i16 offset z,
          i16 rot x, i16 rot y, i16 rot z, u8 parent
```

`parent` is `0xFF` for a root. The female body has 75 bones with one
root, the male 74 with one root. The bone ids in a mesh's bone table
index this list.

### The six i16 are an offset and a rotation

- **Field 0 is always zero** in both bodies, all 149 bones.
- **Field 1 is zero everywhere but one bone**, where it is 3083 — the
  height of the root above the floor.
- **Field 2 is the bone's length**, along its parent's axis, in the same
  units as the vertices. Non-zero in 73 of the girl's 75.
- **Fields 3, 4 and 5 are a rotation**, as a signed 12-bit angle where
  **±2047 is half a turn**. Nothing exceeds that magnitude in either
  body, and every value divides cleanly: −1023 is exactly −90°,
  −2047 exactly −180°, 1023 exactly 90°. The odd-looking
  2047-rather-than-2048 is just `0x7FF` standing in for 180°.

So a bone is "go this far along the parent, then turn by this much",
which is an ordinary rest pose — and the reason a motion file can be
nothing but a rotation per bone per frame.

### The hierarchy

Bones 0–37 are the same tree in both bodies; from 38 up the hands
differ, which is where the girl's extra bone is. Reading the vertex
ranges back onto the tree names most of it:

```
0-2  root chain          9  chest            18  head
3    hips               12  neck             19/20  upper arm R/L
4    spine              13/14  shoulder R/L  23/24  forearm R/L
5    pelvis             15/16  shin R/L      30/31  wrist R/L
6    spine 2            17  chest branch     36/37  hand R/L
7/8  leg root R/L       21/22  ankle R/L     39-74  five digits per hand
10/11  thigh R/L        25/26  foot R/L      32/33  toe R/L
```

Those names are read off the vertices each bone owns, not out of the
file — nothing in the format carries a bone name. The toes settle the
facing question from a second direction: bones 32 and 33 own vertices at
z −560..−80, pointing the same way the model faces.

## Three things that are easy to get wrong

**1. The byte after the vertex list is a texture count, not a flag.**
Every accessory declares one texture, so reading that byte as a flag and
then reading a single name appears to work — until a body, which
declares two and shifts everything after it.

**2. A GIF cannot be delimited by searching for `00 3B`.** `0x3B` is the
GIF trailer and `0x00` the block terminator before it, but a `0x00` data
byte inside the LZW stream can be followed by a sub-block whose length
byte happens to be `0x3B`. That match truncates 20 of the 58 textures in
the archive, and a truncated GIF still decodes — the missing rows come
out black, which is what makes jackets and headbands render black.
Trust the chunk size, or walk the block structure.

**3. The six `.MXW` files from `mxw.zip` are truncated.** They declare
two chunks and hold only the first; the missing one is the 8–9 KB
texture. The mesh in them is intact, which makes them a good parser
test — and a good test of whether a reader notices.

## Textures

128x128 GIF89a, no interlacing, with a global colour table of 64, 128
or 256 entries. **36 of 58 declare a transparent index**, which is what
gives hair, headbands and back items their cut-out silhouette; an
encoder that drops it turns them into solid blocks.

A body carries ten: texture 0 is the body skin, texture 1 a blank head
with ears and no features, and textures 2 to 9 are facial expressions.
The base body is faceless on purpose — the expression is swapped at
runtime. That also explains `face1.bin` … `face4.bin` from BinEditor:
they are containers holding a GIF and no mesh at all.

## One shared coordinate space

Nothing needs aligning. Measured ranges:

| file | texture | Y range | note |
|------|---------|---------|------|
| `210001` | `boy_01` | 18 .. 7090 | the male body |
| `1210001` | `girl_01` | 27 .. 7090 | the female body |
| `2210001` | `Shoes0026_00` | -38 .. 332 | at the feet |
| `1100039` | `Back0039_10` | -43 .. 2076 | Z -1657..-825, in front of the shins |
| `1100046` | `back0046_10` | 3341 .. 5058 | Z +390..+1176, on the back |
| `1060062` | `Jacket0062_10` | 2686 .. 4801 | torso |
| `10005` | `Hair0005_00` | 3067 .. 7536 | head |
| `20031` | `Katyusha0031_00` | 3067 .. 7942 | headband |

Draw a body and any items in raw model coordinates and every piece lands
where it belongs.

### The characters face &minus;Z

Worth stating because it is easy to get backwards, and we did at first.
Four independent measurements agree:

- the toes of both bodies reach Z -584, against only +196 behind the heel;
- the head material's faces are biased to Z -275, and its textured
  detail — eyes, mouth — sits at the far negative end;
- `1100046`, worn on the back, lies entirely at Z +390..+1176;
- `20035`, a bangs-style hair band worn at the front of the head, lies
  entirely at Z -880..-470.

The misleading case is `1100039`…`1100056`: sixteen files sharing one
placeholder mesh at Z -1657..-825 and shin height, despite the `Back`
prefix. Reading only those suggests the opposite, which is the mistake
to avoid.

So a camera at +Z sees the back of the head. Y is up and X is the
model's own right.

## Item ids encode the slot

An id is `[class][4 digits]`, and the female counterpart of a class is
that class plus 100 — jackets are `6xxxx` on the boy and `106xxxx` on
the girl. The bodies are class 21.

The class list is not guesswork: one later client ships
`items.dat`, an archive of 1116 shop thumbnails keyed by id (see
[items-dat-format.md](items-dat-format.md)), so each class can simply be
looked at.

| class | slot | male ids | female ids |
|-------|------|----------|------------|
| 1 | hair | `1NNNN` | `101NNNN` |
| 2 | hat or headband (Jp. *katyusha*) | `2NNNN` | `102NNNN` |
| 4 | **face** — eyes, brows, expression | `4NNNN` | `104NNNN` |
| 5 | glasses | `5NNNN` | `105NNNN` |
| 6 | jacket | `6NNNN` | `106NNNN` |
| 7 | shirt | `7NNNN` | `107NNNN` |
| 8 | trousers | `8NNNN` | `108NNNN` |
| 9 | shoes | `9NNNN` | `109NNNN` |
| 10 | back item | `10NNNN` | `110NNNN` |
| 11 | not in `items.dat`; 23 male and 25 female exist in the index | `11NNNN` | `111NNNN` |
| 21 | the body | `210001` | `1210001` |

The texture name inside each file carries a *different* number: one
global asset counter, not a per-slot one. Hair is 0002–0007, shoes 0026,
katyusha 0031–0038, back 0039–0056, jacket 0057–0062 — one unbroken
run across the slots. For most files the id's last four digits happen to
equal it, because each slot was authored in one batch.

### Two ids that do not fit

| id | what is inside | why it is odd |
|----|----------------|---------------|
| `100020`–`100025` | `Back0020_00` … | read as class 10 these are back items, and they were once called "the six card backs" here; that reading was wrong |
| `2210001` | `Shoes0026_00`, no skeleton | shoes are class 9. Either the file was renamed by whoever dumped it, or class 221 is something else |

Class 222 exists in the item index too — 21 entries, no male/female
pair. Both `221` and `222` are open.

## The meshes carry no animation

Worth stating because it is the first thing anyone asks. Both bodies
parse to exactly one mesh, one skeleton and ten GIFs, with **no leftover
bytes**: nothing is being skipped. The skeleton chunk is the hierarchy
and the bind pose only — `u8 count`, then `count × (6 × int16 + u8
parent)`, `0xFF` marking the root — 74 bones on the boy and 75 on the
girl. There are no keyframes anywhere in the file.

So whatever plays a motion reads it from a file class no dump in this
archive contains, or the client holds it. The mesh gives you the bones
and which vertices follow them; it does not give you what they do.
