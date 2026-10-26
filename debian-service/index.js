const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = '/DATA/AppData/crafty/servers/802a8dfd-7073-4bfe-852a-0105add883c3/plugins/CoreProtect/database.db';
const CACHE_FILE = path.join(__dirname, 'stats-cache.json');
const CACHE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const WORKER_TIMEOUT = 45 * 60 * 1000; // kill a stuck update after 45 minutes (huge DB = slow queries)
const PORT = 3001;
const TOP_BLOCKS = 3; // block types listed per player
const MAX_PLAYERS = 10; // players shown on the page

// ONLY these worlds are counted (not case sensitive). Must match CoreProtect's world names
// and the WORLDS list in rollup.js.
const WORLDS = ['SS18', 'SS18_nether', 'SS18_the_end'];

/* ------------------------------------------------------------------ *
 * WORKER THREAD: does all the heavy SQLite work so the web server's
 * event loop is never blocked.
 * ------------------------------------------------------------------ */
if (!isMainThread) {
  // Find the first rowid whose time > `since`, via binary search on the
  // primary key. rowids grow with time, so this is instant even on a huge
  // table, whereas "WHERE time > ?" has no usable index and scans everything.
  function firstRowidSince(db, table, since) {
    const b = db.prepare(`SELECT MIN(rowid) AS lo, MAX(rowid) AS hi FROM ${table}`).get();
    if (b.lo == null) return null; // empty table
    const probe = db.prepare(`SELECT time FROM ${table} WHERE rowid >= ? ORDER BY rowid LIMIT 1`);
    // Gallop backwards from the newest row until we hit a row older than the cutoff,
    // then binary search only inside that window. This stays correct even if very old
    // rows are out of order (e.g. imported data), which would fool a whole-table search.
    let hi = b.hi + 1;
    let step = 1000;
    let lo = hi - step;
    while (lo > b.lo && (probe.get(lo)?.time ?? Infinity) > since) {
      hi = lo;
      step *= 2;
      lo = hi - step;
    }
    lo = Math.max(lo, b.lo);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const row = probe.get(mid);
      if (!row || row.time > since) hi = mid;
      else lo = mid + 1;
    }
    console.log(`  [worker] ${table}: 7-day window starts at rowid ${lo} of ${b.hi} (~${(b.hi - lo + 1).toLocaleString()} rows to scan)`);
    return lo;
  }

  try {
    const db = new Database(workerData.dbPath, { readonly: true, fileMustExist: true, timeout: 30000 });
    db.pragma('query_only = ON');

    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const workerStart = Date.now();

    let totalChat = 0;
    let totalBlocks = 0;
    let totalBlocksPlaced = 0;
    const players = [];
    const builders = [];

    const blockStart = firstRowidSince(db, 'co_block', since);
    if (blockStart != null) {
      // Work out which world ids to count (SS18, its nether and its end)
      const wanted = new Set(workerData.worlds.map((w) => w.toLowerCase()));
      const worldIds = db
        .prepare('SELECT id, world FROM co_world')
        .all()
        .filter((w) => wanted.has(String(w.world).toLowerCase()))
        .map((w) => Number(w.id));
      if (worldIds.length === 0) {
        throw new Error('None of the configured worlds were found in CoreProtect (check WORLDS in index.js)');
      }
      const worldFilter = `AND wid IN (${worldIds.join(',')})`;

      // Fire, creepers, leaf decay, etc. are stored by CoreProtect as "#name"
      // entries, so skipping those leaves only real players. TNT ("#tnt...") is
      // the exception: it is kept and shown under the single name "TNT".
      const names = new Map();
      for (const u of db.prepare('SELECT rowid AS id, user FROM co_user').all()) {
        if (!u.user) continue;
        if (u.user.toLowerCase().startsWith('#tnt')) names.set(u.id, 'TNT');
        else if (!u.user.startsWith('#')) names.set(u.id, u.user);
      }

      const materials = new Map();
      for (const m of db.prepare('SELECT id, material FROM co_material_map').all()) {
        materials.set(m.id, m.material.replace(/^minecraft:/, ''));
      }

      // action = 0 is "block broken" in CoreProtect, 1 is "placed"
      const brokenRows = db
        .prepare(`SELECT user, type, COUNT(*) AS c FROM co_block WHERE rowid >= ? AND action = 0 ${worldFilter} GROUP BY user, type`)
        .all(blockStart);
      console.log(`  [worker] grouped block rows (broken): ${brokenRows.length} (${((Date.now() - workerStart) / 1000).toFixed(1)}s in)`);

      const byPlayer = new Map();
      for (const r of brokenRows) {
        const name = names.get(r.user);
        if (!name) continue; // not a real player
        let p = byPlayer.get(name);
        if (!p) {
          p = { name, totalBroken: 0, blocks: [] };
          byPlayer.set(name, p);
        }
        p.totalBroken += r.c;
        p.blocks.push({ material: materials.get(r.type) || 'unknown', count: r.c });
      }

      const all = [...byPlayer.values()].sort((a, b) => b.totalBroken - a.totalBroken);
      totalBlocks = all.reduce((sum, p) => sum + p.totalBroken, 0); // all players, not just the top 10

      for (const p of all.slice(0, workerData.maxPlayers)) {
        p.blocks.sort((a, b) => b.count - a.count);
        p.blocks = p.blocks.slice(0, workerData.topBlocks);
        p.otherCount = p.totalBroken - p.blocks.reduce((sum, b) => sum + b.count, 0);
        players.push(p);
      }

      // Now process blocks placed (action = 1) for top builders
      const placedRows = db
        .prepare(`SELECT user, type, COUNT(*) AS c FROM co_block WHERE rowid >= ? AND action = 1 ${worldFilter} GROUP BY user, type`)
        .all(blockStart);
      console.log(`  [worker] grouped block rows (placed): ${placedRows.length} (${((Date.now() - workerStart) / 1000).toFixed(1)}s in)`);

      const byBuilderMap = new Map();
      for (const r of placedRows) {
        const name = names.get(r.user);
        if (!name) continue; // not a real player
        let b = byBuilderMap.get(name);
        if (!b) {
          b = { name, totalPlaced: 0, blocks: [] };
          byBuilderMap.set(name, b);
        }
        b.totalPlaced += r.c;
        b.blocks.push({ material: materials.get(r.type) || 'unknown', count: r.c });
      }

      const allBuilders = [...byBuilderMap.values()].sort((a, b) => b.totalPlaced - a.totalPlaced);
      totalBlocksPlaced = allBuilders.reduce((sum, b) => sum + b.totalPlaced, 0);

      for (const b of allBuilders.slice(0, workerData.maxPlayers)) {
        b.blocks.sort((a, b) => b.count - a.count);
        b.blocks = b.blocks.slice(0, workerData.topBlocks);
        b.otherCount = b.totalPlaced - b.blocks.reduce((sum, bl) => sum + bl.count, 0);
        builders.push(b);
      }
    }

    const chatStart = firstRowidSince(db, 'co_chat', since);
    if (chatStart != null) {
      totalChat = db
        .prepare('SELECT COUNT(*) AS c FROM co_chat WHERE rowid >= ?')
        .get(chatStart).c;
    }

    db.close();
    parentPort.postMessage({ ok: true, totalBlocks, totalBlocksPlaced, totalChat, players, builders });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  }
  return;
}

