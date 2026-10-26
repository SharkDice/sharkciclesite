const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const COREPROTECT_DB_PATH = '/DATA/AppData/crafty/servers/802a8dfd-7073-4bfe-852a-0105add883c3/plugins/CoreProtect/database.db';
const SERVER_DIR = path.resolve(path.dirname(COREPROTECT_DB_PATH), '..', '..');
const LOG_PATH = path.join(SERVER_DIR, 'logs', 'latest.log');
const ACTIVITY_DB_PATH = path.join(__dirname, 'activity.db');
const POLL_INTERVAL = 5000;
const MAX_EVENTS = 5;
const MAX_LOG_BYTES_PER_POLL = 1024 * 1024;
const INITIAL_LOG_REPLAY_BYTES = 8 * 1024 * 1024;

const db = new Database(ACTIVITY_DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS log_cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    file_id TEXT NOT NULL,
    offset INTEGER NOT NULL,
    pending TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    player_name TEXT PRIMARY KEY COLLATE NOCASE,
    joined_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY,
    player_name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave')),
    occurred_at INTEGER NOT NULL,
    duration_seconds INTEGER
  );
  CREATE TABLE IF NOT EXISTS tracker_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_events_recent
    ON activity_events(occurred_at DESC);
`);

const TRACKER_VERSION = 'utc-log-time-v2';
const storedVersion = db.prepare("SELECT value FROM tracker_state WHERE key = 'version'").get();
if (storedVersion?.value !== TRACKER_VERSION) {
  db.transaction(() => {
    db.exec('DELETE FROM activity_events; DELETE FROM sessions;');
    db.prepare(`
      INSERT INTO tracker_state (key, value)
      VALUES ('version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(TRACKER_VERSION);
  })();
}

function parseLogEvent(line, now) {
  const timestampMatch = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\]/);
  if (!timestampMatch) return null;

  const loginMatch = line.match(/: ([A-Za-z0-9_.-]{1,16})\[\/[^\]]+\] logged in with entity id \d+/);
  const disconnectMatch = line.match(/: ([A-Za-z0-9_.-]{1,16}) (?:lost connection:|left the game)/);
  const match = loginMatch || disconnectMatch;
  if (!match) return null;

  const [, hours, minutes, seconds] = timestampMatch;
  const playerName = match[1];
  const eventType = loginMatch ? 'join' : 'leave';
  const timestamp = new Date(now);
  timestamp.setUTCHours(Number(hours), Number(minutes), Number(seconds), 0);

  const difference = timestamp.getTime() - now;
  if (difference > 12 * 60 * 60 * 1000) timestamp.setUTCDate(timestamp.getUTCDate() - 1);
  else if (difference < -12 * 60 * 60 * 1000) timestamp.setUTCDate(timestamp.getUTCDate() + 1);

  return {
    playerName,
    eventType,
    occurredAt: timestamp.getTime(),
  };
}

const saveEvent = db.transaction((event) => {
  if (event.eventType === 'join') {
    db.prepare(`
      INSERT INTO sessions (player_name, joined_at)
      VALUES (?, ?)
      ON CONFLICT(player_name) DO UPDATE SET joined_at = excluded.joined_at
    `).run(event.playerName, event.occurredAt);

    db.prepare(`
      INSERT INTO activity_events (player_name, event_type, occurred_at)
      VALUES (?, 'join', ?)
    `).run(event.playerName, event.occurredAt);
    return;
  }

  const session = db.prepare(
    'SELECT joined_at FROM sessions WHERE player_name = ? COLLATE NOCASE'
  ).get(event.playerName);
  const durationSeconds = session
    ? Math.max(0, Math.floor((event.occurredAt - session.joined_at) / 1000))
    : null;

  db.prepare(`
    INSERT INTO activity_events (player_name, event_type, occurred_at, duration_seconds)
    VALUES (?, 'leave', ?, ?)
  `).run(event.playerName, event.occurredAt, durationSeconds);
  db.prepare('DELETE FROM sessions WHERE player_name = ? COLLATE NOCASE').run(event.playerName);
});

let shouldBootstrapLog = true;

