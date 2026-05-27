// ============================================================
//  TaskFlow — Code.gs  (GAS V8 runtime)
//  Sheet ID: 1a17AzXT60a5tYZFlxODHwA4ZCBT3QATrtrf1GcaGHI0
// ============================================================

var SHEET_ID = '1a17AzXT60a5tYZFlxODHwA4ZCBT3QATrtrf1GcaGHI0';

// ── Capability keys ───────────────────────────────────────────
var CAPABILITY_KEYS = [
  'tasks.view.all',
  'tasks.view.own',
  'tasks.view.pool',
  'tasks.view.security',
  'tasks.create',
  'tasks.assign',
  'tasks.edit.any',
  'tasks.edit.own',
  'tasks.delete',
  'tasks.claim',
  'tasks.done.any',
  'tasks.done.own',
  'tasks.approve',
  'tasks.bulkImport',
  'users.manage',
  'roles.manage',
  'clients.manage',
  'categories.manage',
  'activity.view',
  'reports.view',
  'digests.send',
  'triggers.install',
  'calendar.configure'
];

// ── Helpers ──────────────────────────────────────────────────

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function newId() {
  return Utilities.getUuid();
}

function now() {
  return new Date().toISOString();
}

function todayStr() {
  var d = new Date();
  return Utilities.formatDate(d, getTimezone(), 'yyyy-MM-dd');
}

function getTimezone() {
  var s = getSheet('settings');
  if (!s) return 'Asia/Kolkata';
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'timezone') return data[i][1] || 'Asia/Kolkata';
  }
  return 'Asia/Kolkata';
}

function hashPin(pin, salt) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    pin + salt,
    Utilities.Charset.UTF_8
  );
  return raw.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function getSettingValue(key, defaultVal) {
  var s = getSheet('settings');
  if (!s) return defaultVal;
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return defaultVal;
}

function logActivity(taskId, userId, action, detail) {
  var s = getSheet('activity');
  if (!s) return;
  s.appendRow([newId(), taskId, userId, action, detail || '', now()]);
}

// ── getActivityLog (admin-only) ─────────────────────────────
// Returns recent activity rows joined with task title + user name.
// filters: { limit, taskId, userId, action, fromDate (yyyy-MM-dd), toDate (yyyy-MM-dd) }
function getActivityLog(filters, token) {
  requireCapability(token, 'activity.view');
  filters = filters || {};
  var limit = Math.min(Math.max(parseInt(filters.limit, 10) || 200, 1), 1000);

  var s = getSheet('activity');
  if (!s) return [];
  var data = s.getDataRange().getValues();
  if (data.length < 2) return [];

  // Build lookup maps once for the join
  var taskTitles = {};
  try {
    var ts = getSheet('tasks');
    var tdata = ts ? ts.getDataRange().getValues() : [];
    for (var ti = 1; ti < tdata.length; ti++) {
      if (tdata[ti][0]) taskTitles[tdata[ti][0]] = tdata[ti][1] || '';
    }
  } catch(_e) {}

  var userNames = {};
  try {
    var us = getSheet('users');
    var udata = us ? us.getDataRange().getValues() : [];
    for (var ui = 1; ui < udata.length; ui++) {
      if (udata[ui][0]) userNames[udata[ui][0]] = udata[ui][1] || '';
    }
  } catch(_e) {}

  var out = [];
  // Walk newest-first so limit is meaningful
  for (var i = data.length - 1; i >= 1 && out.length < limit; i--) {
    var row = data[i];
    if (!row[0]) continue;
    var taskId = row[1], userId = row[2], action = row[3], detail = row[4];
    var createdAt = row[5] ? String(row[5]) : '';
    var createdAtDay = createdAt.slice(0, 10);

    if (filters.taskId && taskId !== filters.taskId) continue;
    if (filters.userId && userId !== filters.userId) continue;
    if (filters.action && action !== filters.action) continue;
    if (filters.fromDate && createdAtDay && createdAtDay < filters.fromDate) continue;
    if (filters.toDate && createdAtDay && createdAtDay > filters.toDate) continue;

    out.push({
      id: row[0],
      taskId: taskId,
      taskTitle: taskTitles[taskId] || '(deleted task)',
      userId: userId,
      userName: userId ? (userNames[userId] || '(system)') : '(system)',
      action: action,
      detail: detail || '',
      createdAt: createdAt
    });
  }
  return out;
}

// ── doGet / include ──────────────────────────────────────────

// ── HMAC helpers (Phase 2) ─────────────────────────────────────

function _getHmacSecret() {
  var props = PropertiesService.getScriptProperties();
  var key = 'taskflow_hmac_secret';
  var secret = props.getProperty(key);
  if (!secret) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Date.now().toString(), Utilities.Charset.UTF_8);
    secret = Utilities.base64EncodeWebSafe(bytes).replace(/=/g, '');
    props.setProperty(key, secret);
  }
  return secret;
}

function _makeActionToken(taskId, userId, action) {
  var secret = _getHmacSecret();
  var payload = taskId + '|' + userId + '|' + action;
  var sigBytes = Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8);
  var sig = Utilities.base64EncodeWebSafe(sigBytes).replace(/=/g, '');
  return taskId + '.' + userId + '.' + action + '.' + sig;
}

function _verifyActionToken(token) {
  try {
    var parts = token.split('.');
    // sig is last part; taskId and userId may contain hyphens so split carefully
    // format: taskId.userId.action.sig where taskId and userId are UUIDs (no dots)
    if (parts.length < 4) return { ok: false, error: 'malformed token' };
    var sig = parts[parts.length - 1];
    var action = parts[parts.length - 2];
    var userId = parts[parts.length - 3];
    var taskId = parts.slice(0, parts.length - 3).join('.');
    var secret = _getHmacSecret();
    var payload = taskId + '|' + userId + '|' + action;
    var expectedBytes = Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8);
    var expected = Utilities.base64EncodeWebSafe(expectedBytes).replace(/=/g, '');
    if (sig !== expected) return { ok: false, error: 'invalid signature' };
    return { ok: true, taskId: taskId, userId: userId, action: action };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function _actionResultPage(title, body, isError) {
  var color = isError ? '#DC2626' : '#10B981';
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F9FAFB}' +
    '.card{background:#fff;border-radius:12px;padding:32px 24px;max-width:360px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)}' +
    'h2{color:' + color + ';margin:0 0 12px}p{color:#374151;margin:0 0 16px;font-size:14px}' +
    '.close{color:#6B7280;font-size:12px}</style></head><body>' +
    '<div class="card"><h2>' + title + '</h2><p>' + body + '</p>' +
    '<div class="close">This tab will close automatically&hellip;</div></div>' +
    '<script>setTimeout(function(){window.close();},2000);</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e) {
  // Phase 2: handle action deep-links
  if (e && e.parameter && e.parameter.act) {
    try {
      var actParam = e.parameter.act;
      var tokenParam = e.parameter.t || '';
      var verified = _verifyActionToken(tokenParam);
      if (!verified.ok) {
        return _actionResultPage('Invalid Link', 'This link is invalid or has been tampered with.', true);
      }
      var taskId = verified.taskId;
      var userId = verified.userId;
      var action = verified.action;

      // Validate action matches URL param (extra safety)
      if (action !== actParam) {
        return _actionResultPage('Invalid Link', 'Action mismatch.', true);
      }

      // Get the task (check for template)
      var task;
      try { task = Internal.getTask(taskId); } catch(ex) {
        return _actionResultPage('Task Not Found', 'This task no longer exists.', true);
      }

      // Template handling: spawn instance first
      if (task.isTemplate || task.status === 'template') {
        task = _spawnInstanceFromTemplate(taskId, userId, action);
        taskId = task.id;
      }

      var currentStatus = task.status;

      if (action === 'start') {
        if (currentStatus === 'todo' || currentStatus === 'rejected') {
          Internal.updateTaskFields(taskId, { status: 'in-progress', claimedBy: userId, claimedAt: now() });
          try { Internal.startTimerForUser(taskId, userId); } catch(_) {}
          try { syncTaskToCalendar(taskId); } catch(_) {}
          return _actionResultPage('Started', 'Task started. Get to it!', false);
        }
        return _actionResultPage('Already Started', 'This task is already ' + currentStatus + '.', false);
      }

      if (action === 'done') {
        if (currentStatus === 'in-progress') {
          var canApprove = Internal.hasCapability(userId, 'tasks.approve');
          Internal.updateTaskFields(taskId, { status: canApprove ? 'done' : 'awaiting_check' });
          if (!canApprove) {
            try {
              var allUsers2 = getUsersStatic();
              var worker2 = getUserById(userId);
              var workerName2 = worker2 ? worker2.name : 'Someone';
              allUsers2.forEach(function(u) {
                if (Internal.hasCapability(u.id, 'tasks.approve')) {
                  Internal.createNotification(u.id, 'check_needed', taskId,
                    workerName2 + ' marked done — needs check: ' + task.title);
                }
              });
            } catch(_) {}
          }
          try { syncTaskToCalendar(taskId); } catch(_) {}
          return _actionResultPage('Done!', canApprove ? 'Task marked complete.' : 'Task submitted for review.', false);
        }
        return _actionResultPage('Not In Progress', 'This task is ' + currentStatus + ' and cannot be marked done.', false);
      }

      if (action === 'claim') {
        var ids = task.assigneeIds || [];
        if (ids.indexOf(userId) === -1) ids.push(userId);
        var newStatus = currentStatus === 'todo' ? 'in-progress' : currentStatus;
        Internal.updateTaskFields(taskId, { assigneeIds: ids, status: newStatus, claimedBy: userId, claimedAt: now() });
        try { syncTaskToCalendar(taskId); } catch(_) {}
        return _actionResultPage('Claimed!', 'Task claimed and added to your list.', false);
      }

      if (action === 'photo') {
        var webUrl = '';
        try { webUrl = ScriptApp.getService().getUrl(); } catch(_) {}
        return HtmlService.createHtmlOutput(
          '<meta http-equiv="refresh" content="0;url=' + webUrl + '?task=' + taskId + '&action=photo">'
        ).setSandboxMode(HtmlService.SandboxMode.IFRAME);
      }

      return _actionResultPage('Unknown Action', 'Unrecognized action: ' + action, true);
    } catch(ex) {
      return _actionResultPage('Error', 'Something went wrong: ' + ex.message, true);
    }
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TaskFlow')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── initializeSheets ─────────────────────────────────────────
// Intentionally ungated setup function — run from the Apps Script editor before any session exists.
function initializeSheets() {
  var ss = getSpreadsheet();

  var schemas = {
    tasks: ['id','title','description','client_id','category_id','priority','status',
            'assignee_ids','created_by','created_at','due_date','scheduled_time',
            'is_shared','claimed_by','claimed_at','estimated_minutes','checklist',
            'recurrence','updated_at','archived_at','requires_photo','completed_at','pdca',
            'calendar_event_id'],
    users: ['id','name','pin_hash','salt','role','avatar_color','email',
            'notify_prefs','is_active','last_seen_at','failed_attempts','locked_until'],
    clients: ['id','name','color_hex','is_active'],
    categories: ['id','name','icon_emoji','is_active'],
    time_log: ['id','task_id','user_id','started_at','stopped_at','duration_seconds','last_heartbeat'],
    activity: ['id','task_id','user_id','action','detail','created_at'],
    notifications: ['id','user_id','type','task_id','message','is_read','created_at'],
    settings: ['key','value'],
    attachments: ['id','task_id','user_id','file_id','file_url','kind','created_at'],
    roles: ['id','name','label','sort_order','locked'],
    permissions: ['role_id','capability_key','allowed']
  };

  Object.keys(schemas).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(schemas[name]);
    }
  });

  // Idempotent backfill: add missing trailing columns to existing tasks sheet
  (function() {
    var tasksSheet = ss.getSheetByName('tasks');
    if (!tasksSheet) return;
    var headerRow = tasksSheet.getRange(1, 1, 1, tasksSheet.getLastColumn()).getValues()[0];
    ['requires_photo', 'completed_at', 'pdca', 'calendar_event_id',
     'check_by', 'check_at', 'check_reason', 'is_template', 'template_id'].forEach(function(colName) {
      if (headerRow.indexOf(colName) === -1) {
        var nextCol = tasksSheet.getLastColumn() + 1;
        tasksSheet.getRange(1, nextCol).setValue(colName);
        headerRow.push(colName);
      }
    });
  })();

  // Default settings
  var settings = ss.getSheetByName('settings');
  if (settings.getLastRow() <= 1) {
    var defaults = [
      ['timezone','Asia/Kolkata'],
      ['working_start','8'],
      ['working_end','20'],
      ['archive_after_days','3'],
      ['timer_warning_hours','3'],
      ['auto_archive','TRUE'],
      ['sla_urgent_hours','4'],
      ['sla_high_hours','24'],
      ['sla_medium_hours','72'],
      ['sla_low_hours','168'],
      ['escalation_enabled','true']
    ];
    defaults.forEach(function(row) { settings.appendRow(row); });
  } else {
    // Ensure SLA/escalation keys exist if settings were already bootstrapped
    var existingSettings = settings.getDataRange().getValues();
    var existingKeys = {};
    for (var si = 1; si < existingSettings.length; si++) {
      existingKeys[existingSettings[si][0]] = true;
    }
    var slaDefaults = [
      ['sla_urgent_hours','4'],
      ['sla_high_hours','24'],
      ['sla_medium_hours','72'],
      ['sla_low_hours','168'],
      ['escalation_enabled','true']
    ];
    slaDefaults.forEach(function(row) {
      if (!existingKeys[row[0]]) settings.appendRow(row);
    });
  }

  // Bootstrap admin user if users sheet is empty
  var users = ss.getSheetByName('users');
  if (users.getLastRow() <= 1) {
    var salt = newId();
    var hash = hashPin('1234', salt);
    users.appendRow([
      newId(), 'Admin', hash, salt, 'admin', '#1A73E8', '',
      JSON.stringify({onAssign:true, onDue:true, onMention:true, onShared:true}),
      true, now(), 0, ''
    ]);
  }
}

// ── seedDefaultRolesAndPermissions ───────────────────────────
// Idempotent: inserts only missing rows; never overwrites existing.
function seedDefaultRolesAndPermissions() {
  var ss = getSpreadsheet();

  // ── Seed roles ──────────────────────────────────────────────
  var rolesSheet = ss.getSheetByName('roles');
  if (!rolesSheet) {
    rolesSheet = ss.insertSheet('roles');
    rolesSheet.appendRow(['id','name','label','sort_order','locked']);
  }
  var rolesData = rolesSheet.getDataRange().getValues();
  var existingRoleIds = {};
  for (var ri = 1; ri < rolesData.length; ri++) {
    if (rolesData[ri][0]) existingRoleIds[rolesData[ri][0]] = true;
  }
  var defaultRoles = [
    ['admin',    'admin',    'Admin',    0,  true],
    ['owner',    'owner',    'Owner',    10, false],
    ['office',   'office',   'Office',   20, false],
    ['ops',      'ops',      'Ops',      30, false],
    ['security', 'security', 'Security', 40, false]
  ];
  defaultRoles.forEach(function(r) {
    if (!existingRoleIds[r[0]]) rolesSheet.appendRow(r);
  });

  // ── Seed permissions ─────────────────────────────────────────
  var permsSheet = ss.getSheetByName('permissions');
  if (!permsSheet) {
    permsSheet = ss.insertSheet('permissions');
    permsSheet.appendRow(['role_id','capability_key','allowed']);
  }
  var permsData = permsSheet.getDataRange().getValues();
  var existingPerms = {};
  for (var pi = 1; pi < permsData.length; pi++) {
    if (permsData[pi][0] && permsData[pi][1]) {
      existingPerms[permsData[pi][0] + '|' + permsData[pi][1]] = true;
    }
  }

  // Default permission matrix: [roleId, capKey, allowed]
  var matrix = [
    // tasks.view.all
    ['admin','tasks.view.all',true],['owner','tasks.view.all',true],['office','tasks.view.all',true],
    // tasks.view.own
    ['admin','tasks.view.own',true],['owner','tasks.view.own',true],['office','tasks.view.own',true],['ops','tasks.view.own',true],['security','tasks.view.own',true],
    // tasks.view.pool
    ['admin','tasks.view.pool',true],['owner','tasks.view.pool',true],['office','tasks.view.pool',true],['ops','tasks.view.pool',true],
    // tasks.view.security
    ['admin','tasks.view.security',true],['owner','tasks.view.security',true],['office','tasks.view.security',true],['security','tasks.view.security',true],
    // tasks.create
    ['admin','tasks.create',true],['owner','tasks.create',true],['office','tasks.create',true],
    // tasks.assign
    ['admin','tasks.assign',true],['owner','tasks.assign',true],['office','tasks.assign',true],
    // tasks.edit.any
    ['admin','tasks.edit.any',true],['owner','tasks.edit.any',true],['office','tasks.edit.any',true],
    // tasks.edit.own
    ['admin','tasks.edit.own',true],['owner','tasks.edit.own',true],['office','tasks.edit.own',true],['ops','tasks.edit.own',true],['security','tasks.edit.own',true],
    // tasks.delete
    ['admin','tasks.delete',true],['owner','tasks.delete',true],['office','tasks.delete',true],
    // tasks.claim
    ['admin','tasks.claim',true],['owner','tasks.claim',true],['office','tasks.claim',true],['ops','tasks.claim',true],
    // tasks.done.any
    ['admin','tasks.done.any',true],['owner','tasks.done.any',true],['office','tasks.done.any',true],
    // tasks.done.own
    ['admin','tasks.done.own',true],['owner','tasks.done.own',true],['office','tasks.done.own',true],['ops','tasks.done.own',true],['security','tasks.done.own',true],
    // tasks.approve
    ['admin','tasks.approve',true],['owner','tasks.approve',true],['office','tasks.approve',true],
    // tasks.bulkImport
    ['admin','tasks.bulkImport',true],['owner','tasks.bulkImport',true],
    // users.manage
    ['admin','users.manage',true],
    // roles.manage
    ['admin','roles.manage',true],
    // clients.manage
    ['admin','clients.manage',true],['owner','clients.manage',true],
    // categories.manage
    ['admin','categories.manage',true],['owner','categories.manage',true],
    // activity.view
    ['admin','activity.view',true],['owner','activity.view',true],
    // reports.view
    ['admin','reports.view',true],['owner','reports.view',true],['office','reports.view',true],
    // digests.send
    ['admin','digests.send',true],
    // triggers.install
    ['admin','triggers.install',true],
    // calendar.configure
    ['admin','calendar.configure',true]
  ];

  matrix.forEach(function(row) {
    var key = row[0] + '|' + row[1];
    if (!existingPerms[key]) {
      permsSheet.appendRow(row);
      existingPerms[key] = true; // avoid double-insert if matrix has duplicates
    }
  });

  // Invalidate all role-permission caches
  CAPABILITY_KEYS.forEach(function(cap) {
    ['admin','owner','office','ops','security'].forEach(function(role) {
      cacheBust('perms.' + role);
    });
  });
}

// ── createTriggers (run once after deploy) ───────────────────
// Intentionally ungated setup function — run from the Apps Script editor before any session exists.
function createTriggers() {
  // Remove existing to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('archiveOldDoneTasks').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('sendDueSoonNotifications').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('checkTimerWarnings').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('checkEscalations').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('sendDailyReportEmail').timeBased().everyDays(1).atHour(19).create();
  ScriptApp.newTrigger('sendUserDailyDigests').timeBased().everyDays(1).atHour(18).create();
}

// Idempotent installer — add a missing trigger without wiping existing ones.
// Safe to run repeatedly from the Apps Script editor on a live deployment.
function installDailyDigestTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  var have = {};
  existing.forEach(function(t) { have[t.getHandlerFunction()] = true; });
  if (!have['sendUserDailyDigests']) {
    ScriptApp.newTrigger('sendUserDailyDigests').timeBased().everyDays(1).atHour(18).create();
  }
  if (!have['sendDailyReportEmail']) {
    ScriptApp.newTrigger('sendDailyReportEmail').timeBased().everyDays(1).atHour(19).create();
  }
  return 'Daily digest triggers installed (per-user @18:00, admin @19:00).';
}

// ============================================================
//  AUTH
// ============================================================

// Lightweight version used by the login screen — no time_log query,
// handles every possible is_active representation, never throws.
function getUsersForLogin() {
  try {
    var s = getSheet('users');
    if (!s) return [];
    var data = s.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var active = row[8];
      // Handle boolean true, string "TRUE", number 1, or any truthy value
      var isActive = (active === true || active === 1 ||
                      String(active).toUpperCase() === 'TRUE' || active === 'true');
      if (!isActive) continue;
      result.push({
        id:          String(row[0] || ''),
        name:        String(row[1] || ''),
        role:        String(row[4] || 'member'),
        avatarColor: String(row[5] || '#1A73E8')
      });
    }
    return result;
  } catch(e) {
    // Return a sentinel so the UI can show a meaningful error
    return [{ id: '__error__', name: 'Sheet error: ' + e.message, role: '', avatarColor: '#EA4335' }];
  }
}

// Static user list (no live timer field) — cached so expandTask in getTasks is cheap
function getUsersStatic() {
  return cachedRead('users', 600, function() {
    try {
      var s = getSheet('users');
      var data = s.getDataRange().getValues();
      var users = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[8]) continue;
        users.push({
          id: row[0],
          name: row[1],
          role: row[4],
          avatarColor: row[5],
          email: row[6],
          notifyPrefs: safeParseJson(row[7], {}),
          isActive: row[8],
          lastSeenAt: row[9] ? row[9].toString() : ''
        });
      }
      return users;
    } catch(e) {
      throw new Error('getUsersStatic: ' + e.message);
    }
  });
}

// _getUsers removed — use Internal.getUsers()

// Full user list — adds live activeTimer per user (NOT cached, since timer changes constantly)
function getUsers(token) {
  requireSession(token);
  return Internal.getUsers();
}

function loginUser(name, pin) {
  try {
    var s = getSheet('users');
    var data = s.getDataRange().getValues();
    var nowDate = new Date();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[1].toString().toLowerCase() !== name.toString().toLowerCase()) continue;

      // Check is_active (index 8) — do not reveal deactivated status
      var activeVal = row[8];
      var isActive = (activeVal === true || activeVal === 1 || String(activeVal).toUpperCase() === 'TRUE');
      if (!isActive) return { error: 'user_not_found' };

      // Check lock
      var lockedUntil = row[11] ? new Date(row[11]) : null;
      if (lockedUntil && lockedUntil > nowDate) {
        var minutesLeft = Math.ceil((lockedUntil - nowDate) / 60000);
        return { error: 'locked', minutesLeft: minutesLeft };
      }

      var salt = row[3];
      var storedHash = row[2];
      var inputHash = hashPin(pin.toString(), salt.toString());

      if (inputHash !== storedHash) {
        var attempts = (parseInt(row[10]) || 0) + 1;
        var updates = [attempts];
        if (attempts >= 5) {
          var lockTime = new Date(nowDate.getTime() + 15 * 60 * 1000);
          s.getRange(i + 1, 11, 1, 2).setValues([[attempts, lockTime.toISOString()]]);
        } else {
          s.getRange(i + 1, 11).setValue(attempts);
        }
        return { error: 'invalid_pin', attemptsLeft: Math.max(0, 5 - attempts) };
      }

      // Success
      s.getRange(i + 1, 10).setValue(now()); // last_seen_at
      s.getRange(i + 1, 11, 1, 2).setValues([[0, '']]); // reset attempts + lock

      var token = Utilities.getUuid();
      CacheService.getScriptCache().put(
        'sess_' + token,
        JSON.stringify({ userId: row[0], role: row[4], name: row[1] }),
        21600
      );

      return {
        token: token,
        userId: row[0],
        name: row[1],
        role: row[4],
        avatarColor: row[5],
        email: row[6],
        notifyPrefs: safeParseJson(row[7], {})
      };
    }
    return { error: 'user_not_found' };
  } catch(e) {
    throw new Error('loginUser: ' + e.message);
  }
}

