const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const Database = require("../../database/Database");
const path = require("path");
const fs   = require("fs");

const DB_PATH = path.join(process.cwd(), "data", "zeechei.json");

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shufflePlaylistTracks(userId, name) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
  catch { return false; }
  if (!raw.playlists?.[userId]?.[name]) return false;
  raw.playlists[userId][name].tracks = shuffleArray([...raw.playlists[userId][name].tracks]);
  fs.writeFileSync(DB_PATH, JSON.stringify(raw, null, 2));
  return true;
}

module.exports = {
  name: "playlist-shuffle",
  aliases: ["pl-shuffle", "plshuffle", "pshuffle"],
  description: "Shuffle the tracks in one of your saved playlists.",
  category: "playlist",
  usage: "+playlist-shuffle <name>",
  argsRequired: true,
  examples: [
    "+playlist-shuffle chill vibes",
    "+playlist-shuffle study mix",
  ],
  data: new SlashCommandBuilder()
    .setName("playlist-shuffle").setDescription("Shuffle the tracks in a saved playlist.")
    .addStringOption(o =>
      o.setName("name").setDescription("Playlist name").setRequired(true),
    ),
  getSlashArgs: (opts) => [opts.getString("name")],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";
    const name   = args.join(" ").trim();

    const pl = Database.getPlaylist(message.author.id, name);
    if (!pl) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} No playlist named **${name}**.\n`
        + `-# See your playlists: \`${prefix}playlist-list\``,
      ).build());
    }

    const tracks = pl.tracks || [];
    if (tracks.length < 2) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Not Enough Tracks\n\n`
        + `${rightsort} **${name}** needs at least 2 tracks to shuffle.\n`
        + `-# Add more: \`${prefix}playlist-add ${name}\``,
      ).build());
    }

    const ok = shufflePlaylistTracks(message.author.id, name);
    if (!ok) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Shuffle Failed\n\n`
        + `${rightsort} Could not shuffle **${name}**.\n`
        + `-# Try again or contact the bot owner`,
      ).build());
    }

    return message.reply(new V2Builder(color).section(
      `### ${tick} Playlist Shuffled\n\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Tracks:** \`${tracks.length}\` shuffled randomly\n\n`
      + `-# Load it: \`${prefix}playlist-load ${name}\``,
      message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
