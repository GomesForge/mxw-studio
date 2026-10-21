# Every avatar `.bin` that ever existed, and where the files are

> **Settled.** The current server serves every part it has, openly, at
> `/avatar/<kind>/<id>.bin`. 638 files are in hand: 575 wearables, 32
> faces, 2 bodies, 24 motions and 5 cameras, byte for byte the same as
> the copies recovered from the caches. Use
> [python/avatar_fetch.py](../python/avatar_fetch.py). The rest of this
> page is the search that came before, kept because it says which of
> the historical 1306 survive and which do not.

## How to get them now

```
python python/avatar_fetch.py OUTDIR --ids docs/itemids.txt
```

The web client asks for each part at `/avatar/<kind>/<id>.bin`, with
kinds 0 bodyId, 1 faceId, 2 itemIds, 3 motionIds, 4 cameraIds, the same
numbering the download cache uses. What comes back is the payload
without its 12-byte envelope, so the script wraps it back up and writes
an ordinary `.bin`.

Measured against the live server:

| kind | there | of the 1306 listed in 2011 |
|------|------:|---------------------------:|
| wearables | **575** | 579 of them answered, 727 are gone |
| faces | 32 | a separate kind, not in that listing |
| bodies | 2 | `2210001` is gone |
| motions | 24 | ids 3..24, 63, 64 |
| cameras | 5 | ids 2..6 |

16 MB in all. Every file is byte-identical to the copy the caches gave,
where both exist, and the live set is a strict superset: nothing the
caches held is missing from it. `/api/catalogue` lists 524 wearables,
but 575 ids actually answer, so the listing is not the whole of what is
served.


A recurring question: can the whole wardrobe be pulled out of the
newest client? Short answer, no. The client holds the *names* and the
*pictures* of nearly every piece, and the geometry of forty of them.
The geometry of the rest only ever lived on the asset server.

This page records what is known, so the search is not repeated.

## The inventory is complete and exact

The asset server ran Apache with directory indexing switched on, and
both asset directories were captured before it went away:

| path | captured | entries |
|------|----------|---------|
| `http://bmoworld.com/itemIds/` | 2011-11-19 | **1306** `.bin` |
| `http://bmoworld.com/bodyId/`  | 2011-11-19 | **3** `.bin` |

The capture of `/itemIds/` is 60655 bytes and lists 1306 numeric
`.bin` files, ids 1 to 1110016. `docs/itemids.txt` is that list, one
id per line. `/bodyId/` lists `210001`, `1210001`, `2210001` and
nothing else, which is why there are two and only two full skeletons
plus the compact body.

Both are reachable through the Wayback Machine, and the local copy in
the archive is byte-identical to the Wayback capture.

### Cross-checked against the other two indexes

| source | ids | what it carries |
|--------|-----|-----------------|
| `/itemIds/` listing | 1306 | the geometry files themselves |
| `get_item_list.bin` | 1388 | id plus type plus a 4-byte token, no geometry |
| `items.dat` | 1117 | a 100x150 shop thumbnail per id, no geometry |

Ninety-two ids in the index have no file in the listing, which fits
what the index is for: it is the server's catalogue, and it kept rows
for pieces that were withdrawn or never shipped. Ten files in the
listing are absent from the 2012 index capture, including a class
nobody has identified yet, `272420`, `272421`, `272422`, and the lone
`600100`.

### Per class, listed against held

