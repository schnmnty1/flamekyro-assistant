const tools = new Map();

/**
 * Register a tool.
 *
 * Example:
 * registerTool("music", {
 *     description: "Controls music playback",
 *     execute: async (...) => {}
 * });
 */
function registerTool(name, tool) {
    if (!name || !tool || typeof tool.execute !== "function") {
        throw new Error(`Invalid tool registration: ${name}`);
    }

    tools.set(name, {
        name,
        description: tool.description || "",
        permissions: tool.permissions || [],
        execute: tool.execute
    });

    console.log(`🛠️ Tool registered: ${name}`);
}


/**
 * Check whether a user is allowed to use a tool.
 */
function hasPermission(member, tool) {

    if (!tool.permissions || tool.permissions.length === 0) {
        return true;
    }

    if (!member) {
        return false;
    }

    // Server owner always gets access
    if (member.guild?.ownerId === member.id) {
        return true;
    }

    // Discord Administrator permission
    if (member.permissions?.has("Administrator")) {
        return true;
    }

    // Check configured roles
    if (tool.permissions.includes("MANAGE_GUILD")) {
        return member.permissions?.has("ManageGuild") || false;
    }

    if (tool.permissions.includes("MODERATOR")) {
        return (
            member.permissions?.has("ManageMessages") ||
            member.permissions?.has("KickMembers") ||
            member.permissions?.has("BanMembers")
        );
    }

    return false;
}


/**
 * Execute a registered tool.
 */
async function executeTool(
    toolName,
    context = {}
) {

    const tool = tools.get(toolName);

    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
    }

    const {
        member,
        userId,
        guild,
        channel,
        args = {}
    } = context;

    console.log(
        `🧰 Tool requested: ${toolName} | User: ${userId || "unknown"}`
    );

    // Permission check
    if (!hasPermission(member, tool)) {

        console.warn(
            `🚫 Permission denied: ${toolName} | User: ${userId || "unknown"}`
        );

        return {
            success: false,
            error: "PERMISSION_DENIED",
            message:
                "भाई, तुम्हारे पास इस action को perform करने की permission नहीं है।"
        };
    }

    try {

        const result = await tool.execute({
            userId,
            member,
            guild,
            channel,
            args
        });

        console.log(
            `✅ Tool completed: ${toolName}`
        );

        return {
            success: true,
            result
        };

    } catch (error) {

        console.error(
            `❌ Tool failed: ${toolName}`,
            error
        );

        return {
            success: false,
            error: "TOOL_EXECUTION_FAILED",
            message:
                "इस action को perform करते समय technical problem आ गई।"
        };
    }
}


/**
 * Check whether a tool exists.
 */
function hasTool(name) {
    return tools.has(name);
}


/**
 * Get all registered tools.
 */
function getTools() {
    return Array.from(tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        permissions: tool.permissions
    }));
}


module.exports = {
    registerTool,
    executeTool,
    hasTool,
    getTools
};