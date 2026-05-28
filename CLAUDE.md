# TaskFlow DWM — Project Context

Google Apps Script web app replacing Pack Masters' manual Daily Work Management
spreadsheet. Sheets-backed, served via `clasp`. 5 clients: YARA / HENKEL / DK / APL / PM.

## clasp deploy workflow

```bash
clasp push -f                  # push code to HEAD (clasp run picks this up)
clasp deploy -i AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw -d "@NNN description"
clasp run <fn>                 # execute a function headlessly (off HEAD)
clasp run <fn> -p '["arg1"]'   # with args (JSON array)
```

- **One** production deploy ID, bumped each deploy (`@95` … `@121+`). Always reuse it with `-i`.
- `clasp run <fn>` works off **HEAD** immediately after `clasp push`.
- `google.script.run.<fn>()` (frontend) needs a **DEPLOYED** version — new fns return
  "Script function not found" until `clasp deploy` runs.
- clasp-run-callable helpers should `return JSON.stringify(...)` so test scripts can parse
  (clasp prints plain objects as JS-object literals, not valid JSON).
- `clasp run` does NOT trigger `doGet` → **`initializeSheets()` never runs**. Call it
  explicitly inside any helper that touches new schema columns, or run `forceInitTasksSchema`.
- Re-auth ONLY needed when OAuth scopes change in `appsscript.json`:
  `clasp logout && clasp login --creds creds.json --use-project-scopes` (interactive).
  Declare scopes upfront to avoid per-feature re-auth.
- Full clasp setup recipe: see project memory `appscript_clasp_run_setup.md`.

## URLs / GitHub Pages

- **Live app:** `https://script.google.com/macros/s/<deploy-id>/exec`
- **GitHub Pages wrapper:** `https://packmastersmumbai.github.io/dwm/`
  - `docs/index.html` is a full-screen iframe of the live deploy; crops the GAS banner,
    adds a splash screen; `docs/sw.js` caches the shell.
  - Auto-reflects every `clasp deploy` (iframe points at the published deploy ID) — no
    extra step to update Pages.
  - The app CANNOT run on Pages directly — needs the GAS runtime (Sheets/Calendar/Properties).
    Repo `github.com/packmastersmumbai/dwm` is a code backup, not a deployed site.
  - Calendar deep-link action URLs (`?act=...`) must stay on `script.google.com`, NOT the
    github.io wrapper (the iframe can't handle action params).

## Playwright CLI (E2E)

- Library lives inside the global CLI install — require it directly:
  `const { chromium } = require('C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright')`
- Run a test: `node e2e-<name>.js` (plain Node scripts, no test runner).
- GAS serves the UI inside a `googleusercontent.com` **iframe** — you must walk
  `page.frames()` and find the frame containing `[data-action="select-user"]` (or
  `#screen-pin-login`); selectors on `page` directly won't see the app.
- Use a **fresh `browser.newContext()` per login** — GAS session cookies leak across
  `page.goto` otherwise.
- Login flow: click user tile `[data-action="select-user"]` → click `[data-digit="N"]`
  for each PIN digit → wait for `#screen-kanban-home.active`.
- Existing rigs: `e2e-calendar.js` (calendar tab + event sync), `e2e-tbm-tasks.js`
  (getTasks serialization probe), `e2e-deeplink.js` (deep-link → task detail).
- Verify backend state via `clasp run` helpers, not just DOM (e.g. `verifyCalendarEventIds`,
  `getTaskStatusById`, `dumpTestEventLinks`).

## Silent-failure gotchas (each cost hours)

- `google.script.run` returns **null** (neither success nor failure handler meaningful)
  if the payload contains a raw `Date`. Sheets auto-converts `'09:00'`→Date on read —
  coerce Dates→strings in `rowToTask` etc.
- Inject JS into `<script>` with `<?!= ?>` NOT `<?= ?>` (the latter HTML-escapes, corrupting
  JSON.stringify output → e.g. taskId becomes a quoted string that matches nothing).
- `ScriptApp.getService().getUrl()` returns the HEAD dev URL which **404s for `?act=`
  handlers**. Use the published URL stored in `taskflow_web_app_url` ScriptProperty
  (`setPublishedWebAppUrl`).
- `window.close()` is blocked for tabs opened from external links (calendar taps). Best
  mitigation: chained `window.close()` → `history.back()` → `about:blank`.

## Conventions

- **Status enum:** hyphenated legacy (`in-progress`) + underscored new (`awaiting_check`,
  `rejected`, `template`). Initial state is `todo` (NOT `open`).
- **PDCA auto-driven from status:** todo=P, in-progress=D, awaiting_check=C, done=A.
  Never set manually. Worker "Done" → `awaiting_check` (supervisor Check Queue gates C→A);
  auto-approve if user has `tasks.approve` cap.
- **Calendar = interactive controller:** one-way TaskFlow→Calendar sync. Events carry
  HMAC-signed deep-link buttons (▶ Start / ⏸ Stop / ✓ Done / 📷 Photo) → `doGet?act=...&t=`.
- Auth token in **localStorage** (persists across tabs so calendar deep-links don't re-prompt).
- Debug helpers in `Code.js` to gate/remove eventually: setupCalendarTest,
  verifyCalendarEventIds, dumpTestEventLinks, getTaskStatusById, resyncTestEvents,
  debugTbmVisibleTasks, debugSessTasks, debugGetTasksRaw, debugTasksSchema,
  forceInitTasksSchema, setPublishedWebAppUrl.

## Users / PINs

Admin 1234 · Khushi 1111 (office) · Anuj 2222 (ops) · Santosh 3333 (ops) ·
Rajesh 4444 (security) · TBM 0000 (admin, tu55h4r@gmail.com) · BBM 9999 (owner)
