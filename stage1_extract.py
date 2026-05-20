import re, json, os

BASE = r'C:\Users\Appex\My Drive (packmasters.mumbai@gmail.com)\Pack Masters Taskflow DWM'
SCREENS_DIR = os.path.join(BASE, 'screens')
CLEAN_DIR = os.path.join(SCREENS_DIR, 'clean')

screens_meta = [
    ('screen_01_kanban_home.html',           'kanban-home',         'My Kanban (Home)',             'screen_01_kanban_home'),
    ('screen_02_task_detail_whatsapp.html',  'task-detail-whatsapp','Task Detail + WhatsApp Share', 'screen_02_task_detail_whatsapp'),
    ('screen_03_reports_kpi.html',           'reports-kpi',         'Reports & KPI',                'screen_03_reports_kpi'),
    ('screen_04_myday_share.html',           'myday-share',         'My Day (Share variant)',        'screen_04_myday_share'),
    ('screen_05_pin_login.html',             'pin-login',           'PIN Login',                    'screen_05_pin_login'),
    ('screen_06_task_detail_bottomsheet.html','task-detail-sheet',  'Task Detail Bottom Sheet',     'screen_06_task_detail_bottomsheet'),
    ('screen_07_admin_panel.html',           'admin-panel',         'Admin Panel',                  'screen_07_admin_panel'),
    ('screen_08_myday_focus.html',           'myday-focus',         'My Day (Focus variant)',        'screen_08_myday_focus'),
    ('screen_09_notifications.html',         'notifications',       'Notifications Panel',          'screen_09_notifications'),
    ('screen_10_add_edit_task.html',         'add-edit-task',       'Add / Edit Task',              'screen_10_add_edit_task'),
    ('screen_11_team_timeline.html',         'team-timeline',       'Team Timeline',                'screen_11_team_timeline'),
    ('screen_12_daily_plan.html',            'daily-plan',          'Daily Plan',                   'screen_12_daily_plan'),
    ('screen_13_team_board.html',            'team-board',          'Team Board',                   'screen_13_team_board'),
    ('screen_14_quick_capture.html',         'quick-capture',       'Quick Capture',                'screen_14_quick_capture'),
]

# Navigation map inferred from bottom nav + links observed
nav_map = {
    'kanban-home':          ['add-edit-task', 'task-detail-sheet', 'quick-capture', 'notifications', 'myday-focus', 'team-board', 'admin-panel'],
    'task-detail-whatsapp': ['kanban-home'],
    'reports-kpi':          ['kanban-home', 'myday-share', 'team-board', 'admin-panel'],
    'myday-share':          ['kanban-home', 'add-edit-task', 'quick-capture', 'task-detail-sheet', 'team-board', 'admin-panel'],
    'pin-login':            ['kanban-home'],
    'task-detail-sheet':    ['kanban-home', 'add-edit-task'],
    'admin-panel':          ['kanban-home', 'myday-focus', 'team-board'],
    'myday-focus':          ['kanban-home', 'add-edit-task', 'quick-capture', 'task-detail-sheet', 'team-board', 'admin-panel'],
    'notifications':        ['kanban-home', 'task-detail-sheet'],
    'add-edit-task':        ['kanban-home'],
    'team-timeline':        ['kanban-home', 'myday-focus', 'team-board', 'admin-panel'],
    'daily-plan':           ['myday-focus'],
    'team-board':           ['kanban-home', 'myday-focus', 'team-timeline', 'admin-panel'],
    'quick-capture':        ['kanban-home', 'add-edit-task'],
}

