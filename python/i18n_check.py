# -*- coding: utf-8 -*-
"""What the interface can say, against what the dictionary can translate.

Two questions, and they are not the same one:

  missing  the code asks t() or tf() for a line the dictionary has no
           entry for, so it comes out in English however the language
           is set. This is the one that matters: it is how half an
           interface ends up translated.

  orphan   the dictionary has an entry nothing can ask for any more,
           usually because the English was reworded or the feature was
           removed. Harmless, but it rots.

The hard part is that a line of prose in this codebase is rarely one
string literal. It is several, joined with +, often wrapped across
lines, and often chosen by a ternary for the singular and the plural.
A checker that greps for the key as written will say that forty real
keys are orphans, which is what the first version of this did. So the
literals are read the way JavaScript reads them: concatenations are
joined, and both arms of a leading ternary are taken.

    python python/i18n_check.py          report
    python python/i18n_check.py -q       exit code only, for a hook
"""
import io
import os
import re
import sys
import glob
import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIT = r"'((?:[^'\\]|\\.)*)'"
# a literal in the source may use either quote; the dictionary's own
# keys are always single-quoted, which is why they have their own
LIT_ANY = r"(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"


def unesc(s):
    """A JavaScript string literal's body back to the characters the
    browser will see: \\uXXXX, and the quote and backslash escapes a
    key needs when the English has an apostrophe in it."""
    s = re.sub(r'\\u([0-9a-fA-F]{4})',
               lambda m: chr(int(m.group(1), 16)), s)
    return s.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')


def read(p):
    return io.open(p, encoding='utf-8', errors='replace').read()


# ---------------------------------------------------------- the keys
def dictionary():
    d = read(os.path.join(ROOT, 'i18n.js'))
    start = d.index("'pt-BR': {")
    end = d.index('\n  }', start)
    body = d[start:end]
    return [unesc(m.group(1))
            for m in re.finditer(r"\n    " + LIT + r":", body)]


# ------------------------------------------------- what the code asks
def joined(src, i):
    """A run of 'a' + 'b' + 'c' starting at i, or None."""
    parts = []
    while True:
        m = re.compile(r"\s*" + LIT_ANY).match(src, i)
        if not m:
            return (''.join(parts), i) if parts else None
        parts.append(m.group(1) if m.group(1) is not None else m.group(2))
        i = m.end()
        plus = re.compile(r"\s*\+").match(src, i)
        if not plus:
            return ''.join(parts), i
        i = plus.end()


def call_keys(src, i):
    """Every key one t()/tf() call can ask for: the plain form, and the
    'condition ? singular : plural' form the plurals are written in."""
    direct = joined(src, i)
    if direct:
        return [direct[0]]
    # The condition of a plural ternary is often a comparison against a
    # string and is often wrapped onto the next line, so quotes and
    # newlines are both allowed inside it. A closing bracket is not:
    # that would mean the call ended and the ? belongs to something
    # else entirely.
    q = re.compile(r"[^;)]{0,200}?\?").match(src, i)
    if not q:
        return []
    a = joined(src, q.end())
    if not a:
        return []
    out = [a[0]]
    colon = re.compile(r"\s*:").match(src, a[1])
    if colon:
        b = joined(src, colon.end())
        if b:
            out.append(b[0])
    return out


def asked():
    """key -> the files that ask for it."""
    out = {}
    for p in sorted(glob.glob(os.path.join(ROOT, '*.js'))):
        if os.path.basename(p) == 'i18n.js':
            continue
        src = read(p)
        for m in re.finditer(r"\b(tf?)\(", src):
            for k in call_keys(src, m.end()):
                k = unesc(k)
                if k.strip():
                    out.setdefault(k, set()).add(os.path.basename(p))
    return out


def present():
    """Every string the interface could show: the markup's own text and
    the attributes, plus every literal in the scripts. A key only has
    to appear somewhere to be reachable -- t(s.label) asks for a string
    that lives in a table, not at the call."""
    blob = []
    for p in sorted(glob.glob(os.path.join(ROOT, '*.js'))) + \
            [os.path.join(ROOT, 'index.html')]:
        if os.path.basename(p) == 'i18n.js':
            continue
        blob.append(html.unescape(unesc(read(p))))
    return '\n'.join(blob)


def main():
    quiet = '-q' in sys.argv
    keys = dictionary()
    want = asked()
    text = present()
    joined_keys = set(keys)

    missing = sorted(k for k in want if k not in joined_keys)
    orphan = sorted(k for k in keys
                    if k not in want and k not in text)
    dup = sorted({k for k in keys if keys.count(k) > 1})
    raw = sum(1 for c in read(os.path.join(ROOT, 'i18n.js')) if ord(c) > 127)

    if not quiet:
        print('keys in the dictionary : %d' % len(keys))
        print('keys the code asks for : %d' % len(want))
        print('missing (asked, not in): %d' % len(missing))
        for k in missing:
            print('    [%s] %s' % (','.join(sorted(want[k])), k[:100]))
        print('orphan (in, unreachable): %d' % len(orphan))
        for k in orphan:
            print('    %s' % k[:100])
        print('duplicated keys        : %d' % len(dup))
        for k in dup:
            print('    %s' % k[:100])
        print('non-ASCII in i18n.js   : %d' % raw)

    return 1 if (missing or dup or raw) else 0


if __name__ == '__main__':
    sys.exit(main())
