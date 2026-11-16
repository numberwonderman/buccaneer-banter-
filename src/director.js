// The orchestrator ("director"). It sits above the NPCs and holds three things:
//   1. the beat list            (beats.js)
//   2. the ledger fact sheet    (facts.js)
//   3. each NPC's role card     (roles.js)
//
// Before any NPC line is shown, review() checks it against all three. For a
// generated line the director then follows one fixed routine:
//   ask the LLM once -> check -> if it breaks a rule, ask once more ->
//   check -> if it still breaks a rule, show the hard-coded fallback line.
// A failed call, a missing key, or a spent session cap also ends in the
// hard-coded line. Nothing here can show an error to the player, change the
// beat, or change game state: a generated reply is only ever (a) text that
// passed the checks and (b) one action picked from the NPC's fixed list.
//
// review() is a pure function with no browser code, so the tests run it in Node.

import { FACTS, badNumbers, allowedInBeat, allNumbers, REVEAL_BEAT } from "./facts.js";
import { BEATS, LAST_BEAT } from "./beats.js";
import { ROLE_CARDS, LINE_KINDS, ACTIONS, PAGE_OUT_BEAT, allowedActions, goalFor } from "./roles.js";

// ---------- The cap ----------
export const MAX_CALLS_PER_SESSION = 20; // every LLM call counts, including a regeneration
export const MAX_REGENERATIONS = 1;      // so one NPC line costs 1 call, or 2 if the first was rejected
export const LINE_DEADLINE_MS = 9000;    // longest the player waits for one line before the fallback
export const CALL_TIMEOUT_MS = 6000;
export const MAX_LINE_CHARS = 200;

// ---------- Reading numbers out of a line ----------

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMWORD = [...Object.keys(UNITS), ...Object.keys(TENS), "hundred", "thousand", "dozen"].join("|");
const WORD_RUN = new RegExp(`\\b(?:an?\\s+(?=hundred|thousand|dozen))?(?:${NUMWORD})(?:(?:\\s+and\\s+|[\\s-]+)(?:${NUMWORD}))*\\b`, "gi");
const LEDGER_NOUN_NEXT = /^\s+(?:\w+\s+)?(?:barrels?|casks?|kegs?|hogsheads?|pieces?|coins?|short|missing)\b/i;

function wordValue(run) {
  let total = 0;
  let cur = 0;
  for (const t of run.toLowerCase().split(/[\s-]+/)) {
    if (t === "and") continue;
    if (t === "a" || t === "an") cur = 1;
    else if (t in UNITS) cur += UNITS[t];
    else if (t in TENS) cur += TENS[t];
    else if (t === "hundred") cur = (cur || 1) * 100;
    else if (t === "dozen") cur = (cur || 1) * 12;
    else if (t === "thousand") { total += (cur || 1) * 1000; cur = 0; }
  }
  return total + cur;
}

// "pieces of eight" is the name of a coin, not a number. Blank it (same length,
// so positions still line up) before looking for spelled-out numbers.
const blankCoinName = (s) => s.replace(/\bpieces? of eight\b/gi, (m) => m.replace(/eight/i, "_____"));

// Every number in a sentence, written as digits or as words.
// Small spelled-out numbers ("three men", "two cups") are ordinary speech and
// are only counted when they are followed by a ledger word ("ten barrels").
export function numbersIn(sentence) {
  const out = [];
  for (const m of sentence.matchAll(/\d[\d,]*/g)) {
    out.push({ value: Number(m[0].replace(/,/g, "")), at: m.index, raw: m[0] });
  }
  for (const m of blankCoinName(sentence).matchAll(WORD_RUN)) {
    const value = wordValue(m[0]);
    const after = sentence.slice(m.index + m[0].length);
    if (value > 10 || LEDGER_NOUN_NEXT.test(after)) out.push({ value, at: m.index, raw: m[0] });
  }
  return out;
}

const ITEM_WORDS = [
  ["rum", /\b(?:rum|barrels?|casks?|kegs?)\b/gi],
  ["sugar", /\b(?:sugar|hogsheads?)\b/gi],
  ["silver", /\b(?:silver|pieces of eight|pieces|coins?)\b/gi],
];

function nearestItem(sentence, at) {
  let best = null;
  let bestD = Infinity;
  for (const [item, re] of ITEM_WORDS) {
    for (const m of sentence.matchAll(re)) {
      const d = Math.abs(m.index - at);
      if (d < bestD) { best = item; bestD = d; }
    }
  }
  return best;
}

const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

// True if the pattern matches somewhere that is not negated earlier in the
// same sentence ("I don't know you" is not an admission).
const NEGATION = /\b(?:not|never|no|nor|neither|don't|do not|didn't|did not|can't|cannot|couldn't|won't|wouldn't|ain't|isn't|wasn't|nobody|none)\b[^.!?]*$/i;
function says(text, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) {
    if (!NEGATION.test(text.slice(0, m.index))) return m[0];
  }
  return null;
}

