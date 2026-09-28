// ============================================================
// ZEECHEI TRACKER SYSTEM
// File: commands/general/tracker.js
//
// FEATURES:
//   • Tracker Overview
//   • Message Tracker
//   • Invite Tracker
//   • Channel Blacklist Tracker
//   • Live Zeechei message statistics
//   • Live Discord invites
//   • Persistent tracker blacklist
//   • Dropdown + pagination
//   • Prefix + Slash compatible
//
// IMPORTANT:
// Emojis are intentionally kept at the TOP.
// Change emojis here only.
// ============================================================

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
} = require("discord.js");

const {
  createCanvas,
} = require("@napi-rs/canvas");

const fs = require("fs");
const path = require("path");

const Database = require("../../database/Database");

// ============================================================
// TRACKER EMOJIS
// ============================================================

const EMOJIS = {
  // Main
  tracker: "📊",
  overview: "📈",
  messages: "💬",
  invites: "🎟️",
  blacklist: "🚫",

  // Stats
  users: "👥",
  message: "💬",
  today: "📅",
  average: "📊",
  server: "🏠",
  channel: "📺",

  // Invite
  invite: "🔗",
  fake: "⚠️",
  invited: "👤",

  // Actions
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  loading: "⏳",

  // Navigation
  previous: "◀️",
  next: "▶️",
  page: "📄",
  refresh: "🔄",
};

// ============================================================
// PATH
// ============================================================

const TRACKER_PATH = path.join(
  process.cwd(),
  "data",
  "zeechei_tracker.json"
);

// ============================================================
// MESSAGE STATS PATH
//
// Zeechei's existing message.js stores the actual live message
// statistics here. We read it rather than creating a second
// message counter.
// ============================================================

const MESSAGE_STATS_PATH = path.join(
  process.cwd(),
  "database",
  "messageStats.json"
);

// ============================================================
// CONFIG
// ============================================================

const WIDTH = 1200;
const HEIGHT = 720;

const PANEL = "#08080D";
const PANEL_2 = "#0D0D14";
const BORDER = "#242431";

const TEXT = "#F4F4F5";
const MUTED = "#8A8A98";

const ACCENT = "#8B5CF6";
const SUCCESS = "#22C55E";
const WARNING = "#EAB308";
const ERROR = "#EF4444";

// ============================================================
// DATABASE HELPERS
// ============================================================

function ensureTrackerDatabase() {
  try {
    const dir =
      path.dirname(
        TRACKER_PATH
      );

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(
        dir,
        {
          recursive: true,
        }
      );
    }

    if (
      !fs.existsSync(
        TRACKER_PATH
      )
    ) {
      fs.writeFileSync(
        TRACKER_PATH,
        JSON.stringify(
          {
            guilds: {},
          },
          null,
          2
        ),
        "utf8"
      );
    }
  } catch (error) {
    console.error(
      "[Zeechei Tracker] Database init:",
      error?.message || error
    );
  }
}

function readTrackerDatabase() {
  ensureTrackerDatabase();

  try {
    const data =
      JSON.parse(
        fs.readFileSync(
          TRACKER_PATH,
          "utf8"
        )
      );

    if (
      !data ||
      typeof data !== "object"
    ) {
      return {
        guilds: {},
      };
    }

    if (!data.guilds) {
      data.guilds = {};
    }

    return data;
  } catch {
    return {
      guilds: {},
    };
  }
}

