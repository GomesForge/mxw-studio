# Character sprites: the sheet, the 37 files and the reserved colours

What you need before editing a character: which colours the runtime
takes away from you, where the drawing has to sit inside the sheet,
and what the 37 files are.

The first part was learned from the manual of the original authoring
tool and measured against the files. The rest came later, from the
community guide and the client's own source, and it corrects the
manual in a few places — those are marked where they occur.

## 64 colours are reserved

**64 of the 65536 RGB565 values are substituted by the runtime at
time.** Left alone they read as a neutral ramp from black through grey
to white in 64 steps. The runtime paints a palette over them, which is how
one character sheet serves every team colour — and it is the single
reason character work is hard: half of what you draw is not the colour
it will be.

The manual states the reservation and that it makes character creation
very difficult, but does not name the values. They are the neutral
ramp. Green carries 6 bits where red and blue carry 5, so step `i` is:

```
tint(i) = ((i >> 1) << 11) | (i << 5) | (i >> 1)      i = 0 .. 63
```

Measured across 974 character sprite files:

| | |
|---|---|
| all 64 values appear | yes |
| their rank among every colour used | positions 1 through 20-plus |
| share of all character pixels | **56.5%** |
| share in the non-character graphics | **81.9%** |

They are not merely present, they are the *most used colours in the
runtime*. The editor marks them, reports what fraction of a sheet sits in
the ramp, and can preview a team palette over them.

The real substitution tables are **not known**. The manual lists the
sets — white, black, red, blue, green, yellow, and several tied to
particular characters — without their values. The editor's team preview
tints the ramp's own luminance and is labelled as an approximation
wherever it appears. Recovering the true tables means finding them in
the client.

### Practical consequences

- Painting a mid-grey by accident puts that pixel under team control.
  `avoidTint()` nudges a colour off the ramp when that is not wanted.
- Deliberately painting *in* the ramp is how you mark the parts that
  should follow the team colour. Lower steps come out dark, higher
  steps light.
- Importing a photograph is close to hopeless: the 24-to-16-bit
  conversion drops many source colours onto the ramp. The manual warns
  about exactly this.
- The original tool converted by truncation (`r>>3`, `g>>2`, `b>>3`).
  This one rounds, which is closer to the source colour but lands on a
  different value at the boundaries. `rgb_to_rgb565_truncate()` is
  available for matching existing work.

## Size limit

The manual reports the runtime failing to start when a frame's data is too
large, with trouble around 60x100 pixels, and recommends staying at or
under **64x80**. Larger frames also get in the way during play. Files
that shipped at larger sizes are fine; newly grown ones may not be. The
editor warns past that ceiling rather than refusing.

The measurements below agree with it from the other direction: the
median official body is 44 x 72, and the tallest is 91. The manual's
64 x 80 is roughly where the art stops, not an arbitrary limit.

## Where the drawing has to sit

A sheet is a stamp. The game presses the whole 256 x 256 at a fixed
place against the board square and has no skeleton, no origin and no
idea where the head is, so **where the pixels sit inside the sheet is
the only thing that decides where the character appears**. Get it
wrong and nothing looks wrong in an editor: it shows up in a match, as
a character that floats over the block in front, sinks into it, or
walks through walls.

Two lines carry most of it.

| | | |
|---|---|---|
| **axis** | `x = 128` | the body is centred on it in every frame and every facing |
| **sole** | `y = 195` | the last row of the foot, standing |

The game marks that floor itself: the shadow it draws under every
player ends at exactly `y = 195`, and the Louie stands on it.

The rest of the sheet is furniture the game draws around you, and none
of it adapts:

| | where, in sheet pixels |
|---|---|
| this board square | x 108–147, y 162–199 (centre 127.5, 180.5) |
| the square left / right | x 68–107 / 148–187 |
| the row above / below | y 124–161 / 200–237 |
| head box | x 108–147, y 108–147 — the engine cuts a 40 x 40 portrait from here |
| name band | y 123–135, centred on 128 |
| shadow | x 113–143, y 180–195 |
| team ring | x 98–157, y 126–193 |
| stunned stars | x 92–163, y 102–151 |
| "you" marker | x 110–145, y 164–187 |
| Hyper Bomb orbit | x 80–174, y 118–202 |
| safe area for ground actions | (80, 88) to (176, 216) |

A body is about **72 px tall and 44 wide** at the median official, and
the officials run 55 to 91 tall. Taller than about 72 and the name
band starts crossing the head, which no file can change.

