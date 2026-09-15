/* A starter set of motions.

   These are ours, not the game's. Nobody has published one of the
   game's motion files for the 3D avatars, so nothing here is the
   original animation data. What *is* the game's is the rig underneath
   -- the skeleton, the bone order, the rest pose, which vertices follow
   which bone -- and the timing: the names and frame counts below are
   taken from the battle sprites, which are the game's own animation
   set. Measured across all eight characters:

     ST  3 frames   stand      TH  7-9      throw
     WA  13-18      walk       PU  5        push
     MO  8          carrying   PA  8        hit
     WI  9-23       win        DD  15-21    down

   Those sprites are 2D and cannot be posed; they are what the sprite
   editor plays. The 3D avatars are the ones with a skeleton. Two
   different systems, which is why "the bomber's motions" and "the
   human's motions" are not the same kind of thing at all.

   WHICH AXIS MOVES WHAT -- measured on the rig, and not the same for
   every part, which is the mistake the first version of this file made:

     trunk (hips 3, spine 4, chest 9)
        y  leans forward (negative) or back (positive)
        x  bends sideways
        z  twists about the spine
     neck 12        x nods, y turns
     upper arm 19/20, from the arms-down pose
        x  swings forward and back
        y  raises sideways -- mirrored, +y on the right, -y on the left
     forearm 23/24  x bends the elbow forward. NOT y: with the arm at
                    the side, y drags the hand across the chest, which
                    is how a run cycle ended up with both arms buried
                    in the torso
     thigh 10/11    x steps forward, y spreads
     shin 15/16     x extends the knee, so flexion is negative
     ankle 21/22    x points the toe

   python/check_motion.py judges all of this against the body: torso
   angle, feet on the floor, knees bending the right way, hands clear
   of the torso. Every motion here passes it. */

/* The bodies are authored in a T-pose. Almost every motion wants the
   arms down first, so this is where the rest of them start. */
const ARM_DOWN_R = -68;
const ARM_DOWN_L = 68;
const ELBOW = 12;          /* a little bend, so the arms are not planks */

