// Dialogue box with player choices. Large high-contrast text.
//
// Keyboard:
//   E / Space / Enter   next line, or pick the highlighted choice
//   Up / Down (or W/S)  move the highlight
//   1 - 5               pick a choice directly
// Touch or mouse:
//   tap anywhere        next line
//   tap a choice        pick it
//
// Nothing is highlighted when a choice list opens, so pressing E quickly
// through the lines can never pick a choice by accident. For the same reason
// a tap on a choice only counts after a short pause in tapping: someone
// tapping steadily through the lines cannot pick whatever appears under
// their finger.
//
// Every line goes through the checker pass (fill tokens from the fact sheet,
// then reject any number the current beat is not allowed to show).

import { fill, badNumbers, allowedInBeat } from "./facts.js";
import { state, applyChoice, settle } from "./beats.js";
import { NODES } from "./script.js";
import { pick, BANK } from "./lines.js";
import { touch } from "./touch.js";

const CREAM = [245, 232, 200];
const GOLD = [255, 205, 80];
const DIM = [170, 160, 140];
const MAX_CHOICES = 5;
const BOX = { x: 20, w: 920, bottom: 530, lineH: 196 };
const ROW = { x: 36, w: 888, h: 38, step: 44, top: 44 };
const TAP_PAUSE = 800; // milliseconds without a tap before a choice tap counts

// What the box is showing right now. Also read by the play-test.
export const ui = { active: false, mode: "idle", node: null, speaker: "", text: "", choices: [], rects: [], selected: -1, page: false };

