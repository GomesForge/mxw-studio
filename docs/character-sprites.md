# Character sprites: reserved colours and animation sets

Two things you need before editing a character, both learned from the
manual of the original authoring tool and then measured against the
files.

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

## Animation sets

A character is a directory of files whose names encode the action and
the facing. From the manual's own table:

| name | when it plays |
|------|---------------|
| `st_e` `st_n` `st_s` `st_w` | standing still, per facing — a breathing motion |
| `mo_e` `mo_n` `mo_s` `mo_w` | walking, per facing |
| `add` | an idle flourish while stopped |
| `dd` | death — moves a long way across the canvas |
| `face` | the portrait at the top of the screen during a match |
| `pu_e` `pu_n` `pu_s` `pu_w` | punching a bomb, per facing |
| `pa_e` `pa_n` `pa_s` `pa_w` | struck by a thrown bomb, per facing |
| `msb_ch_e` … `_w` | riding, per facing |
| `rui_st_e` … `_w` | mounted and standing, per facing |
| `rui_mo_e` … `_w` | mounted and walking, per facing |
| `rui_ju_e` … `_w` | mounting — the manual marks these as possibly unused |

Several of the mounted entries are flagged in the manual as needing
care with draw order, which is not documented further.

A complete character is therefore around 40 files that must stay
consistent with one another: the same silhouette, the same palette, and
the same use of the reserved ramp across every facing. That is the real
difficulty in making one, and it is what the editor should take over —
see [roadmap.md](roadmap.md).

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
