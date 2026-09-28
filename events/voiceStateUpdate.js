const {
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");
const { enabled247 } = require("../utils/State");
const Database = require("../database/Database");
const VoiceMaster = require("../utils/VoiceMaster");

// ============================================================
// RECONNECT DELAY MAP
// ============================================================

const reconnectTimers = new Map();

// ============================================================
// HELPERS
// ============================================================

function truncate(text, max = 85) {
  const value = String(text ?? "");

  if (value.length <= max) {
    return value;
  }

  return value.slice(0, max - 3) + "...";
}

function getColor(client, guildId, fallback = "#ff0000") {
  try {
    if (typeof client?.getColor === "function") {
      const color = client.getColor(guildId);

      if (color) {
        // Canvas accepts numbers and strings, but convert numeric
        // Discord colors into a CSS-compatible hex string.
        if (typeof color === "number") {
          return `#${color.toString(16).padStart(6, "0")}`;
        }

        return color;
      }
    }
  } catch {}

  return fallback;
}

// ============================================================
// ZEECHEI BANNER
// Same visual response style used by at.js
// ============================================================

function createBanner({
  title,
  subtitle = "",
  lines = [],
  color = "#ff0000",
  width = 1100,
  height = 500,
}) {
  const safeHeight = Math.max(
    300,
    Math.min(1200, Number(height) || 500)
  );

  const canvas = createCanvas(width, safeHeight);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#070707";
  ctx.fillRect(0, 0, width, safeHeight);

  // Main panel
  ctx.fillStyle = "#101010";
  ctx.fillRect(
    24,
    24,
    width - 48,
    safeHeight - 48
  );

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.strokeRect(
    24,
    24,
    width - 48,
    safeHeight - 48
  );

  // Top accent
  ctx.fillStyle = color;
  ctx.fillRect(
    24,
    24,
    width - 48,
    7
  );

  // Title
  ctx.font = "bold 38px Arial";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    truncate(title, 45),
    60,
    88
  );

  // Subtitle
  if (subtitle) {
    ctx.font = "21px Arial";
    ctx.fillStyle = "#999999";

    ctx.fillText(
      truncate(subtitle, 85),
      60,
      124
    );
  }

  let y = 178;

  for (const line of lines) {
    if (y > safeHeight - 85) {
      break;
    }

    // Simple string line
    if (typeof line === "string") {
      if (!line.trim()) {
        y += 20;
        continue;
      }

      ctx.font = "bold 22px Arial";
      ctx.fillStyle = "#ffffff";

      ctx.fillText(
        truncate(line, 80),
        60,
        y
      );

      y += 39;
      continue;
    }

    // Label / value line
    const label = truncate(
      line?.label || "",
      28
    );

    const value = truncate(
      line?.value || "",
      65
    );

    ctx.font = "bold 20px Arial";
    ctx.fillStyle = color;

    ctx.fillText(
      label,
      60,
      y
    );

    ctx.font = "20px Arial";
    ctx.fillStyle = "#dddddd";

    ctx.fillText(
      value,
      350,
      y
    );

    y += 39;
  }

  // Footer
  ctx.font = "17px Arial";
  ctx.fillStyle = "#555555";

  ctx.fillText(
    "Zeechei Music System",
    60,
    safeHeight - 55
  );

  return canvas.toBuffer("image/png");
}

// ============================================================
// COMPONENTS V2 BANNER PAYLOAD
// ============================================================

function bannerResponse(
  client,
  guildId,
  {
    title,
    subtitle = "",
    lines = [],
    height = 500,
  }
) {
  const color = getColor(
    client,
    guildId
  );

  const buffer = createBanner({
    title,
    subtitle,
    lines,
    color,
    height,
  });

  const attachment = new AttachmentBuilder(
    buffer,
    {
      name: "voice-state-response.png",
    }
  );

  const components = [
    {
      type: 10,
      content: `-# ${truncate(title || "Zeechei", 80)}`,
    },

    {
      type: 14,
      divider: true,
      spacing: 1,
    },

    {
      type: 10,
      content: "-# Zeechei Music System",
    },
  ];

  // Media Gallery
  components.splice(
    1,
    0,
    {
      type: 12,
      items: [
        {
          media: {
            url: "attachment://voice-state-response.png",
          },
        },
      ],
    }
  );

  return {
    components,
    files: [attachment],
    flags: MessageFlags.IsComponentsV2,
  };
}

