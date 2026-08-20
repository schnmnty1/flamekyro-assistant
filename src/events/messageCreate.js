const { Events } = require("discord.js");

const { askAI } = require("../services/groq");

const {
    upsertUser,
    ensureOwnerIdentity
} = require("../services/memoryService");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {

        // ========================================
        // IGNORE BOTS
        // ========================================

        if (message.author.bot) {
            console.log("Ignoring bot message.");
            return;
        }

        // ========================================
        // ONLY WORK INSIDE AI CHANNEL
        // ========================================

        if (
            message.channel.id !==
            process.env.AI_CHANNEL_ID
        ) {
            return;
        }

        // ========================================
        // IGNORE EMPTY MESSAGES
        // ========================================

        if (!message.content.trim()) {
            return;
        }

        try {

            // ========================================
            // UPDATE DISCORD USER PROFILE
            // ========================================

            console.log(
                "Updating user profile..."
            );

            await upsertUser(
                message.author
            );

            console.log(
                "User profile updated."
            );

            // ========================================
            // VERIFY OWNER IDENTITY
            // ========================================

            console.log(
                "Checking owner identity..."
            );

            const isOwner =
                await ensureOwnerIdentity(
                    message.author
                );

            console.log(
                `Owner verification result: ${isOwner}`
            );

            // ========================================
            // TYPING INDICATOR
            // ========================================

            console.log(
                "Sending typing indicator..."
            );

            await message.channel.sendTyping();

            // ========================================
            // ASK AI
            // IMPORTANT:
            // Pass full Discord context to Tool Engine
            // ========================================

            console.log(
                "Sending message to AI..."
            );

            const reply =
                await askAI(
                    message.author.id,
                    message.content,
                    {
                        member: message.member,
                        guild: message.guild,
                        channel: message.channel
                    }
                );

            // ========================================
            // DISCORD OUTPUT NORMALIZER
            //
            // Converts our internal channel markers
            // into native Discord clickable mentions.
            //
            // Example:
            // [[DISCORD_CHANNEL:123456789]]
            //
            // becomes:
            // <#123456789>
            // ========================================

            let finalReply =
                typeof reply === "string"
                    ? reply
                    : String(reply ?? "");

            finalReply =
                finalReply.replace(
                    /\[\[DISCORD_CHANNEL:(\d{17,20})\]\]/g,
                    "<#$1>"
                );

            // ========================================
            // SAFETY: REMOVE ACCIDENTAL MARKDOWN
            // GENERATED AROUND OUR CHANNEL MARKERS
            //
            // This only targets the Discord asset-link
            // pattern that we have observed in the AI
            // response. It does NOT rewrite normal URLs.
            // ========================================

            finalReply =
                finalReply.replace(
                    /\[#\s*(?:<a?:[^>]+>|:[^:\s]+:)?\]\(https:\/\/discord\.com\/assets\/[^)]+\)/gi,
                    "#"
                );

            // ========================================
            // REPLY
            // ========================================

            console.log(
                "AI response received."
            );

            console.log(
                "Discord reply after formatting:",
                finalReply
            );

            console.log(
                "Sending Discord reply..."
            );

            await message.reply(
                finalReply
            );

            console.log(
                "Discord reply sent successfully."
            );

        } catch (error) {

            console.error(
                "Message handler error:",
                error
            );

            try {

                await message.reply(
                    "❌ Sorry bro, kuch technical issue aa gaya. Thodi der baad try karna."
                );

            } catch (replyError) {

                console.error(
                    "Failed to send error reply:",
                    replyError
                );

            }
        }
    }
};