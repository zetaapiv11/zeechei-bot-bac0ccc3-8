const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");

const Database = require("../../database/Database");
const { V2Builder } = require("../../utils/V2Builder");

const ITEMS_PER_PAGE = 10;

const LEADERBOARDS = {
  global: {
    label: "Global Commands",
    short: "Global",
    description: "Most commands used across Zeechei",
  },

  server: {
    label: "Server Commands",
    short: "Server",
    description: "Most commands used in this server",
  },

  daily: {
    label: "Daily Commands",
    short: "Daily",
    description: "Today's command leaderboard",
  },

  messages: {
    label: "Messages",
    short: "Messages",
    description: "Users with the most messages",
  },

  commands: {
    label: "Commands",
    short: "Commands",
    description: "Users with the most commands",
  },

  afk: {
    label: "AFK",
    short: "AFK",
    description: "Most AFK interactions",
  },

  songs: {
    label: "Songs Played",
    short: "Songs",
    description: "Users with the most songs played",
  },

  badges: {
    label: "Badges",
    short: "Badges",
    description: "Users with the most badges",
  },

  liked: {
    label: "Liked Songs",
    short: "Liked",
    description: "Users with the most liked songs",
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timestamp) {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text, max) {
  text = String(text || "");

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(
    radius,
    width / 2,
    height / 2
  );

  ctx.beginPath();

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r
  );

  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height
  );

  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r
  );

  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}

function fillRoundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {
  roundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
  );

  ctx.fill();
}

function strokeRoundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {
  roundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
  );

  ctx.stroke();
}

function getInitials(name) {
  const clean = String(name || "User")
    .trim()
    .replace(/\s+/g, " ");

  if (!clean) {
    return "U";
  }

  const parts = clean.split(" ");

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

async function fetchImage(url) {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    return await loadImage(buffer);
  } catch {
    return null;
  }
}

async function getUserInfo(client, userId) {
  try {
    const user = await client.users.fetch(userId);

    return {
      id: user.id,
      name:
        user.globalName ||
        user.username ||
        `User ${user.id.slice(-4)}`,
      username: user.username || "",
      avatar:
        user.displayAvatarURL({
          extension: "png",
          size: 128,
        }) || null,
    };
  } catch {
    return {
      id: userId,
      name: `User ${userId.slice(-6)}`,
      username: "",
      avatar: null,
    };
  }
}

async function getLeaderboardData(
  client,
  type,
  guildId
) {
  let entries = [];

  switch (type) {
    case "global":
      entries = Database.getGlobalLeaderboard(
        1000000
      );
      break;

    case "server":
      if (!guildId) {
        return [];
      }

      entries = Database.getGuildLeaderboard(
        guildId,
        1000000
      );
      break;

    case "daily":
      entries = Database.getDailyLeaderboard(
        1000000
      );
      break;

    case "messages":
      entries = Database.getTopMessages(
        1000000
      );
      break;

    case "commands":
      entries = Database.getTopCommands(
        1000000
      );
      break;

    case "afk":
      entries = Database.getAfkLeaderboard(
        1000000
      );
      break;

    case "songs":
      entries = Database.getSongsLeaderboard(
        1000000
      );
      break;

    case "badges":
      entries = Database.getBadgeLeaderboard(
        1000000
      );
      break;

    case "liked":
      entries = Database.getLikedLeaderboard(
        1000000
      );
      break;

    default:
      entries = Database.getGlobalLeaderboard(
        1000000
      );
      break;
  }

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry, index) => {
    let count = 0;

    if (typeof entry.count === "number") {
      count = entry.count;
    } else if (
      typeof entry.messages === "number"
    ) {
      count = entry.messages;
    } else if (
      typeof entry.commands === "number"
    ) {
      count = entry.commands;
    }

    return {
      userId: entry.userId,
      count,
      rank: index + 1,
    };
  });
}

function getLeaderboardValueLabel(type) {
  switch (type) {
    case "messages":
      return "MESSAGES";

    case "songs":
      return "SONGS";

    case "badges":
      return "BADGES";

    case "liked":
      return "LIKED";

    case "afk":
      return "AFK";

    default:
      return "COMMANDS";
  }
}