// ============================================================
// SEND BANNER
// ============================================================

async function sendBanner(
  client,
  textChannel,
  guildId,
  data
) {
  if (!textChannel) {
    return;
  }

  try {
    await textChannel.send(
      bannerResponse(
        client,
        guildId,
        data
      )
    );
  } catch (error) {
    console.error(
      `[VOICE STATE] Banner response failed:`,
      error?.message || error
    );
  }
}

// ============================================================
// 247 REJOIN
// ============================================================

async function attempt247Rejoin(client, guildId) {
  // Already waiting for reconnect
  if (reconnectTimers.has(guildId)) {
    return;
  }

  const timer = setTimeout(async () => {
    reconnectTimers.delete(guildId);

    // 247 was disabled while timer was waiting
    if (!enabled247.has(guildId)) {
      return;
    }

    const {
      voiceChannelId,
      textChannelId,
    } = Database.get247ChannelIds(guildId);

    if (!voiceChannelId) {
      return;
    }

    try {
      const guild =
        client.guilds.cache.get(guildId);

      if (!guild) {
        return;
      }

      const voiceChannel =
        guild.channels.cache.get(
          voiceChannelId
        );

      if (!voiceChannel) {
        return;
      }

      const textChannel =
        textChannelId
          ? guild.channels.cache.get(
              textChannelId
            )
          : null;

      let player =
        client.lavalink?.getPlayer(
          guildId
        );

      // Create player if it no longer exists
      if (!player) {
        player =
          client.lavalink?.createPlayer({
            guildId,
            voiceChannelId,
            textChannelId:
              textChannelId ||
              voiceChannelId,
            selfDeaf: true,
            selfMute: false,
            volume: 80,
          });
      }

      if (!player) {
        throw new Error(
          "Lavalink player could not be created."
        );
      }

      await player.connect();

      console.log(
        `[247] Rejoined VC in ${guild.name} after disconnect.`
      );

      await sendBanner(
        client,
        textChannel,
        guildId,
        {
          title:
            "247 RECONNECTED",

          subtitle:
            "24/7 mode is keeping Zeechei connected",

          lines: [
            {
              label: "Status",
              value: "Rejoined successfully",
            },

            {
              label: "Channel",
              value: `#${voiceChannel.name}`,
            },

            {
              label: "Mode",
              value: "24/7 Enabled",
            },

            {
              label: "Action",
              value: "Zeechei has rejoined the voice channel",
            },
          ],

          height: 450,
        }
      );
    } catch (err) {
      console.error(
        `[247] Rejoin failed for guild ${guildId}:`,
        err?.message || err
      );
    }
  }, 3000);

  reconnectTimers.set(
    guildId,
    timer
  );
}

// ============================================================
// EVENT
// ============================================================

