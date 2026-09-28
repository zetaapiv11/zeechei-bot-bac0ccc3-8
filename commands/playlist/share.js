const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const { BTN } = require("../../utils/emojis");
const Database = require("../../database/Database");

const PAGE_SIZE = 10;

module.exports = {
  name: "playlist-share",
  aliases: ["pl-share", "plshare", "pshare"],
  description: "Share one of your playlists so others can view or clone it.",
  category: "playlist",
  usage: "+playlist-share <name>",
  argsRequired: true,
  examples: [
    "+playlist-share chill vibes",
    "+playlist-share my jams",
  ],
  data: new SlashCommandBuilder()
    .setName("playlist-share").setDescription("Share a playlist publicly.")
    .addStringOption(o =>
      o.setName("name").setDescription("Playlist name").setRequired(true),
    ),
  getSlashArgs: (opts) => [opts.getString("name")],

  async execute({ client, message, args }) {
    const { cross, rightsort, dot } = client.emoji;
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
    if (!tracks.length) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Empty Playlist\n\n`
        + `${rightsort} **${name}** has no tracks to share.\n`
        + `-# Add tracks: \`${prefix}playlist-add ${name}\``,
      ).build());
    }

    const totalPages = Math.ceil(tracks.length / PAGE_SIZE);
    let totalDur = 0;
    for (const t of tracks) totalDur += t.duration || 0;

    const avatar = message.author.displayAvatarURL({ size: 256 });
    const owner  = message.author.displayName || message.author.username;

    const buildPage = (p) => {
      const slice  = tracks.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
      const start  = p * PAGE_SIZE;
      const entries = slice.map((t, i) =>
        `${dot} **${start + i + 1}.** [${(t.title || "Unknown").slice(0, 45)}](${t.url || "https://discord.gg"})\n`
        + `⠀\`${convertTime(t.duration || 0)}\` — ${(t.author || "Unknown").slice(0, 30)}`,
      ).join("\n\n");

      const header =
        `### 🎵 ${name}\n`
        + `*Shared by **${owner}***\n\n`
        + `${rightsort} **Tracks:** \`${tracks.length}\` • **Duration:** \`${convertTime(totalDur)}\`\n`
        + `${rightsort} Clone with: \`${prefix}playlist-clone @${message.author.username} ${name}\`\n\n`
        + `${entries}\n\n`
        + `-# Page ${p + 1} / ${totalPages}`;

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pls_first").setEmoji(BTN.nav_first).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("pls_prev").setEmoji(BTN.nav_prev).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("pls_close").setEmoji(BTN.nav_close).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("pls_next").setEmoji(BTN.nav_next).setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
        new ButtonBuilder().setCustomId("pls_last").setEmoji(BTN.nav_last).setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
      );

      const builder = new V2Builder(color).section(header, avatar);
      if (totalPages > 1) builder.sep().row(navRow);
      return builder.build();
    };

    if (totalPages <= 1) return message.reply(buildPage(0));

    const msg = await message.reply(buildPage(0));
    let p = 0;

    const collector = msg.createMessageComponentCollector({ time: 270_000 });
    collector.on("collect", async (i) => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: "This is not your playlist share.", ephemeral: true });
      }
      if (i.customId === "pls_close") { collector.stop(); return msg.delete().catch(() => {}); }
      if (i.customId === "pls_first") p = 0;
      else if (i.customId === "pls_prev")  p = Math.max(0, p - 1);
      else if (i.customId === "pls_next")  p = Math.min(totalPages - 1, p + 1);
      else if (i.customId === "pls_last")  p = totalPages - 1;
      await i.update(buildPage(p));
    });
    collector.on("end", () => {
      msg.edit(buildPage(p)).catch(() => {});
    });
  },
};
