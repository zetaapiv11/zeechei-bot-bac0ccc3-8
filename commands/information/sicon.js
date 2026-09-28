const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "sicon",
  aliases: ["servericon", "guildicon", "icon"],
  description: "Shows the server icon.",
  category: "information",
  usage: "+sicon",
  examples: ["+sicon"],
  data: new SlashCommandBuilder()
    .setName("sicon")
    .setDescription("Shows the server icon."),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const g     = message.guild;
    if (!g) return message.reply(client.util.v2msg(color, `${client.emoji.cross} This command can only be used in a server.`));

    const iconUrl = g.iconURL({ size: 4096, extension: "png", forceStatic: false });
    if (!iconUrl)
      return message.reply(client.util.v2msg(color, `${client.emoji.cross} This server has no icon set.`));

    return message.reply(
      new V2Builder(color)
        .section(`### __${g.name} — Server Icon__\n\n-# Click the image to open full size`, iconUrl)
        .sep()
        .media(iconUrl)
        .build(),
    );
  },
};
