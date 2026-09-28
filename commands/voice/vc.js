"use strict";

const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");

const fs = require("fs");
const path = require("path");

/* ==========================================================================
   ZEECHEI VOICE CONTROL SYSTEM
   commands/voice/vc.js

   PREFIX IS NOT USED FOR PARSING.
   The command loader's actual message content is detected automatically.

   Supported:
   ,,,vc
   ,,,vc help
   ,,,vc stats
   ,,,vc stats @user
   ,,,vc lb
   ,,,vc lb 2
   ,,,vc role
   ,,,vc role @role
   ,,,vc role off

   Direct aliases:
   ,,,vcstats
   ,,,vcstats @user
   ,,,vcstats SERVER_ID       owner only
   ,,,vclb
   ,,,vclb 2
   ,,,vcrole
   ,,,vcrole @role
   ,,,vcrole off

   IMPORTANT:
   OWNER_IDS is read from config.js (env: OWNER_ID / OWNER_IDS).
========================================================================== */


/* ==========================================================================
   CONFIG
========================================================================== */

const _cfg = require("../../config");
const OWNER_IDS = [_cfg.mainOwnerId, ...(_cfg.ownerIds || [])].filter(Boolean);

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "zeechei-vc.json");

const PAGE_SIZE = 10;

const EMBED_COLOR = 0x38BDF8;

const SKY = "#38BDF8";
const SKY_DARK = "#0284C7";
const BACKGROUND = "#07111F";
const WHITE = "#FFFFFF";
const MUTED = "#9FB7CC";

const initializedClients = new WeakSet();


/* ==========================================================================
   DATABASE
========================================================================== */

function ensureDatabase() {
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
          version: 2,
          guilds: {},
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return {
        version: 2,
        guilds: {},
      };
    }

    const data = JSON.parse(raw);

    if (!data.guilds || typeof data.guilds !== "object") {
      data.guilds = {};
    }

    if (!data.version) {
      data.version = 2;
    }

    return data;
  } catch (error) {
    console.error("[Zeechei VC] Database read error:", error);

    return {
      version: 2,
      guilds: {},
    };
  }
}

function writeDatabase(data) {
  ensureDatabase();

  const tempFile = `${DATA_FILE}.tmp`;

  try {
    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(tempFile, DATA_FILE);
  } catch (error) {
    console.error("[Zeechei VC] Database write error:", error);

    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (_) {}
  }
}

function createGuildData(guildId) {
  return {
    guildId,

    settings: {
      enabled: true,
      vcRoleId: null,
    },

    totalJoins: 0,
    totalLeaves: 0,
    totalSeconds: 0,

    users: {},
  };
}

function getGuildData(db, guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] =
      createGuildData(guildId);
  }

  const guildData = db.guilds[guildId];

  if (!guildData.settings) {
    guildData.settings = {
      enabled: true,
      vcRoleId: null,
    };
  }

  if (
    typeof guildData.settings.enabled !==
    "boolean"
  ) {
    guildData.settings.enabled = true;
  }

  if (!Object.prototype.hasOwnProperty.call(
    guildData.settings,
    "vcRoleId"
  )) {
    guildData.settings.vcRoleId = null;
  }

  if (!Number.isFinite(guildData.totalJoins)) {
    guildData.totalJoins = 0;
  }

  if (!Number.isFinite(guildData.totalLeaves)) {
    guildData.totalLeaves = 0;
  }

  if (!Number.isFinite(guildData.totalSeconds)) {
    guildData.totalSeconds = 0;
  }

  if (!guildData.users) {
    guildData.users = {};
  }

  return guildData;
}

function getUserData(
  guildData,
  userId,
  username = "Unknown User"
) {
  if (!guildData.users[userId]) {
    guildData.users[userId] = {
      userId,
      username,

      joins: 0,
      leaves: 0,

      totalSeconds: 0,

      currentSession: null,

      lastJoin: null,
      lastLeave: null,
    };
  }

  const user = guildData.users[userId];

  if (
    username &&
    username !== "Unknown User"
  ) {
    user.username = username;
  }

  if (!Number.isFinite(user.joins)) {
    user.joins = 0;
  }

  if (!Number.isFinite(user.leaves)) {
    user.leaves = 0;
  }

  if (!Number.isFinite(user.totalSeconds)) {
    user.totalSeconds = 0;
  }

  return user;
}


/* ==========================================================================
   TIME
========================================================================== */

function getLiveSeconds(user) {
  let seconds =
    Number(user.totalSeconds) || 0;

  if (
    user.currentSession &&
    Number.isFinite(
      user.currentSession.startedAt
    )
  ) {
    seconds += Math.max(
      0,
      Math.floor(
        (Date.now() -
          user.currentSession.startedAt) /
          1000
      )
    );
  }

  return seconds;
}

function formatDuration(totalSeconds) {
  let seconds = Math.max(
    0,
    Math.floor(
      Number(totalSeconds) || 0
    )
  );

  const days = Math.floor(
    seconds / 86400
  );

  seconds %= 86400;

  const hours = Math.floor(
    seconds / 3600
  );

  seconds %= 3600;

  const minutes = Math.floor(
    seconds / 60
  );

  seconds %= 60;

  const parts = [];

  if (days) {
    parts.push(`${days}d`);
  }

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (minutes) {
    parts.push(`${minutes}m`);
  }

  if (
    seconds ||
    parts.length === 0
  ) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "Never";
  }

  const value =
    Math.floor(
      Number(timestamp) / 1000
    );

  if (!Number.isFinite(value)) {
    return "Unknown";
  }

  return `<t:${value}:R>`;
}


/* ==========================================================================
   CANVAS BANNER
========================================================================== */

