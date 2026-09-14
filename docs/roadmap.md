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

## 1. Sprite formats — `.gra`, `.spr`, `.eft`

The 2D characters live here and nothing about them is editable yet.
This is the biggest gap.

What is known so far, from 6871 files:

```
0x00  u16  0x0000
0x02  u16  0x0101        in every file
0x04  u8   kind          0x00 or 0x03
0x05  u8   frame count
0x06  u8   0x64 when kind is 0x03, else 0x00
0x07  u8   0x00
```

Frame counts run from 1 to at least 0x15 (21). Two header shapes follow
byte 7, and the payload is compressed — a single 40x40 frame lands in
about 2.2 KB, and an 18-frame 80x80 sheet in 41 KB, far under the raw
pixel count.

Next steps, in order:

1. Settle the two header variants and find the frame table
2. Identify the compression. A palette plus per-row RLE is the obvious
   first guess for the era
3. Decode to RGBA and render
4. Re-encode, and prove a byte-identical round-trip the same way the
   mesh side does
5. Then the editing features below become possible

## 2. Sprite editing that respects animation

A character's frames are the same artwork in different poses and
directions, so editing one frame in isolation is the wrong unit of work.

- **Frame strip and playback**: scrub, loop, set frame rate, step
- **Direction groups**: files come in sets per facing; show them
  side by side rather than one at a time
- **Propagate an edit**: pick a region on one frame and apply the same
  change — a recolour, a palette swap, a pasted patch — across the
  chosen frames. Colour remapping generalises cleanly; pixel patches
  need an anchor, so offer alignment by the frame's own bounding box
- **Palette editor**: these are indexed images, so recolouring a whole
  character is a palette edit, not a repaint. One palette change should
  be previewable across every frame at once
- **Import a sheet**: take a PNG strip or a grid, slice it into frames,
  quantise to the palette and write the file back

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
