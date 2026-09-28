const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

module.exports = {
  name: "dm",
  aliases: [],
  description: "Send a DM to a mentioned user through the bot. (Owner only)",
  category: "general",
  usage: "+dm @user <message>",
  argsRequired: true,
  ownerOnly: true,
  examples: ["+dm @Alex Hello there!", "+dm @User123 Check out this song!"],
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send a DM to a mentioned user through the bot. (Owner only)")
    .addUserOption(o => o.setName("user").setDescription("The user to DM").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("The message to send").setRequired(true)),

  getSlashArgs: (opts) => {
    const user = opts.getUser("user");
    const msg  = opts.getString("message");
    return [user ? `<@${user.id}>` : "", ...msg.split(" ")];
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color = client.getColor(message.guild?.id);

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} No User Mentioned\n\n`
        + `${rightsort} Please mention a user to DM.\n`
        + `-# Usage: \`+dm @user <message>\``,
      ).build());
    }

    const text = args.slice(1).join(" ").trim();
    if (!text) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} No Message Provided\n\n`
        + `${rightsort} Please provide a message to send.\n`
        + `-# Usage: \`+dm @user <message>\``,
      ).build());
    }

    if (target.bot) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Cannot DM a Bot\n\n`
        + `${rightsort} Bots cannot receive direct messages.`,
      ).build());
    }

    try {
      await target.send(
        new V2Builder(0x5865F2).text(
          `### 📨 Message from ${message.author.username}\n\n`
          + `${rightsort} **Server:** ${message.guild?.name || "Direct"}\n`
          + `${rightsort} **Channel:** ${message.channel?.name ? `#${message.channel.name}` : "DM"}\n\n`
          + `${text}`,
        ).build(),
      );

      return message.reply(new V2Builder(color).text(
        `### ${tick} DM Sent\n\n`
        + `${rightsort} Your message has been delivered to **${target.username}**.\n`
        + `-# Message: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`,
      ).build());
    } catch {
      return message.reply(new V2Builder(color).text(
        `### ${cross} DM Failed\n\n`
        + `${rightsort} Could not send a DM to **${target.username}**.\n`
        + `-# They may have DMs disabled or have the bot blocked.`,
      ).build());
    }
  },
};
