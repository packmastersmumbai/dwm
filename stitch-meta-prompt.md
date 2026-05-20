# TaskFlow — Stitch Design Meta Prompt + Claude Code Implementation Prompt
> **Version 3** — Full spec with team visibility, shared tasks, all critical fixes applied.
>
> **Workflow:** Paste Deliverable 1 into Stitch first (design system). Then paste each Screen
> prompt individually. Screenshot all outputs. Feed screenshots + Deliverable 3 into Claude Code.

---

## Deliverable 1 — Master Design System (paste into Stitch once)

```
Design a mobile-first work management PWA called "TaskFlow" for Google Apps Script.
Generate a complete design system and component library.

DESIGN PHILOSOPHY
Icon-first, text-minimal. Every state communicated through color, icon, and shape — not words.
One thumb, one tap. No action requires more than 2 taps from any screen.
Living dashboard — the app breathes: timers tick, presence dots pulse, progress fills in real time.
Team-aware by default — every screen shows the team, not just the individual.

PLATFORM
Mobile web 375px base. All touch targets ≥48×48px. One-handed thumb reach. Scales to 768px desktop.

COLOR SYSTEM (exact hex — no deviation)
Primary:          #1A73E8
Surface:          #F8F9FA
Card:             #FFFFFF
Text primary:     #202124
Text secondary:   #5F6368
Divider:          #DADCE0
Amber (timer):    #FA7B17
Warning bg:       #FEF3F2

Status (left border 4px + column bg 10% opacity + icon):
  To Do:        #9AA0A6  icon: ○ circle-outline
  In Progress:  #1A73E8  icon: ▶ play-circle   ← pulse ring on active cards
  Done:         #34A853  icon: ✓ check-circle
  Blocked:      #EA4335  icon: ⏸ pause-circle

Priority (4px left border on every card — no text label needed):
  Urgent: #EA4335
  High:   #FA7B17
  Medium: #FBBC04
  Low:    #34A853

Ownership colors (task card top-right corner indicator):
  Mine:       #1A73E8 dot
  Shared/Pool:#9334E6 dot + 👥 badge
  Colleague:  avatar color dot

Presence states (user avatar dot 8px):
  Active now:   #34A853 pulsing
  Idle >10min:  #FBBC04 static
  Offline:      #DADCE0 static

Client tag: colored pill 24px height, white 11px/500, 4px radius.
  6 colors cycling: #4285F4 #EA4335 #34A853 #FA7B17 #9334E6 #00ACC1

TYPOGRAPHY
  Google Sans (fallback Inter, system-ui)
  Title:    18px/600
  Body:     14px/400
  Label:    12px/500
  Tag/pill: 11px/500
  Timer:    28px/700 monospace
  Stat num: 32px/700

CARD SPEC
  Radius: 12px
  Shadow: 0 1px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)
  Left border: 4px solid [priority color]
  Padding: 12px 14px
  Min height: 68px
  Owned-by indicator: top-right corner, avatar 20px circle with presence dot

PLAY / STOP BUTTON (core interaction — must be unmistakable)
  52px circle, vertically centered right of every task card.
  Idle:    #34A853 fill, white ▶ 20px
  Active:  #EA4335 fill, white ■ 18px + pulsing ring:
           @keyframes pulse-ring {0%{opacity:.8;transform:scale(1)} 100%{opacity:0;transform:scale(1.6)}} 1.5s infinite
  Tap zone: 60×60px invisible padding
  Disabled (colleague's task): #DADCE0 fill, grey ▶, no tap response, 👁 icon instead

GLOBAL TIMER BANNER (when any timer runs — 40px below top bar, pushes content down)
  Background: #FA7B17
  Left: ▶ 14px + task name truncated 13px/500 white
  Center: "00:14:32" 16px/700 monospace white
  Right: ■ white outline button 28px
  Animation: left-right shimmer 2s loop

PRESENCE STRIP (32px — appears below timer banner or top bar on Team screens)
  Background: #F8F9FA, border-bottom: 1px #DADCE0
  Content: horizontal scroll of avatar chips — 28px circle + presence dot + first name 10px
  If working: tiny ▶ badge bottom-right of avatar in task's priority color
  Tapping avatar: scrolls/filters to that user's view

TOP APP BAR: 56px. Left: screen title or ← back. Right: 🔍 search + 🔔 bell (with unread badge) + avatar.

BOTTOM NAV: 56px + safe-area. 4 tabs:
  🏠 Home (My Kanban) | 📋 My Day | 👥 Team | ⚙ Admin (admin only, else 👤 Profile)
  Active: #1A73E8 icon + 2px top border. Inactive: #9AA0A6 no label.

FAB: 56px circle #1A73E8, white + 24px.
  Position: bottom-right, 16px from edge, calc(72px + safe-area-inset-bottom) from bottom.
  Shadow: 0 4px 12px rgba(26,115,232,0.4)
  Tap → Quick Capture sheet (NOT full form).

UNDO TOAST (appears after every destructive action)
  Bottom of screen, above nav, 48px height, #202124 bg, white text 13px.
  Left: action description "Task marked done". Right: "UNDO" #1A73E8 text button.
  Auto-dismisses 5s. Slide-up 200ms entry, slide-down 200ms exit.

SEARCH OVERLAY (tap 🔍 in top bar)
  Full screen white overlay slides down. Search input autofocus top.
  Results: live-filtered task cards below as you type. No server call.
  Close: ✕ button or swipe down.

NOTIFICATION PANEL (tap 🔔 in top bar)
  Slides down from top bar, 80% screen height, white, 16px bottom radius.
  Header: "Notifications" + "Mark all read" link.
  Rows: icon (type color) + message 13px + time 11px #9AA0A6 + unread dot #1A73E8.
  Types: 📋 assigned | 💬 mentioned | ⏰ due soon | ✅ shared task done | ⚠ timer >3h
```

---

## Deliverable 2 — Per-Screen Stitch Prompts

---

### Screen 1 — PIN Login

