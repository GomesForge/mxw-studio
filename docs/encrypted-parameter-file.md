# The encrypted parameter file

An encrypted or custom-compressed file that ships in every build of the
release, from the earliest to the last community client. It
is not opened by anything here. This is a record of what is known and
what has already been ruled out, so nobody repeats it.

## The copies

| bytes | build | copies |
|-------|-------|--------|
| 23518 | Japan 2003-02 and 2003-07 | 2, byte-identical to each other |
| 23420 | Japan 2004 | 1 |
| 3334 | the community server beta, 2.1, 3.0, 4.0 | 5, byte-identical to each other |

Three distinct contents across roughly seven years.

## It has its own signature

```
0x00  4 bytes  differ in every copy
0x04  4 bytes  57 9A 31 FF   identical in all three
0x08  ...      the payload
```

`57 9A 31 FF` is unchanged from the 2003 Japanese build to the last
community client. Across 14,987 files checked, **nothing else anywhere has
that magic** — including the encrypted `Data/cache/*.dat`, which use a
different container. So whatever this is, it is specific to this file.

## What it is likely to hold

It lives in the projectile asset folder beside eight plaintext `.spr`
and `.gra` sprite files — and it is the only encrypted file in that
folder. That reads like the bomb and character parameter table: blast
radius, fuse timing, movement speed. The numbers you would not want
players editing, which is why they are the ones that got encrypted.

## What has been ruled out

- **The byte histogram is statistically indistinguishable from
  uniform.** Chi-square against a uniform expectation of ~255 comes out
  at 240.1, 259.6 and 247.0 for the three copies. That rules out any
  substitution or transposition cipher, both of which preserve the
  original's non-uniformity.
- **No zlib, deflate or gzip** stream at any of the first 2048 offsets.
- **No XOR key.** Tried the `u32` at `0x00`, the magic at `0x04`, the
  two XORed together, `0xFF`, and the full 8-byte header; entropy stays
  at 7.94–7.95 in every case. No repeating key of length 1 to 64 either
  — the per-column entropy never drops.
- **Not a rolling XOR or a rolling subtract** (7.947 and 7.943).
- **The `u32` at `0x00` is not an uncompressed size** in any byte order
  or shift: it decodes to 188787411 / 560480734 / 1553381808 big-endian
  against files of 3334 / 23518 / 23420 bytes.
- It is also not a CRC32, Adler32 or plain sum of the payload.

## The strongest clue

The Japan 2003 and Japan 2004 copies are nearly the same length and
share **only 0.5%** of their bytes. A small change in content rewrites
the entire payload. That is what a stream cipher with a per-file seed
does — and bytes `0x00`–`0x03`, which differ in every copy, are the
obvious candidate for that seed. Custom compression would do the same
thing.

## Why it is the best target

At **3334 bytes** the the community server copy is by far the smallest encrypted
file of its kind. The `Data/cache/*.dat` textures are much larger and
there are 39 of them. Three generations of this file exist, two of them
byte-identical, so a candidate routine can be checked against
independent samples immediately. If the same cipher protects the cache,
this is the cheaper door.

The routine is inside the client executable, which ships **ASPack-packed**
(an `.adata` section). It is not in `syswin.dll` — that one only does
hotkeys (`RegisterHotKey`, `GetAsyncKeyState`). There are no Blowfish,
AES, TEA, MD5 or CRC32 constants anywhere in the binary, so expect
something hand-rolled.

> Some executables shipped with community tools for these files are
> flagged by multiple engines as `Trojan-Downloader.Win32.Banload`.
> Anything packed hides its imports, so a clean-looking import table
> proves nothing. Check hashes before running old binaries.
