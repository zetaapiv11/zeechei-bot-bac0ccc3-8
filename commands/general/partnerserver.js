// commands/general/partnerserver.js

const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const config = require("../../config");
const Database = require("../../database/Database");
const { V2Builder } = require("../../utils/V2Builder");

const CYAN = "#00E5FF";
const DARK = "#03080A";
const PANEL = "#071115";
const MUTED = "#78AAB2";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "zeechei-partners.json");

const MENU_PREFIX = "partnerserver_select:";
const MAX_MENU_OPTIONS = 25;

// ============================================================
// OWNER CHECK
// ============================================================

function isOwner(userId) {
  try {
    if (
      Array.isArray(config.ownerIds) &&
      config.ownerIds.includes(userId)
    ) {
      return true;
    }

    if (
      config.ownerId &&
      config.ownerId === userId
    ) {
      return true;
    }

    if (
      config.mainOwnerId &&
      config.mainOwnerId === userId
    ) {
      return true;
    }

    if (
      typeof Database?.isOwner === "function" &&
      Database.isOwner(userId)
    ) {
      return true;
    }
  } catch {}

  return false;
}

// ============================================================
// FILE DATABASE
// ============================================================

function ensureDataFile() {
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
          version: 1,
          partners: {},
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function loadData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object") {
      return {
        version: 1,
        partners: {},
      };
    }

    if (
      !data.partners ||
      typeof data.partners !== "object"
    ) {
      data.partners = {};
    }

    return data;
  } catch (error) {
    console.error(
      "[PartnerServer] Failed to read database:",
      error
    );

    return {
      version: 1,
      partners: {},
    };
  }
}

function saveData(data) {
  ensureDataFile();

  const tempFile = `${DATA_FILE}.tmp`;

  try {
    fs.writeFileSync(
      tempFile,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(
      tempFile,
      DATA_FILE
    );
  } catch (error) {
    console.error(
      "[PartnerServer] Failed to save database:",
      error
    );

    try {
      fs.unlinkSync(tempFile);
    } catch {}
  }
}

// ============================================================
// CLEAN / NORMALIZE
// ============================================================

function cleanupExpired() {
  const data = loadData();
  const now = Date.now();

  let changed = false;

  for (const [guildId, partner] of Object.entries(data.partners)) {
    if (!partner || typeof partner !== "object") {
      delete data.partners[guildId];
      changed = true;
      continue;
    }

    if (
      partner.type === "temporary" &&
      partner.expiresAt &&
      Number(partner.expiresAt) <= now
    ) {
      delete data.partners[guildId];
      changed = true;

      console.log(
        `[PartnerServer] Temporary partnership expired: ${guildId}`
      );
    }
  }

  if (changed) {
    saveData(data);
  }

  return data;
}

function getPartners() {
  const data = cleanupExpired();

  return Object.values(data.partners || {});
}

// ============================================================
// DURATION
// ============================================================

function parseDuration(input) {
  if (!input) return null;

  const value = String(input)
    .trim()
    .toLowerCase();

  if (/^\d+$/.test(value)) {
    const minutes = Number(value);

    if (
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      return null;
    }

    return minutes * 60 * 1000;
  }

  const match = value.match(
    /^(\d+(?:\.\d+)?)(s|m|h|d|w|mo)$/
  );

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    mo: 30 * 24 * 60 * 60 * 1000,
  };

  if (!multipliers[unit]) {
    return null;
  }

  return amount * multipliers[unit];
}

