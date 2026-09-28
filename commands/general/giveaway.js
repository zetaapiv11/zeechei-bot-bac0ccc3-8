const {
    EmbedBuilder,
    PermissionFlagsBits,
} = require("discord.js");

const fs = require("fs");
const path = require("path");


// ============================================================
// GIVEAWAY SYSTEM
// ============================================================
//
// .giveaway
//
// .giveaway start 1m 1 Nitro
// .giveaway start 30m 2 1000 Coins
// .giveaway start 1h 1 Premium
//
// .giveaway end <messageId>
// .giveaway reroll <messageId>
//
// 1m  = 1 minute
// 1mo = 1 month (30 days)
//
// ============================================================


// ============================================================
// EMOJIS
// ============================================================
// Change emojis from here only.
// ============================================================

const EMOJIS = {
    giveaway: "<a:tada2:1550903638598099125>",
    prize: "<a:prize:1550903934124564490>",
    time: "<a:Timer:1550904230653595678>",
    winners: "<a:winners_cups:1550904517350924419>",
    host: "<:host:1550904815385579681>",
    check: "<:check:1550872076104245271>",
    warning: "<:warning:1550824858516979884>",
};


// ============================================================
// STORAGE
// ============================================================

const DATA_DIR = path.join(
    process.cwd(),
    "data"
);

const GIVEAWAY_FILE = path.join(
    DATA_DIR,
    "giveaways.json"
);

fs.mkdirSync(DATA_DIR, {
    recursive: true,
});


// ============================================================
// LOAD
// ============================================================

function loadGiveaways() {
    try {
        if (!fs.existsSync(GIVEAWAY_FILE)) {
            return {};
        }

        const raw = fs.readFileSync(
            GIVEAWAY_FILE,
            "utf8"
        );

        if (!raw.trim()) {
            return {};
        }

        const data = JSON.parse(raw);

        return (
            data &&
            typeof data === "object"
        )
            ? data
            : {};

    } catch (error) {
        console.error(
            "[Giveaway] Load error:",
            error.message
        );

        return {};
    }
}


// ============================================================
// SAVE
// ============================================================

function saveGiveaways(data) {
    try {
        fs.mkdirSync(DATA_DIR, {
            recursive: true,
        });

        const tempFile =
            `${GIVEAWAY_FILE}.tmp`;

        fs.writeFileSync(
            tempFile,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );

        fs.renameSync(
            tempFile,
            GIVEAWAY_FILE
        );

        return true;

    } catch (error) {
        console.error(
            "[Giveaway] Save error:",
            error.message
        );

        return false;
    }
}


// ============================================================
// TIME PARSER
// ============================================================
//
// s  = seconds
// m  = minutes
// h  = hours
// d  = days
// w  = weeks
// mo = months (30 days)
//
// IMPORTANT:
// "1m"  => 1 minute
// "1mo" => 1 month
//
// ============================================================

function parseDuration(input) {

    if (!input) {
        return null;
    }

    const value =
        String(input)
            .trim()
            .toLowerCase();

    const match = value.match(
        /^(\d+(?:\.\d+)?)(mo|s|m|h|d|w)$/
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

        s:
            1000,

        m:
            60 * 1000,

        h:
            60 * 60 * 1000,

        d:
            24 * 60 * 60 * 1000,

        w:
            7 * 24 * 60 * 60 * 1000,

        mo:
            30 * 24 * 60 * 60 * 1000,
    };

    const duration =
        amount * multipliers[unit];

    if (
        !Number.isFinite(duration) ||
        duration < 1000
    ) {
        return null;
    }

    // Maximum 1 year
    if (
        duration >
        365 * 24 * 60 * 60 * 1000
    ) {
        return null;
    }

    return duration;
}


// ============================================================
// FORMAT DURATION
// ============================================================

