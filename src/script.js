// The hard-coded spine for beats 1-6, as plain data.
//
// A node is:  { beat, lines: [...], choices: [...] }
//   line:   { who, text }  or  { who, bank: "bartender.greeting" }
//           who: "" (narration), "You", "Bartender", "Rogue", "Bo'sun"
//           page: true       -> show the ledger page while this line is up
//           page: "counted"  -> show it with the bo'sun's count beside it
//           when: (s) => ... -> only say this line if the test passes
//   choice: { text, goto, set, vars, scene, when,
//             advanceTo, advanceAfter, endGame }
//           advanceTo / advanceAfter / endGame are the ONLY things that move
//           the story (see beats.js).
//
// Every node belongs to one beat; the dialogue box refuses to run a node from
// another beat. Same rules as lines.js: no digits, no square brackets.
// Counted figures and shortfalls may only be used in nodes of beat 5 or 6.

const N = "";
const YOU = "You";
const BAR = "Bartender";
const ROGUE = "Rogue";
const BOSUN = "Bo'sun";

// ---------- Beat 1: wash up ----------

const shoreChoices = [
  { text: "Read the page", goto: "shore_read", when: (s) => !s.flags.readPage, set: "readPage" },
  { text: "Put it away and stand up", goto: null },
];

// ---------- Beat 2: enter the tavern ----------

const barChoices2 = [
  { text: "Do you know me?", goto: "bar2_know" },
  { text: "Where am I?", goto: "bar2_where" },
  { text: "Who are those two?", goto: "bar2_who" },
  { text: "Take the page from your pocket and lay it on the bar", goto: "page_surfaces", advanceTo: 3 },
  { text: "Leave him be", goto: null },
];

const rogueChoices2 = [
  { text: "Do I know you?", goto: "rogue2_know" },
  { text: "What is this place?", goto: "rogue2_place" },
  { text: "Walk away", goto: null },
];

const bosunChoices2 = [
  { text: "What are you writing?", goto: "bosun2_writing" },
  { text: "Do you know me?", goto: "bosun2_know" },
  { text: "Leave him to it", goto: null },
];

// ---------- Beat 3: the page surfaces ----------

const barChoices3 = [
  { text: "Do you know me?", goto: "bar3_know" },
  { text: "Ask about the page", goto: "bar3_page" },
  { text: "Leave him be", goto: null },
];

const rogueChoices3 = [
  { text: "You were looking at the page.", goto: "rogue3_looking" },
  { text: "Do you know what it is?", goto: "rogue3_what" },
  { text: "Walk away", goto: null },
];

// ---------- Beat 4: the rogue's game ----------

const rogueChoices4 = [
  { text: "Why do you want it?", goto: "rogue4_why" },
  { text: "What does the page say?", goto: "rogue4_say" },
  { text: "What will it cost to hear the truth?", goto: "rogue4_cost" },
  { text: "Refuse. Let the bo'sun read it.", goto: "rogue5_refused", advanceTo: 5 },
  { text: "Say nothing and step away", goto: null },
];

const barChoices4 = [
  { text: "Do you know me?", goto: "bar4_know" },
  { text: "What does the rogue want?", goto: "bar4_rogue" },
  { text: "Leave him be", goto: null },
];

// ---------- Beat 5: the bo'sun reads ----------

const bosunChoices5 = [
  { text: "Ask him to read it aloud", goto: "bosun5_read", when: (s) => !s.flags.pageRead, set: "pageRead" },
  { text: "Where did the silver go?", goto: "bosun5_where", when: (s) => s.flags.pageRead },
  { text: "And the rum?", goto: "bosun5_rum", when: (s) => s.flags.pageRead },
  { text: "Why did you go quiet?", goto: "bosun5_quiet", when: (s) => s.flags.pageRead },
  { text: "Step back and make up your mind", goto: "choice6_intro", when: (s) => s.flags.pageRead, advanceTo: 6 },
  { text: "Step away for now", goto: null },
];

const rogueChoices5 = [
  { text: "The bo'sun is reading it.", goto: "rogue5_reading", when: (s) => !s.flags.pageRead },
  { text: "He says {silver.missing} pieces of eight are missing.", goto: "rogue5_missing", when: (s) => s.flags.pageRead },
  { text: "Walk away", goto: null },
];

