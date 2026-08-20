require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events
} = require("discord.js");

const {
    initializeDatabase
} = require("./services/database");


// ========================================
// OWO REMINDER SYSTEM
// ========================================

const {
    initializeOwoReminderSystem,
    trackOwoCommand,
    processOwoBotMessage,
    startOwoReminderScheduler
} = require("./services/owoReminderService");


// ========================================
// SMART MODERATION SYSTEM
// ========================================

const {
    initializeModerationSystem,
    moderateMessage
} = require("./services/moderationService");


// ========================================
// TOOL ENGINE
// ========================================

const toolRouter =
    require("./tools/toolRouter");


// Load tools
require("./tools/testTool");
require("./tools/serverInfoTool");
require("./tools/userInfoTool");


console.log(
    `🛠️ Tool Engine loaded with ${toolRouter.getTools().length} tool(s).`
);


// ========================================
// DISCORD CLIENT
// ========================================

const client =
    new Client({

        intents: [

            GatewayIntentBits.Guilds,

            // Required for GuildMemberAdd / Welcome system
            GatewayIntentBits.GuildMembers,

            GatewayIntentBits.GuildMessages,

            GatewayIntentBits.MessageContent

        ]

    });


client.commands =
    new Collection();


// ========================================
// LOAD SLASH COMMANDS
// ========================================

const commandsPath =
    path.join(
        __dirname,
        "commands"
    );


if (
    fs.existsSync(commandsPath)
) {

    const commandFiles =
        fs
            .readdirSync(commandsPath)
            .filter(
                file =>
                    file.endsWith(".js")
            );


    for (
        const file
        of commandFiles
    ) {

        try {

            const command =
                require(
                    path.join(
                        commandsPath,
                        file
                    )
                );


            if (
                !command?.data?.name
            ) {

                console.warn(
                    `⚠️ Skipping invalid command file: ${file}`
                );

                continue;

            }


            client.commands.set(
                command.data.name,
                command
            );


            console.log(
                `⚡ Command loaded: /${command.data.name}`
            );


        } catch (error) {

            console.error(
                `❌ Failed to load command: ${file}`,
                error
            );

        }

    }

}


// ========================================
// MESSAGE CREATE EVENT
// ========================================

const messageCreateEvent =
    require("./events/messageCreate");


console.log(
    `🔌 MessageCreate handler loaded: ${messageCreateEvent.name}`
);


// ========================================
// GUILD MEMBER ADD EVENT
// ========================================

const guildMemberAddEvent =
    require("./events/guildMemberAdd");


console.log(
    `👋 GuildMemberAdd handler loaded: ${guildMemberAddEvent.name}`
);


// ========================================
// READY EVENT
// ========================================

client.once(

    Events.ClientReady,

    async () => {

        console.log(
            `✅ Logged in as ${client.user.tag}`
        );


        console.log(
            `🏠 AI Channel configured: ${
                process.env.AI_CHANNEL_ID ||
                "NOT SET"
            }`
        );


        console.log(
            `👑 Owner ID configured: ${
                process.env.OWNER_USER_ID
                    ? "YES"
                    : "NO"
            }`
        );


        console.log(
            `🐮 OWO Reminder Channel configured: ${
                process.env.OWO_REMINDER_CHANNEL_ID ||
                process.env.AI_CHANNEL_ID ||
                "NOT SET"
            }`
        );


        // ========================================
        // MODERATION LOG CHANNEL
        // ========================================

        console.log(
            "Moderation Log Channel configured: " +
                (process.env.MODERATION_LOG_CHANNEL_ID || "NOT SET")
         );


        // ========================================
        // WELCOME CHANNEL
        // ========================================

        console.log(
            `👋 Welcome Channel configured: ${
                process.env.WELCOME_CHANNEL_ID ||
                "NOT SET"
            }`
        );


        // ========================================
        // DATABASE
        // ========================================

        try {

            await initializeDatabase();


            console.log(
                "🧠 Persistent memory system is ONLINE."
            );


        } catch (error) {

            console.error(
                "❌ Failed to initialize PostgreSQL:",
                error
            );


            console.warn(
                "⚠️ Persistent memory may be unavailable."
            );

        }


        // ========================================
        // MODERATION DATABASE
        // ========================================

        try {

            await initializeModerationSystem();


            console.log(
                "🛡️ Smart Moderation System is ONLINE."
            );


        } catch (error) {

            console.error(
                "❌ Moderation System initialization failed:",
                error
            );

        }


        // ========================================
        // OWO DATABASE
        // ========================================

        try {

            await initializeOwoReminderSystem();


            console.log(
                "🐮 OWO Reminder System is ONLINE."
            );


        } catch (error) {

            console.error(
                "❌ OWO Reminder System initialization failed:",
                error
            );

        }


        // ========================================
        // OWO SCHEDULER
        // ========================================

        try {

            startOwoReminderScheduler(
                client
            );


        } catch (error) {

            console.error(
                "❌ Failed to start OWO reminder scheduler:",
                error
            );

        }

    }

);


