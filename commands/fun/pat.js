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
  name: "pat",
  aliases: ["headpat", "pet"],
  description: "Pat a user on the head with an anime GIF.",
  category: "fun",
  usage: "+pat @user",
  argsRequired: true,
  examples: ["+pat @user", "+pat @friend"],
  data: new SlashCommandBuilder()
    .setName("pat").setDescription("Pat a user on the head.")
    .addUserOption(o => o.setName("user").setDescription("User to pat").setRequired(true)),
  async execute({ client, message }) {
    const { rightsort, cross } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const target = message.mentions.members.first();
    if (!target) return message.reply(client.util.v2msg(color, `${cross} Mention someone to pat!`));

    const gifUrl  = await fetchGif("pat");
    const builder = new V2Builder(color).text(
      `### 🖐️ Pat!\n\n`
      + `${rightsort} **${message.member.displayName}** gently pats **${target.displayName}** on the head! 😊\n`
      + `-# So wholesome 💕`,
    );
    if (gifUrl) builder.sep(false).media(gifUrl);
    return message.reply(builder.build());
  },
};
