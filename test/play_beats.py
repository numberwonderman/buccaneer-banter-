"""Plays beats 1-6 end to end in a real (headless) Chrome.

Three runs:
  1. keyboard, the long way round (talks to everyone, tries to break the gates)
  2. touch, on a phone-sized screen, using only simulated finger touches
  3. keyboard, shortest path, a different ending

This is the NO-KEY run: start the server without ANTHROPIC_API_KEY set. The
run with the LLM layer switched on is test/play_llm.py.

Needs:  pip install playwright   and Google Chrome (set BB_CHROME to its path if
        it is not at /usr/bin/google-chrome).
Run:    start the game first (node serve.js), then:  python3 test/play_beats.py
Screenshots and transcripts are written to test/screenshots/.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

URL = os.environ.get("BB_URL", "http://127.0.0.1:8080/")
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
CHROME = os.environ.get("BB_CHROME", "/usr/bin/google-chrome")
os.makedirs(SHOTS, exist_ok=True)

# Places to stand (the point between his feet), in game coordinates.
DOOR = (825, 395)
BOSUN = (775, 365)
ROGUE = (240, 365)
BAR = (285, 215)
LANE = (285, 365)  # clear walkway below the tables

HIDDEN = ["28", "12", "650", "150"]  # counted figures: beat 5 onward only
problems = []
checks = 0


def check(cond, msg):
    global checks
    checks += 1
    print(("ok    " if cond else "FAIL  ") + msg)
    if not cond:
        problems.append(msg)


class Game:
    """Shared reading of the game's state; subclasses supply the fingers."""

    def __init__(self, page, tag):
        self.page = page
        self.tag = tag
        self.seen = []  # (beat, text) for every line and choice list shown
        self.sources = []  # (beat, speaker, text, source) for every spoken line

    def settled(self, limit=20.0):
        """The box, once it is not waiting on the orchestrator for a line."""
        t0 = time.time()
        u = self.ui()
        while u["active"] and u["mode"] == "wait" and time.time() - t0 < limit:
            time.sleep(0.05)
            u = self.ui()
        if u["mode"] == "wait":
            check(False, "a line was still waiting on the orchestrator after 20 seconds")
        return u

    def js(self, expr):
        return self.page.evaluate(f"(() => {{ const b = window.__bb; return {expr}; }})()")

    def ui(self):
        return self.js("({...b.ui, beat: b.state.beat, ended: b.state.ended, pending: !!b.state.pending, "
                       "scene: b.probe.scene, x: b.probe.x, y: b.probe.y, near: b.probe.near, holder: b.pageHolder()})")

    def shot(self, name):
        time.sleep(0.15)
        self.page.screenshot(path=os.path.join(SHOTS, f"{self.tag}-{name}.png"))

    def read(self, expect_beat=None, expect_ended=None):
        """Step through spoken lines until choices appear or the box closes."""
        out = []
        for _ in range(60):
            u = self.settled()
            if not u["active"] or u["mode"] != "line":
                break
            if expect_beat is not None and u["beat"] != expect_beat:
                check(False, f'banner beat changed to {u["beat"]} while a beat {expect_beat} line was still up')
            if expect_ended is not None and u["ended"] != expect_ended:
                check(False, "game marked ended while ending lines were still up")
            out.append(u["text"])
            self.seen.append((u["beat"], f'{u["speaker"] or "(narration)"}: {u["text"]}'))
            self.sources.append((u["beat"], u["speaker"], u["text"], u["source"]))
            before = (u["node"], u["text"], u["speaker"])
            self.advance()
            for _ in range(40):  # wait until this press/tap has landed
                v = self.ui()
                if (v["node"], v["text"], v["speaker"]) != before or v["mode"] != "line":
                    break
                time.sleep(0.02)
        return " ".join(out), len(out)

    def choose(self, text, via=None):
        u = self.settled()
        check(u["mode"] == "choice" and text in u["choices"], f'choice offered: "{text}"')
        check(u["selected"] == -1, "no choice is highlighted when the list opens") if via == "strict" else None
        self.seen.append((u["beat"], "  choices: " + " | ".join(u["choices"])))
        self.seen.append((u["beat"], f"  > {text}"))
        self.pick(u, u["choices"].index(text), via)
        time.sleep(0.12)

    def walk(self, direction, until, timeout=12.0):
        self.hold(direction)
        t0 = time.time()
        ok = False
        while time.time() - t0 < timeout:
            if self.page.evaluate(f"(() => {{ const p = window.__bb.probe; return {until}; }})()"):
                ok = True
                break
            time.sleep(0.02)
        if not ok:
            print("      walk stuck:", direction, until, self.js(
                "({x: b.probe.x, y: b.probe.y, near: b.probe.near, active: b.ui.active, mode: b.ui.mode, touch: {...b.touch}, "
                "ui: document.querySelector('#touch-ui') ? getComputedStyle(document.querySelector('#touch-ui')).display : 'none', "
                "held: [...document.querySelectorAll('button.held')].map(e => e.dataset.dir)})"))
        self.release(direction)
        time.sleep(0.08)
        return ok

    def go(self, *points, tol=14):
        """Walk to each (x, y) in turn, across first and then up/down, in short
        measured bursts, so the route does not depend on how fast frames are drawn."""
        for tx, ty in points:
            for axis, target, neg, pos in (("x", tx, "left", "right"), ("y", ty, "up", "down")):
                still = 0
                for _ in range(80):
                    cur = self.js(f"b.probe.{axis}")
                    err = target - cur
                    if abs(err) <= tol:
                        break
                    d = pos if err > 0 else neg
                    self.hold(d)
                    time.sleep(max(0.03, min(abs(err) / 190 * 0.6, 1.0)))
                    self.release(d)
                    time.sleep(0.12)
                    still = still + 1 if self.js(f"b.probe.{axis}") == cur else 0
                    if still >= 4:
                        print(f"      walk blocked on {axis} at", self.js("[b.probe.x, b.probe.y]"), "heading for", (tx, ty))
                        return False
        return True

    def talk_to(self, who):
        check(self.ui()["near"] == who, f"in reach of the {who}")
        self.talk()
        time.sleep(0.12)


