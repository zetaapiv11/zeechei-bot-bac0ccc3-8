const { SlashCommandBuilder, ActivityType } = require("discord.js");
const { isOwner } = require("../../utils/OwnerHelpers");
const { buildBanner } = require("../../utils/OwnerBanner");

const TYPES = {
  playing: ActivityType.Playing,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
  streaming: ActivityType.Streaming
};

module.exports = {
  name: "setstatus",
  aliases: ["status"],
  description: "Change Zeechei's presence.",
  category: "settings",
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("setstatus")
    .setDescription("Change Zeechei's presence.")
    .addStringOption(o =>
      o.setName("type").setDescription("Activity type").setRequired(true)
        .addChoices(
          { name: "Playing", value: "playing" },
          { name: "Listening", value: "listening" },
          { name: "Watching", value: "watching" },
          { name: "Competing", value: "competing" }
        )
    )
    .addStringOption(o =>
      o.setName("text").setDescription("Activity text").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("status").setDescription("Online status").setRequired(false)
        .addChoices(
          { name: "Online", value: "online" },
          { name: "Idle", value: "idle" },
          { name: "Do Not Disturb", value: "dnd" },
          { name: "Invisible", value: "invisible" }
        )
    ),

  getSlashArgs(interaction) {
    return [
      interaction.options.getString("type"),
      interaction.options.getString("text"),
      interaction.options.getString("status") || "online"
    ];
  },

  async execute({ client, message, args }) {
    if (!isOwner(message.author.id)) {
      return message.reply(buildBanner(client, message, {
        title: "ACCESS DENIED",
        subtitle: "Owner or authorized developer access required.",
        lines: [{ label: "Status", value: "Denied" }],
        height: 330
      }));
    }

    const type = String(args?.[0] || "playing").toLowerCase();
    const text = String(args?.[1] || "").trim();
    const status = String(args?.[2] || "online").toLowerCase();

    if (!text || !TYPES[type]) {
      return message.reply(buildBanner(client, message, {
        title: "INVALID STATUS",
        subtitle: "A valid activity type and text are required.",
        lines: [
          { label: "Types", value: "playing, listening, watching, competing" },
          { label: "Example", value: `${message.prefix || ","}setstatus playing Zeechei Music` }
        ],
        height: 380
      }));
    }

    await client.user.setPresence({
      status: ["online", "idle", "dnd", "invisible"].includes(status) ? status : "online",
      activities: [{ name: text.slice(0, 128), type: TYPES[type] }]
    });

    return message.reply(buildBanner(client, message, {
      title: "STATUS UPDATED",
      subtitle: "Zeechei presence has been changed.",
      lines: [
        { label: "Activity", value: type },
        { label: "Text", value: text },
        { label: "Status", value: status }
      ],
      height: 390
    }));
  }
};
