#!/usr/bin/env node
/*
  Deployment cache generator.

  Generates:
    - config/index.json    (discovery index, used when no directory listing exists)
    - config/manifest.json (full manifest cache)

  Design goals:
    - Run the *same* browser code paths as production (fetch, URL resolution, etc.)
    - Treat both files as optional deployment artifacts
    - Minimal verification: existence, non-empty, JSON parse, basic shape
*/

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { chromium } from "playwright";

// Ephemeral same-origin base document for module imports (not checked in).
const BLANK_NAME = ".cache-generator-blank.html";

const ROOT = process.cwd();
const CONFIG_DIR = path.join(ROOT, "config");
const INDEX_PATH = path.join(CONFIG_DIR, "index.json");
const MANIFEST_PATH = path.join(CONFIG_DIR, "manifest.json");
const BLANK_PATH = path.join(ROOT, BLANK_NAME);

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8000);
const BASE_URL = `http://${HOST}:${PORT}`;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function existsOnPath(cmd) {
  const which = process.platform === "win32" ? "where" : "which";
  const res = spawnSync(which, [cmd], { stdio: "ignore" });
  return res.status === 0;
}

function pickPython() {
  // Prefer python3 where available
  if (existsOnPath("python3")) return "python3";
  if (existsOnPath("python")) return "python";
  return null;
}

function verifyJsonFile(filePath, shape) {
  if (!fs.existsSync(filePath)) {
    fail(`[generate-cache] Expected file not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (stat.size <= 0) {
    fail(`[generate-cache] File is empty: ${filePath}`);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    fail(`[generate-cache] File is not valid JSON: ${filePath}\n${e}`);
  }

  if (shape === "array") {
    if (!Array.isArray(data)) {
      fail(`[generate-cache] Expected JSON array in ${filePath}`);
    }
    return data;
  }

  if (shape === "object") {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      fail(`[generate-cache] Expected JSON object in ${filePath}`);
    }
    return data;
  }

  return data;
}

function ensureBlankHtmlExists() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Cache generator blank</title>
</head>
<body>
  <!-- Intentionally minimal: used as a same-origin base URL for Playwright module imports. -->
</body>
</html>
`;

  // Create it if missing; if it already exists (e.g. leftover from a prior run),
  // do not fail - it will be cleaned up at the end of this run.
  try {
    fs.writeFileSync(BLANK_PATH, html, { encoding: "utf8", flag: "wx" });
  } catch (e) {
    // EEXIST is fine; anything else should still surface.
    if (!e || e.code !== "EEXIST") throw e;
  }
}

async function waitForHttpOk(url) {
  // Minimal retry loop for server startup.
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.SERVER_START_TIMEOUT_MS ?? 4000);

  // Use global fetch (Node 18+). If unavailable, fail fast.
  if (typeof fetch !== "function") {
    fail("[generate-cache] Node.js must support global fetch (Node 18+). ");
  }

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  fail(`[generate-cache] Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function main() {
  if (!fs.existsSync(CONFIG_DIR) || !fs.statSync(CONFIG_DIR).isDirectory()) {
    fail(`[generate-cache] Missing config directory: ${CONFIG_DIR}`);
  }
  ensureBlankHtmlExists();

  const python = pickPython();
  if (!python) {
    fail("[generate-cache] Missing Python (python3/python). Install Python 3 to run the local http server.");
  }

  // Ensure Playwright can actually launch a browser.
  // If this fails, the error message points the user to: npx playwright install chromium
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (e) {
    fail(
      "[generate-cache] Playwright could not launch Chromium.\n" +
        "Install browsers with: npx playwright install chromium\n\n" +
        String(e)
    );
  }

  // Force regeneration.
  for (const p of [INDEX_PATH, MANIFEST_PATH]) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // ignore
    }
  }

  console.log(`[generate-cache] Using python: ${python}`);
  console.log(`[generate-cache] Serving ${ROOT} at ${BASE_URL}`);

  const server = spawn(python, ["-m", "http.server", String(PORT), "--bind", HOST], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Best-effort: surface server errors if it fails to start.
  server.stderr.on("data", (d) => {
    const s = String(d).trim();
    if (s) console.error(`[http.server] ${s}`);
  });

  try {
    await waitForHttpOk(`${BASE_URL}/`);
    await waitForHttpOk(`${BASE_URL}/config/`);

    // Generate config/index.json (discovery index)
    {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      // Avoid loading the full page (which triggers extra asset requests).
      // We only need an origin context for module imports and fetches.
      await page.goto(`${BASE_URL}/${BLANK_NAME}`, { waitUntil: "domcontentloaded" });

      const entries = await page.evaluate(async () => {
        const { getConfigIndex } = await import("/config-discovery.js");
        // index.json has been deleted, so this will fall back to /config/ autoindex parsing.
        return await getConfigIndex({
          manifestUrl: "/config/index.json",
          autoindexUrl: "/config/",
        });
      });

      await page.close();
      await browser.close();

      fs.writeFileSync(INDEX_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");
      verifyJsonFile(INDEX_PATH, "array");
      console.log(`[generate-cache] Wrote ${path.relative(ROOT, INDEX_PATH)} (${entries.length} entries)`);
    }

    // Generate config/manifest.json (full cache)
    {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      // Avoid loading the full page (which triggers extra asset requests).
      // We only need an origin context for module imports and fetches.
      await page.goto(`${BASE_URL}/${BLANK_NAME}`, { waitUntil: "domcontentloaded" });

      const manifest = await page.evaluate(async () => {
        const { getManifestSlow, createManifest } = await import("/getManifest.js");
        const entries = await new Promise((resolve) => {
          getManifestSlow(resolve, {
            discoveryOptions: {
              manifestUrl: "/config/index.json",
              autoindexUrl: "/config/",
            },
          });
        });
        return createManifest(entries);
      });

      await page.close();
      await browser.close();

      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
      verifyJsonFile(MANIFEST_PATH, "object");
      console.log(`[generate-cache] Wrote ${path.relative(ROOT, MANIFEST_PATH)}`);
    }
  } finally {
    // Stop server
    server.kill("SIGTERM");

    // Clean up the ephemeral blank HTML file.
    try {
      fs.rmSync(BLANK_PATH, { force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  fail(String(e));
});
