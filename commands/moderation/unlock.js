const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "unlock",
  aliases: [],
  description: "Unlock a channel.",
  category: "moderation",
  usage: "+unlock [#channel]",
  data: new SlashCommandBuilder()
    .setName("unlock").setDescription("Unlock a channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to unlock (defaults to current)")),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to unlock channels.\n\n${E.arrow} __Permission Required__\n\`Manage Channels\``)
          .build(),
      );
    }

    const ch = message.mentions.channels.first() || message.channel;
    await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });

    const text =
      `### __Channel Unlocked__\n\n`
      + `${E.arrow} Channel\n<#${ch.id}>\n\n`
      + `${E.arrow} Status\nMembers can send messages again.\n\n`
      + `-# Unlocked by ${message.author.username}`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
