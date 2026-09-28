const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { convertTime } = require("../../utils/convertTime");
const { BTN } = require("../../utils/emojis");
const Database = require("../../database/Database");

const PAGE_SIZE = 8;

module.exports = {
  name: "playlists",
  aliases: ["playlist-list", "pl-list", "myplaylists", "plist"],
  description: "List all your saved playlists.",
  category: "playlist",
  usage: "+playlists",
  examples: ["+playlists"],
  data: new SlashCommandBuilder().setName("playlists").setDescription("List all your saved playlists."),

  async execute({ client, message }) {
    const { rightsort, cross, dot } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const prefix = message.prefix || "+";
    const pls    = Database.getUserPlaylists(message.author.id);

    if (!pls.length) {
      return message.reply(new V2Builder(color).section(
        `### 📂 No Playlists\n\n`
        + `${rightsort} You haven't created any playlists yet.\n\n`
        + `${rightsort} **Create one:**\n`
        + `⠀\`${prefix}playlist-create <name>\`\n`
        + `-# Up to 25 playlists • 500 tracks each`,
        message.author.displayAvatarURL({ size: 256 }),
      ).build());
    }

    const pages = [];
    for (let i = 0; i < pls.length; i += PAGE_SIZE) pages.push(pls.slice(i, i + PAGE_SIZE));
    let page = 0;

    const totalTracks = pls.reduce((s, p) => s + (p.tracks?.length || 0), 0);

    const buildPayload = (p) => {
      const entries = pages[p].map((pl, i) => {
        const totalDur = (pl.tracks || []).reduce((s, t) => s + (t.duration || 0), 0);
        return `\`${p * PAGE_SIZE + i + 1}.\` **${pl.name}**\n`
          + `⠀${pl.tracks?.length || 0} tracks ${dot} ${totalDur > 0 ? convertTime(totalDur) : "0:00"}`;
      }).join("\n\n");

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pl_first").setEmoji(BTN.nav_first).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("pl_prev").setEmoji(BTN.nav_prev).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("pl_close").setEmoji(BTN.nav_close).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("pl_next").setEmoji(BTN.nav_next).setStyle(ButtonStyle.Secondary).setDisabled(p >= pages.length - 1),
        new ButtonBuilder().setCustomId("pl_last").setEmoji(BTN.nav_last).setStyle(ButtonStyle.Secondary).setDisabled(p >= pages.length - 1),
      );

      const builder = new V2Builder(color).section(
        `**${message.author.displayName || message.author.username}'s Playlists**\n`
        + `${pls.length} playlists ${dot} ${totalTracks} total tracks\n\n`
        + entries
        + `\n\n-# Page ${p + 1}/${pages.length} ${dot} \`${prefix}playlist-view <name>\` to see tracks`,
        message.author.displayAvatarURL({ size: 256 }),
      );
      if (pages.length > 1) builder.sep().row(navRow);
      return builder.build();
    };

    if (pages.length <= 1) return message.reply(buildPayload(0));

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
          case "pl_first": page = 0; break;
          case "pl_prev":  page = Math.max(page - 1, 0); break;
          case "pl_close": collector.stop(); return btn.update({ components: [] });
          case "pl_next":  page = Math.min(page + 1, pages.length - 1); break;
          case "pl_last":  page = pages.length - 1; break;
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
