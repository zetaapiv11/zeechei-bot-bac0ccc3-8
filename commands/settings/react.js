// ============================================================
// ZEECHEI REACT SYSTEM
// File: commands/general/react.js
//
// Zeechei-compatible Auto Reactor
//
// Features:
// .react add <user>
// .react remove <user>
// .react list
// .react emoji add <emoji>
// .react emoji remove <emoji>
// .react emoji list
// .react on
// .react off
// .react test <user>
// .react clear
// .react
//
// Permission source:
// - Zeechei Main Owner
// - Zeechei Owners
// - Zeechei Developers
// - Zeechei Core Team
//
// Persistent config:
// data/zeechei_react.json
// ============================================================

const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    PermissionsBitField,
} = require("discord.js");

const config = require("../../config");
const Database = require("../../database/Database");

// ============================================================
// EMOJIS
// Change these whenever you want
// ============================================================

const E = {
    success: "<:check:1550872076104245271>",
    error: "<:cross:1550532309894045846>",
    warning: "<:warning:1550824858516979884>",
    info: "<:info2:1550792669008240681>",
    react: "<:reaction:1551655913054543962>",
    owner: "<:owner:1530629789616963594>",
    developer: "<:dev:1551210468474101832>",
    core: "<:core:1551445203645112370>",
    target: "<a:target:1551655978112520202>",
    emoji: "<a:emojis:1550826143320514600>",
    list: "<:List:1551447040834412554>",
    enabled: "<:enabled:1550823547633537166>",
    disabled: "<a:disabled1:1550533140282482739>",
    clear: "<:removed:1550922830009339904>",
    add: "<:_add:1551445983647498321>",
    remove: "<:remove:1551446095278645291>",
    test: "<:901_flower:1550922516862603329>",
};

// ============================================================
// PATHS
// ============================================================

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "zeechei_react.json");

// ============================================================
// DEFAULT DATABASE
// ============================================================

const DEFAULT_DATA = {
    enabled: true,

    // Users whose messages/mentions should trigger reactions
    targets: [],

    // Emojis used for auto reaction
    emojis: [],

    // Optional per-target custom emojis
    // {
    //   "USER_ID": ["❤️", "🔥"]
    // }
    targetEmojis: {},

    // Guild-specific targets
    guildTargets: {},

    // Guild-specific emoji lists
    guildEmojis: {},
};

// ============================================================
// FILE HELPERS
// ============================================================

function ensureDataFile() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, {
                recursive: true,
            });
        }

        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(DEFAULT_DATA, null, 2),
                "utf8"
            );
        }
    } catch (error) {
        console.error("[Zeechei React] Failed to create data file:", error);
    }
}

function loadData() {
    ensureDataFile();

    try {
        const raw = fs.readFileSync(DATA_FILE, "utf8");

        const parsed = JSON.parse(raw);

        return {
            ...DEFAULT_DATA,
            ...parsed,

            targets: Array.isArray(parsed.targets)
                ? parsed.targets
                : [],

            emojis: Array.isArray(parsed.emojis)
                ? parsed.emojis
                : [],

            targetEmojis:
                parsed.targetEmojis &&
                typeof parsed.targetEmojis === "object"
                    ? parsed.targetEmojis
                    : {},

            guildTargets:
                parsed.guildTargets &&
                typeof parsed.guildTargets === "object"
                    ? parsed.guildTargets
                    : {},

            guildEmojis:
                parsed.guildEmojis &&
                typeof parsed.guildEmojis === "object"
                    ? parsed.guildEmojis
                    : {},
        };
    } catch (error) {
        console.error("[Zeechei React] Failed to read data:", error);

        return {
            ...DEFAULT_DATA,
        };
    }
}

function saveData(data) {
    ensureDataFile();

    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        return true;
    } catch (error) {
        console.error("[Zeechei React] Failed to save data:", error);

        return false;
    }
}

// ============================================================
// BASIC HELPERS
// ============================================================

