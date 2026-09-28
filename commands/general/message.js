const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const { createCanvas } = require("@napi-rs/canvas");
const { V2Builder } = require("../../utils/V2Builder");

const DATA_DIR = path.join(process.cwd(), "database");
const DATA_FILE = path.join(DATA_DIR, "messageStats.json");

const PER_PAGE = 5;
const COLLECTOR_TIME = 10 * 60 * 1000;

// ============================================================
// YELLOW THEME
// ============================================================

const YELLOW = "#FFD21F";
const YELLOW_SOFT = "#FFE66D";
const BG = "#080703";
const PANEL = "#111006";
const PANEL_2 = "#171508";
const WHITE = "#FFFBE8";
const MUTED = "#A89E72";

// ============================================================
// DATABASE
// ============================================================

function ensureDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true,
      });
    }

    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
          {
            guilds: {},
          },
          null,
          2
        )
      );
    }
  } catch (error) {
    console.error("[messageStats] Database error:", error);
  }
}

function readDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const data = JSON.parse(raw);

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

function writeDatabase(data) {
  ensureDatabase();

  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error(
      "[messageStats] Write error:",
      error
    );
  }
}

// ============================================================
// DATA STRUCTURE
// ============================================================

function getUserStats(data, guildId, userId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      users: {},
      total: 0,
      daily: {},
      weekly: {},
      monthly: {},
      yearly: {},
    };
  }

  const guild = data.guilds[guildId];

  if (!guild.users[userId]) {
    guild.users[userId] = {
      username: "Unknown User",
      total: 0,
      daily: {},
      weekly: {},
      monthly: {},
      yearly: {},
    };
  }

  return guild.users[userId];
}

// ============================================================
// DATE HELPERS
// ============================================================

function getDateKeys(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  const dateKey =
    `${year}-${month}-${day}`;

  const monthKey =
    `${year}-${month}`;

  const yearKey =
    String(year);

  const start =
    new Date(
      Date.UTC(
        year,
        date.getUTCMonth(),
        date.getUTCDate()
      )
    );

  const dayOfWeek =
    start.getUTCDay();

  const diff =
    dayOfWeek === 0
      ? -6
      : 1 - dayOfWeek;

  start.setUTCDate(
    start.getUTCDate() + diff
  );

  const weekKey =
    `${start.getUTCFullYear()}-${String(
      start.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(
      start.getUTCDate()
    ).padStart(2, "0")}`;

  return {
    daily: dateKey,
    weekly: weekKey,
    monthly: monthKey,
    yearly: yearKey,
  };
}

function increment(obj, key) {
  obj[key] =
    Number(obj[key] || 0) + 1;
}

// ============================================================
// RECORD MESSAGE
// ============================================================

function recordMessage({
  guildId,
  userId,
  username,
}) {
  const data = readDatabase();

  const user =
    getUserStats(
      data,
      guildId,
      userId
    );

  const guild =
    data.guilds[guildId];

  user.username =
    username ||
    user.username ||
    "Unknown User";

  user.total++;
  guild.total++;

  const keys =
    getDateKeys();

  increment(
    user.daily,
    keys.daily
  );

  increment(
    user.weekly,
    keys.weekly
  );

  increment(
    user.monthly,
    keys.monthly
  );

  increment(
    user.yearly,
    keys.yearly
  );

  increment(
    guild.daily,
    keys.daily
  );

  increment(
    guild.weekly,
    keys.weekly
  );

  increment(
    guild.monthly,
    keys.monthly
  );

  increment(
    guild.yearly,
    keys.yearly
  );

  writeDatabase(data);
}

// ============================================================
// PERIOD VALUE
// ============================================================

function getPeriodValue(
  user,
  period
) {
  const keys =
    getDateKeys();

  if (period === "daily") {
    return Number(
      user.daily?.[keys.daily] ||
        0
    );
  }

  if (period === "weekly") {
    return Number(
      user.weekly?.[keys.weekly] ||
        0
    );
  }

  if (period === "monthly") {
    return Number(
      user.monthly?.[keys.monthly] ||
        0
    );
  }

  if (period === "yearly") {
    return Number(
      user.yearly?.[keys.yearly] ||
        0
    );
  }

  return Number(
    user.total || 0
  );
}

// ============================================================
// FORMAT NUMBER
// ============================================================

