# items.dat — the client's shop thumbnails

The BMOWorld 4.x client ships an `items.dat` of about 25 MB beside
`BomberMan.exe`. It is not encrypted and not related to the `.dat` files
in `Data/cache`: it is a flat archive of the shop's preview pictures,
each one keyed by its item id.

That makes it the cheapest complete list of item ids there is, and —
because you can simply look at the pictures — the way the slot of each
id class was settled.

## Format — little-endian

One record after another from offset 0, no header and no index:

```
u32   item id          10001, 1060057, …
u32   0
u32   0
u32   size             the byte length of the bitmap that follows
byte[size]             a Windows BMP: 100x150, 8 bits per pixel
byte[]                 padding to the next record
```

Records sit on a 17096-byte stride in the copy measured, of which the
bitmap is 16078 bytes — every thumbnail in that build is the same size,
so the stride is constant. Do not rely on that: walk the archive by the
`size` field, which is authoritative, and skip to the next `BM`.

The two zero fields have been zero in all 1116 records seen. They are
probably a price and a flag, or a 64-bit id, and there is no way to tell
from one file where they are always zero.

## What it holds

1116 records in the 4.x client, which is fewer than the 1252 wearables
the server's index lists — the shop previewed a subset.

| class | slot | male | female |
|-------|------|------|--------|
| 1 | hair | 30 | 22 |
| 2 | hat or headband | 19 | 31 |
| 4 | face — eyes, brows, expression | 12 | 14 |
| 5 | glasses | 11 | 8 |
| 6 | jacket | 185 | 160 |
| 7 | shirt | 93 | 107 |
| 8 | trousers | 63 | 82 |
| 9 | shoes | 61 | 103 |
| 10 | back item | 57 | 58 |

Class 11, the bodies and the open classes 221 and 222 have no thumbnails
here at all.

The first item of a class is often a placeholder reading `DEFAULT`,
which is the "nothing equipped" entry rather than an item.

## Reading it

```python
import struct, re

d = open('items.dat', 'rb').read()
for m in re.finditer(b'BM', d):
    p = m.start()
    if p < 16 or p + 54 > len(d):
        continue
    size, _, off = struct.unpack_from('<III', d, p + 2)
    hdr, w, h = struct.unpack_from('<Iii', d, p + 14)
    if not (hdr == 40 and 0 < w <= 4096 and 54 <= off < size <= len(d)):
        continue
    iid, a, b, sz = struct.unpack_from('<IIII', d, p - 16)
    if a or b or sz != size:
        continue                      # a "BM" inside pixel data
    yield iid, d[p:p + size]
```

Scanning for `BM` and then checking that the sixteen bytes in front of
it are a matching header is more robust than walking from offset 0: a
single wrong `size` would otherwise lose the rest of the file, and `BM`
occurs inside the pixel data often enough that the header check is what
does the work. 1376 occurrences of `BM`, 1116 of them real.

## Where it does not help

It carries no names, no prices and no text — only id and picture. And it
says nothing about motions: there is no class 222 thumbnail, so whatever
a motion looked like in the shop, it was not previewed from this file.