function unique(array) {
    return [...new Set(array)];
}

function isSnowflake(value) {
    return /^\d{15,25}$/.test(String(value));
}

function extractIds(value) {
    const ids = [];

    if (!value) return ids;

    if (typeof value === "string" || typeof value === "number") {
        const id = String(value);

        if (isSnowflake(id)) {
            ids.push(id);
        }

        return ids;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            ids.push(...extractIds(item));
        }

        return unique(ids);
    }

    if (typeof value === "object") {
        // Object keyed by Discord IDs
        for (const [key, item] of Object.entries(value)) {
            if (isSnowflake(key)) {
                ids.push(key);
            }

            if (
                typeof item === "string" ||
                typeof item === "number"
            ) {
                if (isSnowflake(item)) {
                    ids.push(String(item));
                }
            } else if (
                item &&
                typeof item === "object"
            ) {
                if (item.userId && isSnowflake(item.userId)) {
                    ids.push(String(item.userId));
                }

                if (item.id && isSnowflake(item.id)) {
                    ids.push(String(item.id));
                }
            }
        }
    }

    return unique(ids);
}

// ============================================================
// CONFIG ID HELPERS
// ============================================================

function getMainOwnerId() {
    const id =
        config.mainOwnerId ||
        config.ownerId ||
        config.owner ||
        null;

    return isSnowflake(id) ? String(id) : null;
}

function getConfigOwnerIds() {
    return unique(
        extractIds(
            config.ownerIds ||
            config.owners ||
            []
        )
    );
}

// ============================================================
// DATABASE TEAM HELPERS
// ============================================================

function getDatabaseOwners() {
    try {
        if (typeof Database.getOwners === "function") {
            return extractIds(Database.getOwners());
        }
    } catch (error) {
        console.error(
            "[Zeechei React] Database.getOwners failed:",
            error
        );
    }

    return [];
}

function getDatabaseDevelopers() {
    try {
        if (typeof Database.getDevelopers !== "function") {
            return [];
        }

        const developers = Database.getDevelopers();

        if (!Array.isArray(developers)) {
            return extractIds(developers);
        }

        return unique(
            developers
                .filter((dev) => {
                    if (!dev) return false;

                    // Disabled developers should not receive
                    // developer-level React permissions.
                    if (
                        Object.prototype.hasOwnProperty.call(
                            dev,
                            "enabled"
                        )
                    ) {
                        return dev.enabled !== false;
                    }

                    return true;
                })
                .map((dev) => {
                    if (typeof dev === "string") {
                        return dev;
                    }

                    return (
                        dev.userId ||
                        dev.id ||
                        null
                    );
                })
                .filter(isSnowflake)
                .map(String)
        );
    } catch (error) {
        console.error(
            "[Zeechei React] Database.getDevelopers failed:",
            error
        );

        return [];
    }
}

// ============================================================
// ZEECHEI SYSTEM / CORE TEAM
// ============================================================

function loadZeecheiSystem() {
    const possibleFiles = [
        path.join(process.cwd(), "data", "al_system.json"),
        path.join(process.cwd(), "data", "zeechei_system.json"),
    ];

    for (const file of possibleFiles) {
        try {
            if (!fs.existsSync(file)) continue;

            const raw = fs.readFileSync(file, "utf8");

            const data = JSON.parse(raw);

            if (data && typeof data === "object") {
                return data;
            }
        } catch (error) {
            console.error(
                `[Zeechei React] Failed reading ${file}:`,
                error
            );
        }
    }

    return {};
}

function getCoreTeamIds() {
    const system = loadZeecheiSystem();

    return unique(
        extractIds(
            system.coreTeam ||
            system.core_team ||
            system.coreteam ||
            system.team?.coreTeam ||
            system.team?.core_team ||
            []
        )
    );
}