function num(value) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-US"
  );
}

// ============================================================
// GET GUILD STATS
// ============================================================

function getGuildStats(
  guildId,
  period
) {
  const data =
    readDatabase();

  const guild =
    data.guilds[guildId];

  if (!guild) {
    return {
      total: 0,
      users: [],
    };
  }

  const users =
    Object.entries(
      guild.users || {}
    )
      .map(
        ([id, user]) => ({
          id,
          username:
            user.username ||
            "Unknown User",
          count:
            getPeriodValue(
              user,
              period
            ),
        })
      )
      .filter(
        user =>
          user.count > 0
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );

  return {
    total:
      users.reduce(
        (sum, user) =>
          sum + user.count,
        0
      ),
    users,
  };
}

// ============================================================
// GLOBAL STATS
// ============================================================

function getGlobalStats(
  client,
  period
) {
  const data =
    readDatabase();

  const users = new Map();

  for (
    const [guildId, guild] of
      Object.entries(
        data.guilds || {}
      )
  ) {
    const discordGuild =
      client.guilds.cache.get(
        guildId
      );

    for (
      const [userId, user] of
        Object.entries(
          guild.users || {}
        )
    ) {
      const count =
        getPeriodValue(
          user,
          period
        );

      if (!count) continue;

      const existing =
        users.get(userId) || {
          id: userId,
          username:
            user.username ||
            "Unknown User",
          count: 0,
          servers: 0,
        };

      existing.count +=
        count;

      existing.servers++;

      if (
        discordGuild
      ) {
        const member =
          discordGuild.members.cache.get(
            userId
          );

        if (member) {
          existing.username =
            member.user.username;
        }
      }

      users.set(
        userId,
        existing
      );
    }
  }

  return [...users.values()]
    .sort(
      (a, b) =>
        b.count - a.count
    );
}

// ============================================================
// CANVAS HELPERS
// ============================================================

function roundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {
  ctx.beginPath();
  ctx.roundRect(
    x,
    y,
    width,
    height,
    radius
  );
}

// ============================================================
// MAIN STATS BANNER
// ============================================================

