const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "unmute",
  aliases: ["untimeout"],
  description: "Remove timeout from a member.",
  category: "moderation",
  usage: "+unmute @user",
  examples: ["+unmute @user", "+unmute @member"],
  data: new SlashCommandBuilder()
    .setName("unmute").setDescription("Remove timeout from a member.")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true)),
  getSlashArgs: (opts) => [`<@${opts.getUser("user").id}>`],

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to remove timeouts.\n\n${E.arrow} __Permission Required__\n\`Moderate Members\``)
          .build(),
      );
    }

    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You didn't mention a valid member.\n\n${E.arrow} __Usage__\n\`+unmute @member\`\n\n${E.arrow} __Example__\n\`+unmute @User\``)
          .build(),
      );
    }

    if (!target.isCommunicationDisabled()) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ **${target.user.username}** is not currently muted.`)
          .build(),
      );
    }

    await target.timeout(null);

    // DM after unmute
    const notified = await target.user.send(
      new V2Builder(color)
        .section(
          `### __Your mute has been lifted__ 🔊\n\n`
          + `${E.arrow} __Server__\n${message.guild.name}\n\n`
          + `${E.arrow} __Unmuted by__\n${message.author.username}\n\n`
          + `-# You can now send messages and join voice channels again`,
          message.guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 }),
        ).build(),
    ).then(() => true).catch(() => false);

    return message.reply(
      new V2Builder(color)
        .section(
          `### __Member Unmuted__\n\n`
          + `${E.arrow} __User__\n${target.user.username} (${target.id})\n\n`
          + `${E.arrow} __Status__\nTimeout removed successfully.\n\n`
          + `-# Unmuted by ${message.author.username} · Notified: ${notified ? "Yes" : "No (DMs off)"}`,
          target.user.displayAvatarURL({ size: 256 }),
        ).build(),
    );
  },
};
