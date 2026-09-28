const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { BTN, TXT: E } = require("../../utils/emojis");
const Database      = require("../../database/Database");

const SOURCES = [
  { label: "🎵 YouTube Music", value: "ytmsearch", description: "Default — best for music searches"      },
  { label: "YouTube",       value: "ytsearch",  description: "Standard YouTube video search"          },
  { label: "☁️ SoundCloud",    value: "scsearch",  description: "SoundCloud tracks and mixes"            },
  { label: "🟢 Spotify",       value: "spsearch",  description: "Spotify tracks (streamed via fallback)" },
  { label: "🍎 Apple Music",   value: "amsearch",  description: "Apple Music tracks"                     },
  { label: "🔷 Deezer",        value: "dzsearch",  description: "Deezer tracks"                          },
];

const SOURCE_MAP = Object.fromEntries(SOURCES.map(s => [s.value, s.label]));

function buildSelectRow(pending) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("sources:select")
      .setPlaceholder("Choose a music source...")
      .addOptions(SOURCES.map(s => ({
        label:       s.label,
        value:       s.value,
        description: s.description,
        default:     s.value === pending,
      }))),
  );
}

function buildConfirmRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sources:confirm")
      .setEmoji(BTN.btn_confirm)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("sources:cancel")
      .setEmoji(BTN.btn_cancel_x)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildPayload(color, rightsort, dot, avatarUrl, active, pending) {
  const lines = SOURCES.map(s => {
    let badge = "";
    if (s.value === active)  badge += ` ${dot} **Active**`;
    if (s.value === pending && pending !== active) badge += ` ← *pending*`;
    return `${rightsort} ${s.label}${badge} — *${s.description}*`;
  }).join("\n");

  const hasPending = pending && pending !== active;

  const builder = new V2Builder(color)
    .section(
      `### __Music Sources__\n\n`
      + `${rightsort} **Current:** ${SOURCE_MAP[active] || "YouTube Music"}\n`
      + (hasPending ? `${rightsort} **Selected:** ${SOURCE_MAP[pending]}\n` : "")
      + `\n${lines}\n\n`
      + (hasPending
        ? `-# Confirm or cancel the source change below`
        : `-# Select a source from the menu below`),
      avatarUrl,
    )
    .sep()
    .row(buildSelectRow(hasPending ? pending : active));

  if (hasPending) builder.sep().row(buildConfirmRow());

  return builder.build();
}

module.exports = {
  name: "sources",
  aliases: ["source", "musicsource", "searchsource"],
  description: "Set the default music source for this server.",
  category: "settings",
  usage: "+sources",
  examples: ["+sources"],
  data: new SlashCommandBuilder()
    .setName("sources")
    .setDescription("Set the default music source for this server."),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const { rightsort, dot, cross, tick } = client.emoji;

    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild))
      return message.reply(client.util.v2msg(color,
        `${cross} You need **Manage Server** permission to change the music source.`,
      ));

    const avatarUrl = client.user.displayAvatarURL({ size: 64 });
    const active    = Database.getSource(message.guild.id) || "ytmsearch";
    let   pending   = null;

    const msg = await message.reply(buildPayload(color, rightsort, dot, avatarUrl, active, null));

    const collector = msg.createMessageComponentCollector({
      filter: (i) => {
        if (i.user.id === message.author.id) return true;
        i.reply(client.util.v2eph(color, `${cross} Only **${message.author.username}** can use this menu.`));
        return false;
      },
      time: 270_000,
    });

    collector.on("collect", async (interaction) => {
      try {
        // ── Dropdown select — mark as pending, show confirm/cancel ──────────
        if (interaction.isStringSelectMenu() && interaction.customId === "sources:select") {
          pending = interaction.values[0];
          return interaction.update(buildPayload(color, rightsort, dot, avatarUrl, active, pending));
        }

        if (!interaction.isButton()) return;

        // ── Confirm ──────────────────────────────────────────────────────────
        if (interaction.customId === "sources:confirm") {
          if (!pending) return interaction.update(buildPayload(color, rightsort, dot, avatarUrl, active, null));
          Database.setSource(message.guild.id, pending);
          const newLabel = SOURCE_MAP[pending];
          collector.stop("confirmed");
          return interaction.update(
            new V2Builder(color)
              .section(
                `### __Music Sources__\n\n`
                + `${tick} Source updated to **${newLabel}**!\n\n`
                + `-# All \`play\` commands in this server will now use **${newLabel}**`,
                avatarUrl,
              )
              .build(),
          );
        }

        // ── Cancel ───────────────────────────────────────────────────────────
        if (interaction.customId === "sources:cancel") {
          pending = null;
          return interaction.update(buildPayload(color, rightsort, dot, avatarUrl, active, null));
        }
      } catch (err) {
        console.error("[sources collector]", err);
      }
    });

    collector.on("end", (_, reason) => {
      if (reason !== "confirmed") {
        msg.edit({ components: [] }).catch(() => {});
      }
    });
  },
};
