const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const Database = require("../../database/Database");
const config = require("../../config");

// ============================================================
// NO PREFIX PANEL
// ============================================================
//
// USAGE:
//
// .noprefixpanel create 7d
// .noprefixpanel create 24h
// .noprefixpanel create 30d
// .noprefixpanel create 1mo
//
// COMMAND = OWNER + DEVELOPER ONLY
//
// FREE TRIAL = ONE CLAIM PER ACCOUNT FOR LIFETIME
//
// ============================================================


// ============================================================
// EMOJIS
// ============================================================

const EMOJIS = {
    lightning: "<a:lightning:1550872978885976115>",
    info: "<:information:1550869957171220584>",
    check: "<:check:1550872076104245271>",
    clock: "<a:NG_Clock:1550872222107836424>",
    gift: "<a:st_gift:1550872399648391250>",
    lock: "<a:Lock:1550872561754050600>",
    panel: "<:panel:1550873482395390082>",
    warning: "<:warning:1550824858516979884>",
};


// ============================================================
// PREFIX
// ============================================================

const PREFIX =
    config?.prefix ||
    config?.PREFIX ||
    ".";


// ============================================================
// TIME PARSER
// ============================================================

function parseTime(input) {

    if (!input) {
        return null;
    }

    const value =
        String(input)
            .trim()
            .toLowerCase();

    const match =
        value.match(
            /^(\d+(?:\.\d+)?)(s|m|h|d|w|mo|y)$/
        );

    if (!match) {
        return null;
    }

    const amount =
        Number(match[1]);

    const unit =
        match[2];

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return null;
    }

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        mo: 30 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000,
    };

    return (
        amount *
        multipliers[unit]
    );
}


// ============================================================
// FORMAT TIME
// ============================================================

function formatDuration(ms) {

    if (
        !ms ||
        ms <= 0
    ) {
        return "Expired";
    }

    let seconds =
        Math.floor(ms / 1000);

    const days =
        Math.floor(
            seconds / 86400
        );

    seconds %= 86400;

    const hours =
        Math.floor(
            seconds / 3600
        );

    seconds %= 3600;

    const minutes =
        Math.floor(
            seconds / 60
        );

    seconds %= 60;

    const parts = [];

    if (days) {
        parts.push(`${days}d`);
    }

    if (hours) {
        parts.push(`${hours}h`);
    }

    if (minutes) {
        parts.push(`${minutes}m`);
    }

    if (
        seconds &&
        parts.length < 2
    ) {
        parts.push(`${seconds}s`);
    }

    return (
        parts.join(" ") ||
        "0s"
    );
}


// ============================================================
// GET CONFIG IDS
// ============================================================

function collectIds(values) {

    const ids = [];

    function collect(value) {

        if (!value) {
            return;
        }

        if (Array.isArray(value)) {

            for (
                const item of value
            ) {
                collect(item);
            }

            return;
        }

        if (
            typeof value ===
            "string"
        ) {

            for (
                const id of
                value.split(/[,\s]+/)
            ) {

                if (
                    /^\d{15,25}$/.test(
                        id
                    )
                ) {
                    ids.push(id);
                }
            }

            return;
        }

        if (
            typeof value ===
            "object"
        ) {

            for (
                const item of
                Object.values(value)
            ) {
                collect(item);
            }
        }
    }

    for (
        const value of values
    ) {
        collect(value);
    }

    return [
        ...new Set(ids),
    ];
}


// ============================================================
// OWNER
// ============================================================

function isOwner(userId) {

    const ids =
        collectIds([
            config?.mainOwnerId,
            config?.ownerId,
            config?.ownerID,
            config?.ownerIds,
            config?.ownerIDs,
            config?.owners,
            config?.OWNERS,
            config?.OWNER_ID,
            config?.OWNER_IDS,
            config?.team?.owners,
            config?.team?.ownerIds,
        ]);

    if (
        ids.includes(
            String(userId)
        )
    ) {
        return true;
    }

    try {

        if (
            typeof Database.isOwner ===
            "function"
        ) {

            return Boolean(
                Database.isOwner(
                    String(userId)
                )
            );
        }

    } catch {}

    return false;
}


// ============================================================
// DEVELOPER
// ============================================================

function isDeveloper(userId) {

    const ids =
        collectIds([
            config?.developerId,
            config?.developerID,
            config?.developerIds,
            config?.developerIDs,
            config?.developers,
            config?.DEVELOPERS,
            config?.DEVELOPER_IDS,
            config?.team?.developers,
            config?.team?.developerIds,
        ]);

    if (
        ids.includes(
            String(userId)
        )
    ) {
        return true;
    }

    try {

        if (
            typeof Database.isDeveloper ===
            "function"
        ) {

            return Boolean(
                Database.isDeveloper(
                    String(userId)
                )
            );
        }

    } catch {}

    return false;
}


// ============================================================
// AUTH
// ============================================================

function isAuthorized(userId) {

    return (
        isOwner(userId) ||
        isDeveloper(userId)
    );
}


// ============================================================
// PANEL EMBED
// ============================================================

