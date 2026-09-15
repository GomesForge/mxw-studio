/* A starter set of motions.

   These are ours, not the game's. Nobody has published one of the
   game's motion files, so nothing here is the original animation data
   -- what is the game's is the rig underneath: the skeleton, the bone
   order, the rest pose and which vertices follow which bone. When a
   real motion file does turn up it drops into the same player, because
   it is the same thing: a rotation per bone per frame.

   Which axis moves what was measured, not guessed. Rotating one bone by
   30 degrees and watching where the limb it drives ends up gives:

     arms      x swings forward (-z), y lifts -- and the lift is
               mirrored, +y raising the right arm and -y the left
     legs      x swings forward, the same sign on both sides, y spreads
               sideways
     spine     x bends forward, y twists
     neck      x nods, y turns
     z         is each bone's own axis, so it twists the limb in place

   Bones: 3 hips, 4 spine, 9 chest, 12 neck, 18 head, 19/20 upper arm
   R/L, 23/24 forearm R/L, 30/31 wrist R/L, 10/11 thigh, 15/16 shin,
   21/22 ankle, 25/26 foot. docs/motion-format.md has the format. */

/* The bodies are authored in a T-pose, arms straight out. Almost every
   motion wants them down first, so this is the offset the rest of them
   start from. */
const ARMS_DOWN_R = -68;
const ARMS_DOWN_L = 68;

