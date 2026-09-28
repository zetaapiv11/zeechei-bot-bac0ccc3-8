const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "ban",
  aliases: ["banish"],
  description: "Ban a member from the server.",
  category: "moderation",
  usage: "+ban @user [reason]",
  examples: ["+ban @user Spamming", "+ban @user Breaking rules"],
  data: new SlashCommandBuilder()
    .setName("ban").setDescription("Ban a member from the server.")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Ban reason")),
  getSlashArgs: (opts) => { const r = opts.getString("reason") || ""; return [`<@${opts.getUser("user").id}>`, ...r.split(" ")]; },

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to ban members.\n\n${E.arrow} __Permission Required__\n\`Ban Members\``)
          .build(),
      );
    }

    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You didn't provide a valid user.\n\n${E.arrow} __Usage__\n\`+ban @user [reason]\`\n\n${E.arrow} __Example__\n\`+ban @user Spamming\``)
          .build(),
      );
    }

    if (!target.bannable) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ I cannot ban **${target.user.username}** — they may have a higher role than me.`)
          .build(),
      );
    }

    const reason = args.slice(1).join(" ").trim() || "No Reason Provided";

    // DM before ban (can't DM after)
    const notified = await target.user.send(
      new V2Builder(0xe74c3c)
        .section(
          `### __You have been banned__ 🔨\n\n`
          + `${E.arrow} __Server__\n${message.guild.name}\n\n`
          + `${E.arrow} __Reason__\n${reason}\n\n`
          + `${E.arrow} __Banned by__\n${message.author.username}\n\n`
          + `-# If you believe this is a mistake, contact the server staff`,
          message.guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 }),
        ).build(),
    ).then(() => true).catch(() => false);

    await target.ban({ reason });

    return message.reply(
      new V2Builder(color)
        .section(
          `### __Member Banned__\n\n`
          + `${E.arrow} __User__\n${target.user.username} (${target.id})\n\n`
          + `${E.arrow} __Reason__\n${reason}\n\n`
          + `-# Banned by ${message.author.username} · Notified: ${notified ? "Yes" : "No (DMs off)"}`,
          target.user.displayAvatarURL({ size: 256 }),
        ).build(),
    );
  },
};
