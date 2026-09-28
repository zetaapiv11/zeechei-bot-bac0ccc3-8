const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const Database = require("../../database/Database");

module.exports = {
  name: "djrole",
  aliases: ["dj"],
  description: "Set the DJ role for music commands.",
  category: "settings",
  usage: "+djrole @role",
  argsRequired: true,
  examples: ["+djrole @DJ","+djrole none","+djrole @Music"],
  data: new SlashCommandBuilder()
    .setName("djrole").setDescription("Set the DJ role for music commands.")
    .addRoleOption(o => o.setName("role").setDescription("Role to set as DJ")),
  async execute({ client, message }) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply(client.util.v2msg(client.getColor(message?.guild?.id), client.emoji.cross + " " + "You need **Manage Server** permission."));
    const role = message.mentions.roles.first();
    if (!role) {
      const s = Database.getSettings(message.guild.id);
      return message.reply(client.util.v2msg(client.getColor(message?.guild?.id), `Current DJ role: ${s.dj_role ? `<@&${s.dj_role}>` : "Not set"}`));
    }
    Database.setDjRole(message.guild.id, role.id);
    message.reply(client.util.v2msg(client.getColor(message?.guild?.id), client.emoji.tick + " " + `DJ role set to ${role}.`));
  },
};
