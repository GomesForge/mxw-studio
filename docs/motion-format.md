# Motion — posing and animating a body

The bodies carry a skeleton and no animation. Both parse with no
leftover bytes, so nothing is being skipped: the file holds the bone
hierarchy and the rest pose and stops there. See
[mxw-format.md](mxw-format.md).

What follows is therefore two different things, and it is worth keeping
them apart:

- **the rig is the game's** — the bone order, the parent chain, the rest
  pose, and which vertices follow which bone, all read out of the file;
- **the motions shipped here are ours** — hand-authored so the rig can
  be exercised and a character judged in movement. Nothing in
  `motions.js` claims to be the game's animation data, because nobody
  has published any.

When a real motion file does turn up it plays through the same
machinery, because it is the same thing: a rotation per bone per frame.

## The rest pose, and how it was worked out

Each bone in the skeleton chunk is six `i16` and a parent byte. What the
six meant was not documented anywhere, so it was derived: every
candidate reading — which field is which axis, which Euler order, which
sign, translation before rotation or after — was scored by how far each
bone's joint landed from the vertices that bone drives, across all 149
bones of the two bodies. One reading won by two orders of magnitude.

```
offset    (0, field1, field2)
rotation  rx = field4, ry = field3, rz = field5
order     R = Ry * Rx * Rz        (three.js Euler order 'YXZ')
local     T(offset) * R           world = parent * local
unit      PI / 2047 radians, so +-2047 is half a turn
```

Mean error 60 units on a body 7090 tall, and the joints land where a
skeleton should have them: the head bone at the neck, the arm bone at
the shoulder, the toe bone at the ball of the foot. `skin.js` is that,
in code.

## Which axis moves what

Measured rather than guessed — and **not the same for every part**,
which is the mistake the first set of motions made:

| part | x | y | z |
|------|---|---|---|
| hips, spine, chest | bends **sideways** | leans forward (negative) or back | twists about the spine |
| neck | nods | turns | — |
| upper arm | swings forward and back | raises sideways, **mirrored**: +y on the right, &minus;y on the left | twists in place |
| forearm | **bends the elbow** | drags the hand across the chest | — |
| thigh | steps forward, same sign both sides | spreads sideways | — |
| shin | extends the knee, so flexion is negative | — | — |
| ankle | points the toe | — | — |

`z` is each bone's own axis, which is why it only ever twists.

Two of those rows cost a rewrite. A run cycle was authored with the
trunk leaning on `x`, which bends the body **sideways**, and with the
elbows bending on `y`, which with the arm at the side drags the hand
straight into the chest. Both look wrong immediately in motion and
neither is obvious from a single still.

The other trap: **these are local axes, so a child's axes move with its
parent.** Measuring the forearm from the bind pose, with the arms
straight out, gives a different answer from measuring it with the arms
down — which is the pose every motion actually starts from. Measure in
the pose you will use.

## Checking a motion

`python/check_motion.py` judges a motion against the body it drives,
frame by frame:

```
python check_motion.py 210001.bin walk.json
```

It measures the torso angle, the lowest foot against the floor, the
angle at each knee and which way it leads, the hands' distance from the
torso, and the head's height above the hips — all from joint positions,
and all compared against that body's own bind pose. A motion can opt
out of two of them: `"air": true` for a run, which genuinely leaves the
ground, and `"grounded": true` for one that ends lying down.

Every motion shipped in `motions.js` passes it, on both bodies. It is
also what found the run cycle: arms 143 units from the torso line where
the bind pose has 2151.

## Skinning

The mesh's bone table partitions the vertex list into contiguous spans,
one span per bone, so a vertex follows exactly one bone with no weights
to blend. Rigid skinning, and simpler than a modern rig.

Items are skinned by the **body's** skeleton: their bone tables index
the same list. Hair carries one range on bone 18, the head; a jacket
carries nine to eleven on the hips, spine, chest, upper arms, forearms
and wrists. So posing a body moves everything worn on it, and Dress-up
plus a motion is a dressed character in movement.

## What the game has, and what it does not

The 3D avatars and the battle characters are **two different systems**,
which is why "the bomber's motions" and "the human's motions" are not
the same kind of thing:

- the **3D avatars** — the boy and the girl — have the 74- and 75-bone
  skeleton this page is about. No motion data for them is in the
  archive;
- the **battle characters** are 2D sprites, and their animation *is*
  the `.GRA` frames, which the sprite editor already plays. Measured
  across all eight of them:

| action | frames | what |
|--------|--------|------|
| `ST` | 3 | stand |
| `WA` | 13–18 | walk |
| `MO` | 8 | carrying |
| `PA` | 8 | hit |
| `PU` | 5 | push |
| `TH` | 7–9 | throw |
| `DD` | 15–21 | down |
| `WI` | 9–23 | win |

plus `RUI_ST` 3, `RUI_MO` 8, `RUI_RI` 8 and `RUI_JU` 4 for riding a
Louie, and `MSB_CH` at one frame.

The motions shipped here take that vocabulary — the names, the order
and the frame counts — and reconstruct each action on the 3D rig. The
joint angles are ours. They could not be read out of the sprites: those
are a different character, drawn in one projection, a few dozen pixels
tall, with the legs mostly hidden. Deriving a skeleton pose from them
would be invention wearing the costume of measurement.

## The motion file

```json
{
  "name": "Wave",
  "fps": 18,
  "loop": true,
  "tracks": {
    "19": [[0, 0, -68, 0], [6, 0, 40, 0], [36, 0, -68, 0]],
    "23": [[0, 0, -10, 0], [12, -28, 30, 0], [18, 28, 30, 0]]
  }
}
```

- `tracks` is keyed by **bone index**, as a string, into the skeleton
  chunk — so 19 is the right upper arm on both bodies.
- an optional `root` track, shaped the same way, moves the whole body.
  It is the one translation in the format, and motions that end on the
  floor need it: rotations alone cannot lower a character.
- each key is `[frame, x, y, z]`, the rotation in **degrees added to
  that bone's rest pose**. A bone with no track keeps its rest pose;
  a track with one key is a constant offset, which is how a still pose
  is stored.
- frames between keys are interpolated linearly, and `fps` says how
  fast they are played.

Degrees rather than the file's own 12-bit unit, because this is a file
you might write by hand. Multiply by 2047/180 to go the other way.

## Reading a real motion file, when one appears

Two things to check first, both cheap:

- **the track count**. 74 is the boy, 75 the girl. They are the same
  tree up to bone 37 and differ in the hands above it, so a 74-track
  motion is not safe to replay on the girl past 37.
- **the rotation unit**. If it is the same `±2047 = half a turn` the
  rest pose uses, the conversion is one multiply.

A third, once it plays: bones 32 and 33 are the toes, and they own
vertices at z −560..−80. The characters face −Z. If a motion plays with
the feet pointing the wrong way, that is why.
