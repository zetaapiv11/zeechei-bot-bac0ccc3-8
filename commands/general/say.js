const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");

module.exports = {
  name: "say",
  aliases: ["echo", "announce"],
  description: "Make the bot say something (owner only).",
  category: "general",
  usage: "+say <message>",
  argsRequired: true,
  examples: ["+say Hello everyone!", "+say Zeechei Bot is live!", "+say Welcome to the server!"],
  data: new SlashCommandBuilder()
    .setName("say").setDescription("Make the bot say something (owner only).")
    .addStringOption(o => o.setName("message").setDescription("What to say").setRequired(true)),
  getSlashArgs: (opts) => opts.getString("message").split(" "),

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);

    if (!config.ownerIds.includes(message.author.id))
      return message.reply(client.util.v2msg(color, `${client.emoji.cross} This command is restricted to the **bot owner**.`));

    if (!args.length)
      return message.reply(client.util.v2msg(color, `${client.emoji.cross} Provide a message to say.`));

    await message.delete().catch(() => {});
    message.channel.send(args.join(" "));
  },
};