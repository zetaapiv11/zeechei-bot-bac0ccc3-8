const {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const Database = require("../../database/Database");
const WebhookLogger = require("../../logger/WebhookLogger");

const {
  createCanvas,
  loadImage,
} = require("@napi-rs/canvas");

// ============================================================
// ZEECHEI NO-PREFIX SYSTEM
// ============================================================
//
// PREFIX:
//
// .np
// .np stats
// .np add @user
// .np remove @user
//
// DURATION:
//
// 1d
// 10d
// 30d
// 60d
// 90d
// 365d
// lifetime
//
// ============================================================


// ============================================================
// CUSTOM EMOJIS
// ============================================================
//
// Sirf yahin se emojis change karna.
// Baaki pura system automatically use karega.
//
// ============================================================

const EMOJIS = {

  lightning:
    "<a:lightning:1550872978885976115>",

  info:
    "<:information:1550869957171220584>",

  check:
    "<:check:1550872076104245271>",

  warning:
    "<:warning:1550824858516979884>",

  clock:
    "<a:NG_Clock:1550872222107836424>",

  gift:
    "<a:st_gift:1550872399648391250>",

  lock:
    "<a:Lock:1550872561754050600>",

  panel:
    "<:panel:1550873482395390082>",

  user:
    "<:member2:1550825886436171857>",

  crown:
    "<:ZeecheiCrown:1543432949796704266>",

  calendar:
    "<a:SR_CALANDER:1550820972603383822>",

  refresh:
    "<:refresh:1550824820797607997>",

  remove:
    "<:removed:1550922830009339904>",

  lifetime:
    "<:901_flower:1550922516862603329>",

  oneDay:
    "<:901_flower:1550922516862603329>",

  tenDays:
    "<:901_flower:1550922516862603329>",

  thirtyDays:
    "<:901_flower:1550922516862603329>",

  sixtyDays:
    "<:901_flower:1550922516862603329>",

  ninetyDays:
    "<:901_flower:1550922516862603329>",

  year:
    "<:901_flower:1550922516862603329>",

};


// ============================================================
// STORAGE
// ============================================================
//
// Timed No-Prefix access is stored separately so that
// existing Database No-Prefix system remains untouched.
//
// ============================================================

const DATA_DIR =
  path.join(
    process.cwd(),
    "data"
  );

const NP_FILE =
  path.join(
    DATA_DIR,
    "noprefix_access.json"
  );

fs.mkdirSync(
  DATA_DIR,
  {
    recursive: true,
  }
);


// ============================================================
// LOAD STORAGE
// ============================================================

function loadAccess() {

  try {

    if (
      !fs.existsSync(
        NP_FILE
      )
    ) {
      return {};
    }

    const raw =
      fs.readFileSync(
        NP_FILE,
        "utf8"
      );

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed;

  } catch (error) {

    console.error(
      "[NoPrefix] Failed loading storage:",
      error.message
    );

    return {};
  }
}


// ============================================================
// SAVE STORAGE
// ============================================================

function saveAccess(
  data
) {

  try {

    fs.mkdirSync(
      DATA_DIR,
      {
        recursive: true,
      }
    );

    const temp =
      `${NP_FILE}.tmp`;

    fs.writeFileSync(
      temp,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(
      temp,
      NP_FILE
    );

    return true;

  } catch (error) {

    console.error(
      "[NoPrefix] Failed saving storage:",
      error.message
    );

    return false;
  }
}


// ============================================================
// TIME DEFINITIONS
// ============================================================

const DURATIONS = {

  "1d": {
    label: "1 Day",
    ms:
      1 *
      24 *
      60 *
      60 *
      1000,
    emoji:
      EMOJIS.oneDay,
  },

  "10d": {
    label: "10 Days",
    ms:
      10 *
      24 *
      60 *
      60 *
      1000,
    emoji:
      EMOJIS.tenDays,
  },

  "30d": {
    label: "30 Days",
    ms:
      30 *
      24 *
      60 *
      60 *
      1000,
    emoji:
      EMOJIS.thirtyDays,
  },

  "60d": {
    label: "60 Days",
    ms:
      60 *
      24 *
      60 *
      60 *
      1000,
    emoji:
      EMOJIS.sixtyDays,
  },

  "90d": {
    label: "90 Days",
    ms:
      90 *
      24 *
      60 *
      60 *
      1000,
    emoji:
      EMOJIS.ninetyDays,
  },

  "365d": {
    label: "365 Days",
    ms:
      365 *
      24 *
      60 *
      60 *
      1000,
    emoji:
      EMOJIS.year,
  },

  lifetime: {
    label: "Lifetime",
    ms: null,
    emoji:
      EMOJIS.lifetime,
  },

};


// ============================================================
// FORMAT DATE
// ============================================================

function formatDiscordDate(
  timestamp
) {

  if (!timestamp) {
    return "Never";
  }

  const unix =
    Math.floor(
      Number(timestamp) / 1000
    );

  return `<t:${unix}:F>`;
}


// ============================================================
// FORMAT RELATIVE DATE
// ============================================================

function formatRelative(
  timestamp
) {

  if (!timestamp) {
    return "Lifetime";
  }

  const unix =
    Math.floor(
      Number(timestamp) / 1000
    );

  return `<t:${unix}:R>`;
}


// ============================================================
// SAFE USERNAME
// ============================================================

function safe(
  value,
  fallback = "Unknown"
) {

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


// ============================================================
// COLLECT IDS
// ============================================================

function collectIds(
  values
) {

  const ids = [];

  function collect(
    value
  ) {

    if (!value) {
      return;
    }

    if (
      Array.isArray(value)
    ) {

      for (
        const item
        of value
      ) {
        collect(item);
      }

      return;
    }

    if (
      typeof value ===
      "string"
    ) {

      for (
        const id
        of value.split(
          /[,\s]+/
        )
      ) {

        if (
          /^\d{15,25}$/.test(
            id
          )
        ) {
          ids.push(id);
        }
      }

      return;
    }

    if (
      typeof value ===
      "object"
    ) {

      for (
        const item
        of Object.values(
          value
        )
      ) {
        collect(item);
      }
    }
  }

  for (
    const value
    of values
  ) {
    collect(value);
  }

  return [
    ...new Set(ids),
  ];
}


// ============================================================
// OWNER CHECK
// ============================================================

function isOwner(
  userId
) {

  const ids =
    collectIds([

      require("../../config")?.mainOwnerId,

      require("../../config")?.ownerId,

      require("../../config")?.ownerID,

      require("../../config")?.ownerIds,

      require("../../config")?.ownerIDs,

      require("../../config")?.owners,

      require("../../config")?.OWNERS,

      require("../../config")?.OWNER_ID,

      require("../../config")?.OWNER_IDS,

      require("../../config")?.team?.owners,

      require("../../config")?.team?.ownerIds,

    ]);

  if (
    ids.includes(
      String(userId)
    )
  ) {
    return true;
  }

  try {

    if (
      typeof Database.isOwner ===
      "function"
    ) {

      return Boolean(
        Database.isOwner(
          String(userId)
        )
      );
    }

  } catch (_) {}

  return false;
}


// ============================================================
// DEVELOPER CHECK
// ============================================================

function isDeveloper(
  userId
) {

  const config =
    require("../../config");

  const ids =
    collectIds([

      config?.developerId,

      config?.developerID,

      config?.developerIds,

      config?.developerIDs,

      config?.developers,

      config?.DEVELOPERS,

      config?.DEVELOPER_IDS,

      config?.team?.developers,

      config?.team?.developerIds,

    ]);

  if (
    ids.includes(
      String(userId)
    )
  ) {
    return true;
  }

  try {

    if (
      typeof Database.isDeveloper ===
      "function"
    ) {

      return Boolean(
        Database.isDeveloper(
          String(userId)
        )
      );
    }

  } catch (_) {}

  return false;
}


// ============================================================
// AUTHORIZATION
// ============================================================

function isAuthorized(
  userId
) {

  return (
    isOwner(userId) ||
    isDeveloper(userId)
  );
}


// ============================================================
// DATABASE SAFE CHECK
// ============================================================

function databaseHasNoPrefix(
  userId
) {

  try {

    if (
      typeof Database.isNoPrefix ===
      "function"
    ) {

      return Boolean(
        Database.isNoPrefix(
          String(userId)
        )
      );
    }

  } catch (_) {}

  return false;
}


// ============================================================
// ACTIVE ACCESS CHECK
// ============================================================

function getAccess(
  userId
) {

  const data =
    loadAccess();

  const record =
    data[
      String(userId)
    ];

  if (
    !record
  ) {
    return null;
  }

  // Lifetime

  if (
    record.lifetime === true
  ) {
    return record;
  }

  // Expired

  if (
    record.expiresAt &&
    Number(
      record.expiresAt
    ) <= Date.now()
  ) {
    return null;
  }

  return record;
}


// ============================================================
// HAS ACTIVE ACCESS
// ============================================================

function hasActiveAccess(
  userId
) {

  // Existing permanent DB access

  if (
    databaseHasNoPrefix(
      userId
    )
  ) {
    return true;
  }

  // Timed access

  const record =
    getAccess(
      userId
    );

  return Boolean(
    record
  );
}


// ============================================================
// GRANT DATABASE ACCESS
// ============================================================

function grantDatabaseAccess(
  userId
) {

  try {

    if (
      !databaseHasNoPrefix(
        userId
      )
    ) {

      Database.addNoPrefix(
        String(userId)
      );
    }

    return true;

  } catch (error) {

    console.error(
      "[NoPrefix] Database grant failed:",
      error.message
    );

    return false;
  }
}


// ============================================================
// REMOVE DATABASE ACCESS
// ============================================================

function removeDatabaseAccess(
  userId
) {

  try {

    if (
      typeof Database.removeNoPrefix ===
      "function"
    ) {

      Database.removeNoPrefix(
        String(userId)
      );
    }

    return true;

  } catch (error) {

    console.error(
      "[NoPrefix] Database remove failed:",
      error.message
    );

    return false;
  }
}


// ============================================================
// SAVE TIMED ACCESS
// ============================================================

function saveUserAccess(
  userId,
  durationKey,
  grantedBy
) {

  const data =
    loadAccess();

  const duration =
    DURATIONS[
      durationKey
    ];

  if (!duration) {
    return false;
  }

  const now =
    Date.now();

  data[
    String(userId)
  ] = {

    userId:
      String(userId),

    duration:
      durationKey,

    durationLabel:
      duration.label,

    grantedAt:
      now,

    grantedBy:
      String(grantedBy),

    lifetime:
      duration.ms === null,

    expiresAt:
      duration.ms === null
        ? null
        : now + duration.ms,

  };

  return saveAccess(
    data
  );
}


// ============================================================
// DELETE TIMED ACCESS
// ============================================================

function deleteUserAccess(
  userId
) {

  const data =
    loadAccess();

  delete data[
    String(userId)
  ];

  saveAccess(
    data
  );
}


// ============================================================
// ACTIVATE ACCESS
// ============================================================

function activateAccess(
  userId,
  durationKey,
  grantedBy
) {

  if (
    !DURATIONS[
      durationKey
    ]
  ) {
    return {
      success: false,
      reason: "invalid_duration",
    };
  }

  if (
    hasActiveAccess(
      userId
    )
  ) {
    return {
      success: false,
      reason: "already_active",
    };
  }

  const databaseGranted =
    grantDatabaseAccess(
      userId
    );

  if (!databaseGranted) {
    return {
      success: false,
      reason: "database_error",
    };
  }

  const saved =
    saveUserAccess(
      userId,
      durationKey,
      grantedBy
    );

  if (!saved) {

    // Roll back DB access if local storage failed.

    removeDatabaseAccess(
      userId
    );

    return {
      success: false,
      reason: "storage_error",
    };
  }

  return {
    success: true,
    record:
      getAccess(
        userId
      ),
  };
}


// ============================================================
// EXPIRE USER
// ============================================================

function expireUser(
  userId
) {

  const record =
    getAccess(
      userId
    );

  if (
    !record
  ) {
    return false;
  }

  if (
    record.lifetime === true
  ) {
    return false;
  }

  if (
    !record.expiresAt ||
    Number(
      record.expiresAt
    ) > Date.now()
  ) {
    return false;
  }

  removeDatabaseAccess(
    userId
  );

  deleteUserAccess(
    userId
  );

  return true;
}


// ============================================================
// CLEAN EXPIRED ACCESS
// ============================================================

function cleanExpiredAccess() {

  const data =
    loadAccess();

  let changed =
    false;

  for (
    const [
      userId,
      record
    ]
    of Object.entries(
      data
    )
  ) {

    if (
      !record ||
      record.lifetime === true
    ) {
      continue;
    }

    if (
      record.expiresAt &&
      Number(
        record.expiresAt
      ) <= Date.now()
    ) {

      removeDatabaseAccess(
        userId
      );

      delete data[
        userId
      ];

      changed = true;
    }
  }

  if (changed) {
    saveAccess(
      data
    );
  }
}


// ============================================================
// START EXPIRY SYSTEM
// ============================================================

let expiryStarted =
  false;

function startExpirySystem() {

  if (
    expiryStarted
  ) {
    return;
  }

  expiryStarted =
    true;

  // Initial cleanup

  cleanExpiredAccess();

  // Check every 30 seconds

  setInterval(
    () => {

      try {

        cleanExpiredAccess();

      } catch (error) {

        console.error(
          "[NoPrefix] Expiry system error:",
          error.message
        );
      }

    },
    30 * 1000
  );
}


// ============================================================
// STATS CANVAS
// ============================================================

const WIDTH =
  1400;

const COLORS = {

  background:
    "#050507",

  card:
    "#0b0b11",

  card2:
    "#101018",

  border:
    "#20202a",

  purple:
    "#8b5cf6",

  purple2:
    "#a78bfa",

  purple3:
    "#c4b5fd",

  white:
    "#f5f5f7",

  text:
    "#d7d7df",

  muted:
    "#7c7c88",

  dim:
    "#4d4d59",

  green:
    "#4ade80",

};


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


function strokeRound(
  ctx,
  x,
  y,
  w,
  h,
  r,
  color,
  width = 1
) {

  roundedRect(
    ctx,
    x,
    y,
    w,
    h,
    r
  );

  ctx.strokeStyle =
    color;

  ctx.lineWidth =
    width;

  ctx.stroke();
}


function drawText(
  ctx,
  value,
  x,
  y,
  size,
  color = COLORS.white,
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
    String(value),
    x,
    y
  );
}


// ============================================================
// AVATAR
// ============================================================

async function drawAvatar(
  ctx,
  user,
  x,
  y,
  size
) {

  try {

    if (
      user &&
      typeof user.displayAvatarURL ===
        "function"
    ) {

      const url =
        user.displayAvatarURL({
          extension: "png",
          size: 128,
          forceStatic: true,
        });

      if (url) {

        const image =
          await loadImage(
            url
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

        return;
      }
    }

  } catch (_) {}

  fillRound(
    ctx,
    x,
    y,
    size,
    size,
    size / 2,
    COLORS.card2
  );

  drawText(
    ctx,
    "U",
    x + size / 2,
    y + size / 2,
    25,
    COLORS.purple2,
    "900",
    "center"
  );
}


// ============================================================
// GET LIVE USERS
// ============================================================

async function getLiveNoPrefixUsers(
  client
) {

  let ids = [];

  try {

    if (
      typeof Database.getAllNoPrefixUsers ===
      "function"
    ) {

      ids =
        Database
          .getAllNoPrefixUsers()
          .map(String)
          .filter(Boolean);
    }

  } catch (_) {}

  const local =
    loadAccess();

  for (
    const [
      userId,
      record
    ]
    of Object.entries(
      local
    )
  ) {

    if (
      record?.lifetime === true
    ) {

      ids.push(
        String(userId)
      );

    } else if (
      record?.expiresAt &&
      Number(
        record.expiresAt
      ) > Date.now()
    ) {

      ids.push(
        String(userId)
      );
    }
  }

  ids =
    [
      ...new Set(
        ids
      ),
    ];

  const users = [];

  for (
    const id
    of ids
  ) {

    try {

      const user =
        await client.users.fetch(
          id,
          {
            force: true,
          }
        );

      if (user) {
        users.push(user);
      }

    } catch (_) {

      users.push({
        id,
        username:
          "Unknown User",
        globalName:
          null,
        tag:
          `Unknown User (${id})`,
        displayAvatarURL:
          () => "",
      });
    }
  }

  return {
    ids,
    users,
  };
}


// ============================================================
// USER ROW
// ============================================================

async function drawUserRow(
  ctx,
  user,
  index,
  x,
  y,
  width
) {

  const height =
    76;

  fillRound(
    ctx,
    x,
    y,
    width,
    height,
    18,
    "#0d0d14"
  );

  strokeRound(
    ctx,
    x,
    y,
    width,
    height,
    18,
    COLORS.border,
    1
  );

  drawText(
    ctx,
    String(
      index + 1
    ).padStart(
      2,
      "0"
    ),
    x + 24,
    y + height / 2,
    11,
    COLORS.dim,
    "800"
  );

  await drawAvatar(
    ctx,
    user,
    x + 58,
    y + 11,
    54
  );

  const username =
    user?.globalName ||
    user?.username ||
    "Unknown User";

  drawText(
    ctx,
    safe(
      username
    ),
    x + 130,
    y + 29,
    15,
    COLORS.white,
    "800"
  );

  const tag =
    user?.tag ||
    (
      user?.username
        ? `@${user.username}`
        : "Unknown"
    );

  drawText(
    ctx,
    safe(
      tag
    ),
    x + 130,
    y + 51,
    10,
    COLORS.muted,
    "500"
  );

  fillRound(
    ctx,
    x + width - 108,
    y + 22,
    86,
    32,
    16,
    "#0b1810"
  );

  drawText(
    ctx,
    "ACTIVE",
    x + width - 65,
    y + 38,
    9,
    COLORS.green,
    "800",
    "center"
  );
}


// ============================================================
// CREATE STATS BANNER
// ============================================================

async function createStatsBanner(
  client
) {

  const {
    ids,
    users,
  } =
    await getLiveNoPrefixUsers(
      client
    );

  const rowHeight =
    76;

  const rowGap =
    10;

  const panelHeight =
    users.length
      ? 76 +
        users.length *
          rowHeight +
        Math.max(
          users.length - 1,
          0
        ) *
          rowGap +
        34
      : 250;

  const height =
    460 +
    panelHeight +
    100;

  const canvas =
    createCanvas(
      WIDTH,
      height
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  // Background

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      WIDTH,
      height
    );

  gradient.addColorStop(
    0,
    "#030305"
  );

  gradient.addColorStop(
    0.5,
    "#07070c"
  );

  gradient.addColorStop(
    1,
    "#0c0712"
  );

  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    height
  );

  // Main container

  fillRound(
    ctx,
    26,
    26,
    WIDTH - 52,
    height - 52,
    32,
    "#08080d"
  );

  strokeRound(
    ctx,
    26,
    26,
    WIDTH - 52,
    height - 52,
    32,
    "#1b1b24",
    2
  );

  // Header

  drawText(
    ctx,
    "ZEECHEI",
    70,
    70,
    28,
    COLORS.white,
    "900"
  );

  drawText(
    ctx,
    "NO PREFIX",
    70,
    101,
    10,
    COLORS.purple3,
    "800"
  );

  drawText(
    ctx,
    "ACCESS CONTROL",
    70,
    122,
    8,
    COLORS.dim,
    "700"
  );

  drawText(
    ctx,
    "LIVE SYSTEM",
    WIDTH - 70,
    72,
    10,
    COLORS.muted,
    "800",
    "right"
  );

  drawText(
    ctx,
    "NO-PREFIX STATISTICS",
    70,
    184,
    25,
    COLORS.white,
    "900"
  );

  drawText(
    ctx,
    "Live authorization data from Zeechei.",
    70,
    213,
    11,
    COLORS.muted,
    "500"
  );

  // Stat cards

  const statY =
    245;

  const statWidth =
    250;

  const statHeight =
    88;

  const gap =
    18;

  const statItems = [

    [
      "AUTHORIZED USERS",
      ids.length,
    ],

    [
      "BOT SERVERS",
      client.guilds?.cache?.size || 0,
    ],

    [
      "BOT USERS",
      client.users?.cache?.size || 0,
    ],

    [
      "SYSTEM",
      "ACTIVE",
    ],

  ];

  for (
    let i = 0;
    i < statItems.length;
    i++
  ) {

    const x =
      70 +
      i *
        (statWidth + gap);

    fillRound(
      ctx,
      x,
      statY,
      statWidth,
      statHeight,
      20,
      "#0d0d14"
    );

    strokeRound(
      ctx,
      x,
      statY,
      statWidth,
      statHeight,
      20,
      COLORS.border,
      1
    );

    drawText(
      ctx,
      statItems[i][0],
      x + 20,
      statY + 27,
      9,
      COLORS.muted,
      "800"
    );

    drawText(
      ctx,
      typeof statItems[i][1] ===
        "number"
        ? Number(
            statItems[i][1]
          ).toLocaleString(
            "en-US"
          )
        : statItems[i][1],
      x + 20,
      statY + 59,
      21,
      statItems[i][1] ===
        "ACTIVE"
        ? COLORS.green
        : COLORS.white,
      "900"
    );
  }

  // Users panel

  const panelX =
    70;

  const panelY =
    360;

  const panelW =
    WIDTH - 140;

  fillRound(
    ctx,
    panelX,
    panelY,
    panelW,
    panelHeight,
    24,
    "#09090f"
  );

  strokeRound(
    ctx,
    panelX,
    panelY,
    panelW,
    panelHeight,
    24,
    "#1b1b24",
    1
  );

  drawText(
    ctx,
    "AUTHORIZED NO-PREFIX USERS",
    panelX + 28,
    panelY + 34,
    15,
    COLORS.white,
    "900"
  );

  drawText(
    ctx,
    `${users.length} ACTIVE`,
    panelX + panelW - 28,
    panelY + 34,
    9,
    COLORS.muted,
    "800",
    "right"
  );

  fillRound(
    ctx,
    panelX + 28,
    panelY + 54,
    54,
    3,
    2,
    COLORS.purple
  );

  if (
    !users.length
  ) {

    drawText(
      ctx,
      "NO AUTHORIZED USERS",
      WIDTH / 2,
      panelY + 120,
      18,
      COLORS.text,
      "800",
      "center"
    );

  } else {

    const rowX =
      panelX + 28;

    const rowW =
      panelW - 56;

    for (
      let i = 0;
      i < users.length;
      i++
    ) {

      await drawUserRow(
        ctx,
        users[i],
        i,
        rowX,
        panelY +
          76 +
          i *
            (rowHeight +
              rowGap),
        rowW
      );
    }
  }

  return canvas.toBuffer(
    "image/png"
  );
}


// ============================================================
// SEND STATS
// ============================================================

async function sendStats(
  message,
  client
) {

  cleanExpiredAccess();

  const buffer =
    await createStatsBanner(
      client
    );

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name:
          "zeechei-noprefix-stats.png",
      }
    );

  return message.reply({
    files: [
      attachment,
    ],
  });
}