function pollLog() {
  const fileStats = fs.statSync(LOG_PATH);
  const fileId = `${fileStats.dev}:${fileStats.ino}`;
  let cursor = db.prepare('SELECT file_id, offset, pending FROM log_cursor WHERE id = 1').get();
  const isBootstrapPoll = shouldBootstrapLog;

  if (shouldBootstrapLog) {
    const hasActivity = db.prepare('SELECT 1 FROM activity_events LIMIT 1').get();
    if (!hasActivity) {
      const replayOffset = Math.max(0, fileStats.size - INITIAL_LOG_REPLAY_BYTES);
      const currentOffset = cursor?.file_id === fileId ? cursor.offset : replayOffset;
      cursor = {
        file_id: fileId,
        offset: Math.min(currentOffset, replayOffset),
        pending: '',
      };
      db.prepare(`
        INSERT INTO log_cursor (id, file_id, offset, pending)
        VALUES (1, ?, ?, '')
        ON CONFLICT(id) DO UPDATE SET
          file_id = excluded.file_id,
          offset = excluded.offset,
          pending = excluded.pending
      `).run(cursor.file_id, cursor.offset);
    }
    shouldBootstrapLog = false;
  }

  if (!cursor) {
    cursor = { file_id: fileId, offset: fileStats.size, pending: '' };
    db.prepare('INSERT INTO log_cursor (id, file_id, offset, pending) VALUES (1, ?, ?, ?)').run(
      cursor.file_id,
      cursor.offset,
      cursor.pending
    );
    return;
  }

  if (cursor.file_id !== fileId || cursor.offset > fileStats.size) {
    cursor = { file_id: fileId, offset: 0, pending: '' };
  }
  if (cursor.offset === fileStats.size) return;

  const maxBytes = isBootstrapPoll ? INITIAL_LOG_REPLAY_BYTES : MAX_LOG_BYTES_PER_POLL;
  const length = Math.min(fileStats.size - cursor.offset, maxBytes);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(LOG_PATH, 'r');
  let bytesRead;
  try {
    bytesRead = fs.readSync(fd, buffer, 0, length, cursor.offset);
  } finally {
    fs.closeSync(fd);
  }

  const contents = cursor.pending + buffer.subarray(0, bytesRead).toString('utf8');
  const lines = contents.split(/\r?\n/);
  const pending = lines.pop() || '';
  const now = Date.now();
  const updateCursor = db.transaction(() => {
    for (const line of lines) {
      const event = parseLogEvent(line, now);
      if (event) saveEvent(event);
    }
    db.prepare(`
      INSERT INTO log_cursor (id, file_id, offset, pending)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file_id = excluded.file_id,
        offset = excluded.offset,
        pending = excluded.pending
    `).run(fileId, cursor.offset + bytesRead, pending);
    db.prepare(`
      DELETE FROM activity_events
      WHERE id NOT IN (
        SELECT id FROM activity_events
        ORDER BY occurred_at DESC, id DESC
        LIMIT 500
      )
    `).run();
  });
  updateCursor();
}

let lastPollError = '';
function pollLogWithLogging() {
  try {
    pollLog();
    lastPollError = '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastPollError) {
      console.error(`Minecraft activity log polling error: ${message}`);
      lastPollError = message;
    }
  }
}

function getRecentActivity() {
  const now = Date.now();
  const rows = db.prepare(`
    SELECT e.player_name AS playerName,
           e.event_type AS eventType,
           e.occurred_at AS occurredAt,
           CASE
             WHEN e.event_type = 'leave' THEN e.duration_seconds
             WHEN s.joined_at IS NOT NULL THEN MAX(0, CAST((? - s.joined_at) / 1000 AS INTEGER))
             ELSE NULL
           END AS durationSeconds
    FROM activity_events e
    LEFT JOIN sessions s
      ON e.event_type = 'join'
      AND s.player_name = e.player_name COLLATE NOCASE
      AND s.joined_at = e.occurred_at
    ORDER BY e.occurred_at DESC, e.id DESC
    LIMIT ?
  `).all(now, MAX_EVENTS);

  return {
    success: true,
    events: rows.map((row) => ({
      ...row,
      occurredAt: new Date(row.occurredAt).toISOString(),
    })),
  };
}

pollLogWithLogging();
setInterval(pollLogWithLogging, POLL_INTERVAL);

module.exports = { getRecentActivity };