function getRankStyle(rank) {
  if (rank === 1) {
    return {
      number: "01",
      label: "CHAMPION",
    };
  }

  if (rank === 2) {
    return {
      number: "02",
      label: "RUNNER UP",
    };
  }

  if (rank === 3) {
    return {
      number: "03",
      label: "TOP 3",
    };
  }

  return {
    number: String(rank).padStart(2, "0"),
    label: `RANK ${rank}`,
  };
}

async function generateLeaderboardBanner({
  client,
  guild,
  type,
  page,
  entries,
}) {
  const config =
    LEADERBOARDS[type] ||
    LEADERBOARDS.global;

  const totalUsers = entries.length;

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalUsers / ITEMS_PER_PAGE
    )
  );

  const safePage = clamp(
    Number(page) || 1,
    1,
    totalPages
  );

  const start =
    (safePage - 1) *
    ITEMS_PER_PAGE;

  const visibleEntries = entries.slice(
    start,
    start + ITEMS_PER_PAGE
  );

  const WIDTH = 1600;

  const HEADER_HEIGHT = 285;
  const ROW_HEIGHT = 104;
  const FOOTER_HEIGHT = 125;

  const ROWS = Math.max(
    1,
    visibleEntries.length
  );

  const HEIGHT =
    HEADER_HEIGHT +
    ROWS * ROW_HEIGHT +
    FOOTER_HEIGHT;

  const canvas = createCanvas(
    WIDTH,
    HEIGHT
  );

  const ctx = canvas.getContext("2d");

  // Background
  const background =
    ctx.createLinearGradient(
      0,
      0,
      WIDTH,
      HEIGHT
    );

  background.addColorStop(
    0,
    "#06070B"
  );

  background.addColorStop(
    0.5,
    "#0B0D14"
  );

  background.addColorStop(
    1,
    "#050509"
  );

  ctx.fillStyle = background;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // Decorative glow
  const glow =
    ctx.createRadialGradient(
      WIDTH * 0.82,
      40,
      0,
      WIDTH * 0.82,
      40,
      500
    );

  glow.addColorStop(
    0,
    "rgba(120, 80, 255, 0.20)"
  );

  glow.addColorStop(
    0.5,
    "rgba(70, 90, 255, 0.08)"
  );

  glow.addColorStop(
    1,
    "rgba(0, 0, 0, 0)"
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEADER_HEIGHT
  );

  // Header panel
  ctx.fillStyle =
    "rgba(255,255,255,0.025)";

  fillRoundedRect(
    ctx,
    38,
    32,
    WIDTH - 76,
    HEADER_HEIGHT - 52,
    28
  );

  ctx.strokeStyle =
    "rgba(255,255,255,0.08)";

  ctx.lineWidth = 2;

  strokeRoundedRect(
    ctx,
    38,
    32,
    WIDTH - 76,
    HEADER_HEIGHT - 52,
    28
  );

  // Small Zeechei label
  ctx.font =
    "700 24px sans-serif";

  ctx.fillStyle =
    "#8D91A3";

  ctx.fillText(
    "ZEECHEI",
    76,
    80
  );

  // Main title
  ctx.font =
    "800 58px sans-serif";

  ctx.fillStyle =
    "#F5F6FA";

  ctx.fillText(
    "LEADERBOARD",
    76,
    145
  );

  // Current leaderboard
  ctx.font =
    "700 27px sans-serif";

  ctx.fillStyle =
    "#9B8CFF";

  ctx.fillText(
    config.label.toUpperCase(),
    76,
    190
  );

  ctx.font =
    "400 21px sans-serif";

  ctx.fillStyle =
    "#858A9A";

  ctx.fillText(
    config.description,
    76,
    225
  );

  // Server / global indicator
  const scopeText =
    type === "server"
      ? guild
        ? `SERVER • ${truncate(
            guild.name,
            35
          )}`
        : "SERVER"
      : "GLOBAL NETWORK";

  ctx.font =
    "700 18px sans-serif";

  ctx.fillStyle =
    "#6F7485";

  ctx.fillText(
    scopeText.toUpperCase(),
    76,
    257
  );

  // Stats cards
  const statX = WIDTH - 540;

  const stats = [
    {
      title: "USERS",
      value: formatNumber(totalUsers),
    },
    {
      title: "PAGE",
      value: `${safePage}/${totalPages}`,
    },
    {
      title: "PER PAGE",
      value: String(ITEMS_PER_PAGE),
    },
  ];

  stats.forEach((stat, index) => {
    const x =
      statX + index * 155;

    ctx.fillStyle =
      "rgba(255,255,255,0.035)";

    fillRoundedRect(
      ctx,
      x,
      72,
      140,
      92,
      18
    );

    ctx.strokeStyle =
      "rgba(255,255,255,0.07)";

    ctx.lineWidth = 1;

    strokeRoundedRect(
      ctx,
      x,
      72,
      140,
      92,
      18
    );

    ctx.font =
      "700 15px sans-serif";

    ctx.fillStyle =
      "#6F7485";

    ctx.fillText(
      stat.title,
      x + 17,
      98
    );

    ctx.font =
      "800 26px sans-serif";

    ctx.fillStyle =
      "#F2F3F7";

    ctx.fillText(
      stat.value,
      x + 17,
      135
    );
  });

  // Row area
  let y =
    HEADER_HEIGHT;

  for (
    let index = 0;
    index < visibleEntries.length;
    index++
  ) {
    const entry =
      visibleEntries[index];

    const globalIndex =
      start + index;

    const rowY =
      y + index * ROW_HEIGHT;

    const isAlternate =
      index % 2 === 1;

    ctx.fillStyle = isAlternate
      ? "rgba(255,255,255,0.018)"
      : "rgba(255,255,255,0.032)";

    fillRoundedRect(
      ctx,
      38,
      rowY + 7,
      WIDTH - 76,
      ROW_HEIGHT - 14,
      20
    );

    // rank
    const rank = globalIndex + 1;

    const rankStyle =
      getRankStyle(rank);

    ctx.font =
      rank <= 3
        ? "800 27px sans-serif"
        : "700 23px sans-serif";

    ctx.fillStyle =
      rank <= 3
        ? "#B49CFF"
        : "#686D7C";

    ctx.fillText(
      rankStyle.number,
      70,
      rowY + 65
    );

    // avatar
    const avatarSize = 64;

    const avatarX = 140;

    const avatarY =
      rowY +
      (ROW_HEIGHT -
        avatarSize) /
        2;

    const userInfo =
      await getUserInfo(
        client,
        entry.userId
      );

    const avatar =
      await fetchImage(
        userInfo.avatar
      );

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      avatarX +
        avatarSize / 2,
      avatarY +
        avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2
    );

    ctx.closePath();

    ctx.clip();

    if (avatar) {
      ctx.drawImage(
        avatar,
        avatarX,
        avatarY,
        avatarSize,
        avatarSize
      );
    } else {
      const fallback =
        ctx.createLinearGradient(
          avatarX,
          avatarY,
          avatarX +
            avatarSize,
          avatarY +
            avatarSize
        );

      fallback.addColorStop(
        0,
        "#4D416F"
      );

      fallback.addColorStop(
        1,
        "#181421"
      );

      ctx.fillStyle = fallback;

      ctx.fillRect(
        avatarX,
        avatarY,
        avatarSize,
        avatarSize
      );

      ctx.font =
        "800 22px sans-serif";

      ctx.textAlign = "center";

      ctx.textBaseline =
        "middle";

      ctx.fillStyle =
        "#EDE9FF";

      ctx.fillText(
        getInitials(
          userInfo.name
        ),
        avatarX +
          avatarSize / 2,
        avatarY +
          avatarSize / 2
      );

      ctx.textAlign = "left";

      ctx.textBaseline =
        "alphabetic";
    }

    ctx.restore();

    // User name
    ctx.font =
      "700 25px sans-serif";

    ctx.fillStyle =
      "#F0F1F5";

    ctx.fillText(
      truncate(
        userInfo.name,
        34
      ),
      230,
      rowY + 49
    );

    ctx.font =
      "400 17px sans-serif";

    ctx.fillStyle =
      "#696E7D";

    ctx.fillText(
      truncate(
        userInfo.username
          ? `@${userInfo.username}`
          : userInfo.id,
        40
      ),
      230,
      rowY + 75
    );

    // Rank label
    ctx.font =
      "700 14px sans-serif";

    ctx.fillStyle =
      "#575C6A";

    ctx.fillText(
      rankStyle.label,
      560,
      rowY + 62
    );

    // Value box
    const valueBoxWidth = 245;
    const valueBoxHeight = 62;

    const valueX =
      WIDTH -
      valueBoxWidth -
      75;

    const valueY =
      rowY +
      (ROW_HEIGHT -
        valueBoxHeight) /
        2;

    ctx.fillStyle =
      "rgba(145,125,255,0.075)";

    fillRoundedRect(
      ctx,
      valueX,
      valueY,
      valueBoxWidth,
      valueBoxHeight,
      17
    );

    ctx.strokeStyle =
      "rgba(145,125,255,0.16)";

    ctx.lineWidth = 1;

    strokeRoundedRect(
      ctx,
      valueX,
      valueY,
      valueBoxWidth,
      valueBoxHeight,
      17
    );

    ctx.font =
      "800 25px sans-serif";

    ctx.fillStyle =
      "#E9E4FF";

    ctx.textAlign =
      "right";

    ctx.fillText(
      formatNumber(entry.count),
      valueX +
        valueBoxWidth -
        24,
      valueY + 29
    );

    ctx.font =
      "700 12px sans-serif";

    ctx.fillStyle =
      "#77708F";

    ctx.fillText(
      getLeaderboardValueLabel(
        type
      ),
      valueX +
        valueBoxWidth -
        24,
      valueY + 48
    );

    ctx.textAlign =
      "left";
  }

  // Empty state
  if (visibleEntries.length === 0) {
    const centerY =
      HEADER_HEIGHT +
      (ROWS * ROW_HEIGHT) /
        2;

    ctx.textAlign =
      "center";

    ctx.font =
      "800 32px sans-serif";

    ctx.fillStyle =
      "#E5E6EC";

    ctx.fillText(
      "NO LEADERBOARD DATA",
      WIDTH / 2,
      centerY - 5
    );

    ctx.font =
      "400 19px sans-serif";

    ctx.fillStyle =
      "#696E7D";

    ctx.fillText(
      "There is currently no recorded activity for this leaderboard.",
      WIDTH / 2,
      centerY + 34
    );

    ctx.textAlign =
      "left";
  }

  // Footer
  const footerY =
    HEIGHT -
    FOOTER_HEIGHT;

  ctx.strokeStyle =
    "rgba(255,255,255,0.06)";

  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(
    60,
    footerY
  );

  ctx.lineTo(
    WIDTH - 60,
    footerY
  );

  ctx.stroke();

  ctx.font =
    "600 17px sans-serif";

  ctx.fillStyle =
    "#626776";

  ctx.fillText(
    "LIVE DATA • ZEECHEI DATABASE",
    70,
    footerY + 45
  );

  ctx.font =
    "400 16px sans-serif";

  ctx.fillStyle =
    "#4E5361";

  ctx.fillText(
    `Updated ${formatTime(
      Date.now()
    )} • ${formatDate(
      Date.now()
    )}`,
    70,
    footerY + 72
  );

  ctx.textAlign =
    "right";

  ctx.font =
    "700 18px sans-serif";

  ctx.fillStyle =
    "#777C8D";

  ctx.fillText(
    `PAGE ${safePage} / ${totalPages}`,
    WIDTH - 70,
    footerY + 58
  );

  ctx.textAlign =
    "left";

  return {
    buffer: canvas.toBuffer(
      "image/png"
    ),
    page: safePage,
    totalPages,
    totalUsers,
  };
}

