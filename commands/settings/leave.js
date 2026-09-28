const { SlashCommandBuilder } = require("discord.js");
const { isMainOwner } = require("../../utils/OwnerHelpers");
const { buildBanner } = require("../../utils/OwnerBanner");

module.exports = {
  name: "leave",
  aliases: ["leaveguild"],
  description: "Make Zeechei leave the current server.",
  category: "settings",
  mainOwnerOnly: true,

  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Make Zeechei leave the current server."),

  getSlashArgs: () => [],

  async execute({ client, message }) {
    if (!isMainOwner(message.author.id)) {
      return message.reply(buildBanner(client, message, {
        title: "ACCESS DENIED",
        subtitle: "Main owner only.",
        lines: [{ label: "Status", value: "Denied" }],
        height: 330
      }));
    }

    const guild = message.guild;
    await message.reply(buildBanner(client, message, {
      title: "LEAVING SERVER",
      subtitle: "Zeechei is leaving this server.",
      lines: [
        { label: "Server", value: guild.name },
        { label: "Server ID", value: guild.id },
        { label: "Action", value: "Leave requested" }
      ],
      height: 390
    }));

    setTimeout(() => guild.leave().catch(() => {}), 900);
  }
};