| class | what it is | listed | indexed | thumbnails | geometry held |
|-------|-----------|-------:|--------:|-----------:|--------------:|
| 1 / 101 | hair | 39 / 28 | 39 / 28 | 30 / 22 | 6 / 0 |
| 2 / 102 | hat, headband | 44 / 45 | 44 / 44 | 19 / 31 | 8 / 0 |
| 4 / 104 | face | 13 / 14 | 19 / 14 | 12 / 14 | 0 / 0 |
| 5 / 105 | glasses | 13 / 9 | 13 / 9 | 11 / 8 | 0 / 0 |
| 6 / 106 | jacket | 196 / 166 | 195 / 166 | 185 / 160 | 0 / 6 |
| 7 / 107 | shirt | 102 / 122 | 99 / 122 | 93 / 107 | 0 / 0 |
| 8 / 108 | trousers | 74 / 94 | 74 / 94 | 63 / 82 | 0 / 0 |
| 9 / 109 | shoes | 70 / 113 | 70 / 113 | 61 / 103 | 0 / 0 |
| 10 / 110 | back | 69 / 64 | 68 / 64 | 57 / 58 | 0 / 17 |
| 11 / 111 | unidentified | 13 / 13 | 23 / 25 | 0 / 0 | 0 / 0 |
| 27, 60 | unidentified | 4 | 0 | 0 | 0 |

Even-numbered classes are the male line, the +100 classes the female
one. The `held` column counts the 37 item and face meshes in the
community `bineditor` packages plus the three bodies. **1269 of the
1306 are missing.**

## What the client actually ships

Nothing you can turn back into geometry:

- `items.dat`, 1117 shop thumbnails, 100x150 8-bit BMP, no vertices;
- `get_item_list.bin`, the catalogue, ids and types and tokens;
- `Data/cache/*.dat`, between 67 and 115 files depending on the
  version, encoded, see below;
- the two body meshes are **not** in the client at all. The launcher
  downloads them on first run.

`launch.exe` is an unprotected Delphi binary and says plainly where it
went for them, at file offset 0x5ed44 in the 4.0 build:

```
http://www.schtserv.com/%s/%d.bin
http://www.schtserv.com/get_item_list.bin
```

The `%s` is the directory, so `itemIds` or `bodyId`, and the `%d` the
id. Both hosts are gone for this purpose now: `bmoworld.com` answers
302 and `schtserv.com` answers 403 for those paths.

## The cache really does hold `.bin` files, and it has been read

The claim is correct, and the cache is no longer closed:
[cache-format.md](cache-format.md) has the scheme and
[python/cache_decode.py](../python/cache_decode.py) is the decoder. Out
of the eight cache directories then known came **69 avatar meshes**
(2 bodies, 5 faces, 62 wearables), **24 original motion files**, 5
camera files and 39 character sheets. Every avatar and motion entry
passes its own CRC-32, and both bodies reconstruct byte-identical to the
copies already held, so the pipeline is verified rather than merely
plausible. An eighth cache, from a 4.5 install found later, took the
wearables to **557** and the faces to **32**; the figures below are the
seven-cache ones, kept because the reasoning is what they illustrate.

What follows is the reasoning that first identified the cache as a store
of `.bin` files, kept because the size relationship is still the fastest
way to recognise one. Three of the blobs lined up with the three body
meshes at a consistent ratio:

| cache file | size | body mesh | size | ratio |
|------------|-----:|-----------|-----:|------:|
| `ZC8K8C0.dat` | 15204 | `2210001.bin` | 15014 | 1.01265 |
| `N1LM8L0.dat` | 79281 | `210001.bin` | 78282 | 1.01276 |
| `NSCLTL0.dat` | 101327 | `1210001.bin` | 100087 | 1.01239 |

Those three are the only files in `/bodyId/`, they are the three
largest avatar assets, and they are the three every client must
fetch. Twenty-odd smaller blobs land on item-mesh sizes at the same
1.012 to 1.013 ratio. So the cache is a store of downloaded `.bin`
files, held in a wrapper that adds about 1.25 percent.

What one decoded cache cannot do is cover the wardrobe. A cache holds
only what that player downloaded, meaning the outfits they wore and the
outfits worn by people in their rooms. Across the eight cache
directories then known there are **136 distinct resources**, of
which 62 are wearables. Against 1306 that is under 5 percent, so
decoding one cache is a way to recover what individual players saw, not
a way to recover the catalogue. Pooling caches from more players was
named here as the only thing that moves that number.

