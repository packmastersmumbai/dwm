# TaskFlow — Audit Remediation Plan (SADD execution)

Generated 2026-05-20. Source: deep system audit (backend + frontend + UX).
Execution model: subagent-driven-development, parallel where files are disjoint,
code-review gate after every wave.

## Conflict model

- `Code.js` is ONE file → all backend fixes go to ONE agent (no parallel edits).
- Each frontend screen file is owned by exactly ONE agent per wave (no file overlap).
- Cross-cutting nav changes are isolated into a dedicated sequential wave.

---

## WAVE 0 — Baseline & safety  (sequential)

- 0.1 `git init`, add `.gitignore` (node_modules/, creds.json, .playwright/, screenshots/)
- 0.2 Baseline commit of current state → record BASE_SHA
- **GATE 0:** repo exists, creds.json NOT tracked, BASE_SHA recorded.

## WAVE 1 — Backend P0  (1 agent — Code.js only)

- 1.1 Fix status string mismatch `in-progress` vs `inprogress` (Code.js:1470, 1548 + seed)
- 1.2 Fix `notifyPrefs` key mismatch — emails never send (Code.js:~2002)
- 1.3 `getMyDayTasks` — match assignees by user ID, not name (Code.js:1054)
- 1.4 Authorization — admin/owner checks on `createUser`, `removeUser`,
      `updateTask`, `deleteTask`; reject untrusted `payload.role`
- 1.5 Guard `seedDemoData()` against accidental run on live data
- 1.6 `quickAddTask` — accept and persist `dueDate`
- **GATE 1:** code-reviewer + security-reviewer (parallel). Critical issues fixed before Wave 2.

## WAVE 2 — Frontend P0/P1  (3 agents in PARALLEL — disjoint files)

**FE-1 Structure & routing** — owns: index.html, screen_myday-share.html,
screen_myday-focus.html, screen_task-detail-whatsapp.html, screen_task-detail-sheet.html
- Merge myday-share + myday-focus → single My Day screen; fix My-Day routing
- Delete task-detail-whatsapp; move WhatsApp share button into task-detail-sheet
- Add confirmation step to "STOP & MARK DONE"
- Update screen include list in index.html

**FE-2 Data entry** — owns: screen_add-edit-task.html, screen_quick-capture.html
- Quick date chips (Today / Tomorrow / +3d / End of week)
- Quick-capture: add due date + assignee, labelled priority, preserve state on "More details"
- Recurring-frequency picker (Daily / Weekly)

**FE-3 Screen polish** — owns: screen_kanban-home.html, screen_team-board.html,
screen_daily-plan.html, screen_reports-kpi.html, screen_notifications.html
- Kanban dynamic overdue badge; touch targets ≥44px
- Team Board: add "Done" column
- daily-plan: add bottom navigation bar
- reports-kpi: data-driven category chart (remove hardcoded Dev/Design/Marketing)
- notifications: remove dead 40%-opacity mockup; inline actions
- **GATE 2:** code-reviewer reviews all three diffs; conflict check.

## WAVE 3 — Frontend consolidation  (1 agent — runs ∥ Wave 4, disjoint files)

- 3.1 Expose Reports in bottom nav across all screen files
- 3.2 Remove frontend dead code: Pomodoro vars, unused `#tf-loading`, fake mockups
- **GATE 3:** code-reviewer.

## WAVE 4 — Backend P2  (1 agent — Code.js only, runs ∥ Wave 3)

- 4.1 Attachment storage helpers (Google Drive) for photo-proof
- 4.2 SLA / escalation logic — settings + escalation notification trigger
- 4.3 `getShiftHandover()` summary function (done/open/blocked per shift)
- 4.4 `getTeamTimeline` O(n²) → indexed lookup
- 4.5 Remove backend dead code: testPing, unused aliases, `colMap`
- **GATE 4:** code-reviewer + security-reviewer.

## WAVE 5 — Frontend P2  (agents in PARALLEL — disjoint files)

**FE-P2-A** — owns: screen_task-detail-sheet.html, screen_add-edit-task.html, screen_quick-capture.html
- Photo-proof capture step on completion; `requiresPhoto` toggle
- Voice input (Web Speech API) on title fields
- @mention autocomplete in comment input

**FE-P2-B** — owns: screen_admin-panel.html, new screen_shift-handover.html, index.html
- SLA config UI in Admin; shift-handover screen + nav entry
- QR/barcode scan entry point

- **GATE 5:** code-reviewer.

## WAVE 6 — Verification

- 6.1 `clasp push` to GAS
- 6.2 Run e2e-mobile-audit.js + e2e-timer-debug.js
- 6.3 Final full code-reviewer pass
- **GATE 6:** e2e green, screenshots reviewed.
