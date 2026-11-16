# Buccaneer Banter — beats 1–6, with an optional LLM dialogue layer

A 2D tavern game in KAPLAY for Bridge The Gap Hacks (Nov 15–21, 2026).

The game is a hard-coded spine that plays from start to finish with **zero LLM calls**.
On top of that sits an optional layer: an **orchestrator** that can ask an LLM for a few
in-the-moment NPC lines, checks every one before it is shown, and falls back to the
hard-coded line whenever anything is wrong. Text only: **no text-to-speech.**

**Play it in a browser:** https://numberwonderman.github.io/buccaneer-banter-/
(that link always plays on the hard-coded lines; see "The LLM layer" below for why).

1. **Wash up** on the shore of Tortuga with a torn ledger page.
2. **Enter the tavern.** The bartender recognises your face and pretends not to.
3. **The page surfaces.** You show the page. The bo'sun goes very quiet.
4. **The rogue's game.** He wants the page. He deflects. Nothing for free.
5. **The bo'sun reads.** The counted figures come out for the first time.
6. **The choice.** You decide who to trust and what the page really says. One ending beat.

## How to run it

You need Node.js (any recent version). Nothing to install — KAPLAY 3001.0.19 is already in `lib/`.

```
cd buccaneer-banter
node serve.js
```

Then open **http://localhost:8080** in a browser. Stop the server with Ctrl+C.

No Node? From the same folder, `python3 -m http.server 8080` works too.
Opening `index.html` by double-clicking will **not** work — browsers block JavaScript modules from `file://`.

### On a phone

Put the phone on the same Wi-Fi as the computer, then:

```
node serve.js --phone
```

It prints a line like `On your phone (same Wi-Fi), open http://192.168.1.23:8080`.
Type that address into the phone's browser and hold the phone sideways.
(`--phone` lets other devices on your network connect. Without it, only this computer can.)

The game is plain static files, so it also runs as-is on any static host
(GitHub Pages, itch.io, Netlify). On a static host it plays on the hard-coded lines.

## The LLM layer (optional)

### Without a key (the default)

Do nothing. `node serve.js` prints

```
LLM layer: OFF. ANTHROPIC_API_KEY is not set, so the game plays on its hard-coded lines.
```

and the game plays exactly as it did before this layer existed. The same is true on
GitHub Pages, with `python3 -m http.server`, and with `node serve.js --no-llm`.

### With a key

The key is read from one environment variable, `ANTHROPIC_API_KEY`, by `serve.js`.
Set it in the terminal you start the game from:

```
# Mac or Linux
export ANTHROPIC_API_KEY="paste-your-key-here"
node serve.js

# Windows PowerShell
$env:ANTHROPIC_API_KEY = "paste-your-key-here"
node serve.js
```

The server then prints `LLM layer: ON. Key found in ANTHROPIC_API_KEY (not shown). ...`
and the bartender, the rogue and the bo'sun start to vary their greetings and deflections.

Rules the code keeps about the key:

- It is read from the environment only. There is no key in any file, and no setting that takes one.
- It never leaves `serve.js`. The browser never receives it; the browser asks `serve.js`
  for a line, and `serve.js` asks the LLM.
- It is never printed, in the terminal or anywhere else.
- `.gitignore` excludes `.env` files. Do not put the key in a file in this folder anyway.
- **GitHub Pages cannot use a key.** Pages only serves files; there is no server to hold a
  secret, and a key placed in the page would be readable by everyone. So the public link
  always plays on hard-coded lines. To show the LLM layer (for the demo video), run
  `node serve.js` on your own computer with the key set.

Other settings, all optional: `BB_MODEL` (default `claude-haiku-5-5`),
`BB_MAX_CALLS_TOTAL` (most calls one run of the server will make, default 200),
`?llm=off` on the address (this browser tab plays without the layer),
`?debug=1` on the address (small counter of calls, bottom left, for demos).

### The cap

- **At most 20 LLM calls per play session** (one page load). Reload the page for a new session.
- **One call per NPC line**, plus **one regeneration** if the orchestrator rejects the line.
  So a line costs 1 call, or 2 at most, and both count toward the 20.
- The cap is counted in the browser and enforced again by the server.
- A reply may be at most 150 tokens; a line waits at most 9 seconds before the hard-coded line is used.

When the cap is spent, a call fails or times out, the reply is malformed, a line is rejected
twice, or there is no key: the hard-coded line is shown. The player never sees an error.
(`serve.js` notes failed calls in the terminal, without the key.)

### What the orchestrator does

`src/director.js` holds the beat list (beats 1–6), the ledger fact sheet and each NPC's role
card (`src/roles.js`). **Before any NPC line is shown, generated or hard-coded, it checks
the line against all three:**

