// Beat gating. The beat number lives in a closure: the only way to change it
// is applyChoice(), which the dialogue box calls when the player picks a
// choice. Walking, talking and NPC lines cannot move the story on.
//
// A choice can move the story in three ways:
//   advanceTo: n     the beat changes at once (the next lines belong to beat n)
//   advanceAfter: n  the beat changes when the lines that follow have finished
//   endGame: true    the game ends when the lines that follow have finished
// The last two wait in "pending" until the dialogue box closes and calls
// settle(), so the banner never runs ahead of what is on screen.

export const BEATS = [
  { id: 1, name: "Wash up",           goal: "Walk right, up the beach, to the tavern door." },
  { id: 2, name: "Enter the tavern",  goal: "Talk to the bartender behind the bar." },
  { id: 3, name: "The page surfaces", goal: "Show the page to the bo'sun at the table by the barrels." },
  { id: 4, name: "The rogue's game",  goal: "Talk to the rogue in the left corner." },
  { id: 5, name: "The bo'sun reads",  goal: "Go to the bo'sun and ask him to read the page." },
  { id: 6, name: "The choice",        goal: "Talk to anyone, then decide who to trust." },
];
export const LAST_BEAT = 6;

let beat = 1;
let ended = false;
let pending = null;
let setup = null;

export const state = {
  get beat() { return beat; },
  get ended() { return ended; },
  get pending() { return pending ? { ...pending } : null; },
  get setup() { return setup; },
  flags: {},          // small yes/no memory, e.g. shoreIntroDone
  vars: {},           // the player's final answers: trust, says
  bankIdx: {},        // which fallback line comes next, per bank
  history: [],        // every beat change, with the choice that caused it
  factViolations: [], // filled by the checker pass if a line breaks the sheet
};

// The setup roll can be stored once and never replaced.
export function freezeSetup(s) {
  if (setup) throw new Error("Setup is already rolled and frozen for this run");
  setup = Object.freeze(s);
}

function checkStep(to) {
  if (ended) throw new Error("The game has ended");
  if (pending) throw new Error("A beat change is already waiting");
  if (to !== beat + 1 || to > LAST_BEAT) throw new Error(`Illegal beat change ${beat} -> ${to}`);
}

export function applyChoice(choice) {
  if (choice.set) state.flags[choice.set] = true;
  if (choice.vars) Object.assign(state.vars, choice.vars);

  if (choice.advanceTo != null) {
    checkStep(choice.advanceTo);
    beat = choice.advanceTo;
    state.history.push({ beat, choice: choice.text });
  }
  if (choice.advanceAfter != null) {
    checkStep(choice.advanceAfter);
    pending = { to: choice.advanceAfter, choice: choice.text };
  }
  if (choice.endGame) {
    if (ended || pending) throw new Error("The game cannot end twice");
    if (beat !== LAST_BEAT) throw new Error("The game can only end in the last beat");
    pending = { to: "end", choice: choice.text };
  }
}

// Called by the dialogue box when it closes.
export function settle() {
  if (!pending) return;
  if (pending.to === "end") ended = true;
  else beat = pending.to;
  state.history.push({ beat: pending.to, choice: pending.choice });
  pending = null;
}

export function currentBeat() {
  return BEATS[beat - 1];
}
