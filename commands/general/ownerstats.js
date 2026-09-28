const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const Database = require("../../database/Database");

function isOwner(id) {
  return (
    id === config.mainOwnerId ||
    config.ownerIds?.includes(id) ||
    Database.isOwner(id)
  );
}

module.exports = {
  name: "ownerstats",
  aliases: ["ostats", "botstats"],
  description: "Shows Zeechei's complete owner statistics.",
  category: "general",
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("ownerstats")
    .setDescription("Shows Zeechei owner statistics."),

  getSlashArgs: () => [],

  async execute({ client, message }) {
    const color = client.getColor(
      message.guild?.id
    );

    if (!isOwner(message.author.id)) {
      return message.reply(
        new V2Builder(color)
          .text(
            "### ❌ Access Denied\n\n" +
            "This command is available only to Zeechei owners."
          )
          .build()
      );
    }

    const guildCount =
      client.guilds?.cache?.size || 0;

    const userCount =
      client.guilds?.cache?.reduce(
        (total, guild) =>
          total + (guild.memberCount || 0),
        0
      ) || 0;

    const commandCount =
      client.commands?.size || 0;

    const ownerCount =
      (config.ownerIds?.length || 0) +
      (Database.getOwners?.()?.length || 0);

    let premiumCount = 0;

    try {
      const premium =
        Database.getPremium?.();

      if (Array.isArray(premium)) {
        premiumCount = premium.length;
      } else if (premium && typeof premium === "object") {
        premiumCount =
          Object.keys(premium).length;
      }
    } catch {}

    const uptime = formatUptime(
      client.uptime || 0
    );

    return message.reply(
      new V2Builder(color)
        .text(
          `# 👑 Zeechei Owner Statistics\n\n` +

          `### 📊 Bot Overview\n` +
          `> **Servers:** \`${guildCount.toLocaleString()}\`\n` +
          `> **Cached Members:** \`${userCount.toLocaleString()}\`\n` +
          `> **Commands:** \`${commandCount}\`\n` +
          `> **Owners:** \`${ownerCount}\`\n` +
          `> **Premium Entries:** \`${premiumCount}\`\n\n` +

          `### ⚡ Runtime\n` +
          `> **Uptime:** \`${uptime}\`\n` +
          `> **Ping:** \`${client.ws?.ping ?? "N/A"}ms\`\n` +
          `> **Node.js:** \`${process.version}\`\n` +
          `> **Memory:** \`${formatMemory()}\`\n\n` +

          `-# Zeechei Owner System`
        )
        .build()
    );
  },
};

function formatUptime(ms) {
  let seconds = Math.floor(ms / 1000);

  const days = Math.floor(
    seconds / 86400
  );

  seconds %= 86400;

  const hours = Math.floor(
    seconds / 3600
  );

  seconds %= 3600;

  const minutes = Math.floor(
    seconds / 60
  );

  seconds %= 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatMemory() {
  const mb =
    process.memoryUsage().rss /
    1024 /
    1024;

  return `${mb.toFixed(1)} MB`;
}