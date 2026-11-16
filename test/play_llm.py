"""Plays beats 1-6 in a real (headless) Chrome with the LLM layer switched ON,
against the stand-in LLM in test/mock-llm.mjs. No real key, no real model,
nothing spent.

What this proves: the plumbing and the orchestrator. Generated lines reach the
screen only if they pass the checks; a rejected line is regenerated once; a
second rejection, a failed call, a garbled reply and a slow reply all end in
the hard-coded line with nothing shown to the player; the session never makes
more than 20 calls; the key never reaches the browser.

What this does NOT prove: how a real model behaves. That needs a real key.

Run:  python3 test/play_llm.py
It starts its own copy of the game (port 8081) and the stand-in (port 8099).
Needs:  pip install playwright   and Google Chrome (BB_CHROME to set its path).
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

os.environ["BB_EXPECT_LLM"] = "1"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import play_beats as pb  # noqa: E402
from play_beats import Keyboard, check, DOOR, BOSUN, ROGUE, BAR, LANE, HIDDEN, SHOTS, CHROME  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

GAME = "http://127.0.0.1:8081/"
MOCK = "http://127.0.0.1:8099"
TEST_KEY = "bb-test-key-not-a-real-key-7f3a91"  # made up; only the stand-in ever sees it
CAP = 20
NPCS = ("Bartender", "Rogue", "Bo'sun")

# The stand-in's replies, call by call, for the long run.
PLAN = [
    "good",                    # 1  bo'sun greeting
    "bad_fact", "good",        # 2-3  bo'sun deflection: leaks a counted figure, then regenerated
    "good",                    # 4  rogue greeting
    "bad_role", "bad_beat",    # 5-6  rogue deflection: rejected twice -> hard-coded line
    "good",                    # 7  bartender greeting
    "bad_role", "good",        # 8-9  bartender admits he knows you, then regenerated
    "http500",                 # 10 the API fails -> hard-coded line
    "garbage",                 # 11 not the JSON asked for -> hard-coded line
    "slow",                    # 12 takes too long -> hard-coded line
    "good",                    # 13
    "bad_action", "good",      # 14-15 action not on the list, then regenerated
    "bad_form", "good",        # 16-17 stage directions and "As an AI", then regenerated
    "good",                    # 18 bartender breaks the tension
    "bad_role", "bad_fact",    # 19-20 rejected twice -> hard-coded line; the cap is now spent
    "good", "good", "good", "good", "good",  # never asked for
]
BAD_TEXT = ["Welcome back", "Aye, I know you", "purser", "Tom Finch", "650 in the chest", "hundred and fifty", "not a coin more",
            "gone missing", "we have a deal", "rum is short", "Mind the step", "polishes", "As an AI", "tips hat", "Rum punch!"]

no_proxy = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def http(method, url, body=None, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with no_proxy.open(req, timeout=15) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def mock_log():
    return json.loads(http("GET", MOCK + "/__log")[1])


def spoken(g, expect_beat=None):
    """Read to the next choice list. Returns (all text, [(speaker, text, source), ...])."""
    before = len(g.sources)
    text, _ = g.read(expect_beat=expect_beat)
    return text, [(sp, t, src) for _, sp, t, src in g.sources[before:]]


def npc_line(g, who, expect, label, expect_beat=None):
    text, lines = spoken(g, expect_beat)
    mine = [(t, src) for sp, t, src in lines if sp == who]
    got = mine[0][1] if mine else None
    check(got == expect, f"{label}: shown line is {'a generated line' if expect == 'llm' else 'the hard-coded line'} (source: {got})")
    return mine[0][0] if mine else ""


def stats(g):
    return g.js("({calls: b.director.calls, llm: b.director.shown.llm, fallback: b.director.shown.fallback, "
                "regenerated: b.director.regenerated, rejected: b.director.rejected.length, actions: b.director.actions})")


def long_run(g):
    print("\n===== LLM layer ON: long run, with bad replies mixed in =====")
    check(g.js("b.llm.checked && b.llm.enabled") is True, "the game found the LLM layer switched on")
    g.read()
    g.choose("Put it away and stand up")
    check(g.go(DOOR), "walks to the tavern door")
    g.talk_to("door")
    g.read()
    g.choose("Go inside")
    time.sleep(0.3)
    _, lines = spoken(g, 2)
    check(len(lines) == 6 and all(src == "script" for _, _, src in lines), "beat 2 entrance: six written lines, none generated (they are the story, not banter)")
    check(stats(g)["calls"] == 0, "no LLM call yet: beat 1 and the entrance are hard-coded")

    print("Beat 2")
    check(g.go(BOSUN), "walks to the bo'sun")
    g.talk_to("bosun")
    t = npc_line(g, "Bo'sun", "llm", "call 1, bo'sun greeting")
    check("column" in t or "tally" in t, f'the generated line is on screen: "{t}"')
    g.shot("01-generated-line")
    g.choose("Do you know me?")
    t = npc_line(g, "Bo'sun", "llm", "calls 2-3, bo'sun leaked a counted figure in beat 2, regenerated once")
    check("650" not in t and stats(g)["calls"] == 3 and stats(g)["regenerated"] == 1, "the leaked 650 never reached the screen; exactly one extra call")
    g.choose("Leave him to it")

    check(g.go(ROGUE), "walks to the rogue")
    g.talk_to("rogue")
    npc_line(g, "Rogue", "llm", "call 4, rogue greeting")
    g.choose("Do I know you?")
    t = npc_line(g, "Rogue", "fallback", "calls 5-6, rogue line rejected twice")
    check(t == "If you knew me, you'd know better than to ask." and stats(g)["calls"] == 6, f'the hard-coded deflection is shown instead: "{t}"')
    g.choose("Walk away")

    check(g.go(BAR), "walks to the bar")
    g.talk_to("bartender")
    npc_line(g, "Bartender", "llm", "call 7, bartender greeting")
    g.choose("Do you know me?")
    t = npc_line(g, "Bartender", "llm", "calls 8-9, bartender admitted he knows you, regenerated once")
    check("know you" not in t.lower() and "welcome back" not in t.lower(), f'the admission never reached the screen; shown: "{t}"')
    g.choose("Do you know me?")
    npc_line(g, "Bartender", "fallback", "call 10, the API answered with an error")
    g.choose("Do you know me?")
    npc_line(g, "Bartender", "fallback", "call 11, the reply was not in the form asked for")

    g.choose("Do you know me?")  # call 12: the slow one
    t0 = time.time()
    time.sleep(0.4)
    u = g.ui()
    check(u["mode"] == "wait" and u["speaker"] == "Bartender" and u["text"] == "...", 'while waiting, the box shows the speaker and "..."')
    g.shot("02-waiting")
    for _ in range(6):
        g.page.keyboard.press("e")
        time.sleep(0.05)
    g.page.keyboard.press("1")
    u = g.ui()
    check(u["mode"] == "wait" and u["node"] == "bar2_know" and u["beat"] == 2, "E and number keys do nothing while a line is on its way")
    t = npc_line(g, "Bartender", "fallback", "call 12, the reply took too long")
    waited = time.time() - t0
    check(waited < 9.5, f"the wait ended by itself after {waited:.1f} s (limit 9 s) and the hard-coded line appeared")
    g.choose("Do you know me?")
    npc_line(g, "Bartender", "llm", "call 13, bartender deflection")
    check(stats(g)["calls"] == 13, "13 calls so far")
    g.shot("03-bartender")
    g.choose("Take the page from your pocket and lay it on the bar")

    print("Beat 3")
    check(g.ui()["beat"] == 3, "laying the page on the bar still advances to beat 3")
    _, lines = spoken(g, 3)
    check(all(src == "script" for _, _, src in lines), "the page-surfaces lines are written, not generated")
    g.talk_to("bartender")
    npc_line(g, "Bartender", "llm", "calls 14-15, action not on his list, regenerated once")
    g.choose("Do you know me?")
    t = npc_line(g, "Bartender", "llm", "calls 16-17, stage directions and 'As an AI', regenerated once")
    check("*" not in t and "AI" not in t, "no stage directions or out-of-world words on screen")
    g.choose("Leave him be")
    check(g.go(LANE, BOSUN), "walks to the bo'sun")
    g.talk_to("bosun")
    g.read()
    g.choose("Show him the page")
    text, lines = spoken(g, 3)
    red = [(t, src) for sp, t, src in lines if sp == "Bartender"]
    check(len(lines) == 9 and red and red[0][1] == "llm", f'call 18: nine quiet lines; the bartender\'s tension-breaker is generated: "{red[0][0] if red else ""}"')
    check("The bo'sun goes very quiet." in text and "40 barrels" in text and "800 pieces of eight" in text, "the written beat-3 lines and figures are unchanged")
    u = g.ui()
    check(u["beat"] == 4 and not u["active"], "beat 4 begins only after the last line, as before")

    print("Beat 4")
    check(g.go(ROGUE) and g.go(BAR), "walks back to the bar")
    g.talk_to("bartender")
    t = npc_line(g, "Bartender", "fallback", "calls 19-20, rejected twice")
    s = stats(g)
    check(s["calls"] == CAP and not g.js("b.llm.enabled && b.director.calls < b.director.cap"), f"the cap is spent: {s['calls']} of {CAP} calls")
    g.shot("04-cap-reached")
    g.choose("Do you know me?")
    npc_line(g, "Bartender", "script", "after the cap, the bartender's line is hard-coded and instant")
    g.choose("Leave him be")
    check(g.go(LANE, ROGUE), "walks to the rogue's corner")
    g.talk_to("rogue")
    text, _ = spoken(g, 4)
    check("Bring it to me" in text, "the rogue makes his written offer")
    whys = []
    for _ in range(3):
        g.choose("Why do you want it?")
        whys.append(npc_line(g, "Rogue", "script", "after the cap, the rogue's deflection is hard-coded"))
    check(len(set(whys)) == 3, "three different hard-coded deflections, as before")
    g.choose("Refuse. Let the bo'sun read it.")
    check(g.ui()["beat"] == 5, "refusing the rogue advances to beat 5")
    g.read(expect_beat=5)

    print("Beat 5")
    check(g.go(BOSUN), "walks back to the bo'sun")
    g.talk_to("bosun")
    g.read()
    g.choose("Ask him to read it aloud")
    text, lines = spoken(g, 5)
    check("I counted 28" in text and "12 barrels short" in text and "60 hogsheads written, 60 counted" in text
          and "It says 800 pieces. There are 650. 150 pieces of eight are missing." in text, "the bo'sun reads the true figures: 28, 12, 60/60, 650, 150")
    check(all(src == "script" for _, _, src in lines), "the reading is written, not generated")
    g.shot("05-bosun-reads")
    g.choose("Step back and make up your mind")

    print("Beat 6")
    check(g.ui()["beat"] == 6, "stepping back advances to beat 6")
    g.read(expect_beat=6)
    g.choose("Trust the bo'sun")
    g.read()
    g.choose("It says someone stole 150 pieces of eight.")
    text, _ = spoken(g, 6)
    check("I keep the count" in text and "Thank you for playing" in text and "My cut" not in text, "ending plays; the rogue keeps his secret")
    u = g.ui()
    check(u["ended"] and not u["active"], "the game ended after the last line")
    g.shot("06-the-end")

    print("Whole run")
    s = stats(g)
    log = mock_log()
    check(log["calls"] == CAP and s["calls"] == CAP, f"the stand-in received exactly {log['calls']} calls; the game counted {s['calls']}; the cap is {CAP}")
    check(s["llm"] == 9 and s["fallback"] == 5 and s["regenerated"] == 6 and s["rejected"] == 8,
          f"9 generated lines shown, 5 fell back, 6 regenerations, 8 lines rejected (got {s['llm']}, {s['fallback']}, {s['regenerated']}, {s['rejected']})")
    shown = [src for _, sp, _, src in g.sources if sp in NPCS]
    check(shown.count("llm") == 9, f"{len(shown)} NPC lines were spoken: {shown.count('llm')} generated, {shown.count('fallback')} fell back, {shown.count('script')} written")
    everything = "\n".join(t for _, t in g.seen)
    check(not any(b in everything for b in BAD_TEXT), "none of the stand-in's 9 bad replies ever appeared on screen")
    early = "\n".join(t for b, t in g.seen if b <= 4)
    check(not any(h in early for h in HIDDEN), "beats 1-4 showed none of the counted figures (28, 12, 650, 150), generated lines included")
    check("cut" not in "\n".join(t for b, t in g.seen if b == 4).lower(), "beat 4: the rogue gave up nothing")
    visible = "\n".join(t for _, _, t, _ in g.sources)
    check(not any(w in visible for w in ["Error", "error", "undefined", "null", "LLM", "API", "{", "}", "[", "]", "fallback"]), "no error text or code ever appeared in the dialogue box")
    hist = g.js("b.state.history")
    check([h["beat"] for h in hist] == [2, 3, 4, 5, 6, "end"] and all(h["choice"] for h in hist), "story moved exactly six times, in order, each on a player choice")
    acts = s["actions"]
    allowed = {"pour a drink", "deflect", "ask about the page", "change the subject", "go quiet", "cut someone off"}
    check(len(acts) == 9 and all(a["action"] in allowed for a in acts), "each generated line came with one action from the NPC's fixed list: " + ", ".join(sorted({a["action"] for a in acts})))
    check(all(e["keyHeaderPresent"] and e["keyMatches"] and e["version"] for e in log["log"]), "every call carried the key from the server's environment to the stand-in")
    check(all(e["regeneration"] == (e["n"] in (3, 6, 9, 15, 17, 20)) for e in log["log"]), "the six regeneration requests told the model its last line was thrown away, and why")
    secrets = HIDDEN + ["silver", "pieces of eight", "my cut", "his cut"]
    check(not any(any(h in e["system"].replace("at most 160 characters", "") for h in secrets) for e in log["log"]),
          "none of the 20 briefs (all before beat 5) contained a counted figure, the silver, or the rogue's secret")
    with open(os.path.join(SHOTS, "llm-transcript.txt"), "w") as f:
        f.write("LLM layer ON, stand-in model (test/mock-llm.mjs). Source of each NPC line is shown in brackets.\n\n")
        for b, sp, t, src in g.sources:
            tag = f" <{src}>" if sp in NPCS else ""
            f.write(f"[beat {b}] {sp or '(narration)'}{tag}: {t}\n")
    return g.js("b.llm.session")


def short_run(g):
    print("\n===== LLM layer ON: short run, every reply good, rogue ending =====")
    g.read()
    g.choose("Put it away and stand up")
    g.go(DOOR)
    g.talk_to("door")
    g.read()
    g.choose("Go inside")
    time.sleep(0.3)
    g.read(expect_beat=2)
    g.go(BAR)
    g.talk_to("bartender")
    npc_line(g, "Bartender", "llm", "bartender greeting")
    g.choose("Take the page from your pocket and lay it on the bar")
    g.read(expect_beat=3)
    g.go(LANE, BOSUN)
    g.talk_to("bosun")
    g.read()
    g.choose("Show him the page")
    g.read(expect_beat=3)
    g.go(ROGUE)
    g.talk_to("rogue")
    g.read(expect_beat=4)
    g.choose("Why do you want it?")
    npc_line(g, "Rogue", "llm", "rogue asked why he wants the page")
    g.choose("Refuse. Let the bo'sun read it.")
    g.read(expect_beat=5)
    g.go(BOSUN)
    g.talk_to("bosun")
    g.read()
    g.choose("Ask him to read it aloud")
    text, lines = spoken(g, 5)
    check("150 pieces of eight are missing." in text and [src for sp, _, src in lines if sp == "Bartender"] == ["llm"], "the reading is written; the bartender's line after it is generated")
    g.choose("Step back and make up your mind")
    g.read(expect_beat=6)
    g.choose("Trust the rogue")
    g.read()
    g.choose("It says nothing. It is only paper.")
    text, _ = spoken(g, 6)
    check("My cut" in text and "Paid for, not given" in text, "trusting the rogue: his written confession passes the orchestrator, because he was paid with the page")
    check(g.ui()["ended"], "the game ended")
    s = stats(g)
    check(s["calls"] == 4 and s["llm"] == 4 and s["rejected"] == 0 and s["fallback"] == 0, f"4 calls, 4 generated lines, nothing rejected (got {s['calls']}, {s['llm']}, {s['rejected']})")
    g.go((775, 430), BOSUN)
    g.talk_to("bosun")
    g.read()
    g.go(ROGUE)
    g.talk_to("rogue")
    npc_line(g, "Rogue", "script", "after the end, lines are hard-coded")
    check(stats(g)["calls"] == 4, "no LLM call after the ending")
    check([h["beat"] for h in g.js("b.state.history")] == [2, 3, 4, 5, 6, "end"], "story moved exactly six times, in order")


def main():
    env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "BB_MODEL")}
    logs = {n: open(f"/tmp/bb-{n}.log", "w+") for n in ("mock", "game")}
    mock = subprocess.Popen(["node", "test/mock-llm.mjs"], cwd=ROOT, stdout=logs["mock"], stderr=subprocess.STDOUT,
                            env={**env, "MOCK_PORT": "8099", "MOCK_EXPECT_KEY": TEST_KEY})
    game = subprocess.Popen(["node", "serve.js"], cwd=ROOT, stdout=logs["game"], stderr=subprocess.STDOUT,
                            env={**env, "PORT": "8081", "ANTHROPIC_API_KEY": TEST_KEY, "BB_LLM_URL": MOCK})
    bodies = []
    console_errors = []
    page_errors = []
    try:
        time.sleep(1.2)
        code, body = http("GET", GAME + "api/status")
        check(code == 200 and json.loads(body) == {"llm": True, "cap": CAP}, f"server reports the LLM layer on, cap {CAP}: {body}")
        http("POST", MOCK + "/__plan", PLAN)

        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None,
                                        args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])

            def open_page(url):
                ctx = browser.new_context(viewport={"width": 960, "height": 540})
                page = ctx.new_page()
                page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: page_errors.append(str(e)))

                def grab(r):
                    try:
                        bodies.append((r.url, r.text()))
                    except Exception:
                        pass
                page.on("response", grab)
                page.goto(url)
                page.wait_for_function("window.__bb && window.__bb.ready && window.__bb.llm.checked", timeout=15000)
                time.sleep(0.3)
                return ctx, page

            ctx, page = open_page(GAME + "?debug=1")
            session = long_run(Keyboard(page, "llm"))
            ctx.close()

            print("\n===== The server's own guards =====")
            ask = {"session": session, "npc": "bartender", "kind": "bartender.greeting", "beat": 2, "attempt": 1}
            n0 = mock_log()["calls"]
            code, _ = http("POST", GAME + "api/npc-line", ask)
            check(code == 429 and mock_log()["calls"] == n0, "the server itself refuses a 21st call for that session (429); the stand-in was not called")
            code, _ = http("POST", GAME + "api/npc-line", {**ask, "session": "another"}, {"Origin": "http://evil.example"})
            check(code == 403 and mock_log()["calls"] == n0, "a request from another website is refused (403); no call made")
            code, _ = http("POST", GAME + "api/npc-line", {**ask, "session": "another", "npc": "rogue"})
            code2, _ = http("POST", GAME + "api/npc-line", {**ask, "session": "another", "kind": "narrator.idle"})
            code3, _ = http("POST", GAME + "api/npc-line", {**ask, "session": "another", "beat": 9})
            check((code, code2, code3) == (400, 400, 400) and mock_log()["calls"] == n0, "a request for a line that is not on the list is refused (400); no call made")

            http("POST", MOCK + "/__plan", [])
            ctx, page = open_page(GAME)
            short_run(Keyboard(page, "llm-short"))
            log2 = mock_log()
            check(log2["calls"] == 4, f"second session: the stand-in received {log2['calls']} calls")
            ctx.close()
            browser.close()

        print("\n===== The key =====")
        check(len(bodies) > 20 and not any(TEST_KEY in b for _, b in bodies), f"the key is in none of the {len(bodies)} responses the browser received (pages, scripts, API answers)")
        for f in logs.values():
            f.flush()
        out = open("/tmp/bb-game.log").read()
        check("LLM layer: ON" in out and TEST_KEY not in out, "the server's terminal output says the layer is on and does not contain the key")
        full = json.dumps(mock_log())
        check(TEST_KEY not in full, "the key is not in any brief sent to the model")
        check(not page_errors, f"no JavaScript errors in the page ({len(page_errors)})")
        other = [e for e in console_errors if "Failed to load resource" not in e]
        check(not other, "nothing else in the browser console: " + "; ".join(other[:3]) if other else
              f"browser console: only the {len(console_errors)} expected 'failed to load' notes for calls the stand-in failed on purpose (not visible to a player)")
    finally:
        mock.terminate()
        game.terminate()

    print(f"\n{pb.checks} checks. " + ("ALL CHECKS PASSED." if not pb.problems else f"{len(pb.problems)} PROBLEM(S):"))
    for e in pb.problems:
        print("  - " + e)
    sys.exit(1 if pb.problems else 0)


if __name__ == "__main__":
    main()