```
Design the TaskFlow login screen. Full screen, no scroll, vertically centered.

TOP (top 35%):
  64px circle #1A73E8, white ⚡ icon.
  "TaskFlow" 24px/700 #202124.
  "Your work. Your pace." 13px #9AA0A6.

USER SELECT:
  Horizontal scroll of user chips — 32px avatar circle (initials, avatar_color bg) + name 11px below.
  Selected: 2px #1A73E8 border + #E8F0FE bg.
  No dropdown — chips only.

PIN DOTS (24px below user row):
  4 circles 20px, 14px gap, centered.
  Empty: 1.5px #DADCE0 border. Filled: #1A73E8 solid. Error: #EA4335 + shake animation.
  Locked state: 🔒 icon + "Locked — try in Xm" 12px #EA4335 below dots.

PIN PAD:
  3×4 grid, 68px buttons, 10px gap.
  1–9, blank, 0, ← backspace.
  Normal: white fill, 1px #DADCE0 border, #202124 24px/400.
  Pressed: #E8F0FE fill, #1A73E8 border.
  Auto-submit on 4th digit. No login button shown.
```

---

### Screen 2 — My Kanban (Home Tab)

```
Design the TaskFlow personal Kanban board. Shows MY tasks only.
Bottom nav: Home tab active.

TOP BAR: "My Board" + 🔍 + 🔔 + avatar.
GLOBAL TIMER BANNER: visible when timer active.

FILTER ROW (horizontal scroll, below banner):
  Chips: Today (default active) | This Week | All | Overdue (red count badge).
  Active chip: #1A73E8 fill white text. Inactive: outline.

KANBAN (horizontal scroll, snap):
  4 columns 280px each. Column bg = status color 10% opacity.

  COLUMN HEADER (sticky):
    Status icon 16px + name 13px/600 + count badge + ⊕ button (opens Quick Capture with status pre-set).

  TASK CARD:
    LEFT BORDER: 4px priority color.
    TOP ROW: task title 14px/500, 1 line truncate.
    BOTTOM ROW: [client pill] [category icon 14px] [due date 🗓 11px — red if overdue]
                [checklist badge "3/5 ✓" 11px #5F6368 if has checklist]
    TOP-RIGHT: assignee avatar 20px + presence dot.
    RIGHT: play/stop 52px button.
    ACTIVE TIMER STATE: 2px #EA4335 full outline + "● REC 00:14:32" 11px #EA4335 bottom row.

  DONE COLUMN: greyed cards (60% opacity), no play button. "Archive older tasks" link at column bottom.

FAB: bottom-right. BOTTOM NAV: Home active.
```

---

### Screen 3 — Quick Capture (Bottom Sheet — FAB tap)

```
Design the Quick Capture bottom sheet for TaskFlow.
Slides up over any screen (bg dims 40%). Drag handle top.
Sheet height: 320px fixed (not full screen — stays accessible).

TITLE INPUT:
  Full-width, large 18px placeholder "What needs to be done?", autofocus, no border box — bottom border only 1px #1A73E8.
  Below: character count 11px #9AA0A6 right-aligned.

CLIENT ROW (👤 icon left, no text label):
  Horizontal scroll of client color pills. Tap to select (solid fill). "+ New" dashed pill end.

PRIORITY ROW (🚨 icon left):
  4 colored circle buttons 32px: ● Urgent(#EA4335) ● High(#FA7B17) ● Med(#FBBC04) ● Low(#34A853).
  Selected: 3px white ring inside circle (inset border). Unselected: 40% opacity.
  Default: Medium pre-selected.

SHARED TOGGLE ROW (👥 icon left + toggle right):
  Label: none — icon only. Toggle: iOS-style #1A73E8 active.

SCHEDULE ROW (🕐 icon left):
  3 pill chips: ☀ Morning | ⛅ Afternoon | 🌙 Evening. One selectable. Default: none.

BOTTOM:
  "＋ More details" text link left (opens full Add Task screen with fields pre-filled).
  "Add Task" full-width button right 48px #1A73E8. Disabled until title ≥3 chars.
```

---

### Screen 4 — My Day / Focus View (My Day Tab)

```
Design the My Day screen for TaskFlow. Flat list, action-focused, zero Kanban.
Bottom nav: My Day tab active.

TOP BAR: "My Day" + date "Mon 17 May" right.

MORNING GREETING CARD (80px, #E8F0FE bg, 12px radius, top of list):
  Left: avatar 40px + "Good morning, [name]" 16px/600.
  Right: "X tasks · Yh estimated" 12px #5F6368 stacked.

SECTION HEADERS (inline in list, 32px):
  ⚠ OVERDUE (red, count badge) | ▶ IN PROGRESS | 📋 TODAY | 📅 UPCOMING
  Each collapsible with chevron.

TASK ROW (56px, no card shadow — flat list style):
  LEFT: swipe-right zone (invisible). Swipe reveals green ✓ bg.
  Priority dot 8px | task title 14px/500 | client pill 11px below title.
  RIGHT: play/stop 44px circle + chevron › to open detail.
  DONE ROW: strikethrough title, #9AA0A6 text, ✓ icon left.

SHARED POOL SECTION (bottom of list, separated by full-width divider):
  Header: "👥 Shared Pool — X unclaimed" 13px/600 #9334E6.
  Rows: same style + "Claim ▶" pill button right (#9334E6 outline).

BOTTOM SUMMARY BAR (40px above nav):
  "X done · Y left · Zh logged today" — icon + number only, colored.

FAB: visible. BOTTOM NAV: My Day active.
```

---

### Screen 5 — Team Board (Team Tab — default sub-view)

```
Design the Team Board screen — the core team visibility screen. Shows ALL tasks across ALL users.
Bottom nav: Team tab active.

TOP BAR: "Team" + 🔍 + 🔔.
PRESENCE STRIP: all users with presence dots + active task badge.

SUB-TAB ROW (below presence strip):
  Board | Timeline — underline indicator #1A73E8. Board is default active.

FILTER ROW (horizontal scroll):
  "All" chip (default) | [user avatar chip per team member — tap to filter to that user's tasks]
  | 👥 Shared chip | client pill chips.
  Active chip: solid fill. Tap again to deselect.

TEAM KANBAN (same column structure as My Kanban):
  4 columns: To Do | In Progress | Done | Blocked.

  TASK CARD DIFFERENCES vs My Kanban:
    TOP-RIGHT: prominent avatar 24px with presence dot (whose task it is).
    SHARED CARD: #9334E6 left border variant + 👥 icon top-right instead of avatar.
    MY TASKS: normal play/stop button (green).
    COLLEAGUE TASKS: play button replaced by 👁 eye icon (#DADCE0, disabled).
    CURRENTLY RUNNING: pulsing #EA4335 outline + "● REC HH:MM:SS" + colleague avatar badge.

  IN PROGRESS COLUMN (most important — should be most visible):
    Pinned as second column, always partially visible even on To Do scroll position.
    Cards with running timers float to top of column automatically.

EMPTY STATE per column: simple inline icon + count "0 tasks" — no illustration needed.
```

