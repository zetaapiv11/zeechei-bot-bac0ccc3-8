const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const config = require("../../config");
const { V2Builder } = require("../../utils/V2Builder");

// ============================================================
// CONFIG
// ============================================================

const CYAN = "#00E5FF";
const DARK = "#020708";
const PANEL = "#061114";
const WHITE = "#EFFFFF";
const MUTED = "#76A8AF";

const DATA_DIR = path.join(
  process.cwd(),
  "data"
);

const DATA_FILE = path.join(
  DATA_DIR,
  "musicstats.json"
);

const PAGE_TIMEOUT = 10 * 60 * 1000;

// ============================================================
// OWNER CHECK
// ============================================================

function isOwner(userId) {
  try {
    if (
      Array.isArray(config?.ownerIds) &&
      config.ownerIds.includes(userId)
    ) {
      return true;
    }

    if (
      Array.isArray(config?.owners) &&
      config.owners.includes(userId)
    ) {
      return true;
    }

    if (
      config?.ownerId &&
      config.ownerId === userId
    ) {
      return true;
    }

    if (
      config?.mainOwnerId &&
      config.mainOwnerId === userId
    ) {
      return true;
    }

    if (
      Array.isArray(config?.bot?.owners) &&
      config.bot.owners.includes(userId)
    ) {
      return true;
    }
  } catch {}

  return false;
}

// ============================================================
// DATABASE
// ============================================================

function defaultStats() {
  return {
    plays: 0,
    searches: 0,
    skips: 0,
    pauses: 0,
    resumes: 0,
    sessions: 0,
    commands: 0,
    requests: 0,
    errors: 0,
    listeners: 0,
    uptimeSeconds: 0,
    musicSeconds: 0,
  };
}

function defaultData() {
  return {
    version: 1,
    global: defaultStats(),
    servers: {},
  };
}

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
          defaultData(),
          null,
          2
        ),
        "utf8"
      );
    }
  } catch (error) {
    console.error(
      "[MusicStats] Database initialization error:",
      error
    );
  }
}

function loadDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return defaultData();
    }

    if (
      !parsed.global ||
      typeof parsed.global !== "object"
    ) {
      parsed.global = defaultStats();
    }

    if (
      !parsed.servers ||
      typeof parsed.servers !== "object"
    ) {
      parsed.servers = {};
    }

    const defaults = defaultStats();

    for (
      const key of Object.keys(defaults)
    ) {
      if (
        typeof parsed.global[key] !==
        "number"
      ) {
        parsed.global[key] = 0;
      }
    }

    for (
      const server of Object.values(
        parsed.servers
      )
    ) {
      if (
        !server ||
        typeof server !== "object"
      ) {
        continue;
      }

      if (
        !server.stats ||
        typeof server.stats !== "object"
      ) {
        server.stats = defaultStats();
      }

      for (
        const key of Object.keys(defaults)
      ) {
        if (
          typeof server.stats[key] !==
          "number"
        ) {
          server.stats[key] = 0;
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error(
      "[MusicStats] Database read error:",
      error
    );

    return defaultData();
  }
}

function saveDatabase(data) {
  ensureDatabase();

  const tempFile =
    `${DATA_FILE}.tmp`;

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
      "[MusicStats] Database save error:",
      error
    );

    try {
      if (
        fs.existsSync(tempFile)
      ) {
        fs.unlinkSync(
          tempFile
        );
      }
    } catch {}
  }
}

function ensureServer(
  data,
  guildId
) {
  if (
    !data.servers[guildId]
  ) {
    data.servers[guildId] = {
      guildId,
      stats: defaultStats(),
      createdAt: Date.now(),
    };
  }

  if (
    !data.servers[guildId].stats
  ) {
    data.servers[guildId].stats =
      defaultStats();
  }

  const defaults = defaultStats();

  for (
    const key of Object.keys(defaults)
  ) {
    if (
      typeof data.servers[guildId].stats[key] !==
      "number"
    ) {
      data.servers[guildId].stats[key] = 0;
    }
  }

  return data.servers[guildId];
}

// ============================================================
// FORMATTERS
// ============================================================

function number(value) {
  return Number(
    value || 0
  ).toLocaleString("en-US");
}

function formatTime(seconds) {
  seconds = Math.max(
    0,
    Math.floor(
      Number(seconds) || 0
    )
  );

  const days =
    Math.floor(
      seconds / 86400
    );

  seconds %= 86400;

  const hours =
    Math.floor(
      seconds / 3600
    );

  seconds %= 3600;

  const minutes =
    Math.floor(
      seconds / 60
    );

  seconds %= 60;

  const parts = [];

  if (days) {
    parts.push(
      `${days}d`
    );
  }

  if (hours) {
    parts.push(
      `${hours}h`
    );
  }

  if (minutes) {
    parts.push(
      `${minutes}m`
    );
  }

  if (
    seconds ||
    parts.length === 0
  ) {
    parts.push(
      `${seconds}s`
    );
  }

  return parts.join(" ");
}

function formatMs(ms) {
  return formatTime(
    Math.floor(
      Number(ms || 0) / 1000
    )
  );
}

