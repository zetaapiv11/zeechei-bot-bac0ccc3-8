const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

const BANDS = {
  off:    new Array(15).fill(0).map((_, b) => ({ band: b, gain: 0 })),
  low:    [0.1,0.1,0.05,0,-0.05,-0.1,-0.1,-0.1,-0.1,-0.1,-0.1,-0.1,-0.1,-0.1,-0.1].map((g, b) => ({ band: b, gain: g })),
  medium: [0.25,0.22,0.2,0,-0.1,-0.15,-0.15,-0.15,-0.15,-0.15,-0.15,-0.15,-0.15,-0.15,-0.15].map((g, b) => ({ band: b, gain: g })),
  high:   [0.4,0.37,0.35,0,-0.25,-0.25,-0.25,-0.25,-0.25,-0.25,-0.25,-0.25,-0.25,-0.25,-0.25].map((g, b) => ({ band: b, gain: g })),
};
const LEVEL_INFO = {
  low:    { emoji: "🔈", label: "Low",    desc: "Subtle bass enhancement" },
  medium: { emoji: "🔉", label: "Medium", desc: "Balanced bass boost" },
  high:   { emoji: "🔊", label: "High",   desc: "Heavy bass — best with headphones" },
  off:    { emoji: "🔇", label: "Off",    desc: "Bass boost disabled" },
};

module.exports = {
  name: "bassboost",
  aliases: ["bb", "bass"],
  description: "Apply bass boost filter.",
  category: "filter",
  usage: "+bassboost [low|medium|high|off]",
  examples: ["+bassboost medium", "+bassboost high", "+bassboost off"],
  data: new SlashCommandBuilder()
    .setName("bassboost").setDescription("Apply bass boost filter.")
    .addStringOption(o => o.setName("level").setDescription("Bass boost level").setRequired(true)
      .addChoices({ name: "Low", value: "low" }, { name: "Medium", value: "medium" }, { name: "High", value: "high" }, { name: "Off", value: "off" })),
  getSlashArgs: (opts) => [opts.getString("level")],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";
    const player = client.lavalink?.getPlayer(message.guild.id);

    if (!player) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} No Active Player\n\n${rightsort} Nothing is playing in this server.\n-# Use \`${prefix}play <song>\` to start`,
      ).build());
    }

    const level = (args[0] || "medium").toLowerCase();
    if (!BANDS[level]) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Invalid Level\n\n${rightsort} Use: \`low\`, \`medium\`, \`high\`, or \`off\`\n-# Example: \`${prefix}bassboost high\``,
      ).build());
    }

    await player.filterManager.setEqualizer(BANDS[level]);
    const { emoji, label, desc } = LEVEL_INFO[level];
    const art = player.queue.current?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### ${emoji} Bass Boost — ${label}\n\n`
      + `${rightsort} **Level:** \`${label}\` ${emoji}\n`
      + `${rightsort} **Effect:** ${desc}\n`
      + `${rightsort} **Applied by:** <@${message.author.id}>\n`
      + `-# Use \`${prefix}resetfilter\` to clear all filters`,
      art,
    ).build());
  },
};
