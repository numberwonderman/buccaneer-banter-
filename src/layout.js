// Where everything stands. One shared map, used for drawing AND for collision,
// so what you see is what you bump into. Screen is 960 x 540.
// A character's x,y is the point between their feet.

export const W = 960;
export const H = 540;

export const SHORE = {
  spawn: { x: 270, y: 400 },
  bounds: { x1: 235, y1: 200, x2: 935, y2: 515 },
  obstacles: [
    { x: 700, y: 110, w: 250, h: 235 }, // the tavern building
    { x: 470, y: 250, w: 36, h: 24 },   // palm trunk
  ],
  door: { x: 825, y: 345 },
  interactables: [
    { id: "door", label: "the tavern door", prompt: "E: tavern door", talk: { x: 825, y: 385 } },
  ],
};

export const TAVERN = {
  spawn: { x: 480, y: 490 },
  bounds: { x1: 40, y1: 110, x2: 920, y2: 520 },
  bar: { x: 90, y: 150, w: 400, h: 46 },
  tables: [
    { x: 380, y: 262, w: 240, h: 50, id: "long" },   // long communal table
    { x: 700, y: 256, w: 150, h: 54, id: "bosun" },  // the bo'sun's table
    { x: 128, y: 292, w: 62, h: 42, id: "rogue" },   // the rogue's corner table
  ],
  benches: [
    { x: 392, y: 240, w: 216, h: 12 },
    { x: 392, y: 322, w: 216, h: 12 },
  ],
  barrels: [
    { x: 548, y: 190 }, { x: 596, y: 196 },          // beside the bar
    { x: 886, y: 232 }, { x: 898, y: 292 }, { x: 872, y: 180 }, // by the bo'sun
    { x: 66, y: 470 },
  ],
  candles: [
    { x: 440, y: 272 }, { x: 560, y: 272 }, { x: 735, y: 268 }, { x: 160, y: 300 },
    { x: 130, y: 158 }, { x: 450, y: 158 },
  ],
  npcs: {
    bartender: { x: 285, y: 150, name: "Bartender" },
    rogue:     { x: 92,  y: 322, name: "Rogue" },
    bosun:     { x: 775, y: 258, name: "Bo'sun" },
  },
  interactables: [
    { id: "bartender", label: "the bartender", prompt: "E: talk to the bartender", talk: { x: 285, y: 225 } },
    { id: "rogue",     label: "the rogue",     prompt: "E: talk to the rogue",     talk: { x: 225, y: 330 } },
    { id: "bosun",     label: "the bo'sun",    prompt: "E: talk to the bo'sun",    talk: { x: 775, y: 350 } },
  ],
};

const BARREL_R = 20;

// Solid things in the tavern, as rectangles.
TAVERN.obstacles = [
  TAVERN.bar,
  ...TAVERN.tables,
  ...TAVERN.benches,
  ...TAVERN.barrels.map((b) => ({ x: b.x - BARREL_R, y: b.y - 26, w: BARREL_R * 2, h: 26 })),
  { x: 60, y: 300, w: 60, h: 26 }, // the rogue on his barrel
];

export const TALK_RADIUS = 62;
