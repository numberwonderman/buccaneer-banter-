// Browser side of the LLM layer. It never sees an API key.
//
// The key lives only in the environment of the local server (serve.js). This
// file asks that server two things:
//   GET  api/status    is the LLM layer switched on?
//   POST api/npc-line  one in-the-moment line for one NPC
// On a static host (GitHub Pages, python -m http.server) neither address
// exists, so the layer stays off and the game plays on its hard-coded lines.
// Nothing here throws to the game or shows the player an error.

export const llm = {
  enabled: false,
  checked: false,
  session: (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2)) + "",
  // One call. Resolves to { action, line } or throws.
  async request(payload, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch("api/npc-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, session: llm.session }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = new Error("no line");
        err.capReached = res.status === 429;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  },
};

// Ask once, at start-up, whether a server with a key is behind this page.
// ?llm=off in the address keeps the layer off even when it is available.
export async function initLLM() {
  try {
    if (new URLSearchParams(location.search).get("llm") === "off") return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("api/status", { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok || !(res.headers.get("Content-Type") || "").includes("json")) return false;
    const info = await res.json();
    llm.enabled = info.llm === true;
  } catch {
    llm.enabled = false;
  } finally {
    llm.checked = true;
  }
  return llm.enabled;
}
