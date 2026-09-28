const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const Database = require("../../database/Database");

function isOwner(id) {
  return (
    id === config.mainOwnerId ||
    id === config.ownerId ||
    config.ownerIds?.includes(id) ||
    Database.isOwner?.(id)
  );
}

module.exports = {
  name: "commandstats",
  aliases: ["cmdstats", "usage"],
  description: "Show Zeechei command usage statistics.",
  category: "general",
  usage: "+commandstats",
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("commandstats")
    .setDescription("Show Zeechei command usage statistics."),

  getSlashArgs: () => [],

  async execute({ client, message }) {
    if (!isOwner(message.author.id)) {
      return message.reply(
        new V2Builder()
          .text("### ❌ Owner Only\n\nThis command is restricted to Zeechei owners.")
          .build()
      );
    }

    let total = 0;

    try {
      if (typeof Database.getCommandsUsed === "function") {
        total = Database.getCommandsUsed();
      }
    } catch (error) {
      console.error("[commandstats]", error);
    }

    const guilds = client.guilds.cache.size;
    const commands = client.commands.size;

    const average = guilds > 0
      ? (Number(total || 0) / guilds).toFixed(1)
      : "0";

    const text =
      `### 📊 Zeechei Command Analytics\n\n` +
      `> ⚡ **Total Commands Used:** ${Number(total || 0).toLocaleString()}\n` +
      `> 🧩 **Loaded Commands:** ${commands.toLocaleString()}\n` +
      `> 🏠 **Connected Servers:** ${guilds.toLocaleString()}\n` +
      `> 📈 **Average Usage / Server:** ${average}\n\n` +
      `**Live Runtime**\n` +
      `> 🟢 **Bot:** Online\n` +
      `> 📡 **Latency:** ${Math.round(client.ws?.ping || 0)}ms\n` +
      `> ⏱️ **Uptime:** ${Math.floor((client.uptime || 0) / 1000)}s\n\n` +
      `-# Zeechei Analytics • Owner access`;

    return message.reply(
      new V2Builder(client.getColor(message.guild?.id))
        .text(text)
        .build()
    );
  },
};