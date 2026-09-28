const {
  SlashCommandBuilder,
  AttachmentBuilder,
} = require("discord.js");

const {
  createCanvas,
  loadImage,
} = require("@napi-rs/canvas");

const path = require("path");

// ============================================================
// CONFIG
// commands/general/team.js
// ../../config = project root config.js
// ============================================================

let config = {};

try {
  config = require("../../config");
} catch (error) {
  console.error(
    "[TEAM] Unable to load ../../config:",
    error.message
  );

  config = {};
}

// ============================================================
// CANVAS CONFIG
// ============================================================

const WIDTH = 1400;

const MIN_HEIGHT = 760;

const COLORS = {
  background: "#020204",
  background2: "#07070B",

  card: "#08080D",
  panel: "#0B0B11",
  panel2: "#0F0F16",

  border: "#191923",
  borderSoft: "#22222D",

  primary: "#8B5CF6",
  primarySoft: "#A78BFA",

  cyan: "#22D3EE",

  text: "#F4F4F5",
  textSoft: "#B8B8C5",
  textMuted: "#666675",

  online: "#22C55E",
  offline: "#52525B",
};

// ============================================================
// TEAM CARD CONFIG
// ============================================================

const MEMBER_WIDTH = 270;
const MEMBER_HEIGHT = 315;

const MEMBER_GAP_X = 18;
const MEMBER_GAP_Y = 18;

const MEMBERS_PER_ROW = 4;

const MEMBER_START_X = 65;
const MEMBER_START_Y = 345;

// ============================================================
// CACHE
// ============================================================

const imageCache = new Map();

// ============================================================
// SAFE HELPERS
// ============================================================

function safe(value, fallback = "Unknown") {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return String(value)
    .replace(/@/g, "@\u200b")
    .replace(/\r?\n/g, " ")
    .trim();
}

function truncate(value, max) {
  const text = String(value || "");

  if (text.length <= max) {
    return text;
  }

  return text.slice(0, max - 1) + "…";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

// ============================================================
// ROUNDED RECTANGLE
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

  ctx.moveTo(
    x + radius,
    y
  );

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    radius
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    radius
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    radius
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    radius
  );

  ctx.closePath();
}

function fillRound(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  color
) {
  roundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
  );

  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRound(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  color,
  lineWidth = 1
) {
  roundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
  );

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// ============================================================
// TEXT
// ============================================================

function drawText(
  ctx,
  value,
  x,
  y,
  size,
  color = COLORS.text,
  weight = "500",
  align = "left"
) {
  ctx.font = `${weight} ${size}px Arial`;

  ctx.fillStyle = color;

  ctx.textAlign = align;

  ctx.textBaseline = "middle";

  ctx.fillText(
    String(value),
    x,
    y
  );
}

// ============================================================
// IMAGE LOADER
// ============================================================

async function loadCachedImage(url) {
  if (!url) {
    return null;
  }

  try {
    if (imageCache.has(url)) {
      return imageCache.get(url);
    }

    const image =
      await loadImage(url);

    imageCache.set(
      url,
      image
    );

    return image;
  } catch {
    return null;
  }
}

// ============================================================
// CONFIG VALUE RESOLVER
// ============================================================

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

// ============================================================
// TEAM CONFIG
//
// Supports multiple config structures:
//
// config.team
// config.teamInfo
// config.bot.team
//
// Team members:
//
// team.members
// team.staff
// team.developers
// team.owners
//
// ============================================================

function getTeamConfig() {
  const team =
    config.team ||
    config.teamInfo ||
    config.bot?.team ||
    {};

  const name =
    firstValue(
      team.name,
      team.title,
      config.teamName,
      config.developerName,
      "ZEECHEI DEVELOPMENT"
    );

  const description =
    firstValue(
      team.description,
      team.bio,
      config.teamDescription,
      "The people behind the bot."
    );

  const logo =
    firstValue(
      team.logo,
      team.logoURL,
      team.logoUrl,
      team.icon,
      team.iconURL,
      config.teamLogo,
      config.teamLogoURL
    );

  const banner =
    firstValue(
      team.banner,
      team.bannerURL,
      team.bannerUrl,
      config.teamBanner,
      config.teamBannerURL
    );

  return {
    ...team,
    name,
    description,
    logo,
    banner,
  };
}

