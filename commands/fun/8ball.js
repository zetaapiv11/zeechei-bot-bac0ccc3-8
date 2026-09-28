const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

const ANSWERS = [
  { text: "It is certain.",              color: 0x57F287, emoji: "✅" },
  { text: "Without a doubt.",            color: 0x57F287, emoji: "✅" },
  { text: "Yes, definitely!",            color: 0x57F287, emoji: "✅" },
  { text: "You may rely on it.",         color: 0x57F287, emoji: "✅" },
  { text: "Most likely.",                color: 0x57F287, emoji: "✅" },
  { text: "Outlook good.",               color: 0x57F287, emoji: "✅" },
  { text: "Yes!",                        color: 0x57F287, emoji: "✅" },
  { text: "Signs point to yes.",         color: 0x57F287, emoji: "✅" },
  { text: "Reply hazy, try again.",      color: 0xFEE75C, emoji: "🔮" },
  { text: "Ask again later.",            color: 0xFEE75C, emoji: "🔮" },
  { text: "Cannot predict now.",         color: 0xFEE75C, emoji: "🔮" },
  { text: "Concentrate and ask again.",  color: 0xFEE75C, emoji: "🔮" },
  { text: "Don't count on it.",          color: 0xED4245, emoji: "❌" },
  { text: "My reply is no.",             color: 0xED4245, emoji: "❌" },
  { text: "Very doubtful.",              color: 0xED4245, emoji: "❌" },
  { text: "Outlook not so good.",        color: 0xED4245, emoji: "❌" },
];

module.exports = {
  name: "8ball",
  aliases: ["8b", "eightball"],
  description: "Ask the magic 8-ball a question.",
  category: "fun",
  usage: "+8ball <question>",
  argsRequired: true,
  examples: ["+8ball Will I win today?", "+8ball Is Zeechei the best bot?", "+8ball Should I sleep now?"],
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask the magic 8-ball a question.")
    .addStringOption(o => o.setName("question").setDescription("Your question").setRequired(true)),
  getSlashArgs: (opts) => [opts.getString("question")],
  async execute({ client, message, args }) {
    const { rightsort } = client.emoji;
    const color    = client.getColor(message.guild.id);
    const question = args.join(" ");
    const answer   = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

    return message.reply(
      new V2Builder(answer.color).text(
        `### 🎱 Magic 8-Ball\n\n`
        + `${rightsort} **Question:** *${question.slice(0, 200)}*\n\n`
        + `${answer.emoji} **Answer:** ${answer.text}\n\n`
        + `-# Asked by **${message.author.username}**`,
      ).build(),
    );
  },
};
