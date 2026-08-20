const { PermissionFlagsBits } = require("discord.js");
const { query } = require("./database");


// ========================================
// CONFIGURATION
// ========================================

const MODERATION_LOG_CHANNEL_ID =
    process.env.MODERATION_LOG_CHANNEL_ID || null;


// Warnings remain active for 7 days.
const WARNING_EXPIRY_DAYS = 7;


// Spam detection
const MESSAGE_WINDOW_MS = 8000;
const MAX_MESSAGES_IN_WINDOW = 6;


// Duplicate message detection
const DUPLICATE_WINDOW_MS = 15000;
const MAX_DUPLICATE_MESSAGES = 3;


// Mention protection
const MENTION_LIMIT = 5;


// Prevent repeated warning messages
// for the same user within 60 seconds.
const WARNING_COOLDOWN_MS = 60 * 1000;


// Auto timeout is intentionally controlled
// through .env.
const AUTO_TIMEOUT_ENABLED =
    String(
        process.env.MODERATION_AUTO_TIMEOUT || "false"
    ).toLowerCase() === "true";


// ========================================
// TIMEOUT ESCALATION
// ========================================
//
// Warning #1 → no timeout
// Warning #2 → no timeout
// Warning #3 → 10 minutes
// Warning #4 → 1 hour
// Warning #5+ → 24 hours
//

function getTimeoutMinutes(
    warningCount
) {

    if (warningCount >= 5) {
        return 24 * 60;
    }

    if (warningCount === 4) {
        return 60;
    }

    if (warningCount === 3) {
        return 10;
    }

    return 0;
}


// ========================================
// IN-MEMORY TRACKING
// ========================================

const messageHistory =
    new Map();

const duplicateHistory =
    new Map();

const warningCooldown =
    new Map();


// ========================================
// DATABASE INITIALIZATION
// ========================================

async function initializeModerationSystem() {

    await query(`
        CREATE TABLE IF NOT EXISTS moderation_actions (

            id BIGSERIAL PRIMARY KEY,

            guild_id VARCHAR(32) NOT NULL,

            user_id VARCHAR(32) NOT NULL,

            moderator_id VARCHAR(32),

            action VARCHAR(50) NOT NULL,

            reason TEXT,

            message_id VARCHAR(32),

            channel_id VARCHAR(32),

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        );
    `);


    console.log(
        "🛡️ Moderation tables are ready."
    );

}


// ========================================
// MODERATOR CHECK
// ========================================

function isModerator(
    member
) {

    if (!member) {
        return false;
    }


    // Server owner
    if (
        member.id ===
        member.guild.ownerId
    ) {

        return true;

    }


    // Administrator
    if (
        member.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    ) {

        return true;

    }


    // Moderation permissions
    return (

        member.permissions?.has(
            PermissionFlagsBits.ManageMessages
        ) ||

        member.permissions?.has(
            PermissionFlagsBits.ModerateMembers
        ) ||

        member.permissions?.has(
            PermissionFlagsBits.BanMembers
        ) ||

        member.permissions?.has(
            PermissionFlagsBits.KickMembers
        )

    );

}


// ========================================
// NORMALIZE MESSAGE
// ========================================

function normalizeMessage(
    content
) {

    return String(
        content || ""
    )
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

}


// ========================================
// SUSPICIOUS DISCORD INVITE
// ========================================

function containsSuspiciousLink(
    content
) {

    const text =
        String(
            content || ""
        ).toLowerCase();


    const urlRegex =
        /(https?:\/\/|www\.)[^\s]+/gi;


    const urls =
        text.match(
            urlRegex
        ) || [];


    if (!urls.length) {
        return false;
    }


    return urls.some(
        url =>

            url.includes(
                "discord.gg/"
            ) ||

            url.includes(
                "discord.com/invite/"
            ) ||

            url.includes(
                "discordapp.com/invite/"
            )
    );

}


// ========================================
// EXCESSIVE MENTIONS
// ========================================

function hasExcessiveMentions(
    message
) {

    const mentionCount =
        message.mentions?.users?.size || 0;


    return (
        mentionCount >=
        MENTION_LIMIT
    );

}


// ========================================
// RAPID MESSAGE SPAM
// ========================================

function detectSpam(
    message
) {

    const userId =
        message.author.id;


    const now =
        Date.now();


    const history =
        messageHistory.get(
            userId
        ) || [];


    const recent =
        history.filter(
            timestamp =>

                now -
                timestamp <
                MESSAGE_WINDOW_MS
        );


    recent.push(
        now
    );


    messageHistory.set(
        userId,
        recent
    );


    return (
        recent.length >
        MAX_MESSAGES_IN_WINDOW
    );

}


// ========================================
// DUPLICATE MESSAGE SPAM
// ========================================

