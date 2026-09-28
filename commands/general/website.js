const {
  SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
  AttachmentBuilder, MessageFlags,
} = require("discord.js");
const path   = require("path");
const config = require("../../config");
const { TXT: E } = require("../../utils/emojis");

const BANNER_PATH = path.join(__dirname, "../../assets/website-banner.png");

module.exports = {
  name: "website",
  aliases: ["web", "site"],
  description: "Visit the official Zeechei bot website.",
  category: "general",
  usage: "+website",
  data: new SlashCommandBuilder()
    .setName("website")
    .setDescription("Visit the official Zeechei bot website."),

  async execute({ client, message }) {
    const tag        = client.user?.username || "Zeechei";
    const websiteUrl = config.website;
    const file       = new AttachmentBuilder(BANNER_PATH, { name: "website-banner.png" });

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${E.zeechei} ${tag} Website\n\n`
          + `> Explore everything **${tag}** has to offer on our official website.\n\n`
          + `${E.arrow} Full command documentation & guides\n`
          + `${E.arrow} Premium features & plans\n`
          + `${E.arrow} Latest updates & changelogs`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL("attachment://website-banner.png")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Visit Website")
            .setURL(websiteUrl)
            .setStyle(ButtonStyle.Link)
            .setEmoji(E.arrow),
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Developed by zeechei Devs✓`)
      );

    return message.reply({
      files: [file],
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
