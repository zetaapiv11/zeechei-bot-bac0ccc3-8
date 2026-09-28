const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");

const { V2Builder } = require("./V2Builder");
const { convertTime } = require("./convertTime");
const { BTN } = require("./emojis");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fetch } = require("undici");

// ============================================================================
// FILTERS
// ============================================================================

const FILTER_OPTIONS = [
  {
    label: "Remove Filter",
    description: "Remove any active filters",
    value: "remove",
  },
  {
    label: "Nightcore",
    description: "Speed up + pitch shift",
    value: "nightcore",
  },
  {
    label: "Vaporwave",
    description: "Slow down + pitch shift",
    value: "vaporwave",
  },
  {
    label: "Bass Boost",
    description: "Boost low frequencies",
    value: "bassboost",
  },
  {
    label: "Low Pitch",
    description: "Lower the pitch",
    value: "low_pitch",
  },
  {
    label: "High Pitch",
    description: "Increase the pitch",
    value: "high_pitch",
  },
  {
    label: "Chipmunk",
    description: "Very high pitch effect",
    value: "chipmunk",
  },
  {
    label: "Slow Motion",
    description: "Slow down playback",
    value: "slowmo",
  },
  {
    label: "Vibrato",
    description: "Pitch modulation effect",
    value: "vibrato",
  },
  {
    label: "Tremolo",
    description: "Volume modulation effect",
    value: "tremolo",
  },
  {
    label: "Rotation (3D)",
    description: "3D rotation effect",
    value: "rotation",
  },
  {
    label: "8D Audio",
    description: "Spacious 8D surround effect",
    value: "8d",
  },
  {
    label: "Karaoke",
    description: "Vocal removal effect",
    value: "karaoke",
  },
  {
    label: "Speed Up",
    description: "Speed up playback",
    value: "speedup",
  },
  {
    label: "Soft",
    description: "Smooth low-pass filter",
    value: "soft",
  },
];

