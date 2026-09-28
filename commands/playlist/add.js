const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const Database = require("../../database/Database");

const MAX_TRACKS = 500;

module.exports = {
  name: "playlist-add",
  aliases: ["pl-add", "pladd", "padd"],
  description: "Add the current track (or a URL) to one of your playlists.",
  category: "playlist",
  usage: "+playlist-add <name> [url]",
  argsRequired: true,
  examples: ["+playlist-add chill vibes", "+playlist-add my jams https://youtu.be/xyz"],
  data: new SlashCommandBuilder()
    .setName("playlist-add").setDescription("Add a track to a playlist.")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true))
    .addStringOption(o => o.setName("url").setDescription("Track URL (default: current song)")),
  getSlashArgs: (opts) => {
    const args = [opts.getString("name")];
    const url  = opts.getString("url");
    if (url) args.push(url);
    return args;
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";

    // Separate playlist name from optional URL (last arg if it looks like a URL)
    let name, urlArg;
    const lastArg = args[args.length - 1];
    if (args.length > 1 && (lastArg.startsWith("http://") || lastArg.startsWith("https://"))) {
      urlArg = args.pop();
      name   = args.join(" ").trim();
    } else {
      name = args.join(" ").trim();
    }

    if (!Database.getPlaylist(message.author.id, name)) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} No playlist named **${name}**.\n`
        + `-# Create it: \`${prefix}playlist-create ${name}\``,
      ).build());
    }

    const existing = Database.getPlaylistTracks(message.author.id, name) || [];
    if (existing.length >= MAX_TRACKS) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Full\n\n`
        + `${rightsort} Max **${MAX_TRACKS}** tracks per playlist.\n`
        + `-# Remove tracks: \`${prefix}playlist-remove ${name} <position>\``,
      ).build());
    }

    let track;
    if (urlArg) {
      // Resolve URL
      const loading = await message.reply(new V2Builder(color).text(
        `### ⏳ Resolving...\n\n${rightsort} Fetching track info for the provided URL.`,
      ).build());
      let player = client.lavalink.getPlayer(message.guild.id);
      if (!player) {
        const voice = message.member?.voice?.channel;
        if (!voice) {
          return loading.edit(new V2Builder(color).text(
            `### ${cross} No Voice Channel\n\n${rightsort} Join a voice channel so I can resolve the URL.`,
          ).build());
        }
        player = await client.lavalink.createPlayer({
          guildId: message.guild.id, voiceChannelId: voice.id,
          textChannelId: message.channel.id, selfDeaf: true,
        });
        if (!player.connected) await player.connect();
      }
      const res = await player.search({ query: urlArg }, message.author).catch(() => null);
      if (!res?.tracks?.length) {
        return loading.edit(new V2Builder(color).text(
          `### ${cross} Not Found\n\n${rightsort} Could not resolve that URL into a track.`,
        ).build());
      }
      if (res.loadType === "playlist") {
        // Add all tracks from playlist
        const trackData = res.tracks.map(t => ({
          url: t.info.uri, title: t.info.title,
          author: t.info.author, duration: t.info.duration,
        }));
        const added = Database.addTracksToPlaylist(message.author.id, name, trackData);
        return loading.edit(new V2Builder(color).section(
          `### ${tick} Playlist Imported\n\n`
          + `${rightsort} **Playlist:** ${res.playlist?.name || "Unknown"}\n`
          + `${rightsort} **Tracks Added:** \`${res.tracks.length}\` → **${name}**\n`
          + `${rightsort} **Total Tracks Now:** \`${added}\`\n`
          + `-# Use \`${prefix}playlist-load ${name}\` to play`,
          res.tracks[0]?.info?.artworkUrl,
        ).build());
      }
      track = res.tracks[0];
      const ok = Database.addTrackToPlaylist(
        message.author.id, name,
        track.info.uri, track.info.title, track.info.author, track.info.duration,
      );
      if (!ok) {
        return loading.edit(new V2Builder(color).text(
          `### ${cross} Failed\n\n${rightsort} Could not add the track. Check playlist name.`,
        ).build());
      }
      const total = (Database.getPlaylistTracks(message.author.id, name) || []).length;
      return loading.edit(new V2Builder(color).section(
        `### ${tick} Added to Playlist\n\n`
        + `${rightsort} **Track:** ${(track.info.title || "Unknown").slice(0, 55)}\n`
        + `${rightsort} **Playlist:** ${name}\n`
        + `${rightsort} **Duration:** \`${convertTime(track.info.duration || 0)}\`\n`
        + `${rightsort} **Playlist Size:** \`${total}\` tracks\n`
        + `-# Use \`${prefix}playlist-load ${name}\` to play`,
        track.info.artworkUrl,
      ).build());
    }

    // Add current playing track
    const player = client.lavalink?.getPlayer(message.guild.id);
    const current = player?.queue.current;
    if (!current) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Nothing Playing\n\n`
        + `${rightsort} Play a song first, or provide a URL:\n`
        + `-# \`${prefix}playlist-add ${name} <url>\``,
      ).build());
    }

    const ok = Database.addTrackToPlaylist(
      message.author.id, name,
      current.info.uri, current.info.title, current.info.author, current.info.duration,
    );
    if (!ok) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Failed\n\n${rightsort} Could not add track. Check playlist name.`,
      ).build());
    }

    const total = (Database.getPlaylistTracks(message.author.id, name) || []).length;
    return message.reply(new V2Builder(color).section(
      `### ${tick} Added to Playlist\n\n`
      + `${rightsort} **Track:** ${(current.info.title || "Unknown").slice(0, 55)}\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Duration:** \`${convertTime(current.info.duration || 0)}\`\n`
      + `${rightsort} **Playlist Size:** \`${total}\` tracks\n`
      + `-# Use \`${prefix}playlist-load ${name}\` to play`,
      current.info.artworkUrl,
    ).build());
  },
};