/* ------------------------------------------------------------------ *
 * MAIN THREAD: tiny Express server that only ever serves the cache.
 * ------------------------------------------------------------------ */
const express = require('express');
const cors = require('cors');

const app = express();
const statsDb = new Database(path.join(__dirname, 'stats.db'), { readonly: true, fileMustExist: true });
app.use(cors()); // tighten to your domain later: cors({ origin: 'https://sharkcicle.com' })
app.use(express.json());

let cachedStats = null;
let updating = false;

function loadCacheFromFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (parsed.data && Array.isArray(parsed.data.players)) {
        cachedStats = parsed;
        console.log(`✓ Loaded cache from file (generated ${parsed.timestamp})`);
      } else {
        // Left over from an older version of this service: don't serve misleading numbers
        console.log('… ignoring old-format cache file, waiting for first update');
      }
    }
  } catch (e) {
    console.error(`✗ Error loading cache file: ${e.message}`);
  }
}

function updateCache() {
  if (updating) {
    console.log('… previous update still running, skipping');
    return;
  }
  updating = true;
  const started = Date.now();
  console.log(`📊 Updating cache... (${new Date().toLocaleTimeString()})`);

  const worker = new Worker(__filename, {
    workerData: { dbPath: DB_PATH, topBlocks: TOP_BLOCKS, maxPlayers: MAX_PLAYERS, worlds: WORLDS },
  });
  const killer = setTimeout(() => {
    console.error('✗ Update timed out, terminating worker');
    worker.terminate();
  }, WORKER_TIMEOUT);

  const finish = () => {
    clearTimeout(killer);
    updating = false;
  };

  worker.once('message', (m) => {
    if (!m.ok) {
      console.error(`✗ Worker error: ${m.error}`);
      return;
    }
    cachedStats = {
      success: true,
      period: 'last_7_days',
      timestamp: new Date().toISOString(),
      data: {
        totalBlocksBroken: m.totalBlocks,
        totalBlocksPlaced: m.totalBlocksPlaced,
        totalChatMessages: m.totalChat,
        topBlocks: TOP_BLOCKS,
        players: m.players,
        builders: m.builders,
      },
    };
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedStats, null, 2));
    } catch (e) {
      console.error(`✗ Could not write cache file: ${e.message}`);
    }
    console.log(`✓ Cache updated in ${((Date.now() - started) / 1000).toFixed(1)}s`, cachedStats.data);
  });
  worker.once('error', (e) => {
    console.error(`✗ Worker crashed: ${e.message}`);
    finish();
  });
  worker.once('exit', finish);
}

