# mxw-studio

An editor and toolkit for the **MXW** asset family — the container and
companion formats used by an early-2000s online game whose servers shut
down long ago. It opens the files, shows them in 3D, lets you change
them, and writes working files back out.

**[Open the editor →](https://eastgate8.github.io/mxw-studio/)**

Nothing here ships any asset. These are tools; bring your own files.

---

## What it reads

| format | holds | status |
|--------|-------|--------|
| `.bin` / `.MXW` | 3D meshes, skeletons and textures | read + write |
| `get_item_list.bin` | the server's index of every item | read + write |
| `.gra` / `.spr` / `.eft` | 2D sprite sheets and animations | in progress |

## The editor

Open the link above, or `index.html` locally. No build step, no server.

- Drop item `.bin`, body `.bin` or `.MXW` files on the page
- 3D view: orbit, texture, wireframe, vertex normals, skeleton, axes
- **Dress-up** draws every loaded file at once. All meshes are authored
  in one shared coordinate space, so a body plus hair plus a jacket
  plus shoes line up with no fitting
- The **UV layout** of the selected texture is drawn over it, so you
  can see where to paint. Save it as a PNG to use as a guide
- **Replace a texture**: drop an image on the page. A GIF that already
  matches the slot's size is stored untouched; anything else is scaled,
  quantised and encoded to GIF89a — keeping transparency, which 36 of
  the 58 sample textures rely on
- Edit the mesh id, the texture names, and which texture each material
  draws from
- Save the edited file, or export Wavefront `.obj`

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

`python/get_item_list_decoder.py` reads and rebuilds the item index.

## Correctness

`mxw.py --check` writes each file back and compares it to the source
byte for byte. All 46 files available while this was written round-trip
identical — 37 accessories, 6 truncated `.MXW` dumps, two bodies and a
pair of shoes. Chunks the parser does not recognise are kept verbatim,
so that holds even for structures still undocumented here.

## Format notes

- [docs/mxw-format.md](docs/mxw-format.md) — the container, the mesh
  payload, the skeleton, and the three things that are easy to get wrong
- [docs/get-item-list-format.md](docs/get-item-list-format.md) — the
  item index, and how to obtain a copy
- [docs/encrypted-parameter-file.md](docs/encrypted-parameter-file.md) —
  one encrypted table nobody has opened, and everything already ruled
  out on it
- [docs/roadmap.md](docs/roadmap.md) — where this is going

## Contributing

Issues and pull requests are welcome. `main` is protected: changes land
through a reviewed pull request.

What would help most right now is the sprite side — see the roadmap.

## Credits

Community researchers got a long way into these files first, in forum
threads from 2008 to 2010: **Broomop**, **Segovia** and **Bomberguy** in
particular. Segovia noticed in 2008 that item files differ at offsets
`0A-0B` without knowing those bytes were the mesh id, and Broomop had
already worked out the item index well before any of this.

## Licence

MIT, see [LICENSE](LICENSE). This project is unaffiliated with any
rights holder, ships none of their files, and exists for
interoperability and preservation. Every name in the format
documentation is a literal byte string or file name found inside the
formats themselves.