// ============================================================
// ZEECHEI LIVE TEAM
//
// Priority:
//
// MAIN OWNER
//      ↓
// CORE TEAM
//      ↓
// DEVELOPER
//      ↓
// OWNER
//
// This prevents a Core Team/Developer from being incorrectly
// shown as an Owner when the same ID exists in owner storage.
// ============================================================

function getZeecheiTeam() {
    const mainOwner = getMainOwnerId();

    const coreTeam = getCoreTeamIds();

    const developers = getDatabaseDevelopers();

    const owners = unique([
        ...getConfigOwnerIds(),
        ...getDatabaseOwners(),
    ]);

    const used = new Set();

    const result = {
        mainOwner: [],
        coreTeam: [],
        developers: [],
        owners: [],
    };

    // Main Owner
    if (mainOwner) {
        result.mainOwner.push(mainOwner);
        used.add(mainOwner);
    }

    // Core Team
    for (const id of coreTeam) {
        if (used.has(id)) continue;

        result.coreTeam.push(id);
        used.add(id);
    }

    // Developers
    for (const id of developers) {
        if (used.has(id)) continue;

        result.developers.push(id);
        used.add(id);
    }

    // Owners
    for (const id of owners) {
        if (used.has(id)) continue;

        result.owners.push(id);
        used.add(id);
    }

    return result;
}

// ============================================================
// PERMISSION CHECK
// ============================================================

function getTeamRole(userId) {
    const id = String(userId);

    const team = getZeecheiTeam();

    if (team.mainOwner.includes(id)) {
        return "main_owner";
    }

    if (team.coreTeam.includes(id)) {
        return "core_team";
    }

    if (team.developers.includes(id)) {
        return "developer";
    }

    if (team.owners.includes(id)) {
        return "owner";
    }

    return null;
}

function canManageReact(userId) {
    return Boolean(getTeamRole(userId));
}

// ============================================================
// EMOJI VALIDATION
// ============================================================

function isCustomEmoji(value) {
    return /^<a?:[\w~\-]+:\d{15,25}>$/.test(
        String(value)
    );
}

function isValidEmoji(value) {
    if (!value) return false;

    const emoji = String(value).trim();

    // Custom Discord emoji
    if (isCustomEmoji(emoji)) {
        return true;
    }

    // Normal Unicode emoji
    // Keep this intentionally permissive.
    return emoji.length >= 1 && emoji.length <= 100;
}

// ============================================================
// EMOJI RESOLUTION
// ============================================================

function getGuildEmojis(guildId, data) {
    if (!guildId) {
        return data.emojis || [];
    }

    const guildList = data.guildEmojis?.[guildId];

    if (Array.isArray(guildList)) {
        return guildList;
    }

    return data.emojis || [];
}

function getTargetEmojis(guildId, userId, data) {
    const custom =
        data.targetEmojis?.[String(userId)];

    if (Array.isArray(custom) && custom.length > 0) {
        return custom;
    }

    return getGuildEmojis(guildId, data);
}

function getTargets(guildId, data) {
    if (
        guildId &&
        Array.isArray(data.guildTargets?.[guildId])
    ) {
        return data.guildTargets[guildId];
    }

    return data.targets || [];
}

// ============================================================
// SAFE REACTION
// ============================================================

async function safeReact(message, emoji) {
    try {
        await message.react(emoji);

        return true;
    } catch (error) {
        // Discord rate limit
        if (
            error?.status === 429 ||
            error?.code === 429
        ) {
            const retry =
                Number(error.retry_after || 1000);

            await new Promise((resolve) =>
                setTimeout(
                    resolve,
                    Math.min(retry, 10000)
                )
            );

            try {
                await message.react(emoji);
                return true;
            } catch {
                return false;
            }
        }

        return false;
    }
}

// ============================================================
// SEND RESPONSE
// ============================================================

async function sendResult(ctx, title, description) {
    const embed = new EmbedBuilder()
        .setColor(0xffffff)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    return ctx.reply({
        embeds: [embed],
        allowedMentions: {
            parse: [],
        },
    });
}

// ============================================================
// TARGET RESOLUTION
// ============================================================