function buildSelectRow(
  currentType
) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "leaderboard_select"
      )
      .setPlaceholder(
        "Choose a leaderboard"
      );

  const options = Object.entries(
    LEADERBOARDS
  ).map(
    ([key, config]) => ({
      label: config.label,
      description:
        config.description.slice(
          0,
          100
        ),
      value: key,
      default:
        key === currentType,
    })
  );

  menu.addOptions(options);

  return new ActionRowBuilder().addComponents(
    menu
  );
}

function buildButtonRows(
  type,
  page,
  totalPages
) {
  const previous =
    new ButtonBuilder()
      .setCustomId(
        "leaderboard_previous"
      )
      .setLabel("Previous")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(page <= 1);

  const pageButton =
    new ButtonBuilder()
      .setCustomId(
        "leaderboard_page"
      )
      .setLabel(
        `Page ${page}/${totalPages}`
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(true);

  const next =
    new ButtonBuilder()
      .setCustomId(
        "leaderboard_next"
      )
      .setLabel("Next")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page >= totalPages
      );

  const refresh =
    new ButtonBuilder()
      .setCustomId(
        "leaderboard_refresh"
      )
      .setLabel("Refresh")
      .setStyle(
        ButtonStyle.Primary
      );

  const home =
    new ButtonBuilder()
      .setCustomId(
        "leaderboard_home"
      )
      .setLabel("Global")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        type === "global" &&
          page === 1
      );

  return [
    new ActionRowBuilder().addComponents(
      previous,
      pageButton,
      next,
      refresh,
      home
    ),
  ];
}