// ---------- The three checks ----------

// 1. Fact sheet.
function checkFacts({ npc, beat, text, paid }) {
  const why = [];
  const allowed = allowedInBeat(beat);
  const card = ROLE_CARDS[npc];

  const bad = badNumbers(text, allowed);
  if (bad.length) why.push(`says ${bad.join(", ")}, which the fact sheet does not allow in beat ${beat}`);

  for (const s of sentences(text)) {
    const nums = numbersIn(s);
    for (const n of nums) {
      if (!allowed.has(n.value)) {
        if (!bad.includes(n.raw)) why.push(`says "${n.raw}", which the fact sheet does not allow in beat ${beat}`);
        continue;
      }
      const item = nearestItem(s, n.at);
      if (item) {
        const f = FACTS[item];
        if (![f.recorded, f.counted, f.missing].includes(n.value)) why.push(`puts ${n.raw} next to ${item}, which is not what the fact sheet says`);
      }
    }
    // A written figure passed off as the count, or a wrong shortfall.
    if (nums.length === 1 && allowed.has(nums[0].value) && !/\b(?:written|wrote|says|said|page|recorded|foot)\b/i.test(s)) {
      const v = nums[0].value;
      const item = nearestItem(s, nums[0].at);
      const rows = item ? [FACTS[item]] : [FACTS.rum, FACTS.sugar, FACTS.silver];
      if (/\b(?:counted|in the hold)\b/i.test(s) && !rows.some((f) => f.counted === v)) why.push(`gives ${nums[0].raw} as a counted figure, which is not what the fact sheet says`);
      if (/\b(?:short|missing|gone)\b/i.test(s) && !/\bcounted\b/i.test(s) && !rows.some((f) => f.missing === v && v > 0)) why.push(`gives ${nums[0].raw} as a shortfall, which is not what the fact sheet says`);
    }
  }

  // The sugar matches. Nobody may say it is short.
  if (/\bsugar\b|\bhogsheads?\b/i.test(text)) {
    for (const s of sentences(text)) {
      if (/\bsugar\b|\bhogsheads?\b/i.test(s) && says(s, /\b(?:short|missing|stolen|gone|light)\b/i) && !/\b(?:rum|silver|barrels?|pieces)\b/i.test(s)) {
        why.push("says the sugar is short; the fact sheet says the sugar matches");
      }
    }
  }

  // Only the bo'sun can read the page, so nobody else may quote a ledger figure.
  // One exception, straight from the role card: the rogue naming his own cut
  // once he has been paid for it with the page.
  if (!card.canReadPage) {
    const all = allNumbers();
    const quoted = sentences(text).flatMap(numbersIn).filter((n) => all.has(n.value) || n.value > 10);
    const excused = npc === "rogue" && paid && quoted.every((n) => n.value === FACTS.secret.amount);
    if (quoted.length && !excused) why.push(`quotes a ledger figure (${quoted.map((n) => n.raw).join(", ")}); only the bo'sun can read the page`);
  }
  return why;
}