const BUILT_IN_MOTIONS = [
  {
    name: 'Bind pose',
    note: 'the file exactly as authored, arms out',
    fps: 12, loop: false, tracks: {}
  },
  {
    name: 'Stand',
    note: 'arms brought down to the sides',
    fps: 12, loop: false,
    tracks: {
      19: [[0, 0, ARMS_DOWN_R, 0]],
      20: [[0, 0, ARMS_DOWN_L, 0]],
      23: [[0, 0, -10, 0]],
      24: [[0, 0, 10, 0]]
    }
  },
  {
    name: 'Breathe',
    note: 'a standing idle -- the chest and shoulders only',
    fps: 24, loop: true,
    tracks: {
      9:  [[0, 0, 0, 0], [24, -2.5, 0, 0], [48, 0, 0, 0]],
      12: [[0, 1.5, 0, 0], [24, -1, 0, 0], [48, 1.5, 0, 0]],
      19: [[0, 0, ARMS_DOWN_R, 0], [24, 2, ARMS_DOWN_R - 3, 0], [48, 0, ARMS_DOWN_R, 0]],
      20: [[0, 0, ARMS_DOWN_L, 0], [24, 2, ARMS_DOWN_L + 3, 0], [48, 0, ARMS_DOWN_L, 0]],
      23: [[0, 0, -10, 0], [24, 0, -14, 0], [48, 0, -10, 0]],
      24: [[0, 0, 10, 0], [24, 0, 14, 0], [48, 0, 10, 0]]
    }
  },
  {
    name: 'Wave',
    note: 'right arm up, forearm swinging',
    fps: 18, loop: true,
    tracks: {
      19: [[0, 0, ARMS_DOWN_R, 0], [6, 0, 40, 0], [30, 0, 40, 0], [36, 0, ARMS_DOWN_R, 0]],
      23: [[0, 0, -10, 0], [6, 0, 30, 0], [12, -28, 30, 0], [18, 28, 30, 0],
           [24, -28, 30, 0], [30, 0, 30, 0], [36, 0, -10, 0]],
      20: [[0, 0, ARMS_DOWN_L, 0]],
      24: [[0, 0, 10, 0]],
      9:  [[0, 0, 0, 0], [6, 0, -8, 0], [30, 0, -8, 0], [36, 0, 0, 0]],
      12: [[0, 0, 0, 0], [6, 0, -10, 0], [30, 0, -10, 0], [36, 0, 0, 0]]
    }
  },
  {
    name: 'Nod',
    note: 'yes',
    fps: 16, loop: true,
    tracks: {
      12: [[0, 0, 0, 0], [5, 20, 0, 0], [10, -4, 0, 0], [15, 18, 0, 0], [22, 0, 0, 0]],
      19: [[0, 0, ARMS_DOWN_R, 0]], 20: [[0, 0, ARMS_DOWN_L, 0]],
      23: [[0, 0, -10, 0]], 24: [[0, 0, 10, 0]]
    }
  },
  {
    name: 'Shake head',
    note: 'no',
    fps: 16, loop: true,
    tracks: {
      12: [[0, 0, 0, 0], [5, 0, 24, 0], [15, 0, -24, 0], [25, 0, 24, 0], [32, 0, 0, 0]],
      19: [[0, 0, ARMS_DOWN_R, 0]], 20: [[0, 0, ARMS_DOWN_L, 0]],
      23: [[0, 0, -10, 0]], 24: [[0, 0, 10, 0]]
    }
  },
  {
    name: 'Walk',
    note: 'a four-key cycle, arms counter-swinging',
    fps: 20, loop: true,
    tracks: {
      10: [[0, 26, 0, 0], [10, 0, 0, 0], [20, -22, 0, 0], [30, 0, 0, 0], [40, 26, 0, 0]],
      15: [[0, -12, 0, 0], [10, -34, 0, 0], [20, -6, 0, 0], [30, -20, 0, 0], [40, -12, 0, 0]],
      11: [[0, -22, 0, 0], [10, 0, 0, 0], [20, 26, 0, 0], [30, 0, 0, 0], [40, -22, 0, 0]],
      16: [[0, -6, 0, 0], [10, -20, 0, 0], [20, -12, 0, 0], [30, -34, 0, 0], [40, -6, 0, 0]],
      21: [[0, 8, 0, 0], [20, -8, 0, 0], [40, 8, 0, 0]],
      22: [[0, -8, 0, 0], [20, 8, 0, 0], [40, -8, 0, 0]],
      19: [[0, -18, ARMS_DOWN_R, 0], [20, 18, ARMS_DOWN_R, 0], [40, -18, ARMS_DOWN_R, 0]],
      20: [[0, 18, ARMS_DOWN_L, 0], [20, -18, ARMS_DOWN_L, 0], [40, 18, ARMS_DOWN_L, 0]],
      23: [[0, 0, -16, 0]], 24: [[0, 0, 16, 0]],
      9:  [[0, 0, 4, 0], [20, 0, -4, 0], [40, 0, 4, 0]],
      3:  [[0, 1, -3, 0], [20, 1, 3, 0], [40, 1, -3, 0]]
    }
  },
  {
    name: 'Run',
    note: 'the walk, leaning in and twice the speed',
    fps: 30, loop: true,
    tracks: {
      3:  [[0, -14, -5, 0], [14, -14, 5, 0], [28, -14, -5, 0]],
      10: [[0, 48, 0, 0], [7, 6, 0, 0], [14, -30, 0, 0], [21, 6, 0, 0], [28, 48, 0, 0]],
      15: [[0, -34, 0, 0], [7, -72, 0, 0], [14, -10, 0, 0], [21, -50, 0, 0], [28, -34, 0, 0]],
      11: [[0, -30, 0, 0], [7, 6, 0, 0], [14, 48, 0, 0], [21, 6, 0, 0], [28, -30, 0, 0]],
      16: [[0, -10, 0, 0], [7, -50, 0, 0], [14, -34, 0, 0], [21, -72, 0, 0], [28, -10, 0, 0]],
      19: [[0, -44, -50, 0], [14, 30, -50, 0], [28, -44, -50, 0]],
      20: [[0, 30, 50, 0], [14, -44, 50, 0], [28, 30, 50, 0]],
      23: [[0, 0, -70, 0]], 24: [[0, 0, 70, 0]],
      9:  [[0, -6, 6, 0], [14, -6, -6, 0], [28, -6, 6, 0]],
      12: [[0, 10, 0, 0]]
    }
  },
  {
    name: 'Sit',
    note: 'on the floor, legs out',
    fps: 12, loop: false,
    tracks: {
      3:  [[0, 0, 0, 0], [12, -8, 0, 0]],
      10: [[0, 0, 0, 0], [12, 84, 0, 0]],
      11: [[0, 0, 0, 0], [12, 84, 0, 0]],
      15: [[0, 0, 0, 0], [12, -14, 0, 0]],
      16: [[0, 0, 0, 0], [12, -14, 0, 0]],
      19: [[0, 0, ARMS_DOWN_R, 0], [12, -20, -54, 0]],
      20: [[0, 0, ARMS_DOWN_L, 0], [12, -20, 54, 0]],
      23: [[0, 0, -10, 0], [12, 0, -24, 0]],
      24: [[0, 0, 10, 0], [12, 0, 24, 0]]
    }
  },
  {
    name: 'Cheer',
    note: 'both arms up, twice',
    fps: 18, loop: true,
    tracks: {
      19: [[0, 0, ARMS_DOWN_R, 0], [5, 0, 78, 0], [11, 0, 40, 0], [16, 0, 78, 0],
           [24, 0, 78, 0], [30, 0, ARMS_DOWN_R, 0]],
      20: [[0, 0, ARMS_DOWN_L, 0], [5, 0, -78, 0], [11, 0, -40, 0], [16, 0, -78, 0],
           [24, 0, -78, 0], [30, 0, ARMS_DOWN_L, 0]],
      23: [[0, 0, -10, 0], [5, 0, 16, 0], [30, 0, -10, 0]],
      24: [[0, 0, 10, 0], [5, 0, -16, 0], [30, 0, 10, 0]],
      9:  [[0, 0, 0, 0], [5, -10, 0, 0], [24, -10, 0, 0], [30, 0, 0, 0]],
      12: [[0, 0, 0, 0], [5, -14, 0, 0], [24, -14, 0, 0], [30, 0, 0, 0]],
      10: [[0, 0, 0, 0], [5, -6, 0, 0], [24, -6, 0, 0], [30, 0, 0, 0]],
      11: [[0, 0, 0, 0], [5, -6, 0, 0], [24, -6, 0, 0], [30, 0, 0, 0]]
    }
  },
  {
    name: 'Sad',
    note: 'head and shoulders down',
    fps: 12, loop: false,
    tracks: {
      12: [[0, 0, 0, 0], [10, 26, 0, 0]],
      9:  [[0, 0, 0, 0], [10, 10, 0, 0]],
      3:  [[0, 0, 0, 0], [10, 6, 0, 0]],
      19: [[0, 0, ARMS_DOWN_R, 0], [10, 8, -58, 0]],
      20: [[0, 0, ARMS_DOWN_L, 0], [10, 8, 58, 0]],
      23: [[0, 0, -10, 0], [10, 0, -22, 0]],
      24: [[0, 0, 10, 0], [10, 0, 22, 0]]
    }
  },
  {
    name: 'Turn around',
    note: 'the whole body, on the hips',
    fps: 20, loop: true,
    tracks: {
      3:  [[0, 0, 0, 0], [40, 0, 360, 0]],
      19: [[0, 0, ARMS_DOWN_R, 0]], 20: [[0, 0, ARMS_DOWN_L, 0]],
      23: [[0, 0, -10, 0]], 24: [[0, 0, 10, 0]]
    }
  }
];
