const { query } = require("./database");

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

const DAILY_GRACE_HOURS = 8;

const REMINDER_COOLDOWN_HOURS = 12;

let schedulerStarted = false;


// ========================================
// TASK DEFINITIONS
// ========================================

const TASKS = {

    daily: {
        label: "Daily",
        command: "owo daily"
    },

    vote: {
        label: "Vote",
        command: "owo vote"
    },

    quest: {
        label: "Quest",
        command: "owo quest"
    },

    cookie: {
        label: "Cookie",
        command: "owo cookie"
    }

};


// ========================================
// TIME HELPERS
// ========================================

function getPacificParts(date = new Date()) {

    const formatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone: PACIFIC_TIME_ZONE,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23"
            }
        );


    const parts =
        formatter.formatToParts(date);


    const result = {};


    for (const part of parts) {

        if (part.type !== "literal") {

            result[part.type] =
                part.value;

        }

    }


    return {

        year:
            Number(result.year),

        month:
            Number(result.month),

        day:
            Number(result.day),

        hour:
            Number(result.hour),

        minute:
            Number(result.minute),

        second:
            Number(result.second)

    };

}


function getPacificDateKey(
    date = new Date()
) {

    const parts =
        getPacificParts(date);


    return [

        parts.year,

        String(parts.month)
            .padStart(2, "0"),

        String(parts.day)
            .padStart(2, "0")

    ].join("-");

}


// ========================================
// DATABASE INITIALIZATION
// ========================================

async function initializeOwoReminderSystem() {

    await query(`
        CREATE TABLE IF NOT EXISTS owo_reminders (

            discord_id VARCHAR(32) PRIMARY KEY,

            username VARCHAR(255),

            display_name VARCHAR(255),

            last_daily_at TIMESTAMPTZ,

            last_vote_at TIMESTAMPTZ,

            last_quest_at TIMESTAMPTZ,

            last_cookie_at TIMESTAMPTZ,

            last_daily_check_at TIMESTAMPTZ,

            last_vote_check_at TIMESTAMPTZ,

            last_quest_check_at TIMESTAMPTZ,

            last_cookie_check_at TIMESTAMPTZ,

            last_daily_reminder_at TIMESTAMPTZ,

            last_vote_reminder_at TIMESTAMPTZ,

            last_quest_reminder_at TIMESTAMPTZ,

            last_cookie_reminder_at TIMESTAMPTZ,

            last_seen_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        );
    `);


    // ========================================
    // SAFE MIGRATION FOR EXISTING TABLE
    // ========================================

    await query(`
        ALTER TABLE owo_reminders
        ADD COLUMN IF NOT EXISTS last_daily_check_at TIMESTAMPTZ;

        ALTER TABLE owo_reminders
        ADD COLUMN IF NOT EXISTS last_vote_check_at TIMESTAMPTZ;

        ALTER TABLE owo_reminders
        ADD COLUMN IF NOT EXISTS last_quest_check_at TIMESTAMPTZ;

        ALTER TABLE owo_reminders
        ADD COLUMN IF NOT EXISTS last_cookie_check_at TIMESTAMPTZ;
    `);


    console.log(
        "🐮 OWO reminder table is ready."
    );

}


// ========================================
// UPSERT USER
// ========================================

async function ensureUser(
    user
) {

    if (!user?.id) {
        return;
    }


    await query(
        `
        INSERT INTO owo_reminders (
            discord_id,
            username,
            display_name,
            last_seen_at,
            updated_at
        )

        VALUES (
            $1,
            $2,
            $3,
            NOW(),
            NOW()
        )

        ON CONFLICT (discord_id)

        DO UPDATE SET

            username =
                EXCLUDED.username,

            display_name =
                EXCLUDED.display_name,

            last_seen_at =
                NOW(),

            updated_at =
                NOW();
        `,
        [

            user.id,

            user.username || null,

            user.globalName ||
                user.username ||
                null

        ]
    );

}


// ========================================
// DETECT OWO COMMAND
// ========================================