**It was, and it did.** One further cache, out of a 4.5 install, held
628 entries by itself and carried 495 wearables the first seven did not.
The pooled total is 559 wearables and 32 faces, which is **562 of the
1116 ids the shop lists, half the catalogue**, against 67 before. Faces
came out complete. The lesson is worth stating plainly, because the
estimate above was not wrong so much as it was an estimate from one
sample: caches overlap far less than they appear to, so the next one is
worth decoding even when the last one added little. The decoder needs
nothing but the files.

Three of the four client builds in the archive carry a `BomberMan.exe`
protected with ASProtect, which is what blocked this for so long:

```
section .adata, three unnamed sections with virtual size far above raw size
entry point  68 01 d0 51 00  e8 01 00 00 00  c3 c3
             push 0x51d001 / call $+5 / ret / ret
```

3.0 and 4.0 ship the same packed binary (`f8dfe353...`) and the beta and
2.1 share an older one (`2cdba56b...`). A fourth build, from a 2024
community installer, ships an **unpacked** `BomberMan.exe`: ordinary
`.text`, `.data`, `.rsrc`, `.idata` plus a `.sunbeam` loader section,
466 kB of readable code, and every string in the clear. That is where
the cache scheme came from, and it is also where the five resource
classes came from, `bodyId`, `faceId`, `itemIds`, `motionIds` and
`cameraIds`, the last two of which nobody knew existed.

## Where the files are not

| looked at | result |
|-----------|--------|
| every `.zip` in the archive | one hit, `bodyId.zip`, the same three bodies |
| every `.rar` | two hits, both copies of `bineditor.rar`, the same 41 meshes |
| `HudsonKingdom.7z` inside the 383 MB collection | 530 files, all `.spr`, `.gra`, `.wav`, `.eft`. No `.bin` |
| the two archived copies of the community site | PHP, PNG and GIF. The `itemIds` directory is the listing only |
| Wayback, `bmoworld.com/*.bin` | nothing. Only the two directory listings were captured |
| Wayback, `schtserv.com/*.bin` | one file, `get_item_list.bin`, 2012-11-22, already held |
| the live hosts | `bmoworld.com` 302. `schtserv.com` 403. `bomber-world.com`, which the 2013 launcher points at, is **up**: it serves `get_item_list.bin` with 200 and a newer revision than the 2012 capture, 1422 rows against 1417. `/itemIds/10002.bin` answers 403 while `/itemids/10002.bin` answers 404, and on a case-sensitive filesystem that means the `itemIds` directory is **still there**, access-denied rather than gone. Same for `bodyId` |

## What would actually work

In order of how likely each is to pay off:

1. ~~Whoever administers the old host.~~ **Done, and from somewhere
   else entirely:** the current server serves them all openly. See the
   top of this page. What is still worth asking for is the 727 of the
   1306 that no longer answer, which only an old backup would have.
2. **Old players' `Data/cache` folders.** Every install anyone still
   has holds a different handful of outfits, and they can be read
   straight away now with
   [python/cache_decode.py](../python/cache_decode.py). Each folder is
   small, a few dozen files, so collecting them from a group of former
   players is cheap and adds up. Ask for the whole `Data/cache`
   directory rather than a selection, since the file names say nothing
   to the person holding them.
3. **Community tool packages.** `bineditor` shipped 41 meshes as
   editing samples. Other tools and tutorial packages from the same
   era may carry different samples, and they add up.
4. **Rebuilding from the thumbnails.** 1117 of the 1306 have a
   100x150 shop picture in `items.dat`. That is a reference image,
   not geometry, but with the primitives and transforms in
   `shapes.js` it is enough to remodel a piece deliberately rather
   than guess at it.

See [get-item-list-format.md](get-item-list-format.md) for the
catalogue, [items-dat-format.md](items-dat-format.md) for the
thumbnails, [mxw-format.md](mxw-format.md) for what a `.bin` contains
and [encrypted-parameter-file.md](encrypted-parameter-file.md) for the
other encoded file in the client.
