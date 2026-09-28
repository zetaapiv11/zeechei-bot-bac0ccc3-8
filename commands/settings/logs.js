const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const Database = require("../../database/Database");
const { isOwner, getDevelopers } = require("../../utils/OwnerAccess");
const { replyBanner } = require("../../utils/OwnerBanner");

module.exports = {
  name: "logs",
  aliases: [],
  category: "settings",
  description: "Show owner system logs.",
  ownerOnly: true,
  data: new SlashCommandBuilder().setName("logs").setDescription("Show owner system logs."),

  async execute({ message }) {
    if (!isOwner(message.author.id, Database)) return replyBanner(message, {
      title: "ACCESS DENIED",
      subtitle: "Owner access required.",
      rows: [{ label: "Status", value: "Denied" }]
    });

    const devs = getDevelopers();
    return replyBanner(message, {
      title: "LOGS",
      subtitle: "Zeechei owner settings system.",
      rows: [
        { label: "Main Owner", value: config.mainOwnerId },
        { label: "Static Owners", value: String(config.ownerIds?.length || 0) },
        { label: "Developers", value: String(devs.length) },
        { label: "Prefix", value: config.prefix }
      ]
    });
  }
};
