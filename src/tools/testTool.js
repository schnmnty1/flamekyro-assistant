const {
    registerTool
} = require("./toolRouter");


registerTool("test", {

    description:
        "Internal test tool used to verify the FlameKyro Tool Engine.",

    permissions: [],

    async execute({
        userId,
        guild,
        channel,
        args
    }) {

        return {
            message: "FlameKyro Tool Engine is working.",
            userId,
            guildId: guild?.id || null,
            channelId: channel?.id || null,
            args
        };
    }
});