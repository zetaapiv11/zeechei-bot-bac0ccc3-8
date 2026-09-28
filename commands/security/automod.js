const {
    EmbedBuilder,
    PermissionFlagsBits,
} = require("discord.js");

const config = require("../../config");
const Database = require("../../database/Database");

// ============================================================
// ZEECHEI AUTOMOD EMOJIS
// Normal emojis for now.
// ============================================================
const EMOJIS = {
    shield: "<:shield:1551407420868403230>",
    bot: "<:bot:1551285106038022245>",
    success: "<:check:1550872076104245271>",
    error: "<:cross:1550532309894045846>",
    warning: "<:warning:1550824858516979884>",
    info: "<:info2:1550792669008240681>",
    settings: "<:settings:1551257489713008690>",
    link: "<:link:1551407483224858674>",
    invite: "<:A_Invite:1551408998807511170>",
    spam: "<:Spam:1551409137965989978>",
    caps: "<:star_white:1551239822746853486>",
    word: "<a:Word_w:1551409718931759187>",
    mention: "<:AT_Mention:1551410366922231899>",
    duplicate: "<a:duplicate:1551410613442584576>",
    zalgo: "<a:cs_zalgostareyes:1551410817273176175>",
    sticker: "<:stickers:1551410874068115517>",
    image: "<:image:1551411002891968645>",
    ghost: "<:ghostt:1551411052737204281>",
    user: "<:user_user:1551284762943950942>",
    channel: "<:channel:1551411333625421914>",
    role: "<:Roles:1550826271678931024>",
};

// ============================================================
// CONSTANTS
// ============================================================

const LOG_CHANNEL_NAME =
    "Zeechei automod logs";

const SECURITY_ROLE_NAME =
    "Zeechei Unbypassable (A+)";

// ============================================================
// DEFAULT AUTOMOD
// ============================================================

const DEFAULT_AUTOMOD = {

    enabled: false,

    links: true,
    invites: true,
    caps: true,
    spam: true,
    badwords: true,
    stickers: true,
    zalgo: true,
    ghostping: true,
    newaccount: false,
    images: true,
    mentions: true,
    duplicate: true,

    capsPercent: 70,
    capsMinimum: 10,

    spamMessages: 5,
    spamWindow: 5000,

    duplicateCount: 3,

    mentionLimit: 5,
    imageLimit: 5,

    newAccountDays: 7,

    deleteMessages: true,
    timeoutSpammers: true,

    logChannelId: null,
    securityRoleId: null,

    badwordsList: [],

    whitelist: [],
};

// ============================================================
// MEMORY
// ============================================================

const spamTracker = new Map();
const duplicateTracker = new Map();
const ghostPingCache = new Map();
const initializedClients = new WeakSet();

// ============================================================
// CONFIG
// ============================================================

function getAntiNukeRecord(
    guildId
) {
    return (
        Database.getAntiNuke(
            guildId
        ) || {}
    );
}

function getConfig(
    guildId
) {

    const record =
        getAntiNukeRecord(
            guildId
        );

    const saved =
        record.automod || {};

    return {
        ...DEFAULT_AUTOMOD,
        ...saved,

        badwordsList:
            Array.isArray(
                saved.badwordsList
            )
                ? saved.badwordsList
                : [],

        whitelist:
            Array.isArray(
                saved.whitelist
            )
                ? saved.whitelist
                : [],
    };
}

function saveConfig(
    guildId,
    changes
) {

    const current =
        getConfig(
            guildId
        );

    return Database.setAntiNuke(
        guildId,
        {
            automod: {
                ...current,
                ...changes,
            },
        }
    );
}

// ============================================================
// OWNER
// ============================================================

function getOwnerIds() {

    const ids = [];

    const direct = [
        config?.mainOwnerId,
        config?.ownerId,
        config?.owner,
        config?.OWNER_ID,
    ];

    for (
        const id
        of direct
    ) {

        if (id) {
            ids.push(
                String(id)
            );
        }
    }

    const arrays = [
        config?.ownerIds,
        config?.OWNERS,
        config?.OWNER_IDS,
    ];

    for (
        const source
        of arrays
    ) {

        if (
            Array.isArray(
                source
            )
        ) {

            ids.push(
                ...source.map(
                    String
                )
            );
        }
    }

    return [
        ...new Set(ids)
    ];
}

