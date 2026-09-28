const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const Database = require("../../database/Database");

module.exports = {
  name: "playlist-remove",
  aliases: ["pl-remove", "plremove", "premove"],
  description: "Remove a track from one of your playlists by its position.",
  category: "playlist",
  usage: "+playlist-remove <name> <position>",
  argsRequired: true,
  examples: ["+playlist-remove chill vibes 3", "+playlist-remove my jams 1"],
  data: new SlashCommandBuilder()
    .setName("playlist-remove").setDescription("Remove a track from a playlist.")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true))
    .addIntegerOption(o => o.setName("position").setDescription("Track position").setMinValue(1).setRequired(true)),
  getSlashArgs: (opts) => [opts.getString("name"), String(opts.getInteger("position"))],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";

    // Last arg is position, rest is name
    const pos  = parseInt(args[args.length - 1]);
    const name = args.slice(0, -1).join(" ").trim();

    if (!name || isNaN(pos)) {
      return message.reply(new V2Builder(color).section(
        `**playlist-remove**\nRemove a track from a playlist.\n\n`
        + `${rightsort} **Usage:** \`${prefix}playlist-remove <name> <position>\`\n`
        + `-# Example: \`${prefix}playlist-remove chill vibes 3\``,
        client.user.displayAvatarURL({ size: 256 }),
      ).build());
    }

    const tracks = Database.getPlaylistTracks(message.author.id, name);
    if (!tracks) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} No playlist named **${name}**.\n`
        + `-# Use \`${prefix}playlist-list\` to see your playlists`,
      ).build());
    }

    if (pos < 1 || pos > tracks.length) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Invalid Position\n\n`
        + `${rightsort} **Playlist:** ${name} (${tracks.length} tracks)\n`
        + `${rightsort} **Valid Range:** \`1\` — \`${tracks.length}\`\n`
        + `-# Use \`${prefix}playlist-view ${name}\` to see track positions`,
      ).build());
    }

    const removed = Database.removeTrackFromPlaylist(message.author.id, name, pos - 1);
    if (!removed) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Failed\n\n${rightsort} Could not remove that track.`,
      ).build());
    }

    const remaining = Database.getPlaylistTracks(message.author.id, name)?.length || 0;

    return message.reply(new V2Builder(color).section(
      `### ${tick} Track Removed\n\n`
      + `${rightsort} **Track:** ${(removed.title || "Unknown").slice(0, 55)}\n`
      + `${rightsort} **Duration:** \`${convertTime(removed.duration || 0)}\`\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Remaining:** \`${remaining}\` tracks\n`
      + `-# Use \`${prefix}playlist-view ${name}\` to see the updated list`,
      message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
