// Run setup: rolled ONCE when the game starts, then frozen for the whole run.
// This is where "no two players get the same game" will come from. Right now
// the table holds one secret, so every roll lands on it. Add entries here
// (with matching fact-sheet rows and lines) to make runs differ.

import { FACTS } from "./facts.js";

export const ROGUE_SECRETS = Object.freeze([
  Object.freeze({
    id: "silverCut",
    item: "silver",
    amount: FACTS.secret.amount,
    summary: "The missing pieces of eight are the rogue's cut.",
  }),
]);

// Small seeded random number generator, so a run can be replayed with ?seed=7
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollSetup(seed) {
  const rnd = mulberry32(seed);
  const rogueSecret = ROGUE_SECRETS[Math.floor(rnd() * ROGUE_SECRETS.length)];
  return Object.freeze({ seed, rogueSecret });
}