class Keyboard(Game):
    KEYS = {"left": "ArrowLeft", "right": "ArrowRight", "up": "ArrowUp", "down": "ArrowDown"}

    def advance(self):
        self.page.keyboard.press("e")

    def talk(self):
        self.page.keyboard.press("e")

    def pick(self, u, i, via):
        if via == "arrows":  # Down to the choice, then E
            for _ in range(i + 1):
                self.page.keyboard.press("ArrowDown")
                time.sleep(0.05)
            self.page.keyboard.press("Enter")
        else:
            self.page.keyboard.press(str(i + 1))

    def hold(self, d):
        self.page.keyboard.down(self.KEYS.get(d, d))

    def release(self, d):
        self.page.keyboard.up(self.KEYS.get(d, d))


class Touch(Game):
    def __init__(self, page, tag, cdp):
        super().__init__(page, tag)
        self.cdp = cdp

    def down(self, x, y):
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})

    def up(self):
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

    def tap(self, x, y):
        self.down(x, y)
        time.sleep(0.03)
        self.up()

    def to_screen(self, gx, gy):
        """Game coordinates (960 x 540) to screen pixels, allowing for letterboxing."""
        r = self.page.evaluate("(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()")
        s = min(r[2] / 960, r[3] / 540)
        return r[0] + (r[2] - 960 * s) / 2 + gx * s, r[1] + (r[3] - 540 * s) / 2 + gy * s

    def centre(self, selector):
        r = self.page.evaluate(f"(() => {{ const r = document.querySelector('{selector}').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }})()")
        return r[0], r[1]

    def advance(self):
        self.tap(*self.to_screen(480, 440))  # anywhere on the game

    def talk(self):
        self.page.wait_for_function("getComputedStyle(document.querySelector('#touch-ui')).display !== 'none'", timeout=3000)
        self.tap(*self.centre("#touch-talk"))

    def pick(self, u, i, via):
        time.sleep(0.95)  # a choice tap only counts after a 0.8 s pause in tapping
        r = u["rects"][i]
        self.tap(*self.to_screen(r["x"] + r["w"] / 2, r["y"] + r["h"] / 2))

    def hold(self, d):
        self.down(*self.centre(f"#touch-pad [data-dir={d}]"))

    def release(self, d):
        self.up()


