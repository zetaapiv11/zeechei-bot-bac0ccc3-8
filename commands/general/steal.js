const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const {
  V2Builder,
} = require("../../utils/V2Builder");

const {
  request,
} = require("undici");

module.exports = {
  name: "steal",

  aliases: [
    "stealemoji",
    "emojiadd",
  ],

  description:
    "Steal/import a custom Discord emoji into this server.",

  category: "general",

  usage:
    "+steal <emoji>",

  argsRequired: true,

  data: new SlashCommandBuilder()
    .setName("steal")
    .setDescription(
      "Import a custom emoji into this server."
    )
    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription(
          "Custom Discord emoji"
        )
        .setRequired(true)
    ),

  getSlashArgs: opts => [
    opts.getString(
      "emoji",
      true
    ),
  ],

  async execute({
    message,
    args,
  }) {
    if (!message.guild) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Server Only\n\n`
            + `> This command can only be used inside a server.`
          )
          .build()
      );
    }

    if (
      !message.guild.members.me.permissions.has(
        PermissionFlagsBits.ManageGuildExpressions
      )
    ) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Missing Permission\n\n`
            + `> Zeechei needs **Manage Expressions** permission.`
          )
          .build()
      );
    }

    const input =
      String(args[0] || "").trim();

    /*
     * Discord custom emoji:
     *
     * <:name:id>
     * <a:name:id>
     */
    const match =
      input.match(
        /^<a?:([a-zA-Z0-9_~]+):(\d+)>$/
      );

    if (!match) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Invalid Emoji\n\n`
            + `> Send a valid custom Discord emoji.\n\n`
            + `> Example: \`+steal <:emoji:123456789>\``
          )
          .build()
      );
    }

    const name =
      match[1];

    const emojiId =
      match[2];

    const animated =
      input.startsWith("<a:");

    const extension =
      animated
        ? "gif"
        : "png";

    const url =
      `https://cdn.discordapp.com/emojis/${emojiId}.${extension}?size=1024&quality=lossless`;

    try {
      const response =
        await request(url);

      if (
        response.statusCode !== 200
      ) {
        return message.reply(
          new V2Builder()
            .text(
              `### ❌ Download Failed\n\n`
              + `> Discord didn't return the emoji image.`
            )
            .build()
        );
      }

      const buffer =
        await response.body.arrayBuffer();

      const created =
        await message.guild.emojis.create({
          attachment:
            Buffer.from(buffer),

          name:
            name.slice(0, 32),
        });

      return message.reply(
        new V2Builder()
          .text(
            `### ✅ Emoji Added\n\n`
            + `> **Name:** \`${created.name}\`\n`
            + `> **ID:** \`${created.id}\`\n`
            + `> **Emoji:** ${created}\n\n`
            + `-# Added to **${message.guild.name}**`
          )
          .build()
      );

    } catch (error) {
      console.error(
        "[steal] Emoji import error:",
        error
      );

      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Couldn't Add Emoji\n\n`
            + `> I couldn't import this emoji.\n`
            + `> Check that the server has an available emoji slot and Zeechei has **Manage Expressions**.`
          )
          .build()
      );
    }
  },
};