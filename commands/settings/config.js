const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");
const { V2Builder }    = require("../../utils/V2Builder");
const { BTN }          = require("../../utils/emojis");
const { enabled247 }   = require("../../utils/State");
const Database         = require("../../database/Database");
const config           = require("../../config");

const V2_FLAGS   = MessageFlags.IsComponentsV2;
const BANNER_URL = require("../../config").bannerUrl;
const SPACE      = "<:1spacer:1535691155730079765>";
const SUCCESS    = "<:Success:1535816191187230760>";
const CANCEL     = "<:A_Cancel:1535819420780470343>";
const WARN       = "<:Warn:1535921939506528316>";
const ON         = SUCCESS;
const OFF        = CANCEL;
const sep        = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function isBotOwner(userId) {
  return config.ownerIds?.includes(userId) || userId === config.mainOwnerId || Database.isOwner(userId);
}

const CATEGORIES = [
  { value: "overview",  label: "Overview",         description: "Full server config summary" },
  { value: "music",     label: "Music",             description: "Music enable/disable & source" },
  { value: "musicwl",   label: "Music Whitelist",   description: "Manage music whitelist when disabled" },
  { value: "247",       label: "24/7 Mode",         description: "Keep bot in voice 24/7" },
  { value: "prefix",    label: "Prefix",            description: "Command prefix settings" },
  { value: "djrole",    label: "DJ Role",           description: "DJ role for music commands" },
  { value: "announce",  label: "Announce Channel",  description: "Now Playing announce channel" },
];

function buildCategoryRow(active) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("cfg:category")
      .setPlaceholder("📂 Select a category...")
      .addOptions(CATEGORIES.map(c => ({ ...c, default: c.value === active }))),
  );
}

function buildConfirmRow(action, data) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cfg:confirm:${action}:${data}`)
      .setEmoji({ name: "zeecheisuccess", id: "1506685680737325076" })
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cfg:cancel")
      .setEmoji({ name: "zeecheicancel", id: "1506685701079564338" })
      .setStyle(ButtonStyle.Danger),
  );
}

function pageOverview(client, guild, color) {
  const s        = Database.getSettings(guild.id);
  const is247    = enabled247.has(guild.id);
  const musicOn  = Database.isMusicEnabled(guild.id);
  const source   = Database.getSource(guild.id) || "ytmsearch";
  const srcLabel = { ytmsearch: "YouTube Music", ytsearch: "YouTube", scsearch: "SoundCloud", spsearch: "Spotify", amsearch: "Apple Music", dzsearch: "Deezer" }[source] || source;
  const prefix   = s.prefix || "+";
  const wlCount  = Database.getMusicWL(guild.id).length;

  const djRole = s.dj_role
    ? (guild.roles.cache.get(s.dj_role)?.name || s.dj_role)
    : null;
  const annCh = s.announce_ch ? `<#${s.announce_ch}>` : null;

  const container = new ContainerBuilder();

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# <:Zeechei:1535687335490883644> **__Alexà Musíc__**`
      )
    )
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `<:info:1535694445511446549> Server Configuration\n`
        + `> \`${guild.name}\`\n`
        + `${SPACE}\n`
        + `-# prefix - \`${prefix}\``
      )
    )
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Music Configuration\n\n`
        + `${SPACE} > **Status -** ${musicOn ? SUCCESS + " Enabled" : CANCEL + " Disabled"}\n`
        + `${SPACE} > **Source -** \`${srcLabel}\`\n`
        + `${SPACE} > **WL Users -** \`${wlCount}\`\n\n`
        + `-# 24/7 Mode Configuration\n\n`
        + `${SPACE} > ${is247 ? SUCCESS + " Active" : CANCEL + " Inactive"}\n\n`
        + `-# NP Announce Channel Configuration\n\n`
        + `${SPACE} > ${annCh ?? CANCEL + " Not enabled"}\n\n`
        + `-# DJ Role configuration\n\n`
        + `${SPACE} > ${djRole ?? CANCEL + " Not set"}\n`
        + `${SPACE}\n`
        + `${SPACE}\n`
        + `-# Use the drop-down below to manage each setting`
      )
    )
    .addSeparatorComponents(sep())
    .addActionRowComponents(buildCategoryRow("overview"))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Developed by zeechei Devs✓`)
    );

  return { components: [container], flags: V2_FLAGS };
}

function pageMusic(client, guild, color) {
  const musicOn  = Database.isMusicEnabled(guild.id);
  const source   = Database.getSource(guild.id) || "ytmsearch";
  const srcLabel = { ytmsearch: "YouTube Music", ytsearch: "YouTube", scsearch: "SoundCloud", spsearch: "Spotify", amsearch: "Apple Music", dzsearch: "Deezer" }[source] || source;

  const statusText =
    `> **__ Current Status __** **-** ${musicOn ? SUCCESS + " Music is Enabled" : CANCEL + " Music is Disabled"}\n` +
    `> **__ Default Source__** **-** \`${srcLabel}\`\n\n` +
    `-# When disabled, only whitelisted users can play music.\n` +
    `-# Manage the whitelist via the Music Whitelist category.`;

  const toggleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg:music:toggle:ask")
      .setEmoji(musicOn
        ? { name: "zeecheicancel",  id: "1506685701079564338" }
        : { name: "zeecheisuccess", id: "1506685680737325076" })
      .setLabel(musicOn ? "Disable Music" : "Enable Music")
      .setStyle(musicOn ? ButtonStyle.Danger : ButtonStyle.Success),
  );

  return new V2Builder(color)
    .text(`# <:Zeechei:1535687335490883644> **__Musíc Settings__**`)
    .sep()
    .text(statusText)
    .sep()
    .text(`-# Press the button below to toggle enable/disable music.`)
    .row(toggleRow)
    .sep()
    .row(buildCategoryRow("music"))
    .build();
}

