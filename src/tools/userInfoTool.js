const {
    registerTool
} = require("./toolRouter");


// ========================================
// USER INFO TOOL
// ========================================

registerTool("user_info", {

    description:
        "Gets live information about a Discord server member. Use this tool when the user asks about a specific member or Discord user. If a user_id is provided, use it. If no user_id is provided, return information about the person making the request.",

    permissions: [],


    async execute({
        userId,
        member,
        guild,
        channel,
        args
    }) {

        console.log(
            "🔎 user_info: Starting user information lookup..."
        );


        // ========================================
        // VERIFY GUILD CONTEXT
        // ========================================

        if (!guild) {

            console.error(
                "❌ user_info: Guild context is missing."
            );

            return {

                success: false,

                error:
                    "GUILD_CONTEXT_MISSING",

                message:
                    "This tool can only be used inside a Discord server."

            };

        }


        // ========================================
        // DETERMINE TARGET USER
        // ========================================

        const requestedUserId =
            args?.user_id ||
            args?.userId ||
            userId;


        if (!requestedUserId) {

            return {

                success: false,

                error:
                    "USER_ID_MISSING",

                message:
                    "A Discord user ID is required."

            };

        }


        console.log(
            `🔎 user_info: Looking up user ${requestedUserId}`
        );


        // ========================================
        // FETCH MEMBER
        // ========================================

        let targetMember;


        try {

            targetMember =
                await guild.members.fetch(
                    requestedUserId
                );

        } catch (error) {

            console.error(
                `❌ user_info: Could not find member ${requestedUserId}`,
                error.message
            );


            return {

                success: false,

                error:
                    "MEMBER_NOT_FOUND",

                message:
                    "That user could not be found in this Discord server."

            };

        }


        // ========================================
        // BASIC INFORMATION
        // ========================================

        const username =
            targetMember.user?.username ||
            null;


        const displayName =
            targetMember.displayName ||
            targetMember.user?.globalName ||
            username ||
            null;


        const nickname =
            targetMember.nickname ||
            null;


        const isBot =
            targetMember.user?.bot === true;


        // ========================================
        // ROLES
        // ========================================

        const roles =
            targetMember.roles?.cache
                ?.filter(role => role.id !== guild.id)
                ?.map(role => role.name)
                || [];


        // ========================================
        // JOIN DATE
        // ========================================

        const joinedAt =
            targetMember.joinedAt
                ? targetMember.joinedAt.toISOString()
                : null;


        // ========================================
        // SERVER OWNER
        // ========================================

        const isServerOwner =
            guild.ownerId ===
            targetMember.id;


        // ========================================
        // SERVER ADMIN
        // ========================================

        const isAdministrator =
            targetMember.permissions?.has(
                "Administrator"
            ) || false;


        // ========================================
        // RESULT
        // ========================================

        const result = {

            userId:
                targetMember.id,

            username,

            displayName,

            nickname,

            isBot,

            isServerOwner,

            isAdministrator,

            roles,

            joinedAt

        };


        console.log(
            "📊 user_info result:",
            result
        );


        return result;

    }

});