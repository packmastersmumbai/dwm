---
version: beta
name: TaskFlow Calm Material
description: "A calm, legible design system for the Pack Masters DWM task-management web app. Light warm-white canvas, indigo as the single primary accent, monospaced numerals for timers and task IDs. Mobile-first with glove-friendly tap targets. Inter for UI prose, JetBrains Mono for timestamps and durations. Three semantic status colors — emerald (on-time/done), amber (watch), red (overdue/REC) — keep state readable at arm's length. Subtle 1px shadows and hairline borders replace decorative effects; the screen should feel quiet, not busy."

colors:
  primary: "#4F46E5"
  on-primary: "#FFFFFF"
  primary-hover: "#4338CA"
  primary-pressed: "#3730A3"

  canvas: "#FAF9F7"
  surface-1: "#FFFFFF"
  surface-2: "#F4F2EE"
  surface-3: "#EAE6DF"
  surface-inverse: "#1F2328"

  ink: "#1F2328"
  ink-muted: "#4A5260"
  ink-subtle: "#6B7280"
  ink-disabled: "#B5BAC2"
  ink-on-light: "#1F2328"

  hairline: "#E5E1DA"
  hairline-strong: "#D3CFC7"
  focus-ring: "#6366F1"

  status-ontime: "#10B981"
  status-ontime-bg: "#ECFDF5"
  status-watch: "#F59E0B"
  status-watch-bg: "#FFFBEB"
  status-overdue: "#DC2626"
  status-overdue-bg: "#FEF2F2"
  status-done: "#6B7280"
  status-done-bg: "#F3F4F6"

  rec-active: "#DC2626"
  rec-active-bg: "#FEF2F2"

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

# TaskFlow Calm Material

## Overview

TaskFlow is a daily-work-management (DWM) tool for the Pack Masters factory floor. The interface is read by supervisors and operators between shifts, on cheap Android phones, sometimes one-handed, often while wearing gloves, under bright fluorescent or daylight conditions. The design system is engineered around three priorities, in order:

1. **Legibility at arm length** — status of any task must be readable in under a second without parsing text, by color and shape alone.
2. **Glove-friendly tap targets** — primary actions are 48px minimum; the PIN keypad and bottom-nav use 56–64px.
3. **Quiet signal, never noise** — a single indigo accent (`#4F46E5`) drives attention. Red is reserved for overdue / escalated / REC-active states only. The surface is a warm off-white that stays comfortable across a full shift.

The vibe is **calm material**: it should feel like a well-organised paper workbook, not a consumer to-do app. Subtle 1px shadows, hairline borders, monospaced numerals for any time or quantity. Visual hierarchy comes from tonal layers, a single accent, and restrained elevation.

## Colors

The palette is anchored in a warm off-white canvas with three tonal surface layers and one indigo accent. Status is communicated by three semantic colors (emerald / amber / red) that double as low-alpha background fills so a task chip is readable even at low contrast or with screen glare.

- **Primary — Indigo (`#4F46E5`):** The sole driver of attention. Used exclusively for primary CTAs (Start, Stop, Save, Sign In), the active bottom-nav tab, focus rings, and selected filter chips. Never used decoratively.
- **Canvas (`#FAF9F7`):** The default page background. Warm off-white that reduces glare and feels paper-like.
- **Surface 1 / 2 / 3 (`#FFFFFF`, `#F4F2EE`, `#EAE6DF`):** Three tonal layers for cards, elevated cards, and bottom sheets. Hierarchy is conveyed by lift and a faint 1px shadow.
- **Ink (`#1F2328`):** Primary text. Near-black, never pure black, to keep the page calm.
- **Ink Muted (`#4A5260`) / Ink Subtle (`#6B7280`):** Secondary text, metadata, helper copy.
- **Status — On-Time Emerald (`#10B981`):** Tasks completed within SLA. Also used for the success toast.
- **Status — Watch Amber (`#F59E0B`):** Tasks within the SLA warning window (default: 25% of duration remaining).
- **Status — Overdue Red (`#DC2626`):** Tasks past SLA, escalated tasks, REC-active timer pill, destructive confirm buttons.
- **Status — Done Slate (`#6B7280`):** Completed-and-archived; signals no longer needs attention.

## Typography

Two type families, used in strict role separation:

