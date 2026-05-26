# TaskFlow Forward Plan v3 — Playwright-Driven, Veritas-Cleared

> Status: working app at deploy `@78`, 4 daily users, no open user-reported bugs.
> Goal: **stabilise** the app, then ship **one** JTBD-fit feature, then stop.
> Playwright CLI is already installed locally — Session 0 only writes the rigs.

---

## How this plan was built

1. v1 plan (6 sessions, linear)
2. v2 plan (6 sessions, SADD-aware with parallel agents)
3. v3 (this file) — after **veritas-reviewer v3** flagged v2 as REJECT for: keyboard shortcuts contradicting "one tap, gloves on" JTBD, false dead-files claim, speculative perf optimisation, and 6-session over-scaling for a working app
4. Cross-checked against Monday.com, OutOfMilk, and shop-floor specialist tools to find genuine gaps; cut anything not serving the JTBD

The JTBD (single sentence — every action filters through it):
**"At any moment, anyone on the floor can answer 'what am I doing now, what's overdue, and what's the team doing' in one tap, on their phone, with gloves on."**

---

## Sessions

### Session 0 — Write the rigs *(parent context, no Sonnet dispatch)*
**Ships:** test scripts only

| Step | What |
|---|---|
| 0.1 | Confirm Playwright: `node -e "console.log(require('playwright/package.json').version || 'ok')"` |
| 0.2 | Write `e2e-audit.js` — runs 10 probes + 3 perf timings + reachability grep; outputs `STATE.md` + `audit-screenshots/<probe>.png` |
| 0.3 | Write `e2e-verify.js` — re-runs ONLY previously-failing probes; exits 1 on regression |
| 0.4 | Add `package.json` scripts: `"audit": "node e2e-audit.js"`, `"verify": "node e2e-verify.js"` |
| 0.5 | Smoke-run against `@78`; `.gitignore` the screenshots folder |

**The 10 probes:**

1. Login flow — each user (Admin/1234, Priya/1111, Ravi/2222, Meena/3333) reaches Home in ≤3 taps
2. Scope filtering — Priya sees only Priya's tasks under Mine; Team scope shows all
3. Timer start — start a timer, REC pill appears within 1s
4. Timer stop — stop the timer, stays stopped for 90s (60s guard + 30s margin)
5. Timer-switch — start A → start B; B starts without unexpected behaviour on A
6. Mark-done sync — done card moves to Done column with strikethrough within 1s
7. Bottom-nav — every nav slot navigates from every screen
8. Gantt grouping — Home → Timeline shows project-grouped bars, not flat list
9. List view sticky — filter strip stays sticky on row scroll
10. Admin read-only — non-admin user can open Admin tab without silent redirect

**The 3 perf timings:** Home cold-load ms, Team scope cold ms, Timeline render ms.

---

### Session 1 — Baseline audit
**Pattern:** `npm run audit` invoked by Claude
**Ships:** `STATE.md` only

Claude logs in across all four test users on mobile 390×844 + desktop 1280×800, runs the rig, writes `STATE.md`. Decision point:

- Zero ✗ → skip Session 2, jump to Session 2.5
- Any ✗ → Session 2

---

### Session 2 — Fix verified P0s *(conditional)*
**Pattern:** `do-and-judge` per ✗ — fixer Sonnet + `code-reviewer` Sonnet
**Ships:** `@79` if all P0s clear

| Step | What |
|---|---|
| 2.1 | Read `STATE.md`, dispatch fixer with exact `file:line` per ✗ |
| 2.2 | `code-reviewer` reviews diff against symptom; rejects → fixer retries once → escalate |
| 2.3 | After all fixes land: rebuild Tailwind if classes changed, commit, push |
| 2.4 | `npm run verify` — exit 0 promotes via `clasp deploy -i FIXED_ID`; exit 1 reverts |
| 2.5 | Post-promotion `npm run audit` confirms full green sweep |

---

### Session 2.5 — One JTBD-fit feature *(conditional)*
**Pattern:** single fixer Sonnet + `code-reviewer` judge
**Ships:** next deploy number

Pick one before starting:

| Option | What | Lift |
|---|---|---|
| **A — Checklists in tasks** (recommended) | Per-task step list, ticked on detail sheet, `N/M` progress chip on card. Closes Monday subtask + shop-floor SOP gap in one stroke. `task.checklist` already half-wired (`screen_kanban-home.html` line 176) — finish the form binding + persistence | small-medium |
| **B — Task templates** | Admin saves a template with default fields + checklist; operators pick from a list when creating | medium |
| **C — Bulk select + assign** | Supervisor selects N cards → batch-assign / change due / mark done | medium |

