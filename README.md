# mxw-studio

An editor and toolkit for the **MXW** asset family — a container
format and its companions, from an early-2000s application whose
servers are long gone. It opens the files, shows them in 3D, lets you
change them, and writes working files back out.

**[Open the editor →](https://gomesforge.github.io/mxw-studio/)**

There is a **Tutorial** button in the editor itself, in violet at the
top. Twelve sections with diagrams, from the shape of the window to
four worked examples start to finish.

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
- 3D view: drag to orbit, wheel to zoom, ctrl and the left button
  to raise and lower; texture, wireframe, vertex normals, skeleton,
  axes
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
  garment lands where you mean it to, layers, and undo. Amber edges in
  that layout mean the face shares its texels with another one: about
  half a head is mirrored, so painting a forehead paints both sides
  while each eye has its own space. The texture
  opens as a tab *inside* that file's group, beside a `model` tab, so
  the file does not go away while you edit it &mdash; move between the
  two as often as you like, and nothing is discarded until you apply or
  close the edit. A dot on the tab means the edit is still unapplied
- **Every stroke lands on the character as you make it.** While an edit
  is open the model draws the editor's canvas instead of the stored
  GIF, so there is no encode, no apply and no rebuild between the brush
  and the 3D view
- **A model panel** floats over the canvas while you paint: drag it
  anywhere by its bar, drag inside it to orbit, wheel or the +/&minus;
  buttons to zoom, `fit` to frame the whole thing, and its corner to
  resize. It holds the renderer's own canvas rather than a second
  renderer, so there is one GL context and one copy of each texture
- **Several edits at once, one per slot.** A face and a body together
  make sense, two faces do not &mdash; the model can only wear one of
  them &mdash; so the same texture reopens its own edit and a different
  texture in the same slot replaces it. Both open edits show on the
  model at the same time
- **Right-click** a texture, a tab, an open edit, a layer, a frame, the
  3D view or the pixel canvas for what applies to that thing
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

The meshes carry a skeleton &mdash; 74 bones on the boy, 75 on the girl,
with a vertex range per bone &mdash; but **no animation**. Both bodies
parse with no leftover bytes at all, so nothing is being skipped: the
file holds the hierarchy and the bind pose and stops there. Whatever
plays a motion reads it from somewhere else.

## Motion

The rig is real: the bone order, the parent chain, the rest pose and
which vertices follow which bone all come out of the file. What the six
`i16` per bone meant was derived rather than assumed &mdash; see
[docs/motion-format.md](docs/motion-format.md) &mdash; and the joints
land where a skeleton should have them.

- **Pose any bone**, by name, with a slider per axis. For an arm, swing
  moves it forward and lift raises it; for a leg, swing steps and lift
  spreads. Which axis does what was measured on the rig
- **Play a motion.** The eight actions the sprite sets themselves
  carry come first, under the names and frame counts found in those
  files &mdash; `ST` stand, `WA` walk, `MO` carrying, `PA` hit, `PU`
  push, `TH` throw, `DD` down, `WI` win &mdash; then run, sit, wave,
  nod and the rest. Scrub the frame, set the speed, loop or not
- **Every motion is checked**, not eyeballed:
  `python/check_motion.py` measures the torso angle, the feet against
  the floor, the angle at each knee, the hands' clearance from the
  torso and the head's height, frame by frame, against that body's own
  bind pose
- **Items follow the body.** Their bone tables index the body's
  skeleton, so hair follows the head bone and a jacket follows the
  hips, spine, arms and wrists &mdash; Dress-up plus a motion is a
  dressed character in movement
- **Save a pose** as a small JSON, and load one back

**The action set is read from the files; the joint angles are ours.**
No motion data for the 3D avatars survives anywhere we can find &mdash;
the meshes carry no keyframes, and
[docs/motion-format.md](docs/motion-format.md) lists everything ruled
out looking for it. What does survive is the 2D sprite sets, and those
gave the vocabulary and the timing. They could not give the angles: a
different figure, one projection, a few dozen pixels tall. When a real
motion file turns up it plays through the same player, because it is
the same thing &mdash; a rotation per bone per frame.

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
- **Onion skin**: the frames either side, ghosted underneath, so a pose
  is judged against the one before it
- **Mirror** the brush left/right, top/bottom or both, about the middle
  of the image
- `[` and `]` size the brush, `+` and `&minus;` zoom, **alt** picks a
  colour without leaving the brush, and the colours you have used stay
  one click away
- **Start a sheet from nothing** with New sprite, then add, duplicate
  or delete frames
- A **team preview** shows how the runtime recolours the sheet, and the
  panel reports what fraction of it sits in the reserved ramp
- **Save the animation as one GIF**, at the speed on the slider and in
  whichever team colours are previewed. Every frame shares one colour
  table, or the palette crawls between frames, and the result is cropped
  to the box all the frames together occupy &mdash; a figure is about
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
python python/dump_skeleton.py <file>      the bone tree, and what each bone moves
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

## Can you edit something and use it again

For meshes and sprites, yes, and it is measured rather than hoped.

| class | read | written back identical | editable here |
|-------|------|------------------------|---------------|
| mesh `.bin` `.MXW` | 50 | **50 of 50** | geometry, textures, texture names, material bindings, mesh id |
| sprite `.gra` `.spr` | 1535 | **1535 of 1535** | frames, colours, pixels |
| item index | 1 | identical | through `python/get_item_list_decoder.py` |
| effects `.eft` | first group only | no | **no** |
| map block and layout | recognised | no | not yet |
| encrypted caches | no | no | no |

That second column is the one that matters. A file you have not changed
writes back byte for byte, which means the writer agrees with the
reader on every field, including the ones this editor never shows you.
Change one thing and only that thing moves.

**What is not ready.** Most effects are `.eft`, 130 files against 27
`.gra` in the same folders. The first group of an `.eft` decodes and
the section after it does not, so those are refused rather than opened
and written back broken. Map grids are recognised but have no editor
yet. The encrypted caches sit at 8.000 bits of entropy per byte.

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
  bytes per map, what the common tile values mean, and the part that
  is still unknown
- [docs/character-sprites.md](docs/character-sprites.md) — the 64
  reserved colours the runtime substitutes, the frame size the format
  tolerates, and the animation file naming
- [docs/get-item-list-format.md](docs/get-item-list-format.md) — the
  item index, what the type byte means, and how to obtain a copy
- [docs/items-dat-format.md](docs/items-dat-format.md) — the client's
  archive of shop thumbnails, which is what settled the slot of every
  id class
- [docs/encrypted-parameter-file.md](docs/encrypted-parameter-file.md) —
  one encrypted table nobody has opened, and everything already ruled
  out on it
- [docs/shapes.md](docs/shapes.md) — what a mesh built from nothing
  has to contain, and the winding that caught every primitive the
  first time round
- [docs/motion-format.md](docs/motion-format.md) — the rest pose,
  how it was derived, which axis moves what, and what a motion file
  needs to look like
- [docs/roadmap.md](docs/roadmap.md) — where this is going

## One thing to remember when changing a script

`index.html` loads each script as `name.js?v=N`. The page and the
scripts are separate cache entries, so without that token a browser can
pair a fresh page with yesterday's script &mdash; which is exactly how
"no file open" once ended up sitting beside an open file. **Bump `N` on
every script change**, in all the tags at the bottom of `index.html`.

## Contributing

Issues and pull requests are welcome. `main` is protected: changes land
through a reviewed pull request.

What would help most right now is the dress room and character export
— see the roadmap.

## Credits

Community researchers got a long way into these files first, in forum
threads from 2008 to 2010. Segovia noticed in 2008 that item files
differ at offsets `0A-0B` without knowing those bytes were the mesh id,
and Broomop had worked out the item index well before any of this.

## Licence

MIT, see [LICENSE](LICENSE). This project is unaffiliated with any
rights holder, ships none of their files, and exists for
interoperability and preservation. Every name in the format
documentation is a literal byte string or file name found inside the
formats themselves.