function createBanner(
  title,
  subtitle = "ZEECHEI VOICE SYSTEM"
) {
  const width = 1600;
  const height = 470;

  const canvas =
    createCanvas(
      width,
      height
    );

  const ctx =
    canvas.getContext("2d");

  /* Background */
  ctx.fillStyle =
    BACKGROUND;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  /* Main glow */
  const glow =
    ctx.createRadialGradient(
      1240,
      120,
      20,
      1240,
      120,
      600
    );

  glow.addColorStop(
    0,
    "rgba(56,189,248,0.30)"
  );

  glow.addColorStop(
    0.35,
    "rgba(56,189,248,0.10)"
  );

  glow.addColorStop(
    1,
    "rgba(56,189,248,0)"
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  /* Secondary glow */
  const glow2 =
    ctx.createRadialGradient(
      250,
      430,
      10,
      250,
      430,
      500
    );

  glow2.addColorStop(
    0,
    "rgba(2,132,199,0.18)"
  );

  glow2.addColorStop(
    1,
    "rgba(2,132,199,0)"
  );

  ctx.fillStyle = glow2;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  /* Grid */
  ctx.strokeStyle =
    "rgba(56,189,248,0.055)";

  ctx.lineWidth = 1;

  for (
    let x = 0;
    x <= width;
    x += 64
  ) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (
    let y = 0;
    y <= height;
    y += 64
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  /* Left accent */
  const accent =
    ctx.createLinearGradient(
      0,
      0,
      0,
      height
    );

  accent.addColorStop(
    0,
    SKY
  );

  accent.addColorStop(
    1,
    SKY_DARK
  );

  ctx.fillStyle = accent;

  ctx.fillRect(
    0,
    0,
    8,
    height
  );

  /* Decorative circles */
  ctx.strokeStyle =
    "rgba(56,189,248,0.18)";

  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.arc(
    1320,
    130,
    90,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.arc(
    1320,
    130,
    130,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.arc(
    1320,
    130,
    170,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  /* Small squares */
  ctx.fillStyle =
    "rgba(56,189,248,0.25)";

  ctx.fillRect(
    1150,
    320,
    8,
    8
  );

  ctx.fillRect(
    1190,
    360,
    5,
    5
  );

  ctx.fillRect(
    1430,
    350,
    7,
    7
  );

  /* Title */
  ctx.font =
    "bold 78px Sans";

  ctx.fillStyle =
    WHITE;

  ctx.fillText(
    String(title).slice(0, 35),
    85,
    195
  );

  /* Subtitle */
  ctx.font =
    "32px Sans";

  ctx.fillStyle =
    SKY;

  ctx.fillText(
    String(subtitle).slice(0, 55),
    88,
    250
  );

  /* Branding */
  ctx.font =
    "bold 25px Sans";

  ctx.fillStyle =
    MUTED;

  ctx.fillText(
    "ZEECHEI  •  VOICE ANALYTICS",
    88,
    350
  );

  /* Bottom line */
  ctx.fillStyle =
    SKY;

  ctx.fillRect(
    88,
    390,
    560,
    4
  );

  /* Status */
  ctx.font =
    "22px Sans";

  ctx.fillStyle =
    MUTED;

  ctx.fillText(
    "LIVE • PER SERVER • AUTOMATED",
    88,
    430
  );

  return canvas.toBuffer(
    "image/png"
  );
}


/* ==========================================================================
   BANNER SENDER
========================================================================== */

async function sendBanner(
  channel,
  {
    title = "ZEECHEI VC",
    subtitle = "ZEECHEI VOICE SYSTEM",
    description = "",
    fields = [],
    components = [],
    footer = "Zeechei Voice System",
  } = {}
) {
  if (
    !channel ||
    typeof channel.send !== "function"
  ) {
    throw new Error(
      "[Zeechei VC] Invalid Discord channel. Command context was not normalized correctly."
    );
  }

  const image =
    createBanner(
      title,
      subtitle
    );

  const attachment =
    new AttachmentBuilder(
      image,
      {
        name: "zeechei-vc.png",
      }
    );

  const embed =
    new EmbedBuilder()
      .setColor(
        EMBED_COLOR
      )
      .setImage(
        "attachment://zeechei-vc.png"
      )
      .setDescription(
        description || null
      )
      .setFooter({
        text: footer,
      })
      .setTimestamp();

  if (fields.length) {
    embed.addFields(
      fields
    );
  }

  return channel.send({
    embeds: [embed],
    files: [attachment],
    components,
  });
}


/* ==========================================================================
   COMMAND CONTEXT NORMALIZER

   This is the important fix for the screenshot error.

   It accepts:
     execute(message, args, client)
     execute(args, message, client)
     execute({ message, args, client })
     execute({ msg, args, client })
     execute({ context: { message, args, client } })

   So the command does not blindly assume that the first argument is message.
========================================================================== */

function isDiscordMessage(value) {
  return !!(
    value &&
    typeof value === "object" &&
    value.channel &&
    typeof value.channel.send ===
      "function"
  );
}

function isDiscordClient(value) {
  return !!(
    value &&
    typeof value === "object" &&
    value.guilds &&
    value.user
  );
}

function normalizeContext(
  parameters
) {
  let message = null;
  let args = [];
  let client = null;

  for (const parameter of parameters) {
    if (!parameter) {
      continue;
    }

    if (isDiscordMessage(parameter)) {
      message = parameter;
      continue;
    }

    if (isDiscordClient(parameter)) {
      client = parameter;
      continue;
    }

    if (
      Array.isArray(parameter)
    ) {
      args = parameter;
      continue;
    }

    if (
      typeof parameter === "object"
    ) {
      if (
        isDiscordMessage(
          parameter.message
        )
      ) {
        message =
          parameter.message;
      }

      if (
        !message &&
        isDiscordMessage(
          parameter.msg
        )
      ) {
        message =
          parameter.msg;
      }

      if (
        !message &&
        isDiscordMessage(
          parameter.context?.message
        )
      ) {
        message =
          parameter.context.message;
      }

      if (
        Array.isArray(
          parameter.args
        )
      ) {
        args =
          parameter.args;
      }

      if (
        parameter.client &&
        isDiscordClient(
          parameter.client
        )
      ) {
        client =
          parameter.client;
      }
    }
  }

  if (
    !client &&
    message?.client
  ) {
    client =
      message.client;
  }

  /*
   * Some loaders send:
   * execute(message, ...args)
   */
  if (
    message &&
    args.length === 0 &&
    parameters.length > 1
  ) {
    const possibleArgs =
      parameters.slice(1).filter(
        (x) =>
          typeof x === "string" ||
          typeof x === "number"
      );

    if (possibleArgs.length) {
      args =
        possibleArgs.map(String);
    }
  }

  return {
    message,
    args,
    client,
  };
}


/* ==========================================================================
   OWNER SYSTEM
========================================================================== */

function getOwnerIds(client) {
  const result = [
    ...OWNER_IDS,
  ];

  const possibleSources = [
    client?.config?.ownerIds,
    client?.config?.owners,
    client?.config?.ownerID,
    client?.config?.ownerId,
    client?.ownerIds,
    client?.ownerID,
    client?.ownerId,
  ];

  for (
    const source of possibleSources
  ) {
    if (!source) {
      continue;
    }

    if (
      Array.isArray(source)
    ) {
      result.push(
        ...source
      );
    } else if (
      typeof source === "string"
    ) {
      result.push(
        ...source
          .split(",")
          .map((x) =>
            x.trim()
          )
          .filter(Boolean)
      );
    }
  }

  return [
    ...new Set(
      result.filter(Boolean)
    ),
  ];
}

function isOwner(
  userId,
  client
) {
  return getOwnerIds(
    client
  ).includes(
    String(userId)
  );
}


/* ==========================================================================
   INVOKED COMMAND DETECTION
========================================================================== */

function detectInvokedCommand(
  message
) {
  const content =
    String(
      message?.content || ""
    )
      .trim();

  if (!content) {
    return "vc";
  }

  const firstToken =
    content.split(
      /\s+/
    )[0];

  /*
   * ,,vcstats
   * ?vcstats
   * .vcstats
   * vcstats
   *
   * Strip every non-letter/non-number
   * prefix character.
   */
  const command =
    firstToken
      .toLowerCase()
      .replace(
        /^[^a-z0-9]+/i,
        ""
      );

  return command || "vc";
}


/* ==========================================================================
   MEMBER RESOLUTION
========================================================================== */

function resolveMember(
  message,
  input
) {
  if (!message?.guild) {
    return null;
  }

  if (!input) {
    return message.member;
  }

  const mention =
    String(input).match(
      /^<@!?(\d+)>$/
    );

  if (mention) {
    return (
      message.guild.members.cache.get(
        mention[1]
      ) || null
    );
  }

  const clean =
    String(input)
      .replace(
        /[<@!>]/g,
        ""
      )
      .trim();

  if (
    /^\d{17,20}$/.test(
      clean
    )
  ) {
    return (
      message.guild.members.cache.get(
        clean
      ) || null
    );
  }

  const lower =
    String(input)
      .toLowerCase();

  return (
    message.guild.members.cache.find(
      (member) =>
        member.user.username
          .toLowerCase() ===
          lower ||
        member.displayName
          .toLowerCase() ===
          lower ||
        member.user.tag
          ?.toLowerCase() ===
          lower
    ) || null
  );
}


/* ==========================================================================
   VOICE TRACKING
========================================================================== */

function recordJoin(
  oldState,
  newState
) {
  if (!newState?.guild) {
    return;
  }

  /*
   * Only:
   *
   * NO VC -> VC
   *
   * A -> B is NOT counted as a new join.
   */
  if (
    oldState.channelId ||
    !newState.channelId
  ) {
    return;
  }

  const member =
    newState.member;

  if (
    !member ||
    member.user?.bot
  ) {
    return;
  }

  const db =
    readDatabase();

  const guildData =
    getGuildData(
      db,
      newState.guild.id
    );

  if (
    guildData.settings.enabled ===
    false
  ) {
    return;
  }

  const user =
    getUserData(
      guildData,
      member.id,
      member.user.username
    );

  const now =
    Date.now();

  /*
   * CRITICAL:
   * Increment immediately.
   *
   * Therefore even:
   *
   * Join -> 1 second -> Leave
   *
   * gets joins = +1 permanently.
   */
  user.joins += 1;

  user.lastJoin =
    now;

  user.currentSession = {
    startedAt: now,
    channelId:
      newState.channelId,
  };

  guildData.totalJoins += 1;

  writeDatabase(
    db
  );

  /*
   * Automatic role.
   */
  applyVoiceRole(
    member,
    guildData.settings.vcRoleId
  ).catch(() => {});
}

function recordLeave(
  oldState,
  newState
) {
  if (!oldState?.guild) {
    return;
  }

  /*
   * Only:
   *
   * VC -> NO VC
   */
  if (
    !oldState.channelId ||
    newState.channelId
  ) {
    return;
  }

  const member =
    oldState.member;

  if (
    !member ||
    member.user?.bot
  ) {
    return;
  }

  const db =
    readDatabase();

  const guildData =
    getGuildData(
      db,
      oldState.guild.id
    );

  if (
    guildData.settings.enabled ===
    false
  ) {
    return;
  }

  const user =
    getUserData(
      guildData,
      member.id,
      member.user.username
    );

  const now =
    Date.now();

  user.leaves += 1;

  user.lastLeave =
    now;

  if (
    user.currentSession &&
    Number.isFinite(
      user.currentSession.startedAt
    )
  ) {
    const duration =
      Math.max(
        0,
        Math.floor(
          (
            now -
            user.currentSession.startedAt
          ) / 1000
        )
      );

    user.totalSeconds +=
      duration;

    guildData.totalSeconds +=
      duration;
  }

  user.currentSession =
    null;

  guildData.totalLeaves +=
    1;

  writeDatabase(
    db
  );

  removeVoiceRole(
    member,
    guildData.settings.vcRoleId
  ).catch(() => {});
}


/* ==========================================================================
   AUTOMATIC VOICE ROLE
========================================================================== */

async function applyVoiceRole(
  member,
  roleId
) {
  if (!roleId) {
    return;
  }

  const role =
    member.guild.roles.cache.get(
      roleId
    );

  if (!role) {
    return;
  }

  const me =
    member.guild.members.me;

  if (!me) {
    return;
  }

  if (
    !me.permissions.has(
      PermissionsBitField.Flags.ManageRoles
    )
  ) {
    return;
  }

  if (
    role.managed ||
    role.position >=
      me.roles.highest.position
  ) {
    return;
  }

  if (
    !member.roles.cache.has(
      role.id
    )
  ) {
    await member.roles
      .add(role)
      .catch(() => {});
  }
}

async function removeVoiceRole(
  member,
  roleId
) {
  if (!roleId) {
    return;
  }

  const role =
    member.guild.roles.cache.get(
      roleId
    );

  if (!role) {
    return;
  }

  const me =
    member.guild.members.me;

  if (!me) {
    return;
  }

  if (
    !me.permissions.has(
      PermissionsBitField.Flags.ManageRoles
    )
  ) {
    return;
  }

  if (
    role.managed ||
    role.position >=
      me.roles.highest.position
  ) {
    return;
  }

  if (
    member.roles.cache.has(
      role.id
    )
  ) {
    await member.roles
      .remove(role)
      .catch(() => {});
  }
}


/* ==========================================================================
   STARTUP RECOVERY
========================================================================== */

function recoverSessions(
  client
) {
  const db =
    readDatabase();

  let changed =
    false;

  for (
    const [guildId, guildData]
    of Object.entries(
      db.guilds
    )
  ) {
    const guild =
      client.guilds.cache.get(
        guildId
      );

    if (!guild) {
      continue;
    }

    for (
      const [userId, user]
      of Object.entries(
        guildData.users || {}
      )
    ) {
      const member =
        guild.members.cache.get(
          userId
        );

      if (!member) {
        continue;
      }

      /*
       * If Zeechei restarted while member
       * is in VC, continue a live session.
       */
      if (
        member.voice?.channelId &&
        !user.currentSession
      ) {
        user.currentSession = {
          startedAt: Date.now(),
          channelId:
            member.voice.channelId,
        };

        changed = true;
      }

      /*
       * Stale session cleanup.
       */
      if (
        !member.voice?.channelId &&
        user.currentSession
      ) {
        const startedAt =
          Number(
            user.currentSession.startedAt
          );

        if (
          Number.isFinite(
            startedAt
          )
        ) {
          const duration =
            Math.max(
              0,
              Math.floor(
                (
                  Date.now() -
                  startedAt
                ) / 1000
              )
            );

          user.totalSeconds +=
            duration;

          guildData.totalSeconds +=
            duration;
        }

        user.currentSession =
          null;

        user.lastLeave =
          Date.now();

        changed = true;
      }
    }
  }

  if (changed) {
    writeDatabase(
      db
    );
  }
}


/* ==========================================================================
   INITIALIZATION
========================================================================== */

function initialize(
  client
) {
  if (
    !client ||
    typeof client.on !==
      "function"
  ) {
    throw new Error(
      "[Zeechei VC] initialize(client) requires a valid Discord client."
    );
  }

  if (
    initializedClients.has(
      client
    )
  ) {
    return;
  }

  initializedClients.add(
    client
  );

  /*
   * LIVE VC TRACKING
   */
  client.on(
    "voiceStateUpdate",
    (oldState, newState) => {
      try {
        recordJoin(
          oldState,
          newState
        );

        recordLeave(
          oldState,
          newState
        );
      } catch (error) {
        console.error(
          "[Zeechei VC] voiceStateUpdate error:",
          error
        );
      }
    }
  );

  /*
   * New server = automatically create its database.
   */
  client.on(
    "guildCreate",
    (guild) => {
      try {
        const db =
          readDatabase();

        getGuildData(
          db,
          guild.id
        );

        writeDatabase(
          db
        );

        console.log(
          `[Zeechei VC] Tracking started: ${guild.name} (${guild.id})`
        );
      } catch (error) {
        console.error(
          "[Zeechei VC] guildCreate error:",
          error
        );
      }
    }
  );

  /*
   * Startup recovery.
   */
  const recover = () => {
    try {
      recoverSessions(
        client
      );

      console.log(
        `[Zeechei VC] Live VC system active in ${client.guilds.cache.size} servers.`
      );
    } catch (error) {
      console.error(
        "[Zeechei VC] startup recovery error:",
        error
      );
    }
  };

  if (
    client.isReady?.()
  ) {
    recover();
  } else {
    client.once(
      "ready",
      recover
    );
  }

  /*
   * Pagination interaction handler.
   */
  client.on(
    "interactionCreate",
    async (interaction) => {
      if (
        !interaction.isButton()
      ) {
        return;
      }

      if (
        !interaction.customId.startsWith(
          "zeechei_vc_lb:"
        )
      ) {
        return;
      }

      try {
        await handleLeaderboardButton(
          interaction
        );
      } catch (error) {
        console.error(
          "[Zeechei VC] leaderboard interaction error:",
          error
        );

        if (
          !interaction.replied &&
          !interaction.deferred
        ) {
          await interaction
            .reply({
              content:
                "The VC leaderboard could not be updated.",
              ephemeral: true,
            })
            .catch(() => {});
        }
      }
    }
  );

  console.log(
    "[Zeechei VC] Voice tracking initialized."
  );
}


/* ==========================================================================
   SERVER TOTALS
========================================================================== */

function getServerTotals(
  guildData
) {
  let activeUsers =
    0;

  let liveSeconds =
    0;

  const users =
    Object.values(
      guildData.users || {}
    );

  for (
    const user of users
  ) {
    if (
      user.currentSession
    ) {
      activeUsers +=
        1;

      liveSeconds +=
        Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              user.currentSession.startedAt
            ) / 1000
          )
        );
    }
  }

  return {
    users:
      users.filter(
        (user) =>
          user.joins > 0
      ).length,

    activeUsers,

    totalJoins:
      Number(
        guildData.totalJoins
      ) || 0,

    totalLeaves:
      Number(
        guildData.totalLeaves
      ) || 0,

    totalSeconds:
      (
        Number(
          guildData.totalSeconds
        ) || 0
      ) +
      liveSeconds,
  };
}


/* ==========================================================================
   LEADERBOARD
========================================================================== */

function getLeaderboard(
  guildData
) {
  return Object.values(
    guildData.users || {}
  )
    .filter(
      (user) =>
        Number(user.joins) > 0
    )
    .sort(
      (a, b) => {
        const timeDifference =
          getLiveSeconds(b) -
          getLiveSeconds(a);

        if (
          timeDifference !== 0
        ) {
          return timeDifference;
        }

        return (
          (Number(b.joins) || 0) -
          (Number(a.joins) || 0)
        );
      }
    );
}

function getPageData(
  guildData,
  page
) {
  const leaderboard =
    getLeaderboard(
      guildData
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        leaderboard.length /
          PAGE_SIZE
      )
    );

  const safePage =
    Math.min(
      Math.max(
        1,
        Number(page) || 1
      ),
      totalPages
    );

  const start =
    (safePage - 1) *
    PAGE_SIZE;

  const entries =
    leaderboard.slice(
      start,
      start + PAGE_SIZE
    );

  return {
    leaderboard,
    entries,
    page:
      safePage,
    totalPages,
  };
}


/* ==========================================================================
   LEADERBOARD BUTTONS
========================================================================== */

function createLeaderboardRow(
  guildId,
  page,
  totalPages,
  requesterId = "all"
) {
  const makeId =
    (action) =>
      `zeechei_vc_lb:${guildId}:${action}:${page}:${requesterId}`;

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          makeId("first")
        )
        .setLabel("First")
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(
          page <= 1
        ),

      new ButtonBuilder()
        .setCustomId(
          makeId("prev")
        )
        .setLabel("Previous")
        .setStyle(
          ButtonStyle.Primary
        )
        .setDisabled(
          page <= 1
        ),

      new ButtonBuilder()
        .setCustomId(
          `zeechei_vc_lb:${guildId}:page:${page}:${requesterId}`
        )
        .setLabel(
          `${page} / ${totalPages}`
        )
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId(
          makeId("next")
        )
        .setLabel("Next")
        .setStyle(
          ButtonStyle.Primary
        )
        .setDisabled(
          page >= totalPages
        ),

      new ButtonBuilder()
        .setCustomId(
          makeId("last")
        )
        .setLabel("Last")
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(
          page >= totalPages
        )
    );
}


