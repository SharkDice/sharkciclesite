const fs = require('fs');
const nbt = require('prismarine-nbt');
const path = require('path');

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const RETENTION_SECONDS = WEEK_SECONDS + 24 * 60 * 60;

function parseNbt(buffer) {
  return new Promise((resolve, reject) => {
    nbt.parse(buffer, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(nbt.simplify(data));
      }
    });
  });
}

async function readPlaytimeScores(worldPath, objective) {
  const scoreboardPaths = [
    path.join(worldPath, 'data', 'minecraft', 'scoreboard.dat'),
    path.join(worldPath, 'data', 'scoreboard.dat'),
  ];
  const scoreboardPath = scoreboardPaths.find((candidate) => fs.existsSync(candidate));
  if (!scoreboardPath) {
    throw new Error(`Scoreboard file not found. Checked: ${scoreboardPaths.join(', ')}`);
  }

  const parsed = await parseNbt(fs.readFileSync(scoreboardPath));
  const data = parsed.Data || parsed.data || parsed;
  const scores = data.PlayerScores;
  if (!Array.isArray(scores)) {
    throw new Error(`No player scores were found in ${scoreboardPath}`);
  }

  const normalizeObjective = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const requestedObjective = normalizeObjective(objective);
  const objectiveDefinition = (data.Objectives || []).find((entry) => {
    if (typeof entry.Name === 'string' && normalizeObjective(entry.Name) === requestedObjective) return true;

    const displayName = typeof entry.DisplayName === 'string'
      ? entry.DisplayName
      : JSON.stringify(entry.DisplayName || '');
    return normalizeObjective(displayName).includes(requestedObjective);
  });
  const objectiveName = objectiveDefinition?.Name || objective;
  const players = new Map();
  for (const entry of scores) {
    if (
      entry.Objective !== objectiveName ||
      typeof entry.Name !== 'string' ||
      entry.Name.startsWith('#') ||
      !Number.isSafeInteger(entry.Score) ||
      entry.Score < 0
    ) {
      continue;
    }

    players.set(entry.Name, entry.Score);
  }

  if (players.size === 0) {
    const availableObjectives = (data.Objectives || [])
      .map((entry) => entry.Name)
      .filter((name) => typeof name === 'string');
    throw new Error(
      `No scores found for scoreboard objective "${objective}". ` +
      `Available objective IDs: ${availableObjectives.join(', ') || 'none'}`
    );
  }

  return players;
}

function createPlaytimeTracker({ worldPath, objective, scoreUnit, databasePath }) {
  if (!['ticks', 'minutes'].includes(scoreUnit)) {
    throw new Error('PLAYTIME_SCORE_UNIT must be either "ticks" or "minutes"');
  }

  const Database = require('better-sqlite3');
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS playtime_snapshots (
      sampled_at INTEGER NOT NULL,
      player TEXT NOT NULL,
      score INTEGER NOT NULL,
      PRIMARY KEY (sampled_at, player)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS idx_playtime_snapshots_player_time
      ON playtime_snapshots(player, sampled_at);
    CREATE TABLE IF NOT EXISTS playtime_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value TEXT NOT NULL
    );
  `);

  const configValue = JSON.stringify({
    worldPath: path.resolve(worldPath),
    objective,
    scoreUnit,
  });
  const storedConfig = db.prepare('SELECT value FROM playtime_config WHERE id = 1').get();
  if (storedConfig && storedConfig.value !== configValue) {
    db.exec('DELETE FROM playtime_snapshots');
    console.warn('Playtime tracking configuration changed; rebuilding the 7-day history.');
  }
  db.prepare(`
    INSERT INTO playtime_config(id, value) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET value = excluded.value
  `).run(configValue);

  const insertSnapshot = db.prepare(`
    INSERT INTO playtime_snapshots(sampled_at, player, score)
    VALUES (?, ?, ?)
    ON CONFLICT(sampled_at, player) DO UPDATE SET score = excluded.score
  `);
  const getBaseline = db.prepare(`
    SELECT score
    FROM playtime_snapshots
    WHERE player = ? AND sampled_at <= ?
    ORDER BY sampled_at DESC
    LIMIT 1
  `);
  const getFirstSnapshot = db.prepare(`
    SELECT score
    FROM playtime_snapshots
    WHERE player = ?
    ORDER BY sampled_at ASC
    LIMIT 1
  `);
  const getOldestSnapshot = db.prepare('SELECT MIN(sampled_at) AS sampled_at FROM playtime_snapshots');
  const trimSnapshots = db.prepare('DELETE FROM playtime_snapshots WHERE sampled_at < ?');

  return {
    async update(now = Math.floor(Date.now() / 1000)) {
      const currentPlayers = await readPlaytimeScores(worldPath, objective);
      const cutoff = now - WEEK_SECONDS;

      db.transaction(() => {
        for (const [player, score] of currentPlayers) {
          insertSnapshot.run(now, player, score);
        }
        trimSnapshots.run(now - RETENTION_SECONDS);
      })();

      const weekly = [];
      for (const [player, score] of currentPlayers) {
        const baseline = getBaseline.get(player, cutoff) || getFirstSnapshot.get(player);
        if (!baseline) continue;

        const scoreDelta = score >= baseline.score ? score - baseline.score : score;
        const playedMinutes = scoreUnit === 'ticks' ? Math.floor(scoreDelta / 1200) : scoreDelta;
        if (playedMinutes > 0) weekly.push({ name: player, minutes: playedMinutes });
      }

      const lifetime = [...currentPlayers]
        .filter(([, score]) => score > 0)
        .map(([name, score]) => ({
          name,
          minutes: scoreUnit === 'ticks' ? Math.floor(score / 1200) : score,
        }))
        .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
        .slice(0, 50);

      weekly.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

      return {
        success: true,
        timestamp: new Date(now * 1000).toISOString(),
        historyReady: (getOldestSnapshot.get().sampled_at ?? now) <= cutoff,
        weekly: weekly.slice(0, 10),
        lifetime,
      };
    },
    close() {
      db.close();
    },
  };
}

module.exports = { createPlaytimeTracker, readPlaytimeScores };
