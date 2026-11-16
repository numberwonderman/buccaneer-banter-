// Checks the orchestrator without a browser and without any real LLM call.
// Run:  node test/check-director.mjs
//
// 1. Every hard-coded NPC line passes the orchestrator in its own beat.
// 2. A table of bad lines is rejected, each for the right reason.
// 3. A table of ordinary lines is let through.
// 4. The run-time routine: check, regenerate once, fall back; the session cap;
//    failed calls; no key. Uses a scripted stand-in for the LLM.
// 5. The briefs sent to the LLM never contain what the NPC must not know.
// 6. No API key is written anywhere in the project.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fill } from "../src/facts.js";
import { BANK } from "../src/lines.js";
import { NODES } from "../src/script.js";
import { state, applyChoice, settle, freezeSetup, BEATS, LAST_BEAT } from "../src/beats.js";
import { rollSetup } from "../src/setup.js";
import { ROLE_CARDS, LINE_KINDS, NPC_BY_SPEAKER, ACTIONS, allowedActions, goalFor } from "../src/roles.js";
import { review, normalize, numbersIn, createDirector, MAX_CALLS_PER_SESSION, MAX_REGENERATIONS } from "../src/director.js";
import { buildPrompt } from "../src/prompt.js";

let failed = 0;
const fail = (msg) => { failed++; console.log("FAIL  " + msg); };
const ok = (msg) => console.log("ok    " + msg);
const why = (r) => r.reasons.map((x) => `${x.rule}: ${x.why}`).join(" | ");

// ---------- 1. Hard-coded lines ----------
let n = 0;
for (const [id, node] of Object.entries(NODES)) {
  for (const l of node.lines) {
    const npc = NPC_BY_SPEAKER[l.who];
    if (!npc) continue;
    const texts = l.bank ? [].concat(BANK[l.bank.split(".")[0]][l.bank.split(".")[1]]) : [fill(l.text)];
    for (const text of texts) {
      n++;
      const paid = id === "ending" && npc === "rogue";
      const r = review({ npc, beat: node.beat, text, source: "script", paid });
      if (!r.ok) fail(`node ${id} (beat ${node.beat}) ${l.who}: "${text}" -> ${why(r)}`);
    }
  }
}
ok(`${n} hard-coded NPC lines (script and fallback bank) pass the orchestrator in their own beats`);

const cut = fill(NODES.ending.lines.find((l) => l.text?.includes("My cut")).text);
if (review({ npc: "rogue", beat: 6, text: cut, source: "script", paid: false }).ok) fail("the rogue's cut line passed without payment");
if (!review({ npc: "rogue", beat: 6, text: cut, source: "script", paid: true }).ok) fail("the rogue's cut line was rejected even when paid");
ok("the rogue's own cut line is rejected for free and allowed only once he is paid with the page");

for (const [kind, k] of Object.entries(LINE_KINDS)) {
  const [who, bank] = kind.split(".");
  if (!Array.isArray(BANK[who]?.[bank])) fail(`line kind ${kind} has no fallback bank`);
  if (!ROLE_CARDS[k.npc]) fail(`line kind ${kind}: no role card`);
  for (const a of k.actions) {
    if (!ACTIONS.includes(a) || !ROLE_CARDS[k.npc].actions.includes(a)) fail(`line kind ${kind}: action "${a}" is not on ${k.npc}'s list`);
  }
}
for (const npc of Object.keys(ROLE_CARDS)) {
  for (let b = 2; b <= LAST_BEAT; b++) if (!goalFor(npc, b)) fail(`${npc} has no goal for beat ${b}`);
}
if (BEATS.length !== 6) fail("the orchestrator's beat list is not beats 1-6");
ok(`role cards: 3 NPCs, a goal for each in beats 2-6, ${Object.keys(LINE_KINDS).length} generated-line moments, each backed by a fallback bank`);