/* ==========================================================================
   LEADERBOARD DESCRIPTION
========================================================================== */

function buildLeaderboardDescription(
  guild,
  guildData,
  page
) {
  const data =
    getPageData(
      guildData,
      page
    );

  if (
    !data.entries.length
  ) {
    return {
      description:
        "**No VC activity recorded yet.**\n\n" +
        "The leaderboard will automatically populate when members enter voice channels.",
      page:
        data.page,
      totalPages:
        data.totalPages,
      tracked:
        data.leaderboard.length,
    };
  }

  const lines =
    data.entries.map(
      (user, index) => {
        const position =
          (
            data.page - 1
          ) *
            PAGE_SIZE +
          index +
          1;

        const status =
          user.currentSession
            ? " • LIVE"
            : "";

        return (
          `**${position}. ${user.username || "Unknown User"}**\n` +
          `\`${formatDuration(
            getLiveSeconds(user)
          )}\`  •  \`${user.joins || 0}\` joins${status}`
        );
      }
    );

  return {
    description:
      `**${guild?.name || "Server"} — Voice Leaderboard**\n\n` +
      lines.join(
        "\n\n"
      ),
    page:
      data.page,
    totalPages:
      data.totalPages,
    tracked:
      data.leaderboard.length,
  };
}


/* ==========================================================================
   SEND LEADERBOARD
========================================================================== */