loadCacheFromFile();
updateCache();
setInterval(updateCache, CACHE_INTERVAL);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', cached: !!cachedStats, updating });
});

app.get('/stats', (req, res) => {
  if (!cachedStats) {
    return res.status(503).json({ success: false, error: 'Cache not ready yet, please try again shortly' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(cachedStats);
});

/* ---------------- Lifetime lookup (reads stats.db) ---------------- */
app.get('/players', (req, res) => {
  const rows = statsDb.prepare('SELECT name FROM users ORDER BY name COLLATE NOCASE').all();
  res.json({ success: true, players: rows.map((r) => r.name) });
});

app.get('/materials', (req, res) => {
  const rows = statsDb.prepare('SELECT name FROM materials ORDER BY name').all();
  res.json({ success: true, materials: rows.map((r) => r.name) });
});

// sort=total (default) ranks by broken+placed combined; sort=broken or sort=placed
// ranks by just that column, e.g. "who PLACED the most stone" is block=stone&sort=placed
const LOOKUP_SORTS = {
  total: 'broken + placed DESC',
  broken: 'broken DESC',
  placed: 'placed DESC',
};

// When no player/block filter is given, rank materials overall instead (by their
// community-wide total), and report whichever single player contributed the most
// towards that same metric for each material.
const OVERVIEW_RANK_METRIC = {
  total: 'broken + placed',
  broken: 'broken',
  placed: 'placed',
};
const OVERVIEW_TOTAL_METRIC = {
  total: 't.broken + t.placed',
  broken: 't.broken',
  placed: 't.placed',
};

app.get('/lookup', (req, res) => {
  const player = (req.query.player || '').toString().trim();
  const block = (req.query.block || '').toString().trim();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const sortKey = ['total', 'broken', 'placed'].includes((req.query.sort || '').toString())
    ? req.query.sort.toString()
    : 'total';

  // No filters: "top blocks broken/placed overall, and by who" - rank materials by
  // their community-wide total and surface the top contributing player per material.
  if (!player && !block) {
    try {
      const rows = statsDb.prepare(`
        WITH user_totals AS (
          SELECT material_id, user_id,
                 SUM(CASE WHEN action = 0 THEN count ELSE 0 END) AS broken,
                 SUM(CASE WHEN action = 1 THEN count ELSE 0 END) AS placed
          FROM block_stats
          GROUP BY material_id, user_id
        ),
        totals AS (
          SELECT material_id, SUM(broken) AS broken, SUM(placed) AS placed
          FROM user_totals
          GROUP BY material_id
        ),
        ranked AS (
          SELECT material_id, user_id, broken, placed,
                 ROW_NUMBER() OVER (PARTITION BY material_id ORDER BY ${OVERVIEW_RANK_METRIC[sortKey]} DESC) AS rn
          FROM user_totals
        )
        SELECT m.name AS block, t.broken AS broken, t.placed AS placed, u.name AS player
        FROM totals t
        JOIN materials m ON m.id = t.material_id
        LEFT JOIN ranked r ON r.material_id = t.material_id AND r.rn = 1
        LEFT JOIN users u ON u.id = r.user_id
        ORDER BY ${OVERVIEW_TOTAL_METRIC[sortKey]} DESC
        LIMIT ? OFFSET ?
      `).all(limit + 1, offset);

      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json({ success: true, hasMore: rows.length > limit, rows: rows.slice(0, limit) });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  const orderBy = LOOKUP_SORTS[sortKey];
  const where = [];
  const params = [];
  if (player) { where.push('u.name = ? COLLATE NOCASE'); params.push(player); }
  if (block) { where.push('m.name = ?'); params.push(block.toLowerCase().replace(/ /g, '_')); }

  try {
    const rows = statsDb.prepare(`
      SELECT u.name AS player, m.name AS block,
             SUM(CASE WHEN b.action = 0 THEN b.count ELSE 0 END) AS broken,
             SUM(CASE WHEN b.action = 1 THEN b.count ELSE 0 END) AS placed
      FROM block_stats b
      JOIN users u ON u.id = b.user_id
      JOIN materials m ON m.id = b.material_id
      WHERE ${where.join(' AND ')}
      GROUP BY b.user_id, b.material_id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit + 1, offset);

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ success: true, hasMore: rows.length > limit, rows: rows.slice(0, limit) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CoreProtect API running on http://0.0.0.0:${PORT}`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));