function pageMusicWL(client, guild, color, isOwnerUser) {
  const wl      = Database.getMusicWL(guild.id);
  const musicOn = Database.isMusicEnabled(guild.id);
  const userLines = wl.length
    ? wl.map(id => `> <@${id}>`).join("\n")
    : "";

  const statusText =
    `> **__ Current Music Status __** **-** ${musicOn ? SUCCESS + " Enabled" : CANCEL + " Disabled"}\n\n` +
    `-# Whitelisted users can play music even when music is disabled.\n` +
    `-# Only the Server Owner or Bot Owners can manage this list.\n\n` +
    `> __**Whitelisted Users**__ **-** \`${wl.length}\`\n` +
    (userLines ? userLines + "\n" : "") +
    `\n-# Example - \`+musicwl add @user\` to wl a user.`;

  const clearRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg:musicwl:clear:ask")
      .setLabel("Clear Whitelist")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!wl.length || !isOwnerUser),
  );

  return new V2Builder(color)
    .text(`# <:Zeechei:1535687335490883644> **__Musíc Whitelist__**`)
    .sep()
    .text(statusText)
    .sep()
    .text(`-# Press the button below to clear whitelisted users list.`)
    .row(clearRow)
    .sep()
    .row(buildCategoryRow("musicwl"))
    .build();
}

function page247(client, guild, color) {
  const is247  = enabled247.has(guild.id);
  const player = client.lavalink?.getPlayer(guild.id);
  const vc     = player?.voiceChannelId ? `<#${player.voiceChannelId}>` : "Not set";

  const statusText =
    `> **__ Current Status__** **-** ${is247 ? SUCCESS + " Active" : CANCEL + " Disabled"}\n` +
    `> **__Voice Channel__** **-** ${vc}\n\n` +
    `-# When enabled, the bot stays in voice even when the queue is empty.\n` +
    `-# Persists after bot restarts.`;

  const canToggle = is247 || !!player;
  const toggleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg:247:toggle:ask")
      .setLabel(is247 ? "Disable 24/7" : "Enable 24/7")
      .setStyle(is247 ? ButtonStyle.Danger : ButtonStyle.Success)
      .setDisabled(!canToggle),
  );

  return new V2Builder(color)
    .text(`# **__ 24/7 Mode__**`)
    .sep()
    .text(statusText)
    .sep()
    .text(`-# Press the button below to toggle 24/7 mode.`)
    .row(toggleRow)
    .sep()
    .row(buildCategoryRow("247"))
    .build();
}