// ============================================================
// MAIN HELP EMBED
// ============================================================

function createHelpEmbed() {

  return new EmbedBuilder()

    .setColor(
      "#FFFFFF"
    )

    .setTitle(
      `${EMOJIS.lightning} Zeechei No-Prefix`
    )

    .setDescription(

      `### ${EMOJIS.panel} No-Prefix Management\n\n` +

      `${EMOJIS.user} **Add Access**\n` +
      `> \`,,np add @user\`\n\n` +

      `${EMOJIS.calendar} **View Statistics**\n` +
      `> \`,,np stats\`\n\n` +

      `${EMOJIS.remove} **Remove Access**\n` +
      `> \`,,np remove @user\`\n\n` +

      `${EMOJIS.info} Select a duration when granting access.`
    )

    .setFooter({
      text:
        "Zeechei • No-Prefix System",
    })

    .setTimestamp();
}


// ============================================================
// DURATION DROPDOWN
// ============================================================

function createDurationMenu(
  targetId,
  requesterId
) {

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        `zeechei_np_duration:${requesterId}:${targetId}`
      )

      .setPlaceholder(
        "Select No-Prefix duration"
      )

      .addOptions(

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "1 Day"
          )
          .setDescription(
            "No-Prefix access for 1 day"
          )
          .setValue(
            "1d"
          )
          .setEmoji(
            EMOJIS.oneDay
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "10 Days"
          )
          .setDescription(
            "No-Prefix access for 10 days"
          )
          .setValue(
            "10d"
          )
          .setEmoji(
            EMOJIS.tenDays
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "30 Days"
          )
          .setDescription(
            "No-Prefix access for 30 days"
          )
          .setValue(
            "30d"
          )
          .setEmoji(
            EMOJIS.thirtyDays
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "60 Days"
          )
          .setDescription(
            "No-Prefix access for 60 days"
          )
          .setValue(
            "60d"
          )
          .setEmoji(
            EMOJIS.sixtyDays
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "90 Days"
          )
          .setDescription(
            "No-Prefix access for 90 days"
          )
          .setValue(
            "90d"
          )
          .setEmoji(
            EMOJIS.ninetyDays
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "365 Days"
          )
          .setDescription(
            "No-Prefix access for 1 year"
          )
          .setValue(
            "365d"
          )
          .setEmoji(
            EMOJIS.year
          ),

        new StringSelectMenuOptionBuilder()
          .setLabel(
            "Lifetime"
          )
          .setDescription(
            "Permanent No-Prefix access"
          )
          .setValue(
            "lifetime"
          )
          .setEmoji(
            EMOJIS.lifetime
          )
      );

  return new ActionRowBuilder()
    .addComponents(
      menu
    );
}


