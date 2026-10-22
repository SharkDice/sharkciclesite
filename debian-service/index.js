const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Database path - matches your Debian installation
const DB_PATH = '/DATA/AppData/crafty/servers/802a8dfd-7073-4bfe-852a-0105add883c3/plugins/CoreProtect/database.db';
const CACHE_FILE = path.join(__dirname, 'stats-cache.json');
const CACHE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database connections (read-only mode)
let db; // For HTTP requests (fast, responsive)
let dbCache; // For background cache updates (can take time)
try {
  db = new Database(DB_PATH, { readonly: true });
  dbCache = new Database(DB_PATH, { readonly: true });
  console.log(`✓ Connected to CoreProtect database at ${DB_PATH}`);
} catch (error) {
  console.error(`✗ Failed to connect to CoreProtect database: ${error.message}`);
  console.error(`  Path: ${DB_PATH}`);
  process.exit(1);
}

// Cache object
let cachedStats = null;

// Function to query database and update cache (non-blocking)
function updateCache() {
  try {
    console.log(`📊 Updating cache... (${new Date().toLocaleTimeString()})`);

    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

    // Total blocks broken (last 7 days)
    const totalBlocksQuery = dbCache.prepare(`
      SELECT COUNT(*) as count FROM co_block WHERE time > ?
    `);
    const totalBlocks = totalBlocksQuery.get(sevenDaysAgo)?.count || 0;

    // Total chat messages (last 7 days)
    const totalChatQuery = dbCache.prepare(`
      SELECT COUNT(*) as count FROM co_chat WHERE time > ?
    `);
    const totalChat = totalChatQuery.get(sevenDaysAgo)?.count || 0;

    // Number of unique players (last 7 days)
    const uniquePlayersQuery = dbCache.prepare(`
      SELECT COUNT(DISTINCT user) as count FROM co_block WHERE time > ?
    `);
    const uniquePlayers = uniquePlayersQuery.get(sevenDaysAgo)?.count || 0;

    // Build stats object
    const stats = {
      success: true,
      period: 'last_7_days',
      timestamp: new Date().toISOString(),
      cachedAt: new Date().toLocaleTimeString(),
      data: {
        totalBlocksBroken: totalBlocks,
        totalChatMessages: totalChat,
        uniquePlayers: uniquePlayers,
      }
    };

    // Save to cache file
    fs.writeFileSync(CACHE_FILE, JSON.stringify(stats, null, 2));
    cachedStats = stats;

    console.log(`✓ Cache updated successfully`);
    console.log(`  - Blocks broken: ${totalBlocks.toLocaleString()}`);
    console.log(`  - Chat messages: ${totalChat.toLocaleString()}`);
    console.log(`  - Players: ${uniquePlayers}`);

  } catch (error) {
    console.error(`✗ Error updating cache: ${error.message}`);
    // Try to load from file as fallback
    if (!cachedStats) {
      loadCacheFromFile();
    }
  }
}

// Load initial cache from file if it exists
function loadCacheFromFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      cachedStats = JSON.parse(data);
      console.log(`✓ Loaded cache from file`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error loading cache file: ${error.message}`);
  }
  return false;
}

// Update cache on startup (non-blocking)
console.log(`\n🚀 Updating cache on startup...`);
setImmediate(() => updateCache());

// Set interval to update cache every 5 minutes (also non-blocking)
setInterval(() => {
  setImmediate(() => updateCache());
}, CACHE_INTERVAL);
console.log(`⏱️  Cache will auto-update every 5 minutes\n`);

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', message: 'CoreProtect API is running' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get statistics (from cache - instant response!)
app.get('/stats', (req, res) => {
  if (!cachedStats) {
    // Try to load from file as fallback
    loadCacheFromFile();
  }

  if (!cachedStats) {
    return res.status(503).json({
      success: false,
      error: 'Cache not ready yet, please try again in a moment'
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(cachedStats);
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CoreProtect API Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Stats endpoint: http://play.sharkcicle.com:${PORT}/stats`);
  console.log(`💚 Health check: http://play.sharkcicle.com:${PORT}/health`);
  console.log(`\nTest the API by running:`);
  console.log(`  curl http://play.sharkcicle.com:${PORT}/stats\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down CoreProtect API...');
  db.close();
  dbCache.close();
  process.exit(0);
});
