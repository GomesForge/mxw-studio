# bmo-mxw-tools

Tools and format notes for the 3D data of **Bomberman Online** (MGame /
Hudson Soft, 2003) — the game that ran on the Brazilian private server
**bomber-world.com** until around 2011.

Everything here was reverse engineered from the files themselves. There
is a browser editor that opens the game's `.bin` meshes, shows them in
3D, lets you swap their textures and writes a working file back out, and
a Python library that does the same offline.

**No game assets are included.** These are tools; bring your own files.

---

## The browser editor

Open `web/index.html` — locally, or from any static host. It needs no
build step and no server-side anything.

- Drop item `.bin`, body `.bin` or `.MXW` files on the page
- 3D view: orbit, texture, wireframe, vertex normals, skeleton, axes
- **Dress-up** draws every loaded file at once. The game authors all
  meshes in one shared coordinate space, so a body plus hair plus a
  jacket plus shoes line up with no fitting
- The **UV layout** of the selected texture is drawn over it, so you
  can see where to paint. Save it as a PNG to use as a guide
- **Replace a texture**: drop an image on the page. A GIF that already
  matches the slot's size is stored untouched; anything else is scaled,
  quantised and encoded to GIF89a — keeping transparency, which 36 of
  the 58 textures in the archive rely on
- Edit the mesh id, the texture names, and which texture each material
  draws from
- Save the edited `.bin`, or export Wavefront `.obj`

A badge in the sidebar says whether the file currently writes back
byte-identical, so you always know if you have changed anything.

## Python

```
python python/mxw.py <file> [...]          inspect
python python/mxw.py --obj <file>          write .obj per mesh chunk
python python/mxw.py --gif <file>          write every texture
python python/mxw.py --check <file> [...]  prove the round-trip
```

```python
from mxw import MXW
m = MXW(open('1210001.bin', 'rb').read())
m.meshes[0].textures            # ['girl_01', 'girl_01_f']
m.skeletons[0].bones            # 75 bones
m.replace_gif(0, open('new.gif', 'rb').read())
open('out.bin', 'wb').write(m.write())
```

`python/get_item_list_decoder.py` reads and rebuilds
`get_item_list.bin`, the server's index of every item in the game.

## Correctness

`mxw.py --check` writes each file back and compares it to the source
byte for byte. All 46 files available while this was written round-trip
identical — 37 accessories, 6 truncated `.MXW` dumps, the two bodies and
a pair of shoes. Chunks the parser does not recognise are kept verbatim,
so that holds even for files with structures still undocumented here.

## Format notes

- [docs/mxw-format.md](docs/mxw-format.md) — the container, the mesh
  payload, the skeleton, and the three things that are easy to get wrong
- [docs/get-item-list-format.md](docs/get-item-list-format.md) — the
  item index, and how to get a copy
- [docs/bomber-dat.md](docs/bomber-dat.md) — `Data/bomb/Bomber.dat`:
  what is known, and everything that did not work on it

## Credits

The 2008–2010 threads on the BMO WORLD forum got a long way into these
files first — **Broomop**, **Segovia** and **Bomberguy** in particular.
Segovia spotted in 2008 that the card `.bin` files differ at offsets
`0A-0B` without knowing those bytes were the mesh id, and Broomop had
already broken `get_item_list.bin` well before any of this.

## Licence

MIT, see [LICENSE](LICENSE). Bomberman is a trademark of Konami; this
project is unaffiliated with Konami, Hudson Soft or MGame, ships none of
their files, and is for interoperability and preservation.
