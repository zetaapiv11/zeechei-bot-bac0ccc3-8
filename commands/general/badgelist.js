const {
  SlashCommandBuilder,
} = require("discord.js");

const {
  V2Builder,
} = require("../../utils/V2Builder");

const {
  getAllBadges,
} = require("../../utils/badges");

module.exports = {
  name: "badgelist",

  aliases: [
    "allbadges",
    "listbadges",
  ],

  description:
    "View all Zeechei badges.",

  category: "general",

  usage:
    "+badgelist",

  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("badgelist")
    .setDescription(
      "View all Zeechei badges."
    ),

  async execute({
    client,
    message,
  }) {
    const badges =
      getAllBadges();

    const entries =
      Object.entries(badges);

    if (!entries.length) {
      return message.reply(
        new V2Builder()
          .text(
            `### 🏅 Zeechei Badges\n\n`
            + `> No badges are currently available.`
          )
          .build()
      );
    }

    const lines =
      entries.map(
        ([key, badge], index) =>
          `**${index + 1}.** `
          + `${badge.emoji} **${badge.label}** `
          + `\`${key}\`\n`
          + `> ${badge.description}`
      );

    return message.reply(
      new V2Builder()
        .section(
          `### 🏅 Zeechei Badge Registry\n\n`
          + `**Total:** \`${entries.length}\`\n\n`
          + lines.join("\n\n"),
          client.user.displayAvatarURL({
            size: 256,
          })
        )
        .build()
    );
  },
};