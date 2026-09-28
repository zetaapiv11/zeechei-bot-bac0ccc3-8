// ============================================================
// ZEECHEI HELP SYSTEM — FULL REPLACEABLE VERSION
// File: commands/general/help.js
// ============================================================
// © Zeechei Development
//
// IMPORTANT:
// • All emojis are kept HERE at the top.
// • Currently normal Unicode emojis are used.
// • You can replace ONLY the values inside EMOJI later.
// • Commands/categories are loaded automatically from client.commands.
// • Total Commands + Total Servers are shown on the Home page.
// • Does NOT depend on utils/emojis.js.
// • Uses unique component IDs to avoid conflict with old HelpBuilder.
// ============================================================

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const config = require("../../config");
const Database = require("../../database/Database");

// ============================================================
// EMOJIS
// ============================================================
// Replace these later with your custom emojis.
// Example:
// music: "<:ZeecheiMusic:123456789012345678>"
// ============================================================

const EMOJI = Object.freeze({

  // Main
  home: "<:HOME:1550824288917913722>",
  zeechei: "<a:bots:1550791562928070696>",
  commands: "<:commands:1551972802339283106>",
  server: "<:servers:1550821293899915267>",
  category: "<:category:1551972805229285501>",
  command: "➜",
  info: "<:info2:1550792669008240681>",
  success: "<:check:1550872076104245271>",
  error: "<:cross:1550532309894045846>",
  warning: "<:warning:1550824858516979884>",

  // Navigation
  previous: "<:prev_page:1550824401635905578>",
  next: "<:next_page:1550824395738578955>",
  close: "<:close:1551973076730642552>",
  back: "<:y_back:1551973379190558791>",
  select: "<:select:1551973073425539167>",

  // Categories
  music: "<:901_flower:1550922516862603329>",
  playlist: "<:901_flower:1550922516862603329>",
  general: "<:901_flower:1550922516862603329>",
  information: "<:901_flower:1550922516862603329>",
  moderation: "<:901_flower:1550922516862603329>",
  security: "<:901_flower:1550922516862603329>",
  automod: "<:901_flower:1550922516862603329>",
  settings: "<:901_flower:1550922516862603329>",
  customize: "<:901_flower:1550922516862603329>",
  fun: "<:901_flower:1550922516862603329>",
  filter: "<:901_flower:1550922516862603329>",
  voice: "<:901_flower:1550922516862603329>",
  voicemaster: "<:901_flower:1550922516862603329>",
  owner: "<:901_flower:1550922516862603329>",
  developer: "<:901_flower:1550922516862603329>",
  premium: "<:901_flower:1550922516862603329>",
  giveaway: "<:901_flower:1550922516862603329>",
  ticket: "<:901_flower:1550922516862603329>",
  logging: "<:901_flower:1550922516862603329>",
  utility: "<:901_flower:1550922516862603329>",
  playlistCategory: "<:901_flower:1550922516862603329>",
  defaultCategory: "<:901_flower:1550922516862603329>",

});

// ============================================================
// SETTINGS
// ============================================================

const COMMANDS_PER_PAGE = 15;
const HELP_TIMEOUT = 300000;

// Unique prefix so old HelpBuilder/helpInteractions
// cannot accidentally handle this menu.
const COMPONENT_PREFIX = "zeecheiui";

// ============================================================
// CATEGORY ORDER
// ============================================================

const CATEGORY_ORDER = [
  "Music",
  "Playlist",
  "General",
  "Information",
  "Moderation",
  "Security",
  "Automod",
  "Settings",
  "Customize",
  "Fun",
  "Filter",
  "Voice",
  "VoiceMaster",
  "Utility",
  "Premium",
  "Giveaway",
  "Ticket",
  "Logging",
  "Owner / Developer",
];

// ============================================================
// CATEGORY EMOJIS
// ============================================================