async function resolveUser(ctx, input) {
    if (!input) return null;

    const id = String(input)
        .replace(/[<@!>]/g, "")
        .trim();

    if (!isSnowflake(id)) {
        return null;
    }

    try {
        const member =
            ctx.guild?.members.cache.get(id);

        if (member) {
            return member.user;
        }

        return await ctx.client.users.fetch(id);
    } catch {
        return null;
    }
}

// ============================================================
// MAIN COMMAND
// ============================================================

async function execute({ client, message, args }) {
    const ctx = message;

    // --------------------------------------------------------
    // Permission
    // --------------------------------------------------------

    if (!canManageReact(ctx.author.id)) {
        return sendResult(
            ctx,
            `${E.error} React System`,
            `${E.error} You don't have permission to manage Zeechei's React system.`
        );
    }

    const data = loadData();

    const sub =
        String(args?.[0] || "help")
            .toLowerCase();

    // ========================================================
    // .react
    // ========================================================

    if (
        sub === "help" ||
        sub === "menu"
    ) {
        const role =
            getTeamRole(ctx.author.id);

        return sendResult(
            ctx,
            `${E.react} Zeechei React System`,
            [
                `**Your Team Role:** \`${role}\``,
                "",
                `**Target Management**`,
                `\`.react add @user\``,
                `\`.react remove @user\``,
                `\`.react list\``,
                "",
                `**Emoji Management**`,
                `\`.react emoji add <emoji>\``,
                `\`.react emoji remove <emoji>\``,
                `\`.react emoji list\``,
                "",
                `**System**`,
                `\`.react on\``,
                `\`.react off\``,
                `\`.react test @user\``,
                `\`.react clear\``,
                "",
                `**Auto Reactor:** ${
                    data.enabled
                        ? `${E.enabled} ON`
                        : `${E.disabled} OFF`
                }`,
            ].join("\n")
        );
    }

    // ========================================================
    // ON
    // ========================================================

    if (sub === "on" || sub === "enable") {
        data.enabled = true;

        saveData(data);

        return sendResult(
            ctx,
            `${E.enabled} React Enabled`,
            `${E.success} Zeechei Auto Reactor has been enabled.`
        );
    }

    // ========================================================
    // OFF
    // ========================================================

    if (sub === "off" || sub === "disable") {
        data.enabled = false;

        saveData(data);

        return sendResult(
            ctx,
            `${E.disabled} React Disabled`,
            `${E.success} Zeechei Auto Reactor has been disabled.`
        );
    }

    // ========================================================
    // ADD TARGET
    // ========================================================

    if (
        sub === "add" ||
        sub === "target"
    ) {
        const input = args?.[1];

        const user =
            await resolveUser(ctx, input);

        if (!user) {
            return sendResult(
                ctx,
                `${E.error} Invalid User`,
                `${E.error} Please provide a valid Discord user mention or ID.`
            );
        }

        const id = String(user.id);

        if (data.targets.includes(id)) {
            return sendResult(
                ctx,
                `${E.warning} Already Added`,
                `${E.warning} <@${id}> is already an Auto Reactor target.`
            );
        }

        data.targets.push(id);

        saveData(data);

        return sendResult(
            ctx,
            `${E.success} Target Added`,
            [
                `${E.target} **Target:** <@${id}>`,
                `${E.success} Auto reaction is now active for this user.`,
            ].join("\n")
        );
    }

    // ========================================================
    // REMOVE TARGET
    // ========================================================

    if (
        sub === "remove" ||
        sub === "delete"
    ) {
        const input = args?.[1];

        const user =
            await resolveUser(ctx, input);

        if (!user) {
            return sendResult(
                ctx,
                `${E.error} Invalid User`,
                `${E.error} Please provide a valid Discord user mention or ID.`
            );
        }

        const id = String(user.id);

        if (!data.targets.includes(id)) {
            return sendResult(
                ctx,
                `${E.warning} Not Found`,
                `${E.warning} <@${id}> is not an Auto Reactor target.`
            );
        }

        data.targets =
            data.targets.filter(
                (target) => target !== id
            );

        delete data.targetEmojis[id];

        saveData(data);

        return sendResult(
            ctx,
            `${E.success} Target Removed`,
            `${E.remove} Removed <@${id}> from Zeechei's Auto Reactor.`
        );
    }

    // ========================================================
    // LIST TARGETS
    // ========================================================

    if (
        sub === "list" ||
        sub === "targets"
    ) {
        if (!data.targets.length) {
            return sendResult(
                ctx,
                `${E.list} React Targets`,
                `${E.info} No Auto Reactor targets are configured.`
            );
        }

        const lines = data.targets.map(
            (id, index) =>
                `**${index + 1}.** <@${id}> \`(${id})\``
        );

        return sendResult(
            ctx,
            `${E.list} React Targets`,
            lines.join("\n")
        );
    }

    // ========================================================
    // EMOJI COMMAND
    // ========================================================

    if (sub === "emoji" || sub === "emojis") {
        const action =
            String(args?.[1] || "list")
                .toLowerCase();

        // ----------------------------------------------------
        // EMOJI LIST
        // ----------------------------------------------------

        if (
            action === "list" ||
            action === "show"
        ) {
            const emojis =
                getGuildEmojis(
                    ctx.guild?.id,
                    data
                );

            if (!emojis.length) {
                return sendResult(
                    ctx,
                    `${E.emoji} React Emojis`,
                    `${E.info} No reaction emojis are configured.`
                );
            }

            return sendResult(
                ctx,
                `${E.emoji} React Emojis`,
                emojis
                    .map(
                        (emoji, index) =>
                            `**${index + 1}.** ${emoji}`
                    )
                    .join("\n")
            );
        }

        // ----------------------------------------------------
        // EMOJI ADD
        // ----------------------------------------------------

        if (action === "add") {
            const emoji =
                args
                    .slice(2)
                    .join(" ")
                    .trim();

            if (!isValidEmoji(emoji)) {
                return sendResult(
                    ctx,
                    `${E.error} Invalid Emoji`,
                    `${E.error} Provide a valid Unicode or custom Discord emoji.`
                );
            }

            if (
                data.emojis.includes(emoji)
            ) {
                return sendResult(
                    ctx,
                    `${E.warning} Already Added`,
                    `${E.warning} That emoji is already configured.`
                );
            }

            data.emojis.push(emoji);

            saveData(data);

            return sendResult(
                ctx,
                `${E.success} Emoji Added`,
                `${E.add} Added ${emoji} to Zeechei's Auto Reactor.`
            );
        }

        // ----------------------------------------------------
        // EMOJI REMOVE
        // ----------------------------------------------------

        if (
            action === "remove" ||
            action === "delete"
        ) {
            const emoji =
                args
                    .slice(2)
                    .join(" ")
                    .trim();

            if (!emoji) {
                return sendResult(
                    ctx,
                    `${E.error} Missing Emoji`,
                    `${E.error} Provide the emoji you want to remove.`
                );
            }

            if (
                !data.emojis.includes(emoji)
            ) {
                return sendResult(
                    ctx,
                    `${E.warning} Not Found`,
                    `${E.warning} That emoji is not configured.`
                );
            }

            data.emojis =
                data.emojis.filter(
                    (item) => item !== emoji
                );

            saveData(data);

            return sendResult(
                ctx,
                `${E.success} Emoji Removed`,
                `${E.remove} Removed ${emoji} from Zeechei's Auto Reactor.`
            );
        }

        return sendResult(
            ctx,
            `${E.emoji} Emoji Commands`,
            [
                "`.react emoji add <emoji>`",
                "`.react emoji remove <emoji>`",
                "`.react emoji list`",
            ].join("\n")
        );
    }

    // ========================================================
    // TEST
    // ========================================================

    if (sub === "test") {
        const input = args?.[1];

        const user =
            await resolveUser(ctx, input);

        if (!user) {
            return sendResult(
                ctx,
                `${E.error} Invalid User`,
                `${E.error} Provide a valid user mention or ID.`
            );
        }

        const emojis =
            getTargetEmojis(
                ctx.guild?.id,
                user.id,
                data
            );

        if (!emojis.length) {
            return sendResult(
                ctx,
                `${E.warning} No Emojis`,
                `${E.warning} No reaction emojis are configured.`
            );
        }

        let reacted = 0;

        for (const emoji of emojis) {
            const success =
                await safeReact(
                    ctx,
                    emoji
                );

            if (success) {
                reacted++;
            }
        }

        return sendResult(
            ctx,
            `${E.test} React Test`,
            [
                `${E.target} **Target:** <@${user.id}>`,
                `${E.emoji} **Emojis:** ${emojis.join(" ")}`,
                `${E.success} **Applied:** ${reacted}/${emojis.length}`,
            ].join("\n")
        );
    }

    // ========================================================
    // CLEAR
    // ========================================================

    if (
        sub === "clear" ||
        sub === "reset"
    ) {
        data.targets = [];
        data.emojis = [];
        data.targetEmojis = {};
        data.guildTargets = {};
        data.guildEmojis = {};

        saveData(data);

        return sendResult(
            ctx,
            `${E.clear} React System Cleared`,
            `${E.success} All Auto Reactor targets and emojis have been cleared.`
        );
    }

    // ========================================================
    // UNKNOWN COMMAND
    // ========================================================

    return sendResult(
        ctx,
        `${E.error} Unknown React Command`,
        [
            "Use `.react` to open the React System.",
            "",
            "Examples:",
            "`.react add @user`",
            "`.react emoji add ❤️`",
            "`.react emoji list`",
            "`.react test @user`",
        ].join("\n")
    );
}