function writeTrackerDatabase(
  data
) {
  ensureTrackerDatabase();

  try {
    const tmp =
      `${TRACKER_PATH}.tmp`;

    fs.writeFileSync(
      tmp,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(
      tmp,
      TRACKER_PATH
    );
  } catch (error) {
    console.error(
      "[Zeechei Tracker] Database write:",
      error?.message || error
    );
  }
}

// ============================================================
// GUILD DATA
// ============================================================

function getGuildTrackerData(
  data,
  guildId
) {
  const id =
    String(guildId);

  if (!data.guilds[id]) {
    data.guilds[id] = {
      blacklistedChannels: [],
    };
  }

  if (
    !Array.isArray(
      data.guilds[id]
        .blacklistedChannels
    )
  ) {
    data.guilds[id]
      .blacklistedChannels = [];
  }

  return data.guilds[id];
}

// ============================================================
// MESSAGE DATABASE
// ============================================================

function readMessageDatabase() {
  try {
    if (
      !fs.existsSync(
        MESSAGE_STATS_PATH
      )
    ) {
      return {
        guilds: {},
      };
    }

    const data =
      JSON.parse(
        fs.readFileSync(
          MESSAGE_STATS_PATH,
          "utf8"
        )
      );

    if (
      !data ||
      typeof data !== "object"
    ) {
      return {
        guilds: {},
      };
    }

    if (!data.guilds) {
      data.guilds = {};
    }

    return data;
  } catch {
    return {
      guilds: {},
    };
  }
}

// ============================================================
// FORMAT
// ============================================================

function number(value) {
  const n =
    Number(value || 0);

  return Number.isFinite(n)
    ? n.toLocaleString("en-US")
    : "0";
}

function safe(value) {
  return String(
    value ?? ""
  )
    .replace(
      /@everyone/gi,
      "@ everyone"
    )
    .replace(
      /@here/gi,
      "@ here"
    )
    .replace(
      /[\r\n]+/g,
      " "
    );
}

// ============================================================
// CANVAS HELPERS
// ============================================================

function roundedRect(
  ctx,
  x,
  y,
  w,
  h,
  r
) {
  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.arcTo(
    x + w,
    y,
    x + w,
    y + h,
    r
  );

  ctx.arcTo(
    x + w,
    y + h,
    x,
    y + h,
    r
  );

  ctx.arcTo(
    x,
    y + h,
    x,
    y,
    r
  );

  ctx.arcTo(
    x,
    y,
    x + w,
    y,
    r
  );

  ctx.closePath();
}

function fillRound(
  ctx,
  x,
  y,
  w,
  h,
  r,
  color
) {
  roundedRect(
    ctx,
    x,
    y,
    w,
    h,
    r
  );

  ctx.fillStyle =
    color;

  ctx.fill();
}

function drawText(
  ctx,
  value,
  x,
  y,
  size,
  color = TEXT,
  weight = "500",
  align = "left"
) {
  ctx.font =
    `${weight} ${size}px Arial`;

  ctx.fillStyle =
    color;

  ctx.textAlign =
    align;

  ctx.textBaseline =
    "middle";

  ctx.fillText(
    safe(value),
    x,
    y
  );
}

// ============================================================
// USER MESSAGE STATS
// ============================================================

function getUserMessageStats(
  guildId,
  userId
) {
  const data =
    readMessageDatabase();

  const guild =
    data.guilds?.[
      String(guildId)
    ];

  const user =
    guild?.users?.[
      String(userId)
    ];

  if (!user) {
    return {
      total: 0,
      today: 0,
    };
  }

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  return {
    total:
      Number(
        user.total || 0
      ),

    today:
      Number(
        user.daily?.[
          today
        ] || 0
      ),
  };
}

// ============================================================
// GUILD MESSAGE STATS
// ============================================================

function getGuildMessageStats(
  guildId
) {
  const data =
    readMessageDatabase();

  const guild =
    data.guilds?.[
      String(guildId)
    ];

  if (!guild) {
    return {
      total: 0,
      today: 0,
      users: 0,
    };
  }

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  return {
    total:
      Number(
        guild.total || 0
      ),

    today:
      Number(
        guild.daily?.[
          today
        ] || 0
      ),

    users:
      Object.keys(
        guild.users || {}
      ).length,
  };
}

// ============================================================
// BLACKLIST
// ============================================================

function getBlacklistedChannels(
  guildId
) {
  const data =
    readTrackerDatabase();

  const guild =
    getGuildTrackerData(
      data,
      guildId
    );

  return [
    ...guild.blacklistedChannels,
  ];
}

function isChannelBlacklisted(
  guildId,
  channelId
) {
  return getBlacklistedChannels(
    guildId
  ).includes(
    String(channelId)
  );
}

function addBlacklistedChannel(
  guildId,
  channelId
) {
  const data =
    readTrackerDatabase();

  const guild =
    getGuildTrackerData(
      data,
      guildId
    );

  const id =
    String(channelId);

  if (
    !guild.blacklistedChannels.includes(
      id
    )
  ) {
    guild.blacklistedChannels.push(
      id
    );
  }

  writeTrackerDatabase(
    data
  );
}

function removeBlacklistedChannel(
  guildId,
  channelId
) {
  const data =
    readTrackerDatabase();

  const guild =
    getGuildTrackerData(
      data,
      guildId
    );

  guild.blacklistedChannels =
    guild.blacklistedChannels.filter(
      id =>
        String(id) !==
        String(channelId)
    );

  writeTrackerDatabase(
    data
  );
}

function clearBlacklistedChannels(
  guildId
) {
  const data =
    readTrackerDatabase();

  const guild =
    getGuildTrackerData(
      data,
      guildId
    );

  guild.blacklistedChannels =
    [];

  writeTrackerDatabase(
    data
  );
}

// ============================================================
// INVITE TRACKER
// ============================================================

async function getInviteStats(
  guild,
  member
) {
  const result = {
    total: 0,
    fake: 0,
    today: 0,
    invitedUsers: [],
  };

  try {
    const invites =
      await guild.invites.fetch();

    const own =
      invites.filter(
        invite =>
          invite.inviter?.id ===
          member.id
      );

    result.total =
      own.size;

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    for (const invite of own.values()) {
      if (
        invite.createdAt
          ?.toISOString()
          .slice(0, 10) ===
        today
      ) {
        result.today++;
      }

      // Same concept as the original tracker:
      // accounts younger than 30 days are treated as fake.
      if (
        invite.invited?.createdAt
      ) {
        const age =
          Date.now() -
          invite.invited.createdAt.getTime();

        if (
          age <
          30 *
            24 *
            60 *
            60 *
            1000
        ) {
          result.fake++;
        }
      }

      if (
        invite.invited &&
        result.invitedUsers
          .length < 10
      ) {
        result.invitedUsers.push(
          invite.invited
        );
      }
    }
  } catch (error) {
    console.error(
      "[Zeechei Tracker] Invite fetch:",
      error?.message || error
    );
  }

  return result;
}

// ============================================================
// OVERVIEW BANNER
// ============================================================

async function buildOverviewBanner(
  client,
  guild
) {
  const stats =
    getGuildMessageStats(
      guild.id
    );

  const blacklisted =
    getBlacklistedChannels(
      guild.id
    );

  const canvas =
    createCanvas(
      WIDTH,
      HEIGHT
    );

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle =
    "#030305";

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  fillRound(
    ctx,
    28,
    28,
    WIDTH - 56,
    HEIGHT - 56,
    28,
    PANEL
  );

  ctx.strokeStyle =
    BORDER;

  ctx.lineWidth = 2;

  roundedRect(
    ctx,
    28,
    28,
    WIDTH - 56,
    HEIGHT - 56,
    28
  );

  ctx.stroke();

  drawText(
    ctx,
    `${EMOJIS.tracker} ZEECHEI TRACKER`,
    70,
    80,
    14,
    ACCENT,
    "900"
  );

  drawText(
    ctx,
    "Tracker Overview",
    70,
    125,
    38,
    TEXT,
    "900"
  );

  drawText(
    ctx,
    safe(guild.name),
    70,
    163,
    15,
    MUTED,
    "500"
  );

  const cards = [
    {
      emoji: EMOJIS.users,
      label: "Tracked Users",
      value: stats.users,
      color: ACCENT,
    },
    {
      emoji: EMOJIS.message,
      label: "Total Messages",
      value: stats.total,
      color: "#22D3EE",
    },
    {
      emoji: EMOJIS.today,
      label: "Today's Messages",
      value: stats.today,
      color: SUCCESS,
    },
    {
      emoji: EMOJIS.blacklist,
      label: "Blacklisted Channels",
      value: blacklisted.length,
      color: WARNING,
    },
  ];

  const cardW = 245;
  const cardH = 170;
  const gap = 25;

  const totalW =
    cards.length * cardW +
    (cards.length - 1) * gap;

  const startX =
    (WIDTH - totalW) / 2;

  for (
    let i = 0;
    i < cards.length;
    i++
  ) {
    const card =
      cards[i];

    const x =
      startX +
      i *
        (cardW + gap);

    const y =
      255;

    fillRound(
      ctx,
      x,
      y,
      cardW,
      cardH,
      20,
      PANEL_2
    );

    ctx.strokeStyle =
      BORDER;

    ctx.lineWidth = 1.5;

    roundedRect(
      ctx,
      x,
      y,
      cardW,
      cardH,
      20
    );

    ctx.stroke();

    drawText(
      ctx,
      card.emoji,
      x + 25,
      y + 38,
      24,
      TEXT,
      "500"
    );

    drawText(
      ctx,
      card.label,
      x + 25,
      y + 78,
      13,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(card.value),
      x + 25,
      y + 120,
      28,
      card.color,
      "900"
    );
  }

  ctx.strokeStyle =
    BORDER;

  ctx.beginPath();

  ctx.moveTo(
    70,
    HEIGHT - 85
  );

  ctx.lineTo(
    WIDTH - 70,
    HEIGHT - 85
  );

  ctx.stroke();

  drawText(
    ctx,
    "ZEECHEI LIVE TRACKER",
    70,
    HEIGHT - 55,
    10,
    MUTED,
    "800"
  );

  drawText(
    ctx,
    "LIVE",
    WIDTH - 70,
    HEIGHT - 55,
    10,
    SUCCESS,
    "800",
    "right"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// SEND TRACKER
// ============================================================

async function sendTracker(
  interaction,
  client,
  page = "overview",
  member = null,
  edit = false
) {
  const guild =
    interaction.guild;

  if (!guild) {
    const payload = {
      content:
        `${EMOJIS.error} Tracker can only be used inside a server.`,
    };

    if (edit) {
      return interaction.editReply(
        payload
      );
    }

    return interaction.reply({
      ...payload,
      ephemeral: true,
    });
  }

  let buffer;
  let filename;

  if (
    page ===
    "overview"
  ) {
    buffer =
      await buildOverviewBanner(
        client,
        guild
      );

    filename =
      "zeechei-tracker.png";
  } else {
    buffer =
      await buildTrackerTextBanner(
        guild,
        page,
        member ||
          interaction.member
      );

    filename =
      `zeechei-tracker-${page}.png`;
  }

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name: filename,
      }
    );

  const components = [
    buildTrackerMenu(),
  ];

  if (edit) {
    return interaction.editReply({
      files: [attachment],
      components,
    });
  }

  return interaction.reply({
    files: [attachment],
    components,
  });
}

// ============================================================
// TEXT TRACKER BANNERS
// ============================================================

async function buildTrackerTextBanner(
  guild,
  page,
  member
) {
  const canvas =
    createCanvas(
      WIDTH,
      HEIGHT
    );

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle =
    "#030305";

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  fillRound(
    ctx,
    28,
    28,
    WIDTH - 56,
    HEIGHT - 56,
    28,
    PANEL
  );

  ctx.strokeStyle =
    BORDER;

  ctx.lineWidth = 2;

  roundedRect(
    ctx,
    28,
    28,
    WIDTH - 56,
    HEIGHT - 56,
    28
  );

  ctx.stroke();

  const titles = {
    messages:
      `${EMOJIS.messages} Message Tracker`,
    invites:
      `${EMOJIS.invites} Invite Tracker`,
    blacklist:
      `${EMOJIS.blacklist} Blacklist Tracker`,
  };

  drawText(
    ctx,
    titles[page] ||
      `${EMOJIS.tracker} Zeechei Tracker`,
    70,
    90,
    34,
    TEXT,
    "900"
  );

  drawText(
    ctx,
    safe(guild.name),
    70,
    128,
    14,
    MUTED,
    "500"
  );

  // ----------------------------------------------------------
  // MESSAGES
  // ----------------------------------------------------------

  if (
    page ===
    "messages"
  ) {
    const stats =
      getUserMessageStats(
        guild.id,
        member.id
      );

    let days =
      1;

    try {
      if (
        member.joinedAt
      ) {
        days =
          Math.max(
            1,
            Math.floor(
              (
                Date.now() -
                member.joinedAt.getTime()
              ) /
                86400000
            )
          );
      }
    } catch {}

    const average =
      stats.total /
      days;

    drawText(
      ctx,
      `${EMOJIS.users} ${safe(
        member.displayName ||
        member.user?.username ||
        "User"
      )}`,
      80,
      215,
      20,
      TEXT,
      "800"
    );

    drawText(
      ctx,
      `${EMOJIS.message} Total Messages`,
      100,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(stats.total),
      100,
      330,
      32,
      ACCENT,
      "900"
    );

    drawText(
      ctx,
      `${EMOJIS.today} Today's Messages`,
      420,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(stats.today),
      420,
      330,
      32,
      SUCCESS,
      "900"
    );

    drawText(
      ctx,
      `${EMOJIS.average} Average / Day`,
      740,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      average.toFixed(2),
      740,
      330,
      32,
      "#22D3EE",
      "900"
    );

    drawText(
      ctx,
      `Member ID: ${member.id}`,
      100,
      430,
      13,
      MUTED,
      "500"
    );
  }

  // ----------------------------------------------------------
  // INVITES
  // ----------------------------------------------------------

  if (
    page ===
    "invites"
  ) {
    const stats =
      await getInviteStats(
        guild,
        member.user ||
          member
      );

    drawText(
      ctx,
      `${EMOJIS.users} ${safe(
        member.displayName ||
        member.user?.username ||
        "User"
      )}`,
      80,
      215,
      20,
      TEXT,
      "800"
    );

    drawText(
      ctx,
      `${EMOJIS.invite} Total Invites`,
      100,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(stats.total),
      100,
      330,
      32,
      ACCENT,
      "900"
    );

    drawText(
      ctx,
      `${EMOJIS.fake} Fake Invites`,
      420,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(stats.fake),
      420,
      330,
      32,
      WARNING,
      "900"
    );

    drawText(
      ctx,
      `${EMOJIS.today} Invited Today`,
      740,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(stats.today),
      740,
      330,
      32,
      SUCCESS,
      "900"
    );

    drawText(
      ctx,
      `${EMOJIS.invited} Recent Invited Users`,
      100,
      430,
      15,
      MUTED,
      "700"
    );

    const names =
      stats.invitedUsers
        .map(
          user =>
            `• ${user.username}`
        )
        .slice(0, 8);

    if (!names.length) {
      drawText(
        ctx,
        "No invited users found.",
        100,
        475,
        14,
        MUTED,
        "500"
      );
    } else {
      names.forEach(
        (name, index) => {
          drawText(
            ctx,
            name,
            100,
            475 +
              index * 28,
            13,
            TEXT,
            "500"
          );
        }
      );
    }
  }

  // ----------------------------------------------------------
  // BLACKLIST
  // ----------------------------------------------------------

  if (
    page ===
    "blacklist"
  ) {
    const ids =
      getBlacklistedChannels(
        guild.id
      );

    drawText(
      ctx,
      `${EMOJIS.blacklist} Blacklisted Channels`,
      80,
      215,
      20,
      TEXT,
      "800"
    );

    drawText(
      ctx,
      `${EMOJIS.channel} Total`,
      100,
      290,
      15,
      MUTED,
      "700"
    );

    drawText(
      ctx,
      number(ids.length),
      100,
      330,
      32,
      WARNING,
      "900"
    );

    if (!ids.length) {
      drawText(
        ctx,
        `${EMOJIS.success} No channels are blacklisted.`,
        100,
        430,
        16,
        SUCCESS,
        "700"
      );
    } else {
      ids
        .slice(0, 12)
        .forEach(
          (id, index) => {
            drawText(
              ctx,
              `${EMOJIS.channel} <#${id}>`,
              100,
              425 +
                index * 25,
              13,
              TEXT,
              "500"
            );
          }
        );
    }
  }

  ctx.strokeStyle =
    BORDER;

  ctx.beginPath();

  ctx.moveTo(
    70,
    HEIGHT - 85
  );

  ctx.lineTo(
    WIDTH - 70,
    HEIGHT - 85
  );

  ctx.stroke();

  drawText(
    ctx,
    "ZEECHEI TRACKER",
    70,
    HEIGHT - 55,
    10,
    MUTED,
    "800"
  );

  drawText(
    ctx,
    "LIVE",
    WIDTH - 70,
    HEIGHT - 55,
    10,
    SUCCESS,
    "800",
    "right"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// TRACKER MENU
// ============================================================

function buildTrackerMenu() {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "zeechei_tracker_select"
      )
      .setPlaceholder(
        "Select tracker section..."
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            "Overview"
          )
          .setValue(
            "overview"
          )
          .setDescription(
            "Zeechei tracker overview"
          )
          .setEmoji(
            EMOJIS.overview
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "Messages"
          )
          .setValue(
            "messages"
          )
          .setDescription(
            "Track a member's messages"
          )
          .setEmoji(
            EMOJIS.messages
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "Invites"
          )
          .setValue(
            "invites"
          )
          .setDescription(
            "Track member invites"
          )
          .setEmoji(
            EMOJIS.invites
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "Blacklist"
          )
          .setValue(
            "blacklist"
          )
          .setDescription(
            "View tracker-blacklisted channels"
          )
          .setEmoji(
            EMOJIS.blacklist
          )
      );

  return new ActionRowBuilder()
    .addComponents(
      menu
    );
}

// ============================================================
// PERMISSION
// ============================================================

function isOwner(
  userId
) {
  const id =
    String(userId);

  if (
    String(
      require("../../config")
        .mainOwnerId || ""
    ) === id
  ) {
    return true;
  }

  try {
    if (
      Database.isOwner?.(
        id
      )
    ) {
      return true;
    }
  } catch {}

  return false;
}

// ============================================================
// INTERACTION
// ============================================================

async function handleTrackerInteraction(
  interaction,
  client
) {
  if (
    !interaction.isStringSelectMenu?.()
  ) {
    return false;
  }

  if (
    interaction.customId !==
    "zeechei_tracker_select"
  ) {
    return false;
  }

  const selected =
    interaction.values?.[0];

  if (
    ![
      "overview",
      "messages",
      "invites",
      "blacklist",
    ].includes(selected)
  ) {
    return interaction.reply({
      content:
        `${EMOJIS.error} Invalid tracker section.`,
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  // For member-dependent sections,
  // default to command initiator.
  return sendTracker(
    interaction,
    client,
    selected,
    interaction.member,
    true
  );
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "tracker",

  aliases: [
    "track",
    "trackstats",
    "tracking",
  ],

  category: "general",

  description:
    "Open the live Zeechei tracker system.",

  usage:
    "tracker [member]",

  argsRequired: false,

  data: {
    name: "tracker",
    description:
      "Open the live Zeechei tracker system.",
  },

  getSlashArgs: () => [],

  async execute({
    client,
    message,
    args,
  }) {
    const member =
      message.mentions.members.first() ||
      message.member;

    return sendTracker(
      message,
      client,
      "overview",
      member,
      false
    );
  },

  async executeSlash(
    interaction,
    client
  ) {
    return sendTracker(
      interaction,
      client,
      "overview",
      interaction.member,
      false
    );
  },

  async handleInteraction(
    interaction,
    client
  ) {
    return handleTrackerInteraction(
      interaction,
      client
    );
  },

  // Exposed so Zeechei's existing message event can use the
  // same tracker blacklist if you later want to ignore channels.
  isChannelBlacklisted,
  addBlacklistedChannel,
  removeBlacklistedChannel,
  clearBlacklistedChannels,
  getBlacklistedChannels,
};