// ============================================================
// ADD USER PANEL
// ============================================================

async function sendAddPanel(
  message,
  target
) {

  const embed =
    new EmbedBuilder()

      .setColor(
        "#FFFFFF"
      )

      .setTitle(
        `${EMOJIS.lightning} No-Prefix Access`
      )

      .setDescription(

        `### ${EMOJIS.gift} Grant No-Prefix\n\n` +

        `${EMOJIS.user} **User**\n` +
        `> ${target} • \`${safe(
          target.username
        )}\`\n\n` +

        `${EMOJIS.clock} **Choose Duration**\n` +
        `> Select an access period from the menu below.\n\n` +

        `${EMOJIS.info} Access will automatically expire after the selected duration.`
      )

      .setThumbnail(
        target.displayAvatarURL({
          extension:
            "png",
          size:
            128,
        })
      )

      .setFooter({
        text:
          "Zeechei • No-Prefix Access",
      })

      .setTimestamp();

  return message.reply({

    embeds: [
      embed,
    ],

    components: [
      createDurationMenu(
        target.id,
        message.author.id
      ),
    ],

    allowedMentions: {
      repliedUser:
        false,
    },

  });
}


// ============================================================
// REMOVE USER
// ============================================================

async function removeUser(
  message,
  target
) {

  const userId =
    String(
      target.id
    );

  if (
    !hasActiveAccess(
      userId
    )
  ) {

    return message.reply({

      embeds: [

        new EmbedBuilder()

          .setColor(
            "#FFFFFF"
          )

          .setDescription(
            `${EMOJIS.info} **${safe(
              target.username
            )}** does not have active No-Prefix access.`
          )

      ],

      allowedMentions: {
        repliedUser:
          false,
      },

    });
  }

  removeDatabaseAccess(
    userId
  );

  deleteUserAccess(
    userId
  );

  try {

    WebhookLogger.noprefix(
      target.tag,
      message.author.tag,
      false
    );

  } catch (_) {}

  await target
    .send(
      `${EMOJIS.remove} Your Zeechei No-Prefix access has been removed.`
    )
    .catch(
      () => {}
    );

  return message.reply({

    embeds: [

      new EmbedBuilder()

        .setColor(
          "#FFFFFF"
        )

        .setDescription(

          `${EMOJIS.check} **No-Prefix removed**\n\n` +

          `${EMOJIS.user} User: ${target}\n` +
          `${EMOJIS.info} Access has been revoked.`
        )

        .setFooter({
          text:
            "Zeechei • No-Prefix System",
        })

    ],

    allowedMentions: {
      repliedUser:
        false,
    },

  });
}


