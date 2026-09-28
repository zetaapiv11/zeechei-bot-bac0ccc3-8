const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

async function fetchGif(type) {
  try {
    const res  = await fetch(`https://nekos.best/api/v2/${type}`);
    const data = await res.json();
    return data.results?.[0]?.url || null;
  } catch { return null; }
}

function shipScore(id1, id2) {
  const [a, b] = [id1, id2].sort();
  const seed = a + b;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (((h << 5) + h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 101;
}

function heartBar(pct, size = 10) {
  const filled = Math.round((pct / 100) * size);
  return "❤️".repeat(filled) + "🖤".repeat(size - filled);
}

function shipResult(score) {
  if (score >= 90) return { label: "Soulmates 💑",        msg: "Absolutely perfect — made for each other!" };
  if (score >= 75) return { label: "Deeply in Love 💕",   msg: "A beautiful match with strong chemistry!" };
  if (score >= 60) return { label: "Great Match 💞",       msg: "Pretty good! There's definitely something here." };
  if (score >= 45) return { label: "Possible ❤️",          msg: "Could work with some effort!" };
  if (score >= 30) return { label: "Uncertain 💔",         msg: "Hmm... it's a bit of a stretch." };
  if (score >= 15) return { label: "Not Ideal 😬",         msg: "This ship might need some repairs..." };
  return              { label: "Complete Disaster 💀",     msg: "Abandon ship! This is not going well." };
}

module.exports = {
  name: "ship",
  aliases: ["love", "lovemeter"],
  description: "Calculate the love compatibility between two users.",
  category: "fun",
  usage: "+ship @user1 [@user2]",
  examples: ["+ship @user1 @user2", "+ship @user1"],
  data: new SlashCommandBuilder()
    .setName("ship").setDescription("Calculate the love compatibility between two users.")
    .addUserOption(o => o.setName("user1").setDescription("First user").setRequired(true))
    .addUserOption(o => o.setName("user2").setDescription("Second user (default: you)")),

  async execute({ client, message, args }) {
    const { rightsort, cross } = client.emoji;
    const color = client.getColor(message.guild.id);

    const members = message.mentions.members;
    const user1   = members.first() || message.member;
    const user2   = members.size >= 2
      ? [...members.values()][1]
      : (members.size === 1 && members.first().id !== message.author.id
        ? message.member
        : members.first());

    if (!user1 || !user2 || user1.id === user2.id) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Ship Failed\n\n`
        + `${rightsort} Mention **two different users** to ship them!\n`
        + `-# Example: \`+ship @user1 @user2\``,
      ).build());
    }

    const score  = shipScore(user1.id, user2.id);
    const result = shipResult(score);
    const bar    = heartBar(score);
    const ship   = `${user1.displayName.slice(0, 4)}${user2.displayName.slice(-4)}`;

    // Fetch a romantic GIF from nekos.best
    const gifUrl = await fetchGif(score >= 60 ? "kiss" : score >= 30 ? "wink" : "pat");

    const builder = new V2Builder(color)
      .section(
        `### 💘 Ship: **${ship}**\n\n`
        + `${rightsort} **${user1.displayName}** 💕 **${user2.displayName}**\n\n`
        + `${bar}\n\n`
        + `${rightsort} **Compatibility:** \`${score}%\`\n`
        + `${rightsort} **Status:** ${result.label}\n\n`
        + `*${result.msg}*\n`
        + `-# Powered by ❤️ Zeechei`,
        user1.user.displayAvatarURL({ size: 256 }),
      );

    if (gifUrl) builder.sep(false).media(gifUrl);

    return message.reply(builder.build());
  },
};
