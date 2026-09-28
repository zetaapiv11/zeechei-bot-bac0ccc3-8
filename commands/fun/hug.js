const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

async function fetchGif(type) {
  try {
    const res  = await fetch(`https://nekos.best/api/v2/${type}`);
    const data = await res.json();
    return data.results?.[0]?.url || null;
  } catch { return null; }
}

module.exports = {
  name: "hug",
  aliases: ["cuddle"],
  description: "Hug a user with an anime GIF.",
  category: "fun",
  usage: "+hug @user",
  argsRequired: true,
  examples: ["+hug @friend", "+hug @user"],
  data: new SlashCommandBuilder()
    .setName("hug").setDescription("Hug a user.")
    .addUserOption(o => o.setName("user").setDescription("User to hug").setRequired(true)),
  async execute({ client, message }) {
    const { rightsort, cross } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const target = message.mentions.members.first();
    if (!target) return message.reply(client.util.v2msg(color, `${cross} Mention someone to hug!`));

    const gifUrl  = await fetchGif("hug");
    const builder = new V2Builder(color).text(
      `### 🤗 Hug!\n\n`
      + `${rightsort} **${message.member.displayName}** gives **${target.displayName}** a warm hug! 💕\n`
      + `-# Spread the love ❤️`,
    );
    if (gifUrl) builder.sep(false).media(gifUrl);
    return message.reply(builder.build());
  },
};
