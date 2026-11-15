# Buccaneer Banter — playable spine (beats 1–6)

A 2D tavern game in KAPLAY for Bridge The Gap Hacks (Nov 15–21, 2026).
This build is the hard-coded spine: **no LLM calls, no text-to-speech.**

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

The game is plain static files, so it can also be uploaded as-is to any static host
(GitHub Pages, itch.io, Netlify) for a judge link.

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
| `serve.js` | Tiny local web server (no packages); `--phone` for playing on a phone |
| `package.json` | `npm start`, `npm test`, `npm run test:play` shortcuts |
| `lib/kaplay.mjs` | KAPLAY 3001.0.19, copied from npm (MIT licence in `lib/KAPLAY-LICENSE.md`) |
| `src/main.js` | Starts KAPLAY, rolls the setup, loads sprites and scenes |
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
| `test/play_beats.py` | Plays beats 1–6 in headless Chrome: by keyboard, by touch, and a short run |
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

## Tests

```
node test/check-lines.mjs        # no browser needed
node serve.js                    # in one terminal
python3 test/play_beats.py       # in another (needs: pip install playwright, and Chrome)
```

The play-test takes four to five minutes.

## Not built yet

- The LLM layer, the orchestrator, and TTS.
- Only one rogue secret exists, so the setup roll cannot yet make two runs differ.
- No sound, no save/load, no title screen, no walking animation, no restart button (reload the page).
- You cannot walk back out to the shore from the tavern.
- Touch controls were tested with simulated touches in desktop Chrome, not on a real phone.
- In portrait the picture is small; the game asks you to turn the phone sideways.
- The art is placeholder shapes.
