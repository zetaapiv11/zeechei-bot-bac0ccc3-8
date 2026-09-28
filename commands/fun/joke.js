const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "A SQL query walks into a bar... walks up to two tables and asks: Can I join you?",
  "Why did the music bot take a break? It needed a REST!",
  "What do you call a fish without eyes? A fsh.",
  "Why did JavaScript developer wear glasses? Because he couldn't C#!",
  "I'm reading a book on anti-gravity. It's impossible to put down!",
  "Why did the computer go to therapy? Too many bytes of emotional baggage.",
  "What do you call a fake noodle? An impasta!",
  "I told a construction joke. Still working on it.",
  "Why did the Discord bot fail? It couldn't handle the requests.",
  "What do you call cheese that isn't yours? Nacho cheese!",
  "Why couldn't the bicycle stand up by itself? It was two-tired.",
  "I asked Zeechei to play some music. She said: That's my job!",
];

module.exports = {
  name: "joke",
  aliases: ["j", "laugh"],
  description: "Get a random joke.",
  category: "fun",
  usage: "+joke",
  examples: ["+joke"],
  data: new SlashCommandBuilder().setName("joke").setDescription("Get a random joke."),
  async execute({ client, message }) {
    const { rightsort } = client.emoji;
    const color = client.getColor(message.guild.id);
    const joke  = JOKES[Math.floor(Math.random() * JOKES.length)];

    return message.reply(
      new V2Builder(color).text(
        `### 😂 Random Joke\n\n`
        + `> ${joke}\n\n`
        + `-# Requested by **${message.author.username}**`,
      ).build(),
    );
  },
};
