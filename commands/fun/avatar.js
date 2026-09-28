const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "avatar",
  aliases: ["av", "pfp", "icon"],
  description: "Shows a user's avatar as a full-size image.",
  category: "fun",
  usage: "+avatar [@user]",
  examples: ["+avatar", "+avatar @user"],
  data: new SlashCommandBuilder()
    .setName("avatar").setDescription("Shows a user's avatar.")
    .addUserOption(o => o.setName("user").setDescription("User to view (default: you)")),
  async execute({ client, message }) {
    const { rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const target = message.mentions.members.first() || message.member;
    const user   = target.user;

    const avatarUrl = user.displayAvatarURL({ size: 1024, forceStatic: false });
    const serverAv  = target.displayAvatarURL({ size: 1024, forceStatic: false });
    const hasDiff   = serverAv !== avatarUrl;

    const builder = new V2Builder(color)
      .text(
        `### 🖼️ Avatar — ${user.username}\n\n`
        + `${rightsort} **User:** ${user.tag}\n`
        + `${rightsort} **Format:** ${avatarUrl.includes(".gif") ? "GIF (Animated)" : "PNG/JPG (Static)"}\n`
        + (hasDiff ? `${rightsort} *Has a different server avatar*\n` : "")
        + `\n-# Click the image to open full size`,
      )
      .sep(false)
      .media(serverAv);

    return message.reply(builder.build());
  },
};