function validatePin(userId, pin) {
  try {
    var s = getSheet('users');
    var data = s.getDataRange().getValues();
    var nowDate = new Date();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0] !== userId) continue;

      // Check is_active (index 8) — do not reveal deactivated status
      var activeVal = row[8];
      var isActive = (activeVal === true || activeVal === 1 || String(activeVal).toUpperCase() === 'TRUE');
      if (!isActive) return { error: 'user_not_found' };

      var lockedUntil = row[11] ? new Date(row[11]) : null;
      if (lockedUntil && lockedUntil > nowDate) {
        var minutesLeft = Math.ceil((lockedUntil - nowDate) / 60000);
        return { error: 'locked', minutesLeft: minutesLeft };
      }

      var inputHash = hashPin(pin.toString(), row[3].toString());
      if (inputHash !== row[2]) {
        var attempts = (parseInt(row[10]) || 0) + 1;
        if (attempts >= 5) {
          var lockTime = new Date(nowDate.getTime() + 15 * 60 * 1000);
          s.getRange(i + 1, 11, 1, 2).setValues([[attempts, lockTime.toISOString()]]);
        } else {
          s.getRange(i + 1, 11).setValue(attempts);
        }
        return { error: 'invalid_pin', attemptsLeft: Math.max(0, 5 - attempts) };
      }

      s.getRange(i + 1, 10).setValue(now());
      s.getRange(i + 1, 11, 1, 2).setValues([[0, '']]);

      var token = Utilities.getUuid();
      CacheService.getScriptCache().put(
        'sess_' + token,
        JSON.stringify({ userId: row[0], role: row[4], name: row[1] }),
        21600
      );

      return {
        token: token,
        userId: row[0],
        name: row[1],
        role: row[4],
        avatarColor: row[5],
        email: row[6],
        notifyPrefs: safeParseJson(row[7], {})
      };
    }
    return { error: 'user_not_found' };
  } catch(e) {
    throw new Error('validatePin: ' + e.message);
  }
}

function createUser(payload, token) {
  try {
    requireCapability(token, 'users.manage');
    // FIX D — removed dead privilege-escalation block (unreachable: non-admins already threw above)
    var assignedRole = payload.role || 'member';
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var salt = newId();
      var hash = hashPin(payload.pin.toString(), salt);
      var id = newId();
      var s = getSheet('users');
      s.appendRow([
        id, payload.name, hash, salt, assignedRole,
        payload.avatarColor || '#5F6368', payload.email || '',
        JSON.stringify(payload.notifyPrefs || {onAssign:true, onDue:true, onMention:true, onShared:true}),
        true, now(), 0, ''
      ]);
      cacheBust('users');
      return { userId: id, name: payload.name, role: assignedRole };
    } finally {
      lock.releaseLock();
    }
  } catch(e) {
    throw new Error('createUser: ' + e.message);
  }
}

function updateUser(userId, fields, token) {
  try {
    requireCapability(token, 'users.manage');

    // FIX C — prevent removing the last admin's admin role
    if (fields.role !== undefined && fields.role !== 'admin') {
      var target = getUserById(userId);
      if (target && target.role === 'admin') {
        var admins = Internal.getUsers().filter(function(u) { return u.role === 'admin'; });
        if (admins.length <= 1) {
          throw new Error('Cannot remove the last admin');
        }
      }
    }

    var s = getSheet('users');
    var data = s.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== userId) continue;
      var row = data[i];

      if (fields.pin) {
        var salt = row[3];
        s.getRange(i + 1, 3).setValue(hashPin(fields.pin.toString(), salt));
      }
      if (fields.name !== undefined) s.getRange(i + 1, 2).setValue(fields.name);
      if (fields.role !== undefined) s.getRange(i + 1, 5).setValue(fields.role);
      if (fields.avatarColor !== undefined) s.getRange(i + 1, 6).setValue(fields.avatarColor);
      if (fields.email !== undefined) s.getRange(i + 1, 7).setValue(fields.email);
      if (fields.notifyPrefs !== undefined) s.getRange(i + 1, 8).setValue(JSON.stringify(fields.notifyPrefs));
      if (fields.isActive !== undefined) s.getRange(i + 1, 9).setValue(fields.isActive);
      if (fields.resetLock) {
        s.getRange(i + 1, 11, 1, 2).setValues([[0, '']]);
      }
      cacheBust('users');
      return { success: true };
    }
    throw new Error('User not found');
  } catch(e) {
    throw new Error('updateUser: ' + e.message);
  }
}

/**
 * resetTestPins — INTERNAL TESTING ONLY.
 * Resets PINs for the first four users (by getUsersStatic order) to known test values:
 *   - Admin (first user with role==='admin'): 1234
 *   - First three non-admin users: 1111, 2222, 3333
 * Returns [{id, name, pin}] with the plaintext PINs assigned, for the UI banner.
 * Admin-only. Never logs hashes; never returns hashes.
 */
function resetTestPins(token) {
  try {
    requireCapability(token, 'users.manage');
    var allUsers = getUsersStatic() || [];
    var adminUser = null;
    var nonAdmins = [];
    for (var i = 0; i < allUsers.length; i++) {
      var u = allUsers[i];
      if (!adminUser && u.role === 'admin') adminUser = u;
      else nonAdmins.push(u);
      if (adminUser && nonAdmins.length >= 3) break;
    }
    var plan = [];
    if (adminUser) plan.push({ user: adminUser, pin: '1234' });
    var testPins = ['1111', '2222', '3333'];
    for (var j = 0; j < Math.min(3, nonAdmins.length); j++) {
      plan.push({ user: nonAdmins[j], pin: testPins[j] });
    }

    var s = getSheet('users');
    var data = s.getDataRange().getValues();
    var result = [];
    plan.forEach(function(p) {
      for (var r = 1; r < data.length; r++) {
        if (data[r][0] === p.user.id) {
          var salt = data[r][3];
          if (!salt) { salt = newId(); s.getRange(r + 1, 4).setValue(salt); }
          s.getRange(r + 1, 3).setValue(hashPin(p.pin, salt));
          // Clear any lockout fields
          s.getRange(r + 1, 11, 1, 2).setValues([[0, '']]);
          result.push({ id: p.user.id, name: p.user.name, pin: p.pin });
          break;
        }
      }
    });
    cacheBust('users');
    return result;
  } catch(e) {
    throw new Error('resetTestPins: ' + e.message);
  }
}

function removeUser(userId, token) {
  try {
    requireCapability(token, 'users.manage');
    // Prevent removing last admin
    var admins = Internal.getUsers().filter(function(u) { return u.role === 'admin'; });
    var target = getUserById(userId);
    if (target && target.role === 'admin' && admins.length <= 1) {
      throw new Error('Cannot remove the last admin');
    }

    var s = getSheet('users');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        s.getRange(i + 1, 9).setValue(false); // set is_active = false
        return { success: true };
      }
    }
    throw new Error('User not found');
  } catch(e) {
    throw new Error('removeUser: ' + e.message);
  }
}

function getUserById(userId) {
  var s = getSheet('users');
  if (!s) return null;
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      // FIX B — ignore deactivated users
      var active = data[i][8];
      var isActive = (active === true || active === 1 ||
                      String(active).toUpperCase() === 'TRUE' || active === 'true');
      if (!isActive) return null;
      return {
        id: data[i][0], name: data[i][1], role: data[i][4],
        avatarColor: data[i][5], email: data[i][6],
        notifyPrefs: safeParseJson(data[i][7], {})
      };
    }
  }
  return null;
}

function pingPresence(token) {
  try {
    var sess = requireSession(token);
    var userId = sess.userId;
    var s = getSheet('users');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        s.getRange(i + 1, 10).setValue(now());
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) {
    throw new Error('pingPresence: ' + e.message);
  }
}

// ============================================================
//  CLIENTS & CATEGORIES
// ============================================================

// ============================================================
//  CACHE HELPERS  — wrap expensive Sheet reads in CacheService
// ============================================================

/**
 * Memoised reader. Cache TTL 300s. Invalidate via cacheBust(key) on mutation.
 * Always survives cache miss — falls through to the live reader.
 */
function cachedRead(key, ttlSeconds, reader) {
  var cache = CacheService.getScriptCache();
  try {
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
  } catch(_) { /* fall through to reader */ }
  var fresh = reader();
  try { cache.put(key, JSON.stringify(fresh), ttlSeconds || 300); } catch(_) {}
  return fresh;
}

function cacheBust(key) {
  try { CacheService.getScriptCache().remove(key); } catch(_) {}
}

function cacheBustAll() {
  try { CacheService.getScriptCache().removeAll(['clients', 'categories', 'users']); } catch(_) {}
}

// ============================================================
//  SESSION INFRASTRUCTURE
// ============================================================

/**
 * Resolve a session token to {userId, role, name} or null.
 * Re-verifies the user is still active; refreshes the sliding 6-hour expiry.
 */
function getSession(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var key = 'sess_' + token;
  try {
    var hit = cache.get(key);
    if (!hit) return null;
    var sess = JSON.parse(hit);
    // Verify user still exists and is active
    var user = getUserById(sess.userId);
    if (!user) {
      cache.remove(key);
      return null;
    }
    // Refresh role from live user so mid-session role changes take effect
    sess.role = user.role;
    // Refresh sliding expiry
    cache.put(key, JSON.stringify(sess), 21600);
    return sess;
  } catch(e) {
    return null;
  }
}

/**
 * Returns the session object or throws if the token is invalid/expired.
 */
function requireSession(token) {
  var sess = getSession(token);
  if (!sess) throw new Error('Session expired - please log in again');
  return sess;
}

/**
 * Requires the caller to be an admin. Kept as thin wrapper so forgotten call
 * sites still work — routes through the users.manage capability.
 */
function requireAdmin(token) {
  return requireCapability(token, 'users.manage');
}

/**
 * Requires the session to have a specific capability. Returns the session.
 */
function requireCapability(token, capKey) {
  var sess = requireSession(token);
  if (!Internal.hasCapability(sess.userId, capKey)) {
    throw new Error('Permission denied: ' + capKey);
  }
  return sess;
}

// ── Role/Permission management (admin-facing) ─────────────────

/**
 * Returns the full matrix for the roles admin UI.
 * { roles, capabilities, matrix: { roleId: { capKey: bool } } }
 */
function getRoleMatrix(token) {
  requireCapability(token, 'roles.manage');
  var roles = Internal.getRoles();
  var capSections = CAPABILITY_KEYS.map(function(k) {
    var section = 'admin';
    if (k.indexOf('tasks.view.') === 0) section = 'visibility';
    else if (k.indexOf('tasks.') === 0) section = 'tasks';
    return { key: k, section: section };
  });
  var matrix = {};
  roles.forEach(function(role) {
    matrix[role.id] = Internal.getRolePermissions(role.id);
  });
  return { roles: roles, capabilities: capSections, matrix: matrix };
}

/**
 * Set a single permission cell. Admin only. Refuses to remove admin's roles.manage.
 */
function setPermission(roleId, capKey, allowed, token) {
  requireCapability(token, 'roles.manage');
  if (roleId === 'admin' && capKey === 'roles.manage' && !allowed) {
    return { error: 'cannot_lock_out_admin' };
  }
  var s = getSheet('permissions');
  if (!s) throw new Error('permissions sheet missing');
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === roleId && data[i][1] === capKey) {
      s.getRange(i + 1, 3).setValue(allowed);
      cacheBust('perms.' + roleId);
      return { ok: true };
    }
  }
  // Row not found — insert
  s.appendRow([roleId, capKey, allowed]);
  cacheBust('perms.' + roleId);
  return { ok: true };
}

/**
 * Assign a role to a user. Requires users.manage.
 */
function setUserRole(userId, roleId, token) {
  requireCapability(token, 'users.manage');
  var s = getSheet('users');
  if (!s) throw new Error('users sheet missing');
  var data = s.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      s.getRange(i + 1, 5).setValue(roleId);
      cacheBust('users');
      cacheBust('perms.' + roleId);
      return { ok: true };
    }
  }
  throw new Error('User not found: ' + userId);
}

/**
 * Invalidates a session token. Always returns {ok:true}.
 */
function logout(token) {
  if (token) {
    try { CacheService.getScriptCache().remove('sess_' + token); } catch(_) {}
  }
  return { ok: true };
}

// ============================================================
//  INTERNAL MODULE — not callable via google.script.run
//  All underscore-prefixed workers live here so they are NOT
//  top-level and thus unreachable from the client.
// ============================================================

