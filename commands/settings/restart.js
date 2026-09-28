module.exports = {
  name: "restart",
  aliases: ["reboot", "rb"],
  description: "Restart the bot process (main owner only).",
  category: "settings",
  usage: "+restart",
  mainOwnerOnly: true,
  argsRequired: false,

  async execute({ client, message }) {
    const { tick, rightsort: R } = client.emoji;
    const color = client.getColor(message.guild?.id);

    await message.reply(client.util.v2msg(color,
      `### 🔄 Restarting...\n\n`
      + `${R} Bot is going down for a restart.\n`
      + `${R} Will be back online in a few seconds.\n`
      + `-# Initiated by **${message.author.tag}**`,
    ));

    // Give Discord time to deliver the message before exiting.
    // The Replit workflow runner will automatically restart the process.
    setTimeout(() => process.exit(0), 1500);
  },
};
