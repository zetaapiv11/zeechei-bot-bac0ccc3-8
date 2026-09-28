const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../../config");

// ============================================================
// ZEECHEI USERINFO EMOJIS
// SAME CUSTOM EMOJIS
// ============================================================
const EMOJIS = {
    user: "<:user_user:1551284762943950942>",
    id: "<:id:1551284862516732055>",
    bot: "<:bot:1551285106038022245>",
    human: "<:STM_humanity:1551285229258547303>",
    badge: "<a:badges:1550821461068091446>",
    calendar: "<a:SR_Calander:1551280972603383822>",
    server: "<:server_em:1543589978326573158>",
    role: "<:Roles:1550826271678931024>",
    color: "<:color:1551286135198589030>",
    permissions: "<:permissions:1551286748015759411>",
    owner: "<:Crown:1550826767328092172>",
    developer: "<a:Dev:1551286508147839026>",
    premium: "<a:premium:1551286310403313815>",
    admin: "<:Admin:1551286384919052349>",
    moderator: "<:Moderator:1551286498391760987>",
    success: "<:check:1550872076104245271>",
    error: "<:cross:1550532309894045846>",
    warning: "<:warning:1550824858516979884>",
    banner: "<:banner:1551287650298888223>",
    none: "<:None:1551287226631979193>"
};

// ============================================================
// OWNER CHECK
// ============================================================
function isOwner(userId) {
    const owners = [
        ...(Array.isArray(config.ownerIds) ? config.ownerIds : []),
        ...(config.ownerId ? [config.ownerId] : []),
        ...(config.mainOwnerId ? [config.mainOwnerId] : [])
    ];

    return owners
        .map(String)
        .includes(String(userId));
}

// ============================================================
// COLOR
// ============================================================
function getColor(client, guildId) {
    try {
        if (typeof client.getColor === "function") {
            return client.getColor(guildId);
        }
    } catch {}

    return config.embedColor || 0xffffff;
}

// ============================================================
// SAFE TEXT
// ============================================================
function cut(text, max = 1000) {
    const value = String(text ?? "None");

    if (value.length <= max) {
        return value;
    }

    return `${value.slice(0, max - 3)}...`;
}

// ============================================================
// GET USER ID
// ============================================================
function getUserId(message, args) {
    const raw = String(args?.[0] || "").trim();

    // Mention
    const mention = raw.match(/^<@!?(\d+)>$/);

    if (mention) {
        return mention[1];
    }

    // Raw ID
    if (/^\d{15,25}$/.test(raw)) {
        return raw;
    }

    // Discord mention fallback
    const mentionedUser =
        message.mentions?.users?.first?.();

    if (mentionedUser) {
        return mentionedUser.id;
    }

    // No argument = command author
    return message.author.id;
}

// ============================================================
// GET BANNER
// ============================================================
async function getBanner(user) {
    try {
        const freshUser =
            await user.fetch({
                force: true
            });

        if (!freshUser.banner) {
            return null;
        }

        return freshUser.bannerURL({
            size: 4096
        });

    } catch {
        return null;
    }
}

// ============================================================
// USER BADGES
// ============================================================
function getBadges(user) {
    const badges = [];

    try {
        const flags =
            user.flags?.toArray?.() || [];

        if (flags.includes("DISCORD_EMPLOYEE")) {
            badges.push("👨‍💼 Discord Employee");
        }

        if (flags.includes("DISCORD_PARTNER")) {
            badges.push("🤝 Discord Partner");
        }

        if (flags.includes("BUGHUNTER_LEVEL_1")) {
            badges.push("🐛 Bug Hunter");
        }

        if (flags.includes("BUGHUNTER_LEVEL_2")) {
            badges.push("🐛 Bug Hunter Level 2");
        }

        if (flags.includes("HYPESQUAD_EVENTS")) {
            badges.push("🎪 HypeSquad Events");
        }

        if (flags.includes("HOUSE_BRAVERY")) {
            badges.push("🦁 HypeSquad Bravery");
        }

        if (flags.includes("HOUSE_BRILLIANCE")) {
            badges.push("💡 HypeSquad Brilliance");
        }

        if (flags.includes("HOUSE_BALANCE")) {
            badges.push("⚖️ HypeSquad Balance");
        }

        if (flags.includes("EARLY_SUPPORTER")) {
            badges.push("🌟 Early Supporter");
        }

        if (flags.includes("TEAM_USER")) {
            badges.push("👥 Team User");
        }

        if (flags.includes("SYSTEM")) {
            badges.push("⚙️ Discord System");
        }

        if (flags.includes("VERIFIED_BOT")) {
            badges.push("🤖 Verified Bot");
        }

        if (flags.includes("VERIFIED_DEVELOPER")) {
            badges.push("👨‍💻 Early Verified Bot Developer");
        }

        if (flags.includes("ACTIVE_DEVELOPER")) {
            badges.push("💻 Active Developer");
        }

    } catch {}

    return badges.length
        ? badges.join(" ")
        : `${EMOJIS.none} No User Badges`;
}

