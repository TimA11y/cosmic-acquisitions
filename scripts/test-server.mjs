// Dependency-free static file server used only by Playwright's `webServer`
// config during BDD test runs. The shipped game itself is still meant to be
// opened directly as a file:// URL (R3) — this server exists purely because
// Chromium refuses to fetch ES module dependencies (`<script type="module">`
// pulling in js/model/index.js's own imports) when the *top-level* page was
// itself opened via file://, since module fetches require CORS and file://
// origins don't satisfy it. Serving over http:// sidesteps that restriction
// without changing anything about how end users run the real game.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.cwd();
const PORT = process.env.PORT || 4321;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  // Normalize and strip any ".." segments so a request can't escape ROOT.
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);

  try {
    const data = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});
