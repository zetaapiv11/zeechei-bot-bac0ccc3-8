const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "coinflip",
  aliases: ["coin", "flip"],
  description: "Flip a coin — heads or tails.",
  category: "fun",
  usage: "+coinflip",
  examples: ["+coinflip"],
  data: new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin."),
  async execute({ client, message }) {
    const { rightsort } = client.emoji;
    const isHeads = Math.random() < 0.5;
    const color   = isHeads ? 0xFEE75C : 0x5865F2;

    return message.reply(
      new V2Builder(color).text(
        `### 🪙 Coin Flip!\n\n`
        + `${rightsort} The coin landed on... **${isHeads ? "Heads" : "Tails"}!** ${isHeads ? "👑" : "🦅"}\n\n`
        + `-# Flipped by **${message.author.username}**`,
      ).build(),
    );
  },
};
