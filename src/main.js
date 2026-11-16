// Buccaneer Banter - beats 1-6. Hard-coded spine, with an optional LLM
// dialogue layer on top, run by the orchestrator (director.js). No TTS.
// Opens on a title screen, with a synthesised soundtrack (music.js).

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
import { director } from "./stage.js";
import { llm, initLLM } from "./llm.js";
import { initMusic, music } from "./music.js";

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
initMusic();
loadAllSprites(k);
registerScenes(k);

// Read-only window into the game, for the play-test and the console.
window.__bb = { state, ui, probe, touch, pageHolder, director: director.stats, llm, music, ready: false };

// Find out, in the background, whether a server with an API key is behind
// this page. The game does not wait for the answer: until it arrives, and
// whenever it is "no", every line is a hard-coded one.
initLLM().then(showDebug, showDebug);

// ?debug=1 in the address shows a small counter of LLM calls. For demos only.
function showDebug() {
  if (new URLSearchParams(location.search).get("debug") !== "1") return;
  const el = document.createElement("div");
  el.id = "bb-debug";
  el.style.cssText = "position:fixed;left:12px;top:72px;z-index:50;font:13px monospace;color:#f5e8c8;background:rgba(16,12,8,.85);padding:4px 8px;border-radius:4px;pointer-events:none";
  document.body.appendChild(el);
  setInterval(() => {
    const s = director.stats;
    el.textContent = `LLM ${llm.enabled ? "on" : "off"} | calls ${s.calls}/${s.cap} | generated ${s.shown.llm} | fallback ${s.shown.fallback} | rejected ${s.rejected.length}${ui.source ? " | this line: " + ui.source : ""}`;
  }, 250);
}

k.onLoad(() => {
  k.go("title");
  window.__bb.ready = true;
});
