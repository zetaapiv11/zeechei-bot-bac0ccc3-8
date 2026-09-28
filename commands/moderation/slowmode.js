const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "slowmode",
  aliases: ["sm", "slow"],
  description: "Set channel slowmode (0 to disable).",
  category: "moderation",
  usage: "+slowmode <seconds>",
  examples: ["+slowmode 5", "+slowmode 0", "+slowmode 30"],
  data: new SlashCommandBuilder()
    .setName("slowmode").setDescription("Set channel slowmode.")
    .addIntegerOption(o => o.setName("seconds").setDescription("Seconds (0 to disable)").setMinValue(0).setMaxValue(21600).setRequired(true)),
  getSlashArgs: (opts) => [String(opts.getInteger("seconds"))],

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to set slowmode.\n\n${E.arrow} __Permission Required__\n\`Manage Channels\``)
          .build(),
      );
    }

    const secs = parseInt(args[0]);
    if (isNaN(secs) || secs < 0 || secs > 21600) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ Please provide a value between \`0\` and \`21600\` seconds.\n\n${E.arrow} __Usage__\n\`+slowmode <seconds>\`\n\n${E.arrow} __Example__\n\`+slowmode 5\``)
          .build(),
      );
    }

    await message.channel.setRateLimitPerUser(secs);

    const durStr = secs === 0 ? "Disabled"
      : secs < 60  ? `${secs} second${secs === 1 ? "" : "s"}`
      : secs < 3600 ? `${Math.floor(secs / 60)} minute${Math.floor(secs / 60) === 1 ? "" : "s"}`
      : `${Math.floor(secs / 3600)} hour${Math.floor(secs / 3600) === 1 ? "" : "s"}`;

    const text =
      `### __Slowmode Updated__\n\n`
      + `${E.arrow} Channel\n<#${message.channel.id}>\n\n`
      + `${E.arrow} Duration\n${durStr}\n\n`
      + `-# Set by ${message.author.username}`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
