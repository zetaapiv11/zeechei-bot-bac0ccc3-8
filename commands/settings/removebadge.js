const {
  SlashCommandBuilder,
} = require("discord.js");

const {
  V2Builder,
} = require("../../utils/V2Builder");

const {
  getAllBadges,
} = require("../../utils/badges");

const Database =
  require("../../database/Database");

const config =
  require("../../config");

module.exports = {
  name: "removebadge",

  aliases: [
    "badge-remove",
    "delbadge",
  ],

  description:
    "Remove an Zeechei badge from a user.",

  category: "settings",

  usage:
    "+removebadge @user <badge>",

  argsRequired: true,

  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("removebadge")
    .setDescription(
      "[Owner] Remove a badge."
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "User"
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("badge")
        .setDescription(
          "Badge key"
        )
        .setRequired(true)
    ),

  getSlashArgs: opts => [
    `<@${opts.getUser(
      "user",
      true
    ).id}>`,
    opts.getString(
      "badge",
      true
    ),
  ],

  async execute({
    message,
    args,
  }) {
    const owner =
      Database.isOwner(
        message.author.id
      )
      || config.ownerIds?.includes(
        message.author.id
      )
      || message.author.id ===
        config.mainOwnerId;

    if (!owner) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Owner Only\n\n`
            + `> Only Zeechei owners can remove badges.`
          )
          .build()
      );
    }

    const target =
      message.mentions.users.first();

    const key =
      String(
        args[1] || args[0] || ""
      ).toLowerCase();

    if (!target || !key) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Missing Arguments\n\n`
            + `> Usage: \`+removebadge @user <badge>\``
          )
          .build()
      );
    }

    const badge =
      getAllBadges()[key];

    if (!badge) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Badge Not Found\n\n`
            + `> \`${key}\` does not exist.`
          )
          .build()
      );
    }

    const removed =
      Database.removeBadge(
        target.id,
        key
      );

    if (!removed) {
      return message.reply(
        new V2Builder()
          .text(
            `### ⚠️ Badge Not Found\n\n`
            + `> ${target} doesn't have this badge.`
          )
          .build()
      );
    }

    return message.reply(
      new V2Builder()
        .text(
          `### ✅ Badge Removed\n\n`
          + `> **User:** ${target}\n`
          + `> **Badge:** ${badge.emoji} **${badge.label}**`
        )
        .build()
    );
  },
};