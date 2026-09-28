const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const Database = require("../../database/Database");

module.exports = {
  name: "setprefix",
  aliases: ["prefix"],
  description: "Change the bot prefix for this server.",
  category: "settings",
  usage: "+setprefix <prefix>",
  argsRequired: true,

  examples: [
    "+setprefix !",
    "+setprefix ?",
    "+setprefix -"
  ],

  data: new SlashCommandBuilder()
    .setName("setprefix")
    .setDescription("Change the bot prefix for this server.")
    .addStringOption(option =>
      option
        .setName("prefix")
        .setDescription("New prefix (1-5 characters)")
        .setRequired(true)
        .setMaxLength(5)
    ),

  getSlashArgs: (opts) => [
    opts.getString("prefix")
  ],

  async execute({ message, args }) {
    // Get client directly from the Discord message
    const client = message.client;

    // Make sure this command is being used inside a server
    if (!message.guild) {
      return message.reply({
        content: "<:cross:1550532309894045846> This command can only be used inside a server."
      });
    }

    // Check Manage Server permission
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {
      return message.reply({
        content: "<:cross:1550532309894045846> You need **Manage Server** permission to change the prefix."
      });
    }

    // Check prefix argument
    if (!args || !args[0]) {
      return message.reply({
        content: "<:cross:1550532309894045846> Please provide a new prefix."
      });
    }

    // Get prefix and limit it to 5 characters
    const newPrefix = String(args[0]).trim().slice(0, 5);

    // Don't allow an empty prefix
    if (!newPrefix) {
      return message.reply({
        content: "<:cross:1550532309894045846> Please provide a valid prefix."
      });
    }

    try {
      // Save prefix
      await Database.setPrefix(
        message.guild.id,
        newPrefix
      );

      // Send success response
      return message.reply({
        content:
          `<:check:1550872076104245271> Server prefix has been changed to \`${newPrefix}\`.\n` +
          `<:information:1550869957171220584> New usage: \`${newPrefix}help\``
      });

    } catch (error) {
      console.error("[setprefix] Database error:", error);

      return message.reply({
        content:
          "<:cross:1550532309894045846> I couldn't save the new prefix. Please try again later."
      });
    }
  }
};