// ---------- 2. Lines that must be rejected ----------
const L = (npc, kind, beat, action, text) => ({ npc, kind, beat, action, text: normalize(text), source: "llm" });
const BAD = [
  // fact sheet
  ["fact", L("bosun", "bosun.greeting", 2, "deflect", "There are 650 pieces in that chest, and no more.")],
  ["fact", L("bosun", "bosun.greeting", 2, "deflect", "Six hundred and fifty pieces. I am counting.")],
  ["fact", L("bosun", "bosun.deflection", 2, "deflect", "Twenty-eight barrels, and I know every one.")],
  ["fact", L("bosun", "bosun.greeting", 2, "deflect", "A dozen barrels went somewhere. Not my affair.")],
  ["fact", L("bosun", "bosun.greeting", 5, "deflect", "I counted 700 pieces of eight.")],
  ["fact", L("bosun", "bosun.greeting", 5, "deflect", "The rum is 650 barrels by my tally.")],
  ["fact", L("bosun", "bosun.greeting", 5, "deflect", "I counted 800 pieces of eight in the hold.")],
  ["fact", L("bosun", "bosun.greeting", 5, "deflect", "There are 40 barrels missing.")],
  ["fact", L("bosun", "bosun.greeting", 5, "deflect", "The sugar is short as well.")],
  ["fact", L("bosun", "bosun.greeting", 5, "deflect", "The total was 1,240 pieces.")],
  ["fact", L("bartender", "bartender.greeting", 5, "pour a drink", "150 pieces of eight would buy this whole bar.")],
  ["fact", L("rogue", "rogue.secret", 4, "deflect", "A hundred and fifty reasons, friend.")],
  // role cards
  ["role", L("bartender", "bartender.deflection", 2, "deflect", "Aye, I know you. Sit down.")],
  ["role", L("bartender", "bartender.greeting", 2, "pour a drink", "Welcome back. Rum punch?")],
  ["role", L("bartender", "bartender.deflection", 3, "deflect", "I thought you were drowned, man.")],
  ["role", L("bartender", "bartender.deflection", 4, "deflect", "It has been a long time since you stood at this bar.")],
  ["role", L("bartender", "bartender.greeting", 2, "pour a drink", "The usual, is it?")],
  ["role", L("bartender", "bartender.deflection", 2, "deflect", "Drink up, captain.")],
  ["role", L("bartender", "bartender.deflection", 2, "deflect", "Your name is Tom Finch, and you owe me.")],
  ["role", L("bartender", "bartender.redirect", 5, "change the subject", "I can read it well enough. It says nothing good.")],
  ["role", L("rogue", "rogue.secret", 4, "deflect", "Because the silver is my cut, that is why.")],
  ["role", L("rogue", "rogue.secret", 4, "deflect", "I took it. Happy?")],
  ["role", L("rogue", "rogue.secret", 4, "deflect", "Because of the pieces of eight, fool.")],
  ["role", L("rogue", "rogue.deflection", 2, "deflect", "You were the purser. You were our clerk.")],
  ["role", L("bosun", "bosun.deflection", 5, "deflect", "The rogue took it. Plain as day.")],
  // current beat
  ["beat", L("bartender", "bartender.greeting", 2, "pour a drink", "Put that page away and drink.")],
  ["beat", L("rogue", "rogue.greeting", 2, "deflect", "Bring it to me and we have a deal.")],
  ["beat", L("bartender", "bartender.redirect", 3, "pour a drink", "Something gone missing, has it? Drink.")],
  ["beat", L("bosun", "bosun.greeting", 2, "deflect", "The rum is short. I am counting.")],
  ["beat", L("rogue", "rogue.secret", 4, "deflect", "Nothing was stolen, friend.")],
  ["beat", L("bartender", "bartender.greeting", 2, "ask about the page", "What have you there?")],
  ["beat", L("bartender", "bartender.greeting", 2, "go quiet", "Rum punch.")],
  ["beat", L("bartender", "bartender.greeting", 2, "open the cellar door", "Rum punch.")],
  ["beat", L("bartender", "bartender.greeting", 2, "advance the beat", "Rum punch.")],
  ["beat", L("bosun", "bartender.greeting", 2, "pour a drink", "Rum punch.")],
  ["beat", L("bartender", "bartender.greeting", 7, "pour a drink", "Rum punch.")],
  ["beat", { ...L("bartender", "bartender.greeting", 2, "pour a drink", "Rum punch."), currentBeat: 3 }],
  // form
  ["form", L("bartender", "bartender.greeting", 2, "pour a drink", "")],
  ["form", L("bartender", "bartender.greeting", 2, "pour a drink", "*wipes the bar* Rum punch?")],
  ["form", L("bartender", "bartender.greeting", 2, "pour a drink", "[smiles] Rum punch?")],
  ["form", L("bartender", "bartender.greeting", 2, "pour a drink", "As an AI I cannot pour drinks.")],
  ["form", L("bartender", "bartender.greeting", 2, "pour a drink", "You: I will have the punch.")],
  ["form", L("bartender", "bartender.greeting", 2, "pour a drink", "Rum punch. ".repeat(30))],
];
let wrongRule = 0;
for (const [rule, line] of BAD) {
  const r = review(line);
  if (r.ok) fail(`should be rejected (${rule}): ${line.npc} beat ${line.beat}: "${line.text.slice(0, 70)}"`);
  else if (!r.reasons.some((x) => x.rule === rule)) { wrongRule++; fail(`rejected, but not as a ${rule} problem: "${line.text.slice(0, 60)}" -> ${why(r)}`); }
}
const per = (rule) => BAD.filter(([r]) => r === rule).length;
ok(`${BAD.length} bad lines rejected: ${per("fact")} against the fact sheet, ${per("role")} against a role card, ${per("beat")} against the current beat or action list, ${per("form")} malformed`);

