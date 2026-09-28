const fs = require("fs");
const path = require("path");

const Database = require("../database/Database");

// ============================================================
// ZEECHEI NO-PREFIX PANEL SYSTEM
// ============================================================
//
// Permanent panel
// One lifetime claim per Discord account
// Timed No-Prefix access
// Automatic expiry
// Restart safe
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
// STORAGE
// ============================================================
//
// Separate storage is intentionally used here.
//
// This means we don't have to replace your huge existing
// Database.js file and risk breaking other Zeechei systems.
//
// ============================================================

const DATA_DIR =
    path.join(
        process.cwd(),
        "data"
    );

const NP_FILE =
    path.join(
        DATA_DIR,
        "noprefix-system.json"
    );

fs.mkdirSync(
    DATA_DIR,
    {
        recursive: true,
    }
);


// ============================================================
// DEFAULT DATA
// ============================================================

function defaultData() {

    return {
        version: 1,

        // Permanent panel records
        panels: {},

        // Lifetime claim records
        // userId -> claim information
        claims: {},

        // Active No-Prefix
        // userId -> expiry timestamp
        active: {},
    };
}


// ============================================================
// LOAD
// ============================================================

let cache = null;

function loadData() {

    if (cache) {
        return cache;
    }

    try {

        if (
            !fs.existsSync(
                NP_FILE
            )
        ) {

            cache =
                defaultData();

            saveData();

            return cache;
        }

        const raw =
            fs.readFileSync(
                NP_FILE,
                "utf8"
            );

        const parsed =
            JSON.parse(raw);

        cache = {
            ...defaultData(),
            ...parsed,

            panels:
                parsed?.panels || {},

            claims:
                parsed?.claims || {},

            active:
                parsed?.active || {},
        };

    } catch (error) {

        console.error(
            "[NoPrefix] Database load error:",
            error.message
        );

        cache =
            defaultData();

    }

    return cache;
}


// ============================================================
// SAVE
// ============================================================

function saveData() {

    try {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true,
            }
        );

        const tempFile =
            `${NP_FILE}.tmp`;

        fs.writeFileSync(
            tempFile,
            JSON.stringify(
                cache || defaultData(),
                null,
                2
            ),
            "utf8"
        );

        fs.renameSync(
            tempFile,
            NP_FILE
        );

    } catch (error) {

        console.error(
            "[NoPrefix] Database save error:",
            error.message
        );
    }
}


// ============================================================
// INITIALIZE
// ============================================================

loadData();


// ============================================================
// FORMAT DURATION
// ============================================================

function formatDuration(ms) {

    if (
        !ms ||
        ms <= 0
    ) {
        return "Expired";
    }

    let seconds =
        Math.floor(
            Number(ms) / 1000
        );

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
        parts.push(
            `${days}d`
        );
    }

    if (hours) {
        parts.push(
            `${hours}h`
        );
    }

    if (minutes) {
        parts.push(
            `${minutes}m`
        );
    }

    if (
        seconds &&
        parts.length < 2
    ) {
        parts.push(
            `${seconds}s`
        );
    }

    return (
        parts.join(" ") ||
        "0s"
    );
}


// ============================================================
// EXPIRE USER
// ============================================================

function expireUser(
    userId
) {

    const data =
        loadData();

    const id =
        String(userId);

    delete data.active[id];

    // IMPORTANT:
    //
    // We DO NOT delete claims[id].
    //
    // This is what makes the free trial
    // one-time for the user's entire lifetime.
    //

    saveData();
}


// ============================================================
// CHECK ACTIVE ACCESS
// ============================================================

function hasActiveNoPrefix(
    userId
) {

    const data =
        loadData();

    const id =
        String(userId);

    const expiry =
        Number(
            data.active[id]
        );

    if (
        !Number.isFinite(
            expiry
        )
    ) {
        return false;
    }

    if (
        Date.now() <
        expiry
    ) {
        return true;
    }

    // Automatically expire
    expireUser(id);

    return false;
}


