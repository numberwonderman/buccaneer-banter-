// Tiny local web server so the game's JavaScript modules load in a browser.
// No packages needed:  node serve.js   then open http://localhost:8080
//
// To play on a phone on the same Wi-Fi:  node serve.js --phone
// That lets other devices on your network reach it, and prints the address
// to type into the phone. Without --phone only this computer can connect.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

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

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
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
  if (PHONE) {
    const addrs = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal);
    for (const a of addrs) console.log(`On your phone (same Wi-Fi), open http://${a.address}:${PORT}`);
    if (!addrs.length) console.log("No network address found. Is this computer on Wi-Fi?");
  }
  console.log("Press Ctrl+C here to stop.");
});
