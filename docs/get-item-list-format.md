# get_item_list.bin — the item index

The server's index of every item that exists in the game. The client
fetched it over HTTP; an item that is not listed here is one the client
never requests, so a new `.bin` on the server stays invisible until it
is also registered in this file.

Broomop, the BMO WORLD admin, said as much in the `t=327` thread in
April 2010:

> get item list allocates the amount of items there are in the game
> i broke that format so i can add more and new bins

## Getting a copy

`bomber-world.com/itemids/` is gone — the path 404s and everything under
it answers with the HTTP-to-HTTPS redirect page. The Internet Archive
has a capture:

```
http://www.schtserv.com/get_item_list.bin
captured 2012-11-22 19:53:30, 12761 bytes
```

```
curl -o get_item_list.bin \
  "https://web.archive.org/web/20121122195330id_/http://www.schtserv.com/get_item_list.bin"
```

The `id_` suffix asks the Archive for the original bytes rather than a
rewritten page. No copy is committed here.

## Format — big-endian

```
0x00  char[4]  "OK  "        the same container signature as a mesh
0x04  u32      record count  1417 in the 2012 capture
0x08  count x 9 bytes:
          u8   type
          u32  item id       the .bin filename: 100020 -> 100020.bin
          u32  token
```

`12761 - 8 = 12753 = 1417 x 9` exactly, and 1417 is the `u32` at `0x04`.
Nine is the only record width that divides the body evenly.

This is what Segovia was measuring in 2008 — "pointers numbering in the
1300ish range … a few extra bits of info tacked onto each". The extra
bits are the type byte and the token.

## The type byte

| type | records | id ranges | what |
|------|---------|-----------|------|
| 01 | 4 | 1, 2, 210001, 1210001 | the two bodies |
| 02 | 36 | 1–7, 14–21, 2220001–2220021 | unidentified |
| 03 | 36 | 1, 2, 7, 40001–40019, 1040001–1040014 | unidentified |
| 04 | 1252 | see below | every wearable |
| 05 | 89 | 1–24, 55–64, 103–124, 110001–110023, 1110001–1110025 | unidentified |

Type 04 holds the bulk of the shop, grouped by slot:

```
     0-  9999 :    9      60000- 69999 :  195      1060000-1069999 :  166
 10000- 19999 :   39      70000- 79999 :   99      1070000-1079999 :  122
 20000- 29999 :   44      80000- 89999 :   74      1080000-1089999 :   94
 40000- 49999 :    1      90000- 99999 :   70      1090000-1099999 :  113
 50000- 59999 :   13     100000-109999 :   68      1100000-1109999 :   64
                         1010000-1019999 :  28     1050000-1059999 :    9
                         1020000-1029999 :  44
```

## Type 01 identifies the bodies

Four records but only two distinct tokens, each appearing twice:

```
id 1         token 0x242D3906
id 210001    token 0x242D3906   <- same mesh
id 2         token 0x07336639
id 1210001   token 0x07336639   <- same mesh
```

Two base meshes, each registered under a short id and a long one. Those
long ids are exactly the two body files: `210001.bin` (`boy_01`,
`MXW3DAVA`) and `1210001.bin` (`girl_01`, `MXW3DHUD`).

## The token — still open

Four bytes per record, and not a checksum of the item's `.bin`:

- **Not CRC32, not Adler32.** Tested against all 37 item `.bin` files
  available; zero matches for either.
- **Not the cache filename.** The `.dat` names in `Data/cache` are seven
  characters of base32, little-endian, over the alphabet
  `0123456789ABCEFGHJKLMNPQRSTVWXYZ` — 0–9 plus A–Z without D, I, O and
  U, which is 32 exactly. The first character is the one that
  increments, and `D` is skipped in runs like `AXPJ8L0, BXPJ8L0,
  CXPJ8L0, EXPJ8L0`, which confirms the alphabet. Those decode to
  35-bit values that cluster per suffix family, and none of them appear
  in this file.
- 1365 of the 1417 tokens are distinct, and repeats come in groups of
  up to six.

It reads like a server-side revision or cache-busting token. If it is
the same value that names a `.dat`, it would tie an item id to its
encrypted texture blob.

## Editing

`python/get_item_list_decoder.py` parses the file and `build()`
serialises it back. The round-trip is byte-identical, so entries can be
appended and the file rewritten.
