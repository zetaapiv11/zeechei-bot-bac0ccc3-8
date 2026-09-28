const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fetch } = require("undici");

function formatTime(ms) {
  if (!ms || ms <= 0) return "LIVE";

  const total = Math.floor(ms / 1000);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function truncate(ctx, text, maxWidth) {
  let value = String(text || "Unknown");

  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }

  while (
    value.length > 4 &&
    ctx.measureText(`${value}...`).width > maxWidth
  ) {
    value = value.slice(0, -1);
  }

  return `${value}...`;
}

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(
    width / image.width,
    height / image.height
  );

  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  const dx =
    x + (width - drawWidth) / 2;

  const dy =
    y + (height - drawHeight) / 2;

  ctx.save();

  ctx.beginPath();
  ctx.rect(
    x,
    y,
    width,
    height
  );
  ctx.clip();

  ctx.drawImage(
    image,
    dx,
    dy,
    drawWidth,
    drawHeight
  );

  ctx.restore();
}

function drawProgress(
  ctx,
  x,
  y,
  width,
  position,
  duration
) {
  const ratio =
    duration > 0
      ? Math.min(
          Math.max(
            position / duration,
            0
          ),
          1
        )
      : 0;

  ctx.save();

  ctx.fillStyle =
    "rgba(255,255,255,0.12)";

  roundedRect(
    ctx,
    x,
    y,
    width,
    8,
    4
  );

  ctx.fill();

  const progressWidth =
    Math.max(
      8,
      width * ratio
    );

  const gradient =
    ctx.createLinearGradient(
      x,
      y,
      x + width,
      y
    );

  gradient.addColorStop(
    0,
    "#9b5cff"
  );

  gradient.addColorStop(
    0.5,
    "#6d8cff"
  );

  gradient.addColorStop(
    1,
    "#55c8ff"
  );

  ctx.fillStyle = gradient;

  roundedRect(
    ctx,
    x,
    y,
    progressWidth,
    8,
    4
  );

  ctx.fill();

  ctx.beginPath();

  ctx.arc(
    x + progressWidth,
    y + 4,
    7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#ffffff";

  ctx.shadowColor =
    "rgba(120,100,255,0.8)";

  ctx.shadowBlur = 12;

  ctx.fill();

  ctx.restore();
}

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
  repeatMode = "off",
  autoplay = false,
  paused = false,
}) {
  const W = 1400;
  const H = 560;

  const canvas =
    createCanvas(W, H);

  const ctx =
    canvas.getContext("2d");

  let artwork = null;

  if (artworkUrl) {
    try {
      const response =
        await fetch(
          artworkUrl,
          {
            signal:
              AbortSignal.timeout(
                6000
              ),
          }
        );

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      artwork =
        await loadImage(buffer);
    } catch {}
  }

  /*
   * BACKGROUND
   */

  ctx.fillStyle =
    "#080910";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * ARTWORK BLUR BACKGROUND
   */

  if (artwork) {
    ctx.save();

    ctx.globalAlpha =
      0.20;

    ctx.filter =
      "blur(35px)";

    drawImageCover(
      ctx,
      artwork,
      -50,
      -50,
      W + 100,
      H + 100
    );

    ctx.restore();
  }

  /*
   * DARK OVERLAY
   */

  const bg =
    ctx.createLinearGradient(
      0,
      0,
      W,
      H
    );

  bg.addColorStop(
    0,
    "rgba(5,6,12,0.98)"
  );

  bg.addColorStop(
    0.45,
    "rgba(8,9,17,0.96)"
  );

  bg.addColorStop(
    1,
    "rgba(12,10,22,0.92)"
  );

  ctx.fillStyle = bg;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * OUTER BORDER
   */

  ctx.save();

  const border =
    ctx.createLinearGradient(
      0,
      0,
      W,
      0
    );

  border.addColorStop(
    0,
    "rgba(155,92,255,0.85)"
  );

  border.addColorStop(
    0.5,
    "rgba(90,130,255,0.45)"
  );

  border.addColorStop(
    1,
    "rgba(155,92,255,0.10)"
  );

  ctx.strokeStyle =
    border;

  ctx.lineWidth = 2;

  roundedRect(
    ctx,
    18,
    18,
    W - 36,
    H - 36,
    28
  );

  ctx.stroke();

  ctx.restore();

  /*
   * LEFT ACCENT
   */

  const accent =
    ctx.createLinearGradient(
      0,
      0,
      0,
      H
    );

  accent.addColorStop(
    0,
    "#a85cff"
  );

  accent.addColorStop(
    0.5,
    "#5c8cff"
  );

  accent.addColorStop(
    1,
    "#a85cff"
  );

  ctx.fillStyle =
    accent;

  ctx.fillRect(
    18,
    48,
    4,
    H - 96
  );

  /*
   * ARTWORK PANEL
   */

  const artX = 50;
  const artY = 72;
  const artW = 390;
  const artH = 390;

  if (artwork) {
    ctx.save();

    ctx.shadowColor =
      "rgba(0,0,0,0.65)";

    ctx.shadowBlur = 35;

    roundedRect(
      ctx,
      artX,
      artY,
      artW,
      artH,
      24
    );

    ctx.fillStyle =
      "#11131c";

    ctx.fill();

    ctx.restore();

    ctx.save();

    roundedRect(
      ctx,
      artX,
      artY,
      artW,
      artH,
      24
    );

    ctx.clip();

    drawImageCover(
      ctx,
      artwork,
      artX,
      artY,
      artW,
      artH
    );

    ctx.restore();

    /*
     * Artwork overlay
     */

    const artOverlay =
      ctx.createLinearGradient(
        artX,
        artY,
        artX,
        artY + artH
      );

    artOverlay.addColorStop(
      0,
      "rgba(0,0,0,0.02)"
    );

    artOverlay.addColorStop(
      0.65,
      "rgba(0,0,0,0.05)"
    );

    artOverlay.addColorStop(
      1,
      "rgba(0,0,0,0.45)"
    );

    ctx.save();

    roundedRect(
      ctx,
      artX,
      artY,
      artW,
      artH,
      24
    );

    ctx.clip();

    ctx.fillStyle =
      artOverlay;

    ctx.fillRect(
      artX,
      artY,
      artW,
      artH
    );

    ctx.restore();
  }

  /*
   * BRAND
   */

  ctx.font =
    "700 17px Arial";

  ctx.fillStyle =
    "#a86cff";

  ctx.fillText(
    "ZEECHEI MUSIC",
    490,
    70
  );

  /*
   * STATUS
   */

  const status =
    paused
      ? "PAUSED"
      : "NOW PLAYING";

  const statusColor =
    paused
      ? "#ffbd55"
      : "#6dffb1";

  ctx.font =
    "700 15px Arial";

  ctx.fillStyle =
    statusColor;

  ctx.fillText(
    status,
    1160,
    70
  );

  /*
   * TITLE
   */

  ctx.save();

  let titleSize = 44;

  ctx.font =
    `700 ${titleSize}px Arial`;

  const titleMax =
    820;

  while (
    ctx.measureText(
      title
    ).width > titleMax &&
    titleSize > 24
  ) {
    titleSize -= 2;

    ctx.font =
      `700 ${titleSize}px Arial`;
  }

  const safeTitle =
    truncate(
      ctx,
      title,
      titleMax
    );

  ctx.fillStyle =
    "#ffffff";

  ctx.shadowColor =
    "rgba(145,90,255,0.35)";

  ctx.shadowBlur = 18;

  ctx.fillText(
    safeTitle,
    490,
    145
  );

  ctx.restore();

  /*
   * ARTIST
   */

  ctx.font =
    "400 25px Arial";

  ctx.fillStyle =
    "rgba(225,225,240,0.78)";

  const safeArtist =
    truncate(
      ctx,
      artist,
      820
    );

  ctx.fillText(
    safeArtist,
    490,
    185
  );

  /*
   * INFO CARDS
   */

  const cards = [
    [
      "SOURCE",
      source || "YouTube Music",
    ],
    [
      "REQUESTED BY",
      requester || "Unknown",
    ],
    [
      "QUEUE",
      `${queueSize}`,
    ],
    [
      "VOLUME",
      `${volume}%`,
    ],
  ];

  const cardY = 225;
  const cardW = 195;
  const cardH = 70;
  const gap = 14;

  cards.forEach(
    ([label, value], index) => {
      const x =
        490 +
        index *
          (cardW + gap);

      ctx.save();

      ctx.fillStyle =
        "rgba(255,255,255,0.045)";

      ctx.strokeStyle =
        "rgba(160,100,255,0.16)";

      ctx.lineWidth = 1;

      roundedRect(
        ctx,
        x,
        cardY,
        cardW,
        cardH,
        12
      );

      ctx.fill();

      ctx.stroke();

      ctx.font =
        "700 11px Arial";

      ctx.fillStyle =
        "rgba(175,175,200,0.60)";

      ctx.fillText(
        label,
        x + 14,
        cardY + 22
      );

      ctx.font =
        "600 16px Arial";

      ctx.fillStyle =
        "#ffffff";

      const safeValue =
        truncate(
          ctx,
          value,
          cardW - 28
        );

      ctx.fillText(
        safeValue,
        x + 14,
        cardY + 48
      );

      ctx.restore();
    }
  );

  /*
   * PLAYBACK STATE
   */

  const stateY =
    335;

  ctx.font =
    "700 13px Arial";

  ctx.fillStyle =
    "rgba(175,175,200,0.65)";

  ctx.fillText(
    "PLAYBACK",
    490,
    stateY
  );

  let repeatText =
    "OFF";

  if (
    repeatMode === "track"
  ) {
    repeatText =
      "TRACK";
  } else if (
    repeatMode === "queue"
  ) {
    repeatText =
      "QUEUE";
  }

  ctx.font =
    "600 16px Arial";

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    `Repeat: ${repeatText}`,
    490,
    stateY + 28
  );

  ctx.fillText(
    `Autoplay: ${
      autoplay
        ? "ON"
        : "OFF"
    }`,
    650,
    stateY + 28
  );

  ctx.fillStyle =
    paused
      ? "#ffbd55"
      : "#6dffb1";

  ctx.fillText(
    `Status: ${status}`,
    820,
    stateY + 28
  );

  /*
   * PROGRESS
   */

  const progressY =
    405;

  drawProgress(
    ctx,
    490,
    progressY,
    820,
    position,
    duration
  );

  ctx.font =
    "500 14px Arial";

  ctx.fillStyle =
    "rgba(220,220,235,0.72)";

  ctx.fillText(
    formatTime(position),
    490,
    progressY + 32
  );

  ctx.textAlign =
    "right";

  ctx.fillText(
    formatTime(duration),
    1310,
    progressY + 32
  );

  ctx.textAlign =
    "left";

  /*
   * FOOTER
   */

  ctx.font =
    "500 13px Arial";

  ctx.fillStyle =
    "rgba(160,160,185,0.55)";

  ctx.fillText(
    "Use the controls below to manage playback",
    50,
    510
  );

  ctx.textAlign =
    "right";

  ctx.fillText(
    "Zeechei Music",
    1350,
    510
  );

  ctx.textAlign =
    "left";

  return canvas.toBuffer(
    "image/png"
  );
}

module.exports = {
  generateNowPlayingCard,
  formatTime,
};