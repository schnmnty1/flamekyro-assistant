const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { askAI } =
    require("../services/groq");

const {
    upsertUser
} = require("../services/memoryService");


// ========================================
// CONFIGURATION
// ========================================

const WELCOME_CHANNEL_ID =
    process.env.WELCOME_CHANNEL_ID;


// ========================================
// FIND CHANNEL BY NAME
// ========================================

function findChannel(
    guild,
    names
) {

    const normalizedNames =
        names.map(
            name =>
                name
                    .toLowerCase()
                    .replace(
                        /^[-_・#\s]+/,
                        ""
                    )
                    .trim()
        );


    return guild.channels.cache.find(
        channel => {

            if (
                !channel.isTextBased()
            ) {

                return false;

            }


            const channelName =
                channel.name
                    .toLowerCase()
                    .replace(
                        /^[-_・#\s]+/,
                        ""
                    )
                    .trim();


            return normalizedNames.includes(
                channelName
            );

        }
    );

}


// ========================================
// CREATE DISCORD CHANNEL LINK
// ========================================

function getChannelUrl(
    guildId,
    channelId
) {

    return (
        `https://discord.com/channels/` +
        `${guildId}/${channelId}`
    );

}


// ========================================
// GUILD MEMBER ADD EVENT
// ========================================

module.exports = {

    name:
        Events.GuildMemberAdd,


    async execute(member) {

        try {

            console.log(
                `👋 NEW MEMBER JOINED | ` +
                `User: ${member.user.tag} | ` +
                `ID: ${member.id} | ` +
                `Guild: ${member.guild.name}`
            );


            // ========================================
            // UPDATE MEMBER PROFILE
            // ========================================

            try {

                console.log(
                    "👤 Creating/updating member profile..."
                );


                await upsertUser(
                    member.user
                );


                console.log(
                    "✅ Member profile updated."
                );

            } catch (error) {

                console.error(
                    "❌ Failed to update member profile:",
                    error
                );

            }


            // ========================================
            // FIND WELCOME CHANNEL
            // ========================================

            if (
                !WELCOME_CHANNEL_ID
            ) {

                console.warn(
                    "⚠️ WELCOME_CHANNEL_ID is not configured."
                );

                return;

            }


            const welcomeChannel =
                member.guild.channels.cache.get(
                    WELCOME_CHANNEL_ID
                );


            if (
                !welcomeChannel
            ) {

                console.error(
                    `❌ Welcome channel not found: ${WELCOME_CHANNEL_ID}`
                );

                return;

            }


            // ========================================
            // FIND COMMUNITY CHANNELS
            // ========================================

            const rulesChannel =
                findChannel(

                    member.guild,

                    [
                        "rules",
                        "・rules",
                        "📜・rules",
                        "📖・rules"
                    ]

                );


            const rolesChannel =
                findChannel(

                    member.guild,

                    [
                        "roles",
                        "・roles",
                        "🎭・roles",
                        "🎮・roles"
                    ]

                );


            const generalChannel =
                findChannel(

                    member.guild,

                    [
                        "general",
                        "・general",
                        "💬・general"
                    ]

                );


            console.log(
                "🔎 Welcome navigation channels:"
            );


            console.log(
                `📜 Rules: ${
                    rulesChannel
                        ? rulesChannel.name
                        : "NOT FOUND"
                }`
            );


            console.log(
                `🎭 Roles: ${
                    rolesChannel
                        ? rolesChannel.name
                        : "NOT FOUND"
                }`
            );


            console.log(
                `💬 General: ${
                    generalChannel
                        ? generalChannel.name
                        : "NOT FOUND"
                }`
            );


            // ========================================
            // GENERATE PERSONALIZED WELCOME
            // ========================================

            console.log(
                "🤖 Generating personalized welcome..."
            );


            const welcomePrompt = `

Create a stylish Discord welcome message
for a new member joining FlameKyro.

Member:
- Display name: ${
    member.displayName ||
    member.user.username
}

Server:
- FlameKyro

Style:
- Gaming community
- Energetic
- Friendly
- Stylish
- Natural
- Short
- Professional but fun
- FlameKyro gaming brand

Rules:
- Welcome the member by display name.
- Mention FlameKyro as a gaming community.
- Make the member feel welcome.
- Encourage them to enjoy the community.
- Use a few gaming emojis.
- Keep it under 300 characters.
- Do NOT create channel names.
- Do NOT create channel links.
- Do NOT mention #rules.
- Do NOT mention #roles.
- Do NOT mention #general.
- Do NOT mention Discord IDs.
- Do NOT mention AI, bots, tools, databases or implementation details.
- Return ONLY the welcome text.

`;


            let aiWelcome = null;


            try {

                aiWelcome =
                    await askAI(

                        member.id,

                        welcomePrompt,

                        {

                            member,

                            guild:
                                member.guild,

                            channel:
                                welcomeChannel

                        }

                    );

            } catch (error) {

                console.error(
                    "❌ AI welcome generation failed:",
                    error
                );

            }


            // ========================================
            // FALLBACK WELCOME
            // ========================================

            if (
                !aiWelcome
            ) {

                aiWelcome =
                    `Welcome to FlameKyro! ` +
                    `We're glad to have you here. ` +
                    `Jump in, meet the community, ` +
                    `and have some fun! 🎮🔥`;

            }


            // ========================================
            // WELCOME EMBED
            // ========================================

            const welcomeEmbed =
                new EmbedBuilder()

                    .setTitle(
                        `🔥 Welcome to FlameKyro!`
                    )

                    .setDescription(

                        `Hey ${member},\n\n` +

                        `${aiWelcome}\n\n` +

                        `🎮 **Your next steps:**\n` +

                        `Get familiar with the server, ` +
                        `pick your roles and introduce yourself ` +
                        `to the community.\n\n` +

                        `🏆 **Live Streams • YouTube • ` +
                        `Tournaments • Giveaways**\n\n` +

                        `🔥 **GG & Have Fun!**`

                    )

                    .setThumbnail(
                        member.user.displayAvatarURL({
                            size: 256
                        })
                    )

                    .setFooter({

                        text:
                            "Team FlameKyro"

                    });


            // ========================================
            // NAVIGATION BUTTONS
            // ========================================

            const buttons = [];


            if (
                rulesChannel
            ) {

                buttons.push(

                    new ButtonBuilder()

                        .setLabel(
                            "📜 Rules"
                        )

                        .setStyle(
                            ButtonStyle.Link
                        )

                        .setURL(
                            getChannelUrl(
                                member.guild.id,
                                rulesChannel.id
                            )
                        )

                );

            }


            if (
                rolesChannel
            ) {

                buttons.push(

                    new ButtonBuilder()

                        .setLabel(
                            "🎭 Pick Roles"
                        )

                        .setStyle(
                            ButtonStyle.Link
                        )

                        .setURL(
                            getChannelUrl(
                                member.guild.id,
                                rolesChannel.id
                            )
                        )

                );

            }


            if (
                generalChannel
            ) {

                buttons.push(

                    new ButtonBuilder()

                        .setLabel(
                            "💬 Introduce Yourself"
                        )

                        .setStyle(
                            ButtonStyle.Link
                        )

                        .setURL(
                            getChannelUrl(
                                member.guild.id,
                                generalChannel.id
                            )
                        )

                );

            }


            // ========================================
            // ACTION ROW
            // ========================================

            const components = [];


            if (
                buttons.length
            ) {

                components.push(

                    new ActionRowBuilder()
                        .addComponents(
                            buttons
                        )

                );

            }


            // ========================================
            // SEND WELCOME
            // ========================================

            await welcomeChannel.send({

                embeds: [
                    welcomeEmbed
                ],

                components

            });


            console.log(
                `✅ Smart Welcome 2.0 sent for ${member.user.tag}`
            );


        } catch (error) {

            console.error(
                "❌ GuildMemberAdd handler error:",
                error
            );

        }

    }

};