// ============================================================
// LIFETIME CLAIM CHECK
// ============================================================

function hasClaimedBefore(
    userId
) {

    const data =
        loadData();

    return Boolean(
        data.claims[
            String(userId)
        ]
    );
}


// ============================================================
// CLAIM USER
// ============================================================

function claimUser(
    userId,
    durationMs,
    panelId
) {

    const data =
        loadData();

    const id =
        String(userId);

    // --------------------------------------------------------
    // LIFETIME CHECK
    // --------------------------------------------------------

    if (
        data.claims[id]
    ) {

        return {
            success: false,
            reason:
                "already_claimed",
            claim:
                data.claims[id],
        };
    }


    // --------------------------------------------------------
    // VALIDATE DURATION
    // --------------------------------------------------------

    const duration =
        Number(
            durationMs
        );

    if (
        !Number.isFinite(
            duration
        ) ||
        duration <= 0
    ) {

        return {
            success: false,
            reason:
                "invalid_duration",
        };
    }


    // --------------------------------------------------------
    // CREATE CLAIM
    // --------------------------------------------------------

    const now =
        Date.now();

    const expiresAt =
        now +
        duration;


    // --------------------------------------------------------
    // PERMANENT CLAIM HISTORY
    // --------------------------------------------------------

    data.claims[id] = {

        userId: id,

        claimedAt: now,

        expiresAt,

        durationMs:
            duration,

        panelId:
            String(
                panelId || ""
            ),
    };


    // --------------------------------------------------------
    // ACTIVE ACCESS
    // --------------------------------------------------------

    data.active[id] =
        expiresAt;


    saveData();


    return {

        success: true,

        userId: id,

        claimedAt: now,

        expiresAt,

        durationMs:
            duration,

        panelId:
            String(
                panelId || ""
            ),
    };
}


// ============================================================
// PANEL STORAGE
// ============================================================

function savePanel(
    messageId,
    channelId,
    guildId,
    durationMs,
    createdBy
) {

    const data =
        loadData();

    const id =
        String(messageId);

    data.panels[id] = {

        messageId: id,

        channelId:
            String(
                channelId || ""
            ),

        guildId:
            String(
                guildId || ""
            ),

        durationMs:
            Number(durationMs),

        createdBy:
            String(
                createdBy || ""
            ),

        createdAt:
            Date.now(),
    };

    saveData();

    return data.panels[id];
}


function getPanel(
    messageId
) {

    const data =
        loadData();

    return (
        data.panels[
            String(messageId)
        ] ||
        null
    );
}


function getPanels() {

    const data =
        loadData();

    return Object.values(
        data.panels || {}
    );
}


// ============================================================
// PATCH EXISTING DATABASE OBJECT
// ============================================================
//
// Your current noprefixpanel.js calls:
//
// Database.createNoPrefixPanel()
// Database.isNoPrefix()
// Database.addNoPrefix()
//
// So we provide those methods without replacing your existing
// Database.js.
//
// ============================================================


// ------------------------------------------------------------
// KEEP THE ORIGINAL DATABASE NO-PREFIX METHODS
// ------------------------------------------------------------
//
// This event file used to replace Database.isNoPrefix(),
// Database.addNoPrefix(), Database.removeNoPrefix() and
// Database.getAllNoPrefixUsers() with panel-only versions.
// That made .np grants invisible to the normal command handler.
//
// Keep the original methods and merge panel access with the
// normal Zeechei No-Prefix database instead of replacing it.
// ------------------------------------------------------------

const baseNoPrefixMethods = {
    isNoPrefix:
        typeof Database.isNoPrefix === "function"
            ? Database.isNoPrefix.bind(Database)
            : null,

    addNoPrefix:
        typeof Database.addNoPrefix === "function"
            ? Database.addNoPrefix.bind(Database)
            : null,

    removeNoPrefix:
        typeof Database.removeNoPrefix === "function"
            ? Database.removeNoPrefix.bind(Database)
            : null,

    getAllNoPrefixUsers:
        typeof Database.getAllNoPrefixUsers === "function"
            ? Database.getAllNoPrefixUsers.bind(Database)
            : null,
};


