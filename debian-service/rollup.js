const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CP_PATH = '/DATA/AppData/crafty/servers/802a8dfd-7073-4bfe-852a-0105add883c3/plugins/CoreProtect/database.db';
// Normally stats.db. For a rebuild, run with STATS_DB=stats-new.db to write somewhere else.
const STATS_PATH = process.env.STATS_DB ? path.resolve(process.env.STATS_DB) : path.join(__dirname, 'stats.db');
const LOCK_PATH = `${STATS_PATH}.rollup.lock`;

// ONLY these worlds are counted (not case sensitive). Must match CoreProtect's world names.
const WORLDS = ['SS18', 'SS18_nether', 'SS18_the_end'];

const CHUNK = 200000;      // rows per chunk (lower this if the server lags)
const PAUSE_MS = 250;      // breather between chunks so CoreProtect can write
const MAX_CHUNKS = Number(process.env.MAX_CHUNKS) || Infinity; // for a quick trial run

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cp = new Database(CP_PATH, { readonly: true, fileMustExist: true, timeout: 30000 });
  cp.pragma('query_only = ON');

  const stats = new Database(STATS_PATH);
  stats.pragma('journal_mode = WAL');
  stats.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER);
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS materials (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS block_stats (
      day TEXT NOT NULL, user_id INTEGER NOT NULL, material_id INTEGER NOT NULL,
      action INTEGER NOT NULL, count INTEGER NOT NULL,
      PRIMARY KEY (user_id, material_id, action, day)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS mob_kill_stats (
      day TEXT PRIMARY KEY, kills INTEGER NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS mob_kill_type_stats (
      mob TEXT PRIMARY KEY, kills INTEGER NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS idx_bs_material ON block_stats(material_id, action);
    CREATE INDEX IF NOT EXISTS idx_bs_day ON block_stats(day);
  `);

  // ---- Work out which world ids to count ----
  const allWorlds = cp.prepare('SELECT id, world FROM co_world').all();
  const lowerWanted = WORLDS.map((w) => w.toLowerCase());
  const missing = WORLDS.filter(
    (w) => !allWorlds.some((a) => String(a.world).toLowerCase() === w.toLowerCase())
  );
  if (missing.length) {
    throw new Error(
      `Could not find world(s): ${missing.join(', ')}. Worlds that exist in CoreProtect: ` +
      `${allWorlds.map((a) => a.world).join(', ')}. Edit WORLDS at the top of rollup.js.`
    );
  }
  const worldIds = allWorlds
    .filter((a) => lowerWanted.includes(String(a.world).toLowerCase()))
    .map((a) => Number(a.id))
    .sort((a, b) => a - b);
  console.log(
    'Counting worlds: ' +
      allWorlds.filter((a) => worldIds.includes(Number(a.id))).map((a) => `${a.world} (id ${a.id})`).join(', ')
  );
  const ignored = allWorlds.filter((a) => !worldIds.includes(Number(a.id))).map((a) => a.world);
  if (ignored.length) console.log('Ignoring worlds: ' + ignored.join(', '));

  // ---- Safety check: never mix data built with different settings ----
  const filterSig = `worlds=${worldIds.join(',')};tnt=1;creeper=1`;
  const cfg = stats.prepare("SELECT value FROM config WHERE key = 'filter'").get();
  const hasProgress = stats.prepare("SELECT 1 FROM meta WHERE key = 'last_rowid'").get();
  const hasMobProgress = stats.prepare(
    "SELECT COUNT(*) AS count FROM meta WHERE key IN ('mob_last_rowid', 'mob_type_last_rowid')"
  ).get().count === 2;
  const mobHistoryIncomplete = Boolean(
    stats.prepare("SELECT 1 FROM meta WHERE key = 'mob_history_incomplete'").get()
  );
  let backfillCreepers = false;
  let skipLegacyMobBackfill = false;
  if (cfg && cfg.value !== filterSig) {
    const previousFilterSig = `worlds=${worldIds.join(',')};tnt=1`;
    if (cfg.value === previousFilterSig) {
      backfillCreepers = true;
      skipLegacyMobBackfill = !hasMobProgress;
      console.log('Adding creeper activity without rebuilding existing lifetime block statistics...');
      if (skipLegacyMobBackfill) {
        console.log('Legacy stats database has no lifetime mob progress; skipping its full-history mob scan.');
      }
    } else {
      throw new Error('This stats database was built with different world settings. Rebuild it from scratch.');
    }
  }
  if (!cfg && hasProgress) {
    throw new Error(
      'This stats database was built before the world filter existed. ' +
      'Rebuild it with: STATS_DB=stats-new.db node rollup.js'
    );
  }
  if (!cfg) stats.prepare("INSERT INTO config(key, value) VALUES ('filter', ?)").run(filterSig);
  const mobFilterSig = `worlds=${worldIds.join(',')};player-killers=1;exclude-player-victims=1`;
  const mobCfg = stats.prepare("SELECT value FROM config WHERE key = 'mob_kill_filter'").get();
  if (mobCfg && mobCfg.value !== mobFilterSig) {
    throw new Error('Mob kill statistics were built with different settings. Rebuild the stats database before changing mob filters.');
  }
  if (!mobCfg) {
    stats.prepare("INSERT INTO config(key, value) VALUES ('mob_kill_filter', ?)").run(mobFilterSig);
  }

  // ---- Lookup tables. Real players count as themselves; TNT and creeper sources
  // are merged into dedicated entries. Other "#" sources are skipped.
  const userMap = new Map(); // CoreProtect user id -> id stored in stats.db
  const playerUserIds = [];
  const creeperUserIds = [];
  const upUser = stats.prepare('INSERT OR REPLACE INTO users(id, name) VALUES (?, ?)');
  const upMat = stats.prepare('INSERT OR REPLACE INTO materials(id, name) VALUES (?, ?)');
  stats.transaction(() => {
    const tnt = [];
    for (const u of cp.prepare('SELECT rowid AS id, user FROM co_user').all()) {
      if (!u.user) continue;
      if (u.user.toLowerCase().startsWith('#tnt')) { tnt.push(u.id); continue; }
      if (u.user.toLowerCase().startsWith('#creeper')) {
        creeperUserIds.push(Number(u.id));
        continue;
      }
      if (u.user.startsWith('#')) continue;
      playerUserIds.push(Number(u.id));
      userMap.set(u.id, u.id);
      upUser.run(u.id, u.user);
    }
    if (tnt.length) {
      const main = Math.min(...tnt); // lowest id is stable over time
      for (const id of tnt) userMap.set(id, main);
      upUser.run(main, 'TNT');
    }
    if (creeperUserIds.length) {
      const main = Math.min(...creeperUserIds);
      for (const id of creeperUserIds) userMap.set(id, main);
      upUser.run(main, 'Creeper');
    }
    for (const m of cp.prepare('SELECT id, material FROM co_material_map').all()) {
      upMat.run(m.id, m.material.replace(/^minecraft:/, ''));
    }
  })();

  console.log('Finding table bounds...');
  const firstRow = cp.prepare('SELECT rowid AS r FROM co_block ORDER BY rowid ASC LIMIT 1').get();
  const lastRow = cp.prepare('SELECT rowid AS r FROM co_block ORDER BY rowid DESC LIMIT 1').get();
  if (!firstRow) {
    stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kills_ready', 1)").run();
    stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kill_types_ready', 1)").run();
    console.log('co_block is empty');
    cp.close();
    stats.close();
    return;
  }
  const bounds = { lo: firstRow.r, hi: lastRow.r };
  console.log(`Rowids run from ${bounds.lo.toLocaleString()} to ${bounds.hi.toLocaleString()}`);

  stats.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('last_rowid', ?)").run(bounds.lo - 1);
  const initialMobRowid = skipLegacyMobBackfill ? bounds.hi : bounds.lo - 1;
  stats.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('mob_last_rowid', ?)").run(initialMobRowid);
  stats.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('mob_type_last_rowid', ?)").run(initialMobRowid);
  stats.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('mob_kills_ready', 0)").run();
  stats.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('mob_kill_types_ready', 0)").run();
  if (skipLegacyMobBackfill) {
    stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_history_incomplete', 1)").run();
  }
  const getBlockLast = stats.prepare("SELECT value FROM meta WHERE key = 'last_rowid'");
  const setBlockLast = stats.prepare("UPDATE meta SET value = ? WHERE key = 'last_rowid'");
  const getMobLast = stats.prepare("SELECT value FROM meta WHERE key = 'mob_last_rowid'");
  const setMobLast = stats.prepare("UPDATE meta SET value = ? WHERE key = 'mob_last_rowid'");
  const getMobTypeLast = stats.prepare("SELECT value FROM meta WHERE key = 'mob_type_last_rowid'");
  const setMobTypeLast = stats.prepare("UPDATE meta SET value = ? WHERE key = 'mob_type_last_rowid'");
  const upsert = stats.prepare(`
    INSERT INTO block_stats(day, user_id, material_id, action, count) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, material_id, action, day) DO UPDATE SET count = count + excluded.count
  `);
  const upsertMobKills = stats.prepare(`
    INSERT INTO mob_kill_stats(day, kills) VALUES (?, ?)
    ON CONFLICT(day) DO UPDATE SET kills = kills + excluded.kills
  `);
  const upsertMobTypeKills = stats.prepare(`
    INSERT INTO mob_kill_type_stats(mob, kills) VALUES (?, ?)
    ON CONFLICT(mob) DO UPDATE SET kills = kills + excluded.kills
  `);

  if (backfillCreepers) {
    const finishBackfill = stats.transaction((rows) => {
      for (const row of rows) {
        const userId = userMap.get(row.user);
        if (userId !== undefined) upsert.run(row.day, userId, row.type, row.action, row.c);
      }
      stats.prepare("UPDATE config SET value = ? WHERE key = 'filter'").run(filterSig);
    });

    if (creeperUserIds.length) {
      const creeperQuery = `
        SELECT date(time, 'unixepoch') AS day, user, type, action, COUNT(*) AS c
        FROM co_block
        WHERE user IN (${creeperUserIds.join(',')})
          AND action IN (0, 1)
          AND wid IN (${worldIds.join(',')})
        GROUP BY day, user, type, action
      `;
      const plan = cp.prepare(`EXPLAIN QUERY PLAN ${creeperQuery}`).all();
      console.log(`Creeper backfill query plan: ${JSON.stringify(plan)}`);
      const started = Date.now();
      const rows = cp.prepare(creeperQuery).all();
      console.log(`Creeper backfill query completed in ${((Date.now() - started) / 1000).toFixed(1)}s (${rows.length} groups).`);
      finishBackfill(rows);
    } else {
      console.log('No CoreProtect creeper actors found; skipping historical backfill.');
      finishBackfill([]);
    }
  }

  // action 0 = broken, 1 = placed. wid = world id (only the worlds chosen above)
  const chunkQuerySql = `
    SELECT date(time, 'unixepoch') AS day, user, type, action, COUNT(*) AS c
    FROM co_block NOT INDEXED
    WHERE rowid > ? AND rowid <= ? AND action IN (0, 1) AND wid IN (${worldIds.join(',')})
    GROUP BY day, user, type, action
  `;
  const chunkQuery = cp.prepare(chunkQuerySql);
  const chunkPlan = cp.prepare(`EXPLAIN QUERY PLAN ${chunkQuerySql}`).all(bounds.lo, bounds.hi);
  console.log(`Block rollup query plan: ${JSON.stringify(chunkPlan)}`);
  const entityNames = new Map();
  for (const entity of cp.prepare('SELECT id, entity FROM co_entity_map').all()) {
    const name = String(entity.entity).toLowerCase().replace(/^minecraft:/, '');
    if (name && name !== 'player') {
      entityNames.set(Number(entity.id), name);
    }
  }
  const entityIdFilter = [...entityNames.keys()].length ? [...entityNames.keys()].join(',') : '0';
  const mobKillChunkQuery = cp.prepare(`
    SELECT date(time, 'unixepoch') AS day, COUNT(*) AS c
    FROM co_block NOT INDEXED
    WHERE rowid > ? AND rowid <= ?
      AND action = 3
      AND wid IN (${worldIds.join(',')})
      AND user IN (${playerUserIds.length ? playerUserIds.join(',') : '0'})
      AND type IN (${entityIdFilter})
    GROUP BY day
  `);

  const mobTypeChunkQuery = cp.prepare(`
    SELECT type, COUNT(*) AS c
    FROM co_block NOT INDEXED
    WHERE rowid > ? AND rowid <= ?
      AND action = 3
      AND wid IN (${worldIds.join(',')})
      AND user IN (${playerUserIds.length ? playerUserIds.join(',') : '0'})
      AND type IN (${entityIdFilter})
    GROUP BY type
  `);

  const apply = stats.transaction((blockRows, mobRows, mobTypeRows, blockFrom, mobFrom, mobTypeFrom, to) => {
    if (
      (blockFrom !== null && getBlockLast.get().value !== blockFrom) ||
      (mobFrom !== null && getMobLast.get().value !== mobFrom) ||
      (mobTypeFrom !== null && getMobTypeLast.get().value !== mobTypeFrom)
    ) {
      return false;
    }
    for (const r of blockRows) {
      const uid = userMap.get(r.user);
      if (uid !== undefined) upsert.run(r.day, uid, r.type, r.action, r.c);
    }
    for (const r of mobRows) upsertMobKills.run(r.day, r.c);
    for (const r of mobTypeRows) {
      const mob = entityNames.get(Number(r.type));
      if (mob) upsertMobTypeKills.run(mob, r.c);
    }
    if (blockFrom !== null) setBlockLast.run(to);
    if (mobFrom !== null) setMobLast.run(to);
    if (mobTypeFrom !== null) setMobTypeLast.run(to);
    return true;
  });

  const target = bounds.hi;
  let blockLast = getBlockLast.get().value;
  let mobLast = getMobLast.get().value;
  let mobTypeLast = getMobTypeLast.get().value;
  const t0 = Date.now();
  let chunks = 0;

  while (
    (blockLast < target || (!mobHistoryIncomplete && (mobLast < target || mobTypeLast < target))) &&
    chunks < MAX_CHUNKS
  ) {
    const from = Math.min(
      blockLast < target ? blockLast : target,
      !mobHistoryIncomplete && mobLast < target ? mobLast : target,
      !mobHistoryIncomplete && mobTypeLast < target ? mobTypeLast : target
    );
    const to = Math.min(from + CHUNK, target);
    const blockFrom = blockLast < to ? blockLast : null;
    const mobFrom = !mobHistoryIncomplete && mobLast < to ? mobLast : null;
    const mobTypeFrom = !mobHistoryIncomplete && mobTypeLast < to ? mobTypeLast : null;
    let blockRows = [];
    if (blockFrom !== null) {
      const queryStarted = Date.now();
      blockRows = chunkQuery.all(blockFrom, to);
      console.log(
        `Block batch query completed in ${((Date.now() - queryStarted) / 1000).toFixed(1)}s ` +
        `(${blockRows.length} groups; rowids ${blockFrom + 1}-${to}).`
      );
    }
    let mobRows = [];
    let mobTypeRows = [];
    if (mobFrom !== null) {
      const started = Date.now();
      console.log(`Scanning mob kills in rowids ${mobFrom + 1}-${to} (${(((to - mobFrom) / Math.max(target - bounds.lo, 1)) * 100).toFixed(3)}% of CoreProtect history)...`);
      mobRows = mobKillChunkQuery.all(mobFrom, to);
      console.log(`Mob-kill batch query completed in ${((Date.now() - started) / 1000).toFixed(1)}s (${mobRows.length} daily groups).`);
    }
    if (mobTypeFrom !== null) {
      const started = Date.now();
      console.log(`Scanning lifetime mob types in rowids ${mobTypeFrom + 1}-${to}...`);
      mobTypeRows = mobTypeChunkQuery.all(mobTypeFrom, to);
      console.log(`Lifetime mob-type batch completed in ${((Date.now() - started) / 1000).toFixed(1)}s (${mobTypeRows.length} mob types).`);
    }
    const applied = apply.immediate(blockRows, mobRows, mobTypeRows, blockFrom, mobFrom, mobTypeFrom, to);
    if (!applied) {
      blockLast = getBlockLast.get().value;
      mobLast = getMobLast.get().value;
      mobTypeLast = getMobTypeLast.get().value;
      console.log(`Another rollup advanced progress; resuming from rowid ${Math.min(blockLast, mobLast, mobTypeLast).toLocaleString()}.`);
      continue;
    }
    if (blockFrom !== null) blockLast = to;
    if (mobFrom !== null) mobLast = to;
    if (mobTypeFrom !== null) mobTypeLast = to;
    chunks++;
    const lowestProgress = mobHistoryIncomplete
      ? blockLast
      : Math.min(blockLast, mobLast, mobTypeLast);
    const pct = (((lowestProgress - bounds.lo) / Math.max(target - bounds.lo, 1)) * 100).toFixed(1);
    console.log(`rowid ${lowestProgress.toLocaleString()} / ${target.toLocaleString()} (${pct}%) - ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
    await sleep(PAUSE_MS);
  }

  if (mobLast >= target && !mobHistoryIncomplete && !skipLegacyMobBackfill) {
    stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kills_ready', 1)").run();
  }
  if (mobTypeLast >= target && !mobHistoryIncomplete && !skipLegacyMobBackfill) {
    stats.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('mob_kill_types_ready', 1)").run();
  }
  const caughtUp = blockLast >= target &&
    (mobHistoryIncomplete || (mobLast >= target && mobTypeLast >= target));
  console.log(
    caughtUp
      ? mobHistoryIncomplete
        ? 'Block rollup caught up; lifetime mob backfill is incomplete.'
        : 'Caught up.'
      : 'Stopped early (MAX_CHUNKS).'
  );
  cp.close();
  stats.close();
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
          return null;
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
  return null;
}

async function run() {
  const lockFd = acquireLock();
  if (lockFd === null) {
    console.log('Another lifetime rollup is already running; skipping this run.');
    return;
  }

  try {
    await main();
  } finally {
    fs.closeSync(lockFd);
    fs.unlinkSync(LOCK_PATH);
  }
}

run().catch((e) => { console.error('Error:', e.message); process.exit(1); });
