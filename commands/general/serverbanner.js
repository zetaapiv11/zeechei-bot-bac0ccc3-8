const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

function getBanner(guild) {
  const hash = guild?.banner;
  if (!hash) return null;

  const animated = hash.startsWith("a_");
  const extension = animated ? "gif" : "png";

  return {
    url: guild.bannerURL({
      extension,
      size: 4096,
      forceStatic: false,
    }),
    extension,
    animated,
  };
}

module.exports = {
  name: "serverbanner",
  aliases: ["serverbn", "server banner", "server bn"],
  description: "Show the server banner directly.",
  category: "general",
  usage: "+serverbanner",

  data: new SlashCommandBuilder()
    .setName("serverbanner")
    .setDescription("Show the server banner directly."),

  getSlashArgs: () => [],

  async execute({ message }) {
    if (!message?.guild) {
      return message.reply("This command can only be used inside a server.");
    }

    const banner = getBanner(message.guild);

    if (!banner?.url) {
      return message.reply("This server does not have a server banner.");
    }

    try {
      const response = await fetch(banner.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = `server-banner.${banner.extension}`;

      const attachment = new AttachmentBuilder(buffer, {
        name: fileName,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Download Banner")
          .setStyle(ButtonStyle.Link)
          .setURL(banner.url)
      );

      return message.reply({
        files: [attachment],
        components: [row],
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      console.error("[serverbanner]", error);
      return message.reply("I couldn't fetch the server banner right now.");
    }
  },
};