function isBotOwner(
    userId
) {

    return getOwnerIds()
        .includes(
            String(userId)
        );
}

// ============================================================
// EMBED
// ============================================================

function embed(
    client,
    guildId,
    title,
    description,
    type = "info"
) {

    const colors = {

        success:
            0x57f287,

        error:
            0xed4245,

        warning:
            0xfee75c,

        info:
            client?.getColor?.(
                guildId
            ) ||
            0xffffff,
    };

    return new EmbedBuilder()
        .setColor(
            colors[type] ||
            colors.info
        )
        .setTitle(
            `${
                EMOJIS[type] ||
                EMOJIS.info
            } ${title}`
        )
        .setDescription(
            description
        )
        .setFooter({
            text:
                "Zeechei  AutoMod",
        })
        .setTimestamp();
}

// ============================================================
// LOG CHANNEL
// ============================================================

async function ensureLogChannel(
    guild
) {

    let channel =
        guild.channels.cache.find(
            c =>
                c.name ===
                    LOG_CHANNEL_NAME &&
                c.isTextBased?.()
        );

    if (channel) {
        return channel;
    }

    try {

        channel =
            await guild.channels.create({
                name:
                    LOG_CHANNEL_NAME,

                type: 0,

                reason:
                    "Zeechei AutoMod log channel setup",

                permissionOverwrites: [
                    {
                        id:
                            guild.roles.everyone.id,

                        deny: [
                            PermissionFlagsBits.ViewChannel,
                        ],
                    },

                    {
                        id:
                            guild.members.me?.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                ],
            });

        return channel;

    } catch (error) {

        console.error(
            "[Zeechei AutoMod] Log channel:",
            error?.message ||
            error
        );

        return null;
    }
}

// ============================================================
// SECURITY ROLE
// ============================================================

async function ensureSecurityRole(
    guild
) {

    let role =
        guild.roles.cache.find(
            r =>
                r.name ===
                SECURITY_ROLE_NAME
        );

    if (role) {
        return role;
    }

    try {

        return await guild.roles.create({
            name:
                SECURITY_ROLE_NAME,

            color:
                0x000000,

            hoist:
                false,

            mentionable:
                false,

            permissions:
                [],

            reason:
                "Zeechei AutoMod security role",
        });

    } catch (error) {

        console.error(
            "[Zeechei AutoMod] Security role:",
            error?.message ||
            error
        );

        return null;
    }
}

// ============================================================
// PROTECTED USER
// ============================================================

function isProtected(
    guild,
    member,
    cfg
) {

    if (!member) {
        return false;
    }

    if (
        member.user?.bot
    ) {
        return true;
    }

    if (
        guild.ownerId ===
        member.id
    ) {
        return true;
    }

    if (
        isBotOwner(
            member.id
        )
    ) {
        return true;
    }

    if (
        cfg.whitelist
            .map(String)
            .includes(
                String(member.id)
            )
    ) {
        return true;
    }

    if (
        cfg.securityRoleId &&
        member.roles.cache.has(
            cfg.securityRoleId
        )
    ) {
        return true;
    }

    // Admins are not automatically immune.
    // This keeps the security system useful.
    return false;
}

// ============================================================
// LOG
// ============================================================

async function sendLog(
    guild,
    data
) {

    const cfg =
        getConfig(
            guild.id
        );

    let channel = null;

    if (
        cfg.logChannelId
    ) {

        channel =
            guild.channels.cache.get(
                cfg.logChannelId
            );
    }

    if (
        !channel
    ) {

        channel =
            guild.channels.cache.find(
                c =>
                    c.name ===
                        LOG_CHANNEL_NAME &&
                    c.isTextBased?.()
            );
    }

    if (!channel) {
        return;
    }

    const logEmbed =
        new EmbedBuilder()
            .setColor(
                data.color ||
                0xffa500
            )
            .setTitle(
                `${EMOJIS.shield} Zeechei AutoMod Action`
            )
            .setDescription(
                data.reason ||
                "AutoMod action triggered."
            )
            .addFields(
                {
                    name:
                        `${EMOJIS.user} User`,
                    value:
                        data.user
                            ? `<@${data.user}> \`${data.user}\``
                            : "Unknown",
                    inline: true,
                },
                {
                    name:
                        `${EMOJIS.channel} Channel`,
                    value:
                        data.channel
                            ? `<#${data.channel}>`
                            : "Unknown",
                    inline: true,
                },
                {
                    name:
                        `${EMOJIS.settings} Action`,
                    value:
                        `\`${data.action || "Delete"}\``,
                    inline: true,
                }
            )
            .setFooter({
                text:
                    `${guild.name} • Zeechei AutoMod`,
            })
            .setTimestamp();

    try {
        await channel.send({
            embeds: [
                logEmbed
            ],
        });
    } catch {}
}

// ============================================================
// DELETE MESSAGE
// ============================================================

async function deleteMessage(
    message,
    reason
) {

    try {

        await message.delete();

        return true;

    } catch {

        return false;
    }
}

// ============================================================
// TIMEOUT
// ============================================================

async function timeoutMember(
    message,
    reason
) {

    const member =
        message.member;

    if (
        !member ||
        !member.moderatable
    ) {
        return false;
    }

    try {

        await member.timeout(
            60_000,
            `Zeechei AutoMod: ${reason}`
        );

        return true;

    } catch {

        return false;
    }
}

// ============================================================
// HANDLE VIOLATION
// ============================================================

async function handleViolation(
    message,
    reason,
    options = {}
) {

    const {
        timeout = false
    } = options;

    const cfg =
        getConfig(
            message.guild.id
        );

    if (
        !cfg.enabled
    ) {
        return true;
    }

    if (
        isProtected(
            message.guild,
            message.member,
            cfg
        )
    ) {
        return false;
    }

    let action =
        "delete";

    let deleted =
        false;

    let timedOut =
        false;

    if (
        cfg.deleteMessages
    ) {

        deleted =
            await deleteMessage(
                message,
                reason
            );
    }

    if (
        timeout &&
        cfg.timeoutSpammers
    ) {

        timedOut =
            await timeoutMember(
                message,
                reason
            );

        if (timedOut) {
            action =
                "delete + timeout";
        }
    }

    await sendLog(
        message.guild,
        {
            user:
                message.author.id,

            channel:
                message.channel.id,

            reason:
                `${EMOJIS.warning} **${reason}**`,

            action:
                action,

            color:
                timeout && timedOut
                    ? 0xed4245
                    : 0xffa500,
        }
    );

    return true;
}

// ============================================================
// NORMALIZE
// ============================================================

function normalize(
    value
) {

    return String(
        value || ""
    )
        .toLowerCase()
        .trim();
}

// ============================================================
// CAPS
// ============================================================

function excessiveCaps(
    content,
    cfg
) {

    if (
        content.length <
        cfg.capsMinimum
    ) {
        return false;
    }

    const letters =
        content.match(
            /[a-z]/gi
        );

    if (
        !letters ||
        !letters.length
    ) {
        return false;
    }

    const upper =
        content.match(
            /[A-Z]/g
        ) || [];

    const percentage =
        (
            upper.length /
            letters.length
        ) *
        100;

    return percentage >=
        cfg.capsPercent;
}

// ============================================================
// ZALGO
// ============================================================

function hasZalgo(
    content
) {

    return /[\u0300-\u036F\u0483-\u0489\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{3,}/
        .test(
            content
        );
}

// ============================================================
// LINK
// ============================================================

function hasLink(
    content
) {

    return /https?:\/\/[^\s]+/i
        .test(
            content
        );
}

// ============================================================
// INVITE
// ============================================================

function hasInvite(
    content
) {

    return /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i
        .test(
            content
        );
}

// ============================================================
// SPAM TRACKER
// ============================================================

function isSpam(
    message,
    cfg
) {

    const key =
        `${message.guild.id}:${message.author.id}`;

    const now =
        Date.now();

    const old =
        spamTracker.get(
            key
        ) || [];

    const fresh =
        old.filter(
            timestamp =>
                now -
                timestamp <
                cfg.spamWindow
        );

    fresh.push(
        now
    );

    spamTracker.set(
        key,
        fresh
    );

    return fresh.length >
        cfg.spamMessages;
}

// ============================================================
// DUPLICATE TRACKER
// ============================================================

function isDuplicate(
    message,
    cfg
) {

    if (
        !message.content ||
        message.content.length <
            10
    ) {
        return false;
    }

    const key =
        `${message.guild.id}:${message.author.id}`;

    const old =
        duplicateTracker.get(
            key
        ) || [];

    old.push(
        normalize(
            message.content
        )
    );

    while (
        old.length >
        cfg.duplicateCount
    ) {
        old.shift();
    }

    duplicateTracker.set(
        key,
        old
    );

    return (
        old.length >=
            cfg.duplicateCount &&
        new Set(old).size ===
            1
    );
}

// ============================================================
// INITIALIZE
// ============================================================

function initializeAutoMod(
    client
) {

    if (
        initializedClients.has(
            client
        )
    ) {
        return;
    }

    initializedClients.add(
        client
    );

    // ========================================================
    // MESSAGE CREATE
    // ========================================================

    client.on(
        "messageCreate",
        async message => {

            try {

                if (
                    !message.guild ||
                    message.author.bot
                ) {
                    return;
                }

                const cfg =
                    getConfig(
                        message.guild.id
                    );

                if (
                    !cfg.enabled
                ) {
                    return;
                }

                if (
                    isProtected(
                        message.guild,
                        message.member,
                        cfg
                    )
                ) {
                    return;
                }

                const content =
                    String(
                        message.content ||
                        ""
                    );

                const lower =
                    normalize(
                        content
                    );

                // --------------------------------------------
                // NEW ACCOUNT
                // --------------------------------------------

                if (
                    cfg.newaccount &&
                    message.author.createdTimestamp
                ) {

                    const age =
                        (
                            Date.now() -
                            message.author.createdTimestamp
                        ) /
                        86400000;

                    if (
                        age <
                        cfg.newAccountDays
                    ) {

                        await handleViolation(
                            message,
                            `New account detected (${Math.floor(age)} days old).`
                        );

                        return;
                    }
                }

                // --------------------------------------------
                // ATTACHMENTS
                // --------------------------------------------

                if (
                    cfg.images &&
                    message.attachments.size >
                        cfg.imageLimit
                ) {

                    await handleViolation(
                        message,
                        `Too many attachments (${message.attachments.size}/${cfg.imageLimit}).`
                    );

                    return;
                }

                // --------------------------------------------
                // MENTIONS
                // --------------------------------------------

                if (
                    cfg.mentions
                ) {

                    const count =
                        message.mentions.users.size +
                        message.mentions.roles.size;

                    if (
                        count >
                        cfg.mentionLimit
                    ) {

                        await handleViolation(
                            message,
                            `Too many mentions (${count}/${cfg.mentionLimit}).`
                        );

                        return;
                    }
                }

                // --------------------------------------------
                // INVITES
                // --------------------------------------------

                if (
                    cfg.invites &&
                    hasInvite(
                        lower
                    )
                ) {

                    await handleViolation(
                        message,
                        "Discord invite detected."
                    );

                    return;
                }

                // --------------------------------------------
                // LINKS
                // --------------------------------------------

                if (
                    cfg.links &&
                    hasLink(
                        lower
                    )
                ) {

                    await handleViolation(
                        message,
                        "Link detected."
                    );

                    return;
                }

                // --------------------------------------------
                // CAPS
                // --------------------------------------------

                if (
                    cfg.caps &&
                    excessiveCaps(
                        content,
                        cfg
                    )
                ) {

                    await handleViolation(
                        message,
                        "Excessive capital letters detected."
                    );

                    return;
                }

                // --------------------------------------------
                // BAD WORDS
                // --------------------------------------------

                if (
                    cfg.badwords &&
                    cfg.badwordsList.length
                ) {

                    const found =
                        cfg.badwordsList.find(
                            word =>
                                word &&
                                lower.includes(
                                    normalize(word)
                                )
                        );

                    if (found) {

                        await handleViolation(
                            message,
                            "Prohibited word detected."
                        );

                        return;
                    }
                }

                // --------------------------------------------
                // ZALGO
                // --------------------------------------------

                if (
                    cfg.zalgo &&
                    hasZalgo(
                        content
                    )
                ) {

                    await handleViolation(
                        message,
                        "Zalgo text detected."
                    );

                    return;
                }

                // --------------------------------------------
                // STICKERS
                // --------------------------------------------

                if (
                    cfg.stickers &&
                    message.stickers.size
                ) {

                    await handleViolation(
                        message,
                        "Sticker message detected."
                    );

                    return;
                }

                // --------------------------------------------
                // DUPLICATE
                // --------------------------------------------

                if (
                    cfg.duplicate &&
                    isDuplicate(
                        message,
                        cfg
                    )
                ) {

                    await handleViolation(
                        message,
                        "Duplicate messages detected."
                    );

                    return;
                }

                // --------------------------------------------
                // SPAM
                // --------------------------------------------

                if (
                    cfg.spam &&
                    isSpam(
                        message,
                        cfg
                    )
                ) {

                    await handleViolation(
                        message,
                        "Message spam detected.",
                        {
                            timeout:
                                true,
                        }
                    );

                    return;
                }

            } catch (error) {

                console.error(
                    "[Zeechei AutoMod] Message:",
                    error?.message ||
                    error
                );
            }
        }
    );

    // ========================================================
    // GHOST PING
    // ========================================================

    client.on(
        "messageCreate",
        message => {

            try {

                if (
                    !message.guild ||
                    message.author.bot
                ) {
                    return;
                }

                if (
                    !message.mentions.users.size &&
                    !message.mentions.roles.size
                ) {
                    return;
                }

                ghostPingCache.set(
                    message.id,
                    {
                        guildId:
                            message.guild.id,

                        authorId:
                            message.author.id,

                        channelId:
                            message.channel.id,

                        userMentions:
                            [...message.mentions.users.keys()],

                        roleMentions:
                            [...message.mentions.roles.keys()],

                        content:
                            message.content,
                    }
                );

                setTimeout(
                    () =>
                        ghostPingCache.delete(
                            message.id
                        ),
                    60_000
                );

            } catch {}
        }
    );

    // ========================================================
    // MESSAGE DELETE / GHOST PING
    // ========================================================

    client.on(
        "messageDelete",
        async message => {

            try {

                if (
                    !message.guild
                ) {
                    return;
                }

                const cfg =
                    getConfig(
                        message.guild.id
                    );

                if (
                    !cfg.enabled ||
                    !cfg.ghostping
                ) {
                    return;
                }

                const cached =
                    ghostPingCache.get(
                        message.id
                    );

                if (!cached) {
                    return;
                }

                const member =
                    await message.guild.members
                        .fetch(
                            cached.authorId
                        )
                        .catch(
                            () => null
                        );

                if (
                    isProtected(
                        message.guild,
                        member,
                        cfg
                    )
                ) {
                    return;
                }

                const pingText =
                    [
                        ...(
                            cached.userMentions ||
                            []
                        ).map(
                            id =>
                                `<@${id}>`
                        ),
                        ...(
                            cached.roleMentions ||
                            []
                        ).map(
                            id =>
                                `<@&${id}>`
                        ),
                    ].join(" ");

                await sendLog(
                    message.guild,
                    {
                        user:
                            cached.authorId,

                        channel:
                            cached.channelId,

                        reason:
                            `${EMOJIS.ghost} **Ghost ping detected.**\nPings: ${pingText || "Unknown"}`,

                        action:
                            "ghost-ping",

                        color:
                            0xed4245,
                    }
                );

            } catch (error) {

                console.error(
                    "[Zeechei AutoMod] Ghost ping:",
                    error?.message ||
                    error
                );
            }
        }
    );

    // ========================================================
    // CLEAN MEMORY
    // ========================================================

    setInterval(
        () => {

            const now =
                Date.now();

            for (
                const [
                    key,
                    timestamps
                ]
                of spamTracker
            ) {

                const cfg =
                    DEFAULT_AUTOMOD;

                const fresh =
                    timestamps.filter(
                        time =>
                            now -
                            time <
                            cfg.spamWindow
                    );

                if (
                    fresh.length
                ) {
                    spamTracker.set(
                        key,
                        fresh
                    );
                } else {
                    spamTracker.delete(
                        key
                    );
                }
            }

            for (
                const [
                    key
                ]
                of duplicateTracker
            ) {

                if (
                    Math.random() <
                    0.1
                ) {
                    duplicateTracker.delete(
                        key
                    );
                }
            }

        },
        30_000
    ).unref?.();
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {

    name: "automod",

    aliases: [
        "auto-mod",
        "am",
    ],

    category: "security",

    usage:
        "automod <setup|enable|disable|settings|whitelist|badwords>",

    description:
        "Configure Zeechei's automatic message moderation.",

    permission:
        "ManageGuild",

    async execute({
        client,
        message,
        args,
    }) {

        if (
            !message.guild
        ) {
            return;
        }

        initializeAutoMod(
            client
        );

        const guild =
            message.guild;

        const member =
            message.member;

        if (
            !member.permissions.has(
                PermissionFlagsBits.ManageGuild
            ) &&
            !isBotOwner(
                message.author.id
            )
        ) {

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "Permission Required",
                        `${EMOJIS.error} You need **Manage Server** permission to configure AutoMod.`,
                        "error"
                    ),
                ],
            });
        }

        const action =
            String(
                args?.[0] ||
                "settings"
            ).toLowerCase();

        // ====================================================
        // SETUP
        // ====================================================

        if (
            action ===
            "setup"
        ) {

            const logChannel =
                await ensureLogChannel(
                    guild
                );

            const role =
                await ensureSecurityRole(
                    guild
                );

            await saveConfig(
                guild.id,
                {
                    enabled:
                        true,

                    logChannelId:
                        logChannel?.id ||
                        null,

                    securityRoleId:
                        role?.id ||
                        null,
                }
            );

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "AutoMod Setup Complete",
                        [
                            `${EMOJIS.success} **AutoMod:** Enabled`,
                            "",
                            `${EMOJIS.channel} **Log Channel:** ${logChannel ? `<#${logChannel.id}>` : "Failed to create"}`,
                            `${EMOJIS.role} **Security Role:** ${role ? `<@&${role.id}>` : "Failed to create"}`,
                            `${EMOJIS.shield} **Protection:** Active`,
                            "",
                            "**Enabled Filters**",
                            `${EMOJIS.link} Links`,
                            `${EMOJIS.invite} Discord Invites`,
                            `${EMOJIS.caps} Excessive Caps`,
                            `${EMOJIS.spam} Spam`,
                            `${EMOJIS.duplicate} Duplicate Messages`,
                            `${EMOJIS.mention} Mention Spam`,
                            `${EMOJIS.zalgo} Zalgo`,
                            `${EMOJIS.sticker} Stickers`,
                            `${EMOJIS.image} Attachment Limit`,
                            `${EMOJIS.ghost} Ghost Ping`,
                        ].join("\n"),
                        "success"
                    ),
                ],
            });
        }

        // ====================================================
        // ENABLE
        // ====================================================

        if (
            action ===
            "enable"
        ) {

            await saveConfig(
                guild.id,
                {
                    enabled:
                        true,
                }
            );

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "AutoMod Enabled",
                        `${EMOJIS.success} Zeechei AutoMod is now **enabled**.`,
                        "success"
                    ),
                ],
            });
        }

        // ====================================================
        // DISABLE
        // ====================================================

        if (
            action ===
            "disable"
        ) {

            await saveConfig(
                guild.id,
                {
                    enabled:
                        false,
                }
            );

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "AutoMod Disabled",
                        `${EMOJIS.warning} Zeechei AutoMod is now **disabled**.`,
                        "warning"
                    ),
                ],
            });
        }

        // ====================================================
        // FILTER TOGGLE
        // ====================================================

        const filters = [
            "links",
            "invites",
            "caps",
            "spam",
            "badwords",
            "stickers",
            "zalgo",
            "ghostping",
            "newaccount",
            "images",
            "mentions",
            "duplicate",
        ];

        if (
            filters.includes(
                action
            )
        ) {

            const value =
                String(
                    args?.[1] ||
                    ""
                ).toLowerCase();

            if (
                ![
                    "on",
                    "off",
                    "enable",
                    "disable",
                ].includes(
                    value
                )
            ) {

                const cfg =
                    getConfig(
                        guild.id
                    );

                return message.reply({
                    embeds: [
                        embed(
                            client,
                            guild.id,
                            "Filter Status",
                            [
                                `${EMOJIS.settings} **${action}:** ${cfg[action] ? "<a:enable:1550533286294462587> Enabled" : "<a:disabled1:1550533140282482739> Disabled"}`,
                                "",
                                `Use \`${message.prefix || "."}automod ${action} on\``,
                                `or \`${message.prefix || "."}automod ${action} off\``,
                            ].join("\n")
                        ),
                    ],
                });
            }

            const enabled =
                value ===
                    "on" ||
                value ===
                    "enable";

            await saveConfig(
                guild.id,
                {
                    [action]:
                        enabled,
                }
            );

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "Filter Updated",
                        `${EMOJIS.success} **${action}** is now ${enabled ? "**enabled**." : "**disabled**."}`,
                        "success"
                    ),
                ],
            });
        }

        // ====================================================
        // BADWORDS
        // ====================================================

        if (
            action ===
            "badwords"
        ) {

            const sub =
                String(
                    args?.[1] ||
                    "list"
                ).toLowerCase();

            const cfg =
                getConfig(
                    guild.id
                );

            if (
                sub ===
                "add"
            ) {

                const word =
                    args
                        .slice(2)
                        .join(" ")
                        .trim()
                        .toLowerCase();

                if (!word) {

                    return message.reply({
                        embeds: [
                            embed(
                                client,
                                guild.id,
                                "Missing Word",
                                `${EMOJIS.error} Provide a word to add.`,
                                "error"
                            ),
                        ],
                    });
                }

                if (
                    !cfg.badwordsList.includes(
                        word
                    )
                ) {

                    cfg.badwordsList.push(
                        word
                    );
                }

                await saveConfig(
                    guild.id,
                    {
                        badwordsList:
                            cfg.badwordsList,

                        badwords:
                            true,
                    }
                );

                return message.reply({
                    embeds: [
                        embed(
                            client,
                            guild.id,
                            "Bad Word Added",
                            `${EMOJIS.success} The bad-word filter list has been updated.`,
                            "success"
                        ),
                    ],
                });
            }

            if (
                sub ===
                "remove"
            ) {

                const word =
                    args
                        .slice(2)
                        .join(" ")
                        .trim()
                        .toLowerCase();

                const updated =
                    cfg.badwordsList.filter(
                        item =>
                            item !==
                            word
                    );

                await saveConfig(
                    guild.id,
                    {
                        badwordsList:
                            updated,
                    }
                );

                return message.reply({
                    embeds: [
                        embed(
                            client,
                            guild.id,
                            "Bad Word Removed",
                            `${EMOJIS.success} The bad-word filter list has been updated.`,
                            "success"
                        ),
                    ],
                });
            }

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "Bad Word List",
                        cfg.badwordsList.length
                            ? cfg.badwordsList
                                .map(
                                    word =>
                                        `• \`${word}\``
                                )
                                .join("\n")
                            : `${EMOJIS.info} No custom words configured.`
                    ),
                ],
            });
        }

        // ====================================================
        // WHITELIST
        // ====================================================

        if (
            action ===
            "whitelist"
        ) {

            const sub =
                String(
                    args?.[1] ||
                    "list"
                ).toLowerCase();

            const cfg =
                getConfig(
                    guild.id
                );

            if (
                sub ===
                "add"
            ) {

                const raw =
                    args?.[2];

                const id =
                    raw?.match(
                        /\d{15,25}/
                    )?.[0];

                if (!id) {

                    return message.reply({
                        embeds: [
                            embed(
                                client,
                                guild.id,
                                "Invalid User",
                                `${EMOJIS.error} Mention a user or provide their ID.`,
                                "error"
                            ),
                        ],
                    });
                }

                if (
                    !cfg.whitelist.includes(
                        id
                    )
                ) {
                    cfg.whitelist.push(
                        id
                    );
                }

                await saveConfig(
                    guild.id,
                    {
                        whitelist:
                            cfg.whitelist,
                    }
                );

                return message.reply({
                    embeds: [
                        embed(
                            client,
                            guild.id,
                            "Whitelist Updated",
                            `${EMOJIS.success} <@${id}> is now protected from AutoMod.`,
                            "success"
                        ),
                    ],
                });
            }

            if (
                sub ===
                "remove"
            ) {

                const raw =
                    args?.[2];

                const id =
                    raw?.match(
                        /\d{15,25}/
                    )?.[0];

                if (!id) {

                    return message.reply({
                        embeds: [
                            embed(
                                client,
                                guild.id,
                                "Invalid User",
                                `${EMOJIS.error} Mention a user or provide their ID.`,
                                "error"
                            ),
                        ],
                    });
                }

                const updated =
                    cfg.whitelist.filter(
                        x =>
                            String(x) !==
                            String(id)
                    );

                await saveConfig(
                    guild.id,
                    {
                        whitelist:
                            updated,
                    }
                );

                return message.reply({
                    embeds: [
                        embed(
                            client,
                            guild.id,
                            "Whitelist Updated",
                            `${EMOJIS.success} <@${id}> has been removed from the AutoMod whitelist.`,
                            "success"
                        ),
                    ],
                });
            }

            return message.reply({
                embeds: [
                    embed(
                        client,
                        guild.id,
                        "AutoMod Whitelist",
                        [
                            `${EMOJIS.user} **Protected Users:**`,
                            "",
                            cfg.whitelist.length
                                ? cfg.whitelist
                                    .map(
                                        id =>
                                            `<@${id}> \`${id}\``
                                    )
                                    .join("\n")
                                : "None",
                        ].join("\n")
                    ),
                ],
            });
        }

        // ====================================================
        // SETTINGS
        // ====================================================

        const cfg =
            getConfig(
                guild.id
            );

        return message.reply({
            embeds: [
                embed(
                    client,
                    guild.id,
                    "Zeechei AutoMod Settings",
                    [
                        `${EMOJIS.shield} **Status:** ${cfg.enabled ? "<a:enable:1550533286294462587> Enabled" : "<a:disabled1:1550533140282482739> Disabled"}`,
                        `${EMOJIS.channel} **Logs:** ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : "Not configured"}`,
                        `${EMOJIS.role} **Security Role:** ${cfg.securityRoleId ? `<@&${cfg.securityRoleId}>` : "Not configured"}`,
                        "",
                        "**Filters**",
                        `${EMOJIS.link} Links: ${cfg.links ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.invite} Invites: ${cfg.invites ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.caps} Caps: ${cfg.caps ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.spam} Spam: ${cfg.spam ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.word} Bad Words: ${cfg.badwords ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.sticker} Stickers: ${cfg.stickers ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.zalgo} Zalgo: ${cfg.zalgo ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.ghost} Ghost Ping: ${cfg.ghostping ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.user} New Accounts: ${cfg.newaccount ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.image} Attachments: ${cfg.images ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.mention} Mentions: ${cfg.mentions ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                        `${EMOJIS.duplicate} Duplicate: ${cfg.duplicate ? "<a:enable:1550533286294462587>" : "<a:disabled1:1550533140282482739>"}`,
                    ].join("\n")
                ),
            ],
        });
    },
};