const BUILT_IN_MOTIONS = [
  {
    name: 'Stand', game: 'ST',
    note: 'arms at the sides -- game action ST, 3 frames',
    fps: 6, loop: true,
    tracks: {
      19: [[0, 0, ARM_DOWN_R, 0]],
      20: [[0, 0, ARM_DOWN_L, 0]],
      23: [[0, ELBOW, 0, 0]],
      24: [[0, ELBOW, 0, 0]],
      9:  [[0, 0, 0, 0], [1, 0, -1.5, 0], [3, 0, 0, 0]]
    }
  },
  {
    name: 'Walk', game: 'WA',
    note: 'game action WA, 18 frames',
    fps: 18, loop: true,
    tracks: {
      /* right leg leads; the knee only ever flexes, never extends past
         straight, which is what the negative shin angles are */
      10: [[0, 24, 0, 0], [4, 10, 0, 0], [9, -20, 0, 0], [13, 4, 0, 0], [18, 24, 0, 0]],
      15: [[0, -6, 0, 0], [4, -12, 0, 0], [9, -10, 0, 0], [13, -46, 0, 0], [18, -6, 0, 0]],
      21: [[0, -6, 0, 0], [9, 8, 0, 0], [18, -6, 0, 0]],
      11: [[0, -20, 0, 0], [4, 4, 0, 0], [9, 24, 0, 0], [13, 10, 0, 0], [18, -20, 0, 0]],
      16: [[0, -10, 0, 0], [4, -46, 0, 0], [9, -6, 0, 0], [13, -12, 0, 0], [18, -10, 0, 0]],
      22: [[0, 8, 0, 0], [9, -6, 0, 0], [18, 8, 0, 0]],
      /* arms counter-swing */
      19: [[0, -16, ARM_DOWN_R, 0], [9, 16, ARM_DOWN_R, 0], [18, -16, ARM_DOWN_R, 0]],
      20: [[0, 16, ARM_DOWN_L, 0], [9, -16, ARM_DOWN_L, 0], [18, 16, ARM_DOWN_L, 0]],
      23: [[0, ELBOW + 8, 0, 0]],
      24: [[0, ELBOW + 8, 0, 0]],
      /* the trunk sways about its own axis, it does not bend sideways */
      9:  [[0, 0, 0, 3], [9, 0, 0, -3], [18, 0, 0, 3]],
      12: [[0, 2, 0, 0]]
    }
  },
  {
    name: 'Carry', game: 'MO',
    note: 'game action MO, 8 frames -- holding something at the chest',
    fps: 12, loop: true,
    tracks: {
      19: [[0, -30, ARM_DOWN_R + 26, 0]],
      20: [[0, -30, ARM_DOWN_L - 26, 0]],
      23: [[0, 82, 0, 0]],
      24: [[0, 82, 0, 0]],
      3:  [[0, 0, 4, 0]],
      9:  [[0, 0, -4, 0], [4, 0, -6, 0], [8, 0, -4, 0]],
      10: [[0, 6, 0, 0], [4, 4, 0, 0], [8, 6, 0, 0]],
      11: [[0, 6, 0, 0], [4, 4, 0, 0], [8, 6, 0, 0]],
      15: [[0, -10, 0, 0]], 16: [[0, -10, 0, 0]]
    }
  },
  {
    name: 'Hit', game: 'PA',
    note: 'game action PA, 8 frames -- recoiling',
    fps: 16, loop: false,
    tracks: {
      3:  [[0, 0, 0, 0], [2, 0, 14, 0], [8, 0, 4, 0]],
      9:  [[0, 0, 0, 0], [2, 0, 12, 0], [8, 0, 4, 0]],
      12: [[0, 0, 0, 0], [2, -18, 0, 0], [8, -6, 0, 0]],
      19: [[0, 0, ARM_DOWN_R, 0], [2, -46, ARM_DOWN_R + 30, 0], [8, -14, ARM_DOWN_R + 8, 0]],
      20: [[0, 0, ARM_DOWN_L, 0], [2, -46, ARM_DOWN_L - 30, 0], [8, -14, ARM_DOWN_L - 8, 0]],
      23: [[0, ELBOW, 0, 0], [2, 60, 0, 0], [8, 30, 0, 0]],
      24: [[0, ELBOW, 0, 0], [2, 60, 0, 0], [8, 30, 0, 0]],
      10: [[0, 0, 0, 0], [2, -14, 0, 0], [8, -4, 0, 0]],
      11: [[0, 0, 0, 0], [2, -14, 0, 0], [8, -4, 0, 0]],
      15: [[0, -6, 0, 0], [2, -26, 0, 0], [8, -12, 0, 0]],
      16: [[0, -6, 0, 0], [2, -26, 0, 0], [8, -12, 0, 0]]
    }
  },
  {
    name: 'Push', game: 'PU',
    note: 'game action PU, 5 frames -- leaning into something',
    fps: 10, loop: true,
    tracks: {
      3:  [[0, 0, -18, 0], [2, 0, -24, 0], [5, 0, -18, 0]],
      9:  [[0, 0, -6, 0]],
      12: [[0, 16, 0, 0]],
      19: [[0, -64, ARM_DOWN_R + 30, 0], [2, -72, ARM_DOWN_R + 30, 0],
           [5, -64, ARM_DOWN_R + 30, 0]],
      20: [[0, -64, ARM_DOWN_L - 30, 0], [2, -72, ARM_DOWN_L - 30, 0],
           [5, -64, ARM_DOWN_L - 30, 0]],
      23: [[0, 28, 0, 0]], 24: [[0, 28, 0, 0]],
      10: [[0, 16, 0, 0]], 11: [[0, -12, 0, 0]],
      15: [[0, -20, 0, 0]], 16: [[0, -8, 0, 0]]
    }
  },
  {
    name: 'Throw', game: 'TH',
    note: 'game action TH, 8 frames',
    fps: 16, loop: true,
    tracks: {
      19: [[0, -20, ARM_DOWN_R + 20, 0], [3, -74, ARM_DOWN_R + 44, 0],
           [5, 46, ARM_DOWN_R + 16, 0], [8, -20, ARM_DOWN_R + 20, 0]],
      23: [[0, 40, 0, 0], [3, 86, 0, 0], [5, 16, 0, 0], [8, 40, 0, 0]],
      20: [[0, 10, ARM_DOWN_L, 0], [3, 22, ARM_DOWN_L, 0], [5, -16, ARM_DOWN_L, 0],
           [8, 10, ARM_DOWN_L, 0]],
      24: [[0, ELBOW + 10, 0, 0]],
      9:  [[0, 0, 0, -6], [3, 0, -4, -16], [5, 0, -6, 10], [8, 0, 0, -6]],
      3:  [[0, 0, 0, -4], [3, 0, 0, -10], [5, 0, 0, 8], [8, 0, 0, -4]],
      12: [[0, 4, 0, 0]],
      10: [[0, 8, 0, 0], [5, -6, 0, 0], [8, 8, 0, 0]],
      11: [[0, -6, 0, 0], [5, 10, 0, 0], [8, -6, 0, 0]],
      15: [[0, -12, 0, 0]], 16: [[0, -12, 0, 0]]
    }
  },
  {
    name: 'Down', game: 'DD',
    note: 'game action DD, 21 frames -- knocked out, body comes down too',
    fps: 16, loop: false,
    /* Rotations alone cannot lower a character: the root has to move,
       which is what this track is for. */
    grounded: true,
    /* The thighs swinging up do most of the lowering by
       themselves; the root only makes up the difference. -2450
       drove the body two units under the floor. */
    root: [[0, 0, 0, 0], [10, 0, -257, 0], [21, 0, -238, 0]],
    tracks: {
      3:  [[0, 0, 0, 0], [8, 0, -40, 0], [21, 0, -86, 0]],
      9:  [[0, 0, 0, 0], [21, 0, -10, 0]],
      12: [[0, 0, 0, 0], [6, -24, 0, 0], [21, -14, 0, 0]],
      10: [[0, 0, 0, 0], [8, 44, 0, 0], [21, 82, 0, 0]],
      11: [[0, 0, 0, 0], [8, 40, 0, 0], [21, 78, 0, 0]],
      15: [[0, -6, 0, 0], [8, -40, 0, 0], [21, -24, 0, 0]],
      16: [[0, -6, 0, 0], [8, -44, 0, 0], [21, -28, 0, 0]],
      19: [[0, 0, ARM_DOWN_R, 0], [8, -20, ARM_DOWN_R + 24, 0], [21, -8, ARM_DOWN_R + 40, 0]],
      20: [[0, 0, ARM_DOWN_L, 0], [8, -20, ARM_DOWN_L - 24, 0], [21, -8, ARM_DOWN_L - 40, 0]],
      23: [[0, ELBOW, 0, 0], [21, 34, 0, 0]],
      24: [[0, ELBOW, 0, 0], [21, 34, 0, 0]]
    }
  },
  {
    name: 'Win', game: 'WI',
    note: 'game action WI, 12 frames -- both arms up, twice',
    fps: 14, loop: true,
    tracks: {
      19: [[0, 0, ARM_DOWN_R, 0], [2, -10, 62, 0], [5, -10, 34, 0],
           [8, -10, 62, 0], [12, 0, ARM_DOWN_R, 0]],
      20: [[0, 0, ARM_DOWN_L, 0], [2, -10, -62, 0], [5, -10, -34, 0],
           [8, -10, -62, 0], [12, 0, ARM_DOWN_L, 0]],
      23: [[0, ELBOW, 0, 0], [2, 26, 0, 0], [12, ELBOW, 0, 0]],
      24: [[0, ELBOW, 0, 0], [2, 26, 0, 0], [12, ELBOW, 0, 0]],
      9:  [[0, 0, 0, 0], [2, 0, 8, 0], [8, 0, 8, 0], [12, 0, 0, 0]],
      12: [[0, 0, 0, 0], [2, -12, 0, 0], [8, -12, 0, 0], [12, 0, 0, 0]],
      10: [[0, 0, 0, 0], [2, -8, 0, 0], [8, -8, 0, 0], [12, 0, 0, 0]],
      11: [[0, 0, 0, 0], [2, -8, 0, 0], [8, -8, 0, 0], [12, 0, 0, 0]],
      15: [[0, -6, 0, 0], [2, -18, 0, 0], [8, -18, 0, 0], [12, -6, 0, 0]],
      16: [[0, -6, 0, 0], [2, -18, 0, 0], [8, -18, 0, 0], [12, -6, 0, 0]]
    }
  },
  {
    name: 'Bind pose',
    note: 'the file exactly as authored, arms straight out',
    fps: 12, loop: false, tracks: {}
  },
  {
    name: 'Breathe',
    note: 'a standing idle, chest and shoulders only',
    fps: 24, loop: true,
    tracks: {
      9:  [[0, 0, 0, 0], [24, 0, -3, 0], [48, 0, 0, 0]],
      12: [[0, 2, 0, 0], [24, -1, 0, 0], [48, 2, 0, 0]],
      19: [[0, 0, ARM_DOWN_R, 0], [24, 0, ARM_DOWN_R - 4, 0], [48, 0, ARM_DOWN_R, 0]],
      20: [[0, 0, ARM_DOWN_L, 0], [24, 0, ARM_DOWN_L + 4, 0], [48, 0, ARM_DOWN_L, 0]],
      23: [[0, ELBOW, 0, 0], [24, ELBOW + 5, 0, 0], [48, ELBOW, 0, 0]],
      24: [[0, ELBOW, 0, 0], [24, ELBOW + 5, 0, 0], [48, ELBOW, 0, 0]]
    }
  },
  {
    name: 'Run',
    note: 'the walk, leaning in, at twice the speed',
    fps: 24, loop: true, air: true,
    tracks: {
      /* the lean is y: x would bend the body sideways */
      3:  [[0, 0, -16, 0]],
      9:  [[0, 0, -8, 4], [7, 0, -8, -4], [14, 0, -8, 4]],
      12: [[0, 14, 0, 0]],
      10: [[0, 44, 0, 0], [3, 16, 0, 0], [7, -26, 0, 0], [10, 8, 0, 0], [14, 44, 0, 0]],
      15: [[0, -14, 0, 0], [3, -30, 0, 0], [7, -24, 0, 0], [10, -68, 0, 0], [14, -14, 0, 0]],
      21: [[0, -10, 0, 0], [7, 12, 0, 0], [14, -10, 0, 0]],
      11: [[0, -26, 0, 0], [3, 8, 0, 0], [7, 44, 0, 0], [10, 16, 0, 0], [14, -26, 0, 0]],
      16: [[0, -24, 0, 0], [3, -68, 0, 0], [7, -14, 0, 0], [10, -30, 0, 0], [14, -24, 0, 0]],
      22: [[0, 12, 0, 0], [7, -10, 0, 0], [14, 12, 0, 0]],
      /* elbows bent hard, swinging on x so the hands stay in front */
      19: [[0, -38, ARM_DOWN_R + 6, 0], [7, 34, ARM_DOWN_R + 6, 0], [14, -38, ARM_DOWN_R + 6, 0]],
      20: [[0, 34, ARM_DOWN_L - 6, 0], [7, -38, ARM_DOWN_L - 6, 0], [14, 34, ARM_DOWN_L - 6, 0]],
      23: [[0, 74, 0, 0]],
      24: [[0, 74, 0, 0]]
    }
  },
  {
    name: 'Sit',
    note: 'on the floor, legs out -- the root comes down too',
    fps: 12, loop: false,
    /* Measured, not guessed: at each key, the drop that puts the
       lowest foot back on the floor. Interpolating straight from 0
       to the final value sank the feet 689 units through it
       halfway. */
    root: [[0, 0, 0, 0], [6, 0, -561, 0], [12, 0, -2498, 0]],
    tracks: {
      3:  [[0, 0, 0, 0], [12, 0, 8, 0]],
      10: [[0, 0, 0, 0], [12, 86, 0, 0]],
      11: [[0, 0, 0, 0], [12, 86, 0, 0]],
      15: [[0, -6, 0, 0], [12, -16, 0, 0]],
      16: [[0, -6, 0, 0], [12, -16, 0, 0]],
      21: [[0, 0, 0, 0], [12, 14, 0, 0]],
      22: [[0, 0, 0, 0], [12, 14, 0, 0]],
      19: [[0, 0, ARM_DOWN_R, 0], [12, -26, ARM_DOWN_R + 14, 0]],
      20: [[0, 0, ARM_DOWN_L, 0], [12, -26, ARM_DOWN_L - 14, 0]],
      23: [[0, ELBOW, 0, 0], [12, 24, 0, 0]],
      24: [[0, ELBOW, 0, 0], [12, 24, 0, 0]]
    }
  },
  {
    name: 'Wave',
    note: 'right arm up, forearm swinging',
    fps: 18, loop: true,
    tracks: {
      19: [[0, 0, ARM_DOWN_R, 0], [6, -16, 46, 0], [30, -16, 46, 0], [36, 0, ARM_DOWN_R, 0]],
      23: [[0, ELBOW, 0, 0], [6, 40, 0, 0], [12, 40, -26, 0], [18, 40, 26, 0],
           [24, 40, -26, 0], [30, 40, 0, 0], [36, ELBOW, 0, 0]],
      20: [[0, 0, ARM_DOWN_L, 0]],
      24: [[0, ELBOW, 0, 0]],
      9:  [[0, 0, 0, 0], [6, 0, 0, -6], [30, 0, 0, -6], [36, 0, 0, 0]],
      12: [[0, 0, 0, 0], [6, 0, -10, 0], [30, 0, -10, 0], [36, 0, 0, 0]]
    }
  },
  {
    name: 'Nod',
    note: 'yes',
    fps: 16, loop: true,
    tracks: {
      12: [[0, 0, 0, 0], [5, 20, 0, 0], [10, -4, 0, 0], [15, 18, 0, 0], [22, 0, 0, 0]],
      19: [[0, 0, ARM_DOWN_R, 0]], 20: [[0, 0, ARM_DOWN_L, 0]],
      23: [[0, ELBOW, 0, 0]], 24: [[0, ELBOW, 0, 0]]
    }
  },
  {
    name: 'Shake head',
    note: 'no',
    fps: 16, loop: true,
    tracks: {
      12: [[0, 0, 0, 0], [5, 0, 24, 0], [15, 0, -24, 0], [25, 0, 24, 0], [32, 0, 0, 0]],
      19: [[0, 0, ARM_DOWN_R, 0]], 20: [[0, 0, ARM_DOWN_L, 0]],
      23: [[0, ELBOW, 0, 0]], 24: [[0, ELBOW, 0, 0]]
    }
  },
  {
    name: 'Sad',
    note: 'head and shoulders down',
    fps: 12, loop: false,
    tracks: {
      12: [[0, 0, 0, 0], [10, 26, 0, 0]],
      9:  [[0, 0, 0, 0], [10, 0, -12, 0]],
      3:  [[0, 0, 0, 0], [10, 0, -6, 0]],
      19: [[0, 0, ARM_DOWN_R, 0], [10, 14, ARM_DOWN_R + 4, 0]],
      20: [[0, 0, ARM_DOWN_L, 0], [10, 14, ARM_DOWN_L - 4, 0]],
      23: [[0, ELBOW, 0, 0], [10, 20, 0, 0]],
      24: [[0, ELBOW, 0, 0], [10, 20, 0, 0]]
    }
  },
  {
    name: 'Turn around',
    note: 'the whole body, on the hips',
    fps: 20, loop: true,
    tracks: {
      3:  [[0, 0, 0, 0], [40, 0, 0, 360]],
      19: [[0, 0, ARM_DOWN_R, 0]], 20: [[0, 0, ARM_DOWN_L, 0]],
      23: [[0, ELBOW, 0, 0]], 24: [[0, ELBOW, 0, 0]]
    }
  }
];