// ============================================================
// GET MAIN OWNER
// ============================================================

function getMainOwnerId() {
  return firstValue(
    config.mainOwnerId,
    config.mainOwner,
    config.ownerId,
    config.owner
  );
}

// ============================================================
// GET OWNER IDS
// ============================================================

function getOwnerIds() {
  const result = [];

  const mainOwner =
    getMainOwnerId();

  if (mainOwner) {
    result.push(
      String(mainOwner)
    );
  }

  const owners =
    config.ownerIds ||
    config.owners ||
    config.teamOwners ||
    [];

  if (Array.isArray(owners)) {
    for (const id of owners) {
      if (id) {
        result.push(
          String(id)
        );
      }
    }
  }

  return [
    ...new Set(result),
  ];
}

// ============================================================
// NORMALIZE TEAM MEMBERS
// ============================================================

function getConfiguredMembers() {
  const team =
    getTeamConfig();

  let members =
    firstValue(
      team.members,
      team.staff,
      team.developers,
      team.devs,
      team.teamMembers
    );

  if (!members) {
    members = [];
  }

  // Array format
  if (Array.isArray(members)) {
    return members;
  }

  // Object format
  if (
    typeof members === "object"
  ) {
    return Object.entries(
      members
    ).map(
      ([id, data]) => {
        if (
          typeof data === "string"
        ) {
          return {
            id,
            role: data,
          };
        }

        return {
          id,
          ...(data || {}),
        };
      }
    );
  }

  return [];
}

// ============================================================
// ADD OWNERS AUTOMATICALLY
// ============================================================

function buildTeamMemberList() {
  const configured =
    getConfiguredMembers();

  const ownerIds =
    getOwnerIds();

  const result = [];

  for (
    const member of configured
  ) {
    if (
      typeof member === "string"
    ) {
      result.push({
        id: member,
        role: "Developer",
      });

      continue;
    }

    if (
      member &&
      typeof member === "object"
    ) {
      result.push({
        ...member,
      });
    }
  }

  // Automatically include owners
  for (
    const ownerId of ownerIds
  ) {
    const exists =
      result.some(
        member =>
          String(
            member.id ||
            member.userId ||
            member.discordId ||
            ""
          ) ===
          String(ownerId)
      );

    if (!exists) {
      result.unshift({
        id: ownerId,
        role:
          String(ownerId) ===
          String(getMainOwnerId())
            ? "Lead Developer"
            : "Owner",
        priority:
          String(ownerId) ===
          String(getMainOwnerId())
            ? 100
            : 90,
      });
    }
  }

  // Sort by priority
  result.sort(
    (a, b) =>
      Number(b.priority || 0) -
      Number(a.priority || 0)
  );

  return result;
}

// ============================================================
// RESOLVE DISCORD MEMBERS
// ============================================================

async function resolveTeamMembers(
  client
) {
  const configured =
    buildTeamMemberList();

  const resolved = [];

  for (
    const entry of configured
  ) {
    const id = firstValue(
      entry.id,
      entry.userId,
      entry.discordId
    );

    if (!id) {
      continue;
    }

    let user = null;

    try {
      user =
        await client.users.fetch(
          String(id)
        );
    } catch {
      user = null;
    }

    if (!user) {
      continue;
    }

    let role =
      firstValue(
        entry.role,
        entry.position,
        entry.title
      );

    const ownerIds =
      getOwnerIds();

    if (
      ownerIds.includes(
        String(id)
      )
    ) {
      if (
        String(id) ===
        String(getMainOwnerId())
      ) {
        role =
          firstValue(
            role,
            "Lead Developer"
          );
      } else {
        role =
          firstValue(
            role,
            "Owner"
          );
      }
    }

    resolved.push({
      id: String(id),
      user,
      role:
        role ||
        "Team Member",
      description:
        firstValue(
          entry.description,
          entry.bio,
          entry.about,
          ""
        ),
      priority:
        Number(
          entry.priority || 0
        ),
    });
  }

  return resolved;
}

