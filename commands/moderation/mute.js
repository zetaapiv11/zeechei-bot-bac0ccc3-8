const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "mute",
  aliases: ["timeout"],
  description: "Timeout (mute) a member.",
  category: "moderation",
  usage: "+mute @user [minutes] [reason]",
  examples: ["+mute @user 10 Spamming", "+mute @user 60 Harassment"],
  data: new SlashCommandBuilder()
    .setName("mute").setDescription("Timeout (mute) a member.")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes (default 10)").setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Mute reason")),
  getSlashArgs: (opts) => { const m = opts.getInteger("minutes") || 10; const r = opts.getString("reason") || ""; return [`<@${opts.getUser("user").id}>`, String(m), ...r.split(" ")]; },

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to timeout members.\n\n${E.arrow} __Permission Required__\n\`Moderate Members\``)
          .build(),
      );
    }

    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You didn't mention a valid member.\n\n${E.arrow} __Usage__\n\`+mute @member [minutes] [reason]\`\n\n${E.arrow} __Example__\n\`+mute @BadUser 10 Spamming\``)
          .build(),
      );
    }

    const minutes = parseInt(args[1]) || 10;
    const reason  = args.slice(2).join(" ").trim() || "No Reason Provided";
    const until   = Math.floor((Date.now() + minutes * 60 * 1000) / 1000);

    const durStr = minutes >= 60
      ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ""}`
      : `${minutes} minute${minutes === 1 ? "" : "s"}`;

    await target.timeout(minutes * 60 * 1000, reason);

    // DM after timeout applied
    const notified = await target.user.send(
      new V2Builder(0xe74c3c)
        .section(
          `### __You have been muted__ 🔇\n\n`
          + `${E.arrow} __Server__\n${message.guild.name}\n\n`
          + `${E.arrow} __Duration__\n${durStr}\n\n`
          + `${E.arrow} __Reason__\n${reason}\n\n`
          + `${E.arrow} __Muted by__\n${message.author.username}\n\n`
          + `-# Timeout expires <t:${until}:R>`,
          message.guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 }),
        ).build(),
    ).then(() => true).catch(() => false);

    return message.reply(
      new V2Builder(color)
        .section(
          `### __Member Muted__\n\n`
          + `${E.arrow} __User__\n${target.user.username} (${target.id})\n\n`
          + `${E.arrow} __Duration__\n${durStr}\n\n`
          + `${E.arrow} __Reason__\n${reason}\n\n`
          + `-# Muted by ${message.author.username} · Expires <t:${until}:R> · Notified: ${notified ? "Yes" : "No (DMs off)"}`,
          target.user.displayAvatarURL({ size: 256 }),
        ).build(),
    );
  },
};