server_calls_map = {
    'kanban-home': [
        {"fn": "getTasks", "trigger": "onMount", "returns": "task[]"},
        {"fn": "updateTaskStatus", "trigger": "drag-drop", "args": ["taskId", "newStatus"]},
        {"fn": "startTimer", "trigger": "play-button-click", "args": ["taskId"]},
        {"fn": "stopTimer", "trigger": "stop-button-click", "args": ["taskId"]},
        {"fn": "getActiveTimer", "trigger": "onMount", "returns": "timerSession"},
    ],
    'task-detail-whatsapp': [
        {"fn": "getTaskDetail", "trigger": "onMount", "args": ["taskId"], "returns": "task"},
        {"fn": "updateTaskStatus", "trigger": "status-chip-click", "args": ["taskId", "newStatus"]},
        {"fn": "stopTimer", "trigger": "stop-button-click", "args": ["taskId"]},
        {"fn": "shareToWhatsApp", "trigger": "share-button-click", "args": ["taskId"]},
        {"fn": "addComment", "trigger": "send-button-click", "args": ["taskId", "commentText"]},
        {"fn": "toggleChecklistItem", "trigger": "checkbox-change", "args": ["taskId", "itemId", "checked"]},
    ],
    'reports-kpi': [
        {"fn": "getKpiSummary", "trigger": "onMount", "returns": "kpiData"},
        {"fn": "getKpiByFilter", "trigger": "filter-tab-click", "args": ["period"], "returns": "kpiData"},
        {"fn": "getHoursByClient", "trigger": "onMount", "returns": "clientHours[]"},
        {"fn": "getTeamProductivity", "trigger": "onMount", "returns": "memberStats[]"},
    ],
    'myday-share': [
        {"fn": "getMyDayTasks", "trigger": "onMount", "returns": "task[]"},
        {"fn": "startTimer", "trigger": "play-button-click", "args": ["taskId"]},
        {"fn": "stopTimer", "trigger": "stop-button-click", "args": ["taskId"]},
        {"fn": "claimTask", "trigger": "claim-button-click", "args": ["taskId"]},
        {"fn": "getSharedPoolTasks", "trigger": "onMount", "returns": "task[]"},
    ],
    'pin-login': [
        {"fn": "getUsers", "trigger": "onMount", "returns": "user[]"},
        {"fn": "validatePin", "trigger": "pin-complete", "args": ["userId", "pin"], "returns": "authToken"},
    ],
    'task-detail-sheet': [
        {"fn": "getTaskDetail", "trigger": "onMount", "args": ["taskId"], "returns": "task"},
        {"fn": "updateTaskStatus", "trigger": "status-chip-click", "args": ["taskId", "newStatus"]},
        {"fn": "stopTimer", "trigger": "stop-button-click", "args": ["taskId"]},
        {"fn": "addComment", "trigger": "send-button-click", "args": ["taskId", "commentText"]},
        {"fn": "toggleChecklistItem", "trigger": "checkbox-change", "args": ["taskId", "itemId", "checked"]},
    ],
    'admin-panel': [
        {"fn": "getAdminStats", "trigger": "onMount", "returns": "adminStats"},
        {"fn": "getWorkloadByUser", "trigger": "workload-tab-click", "returns": "userWorkload[]"},
        {"fn": "getTasks", "trigger": "tasks-tab-click", "returns": "task[]"},
    ],
    'myday-focus': [
        {"fn": "getMyDayTasks", "trigger": "onMount", "returns": "task[]"},
        {"fn": "startTimer", "trigger": "play-button-click", "args": ["taskId"]},
        {"fn": "stopTimer", "trigger": "stop-button-click", "args": ["taskId"]},
        {"fn": "claimTask", "trigger": "claim-button-click", "args": ["taskId"]},
        {"fn": "getSharedPoolTasks", "trigger": "onMount", "returns": "task[]"},
    ],
    'notifications': [
        {"fn": "getNotifications", "trigger": "onMount", "returns": "notification[]"},
        {"fn": "markAllNotificationsRead", "trigger": "mark-all-read-click"},
    ],
    'add-edit-task': [
        {"fn": "getClients", "trigger": "onMount", "returns": "client[]"},
        {"fn": "getCategories", "trigger": "onMount", "returns": "category[]"},
        {"fn": "getTeamMembers", "trigger": "onMount", "returns": "user[]"},
        {"fn": "saveTask", "trigger": "save-button-click", "args": ["taskData"], "returns": "task"},
    ],
    'team-timeline': [
        {"fn": "getTeamTimeline", "trigger": "onMount", "args": ["date"], "returns": "timelineRows[]"},
        {"fn": "getTeamTimeline", "trigger": "date-nav-click", "args": ["date"], "returns": "timelineRows[]"},
        {"fn": "getTeamPresence", "trigger": "onMount", "returns": "presenceStatus[]"},
    ],
    'daily-plan': [
        {"fn": "getDailyPlan", "trigger": "onMount", "returns": "task[]"},
        {"fn": "startTimer", "trigger": "start-button-click", "args": ["taskId"]},
        {"fn": "deferTask", "trigger": "tomorrow-button-click", "args": ["taskId"]},
        {"fn": "markTaskDone", "trigger": "check-button-click", "args": ["taskId"]},
        {"fn": "beginMyDay", "trigger": "begin-my-day-click"},
    ],
    'team-board': [
        {"fn": "getTeamTasks", "trigger": "onMount", "returns": "task[]"},
        {"fn": "getTeamPresence", "trigger": "onMount", "returns": "presenceStatus[]"},
        {"fn": "filterTeamTasks", "trigger": "filter-chip-click", "args": ["filter"], "returns": "task[]"},
        {"fn": "startTimer", "trigger": "play-button-click", "args": ["taskId"]},
        {"fn": "stopTimer", "trigger": "stop-button-click", "args": ["taskId"]},
    ],
    'quick-capture': [
        {"fn": "getClients", "trigger": "onMount", "returns": "client[]"},
        {"fn": "quickSaveTask", "trigger": "add-task-click", "args": ["title", "clientId", "priority", "schedule", "isShared"]},
    ],
}

