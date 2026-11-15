// Buccaneer Banter - playable spine, beats 1-6. Hard-coded: no LLM, no TTS.

import kaplay from "../lib/kaplay.mjs";
import { loadAllSprites } from "./sprites.js";
import { registerScenes } from "./scenes.js";
import { state, freezeSetup } from "./beats.js";
import { rollSetup } from "./setup.js";
import { initTouch, touch } from "./touch.js";
import { pageHolder } from "./world.js";
import { ui } from "./dialogue.js";
import { probe } from "./world.js";
import { W, H } from "./layout.js";

const k = kaplay({
  width: W,
  height: H,
  letterbox: true,
  background: [10, 8, 6],
  global: false,
  font: "monospace",
  // Draw at the screen's real resolution so text stays sharp on phones.
  pixelDensity: Math.min(window.devicePixelRatio || 1, 3),
});

// Roll the run's setup once, before anything else, and freeze it.
// ?seed=7 in the address replays the same roll.
const seedParam = Number(new URLSearchParams(location.search).get("seed"));
freezeSetup(rollSetup(Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Date.now()));

initTouch();
loadAllSprites(k);
registerScenes(k);

// Read-only window into the game, for the play-test and the console.
window.__bb = { state, ui, probe, touch, pageHolder, ready: false };

k.onLoad(() => {
  k.go("shore");
  window.__bb.ready = true;
});