function clean(
  value,
  fallback = "Unknown"
) {
  const text = String(
    value ?? ""
  )
    .replace(
      /[\r\n]+/g,
      " "
    )
    .trim();

  return (
    text.slice(0, 110) ||
    fallback
  );
}

// ============================================================
// LAVALINK HELPERS
// ============================================================

function getPlayer(
  client,
  guildId
) {
  try {
    return (
      client?.lavalink?.getPlayer?.(
        guildId
      ) || null
    );
  } catch {
    return null;
  }
}

function getAllPlayers(client) {
  try {
    const lavalink =
      client?.lavalink;

    if (!lavalink) {
      return [];
    }

    if (
      lavalink.players &&
      typeof lavalink.players.values ===
        "function"
    ) {
      return [
        ...lavalink.players.values(),
      ];
    }

    if (
      typeof lavalink.getPlayers ===
      "function"
    ) {
      const result =
        lavalink.getPlayers();

      if (
        Array.isArray(result)
      ) {
        return result;
      }

      if (
        result &&
        typeof result.values ===
          "function"
      ) {
        return [
          ...result.values(),
        ];
      }
    }

    return [];
  } catch {
    return [];
  }
}

function getQueueSize(player) {
  try {
    if (
      typeof player?.queue?.size ===
      "number"
    ) {
      return player.queue.size;
    }

    if (
      Array.isArray(
        player?.queue?.tracks
      )
    ) {
      return player.queue.tracks.length;
    }

    if (
      Array.isArray(
        player?.queue?.items
      )
    ) {
      return player.queue.items.length;
    }

    if (
      Array.isArray(
        player?.queue
      )
    ) {
      return player.queue.length;
    }
  } catch {}

  return 0;
}

function getCurrentTrack(player) {
  try {
    return (
      player?.queue?.current ||
      player?.currentTrack ||
      player?.track ||
      null
    );
  } catch {
    return null;
  }
}

function getTrackTitle(track) {
  return (
    track?.info?.title ||
    track?.title ||
    track?.info?.identifier ||
    "Nothing playing"
  );
}

function getTrackAuthor(track) {
  return (
    track?.info?.author ||
    track?.author ||
    "Unknown artist"
  );
}

function getTrackDuration(track) {
  return Number(
    track?.info?.length ||
    track?.info?.duration ||
    track?.duration ||
    0
  );
}

function getTrackPosition(player) {
  return Number(
    player?.position ||
    player?.state?.position ||
    0
  );
}

function getVoiceChannelId(player) {
  return (
    player?.voiceChannelId ||
    player?.channelId ||
    player?.connection?.channelId ||
    null
  );
}

function getTextChannelId(player) {
  return (
    player?.textChannelId ||
    null
  );
}