module.exports = {
  name: "voiceStateUpdate",
  once: false,

  async execute(
    client,
    oldState,
    newState
  ) {
    const guildId =
      oldState.guild?.id ||
      newState.guild?.id;

    if (!guildId) {
      return;
    }

    // ========================================================
    // BOT VOICE STATE
    // ========================================================

    if (
      oldState.member?.user?.id ===
      client.user.id
    ) {
      const wasDisconnected =
        !!oldState.channelId &&
        !newState.channelId;

      const wasMoved =
        !!oldState.channelId &&
        !!newState.channelId &&
        oldState.channelId !==
          newState.channelId;

      // ------------------------------------------------------
      // BOT DISCONNECTED
      // ------------------------------------------------------

      if (
        wasDisconnected &&
        enabled247.has(guildId)
      ) {
        console.log(
          `[247] Bot disconnected from VC in guild ${guildId}, attempting rejoin...`
        );

        await attempt247Rejoin(
          client,
          guildId
        );
      }

      // ------------------------------------------------------
      // BOT MOVED
      // ------------------------------------------------------

      if (
        wasMoved &&
        enabled247.has(guildId)
      ) {
        const player =
          client.lavalink?.getPlayer(
            guildId
          );

        if (player) {
          Database.set247(
            guildId,
            true,
            newState.channelId,
            player.textChannelId
          );
        }
      }

      return;
    }

    // ========================================================
    // HUMAN VOICE STATE
    // ========================================================

    // ========================================================
    // ZEECHEI VOICEMASTER / JOIN-TO-CREATE
    // ========================================================
    // Handle this before Lavalink so VoiceMaster also works when
    // Zeechei is not playing music in the guild.
    try {
      await VoiceMaster.handleVoiceState(oldState, newState);
    } catch (error) {
      console.error("[VoiceMaster voiceStateUpdate]", error?.message || error);
    }

    const player =
      client.lavalink?.getPlayer(
        guildId
      );

    if (!player?.voiceChannelId) {
      return;
    }

    const voiceChannelId =
      player.voiceChannelId;

    const textChannel =
      client.channels.cache.get(
        player.textChannelId
      );

    const voiceChannel =
      client.channels.cache.get(
        voiceChannelId
      );

    if (!voiceChannel) {
      return;
    }

    // Only humans count
    const humanCount =
      (
        voiceChannel.members?.filter(
          member => !member.user.bot
        ) ??
        new Map()
      ).size;

    // ========================================================
    // MEMBER LEFT BOT'S VC
    // ========================================================

    const leftBotVC =
      oldState.channelId ===
        voiceChannelId &&
      newState.channelId !==
        voiceChannelId;

    if (
      leftBotVC &&
      humanCount === 0
    ) {
      // ------------------------------------------------------
      // 247 MODE
      // Prevent Lavalink idle destruction
      // ------------------------------------------------------

      if (
        enabled247.has(guildId)
      ) {
        for (
          const key of [
            "_emptyTimeout",
            "queueEmptyTimeout",
            "_queueEmptyTimeout",
            "emptyTimeout",
          ]
        ) {
          if (player[key]) {
            clearTimeout(
              player[key]
            );

            player[key] = null;
          }
        }
      }

      // ------------------------------------------------------
      // AUTO PAUSE
      // ------------------------------------------------------

      if (
        !player.paused &&
        player.queue.current
      ) {
        player.set(
          "emptyPaused",
          true
        );

        await player
          .pause()
          .catch(() => {});

        await sendBanner(
          client,
          textChannel,
          guildId,
          {
            title:
              "AUTO PAUSED",

            subtitle:
              "Voice channel is now empty",

            lines: [
              {
                label: "Status",
                value: "Music Paused",
              },

              {
                label: "Reason",
                value: "No users are left in the VC",
              },

              {
                label: "Channel",
                value: `<#${voiceChannelId}>`,
              },

              {
                label: "Resume",
                value:
                  "Music will resume when someone joins",
              },

              {
                label: "247",
                value:
                  enabled247.has(guildId)
                    ? "Enabled — staying connected"
                    : "Disabled — may leave after idle timeout",
              },
            ],

            height: 500,
          }
        );
      }

      return;
    }

    // ========================================================
    // MEMBER JOINED BOT'S VC
    // ========================================================

    const joinedBotVC =
      newState.channelId ===
        voiceChannelId &&
      oldState.channelId !==
        voiceChannelId;

    if (
      joinedBotVC &&
      player.get("emptyPaused")
    ) {
      player.set(
        "emptyPaused",
        false
      );

      if (
        player.queue.current
      ) {
        await player
          .resume()
          .catch(() => {});

        await sendBanner(
          client,
          textChannel,
          guildId,
          {
            title:
              "AUTO RESUMED",

            subtitle:
              "Someone joined the voice channel",

            lines: [
              {
                label: "Status",
                value: "Music Resumed",
              },

              {
                label: "User",
                value:
                  newState.member?.user?.globalName ||
                  newState.member?.user?.username ||
                  "Someone",
              },

              {
                label: "Channel",
                value: `<#${voiceChannelId}>`,
              },

              {
                label: "Reason",
                value:
                  "A member joined the empty voice channel",
              },
            ],

            height: 450,
          }
        );
      }
    }
  },
};