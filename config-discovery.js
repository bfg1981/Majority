/**
 * Config discovery for governing-body JSON files.
 *
 * Browser-only, no Node dependencies.
 *
 * Behavior:
 *  1. Try to fetch a JSON manifest (e.g. /config/index.json).
 *  2. If that fails, fall back to parsing an autoindex HTML at /config/.
 *
 * This works out of the box with:
 *  - python -m http.server
 *  - Apache mod_autoindex
 *  - Any static host that exposes a directory listing
 */

/**
 * @typedef {Object} ConfigEntry
 * @property {string} file   - Path to the JSON file (relative or absolute URL).
 * @property {string} label  - Human-readable label for UI.
 */

/**
 * Get a list of available config JSON files.
 *
 * @param {Object} [options]
 * @param {string} [options.manifestUrl="/config/index.json"]
 *        URL to a JSON manifest, if a backend (or build step) provides one.
 * @param {string} [options.autoindexUrl="/config/"]
 *        URL to a directory listing (mod_autoindex, python http.server, etc.).
 * @param {(file: string) => string} [options.inferLabel]
 *        Function to turn a filename into a nice label.
 *
 * @returns {Promise<ConfigEntry[]>}
 */
export async function getConfigIndex(options = {}) {
  const {
    manifestUrl = "/config/index.json",
    autoindexUrl = "/config/",
    inferLabel = defaultInferLabel,
  } = options;

  // 1) Try JSON manifest first (runtime backend or build-time manifest).
  const fromManifest = await tryLoadManifest(manifestUrl, inferLabel);
  if (fromManifest) {
    return fromManifest;
  }

  // 2) Fallback: parse HTML autoindex.
  return loadFromAutoindex(autoindexUrl, inferLabel);
}

/* ---------- Manifest (JSON) path ---------- */

async function tryLoadManifest(manifestUrl, inferLabel) {
  try {
    const res = await fetch(manifestUrl, {
      headers: { Accept: "application/json,*/*;q=0.8" },
    });

    if (!res.ok) {
      // 404 or other error => no manifest, fall back
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // Something else (e.g. HTML) served at this URL => treat as absent
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      // Not the shape we expect; ignore it
      return null;
    }

    // Normalize entries into { file, label }
    const entries = data
      .map((item) => {
        if (typeof item === "string") {
          return { file: item, label: inferLabel(item) };
        }
        if (!item || typeof item.file !== "string") return null;
        return {
          file: item.file,
          label:
            typeof item.label === "string"
              ? item.label
              : inferLabel(item.file),
        };
      })
      .filter(Boolean);

    if (!entries.length) {
      // Empty manifest is technically valid; we accept it
      return entries;
    }

    return entries;
  } catch (err) {
    // Network error, CORS, etc. => just fall back
    console.warn(
      "[config-discovery] Failed to load manifest, falling back to autoindex:",
      err
    );
    return null;
  }
}

/* ---------- Autoindex (HTML) path ---------- */

async function loadFromAutoindex(autoindexUrl, inferLabel) {
  const res = await fetch(autoindexUrl, {
    headers: { Accept: "text/html,*/*;q=0.8" },
  });

  if (!res.ok) {
    throw new Error(
      `[config-discovery] Failed to load autoindex from ${autoindexUrl}: HTTP ${res.status}`
    );
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Collect all anchors; different servers generate different structures
  const anchors = Array.from(doc.querySelectorAll("a"));
  const seen = new Set();
  const entries = [];

  for (const a of anchors) {
    const href = (a.getAttribute("href") || "").trim();
    if (!href) continue;

    // Skip parent directory links and query strings
    if (href === "../") continue;
    if (href.includes("?")) continue;

    // We care only about JSON configs
    if (!href.toLowerCase().endsWith(".json")) continue;

    // Normalize to a path relative to autoindexUrl
    const file = normalizeHref(autoindexUrl, href);
    if (seen.has(file)) continue;
    seen.add(file);

    entries.push({
      file,
      label: inferLabel(file),
    });
  }

  return entries;
}

function normalizeHref(baseUrl, href) {
  // If href is absolute (starts with http or /), use as-is
  if (/^https?:\/\//i.test(href) || href.startsWith("/")) {
    return href;
  }
  // Otherwise, treat as relative to baseUrl
  try {
    const u = new URL(href, baseUrl);
    return u.pathname + u.search + u.hash;
  } catch {
    // Fallback: naive concatenation
    if (!baseUrl.endsWith("/")) {
      return `${baseUrl}/${href}`;
    }
    return baseUrl + href;
  }
}

/* ---------- Label inference ---------- */

function defaultInferLabel(file) {
  // Strip directories
  const parts = file.split("/");
  const name = parts[parts.length - 1] || file;

  // Strip extension
  const withoutExt = name.replace(/\.json$/i, "");

  // Very light normalization: replace underscores with spaces
  // e.g. "no_storting_2025_2029" -> "no storting 2025 2029"
  const base = withoutExt.replace(/[_-]+/g, " ");

  // Capitalize first letter
  return base.charAt(0).toUpperCase() + base.slice(1);
}

