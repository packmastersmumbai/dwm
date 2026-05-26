# Pack Masters TaskFlow DWM

## Register

product

(This is an internal mobile-first **app UI** — design serves the product. It is not a marketing or brand surface.)

## Product purpose

TaskFlow is a daily-work-management (DWM) tool for the Pack Masters factory team. It replaces the WhatsApp-and-paper task tracking that the supervisor was previously running for ~8 people across two shifts. The single job-to-be-done: at any moment, anyone on the floor can answer **"what am I doing now, what's overdue, and what's the team doing"** in one tap.

It is **not** a generic project-management SaaS, **not** a Kanban-for-knowledge-workers, **not** a personal todo app. It is operations infrastructure for a small packaging / manufacturing business in Mumbai.

## Users

- **Floor supervisors (2–3 people)** — assign tasks, monitor live progress on the Team Board, escalate SLA breaches, run shift handovers. Primary device: their own Android phone, sometimes on shop floor (bright fluorescent / occasional daylight), sometimes at a desk.
- **Operators (4–8 people)** — receive tasks, run a timer while working, mark complete (with photo proof when required), check what's next. Primary device: a shared low-end Android phone or their personal phone. They often have **one hand free** and may be wearing **cotton work gloves**.
- **Owner / admin (1 person — the user driving this project)** — sets categories, clients, SLA windows, user accounts and PINs. Reads the Reports KPI tab to check throughput, on-time rate, overdue counts. Logs in from phone or laptop.

The app is in Hindi-English mixed daily speech but currently English-only UI. Users have varying tech comfort — assume a competent WhatsApp user but not an Asana power user. Reading speed is moderate; icons should not require label-reading once learned.

## Tone

- **Quiet, calm, professional.** This is a workplace tool used several times an hour for years. It is not a hype product. Sparkle, animations, and motion should be near-zero.
- **Direct.** No marketing copy, no exclamation marks, no "Great job!" affirmations. Buttons say what they do (Start Timer, Mark Done, Save, Sign In). Errors say what went wrong and what to try ("PIN must be 4 digits", not "Oops!").
- **Trustworthy at a glance.** Status of a task must be readable in under a second from color and shape alone. The boss should be able to spot an overdue task from across the room without zooming.
- **Respectful of attention.** No badges that pulse for no reason. No "did you know" tooltips. No dark patterns.

## Anti-references

Things this product should explicitly NOT look or feel like:

- **Linear / Notion / Asana** — knowledge-worker SaaS aesthetics with dense feature shelves, modal-first design, and dark mode peacocking. We're a one-page-per-task tool.
- **Trello kanban skeuomorphism** — playful drag handles, sticker-like cards, paper-and-tape texture. Looks unprofessional in our setting.
- **Material 3 "expressive"** — bouncy chips, blob shapes, soft gradient cards. Reads as consumer-toy on a factory floor.
- **Dark dashboard / observability** — Grafana, Sentry, Datadog. Wrong scene — phone, sunlight, not 27-inch monitor at 2 AM.
- **Brutalist or editorial fashion sites** — black-on-cream giant serif, eccentric grids. Wrong audience.
- **Crypto / fintech neon** — gradients, glowy borders, lottie animations.
- **"AI productivity"** marketing pages — purple-to-pink gradients, hero metrics, identical feature card grids.

## Strategic principles

1. **The phone in the hand wins the design.** Every choice is judged on a 5.5"–6.5" Android display held one-handed, at arm's length, under fluorescent or daylight. Desktop / iframe wrapper view is secondary.
2. **Glove-friendly first.** Primary actions are 48 px minimum, with 56 px for high-frequency controls (Start/Stop timer, PIN keypad, photo capture, bottom nav). No 32 px icon-only buttons for primary actions.
3. **Status is color + shape, never just text.** Green = on-time / done. Amber = SLA-watch. Red = overdue / active timer (REC) / destructive. Done = slate. The chip's *background fill* carries meaning, not just the text color.
4. **One primary action per screen.** Indigo CTA is reserved. If a screen has two equally-loud indigo buttons, the design is wrong.
5. **Server is the source of truth, always.** After any mutation (start timer, stop timer, save task, mark done), refetch and render — never trust optimistic UI to survive a flaky-network shop floor.
6. **No feature exists until it's used.** Cut, don't add. Examples already cut: dummy Reports stub, fake Team Board filters, fake skeleton backgrounds, Blocked status column, redundant My Day tab.
7. **Backend stays tolerant; UI gets strict.** The sheet may carry legacy rows with old status values, malformed clients, or partial assignees — the UI must render them without crashing, but new writes must go through the validated path.
8. **No decoration.** No gradients, no glassmorphism, no animated icons that don't represent live state. The only motion in the app is the REC timer pulse (live state) and a 200 ms ease-out on state transitions.

## Constraints (non-aesthetic — but they shape the design)

- **Runtime: Google Apps Script web app.** Frontend is `index.html` shell + 13 `screen_*.html` partials assembled via `<?!= include() ?>`. There is no React, no router, no build step for screens — Tailwind is precompiled and injected as a single `<style id="tw">` blob.
- **Auth:** PIN login (4-digit) → server-issued session token cached for 6 h. Every backend call carries the token. No SSO, no email, no SMS.
- **Storage:** Google Sheets. Photos in Google Drive folder. ~10 rows/day expected, hundreds total. No need to scale beyond one factory.
- **Deployment:** clasp to a fixed deployment id. iframe-wrapped in a GitHub Pages shell that hides the GAS banner. Production URL is the GAS exec link.
- **Network:** assume 3G / shop-floor Wi-Fi. Optimistic UI for perceived speed, but every mutation reconciles via refetch.