// ---------- 3. Lines that must be let through ----------
const GOOD = [
  L("bartender", "bartender.greeting", 2, "pour a drink", "Rum punch, or nothing. Those are the choices."),
  L("bartender", "bartender.deflection", 2, "deflect", "I don't know you, and I never forget a debt."),
  L("bartender", "bartender.deflection", 3, "deflect", "Never seen you before tonight. Drink?"),
  L("bartender", "bartender.deflection", 4, "change the subject", "Faces come and go. The tide brings three a day."),
  L("bartender", "bartender.redirect", 3, "cut someone off", "Enough. Whatever that is, it stays off my bar."),
  L("bartender", "bartender.redirect", 5, "pour a drink", "Cups, gentlemen. Fill them and breathe."),
  L("rogue", "rogue.greeting", 2, "go quiet", "Mm."),
  L("rogue", "rogue.deflection", 2, "deflect", "If we had met, one of us would remember. Seems neither does."),
  L("rogue", "rogue.secret", 4, "ask about the page", "Why does a man want paper? Ask me when it's in my hand."),
  L("rogue", "rogue.secret", 4, "deflect", "I like old ink. Call it a weakness."),
  L("bosun", "bosun.greeting", 2, "go quiet", "A moment. I'm at the foot of a column."),
  L("bosun", "bosun.deflection", 2, "deflect", "Faces are not in my books. Stores are."),
  L("bosun", "bosun.greeting", 5, "deflect", "I counted 650 pieces of eight. The page says 800."),
  L("bosun", "bosun.greeting", 5, "deflect", "Twelve barrels of rum short, and 150 pieces of eight missing."),
  L("bosun", "bosun.greeting", 5, "deflect", "Sixty hogsheads written and sixty counted. The sugar is not short."),
  L("bosun", "bosun.greeting", 6, "deflect", "A ledger says what is gone. It never says who has it."),
];
for (const line of GOOD) {
  const r = review(line);
  if (!r.ok) fail(`should pass: ${line.npc} beat ${line.beat}: "${line.text}" -> ${why(r)}`);
}
ok(`${GOOD.length} ordinary in-character lines pass, including the bo'sun's true figures from beat 5 on`);

