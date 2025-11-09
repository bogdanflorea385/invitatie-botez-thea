# Copilot / AI Agent guidance — Invitatie Botez Thea

Short, actionable pointers to get productive in this repository.

- Project big picture
  - Static front-end served as plain HTML/CSS/JS (files at project root: `index-new.html`, `rsvp.html`, `admin.html`, `pagina2.html`).
  - Small Flask backend lives in `backend/app.py`. It persists RSVP data to `backend/responses.json`.
  - Frontend talks to backend over HTTP (hard-coded base URL `http://127.0.0.1:5000` in `script.js` and other HTML pages).

- How to run locally (Windows PowerShell)
  - Start backend: `cd backend; python app.py` (Flask listens on 127.0.0.1:5000 by default).
  - The frontend can be opened directly from the filesystem (the backend sets permissive CORS headers), e.g. open `index-new.html` or `rsvp.html` in a browser.

- Important endpoints (examples from `backend/app.py`)
  - POST /rsvp — accepts JSON {nume, prezenta, persoane}. Example fetch shown in `script.js`:
    fetch('http://127.0.0.1:5000/rsvp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
  - GET /lista — returns list of entries (used by `admin.html`).
  - POST /delete — delete entry by index (admin UI calls this).

- Data shape and conventions
  - Stored as an array of objects in `backend/responses.json` with keys: `nume`, `prezenta`, `persoane`, `timestamp`.
  - `prezenta` is normalized in the backend: expected values include `particip`, `nu_particip`, `vin`, `nu_vin`.

- Project-specific conventions and gotchas
  - There are two `responses.json` files (root and `backend/`); the Flask app uses `backend/responses.json` (see `DATA_FILE` in `backend/app.py`).
  - Admin authentication is client-side only: the password is hard-coded in `admin.html` (`PAROLA_ADMIN = "Thea2025"`) and persisted with `localStorage` key `admin_thea_ok` — treat as development convenience, not secure.
  - `app.secret_key` is present in `backend/app.py` but the app does not use server-side session-based auth for admin. Avoid assuming server-side protection.
  - Frontend and backend expect the server at `127.0.0.1:5000` — if you change host/port, update `script.js`, `rsvp.html`, `admin.html` and any other direct fetch calls.

- Suggested small improvements for PRs (safe, low-risk)
  - Extract the backend base URL into a single constant in `script.js` and the small pages to ease changes.
  - Move admin password out of client HTML if adding real protection (or add a simple server-side check).
  - Centralize response file path if adding tests or CI.

- Quick debugging tips
  - If form POST fails, open browser console — `script.js` logs errors and alerts "Serverul nu raspunde. L-ai pornit cu python app.py?".
  - To inspect saved entries, open `backend/responses.json` after submitting forms.

If anything here is unclear or you'd like me to include more examples (for example, a short sample PR that centralizes the API base URL), tell me which area to expand.
