// ============================================================
// ZEECHEI PROFILE SYSTEM
// Premium Dark UI + Dynamic Custom Badges
// ============================================================

const {
  SlashCommandBuilder,
  AttachmentBuilder,
} = require("discord.js");

const {
  createCanvas,
  loadImage,
} = require("@napi-rs/canvas");

const Database = require("../../database/Database");
const { getAllBadges } = require("../../utils/badges");

let config = {};

try {
  config = require("../../config");
} catch {
  config = {};
}

// ============================================================
// DARK UI CONFIG
// ============================================================

const WIDTH = 1280;
const MIN_HEIGHT = 730;

const COLORS = {
  background: "#030304",
  background2: "#07070B",

  card: "#08080D",
  panel: "#0C0C12",
  panel2: "#101017",

  border: "#191922",
  borderSoft: "#20202A",

  purple: "#8B5CF6",
  purpleSoft: "#A78BFA",

  text: "#F4F4F5",
  textSoft: "#B8B8C5",
  textMuted: "#676775",

  green: "#22C55E",
};

// ============================================================
// BADGE CONFIG
// ============================================================

// IMPORTANT:
// All badges use ONE common dark style.
// Badge-specific colors are NOT used visually.

const BADGE_STYLE = {
  background: "#0E0E14",
  border: "#24242F",
  accent: "#292936",
  emojiBackground: "#14141C",
  text: "#E7E7EC",
  muted: "#747482",
};

// ============================================================
// BADGE LAYOUT
// ============================================================

const BADGES_PER_ROW = 2;

const BADGE_WIDTH = 255;
const BADGE_HEIGHT = 54;

const BADGE_GAP_X = 18;
const BADGE_GAP_Y = 14;

const BADGE_START_X = 690;
const BADGE_START_Y = 225;

// ============================================================
// CACHE
// ============================================================

const badgeCache = new Map();

// ============================================================
// HELPERS
// ============================================================

