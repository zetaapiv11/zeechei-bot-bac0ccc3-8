const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

const Database = require("../../database/Database");

let AfkStore = null;

try {
  AfkStore = require("../../utils/AfkStore");
} catch {
  AfkStore = null;
}

/* =========================================================
   ZEECHEI AFK SYSTEM
   ========================================================= */

const E = {
  afk: "<:HOME:1550824288917913722>",
  server: "<:servers:1550821293899915267>",
  enabled: "<:enabled:1550823547633537166>",
  disabled: "<:dh_disabled:1550823552117252116>",
  crown: "<:Crown:1550826767328092172>",

  global: "<:Global:1551048434583216169>",
  dm: "<:DM:1551048553948909591>",
  noDm: "<:Nodms:1551048571464187924>",
  success: "<:check:1550872076104245271>",
  error: "<:cross:1550532309894045846>",
  warning: "<:warning:1550824858516979884>",
};

/* =========================================================
   CONFIG
========================================================= */

const SETUP_TIMEOUT = 120000;
const BUTTON_TIMEOUT = 120000;

/* =========================================================
   HELPERS
========================================================= */

function getGuildId(ctx) {
  return ctx?.guildId || ctx?.guild?.id || null;
}

function getUserId(ctx) {
  return ctx?.user?.id || ctx?.author?.id || null;
}

function getColor(client, guildId) {
  try {
    const color = client?.getColor?.(guildId);

    if (color) {
      return color;
    }
  } catch {}

  return "#8B5CF6";
}

function makeEmbed(
  client,
  guildId,
  title,
  description
) {
  return new EmbedBuilder()
    .setColor(getColor(client, guildId))
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

/* =========================================================
   AFK DATABASE
========================================================= */

function getAfk(guildId, userId) {
  try {
    if (typeof Database.getAfk !== "function") {
      return null;
    }

    return Database.getAfk(
      guildId,
      userId
    );
  } catch (error) {
    console.error(
      "[AFK] getAfk error:",
      error
    );

    return null;
  }
}

/*
 * IMPORTANT:
 * Zeechei Database.js uses:
 *
 * setAfkGlobal(userId, reason)
 * setAfkServer(guildId, userId, reason)
 */

async function saveAfk(
  guildId,
  userId,
  reason,
  type
) {
  try {
    if (
      type === "global"
    ) {
      if (
        typeof Database.setAfkGlobal !==
        "function"
      ) {
        throw new Error(
          "Database.setAfkGlobal() is missing."
        );
      }

      Database.setAfkGlobal(
        userId,
        reason
      );

      return true;
    }

    if (
      typeof Database.setAfkServer !==
      "function"
    ) {
      throw new Error(
        "Database.setAfkServer() is missing."
      );
    }

    Database.setAfkServer(
      guildId,
      userId,
      reason
    );

    return true;

  } catch (error) {
    console.error(
      "[AFK] Save error:",
      error?.stack ||
      error?.message ||
      error
    );

    throw error;
  }
}

/* =========================================================
   DM PREFERENCE
========================================================= */

async function saveDmPreference(
  guildId,
  userId,
  type,
  enabled
) {
  if (!AfkStore) {
    return;
  }

  try {

    if (
      typeof AfkStore.set ===
      "function"
    ) {
      await AfkStore.set(
        guildId,
        userId,
        type,
        {
          dm: Boolean(enabled),
        }
      );

      return;
    }

    if (
      typeof AfkStore.save ===
      "function"
    ) {
      await AfkStore.save(
        guildId,
        userId,
        type,
        {
          dm: Boolean(enabled),
        }
      );
    }

  } catch (error) {
    console.error(
      "[AFK] DM preference save error:",
      error?.message || error
    );
  }
}

function getDmPreference(
  guildId,
  userId,
  type
) {
  if (
    !AfkStore ||
    typeof AfkStore.get !==
      "function"
  ) {
    return false;
  }

  try {
    const data =
      AfkStore.get(
        guildId,
        userId,
        type
      );

    if (
      data &&
      typeof data === "object"
    ) {
      return Boolean(data.dm);
    }

    return Boolean(data);

  } catch {
    return false;
  }
}

/* =========================================================
   REASON MODAL
========================================================= */

function createReasonModal(
  userId
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `zeechei_afk_reason_${userId}`
      )
      .setTitle(
        "Zeechei • AFK"
      );

  const input =
    new TextInputBuilder()
      .setCustomId(
        "afk_reason"
      )
      .setLabel(
        "AFK Reason"
      )
      .setPlaceholder(
        "Studying, sleeping, busy..."
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(input)
  );

  return modal;
}