var Internal = (function() {

  // ── getRoles ─────────────────────────────────────────────────
  function getRoles() {
    try {
      var s = getSheet('roles');
      if (!s) return [];
      var data = s.getDataRange().getValues();
      var result = [];
      for (var i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        result.push({
          id: data[i][0], name: data[i][1], label: data[i][2],
          sortOrder: data[i][3], locked: data[i][4] === true || data[i][4] === 'TRUE'
        });
      }
      result.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
      return result;
    } catch(e) {
      return [];
    }
  }

  // ── getRolePermissions ───────────────────────────────────────
  // Returns { capKey: bool, ... } for a role. Cached 300s per role.
  function getRolePermissions(roleId) {
    var cacheKey = 'perms.' + roleId;
    return cachedRead(cacheKey, 300, function() {
      var map = {};
      // Default all caps to false
      CAPABILITY_KEYS.forEach(function(k) { map[k] = false; });
      try {
        var s = getSheet('permissions');
        if (!s) return map;
        var data = s.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === roleId && data[i][1]) {
            map[data[i][1]] = (data[i][2] === true || data[i][2] === 'TRUE');
          }
        }
      } catch(e) { /* return defaults on error */ }
      return map;
    });
  }

  // ── hasCapability ────────────────────────────────────────────
  // Admin role bypasses sheet entirely for safety — can never be locked out.
  function hasCapability(userId, capKey) {
    try {
      var user = getUserById(userId);
      if (!user) return false;
      var roleId = user.role || 'member';
      if (roleId === 'admin') return true;
      var perms = getRolePermissions(roleId);
      return perms[capKey] === true;
    } catch(e) {
      return false;
    }
  }

  // ── getClients ──────────────────────────────────────────────
  function getClients() {
    return cachedRead('clients', 600, function() {
      try {
        var s = getSheet('clients');
        if (!s) return [];
        var data = s.getDataRange().getValues();
        var result = [];
        for (var i = 1; i < data.length; i++) {
          if (data[i][3] === false || data[i][3] === 'FALSE') continue;
          result.push({ id: data[i][0], name: data[i][1], colorHex: data[i][2], isActive: data[i][3] });
        }
        return result;
      } catch(e) {
        throw new Error('Internal.getClients: ' + e.message);
      }
    });
  }

  // ── getCategories ────────────────────────────────────────────
  function getCategories() {
    return cachedRead('categories', 600, function() {
      try {
        var s = getSheet('categories');
        if (!s) return [];
        var data = s.getDataRange().getValues();
        var result = [];
        for (var i = 1; i < data.length; i++) {
          if (data[i][3] === false || data[i][3] === 'FALSE') continue;
          result.push({ id: data[i][0], name: data[i][1], iconEmoji: data[i][2], isActive: data[i][3] });
        }
        return result;
      } catch(e) {
        throw new Error('Internal.getCategories: ' + e.message);
      }
    });
  }

  // ── getUsers ─────────────────────────────────────────────────
  function getUsers() {
    try {
      var users = getUsersStatic().map(function(u) { return Object.assign({}, u); });
      var tl = getSheet('time_log');
      var tlData = tl ? tl.getDataRange().getValues() : [[]];
      var byUid = {};
      for (var j = 1; j < tlData.length; j++) {
        if (!tlData[j][4]) byUid[tlData[j][2]] = { logId: tlData[j][0], taskId: tlData[j][1], startedAt: tlData[j][3] };
      }
      users.forEach(function(u) { u.activeTimer = byUid[u.id] || null; });
      return users;
    } catch(e) {
      throw new Error('Internal.getUsers: ' + e.message);
    }
  }

  // ── getTasks ─────────────────────────────────────────────────
  function getTasks(filters) {
    try {
      filters = filters || {};
      var s = getSheet('tasks');
      var data = s.getDataRange().getValues();
      var tasks = [];

      var clients = getClients();
      var cats = getCategories();
      var allUsers = getUsersStatic();

      // Build per-task accumulated minutes index (sum of all COMPLETED time_log entries).
      // Wrapped — failures must not break task fetch.
      var minutesByTask = {};
      try {
        var _tl = getSheet('time_log');
        var _tlData = _tl ? _tl.getDataRange().getValues() : [[]];
        for (var _j = 1; _j < _tlData.length; _j++) {
          var _tid = _tlData[_j][1];
          var _stopped = _tlData[_j][4];
          var _durSec = _tlData[_j][5];
          if (!_tid || !_stopped) continue; // skip running timers
          var _secs = Number(_durSec) || 0;
          if (_secs <= 0) continue;
          minutesByTask[_tid] = (minutesByTask[_tid] || 0) + Math.floor(_secs / 60);
        }
      } catch(_e) { /* benign — leave map empty */ }

      function expandFast(task) {
        task.client = clients.find(function(c){ return c.id === task.clientId; }) || null;
        task.category = cats.find(function(c){ return c.id === task.categoryId; }) || null;
        task.assignees = (task.assigneeIds || []).map(function(uid){
          var u = allUsers.find(function(x){ return x.id === uid; });
          return u ? {
            id: u.id, name: u.name, avatar: u.avatar || null,
            avatarColor: u.avatarColor || u.color || null, status: u.status || 'offline'
          } : null;
        }).filter(Boolean);
        task.totalLoggedMinutes = minutesByTask[task.id] || 0;
        return task;
      }

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue;
        var status = row[6];
        if (status === 'deleted') continue;
        if (status === 'template' && !filters.includeTemplates) continue;
        if (status === 'archived' && !filters.includeArchived) continue;

        var task = rowToTask(row);

        if (filters.teamView) { tasks.push(expandFast(task)); continue; }

        if (filters.userId || filters.assignedTo) {
          var uid = filters.userId || filters.assignedTo;
          var assigneeIds = task.assigneeIds || [];
          if (assigneeIds.indexOf(uid) === -1 && task.createdBy !== uid) continue;
        }

        if (filters.status && filters.status.length > 0) {
          if (filters.status.indexOf(status) === -1) continue;
        }
        if (filters.clientId && task.clientId !== filters.clientId) continue;
        if (filters.isShared !== undefined && task.isShared !== filters.isShared) continue;
        if (filters.dateFrom && task.dueDate && task.dueDate < filters.dateFrom) continue;
        if (filters.dateTo && task.dueDate && task.dueDate > filters.dateTo) continue;

        tasks.push(expandFast(task));
      }

      tasks.sort(function(a, b) {
        var pa = priorityRank(a.priority), pb = priorityRank(b.priority);
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.createdAt > b.createdAt ? -1 : 1;
      });

      return tasks;
    } catch(e) {
      throw new Error('Internal.getTasks: ' + e.message);
    }
  }

  // ── getTask ──────────────────────────────────────────────────
  function getTask(taskId) {
    try {
      var s = getSheet('tasks');
      var data = s.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === taskId) {
          var task = expandTask(rowToTask(data[i]));

          var tl = getSheet('time_log');
          var tlData = tl ? tl.getDataRange().getValues() : [[]];
          task.timeLogs = [];
          for (var j = 1; j < tlData.length; j++) {
            if (tlData[j][1] === taskId) {
              task.timeLogs.push({
                id: tlData[j][0], taskId: tlData[j][1], userId: tlData[j][2],
                startedAt: tlData[j][3] ? tlData[j][3].toString() : '',
                stoppedAt: tlData[j][4] ? tlData[j][4].toString() : '',
                durationSeconds: tlData[j][5],
                lastHeartbeat: tlData[j][6] ? tlData[j][6].toString() : ''
              });
            }
          }

          var act = getSheet('activity');
          var actData = act ? act.getDataRange().getValues() : [[]];
          task.activity = [];
          for (var k = 1; k < actData.length; k++) {
            if (actData[k][1] === taskId) {
              task.activity.push({
                id: actData[k][0], userId: actData[k][2], action: actData[k][3],
                detail: actData[k][4], createdAt: actData[k][5] ? actData[k][5].toString() : ''
              });
            }
          }
          task.activity = task.activity.slice(-20).reverse();

          return task;
        }
      }
      throw new Error('Task not found');
    } catch(e) {
      throw new Error('Internal.getTask: ' + e.message);
    }
  }

  // ── createTask ───────────────────────────────────────────────
  function createTask(payload) {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var VALID_STATUSES = ['todo', 'in-progress', 'done', 'blocked', 'deleted', 'archived', 'awaiting_check', 'rejected', 'template'];
      var taskStatus = payload.status || 'todo';
      if (VALID_STATUSES.indexOf(taskStatus) === -1) {
        throw new Error('Invalid status: ' + taskStatus);
      }
      var id = newId();
      var ts = now();
      var s = getSheet('tasks');
      var _estMin = Number(payload.estimatedMinutes) > 0 ? Number(payload.estimatedMinutes) : 20;
      s.appendRow([
        id, payload.title, payload.description || '',
        payload.clientId || '', payload.categoryId || '',
        payload.priority || 'medium', taskStatus,
        (payload.assigneeIds || []).join(','), payload.createdBy || '',
        ts, payload.dueDate || '', payload.scheduledTime || '',
        payload.isShared ? true : false, '', '',
        _estMin,
        payload.checklist ? JSON.stringify(payload.checklist) : '',
        payload.recurrence ? JSON.stringify(payload.recurrence) : '',
        ts, '', payload.requiresPhoto ? true : false, '',
        payload.pdca || '', '',
        '', '', '',
        payload.isTemplate ? true : false,
        payload.templateId || ''
      ]);

      logActivity(id, payload.createdBy, 'created', payload.title);

      (payload.assigneeIds || []).forEach(function(uid) {
        if (uid !== payload.createdBy) {
          var creator = getUserById(payload.createdBy);
          Internal.createNotification(uid, 'assigned', id,
            (creator ? creator.name : 'Someone') + ' assigned you: ' + payload.title);
        }
      });

      if (payload.isShared) {
        // Intentionally calls the IIFE-local getUsers() (with active timers), not the
        // top-level client-facing getUsers(token). Shadow is deliberate here.
        getUsers().forEach(function(u) {
          Internal.createNotification(u.id, 'assigned', id, 'New shared task: ' + payload.title);
        });
      }

      return expandTask(rowToTask([
        id, payload.title, payload.description || '',
        payload.clientId || '', payload.categoryId || '',
        payload.priority || 'medium', taskStatus,
        (payload.assigneeIds || []).join(','), payload.createdBy || '',
        ts, payload.dueDate || '', payload.scheduledTime || '',
        payload.isShared ? true : false, '', '', _estMin,
        payload.checklist ? JSON.stringify(payload.checklist) : '',
        payload.recurrence ? JSON.stringify(payload.recurrence) : '',
        ts, '', payload.requiresPhoto ? true : false, '',
        payload.pdca || '', '',
        '', '', '',
        payload.isTemplate ? true : false,
        payload.templateId || ''
      ]));
    } catch(e) {
      throw new Error('Internal.createTask: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  }

  // ── updateTaskFields ─────────────────────────────────────────
  function updateTaskFields(taskId, fields) {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var s = getSheet('tasks');
      var data = s.getDataRange().getValues();
      var VALID_STATUSES = ['todo', 'in-progress', 'done', 'blocked', 'deleted', 'archived', 'awaiting_check', 'rejected', 'template'];

      for (var i = 1; i < data.length; i++) {
        if (data[i][0] !== taskId) continue;
        var oldRow = data[i];
        var oldStatus = oldRow[6];

        if (fields.status !== undefined && VALID_STATUSES.indexOf(fields.status) === -1) {
          throw new Error('Invalid status: ' + fields.status);
        }

        if (fields.status === 'done' && oldStatus !== 'done') {
          var requiresPhoto = oldRow[20] === true || oldRow[20] === 'TRUE';
          if (requiresPhoto) {
            var attSheet = getSheet('attachments');
            var attData = attSheet ? attSheet.getDataRange().getValues() : [[]];
            var hasImage = false;
            for (var ai = 1; ai < attData.length; ai++) {
              if (attData[ai][1] === taskId) {
                var kind = String(attData[ai][5] || '').toLowerCase();
                if (kind === 'photo' || kind === 'image') { hasImage = true; break; }
              }
            }
            if (!hasImage) {
              throw new Error('A completion photo is required before marking this task done');
            }
          }
        }

        if (fields.title !== undefined) s.getRange(i + 1, 2).setValue(fields.title);
        if (fields.description !== undefined) s.getRange(i + 1, 3).setValue(fields.description);
        if (fields.clientId !== undefined) s.getRange(i + 1, 4).setValue(fields.clientId);
        if (fields.categoryId !== undefined) s.getRange(i + 1, 5).setValue(fields.categoryId);
        if (fields.priority !== undefined) s.getRange(i + 1, 6).setValue(fields.priority);
        if (fields.status !== undefined) {
          s.getRange(i + 1, 7).setValue(fields.status);
          if (fields.status !== oldStatus) {
            logActivity(taskId, '', 'status_changed', oldStatus + '→' + fields.status);
            if (fields.status === 'done' && oldRow[17]) {
              scheduleNextRecurrence(taskId);
            }
            // Stamp / clear completed_at (col 22) on done transitions
            if (fields.status === 'done') {
              s.getRange(i + 1, 22).setValue(now());
              // Auto-close any open time_log entries for this task so elapsed
              // time is captured. Critical for shared tasks: claim auto-starts
              // the timer and users typically mark done without explicit stop.
              try {
                var _tl = getSheet('time_log');
                var _tlData = _tl ? _tl.getDataRange().getValues() : [[]];
                var _stoppedAt = now();
                for (var _ti = 1; _ti < _tlData.length; _ti++) {
                  if (_tlData[_ti][1] !== taskId) continue;
                  if (_tlData[_ti][4]) continue; // already stopped
                  var _start = _tlData[_ti][3];
                  var _dur = _start ? Math.round((new Date(_stoppedAt) - new Date(_start)) / 1000) : 0;
                  _tl.getRange(_ti + 1, 5).setValue(_stoppedAt);
                  _tl.getRange(_ti + 1, 6).setValue(_dur);
                  _tl.getRange(_ti + 1, 7).setValue(_stoppedAt);
                  logActivity(taskId, _tlData[_ti][2] || '', 'timer_stopped', _dur + 's (auto on done)');
                }
              } catch(_e) { /* benign — never block done */ }
            } else if (oldStatus === 'done') {
              s.getRange(i + 1, 22).setValue('');
            }
          }
        }
        if (fields.checkBy !== undefined) s.getRange(i + 1, 25).setValue(fields.checkBy);
        if (fields.checkAt !== undefined) s.getRange(i + 1, 26).setValue(fields.checkAt);
        if (fields.checkReason !== undefined) s.getRange(i + 1, 27).setValue(fields.checkReason);
        if (fields.isTemplate !== undefined) s.getRange(i + 1, 28).setValue(fields.isTemplate ? true : false);
        if (fields.templateId !== undefined) s.getRange(i + 1, 29).setValue(fields.templateId);
        if (fields.assigneeIds !== undefined) s.getRange(i + 1, 8).setValue(fields.assigneeIds.join(','));
        if (fields.dueDate !== undefined) s.getRange(i + 1, 11).setValue(fields.dueDate);
        if (fields.scheduledTime !== undefined) s.getRange(i + 1, 12).setValue(fields.scheduledTime);
        if (fields.isShared !== undefined) s.getRange(i + 1, 13).setValue(fields.isShared);
        if (fields.claimedBy !== undefined) s.getRange(i + 1, 14).setValue(fields.claimedBy);
        if (fields.claimedAt !== undefined) s.getRange(i + 1, 15).setValue(fields.claimedAt);
        if (fields.estimatedMinutes !== undefined) s.getRange(i + 1, 16).setValue(fields.estimatedMinutes);
        if (fields.checklist !== undefined) s.getRange(i + 1, 17).setValue(JSON.stringify(fields.checklist));
        if (fields.recurrence !== undefined) s.getRange(i + 1, 18).setValue(fields.recurrence ? JSON.stringify(fields.recurrence) : '');
        if (fields.requiresPhoto !== undefined) s.getRange(i + 1, 21).setValue(fields.requiresPhoto ? true : false);
        if (fields.pdca !== undefined) s.getRange(i + 1, 23).setValue(fields.pdca || '');

        s.getRange(i + 1, 19).setValue(now());

        return expandTask(rowToTask(s.getRange(i + 1, 1, 1, 29).getValues()[0]));
      }
      throw new Error('Task not found: ' + taskId);
    } catch(e) {
      throw new Error('Internal.updateTaskFields: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  }

  // ── getMyDayTasks ────────────────────────────────────────────
  function getMyDayTasks(userIdOrName) {
    try {
      var today = todayStr();
      var resolvedUser = getUserById(userIdOrName);
      if (!resolvedUser) {
        var allUsers = getUsersStatic();
        resolvedUser = allUsers.filter(function(u) { return u.name === userIdOrName; })[0] || null;
      }
      var resolvedId = resolvedUser ? resolvedUser.id : null;
      var allTasks = getTasks({});
      return allTasks.filter(function(t) {
        if (t.status === 'done' || t.status === 'deleted' || t.status === 'archived') return false;
        var ids = t.assigneeIds || [];
        var isAssigned = resolvedId ? ids.indexOf(resolvedId) !== -1 : false;
        if (!isAssigned) return false;
        return !t.dueDate || t.dueDate <= today;
      });
    } catch(e) {
      throw new Error('Internal.getMyDayTasks: ' + e.message);
    }
  }

  // ── getSharedPoolTasks ───────────────────────────────────────
  function getSharedPoolTasks() {
    try {
      return getTasks({ isShared: true }).filter(function(t) {
        return t.status !== 'done' && t.status !== 'deleted' && t.status !== 'archived' && !t.claimedBy;
      });
    } catch(e) {
      throw new Error('Internal.getSharedPoolTasks: ' + e.message);
    }
  }

  // ── getDailyPlan ─────────────────────────────────────────────
  function getDailyPlan(userId, date) {
    try {
      var planDate = date || todayStr();
      var allTasks = getTasks({ userId: userId });
      return allTasks.filter(function(t) {
        if (t.status === 'deleted' || t.status === 'archived') return false;
        return !t.dueDate || t.dueDate <= planDate;
      });
    } catch(e) {
      throw new Error('Internal.getDailyPlan: ' + e.message);
    }
  }

  // ── startTimerForUser ────────────────────────────────────────
  function startTimerForUser(taskId, uid) {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var tl = getSheet('time_log');
      var tlData = tl.getDataRange().getValues();
      var nowStr = now();

      for (var i = 1; i < tlData.length; i++) {
        if (tlData[i][1] === taskId && tlData[i][2] === uid && !tlData[i][4]) {
          return { logId: tlData[i][0], startedAt: tlData[i][3] ? tlData[i][3].toString() : nowStr, taskId: taskId, alreadyRunning: true };
        }
      }

      var ts = getSheet('tasks');
      var tData = ts.getDataRange().getValues();
      var isShared = false, claimedBy = '';
      for (var j = 1; j < tData.length; j++) {
        if (tData[j][0] === taskId) {
          isShared = tData[j][12] === true || tData[j][12] === 'TRUE';
          claimedBy = tData[j][13];
          break;
        }
      }
      if (isShared && claimedBy && claimedBy !== uid) {
        return { error: 'not_claimed' };
      }

      var logId = newId();
      tl.appendRow([logId, taskId, uid, nowStr, '', '', nowStr]);
      try { updateTaskFields(taskId, { status: 'in-progress' }); } catch(e) {}
      try { logActivity(taskId, uid, 'timer_started', ''); } catch(e) {}

      return { logId: logId, startedAt: nowStr, taskId: taskId };
    } catch(e) {
      throw new Error('Internal.startTimerForUser: ' + e.message);
    } finally {
      lock.releaseLock();
    }
  }

  // ── getOrCreateAttachmentFolder ──────────────────────────────
  function getOrCreateAttachmentFolder() {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var folderId = getSettingValue('attachment_folder_id', '');
      if (folderId) {
        try { return DriveApp.getFolderById(folderId); } catch(e) {
          console.error('Internal.getOrCreateAttachmentFolder: stored folder ' + folderId + ' is inaccessible (' + e + '); creating replacement');
        }
      }
      var folder = DriveApp.createFolder('TaskFlow Attachments');
      var s = getSheet('settings');
      var sData = s.getDataRange().getValues();
      var found = false;
      for (var si = 1; si < sData.length; si++) {
        if (sData[si][0] === 'attachment_folder_id') {
          s.getRange(si + 1, 2).setValue(folder.getId());
          found = true;
          break;
        }
      }
      if (!found) s.appendRow(['attachment_folder_id', folder.getId()]);
      return folder;
    } finally {
      lock.releaseLock();
    }
  }

  // ── getKpiData ───────────────────────────────────────────────
  function getKpiData(options) {
    options = options || {};
    var tasks = getTasks({ teamView: true });
    var filtered = tasks;
    if (options.from) filtered = filtered.filter(function(t) { return !t.dueDate || t.dueDate >= options.from; });
    if (options.to)   filtered = filtered.filter(function(t) { return !t.dueDate || t.dueDate <= options.to; });
    var today = todayStr();
    var total = filtered.length;
    var done = filtered.filter(function(t) { return t.status === 'done' || t.status === 'archived'; }).length;
    var overdue = filtered.filter(function(t) {
      return t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'archived' && t.status !== 'deleted';
    }).length;
    var byAssignee = {};
    var byPriority = { urgent: 0, high: 0, medium: 0, low: 0 };
    filtered.forEach(function(t) {
      (t.assigneeIds || []).forEach(function(uid) {
        if (!byAssignee[uid]) byAssignee[uid] = { total: 0, done: 0 };
        byAssignee[uid].total++;
        if (t.status === 'done') byAssignee[uid].done++;
      });
      if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    });
    var users = getUsers();
    var byAssigneeArr = Object.keys(byAssignee).map(function(uid) {
      var u = users.find(function(x) { return x.id === uid; });
      return { userId: uid, name: u ? u.name : uid, total: byAssignee[uid].total, done: byAssignee[uid].done };
    });
    return {
      totalTasks: total, doneTasks: done, overdueTasks: overdue,
      byAssignee: byAssigneeArr, byPriority: byPriority,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0
    };
  }

  // ── scheduleNextRecurrence ───────────────────────────────────
  function scheduleNextRecurrence(taskId) {
    try {
      var task = getTask(taskId);
      if (!task.recurrence) return;
      var rec = task.recurrence;
      var currentDue = task.dueDate ? new Date(task.dueDate) : new Date();
      var nextDue = new Date(currentDue);

      var step = Math.max(1, parseInt(rec.step || rec.interval || 1, 10) || 1);
      if (rec.type === 'daily')        nextDue.setDate(nextDue.getDate() + step);
      else if (rec.type === 'weekly')  nextDue.setDate(nextDue.getDate() + 7 * step);
      else if (rec.type === 'monthly') nextDue.setMonth(nextDue.getMonth() + step);
      else if (rec.type === 'every-n-days') nextDue.setDate(nextDue.getDate() + step);
      else if (rec.type === 'weekly-days') {
        // Find next configured weekday after currentDue
        var DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
        var days = (rec.days || []).map(function(d){ return DOW[String(d).toLowerCase()]; }).filter(function(n){ return n !== undefined; });
        if (!days.length) return;
        var found = null;
        for (var k = 1; k <= 14; k++) {
          var cand = new Date(currentDue); cand.setDate(cand.getDate() + k);
          if (days.indexOf(cand.getDay()) !== -1) { found = cand; break; }
        }
        if (!found) return;
        nextDue = found;
      }
      else return;

      var nextDueStr = Utilities.formatDate(nextDue, getTimezone(), 'yyyy-MM-dd');
      if (rec.ends && nextDueStr > rec.ends) return;

      createTask({
        title: task.title, description: task.description,
        clientId: task.clientId, categoryId: task.categoryId,
        priority: task.priority, status: 'todo',
        assigneeIds: task.assigneeIds, createdBy: task.createdBy,
        dueDate: nextDueStr, scheduledTime: task.scheduledTime,
        isShared: task.isShared, estimatedMinutes: task.estimatedMinutes,
        checklist: (task.checklist || []).map(function(item) {
          return { id: newId(), text: item.text, done: false };
        }),
        recurrence: task.recurrence
      });
    } catch(e) {
      // Silent — called from updateTaskFields internally
    }
  }

  // ── quickSaveTask ────────────────────────────────────────────
  function quickSaveTask(title, clientId, priority, scheduledTime, isShared) {
    return createTask({
      title: title, clientId: clientId, priority: priority || 'medium',
      scheduledTime: scheduledTime, isShared: isShared || false,
      createdBy: Session.getActiveUser().getEmail() || 'system',
      status: 'todo', assigneeIds: []
    });
  }

  // ── triggerRateLimited ───────────────────────────────────────
  // Kept inside Internal so it is NOT callable via google.script.run.
  // Returns true if the named trigger ran less than minGapMs ago.
  // Uses Script Properties for persistence across executions.
  function triggerRateLimited(fnName, minGapMs) {
    try {
      var props = PropertiesService.getScriptProperties();
      var key = fnName + '_last_run';
      var last = props.getProperty(key);
      var nowMs = Date.now();
      if (last && (nowMs - parseInt(last)) < minGapMs) return true;
      props.setProperty(key, String(nowMs));
      return false;
    } catch(e) {
      return false; // fail-open: let the trigger run if properties unavailable
    }
  }

  // ── createNotification ───────────────────────────────────────
  // Kept inside Internal so it is NOT callable via google.script.run.
  function createNotification(userId, type, taskId, message) {
    try {
      var s = getSheet('notifications');
      if (!s) return;
      s.appendRow([newId(), userId, type, taskId || '', message, false, now()]);

      // Email notification
      try {
        var user = getUserById(userId);
        if (user && user.email && user.notifyPrefs) {
          // Map notification type to stored notifyPrefs key.
          // Only timer_warning defaults to send when unmapped; all other unknown types default to NO email.
          var prefKeyMap = { assigned: 'onAssign', due_soon: 'onDue', mention: 'onMention', shared: 'onShared' };
          var prefKey = prefKeyMap[type];
          var shouldEmail;
          if (prefKey) {
            shouldEmail = !!user.notifyPrefs[prefKey];
          } else {
            shouldEmail = (type === 'timer_warning'); // only timer_warning emails by default when unmapped
          }
          if (shouldEmail) {
            MailApp.sendEmail(user.email, 'TaskFlow: ' + type, message);
          }
        }
      } catch(mailErr) {
        // Silently fail — email is non-critical
      }
    } catch(e) {
      // Silently fail — notifications are non-critical
    }
  }

  // ── Performance scoring ──────────────────────────────────────
  // Compute per-user metrics for a period. period: 'day'|'week'|'month'|'all'
  // Optional dateIso anchors the "day"/"week"/"month" window to a specific date.
  function computePerformanceWindow(period, dateIso) {
    var tz = getTimezone();
    var anchor = dateIso ? new Date(dateIso + 'T00:00:00') : new Date();
    if (isNaN(anchor)) anchor = new Date();
    var startOfDay = new Date(anchor); startOfDay.setHours(0,0,0,0);
    var endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    var start, end;
    if (period === 'day') { start = startOfDay; end = endOfDay; }
    else if (period === 'week') {
      start = new Date(startOfDay); start.setDate(start.getDate() - 6);
      end = endOfDay;
    } else if (period === 'month') {
      start = new Date(startOfDay); start.setDate(start.getDate() - 29);
      end = endOfDay;
    } else { // 'all'
      start = new Date(2000, 0, 1); end = new Date(anchor.getFullYear()+10, 0, 1);
    }
    return { start: start, end: end, length: end - start };
  }

  function _userPerfMetrics(userId, win, tasks, timeLogRows) {
    var today = todayStr();
    var assigned = 0, completed = 0, overdue = 0, inProgress = 0, onTime = 0, cycleSum = 0, cycleN = 0;
    tasks.forEach(function(t) {
      var ids = t.assigneeIds || [];
      var mine = ids.indexOf(userId) !== -1 || t.createdBy === userId;
      if (!mine) return;
      var createdAt = t.createdAt ? new Date(t.createdAt) : null;
      var updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
      // Assigned: created in window OR currently still open at window end
      var createdInWindow = createdAt && createdAt >= win.start && createdAt < win.end;
      if (createdInWindow) assigned++;
      if (t.status === 'done' || t.status === 'archived') {
        if (updatedAt && updatedAt >= win.start && updatedAt < win.end) {
          completed++;
          if (t.dueDate && t.updatedAt) {
            var doneDay = t.updatedAt.substring(0,10);
            if (doneDay <= t.dueDate) onTime++;
          } else if (!t.dueDate) {
            onTime++; // no deadline → counts as on-time
          }
          if (createdAt && updatedAt) {
            var diffMin = Math.max(0, Math.round((updatedAt - createdAt) / 60000));
            cycleSum += diffMin; cycleN++;
          }
        }
      } else if (t.status === 'in-progress') {
        inProgress++;
      }
      if (t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'archived' && t.status !== 'deleted') {
        overdue++;
      }
    });
    // If assigned is zero but user completed work (legacy/back-dated), fall back to completed count
    if (assigned === 0) assigned = completed + inProgress + overdue;

    var minutesLogged = 0;
    timeLogRows.forEach(function(row) {
      if (row[2] !== userId) return;
      var stopped = row[4];
      if (!stopped) return;
      var stoppedAt = new Date(stopped);
      if (isNaN(stoppedAt)) return;
      if (stoppedAt < win.start || stoppedAt >= win.end) return;
      var secs = Number(row[5]) || 0;
      if (secs > 0) minutesLogged += Math.floor(secs / 60);
    });

    var onTimeRate    = completed > 0 ? Math.round((onTime / completed) * 100) : 0;
    var completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    var overdueRate   = assigned > 0 ? (overdue / assigned) : 0;
    var avgCycleMinutes = cycleN > 0 ? Math.round(cycleSum / cycleN) : null;
    var score = Math.round(
      0.50 * onTimeRate +
      0.30 * completionRate +
      0.20 * (100 * (1 - Math.min(1, overdueRate)))
    );
    if (assigned === 0 && completed === 0 && minutesLogged === 0) score = 0;

    return {
      tasksAssigned: assigned,
      tasksCompleted: completed,
      tasksOverdue: overdue,
      tasksInProgress: inProgress,
      minutesLogged: minutesLogged,
      onTimeRate: onTimeRate,
      completionRate: completionRate,
      avgCycleMinutes: avgCycleMinutes,
      score: score
    };
  }

  function getUserPerformance(userId, period, dateIso) {
    try {
      period = period || 'week';
      var win = computePerformanceWindow(period, dateIso);
      var prevAnchor = new Date(win.start.getTime() - 1);
      var prevAnchorIso = Utilities.formatDate(prevAnchor, getTimezone(), 'yyyy-MM-dd');
      var prevWin = computePerformanceWindow(period, prevAnchorIso);

      var tasks = getTasks({ teamView: true, includeArchived: true });
      var tl = getSheet('time_log');
      var tlData = tl ? tl.getDataRange().getValues() : [[]];
      var tlRows = tlData.slice(1);

      var user = getUserById(userId);
      var metrics = _userPerfMetrics(userId, win, tasks, tlRows);
      var prevMetrics = _userPerfMetrics(userId, prevWin, tasks, tlRows);

      return Object.assign({
        userId: userId,
        name: user ? user.name : '',
        periodStart: win.start.toISOString(),
        periodEnd: win.end.toISOString(),
        deltaFromPrevious: (prevMetrics.score === 0 && prevMetrics.tasksAssigned === 0) ? null : (metrics.score - prevMetrics.score)
      }, metrics);
    } catch(e) {
      return {
        userId: userId, name: '', periodStart: null, periodEnd: null,
        tasksAssigned: 0, tasksCompleted: 0, tasksOverdue: 0, tasksInProgress: 0,
        minutesLogged: 0, onTimeRate: 0, completionRate: 0, avgCycleMinutes: null,
        score: 0, deltaFromPrevious: null, error: e.message
      };
    }
  }

  function getDailyCompanyReport(dateIso) {
    try {
      var anchor = dateIso || todayStr();
      var users = getUsersStatic();
      var tasks = getTasks({ teamView: true, includeArchived: true });
      var tl = getSheet('time_log');
      var tlData = tl ? tl.getDataRange().getValues() : [[]];
      var tlRows = tlData.slice(1);
      var win = computePerformanceWindow('day', anchor);

      var perUser = users.map(function(u) {
        var m = _userPerfMetrics(u.id, win, tasks, tlRows);
        return Object.assign({ userId: u.id, name: u.name }, m);
      });

      var totalMin = 0, completedTotal = 0, addedTotal = 0;
      tasks.forEach(function(t) {
        var createdAt = t.createdAt ? new Date(t.createdAt) : null;
        if (createdAt && createdAt >= win.start && createdAt < win.end) addedTotal++;
        var updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
        if ((t.status === 'done' || t.status === 'archived') && updatedAt && updatedAt >= win.start && updatedAt < win.end) {
          completedTotal++;
        }
      });
      tlRows.forEach(function(row) {
        var stopped = row[4]; if (!stopped) return;
        var s = new Date(stopped); if (isNaN(s)) return;
        if (s < win.start || s >= win.end) return;
        var secs = Number(row[5]) || 0; if (secs > 0) totalMin += Math.floor(secs/60);
      });
      var activeTimers = 0;
      tlRows.forEach(function(row) { if (!row[4]) activeTimers++; });
      var today = todayStr();
      var overdueAtEod = tasks.filter(function(t) {
        return t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'archived' && t.status !== 'deleted';
      }).length;

      var topPerformers = perUser.slice().sort(function(a,b){ return b.score - a.score; })
        .slice(0,3).map(function(u){ return { userId: u.userId, name: u.name, score: u.score }; });
      var needsAttention = perUser.filter(function(u){ return u.tasksOverdue > 2; })
        .map(function(u){ return { userId: u.userId, name: u.name, overdue: u.tasksOverdue }; });

      return {
        date: anchor,
        company: {
          tasksCompleted: completedTotal,
          tasksAdded: addedTotal,
          totalMinutesLogged: totalMin,
          overdueAtEod: overdueAtEod,
          activeTimersAtEod: activeTimers
        },
        users: perUser,
        topPerformers: topPerformers,
        needsAttention: needsAttention
      };
    } catch(e) {
      return { date: dateIso || todayStr(), company: {}, users: [], topPerformers: [], needsAttention: [], error: e.message };
    }
  }

  return {
    getClients:                getClients,
    getCategories:             getCategories,
    getUsers:                  getUsers,
    getTasks:                  getTasks,
    getTask:                   getTask,
    createTask:                createTask,
    updateTaskFields:          updateTaskFields,
    getMyDayTasks:             getMyDayTasks,
    getSharedPoolTasks:        getSharedPoolTasks,
    getDailyPlan:              getDailyPlan,
    startTimerForUser:         startTimerForUser,
    getOrCreateAttachmentFolder: getOrCreateAttachmentFolder,
    getKpiData:                getKpiData,
    scheduleNextRecurrence:    scheduleNextRecurrence,
    quickSaveTask:             quickSaveTask,
    triggerRateLimited:        triggerRateLimited,
    createNotification:        createNotification,
    getUserPerformance:        getUserPerformance,
    getDailyCompanyReport:     getDailyCompanyReport,
    getRoles:                  getRoles,
    getRolePermissions:        getRolePermissions,
    hasCapability:             hasCapability
  };
})();

// ── Old top-level stubs removed; callers now use Internal.* ──

// _getClients removed — use Internal.getClients()

function getClients(token) {
  requireSession(token);
  return Internal.getClients();
}

// FIX 2 — admin-only gate added
function createClient(payload, token) {
  try {
    requireCapability(token, 'clients.manage');
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var id = newId();
      getSheet('clients').appendRow([id, payload.name, payload.color_hex || '#4285F4', true]);
      cacheBust('clients');
      return { id: id, name: payload.name };
    } finally {
      lock.releaseLock();
    }
  } catch(e) {
    throw new Error('createClient: ' + e.message);
  }
}

// FIX 2 — admin-only gate added
function updateClient(id, fields, token) {
  try {
    requireCapability(token, 'clients.manage');
    var s = getSheet('clients');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        if (fields.name !== undefined) s.getRange(i + 1, 2).setValue(fields.name);
        if (fields.color_hex !== undefined) s.getRange(i + 1, 3).setValue(fields.color_hex);
        if (fields.isActive !== undefined) s.getRange(i + 1, 4).setValue(fields.isActive);
        cacheBust('clients');
        return { success: true };
      }
    }
    throw new Error('Client not found');
  } catch(e) {
    throw new Error('updateClient: ' + e.message);
  }
}

// _getCategories removed — use Internal.getCategories()

function getCategories(token) {
  requireSession(token);
  return Internal.getCategories();
}

// FIX 2 — admin-only gate added
function createCategory(payload, token) {
  try {
    requireCapability(token, 'categories.manage');
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var id = newId();
      getSheet('categories').appendRow([id, payload.name, payload.icon_emoji || '📋', true]);
      cacheBust('categories');
      return { id: id, name: payload.name };
    } finally {
      lock.releaseLock();
    }
  } catch(e) {
    throw new Error('createCategory: ' + e.message);
  }
}