async function createPayload(
  client,
  guild,
  type,
  page
) {
  // IMPORTANT:
  // Database is read again every time.
  // Nothing is cached here.
  const entries =
    await getLeaderboardData(
      client,
      type,
      guild?.id
    );

  const result =
    await generateLeaderboardBanner({
      client,
      guild,
      type,
      page,
      entries,
    });

  const attachment =
    new AttachmentBuilder(
      result.buffer,
      {
        name:
          "zeechei-leaderboard.png",
      }
    );

  const v2 =
    new V2Builder();

  v2.media(
    "attachment://zeechei-leaderboard.png"
  );

  const built =
    v2.build([
      attachment,
    ]);

  const components = [
    buildSelectRow(type),
    ...buildButtonRows(
      type,
      result.page,
      result.totalPages
    ),
  ];

  built.components.push(
    ...components
  );

  return {
    ...built,
    _leaderboard: {
      type,
      page: result.page,
      totalPages:
        result.totalPages,
      totalUsers:
        result.totalUsers,
    },
  };
}

function getContext(
  message,
  interaction
) {
  if (interaction) {
    return {
      user: interaction.user,
      guild: interaction.guild,
      channel: interaction.channel,
    };
  }

  return {
    user: message.author,
    guild: message.guild,
    channel: message.channel,
  };
}

