// Fallback line bank: pre-written greetings, deflections and beat transitions,
// so the game plays with zero LLM calls. When the LLM layer arrives, these are
// what an NPC says if a call fails, is over the cap, or fails the checker.
//
// Rules for this file:
//  - No digits. A ledger number is written as a token, e.g. {rum.recorded},
//    and filled from facts.js.
//  - No square brackets (KAPLAY reads them as text-style tags).
//  - Role cards: the bartender never admits he knows the main character.
//    The rogue never gives up his secret for free. The bo'sun says little.

export const BANK = {
  bartender: {
    greeting: [
      "What'll it be? There's rum punch, and there's more rum punch.",
      "Back again. The punch hasn't improved.",
      "Sit, drink, or stand out of the way of those who do.",
    ],
    deflection: [
      "Know you? I know every face that owes me money. Yours isn't one of them.",
      "One wet stranger looks much like another. Drink?",
      "I pour. I don't keep a list of who I pour for.",
      "You've a common sort of face. Half the harbour has it.",
    ],
    // In-world moderator: he steers talk back in character.
    redirect: [
      "Drinks, gentlemen. On the house. Whatever that is, it will keep till the cups are full.",
      "That's enough of that at my bar. Who's dry?",
      "Mind the candles. And mind your own business while you're at it.",
    ],
  },

  rogue: {
    greeting: [
      "Seat's taken. So is the one next to it.",
      "You again. The answer's still no, whatever the question was.",
      "Stand somewhere else. You're in my light.",
    ],
    deflection: [
      "If you knew me, you'd know better than to ask.",
      "Questions cost. You don't look like a man with a purse.",
      "I've forgotten more than you have. And that's saying something, by the look of you.",
      "Ask the bartender. He likes talking. I like quiet.",
    ],
    // Beat 4 on: asked straight out what he is hiding. He never says.
    secret: [
      "Sentiment. I collect torn paper.",
      "Everybody in Tortuga is hiding something. I'm only better at it.",
      "Ask me again with a full purse.",
    ],
  },

  bosun: {
    greeting: [
      "Mm. I'm counting.",
      "A moment. I lose the tally if I stop.",
      "Speak, then. Quietly.",
    ],
    deflection: [
      "I know cargo. Faces I leave to the bartender.",
      "That's not in my books, so it's not my affair.",
      "Ask me about stores and I'll answer. Anything else, no.",
    ],
    quiet: [
      "He does not look up. His hand stays flat on the page.",
      "His lips move, as if he is counting. No sound comes out.",
      "The bo'sun says nothing at all.",
    ],
  },

  narrator: {
    idle: [
      "The tide keeps its own counsel.",
      "Nothing comes back to you. Only the sound of the surf.",
      "Somewhere up the beach, someone laughs. Not at you. Probably.",
    ],
    // Beat transitions.
    toBeat2: "You push the door open. Warm air, candle smoke, and every voice in the room dropping by half.",
    toBeat3: "You take the torn page from your pocket and smooth it flat on the bar.",
    toBeat4: "In the corner, the rogue tips his hat back and crooks one finger at you.",
    toBeat5: "Across the room, the bo'sun has put his spectacles on and turned the page face up.",
    toBeat6: "Three men in a room, and one torn page. The bo'sun's count. The rogue's offer. The bartender's careful silence.",
    end: "The end, for now. Thank you for playing Buccaneer Banter.",
  },
};

// Take the next line from a bank, in order, wrapping round. "bartender.greeting"
export function pick(key, bankIdx) {
  const [who, kind] = key.split(".");
  const list = BANK[who]?.[kind];
  if (!list) throw new Error(`No line bank "${key}"`);
  if (typeof list === "string") return list;
  const i = bankIdx[key] ?? 0;
  bankIdx[key] = (i + 1) % list.length;
  return list[i];
}