function pagePrefix(client, guild, color) {
  const s      = Database.getSettings(guild.id);
  const prefix = s.prefix || "+";

  const statusText =
    `> **__Current Prefix__** **-** \`${prefix}\`\n\n` +
    `-# To change the prefix use - \`${prefix}setprefix <newprefix>\`\n` +
    `-# Slash commands always work regardless of prefix`;

  return new V2Builder(color)
    .text(`# **__ Prefix Settings__**`)
    .sep()
    .text(statusText)
    .sep()
    .row(buildCategoryRow("prefix"))
    .build();
}

function pageDJRole(client, guild, color) {
  const s      = Database.getSettings(guild.id);
  const djRole = s.dj_role ? `<@&${s.dj_role}>` : "Not set";

  const statusText =
    `> **__Current DJ Role__** **-** ${djRole}\n\n` +
    `-# The DJ role grants members access to music commands.\n` +
    `-# To change it use - \`+djrole @role\``;

  const clearRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg:djrole:clear:ask")
      .setLabel(s.dj_role ? "Clear DJ Role" : "Already Cleared")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!s.dj_role),
  );

  return new V2Builder(color)
    .text(`# **__DJ Role__**`)
    .sep()
    .text(statusText)
    .sep()
    .text(`-# Press the below button to clear of the DJ role.`)
    .row(clearRow)
    .sep()
    .row(buildCategoryRow("djrole"))
    .build();
}

function pageAnnounce(client, guild, color) {
  const s     = Database.getSettings(guild.id);
  const annCh = s.announce_ch ? `<#${s.announce_ch}>` : "Not set";

  const statusText =
    `> **__Current Channel__** **-** ${annCh}\n\n` +
    `-# The annouce channel is where NowPlaying embeds are sent automatically whenever a new track starts.\n` +
    `${SPACE}\n` +
    `-# Select a channel from the drop-down below, or use \`+annouce #channel\``;

  const selectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("cfg:announce:select")
      .setPlaceholder("Select a channel...")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const clearRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg:announce:clear:ask")
      .setLabel(s.announce_ch ? "Clear Announce Channel" : "Already Cleared")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!s.announce_ch),
  );

  return new V2Builder(color)
    .text(`# **__Annouce Channel__**`)
    .sep()
    .text(statusText)
    .row(selectRow)
    .sep()
    .text(`-# Press the button for clearing the annouce channel.`)
    .row(clearRow)
    .sep()
    .row(buildCategoryRow("announce"))
    .build();
}

function pageConfirm(color, action, avatarUrl) {
  const descriptions = {
    "music:enable":    { desc: "**Are you sure you want to enable music in this server?**", sub: "-# For all non-WL users music commands will start working in this server." },
    "music:disable":   { desc: "**Are you sure you want to disable music in this server?**", sub: "-# For all non-WL users music commands will stop working in this server." },
    "247:enable":      { desc: "**Are you sure you want to enable 24/7 mode?**", sub: "-# Bot will stay in voice even when the queue is empty." },
    "247:disable":     { desc: "**Are you sure you want to disable 24/7 mode?**", sub: "-# Bot will leave when the queue is empty." },
    "djrole:clear":    { desc: "**Are you sure you want to clear the DJ role?**", sub: "-# All members will lose the DJ role restriction." },
    "announce:clear":  { desc: "**Are you sure you want to clear the announce channel?**", sub: "-# Now Playing embeds will not be sent automatically." },
    "musicwl:clear":   { desc: "**Are you sure you want to clear the entire music whitelist?**", sub: "-# All whitelisted users will lose access when music is disabled." },
  };
  const info = descriptions[action] || { desc: "**Are you sure?**", sub: "" };

  return new V2Builder(color)
    .text(`# **__ Confirm Action??__**`)
    .sep()
    .text(`${info.desc}\n\n${info.sub}`)
    .sep()
    .row(buildConfirmRow(action.split(":")[0], action.split(":")[1]))
    .build();
}

