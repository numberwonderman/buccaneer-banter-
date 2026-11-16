// Builds the brief the orchestrator gives the LLM for one NPC line.
// Used by the server (serve.js), never by the browser, so the browser cannot
// send its own instructions to the LLM: it can only name an NPC, a moment and
// a beat, and the server writes the brief from the role cards.
//
// An NPC is told only what it needs. The rogue's brief never contains his
// secret, and no brief contains a counted figure before the reveal beat, so
// the LLM cannot leak what it was never given.

import { FACTS, fmt, REVEAL_BEAT } from "./facts.js";
import { BEATS } from "./beats.js";
import { ROLE_CARDS, LINE_KINDS, allowedActions, goalFor } from "./roles.js";

export function buildPrompt({ npc, kind, beat, player, recent, reasons }) {
  const card = ROLE_CARDS[npc];
  const moment = LINE_KINDS[kind];
  const b = BEATS[beat - 1];
  const actions = allowedActions(kind, beat);

  const sys = [
    `You are voicing ${card.who}, in a text game set in a pirate-era tavern on Tortuga.`,
    `The player is a stranger who washed up on the beach with no memory and a torn ledger page.`,
    ``,
    `What you know: ${card.knows}`,
    `Your goal in this scene ("${b.name}"): ${goalFor(npc, beat)}`,
    ``,
    `Hard rules. Breaking any of them means your line is thrown away:`,
    ...card.never.map((n) => `- ${n}`),
    `- Do not move the story on, describe events, or speak for anyone else.`,
    `- No stage directions, no asterisks, no brackets, no quotation marks round the line.`,
    `- Plain letters and basic punctuation only. One or two short sentences, at most 160 characters.`,
  ];
  if (card.canReadPage && beat >= REVEAL_BEAT) {
    const row = (f) => `${f.label}: ${fmt(f.recorded)} written on the page, ${fmt(f.counted)} counted${f.missing ? `, ${fmt(f.missing)} missing` : ", it matches"}`;
    sys.push(``, `Fact sheet. These are the only figures you may ever say, and never altered:`, `- ${row(FACTS.rum)}`, `- ${row(FACTS.sugar)}`, `- ${row(FACTS.silver)}`);
  } else {
    sys.push(`- Do not say any number, in digits or in words.`);
  }
  sys.push(
    ``,
    `Pick exactly one action from this list and speak the line that goes with it: ${actions.map((a) => `"${a}"`).join(", ")}.`,
    `Answer with JSON only, in this exact shape: {"action": "<one action from the list>", "line": "<what you say>"}`,
  );

  const user = [];
  if (recent?.length) user.push(`Just said in the room:`, ...recent.map((r) => `${r.speaker}: ${r.text}`), ``);
  if (player) user.push(`The stranger just chose: ${player}`);
  user.push(moment.brief);
  if (reasons?.length) user.push(``, `Your last line was thrown away because it ${reasons.slice(0, 3).join("; ")}. Write a different line that keeps every rule.`);

  return { system: sys.join("\n"), user: user.join("\n") };
}