const CATEGORY_EMOJI = {
  Music: EMOJI.music,
  Playlist: EMOJI.playlistCategory,
  General: EMOJI.general,
  Information: EMOJI.information,
  Moderation: EMOJI.moderation,
  Security: EMOJI.security,
  Automod: EMOJI.automod,
  Settings: EMOJI.settings,
  Customize: EMOJI.customize,
  Fun: EMOJI.fun,
  Filter: EMOJI.filter,
  Voice: EMOJI.voice,
  VoiceMaster: EMOJI.voicemaster,
  Utility: EMOJI.utility,
  Premium: EMOJI.premium,
  Giveaway: EMOJI.giveaway,
  Ticket: EMOJI.ticket,
  Logging: EMOJI.logging,
  "Owner / Developer": EMOJI.owner,
};

// ============================================================
// GET PREFIX
// ============================================================

function getPrefix(message) {
  try {
    if (message?.guild?.id && typeof Database.getPrefix === "function") {
      const databasePrefix = Database.getPrefix(message.guild.id);

      if (
        typeof databasePrefix === "string" &&
        databasePrefix.length > 0
      ) {
        return databasePrefix;
      }
    }
  } catch (_) {}

  if (
    typeof config.prefix === "string" &&
    config.prefix.length > 0
  ) {
    return config.prefix;
  }

  return ",";
}

// ============================================================
// GET COLOR
// ============================================================

