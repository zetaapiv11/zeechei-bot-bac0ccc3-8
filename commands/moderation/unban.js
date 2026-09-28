const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "unban",
  aliases: [],
  description: "Unban a user by ID.",
  category: "moderation",
  usage: "+unban <userId>",
  examples: ["+unban 123456789012345678"],
  data: new SlashCommandBuilder()
    .setName("unban").setDescription("Unban a user by their Discord ID.")
    .addStringOption(o => o.setName("userid").setDescription("Discord user ID").setRequired(true)),
  getSlashArgs: (opts) => [opts.getString("userid")],

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to unban members.\n\n${E.arrow} __Permission Required__\n\`Ban Members\``)
          .build(),
      );
    }

    const userId = args[0]?.replace(/\D/g, "");
    if (!userId) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ Please provide a valid user ID.\n\n${E.arrow} __Usage__\n\`+unban <userId>\`\n\n${E.arrow} __Example__\n\`+unban 123456789012345678\``)
          .build(),
      );
    }

    const ban = await message.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ No ban found for user ID \`${userId}\`.`)
          .build(),
      );
    }

    await message.guild.members.unban(userId);

    const text =
      `### __Member Unbanned__\n\n`
      + `${E.arrow} User\n${ban.user.username} (${ban.user.id})\n\n`
      + `-# Unbanned by ${message.author.username}`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
