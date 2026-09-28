const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const Database = require("../../database/Database");

function getMainOwnerId() {
  return config.mainOwnerId || config.ownerId || config.owner;
}

function getConfiguredOwners() {
  return Array.isArray(config.ownerIds) ? config.ownerIds : [];
}

function getTargetUser(message, args = []) {
  // Prefix command:
  // +addowner @user
  const mentionedUser = message?.mentions?.users?.first?.();

  if (mentionedUser) {
    return mentionedUser;
  }

  // Slash command / converted arguments
  const raw = Array.isArray(args) ? args[0] : args;

  if (!raw) {
    return null;
  }

  const value = String(raw);

  const match =
    value.match(/^<@!?(\d+)>$/) ||
    value.match(/^(\d{15,25})$/);

  if (!match) {
    return null;
  }

  return message?.client?.users?.cache?.get(match[1]) || null;
}

module.exports = {
  name: "addowner",
  aliases: ["ao"],
  description: "Add a user as a bot owner. (Main owner only)",
  category: "general",
  usage: "+addowner @user",
  argsRequired: true,
  mainOwnerOnly: true,
  examples: ["+addowner @Alex"],

  data: new SlashCommandBuilder()
    .setName("addowner")
    .setDescription("Add a user as a bot owner. (Main owner only)")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The user to add as owner")
        .setRequired(true)
    ),

  getSlashArgs: (options) => {
    const user = options.getUser("user");

    return [
      user ? `<@${user.id}>` : ""
    ];
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;

    const color = client.getColor(
      message.guild?.id
    );

    /*
     * Helper for V2 responses
     */
    const sendError = (title, description) => {
      return message.reply(
        new V2Builder(color)
          .text(
            `### ${title}\n\n${description}`
          )
          .build()
      );
    };

    /*
     * Get main owner ID
     */
    const mainOwnerId =
      config.mainOwnerId ||
      config.ownerId ||
      config.owner;

    /*
     * Main owner configuration check
     */
    if (!mainOwnerId) {
      return sendError(
        `${cross} Configuration Error`,
        `${rightsort} \`mainOwnerId\` is not configured in \`config.js\`.`
      );
    }

    /*
     * Main owner permission
     */
    if (message.author.id !== mainOwnerId) {
      return sendError(
        `${cross} Access Denied`,
        `${rightsort} Only the **main owner** can add other owners.`
      );
    }

    /*
     * Get target user
     *
     * Supports:
     * +addowner @user
     * /addowner @user
     */
    const target = getTargetUser(
      message,
      args
    );

    if (!target) {
      return sendError(
        `${cross} No User Found`,
        `${rightsort} Mention a user or select one from the slash command.\n`
        + `-# Usage: \`+addowner @user\``
      );
    }

    /*
     * Bots cannot become owners
     */
    if (target.bot) {
      return sendError(
        `${cross} Cannot Add Bot`,
        `${rightsort} Bots cannot be added as owners.`
      );
    }

    /*
     * Config owners
     */
    const configuredOwners =
      Array.isArray(config.ownerIds)
        ? config.ownerIds
        : [];

    if (configuredOwners.includes(target.id)) {
      return sendError(
        `${cross} Already a Config Owner`,
        `${rightsort} **${target.username}** is already a built-in bot owner.`
      );
    }

    /*
     * Check database
     */
    let alreadyOwner = false;

    try {
      alreadyOwner = await Database.isOwner(
        target.id
      );
    } catch (error) {
      console.error(
        "[addowner] Database.isOwner error:",
        error
      );

      return sendError(
        `${cross} Database Error`,
        `${rightsort} I couldn't check the owner database.\n`
        + `-# Check \`database/Database.js\` and make sure \`isOwner(id)\` exists.`
      );
    }

    /*
     * Already owner
     */
    if (alreadyOwner) {
      return sendError(
        `${cross} Already an Owner`,
        `${rightsort} **${target.username}** is already a bot owner.`
      );
    }

    /*
     * Add owner
     */
    try {
      await Database.addOwner(
        target.id
      );
    } catch (error) {
      console.error(
        "[addowner] Database.addOwner error:",
        error
      );

      return sendError(
        `${cross} Database Error`,
        `${rightsort} I couldn't save **${target.username}** as an owner.\n`
        + `-# Check \`database/Database.js\` and its owner storage.`
      );
    }

    /*
     * Success
     */
    return message.reply(
      new V2Builder(color)
        .section(
          `### ${tick} Owner Added\n\n`
          + `${rightsort} **${target.username}** has been added as a bot owner.\n`
          + `${rightsort} They can now use all owner-only commands.\n`
          + `-# Added by <@${message.author.id}>`,
          target.displayAvatarURL({
            size: 256
          })
        )
        .build()
    );
  },
};