---

### Screen 6 — Team Timeline (Team Tab — Timeline sub-view)

```
Design the Team Timeline view. Accessed via Team tab → Timeline sub-tab.
Same TOP BAR, PRESENCE STRIP, SUB-TAB ROW as Team Board.

DATE NAV ROW (below sub-tabs):
  ← chevron | "Today, Mon 17 May" 14px/600 center | chevron →.
  Tap date → date picker.

TIMELINE LAYOUT (main content area, vertical scroll for users, horizontal scroll for time):

  TIME AXIS HEADER (sticky top, 28px):
    Hours 8|9|10|11|12|1|2|3|4|5|6|7 — 60px per hour.
    NOW: vertical red line full height + "NOW" red pill 20px.

  USER ROW (72px tall per user, 1px #DADCE0 divider):
    LEFT COLUMN (64px, sticky): avatar 32px + presence dot + name 10px/500.
    RIGHT (horizontal scroll, matches time axis width):

    TASK BLOCK:
      Position: left = (startHour - 8) × 60px. Width = durationMinutes × 1px.
      Min width: 64px. Height: 48px. Radius: 8px.
      ACTUAL (has time_log): solid fill at status color 25% opacity, 1px status color border.
        Content: title 11px/500 truncated + client pill 9px.
      PLANNED (no time_log, due today): dashed 1.5px border, 10% opacity fill.
        Content: title 11px/500 + 🕐 icon.
      RUNNING NOW: animated fill overlay #1A73E8 10% sweeping left→right + pulsing border.
      OVERDUE: red hatch pattern extends past NOW line.
      DUE WITHIN 2H: ⚡ icon top-right corner of block in #FA7B17.
      Done: ✓ overlay, text strikethrough, 30% opacity.

  SHARED ROW (bottom, separated by 2px divider):
    LEFT: "👥 Shared" 10px/500 #9334E6.
    Blocks: same style but #9334E6 color scheme. "Claim" chip below unclaimed blocks.

PINCH-TO-ZOOM: horizontal axis scales 30min→2h per visible window.
```

---

### Screen 7 — Task Detail (Bottom Sheet)

```
Design the task detail bottom sheet. Slides up over current screen (bg 40% dim).
Top: 16px radius, 32×4px drag handle. Height: 85% screen, content scrolls inside.

HEADER (not scrollable):
  [Priority dot 10px] task title 18px/600, 2 lines max.
  Right: ✏ edit + ✕ close.

OWNERSHIP ROW:
  If mine: "Assigned to me" + my avatar.
  If shared: "👥 Shared task" #9334E6 + claimer avatar or "Unclaimed" dashed pill.
  If colleague's: colleague avatar + name + "viewing only" grey text.

STATUS CHIPS (icon + color, minimal text):
  ○ · ▶ · ✓ · ⏸ — 40px each, icon in status color, selected = solid fill white icon.

META GRID (2×2):
  👤 [client pill] | 🏷 [category icon + name]
  🚨 [priority color dot + label] | 📅 [due date — red if overdue]

TIMER CARD (80px):
  Not started + mine: "▶ START TIMER" full width #34A853, 14px/600 white.
  Running + mine: "00:14:32" 28px/700 center + "■ STOP & DONE" #EA4335 full width. Pulsing border.
  Running + colleague: "▶ [Name] is working on this — 00:14:32" amber, read-only.
  Shared + unclaimed: "▶ CLAIM & START" full width #9334E6.
  Time log accordion: [📅 date] [avatar 16px] [duration right-aligned] rows.

CHECKLIST SECTION (if has items):
  "Checklist" label + "X/Y" count badge.
  Rows: checkbox 20px + item text 14px. Tap to toggle (strikethrough + #34A853 check).
  "+ Add item" row at bottom, inline text input.

DESCRIPTION: 14px, expandable "↓ more" if >3 lines.

ASSIGNEES: avatar chips 28px + "+" at end.

COMMENTS:
  Flat list: avatar 24px + name 12px/500 bold + text 13px + time 11px #9AA0A6.
  @mention: blue highlighted text #1A73E8 when @name appears in comment.
  Input pinned bottom: avatar + field ("Add comment... @mention to notify") + ➤ send.
```

---

### Screen 8 — Add / Edit Task (Full Form)

```
Design the full Add Task screen. Accessed from "＋ More details" in Quick Capture or edit button.
Top bar: ← + "New Task" / "Edit Task". Form scrollable, 16px padding.

TITLE: bottom-border-only field, 16px, autofocus. Error "Min 3 characters" 12px #EA4335 on blur.

CLIENT (👤 icon, no label): horizontal scroll pill chips. Selected = solid. "+ New" dashed end.
  Red outline on submit if unselected.

CATEGORY (🏷 icon): same chip pattern with emoji icons per category.

PRIORITY (🚨 icon): 4-segment control full width 52px.
  Urgent|High|Med|Low — selected = priority color fill white text. Unselected = white + border.

DUE DATE (📅 icon): tappable row expands to inline date picker.

SCHEDULE (🕐 icon): ☀ Morning | ⛅ Afternoon | 🌙 Evening chips (sets scheduled_time on timeline).

ASSIGN (👥 icon): avatar chip row. "＋ Me" shortcut first. Tap to toggle.

SHARED TOGGLE (👥): toggle switch only, no text label.

RECURRING (🔁 icon): toggle. Expands when on:
  Frequency chips: Daily | Weekly | Monthly.
  Weekly: day-of-week selector (M T W T F S S circles, tap to toggle).
  Monthly: date number selector.

CHECKLIST (☑ icon): toggle. Expands: text input + "＋ Add item" + item list.

NOTES (📝 icon): borderless textarea, 4 lines, #F8F9FA bg.

SAVE: full-width 52px #1A73E8 "Save Task" pinned bottom above keyboard. Disabled 40% until title ≥3 + client + category filled.
```

---

### Screen 9 — Daily Plan (Morning Ritual)

