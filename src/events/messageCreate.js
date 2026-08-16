const { Events } = require("discord.js");

const { askAI } = require("../services/groq");

const {
    upsertUser,
    ensureOwnerIdentity
} = require("../services/memoryService");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {

        console.log(
            `📩 Message event received | User: ${message.author?.tag} | Channel: ${message.channel?.id}`
        );

        // Ignore bots
        if (message.author.bot) {
            console.log("⏭️ Ignoring bot message.");
            return;
        }

        // Check AI channel
        if (message.channel.id !== process.env.AI_CHANNEL_ID) {
            console.log(
                `⏭️ Wrong channel. Received: ${message.channel.id} | Expected: ${process.env.AI_CHANNEL_ID}`
            );
            return;
        }

        // Ignore empty messages
        if (!message.content?.trim()) {
            console.log("⏭️ Empty message ignored.");
            return;
        }

        console.log(`💬 User message: ${message.content}`);

        try {

            // Update Discord user profile
            console.log("👤 Updating user profile...");

            await upsertUser(message.author);

            console.log("✅ User profile updated.");

            // Verify Flame's owner identity
            console.log("👑 Checking owner identity...");

            const isOwner = await ensureOwnerIdentity(message.author);

            console.log(`🔐 Owner verification result: ${isOwner}`);

            // Show typing indicator
            console.log("⌨️ Sending typing indicator...");

            await message.channel.sendTyping();

            // Ask AI
            console.log("🤖 Sending message to AI...");

            const reply = await askAI(
                message.author.id,
                message.content
            );

            console.log("✅ AI response received.");

            // Reply
            console.log("💬 Sending Discord reply...");

            await message.reply(reply);

            console.log("✅ Discord reply sent successfully.");

        } catch (error) {

            console.error("❌ MESSAGE HANDLER ERROR:", error);

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