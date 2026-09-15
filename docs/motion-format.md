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

Also measured rather than guessed — rotate one bone by 30 degrees and
see where the limb it drives ends up:

| part | x | y | z |
|------|---|---|---|
| arms | swings forward | lifts, **mirrored**: +y raises the right arm, &minus;y the left | twists in place |
| legs | swings forward, same sign both sides | spreads sideways | twists |
| spine, hips | bends forward | twists | — |
| neck | nods | turns | — |

`z` is each bone's own axis in every case, which is why it only twists.

## Skinning

The mesh's bone table partitions the vertex list into contiguous spans,
one span per bone, so a vertex follows exactly one bone with no weights
to blend. Rigid skinning, and simpler than a modern rig.

Items are skinned by the **body's** skeleton: their bone tables index
the same list. Hair carries one range on bone 18, the head; a jacket
carries nine to eleven on the hips, spine, chest, upper arms, forearms
and wrists. So posing a body moves everything worn on it, and Dress-up
plus a motion is a dressed character in movement.

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
