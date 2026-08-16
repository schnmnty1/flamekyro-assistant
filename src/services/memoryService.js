const { query } = require("./database");

/**
 * Create or update a Discord user's profile.
 */
async function upsertUser(user) {
    if (!user?.id) return;

    await query(
        `
        INSERT INTO users (
            discord_id,
            username,
            display_name,
            first_seen,
            last_seen
        )
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (discord_id)
        DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            last_seen = NOW();
        `,
        [
            user.id,
            user.username || null,
            user.displayName || user.username || null
        ]
    );
}

/**
 * Save a long-term memory.
 */
async function saveMemory(
    discordId,
    memory,
    category = "general",
    importance = 1,
    verified = false
) {
    if (!discordId || !memory) return;

    await query(
        `
        INSERT INTO memories (
            discord_id,
            memory,
            category,
            importance,
            verified
        )
        VALUES ($1, $2, $3, $4, $5);
        `,
        [
            discordId,
            memory,
            category,
            importance,
            verified
        ]
    );
}

/**
 * Get important memories for a user.
 */
async function getMemories(discordId, limit = 10) {
    if (!discordId) return [];

    const result = await query(
        `
        SELECT
            id,
            memory,
            category,
            importance,
            verified,
            created_at
        FROM memories
        WHERE discord_id = $1
        ORDER BY
            verified DESC,
            importance DESC,
            updated_at DESC
        LIMIT $2;
        `,
        [discordId, limit]
    );

    return result?.rows || [];
}

/**
 * Get only verified memories.
 */
async function getVerifiedMemories(discordId) {
    if (!discordId) return [];

    const result = await query(
        `
        SELECT
            id,
            memory,
            category,
            importance,
            verified
        FROM memories
        WHERE discord_id = $1
          AND verified = TRUE
        ORDER BY importance DESC, updated_at DESC;
        `,
        [discordId]
    );

    return result?.rows || [];
}

/**
 * Make sure Flame's owner identity exists in the database.
 *
 * This is controlled by OWNER_USER_ID.
 * A normal member cannot create or overwrite this identity.
 */
async function ensureOwnerIdentity(user) {
    if (!user?.id) return false;

    const ownerId = process.env.OWNER_USER_ID;

    if (!ownerId || user.id !== ownerId) {
        return false;
    }

    await upsertUser(user);

    const existing = await query(
        `
        SELECT id
        FROM memories
        WHERE discord_id = $1
          AND category = 'owner'
          AND verified = TRUE
        LIMIT 1;
        `,
        [ownerId]
    );

    if (!existing?.rows?.length) {
        await saveMemory(
            ownerId,
            "The user's name is Flame. Flame is the owner and manager of the FlameKyro Discord community.",
            "owner",
            10,
            true
        );

        console.log("👑 Verified Flame owner identity saved.");
    }

    return true;
}

/**
 * Delete a memory belonging to a user.
 */
async function deleteMemory(discordId, memoryId) {
    if (!discordId || !memoryId) return;

    await query(
        `
        DELETE FROM memories
        WHERE id = $1
          AND discord_id = $2;
        `,
        [memoryId, discordId]
    );
}

module.exports = {
    upsertUser,
    saveMemory,
    getMemories,
    getVerifiedMemories,
    ensureOwnerIdentity,
    deleteMemory
};