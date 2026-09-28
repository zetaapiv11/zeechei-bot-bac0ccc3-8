const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const { isMainOwner } = require("../../utils/OwnerHelpers");
const {
  addDeveloper,
  removeDeveloper,
  getDeveloper,
  getDevelopers,
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

function usage(client, message) {
  return message.reply(buildBanner(client, message, {
    title: "DEVELOPER SYSTEM",
    subtitle: "Main owner only",
    lines: [
      `${message.prefix || config.prefix}dev add @user`,
      `${message.prefix || config.prefix}dev remove @user`,
      `${message.prefix || config.prefix}dev list`,
      `${message.prefix || config.prefix}dev info @user`,
      "",
      { label: "Developer Access", value: `${DEVELOPER_OWNER_COMMANDS.size} selected owner commands` }
    ],
    height: 430
  }));
}

module.exports = {
  name: "dev",
  aliases: ["developer", "developers"],
  description: "Add, remove and manage Zeechei developers.",
  category: "settings",
  mainOwnerOnly: true,
  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("dev")
    .setDescription("Add, remove and manage Zeechei developers.")
    .addStringOption(o =>
      o.setName("action")
        .setDescription("Developer action")
        .setRequired(true)
        .addChoices(
          { name: "Add", value: "add" },
          { name: "Remove", value: "remove" },
          { name: "List", value: "list" },
          { name: "Info", value: "info" }
        )
    )
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Developer user")
        .setRequired(false)
    ),

  getSlashArgs(interaction) {
    const action = interaction.options.getString("action");
    const user = interaction.options.getUser("user");
    return [action, ...(user ? [user.id] : [])];
  },

  async execute({ client, message, args = [] }) {
    if (!isMainOwner(message.author.id)) {
      return message.reply(buildBanner(client, message, {
        title: "ACCESS DENIED",
        subtitle: "Only the main owner can manage developers.",
        lines: [{ label: "Required", value: "Main Owner" }],
        height: 330
      }));
    }

    const action = String(args[0] || "").toLowerCase();

    if (!action) return usage(client, message);

    if (action === "add" || action === "remove") {
      const userId = getUserId(message, args);

      if (!userId) {
        return message.reply(buildBanner(client, message, {
          title: "INVALID USER",
          subtitle: "Mention a user or provide a valid user ID.",
          lines: [{ label: "Usage", value: `${message.prefix || config.prefix}dev ${action} @user` }],
          height: 350
        }));
      }

      if (userId === String(config.mainOwnerId || "") ||
          userId === String(config.ownerId || "") ||
          (config.ownerIds || []).map(String).includes(userId)) {
        return message.reply(buildBanner(client, message, {
          title: "INVALID TARGET",
          subtitle: "An owner cannot be registered as a developer.",
          lines: [{ label: "User ID", value: userId }],
          height: 340
        }));
      }

      const changed = action === "add"
        ? addDeveloper(userId, message.author.id)
        : removeDeveloper(userId);

      return message.reply(buildBanner(client, message, {
        title: changed
          ? (action === "add" ? "DEVELOPER ADDED" : "DEVELOPER REMOVED")
          : "NO CHANGE",
        subtitle: changed
          ? (action === "add"
            ? "Developer access has been granted."
            : "Developer access has been revoked.")
          : (action === "add"
            ? "This user is already a developer."
            : "This user is not registered as a developer."),
        lines: [
          { label: "User ID", value: userId },
          { label: "Status", value: changed ? "Updated" : "Unchanged" },
          ...(action === "add"
            ? [{ label: "Access", value: `${DEVELOPER_OWNER_COMMANDS.size} selected owner commands` }]
            : [])
        ],
        height: 410
      }));
    }

    if (action === "list") {
      const developers = getDevelopers().filter(d => d.enabled);

      const lines = developers.length
        ? developers.flatMap((d, i) => [
            { label: `Developer ${i + 1}`, value: d.userId },
            { label: "Access", value: `${(d.allowedCommands || []).length} commands` }
          ])
        : ["No developers configured."];

      return message.reply(buildBanner(client, message, {
        title: "DEVELOPER LIST",
        subtitle: `${developers.length} active developer(s)`,
        lines,
        height: Math.min(850, Math.max(390, 250 + developers.length * 78))
      }));
    }

    if (action === "info") {
      const userId = getUserId(message, args);
      const developer = userId ? getDeveloper(userId) : null;

      if (!developer) {
        return message.reply(buildBanner(client, message, {
          title: "DEVELOPER NOT FOUND",
          subtitle: "No active developer record exists.",
          lines: [{ label: "User ID", value: userId || "Not supplied" }],
          height: 350
        }));
      }

      return message.reply(buildBanner(client, message, {
        title: "DEVELOPER INFORMATION",
        subtitle: "Developer access profile",
        lines: [
          { label: "User ID", value: developer.userId },
          { label: "Status", value: developer.enabled ? "Enabled" : "Disabled" },
          { label: "Access", value: `${(developer.allowedCommands || []).length} commands` },
          { label: "Commands", value: (developer.allowedCommands || []).join(", ") },
          { label: "Added By", value: developer.addedBy || "Unknown" }
        ],
        height: 510
      }));
    }

    return usage(client, message);
  }
};

module.exports = module.exports;
