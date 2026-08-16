const { Pool } = require("pg");

let pool = null;

function getPool() {
    if (pool) {
        return pool;
    }

    const databaseUrl = process.env.DATABASE_URL;

    // Local development में DATABASE_URL न हो तो bot को crash मत करो.
    if (!databaseUrl) {
        console.warn("⚠️ DATABASE_URL not found. Persistent memory is disabled.");
        return null;
    }

    pool = new Pool({
        connectionString: databaseUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    pool.on("error", (error) => {
        console.error("❌ PostgreSQL pool error:", error);
    });

    return pool;
}

async function query(text, params = []) {
    const db = getPool();

    if (!db) {
        return null;
    }

    return db.query(text, params);
}

async function initializeDatabase() {
    const db = getPool();

    if (!db) {
        return false;
    }

    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                discord_id TEXT PRIMARY KEY,
                username TEXT,
                display_name TEXT,
                first_seen TIMESTAMPTZ DEFAULT NOW(),
                last_seen TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS memories (
                id BIGSERIAL PRIMARY KEY,
                discord_id TEXT NOT NULL,
                memory TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                importance INTEGER DEFAULT 1,
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS memories_discord_id_idx
            ON memories(discord_id);
        `);

        console.log("✅ PostgreSQL connected.");
        console.log("✅ FlameKyro memory tables are ready.");

        return true;

    } catch (error) {
        console.error("❌ Failed to initialize PostgreSQL:", error);
        return false;
    }
}

async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = {
    getPool,
    query,
    initializeDatabase,
    closeDatabase
};