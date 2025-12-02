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

