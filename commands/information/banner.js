const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "banner",
  aliases: ["userbanner", "ub"],
  description: "Shows a user's banner.",
  category: "information",
  usage: "+banner [@user]",
  examples: ["+banner", "+banner @User"],
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Shows a user's banner.")
    .addUserOption(o => o.setName("user").setDescription("User to get banner of")),
  getSlashArgs: (opts) => {
    const u = opts.getUser("user");
    return u ? [`<@${u.id}>`] : [];
  },

  async execute({ client, message }) {
    const color  = client.getColor(message.guild?.id);
    const target = message.mentions.users?.first() || message.author;

    // Banner requires a fresh fetch
    const user = await client.users.fetch(target.id, { force: true }).catch(() => null);
    if (!user) return message.reply(client.util.v2msg(color, `${client.emoji.cross} Could not fetch that user.`));

    const bannerUrl = user.bannerURL({ size: 4096, extension: "png", forceStatic: false });

    if (!bannerUrl)
      return message.reply(client.util.v2msg(color, `${client.emoji.cross} **${user.username}** has no banner set.`));

    const avatarUrl = user.displayAvatarURL({ size: 64 });

    return message.reply(
      new V2Builder(color)
        .section(`### __${user.username}'s Banner__\n\n-# Click the image to open full size`, avatarUrl)
        .sep()
        .media(bannerUrl)
        .build(),
    );
  },
};
