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
| `.eft` | effects | read + write, composited as the game draws them |
| `block.spr` | the game's own map layouts | read + write |
| `map.spr` | spawns, gimmicks and item counts per map set | read |
| custom map `.json` | a map for the server | read + write |
| `.zip` | a set of exports in one file | read + write |
| `.png` / `.gif` / `.json` | frames, strips, contact sheets, animations, measurements | write |

## The editor

Open the link above, or `index.html` locally. No build step, no server.

The layout follows the shape of an image editor: file and export
actions on one bar across the top, which changes with the kind of file
open; the drawing tools down the left; the canvas or the 3D view in the
middle; the panels that describe and change what is open docked on the
right; and one status line along the bottom.

The top bar carries only what is plausibly the next thing to do.
Everything else sits behind a short drop-down &mdash; **New**, and one
menu per kind of file &mdash; rather than as a row of buttons for
decisions nobody is making yet. A group appears only when a file of
its kind is open.

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

### Effects

An `.eft` opens in sprite mode like any other file, and its frame strip
shows the raw blocks, because that is what a brush can reach. A frame
of an effect is **eight layers**, each composited at its own
transparency, so a single block on its own is usually unrecognisable —
the first layer of `flame_center` is an empty frame. A dock above the
strip composites the eight the way the game does, with the alpha table
and the backdrop selectable. The backdrop is not decoration: the blend
is onto whatever is already on screen.

## Maps

Drop `block.spr` and the page switches to map mode. It is the game's
own layouts: **46 sets of 100 variants**, each a 17 x 15 board packed
two tiles to a byte. A match picks a variant, so a set is a theme with
a hundred rooms rather than one room.

- Walk the sets and variants, and see how many of a set's hundred
  actually differ — sixteen of the 46 repeat one layout a hundred times
- Paint the four tiles: floor, breakable block, pillar, wall. Drag to
  paint, right-drag to lay floor
- Copy one layout across a whole set, or put a single variant back the
  way it was
- **Check** compares what is in the editor with the file that was
  opened. Anything untouched is written back byte for byte
- Drop `map.spr` as well and each set's **spawn points, gimmicks and
  item counts** appear on the board and in the panel. That file is read
  and never written: it carries a fourteenth item slot nobody has
  identified

**New map** starts a custom map instead — the record the server keeps,
which is a different thing from either file above. Three screens, one
per field size (17 x 15, 21 x 17, 25 x 19), a theme, where people
start and what the breakable blocks hide. It leaves as the JSON the
panel takes, and the panel says what it would refuse before you get
there: starts off the floor, two on one tile, more items than there are
blocks to hide them in.

See [docs/map-format.md](docs/map-format.md).

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

## A folder as one document

**Folder&hellip;** opens a character or a bomb skin as the set it is.
Dragging the folder onto the page does the same, and so does dropping
a `.zip`, which is how one of these usually travels.

The panel lists every slot the loader will ask for &mdash; all 37 for
a character, all 12 for a bomb skin &mdash; says which are present and
how many frames each has, and clicking a row opens that file the usual
way, with the guides and the measurements. It is a table of contents,
not a second editor.

What it is for is the faults that live **between** files, which no
single file can show:

- a slot nobody drew, named
- `preview` that is not an exact copy of `st_s`, which it is supposed
  to be &mdash; 41 of 41 officials are
- `wa` frame 0 that differs from `st_s` frame 0, which shows as a jump
  at the start of every round
- a name saved with a capital in it, onto a server whose filesystem
  thinks `MO_S.GRA` and `mo_s.gra` are different files
- files the loader never asks for, with `add.gra` called out by name:
  it is the sleep pose of the 2003 game and this client has no such
  state
- how many colours the set uses, and how many of them appear in only
  one file

A bomb skin is held to a different standard on purpose. **Missing is
normal**: what a skin lacks stays the game's own, and of the forty the
server ships, every one has `bomb.spr`, thirty-one have `bomb_d.spr`,
three have the flames and none has `bomb_s.spr`. The panel says so
rather than marking eleven gaps as errors.

The export desk gains the set: every file as it was opened, and a JSON
of which slots are filled, the frame counts and what the checks found.

## Getting things out

**Export&hellip;** opens one window that lists everything that can come
out of whatever is open. Tick what you want. One tick saves one file;
several come out as a `.zip`, stored rather than compressed, with a
folder per source file so a set of numbered frames stays a set.

