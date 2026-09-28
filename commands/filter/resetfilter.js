const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "resetfilter",
  aliases: ["rf", "clearfilter", "nofilter"],
  description: "Reset all audio filters to default.",
  category: "filter",
  usage: "+resetfilter",
  data: new SlashCommandBuilder().setName("resetfilter").setDescription("Reset all audio filters to default."),
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

    await player.filterManager.resetFilters();
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### 🔄 Filters Reset\n\n`
      + `${rightsort} **All filters cleared** — audio back to default\n`
      + `${rightsort} **Reset by:** <@${message.author.id}>\n`
      + `-# Apply a new filter: \`${prefix}bassboost\`, \`${prefix}nightcore\`, \`${prefix}8d\`…`,
      art,
    ).build());
  },
};
