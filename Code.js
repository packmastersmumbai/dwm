// ============================================================
//  TaskFlow — Code.gs  (GAS V8 runtime)
//  Sheet ID: 1a17AzXT60a5tYZFlxODHwA4ZCBT3QATrtrf1GcaGHI0
// ============================================================

var SHEET_ID = '1a17AzXT60a5tYZFlxODHwA4ZCBT3QATrtrf1GcaGHI0';

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

// ── doGet / include ──────────────────────────────────────────

function doGet(e) {
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

function initializeSheets() {
  var ss = getSpreadsheet();

  var schemas = {
    tasks: ['id','title','description','client_id','category_id','priority','status',
            'assignee_ids','created_by','created_at','due_date','scheduled_time',
            'is_shared','claimed_by','claimed_at','estimated_minutes','checklist',
            'recurrence','updated_at','archived_at'],
    users: ['id','name','pin_hash','salt','role','avatar_color','email',
            'notify_prefs','is_active','last_seen_at','failed_attempts','locked_until'],
    clients: ['id','name','color_hex','is_active'],
    categories: ['id','name','icon_emoji','is_active'],
    time_log: ['id','task_id','user_id','started_at','stopped_at','duration_seconds','last_heartbeat'],
    activity: ['id','task_id','user_id','action','detail','created_at'],
    notifications: ['id','user_id','type','task_id','message','is_read','created_at'],
    settings: ['key','value'],
    attachments: ['id','task_id','user_id','file_id','file_url','kind','created_at']
  };

  Object.keys(schemas).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(schemas[name]);
    }
  });

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

// ── createTriggers (run once after deploy) ───────────────────