function createStatsBanner({
  title,
  subtitle,
  period,
  guildName,
  total,
  users,
  page = 0,
  totalPages = 1,
  global = false,
}) {
  const width = 1400;
  const height = 760;

  const canvas =
    createCanvas(
      width,
      height
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // Yellow glow
  const glow =
    ctx.createRadialGradient(
      width / 2,
      0,
      20,
      width / 2,
      0,
      850
    );

  glow.addColorStop(
    0,
    "rgba(255,210,31,0.20)"
  );

  glow.addColorStop(
    0.45,
    "rgba(255,210,31,0.07)"
  );

  glow.addColorStop(
    1,
    "rgba(255,210,31,0)"
  );

  ctx.fillStyle =
    glow;

  ctx.fillRect(
    0,
    0,
    width,
    420
  );

  // Main panel
  ctx.fillStyle =
    PANEL;

  roundedRect(
    ctx,
    30,
    30,
    width - 60,
    height - 60,
    24
  );

  ctx.fill();

  ctx.strokeStyle =
    YELLOW;

  ctx.lineWidth = 2;

  ctx.stroke();

  // Header
  ctx.fillStyle =
    YELLOW;

  ctx.beginPath();

  ctx.arc(
    80,
    82,
    8,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.font =
    "bold 42px Arial";

  ctx.fillStyle =
    WHITE;

  ctx.fillText(
    title,
    105,
    96
  );

  ctx.font =
    "17px Arial";

  ctx.fillStyle =
    MUTED;

  ctx.fillText(
    subtitle,
    106,
    125
  );

  // Period badge
  ctx.textAlign =
    "right";

  ctx.font =
    "bold 18px Arial";

  ctx.fillStyle =
    YELLOW;

  ctx.fillText(
    period.toUpperCase(),
    width - 75,
    88
  );

  ctx.font =
    "15px Arial";

  ctx.fillStyle =
    MUTED;

  ctx.fillText(
    global
      ? "GLOBAL"
      : "SERVER",
    width - 75,
    115
  );

  ctx.textAlign =
    "left";

  // Divider
  ctx.strokeStyle =
    "rgba(255,210,31,0.22)";

  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(
    75,
    155
  );

  ctx.lineTo(
    width - 75,
    155
  );

  ctx.stroke();

  // Total panel
  ctx.fillStyle =
    PANEL_2;

  roundedRect(
    ctx,
    70,
    180,
    width - 140,
    100,
    17
  );

  ctx.fill();

  ctx.strokeStyle =
    "rgba(255,210,31,0.25)";

  ctx.stroke();

  ctx.fillStyle =
    YELLOW;

  ctx.font =
    "bold 15px Arial";

  ctx.fillText(
    "TOTAL MESSAGES",
    100,
    215
  );

  ctx.fillStyle =
    WHITE;

  ctx.font =
    "bold 36px Arial";

  ctx.fillText(
    num(total),
    100,
    255
  );

  ctx.font =
    "15px Arial";

  ctx.fillStyle =
    MUTED;

  ctx.fillText(
    global
      ? "Combined activity across tracked servers"
      : "Messages tracked in this server",
    420,
    240
  );

  // Table heading
  ctx.fillStyle =
    YELLOW;

  ctx.font =
    "bold 15px Arial";

  ctx.fillText(
    global
      ? "RANK"
      : "RANK",
    80,
    325
  );

  ctx.fillText(
    "USER",
    155,
    325
  );

  if (global) {
    ctx.fillText(
      "SERVERS",
      920,
      325
    );
  }

  ctx.textAlign =
    "right";

  ctx.fillText(
    "MESSAGES",
    width - 80,
    325
  );

  ctx.textAlign =
    "left";

  // Rows
  const startY =
    365;

  const rowHeight =
    57;

  if (!users.length) {
    ctx.textAlign =
      "center";

    ctx.fillStyle =
      MUTED;

    ctx.font =
      "20px Arial";

    ctx.fillText(
      "No message activity recorded yet.",
      width / 2,
      435
    );

    ctx.font =
      "15px Arial";

    ctx.fillText(
      "Start chatting and the live statistics will appear here.",
      width / 2,
      465
    );

    ctx.textAlign =
      "left";
  } else {
    users.forEach(
      (user, index) => {
        const y =
          startY +
          index *
            rowHeight;

        ctx.fillStyle =
          index === 0
            ? YELLOW
            : YELLOW_SOFT;

        ctx.font =
          "bold 19px Arial";

        ctx.fillText(
          String(
            page *
              PER_PAGE +
              index +
              1
          ).padStart(2, "0"),
          80,
          y
        );

        ctx.font =
          "bold 17px Arial";

        ctx.fillStyle =
          WHITE;

        let username =
          user.username ||
          "Unknown User";

        if (
          username.length >
          52
        ) {
          username =
            username.slice(
              0,
              49
            ) + "...";
        }

        ctx.fillText(
          username,
          155,
          y
        );

        if (global) {
          ctx.font =
            "15px Arial";

          ctx.fillStyle =
            MUTED;

          ctx.fillText(
            String(
              user.servers
            ),
            940,
            y
          );
        }

        ctx.textAlign =
          "right";

        ctx.font =
          "bold 17px Arial";

        ctx.fillStyle =
          YELLOW;

        ctx.fillText(
          num(user.count),
          width - 80,
          y
        );

        ctx.textAlign =
          "left";

        ctx.strokeStyle =
          "rgba(255,210,31,0.08)";

        ctx.beginPath();

        ctx.moveTo(
          75,
          y + 19
        );

        ctx.lineTo(
          width - 75,
          y + 19
        );

        ctx.stroke();
      }
    );
  }

  // Footer
  ctx.strokeStyle =
    "rgba(255,210,31,0.18)";

  ctx.beginPath();

  ctx.moveTo(
    75,
    height - 85
  );

  ctx.lineTo(
    width - 75,
    height - 85
  );

  ctx.stroke();

  ctx.font =
    "bold 12px Arial";

  ctx.fillStyle =
    "#776E43";

  ctx.fillText(
    "ZEECHEI • MESSAGE ANALYTICS",
    78,
    height - 52
  );

  ctx.textAlign =
    "right";

  ctx.fillText(
    totalPages > 1
      ? `PAGE ${page + 1} / ${totalPages}`
      : "LIVE STATS",
    width - 78,
    height - 52
  );

  ctx.textAlign =
    "left";

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// SIMPLE BANNER
// ============================================================

function createSimpleBanner({
  title,
  subtitle,
  rows = [],
}) {
  const width = 1200;
  const height =
    Math.max(
      430,
      260 +
        rows.length *
          58
    );

  const canvas =
    createCanvas(
      width,
      height
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  ctx.fillStyle = BG;
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  const glow =
    ctx.createRadialGradient(
      width / 2,
      0,
      10,
      width / 2,
      0,
      700
    );

  glow.addColorStop(
    0,
    "rgba(255,210,31,0.20)"
  );

  glow.addColorStop(
    1,
    "rgba(255,210,31,0)"
  );

  ctx.fillStyle =
    glow;

  ctx.fillRect(
    0,
    0,
    width,
    350
  );

  ctx.fillStyle =
    PANEL;

  roundedRect(
    ctx,
    30,
    30,
    width - 60,
    height - 60,
    22
  );

  ctx.fill();

  ctx.strokeStyle =
    YELLOW;

  ctx.lineWidth = 2;

  ctx.stroke();

  ctx.fillStyle =
    YELLOW;

  ctx.beginPath();

  ctx.arc(
    80,
    83,
    7,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.font =
    "bold 38px Arial";

  ctx.fillStyle =
    WHITE;

  ctx.fillText(
    title,
    105,
    95
  );

  ctx.font =
    "17px Arial";

  ctx.fillStyle =
    MUTED;

  ctx.fillText(
    subtitle,
    105,
    125
  );

  ctx.strokeStyle =
    "rgba(255,210,31,0.22)";

  ctx.beginPath();

  ctx.moveTo(
    70,
    155
  );

  ctx.lineTo(
    width - 70,
    155
  );

  ctx.stroke();

  let y = 205;

  for (
    const row of rows
  ) {
    ctx.fillStyle =
      YELLOW;

    ctx.beginPath();

    ctx.arc(
      82,
      y - 6,
      4,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.font =
      "bold 17px Arial";

    ctx.fillStyle =
      YELLOW_SOFT;

    ctx.fillText(
      row.label,
      105,
      y
    );

    ctx.font =
      "17px Arial";

    ctx.fillStyle =
      WHITE;

    ctx.fillText(
      String(
        row.value
      ),
      390,
      y
    );

    y += 58;
  }

  ctx.strokeStyle =
    "rgba(255,210,31,0.15)";

  ctx.beginPath();

  ctx.moveTo(
    70,
    height - 75
  );

  ctx.lineTo(
    width - 70,
    height - 75
  );

  ctx.stroke();

  ctx.font =
    "bold 12px Arial";

  ctx.fillStyle =
    "#776E43";

  ctx.fillText(
    "ZEECHEI • MESSAGE ANALYTICS",
    75,
    height - 47
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// ATTACHMENT PAYLOAD
// ============================================================

function bannerPayload(
  client,
  buffer,
  fileName = "message-stats.png",
  components = []
) {
  const color =
    typeof client.getColor ===
    "function"
      ? client.getColor(
          null
        )
      : 0xFFD21F;

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name:
          fileName,
      }
    );

  const builder =
    new V2Builder(
      color
    ).media(
      `attachment://${fileName}`
    );

  for (
    const component of
      components
  ) {
    builder.row(
      component
    );
  }

  const payload =
    builder.build();

  payload.files = [
    attachment,
  ];

  return payload;
}

// ============================================================
// PERIOD NORMALIZER
// ============================================================

function normalizePeriod(
  input
) {
  const value =
    String(
      input || "lifetime"
    ).toLowerCase();

  if (
    ["day", "daily", "d"]
      .includes(value)
  ) {
    return "daily";
  }

  if (
    ["week", "weekly", "w"]
      .includes(value)
  ) {
    return "weekly";
  }

  if (
    ["month", "monthly", "m"]
      .includes(value)
  ) {
    return "monthly";
  }

  if (
    ["year", "yearly", "y"]
      .includes(value)
  ) {
    return "yearly";
  }

  return "lifetime";
}

// ============================================================
// GUIDE DROPDOWN
// ============================================================

function guideMenu() {
  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          "message_guide_select"
        )
        .setPlaceholder(
          "Select a message command..."
        )
        .addOptions(
          {
            label:
              "Message Stats",
            description:
              "View your server message statistics",
            value:
              "message_stats",
          },
          {
            label:
              "Daily",
            description:
              "Show today's messages",
            value:
              "daily",
          },
          {
            label:
              "Weekly",
            description:
              "Show this week's messages",
            value:
              "weekly",
          },
          {
            label:
              "Monthly",
            description:
              "Show this month's messages",
            value:
              "monthly",
          },
          {
            label:
              "Yearly",
            description:
              "Show this year's messages",
            value:
              "yearly",
          },
          {
            label:
              "Lifetime",
            description:
              "Show lifetime message statistics",
            value:
              "lifetime",
          },
          {
            label:
              "Global Active",
            description:
              "Owner-only global top users",
            value:
              "globalactive",
          }
        )
    );
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "message",

  aliases: [
    "msg",
    "messages",
    "messageguide",
    "globalactive",
    "ms",
    "msdaily",
    "msweekly",
    "msmonthly",
    "msyearly",
    "mslifetime",
    "msg",
  ],

  description:
    "View message activity statistics.",

  category:
    "general",

  usage:
    "+message [daily|weekly|monthly|yearly|lifetime]",

  examples: [
    "+message",
    "+message daily",
    "+message weekly",
    "+message monthly",
    "+message yearly",
    "+message lifetime",
    "+messageguide",
    "+globalactive",
  ],

  data:
    new SlashCommandBuilder()
      .setName(
        "message"
      )
      .setDescription(
        "View your message statistics."
      )
      .addStringOption(
        option =>
          option
            .setName(
              "period"
            )
            .setDescription(
              "Statistics period"
            )
            .addChoices(
              {
                name:
                  "Daily",
                value:
                  "daily",
              },
              {
                name:
                  "Weekly",
                value:
                  "weekly",
              },
              {
                name:
                  "Monthly",
                value:
                  "monthly",
              },
              {
                name:
                  "Yearly",
                value:
                  "yearly",
              },
              {
                name:
                  "Lifetime",
                value:
                  "lifetime",
              }
            )
      ),

  getSlashArgs: opts => [
    opts.getString(
      "period"
    ) || "lifetime",
  ],

  async execute({
    client,
    message,
    args = [],
  }) {
    const guild =
      message.guild;

    if (!guild) {
      const buffer =
        createSimpleBanner({
          title:
            "SERVER ONLY",
          subtitle:
            "Message analytics require a server.",
          rows: [
            {
              label:
                "Status",
              value:
                "This command cannot be used in DMs.",
            },
          ],
        });

      return message.reply(
        bannerPayload(
          client,
          buffer,
          "message-error.png"
        )
      );
    }

    const color =
      typeof client.getColor ===
      "function"
        ? client.getColor(
            guild.id
          )
        : 0xFFD21F;

    const prefix =
      message.prefix ||
      "+";

    const command =
      String(
        message.commandName ||
          message.command ||
          args[-1] ||
          ""
      ).toLowerCase();

    const firstArg =
      String(
        args[0] || ""
      ).toLowerCase();

    // ========================================================
    // GUIDE
    // ========================================================

    if (
      command ===
        "messageguide" ||
      firstArg ===
        "guide"
    ) {
      const buffer =
        createSimpleBanner({
          title:
            "MESSAGE GUIDE",

          subtitle:
            "Zeechei message analytics commands",

          rows: [
            {
              label:
                `${prefix}message`,
              value:
                "Lifetime server stats",
            },
            {
              label:
                `${prefix}message daily`,
              value:
                "Today's messages",
            },
            {
              label:
                `${prefix}message weekly`,
              value:
                "Current week's messages",
            },
            {
              label:
                `${prefix}message monthly`,
              value:
                "Current month's messages",
            },
            {
              label:
                `${prefix}message yearly`,
              value:
                "Current year's messages",
            },
            {
              label:
                `${prefix}messageguide`,
              value:
                "Open this interactive guide",
            },
            {
              label:
                `${prefix}globalactive`,
              value:
                "Owner-only global leaderboard",
            },
          ],
        });

      return message.reply(
        bannerPayload(
          client,
          buffer,
          "message-guide.png",
          [
            guideMenu(),
          ]
        )
      );
    }

    // ========================================================
    // GLOBAL ACTIVE
    // ========================================================

    if (
      command ===
        "globalactive" ||
      firstArg ===
        "globalactive"
    ) {
      const ownerIds =
        Array.isArray(
          client.ownerIds
        )
          ? client.ownerIds
          : client.ownerId
            ? [client.ownerId]
            : [];

      const isOwner =
        ownerIds.includes(
          message.author.id
        ) ||
        message.author.id ===
          process.env.OWNER_ID;

      if (!isOwner) {
        const buffer =
          createSimpleBanner({
            title:
              "OWNER ONLY",

            subtitle:
              "Global activity is restricted",

            rows: [
              {
                label:
                  "Command",
                value:
                  `${prefix}globalactive`,
              },
              {
                label:
                  "Required",
                value:
                  "Bot Owner",
              },
              {
                label:
                  "Your Status",
                value:
                  "ACCESS DENIED",
              },
            ],
          });

        return message.reply(
          bannerPayload(
            client,
            buffer,
            "message-owner.png"
          )
        );
      }

      let period =
        normalizePeriod(
          args[1] ||
            args[0]
        );

      if (
        period ===
        "lifetime"
      ) {
        period =
          normalizePeriod(
            args[0]
          );
      }

      const globalUsers =
        getGlobalStats(
          client,
          period
        );

      const total =
        globalUsers.reduce(
          (sum, user) =>
            sum + user.count,
          0
        );

      const top5 =
        globalUsers.slice(
          0,
          5
        );

      const buffer =
        createStatsBanner({
          title:
            "GLOBAL ACTIVE",

          subtitle:
            "Top message activity across all tracked servers",

          period,

          guildName:
            "All Servers",

          total,

          users:
            top5,

          page: 0,

          totalPages: 1,

          global: true,
        });

      return message.reply(
        bannerPayload(
          client,
          buffer,
          "global-active.png"
        )
      );
    }

    // ========================================================
    // NORMAL SERVER STATS
    // ========================================================

    const period =
      normalizePeriod(
        firstArg
      );

    const stats =
      getGuildStats(
        guild.id,
        period
      );

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          stats.users.length /
            PER_PAGE
        )
      );

    let page = 0;

    const buildResponse =
      currentPage => {
        const start =
          currentPage *
          PER_PAGE;

        const users =
          stats.users.slice(
            start,
            start +
              PER_PAGE
          );

        const buffer =
          createStatsBanner({
            title:
              "MESSAGE STATS",

            subtitle:
              guild.name,

            period,

            guildName:
              guild.name,

            total:
              stats.total,

            users,

            page:
              currentPage,

            totalPages,
          });

        const components = [];

        if (
          totalPages > 1
        ) {
          components.push(
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "message_first"
                  )
                  .setLabel(
                    "First"
                  )
                  .setStyle(
                    ButtonStyle.Secondary
                  )
                  .setDisabled(
                    currentPage ===
                      0
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "message_prev"
                  )
                  .setLabel(
                    "Previous"
                  )
                  .setStyle(
                    ButtonStyle.Secondary
                  )
                  .setDisabled(
                    currentPage ===
                      0
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "message_close"
                  )
                  .setLabel(
                    "Close"
                  )
                  .setStyle(
                    ButtonStyle.Danger
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "message_next"
                  )
                  .setLabel(
                    "Next"
                  )
                  .setStyle(
                    ButtonStyle.Secondary
                  )
                  .setDisabled(
                    currentPage >=
                      totalPages -
                        1
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "message_last"
                  )
                  .setLabel(
                    "Last"
                  )
                  .setStyle(
                    ButtonStyle.Secondary
                  )
                  .setDisabled(
                    currentPage >=
                      totalPages -
                        1
                  )
              )
          );
        }

        return bannerPayload(
          client,
          buffer,
          "message-stats.png",
          components
        );
      };

    // ========================================================
    // FIRST RESPONSE
    // ========================================================

    const sent =
      await message.reply(
        buildResponse(
          page
        )
      );

    if (
      totalPages <= 1
    ) {
      return;
    }

    // ========================================================
    // PAGINATION
    // ========================================================

    const collector =
      sent.createMessageComponentCollector({
        time:
          COLLECTOR_TIME,

        filter:
          interaction => {
            if (
              interaction.user.id ===
              message.author.id
            ) {
              return true;
            }

            const buffer =
              createSimpleBanner({
                title:
                  "ACCESS DENIED",

                subtitle:
                  "This statistics panel belongs to another user.",

                rows: [
                  {
                    label:
                      "Panel Owner",
                    value:
                      message.author.username,
                  },
                  {
                    label:
                      "Your Account",
                    value:
                      interaction.user.username,
                  },
                  {
                    label:
                      "Status",
                    value:
                      "INTERACTION REJECTED",
                  },
                ],
              });

            interaction
              .reply({
                ...bannerPayload(
                  client,
                  buffer,
                  "message-access.png"
                ),
                ephemeral:
                  true,
              })
              .catch(
                () => {}
              );

            return false;
          },
      });

    collector.on(
      "collect",
      async interaction => {
        try {
          switch (
            interaction.customId
          ) {
            case "message_first":
              page = 0;
              break;

            case "message_prev":
              page =
                Math.max(
                  0,
                  page - 1
                );
              break;

            case "message_next":
              page =
                Math.min(
                  totalPages - 1,
                  page + 1
                );
              break;

            case "message_last":
              page =
                totalPages - 1;
              break;

            case "message_close":
              collector.stop(
                "closed"
              );

              await interaction
                .update({
                  components: [],
                })
                .catch(
                  () => {}
                );

              return;

            default:
              return;
          }

          // Refresh live stats
          const freshStats =
            getGuildStats(
              guild.id,
              period
            );

          stats.total =
            freshStats.total;

          stats.users =
            freshStats.users;

          const freshTotalPages =
            Math.max(
              1,
              Math.ceil(
                stats.users.length /
                  PER_PAGE
              )
            );

          if (
            page >=
            freshTotalPages
          ) {
            page =
              freshTotalPages -
              1;
          }

          const buffer =
            createStatsBanner({
              title:
                "MESSAGE STATS",

              subtitle:
                guild.name,

              period,

              guildName:
                guild.name,

              total:
                stats.total,

              users:
                stats.users.slice(
                  page *
                    PER_PAGE,

                  page *
                    PER_PAGE +
                    PER_PAGE
                ),

              page,

              totalPages:
                freshTotalPages,
            });

          const components =
            freshTotalPages >
            1
              ? [
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId(
                          "message_first"
                        )
                        .setLabel(
                          "First"
                        )
                        .setStyle(
                          ButtonStyle.Secondary
                        )
                        .setDisabled(
                          page ===
                            0
                        ),

                      new ButtonBuilder()
                        .setCustomId(
                          "message_prev"
                        )
                        .setLabel(
                          "Previous"
                        )
                        .setStyle(
                          ButtonStyle.Secondary
                        )
                        .setDisabled(
                          page ===
                            0
                        ),

                      new ButtonBuilder()
                        .setCustomId(
                          "message_close"
                        )
                        .setLabel(
                          "Close"
                        )
                        .setStyle(
                          ButtonStyle.Danger
                        ),

                      new ButtonBuilder()
                        .setCustomId(
                          "message_next"
                        )
                        .setLabel(
                          "Next"
                        )
                        .setStyle(
                          ButtonStyle.Secondary
                        )
                        .setDisabled(
                          page >=
                            freshTotalPages -
                              1
                        ),

                      new ButtonBuilder()
                        .setCustomId(
                          "message_last"
                        )
                        .setLabel(
                          "Last"
                        )
                        .setStyle(
                          ButtonStyle.Secondary
                        )
                        .setDisabled(
                          page >=
                            freshTotalPages -
                              1
                        )
                    ),
                ]
              : [];

          await interaction.update(
            bannerPayload(
              client,
              buffer,
              "message-stats.png",
              components
            )
          );
        } catch (error) {
          console.error(
            "[message pagination]",
            error
          );

          if (
            !interaction.replied &&
            !interaction.deferred
          ) {
            await interaction
              .reply({
                content:
                  "Unable to update message statistics.",
                ephemeral:
                  true,
              })
              .catch(
                () => {}
              );
          }
        }
      }
    );

    // ========================================================
    // COLLECTOR END
    // ========================================================

    collector.on(
      "end",
      (_, reason) => {
        if (
          reason !==
          "closed"
        ) {
          sent
            .edit({
              components: [],
            })
            .catch(
              () => {}
            );
        }
      }
    );
  },

  // ==========================================================
  // EXPORT FOR messageCreate.js
  // ==========================================================

  recordMessage,
};