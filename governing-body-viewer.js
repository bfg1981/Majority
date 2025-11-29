/**
 * Load a governing-body JSON and render it into the given element.
 *
 * @param {string} jsonPath - relative path to the JSON file
 * @param {string} elementId - id of the DOM element to render into
 */
function loadGoverningBody(jsonPath, elementId) {
  const container = document.getElementById(elementId);
  if (!container) {
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
      renderGoverningBody(data, container);
    })
    .catch((err) => {
      console.error("loadGoverningBody error:", err);
      container.textContent = `Error loading ${jsonPath}:\n${err.message}`;
    });
}

/**
 * Render a GoverningBody object into a container.
 *
 * @param {object} body
 * @param {HTMLElement} container
 */
function renderGoverningBody(body, container) {
  container.innerHTML = "";

  const metrics = body.metrics || {};
  const groups = body.groups || [];

  // Determine default metric (e.g. "seats")
  const defaultMetricId = getDefaultMetricId(metrics);

  // Header
  const header = document.createElement("div");
  header.className = "gb-header";

  const title = document.createElement("h2");
  title.className = "gb-header-title";
  title.textContent = body.name || body.id || "Governing body";
  header.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "gb-header-meta";

  let metricPhrase = "No metrics defined";
  if (defaultMetricId && metrics[defaultMetricId]) {
    const def = metrics[defaultMetricId];
    const total = def.total != null ? def.total : sumMetric(groups, defaultMetricId);
    metricPhrase = `${def.label || defaultMetricId} total: ${total}`;
  }

  const period = body.metadata && body.metadata.period ? ` • Period: ${body.metadata.period}` : "";
  const country = body.metadata && body.metadata.country ? ` • Country: ${body.metadata.country}` : "";

  meta.textContent = metricPhrase + period + country;
  header.appendChild(meta);

  container.appendChild(header);

  // Groups
  const list = document.createElement("div");
  list.className = "group-list";

  groups.forEach((group) => {
    const item = document.createElement("div");
    item.className = "group-item";

    // Click to toggle "selected"
    item.addEventListener("click", () => {
      item.classList.toggle("selected");
      // You can hook coalition logic here later if you like.
      console.log("Toggled group:", group.id, "selected:", item.classList.contains("selected"));
    });

    // Color dot
    const colorDot = document.createElement("div");
    colorDot.className = "group-color-dot";
    const color = group.metadata && group.metadata.color ? group.metadata.color : "#e5e7eb";
    colorDot.style.backgroundColor = color;
    item.appendChild(colorDot);

    // Icon (optional)
    const iconEl = document.createElement("div");
    iconEl.className = "group-icon";
    const iconMeta = group.metadata && group.metadata.icon;
    if (iconMeta && iconMeta.type === "emoji") {
      iconEl.textContent = iconMeta.value;
      item.appendChild(iconEl);
    } else if (iconMeta && iconMeta.type === "url") {
      const img = document.createElement("img");
      img.src = iconMeta.value;
      img.alt = group.shortName || group.name || group.id;
      img.style.width = "1.2rem";
      img.style.height = "1.2rem";
      img.style.objectFit = "contain";
      iconEl.appendChild(img);
      item.appendChild(iconEl);
    } else if (iconMeta && iconMeta.type === "class") {
      const i = document.createElement("i");
      i.className = iconMeta.value;
      iconEl.appendChild(i);
      item.appendChild(iconEl);
    }

    // Text block
    const text = document.createElement("div");
    text.className = "group-text";

    const nameLine = document.createElement("div");
    nameLine.className = "group-name-line";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = group.name || group.id;
    nameLine.appendChild(nameSpan);

    if (group.shortName) {
      const shortSpan = document.createElement("span");
      shortSpan.className = "group-short";
      shortSpan.textContent = `(${group.shortName})`;
      nameLine.appendChild(shortSpan);
    }

    text.appendChild(nameLine);

    // Metric value
    const metricSpan = document.createElement("span");
    metricSpan.className = "group-metric";
    if (defaultMetricId) {
      const value = group.metrics && group.metrics[defaultMetricId];
      const def = metrics[defaultMetricId] || {};
      if (typeof value === "number") {
        metricSpan.textContent = `${def.label || defaultMetricId}: ${value}`;
      } else {
        metricSpan.textContent = `${def.label || defaultMetricId}: –`;
      }
    } else {
      metricSpan.textContent = "";
    }
    text.appendChild(metricSpan);

    item.appendChild(text);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function getDefaultMetricId(metrics) {
  const entries = Object.entries(metrics || {});
  if (entries.length === 0) return null;
  const explicit = entries.find(([, def]) => def && def.isDefault);
  if (explicit) return explicit[0];
  return entries[0][0];
}

function sumMetric(groups, metricId) {
  return (groups || []).reduce((sum, g) => {
    const v = g.metrics && g.metrics[metricId];
    return typeof v === "number" ? sum + v : sum;
  }, 0);
}

// Expose function globally
window.loadGoverningBody = loadGoverningBody;
