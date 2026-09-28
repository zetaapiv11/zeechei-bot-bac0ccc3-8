const { Poru } = require("poru");
const config = require("../config");
const setupMusicEvents = require("./leoEvents").setupMusicEvents;
const setupApplicationEmojis = require("../utils/setupApplicationEmojis");
const { getLavalinkNodes } = require("../utils/lavalinkConfig");

let initialized = false;

async function initPoruMusic(client) {
  if (initialized && client.poru) return client.poru;

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

  const poru = new Poru(client, nodes, {
    library: "discord.js",
    defaultPlatform: "ytsearch",
    resumeKey: "ZeecheiLEOMusic",
    resumeTimeout: 60,
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
  await setupApplicationEmojis(client);

  poru.init(client.user.id);
  initialized = true;

  console.log("[LEO Music] Poru music engine initialized.");
  return poru;
}

module.exports = { initPoruMusic };