// FIX 2 — admin-only gate added
function updateCategory(id, fields, token) {
  try {
    requireCapability(token, 'categories.manage');
    var s = getSheet('categories');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        if (fields.name !== undefined) s.getRange(i + 1, 2).setValue(fields.name);
        if (fields.icon_emoji !== undefined) s.getRange(i + 1, 3).setValue(fields.icon_emoji);
        if (fields.isActive !== undefined) s.getRange(i + 1, 4).setValue(fields.isActive);
        cacheBust('categories');
        return { success: true };
      }
    }
    throw new Error('Category not found');
  } catch(e) {
    throw new Error('updateCategory: ' + e.message);
  }
}

// ============================================================
//  TASKS  — row mapping
// ============================================================

// cols: id(0) title(1) description(2) client_id(3) category_id(4) priority(5) status(6)
//       assignee_ids(7) created_by(8) created_at(9) due_date(10) scheduled_time(11)
//       is_shared(12) claimed_by(13) claimed_at(14) estimated_minutes(15) checklist(16)
//       recurrence(17) updated_at(18) archived_at(19) requires_photo(20)

// Derive PDCA letter from status (computed; overrides stored value for live reads)
function _pdcaFromStatus(status) {
  switch (status) {
    case 'todo': return 'P';
    case 'in-progress': return 'D';
    case 'awaiting_check': return 'C';
    case 'done': return 'A';
    case 'rejected': return 'D';
    default: return '';
  }
}

function rowToTask(row) {
  var desc = row[2] ? row[2].toString() : '';
  var status = row[6] ? row[6].toString() : '';
  // Compute pdca from status (live, authoritative); fall back to stored col 22 for legacy/blank statuses
  var pdca = _pdcaFromStatus(status);
  if (!pdca) {
    pdca = row[22] ? row[22].toString().trim() : '';
    if (!pdca) {
      var pdcaMatch = desc.match(/^\[PDCA:([PDCA])\]/);
      if (pdcaMatch) {
        pdca = pdcaMatch[1];
        desc = desc.replace(/^\[PDCA:[PDCA]\]\s*/, '');
      }
    }
  }
  return {
    id: row[0],
    title: row[1],
    description: desc,
    clientId: row[3],
    categoryId: row[4],
    priority: row[5],
    status: status,
    assigneeIds: parseAssigneeIds(row[7]),
    createdBy: row[8],
    createdAt: row[9] ? row[9].toString() : '',
    dueDate: row[10] ? (row[10] instanceof Date ? Utilities.formatDate(row[10], getTimezone(), 'yyyy-MM-dd') : row[10].toString()) : '',
    scheduledTime: row[11],
    isShared: row[12] === true || row[12] === 'TRUE',
    claimedBy: row[13],
    claimedAt: row[14] ? row[14].toString() : '',
    estimatedMinutes: row[15] || null,
    checklist: safeParseJson(row[16], []),
    recurrence: safeParseJson(row[17], null),
    updatedAt: row[18] ? row[18].toString() : '',
    archivedAt: row[19] ? row[19].toString() : '',
    requiresPhoto: row[20] === true || row[20] === 'TRUE',
    completedAt: row[21] ? (row[21] instanceof Date ? row[21].toISOString() : row[21].toString()) : '',
    pdca: pdca,
    calendarEventId: row[23] ? row[23].toString() : '',
    checkBy: row[24] ? row[24].toString() : '',
    checkAt: row[25] ? row[25].toString() : '',
    checkReason: row[26] ? row[26].toString() : '',
    isTemplate: row[27] === true || row[27] === 'TRUE',
    templateId: row[28] ? row[28].toString() : ''
  };
}

function safeParseJson(val, fallback) {
  if (!val || val === '') return fallback;
  try { return JSON.parse(val); } catch(e) { return fallback; }
}

// Parse assignee IDs from the sheet — accepts JSON arrays (preferred) or legacy CSV
function parseAssigneeIds(val) {
  if (!val) return [];
  var s = val.toString().trim();
  if (!s) return [];
  // JSON array form: ["id1","id2"]
  if (s.charAt(0) === '[') {
    try {
      var arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch(e) { /* fall through to CSV */ }
  }
  // Legacy CSV form: id1,id2
  return s.split(',').map(function(x){ return x.trim(); }).filter(Boolean);
}

function expandTask(task) {
  // Expand client
  var clients = Internal.getClients();
  task.client = clients.find(function(c) { return c.id === task.clientId; }) || null;

  // Expand category
  var cats = Internal.getCategories();
  task.category = cats.find(function(c) { return c.id === task.categoryId; }) || null;

  // Expand assignees (id+name+avatar+avatarColor+status — needed for presence dot)
  var allUsers = Internal.getUsers();
  task.assignees = (task.assigneeIds || []).map(function(uid) {
    var u = allUsers.find(function(x) { return x.id === uid; });
    return u ? {
      id: u.id,
      name: u.name,
      avatar: u.avatar || null,
      avatarColor: u.avatarColor || u.color || null,
      status: u.status || 'offline'
    } : null;
  }).filter(Boolean);

  return task;
}

function priorityRank(p) {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[p] !== undefined
    ? { urgent: 0, high: 1, medium: 2, low: 3 }[p] : 4;
}

// ── Read functions ──────────────────────────────────────────

// _getTasks removed as top-level — now Internal.getTasks()

function getTasks(filters, token) {
  var sess = requireSession(token);
  // When client passes no filters (Mine scope), restrict to the current user's tasks
  // (assigned or created). Explicit filters from caller are honored as-is.
  if (!filters) {
    filters = { userId: sess.userId };
  }
  return Internal.getTasks(filters);
}

// _getTask removed as top-level — now Internal.getTask()

function getTask(taskId, token) {
  requireSession(token);
  return Internal.getTask(taskId);
}

// Aliases used in manifest and screens
function getTaskDetail(taskId, token) { return getTask(taskId, token); }
function getTaskById(taskId, token) { return getTask(taskId, token); }
function addUser(payload, token) { return createUser(payload, token); }

// ── Write functions ─────────────────────────────────────────

// _createTask removed as top-level — now Internal.createTask()

// Client-facing createTask: resolves createdBy from token.
function createTask(payload, token) {
  var sess = requireSession(token);
  payload = Object.assign({}, payload);
  payload.createdBy = sess.userId;
  var task = Internal.createTask(payload);
  try { syncTaskToCalendar(task.id); } catch(e) { Logger.log('calSync createTask: ' + e.message); }
  return task;
}

// ── Bulk task import (admin-only) ────────────────────────────
// Returns a CSV template string with header + 2 example rows.
function getImportTemplate(token) {
  requireCapability(token, 'tasks.bulkImport');
  var header = 'title,project,assignee,priority,status,startDate,dueDate,description';
  var example1 = 'Print PE corrugated dieline,Godrej Consumer,Priya,high,todo,2026-06-01,2026-06-03,"Sample row — replace with your own"';
  var example2 = 'Client review call,ITC Foods,"Priya,Ravi",medium,todo,,2026-06-04,"Assign to multiple by comma-separating names"';
  return header + '\n' + example1 + '\n' + example2 + '\n';
}

// Minimal CSV parser that handles double-quoted fields with embedded commas/newlines/escaped quotes.
function _parseCsv(text) {
  var rows = [], row = [], cur = '', inQuotes = false;
  text = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else { cur += ch; }
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(function(r) { return r.length && !(r.length === 1 && r[0] === ''); });
}

// Imports tasks from CSV. Returns { ok: [...], errors: [{row, reason}] }.
// Per-row validation; valid rows commit; invalid rows are reported and skipped.
function importTasks(csvText, token) {
  var sess = requireCapability(token, 'tasks.bulkImport');

  var rows = _parseCsv(csvText);
  if (rows.length < 2) {
    return { ok: [], errors: [{ row: 0, reason: 'CSV needs a header row and at least one data row.' }] };
  }

  var headerRow = rows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var REQUIRED = ['title','project','assignee','priority','status','startdate','duedate','description'];
  var missing = REQUIRED.filter(function(h) { return headerRow.indexOf(h) === -1; });
  if (missing.length) {
    return { ok: [], errors: [{ row: 0, reason: 'Missing header columns: ' + missing.join(', ') }] };
  }
  var idx = {};
  REQUIRED.forEach(function(h) { idx[h] = headerRow.indexOf(h); });

  var clients = Internal.getClients() || [];
  var users   = Internal.getUsers() || [];
  function findClient(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return clients.find(function(c) { return String(c.name || '').toLowerCase() === n; }) || null;
  }
  function findUser(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return users.find(function(u) { return String(u.name || '').toLowerCase() === n; }) || null;
  }

  var VALID_PRIORITY = ['low','medium','high','urgent'];
  var VALID_STATUS = ['todo','in-progress','done','blocked'];
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var ok = [], errors = [];
  for (var r = 1; r < rows.length; r++) {
    var rowArr = rows[r];
    var get = function(key) { return String(rowArr[idx[key]] == null ? '' : rowArr[idx[key]]).trim(); };
    try {
      var title = get('title');
      if (!title) { errors.push({ row: r + 1, reason: 'title is required' }); continue; }

      var projectName = get('project');
      var clientId = '';
      if (projectName) {
        var cli = findClient(projectName);
        if (!cli) { errors.push({ row: r + 1, reason: 'Unknown project: "' + projectName + '"' }); continue; }
        clientId = cli.id;
      }

      var assigneeRaw = get('assignee');
      var assigneeIds = [];
      if (assigneeRaw) {
        var names = assigneeRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        var unknown = [];
        names.forEach(function(n) {
          var u = findUser(n);
          if (u) assigneeIds.push(u.id);
          else unknown.push(n);
        });
        if (unknown.length) { errors.push({ row: r + 1, reason: 'Unknown assignee(s): ' + unknown.join(', ') }); continue; }
      }

      var priority = (get('priority') || 'medium').toLowerCase();
      if (VALID_PRIORITY.indexOf(priority) === -1) {
        errors.push({ row: r + 1, reason: 'Invalid priority: "' + priority + '" (use ' + VALID_PRIORITY.join('/') + ')' });
        continue;
      }

      var status = (get('status') || 'todo').toLowerCase();
      if (VALID_STATUS.indexOf(status) === -1) {
        errors.push({ row: r + 1, reason: 'Invalid status: "' + status + '" (use ' + VALID_STATUS.join('/') + ')' });
        continue;
      }

      var startDate = get('startdate');
      if (startDate && !DATE_RE.test(startDate)) {
        errors.push({ row: r + 1, reason: 'Invalid startDate (need yyyy-MM-dd): "' + startDate + '"' });
        continue;
      }
      var dueDate = get('duedate');
      if (dueDate && !DATE_RE.test(dueDate)) {
        errors.push({ row: r + 1, reason: 'Invalid dueDate (need yyyy-MM-dd): "' + dueDate + '"' });
        continue;
      }

      var payload = {
        title: title,
        description: get('description'),
        clientId: clientId,
        priority: priority,
        status: status,
        assigneeIds: assigneeIds,
        dueDate: dueDate,
        startDate: startDate,
        createdBy: sess.userId
      };

      var created = Internal.createTask(payload);
      ok.push({ row: r + 1, id: created.id, title: created.title });
    } catch(rowErr) {
      errors.push({ row: r + 1, reason: rowErr.message || String(rowErr) });
    }
  }

  return { ok: ok, errors: errors, totalRows: rows.length - 1 };
}

function saveTask(taskData, token) {
  try {
    if (taskData.id) {
      return updateTask(taskData.id, taskData, token);
    } else {
      return createTask(taskData, token);
    }
  } catch(e) {
    throw new Error('saveTask: ' + e.message);
  }
}

// quickSaveTask removed as top-level — now lives only in Internal.quickSaveTask
// (not callable via google.script.run)

function quickAddTask(payload, token) {
  try {
    var sess = requireSession(token);
    return Internal.createTask({
      title: payload.title,
      clientId: payload.clientId || '',
      priority: payload.priority || 'medium',
      status: 'todo',
      dueDate: payload.dueDate || '',
      scheduledTime: payload.scheduledTime || '',
      isShared: payload.isShared || false,
      createdBy: sess.userId,
      assigneeIds: payload.assigneeIds || []
    });
  } catch(e) {
    throw new Error('quickAddTask: ' + e.message);
  }
}

// Alias
function quickCreateTask(payload, token) { return quickAddTask(payload, token); }

// _updateTaskFields removed as top-level — now Internal.updateTaskFields()

// Client-facing updateTask: resolves identity from token.
function updateTask(taskId, fields, token) {
  try {
    var sess = requireSession(token);
    var userId = sess.userId;
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== taskId) continue;
      var oldRow = data[i];

      // Authorization: requester must be creator, an assignee, or have tasks.edit.any
      var canEditAny = Internal.hasCapability(sess.userId, 'tasks.edit.any');
      var isCreator = oldRow[8] === userId;
      var existingAssignees = parseAssigneeIds(oldRow[7]);
      var isAssignee = existingAssignees.indexOf(userId) !== -1;
      if (!canEditAny && !isCreator && !isAssignee) {
        throw new Error('Not authorized to update this task');
      }

      var updated = Internal.updateTaskFields(taskId, fields);
      try { syncTaskToCalendar(taskId); } catch(e) { Logger.log('calSync updateTask: ' + e.message); }
      return updated;
    }
    throw new Error('Task not found: ' + taskId);
  } catch(e) {
    throw new Error('updateTask: ' + e.message);
  }
}

// Client-facing updateTaskStatus: token in place of userId.
function updateTaskStatus(taskId, newStatus, token) {
  try {
    return updateTask(taskId, { status: newStatus }, token);
  } catch(e) {
    throw new Error('updateTaskStatus: ' + e.message);
  }
}

// Client-facing markTaskDone: token in place of userId.
// If caller has tasks.approve, goes straight to done.
// Otherwise transitions to awaiting_check and notifies approvers.
function markTaskDone(taskId, token) {
  try {
    var sess = requireSession(token);
    if (Internal.hasCapability(sess.userId, 'tasks.approve')) {
      return updateTask(taskId, { status: 'done' }, token);
    }
    var updated = updateTask(taskId, { status: 'awaiting_check' }, token);
    // Notify all users with tasks.approve
    try {
      var task = Internal.getTask(taskId);
      var allUsers = getUsersStatic();
      var worker = getUserById(sess.userId);
      var workerName = worker ? worker.name : 'Someone';
      allUsers.forEach(function(u) {
        if (Internal.hasCapability(u.id, 'tasks.approve')) {
          Internal.createNotification(u.id, 'check_needed', taskId,
            workerName + ' marked done — needs check: ' + task.title);
        }
      });
    } catch(_e) { /* notification failure is non-critical */ }
    return updated;
  } catch(e) {
    throw new Error('markTaskDone: ' + e.message);
  }
}

// ── PDCA Check Queue ─────────────────────────────────────────

function listTasksAwaitingCheck(token) {
  try {
    requireCapability(token, 'tasks.approve');
    var allUsers = getUsersStatic();
    var tasks = Internal.getTasks({ teamView: true });
    return tasks
      .filter(function(t) { return t.status === 'awaiting_check'; })
      .sort(function(a, b) { return a.updatedAt > b.updatedAt ? -1 : 1; })
      .map(function(t) {
        var assignee = (t.assigneeIds && t.assigneeIds.length)
          ? allUsers.filter(function(u) { return u.id === t.assigneeIds[0]; })[0] || null
          : null;
        return {
          id: t.id,
          title: t.title,
          assignee_id: t.assigneeIds && t.assigneeIds[0] || '',
          assignee_name: assignee ? assignee.name : '',
          completed_at: t.updatedAt,
          client: t.client ? t.client.name : '',
          category: t.category ? t.category.name : '',
          check_reason: t.checkReason || ''
        };
      });
  } catch(e) {
    throw new Error('listTasksAwaitingCheck: ' + e.message);
  }
}

function approveTask(token, taskId, comment) {
  try {
    var sess = requireCapability(token, 'tasks.approve');
    var updated = updateTask(taskId, { status: 'done' }, token);
    Internal.updateTaskFields(taskId, {
      checkBy: sess.userId,
      checkAt: now(),
      checkReason: comment || ''
    });
    try { syncTaskToCalendar(taskId); } catch(_e) {}
    return { ok: true };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function rejectTask(token, taskId, reason) {
  try {
    var sess = requireCapability(token, 'tasks.approve');
    if (!reason || !reason.toString().trim()) {
      return { ok: false, error: 'Rejection reason is required' };
    }
    var updated = updateTask(taskId, { status: 'rejected' }, token);
    Internal.updateTaskFields(taskId, {
      checkBy: sess.userId,
      checkAt: now(),
      checkReason: reason.toString().trim()
    });
    // Notify original assignees
    try {
      var task = Internal.getTask(taskId);
      var approver = getUserById(sess.userId);
      var approverName = approver ? approver.name : 'Supervisor';
      (task.assigneeIds || []).forEach(function(uid) {
        Internal.createNotification(uid, 'task_rejected', taskId,
          approverName + ' rejected: ' + task.title + ' — ' + reason);
      });
    } catch(_e) { /* non-critical */ }
    try { syncTaskToCalendar(taskId); } catch(_e) {}
    return { ok: true };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// Returns the current user's capability map for UI gating.
function getMyCapabilities(token) {
  try {
    var sess = requireSession(token);
    var caps = {};
    CAPABILITY_KEYS.forEach(function(k) {
      caps[k.replace(/\./g, '_')] = Internal.hasCapability(sess.userId, k);
    });
    // Also expose the raw key form for any callers that use dot notation
    CAPABILITY_KEYS.forEach(function(k) {
      caps[k] = Internal.hasCapability(sess.userId, k);
    });
    return caps;
  } catch(e) {
    throw new Error('getMyCapabilities: ' + e.message);
  }
}

// Client-facing deleteTask: token in place of userId.
// Allows: holders of tasks.delete capability, OR the task creator (tasks.edit.own).
function deleteTask(taskId, token) {
  try {
    var sess = requireSession(token);
    var canDeleteAny = Internal.hasCapability(sess.userId, 'tasks.delete');
    if (!canDeleteAny) {
      // Fall back to creator-or-assignee + edit.own capability
      var s = getSheet('tasks');
      var data = s.getDataRange().getValues();
      var creator = null, assignees = '';
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === taskId) { creator = data[i][8]; assignees = String(data[i][7] || ''); break; }
      }
      var isCreator = (creator === sess.userId);
      var isAssignee = assignees.split(',').indexOf(sess.userId) > -1;
      var canEditOwn = Internal.hasCapability(sess.userId, 'tasks.edit.own');
      if (!((isCreator || isAssignee) && canEditOwn)) {
        throw new Error('Permission denied: tasks.delete');
      }
    }
    updateTask(taskId, { status: 'deleted' }, token);
    logActivity(taskId, sess.userId, 'deleted', '');
    try { syncTaskToCalendar(taskId); } catch(e) { Logger.log('calSync deleteTask: ' + e.message); }
    return { success: true };
  } catch(e) {
    throw new Error('deleteTask: ' + e.message);
  }
}

// FIX 2 — session gate added
function deferTask(taskId, token) {
  try {
    requireSession(token);
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== taskId) continue;
      var d = new Date();
      d.setDate(d.getDate() + 1);
      var tomorrow = Utilities.formatDate(d, getTimezone(), 'yyyy-MM-dd');
      s.getRange(i + 1, 11).setValue(tomorrow);
      s.getRange(i + 1, 19).setValue(now());
      return { success: true, dueDate: tomorrow };
    }
    throw new Error('Task not found');
  } catch(e) {
    throw new Error('deferTask: ' + e.message);
  }
}

var TRIGGER_MIN_GAP_MS = 5 * 60 * 1000; // 5 minutes

function archiveOldDoneTasks() {
  if (Internal.triggerRateLimited('archiveOldDoneTasks', TRIGGER_MIN_GAP_MS)) return;
  try {
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();
    var archiveDays = parseInt(getSettingValue('archive_after_days', 3));
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - archiveDays);
    var count = 0;
    var ts = now();

    for (var i = 1; i < data.length; i++) {
      if (data[i][6] !== 'done') continue;
      var updatedAt = data[i][18] ? new Date(data[i][18]) : null;
      if (updatedAt && updatedAt < cutoff) {
        s.getRange(i + 1, 7).setValue('archived');
        s.getRange(i + 1, 20).setValue(ts);
        s.getRange(i + 1, 19).setValue(ts);
        count++;
      }
    }
    return { archived: count };
  } catch(e) {
    throw new Error('archiveOldDoneTasks: ' + e.message);
  }
}

// ── My Day ──────────────────────────────────────────────────

// _getMyDayTasks / _getSharedPoolTasks removed — use Internal.*

function getMyDayTasks(userIdOrName, token) {
  requireSession(token);
  return Internal.getMyDayTasks(userIdOrName);
}

function getSharedPoolTasks(token) {
  requireSession(token);
  return Internal.getSharedPoolTasks();
}

// ── Daily Plan ───────────────────────────────────────────────

// _getDailyPlan removed — use Internal.getDailyPlan()

function getDailyPlan(userId, date, token) {
  requireSession(token);
  return Internal.getDailyPlan(userId, date);
}

// getDailyPlanForScreen — gated with session via token parameter (FIX 2)
function getDailyPlanForScreen(token) {
  var sess = requireSession(token);
  return Internal.getDailyPlan(sess.userId, todayStr());
}

function beginMyDay(token) {
  try {
    var sess = requireSession(token);
    logActivity('', sess.userId, 'begin_my_day', todayStr());
    return { success: true };
  } catch(e) {
    throw new Error('beginMyDay: ' + e.message);
  }
}

function startDay(token) { return beginMyDay(token); }

function addPlanItem(payload, token) {
  try {
    var sess = requireSession(token);
    var userId = sess.userId;
    return Internal.createTask({
      title: payload.text,
      assigneeIds: [userId],
      createdBy: userId,
      status: 'todo',
      priority: 'medium',
      dueDate: todayStr()
    });
  } catch(e) {
    throw new Error('addPlanItem: ' + e.message);
  }
}

function updatePlanItem(itemId, fields, token) {
  try {
    requireSession(token);
    if (fields.done !== undefined) {
      return updateTask(itemId, { status: fields.done ? 'done' : 'todo' }, token);
    }
    return updateTask(itemId, fields, token);
  } catch(e) {
    throw new Error('updatePlanItem: ' + e.message);
  }
}

// ============================================================
//  TIMER
// ============================================================

// _startTimerForUser removed as top-level — now Internal.startTimerForUser()

// Client-facing startTimer: token in place of userId.
function startTimer(taskId, token) {
  var sess = requireSession(token);
  return Internal.startTimerForUser(taskId, sess.userId);
}

// Return ALL open timers for the user — supports multi-timer rendering
function getActiveTimers(userId, token) {
  requireSession(token);
  var uid = userId || Session.getActiveUser().getEmail();
  var tl = getSheet('time_log');
  var data = tl.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === uid && !data[i][4]) {
      out.push({
        logId: data[i][0],
        taskId: data[i][1],
        userId: data[i][2],
        startedAt: data[i][3] ? data[i][3].toString() : ''
      });
    }
  }
  return out;
}

