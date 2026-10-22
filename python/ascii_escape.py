#!/usr/bin/env python3
"""Replace every non-ASCII character in a file with a \\uXXXX escape.

    python ascii_escape.py FILE [FILE ...] [--check]

The scripts in this project are served without a charset, so a file
with a literal accented character arrives decoded as something else.
Writing the Portuguese normally and running this afterwards is far less
error-prone than typing escapes by hand, and --check makes it something
a test can assert rather than a habit to remember.

The whole converted file is built in memory before anything is opened
for writing. Opening with mode 'w' truncates before it validates, so a
conversion that raises part way through would otherwise leave an empty
file -- which has happened here twice.
"""
import io
import sys


def escape(text):
    out = []
    for ch in text:
        o = ord(ch)
        if o < 128:
            out.append(ch)
        elif o <= 0xFFFF:
            out.append('\\u%04x' % o)
        else:
            o -= 0x10000
            out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10),
                                           0xDC00 + (o & 0x3FF)))
    return ''.join(out)


def main(argv):
    check = '--check' in argv
    paths = [a for a in argv if not a.startswith('--')]
    if not paths:
        print(__doc__.strip())
        return 2
    bad = 0
    for p in paths:
        src = io.open(p, encoding='utf-8').read()
        out = escape(src)
        n = sum(1 for ch in src if ord(ch) > 127)
        if check:
            if n:
                print('%s: %d non-ASCII character(s)' % (p, n))
                bad += 1
            continue
        if out == src:
            print('%-28s already ASCII' % p)
            continue
        data = out.encode('ascii')          # fails here, file still intact
        io.open(p, 'wb').write(data)
        print('%-28s escaped %d character(s)' % (p, n))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