// ========================================
// GUILD MEMBER ADD
// ========================================

client.on(

    Events.GuildMemberAdd,

    async member => {

        console.log(
            `👋 NEW MEMBER EVENT | ` +
            `User: ${member.user.tag} | ` +
            `ID: ${member.id} | ` +
            `Guild: ${member.guild.name}`
        );


        try {

            await guildMemberAddEvent.execute(
                member
            );


        } catch (error) {

            console.error(
                "❌ GuildMemberAdd execution error:",
                error
            );

        }

    }

);


// ========================================
// MESSAGE CREATE
// ========================================

client.on(

    Events.MessageCreate,

    async message => {

        console.log(

            `📩 GLOBAL MESSAGE EVENT | ` +

            `User: ${
                message.author?.tag
            } | ` +

            `Channel: ${
                message.channel?.id
            } | ` +

            `Content: ${
                message.content
            }`

        );


        try {

            // ========================================
            // SMART MODERATION
            // ========================================

            const moderationTriggered =
                await moderateMessage(
                    client,
                    message
                );


            if (
                moderationTriggered
            ) {

                return;

            }


            // ========================================
            // PROCESS OWO BOT RESPONSE
            // ========================================

            await processOwoBotMessage(
                message
            );


            // ========================================
            // TRACK USER OWO COMMAND
            // ========================================

            await trackOwoCommand(
                message
            );


            // ========================================
            // EXISTING AI HANDLER
            // ========================================

            await messageCreateEvent.execute(
                message
            );


        } catch (error) {

            console.error(
                "❌ MESSAGE EVENT EXECUTION ERROR:",
                error
            );

        }

    }

);


// ========================================
// SLASH COMMANDS
// ========================================

client.on(

    Events.InteractionCreate,

    async interaction => {

        if (
            !interaction.isChatInputCommand()
        ) {

            return;

        }


        const command =
            client.commands.get(
                interaction.commandName
            );


        if (!command) {

            return;

        }


        try {

            await command.execute(
                interaction
            );


        } catch (error) {

            console.error(
                `❌ Slash command error: /${interaction.commandName}`,
                error
            );


            try {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({

                        content:
                            "❌ Something went wrong.",

                        ephemeral:
                            true

                    });


                } else {

                    await interaction.reply({

                        content:
                            "❌ Something went wrong.",

                        ephemeral:
                            true

                    });

                }


            } catch (replyError) {

                console.error(
                    "❌ Failed to send slash command error:",
                    replyError
                );

            }

        }

    }

);


// ========================================
// DISCORD CLIENT ERROR
// ========================================

client.on(

    Events.Error,

    error => {

        console.error(
            "❌ Discord client error:",
            error
        );

    }

);


// ========================================
// DISCORD WARNING
// ========================================

client.on(

    Events.Warn,

    warning => {

        console.warn(
            "⚠️ Discord warning:",
            warning
        );

    }

);


// ========================================
// UNHANDLED PROMISE
// ========================================

process.on(

    "unhandledRejection",

    error => {

        console.error(
            "❌ Unhandled Promise Rejection:",
            error
        );

    }

);


// ========================================
// UNCAUGHT EXCEPTION
// ========================================

process.on(

    "uncaughtException",

    error => {

        console.error(
            "❌ Uncaught Exception:",
            error
        );

    }

);


// ========================================
// START BOT
// ========================================

console.log(
    "🚀 Starting FlameKyro Assistant..."
);


client.login(
    process.env.DISCORD_TOKEN
);