function detectOwoCommand(
    content
) {

    const text =
        String(content || "")
            .trim()
            .toLowerCase();


    if (
        /^owo\s+daily(?:\s|$)/i
            .test(text)
    ) {

        return "daily";

    }


    if (
        /^owo\s+vote(?:\s|$)/i
            .test(text)
    ) {

        return "vote";

    }


    if (
        /^owo\s+quest(?:\s|$)/i
            .test(text)
    ) {

        return "quest";

    }


    if (
        /^owo\s+cookie(?:\s|$)/i
            .test(text)
    ) {

        return "cookie";

    }


    return null;

}


// ========================================
// TRACK USER OWO COMMAND
// ========================================

async function trackOwoCommand(
    message
) {

    if (
        !message ||
        !message.author ||
        message.author.bot ||
        !message.guild
    ) {

        return;

    }


    const task =
        detectOwoCommand(
            message.content
        );


    if (!task) {

        return;

    }


    try {

        await ensureUser(
            message.author
        );


        const checkColumn =
            `last_${task}_check_at`;


        await query(
            `
            UPDATE owo_reminders

            SET

                ${checkColumn} = NOW(),

                last_seen_at = NOW(),

                updated_at = NOW()

            WHERE discord_id = $1;
            `,
            [
                message.author.id
            ]
        );


        console.log(
            `🐮 OWO command detected | ` +
            `User: ${message.author.tag} | ` +
            `Task: ${task}`
        );


        // Store the pending task in memory.
        // The next OwO bot response will be analyzed.
        pendingOwoCommands.set(
            message.author.id,
            {
                task,
                timestamp: Date.now(),
                guildId: message.guild.id
            }
        );


    } catch (error) {

        console.error(
            "❌ Failed to track OWO command:",
            error
        );

    }

}


// ========================================
// PENDING COMMANDS
// ========================================

const pendingOwoCommands =
    new Map();


// ========================================
// DETECT OWO SUCCESS
// ========================================

function detectOwoSuccess(
    task,
    content
) {

    const text =
        String(content || "")
            .toLowerCase();


    // ========================================
    // DAILY
    // ========================================

    if (task === "daily") {

        return (

            text.includes("here is your daily") ||

            text.includes("daily cowoncy") ||

            text.includes("daily streak") ||

            text.includes("your daily")

        );

    }


    // ========================================
    // VOTE
    // ========================================

    if (task === "vote") {

        // "Your daily vote is available"
        // means the user HAS NOT completed the vote.

        if (
            text.includes(
                "your daily vote is available"
            )
        ) {

            return false;

        }


        return (

            text.includes("thank you for voting") ||

            text.includes("thanks for voting") ||

            text.includes("successfully voted") ||

            text.includes("you voted") ||

            text.includes("vote reward")

        );

    }


    // ========================================
    // QUEST
    // ========================================

    if (task === "quest") {

        // Quest log is NOT completion.

        if (
            text.includes("next quest:") ||

            text.includes("quest log")

        ) {

            return false;

        }


        return (

            text.includes("quest completed") ||

            text.includes("completed the quest") ||

            text.includes("quest reward") ||

            text.includes("quest complete")

        );

    }


    // ========================================
    // COOKIE
    // ========================================

    if (task === "cookie") {

        return (

            text.includes(
                "you got a cookie"
            ) ||

            text.includes(
                "got a cookie from"
            ) ||

            text.includes(
                "nom nom nom"
            )

        );

    }


    return false;

}


// ========================================
// PROCESS OWO BOT RESPONSE
// ========================================

