const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CP_PATH = '/DATA/AppData/crafty/servers/802a8dfd-7073-4bfe-852a-0105add883c3/plugins/CoreProtect/database.db';
const STATS_PATH = process.env.STATS_DB ? path.resolve(process.env.STATS_DB) : path.join(__dirname, 'stats.db');
const LOCK_PATH = `${STATS_PATH}.rollup.lock`;
const WORLDS = ['SS18', 'SS18_nether', 'SS18_the_end'];
const CHUNK = 200000;
const PAUSE_MS = 250;
const MAX_CHUNKS = Number(process.env.MAX_CHUNKS) || Infinity;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cp = new Database(CP_PATH, { readonly: true, fileMustExist: true, timeout: 30000 });
  cp.pragma('query_only = ON');
  const stats = new Database(STATS_PATH, { timeout: 30000 });
  stats.pragma('journal_mode = WAL');

  try {
    stats.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER);
      CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS mob_kill_stats (
        day TEXT PRIMARY KEY, kills INTEGER NOT NULL
      ) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS mob_kill_type_stats (
        mob TEXT PRIMARY KEY, kills INTEGER NOT NULL
      ) WITHOUT ROWID;
    `);

    const allWorlds = cp.prepare('SELECT id, world FROM co_world').all();
    const lowerWanted = WORLDS.map((world) => world.toLowerCase());
    const missing = WORLDS.filter(
      (world) => !allWorlds.some((entry) => String(entry.world).toLowerCase() === world.toLowerCase())
    );
    if (missing.length) {
      throw new Error(
        `Could not find world(s): ${missing.join(', ')}. Worlds that exist in CoreProtect: ` +
        `${allWorlds.map((entry) => entry.world).join(', ')}.`
      );
    }

    const worldIds = allWorlds
      .filter((entry) => lowerWanted.includes(String(entry.world).toLowerCase()))
      .map((entry) => Number(entry.id))
      .sort((a, b) => a - b);
    const filterSig = `worlds=${worldIds.join(',')};tnt=1;creeper=1`;
    const mobFilterSig = `worlds=${worldIds.join(',')};player-killers=1;exclude-player-victims=1`;
    const statsFilter = stats.prepare("SELECT value FROM config WHERE key = 'filter'").get();
    const statsMobFilter = stats.prepare("SELECT value FROM config WHERE key = 'mob_kill_filter'").get();
    if (!statsFilter || statsFilter.value !== filterSig) {
      throw new Error(`stats.db filter does not match the current rollup (${statsFilter?.value ?? 'missing'}).`);
    }
    if (!statsMobFilter || statsMobFilter.value !== mobFilterSig) {
      throw new Error(`stats.db mob filter does not match this backfill (${statsMobFilter?.value ?? 'missing'}).`);
    }

    const firstRow = cp.prepare('SELECT rowid AS r FROM co_block ORDER BY rowid ASC LIMIT 1').get();
    const lastRow = cp.prepare('SELECT rowid AS r FROM co_block ORDER BY rowid DESC LIMIT 1').get();
    if (!firstRow || !lastRow) {
      console.log('CoreProtect co_block is empty; no mob kills to backfill.');
      return;
    }
    const lo = Number(firstRow.r);
    const target = Number(lastRow.r);

    const playerUserIds = cp.prepare('SELECT rowid AS id, user FROM co_user')
      .all()
      .filter((user) => user.user && !user.user.startsWith('#'))
      .map((user) => Number(user.id));
    const entityNames = new Map(
      cp.prepare('SELECT id, entity FROM co_entity_map')
        .all()
        .map((entity) => [
          Number(entity.id),
          String(entity.entity).toLowerCase().replace(/^minecraft:/, ''),
        ])
        .filter(([, name]) => name && name !== 'player')
    );
    const entityIds = [...entityNames.keys()];

    const from = lo - 1;
    const to = target;
    const query = `
      SELECT date(time, 'unixepoch') AS day, type, COUNT(*) AS kills
      FROM co_block NOT INDEXED
      WHERE rowid > ? AND rowid <= ?
        AND action = 3
        AND wid IN (${worldIds.join(',')})
        AND user IN (${playerUserIds.length ? playerUserIds.join(',') : '0'})
        AND type IN (${entityIds.length ? entityIds.join(',') : '0'})
      GROUP BY day, type
    `;
    const queryPlan = cp.prepare(`EXPLAIN QUERY PLAN ${query}`).all(from, to);
    console.log(`Counting worlds: ${worldIds.join(', ')}`);
    console.log(`Mob backfill query plan: ${JSON.stringify(queryPlan)}`);
    console.log(`Mob backfill rowids ${lo.toLocaleString()}-${target.toLocaleString()}.`);

    const cursorKey = 'mob_backfill_last_rowid';
    const configKey = 'mob_backfill_filter';
    const savedFilter = stats.prepare('SELECT value FROM config WHERE key = ?').get(configKey);
    const savedCursor = stats.prepare('SELECT value FROM meta WHERE key = ?').get(cursorKey);
    if (savedFilter && savedFilter.value !== mobFilterSig) {
      throw new Error('An existing mob backfill uses different filters; refusing to mix results.');
    }

    let cursor = savedCursor ? Number(savedCursor.value) : null;
    if (cursor === null) {
      const initialize = stats.transaction(() => {
        stats.prepare('DELETE FROM mob_kill_stats').run();
        stats.prepare('DELETE FROM mob_kill_type_stats').run();
        stats.prepare('INSERT OR REPLACE INTO config(key, value) VALUES (?, ?)').run(configKey, mobFilterSig);
        stats.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run(cursorKey, lo - 1);
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kills_ready', 0)").run();
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kill_types_ready', 0)").run();
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_history_incomplete', 1)").run();
      });
      initialize.immediate();
      cursor = lo - 1;
      console.log('Started mob-only backfill; only mob statistic tables are being rebuilt.');
    } else {
      console.log(`Resuming mob-only backfill from rowid ${cursor.toLocaleString()}.`);
    }

    if (cursor < lo - 1 || cursor > target) {
      throw new Error(`Saved mob backfill cursor ${cursor} is outside current CoreProtect bounds.`);
    }

    const groupQuery = cp.prepare(query);
    const upsertDay = stats.prepare(`
      INSERT INTO mob_kill_stats(day, kills) VALUES (?, ?)
      ON CONFLICT(day) DO UPDATE SET kills = kills + excluded.kills
    `);
    const upsertType = stats.prepare(`
      INSERT INTO mob_kill_type_stats(mob, kills) VALUES (?, ?)
      ON CONFLICT(mob) DO UPDATE SET kills = kills + excluded.kills
    `);
    const getCursor = stats.prepare('SELECT value FROM meta WHERE key = ?');
    const setCursor = stats.prepare('UPDATE meta SET value = ? WHERE key = ?');
    const applyChunk = stats.transaction((rows, expectedCursor, nextCursor) => {
      if (Number(getCursor.get(cursorKey).value) !== expectedCursor) {
        return false;
      }
      const dailyTotals = new Map();
      const typeTotals = new Map();
      for (const row of rows) {
        const mob = entityNames.get(Number(row.type));
        if (!mob) continue;
        dailyTotals.set(row.day, (dailyTotals.get(row.day) || 0) + Number(row.kills));
        typeTotals.set(mob, (typeTotals.get(mob) || 0) + Number(row.kills));
      }
      for (const [day, kills] of dailyTotals) upsertDay.run(day, kills);
      for (const [mob, kills] of typeTotals) upsertType.run(mob, kills);
      setCursor.run(nextCursor, cursorKey);
      return true;
    });

    const started = Date.now();
    let chunks = 0;
    while (cursor < target && chunks < MAX_CHUNKS) {
      const nextCursor = Math.min(cursor + CHUNK, target);
      const queryStarted = Date.now();
      const rows = groupQuery.all(cursor, nextCursor);
      const applied = applyChunk.immediate(rows, cursor, nextCursor);
      if (!applied) {
        cursor = Number(getCursor.get(cursorKey).value);
        console.log(`Checkpoint advanced elsewhere; resuming from rowid ${cursor.toLocaleString()}.`);
        continue;
      }
      cursor = nextCursor;
      chunks++;
      console.log(
        `Mob batch rowid ${cursor.toLocaleString()} / ${target.toLocaleString()} ` +
        `(${((cursor / target) * 100).toFixed(1)}%); ${rows.length} groups; ` +
        `query ${((Date.now() - queryStarted) / 1000).toFixed(1)}s; ` +
        `${((Date.now() - started) / 1000).toFixed(0)}s elapsed.`
      );
      await sleep(PAUSE_MS);
    }

    if (cursor >= target) {
      const finish = stats.transaction(() => {
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kills_ready', 1)").run();
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kill_types_ready', 1)").run();
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_last_rowid', ?)").run(target);
        stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_type_last_rowid', ?)").run(target);
        stats.prepare("DELETE FROM meta WHERE key = 'mob_history_incomplete'").run();
      });
      finish.immediate();
      console.log('Mob-only backfill complete. Lifetime mob statistics are ready.');
    } else {
      console.log(`Mob-only backfill paused at rowid ${cursor.toLocaleString()}; run again to resume.`);
    }
  } finally {
    cp.close();
    stats.close();
  }
}

function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx');
      fs.writeSync(fd, `${process.pid}\n`);
      return fd;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      let pid;
      try {
        pid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
      } catch (readError) {
        if (readError.code === 'ENOENT') continue;
        throw readError;
      }
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          throw new Error(`Another lifetime rollup is running under PID ${pid}; retry after it finishes.`);
        } catch (processError) {
          if (processError.code !== 'ESRCH') throw processError;
        }
      }

      try {
        fs.unlinkSync(LOCK_PATH);
      } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') throw unlinkError;
      }
    }
  }
  throw new Error(`Could not acquire the lifetime rollup lock at ${LOCK_PATH}.`);
}

async function run() {
  const lockFd = acquireLock();
  try {
    await main();
  } finally {
    fs.closeSync(lockFd);
    fs.unlinkSync(LOCK_PATH);
  }
}

run().catch((error) => {
  console.error('Mob backfill failed:', error.message);
  process.exitCode = 1;
});
