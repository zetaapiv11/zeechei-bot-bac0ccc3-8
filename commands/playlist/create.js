const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const Database = require("../../database/Database");

const MAX_PLAYLISTS = 25;

module.exports = {
  name: "playlist-create",
  aliases: ["pl-create", "plcreate", "pcreate"],
  description: "Create a new personal playlist.",
  category: "playlist",
  usage: "+playlist-create <name>",
  argsRequired: true,
  examples: ["+playlist-create chill vibes", "+playlist-create my jams", "+playlist-create study mix"],
  data: new SlashCommandBuilder()
    .setName("playlist-create").setDescription("Create a new playlist.")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true).setMaxLength(50)),
  getSlashArgs: (opts) => [opts.getString("name")],

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";

    const name  = args.join(" ").slice(0, 50).trim();
    if (!name) {
      return message.reply(new V2Builder(color).section(
        `**playlist-create**\nCreate a new personal playlist.\n\n`
        + `${rightsort} **Usage:** \`${prefix}playlist-create <name>\`\n`
        + `-# Example: \`${prefix}playlist-create chill vibes\``,
        client.user.displayAvatarURL({ size: 256 }),
      ).build());
    }

    const count = Database.getPlaylistCount(message.author.id);
    if (count >= MAX_PLAYLISTS) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Limit Reached\n\n`
        + `${rightsort} Maximum of **${MAX_PLAYLISTS}** playlists per user.\n`
        + `-# Delete old ones with \`${prefix}playlist-delete\``,
      ).build());
    }

    const ok = Database.createPlaylist(message.author.id, name);
    if (!ok) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Already Exists\n\n`
        + `${rightsort} A playlist named **${name}** already exists.\n`
        + `-# Use \`${prefix}playlist-list\` to see your playlists`,
      ).build());
    }

    return message.reply(new V2Builder(color).section(
      `### ${tick} Playlist Created\n\n`
      + `${rightsort} **Name:** ${name}\n`
      + `${rightsort} **Tracks:** \`0\`\n`
      + `${rightsort} **Created by:** <@${message.author.id}>\n\n`
      + `-# Add songs: \`${prefix}playlist-add ${name}\` • Play: \`${prefix}playlist-load ${name}\``,
      message.author.displayAvatarURL({ size: 256 }),
    ).build());
  },
};