// ============================================================
// INSTALL INTERACTION HANDLER
// ============================================================

function installInteractionHandler(
  client
) {

  if (
    client.__zeecheiNoPrefixHandler
  ) {
    return;
  }

  client.__zeecheiNoPrefixHandler =
    true;

  startExpirySystem();

  client.on(
    "interactionCreate",
    async interaction => {

      try {

        if (
          !interaction.isStringSelectMenu()
        ) {
          return;
        }

        if (
          !interaction.customId.startsWith(
            "zeechei_np_duration:"
          )
        ) {
          return;
        }

        const parts =
          interaction.customId.split(
            ":"
          );

        const requesterId =
          parts[1];

        const targetId =
          parts[2];

        // Only original owner/developer
        // can use this menu.

        if (
          String(
            interaction.user.id
          ) !==
          String(
            requesterId
          )
        ) {

          return interaction.reply({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  "#FFFFFF"
                )

                .setDescription(
                  `${EMOJIS.lock} This No-Prefix menu belongs to another authorized user.`
                )

            ],

            ephemeral:
              true,

          });
        }

        if (
          !isAuthorized(
            interaction.user.id
          )
        ) {

          return interaction.reply({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  "#FFFFFF"
                )

                .setDescription(
                  `${EMOJIS.lock} You are not authorized to manage No-Prefix access.`
                )

            ],

            ephemeral:
              true,

          });
        }

        const durationKey =
          interaction.values?.[0];

        if (
          !DURATIONS[
            durationKey
          ]
        ) {

          return interaction.reply({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  "#FFFFFF"
                )

                .setDescription(
                  `${EMOJIS.warning} Invalid No-Prefix duration.`
                )

            ],

            ephemeral:
              true,

          });
        }

        // Already active

        if (
          hasActiveAccess(
            targetId
          )
        ) {

          const existing =
            getAccess(
              targetId
            );

          return interaction.update({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  "#FFFFFF"
                )

                .setTitle(
                  `${EMOJIS.info} No-Prefix Already Active`
                )

                .setDescription(

                  `${EMOJIS.user} **User:** <@${targetId}>\n\n` +

                  `${EMOJIS.clock} **Current Access:** ` +
                  `**${
                    existing?.durationLabel ||
                    "Permanent"
                  }**\n\n` +

                  `${EMOJIS.info} Remove the existing access before assigning a new duration.`
                )

                .setFooter({
                  text:
                    "Zeechei • No-Prefix System",
                })

            ],

            components: [],

          });
        }

        const result =
          activateAccess(
            targetId,
            durationKey,
            interaction.user.id
          );

        if (
          !result.success
        ) {

          let text =
            `${EMOJIS.warning} Unable to activate No-Prefix access.`;

          if (
            result.reason ===
            "already_active"
          ) {

            text =
              `${EMOJIS.info} This user already has No-Prefix access.`;
          }

          if (
            result.reason ===
            "database_error"
          ) {

            text =
              `${EMOJIS.warning} Database activation failed.`;
          }

          if (
            result.reason ===
            "storage_error"
          ) {

            text =
              `${EMOJIS.warning} Access storage failed.`;
          }

          return interaction.update({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  "#FFFFFF"
                )

                .setDescription(
                  text
                )

            ],

            components: [],

          });
        }

        const record =
          result.record;

        const duration =
          DURATIONS[
            durationKey
          ];

        // Logging

        try {

          const targetUser =
            await client.users
              .fetch(
                targetId
              )
              .catch(
                () => null
              );

          WebhookLogger.noprefix(
            targetUser?.tag ||
              targetId,
            interaction.user.tag,
            true
          );

        } catch (_) {}

        // DM user

        try {

          const targetUser =
            await client.users
              .fetch(
                targetId
              );

          await targetUser
            .send({

              embeds: [

                new EmbedBuilder()

                  .setColor(
                    "#FFFFFF"
                  )

                  .setTitle(
                    `${EMOJIS.lightning} No-Prefix Activated`
                  )

                  .setDescription(

                    `${EMOJIS.check} You have received **Zeechei No-Prefix access**.\n\n` +

                    `${EMOJIS.clock} **Duration:** ${duration.label}\n` +

                    `${EMOJIS.calendar} **Expires:** ` +
                    (
                      record.lifetime
                        ? "Never"
                        : formatDiscordDate(
                            record.expiresAt
                          )
                    )
                  )

                  .setFooter({
                    text:
                      "Zeechei • No-Prefix System",
                  })

              ],

            });

        } catch (_) {}

        return interaction.update({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setTitle(
                `${EMOJIS.check} No-Prefix Activated`
              )

              .setDescription(

                `${EMOJIS.user} **User:** <@${targetId}>\n\n` +

                `${EMOJIS.clock} **Duration:** ${duration.label}\n` +

                `${EMOJIS.calendar} **Expires:** ` +
                (
                  record.lifetime
                    ? "Never"
                    : `${formatDiscordDate(
                        record.expiresAt
                      )} • ${formatRelative(
                        record.expiresAt
                      )}`
                ) +
                `\n\n` +

                `${EMOJIS.check} Access is now active.`
              )

              .setFooter({
                text:
                  "Zeechei • No-Prefix System",
              })

          ],

          components: [],

        });

      } catch (error) {

        console.error(
          "[NoPrefix] Interaction error:",
          error
        );

        if (
          !interaction.replied &&
          !interaction.deferred
        ) {

          await interaction.reply({

            embeds: [

              new EmbedBuilder()

                .setColor(
                  "#FFFFFF"
                )

                .setDescription(
                  `${EMOJIS.warning} Something went wrong while processing No-Prefix access.`
                )

            ],

            ephemeral:
              true,

          }).catch(
            () => {}
          );
        }
      }
    }
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

    installInteractionHandler(
      client
    );

    const sub =
      String(
        args[0] || ""
      )
      .toLowerCase()
      .trim();


    // ========================================================
    // HELP
    // ========================================================

    if (
      !sub
    ) {

      return message.reply({

        embeds: [
          createHelpEmbed(),
        ],

        allowedMentions: {
          repliedUser:
            false,
        },

      });
    }


    // ========================================================
    // STATS
    // ========================================================

    if (
      [
        "stats",
        "status",
        "list",
        "users",
      ].includes(
        sub
      )
    ) {

      return sendStats(
        message,
        client
      );
    }


    // ========================================================
    // ADD
    // ========================================================

    if (
      [
        "add",
        "give",
        "grant",
      ].includes(
        sub
      )
    ) {

      const target =
        message.mentions.users.first();

      if (
        !target
      ) {

        return message.reply({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setDescription(

                `${EMOJIS.info} **No user selected.**\n\n` +

                `Use \`.np add @user\` to open the duration selector.`
              )

          ],

          allowedMentions: {
            repliedUser:
              false,
          },

        });
      }

      if (
        target.bot
      ) {

        return message.reply({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setDescription(
                `${EMOJIS.warning} Bots cannot receive No-Prefix access.`
              )

          ],

          allowedMentions: {
            repliedUser:
              false,
          },

        });
      }

      if (
        hasActiveAccess(
          target.id
        )
      ) {

        return message.reply({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setDescription(

                `${EMOJIS.info} **${safe(
                  target.username
                )}** already has active No-Prefix access.`
              )

          ],

          allowedMentions: {
            repliedUser:
              false,
          },

        });
      }

      return sendAddPanel(
        message,
        target
      );
    }


    // ========================================================
    // REMOVE
    // ========================================================

    if (
      [
        "remove",
        "delete",
        "del",
        "revoke",
      ].includes(
        sub
      )
    ) {

      const target =
        message.mentions.users.first();

      if (
        !target
      ) {

        return message.reply({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setDescription(
                `${EMOJIS.info} Use \`.np remove @user\``
              )

          ],

          allowedMentions: {
            repliedUser:
              false,
          },

        });
      }

      return removeUser(
        message,
        target
      );
    }


    // ========================================================
    // UNKNOWN
    // ========================================================

    return message.reply({

      embeds: [
        createHelpEmbed(),
      ],

      allowedMentions: {
        repliedUser:
          false,
      },

    });

  } catch (error) {

    console.error(
      "[NO PREFIX ERROR]",
      error
    );

    return message.reply({

      embeds: [

        new EmbedBuilder()

          .setColor(
            "#FFFFFF"
          )

          .setDescription(
            `${EMOJIS.warning} The No-Prefix system encountered an error.`
          )

      ],

      allowedMentions: {
        repliedUser:
          false,
      },

    }).catch(
      () => {}
    );
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

    installInteractionHandler(
      client
    );

    const sub =
      interaction.options
        .getSubcommand();


    // ========================================================
    // STATS
    // ========================================================

    if (
      sub ===
      "stats"
    ) {

      const buffer =
        await createStatsBanner(
          client
        );

      return interaction.reply({

        files: [

          new AttachmentBuilder(
            buffer,
            {
              name:
                "zeechei-noprefix-stats.png",
            }
          ),

        ],

      });
    }


    // ========================================================
    // USER
    // ========================================================

    const target =
      interaction.options
        .getUser(
          "user"
        );

    if (
      !target
    ) {

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor(
              "#FFFFFF"
            )

            .setDescription(
              `${EMOJIS.warning} Please select a user.`
            )

        ],

        ephemeral:
          true,

      });
    }


    // ========================================================
    // ADD
    // ========================================================

    if (
      sub ===
      "add"
    ) {

      if (
        target.bot
      ) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setDescription(
                `${EMOJIS.warning} Bots cannot receive No-Prefix access.`
              )

          ],

          ephemeral:
            true,

        });
      }

      if (
        hasActiveAccess(
          target.id
        )
      ) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setColor(
                "#FFFFFF"
              )

              .setDescription(
                `${EMOJIS.info} **${safe(
                  target.username
                )}** already has No-Prefix access.`
              )

          ],

          ephemeral:
            true,

        });
      }

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor(
              "#FFFFFF"
            )

            .setTitle(
              `${EMOJIS.lightning} No-Prefix Access`
            )

            .setDescription(

              `${EMOJIS.user} **User:** ${target}\n\n` +

              `${EMOJIS.clock} Choose the access duration below.`
            )

        ],

        components: [

          createDurationMenu(
            target.id,
            interaction.user.id
          ),

        ],

        ephemeral:
          true,

      });
    }


    // ========================================================
    // REMOVE
    // ========================================================

    if (
      sub ===
      "remove"
    ) {

      const fakeMessage = {

        author:
          interaction.user,

        prefix:
          ".",

        reply:
          options =>
            interaction.reply(
              options
            ),

      };

      return removeUser(
        fakeMessage,
        target
      );
    }

  } catch (error) {

    console.error(
      "[NO PREFIX SLASH ERROR]",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setColor(
              "#FFFFFF"
            )

            .setDescription(
              `${EMOJIS.warning} The No-Prefix system encountered an error.`
            )

        ],

        ephemeral:
          true,

      }).catch(
        () => {}
      );
    }
  }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

  name:
    "noprefix",

  aliases: [
    "np",
    "noprefixes",
    "nps",
  ],

  description:
    "Manage Zeechei No-Prefix access.",

  category:
    "settings",

  usage:
    ".np [stats|add|remove]",

  examples: [
    ".np",
    ".np stats",
    ".np add @user",
    ".np remove @user",
  ],

  ownerOnly:
    true,

  data:

    new SlashCommandBuilder()

      .setName(
        "noprefix"
      )

      .setDescription(
        "Manage Zeechei No-Prefix access."
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              "stats"
            )
            .setDescription(
              "Show live No-Prefix statistics."
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              "add"
            )
            .setDescription(
              "Grant No-Prefix access."
            )
            .addUserOption(
              option =>
                option
                  .setName(
                    "user"
                  )
                  .setDescription(
                    "User to authorize."
                  )
                  .setRequired(
                    true
                  )
            )
      )

      .addSubcommand(
        sub =>
          sub
            .setName(
              "remove"
            )
            .setDescription(
              "Remove No-Prefix access."
            )
            .addUserOption(
              option =>
                option
                  .setName(
                    "user"
                  )
                  .setDescription(
                    "User to remove."
                  )
                  .setRequired(
                    true
                  )
            )
      ),

  getSlashArgs:
    opts => {

      const sub =
        opts.getSubcommand(
          false
        );

      if (
        !sub
      ) {
        return [];
      }

      if (
        sub ===
        "stats"
      ) {
        return [
          "stats",
        ];
      }

      const user =
        opts.getUser(
          "user"
        );

      return [
        sub,
        user
          ? `<@${user.id}>`
          : "_",
      ];
    },

  execute,

  executeSlash,

};