function formatDuration(ms) {

    let seconds =
        Math.floor(
            Number(ms) / 1000
        );

    if (
        !Number.isFinite(seconds) ||
        seconds <= 0
    ) {
        return "Expired";
    }

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
// PRIZE
// ============================================================

function getPrize(args) {

    return args
        .slice(3)
        .join(" ")
        .trim();
}


// ============================================================
// GET CUSTOM EMOJI ID
// ============================================================

function getGiveawayEmojiId() {

    const match =
        EMOJIS.giveaway.match(
            /<a?:[^:>]+:(\d+)>/
        );

    return match
        ? match[1]
        : null;
}


// ============================================================
// FIND GIVEAWAY REACTION
// ============================================================
//
// Discord reaction cache key is NOT always the complete
// "<a:name:id>" string.
//
// So we find it by emoji ID.
//
// ============================================================

function findGiveawayReaction(message) {

    const emojiId =
        getGiveawayEmojiId();

    if (!emojiId) {
        return null;
    }

    return (
        message.reactions.cache.find(
            reaction =>
                reaction.emoji?.id === emojiId
        ) || null
    );
}


// ============================================================
// ACTIVE GIVEAWAY EMBED
// ============================================================

function createGiveawayEmbed(giveaway) {

    const endsAt =
        Math.floor(
            Number(giveaway.endsAt) / 1000
        );

    return new EmbedBuilder()

        .setColor("#FFFFFF")

        .setTitle(
            `${EMOJIS.giveaway} ${giveaway.prize}`
        )

        .setDescription(
            `> ${EMOJIS.prize} **${giveaway.prize}**\n` +
            `> ${EMOJIS.time} <t:${endsAt}:R>\n` +
            `> ${EMOJIS.winners} **${giveaway.winners}** winner${giveaway.winners === 1 ? "" : "s"}\n` +
            `> ${EMOJIS.host} <@${giveaway.hostId}>\n\n` +
            `React with ${EMOJIS.giveaway} to enter.`
        )

        .setFooter({
            text: "Zeechei Giveaways",
        })

        .setTimestamp(
            new Date(giveaway.createdAt)
        );
}


// ============================================================
// ENDED EMBED
// ============================================================

function createEndedEmbed(
    giveaway,
    winnerIds
) {

    const winners =
        winnerIds.length
            ? winnerIds
                .map(id => `<@${id}>`)
                .join(", ")
            : "No valid entries";

    return new EmbedBuilder()

        .setColor("#FFFFFF")

        .setTitle(
            `${EMOJIS.giveaway} Giveaway Ended`
        )

        .setDescription(
            `> ${EMOJIS.prize} **${giveaway.prize}**\n` +
            `> ${EMOJIS.winners} ${winners}\n` +
            `> ${EMOJIS.host} <@${giveaway.hostId}>`
        )

        .setFooter({
            text: "Zeechei Giveaways • Ended",
        })

        .setTimestamp();
}


// ============================================================
// PICK WINNERS
// ============================================================

function pickWinners(
    users,
    count
) {

    const list = [...users];
    const selected = [];

    while (
        list.length &&
        selected.length < count
    ) {

        const index =
            Math.floor(
                Math.random() * list.length
            );

        const [winner] =
            list.splice(
                index,
                1
            );

        selected.push(winner);
    }

    return selected;
}


// ============================================================
// FETCH GIVEAWAY MESSAGE
// ============================================================

async function fetchGiveawayMessage(
    client,
    giveaway
) {

    try {

        const channel =
            await client.channels.fetch(
                giveaway.channelId
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return null;
        }

        return await channel.messages.fetch(
            giveaway.messageId
        );

    } catch (error) {

        console.error(
            "[Giveaway] Fetch error:",
            error.message
        );

        return null;
    }
}


// ============================================================
// SAVE SINGLE GIVEAWAY
// ============================================================

function saveGiveaway(giveaway) {

    const data =
        loadGiveaways();

    data[giveaway.messageId] =
        giveaway;

    saveGiveaways(data);
}


// ============================================================
// END GIVEAWAY
// ============================================================

async function endGiveaway(
    client,
    giveaway,
    manual = false
) {

    if (
        !giveaway ||
        giveaway.ended
    ) {
        return {
            success: false,
            reason: "already_ended",
        };
    }

    const message =
        await fetchGiveawayMessage(
            client,
            giveaway
        );

    if (!message) {

        giveaway.ended = true;
        giveaway.endedAt = Date.now();

        saveGiveaway(giveaway);

        return {
            success: false,
            reason: "message_not_found",
        };
    }


    // --------------------------------------------------------
    // GET ENTRIES
    // --------------------------------------------------------

    const reaction =
        findGiveawayReaction(message);

    let entrants = [];


    if (reaction) {

        try {

            const users =
                await reaction.users.fetch();

            entrants =
                users
                    .filter(
                        user => !user.bot
                    )
                    .map(
                        user => user.id
                    );

        } catch (error) {

            console.error(
                "[Giveaway] Entry fetch error:",
                error.message
            );
        }
    }


    // --------------------------------------------------------
    // WINNERS
    // --------------------------------------------------------

    const winnerIds =
        pickWinners(
            entrants,
            Math.min(
                Number(giveaway.winners),
                entrants.length
            )
        );


    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------

    giveaway.ended =
        true;

    giveaway.endedAt =
        Date.now();

    giveaway.winnerIds =
        winnerIds;

    giveaway.entries =
        entrants.length;

    saveGiveaway(giveaway);


    // --------------------------------------------------------
    // EDIT ORIGINAL EMBED
    // --------------------------------------------------------

    await message.edit({
        embeds: [
            createEndedEmbed(
                giveaway,
                winnerIds
            ),
        ],
    }).catch(() => {});


    // --------------------------------------------------------
    // RESULT
    // --------------------------------------------------------

    if (winnerIds.length) {

        await message.channel.send({

            embeds: [

                new EmbedBuilder()
                    .setColor("#FFFFFF")
                    .setDescription(
                        `${EMOJIS.check} **Giveaway ended**\n` +
                        `${EMOJIS.prize} **${giveaway.prize}**\n` +
                        `${EMOJIS.winners} ${winnerIds
                            .map(id => `<@${id}>`)
                            .join(", ")}`
                    )
                    .setFooter({
                        text:
                            manual
                                ? "Ended manually"
                                : "Zeechei Giveaways",
                    }),
            ],

        }).catch(() => {});

    } else {

        await message.channel.send({

            embeds: [

                new EmbedBuilder()
                    .setColor("#FFFFFF")
                    .setDescription(
                        `${EMOJIS.warning} **Giveaway ended**\n` +
                        `${EMOJIS.prize} **${giveaway.prize}**\n` +
                        `No valid entries.`
                    )
                    .setFooter({
                        text: "Zeechei Giveaways",
                    }),
            ],

        }).catch(() => {});
    }


    return {
        success: true,
        winnerIds,
        entries: entrants.length,
    };
}


// ============================================================
// REROLL
// ============================================================

async function rerollGiveaway(
    client,
    giveaway
) {

    if (
        !giveaway ||
        !giveaway.ended
    ) {
        return {
            success: false,
            reason: "not_ended",
        };
    }

    const message =
        await fetchGiveawayMessage(
            client,
            giveaway
        );

    if (!message) {
        return {
            success: false,
            reason: "message_not_found",
        };
    }


    const reaction =
        findGiveawayReaction(message);

    if (!reaction) {
        return {
            success: false,
            reason: "no_entries",
        };
    }


    let entrants = [];

    try {

        const users =
            await reaction.users.fetch();

        entrants =
            users
                .filter(
                    user => !user.bot
                )
                .map(
                    user => user.id
                );

    } catch {

        return {
            success: false,
            reason: "fetch_failed",
        };
    }


    if (!entrants.length) {
        return {
            success: false,
            reason: "no_entries",
        };
    }


    const winners =
        pickWinners(
            entrants,
            Math.min(
                Number(giveaway.winners),
                entrants.length
            )
        );


    giveaway.winnerIds =
        winners;

    giveaway.rerolledAt =
        Date.now();

    saveGiveaway(giveaway);


    await message.channel.send({

        embeds: [

            new EmbedBuilder()
                .setColor("#FFFFFF")
                .setDescription(
                    `${EMOJIS.giveaway} **Giveaway rerolled**\n` +
                    `${EMOJIS.prize} **${giveaway.prize}**\n` +
                    `${EMOJIS.winners} ${winners
                        .map(id => `<@${id}>`)
                        .join(", ")}`
                )
                .setFooter({
                    text: "Zeechei Giveaways",
                }),
        ],

    }).catch(() => {});


    return {
        success: true,
        winners,
    };
}


// ============================================================
// AUTO END SCHEDULER
// ============================================================

const scheduledGiveaways =
    new Map();

let autoEndStarted = false;


// ============================================================
// SCHEDULE ONE GIVEAWAY
// ============================================================

function scheduleGiveawayEnd(
    client,
    giveaway
) {

    if (
        !giveaway ||
        giveaway.ended
    ) {
        return;
    }

    if (
        !giveaway.messageId
    ) {
        return;
    }


    // Clear old timer
    const oldTimer =
        scheduledGiveaways.get(
            giveaway.messageId
        );

    if (oldTimer) {
        clearTimeout(oldTimer);
    }


    const remaining =
        Number(giveaway.endsAt) -
        Date.now();


    // Already expired
    if (remaining <= 0) {

        setImmediate(() => {

            endGiveaway(
                client,
                giveaway,
                false
            ).catch(error => {
                console.error(
                    "[Giveaway] Auto-end error:",
                    error.message
                );
            });

        });

        return;
    }


    // Node.js setTimeout has a max safe delay.
    // For long giveaways, wake up before the limit
    // and schedule again.

    const MAX_TIMEOUT =
        2_147_000_000;

    const delay =
        Math.min(
            remaining,
            MAX_TIMEOUT
        );


    const timer =
        setTimeout(
            async () => {

                scheduledGiveaways.delete(
                    giveaway.messageId
                );

                const currentRemaining =
                    Number(giveaway.endsAt) -
                    Date.now();


                // Still not expired
                if (
                    currentRemaining > 0
                ) {

                    scheduleGiveawayEnd(
                        client,
                        giveaway
                    );

                    return;
                }


                try {

                    await endGiveaway(
                        client,
                        giveaway,
                        false
                    );

                } catch (error) {

                    console.error(
                        "[Giveaway] Auto-end error:",
                        error.message
                    );
                }

            },
            delay
        );


    scheduledGiveaways.set(
        giveaway.messageId,
        timer
    );
}


// ============================================================
// START AUTO-END SYSTEM
// ============================================================

function startAutoEnd(client) {

    if (
        autoEndStarted
    ) {
        return;
    }

    autoEndStarted =
        true;


    console.log(
        "[Giveaway] Auto-end system started."
    );


    const data =
        loadGiveaways();


    for (
        const giveaway
        of Object.values(data)
    ) {

        if (
            !giveaway ||
            giveaway.ended
        ) {
            continue;
        }

        scheduleGiveawayEnd(
            client,
            giveaway
        );
    }
}


// ============================================================
// COMMAND
// ============================================================

module.exports = {

    name: "giveaway",

    aliases: [
        "gw",
    ],

    description:
        "Create and manage giveaways.",

    category:
        "general",

    usage:
        ".giveaway start <duration> <winners> <prize>",


    async execute({
        client,
        message,
        args,
    }) {

        if (
            !client ||
            !message
        ) {
            return;
        }


        // Start persistent scheduler
        startAutoEnd(client);


        const action =
            String(
                args?.[0] || ""
            )
            .toLowerCase();


        // ====================================================
        // HELP
        // ====================================================

        if (!action) {

            return message.reply({

                embeds: [

                    new EmbedBuilder()
                        .setColor("#FFFFFF")
                        .setTitle(
                            `${EMOJIS.giveaway} Giveaway`
                        )
                        .setDescription(
                            `\`${".giveaway start <time> <winners> <prize>"}\`\n` +
                            `\`${".giveaway end <messageId>"}\`\n` +
                            `\`${".giveaway reroll <messageId>"}\`\n\n` +
                            `**Time:** \`1m\` • \`1h\` • \`1d\` • \`1mo\``
                        )
                        .setFooter({
                            text: "Zeechei Giveaways",
                        }),

                ],

                allowedMentions: {
                    repliedUser: false,
                },

            });
        }


        // ====================================================
        // START
        // ====================================================

        if (
            action === "start"
        ) {

            const durationInput =
                args?.[1];

            const winnersInput =
                args?.[2];

            const duration =
                parseDuration(
                    durationInput
                );

            const winners =
                Number(
                    winnersInput
                );

            const prize =
                getPrize(args);


            // ------------------------------------------------
            // DURATION
            // ------------------------------------------------

            if (!duration) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Invalid duration**\n` +
                                `Use \`1m\`, \`30m\`, \`1h\`, \`1d\`, \`1mo\``
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            // ------------------------------------------------
            // WINNERS
            // ------------------------------------------------

            if (
                !Number.isInteger(winners) ||
                winners < 1 ||
                winners > 50
            ) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Invalid winner count**\n` +
                                `Choose between **1–50**.`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            // ------------------------------------------------
            // PRIZE
            // ------------------------------------------------

            if (!prize) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Prize is required**\n` +
                                `Example: \`.giveaway start 1m 1 Nitro\``
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            // ------------------------------------------------
            // CREATE
            // ------------------------------------------------

            const now =
                Date.now();

            const giveaway = {

                messageId:
                    null,

                channelId:
                    message.channel.id,

                guildId:
                    message.guild?.id ||
                    null,

                hostId:
                    message.author.id,

                prize,

                winners,

                duration,

                createdAt:
                    now,

                endsAt:
                    now + duration,

                ended:
                    false,

                winnerIds: [],

                entries:
                    0,
            };


            // ------------------------------------------------
            // SEND
            // ------------------------------------------------

            const giveawayMessage =
                await message.channel.send({

                    embeds: [
                        createGiveawayEmbed(
                            giveaway
                        ),
                    ],

                });


            giveaway.messageId =
                giveawayMessage.id;


            // ------------------------------------------------
            // SAVE
            // ------------------------------------------------

            saveGiveaway(
                giveaway
            );


            // ------------------------------------------------
            // REACTION
            // ------------------------------------------------

            try {

                await giveawayMessage.react(
                    EMOJIS.giveaway
                );

            } catch (error) {

                console.error(
                    "[Giveaway] Reaction error:",
                    error.message
                );
            }


            // ------------------------------------------------
            // SCHEDULE EXACT END
            // ------------------------------------------------

            scheduleGiveawayEnd(
                client,
                giveaway
            );


            // ------------------------------------------------
            // CONFIRM
            // ------------------------------------------------

            return message.reply({

                embeds: [

                    new EmbedBuilder()
                        .setColor("#FFFFFF")
                        .setDescription(
                            `${EMOJIS.check} **Giveaway created**\n` +
                            `${EMOJIS.prize} ${prize} • ` +
                            `${EMOJIS.time} ${formatDuration(duration)} • ` +
                            `${EMOJIS.winners} ${winners}`
                        )
                        .setFooter({
                            text: "Zeechei Giveaways",
                        }),

                ],

                allowedMentions: {
                    repliedUser: false,
                },

            });
        }


        // ====================================================
        // END
        // ====================================================

        if (
            action === "end"
        ) {

            const messageId =
                args?.[1];

            if (!messageId) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Giveaway message ID required**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            const data =
                loadGiveaways();

            const giveaway =
                data[messageId];


            if (!giveaway) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Giveaway not found**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            const canManage =
                giveaway.hostId ===
                    message.author.id ||

                message.member?.permissions?.has(
                    PermissionFlagsBits.ManageGuild
                );


            if (!canManage) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **You cannot end this giveaway**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            const result =
                await endGiveaway(
                    client,
                    giveaway,
                    true
                );


            if (!result.success) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Could not end the giveaway**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            return message.reply({

                embeds: [

                    new EmbedBuilder()
                        .setColor("#FFFFFF")
                        .setDescription(
                            `${EMOJIS.check} **Giveaway ended**\n` +
                            `${EMOJIS.winners} ${result.winnerIds.length} winner${result.winnerIds.length === 1 ? "" : "s"} selected`
                        )
                        .setFooter({
                            text: "Zeechei Giveaways",
                        }),

                ],

                allowedMentions: {
                    repliedUser: false,
                },

            });
        }


        // ====================================================
        // REROLL
        // ====================================================

        if (
            action === "reroll"
        ) {

            const messageId =
                args?.[1];


            if (!messageId) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Giveaway message ID required**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            const data =
                loadGiveaways();

            const giveaway =
                data[messageId];


            if (!giveaway) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **Giveaway not found**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            const canManage =
                giveaway.hostId ===
                    message.author.id ||

                message.member?.permissions?.has(
                    PermissionFlagsBits.ManageGuild
                );


            if (!canManage) {

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **You cannot reroll this giveaway**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            const result =
                await rerollGiveaway(
                    client,
                    giveaway
                );


            if (!result.success) {

                let reason =
                    "Giveaway cannot be rerolled.";

                if (
                    result.reason ===
                    "not_ended"
                ) {
                    reason =
                        "Giveaway has not ended yet.";
                }

                if (
                    result.reason ===
                    "no_entries"
                ) {
                    reason =
                        "No valid entries found.";
                }

                return message.reply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor("#FFFFFF")
                            .setDescription(
                                `${EMOJIS.warning} **${reason}**`
                            ),

                    ],

                    allowedMentions: {
                        repliedUser: false,
                    },

                });
            }


            return message.reply({

                embeds: [

                    new EmbedBuilder()
                        .setColor("#FFFFFF")
                        .setDescription(
                            `${EMOJIS.check} **Giveaway rerolled**\n` +
                            `${EMOJIS.prize} **${giveaway.prize}**\n` +
                            `${EMOJIS.winners} ${result.winners
                                .map(id => `<@${id}>`)
                                .join(", ")}`
                        )
                        .setFooter({
                            text: "Zeechei Giveaways",
                        }),

                ],

                allowedMentions: {
                    repliedUser: false,
                },

            });
        }


        // ====================================================
        // UNKNOWN
        // ====================================================

        return message.reply({

            embeds: [

                new EmbedBuilder()
                    .setColor("#FFFFFF")
                    .setTitle(
                        `${EMOJIS.giveaway} Giveaway`
                    )
                    .setDescription(
                        `\`.giveaway start <time> <winners> <prize>\`\n` +
                        `\`.giveaway end <messageId>\`\n` +
                        `\`.giveaway reroll <messageId>\``
                    )
                    .setFooter({
                        text: "Zeechei Giveaways",
                    }),

            ],

            allowedMentions: {
                repliedUser: false,
            },

        });
    },
};


// ============================================================
// EXTERNAL SYSTEM START
// ============================================================
//
// Agar tum apne main index/event se manually start karna chaho:
//
// const giveaway = require("./commands/general/giveaway");
// giveaway.startGiveawaySystem(client);
//
// ============================================================

module.exports.startGiveawaySystem =
    startAutoEnd;