```
Design the Daily Plan screen. Full screen, appears on first login after 8am, once per day.
Has its own entry animation: slides up from bottom over login.

HEADER (80px, #1A73E8 bg):
  "Good morning, [name] 👋" 20px/600 white left.
  Date 13px white/70% below.
  Right: avatar 36px + "Skip →" 13px white link.

SECTION: ⚠ OVERDUE (red header, #FEF3F2 bg):
  "Deal with these first" 12px #EA4335 subheader.
  TASK ROWS (64px each):
    Priority dot | title 14px/500 | client pill | overdue duration "2d late" #EA4335.
    RIGHT ACTIONS: [→ Tomorrow] [▶ Start] [✓ Done] — 3 pill buttons 32px each.
    Colors: grey outline | #34A853 outline | #34A853 fill.

SECTION: 📋 TODAY (blue header):
  "X tasks scheduled" 12px #5F6368.
  Same row format. Scheduled time shown "☀ Morning" or "⛅ Afternoon" pill.
  RIGHT ACTIONS: [⛅ Move] [▶ Start] [✓ Done].

SECTION: 📅 COMING UP (grey header):
  Tomorrow's tasks. Lighter styling.
  RIGHT ACTIONS: [→ Today] [✓ Done].

BOTTOM BAR (above safe area):
  Left: "X tasks to tackle" 13px #5F6368.
  Right: "Begin My Day →" full CTA button #1A73E8.
  Tap CTA → navigates to My Day tab and dismisses plan screen.
```

---

### Screen 10 — Admin Panel

```
Design the Admin panel. Bottom nav: Admin tab active.

TOP BAR: "Admin" + ⚙ settings icon.

STATS ROW (horizontal scroll, 4 metric cards 140px each):
  White card, 12px radius.
  Large stat 28px/700 [status color] + icon above. No text labels — icons only (tooltip on long press).
  Cards: ▶ Active | ⏱ Live (pulse dot) | ✓ Today | ⚠ Overdue.

THREE TABS: Tasks | Workload | Reports | Masters — horizontal underline nav, scrollable if needed.

TASKS TAB:
  FILTER BAR: [User avatar ▾] [Status icon ▾] [Client pill ▾] [📅 Date ▾] — dropdown chips.
  TASK LIST: cards show assignee avatar prominently + play button greyed (👁 for admin).
  Running timers: pulsing #FA7B17 dot + elapsed "Xm" next to avatar.

WORKLOAD TAB:
  One row per user (56px): avatar 32px + name 13px/500 + horizontal capacity bar.
  BAR: total width = max tasks in team. Segments colored by priority.
    Urgent(red) | High(orange) | Medium(yellow) | Low(green).
  Right of bar: task count + "Xh logged" 11px #5F6368.
  Overloaded (>8 tasks): row bg #FEF3F2 + ⚠ icon.

REPORTS TAB:
  DATE RANGE CHIPS: This Week | This Month | Custom.
  USER SELECTOR: avatar chips, tap to filter.
  HOURS BY CLIENT: horizontal bar chart (pure CSS). Each bar = client color + hours label right.
  HOURS BY CATEGORY: same pattern.
  TOTAL ROW: "X tasks · Yh total · Z clients" summary.
  EXPORT: "↓ CSV" button bottom right.

MASTERS TAB:
  3 accordion cards: 👥 Users | 👤 Clients | 🏷 Categories.
  Collapsed: icon + count + ⊕ add right.
  Expanded rows: [avatar/swatch 24px] [name 14px] [edit ✏] [active toggle].
  User row: PIN "••••" + 👁 reveal + role badge (Admin/User chip).
```

---

### Screen 11 — Notifications Panel

```
Design the Notifications panel. Slides down from bell icon tap, overlays current screen.
Width: full screen. Height: 70% screen. Top corners: 0 radius (attached to top bar). Bottom corners: 16px radius.
Backdrop: 30% dim below.

HEADER (48px):
  "Notifications" 16px/600 left. "Mark all read" 13px #1A73E8 right.
  Unread count badge on header title.

NOTIFICATION ROW (56px, tap to navigate to related task):
  LEFT: icon circle 32px (type color fill, white icon).
    📋 assigned → #1A73E8 | 💬 mention → #9334E6 | ⏰ due soon → #FA7B17
    ✅ done → #34A853 | ⚠ timer → #EA4335
  CENTER: message 13px/400, 2 lines max. Time "2m ago" 11px #9AA0A6 below.
  RIGHT: unread dot 8px #1A73E8 (hidden when read).
  Read rows: 70% opacity.

EMPTY STATE: bell icon SVG + "You're all caught up" 15px/500 centered.
```

---

## Deliverable 3 — Claude Code Implementation Prompt

> Screenshot every Stitch screen. Attach all 11 screenshots. Use this prompt in Claude Code.

