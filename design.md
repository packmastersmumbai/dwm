---
version: alpha
name: TaskFlow Shopfloor
description: "A heavy-duty industrial design system for the Pack Masters DWM task-management web app. Built for mobile-first use on the factory floor — glove-friendly tap targets, hi-vis safety amber as the single urgency accent, monospaced timers that read like a digital stopwatch, charcoal canvas that holds up under fluorescent light. Sharp corners, hairline borders, no decorative shadows. Inter for UI prose, JetBrains Mono for timestamps, durations, task IDs, and the REC timer pill. The palette is rooted in three semantic urgency colors (amber = active/SLA-watch, green = on-time/done, red = overdue/escalated) so a worker can read task state at arm's length without parsing text."

colors:
  primary: "#FFB400"
  on-primary: "#0E1116"
  primary-hover: "#FFC633"
  primary-pressed: "#E69F00"

  canvas: "#0E1116"
  surface-1: "#161A20"
  surface-2: "#1D222A"
  surface-3: "#252B35"
  surface-inverse: "#F7F5F2"

  ink: "#F2F4F7"
  ink-muted: "#B8BFCA"
  ink-subtle: "#7A828F"
  ink-disabled: "#4A5160"
  ink-on-light: "#0E1116"

  hairline: "#2A313C"
  hairline-strong: "#3A4250"
  focus-ring: "#FFB400"

  status-ontime: "#2FB344"
  status-ontime-bg: "#1A2E20"
  status-watch: "#FFB400"
  status-watch-bg: "#2E2410"
  status-overdue: "#E5484D"
  status-overdue-bg: "#2E1517"
  status-done: "#7A828F"
  status-done-bg: "#1D222A"

  rec-active: "#E5484D"
  rec-active-bg: "#2E1517"

typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
  headline-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.12em
  mono-timer:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.02em
  mono-meta:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.02em
  mono-id:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.04em

rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 10px
  pill: 9999px

spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  screen-pad: 16px
  card-pad: 16px
  bottom-nav-h: 64px
  touch-min: 44px
  touch-glove: 56px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 14px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-disabled}"

  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 14px
    height: 48px

  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 12px

  button-danger:
    backgroundColor: "{colors.status-overdue}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 14px

  chip-status-ontime:
    backgroundColor: "{colors.status-ontime-bg}"
    textColor: "{colors.status-ontime}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 6px
  chip-status-watch:
    backgroundColor: "{colors.status-watch-bg}"
    textColor: "{colors.status-watch}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 6px
  chip-status-overdue:
    backgroundColor: "{colors.status-overdue-bg}"
    textColor: "{colors.status-overdue}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 6px
  chip-status-done:
    backgroundColor: "{colors.status-done-bg}"
    textColor: "{colors.status-done}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 6px

  chip-filter:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.pill}"
    padding: 10px
  chip-filter-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"

  rec-pill:
    backgroundColor: "{colors.rec-active-bg}"
    textColor: "{colors.rec-active}"
    typography: "{typography.mono-timer}"
    rounded: "{rounded.pill}"
    padding: 8px

  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 16px

  card-elevated:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    padding: 16px

  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 14px
    height: 48px
  input-focus:
    backgroundColor: "{colors.surface-2}"

  pin-key:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.headline-md}"
    rounded: "{rounded.md}"
    size: 64px
  pin-key-pressed:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"

  bottom-nav:
    backgroundColor: "{colors.surface-1}"
    height: 64px
  bottom-nav-item:
    textColor: "{colors.ink-subtle}"
    typography: "{typography.label-caps}"
  bottom-nav-item-active:
    textColor: "{colors.primary}"

  sheet:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# TaskFlow Shopfloor

## Overview

TaskFlow is a daily-work-management (DWM) tool for the Pack Masters factory floor. The interface is read by supervisors and operators between shifts, on cheap Android phones, sometimes one-handed, often while wearing gloves, under bright fluorescent or daylight conditions. The design system is therefore engineered around three priorities, in order:

1. **Legibility at arm's length** — status of any task must be readable in under a second without parsing text, by color and shape alone.
2. **Glove-friendly tap targets** — primary actions are 48px minimum; the PIN keypad and bottom-nav use 56–64px.
3. **Urgency signaling without noise** — only one accent color (safety amber `#FFB400`) drives attention. The interface is otherwise a calm, dark, utilitarian canvas. Red is reserved for overdue/escalated/REC-active states only.

The vibe is **shopfloor industrial**: it should feel like the HMI panel of a packaging machine, not a consumer to-do app. Sharp corners, hairline borders, monospaced numerals for any time or quantity. There is no decoration, no gradients, no soft shadows — visual hierarchy comes from tonal layers and a single high-contrast accent.

## Colors

The palette is anchored in a near-black charcoal canvas with three tonal surface layers and a single hi-vis accent. Status is communicated by three semantic colors (green / amber / red) that double as background fills so a task chip is readable even at low contrast or with screen glare.

