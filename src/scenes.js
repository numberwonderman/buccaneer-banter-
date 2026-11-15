// The two scenes: the shore (beat 1) and the tavern room (beats 2-6).

import { setupWorld } from "./world.js";
import { state } from "./beats.js";
import { SHORE, TAVERN } from "./layout.js";

const WOOD = [122, 78, 40];
const WOOD_DARK = [40, 24, 10];

export function registerScenes(k) {
  k.scene("shore", () => {
    k.add([k.sprite("shoreBg"), k.pos(0, 0), k.z(-100)]);
    setupWorld(k, { name: "shore", layout: SHORE, intro: "shore_intro", introFlag: "shoreIntroDone" });
  });

  k.scene("tavern", () => {
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
