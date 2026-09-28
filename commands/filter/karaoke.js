const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "karaoke",
  aliases: ["kar"],
  description: "Apply karaoke filter (removes vocals).",
  category: "filter",
  usage: "+karaoke",
  data: new SlashCommandBuilder().setName("karaoke").setDescription("Apply karaoke filter (removes vocals)."),
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

    await player.filterManager.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 });
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### 🎤 Karaoke Filter Enabled\n\n`
      + `${rightsort} **Effect:** Vocals removed from audio\n`
      + `${rightsort} **Filter Band:** \`220 Hz\`\n`
      + `${rightsort} **Applied by:** <@${message.author.id}>\n`
      + `-# Sing along! 🎵 • \`${prefix}resetfilter\` to clear`,
      art,
    ).build());
  },
};