async function sendLeaderboard(
  channel,
  guild,
  page = 1,
  requesterId = "all"
) {
  const db =
    readDatabase();

  const guildData =
    getGuildData(
      db,
      guild.id
    );

  const data =
    buildLeaderboardDescription(
      guild,
      guildData,
      page
    );

  const row =
    createLeaderboardRow(
      guild.id,
      data.page,
      data.totalPages,
      requesterId
    );

  return sendBanner(
    channel,
    {
      title:
        "VOICE LEADERBOARD",

      subtitle:
        "Live Complete Server Ranking",

      description:
        data.description,

      fields: [
        {
          name:
            "Current Page",
          value:
            `${data.page} / ${data.totalPages}`,
          inline: true,
        },

        {
          name:
            "Tracked Members",
          value:
            String(
              data.tracked
            ),
          inline: true,
        },

        {
          name:
            "Ranking",
          value:
            "VC time + joins",
          inline: true,
        },
      ],

      components: [
        row,
      ],

      footer:
        "Zeechei • Live Voice Leaderboard",
    }
  );
}


/* ==========================================================================
   GUIDE
========================================================================== */

async function sendGuide(
  message
) {
  return sendBanner(
    message.channel,
    {
      title:
        "VOICE CONTROL",

      subtitle:
        "Complete Zeechei VC Guide",

      description:
        `**Zeechei Voice Control**\n\n` +
        `A fully automated per-server voice analytics system.\n\n` +

        `**VC SYSTEM**\n` +
        `\`vc\` — Open this guide\n` +
        `\`vc stats\` — Server VC statistics\n` +
        `\`vc stats @user\` — User VC statistics\n` +
        `\`vc lb\` — Complete VC leaderboard\n` +
        `\`vc lb 2\` — Open leaderboard page 2\n` +
        `\`vc role\` — Show VC role configuration\n` +
        `\`vc role @role\` — Enable automatic VC role\n` +
        `\`vc role off\` — Disable automatic VC role\n\n` +

        `**DIRECT COMMANDS**\n` +
        `\`vcstats\` — Server statistics\n` +
        `\`vcstats @user\` — User statistics\n` +
        `\`vcstats SERVER_ID\` — Owner-only server analytics\n` +
        `\`vclb\` — Voice leaderboard\n` +
        `\`vclb 2\` — Leaderboard page 2\n` +
        `\`vcrole\` — VC role settings\n\n` +

        `**AUTOMATIC TRACKING**\n` +
        `Every real voice-channel entrance is recorded automatically.\n\n` +
        `A member joining for **1 second** still counts as **1 VC join**.\n\n` +
        `Voice time is calculated live while the member remains in VC.`,

      fields: [
        {
          name:
            "Tracking",
          value:
            "Automatic",
          inline: true,
        },
        {
          name:
            "Scope",
          value:
            "Per Server",
          inline: true,
        },
        {
          name:
            "Leaderboard",
          value:
            "Paginated",
          inline: true,
        },
      ],

      footer:
        "Zeechei • Voice Analytics",
    }
  );
}


