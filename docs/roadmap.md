# Roadmap

The goal is one editor for the whole asset set: 3D wearables, 2D
character sprites, faces, and eventually maps — so somebody can build a
character end to end, export it, and have it work.

Ordered by what unblocks the most.

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
  preview and a report of how much of a sheet the game recolours --
  see [character-sprites.md](character-sprites.md)

## 1. Sprite editing, the parts still missing

Playback, colour remapping and an HSV shift across every frame are
done. What is left:

- **Direction groups**: these files come in sets per facing, and the
  set is only visible in the file names. Detect them and show the
  facings side by side rather than one file at a time
- **Propagate a pixel patch**, not just a colour. Pick a region on one
  frame and paste it into the same place on the others. Colour edits
  generalise for free; a patch needs an anchor, so align by each
  frame's own bounding box rather than by absolute coordinates
- **Onion skinning** while editing a frame, so a change can be judged
  against its neighbours
- **Colour count guard**: a photograph imported into a sprite explodes
  the distinct-colour count and the file with it. Warn, and offer to
  quantise on import
- The 3 files carrying kind bytes `0x09`, `0x49` and `0x99`, which are
  a variant this reader refuses

Worth knowing before touching this: the pixels are **direct RGB565**,
not palette indices. There is no palette to edit, so a recolour is a
remap of the colours that happen to be present — which is what makes it
propagate cleanly across frames.

## 3. Dress room, improved

The pieces are already there — dress-up, the shared coordinate space,
the slot taxonomy read out of the texture names. What it needs:

- Named slots with one item each: `body`, `head`, `hair`, `katyusha`,
  `glass`, `shirt`, `jacket`, `pants`, `gloss`, `shoes`, `back`, `face`
- Load a folder or archive once, then browse by slot with search
- Face picker: a body carries the body skin, a blank head, then the
  facial expressions
- Save and load an outfit as a small JSON of ids, and share it as a URL
- Turntable and a pose or two, so a piece can be judged in motion
- Flag conflicts: two items in one slot, or an item whose texture is
  missing

## 4. Character creation, end to end

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

Not started. No map format has been identified yet. The first task is
to find which files hold the level layout at all.

## 6. Quality of life

- Undo and redo across every edit
- A diff view: what changed against the file as loaded
- Batch mode: apply one palette or texture change to many files
- A command-line build of the same operations, so changes are
  scriptable and reviewable in a pull request
- Tests that round-trip a corpus and fail loudly when a format
  assumption breaks

## Things that are genuinely unknown

Listed so nobody burns time rediscovering them:

- The six `i16` per bone in the skeleton chunk. The first three read as
  a position in vertex units; the last three are likely a rotation or
  pivot, unconfirmed
- The 4-byte token in the item index. Not CRC32, not Adler32, not the
  base32 cache name
- Item index types `02`, `03` and `05`
- The encrypted parameter file — see
  [encrypted-parameter-file.md](encrypted-parameter-file.md) for
  everything already ruled out
- The encrypted texture cache, which uses a different container
