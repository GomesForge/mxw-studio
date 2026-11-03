# Roadmap

The goal is **one place to make anything this game is made of** —
characters, maps, bombs, scenery, the interface itself — so somebody
can build a thing end to end, export it, and have it work, without
also having to learn five file formats first.

Ordered by what unblocks the most. A section is only here once the
format behind it is known; guesses go to *Things that are genuinely
unknown* at the bottom instead.

## The whole surface

Everything the game loads, what it is, and where this editor stands.
This is the list the rest of the page is measured against.

| what | the files | here |
|------|-----------|------|
| 3D wearables and bodies | `.bin` / `.MXW` | **read, written, round-trip exact**, dressed, posed, textured |
| character sheets | 37 `.gra` | **read, written, painted**, with the sheet guides and the checks |
| a whole character | a folder of 37 | the sheets, one at a time — not yet the folder |
| effects | `.eft` | **read, written, composited** as the game draws them |
| the board | `block.spr`, `map.spr` | **read, written**; custom maps written for the panel |
| bomb skins | 12 files, mixed | the files open one by one; nothing knows they are a set |
| scenery | one PNG, three sizes | nothing |
| the interface | 59 `UI_*.spr`, 2 `.fnt` | the sprites open; the font does not |
| outfits | a 52-byte descriptor | the parts dress; the descriptor is not read or written |
| items and the shop | the item index | **read, written, rebuilt byte for byte** |
| HD sheets | `hd.json` + PNG/WebP | nothing, and no copy has turned up |

## Done

- The `.bin` / `.MXW` container: read, write, byte-identical round-trip
  on every file tested
- Mesh, skeleton and texture chunks, including the bone table
- 3D view with per-material textures
- Dress-up: several files drawn together in their shared coordinate space
- UV layout drawn over the selected texture, exportable as PNG
- Texture replacement, with a GIF89a encoder that preserves the
  transparent index
- The item index format, with a byte-identical rebuild
- **The sprite format**: header, frame table and run encoding decoded;
  1419 of 1420 accepted files round-trip byte-identical across 8057
  frames. See [gra-format.md](gra-format.md)
- **Sprite mode**: frame playback, colour remapping and an HSV shift
  that reach every frame at once, PNG frame and strip import/export
- **A pixel editor with layers**, used for both mesh textures and
  sprite frames: brush, eraser, fill, eyedropper, line and rectangle,
  undo and redo, and the UV layout drawn over a texture while painting
- **Creating a sheet from nothing**, and adding, duplicating or
  deleting frames
- **The 64 reserved colours** identified and measured, with a team
  preview and a report of how much of a sheet the runtime recolours --
  see [character-sprites.md](character-sprites.md)
- **Wavefront OBJ import**, lossless against this project's own export:
  every vertex and every texture coordinate comes back identical.
  Importing into a loaded file keeps the textures, the texture names and
  the material bindings, and says what an OBJ cannot carry
- **A corpus test suite** (`python/test_corpus.py`): read, write,
  compare byte for byte, check the format's invariants, simulate edits
  and re-read. It found two real bugs — a header field being
  overwritten with zero, and the item index being accepted as a mesh
- **The map files**, both of them. `block.spr` is 46 sets x 100
  variants of a 17 x 15 board packed two tiles to a byte; `map.spr` is
  one record per set with the spawns, the gimmicks and the item counts.
  A map editor opens the first, reads the second and writes custom maps
  for the server. See [map-format.md](map-format.md)
- **A shelf**: a movable window holding everything opened, in folders
  you make, name, nest, drag between and throw out, with one command
  that files a character's sheets by animation and another that saves
  any folder of it as a zip
- **A folder as one document**: a character or a bomb skin opened as
  a set, from a folder, a drag or a zip, with every slot the loader
  asks for listed and the checks that need two files at once -- the
  missing slot, the preview that drifted from the stand, the capital
  letter on a case-sensitive server
- **One export desk**: everything that can come out of whatever is
  open, listed in one window, ticked, and written as a file or as a
  zip. Images scale, crop and can carry the guides; an effect exports
  composited as well as raw; a GIF can run on the game's own clock;
  and a JSON of the measurements comes out beside the artwork
- **The character sheet's geometry**: the axis, the sole, the board
  square, the head box, the name band, the safe area and the game's
  own effect boxes drawn over the artwork; every frame measured
  against the officials; the 37 sheets by name with the counts the
  game enforces; the game's own clock; the walk measure; and one
  offset that puts a whole sheet on the floor. See
  [character-sprites.md](character-sprites.md)
