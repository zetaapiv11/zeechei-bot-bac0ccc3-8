const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config   = require("../../config");
const Database = require("../../database/Database");

module.exports = {
  name: "owners",
  aliases: ["ownerlist"],
  description: "List all bot owners. (Main owner only)",
  category: "general",
  usage: "+owners",
  mainOwnerOnly: true,
  data: new SlashCommandBuilder()
    .setName("owners")
    .setDescription("List all bot owners. (Main owner only)"),

  async execute({ client, message }) {
    const { cross, rightsort } = client.emoji;
    const color = client.getColor(message.guild?.id);

    if (message.author.id !== config.mainOwnerId) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Access Denied\n\n`
        + `${rightsort} Only the **main owner** can view the owner list.`,
      ).build());
    }

    const configOwners  = config.ownerIds.filter(id => id !== config.mainOwnerId);
    const dynamicOwners = Database.getOwners().filter(id => !config.ownerIds.includes(id));

    const lines = [];
    lines.push(`${rightsort} **Main Owner (cannot be removed)**\n\`${config.mainOwnerId}\` — <@${config.mainOwnerId}>`);
    lines.push("");

    if (configOwners.length) {
      lines.push(`${rightsort} **Config Owners** (edit config.js to change)`);
      configOwners.forEach(id => lines.push(`\`${id}\` — <@${id}>`));
      lines.push("");
    }

    if (dynamicOwners.length) {
      lines.push(`${rightsort} **Dynamic Owners** (added via +addowner)`);
      dynamicOwners.forEach(id => lines.push(`\`${id}\` — <@${id}>`));
    } else {
      lines.push(`-# No dynamic owners added yet.`);
    }

    return message.reply(new V2Builder(color).text(
      `### <:crown:1536064984512077885> Bot Owners\n\n${lines.join("\n")}`,
    ).build());
  },
};
