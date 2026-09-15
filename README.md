# mxw-studio

An editor and toolkit for the **MXW** asset family — the container and
companion formats used by an early-2000s online game whose servers shut
down long ago. It opens the files, shows them in 3D, lets you change
them, and writes working files back out.

**[Open the editor →](https://gomesforge.github.io/mxw-studio/)**

Nothing here ships any asset. These are tools; bring your own files.

---

## What it reads

| format | holds | status |
|--------|-------|--------|
| `.bin` / `.MXW` | 3D meshes, skeletons and textures | read + write |
| `get_item_list.bin` | the server's index of every item | read + write |
| `.gra` / `.spr` | 2D sprite frames and animations | read + write |
| `.obj` | geometry, in and out of any modeller | read + write |
| `.eft` | effects | first group decoded, not opened |
| `map.spr`, `block.spr` | map tile grids | grid decoded, not opened |

## The editor

Open the link above, or `index.html` locally. No build step, no server.

The layout follows the shape of an image editor: file and export
actions on one bar across the top, which changes with the kind of file
open; the drawing tools down the left; the canvas or the 3D view in the
middle; the panels that describe and change what is open docked on the
right; and one status line along the bottom.

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
- **Paint the texture in place**, with the UV layout drawn on top so a
  garment lands where you mean it to, layers, and undo
- Edit the mesh id, the texture names, and which texture each material
  draws from
- **Import and export Wavefront `.obj`**, so geometry can go through any
  modeller. The round trip is lossless against this project's own
  export: every vertex and texture coordinate comes back identical.
  Importing into a loaded file keeps the textures, texture names and
  material bindings, and says plainly what an OBJ cannot carry
- Save the edited file

A badge in the status bar says whether the file currently writes back
byte-identical, so you always know if you have changed anything.

The characters face &minus;Z, measured rather than assumed &mdash; see
[docs/mxw-format.md](docs/mxw-format.md). Front, Face and Whole look
from that side, so the model faces you.

## Sprites

Drop a `.gra`, `.spr` or `.eft` and the page switches to sprite mode.

- Frame strip with playback, adjustable speed and zoom
- Every colour in the file as a swatch grid
- **Remap a colour** or **shift hue, saturation and lightness** across
  *every frame at once*. A character's frames are the same artwork in
  different poses, so a recolour belongs to the whole animation rather
  than one frame; both tools default to all frames and can be narrowed
  to the current one
- Export a single frame or a strip of every frame as PNG, edit it
  anywhere, and drop it back. A strip exactly as wide as all the frames
  side by side is sliced across them; anything else replaces the
  current frame, scaled to fit
- **Paint** any frame directly: brush, eraser, flood fill, eyedropper,
  line and rectangle, with **layers** so you can draw over the original
  without destroying it, plus undo and redo
- **Start a sheet from nothing** with New sprite, then add, duplicate
  or delete frames
- A **team preview** shows how the game will recolour the sheet, and the
  panel reports what fraction of it sits in the reserved ramp
- **Save the animation as one GIF**, at the speed on the slider and in
  whichever team colours are previewed. Every frame shares one colour
  table, or the palette crawls between frames, and the result is cropped
  to the box all the frames together occupy &mdash; a bomber is about
  45&times;69 of a 256&times;256 sheet
- Save the sprite back out

```
python python/gra.py <file>            inspect
python python/gra.py --png <file>      a PNG per frame
python python/gra.py --strip <file>    one PNG of every frame
python python/gra.py --check <file>    prove the round-trip
```

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

```
python python/test_corpus.py <a directory of real files>
```

It reads every file, writes it back, compares byte for byte, checks the
invariants the format implies, then simulates edits and re-reads the
result. Read-only on the directory.

Over the 1611 distinct files available while this was written:

| | |
|---|---|
| meshes read | 50, **all byte-identical** |
| sprites read | 1535, **all byte-identical** |
| frames | 8732 |
| pixels checked | 36.9 million |
| problems | none |

Everything else in those folders is classified as a different format
rather than counted as a failure: 18 effect files, 2 map layouts, 2 map
block files, 1 interface file, the item index and 2 installer files.

Round-tripping on its own only proves the reader and writer agree; both
could share a wrong assumption. That is what the invariant checks and
the edit simulations are for — and they are what caught a header field
being overwritten with zero, and the item index being accepted as a
mesh and rewritten wrongly.

## Format notes

- [docs/mxw-format.md](docs/mxw-format.md) — the container, the mesh
  payload, the skeleton, and the three things that are easy to get wrong
- [docs/gra-format.md](docs/gra-format.md) — the sprite format, its
  run encoding, and the files that do not fit it
- [docs/map-format.md](docs/map-format.md) — the map tile grid: 17x15
  bytes per arena, what the common tile values mean, and the part that
  is still unknown
- [docs/character-sprites.md](docs/character-sprites.md) — the 64
  reserved colours the game recolours at run time, the frame size the
  game tolerates, and the animation file naming
- [docs/get-item-list-format.md](docs/get-item-list-format.md) — the
  item index, and how to obtain a copy
- [docs/encrypted-parameter-file.md](docs/encrypted-parameter-file.md) —
  one encrypted table nobody has opened, and everything already ruled
  out on it
- [docs/roadmap.md](docs/roadmap.md) — where this is going

## Contributing

Issues and pull requests are welcome. `main` is protected: changes land
through a reviewed pull request.

What would help most right now is the dress room and character export
— see the roadmap.

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
