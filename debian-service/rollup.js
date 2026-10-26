const Database = require('better-sqlite3');
const path = require('path');

const CP_PATH = '/DATA/AppData/crafty/servers/802a8dfd-7073-4bfe-852a-0105add883c3/plugins/CoreProtect/database.db';
// Normally stats.db. For a rebuild, run with STATS_DB=stats-new.db to write somewhere else.
const STATS_PATH = process.env.STATS_DB ? path.resolve(process.env.STATS_DB) : path.join(__dirname, 'stats.db');

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
  const filterSig = `worlds=${worldIds.join(',')};tnt=1`;
  const cfg = stats.prepare("SELECT value FROM config WHERE key = 'filter'").get();
  const hasProgress = stats.prepare("SELECT 1 FROM meta WHERE key = 'last_rowid'").get();
  if (cfg && cfg.value !== filterSig) {
    throw new Error('This stats database was built with different world settings. Rebuild it from scratch.');
  }
  if (!cfg && hasProgress) {
    throw new Error(
      'This stats database was built before the world filter existed. ' +
      'Rebuild it with: STATS_DB=stats-new.db node rollup.js'
    );
  }
  if (!cfg) stats.prepare("INSERT INTO config(key, value) VALUES ('filter', ?)").run(filterSig);

  // ---- Lookup tables. Real players count as themselves; every "#tnt..." source is merged into one "TNT" entry.
  // Other "#" sources (fire, creepers, leaf decay...) are skipped.
  const userMap = new Map(); // CoreProtect user id -> id stored in stats.db
  const upUser = stats.prepare('INSERT OR REPLACE INTO users(id, name) VALUES (?, ?)');
  const upMat = stats.prepare('INSERT OR REPLACE INTO materials(id, name) VALUES (?, ?)');
  stats.transaction(() => {
    const tnt = [];
    for (const u of cp.prepare('SELECT rowid AS id, user FROM co_user').all()) {
      if (!u.user) continue;
      if (u.user.toLowerCase().startsWith('#tnt')) { tnt.push(u.id); continue; }
      if (u.user.startsWith('#')) continue;
      userMap.set(u.id, u.id);
      upUser.run(u.id, u.user);
    }
    if (tnt.length) {
      const main = Math.min(...tnt); // lowest id is stable over time
      for (const id of tnt) userMap.set(id, main);
      upUser.run(main, 'TNT');
    }
    for (const m of cp.prepare('SELECT id, material FROM co_material_map').all()) {
      upMat.run(m.id, m.material.replace(/^minecraft:/, ''));
    }
  })();

  console.log('Finding table bounds...');
  const firstRow = cp.prepare('SELECT rowid AS r FROM co_block ORDER BY rowid ASC LIMIT 1').get();
  const lastRow = cp.prepare('SELECT rowid AS r FROM co_block ORDER BY rowid DESC LIMIT 1').get();
  if (!firstRow) { console.log('co_block is empty'); return; }
  const bounds = { lo: firstRow.r, hi: lastRow.r };
  console.log(`Rowids run from ${bounds.lo.toLocaleString()} to ${bounds.hi.toLocaleString()}`);

  stats.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('last_rowid', ?)").run(bounds.lo - 1);
  const getLast = stats.prepare("SELECT value FROM meta WHERE key = 'last_rowid'");
  const setLast = stats.prepare("UPDATE meta SET value = ? WHERE key = 'last_rowid'");
  const upsert = stats.prepare(`
    INSERT INTO block_stats(day, user_id, material_id, action, count) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, material_id, action, day) DO UPDATE SET count = count + excluded.count
  `);

  // action 0 = broken, 1 = placed. wid = world id (only the worlds chosen above)
  const chunkQuery = cp.prepare(`
    SELECT date(time, 'unixepoch') AS day, user, type, action, COUNT(*) AS c
    FROM co_block
    WHERE rowid > ? AND rowid <= ? AND action IN (0, 1) AND wid IN (${worldIds.join(',')})
    GROUP BY day, user, type, action
  `);

  const apply = stats.transaction((rows, from, to) => {
    if (getLast.get().value !== from) throw new Error('Progress changed underneath us (another run?)');
    for (const r of rows) {
      const uid = userMap.get(r.user);
      if (uid !== undefined) upsert.run(r.day, uid, r.type, r.action, r.c);
    }
    setLast.run(to);
  });

  const target = bounds.hi;
  let last = getLast.get().value;
  const t0 = Date.now();
  let chunks = 0;

  while (last < target && chunks < MAX_CHUNKS) {
    const to = Math.min(last + CHUNK, target);
    const rows = chunkQuery.all(last, to);
    apply.immediate(rows, last, to);
    last = to;
    chunks++;
    const pct = (((last - bounds.lo) / (target - bounds.lo)) * 100).toFixed(1);
    console.log(`rowid ${last.toLocaleString()} / ${target.toLocaleString()} (${pct}%) - ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
    await sleep(PAUSE_MS);
  }

  console.log(last >= target ? 'Caught up.' : 'Stopped early (MAX_CHUNKS).');
  cp.close();
  stats.close();
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
