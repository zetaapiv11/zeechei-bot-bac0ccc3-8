const { WebhookClient, EmbedBuilder } = require("discord.js");
const Emojis = require("../constants/Emojis");
const config = require("../config");

const SPAM_MAX_CMDS = 10;

const _clients = new Map();

function getClient(url) {
  if (!url || !url.trim()) return null;
  if (_clients.has(url)) return _clients.get(url);
  try {
    const wh = new WebhookClient({ url });
    _clients.set(url, wh);
    return wh;
  } catch { return null; }
}

function resolve(type) {
  const cfg = config.webhooks || {};
  return getClient(cfg[type]) || getClient(cfg.default) || null;
}

async function send(type, title, description, color = config.embedColor) {
  const wh = resolve(type);
  if (!wh) return;
  try {
    await wh.send({
      username: "Zeechei Logs",
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color)
          .setTimestamp(),
      ],
    });
  } catch (e) {
    console.error(`[WebhookLogger/${type}] Failed:`, e.message);
  }
}

async function sendMulti(types, title, description, color = config.embedColor) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  const seen = new Set();
  const promises = [];

  for (const type of types) {
    const cfg = config.webhooks || {};
    const url = cfg[type] || cfg.default || "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const wh = getClient(url);
    if (!wh) continue;
    promises.push(
      wh.send({ username: "Zeechei Logs", embeds: [embed] })
        .catch(e => console.error(`[WebhookLogger/${type}] Failed:`, e.message))
    );
  }

  await Promise.allSettled(promises);
}