function safe(value, fallback = "None") {
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
  const str = String(value || "");

  if (str.length <= max) {
    return str;
  }

  return str.slice(0, max - 1) + "…";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "Unknown";
  }

  try {
    return new Date(timestamp).toLocaleDateString(
      "en-US",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "Unknown";
  }
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
// CUSTOM EMOJI
// ============================================================

function getEmojiId(emoji) {
  if (!emoji) {
    return null;
  }

  const match = String(emoji).match(
    /<a?:[^:]+:(\d+)>/
  );

  return match
    ? match[1]
    : null;
}

function getEmojiURL(emoji) {
  const id =
    getEmojiId(emoji);

  if (!id) {
    return null;
  }

  return `https://cdn.discordapp.com/emojis/${id}.png?size=128&quality=lossless`;
}

async function loadCustomEmoji(emoji) {
  try {
    const url =
      getEmojiURL(emoji);

    if (!url) {
      return null;
    }

    if (
      badgeCache.has(url)
    ) {
      return badgeCache.get(url);
    }

    const image =
      await loadImage(url);

    badgeCache.set(
      url,
      image
    );

    return image;
  } catch (error) {
    console.error(
      "[PROFILE] Emoji load error:",
      error.message
    );

    return null;
  }
}

async function drawCustomEmoji(
  ctx,
  emoji,
  x,
  y,
  size
) {
  const image =
    await loadCustomEmoji(
      emoji
    );

  if (!image) {
    return false;
  }

  ctx.drawImage(
    image,
    x,
    y,
    size,
    size
  );

  return true;
}

// ============================================================
// GET USER BADGES
// ============================================================

async function getUserBadges(userId) {
  try {
    const allBadges =
      getAllBadges();

    if (
      typeof Database.getUserBadges !==
      "function"
    ) {
      return [];
    }

    const badgeKeys =
      await Promise.resolve(
        Database.getUserBadges(
          userId
        )
      );

    if (
      !Array.isArray(
        badgeKeys
      )
    ) {
      return [];
    }

    return badgeKeys
      .map(key => {
        const badge =
          allBadges[
            String(key)
          ];

        if (!badge) {
          return null;
        }

        return {
          key:
            String(key),

          label:
            badge.label ||
            String(key),

          emoji:
            badge.emoji ||
            null,

          description:
            badge.description ||
            "",
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error(
      "[PROFILE] Badge error:",
      error
    );

    return [];
  }
}

// ============================================================
// USER STATS
// ============================================================

async function getStats(userId) {
  const fallback = {
    messages: 0,
    commands: 0,
  };

  try {
    if (
      typeof Database.getUserStats !==
      "function"
    ) {
      return fallback;
    }

    const stats =
      await Promise.resolve(
        Database.getUserStats(
          userId
        )
      );

    return {
      messages:
        stats?.messages ??
        stats?.messageCount ??
        0,

      commands:
        stats?.commands ??
        stats?.commandCount ??
        0,
    };
  } catch {
    return fallback;
  }
}

// ============================================================
// USER BIO
// ============================================================

async function getBio(userId) {
  try {
    if (
      typeof Database.getBio !==
      "function"
    ) {
      return "No bio set yet.";
    }

    const bio =
      await Promise.resolve(
        Database.getBio(
          userId
        )
      );

    return (
      bio ||
      "No bio set yet."
    );
  } catch {
    return "No bio set yet.";
  }
}

// ============================================================
// PROFILE VIEWS
// ============================================================

async function getViews(userId) {
  try {
    if (
      typeof Database.getProfileViews !==
      "function"
    ) {
      return 0;
    }

    const views =
      Number(
        await Promise.resolve(
          Database.getProfileViews(
            userId
          )
        )
      ) || 0;

    if (
      typeof Database.incrementProfileViews ===
      "function"
    ) {
      await Promise.resolve(
        Database.incrementProfileViews(
          userId
        )
      );

      return views + 1;
    }

    return views;
  } catch {
    return 0;
  }
}

// ============================================================
// OWNER STATUS
// ============================================================

function getOwnerStatus(userId) {
  try {
    const mainOwner =
      config.mainOwnerId ||
      config.mainOwner ||
      config.ownerId ||
      config.owner;

    if (
      mainOwner &&
      String(mainOwner) ===
        String(userId)
    ) {
      return {
        label: "MAIN OWNER",
        symbol: "👑",
      };
    }

    const owners =
      config.ownerIds ||
      config.owners ||
      [];

    if (
      Array.isArray(owners) &&
      owners
        .map(String)
        .includes(
          String(userId)
        )
    ) {
      return {
        label: "OWNER",
        symbol: "🛡️",
      };
    }

    return {
      label: "MEMBER",
      symbol: "●",
    };
  } catch {
    return {
      label: "MEMBER",
      symbol: "●",
    };
  }
}

// ============================================================
// DYNAMIC BADGE HEIGHT
// ============================================================

function getBadgeRows(count) {
  return Math.max(
    1,
    Math.ceil(
      count /
        BADGES_PER_ROW
    )
  );
}

function getBadgePanelHeight(
  count
) {
  const rows =
    getBadgeRows(count);

  return (
    125 +
    rows *
      BADGE_HEIGHT +
    (rows - 1) *
      BADGE_GAP_Y +
    35
  );
}

function getCanvasHeight(
  badgeCount
) {
  const panelHeight =
    getBadgePanelHeight(
      badgeCount
    );

  return Math.max(
    MIN_HEIGHT,
    140 +
      panelHeight +
      100
  );
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
    const avatarURL =
      user.displayAvatarURL({
        extension: "png",
        size: 512,
      });

    const avatar =
      await loadImage(
        avatarURL
      );

    // subtle glow
    const glow =
      ctx.createRadialGradient(
        x + size / 2,
        y + size / 2,
        30,
        x + size / 2,
        y + size / 2,
        size
      );

    glow.addColorStop(
      0,
      "rgba(139,92,246,0.18)"
    );

    glow.addColorStop(
      1,
      "rgba(139,92,246,0)"
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
      x - 30,
      y - 30,
      size + 60,
      size + 60
    );

    // avatar
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
      avatar,
      x,
      y,
      size,
      size
    );

    ctx.restore();

    // border
    ctx.beginPath();

    ctx.arc(
      x + size / 2,
      y + size / 2,
      size / 2 + 3,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      "#2A2635";

    ctx.lineWidth = 4;

    ctx.stroke();
  } catch {
    fillRound(
      ctx,
      x,
      y,
      size,
      size,
      35,
      COLORS.panel
    );

    drawText(
      ctx,
      "A",
      x + size / 2,
      y + size / 2,
      60,
      COLORS.purpleSoft,
      "900",
      "center"
    );
  }
}

// ============================================================
// STAT CARD
// ============================================================

function drawStat(
  ctx,
  x,
  y,
  width,
  height,
  label,
  value
) {
  fillRound(
    ctx,
    x,
    y,
    width,
    height,
    16,
    "#0C0C12"
  );

  strokeRound(
    ctx,
    x,
    y,
    width,
    height,
    16,
    "#1A1A23",
    1
  );

  drawText(
    ctx,
    label,
    x + 18,
    y + 23,
    9,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    value,
    x + 18,
    y + 53,
    21,
    COLORS.text,
    "900"
  );
}

// ============================================================
// PROFILE CARD
// ============================================================

async function createProfileCard({
  user,
  member,
  stats,
  badges,
  bio,
  views,
  ownerStatus,
}) {
  const HEIGHT =
    getCanvasHeight(
      badges.length
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
  // FULL DARK BACKGROUND
  // ==========================================================

  const bg =
    ctx.createLinearGradient(
      0,
      0,
      WIDTH,
      HEIGHT
    );

  bg.addColorStop(
    0,
    "#020203"
  );

  bg.addColorStop(
    0.5,
    "#06060A"
  );

  bg.addColorStop(
    1,
    "#09070D"
  );

  ctx.fillStyle = bg;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // ==========================================================
  // SUBTLE BACKGROUND GLOW
  // ==========================================================

  const glow =
    ctx.createRadialGradient(
      160,
      130,
      20,
      160,
      130,
      500
    );

  glow.addColorStop(
    0,
    "rgba(124,58,237,0.13)"
  );

  glow.addColorStop(
    0.5,
    "rgba(124,58,237,0.035)"
  );

  glow.addColorStop(
    1,
    "rgba(124,58,237,0)"
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // ==========================================================
  // MAIN CARD
  // ==========================================================

  fillRound(
    ctx,
    25,
    25,
    WIDTH - 50,
    HEIGHT - 50,
    28,
    "#07070C"
  );

  strokeRound(
    ctx,
    25,
    25,
    WIDTH - 50,
    HEIGHT - 50,
    28,
    "#181820",
    2
  );

  // ==========================================================
  // BRAND
  // ==========================================================

  drawText(
    ctx,
    "ZEECHEI",
    65,
    66,
    25,
    COLORS.text,
    "900"
  );

  drawText(
    ctx,
    "PROFILE",
    65,
    94,
    10,
    COLORS.purpleSoft,
    "800"
  );

  // owner status

  drawText(
    ctx,
    ownerStatus.symbol,
    1138,
    70,
    16,
    COLORS.text,
    "800",
    "center"
  );

  drawText(
    ctx,
    ownerStatus.label,
    1208,
    70,
    9,
    COLORS.textMuted,
    "800",
    "right"
  );

  // ==========================================================
  // HEADER DIVIDER
  // ==========================================================

  ctx.beginPath();

  ctx.moveTo(
    65,
    118
  );

  ctx.lineTo(
    1215,
    118
  );

  ctx.strokeStyle =
    "#16161E";

  ctx.lineWidth = 1;

  ctx.stroke();

  // ==========================================================
  // AVATAR
  // ==========================================================

  await drawAvatar(
    ctx,
    user,
    70,
    150,
    160
  );

  // online dot

  ctx.beginPath();

  ctx.arc(
    211,
    291,
    11,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    COLORS.green;

  ctx.fill();

  ctx.strokeStyle =
    "#07070C";

  ctx.lineWidth = 4;

  ctx.stroke();

  // ==========================================================
  // USER INFO
  // ==========================================================

  drawText(
    ctx,
    truncate(
      user.globalName ||
        user.username,
      23
    ),
    265,
    165,
    30,
    COLORS.text,
    "900"
  );

  drawText(
    ctx,
    `@${truncate(
      user.username,
      25
    )}`,
    265,
    202,
    14,
    COLORS.textMuted,
    "500"
  );

  // online

  fillRound(
    ctx,
    265,
    228,
    100,
    30,
    15,
    "#0A120D"
  );

  drawText(
    ctx,
    "● Online",
    315,
    243,
    11,
    "#4ADE80",
    "700",
    "center"
  );

  // bio

  drawText(
    ctx,
    "BIO",
    265,
    292,
    9,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    truncate(
      safe(
        bio,
        "No bio set yet."
      ),
      44
    ),
    265,
    320,
    14,
    COLORS.textSoft,
    "500"
  );

  // ==========================================================
  // STATS
  // ==========================================================

  const statY = 370;

  const statWidth = 260;
  const statHeight = 78;
  const statGap = 18;

  drawStat(
    ctx,
    65,
    statY,
    statWidth,
    statHeight,
    "MESSAGES",
    formatNumber(
      stats.messages
    )
  );

  drawStat(
    ctx,
    65 +
      statWidth +
      statGap,
    statY,
    statWidth,
    statHeight,
    "COMMANDS",
    formatNumber(
      stats.commands
    )
  );

  // ==========================================================
  // ACCOUNT INFO
  // ==========================================================

  const infoY = 475;

  fillRound(
    ctx,
    65,
    infoY,
    538,
    112,
    18,
    "#0A0A10"
  );

  strokeRound(
    ctx,
    65,
    infoY,
    538,
    112,
    18,
    "#17171F",
    1
  );

  drawText(
    ctx,
    "ACCOUNT CREATED",
    90,
    infoY + 27,
    9,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    formatDate(
      user.createdTimestamp
    ),
    90,
    infoY + 57,
    15,
    COLORS.text,
    "700"
  );

  drawText(
    ctx,
    "SERVER JOINED",
    330,
    infoY + 27,
    9,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    member?.joinedTimestamp
      ? formatDate(
          member.joinedTimestamp
        )
      : "Not available",
    330,
    infoY + 57,
    15,
    COLORS.text,
    "700"
  );

  // ==========================================================
  // BADGE PANEL
  // ==========================================================

  const badgePanelHeight =
    getBadgePanelHeight(
      badges.length
    );

  fillRound(
    ctx,
    635,
    140,
    580,
    badgePanelHeight,
    23,
    "#0A0A10"
  );

  strokeRound(
    ctx,
    635,
    140,
    580,
    badgePanelHeight,
    23,
    "#1A1921",
    1
  );

  // ==========================================================
  // BADGES HEADER
  // ==========================================================

  drawText(
    ctx,
    "BADGES",
    670,
    174,
    16,
    COLORS.text,
    "900"
  );

  drawText(
    ctx,
    String(
      badges.length
    ),
    1175,
    174,
    11,
    COLORS.textMuted,
    "700",
    "right"
  );

  // simple dark-purple line

  fillRound(
    ctx,
    670,
    193,
    34,
    3,
    2,
    "#5B3BA8"
  );

  // ==========================================================
  // BADGES
  // ==========================================================

  if (
    badges.length === 0
  ) {
    drawText(
      ctx,
      "No badges earned yet.",
      670,
      245,
      13,
      COLORS.textMuted,
      "500"
    );
  } else {
    for (
      let i = 0;
      i < badges.length;
      i++
    ) {
      const badge =
        badges[i];

      const column =
        i %
        BADGES_PER_ROW;

      const row =
        Math.floor(
          i /
            BADGES_PER_ROW
        );

      const x =
        BADGE_START_X +
        column *
          (
            BADGE_WIDTH +
            BADGE_GAP_X
          );

      const y =
        BADGE_START_Y +
        row *
          (
            BADGE_HEIGHT +
            BADGE_GAP_Y
          );

      // ======================================================
      // SAME DARK BACKGROUND FOR EVERY BADGE
      // ======================================================

      fillRound(
        ctx,
        x,
        y,
        BADGE_WIDTH,
        BADGE_HEIGHT,
        14,
        BADGE_STYLE.background
      );

      strokeRound(
        ctx,
        x,
        y,
        BADGE_WIDTH,
        BADGE_HEIGHT,
        14,
        BADGE_STYLE.border,
        1
      );

      // ======================================================
      // SAME DARK ACCENT STRIP
      // ======================================================

      fillRound(
        ctx,
        x,
        y,
        3,
        BADGE_HEIGHT,
        2,
        BADGE_STYLE.accent
      );

      // ======================================================
      // EMOJI HOLDER
      // ======================================================

      fillRound(
        ctx,
        x + 11,
        y + 9,
        36,
        36,
        10,
        BADGE_STYLE.emojiBackground
      );

      // ======================================================
      // CUSTOM DISCORD EMOJI
      // ======================================================

      const loaded =
        await drawCustomEmoji(
          ctx,
          badge.emoji,
          x + 16,
          y + 14,
          26
        );

      // fallback
      if (!loaded) {
        drawText(
          ctx,
          "◆",
          x + 29,
          y + 27,
          13,
          COLORS.purpleSoft,
          "900",
          "center"
        );
      }

      // ======================================================
      // BADGE LABEL
      // ======================================================

      drawText(
        ctx,
        truncate(
          badge.label,
          25
        ),
        x + 59,
        y + 27,
        12,
        BADGE_STYLE.text,
        "700"
      );
    }
  }

  // ==========================================================
  // PROFILE VIEWS
  // ==========================================================

  const bottomY =
    HEIGHT - 75;

  drawText(
    ctx,
    "PROFILE VIEWS",
    65,
    bottomY,
    8,
    COLORS.textMuted,
    "800"
  );

  drawText(
    ctx,
    formatNumber(
      views
    ),
    65,
    bottomY + 22,
    13,
    COLORS.textSoft,
    "700"
  );

  // ==========================================================
  // ZEECHEI WATERMARK
  // ==========================================================

  drawText(
    ctx,
    "ZEECHEI",
    1215,
    bottomY + 8,
    30,
    "rgba(167,139,250,0.10)",
    "900",
    "right"
  );

  drawText(
    ctx,
    "ALL IN ONE",
    1215,
    bottomY + 32,
    8,
    "rgba(167,139,250,0.16)",
    "800",
    "right"
  );

  // ==========================================================
  // FOOTER
  // ==========================================================

  drawText(
    ctx,
    "Zeechei Profile System",
    640,
    HEIGHT - 37,
    9,
    "#3D3D47",
    "600",
    "center"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// RESOLVE USER
// ============================================================

async function resolveUser(
  client,
  source,
  args = []
) {
  let user =
    source.user ||
    source.author;

  let member = null;

  const mentioned =
    source.mentions?.users?.first?.();

  if (mentioned) {
    user = mentioned;
  } else if (
    args[0]
  ) {
    const id =
      String(
        args[0]
      ).replace(
        /\D/g,
        ""
      );

    if (
      id.length >= 17
    ) {
      const fetched =
        await client.users
          .fetch(id)
          .catch(
            () => null
          );

      if (fetched) {
        user = fetched;
      }
    }
  }

  if (
    source.guild
  ) {
    member =
      await source.guild.members
        .fetch(
          user.id
        )
        .catch(
          () => null
        );
  }

  return {
    user,
    member,
  };
}

// ============================================================
// PREFIX COMMAND
// ============================================================

async function execute({
  client,
  message,
  args = [],
}) {
  try {
    const {
      user,
      member,
    } = await resolveUser(
      client,
      message,
      args
    );

    const [
      stats,
      bio,
      badges,
      views,
    ] = await Promise.all([
      getStats(user.id),
      getBio(user.id),
      getUserBadges(
        user.id
      ),
      getViews(
        user.id
      ),
    ]);

    const ownerStatus =
      getOwnerStatus(
        user.id
      );

    const buffer =
      await createProfileCard({
        user,
        member,
        stats,
        badges,
        bio,
        views,
        ownerStatus,
      });

    const attachment =
      new AttachmentBuilder(
        buffer,
        {
          name:
            "zeechei-profile.png",
        }
      );

    return message.reply({
      files: [
        attachment,
      ],
    });
  } catch (error) {
    console.error(
      "[PROFILE ERROR]",
      error
    );

    return message.reply(
      "❌ **Profile Error**\nProfile card generate nahi ho paya."
    );
  }
}

// ============================================================
// SLASH COMMAND
// ============================================================

async function executeSlash(
  interaction,
  client
) {
  try {
    let user =
      interaction.user;

    const selected =
      interaction.options.getUser(
        "user"
      );

    if (selected) {
      user = selected;
    }

    let member = null;

    if (
      interaction.guild
    ) {
      member =
        await interaction.guild.members
          .fetch(
            user.id
          )
          .catch(
            () => null
          );
    }

    const [
      stats,
      bio,
      badges,
      views,
    ] = await Promise.all([
      getStats(user.id),
      getBio(user.id),
      getUserBadges(
        user.id
      ),
      getViews(
        user.id
      ),
    ]);

    const ownerStatus =
      getOwnerStatus(
        user.id
      );

    const buffer =
      await createProfileCard({
        user,
        member,
        stats,
        badges,
        bio,
        views,
        ownerStatus,
      });

    const attachment =
      new AttachmentBuilder(
        buffer,
        {
          name:
            "zeechei-profile.png",
        }
      );

    return interaction.reply({
      files: [
        attachment,
      ],
    });
  } catch (error) {
    console.error(
      "[PROFILE SLASH ERROR]",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      return interaction.reply({
        content:
          "❌ **Profile Error**\nProfile card generate nahi ho paya.",
        ephemeral: true,
      });
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  name: "profile",

  aliases: [
    "pr",
    "user",
    "me",
  ],

  category: "general",

  description:
    "View your Zeechei profile or another user's profile.",

  usage:
    "+profile [@user]",

  data:
    new SlashCommandBuilder()
      .setName(
        "profile"
      )
      .setDescription(
        "View a user's Zeechei profile."
      )
      .addUserOption(
        option =>
          option
            .setName(
              "user"
            )
            .setDescription(
              "User whose profile you want to view"
            )
            .setRequired(
              false
            )
      ),

  execute,

  executeSlash,
};