- **Inter** — All prose, labels, headings, button text. Chosen for its high x-height and excellent rendering at 13–16px on low-DPI Android screens. Used in weights 400 / 500 / 600 / 700.
- **JetBrains Mono** — All numerals that represent measured quantities: timer displays (`02:14:33`), timestamps, task IDs (`TF-1284`), durations, photo upload counts, SLA countdowns. The monospaced grid evokes the precision of a digital stopwatch and aligns multi-row data without manual padding.

Scale is compact (11–32px) because the app runs in an iframe inside the Apps Script wrapper — every pixel of vertical space is contested.

- **Display LG (32px / 700)** — Reserved for the PIN-login welcome and Reports KPI hero numbers.
- **Headline LG (24px / 700)** — Screen titles (My Day, Team Board).
- **Headline MD (20px / 600)** — Task title in the detail sheet.
- **Headline SM (17px / 600)** — Card titles in kanban columns.
- **Body LG / MD / SM** — Prose, descriptions, metadata. `body-md` (14px) is the workhorse.
- **Label CAPS (11px / 700, +0.12em tracking)** — Status chips (`OVERDUE`, `IN-PROGRESS`, `DONE`), bottom-nav labels, section dividers. Always uppercase.
- **Mono Timer (18px)** — The REC pill and active-task counters.
- **Mono Meta (12px)** — Timestamps, durations, due-dates inline with task rows.
- **Mono ID (11px)** — Task short-codes (`#TF-1284`) shown subtle in card corners.

## Layout

The app is a fluid single-column mobile layout with a fixed-max-width of 480px on tablets and desktop (the iframe wrapper enforces this). There is no multi-column desktop view — the design is consciously phone-first because that is where every shift starts.

- **Screen padding:** 16px left/right, top safe-area + 12px, bottom = `bottom-nav-h` (64px) + 12px so content never sits under the nav.
- **Card padding:** 16px internal, 12px between stacked cards.
- **Section rhythm:** 24px between distinct sections, 8px between tightly-coupled rows.
- **Spacing scale:** strict 4px base — `xs(4) / sm(8) / md(12) / lg(16) / xl(24) / xxl(32)`.
- **Touch targets:** 44px minimum (`touch-min`), 56px for controls likely to be tapped with gloves (`touch-glove`) — PIN keys, bottom-nav, start/stop timer buttons, photo-capture button.
- **Bottom nav:** persistent 64px bar, 5 tabs (Home / My Day / Team / Reports / Admin), centered icons with `label-caps` below. Active tab is indigo, inactive is `ink-subtle`.

## Elevation & Depth

Hierarchy comes from three sources, in this order:

1. **Tonal layering** — `canvas → surface-1 → surface-2 → surface-3`. A bottom sheet sits on `surface-1` over a dimmed canvas (60% alpha overlay).
2. **Hairline borders** — `1px solid {hairline}` separates cards from canvas and rows from each other. `hairline-strong` for focus and active states.
3. **Subtle 1px shadow** — `0 1px 2px rgba(0,0,0,0.04)` on cards, `0 -4px 16px rgba(0,0,0,0.06)` on bottom sheets. Nothing heavier. Drop shadows are a quiet hint of lift, never decoration.

## Shapes

The shape language is soft architectural with one exception.

- **4px (sm)** — Buttons, inputs, status chips, PIN keys.
- **6px (md)** — Cards and the task detail panel — soft enough to read as lifted from below.
- **10px (lg)** — Photo thumbnails in the attachment grid and bottom sheets.
- **Pill (`9999px`)** — Filter chips (`All / Shared / Mine`) and the REC timer pill only. The pill shape is reserved for state, never for action.

Mixing radii within a single card is forbidden — see Do and Do Not.

## Components

### Buttons

- **Primary** — Indigo background, white text, 48px height, 4px radius, `label-md` (14px / 600). Only one primary button per screen. Used for: Start Timer, Stop Timer, Save Task, Submit PIN, Mark Done, Upload Photo.
- **Secondary** — `surface-1` background with `hairline-strong` border, ink text. For Cancel, Back, Defer.
- **Ghost** — Transparent, muted ink. For tertiary inline actions (View, Edit, Reply).
- **Danger** — Overdue red, used for Delete Task, Force Stop Timer, confirm-destructive dialogs only. Always paired with a Secondary cancel.

### Status Chips