data_areas_map = {
    'kanban-home':          ['task-list-todo', 'task-list-inprogress', 'task-list-done', 'active-timer-banner'],
    'task-detail-whatsapp': ['task-title', 'task-meta', 'timer-display', 'checklist-list', 'comments-list'],
    'reports-kpi':          ['kpi-total-hours', 'kpi-tasks-completed', 'kpi-efficiency', 'kpi-active-timers', 'chart-hours-by-client', 'chart-team-productivity', 'top-performers-list'],
    'myday-share':          ['overdue-tasks', 'inprogress-tasks', 'today-tasks', 'shared-pool-tasks', 'summary-bar'],
    'pin-login':            ['user-selector', 'pin-dots'],
    'task-detail-sheet':    ['task-title', 'task-meta', 'timer-display', 'checklist-list', 'comments-list'],
    'admin-panel':          ['stat-active-tasks', 'stat-live-sessions', 'stat-due-today', 'stat-overdue', 'workload-cards'],
    'myday-focus':          ['overdue-tasks', 'inprogress-tasks', 'today-tasks', 'shared-pool-tasks', 'summary-bar'],
    'notifications':        ['notifications-list'],
    'add-edit-task':        ['client-chips', 'category-chips', 'assignee-chips'],
    'team-timeline':        ['presence-strip', 'timeline-rows'],
    'daily-plan':           ['overdue-task-list', 'today-task-list'],
    'team-board':           ['presence-strip', 'board-inprogress-column', 'board-todo-column', 'board-blocked-column'],
    'quick-capture':        ['client-chips'],
}

form_submits_map = {
    'add-edit-task':  [{"id": "new-task-form", "submitsTo": "saveTask", "fields": ["title","client","category","priority","dueDate","schedule","assignees","shared","recurring","checklist","notes"]}],
    'quick-capture':  [{"id": "quick-capture-form", "submitsTo": "quickSaveTask", "fields": ["title","client","priority","schedule","isShared"]}],
    'task-detail-whatsapp': [{"id": "comment-input", "submitsTo": "addComment", "fields": ["commentText"]}],
    'task-detail-sheet':    [{"id": "comment-input", "submitsTo": "addComment", "fields": ["commentText"]}],
    'pin-login':      [{"id": "pin-pad", "submitsTo": "validatePin", "fields": ["userId","pin"]}],
}

# -------------------------
# CSS extraction & scoping
# -------------------------