// ------------------------------------------------------------
// createNoPrefixPanel
// ------------------------------------------------------------

Database.createNoPrefixPanel =
    function (
        messageId,
        durationMs,
        createdBy,
        channelId = "",
        guildId = ""
    ) {

        return savePanel(
            messageId,
            channelId,
            guildId,
            durationMs,
            createdBy
        );
    };


// ------------------------------------------------------------
// getNoPrefixPanel
// ------------------------------------------------------------

Database.getNoPrefixPanel =
    function (
        messageId
    ) {

        return getPanel(
            messageId
        );
    };


// ------------------------------------------------------------
// getNoPrefixPanels
// ------------------------------------------------------------

Database.getNoPrefixPanels =
    function () {

        return getPanels();
    };


// ------------------------------------------------------------
// isNoPrefix
// ------------------------------------------------------------

Database.isNoPrefix =
    function (
        userId
    ) {

        const id = String(userId);

        // No-Prefix claimed from the public panel.
        if (hasActiveNoPrefix(id)) {
            return true;
        }

        // No-Prefix granted by .np / the normal database.
        try {
            if (baseNoPrefixMethods.isNoPrefix) {
                return Boolean(
                    baseNoPrefixMethods.isNoPrefix(id)
                );
            }
        } catch (error) {
            console.error(
                "[NoPrefix] Base access check failed:",
                error?.message || error
            );
        }

        return false;
    };


// ------------------------------------------------------------
// addNoPrefix
// ------------------------------------------------------------
//
// Kept for compatibility with other Zeechei commands.
//
// This adds permanent No-Prefix if another system explicitly
// grants it. It does NOT create a free-trial claim record.
//
// ------------------------------------------------------------

Database.addNoPrefix =
    function (
        userId
    ) {

        const id = String(userId);

        // Public panel access already lives in the panel store.
        if (hasActiveNoPrefix(id)) {
            return;
        }

        // Preserve the normal Zeechei database grant.
        if (baseNoPrefixMethods.addNoPrefix) {
            return baseNoPrefixMethods.addNoPrefix(id);
        }

        return undefined;
    };


// ------------------------------------------------------------
// removeNoPrefix
// ------------------------------------------------------------

Database.removeNoPrefix =
    function (
        userId
    ) {

        const id = String(userId);

        // Remove panel access if present.
        expireUser(id);

        // Also remove normal Zeechei database access.
        try {
            if (baseNoPrefixMethods.removeNoPrefix) {
                baseNoPrefixMethods.removeNoPrefix(id);
            }
        } catch (error) {
            console.error(
                "[NoPrefix] Base access removal failed:",
                error?.message || error
            );
        }
    };


// ------------------------------------------------------------
// getAllNoPrefixUsers
// ------------------------------------------------------------

Database.getAllNoPrefixUsers =
    function () {

        const users = new Set();
        const data = loadData();

        // Public panel users.
        for (const userId of Object.keys(data.active || {})) {
            if (hasActiveNoPrefix(userId)) {
                users.add(String(userId));
            }
        }

        // Normal .np / legacy database users.
        try {
            if (baseNoPrefixMethods.getAllNoPrefixUsers) {
                for (const userId of baseNoPrefixMethods.getAllNoPrefixUsers()) {
                    if (userId) users.add(String(userId));
                }
            }
        } catch (error) {
            console.error(
                "[NoPrefix] Base user list failed:",
                error?.message || error
            );
        }

        return [...users];
    };


// ------------------------------------------------------------
// hasNoPrefixClaimed
// ------------------------------------------------------------