async function processOwoBotMessage(
    message
) {

    if (
        !message ||
        !message.author ||
        !message.author.bot ||
        !message.guild
    ) {

        return;

    }


    // We only care about OwO bot.
    if (
        message.author.id !==
        "408785106942164992"
    ) {

        return;

    }


    const content =
        String(message.content || "");


    if (!content) {

        return;

    }


    // ========================================
    // FIND RECENT PENDING COMMAND
    // ========================================

    let pendingEntry = null;

    let pendingUserId = null;


    for (
        const [
            userId,
            entry
        ]
        of pendingOwoCommands.entries()
    ) {

        // Don't associate an old command.
        if (
            Date.now() -
            entry.timestamp
            > 60 * 1000
        ) {

            pendingOwoCommands.delete(
                userId
            );

            continue;

        }


        if (
            entry.guildId ===
            message.guild.id
        ) {

            pendingEntry =
                entry;

            pendingUserId =
                userId;

            break;

        }

    }


    if (
        !pendingEntry ||
        !pendingUserId
    ) {

        return;

    }


    const task =
        pendingEntry.task;


    console.log(
        `🐮 OwO response detected | Task: ${task}`
    );


    const success =
        detectOwoSuccess(
            task,
            content
        );


    // ========================================
    // COMMAND WAS NOT SUCCESSFUL
    // ========================================

    if (!success) {

        console.log(
            `ℹ️ OwO ${task} response did not confirm completion.`
        );


        pendingOwoCommands.delete(
            pendingUserId
        );


        return;

    }


    // ========================================
    // SUCCESSFUL COMPLETION
    // ========================================

    const completionColumn =
        `last_${task}_at`;


    await query(
        `
        UPDATE owo_reminders

        SET

            ${completionColumn} = NOW(),

            last_seen_at = NOW(),

            updated_at = NOW()

        WHERE discord_id = $1;
        `,
        [
            pendingUserId
        ]
    );


    console.log(
        `✅ OWO task completed | ` +
        `User: ${pendingUserId} | ` +
        `Task: ${task}`
    );


    pendingOwoCommands.delete(
        pendingUserId
    );

}


// ========================================
// REMINDER COOLDOWN
// ========================================

function reminderCooldownPassed(
    lastReminderAt
) {

    if (!lastReminderAt) {

        return true;

    }


    const elapsed =
        Date.now() -
        new Date(
            lastReminderAt
        ).getTime();


    return (
        elapsed >=
        REMINDER_COOLDOWN_HOURS *
        60 *
        60 *
        1000
    );

}


// ========================================
// DAILY TASK DUE
// ========================================

function dailyTaskIsDue(
    lastCompletedAt,
    lastReminderAt
) {

    const now =
        new Date();


    const pacific =
        getPacificParts(now);


    if (
        pacific.hour <
        DAILY_GRACE_HOURS
    ) {

        return false;

    }


    if (
        !reminderCooldownPassed(
            lastReminderAt
        )
    ) {

        return false;

    }


    if (!lastCompletedAt) {

        return true;

    }


    const completedDate =
        getPacificDateKey(
            new Date(
                lastCompletedAt
            )
        );


    const today =
        getPacificDateKey(now);


    return (
        completedDate !==
        today
    );

}


// ========================================
// VOTE REMINDER
// ========================================

function voteReminderIsDue(
    row
) {

    if (
        !reminderCooldownPassed(
            row.last_vote_reminder_at
        )
    ) {

        return false;

    }


    /*
     * If user has never used OWO vote,
     * don't immediately ping them.
     *
     * We need evidence that they use OWO.
     */

    if (!row.last_vote_check_at) {

        return false;

    }


    /*
     * After a vote check, wait 12 hours
     * before reminding again.
     *
     * We cannot verify Top.gg voting
     * from Discord alone.
     */

    const elapsed =
        Date.now() -
        new Date(
            row.last_vote_check_at
        ).getTime();


    return (
        elapsed >=
        12 * 60 * 60 * 1000
    );

}


// ========================================
// SEND REMINDER
// ========================================

