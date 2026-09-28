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
  name: "slap",
  aliases: ["smack"],
  description: "Slap a user with an anime GIF.",
  category: "fun",
  usage: "+slap @user",
  argsRequired: true,
  examples: ["+slap @user", "+slap @friend"],
  data: new SlashCommandBuilder()
    .setName("slap").setDescription("Slap a user.")
    .addUserOption(o => o.setName("user").setDescription("User to slap").setRequired(true)),
  async execute({ client, message }) {
    const { rightsort, cross } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const target = message.mentions.members.first();
    if (!target) return message.reply(client.util.v2msg(color, `${cross} Mention someone to slap!`));

    const gifUrl  = await fetchGif("slap");
    const builder = new V2Builder(color).text(
      `### 👋 Slap!\n\n`
      + `${rightsort} **${message.member.displayName}** slaps **${target.displayName}** across the face! 💥\n`
      + `-# Ouch! That had to hurt 😬`,
    );
    if (gifUrl) builder.sep(false).media(gifUrl);
    return message.reply(builder.build());
  },
};
