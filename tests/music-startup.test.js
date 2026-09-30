const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter, once } = require("node:events");
const http = require("node:http");
const { WebSocketServer } = require("ws");
const { Poru } = require("poru");
const { selectSlashCommands } = require("../utils/slashCommands");

function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    module, exports: module.exports, console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error("Unexpected dependency: " + name);
    },
    setTimeout, clearTimeout, ...globals,
  }, { filename: file });
  return module.exports;
}

test("ready starts only Poru and registers the existing music commands", async () => {
  let starts = 0, submitted;
  const poru = new EventEmitter();
  const ready = load("events/ready.js", {
    "discord.js": {
      ActivityType: { Streaming: 1 },
      REST: class { setToken() { return this; } async put(route, { body }) { submitted = body; } },
      Routes: { applicationCommands: id => id },
    },
    "../utils/slashCommands": { selectSlashCommands },
    "../utils/State": { enabled247: new Set() },
    "../database/Database": { getAll247GuildData: () => [] },
    "../config": {},
    "../music/PoruEngine": { async initPoruMusic() { starts++; return poru; } },
  }, { setInterval: () => ({ unref() {} }) });
  await ready.execute({
    user: { id: "123456789012345678", tag: "fixture", setPresence() {} },
    guilds: { cache: { size: 0, reduce: () => 0 } },
    commands: new Map([["play", { name: "play", __zeecheiPoruMusic: true, data: { toJSON: () => ({ name: "play", type: 1 }) } }]]),
    emoji: {}, getColor() { return 0; }, util: { v2msg() { return ""; } },
  });
  assert.equal(starts, 1);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].name, "play");
});

test("emoji registration ignores nested BTN/TXT exports", async () => {
  let fetched = 0;
  const setup = load("utils/setupApplicationEmojis.js", {
    "./emojis": { BTN: { play: "▶" }, TXT: {}, plain: "▶", custom: "<:example:123456789012345678>" },
  });
  const existing = [{ name: "ax_custom", id: "123456789012345678" }];
  await setup({ application: { emojis: {
    async fetch() { fetched++; return existing; },
    async create() { assert.fail("Existing custom emoji should be reused"); },
  } } });
  assert.equal(fetched, 2);
});

test("actual Poru opens one socket, sends v4 voice/play/control payloads, and reconnects", { timeout: 10000 }, async t => {
  const botId = "123456789012345678", guildId = "223456789012345678", voiceId = "323456789012345678";
  const password = "synthetic-local-test-credential";
  const requests = [], headers = [], discordPackets = [];
  const track = { encoded: "synthetic-encoded-track", info: {
    identifier: "fixture", title: "Fixture", author: "Test", length: 60000,
    isSeekable: true, isStream: false, position: 0, sourceName: "soundcloud",
    uri: "https://example.invalid/fixture",
  } };
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
    requests.push({ url: req.url, method: req.method, body, authorized: req.headers.authorization === password });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(req.url.startsWith("/v4/loadtracks") ? { loadType: "search", data: [track] } : {}));
  });
  const wss = new WebSocketServer({ server, path: "/v4/websocket" });
  let sockets = 0;
  wss.on("connection", (ws, req) => {
    headers.push(req.headers);
    sockets++;
    ws.send(JSON.stringify({ op: "ready", resumed: false, sessionId: "fixture-" + sockets }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let poru;
  t.after(async () => {
    for (const node of poru?.nodes.values() || []) {
      clearTimeout(node.reconnectAttempt);
      node.ws?.removeAllListeners();
      node.ws?.terminate();
    }
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const config = { lavalink: { host: "127.0.0.1", port: server.address().port, password, secureMode: "false" } };
  const client = new EventEmitter();
  client.user = { id: botId };
  client.guilds = { cache: new Map([[guildId, { shard: { send: packet => discordPackets.push(packet) } }]]) };
  const never = new Promise(() => {});
  const { initPoruMusic } = load("music/PoruEngine.js", {
    poru: { Poru }, "../config": config,
    "./leoEvents": { setupMusicEvents() {} },
    "./database/models": {},
    "../utils/setupApplicationEmojis": () => never,
    "../utils/lavalinkConfig": require("../utils/lavalinkConfig"),
  });
  const [a, b] = await Promise.all([initPoruMusic(client), initPoruMusic(client)]);
  poru = a;
  assert.equal(a, b, "concurrent startup reuses one engine");
  await once(poru, "raw");
  // Poru emits raw immediately before it stores the session.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sockets, 1);
  assert.equal(client.listenerCount("raw"), 1);
  assert.equal(headers[0]["user-id"], botId);
  assert.equal(headers[0].authorization, password);
  assert.equal(headers[0]["resume-key"], undefined);
  assert.equal(requests.length, 0, "no obsolete resumingKey PATCH");
  const result = await poru.resolve({ query: "fixture", source: "scsearch" });
  assert.equal(result.tracks.length, 1);
  const player = poru.createConnection({ guildId, voiceChannel: voiceId, textChannel: voiceId, deaf: true });
  assert.equal(discordPackets[0].d.channel_id, voiceId);
  await poru.packetUpdate({ t: "VOICE_STATE_UPDATE", d: { guild_id: guildId, user_id: botId, session_id: "fixture-voice-session", channel_id: voiceId } });
  await poru.packetUpdate({ t: "VOICE_SERVER_UPDATE", d: { guild_id: guildId, token: "synthetic-voice-token", endpoint: "fixture.discord.media" } });
  player.queue.add(result.tracks[0]);
  await player.play();
  await player.pause(true);
  await player.pause(false);
  await player.setVolume(50);
  const bodies = requests.filter(r => r.method === "PATCH").map(r => r.body);
  assert.ok(bodies.some(b => b.voice?.channelId === voiceId && b.voice.sessionId === "fixture-voice-session"));
  assert.ok(bodies.some(b => b.track?.encoded === track.encoded));
  assert.ok(bodies.some(b => b.paused === true));
  assert.ok(bodies.some(b => b.paused === false));
  assert.ok(bodies.some(b => b.volume === 50));
  assert.ok(requests.every(r => r.authorized));
  assert.ok(requests.filter(r => r.method === "PATCH").every(r => r.url.startsWith("/v4/sessions/fixture-1/players/")));
  await player.destroy();
  assert.ok(requests.some(r => r.method === "DELETE"));
  const node = [...poru.nodes.values()][0];
  node.reconnectTimeout = 20;
  const reconnect = once(poru, "raw");
  for (const ws of wss.clients) ws.close(1012, "synthetic restart");
  await reconnect;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sockets, 2, "one new connection after server restart");
  assert.equal([...poru.nodes.values()][0].sessionId, "fixture-2");
  assert.equal(await initPoruMusic(client), poru);
  assert.equal(sockets, 2, "repeat init does not open another connection");
});
