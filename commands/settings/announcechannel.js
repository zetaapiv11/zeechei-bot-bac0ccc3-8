const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const Database  = require("../../database/Database");
const { V2Builder } = require("../../utils/V2Builder");
const { BTN }   = require("../../utils/emojis");

module.exports = {
  name: "announce",
  aliases: ["ac", "announcechannel", "setnp"],
  description: "Set the channel where Now Playing embeds are sent for this server.",
  category: "settings",
  usage: "+announce",
  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Set the Now Playing announce channel for this server.")
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel to send Now Playing embeds in (omit to view/clear)")
        .addChannelTypes(ChannelType.GuildText),
    ),
  getSlashArgs: (opts) => {
    const ch = opts.getChannel("channel", false);
    return ch ? [ch.id] : [];
  },

  async execute({ client, message, args }) {
    const { tick, cross, rightsort, warning } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const guild  = message.guild;
    const prefix = message.prefix || "+";

    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply(client.util.v2msg(color,
        `${cross} You need **Manage Server** permission to use this command.`,
      ));
    }

    const s          = Database.getSettings(guild.id);
    const currentCh  = s.announce_ch ? guild.channels.cache.get(s.announce_ch) : null;
    const currentTxt = currentCh ? `<#${currentCh.id}>` : "*Not set*";

    // ── If a direct mention/id was passed (legacy style), handle immediately ──
    const directMention = message.mentions?.channels?.first();
    const directId      = args[0] && /^\d{17,20}$/.test(args[0]) ? args[0] : null;

    if (directMention || directId) {
      const ch = directMention || guild.channels.cache.get(directId);
      if (!ch || ch.type !== ChannelType.GuildText) {
        return message.reply(client.util.v2msg(color,
          `${cross} Please mention a valid **text channel**.`,
        ));
      }
      Database.setAnnounceChannel(guild.id, ch.id);
      return message.reply(client.util.v2msg(color,
        `${tick} **Announce Channel Set**\n\n`
        + `${rightsort} Now Playing embeds will be sent in ${ch}.\n`
        + `-# Use \`${prefix}announce\` to change or clear it.`,
      ));
    }

    // ── Interactive dropdown panel ─────────────────────────────────────────
    const selectRow = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("announce:select")
        .setPlaceholder("📢 Select a channel for Now Playing embeds...")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1),
    );

    const clearRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("announce:clear")
    .setLabel("Clear Announce Channel")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🗑️")
    .setDisabled(!s.announce_ch),

  new ButtonBuilder()
    .setCustomId("announce:cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("❌"),
);

    const panelPayload = new V2Builder(color)
      .section(
        `### 📢 __Announce Channel__\n\n`
        + `${rightsort} **Current Channel:** ${currentTxt}\n\n`
        + `> Select a channel from the dropdown below where **Now Playing** embeds\n`
        + `> will be automatically sent whenever a new track starts.\n\n`
        + `-# Only text channels are listed`,
        client.user.displayAvatarURL({ size: 64 }),
      )
      .sep()
      .row(selectRow)
      .row(clearRow)
      .build();

    const msg = await message.reply(panelPayload);

    const collector = msg.createMessageComponentCollector({
      filter: (i) => {
        if (i.user.id === message.author.id) return true;
        i.reply({ flags: MessageFlags.Ephemeral, content: `Only **${message.author.username}** can use this panel.` });
        return false;
      },
      time: 270_000,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.customId === "announce:cancel") {
          collector.stop("cancelled");
          return interaction.update(client.util.v2msg(color, `${cross} Cancelled.`));
        }

        if (interaction.customId === "announce:clear") {
          Database.setAnnounceChannel(guild.id, null);
          collector.stop("done");
          return interaction.update(client.util.v2msg(color,
            `${tick} **Announce Channel Cleared**\n\n`
            + `${rightsort} Now Playing embeds will no longer be sent to a dedicated channel.`,
          ));
        }

        if (interaction.isChannelSelectMenu() && interaction.customId === "announce:select") {
          const channelId = interaction.values[0];
          const ch        = guild.channels.cache.get(channelId);
          Database.setAnnounceChannel(guild.id, channelId);
          collector.stop("done");
          return interaction.update(client.util.v2msg(color,
            `${tick} **Announce Channel Set**\n\n`
            + `${rightsort} Now Playing embeds will be sent in <#${channelId}>.\n`
            + `-# Use \`${prefix}announce\` to change it at any time.`,
          ));
        }
      } catch (err) {
        console.error("[announce collector]", err);
      }
    });

    collector.on("end", (_, reason) => {
      if (reason === "time") {
        msg.edit(client.util.v2msg(color, `*${warning} Panel expired. Use \`${prefix}announce\` to open a new one.*`)).catch(() => {});
      }
    });
  },
};
