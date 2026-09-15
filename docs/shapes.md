# Building a mesh from nothing

`shapes.js` makes primitives — a card, a box, a cylinder, a cone, a
sphere, a ring — and hands each one to the same writer an imported
`.obj` goes through. That is deliberate: quantising coordinates to
`i16`, turning texture coordinates into whole pixels, keeping faces at
three or four corners and writing a bone table the format accepts are
all things `obj.js` already does, and a second copy of them would be a
second place for them to be wrong.

## What a mesh has to contain

Reading the writer backwards, the minimum is:

- **vertices** as `i16` triples, so nothing outside ±32767;
- **a normal per vertex**, since the format stores one and lighting
  reads it;
- **texture coordinates in pixels**, not in the 0..1 a modeller uses —
  divided by the size of that material's texture at draw time;
- **faces of three or four corners**, no more. Anything larger is cut
  into triangles;
- **at least one material**, with a name and a texture slot;
- **a bone table** that partitions the vertex list into contiguous
  spans ending exactly at the vertex count. One span covering
  everything, bone 0, is the simplest table that satisfies it.

A mesh with none of the above but an empty texture list references no
texture at all, which a reader may refuse. Add one before saving.

## Winding

The corner order decides which way a face points, and this format winds
the opposite way from the convention most modellers use. Every one of
the six primitives was wrong the first time, and `checks.js` said so:

```
warn: 6 of 6 face(s) are wound against the normals stored at their
own vertices. They look right from the wrong side.
```

That is a mesh that lights as though it were inside out. The fix is one
reversal in the one place faces are made, rather than six chances to
forget it — and the sphere needed the opposite again, because its
latitude-longitude grid runs the other way round from the other
builders.

The same rule applies to mirroring a finished mesh: negating one axis
without reversing the corners turns it inside out, so `meshMirror` does
both.

## Sizes

The same units the meshes use, where a body runs about 7090 tall:

| | |
|---|---|
| 1000 | roughly a hand |
| 4300 | shoulder height |
| 5600 | head height |
| 7090 | the top of a body |

A new shape opens as its own file rather than replacing what is
already open, and carries no texture until you give it one.

## Moving a finished mesh

`meshScale`, `meshRotate`, `meshMirror`, `meshMove`, `meshCentre` and
`meshToFloor` all write `i16` back, clamping anything that falls
outside and reporting how much. `meshCentre` deliberately leaves the
vertical alone: a piece is worn at a height, and centring it on Y would
take it off the body.

Rotating turns the normals with the geometry. Leaving them behind is a
quiet fault — the shape is right and the lighting is wrong, which reads
as a texture problem and sends you looking in the wrong place.
