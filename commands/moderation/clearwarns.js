const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const Database = require("../../database/Database");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "clearwarns",
  aliases: ["clearwarnings", "cw"],
  description: "Clear all warnings for a user.",
  category: "moderation",
  usage: "+clearwarns @user",
  examples: ["+clearwarns @user", "+clearwarns @member"],
  data: new SlashCommandBuilder()
    .setName("clearwarns").setDescription("Clear all warnings for a user.")
    .addUserOption(o => o.setName("user").setDescription("User to clear warnings for").setRequired(true)),
  getSlashArgs: (opts) => [`<@${opts.getUser("user").id}>`],

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to clear warnings.\n\n${E.arrow} __Permission Required__\n\`Kick Members\``)
          .build(),
      );
    }

    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You didn't mention a valid member.\n\n${E.arrow} __Usage__\n\`+clearwarns @member\`\n\n${E.arrow} __Example__\n\`+clearwarns @BadUser\``)
          .build(),
      );
    }

    const count = Database.getWarnings(message.guild.id, target.id).length;
    Database.clearWarnings(message.guild.id, target.id);

    const text =
      `### __Warnings Cleared__\n\n`
      + `${E.arrow} User\n${target.user.username} (${target.id})\n\n`
      + `${E.arrow} Count\n${count} warning${count === 1 ? "" : "s"} removed\n\n`
      + `-# Cleared by ${message.author.username}`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