/* =========================================================
   SCOPE BUTTONS
========================================================= */

function createScopeRow(
  userId
) {
  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId(
          `zeechei_afk_global_${userId}`
        )
        .setLabel(
          "Global"
        )
        .setEmoji(E.global)
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          `zeechei_afk_server_${userId}`
        )
        .setLabel(
          "Server Only"
        )
        .setEmoji(E.server)
        .setStyle(
          ButtonStyle.Secondary
        )

    );
}

/* =========================================================
   DM BUTTONS
========================================================= */

function createDmRow(
  userId
) {
  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId(
          `zeechei_afk_dm_on_${userId}`
        )
        .setLabel(
          "DM On Ping"
        )
        .setEmoji(E.dm)
        .setStyle(
          ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId(
          `zeechei_afk_dm_off_${userId}`
        )
        .setLabel(
          "DM Off"
        )
        .setEmoji(E.noDm)
        .setStyle(
          ButtonStyle.Secondary
        )

    );
}

/* =========================================================
   DM STEP
========================================================= */

async function askDmPreference(
  interaction,
  client,
  guildId,
  userId,
  reason,
  type
) {
  await interaction.update({
    embeds: [
      makeEmbed(
        client,
        guildId,
        `${E.afk} DM on Ping`,
        [
          `**Reason:** ${reason}`,
          "",
          `**Scope:** ${
            type === "global"
              ? `${E.global} Global`
              : `${E.server} Server Only`
          }`,
          "",
          "Do you want Zeechei to DM you when someone pings you while you're AFK?",
        ].join("\n")
      ),
    ],

    components: [
      createDmRow(userId),
    ],
  });

  const message =
    await interaction.fetchReply();

  const dmInteraction =
    await message.awaitMessageComponent({
      filter: (i) =>
        i.user.id === userId &&
        (
          i.customId ===
            `zeechei_afk_dm_on_${userId}` ||
          i.customId ===
            `zeechei_afk_dm_off_${userId}`
        ),

      time: BUTTON_TIMEOUT,
    });

  const dmEnabled =
    dmInteraction.customId ===
    `zeechei_afk_dm_on_${userId}`;

  /* SAVE */
  await saveAfk(
    guildId,
    userId,
    reason,
    type
  );

  await saveDmPreference(
    guildId,
    userId,
    type,
    dmEnabled
  );

  /* SUCCESS */
  await dmInteraction.update({
    embeds: [
      makeEmbed(
        client,
        guildId,
        `${E.success} AFK Enabled`,
        [
          "**Your AFK status is now active.**",
          "",
          `${E.afk} **Reason:** ${reason}`,
          "",
          `${E.global} **Scope:** ${
            type === "global"
              ? "Global"
              : "Server Only"
          }`,
          "",
          `${
            dmEnabled
              ? E.enabled
              : E.disabled
          } **DM on Ping:** ${
            dmEnabled
              ? "Enabled"
              : "Disabled"
          }`,
        ].join("\n")
      ),
    ],

    components: [],
  });
}

/* =========================================================
   SCOPE STEP
========================================================= */

async function askScope(
  interaction,
  client,
  guildId,
  userId,
  reason
) {
  await interaction.reply({
    embeds: [
      makeEmbed(
        client,
        guildId,
        `${E.afk} AFK Setup`,
        [
          `**Reason:** ${reason}`,
          "",
          "Choose where you want your AFK status to apply.",
        ].join("\n")
      ),
    ],

    components: [
      createScopeRow(userId),
    ],

    flags: MessageFlags.Ephemeral,
  });

  const message =
    await interaction.fetchReply();

  const scopeInteraction =
    await message.awaitMessageComponent({
      filter: (i) =>
        i.user.id === userId &&
        (
          i.customId ===
            `zeechei_afk_global_${userId}` ||
          i.customId ===
            `zeechei_afk_server_${userId}`
        ),

      time: BUTTON_TIMEOUT,
    });

  const type =
    scopeInteraction.customId ===
    `zeechei_afk_global_${userId}`
      ? "global"
      : "server";

  await askDmPreference(
    scopeInteraction,
    client,
    guildId,
    userId,
    reason,
    type
  );
}

