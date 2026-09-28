const { SlashCommandBuilder } = require("discord.js");
const { V2Builder }          = require("../../utils/V2Builder");
const { BADGES, allBadgeKeys } = require("../../utils/badges");
const Database               = require("../../database/Database");

module.exports = {
  name: "givebadgeall",
  aliases: ["allbadges", "badge+all", "giveallbadges"],
  description: "[Owner only] Give ALL badges to a user at once.",
  category: "settings",
  usage: "+givebadgeall <@user>",
  argsRequired: true,
  ownerOnly: true,
  examples: ["+givebadgeall @user"],
  data: new SlashCommandBuilder()
    .setName("givebadgeall")
    .setDescription("[Owner] Give every badge to a user.")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true)),
  getSlashArgs: (opts) => [opts.getUser("user", true).id],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort, warning } = client.emoji;
    const cfg = require("../../config");

    // ── Owner check ────────────────────────────────────────────────────────────
    const isOwner =
      Database.isOwner(message.author.id) ||
      cfg.ownerIds?.includes(message.author.id) ||
      message.author.id === cfg.mainOwnerId;

    if (!isOwner) {
      return message.reply(
        new V2Builder()
          .text(`### ${cross} Owner Only\n\n${rightsort} This command is restricted to Zeechei owners.`)
          .build(),
      );
    }

    // ── Resolve target ─────────────────────────────────────────────────────────
    const targetId = message.mentions.users.first()?.id || args[0]?.replace(/\D/g, "");
    if (!targetId) {
      return message.reply(
        new V2Builder()
          .text(`### ${cross} Missing User\n\n${rightsort} Usage: \`+givebadgeall <@user>\``)
          .build(),
      );
    }

    const target = await client.users.fetch(targetId).catch(() => null);
    if (!target) {
      return message.reply(
        new V2Builder()
          .text(`### ${cross} User Not Found\n\n${rightsort} Could not find a user with that ID.`)
          .build(),
      );
    }

    // ── Give all badges ────────────────────────────────────────────────────────
    const allKeys   = allBadgeKeys();
    const already   = new Set(Database.getUserBadges(target.id));
    const added     = [];
    const skipped   = [];

    for (const key of allKeys) {
      if (already.has(key)) {
        skipped.push(key);
      } else {
        Database.addBadge(target.id, key);
        added.push(key);
      }
    }

    const addedLine   = added.map(k => `${BADGES[k].emoji} ${BADGES[k].label}`).join("\n");
    const skippedLine = skipped.length ? `\n${rightsort} **Already had:** ${skipped.map(k => BADGES[k].emoji).join(" ")}` : "";

    const totalNow = Database.getUserBadges(target.id).length;

    return message.reply(
      new V2Builder()
        .section(
          `### ${tick} All Badges Given!\n\n`
          + `${rightsort} **${target.username}** now has all **${totalNow}** badges:\n\n`
          + addedLine
          + (added.length < allKeys.length ? `\n\n${warning} ${added.length} new, ${skipped.length} already owned.` : "")
          + skippedLine
          + `\n\n-# Use \`+profile @${target.username}\` to see their card.`,
          target.displayAvatarURL({ size: 256 }),
        )
        .build(),
    );
  },
};