function formatDuration(ms) {
  if (!ms || ms <= 0) {
    return "Expired";
  }

  let seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  if (!parts.length) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function discordTime(timestamp) {
  if (!timestamp) {
    return "N/A";
  }

  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

// ============================================================
// SAFE TEXT
// ============================================================

function safeText(value, fallback = "Unknown") {
  const text = String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();

  return text.slice(0, 100) || fallback;
}

// ============================================================
// GUILD RESOLVER
// ============================================================

async function resolveGuild(client, guildId) {
  if (!guildId) {
    return null;
  }

  let guild = client.guilds.cache.get(guildId);

  if (guild) {
    return guild;
  }

  try {
    guild = await client.guilds.fetch(guildId);
    return guild;
  } catch {
    return null;
  }
}

// ============================================================
// BANNER GENERATOR
// ============================================================

function createPartnerBanner({
  title,
  subtitle,
  lines = [],
  footer = "ZEECHEI • PARTNERSHIP NETWORK",
  width = 1200,
  height = 650,
}) {
  const canvas = createCanvas(
    width,
    height
  );

  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = DARK;
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // Cyan glow
  const glow = ctx.createRadialGradient(
    width / 2,
    0,
    10,
    width / 2,
    0,
    width * 0.75
  );

  glow.addColorStop(
    0,
    "rgba(0,229,255,0.20)"
  );

  glow.addColorStop(
    0.45,
    "rgba(0,229,255,0.06)"
  );

  glow.addColorStop(
    1,
    "rgba(0,229,255,0)"
  );

  ctx.fillStyle = glow;
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // Main panel
  ctx.fillStyle = PANEL;
  ctx.fillRect(
    25,
    25,
    width - 50,
    height - 50
  );

  // Outer cyan border
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;

  ctx.strokeRect(
    25,
    25,
    width - 50,
    height - 50
  );

  // Inner border
  ctx.strokeStyle =
    "rgba(0,229,255,0.20)";

  ctx.lineWidth = 1;

  ctx.strokeRect(
    48,
    48,
    width - 96,
    height - 96
  );

  // Top cyan bar
  ctx.fillStyle = CYAN;

  ctx.fillRect(
    25,
    25,
    width - 50,
    7
  );

  // Status orb
  ctx.beginPath();

  ctx.arc(
    78,
    84,
    8,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = CYAN;
  ctx.fill();

  // Title
  ctx.font = "bold 42px Arial";
  ctx.fillStyle = "#FFFFFF";

  ctx.fillText(
    safeText(title, "PARTNERSHIP"),
    105,
    97
  );

  // Subtitle
  if (subtitle) {
    ctx.font = "20px Arial";
    ctx.fillStyle = MUTED;

    ctx.fillText(
      safeText(subtitle),
      105,
      130
    );
  }

  // Divider
  ctx.strokeStyle =
    "rgba(0,229,255,0.25)";

  ctx.beginPath();

  ctx.moveTo(
    70,
    160
  );

  ctx.lineTo(
    width - 70,
    160
  );

  ctx.stroke();

  // Content
  let y = 205;

  for (const line of lines) {
    if (y > height - 105) {
      break;
    }

    // Plain text line
    if (typeof line === "string") {
      ctx.font = "bold 21px Arial";
      ctx.fillStyle = "#FFFFFF";

      ctx.fillText(
        safeText(line),
        75,
        y
      );

      y += 43;
      continue;
    }

    // Cyan bullet
    ctx.beginPath();

    ctx.arc(
      82,
      y - 7,
      4,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = CYAN;
    ctx.fill();

    // Label
    ctx.font = "bold 19px Arial";
    ctx.fillStyle = CYAN;

    ctx.fillText(
      safeText(line.label, "Info"),
      105,
      y
    );

    // Value
    ctx.font = "19px Arial";
    ctx.fillStyle = "#D9F9FC";

    ctx.fillText(
      safeText(line.value, "N/A"),
      360,
      y
    );

    y += 42;
  }

  // Footer divider
  ctx.strokeStyle =
    "rgba(0,229,255,0.18)";

  ctx.beginPath();

  ctx.moveTo(
    70,
    height - 82
  );

  ctx.lineTo(
    width - 70,
    height - 82
  );

  ctx.stroke();

  // Footer
  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#4C8B94";

  ctx.fillText(
    safeText(footer),
    75,
    height - 50
  );

  return canvas.toBuffer("image/png");
}

// ============================================================
// V2 BANNER RESPONSE
// ============================================================

function bannerResponse({
  title,
  subtitle,
  lines,
  footer,
  height,
  components = [],
}) {
  const buffer = createPartnerBanner({
    title,
    subtitle,
    lines,
    footer,
    height,
  });

  const attachment = new AttachmentBuilder(
    buffer,
    {
      name: "zeechei-partnership.png",
    }
  );

  const builder = new V2Builder(CYAN)
    .media(
      "attachment://zeechei-partnership.png"
    );

  const payload = builder.build([
    attachment,
  ]);

  payload.components = [
    ...(payload.components || []),
    ...components,
  ];

  payload.flags =
    MessageFlags.IsComponentsV2;

  return payload;
}

// ============================================================
// PARTNER DROPDOWN
// ============================================================

async function createPartnerDropdown(client) {
  const partners = getPartners();

  if (!partners.length) {
    return null;
  }

  const options = [];

  for (
    const partner of partners.slice(
      0,
      MAX_MENU_OPTIONS
    )
  ) {
    const guild = await resolveGuild(
      client,
      partner.guildId
    );

    const guildName =
      guild?.name ||
      `Unknown Server ${partner.guildId.slice(-5)}`;

    let description =
      "Permanent partnership";

    if (
      partner.type === "temporary"
    ) {
      description =
        `Temporary • ${formatDuration(
          partner.expiresAt - Date.now()
        )} left`;
    }

    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(
          safeText(
            guildName,
            "Partner Server"
          ).slice(0, 100)
        )
        .setValue(
          partner.guildId
        )
        .setDescription(
          description.slice(0, 100)
        )
    );
  }

  if (!options.length) {
    return null;
  }

  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          `${MENU_PREFIX}${Date.now()}`
        )
        .setPlaceholder(
          "Select a partnered server"
        )
        .addOptions(
          options
        )
    );
}

// ============================================================
// DASHBOARD
// ============================================================

async function sendDashboard(
  client,
  message
) {
  const partners = getPartners();

  const permanent = partners.filter(
    p => p.type === "permanent"
  ).length;

  const temporary = partners.filter(
    p => p.type === "temporary"
  ).length;

  let totalMembers = 0;

  for (const partner of partners) {
    const guild =
      client.guilds.cache.get(
        partner.guildId
      );

    totalMembers +=
      Number(guild?.memberCount) || 0;
  }

  const dropdown =
    await createPartnerDropdown(
      client
    );

  const components = [];

  if (dropdown) {
    components.push(dropdown);
  }

  components.push(
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "partnerserver_refresh"
          )
          .setLabel(
            "Refresh"
          )
          .setStyle(
            ButtonStyle.Secondary
          )
      )
  );

  const response = bannerResponse({
    title:
      "PARTNERSHIP NETWORK",

    subtitle:
      "Zeechei partnered-server control center",

    lines: [
      {
        label:
          "Total Partners",
        value:
          String(
            partners.length
          ),
      },

      {
        label:
          "Permanent",
        value:
          String(
            permanent
          ),
      },

      {
        label:
          "Temporary",
        value:
          String(
            temporary
          ),
      },

      {
        label:
          "Network Members",
        value:
          totalMembers.toLocaleString(),
      },

      {
        label:
          "Dashboard",
        value:
          dropdown
            ? "Select a server below"
            : "No partnered servers",
      },
    ],

    footer:
      "ZEECHEI • PARTNERSHIP COMMAND CENTER",

    height:
      610,

    components,
  });

  const sent =
    await message.reply(
      response
    );

  const collector =
    sent.createMessageComponentCollector({
      time:
        10 * 60 * 1000,
    });

  collector.on(
    "collect",
    async interaction => {
      await handleInteraction(
        client,
        interaction,
        message.author.id
      );
    }
  );

  return sent;
}

