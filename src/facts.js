// Ground-truth ledger fact sheet. Frozen. Nothing in the game may contradict it.
// Source: build-starter-nov15.md, "Ledger-page fact sheet", with the Nov 15
// correction: the page total is SILVER ONLY. Rum and sugar are separate items
// on the page and are not added into the pieces total.
//
// Dialogue never types a ledger number by hand. Lines use tokens such as
// {rum.recorded} and fill() swaps in the value from this sheet, so there is
// exactly one place where the numbers live.

function deepFreeze(o) {
  Object.values(o).forEach((v) => typeof v === "object" && v !== null && deepFreeze(v));
  return Object.freeze(o);
}

export const FACTS = deepFreeze({
  rum:    { label: "Rum",    unit: "barrels",         recorded: 40,   counted: 28,   missing: 12 },
  sugar:  { label: "Sugar",  unit: "hogsheads",       recorded: 60,   counted: 60,   missing: 0 },
  silver: { label: "Silver", unit: "pieces of eight", recorded: 800,  counted: 650,  missing: 150 },
  // Silver only: the same figures as the silver row, by design.
  total:  { label: "Total silver", unit: "pieces",    recorded: 800,  counted: 650,  missing: 150 },
  // The missing 150 pieces of silver are the rogue's cut. He never gives this
  // up for free. The counted figures and shortfalls first appear in beat 5.
  secret: { holder: "rogue", item: "silver", amount: 150 },
});

export const fmt = (n) => n.toLocaleString("en-US");

// Replace {item.field} tokens with values from the sheet. Unknown tokens throw,
// so a typo cannot silently put a wrong number on screen.
export function fill(text) {
  return text.replace(/\{(\w+)\.(\w+)\}/g, (_, item, field) => {
    const v = FACTS[item]?.[field];
    if (typeof v !== "number") throw new Error(`Unknown fact token {${item}.${field}}`);
    return fmt(v);
  });
}

// Every number the sheet contains.
export function allNumbers() {
  const s = new Set();
  for (const k of ["rum", "sugar", "silver", "total"]) {
    for (const f of ["recorded", "counted", "missing"]) s.add(FACTS[k][f]);
  }
  s.delete(0);
  return s;
}

// Numbers that are written on the torn page itself (the "recorded" column).
// Beats 1-4 may show these and nothing else: the counted figures and the
// shortfalls are for the bo'sun to read out in beat 5.
export function pageNumbers() {
  return new Set(["rum", "sugar", "silver", "total"].map((k) => FACTS[k].recorded));
}

// Checker pass: returns every numeral in a finished line that is not allowed.
export function badNumbers(text, allowed = allNumbers()) {
  const found = text.match(/\d[\d,]*/g) || [];
  return found.filter((raw) => !allowed.has(Number(raw.replace(/,/g, ""))));
}

// Which numbers a line may show, by beat. The counted figures unlock in beat 5.
export const REVEAL_BEAT = 5;
export function allowedInBeat(beat) {
  return beat >= REVEAL_BEAT ? allNumbers() : pageNumbers();
}
