/**
 * Placeholder loader:
 * - jsonPath: relative path to the JSON file
 * - elementId: id of the DOM element to put the JSON into
 */
function loadGoverningBody(jsonPath, elementId) {
  const target = document.getElementById(elementId);
  if (!target) {
    console.error(`loadGoverningBody: no element found with id="${elementId}"`);
    return;
  }

  fetch(jsonPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${jsonPath}`);
      }
      return response.json();
    })
    .then((data) => {
      // Placeholder behavior: pretty-print the raw JSON
      target.textContent = JSON.stringify(data, null, 2);
    })
    .catch((err) => {
      console.error("loadGoverningBody error:", err);
      target.textContent = `Error loading ${jsonPath}:\n${err.message}`;
    });
}

// Expose function on window for clarity (optional in non-module script)
window.loadGoverningBody = loadGoverningBody;

