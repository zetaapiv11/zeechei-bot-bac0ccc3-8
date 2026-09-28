const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fetch } = require("undici");
const { getAllBadges } = require("./badges");

// ─────────────────────────────────────────────────────────────────────────────
//  NOW PLAYING CARD  —  1200 × 400 px
//  Artwork covers the entire right 400 × 400 square (full-bleed, no padding)
// ─────────────────────────────────────────────────────────────────────────────
async function generateNowPlayingCard({ title, artist, source, requester, artworkUrl }) {
  const W = 1200, H = 400;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── Load artwork ────────────────────────────────────────────────────────────
  let artwork = null;
  if (artworkUrl) {
    try {
      const res = await fetch(artworkUrl, { signal: AbortSignal.timeout(6000) });
      const buf = Buffer.from(await res.arrayBuffer());
      artwork   = await loadImage(buf);
    } catch (_) {}
  }

  // ── BACKGROUND ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "#0d0d14";
  ctx.fillRect(0, 0, W, H);

  // Blurred artwork fill (faint, behind text area)
  if (artwork) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(artwork, -60, -60, W + 120, H + 120);
    ctx.restore();
  }

  // Dark overlay — heavy on the left (text), fades to transparent right of x=800
  const bgOvl = ctx.createLinearGradient(0, 0, W, 0);
  bgOvl.addColorStop(0,    "rgba(8,8,14,0.98)");
  bgOvl.addColorStop(0.55, "rgba(8,8,14,0.95)");
  bgOvl.addColorStop(0.66, "rgba(8,8,14,0.60)");
  bgOvl.addColorStop(1,    "rgba(8,8,14,0.00)");
  ctx.fillStyle = bgOvl;
  ctx.fillRect(0, 0, W, H);

  // Radial glow behind text
  const radGlow = ctx.createRadialGradient(340, H / 2, 0, 340, H / 2, 420);
  radGlow.addColorStop(0,   "rgba(120,60,220,0.14)");
  radGlow.addColorStop(0.6, "rgba(60,100,200,0.06)");
  radGlow.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, W, H);

  // ── ARTWORK — full-bleed square filling the right 400×400 ──────────────────
  if (artwork) {
    // Draw artwork flush to right edge, top-to-bottom (no padding, no rounding)
    const AX = W - H;  // 800
    const AY = 0;
    const AW = H;      // 400
    const AH = H;      // 400

    // Drop shadow on the left edge of the artwork panel
    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.85)";
    ctx.shadowBlur    = 50;
    ctx.shadowOffsetX = -12;
    ctx.fillStyle     = "#000";
    ctx.fillRect(AX, AY, AW, AH);
    ctx.restore();

    // Draw artwork clipped to exact square
    ctx.save();
    ctx.beginPath();
    ctx.rect(AX, AY, AW, AH);
    ctx.clip();
    ctx.drawImage(artwork, AX, AY, AW, AH);
    ctx.restore();

    // Blend left edge of artwork into text panel
    const artFade = ctx.createLinearGradient(AX - 90, 0, AX + 30, 0);
    artFade.addColorStop(0, "rgba(8,8,14,1)");
    artFade.addColorStop(1, "rgba(8,8,14,0)");
    ctx.fillStyle = artFade;
    ctx.fillRect(AX - 90, 0, 120, H);

    // Subtle purple border glow on left edge of artwork
    ctx.save();
    ctx.strokeStyle = "rgba(160,80,255,0.50)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(AX, AY);
    ctx.lineTo(AX, AY + AH);
    ctx.stroke();
    ctx.restore();
  }

  // ── ACCENT BARS ─────────────────────────────────────────────────────────────
  const accentBar = ctx.createLinearGradient(0, 0, 0, H);
  accentBar.addColorStop(0,   "#b060ff");
  accentBar.addColorStop(0.5, "#6090ff");
  accentBar.addColorStop(1,   "#b060ff");
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, 5, H);

  const topLine = ctx.createLinearGradient(0, 0, W * 0.75, 0);
  topLine.addColorStop(0,    "rgba(160,80,255,0.85)");
  topLine.addColorStop(0.45, "rgba(80,150,255,0.65)");
  topLine.addColorStop(1,    "rgba(80,150,255,0)");
  ctx.fillStyle = topLine;
  ctx.fillRect(5, 0, W * 0.75, 3);

  // ── BRAND TAG ───────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = "bold 15px sans-serif";
  ctx.fillStyle = "rgba(160,80,255,0.80)";
  letterSpaced(ctx, "ZEECHEI MUSIC", 38, 46, 2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.18;
  const sepG = ctx.createLinearGradient(38, 0, 500, 0);
  sepG.addColorStop(0, "#ffffff");
  sepG.addColorStop(1, "transparent");
  ctx.fillStyle = sepG;
  ctx.fillRect(38, 58, 460, 1);
  ctx.restore();

  // ── TITLE — auto-fit ────────────────────────────────────────────────────────
  const MAX_TEXT_W = 720;
  ctx.save();
  ctx.fillStyle   = "#ffffff";
  ctx.shadowColor = "rgba(160,80,255,0.45)";
  ctx.shadowBlur  = 14;
  let titleFontSize = 38;
  let displayTitle  = title;
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  while (ctx.measureText(displayTitle).width > MAX_TEXT_W && titleFontSize > 22) {
    titleFontSize -= 2;
    ctx.font = `bold ${titleFontSize}px sans-serif`;
  }
  while (ctx.measureText(displayTitle).width > MAX_TEXT_W && displayTitle.length > 4) {
    displayTitle = displayTitle.slice(0, -2) + "…";
  }
  ctx.fillText(displayTitle, 38, 148);
  ctx.restore();

  // ── ARTIST ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = "22px sans-serif";
  ctx.fillStyle = "rgba(210,210,235,0.80)";
  let displayArtist = artist;
  while (ctx.measureText(displayArtist).width > MAX_TEXT_W && displayArtist.length > 4) {
    displayArtist = displayArtist.slice(0, -2) + "…";
  }
  ctx.fillText(displayArtist, 38, 192);
  ctx.restore();

  // ── META LINE ───────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = "16px sans-serif";
  ctx.fillStyle = "rgba(160,160,190,0.50)";
  ctx.fillText(`Source: ${source}   ·   Requested by: ${requester}`, 38, 232);
  ctx.restore();

  // ── WAVEFORM ────────────────────────────────────────────────────────────────
  drawWaveform(ctx, 38, 290, 300, 42);

  // ── BOTTOM ACCENT ───────────────────────────────────────────────────────────
  const botLine = ctx.createLinearGradient(0, H - 3, W * 0.65, H - 3);
  botLine.addColorStop(0,    "rgba(160,80,255,0.70)");
  botLine.addColorStop(0.45, "rgba(80,150,255,0.45)");
  botLine.addColorStop(1,    "rgba(80,150,255,0)");
  ctx.fillStyle = botLine;
  ctx.fillRect(5, H - 3, W * 0.65, 3);

  return canvas.toBuffer("image/png");
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATS CHART  —  1100 × 500 px
//  Left half: Server all-time leaderboard
//  Right half: Today's leaderboard
//  Header: 4 stat pills
// ─────────────────────────────────────────────────────────────────────────────
async function generateStatsChart({
  globalTotal, guildTotal, userGlobal, userToday,
  serverLB, dailyLB, guildName,
}) {
  const W = 1100, H = 500;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0d0d14";
  ctx.fillRect(0, 0, W, H);

  // Subtle gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "rgba(120,60,220,0.08)");
  bgGrad.addColorStop(1, "rgba(60,100,200,0.05)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Top accent
  const topAccent = ctx.createLinearGradient(0, 0, W, 0);
  topAccent.addColorStop(0,   "rgba(160,80,255,0.9)");
  topAccent.addColorStop(0.5, "rgba(80,150,255,0.7)");
  topAccent.addColorStop(1,   "rgba(80,150,255,0)");
  ctx.fillStyle = topAccent;
  ctx.fillRect(0, 0, W, 4);

  // Left accent bar
  const leftAccent = ctx.createLinearGradient(0, 0, 0, H);
  leftAccent.addColorStop(0,   "#b060ff");
  leftAccent.addColorStop(0.5, "#6090ff");
  leftAccent.addColorStop(1,   "#b060ff");
  ctx.fillStyle = leftAccent;
  ctx.fillRect(0, 0, 4, H);

  // ── HEADER ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = "bold 22px sans-serif";
  ctx.fillStyle = "rgba(160,80,255,0.95)";
  letterSpaced(ctx, "COMMAND STATISTICS", 28, 42, 1.5);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle   = "#ffffff";
  ctx.fillRect(28, 54, W - 56, 1);
  ctx.restore();

  // ── STAT PILLS ──────────────────────────────────────────────────────────────
  const pills = [
    { label: "Global Total",  value: globalTotal.toLocaleString() },
    { label: "Server Total",  value: guildTotal.toLocaleString()  },
    { label: "Your Total",    value: userGlobal.toLocaleString()  },
    { label: "Your Today",    value: userToday.toLocaleString()   },
  ];
  const pillW = 230, pillH = 54, pillY = 64, pillGap = 16;
  pills.forEach((pill, i) => {
    const px = 28 + i * (pillW + pillGap);

    ctx.save();
    ctx.fillStyle   = "rgba(255,255,255,0.05)";
    ctx.strokeStyle = "rgba(160,80,255,0.25)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(px, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font      = "bold 20px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pill.value, px + 14, pillY + 26);
    ctx.restore();

    ctx.save();
    ctx.font      = "12px sans-serif";
    ctx.fillStyle = "rgba(160,160,190,0.70)";
    ctx.fillText(pill.label, px + 14, pillY + 44);
    ctx.restore();
  });

  // ── CHART AREA ──────────────────────────────────────────────────────────────
  const chartY = 140;

  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle   = "#ffffff";
  ctx.fillRect(28, chartY - 6, W - 56, 1);
  ctx.restore();

  // Section labels
  ctx.save();
  ctx.font      = "bold 14px sans-serif";
  ctx.fillStyle = "rgba(160,80,255,0.90)";
  ctx.fillText(`SERVER LEADERBOARD${guildName ? `  —  ${guildName}` : ""}`, 28, chartY + 16);
  ctx.fillText("TODAY'S LEADERBOARD", W / 2 + 24, chartY + 16);
  ctx.restore();

  // Center divider
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle   = "#ffffff";
  ctx.fillRect(W / 2 + 8, chartY, 1, H - chartY - 20);
  ctx.restore();

  const barAreaY = chartY + 30;
  const barAreaH = H - barAreaY - 28;
  const halfW    = W / 2 - 60;

  drawHBarChart(ctx, 28,          barAreaY, halfW, barAreaH, serverLB, "#b060ff", "#6090ff");
  drawHBarChart(ctx, W / 2 + 24, barAreaY, halfW, barAreaH, dailyLB,  "#ff6090", "#ff9060");

  // Bottom accent
  const botAccent = ctx.createLinearGradient(0, 0, W * 0.7, 0);
  botAccent.addColorStop(0, "rgba(160,80,255,0.65)");
  botAccent.addColorStop(1, "rgba(80,150,255,0)");
  ctx.fillStyle = botAccent;
  ctx.fillRect(0, H - 4, W * 0.7, 4);

  return canvas.toBuffer("image/png");
}

// ── Horizontal bar chart helper ───────────────────────────────────────────────
function drawHBarChart(ctx, x, y, w, h, entries, colorA, colorB) {
  if (!entries || !entries.length) {
    ctx.save();
    ctx.font      = "14px sans-serif";
    ctx.fillStyle = "rgba(160,160,190,0.50)";
    ctx.fillText("No data yet — start using commands!", x + 8, y + 30);
    ctx.restore();
    return;
  }

  const maxVal   = entries[0]?.count || 1;
  const n        = Math.min(entries.length, 8);
  const barH     = Math.min(34, Math.floor((h - n * 8) / n));
  const gap      = Math.min(10, Math.floor((h - n * barH) / Math.max(n - 1, 1)));
  const labelW   = 106;
  const barAreaW = Math.max(w - labelW - 52, 80);

  for (let i = 0; i < n; i++) {
    const entry = entries[i];
    const by    = y + i * (barH + gap);
    const ratio = entry.count / maxVal;
    const bw    = Math.max(Math.round(ratio * barAreaW), 4);

    // Rank badge
    ctx.save();
    ctx.font      = "bold 11px sans-serif";
    ctx.fillStyle = i === 0
      ? "rgba(255,215,0,0.90)"       // gold for #1
      : i === 1
        ? "rgba(192,192,192,0.85)"   // silver for #2
        : i === 2
          ? "rgba(205,127,50,0.85)"  // bronze for #3
          : "rgba(160,80,255,0.70)";
    ctx.fillText(`#${i + 1}`, x, by + barH - 6);
    ctx.restore();

    // Username
    ctx.save();
    ctx.font      = "13px sans-serif";
    ctx.fillStyle = "rgba(210,210,235,0.90)";
    const name = (entry.name || "Unknown").slice(0, 12);
    ctx.fillText(name, x + 26, by + barH - 6);
    ctx.restore();

    // Bar fill
    const barX = x + labelW;
    const grad  = ctx.createLinearGradient(barX, 0, barX + bw, 0);
    grad.addColorStop(0, colorA + "dd");
    grad.addColorStop(1, colorB + "aa");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, by, bw, barH, 4);
    ctx.fill();
    ctx.restore();

    // Count value to the right of bar
    ctx.save();
    ctx.font      = "bold 12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText(entry.count.toLocaleString(), barX + bw + 7, by + barH - 6);
    ctx.restore();
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function letterSpaced(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function drawWaveform(ctx, x, y, width, maxH) {
  const heights = [0.35, 0.55, 0.80, 0.65, 0.90, 0.75, 1.0, 0.85, 0.70, 0.95,
                   0.80, 0.60, 0.45, 0.70, 0.55, 0.40, 0.65, 0.50, 0.35, 0.55];
  const barW = 7, gap = 5, bars = heights.length;
  const totalW = bars * barW + (bars - 1) * gap;
  const startX = x + (width - totalW) / 2;

  const waveGrad = ctx.createLinearGradient(startX, y, startX + totalW, y);
  waveGrad.addColorStop(0,   "rgba(160,80,255,0.85)");
  waveGrad.addColorStop(0.5, "rgba(80,150,255,0.75)");
  waveGrad.addColorStop(1,   "rgba(160,80,255,0.60)");

  ctx.save();
  ctx.fillStyle = waveGrad;
  heights.forEach((h, i) => {
    const bh = Math.round(h * maxH);
    const bx = startX + i * (barW + gap);
    const by = y + (maxH - bh) / 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, bh, 3);
    ctx.fill();
  });
  ctx.restore();
}

// ── Custom emoji helpers ──────────────────────────────────────────────────────
function parseCustomEmoji(str) {
  const m = str?.match(/^<(a?):(\w+):(\d+)>$/);
  if (m) return { animated: m[1] === "a", name: m[2], id: m[3] };
  return null;
}
async function loadEmojiImage(emojiStr) {
  const custom = parseCustomEmoji(emojiStr);
  if (!custom) return null;
  try {
    const ext = custom.animated ? "gif" : "png";
    const res = await fetch(`https://cdn.discordapp.com/emojis/${custom.id}.${ext}?size=64`,
      { signal: AbortSignal.timeout(5000) });
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE CARD  —  1200 × 680 px
//  Mechanical matt-black background, circular avatar with badge glow,
//  Zeechei badges panel on right, bio card on left.
// ─────────────────────────────────────────────────────────────────────────────
async function generateProfileCard({ username, userId, avatarUrl, avatarDecorationUrl, bio, userBadges = [], likedCount = 0, cmdsUsed = 0 }) {
  const BADGES = getAllBadges();
  const W = 1200, H = 680;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── BACKGROUND ──────────────────────────────────────────────────────────────
  drawMechanicalBackground(ctx, W, H);

  // ── LOAD AVATAR + DECORATION ────────────────────────────────────────────────
  let avatarImg = null;
  if (avatarUrl) {
    try {
      const url = avatarUrl.replace(/\.webp(\?.*)?$/, ".png$1");
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      avatarImg = await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch (_) {}
  }

  let decoImg = null;
  if (avatarDecorationUrl) {
    try {
      const res = await fetch(avatarDecorationUrl, { signal: AbortSignal.timeout(6000) });
      decoImg = await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch (_) {}
  }

  // ── PRE-FETCH custom emoji images for badge cards ────────────────────────────
  const badgeEmojiImgs = {};
  await Promise.all(
    userBadges.map(async (k) => {
      const emoji = BADGES[k]?.emoji;
      if (!emoji) return;
      const img = await loadEmojiImage(emoji);
      if (img) badgeEmojiImgs[k] = img;
    })
  );

  // Top badge color for avatar glow (owner wins, then in registry order)
  const BADGE_PRIORITY = ["owner","developer","staff","premium","supporter","partner","vip","verified","tester","bug_hunter","og"];
  const topBadgeKey   = BADGE_PRIORITY.find(k => userBadges.includes(k));
  const glowColor     = topBadgeKey ? (BADGES[topBadgeKey]?.color || null) : null;

  // ── AVATAR + SPIKE GLOW ──────────────────────────────────────────────────────
  const AX = 130, AY = 155, AR = 82;
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(AX, AY, AR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, AX - AR, AY - AR, AR * 2, AR * 2);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = "#1e1e24";
    ctx.beginPath();
    ctx.arc(AX, AY, AR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Avatar glow ring — badge color if user has badges, else subtle white
  if (!decoImg) {
    ctx.save();
    if (glowColor) {
      // Outer soft glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 22;
      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(AX, AY, AR + 4, 0, Math.PI * 2);
      ctx.stroke();
      // Inner bright ring
      ctx.shadowBlur  = 8;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(AX, AY, AR + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(AX, AY, AR + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── AVATAR DECORATION ────────────────────────────────────────────────────────
  // Discord decorations are transparent PNGs that frame the avatar.
  // They extend ~30% beyond each side of the avatar circle.
  if (decoImg) {
    const DECO_SIZE = AR * 2.6;
    ctx.save();
    ctx.drawImage(decoImg, AX - DECO_SIZE / 2, AY - DECO_SIZE / 2, DECO_SIZE, DECO_SIZE);
    ctx.restore();
  }

  // ── USERNAME ─────────────────────────────────────────────────────────────────
  const TX = AX + AR + 30;
  const displayName = username.length > 22 ? username.slice(0, 21) + "…" : username;
  ctx.save();
  ctx.font         = "bold 38px sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.shadowColor  = glowColor || "rgba(180,180,255,0.70)";
  ctx.shadowBlur   = 18;
  ctx.fillText(displayName, TX, AY - 28);
  ctx.restore();

  // ── USER ID ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = "16px sans-serif";
  ctx.fillStyle = "rgba(180,182,205,0.72)";
  ctx.fillText(`ID: ${userId}`, TX, AY + 8);
  ctx.restore();

  // ── BADGE EMOJI ROW (under ID, left panel) ───────────────────────────────────
  // Draw only Unicode emojis as text; custom Discord emojis are drawn as images.
  if (userBadges.length) {
    let rowX = TX;
    const rowY = AY + 40;
    const ICON_SIZE = 24;
    for (const k of userBadges) {
      const emoji = BADGES[k]?.emoji || "";
      if (!emoji) continue;
      const img = badgeEmojiImgs[k];
      if (img) {
        ctx.save();
        ctx.drawImage(img, rowX, rowY - ICON_SIZE + 4, ICON_SIZE, ICON_SIZE);
        ctx.restore();
        rowX += ICON_SIZE + 6;
      } else if (!parseCustomEmoji(emoji)) {
        ctx.save();
        ctx.font      = "22px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(emoji, rowX, rowY);
        ctx.restore();
        rowX += 30;
      }
      if (rowX > TX + 340) break;
    }
  }

  // ── VERTICAL DIVIDER ─────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(490, 22);
  ctx.lineTo(490, H - 22);
  ctx.stroke();
  ctx.restore();

  // ── RIGHT PANEL — ZEECHEI BADGES ───────────────────────────────────────────────
  const RX = 522;
  ctx.save();
  ctx.font         = "bold 26px sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.fillText("Zeechei Badges", RX, 68);
  ctx.restore();

  // Header underline
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(RX, 82);
  ctx.lineTo(W - 38, 82);
  ctx.stroke();
  ctx.restore();

  // Badge cards — colored pill per badge (2 columns)
  const CARD_W = 288, CARD_H = 52, COL_GAP = 10, ROW_GAP = 8;
  const badgesInfo = userBadges.map((k, idx) => ({ ...BADGES[k], key: k, idx })).filter(b => b.label);

  if (!badgesInfo.length) {
    ctx.save();
    ctx.font      = "italic 17px sans-serif";
    ctx.fillStyle = "rgba(145,145,170,0.60)";
    ctx.fillText("No badges yet", RX, 126);
    ctx.restore();
  } else {
    badgesInfo.forEach((badge, i) => {
      const col   = i % 2;
      const row   = Math.floor(i / 2);
      const cardX = RX + col * (CARD_W + COL_GAP);
      const cardY = 92 + row * (CARD_H + ROW_GAP);
      const color = badge.color || "#8888cc";

      // Card background
      ctx.save();
      ctx.fillStyle = "rgba(18,18,22,0.88)";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, CARD_W, CARD_H, 10);
      ctx.fill();
      ctx.restore();

      // Left color accent bar
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 4, CARD_H, [10, 0, 0, 10]);
      ctx.fill();
      ctx.restore();

      // Subtle card border in badge color
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, CARD_W, CARD_H, 10);
      ctx.stroke();
      ctx.restore();

      // Emoji icon circle background
      const CX = cardX + 28, CY = cardY + CARD_H / 2;
      ctx.save();
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(CX, CY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Emoji icon circle border
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(CX, CY, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Emoji — image if custom Discord emoji, else Unicode text
      const emojiImg = badgeEmojiImgs[badge.key];
      if (emojiImg) {
        const ES = 26;
        ctx.save();
        ctx.drawImage(emojiImg, CX - ES / 2, CY - ES / 2, ES, ES);
        ctx.restore();
      } else if (!parseCustomEmoji(badge.emoji)) {
        ctx.save();
        ctx.font         = "20px sans-serif";
        ctx.fillStyle    = "#ffffff";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badge.emoji, CX, CY + 1);
        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      }

      // Badge label
      ctx.save();
      ctx.font      = "bold 14px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badge.label, cardX + 52, cardY + 20);
      ctx.restore();

      // Badge description
      ctx.save();
      ctx.font      = "12px sans-serif";
      ctx.fillStyle = "rgba(160,162,190,0.72)";
      ctx.fillText(badge.description.slice(0, 32), cardX + 52, cardY + 37);
      ctx.restore();
    });
  }

  // ── BIO CARD ─────────────────────────────────────────────────────────────────
  const BIO_X = 28, BIO_Y = AY + AR + 32;
  const BIO_W = 444, BIO_H = 192;

  ctx.save();
  ctx.fillStyle   = "rgba(24,24,28,0.94)";
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(BIO_X, BIO_Y, BIO_W, BIO_H, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const bioText = bio || "No bio is set";
  ctx.save();
  ctx.font      = bio ? "17px sans-serif" : "italic 17px sans-serif";
  ctx.fillStyle = bio ? "rgba(218,220,242,0.90)" : "rgba(120,122,148,0.65)";
  ctx.textAlign = "center";
  wrapText(ctx, bioText, BIO_X + BIO_W / 2, BIO_Y + 48, BIO_W - 48, 28);
  ctx.textAlign = "left";
  ctx.restore();

  // ── STATS ROW ────────────────────────────────────────────────────────────────
  const SY = BIO_Y + BIO_H + 38;
  [
    { label: "Commands Used", value: cmdsUsed.toLocaleString() },
    { label: "Liked Songs",   value: likedCount.toLocaleString() },
  ].forEach((s, i) => {
    const sx = BIO_X + i * 210;
    ctx.save();
    ctx.font         = "bold 26px sans-serif";
    ctx.fillStyle    = "#ffffff";
    ctx.fillText(s.value, sx, SY);
    ctx.restore();
    ctx.save();
    ctx.font      = "13px sans-serif";
    ctx.fillStyle = "rgba(148,150,178,0.72)";
    ctx.fillText(s.label, sx, SY + 20);
    ctx.restore();
  });

  // ── WATERMARK ────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font         = "bold 15px sans-serif";
  ctx.fillStyle    = "rgba(200,202,228,0.24)";
  ctx.textAlign    = "right";
  ctx.fillText("Zeechei", W - 26, H - 16);
  ctx.textAlign    = "left";
  ctx.restore();

  return canvas.toBuffer("image/png");
}

// ── Mechanical matt-black organic background ──────────────────────────────────
function drawMechanicalBackground(ctx, W, H) {
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, W, H);

  // Organic blob positions: [cx, cy, rx, ry, rotation]
  const blobs = [
    [80,   45,  102, 49, -0.35], [245,  28,   86, 43,  0.55], [408,  58,  112, 53, -0.20],
    [582,  33,   92, 45,  0.40], [762,  52,  102, 49, -0.60], [942,  28,   87, 43,  0.30],
    [1105, 48,   92, 45, -0.45],
    [52,  172,   97, 47,  0.50], [205, 192,  107, 51, -0.30], [374, 162,   82, 41,  0.65],
    [535, 188,  102, 49, -0.55], [704, 165,   92, 45,  0.25], [874, 188,  102, 49, -0.40],
    [1055,172,   87, 43,  0.60],
    [112, 312,   97, 47, -0.25], [294, 332,  102, 49,  0.50], [464, 302,   87, 43, -0.65],
    [634, 322,  112, 53,  0.35], [814, 308,   92, 45, -0.50], [994, 328,   87, 43,  0.45],
    [1155,302,   82, 41, -0.30],
    [62,  452,  102, 49,  0.40], [234, 472,   87, 43, -0.55], [404, 448,  107, 51,  0.25],
    [574, 468,   92, 45, -0.40], [754, 452,   97, 47,  0.60], [934, 472,   87, 43, -0.25],
    [1104,450,  102, 49,  0.45],
    [102, 582,   92, 45, -0.50], [284, 602,  102, 49,  0.35], [464, 578,   87, 43, -0.30],
    [644, 598,  107, 51,  0.55], [824, 582,   92, 45, -0.45], [1004,602,   82, 41,  0.40],
    [1155,578,   97, 47, -0.60],
  ];

  for (const [cx, cy, rx, ry, rot] of blobs) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Outer gradient fill (lighter rim, darker centre)
    const outerGrad = ctx.createRadialGradient(0, -ry * 0.3, 0, 0, 0, Math.max(rx, ry));
    outerGrad.addColorStop(0,   "#202020");
    outerGrad.addColorStop(0.5, "#151515");
    outerGrad.addColorStop(1,   "#0e0e0e");
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner shadow (depth)
    ctx.fillStyle = "rgba(4,4,4,0.92)";
    ctx.beginPath();
    ctx.ellipse(4, 7, rx * 0.62, ry * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle top highlight arc
    ctx.strokeStyle = "rgba(46,46,46,0.48)";
    ctx.lineWidth   = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -4, rx * 0.88, ry * 0.68, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // Edge vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.90);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// ── Pink spike glow around avatar ─────────────────────────────────────────────
function drawAvatarSpikes(ctx, cx, cy, r) {
  // Soft glow halo
  const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r + 28);
  glow.addColorStop(0, "rgba(232,121,249,0.22)");
  glow.addColorStop(1, "rgba(232,121,249,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 28, 0, Math.PI * 2);
  ctx.fill();

  // Spike triangles
  const count   = 12;
  const lengths = [22, 14, 18, 12, 24, 13, 20, 14, 22, 13, 18, 12];
  ctx.save();
  ctx.fillStyle = "#e879f9";
  for (let i = 0; i < count; i++) {
    const angle    = (i / count) * Math.PI * 2 - Math.PI / 2;
    const half     = (Math.PI / count) * 0.28;
    const tipR     = r + 6 + lengths[i % lengths.length];
    const bL = { x: cx + r * Math.cos(angle - half), y: cy + r * Math.sin(angle - half) };
    const bR = { x: cx + r * Math.cos(angle + half), y: cy + r * Math.sin(angle + half) };
    const tp = { x: cx + tipR * Math.cos(angle),     y: cy + tipR * Math.sin(angle) };
    ctx.beginPath();
    ctx.moveTo(bL.x, bL.y);
    ctx.lineTo(tp.x, tp.y);
    ctx.lineTo(bR.x, bR.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ── Text wrap helper ──────────────────────────────────────────────────────────
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "", curY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, curY);
      line = word + " ";
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, curY);
}

// ── Mini leaderboard panel renderer ──────────────────────────────────────────
function drawMiniLBPanel(ctx, px, py, pw, ph, title, entries, colorA, colorB) {
  ctx.save();
  ctx.fillStyle   = "rgba(255,255,255,0.04)";
  ctx.strokeStyle = colorA + "33";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const lGrad = ctx.createLinearGradient(0, py, 0, py + ph);
  lGrad.addColorStop(0, colorA + "cc");
  lGrad.addColorStop(1, colorB + "88");
  ctx.save();
  ctx.fillStyle = lGrad;
  ctx.beginPath();
  ctx.roundRect(px, py, 4, ph, [10, 0, 0, 10]);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.font      = "bold 13px sans-serif";
  ctx.fillStyle = colorA;
  ctx.fillText(title, px + 14, py + 22);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle   = "#ffffff";
  ctx.fillRect(px + 14, py + 28, pw - 28, 1);
  ctx.restore();

  const barTop   = py + 38;
  const barAreaH = ph - 44;
  const n        = Math.min(entries.length, 5);

  if (!n) {
    ctx.save();
    ctx.font      = "12px sans-serif";
    ctx.fillStyle = "rgba(160,160,190,0.50)";
    ctx.fillText("No data yet", px + 14, barTop + 22);
    ctx.restore();
    return;
  }

  const barH     = Math.floor((barAreaH - (n - 1) * 5) / n);
  const labelW   = 88;
  const barAreaW = pw - labelW - 42;
  const maxVal   = entries[0].count || 1;

  for (let i = 0; i < n; i++) {
    const e     = entries[i];
    const by    = barTop + i * (barH + 5);
    const bw    = Math.max(Math.round((e.count / maxVal) * barAreaW), 3);
    const rankC = i === 0 ? "#FFD700cc" : i === 1 ? "#C0C0C0bb" : i === 2 ? "#CD7F32bb" : colorA + "99";

    ctx.save();
    ctx.font      = "bold 10px sans-serif";
    ctx.fillStyle = rankC;
    ctx.fillText(`#${i + 1}`, px + 14, by + barH - 4);
    ctx.restore();

    ctx.save();
    ctx.font      = "11px sans-serif";
    ctx.fillStyle = "rgba(210,210,235,0.90)";
    ctx.fillText((e.name || "Unknown").slice(0, 10), px + 28, by + barH - 4);
    ctx.restore();

    const barX  = px + 14 + labelW;
    const bGrad = ctx.createLinearGradient(barX, 0, barX + bw, 0);
    bGrad.addColorStop(0, colorA + "cc");
    bGrad.addColorStop(1, colorB + "88");
    ctx.save();
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.roundRect(barX, by, bw, barH, 3);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font      = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(e.count.toLocaleString(), barX + bw + 5, by + barH - 4);
    ctx.restore();
  }
}

// ── All-leaderboards overview chart  1100×680 ────────────────────────────────
async function generateAllLeaderboardsChart({ badgesLB = [], afkLB = [], songsLB = [], likedLB = [], cmdsLB = [] }) {
  const W = 1100, H = 680;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#0d0d14";
  ctx.fillRect(0, 0, W, H);

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "rgba(120,60,220,0.08)");
  bgGrad.addColorStop(1, "rgba(60,100,200,0.05)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const topAcc = ctx.createLinearGradient(0, 0, W, 0);
  topAcc.addColorStop(0, "rgba(160,80,255,0.9)");
  topAcc.addColorStop(0.5, "rgba(80,150,255,0.7)");
  topAcc.addColorStop(1, "rgba(80,150,255,0)");
  ctx.fillStyle = topAcc;
  ctx.fillRect(0, 0, W, 4);

  const leftAcc = ctx.createLinearGradient(0, 0, 0, H);
  leftAcc.addColorStop(0, "#b060ff");
  leftAcc.addColorStop(0.5, "#6090ff");
  leftAcc.addColorStop(1, "#b060ff");
  ctx.fillStyle = leftAcc;
  ctx.fillRect(0, 0, 4, H);

  ctx.save();
  ctx.font      = "bold 22px sans-serif";
  ctx.fillStyle = "rgba(160,80,255,0.95)";
  letterSpaced(ctx, "LEADERBOARD OVERVIEW", 28, 42, 1.5);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle   = "#ffffff";
  ctx.fillRect(28, 54, W - 56, 1);
  ctx.restore();

  const PAD = 20, GAP = 10;
  const r1Y = 65,  r1H = 295;
  const r2Y = r1Y + r1H + GAP;
  const r2H = H - r2Y - 20;
  const totalW = W - PAD * 2;
  const pw1    = Math.floor((totalW - GAP * 2) / 3);
  const pw2    = Math.floor((totalW - GAP) / 2);

  const ROW1 = [
    { title: "🏅 Badge Leaderboard", data: badgesLB, colorA: "#FFD700", colorB: "#FFA500" },
    { title: "💤 AFK Leaderboard",   data: afkLB,    colorA: "#5865F2", colorB: "#4752c4" },
    { title: "🎵 Songs Played",      data: songsLB,  colorA: "#57F287", colorB: "#3dba6b" },
  ];
  const ROW2 = [
    { title: "💜 Liked Songs",       data: likedLB,  colorA: "#EC4899", colorB: "#db2777" },
    { title: "⌨️ Commands Used",      data: cmdsLB,   colorA: "#A855F7", colorB: "#7c3aed" },
  ];

  ROW1.forEach((p, i) => drawMiniLBPanel(ctx, PAD + i * (pw1 + GAP), r1Y, pw1, r1H, p.title, p.data, p.colorA, p.colorB));
  ROW2.forEach((p, i) => drawMiniLBPanel(ctx, PAD + i * (pw2 + GAP), r2Y, pw2, r2H, p.title, p.data, p.colorA, p.colorB));

  const botAcc = ctx.createLinearGradient(0, 0, W * 0.7, 0);
  botAcc.addColorStop(0, "rgba(160,80,255,0.65)");
  botAcc.addColorStop(1, "rgba(80,150,255,0)");
  ctx.fillStyle = botAcc;
  ctx.fillRect(0, H - 4, W * 0.7, 4);

  return canvas.toBuffer("image/png");
}

module.exports = { generateNowPlayingCard, generateStatsChart, generateProfileCard, generateAllLeaderboardsChart };