/* ==========================================================================
   VC ROLE
========================================================================== */

async function handleVcRole(
  message,
  args
) {
  const guild =
    message.guild;

  const db =
    readDatabase();

  const guildData =
    getGuildData(
      db,
      guild.id
    );

  const currentRoleId =
    guildData.settings.vcRoleId;

  const currentRole =
    currentRoleId
      ? guild.roles.cache.get(
          currentRoleId
        )
      : null;

  /*
   * Show current configuration.
   */
  if (!args[0]) {
    return sendBanner(
      message.channel,
      {
        title:
          "VC ROLE",

        subtitle:
          "Automatic Voice Role",

        description:
          currentRole
            ? `Automatic VC role is **enabled**.\n\nConfigured role: <@&${currentRole.id}>\n\nZeechei will assign the role when a member enters VC and remove it when they leave.`
            : `Automatic VC role is currently **disabled**.\n\nUse \`vcrole @role\` to enable it.`,

        fields: [
          {
            name:
              "Status",
            value:
              currentRole
                ? "Enabled"
                : "Disabled",
            inline: true,
          },
          {
            name:
              "Role",
            value:
              currentRole
                ? `<@&${currentRole.id}>`
                : "Not configured",
            inline: true,
          },
        ],

        footer:
          "Zeechei • VC Role System",
      }
    );
  }

  /*
   * Permission.
   */
  if (
    !message.member.permissions.has(
      PermissionsBitField.Flags.ManageRoles
    )
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "ACCESS DENIED",

        subtitle:
          "VC Role Configuration",

        description:
          "You need **Manage Roles** permission to configure the automatic VC role.",
      }
    );
  }

  const action =
    String(
      args[0]
    ).toLowerCase();

  /*
   * Disable.
   */
  if (
    action === "off" ||
    action === "disable" ||
    action === "remove"
  ) {
    guildData.settings.vcRoleId =
      null;

    writeDatabase(
      db
    );

    return sendBanner(
      message.channel,
      {
        title:
          "VC ROLE DISABLED",

        subtitle:
          "Automatic Role System",

        description:
          "Automatic VC role assignment has been disabled for this server.",
      }
    );
  }

  /*
   * Extract role ID.
   */
  const mention =
    String(
      args[0]
    ).match(
      /^<@&(\d+)>$/
    );

  const roleId =
    mention
      ? mention[1]
      : String(
          args[0]
        ).replace(
          /\D/g,
          ""
        );

  if (!roleId) {
    return sendBanner(
      message.channel,
      {
        title:
          "INVALID ROLE",

        subtitle:
          "VC Role Configuration",

        description:
          "Provide a valid role mention.\n\nExample:\n`vcrole @Voice`",
      }
    );
  }

  const role =
    guild.roles.cache.get(
      roleId
    );

  if (!role) {
    return sendBanner(
      message.channel,
      {
        title:
          "ROLE NOT FOUND",

        subtitle:
          "VC Role Configuration",

        description:
          "That role could not be found in this server.",
      }
    );
  }

  const me =
    guild.members.me;

  if (!me) {
    return sendBanner(
      message.channel,
      {
        title:
          "BOT MEMBER ERROR",

        subtitle:
          "VC Role Configuration",

        description:
          "Zeechei's server member could not be resolved.",
      }
    );
  }

  if (
    !me.permissions.has(
      PermissionsBitField.Flags.ManageRoles
    )
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "MISSING PERMISSION",

        subtitle:
          "VC Role Configuration",

        description:
          "Zeechei needs **Manage Roles** permission.",
      }
    );
  }

  if (
    role.managed
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "MANAGED ROLE",

        subtitle:
          "VC Role Configuration",

        description:
          "Discord-managed roles cannot be assigned by Zeechei.",
      }
    );
  }

  if (
    role.position >=
    me.roles.highest.position
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "ROLE HIERARCHY",

        subtitle:
          "VC Role Configuration",

        description:
          "Move Zeechei's highest role **above** the selected role and try again.",
      }
    );
  }

  guildData.settings.vcRoleId =
    role.id;

  writeDatabase(
    db
  );

  return sendBanner(
    message.channel,
    {
      title:
        "VC ROLE ACTIVE",

      subtitle:
        "Automatic Voice Role",

      description:
        `Automatic VC role has been enabled.\n\nRole: <@&${role.id}>\n\nMembers entering VC will automatically receive this role, and it will be removed when they leave.`,
      
      fields: [
        {
          name:
            "Status",
          value:
            "Enabled",
          inline: true,
        },
        {
          name:
            "Assigned Role",
          value:
            `<@&${role.id}>`,
          inline: true,
        },
      ],

      footer:
        "Zeechei • Automatic VC Role",
    }
  );
}


