// Checks every written line against the ledger fact sheet, the beat gate and
// the setup roll, without a browser.
// Run:  node test/check-lines.mjs

import { FACTS, fill, badNumbers, pageNumbers, allNumbers, allowedInBeat, REVEAL_BEAT } from "../src/facts.js";
import { BANK } from "../src/lines.js";
import { NODES, entryFor } from "../src/script.js";
import { state, applyChoice, settle, freezeSetup, LAST_BEAT, BEATS } from "../src/beats.js";
import { rollSetup, ROGUE_SECRETS } from "../src/setup.js";

let failed = 0;
const fail = (msg) => { failed++; console.log("FAIL  " + msg); };
const ok = (msg) => console.log("ok    " + msg);
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

// 1. The sheet: rum and sugar are separate items; the total is silver only.
const expect = { rum: [40, 28, 12], sugar: [60, 60, 0], silver: [800, 650, 150], total: [800, 650, 150] };
for (const [k, [r, c, m]] of Object.entries(expect)) {
  const f = FACTS[k];
  if (f.recorded !== r || f.counted !== c || f.missing !== m) fail(`fact sheet ${k} is not ${r} / ${c} / ${m}`);
  if (f.recorded - f.counted !== f.missing) fail(`fact sheet ${k}: recorded - counted != missing`);
}
for (const f of ["recorded", "counted", "missing"]) {
  if (FACTS.total[f] !== FACTS.silver[f]) fail(`total.${f} must equal silver.${f} (the total is silver only)`);
}
if (FACTS.secret.amount !== FACTS.silver.missing) fail("rogue's cut must equal the missing silver");
if (!Object.isFrozen(FACTS) || !Object.isFrozen(FACTS.rum)) fail("fact sheet is not frozen");
if (throws(() => { "use strict"; FACTS.silver.counted = 1; }) === false && FACTS.silver.counted !== 650) fail("fact sheet could be changed");
ok("fact sheet: rum 40/28/12, sugar 60/60, silver 800/650/150, total = silver only, frozen");