function getColor(client, guildId) {
  try {
    if (typeof client?.getColor === "function") {
      const value = client.getColor(guildId);

      if (typeof value === "number") {
        return value;
      }

      if (typeof value === "string") {
        const parsed = parseInt(
          value.replace("#", ""),
          16
        );

        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  } catch (_) {}

  if (typeof config.embedColor === "number") {
    return config.embedColor;
  }

  return 0x2f3136;
}

// ============================================================
// OWNER CHECK
// ============================================================

function isOwner(userId) {
  try {
    if (
      userId === config.mainOwnerId ||
      userId === config.ownerId
    ) {
      return true;
    }

    if (
      Array.isArray(config.ownerIds) &&
      config.ownerIds.includes(userId)
    ) {
      return true;
    }

    if (
      typeof Database.isOwner === "function" &&
      Database.isOwner(userId)
    ) {
      return true;
    }
  } catch (_) {}

  return false;
}

// ============================================================
// DEVELOPER CHECK
// ============================================================

function isDeveloper(command, userId) {
  if (!command) {
    return false;
  }

  if (
    command.developerOnly === true ||
    command.devOnly === true ||
    command.developer === true
  ) {
    return true;
  }

  const category = String(
    command.category || ""
  )
    .toLowerCase()
    .trim();

  if (
    category === "developer" ||
    category === "developers" ||
    category === "dev" ||
    category === "devs"
  ) {
    return true;
  }

  return false;
}

// ============================================================
// OWNER / DEVELOPER COMMAND CHECK
// ============================================================

function isOwnerCommand(command) {
  if (!command) {
    return false;
  }

  const category = String(
    command.category || ""
  )
    .toLowerCase()
    .trim();

  return Boolean(
    command.ownerOnly === true ||
    command.owner === true ||
    command.developerOnly === true ||
    command.devOnly === true ||
    command.hiddenOwner === true ||
    [
      "owner",
      "owners",
      "developer",
      "developers",
      "dev",
      "devs",
      "owner/developer",
      "owner / developer",
    ].includes(category)
  );
}

// ============================================================
// HIDDEN COMMAND CHECK
// ============================================================

function isHidden(command) {
  if (!command) {
    return true;
  }

  return Boolean(
    command.hidden === true ||
    command.hide === true ||
    command.hideFromHelp === true ||
    command.disabled === true
  );
}

// ============================================================
// COMMAND NAME
// ============================================================

function getCommandName(command) {
  return String(
    command?.name ||
    command?.data?.name ||
    "unknown"
  )
    .trim()
    .toLowerCase();
}

// ============================================================
// COMMAND DESCRIPTION
// ============================================================

function getCommandDescription(command) {
  const description =
    command?.description ||
    command?.data?.description ||
    "No description provided.";

  return String(description)
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// NORMALIZE CATEGORY
// ============================================================

function normalizeCategory(category) {
  if (!category) {
    return "General";
  }

  const value = String(category)
    .trim()
    .toLowerCase();

  const aliases = {
    music: "Music",
    playlist: "Playlist",
    general: "General",
    information: "Information",
    info: "Information",
    moderation: "Moderation",
    mod: "Moderation",
    security: "Security",
    antinuke: "Security",
    automod: "Automod",
    "auto mod": "Automod",
    settings: "Settings",
    setting: "Settings",
    customize: "Customize",
    customization: "Customize",
    fun: "Fun",
    filter: "Filter",
    filters: "Filter",
    voice: "Voice",
    voicemaster: "VoiceMaster",
    "voice master": "VoiceMaster",
    utility: "Utility",
    utilities: "Utility",
    premium: "Premium",
    giveaway: "Giveaway",
    giveaways: "Giveaway",
    ticket: "Ticket",
    tickets: "Ticket",
    logging: "Logging",
    logs: "Logging",
    owner: "Owner / Developer",
    owners: "Owner / Developer",
    developer: "Owner / Developer",
    developers: "Owner / Developer",
    dev: "Owner / Developer",
    devs: "Owner / Developer",
  };

  return (
    aliases[value] ||
    String(category)
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

// ============================================================
// GET COMMANDS
// ============================================================

function getCommandsForUser(client, userId) {
  const commands = [];

  if (!client?.commands) {
    return commands;
  }

  const privileged =
    isOwner(userId);

  for (const command of client.commands.values()) {

    if (!command) {
      continue;
    }

    if (isHidden(command)) {
      continue;
    }

    if (
      isOwnerCommand(command) &&
      !privileged
    ) {
      continue;
    }

    commands.push(command);
  }

  // Remove duplicate command names
  const unique = new Map();

  for (const command of commands) {
    const name = getCommandName(command);

    if (!unique.has(name)) {
      unique.set(name, command);
    }
  }

  return [...unique.values()];
}

// ============================================================
// BUILD CATEGORY MAP
// ============================================================

function buildCategoryMap(client, userId) {
  const commands =
    getCommandsForUser(
      client,
      userId
    );

  const map = new Map();

  for (const command of commands) {

    let category;

    if (isOwnerCommand(command)) {
      category = "Owner / Developer";
    } else {
      category = normalizeCategory(
        command.category
      );
    }

    if (!map.has(category)) {
      map.set(category, []);
    }

    map.get(category).push(command);
  }

  // Sort commands alphabetically
  for (const list of map.values()) {
    list.sort((a, b) =>
      getCommandName(a).localeCompare(
        getCommandName(b)
      )
    );
  }

  // Sort categories using Zeechei's preferred order
  const categories =
    [...map.keys()].sort((a, b) => {

      const ai =
        CATEGORY_ORDER.indexOf(a);

      const bi =
        CATEGORY_ORDER.indexOf(b);

      if (
        ai === -1 &&
        bi === -1
      ) {
        return a.localeCompare(b);
      }

      if (ai === -1) {
        return 1;
      }

      if (bi === -1) {
        return -1;
      }

      return ai - bi;
    });

  return {
    map,
    categories,
    commands,
  };
}

// ============================================================
// CATEGORY EMOJI
// ============================================================

function getCategoryEmoji(category) {
  return (
    CATEGORY_EMOJI[category] ||
    EMOJI.defaultCategory
  );
}

// ============================================================
// TRUNCATE
// ============================================================

function truncate(text, max = 90) {
  const value =
    String(text || "")
      .replace(/\s+/g, " ")
      .trim();

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(
    0,
    max - 3
  )}...`;
}

// ============================================================
// COMMAND LINE
// ============================================================

function commandLine(command, prefix) {
  const name =
    getCommandName(command);

  const description =
    truncate(
      getCommandDescription(command),
      82
    );

  return `${EMOJI.command} \`${prefix}${name}\` — ${description}`;
}

// ============================================================
// CATEGORY SELECT MENU
// ============================================================

function buildCategorySelect(
  authorId,
  categories,
  currentCategory = null,
  disabled = false
) {

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `${COMPONENT_PREFIX}:category:${authorId}`
      )
      .setPlaceholder(
        `${EMOJI.select} Select a category...`
      )
      .setDisabled(disabled);

  const options = [];

  // Home option
  options.push({
    label: "Home",
    description:
      "Return to Zeechei Help home",
    value: "__home",
    emoji: EMOJI.home,
    default:
      currentCategory === "__home",
  });

  // Discord allows max 25 select options.
  // Home uses 1, so max 24 categories.
  for (
    const category of categories.slice(0, 24)
  ) {

    options.push({
      label: category.slice(0, 100),
      description:
        `${category} commands`.slice(
          0,
          100
        ),
      value: category,
      emoji:
        getCategoryEmoji(category),
      default:
        currentCategory === category,
    });
  }

  menu.addOptions(options);

  return new ActionRowBuilder()
    .addComponents(menu);
}

// ============================================================
// NAVIGATION BUTTONS
// ============================================================

function buildNavigation(
  authorId,
  page,
  totalPages,
  category,
  disabled = false
) {

  const home =
    new ButtonBuilder()
      .setCustomId(
        `${COMPONENT_PREFIX}:home:${authorId}`
      )
      .setLabel("Home")
      .setEmoji(EMOJI.home)
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        disabled ||
        category === "__home"
      );

  const previous =
    new ButtonBuilder()
      .setCustomId(
        `${COMPONENT_PREFIX}:previous:${authorId}`
      )
      .setLabel("Previous")
      .setEmoji(EMOJI.previous)
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        disabled ||
        page <= 0
      );

  const next =
    new ButtonBuilder()
      .setCustomId(
        `${COMPONENT_PREFIX}:next:${authorId}`
      )
      .setLabel("Next")
      .setEmoji(EMOJI.next)
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        disabled ||
        page >= totalPages - 1
      );

  const close =
    new ButtonBuilder()
      .setCustomId(
        `${COMPONENT_PREFIX}:close:${authorId}`
      )
      .setLabel("Close")
      .setEmoji(EMOJI.close)
      .setStyle(
        ButtonStyle.Danger
      )
      .setDisabled(disabled);

  return new ActionRowBuilder()
    .addComponents(
      home,
      previous,
      next,
      close
    );
}

