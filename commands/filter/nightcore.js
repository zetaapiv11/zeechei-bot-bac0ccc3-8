const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "nightcore",
  aliases: ["nc"],
  description: "Apply nightcore filter (faster + higher pitch).",
  category: "filter",
  usage: "+nightcore",
  data: new SlashCommandBuilder().setName("nightcore").setDescription("Apply nightcore filter (faster + higher pitch)."),
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

    await player.filterManager.setTimescale({ speed: 1.2, pitch: 1.3, rate: 1.0 });
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### 🌙 Nightcore Filter Enabled\n\n`
      + `${rightsort} **Speed:** \`+20%\`\n`
      + `${rightsort} **Pitch:** \`+30%\`\n`
      + `${rightsort} **Applied by:** <@${message.author.id}>\n`
      + `-# Use \`${prefix}resetfilter\` to clear`,
      art,
    ).build());
  },
};