const nums = (s) => numbersIn(s).map((x) => x.value).join(",");
if (nums("six hundred and fifty") !== "650" || nums("a hundred and fifty pieces") !== "150" || nums("twenty-eight") !== "28" || nums("three men") !== "" || nums("ten barrels") !== "10" || nums("150 pieces of eight") !== "150") {
  fail("spelled-out numbers are not read correctly");
} else ok("numbers are read in digits and in words (six hundred and fifty = 650); 'pieces of eight' is not counted as 8");

// ---------- 4. The run-time routine ----------
freezeSetup(rollSetup(1));
applyChoice({ text: "Go inside", advanceTo: 2 });
const snapshot = () => JSON.stringify({ beat: state.beat, ended: state.ended, flags: state.flags, vars: state.vars, history: state.history, pending: state.pending });

function fakeLLM(replies) {
  const sent = [];
  return {
    enabled: true,
    sent,
    async request(payload) {
      sent.push(payload);
      const r = replies.length ? replies.shift() : { action: "pour a drink", line: "Rum punch. It is that or seawater." };
      if (r instanceof Error) throw r;
      return r;
    },
  };
}
const ask = (d, over = {}) => d.line({ npc: "bartender", kind: "bartender.greeting", beat: 2, fallback: "FALLBACK", player: "Do you know me?", ...over });
const goodLine = { action: "pour a drink", line: "Rum punch. It is that or seawater." };
const badLine = { action: "pour a drink", line: "Welcome back. I know you." };
const before = snapshot();