function stopTimer(logId, token, markDone) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sess = requireSession(token);
    var uid = sess.userId;
    var tl = getSheet('time_log');
    var tlData = tl.getDataRange().getValues();
    var stoppedAt = now();

    // Support passing either logId or taskId — find active log entry for either
    var resolvedLogId = logId;
    var foundByLogId = tlData.some(function(r) { return r[0] === logId && !r[4]; });
    if (!foundByLogId) {
      // Treat logId as taskId — find the open entry for that task
      var openEntry = null;
      for (var j = 1; j < tlData.length; j++) {
        if (tlData[j][1] === logId && !tlData[j][4]) { openEntry = tlData[j]; break; }
      }
      if (openEntry) resolvedLogId = openEntry[0];
    }

    for (var i = 1; i < tlData.length; i++) {
      if (tlData[i][0] !== resolvedLogId) continue;
      if (uid && tlData[i][2] !== uid) throw new Error('Not your timer');

      var startedAt = tlData[i][3];
      var duration = startedAt ? Math.round((new Date(stoppedAt) - new Date(startedAt)) / 1000) : 0;

      tl.getRange(i + 1, 5).setValue(stoppedAt);
      tl.getRange(i + 1, 6).setValue(duration);
      tl.getRange(i + 1, 7).setValue(stoppedAt);

      var taskId = tlData[i][1];
      var task = null;
      if (markDone) {
        task = Internal.updateTaskFields(taskId, { status: 'done', claimedBy: '', claimedAt: '' }); // FIX A — internal call
      }
      logActivity(taskId, uid, 'timer_stopped', duration + 's');

      return { duration: duration, task: task };
    }
    throw new Error('Timer log not found: ' + logId);
  } catch(e) {
    throw new Error('stopTimer: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function getActiveTimer(userId, token) {
  requireSession(token);
  try {
    var uid = userId || Session.getActiveUser().getEmail();
    var tl = getSheet('time_log');
    if (!tl) return null;
    var tlData = tl.getDataRange().getValues();
    var nowDate = new Date();
    var tenMin = 10 * 60 * 1000;

    for (var i = 1; i < tlData.length; i++) {
      if (tlData[i][2] !== uid || tlData[i][4]) continue;

      var lastHB = tlData[i][6] ? new Date(tlData[i][6]) : null;
      if (lastHB && (nowDate - lastHB) > tenMin) {
        // Orphaned — auto close
        tl.getRange(i + 1, 5).setValue(lastHB.toISOString());
        var dur = tlData[i][3] ? Math.round((lastHB - new Date(tlData[i][3])) / 1000) : 0;
        tl.getRange(i + 1, 6).setValue(dur);
        return null;
      }

      var startedAt = tlData[i][3];
      var elapsed = startedAt ? Math.floor((nowDate - new Date(startedAt)) / 1000) : 0;
      var taskId = tlData[i][1];

      // Get task title
      var title = '';
      try {
        var t = Internal.getTask(taskId);
        title = t.title;
      } catch(ex) {}

      return {
        logId: tlData[i][0],
        taskId: taskId,
        taskTitle: title,
        startedAt: startedAt ? startedAt.toString() : '',
        elapsed: elapsed
      };
    }
    return null;
  } catch(e) {
    throw new Error('getActiveTimer: ' + e.message);
  }
}

function heartbeatTimer(logId, token) {
  try {
    var sess = requireSession(token);
    var uid = sess.userId;
    var tl = getSheet('time_log');
    var tlData = tl.getDataRange().getValues();
    for (var i = 1; i < tlData.length; i++) {
      if (tlData[i][0] === logId) {
        if (tlData[i][2] !== uid) throw new Error('Not your timer');
        tl.getRange(i + 1, 7).setValue(now());
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) {
    throw new Error('heartbeatTimer: ' + e.message);
  }
}

function checkTimerWarnings() {
  if (Internal.triggerRateLimited('checkTimerWarnings', TRIGGER_MIN_GAP_MS)) return;
  try {
    var tl = getSheet('time_log');
    if (!tl) return;
    var tlData = tl.getDataRange().getValues();
    var warnHours = parseFloat(getSettingValue('timer_warning_hours', 3));
    var warnMs = warnHours * 60 * 60 * 1000;
    var nowDate = new Date();

    for (var i = 1; i < tlData.length; i++) {
      if (tlData[i][4]) continue; // stopped
      var startedAt = tlData[i][3] ? new Date(tlData[i][3]) : null;
      if (!startedAt) continue;
      if ((nowDate - startedAt) < warnMs) continue;

      var userId = tlData[i][2];
      var taskId = tlData[i][1];
      var title = '';
      try { title = Internal.getTask(taskId).title; } catch(e) {}

      Internal.createNotification(userId, 'timer_warning', taskId,
        'Timer running >' + warnHours + 'h on: ' + title);
    }
  } catch(e) {
    // Silent — time-driven trigger
  }
}

// ============================================================
//  SHARED TASKS
// ============================================================

function claimTask(taskId, token) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sess = requireSession(token);
    var uid = sess.userId;
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== taskId) continue;
      var claimedBy = data[i][13];

      if (claimedBy && claimedBy !== uid) {
        var claimer = getUserById(claimedBy);
        return { success: false, alreadyClaimed: true, claimedBy: claimer ? claimer.name : claimedBy };
      }

      s.getRange(i + 1, 14).setValue(uid);
      s.getRange(i + 1, 15).setValue(now());
      s.getRange(i + 1, 19).setValue(now());

      logActivity(taskId, uid, 'claimed', '');

      // Notify creator
      var createdBy = data[i][8];
      var claimer2 = getUserById(uid);
      Internal.createNotification(createdBy, 'assigned', taskId,
        (claimer2 ? claimer2.name : uid) + ' claimed: ' + data[i][1]);

      lock.releaseLock();

      // Start timer — use internal worker (uid already resolved from session)
      var timerResult = Internal.startTimerForUser(taskId, uid);
      return { success: true, logId: timerResult.logId, startedAt: timerResult.startedAt };
    }
    throw new Error('Task not found');
  } catch(e) {
    try { lock.releaseLock(); } catch(le) {}
    throw new Error('claimTask: ' + e.message);
  }
}

function unclaimTask(taskId, token) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sess = requireSession(token);
    var uid = sess.userId;
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== taskId) continue;
      if (data[i][13] !== uid) throw new Error('Not claimed by you');
      s.getRange(i + 1, 14).setValue('');
      s.getRange(i + 1, 15).setValue('');
      s.getRange(i + 1, 19).setValue(now());

      // Stop open timer if any
      var tl = getSheet('time_log');
      var tlData = tl.getDataRange().getValues();
      for (var j = 1; j < tlData.length; j++) {
        if (tlData[j][1] === taskId && tlData[j][2] === uid && !tlData[j][4]) {
          tl.getRange(j + 1, 5).setValue(now());
          var dur = tlData[j][3] ? Math.round((new Date() - new Date(tlData[j][3])) / 1000) : 0;
          tl.getRange(j + 1, 6).setValue(dur);
          break;
        }
      }

      logActivity(taskId, uid, 'unclaimed', '');
      return { success: true };
    }
    throw new Error('Task not found');
  } catch(e) {
    throw new Error('unclaimTask: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  TEAM
// ============================================================

function getTeamStatus(token) {
  requireSession(token);
  try {
    var users = Internal.getUsers();
    var nowDate = new Date();
    var twoMin = 2 * 60 * 1000;
    var tenMin = 10 * 60 * 1000;

    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];

    var tasks = Internal.getTasks({ teamView: true });

    return users.map(function(u) {
      var lastSeen = u.lastSeenAt ? new Date(u.lastSeenAt) : null;
      var presence = 'offline';
      if (lastSeen) {
        var diff = nowDate - lastSeen;
        if (diff < twoMin) presence = 'active';
        else if (diff < tenMin) presence = 'idle';
      }

      var activeTimer = null;
      for (var j = 1; j < tlData.length; j++) {
        if (tlData[j][2] === u.id && !tlData[j][4]) {
          var elapsed = tlData[j][3] ? Math.floor((nowDate - new Date(tlData[j][3])) / 1000) : 0;
          activeTimer = {
            logId: tlData[j][0],
            taskId: tlData[j][1],
            startedAt: tlData[j][3] ? tlData[j][3].toString() : '',
            elapsed: elapsed
          };
          break;
        }
      }

      var today = todayStr();
      var inProgress = tasks.filter(function(t) {
        return t.assigneeIds && t.assigneeIds.indexOf(u.id) !== -1 && t.status === 'in-progress';
      });
      var doneToday = tasks.filter(function(t) {
        return t.assigneeIds && t.assigneeIds.indexOf(u.id) !== -1
          && t.status === 'done'
          && t.updatedAt && t.updatedAt.substring(0, 10) === today;
      }).length;

      return {
        id: u.id, name: u.name, avatarColor: u.avatarColor,
        presence: presence, lastSeenAt: u.lastSeenAt,
        activeTimer: activeTimer,
        tasksInProgress: inProgress.length,
        tasksDoneToday: doneToday
      };
    });
  } catch(e) {
    throw new Error('getTeamStatus: ' + e.message);
  }
}

function getTeamTasks(options, token) {
  requireSession(token);
  try {
    options = options || {};
    var tasks = Internal.getTasks({ teamView: true });

    if (options.weekOffset !== undefined) {
      var base = new Date();
      base.setDate(base.getDate() + (options.weekOffset * 7));
      var startOfWeek = new Date(base);
      startOfWeek.setDate(base.getDate() - base.getDay());
      var endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      var from = Utilities.formatDate(startOfWeek, getTimezone(), 'yyyy-MM-dd');
      var to = Utilities.formatDate(endOfWeek, getTimezone(), 'yyyy-MM-dd');
      tasks = tasks.filter(function(t) {
        return !t.dueDate || (t.dueDate >= from && t.dueDate <= to);
      });
    }

    return tasks;
  } catch(e) {
    throw new Error('getTeamTasks: ' + e.message);
  }
}

function filterTeamTasks(filter, token) {
  requireSession(token);
  try {
    var all = Internal.getTasks({ teamView: true });
    if (!filter || filter === 'all') return all;
    return all.filter(function(t) {
      if (filter === 'shared') return t.isShared;
      // filter by userId or status
      if (t.assigneeIds && t.assigneeIds.indexOf(filter) !== -1) return true;
      if (t.status === filter) return true;
      return false;
    });
  } catch(e) {
    throw new Error('filterTeamTasks: ' + e.message);
  }
}

function getTeamBoard(token) {
  requireSession(token);
  try {
    var users = Internal.getUsers();
    var tasks = Internal.getTasks({ teamView: true });

    var members = users.map(function(u) {
      var myTasks = tasks.filter(function(t) {
        return t.assigneeIds && t.assigneeIds.indexOf(u.id) !== -1;
      });
      return {
        name: u.name,
        avatarColor: u.avatarColor,
        todo: myTasks.filter(function(t) { return t.status === 'todo'; }).length,
        inProgress: myTasks.filter(function(t) { return t.status === 'in-progress'; }).length,
        done: myTasks.filter(function(t) { return t.status === 'done'; }).length,
        tasks: myTasks
      };
    });
    return { members: members };
  } catch(e) {
    throw new Error('getTeamBoard: ' + e.message);
  }
}

function getTeamTimeline(date, token) {
  requireSession(token);
  try {
    var targetDate = date || todayStr();
    var tasks = Internal.getTasks({ teamView: true });
    var users = Internal.getUsers();
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];

    // Build index keyed by "taskId|userId" for O(1) lookup — avoids O(n²) inner scan
    // Value: first matching log entry for (task, user) on targetDate
    var tlIndex = {};        // key: taskId+'|'+userId → log row object
    var taskHasLog = {};     // key: taskId+'|'+userId → true (for fast hasLogToday check)
    for (var j = 1; j < tlData.length; j++) {
      var logDate = tlData[j][3] ? tlData[j][3].toString().substring(0, 10) : '';
      if (logDate !== targetDate) continue;
      var key = tlData[j][1] + '|' + tlData[j][2];
      taskHasLog[key] = true;
      if (!tlIndex[key]) {
        tlIndex[key] = {
          startedAt: tlData[j][3] ? tlData[j][3].toString() : null,
          stoppedAt: tlData[j][4] ? tlData[j][4].toString() : null,
          isRunning: !tlData[j][4]
        };
      }
    }

    var result = users.map(function(u) {
      var userTasks = tasks.filter(function(t) {
        if (!t.assigneeIds || t.assigneeIds.indexOf(u.id) === -1) return false;
        return t.dueDate === targetDate || taskHasLog[t.id + '|' + u.id];
      });

      return {
        userId: u.id,
        name: u.name,
        avatarColor: u.avatarColor,
        tasks: userTasks.map(function(t) {
          var entry = tlIndex[t.id + '|' + u.id] || null;
          return {
            taskId: t.id, title: t.title, clientId: t.clientId,
            priority: t.priority, status: t.status,
            actualStart: entry ? entry.startedAt : null,
            actualEnd: entry ? entry.stoppedAt : null,
            estimatedMinutes: t.estimatedMinutes, scheduledTime: t.scheduledTime,
            isRunning: entry ? entry.isRunning : false
          };
        })
      };
    });

    // Shared tasks group
    var sharedTasks = tasks.filter(function(t) { return t.isShared && t.dueDate === targetDate; });

    return { rows: result, sharedTasks: sharedTasks };
  } catch(e) {
    throw new Error('getTeamTimeline: ' + e.message);
  }
}

// ============================================================
//  KPI & REPORTS
// ============================================================

// FIX 4 — single implementation; delegates to Internal.getKpiData
function getKpiData(options, token) {
  requireSession(token);
  try {
    return Internal.getKpiData(options);
  } catch(e) {
    throw new Error('getKpiData: ' + e.message);
  }
}

function getKpiByFilter(period, token) {
  requireSession(token);
  var now2 = new Date();
  var from, to;
  to = todayStr();

  if (period === 'week') {
    var d = new Date(now2);
    d.setDate(d.getDate() - 7);
    from = Utilities.formatDate(d, getTimezone(), 'yyyy-MM-dd');
  } else if (period === 'month') {
    var d2 = new Date(now2);
    d2.setMonth(d2.getMonth() - 1);
    from = Utilities.formatDate(d2, getTimezone(), 'yyyy-MM-dd');
  } else {
    from = null;
  }

  return Internal.getKpiData({ from: from, to: to });
}

// _getKpiDataInternal removed — use Internal.getKpiData() (FIX 4: deduplication)

function getTeamStats(token) {
  requireSession(token);
  try {
    var users = Internal.getUsers();
    var tasks = Internal.getTasks({ teamView: true });
    var today = todayStr();

    var byStatus = { todo: 0, 'in-progress': 0, done: 0 };
    var overdueCount = 0;
    tasks.forEach(function(t) {
      if (byStatus[t.status] !== undefined) byStatus[t.status]++;
      if (t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'archived' && t.status !== 'deleted') {
        overdueCount++;
      }
    });

    return {
      totalUsers: users.length,
      totalTasks: tasks.length,
      tasksByStatus: byStatus,
      overdueCount: overdueCount
    };
  } catch(e) {
    throw new Error('getTeamStats: ' + e.message);
  }
}

function getAdminStats(token) {
  requireSession(token);
  try {
    var tasks = Internal.getTasks({ teamView: true });
    var today = todayStr();
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];

    var active = tasks.filter(function(t) { return t.status === 'in-progress'; }).length;
    var dueToday = tasks.filter(function(t) { return t.dueDate === today && t.status !== 'done'; }).length;
    var overdue = tasks.filter(function(t) {
      return t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'archived' && t.status !== 'deleted';
    }).length;
    var liveSessions = 0;
    for (var j = 1; j < tlData.length; j++) {
      if (!tlData[j][4]) liveSessions++;
    }

    return { activeTasks: active, liveSessions: liveSessions, dueToday: dueToday, overdue: overdue };
  } catch(e) {
    throw new Error('getAdminStats: ' + e.message);
  }
}

function getWorkloadByUser(token) {
  requireSession(token);
  try {
    var users = Internal.getUsers();
    var tasks = Internal.getTasks({ teamView: true });
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];

    return users.map(function(u) {
      var myTasks = tasks.filter(function(t) {
        return t.assigneeIds && t.assigneeIds.indexOf(u.id) !== -1 && t.status !== 'done' && t.status !== 'archived' && t.status !== 'deleted';
      });

      var totalSeconds = 0;
      for (var j = 1; j < tlData.length; j++) {
        if (tlData[j][2] === u.id && tlData[j][5]) {
          totalSeconds += parseInt(tlData[j][5]) || 0;
        }
      }

      var byPriority = { urgent: 0, high: 0, medium: 0, low: 0 };
      myTasks.forEach(function(t) {
        if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
      });

      return {
        userId: u.id, name: u.name, avatarColor: u.avatarColor,
        taskCount: myTasks.length,
        byPriority: byPriority,
        hoursLogged: Math.round(totalSeconds / 3600 * 10) / 10,
        isOverloaded: myTasks.length > 8
      };
    });
  } catch(e) {
    throw new Error('getWorkloadByUser: ' + e.message);
  }
}

function getHoursByClient(token) {
  requireSession(token);
  try {
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];
    var tasks = Internal.getTasks({ teamView: true });
    var clients = Internal.getClients();

    var byClient = {};
    for (var j = 1; j < tlData.length; j++) {
      if (!tlData[j][5]) continue;
      var taskId = tlData[j][1];
      var task = tasks.find(function(t) { return t.id === taskId; });
      if (!task) continue;
      var cid = task.clientId;
      if (!byClient[cid]) byClient[cid] = 0;
      byClient[cid] += parseInt(tlData[j][5]) || 0;
    }

    return clients.map(function(c) {
      return {
        clientId: c.id, name: c.name, color: c.colorHex,
        hours: Math.round((byClient[c.id] || 0) / 3600 * 10) / 10
      };
    }).filter(function(c) { return c.hours > 0; });
  } catch(e) {
    throw new Error('getHoursByClient: ' + e.message);
  }
}

function getTeamProductivity(token) {
  requireSession(token);
  try {
    var users = Internal.getUsers();
    var tasks = Internal.getTasks({ teamView: true });
    var today = todayStr();

    return users.map(function(u) {
      var myTasks = tasks.filter(function(t) {
        return t.assigneeIds && t.assigneeIds.indexOf(u.id) !== -1;
      });
      var doneToday = myTasks.filter(function(t) {
        return t.status === 'done' && t.updatedAt && t.updatedAt.substring(0, 10) === today;
      }).length;
      return {
        userId: u.id, name: u.name, avatarColor: u.avatarColor,
        totalTasks: myTasks.length, doneToday: doneToday
      };
    });
  } catch(e) {
    throw new Error('getTeamProductivity: ' + e.message);
  }
}

function getTimeReport(filters, token) {
  requireSession(token);
  try {
    filters = filters || {};
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];
    var tasks = Internal.getTasks({ teamView: true, includeArchived: true });
    var clients = Internal.getClients();
    var users = Internal.getUsers();

    var logs = [];
    for (var j = 1; j < tlData.length; j++) {
      if (!tlData[j][5]) continue;
      var logDate = tlData[j][3] ? tlData[j][3].toString().substring(0, 10) : '';
      if (filters.dateFrom && logDate < filters.dateFrom) continue;
      if (filters.dateTo && logDate > filters.dateTo) continue;
      if (filters.userId && tlData[j][2] !== filters.userId) continue;
      logs.push({
        taskId: tlData[j][1], userId: tlData[j][2],
        duration: parseInt(tlData[j][5]) || 0, date: logDate
      });
    }

    var totalSec = logs.reduce(function(s, l) { return s + l.duration; }, 0);

    var byClientMap = {};
    logs.forEach(function(log) {
      var task = tasks.find(function(t) { return t.id === log.taskId; });
      if (!task) return;
      if (filters.clientId && task.clientId !== filters.clientId) return;
      if (!byClientMap[task.clientId]) byClientMap[task.clientId] = 0;
      byClientMap[task.clientId] += log.duration;
    });

    var byClient = clients.map(function(c) {
      return {
        clientId: c.id, name: c.name, color: c.colorHex,
        hours: Math.round((byClientMap[c.id] || 0) / 3600 * 10) / 10
      };
    }).filter(function(c) { return c.hours > 0; });

    var byUserMap = {};
    logs.forEach(function(log) {
      if (!byUserMap[log.userId]) byUserMap[log.userId] = 0;
      byUserMap[log.userId] += log.duration;
    });
    var byUser = users.map(function(u) {
      return {
        userId: u.id, name: u.name,
        hours: Math.round((byUserMap[u.id] || 0) / 3600 * 10) / 10
      };
    }).filter(function(u) { return u.hours > 0; });

    return {
      totalHours: Math.round(totalSec / 3600 * 10) / 10,
      byClient: byClient,
      byUser: byUser
    };
  } catch(e) {
    throw new Error('getTimeReport: ' + e.message);
  }
}

function searchTasks(query, token) {
  requireSession(token);
  try {
    var q = (query || '').toLowerCase();
    var tasks = Internal.getTasks({ teamView: true });
    var clients = Internal.getClients();
    var cats = Internal.getCategories();

    return tasks.filter(function(t) {
      if (t.title && t.title.toLowerCase().indexOf(q) !== -1) return true;
      var client = clients.find(function(c) { return c.id === t.clientId; });
      if (client && client.name.toLowerCase().indexOf(q) !== -1) return true;
      var cat = cats.find(function(c) { return c.id === t.categoryId; });
      if (cat && cat.name.toLowerCase().indexOf(q) !== -1) return true;
      return false;
    });
  } catch(e) {
    throw new Error('searchTasks: ' + e.message);
  }
}

// ============================================================
//  NOTIFICATIONS
// ============================================================

function getNotifications(userId, token) {
  requireSession(token);
  try {
    var uid = userId || Session.getActiveUser().getEmail();
    var s = getSheet('notifications');
    if (!s) return { notifications: [], unreadCount: 0 };
    var data = s.getDataRange().getValues();
    var result = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][1] !== uid) continue;
      result.push({
        id: data[i][0], userId: data[i][1], type: data[i][2],
        taskId: data[i][3], message: data[i][4],
        isRead: data[i][5] === true || data[i][5] === 'TRUE',
        createdAt: data[i][6] ? data[i][6].toString() : ''
      });
    }

    result.sort(function(a, b) { return a.createdAt > b.createdAt ? -1 : 1; });
    result = result.slice(0, 30);

    var unread = result.filter(function(n) { return !n.isRead; }).length;
    return { notifications: result, unreadCount: unread };
  } catch(e) {
    throw new Error('getNotifications: ' + e.message);
  }
}

function markNotificationRead(notifId, token) {
  try {
    var sess = requireSession(token);
    var s = getSheet('notifications');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === notifId) {
        // Ownership check: notification must belong to the session user
        if (data[i][1] !== sess.userId) return { success: false };
        s.getRange(i + 1, 6).setValue(true);
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) {
    throw new Error('markNotificationRead: ' + e.message);
  }
}

function markAllNotificationsRead(token) {
  try {
    var sess = requireSession(token);
    var uid = sess.userId;
    var s = getSheet('notifications');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === uid && (data[i][5] !== true && data[i][5] !== 'TRUE')) {
        s.getRange(i + 1, 6).setValue(true);
      }
    }
    return { success: true };
  } catch(e) {
    throw new Error('markAllNotificationsRead: ' + e.message);
  }
}

// Alias — now takes token, not userName
function markAllRead(token) {
  return markAllNotificationsRead(token);
}

// createNotification moved into Internal IIFE — use Internal.createNotification()

function sendDueSoonNotifications() {
  if (Internal.triggerRateLimited('sendDueSoonNotifications', TRIGGER_MIN_GAP_MS)) return;
  try {
    var today = todayStr();
    var tasks = Internal.getTasks({ teamView: true });

    tasks.forEach(function(t) {
      if (t.status === 'done' || t.status === 'archived' || t.status === 'deleted') return;
      if (!t.dueDate) return;

      var msg = t.dueDate === today
        ? 'Due today: ' + t.title
        : 'OVERDUE: ' + t.title;

      if (t.dueDate <= today) {
        (t.assigneeIds || []).forEach(function(uid) {
          Internal.createNotification(uid, 'due_soon', t.id, msg);
        });
      }
    });
  } catch(e) {
    // Silent — time-driven trigger
  }
}

// ============================================================
//  COMMENTS & CHECKLIST
// ============================================================

function addComment(taskId, commentText, token) {
  try {
    var sess = requireSession(token);
    var uid = sess.userId;
    var user = getUserById(uid);
    var userName = user ? user.name : uid;

    logActivity(taskId, uid, 'commented', commentText);

    // Parse @mentions
    var mentions = [];
    var re = /@(\w+)/g;
    var match;
    while ((match = re.exec(commentText)) !== null) {
      mentions.push(match[1]);
    }

    if (mentions.length > 0) {
      var users = Internal.getUsers();
      mentions.forEach(function(name) {
        var mentioned = users.find(function(u) { return u.name.toLowerCase() === name.toLowerCase(); });
        if (mentioned) {
          Internal.createNotification(mentioned.id, 'mention', taskId,
            userName + ' mentioned you in: ' + taskId);
        }
      });
    }

    return { success: true };
  } catch(e) {
    throw new Error('addComment: ' + e.message);
  }
}

function toggleChecklistItem(taskId, itemId, checked, token) {
  try {
    requireSession(token);
    var task = Internal.getTask(taskId);
    var checklist = task.checklist || [];
    checklist = checklist.map(function(item) {
      if (item.id === itemId) item.done = checked;
      return item;
    });
    return updateTask(taskId, { checklist: checklist }, token);
  } catch(e) {
    throw new Error('toggleChecklistItem: ' + e.message);
  }
}

function addChecklistItem(taskId, text, token) {
  try {
    requireSession(token);
    var task = Internal.getTask(taskId);
    var checklist = Array.isArray(task.checklist) ? task.checklist.slice() : [];
    var item = { id: newId(), text: String(text || '').trim(), done: false };
    if (!item.text) return { error: 'empty' };
    checklist.push(item);
    updateTask(taskId, { checklist: checklist }, token);
    return item;
  } catch(e) {
    throw new Error('addChecklistItem: ' + e.message);
  }
}

