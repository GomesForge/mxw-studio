# `Data/cache/*.dat` — the client's download store, and how to read it

Every avatar piece, face, body, motion and camera the client ever used was
downloaded over HTTP and kept in `Data/cache`, one file per resource, under
a keystream. The names look like noise and the bodies measure 8.000 bits of
entropy per byte, which is why this looked shut for a long time.

It is not shut. The whole scheme came out of a client build whose
`BomberMan.exe` is **not** packed, and the decoder is
[python/cache_decode.py](../python/cache_decode.py).

## The name is the resource

```
key    = kind << 28 | id
kind   = 0 bodyId   1 faceId   2 itemIds   3 motionIds   4 cameraIds
name   = base32(key XOR 0x19640421), least significant digit first,
         7 digits over the alphabet  0PQ12RH3J4K5L6M7NEFGZS8TVAB9CWXY
```

So `N1LM8L0` is key `0x00033451`, kind 0 and id 210001, which is
`bodyId/210001.bin`. It runs both ways: given an id you can name its cache
file, and given a cache file you know exactly what it holds.

The alphabet is a 32-character set with `D`, `I`, `O` and `U` left out, and
it is stored in the binary in that scrambled order rather than sorted, which
is why guessing it never worked.

The five kinds are the five asset directories the client asks for. They are
in the binary as plain strings, next to the format it builds the request
with:

```
http://<host>/get_avatar_binary.php?%s=%d       the original endpoint
http://<host>/%s/%d.bin                         what the later launcher used
```

## The body is a keystream XOR

```
file   = [8 bytes ^ ks] [payload ^ ks] [1..2048 further ks bytes]
header = u32le payload length, u32le CRC-32 of the payload
```

The generator is seeded with the same key as the name, holds two 16-bit
halves, and yields one byte per step:

```
a = key & 0xFFFF            s0: shift and feedback
c = key >> 16               s1: a plain counter

each step:
    hi = ((a & 0x7F) << 8) ^ (a & 0x7F00)
    lo = (a ^ c) & 0xFF
    fb = ((a >> 14) & 1) ^ (a & 1)
    c  = (c + 1) & 0xFFFF
    a  = (((hi | lo) << 1) | fb) & 0xFFFF
    out = (a & 0xFF) ^ ((a >> 8) & 0xFF)
```

One byte of keystream per byte of file, continuous across the header and the
payload, and it keeps running into the tail.

That tail is **random padding**, 1 to 2048 bytes of bare keystream chosen at
write time. It is the whole reason a cached copy is about 1.25 percent larger
than the file it holds, and the reason two caches of the same resource come
out at different lengths. Average padding is 1024 bytes, so it shows up as a
bigger overhead on small files than large ones.

The CRC is the ordinary zlib CRC-32, and it is **also the 4-byte token every
row of `get_item_list.bin` carries**. That closes a question
[get-item-list-format.md](get-item-list-format.md) had left open: the token
is the checksum of the asset, which is how the client knows a cached copy is
stale without downloading it again.

## Getting the original file back

The payload is the response with its 12-byte envelope stripped, so the bytes
the server put on the wire are

```
"OK  " + u32be(1) + u32be(len(payload)) + payload
```

which is byte for byte a `.bin` as [mxw-format.md](mxw-format.md) describes
it. Both body meshes reconstruct **byte-identical** to the copies already in
the archive, and the one item mesh held in both places matches too, so the
pipeline is verified end to end and not merely plausible.

## What comes out

**Nine** cache directories exist in the archive. Eight came with the clients
already held and gave 136 distinct resources between them; the ninth, a 4.5
install added later, holds 621 entries on its own and is where most of the
wardrobe actually came from. Decoded together, deduplicated by resource,
CRC and content:

| kind | the first eight | with the 4.5 cache | what |
|------|----------------:|-------------------:|------|
| `bodyId` | 2 | 2 | the two full bodies, 210001 and 1210001 |
| `faceId` | 5 | **32** | a face is one 128x128 texture and no geometry at all |
| `itemIds` | 62 | **559** | wearables across all eight worn classes, 3 of them a second revision |
| `motionIds` | 24 | 24 | original animation, see [motion-format.md](motion-format.md) |
| `cameraIds` | 5 | 5 | 40-byte camera definitions, ids 2 to 6 |
| kind 0, ids 1000 to 1038 | 39 | **41** | a CRC field of zero and a payload that is an 8-byte prefix plus a `.spr`. 39 character sheets, 2 of them in two revisions, see below |

Pass every cache directory to the decoder in one call rather than decoding
them separately and merging the output by hand. The decoder is what knows
which copies are the same resource, and a merge by filename silently keeps
whichever it met first.

### Is the merge complete?

Audited three independent ways, so the answer does not rest on having
found the right folders:

| what was searched | cache files | distinct payloads | not in the merge |
|-------------------|------------:|------------------:|-----------------:|
| the whole tree, by **file-name shape** rather than by a folder called `cache` | 1188 | 661 | **0** |
| the 7 zip archives that hold any | 1038 | 661 | **0** |
| the 92 non-zip archives (rar, 7z, cab, installers) | 0 | 0 | **0** |

The name shape is the test: a 7-character stem over the client's own base32
alphabet, which is what the naming scheme at the top of this page produces.
Searching for folders named `cache` would have assumed the answer.