/* =========================================================
   NEW AFK
========================================================= */

async function openReasonModal(
  interaction,
  client,
  guildId,
  userId
) {
  await interaction.showModal(
    createReasonModal(userId)
  );

  const submitted =
    await interaction.awaitModalSubmit({
      filter: (i) =>
        i.user.id === userId &&
        i.customId ===
          `zeechei_afk_reason_${userId}`,

      time: SETUP_TIMEOUT,
    }).catch(() => null);

  if (!submitted) {
    return;
  }

  const reason =
    submitted.fields
      .getTextInputValue(
        "afk_reason"
      )
      .trim();

  if (!reason) {
    return submitted.reply({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.error} Invalid Reason`,
          "Please enter a valid AFK reason."
        ),
      ],

      flags:
        MessageFlags.Ephemeral,
    });
  }

  try {

    await askScope(
      submitted,
      client,
      guildId,
      userId,
      reason
    );

  } catch (error) {

    console.error(
      "[AFK SETUP ERROR]",
      error?.stack ||
      error?.message ||
      error
    );

    try {

      if (
        submitted.replied ||
        submitted.deferred
      ) {
        await submitted.editReply({
          embeds: [
            makeEmbed(
              client,
              guildId,
              `${E.error} AFK Setup Failed`,
              "Zeechei couldn't complete the AFK setup. Check the console for the exact error."
            ),
          ],

          components: [],
        });

      } else {
        await submitted.reply({
          embeds: [
            makeEmbed(
              client,
              guildId,
              `${E.error} AFK Setup Failed`,
              "Zeechei couldn't complete the AFK setup."
            ),
          ],

          flags:
            MessageFlags.Ephemeral,
        });
      }

    } catch {}
  }
}

/* =========================================================
   EXISTING AFK
   DIRECTLY SCOPE → DM
========================================================= */

async function updateExistingAfk(
  message,
  client,
  guildId,
  userId,
  current
) {
  const reason =
    current.reason ||
    "No reason provided";

  const setupMessage =
    await message.reply({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.afk} AFK Setup`,
          [
            `**Current Reason:** ${reason}`,
            "",
            "Choose your AFK scope:",
          ].join("\n")
        ),
      ],

      components: [
        createScopeRow(userId),
      ],

      allowedMentions: {
        repliedUser: false,
      },
    });

  try {

    const scopeInteraction =
      await setupMessage.awaitMessageComponent({
        filter: (i) =>
          i.user.id === userId &&
          (
            i.customId ===
              `zeechei_afk_global_${userId}` ||
            i.customId ===
              `zeechei_afk_server_${userId}`
          ),

        time: BUTTON_TIMEOUT,
      });

    const type =
      scopeInteraction.customId ===
      `zeechei_afk_global_${userId}`
        ? "global"
        : "server";

    await askDmPreference(
      scopeInteraction,
      client,
      guildId,
      userId,
      reason,
      type
    );

  } catch (error) {

    console.error(
      "[AFK UPDATE ERROR]",
      error?.stack ||
      error?.message ||
      error
    );

    try {
      await setupMessage.edit({
        embeds: [
          makeEmbed(
            client,
            guildId,
            `${E.warning} AFK Setup Expired`,
            "Run `+afk` again to continue."
          ),
        ],

        components: [],
      });
    } catch {}
  }
}

/* =========================================================
   PREFIX START
========================================================= */

