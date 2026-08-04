const { SlashCommandBuilder } = require("discord.js");
const { askAI } = require("../services/groq");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Talk with FlameKyro AI")
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Ask anything")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const message = interaction.options.getString("message");

      const reply = await askAI(userId, message);

      await interaction.editReply(reply);
    } catch (error) {
      console.error(error);

      await interaction.editReply(
        "❌ Sorry Flame, I couldn't process your request."
      );
    }
  },
};