// ============================================================
// DISCORD STATUS
// ============================================================

function getUserStatus(
  client,
  userId
) {
  try {
    const guilds =
      client.guilds.cache;

    for (
      const guild of guilds.values()
    ) {
      const member =
        guild.members.cache.get(
          String(userId)
        );

      if (
        member &&
        member.presence
      ) {
        return (
          member.presence.status ||
          "dnd"
        );
      }
    }
  } catch {}

  return "dnd";
}

// ============================================================
// STATUS COLOR
// ============================================================

function statusColor(status) {
  if (
    status === "online" ||
    status === "idle" ||
    status === "dnd"
  ) {
    return COLORS.online;
  }

  return COLORS.offline;
}

// ============================================================
// DRAW AVATAR
// ============================================================

async function drawAvatar(
  ctx,
  user,
  x,
  y,
  size
) {
  try {
    const url =
      user.displayAvatarURL({
        extension: "png",
        size: 256,
      });

    const image =
      await loadCachedImage(
        url
      );

    if (!image) {
      throw new Error(
        "Avatar unavailable"
      );
    }

    // Glow
    const glow =
      ctx.createRadialGradient(
        x + size / 2,
        y + size / 2,
        10,
        x + size / 2,
        y + size / 2,
        size
      );

    glow.addColorStop(
      0,
      "rgba(139,92,246,0.20)"
    );

    glow.addColorStop(
      1,
      "rgba(139,92,246,0)"
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
      x - 35,
      y - 35,
      size + 70,
      size + 70
    );

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      x + size / 2,
      y + size / 2,
      size / 2,
      0,
      Math.PI * 2
    );

    ctx.clip();

    ctx.drawImage(
      image,
      x,
      y,
      size,
      size
    );

    ctx.restore();

    ctx.beginPath();

    ctx.arc(
      x + size / 2,
      y + size / 2,
      size / 2 + 4,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      "#282431";

    ctx.lineWidth = 4;

    ctx.stroke();

  } catch {
    fillRound(
      ctx,
      x,
      y,
      size,
      size,
      30,
      COLORS.panel2
    );

    drawText(
      ctx,
      "A",
      x + size / 2,
      y + size / 2,
      48,
      COLORS.primarySoft,
      "900",
      "center"
    );
  }
}

// ============================================================
// DRAW TEAM LOGO
// ============================================================

async function drawTeamLogo(
  ctx,
  logo,
  x,
  y,
  size
) {
  if (!logo) {
    fillRound(
      ctx,
      x,
      y,
      size,
      size,
      24,
      COLORS.panel2
    );

    drawText(
      ctx,
      "A",
      x + size / 2,
      y + size / 2,
      46,
      COLORS.primarySoft,
      "900",
      "center"
    );

    return;
  }

  const image =
    await loadCachedImage(
      logo
    );

  if (!image) {
    fillRound(
      ctx,
      x,
      y,
      size,
      size,
      24,
      COLORS.panel2
    );

    drawText(
      ctx,
      "A",
      x + size / 2,
      y + size / 2,
      46,
      COLORS.primarySoft,
      "900",
      "center"
    );

    return;
  }

  ctx.save();

  roundedRect(
    ctx,
    x,
    y,
    size,
    size,
    24
  );

  ctx.clip();

  ctx.drawImage(
    image,
    x,
    y,
    size,
    size
  );

  ctx.restore();

  strokeRound(
    ctx,
    x,
    y,
    size,
    size,
    24,
    "#292431",
    2
  );
}

// ============================================================
// MEMBER CARD
// ============================================================