1. **Fact sheet.** No number the current beat may not show, in digits or in words
   ("six hundred and fifty" counts). Counted figures and shortfalls (28, 650, 12, 150) only
   from beat 5. A figure must sit with its own item (not "650 barrels of rum"). The sugar
   matches, so nobody may say it is short. Only the bo'sun may quote a ledger figure at all.
2. **Role card.** The bartender never admits he recognises the main character. The rogue
   never gives up his secret for free (his one written confession is allowed only in the
   ending where you paid him with the page). Only the bo'sun reads the page, and he never
   names who took anything. Nobody tells the main character who he was.
3. **Current beat.** Nobody mentions the page before it is out (beat 3); the rogue makes no
   offer before his game (beat 4); nobody talks about a count or a shortfall before the
   bo'sun reads (beat 5). The line must have been written for the beat the story is in.

A generated line that fails is **regenerated once** (the model is told why it failed). If the
second also fails, the **hard-coded line** is shown.

What the LLM can and cannot do:

- It is asked only for lines that already have a fallback bank: greetings, deflections,
  and the bartender's tension-breakers. The story lines, the offer, the reading of the page
  and the ending are always the written ones.
- Each reply must pick **one action from the NPC's fixed list** (pour a drink, deflect,
  ask about the page, change the subject, go quiet, cut someone off). Anything else is rejected.
- It cannot change the beat or any game state. Only the player's choices do that.
- It is told only what the NPC may know. The rogue's brief does not contain his secret, and
  no brief contains a counted figure before beat 5 — so those cannot leak.
- The player never types free text, so there is nothing to inject into the brief.

## Controls

**Keyboard**

| Key | Does |
|---|---|
| Arrow keys or W A S D | Walk |
| E, Space or Enter | Talk to whoever is in reach / next line / pick the highlighted choice |
| Up / Down (or W / S) | Highlight a choice |
| 1 – 5 | Pick a choice directly |

When a list of choices opens, **nothing is highlighted yet**. Press Up or Down first, then E —
or just press the number. This is deliberate: pressing E quickly through the lines can no
longer pick a choice you have not read.

**Phone / touch** (buttons appear only on a touch screen, or with `?touch=1` on the address)

| Touch | Does |
|---|---|
| Arrow buttons, bottom left | Walk while held |
| Talk button, bottom right | Talk to whoever is in reach (it brightens when someone is) |
| Tap anywhere | Next line |
| Tap a choice | Pick it |

A tap on a choice only counts after a pause of about a second in tapping, so tapping
steadily through the lines cannot pick whatever appears under your finger.
A mouse click works the same as a tap.

The top-left banner always says which beat you are in and what to do next.

## Files

| File | What it is |
|---|---|
| `index.html` | The page that loads the game |
| `serve.js` | Tiny local web server (no packages); `--phone` for playing on a phone. Also holds the API key and makes the LLM calls |
| `package.json` | `npm start`, `npm test`, `npm run test:play` shortcuts |
| `lib/kaplay.mjs` | KAPLAY 3001.0.19, copied from npm (MIT licence in `lib/KAPLAY-LICENSE.md`) |
| `src/main.js` | Starts KAPLAY, rolls the setup, loads sprites and scenes, checks whether the LLM layer is on |
| `src/director.js` | **The orchestrator.** Checks every NPC line; regenerate once, then fall back; the cap |
| `src/roles.js` | **Role cards**: each NPC's goal per beat, never-list and action list |
| `src/prompt.js` | Writes the brief the server sends to the LLM, from the role cards |
| `src/llm.js` | Browser side of the LLM layer: asks `serve.js` for a line. Never sees the key |
| `src/stage.js` | Creates the one orchestrator for the session |
| `src/facts.js` | **The ledger fact sheet.** Frozen. The only place the numbers live |
| `src/setup.js` | **The setup roll**: what the rogue is hiding, rolled once, then frozen |
| `src/beats.js` | **Beat gating.** The beat can only change through a player choice |
| `src/lines.js` | **Fallback line bank**: greetings, deflections, beat transitions |
| `src/script.js` | The hard-coded conversations for beats 1–6, as plain data |
| `src/dialogue.js` | Dialogue box, choices (keys and taps), and the checker pass on every line |
| `src/touch.js` | On-screen walk and Talk buttons for phones |
| `src/world.js` | Player, walking, collisions, prompt, beat banner |
| `src/scenes.js` | The shore scene and the tavern scene |
| `src/layout.js` | Where everything stands (used for both drawing and collisions) |
| `src/sprites.js` | Placeholder sprites, painted in code — no image files |
| `test/check-lines.mjs` | Checks every written line against the fact sheet, the beat gate and the setup roll |
| `test/check-director.mjs` | Checks the orchestrator: bad lines rejected, good lines pass, regenerate, fallback, cap, briefs, no key in the project |
| `test/play_beats.py` | Plays beats 1–6 in headless Chrome with **no key**: by keyboard, by touch, and a short run |
| `test/play_llm.py` | Plays beats 1–6 in headless Chrome with the **LLM layer on**, against the stand-in below |
| `test/mock-llm.mjs` | A stand-in for the LLM API (fixed replies, some deliberately bad). Not a real model |
| `.gitignore`, `.nojekyll` | Keep `.env` files out of git; tell GitHub Pages to serve the files as they are |
| `test/screenshots/` | Screenshots and full transcripts from the last play-test run |