// ============================================================
// HOME EMBED
// ============================================================

function buildHomeEmbed(
  client,
  message,
  catalog
) {

  const color =
    getColor(
      client,
      message.guild?.id
    );

  const prefix =
    getPrefix(message);

  // EXACT Zeechei totals
  const totalCommands =
    client?.commands?.size || 0;

  const totalServers =
    client?.guilds?.cache?.size || 0;

  const visibleCommands =
    catalog.commands.length;

  const categoryLines =
    catalog.categories
      .map((category) => {

        const count =
          catalog.map.get(category)?.length || 0;

        return `> ${getCategoryEmoji(category)} **${category}** — \`${count}\` commands`;
      })
      .join("\n");

  const embed =
    new EmbedBuilder()
      .setColor(color)
      .setTitle(
        `${EMOJI.zeechei} Zeechei Help Menu`
      )
      .setDescription([
        `### ${EMOJI.zeechei} Hello, I'm Zeechei`,
        "",
        `${EMOJI.commands} **Total Commands:** \`${totalCommands}\``,
        `${EMOJI.server} **Total Servers:** \`${totalServers}\``,
        `${EMOJI.category} **Categories:** \`${catalog.categories.length}\``,
        "",
        `${EMOJI.commands} **Command Categories**`,
        categoryLines ||
          `> ${EMOJI.warning} No commands are currently available.`,
        "",
        `${EMOJI.info} **Prefix:** \`${prefix}\``,
        "",
        "-# Select a category below to explore Zeechei's commands.",
      ].join("\n"))
      .setThumbnail(
        client.user.displayAvatarURL({
          size: 256,
          extension: "png",
        })
      )
      .setFooter({
        text:
          "Zeechei • Premium Discord Music & Utility Bot",
      })
      .setTimestamp();

  return embed;
}

// ============================================================
// CATEGORY EMBED
// ============================================================