function deleteChecklistItem(taskId, itemId, token) {
  try {
    requireSession(token);
    var task = Internal.getTask(taskId);
    var checklist = (task.checklist || []).filter(function(i) { return i.id !== itemId; });
    return updateTask(taskId, { checklist: checklist }, token);
  } catch(e) {
    throw new Error('deleteChecklistItem: ' + e.message);
  }
}

// scheduleNextRecurrence removed as top-level — now Internal.scheduleNextRecurrence()

// ============================================================
//  WHATSAPP SHARE (client-side redirect — server just builds URL)
// ============================================================

// FIX 2 — session gate added
function shareToWhatsApp(taskId, token) {
  try {
    requireSession(token);
    var task = Internal.getTask(taskId);
    var text = '📋 *' + task.title + '*\n';
    if (task.dueDate) text += '📅 Due: ' + task.dueDate + '\n';
    if (task.priority) text += '🚨 Priority: ' + task.priority + '\n';
    if (task.status) text += '▶ Status: ' + task.status;
    return { url: 'https://wa.me/?text=' + encodeURIComponent(text) };
  } catch(e) {
    throw new Error('shareToWhatsApp: ' + e.message);
  }
}

// ============================================================
//  PHOTO ATTACHMENTS (Google Drive)
// ============================================================

var ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg','image/png','image/gif','image/webp','image/heic'];
// Guard: base64-encoded payload must not exceed ~10 MB (base64 ≈ 4/3 raw)
var MAX_ATTACHMENT_B64_CHARS = 14000000; // ~10 MB raw

// _getOrCreateAttachmentFolder removed as top-level — now Internal.getOrCreateAttachmentFolder()

function uploadTaskPhoto(taskId, base64Data, mimeType, token) {
  try {
    var sess = requireSession(token);
    if (!taskId) throw new Error('taskId required');
    if (ALLOWED_PHOTO_MIME_TYPES.indexOf(mimeType) === -1) {
      throw new Error('Unsupported file type');
    }
    if (!base64Data || base64Data.length > MAX_ATTACHMENT_B64_CHARS) {
      throw new Error('Payload missing or too large');
    }

    // FIX 4 — verify caller relationship to the task (throws if task not found)
    var task = Internal.getTask(taskId);
    var canEditAny = Internal.hasCapability(sess.userId, 'tasks.edit.any');
    var isCreator = task.createdBy === sess.userId;
    var isAssignee = (task.assigneeIds || []).indexOf(sess.userId) !== -1;
    if (!canEditAny && !isCreator && !isAssignee) {
      throw new Error('Not authorized to upload to this task');
    }

    // FIX 6 — server-side MIME→extension map (ignore client-supplied extension)
    var EXT_MAP = {'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/heic':'heic'};
    var ext = EXT_MAP[mimeType] || 'jpg';
    var fileName = 'photo_' + taskId + '_' + newId() + '.' + ext;

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);

    var folder = Internal.getOrCreateAttachmentFolder();
    var file = folder.createFile(blob);

    // Deliberate: ANYONE_WITH_LINK is required so photos are viewable in-app without re-auth.
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing';

    var id = newId();
    var s = getSheet('attachments');
    if (!s) throw new Error('attachments sheet missing — run initializeSheets()');
    s.appendRow([id, taskId, sess.userId, file.getId(), fileUrl, 'photo', now()]);

    logActivity(taskId, sess.userId, 'photo_uploaded', fileName);

    return { id: id, fileUrl: fileUrl };
  } catch(e) {
    throw new Error('uploadTaskPhoto: ' + e.message);
  }
}

// FIX 3 — require session + task-relationship check before returning attachment URLs
function getTaskAttachments(taskId, token) {
  try {
    var sess = requireSession(token);
    // Load the task — throws 'Task not found' if missing
    var task = Internal.getTask(taskId);
    var canEditAny = Internal.hasCapability(sess.userId, 'tasks.edit.any');
    var isCreator = task.createdBy === sess.userId;
    var isAssignee = (task.assigneeIds || []).indexOf(sess.userId) !== -1;
    if (!canEditAny && !isCreator && !isAssignee) {
      throw new Error('Not authorized to view attachments for this task');
    }
    var s = getSheet('attachments');
    if (!s) return [];
    var data = s.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] !== taskId) continue;
      result.push({
        id: data[i][0], taskId: data[i][1], userId: data[i][2],
        fileId: data[i][3], fileUrl: data[i][4], kind: data[i][5],
        createdAt: data[i][6] ? data[i][6].toString() : ''
      });
    }
    return result;
  } catch(e) {
    throw new Error('getTaskAttachments: ' + e.message);
  }
}

// ============================================================
//  SLA ESCALATION
// ============================================================

/**
 * Escalation tracking strategy: we store escalated task IDs in a settings key
 * ('escalated_task_ids') as a JSON array. This avoids adding a new column to
 * the tasks sheet (no schema migration needed) and is O(1) to read/write for
 * typical task volumes. The value is updated atomically under ScriptLock.
 */
function checkEscalations() {
  if (Internal.triggerRateLimited('checkEscalations', TRIGGER_MIN_GAP_MS)) return;
  try {
    var enabled = getSettingValue('escalation_enabled', 'true');
    if (enabled === false || String(enabled).toLowerCase() === 'false') return;

    var slaHours = {
      urgent: parseFloat(getSettingValue('sla_urgent_hours', 4)),
      high:   parseFloat(getSettingValue('sla_high_hours',   24)),
      medium: parseFloat(getSettingValue('sla_medium_hours', 72)),
      low:    parseFloat(getSettingValue('sla_low_hours',   168))
    };

    // Load escalated-ids set
    var escalatedRaw = getSettingValue('escalated_task_ids', '[]');
    var escalatedArr = safeParseJson(escalatedRaw, []);
    var escalatedSet = {};
    escalatedArr.forEach(function(id) { escalatedSet[id] = true; });

    var nowDate = new Date();
    var tasksSheet = getSheet('tasks');
    if (!tasksSheet) return;
    var taskData = tasksSheet.getDataRange().getValues();

    var openStatuses = ['todo', 'in-progress', 'blocked', 'awaiting_check', 'rejected'];
    var allUsers = getUsersStatic();
    var admins = allUsers.filter(function(u) { return u.role === 'admin'; });

    var newlyEscalated = [];

    for (var i = 1; i < taskData.length; i++) {
      var row = taskData[i];
      if (!row[0]) continue;
      var status = row[6];
      if (openStatuses.indexOf(status) === -1) continue;

      var taskId = row[0];
      if (escalatedSet[taskId]) continue; // already escalated

      var createdAt = row[9] ? new Date(row[9]) : null;
      if (!createdAt) continue;
      var ageHours = (nowDate - createdAt) / 3600000;

      var priority = (row[5] || 'medium').toLowerCase();
      var threshold = slaHours[priority] || slaHours.medium;

      if (ageHours < threshold) continue;

      // Escalate: notify assignees
      var assigneeIds = parseAssigneeIds(row[7]);
      // FIX 8 — sanitize user-supplied title before embedding in notification message
      var title = String(row[1] || taskId).replace(/[<>]/g, '');
      var msg = 'SLA breach: "' + title + '" (' + priority + ') has been open ' + Math.round(ageHours) + 'h';

      assigneeIds.forEach(function(uid) {
        Internal.createNotification(uid, 'escalation', taskId, msg);
      });

      // Notify all admins (avoid duplicate if admin is also assignee)
      admins.forEach(function(admin) {
        if (assigneeIds.indexOf(admin.id) === -1) {
          Internal.createNotification(admin.id, 'escalation', taskId, msg);
        }
      });

      logActivity(taskId, '', 'escalated', Math.round(ageHours) + 'h');
      newlyEscalated.push(taskId);
      escalatedSet[taskId] = true;
    }

    // Persist updated escalated set
    if (newlyEscalated.length > 0) {
      var lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        // Re-read to avoid race; merge
        var fresh = safeParseJson(getSettingValue('escalated_task_ids', '[]'), []);
        newlyEscalated.forEach(function(id) {
          if (fresh.indexOf(id) === -1) fresh.push(id);
        });

        // FIX 9 — prune IDs of tasks that are no longer open so the blob cannot grow unbounded
        var openStatusSet = { 'todo': true, 'in-progress': true, 'blocked': true, 'awaiting_check': true, 'rejected': true };
        var taskIdToStatus = {};
        for (var pi = 1; pi < taskData.length; pi++) {
          if (taskData[pi][0]) taskIdToStatus[taskData[pi][0]] = taskData[pi][6];
        }
        fresh = fresh.filter(function(id) {
          var s = taskIdToStatus[id];
          // Keep only if the task is still open (not found == may be deleted — prune it too)
          return s && openStatusSet[s];
        });

        var settingsSheet = getSheet('settings');
        var sData = settingsSheet.getDataRange().getValues();
        var found = false;
        for (var si = 1; si < sData.length; si++) {
          if (sData[si][0] === 'escalated_task_ids') {
            settingsSheet.getRange(si + 1, 2).setValue(JSON.stringify(fresh));
            found = true;
            break;
          }
        }
        if (!found) settingsSheet.appendRow(['escalated_task_ids', JSON.stringify(fresh)]);
      } finally {
        lock.releaseLock();
      }
    }
  } catch(e) {
    // FIX 2 — log trigger failures so they are visible in Apps Script execution log
    console.error('checkEscalations failed: ' + e);
    logActivity('', '', 'escalation_error', String(e));
  }
}

// ============================================================
//  SHIFT HANDOVER
// ============================================================

// FIX 7 — admin-only gate; single client map built before loop; corrected counts
function getShiftHandover(token) {
  try {
    var sess = requireCapability(token, 'reports.view'); // TODO: refine capability
    var tasksSheet = getSheet('tasks');
    if (!tasksSheet) throw new Error('tasks sheet missing');
    var taskData = tasksSheet.getDataRange().getValues();
    var today = todayStr();
    var allUsers = getUsersStatic();

    // Build user name map once
    var userMap = {};
    allUsers.forEach(function(u) { userMap[u.id] = u.name; });

    // Build client name map once (avoid calling Internal.getClients() per task)
    var clientMap = {};
    Internal.getClients().forEach(function(c) { clientMap[c.id] = c.name; });

    function resolveAssigneeNames(assigneeIds) {
      return (assigneeIds || []).map(function(uid) { return userMap[uid] || uid; });
    }

    function clientNameForId(clientId) {
      return clientId ? (clientMap[clientId] || clientId) : '';
    }

    var completedToday = [];
    var stillOpen = [];
    var blocked = [];

    for (var i = 1; i < taskData.length; i++) {
      var row = taskData[i];
      if (!row[0]) continue;
      var status = row[6];
      if (status === 'deleted' || status === 'archived') continue;

      var assigneeIds = parseAssigneeIds(row[7]);
      var taskSummary = {
        id: row[0],
        title: row[1],
        priority: row[5],
        client: clientNameForId(row[3]),
        assigneeNames: resolveAssigneeNames(assigneeIds),
        status: status
      };

      if (status === 'done') {
        var updatedAt = row[18] ? row[18].toString().substring(0, 10) : '';
        if (updatedAt === today) {
          completedToday.push(taskSummary);
        }
        // done-but-not-today tasks are not placed in any bucket — do not count them
      } else if (status === 'blocked') {
        blocked.push(taskSummary);
      } else if (status === 'todo' || status === 'in-progress' || status === 'awaiting_check' || status === 'rejected') {
        stillOpen.push(taskSummary);
      }
    }

    // counts.total = sum of the three buckets only (consistent with what is returned)
    var counts = {
      completedToday: completedToday.length,
      stillOpen: stillOpen.length,
      blocked: blocked.length,
      total: completedToday.length + stillOpen.length + blocked.length
    };

    return {
      generatedBy: sess.name,
      generatedAt: now(),
      completedToday: completedToday,
      stillOpen: stillOpen,
      blocked: blocked,
      counts: counts
    };
  } catch(e) {
    throw new Error('getShiftHandover: ' + e.message);
  }
}

// ============================================================
//  LEGACY / COMPAT aliases (keep stubs from original file)
// ============================================================

// Removed myFunction() and testPing() — debug scaffolding.

// FIX 1 — Restore aliases called by frontend screens and manifest.json
function getTeamMembers(token) { requireSession(token); return Internal.getUsers(); }
function getTeamPresence(token) { return getTeamStatus(token); }

// ── Performance scoring API ─────────────────────────────────
// userId, period ('day'|'week'|'month'|'all'), optional dateIso anchor
function getUserPerformance(userId, period, dateIso, token) {
  requireSession(token);
  return Internal.getUserPerformance(userId, period, dateIso);
}

// Admin-only company report
function getDailyCompanyReport(dateIso, token) {
  requireCapability(token, 'reports.view');
  return Internal.getDailyCompanyReport(dateIso);
}

// Lightweight, ungated yesterday-perf snapshot for the login screen.
// Returns minimal fields only — never throws. Validates that userId exists
// and is active before computing, so this cannot enumerate arbitrary IDs.
function getYesterdayPerformanceForLogin(userId) {
  try {
    if (!userId) return null;
    var users = getUsersForLogin();
    var found = users.find(function(u) { return u.id === userId; });
    if (!found || found.id === '__error__') return null;
    var d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 1);
    var iso = Utilities.formatDate(d, getTimezone(), 'yyyy-MM-dd');
    var p = Internal.getUserPerformance(userId, 'day', iso);
    return {
      tasksCompleted: p.tasksCompleted || 0,
      onTimeRate:     p.onTimeRate || 0,
      score:          p.score || 0,
      minutesLogged:  p.minutesLogged || 0,
      tasksAssigned:  p.tasksAssigned || 0,
      deltaFromPrevious: p.deltaFromPrevious
    };
  } catch(e) { return null; }
}

// ── Daily report email (driven by trigger) ──────────────────
// Runs once per day at 19:00 server time. Rate-limited to one send per day.
// Wraps all work in try/catch — must never throw to the trigger runtime.
function sendDailyReportEmail() {
  try {
    if (Internal.triggerRateLimited('sendDailyReportEmail', 12 * 60 * 60 * 1000)) return;
    var report = Internal.getDailyCompanyReport(todayStr());
    if (!report) return;
    var admins = [];
    try {
      admins = Internal.getUsers().filter(function(u) { return u.role === 'admin' && u.email; });
    } catch(e) { admins = []; }
    if (!admins.length) return;

    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function chipsHtml(items, color, label) {
      if (!items || !items.length) return '';
      return '<div style="margin:8px 0;font-family:Arial,sans-serif;font-size:13px"><strong>' + esc(label) + ':</strong> ' +
        items.map(function(x) {
          return '<span style="display:inline-block;background:' + color + ';color:#fff;border-radius:12px;padding:3px 10px;margin:2px 4px 2px 0;font-size:12px">' +
            esc(x.name) + (x.score != null ? ' · ' + x.score : '') + (x.overdue != null ? ' · ' + x.overdue + ' overdue' : '') +
            '</span>';
        }).join('') + '</div>';
    }

    var c = report.company || {};
    var userRows = (report.users || []).map(function(u) {
      var scoreColor = u.score >= 80 ? '#10B981' : (u.score >= 60 ? '#F59E0B' : '#DC2626');
      return '<tr>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #E5E7EB">' + esc(u.name) + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right">' + (u.tasksCompleted || 0) + '</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right">' + (u.onTimeRate || 0) + '%</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right">' + (u.minutesLogged || 0) + 'm</td>' +
        '<td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right;color:' + scoreColor + ';font-weight:bold">' + (u.score || 0) + '</td>' +
        '</tr>';
    }).join('');

    var html =
      '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827">' +
        '<h2 style="margin:0 0 4px 0;color:#1A73E8">TaskFlow Daily Report</h2>' +
        '<div style="color:#6B7280;font-size:13px;margin-bottom:16px">' + esc(report.date) + '</div>' +
        '<table style="width:100%;border-collapse:collapse;background:#F9FAFB;border-radius:8px;overflow:hidden;margin-bottom:16px">' +
          '<tr style="background:#1A73E8;color:#fff">' +
            '<th style="padding:8px;text-align:left">Company</th>' +
            '<th style="padding:8px;text-align:right">Done</th>' +
            '<th style="padding:8px;text-align:right">Added</th>' +
            '<th style="padding:8px;text-align:right">Minutes</th>' +
            '<th style="padding:8px;text-align:right">Overdue</th>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding:8px">Totals</td>' +
            '<td style="padding:8px;text-align:right">' + (c.tasksCompleted || 0) + '</td>' +
            '<td style="padding:8px;text-align:right">' + (c.tasksAdded || 0) + '</td>' +
            '<td style="padding:8px;text-align:right">' + (c.totalMinutesLogged || 0) + '</td>' +
            '<td style="padding:8px;text-align:right">' + (c.overdueAtEod || 0) + '</td>' +
          '</tr>' +
        '</table>' +
        chipsHtml(report.topPerformers, '#10B981', 'Top performers') +
        chipsHtml(report.needsAttention, '#DC2626', 'Needs attention') +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">' +
          '<tr style="background:#F3F4F6"><th style="padding:6px 8px;text-align:left">User</th><th style="padding:6px 8px;text-align:right">Done</th><th style="padding:6px 8px;text-align:right">On-time</th><th style="padding:6px 8px;text-align:right">Logged</th><th style="padding:6px 8px;text-align:right">Score</th></tr>' +
          userRows +
        '</table>' +
        '<div style="margin-top:18px;color:#9CA3AF;font-size:11px">Generated by TaskFlow.</div>' +
      '</div>';

    admins.forEach(function(a) {
      try {
        MailApp.sendEmail({ to: a.email, subject: 'TaskFlow Daily Report — ' + report.date, htmlBody: html });
      } catch(mailErr) { /* silent — non-critical */ }
    });
  } catch(e) {
    // Never throw from trigger
    try { console.error('sendDailyReportEmail: ' + e.message); } catch(_) {}
  }
}

// ── Per-user daily digest email (driven by trigger) ────────
// Runs once per day at 18:00 server time. Rate-limited to one send per day.
// Emails every active user with an email address; includes per-user task summary.
// Never throws — wraps everything for trigger safety.
function sendUserDailyDigests() {
  try {
    if (Internal.triggerRateLimited('sendUserDailyDigests', 12 * 60 * 60 * 1000)) return;
    var todayKey = todayStr();
    var users = [];
    try {
      users = Internal.getUsers().filter(function(u) { return u.email && u.isActive !== false; });
    } catch(e) { users = []; }
    if (!users.length) return;

    // Pull all live tasks once, then bucket per user.
    var allTasks = [];
    try {
      allTasks = Internal.getTasks({ includeArchived: false }) || [];
    } catch(e) { return; }

    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function taskList(tasks, emptyMsg) {
      if (!tasks.length) return '<div style="color:#9CA3AF;font-size:12px;padding:6px 0">' + emptyMsg + '</div>';
      return '<ul style="margin:4px 0 12px 0;padding-left:18px;font-size:13px;line-height:1.6">' +
        tasks.map(function(t) {
          var client = (t.client && t.client.name) ? ' <span style="color:#6B7280">· ' + esc(t.client.name) + '</span>' : '';
          var due = t.dueDate ? ' <span style="color:#9CA3AF;font-size:11px">(due ' + esc(t.dueDate) + ')</span>' : '';
          return '<li>' + esc(t.title) + client + due + '</li>';
        }).join('') +
        '</ul>';
    }

    users.forEach(function(u) {
      try {
        var mine = allTasks.filter(function(t) {
          var ids = t.assigneeIds || [];
          return ids.indexOf(u.id) !== -1 || t.createdBy === u.id;
        });
        var completedToday = mine.filter(function(t) {
          return t.status === 'done' && String(t.completedAt || '').slice(0,10) === todayKey;
        });
        var inProgress = mine.filter(function(t) { return t.status === 'in-progress'; });
        var overdue = mine.filter(function(t) {
          return t.status !== 'done' && t.status !== 'deleted' && t.status !== 'archived' &&
                 t.dueDate && String(t.dueDate).slice(0,10) < todayKey;
        });
        var tomorrowKey = (function() {
          var d = new Date(); d.setDate(d.getDate() + 1);
          return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        })();
        var dueTomorrow = mine.filter(function(t) {
          return t.status !== 'done' && t.status !== 'deleted' && t.status !== 'archived' &&
                 String(t.dueDate || '').slice(0,10) === tomorrowKey;
        });

        // Skip silent days: user has nothing in any bucket → no email noise.
        if (!completedToday.length && !inProgress.length && !overdue.length && !dueTomorrow.length) return;

        var html =
          '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827">' +
            '<h2 style="margin:0 0 4px 0;color:#1A73E8">Hi ' + esc(u.name) + ',</h2>' +
            '<div style="color:#6B7280;font-size:13px;margin-bottom:16px">Your TaskFlow digest for ' + esc(todayKey) + '</div>' +
            '<table style="width:100%;border-collapse:collapse;background:#F9FAFB;border-radius:8px;overflow:hidden;margin-bottom:16px;font-size:13px">' +
              '<tr style="background:#1A73E8;color:#fff">' +
                '<th style="padding:8px;text-align:left">Completed today</th>' +
                '<th style="padding:8px;text-align:left">In progress</th>' +
                '<th style="padding:8px;text-align:left">Overdue</th>' +
                '<th style="padding:8px;text-align:left">Due tomorrow</th>' +
              '</tr>' +
              '<tr>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;color:#10B981">' + completedToday.length + '</td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;color:#4F46E5">' + inProgress.length + '</td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;color:#DC2626">' + overdue.length + '</td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;color:#F59E0B">' + dueTomorrow.length + '</td>' +
              '</tr>' +
            '</table>' +
            '<h3 style="margin:16px 0 4px 0;font-size:14px;color:#10B981">Completed today</h3>' +
            taskList(completedToday, 'Nothing completed today.') +
            '<h3 style="margin:16px 0 4px 0;font-size:14px;color:#DC2626">Overdue</h3>' +
            taskList(overdue, 'No overdue tasks.') +
            '<h3 style="margin:16px 0 4px 0;font-size:14px;color:#4F46E5">In progress</h3>' +
            taskList(inProgress, 'No tasks in progress.') +
            '<h3 style="margin:16px 0 4px 0;font-size:14px;color:#F59E0B">Due tomorrow</h3>' +
            taskList(dueTomorrow, 'Nothing due tomorrow.') +
            '<div style="margin-top:18px;color:#9CA3AF;font-size:11px">Generated by TaskFlow.</div>' +
          '</div>';

        MailApp.sendEmail({
          to: u.email,
          subject: 'TaskFlow Digest — ' + todayKey,
          htmlBody: html
        });
      } catch(perUserErr) { /* silent — one user's failure must not stop the loop */ }
    });
  } catch(e) {
    try { console.error('sendUserDailyDigests: ' + e.message); } catch(_) {}
  }
}

// ============================================================
//  SEED DEMO DATA
//  Requires BOTH a valid admin session token AND the literal string
//  'WIPE_AND_SEED' as confirmToken.  Call via:
//    seedDemoData('WIPE_AND_SEED', adminSessionToken)
//  Never expose through the web UI; admin gate + confirm string are
//  dual safeguards against accidental data destruction.
// ============================================================