{ // good first time: 1 call
  const llm = fakeLLM([goodLine]);
  const d = createDirector({ state, llm });
  const r = await ask(d);
  if (r.source !== "llm" || r.text !== goodLine.line || d.stats.calls !== 1 || llm.sent.length !== 1) fail("a good line was not shown after exactly one call");
  if (d.stats.actions.length !== 1 || d.stats.actions[0].action !== "pour a drink") fail("the chosen action was not recorded");
}
{ // bad, then good: regenerated once, 2 calls, second call is told why
  const llm = fakeLLM([badLine, goodLine]);
  const d = createDirector({ state, llm });
  const r = await ask(d);
  if (r.source !== "llm" || d.stats.calls !== 2 || d.stats.regenerated !== 1 || d.stats.rejected.length !== 1) fail("a rejected line was not regenerated exactly once");
  if (llm.sent[1].attempt !== 2 || !llm.sent[1].reasons.length) fail("the regeneration request did not say why the first line was rejected");
}
{ // bad twice: fallback after exactly 2 calls, never a third
  const llm = fakeLLM([badLine, { action: "pour a drink", line: "It says 650 pieces, friend." }, goodLine]);
  const d = createDirector({ state, llm });
  const r = await ask(d);
  if (r.source !== "fallback" || r.text !== "FALLBACK" || d.stats.calls !== 2 || llm.sent.length !== 2) fail("two rejected lines did not end in the fallback after exactly two calls");
  if (1 + MAX_REGENERATIONS !== 2) fail("regeneration count changed");
}
{ // failed call: fallback, no retry
  const llm = fakeLLM([new Error("network down"), goodLine]);
  const d = createDirector({ state, llm });
  const r = await ask(d);
  if (r.source !== "fallback" || d.stats.calls !== 1 || llm.sent.length !== 1) fail("a failed call was retried or did not fall back");
}
{ // garbage reply (no line, wrong shape): rejected like any bad line
  const llm = fakeLLM([{}, { action: 7, line: null }]);
  const d = createDirector({ state, llm });
  const r = await ask(d);
  if (r.source !== "fallback" || d.stats.calls !== 2) fail("a malformed reply was not handled");
}
{ // LLM layer off (no key): zero calls
  const llm = fakeLLM([goodLine]);
  llm.enabled = false;
  const d = createDirector({ state, llm });
  const r = await ask(d);
  if (r.source !== "fallback" || d.stats.calls !== 0 || llm.sent.length !== 0 || d.live()) fail("the LLM was called while switched off");
  const d2 = createDirector({ state, llm: null });
  if ((await ask(d2)).source !== "fallback") fail("no LLM object at all was not handled");
}
{ // the cap: all-good replies, then all-bad replies
  const llm = fakeLLM([]);
  const d = createDirector({ state, llm });
  let shown = 0;
  for (let i = 0; i < 30; i++) if ((await ask(d)).source === "llm") shown++;
  if (shown !== MAX_CALLS_PER_SESSION || d.stats.calls !== MAX_CALLS_PER_SESSION || llm.sent.length !== MAX_CALLS_PER_SESSION) fail(`cap: ${llm.sent.length} calls were made, expected ${MAX_CALLS_PER_SESSION}`);
  if (d.live()) fail("director still reports live after the cap");
  const llm2 = fakeLLM(Array.from({ length: 60 }, () => badLine));
  const d2 = createDirector({ state, llm: llm2 });
  for (let i = 0; i < 30; i++) if ((await ask(d2)).source !== "fallback") fail("a bad line was shown");
  if (llm2.sent.length !== MAX_CALLS_PER_SESSION) fail(`cap with regenerations: ${llm2.sent.length} calls were made, expected ${MAX_CALLS_PER_SESSION}`);
  // an odd number of calls left: the regeneration must not go over the cap
  const llm3 = fakeLLM([goodLine, ...Array.from({ length: 60 }, () => badLine)]);
  const d3 = createDirector({ state, llm: llm3 });
  for (let i = 0; i < 30; i++) await ask(d3);
  if (llm3.sent.length !== MAX_CALLS_PER_SESSION) fail(`cap with an odd count: ${llm3.sent.length} calls`);
}
{ // server says the cap is spent: the director stops asking
  const e = new Error("cap");
  e.capReached = true;
  const llm = fakeLLM([e]);
  const d = createDirector({ state, llm });
  await ask(d);
  await ask(d);
  if (llm.sent.length !== 1 || d.live()) fail("director kept calling after the server reported the cap");
}
{ // wrong NPC for the moment, or a moment that is not generated: no call
  const llm = fakeLLM([goodLine]);
  const d = createDirector({ state, llm });
  await ask(d, { npc: "rogue" });
  await ask(d, { kind: "narrator.idle" });
  if (llm.sent.length !== 0) fail("a call was made for a line that is not on the list");
}
{ // short memory holds four lines
  const llm = fakeLLM([goodLine]);
  const d = createDirector({ state, llm });
  for (let i = 0; i < 9; i++) d.remember("Bartender", "line " + i);
  await ask(d);
  if (llm.sent[0].recent.length !== 4 || llm.sent[0].recent[3].text !== "line 8") fail("short memory is not the last four lines");
}
if (snapshot() !== before) fail("the orchestrator changed the beat or the game state");
ok(`run time: good line = 1 call; rejected = regenerated once; rejected twice = fallback after 2 calls; failed call = fallback, no retry; off = 0 calls`);
ok(`cap: never more than ${MAX_CALLS_PER_SESSION} calls in a session (regenerations included), then fallback lines only`);
ok("none of it moved the beat or touched flags, answers or history");

// after the end the director asks for nothing
applyChoice({ text: "b", advanceTo: 3 }); applyChoice({ text: "c", advanceTo: 4 }); applyChoice({ text: "d", advanceTo: 5 }); applyChoice({ text: "e", advanceTo: 6 });
applyChoice({ text: "f", endGame: true, vars: { trust: "bosun", says: "theft" } }); settle();
{
  const llm = fakeLLM([goodLine]);
  const d = createDirector({ state, llm });
  if ((await ask(d, { beat: 6 })).source !== "fallback" || llm.sent.length !== 0) fail("the LLM was called after the game ended");
}
ok("after the ending no further LLM calls are made");