async function sendReminder(
    client,
    row,
    task,
    message
) {

    const channelId =
        process.env.OWO_REMINDER_CHANNEL_ID ||
        process.env.AI_CHANNEL_ID;


    if (!channelId) {

        console.warn(
            "⚠️ OWO reminder channel is not configured."
        );

        return false;

    }


    const channel =
        await client.channels
            .fetch(channelId)
            .catch(() => null);


    if (
        !channel ||
        !channel.isTextBased()
    ) {

        console.warn(
            `⚠️ OWO reminder channel unavailable: ${channelId}`
        );

        return false;

    }


    try {

        await channel.send({

            content:
                message,

            allowedMentions: {

                users: [
                    row.discord_id
                ]

            }

        });


        const reminderColumn =
            `last_${task}_reminder_at`;


        await query(
            `
            UPDATE owo_reminders

            SET

                ${reminderColumn} = NOW(),

                updated_at = NOW()

            WHERE discord_id = $1;
            `,
            [
                row.discord_id
            ]
        );


        console.log(
            `🔔 OWO reminder sent | ` +
            `User: ${row.discord_id} | ` +
            `Task: ${task}`
        );


        return true;

    } catch (error) {

        console.error(
            `❌ Failed to send OWO ${task} reminder:`,
            error
        );


        return false;

    }

}


// ========================================
// RUN REMINDER CHECK
// ========================================

async function runOwoReminderCheck(
    client
) {

    if (
        !client?.isReady()
    ) {

        return;

    }


    try {

        const result =
            await query(`
                SELECT *
                FROM owo_reminders
                ORDER BY last_seen_at DESC;
            `);


        const users =
            result?.rows || [];


        if (!users.length) {

            console.log(
                "🐮 OWO reminder check: no tracked users yet."
            );

            return;

        }


        console.log(
            `🐮 OWO reminder check: ` +
            `${users.length} tracked user(s).`
        );


        for (
            const row
            of users
        ) {

            // ========================================
            // DAILY
            // ========================================

            if (
                dailyTaskIsDue(
                    row.last_daily_at,
                    row.last_daily_reminder_at
                )
            ) {

                await sendReminder(

                    client,

                    row,

                    "daily",

                    `🔥 <@${row.discord_id}> **OWO Daily Check!**\n\n` +
                    `Your \`owo daily\` should be ready. 💰🐮\n` +
                    `Don't let today's reward sit there — go claim it!`

                );


                continue;

            }


            // ========================================
            // VOTE
            // ========================================

            if (
                voteReminderIsDue(row)
            ) {

                await sendReminder(

                    client,

                    row,

                    "vote",

                    `🗳️ <@${row.discord_id}> **OWO Vote Check!**\n\n` +
                    `It's been around 12 hours since your last OWO vote check. 🔥\n` +
                    `Run \`owo vote\` and see if your vote reward is available!`

                );


                continue;

            }


            // ========================================
            // QUEST
            // ========================================

            /*
             * We currently do NOT send a quest reminder
             * immediately after `owo quest`.
             *
             * A quest log only tells us the next quest
             * availability; it does not prove completion.
             *
             * We'll add stronger quest detection later
             * when we have reliable completion evidence.
             */

            // ========================================
            // COOKIE
            // ========================================

            /*
             * Cookie reminders are intentionally disabled
             * in Phase 1.
             *
             * Cookie requires interaction with another user,
             * so blindly reminding someone would be noisy.
             */

        }

    } catch (error) {

        console.error(
            "❌ OWO reminder check failed:",
            error
        );

    }

}


// ========================================
// START SCHEDULER
// ========================================

function startOwoReminderScheduler(
    client
) {

    if (schedulerStarted) {

        console.warn(
            "⚠️ OWO reminder scheduler already running."
        );

        return;

    }


    schedulerStarted = true;


    console.log(
        "⏰ OWO reminder scheduler started."
    );


    setTimeout(

        () => {

            runOwoReminderCheck(
                client
            );

        },

        30 * 1000

    );


    setInterval(

        () => {

            runOwoReminderCheck(
                client
            );

        },

        CHECK_INTERVAL_MS

    );

}


// ========================================
// EXPORT
// ========================================

module.exports = {

    initializeOwoReminderSystem,

    trackOwoCommand,

    processOwoBotMessage,

    runOwoReminderCheck,

    startOwoReminderScheduler

};