export function createDialogue(k, onChange) {
  const f = (z) => [k.fixed(), k.z(z)];
  const box = k.add([k.rect(BOX.w, BOX.lineH, { radius: 8 }), k.pos(BOX.x, BOX.bottom - BOX.lineH), k.color(16, 12, 8), k.outline(4, k.rgb(...CREAM)), ...f(1000)]);
  const nameT = k.add([k.text("", { size: 22 }), k.pos(42, 346), k.color(...GOLD), ...f(1002)]);
  const bodyT = k.add([k.text("", { size: 22, width: 876, lineSpacing: 8 }), k.pos(42, 380), k.color(...CREAM), ...f(1002)]);
  const hintT = k.add([k.text("", { size: 16 }), k.pos(922, 522), k.anchor("botright"), k.color(...DIM), ...f(1002)]);
  const rows = [];
  for (let i = 0; i < MAX_CHOICES; i++) {
    rows.push({
      bg: k.add([k.rect(ROW.w, ROW.h, { radius: 6 }), k.pos(ROW.x, 0), k.color(44, 32, 18), ...f(1001)]),
      t: k.add([k.text("", { size: 21 }), k.pos(ROW.x + 12, 0), k.color(...CREAM), ...f(1002)]),
    });
  }
  const pageS = k.add([k.sprite("ledgerPageBig"), k.pos(480, 180), k.anchor("center"), ...f(999)]);
  const pageC = k.add([k.sprite("ledgerPageCounted"), k.pos(480, 180), k.anchor("center"), ...f(999)]);

  let node = null;
  let lines = [];
  let idx = 0;
  let choices = [];
  let lastTap = 0;  // clock time of the last tap, counted or not
  let shownAt = 0;  // clock time the choice list appeared
  let nudge = false;

  // Checker pass. Returns text that is safe to show in this node's beat.
  function checked(raw, fallback) {
    const text = fill(raw);
    const bad = badNumbers(text, allowedInBeat(node.beat));
    if (bad.length) {
      state.factViolations.push({ text, bad, beat: node.beat });
      console.error("Fact-sheet violation, line replaced:", text, bad);
      return fallback;
    }
    return text;
  }

  function render() {
    const on = ui.active;
    const choosing = on && ui.mode === "choice";
    const n = choosing ? ui.choices.length : 0;
    const boxH = choosing ? ROW.top + n * ROW.step + 30 : BOX.lineH;
    const top = BOX.bottom - boxH;
    box.height = boxH;
    box.pos.y = top;
    nameT.pos.y = top + 12;
    box.hidden = nameT.hidden = hintT.hidden = !on;
    bodyT.hidden = !(on && ui.mode === "line");
    pageS.hidden = !(on && ui.page === true);
    pageC.hidden = !(on && ui.page === "counted");
    ui.rects = [];
    rows.forEach((r, i) => {
      const show = i < n;
      r.bg.hidden = r.t.hidden = !show;
      if (!show) return;
      const y = top + ROW.top + i * ROW.step;
      const sel = i === ui.selected;
      r.bg.pos.y = y;
      r.bg.color = sel ? k.rgb(110, 76, 20) : k.rgb(44, 32, 18);
      r.t.pos.y = y + 9;
      r.t.text = `${sel ? ">" : " "} ${i + 1}. ${ui.choices[i]}`;
      r.t.color = k.rgb(...(sel ? GOLD : CREAM));
      ui.rects.push({ x: ROW.x, y, w: ROW.w, h: ROW.h });
    });
    if (!on) return;
    if (ui.mode === "line") {
      nameT.text = ui.speaker || "";
      bodyT.text = ui.text;
      hintT.text = touch.enabled ? "Tap, or press E: continue" : "E or Space: continue";
    } else {
      nameT.text = "What do you do?";
      hintT.text = nudge ? "Choose first: Up/Down, a number, or tap" : touch.enabled ? "Tap a choice, or press its number" : "Up/Down then E, or press the number";
      hintT.color = k.rgb(...(nudge ? GOLD : DIM));
    }
    if (ui.mode === "line") hintT.color = k.rgb(...DIM);
  }

  // Tell the scene at once when the box opens or closes (it shows and hides
  // the on-screen buttons), rather than waiting for the next frame.
  function changed() {
    render();
    onChange?.(ui.active);
  }

  function showLine() {
    const line = lines[idx];
    ui.mode = "line";
    ui.speaker = line.who;
    ui.text = checked(line.bank ? pick(line.bank, state.bankIdx) : line.text, BANK.narrator.idle[0]);
    ui.page = line.page || false;
    ui.choices = [];
    ui.selected = -1;
    render();
  }

  function showChoices() {
    if (!choices.length) return close();
    ui.mode = "choice";
    ui.choices = choices.map((c) => checked(c.text, "..."));
    ui.selected = -1; // nothing highlighted until the player moves or picks
    ui.page = false;
    nudge = false;
    shownAt = performance.now();
    render();
  }

  function close() {
    ui.active = false;
    ui.mode = "idle";
    ui.node = null;
    ui.choices = [];
    ui.selected = -1;
    ui.page = false;
    node = null;
    settle(); // a waiting beat change lands only now, after the last line
    changed();
  }

  function start(nodeId) {
    const next = NODES[nodeId];
    if (!next) throw new Error(`No dialogue node "${nodeId}"`);
    // Beat gate: a node only runs inside its own beat.
    if (next.beat !== state.beat) throw new Error(`Node "${nodeId}" is beat ${next.beat}, story is in beat ${state.beat}`);
    node = next;
    ui.active = true;
    ui.node = nodeId;
    lines = node.lines.filter((l) => !l.when || l.when(state));
    choices = node.choices.filter((c) => !c.when || c.when(state)).slice(0, MAX_CHOICES);
    if (node.flag) state.flags[node.flag] = true;
    idx = 0;
    if (lines.length) showLine();
    else showChoices();
    onChange?.(ui.active);
  }

  function choose(i) {
    const c = choices[i];
    if (!c || ui.mode !== "choice") return;
    applyChoice(c); // the one and only place the story can move
    if (c.scene) {
      close();
      k.go(c.scene);
    } else if (c.goto) {
      start(c.goto);
    } else {
      close();
    }
  }

  // E / Space / Enter.
  function confirm() {
    if (!ui.active) return;
    if (ui.mode === "line") {
      idx++;
      if (idx < lines.length) showLine();
      else showChoices();
    } else if (ui.mode === "choice") {
      if (ui.selected >= 0) return choose(ui.selected);
      nudge = true;
      render();
    }
  }

  function move(d) {
    if (ui.mode !== "choice") return;
    const n = ui.choices.length;
    ui.selected = ui.selected < 0 ? (d > 0 ? 0 : n - 1) : (ui.selected + d + n) % n;
    render();
  }

  // Tap or click, at a point in game coordinates.
  function tap(p) {
    const now = performance.now();
    const sinceTap = now - lastTap;
    lastTap = now;
    if (!ui.active) return;
    if (ui.mode === "line") return confirm();
    if (sinceTap < TAP_PAUSE || now - shownAt < TAP_PAUSE) return;
    const i = ui.rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 3 && p.y <= r.y + r.h + 3);
    if (i >= 0) choose(i);
  }

  k.onKeyPress(["up", "w"], () => move(-1));
  k.onKeyPress(["down", "s"], () => move(1));
  for (let n = 1; n <= MAX_CHOICES; n++) {
    k.onKeyPress(String(n), () => choose(n - 1));
  }
  k.onMousePress(() => tap(k.mousePos()));

  ui.active = false;
  ui.mode = "idle";
  render();
  return { start, confirm, isActive: () => ui.active };
}
