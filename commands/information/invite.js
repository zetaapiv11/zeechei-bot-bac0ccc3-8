const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const { TXT: E } = require("../../utils/emojis");

const FEATURES = [
  "High-Quality Music",
  "Playlist System",
  "Filters & Effects",
  "24/7 Mode",
  "Autoplay System",
  "Queue Management",
];

module.exports = {
  name: "invite",
  aliases: ["inv", "addbot"],
  description: "Get the invite link to add Zeechei to your server.",
  category: "information",
  usage: "+invite",
  data: new SlashCommandBuilder().setName("invite").setDescription("Get the invite link to add Zeechei to your server."),

  async execute({ client, message }) {
    const color     = client.getColor(message.guild?.id);
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

    const text =
      `### __Invite ${client.user.username}__\n\n`
      + `Add me to your server and enhance your music experience\n\n`
      + `${E.arrow} __Bot Features__\n`
      + FEATURES.map(f => `${f}`).join("\n");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Invite Me")
        .setURL(inviteUrl)
        .setStyle(ButtonStyle.Link)
        .setEmoji("↗️"),
    );

    return message.reply(
      new V2Builder(color)
        .text(text)
        .sep()
        .row(row)
        .build(),
    );
  },
};
