# Motion — posing and animating a body

The bodies carry a skeleton and no animation. Both parse with no
leftover bytes, so nothing is being skipped: the file holds the bone
hierarchy and the rest pose and stops there. See
[mxw-format.md](mxw-format.md).

The animation lived in its own resource class, `motionIds`, which the
client downloaded separately and kept in `Data/cache`. **24 of them have
been recovered**, 11 for each body plus a static pose each, and the
format is below. See [cache-format.md](cache-format.md) for how they
came out.

Three things here, and it is worth keeping them apart:

- **the rig is original** — the bone order, the parent chain, the rest
  pose, and which vertices follow which bone, all read out of the body
  file;
- **the 24 motion files are original** — one key per bone per frame, for
  the 74-bone and 75-bone rigs, with no leftover bytes;
- **the motions in `motions.js` are ours** — hand-authored before any
  original surfaced, so the rig could be exercised and a figure judged
  in movement. They are still useful as editable examples, but they are
  not the real animation and should not be mistaken for it.

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
unit      PI / 2048 radians, so +-2048 is half a turn
```

The unit was first derived as `PI / 2047` by fitting joints to the
vertices they drive. The renderer's own sine table has 4096 steps to a
turn, so 2048 is right; the fit could not separate values five
hundredths of a percent apart. See **The rotation unit** below.

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

## Two different systems

A 3D body and a 2D sprite set animate in completely different ways,
which is why one set's animation and the other's are not the same kind
of thing:

- the **3D bodies** have the 74- and 75-bone skeleton this page is
  about, and their motion arrives separately as the 24 `motionIds`
  resources above;
- the **sprite sets** are 2D, and their animation *is* the `.GRA`
  frames, which the sprite editor already plays. Measured across all
  eight of them:

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

plus a `RUI_` set — `ST` 3, `MO` 8, `RI` 8, `JU` 4 — for a mounted
variant, and `MSB_CH` at one frame.

The motions shipped here take that vocabulary — the names, the order
and the frame counts — and reconstruct each action on the 3D rig. The
joint angles are ours. They could not be read out of the sprites: those
are a different figure, drawn in one projection, a few dozen pixels
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

## The original motion file

A `motionIds` resource, so it arrives as an ordinary `.bin` container:
`"OK  "`, the flag, the payload size, a chunk count of 2, then one
`MXW3DHUD` chunk and a 4-byte empty one. Inside the chunk body:

```
u8      bone count       74 for one body, 75 for the other
u16be   frame count      the last frame index, so keys run 0..frames
repeat bone count times:
  u8    key count        one key per frame, so frame count + 1
  key count x 20 bytes
