# Majority / Governing Body Viewer

This repository contains a small, framework-free web application for exploring
**governing bodies, group compositions, and coalition rules**.

The project is intentionally minimal and data-driven, with a strong emphasis on
**single source of truth** and **runtime introspection** rather than UI polish or
framework abstractions.

A live, continuously deployed version is available at:

 https://majority.tom-fredrik.no/

---

## Key ideas

- **Single source of truth**  
  Configuration is defined once (in `CONFIG`) and introspected at runtime.

- **Introspected configuration UI**  
  The settings dialog is generated dynamically from the config object, avoiding
  duplication between logic and UI.

- **No framework, no build step**  
  Plain HTML, CSS, and JavaScript. Suitable for static hosting.

- **Data-driven logic**  
  Governing bodies and periods are loaded from JSON and rendered dynamically.

- **UI is secondary**  
  The focus is on behavior, structure, and correctness rather than visual polish.

---

## Running locally

Because the app uses ES modules, it must be served over HTTP (not `file://`).

The simplest way is:

```bash
cd web
python3 -m http.server
```

Then open:

```
http://localhost:8000
```

---

## Repository structure (simplified)

```
web/
  index.html                # Page layout and orchestration
  governing-body-viewer.js  # Core rendering and logic
  styles.css                # Styling
  config/                   # Governing body definitions (JSON)
```

---

## Non-goals

- This is **not** a general-purpose framework.
- This is **not** a polished production UI.
- There is no attempt at exhaustive validation or permissions.
- Design favors clarity and inspectability over abstraction.

---

## Status

This is an actively evolving exploratory project.
Changes are deployed continuously to the live URL linked above.
