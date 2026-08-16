require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events
} = require("discord.js");

const { initializeDatabase } = require("./services/database");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();


// ===============================
// LOAD COMMANDS
// ===============================

const commandsPath = path.join(__dirname, "commands");

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    if (command?.data?.name) {
        client.commands.set(command.data.name, command);
    }
}


// ===============================
// LOAD MESSAGE EVENT
// ===============================

const messageCreateEvent = require("./events/messageCreate");

console.log(
    `🔌 MessageCreate handler loaded: ${messageCreateEvent.name}`
);


// ===============================
// BOT READY
// ===============================

client.once(Events.ClientReady, async () => {

    console.log(
        `✅ Logged in as ${client.user.tag}`
    );

    console.log(
        `🏠 AI Channel configured: ${process.env.AI_CHANNEL_ID}`
    );

    console.log(
        `👑 Owner ID configured: ${process.env.OWNER_USER_ID ? "YES" : "NO"}`
    );

    try {

        await initializeDatabase();

        console.log(
            "🧠 Persistent memory system is ONLINE."
        );

    } catch (error) {

        console.error(
            "❌ Database initialization failed:",
            error
        );

        console.warn(
            "⚠️ Persistent memory is currently unavailable."
        );
    }
});


// ===============================
// MESSAGE CREATE DIAGNOSTIC
// ===============================

client.on(Events.MessageCreate, async (message) => {

    console.log(
        `📩 GLOBAL MESSAGE EVENT | User: ${message.author?.tag} | Channel: ${message.channel?.id} | Content: ${message.content}`
    );

    try {

        await messageCreateEvent.execute(message);

    } catch (error) {

        console.error(
            "❌ MESSAGE EVENT EXECUTION ERROR:",
            error
        );
    }
});


// ===============================
// SLASH COMMANDS
// ===============================

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isChatInputCommand()) {
        return;
    }

    const command = client.commands.get(
        interaction.commandName
    );

    if (!command) {
        return;
    }

    try {

        await command.execute(interaction);

    } catch (error) {

        console.error(
            "❌ Slash command error:",
            error
        );

        try {

            if (interaction.replied || interaction.deferred) {

                await interaction.followUp({
                    content: "❌ Something went wrong.",
                    ephemeral: true
                });

            } else {

                await interaction.reply({
                    content: "❌ Something went wrong.",
                    ephemeral: true
                });
            }

        } catch (replyError) {

            console.error(
                "❌ Failed to send slash command error:",
                replyError
            );
        }
    }
});


// ===============================
// DISCORD CLIENT ERRORS
// ===============================

client.on(Events.Error, error => {

    console.error(
        "❌ Discord client error:",
        error
    );
});

client.on(Events.Warn, warning => {

    console.warn(
        "⚠️ Discord warning:",
        warning
    );
});


// ===============================
// LOGIN
// ===============================

client.login(process.env.DISCORD_TOKEN);