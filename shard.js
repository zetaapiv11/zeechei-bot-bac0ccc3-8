const { ShardingManager } = require("discord.js");
const { WebhookClient, EmbedBuilder } = require("discord.js");
const config = require("./config");

// ── Cek konfigurasi wajib (diisi lewat Environment di Render) ────────────────
if (!config.token) {
  console.error("[Zeechei] DISCORD_TOKEN belum diisi. Set di Render → Environment.");
  process.exit(1);
}

const manager = new ShardingManager("./index.js", {
  token: config.token,
  totalShards: "auto",
});

function getWebhook() {
  const url = (config.webhooks?.mainlogs || config.webhooks?.default || "").trim();
  if (!url) return null;
  try { return new WebhookClient({ url }); } catch { return null; }
}

function logShard(title, desc, color = 0x5865F2) {
  const wh = getWebhook();
  if (!wh) return;
  wh.send({
    username: "Zeechei Logs",
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(color)
        .setTimestamp(),
    ],
  }).catch(() => {});
}

manager.on("shardCreate", shard => {
  console.log(`[Shard] ✅ Launched shard ${shard.id}`);
  logShard(`✅ Shard Launched`, `**Shard:** \`${shard.id}\``, 0x57F287);

  shard.on("ready", () => {
    console.log(`[Shard] 🟢 Shard ${shard.id} ready`);
    logShard(`🟢 Shard Ready`, `**Shard:** \`${shard.id}\``, 0x57F287);
  });

  shard.on("disconnect", () => {
    console.log(`[Shard] 🔴 Shard ${shard.id} disconnected`);
    logShard(`🔴 Shard Disconnected`, `**Shard:** \`${shard.id}\``, 0xED4245);
  });

  shard.on("reconnecting", () => {
    console.log(`[Shard] 🔄 Shard ${shard.id} reconnecting`);
    logShard(`🔄 Shard Reconnecting`, `**Shard:** \`${shard.id}\``, 0xFEE75C);
  });

  shard.on("death", () => {
    console.log(`[Shard] 💀 Shard ${shard.id} died`);
    logShard(`💀 Shard Died`, `**Shard:** \`${shard.id}\`\n-# Will attempt to respawn.`, 0xED4245);
  });

  shard.on("error", (err) => {
    console.error(`[Shard] ❌ Shard ${shard.id} error:`, err.message);
    logShard(`❌ Shard Error`, `**Shard:** \`${shard.id}\`\n**Error:** \`${err.message}\``, 0xED4245);
  });
});

manager.spawn();
