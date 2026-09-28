const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const Database = require("../../database/Database");

const ACTIONS = [
  "channelDelete",
  "channelCreate",
  "roleDelete",
  "roleCreate",
  "ban",
  "kick",
  "botAdd",
  "webhook",
  "guildUpdate",
  "permission",
];

function isBotOwner(id) {
  return config.ownerIds?.includes(id) || id === config.ownerId || id === config.mainOwnerId || Database.isOwner(id);
}

function canManage(message) {
  if (!message.guild) return false;
  if (isBotOwner(message.author.id)) return true;
  if (message.author.id === message.guild.ownerId) return true;
  return Boolean(message.member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function getMentionedUser(message, args) {
  return message.mentions?.users?.first?.() || null;
}

module.exports = {
  name: "antinuke",
  aliases: ["an", "anti-nuke"],
  description: "Configure Zeechei's anti-nuke protection.",
  category: "moderation",
  usage: "+antinuke <enable|disable|status|setup|log|whitelist|unwhitelist|punishment|threshold>",
  argsRequired: false,
  examples: [
    "+antinuke setup",
    "+antinuke enable",
    "+antinuke log #security-logs",
    "+antinuke whitelist @User",
    "+antinuke punishment strip",
    "+antinuke threshold channelDelete 3",
  ],

  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Configure Zeechei's Anti-Nuke protection")
    .addStringOption(o => o.setName("action").setDescription("Action to perform").setRequired(false)
      .addChoices(
        { name: "Setup", value: "setup" },
        { name: "Enable", value: "enable" },
        { name: "Disable", value: "disable" },
        { name: "Status", value: "status" },
        { name: "Whitelist", value: "whitelist" },
        { name: "Unwhitelist", value: "unwhitelist" },
        { name: "Log Channel", value: "log" },
        { name: "Punishment", value: "punishment" },
        { name: "Threshold", value: "threshold" },
      ))
    .addUserOption(o => o.setName("user").setDescription("User for whitelist/unwhitelist").setRequired(false))
    .addChannelOption(o => o.setName("channel").setDescription("Anti-Nuke log channel").setRequired(false))
    .addStringOption(o => o.setName("type").setDescription("Threshold type").setRequired(false)
      .addChoices(...ACTIONS.map(a => ({ name: a, value: a }))))
    .addIntegerOption(o => o.setName("value").setDescription("Threshold value").setMinValue(1).setMaxValue(50).setRequired(false))
    .addStringOption(o => o.setName("mode").setDescription("Punishment mode").setRequired(false)
      .addChoices(
        { name: "Strip dangerous roles", value: "strip" },
        { name: "Kick", value: "kick" },
        { name: "Ban", value: "ban" },
      )),

  getSlashArgs: options => [
    options.getString("action") || "status",
    options.getUser("user") ? `<@${options.getUser("user").id}>` : "",
    options.getChannel("channel")?.id || "",
    options.getString("type") || "",
    options.getInteger("value")?.toString() || "",
    options.getString("mode") || "",
  ],

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);
    const { tick, cross, rightsort } = client.emoji;

    if (!message.guild) {
      return message.reply(new V2Builder(color).text(`### ${cross} Server Only\n\n${rightsort} Anti-Nuke can only be configured inside a server.`).build());
    }

    if (!canManage(message)) {
      return message.reply(new V2Builder(color).text(`### ${cross} Access Denied\n\n${rightsort} You need **Administrator** permission or bot-owner access to configure Anti-Nuke.`).build());
    }

    if (!client.antiNuke) {
      return message.reply(new V2Builder(color).text(`### ${cross} Anti-Nuke Offline\n\n${rightsort} The Anti-Nuke protection manager is not loaded.`).build());
    }

    const action = String(args?.[0] || "status").toLowerCase();
    const current = client.antiNuke.status(message.guild);

    if (action === "setup") {
      Database.setAntiNuke(message.guild.id, {
        enabled: true,
        punishment: "strip",
        windowMs: 10000,
        thresholds: {
          channelDelete: 3,
          channelCreate: 6,
          roleDelete: 3,
          roleCreate: 6,
          ban: 3,
          kick: 5,
          botAdd: 2,
          webhook: 3,
          guildUpdate: 2,
          permission: 5,
        },
      });

      return message.reply(new V2Builder(color).section(
        `### ${tick} Anti-Nuke Setup Complete\n\n`
        + `${rightsort} Protection is now **enabled**.\n`
        + `${rightsort} Default punishment: **Strip dangerous roles**\n`
        + `${rightsort} Detection window: **10 seconds**\n\n`
        + `-# Use \`+antinuke log #channel\` to enable security logs.`,
        client.user.displayAvatarURL({ size: 256 }),
      ).build());
    }

    if (action === "enable" || action === "on") {
      Database.setAntiNukeEnabled(message.guild.id, true);
      return message.reply(new V2Builder(color).text(`### ${tick} Anti-Nuke Enabled\n\n${rightsort} Zeechei is now monitoring dangerous server activity.`).build());
    }

    if (action === "disable" || action === "off") {
      Database.setAntiNukeEnabled(message.guild.id, false);
      return message.reply(new V2Builder(color).text(`### ${tick} Anti-Nuke Disabled\n\n${rightsort} Protection has been disabled for this server.`).build());
    }

    if (action === "status") {
      const s = current;
      const t = s.thresholds || {};
      const wl = Database.getAntiNukeWhitelist(message.guild.id);
      return message.reply(new V2Builder(color).text(
        `### 🛡️ Zeechei Anti-Nuke\n\n`
        + `**Status:** ${s.enabled ? "🟢 Enabled" : "🔴 Disabled"}\n`
        + `**Punishment:** \`${s.punishment || "strip"}\`\n`
        + `**Window:** \`${Math.round((s.windowMs || 10000) / 1000)}s\`\n`
        + `**Log Channel:** ${s.logChannelId ? `<#${s.logChannelId}>` : "Not configured"}\n`
        + `**Whitelist:** \`${wl.length}\` users\n\n`
        + `**Thresholds**\n`
        + `• Channel delete: \`${t.channelDelete}\`\n`
        + `• Channel create: \`${t.channelCreate}\`\n`
        + `• Role delete: \`${t.roleDelete}\`\n`
        + `• Role create: \`${t.roleCreate}\`\n`
        + `• Mass ban: \`${t.ban}\`\n`
        + `• Mass kick: \`${t.kick}\`\n`
        + `• Bot add: \`${t.botAdd}\`\n`
        + `• Webhook: \`${t.webhook}\`\n`
        + `• Server update: \`${t.guildUpdate}\`\n`
        + `• Permission abuse: \`${t.permission}\``
      ).build());
    }

    if (action === "log") {
      const channelId = message.mentions?.channels?.first?.()?.id || args?.[1] || args?.[2];
      if (!channelId) {
        return message.reply(new V2Builder(color).text(`### ${cross} Missing Channel\n\n${rightsort} Use \`+antinuke log #security-logs\`.`).build());
      }
      const channel = message.guild.channels.cache.get(channelId);
      if (!channel?.isTextBased?.()) {
        return message.reply(new V2Builder(color).text(`### ${cross} Invalid Channel\n\n${rightsort} Please select a text-based channel.`).build());
      }
      Database.setAntiNukeLogChannel(message.guild.id, channel.id);
      return message.reply(new V2Builder(color).text(`### ${tick} Security Logs Set\n\n${rightsort} Anti-Nuke alerts will be sent to <#${channel.id}>.`).build());
    }

    if (action === "whitelist" || action === "unwhitelist") {
      const target = getMentionedUser(message, args);
      if (!target) {
        return message.reply(new V2Builder(color).text(`### ${cross} User Required\n\n${rightsort} Mention a user. Example: \`+antinuke whitelist @User\`.`).build());
      }
      if (target.id === message.guild.ownerId || target.id === config.mainOwnerId || config.ownerIds?.includes(target.id)) {
        return message.reply(new V2Builder(color).text(`### ${tick} Already Trusted\n\n${rightsort} This user is already protected by Zeechei's owner/server-owner trust system.`).build());
      }
      if (action === "whitelist") {
        Database.addAntiNukeWhitelist(message.guild.id, target.id);
        return message.reply(new V2Builder(color).text(`### ${tick} User Whitelisted\n\n${rightsort} <@${target.id}> will be ignored by Anti-Nuke.`).build());
      }
      Database.removeAntiNukeWhitelist(message.guild.id, target.id);
      return message.reply(new V2Builder(color).text(`### ${tick} User Removed\n\n${rightsort} <@${target.id}> is no longer whitelisted.`).build());
    }

    if (action === "punishment") {
      const mode = String(args?.[5] || args?.[1] || "").toLowerCase();
      if (!["strip", "kick", "ban"].includes(mode)) {
        return message.reply(new V2Builder(color).text(`### ${cross} Invalid Punishment\n\n${rightsort} Choose: \`strip\`, \`kick\`, or \`ban\`.`).build());
      }
      Database.setAntiNukePunishment(message.guild.id, mode);
      return message.reply(new V2Builder(color).text(`### ${tick} Punishment Updated\n\n${rightsort} Anti-Nuke punishment is now **${mode}**.`).build());
    }

    if (action === "threshold") {
      const type = String(args?.[3] || args?.[1] || "");
      const value = Number(args?.[4] || args?.[2]);
      if (!ACTIONS.includes(type) || !Number.isInteger(value) || value < 1 || value > 50) {
        return message.reply(new V2Builder(color).text(`### ${cross} Invalid Threshold\n\n${rightsort} Example: \`+antinuke threshold channelDelete 3\``).build());
      }
      Database.setAntiNukeThreshold(message.guild.id, type, value);
      return message.reply(new V2Builder(color).text(`### ${tick} Threshold Updated\n\n${rightsort} **${type}** threshold is now **${value} actions**.`).build());
    }

    return message.reply(new V2Builder(color).text(
      `### 🛡️ Anti-Nuke Commands\n\n`
      + `\`+antinuke setup\` — enable secure defaults\n`
      + `\`+antinuke enable\` / \`disable\`\n`
      + `\`+antinuke status\`\n`
      + `\`+antinuke log #channel\`\n`
      + `\`+antinuke whitelist @user\`\n`
      + `\`+antinuke unwhitelist @user\`\n`
      + `\`+antinuke punishment strip|kick|ban\`\n`
      + `\`+antinuke threshold channelDelete 3\``
    ).build());
  },
};
