const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

module.exports = {
  name: "roleinfo",
  aliases: ["ri", "role"],
  description: "Shows information about a role.",
  category: "information",
  usage: "+roleinfo @role",
  data: new SlashCommandBuilder()
    .setName("roleinfo").setDescription("Shows information about a role.")
    .addRoleOption(o => o.setName("role").setDescription("Role to inspect").setRequired(true)),
  getSlashArgs: (opts) => {
    const role = opts.getRole("role");
    return role ? [`<@&${role.id}>`] : [];
  },

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);

    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ You didn't mention or provide a valid role.`)
          .build(),
      );
    }

    const createdTs     = Math.floor(role.createdTimestamp / 1000);
    const mentionable   = role.mentionable ? "Yes" : "No";
    const hoisted       = role.hoist       ? "Yes" : "No";
    const managed       = role.managed     ? "Yes" : "No";

    const allPerms = role.permissions.toArray();
    const permStr  = allPerms.length
      ? allPerms.map(p => {
          const w = p.replace(/_/g, "");
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }).join(", ")
      : "None";

    const text =
      `### <@&${role.id}> — Role Info\n\n`
      + `${E.arrow} Details\n`
      + `Name: ${role.name}\n`
      + `ID: ${role.id}\n`
      + `Color: \`${role.hexColor}\`\n`
      + `Position: ${role.position}\n`
      + `Members: ${role.members.size}\n`
      + `Created: <t:${createdTs}:R>\n\n`
      + `${E.arrow} Settings\n`
      + `Mentionable: ${mentionable}\n`
      + `Hoisted: ${hoisted}\n`
      + `Managed (Bot): ${managed}\n\n`
      + `${E.arrow} Permissions\n`
      + `${permStr}\n\n`
      + `-# Mention a role or provide its ID to look up any role.`;

    return message.reply(
      new V2Builder(role.color || color)
        .text(text)
        .build(),
    );
  },
};
