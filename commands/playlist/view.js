const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const { BTN } = require("../../utils/emojis");
const Database = require("../../database/Database");

const PAGE_SIZE = 10;

module.exports = {
  name: "playlist-view",
  aliases: ["pl-view", "plview", "pview", "playlist-show"],
  description: "View the tracks inside one of your playlists.",
  category: "playlist",
  usage: "+playlist-view <name>",
  argsRequired: true,
  examples: ["+playlist-view chill vibes", "+playlist-view my jams"],
  data: new SlashCommandBuilder()
    .setName("playlist-view").setDescription("View tracks in a playlist.")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true)),
  getSlashArgs: (opts) => [opts.getString("name")],

  async execute({ client, message, args }) {
    const { rightsort, cross, dot } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";
    const name   = args.join(" ").trim();

    const tracks = Database.getPlaylistTracks(message.author.id, name);
    if (!tracks) {
      return message.reply(new V2Builder(color).text(
        `### ${cross} Playlist Not Found\n\n`
        + `${rightsort} No playlist named **${name}**.\n`
        + `-# Use \`${prefix}playlist-list\` to see your playlists`,
      ).build());
    }

    if (!tracks.length) {
      return message.reply(new V2Builder(color).section(
        `### 📂 ${name} — Empty\n\n`
        + `${rightsort} This playlist has no tracks yet.\n`
        + `-# Add tracks: \`${prefix}playlist-add ${name}\``,
        message.author.displayAvatarURL({ size: 256 }),
      ).build());
    }

    const pages = [];
    for (let i = 0; i < tracks.length; i += PAGE_SIZE) pages.push(tracks.slice(i, i + PAGE_SIZE));
    const totalPages = pages.length;
    let page = 0;

    const totalDur = tracks.reduce((s, t) => s + (t.duration || 0), 0);

    const buildPayload = (p) => {
      const chunk = pages[p];
      const lines = chunk.map((t, i) =>
        `\`${String(p * PAGE_SIZE + i + 1).padStart(2)}.\` **${(t.title || "Unknown").slice(0, 50)}**\n`
        + `⠀\`${convertTime(t.duration || 0)}\` — ${(t.author || "Unknown").slice(0, 30)}`,
      ).join("\n\n");

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("plv_first").setEmoji(BTN.nav_first).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("plv_prev").setEmoji(BTN.nav_prev).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("plv_close").setEmoji(BTN.nav_close).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("plv_next").setEmoji(BTN.nav_next).setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
        new ButtonBuilder().setCustomId("plv_last").setEmoji(BTN.nav_last).setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
      );

      const builder = new V2Builder(color).section(
        `**${name}**\n`
        + `${tracks.length} tracks ${dot} ${convertTime(totalDur)}\n\n`
        + lines
        + `\n\n-# Page ${p + 1}/${totalPages} ${dot} \`${prefix}playlist-remove ${name} <#>\` to remove`,
        message.author.displayAvatarURL({ size: 256 }),
      );
      if (totalPages > 1) builder.sep().row(navRow);
      return builder.build();
    };

    if (totalPages <= 1) return message.reply(buildPayload(0));

    const msg = await message.reply(buildPayload(0));
    const collector = msg.createMessageComponentCollector({
      filter: (b) => {
        if (b.user.id === message.author.id) return true;
        b.deferUpdate().catch(() => {}); return false;
      },
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (btn) => {
      try {
        switch (btn.customId) {
          case "plv_first": page = 0; break;
          case "plv_prev":  page = Math.max(page - 1, 0); break;
          case "plv_close": collector.stop(); return btn.update({ components: [] });
          case "plv_next":  page = Math.min(page + 1, totalPages - 1); break;
          case "plv_last":  page = totalPages - 1; break;
          default: return;
        }
        await btn.update(buildPayload(page));
      } catch {}
    });

    collector.on("end", (_, reason) => {
      if (reason !== "closed") msg.edit({ components: [] }).catch(() => {});
    });
  },
};
