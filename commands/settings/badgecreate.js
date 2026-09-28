const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { getAllBadges } = require("../../utils/badges");
const Database = require("../../database/Database");
const WebhookLogger = require("../../logger/WebhookLogger");
const config = require("../../config");

const DEFAULT_COLORS = [
  "#5865F2",
  "#57F287",
  "#FEE75C",
  "#EB459E",
  "#ED4245",
  "#00BFFF",
  "#F97316",
  "#A855F7",
];

const MAX_CUSTOM = 50;

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isValidHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

async function checkOwner(userId) {
  try {
    const databaseOwner = await Database.isOwner(userId);

    if (databaseOwner) {
      return true;
    }
  } catch (error) {
    console.error("[badgecreate] Database.isOwner error:", error);
  }

  if (
    Array.isArray(config.ownerIds) &&
    config.ownerIds.includes(userId)
  ) {
    return true;
  }

  if (
    config.mainOwnerId &&
    config.mainOwnerId === userId
  ) {
    return true;
  }

  return false;
}

module.exports = {
  name: "badgecreate",

  aliases: [
    "createbadge",
    "newbadge",
    "badge+c",
  ],

  description:
    "[Owner only] Create a new permanent custom badge stored in the database.",

  category: "settings",

  usage:
    "+badgecreate <key> <emoji> [color] [label...] | +badgecreate delete <key>",

  argsRequired: true,

  ownerOnly: true,

  examples: [
    "+badgecreate legend <:legend:123456789>",
    "+badgecreate legend <:legend:123456789> #FF0000 The Legend",
    "+badgecreate delete legend",
  ],

  data: new SlashCommandBuilder()
    .setName("badgecreate")
    .setDescription(
      "[Owner] Create a new permanent custom badge."
    )

    .addStringOption(option =>
      option
        .setName("key")
        .setDescription(
          "Unique key for the badge"
        )
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription(
          "Discord emoji for the badge"
        )
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("color")
        .setDescription(
          "Hex color like #FF0000"
        )
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName("label")
        .setDescription(
          "Display name for the badge"
        )
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName("description")
        .setDescription(
          "Short description"
        )
        .setRequired(false)
    ),

  getSlashArgs: (opts) => {
    const key = opts.getString(
      "key",
      true
    );

    const emoji = opts.getString(
      "emoji",
      true
    );

    const color = opts.getString(
      "color",
      false
    );

    const label = opts.getString(
      "label",
      false
    );

    const description = opts.getString(
      "description",
      false
    );

    const args = [
      key,
      emoji,
    ];

    if (color) {
      args.push(color);
    }

    if (label) {
      args.push(label);
    }

    if (description) {
      args.push(description);
    }

    return args;
  },

  async execute({
    client,
    message,
    args,
  }) {
    const {
      tick,
      cross,
      rightsort,
    } = client.emoji;

    const color =
      typeof client.getColor === "function"
        ? client.getColor(
            message.guild?.id
          )
        : undefined;

    const reply = (text) => {
      const builder = color
        ? new V2Builder(color)
        : new V2Builder();

      return message.reply(
        builder
          .text(text)
          .build()
      );
    };

    /*
     * OWNER CHECK
     */
    const owner = await checkOwner(
      message.author.id
    );

    if (!owner) {
      return reply(
        `### ${cross} Owner Only\n\n`
        + `${rightsort} This command is restricted to **Zeechei owners**.`
      );
    }

    /*
     * ARGUMENT CHECK
     */
    if (!Array.isArray(args)) {
      args = [];
    }

    /*
     * DELETE / REMOVE
     */
    const subCommand =
      String(args[0] || "")
        .toLowerCase();

    if (
      subCommand === "delete" ||
      subCommand === "remove"
    ) {
      const key = normalizeKey(
        args[1]
      );

      if (!key) {
        return reply(
          `### ${cross} Missing Key\n\n`
          + `${rightsort} Usage:\n`
          + `\`+badgecreate delete <key>\``
        );
      }

      let existing;

      try {
        existing =
          await Database.getCustomBadge(
            key
          );
      } catch (error) {
        console.error(
          "[badgecreate] getCustomBadge error:",
          error
        );

        return reply(
          `### ${cross} Database Error\n\n`
          + `${rightsort} Failed to read the badge database.`
        );
      }

      if (!existing) {
        return reply(
          `### ${cross} Badge Not Found\n\n`
          + `${rightsort} No custom badge with key `
          + `\`${key}\` exists.`
        );
      }

      try {
        await Database.removeCustomBadge(
          key
        );
      } catch (error) {
        console.error(
          "[badgecreate] removeCustomBadge error:",
          error
        );

        return reply(
          `### ${cross} Database Error\n\n`
          + `${rightsort} Failed to remove the badge.`
        );
      }

      try {
        await WebhookLogger.badgeDeleted(
          key,
          message.author.tag
        );
      } catch {
        // Logger failure should never break the command.
      }

      return reply(
        `### ${tick} Custom Badge Deleted\n\n`
        + `${rightsort} **Key:** \`${key}\`\n`
        + `${rightsort} **Label:** ${existing.label || key}\n\n`
        + `-# The badge has been removed from the registry.`
      );
    }

    /*
     * CREATE
     */
    if (args.length < 2) {
      return reply(
        `### ${cross} Missing Arguments\n\n`
        + `${rightsort} Usage:\n`
        + `\`+badgecreate <key> <emoji> [color] [label...]\``
      );
    }

    /*
     * KEY
     */
    const originalKey = args[0];

    const key = normalizeKey(
      originalKey
    );

    if (
      !key ||
      key.length < 2 ||
      key.length > 30
    ) {
      return reply(
        `### ${cross} Invalid Key\n\n`
        + `${rightsort} Key must contain `
        + `2–30 letters, numbers or underscores.\n`
        + `-# Example: \`+badgecreate legend <:legend:123456789>\``
      );
    }

    /*
     * BADGE REGISTRY CHECK
     */
    let allBadges;

    try {
      allBadges =
        await getAllBadges();
    } catch (error) {
      console.error(
        "[badgecreate] getAllBadges error:",
        error
      );

      return reply(
        `### ${cross} Badge Registry Error\n\n`
        + `${rightsort} Failed to load the badge registry.`
      );
    }

    if (
      allBadges &&
      Object.prototype.hasOwnProperty.call(
        allBadges,
        key
      )
    ) {
      return reply(
        `### ${cross} Key Already Exists\n\n`
        + `${rightsort} A badge with key `
        + `\`${key}\` already exists.\n`
        + `${rightsort} Use `
        + `\`+badgecreate delete ${key}\` `
        + `first to remove it.`
      );
    }

    /*
     * CUSTOM BADGE LIMIT
     */
    let customBadges = {};

    try {
      customBadges =
        await Database.getCustomBadges();
    } catch (error) {
      console.error(
        "[badgecreate] getCustomBadges error:",
        error
      );

      return reply(
        `### ${cross} Database Error\n\n`
        + `${rightsort} Failed to load custom badges.`
      );
    }

    const customCount =
      Object.keys(
        customBadges || {}
      ).length;

    if (
      customCount >= MAX_CUSTOM
    ) {
      return reply(
        `### ${cross} Limit Reached\n\n`
        + `${rightsort} Maximum of **${MAX_CUSTOM}** custom badges are allowed.`
      );
    }

    /*
     * EMOJI
     */
    const emoji = String(
      args[1] || ""
    ).trim();

    if (!emoji) {
      return reply(
        `### ${cross} Missing Emoji\n\n`
        + `${rightsort} Usage:\n`
        + `\`+badgecreate <key> <emoji> [color] [label...]\``
      );
    }

    /*
     * OPTIONAL DATA
     */
    let badgeColor =
      DEFAULT_COLORS[
        customCount %
        DEFAULT_COLORS.length
      ];

    const labelParts = [];

    /*
     * We don't have separate prefix/slash metadata here,
     * so detect color first and treat the rest as label.
     */
    for (
      let i = 2;
      i < args.length;
      i++
    ) {
      const value =
        String(args[i] || "").trim();

      if (!value) {
        continue;
      }

      if (
        isValidHexColor(value)
      ) {
        badgeColor = value.toUpperCase();
        continue;
      }

      labelParts.push(value);
    }

    /*
     * LABEL
     */
    const label =
      labelParts.length > 0
        ? labelParts.join(" ").slice(0, 100)
        : key
            .charAt(0)
            .toUpperCase()
          + key
              .slice(1)
              .replace(
                /_/g,
                " "
              );

    /*
     * DESCRIPTION
     */
    const badgeData = {
      label,
      emoji,
      color: badgeColor,
      description:
        `Custom badge: ${key}`,
    };

    /*
     * SAVE
     */
    try {
      await Database.addCustomBadge(
        key,
        badgeData
      );
    } catch (error) {
      console.error(
        "[badgecreate] addCustomBadge error:",
        error
      );

      return reply(
        `### ${cross} Database Error\n\n`
        + `${rightsort} Failed to save the custom badge.\n`
        + `-# The badge was not created.`
      );
    }

    /*
     * WEBHOOK LOG
     *
     * Logger failure should NEVER
     * make badge creation appear failed.
     */
    try {
      await WebhookLogger.badgeCreated(
        key,
        emoji,
        label,
        message.author.tag
      );
    } catch (error) {
      console.error(
        "[badgecreate] WebhookLogger error:",
        error
      );
    }

    /*
     * SUCCESS
     */
    return reply(
      `### ${tick} Custom Badge Created!\n\n`
      + `${rightsort} **Key:** \`${key}\`\n`
      + `${rightsort} **Emoji:** ${emoji}\n`
      + `${rightsort} **Label:** ${label}\n`
      + `${rightsort} **Color:** \`${badgeColor}\`\n\n`
      + `> Use \`+givebadge @user ${key}\` to grant it\n`
      + `> Use \`+badgecreate delete ${key}\` to remove it\n\n`
      + `-# Stored permanently in the database`
    );
  },
};