- **Named viewpoints**, and textures classified by the slot the file
  itself names them in, so an image lands on the right material -- the
  body skin is never offered as a face -- without the camera moving

## 1. Sprite editing, the parts still missing

Playback, colour remapping and an HSV shift across every frame are
done. What is left:

- **Propagate a pixel patch**, not just a colour. Pick a region on one
  frame and paste it into the same place on the others. Colour edits
  generalise for free; a patch needs an anchor, so align by each
  frame's own bounding box rather than by absolute coordinates
- **Colour count guard**: a photograph imported into a sprite explodes
  the distinct-colour count and the file with it. Warn, and offer to
  quantise on import
- The 3 files carrying kind bytes `0x09`, `0x49` and `0x99`, which are
  a variant this reader refuses

Direction groups moved to section 2, where the rest of the character
work now lives. Onion skinning is done: painting a frame draws the
frames either side underneath it.

Worth knowing before touching this: the pixels are **direct RGB565**,
not palette indices. There is no palette to edit, so a recolour is a
remap of the colours that happen to be present — which is what makes it
propagate cleanly across frames.

## 2. Characters, end to end

A character is 37 sheets that have to agree with each other, and the
hard part was never the pixels: it is that nothing in an editor tells
you a drawing is in the wrong place. It shows up in a match.

**Done.** The sheet geometry is in the editor:

- the axis at `x = 128`, the sole at `y = 195`, the board square, the
  head box the portrait is cut from, the name band, the safe area and
  the boxes the game’s own effects occupy, drawn over the artwork
  in the sprite view **and while painting a frame**
- every frame measured — sole, top, body centre, foot centre —
  against the medians the officials actually hit, frame by frame
- the 37 sheets by name, with the counts the game enforces and why
- the game’s own clock per animation, to play a walk at the 60 ms
  it really gets rather than at a flat frame rate
- the walk measure that catches a character who slides instead of
  walking, which is the commonest fault in a first sheet
- **Align**: move the whole sheet onto the axis and the floor in one
  offset, so an animation keeps its own rise and fall
- the guides as a transparent PNG, to draw over anywhere else

See [character-sprites.md](character-sprites.md).

**Next**, in the order that helps most:

- **The four facings side by side.** The set view lists them; it does
  not yet show them together, which is how a walk is actually judged
- **Edit from the set, back into the set.** Opening a sheet from a
  folder opens a copy: save it and the set does not know. The set
  should hold the sheets it opened and write the folder back
- **Mirror a facing.** The officials never mirror — they were
  rendered from both sides — but mirroring is how anybody sane
  works. Mirror `*_e` into `*_w`, and warn about the two things it
  breaks: lighting from one side, and a prop in one hand
- **The board preview.** Draw the character where it really stands:
  the shadow underneath, the block of the row below drawn **over** its
  feet, the name across the head. That is the game’s false 3D, and
  it is the fastest way to see an anchor that is off
- **Write the folder.** The 37 files and a `character.json`, ready to
  upload, with the checks run first

## 3. Dress room, improved

The pieces are already there — dress-up, the shared coordinate space,
and the slot taxonomy, which is no longer guesswork: the id's class
names the slot, and the client's `items.dat` shows what each class looks
like (see [items-dat-format.md](items-dat-format.md)).

| class | slot | | class | slot |
|-------|------|-|-------|------|
| 1 | hair | | 8 | trousers |
| 2 | hat / headband | | 9 | shoes |
| 4 | face | | 10 | back item |
| 5 | glasses | | 11 | unidentified |
| 6 | jacket | | 21 | body |
| 7 | shirt | | | |

Female is the class plus 100. What it needs:

- One item per slot, driven by the id rather than by reading the
  texture name, which only agrees by accident
- Load a folder or archive once, then browse by slot with search
- Face picker: a body carries the body skin, a blank head, then the
  facial expressions
- Save and load an outfit as a small JSON of ids, and share it as a URL
- Turntable and a pose or two, so a piece can be judged in motion
- Flag conflicts: two items in one slot, or an item whose texture is
  missing

## 4. 3D character creation, end to end

This is the 3D side: a body, clothes and a face, assembled as `.bin`
files. Section 2 is the other kind, the 2D sheets.

- Start from a body, dress it, pick a face, name it
- Export the whole set: the edited `.bin` files, the textures, and an
  item-index fragment to register anything new