/* ==========================================================================
   SERVER STATS
========================================================================== */

async function sendServerStats(
  message,
  guild
) {
  const db =
    readDatabase();

  const guildData =
    getGuildData(
      db,
      guild.id
    );

  const totals =
    getServerTotals(
      guildData
    );

  const leaderboard =
    getLeaderboard(
      guildData
    );

  const top =
    leaderboard.slice(
      0,
      5
    );

  const topText =
    top.length
      ? top
          .map(
            (user, index) =>
              `**${index + 1}. ${user.username || "Unknown User"}** — ${formatDuration(
                getLiveSeconds(user)
              )} • ${user.joins || 0} joins`
          )
          .join("\n")
      : "No VC activity recorded yet.";

  return sendBanner(
    message.channel,
    {
      title:
        "VC STATISTICS",

      subtitle:
        "Live Per-Server Analytics",

      description:
        `**${guild.name}**\n\nLive voice statistics for this server.`,

      fields: [
        {
          name:
            "Total Joins",
          value:
            String(
              totals.totalJoins
            ),
          inline: true,
        },

        {
          name:
            "Total Leaves",
          value:
            String(
              totals.totalLeaves
            ),
          inline: true,
        },

        {
          name:
            "Tracked Members",
          value:
            String(
              totals.users
            ),
          inline: true,
        },

        {
          name:
            "Currently In VC",
          value:
            String(
              totals.activeUsers
            ),
          inline: true,
        },

        {
          name:
            "Total Voice Time",
          value:
            formatDuration(
              totals.totalSeconds
            ),
          inline: true,
        },

        {
          name:
            "VC Role",
          value:
            guildData.settings.vcRoleId
              ? `<@&${guildData.settings.vcRoleId}>`
              : "Disabled",
          inline: true,
        },

        {
          name:
            "Top 5",
          value:
            topText,
          inline: false,
        },
      ],

      footer:
        "Zeechei • Live Server Statistics",
    }
  );
}


/* ==========================================================================
   USER STATS
========================================================================== */

async function sendUserStats(
  message,
  member
) {
  const db =
    readDatabase();

  const guildData =
    getGuildData(
      db,
      message.guild.id
    );

  const user =
    getUserData(
      guildData,
      member.id,
      member.user.username
    );

  const leaderboard =
    getLeaderboard(
      guildData
    );

  const index =
    leaderboard.findIndex(
      (entry) =>
        entry.userId ===
        member.id
    );

  const rank =
    index === -1
      ? "Unranked"
      : `#${index + 1}`;

  const live =
    !!user.currentSession;

  const currentChannel =
    live
      ? message.guild.channels.cache.get(
          user.currentSession.channelId
        )
      : null;

  return sendBanner(
    message.channel,
    {
      title:
        "USER VC STATISTICS",

      subtitle:
        "Live Voice Profile",

      description:
        `Voice analytics for **${member.user.username}**.`,

      fields: [
        {
          name:
            "VC Rank",
          value:
            rank,
          inline: true,
        },

        {
          name:
            "VC Joins",
          value:
            String(
              user.joins || 0
            ),
          inline: true,
        },

        {
          name:
            "VC Leaves",
          value:
            String(
              user.leaves || 0
            ),
          inline: true,
        },

        {
          name:
            "Total Voice Time",
          value:
            formatDuration(
              getLiveSeconds(
                user
              )
            ),
          inline: true,
        },

        {
          name:
            "Current Status",
          value:
            live
              ? currentChannel
                ? `LIVE • ${currentChannel.name}`
                : "LIVE • Voice Channel"
              : "Not in VC",
          inline: true,
        },

        {
          name:
            "Last Join",
          value:
            formatTimestamp(
              user.lastJoin
            ),
          inline: true,
        },

        {
          name:
            "Last Leave",
          value:
            formatTimestamp(
              user.lastLeave
            ),
          inline: true,
        },

        {
          name:
            "Tracked Since",
          value:
            user.lastJoin
              ? formatTimestamp(
                  user.lastJoin
                )
              : "No activity",
          inline: true,
        },
      ],

      footer:
        "Zeechei • Live User Voice Statistics",
    }
  );
}


