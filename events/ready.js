const {
  ActivityType,
  REST,
  Routes,
} = require("discord.js");

const { selectSlashCommands } = require("../utils/slashCommands");
const { enabled247 } = require("../utils/State");
const Database = require("../database/Database");
const config = require("../config");

// ══════════════════════════════════════════════════════════════════════════════
// ZEECHEI STREAMING PRESENCE
// ══════════════════════════════════════════════════════════════════════════════

const STREAMING_URL =
  config.streamingUrl ||
  "https://www.twitch.tv/zeecheimusic";

function applyStreamingPresence(client) {
  if (!client.user) return;

  try {
    const shardCount = client.shard?.count ?? 1;
    const guildCount = client.guilds.cache.size;

    const userCount = client.guilds.cache.reduce(
      (total, guild) => total + Number(guild.memberCount || 0),
      0
    );

    client.user.setPresence({
      status: "dnd",

      activities: [
        {
          name: "Zeechei Music",
          type: ActivityType.Streaming,
          url: STREAMING_URL,

          state:
            `${guildCount.toLocaleString()} servers • ` +
            `${userCount.toLocaleString()} users • ` +
            `${shardCount} shard${shardCount !== 1 ? "s" : ""}`,
        },
      ],
    });

    console.log("[Presence] Streaming presence applied.");
  } catch (err) {
    console.error(
      "[Presence] Failed to apply streaming presence:",
      err.message
    );
  }
}

// Keep the Streaming presence alive.
// Discord can occasionally reset presence after reconnects.
function startStreamingPresence(client) {
  applyStreamingPresence(client);

  const interval = setInterval(() => {
    if (!client.isReady()) return;

    applyStreamingPresence(client);
  }, 5 * 60 * 1000);

  // Do not keep Node alive only because of this timer.
  if (typeof interval.unref === "function") {
    interval.unref();
  }

  return interval;
}

// ══════════════════════════════════════════════════════════════════════════════
// 24/7 RECONNECT
// ══════════════════════════════════════════════════════════════════════════════

async function reconnect247Guilds(client) {
  const guilds247 = Database.getAll247GuildData();

  if (!guilds247.length) {
    return;
  }

  console.log(
    `[247] Reconnecting ${guilds247.length} guild(s) with 24/7 mode...`
  );

  for (const {
    guildId,
    voiceChannelId,
    textChannelId,
  } of guilds247) {
    try {
      const guild = client.guilds.cache.get(guildId);

      if (!guild || !voiceChannelId) {
        console.log(
          `[247] Skipping guild ${guildId}`
        );
        continue;
      }

      const voiceChannel =
        guild.channels.cache.get(voiceChannelId);

      if (!voiceChannel) {
        console.log(
          `[247] VC not found in ${guild.name}, skipping.`
        );
        continue;
      }

      enabled247.add(guildId);

      if (client.poru.players.has(guildId)) continue;

      client.poru.createConnection({
        guildId,
        voiceChannel: voiceChannelId,
        textChannel:
          textChannelId || voiceChannelId,

        deaf: true,
        mute: false,
      });


      const textCh = textChannelId
        ? guild.channels.cache.get(textChannelId)
        : null;

      if (textCh) {
        const {
          v2msg,
        } = require("../utils/V2Builder");

        const color = client.getColor(guildId);
        const { rightsort } = client.emoji;

        await textCh
          .send(
            v2msg(
              color,

              `24/7 **Reconnected**\n\n` +
                `${rightsort} I've rejoined <#${voiceChannelId}> after a restart.\n` +
                `-# Use \`+play\` to start music again.`
            )
          )
          .catch(() => {});
      }

      console.log(
        `[247] Reconnected to ${guild.name} → #${voiceChannel.name}`
      );
    } catch (err) {
      console.error(
        `[247] Failed to reconnect guild ${guildId}:`,
        err.message
      );
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DM MAIN OWNER
// ══════════════════════════════════════════════════════════════════════════════

async function dmMainOwner(client, content) {
  try {
    const owner = await client.users
      .fetch(config.mainOwnerId)
      .catch(() => null);

    if (owner) {
      await owner.send(content).catch(() => {});
    }
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════════════════════
// READY
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  name: "clientReady",
  once: true,

  async execute(client) {
    console.log(
      `[Bot] Logged in as ${client.user.tag}`
    );

    console.log(
      `[Bot] Serving ${client.guilds.cache.size} servers`
    );

    // ══════════════════════════════════════════════════════════════════════════
    // PERMANENT STREAMING STATUS
    // ══════════════════════════════════════════════════════════════════════════

    startStreamingPresence(client);

    // ══════════════════════════════════════════════════════════════════════════
    // LAVALINK
    // ══════════════════════════════════════════════════════════════════════════

    // commands/music uses Poru. A second manager consumes the same credential
    // and makes the gateway reject one connection with HTTP 409.
    try {
      const { initPoruMusic } = require("../music/PoruEngine");
      const poru = await initPoruMusic(client);
      if (poru) {
        poru.once("nodeConnect", () => {
          setTimeout(() => {
            void reconnect247Guilds(client).catch(() =>
              console.error("[247] Could not restore saved voice connections.")
            );
          }, 3_000);
        });
      }
    } catch (error) {
      console.error("[LEO Music] Initialization failed:", error?.message || error);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SLASH COMMAND REGISTRATION
    // ══════════════════════════════════════════════════════════════════════════

    try {
      // Reuse the validated command registry instead of executing every file
      // again. Discord allows 100 global chat-input commands.
      const { commands: slashData, omitted } = selectSlashCommands(client.commands);
      if (omitted.length) {
        console.warn(
          `[Slash] ${omitted.length} commands remain prefix-only: ${omitted.join(", ")}`
        );
      }

      const rest = new REST({
        version: "10",
      }).setToken(config.token);

      await rest.put(
        Routes.applicationCommands(
          client.user.id
        ),
        {
          body: slashData,
        }
      );

      console.log(
        `[Slash] Registered ${slashData.length} slash commands globally.`
      );
    } catch (err) {
      console.error(
        "[Slash] Failed:",
        err.message
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // OWNER ONLINE DM
    // ══════════════════════════════════════════════════════════════════════════

    const {
      tick,
      rightsort,
    } = client.emoji;

    await dmMainOwner(
      client.util.v2msg(
        client.getColor(null),

        `${tick} **Zeechei is Online!**\n\n` +
          `${rightsort} **Tag:** ${client.user.tag}\n` +
          `${rightsort} **Servers:** \`${client.guilds.cache.size}\`\n` +
          `${rightsort} **Commands:** \`${client.commands.size}\`\n` +
          `${rightsort} **Presence:** \`Streaming\`\n` +
          `-# Bot is fully operational`
      )
    );
  },
};