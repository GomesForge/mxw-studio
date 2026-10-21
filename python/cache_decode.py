#!/usr/bin/env python3
"""Turn a client's Data/cache/*.dat back into the files the server served.

    python cache_decode.py OUTDIR CACHEDIR [CACHEDIR ...]

Every cache entry is one HTTP response the client downloaded once and kept.
The name is the resource it holds, the body is that resource under a
keystream, and both come straight out of the client:

    key    = kind << 28 | id
    kind   = 0 bodyId, 1 faceId, 2 itemIds, 3 motionIds, 4 cameraIds
    name   = base32(key ^ 0x19640421), least significant digit first,
             7 digits over "0PQ12RH3J4K5L6M7NEFGZS8TVAB9CWXY"
    file   = [8 bytes ^ ks] [payload ^ ks] [1..2048 further ks bytes]
    header = u32le payload length, u32le CRC-32 of the payload
    ks     = a 16+16 bit generator seeded with the key, one byte per step

The trailing run is random padding, 1 to 2048 bytes of bare keystream, which
is why two caches of the same resource differ in length.

The payload is the response with its 12-byte envelope removed, so the file
the server sent is

    "OK  " + u32be(1) + u32be(len(payload)) + payload

The CRC in the header is the ordinary zlib CRC-32, and it is also the 4-byte
token each row of get_item_list.bin carries. Some entries are stored with a zero CRC
instead; those land in a separate directory and are flagged. All 39 seen so
far are character sheets, a sprite behind a 20-byte head.
"""
import collections
import hashlib
import os
import struct
import sys
import zlib

ALPHA = '0PQ12RH3J4K5L6M7NEFGZS8TVAB9CWXY'
MAGIC = 0x19640421
IDXOF = {c: i for i, c in enumerate(ALPHA)}
KIND = {0: 'bodyId', 1: 'faceId', 2: 'itemIds', 3: 'motionIds', 4: 'cameraIds'}


def cache_name(key):
    """the 7-character file name a client gives this resource"""
    v = key ^ MAGIC
    return ''.join(ALPHA[(v >> (5 * i)) & 0x1F] for i in range(7))


def cache_key(name):
    v = 0
    for i, c in enumerate(name.upper()):
        v |= IDXOF[c] << (5 * i)
    return v ^ MAGIC


def keystream(key, n):
    """one byte per step; s0 is 16 bits of shift and feedback, s1 a counter"""
    a = key & 0xFFFF
    c = (key >> 16) & 0xFFFF
    out = bytearray(n)
    for i in range(n):
        hi = ((a & 0x7F) << 8) ^ (a & 0x7F00)
        lo = (a ^ c) & 0xFF
        fb = ((a >> 14) & 1) ^ (a & 1)
        c = (c + 1) & 0xFFFF
        a = (((hi | lo) << 1) | fb) & 0xFFFF
        out[i] = (a & 0xFF) ^ ((a >> 8) & 0xFF)
    return bytes(out)


def decode(blob, key):
    """returns (payload, declared length, header CRC, padding length)"""
    ks = keystream(key, len(blob))
    ln, crc = struct.unpack('<II', bytes(x ^ y for x, y in zip(blob[:8], ks[:8])))
    if not 0 < ln <= len(blob) - 8:
        return None, ln, crc, None
    payload = bytes(x ^ y for x, y in zip(blob[8:8 + ln], ks[8:8 + ln]))
    return payload, ln, crc, len(blob) - 8 - ln


def as_served(payload):
    """wrap a payload back into the bytes the server put on the wire"""
    return b'OK  ' + struct.pack('>II', 1, len(payload)) + payload


def main():
    if len(sys.argv) < 3:
        print(__doc__.strip())
        return 2
    out_root, dirs = sys.argv[1], sys.argv[2:]

    # One cache may hold an older revision than another, so every distinct
    # revision is kept and the copy whose CRC checks out is preferred.
    #
    # The key is (resource, CRC, content), not (resource, CRC). Keying on
    # the CRC alone silently drops revisions of anything stored with a zero
    # checksum -- which is all 39 character sheets, two of which genuinely
    # differ between caches. The content digest costs nothing, dedupes
    # identical copies by itself, and cannot collide the way a constant
    # zero does.
    best = {}
    for d in dirs:
        for f in sorted(os.listdir(d)):
            stem, ext = os.path.splitext(f)
            if ext.lower() != '.dat' or len(stem) != 7:
                continue
            try:
                key = cache_key(stem)
            except KeyError:
                print('skipped %s: not a cache name' % f)
                continue
            blob = open(os.path.join(d, f), 'rb').read()
            payload, ln, crc, pad = decode(blob, key)
            good = payload is not None and zlib.crc32(payload) & 0xFFFFFFFF == crc
            digest = hashlib.sha1(payload).hexdigest() if payload else 'none'
            rec = (good, payload, ln, crc, pad, os.path.join(d, f), digest)
            prev = best.get((key, crc, digest))
            if prev is None or (good and not prev[0]):
                best[(key, crc, digest)] = rec

    stats = collections.Counter()
    rows = collections.defaultdict(list)
    for (key, crc, dg), (good, payload, ln, crc_f, pad, src, digest) in sorted(best.items()):
        kind, iid = key >> 28, key & 0x0FFFFFFF
        label = KIND.get(kind, 'kind%d' % kind)
        if payload is None:
            stats['undecodable'] += 1
            print('could not decode %s (%s id %d): length field %d' % (src, label, iid, ln))
            continue
        if not good:
            # the 39 character sheets are stored with a zero CRC by whatever
            # writes them; anything else is a resource whose bytes do not
            # match the checksum it was stored with
            label = label + ('_nocrc' if crc_f == 0 else '_badcrc')
        stats[label] += 1
        sub = os.path.join(out_root, label)
        os.makedirs(sub, exist_ok=True)
        name = '%d.bin' % iid
        if os.path.exists(os.path.join(sub, name)):
            # a second revision of the same resource; the CRC names it when
            # there is one, and the content does when the CRC is zero
            name = '%d.%08x.bin' % (iid, crc_f) if crc_f else                    '%d.%s.bin' % (iid, digest[:8])
            if os.path.exists(os.path.join(sub, name)):
                name = '%d.%s.bin' % (iid, digest[:8])
        with open(os.path.join(sub, name), 'wb') as fh:
            fh.write(as_served(payload))
        rows[label].append((iid, len(payload), pad, crc_f, name))

    for label in sorted(rows):
        print()
        print('%s  (%d)' % (label, len(rows[label])))
        for iid, ln, pad, crc, name in sorted(rows[label]):
            print('   %-20s id %-9d payload %-9d padding %-5d crc %08x'
                  % (name, iid, ln, pad, crc))
    print()
    print('totals:', dict(stats))
    return 0


if __name__ == '__main__':
    sys.exit(main())
