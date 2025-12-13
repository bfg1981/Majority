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
  const rules = body.rules || [];

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
    const total =
      def.total != null ? def.total : sumMetric(groups, defaultMetricId);
    metricPhrase = `${def.label || defaultMetricId} total: ${total}`;
  }

  const period =
    body.metadata && body.metadata.period
      ? ` • Period: ${body.metadata.period}`
      : "";
  const country =
    body.metadata && body.metadata.country
      ? ` • Country: ${body.metadata.country}`
      : "";

  meta.textContent = metricPhrase + period + country;
  header.appendChild(meta);

  container.appendChild(header);

  // Coalition summary
  const coalitionBox = document.createElement("div");
  coalitionBox.className = "coalition-summary";

  const coalitionTotalsEl = document.createElement("p");
  coalitionTotalsEl.className = "coalition-totals";
  coalitionBox.appendChild(coalitionTotalsEl);

  const rulesTitleEl = document.createElement("p");
  rulesTitleEl.className = "coalition-rules-title";
  rulesTitleEl.textContent = "Rules:";
  coalitionBox.appendChild(rulesTitleEl);

  const rulesListEl = document.createElement("ul");
  rulesListEl.className = "coalition-rules";
  coalitionBox.appendChild(rulesListEl);

  container.appendChild(coalitionBox);

  // Groups list
  const list = document.createElement("div");
  list.className = "group-list";

  // Keep track of selected group ids (coalition)
  const selectedIds = new Set();

  // Single-select (but clearable) rule selection for console output
  let selectedRuleId = null;

  function updateCoalitionSummary() {
    const coalitionGroups = groups.filter((g) => selectedIds.has(g.id));

    // Coalition totals
    if (coalitionGroups.length === 0) {
      // Keep warning when nothing is selected
      coalitionTotalsEl.textContent = "No groups selected.";
    } else if (defaultMetricId && metrics[defaultMetricId]) {
      const def = metrics[defaultMetricId];
      const totalBody =
        def.total != null ? def.total : sumMetric(groups, defaultMetricId);
      const totalCoalition = sumMetric(coalitionGroups, defaultMetricId);
      const pct =
        totalBody > 0 ? (totalCoalition / totalBody) * 100 : null;

      const pctText =
        pct != null ? ` (${pct.toFixed(1)}% of ${totalBody})` : "";

      coalitionTotalsEl.textContent = `Coalition: ${coalitionGroups.length} groups, ${totalCoalition} ${
        def.unit || def.label || defaultMetricId
      }${pctText}`;
    } else {
      coalitionTotalsEl.textContent = `Coalition: ${coalitionGroups.length} groups.`;
    }

    // Always show rules, even when no groups are selected
    rulesListEl.innerHTML = "";
    if (!rules.length) {
      const li = document.createElement("li");
      li.textContent = "No rules defined for this governing body.";
      rulesListEl.appendChild(li);
      return;
    }

    const results = evaluateRules(body, coalitionGroups);
    results.forEach((result) => {
      const li = document.createElement("li");
      li.className = "rule-item";
      const symbol = result.satisfied ? "✔" : "✖";
      const name = result.rule.name || result.rule.id || "Rule";
      li.textContent = `${symbol} ${name}`;

      if (result.rule && result.rule.id && result.rule.id === selectedRuleId) {
        li.classList.add("selected");
      }

      // Click to select a rule; click again to deselect.
      li.addEventListener("click", () => {
        const id = result.rule && result.rule.id ? result.rule.id : null;
        selectedRuleId = selectedRuleId === id ? null : id;
        updateCoalitionSummary();
      });

      rulesListEl.appendChild(li);
    });

    if (selectedRuleId) {
      const suggested = findMinimalWinningCoalitions(body, selectedIds, selectedRuleId);
      console.log(
        "Suggested coalitions:",
        suggested.map((cs) => cs.map((g) => g.shortName || g.id))
      );
    }
  }

  // Build group cards
  groups.forEach((group) => {
    const item = document.createElement("div");
    item.className = "group-item";

    // Click to toggle "selected"
    item.addEventListener("click", () => {
      if (selectedIds.has(group.id)) {
        selectedIds.delete(group.id);
        item.classList.remove("selected");
      } else {
        selectedIds.add(group.id);
        item.classList.add("selected");
      }
      updateCoalitionSummary();
    });

    // Color dot
    const colorDot = document.createElement("div");
    colorDot.className = "group-color-dot";
    const color =
      group.metadata && group.metadata.color
        ? group.metadata.color
        : "#e5e7eb";
    colorDot.style.backgroundColor = color;
    item.appendChild(colorDot);

    // Icon (optional)
    const iconEl = document.createElement("div");
    iconEl.className = "group-icon";
    const iconMeta = group.metadata && group.metadata.icon;
    if (iconMeta && iconMeta.type === "emoji") {
      iconEl.textContent = iconMeta.value;
      item.appendChild(iconEl);
    } else if (iconMeta && (iconMeta.type === "url" || iconMeta.type === "image")) {
      const img = document.createElement("img");
      img.src = iconMeta.type === "image" ? iconMeta.src : iconMeta.value;
      img.alt =
        iconMeta.alt ||
        group.shortName ||
        group.name ||
        group.id;
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

  // Initial summary (no groups selected)
  updateCoalitionSummary();
}

/* ---------- Rule evaluation helpers ---------- */

/**
 * Evaluate all rules for a given coalition.
 *
 * @param {object} body - Governing body
 * @param {Array<object>} coalitionGroups - groups in coalition
 * @returns {Array<{rule: object, satisfied: boolean}>}
 */
function evaluateRules(body, coalitionGroups) {
  const rules = body.rules || [];
  const metrics = body.metrics || {};
  const groups = body.groups || [];

  return rules.map((rule) => {
    const conditions = rule.conditions || [];
    const satisfied = conditions.every((cond) =>
      evaluateCondition(cond, {
        body,
        metrics,
        groups,
        coalitionGroups,
      })
    );
    return { rule, satisfied };
  });
}

/**
 * Evaluate a single condition.
 */
function evaluateCondition(condition, ctx) {
  switch (condition.type) {
    case "sum":
      return evaluateSumCondition(condition, ctx);
    case "countGroups":
      return evaluateCountGroupsCondition(condition, ctx);
    default:
      console.warn("Unknown condition type:", condition.type);
      return false;
  }
}

/**
 * Sum condition: sum of a metric over coalition compared to threshold.
 */
function evaluateSumCondition(condition, ctx) {
  const metricId = condition.metric;
  const operator = condition.operator || ">=";
  const thresholdSpec = condition.threshold || {};
  const coalitionSum = sumMetric(ctx.coalitionGroups, metricId);

  const thresholdValue = resolveThreshold(thresholdSpec, {
    body: ctx.body,
    metrics: ctx.metrics,
    groups: ctx.groups,
    metricId,
  });

  return compareValues(operator, coalitionSum, thresholdValue);
}

/**
 * CountGroups condition: number of groups in coalition compared to value.
 */
function evaluateCountGroupsCondition(condition, ctx) {
  const operator = condition.operator || ">=";
  const value = condition.value != null ? condition.value : 0;
  const count = ctx.coalitionGroups.length;
  return compareValues(operator, count, value);
}

/**
 * Resolve threshold specification to a numeric value.
 *
 * threshold = {
 *   kind: "fractionOfTotal" | "absolute" | "percentage",
 *   metric: "seats",
 *   value: number,
 *   offset?: number
 * }
 */
function resolveThreshold(threshold, ctx) {
  const kind = threshold.kind || "absolute";
  const value = typeof threshold.value === "number" ? threshold.value : 0;
  const offset = typeof threshold.offset === "number" ? threshold.offset : 0;

  if (kind === "fractionOfTotal") {
    const metricId = threshold.metric || ctx.metricId;
    const def = ctx.metrics[metricId] || {};
    const total =
      def.total != null ? def.total : sumMetric(ctx.groups, metricId);
    return value * total + offset;
  }

  if (kind === "percentage") {
    // Here we assume coalitionSum is itself a percentage metric,
    // so we just compare directly to `value`.
    return value + offset;
  }

  // absolute
  return value + offset;
}

/**
 * Compare two numeric values with an operator.
 */
function compareValues(operator, a, b) {
  switch (operator) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case "==":
    case "=":
      return a === b;
    case "!=":
      return a !== b;
    default:
      console.warn("Unknown operator:", operator);
      return false;
  }
}

/* ---------- Shared helpers ---------- */

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

/**
 * Find minimal winning coalitions that extend the current selection.
 *
 * @param {object} body - Governing body JSON
 * @param {Set<string>} baselineIds - group ids that must be included
 * @param {string} ruleId - id of the rule to use (e.g. "absolute_majority")
 * @returns {Array<Array<object>>} - list of coalitions, each an array of group objects
 */
function findMinimalWinningCoalitions(body, baselineIds, ruleId) {
  const groups = body.groups || [];
  const metrics = body.metrics || {};
  const rules = body.rules || [];

  const defaultMetricId = getDefaultMetricId(metrics);
  if (!defaultMetricId) return [];

  const rule = rules.find((r) => r.id === ruleId) || rules[0];
  if (!rule) return [];

  // We’ll use the first sum condition on the default metric as the "threshold" driver
  const sumCond = (rule.conditions || []).find(
    (c) => c.type === "sum" && c.metric === defaultMetricId
  );
  if (!sumCond) {
    // If no suitable sum condition, bail out for now
    return [];
  }

  const threshold = resolveThreshold(sumCond.threshold || {}, {
    body,
    metrics,
    groups,
    metricId: defaultMetricId,
  });
  const operator = sumCond.operator || ">=";

  // Helper: does a coalition satisfy the rule (using this sum condition)?
  const isWinning = (coalitionGroups) => {
    const seats = sumMetric(coalitionGroups, defaultMetricId);
    return compareValues(operator, seats, threshold);
  };

  const idToGroup = new Map(groups.map((g) => [g.id, g]));
  const baselineGroups = groups.filter((g) => baselineIds.has(g.id));
  const baselineSeats = sumMetric(baselineGroups, defaultMetricId);

  const remaining = groups.filter((g) => !baselineIds.has(g.id));

  const results = [];
  const n = remaining.length;

  // Precompute remaining seat sums for pruning
  const remainingSeats = remaining.map(
    (g) => (g.metrics && g.metrics[defaultMetricId]) || 0
  );
  const suffixMax = new Array(n + 1);
  suffixMax[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    suffixMax[i] = suffixMax[i + 1] + remainingSeats[i];
  }

  const currentIds = new Set(baselineIds);

  function dfs(index, currentSeats) {
    // Check if current coalition is already winning
    if (compareValues(operator, currentSeats, threshold)) {
      // Check minimality w.r.t. *added* groups (we never remove baseline)
      const addedIds = [...currentIds].filter((id) => !baselineIds.has(id));
      for (const id of addedIds) {
        const g = idToGroup.get(id);
        const s = (g.metrics && g.metrics[defaultMetricId]) || 0;
        const seatsWithout = currentSeats - s;
        if (compareValues(operator, seatsWithout, threshold)) {
          // Still winning after removing this added group -> not minimal
          return;
        }
      }
      const coalitionGroups = groups.filter((g) => currentIds.has(g.id));
      results.push(coalitionGroups);
      return;
    }

    // No more groups to add
    if (index >= n) return;

    // Prune if even adding all remaining seats cannot reach threshold
    const maxPossible = currentSeats + suffixMax[index];
    if (!compareValues(operator, maxPossible, threshold)) {
      return;
    }

    // Option 1: include this group
    const g = remaining[index];
    const s = (g.metrics && g.metrics[defaultMetricId]) || 0;
    currentIds.add(g.id);
    dfs(index + 1, currentSeats + s);
    currentIds.delete(g.id);

    // Option 2: skip this group
    dfs(index + 1, currentSeats);
  }

  dfs(0, baselineSeats);

  return results;
}


// Expose function globally
window.loadGoverningBody = loadGoverningBody;
