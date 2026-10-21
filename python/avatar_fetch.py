#!/usr/bin/env python3
"""Fetch avatar parts from a live server into ordinary .bin files.

    python avatar_fetch.py OUTDIR [--host https://host] [--ids FILE]
                           [--only kind,kind] [--rate N] [--workers N]

The web client builds a player out of five kinds of part and asks the
server for each one at

    /avatar/<kind>/<id>.bin

with kinds 0 bodyId, 1 faceId, 2 itemIds, 3 motionIds, 4 cameraIds,
the same numbering the download cache uses. What comes back is the
payload on its own, without the 12-byte envelope, so this wraps it back
up as

    "OK  " + u32be(1) + u32be(len) + payload

which is byte for byte the file the old client downloaded and what
python/cache_decode.py writes. Everything the editor reads then opens
it unchanged.

What exists is read from /api/catalogue when it can be reached. A list
of ids to try anyway (docs/itemids.txt, the 1306 that were on the
server in 2011) is useful for finding out which of them survive: a 404
is an answer, not a failure.

Polite by default: four workers and a short pause between batches.
Nothing is written to the server.
"""
import argparse
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

KINDS = {0: 'bodyId', 1: 'faceId', 2: 'itemIds', 3: 'motionIds',
         4: 'cameraIds'}


def get(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'mxw-studio'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b''
    except Exception as e:
        return 0, str(e).encode()


def as_served(payload):
    return b'OK  ' + struct.pack('>II', 1, len(payload)) + payload


def catalogue(host, path=None):
    """The list of what exists. /api/catalogue needs a session on some
    hosts, so a copy saved to a file can be passed instead."""
    if path:
        try:
            with open(path, encoding='utf-8') as fh:
                return json.load(fh)
        except Exception as e:
            print('could not read %s: %s' % (path, e))
            return None
    code, body = get(host.rstrip('/') + '/api/catalogue')
    if code != 200:
        return None
    try:
        return json.loads(body)
    except ValueError:
        return None


def targets(host, extra_ids, cat_path=None):
    """[(kind, id)] to ask for."""
    want = {k: set() for k in KINDS}
    cat = catalogue(host, cat_path)
    if cat:
        for b in cat.get('bodies', []):
            want[0].add(int(b))
        for f in cat.get('faces', []):
            want[1].add(int(f['id'] if isinstance(f, dict) else f))
        for it in cat.get('items', []):
            want[2].add(int(it['id'] if isinstance(it, dict) else it))
        print('catalogue: %d bodies, %d faces, %d items'
              % (len(want[0]), len(want[1]), len(want[2])))
    else:
        print('no catalogue reachable; falling back to sweeps')
    # the 2D character packs live under the body kind
    want[0].update(range(1000, 1039))
    want[0].update((210001, 1210001, 2210001))
    # motions and cameras are a short numbered run; sweep a little wider
    want[3].update(range(1, 81))
    want[4].update(range(1, 17))
    for i in extra_ids:
        want[2].add(i)
    return [(k, i) for k in sorted(want) for i in sorted(want[k])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('outdir')
    ap.add_argument('--host', default='https://onlybomb.online')
    ap.add_argument('--ids', help='extra item ids to try, one per line')
    ap.add_argument('--only', help='comma-separated kinds, e.g. 2,3')
    ap.add_argument('--catalogue',
                    help='a saved /api/catalogue, for hosts that do not serve it openly')
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--rate', type=float, default=0.05,
                    help='seconds to wait between batches')
    a = ap.parse_args()

    extra = []
    if a.ids and os.path.exists(a.ids):
        for line in open(a.ids):
            line = line.strip()
            if line.isdigit():
                extra.append(int(line))
        print('%d extra id(s) from %s' % (len(extra), a.ids))

    jobs = targets(a.host, extra, a.catalogue)
    if a.only:
        keep = {int(x) for x in a.only.split(',')}
        jobs = [j for j in jobs if j[0] in keep]
    print('%d request(s) to make' % len(jobs))

    for k in KINDS:
        os.makedirs(os.path.join(a.outdir, KINDS[k]), exist_ok=True)

    got = {k: 0 for k in KINDS}
    missing = {k: 0 for k in KINDS}
    failed = []
    bytes_in = 0

    def one(job):
        kind, i = job
        url = '%s/avatar/%d/%d.bin' % (a.host.rstrip('/'), kind, i)
        code, body = get(url)
        return kind, i, code, body

    t0 = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        for batch in range(0, len(jobs), a.workers * 8):
            chunk = jobs[batch:batch + a.workers * 8]
            for kind, i, code, body in pool.map(one, chunk):
                done += 1
                if code == 200 and body:
                    p = os.path.join(a.outdir, KINDS[kind], '%d.bin' % i)
                    with open(p, 'wb') as fh:
                        fh.write(as_served(body))
                    got[kind] += 1
                    bytes_in += len(body)
                elif code == 404:
                    missing[kind] += 1
                else:
                    failed.append((kind, i, code))
            if a.rate:
                time.sleep(a.rate)
            if done % 200 < a.workers * 8:
                print('   %d/%d, %.1f MB so far'
                      % (done, len(jobs), bytes_in / 1e6), flush=True)

    print()
    print('%-12s %8s %8s' % ('kind', 'got', 'absent'))
    for k in sorted(KINDS):
        print('%-12s %8d %8d' % (KINDS[k], got[k], missing[k]))
    print()
    print('%.1f MB in %.0f s' % (bytes_in / 1e6, time.time() - t0))
    if failed:
        print('%d request(s) neither 200 nor 404:' % len(failed))
        for kind, i, code in failed[:10]:
            print('   %s/%d -> %s' % (KINDS[kind], i, code))


if __name__ == '__main__':
    sys.exit(main())
