/**
 * Zeechei — konfigurasi bot.
 *
 * Semua nilai sensitif dibaca dari environment variable
 * (di Render: Dashboard → Service → Environment).
 * JANGAN menulis token / webhook langsung di file ini.
 */

const list = (v) =>
  String(v || "")
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const INVITE = "https://discord.gg/d4RDX4KXc";

// ── Owner ────────────────────────────────────────────────────────────────────
const MAIN_OWNER_ID = String(
  process.env.MAIN_OWNER_ID || process.env.OWNER_ID || "1443804231776862228"
).trim();

// Owner tambahan (opsional): OWNER_IDS=id1,id2
const EXTRA_OWNER_IDS = list(process.env.OWNER_IDS).filter((id) => id !== MAIN_OWNER_ID);

// ── Webhook log ──────────────────────────────────────────────────────────────
// Cukup isi WEBHOOK_URL. Kalau mau dipisah per jenis log, isi WEBHOOK_<JENIS>.
const WEBHOOK_URL = String(
  process.env.WEBHOOK_URL || process.env.WEBHOOK_DEFAULT || process.env.LOG_WEBHOOK || ""
).trim();

const wh = (name) => String(process.env[name] || "").trim() || WEBHOOK_URL;

module.exports = {
  // Token bot → env: DISCORD_TOKEN (atau TOKEN)
  token: String(process.env.DISCORD_TOKEN || process.env.TOKEN || "").trim(),
  prefix: process.env.PREFIX || process.env.BOT_PREFIX || ",,",

  // Main owner — hanya ID ini yang bisa +addowner / +removeowner
  mainOwnerId: MAIN_OWNER_ID,
  ownerId: MAIN_OWNER_ID,
  ownerIds: EXTRA_OWNER_IDS,

  embedColor: 0x2f3136,
  supportServer: process.env.SUPPORT_SERVER || INVITE,
  website: process.env.WEBSITE_URL || INVITE,
  voteUrl: process.env.VOTE_URL || INVITE,

  // URL gambar banner (opsional, harus link gambar publik). Kosong = tanpa banner.
  bannerUrl: process.env.BANNER_URL || "",

  // ── Webhook Logging ────────────────────────────────────────────────────────
  webhooks: {
    default: WEBHOOK_URL,
    commands: wh("WEBHOOK_COMMANDS"), // log pemakaian command
    music: wh("WEBHOOK_MUSIC"), // event musik
    errors: wh("WEBHOOK_ERRORS"), // error & exception
    joins: wh("WEBHOOK_JOINS"), // bot join / leave server
    owners: wh("WEBHOOK_OWNERS"), // aksi owner (blacklist, addowner…)
    mainlogs: wh("WEBHOOK_MAINLOGS"), // log utama (shard, event penting)
  },

  lavalink: {
    // host boleh: hostname biasa, http(s):// atau ws(s)://
    // LAVALINK_SECURE: true | false | auto
    host: process.env.LAVALINK_HOST || "",
    port: Number(process.env.LAVALINK_PORT) || 2333,
    password: process.env.LAVALINK_PASSWORD || "",
    secureMode: process.env.LAVALINK_SECURE || "auto",
  },
};

// true kalau Lavalink diisi (host + password, atau LAVALINK_NODES). Kalau false,
// bot tetap online dan slash command tetap terdaftar; hanya command musik yang nonaktif.
module.exports.lavalinkConfigured = Boolean(
  String(process.env.LAVALINK_NODES || "").trim() ||
  (module.exports.lavalink.host && module.exports.lavalink.password)
);
