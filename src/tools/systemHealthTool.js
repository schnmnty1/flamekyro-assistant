const toolRouter = require("./toolRouter");
const { query, getPool } = require("../services/database");

const SYSTEM_HEALTH_TOOL = "system_health";

toolRouter.registerTool(SYSTEM_HEALTH_TOOL, {
    description:
        "Run an owner-only FlameKyro system health audit. Checks Discord server, PostgreSQL, memory tables, moderation/OWO configuration, registered AI tools, and bot permissions. Never exposes secrets. When reporting configured Discord channels, preserve the provided Discord channel markers exactly and never convert them into URLs or Markdown links.",

    permissions: ["MANAGE_GUILD"],

    execute: async ({ userId, member, guild }) => {
        const checks = [];
        const startedAt = Date.now();

        // ========================================
        // 1. DISCORD SERVER
        // ========================================

        let serverCheck = {
            system: "Discord Server",
            status: "FAIL",
            details: "Discord server information unavailable."
        };

        try {
            if (guild) {
                serverCheck = {
                    system: "Discord Server",
                    status: "PASS",
                    details:
                        `Live guild data available. ` +
                        `Name: ${guild.name} | ` +
                        `ID: ${guild.id} | ` +
                        `Members: ${guild.memberCount ?? "N/A"} | ` +
                        `Channels: ${guild.channels?.cache?.size ?? "N/A"}`
                };
            }
        } catch (error) {
            serverCheck.details =
                "Failed to read Discord guild information.";
        }

        checks.push(serverCheck);

        // ========================================
        // 2. OWNER VERIFICATION
        // ========================================

        let ownerCheck = {
            system: "Owner Identity",
            status: "FAIL",
            details:
                "Owner verification could not be completed."
        };

        try {
            const configuredOwnerId =
                process.env.OWNER_USER_ID || null;

            const guildOwnerId =
                guild?.ownerId || null;

            const verified =
                Boolean(configuredOwnerId) &&
                Boolean(guildOwnerId) &&
                configuredOwnerId === guildOwnerId &&
                userId === configuredOwnerId;

            ownerCheck = {
                system: "Owner Identity",
                status: verified ? "PASS" : "FAIL",
                details: verified
                    ? "Requesting user matches configured server owner."
                    : "Owner identity verification failed."
            };
        } catch (error) {
            ownerCheck.details =
                "Owner verification failed due to an internal error.";
        }

        checks.push(ownerCheck);

        // ========================================
        // 3. POSTGRESQL
        // ========================================

        let databaseConnected = false;

        try {
            const db = getPool();

            if (!db) {
                checks.push({
                    system: "PostgreSQL",
                    status: "FAIL",
                    details:
                        "DATABASE_URL is not configured."
                });
            } else {
                const dbStartedAt = Date.now();

                const result = await query(
                    "SELECT NOW() AS server_time"
                );

                const latency =
                    Date.now() - dbStartedAt;

                if (result?.rows?.length) {
                    databaseConnected = true;

                    checks.push({
                        system: "PostgreSQL",
                        status: "PASS",
                        details:
                            `Database connection and live query successful. ` +
                            `Latency: ${latency}ms`
                    });
                } else {
                    checks.push({
                        system: "PostgreSQL",
                        status: "FAIL",
                        details:
                            "Database query returned no result."
                    });
                }
            }
        } catch (error) {
            checks.push({
                system: "PostgreSQL",
                status: "FAIL",
                details:
                    `Database query failed: ${error.message}`
            });
        }

        // ========================================
        // 4. DATABASE TABLES
        // ========================================

        if (databaseConnected) {
            const requiredTables = [
                "users",
                "memories"
            ];

            for (const table of requiredTables) {
                try {
                    const result = await query(
                        `
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = $1
                        ) AS exists
                        `,
                        [table]
                    );

                    const exists =
                        result?.rows?.[0]?.exists === true;

                    checks.push({
                        system:
                            `Database Table: ${table}`,
                        status:
                            exists ? "PASS" : "FAIL",
                        details: exists
                            ? "Table exists in PostgreSQL."
                            : "Required table does not exist."
                    });
                } catch (error) {
                    checks.push({
                        system:
                            `Database Table: ${table}`,
                        status: "FAIL",
                        details:
                            `Table check failed: ${error.message}`
                    });
                }
            }

            // ========================================
            // 5. DATABASE RECORD COUNTS
            // ========================================

            try {
                const usersResult = await query(
                    "SELECT COUNT(*)::int AS count FROM users"
                );

                const memoriesResult = await query(
                    "SELECT COUNT(*)::int AS count FROM memories"
                );

                checks.push({
                    system: "Memory Data",
                    status: "PASS",
                    details:
                        `Users: ${usersResult?.rows?.[0]?.count ?? 0} | ` +
                        `Memories: ${memoriesResult?.rows?.[0]?.count ?? 0}`
                });
            } catch (error) {
                checks.push({
                    system: "Memory Data",
                    status: "FAIL",
                    details:
                        `Could not read memory statistics: ${error.message}`
                });
            }
        }

        // ========================================
        // 6. CONFIGURED CHANNELS
        // ========================================

        const channelConfigs = [
            {
                name: "AI Channel",
                env: "AI_CHANNEL_ID"
            },
            {
                name: "Welcome Channel",
                env: "WELCOME_CHANNEL_ID"
            },
            {
                name: "OWO Reminder Channel",
                env: "OWO_REMINDER_CHANNEL_ID"
            },
            {
                name: "Moderation Log Channel",
                env: "MODERATION_LOG_CHANNEL_ID"
            }
        ];

        for (const config of channelConfigs) {
            const channelId =
                process.env[config.env] || null;

            let status = "FAIL";
            let details =
                "Channel ID is not configured.";

            if (channelId) {
                const channel =
                    guild?.channels?.cache?.get(channelId);

                if (channel) {
                    status = "PASS";

                    const channelMention =
                        `<#${channel.id}>`;

                    const channelMarker =
                        `[[DISCORD_CHANNEL:${channel.id}]]`;

                    details =
                        `Configured and accessible. ` +
                        `Channel: ${channelMarker}`;

                    checks.push({
                        system: config.name,
                        status,
                        details,
                        channelId: channel.id,
                        channelMention,
                        channelMarker,
                        channelName: channel.name
                    });

                    continue;
                }

                status = "FAIL";
                details =
                    `Configured ID ${channelId} could not be resolved in this guild.`;
            }

            checks.push({
                system: config.name,
                status,
                details
            });
        }

        // ========================================
        // 7. REGISTERED AI TOOLS
        // ========================================

        try {
            const tools =
                toolRouter.getTools();

            const toolNames =
                tools.map(tool => tool.name);

            checks.push({
                system: "AI Tool Engine",
                status:
                    tools.length > 0
                        ? "PASS"
                        : "FAIL",
                details:
                    `${tools.length} registered tool(s): ` +
                    `${toolNames.join(", ") || "none"}`
            });
        } catch (error) {
            checks.push({
                system: "AI Tool Engine",
                status: "FAIL",
                details:
                    `Could not inspect tools: ${error.message}`
            });
        }

        // ========================================
        // 8. BOT PERMISSIONS
        // ========================================

        try {
            if (member) {
                const permissions =
                    member.permissions;

                const administrator =
                    permissions?.has("Administrator") ||
                    false;

                const manageGuild =
                    permissions?.has("ManageGuild") ||
                    false;

                const manageMessages =
                    permissions?.has("ManageMessages") ||
                    false;

                checks.push({
                    system:
                        "Bot/User Permissions",
                    status:
                        administrator ||
                        manageGuild ||
                        manageMessages
                            ? "PASS"
                            : "FAIL",
                    details:
                        `Administrator: ${administrator ? "YES" : "NO"} | ` +
                        `ManageGuild: ${manageGuild ? "YES" : "NO"} | ` +
                        `ManageMessages: ${manageMessages ? "YES" : "NO"}`
                });
            } else {
                checks.push({
                    system:
                        "Bot/User Permissions",
                    status:
                        "NOT VERIFIED",
                    details:
                        "Discord member object was unavailable."
                });
            }
        } catch (error) {
            checks.push({
                system:
                    "Bot/User Permissions",
                status:
                    "NOT VERIFIED",
                details:
                    "Permission inspection failed."
            });
        }

        // ========================================
        // 9. ENVIRONMENT CONFIGURATION
        // ========================================

        const environmentChecks = [
            ["Discord Token", "DISCORD_TOKEN"],
            ["Groq API Key", "GROQ_API_KEY"],
            ["Owner ID", "OWNER_USER_ID"],
            ["Database URL", "DATABASE_URL"]
        ];

        for (const [name, env] of environmentChecks) {
            checks.push({
                system:
                    `Configuration: ${name}`,
                status:
                    process.env[env]
                        ? "PASS"
                        : "FAIL",
                details:
                    process.env[env]
                        ? "Configured."
                        : "Not configured."
            });
        }

        // ========================================
        // OVERALL STATUS
        // ========================================

        const failed =
            checks.filter(
                check =>
                    check.status === "FAIL"
            );

        const notVerified =
            checks.filter(
                check =>
                    check.status === "NOT VERIFIED"
            );

        let overallStatus =
            "HEALTHY";

        if (failed.length > 0) {
            overallStatus =
                "DEGRADED";
        }

        if (failed.length >= 3) {
            overallStatus =
                "CRITICAL";
        }

        const duration =
            Date.now() - startedAt;

        console.log(
            `System health audit completed | ` +
            `User: ${userId} | ` +
            `Status: ${overallStatus} | ` +
            `Duration: ${duration}ms`
        );

        return {
            success: true,
            overallStatus,
            durationMs: duration,

            summary: {
                totalChecks:
                    checks.length,

                passed:
                    checks.filter(
                        check =>
                            check.status === "PASS"
                    ).length,

                failed:
                    failed.length,

                notVerified:
                    notVerified.length
            },

            checks
        };
    }
});

console.log(
    "System Health tool registered."
);