```
<role>
You are a senior frontend engineer and UI/UX implementer specialising in Google Apps Script
HTML Service. You produce pixel-perfect, mobile-first, fully functional interfaces that match
provided designs exactly. Zero placeholders. Zero TODOs. Every interaction implemented.
</role>

<project>
Build "TaskFlow" — a daily work management PWA on Google Apps Script (doGet → HTML Service).
Backend: Google Sheets (schema below). Attached screenshots are the design authority.
Match every color, spacing, radius, shadow, animation, and interaction in the screenshots.
</project>

<design_reference>
[ATTACH ALL 11 STITCH SCREENSHOTS:
 1-Login 2-MyKanban 3-QuickCapture 4-MyDay 5-TeamBoard
 6-TeamTimeline 7-TaskDetail 8-AddTask 9-DailyPlan 10-Admin 11-Notifications]
Every hex, px, animation, and interaction is defined in the screenshots.
</design_reference>

<sheets_schema>
All sheets created by initializeSheets() if missing. SHEET_ID = '[YOUR_SHEET_ID]'

Sheet "tasks":
  id | title | description | client_id | category_id
  priority(urgent/high/medium/low) | status(todo/inprogress/done/blocked/deleted/archived)
  assignee_ids(comma-sep) | created_by | created_at | due_date | scheduled_time(morning/afternoon/evening)
  is_shared(TRUE/FALSE) | claimed_by | claimed_at
  estimated_minutes | checklist(JSON:[{id,text,done,created_by}])
  recurrence(JSON:{type,days,ends} or null)
  updated_at | archived_at

Sheet "users":
  id | name | pin_hash | salt | role(admin/user)
  avatar_color | email | notify_prefs(JSON:{onAssign,onDue,onMention,onShared})
  is_active | last_seen_at | failed_attempts | locked_until

Sheet "clients":   id | name | color_hex | is_active
Sheet "categories": id | name | icon_emoji | is_active

Sheet "time_log":
  id | task_id | user_id | started_at | stopped_at | duration_seconds | last_heartbeat

Sheet "activity":
  id | task_id | user_id | action | detail | created_at

Sheet "notifications":
  id | user_id | type(assigned/mention/due_soon/shared_done/timer_warning) | task_id | message | is_read | created_at

Sheet "settings":
  key | value
  Defaults: timezone=Asia/Kolkata | working_start=8 | working_end=20 | archive_after_days=3
            timer_warning_hours=3 | auto_archive=TRUE
</sheets_schema>

<server_functions>
All functions return {success:boolean, data:any, error?:string}.
All mutating functions use LockService. All verify session role server-side.

── SETUP ──────────────────────────────────────────────────────────────────────
doGet(e)
  → initializeSheets()
  → return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('TaskFlow')
      .addMetaTag('viewport','width=device-width,initial-scale=1,viewport-fit=cover')

initializeSheets()
  → for each sheet in schema: if !ss.getSheetByName(name) create with headers
  → insert default settings rows if settings sheet empty
  → idempotent — safe to call on every page load

── AUTH ───────────────────────────────────────────────────────────────────────
loginUser(name, pin)
  → find user row by name (case-insensitive)
  → if locked_until > now: return {error:'locked', minutesLeft: X}
  → hash: Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin + salt)
  → if mismatch: increment failed_attempts; if >=5 set locked_until=now+15min
  → if match: reset failed_attempts=0, update last_seen_at
  → return {userId,name,role,avatarColor,email,notifyPrefs} (no pin_hash/salt)

getUsers()
  → all active users, exclude pin_hash and salt, include last_seen_at + activeTimer if running

createUser(payload)  → {name,pin,role,email,avatarColor}
  → generate salt=Utilities.getUuid(), hash pin+salt
  → insert row → return userId

updateUser(userId, fields, requestingUserId)
  → verify requesting user is admin
  → if fields.pin: re-hash with existing salt
  → if fields.resetLock: set failed_attempts=0, locked_until=null
  → update row → return success

── TASKS ──────────────────────────────────────────────────────────────────────
getTasks(filters)
  → filters: {userId?, status[]?, clientId?, isShared?, dateFrom?, dateTo?,
              includeArchived?, assignedTo?, teamView?}
  → if teamView=true: return all non-deleted/archived tasks (for Team Board)
  → if userId and not teamView: return tasks where assignee_ids contains userId OR created_by=userId
  → sort: priority rank (urgent→low) then due_date asc then created_at desc
  → expand: client object, category object, assignee user objects (id+name+avatarColor only)

getTask(taskId)
  → single task + expanded objects + full time_log array + activity array (last 20)

quickAddTask(payload)
  → {title, clientId, priority, isShared, scheduledTime, createdBy}
  → status defaults to 'todo', estimated_minutes=null
  → insert row → createNotification for assignees if any
  → return {taskId, task}

createTask(payload)
  → {title,description,clientId,categoryId,priority,status,assigneeIds,dueDate,
     scheduledTime,isShared,estimatedMinutes,checklist,recurrence,createdBy}
  → LockService.getScriptLock().waitLock(5000)
  → insert row with Utilities.getUuid() id
  → logActivity(taskId, createdBy, 'created', title)
  → for each assigneeId != createdBy: createNotification(assigneeId,'assigned',taskId,'[name] assigned you: '+title)
  → if isShared: notify all active users createNotification(uid,'shared',taskId,'New shared task: '+title)
  → release lock → return {taskId, task}

updateTask(taskId, fields, requestingUserId)
  → LockService.getScriptLock().waitLock(5000)
  → read current row, apply fields
  → if status changed: logActivity(taskId, requestingUserId, 'status_changed', oldStatus+'→'+newStatus)
  → if status='done' AND recurrence set: call scheduleNextRecurrence(taskId)
  → update updated_at → release lock → return updated task

deleteTask(taskId, userId)
  → set status='deleted' → logActivity → return success

archiveOldDoneTasks()
  → called by time-driven trigger daily 2am
  → find tasks where status='done' AND updated_at < now - archive_after_days setting
  → set status='archived', archived_at=now
  → return count archived

── TIMER ──────────────────────────────────────────────────────────────────────
startTimer(taskId, userId)
  → LockService.getScriptLock().waitLock(5000)
  → check no open time_log row for this userId (stopped_at IS NULL) — if found, auto-close it first
  → if task.is_shared AND task.claimed_by != userId: return {error:'not_claimed'}
  → insert time_log row: id, taskId, userId, started_at=now(), stopped_at=null, last_heartbeat=now()
  → updateTask(taskId, {status:'inprogress'})
  → logActivity(taskId, userId, 'timer_started', '')
  → release lock → return {logId, startedAt, taskId}

stopTimer(logId, userId, markDone)
  → LockService.getScriptLock().waitLock(5000)
  → find time_log row, verify userId matches
  → set stopped_at=now(), duration_seconds=stopped_at-started_at
  → if markDone: updateTask(taskId, {status:'done', claimed_by:null, claimed_at:null})
  → logActivity → release lock → return {duration, task}

getActiveTimer(userId)
  → find time_log row where user_id=userId AND stopped_at IS NULL
  → if last_heartbeat < now - 10min: auto-close row (set stopped_at=last_heartbeat), return null
  → return {logId, taskId, taskTitle, startedAt,
            elapsed: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)}

heartbeatTimer(logId, userId)
  → find time_log row, verify userId
  → update last_heartbeat=now() → return success

checkTimerWarnings()
  → find all open time_log rows where started_at < now - timer_warning_hours setting
  → for each: createNotification(userId,'timer_warning',taskId,'Timer running >Xh on: '+title)
  → called by time-driven trigger every 30 minutes

── SHARED TASKS ───────────────────────────────────────────────────────────────
claimTask(taskId, userId)
  → LockService.getScriptLock().waitLock(5000)
  → read task row
  → if claimed_by IS NOT NULL AND claimed_by != userId:
      release lock → return {success:false, alreadyClaimed:true, claimedBy: name}
  → set claimed_by=userId, claimed_at=now()
  → logActivity(taskId, userId, 'claimed', '')
  → notify task creator: createNotification(createdBy,'assigned',taskId,name+' claimed: '+title)
  → release lock → then call startTimer(taskId, userId)
  → return {success:true, logId, startedAt}

unclaimTask(taskId, userId)
  → LockService.getScriptLock().waitLock(5000)
  → verify claimed_by=userId → set claimed_by=null, claimed_at=null
  → if open timer: stopTimer without markDone
  → release lock → return success

── TEAM ───────────────────────────────────────────────────────────────────────
getTeamStatus()
  → all active users with:
    presence: if last_seen_at < 2min ago → 'active', <10min → 'idle', else → 'offline'
    activeTimer: open time_log row → {taskId, taskTitle, startedAt, elapsed}
    tasksInProgress: tasks where assignee_ids contains userId AND status='inprogress'
    tasksDoneToday: count tasks where status='done' AND updated_at > today midnight

getTimeline(date)
  → tasks where due_date=date (planned) OR time_log entries on date (actual)
  → group by assignee: [{userId, tasks:[{taskId, title, clientId, priority, status,
      actualStart, actualEnd, estimatedMinutes, scheduledTime, isRunning}]}]
  → shared tasks in separate group
  → for planned tasks without time_log: position = scheduledTime (morning=8am, afternoon=1pm, evening=5pm)

── NOTIFICATIONS ──────────────────────────────────────────────────────────────
getNotifications(userId)
  → notifications where user_id=userId, ORDER BY created_at DESC, LIMIT 30
  → return {notifications, unreadCount}

markNotificationRead(notifId)  → set is_read=TRUE → return success
markAllNotificationsRead(userId) → set all is_read=TRUE for userId → return success

createNotification(userId, type, taskId, message)
  → insert notification row
  → if user.email AND user.notify_prefs[type]=true: MailApp.sendEmail(email, 'TaskFlow: '+type, message)

sendDueSoonNotifications()
  → called by time-driven trigger daily 8am
  → find tasks where due_date=today AND status NOT IN (done,archived,deleted)
  → for each assignee: createNotification(uid,'due_soon',taskId,'Due today: '+title)
  → find tasks where due_date < today AND status NOT IN (done,archived,deleted)
  → for each assignee: createNotification(uid,'due_soon',taskId,'OVERDUE: '+title)

── PRESENCE ───────────────────────────────────────────────────────────────────
pingPresence(userId)  → update users.last_seen_at=now() → return success

── SEARCH ─────────────────────────────────────────────────────────────────────
searchTasks(query, userId)
  → client-side preferred (filter APP.tasks) — this server function for large datasets only
  → match title ILIKE query OR client name ILIKE query OR category name ILIKE query
  → return matching non-deleted tasks, userId-accessible only

── REPORTS ────────────────────────────────────────────────────────────────────
getTimeReport(filters)
  → filters: {userId?, clientId?, dateFrom, dateTo}
  → join time_log + tasks + clients + categories
  → return {totalHours, byClient:[{clientId,name,color,hours}], byCategory:[...], byUser:[...], byDay:[...]}

exportTimeReportCsv(filters)
  → same as getTimeReport but returns ContentService.createTextOutput(csv).setMimeType(MimeType.CSV)
  → called via direct URL redirect, not google.script.run

── MASTERS ────────────────────────────────────────────────────────────────────
getClients()       → active clients
createClient(p)    → {name,color_hex} → insert → clientId
updateClient(id,f) → update → success
getCategories()    → active categories
createCategory(p)  → {name,icon_emoji} → insert → categoryId
updateCategory(id,f) → update → success

── RECURRING ──────────────────────────────────────────────────────────────────
scheduleNextRecurrence(taskId)
  → read recurrence JSON from completed task
  → calculate next due_date based on type+days
  → if next date exists (before ends): createTask clone with new due_date, status='todo'
  → logActivity on new task

── ACTIVITY ───────────────────────────────────────────────────────────────────
logActivity(taskId, userId, action, detail)
  → insert activity row → return success
  → actions: created|status_changed|timer_started|timer_stopped|claimed|unclaimed|commented|mentioned|assigned

getActivity(taskId)  → last 20 activity rows for task, expanded with user names
</server_functions>

<implementation_requirements>

── ARCHITECTURE ───────────────────────────────────────────────────────────────
Single file: index.html. All CSS in <style>. All JS in <script>.
One import only: https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap

State object:
window.APP = {
  user: null,                  // {userId,name,role,avatarColor,email,notifyPrefs}
  tasks: [],                   // all accessible tasks (my + team if loaded)
  clients: [],
  categories: [],
  users: [],
  teamStatus: [],              // from getTeamStatus()
  activeTimer: null,           // {logId,taskId,taskTitle,startedAt,elapsed,intervalId}
  notifications: [],
  unreadCount: 0,
  currentView: 'home',
  filters: {view:'today', userId:null, status:null, clientId:null},
  dailyPlanShown: false
}

All mutations through APP only. No globals outside APP.
Server calls: always google.script.run.withSuccessHandler(fn).withFailureHandler(errFn).fn(args)

── SESSION ────────────────────────────────────────────────────────────────────
On login success: sessionStorage.setItem('tf_session', JSON.stringify(user))
On load: check sessionStorage → if valid, skip login, restore APP.user, call initApp()
Logout: sessionStorage.clear(), location.reload()

initApp() after login:
  → 5 parallel calls: getTasks({assignedTo:userId}) + getTasks({teamView:true}) +
    getClients() + getCategories() + getUsers() + getTeamStatus() + getActiveTimer(userId) +
    getNotifications(userId)
  → Show skeletons until all resolve
  → if getActiveTimer returns data: restore APP.activeTimer + startInterval from elapsed
  → if first login today (sessionStorage 'plan_date' != today) AND hour>=8: showDailyPlan()

── TIMER ──────────────────────────────────────────────────────────────────────
startTimer flow:
  1. Call startTimer(taskId, userId)
  2. On success: APP.activeTimer = {logId, taskId, taskTitle, startedAt, elapsed:data.elapsed||0, intervalId:null}
  3. APP.activeTimer.intervalId = setInterval(() => { APP.activeTimer.elapsed++; updateTimerUI() }, 1000)
  4. Show global timer banner, patch task card

stopTimer flow:
  1. Show confirmation bottom sheet "Mark as done?" — ✓ Done | ↩ Keep open | ✕ Cancel
  2. Call stopTimer(logId, userId, markDone)
  3. On success: clearInterval(APP.activeTimer.intervalId), APP.activeTimer=null, hide banner, patch card, showUndoToast if markDone

Timer heartbeat: setInterval(() => { if(APP.activeTimer) google.script.run.heartbeatTimer(APP.activeTimer.logId, APP.user.userId) }, 30000)

Elapsed display: always compute from startedAt timestamp, not from counter.
  formatElapsed(seconds): Math.floor(s/3600).toString().padStart(2,'0')+':'+...

Timer banner tap → opens Task Detail bottom sheet for that task.

── REAL-TIME POLLING ──────────────────────────────────────────────────────────
Team status poll: setInterval every 30s when Team tab visible:
  getTeamStatus() → diff APP.teamStatus → patch only changed DOM nodes (data-user-id attributes)
  getNotifications(userId) → update bell badge

Presence ping: setInterval every 60s: pingPresence(userId)

Notification poll: setInterval every 120s when app visible (document.visibilityState='visible')

── QUICK CAPTURE ──────────────────────────────────────────────────────────────
FAB tap → showQuickCapture(presetStatus)
  → slideUp bottom sheet 320px
  → autofocus title input
  → title.length >= 3 → enable Add button
  → "＋ More details" → hideQuickCapture(), openAddTaskScreen(prefilled fields)
  → Add tap → quickAddTask() → on success: showUndoToast('Task added', 'undo_add') + patch kanban column

── KANBAN ─────────────────────────────────────────────────────────────────────
Horizontal scroll: display:flex, overflow-x:auto, scroll-snap-type:x mandatory,
  -webkit-overflow-scrolling:touch, gap:8px, padding:0 16px 16px

Columns: min-width:280px, scroll-snap-align:start, flex-shrink:0
Column lists: overflow-y:auto, max-height:calc(100dvh - 220px)

Default filter: due_date <= today+7 AND status NOT IN ('done','blocked','archived','deleted')
  OR status='inprogress' (always show in-progress regardless of date)
Done column: tasks where status='done' AND updated_at > today-3days only. "View archived" link at bottom.

Swipe right on card: translateX transition 300ms → green ✓ bg → updateTask(status:'done') → showUndoToast
Swipe left on card: translateX transition → red defer bg → defer to tomorrow → showUndoToast

Column + button: opens Quick Capture with status pre-set to that column's status.

── TEAM BOARD ─────────────────────────────────────────────────────────────────
Loads ALL tasks (teamView:true) into APP.teamTasks (separate from APP.tasks)
Default: show all users' tasks. Filter by user avatar chip → filter APP.teamTasks in-place.
My tasks: normal play button. Colleague tasks: grey 👁 button, no tap. Shared: 👥 badge, claim button.
Running timer cards: float to top of In Progress column automatically (sort by has_active_timer desc)
Poll teamStatus every 30s → patch presence dots + running card indicators

── TEAM TIMELINE ──────────────────────────────────────────────────────────────
SVG approach: outer container overflow-x:auto. Inner SVG width=(hoursVisible * 60)px.
  Hour width: 60px default. Pinch-to-zoom: touchstart/touchmove to scale hour width 30–120px.
  NOW line: x=(currentHour-8+currentMinute/60)*hourWidth. Red 1px line + "NOW" foreignObject pill.
  Auto-scroll on tab open: container.scrollLeft = (currentHour-8)*60 - containerWidth/2

Task block positioning:
  ACTUAL: left=(startHour-8)*60 + startMinute, width=durationMinutes
  PLANNED: position from scheduledTime (morning=0px=8am, afternoon=300px=1pm, evening=540px=5pm)
           width=estimatedMinutes || 60 (default 1h if unknown)
  Running block width: animates via CSS transition width 1s ease every poll tick

Lazy render: IntersectionObserver on user rows → only render timeline blocks for visible rows.

── SEARCH ─────────────────────────────────────────────────────────────────────
Search icon tap → fullscreen white overlay (position:fixed, z-index:200) slides down 200ms.
Input autofocus. oninput debounce 200ms → filter APP.tasks + APP.teamTasks client-side.
Match: title.toLowerCase().includes(q) OR clientName.includes(q) OR categoryName.includes(q)
Show results as task cards. Tap → open Task Detail. ✕ or swipe-down → dismiss.

── NOTIFICATIONS ──────────────────────────────────────────────────────────────
Bell tap → slide-down notification panel (position:fixed, top:56px, full width, z-index:150).
Backdrop 30% dim. Tap outside → close.
Unread count badge: red circle on bell icon, max "9+" display.
Tap notification row → markNotificationRead(id) + navigate to related task.
"Mark all read" → markAllNotificationsRead(userId) → re-render all rows as read.

── DAILY PLAN ─────────────────────────────────────────────────────────────────
Trigger: initApp() checks sessionStorage.getItem('tf_plan_'+today). If null AND hour>=8: showDailyPlan()
Full screen overlay (z-index:300) slides up from bottom 300ms.
On "Begin My Day →": sessionStorage.setItem('tf_plan_'+today, '1'), dismiss overlay, navigate to My Day tab.
On "Skip →": same sessionStorage set, dismiss.
Task row actions (defer/start/done) call updateTask or startTimer inline without closing plan.

── @MENTIONS ──────────────────────────────────────────────────────────────────
Comment input: oninput → if last char is '@' → show user autocomplete dropdown (position:absolute above input).
User chips in dropdown: avatar 20px + name. Tap → insert @name as blue span, close dropdown.
On comment submit: parse @mentions from comment text → for each mentioned user:
  createNotification(uid, 'mention', taskId, commenter + ' mentioned you in: ' + taskTitle)

── CHECKLIST ──────────────────────────────────────────────────────────────────
Store as JSON in tasks.checklist column. Parse/stringify on read/write.
Task card: show "X/Y ✓" badge only if checklist has items.
Task detail: render checkbox rows. Tap → toggle done → updateTask({checklist: updatedJson}).
"+ Add item": inline input appended to list, Enter or blur → add item.
Progress fill: small CSS progress bar below checklist header showing X/Y completion.

── FORMS & VALIDATION ─────────────────────────────────────────────────────────
Mobile keyboard safe area: visualViewport resize listener →
  document.querySelector('.form-scroll').style.paddingBottom = (viewportHeight - visualViewport.height + 16) + 'px'

Save button: disabled+40%opacity reactively. Enable when: title.length>=3 AND clientId AND categoryId set.
  addEventListener 'input' on title, 'click' on client/category chips → re-check.

── UNDO SYSTEM ────────────────────────────────────────────────────────────────
showUndoToast(message, undoFn):
  → create div: position:fixed bottom:calc(72px + safe-area) left:16px right:16px
  → slide up 200ms. Auto-dismiss 5000ms. "UNDO" button calls undoFn() + dismiss.
  → During undo window: relevant DOM element stays visible at 50% opacity.
  → undoFn examples: updateTask(id,{status:prevStatus}) | deleteTask inverse | quickAddTask inverse

── ERROR & EMPTY STATES ───────────────────────────────────────────────────────
Every server call: .withFailureHandler(err => showToast(err.message||'Connection error','error'))
showToast(msg,type): div position:fixed bottom:calc(72px + safe-area), auto-dismiss 3000ms.
  success:#34A853 | error:#EA4335 | info:#1A73E8

Every list view: defined empty state when array.length===0:
  Inline SVG (simple line art, <100 chars path) + message 15px/500 + subtext 13px #9AA0A6

── PERFORMANCE ────────────────────────────────────────────────────────────────
Task card updates: patch by data-task-id. Never re-render full lists.
Team status diff: compare APP.teamStatus[i] vs newStatus[i] → update only changed presence dots/elapsed.
Timeline rows: IntersectionObserver → render blocks only when row enters viewport.
Debounce: filter inputs 300ms, search input 200ms.
Parallel init: all 8 initApp() calls fire simultaneously, render as each resolves.
</implementation_requirements>

<deliverables>
Deliver in this exact order — complete, zero TODOs, zero placeholders:

1. Code.gs
   All server functions. LockService on every write. initializeSheets() at top.
   Time-driven triggers setup function: createTriggers() — call once manually after deploy.
     → ScriptApp.newTrigger('archiveOldDoneTasks').timeBased().everyDays(1).atHour(2).create()
     → ScriptApp.newTrigger('sendDueSoonNotifications').timeBased().everyDays(1).atHour(8).create()
     → ScriptApp.newTrigger('checkTimerWarnings').timeBased().everyMinutes(30).create()

2. index.html
   Complete single file: HTML structure + all CSS in <style> + all JS in <script>.
   All 11 screens. Every interaction. Every animation. Every empty state.
   Minimum 1200 lines. No inline style attributes — all via CSS classes.

3. README.md
   Copy-paste deployment:
   a. Create Google Spreadsheet → copy Sheet ID
   b. Apps Script → paste Code.gs → set SHEET_ID constant
   c. Run initializeSheets() once manually
   d. Run createTriggers() once manually
   e. Deploy → Web App → Execute as Me → Anyone with link
   f. Share URL

No partial code. No "// add more here". Split across messages if needed:
  "CONTINUING — Code.gs — [function name]"
  "CONTINUING — index.html — [section]"
</deliverables>
```

