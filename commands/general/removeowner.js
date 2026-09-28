const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config   = require("../../config");
const Database = require("../../database/Database");

module.exports = {
  name: "removeowner",
  aliases: ["ro", "delowner"],
  description: "Remove a user from bot owners. (Main owner only)",
  category: "general",
  usage: "+removeowner @user",
  argsRequired: true,
  mainOwnerOnly: true,
  examples: ["+removeowner @Alex"],
  data: new SlashCommandBuilder()
    .setName("removeowner")
    .setDescription("Remove a user from bot owners. (Main owner only)")
    .addUserOption(o => o.setName("user").setDescription("The owner to remove").setRequired(true)),

  getSlashArgs: (opts) => {
    const user = opts.getUser("user");
    return [user ? `<@${user.id}>` : ""];
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color = client.getColor(message.guild?.id);

    if (message.author.id !== config.mainOwnerId) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Access Denied\n\n`
        + `${rightsort} Only the **main owner** can remove other owners.`,
      ).build());
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} No User Mentioned\n\n`
        + `${rightsort} Mention a user to remove from owners.\n`
        + `-# Usage: \`+removeowner @user\``,
      ).build());
    }

    if (target.id === config.mainOwnerId) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Cannot Remove Main Owner\n\n`
        + `${rightsort} The main owner cannot be removed.`,
      ).build());
    }

    if (config.ownerIds.includes(target.id)) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Cannot Remove Config Owner\n\n`
        + `${rightsort} **${target.username}** is a built-in config owner and cannot be removed via command.\n`
        + `-# Edit \`config.js\` to change built-in owners.`,
      ).build());
    }

    if (!Database.isOwner(target.id)) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Not an Owner\n\n`
        + `${rightsort} **${target.username}** is not a dynamic bot owner.`,
      ).build());
    }

    Database.removeOwner(target.id);

    return message.reply(new V2Builder(color).section(
      `### ${tick} Owner Removed\n\n`
      + `${rightsort} **${target.username}** has been removed from bot owners.\n`
      + `${rightsort} They no longer have access to owner-only commands.\n`
      + `-# Removed by <@${message.author.id}>`,
      target.displayAvatarURL?.({ size: 256 }),
    ).build());
  },
};