function isPlaying(player) {
  try {
    const current =
      getCurrentTrack(
        player
      );

    if (!current) {
      return false;
    }

    if (
      typeof player.paused ===
      "boolean"
    ) {
      return !player.paused;
    }

    if (
      typeof player.playing ===
      "boolean"
    ) {
      return player.playing;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// LIVE SERVER DATA
// ============================================================

function getLiveServerData(
  client,
  guildId
) {
  const player =
    getPlayer(
      client,
      guildId
    );

  if (!player) {
    return {
      connected: false,
      playing: false,
      paused: false,
      queue: 0,
      track: null,
      voiceChannelId: null,
      textChannelId: null,
      position: 0,
      duration: 0,
      listeners: 0,
    };
  }

  const guild =
    client?.guilds?.cache?.get(
      guildId
    );

  const voiceChannelId =
    getVoiceChannelId(
      player
    );

  let listeners = 0;

  if (
    voiceChannelId &&
    guild?.channels?.cache
  ) {
    const voice =
      guild.channels.cache.get(
        voiceChannelId
      );

    if (voice?.members) {
      listeners =
        voice.members.filter(
          member =>
            !member.user.bot
        ).size;
    }
  }

  const track =
    getCurrentTrack(
      player
    );

  return {
    connected:
      Boolean(
        voiceChannelId
      ),

    playing:
      isPlaying(
        player
      ),

    paused:
      Boolean(
        player.paused
      ),

    queue:
      getQueueSize(
        player
      ),

    track,

    voiceChannelId,

    textChannelId:
      getTextChannelId(
        player
      ),

    position:
      getTrackPosition(
        player
      ),

    duration:
      getTrackDuration(
        track
      ),

    listeners,
  };
}

// ============================================================
// LIVE GLOBAL DATA
// ============================================================

function getGlobalLiveData(client) {
  const players =
    getAllPlayers(
      client
    );

  let connected = 0;
  let playing = 0;
  let paused = 0;
  let queueTracks = 0;
  let listeners = 0;

  for (
    const player of players
  ) {
    if (
      getVoiceChannelId(
        player
      )
    ) {
      connected++;
    }

    if (
      isPlaying(
        player
      )
    ) {
      playing++;
    }

    if (
      player?.paused
    ) {
      paused++;
    }

    queueTracks +=
      getQueueSize(
        player
      );

    const guild =
      client?.guilds?.cache?.get(
        player?.guildId
      );

    const voiceChannelId =
      getVoiceChannelId(
        player
      );

    if (
      guild &&
      voiceChannelId
    ) {
      const voice =
        guild.channels.cache.get(
          voiceChannelId
        );

      if (voice?.members) {
        listeners +=
          voice.members.filter(
            member =>
              !member.user.bot
          ).size;
      }
    }
  }

  return {
    players:
      players.length,

    connected,

    playing,

    paused,

    queueTracks,

    listeners,
  };
}

// ============================================================
// CYAN BANNER
// ============================================================

function createBanner({
  title,
  subtitle,
  rows = [],
  page = null,
  totalPages = null,
  width = 1200,
  height = 620,
}) {
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
  ctx.fillStyle =
    DARK;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // Cyan glow
  const glow =
    ctx.createRadialGradient(
      width / 2,
      0,
      10,
      width / 2,
      0,
      width * 0.8
    );

  glow.addColorStop(
    0,
    "rgba(0,229,255,0.18)"
  );

  glow.addColorStop(
    0.45,
    "rgba(0,229,255,0.06)"
  );

  glow.addColorStop(
    1,
    "rgba(0,229,255,0)"
  );

  ctx.fillStyle =
    glow;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // Main panel
  ctx.fillStyle =
    PANEL;

  ctx.fillRect(
    25,
    25,
    width - 50,
    height - 50
  );

  // Outer border
  ctx.strokeStyle =
    CYAN;

  ctx.lineWidth = 2;

  ctx.strokeRect(
    25,
    25,
    width - 50,
    height - 50
  );

  // Inner border
  ctx.strokeStyle =
    "rgba(0,229,255,0.16)";

  ctx.lineWidth = 1;

  ctx.strokeRect(
    45,
    45,
    width - 90,
    height - 90
  );

  // Top cyan bar
  ctx.fillStyle =
    CYAN;

  ctx.fillRect(
    25,
    25,
    width - 50,
    5
  );

  // Cyan orb
  ctx.beginPath();

  ctx.arc(
    76,
    82,
    7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    CYAN;

  ctx.fill();

  // Title
  ctx.font =
    "bold 40px Arial";

  ctx.fillStyle =
    WHITE;

  ctx.fillText(
    clean(
      title,
      "MUSIC STATS"
    ),
    100,
    95
  );

  // Subtitle
  if (subtitle) {
    ctx.font =
      "18px Arial";

    ctx.fillStyle =
      MUTED;

    ctx.fillText(
      clean(subtitle),
      100,
      126
    );
  }

  // Divider
  ctx.strokeStyle =
    "rgba(0,229,255,0.22)";

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

  // Content
  let y = 200;

  for (
    const row of rows
  ) {
    if (
      y >
      height - 105
    ) {
      break;
    }

    // Bullet
    ctx.beginPath();

    ctx.arc(
      78,
      y - 7,
      4,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      CYAN;

    ctx.fill();

    // Label
    ctx.font =
      "bold 19px Arial";

    ctx.fillStyle =
      CYAN;

    ctx.fillText(
      clean(
        row.label,
        "Info"
      ),
      100,
      y
    );

    // Value
    ctx.font =
      "19px Arial";

    ctx.fillStyle =
      "#DDFBFE";

    ctx.fillText(
      clean(
        row.value,
        "N/A"
      ),
      360,
      y
    );

    y += 43;
  }

  // Footer divider
  ctx.strokeStyle =
    "rgba(0,229,255,0.16)";

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

  // Footer
  ctx.font =
    "bold 13px Arial";

  ctx.fillStyle =
    "#4D858D";

  ctx.fillText(
    "ZEECHEI • MUSIC ANALYTICS",
    75,
    height - 45
  );

  if (
    page !== null &&
    totalPages !== null
  ) {
    ctx.textAlign =
      "right";

    ctx.fillText(
      `PAGE ${page} / ${totalPages}`,
      width - 75,
      height - 45
    );

    ctx.textAlign =
      "left";
  }

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// RESPONSE BUILDER
// ============================================================

function makeResponse({
  title,
  subtitle,
  rows = [],
  page = null,
  totalPages = null,
  buttons = [],
  height = 620,
}) {
  const image =
    createBanner({
      title,
      subtitle,
      rows,
      page,
      totalPages,
      height,
    });

  const attachment =
    new AttachmentBuilder(
      image,
      {
        name:
          "musicstats.png",
      }
    );

  const builder =
    new V2Builder(
      CYAN
    );

  const payload =
    builder
      .media(
        "attachment://musicstats.png"
      )
      .build();

  payload.files = [
    attachment,
  ];

  if (
    buttons.length
  ) {
    payload.components = [
      ...(payload.components || []),
      new ActionRowBuilder()
        .addComponents(
          buttons
        ),
    ];
  }

  payload.flags =
    MessageFlags.IsComponentsV2;

  return payload;
}

// ============================================================
// BUTTONS
// ============================================================

function pageButtons(
  current,
  total,
  prefix
) {
  return [
    new ButtonBuilder()
      .setCustomId(
        `${prefix}:prev`
      )
      .setLabel(
        "Previous"
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        current <= 1
      ),

    new ButtonBuilder()
      .setCustomId(
        `${prefix}:next`
      )
      .setLabel(
        "Next"
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        current >= total
      ),

    new ButtonBuilder()
      .setCustomId(
        `${prefix}:refresh`
      )
      .setLabel(
        "Refresh"
      )
      .setStyle(
        ButtonStyle.Secondary
      ),
  ];
}

// ============================================================
// SERVER PAGES
// ============================================================

function buildServerPages(
  client,
  guildId
) {
  const data =
    loadDatabase();

  const server =
    data.servers[guildId] ||
    {
      guildId,
      stats: defaultStats(),
    };

  const stats =
    server.stats ||
    defaultStats();

  const live =
    getLiveServerData(
      client,
      guildId
    );

  const guild =
    client?.guilds?.cache?.get(
      guildId
    );

  const track =
    live.track;

  return [
    {
      title:
        "SERVER MUSIC STATS",

      subtitle:
        "Live server music analytics",

      rows: [
        {
          label:
            "Server",
          value:
            guild?.name ||
            guildId,
        },

        {
          label:
            "Music Status",
          value:
            live.playing
              ? "PLAYING"
              : live.paused
              ? "PAUSED"
              : "IDLE",
        },

        {
          label:
            "Songs Played",
          value:
            number(
              stats.plays
            ),
        },

        {
          label:
            "Music Time",
          value:
            formatTime(
              stats.musicSeconds
            ),
        },

        {
          label:
            "Requests",
          value:
            number(
              stats.requests
            ),
        },

        {
          label:
            "Searches",
          value:
            number(
              stats.searches
            ),
        },

        {
          label:
            "Skips",
          value:
            number(
              stats.skips
            ),
        },
      ],
    },

    {
      title:
        "SERVER ACTIVITY",

      subtitle:
        "Stored music activity",

      rows: [
        {
          label:
            "Sessions",
          value:
            number(
              stats.sessions
            ),
        },

        {
          label:
            "Music Commands",
          value:
            number(
              stats.commands
            ),
        },

        {
          label:
            "Pauses",
          value:
            number(
              stats.pauses
            ),
        },

        {
          label:
            "Resumes",
          value:
            number(
              stats.resumes
            ),
        },

        {
          label:
            "Errors",
          value:
            number(
              stats.errors
            ),
        },

        {
          label:
            "Listeners Now",
          value:
            number(
              live.listeners
            ),
        },

        {
          label:
            "Queue Tracks",
          value:
            number(
              live.queue
            ),
        },
      ],
    },

    {
      title:
        "LIVE PLAYER",

      subtitle:
        "Real-time Lavalink player",

      rows: [
        {
          label:
            "Connected",
          value:
            live.connected
              ? "YES"
              : "NO",
        },

        {
          label:
            "Voice Channel",
          value:
            live.voiceChannelId
              ? `<#${live.voiceChannelId}>`
              : "Not connected",
        },

        {
          label:
            "Text Channel",
          value:
            live.textChannelId
              ? `<#${live.textChannelId}>`
              : "Not linked",
        },

        {
          label:
            "Now Playing",
          value:
            track
              ? getTrackTitle(
                  track
                )
              : "Nothing playing",
        },

        {
          label:
            "Artist",
          value:
            track
              ? getTrackAuthor(
                  track
                )
              : "N/A",
        },

        {
          label:
            "Position",
          value:
            live.duration
              ? `${formatMs(
                  live.position
                )} / ${formatMs(
                  live.duration
                )}`
              : "N/A",
        },

        {
          label:
            "Queue",
          value:
            `${number(
              live.queue
            )} tracks waiting`,
        },
      ],
    },
  ];
}

// ============================================================
// GLOBAL PAGES
// ============================================================

function buildGlobalPages(client) {
  const data =
    loadDatabase();

  const global =
    data.global ||
    defaultStats();

  const live =
    getGlobalLiveData(
      client
    );

  const serverCount =
    client?.guilds?.cache?.size ||
    0;

  const trackedServers =
    Object.keys(
      data.servers || {}
    ).length;

  return [
    {
      title:
        "GLOBAL MUSIC STATS",

      subtitle:
        "Zeechei network-wide analytics",

      rows: [
        {
          label:
            "Discord Servers",
          value:
            number(
              serverCount
            ),
        },

        {
          label:
            "Tracked Servers",
          value:
            number(
              trackedServers
            ),
        },

        {
          label:
            "Songs Played",
          value:
            number(
              global.plays
            ),
        },

        {
          label:
            "Music Time",
          value:
            formatTime(
              global.musicSeconds
            ),
        },

        {
          label:
            "Requests",
          value:
            number(
              global.requests
            ),
        },

        {
          label:
            "Searches",
          value:
            number(
              global.searches
            ),
        },
      ],
    },

    {
      title:
        "GLOBAL ACTIVITY",

      subtitle:
        "All stored music activity",

      rows: [
        {
          label:
            "Skips",
          value:
            number(
              global.skips
            ),
        },

        {
          label:
            "Pauses",
          value:
            number(
              global.pauses
            ),
        },

        {
          label:
            "Resumes",
          value:
            number(
              global.resumes
            ),
        },

        {
          label:
            "Sessions",
          value:
            number(
              global.sessions
            ),
        },

        {
          label:
            "Commands",
          value:
            number(
              global.commands
            ),
        },

        {
          label:
            "Errors",
          value:
            number(
              global.errors
            ),
        },
      ],
    },

    {
      title:
        "GLOBAL LIVE",

      subtitle:
        "Real-time network player status",

      rows: [
        {
          label:
            "Active Players",
          value:
            number(
              live.players
            ),
        },

        {
          label:
            "Connected Players",
          value:
            number(
              live.connected
            ),
        },

        {
          label:
            "Playing Now",
          value:
            number(
              live.playing
            ),
        },

        {
          label:
            "Paused Players",
          value:
            number(
              live.paused
            ),
        },

        {
          label:
            "Queue Tracks",
          value:
            number(
              live.queueTracks
            ),
        },

        {
          label:
            "Listeners Now",
          value:
            number(
              live.listeners
            ),
        },
      ],
    },
  ];
}

// ============================================================
// GUIDE PAGES
// ============================================================

function buildGuidePages() {
  return [
    {
      title:
        "MUSICSTATS GUIDE",

      subtitle:
        "Zeechei music analytics command center",

      rows: [
        {
          label:
            "ms",
          value:
            "Current server statistics",
        },

        {
          label:
            "msglobal",
          value:
            "Global statistics • Owner only",
        },

        {
          label:
            "msguide",
          value:
            "Open complete guide",
        },

        {
          label:
            "Navigation",
          value:
            "Previous • Next • Refresh",
        },
      ],
    },

    {
      title:
        "SERVER CONTROLS",

      subtitle:
        "Owner-only manual statistics",

      rows: [
        {
          label:
            "ms add",
          value:
            "<stat> <amount>",
        },

        {
          label:
            "ms set",
          value:
            "<stat> <amount>",
        },

        {
          label:
            "ms reset",
          value:
            "<stat>",
        },

        {
          label:
            "ms resetall",
          value:
            "Reset server statistics",
        },
      ],
    },

    {
      title:
        "GLOBAL CONTROLS",

      subtitle:
        "Owner-only global statistics",

      rows: [
        {
          label:
            "msglobal add",
          value:
            "<stat> <amount>",
        },

        {
          label:
            "msglobal set",
          value:
            "<stat> <amount>",
        },

        {
          label:
            "msglobal reset",
          value:
            "<stat>",
        },

        {
          label:
            "msglobal resetall",
          value:
            "Reset global statistics",
        },
      ],
    },

    {
      title:
        "AVAILABLE STATS",

      subtitle:
        "Supported statistic names",

      rows: [
        {
          label:
            "plays",
          value:
            "Songs played",
        },

        {
          label:
            "requests",
          value:
            "Music requests",
        },

        {
          label:
            "searches",
          value:
            "Music searches",
        },

        {
          label:
            "skips",
          value:
            "Skipped tracks",
        },

        {
          label:
            "pauses",
          value:
            "Pause actions",
        },

        {
          label:
            "resumes",
          value:
            "Resume actions",
        },
      ],
    },

    {
      title:
        "MORE STATISTICS",

      subtitle:
        "Additional analytics counters",

      rows: [
        {
          label:
            "sessions",
          value:
            "Music sessions",
        },

        {
          label:
            "commands",
          value:
            "Music commands",
        },

        {
          label:
            "errors",
          value:
            "Music errors",
        },

        {
          label:
            "listeners",
          value:
            "Listener count",
        },

        {
          label:
            "musicSeconds",
          value:
            "Music duration",
        },

        {
          label:
            "uptimeSeconds",
          value:
            "Tracked uptime",
        },
      ],
    },

    {
      title:
        "EXAMPLES",

      subtitle:
        "Owner command examples",

      rows: [
        {
          label:
            "Add",
          value:
            "+ms add plays 100",
        },

        {
          label:
            "Set",
          value:
            "+ms set requests 500",
        },

        {
          label:
            "Reset",
          value:
            "+ms reset skips",
        },

        {
          label:
            "Global",
          value:
            "+msglobal add plays 1000",
        },

        {
          label:
            "Guide",
          value:
            "+msguide",
        },
      ],
    },
  ];
}

// ============================================================
// STAT VALIDATION
// ============================================================

const STAT_ALIASES = {
  play: "plays",
  played: "plays",
  plays: "plays",

  search: "searches",
  searches: "searches",

  skip: "skips",
  skips: "skips",

  pause: "pauses",
  pauses: "pauses",

  resume: "resumes",
  resumes: "resumes",

  session: "sessions",
  sessions: "sessions",

  command: "commands",
  commands: "commands",

  request: "requests",
  requests: "requests",

  error: "errors",
  errors: "errors",

  listener: "listeners",
  listeners: "listeners",

  uptime: "uptimeSeconds",
  uptimeseconds: "uptimeSeconds",

  music: "musicSeconds",
  musicseconds: "musicSeconds",
};

function normalizeStat(input) {
  const value =
    String(
      input || ""
    )
      .trim()
      .toLowerCase();

  return (
    STAT_ALIASES[value] ||
    null
  );
}

function parseAmount(input) {
  if (
    input === undefined ||
    input === null
  ) {
    return null;
  }

  const amount =
    Number(
      String(input)
        .replace(/,/g, "")
        .trim()
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount < 0
  ) {
    return null;
  }

  return Math.floor(
    amount
  );
}

// ============================================================
// ERROR BANNER
// ============================================================

async function errorBanner(
  message,
  title,
  subtitle,
  rows
) {
  return message.reply(
    makeResponse({
      title,
      subtitle,
      rows,
      height: 470,
    })
  );
}

// ============================================================
// SERVER STAT MANAGEMENT
// ============================================================

async function manageServerStat(
  message,
  action,
  statInput,
  amountInput
) {
  if (
    !message.guild
  ) {
    return errorBanner(
      message,
      "SERVER ONLY",
      "This command requires a Discord server",
      [
        {
          label:
            "Status",
          value:
            "INVALID CONTEXT",
        },
      ]
    );
  }

  if (
    !isOwner(
      message.author.id
    )
  ) {
    return errorBanner(
      message,
      "ACCESS DENIED",
      "Statistics management is owner-only",
      [
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
      ]
    );
  }

  if (
    action ===
    "resetall"
  ) {
    const data =
      loadDatabase();

    const server =
      ensureServer(
        data,
        message.guild.id
      );

    server.stats =
      defaultStats();

    saveDatabase(
      data
    );

    return message.reply(
      makeResponse({
        title:
          "SERVER STATS RESET",

        subtitle:
          "All server music statistics were reset",

        rows: [
          {
            label:
              "Server",
            value:
              message.guild.name,
          },

          {
            label:
              "Scope",
            value:
              "CURRENT SERVER",
          },

          {
            label:
              "Status",
            value:
              "RESET COMPLETE",
          },

          {
            label:
              "Action By",
            value:
              message.author.username,
          },
        ],

        height: 470,
      })
    );
  }

  const stat =
    normalizeStat(
      statInput
    );

  if (!stat) {
    return errorBanner(
      message,
      "INVALID STAT",
      "Unknown statistic name",
      [
        {
          label:
            "Try",
          value:
            "plays • requests • searches",
        },

        {
          label:
            "More",
          value:
            "skips • pauses • resumes",
        },

        {
          label:
            "Analytics",
          value:
            "sessions • commands • errors",
        },

        {
          label:
            "Time",
          value:
            "musicSeconds • uptimeSeconds",
        },
      ]
    );
  }

  if (
    action ===
    "reset"
  ) {
    const data =
      loadDatabase();

    const server =
      ensureServer(
        data,
        message.guild.id
      );

    const oldValue =
      Number(
        server.stats[stat] ||
        0
      );

    server.stats[stat] =
      0;

    saveDatabase(
      data
    );

    return message.reply(
      makeResponse({
        title:
          "SERVER STAT RESET",

        subtitle:
          `${stat} reset successfully`,

        rows: [
          {
            label:
              "Statistic",
            value:
              stat,
          },

          {
            label:
              "Previous",
            value:
              number(
                oldValue
              ),
          },

          {
            label:
              "Current",
            value:
              "0",
          },

          {
            label:
              "Status",
            value:
              "UPDATED",
          },
        ],

        height: 470,
      })
    );
  }

  const amount =
    parseAmount(
      amountInput
    );

  if (
    amount === null
  ) {
    return errorBanner(
      message,
      "INVALID AMOUNT",
      "Amount must be a valid whole number",
      [
        {
          label:
            "Usage",
          value:
            `+ms ${action} ${stat} <amount>`,
        },

        {
          label:
            "Example",
          value:
            `+ms ${action} ${stat} 100`,
        },
      ]
    );
  }

  const data =
    loadDatabase();

  const server =
    ensureServer(
      data,
      message.guild.id
    );

  const oldValue =
    Number(
      server.stats[stat] ||
      0
    );

  let newValue =
    oldValue;

  if (
    action ===
    "add"
  ) {
    newValue =
      oldValue +
      amount;
  } else if (
    action ===
    "set"
  ) {
    newValue =
      amount;
  }

  server.stats[stat] =
    newValue;

  saveDatabase(
    data
  );

  return message.reply(
    makeResponse({
      title:
        `SERVER STAT ${action.toUpperCase()}`,

      subtitle:
        "Music statistic updated successfully",

      rows: [
        {
          label:
            "Statistic",
          value:
            stat,
        },

        {
          label:
            "Previous",
          value:
            number(
              oldValue
            ),
        },

        {
          label:
            "Change",
          value:
            number(
              amount
            ),
        },

        {
          label:
            "Current",
          value:
            number(
              newValue
            ),
        },

        {
          label:
            "Updated By",
          value:
            message.author.username,
        },
      ],

      height: 520,
    })
  );
}

// ============================================================
// GLOBAL STAT MANAGEMENT
// ============================================================

async function manageGlobalStat(
  message,
  action,
  statInput,
  amountInput
) {
  if (
    !isOwner(
      message.author.id
    )
  ) {
    return errorBanner(
      message,
      "ACCESS DENIED",
      "Global statistics are owner-only",
      [
        {
          label:
            "Required",
          value:
            "Zeechei Owner",
        },

        {
          label:
            "Scope",
          value:
            "GLOBAL",
        },

        {
          label:
            "Status",
          value:
            "PERMISSION DENIED",
        },
      ]
    );
  }

  if (
    action ===
    "resetall"
  ) {
    const data =
      loadDatabase();

    data.global =
      defaultStats();

    saveDatabase(
      data
    );

    return message.reply(
      makeResponse({
        title:
          "GLOBAL STATS RESET",

        subtitle:
          "All global music statistics were reset",

        rows: [
          {
            label:
              "Scope",
            value:
              "GLOBAL",
          },

          {
            label:
              "Status",
            value:
              "RESET COMPLETE",
          },

          {
            label:
              "Action By",
            value:
              message.author.username,
          },
        ],

        height: 450,
      })
    );
  }

  const stat =
    normalizeStat(
      statInput
    );

  if (!stat) {
    return errorBanner(
      message,
      "INVALID STAT",
      "Unknown global statistic",
      [
        {
          label:
            "Try",
          value:
            "plays • requests • searches",
        },

        {
          label:
            "More",
          value:
            "skips • pauses • resumes",
        },

        {
          label:
            "Analytics",
          value:
            "sessions • commands • errors",
        },

        {
          label:
            "Time",
          value:
            "musicSeconds • uptimeSeconds",
        },
      ]
    );
  }

  if (
    action ===
    "reset"
  ) {
    const data =
      loadDatabase();

    const oldValue =
      Number(
        data.global[stat] ||
        0
      );

    data.global[stat] =
      0;

    saveDatabase(
      data
    );

    return message.reply(
      makeResponse({
        title:
          "GLOBAL STAT RESET",

        subtitle:
          `${stat} reset globally`,

        rows: [
          {
            label:
              "Statistic",
            value:
              stat,
          },

          {
            label:
              "Previous",
            value:
              number(
                oldValue
              ),
          },

          {
            label:
              "Current",
            value:
              "0",
          },

          {
            label:
              "Scope",
            value:
              "GLOBAL",
          },
        ],

        height: 470,
      })
    );
  }

  const amount =
    parseAmount(
      amountInput
    );

  if (
    amount === null
  ) {
    return errorBanner(
      message,
      "INVALID AMOUNT",
      "Amount must be a valid whole number",
      [
        {
          label:
            "Usage",
          value:
            `+msglobal ${action} ${stat} <amount>`,
        },

        {
          label:
            "Example",
          value:
            `+msglobal ${action} ${stat} 1000`,
        },
      ]
    );
  }

  const data =
    loadDatabase();

  const oldValue =
    Number(
      data.global[stat] ||
      0
    );

  let newValue =
    oldValue;

  if (
    action ===
    "add"
  ) {
    newValue =
      oldValue +
      amount;
  } else if (
    action ===
    "set"
  ) {
    newValue =
      amount;
  }

  data.global[stat] =
    newValue;

  saveDatabase(
    data
  );

  return message.reply(
    makeResponse({
      title:
        `GLOBAL STAT ${action.toUpperCase()}`,

      subtitle:
        "Global music statistic updated",

      rows: [
        {
          label:
            "Statistic",
          value:
            stat,
        },

        {
          label:
            "Previous",
          value:
            number(
              oldValue
            ),
        },

        {
          label:
            "Change",
          value:
            number(
              amount
            ),
        },

        {
          label:
            "Current",
          value:
            number(
              newValue
            ),
        },

        {
          label:
            "Scope",
          value:
            "GLOBAL",
        },

        {
          label:
            "Updated By",
          value:
            message.author.username,
        },
      ],

      height: 550,
    })
  );
}

// ============================================================
// PAGINATION
// ============================================================

async function sendPaginated(
  message,
  pages,
  prefix
) {
  let currentPage = 1;

  function render() {
    const page =
      pages[
        currentPage - 1
      ];

    return makeResponse({
      title:
        page?.title ||
        "MUSIC STATS",

      subtitle:
        page?.subtitle ||
        "Zeechei Music Analytics",

      rows:
        page?.rows ||
        [],

      page:
        currentPage,

      totalPages:
        pages.length,

      buttons:
        pageButtons(
          currentPage,
          pages.length,
          prefix
        ),

      height:
        page?.height ||
        620,
    });
  }

  const sent =
    await message.reply(
      render()
    );

  const collector =
    sent.createMessageComponentCollector({
      time:
        PAGE_TIMEOUT,
    });

  collector.on(
    "collect",
    async interaction => {
      if (
        interaction.user.id !==
        message.author.id
      ) {
        await interaction.reply({
          ...makeResponse({
            title:
              "ACCESS DENIED",

            subtitle:
              "This panel belongs to another user",

            rows: [
              {
                label:
                  "Status",
                value:
                  "INTERACTION REJECTED",
              },
            ],

            height: 390,
          }),

          ephemeral: true,
        }).catch(
          () => {}
        );

        return;
      }

      const action =
        String(
          interaction.customId
        )
          .split(":")
          .pop();

      if (
        action ===
        "prev"
      ) {
        currentPage =
          Math.max(
            1,
            currentPage - 1
          );
      }

      if (
        action ===
        "next"
      ) {
        currentPage =
          Math.min(
            pages.length,
            currentPage + 1
          );
      }

      if (
        action ===
        "refresh"
      ) {
        if (
          prefix ===
          "musicstats_server"
        ) {
          pages =
            buildServerPages(
              message.client,
              message.guild.id
            );
        }

        if (
          prefix ===
          "musicstats_global"
        ) {
          pages =
            buildGlobalPages(
              message.client
            );
        }

        if (
          prefix ===
          "musicstats_guide"
        ) {
          pages =
            buildGuidePages();
        }

        if (
          currentPage >
          pages.length
        ) {
          currentPage =
            pages.length;
        }
      }

      await interaction
        .update(
          render()
        )
        .catch(
          () => {}
        );
    }
  );

  collector.on(
    "end",
    async () => {
      try {
        const disabledButtons =
          pageButtons(
            currentPage,
            pages.length,
            prefix
          ).map(
            button =>
              ButtonBuilder
                .from(button)
                .setDisabled(
                  true
                )
          );

        const page =
          pages[
            currentPage - 1
          ];

        await sent.edit(
          makeResponse({
            title:
              page?.title ||
              "MUSIC STATS",

            subtitle:
              "This panel has expired",

            rows:
              page?.rows ||
              [],

            page:
              currentPage,

            totalPages:
              pages.length,

            buttons:
              disabledButtons,

            height:
              page?.height ||
              620,
          })
        ).catch(
          () => {}
        );
      } catch {}
    }
  );

  return sent;
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "musicstats",

  aliases: [
    "ms",
    "msglobal",
    "msguide",
    "musicstat",
    "musicstats",
  ],

  async execute({
    client,
    message,
    args = [],
  }) {
    try {
      if (
        !message.guild
      ) {
        return errorBanner(
          message,
          "SERVER ONLY",
          "MusicStats must be used inside a server",
          [
            {
              label:
                "Status",
              value:
                "INVALID CONTEXT",
            },
          ]
        );
      }

      const rawCommand =
        String(
          message.content
            ?.split(/\s+/)[0] ||
          ""
        )
          .replace(
            /^<@!?\d+>/,
            ""
          )
          .replace(
            /^[+!]/,
            ""
          )
          .toLowerCase();

      const firstArg =
        String(
          args[0] || ""
        ).toLowerCase();

      // ========================================================
      // MSGUIDE
      // ========================================================

      if (
        rawCommand ===
          "msguide" ||
        firstArg ===
          "guide"
      ) {
        const pages =
          buildGuidePages();

        return sendPaginated(
          message,
          pages,
          "musicstats_guide"
        );
      }

      // ========================================================
      // MSGLOBAL
      // ========================================================

      if (
        rawCommand ===
          "msglobal" ||
        firstArg ===
          "global"
      ) {
        if (
          !isOwner(
            message.author.id
          )
        ) {
          return errorBanner(
            message,
            "ACCESS DENIED",
            "Global MusicStats are owner-only",
            [
              {
                label:
                  "Command",
                value:
                  "+msglobal",
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
            ]
          );
        }

        const action =
          rawCommand ===
          "msglobal"
            ? String(
                args[0] || ""
              ).toLowerCase()
            : String(
                args[1] || ""
              ).toLowerCase();

        if (
          [
            "add",
            "set",
            "reset",
            "resetall",
          ].includes(
            action
          )
        ) {
          const stat =
            rawCommand ===
            "msglobal"
              ? args[1]
              : args[2];

          const amount =
            rawCommand ===
            "msglobal"
              ? args[2]
              : args[3];

          return manageGlobalStat(
            message,
            action,
            stat,
            amount
          );
        }

        const pages =
          buildGlobalPages(
            client
          );

        return sendPaginated(
          message,
          pages,
          "musicstats_global"
        );
      }

      // ========================================================
      // SERVER OWNER CONTROLS
      // ========================================================

      if (
        [
          "add",
          "set",
          "reset",
          "resetall",
        ].includes(
          firstArg
        )
      ) {
        return manageServerStat(
          message,
          firstArg,
          args[1],
          args[2]
        );
      }

      // ========================================================
      // NORMAL MS
      // ========================================================

      const pages =
        buildServerPages(
          client,
          message.guild.id
        );

      return sendPaginated(
        message,
        pages,
        "musicstats_server"
      );
    } catch (error) {
      console.error(
        "[MusicStats] Command Error:",
        error
      );

      return message.reply(
        makeResponse({
          title:
            "MUSIC STATS ERROR",

          subtitle:
            "Zeechei could not complete this request",

          rows: [
            {
              label:
                "Status",
              value:
                "REQUEST FAILED",
            },

            {
              label:
                "Error",
              value:
                clean(
                  error?.message,
                  "Unknown error"
                ),
            },

            {
              label:
                "Recovery",
              value:
                "Try the command again",
            },
          ],

          height:
            470,
        })
      ).catch(
        () => {}
      );
    }
  },
};