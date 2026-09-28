const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "vibrato",
  aliases: ["vib"],
  description: "Apply vibrato filter (wavering pitch effect).",
  category: "filter",
  usage: "+vibrato",
  data: new SlashCommandBuilder().setName("vibrato").setDescription("Apply vibrato filter."),
  async execute({ client, message }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";
    const player = client.lavalink?.getPlayer(message.guild.id);

    if (!player) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} No Active Player\n\n${rightsort} Nothing is playing.\n-# Use \`${prefix}play <song>\` to start`,
      ).build());
    }

    await player.filterManager.setVibrato({ frequency: 2.0, depth: 0.5 });
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### 🎸 Vibrato Filter Enabled\n\n`
      + `${rightsort} **Frequency:** \`2 Hz\`\n`
      + `${rightsort} **Depth:** \`50%\`\n`
      + `${rightsort} **Effect:** Wavering pitch oscillation\n`
      + `${rightsort} **Applied by:** <@${message.author.id}>\n`
      + `-# Use \`${prefix}resetfilter\` to clear`,
      art,
    ).build());
  },
};