Variants matching the live semantic statuses. Always `label-caps` (uppercase 11px), 4px radius, 6px padding, low-alpha background-fill so the color is the message:

- `ON-TIME` — emerald
- `IN-PROGRESS` — indigo
- `OVERDUE` — red
- `DONE` — slate

### REC Timer Pill

The single most-attention-grabbing element in the app. Pill shape, red background-fill (`rec-active-bg`), red text, mono-timer (18px) showing live `HH:MM:SS`. Pulses gently (1.5s ease) only while a timer is active. Visible in the top-right of every screen via the global app shell — when there is no active timer it is hidden entirely, not greyed out.

### Filter Chips

Pill-shaped, `surface-1` background when inactive, indigo when active. Used on Team Board (`All / Shared / Mine`), Reports (date ranges), Admin (user role filters). Minimum 36px height.

### Lists / Task Rows

A task row is a horizontal flex card on `surface-1` with: status chip (left), title + mono-meta due-date stack (center, grows), assignee avatar or initials (right), task-id `mono-id` in the bottom-right corner. Tap-target wraps the entire row (56px minimum). Long-press opens the detail sheet.

### Input Fields

- 48px height, `surface-1` background, 4px radius, 1px `hairline-strong` border by default.
- Focus state: `focus-ring` (indigo) border with a soft 3px outer halo at 15% alpha.
- Helper text uses `body-sm` muted; error text uses `body-sm` in `status-overdue`.
- The text field caret is indigo.

### PIN Keypad

The login keypad uses 64px keys (`pin-key`) in a 3-column grid, `surface-2` background, `headline-md` digits. Pressed state inverts to indigo background / white text. The 4-digit PIN display above uses `display-lg` with one filled-circle per entered digit.

### Bottom Navigation

Fixed 64px bar on `surface-1`, top 1px `hairline` border, 5 evenly-spaced tabs. Each tab is an icon (24px stroke, `ink-subtle` inactive, `primary` active) above a `label-caps` label. Active tab also gets a 2px indigo top-border accent.

### Bottom Sheets

The task-detail sheet, edit-user sheet, shift-handover sheet, and quick-capture sheet all share: `surface-1` background, 10px top-corner radius and 0px bottom (anchored to screen edge), 20px padding, drag-handle (`hairline-strong`, 40px × 4px, centered, 8px from top). Backdrop is `canvas` at 60% alpha.

### Attachments / Photo Grid

3-column grid, 10px gap, 10px rounded thumbnails. Tapping opens a full-screen lightbox on `canvas` with a single close button (`button-ghost`) top-right. Upload progress shown as a horizontal indigo bar across the bottom of the thumbnail being uploaded.

## Do and Do Not

- **Do** reserve indigo (`#4F46E5`) for the single most important action on each screen. If a screen has two indigo CTAs, one of them is wrong.
- **Do not** introduce a second accent color. The palette has exactly one accent. Information goes through the three status colors, never through new hues.
- **Do** use JetBrains Mono for any number that represents a measured quantity — durations, timestamps, IDs, counts. Inter for everything else.
- **Do not** use mono for non-numeric labels or prose. The mono is an instrument readout, not a typographic choice.
- **Do** maintain a 48px touch target for any primary control and 56px for controls likely to be tapped with gloves (PIN keys, Start/Stop, photo capture).
- **Do not** stack heavy shadows. One subtle 1px shadow is the ceiling; everything else is hairline + tonal.
- **Do** keep status chips in `label-caps` and always uppercase. The wide letter-spacing is what gives the system its quiet-precision feel.
- **Do not** mix corner radii inside a single card. If the card is 6px, every element inside must be 4px or 6px — not 10px.
- **Do** show the REC timer pill only when a timer is actively running. A greyed-out pill is visual noise.
- **Do not** use red for anything except overdue / escalated / REC-active / destructive. Red is the loudest signal in the system and must stay rare.
- **Do** maintain WCAG AA contrast (4.5:1 for body, 3:1 for `label-caps` >=14px equivalent). The off-white canvas + `#1F2328` ink passes 14.6:1.
- **Do not** add gradients, glassmorphism, or any decorative effect. This is a tool, not a showcase.
- **Do** prefer the existing `escHtml` helper when rendering dynamic strings in `innerHTML`. The system calmness is not an excuse to skip XSS hygiene.