The zips are the originals of the extracted folders and reproduce the same
661 payloads exactly, which is a second, independent derivation of the set
rather than a restatement of the first. The non-zip archives were scanned at
byte level for a cache-shaped name, since rar and 7z keep names in plain in
their headers; none appears. `CACHE_DECIFRADO.rar` is a backup of an earlier
extraction, 137 `.bin` files already contained here, and `01_Characters.rar`
is 1143 `.gra` sprites and no cache at all.

So `BMO/27_CACHE_MERGED`, at **661 payloads**, is everything the archive
holds. Decoding a newly found cache can only add to it, never change it.

Every avatar and motion entry passes its CRC, in both sets. The 39 odd ones
are written with a zero checksum by the code that stores them, so they land
in their own directory and are flagged rather than silently mixed in.

### The 39 are characters, not scenery

They were filed as stage art on the strength of the payload being a `.spr`
rather than a mesh. Opening them says otherwise. All 39 are the same shape,
**8 frames of 256x256**, and each one draws a different character: a helmeted
figure, a winged one, a masked one, a robot. Measured rather than described:
every one parses, writes back byte-identical, and 23.1% of their pixels fall
in the reserved tint ramp, which is the proportion the client's own player
sprites show and the reason they look grey until the runtime colours them.

The payload layout, confirmed on all 39:

```
0   "OK  " + u32be 1 + u32be (length - 12)     the ordinary server envelope
12  u32le 37                                   constant in all 39
16  u32le                                      varies, 23029..55351, undecoded
20  an ordinary sprite                         8 frames, 256x256
```

The field at 16 is not the length, the word count, the run count or the frame
count, all of which were checked. It is carried through untouched rather than
guessed at.

The practical consequence is that these open: `gra.js` sniffs the shape by
content, the sprite editor loads the sprite at offset 20, and saving writes
the 20-byte head back unchanged, so an edited character still loads. Routing
is by content and not by the `.bin` extension, which would otherwise send
them to the mesh reader.

A note on how this was missed. The old test for the item index was
`raw[:4] == "OK  "`, and **every** resource out of a cache begins that way,
because that is the envelope the server wraps them in. So all 39 were
reported as the item index and nobody looked. The test now checks what
actually distinguishes the index, 9-byte records and a count that agrees,
and the character sheets are tested for first, because one of the 39
satisfies the record-size test by coincidence.

All 559 item meshes and 32 face textures parse with **no leftover bytes** and
no refusals, which is the reader tested against nine times the material it
was written on. 620 meshes and 41 sprites write back byte-identical. The
merged corpus lives in `BMO/27_CACHE_MERGED`.

Three results worth separating out, because they are conclusions and not
just counts:

- **the wardrobe is half recovered.** 562 of the 1116 ids the shop lists now
  have their 3D file, against 67 before. Faces are complete: every face id in
  the shop is in hand, plus six the shop build does not list. The gaps are
  trousers and shoes, at roughly a quarter each, and the female half of the
  catalogue generally, at 32% against 70% for the male half.
- **the motion set is closed.** Two caches filled by different installs at
  different times carry the same 24 motion resources, **byte for byte**, with
  no id outside the 3..24 and 63..64 already known. A third source adding
  nothing is the best evidence available that 24 is all there ever was.
- **a cache can hold an older revision.** Two character sheets and three
  shirts differ between the sets, one of them by 67 KB. The decoder keys on
  **(resource, CRC, content digest)**, keeps every distinct revision under a
  suffixed name, and prefers the copy whose checksum verifies.

  The digest is in that key because of a bug worth recording. Keying on
  (resource, CRC) alone looks sufficient and is not: the 39 character sheets
  are all stored with a CRC of **zero**, so two genuinely different revisions
  of ids 1016 and 1019 hashed to the same key and the second was dropped
  without a word. A constant field cannot discriminate, and a dedupe key
  that includes one will quietly lose data rather than report a conflict.
  A verification pass that asserted every source file reappears in the
  output is what caught it.

## Why this was hard before

Worth recording, because each of these dead ends cost real time:

- **The entropy measurement was correct and useless.** A keystream XOR gives
  8.000 bits per byte, so the measurement said nothing except "not plain".
- **"No fixed XOR" was the right answer to the wrong question.** Assuming a
  known header gave a different leading key for nearly every file, which is
  exactly what a per-resource keystream does. The key varies because the
  *resource* varies, not because the scheme is strong.
- **Same name, different bytes across installs** looked like per-user keying.
  It is not. It is two different revisions of the same resource, plus a
  random padding length. 20 of the 53 shared names are byte-identical across
  two eras, which should have ruled per-install keying out earlier.
- **The 1.25 percent inflation looked like a block overhead.** Solving for a
  fixed block size gave inconsistent answers, because the overhead is a
  random number between 1 and 2048 and not a function of the length at all.
- **The packed client was the wall, and it was not the only client.** Three
  of the four builds in the archive carry an ASProtect-packed
  `BomberMan.exe`. A fourth build, from a 2024 community installer, ships an
  unpacked one, with `.text`, `.data`, `.rsrc`, `.idata` and a `.sunbeam`
  loader section, 466 kB of readable code and every string in the clear. The
  whole scheme above was read out of it in an afternoon.

The lesson worth keeping: when a format resists, check whether some other
build of the same program is easier to read before attacking the data.