## The fact sheet (ground truth)

| Item | Written on the page | Actually counted | Difference |
|---|---|---|---|
| Rum | 40 barrels | 28 barrels | 12 missing |
| Sugar | 60 hogsheads | 60 hogsheads | matches |
| Silver (pieces of eight) | 800 | 650 | 150 missing |
| **Total silver** | **800 pieces** | **650 pieces** | **150 missing** |

The total is **silver only**. Rum and sugar are separate items on the page and are not added in.
The missing 150 pieces of eight are the rogue's cut.

Note: this corrects the draft sheet in the planning notes (`build-starter-nov15.md`), which
still shows a total of 1,240 / 1,090. The planning notes were left untouched.

## How the guard rails work

- **Fact sheet.** Lines never contain a typed number. They use tokens like `{rum.recorded}`,
  filled from `src/facts.js`. Before any line or choice is shown, the checker rejects any
  number its beat may not show. Beats 1–4: only what is written on the page (40, 60, 800).
  Beat 5 onward: the counted figures and shortfalls too (28, 650, 12, 150).
- **Beat gating.** The beat number is private to `src/beats.js` and moves one step at a time,
  only when the player picks one of these choices:
  1→2 "Go inside" · 2→3 "Take the page from your pocket and lay it on the bar" ·
  3→4 "Show him the page" · 4→5 "Refuse. Let the bo'sun read it." ·
  5→6 "Step back and make up your mind" · end: one of the three "It says…" answers.
  After "Show him the page" and after the final answer, the change waits until the lines
  that follow have finished, so the banner never runs ahead of the story.
  Each conversation belongs to one beat and will not run in another.
- **Setup roll.** `src/setup.js` rolls what the rogue is hiding once at start-up and freezes
  it. The table holds one secret today (the silver cut), so every run lands on it. Add rows
  to make runs differ. `?seed=7` on the address replays a roll.
- **Role cards.** The bartender only ever deflects "Do you know me?". The rogue names his cut
  in one case only: the ending where you trust him and hand him the page — paid for, not free.
  The bo'sun is the only one who reads the page out.
- **Orchestrator.** Every NPC line, written or generated, is checked against the fact sheet,
  the role card and the current beat before it is shown. See "What the orchestrator does".

## Tests

```
node test/check-lines.mjs        # no browser needed
node test/check-director.mjs     # no browser needed, no LLM calls
node serve.js                    # in one terminal, with NO key set
python3 test/play_beats.py       # in another (needs: pip install playwright, and Chrome)
python3 test/play_llm.py         # starts its own servers; uses the stand-in, not a real model
```

`play_beats.py` takes four to five minutes, `play_llm.py` about two.
`npm test` runs the two no-browser checks.

## Not built yet

- **The LLM layer has not been run against a real model.** It was tested end to end against
  the stand-in (`test/mock-llm.mjs`), which proves the checks, the regeneration, the
  fallback, the cap and the key handling, but says nothing about how good a real model's
  lines are, or how often they get rejected. The model name `claude-haiku-5-5` and the live
  API call are untested; if the name is wrong the game simply stays on hard-coded lines.
- The orchestrator's checks are pattern rules, not understanding. They are strict on purpose
  (a harmless line with the word "short" in it is thrown away before beat 5), and a cleverly
  worded hint could still get past them.
- The action an NPC picks is checked and recorded, but nothing on screen changes with it yet.
- Generated lines happen only where a fallback bank exists (beats 2–5). The bo'sun's
  generated lines are in beat 2 only; from beat 3 his lines are all written.
- NPCs keep a four-line memory within a session, not a summary between beats.
- TTS.
- Only one rogue secret exists, so the setup roll cannot yet make two runs differ.
- No sound, no save/load, no title screen, no walking animation, no restart button (reload the page).
- You cannot walk back out to the shore from the tavern.
- Touch controls were tested with simulated touches in desktop Chrome, not on a real phone.
- In portrait the picture is small; the game asks you to turn the phone sideways.
- The art is placeholder shapes.
