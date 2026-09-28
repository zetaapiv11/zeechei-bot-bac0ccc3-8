const { SlashCommandBuilder } = require("discord.js");
const Database      = require("../../database/Database");
const WebhookLogger = require("../../logger/WebhookLogger");
const config        = require("../../config");

module.exports = {
  name: "blacklist",
  aliases: ["bl"],
  description: "Add, remove, or list blacklisted users. (Owner only)",
  category: "settings",
  usage: "+blacklist <add|remove|list> [@user]",
  argsRequired: false,
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Add, remove, or list blacklisted users. (Owner only)")
    .addSubcommand(s => s.setName("add").setDescription("Blacklist a user")
      .addUserOption(o => o.setName("user").setDescription("User to blacklist").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a user from the blacklist")
      .addUserOption(o => o.setName("user").setDescription("User to unblacklist").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("Show all blacklisted users")),

  getSlashArgs: (opts) => {
    const sub    = opts.getSubcommand(false) || "toggle";
    const user   = opts.getUser?.("user") || null;
    return [sub, user?.id || null, user?.tag || null];
  },

  async execute({ client, message, args }) {
    const color  = client.getColor(message.guild?.id);
    const { tick, cross } = client.emoji;

    const sub      = (args[0] || "toggle").toLowerCase();
    const target   = message.mentions?.users?.first() || null;
    const targetId = target?.id || args.find(a => /^\d{17,20}$/.test(a)) || null;

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === "list" || sub === "ls" || sub === "show") {
      const bl = Database.getBlacklist();
      if (!bl.length) return message.reply(client.util.v2msg(color, `${tick} **Blacklist** — No users are currently blacklisted.`));
      const lines = bl.map((id, i) => `\`${i + 1}.\` <@${id}> (\`${id}\`)`).join("\n");
      return message.reply(client.util.v2msg(color, `🚫 **Blacklisted Users** (${bl.length})\n\n${lines}`));
    }

    if (!targetId) {
      return message.reply(client.util.v2msg(color,
        `${cross} **Usage:**\n` +
        `▸ \`+blacklist add @user\` — block a user\n` +
        `▸ \`+blacklist remove @user\` — unblock a user\n` +
        `▸ \`+blacklist list\` — show all blacklisted users`
      ));
    }

    // Prevent blacklisting owners
    if (config.ownerIds?.includes(targetId) || targetId === config.mainOwnerId || Database.isOwner(targetId)) {
      return message.reply(client.util.v2msg(color, `${cross} You cannot blacklist a bot owner.`));
    }

    // ── add ──────────────────────────────────────────────────────────────────
    if (sub === "add" || sub === "a") {
      if (Database.isBlacklisted(targetId)) {
        return message.reply(client.util.v2msg(color, `${cross} <@${targetId}> is already blacklisted.`));
      }
      Database.addBlacklist(targetId);
      WebhookLogger.blacklist(target?.tag || targetId, message.author.tag, true);
      return message.reply(client.util.v2msg(color,
        `${tick} **Blacklisted** — <@${targetId}> has been blocked from using the bot.`
      ));
    }

    // ── remove ───────────────────────────────────────────────────────────────
    if (sub === "remove" || sub === "rem" || sub === "r") {
      if (!Database.isBlacklisted(targetId)) {
        return message.reply(client.util.v2msg(color, `${cross} <@${targetId}> is not blacklisted.`));
      }
      Database.removeBlacklist(targetId);
      WebhookLogger.blacklist(target?.tag || targetId, message.author.tag, false);
      return message.reply(client.util.v2msg(color,
        `${tick} **Unblacklisted** — <@${targetId}> can use the bot again.`
      ));
    }

    // ── legacy toggle (no sub-command given, just +blacklist @user) ──────────
    const has = Database.isBlacklisted(targetId);
    if (has) {
      Database.removeBlacklist(targetId);
      WebhookLogger.blacklist(target?.tag || targetId, message.author.tag, false);
      return message.reply(client.util.v2msg(color,
        `${tick} **Unblacklisted** — <@${targetId}> can use the bot again.`
      ));
    } else {
      Database.addBlacklist(targetId);
      WebhookLogger.blacklist(target?.tag || targetId, message.author.tag, true);
      return message.reply(client.util.v2msg(color,
        `${tick} **Blacklisted** — <@${targetId}> has been blocked from using the bot.`
      ));
    }
  },
};