// ============================================================
// SERVER STATS
// ============================================================

async function getServerStats(
  client,
  guildId
) {
  const data =
    cleanupExpired();

  const partner =
    data.partners[guildId];

  if (!partner) {
    return {
      title:
        "PARTNER NOT FOUND",

      subtitle:
        "This server is not currently partnered",

      lines: [
        {
          label:
            "Server ID",
          value:
            guildId,
        },

        {
          label:
            "Status",
          value:
            "NOT PARTNERED",
        },
      ],

      height:
        430,
    };
  }

  const guild =
    await resolveGuild(
      client,
      guildId
    );

  if (!guild) {
    return {
      title:
        "SERVER UNAVAILABLE",

      subtitle:
        "Zeechei cannot currently access this server",

      lines: [
        {
          label:
            "Server ID",
          value:
            guildId,
        },

        {
          label:
            "Partnership",
          value:
            partner.type === "temporary"
              ? "Temporary"
              : "Permanent",
        },

        {
          label:
            "Discord Access",
          value:
            "Unavailable",
        },
      ],

      height:
        470,
    };
  }

  let owner = null;

  if (guild.ownerId) {
    owner =
      await client.users
        .fetch(guild.ownerId)
        .catch(() => null);
  }

  const partnership =
    partner.type === "temporary"
      ? `Temporary • ${discordTime(
          partner.expiresAt
        )}`
      : "Permanent";

  return {
    title:
      "PARTNER SERVER",

    subtitle:
      safeText(
        guild.name,
        "Partner Server"
      ),

    lines: [
      {
        label:
          "Status",
        value:
          "ACTIVE PARTNER",
      },

      {
        label:
          "Partnership",
        value:
          partnership,
      },

      {
        label:
          "Server ID",
        value:
          guild.id,
      },

      {
        label:
          "Owner",
        value:
          owner?.tag ||
          guild.ownerId ||
          "Unknown",
      },

      {
        label:
          "Members",
        value:
          (
            Number(
              guild.memberCount
            ) || 0
          ).toLocaleString(),
      },

      {
        label:
          "Channels",
        value:
          (
            guild.channels?.cache?.size ||
            0
          ).toLocaleString(),
      },

      {
        label:
          "Roles",
        value:
          (
            guild.roles?.cache?.size ||
            0
          ).toLocaleString(),
      },

      {
        label:
          "Boosts",
        value:
          (
            Number(
              guild.premiumSubscriptionCount
            ) || 0
          ).toLocaleString(),
      },

      {
        label:
          "Created",
        value:
          guild.createdTimestamp
            ? `<t:${Math.floor(
                guild.createdTimestamp / 1000
              )}:D>`
            : "Unknown",
      },

      {
        label:
          "Partner Since",
        value:
          discordTime(
            partner.addedAt
          ),
      },
    ],

    height:
      650,
  };
}

