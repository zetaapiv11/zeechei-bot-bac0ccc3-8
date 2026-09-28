const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const Database = require("../../database/Database");

module.exports = {
  name: "playlist-rename",
  aliases: ["pl-rename", "plrename", "prename"],
  description: "Rename one of your playlists.",
  category: "playlist",
  usage: "+playlist-rename <old name> | <new name>",
  argsRequired: true,
  examples: ["+playlist-rename chill vibes | relaxing songs", "+playlist-rename my jams | banger list"],
  data: new SlashCommandBuilder()
    .setName("playlist-rename").setDescription("Rename a playlist.")
    .addStringOption(o => o.setName("oldname").setDescription("Current playlist name").setRequired(true))
    .addStringOption(o => o.setName("newname").setDescription("New playlist name").setRequired(true).setMaxLength(50)),
  getSlashArgs: (opts) => [opts.getString("oldname"), "|", opts.getString("newname")],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";

    // Split on "|" separator
    const full     = args.join(" ");
    const pipeIdx  = full.indexOf("|");
    if (pipeIdx === -1) {
      return message.reply(new V2Builder(color).section(
        `**playlist-rename**\nRename one of your playlists.\n\n`
        + `${rightsort} **Usage:** \`${prefix}playlist-rename <old name> | <new name>\`\n`
        + `-# Example: \`${prefix}playlist-rename chill vibes | relaxing songs\``,
        client.user.displayAvatarURL({ size: 256 }),
      ).build());
    }

    const oldName = full.slice(0, pipeIdx).trim();
    const newName = full.slice(pipeIdx + 1).trim().slice(0, 50);

    if (!oldName || !newName) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Invalid Input\n\n`
        + `${rightsort} Both old and new names must be provided.\n`
        + `-# Usage: \`${prefix}playlist-rename <old> | <new>\``,
      ).build());
    }

    if (!Database.getPlaylist(message.author.id, oldName)) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} No playlist named **${oldName}**.\n`
        + `-# Use \`${prefix}playlist-list\` to see your playlists`,
      ).build());
    }

    const ok = Database.renamePlaylist(message.author.id, oldName, newName);
    if (!ok) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Rename Failed\n\n`
        + `${rightsort} A playlist named **${newName}** already exists.\n`
        + `-# Pick a different name`,
      ).build());
    }

    const trackCount = Database.getPlaylistTracks(message.author.id, newName)?.length || 0;

    return message.reply(new V2Builder(color).section(
      `### ${tick} Playlist Renamed\n\n`
      + `${rightsort} **Old Name:** ${oldName}\n`
      + `${rightsort} **New Name:** ${newName}\n`
      + `${rightsort} **Tracks:** \`${trackCount}\`\n`
      + `-# Play it: \`${prefix}playlist-load ${newName}\``,
      message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
