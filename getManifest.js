// getManifest.js
// Slow path: discover all config files and fetch them in parallel.
//
// Depends on config-discovery.js being available as an ES module
// exporting `getConfigIndex`.

import { getConfigIndex } from "./config-discovery.js";

/**
 * Discover all config files and load them in parallel, then call `onDone`.
 *
 * @param {(configs: Array<{file: string, config: any}>) => void} onDone
 *        Callback invoked once all fetches have either succeeded or failed.
 *        Only successful fetches are included in the array.
 * @param {Object} [options]
 * @param {Object} [options.discoveryOptions]
 *        Options passed through to getConfigIndex (e.g. manifestUrl/autoindexUrl).
 */
export async function getManifestSlow(onDone, options = {}) {
  const { discoveryOptions = {} } = options;

  // 1) Discover available config files (using config-discovery)
  const entries = await getConfigIndex(discoveryOptions);

  if (!entries || entries.length === 0) {
    console.warn("[getManifestSlow] No config entries discovered.");
    onDone([]);
    return;
  }

  // 2) Fetch all configs in parallel
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const res = await fetch(entry.file, {
        headers: { Accept: "application/json,*/*;q=0.8" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while loading ${entry.file}`);
      }
      const json = await res.json();
      return {
        file: entry.file,
        config: json,
      };
    })
  );

  const loaded = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const entry = entries[i];
    if (r.status === "fulfilled") {
      loaded.push(r.value);
    } else {
      console.warn(
        "[getManifestSlow] Failed to load config:",
        entry.file,
        r.reason
      );
    }
  }

  onDone(loaded);
}

/**
 * Build a manifest of the form:
 *
 * {
 *   "<id>": {
 *     "<period>": "<file>",
 *     ...
 *   },
 *   ...
 * }
 *
 * where `id` and `period` are taken from each config JSON, and `file`
 * is the URL/path discovered by config-discovery.
 *
 * @param {Array<{file: string, config: any}>} entries
 * @returns {Record<string, Record<string, string>>}
 */
export function createManifest(entries) {
  const manifest = {};

  for (const { file, config } of entries) {
    if (!config || typeof config !== "object") {
      console.warn("[createManifest] Skipping entry with invalid config:", file);
      continue;
    }

    const id = config.id;
    const period = config.period;

    if (typeof id !== "string" || !id) {
      console.warn(
        "[createManifest] Skipping entry without valid id:",
        file,
        config
      );
      continue;
    }

    if (typeof period !== "string" || !period) {
      console.warn(
        "[createManifest] Skipping entry without valid period:",
        file,
        config
      );
      continue;
    }

    if (!manifest[id]) {
      manifest[id] = {};
    }

    if (manifest[id][period] && manifest[id][period] !== file) {
      console.warn(
        "[createManifest] Duplicate id/period combination:",
        id,
        period,
        "existing:",
        manifest[id][period],
        "new:",
        file
      );
    }

    manifest[id][period] = file;
  }

  return manifest;
}
