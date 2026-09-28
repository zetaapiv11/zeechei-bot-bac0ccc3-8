const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "8d",
  aliases: ["eightd"],
  description: "Apply 8D audio filter (use headphones!).",
  category: "filter",
  usage: "+8d",
  data: new SlashCommandBuilder().setName("8d").setDescription("Apply 8D audio filter (use headphones!)."),
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

    await player.filterManager.setRotation({ rotationHz: 0.2 });
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### 🎙️ 8D Audio Filter Enabled\n\n`
      + `${rightsort} **Rotation:** \`0.2 Hz\`\n`
      + `${rightsort} **Effect:** Surround-sound spatial audio\n`
      + `${rightsort} **Applied by:** <@${message.author.id}>\n`
      + `-# 🎧 Use headphones for best experience! • \`${prefix}resetfilter\` to clear`,
      art,
    ).build());
  },
};