async function startPrefixAfk(
  message,
  client
) {
  const guildId =
    message.guildId;

  const userId =
    message.author.id;

  const current =
    getAfk(
      guildId,
      userId
    );

  /*
   * IMPORTANT:
   *
   * Already AFK
   * → NO REASON MODAL
   * → DIRECT SCOPE
   */

  if (current) {
    return updateExistingAfk(
      message,
      client,
      guildId,
      userId,
      current
    );
  }

  /*
   * NEW AFK
   *
   * Prefix commands cannot directly open
   * a Discord modal.
   * One tiny button is required.
   */

  const msg =
    await message.reply({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.afk} AFK`,
          "Click **Set AFK** to enter your AFK reason."
        ),
      ],

      components: [
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                `zeechei_afk_start_${userId}`
              )
              .setLabel(
                "Set AFK"
              )
              .setEmoji(E.afk)
              .setStyle(
                ButtonStyle.Primary
              ),

            new ButtonBuilder()
              .setCustomId(
                `zeechei_afk_cancel_${userId}`
              )
              .setLabel(
                "Cancel"
              )
              .setStyle(
                ButtonStyle.Secondary
              )

          ),
      ],

      allowedMentions: {
        repliedUser: false,
      },
    });

  try {

    const interaction =
      await msg.awaitMessageComponent({
        filter: (i) =>
          i.user.id === userId &&
          (
            i.customId ===
              `zeechei_afk_start_${userId}` ||
            i.customId ===
              `zeechei_afk_cancel_${userId}`
          ),

        time: 60000,
      });

    if (
      interaction.customId ===
      `zeechei_afk_cancel_${userId}`
    ) {
      return interaction.update({
        embeds: [
          makeEmbed(
            client,
            guildId,
            `${E.disabled} AFK Cancelled`,
            "No changes were made."
          ),
        ],

        components: [],
      });
    }

    await openReasonModal(
      interaction,
      client,
      guildId,
      userId
    );

  } catch {

    try {
      await msg.edit({
        embeds: [
          makeEmbed(
            client,
            guildId,
            `${E.warning} AFK Setup Expired`,
            "Run `+afk` again to start."
          ),
        ],

        components: [],
      });
    } catch {}
  }
}

/* =========================================================
   STATUS
========================================================= */

async function showStatus(
  ctx,
  client,
  guildId,
  userId
) {
  const afk =
    getAfk(
      guildId,
      userId
    );

  const send = (payload) => {

    if (
      ctx.isChatInputCommand?.()
    ) {
      return ctx.reply({
        ...payload,
        flags:
          MessageFlags.Ephemeral,
      });
    }

    return ctx.reply(payload);
  };

  if (!afk) {
    return send({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.afk} AFK Status`,
          "You are currently **not AFK**."
        ),
      ],
    });
  }

  const type =
    afk.type === "global"
      ? "Global"
      : "Server Only";

  const dm =
    getDmPreference(
      guildId,
      userId,
      afk.type || "server"
    );

  let since = "Unknown";

  if (afk.timestamp) {
    const time =
      Number(
        afk.timestamp
      );

    if (
      Number.isFinite(time)
    ) {
      since =
        `<t:${Math.floor(
          time / 1000
        )}:R>`;
    }
  }

  return send({
    embeds: [
      makeEmbed(
        client,
        guildId,
        `${E.afk} AFK Status`,
        [
          `${E.afk} **Reason:** ${
            afk.reason ||
            "No reason provided"
          }`,

          "",

          `${E.global} **Scope:** ${type}`,

          "",

          `${
            dm
              ? E.enabled
              : E.disabled
          } **DM on Ping:** ${
            dm
              ? "Enabled"
              : "Disabled"
          }`,

          "",

          `⏱️ **Since:** ${since}`,
        ].join("\n")
      ),
    ],
  });
}

/* =========================================================
   REMOVE
========================================================= */

