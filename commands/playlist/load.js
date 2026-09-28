const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const Database = require("../../database/Database");

module.exports = {
  name: "playlist-load",
  aliases: ["pl-load", "plload", "pload", "playlist-play"],
  description: "Load and play one of your playlists.",
  category: "playlist",
  usage: "+playlist-load <name>",
  argsRequired: true,
  examples: ["+playlist-load chill vibes", "+playlist-load my jams"],
  data: new SlashCommandBuilder()
    .setName("playlist-load").setDescription("Load and play one of your playlists.")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true)),
  getSlashArgs: (opts) => [opts.getString("name")],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";
    const name   = args.join(" ").trim();

    const voice = message.member?.voice?.channel;
    if (!voice) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} No Voice Channel\n\n`
        + `${rightsort} Join a voice channel first!\n`
        + `-# Then use \`${prefix}playlist-load ${name}\``,
      ).build());
    }

    const tracks = Database.getPlaylistTracks(message.author.id, name);
    if (!tracks) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} No playlist named **${name}**.\n`
        + `-# See your playlists: \`${prefix}playlist-list\``,
      ).build());
    }
    if (!tracks.length) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Empty Playlist\n\n`
        + `${rightsort} **${name}** has no tracks yet.\n`
        + `-# Add tracks: \`${prefix}playlist-add ${name}\``,
      ).build());
    }

    let player = client.lavalink.getPlayer(message.guild.id);
    if (!player) {
      player = await client.lavalink.createPlayer({
        guildId: message.guild.id, voiceChannelId: voice.id,
        textChannelId: message.channel.id, selfDeaf: true,
      });
    }
    if (!player.connected) await player.connect();

    const loadMsg = await message.reply(new V2Builder(color).section(
      `### ⏳ Loading Playlist\n\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Tracks:** \`${tracks.length}\`\n`
      + `-# Resolving tracks, please wait...`,
      message.author.displayAvatarURL({ size: 256 }),
    ).build());

    let added = 0;
    let failed = 0;
    let totalDuration = 0;
    let firstArt = null;

    for (const t of tracks) {
      const res = await player.search({ query: t.url || t.title }, message.author).catch(() => null);
      if (!res || res.loadType === "empty" || res.loadType === "error" || !res.tracks?.length) {
        failed++; continue;
      }
      const resolved = res.tracks[0];
      await player.queue.add(resolved);
      if (!firstArt && resolved.info?.artworkUrl) firstArt = resolved.info.artworkUrl;
      totalDuration += resolved.info?.duration || 0;
      added++;
    }

    if (!player.playing && !player.paused) await player.play({ paused: false });

    const totalDur = convertTime(totalDuration);

    return loadMsg.edit(new V2Builder(color).section(
      `### ${tick} Playlist Loaded\n\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Loaded:** \`${added}/${tracks.length}\` tracks${failed ? ` *(${failed} failed)*` : ""}\n`
      + `${rightsort} **Total Duration:** \`${totalDur}\`\n`
      + `${rightsort} **Added by:** <@${message.author.id}>\n`
      + `-# Use \`${prefix}queue\` to view all tracks`,
      firstArt || message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
