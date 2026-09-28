const {
  SlashCommandBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MessageFlags,
} = require("discord.js");
const { BTN } = require("../../utils/emojis");

module.exports = {
  name: "report",
  aliases: ["bug", "feedback"],
  description: "Report a bug or query to the bot developers.",
  category: "general",
  usage: "+report",
  noDefer: true,

  data: new SlashCommandBuilder().setName("report").setDescription("Report a bug or query to the bot developers."),

  async execute({ message }) {
    const userId = message.author.id;
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## 🚩  Report Center\nSelect a category below and the bot will ask for your report message.\nYour report will be reviewed by the **Zeechei** team.`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`report:category:${userId}`)
            .setPlaceholder("🚩  Select report category...")
            .addOptions([
              { label: "Bug Report",      value: "bug",     description: "Report a bug or error",     emoji: "❌" },
              { label: "Abusive User",    value: "abuse",   description: "Report abusive behaviour",  emoji: "⚠️" },
              { label: "Music Issue",     value: "music",   description: "Report a playback issue",   emoji: "🎵" },
              { label: "Feature Request", value: "feature", description: "Suggest a new feature",     emoji: "⚙️" },
              { label: "General Query",   value: "query",   description: "Ask a general question",    emoji: "ℹ️" },
            ])
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`report:cancel:${userId}`).setLabel("Cancel").setEmoji(BTN.btn_cancel_x).setStyle(ButtonStyle.Danger)
        )
      );
    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