async function removeAfk(
  ctx,
  client,
  guildId,
  userId
) {
  const afk =
    getAfk(
      guildId,
      userId
    );

  const send = (payload) => {

    if (
      ctx.isChatInputCommand?.()
    ) {
      return ctx.reply({
        ...payload,
        flags:
          MessageFlags.Ephemeral,
      });
    }

    return ctx.reply(payload);
  };

  if (!afk) {
    return send({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.afk} AFK`,
          "You are not currently AFK."
        ),
      ],
    });
  }

  try {

    Database.removeAfk(
      guildId,
      userId
    );

    return send({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.success} AFK Removed`,
          "Your AFK status has been removed."
        ),
      ],
    });

  } catch (error) {

    console.error(
      "[AFK REMOVE ERROR]",
      error?.stack ||
      error?.message ||
      error
    );

    return send({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.error} AFK`,
          "Could not remove your AFK status."
        ),
      ],
    });
  }
}

/* =========================================================
   COMMAND EXPORT
========================================================= */

module.exports = {

  name: "afk",

  aliases: [
    "away",
  ],

  category: "Utility",

  data:
    new SlashCommandBuilder()
      .setName("afk")
      .setDescription(
        "Manage your AFK status"
      )

      .addSubcommand(
        sub =>
          sub
            .setName("set")
            .setDescription(
              "Set your AFK status"
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName("status")
            .setDescription(
              "Check your AFK status"
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName("remove")
            .setDescription(
              "Remove your AFK status"
            )
      ),

  async execute({
    client,
    message,
    interaction,
    args = [],
  }) {

    const ctx =
      interaction ||
      message;

    if (!ctx) {
      return;
    }

    const guildId =
      getGuildId(ctx);

    const userId =
      getUserId(ctx);

    if (
      !guildId ||
      !userId
    ) {

      const payload = {
        content:
          `${E.error} This command can only be used inside a server.`,
      };

      if (
        ctx.isChatInputCommand?.()
      ) {
        return ctx.reply({
          ...payload,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      return ctx.reply(payload);
    }

    /* =========================================
       SLASH COMMAND
    ========================================= */

    if (
      interaction?.isChatInputCommand?.()
    ) {

      const subcommand =
        interaction.options
          .getSubcommand();

      if (
        subcommand === "status"
      ) {
        return showStatus(
          interaction,
          client,
          guildId,
          userId
        );
      }

      if (
        subcommand === "remove"
      ) {
        return removeAfk(
          interaction,
          client,
          guildId,
          userId
        );
      }

      /*
       * /afk set
       */

      const current =
        getAfk(
          guildId,
          userId
        );

      /*
       * Already AFK:
       * direct scope → DM
       */

      if (current) {

        return updateExistingAfkSlash(
          interaction,
          client,
          guildId,
          userId,
          current
        );
      }

      /*
       * New AFK:
       * reason → scope → DM
       */

      return openReasonModal(
        interaction,
        client,
        guildId,
        userId
      );
    }

    /* =========================================
       PREFIX
    ========================================= */

    const sub =
      String(
        args?.[0] || ""
      ).toLowerCase();

    if (
      sub === "status"
    ) {
      return showStatus(
        message,
        client,
        guildId,
        userId
      );
    }

    if (
      sub === "remove"
    ) {
      return removeAfk(
        message,
        client,
        guildId,
        userId
      );
    }

    return startPrefixAfk(
      message,
      client
    );
  },
};

/* =========================================================
   SLASH EXISTING AFK
========================================================= */

async function updateExistingAfkSlash(
  interaction,
  client,
  guildId,
  userId,
  current
) {
  const reason =
    current.reason ||
    "No reason provided";

  try {

    await interaction.reply({
      embeds: [
        makeEmbed(
          client,
          guildId,
          `${E.afk} AFK Setup`,
          [
            `**Current Reason:** ${reason}`,
            "",
            "Choose your AFK scope:",
          ].join("\n")
        ),
      ],

      components: [
        createScopeRow(userId),
      ],

      flags:
        MessageFlags.Ephemeral,
    });

    const message =
      await interaction.fetchReply();

    const scopeInteraction =
      await message.awaitMessageComponent({
        filter: (i) =>
          i.user.id === userId &&
          (
            i.customId ===
              `zeechei_afk_global_${userId}` ||
            i.customId ===
              `zeechei_afk_server_${userId}`
          ),

        time: BUTTON_TIMEOUT,
      });

    const type =
      scopeInteraction.customId ===
      `zeechei_afk_global_${userId}`
        ? "global"
        : "server";

    await askDmPreference(
      scopeInteraction,
      client,
      guildId,
      userId,
      reason,
      type
    );

  } catch (error) {

    console.error(
      "[AFK SLASH UPDATE ERROR]",
      error?.stack ||
      error?.message ||
      error
    );

    try {
      await interaction.editReply({
        embeds: [
          makeEmbed(
            client,
            guildId,
            `${E.error} AFK Setup`,
            "The AFK setup expired or could not be completed."
          ),
        ],

        components: [],
      });
    } catch {}
  }
}