Database.hasNoPrefixClaimed =
    function (
        userId
    ) {

        return hasClaimedBefore(
            String(userId)
        );
    };


// ------------------------------------------------------------
// getNoPrefixClaim
// ------------------------------------------------------------

Database.getNoPrefixClaim =
    function (
        userId
    ) {

        const data =
            loadData();

        return (
            data.claims[
                String(userId)
            ] ||
            null
        );
    };


// ------------------------------------------------------------
// getNoPrefixExpiry
// ------------------------------------------------------------

Database.getNoPrefixExpiry =
    function (
        userId
    ) {

        const data =
            loadData();

        const id =
            String(userId);

        const expiry =
            Number(
                data.active[id]
            );

        if (
            !Number.isFinite(
                expiry
            )
        ) {
            return null;
        }

        if (
            Date.now() >=
            expiry
        ) {

            expireUser(id);

            return null;
        }

        return expiry;
    };


// ------------------------------------------------------------
// claimNoPrefix
// ------------------------------------------------------------

Database.claimNoPrefix =
    function (
        userId,
        durationMs,
        panelId
    ) {

        return claimUser(
            String(userId),
            Number(durationMs),
            panelId
        );
    };


// ============================================================
// INTERACTION HANDLER
// ============================================================

module.exports = {

    name:
        "interactionCreate",

    once:
        false,

    async execute(
        client,
        interaction
    ) {

        // ----------------------------------------------------
        // BUTTON ONLY
        // ----------------------------------------------------

        if (
            !interaction?.isButton?.()
        ) {
            return;
        }


        // ----------------------------------------------------
        // NO-PREFIX BUTTON ONLY
        // ----------------------------------------------------

        if (
            interaction.customId !==
            "zeechei_noprefix_claim"
        ) {
            return;
        }


        try {

            // ------------------------------------------------
            // PANEL
            // ------------------------------------------------

            const panel =
                getPanel(
                    interaction.message?.id
                );


            if (!panel) {

                return interaction.reply({

                    content:
                        `${EMOJIS.warning} This No-Prefix panel could not be found.`,

                    ephemeral: true,

                });
            }


            // ------------------------------------------------
            // DURATION
            // ------------------------------------------------

            const durationMs =
                Number(
                    panel.durationMs
                );


            if (
                !Number.isFinite(
                    durationMs
                ) ||
                durationMs <= 0
            ) {

                return interaction.reply({

                    content:
                        `${EMOJIS.warning} This panel has an invalid trial duration.`,

                    ephemeral: true,

                });
            }


            // ------------------------------------------------
            // USER
            // ------------------------------------------------

            const userId =
                String(
                    interaction.user.id
                );


            // ------------------------------------------------
            // LIFETIME CLAIM CHECK
            // ------------------------------------------------

            if (
                hasClaimedBefore(
                    userId
                )
            ) {

                const claim =
                    loadData()
                        .claims[userId];


                const previousExpiry =
                    Number(
                        claim?.expiresAt
                    );


                // --------------------------------------------
                // STILL ACTIVE
                // --------------------------------------------

                if (
                    Number.isFinite(
                        previousExpiry
                    ) &&
                    Date.now() <
                    previousExpiry
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJIS.info} You already have an active No-Prefix trial.\n\n` +

                            `${EMOJIS.clock} Expires: <t:${Math.floor(previousExpiry / 1000)}:F>`,

                        ephemeral: true,

                    });
                }


                // --------------------------------------------
                // EXPIRED BUT CLAIM ALREADY USED
                // --------------------------------------------

                return interaction.reply({

                    content:
                        `${EMOJIS.info} You have already used your **one-time lifetime No-Prefix free claim**.\n\n` +

                        `Your previous free trial has expired, so this account cannot claim another free trial.`,

                    ephemeral: true,

                });
            }


            // ------------------------------------------------
            // ACTIVE CHECK
            // ------------------------------------------------

            if (
                hasActiveNoPrefix(
                    userId
                )
            ) {

                const expiry =
                    getActiveExpiry(
                        userId
                    );


                return interaction.reply({

                    content:
                        `${EMOJIS.info} You already have No-Prefix access.` +

                        (
                            expiry
                                ? `\n\n${EMOJIS.clock} Expires: <t:${Math.floor(expiry / 1000)}:F>`
                                : ""
                        ),

                    ephemeral: true,

                });
            }


            // ------------------------------------------------
            // CLAIM
            // ------------------------------------------------

            const result =
                claimUser(
                    userId,
                    durationMs,
                    panel.messageId
                );


            // ------------------------------------------------
            // FAILED
            // ------------------------------------------------

            if (
                !result?.success
            ) {

                if (
                    result?.reason ===
                    "already_claimed"
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJIS.info} You have already claimed the No-Prefix free trial once.`,

                        ephemeral: true,

                    });
                }


                if (
                    result?.reason ===
                    "invalid_duration"
                ) {

                    return interaction.reply({

                        content:
                            `${EMOJIS.warning} This panel has an invalid duration.`,

                        ephemeral: true,

                    });
                }


                return interaction.reply({

                    content:
                        `${EMOJIS.warning} No-Prefix could not be activated. Please try again later.`,

                    ephemeral: true,

                });
            }


            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            const expiresAt =
                Number(
                    result.expiresAt
                );

            const unix =
                Math.floor(
                    expiresAt / 1000
                );


            return interaction.reply({

                content:

                    `${EMOJIS.check} **No-Prefix Activated!**\n\n` +

                    `${EMOJIS.lightning} Access: **No-Prefix**\n` +

                    `${EMOJIS.clock} Duration: **${formatDuration(durationMs)}**\n` +

                    `${EMOJIS.clock} Expires: <t:${unix}:F>\n\n` +

                    `${EMOJIS.info} This is your **one-time lifetime free claim**. Once this trial expires, this account cannot claim another free trial.`,

                ephemeral: true,

            });

        } catch (error) {

            console.error(
                "[NoPrefix] Interaction error:",
                error
            );


            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({

                    content:
                        `${EMOJIS.warning} Something went wrong while claiming No-Prefix.`,

                    ephemeral: true,

                }).catch(
                    () => {}
                );
            }
        }
    },
};