// ============================================================
// MESSAGE LISTENER
//
// IMPORTANT:
// Your Zeechei CommandHandler loads command files and calls
// `execute()`. This listener is exported separately so it can
// be attached by the main event system without creating a
// second Discord client listener accidentally.
// ============================================================

async function onMessage(client, message) {
    try {
        if (!message) return;
        if (!message.author) return;
        if (message.author.bot) return;

        const data = loadData();

        if (!data.enabled) return;

        const guildId =
            message.guild?.id || null;

        const targets =
            getTargets(
                guildId,
                data
            );

        if (!targets.length) return;

        // ----------------------------------------------------
        // Only react when the configured target is mentioned.
        //
        // This matches the behavior of the Python code:
        // owner mention -> auto reaction.
        // ----------------------------------------------------

        const mentionedTarget =
            targets.find((id) =>
                message.mentions.users.has(id)
            );

        if (!mentionedTarget) {
            return;
        }

        const emojis =
            getTargetEmojis(
                guildId,
                mentionedTarget,
                data
            );

        if (!emojis.length) return;

        // ----------------------------------------------------
        // React one-by-one to avoid burst requests.
        // ----------------------------------------------------

        for (const emoji of unique(emojis)) {
            await safeReact(
                message,
                emoji
            );

            // Tiny delay prevents unnecessary reaction bursts.
            await new Promise((resolve) =>
                setTimeout(resolve, 150)
            );
        }
    } catch (error) {
        console.error(
            "[Zeechei React] Auto reaction failed:",
            error
        );
    }
}

// ============================================================
// COMMAND EXPORT
// ============================================================

module.exports = {
    name: "react",

    aliases: [
        "autoreact",
        "autoreactor",
        "reaction",
        "reactions",
    ],

    description:
        "Manage Zeechei's automatic reaction system.",

    usage:
        ".react <add|remove|list|emoji|on|off|test|clear>",

    execute,

    onMessage,

    // Useful for other Zeechei files
    getZeecheiTeam,
    getTeamRole,
    canManageReact,
    loadData,
    saveData,
};