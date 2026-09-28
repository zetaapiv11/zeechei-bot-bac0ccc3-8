const {
  SlashCommandBuilder,
} = require("discord.js");

const {
  V2Builder,
} = require("../../utils/V2Builder");

const {
  getAllBadges,
} = require("../../utils/badges");

const Database =
  require("../../database/Database");

module.exports = {
  name: "badges",

  aliases: [
    "mybadges",
    "mybadge",
  ],

  description:
    "View Zeechei badges.",

  category: "general",

  usage:
    "+badges [@user]",

  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("badges")
    .setDescription(
      "View Zeechei badges."
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "User to check"
        )
        .setRequired(false)
    ),

  getSlashArgs: opts => {
    const user =
      opts.getUser(
        "user",
        false
      );

    return user
      ? [user.id]
      : [];
  },

  async execute({
    client,
    message,
    args,
  }) {
    let target =
      message.mentions.users.first();

    if (!target && args?.[0]) {
      target =
        await client.users
          .fetch(
            String(args[0])
              .replace(/\D/g, "")
          )
          .catch(() => null);
    }

    if (!target) {
      target =
        message.author;
    }

    const allBadges =
      getAllBadges();

    const userBadges =
      Database.getUserBadges(
        target.id
      );

    const earned =
      userBadges
        .map(key => ({
          key,
          badge: allBadges[key],
        }))
        .filter(x => x.badge);

    const text =
      earned.length
        ? earned
            .map(
              x =>
                `${x.badge.emoji} **${x.badge.label}**\n`
                + `> ${x.badge.description}`
            )
            .join("\n\n")
        : "-# This user has no Zeechei badges yet.";

    return message.reply(
      new V2Builder()
        .section(
          `### 🏅 ${target.username}'s Badges\n\n`
          + `**Collected:** \`${earned.length}/${Object.keys(allBadges).length}\`\n\n`
          + text,
          target.displayAvatarURL({
            size: 256,
          })
        )
        .build()
    );
  },
};