const barChoices5 = [
  { text: "Do you know me?", goto: "bar5_know" },
  { text: "Leave him be", goto: null },
];

// ---------- Beat 6: the choice ----------

const trustChoices = [
  { text: "Trust the bo'sun", goto: "choice6_page", vars: { trust: "bosun" } },
  { text: "Trust the rogue", goto: "choice6_page", vars: { trust: "rogue" } },
  { text: "Trust the bartender", goto: "choice6_page", vars: { trust: "bartender" } },
  { text: "Not yet", goto: null },
];

const trusts = (who) => (s) => s.vars.trust === who;
const says = (what) => (s) => s.vars.says === what;

export const NODES = {
  // ----- Beat 1 -----
  shore_intro: {
    beat: 1,
    lines: [
      { who: N, text: "Salt in your mouth. Sand under your cheek. The surf drags at your boots and lets go." },
      { who: N, text: "You sit up. A harbour. A crooked town climbing the hill behind it. You do not know its name." },
      { who: N, text: "You do not know your own name, either." },
      { who: N, text: "Something stiff in your coat pocket. A page, torn from a book. It is all you have." },
    ],
    choices: shoreChoices,
  },
  shore_read: {
    beat: 1,
    lines: [
      { who: N, page: true, text: "Ruled lines and a careful hand. {rum.recorded} barrels of rum. {sugar.recorded} hogsheads of sugar. {silver.recorded} pieces of eight." },
      { who: N, page: true, text: "And at the foot of the page, a total: {total.recorded} pieces." },
      { who: YOU, page: true, text: "Something about that sum sits wrong. I cannot say what. I cannot even say whose page this is." },
    ],
    choices: shoreChoices,
  },
  shore_door: {
    beat: 1,
    lines: [
      { who: N, text: "A low wooden building, open to the sea air. Lamplight. Voices. The smell of rum punch." },
    ],
    choices: [
      { text: "Go inside", advanceTo: 2, scene: "tavern" },
      { text: "Stay on the sand a while longer", goto: "shore_wait" },
    ],
  },
  shore_wait: {
    beat: 1,
    lines: [{ who: N, bank: "narrator.idle" }],
    choices: [],
  },

  // ----- Beat 2 -----
  tavern_enter: {
    beat: 2,
    lines: [
      { who: N, bank: "narrator.toBeat2" },
      { who: N, text: "Plank floor. Long tables. Barrels for seats. Candles guttering in the sea air." },
      { who: N, text: "Behind the bar, a big man is wiping a mug. He looks up at you." },
      { who: N, text: "His hand stops. For half a breath he stares at your face like a man seeing a ghost." },
      { who: N, text: "Then the cloth moves again, and his eyes go somewhere else." },
      { who: BAR, text: "Tide's been throwing all sorts up today. Sit anywhere that isn't taken." },
    ],
    choices: [],
  },

  bar2_hub: { beat: 2, lines: [{ who: BAR, bank: "bartender.greeting" }], choices: barChoices2 },
  bar2_menu: { beat: 2, lines: [], choices: barChoices2 },
  bar2_know: {
    beat: 2,
    lines: [
      { who: BAR, bank: "bartender.deflection" },
      { who: N, text: "He says it to the mug, not to you." },
    ],
    choices: barChoices2,
  },
  bar2_where: {
    beat: 2,
    lines: [
      { who: BAR, text: "Tortuga. If you were hoping for somewhere respectable, you've washed up on the wrong rock." },
    ],
    choices: barChoices2,
  },
  bar2_who: {
    beat: 2,
    lines: [
      { who: BAR, text: "The one in the corner with his hat down doesn't care for questions." },
      { who: BAR, text: "The one with the books is the bo'sun. Keeps a ship's accounts. Counts everything twice." },
    ],
    choices: barChoices2,
  },

  rogue2_hub: { beat: 2, lines: [{ who: ROGUE, bank: "rogue.greeting" }], choices: rogueChoices2 },
  rogue2_know: { beat: 2, lines: [{ who: ROGUE, bank: "rogue.deflection" }], choices: rogueChoices2 },
  rogue2_place: {
    beat: 2,
    lines: [{ who: ROGUE, text: "The last place anyone looks. That's its charm." }],
    choices: rogueChoices2,
  },

  bosun2_hub: { beat: 2, lines: [{ who: BOSUN, bank: "bosun.greeting" }], choices: bosunChoices2 },
  bosun2_writing: {
    beat: 2,
    lines: [
      { who: BOSUN, text: "Stores. What came aboard, what's left. A ship is only as honest as her books." },
    ],
    choices: bosunChoices2,
  },
  bosun2_know: { beat: 2, lines: [{ who: BOSUN, bank: "bosun.deflection" }], choices: bosunChoices2 },

  // ----- Beat 3 -----
  // Reached only through the bartender choice that carries advanceTo: 3.
  page_surfaces: {
    beat: 3,
    lines: [
      { who: N, page: true, bank: "narrator.toBeat3" },
      { who: N, page: true, text: "Ruled lines. Columns of figures. A page from a ship's ledger." },
      { who: N, text: "The bartender looks at it the way a man looks at a lit fuse." },
      { who: BAR, text: "I pour drinks. I don't read books." },
      { who: BAR, text: "If it's figures, that's the bo'sun's trade. Table by the barrels. And keep that thing off my bar." },
      { who: N, text: "In the corner, the rogue's hat has tilted up, just a little. At the far table, a quill has stopped scratching." },
    ],
    choices: [],
  },

  bar3_hub: { beat: 3, lines: [{ who: BAR, bank: "bartender.greeting" }], choices: barChoices3 },
  bar3_know: { beat: 3, lines: [{ who: BAR, bank: "bartender.deflection" }], choices: barChoices3 },
  bar3_page: {
    beat: 3,
    lines: [{ who: BAR, text: "I told you. The bo'sun. By the barrels. Not my bar, not my business." }],
    choices: barChoices3,
  },

  rogue3_hub: {
    beat: 3,
    lines: [{ who: N, text: "The rogue's eyes are on your coat pocket, not your face." }],
    choices: rogueChoices3,
  },
  rogue3_looking: {
    beat: 3,
    lines: [{ who: ROGUE, text: "I look at everything. It's cheaper than being surprised." }],
    choices: rogueChoices3,
  },
  rogue3_what: {
    beat: 3,
    lines: [{ who: ROGUE, text: "Paper. Paper burns. That's all the advice you get for free." }],
    choices: rogueChoices3,
  },

  bosun3_hub: {
    beat: 3,
    lines: [
      { who: N, text: "The bo'sun has not turned a leaf since the page came out. His quill hangs over the book." },
    ],
    choices: [
      // The beat changes only after the quiet lines below have finished.
      { text: "Show him the page", goto: "bosun3_quiet", advanceAfter: 4 },
      { text: "Say nothing yet", goto: null },
    ],
  },
  bosun3_quiet: {
    beat: 3,
    lines: [
      { who: N, page: true, text: "You set the torn page down beside his ledger." },
      { who: N, page: true, text: "He reads one line, then the next. {rum.recorded} barrels. {sugar.recorded} hogsheads. {silver.recorded} pieces of eight." },
      { who: N, page: true, text: "His finger stops at the foot of the page, on {total.recorded} pieces." },
      { who: N, text: "The bo'sun goes very quiet." },
      { who: N, text: "The quill does not move. The candle between you is suddenly the loudest thing in the room." },
      { who: YOU, text: "You can read it. What does it say?" },
      { who: N, text: "He does not answer. He turns the page face down, very gently, and keeps his hand flat on top of it." },
      { who: BAR, bank: "bartender.redirect" },
      { who: N, bank: "narrator.toBeat4" },
    ],
    choices: [],
  },

  // ----- Beat 4: the rogue's game -----
  rogue4_hub: {
    beat: 4,
    flag: "rogue4Met",
    lines: [
      { who: N, text: "The rogue hooks a stool out with his boot. He does not ask you to sit so much as allow it." },
      { who: ROGUE, text: "That page under the bo'sun's hand. You carried it in, so it's yours to carry out." },
      { who: ROGUE, text: "Fetch it back before the old man gets his spectacles on it. Bring it to me. I'll see you fed, dressed, and on a boat by morning." },
    ],
    choices: rogueChoices4,
  },
  rogue4_again: { beat: 4, lines: [{ who: ROGUE, text: "Well? The page, or more questions?" }], choices: rogueChoices4 },
  rogue4_why: {
    beat: 4,
    lines: [
      { who: ROGUE, bank: "rogue.secret" },
      { who: N, text: "He smiles. It does not reach his eyes." },
    ],
    choices: rogueChoices4,
  },
  rogue4_say: {
    beat: 4,
    lines: [
      { who: ROGUE, text: "Couldn't tell you. Never learned my letters. Ask anyone." },
      { who: N, text: "His eyes found the foot of the page fast enough, a moment ago." },
    ],
    choices: rogueChoices4,
  },
  rogue4_cost: {
    beat: 4,
    lines: [
      { who: ROGUE, text: "The page. In my hand. Then you get the truth, and a head start." },
      { who: N, text: "Nothing for free. Not from him." },
    ],
    choices: rogueChoices4,
  },

  bar4_hub: { beat: 4, lines: [{ who: BAR, bank: "bartender.greeting" }], choices: barChoices4 },
  bar4_know: { beat: 4, lines: [{ who: BAR, bank: "bartender.deflection" }], choices: barChoices4 },
  bar4_rogue: {
    beat: 4,
    lines: [{ who: BAR, text: "What he always wants. Something that isn't his. Mind your pockets." }],
    choices: barChoices4,
  },
  bosun4_hub: { beat: 4, lines: [{ who: N, bank: "bosun.quiet" }], choices: [] },

  // ----- Beat 5: the bo'sun reads -----
  // Reached only through the rogue choice that carries advanceTo: 5.
  rogue5_refused: {
    beat: 5,
    lines: [
      { who: ROGUE, text: "Your funeral. Figures only say what's gone. They never say who took it." },
      { who: N, bank: "narrator.toBeat5" },
    ],
    choices: [],
  },
  bosun5_hub: {
    beat: 5,
    lines: [
      { who: N, when: (s) => !s.flags.pageRead, text: "The bo'sun has his spectacles on. The page lies face up between you." },
      { who: N, when: (s) => s.flags.pageRead, text: "The bo'sun keeps one finger on the foot of the page." },
    ],
    choices: bosunChoices5,
  },
  // The first time the counted figures appear on screen.
  bosun5_read: {
    beat: 5,
    lines: [
      { who: BOSUN, page: "counted", text: "It is a tally of stores taken aboard. The written figures are one hand. I made the count beside them myself." },
      { who: BOSUN, page: "counted", text: "Rum. The page says {rum.recorded} barrels. I counted {rum.counted} in the hold. {rum.missing} barrels short." },
      { who: BOSUN, page: "counted", text: "Sugar. {sugar.recorded} hogsheads written, {sugar.counted} counted. The sugar is honest." },
      { who: BOSUN, page: "counted", text: "Silver. {silver.recorded} pieces of eight written. I counted {silver.counted}." },
      { who: BOSUN, page: "counted", text: "So the total at the foot is wrong. It says {total.recorded} pieces. There are {total.counted}. {total.missing} pieces of eight are missing." },
      { who: N, text: "He says it very quietly. In the corner, the rogue has stopped smiling." },
      { who: BAR, bank: "bartender.redirect" },
    ],
    choices: bosunChoices5,
  },
  bosun5_where: {
    beat: 5,
    lines: [
      { who: BOSUN, text: "A ledger tells you what is gone. It does not tell you who has it." },
      { who: BOSUN, text: "But {silver.missing} pieces of eight do not walk off a ship by themselves." },
      { who: N, text: "His eyes go to the corner, just once, and come back." },
    ],
    choices: bosunChoices5,
  },
  bosun5_rum: {
    beat: 5,
    lines: [
      { who: BOSUN, text: "{rum.missing} barrels. Sailors drink. I have seen worse. It is the silver that hangs a man." },
    ],
    choices: bosunChoices5,
  },
  bosun5_quiet: {
    beat: 5,
    lines: [
      { who: BOSUN, text: "Because whoever tore that page out did not want it read. And you walked in carrying it." },
    ],
    choices: bosunChoices5,
  },

  rogue5_hub: {
    beat: 5,
    lines: [{ who: N, text: "The rogue is watching the bo'sun's lips." }],
    choices: rogueChoices5,
  },
  rogue5_reading: { beat: 5, lines: [{ who: ROGUE, text: "Old men read all sorts into things." }], choices: rogueChoices5 },
  rogue5_missing: {
    beat: 5,
    lines: [{ who: ROGUE, text: "Does he. And did the page say who is holding them? No. Thought not." }],
    choices: rogueChoices5,
  },
  bar5_hub: { beat: 5, lines: [{ who: BAR, bank: "bartender.greeting" }], choices: barChoices5 },
  bar5_know: { beat: 5, lines: [{ who: BAR, bank: "bartender.deflection" }], choices: barChoices5 },

  // ----- Beat 6: the choice -----
  // Reached only through the bo'sun choice that carries advanceTo: 6.
  choice6_intro: {
    beat: 6,
    lines: [
      { who: N, bank: "narrator.toBeat6" },
      { who: N, text: "Nobody here is going to tell you who you were. You will have to decide who to trust, and what the page really says." },
    ],
    choices: trustChoices,
  },
  choice6_trust: {
    beat: 6,
    lines: [{ who: N, text: "Three men, one torn page. Who do you trust?" }],
    choices: trustChoices,
  },
  choice6_page: {
    beat: 6,
    lines: [{ who: N, text: "And the page. What does it really say?" }],
    choices: [
      { text: "It says someone stole {silver.missing} pieces of eight.", goto: "ending", vars: { says: "theft" }, endGame: true },
      { text: "It says the bo'sun counted wrong.", goto: "ending", vars: { says: "miscount" }, endGame: true },
      { text: "It says nothing. It is only paper.", goto: "ending", vars: { says: "nothing" }, endGame: true },
    ],
  },
  // One ending beat. Which lines play depends on the two answers.
  ending: {
    beat: 6,
    lines: [
      { who: YOU, when: says("theft"), text: "{silver.recorded} written, {silver.counted} counted. Somebody took {silver.missing} pieces of eight, and this page proves it." },
      { who: YOU, when: says("miscount"), text: "Maybe the old man counted wrong. {silver.recorded} is what is written, and the writing is all I have." },
      { who: YOU, when: says("nothing"), text: "It is ink on paper. I will not hang a name on it. I do not even have one of my own." },

      { who: N, when: trusts("bosun"), text: "You slide the page back across the table, under the bo'sun's hand." },
      { who: BOSUN, when: trusts("bosun"), text: "Then I keep the count, and you keep close to me. Somebody will come asking for this." },
      { who: N, when: trusts("bosun"), text: "In the corner, a stool is empty. Nobody saw the rogue go." },

      { who: N, when: trusts("rogue"), text: "You lift the page from the bo'sun's table and carry it to the corner. The old man does not stop you." },
      { who: ROGUE, when: trusts("rogue"), text: "Sensible. I said you'd get the truth for it." },
      { who: ROGUE, when: (s) => trusts("rogue")(s) && s.setup.rogueSecret.id === "silverCut", text: "The missing {silver.missing} pieces of eight? My cut. There. Paid for, not given." },
      { who: N, when: trusts("rogue"), text: "He folds the page into his coat. For the first time tonight, his smile reaches his eyes." },

      { who: N, when: trusts("bartender"), text: "You carry the page to the bar and slide it under the bartender's cloth." },
      { who: BAR, when: trusts("bartender"), text: "I never saw it. I never saw you." },
      { who: N, when: trusts("bartender"), text: "He pours two cups anyway, and pushes one across. His hand is not quite steady." },

      { who: N, text: "Outside, the tide is going out. You still do not know your name. But you know what you are holding, and who you are standing next to." },
      { who: N, bank: "narrator.end" },
    ],
    choices: [],
  },
  after_bartender: { beat: 6, lines: [{ who: BAR, bank: "bartender.greeting" }], choices: [] },
  after_rogue: { beat: 6, lines: [{ who: ROGUE, bank: "rogue.deflection" }], choices: [] },
  after_bosun: { beat: 6, lines: [{ who: N, bank: "bosun.quiet" }], choices: [] },
};

// Which node an interaction starts, given where the story is.
export function entryFor(id, s) {
  if (id === "door") return "shore_door";
  if (!["bartender", "rogue", "bosun"].includes(id)) throw new Error(`Nothing to talk to called "${id}"`);
  if (s.ended) return `after_${id}`;
  if (s.beat === 6) return "choice6_trust";
  if (id === "bartender") return `bar${s.beat}_hub`;
  if (id === "bosun") return `bosun${s.beat}_hub`;
  if (s.beat === 4) return s.flags.rogue4Met ? "rogue4_again" : "rogue4_hub";
  return `rogue${s.beat}_hub`;
}