async function safeEdit(
  interaction,
  client,
  state
) {
  try {
    const payload =
      await createPayload(
        client,
        state.guild,
        state.type,
        state.page
      );

    delete payload._leaderboard;

    await interaction.editReply(
      payload
    );

    return true;
  } catch (error) {
    console.error(
      "[Leaderboard] Update error:",
      error
    );

    try {
      if (
        interaction.deferred ||
        interaction.replied
      ) {
        await interaction.editReply({
          content:
            "Unable to update the leaderboard right now.",
          components: [],
        });
      }
    } catch {}

    return false;
  }
}

async function execute({
  client,
  message,
  args,
  interaction,
}) {
  const ctx =
    getContext(
      message,
      interaction
    );

  if (!ctx.guild) {
    const text =
      "This command can only be used inside a server.";

    if (interaction) {
      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        return interaction.reply({
          content: text,
          ephemeral: true,
        });
      }

      return interaction.editReply({
        content: text,
      });
    }

    return message.reply(text);
  }

  const rawArgs =
    Array.isArray(args)
      ? args
      : [];

  let type =
    String(
      rawArgs[0] ||
        "global"
    ).toLowerCase();

  let page =
    Number(
      rawArgs[1] ||
        1
    );

  if (
    !LEADERBOARDS[type]
  ) {
    type = "global";

    const possiblePage =
      Number(
        rawArgs[0]
      );

    if (
      Number.isFinite(
        possiblePage
      ) &&
      possiblePage > 0
    ) {
      page = possiblePage;
    }
  }

  if (
    !Number.isFinite(page) ||
    page < 1
  ) {
    page = 1;
  }

  page = Math.floor(page);

  const initial =
    await createPayload(
      client,
      ctx.guild,
      type,
      page
    );

  const state = {
    type:
      initial._leaderboard.type,
    page:
      initial._leaderboard.page,
    totalPages:
      initial._leaderboard.totalPages,
    guild:
      ctx.guild,
  };

  delete initial._leaderboard;

  let sentMessage;

  if (interaction) {
    if (
      interaction.replied ||
      interaction.deferred
    ) {
      sentMessage =
        await interaction.editReply(
          initial
        );
    } else {
      sentMessage =
        await interaction.reply(
          initial
        );

      sentMessage =
        await interaction.fetchReply();
    }
  } else {
    sentMessage =
      await message.reply(
        initial
      );
  }

  if (!sentMessage) {
    return;
  }

  const collector =
    sentMessage.createMessageComponentCollector({
      time: 15 * 60 * 1000,
    });

  collector.on(
    "collect",
    async button => {
      try {
        if (
          button.user.id !==
          ctx.user.id
        ) {
          return button.reply({
            content:
              "This leaderboard belongs to the user who opened it.",
            ephemeral: true,
          });
        }

        await button.deferUpdate();

        // SELECT LEADERBOARD
        if (
          button.isStringSelectMenu() &&
          button.customId ===
            "leaderboard_select"
        ) {
          const selected =
            button.values?.[0];

          if (
            selected &&
            LEADERBOARDS[selected]
          ) {
            state.type =
              selected;

            state.page = 1;
          }

          await safeEdit(
            button,
            client,
            state
          );

          return;
        }

        // PREVIOUS
        if (
          button.customId ===
          "leaderboard_previous"
        ) {
          state.page =
            Math.max(
              1,
              state.page - 1
            );

          await safeEdit(
            button,
            client,
            state
          );

          return;
        }

        // NEXT
        if (
          button.customId ===
          "leaderboard_next"
        ) {
          // Get live data again so
          // newly added users/pages
          // are immediately detected.
          const freshEntries =
            await getLeaderboardData(
              client,
              state.type,
              state.guild.id
            );

          state.totalPages =
            Math.max(
              1,
              Math.ceil(
                freshEntries.length /
                  ITEMS_PER_PAGE
              )
            );

          state.page =
            Math.min(
              state.page + 1,
              state.totalPages
            );

          await safeEdit(
            button,
            client,
            state
          );

          return;
        }

        // REFRESH
        if (
          button.customId ===
          "leaderboard_refresh"
        ) {
          // Reset nothing.
          // Same page/type, completely
          // fresh database read.
          await safeEdit(
            button,
            client,
            state
          );

          return;
        }

        // GLOBAL HOME
        if (
          button.customId ===
          "leaderboard_home"
        ) {
          state.type =
            "global";

          state.page = 1;

          await safeEdit(
            button,
            client,
            state
          );

          return;
        }
      } catch (error) {
        console.error(
          "[Leaderboard] Button error:",
          error
        );

        try {
          if (
            !button.replied &&
            !button.deferred
          ) {
            await button.reply({
              content:
                "Something went wrong while updating the leaderboard.",
              ephemeral: true,
            });
          }
        } catch {}
      }
    }
  );

  collector.on(
    "end",
    async () => {
      try {
        // Disable components after timeout.
        const disabledRows =
          [
            buildSelectRow(
              state.type
            ),
            ...buildButtonRows(
              state.type,
              state.page,
              state.totalPages
            ),
          ].map(row => {
            row.components.forEach(
              component => {
                if (
                  typeof component.setDisabled ===
                  "function"
                ) {
                  component.setDisabled(
                    true
                  );
                }
              }
            );

            return row;
          });

        await sentMessage.edit({
          components:
            disabledRows,
        });
      } catch {}
    }
  );
}

