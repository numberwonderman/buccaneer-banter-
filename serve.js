// Tiny local web server so the game's JavaScript modules load in a browser.
// No packages needed:  node serve.js   then open http://localhost:8080
//
// To play on a phone on the same Wi-Fi:  node serve.js --phone
// That lets other devices on your network reach it, and prints the address
// to type into the phone. Without --phone only this computer can connect.
//
// LLM layer (optional). If the environment variable ANTHROPIC_API_KEY is set,
// this server also answers the game's requests for in-the-moment NPC lines.
// The key is read from the environment only. It is never written to a file,
// never sent to the browser and never printed. With no key the game plays on
// its hard-coded lines, exactly as before.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { buildPrompt } from "./src/prompt.js";
import { ROLE_CARDS, LINE_KINDS } from "./src/roles.js";
import { LAST_BEAT } from "./src/beats.js";
import { MAX_CALLS_PER_SESSION, CALL_TIMEOUT_MS } from "./src/director.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const PHONE = process.argv.includes("--phone");
const HOST = PHONE ? "0.0.0.0" : "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
};

// ---------- LLM layer ----------

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim(); // environment only
const MODEL = process.env.BB_MODEL || "claude-haiku-5-5";
const LLM_URL = (process.env.BB_LLM_URL || "https://api.anthropic.com").replace(/\/+$/, "");
const NO_LLM = process.argv.includes("--no-llm");
const HAS_KEY = KEY.length > 0;
const LLM_ON = HAS_KEY && !NO_LLM;
// A second, coarser limit on top of the per-session cap: the most calls this
// server will make before it is restarted, however many sessions there are.
const MAX_CALLS_PER_SERVER_RUN = Number(process.env.BB_MAX_CALLS_TOTAL) || 200;

const sessions = new Map(); // session id -> calls made
let totalCalls = 0;

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too big")); req.destroy(); } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const clean = (s, max) => String(s ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, max);

async function npcLine(req, res) {
  // Only the game's own page may ask. Another website open in the same
  // browser cannot use this server to spend the key.
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: "forbidden" });
  if (!LLM_ON) return json(res, 503, { error: "off" });

  let q;
  try { q = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "bad request" }); }
  const session = clean(q.session, 64);
  const beat = Number(q.beat);
  const kind = String(q.kind);
  const npc = String(q.npc);
  if (!session || !ROLE_CARDS[npc] || LINE_KINDS[kind]?.npc !== npc || !(beat >= 2 && beat <= LAST_BEAT)) return json(res, 400, { error: "bad request" });

  // The cap, enforced here as well as in the browser.
  const used = sessions.get(session) || 0;
  if (used >= MAX_CALLS_PER_SESSION || totalCalls >= MAX_CALLS_PER_SERVER_RUN) return json(res, 429, { error: "cap" });
  if (!sessions.has(session) && sessions.size >= 500) sessions.delete(sessions.keys().next().value);
  sessions.set(session, used + 1);
  totalCalls++;

  const prompt = buildPrompt({
    npc, kind, beat,
    player: clean(q.player, 160),
    recent: (Array.isArray(q.recent) ? q.recent : []).slice(-4).map((r) => ({ speaker: clean(r?.speaker, 20), text: clean(r?.text, 200) })),
    reasons: (Array.isArray(q.reasons) ? q.reasons : []).slice(0, 3).map((r) => clean(r, 160)),
  });

  try {
    const up = await fetch(`${LLM_URL}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 150, system: prompt.system, messages: [{ role: "user", content: prompt.user }] }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (!up.ok) {
      console.log(`LLM call ${totalCalls}: the API answered ${up.status}. The game used a hard-coded line.`);
      return json(res, 502, { error: "no line" });
    }
    const data = await up.json();
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    const out = JSON.parse(m ? m[0] : text);
    console.log(`LLM call ${totalCalls} (${used + 1} of ${MAX_CALLS_PER_SESSION} this session): ${npc}, beat ${beat}.`);
    return json(res, 200, { action: clean(out.action, 40), line: String(out.line ?? "").slice(0, 600) });
  } catch (e) {
    // Never log the request itself: it carries the key in a header.
    console.log(`LLM call ${totalCalls}: no usable answer (${e?.name || "error"}). The game used a hard-coded line.`);
    return json(res, 502, { error: "no line" });
  }
}

// ---------- Web server ----------

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/api/status" && req.method === "GET") return json(res, 200, { llm: LLM_ON, cap: MAX_CALLS_PER_SESSION });
  if (path === "/api/npc-line" && req.method === "POST") return npcLine(req, res).catch(() => json(res, 500, { error: "no line" }));
  if (path.startsWith("/api/")) return json(res, 404, { error: "not found" });
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, HOST, () => {
  console.log(`Buccaneer Banter is running. Open http://localhost:${PORT} in your browser.`);
  if (LLM_ON) console.log(`LLM layer: ON. Key found in ANTHROPIC_API_KEY (not shown). Model ${MODEL}. Cap: ${MAX_CALLS_PER_SESSION} calls per play session.`);
  else if (HAS_KEY) console.log("LLM layer: OFF (--no-llm). The game plays on its hard-coded lines.");
  else console.log("LLM layer: OFF. ANTHROPIC_API_KEY is not set, so the game plays on its hard-coded lines.");
  if (PHONE) {
    const addrs = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal);
    for (const a of addrs) console.log(`On your phone (same Wi-Fi), open http://${a.address}:${PORT}`);
    if (!addrs.length) console.log("No network address found. Is this computer on Wi-Fi?");
  }
  console.log("Press Ctrl+C here to stop.");
});
