const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

function stability(ms) {
  if (ms < 3_600_000)   return "Unstable";
  if (ms < 21_600_000)  return "Starting Up";
  if (ms < 86_400_000)  return "Stable";
  return "Very Stable";
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000)  / 60_000);
  const s = Math.floor((ms % 60_000)     / 1_000);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

module.exports = {
  name: "uptime",
  aliases: ["up"],
  description: "Shows how long the bot has been running.",
  category: "information",
  usage: "+uptime",
  data: new SlashCommandBuilder().setName("uptime").setDescription("Shows how long the bot has been running."),

  async execute({ client, message }) {
    const color  = client.getColor(message.guild?.id);
    const upMs   = process.uptime() * 1000;
    const startTs = Math.floor((Date.now() - upMs) / 1000);
    const dur    = formatDuration(upMs);
    const stable = stability(upMs);

    const text =
      `### __Uptime__\n\n`
      + `${E.arrow} Online Since\n`
      + `<t:${startTs}:F> (<t:${startTs}:R>)\n\n`
      + `${E.arrow} Total Duration\n`
      + `${dur} - ${stable}\n\n`
      + `-# Uptime is measured from the bot's last gateway connection.`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