function seedDemoData(confirmToken, token) {
  requireCapability(token, 'users.manage');
  if (confirmToken !== 'WIPE_AND_SEED') {
    throw new Error('seedDemoData requires confirmToken === "WIPE_AND_SEED"');
  }
  try {
    cacheBustAll(); // ensure fresh reads after wholesale rewrite
    var ss = getSpreadsheet();
    var tz = getTimezone();

    // ── helpers ──────────────────────────────────────────────
    function dateStr(offsetDays) {
      var d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    }
    function isoOffset(offsetDays, hours, mins) {
      var d = new Date();
      d.setDate(d.getDate() + offsetDays);
      d.setHours(hours || 10, mins || 0, 0, 0);
      return d.toISOString();
    }

    // ── 1. USERS ─────────────────────────────────────────────
    var usersSheet = ss.getSheetByName('users');
    // Clear existing except header
    if (usersSheet.getLastRow() > 1) {
      usersSheet.deleteRows(2, usersSheet.getLastRow() - 1);
    }

    var usersData = [
      { name: 'Admin',  pin: '1234', role: 'admin',  color: '#1A73E8' },
      { name: 'Priya',  pin: '2222', role: 'member', color: '#34A853' },
      { name: 'Ravi',   pin: '3333', role: 'member', color: '#9334E6' },
      { name: 'Meena',  pin: '4444', role: 'member', color: '#EA4335' }
    ];
    var userIds = {};
    usersData.forEach(function(u) {
      var id = newId();
      var salt = newId();
      var hash = hashPin(u.pin, salt);
      usersSheet.appendRow([
        id, u.name, hash, salt, u.role, u.color, u.name.toLowerCase() + '@packmasters.in',
        JSON.stringify({ onAssign: true, onDue: true, onMention: true, onShared: true }),
        true, now(), 0, ''
      ]);
      userIds[u.name] = id;
    });

    // ── 2. CLIENTS ───────────────────────────────────────────
    var clientsSheet = ss.getSheetByName('clients');
    if (clientsSheet.getLastRow() > 1) clientsSheet.deleteRows(2, clientsSheet.getLastRow() - 1);

    var clientsData = [
      { name: 'Reliance Packaging', color: '#1A73E8' },
      { name: 'Marico Ltd',         color: '#34A853' },
      { name: 'Godrej Consumer',    color: '#9334E6' },
      { name: 'ITC Foods',          color: '#EA4335' },
      { name: 'Himalaya Herbals',   color: '#F9AB00' }
    ];
    var clientIds = {};
    clientsData.forEach(function(c) {
      var id = newId();
      clientsSheet.appendRow([id, c.name, c.color, true]);
      clientIds[c.name] = id;
    });

    // ── 3. CATEGORIES ────────────────────────────────────────
    var catSheet = ss.getSheetByName('categories');
    if (catSheet.getLastRow() > 1) catSheet.deleteRows(2, catSheet.getLastRow() - 1);

    var catsData = [
      { name: 'Design',      icon: '🎨' },
      { name: 'Production',  icon: '🏭' },
      { name: 'QC Check',    icon: '🔍' },
      { name: 'Dispatch',    icon: '🚚' },
      { name: 'Client Call', icon: '📞' },
      { name: 'Admin',       icon: '📋' }
    ];
    var catIds = {};
    catsData.forEach(function(c) {
      var id = newId();
      catSheet.appendRow([id, c.name, c.icon, true]);
      catIds[c.name] = id;
    });

    // ── 4. TASKS ─────────────────────────────────────────────
    var tasksSheet = ss.getSheetByName('tasks');
    if (tasksSheet.getLastRow() > 1) tasksSheet.deleteRows(2, tasksSheet.getLastRow() - 1);

    var adminId  = userIds['Admin'];
    var priyaId  = userIds['Priya'];
    var raviId   = userIds['Ravi'];
    var meenaId  = userIds['Meena'];

    var relId  = clientIds['Reliance Packaging'];
    var marId  = clientIds['Marico Ltd'];
    var godId  = clientIds['Godrej Consumer'];
    var itcId  = clientIds['ITC Foods'];
    var himId  = clientIds['Himalaya Herbals'];

    var desId  = catIds['Design'];
    var proId  = catIds['Production'];
    var qcId   = catIds['QC Check'];
    var disId  = catIds['Dispatch'];
    var callId = catIds['Client Call'];
    var admId  = catIds['Admin'];

    var tasks = [
      // Overdue
      { title: 'Finalize label artwork for Reliance',   client: relId, cat: desId,  pri: 'high',   status: 'todo',        assignees: [priyaId],         due: dateStr(-3), shared: false },
      { title: 'QC inspection batch #RPC-2024-11',      client: relId, cat: qcId,   pri: 'high',   status: 'todo',        assignees: [raviId],          due: dateStr(-1), shared: false },
      // Today due
      { title: 'Prepare Marico dispatch documents',     client: marId, cat: disId,  pri: 'medium', status: 'in-progress', assignees: [adminId],         due: dateStr(0),  shared: false },
      { title: 'Client call — ITC Foods artwork review',client: itcId, cat: callId, pri: 'high',   status: 'todo',        assignees: [adminId, priyaId],due: dateStr(0),  shared: false },
      { title: 'Update Godrej pricing sheet',           client: godId, cat: admId,  pri: 'low',    status: 'todo',        assignees: [meenaId],         due: dateStr(0),  shared: false },
      // Upcoming
      { title: 'Design pouch concept for Himalaya',     client: himId, cat: desId,  pri: 'medium', status: 'todo',        assignees: [priyaId],         due: dateStr(2),  shared: false },
      { title: 'Production run — Marico sachets',       client: marId, cat: proId,  pri: 'high',   status: 'todo',        assignees: [raviId],          due: dateStr(3),  shared: false },
      { title: 'Dispatch Godrej order #GC-551',         client: godId, cat: disId,  pri: 'medium', status: 'todo',        assignees: [raviId, meenaId], due: dateStr(4),  shared: false },
      { title: 'Weekly team stand-up prep',             client: null,  cat: admId,  pri: 'low',    status: 'todo',        assignees: [adminId],         due: dateStr(5),  shared: false },
      { title: 'ITC new SKU specification review',      client: itcId, cat: desId,  pri: 'high',   status: 'todo',        assignees: [priyaId, adminId],due: dateStr(6),  shared: false },
      // Shared pool
      { title: 'Photograph product samples',            client: relId, cat: proId,  pri: 'medium', status: 'todo',        assignees: [],                due: dateStr(1),  shared: true  },
      { title: 'Archive Q3 client contracts',           client: null,  cat: admId,  pri: 'low',    status: 'todo',        assignees: [],                due: dateStr(7),  shared: true  },
      // Done
      { title: 'Himalaya label print approval',         client: himId, cat: qcId,   pri: 'medium', status: 'done',        assignees: [meenaId],         due: dateStr(-4), shared: false },
      { title: 'Reliance packaging order confirmation', client: relId, cat: admId,  pri: 'high',   status: 'done',        assignees: [adminId],         due: dateStr(-5), shared: false },
      // In-progress
      { title: 'Design mockup — Marico new line',       client: marId, cat: desId,  pri: 'high',   status: 'in-progress', assignees: [priyaId],         due: dateStr(1),  shared: false },
      // Checklist task
      {
        title: 'Pre-dispatch checklist — ITC order',
        client: itcId, cat: disId, pri: 'high', status: 'todo',
        assignees: [raviId, meenaId], due: dateStr(2), shared: false,
        checklist: [
          { id: newId(), text: 'Verify item count',        done: true  },
          { id: newId(), text: 'Check label alignment',    done: true  },
          { id: newId(), text: 'Attach packing slip',      done: false },
          { id: newId(), text: 'Seal and palletize',       done: false }
        ]
      },
      // More variety
      { title: 'Godrej summer campaign brief',          client: godId, cat: callId, pri: 'medium', status: 'todo',        assignees: [adminId],         due: dateStr(8),  shared: false },
      { title: 'Rework Himalaya shampoo pouch die-cut', client: himId, cat: proId,  pri: 'high',   status: 'todo',        assignees: [raviId],          due: dateStr(3),  shared: false },
      { title: 'Quote — Marico export packaging',       client: marId, cat: admId,  pri: 'medium', status: 'todo',        assignees: [meenaId],         due: dateStr(9),  shared: false },
      { title: 'Reliance bi-monthly review meeting',    client: relId, cat: callId, pri: 'low',    status: 'done',        assignees: [adminId, priyaId],due: dateStr(-6), shared: false }
    ];

    var taskIds = [];
    tasks.forEach(function(t) {
      var id = newId();
      taskIds.push(id);
      var assigneeIds = JSON.stringify(t.assignees || []);
      var checklist   = JSON.stringify(t.checklist || []);
      tasksSheet.appendRow([
        id, t.title, '', t.client || '', t.cat, t.pri, t.status,
        assigneeIds, adminId, now(), t.due, '',
        t.shared, t.shared ? '' : (t.assignees[0] || ''), t.shared ? '' : now(),
        90, checklist, '', now(), ''
      ]);
    });

    // ── 5. TIME_LOG ──────────────────────────────────────────
    var tlSheet = ss.getSheetByName('time_log');
    if (tlSheet.getLastRow() > 1) tlSheet.deleteRows(2, tlSheet.getLastRow() - 1);

    // 12 completed time entries across past 3 days
    var tlEntries = [
      { task: taskIds[13], user: adminId,  start: isoOffset(-2,  9, 0),  dur: 3600  },
      { task: taskIds[12], user: meenaId,  start: isoOffset(-3, 10, 30), dur: 5400  },
      { task: taskIds[2],  user: adminId,  start: isoOffset(-1,  8, 0),  dur: 7200  },
      { task: taskIds[14], user: priyaId,  start: isoOffset(-1, 11, 0),  dur: 4500  },
      { task: taskIds[0],  user: priyaId,  start: isoOffset(-3,  9, 0),  dur: 2700  },
      { task: taskIds[5],  user: priyaId,  start: isoOffset(-2, 14, 0),  dur: 3000  },
      { task: taskIds[6],  user: raviId,   start: isoOffset(-2,  8, 0),  dur: 7800  },
      { task: taskIds[7],  user: raviId,   start: isoOffset(-1, 13, 0),  dur: 4200  },
      { task: taskIds[1],  user: raviId,   start: isoOffset(-3, 15, 0),  dur: 1800  },
      { task: taskIds[4],  user: meenaId,  start: isoOffset(-1,  9, 0),  dur: 3300  },
      { task: taskIds[18], user: meenaId,  start: isoOffset(-2, 16, 0),  dur: 2400  },
      { task: taskIds[17], user: raviId,   start: isoOffset(-1, 11, 30), dur: 5100  }
    ];

    // 1 open timer: admin currently working on task[2]
    var openLogId = newId();
    var openStart = isoOffset(0, 9, 0);
    tlSheet.appendRow([openLogId, taskIds[2], adminId, openStart, '', '', openStart]);

    tlEntries.forEach(function(e) {
      var logId = newId();
      var start = e.start;
      var stop  = new Date(new Date(start).getTime() + e.dur * 1000).toISOString();
      tlSheet.appendRow([logId, e.task, e.user, start, stop, e.dur, stop]);
    });

    // ── 6. ACTIVITY ──────────────────────────────────────────
    var actSheet = ss.getSheetByName('activity');
    if (actSheet.getLastRow() > 1) actSheet.deleteRows(2, actSheet.getLastRow() - 1);

    var actEntries = [
      { task: taskIds[13], user: adminId,  action: 'status_changed',  detail: 'todo → done',        ago: 4 },
      { task: taskIds[12], user: meenaId,  action: 'status_changed',  detail: 'todo → done',        ago: 3 },
      { task: taskIds[2],  user: adminId,  action: 'timer_started',   detail: '',                   ago: 1 },
      { task: taskIds[0],  user: priyaId,  action: 'comment',         detail: 'Working on revisions', ago: 2 },
      { task: taskIds[15], user: priyaId,  action: 'comment',         detail: 'Checklist updated',  ago: 1 },
      { task: taskIds[15], user: meenaId,  action: 'checklist_done',  detail: 'Verify item count',  ago: 1 },
      { task: taskIds[6],  user: adminId,  action: 'assigned',        detail: 'Assigned to Ravi',   ago: 2 },
      { task: taskIds[10], user: priyaId,  action: 'claimed',         detail: 'Claimed from pool',  ago: 0 },
      { task: taskIds[14], user: priyaId,  action: 'timer_stopped',   detail: '75 min',             ago: 1 },
      { task: taskIds[3],  user: adminId,  action: 'comment',         detail: 'Client confirmed time', ago: 0 },
      { task: taskIds[5],  user: adminId,  action: 'due_date_changed',detail: 'Due updated',        ago: 1 },
      { task: taskIds[7],  user: raviId,   action: 'status_changed',  detail: 'todo → in-progress', ago: 0 },
      { task: taskIds[17], user: raviId,   action: 'timer_started',   detail: '',                   ago: 0 },
      { task: taskIds[1],  user: raviId,   action: 'comment',         detail: 'Batch ready for QC', ago: 2 },
      { task: taskIds[9],  user: priyaId,  action: 'assigned',        detail: 'Assigned to Priya',  ago: 3 }
    ];
    actEntries.forEach(function(a) {
      var ts = new Date(new Date().getTime() - a.ago * 3600000).toISOString();
      actSheet.appendRow([newId(), a.task, a.user, a.action, a.detail, ts]);
    });

    // ── 7. NOTIFICATIONS ─────────────────────────────────────
    var notifSheet = ss.getSheetByName('notifications');
    if (notifSheet.getLastRow() > 1) notifSheet.deleteRows(2, notifSheet.getLastRow() - 1);

    var allUserIds = [adminId, priyaId, raviId, meenaId];
    var notifTemplates = [
      { type: 'assigned',  task: taskIds[3],  msg: 'You were assigned: Client call — ITC Foods artwork review' },
      { type: 'due_soon',  task: taskIds[0],  msg: 'Overdue: Finalize label artwork for Reliance' },
      { type: 'due_soon',  task: taskIds[1],  msg: 'Overdue: QC inspection batch #RPC-2024-11' },
      { type: 'comment',   task: taskIds[0],  msg: 'Priya commented on: Finalize label artwork for Reliance' },
      { type: 'shared',    task: taskIds[10], msg: 'New task in shared pool: Photograph product samples' },
      { type: 'timer',     task: taskIds[2],  msg: 'Timer running > 3 hours on: Prepare Marico dispatch documents' },
      { type: 'assigned',  task: taskIds[9],  msg: 'You were assigned: ITC new SKU specification review' },
      { type: 'comment',   task: taskIds[3],  msg: 'Admin commented: Client confirmed time' }
    ];

    // Give each user a mix of read/unread notifications
    allUserIds.forEach(function(uid, ui) {
      notifTemplates.forEach(function(n, ni) {
        var isRead = (ni < 3 + ui); // earlier ones read, recent ones unread
        var ts = new Date(new Date().getTime() - (notifTemplates.length - ni) * 1800000).toISOString();
        notifSheet.appendRow([newId(), uid, n.type, n.task, n.msg, isRead, ts]);
      });
    });

    return {
      ok: true,
      users: usersData.length,
      clients: clientsData.length,
      categories: catsData.length,
      tasks: tasks.length,
      timeLogs: tlEntries.length + 1,
      activities: actEntries.length,
      notifications: allUserIds.length * notifTemplates.length,
      adminPin: '1234', priyaPin: '2222', raviPin: '3333', meenaPin: '4444'
    };
  } catch(e) {
    throw new Error('seedDemoData failed: ' + e.message + '\n' + e.stack);
  }
}

// ============================================================
//  ADMIN — settings read/write
// ============================================================

/**
 * Returns all settings as a key→value object.
 * Requires admin token.
 */
function getSettings(token) {
  requireCapability(token, 'users.manage'); // TODO: refine capability
  var s = getSheet('settings');
  if (!s) return {};
  var data = s.getDataRange().getValues();
  var result = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    if (k) result[k] = data[i][1];
  }
  return result;
}

/**
 * Updates one or more settings from a plain object payload.
 * Requires admin token.
 *
 * Allowed keys (any other key is rejected with a generic error):
 *   sla_urgent_hours, sla_high_hours, sla_medium_hours, sla_low_hours,
 *   escalation_enabled, timezone, working_start, working_end,
 *   archive_after_days, timer_warning_hours, auto_archive
 *
 * Numeric SLA/hours keys must be positive numbers.
 * Busts the settings cache (if any) on success.
 * Returns { ok: true }.
 */
function updateSettings(payload, token) {
  requireCapability(token, 'users.manage'); // TODO: refine capability

  var ALLOWED_KEYS = {
    sla_urgent_hours:    'number',
    sla_high_hours:      'number',
    sla_medium_hours:    'number',
    sla_low_hours:       'number',
    timer_warning_hours: 'number',
    working_start:       'number',
    working_end:         'number',
    archive_after_days:  'number',
    escalation_enabled:  'any',
    timezone:            'any',
    auto_archive:        'any'
  };

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid request');
  }

  var keys = Object.keys(payload);
  for (var ki = 0; ki < keys.length; ki++) {
    var k = keys[ki];
    if (!ALLOWED_KEYS.hasOwnProperty(k)) {
      throw new Error('Invalid request');
    }
    if (ALLOWED_KEYS[k] === 'number') {
      var n = Number(payload[k]);
      if (isNaN(n) || n <= 0) {
        throw new Error('Invalid value for ' + k);
      }
    }
  }

  var s = getSheet('settings');
  if (!s) throw new Error('Settings sheet not found');
  var data = s.getDataRange().getValues();

  // Build row-index map (1-based Sheet row = array index + 1)
  var rowMap = {};
  for (var i = 1; i < data.length; i++) {
    var rk = String(data[i][0] || '').trim();
    if (rk) rowMap[rk] = i + 1; // 1-based Sheet row
  }

  for (var ki2 = 0; ki2 < keys.length; ki2++) {
    var key = keys[ki2];
    var val = payload[key];
    if (rowMap.hasOwnProperty(key)) {
      s.getRange(rowMap[key], 2).setValue(val);
    } else {
      s.appendRow([key, val]);
    }
  }

  // Bust settings cache entries used by cachedRead
  cacheBust('settings');

  return { ok: true };
}

// ── migrateExistingUsersAndSeedRoles ─────────────────────────
// One-time idempotent installer. Run from the Apps Script editor.
// Running twice is safe — all steps are guarded by existence checks.
function migrateExistingUsersAndSeedRoles() {
  var renamedCount = 0;
  var createdCount = 0;
  var rolesAssigned = 0;

  // Step 1: seed roles and permissions
  try {
    seedDefaultRolesAndPermissions();
  } catch(e) {
    console.error('migrateExistingUsersAndSeedRoles: seedDefaultRolesAndPermissions failed: ' + e.message);
  }

  var s = getSheet('users');
  if (!s) return 'Failed: users sheet missing.';
  var data = s.getDataRange().getValues();
  var headers = data[0]; // ['id','name','pin_hash','salt','role',...]

  // Build a name→rowIndex map (case-insensitive)
  function buildNameMap() {
    var d = s.getDataRange().getValues();
    var map = {};
    for (var i = 1; i < d.length; i++) {
      if (d[i][0]) map[(d[i][1] || '').toLowerCase()] = { rowIndex: i + 1, row: d[i] };
    }
    return map;
  }

  // Step 2: rename users
  var renames = [
    { from: 'priya',  to: 'Khushi' },
    { from: 'ravi',   to: 'Anuj'   },
    { from: 'meena',  to: 'Santosh' }
  ];
  try {
    var nameMap = buildNameMap();
    renames.forEach(function(pair) {
      var entry = nameMap[pair.from];
      if (entry) {
        s.getRange(entry.rowIndex, 2).setValue(pair.to);
        renamedCount++;
      }
    });
    cacheBust('users');
  } catch(e) {
    console.error('migrateExistingUsersAndSeedRoles: rename failed: ' + e.message);
  }

  // Step 3 & 4: assign roles and create new users
  var roleAssignments = [
    { name: 'admin',   role: 'admin'    },
    { name: 'khushi',  role: 'office'   },
    { name: 'anuj',    role: 'ops'      },
    { name: 'santosh', role: 'ops'      }
  ];

  try {
    var nameMap2 = buildNameMap();
    roleAssignments.forEach(function(pair) {
      var entry = nameMap2[pair.name];
      if (entry) {
        s.getRange(entry.rowIndex, 5).setValue(pair.role);
        rolesAssigned++;
      }
    });
    cacheBust('users');
  } catch(e) {
    console.error('migrateExistingUsersAndSeedRoles: role assignment failed: ' + e.message);
  }

  // Step 4: create new users if they don't exist
  var newUsers = [
    { name: 'Rajesh', pin: '4444', role: 'security', color: '#10B981' },
    { name: 'TBM',    pin: '0000', role: 'admin',    color: '#1A73E8' },
    { name: 'BBM',    pin: '9999', role: 'owner',    color: '#7C3AED' }
  ];

  try {
    var nameMap3 = buildNameMap();
    newUsers.forEach(function(u) {
      if (nameMap3[u.name.toLowerCase()]) return; // already exists
      try {
        var salt = newId();
        var hash = hashPin(u.pin, salt);
        var id = newId();
        s.appendRow([
          id, u.name, hash, salt, u.role, u.color, '',
          JSON.stringify({onAssign:true, onDue:true, onMention:true, onShared:true}),
          true, now(), 0, ''
        ]);
        createdCount++;
      } catch(e2) {
        console.error('migrateExistingUsersAndSeedRoles: create user ' + u.name + ' failed: ' + e2.message);
      }
    });
    cacheBust('users');
  } catch(e) {
    console.error('migrateExistingUsersAndSeedRoles: create users failed: ' + e.message);
  }

  return 'Migrated. Renamed: ' + renamedCount + '. Created: ' + createdCount + '. Roles assigned: ' + rolesAssigned + '.';
}

/**
 * One-time review helper — reads the external DWM operational tracker
 * spreadsheet, dumps every tab to a JSON file in the script-owner's Drive,
 * and shares the file as Anyone-with-link Viewer so an external reviewer
 * can fetch the contents. Safe to re-run — overwrites the previous dump.
 *
 * Run from Apps Script editor: select dumpDwmTrackerForReview, press Run,
 * then read the Execution log for the public file URL.
 */
function dumpDwmTrackerForReview() {
  var DWM_SHEET_ID = '1f1FeTZ6d0N29OPhcWMoOSNUpFx4QeVpt2B3qdI4w2Vk';
  var ss;
  try {
    ss = SpreadsheetApp.openById(DWM_SHEET_ID);
  } catch(e) {
    throw new Error('Cannot open DWM sheet: ' + e.message + '. Make sure the script owner has at least Viewer access to the sheet.');
  }

  var out = {
    sheetName: ss.getName(),
    sheetId: DWM_SHEET_ID,
    exportedAt: new Date().toISOString(),
    tabs: []
  };

  ss.getSheets().forEach(function(sh) {
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var data = (lastRow > 0 && lastCol > 0)
      ? sh.getRange(1, 1, lastRow, lastCol).getValues()
      : [];
    out.tabs.push({
      name: sh.getName(),
      gid: sh.getSheetId(),
      rows: data.length,
      cols: data.length ? data[0].length : 0,
      data: data
    });
  });

  var json = JSON.stringify(out, null, 2);

  // Delete any prior dump with the same name so we keep one canonical copy.
  var prior = DriveApp.getFilesByName('dwm-tracker-dump.json');
  while (prior.hasNext()) {
    try { prior.next().setTrashed(true); } catch(_) {}
  }

  var blob = Utilities.newBlob(json, 'application/json', 'dwm-tracker-dump.json');
  var file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var publicUrl = file.getUrl();
  var directDownload = 'https://drive.google.com/uc?export=download&id=' + file.getId();

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('DWM TRACKER DUMP READY');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('Tabs dumped: ' + out.tabs.length);
  out.tabs.forEach(function(t) {
    Logger.log('  • ' + t.name + ' — ' + t.rows + ' rows × ' + t.cols + ' cols');
  });
  Logger.log('');
  Logger.log('Drive file URL: ' + publicUrl);
  Logger.log('Direct download: ' + directDownload);
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('Paste the Direct download URL back to the reviewer.');

  return { url: publicUrl, downloadUrl: directDownload, tabs: out.tabs.length };
}

/**
 * One-shot importer — reads dwm-tracker-dump.json (must be in /scripts/dwm-tracker-dump-data
 * Apps Script project property, or fetched from the dumped Drive file). Creates 5 clients
 * if missing, then 58 recurring TaskFlow tasks (Daily/Weekly/Monthly) and 7 Instance
 * tasks (with due_date = today, no recurrence). Idempotent — task description is
 * prefixed with [dwm:<S.No>] and re-runs skip rows already imported.
 *
 * Defaults (override later in the task UI):
 *   Office     -> Khushi
 *   Quality    -> Anuj
 *   Production -> Santosh
 *   AP         -> BBM
 *   KP         -> Anuj
 *   <blank>    -> Khushi
 *
 * Run from clasp: `clasp run importDwmActivities`.
 */