// 2. Role card.
const ROLE_RULES = {
  bartender: [
    [/\bI (?:do |did |still )?(?:know|knew|remember|recogni[sz]ed?) (?:you(?!')|your face|that face|him)\b/i, "admits he knows the main character"],
    [/\bwelcome back\b|\bgood to see you\b|\bold friend\b|\b(?:your|the) usual\b/i, "greets the main character as someone he knows"],
    [/\blong time\b|\bit(?:'s| has) been (?:a while|years|too long|an age)\b|\bafter all (?:this time|these years)\b/i, "talks as if he has met the main character before"],
    [/\bthought you (?:were|was|had|'d)\b|\bback from the dead\b|\byou(?:'ve| have) (?:come back|been here before|returned)\b/i, "talks as if he has met the main character before"],
    [/\blast time (?:you|I saw you|we)\b|\byou used to\b|\bseen (?:you|your face|that face) before\b|\byou always\b/i, "talks about the main character's past"],
    [/\bcaptain\b|\bcap'n\b/i, "gives the main character a rank"],
  ],
  rogue: [
    // Everything in this list is lifted once he has been paid with the page.
    [/\bmy (?:cut|share|take|silver|pieces|coin)\b/i, "gives up his secret"],
    [/\bI (?:took|stole|lifted|pocketed|skimmed|kept|hid|have|hold|am holding|'m holding) (?:it|them|the silver|the pieces|the coin|the money|a cut|my|what)\b/i, "gives up his secret"],
    [/\bit was me\b|\bI(?:'m| am) (?:the|your) (?:thief|man)\b|\b(?:silver|pieces|coins?|money) (?:is|are|was|were) mine\b/i, "gives up his secret"],
    [/\bsilver\b|\bpieces of eight\b/i, "gives up his secret: names what he is hiding"],
  ],
  bosun: [
    [/\bthe rogue (?:took|stole|has|did|kept)\b|\bit was (?:the rogue|him|you|the bartender)\b|\b(?:he|you|the rogue|the bartender) (?:is|are) the thief\b/i, "names who took it; a ledger only says what is gone"],
  ],
};
const NOT_READER_RULES = [
  [/\b(?:the page|the ledger|it) (?:says|reads|shows|tells)\b/i, "says what is written on the page; only the bo'sun can read it"],
  [/\bI (?:can |could |did |have )?read (?:it|the page|that|them)\b/i, "claims to read the page; only the bo'sun can read it"],
];
const IDENTITY_RULES = [
  [/\byour name(?:'s| is| was)\b|\byou(?:'re| are| were) called\b|\bthey called you\b/i, "tells the main character his name"],
  [/\byou(?:'re| are| were) (?:the|our|my|his|her) (?:captain|mate|purser|clerk|quartermaster|gunner|cook|thief|man who)\b/i, "tells the main character who he was"],
];

function checkRole({ npc, text, paid }) {
  const why = [];
  const card = ROLE_CARDS[npc];
  // "Never gives up the secret for free": once paid with the page, he may.
  const own = npc === "rogue" && paid ? [] : ROLE_RULES[npc] || [];
  const rules = [...own, ...(card.canReadPage ? [] : NOT_READER_RULES), ...IDENTITY_RULES];
  for (const [re, what] of rules) {
    const m = says(text, re);
    if (m) why.push(`${card.speaker} ${what} ("${m}")`);
  }
  return why;
}

// 3. Current beat.
const BEAT_RULES = [
  // [applies while beat < n, who (null = everyone), pattern, what]
  [PAGE_OUT_BEAT, null, /\b(?:page|torn|ledger)\b/i, "talks about the page before it has come out (beat 3)"],
  [4, "rogue", /\b(?:deal|bargain|bring (?:it|the page|that)|give (?:it|the page|that) to me|hand (?:it|the page) over)\b/i, "makes his offer before the rogue's game (beat 4)"],
  [REVEAL_BEAT, null, /\b(?:missing|short|shortfall|stolen|stole|theft|thief|thieves|counted|miscount\w*)\b/i, `talks about the count or the shortfall before the bo'sun reads (beat ${REVEAL_BEAT})`],
];

function checkBeat({ npc, beat, text, kind, action, source, currentBeat }) {
  const why = [];
  if (!(beat >= 1 && beat <= LAST_BEAT) || !BEATS[beat - 1]) why.push(`beat ${beat} is not on the beat list`);
  if (currentBeat != null && beat !== currentBeat) why.push(`line was written for beat ${beat} but the story is in beat ${currentBeat}`);
  if (!goalFor(npc, beat)) why.push(`${ROLE_CARDS[npc].speaker} has no part in beat ${beat}`);
  for (const [before, who, re, what] of BEAT_RULES) {
    if (beat >= before || (who && who !== npc)) continue;
    const m = says(text, re);
    if (m) why.push(`${what} ("${m}")`);
  }
  if (source === "llm") {
    if (!LINE_KINDS[kind] || LINE_KINDS[kind].npc !== npc) why.push(`"${kind}" is not a line ${ROLE_CARDS[npc].speaker} can be asked for`);
    else if (!ACTIONS.includes(action) || !allowedActions(kind, beat).includes(action)) why.push(`action "${action}" is not on ${ROLE_CARDS[npc].speaker}'s action list for this moment`);
  }
  return why;
}

// Shape of a generated line: short, plain text, in the world, one speaker.
function checkForm(text) {
  const why = [];
  if (!text) why.push("line is empty");
  if (text.length > MAX_LINE_CHARS) why.push(`line is ${text.length} characters; the limit is ${MAX_LINE_CHARS}`);
  if (/[\[\]{}<>*_#|\\`\n\r]/.test(text)) why.push("line contains brackets, markup or line breaks");
  if (/[^\x20-\x7E]/.test(text)) why.push("line contains characters the game font cannot show");
  if (/\b(?:AI|LLM|NPC|OK)\b/.test(text) || /\b(?:language model|assistant|chatbot|prompt|video game|the player|okay|computer|internet)\b/i.test(text)) why.push("line steps outside the world of the game");
  if (/^(?:you|stranger|bartender|rogue|bo'?sun|narrator)\s*:/i.test(text)) why.push("line speaks for someone else or carries a speaker label");
  return why;
}

// Tidy what the LLM sent before checking it: plain quotes and dashes, one line.
export function normalize(raw) {
  let t = String(raw ?? "");
  t = t.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, " - ").replace(/…/g, "...");
  t = t.replace(/\s+/g, " ").trim();
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) t = t.slice(1, -1).trim();
  return t;
}

// The checker pass. Returns { ok, reasons } where each reason says which of
// the three it broke: "fact", "role", "beat" (or "form" for a malformed line).
//   line = { npc, beat, text, source: "script" | "llm", kind, action, paid, currentBeat }
export function review(line) {
  const reasons = [];
  if (!ROLE_CARDS[line.npc]) return { ok: false, reasons: [{ rule: "role", why: `no role card for "${line.npc}"` }] };
  const add = (rule, list) => list.forEach((why) => reasons.push({ rule, why }));
  if (line.source === "llm") add("form", checkForm(line.text));
  add("fact", checkFacts(line));
  add("role", checkRole(line));
  add("beat", checkBeat(line));
  return { ok: reasons.length === 0, reasons };
}

// The rogue names his cut only when he has been paid for it with the page:
// the player has chosen to trust him and the game is ending.
export function roguePaid(state) {
  return state.vars.trust === "rogue" && (state.ended || state.pending?.to === "end");
}

// ---------- The director at run time ----------

export function createDirector({ state, llm }) {
  const stats = {
    cap: MAX_CALLS_PER_SESSION,
    calls: 0,          // LLM calls made this session
    shown: { llm: 0, fallback: 0 },
    regenerated: 0,
    rejected: [],      // { npc, kind, beat, text, reasons } for every line that failed the checks
    actions: [],       // { npc, beat, action } for every generated line that was shown
    log: [],           // one entry per line the director was asked for
  };
  const memory = []; // short memory: the last few lines shown, and what the player last chose

  function live() {
    return !!(llm && llm.enabled) && !state.ended && stats.calls < stats.cap;
  }

  // Check a hard-coded line. Used for every scripted and fallback NPC line.
  function checkScripted({ npc, beat, text }) {
    const r = review({ npc, beat, text, source: "script", paid: roguePaid(state), currentBeat: state.beat });
    if (!r.ok) stats.rejected.push({ npc, kind: "script", beat, text, reasons: r.reasons });
    return r;
  }

  function remember(speaker, text) {
    memory.push({ speaker: speaker || "Narrator", text: String(text).slice(0, MAX_LINE_CHARS) });
    while (memory.length > 4) memory.shift();
  }

  // Ask for one in-the-moment NPC line. Always resolves; never throws.
  // Resolves to { text, source: "llm" | "fallback", action }.
  async function line({ npc, kind, beat, fallback, player }) {
    const entry = { npc, kind, beat, calls: 0, outcome: "fallback", why: null };
    stats.log.push(entry);
    const useFallback = (why) => {
      entry.why = why;
      stats.shown.fallback++;
      return { text: fallback, source: "fallback", action: null };
    };
    if (!llm || !llm.enabled) return useFallback("LLM layer is off");
    if (state.ended) return useFallback("game has ended");
    if (!LINE_KINDS[kind] || LINE_KINDS[kind].npc !== npc) return useFallback("not a generated line");

    const started = Date.now();
    let reasons = null;
    for (let attempt = 1; attempt <= 1 + MAX_REGENERATIONS; attempt++) {
      if (stats.calls >= stats.cap) return useFallback("session cap reached");
      const left = LINE_DEADLINE_MS - (Date.now() - started);
      if (left < 1500) return useFallback("out of time");
      stats.calls++;
      entry.calls++;
      let reply;
      try {
        reply = await llm.request(
          { npc, kind, beat, attempt, player: player || "", recent: memory.slice(), reasons: reasons ? reasons.map((r) => r.why) : [] },
          Math.min(CALL_TIMEOUT_MS, left),
        );
      } catch (e) {
        if (e && e.capReached) stats.calls = stats.cap; // the server's count is the one that matters
        return useFallback("call failed"); // a failed call is not retried
      }
      const text = normalize(reply?.line);
      const action = String(reply?.action ?? "").trim().toLowerCase();
      const r = review({ npc, kind, beat, text, action, source: "llm", paid: false, currentBeat: state.beat });
      if (r.ok) {
        entry.outcome = "llm";
        stats.shown.llm++;
        stats.actions.push({ npc, beat, action });
        return { text, source: "llm", action };
      }
      stats.rejected.push({ npc, kind, beat, text, reasons: r.reasons });
      reasons = r.reasons;
      if (attempt <= MAX_REGENERATIONS) stats.regenerated++;
    }
    return useFallback("failed the checks twice");
  }

  return { stats, live, line, checkScripted, remember, goalFor };
}
