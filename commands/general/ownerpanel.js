const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const Database = require("../../database/Database");

function getMainOwnerId() {
  return config.mainOwnerId || config.ownerId || config.owner || null;
}

function getConfiguredOwners() {
  return Array.isArray(config.ownerIds) ? config.ownerIds : [];
}

function isBotOwner(userId) {
  const configured = getConfiguredOwners();

  return (
    userId === getMainOwnerId() ||
    configured.includes(userId) ||
    Boolean(Database.isOwner?.(userId))
  );
}

function formatNumber(number) {
  return Number(number || 0).toLocaleString("en-US");
}

function formatUptime(ms) {
  if (!ms || ms < 0) return "Unknown";

  const seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

function getMemoryUsage() {
  const memory = process.memoryUsage();

  return {
    rss: (memory.rss / 1024 / 1024).toFixed(1),
    heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(1),
    heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(1),
  };
}

module.exports = {
  name: "ownerpanel",
  aliases: ["opanel", "op", "owner"],
  description: "Show the Zeechei owner control panel.",
  category: "general",
  usage: "+ownerpanel",
  ownerOnly: true,
  examples: [
    "+ownerpanel",
  ],

  data: new SlashCommandBuilder()
    .setName("ownerpanel")
    .setDescription("Show the Zeechei owner control panel."),

  getSlashArgs: () => [],

  async execute({ client, message }) {
    const userId = message.author.id;

    // ─────────────────────────────────────────────
    // OWNER CHECK
    // ─────────────────────────────────────────────

    if (!isBotOwner(userId)) {
      const color = client.getColor(message.guild?.id);

      return message.reply(
        new V2Builder(color)
          .text(
            `### ${client.emoji?.cross || "❌"} Access Denied\n\n` +
            `${client.emoji?.rightsort || "➜"} This command is restricted to **Zeechei owners**.`
          )
          .build()
      );
    }

    const color = client.getColor(message.guild?.id);

    // ─────────────────────────────────────────────
    // BOT INFORMATION
    // ─────────────────────────────────────────────

    const guilds = client.guilds?.cache?.size || 0;
    const channels = client.channels?.cache?.size || 0;
    const commands = client.commands?.size || 0;

    let users = 0;

    for (const guild of client.guilds?.cache?.values?.() || []) {
      users += guild.memberCount || 0;
    }

    // ─────────────────────────────────────────────
    // DATABASE STATS
    // ─────────────────────────────────────────────

    let commandsUsed = 0;

    try {
      if (typeof Database.getCommandsUsed === "function") {
        commandsUsed = Database.getCommandsUsed();
      }
    } catch (error) {
      console.error("[ownerpanel] getCommandsUsed:", error);
    }

    // ─────────────────────────────────────────────
    // OWNER STATS
    // ─────────────────────────────────────────────

    let databaseOwners = [];

    try {
      if (typeof Database.getOwners === "function") {
        databaseOwners = Database.getOwners();
      }
    } catch (error) {
      console.error("[ownerpanel] getOwners:", error);
    }

    const configuredOwners = getConfiguredOwners();

    const allOwnerIds = [
      ...new Set([
        ...configuredOwners,
        ...databaseOwners,
        getMainOwnerId(),
      ].filter(Boolean)),
    ];

    // ─────────────────────────────────────────────
    // SYSTEM STATS
    // ─────────────────────────────────────────────

    const memory = getMemoryUsage();

    const uptime = formatUptime(client.uptime);

    const ping =
      client.ws?.ping !== undefined
        ? `${Math.round(client.ws.ping)}ms`
        : "Unknown";

    const nodeVersion = process.version;

    // ─────────────────────────────────────────────
    // MUSIC / LAVALINK STATUS
    // ─────────────────────────────────────────────

    let musicStatus = "🟡 Unknown";

    try {
      if (client.lavalink) {
        musicStatus = "🟢 Available";
      } else {
        musicStatus = "🔴 Not Loaded";
      }
    } catch {
      musicStatus = "🟡 Unknown";
    }

    // ─────────────────────────────────────────────
    // DATABASE STATUS
    // ─────────────────────────────────────────────

    let databaseStatus = "🟢 Online";

    try {
      if (
        typeof Database.getCommandsUsed !== "function" ||
        typeof Database.isOwner !== "function"
      ) {
        databaseStatus = "🟡 Limited";
      }
    } catch {
      databaseStatus = "🟡 Limited";
    }

    // ─────────────────────────────────────────────
    // OWNER DISPLAY
    // ─────────────────────────────────────────────

    const ownerDisplay = allOwnerIds.length
      ? allOwnerIds
          .slice(0, 10)
          .map(id => `<@${id}>`)
          .join(" • ")
      : "No owners found";

    // ─────────────────────────────────────────────
    // DASHBOARD
    // ─────────────────────────────────────────────

    const body =
      `### 👑 Zeechei Owner Panel\n\n` +

      `**Bot Overview**\n` +
      `> 🤖 **Bot:** ${client.user?.tag || "Zeechei"}\n` +
      `> 🏠 **Servers:** ${formatNumber(guilds)}\n` +
      `> 👥 **Members:** ${formatNumber(users)}\n` +
      `> 💬 **Channels:** ${formatNumber(channels)}\n` +
      `> ⚡ **Commands:** ${formatNumber(commands)}\n` +
      `> 📊 **Commands Used:** ${formatNumber(commandsUsed)}\n\n` +

      `**System**\n` +
      `> 🟢 **Discord:** ${ping}\n` +
      `> ⏱️ **Uptime:** ${uptime}\n` +
      `> 🧠 **RAM:** ${memory.rss} MB\n` +
      `> 📦 **Heap:** ${memory.heapUsed} / ${memory.heapTotal} MB\n` +
      `> 🟦 **Node:** ${nodeVersion}\n\n` +

      `**Services**\n` +
      `> 💾 **Database:** ${databaseStatus}\n` +
      `> 🎵 **Music System:** ${musicStatus}\n\n` +

      `**Owners**\n` +
      `> ${ownerDisplay}\n\n` +

      `**Main Owner**\n` +
      `> ${getMainOwnerId() ? `<@${getMainOwnerId()}>` : "Not configured"}\n\n` +

      `-# Zeechei Owner System • Private Control Panel`;

    // ─────────────────────────────────────────────
    // SEND
    // ─────────────────────────────────────────────

    return message.reply(
      new V2Builder(color)
        .section(
          body,
          client.user?.displayAvatarURL?.({
            size: 256,
            extension: "png",
          })
        )
        .build()
    );
  },
};