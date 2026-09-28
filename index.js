// ── Mobile status patch (must be before Client creation) ──────────────────────
try {
  const { DefaultWebSocketManagerOptions } = require("@discordjs/ws");
  if (DefaultWebSocketManagerOptions?.identifyProperties) {
    DefaultWebSocketManagerOptions.identifyProperties.browser = "Discord iOS";
    DefaultWebSocketManagerOptions.identifyProperties.device  = "Discord iOS";
    DefaultWebSocketManagerOptions.identifyProperties.os      = "iOS";
    console.log("[Mobile] ✅ Identify properties patched → Discord iOS");
  }
} catch (e) {
  console.log("[Mobile] ⚠️ Patch failed:", e.message);
}

const {
  Client, GatewayIntentBits, Partials, Collection, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Options,
} = require("discord.js");
const { V2Builder, v2msg, v2eph, v2section } = require("./utils/V2Builder");
const fs     = require("fs");
const path   = require("path");
const config = require("./config");
const { loadCommands } = require("./handlers/CommandHandler");
const Database = require("./database/Database");

// ── Client ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
  // Mobile presence — shows phone icon in member list
  ws: { properties: { browser: "Discord iOS", device: "Discord iOS", os: "iOS" } },
  // Cache limiting — reduces memory usage for large server counts
  makeCache: Options.cacheWithLimits({
    ...Options.defaultMakeCacheSettings,
    MessageManager: 50,
    UserManager: 200,
    GuildMemberManager: 200,
  }),
  sweepers: {
    ...Options.defaultSweeperSettings,
    messages: { interval: 300, lifetime: 1800 },
    users: { interval: 300, filter: () => user => !user.bot },
  },
});

// ── Emoji constants (sourced from utils/emojis.js) ────────────────────────────
const _allEmojis = require("./utils/emojis");
const { TXT: _emojiTXT } = _allEmojis;
client.emoji = { ..._emojiTXT, ..._allEmojis };

// ── Lily-style embed factory + Components V2 helpers ─────────────────────────
client.util = {
  embed: () => new EmbedBuilder(),
  v2:    (color) => new V2Builder(color),
  v2msg: (color, content) => v2msg(color, content),
  v2eph: (color, content) => v2eph(color, content),
};

// ── Per-guild embed color ─────────────────────────────────────────────────────
client.guildColors = new Map();
client.getColor = (guildId) => {
  if (!guildId) return config.embedColor;
  const stored = client.guildColors.get(guildId);
  if (stored === "random") return Math.floor(Math.random() * 0xFFFFFF);
  if (stored !== undefined && stored !== null) return Number(stored);
  return config.embedColor;
};

// Load saved guild colors
try {
  const allColors = Database.getAllEmbedColors();
  for (const [guildId, color] of Object.entries(allColors)) {
    client.guildColors.set(guildId, color);
  }
} catch (_) {}

// ── Commands ─────────────────────────────────────────────────────────────────
loadCommands(client);

// ── Events ───────────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"))) {
  const event = require(path.join(eventsPath, file));
  const handler = (...args) => event.execute(client, ...args);
  if (event.once) client.once(event.name, handler);
  else            client.on(event.name, handler);
}

// ── Shard events ─────────────────────────────────────────────────────────────
const WebhookLogger = require("./logger/WebhookLogger");
client.on("shardReady",        (shardId)        => WebhookLogger.shardReady(shardId, client.guilds.cache.size).catch(() => {}));
client.on("shardDisconnect",   (event, shardId) => WebhookLogger.shardDisconnect(shardId, event?.code).catch(() => {}));
client.on("shardReconnecting", (shardId)        => WebhookLogger.shardReconnecting(shardId).catch(() => {}));
client.on("shardError",        (error, shardId) => WebhookLogger.shardError(shardId, error?.message).catch(() => {}));

// ── Error handling ───────────────────────────────────────────────────────────
client.on("error",   err => console.error("[Client Error]", err));
client.on("warn",    msg => console.warn("[Client Warn]", msg));
process.on("unhandledRejection", err => console.error("[Unhandled Rejection]", err));

// ── Graceful shutdown — DM main owner ────────────────────────────────────────
async function handleShutdown(signal) {
  console.log(`[Shutdown] Received ${signal}, shutting down...`);
  try {
    const owner = await client.users.fetch(config.mainOwnerId).catch(() => null);
    if (owner && client.isReady()) {
      const { cross, rightsort } = client.emoji;
      await owner.send(
        client.util.v2msg(0xED4245,
          `${cross} **Zeechei is Going Offline**\n\n`
          + `${rightsort} **Signal:** \`${signal}\`\n`
          + `${rightsort} **Servers:** \`${client.guilds.cache.size}\`\n`
          + `-# The bot is shutting down — restart it to bring it back online`,
        ),
      ).catch(() => {});
    }
  } catch (_) {}
  process.exit(0);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT",  () => handleShutdown("SIGINT"));

// ── Keep-alive HTTP server (Render Web Service needs an open port) ───────────────────────
const http = require("http");
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", bot: client.user?.tag || "starting" }));
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`[HTTP] Port ${PORT} in use, retrying in 3s...`);
    setTimeout(() => server.listen(PORT), 3000);
  } else {
    console.error("[HTTP] Server error:", err.message);
  }
});
server.listen(PORT, () => console.log(`[HTTP] Keep-alive server on port ${PORT}`));

// ── Login ────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════╗");
console.log("║      ZEECHEI BOT — STARTING        ║");
console.log("╚══════════════════════════════════╝");

client.login(config.token).catch(err => {
  console.error("[Login Failed]", err.message);
  process.exit(1);
});
