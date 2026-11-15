// Shared scene plumbing: the player, walking, bumping into things, the
// "press E" prompt, the beat banner, and the dialogue box.

import { createDialogue, ui } from "./dialogue.js";
import { state, currentBeat, LAST_BEAT } from "./beats.js";
import { entryFor } from "./script.js";
import { TALK_RADIUS, W } from "./layout.js";
import { touch, setTalkHandler, updateTouch } from "./touch.js";

const SPEED = 190;
const FOOT_W = 22; // the player's collision box sits round his feet
const FOOT_H = 12;

// Live info for the play-test (and for debugging in the browser console).
export const probe = { scene: null, x: 0, y: 0, near: null };

function hits(x, y, layout) {
  const b = layout.bounds;
  if (x - FOOT_W / 2 < b.x1 || x + FOOT_W / 2 > b.x2 || y - FOOT_H < b.y1 || y > b.y2) return true;
  return layout.obstacles.some((o) => x + FOOT_W / 2 > o.x && x - FOOT_W / 2 < o.x + o.w && y > o.y && y - FOOT_H < o.y + o.h);
}

// Where the torn page is right now, in words.
export function pageHolder() {
  if (state.ended) return { bosun: "bo'sun has it", rogue: "rogue has it", bartender: "under the bar" }[state.vars.trust];
  if (state.beat >= 4) return "bo'sun has it";
  return state.beat === 3 ? "in your hand" : "in pocket";
}

export function setupWorld(k, { name, layout, intro, introFlag }) {
  probe.scene = name;

  const player = k.add([k.sprite("hero"), k.pos(layout.spawn.x, layout.spawn.y), k.anchor("bot"), k.z(layout.spawn.y), "player"]);

  // Beat banner and goal, top left. Page status, top right.
  k.add([k.rect(560, 56, { radius: 6 }), k.pos(12, 10), k.color(16, 12, 8), k.opacity(0.88), k.fixed(), k.z(900)]);
  const beatT = k.add([k.text("", { size: 20 }), k.pos(24, 14), k.color(255, 205, 80), k.fixed(), k.z(901)]);
  const goalT = k.add([k.text("", { size: 17 }), k.pos(24, 40), k.color(245, 232, 200), k.fixed(), k.z(901)]);
  k.add([k.rect(262, 44, { radius: 6 }), k.pos(W - 274, 10), k.color(16, 12, 8), k.opacity(0.88), k.fixed(), k.z(900)]);
  k.add([k.sprite("ledgerPage"), k.pos(W - 264, 15), k.fixed(), k.z(901)]);
  const pageT = k.add([k.text("", { size: 17 }), k.pos(W - 228, 24), k.color(245, 232, 200), k.fixed(), k.z(901)]);

  // "E: talk to ..." prompt, bottom centre.
  const promptBg = k.add([k.rect(420, 40, { radius: 6 }), k.pos(W / 2, 512), k.anchor("center"), k.color(16, 12, 8), k.outline(3, k.rgb(255, 205, 80)), k.fixed(), k.z(900)]);
  const promptT = k.add([k.text("", { size: 20 }), k.pos(W / 2, 512), k.anchor("center"), k.color(255, 205, 80), k.fixed(), k.z(901)]);

  let dialogue = null;
  const syncTouch = () => updateTouch({ visible: !dialogue?.isActive(), canTalk: !!(dialogue && !dialogue.isActive() && nearest()) });
  dialogue = createDialogue(k, syncTouch);

  function nearest() {
    let best = null;
    let bestD = TALK_RADIUS;
    for (const it of layout.interactables) {
      const d = Math.hypot(player.pos.x - it.talk.x, player.pos.y - it.talk.y);
      if (d <= bestD) { best = it; bestD = d; }
    }
    return best;
  }

  // One handler for E / Space / Enter: continue the dialogue if one is open,
  // otherwise talk to whoever is in reach.
  function talk() {
    if (dialogue.isActive()) return dialogue.confirm();
    const it = nearest();
    if (it) dialogue.start(entryFor(it.id, state));
  }
  k.onKeyPress(["e", "space", "enter"], talk);
  setTalkHandler(talk); // the on-screen Talk button does the same thing

  let walkT = 0;
  k.onUpdate(() => {
    if (!dialogue.isActive()) {
      let dx = 0, dy = 0;
      if (k.isKeyDown("left") || k.isKeyDown("a") || touch.left) dx -= 1;
      if (k.isKeyDown("right") || k.isKeyDown("d") || touch.right) dx += 1;
      if (k.isKeyDown("up") || k.isKeyDown("w") || touch.up) dy -= 1;
      if (k.isKeyDown("down") || k.isKeyDown("s") || touch.down) dy += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const step = SPEED * Math.min(k.dt(), 0.1); // capped so a slow frame cannot jump a table
        const nx = player.pos.x + (dx / len) * step;
        const ny = player.pos.y + (dy / len) * step;
        // Move one axis at a time so he slides along walls and tables.
        if (!hits(nx, player.pos.y, layout)) player.pos.x = nx;
        if (!hits(player.pos.x, ny, layout)) player.pos.y = ny;
        if (dx) player.flipX = dx < 0;
        walkT += k.dt();
      }
    }
    player.z = player.pos.y;

    const it = dialogue.isActive() ? null : nearest();
    promptBg.hidden = promptT.hidden = !it;
    if (it) promptT.text = touch.enabled ? it.prompt.replace(/^E: (talk to )?/, "Talk button: ") : it.prompt;
    updateTouch({ visible: !dialogue.isActive(), canTalk: !!it });

    const b = currentBeat();
    beatT.text = state.ended ? "The end. Beats 1 to 6 complete" : `Beat ${b.id} of ${LAST_BEAT}: ${b.name}`;
    goalT.text = state.ended ? "You can still walk and talk. Reload the page to play again." : b.goal;
    pageT.text = "Page: " + pageHolder();

    probe.x = Math.round(player.pos.x);
    probe.y = Math.round(player.pos.y);
    probe.near = it ? it.id : null;
  });

  // Scene-opening narration, once only.
  if (intro && !state.flags[introFlag]) {
    state.flags[introFlag] = true;
    dialogue.start(intro);
  }

  return { player, dialogue };
}

export { ui };