function buildCategoryEmbed(
  client,
  message,
  category,
  commands,
  page
) {

  const color =
    getColor(
      client,
      message.guild?.id
    );

  const prefix =
    getPrefix(message);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        commands.length /
        COMMANDS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      Math.max(page, 0),
      totalPages - 1
    );

  const start =
    safePage *
    COMMANDS_PER_PAGE;

  const pageCommands =
    commands.slice(
      start,
      start + COMMANDS_PER_PAGE
    );

  const commandList =
    pageCommands.length
      ? pageCommands
          .map((command) =>
            commandLine(
              command,
              prefix
            )
          )
          .join("\n")
      : `> ${EMOJI.warning} No commands found in this category.`;

  const embed =
    new EmbedBuilder()
      .setColor(color)
      .setTitle(
        `${getCategoryEmoji(category)} ${category} Commands`
      )
      .setDescription([
        `### ${EMOJI.commands} Zeechei ${category} Module`,
        "",
        commandList,
        "",
        `${EMOJI.info} **Commands:** \`${commands.length}\``,
        `${EMOJI.info} **Page:** \`${safePage + 1}/${totalPages}\``,
        "",
        `-# Use \`${prefix}help\` to return to the main Help Menu.`,
      ].join("\n"))
      .setThumbnail(
        client.user.displayAvatarURL({
          size: 256,
          extension: "png",
        })
      )
      .setFooter({
        text:
          "Zeechei • Select another category below",
      });

  return embed;
}

// ============================================================
// BUILD MESSAGE
// ============================================================