module.exports = {
  name: "leaderboard",

  aliases: [
    "lb",
    "top",
    "rank",
    "ranking",
  ],

  description:
    "View live Zeechei leaderboards",

  category: "General",

  usage:
    "+leaderboard [global|server|daily|messages|commands|afk|songs|badges|liked] [page]",

  argsRequired: false,

  data:
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription(
        "View Zeechei leaderboards"
      )
      .addStringOption(
        option =>
          option
            .setName("type")
            .setDescription(
              "Leaderboard type"
            )
            .setRequired(false)
            .addChoices(
              {
                name:
                  "Global Commands",
                value:
                  "global",
              },
              {
                name:
                  "Server Commands",
                value:
                  "server",
              },
              {
                name:
                  "Daily Commands",
                value:
                  "daily",
              },
              {
                name:
                  "Messages",
                value:
                  "messages",
              },
              {
                name:
                  "Commands",
                value:
                  "commands",
              },
              {
                name:
                  "AFK",
                value:
                  "afk",
              },
              {
                name:
                  "Songs Played",
                value:
                  "songs",
              },
              {
                name:
                  "Badges",
                value:
                  "badges",
              },
              {
                name:
                  "Liked Songs",
                value:
                  "liked",
              }
            )
      )
      .addIntegerOption(
        option =>
          option
            .setName("page")
            .setDescription(
              "Leaderboard page"
            )
            .setRequired(false)
            .setMinValue(1)
      ),

  getSlashArgs(interaction) {
    const type =
      interaction.options.getString(
        "type"
      ) || "global";

    const page =
      interaction.options.getInteger(
        "page"
      ) || 1;

    return [
      type,
      String(page),
    ];
  },

  execute,
};