/* ==========================================================================
   OWNER SERVER ANALYTICS
========================================================================== */

async function sendOwnerServerStats(
  message,
  guildId
) {
  if (
    !isOwner(
      message.author.id,
      message.client
    )
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "OWNER ACCESS",

        subtitle:
          "Restricted Analytics",

        description:
          "This server-ID analytics command is available only to configured Zeechei bot owners.",
      }
    );
  }

  if (
    !/^\d{17,20}$/.test(
      String(guildId || "")
    )
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "INVALID SERVER ID",

        subtitle:
          "Owner VC Analytics",

        description:
          "Use:\n`vcstats SERVER_ID`\n\nExample:\n`vcstats 123456789012345678`",
      }
    );
  }

  const db =
    readDatabase();

  const guildData =
    db.guilds[guildId];

  if (!guildData) {
    return sendBanner(
      message.channel,
      {
        title:
          "NO VC DATA",

        subtitle:
          "Owner Server Analytics",

        description:
          "Zeechei has no stored VC analytics for this server yet.",
      }
    );
  }

  let guild =
    message.client.guilds.cache.get(
      guildId
    );

  /*
   * If Zeechei is currently in the server,
   * use the actual guild object.
   */
  const guildName =
    guild?.name ||
    `Server ${guildId}`;

  const totals =
    getServerTotals(
      guildData
    );

  const leaderboard =
    getLeaderboard(
      guildData
    );

  const top =
    leaderboard.slice(
      0,
      10
    );

  const topText =
    top.length
      ? top
          .map(
            (user, index) =>
              `**${index + 1}. ${user.username || "Unknown User"}** — ${formatDuration(
                getLiveSeconds(user)
              )} • ${user.joins || 0} joins`
          )
          .join("\n")
      : "No users recorded.";

  /*
   * Owner gets complete top page + buttons.
   * Buttons are locked to the requesting owner.
   */
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        leaderboard.length /
          PAGE_SIZE
      )
    );

  const row =
    createLeaderboardRow(
      guildId,
      1,
      totalPages,
      message.author.id
    );

  return sendBanner(
    message.channel,
    {
      title:
        "OWNER • VC ANALYTICS",

      subtitle:
        "Complete Server Voice Database",

      description:
        `**${guildName}**\n\nComplete stored VC analytics for server \`${guildId}\`.`,

      fields: [
        {
          name:
            "Server ID",
          value:
            `\`${guildId}\``,
          inline: false,
        },

        {
          name:
            "Total Joins",
          value:
            String(
              totals.totalJoins
            ),
          inline: true,
        },

        {
          name:
            "Total Leaves",
          value:
            String(
              totals.totalLeaves
            ),
          inline: true,
        },

        {
          name:
            "Tracked Users",
          value:
            String(
              totals.users
            ),
          inline: true,
        },

        {
          name:
            "Currently Active",
          value:
            String(
              totals.activeUsers
            ),
          inline: true,
        },

        {
          name:
            "Total VC Time",
          value:
            formatDuration(
              totals.totalSeconds
            ),
          inline: true,
        },

        {
          name:
            "Leaderboard",
          value:
            `${leaderboard.length} users • ${totalPages} pages`,
          inline: true,
        },

        {
          name:
            "Top 10",
          value:
            topText,
          inline: false,
        },
      ],

      components: [
        row,
      ],

      footer:
        "Zeechei • Owner Voice Analytics",
    }
  );
}


/* ==========================================================================
   OWNER LEADERBOARD BUTTON
========================================================================== */

async function handleLeaderboardButton(
  interaction
) {
  const parts =
    interaction.customId.split(
      ":"
    );

  /*
   * zeechei_vc_lb:
   * guildId:
   * action:
   * page:
   * requesterId
   */
  const guildId =
    parts[1];

  const action =
    parts[2];

  let page =
    Number(parts[3]);

  const requesterId =
    parts[4] || "all";

  /*
   * Owner-only buttons.
   */
  if (
    requesterId !== "all" &&
    interaction.user.id !==
      requesterId
  ) {
    return interaction.reply({
      content:
        "This VC leaderboard belongs to another user.",
      ephemeral: true,
    });
  }

  /*
   * Normal guild leaderboard:
   * requesterId = all
   *
   * Owner leaderboard:
   * requesterId = owner ID
   */
  if (
    requesterId !== "all" &&
    !isOwner(
      interaction.user.id,
      interaction.client
    )
  ) {
    return interaction.reply({
      content:
        "Owner access required.",
      ephemeral: true,
    });
  }

  const db =
    readDatabase();

  const guildData =
    db.guilds[guildId];

  if (!guildData) {
    return interaction.reply({
      content:
        "No VC data exists for this server.",
      ephemeral: true,
    });
  }

  const guild =
    interaction.client.guilds.cache.get(
      guildId
    );

  const data =
    getPageData(
      guildData,
      page
    );

  if (
    action === "first"
  ) {
    page = 1;
  } else if (
    action === "prev"
  ) {
    page =
      Math.max(
        1,
        data.page - 1
      );
  } else if (
    action === "next"
  ) {
    page =
      Math.min(
        data.totalPages,
        data.page + 1
      );
  } else if (
    action === "last"
  ) {
    page =
      data.totalPages;
  } else {
    page =
      data.page;
  }

  const result =
    buildLeaderboardDescription(
      guild,
      guildData,
      page
    );

  const row =
    createLeaderboardRow(
      guildId,
      result.page,
      result.totalPages,
      requesterId
    );

  const image =
    createBanner(
      requesterId !== "all"
        ? "OWNER • VC LEADERBOARD"
        : "VOICE LEADERBOARD",
      "Live Complete Server Ranking"
    );

  const attachment =
    new AttachmentBuilder(
      image,
      {
        name:
          "zeechei-vc.png",
      }
    );

  const embed =
    new EmbedBuilder()
      .setColor(
        EMBED_COLOR
      )
      .setImage(
        "attachment://zeechei-vc.png"
      )
      .setDescription(
        result.description
      )
      .addFields(
        {
          name:
            "Current Page",
          value:
            `${result.page} / ${result.totalPages}`,
          inline: true,
        },
        {
          name:
            "Tracked Members",
          value:
            String(
              result.tracked
            ),
          inline: true,
        },
        {
          name:
            "Ranking",
          value:
            "VC time + joins",
          inline: true,
        }
      )
      .setFooter({
        text:
          requesterId !== "all"
            ? "Zeechei • Owner Voice Analytics"
            : "Zeechei • Live Voice Leaderboard",
      })
      .setTimestamp();

  return interaction.update({
    embeds: [
      embed,
    ],
    files: [
      attachment,
    ],
    components: [
      row,
    ],
  });
}


