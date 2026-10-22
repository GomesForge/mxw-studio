# Making something the server will take

A fan who wants to add a costume, a bomb skin, a map or scenery has to
produce exactly the right files, at the right sizes, with the right
names. Nothing in the formats says what those are: the receiving end
does. This page writes that down, and the **Workshop** button in the
editor walks through it one piece at a time and checks the result.

Everything below was read from a live administration panel rather than
guessed. Where something is an inference it says so.

## The four things you can hand over

| | what it is | what you hand over |
|---|---|---|
| **Costume** | a recolour of the White | a painted copy of one picture, or a small spec file |
| **Bomb skin** | the bomb and the flame it makes | up to 12 named `.spr` and `.eft` files |
| **Map** | the grid, the starts, the items | a layout string plus a few numbers |
| **Scenery** | the border drawn around the arena | one picture per screen size |

A whole new character is a fifth thing, and there is no import for it
yet. See [character-sprites.md](character-sprites.md) for what it costs.

## Costume

The important thing to understand first: **a costume is not artwork.**
The server keeps ten parts, each with a colour and some of them a
pattern, and generates **37 sheets** from the White's own shape. So the
silhouette never changes. A hat, hair or a cape drawn outside the
White's outline is not drawn at all.

### The ten parts

| part | pattern? |
|------|----------|
| Helmet | yes |
| Suit (arms, legs) | yes |
| Chest | yes |
| Pompom | yes |
| Gloves | yes |
| Boots | yes |
| Buckle | colour only |
| Face | colour only |
| Eyes | colour only |
| Antenna | colour only |

A part's colour is one of three things: **nothing**, meaning it keeps
the White's own; **a colour**; or **the name of another part**, which
makes it follow that one. The mummy's buckle and chest both follow the
suit that way.

A patterned part also carries the pattern, the colour it is drawn in,
how big it is drawn, and the angle it runs at.

Patterns: `plain`, `stripes`, `band`, `spots`, `checks`, `bandages`,
`clouds`. A band across the helmet is a headband. Bandages at a small
size is how the mummy is made.

Two extras sit outside the parts: **loose ends** beside the head, for a
headband's tails or a trailing bandage, and **hair** under the helmet.

### The White's own colours

Useful when matching something to the original rather than replacing it:

```
helmet #e0e0e0   suit  #666666   chest #15377d   buckle #9a7316
face   #de9c52   eyes  #000208   pompom #f485c7  stem   #d6e8e9
gloves #d670a7   boots #ec7dbb
```

### The picture route

The other way in is to paint over a template and let the server read
the colours back off it.

- The template is **432 x 640**.
- It carries a **16 x 16 pure magenta square 8 pixels in from each
  corner**, so the four centres sit at (16,16), (416,16), (16,624) and
  (416,624). Those four squares are how the figure is found.
- A larger copy is fine, because it rectifies by the corners. A
  **cropped** one is not, and that is the usual reason a costume comes
  back wrong.
- Flat colour reads better than shaded: the shading is added later.
- Erase the pompom or the antenna to leave it off altogether.

The Workshop checks a painted picture for all four squares and for even
scaling before you send it anywhere.

### What the panel shows while you work

Five of the 37 sheets: `st_s`, `mo_s`, `mo_e`, `mo_n`, `mo_w`. Standing
and walking in four directions. Everything else is generated from the
same spec, so if those five are right the rest follow.

## Bomb skin

Real artwork, and a set. These names and no others:

| file | what it is |
|------|------------|
| `bomb.spr` | the bomb resting and appearing. **The only required one.** |
| `bomb_d.spr` | the bomb about to go off |
| `bomb_s.spr` | the bomb while it slides |
| `bomb_f.eft` | the fuse |
| `flame_center.eft` | the blast under the bomb |
| `flame_hor.eft` | the arm running left and right |
| `flame_ver.eft` | the arm running up and down |
| `flame_left.eft` `flame_right.eft` `flame_up.eft` `flame_down.eft` | the tips of the four arms |
| `boom_block.eft` | a block breaking |

Each file is capped at **512 kB**. Anything left out falls back to the
ordinary one, so a skin that changes nothing but the bomb is a single
file.

All twelve open in this editor, effects included. See
[gra-format.md](gra-format.md) for the effect layout: eight groups of
the same frames, which the editor shows as one strip and a recolour
reaches all of.

The practical route is to open the existing file of the same name, so
the frame counts and sizes already match, and recolour it with
**Palette**, which reaches every frame at once. Watch the reserved
ramp while you do: see [character-sprites.md](character-sprites.md).

## Map

A grid, where people start, and what the breakable blocks hide.

| size | cells | screen | starts |
|------|-------|--------|-------:|
| 0 | 17 x 15 | 800 x 600 | 6 |
| 1 | 21 x 17 | 960 x 694 | 12 |
| 2 | 25 x 19 | 1120 x 770 | 12 |

The layout is one character per cell, row by row, with no separators,
so a 17 x 15 map is a 255-character string:

```
9  the outer wall, only around the rim
2  a pillar, solid, never breaks
1  a breakable block, which is where the items hide
0  floor
```

Themes: 1 Standard, 2 Pyramid, 3 Laboratory, 4 Village, 5 Iceberg,
6 Road, 7 ToyBox. The theme picks the tiles; there is no artwork in the
map itself.

Thirteen item counts go with it, in this order: Fire, Speed, Bomb,
Kick, Glove, Skull, Vest, Full fire, Louie, Punch, Line bomb, Pierce
bomb, Water bomb. At most 40 of any one, and they have to fit inside
the breakable blocks you drew.

Other limits: the name is 20 characters; a picture of the map is up to
5 MB; its own block tiles are one picture **40 wide**, each row
**20 to 76 tall**, up to 256 kB; its own scenery is up to 4 MB.

## Scenery

One picture per screen size: **800 x 600**, **960 x 694**,
**1120 x 770**. Nothing is scaled, so paint at the size it will be
shown. Up to 4 MB. The arena is drawn on top, in the middle, so the
part that shows is the border.

A map uses only the size that matches it. Ten versions of each are
kept, so replacing one is reversible.

## What the Workshop does with all this

Every page opens with **what to attach**: the files by name, with their
sizes and limits, and the place to drop them immediately underneath.
That is the question people arrive with, so it goes first and nothing
is above it.

Then it shows **what arrived**, and only that. An earlier version drew
a schematic figure from the chosen colours, on the theory that a
picture beats a paragraph. It does, but not a picture of something
nobody made: an invented figure standing in for the thing someone is
building looks like an answer and is not one. So the preview is the
person's own work or an empty frame saying what will appear there.

- **Costume**: your painted template, with the four corner squares and
  the scaling checked before it goes anywhere. A cropped picture is the
  usual reason a costume comes back wrong.
- **Bomb skin**: the files you attached, playing, read through the
  editor's own reader. Each row in the list turns green with its frame
  count and size as it arrives.
- **Map**: the grid you are drawing, with a legend naming each kind of
  cell. This page has nothing to attach, which it says so plainly.
- **Scenery**: your picture with the arena drawn over the middle of it,
  so the part that will be covered is obvious rather than described.
- **Character**: the 35 file names, four per action for the four
  facings, marked for which ones carry the character; attach the folder
  and the frames play, which is how you catch a facing that does not
  agree with the others.

The checks that catch the mistakes people actually make:

Nothing is uploaded anywhere. The editor runs entirely in the browser,
and what comes out is a file you hand over.