- Import a mesh from `.obj`: the writer already exists, so this needs
  vertex quantisation to i16, UVs converted back to texture pixels,
  triangles kept at 3 or 4 corners, and a bone table generated — the
  simplest valid one is a single range covering every vertex
- Validate before export: vertex and face counts inside their u16 and
  u8 limits, texture indices in range, bone ranges contiguous and
  covering the whole vertex list

## 5. Maps

**Done**, and in the editor — see the Done list and
[map-format.md](map-format.md). What is left is around the edges:

- **The fourteenth item slot** in a `map.spr` record. The panel names
  thirteen items and the file carries fourteen counts. Until that is
  settled the editor reads the file and refuses to write it
- **Draw the board the way the game does.** The editor paints flat
  tiles. The game draws them from the theme's own sprites, `map/pp.spr`
  for the breakables and `map/non.spr` for the pillars, at 40 x 38 a
  cell. Both are ordinary sprites this project already reads
- **The Korean sets.** The client appends sets 46 to 49 from
  `kr/map/` when a server has them. Nothing stops the editor doing the
  same; no copy has turned up to test against

## 6. Bomb skins

A skin is **twelve files and a partial one is legal** — what it
leaves out stays the game’s own, which is why most shipped skins
carry only two. From `game/bombskins.js`: `bomb.spr` resting and
appearing, `bomb_d.spr` the placing marker, `bomb_s.spr` the shadow,
`bomb_f.eft` the fuse spark, seven `flame_*.eft` (centre, hor, ver,
right, left, up, down) and `boom_block.eft`.

- Open a folder as one document, say which of the twelve are present,
  and make clear that the gaps are legal rather than errors
- Play the bomb and its flames together, on the clock, which is the
  only way to judge one. **Nine of the twelve are effects**, and those
  composite correctly now
- A new skin from the game’s own as a starting point, so somebody
  can change the two files that matter and leave the rest

There are 40 real skins in the server backup to test against.

## 7. Scenery

The picture behind the arena. `game/sideart.js` gives the geometry
exactly: the image is `800 + 2 * side` wide by 600 game pixels, and a
field’s screen is `[40 * w + 120, 38 * h + 48]` — so 800 x 600,
960 x 694 and 1120 x 770 for the 17 x 15, 21 x 17 and 25 x 19 fields.
A design’s slot is `design + 9 * size`; a custom map’s is
`1000 + its id`.

- A canvas at the exact size with the arena rectangle drawn where it
  really falls, so the part that will be covered is obvious while
  painting
- The limits the panel enforces, checked before export

## 8. The interface: buttons, panels and the font

The least explored corner, and the one the question “can I change
the buttons” actually lands in. What is known:

- **59 `UI_*.spr`** ship with the client — the panel, the player
  numbers, the arrows, the belt direction markers, the boss board. They
  are ordinary sprites this project already reads and writes, so
  editing them needs no new format work at all: what is missing is
  knowing **which file is which part of the screen**
- **The font is a plain bitmap.** `game/fb565.js` reads
  `font/Font_Eng_6.fnt` as a **192-byte head, then 256 glyphs of 12
  bytes, one byte a row, the top 6 bits used** — which is exactly
  the 3264 bytes the file has. `Font_Han_12.fnt` is the wide one
- **It has no accented letters.** The client composes them at run
  time: the plain letter, then a mark drawn from a small table, with
  the cedilla under and a capital’s mark three rows higher. Worth
  knowing before anybody tries to “add the accents to the font”
- Each glyph is drawn with a one-pixel outline over a 17-row cell

So the work is: a panel that names the UI sprites by where they
appear, a glyph grid for the font with a writer, and a screen preview
that puts the pieces where the game puts them.

## 9. Effects, beyond reading them

The format is settled and composited (see
[gra-format.md](gra-format.md)). What would make it a tool:

- Paint a layer and watch the composite update beside it
- **Build an effect from one drawing**: take a single image and
  generate the eight alpha layers, which is how most of them read
- The three alpha tables as a preview, since the same file looks
  different on a player, on an item and on the field

## 10. What the editor still does not cover

[creating-for-the-server.md](creating-for-the-server.md) writes down
what a costume, a bomb skin, a map and the scenery each have to be
before the server will take them. What the editor cannot do about it
yet:

- **Draw a costume.** The spec is written down, but the sheets are
  generated at the other end, from a layout this editor does not
  have. A real preview means either that layout or a local copy of
  the generator
- **Block tiles for a map.** The size rules are written down but
  there is no editor for the strip