// ============================================================
// PERMISSION TRANSLATOR
// ============================================================
function translatePermission(permission) {
    const names = {
        CreateInstantInvite: "Create Instant Invite",
        KickMembers: "Kick Members",
        BanMembers: "Ban Members",
        Administrator: "Administrator",
        ManageChannels: "Manage Channels",
        ManageGuild: "Manage Server",
        AddReactions: "Add Reactions",
        ViewAuditLog: "View Audit Log",
        PrioritySpeaker: "Priority Speaker",
        Stream: "Stream",
        ViewChannel: "View Channel",
        SendMessages: "Send Messages",
        SendTTSMessages: "Send TTS Messages",
        ManageMessages: "Manage Messages",
        EmbedLinks: "Embed Links",
        AttachFiles: "Attach Files",
        ReadMessageHistory: "Read Message History",
        MentionEveryone: "Mention Everyone",
        UseExternalEmojis: "Use External Emojis",
        Connect: "Connect",
        Speak: "Speak",
        MuteMembers: "Mute Members",
        DeafenMembers: "Deafen Members",
        MoveMembers: "Move Members",
        UseVAD: "Use Voice Activity",
        ChangeNickname: "Change Nickname",
        ManageNicknames: "Manage Nicknames",
        ManageRoles: "Manage Roles",
        ManageWebhooks: "Manage Webhooks",
        ManageEmojisAndStickers: "Manage Emojis & Stickers",
        ManageEvents: "Manage Events",
        ManageThreads: "Manage Threads",
        CreatePublicThreads: "Create Public Threads",
        CreatePrivateThreads: "Create Private Threads",
        SendMessagesInThreads: "Send Messages In Threads",
        UseExternalStickers: "Use External Stickers",
        ModerateMembers: "Timeout Members",
        ViewGuildInsights: "View Server Insights",
        UseApplicationCommands: "Use Application Commands"
    };

    return names[permission] ||
        String(permission)
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ")
            .replace(/\b\w/g, x => x.toUpperCase());
}

// ============================================================
// ROLES
// ============================================================
function getRoles(member) {
    const roles = [
        ...member.roles.cache.values()
    ]
        .filter(role =>
            role.id !== member.guild.id
        )
        .sort(
            (a, b) =>
                b.rawPosition -
                a.rawPosition
        );

    if (!roles.length) {
        return `${EMOJIS.none} No Roles`;
    }

    const maxRoles = 25;

    const visible =
        roles
            .slice(0, maxRoles)
            .map(role =>
                `<@&${role.id}>`
            );

    if (roles.length > maxRoles) {
        visible.push(
            `...and ${roles.length - maxRoles} more`
        );
    }

    return cut(
        visible.join(", "),
        1000
    );
}

// ============================================================
// ACKNOWLEDGEMENT
// ============================================================
function getAcknowledgement(client, member) {

    if (
        member.id ===
        member.guild.ownerId
    ) {
        return `${EMOJIS.owner} Server Owner`;
    }

    if (isOwner(member.id)) {
        return `${EMOJIS.developer} ${client.user.username} Developer`;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return `${EMOJIS.admin} Server Administrator`;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.KickMembers
        ) &&
        member.permissions.has(
            PermissionFlagsBits.BanMembers
        ) &&
        member.permissions.has(
            PermissionFlagsBits.ModerateMembers
        )
    ) {
        return `${EMOJIS.moderator} Server Moderator`;
    }

    return `${EMOJIS.user} Server Member`;
}

