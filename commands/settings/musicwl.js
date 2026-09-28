const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const Database = require("../../database/Database");
const config   = require("../../config");
const { TXT }  = require("../../utils/emojis");

function isServerOwner(userId, guild) {
  return userId === guild.ownerId;
}
function isBotOwner(userId) {
  return config.ownerIds?.includes(userId) || userId === config.mainOwnerId || Database.isOwner(userId);
}
function canManageWL(userId, guild) {
  return isServerOwner(userId, guild) || isBotOwner(userId);
}

module.exports = {
  name: "musicwl",
  aliases: ["mwl", "musicwhitelist"],
  description: "Manage the music whitelist — users who can play music even when music is disabled.",
  category: "settings",
  usage: "+musicwl <add|remove|list|clear> [@user]",
  argsRequired: false,
  ownerOnly: false,

  data: new SlashCommandBuilder()
    .setName("musicwl")
    .setDescription("Manage the music whitelist for when music is disabled.")
    .addSubcommand(s => s.setName("add").setDescription("Whitelist a user")
      .addUserOption(o => o.setName("user").setDescription("User to whitelist").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a user from the whitelist")
      .addUserOption(o => o.setName("user").setDescription("User to remove").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List all whitelisted users"))
    .addSubcommand(s => s.setName("clear").setDescription("Clear the entire music whitelist")),

  getSlashArgs: (opts) => {
    const sub  = opts.getSubcommand(false) || "list";
    const user = opts.getUser?.("user") || null;
    return [sub, user?.id || null, user?.tag || null];
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort, warning } = client.emoji;
    const color = client.getColor(message.guild?.id);
    const guild = message.guild;

    if (!canManageWL(message.author.id, guild)) {
      return message.reply(client.util.v2msg(color,
        `${cross} **Permission Denied**\n\n`
        + `${rightsort} Only the **Server Owner** or **Bot Owners** can manage the music whitelist.`,
      ));
    }

    const sub      = (args[0] || "list").toLowerCase();
    const target   = message.mentions?.users?.first() || null;
    const targetId = target?.id || args.find(a => /^\d{17,20}$/.test(a)) || null;
    const prefix   = message.prefix || "+";

    if (sub === "list") {
      const wl = Database.getMusicWL(guild.id);
      if (!wl.length) {
        return message.reply(client.util.v2msg(color,
          `### 🎵 __Music Whitelist__ — ${guild.name}\n\n`
          + `${rightsort} No users are currently whitelisted.\n\n`
          + `> Whitelisted users can play music even when music is **disabled**.\n`
          + `-# Use \`${prefix}musicwl add @user\` to add someone`,
        ));
      }
      const lines = wl.map((id, i) => `\`${i + 1}.\` <@${id}> (\`${id}\`)`).join("\n");
      return message.reply(client.util.v2msg(color,
        `### 🎵 __Music Whitelist__ — ${guild.name}\n\n`
        + `${rightsort} **${wl.length}** user${wl.length === 1 ? "" : "s"} whitelisted:\n\n`
        + `${lines}\n\n`
        + `-# These users can play music even when music is disabled`,
      ));
    }

    if (sub === "clear") {
      Database.clearMusicWL(guild.id);
      return message.reply(client.util.v2msg(color,
        `${tick} **Music Whitelist Cleared**\n\n`
        + `${rightsort} All users have been removed from the whitelist for **${guild.name}**.`,
      ));
    }

    if (!targetId) {
      return message.reply(client.util.v2msg(color,
        `${cross} **Missing User**\n\n`
        + `${rightsort} **Usage:**\n`
        + `> \`${prefix}musicwl add @user\` — whitelist a user\n`
        + `> \`${prefix}musicwl remove @user\` — remove from whitelist\n`
        + `> \`${prefix}musicwl list\` — view all whitelisted users\n`
        + `> \`${prefix}musicwl clear\` — clear entire whitelist`,
      ));
    }

    if (sub === "add") {
      if (Database.isMusicWL(guild.id, targetId)) {
        return message.reply(client.util.v2msg(color,
          `${cross} <@${targetId}> is already on the music whitelist.`,
        ));
      }
      Database.addMusicWL(guild.id, targetId);
      return message.reply(client.util.v2msg(color,
        `${tick} **Whitelisted** — <@${targetId}> can now play music even when music is disabled.`,
      ));
    }

    if (sub === "remove" || sub === "rem" || sub === "r") {
      if (!Database.isMusicWL(guild.id, targetId)) {
        return message.reply(client.util.v2msg(color,
          `${cross} <@${targetId}> is not on the music whitelist.`,
        ));
      }
      Database.removeMusicWL(guild.id, targetId);
      return message.reply(client.util.v2msg(color,
        `${tick} **Removed** — <@${targetId}> has been removed from the music whitelist.`,
      ));
    }

    return message.reply(client.util.v2msg(color,
      `${cross} Unknown subcommand \`${sub}\`. Use \`add\`, \`remove\`, \`list\`, or \`clear\`.`,
    ));
  },
};
