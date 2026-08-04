const { Events } = require("discord.js");
const { askAI } = require("../services/groq");

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {

        // Ignore bots
        if (message.author.bot) return;

        // Only work inside AI Channel
        if (message.channel.id !== process.env.AI_CHANNEL_ID) return;

        // Ignore empty messages
        if (!message.content.trim()) return;

        try {

            // Show typing indicator
            await message.channel.sendTyping();

            // Ask AI
            const reply = await askAI(
                message.author.id,
                message.content
            );

            // Reply
            await message.reply(reply);

        } catch (error) {

            console.error(error);

            await message.reply(
                "❌ Sorry bro, kuch technical issue aa gaya. Thodi der baad try karna."
            );

        }

    }
};