function buildPayload(
  client,
  message,
  state,
  disabled = false
) {

  const components = [];

  components.push(
    buildCategorySelect(
      state.authorId,
      state.catalog.categories,
      state.category,
      disabled
    )
  );

  if (
    state.category === "__home"
  ) {

    components.push(
      buildNavigation(
        state.authorId,
        0,
        1,
        "__home",
        disabled
      )
    );

  } else {

    const commands =
      state.catalog.map.get(
        state.category
      ) || [];

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          commands.length /
          COMMANDS_PER_PAGE
        )
      );

    components.push(
      buildNavigation(
        state.authorId,
        state.page,
        totalPages,
        state.category,
        disabled
      )
    );
  }

  const embed =
    state.category === "__home"
      ? buildHomeEmbed(
          client,
          message,
          state.catalog
        )
      : buildCategoryEmbed(
          client,
          message,
          state.category,
          state.catalog.map.get(
            state.category
          ) || [],
          state.page
        );

  return {
    content: "",
    embeds: [embed],
    components,
    allowedMentions: {
      parse: [],
    },
  };
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {

  name: "help",

  aliases: [
    "h",
    "commands",
    "cmds",
  ],

  description:
    "Open Zeechei's interactive command help menu.",

  category:
    "General",

  usage:
    "help",

  argsRequired:
    false,

  // ==========================================================
  // EXECUTE
  // ==========================================================

  async execute({
    client,
    message,
  }) {

    if (
      !client ||
      !message ||
      !message.author ||
      !message.guild
    ) {
      return;
    }

    const authorId =
      message.author.id;

    const catalog =
      buildCategoryMap(
        client,
        authorId
      );

    const state = {
      authorId,
      category: "__home",
      page: 0,
      catalog,
    };

    const payload =
      buildPayload(
        client,
        message,
        state
      );

    let helpMessage;

    // ========================================================
    // SEND HELP
    // ========================================================

    try {

      helpMessage =
        await message.reply(
          payload
        );

    } catch (error) {

      console.error(
        "[Zeechei Help] Reply failed:",
        error
      );

      try {

        helpMessage =
          await message.channel.send(
            payload
          );

      } catch (fallbackError) {

        console.error(
          "[Zeechei Help] Fallback send failed:",
          fallbackError
        );

        return;
      }
    }

    // ========================================================
    // COLLECTOR
    // ========================================================

    const collector =
      helpMessage.createMessageComponentCollector({
        time:
          HELP_TIMEOUT,

        filter:
          (interaction) => {

            // Only original user
            if (
              interaction.user.id !==
              authorId
            ) {
              return true;
            }

            return true;
          },
      });

    // ========================================================
    // COLLECT
    // ========================================================

    collector.on(
      "collect",
      async (interaction) => {

        try {

          // --------------------------------------------------
          // SECURITY CHECK
          // --------------------------------------------------

          if (
            interaction.user.id !==
            authorId
          ) {

            if (
              !interaction.replied &&
              !interaction.deferred
            ) {

              await interaction.reply({
                content:
                  `${EMOJI.warning} Only the user who opened this Help Menu can use it.`,
                ephemeral: true,
              }).catch(() => {});
            }

            return;
          }

          const customId =
            interaction.customId ||
            "";

          if (
            !customId.startsWith(
              `${COMPONENT_PREFIX}:`
            )
          ) {
            return;
          }

          const parts =
            customId.split(":");

          const action =
            parts[1];

          // --------------------------------------------------
          // CATEGORY SELECT
          // --------------------------------------------------

          if (
            interaction.isStringSelectMenu() &&
            action === "category"
          ) {

            const selected =
              interaction.values?.[0];

            if (
              selected === "__home"
            ) {

              state.category =
                "__home";

              state.page = 0;

            } else if (
              state.catalog.map.has(
                selected
              )
            ) {

              state.category =
                selected;

              state.page = 0;

            } else {

              await interaction.reply({
                content:
                  `${EMOJI.error} This category is no longer available.`,
                ephemeral: true,
              }).catch(() => {});

              return;
            }

            await interaction.deferUpdate();

            await helpMessage.edit(
              buildPayload(
                client,
                message,
                state
              )
            );

            return;
          }

          // --------------------------------------------------
          // BUTTONS
          // --------------------------------------------------

          if (
            !interaction.isButton()
          ) {
            return;
          }

          // --------------------------------------------------
          // HOME
          // --------------------------------------------------

          if (
            action === "home"
          ) {

            state.category =
              "__home";

            state.page = 0;

            await interaction.deferUpdate();

            await helpMessage.edit(
              buildPayload(
                client,
                message,
                state
              )
            );

            return;
          }

          // --------------------------------------------------
          // PREVIOUS
          // --------------------------------------------------

          if (
            action === "previous"
          ) {

            if (
              state.category ===
              "__home"
            ) {
              return;
            }

            const commands =
              state.catalog.map.get(
                state.category
              ) || [];

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  commands.length /
                  COMMANDS_PER_PAGE
                )
              );

            state.page =
              Math.max(
                0,
                state.page - 1
              );

            state.page =
              Math.min(
                state.page,
                totalPages - 1
              );

            await interaction.deferUpdate();

            await helpMessage.edit(
              buildPayload(
                client,
                message,
                state
              )
            );

            return;
          }

          // --------------------------------------------------
          // NEXT
          // --------------------------------------------------

          if (
            action === "next"
          ) {

            if (
              state.category ===
              "__home"
            ) {
              return;
            }

            const commands =
              state.catalog.map.get(
                state.category
              ) || [];

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  commands.length /
                  COMMANDS_PER_PAGE
                )
              );

            state.page =
              Math.min(
                totalPages - 1,
                state.page + 1
              );

            await interaction.deferUpdate();

            await helpMessage.edit(
              buildPayload(
                client,
                message,
                state
              )
            );

            return;
          }

          // --------------------------------------------------
          // CLOSE
          // --------------------------------------------------

          if (
            action === "close"
          ) {

            collector.stop(
              "closed"
            );

            await interaction.deferUpdate();

            await helpMessage.edit({
              content:
                `${EMOJI.success} **Zeechei Help Menu closed.** Use \`${getPrefix(message)}help\` to open it again.`,
              embeds: [],
              components: [],
            });

            return;
          }

        } catch (error) {

          console.error(
            "[Zeechei Help] Component error:",
            error
          );

          try {

            if (
              !interaction.replied &&
              !interaction.deferred
            ) {

              await interaction.reply({
                content:
                  `${EMOJI.error} Something went wrong while updating the Help Menu.`,
                ephemeral: true,
              });

            }

          } catch (_) {}
        }
      }
    );

    // ========================================================
    // COLLECTOR END
    // ========================================================

    collector.on(
      "end",
      async (_, reason) => {

        if (
          reason === "closed"
        ) {
          return;
        }

        try {

          await helpMessage.edit(
            buildPayload(
              client,
              message,
              state,
              true
            )
          );

        } catch (_) {}
      }
    );
  },
};