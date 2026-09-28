const { SlashCommandBuilder } = require("discord.js");
const Database = require("../../database/Database");
const { isOwner } = require("../../utils/OwnerHelpers");
const { buildBanner } = require("../../utils/OwnerBanner");

module.exports = {
  name: "commandstats",
  aliases: ["cmdstats", "commandcount"],
  description: "Show Zeechei command system statistics.",
  category: "settings",
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("commandstats")
    .setDescription("Show Zeechei command system statistics."),

  getSlashArgs: () => [],

  async execute({ client, message }) {
    if (!isOwner(message.author.id)) {
      return message.reply(buildBanner(client, message, {
        title: "ACCESS DENIED",
        subtitle: "Owner or authorized developer access required.",
        lines: [{ label: "Status", value: "Denied" }],
        height: 330
      }));
    }

    let tracked = "Unavailable";
    try {
      const fn = Database.getCommandStats || Database.getCommandUsage || Database.commandStats;
      if (typeof fn === "function") {
        const result = await fn.call(Database);
        if (Array.isArray(result)) tracked = String(result.length);
        else if (result && typeof result === "object") tracked = String(Object.keys(result).length);
        else tracked = String(result ?? "0");
      }
    } catch {}

    return message.reply(buildBanner(client, message, {
      title: "COMMAND STATISTICS",
      subtitle: "Live command registry and usage overview",
      lines: [
        { label: "Registered", value: String(client.commands?.size || 0) },
        { label: "Aliases", value: String(client.aliases?.size || 0) },
        { label: "Tracked Entries", value: tracked },
        { label: "Categories", value: String(new Set([...client.commands.values()].map(c => c.category).filter(Boolean)).size) },
        { label: "Developer Access", value: "5 selected owner commands" }
      ],
      height: 450
    }));
  }
};
