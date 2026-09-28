const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

const DICE_EMOJI = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

module.exports = {
  name: "roll",
  aliases: ["dice", "d"],
  description: "Roll a dice (default 1–6, or specify max).",
  category: "fun",
  usage: "+roll [max]",
  examples: ["+roll", "+roll 20", "+roll 100"],
  data: new SlashCommandBuilder()
    .setName("roll").setDescription("Roll a dice.")
    .addIntegerOption(o => o.setName("max").setDescription("Max value (default 6)").setMinValue(2).setMaxValue(1000000)),
  getSlashArgs: (opts) => { const m = opts.getInteger("max"); return m ? [String(m)] : []; },
  async execute({ client, message, args }) {
    const { rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const max    = parseInt(args[0]) || 6;

    if (isNaN(max) || max < 2) {
      return message.reply(client.util.v2msg(color,
        `${client.emoji.cross} Max value must be **2 or higher**. Example: \`+roll 20\``,
      ));
    }

    const result   = Math.floor(Math.random() * max) + 1;
    const diceIcon = max === 6 && result <= 6 ? DICE_EMOJI[result - 1] : "🎲";
    const isCrit   = result === max;
    const isOne    = result === 1;

    return message.reply(
      new V2Builder(isCrit ? 0x57F287 : isOne ? 0xED4245 : color).text(
        `### 🎲 Dice Roll\n\n`
        + `${diceIcon} **Rolled: ${result}** / ${max} ${isCrit ? "🎉 Critical!" : isOne ? "💀 Ouch!" : ""}\n\n`
        + `-# Rolled by **${message.author.username}**`,
      ).build(),
    );
  },
};