function detectDuplicateSpam(
    message
) {

    const userId =
        message.author.id;


    const content =
        normalizeMessage(
            message.content
        );


    if (!content) {
        return false;
    }


    const now =
        Date.now();


    const history =
        duplicateHistory.get(
            userId
        ) || [];


    const recent =
        history.filter(
            item =>

                now -
                item.timestamp <
                DUPLICATE_WINDOW_MS
        );


    recent.push({

        content,

        timestamp:
            now

    });


    duplicateHistory.set(
        userId,
        recent
    );


    const sameMessages =
        recent.filter(
            item =>
                item.content ===
                content
        );


    return (
        sameMessages.length >=
        MAX_DUPLICATE_MESSAGES
    );

}


// ========================================
// WARNING COOLDOWN
// ========================================

function canWarn(
    userId
) {

    const lastWarning =
        warningCooldown.get(
            userId
        );


    if (!lastWarning) {
        return true;
    }


    return (

        Date.now() -
        lastWarning >=
        WARNING_COOLDOWN_MS

    );

}


function markWarned(
    userId
) {

    warningCooldown.set(
        userId,
        Date.now()
    );

}


// ========================================
// SAVE MODERATION ACTION
// ========================================

async function saveModerationAction({

    guildId,

    userId,

    moderatorId = null,

    action,

    reason,

    messageId = null,

    channelId = null

}) {

    await query(

        `
        INSERT INTO moderation_actions (

            guild_id,

            user_id,

            moderator_id,

            action,

            reason,

            message_id,

            channel_id

        )

        VALUES (

            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7

        );
        `,

        [

            guildId,

            userId,

            moderatorId,

            action,

            reason,

            messageId,

            channelId

        ]

    );

}


// ========================================
// ACTIVE WARNING COUNT
// ========================================
//
// IMPORTANT:
// Only warnings from the last 7 days
// are considered active.
//

async function getActiveWarningCount(
    guildId,
    userId
) {

    const result =
        await query(

            `
            SELECT COUNT(*)::int AS count

            FROM moderation_actions

            WHERE guild_id = $1

              AND user_id = $2

              AND action = 'WARNING'

              AND created_at >=
                  NOW() -
                  INTERVAL '7 days';
            `,

            [

                guildId,

                userId

            ]

        );


    return Number(
        result?.rows?.[0]?.count || 0
    );

}


// ========================================
// MODERATION LOG
// ========================================

async function sendModerationLog(

    client,

    {

        member,

        action,

        reason,

        warningCount = null,

        timeoutMinutes = 0

    }

) {

    if (
        !MODERATION_LOG_CHANNEL_ID
    ) {

        return;

    }


    try {

        const channel =
            await client.channels.fetch(
                MODERATION_LOG_CHANNEL_ID
            );


        if (
            !channel ||
            !channel.isTextBased()
        ) {

            return;

        }


        let logMessage =

            `🛡️ **FlameKyro Moderation**\n\n` +

            `👤 **User:** ${member.user.tag}\n` +

            `🆔 **ID:** ${member.id}\n` +

            `⚠️ **Action:** ${action}\n` +

            `📝 **Reason:** ${reason}`;


        if (
            warningCount !== null
        ) {

            logMessage +=
                `\n📊 **Active Warnings:** ${warningCount}/${WARNING_EXPIRY_DAYS}-day window`;

        }


        if (
            timeoutMinutes > 0
        ) {

            logMessage +=
                `\n🔇 **Timeout:** ${formatDuration(timeoutMinutes)}`;

        }


        await channel.send({

            content:
                logMessage

        });


    } catch (error) {

        console.error(

            "❌ Failed to send moderation log:",

            error

        );

    }

}


// ========================================
// FORMAT TIMEOUT
// ========================================

function formatDuration(
    minutes
) {

    if (
        minutes >=
        24 * 60
    ) {

        const days =
            Math.floor(
                minutes /
                (24 * 60)
            );


        return `${days} day${days > 1 ? "s" : ""}`;

    }


    if (
        minutes >= 60
    ) {

        const hours =
            Math.floor(
                minutes /
                60
            );


        return `${hours} hour${hours > 1 ? "s" : ""}`;

    }


    return `${minutes} minutes`;

}


// ========================================
// APPLY WARNING
// ========================================

