const { SlashCommandBuilder } = require("discord.js");
const { isMainOwner } = require("../../utils/OwnerHelpers");
const { buildBanner } = require("../../utils/OwnerBanner");

module.exports = {
  name: "announce",
  aliases: ["broadcast"],
  description: "Send an owner announcement in the current channel.",
  category: "settings",
  mainOwnerOnly: true,

  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an owner announcement in the current channel.")
    .addStringOption(o =>
      o.setName("message").setDescription("Announcement text").setRequired(true)
    ),

  getSlashArgs(interaction) {
    return [interaction.options.getString("message")];
  },

  async execute({ client, message, args }) {
    if (!isMainOwner(message.author.id)) {
      return message.reply(buildBanner(client, message, {
        title: "ACCESS DENIED",
        subtitle: "Main owner only.",
        lines: [{ label: "Status", value: "Denied" }],
        height: 330
      }));
    }

    const text = String(args?.join(" ") || "").trim();
    if (!text) {
      return message.reply(buildBanner(client, message, {
        title: "INVALID ANNOUNCEMENT",
        subtitle: "Announcement text is required.",
        lines: [{ label: "Usage", value: `${message.prefix || ","}announce <message>` }],
        height: 340
      }));
    }

    const sent = await message.channel.send({
      content: text.slice(0, 2000),
      allowedMentions: { parse: [] }
    });

    return message.reply(buildBanner(client, message, {
      title: "ANNOUNCEMENT SENT",
      subtitle: "The announcement was posted successfully.",
      lines: [
        { label: "Channel", value: `#${message.channel.name}` },
        { label: "Message", value: sent.id },
        { label: "Length", value: `${text.length} characters` }
      ],
      height: 390
    }));
  }
};
