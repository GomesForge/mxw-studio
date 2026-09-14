# The MXW mesh format

Every 3D object in Bomberman Online — hair, hats, headbands, jackets,
shoes, back items, the collectible cards, and the two character bodies —
sits in one container. The client fetched item files over HTTP from
`bomber-world.com/itemids/<id>.bin`, so the on-disk extension is `.bin`
for items and `.MXW` for the few loose dumps that circulated.

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
B x       i16 a, b, c, i16 d, e, f, u8 parent
```

`parent` is `0xFF` for a root. The female body has 75 bones with one
root, the male 74 with one root. The bone ids in a mesh's bone table
index this list.

The meaning of the six i16 per bone is not settled. The first three read
as a position in the same units as the vertices; the last three are
likely a rotation or a pivot.

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
| `1100039` | `Back0039_10` | -43 .. 2076 | Z -1657..-825, behind |
| `1060062` | `Jacket0062_10` | 2686 .. 4801 | torso |
| `10005` | `Hair0005_00` | 3067 .. 7536 | head |
| `20031` | `Katyusha0031_00` | 3067 .. 7942 | headband |

Draw a body and any items in raw model coordinates and every piece lands
where it belongs.

## Item ids encode the slot

Read off the texture name inside each file:

| id range | texture prefix | slot |
|----------|----------------|------|
| `10002`–`10007` | `Hair00NN_00` | hair |
| `20031`–`20038` | `Katyusha00NN_00` | headband (Jp. *katyusha*) |
| `100020`–`100025` | `Back0020_00` … | the six card backs |
| `1060057`–`1060062` | `Jacket00NN_10` | jacket |
| `1100039`–`1100056` | `Back00NN_00` | back |
| `210001`, `1210001` | `boy_01`, `girl_01` | the bodies |
| `2210001` | `Shoes0026_00` | shoes |