Walking, the body rises: the sole sits between 191 and 197 with the
contacts at 195, and the median across the officials is 193 walking
against 194 standing. Standing from behind it reads 192, because the
body hides the foot.

The editor draws all of this over the artwork, in the sprite view and
while painting a frame, and measures every frame against the medians
the officials actually hit.

## The 37 sheets

A character is **exactly 37 files**, in the game's own order: index =
group + facing, facings always `s, w, n, e`. Names are lowercase; the
server runs on a filesystem that cares, even though the originals are
inconsistent about it.

| slots | files | plays | frames |
|-------|-------|-------|--------|
| 0–3 | `mo_*` | walking | **8, required** |
| 4–7 | `st_*` | standing | **3, required** |
| 8–11 | `th_*` | throwing a bomb | 7 |
| 12–15 | `pa_*` | stunned by a flying bomb | 8 |
| 16–19 | `pu_*` | punching the bomb in front | 5, up to 7 |
| 20 | `dd` | death | 21 (7 to 30) |
| 21 | `wi` | victory | 11 (8 to 37) |
| 22 | `wa` | entering the round, teleporting | 18 (13 to 23) |
| 23–26 | `msb_ch_*` | the revenge cart | **1, required** |
| 27–30 | `rui_mo_*` | walking, mounted | **8, required** |
| 31–34 | `rui_st_*` | standing, mounted | **3, required** |
| 35 | `preview` | the room card, profile and shop | 3, a copy of `st_s` |
| 36 | `face` | the bar at the top of a match | 1, at 40 x 40 |

That is 226 frames. The required counts are not style: mounted, the
game draws the Louie and the rider **on the same frame number**, and
the clock that advances it counts by your own `mo` and `st`. A `mo` of
ten freezes the Louie on frames 8 and 9; a `rui_mo` of six freezes the
rider. The cart draws frame 0 and never any other.

### The file carries no timing

It holds pixels and a frame count. The game decides the speed, per
animation, the same for every character, in steps of 20 ms. **More
frames is a longer animation, not a slower one.**

| | per frame | total |
|---|---|---|
| `st` | 240 on frame 0, then 120 | 480 ms, looping |
| `mo` | 60 at ordinary speed | 480 ms, looping |
| `th` | 120, then 60 | 480 ms, once |
| `pu` | 140, then 70 | 420 ms, once |
| `pa` | 50 | loops for 1000 ms |
| `dd` | 210, then 70 | 1540 ms, once |
| `wi` | 80 | loops for 3 s or more |
| `wa` | 40 | 720 ms each way |
| `msb_ch`, `preview`, `face` | — | static |

While throwing or punching the game ignores the player's direction, so
a 13-frame punch pins them for most of a second in the middle of a
match. The last frame of a death never reaches the screen: the player
has already turned into the cart.

### Three things the old manual got wrong

The manual below predates the current client by twenty years, and the
client's own source contradicts it on three points:

- **`add` is not an idle animation, it is not used at all.** The
  loader knows 37 files and `add` is not one of them. It is a leftover
  of the 2003 game; 18 official folders still carry one.
- **`msb_ch` is the revenge cart**, not riding. Riding is `rui_*`.
- **A character is 37 files, not "around 40".** `rui_ju_*`,
  `rui_ri_*`, `ho_*`, `wi_a` and `wi_b` exist in old folders and the
  current client never loads them.

The 64-colour rule above also narrowed: a character with its own
folder, which is the kind anybody uploads today, is **not tinted at
all**. The reserved ramp only matters for the built-in characters.

### Where these numbers come from

The community guide v3 (31 October 2026), which measured 3995 official
sheets and read them against the client's own renderer, module by
module. Independently reproduced here before being written down: this
project's own measurement of White's walk scores 0.27, 0.34, 0.47 and
0.47 on the guide's stride measure, against the 0.27 to 0.47 the guide
publishes, and White's standing sheets land on 195, 196, 192 and 196
at the sole, matching what the guide measured for each facing.

## What the original tool did and did not do

Worth knowing, because it sets the floor:

- It replaced one image inside an existing sprite file with a prepared
  BMP, choosing the transparent region by picking a key colour.
- It **could not create a new file and could not paint.** Its own
  manual says so, and is candid about how awkward the workflow is.
- It restricted itself to character files as an anti-cheat measure.

So round-tripping arbitrary sprite files, painting in place, and
building a sheet from nothing are all new ground rather than
re-implementations.
