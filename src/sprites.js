// Placeholder art. Every sprite is painted here with simple shapes and flat
// colours on an off-screen canvas, then handed to KAPLAY. No image files, no
// downloads. Swap any of these for real art later by replacing the loadSprite
// call with a file path; the names stay the same.

import { FACTS, fmt } from "./facts.js";
import { W, H, SHORE } from "./layout.js";

function paint(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"));
  return c.toDataURL();
}

// A 48 x 64 standing figure. Feet are at the bottom centre.
function person(g, { coat, legs, skin, extra }) {
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath(); g.ellipse(24, 60, 15, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = legs;
  g.fillRect(15, 44, 7, 16); g.fillRect(26, 44, 7, 16);
  g.fillStyle = coat;
  g.fillRect(11, 24, 26, 23);          // body
  g.fillRect(6, 26, 6, 17); g.fillRect(36, 26, 6, 17); // arms
  g.fillStyle = skin;
  g.fillRect(6, 42, 6, 5); g.fillRect(36, 42, 6, 5);   // hands
  g.beginPath(); g.arc(24, 15, 9, 0, Math.PI * 2); g.fill(); // head
  g.fillStyle = "#1a1208";
  g.fillRect(20, 14, 2, 2); g.fillRect(27, 14, 2, 2);  // eyes
  extra?.(g);
  g.strokeStyle = "#0b0805"; g.lineWidth = 2;
  g.strokeRect(11, 24, 26, 23);
}

// The torn page, large. counted = false: the written figures only.
// counted = true: the bo'sun's count in red beside them, and the shortfall.
function bigPage(counted) {
  const w = counted ? 560 : 440;
  const h = counted ? 300 : 252;
  return paint(w, h, (g) => {
    g.fillStyle = "#f3e2b3";
    g.beginPath();
    g.moveTo(6, 6); g.lineTo(w - 80, 6); g.lineTo(w - 62, 26); g.lineTo(w - 44, 12); g.lineTo(w - 28, 34);
    g.lineTo(w - 6, 30); g.lineTo(w - 6, h - 6); g.lineTo(6, h - 6); g.closePath(); g.fill();
    g.strokeStyle = "#4a3418"; g.lineWidth = 4; g.stroke();
    const INK = "#24170a";
    const RED = "#a01818";
    const X1 = 28, X2 = 190, X3 = 440;
    g.fillStyle = INK;
    g.font = "bold 22px Georgia, serif";
    g.fillText("Stores taken aboard", X1, 46);
    if (counted) { g.fillStyle = RED; g.fillText("Counted", X3, 46); g.fillStyle = INK; }
    g.fillRect(X1, 56, w - 120, 2);
    const rows = [FACTS.rum, FACTS.sugar, FACTS.silver];
    rows.forEach((r, i) => {
      const y = 92 + i * 40;
      g.font = "22px Georgia, serif";
      g.fillStyle = INK;
      g.fillText(r.label, X1, y);
      g.fillText(`${fmt(r.recorded)} ${r.unit}`, X2, y);
      if (counted) {
        g.fillStyle = RED;
        g.font = "bold 22px Georgia, serif";
        g.fillText(fmt(r.counted), X3, y);
      }
    });
    g.fillStyle = INK;
    g.fillRect(X1, 190, w - 60, 2);
    g.font = "bold 24px Georgia, serif";
    g.fillText(FACTS.total.label, X1, 226);
    g.fillText(`${fmt(FACTS.total.recorded)} ${FACTS.total.unit}`, X2, 226);
    if (counted) {
      g.fillStyle = RED;
      g.fillText(fmt(FACTS.total.counted), X3, 226);
      g.fillText(`${fmt(FACTS.total.missing)} pieces of eight missing`, X1, 272);
    }
  });
}

const SPRITES = {
  // Main character: ragged pale shirt, wet dark hair. Bright so he stands out.
  hero: () => paint(48, 64, (g) => person(g, {
    coat: "#f2ead8", legs: "#7a5632", skin: "#e3b58a",
    extra: (g) => {
      g.fillStyle = "#2a1c10"; g.fillRect(15, 5, 18, 6); g.fillRect(14, 8, 4, 8);
      g.fillStyle = "#c0392b"; g.fillRect(11, 40, 26, 4); // red sash
    },
  })),

  // Bartender: big, bald, white apron over green.
  bartender: () => paint(48, 64, (g) => person(g, {
    coat: "#2f6b45", legs: "#3b2a1a", skin: "#d9a273",
    extra: (g) => {
      g.fillStyle = "#f4f4f0"; g.fillRect(15, 28, 18, 19);       // apron
      g.fillStyle = "#3a2412"; g.fillRect(18, 19, 12, 3);        // moustache
    },
  })),

  // Rogue: dark coat, wide black hat pulled low, gold earring.
  rogue: () => paint(48, 64, (g) => person(g, {
    coat: "#5b2a86", legs: "#1d1626", skin: "#c99a6b",
    extra: (g) => {
      g.fillStyle = "#0d0a12"; g.fillRect(8, 6, 32, 5); g.fillRect(15, 0, 18, 8); // hat
      g.fillStyle = "#ffd24a"; g.fillRect(33, 18, 3, 3);                           // earring
    },
  })),

  // Bo'sun: navy coat, grey beard, spectacles, quill in hand.
  bosun: () => paint(48, 64, (g) => person(g, {
    coat: "#1f4e8c", legs: "#2a2a33", skin: "#dcae84",
    extra: (g) => {
      g.fillStyle = "#cfcfcf"; g.fillRect(17, 18, 14, 8); g.fillRect(15, 5, 18, 4); // beard, hair
      g.strokeStyle = "#111"; g.lineWidth = 1.5;
      g.strokeRect(18, 12, 5, 5); g.strokeRect(25, 12, 5, 5);                        // spectacles
      g.fillStyle = "#ffffff"; g.fillRect(38, 30, 2, 14);                            // quill
      g.fillStyle = "#ffd24a"; g.fillRect(14, 28, 3, 3); g.fillRect(14, 34, 3, 3);   // buttons
    },
  })),

  // Small ledger page: the icon for the pocket, the bar and the table.
  ledgerPage: () => paint(28, 34, (g) => {
    g.fillStyle = "#f3e2b3";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(22, 0); g.lineTo(28, 5); g.lineTo(24, 9);
    g.lineTo(28, 14); g.lineTo(28, 34); g.lineTo(0, 34); g.closePath(); g.fill();
    g.strokeStyle = "#4a3418"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#3b2a14";
    for (let y = 8; y < 30; y += 6) g.fillRect(4, y, 16, 2);
  }),

  // Large ledger page for reading. Its text is drawn straight from the fact
  // sheet, so it cannot disagree with it. This one shows what is WRITTEN.
  ledgerPageBig: () => bigPage(false),
  // The same page with the bo'sun's count beside it. Shown from beat 5 only.
  ledgerPageCounted: () => bigPage(true),

  barrel: () => paint(44, 52, (g) => {
    g.fillStyle = "#8a5a2b"; g.fillRect(4, 6, 36, 44);
    g.fillStyle = "#a9713a"; g.beginPath(); g.ellipse(22, 8, 18, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3a3a3a"; g.fillRect(4, 16, 36, 4); g.fillRect(4, 38, 36, 4);
    g.strokeStyle = "#1c1108"; g.lineWidth = 2; g.strokeRect(4, 6, 36, 44);
  }),

  candle: () => paint(12, 26, (g) => {
    g.fillStyle = "#fff6d8"; g.fillRect(3, 10, 6, 16);
    g.fillStyle = "#ffb52e"; g.beginPath(); g.ellipse(6, 6, 4, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff3a0"; g.beginPath(); g.ellipse(6, 7, 2, 3, 0, 0, Math.PI * 2); g.fill();
  }),

  // Tavern room: back wall with shelves and sea-facing windows, plank floor.
  // Furniture is added by the scene as separate objects so characters can
  // stand behind it.
  tavernBg: () => paint(W, H, (g) => {
    g.fillStyle = "#6b4a2b"; g.fillRect(0, 0, W, H);                 // floor
    g.strokeStyle = "#4f351d"; g.lineWidth = 2;
    for (let y = 100; y < H; y += 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0, i = 0; x < W; x += 120, i++) {
      for (let y = 100 + (i % 2) * 36; y < H; y += 72) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 36); g.stroke(); }
    }
    g.fillStyle = "#33210f"; g.fillRect(0, 0, W, 100);               // back wall
    g.fillStyle = "#24160a"; g.fillRect(0, 92, W, 8);
    g.fillStyle = "#1a2f4a";                                         // open windows: night sea
    [[560, 18], [700, 18], [840, 18]].forEach(([x, y]) => {
      g.fillRect(x, y, 90, 56);
      g.fillStyle = "#e8e2c0"; g.beginPath(); g.arc(x + 68, y + 16, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2c5f8a"; g.fillRect(x, y + 38, 90, 18);
      g.strokeStyle = "#8a5a2b"; g.lineWidth = 5; g.strokeRect(x, y, 90, 56);
      g.fillStyle = "#1a2f4a";
    });
    g.fillStyle = "#5a3a1c"; g.fillRect(100, 30, 380, 8); g.fillRect(100, 64, 380, 8); // shelves
    const bottle = ["#2e8b57", "#b5651d", "#7b1e1e", "#d9c27a"];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = bottle[i % 4];
      g.fillRect(112 + i * 23, i % 3 === 0 ? 12 : 16, 10, i % 3 === 0 ? 18 : 14);
      g.fillStyle = bottle[(i + 2) % 4];
      g.fillRect(112 + i * 23, 48, 10, 16);
    }
    g.fillStyle = "#24160a"; g.fillRect(0, 100, 30, H); g.fillRect(W - 30, 100, 30, H); // side walls
    g.fillRect(0, H - 14, W, 14);
    g.fillStyle = "#a9713a"; g.fillRect(440, H - 14, 80, 14);        // doorway, bottom centre
  }),

  // Shore: night sea on the left, sand, the tavern up the beach on the right.
  shoreBg: () => paint(W, H, (g) => {
    g.fillStyle = "#12233d"; g.fillRect(0, 0, W, 190);               // sky
    g.fillStyle = "#e8e2c0"; g.beginPath(); g.arc(150, 112, 22, 0, Math.PI * 2); g.fill(); // moon
    g.fillStyle = "#1c2b22";                                         // hill and town
    g.beginPath(); g.moveTo(300, 190); g.lineTo(520, 90); g.lineTo(760, 60); g.lineTo(W, 110); g.lineTo(W, 190); g.fill();
    g.fillStyle = "#ffcf5a";
    [[540, 120], [600, 104], [660, 96], [640, 140], [580, 150]].forEach(([x, y]) => g.fillRect(x, y, 6, 6));
    g.fillStyle = "#d9c08a"; g.fillRect(0, 190, W, H - 190);         // sand
    g.fillStyle = "#1f5f8b";                                         // sea
    g.beginPath(); g.moveTo(0, 150); g.lineTo(260, 150); g.lineTo(215, 300); g.lineTo(235, 420); g.lineTo(190, H); g.lineTo(0, H); g.fill();
    g.strokeStyle = "#e9f4f7"; g.lineWidth = 5;                      // surf line
    g.beginPath(); g.moveTo(260, 150); g.lineTo(215, 300); g.lineTo(235, 420); g.lineTo(190, H); g.stroke();
    g.strokeStyle = "#3f86b3"; g.lineWidth = 3;
    for (let y = 190; y < H; y += 44) { g.beginPath(); g.moveTo(30, y); g.lineTo(150, y + 8); g.stroke(); }
    g.fillStyle = "#6b4a2b"; g.fillRect(480, 150, 14, 120);          // palm
    g.fillStyle = "#2e7d4f";
    [[-40, -6], [40, -6], [-28, -28], [28, -28], [0, -36]].forEach(([dx, dy]) => {
      g.beginPath(); g.ellipse(487 + dx, 150 + dy, 34, 10, Math.atan2(dy, dx), 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = "#8a6a45"; g.fillRect(330, 470, 90, 12);           // driftwood
    // The tavern, seen from outside.
    g.fillStyle = "#5a3a1c"; g.fillRect(700, 150, 250, 195);
    g.strokeStyle = "#2a190b"; g.lineWidth = 3;
    for (let y = 172; y < 345; y += 24) { g.beginPath(); g.moveTo(700, y); g.lineTo(950, y); g.stroke(); }
    g.fillStyle = "#3a2412";
    g.beginPath(); g.moveTo(684, 150); g.lineTo(825, 96); g.lineTo(960, 150); g.fill(); // roof
    g.fillStyle = "#ffcf5a"; g.fillRect(725, 220, 44, 44); g.fillRect(884, 220, 44, 44); // lit windows
    g.strokeStyle = "#2a190b"; g.strokeRect(725, 220, 44, 44); g.strokeRect(884, 220, 44, 44);
    const d = SHORE.door;                                            // lamp-lit door
    g.fillStyle = "#ffb52e"; g.fillRect(d.x - 26, d.y - 80, 52, 80);
    g.strokeStyle = "#fff3a0"; g.lineWidth = 4; g.strokeRect(d.x - 26, d.y - 80, 52, 80);
    g.fillStyle = "#f3e2b3"; g.fillRect(d.x - 60, 160, 120, 30);     // sign
    g.strokeStyle = "#2a190b"; g.lineWidth = 3; g.strokeRect(d.x - 60, 160, 120, 30);
    g.fillStyle = "#24170a"; g.font = "bold 20px Georgia, serif"; g.textAlign = "center";
    g.fillText("TAVERN", d.x, 182);
  }),
};

export function loadAllSprites(k) {
  for (const [name, make] of Object.entries(SPRITES)) k.loadSprite(name, make());
}