async function drawMemberCard(
  ctx,
  member,
  x,
  y,
  status
) {
  fillRound(
    ctx,
    x,
    y,
    MEMBER_WIDTH,
    MEMBER_HEIGHT,
    22,
    "#09090F"
  );

  strokeRound(
    ctx,
    x,
    y,
    MEMBER_WIDTH,
    MEMBER_HEIGHT,
    22,
    "#1A1A24",
    1
  );

  // Top accent
  fillRound(
    ctx,
    x,
    y,
    MEMBER_WIDTH,
    3,
    2,
    COLORS.primary
  );

  // Number
  drawText(
    ctx,
    String(member.index).padStart(
      2,
      "0"
    ),
    x + 22,
    y + 25,
    9,
    COLORS.textMuted,
    "800"
  );

  // Avatar
  const avatarSize = 108;

  await drawAvatar(
    ctx,
    member.user,
    x +
      MEMBER_WIDTH / 2 -
      avatarSize / 2,
    y + 48,
    avatarSize
  );

  // Status
  ctx.beginPath();

  ctx.arc(
    x +
      MEMBER_WIDTH / 2 +
      35,
    y + 135,
    8,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    statusColor(status);

  ctx.fill();

  ctx.strokeStyle =
    "#09090F";

  ctx.lineWidth = 4;

  ctx.stroke();

  // Name
  drawText(
    ctx,
    truncate(
      member.user.globalName ||
        member.user.username,
      19
    ),
    x +
      MEMBER_WIDTH / 2,
    y + 177,
    18,
    COLORS.text,
    "800",
    "center"
  );

  // Username
  drawText(
    ctx,
    `@${truncate(
      member.user.username,
      22
    )}`,
    x +
      MEMBER_WIDTH / 2,
    y + 201,
    10,
    COLORS.textMuted,
    "500",
    "center"
  );

  // Role badge
  fillRound(
    ctx,
    x + 45,
    y + 225,
    MEMBER_WIDTH - 90,
    31,
    15,
    "#101019"
  );

  drawText(
    ctx,
    truncate(
      member.role,
      22
    ),
    x +
      MEMBER_WIDTH / 2,
    y + 241,
    10,
    COLORS.primarySoft,
    "800",
    "center"
  );

  // Description
  drawText(
    ctx,
    truncate(
      member.description ||
        "Team member",
      30
    ),
    x +
      MEMBER_WIDTH / 2,
    y + 279,
    10,
    COLORS.textMuted,
    "500",
    "center"
  );

  // Status text
  drawText(
    ctx,
    status.toUpperCase(),
    x +
      MEMBER_WIDTH / 2,
    y + 300,
    7,
    statusColor(status),
    "800",
    "center"
  );
}

// ============================================================
// HEIGHT
// ============================================================

function calculateHeight(
  memberCount
) {
  const rows =
    Math.max(
      1,
      Math.ceil(
        memberCount /
          MEMBERS_PER_ROW
      )
    );

  const membersHeight =
    rows *
      MEMBER_HEIGHT +
    (rows - 1) *
      MEMBER_GAP_Y;

  return Math.max(
    MIN_HEIGHT,
    MEMBER_START_Y +
      membersHeight +
      90
  );
}

// ============================================================
// MAIN TEAM BANNER
// ============================================================

async function createTeamCard(
  client
) {
  const team =
    getTeamConfig();

  const members =
    await resolveTeamMembers(
      client
    );

  const HEIGHT =
    calculateHeight(
      members.length
    );

  const canvas =
    createCanvas(
      WIDTH,
      HEIGHT
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  // ==========================================================
  // BACKGROUND
  // ==========================================================

  const background =
    ctx.createLinearGradient(
      0,
      0,
      WIDTH,
      HEIGHT
    );

  background.addColorStop(
    0,
    "#020203"
  );

  background.addColorStop(
    0.45,
    "#050509"
  );

  background.addColorStop(
    1,
    "#09070D"
  );

  ctx.fillStyle =
    background;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // ==========================================================
  // AMBIENT GLOW
  // ==========================================================

  const glow =
    ctx.createRadialGradient(
      200,
      100,
      20,
      200,
      100,
      650
    );

  glow.addColorStop(
    0,
    "rgba(139,92,246,0.15)"
  );

  glow.addColorStop(
    0.45,
    "rgba(139,92,246,0.035)"
  );

  glow.addColorStop(
    1,
    "rgba(139,92,246,0)"
  );

  ctx.fillStyle =
    glow;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    600
  );

  // ==========================================================
  // MAIN CONTAINER
  // ==========================================================

  fillRound(
    ctx,
    25,
    25,
    WIDTH - 50,
    HEIGHT - 50,
    30,
    "#07070C"
  );

  strokeRound(
    ctx,
    25,
    25,
    WIDTH - 50,
    HEIGHT - 50,
    30,
    "#181820",
    2
  );

  // ==========================================================
  // TOP BANNER AREA
  // ==========================================================

  fillRound(
    ctx,
    45,
    45,
    WIDTH - 90,
    245,
    25,
    "#09090F"
  );

  // ==========================================================
  // OPTIONAL CONFIG BANNER
  // ==========================================================

  if (team.banner) {
    const banner =
      await loadCachedImage(
        team.banner
      );

    if (banner) {
      ctx.save();

      roundedRect(
        ctx,
        45,
        45,
        WIDTH - 90,
        245,
        25
      );

      ctx.clip();

      ctx.globalAlpha =
        0.20;

      ctx.drawImage(
        banner,
        45,
        45,
        WIDTH - 90,
        245
      );

      ctx.globalAlpha =
        1;

      ctx.restore();
    }
  }

  // Dark overlay
  fillRound(
    ctx,
    45,
    45,
    WIDTH - 90,
    245,
    25,
    "rgba(4,4,8,0.70)"
  );

  // ==========================================================
  // TEAM LOGO
  // ==========================================================

  await drawTeamLogo(
    ctx,
    team.logo,
    80,
    78,
    125
  );

  // ==========================================================
  // BRAND
  // ==========================================================

  drawText(
    ctx,
    "TEAM DIRECTORY",
    235,
    88,
    10,
    COLORS.primarySoft,
    "800"
  );

  drawText(
    ctx,
    truncate(
      team.name,
      34
    ),
    235,
    125,
    35,
    COLORS.text,
    "900"
  );

  drawText(
    ctx,
    truncate(
      team.description,
      75
    ),
    235,
    164,
    13,
    COLORS.textSoft,
    "500"
  );

  // ==========================================================
  // LIVE INDICATOR
  // ==========================================================

  ctx.beginPath();

  ctx.arc(
    241,
    205,
    6,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    COLORS.online;

  ctx.fill();

  drawText(
    ctx,
    "LIVE TEAM DATA",
    258,
    205,
    9,
    COLORS.textMuted,
    "800"
  );

  // ==========================================================
  // MEMBER COUNT
  // ==========================================================

  fillRound(
    ctx,
    WIDTH - 330,
    80,
    240,
    70,
    18,
    "#0D0D14"
  );

  strokeRound(
    ctx,
    WIDTH - 330,
    80,
    240,
    70,
    18,
    "#20202A",
    1
  );

  drawText(
    ctx,
    "TEAM MEMBERS",
    WIDTH - 305,
    103,
    9,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    formatNumber(
      members.length
    ),
    WIDTH - 305,
    130,
    23,
    COLORS.text,
    "900"
  );

  // ==========================================================
  // DIVIDER
  // ==========================================================

  ctx.beginPath();

  ctx.moveTo(
    65,
    315
  );

  ctx.lineTo(
    WIDTH - 65,
    315
  );

  ctx.strokeStyle =
    "#17171F";

  ctx.lineWidth = 1;

  ctx.stroke();

  // ==========================================================
  // SECTION HEADER
  // ==========================================================

  drawText(
    ctx,
    "THE PEOPLE BEHIND THE BOT",
    65,
    328,
    11,
    COLORS.text,
    "800"
  );

  drawText(
    ctx,
    `${members.length} ACTIVE PROFILES`,
    WIDTH - 65,
    328,
    9,
    COLORS.textMuted,
    "700",
    "right"
  );

  // ==========================================================
  // MEMBER CARDS
  // ==========================================================

  if (
    members.length === 0
  ) {
    fillRound(
      ctx,
      65,
      365,
      WIDTH - 130,
      150,
      20,
      "#0A0A10"
    );

    strokeRound(
      ctx,
      65,
      365,
      WIDTH - 130,
      150,
      20,
      "#191922",
      1
    );

    drawText(
      ctx,
      "NO TEAM MEMBERS CONFIGURED",
      WIDTH / 2,
      425,
      15,
      COLORS.text,
      "800",
      "center"
    );

    drawText(
      ctx,
      "Add team members in config.js to populate this directory.",
      WIDTH / 2,
      458,
      11,
      COLORS.textMuted,
      "500",
      "center"
    );
  } else {
    for (
      let i = 0;
      i < members.length;
      i++
    ) {
      const member =
        members[i];

      member.index =
        i + 1;

      const column =
        i %
        MEMBERS_PER_ROW;

      const row =
        Math.floor(
          i /
            MEMBERS_PER_ROW
        );

      const x =
        MEMBER_START_X +
        column *
          (
            MEMBER_WIDTH +
            MEMBER_GAP_X
          );

      const y =
        MEMBER_START_Y +
        row *
          (
            MEMBER_HEIGHT +
            MEMBER_GAP_Y
          );

      const status =
        getUserStatus(
          client,
          member.id
        );

      await drawMemberCard(
        ctx,
        member,
        x,
        y,
        status
      );
    }
  }

  // ==========================================================
  // FOOTER
  // ==========================================================

  const footerY =
    HEIGHT - 55;

  ctx.beginPath();

  ctx.moveTo(
    65,
    footerY - 22
  );

  ctx.lineTo(
    WIDTH - 65,
    footerY - 22
  );

  ctx.strokeStyle =
    "#15151D";

  ctx.lineWidth = 1;

  ctx.stroke();

  drawText(
    ctx,
    "ZEECHEI",
    65,
    footerY,
    10,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    "TEAM DIRECTORY",
    WIDTH / 2,
    footerY,
    9,
    "#3D3D47",
    "700",
    "center"
  );

  drawText(
    ctx,
    "LIVE",
    WIDTH - 65,
    footerY,
    9,
    COLORS.online,
    "800",
    "right"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// SEND RESPONSE
//
// Supports normal Discord Message and wrappers used by
// custom command handlers.
// ============================================================

async function sendResponse(
  message,
  payload
) {
  if (
    message &&
    typeof message.reply ===
      "function"
  ) {
    return message.reply(
      payload
    );
  }

  if (
    message &&
    typeof message.channel?.send ===
      "function"
  ) {
    return message.channel.send(
      payload
    );
  }

  if (
    message &&
    typeof message.send ===
      "function"
  ) {
    return message.send(
      payload
    );
  }

  throw new Error(
    "No valid Discord message response method found."
  );
}

// ============================================================
// PREFIX EXECUTE
// ============================================================

async function execute({
  client,
  message,
  args = [],
}) {
  try {
    const buffer =
      await createTeamCard(
        client
      );

    const attachment =
      new AttachmentBuilder(
        buffer,
        {
          name:
            "zeechei-team.png",
        }
      );

    return sendResponse(
      message,
      {
        files: [
          attachment,
        ],
      }
    );

  } catch (error) {
    console.error(
      "[TEAM ERROR]",
      error
    );

    return sendResponse(
      message,
      {
        content:
          "Team card generate nahi ho paya.",
      }
    ).catch?.(() => {});
  }
}

// ============================================================
// SLASH EXECUTE
// ============================================================

async function executeSlash(
  interaction,
  client
) {
  try {
    const buffer =
      await createTeamCard(
        client
      );

    const attachment =
      new AttachmentBuilder(
        buffer,
        {
          name:
            "zeechei-team.png",
        }
      );

    return interaction.reply({
      files: [
        attachment,
      ],
    });

  } catch (error) {
    console.error(
      "[TEAM SLASH ERROR]",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      return interaction.reply({
        content:
          "Team card generate nahi ho paya.",
        ephemeral: true,
      });
    }
  }
}

// ============================================================
// COMMAND EXPORT
// ============================================================

module.exports = {
  name: "team",

  aliases: [
    "teaminfo",
    "developers",
    "devs",
    "staff",
  ],

  category: "general",

  description:
    "Display the live Zeechei development team.",

  usage:
    "+team",

  data:
    new SlashCommandBuilder()
      .setName("team")
      .setDescription(
        "Display the Zeechei development team."
      ),

  execute,

  executeSlash,
};