// ============================================================
// ACTIVE EXPIRY HELPER
// ============================================================

function getActiveExpiry(
    userId
) {

    const data =
        loadData();

    const expiry =
        Number(
            data.active[
                String(userId)
            ]
        );

    if (
        !Number.isFinite(
            expiry
        )
    ) {
        return null;
    }

    if (
        Date.now() >=
        expiry
    ) {

        expireUser(
            String(userId)
        );

        return null;
    }

    return expiry;
}


// ============================================================
// EXPIRY CLEANUP
// ============================================================
//
// This does not delete lifetime claim history.
// It only removes expired active access.
//
// ============================================================

function cleanupExpiredUsers() {

    const data =
        loadData();

    const now =
        Date.now();

    let changed =
        false;


    for (
        const [
            userId,
            expiresAt
        ]
        of Object.entries(
            data.active || {}
        )
    ) {

        if (
            Number(expiresAt) <=
            now
        ) {

            delete data.active[
                userId
            ];

            changed =
                true;
        }
    }


    if (changed) {
        saveData();
    }
}


// ============================================================
// CLEANUP EVERY 5 MINUTES
// ============================================================

const cleanupTimer =
    setInterval(
        cleanupExpiredUsers,
        5 * 60 * 1000
    );


// Don't keep Node alive only because of this timer.
if (
    typeof cleanupTimer.unref ===
    "function"
) {
    cleanupTimer.unref();
}


// ============================================================
// STARTUP LOG
// ============================================================

console.log(
    "[NoPrefix] ✅ Lifetime claim system loaded."
);
console.log(
    `[NoPrefix] 📁 Storage: ${NP_FILE}`
);