def play(g, full, trust, says):
    kb = isinstance(g, Keyboard)
    how = "keys" if kb else "touch"
    print(f"\n===== {g.tag}: {how}, {'long way round' if full else 'shortest path'}, ending {trust}/{says} =====")

    # ---------------- Beat 1: wash up ----------------
    print("Beat 1")
    u = g.ui()
    check(u["scene"] == "shore" and u["beat"] == 1 and u["active"], "starts on the shore in beat 1 with the opening narration")
    check(g.js("b.state.setup.rogueSecret.id") == "silverCut" and g.js("Object.isFrozen(b.state.setup)"), "setup rolled before play and frozen: the rogue hides the silver cut")
    check(g.js("!!document.querySelector('#touch-ui')") == (not kb), "on-screen buttons present on touch only" if not kb else "no on-screen buttons on a keyboard-and-mouse screen")
    g.shot("01-shore")
    text, n = g.read()
    check(n == 4 and "torn from a book" in text, f"four opening lines, one per {'press' if kb else 'tap'}; he finds the torn page")
    g.choose("Read the page", via="strict")
    check(g.ui()["page"] is True, "ledger page is shown")
    g.shot("02-page-written")
    text, _ = g.read()
    check("40 barrels" in text and "60 hogsheads" in text and "800 pieces of eight" in text and "a total: 800 pieces" in text,
          "page reads 40 barrels, 60 hogsheads, 800 pieces of eight, total 800 pieces (silver only)")
    check("1,240" not in text and "1240" not in text, "the old 1,240 total is gone")
    g.choose("Put it away and stand up")
    if not kb:
        g.shot("03-touch-buttons")
        check(g.js("getComputedStyle(document.querySelector('#touch-ui')).display") != "none", "walk and Talk buttons are showing")
    if full and kb:
        for key, cond, label in [("d", "p.x >= 420", "D"), ("a", "p.x <= 380", "A"), ("w", "p.y <= 360", "W"), ("s", "p.y >= 395", "S")]:
            check(g.walk(key, cond), f"walks with {label}")
    if not kb:
        y0 = g.ui()["y"]
        check(g.walk("up", f"p.y <= {y0 - 40}") and g.walk("down", f"p.y >= {y0}"), "up and down buttons walk him")
        x0 = g.ui()["x"]
        check(g.walk("right", f"p.x >= {x0 + 60}") and g.walk("left", f"p.x <= {x0 + 20}"), "right and left buttons walk him")
        time.sleep(0.3)
        x1 = g.ui()["x"]
        time.sleep(0.4)
        check(g.ui()["x"] == x1, "he stops when the finger lifts")
    check(g.go(DOOR), "walks right to the tavern door")
    check(g.ui()["beat"] == 1, "walking to the door does not advance the beat")

    if full:
        # Fix 3: the door prompt must come back every time, and fast presses must not skip it.
        for i in range(3):
            g.talk_to("door")
            g.read()
            g.choose("Stay on the sand a while longer", via="strict")
            g.read()
            u = g.ui()
            check(u["beat"] == 1 and u["scene"] == "shore" and not u["active"], f"round {i + 1}: declined, still beat 1 on the shore")
        if kb:
            for _ in range(15):
                g.page.keyboard.press("e")
                time.sleep(0.03)
            u = g.ui()
            check(u["scene"] == "shore" and u["beat"] == 1, "15 fast E presses do NOT go inside")
            check(u["mode"] == "choice" and u["choices"] == ["Go inside", "Stay on the sand a while longer"] and u["selected"] == -1,
                  "the prompt is waiting, both choices offered, nothing highlighted")
            g.shot("04-door-prompt-after-fast-E")
            for key in ["Enter", " "]:
                g.page.keyboard.press(key)
            check(g.ui()["mode"] == "choice" and g.ui()["beat"] == 1, "Enter and Space cannot pick an unhighlighted choice either")
            g.choose("Go inside", via="arrows")
        else:
            g.talk_to("door")
            x, y = g.to_screen(480, 440)
            t0 = time.time()
            for _ in range(10):  # steady tapping on the spot where "Go inside" will appear
                g.tap(x, y)
                time.sleep(0.05)
            gap = (time.time() - t0) / 10
            u = g.ui()
            check(u["scene"] == "shore" and u["beat"] == 1 and u["mode"] == "choice",
                  f"10 steady taps (one every {gap:.2f} s) on the spot where \"Go inside\" appears do NOT go inside")
            g.shot("04-door-prompt-after-steady-taps")
            g.choose("Go inside")
    else:
        g.talk_to("door")
        g.read()
        g.choose("Go inside")
    time.sleep(0.3)

    # ---------------- Beat 2: enter the tavern ----------------
    print("Beat 2")
    u = g.ui()
    check(u["scene"] == "tavern" and u["beat"] == 2, '"Go inside" advances to beat 2 and loads the tavern')
    text, n = g.read(expect_beat=2)
    check(n == 6 and "seeing a ghost" in text and "his eyes go somewhere else" in text, "six entrance lines; bartender recognises the face, then looks away")
    g.shot("05-tavern")
    if full:
        check(g.go(BOSUN), "walks to the bo'sun")
        g.talk_to("bosun")
        g.read()
        check("Show him the page" not in g.ui()["choices"], "beat 2: bo'sun has no show-the-page choice")
        g.choose("What are you writing?")
        g.read()
        g.choose("Leave him to it")
        check(g.go(ROGUE), "walks to the rogue")
        g.talk_to("rogue")
        g.read()
        g.choose("Do I know you?")
        g.read()
        g.choose("Walk away")
        check(g.ui()["beat"] == 2, "talking to the bo'sun and the rogue does not advance the beat")
    check(g.go(BAR), "walks to the bar")
    check(not g.go((285, 150), tol=8) and g.ui()["y"] >= 196, "the bar counter stops him")
    g.talk_to("bartender")
    g.read()
    if full:
        answers = []
        for _ in range(5):
            g.choose("Do you know me?")
            answers.append(g.read()[0])
        check(len(set(answers)) == 4 and answers[4].startswith(answers[0][:20]), "bartender's deflections cycle through 4 lines and wrap")
        g.choose("Where am I?")
        check("Tortuga" in g.read()[0], "bartender names Tortuga")
    g.shot("06-bartender-choices")
    g.choose("Take the page from your pocket and lay it on the bar", via="arrows" if kb else None)

    # ---------------- Beat 3: the page surfaces ----------------
    print("Beat 3")
    check(g.ui()["beat"] == 3 and g.ui()["page"] is True, "laying the page on the bar advances to beat 3; page shown")
    text, _ = g.read(expect_beat=3)
    check("bo'sun's trade" in text and "quill has stopped" in text, "bartender sends him to the bo'sun; the quill stops")
    check(g.go(LANE, BOSUN), "walks to the bo'sun")
    g.talk_to("bosun")
    g.read()
    if full:
        g.choose("Say nothing yet")
        check(g.ui()["beat"] == 3, '"Say nothing yet" does not advance')
        g.talk_to("bosun")
        g.read()
    g.choose("Show him the page")
    # Fix 2: the banner must not move on until the quiet lines are finished.
    u = g.ui()
    check(u["beat"] == 3 and u["pending"] and u["holder"] == "in your hand", "right after the choice: banner still says beat 3, change is waiting")
    g.shot("07-bosun-quiet-still-beat-3")
    text, n = g.read(expect_beat=3)
    check(n == 9 and "The bo'sun goes very quiet." in text, 'all nine quiet lines play in beat 3, including "The bo\'sun goes very quiet."')
    check("40 barrels" in text and "60 hogsheads" in text and "800 pieces of eight" in text and "on 800 pieces" in text, "the written figures he reads match the fact sheet")
    u = g.ui()
    check(u["beat"] == 4 and not u["active"] and not u["pending"] and u["holder"] == "bo'sun has it", "only after the last line: beat 4, page with the bo'sun")
    g.shot("08-beat-4-banner")
    early = "\n".join(t for b, t in g.seen if b <= 3)
    check(not any(h in early for h in HIDDEN), "beats 1-3 showed none of the counted figures (28, 12, 650, 150)")

    # ---------------- Beat 4: the rogue's game ----------------
    print("Beat 4")
    if full:
        g.talk_to("bosun")
        text, n = g.read()
        check(n == 1 and not g.ui()["active"], "beat 4: the bo'sun only stays quiet; no reading yet")
    check(g.go(ROGUE), "walks to the rogue's corner")
    g.talk_to("rogue")
    text, _ = g.read(expect_beat=4)
    check("Bring it to me" in text, "the rogue makes his offer for the page")
    g.shot("09-rogue-game")
    if full:
        whys = []
        for _ in range(3):
            g.choose("Why do you want it?")
            whys.append(g.read()[0])
        check(len(set(whys)) == 3, "asked why three times: three different deflections")
        g.choose("What does the page say?")
        g.read()
        g.choose("What will it cost to hear the truth?")
        check("Nothing for free" in g.read()[0], "he names a price; nothing for free")
        g.choose("Say nothing and step away")
        check(g.ui()["beat"] == 4, "questions and stepping away do not advance the beat")
        g.talk_to("rogue")
        check("more questions" in g.read()[0], "coming back gets a short greeting, not the whole offer again")
    g.choose("Refuse. Let the bo'sun read it.")
    check(g.ui()["beat"] == 5, "refusing the rogue advances to beat 5")
    g.read(expect_beat=5)
    b4 = "\n".join(t for b, t in g.seen if b == 4)
    check(not any(h in b4 for h in HIDDEN) and "cut" not in b4.lower(), "beat 4: the rogue gave up no figure and no secret")

    # ---------------- Beat 5: the bo'sun reads ----------------
    print("Beat 5")
    if full:
        g.talk_to("rogue")
        g.read()
        check(not any("missing" in c for c in g.ui()["choices"]), "before the reading, you cannot quote the missing figure at the rogue")
        g.choose("Walk away")
    check(g.go(BOSUN), "walks back to the bo'sun")
    g.talk_to("bosun")
    g.read()
    check("Step back and make up your mind" not in g.ui()["choices"], "cannot move on to the choice before the page is read")
    g.choose("Ask him to read it aloud")
    check(g.ui()["page"] == "counted", "the page is shown with the bo'sun's count beside it")
    g.shot("10-bosun-reads")
    text, _ = g.read(expect_beat=5)
    check("says 40 barrels. I counted 28" in text and "12 barrels short" in text, "rum: 28 counted, not 40; 12 short")
    check("60 hogsheads written, 60 counted" in text, "sugar: 60 and 60, matches")
    check("800 pieces of eight written. I counted 650" in text, "silver: 650 counted, not 800")
    check("It says 800 pieces. There are 650. 150 pieces of eight are missing." in text, "total: 650 not 800, 150 missing")
    if full:
        g.choose("Where did the silver go?")
        check("150 pieces of eight do not walk off" in g.read()[0], "bo'sun will not say who has it")
        g.choose("And the rum?")
        g.read()
        g.choose("Why did you go quiet?")
        g.read()
        g.choose("Step away for now")
        check(g.ui()["beat"] == 5 and not g.ui()["active"], "questions and stepping away do not advance the beat")
        check(g.go(ROGUE), "walks to the rogue")
        g.talk_to("rogue")
        g.read()
        g.choose("He says 150 pieces of eight are missing.")
        t5, _ = g.read()
        check("who is holding them" in t5 and "cut" not in t5.lower(), "the rogue deflects again; still nothing for free")
        g.choose("Walk away")
        check(g.go(BOSUN), "walks back to the bo'sun")
        g.talk_to("bosun")
        g.read()
    g.choose("Step back and make up your mind")

    # ---------------- Beat 6: the choice ----------------
    print("Beat 6")
    check(g.ui()["beat"] == 6, "stepping back advances to beat 6")
    g.read(expect_beat=6)
    names = {"bosun": "Trust the bo'sun", "rogue": "Trust the rogue", "bartender": "Trust the bartender"}
    check(g.ui()["choices"] == list(names.values()) + ["Not yet"], "who to trust: bo'sun, rogue, bartender, or not yet")
    g.shot("11-who-to-trust")
    if full:
        g.choose("Not yet")
        u = g.ui()
        check(u["beat"] == 6 and not u["ended"] and not u["active"], '"Not yet" closes without ending')
        g.talk_to("bosun")
        g.read()
    g.choose(names[trust], via="arrows" if kb else None)
    g.read()
    pages = {"theft": "It says someone stole 150 pieces of eight.", "miscount": "It says the bo'sun counted wrong.", "nothing": "It says nothing. It is only paper."}
    check(g.ui()["choices"] == list(pages.values()), "what the page says: three readings offered")
    g.shot("12-what-the-page-says")
    g.choose(pages[says])
    u = g.ui()
    check(not u["ended"] and u["pending"], "ending lines start; game not yet marked ended")
    text, n = g.read(expect_beat=6, expect_ended=False)
    marks = {"bosun": "I keep the count", "rogue": "Paid for, not given", "bartender": "I never saw it"}
    check(marks[trust] in text and all(m not in text for k, m in marks.items() if k != trust), f"ending plays the {trust} lines and no one else's")
    check(("My cut" in text) == (trust == "rogue"), "the rogue names his cut only if you paid him with the page")
    check("Thank you for playing" in text, "closing line shown")
    u = g.ui()
    holder = {"bosun": "bo'sun has it", "rogue": "rogue has it", "bartender": "under the bar"}[trust]
    check(u["ended"] and not u["active"] and u["holder"] == holder, f'after the last line: ended, banner says the end, page: "{holder}"')
    time.sleep(0.2)
    g.shot("13-the-end")
    check(g.go((775, 430), BOSUN), "after the end he can still walk")
    g.talk_to("bosun")
    _, n = g.read()
    check(n == 1 and not g.ui()["active"] and g.ui()["ended"], "after the end he can still talk; fallback line only")

    # ---------------- Whole run ----------------
    hist = g.js("b.state.history")
    check([h["beat"] for h in hist] == [2, 3, 4, 5, 6, "end"], "story moved exactly six times, in order, each on a player choice")
    check(g.js("b.state.factViolations.length") == 0, "checker pass flagged no line")
    if not os.environ.get("BB_EXPECT_LLM"):
        check(g.js("b.llm.checked") and not g.js("b.llm.enabled"), "LLM layer is off (no API key on the server)")
        check(g.js("b.director.calls") == 0 and g.js("b.director.shown.llm") == 0, "zero LLM calls were made in the whole run")
        check(len(g.sources) > 40 and all(src == "script" for _, _, _, src in g.sources), f"all {len(g.sources)} spoken lines were hard-coded lines")
        check(g.js("b.director.rejected.length") == 0, "the orchestrator checked every NPC line and rejected none")
    with open(os.path.join(SHOTS, f"{g.tag}-transcript.txt"), "w") as f:
        f.write("\n".join(f"[beat {b}] {t}" for b, t in g.seen) + "\n")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME if os.path.exists(CHROME) else None,
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
        )

        def open_page(ctx, url):
            page = ctx.new_page()
            page.on("console", lambda m: problems.append("browser error: " + m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: problems.append("page error: " + str(e)))
            page.goto(url)
            page.wait_for_function("window.__bb && window.__bb.ready", timeout=15000)
            time.sleep(0.3)
            return page

        ctx = browser.new_context(viewport={"width": 960, "height": 540})
        page = open_page(ctx, URL)
        play(Keyboard(page, "keys"), full=True, trust="bosun", says="theft")
        ctx.close()

        ctx = browser.new_context(viewport={"width": 844, "height": 390}, has_touch=True, is_mobile=True, device_scale_factor=2)
        page = open_page(ctx, URL)
        play(Touch(page, "touch", ctx.new_cdp_session(page)), full=True, trust="rogue", says="nothing")
        ctx.close()

        ctx = browser.new_context(viewport={"width": 960, "height": 540})
        page = open_page(ctx, URL + "?seed=7")
        g = Keyboard(page, "keys-short")
        check(g.js("b.state.setup.seed") == 7, "?seed=7 is used for the setup roll")
        play(g, full=False, trust="bartender", says="miscount")
        ctx.close()
        browser.close()

    print(f"\n{checks} checks. " + ("ALL CHECKS PASSED." if not problems else f"{len(problems)} PROBLEM(S):"))
    for e in problems:
        print("  - " + e)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
