const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const Database = require("../../database/Database");

const MAX_PLAYLISTS = 25;

module.exports = {
  name: "playlist-clone",
  aliases: ["pl-clone", "plclone", "pclone"],
  description: "Clone another user's playlist into your own library.",
  category: "playlist",
  usage: "+playlist-clone @user <playlist name> [new name]",
  argsRequired: true,
  examples: [
    "+playlist-clone @alice chill vibes",
    "+playlist-clone @bob my jams alice mix",
  ],
  data: new SlashCommandBuilder()
    .setName("playlist-clone").setDescription("Clone another user's playlist.")
    .addUserOption(o =>
      o.setName("user").setDescription("The user whose playlist to clone").setRequired(true),
    )
    .addStringOption(o =>
      o.setName("playlist").setDescription("Their playlist name").setRequired(true),
    )
    .addStringOption(o =>
      o.setName("newname").setDescription("Name for your cloned copy (optional)"),
    ),
  getSlashArgs: (opts) => {
    const parts = [`<@${opts.getUser("user").id}>`, opts.getString("playlist")];
    const nn = opts.getString("newname");
    if (nn) parts.push(nn);
    return parts;
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";

    const mention = message.mentions.users.first();
    if (!mention) {
      return message.reply(new V2Builder(color).section(
        `**playlist-clone**\nClone another user's playlist into your library.\n\n`
        + `${rightsort} **Usage:** \`${prefix}playlist-clone @user <playlist> [new name]\`\n`
        + `-# Example: \`${prefix}playlist-clone @alice chill vibes my copy\``,
        client.user.displayAvatarURL({ size: 256 }),
      ).build());
    }

    if (mention.id === message.author.id) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Can't Clone Your Own\n\n`
        + `${rightsort} Use \`${prefix}playlist-list\` to view your own playlists.\n`
        + `-# You cannot clone a playlist you own`,
      ).build());
    }

    // Args after the mention: "playlist name [new name]"
    const rest = args.slice(1);

    // Match against known playlist names of the target user (longest match wins)
    const allNames = Database.getUserPlaylists(mention.id).map(p => p.name);
    let plName  = null;
    let newName = null;

    const restStr = rest.join(" ");
    // Try longest match first
    const sorted = allNames.slice().sort((a, b) => b.length - a.length);
    for (const n of sorted) {
      if (restStr.toLowerCase().startsWith(n.toLowerCase())) {
        plName  = n;
        newName = restStr.slice(n.length).trim() || null;
        break;
      }
    }
    // Fallback: treat everything as playlist name
    if (!plName) plName = restStr;

    const sourcePl = Database.getPlaylist(mention.id, plName);
    if (!sourcePl) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} **${mention.username}** has no playlist named **${plName}**.\n`
        + `-# Ask them to use \`${prefix}playlist-share\` to show their list`,
      ).build());
    }

    const tracks = sourcePl.tracks || [];
    if (!tracks.length) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Empty Playlist\n\n`
        + `${rightsort} **${plName}** by ${mention.username} has no tracks.\n`
        + `-# Nothing to clone`,
      ).build());
    }

    const targetName = (newName || plName).slice(0, 50);
    const userId     = message.author.id;

    const count = Database.getPlaylistCount(userId);
    if (count >= MAX_PLAYLISTS) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Limit Reached\n\n`
        + `${rightsort} You already have **${MAX_PLAYLISTS}** playlists.\n`
        + `-# Delete one with \`${prefix}playlist-delete\` first`,
      ).build());
    }

    const ok = Database.createPlaylist(userId, targetName);
    if (!ok) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Name Already Taken\n\n`
        + `${rightsort} You already have a playlist named **${targetName}**.\n`
        + `-# Provide a different name as the third argument`,
      ).build());
    }

    const added = Database.addTracksToPlaylist(userId, targetName, tracks);
    let totalDur = 0;
    for (const t of tracks) totalDur += t.duration || 0;

    return message.reply(new V2Builder(color).section(
      `### ${tick} Playlist Cloned\n\n`
      + `${rightsort} **Source:** ${plName} by ${mention.username}\n`
      + `${rightsort} **Saved as:** ${targetName}\n`
      + `${rightsort} **Tracks:** \`${added}\`\n`
      + `${rightsort} **Duration:** \`${convertTime(totalDur)}\`\n\n`
      + `-# Load it: \`${prefix}playlist-load ${targetName}\``,
      message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
