const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const path = require("path");
const fs   = require("fs");
const { TXT: E } = require("../../utils/emojis");

function dbLatency() {
  const t = Date.now();
  try { fs.readFileSync(path.join(process.cwd(), "data", "zeechei.json")); } catch {}
  return (Date.now() - t).toFixed(2);
}

function wsQuality(ms) {
  if (ms < 80)  return "Excellent";
  if (ms < 150) return "Good";
  if (ms < 300) return "Fair";
  return "Poor";
}

module.exports = {
  name: "ping",
  aliases: ["latency", "ms"],
  description: "Check the bot latency and WebSocket ping.",
  category: "information",
  usage: "+ping",
  data: new SlashCommandBuilder().setName("ping").setDescription("Check the bot latency and WebSocket ping."),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const ws    = Math.round(client.ws.ping);
    const db    = dbLatency();
    const qual  = wsQuality(ws);

    const text =
      `### __Ping__\n\n`
      + `${E.arrow} WebSocket Latency\n`
      + `\`${ws}ms\` — ${qual}\n\n`
      + `${E.arrow} Database Latency\n`
      + `\`${db}ms\``;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