// 2. Bank lines: no digits, no brackets, no numbers at all (they can be said in any beat).
let count = 0;
for (const [who, kinds] of Object.entries(BANK)) {
  for (const [kind, v] of Object.entries(kinds)) {
    (Array.isArray(v) ? v : [v]).forEach((t, i) => {
      count++;
      const where = `bank ${who}.${kind}[${i}]`;
      if (/\d|\{/.test(t)) fail(`${where}: bank lines must not contain numbers: "${t}"`);
      if (/[\[\]]/.test(t)) fail(`${where}: square bracket in "${t}"`);
    });
  }
}

// 3. Script lines and choices: no hand-typed digits, every token resolves,
//    and each node only shows the numbers its beat allows. Beats 1-4 may show
//    only what is written on the page; counted figures start in beat 5.
const hidden = [...allNumbers()].filter((n) => !pageNumbers().has(n));
const firstSeen = {};
for (const [id, node] of Object.entries(NODES)) {
  const texts = [
    ...node.lines.filter((l) => l.text).map((l, i) => [`node ${id} line ${i}`, l.text]),
    ...node.choices.map((c, i) => [`node ${id} choice ${i}`, c.text]),
  ];
  for (const [where, raw] of texts) {
    count++;
    if (/\d/.test(raw)) fail(`${where}: hand-typed digit in "${raw}"`);
    if (/[\[\]]/.test(raw)) fail(`${where}: square bracket in "${raw}"`);
    let text;
    try { text = fill(raw); } catch (e) { fail(`${where}: ${e.message}`); continue; }
    const bad = badNumbers(text, allowedInBeat(node.beat));
    if (bad.length) fail(`${where} (beat ${node.beat}): number not allowed yet: ${bad.join(", ")} in "${text}"`);
    for (const n of hidden) {
      if (badNumbers(text, new Set([...allNumbers()].filter((x) => x !== n))).length) {
        firstSeen[n] = Math.min(firstSeen[n] ?? 99, node.beat);
      }
    }
  }
  for (const l of node.lines) {
    if (l.page === "counted" && node.beat < REVEAL_BEAT) fail(`node ${id}: counted page shown before beat ${REVEAL_BEAT}`);
  }
}
ok(`${count} lines and choices checked against the sheet, beat by beat`);
for (const n of hidden) {
  if (firstSeen[n] !== REVEAL_BEAT) fail(`counted figure ${n} first appears in beat ${firstSeen[n]}, expected ${REVEAL_BEAT}`);
}
ok(`counted figures ${hidden.join(", ")} appear nowhere before beat ${REVEAL_BEAT}, and all of them in beat ${REVEAL_BEAT}`);

// 4. Script structure.
const advancing = [];
for (const [id, node] of Object.entries(NODES)) {
  if (!(node.beat >= 1 && node.beat <= LAST_BEAT)) fail(`node ${id}: bad beat`);
  for (const l of node.lines) {
    if (l.bank) {
      const [w, kd] = l.bank.split(".");
      if (!BANK[w]?.[kd]) fail(`node ${id}: missing bank ${l.bank}`);
    }
  }
  for (const c of node.choices) {
    const moves = [c.advanceTo, c.advanceAfter, c.endGame].filter((v) => v != null).length;
    if (moves > 1) fail(`node ${id}: choice "${c.text}" moves the story two ways`);
    if (moves && !advancing.includes(`${node.beat}: ${c.text}`)) advancing.push(`${node.beat}: ${c.text}`);
    if (c.advanceTo != null && c.advanceTo !== node.beat + 1) fail(`node ${id}: illegal advanceTo ${c.advanceTo}`);
    if (c.advanceAfter != null && c.advanceAfter !== node.beat + 1) fail(`node ${id}: illegal advanceAfter ${c.advanceAfter}`);
    if (c.endGame && node.beat !== LAST_BEAT) fail(`node ${id}: endGame outside the last beat`);
    if (c.goto) {
      const target = NODES[c.goto];
      if (!target) { fail(`node ${id}: goto "${c.goto}" does not exist`); continue; }
      const want = c.advanceTo ?? node.beat;
      if (target.beat !== want) fail(`node ${id}: choice "${c.text}" jumps to a beat ${target.beat} node`);
    }
  }
}
for (let b = 1; b <= LAST_BEAT; b++) {
  if (!advancing.some((a) => a.startsWith(`${b}:`))) fail(`beat ${b} has no choice that moves the story on`);
}
if (BEATS.length !== LAST_BEAT) fail("beat list length");
ok(`all gotos and banks resolve; ${advancing.length} choices move the story:`);
advancing.forEach((a) => console.log(`        beat ${a}`));

// Every entry point exists, in every beat, for every character.
for (let b = 2; b <= LAST_BEAT; b++) {
  for (const who of ["bartender", "rogue", "bosun"]) {
    for (const s of [{ beat: b, ended: false, flags: {} }, { beat: b, ended: false, flags: { rogue4Met: true } }]) {
      const id = entryFor(who, s);
      if (!NODES[id]) fail(`entry for ${who} in beat ${b}: node "${id}" missing`);
      else if (NODES[id].beat !== b) fail(`entry for ${who} in beat ${b} is a beat ${NODES[id].beat} node`);
    }
  }
}
for (const who of ["bartender", "rogue", "bosun"]) {
  if (!NODES[entryFor(who, { beat: 6, ended: true, flags: {} })]) fail(`no after-the-end node for ${who}`);
}
ok("every character has a conversation in every tavern beat, and after the end");

// The ending says something for all nine answer pairs, and the rogue only
// names his cut when he is trusted (paid with the page).
const setup = rollSetup(1);
for (const trust of ["bosun", "rogue", "bartender"]) {
  for (const says of ["theft", "miscount", "nothing"]) {
    const s = { vars: { trust, says }, setup };
    const lines = NODES.ending.lines.filter((l) => !l.when || l.when(s));
    const text = lines.map((l) => (l.text ? fill(l.text) : "")).join(" ");
    if (lines.length < 6) fail(`ending ${trust}/${says}: only ${lines.length} lines`);
    if (text.includes("My cut") !== (trust === "rogue")) fail(`ending ${trust}/${says}: rogue's cut revealed wrongly`);
  }
}
ok("ending covers all 9 answer pairs; the rogue names his cut only when given the page");

// 5. Setup roll: always from the table, frozen, same seed = same roll, set once.
for (let seed = 1; seed <= 200; seed++) {
  const r = rollSetup(seed);
  if (!ROGUE_SECRETS.includes(r.rogueSecret) || !Object.isFrozen(r)) fail(`setup roll ${seed} is not a frozen table entry`);
  if (rollSetup(seed).rogueSecret !== r.rogueSecret) fail(`seed ${seed} does not replay`);
}
if (setup.rogueSecret.id !== "silverCut" || setup.rogueSecret.amount !== 150) fail("this run's secret must be the 150 missing pieces of silver");
freezeSetup(setup);
if (!throws(() => freezeSetup(rollSetup(2)))) fail("setup could be rolled a second time");
if (throws(() => { state.setup.rogueSecret = null; }) === false && state.setup.rogueSecret === null) fail("setup could be changed mid-run");
ok(`setup roll: ${ROGUE_SECRETS.length} secret in the table, rolled once, frozen; this run: ${setup.rogueSecret.id} (${setup.rogueSecret.amount})`);

// 6. Beat gate.
try { state.beat = 3; } catch {}
if (state.beat !== 1) fail("state.beat could be set directly");
if (!throws(() => applyChoice({ text: "skip", advanceTo: 3 })) || state.beat !== 1) fail("beat 1 -> 3 skip was allowed");
if (!throws(() => applyChoice({ text: "early end", endGame: true })) || state.ended) fail("game ended outside the last beat");
applyChoice({ text: "a", advanceTo: 2 });
applyChoice({ text: "b", advanceTo: 3 });
applyChoice({ text: "c", advanceAfter: 4 });
if (state.beat !== 3 || !state.pending) fail("advanceAfter changed the beat before the lines finished");
if (!throws(() => applyChoice({ text: "double", advanceTo: 4 }))) fail("a second advance was accepted while one was waiting");
settle();
if (state.beat !== 4 || state.pending) fail("settle() did not land the waiting beat change");
settle();
if (state.beat !== 4) fail("settle() with nothing waiting changed the beat");
applyChoice({ text: "d", advanceTo: 5 });
applyChoice({ text: "e", advanceTo: 6 });
if (!throws(() => applyChoice({ text: "f", advanceTo: 7 })) || state.beat !== 6) fail("advanced past beat 6");
applyChoice({ text: "g", endGame: true });
if (state.ended) fail("game ended before the ending lines finished");
settle();
if (!state.ended) fail("game did not end");
if (!throws(() => applyChoice({ text: "h", endGame: true }))) fail("game ended twice");
if (state.history.length !== 6) fail(`history has ${state.history.length} entries, expected 6`);
ok("beat gate: no direct set, no skipping, waiting changes land only on settle(), no beat 7, one ending");

console.log(failed ? `\n${failed} problem(s) found.` : "\nAll line checks passed.");
process.exit(failed ? 1 : 0);
