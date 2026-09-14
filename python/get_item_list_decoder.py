#!/usr/bin/env python3
"""Decoder for get_item_list.bin, an online game's item index.

The file is the server-side index of every item that exists in the game.
The client fetched it over HTTP; without an entry here the client never
requests the item's .bin, so a new item is invisible until it is added.

Recovered from the Internet Archive:
    http://www.schtserv.com/get_item_list.bin   captured 2012-11-22
    (9470 bytes stored, 12761 bytes raw)

FORMAT -- all multi-byte integers are BIG-ENDIAN.

    0x00  char[4]  "OK  "      same container signature as .MXW / item .bin
    0x04  u32      count       number of records (1417 in this capture)
    0x08  count x 9 bytes:
              u8   type        item class, see below
              u32  item_id     the .bin filename, e.g. 100020 -> 100020.bin
              u32  token       32-bit value, NOT a checksum of the .bin

Validation: 12761 - 8 = 12753 = 1417 x 9 exactly, and 1417 matches the
u32 at 0x04. 9 is the only record width that divides evenly. This also
matches what Segovia measured in 2008 on the t=327 thread -- "pointers
numbering in the 1300ish range ... a few extra bits of info tacked onto
each": the extra bits are the type byte and the token.

TYPE BYTE (counts from this capture)

    01      4 items    the two base bodies -- see note below
    02     36 items    ids 1-7, 14-21, 2220001-2220021
    03     36 items    ids 1, 2, 7, 40001-40019, 1040001-1040014
    04   1252 items    every wearable/cosmetic (hair, headbands, jackets,
                       backs, cards) -- the bulk of the shop
    05     89 items    ids 1-24, 55-64, 103-124, 110001-110023,
                       1110001-1110025

Type 01 is the interesting one. It holds exactly four records but only
two distinct tokens, each appearing twice:

    id 1        token 0x242D3906
    id 210001   token 0x242D3906    <- same
    id 2        token 0x07336639
    id 1210001  token 0x07336639    <- same

Two meshes, each registered under a short id and a long id. That is the
male and the female base body. Neither .bin is in the archive.

THE TOKEN FIELD

Not CRC32 and not Adler32 of the .bin -- tested against the 37 item
.bin files in the archive, zero matches. It is also not the 7-character
base32 cache filename: those decode (little-endian, alphabet
"0123456789ABCEFGHJKLMNPQRSTVWXYZ" -- 0-9 plus A-Z minus D, I, O, U) to
35-bit values that do not appear in this file either. Most likely a
server-side revision/cache-busting token.

ITEM ID ENCODES THE SLOT

The leading digits of item_id select the body slot. Confirmed by reading
the texture name out of each .bin we have:

    10002-10007        Hair00NN_00       hair
    20031-20038        Katyusha00NN_00   headband (Jp. katyusha)
    1060057-1060062    Jacket00NN_10     jacket
    1100039-1100056    Back00NN_00       back
    100020-100025      Back0020_00..     the six card backs

usage:
    python get_item_list_decoder.py get_item_list.bin
    python get_item_list_decoder.py get_item_list.bin --csv out.csv
"""
import struct
import sys


def parse(data):
    if data[:4] != b'OK  ':
        raise ValueError('not an item list (signature %r)' % data[:4])
    count = struct.unpack_from('>I', data, 4)[0]
    body = len(data) - 8
    if body != count * 9:
        raise ValueError('expected %d bytes of records, file has %d'
                         % (count * 9, body))
    out = []
    p = 8
    for _ in range(count):
        out.append((data[p],
                    struct.unpack_from('>I', data, p + 1)[0],
                    struct.unpack_from('>I', data, p + 5)[0]))
        p += 9
    return out


def build(records):
    """Inverse of parse(): rebuild the file after adding items."""
    out = bytearray(b'OK  ')
    out += struct.pack('>I', len(records))
    for t, iid, token in records:
        out += struct.pack('>BII', t, iid, token)
    return bytes(out)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    recs = parse(open(sys.argv[1], 'rb').read())
    assert build(recs) == open(sys.argv[1], 'rb').read(), 'round-trip failed'
    print('%d records, round-trip byte-identical' % len(recs))
    if '--csv' in sys.argv:
        path = sys.argv[sys.argv.index('--csv') + 1]
        with open(path, 'w') as f:
            f.write('type,item_id,token_hex\n')
            for t, iid, token in recs:
                f.write('%d,%d,0x%08X\n' % (t, iid, token))
        print('-> %s' % path)
        return
    print('%-5s %-10s %s' % ('type', 'item_id', 'token'))
    for t, iid, token in recs:
        print('%-5d %-10d 0x%08X' % (t, iid, token))


if __name__ == '__main__':
    main()
