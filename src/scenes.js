// The scenes: the title screen, the shore (beat 1) and the tavern room (beats 2-6).

import { setupWorld, probe } from "./world.js";
import { state } from "./beats.js";
import { SHORE, TAVERN, W, H } from "./layout.js";
import { setMood, music } from "./music.js";
import { touch, updateTouch } from "./touch.js";

const GOLD = [255, 205, 80];
const CREAM = [245, 232, 200];

const WOOD = [122, 78, 40];
const WOOD_DARK = [40, 24, 10];

export function registerScenes(k) {
  // Title screen. Nothing of the story happens here: it only waits for the
  // player to begin, and that first key or tap is also what lets the music start.
  k.scene("title", () => {
    probe.scene = "title";
    setMood("shore");
    k.add([k.sprite("shoreBg"), k.pos(0, 0), k.z(-100)]);
    k.add([k.rect(W, H), k.pos(0, 0), k.color(8, 10, 22), k.opacity(0.62), k.z(-90)]);

    const big = (txt, y, size, col, dx = 0) => k.add([k.text(txt, { size }), k.pos(W / 2 + dx, y + dx), k.anchor("center"), k.color(...col), k.z(dx ? 9 : 10)]);
    big("BUCCANEER BANTER", 118, 68, [20, 12, 4], 4);
    big("BUCCANEER BANTER", 118, 68, GOLD);
    big("A tavern tale of Tortuga", 178, 26, CREAM);

    // The torn page, between two candles.
    const page = k.add([k.sprite("ledgerPage"), k.pos(W / 2, 268), k.anchor("center"), k.scale(3), k.rotate(-6), k.z(10)]);
    page.onUpdate(() => { page.pos.y = 268 + 5 * Math.sin(k.time() * 1.6); });
    [-150, 150].forEach((dx, i) => {
      const glow = k.add([k.circle(46), k.pos(W / 2 + dx, 262), k.color(255, 190, 70), k.opacity(0.2), k.z(8)]);
      k.add([k.sprite("candle"), k.pos(W / 2 + dx, 300), k.anchor("bot"), k.scale(2), k.z(10)]);
      glow.onUpdate(() => { glow.opacity = 0.17 + 0.08 * Math.sin(k.time() * 5 + i * 1.7); });
    });
    big("He has no name, no memory, and one torn page", 342, 20, CREAM);
    big("of numbers that do not add up.", 368, 20, CREAM);

    k.add([k.rect(560, 62, { radius: 8 }), k.pos(W / 2, 430), k.anchor("center"), k.color(16, 12, 8), k.outline(4, k.rgb(...GOLD)), k.z(10)]);
    const go = big("", 430, 30, GOLD);
    go.z = 11;
    const help = big("", 494, 18, CREAM);
    go.onUpdate(() => {
      go.text = touch.enabled ? "Tap here to begin" : "Press Enter to begin";
      go.opacity = 0.72 + 0.28 * Math.sin(k.time() * 3.2);
      const sound = music.available ? (music.muted ? "Music is off" : "Music is on") + (touch.enabled ? " (button at the top)" : " (M changes it)") : "No sound on this browser";
      help.text = touch.enabled ? `${sound}.  Hold your phone sideways.` : `${sound}.  Walk: arrow keys or WASD.  Talk: E.`;
      updateTouch({ visible: false, canTalk: false });
    });

    let begun = false;
    const begin = () => {
      if (begun || k.time() - opened < 0.3) return; // ignore a key still held from loading
      begun = true;
      k.go("shore");
    };
    const opened = k.time();
    k.onKeyPress(["enter", "space", "e"], begin);
    k.onMousePress(begin);
  });

  k.scene("shore", () => {
    setMood("shore");
    k.add([k.sprite("shoreBg"), k.pos(0, 0), k.z(-100)]);
    setupWorld(k, { name: "shore", layout: SHORE, intro: "shore_intro", introFlag: "shoreIntroDone" });
  });

  k.scene("tavern", () => {
    setMood("tavern");
    k.add([k.sprite("tavernBg"), k.pos(0, 0), k.z(-100)]);

    // Furniture. z = the y of its front edge, so people sort in front/behind.
    const slab = (r, col) =>
      k.add([k.rect(r.w, r.h, { radius: 3 }), k.pos(r.x, r.y), k.color(...col), k.outline(3, k.rgb(...WOOD_DARK)), k.z(r.y + r.h)]);
    slab(TAVERN.bar, [150, 96, 48]);
    TAVERN.tables.forEach((t) => slab(t, WOOD));
    TAVERN.benches.forEach((b) => slab(b, [92, 58, 28]));
    TAVERN.barrels.forEach((b) => k.add([k.sprite("barrel"), k.pos(b.x, b.y), k.anchor("bot"), k.z(b.y)]));

    // Candles with a slow flicker.
    TAVERN.candles.forEach((c, i) => {
      const glow = k.add([k.circle(26), k.pos(c.x, c.y - 4), k.color(255, 190, 70), k.opacity(0.2), k.z(c.y + 60)]);
      k.add([k.sprite("candle"), k.pos(c.x, c.y + 8), k.anchor("bot"), k.z(c.y + 61)]);
      glow.onUpdate(() => { glow.opacity = 0.16 + 0.07 * Math.sin(k.time() * 5 + i * 1.7); });
    });

    // The three NPCs, each with a name tag.
    for (const [id, n] of Object.entries(TAVERN.npcs)) {
      const parts = [
        k.add([k.sprite(id), k.pos(n.x, n.y), k.anchor("bot"), k.z(n.y), id]),
        k.add([k.rect(n.name.length * 11 + 14, 22, { radius: 4 }), k.pos(n.x, n.y - 74), k.anchor("center"), k.color(16, 12, 8), k.opacity(0.85), k.z(800)]),
        k.add([k.text(n.name, { size: 16 }), k.pos(n.x, n.y - 74), k.anchor("center"), k.color(255, 205, 80), k.z(801)]),
      ];
      // In the ending where you side with the bo'sun, the rogue slips away.
      if (id === "rogue") parts[0].onUpdate(() => parts.forEach((p) => { p.hidden = state.ended && state.vars.trust === "bosun"; }));
    }

    // The page itself, lying where the story has put it.
    const bt = TAVERN.tables.find((t) => t.id === "bosun");
    const page = k.add([k.sprite("ledgerPage"), k.pos(0, 0), k.anchor("center"), k.z(790)]);
    page.onUpdate(() => {
      const onBar = state.ended && state.vars.trust === "bartender";
      page.hidden = state.beat < 4 || (state.ended && state.vars.trust === "rogue");
      page.pos.x = onBar ? TAVERN.bar.x + 250 : bt.x + 112;
      page.pos.y = onBar ? TAVERN.bar.y + 22 : bt.y + 26;
    });

    setupWorld(k, { name: "tavern", layout: TAVERN, intro: "tavern_enter", introFlag: "tavernIntroDone" });
  });
}
