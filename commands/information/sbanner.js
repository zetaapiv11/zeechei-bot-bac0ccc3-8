const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "sbanner",
  aliases: ["serverbanner", "guildbanner"],
  description: "Shows the server banner.",
  category: "information",
  usage: "+sbanner",
  examples: ["+sbanner"],
  data: new SlashCommandBuilder()
    .setName("sbanner")
    .setDescription("Shows the server banner."),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const g     = message.guild;
    if (!g) return message.reply(client.util.v2msg(color, `${client.emoji.cross} This command can only be used in a server.`));

    const bannerUrl = g.bannerURL({ size: 4096, extension: "png", forceStatic: false });
    if (!bannerUrl)
      return message.reply(client.util.v2msg(color, `${client.emoji.cross} This server has no banner set.`));

    const iconUrl = g.iconURL({ size: 64 }) || null;

    return message.reply(
      new V2Builder(color)
        .section(`### __${g.name} — Server Banner__\n\n-# Click the image to open full size`, iconUrl)
        .sep()
        .media(bannerUrl)
        .build(),
    );
  },
};