- **A character, end to end.** There is no import for a whole one at
  the other end, so the forty files are documented rather than
  packaged
- **Send anything.** Everything stays in the browser and comes out as
  a file. Handing it over is still a person talking to a person

## 11. What the unbundled client settles, and what to build on it

The server serves its own client **unbundled** — 58 modules with their
comments — and several of them state a format outright. Two of those
reads are already in: the map files and the effect layers. The rest is
written down here so nobody re-derives it.

Each item below names the module it came from. None of it is guessed.

- **Bomb skins** (`game/bombskins.js`) and **scenery**
  (`game/sideart.js`) each have a section of their own now — 6 and 7 —
  where the format and the work for it are written together.

- **The 6 x 12 font is a plain bitmap**, and the client composes
  accented letters itself rather than carrying them. `game/fb565.js`;
  section 8.

- **Draw the map board the way the game does.** `mapmaker.js` maps
  designs 1 to 7 to sprite indices in `map/pp.spr` (breakables) and
  `map/non.spr` (pillars), with a cell at `40 + 40c, 28 + 38r` and 40
  wide. Both are ordinary sprites this project already reads, so the
  map editor could drop its flat colours for the real artwork.

- **An outfit is a 52-byte descriptor.** `game/outfits.js`: body `u32`
  at +4, face `u32` at +8, then eight item `u32` from +12. A body under
  200000 is not 3D, and 1000 to 1038 are the 2D packs. That is the
  save-and-share-an-outfit item in section 3, with the real format
  rather than an invented one.

- **A character is 37 slots in a fixed order** (`game/characters.js`),
  and the geometry around them is settled too. Both are in section 2
  and written down in
  [character-sprites.md](character-sprites.md); what is left there is
  the folder as one document.

- **HD sheets exist and this project knows nothing about them.**
  `game/characters.js` fetches `<base>/hd.json` per character and
  `game/hdpixels.js` decodes a PNG or WebP to premultiplied RGBA, off
  the page thread in `hd_worker.js`. A `tools/hd_sheets.py` is
  referenced. First step is finding out whether a live server actually
  serves them; the backup captured none.

## 12. Quality of life

- **The shelf should survive a reload.** Only where the window sits is
  remembered; the bytes are not, because a few hundred megabytes do
  not belong in browser storage. The File System Access API would let
  a folder be re-opened by permission rather than re-imported, which
  is the honest version of persistence
- **A set that writes itself back.** A character folder in, the same
  folder out, with whatever was edited in it -- the reading half now
  exists, the writing half is still per file
- **Import the way the desk exports.** A zip of frames should go back
  in as a sheet, and a folder of 37 should open as a character. The
  writing half is done; the reading half is still one file at a time
- **Export without opening.** Drop fifty files on the page and ask for
  the same thing from all of them -- a PNG of every frame of every
  sheet in a folder -- without clicking through them one at a time
- Undo and redo across every edit
- A diff view: what changed against the file as loaded
- Batch mode: apply one palette or texture change to many files
- A command-line build of the same operations, so changes are
  scriptable and reviewable in a pull request
- Tests that round-trip a corpus and fail loudly when a format
  assumption breaks

## Solved since this list was written

- **The effect format, fully.** Not eight groups of frames: **N frames
  of eight layers**, and a layer is an alpha level, composited from a
  table of eight weights on a 0..32 scale. The reach-of-the-blast guess
  had the axes swapped. 18 of 18 still round-trip byte-identical, which
  is why the error survived two readings -- a round trip proves a
  writer, not an interpretation. The editor now shows an effect
  composited beside its raw layers. See
  [gra-format.md](gra-format.md)
- **The client's download cache**, which is where 24 original motion
  files came from; see [cache-format.md](cache-format.md)
- **The 4-byte token in the item index**: the CRC-32 of the asset, the
  same one the cache header carries

## Things that are genuinely unknown

Listed so nobody burns time rediscovering them:

- The six `i16` per bone in the skeleton chunk. The first three read as
  a position in vertex units; the last three are likely a rotation or
  pivot, unconfirmed
- Item index types `02`, `03` and `05`
- The encrypted parameter file — see
  [encrypted-parameter-file.md](encrypted-parameter-file.md) for
  everything already ruled out
- The encrypted texture cache, which uses a different container
- What the `u32` at `0x07` of a sprite header means. One file in 1422
  carries 71 there; the rest are zero
- `UI_userdraw.spr`: high entropy from the first byte, no readable
  header. Compressed or encrypted
