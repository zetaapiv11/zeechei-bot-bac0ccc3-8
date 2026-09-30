const { Poru } = require("poru");
const config = require("../config");
const setupMusicEvents = require("./leoEvents").setupMusicEvents;
const setupApplicationEmojis = require("../utils/setupApplicationEmojis");
const { getLavalinkNodes } = require("../utils/lavalinkConfig");

const initializing = new WeakMap();

function initPoruMusic(client) {
  if (initializing.has(client)) return initializing.get(client);
  if (client.poru) return Promise.resolve(client.poru);
  const pending = startPoruMusic(client);
  initializing.set(client, pending);
  void pending.finally(() => initializing.delete(client)).catch(() => {});
  return pending;
}

async function startPoruMusic(client) {

  // Isolated DB for LEO/Zeechei music features. Zeechei's existing database is untouched.
  require("./database/models");

  const nodes = getLavalinkNodes(config).map((node, index) => ({
    name: node.id || `Zeechei-LEO-${index + 1}`,
    host: node.host,
    port: node.port,
    password: node.password,
    secure: node.secure,
  }));

  if (!nodes.length || nodes.some(node => !node.host || !node.password)) {
    console.warn("[LEO Music] Lavalink host/password is missing; Poru music will not start.");
    return null;
  }

  console.log(
    "[LEO Music] Lavalink nodes:",
    nodes.map(n => `${n.secure ? "wss" : "ws"}://${n.host}:${n.port}`).join(", ")
  );

  const poru = new Poru(client, nodes, {
    library: "discord.js",
    defaultPlatform: "ytsearch",
    restVersion: "v4",
    // Poru 5 sends the obsolete resumingKey payload when resumeKey is set.
    // Reconnect opens a fresh Lavalink v4 session; active playback is not resumed.
    autoResume: false,
    reconnectTimeout: 10000,
    reconnectTries: 5,
  });

  client.poru = poru;

  poru.on("nodeConnect", node =>
    console.log(`[LEO Music] Lavalink connected: ${node.name}`)
  );
  poru.on("nodeReconnect", node =>
    console.log(`[LEO Music] Lavalink reconnecting: ${node.name}`)
  );
  poru.on("nodeDisconnect", node =>
    console.warn(`[LEO Music] Lavalink disconnected: ${node.name}`)
  );
  poru.on("nodeError", (node, error) =>
    console.error(`[LEO Music] Lavalink error (${node.name}):`, error?.message || error)
  );

  setupMusicEvents(client);

  // Register the LEO emoji set as application emojis when Discord allows it.
  // The static emoji strings remain as a fallback if registration is unavailable.
  await poru.init();
  // Emoji registration must not delay the audio WebSocket.
  void setupApplicationEmojis(client).catch(() =>
    console.warn("[AppEmoji] Registration unavailable; using existing emojis.")
  );

  console.log("[LEO Music] Poru music engine initialized.");
  return poru;
}

module.exports = { initPoruMusic };
