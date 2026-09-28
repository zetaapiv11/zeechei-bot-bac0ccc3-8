const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "purge",
  aliases: ["clear", "bulkdelete"],
  description: "Delete multiple messages at once (1–100).",
  category: "moderation",
  usage: "+purge <amount>",
  examples: ["+purge 10", "+purge 50", "+purge 100"],
  data: new SlashCommandBuilder()
    .setName("purge").setDescription("Delete multiple messages at once.")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)),
  getSlashArgs: (opts) => [String(opts.getInteger("amount"))],

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to delete messages.\n\n${E.arrow} __Permission Required__\n\`Manage Messages\``)
          .build(),
      );
    }

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ Please provide a number between **1** and **100**.\n\n${E.arrow} __Usage__\n\`+purge <amount>\`\n\n${E.arrow} __Example__\n\`+purge 10\``)
          .build(),
      );
    }

    await message.delete().catch(() => {});
    const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) return;

    const text =
      `### __Messages Purged__\n\n`
      + `${E.arrow} Deleted\n${deleted.size} message${deleted.size === 1 ? "" : "s"}\n\n`
      + `${E.arrow} Channel\n<#${message.channel.id}>\n\n`
      + `-# Purged by ${message.author.username}`;

    const m = await message.channel.send(new V2Builder(color).text(text).build());
    setTimeout(() => m.delete().catch(() => {}), 5000);
  },
};