```

All 24 recovered files parse to the last byte with nothing left over, on
both bone counts, which is the same test the meshes pass. The 40-byte
camera files are the same structure with a bone count of 1 and no
frames, which is what confirmed the 20-byte key size.

The 24 files pair up, id *n* on the 74-bone rig against id *n + 11* on
the 75-bone one, with matching frame counts:

| id (74) | id (75) | keys | likely action |
|--------:|--------:|-----:|---------------|
| 5 | 16 | 1 | a still pose |
| 9 | 20 | 3 | |
| 10 | 21 | 4 | |
| 7 | 18 | 5 | push, `PU` is 5 frames |
| 11 | 22 | 7 | |
| 4, 6, 8 | 15, 17, 19 | 8 | carry, hit, throw, all 8 frames |
| 13 | 24 | 11 | win |
| 12 | 23 | 18 | down, `DD` is 15 to 21 |
| 3 | 14 | 21 | walk, `WA` is 13 to 18 |
| 63 | 64 | 1 | a second still pose |

The frame counts line up with the 2D sprite vocabulary measured in the
table further down, which is a good sign the mapping is right, but the
names in that column are inference and not read out of anything. Nothing
in the files says which action is which.

**The set is closed.** A second client install, a 4.5 whose cache was
decoded later, carries 628 resources and 495 item meshes the first seven
caches did not have. Its motion class holds the same 24 files, **byte for
byte**, with no id outside 3..24 and 63..64. A source that adds a ninefold
increase in wardrobe and not one new motion is the strongest evidence
available that 24 is the whole catalogue, so effort is better spent on the
20-byte key layout than on hunting for a twenty-fifth file.

### The 20-byte key

```
s16be  frame        the frame this key sits on
i32be  x            a full translation, not an offset from the rest pose
i32be  y
i32be  z
s16be  rotation about Y
s16be  rotation about X
s16be  rotation about Z
```

Checked against all 24 files: every track's frames ascend, the highest
frame in a file is exactly the header's frame count, and the tracks end
on the last byte of the `MXW3DHUD` chunk in 24 of 24. Rotations sit
inside one turn in most files and reach two turns in the two that spin,
which are the ones whose frame counts match the death and the win.

A key carries a **translation as well as a rotation**, so a motion
moves bones rather than only turning them. The hand-written motions in
`motions.js` carry rotation only, plus a root translation, which is a
strict subset of what the format allows.

### How a key is applied

```
R      = rotZ(rz) . rotX(rx) . rotY(ry)      row vectors, applied in that order
world  = R . parent.world                    the root takes R as it is
pos    = (x, y, z) . parent.world + parent.pos
```

Bone *i* follows track *i*. A bone with no track keeps whatever pose it
last had. Between two keys the six values are interpolated linearly
with **integer division truncated toward zero**, so a port that uses
floating point drifts by a unit here and there; past the last key the
value is held rather than extrapolated.

### The rotation unit is 4096 steps to a turn

Not 4094. This page used to say `PI / 2047`, derived by fitting joints
to the vertices they drive, and the fit could not tell the two apart:
they differ by five hundredths of a percent. The renderer builds its
sine table as 4096 steps per turn, so the unit is

```
PI / 2048 radians per step
```

and a half turn is 2048, not 2047. `skin.js` carried the old constant.

### Which motion and which camera each sheet uses

The 37 sprite sets a character is built from are each one motion seen
through one camera. The table, as *(motion, camera)* in the renderer's
own set order:

```
(4,2) (4,5) (4,3) (4,4)   (10,2) (10,5) (10,3) (10,4)
(11,2)(11,5)(11,3)(11,4)  (7,2)  (7,5)  (7,3)  (7,4)
(5,2) (5,5) (5,3) (5,4)   (8,2)  (8,5)  (8,3)  (8,4)
(9,2) (9,5) (9,3) (9,4)   (6,2)  (6,5)  (6,3)  (6,4)
(3,5) (13,2) (12,2) (63,6) (63,6)
```

Four cameras per motion for the four facings, cameras 2 to 6, which is
exactly the five camera files that survive. The girl's body takes
**motion + 11**, with 63 mapping to 64 instead, which is the pairing
this page had already inferred from frame counts alone. Set 35 is the
portrait: a 40x40 crop of the render before it rather than a render of
its own.

### Where this came from

Not from more reverse engineering here. The game's current web client
ships its renderer as readable JavaScript at
`/js/game/avatar3d.js`, served openly, and it is a deliberate port of
the original: it cites the function addresses it came from, keeps the
fixed-point arithmetic and the integer division, and says so in its own
first lines. Everything in this section is read from it and then
checked against the files in hand.

The lesson is the same one the cache taught: **look for a build of the
program that is easier to read before attacking the data.** Here the
easier build was not an unpacked executable but a rewrite the project
had never thought to look at.

### What this replaces

An earlier version of this page said no motion data survived, and listed
everywhere it was not. That search was thorough and its conclusion was
wrong, for one reason worth recording: it treated the client's cache as
unreadable because the data measured 8.000 bits of entropy per byte and
the binary that writes it is packed. Both were true of **three** of the
four client builds in the archive. The fourth ships an unpacked
executable, and the motion class, the resource ids and the whole cache
scheme were in it in the clear. See [cache-format.md](cache-format.md).

These were checked and genuinely do not hold motion data, so there is no
need to look again:

| looked at | result |
|-----------|--------|
| both body meshes | parse with **no leftover bytes** — the file holds the hierarchy and the rest pose and stops |
| every other `.bin` in the archive | items and faces; none carries a skeleton chunk except the bodies |
| the client executables | scanned for long runs of 12-bit values, the shape a rotation table would have. Every window that matched is a version-resource string read as `int16` |
| the Director movie shipped with one client | 104 cast members, 73 bitmaps and Lingo scripts — a 2D launcher. No `W3D`, so the 3D side is not Director |
| `items.dat` | 1117 shop thumbnails, 100×150 BMP, no geometry at all |
| the encrypted parameter file | 8.000 bits of entropy per byte, still unopened |

## Replaying one on the other body

Two things to check, both cheap:

- **the bone count**. 74 is one body, 75 the other. They are the same
  tree up to bone 37 and differ in the hands above it, so a 74-bone
  motion is not safe to replay past 37 on the 75-bone rig. The paired
  ids above exist precisely so you do not have to.
- **the rotation unit**. If it is the same `±2047 = half a turn` the
  rest pose uses, the conversion is one multiply.

A third, once it plays: bones 32 and 33 are the toes, and they own
vertices at z −560..−80. The characters face −Z. If a motion plays with
the feet pointing the wrong way, that is why.