async function applyWarning(

    client,

    message,

    reason

) {

    const member =
        message.member;


    if (!member) {
        return;
    }


    if (
        isModerator(
            member
        )
    ) {

        console.log(

            `🛡️ Moderation bypass | ` +
            `${member.user.tag}`

        );

        return;

    }


    if (
        !canWarn(
            member.id
        )
    ) {

        console.log(

            `⏳ Warning cooldown active | ` +
            `${member.user.tag}`

        );

        return;

    }


    markWarned(
        member.id
    );


    // ========================================
    // CALCULATE ACTIVE WARNINGS
    // ========================================

    const previousWarnings =
        await getActiveWarningCount(

            message.guild.id,

            member.id

        );


    const warningCount =
        previousWarnings + 1;


    // ========================================
    // SAVE WARNING
    // ========================================

    await saveModerationAction({

        guildId:
            message.guild.id,

        userId:
            member.id,

        action:
            "WARNING",

        reason,

        messageId:
            message.id,

        channelId:
            message.channel.id

    });


    // ========================================
    // DELETE FLAGGED MESSAGE
    // ========================================

    try {

        if (
            message.deletable
        ) {

            await message.delete();

        }

    } catch (error) {

        console.warn(
            "⚠️ Could not delete flagged message."
        );

    }


    // ========================================
    // DETERMINE ESCALATION
    // ========================================

    const timeoutMinutes =
        getTimeoutMinutes(
            warningCount
        );


    // ========================================
    // USER WARNING MESSAGE
    // ========================================

    let warningMessage;


    if (
        warningCount === 1
    ) {

        warningMessage =

            `⚠️ <@${member.id}> **Slow down bro.**\n` +

            `${reason}\n\n` +

            `This is warning **#1**.`;

    }


    else if (
        warningCount === 2
    ) {

        warningMessage =

            `⚠️ <@${member.id}> **Repeated violation detected.**\n` +

            `${reason}\n\n` +

            `This is warning **#2**. ` +

            `One more active warning may result in a timeout.`;

    }


    else if (
        timeoutMinutes > 0
    ) {

        warningMessage =

            `🔇 <@${member.id}> **Moderation escalation triggered.**\n` +

            `${reason}\n\n` +

            `Active warning **#${warningCount}**.\n` +

            `You have been timed out for **${formatDuration(timeoutMinutes)}**.`;

    }


    else {

        warningMessage =

            `⚠️ <@${member.id}> **Moderation warning #${warningCount}.**\n` +

            `${reason}`;

    }


    // ========================================
    // SEND WARNING
    // ========================================

    try {

        await message.channel.send({

            content:
                warningMessage

        });

    } catch (error) {

        console.error(

            "❌ Failed to send warning:",

            error

        );

    }


    // ========================================
    // LOG WARNING
    // ========================================

    await sendModerationLog(

        client,

        {

            member,

            action:
                "WARNING",

            reason,

            warningCount,

            timeoutMinutes:
                0

        }

    );


    // ========================================
    // AUTO TIMEOUT
    // ========================================

    if (

        AUTO_TIMEOUT_ENABLED &&

        timeoutMinutes > 0 &&

        member.moderatable

    ) {

        try {

            await member.timeout(

                timeoutMinutes *
                60 *
                1000,

                `FlameKyro moderation escalation - warning #${warningCount}`

            );


            await saveModerationAction({

                guildId:
                    message.guild.id,

                userId:
                    member.id,

                action:
                    "TIMEOUT",

                reason:
                    `Automatic escalation after warning #${warningCount}: ${reason}`,

                messageId:
                    message.id,

                channelId:
                    message.channel.id

            });


            await sendModerationLog(

                client,

                {

                    member,

                    action:
                        "TIMEOUT",

                    reason:
                        `Automatic escalation after warning #${warningCount}: ${reason}`,

                    warningCount,

                    timeoutMinutes

                }

            );


            console.log(

                `🔇 Auto-timeout applied | ` +

                `User: ${member.user.tag} | ` +

                `Duration: ${formatDuration(timeoutMinutes)} | ` +

                `Warnings: ${warningCount}`

            );


        } catch (error) {

            console.error(

                "❌ Automatic timeout failed:",

                error

            );

        }

    }

}


// ========================================
// MAIN MODERATION CHECK
// ========================================

async function moderateMessage(

    client,

    message

) {

    // ========================================
    // BASIC FILTERS
    // ========================================

    if (
        !message ||
        !message.guild ||
        !message.member
    ) {

        return false;

    }


    if (
        message.author?.bot
    ) {

        return false;

    }


    // ========================================
    // MODERATOR BYPASS
    // ========================================

    if (
        isModerator(
            message.member
        )
    ) {

        return false;

    }


    // ========================================
    // RAPID SPAM
    // ========================================

    if (
        detectSpam(
            message
        )
    ) {

        await applyWarning(

            client,

            message,

            "Too many messages too quickly."

        );


        return true;

    }


    // ========================================
    // DUPLICATE SPAM
    // ========================================

    if (
        detectDuplicateSpam(
            message
        )
    ) {

        await applyWarning(

            client,

            message,

            "Repeated messages detected."

        );


        return true;

    }


    // ========================================
    // EXCESSIVE MENTIONS
    // ========================================

    if (
        hasExcessiveMentions(
            message
        )
    ) {

        await applyWarning(

            client,

            message,

            "Too many user mentions in one message."

        );


        return true;

    }


    // ========================================
    // DISCORD INVITE
    // ========================================

    if (
        containsSuspiciousLink(
            message.content
        )
    ) {

        await applyWarning(

            client,

            message,

            "Discord invite link detected."

        );


        return true;

    }


    return false;

}


// ========================================
// EXPORTS
// ========================================

module.exports = {

    initializeModerationSystem,

    moderateMessage,

    isModerator,

    getActiveWarningCount

};