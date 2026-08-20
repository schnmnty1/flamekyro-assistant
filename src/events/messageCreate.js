const { Events } = require("discord.js");

const { askAI } = require("../services/groq");

const {
    upsertUser,
    ensureOwnerIdentity
} = require("../services/memoryService");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {

        // Ignore bots
        if (message.author.bot) {

            console.log("⏭️ Ignoring bot message.");

            return;
        }


        // Only work inside AI Channel
        if (
            message.channel.id !==
            process.env.AI_CHANNEL_ID
        ) {

            return;
        }


        // Ignore empty messages
        if (!message.content.trim()) {

            return;
        }


        try {

            // ========================================
            // UPDATE DISCORD USER PROFILE
            // ========================================

            console.log(
                "👤 Updating user profile..."
            );

            await upsertUser(
                message.author
            );

            console.log(
                "✅ User profile updated."
            );


            // ========================================
            // VERIFY OWNER IDENTITY
            // ========================================

            console.log(
                "👑 Checking owner identity..."
            );

            const isOwner =
                await ensureOwnerIdentity(
                    message.author
                );

            console.log(
                `🔐 Owner verification result: ${isOwner}`
            );


            // ========================================
            // TYPING INDICATOR
            // ========================================

            console.log(
                "⌨️ Sending typing indicator..."
            );

            await message.channel.sendTyping();


            // ========================================
            // ASK AI
            // IMPORTANT:
            // Pass full Discord context to Tool Engine
            // ========================================

            console.log(
                "🤖 Sending message to AI..."
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
            // REPLY
            // ========================================

            console.log(
                "✅ AI response received."
            );

            console.log(
                "💬 Sending Discord reply..."
            );

            await message.reply(reply);

            console.log(
                "✅ Discord reply sent successfully."
            );


        } catch (error) {

            console.error(
                "❌ Message handler error:",
                error
            );


            try {

                await message.reply(
                    "❌ Sorry bro, kuch technical issue aa gaya. Thodi der baad try karna."
                );

            } catch (replyError) {

                console.error(
                    "❌ Failed to send error reply:",
                    replyError
                );

            }

        }

    }
};