// ============================================================
// COMMAND
// ============================================================
module.exports = {

    name: "userinfo",

    usage: "userinfo [user]",

    aliases: [
        "ui",
        "user",
        "whois"
    ],

    category: "information",

    premium: false,

    description:
        "Get detailed information about a Discord user.",

    // IMPORTANT:
    // Zeechei CommandHandler requires execute()
    async execute({
        client,
        message,
        args
    }) {

        // ====================================================
        // FIND USER
        // ====================================================
        const userId =
            getUserId(message, args);

        let user;

        try {
            user =
                await client.users.fetch(
                    userId
                );
        } catch {

            const errorEmbed =
                new EmbedBuilder()
                    .setColor(
                        getColor(client, message.guild?.id)
                    )
                    .setDescription(
                        `${EMOJIS.error} Please provide a valid Discord user ID or mention a valid user.`
                    );

            return message.reply({
                embeds: [errorEmbed]
            });
        }

        // ====================================================
        // FETCH SERVER MEMBER
        // ====================================================
        let member = null;

        if (message.guild) {
            member =
                await message.guild.members
                    .fetch(user.id)
                    .catch(() => null);
        }

        // ====================================================
        // BANNER
        // ====================================================
        const bannerURL =
            await getBanner(user);

        // ====================================================
        // USER NOT IN SERVER
        // ====================================================
        if (!member) {

            const badges =
                getBadges(user);

            const embed =
                new EmbedBuilder()
                    .setColor(
                        getColor(
                            client,
                            message.guild?.id
                        )
                    )
                    .setAuthor({
                        name:
                            `${user.tag} Information`,
                        iconURL:
                            user.displayAvatarURL({
                                size: 256
                            })
                    })
                    .setThumbnail(
                        user.displayAvatarURL({
                            size: 512
                        })
                    )
                    .setDescription(
                        `${EMOJIS.warning} This user is not a member of this server.`
                    )
                    .addFields({

                        name:
                            `${EMOJIS.user} General Information`,

                        value:
                            [
                                `${EMOJIS.user} **Username:** \`${user.username}\``,
                                `${EMOJIS.id} **User ID:** \`${user.id}\``,
                                `${EMOJIS.bot} **Bot:** ${user.bot ? EMOJIS.success : EMOJIS.error}`,
                                `${EMOJIS.badge} **Discord Badges:** ${badges}`,
                                `${EMOJIS.calendar} **Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`
                            ].join("\n")
                    })
                    .setFooter({
                        text:
                            `Requested By: ${message.author.tag}`,
                        iconURL:
                            message.author.displayAvatarURL({
                                size: 128
                            })
                    })
                    .setTimestamp();

            if (bannerURL) {
                embed.setImage(bannerURL);
            }

            return message.channel.send({
                embeds: [embed]
            });
        }

        // ====================================================
        // SERVER DATA
        // ====================================================
        const badges =
            getBadges(user);

        const permissions =
            member.permissions
                .toArray()
                .sort(
                    (a, b) =>
                        a.localeCompare(b)
                )
                .map(translatePermission);

        const permissionText =
            permissions.length
                ? cut(
                    permissions.join(", "),
                    1000
                )
                : "No Permissions";

        const roles =
            getRoles(member);

        const highestRole =
            member.roles.highest;

        const displayColor =
            member.displayHexColor &&
            member.displayHexColor !== "#000000"
                ? member.displayHexColor
                : "Default";

        const acknowledgement =
            getAcknowledgement(
                client,
                member
            );

        // ====================================================
        // MAIN EMBED
        // ====================================================
        const embed =
            new EmbedBuilder()
                .setColor(
                    getColor(
                        client,
                        message.guild.id
                    )
                )
                .setAuthor({
                    name:
                        `${user.tag} Information`,
                    iconURL:
                        user.displayAvatarURL({
                            size: 256
                        })
                })
                .setThumbnail(
                    user.displayAvatarURL({
                        size: 512
                    })
                )
                .addFields(

                    // -------------------------------
                    // GENERAL
                    // -------------------------------
                    {
                        name:
                            `${EMOJIS.user} General Information`,

                        value:
                            [
                                `${EMOJIS.user} **Username:** \`${user.username}\``,
                                `${EMOJIS.human} **Display Name:** \`${user.globalName || user.username}\``,
                                `${EMOJIS.id} **User ID:** \`${user.id}\``,
                                `${EMOJIS.user} **Nickname:** ${member.nickname || "None"}`,
                                `${EMOJIS.bot} **Bot:** ${user.bot ? EMOJIS.success : EMOJIS.error}`,
                                `${EMOJIS.badge} **Discord Badges:** ${badges}`,
                                `${EMOJIS.calendar} **Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                                `${EMOJIS.server} **Server Joined:** ${member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown"}`
                            ].join("\n")
                    },

                    // -------------------------------
                    // ROLES
                    // -------------------------------
                    {
                        name:
                            `${EMOJIS.role} Roles Information`,

                        value:
                            [
                                `**Highest Role:** ${highestRole}`,
                                `${EMOJIS.color} **Color:** \`${displayColor}\``,
                                `**Roles [${Math.max(member.roles.cache.size - 1, 0)}]:** ${roles}`
                            ].join("\n")
                    },

                    // -------------------------------
                    // PERMISSIONS
                    // -------------------------------
                    {
                        name:
                            `${EMOJIS.permissions} Key Permissions`,

                        value:
                            permissionText
                    },

                    // -------------------------------
                    // ACKNOWLEDGEMENT
                    // -------------------------------
                    {
                        name:
                            `${EMOJIS.owner} Acknowledgement`,

                        value:
                            acknowledgement
                    }
                )
                .setFooter({
                    text:
                        `Requested By: ${message.author.tag}`,
                    iconURL:
                        message.author.displayAvatarURL({
                            size: 128
                        })
                })
                .setTimestamp();

        // ====================================================
        // BANNER
        // ====================================================
        if (bannerURL) {
            embed.setImage(bannerURL);
        }

        // ====================================================
        // SEND
        // ====================================================
        return message.channel.send({
            embeds: [embed]
        });
    }
};