function createPanelEmbed(
    durationMs
) {

    const duration =
        formatDuration(
            durationMs
        );

    return new EmbedBuilder()

        .setColor("#FFFFFF")

        .setTitle(
            `${EMOJIS.lightning} Zeechei Free No-Prefix Experience`
        )

        .setDescription(
            `### ${EMOJIS.lightning} Unlock No-Prefix Experience • Free Trial\n\n` +

            `> Claim your Free **${duration} No-Prefix access** and execute music\n` +
            `> commands instantly without typing prefixes.\n\n` +

            `> ${EMOJIS.info} **One-time claim per account**\n` +
            `> ${EMOJIS.info} **Valid across all supported servers**\n` +
            `> ${EMOJIS.info} **Instant activation after claiming**\n\n` +

            `${EMOJIS.clock} **Trial Duration:** \`${duration}\`\n` +
            `${EMOJIS.gift} **Claim:** Click the button below`
        )

        .setFooter({
            text:
                "Made with ❤️ By Star Dev",
        })

        .setTimestamp();
}


// ============================================================
// BUTTON
// ============================================================

function createButtons() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    "zeechei_noprefix_claim"
                )

                .setLabel(
                    "Claim No-Prefix"
                )

                .setEmoji(
                    EMOJIS.lightning
                )

                .setStyle(
                    ButtonStyle.Primary
                )
        );
}


// ============================================================
// COMMAND
// ============================================================

module.exports = {

    name: "noprefixpanel",

    aliases: [
        "nppanel",
        "np-panel",
        "noprefix-panel",
    ],

    description:
        "Create a permanent No-Prefix claim panel.",

    category:
        "owner",

    usage:
        ".noprefixpanel create <time>",


    async execute({
        client,
        message,
        args,
    }) {

        // ----------------------------------------------------
        // BASIC VALIDATION
        // ----------------------------------------------------

        if (!client) {
            console.error(
                "[NoPrefixPanel] Client missing."
            );
            return;
        }

        if (!message) {
            console.error(
                "[NoPrefixPanel] Message missing."
            );
            return;
        }

        if (!message.author) {
            return;
        }


        // ----------------------------------------------------
        // OWNER / DEVELOPER ONLY
        // ----------------------------------------------------

        const userId =
            String(
                message.author.id
            );

        if (
            !isAuthorized(userId)
        ) {

            return message.reply({
                content:
                    `${EMOJIS.lock} This command is restricted to Zeechei owners and developers.`,

                allowedMentions: {
                    repliedUser: false,
                },
            });
        }


        // ----------------------------------------------------
        // ARGS
        // ----------------------------------------------------

        const action =
            String(
                args?.[0] || ""
            ).toLowerCase();

        const timeInput =
            args?.[1];


        // ----------------------------------------------------
        // HELP
        // ----------------------------------------------------

        if (
            action !== "create" ||
            !timeInput
        ) {

            return message.reply({
                content:
                    `### ${EMOJIS.panel} No-Prefix Panel\n\n` +

                    `**Usage**\n` +
                    `\`${PREFIX}noprefixpanel create <time>\`\n\n` +

                    `**Examples**\n` +
                    `\`${PREFIX}noprefixpanel create 7d\`\n` +
                    `\`${PREFIX}noprefixpanel create 24h\`\n` +
                    `\`${PREFIX}noprefixpanel create 30d\`\n` +
                    `\`${PREFIX}noprefixpanel create 1mo\`\n\n` +

                    `**Units:** \`s\` • \`m\` • \`h\` • \`d\` • \`w\` • \`mo\` • \`y\``,
            });
        }


        // ----------------------------------------------------
        // PARSE TIME
        // ----------------------------------------------------

        const durationMs =
            parseTime(
                timeInput
            );

        if (!durationMs) {

            return message.reply({
                content:
                    `${EMOJIS.warning} Invalid time format.\n\n` +
                    `Example: \`${PREFIX}noprefixpanel create 7d\``,
            });
        }


        // ----------------------------------------------------
        // CREATE PANEL MESSAGE
        // ----------------------------------------------------

        const panel =
            await message.channel.send({

                embeds: [
                    createPanelEmbed(
                        durationMs
                    ),
                ],

                components: [
                    createButtons(),
                ],
            });


        // ----------------------------------------------------
        // SAVE PANEL PERMANENTLY
        // ----------------------------------------------------

        try {

            Database.createNoPrefixPanel(
                panel.id,
                durationMs,
                userId
            );

        } catch (error) {

            console.error(
                "[NoPrefixPanel] Failed saving panel:",
                error
            );

            return message.reply({
                content:
                    `${EMOJIS.warning} Panel was created, but its database record could not be saved.`,

                allowedMentions: {
                    repliedUser: false,
                },
            });
        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        return message.reply({

            content:
                `${EMOJIS.check} **No-Prefix panel created successfully.**\n` +
                `${EMOJIS.clock} Trial: \`${formatDuration(durationMs)}\`\n` +
                `${EMOJIS.panel} Panel: ${panel.url}`,

            allowedMentions: {
                repliedUser: false,
            },
        });
    },
};