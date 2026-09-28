const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const Database = require("../../database/Database");

const MAX_TRACKS    = 500;
const MAX_PLAYLISTS = 25;

module.exports = {
  name: "playlist-save",
  aliases: ["pl-save", "plsave", "psave", "savequeue", "sq"],
  description: "Save the current queue as a new playlist (or append to existing).",
  category: "playlist",
  usage: "+playlist-save <name> [--append]",
  argsRequired: true,
  examples: [
    "+playlist-save chill session",
    "+playlist-save my jams --append",
  ],
  data: new SlashCommandBuilder()
    .setName("playlist-save").setDescription("Save the current queue as a playlist.")
    .addStringOption(o =>
      o.setName("name").setDescription("Playlist name").setRequired(true).setMaxLength(50),
    )
    .addBooleanOption(o =>
      o.setName("append").setDescription("Append to existing playlist instead of replacing"),
    ),
  getSlashArgs: (opts) => {
    const parts = [opts.getString("name")];
    if (opts.getBoolean("append")) parts.push("--append");
    return parts;
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";

    const append = args.includes("--append");
    const name   = args.filter(a => a !== "--append").join(" ").slice(0, 50).trim();

    if (!name) {
      return message.reply(new V2Builder(color).section(
        `**playlist-save**\nSave the current queue as a playlist.\n\n`
        + `${rightsort} **Usage:** \`${prefix}playlist-save <name>\`\n`
        + `${rightsort} **Flags:** \`--append\` to add to existing playlist\n`
        + `-# Example: \`${prefix}playlist-save chill session\``,
        client.user.displayAvatarURL({ size: 256 }),
      ).build());
    }

    const player = client.lavalink.getPlayer(message.guild.id);
    if (!player || (!player.queue.current && !player.queue.tracks.length)) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Nothing Playing\n\n`
        + `${rightsort} There's no active queue to save.\n`
        + `-# Use \`${prefix}play\` to start playing music first`,
      ).build());
    }

    const allTracks = [
      ...(player.queue.current ? [player.queue.current] : []),
      ...player.queue.tracks,
    ].slice(0, MAX_TRACKS);

    const userId  = message.author.id;
    const exists  = Database.getPlaylist(userId, name);

    if (!exists) {
      const count = Database.getPlaylistCount(userId);
      if (count >= MAX_PLAYLISTS) {
        return message.reply(new V2Builder(color).text(
          `### ${cross} Playlist Limit Reached\n\n`
          + `${rightsort} You already have **${MAX_PLAYLISTS}** playlists.\n`
          + `-# Delete one with \`${prefix}playlist-delete\` first`,
        ).build());
      }
      Database.createPlaylist(userId, name);
    } else if (!append) {
      // Replace: delete then recreate
      Database.deletePlaylist(userId, name);
      Database.createPlaylist(userId, name);
    }

    const tracksArray = allTracks.map(t => ({
      url:      t.info.uri || "",
      title:    t.info.title || "Unknown",
      author:   t.info.author || "Unknown",
      duration: t.info.duration || 0,
    }));

    const added    = Database.addTracksToPlaylist(userId, name, tracksArray);
    let totalDur   = 0;
    for (const t of tracksArray) totalDur += t.duration;

    const art = allTracks[0]?.info?.artworkUrl;

    return message.reply(new V2Builder(color).section(
      `### ${tick} Queue Saved\n\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Saved:** \`${added}\` track${added !== 1 ? "s" : ""}\n`
      + `${rightsort} **Duration:** \`${convertTime(totalDur)}\`\n`
      + `${rightsort} **Mode:** ${append && exists ? "Appended" : "New / Replaced"}\n\n`
      + `-# Load it: \`${prefix}playlist-load ${name}\``,
      art || message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