// ============================================================
// ADD PARTNER
// ============================================================

async function addPartner(
  client,
  message,
  serverId
) {
  const data =
    cleanupExpired();

  const guildId =
    String(serverId || "")
      .replace(/[<@&#!>]/g, "")
      .trim();

  if (
    !/^\d{17,20}$/.test(
      guildId
    )
  ) {
    return message.reply(
      bannerResponse({
        title:
          "INVALID SERVER ID",

        subtitle:
          "A valid Discord server ID is required",

        lines: [
          {
            label:
              "Usage",
            value:
              "+partnerserver add <serverId>",
          },

          {
            label:
              "Example",
            value:
              "+partnerserver add 123456789012345678",
          },
        ],

        footer:
          "ZEECHEI • PARTNERSHIP SYSTEM",

        height:
          440,
      })
    );
  }

  if (
    data.partners[guildId]
  ) {
    const existing =
      data.partners[guildId];

    return message.reply(
      bannerResponse({
        title:
          "ALREADY PARTNERED",

        subtitle:
          "This server already exists in the network",

        lines: [
          {
            label:
              "Server ID",
            value:
              guildId,
          },

          {
            label:
              "Type",
            value:
              existing.type ===
              "temporary"
                ? "Temporary"
                : "Permanent",
          },

          {
            label:
              "Expires",
            value:
              existing.expiresAt
                ? discordTime(
                    existing.expiresAt
                  )
                : "Never",
          },
        ],

        footer:
          "ZEECHEI • PARTNERSHIP SYSTEM",

        height:
          460,
      })
    );
  }

  const guild =
    await resolveGuild(
      client,
      guildId
    );

  if (!guild) {
    return message.reply(
      bannerResponse({
        title:
          "SERVER NOT FOUND",

        subtitle:
          "Zeechei cannot access the target server",

        lines: [
          {
            label:
              "Server ID",
            value:
              guildId,
          },

          {
            label:
              "Requirement",
            value:
              "Zeechei must be in the server",
          },

          {
            label:
              "Status",
            value:
              "PARTNERSHIP NOT ADDED",
          },
        ],

        footer:
          "ZEECHEI • PARTNERSHIP SYSTEM",

        height:
          450,
      })
    );
  }

  data.partners[guildId] = {
    guildId,
    type: "permanent",
    addedAt: Date.now(),
    addedBy: message.author.id,
    expiresAt: null,
  };

  saveData(data);

  return message.reply(
    bannerResponse({
      title:
        "PARTNER ADDED",

      subtitle:
        `${safeText(
          guild.name
        )} is now part of Zeechei's network`,

      lines: [
        {
          label:
            "Server",
          value:
            guild.name,
        },

        {
          label:
            "Server ID",
          value:
            guild.id,
        },

        {
          label:
            "Members",
          value:
            (
              Number(
                guild.memberCount
              ) || 0
            ).toLocaleString(),
        },

        {
          label:
            "Partnership",
          value:
            "Permanent",
        },

        {
          label:
            "Added By",
          value:
            message.author.username,
        },

        {
          label:
            "Status",
          value:
            "ACTIVE",
        },
      ],

      footer:
        "ZEECHEI • PARTNERSHIP ADDED",

      height:
        570,
    })
  );
}

// ============================================================
// REMOVE PARTNER
// ============================================================

async function removePartner(
  client,
  message,
  serverId
) {
  const data =
    cleanupExpired();

  const guildId =
    String(serverId || "")
      .replace(/[<@&#!>]/g, "")
      .trim();

  if (
    !/^\d{17,20}$/.test(
      guildId
    )
  ) {
    return message.reply(
      bannerResponse({
        title:
          "INVALID SERVER ID",

        subtitle:
          "Provide a valid server ID",

        lines: [
          {
            label:
              "Usage",
            value:
              "+partnerserver remove <serverId>",
          },
        ],

        height:
          410,
      })
    );
  }

  const partner =
    data.partners[guildId];

  if (!partner) {
    return message.reply(
      bannerResponse({
        title:
          "NOT PARTNERED",

        subtitle:
          "No partnership exists for this server",

        lines: [
          {
            label:
              "Server ID",
            value:
              guildId,
          },

          {
            label:
              "Status",
            value:
              "NO PARTNERSHIP FOUND",
          },
        ],

        height:
          430,
      })
    );
  }

  const guild =
    await resolveGuild(
      client,
      guildId
    );

  delete data.partners[guildId];

  saveData(data);

  return message.reply(
    bannerResponse({
      title:
        "PARTNER REMOVED",

      subtitle:
        guild
          ? `${safeText(
              guild.name
            )} has been removed`
          : "Partnership removed successfully",

      lines: [
        {
          label:
            "Server ID",
          value:
            guildId,
        },

        {
          label:
            "Previous Type",
          value:
            partner.type ===
            "temporary"
              ? "Temporary"
              : "Permanent",
        },

        {
          label:
            "Status",
          value:
            "REMOVED",
        },

        {
          label:
            "Action By",
          value:
            message.author.username,
        },
      ],

      footer:
        "ZEECHEI • PARTNERSHIP REMOVED",

      height:
        480,
    })
  );
}

// ============================================================
// ADD TEMP
// ============================================================

async function addTempPartner(
  client,
  message,
  serverId,
  durationInput
) {
  const data =
    cleanupExpired();

  const guildId =
    String(serverId || "")
      .replace(/[<@&#!>]/g, "")
      .trim();

  if (
    !/^\d{17,20}$/.test(
      guildId
    )
  ) {
    return message.reply(
      bannerResponse({
        title:
          "INVALID SERVER ID",

        subtitle:
          "A valid Discord server ID is required",

        lines: [
          {
            label:
              "Usage",
            value:
              "+partnerserver addtemp <serverId> <duration>",
          },

          {
            label:
              "Durations",
            value:
              "10m • 2h • 7d • 2w • 1mo",
          },
        ],

        height:
          450,
      })
    );
  }

  const duration =
    parseDuration(
      durationInput
    );

  if (!duration) {
    return message.reply(
      bannerResponse({
        title:
          "INVALID DURATION",

        subtitle:
          "Use a valid temporary partnership duration",

        lines: [
          {
            label:
              "Examples",
            value:
              "10m • 2h • 7d • 2w • 1mo",
          },

          {
            label:
              "Number",
            value:
              "60 = 60 minutes",
          },
        ],

        height:
          430,
      })
    );
  }

  const guild =
    await resolveGuild(
      client,
      guildId
    );

  if (!guild) {
    return message.reply(
      bannerResponse({
        title:
          "SERVER NOT FOUND",

        subtitle:
          "Zeechei cannot access the target server",

        lines: [
          {
            label:
              "Server ID",
            value:
              guildId,
          },

          {
            label:
              "Status",
            value:
              "TEMPORARY PARTNERSHIP NOT CREATED",
          },
        ],

        height:
          430,
      })
    );
  }

  const expiresAt =
    Date.now() +
    duration;

  data.partners[guildId] = {
    guildId,
    type: "temporary",
    addedAt: Date.now(),
    addedBy: message.author.id,
    expiresAt,
  };

  saveData(data);

  return message.reply(
    bannerResponse({
      title:
        "TEMPORARY PARTNER ADDED",

      subtitle:
        `${safeText(
          guild.name
        )} has temporary partnership access`,

      lines: [
        {
          label:
            "Server",
          value:
            guild.name,
        },

        {
          label:
            "Server ID",
          value:
            guild.id,
        },

        {
          label:
            "Members",
          value:
            (
              Number(
                guild.memberCount
              ) || 0
            ).toLocaleString(),
        },

        {
          label:
            "Duration",
          value:
            formatDuration(
              duration
            ),
        },

        {
          label:
            "Expires",
          value:
            discordTime(
              expiresAt
            ),
        },

        {
          label:
            "Added By",
          value:
            message.author.username,
        },
      ],

      footer:
        "ZEECHEI • TEMPORARY PARTNERSHIP",

      height:
        570,
    })
  );
}

// ============================================================
// REMOVE TEMP
// ============================================================

async function removeTempPartner(
  client,
  message,
  serverId
) {
  const data =
    cleanupExpired();

  const guildId =
    String(serverId || "")
      .replace(/[<@&#!>]/g, "")
      .trim();

  if (
    !/^\d{17,20}$/.test(
      guildId
    )
  ) {
    return message.reply(
      bannerResponse({
        title:
          "INVALID SERVER ID",

        subtitle:
          "Provide a valid server ID",

        lines: [
          {
            label:
              "Usage",
            value:
              "+partnerserver removetemp <serverId>",
          },
        ],

        height:
          420,
      })
    );
  }

  const partner =
    data.partners[guildId];

  if (!partner) {
    return message.reply(
      bannerResponse({
        title:
          "PARTNER NOT FOUND",

        subtitle:
          "No partnership exists for this server",

        lines: [
          {
            label:
              "Server ID",
            value:
              guildId,
          },

          {
            label:
              "Status",
            value:
              "NOT PARTNERED",
          },
        ],

        height:
          430,
      })
    );
  }

  if (
    partner.type !==
    "temporary"
  ) {
    return message.reply(
      bannerResponse({
        title:
          "NOT A TEMPORARY PARTNER",

        subtitle:
          "This server has permanent partnership",

        lines: [
          {
            label:
              "Server ID",
            value:
              guildId,
          },

          {
            label:
              "Partnership",
            value:
              "Permanent",
          },

          {
            label:
              "Action",
            value:
              "Use remove instead",
          },
        ],

        height:
          450,
      })
    );
  }

  const guild =
    await resolveGuild(
      client,
      guildId
    );

  delete data.partners[guildId];

  saveData(data);

  return message.reply(
    bannerResponse({
      title:
        "TEMPORARY PARTNER REMOVED",

      subtitle:
        guild
          ? `${safeText(
              guild.name
            )} is no longer temporarily partnered`
          : "Temporary partnership removed",

      lines: [
        {
          label:
            "Server ID",
          value:
            guildId,
        },

        {
          label:
            "Previous Expiry",
          value:
            partner.expiresAt
              ? discordTime(
                  partner.expiresAt
                )
              : "Unknown",
        },

        {
          label:
            "Status",
          value:
            "REMOVED",
        },

        {
          label:
            "Action By",
          value:
            message.author.username,
        },
      ],

      footer:
        "ZEECHEI • TEMPORARY PARTNERSHIP REMOVED",

      height:
        500,
    })
  );
}

// ============================================================
// INTERACTIONS
// ============================================================

async function handleInteraction(
  client,
  interaction,
  ownerId
) {
  if (
    !interaction.isStringSelectMenu() &&
    !interaction.isButton()
  ) {
    return false;
  }

  if (
    !(
      interaction.customId?.startsWith(
        MENU_PREFIX
      ) ||
      interaction.customId ===
        "partnerserver_refresh"
    )
  ) {
    return false;
  }

  if (
    interaction.user.id !==
    ownerId
  ) {
    await interaction.reply({
      ...bannerResponse({
        title:
          "ACCESS DENIED",

        subtitle:
          "This dashboard can only be controlled by its owner",

        lines: [
          {
            label:
              "Access",
            value:
              "OWNER ONLY",
          },

          {
            label:
              "Status",
            value:
              "INTERACTION REJECTED",
          },
        ],

        height:
          420,
      }),

      ephemeral: true,
    }).catch(() => {});

    return true;
  }

  // ----------------------------------------------------------
  // REFRESH
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "partnerserver_refresh"
  ) {
    const partners =
      getPartners();

    const permanent =
      partners.filter(
        p =>
          p.type ===
          "permanent"
      ).length;

    const temporary =
      partners.filter(
        p =>
          p.type ===
          "temporary"
      ).length;

    let totalMembers = 0;

    for (const partner of partners) {
      const guild =
        client.guilds.cache.get(
          partner.guildId
        );

      totalMembers +=
        Number(
          guild?.memberCount
        ) || 0;
    }

    const dropdown =
      await createPartnerDropdown(
        client
      );

    const components = [];

    if (dropdown) {
      components.push(
        dropdown
      );
    }

    components.push(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "partnerserver_refresh"
            )
            .setLabel(
              "Refresh"
            )
            .setStyle(
              ButtonStyle.Secondary
            )
        )
    );

    await interaction.update(
      bannerResponse({
        title:
          "PARTNERSHIP NETWORK",

        subtitle:
          "Live partnership dashboard",

        lines: [
          {
            label:
              "Total Partners",
            value:
              String(
                partners.length
              ),
          },

          {
            label:
              "Permanent",
            value:
              String(
                permanent
              ),
          },

          {
            label:
              "Temporary",
            value:
              String(
                temporary
              ),
          },

          {
            label:
              "Network Members",
            value:
              totalMembers.toLocaleString(),
          },

          {
            label:
              "Status",
            value:
              "LIVE",
          },
        ],

        footer:
          "ZEECHEI • PARTNERSHIP COMMAND CENTER",

        height:
          600,

        components,
      })
    ).catch(() => {});

    return true;
  }

  // ----------------------------------------------------------
  // DROPDOWN SERVER SELECT
  // ----------------------------------------------------------

  if (
    interaction.isStringSelectMenu()
  ) {
    const guildId =
      interaction.values?.[0];

    if (!guildId) {
      return true;
    }

    const stats =
      await getServerStats(
        client,
        guildId
      );

    const backButton =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "partnerserver_refresh"
            )
            .setLabel(
              "Back to Partners"
            )
            .setStyle(
              ButtonStyle.Secondary
            )
        );

    await interaction.update(
      bannerResponse({
        ...stats,

        footer:
          "ZEECHEI • PARTNER SERVER DETAILS",

        components: [
          backButton,
        ],
      })
    ).catch(() => {});

    return true;
  }

  return true;
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "partnerserver",

  aliases: [
    "partner",
    "partners",
    "ps",
  ],

  slashData:
    new SlashCommandBuilder()
      .setName(
        "partnerserver"
      )
      .setDescription(
        "View and manage Zeechei partnered servers"
      ),

  async execute({
    client,
    message,
    args,
  }) {
    try {
      // ========================================================
      // OWNER ONLY
      // ========================================================

      if (
        !isOwner(
          message.author.id
        )
      ) {
        return message.reply(
          bannerResponse({
            title:
              "ACCESS DENIED",

            subtitle:
              "Partner server management is owner-only",

            lines: [
              {
                label:
                  "Command",
                value:
                  "+partnerserver",
              },

              {
                label:
                  "Required",
                value:
                  "Zeechei Owner",
              },

              {
                label:
                  "Status",
                value:
                  "PERMISSION DENIED",
              },
            ],

            footer:
              "ZEECHEI • OWNER SYSTEM",

            height:
              450,
          })
        );
      }

      cleanupExpired();

      const sub =
        String(
          args?.[0] || ""
        )
          .toLowerCase()
          .trim();

      // ========================================================
      // DASHBOARD
      // ========================================================

      if (!sub) {
        return sendDashboard(
          client,
          message
        );
      }

      // ========================================================
      // ADD
      // ========================================================

      if (
        sub ===
        "add"
      ) {
        return addPartner(
          client,
          message,
          args?.[1]
        );
      }

      // ========================================================
      // REMOVE
      // ========================================================

      if (
        sub ===
        "remove"
      ) {
        return removePartner(
          client,
          message,
          args?.[1]
        );
      }

      // ========================================================
      // ADD TEMP
      // ========================================================

      if (
        sub ===
        "addtemp"
      ) {
        return addTempPartner(
          client,
          message,
          args?.[1],
          args?.[2]
        );
      }

      // ========================================================
      // REMOVE TEMP
      // ========================================================

      if (
        sub ===
        "removetemp"
      ) {
        return removeTempPartner(
          client,
          message,
          args?.[1]
        );
      }

      // ========================================================
      // HELP
      // ========================================================

      return message.reply(
        bannerResponse({
          title:
            "PARTNERSERVER",

          subtitle:
            "Zeechei Partnership Command Center",

          lines: [
            {
              label:
                "Dashboard",
              value:
                "+partnerserver",
            },

            {
              label:
                "Add",
              value:
                "+partnerserver add <serverId>",
            },

            {
              label:
                "Remove",
              value:
                "+partnerserver remove <serverId>",
            },

            {
              label:
                "Add Temporary",
              value:
                "+partnerserver addtemp <serverId> <duration>",
            },

            {
              label:
                "Remove Temporary",
              value:
                "+partnerserver removetemp <serverId>",
            },

            {
              label:
                "Duration",
              value:
                "10m • 2h • 7d • 2w • 1mo",
            },
          ],

          footer:
            "ZEECHEI • PARTNERSHIP COMMAND CENTER",

          height:
            590,
        })
      );
    } catch (error) {
      console.error(
        "[PartnerServer] Command Error:",
        error
      );

      return message.reply(
        bannerResponse({
          title:
            "COMMAND ERROR",

          subtitle:
            "Zeechei Partnership System encountered an error",

          lines: [
            {
              label:
                "Error",
              value:
                safeText(
                  error?.message,
                  "Unknown error"
                ),
            },

            {
              label:
                "Status",
              value:
                "REQUEST FAILED",
            },
          ],

          footer:
            "ZEECHEI • ERROR SYSTEM",

          height:
            430,
        })
      ).catch(() => {});
    }
  },
};