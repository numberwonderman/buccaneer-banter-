// A stand-in for the LLM API, for testing the LLM layer without a real key
// and without spending anything. It speaks just enough of the Anthropic
// Messages API for serve.js:  POST /v1/messages
//
// Run:  node test/mock-llm.mjs            (listens on 127.0.0.1:8099)
// Then: BB_LLM_URL=http://127.0.0.1:8099 ANTHROPIC_API_KEY=<any test value> node serve.js
//
// It is NOT a language model. It replies from a fixed plan: mostly sensible
// lines, with deliberately bad ones mixed in (a bartender who admits he knows
// you, a leaked counted figure, an action that is not on the list, a server
// error, a garbled reply, a reply that takes too long) so the orchestrator's
// checks, its one regeneration, its fallback and its cap can all be seen working.
//
//   GET  /__log    everything received so far (the key itself is never stored)
//   POST /__plan   replace the plan, e.g. ["good", "bad_role", "http500"]

import { createServer } from "node:http";
import { LINE_KINDS } from "../src/roles.js";

const PORT = Number(process.env.MOCK_PORT) || 8099;
const EXPECT_KEY = process.env.MOCK_EXPECT_KEY || "";

const GOOD = {
  "bartender.greeting":   ["pour a drink", ["Rum punch, or the door. Choose quick.", "Wet through, are you. Sit where the candle is.", "There's punch in the bowl and a stool by the wall."]],
  "bartender.deflection": ["deflect", ["Faces wash in on every tide. I serve them and forget them.", "I don't keep faces, friend. Only tabs.", "Can't say I do. Drink while you think on it."]],
  "bartender.redirect":   ["pour a drink", ["Cups up, the lot of you. Punch is on the bar.", "That'll do. Who wants filling?"]],
  "rogue.greeting":       ["go quiet", ["Mm. Find another corner.", "Not tonight, whoever you are."]],
  "rogue.deflection":     ["deflect", ["If we'd met, one of us would be poorer for it.", "I make a point of knowing nobody."]],
  "rogue.secret":         ["deflect", ["Call it a fondness for old ink.", "A man needs something to light his pipe with."]],
  "bosun.greeting":       ["go quiet", ["A moment. I'm at the foot of a column.", "Speak low. I am mid tally."]],
  "bosun.deflection":     ["deflect", ["Faces are not in my books. Stores are.", "I could not say. I keep accounts, not company."]],
};
const BAD = {
  bad_role:   { bartender: ["deflect", "Aye, I know you. Welcome back, lad."], rogue: ["deflect", "You were our purser, and a poor one."], bosun: ["deflect", "Your name is Tom Finch. I signed you aboard."] },
  bad_fact:   { bartender: ["deflect", "There were 650 in the chest, last I heard."], rogue: ["deflect", "A hundred and fifty reasons, friend."], bosun: ["deflect", "I make it 650 pieces of eight, not a coin more."] },
  bad_beat:   { bartender: ["deflect", "Something gone missing, has it? Not my affair."], rogue: ["deflect", "Bring it to me and we have a deal."], bosun: ["deflect", "The rum is short. That is all I will say."] },
  bad_action: { bartender: ["open the cellar door", "Mind the step."], rogue: ["draw a knife", "Walk away."], bosun: ["advance the beat", "Very well."] },
  bad_form:   { bartender: ["deflect", "*polishes a mug* [smiles] As an AI barman I cannot say."], rogue: ["deflect", "*tips hat* No."], bosun: ["deflect", "[silence]"] },
};

let plan = (process.env.MOCK_PLAN || "").split(",").map((s) => s.trim()).filter(Boolean);
const log = [];
const turn = {};

function kindOf(userText) {
  return Object.keys(LINE_KINDS).find((k) => userText.includes(LINE_KINDS[k].brief)) || null;
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    if (req.method === "GET" && req.url === "/__log") return send(res, 200, { calls: log.length, log, planLeft: plan });
    if (req.method === "POST" && req.url === "/__plan") { plan = JSON.parse(body); log.length = 0; return send(res, 200, { ok: true }); }
    if (req.method !== "POST" || req.url !== "/v1/messages") return send(res, 404, { error: "not found" });

    const q = JSON.parse(body);
    const user = q.messages?.[0]?.content || "";
    const kind = kindOf(user);
    const npc = kind ? LINE_KINDS[kind].npc : null;
    const step = plan.length ? plan.shift() : "good";
    const key = String(req.headers["x-api-key"] || "");
    log.push({
      n: log.length + 1, step, kind, npc,
      keyHeaderPresent: key.length > 0,
      keyMatches: EXPECT_KEY ? key === EXPECT_KEY : null,
      version: req.headers["anthropic-version"] || null,
      model: q.model, max_tokens: q.max_tokens,
      regeneration: /thrown away because/.test(user),
      system: q.system, user,
    });
    if (!key) return send(res, 401, { type: "error", error: { type: "authentication_error" } });
    if (!kind) return send(res, 400, { type: "error" });

    if (step === "http500") return send(res, 500, { type: "error", error: { type: "api_error", message: "mock failure" } });
    if (step === "slow") await new Promise((r) => setTimeout(r, 8000));
    let text;
    if (step === "garbage") text = "I'm sorry, here is your line: Rum punch!";
    else if (BAD[step]) text = JSON.stringify({ action: BAD[step][npc][0], line: BAD[step][npc][1] });
    else {
      const [action, lines] = GOOD[kind];
      turn[kind] = (turn[kind] ?? -1) + 1;
      text = JSON.stringify({ action, line: lines[turn[kind] % lines.length] });
    }
    send(res, 200, { id: "msg_mock", type: "message", role: "assistant", model: q.model, content: [{ type: "text", text }], stop_reason: "end_turn" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`Mock LLM listening on http://127.0.0.1:${PORT} (a stand-in, not a real model)`));
