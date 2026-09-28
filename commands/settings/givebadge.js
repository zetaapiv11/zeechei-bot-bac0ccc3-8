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
  name: "givebadge",

  aliases: [
    "badgegive",
    "addbadge",
  ],

  description:
    "Give an Zeechei badge to a user.",

  category: "settings",

  usage:
    "+givebadge @user <badge>",

  argsRequired: true,

  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("givebadge")
    .setDescription(
      "[Owner] Give an Zeechei badge."
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "User to receive badge"
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
    client,
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
            + `> Only Zeechei owners can give badges.`
          )
          .build()
      );
    }

    const target =
      message.mentions.users.first();

    if (!target) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Missing User\n\n`
            + `> Usage: \`+givebadge @user <badge>\``
          )
          .build()
      );
    }

    const key =
      String(
        args[1] || args[0] || ""
      ).toLowerCase();

    const allBadges =
      getAllBadges();

    const badge =
      allBadges[key];

    if (!badge) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Badge Not Found\n\n`
            + `> \`${key}\` is not a valid Zeechei badge.\n\n`
            + `Use \`+badgelist\` to see available badges.`
          )
          .build()
      );
    }

    if (
      Database.hasBadge(
        target.id,
        key
      )
    ) {
      return message.reply(
        new V2Builder()
          .text(
            `### ⚠️ Already Has Badge\n\n`
            + `> ${target} already owns ${badge.emoji} **${badge.label}**.`
          )
          .build()
      );
    }

    Database.addBadge(
      target.id,
      key
    );

    return message.reply(
      new V2Builder()
        .text(
          `### 🏅 Badge Awarded\n\n`
          + `> **User:** ${target}\n`
          + `> **Badge:** ${badge.emoji} **${badge.label}**\n\n`
          + `-# Awarded by ${message.author}`
        )
        .build()
    );
  },
};