const {
    registerTool
} = require("./toolRouter");


// ========================================
// SERVER INFO TOOL
// ========================================

registerTool("server_info", {

    description:
        "Gets live information about the current Discord server. Use this tool when the user asks about the server name, member count, channel count, server owner, or general server information. This tool does not require any arguments.",

    permissions: [],


    async execute({
        userId,
        member,
        guild,
        channel,
        args
    }) {

        console.log(
            "🔎 server_info: Starting server information lookup..."
        );


        // ========================================
        // VERIFY GUILD CONTEXT
        // ========================================

        if (!guild) {

            console.error(
                "❌ server_info: Guild context is missing."
            );

            return {

                success: false,

                error:
                    "GUILD_CONTEXT_MISSING",

                message:
                    "This tool can only be used inside a Discord server."

            };
        }


        console.log(
            `🏠 server_info: Guild = ${guild.name} (${guild.id})`
        );


        // ========================================
        // SERVER NAME
        // ========================================

        const serverName =
            guild.name || "Unknown";


        // ========================================
        // MEMBER COUNT
        // ========================================
        // Do NOT fetch every member.
        // Discord already provides the cached memberCount.

        const memberCount =
            guild.memberCount ?? null;


        // ========================================
        // CHANNEL COUNT
        // ========================================

        const channelCount =
            guild.channels?.cache?.size ?? 0;


        // ========================================
        // OWNER
        // ========================================

        const ownerId =
            guild.ownerId || null;


        // ========================================
        // REQUESTING USER
        // ========================================

        const requestedBy =
            userId || null;


        const requestedFromChannel =
            channel?.name || null;


        // ========================================
        // LOG RESULT
        // ========================================

        console.log(
            "📊 server_info result:",
            {
                serverName,
                memberCount,
                channelCount,
                ownerId
            }
        );


        // ========================================
        // RETURN RESULT
        // ========================================

        return {

            serverName,

            serverId:
                guild.id,

            memberCount,

            channelCount,

            ownerId,

            requestedBy,

            requestedFromChannel,

            message:
                `Live server information retrieved successfully for ${serverName}.`

        };

    }

});