---

## Gap Analysis & Feature Roadmap

### Fixed in This Version (vs v2)
| # | Fix | Where |
|---|---|---|
| 1 | Timer orphan cleanup via last_heartbeat | Code.gs getActiveTimer |
| 2 | LockService on all writes | Code.gs all mutating functions |
| 3 | Elapsed from server timestamp, not counter | Code.gs getActiveTimer + client |
| 4 | PIN rate-limiting (failed_attempts + locked_until) | Code.gs loginUser |
| 5 | Quick Capture bottom sheet (2-tap add) | Screen 3 + FAB flow |
| 6 | Kanban default Today filter + auto-archive | Screen 2 + archiveOldDoneTasks |
| 7 | Search overlay (client-side, instant) | Design system + client JS |
| 8 | Undo toast on all destructive actions | Client JS undo system |
| 9 | Planned task blocks on Timeline (scheduled_time) | Screen 6 + schema |
| 10 | Notifications sheet + bell panel + email | Screen 11 + notifications functions |
| 11 | Subtask checklist (JSON column + inline UI) | Screen 7 + schema |
| 12 | Daily Plan morning ritual | Screen 9 |
| 13 | Time Reports (CSS bar charts, CSV export) | Screen 10 Reports tab |
| 14 | Workload view (capacity bar per user) | Screen 10 Workload tab |
| 15 | @mentions in comments → notifications | Screen 7 comments |
| 16 | Recurring tasks (recurrence JSON + trigger) | Screen 8 + Code.gs |
| 17 | initializeSheets() — auto-create schema | Code.gs doGet |
| 18 | notifications + settings sheets | Schema |
| 19 | Schema additions (email, salt, checklist, etc.) | Schema |
| 20 | Team Board — full team task visibility | Screen 5 (NEW) |
| 21 | Shared task race condition — atomic claimTask | Code.gs claimTask |
| 22 | My Day flat list with swipe gestures | Screen 4 |
| 23 | Mobile keyboard safe area fix | Client JS |

### Still Not Feasible in GAS (hard ceiling)
| Feature | Why |
|---|---|
| True real-time push | No WebSockets in GAS HTML Service |
| Browser push notifications | Not available in GAS sandbox |
| Offline mode | Every server call requires connectivity |
| File attachments with preview | DriveApp URLs only, no inline preview |
| Location reminders | No geolocation trigger in GAS |

### Recommended Build Phases
```
Phase 1 — Core (build now):
  PIN login · My Kanban · Quick Capture · My Day · Team Board · Shared Tasks · Timer

Phase 2 — Team Awareness (week 3–4):
  Team Timeline · Presence strip · Notifications · Daily Plan · Search

Phase 3 — Power Features (month 2):
  Subtasks · Recurring tasks · @mentions · Time Reports · Workload view

Phase 4 — Polish (month 3):
  Recurring tasks UI · CSV export · Admin Masters · Archive view · Undo system
```

---
*TaskFlow v3 · prompt-engineer skill v13 · 2026-05-17*
