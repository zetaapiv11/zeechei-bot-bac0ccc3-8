const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "lock",
  aliases: ["lockdown"],
  description: "Lock a channel — members can't send messages.",
  category: "moderation",
  usage: "+lock [#channel]",
  data: new SlashCommandBuilder()
    .setName("lock").setDescription("Lock a channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to lock (defaults to current)")),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to lock channels.\n\n${E.arrow} __Permission Required__\n\`Manage Channels\``)
          .build(),
      );
    }

    const ch = message.mentions.channels.first() || message.channel;
    await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });

    const text =
      `### __Channel Locked__\n\n`
      + `${E.arrow} Channel\n<#${ch.id}>\n\n`
      + `${E.arrow} Status\nMembers can no longer send messages.\n\n`
      + `-# Locked by ${message.author.username}`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