def extract_css(html):
    blocks = re.findall(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
    combined = '\n'.join(blocks)
    # Strip body min-height boilerplate
    combined = re.sub(r'body\s*\{\s*min-height[^}]*\}', '', combined)
    return combined

def prefix_single_rule(rule, slug):
    brace = rule.index('{')
    selector_part = rule[:brace].strip()
    body_part = rule[brace:]
    selectors = [s.strip() for s in selector_part.split(',')]
    prefixed = ', '.join(f'[data-screen="{slug}"] {s}' for s in selectors if s)
    return f'{prefixed} {body_part}'

def scope_css(css_text, slug):
    result = []
    token = ''
    depth = 0
    for ch in css_text:
        if ch == '{':
            depth += 1
            token += ch
        elif ch == '}':
            depth -= 1
            token += ch
            if depth == 0:
                rule = token.strip()
                if rule:
                    if rule.startswith('@'):
                        at_match = re.match(r'(@[^{]+\{)(.*)\}$', rule, re.DOTALL)
                        if at_match:
                            at_header = at_match.group(1)
                            inner = at_match.group(2).strip()
                            inner_rules = []
                            t2, d2 = '', 0
                            for c2 in inner:
                                if c2 == '{':
                                    d2 += 1; t2 += c2
                                elif c2 == '}':
                                    d2 -= 1; t2 += c2
                                    if d2 == 0:
                                        r2 = t2.strip()
                                        if r2:
                                            inner_rules.append(r2)
                                        t2 = ''
                                else:
                                    t2 += c2
                            scoped_inner = '\n'.join(prefix_single_rule(r, slug) for r in inner_rules if '{' in r)
                            result.append(f'{at_header}\n{scoped_inner}\n}}')
                        else:
                            result.append(rule)
                    elif '{' in rule:
                        result.append(prefix_single_rule(rule, slug))
                token = ''
        else:
            token += ch
    return '\n'.join(result)

def strip_to_body(html):
    html = re.sub(r'<!DOCTYPE[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<head[^>]*>.*?</head>', '', html, flags=re.DOTALL|re.IGNORECASE)
    html = re.sub(r'<html[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'</html>', '', html, flags=re.IGNORECASE)
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL|re.IGNORECASE)
    content = body_match.group(1).strip() if body_match else html.strip()
    content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL|re.IGNORECASE)
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL|re.IGNORECASE)
    content = re.sub(r'<link[^>]*/?>',  '', content, flags=re.IGNORECASE)
    return content.strip()

all_scoped_css = []
manifest_screens = []

for fname, slug, title, file_key in screens_meta:
    src = os.path.join(SCREENS_DIR, fname)
    with open(src, encoding='utf-8') as f:
        html = f.read()

    raw_css = extract_css(html)
    scoped = scope_css(raw_css, slug)
    if scoped.strip():
        all_scoped_css.append(f'/* === {slug} === */\n{scoped}')

    content = strip_to_body(html)

    # Add data-screen to outermost element
    first_tag_match = re.match(r'\s*(<\w+)', content)
    if first_tag_match:
        tag = re.match(r'<(\w+)', first_tag_match.group(1)).group(1)
        content = re.sub(
            r'(<' + tag + r')([\s>])',
            lambda m, s=slug: m.group(1) + f' data-screen="{s}"' + m.group(2),
            content, count=1
        )
    else:
        content = f'<div data-screen="{slug}">\n{content}\n</div>'

    out_path = os.path.join(CLEAN_DIR, f'screen_{slug}.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'[OK] screen_{slug}.html')

    manifest_screens.append({
        "slug": slug,
        "title": title,
        "file": file_key,
        "cleanFile": f"screens/clean/screen_{slug}.html",
        "navigatesTo": nav_map.get(slug, []),
        "serverCalls": server_calls_map.get(slug, []),
        "formSubmits": form_submits_map.get(slug, []),
        "dataDisplayAreas": data_areas_map.get(slug, []),
    })

# Write shared-styles.html
shared_out = os.path.join(BASE, 'shared-styles.html')
with open(shared_out, 'w', encoding='utf-8') as f:
    f.write('<style>\n')
    f.write('\n\n'.join(all_scoped_css))
    f.write('\n</style>\n')
print('[OK] shared-styles.html')

# Write manifest.json
manifest = {
    "screens": manifest_screens,
    "sharedCssFile": "shared-styles.html",
    "totalScreens": 14,
}
manifest_out = os.path.join(BASE, 'manifest.json')
with open(manifest_out, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print('[OK] manifest.json')
print('Stage 1 complete.')
