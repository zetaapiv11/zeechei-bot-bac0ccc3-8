const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const { isMainOwner } = require("../../utils/OwnerHelpers");
const {
  getDeveloper,
  setDeveloperPermission,
  resetDeveloperPermissions,
  DEVELOPER_OWNER_COMMANDS
} = require("../../utils/DeveloperPermissions");
const { buildBanner } = require("../../utils/OwnerBanner");

function getUserId(message, args) {
  const raw = String(args?.[1] || "").trim();
  const mention = raw.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{15,25}$/.test(raw)) return raw;
  return message.mentions?.users?.first?.()?.id || null;
}

module.exports = {
  name: "devperm",
  aliases: ["developerperm", "devpermissions"],
  description: "Configure individual developer owner-command access.",
  category: "settings",
  mainOwnerOnly: true,
  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("devperm")
    .setDescription("Configure individual developer owner-command access.")
    .addStringOption(o =>
      o.setName("action").setDescription("Permission action").setRequired(true)
        .addChoices(
          { name: "Grant", value: "grant" },
          { name: "Revoke", value: "revoke" },
          { name: "Reset", value: "reset" },
          { name: "View", value: "view" }
        )
    )
    .addUserOption(o =>
      o.setName("user").setDescription("Developer").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("command").setDescription("Owner command")
        .setRequired(false)
        .addChoices(
          ...[...DEVELOPER_OWNER_COMMANDS].map(name => ({ name, value: name }))
        )
    ),

  getSlashArgs(interaction) {
    return [
      interaction.options.getString("action"),
      interaction.options.getUser("user")?.id,
      interaction.options.getString("command") || ""
    ];
  },

  async execute({ client, message, args = [] }) {
    if (!isMainOwner(message.author.id)) {
      return message.reply(buildBanner(client, message, {
        title: "ACCESS DENIED",
        subtitle: "Only the main owner can edit developer permissions.",
        lines: [{ label: "Required", value: "Main Owner" }],
        height: 340
      }));
    }

    const action = String(args[0] || "").toLowerCase();
    const userId = getUserId(message, args);

    if (!userId) {
      return message.reply(buildBanner(client, message, {
        title: "INVALID USER",
        subtitle: "Select or mention a registered developer.",
        lines: [{ label: "Usage", value: `${message.prefix || config.prefix}devperm grant @user botinfo` }],
        height: 350
      }));
    }

    const developer = getDeveloper(userId);

    if (!developer) {
      return message.reply(buildBanner(client, message, {
        title: "DEVELOPER NOT FOUND",
        subtitle: "Add this user with dev add first.",
        lines: [{ label: "User ID", value: userId }],
        height: 350
      }));
    }

    if (action === "view") {
      return message.reply(buildBanner(client, message, {
        title: "DEVELOPER PERMISSIONS",
        subtitle: "Current individual access",
        lines: [
          { label: "User ID", value: userId },
          ...[...DEVELOPER_OWNER_COMMANDS].map(name => ({
            label: name,
            value: (developer.allowedCommands || []).includes(name) ? "Granted" : "Revoked"
          }))
        ],
        height: Math.min(850, 240 + DEVELOPER_OWNER_COMMANDS.size * 39)
      }));
    }

    if (action === "reset") {
      resetDeveloperPermissions(userId);
      return message.reply(buildBanner(client, message, {
        title: "PERMISSIONS RESET",
        subtitle: "Developer access restored to the default half-permission set.",
        lines: [
          { label: "User ID", value: userId },
          { label: "Default Access", value: [...DEVELOPER_OWNER_COMMANDS].join(", ") }
        ],
        height: 400
      }));
    }

    const commandName = String(args[2] || "").toLowerCase();

    if (!DEVELOPER_OWNER_COMMANDS.has(commandName)) {
      return message.reply(buildBanner(client, message, {
        title: "INVALID COMMAND",
        subtitle: "Choose one of the developer-eligible owner commands.",
        lines: [
          { label: "Available", value: [...DEVELOPER_OWNER_COMMANDS].join(", ") }
        ],
        height: 360
      }));
    }

    const enabled = action === "grant";

    if (!["grant", "revoke"].includes(action)) {
      return message.reply(buildBanner(client, message, {
        title: "INVALID ACTION",
        subtitle: "Use grant, revoke, reset or view.",
        lines: [{ label: "Usage", value: `${message.prefix || config.prefix}devperm grant @user botinfo` }],
        height: 350
      }));
    }

    setDeveloperPermission(userId, commandName, enabled);

    return message.reply(buildBanner(client, message, {
      title: enabled ? "PERMISSION GRANTED" : "PERMISSION REVOKED",
      subtitle: "Developer command access has been updated.",
      lines: [
        { label: "Developer", value: userId },
        { label: "Command", value: commandName },
        { label: "Status", value: enabled ? "Granted" : "Revoked" }
      ],
      height: 390
    }));
  }
};