module.exports = {
  name: "config",
  aliases: ["settings", "cfg", "setup"],
  description: "Configure bot settings for this server.",
  category: "settings",
  usage: "+config",
  argsRequired: false,
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure bot settings for this server."),
  getSlashArgs: () => [],

  async execute({ client, message }) {
    const guild  = message.guild;
    const color  = client.getColor(guild.id);
    const { cross } = client.emoji;

    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply(client.util.v2msg(color,
        `${cross} You need **Manage Server** permission to use this command.`,
      ));
    }

    const avatarUrl   = client.user.displayAvatarURL({ size: 64 });
    const isOwnerUser = isBotOwner(message.author.id) || message.author.id === guild.ownerId;
    let   activePage  = "overview";

    const msg = await message.reply(pageOverview(client, guild, color));

    const collector = msg.createMessageComponentCollector({
      filter: (i) => {
        if (i.user.id === message.author.id) return true;
        i.reply({ flags: MessageFlags.Ephemeral, content: `Only **${message.author.username}** can use this config panel.` });
        return false;
      },
      time: 270_000,
    });

    collector.on("collect", async (interaction) => {
      try {
        // ── Category dropdown ────────────────────────────────────────────────
        if (interaction.isStringSelectMenu() && interaction.customId === "cfg:category") {
          activePage = interaction.values[0];
          return interaction.update(buildPage(activePage, client, guild, color, isOwnerUser));
        }

        // ── Announce channel select ──────────────────────────────────────────
        if (interaction.isChannelSelectMenu() && interaction.customId === "cfg:announce:select") {
          const channelId = interaction.values[0];
          Database.setAnnounceChannel(guild.id, channelId);
          return interaction.update(pageAnnounce(client, guild, color));
        }

        if (!interaction.isButton()) return;
        const [, ns, action, sub] = interaction.customId.split(":");

        if (sub === "ask") {
          let confirmKey;
          if (ns === "music" && action === "toggle") {
            confirmKey = `music:${Database.isMusicEnabled(guild.id) ? "disable" : "enable"}`;
          } else if (ns === "247" && action === "toggle") {
            confirmKey = `247:${enabled247.has(guild.id) ? "disable" : "enable"}`;
          } else {
            confirmKey = `${ns}:${action}`;
          }
          return interaction.update(pageConfirm(color, confirmKey, avatarUrl));
        }

        if (ns === "cancel") {
          return interaction.update(buildPage(activePage, client, guild, color, isOwnerUser));
        }

        if (ns === "confirm") {
          const category = action;
          const mode     = sub;

          if (category === "music") {
            Database.setMusicEnabled(guild.id, mode === "enable");
          }

          if (category === "247") {
            if (mode === "enable") {
              const player = client.lavalink?.getPlayer(guild.id);
              if (!player) {
                return interaction.update(
                  new V2Builder(color)
                    .text(`# ${cross} __24/7 Mode__`)
                    .sep()
                    .text(`> No active player — start playing music first!`)
                    .sep()
                    .row(buildCategoryRow("247"))
                    .build(),
                );
              }
              enabled247.add(guild.id);
              Database.set247(guild.id, true, player.voiceChannelId, player.textChannelId);
            } else {
              enabled247.delete(guild.id);
              Database.set247(guild.id, false);
            }
          }

          if (category === "djrole" && mode === "clear") {
            Database.setDjRole(guild.id, null);
          }

          if (category === "announce" && mode === "clear") {
            Database.setAnnounceChannel(guild.id, null);
          }

          if (category === "musicwl" && mode === "clear") {
            Database.clearMusicWL(guild.id);
          }

          return interaction.update(buildPage(activePage, client, guild, color, isOwnerUser));
        }
      } catch (err) {
        console.error("[config collector]", err);
      }
    });

    collector.on("end", (_, reason) => {
      if (reason === "time") {
        msg.edit(
          new V2Builder(color)
            .text(`# <:Warn:1535921939506528316> **__Config Panel__**`)
            .sep()
            .text(`> This session has been timed out.\n> Use \`+config\` for new one.`)
            .build(),
        ).catch(() => {});
      }
    });
  },
};

function buildPage(page, client, guild, color, isOwnerUser) {
  switch (page) {
    case "music":   return pageMusic(client, guild, color);
    case "musicwl": return pageMusicWL(client, guild, color, isOwnerUser);
    case "247":     return page247(client, guild, color);
    case "prefix":  return pagePrefix(client, guild, color);
    case "djrole":  return pageDJRole(client, guild, color);
    case "announce": return pageAnnounce(client, guild, color);
    default:        return pageOverview(client, guild, color);
  }
}