function importDwmActivities() {
  // ── 1. Load the dump from Drive (look up by canonical filename) ────────
  var dumpFiles = DriveApp.getFilesByName('dwm-tracker-dump.json');
  if (!dumpFiles.hasNext()) {
    throw new Error('dwm-tracker-dump.json not found in Drive — run dumpDwmTrackerForReview first.');
  }
  var dump = JSON.parse(dumpFiles.next().getBlob().getDataAsString());
  var dwmTab = dump.tabs.filter(function(t) { return t.name === 'DWM'; })[0];
  if (!dwmTab) throw new Error('DWM tab not found in dump');
  var rows = dwmTab.data.slice(2); // skip date-header + col-header

  // ── 2. Ensure 5 clients exist ──────────────────────────────────────────
  var clientNames = ['YARA', 'HENKEL', 'DK', 'APL', 'PM'];
  var clientsSheet = getSheet('clients');
  var clientsData = clientsSheet.getDataRange().getValues();
  var clientByName = {};
  for (var ci = 1; ci < clientsData.length; ci++) {
    if (clientsData[ci][0]) clientByName[String(clientsData[ci][1]).trim().toUpperCase()] = clientsData[ci][0];
  }
  var clientsCreated = 0;
  var clientColors = { YARA: '#10B981', HENKEL: '#DC2626', DK: '#4F46E5', APL: '#F59E0B', PM: '#7C3AED' };
  clientNames.forEach(function(name) {
    if (!clientByName[name]) {
      var id = newId();
      clientsSheet.appendRow([id, name, clientColors[name] || '#4285F4', true]);
      clientByName[name] = id;
      clientsCreated++;
    }
  });
  try { cacheBust('clients'); } catch(_) {}

  // ── 3. User lookup by name ─────────────────────────────────────────────
  var usersSheet = getSheet('users');
  var usersData = usersSheet.getDataRange().getValues();
  var userByName = {};
  for (var ui = 1; ui < usersData.length; ui++) {
    if (usersData[ui][0]) userByName[String(usersData[ui][1]).trim()] = usersData[ui][0];
  }
  function uid(name) { return userByName[name] || null; }

  var RESP_MAP = {
    'Office':     uid('Khushi'),
    'Quality':    uid('Anuj'),
    'Production': uid('Santosh'),
    'AP':         uid('BBM'),
    'KP':         uid('Anuj'),
    '':           uid('Khushi')
  };
  // Sanity: ensure no fallback is null — if a user is missing, fall back to Admin.
  var adminId = uid('Admin') || uid('TBM');
  Object.keys(RESP_MAP).forEach(function(k) {
    if (!RESP_MAP[k]) RESP_MAP[k] = adminId;
  });

  // ── 4. Existing-import index (idempotency) ────────────────────────────
  var tasksSheet = getSheet('tasks');
  var tasksData = tasksSheet.getDataRange().getValues();
  var importedSnos = {};
  for (var ti = 1; ti < tasksData.length; ti++) {
    var desc = String(tasksData[ti][2] || '');
    var m = desc.match(/^\[dwm:(\d+)\]/);
    if (m) importedSnos[m[1]] = true;
  }

  // ── 5. Frequency → recurrence ─────────────────────────────────────────
  function freqToRecurrence(freq) {
    switch ((freq || '').toString().toLowerCase().trim()) {
      case 'daily':   return { type: 'daily' };
      case 'weekly':  return { type: 'weekly', step: 1 };
      case 'monthly': return { type: 'monthly', step: 1 };
      case 'instance': return null;
      default: return null;
    }
  }

  // ── 6. Create tasks ───────────────────────────────────────────────────
  var today = new Date();
  var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var created = 0, skipped = 0, errors = [];

  rows.forEach(function(r) {
    var sno = r[0];
    if (!(typeof sno === 'number') || !sno) return; // footer/summary row
    var snoKey = String(sno);
    if (importedSnos[snoKey]) { skipped++; return; }

    var clientRaw = String(r[1] || '').trim().toUpperCase();
    var clientId = clientByName[clientRaw] || '';
    var title = String(r[2] || '').trim();
    if (!title) { errors.push('row #' + sno + ': empty title'); return; }
    var resourcesUrl = String(r[3] || '').trim();
    var concernedAuthority = String(r[4] || '').trim();
    var pdca = String(r[5] || '').trim();
    var minutes = (typeof r[6] === 'number' && r[6] > 0) ? r[6] : 20;
    var responsibility = String(r[7] || '').trim();
    var frequency = String(r[8] || '').trim();

    var assigneeId = RESP_MAP[responsibility] || RESP_MAP[''] || adminId;
    var recurrence = freqToRecurrence(frequency);

    // Build description with dwm import key + extras (PDCA now stored in dedicated column)
    var notes = '[dwm:' + sno + '] [' + (frequency || 'Once') + ']\n' +
      (concernedAuthority ? 'Coordinate with: ' + concernedAuthority + '\n' : '') +
      (resourcesUrl ? 'Resource: ' + resourcesUrl + '\n' : '');

    var validPdca = ['P', 'D', 'C', 'A'];
    var pdcaVal = validPdca.indexOf(pdca) !== -1 ? pdca : '';

    try {
      Internal.createTask({
        title: title,
        description: notes,
        clientId: clientId,
        categoryId: '',
        priority: 'medium',
        status: 'todo',
        assigneeIds: assigneeId ? [assigneeId] : [],
        createdBy: adminId,
        dueDate: todayStr,
        scheduledTime: 'morning',
        isShared: false,
        estimatedMinutes: minutes,
        checklist: null,
        recurrence: recurrence,
        requiresPhoto: false,
        pdca: pdcaVal
      });
      created++;
    } catch(e) {
      errors.push('row #' + sno + ': ' + e.message);
    }
  });

  var summary = 'DWM import done. Clients created: ' + clientsCreated +
                '. Tasks created: ' + created +
                '. Skipped (already imported): ' + skipped +
                '. Errors: ' + errors.length;
  Logger.log(summary);
  errors.slice(0, 10).forEach(function(e) { Logger.log('  ! ' + e); });
  return summary;
}

// ===== CALENDAR SYNC =====

var CAL_PROP_KEY = 'taskflow_calendar_id';

function getOrCreateTaskFlowCalendar() {
  var props = PropertiesService.getScriptProperties();
  var calId = props.getProperty(CAL_PROP_KEY);
  if (calId) {
    try { CalendarApp.getCalendarById(calId); return calId; } catch(_) { /* stale — recreate */ }
  }
  var cal = CalendarApp.createCalendar('TaskFlow', { description: 'Auto-synced from TaskFlow' });
  calId = cal.getId();
  props.setProperty(CAL_PROP_KEY, calId);
  return calId;
}

function _calEventDescription(task) {
  var webAppUrl = '';
  try { webAppUrl = ScriptApp.getService().getUrl(); } catch(_) {}
  var assigneeUserId = '';
  var assigneeName = '';
  try {
    var ids = task.assigneeIds || [];
    if (ids.length) {
      assigneeUserId = ids[0];
      var u = getUserById(ids[0]);
      if (u) assigneeName = u.name;
    } else if (task.createdBy) {
      assigneeUserId = task.createdBy;
      var cu = getUserById(task.createdBy);
      if (cu) assigneeName = cu.name;
    }
  } catch(_) {}
  var clientName = '';
  try {
    var clients = Internal.getClients();
    var cl = clients.filter(function(c) { return c.id === task.clientId; })[0];
    if (cl) clientName = cl.name;
  } catch(_) {}
  var link = webAppUrl ? (webAppUrl + '?task=' + task.id) : '';
  var base = 'Status: ' + (task.status || '') +
    ' | Assignee: ' + assigneeName +
    ' | Client: ' + clientName +
    (link ? '\n\nLink: ' + link : '');

  // Append deep-link action buttons if we have a URL and a user to act as
  if (webAppUrl && assigneeUserId) {
    try {
      var startToken  = _makeActionToken(task.id, assigneeUserId, 'start');
      var doneToken   = _makeActionToken(task.id, assigneeUserId, 'done');
      var photoToken  = _makeActionToken(task.id, assigneeUserId, 'photo');
      base += '\n\n━━━━━━━━━━━━\n' +
        '▶ Start: ' + webAppUrl + '?act=start&t=' + startToken + '\n' +
        '✓ Done:  ' + webAppUrl + '?act=done&t='  + doneToken  + '\n' +
        '📷 Photo: ' + webAppUrl + '?act=photo&t=' + photoToken;
    } catch(_) {}
  }
  return base;
}

function _calEventTimes(task) {
  var tz = getTimezone();
  var dateStr = task.dueDate;
  // Default: if no due_date, use today at 9am
  if (!dateStr) dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var start = new Date(dateStr + 'T09:00:00');
  var durationMs = ((task.estimatedMinutes && task.estimatedMinutes > 0)
    ? task.estimatedMinutes : 60) * 60000;
  var end = new Date(start.getTime() + durationMs);
  return { start: start, end: end };
}

function syncTaskToCalendar(taskId) {
  var s = getSheet('tasks');
  var data = s.getDataRange().getValues();
  var header = data[0];
  var calColIdx = header.indexOf('calendar_event_id');
  if (calColIdx === -1) return; // column not yet added

  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === taskId) { rowIdx = i; break; }
  }
  if (rowIdx === -1) return;

  var row = data[rowIdx];
  var task = rowToTask(row);
  var calEventId = row[calColIdx] ? row[calColIdx].toString() : '';
  var isDeleted = task.status === 'deleted';

  var calId = getOrCreateTaskFlowCalendar();
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) return;

  if (isDeleted) {
    if (calEventId) {
      try { var ev = cal.getEventById(calEventId); if (ev) ev.deleteEvent(); } catch(_) {}
      s.getRange(rowIdx + 1, calColIdx + 1).setValue('');
    }
    return;
  }

  var times = _calEventTimes(task);
  var desc = _calEventDescription(task);
  var title = task.title || '(no title)';

  // Map status to CalendarApp.EventColor
  function _statusColor(st) {
    switch (st) {
      case 'todo':           return CalendarApp.EventColor.PALE_BLUE;
      case 'in-progress':    return CalendarApp.EventColor.BLUE;
      case 'awaiting_check': return CalendarApp.EventColor.YELLOW;
      case 'done':           return CalendarApp.EventColor.SAGE;
      case 'rejected':       return CalendarApp.EventColor.FLAMINGO;
      default:               return null;
    }
  }
  var eventColor = _statusColor(task.status);

  if (calEventId) {
    try {
      var existing = cal.getEventById(calEventId);
      if (existing) {
        existing.setTitle(title);
        existing.setDescription(desc);
        existing.setTime(times.start, times.end);
        if (eventColor) { try { existing.setColor(eventColor); } catch(_) {} }
        return;
      }
    } catch(_) {}
    // Event not found (deleted externally) — fall through to create
  }

  var newEvent = cal.createEvent(title, times.start, times.end, { description: desc });
  if (eventColor) { try { newEvent.setColor(eventColor); } catch(_) {} }
  s.getRange(rowIdx + 1, calColIdx + 1).setValue(newEvent.getId());
}

function syncAllTasksToCalendar(token) {
  requireCapability(token, 'users.manage');
  var s = getSheet('tasks');
  var data = s.getDataRange().getValues();
  var synced = 0, errors = 0;
  for (var i = 1; i < data.length; i++) {
    var status = data[i][6] ? data[i][6].toString() : '';
    if (status === 'deleted' || status === 'archived') continue;
    var taskId = data[i][0];
    if (!taskId) continue;
    try { syncTaskToCalendar(taskId); synced++; } catch(e) { errors++; Logger.log('syncAll err ' + taskId + ': ' + e.message); }
  }
  return { synced: synced, errors: errors };
}

function getCalendarShareUrl(token) {
  requireCapability(token, 'users.manage');
  var calId = getOrCreateTaskFlowCalendar();
  return 'https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(calId);
}

// ===== E2E VERIFY HELPERS =====
function debugTasksSchema() {
  var s = getSheet('tasks');
  var headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  var calIdx = headers.indexOf('calendar_event_id');
  return JSON.stringify({ headers: headers, calColIdx: calIdx, lastCol: s.getLastColumn() });
}

function forceInitTasksSchema() {
  initializeSheets();
  var s = getSheet('tasks');
  var headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  return JSON.stringify({ headers: headers, calColIdx: headers.indexOf('calendar_event_id') });
}

function verifyCalendarEventIds() {
  var s = getSheet('tasks');
  var data = s.getDataRange().getValues();
  var headers = data[0];
  var titleCol = headers.indexOf('title');
  var eventIdCol = headers.indexOf('calendar_event_id');
  var statusCol = headers.indexOf('status');
  var testTasks = 0, withEventId = 0, samples = [];
  for (var i = 1; i < data.length; i++) {
    var title = (data[i][titleCol] || '').toString();
    var status = (data[i][statusCol] || '').toString();
    if (status === 'deleted') continue;
    if (title.indexOf('[TEST]') !== 0) continue;
    testTasks++;
    var eid = (data[i][eventIdCol] || '').toString();
    if (eid) withEventId++;
    samples.push({ title: title, hasEventId: !!eid });
  }
  return JSON.stringify({ testTasks: testTasks, withEventId: withEventId, samples: samples });
}

// ===== TEST SETUP =====
function setupCalendarTest() {
  initializeSheets();
  var s = getSheet('users');
  var data = s.getDataRange().getValues();
  var headers = data[0];
  var emailCol = headers.indexOf('email');
  var nameCol = headers.indexOf('name');
  if (emailCol === -1) return JSON.stringify({ error: 'email column missing' });
  var tbmId = null, ownerId = null;
  for (var i = 1; i < data.length; i++) {
    var nm = (data[i][nameCol] || '').toString();
    if (nm === 'TBM') { tbmId = data[i][0]; s.getRange(i + 1, emailCol + 1).setValue('tu55h4r@gmail.com'); }
    if (nm === 'BBM') { ownerId = data[i][0]; }
  }
  cacheBust('users');
  if (!tbmId) return JSON.stringify({ error: 'TBM user not found' });

  // Clean up any prior test rows + their calendar events
  var ts = getSheet('tasks');
  var thead = ts.getRange(1, 1, 1, ts.getLastColumn()).getValues()[0];
  var titleCol = thead.indexOf('title');
  var statusCol = thead.indexOf('status');
  var eidCol = thead.indexOf('calendar_event_id');
  var tdata = ts.getDataRange().getValues();
  var calId = getOrCreateTaskFlowCalendar();
  var cal = CalendarApp.getCalendarById(calId);
  var deletedCount = 0;
  for (var j = tdata.length - 1; j >= 1; j--) {
    var ttl = (tdata[j][titleCol] || '').toString();
    if (ttl.indexOf('[TEST]') !== 0) continue;
    if (cal && eidCol !== -1) {
      var eid = (tdata[j][eidCol] || '').toString();
      if (eid) { try { var ev = cal.getEventById(eid); if (ev) ev.deleteEvent(); } catch(_) {} }
    }
    ts.deleteRow(j + 1);
    deletedCount++;
  }

  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  var created = [];
  var tasksToMake = [
    { title: '[TEST] Individual task for TBM', assignees: [tbmId], shared: false, pdca: 'P', minutes: 30 },
    { title: '[TEST] Shared task TBM + BBM', assignees: [tbmId, ownerId].filter(Boolean), shared: true, pdca: 'D', minutes: 45 },
    { title: '[TEST] Shared pool unassigned', assignees: [], shared: true, pdca: 'C', minutes: 60 }
  ];
  // Build row aligned to live header so it survives future schema additions
  tasksToMake.forEach(function(t) {
    var id = newId();
    var stamp = now();
    var fields = {
      id: id, title: t.title, description: 'Auto-generated calendar sync test',
      client_id: '', category_id: '', priority: 'medium', status: 'open',
      assignee_ids: t.assignees.join(','), created_by: tbmId,
      created_at: stamp, due_date: today, scheduled_time: '09:00',
      is_shared: t.shared, claimed_by: '', claimed_at: '',
      estimated_minutes: t.minutes, checklist: '', recurrence: '',
      updated_at: stamp, archived_at: '', requires_photo: false,
      completed_at: '', pdca: t.pdca, calendar_event_id: ''
    };
    var row = thead.map(function(h){ return fields[h] !== undefined ? fields[h] : ''; });
    ts.appendRow(row);
    try { syncTaskToCalendar(id); created.push(id); } catch(e) { Logger.log('sync err ' + id + ': ' + e.message); }
  });

  return JSON.stringify({
    tbmEmail: 'tu55h4r@gmail.com',
    calendarId: calId,
    shareUrl: 'https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(calId),
    deletedPriorTests: deletedCount,
    tasksCreated: created.length,
    taskIds: created
  });
}

// ===== BULK REASSIGN =====
function bulkReassignTasks(fromUserId, toUserId, opts) {
  opts = opts || {};
  var s = SpreadsheetApp.getActive().getSheetByName('tasks');
  if (!s) return { reassigned: 0, errors: 0 };
  var data = s.getDataRange().getValues();
  var reassigned = 0, errors = 0;
  for (var i = 1; i < data.length; i++) {
    try {
      var taskId = data[i][0];
      var client = (data[i][2] || '').toString();
      var category = (data[i][5] || '').toString();
      var status = (data[i][6] || '').toString();
      var ids = (data[i][7] || '').toString().split(',').map(function(x){ return x.trim(); }).filter(Boolean);
      if (opts.client && opts.client !== client) continue;
      if (opts.category && opts.category !== category) continue;
      if (opts.status && opts.status !== status) continue;
      if (status === 'deleted') continue;
      if (ids.indexOf(fromUserId) === -1) continue;
      var newIds = ids.map(function(u){ return u === fromUserId ? toUserId : u; });
      var dedup = [];
      newIds.forEach(function(u){ if (dedup.indexOf(u) === -1) dedup.push(u); });
      s.getRange(i + 1, 8).setValue(dedup.join(','));
      reassigned++;
      try { syncTaskToCalendar(taskId); } catch(e) {}
    } catch(e) { errors++; Logger.log('reassign err: ' + e.message); }
  }
  return { reassigned: reassigned, errors: errors, fromUserId: fromUserId, toUserId: toUserId };
}

// ============================================================
//  PHASE 3 — DWM Recurring Calendar Events
// ============================================================

// Spawn a fresh task row from a template task and apply the given action.
// Returns the newly created task object.
function _spawnInstanceFromTemplate(templateId, userId, action) {
  var tmpl = Internal.getTask(templateId);
  var actionStatus = (action === 'start') ? 'in-progress' : 'todo';
  var today = todayStr();
  var claimedBy = (action === 'start' || action === 'claim') ? userId : '';
  var claimedAt = claimedBy ? now() : '';
  var newTask = Internal.createTask({
    title: tmpl.title,
    description: tmpl.description,
    clientId: tmpl.clientId,
    categoryId: tmpl.categoryId,
    priority: tmpl.priority,
    status: actionStatus,
    assigneeIds: tmpl.assigneeIds && tmpl.assigneeIds.length ? tmpl.assigneeIds : (userId ? [userId] : []),
    createdBy: tmpl.createdBy,
    dueDate: today,
    scheduledTime: tmpl.scheduledTime,
    isShared: tmpl.isShared,
    estimatedMinutes: tmpl.estimatedMinutes,
    checklist: (tmpl.checklist || []).map(function(item) {
      return { id: newId(), text: item.text, done: false };
    }),
    recurrence: null,
    requiresPhoto: tmpl.requiresPhoto,
    pdca: tmpl.pdca,
    isTemplate: false,
    templateId: templateId
  });
  if (action === 'start') {
    try { Internal.startTimerForUser(newTask.id, userId); } catch(_) {}
  }
  try { syncTaskToCalendar(newTask.id); } catch(_) {}
  return newTask;
}

// Determine RRULE frequency string from a recurrence object or description prefix
function _dwmRrule(recurrence, descPrefix) {
  if (recurrence) {
    if (recurrence.type === 'daily')   return 'RRULE:FREQ=DAILY';
    if (recurrence.type === 'weekly')  return 'RRULE:FREQ=WEEKLY';
    if (recurrence.type === 'monthly') return 'RRULE:FREQ=MONTHLY';
  }
  // Parse from [Daily]/[Weekly]/[Monthly] prefix in description
  if (descPrefix) {
    var d = descPrefix.toLowerCase();
    if (d.indexOf('daily')   !== -1) return 'RRULE:FREQ=DAILY';
    if (d.indexOf('weekly')  !== -1) return 'RRULE:FREQ=WEEKLY';
    if (d.indexOf('monthly') !== -1) return 'RRULE:FREQ=MONTHLY';
  }
  return 'RRULE:FREQ=DAILY'; // default for DWM tasks
}

/**
 * One-time migration. For each DWM-tagged task row:
 *   1. Marks the row as a template (status='template', is_template=true).
 *   2. Creates a recurring CalendarEventSeries on the TaskFlow calendar.
 *   3. Event description includes HMAC deep-link buttons using the template task id.
 * Admin-only, callable via clasp run.
 * Returns JSON string for clasp compatibility.
 */
function convertDwmToRecurring() {
  try {
    var calId = getOrCreateTaskFlowCalendar();
    var cal = CalendarApp.getCalendarById(calId);
    if (!cal) throw new Error('Could not open TaskFlow calendar');

    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();
    var header = data[0];
    var idCol         = header.indexOf('id');
    var titleCol      = header.indexOf('title');
    var descCol       = header.indexOf('description');
    var statusCol     = header.indexOf('status');
    var assigneeCol   = header.indexOf('assignee_ids');
    var createdByCol  = header.indexOf('created_by');
    var dueDateCol    = header.indexOf('due_date');
    var estMinCol     = header.indexOf('estimated_minutes');
    var recCol        = header.indexOf('recurrence');
    var isTemplateCol = header.indexOf('is_template');
    var calEventCol   = header.indexOf('calendar_event_id');

    if (isTemplateCol === -1 || calEventCol === -1) {
      return JSON.stringify({ error: 'Run initializeSheets() first to add new columns' });
    }

    var webAppUrl = '';
    try { webAppUrl = ScriptApp.getService().getUrl(); } catch(_) {}

    var templatesCreated = 0, eventsCreated = 0, skipped = 0;
    var errors = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[idCol]) continue;
      var desc = row[descCol] ? row[descCol].toString() : '';
      if (desc.indexOf('[dwm:') === -1) continue; // not a DWM task

      var currentStatus = row[statusCol] ? row[statusCol].toString() : '';
      if (currentStatus === 'template') { skipped++; continue; } // already converted

      var taskId = row[idCol].toString();
      var title  = row[titleCol] ? row[titleCol].toString() : '(no title)';
      var recurrence = safeParseJson(row[recCol], null);
      var rrule = _dwmRrule(recurrence, desc);

      // Mark as template
      s.getRange(i + 1, statusCol + 1).setValue('template');
      s.getRange(i + 1, isTemplateCol + 1).setValue(true);
      s.getRange(i + 1, statusCol + 1).setValue('template'); // belt-and-suspenders
      templatesCreated++;

      // Determine assignee for token generation
      var assigneeIdRaw = row[assigneeCol] ? row[assigneeCol].toString() : '';
      var assigneeIds = parseAssigneeIds(assigneeIdRaw);
      var tokenUserId = assigneeIds.length ? assigneeIds[0] : (row[createdByCol] ? row[createdByCol].toString() : '');

      // Build event times
      var dueDateStr = row[dueDateCol] ? row[dueDateCol].toString().substring(0, 10) : todayStr();
      var estMin = Number(row[estMinCol]) > 0 ? Number(row[estMinCol]) : 60;
      var startDate = new Date(dueDateStr + 'T09:00:00');
      var endDate = new Date(startDate.getTime() + estMin * 60000);

      // Build description with deep-link buttons
      var eventDesc = 'DWM Template: ' + title + '\n' + desc;
      if (webAppUrl && tokenUserId) {
        try {
          var startTok = _makeActionToken(taskId, tokenUserId, 'start');
          var doneTok  = _makeActionToken(taskId, tokenUserId, 'done');
          var photoTok = _makeActionToken(taskId, tokenUserId, 'photo');
          eventDesc += '\n\n━━━━━━━━━━━━\n' +
            '▶ Start: ' + webAppUrl + '?act=start&t=' + startTok + '\n' +
            '✓ Done:  ' + webAppUrl + '?act=done&t='  + doneTok  + '\n' +
            '📷 Photo: ' + webAppUrl + '?act=photo&t=' + photoTok;
        } catch(e2) { errors.push('token gen for ' + taskId + ': ' + e2.message); }
      }

      // Create recurring calendar event series
      try {
        var recurrence2 = CalendarApp.newRecurrence();
        if (rrule === 'RRULE:FREQ=DAILY')        recurrence2.addDailyRule();
        else if (rrule === 'RRULE:FREQ=WEEKLY')  recurrence2.addWeeklyRule();
        else if (rrule === 'RRULE:FREQ=MONTHLY') recurrence2.addMonthlyRule();
        else recurrence2.addDailyRule();

        var series = cal.createEventSeries(title, startDate, endDate, recurrence2, { description: eventDesc });
        // Store series ID in the template row's calendar_event_id
        s.getRange(i + 1, calEventCol + 1).setValue(series.getId());
        eventsCreated++;
      } catch(e3) {
        errors.push('calendar series for ' + taskId + ': ' + e3.message);
      }
    }

    var result = {
      templatesCreated: templatesCreated,
      eventsCreated: eventsCreated,
      skipped: skipped,
      errors: errors
    };
    Logger.log(JSON.stringify(result));
    return JSON.stringify(result);
  } catch(e) {
    return JSON.stringify({ error: e.message });
  }
}