// ---------- 5. Briefs ----------
let briefs = 0;
for (const [kind, k] of Object.entries(LINE_KINDS)) {
  for (let beat = 2; beat <= LAST_BEAT; beat++) {
    briefs++;
    const p = buildPrompt({ npc: k.npc, kind, beat, player: "Do you know me?", recent: [{ speaker: "Narrator", text: "He says it to the mug." }], reasons: [] });
    const all = p.system + "\n" + p.user;
    const hasFigures = /\b(?:28|650|150|12)\b/.test(all);
    if (k.npc !== "bosun" && /\d{2,}/.test(p.system.replace(/at most 160 characters/, ""))) fail(`${kind} beat ${beat}: brief contains a number`);
    if (k.npc === "rogue" && /silver|pieces of eight|\bcut\b/i.test(p.system)) fail(`${kind} beat ${beat}: the rogue's brief contains his secret`);
    if (hasFigures !== (k.npc === "bosun" && beat >= 5)) fail(`${kind} beat ${beat}: counted figures ${hasFigures ? "present" : "absent"} in the brief`);
    for (const a of allowedActions(kind, beat)) if (!all.includes(`"${a}"`)) fail(`${kind} beat ${beat}: action ${a} not offered`);
    if (beat < 3 && all.includes('"ask about the page"')) fail(`${kind} beat ${beat}: "ask about the page" offered before the page is out`);
  }
}
ok(`${briefs} briefs built: the rogue's never holds his secret; counted figures go only to the bo'sun, only from beat 5`);

// ---------- 6. No key in the project ----------
const root = fileURLToPath(new URL("..", import.meta.url));
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules" || name === "screenshots" || name === "lib") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(root);
let keyHits = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  if (/sk-ant-[A-Za-z0-9_-]{8,}/.test(text) || /x-api-key["']?\s*[:=]\s*["'][^"']{8,}["']/i.test(text)) { keyHits++; fail(`possible API key written in ${f}`); }
}
const serve = readFileSync(join(root, "serve.js"), "utf8");
if (!/process\.env\.ANTHROPIC_API_KEY/.test(serve)) fail("serve.js does not read the key from the environment");
// Code that prints or answers must never use the KEY variable (text inside quotes does not count).
const codeOnly = (l) => l.replace(/"[^"]*"/g, "").replace(/`[^`]*`/g, (t) => (t.match(/\$\{[^}]*\}/g) || []).join(" "));
if (serve.split("\n").some((l) => /console\.|json\(res/.test(l) && /\bKEY\b/.test(codeOnly(l)))) fail("serve.js may print or send the key");
const usesOfKey = serve.split("\n").filter((l) => /\bKEY\b/.test(codeOnly(l)) && !/^const (KEY|HAS_KEY) =/.test(l.trim()));
if (usesOfKey.length !== 1 || !usesOfKey[0].includes('"x-api-key": KEY')) fail(`serve.js uses the key somewhere unexpected: ${usesOfKey.join(" / ")}`);
const browserFiles = files.filter((f) => f.includes(join("src", "")) && !f.endsWith("prompt.js"));
for (const f of browserFiles) if (/ANTHROPIC_API_KEY|x-api-key/i.test(readFileSync(f, "utf8"))) fail(`browser file ${f} mentions the key`);
const ignore = readFileSync(join(root, ".gitignore"), "utf8");
if (!/^\.env/m.test(ignore)) fail(".gitignore does not exclude .env files");
ok(`${files.length} project files scanned: no key written, the key is read only from the environment in serve.js, .env files are ignored by git`);

console.log(failed ? `\n${failed} problem(s) found.` : "\nAll orchestrator checks passed.");
process.exit(failed ? 1 : 0);