/* ==========================================================================
   ARGUMENT NORMALIZATION
========================================================================== */

function normalizeArgs(
  args
) {
  if (
    !Array.isArray(args)
  ) {
    return [];
  }

  return args
    .flatMap(
      (item) => {
        if (
          typeof item ===
          "string"
        ) {
          return item
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        }

        if (
          typeof item ===
          "number"
        ) {
          return [
            String(item),
          ];
        }

        return [];
      }
    );
}


/* ==========================================================================
   MAIN COMMAND
========================================================================== */

async function execute(
  ...parameters
) {
  const {
    message,
    client,
    args: rawArgs,
  } =
    normalizeContext(
      parameters
    );

  /*
   * This prevents the exact screenshot crash.
   */
  if (
    !message ||
    !message.channel ||
    typeof message.channel.send !==
      "function"
  ) {
    console.error(
      "[Zeechei VC] Invalid command context:",
      {
        parameterCount:
          parameters.length,
        parameterTypes:
          parameters.map(
            (x) =>
              Array.isArray(x)
                ? "array"
                : typeof x
          ),
      }
    );

    return null;
  }

  const botClient =
    client ||
    message.client;

  /*
   * Automatically initialize tracking as soon as
   * this command is loaded/executed.
   *
   * Also expose init below for startup loading.
   */
  if (
    botClient &&
    !initializedClients.has(
      botClient
    )
  ) {
    initialize(
      botClient
    );
  }

  const args =
    normalizeArgs(
      rawArgs
    );

  /*
   * Detect whether user typed:
   *
   * vc
   * vcstats
   * vclb
   * vcrole
   */
  const invoked =
    detectInvokedCommand(
      message
    );

  /*
   * ----------------------------------------------------
   * DIRECT vcstats
   * ----------------------------------------------------
   */
  if (
    invoked === "vcstats"
  ) {
    const target =
      args[0];

    /*
     * Server ID = owner only.
     */
    if (
      target &&
      /^\d{17,20}$/.test(
        target
      )
    ) {
      return sendOwnerServerStats(
        message,
        target
      );
    }

    /*
     * @user / user ID
     */
    if (target) {
      const member =
        resolveMember(
          message,
          target
        );

      if (!member) {
        return sendBanner(
          message.channel,
          {
            title:
              "USER NOT FOUND",

            subtitle:
              "VC User Statistics",

            description:
              "I could not find that member in this server.",
          }
        );
      }

      return sendUserStats(
        message,
        member
      );
    }

    /*
     * No target = server stats.
     */
    return sendServerStats(
      message,
      message.guild
    );
  }


  /*
   * ----------------------------------------------------
   * DIRECT vclb
   * ----------------------------------------------------
   */
  if (
    invoked === "vclb" ||
    invoked === "vcleaderboard"
  ) {
    const page =
      Number(
        args[0]
      ) || 1;

    return sendLeaderboard(
      message.channel,
      message.guild,
      page
    );
  }


  /*
   * ----------------------------------------------------
   * DIRECT vcrole
   * ----------------------------------------------------
   */
  if (
    invoked === "vcrole"
  ) {
    return handleVcRole(
      message,
      args
    );
  }


  /*
   * ----------------------------------------------------
   * MAIN vc COMMAND
   * ----------------------------------------------------
   */

  if (
    invoked !== "vc" &&
    invoked !== "voice" &&
    invoked !== "voicecontrol"
  ) {
    /*
     * Some command loaders don't preserve
     * message.content. In that case, default
     * to VC command.
     */
  }

  const subcommand =
    String(
      args[0] || ""
    ).toLowerCase();

  /*
   * vc
   * vc help
   */
  if (
    !subcommand ||
    subcommand === "help" ||
    subcommand === "guide"
  ) {
    return sendGuide(
      message
    );
  }


  /*
   * vc role
   */
  if (
    subcommand === "role" ||
    subcommand === "vcrole"
  ) {
    return handleVcRole(
      message,
      args.slice(1)
    );
  }


  /*
   * vc stats
   */
  if (
    subcommand === "stats" ||
    subcommand === "stat" ||
    subcommand === "vcstats"
  ) {
    const target =
      args[1];

    /*
     * Owner server ID.
     */
    if (
      target &&
      /^\d{17,20}$/.test(
        target
      )
    ) {
      return sendOwnerServerStats(
        message,
        target
      );
    }

    /*
     * User.
     */
    if (target) {
      const member =
        resolveMember(
          message,
          target
        );

      if (!member) {
        return sendBanner(
          message.channel,
          {
            title:
              "USER NOT FOUND",

            subtitle:
              "VC User Statistics",

            description:
              "That member could not be found in this server.",
          }
        );
      }

      return sendUserStats(
        message,
        member
      );
    }

    /*
     * Server.
     */
    return sendServerStats(
      message,
      message.guild
    );
  }


  /*
   * vc lb
   */
  if (
    subcommand === "lb" ||
    subcommand === "leaderboard" ||
    subcommand === "leaderboards"
  ) {
    const page =
      Number(
        args[1]
      ) || 1;

    return sendLeaderboard(
      message.channel,
      message.guild,
      page
    );
  }


  /*
   * vc setup
   */
  if (
    subcommand === "setup"
  ) {
    return sendBanner(
      message.channel,
      {
        title:
          "VC SYSTEM ACTIVE",

        subtitle:
          "Automatic Voice Analytics",

        description:
          "No manual setup is required for VC tracking.\n\nZeechei automatically records voice joins and leaves for this server.\n\nUse `vcrole @role` only if you want an automatic VC role.",
      }
    );
  }


  /*
   * Unknown subcommand.
   */
  return sendBanner(
    message.channel,
    {
      title:
        "UNKNOWN VC COMMAND",

      subtitle:
        "Zeechei Voice System",

      description:
        `That VC command does not exist.\n\nUse \`vc\` to open the complete Voice Control guide.`,
    }
  );
}


/* ==========================================================================
   MODULE EXPORT
========================================================================== */

module.exports = {
  name: "vc",

  aliases: [
    "voice",
    "voicecontrol",
    "vcstats",
    "vclb",
    "vcleaderboard",
    "vcrole",
  ],

  category:
    "voice",

  description:
    "Live per-server VC statistics, leaderboard and automatic VC role system.",

  execute,

  run:
    execute,

  handler:
    execute,

  init:
    initialize,

  initialize,

  trackJoin:
    recordJoin,

  trackLeave:
    recordLeave,
};