| open | what it offers |
|------|----------------|
| a sprite | the file; the same bytes under the other extension; every frame as a PNG; one strip; a contact sheet; the animation as a GIF; the numbers as JSON |
| an effect | the above, plus **the eight layers composited** &mdash; per frame as a PNG, or as a GIF &mdash; which is what a player sees rather than what you paint |
| a model | the container; the geometry as `.obj`; every texture; the UV layout as a PNG; the numbers as JSON |
| a map | `block.spr`; the set as JSON, deduplicated; what `map.spr` says as JSON; the board on screen as a PNG; a custom map as the panel takes it |
| anything else still open | every other container, in the same zip |

Modifiers apply to the images: scale 1&times; to 8&times; by nearest
neighbour, crop to the drawing or keep the sheet&rsquo;s own
coordinates, burn the character guides in for a reference image, and
time a GIF by the game&rsquo;s own clock rather than by the slider.

The JSON is for scripts: size, frame count, colours used, and &mdash;
for a character sheet &mdash; which of the 37 slots it is, the clock,
every frame measured, and whatever the checks found.

The quick paths on the bar are still there. The desk is for when you
want more than one thing at once, which is most of the time.

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

### Character sheets

Open one of the 37 files a character is made of &mdash; `st_s.gra`,
`mo_w.gra`, `dd.gra` &mdash; and the sprite panel gains what the game
expects of it.

A sheet is a stamp: the game presses the whole 256&times;256 at a
fixed place against the board square, so **where the drawing sits
inside the sheet is the only thing that decides where the character
appears**. Nothing looks wrong in an editor when it is off; it shows
up in a match, as a character who floats over the block in front or
walks through walls.

- **Guides drawn over the artwork**, in the sprite view and while
  painting a frame: the axis at `x 128` and the sole at `y 195`, the
  board square and its neighbours, the head box the portrait is cut
  from, the name band, the safe area, and the boxes the game&rsquo;s own
  shadow, team ring, stars and markers occupy. Each group toggles
- **Every frame measured** &mdash; sole, top, body centre, foot centre
  &mdash; next to the median the official sheets hit at that same
  frame, with the difference called out
- **The sheet named**: which of the 37 slots it is, what the game
  shows it for, how many frames it should have, and why some counts
  are not negotiable. Mounted, the game draws the Louie and the rider
  on the same frame number, so a walk of ten freezes the Louie
- **The game&rsquo;s own clock.** The file carries no timing at all: the
  game decides, per animation, in steps of 20&nbsp;ms. Play a walk at
  the 60&nbsp;ms it really gets rather than at a flat frame rate
- **The walk measure.** A character who slides instead of walking is
  the commonest fault in a first sheet and is invisible frame by
  frame. The check looks at the legs alone and says how much they
  change between frames
- **Align** moves the whole sheet onto the axis and the floor in one
  offset, so a walk keeps its own rise and fall instead of being
  flattened onto one line
- **Save guides .PNG** writes the guides alone, transparent, at sheet
  size, to draw over in anything else

The numbers come from the community guide v3, which measured 3995
official sheets against the client&rsquo;s own renderer; this project
reproduced them before writing them down. See
[docs/character-sprites.md](docs/character-sprites.md).

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
- [docs/avatar-bin-inventory.md](docs/avatar-bin-inventory.md) — the
  complete list of all 1306 wearable meshes that ever existed
  ([docs/itemids.txt](docs/itemids.txt)), which ones survive, and every
  place the rest are not
- [docs/cache-format.md](docs/cache-format.md) — the client's download
  store, decoded: the name is the resource id, the body is a keystream
  XOR, the tail is random padding. 69 meshes and 24 original motion
  files came out of it, and the decoder is
  [python/cache_decode.py](python/cache_decode.py)
- [docs/encrypted-parameter-file.md](docs/encrypted-parameter-file.md) —
  one encrypted table nobody has opened, and everything already ruled
  out on it
- [python/avatar_fetch.py](python/avatar_fetch.py) — fetch every avatar
  part from a live server into ordinary `.bin` files. 575 wearables, 32
  faces, 2 bodies, 24 motions and 5 cameras, 16 MB
- **Settings**, behind the gear in the top right: the interface in English or Portuguese, a light or dark theme or neither, and a couple of things about how it behaves while you work. Everything is kept in this browser and nowhere else
- [docs/creating-for-the-server.md](docs/creating-for-the-server.md) —
  what a costume, a bomb skin, a map and the scenery each have to be
  before they will be accepted: the names, the sizes, the limits and
  the checks
- [docs/shapes.md](docs/shapes.md) — what a mesh built from nothing
  has to contain, and the winding that caught every primitive the
  first time round
- [docs/map-format.md](docs/map-format.md) — both map files, decoded
  and measured: the nibble packing, the per-set records, the gimmick
  types and the one field still unidentified
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