Judge MUST verify the commit message cites which JTBD line the feature serves; reject if missing.

---

### Session 3 — Confirmed-dead cleanup *(auto-triggered, conditional)*
**Trigger:** `git log --since="3 days ago"` shows no fix commits AND `npm run audit` returns green
**Pattern:** single Sonnet
**Ships:** `@N+1` only if grep proves something dead

| Step | What |
|---|---|
| 3.1 | `grep -rn` for candidate dead files (`screen_team-board.html`, `screen_team-timeline.html`, anything else flagged in `STATE.md`) |
| 3.2 | If any active reference → STOP, files alive (per veritas Phase A — they were referenced in `index.html`, `manifest.json` last time we checked) |
| 3.3 | If grep-clean → `git rm`, `npm run audit` to verify, commit, deploy |

---

## What the user does

1. `start session 0` → Claude writes the rigs, smoke-tests them
2. `run audit` → Session 1 outputs `STATE.md`
3. `proceed` → Session 2 burns down P0s if any, ships `@79`
4. `feature A` (or `B` / `C`) → Session 2.5 builds the chosen feature, ships next deploy
5. After 3 calendar days: `check stability` → Session 3 triggers if stable

You never run Playwright. You never tap a phone. You read short reports.

---

## What was explicitly cut and why

| Cut | Why |
|---|---|
| AI auto-plan / Monday-vibe-style generative agents | 4 users, simple work; PRODUCT.md anti-references it |
| Scrap / defect tracking | Not a JTBD line |
| Skill matrix / certifications | 4 people, everyone knows everyone |
| Vacation / PTO calendar | WhatsApp + sheet handles it |
| Subtasks with dependencies | Checklists cover 90% without UI complexity |
| Drag-and-drop kanban columns | Tap-to-move is faster with gloves |
| Slack / Teams integration | Already on WhatsApp; shift-handover share covers it |
| Push notifications (PWA Service Worker) | Defer until ≥1 user complains the in-app inbox misses delivery |
| Keyboard shortcuts / Cmd-K palette | Veritas SHOWSTOPPER — contradicts gloves-on JTBD |
| Performance optimisation in advance | No evidence of slowness; build it only if Session 1 perf timings exceed budget |
| 30-day sparkline trend on Reports | Nice-to-have, defer until asked |
| Mass parallel polish (3 agents on cleanup) | Polish without user complaint is gardening |

---

## Sub-agent budget

| Session | Dispatches |
|---|---|
| 0 | 0 |
| 1 | 0 |
| 2 | 2 per P0 (sequential), worst case 3 P0s = 6 |
| 2.5 | 2 (fixer + judge) |
| 3 | 1 |

**Total worst case: 9 dispatches across the whole plan.** v2 was approximately 72.

---

## Failure / abort rules

- `npm run audit` itself errors → fix the rig before doing anything else
- Headless run can't log in (GAS auth interstitial changed) → rig logs the HTML, user supplies a hint, retry
- `verify` exits 1 after a fix → automatic `git revert`, no production deploy, error report
- More than 5 P0s surface in one audit → Session 2 splits into multiple sub-cycles, one P0 per ship
- A regression ships → revert, set Session 3 trigger back to start of new 3-day window

---

## Stop condition

**TaskFlow is done when 1 week passes on production with zero user-reported bugs.**

Not when `@N` is reached. Not when N features ship. Not when this plan ends.

Hand it to the team. Stop deploying for a month. Then re-evaluate.

---

## Sources informing this plan

- veritas-reviewer v3 verdict on prior v2 plan (REJECT, fatal flaw = keyboard shortcuts vs gloves-on JTBD)
- [monday.com 2026 review — Cloudwards](https://www.cloudwards.net/monday-com-review/)
- [Out of Milk shared-list patterns](https://support.outofmilk.com/hc/en-us/articles/208223943-Android-Share-a-list)
- [MRPeasy Shop-Floor Management](https://www.mrpeasy.com/shop-floor-management-software/)
- [Quickbase Shop-Floor Management System](https://www.quickbase.com/blog/quickbase-shop-floor-management-system-sfms-app-revolutionizing-your-production-line)
- PRODUCT.md (factory floor JTBD)
- DESIGN.md (Calm Material constraints)
