const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "kick",
  aliases: [],
  description: "Kick a member from the server.",
  category: "moderation",
  usage: "+kick @user [reason]",
  examples: ["+kick @user Misbehaving", "+kick @user Harassment"],
  data: new SlashCommandBuilder()
    .setName("kick").setDescription("Kick a member from the server.")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Kick reason")),
  getSlashArgs: (opts) => { const r = opts.getString("reason") || ""; return [`<@${opts.getUser("user").id}>`, ...r.split(" ")]; },

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You don't have permission to kick members.\n\n${E.arrow} __Permission Required__\n\`Kick Members\``)
          .build(),
      );
    }

    const target = message.mentions.members?.first();
    if (!target) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You didn't mention a valid member.\n\n${E.arrow} __Usage__\n\`+kick @member [reason]\`\n\n${E.arrow} __Example__\n\`+kick @BadUser Misbehaving\``)
          .build(),
      );
    }

    if (!target.kickable) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ I cannot kick **${target.user.username}** — they may have a higher role than me.`)
          .build(),
      );
    }

    const reason = args.slice(1).join(" ").trim() || "No Reason Provided";

    // DM before kick (can't DM after they leave)
    const notified = await target.user.send(
      new V2Builder(0xe74c3c)
        .section(
          `### __You have been kicked__ 👢\n\n`
          + `${E.arrow} __Server__\n${message.guild.name}\n\n`
          + `${E.arrow} __Reason__\n${reason}\n\n`
          + `${E.arrow} __Kicked by__\n${message.author.username}\n\n`
          + `-# You can rejoin the server if you have an invite`,
          message.guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 }),
        ).build(),
    ).then(() => true).catch(() => false);

    await target.kick(reason);

    return message.reply(
      new V2Builder(color)
        .section(
          `### __Member Kicked__\n\n`
          + `${E.arrow} __User__\n${target.user.username} (${target.id})\n\n`
          + `${E.arrow} __Reason__\n${reason}\n\n`
          + `-# Kicked by ${message.author.username} · Notified: ${notified ? "Yes" : "No (DMs off)"}`,
          target.user.displayAvatarURL({ size: 256 }),
        ).build(),
    );
  },
};