const FILTER_MAP = {
  remove: null,

  nightcore: {
    type: "timescale",
    data: {
      pitch: 1.2,
      speed: 1.2,
      rate: 1.0,
    },
  },

  vaporwave: {
    type: "timescale",
    data: {
      pitch: 0.85,
      speed: 0.85,
      rate: 1.0,
    },
  },

  bassboost: {
    type: "equalizer",
    data: [
      { band: 0, gain: 0.3 },
      { band: 1, gain: 0.25 },
      { band: 2, gain: 0.15 },
      { band: 3, gain: 0.05 },
      { band: 4, gain: 0.0 },
      { band: 5, gain: -0.05 },
      { band: 6, gain: -0.1 },
      { band: 7, gain: -0.1 },
      { band: 8, gain: -0.1 },
      { band: 9, gain: -0.1 },
      { band: 10, gain: -0.05 },
      { band: 11, gain: 0.0 },
      { band: 12, gain: 0.05 },
      { band: 13, gain: 0.1 },
    ],
  },

  low_pitch: {
    type: "timescale",
    data: {
      pitch: 0.8,
      speed: 1.0,
      rate: 1.0,
    },
  },

  high_pitch: {
    type: "timescale",
    data: {
      pitch: 1.5,
      speed: 1.0,
      rate: 1.0,
    },
  },

  chipmunk: {
    type: "timescale",
    data: {
      pitch: 1.8,
      speed: 1.0,
      rate: 1.0,
    },
  },

  slowmo: {
    type: "timescale",
    data: {
      pitch: 1.0,
      speed: 0.7,
      rate: 1.0,
    },
  },

  vibrato: {
    type: "vibrato",
    data: {
      depth: 0.5,
      frequency: 14.0,
    },
  },

  tremolo: {
    type: "tremolo",
    data: {
      depth: 0.5,
      frequency: 14.0,
    },
  },

  rotation: {
    type: "rotation",
    data: {
      rotationHz: 5.0,
    },
  },

  "8d": {
    type: "rotation",
    data: {
      rotationHz: 0.2,
    },
  },

  karaoke: {
    type: "karaoke",
    data: {
      level: 1.0,
      monoLevel: 1.0,
      filterBand: 220.0,
      filterWidth: 100.0,
    },
  },

  speedup: {
    type: "timescale",
    data: {
      pitch: 1.0,
      speed: 1.5,
      rate: 1.0,
    },
  },

  soft: {
    type: "lowPass",
    data: {
      smoothing: 20.0,
    },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(ms) {
  if (!ms || ms < 0) return "0:00";

  const totalSeconds = Math.floor(ms / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function truncate(ctx, text, maxWidth) {
  text = String(text || "");

  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let result = text;

  while (
    result.length > 0 &&
    ctx.measureText(`${result}...`).width > maxWidth
  ) {
    result = result.slice(0, -1);
  }

  return `${result}...`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  );
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImageCover(ctx, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;

  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > boxRatio) {
    sourceWidth = image.height * boxRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / boxRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function drawProgress(ctx, x, y, width, position, duration) {
  if (!duration || duration <= 0) {
    return;
  }

  const progress = Math.min(
    Math.max(position / duration, 0),
    1,
  );

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundedRect(ctx, x, y, width, 8, 4);
  ctx.fill();

  const filledWidth = Math.max(width * progress, 8);

  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, x, y, filledWidth, 8, 4);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + filledWidth, y + 4, 7, 0, Math.PI * 2);
  ctx.fill();
}

function buildProgressBar(position, duration, size = 17) {
  if (!duration || duration <= 0) {
    return "LIVE";
  }

  const pct = Math.min(
    Math.max(position / duration, 0),
    1,
  );

  const filled = Math.max(
    0,
    Math.round(pct * size) - 1,
  );

  const empty = Math.max(
    0,
    size - filled - 1,
  );

  const bar =
    "▬".repeat(filled) +
    "🔘" +
    "▬".repeat(empty);

  return `\`${convertTime(position)}\` ${bar} \`${convertTime(duration)}\``;
}

// ============================================================================
// NOW PLAYING CARD
// ============================================================================

async function generateNowPlayingCard({
  title,
  artist,
  source,
  requester,
  artworkUrl,
  position = 0,
  duration = 0,
  volume = 80,
  queueSize = 0,
  queueCount = 0,
  repeatMode = "off",
  autoplay = false,
  paused = false,
}) {
  const W = 1400;
  const H = 560;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const queue =
    Number.isFinite(queueCount) && queueCount !== 0
      ? queueCount
      : queueSize;

  let artwork = null;

  if (artworkUrl) {
    try {
      const response = await fetch(artworkUrl, {
        signal: AbortSignal.timeout(6000),
      });

      const buffer = Buffer.from(
        await response.arrayBuffer(),
      );

      artwork = await loadImage(buffer);
    } catch {}
  }

  // --------------------------------------------------------------------------
  // Background
  // --------------------------------------------------------------------------

  const background = ctx.createLinearGradient(
    0,
    0,
    W,
    H,
  );

  background.addColorStop(0, "#080808");
  background.addColorStop(0.5, "#101010");
  background.addColorStop(1, "#050505");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  // --------------------------------------------------------------------------
  // Artwork blur background
  // --------------------------------------------------------------------------

  if (artwork) {
    ctx.save();

    ctx.globalAlpha = 0.13;

    try {
      ctx.filter = "blur(35px)";
    } catch {}

    drawImageCover(
      ctx,
      artwork,
      -50,
      -50,
      W + 100,
      H + 100,
    );

    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, W, H);
  }

  // --------------------------------------------------------------------------
  // Outer border
  // --------------------------------------------------------------------------

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;

  roundedRect(
    ctx,
    2,
    2,
    W - 4,
    H - 4,
    26,
  );

  ctx.stroke();

  // --------------------------------------------------------------------------
  // Artwork
  // --------------------------------------------------------------------------

  const imageX = 42;
  const imageY = 42;
  const imageSize = 390;

  ctx.save();

  roundedRect(
    ctx,
    imageX,
    imageY,
    imageSize,
    imageSize,
    22,
  );

  ctx.clip();

  if (artwork) {
    drawImageCover(
      ctx,
      artwork,
      imageX,
      imageY,
      imageSize,
      imageSize,
    );
  } else {
    const fallback = ctx.createLinearGradient(
      imageX,
      imageY,
      imageX + imageSize,
      imageY + imageSize,
    );

    fallback.addColorStop(0, "#202020");
    fallback.addColorStop(1, "#080808");

    ctx.fillStyle = fallback;

    ctx.fillRect(
      imageX,
      imageY,
      imageSize,
      imageSize,
    );

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "bold 38px Sans";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "ZEECHEI",
      imageX + imageSize / 2,
      imageY + imageSize / 2,
    );

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;

  roundedRect(
    ctx,
    imageX,
    imageY,
    imageSize,
    imageSize,
    22,
  );

  ctx.stroke();

  // --------------------------------------------------------------------------
  // Right content
  // --------------------------------------------------------------------------

  const contentX = 475;
  const contentWidth = W - contentX - 50;

  // Header

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "bold 20px Sans";

  ctx.fillText(
    "ZEECHEI MUSIC",
    contentX,
    68,
  );

  // Status

  const statusText = paused
    ? "PAUSED"
    : duration > 0
      ? "NOW PLAYING"
      : "LIVE";

  ctx.fillStyle = paused
    ? "#f59e0b"
    : "#ffffff";

  ctx.font = "bold 17px Sans";

  ctx.fillText(
    statusText,
    contentX,
    101,
  );

  // --------------------------------------------------------------------------
  // Title
  // --------------------------------------------------------------------------

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Sans";

  const safeTitle = truncate(
    ctx,
    title || "Unknown Track",
    contentWidth,
  );

  ctx.fillText(
    safeTitle,
    contentX,
    155,
  );

  // --------------------------------------------------------------------------
  // Artist
  // --------------------------------------------------------------------------

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "24px Sans";

  const safeArtist = truncate(
    ctx,
    artist || "Unknown Artist",
    contentWidth,
  );

  ctx.fillText(
    safeArtist,
    contentX,
    194,
  );

  // --------------------------------------------------------------------------
  // Info cards
  // --------------------------------------------------------------------------

  const cardY = 230;
  const cardH = 70;
  const gap = 14;
  const cardWidth =
    (contentWidth - gap * 3) / 4;

  const cards = [
    ["SOURCE", source || "Unknown"],
    ["REQUESTED BY", requester || "Unknown"],
    ["QUEUE", String(queue)],
    ["VOLUME", `${volume}%`],
  ];

  cards.forEach(([label, value], index) => {
    const x =
      contentX +
      index * (cardWidth + gap);

    ctx.fillStyle = "rgba(255,255,255,0.055)";

    roundedRect(
      ctx,
      x,
      cardY,
      cardWidth,
      cardH,
      13,
    );

    ctx.fill();

    ctx.strokeStyle =
      "rgba(255,255,255,0.08)";

    ctx.lineWidth = 1;

    roundedRect(
      ctx,
      x,
      cardY,
      cardWidth,
      cardH,
      13,
    );

    ctx.stroke();

    ctx.fillStyle =
      "rgba(255,255,255,0.42)";

    ctx.font = "bold 12px Sans";

    ctx.fillText(
      label,
      x + 13,
      cardY + 23,
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Sans";

    const safeValue = truncate(
      ctx,
      value,
      cardWidth - 26,
    );

    ctx.fillText(
      safeValue,
      x + 13,
      cardY + 48,
    );
  });

  // --------------------------------------------------------------------------
  // Playback information
  // --------------------------------------------------------------------------

  const playbackY = 330;

  ctx.fillStyle =
    "rgba(255,255,255,0.42)";

  ctx.font = "bold 13px Sans";

  ctx.fillText(
    "REPEAT",
    contentX,
    playbackY,
  );

  ctx.fillText(
    "AUTOPLAY",
    contentX + 150,
    playbackY,
  );

  ctx.fillText(
    "STATUS",
    contentX + 330,
    playbackY,
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px Sans";

  ctx.fillText(
    String(repeatMode || "off").toUpperCase(),
    contentX,
    playbackY + 28,
  );

  ctx.fillText(
    autoplay ? "ON" : "OFF",
    contentX + 150,
    playbackY + 28,
  );

  ctx.fillText(
    paused ? "PAUSED" : "PLAYING",
    contentX + 330,
    playbackY + 28,
  );

  // --------------------------------------------------------------------------
  // Progress
  // --------------------------------------------------------------------------

  const progressY = 410;

  if (duration > 0) {
    drawProgress(
      ctx,
      contentX,
      progressY,
      contentWidth,
      position,
      duration,
    );

    ctx.fillStyle =
      "rgba(255,255,255,0.58)";

    ctx.font = "14px Sans";

    ctx.fillText(
      formatTime(position),
      contentX,
      progressY + 32,
    );

    ctx.textAlign = "right";

    ctx.fillText(
      formatTime(duration),
      contentX + contentWidth,
      progressY + 32,
    );

    ctx.textAlign = "left";
  } else {
    ctx.fillStyle =
      "rgba(255,255,255,0.58)";

    ctx.font = "bold 15px Sans";

    ctx.fillText(
      "LIVE STREAM",
      contentX,
      progressY + 5,
    );
  }

  // --------------------------------------------------------------------------
  // Footer
  // --------------------------------------------------------------------------

  ctx.fillStyle =
    "rgba(255,255,255,0.35)";

  ctx.font = "14px Sans";

  ctx.fillText(
    "Use the controls below to manage playback",
    contentX,
    510,
  );

  ctx.textAlign = "right";

  ctx.fillText(
    "Zeechei Music",
    W - 50,
    510,
  );

  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

// ============================================================================
// MUSIC BUTTONS
// ============================================================================

function buildNowPlayingRows(player) {
  const isPlaying =
    player &&
    player.playing &&
    !player.paused;

  const autoplay = player
    ? player.get("autoplay") || false
    : false;

  const loopMode =
    player?.repeatMode || "off";

  // --------------------------------------------------------------------------
  // Row 1
  // --------------------------------------------------------------------------

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np_autoplay")
      .setEmoji(
        autoplay
          ? BTN.np_autoplay_on
          : BTN.np_autoplay_off,
      )
      .setStyle(
        autoplay
          ? ButtonStyle.Success
          : ButtonStyle.Secondary,
      ),

    new ButtonBuilder()
      .setCustomId("np_prev")
      .setEmoji(BTN.np_prev)
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("np_pauseresume")
      .setEmoji(
        isPlaying
          ? BTN.np_pause
          : BTN.np_resume,
      )
      .setStyle(
        isPlaying
          ? ButtonStyle.Primary
          : ButtonStyle.Success,
      ),

    new ButtonBuilder()
      .setCustomId("np_skip")
      .setEmoji(BTN.np_skip)
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("np_stop")
      .setEmoji(BTN.np_stop)
      .setStyle(ButtonStyle.Danger),
  );

  // --------------------------------------------------------------------------
  // Row 2
  // --------------------------------------------------------------------------

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np_loop_queue")
      .setEmoji(BTN.np_loop_off)
      .setStyle(
        loopMode === "queue"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      ),

    new ButtonBuilder()
      .setCustomId("np_loop_track")
      .setEmoji(BTN.np_loop_track)
      .setStyle(
        loopMode === "track"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      ),

    new ButtonBuilder()
      .setCustomId("np_shuffle")
      .setEmoji(BTN.np_shuffle)
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("np_volup")
      .setEmoji(BTN.np_volup)
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("np_voldown")
      .setEmoji(BTN.np_voldown)
      .setStyle(ButtonStyle.Secondary),
  );

  // --------------------------------------------------------------------------
  // Row 3
  // --------------------------------------------------------------------------

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np_queue")
      .setEmoji(BTN.np_queue)
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("np_clearqueue")
      .setEmoji(BTN.np_delete)
      .setStyle(ButtonStyle.Danger),
  );

  // --------------------------------------------------------------------------
  // Filter select
  // --------------------------------------------------------------------------

  const filterRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("np_filter")
      .setPlaceholder("Select an audio filter...")
      .addOptions(FILTER_OPTIONS),
  );

  return {
    row1,
    row2,
    row3,
    filterRow,
  };
}

// ============================================================================
// NOW PLAYING V2
// ============================================================================

function buildNowPlayingV2(
  client,
  player,
  track,
  overridePosition,
  imageUrl,
  imageBuffer,
) {
  const color =
    client.getColor(player.guildId);

  const info = track.info;

  const durationMs =
    info.duration || 0;

  const position =
    overridePosition !== undefined
      ? overridePosition
      : player.position || 0;

  const { row1, row2, row3, filterRow } =
    buildNowPlayingRows(player);

  const builder =
    new V2Builder(color);

  // --------------------------------------------------------------------------
  // New card
  // --------------------------------------------------------------------------

  if (imageUrl) {
    builder.media(imageUrl);
  } else {
    const title =
      (info.title || "Unknown").slice(
        0,
        55,
      );

    const artist =
      info.author || "Unknown";

    const src =
      (
        info.sourceName ||
        "YouTube"
      ).replace(
        /^./,
        (c) => c.toUpperCase(),
      );

    const req =
      track.requester?.username ||
      "Unknown";

    builder.section(
      `### ${title}\n` +
        `${artist}\n` +
        `-# SRC: ${src}  •  By: ${req}`,
      info.artworkUrl || null,
    );
  }

  // --------------------------------------------------------------------------
  // Controls only underneath card
  // --------------------------------------------------------------------------

  builder
    .sep()
    .row(filterRow)
    .sep()
    .row(row1)
    .row(row2)
    .row(row3);

  const files = [];

  if (
    imageBuffer &&
    imageUrl ===
      "attachment://zeechei-card.png"
  ) {
    files.push(
      new AttachmentBuilder(
        imageBuffer,
        {
          name: "zeechei-card.png",
        },
      ),
    );
  }

  return builder.build(
    files.length
      ? files
      : undefined,
  );
}

// ============================================================================
// FILTER APPLY
// ============================================================================

async function applyFilter(
  player,
  filterName,
) {
  const fm = player.filterManager;

  if (!fm) {
    return filterName;
  }

  // Reset existing filters first.
  try {
    await fm.resetFilters();
  } catch {}

  if (filterName === "remove") {
    return filterName;
  }

  const filter =
    FILTER_MAP[filterName];

  if (!filter) {
    return filterName;
  }

  try {
    switch (filter.type) {
      case "timescale":
        await fm.setTimescale(
          filter.data,
        );
        break;

      case "equalizer":
        await fm.setEqualizer(
          filter.data,
        );
        break;

      case "vibrato":
        await fm.setVibrato(
          filter.data,
        );
        break;

      case "tremolo":
        await fm.setTremolo(
          filter.data,
        );
        break;

      case "rotation":
        await fm.setRotation(
          filter.data,
        );
        break;

      case "karaoke":
        await fm.setKaraoke(
          filter.data,
        );
        break;

      case "lowPass":
        await fm.setLowPass(
          filter.data,
        );
        break;
    }

    if (
      typeof fm.update === "function"
    ) {
      await fm.update().catch(
        () => {},
      );
    }

    if (
      typeof fm.applyFilters ===
      "function"
    ) {
      await fm
        .applyFilters()
        .catch(() => {});
    }
  } catch (error) {
    console.error(
      "[Filter]",
      error.message,
    );
  }

  return filterName;
}

// ============================================================================
// FILTER RESULT
// ============================================================================

function buildFilterV2(
  filterName,
  userId,
  color,
) {
  const displayName =
    filterName === "remove"
      ? "No Filter (Removed)"
      : filterName
          .replace(/_/g, " ")
          .replace(
            /\b\w/g,
            (c) => c.toUpperCase(),
          );

  return new V2Builder(color)
    .text(
      `### Filter Applied\n\n` +
        `> **Filter:** ${displayName}\n` +
        `> **Applied by:** <@${userId}>\n` +
        `-# Filter is now active on the player`,
    )
    .buildEphemeral();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  generateNowPlayingCard,
  formatTime,

  buildNowPlayingV2,
  buildNowPlayingRows,
  buildProgressBar,

  applyFilter,
  buildFilterV2,

  FILTER_OPTIONS,
  FILTER_MAP,
};