const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { BTN } = require("../../utils/emojis");
const Database = require("../../database/Database");

module.exports = {
  name: "playlist-delete",
  aliases: ["pl-delete", "pldelete", "pdelete"],
  description: "Delete one of your playlists permanently.",
  category: "playlist",
  usage: "+playlist-delete <name>",
  argsRequired: true,
  examples: ["+playlist-delete chill vibes", "+playlist-delete my jams"],
  data: new SlashCommandBuilder()
    .setName("playlist-delete").setDescription("Delete one of your playlists.")
    .addStringOption(o => o.setName("name").setDescription("Playlist name").setRequired(true)),
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
        + `-# Use \`${prefix}playlist-list\` to see your playlists`,
      ).build());
    }

    const trackCount = pl.tracks?.length || 0;

    // Confirm before deleting
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("pldel_confirm").setLabel("Delete").setEmoji(BTN.btn_delete).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("pldel_cancel").setLabel("Cancel").setEmoji(BTN.btn_cancel_x).setStyle(ButtonStyle.Secondary),
    );

    const msg = await message.reply(new V2Builder(color).section(
      `### ⚠️ Confirm Delete\n\n`
      + `${rightsort} **Playlist:** ${name}\n`
      + `${rightsort} **Tracks:** \`${trackCount}\`\n\n`
      + `This action **cannot be undone**.\n`
      + `-# Click Confirm to permanently delete`,
      message.author.displayAvatarURL({ size: 256 }),
    ).sep().row(confirmRow).build());

    const collector = msg.createMessageComponentCollector({
      filter: (b) => {
        if (b.user.id === message.author.id) return true;
        b.deferUpdate().catch(() => {});
        return false;
      },
      time: 270_000, max: 1,
    });

    collector.on("collect", async (btn) => {
      if (btn.customId === "pldel_confirm") {
        Database.deletePlaylist(message.author.id, name);
        await btn.update(new V2Builder(color).section(
          `### ${tick} Playlist Deleted\n\n`
          + `${rightsort} **${name}** (${trackCount} tracks) has been deleted.\n`
          + `-# Create a new one: \`${prefix}playlist-create <name>\``,
          message.author.displayAvatarURL({ size: 256 }),
        ).build());
      } else {
        await btn.update(new V2Builder(color).section(
          `### ✖ Cancelled\n\n${rightsort} **${name}** was not deleted.`,
          message.author.displayAvatarURL({ size: 256 }),
        ).build());
      }
    });

    collector.on("end", (_, reason) => {
      if (reason === "time") msg.edit({ components: [] }).catch(() => {});
    });
  },
};