const WebhookLogger = {
  // ── Server events ──────────────────────────────────────────────────────────
  guildJoin: (name, id, members) =>
    send("joins", `${Emojis.JOIN} Joined Server`,
      `**Server:** ${name}\n**ID:** \`${id}\`\n**Members:** ${members}`, 0x57F287),

  guildLeave: (name, id) =>
    send("joins", `${Emojis.LEAVE} Left Server`,
      `**Server:** ${name}\n**ID:** \`${id}\``, 0xED4245),

  // ── Music events ───────────────────────────────────────────────────────────
  musicPlay: (user, guild, track) =>
    send("music", `${Emojis.NOW_PLAYING} Music Played`,
      `**User:** ${user}\n**Server:** ${guild}\n**Track:** ${track}`, 0x5865F2),

  musicStop: (user, guild) =>
    send("music", `${Emojis.STOP} Music Stopped`,
      `**User:** ${user}\n**Server:** ${guild}`, 0xFEE75C),

  autoplay: (guild, track) =>
    send("music", `🔛 Autoplay Triggered`,
      `**Server:** ${guild}\n**Next Track:** ${track}`, 0x9B59B6),

  radioStart: (user, guild, seed, station, trackCount) =>
    send("music", `📻 Radio Started`,
      `**User:** ${user}\n**Server:** ${guild}\n**Seed:** ${seed}\n**Station:** ${station}\n**Tracks Queued:** \`${trackCount}\``, 0xE91E63),

  filterApply: (user, guild, filterName) =>
    send("music", `🎛️ Filter Applied`,
      `**User:** ${user}\n**Server:** ${guild}\n**Filter:** \`${filterName}\``, 0x9B59B6),

  trackSaved: (user, guild, track) =>
    send("music", `💾 Track Saved to DM`,
      `**User:** ${user}\n**Server:** ${guild}\n**Track:** ${track}`, 0x57F287),

  trackSeeked: (user, guild, track, position) =>
    send("music", `⏩ Track Seeked`,
      `**User:** ${user}\n**Server:** ${guild}\n**Track:** ${track}\n**Seeked To:** \`${position}\``, 0x5865F2),

  trackRewound: (user, guild, track, seconds) =>
    send("music", `⏪ Track Rewound`,
      `**User:** ${user}\n**Server:** ${guild}\n**Track:** ${track}\n**Rewound:** \`${seconds}s\``, 0x5865F2),

  trackRemoved: (user, guild, track, position) =>
    send("music", `🗑️ Track Removed`,
      `**User:** ${user}\n**Server:** ${guild}\n**Track:** ${track}\n**Was at Position:** \`#${position}\``, 0xFEE75C),

  // ── Command events ─────────────────────────────────────────────────────────
  commandUsed: (user, guild, cmd) =>
    send("commands", `${Emojis.LOG} Command Used`,
      `**User:** ${user}\n**Server:** ${guild}\n**Command:** \`${cmd}\``, 0x5865F2),

  botPinged: (user, guild) =>
    send("mainlogs", `🏓 Bot Pinged`,
      `**User:** ${user}\n**Server:** ${guild}`, 0x5865F2),

  // ── Owner / moderation events ──────────────────────────────────────────────
  blacklist: (user, by, added) =>
    send("owners", `${Emojis.BLACKLIST} ${added ? "Blacklisted" : "Unblacklisted"}`,
      `**User:** ${user}\n**By:** ${by}`, added ? 0xED4245 : 0x57F287),

  autoBlacklist: (userTag, userId, guildName, cmdCount, windowSec, expiresAt) => {
    const expireTs  = Math.floor(expiresAt / 1000);
    const expireStr = `<t:${expireTs}:R> (<t:${expireTs}:f>)`;
    const description =
      `**User:** ${userTag} (\`${userId}\`)\n` +
      `**Server:** ${guildName}\n` +
      `**Commands in ${windowSec}s:** \`${cmdCount}\`\n` +
      `**Threshold:** >${SPAM_MAX_CMDS} commands per minute\n` +
      `**Expires:** ${expireStr}`;
    return sendMulti(["mainlogs", "owners"], `${Emojis.BLACKLIST} Auto-Blacklisted (Spam)`, description, 0xED4245);
  },

  noprefix: (user, by, added) =>
    send("owners", `${Emojis.NOPREFIX} NoPrefix ${added ? "Added" : "Removed"}`,
      `**User:** ${user}\n**By:** ${by}`, 0x5865F2),

  premium: (entity, by, added) =>
    send("owners", `${Emojis.PREMIUM} Premium ${added ? "Added" : "Removed"}`,
      `**Entity:** ${entity}\n**By:** ${by}`, 0xF1C40F),

  ownerAdded: (user, by) =>
    send("owners", `👑 Owner Added`,
      `**User:** ${user}\n**By:** ${by}`, 0x57F287),

  ownerRemoved: (user, by) =>
    send("owners", `👑 Owner Removed`,
      `**User:** ${user}\n**By:** ${by}`, 0xED4245),

  badgeGiven: (badge, badgeLabel, toUser, byUser) =>
    send("owners", `🏅 Badge Given`,
      `**Badge:** ${badge} ${badgeLabel}\n**To:** ${toUser}\n**By:** ${byUser}`, 0x57F287),

  badgeRemoved: (badge, badgeLabel, fromUser, byUser) =>
    send("owners", `🏅 Badge Removed`,
      `**Badge:** ${badge} ${badgeLabel}\n**From:** ${fromUser}\n**By:** ${byUser}`, 0xED4245),

  badgeCreated: (key, emoji, label, byUser) =>
    send("owners", `🏅 Custom Badge Created`,
      `**Key:** \`${key}\`\n**Emoji:** ${emoji}\n**Label:** ${label}\n**By:** ${byUser}`, 0x5865F2),

  badgeDeleted: (key, byUser) =>
    send("owners", `🏅 Custom Badge Deleted`,
      `**Key:** \`${key}\`\n**By:** ${byUser}`, 0xED4245),

  rateLimit: (user, guild, cmd) =>
    send("mainlogs", `⏱️ Rate Limited`,
      `**User:** ${user}\n**Server:** ${guild}\n**Command:** \`${cmd}\``, 0xFEE75C),

  afkSet: (user, guild, reason, type) =>
    send("mainlogs", `💤 AFK Set`,
      `**User:** ${user}\n**Server:** ${guild}\n**Reason:** ${reason}\n**Type:** ${type}`, 0x5865F2),

  afkRemoved: (user, guild, pings) =>
    send("mainlogs", `💤 AFK Removed`,
      `**User:** ${user}\n**Server:** ${guild}\n**Pings while AFK:** ${pings}`, 0x57F287),

  error: (context, errMsg) =>
    send("errors", `❌ Error`,
      `**Context:** ${context}\n**Error:** \`${errMsg}\``, 0xED4245),

  report: (user, userId, category, text) =>
    send("default", `${Emojis.REPORT} New Report`,
      `**From:** ${user} (\`${userId}\`)\n**Category:** ${category}\n**Report:** ${text}`, 0xE67E22),

  // ── Shard events ────────────────────────────────────────────────────────────
  shardReady: (shardId, guilds) =>
    send("mainlogs", `🟢 Shard Ready`,
      `**Shard:** \`${shardId}\`\n**Guilds on shard:** \`${guilds}\``, 0x57F287),

  shardDisconnect: (shardId, code) =>
    send("mainlogs", `🔴 Shard Disconnected`,
      `**Shard:** \`${shardId}\`\n**Close Code:** \`${code ?? "unknown"}\``, 0xED4245),

  shardReconnecting: (shardId) =>
    send("mainlogs", `🔄 Shard Reconnecting`,
      `**Shard:** \`${shardId}\``, 0xFEE75C),

  shardError: (shardId, errMsg) =>
    send("errors", `❌ Shard Error`,
      `**Shard:** \`${shardId}\`\n**Error:** \`${errMsg}\``, 0xED4245),
};

module.exports = WebhookLogger;
