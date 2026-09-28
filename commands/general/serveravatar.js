const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

function getAvatar(guild) {
  const hash = guild?.icon;
  if (!hash) return null;

  const animated = hash.startsWith("a_");
  const extension = animated ? "gif" : "png";

  return {
    url: guild.iconURL({
      extension,
      size: 4096,
      forceStatic: false,
    }),
    extension,
    animated,
  };
}

module.exports = {
  name: "serveravatar",
  aliases: ["serverav", "server avatar", "server av"],
  description: "Show the server avatar directly.",
  category: "general",
  usage: "+serveravatar",

  data: new SlashCommandBuilder()
    .setName("serveravatar")
    .setDescription("Show the server avatar directly."),

  getSlashArgs: () => [],

  async execute({ message }) {
    if (!message?.guild) {
      return message.reply("This command can only be used inside a server.");
    }

    const avatar = getAvatar(message.guild);

    if (!avatar?.url) {
      return message.reply("This server does not have a server avatar.");
    }

    try {
      const response = await fetch(avatar.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = `server-avatar.${avatar.extension}`;

      const attachment = new AttachmentBuilder(buffer, {
        name: fileName,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Download Avatar")
          .setStyle(ButtonStyle.Link)
          .setURL(avatar.url)
      );

      return message.reply({
        files: [attachment],
        components: [row],
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      console.error("[serveravatar]", error);
      return message.reply("I couldn't fetch the server avatar right now.");
    }
  },
};