- **Primary — Safety Amber (`#FFB400`):** The sole driver of attention. Used exclusively for primary CTAs (Start, Stop, Save, Sign In), the active bottom-nav tab, focus rings, and tasks in the SLA-watch window. Never used decoratively.
- **Canvas (`#0E1116`):** The default page background. Holds up under glare; reduces battery draw on OLED.
- **Surface 1 / 2 / 3 (`#161A20`, `#1D222A`, `#252B35`):** Three tonal layers for cards, elevated cards, and bottom sheets. Hierarchy is conveyed by *lift*, never by shadow.
- **Ink (`#F2F4F7`):** Primary text. Pure white is avoided — `#F2F4F7` reduces eye fatigue across long shifts.
- **Status — On-Time Green (`#2FB344`):** Tasks completed within SLA. Also used for the success toast.
- **Status — Watch Amber (`#FFB400`):** Tasks within the SLA warning window (default: 25% of duration remaining).
- **Status — Overdue Red (`#E5484D`):** Tasks past SLA, escalated tasks, REC-active timer pill, destructive confirm buttons.
- **Status — Done Slate (`#7A828F`):** Completed-and-archived; signals "no longer needs attention."

The light-mode counterpart (`surface-inverse: #F7F5F2`) exists for the PDF export and the Reports KPI print view only — the app itself is dark-first.

## Typography

Two type families, used in strict role separation:

- **Inter** — All prose, labels, headings, button text. Chosen for its high x-height and excellent rendering at 13–16px on low-DPI Android screens. Used in weights 400 / 600 / 700 only.
- **JetBrains Mono** — All numerals that represent *measured quantities*: timer displays (`02:14:33`), timestamps, task IDs (`TF-1284`), durations, photo upload counts, SLA countdowns. The monospaced grid evokes the precision of a digital stopwatch and aligns multi-row data without manual padding.

Scale is compact (11–32px) because the app runs in an iframe inside a GitHub Pages wrapper — every pixel of vertical space is contested.

- **Display LG (32px / 700)** — Reserved for the PIN-login welcome and Reports KPI hero numbers.
- **Headline LG (24px / 700)** — Screen titles ("My Day", "Team Board").
- **Headline MD (20px / 600)** — Task title in the detail sheet.
- **Headline SM (17px / 600)** — Card titles in kanban columns.
- **Body LG / MD / SM** — Prose, descriptions, metadata. `body-md` (14px) is the workhorse.
- **Label CAPS (11px / 700, +0.12em tracking)** — Status chips (`OVERDUE`, `IN-PROGRESS`, `DONE`), bottom-nav labels, section dividers. Always uppercase. The wide tracking is what gives the system its "industrial signage" feel.
- **Mono Timer (18px)** — The REC pill and active-task counters.
- **Mono Meta (12px)** — Timestamps, durations, due-dates inline with task rows.
- **Mono ID (11px)** — Task short-codes (`#TF-1284`) shown subtle in card corners.

## Layout

The app is a **fluid single-column mobile layout** with a fixed-max-width of 480px on tablets and desktop (the iframe wrapper enforces this). There is no multi-column desktop view — the design is consciously phone-first because that is where every shift starts.

- **Screen padding:** 16px left/right, top safe-area + 12px, bottom = `bottom-nav-h` (64px) + 12px so content never sits under the nav.
- **Card padding:** 16px internal, 12px between stacked cards.
- **Section rhythm:** 24px between distinct sections, 8px between tightly-coupled rows.
- **Spacing scale:** strict 4px base — `xs(4) / sm(8) / md(12) / lg(16) / xl(24) / xxl(32)`. The 12px step exists specifically for the kanban card row gutter, which 8px makes too cramped and 16px makes too loose.
- **Touch targets:** 44px minimum (`touch-min`), 56px for any control likely to be tapped with gloves (`touch-glove`) — applied to PIN keys, bottom-nav, start/stop timer buttons, photo-capture button.
- **Bottom nav:** persistent 64px bar, 5 tabs (Home / My Day / Team / Reports / Admin), centered icons with `label-caps` below. Active tab is amber, inactive is `ink-subtle`.

## Elevation & Depth

This system is **strictly flat**. Hierarchy comes from three sources, in this order:

1. **Tonal layering** — `canvas → surface-1 → surface-2 → surface-3`. A bottom sheet sits on `surface-1` over a dimmed canvas (`canvas` at 70% alpha overlay).
2. **Hairline borders** — `1px solid {hairline}` separates cards from canvas and rows from each other. `hairline-strong` for focus and active states.
3. **Color contrast** — status chips and the amber accent do the rest.

No `box-shadow` is permitted anywhere in the system. Drop shadows belong to consumer software; the shopfloor reads them as decoration and ignores them.

## Shapes

The shape language is **architectural sharpness** with one exception.

- **4px (sm)** — All buttons, inputs, status chips, cards, PIN keys, sheets-as-rectangles. This is the default.
- **6px (md)** — Bottom sheets and the task detail panel — soft enough to read as "lifted from below."
- **10px (lg)** — Photo thumbnails in the attachment grid, so they read as photographs and not as UI panels.
- **Pill (`9999px`)** — Filter chips ("All / Shared / Mine") and the **REC timer pill** only. The pill shape is reserved for *state*, never for action.

