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

const BANNER_PATH = path.join(__dirname, "../../assets/vote-banner.png");

module.exports = {
  name: "vote",
  aliases: ["upvote", "topgg"],
  description: "Vote for Zeechei on top.gg and support the bot!",
  category: "general",
  usage: "+vote",
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Vote for Zeechei on top.gg and support the bot!"),

  async execute({ client, message }) {
    const tag     = client.user?.username || "Zeechei";
    const voteUrl = config.voteUrl;
    const file    = new AttachmentBuilder(BANNER_PATH, { name: "vote-banner.png" });

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${E.zeechei} Vote for ${tag}\n\n`
          + `> Support **${tag}** by casting your vote on **top.gg**!\n`
          + `> Your vote helps us grow and reach more Discord servers.\n\n`
          + `${E.arrow} Votes reset every **12 hours** — vote again to keep us climbing!\n`
          + `${E.arrow} Every vote is deeply appreciated by the entire Zeechei team.`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL("attachment://vote-banner.png")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Vote on top.gg")
            .setURL(voteUrl)
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
