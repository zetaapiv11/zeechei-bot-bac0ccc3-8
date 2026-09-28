const {
  ActivityType,
  REST,
  Routes,
} = require("discord.js");

const { createManager } = require("../music/MusicManager");
const { enabled247 } = require("../utils/State");
const Database = require("../database/Database");
const config = require("../config");
const path = require("path");
const fs = require("fs");

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

      const player = client.lavalink.createPlayer({
        guildId,
        voiceChannelId,
        textChannelId:
          textChannelId || voiceChannelId,

        selfDeaf: true,
        selfMute: false,
        volume: 80,
      });

      await player.connect();

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

    if (!config.lavalinkConfigured) {
      console.warn(
        "[Lavalink] LAVALINK_HOST / LAVALINK_PASSWORD belum diisi — fitur musik nonaktif, command lain tetap jalan."
      );
    } else {
      try {
        const manager = createManager(client);

        client.lavalink = manager;

        manager.nodeManager.once(
          "connect",
          () => {
            setTimeout(() => {
              reconnect247Guilds(client);
            }, 3_000);
          }
        );

        await manager.init(client.user.id);

        console.log(
          "[Lavalink] Manager initialized."
        );
      } catch (error) {
        console.error(
          "[Lavalink] Init failed (bot tetap jalan tanpa musik):",
          error?.message || error
        );
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // LEO / ZEECHEI MUSIC ENGINE (Poru)
    // This is additive: Zeechei's existing Lavalink manager remains available
    // to the rest of the bot, while commands/music uses the imported engine.
    // ──────────────────────────────────────────────────────────────────────
    try {
      const { initPoruMusic } = require("../music/PoruEngine");
      await initPoruMusic(client);
    } catch (error) {
      console.error("[LEO Music] Initialization failed:", error?.message || error);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SLASH COMMAND REGISTRATION
    // ══════════════════════════════════════════════════════════════════════════

    try {
      const slashData = [];

      const categoriesPath =
        path.join(__dirname, "../commands");

      for (
        const category of fs
          .readdirSync(categoriesPath)
      ) {
        const categoryPath =
          path.join(
            categoriesPath,
            category
          );

        if (
          !fs
            .statSync(categoryPath)
            .isDirectory()
        ) {
          continue;
        }

        const files =
          fs
            .readdirSync(categoryPath)
            .filter(file =>
              file.endsWith(".js")
            );

        for (const file of files) {
          try {
            const command =
              require(
                path.join(
                  categoryPath,
                  file
                )
              );

            if (
              command.data &&
              typeof command.data.toJSON ===
                "function"
            ) {
              slashData.push(
                command.data.toJSON()
              );
            }
          } catch (err) {
            console.error(
              `[Slash] Failed loading ${category}/${file}:`,
              err.message
            );
          }
        }
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