function createTriggers() {
  // Remove existing to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('archiveOldDoneTasks').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('sendDueSoonNotifications').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('checkTimerWarnings').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('checkEscalations').timeBased().everyHours(1).create();
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

// Full user list — adds live activeTimer per user (NOT cached, since timer changes constantly)
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
    throw new Error('getUsers: ' + e.message);
  }
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
    requireAdmin(token);
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
    requireAdmin(token);

    // FIX C — prevent removing the last admin's admin role
    if (fields.role !== undefined && fields.role !== 'admin') {
      var target = getUserById(userId);
      if (target && target.role === 'admin') {
        var admins = getUsers().filter(function(u) { return u.role === 'admin'; });
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

function removeUser(userId, token) {
  try {
    requireAdmin(token);
    // Prevent removing last admin
    var admins = getUsers().filter(function(u) { return u.role === 'admin'; });
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
 * Requires the caller to be an admin. Returns the session.
 */
function requireAdmin(token) {
  var sess = requireSession(token);
  if (sess.role !== 'admin') throw new Error('Admin access required');
  return sess;
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
      throw new Error('getClients: ' + e.message);
    }
  });
}

function createClient(payload) {
  try {
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

function updateClient(id, fields) {
  try {
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
      throw new Error('getCategories: ' + e.message);
    }
  });
}

function createCategory(payload) {
  try {
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

function updateCategory(id, fields) {
  try {
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
//       recurrence(17) updated_at(18) archived_at(19)

function rowToTask(row) {
  return {
    id: row[0],
    title: row[1],
    description: row[2],
    clientId: row[3],
    categoryId: row[4],
    priority: row[5],
    status: row[6],
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
    archivedAt: row[19] ? row[19].toString() : ''
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
  var clients = getClients();
  task.client = clients.find(function(c) { return c.id === task.clientId; }) || null;

  // Expand category
  var cats = getCategories();
  task.category = cats.find(function(c) { return c.id === task.categoryId; }) || null;

  // Expand assignees (id+name+avatar+avatarColor+status — needed for presence dot)
  var allUsers = getUsers();
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

function getTasks(filters) {
  try {
    filters = filters || {};
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();
    var tasks = [];

    // Pre-load lookup tables ONCE — cached via CacheService for 600s
    var clients = getClients();
    var cats = getCategories();
    var allUsers = getUsersStatic();

    function expandFast(task) {
      task.client = clients.find(function(c){ return c.id === task.clientId; }) || null;
      task.category = cats.find(function(c){ return c.id === task.categoryId; }) || null;
      task.assignees = (task.assigneeIds || []).map(function(uid){
        var u = allUsers.find(function(x){ return x.id === uid; });
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

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      var status = row[6];
      if (status === 'deleted') continue;
      if (status === 'archived' && !filters.includeArchived) continue;

      var task = rowToTask(row);

      // Team view: all tasks
      if (filters.teamView) {
        tasks.push(expandFast(task));
        continue;
      }

      // User-specific
      if (filters.userId || filters.assignedTo) {
        var uid = filters.userId || filters.assignedTo;
        var assigneeIds = task.assigneeIds || [];
        if (assigneeIds.indexOf(uid) === -1 && task.createdBy !== uid) continue;
      }

      // Filters
      if (filters.status && filters.status.length > 0) {
        if (filters.status.indexOf(status) === -1) continue;
      }
      if (filters.clientId && task.clientId !== filters.clientId) continue;
      if (filters.isShared !== undefined && task.isShared !== filters.isShared) continue;
      if (filters.dateFrom && task.dueDate && task.dueDate < filters.dateFrom) continue;
      if (filters.dateTo && task.dueDate && task.dueDate > filters.dateTo) continue;

      tasks.push(expandFast(task));
    }

    // Sort: priority rank asc, then dueDate asc, then createdAt desc
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
    throw new Error('getTasks: ' + e.message);
  }
}

function getTask(taskId) {
  try {
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        var task = expandTask(rowToTask(data[i]));

        // Full time_log
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

        // Last 20 activity
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
    throw new Error('getTask: ' + e.message);
  }
}

// Aliases used in manifest and screens
function getTaskDetail(taskId) { return getTask(taskId); }
function getTaskById(taskId) { return getTask(taskId); }
function addUser(payload, token) { return createUser(payload, token); }

// ── Write functions ─────────────────────────────────────────

// Internal worker — creates a task from a fully-resolved payload (no token).
// Used by scheduleNextRecurrence, seedDemoData, addPlanItem (which supply userId directly).
function _createTask(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var VALID_STATUSES = ['todo', 'in-progress', 'done', 'blocked', 'deleted', 'archived'];
    var taskStatus = payload.status || 'todo';
    if (VALID_STATUSES.indexOf(taskStatus) === -1) {
      throw new Error('Invalid status: ' + taskStatus);
    }
    var id = newId();
    var ts = now();
    var s = getSheet('tasks');
    s.appendRow([
      id,
      payload.title,
      payload.description || '',
      payload.clientId || '',
      payload.categoryId || '',
      payload.priority || 'medium',
      taskStatus,
      (payload.assigneeIds || []).join(','),
      payload.createdBy || '',
      ts,
      payload.dueDate || '',
      payload.scheduledTime || '',
      payload.isShared ? true : false,
      '',  // claimed_by
      '',  // claimed_at
      payload.estimatedMinutes || '',
      payload.checklist ? JSON.stringify(payload.checklist) : '',
      payload.recurrence ? JSON.stringify(payload.recurrence) : '',
      ts,  // updated_at
      ''   // archived_at
    ]);

    logActivity(id, payload.createdBy, 'created', payload.title);

    // Notify assignees
    (payload.assigneeIds || []).forEach(function(uid) {
      if (uid !== payload.createdBy) {
        var creator = getUserById(payload.createdBy);
        createNotification(uid, 'assigned', id,
          (creator ? creator.name : 'Someone') + ' assigned you: ' + payload.title);
      }
    });

    // Notify all active users if shared
    if (payload.isShared) {
      getUsers().forEach(function(u) {
        createNotification(u.id, 'assigned', id, 'New shared task: ' + payload.title);
      });
    }

    return expandTask(rowToTask([
      id, payload.title, payload.description || '',
      payload.clientId || '', payload.categoryId || '',
      payload.priority || 'medium', taskStatus,
      (payload.assigneeIds || []).join(','), payload.createdBy || '',
      ts, payload.dueDate || '', payload.scheduledTime || '',
      payload.isShared ? true : false, '', '', payload.estimatedMinutes || '',
      payload.checklist ? JSON.stringify(payload.checklist) : '',
      payload.recurrence ? JSON.stringify(payload.recurrence) : '',
      ts, ''
    ]));
  } catch(e) {
    throw new Error('_createTask: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

// Client-facing createTask: resolves createdBy from token.
function createTask(payload, token) {
  var sess = requireSession(token);
  payload = Object.assign({}, payload);
  payload.createdBy = sess.userId;
  return _createTask(payload);
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

// Server-side/admin helper — bypasses token auth intentionally
function quickSaveTask(title, clientId, priority, scheduledTime, isShared) {
  return _createTask({
    title: title, clientId: clientId, priority: priority || 'medium',
    scheduledTime: scheduledTime, isShared: isShared || false,
    createdBy: Session.getActiveUser().getEmail() || 'system',
    status: 'todo', assigneeIds: []
  });
}

function quickAddTask(payload, token) {
  try {
    var sess = requireSession(token);
    return _createTask({
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

// FIX A — internal worker: performs the actual sheet write with NO authz check.
// Use this for backend-to-backend calls (startTimer, claimTask, unclaimTask,
// scheduleNextRecurrence, archiveOldDoneTasks, deferTask) that must not be blocked.
function _updateTaskFields(taskId, fields) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var s = getSheet('tasks');
    var data = s.getDataRange().getValues();
    var VALID_STATUSES = ['todo', 'in-progress', 'done', 'blocked', 'deleted', 'archived'];

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== taskId) continue;
      var oldRow = data[i];
      var oldStatus = oldRow[6];

      if (fields.status !== undefined && VALID_STATUSES.indexOf(fields.status) === -1) {
        throw new Error('Invalid status: ' + fields.status);
      }

      // tasks columns (1-indexed in sheet):
      // id=1, title=2, description=3, client_id=4, category_id=5, priority=6, status=7,
      // assignee_ids=8, created_by=9, created_at=10, due_date=11, scheduled_time=12,
      // is_shared=13, claimed_by=14, claimed_at=15, estimated_minutes=16, checklist=17,
      // recurrence=18, updated_at=19, archived_at=20

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
        }
      }
      if (fields.assigneeIds !== undefined) s.getRange(i + 1, 8).setValue(fields.assigneeIds.join(','));
      if (fields.dueDate !== undefined) s.getRange(i + 1, 11).setValue(fields.dueDate);
      if (fields.scheduledTime !== undefined) s.getRange(i + 1, 12).setValue(fields.scheduledTime);
      if (fields.isShared !== undefined) s.getRange(i + 1, 13).setValue(fields.isShared);
      if (fields.claimedBy !== undefined) s.getRange(i + 1, 14).setValue(fields.claimedBy);
      if (fields.claimedAt !== undefined) s.getRange(i + 1, 15).setValue(fields.claimedAt);
      if (fields.estimatedMinutes !== undefined) s.getRange(i + 1, 16).setValue(fields.estimatedMinutes);
      if (fields.checklist !== undefined) s.getRange(i + 1, 17).setValue(JSON.stringify(fields.checklist));
      if (fields.recurrence !== undefined) s.getRange(i + 1, 18).setValue(fields.recurrence ? JSON.stringify(fields.recurrence) : '');

      s.getRange(i + 1, 19).setValue(now()); // updated_at

      return expandTask(rowToTask(s.getRange(i + 1, 1, 1, 20).getValues()[0]));
    }
    throw new Error('Task not found: ' + taskId);
  } catch(e) {
    throw new Error('_updateTaskFields: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

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

      // Authorization: requester must be creator, an assignee, or an admin
      var isAdmin = sess.role === 'admin';
      var isCreator = oldRow[8] === userId;
      var existingAssignees = parseAssigneeIds(oldRow[7]);
      var isAssignee = existingAssignees.indexOf(userId) !== -1;
      if (!isAdmin && !isCreator && !isAssignee) {
        throw new Error('Not authorized to update this task');
      }

      return _updateTaskFields(taskId, fields);
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
function markTaskDone(taskId, token) {
  return updateTaskStatus(taskId, 'done', token);
}

// Client-facing deleteTask: token in place of userId.
function deleteTask(taskId, token) {
  try {
    var sess = requireSession(token);
    updateTask(taskId, { status: 'deleted' }, token);
    logActivity(taskId, sess.userId, 'deleted', '');
    return { success: true };
  } catch(e) {
    throw new Error('deleteTask: ' + e.message);
  }
}

function deferTask(taskId) {
  try {
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

function archiveOldDoneTasks() {
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

function getMyDayTasks(userIdOrName) {
  try {
    var today = todayStr();
    // Resolve to a user: try by ID first, then by name
    var resolvedUser = getUserById(userIdOrName);
    if (!resolvedUser) {
      var allUsers = getUsersStatic();
      resolvedUser = allUsers.filter(function(u) {
        return u.name === userIdOrName;
      })[0] || null;
    }
    var resolvedId = resolvedUser ? resolvedUser.id : null;
    var allTasks = getTasks({});
    return allTasks.filter(function(t) {
      if (t.status === 'done' || t.status === 'deleted' || t.status === 'archived') return false;
      var ids = t.assigneeIds || []; // FIX F — already a parsed array from rowToTask; no re-serialization needed
      var isAssigned = resolvedId
        ? ids.indexOf(resolvedId) !== -1
        : false;
      if (!isAssigned) return false;
      return !t.dueDate || t.dueDate <= today;
    });
  } catch(e) {
    throw new Error('getMyDayTasks: ' + e.message);
  }
}

function getSharedPoolTasks() {
  try {
    return getTasks({ isShared: true }).filter(function(t) {
      return t.status !== 'done' && t.status !== 'deleted' && t.status !== 'archived' && !t.claimedBy;
    });
  } catch(e) {
    throw new Error('getSharedPoolTasks: ' + e.message);
  }
}

// ── Daily Plan ───────────────────────────────────────────────

function getDailyPlan(userId, date) {
  try {
    var planDate = date || todayStr();
    var allTasks = getTasks({ userId: userId });
    var today = todayStr();
    return allTasks.filter(function(t) {
      if (t.status === 'deleted' || t.status === 'archived') return false;
      return !t.dueDate || t.dueDate <= planDate;
    });
  } catch(e) {
    throw new Error('getDailyPlan: ' + e.message);
  }
}

// Alias for manifest
function getDailyPlanForScreen() {
  return getDailyPlan(Session.getActiveUser().getEmail(), todayStr());
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
    return _createTask({
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

// Internal timer starter — takes a resolved userId directly.
// Used by claimTask (which already has uid from session) to avoid double-token resolution.
function _startTimerForUser(taskId, uid) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var tl = getSheet('time_log');
    var tlData = tl.getDataRange().getValues();
    var nowStr = now();

    // MULTI-TIMER MODE: do NOT auto-close other timers.
    // Only refuse if THIS task already has an open timer for THIS user.
    for (var i = 1; i < tlData.length; i++) {
      if (tlData[i][1] === taskId && tlData[i][2] === uid && !tlData[i][4]) {
        return { logId: tlData[i][0], startedAt: tlData[i][3] ? tlData[i][3].toString() : nowStr, taskId: taskId, alreadyRunning: true };
      }
    }

    // Shared-task claim check (direct row scan)
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
    try { _updateTaskFields(taskId, { status: 'in-progress' }); } catch(e) {}
    try { logActivity(taskId, uid, 'timer_started', ''); } catch(e) {}

    return { logId: logId, startedAt: nowStr, taskId: taskId };
  } catch(e) {
    throw new Error('_startTimerForUser: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

// Client-facing startTimer: token in place of userId.
function startTimer(taskId, token) {
  var sess = requireSession(token);
  return _startTimerForUser(taskId, sess.userId);
}

// Return ALL open timers for the user — supports multi-timer rendering
function getActiveTimers(userId) {
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
        task = _updateTaskFields(taskId, { status: 'done', claimedBy: '', claimedAt: '' }); // FIX A — internal call
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

function getActiveTimer(userId) {
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
        var t = getTask(taskId);
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
      try { title = getTask(taskId).title; } catch(e) {}

      createNotification(userId, 'timer_warning', taskId,
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
      createNotification(createdBy, 'assigned', taskId,
        (claimer2 ? claimer2.name : uid) + ' claimed: ' + data[i][1]);

      lock.releaseLock();

      // Start timer — use internal worker (uid already resolved from session)
      var timerResult = _startTimerForUser(taskId, uid);
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

function getTeamStatus() {
  try {
    var users = getUsers();
    var nowDate = new Date();
    var twoMin = 2 * 60 * 1000;
    var tenMin = 10 * 60 * 1000;

    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];

    var tasks = getTasks({ teamView: true });

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

function getTeamTasks(options) {
  try {
    options = options || {};
    var tasks = getTasks({ teamView: true });

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

function filterTeamTasks(filter) {
  try {
    var all = getTasks({ teamView: true });
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

function getTeamBoard() {
  try {
    var users = getUsers();
    var tasks = getTasks({ teamView: true });

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

function getTeamTimeline(date) {
  try {
    var targetDate = date || todayStr();
    var tasks = getTasks({ teamView: true });
    var users = getUsers();
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

function getKpiData(options) {
  try {
    options = options || {};
    var tasks = getTasks({ teamView: true });

    var filtered = tasks;
    if (options.from) filtered = filtered.filter(function(t) { return !t.dueDate || t.dueDate >= options.from; });
    if (options.to) filtered = filtered.filter(function(t) { return !t.dueDate || t.dueDate <= options.to; });

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
        if (!byAssignee[uid]) byAssignee[uid] = { total: 0, done: 0, name: '' };
        byAssignee[uid].total++;
        if (t.status === 'done') byAssignee[uid].done++;
      });
      if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    });

    var users = getUsers();
    var byAssigneeArr = Object.keys(byAssignee).map(function(uid) {
      var u = users.find(function(x) { return x.id === uid; });
      return {
        userId: uid,
        name: u ? u.name : uid,
        total: byAssignee[uid].total,
        done: byAssignee[uid].done
      };
    });

    return {
      totalTasks: total,
      doneTasks: done,
      overdueTasks: overdue,
      byAssignee: byAssigneeArr,
      byPriority: byPriority,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0
    };
  } catch(e) {
    throw new Error('getKpiData: ' + e.message);
  }
}

function getKpiByFilter(period) {
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

  return getKpiData({ from: from, to: to });
}

function getTeamStats() {
  try {
    var users = getUsers();
    var tasks = getTasks({ teamView: true });
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

function getAdminStats() {
  try {
    var tasks = getTasks({ teamView: true });
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

function getWorkloadByUser() {
  try {
    var users = getUsers();
    var tasks = getTasks({ teamView: true });
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

function getHoursByClient() {
  try {
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];
    var tasks = getTasks({ teamView: true });
    var clients = getClients();

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

function getTeamProductivity() {
  try {
    var users = getUsers();
    var tasks = getTasks({ teamView: true });
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

function getTimeReport(filters) {
  try {
    filters = filters || {};
    var tl = getSheet('time_log');
    var tlData = tl ? tl.getDataRange().getValues() : [[]];
    var tasks = getTasks({ teamView: true, includeArchived: true });
    var clients = getClients();
    var users = getUsers();

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

function searchTasks(query, userId) {
  try {
    var q = (query || '').toLowerCase();
    var tasks = getTasks({ teamView: true });
    var clients = getClients();
    var cats = getCategories();

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

function getNotifications(userId) {
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

function createNotification(userId, type, taskId, message) {
  try {
    var s = getSheet('notifications');
    if (!s) return;
    s.appendRow([newId(), userId, type, taskId || '', message, false, now()]);

    // Email notification
    try {
      var user = getUserById(userId);
      if (user && user.email && user.notifyPrefs) {
        // FIX E — map notification type to stored notifyPrefs key.
        // Only timer_warning defaults to send when unmapped; all other unknown types (e.g. 'comment', 'timer') default to NO email.
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

function sendDueSoonNotifications() {
  try {
    var today = todayStr();
    var tasks = getTasks({ teamView: true });

    tasks.forEach(function(t) {
      if (t.status === 'done' || t.status === 'archived' || t.status === 'deleted') return;
      if (!t.dueDate) return;

      var msg = t.dueDate === today
        ? 'Due today: ' + t.title
        : 'OVERDUE: ' + t.title;

      if (t.dueDate <= today) {
        (t.assigneeIds || []).forEach(function(uid) {
          createNotification(uid, 'due_soon', t.id, msg);
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
      var users = getUsers();
      mentions.forEach(function(name) {
        var mentioned = users.find(function(u) { return u.name.toLowerCase() === name.toLowerCase(); });
        if (mentioned) {
          createNotification(mentioned.id, 'mention', taskId,
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
    var task = getTask(taskId);
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
    var task = getTask(taskId);
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
    var task = getTask(taskId);
    var checklist = (task.checklist || []).filter(function(i) { return i.id !== itemId; });
    return updateTask(taskId, { checklist: checklist }, token);
  } catch(e) {
    throw new Error('deleteChecklistItem: ' + e.message);
  }
}

// ============================================================
//  RECURRING TASKS
// ============================================================

function scheduleNextRecurrence(taskId) {
  try {
    var task = getTask(taskId);
    if (!task.recurrence) return;
    var rec = task.recurrence;
    var currentDue = task.dueDate ? new Date(task.dueDate) : new Date();
    var nextDue = new Date(currentDue);

    if (rec.type === 'daily') {
      nextDue.setDate(nextDue.getDate() + 1);
    } else if (rec.type === 'weekly') {
      nextDue.setDate(nextDue.getDate() + 7);
    } else if (rec.type === 'monthly') {
      nextDue.setMonth(nextDue.getMonth() + 1);
    } else {
      return; // Unknown type
    }

    var nextDueStr = Utilities.formatDate(nextDue, getTimezone(), 'yyyy-MM-dd');
    if (rec.ends && nextDueStr > rec.ends) return; // Past end date

    _createTask({
      title: task.title,
      description: task.description,
      clientId: task.clientId,
      categoryId: task.categoryId,
      priority: task.priority,
      status: 'todo',
      assigneeIds: task.assigneeIds,
      createdBy: task.createdBy,
      dueDate: nextDueStr,
      scheduledTime: task.scheduledTime,
      isShared: task.isShared,
      estimatedMinutes: task.estimatedMinutes,
      checklist: (task.checklist || []).map(function(item) {
        return { id: newId(), text: item.text, done: false };
      }),
      recurrence: task.recurrence
    });
  } catch(e) {
    // Silent — called from _updateTaskFields internally
  }
}

// ============================================================
//  WHATSAPP SHARE (client-side redirect — server just builds URL)
// ============================================================

function shareToWhatsApp(taskId) {
  try {
    var task = getTask(taskId);
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

// FIX 5 — wrap read-then-create in ScriptLock to prevent concurrent duplicate folders;
// log a warning when a stored folder ID is no longer accessible.
function _getOrCreateAttachmentFolder() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var folderId = getSettingValue('attachment_folder_id', '');
    if (folderId) {
      try { return DriveApp.getFolderById(folderId); } catch(e) {
        console.error('_getOrCreateAttachmentFolder: stored folder ' + folderId + ' is inaccessible (' + e + '); creating replacement');
      }
    }
    // Create folder
    var folder = DriveApp.createFolder('TaskFlow Attachments');
    // Persist folder id to settings
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
    var task = getTask(taskId);
    var isAdmin = sess.role === 'admin';
    var isCreator = task.createdBy === sess.userId;
    var isAssignee = (task.assigneeIds || []).indexOf(sess.userId) !== -1;
    if (!isAdmin && !isCreator && !isAssignee) {
      throw new Error('Not authorized to upload to this task');
    }

    // FIX 6 — server-side MIME→extension map (ignore client-supplied extension)
    var EXT_MAP = {'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/heic':'heic'};
    var ext = EXT_MAP[mimeType] || 'jpg';
    var fileName = 'photo_' + taskId + '_' + newId() + '.' + ext;

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);

    var folder = _getOrCreateAttachmentFolder();
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
    var task = getTask(taskId);
    var isAdmin = sess.role === 'admin';
    var isCreator = task.createdBy === sess.userId;
    var isAssignee = (task.assigneeIds || []).indexOf(sess.userId) !== -1;
    if (!isAdmin && !isCreator && !isAssignee) {
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

    var openStatuses = ['todo', 'in-progress', 'blocked'];
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
        createNotification(uid, 'escalation', taskId, msg);
      });

      // Notify all admins (avoid duplicate if admin is also assignee)
      admins.forEach(function(admin) {
        if (assigneeIds.indexOf(admin.id) === -1) {
          createNotification(admin.id, 'escalation', taskId, msg);
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
        var openStatusSet = { 'todo': true, 'in-progress': true, 'blocked': true };
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
    var sess = requireAdmin(token); // shift handover is a supervisor function
    var tasksSheet = getSheet('tasks');
    if (!tasksSheet) throw new Error('tasks sheet missing');
    var taskData = tasksSheet.getDataRange().getValues();
    var today = todayStr();
    var allUsers = getUsersStatic();

    // Build user name map once
    var userMap = {};
    allUsers.forEach(function(u) { userMap[u.id] = u.name; });

    // Build client name map once (avoid calling getClients() per task)
    var clientMap = {};
    getClients().forEach(function(c) { clientMap[c.id] = c.name; });

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
      } else if (status === 'todo' || status === 'in-progress') {
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
function getTeamMembers() { return getUsers(); }
function getTeamPresence() { return getTeamStatus(); }

// ============================================================
//  SEED DEMO DATA
//  MUST be invoked via `clasp run seedDemoData` only — never from
//  a web-app request.  The WIPE_AND_SEED guard is the primary
//  safeguard; do NOT expose this function through the web UI.
// ============================================================

function seedDemoData(confirmToken) {
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