Mixing radii within a single card is forbidden — see Do's and Don'ts.

## Components

### Buttons

- **Primary** — Amber background, dark text, 48px height, 4px radius, `label-md` (14px / 600). Only one primary button per screen. Used for: Start Timer, Stop Timer, Save Task, Submit PIN, Mark Done, Upload Photo.
- **Secondary** — `surface-2` background, ink text. For "Cancel", "Back", "Defer".
- **Ghost** — Transparent, muted ink. For tertiary inline actions ("View", "Edit", "Reply").
- **Danger** — Overdue red, used for "Delete Task", "Force Stop Timer", confirm-destructive dialogs only. Always paired with a Secondary cancel.

### Status Chips

Four variants matching the four semantic statuses. Always `label-caps` (uppercase 11px), 4px radius, 6px padding, background-fill at low alpha so the color *is* the message:

- `ON-TIME` — green
- `IN-PROGRESS` — amber
- `OVERDUE` — red
- `DONE` — slate

### REC Timer Pill

The single most-attention-grabbing element in the app. Pill shape, red background-fill (`rec-active-bg`), red text, mono-timer (18px) showing live `HH:MM:SS`. Pulses gently (1.5s ease) only while a timer is active. Visible in the top-right of every screen via the global app shell — when there is no active timer it is hidden entirely, not greyed out.

### Filter Chips

Pill-shaped, `surface-1` background when inactive, amber when active. Used on Team Board (`All / Shared / Mine`), Reports (date ranges), Admin (user role filters). Minimum 36px height.

### Lists / Task Rows

A task row is a horizontal flex card on `surface-1` with: status chip (left), title + mono-meta due-date stack (center, grows), assignee avatar or initials (right), task-id `mono-id` in the bottom-right corner. Tap-target wraps the entire row (56px minimum). Long-press opens the detail sheet.

### Input Fields

- 48px height, `surface-1` background, 4px radius, no border by default.
- Focus state: background lifts to `surface-2`, 2px `focus-ring` (amber) inset border.
- Helper text uses `body-sm` muted; error text uses `body-sm` in `status-overdue`.
- The text field caret is amber.

### PIN Keypad

The login keypad uses 64px keys (`pin-key`) in a 3-column grid, `surface-2` background, `headline-md` digits. Pressed state inverts to amber background / dark text. The 4-digit PIN display above uses `display-lg` with one filled-circle per entered digit.

### Bottom Navigation

Fixed 64px bar on `surface-1`, top 1px `hairline` border, 5 evenly-spaced tabs. Each tab is an icon (24px stroke, `ink-subtle` inactive, `primary` active) above a `label-caps` label. Active tab also gets a 2px amber top-border accent.

### Bottom Sheets

The task-detail sheet, edit-user sheet, shift-handover sheet, and quick-capture sheet all share: `surface-1` background, 10px top-corner radius and 0px bottom (anchored to screen edge), 20px padding, drag-handle (`hairline-strong`, 40px × 4px, centered, 8px from top). Backdrop is `canvas` at 70% alpha.

### Attachments / Photo Grid

3-column grid, 10px gap, 10px rounded thumbnails. Tapping opens a full-screen lightbox on `canvas` with a single close button (`button-ghost`) top-right. Upload progress shown as a horizontal amber bar across the bottom of the thumbnail being uploaded.

## Do's and Don'ts

- **Do** reserve safety amber (`#FFB400`) for the single most important action on each screen — and for SLA-watch state only. If a screen has two amber elements, one of them is wrong.
- **Don't** introduce a second accent color. The palette has exactly one accent. Information goes through the three status colors, never through new hues.
- **Do** use JetBrains Mono for any number that represents a *measured quantity* — durations, timestamps, IDs, counts. Inter for everything else.
- **Don't** use mono for non-numeric labels or prose. The mono is an instrument readout, not a typographic choice.
- **Do** maintain a 48px touch target for any primary control and 56px for controls likely to be tapped with gloves (PIN keys, Start/Stop, photo capture).
- **Don't** use `box-shadow` anywhere. Hierarchy comes from tonal layers and hairlines.
- **Do** keep status chips in `label-caps` and always uppercase. The wide letter-spacing is what makes the system feel industrial.
- **Don't** mix corner radii inside a single card. If the card is 6px, every element inside must be 4px or 6px — not 10px.
- **Do** show the REC timer pill only when a timer is actively running. A greyed-out pill is visual noise.
- **Don't** use red for anything except overdue / escalated / REC-active / destructive. Red is the loudest signal in the system and must stay rare.
- **Do** maintain WCAG AA contrast (4.5:1 for body, 3:1 for `label-caps` ≥14px equivalent). The dark canvas + `#F2F4F7` ink passes 14.8:1.
- **Don't** add gradients, glassmorphism, or any decorative effect. This is a tool, not a showcase.
- **Do** prefer the existing `escHtml` helper when rendering dynamic strings in `innerHTML`. The system's flatness is not an excuse to skip XSS hygiene.
