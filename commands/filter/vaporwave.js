const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "vaporwave",
  aliases: ["vw", "vapor"],
  description: "Apply vaporwave filter (slower + lower pitch).",
  category: "filter",
  usage: "+vaporwave",
  data: new SlashCommandBuilder().setName("vaporwave").setDescription("Apply vaporwave filter (slower + lower pitch)."),
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

    await player.filterManager.setTimescale({ speed: 0.8, pitch: 0.8, rate: 1.0 });
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### 🌊 Vaporwave Filter Enabled\n\n`
      + `${rightsort} **Speed:** \`-20%\`\n`
      + `${rightsort} **Pitch:** \`-20%\`\n`
      + `${rightsort} **Effect:** Slow, dreamy lo-fi aesthetic\n`
      + `${rightsort} **Applied by:** <@${message.author.id}>\n`
      + `-# Use \`${prefix}resetfilter\` to clear`,
      art,
    ).build());
  },
};
