const { LavalinkManager } = require("lavalink-client");
const { request } = require("undici");
const config = require("../config");
const WebhookLogger = require("../logger/WebhookLogger");

const {
  buildNowPlayingV2,
  applyFilter,
  buildFilterV2,
  generateNowPlayingCard,
} = require("../utils/NowPlayingComponents");

const { v2msg, V2Builder } = require("../utils/V2Builder");
const { enabled247 } = require("../utils/State");
const { convertTime } = require("../utils/convertTime");
const Database = require("../database/Database");
const { MessageFlags } = require("discord.js");
const emojis = require("../utils/emojis");
const { getLavalinkNodes } = require("../utils/lavalinkConfig");

const SOURCE_LABELS = {
  ytmsearch: "YouTube Music",
  ytsearch: "YouTube",
  scsearch: "SoundCloud",
  spsearch: "Spotify",
  amsearch: "Apple Music",
  dzsearch: "Deezer",
};

let manager = null;

// ============================================================================
// VOICE STATUS
// ============================================================================

function getPlayerVoiceChannelId(client, player) {
  return (
    player?.voiceChannelId ||
    player?.voiceChannel ||
    player?.voiceChannelID ||
    client?.guilds?.cache?.get(player?.guildId)?.members?.me?.voice?.channelId ||
    null
  );
}

async function setVCStatus(token, voiceChannelId, status) {
  if (!voiceChannelId) return;

  try {
    await request(
      `https://discord.com/api/v10/channels/${voiceChannelId}/voice-status`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: status || "",
        }),
      },
    );
  } catch (_) {}
}

// ============================================================================
// CANCEL LAVALINK DESTROY TIMER
// ============================================================================

function cancelDestroyTimer(player) {
  for (const key of [
    "_emptyTimeout",
    "queueEmptyTimeout",
    "_queueEmptyTimeout",
    "emptyTimeout",
  ]) {
    if (player[key]) {
      clearTimeout(player[key]);
      player[key] = null;
    }
  }
}

// ============================================================================
// CLEANUP NOW PLAYING MESSAGE
// ============================================================================

function cleanupNpMessage(player) {
  const interval = player.get("npInterval");

  if (interval) {
    clearInterval(interval);
    player.set("npInterval", null);
  }

  const col = player.get("npCollector");

  if (col && !col.ended) {
    col.stop("trackEnded");
  }

  player.set("npCollector", null);

  const msg = player.get("npMsg");

  if (msg) {
    setTimeout(() => {
      msg.delete().catch(() => {});
    }, 800);
  }

  player.set("npMsg", null);
}

// ============================================================================
// AUTOPLAY
// ============================================================================

async function getAutoplayTrack(player, lastTrack) {
  if (!lastTrack?.info) return null;

  const {
    title = "",
    author = "",
    identifier,
    sourceName = "",
  } = lastTrack.info;

  const playedTracks =
    player.get("playedTracks") || new Set();

  let engine = "ytmsearch";
  let queries;

  if (sourceName === "youtube") {
    engine = "ytsearch";

    queries = [
      `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`,
      `${author} ${title} mix`.trim(),
      author || title,
    ];
  } else if (sourceName === "soundcloud") {
    engine = "scsearch";

    queries = [
      `${author} ${title}`.trim(),
      author || title,
    ];
  } else {
    engine = "ytmsearch";

    queries = [
      author ? `${author} mix` : null,
      `${author} ${title}`.trim(),
      author || title,
      "trending music",
    ];
  }

  queries = queries.filter(Boolean);

  for (const query of queries) {
    try {
      console.log(
        `[Autoplay] Searching (${engine}): "${query}"`,
      );

      const res = await player.search(
        {
          query,
          source: engine,
        },
        lastTrack.requester,
      );

      console.log(
        `[Autoplay] loadType=${res?.loadType} tracks=${res?.tracks?.length ?? 0}`,
      );

      if (res?.tracks?.length) {
        const candidates = res.tracks.filter(
          (t) =>
            t.info?.identifier &&
            t.info.identifier !== identifier &&
            !playedTracks.has(
              t.info.identifier,
            ),
        );

        if (candidates.length) {
          const pick =
            candidates[
              Math.floor(
                Math.random() *
                  Math.min(
                    candidates.length,
                    5,
                  ),
              )
            ];

          playedTracks.add(
            pick.info.identifier,
          );

          player.set(
            "playedTracks",
            playedTracks,
          );

          console.log(
            `[Autoplay] Picked: "${pick.info.title}" by ${pick.info.author}`,
          );

          return pick;
        }
      }
    } catch (error) {
      console.error(
        `[Autoplay] Search error for "${query}":`,
        error.message,
      );
    }
  }

  console.log(
    "[Autoplay] All queries exhausted, no track found",
  );

  return null;
}

// ============================================================================
// CREATE MANAGER
// ============================================================================

function createManager(client) {
  manager = new LavalinkManager({
    nodes: getLavalinkNodes(config).map((node, index) => ({
      id: node.id || `zeechei-${index + 1}`,
      host: node.host,
      port: node.port,
      authorization: node.password,
      secure: node.secure,
    })),

    sendToShard: (guildId, payload) => {
      const guild =
        client.guilds.cache.get(guildId);

      if (guild) {
        guild.shard.send(payload);
      }
    },

    client: {
      id: client.user.id,
      username: client.user.username,
    },

    playerOptions: {
      defaultSearchPlatform: "ytmsearch",
      previousTracksSize: 25,

      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },

      onEmptyQueue: {
        destroyAfterMs: 90_000,

        autoPlayFunction: async (
          player,
          lastPlayedTrack,
        ) => {
          if (!player.get("autoplay")) {
            return;
          }

          console.log(
            "[Autoplay] autoPlayFunction triggered for:",
            lastPlayedTrack?.info?.title ??
              "unknown",
          );

          const seed =
            lastPlayedTrack ||
            player.queue.previous?.[0] ||
            player.get("lastTrack");

          if (!seed?.info) {
            console.log(
              "[Autoplay] No seed track info, skipping",
            );
            return;
          }

          const next =
            await getAutoplayTrack(
              player,
              seed,
            );

          if (next) {
            await player.queue.add(next);

            console.log(
              "[Autoplay] Track added to queue successfully",
            );
          } else {
            const ch =
              client.channels.cache.get(
                player.textChannelId,
              );

            const color =
              client.getColor(
                player.guildId,
              );

            if (ch) {
              ch.send(
                new V2Builder(color)
                  .text(
                    `# <  **__Autoplay__**`,
                  )
                  .sep()
                  .text(
                    `> **__ Current Status __** **-**  Couldn't find a related track.\n\n` +
                      `-# Use \`+play\` to add more music.`,
                  )
                  .build(),
              ).catch(() => {});
            }
          }
        },
      },
    },
  });

  // ==========================================================================
  // LAVALINK NODE EVENTS
  // ==========================================================================

  manager.nodeManager.on(
    "connect",
    (node) => {
      console.log(
        `[Lavalink] Node connected: ${node.id}`,
      );
    },
  );

  manager.nodeManager.on(
    "error",
    (node, err) => {
      console.error(
        `[Lavalink] (${node.id}):`,
        err.message,
      );
    },
  );

  // ==========================================================================
  // TRACK END
  // ==========================================================================

  manager.on(
    "trackEnd",
    (player, track) => {
      if (track?.info) {
        player.set(
          "lastTrack",
          track,
        );
      }

      cleanupNpMessage(player);
    },
  );

  // ==========================================================================
  // TRACK START
  // ==========================================================================

  manager.on(
    "trackStart",
    async (player, track) => {
      try {
        player.set(
          "emptyPaused",
          false,
        );

        const ch =
          client.channels.cache.get(
            player.textChannelId,
          );

        const title =
          track.info?.title ||
          "Unknown";

        await setVCStatus(
          config.token,
          getPlayerVoiceChannelId(client, player),
          `${emojis.nowplaying} Playing ${String(title).slice(0, 95)}`,
        );

        if (!ch) return;

        // --------------------------------------------------------------------
        // Remove previous NP message if any
        // --------------------------------------------------------------------

        cleanupNpMessage(player);

        // --------------------------------------------------------------------
        // SOURCE
        // --------------------------------------------------------------------

        const configuredSource =
          Database.getSource(
            player.guildId,
          ) || "ytmsearch";

        const source =
          SOURCE_LABELS[
            configuredSource
          ] || "YouTube Music";

        // --------------------------------------------------------------------
        // REQUESTER
        // --------------------------------------------------------------------

        const reqName =
          track.requester?.username ||
          track.requester?.tag ||
          "Unknown";

        // --------------------------------------------------------------------
        // NEW NOW PLAYING CARD
        // IMPORTANT:
        // generateNowPlayingCard now comes from
        // ../utils/NowPlayingComponents
        // --------------------------------------------------------------------

        const cardBuffer =
          await generateNowPlayingCard({
            title,
            artist:
              track.info?.author ||
              "Unknown",

            source,

            requester: reqName,

            artworkUrl:
              track.info?.artworkUrl ||
              null,

            position: 0,

            duration:
              track.info?.duration ||
              0,

            volume:
              player.volume ?? 80,

            queueSize:
              player.queue?.tracks
                ?.length || 0,

            queueCount:
              player.queue?.tracks
                ?.length || 0,

            repeatMode:
              player.repeatMode ||
              "off",

            autoplay:
              player.get("autoplay") ||
              false,

            paused:
              player.paused || false,
          }).catch((error) => {
            console.error(
              "[NowPlaying Card]",
              error,
            );

            return null;
          });

        player.set(
          "npCardBuffer",
          cardBuffer,
        );

        // --------------------------------------------------------------------
        // ATTACHMENT URL
        // --------------------------------------------------------------------

        const imageUrl = cardBuffer
          ? "attachment://zeechei-card.png"
          : null;

        // --------------------------------------------------------------------
        // BUILD V2 MESSAGE
        // --------------------------------------------------------------------

        const payload =
          buildNowPlayingV2(
            client,
            player,
            track,
            0,
            imageUrl,
            cardBuffer,
          );

        const msg =
          await ch.send(payload).catch(
            (error) => {
              console.error(
                "[NowPlaying Send]",
                error,
              );

              return null;
            },
          );

        if (!msg) return;

        player.set(
          "npMsg",
          msg,
        );

        WebhookLogger.musicPlay(
          track.requester?.tag ||
            "Unknown",
          player.guildId,
          title,
        );

        // --------------------------------------------------------------------
        // LIVE CARD REFRESH
        // --------------------------------------------------------------------

        const progressInterval =
          setInterval(async () => {
            try {
              const p =
                client.lavalink?.getPlayer(
                  player.guildId,
                );

              if (
                !p ||
                !p.queue?.current
              ) {
                return;
              }

              const current =
                p.queue.current;

              const currentInfo =
                current.info || {};

              const currentBuffer =
                await generateNowPlayingCard(
                  {
                    title:
                      currentInfo.title ||
                      "Unknown",

                    artist:
                      currentInfo.author ||
                      "Unknown",

                    source:
                      SOURCE_LABELS[
                        Database.getSource(
                          p.guildId,
                        ) || "ytmsearch"
                      ] ||
                      "YouTube Music",

                    requester:
                      current.requester
                        ?.username ||
                      current.requester
                        ?.tag ||
                      "Unknown",

                    artworkUrl:
                      currentInfo.artworkUrl ||
                      null,

                    position:
                      p.position || 0,

                    duration:
                      currentInfo.duration ||
                      0,

                    volume:
                      p.volume ?? 80,

                    queueSize:
                      p.queue?.tracks
                        ?.length || 0,

                    queueCount:
                      p.queue?.tracks
                        ?.length || 0,

                    repeatMode:
                      p.repeatMode ||
                      "off",

                    autoplay:
                      p.get("autoplay") ||
                      false,

                    paused:
                      p.paused || false,
                  },
                ).catch(() => null);

              p.set(
                "npCardBuffer",
                currentBuffer,
              );

              const currentImageUrl =
                currentBuffer
                  ? "attachment://zeechei-card.png"
                  : null;

              const newPayload =
                buildNowPlayingV2(
                  client,
                  p,
                  current,
                  p.position || 0,
                  currentImageUrl,
                  currentBuffer,
                );

              await msg
                .edit(newPayload)
                .catch(() => {});
            } catch (_) {}
          }, 20_000);

        player.set(
          "npInterval",
          progressInterval,
        );

        // --------------------------------------------------------------------
        // COMPONENT COLLECTOR
        // --------------------------------------------------------------------

        const collectorTime =
          track.info?.duration > 0
            ? track.info.duration +
              30_000
            : 300_000;

        const collector =
          msg.createMessageComponentCollector(
            {
              time: collectorTime,
            },
          );

        player.set(
          "npCollector",
          collector,
        );

        // ====================================================================
        // COLLECT
        // ====================================================================

        collector.on(
          "collect",
          async (interaction) => {
            try {
              const gc =
                client.getColor(
                  interaction.guildId,
                );

              const {
                cross: X,
              } = client.emoji;

              const p =
                client.lavalink?.getPlayer(
                  interaction.guildId,
                );

              // --------------------------------------------------------------
              // PLAYER CHECK
              // --------------------------------------------------------------

              if (!p) {
                return interaction.reply(
                  new V2Builder(gc)
                    .text(
                      `# ${X} **__Player Gone__**\n\n` +
                        `> The music player is no longer active.`,
                    )
                    .buildEphemeral(),
                );
              }

              // --------------------------------------------------------------
              // VOICE CHECK
              // --------------------------------------------------------------

              if (
                !interaction.member
                  ?.voice
                  ?.channelId
              ) {
                return interaction.reply(
                  new V2Builder(gc)
                    .text(
                      `# ${X} **__Not in Voice__**\n\n` +
                        `> Join a voice channel to use controls.`,
                    )
                    .buildEphemeral(),
                );
              }

              if (
                interaction.member
                  .voice.channelId !==
                p.voiceChannelId
              ) {
                return interaction.reply(
                  new V2Builder(gc)
                    .text(
                      `# ${X} **__Wrong Channel__**\n\n` +
                        `> Join <#${p.voiceChannelId}> to use controls.`,
                    )
                    .buildEphemeral(),
                );
              }

              // ==============================================================
              // FILTER SELECT
              // ==============================================================

              if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                  "np_filter"
              ) {
                await interaction.deferReply(
                  {
                    flags:
                      MessageFlags.Ephemeral |
                      MessageFlags.IsComponentsV2,
                  },
                );

                try {
                  const fn =
                    interaction
                      .values?.[0];

                  await applyFilter(
                    p,
                    fn,
                  );

                  return interaction.editReply(
                    buildFilterV2(
                      fn,
                      interaction.user.id,
                      gc,
                    ),
                  );
                } catch (error) {
                  console.error(
                    "[NP filter]",
                    error,
                  );

                  return interaction.editReply(
                    new V2Builder(gc)
                      .text(
                        `# ${X} **__Filter Error__**\n\n` +
                          `> Could not apply that filter.`,
                      )
                      .buildEphemeral(),
                  );
                }
              }

              // --------------------------------------------------------------
              // ONLY BUTTONS BELOW
              // --------------------------------------------------------------

              if (
                !interaction.isButton()
              ) {
                return;
              }

              // ==============================================================
              // EQ PRESET
              // ==============================================================

              const eqMatch =
                interaction.customId.match(
                  /^eq:preset:(.+)$/,
                );

              if (eqMatch) {
                const eqKey =
                  eqMatch[1];

                const eqCmd =
                  client.commands.get(
                    "equalizer",
                  );

                if (
                  !eqCmd?.__eq
                    ?.PRESETS?.[
                    eqKey
                  ]
                ) {
                  return;
                }

                await p.filterManager
                  .setEqualizer(
                    eqCmd.__eq.toBands(
                      eqCmd.__eq
                        .PRESETS[
                        eqKey
                      ].gains,
                    ),
                  )
                  .catch(() => {});

                if (
                  typeof p
                    .filterManager
                    .update ===
                  "function"
                ) {
                  await p.filterManager
                    .update()
                    .catch(
                      () => {},
                    );
                }

                return interaction.update(
                  eqCmd.__eq.buildPayload(
                    client,
                    interaction.guildId,
                    eqKey,
                  ),
                );
              }

              // ==============================================================
              // REFRESH NP
              // ==============================================================

              const refreshNP =
                async () => {
                  try {
                    if (
                      !p.queue
                        ?.current
                    ) {
                      return;
                    }

                    const current =
                      p.queue.current;

                    const info =
                      current.info ||
                      {};

                    const buf =
                      await generateNowPlayingCard(
                        {
                          title:
                            info.title ||
                            "Unknown",

                          artist:
                            info.author ||
                            "Unknown",

                          source:
                            SOURCE_LABELS[
                              Database.getSource(
                                p.guildId,
                              ) ||
                                "ytmsearch"
                            ] ||
                            "YouTube Music",

                          requester:
                            current
                              .requester
                              ?.username ||
                            current
                              .requester
                              ?.tag ||
                            "Unknown",

                          artworkUrl:
                            info.artworkUrl ||
                            null,

                          position:
                            p.position ||
                            0,

                          duration:
                            info.duration ||
                            0,

                          volume:
                            p.volume ?? 80,

                          queueSize:
                            p.queue
                              ?.tracks
                              ?.length ||
                            0,

                          queueCount:
                            p.queue
                              ?.tracks
                              ?.length ||
                            0,

                          repeatMode:
                            p.repeatMode ||
                            "off",

                          autoplay:
                            p.get(
                              "autoplay",
                            ) ||
                            false,

                          paused:
                            p.paused ||
                            false,
                        },
                      ).catch(
                        () => null,
                      );

                    p.set(
                      "npCardBuffer",
                      buf,
                    );

                    const imgUrl =
                      buf
                        ? "attachment://zeechei-card.png"
                        : null;

                    await msg
                      .edit(
                        buildNowPlayingV2(
                          client,
                          p,
                          current,
                          p.position ||
                            0,
                          imgUrl,
                          buf,
                        ),
                      )
                      .catch(
                        () => {},
                      );
                  } catch {}
                };

              // ==============================================================
              // STOP
              // ==============================================================

              if (
                interaction.customId ===
                "np_stop"
              ) {
                const autoplayOn =
                  p.get(
                    "autoplay",
                  ) || false;

                if (autoplayOn) {
                  const {
                    ActionRowBuilder,
                    ButtonBuilder,
                    ButtonStyle,
                  } = require("discord.js");

                  const confirmRow =
                    new ActionRowBuilder().addComponents(
                      new ButtonBuilder()
                        .setCustomId(
                          "np_stop_confirm",
                        )
                        .setEmoji({
                          name: "zeecheisuccess",
                          id: "1506685680737325076",
                        })
                        .setStyle(
                          ButtonStyle.Success,
                        ),

                      new ButtonBuilder()
                        .setCustomId(
                          "np_stop_cancel",
                        )
                        .setEmoji({
                          name: "zeecheicancel",
                          id: "1506685701079564338",
                        })
                        .setStyle(
                          ButtonStyle.Danger,
                        ),
                    );

                  await interaction.reply(
                    new V2Builder(gc)
                      .text(
                        `# **__ Confirm Action??__**`,
                      )
                      .sep()
                      .text(
                        `> **Are you sure you want to stop the music as autoplay is enabled?**\n\n` +
                          `-# Music will stop and autoplay will be disabled.`,
                      )
                      .sep()
                      .row(
                        confirmRow,
                      )
                      .buildEphemeral(),
                  );

                  const confirmMsg =
                    await interaction.fetchReply();

                  const confirmCollector =
                    confirmMsg.createMessageComponentCollector(
                      {
                        filter: (i) =>
                          i.user.id ===
                          interaction.user
                            .id,

                        time: 30_000,
                        max: 1,
                      },
                    );

                  confirmCollector.on(
                    "collect",
                    async (btn) => {
                      if (
                        btn.customId ===
                        "np_stop_confirm"
                      ) {
                        p.set(
                          "autoplay",
                          false,
                        );

                        const qc =
                          p.queue
                            .tracks
                            .length;

                        p.queue.tracks.splice(
                          0,
                        );

                        await p
                          .setRepeatMode(
                            "off",
                          )
                          .catch(
                            () => {},
                          );

                        collector.stop(
                          "stopped",
                        );

                        try {
                          await p.skip();
                        } catch {}

                        return btn.update(
                          new V2Builder(
                            gc,
                          )
                            .text(
                              `#  __**Stopped The Track**__`,
                            )
                            .sep()
                            .text(
                              `> **__Cleared__:** \`${qc + 1}\` tracks\n` +
                                `> **__requested by__:** <@${interaction.user.id}>`,
                            )
                            .buildEphemeral(),
                        );
                      }

                      return btn.update(
                        new V2Builder(gc)
                          .text(
                            `>  Stop cancelled.`,
                          )
                          .buildEphemeral(),
                      );
                    },
                  );

                  confirmCollector.on(
                    "end",
                    (col) => {
                      if (
                        col.size ===
                        0
                      ) {
                        interaction
                          .editReply(
                            new V2Builder(
                              gc,
                            )
                              .text(
                                `> Stop request timed out.`,
                              )
                              .buildEphemeral(),
                          )
                          .catch(
                            () => {},
                          );
                      }
                    },
                  );

                  return;
                }

                // ------------------------------------------------------------
                // AUTOPLAY OFF
                // ------------------------------------------------------------

                await interaction
                  .deferUpdate()
                  .catch(
                    () => {},
                  );

                const qc =
                  p.queue.tracks
                    .length;

                p.queue.tracks.splice(
                  0,
                );

                await p
                  .setRepeatMode(
                    "off",
                  )
                  .catch(
                    () => {},
                  );

                collector.stop(
                  "stopped",
                );

                try {
                  await p.skip();
                } catch {}

                return interaction.followUp(
                  new V2Builder(gc)
                    .text(
                      `#  __**Stopped The Track**__`,
                    )
                    .sep()
                    .text(
                      `> **__Cleared__:** \`${qc + 1}\` tracks\n` +
                        `> **__requested by__:** <@${interaction.user.id}>`,
                    )
                    .buildEphemeral(),
                );
              }

              // ==============================================================
              // ACK
              // ==============================================================

              await interaction
                .deferUpdate()
                .catch(
                  () => {},
                );

              // ==============================================================
              // BUTTON SWITCH
              // ==============================================================

              switch (
                interaction.customId
              ) {
                // ------------------------------------------------------------
                // PAUSE / RESUME
                // ------------------------------------------------------------

                case "np_pauseresume": {
                  if (
                    !p.playing &&
                    !p.paused
                  ) {
                    return interaction.followUp(
                      new V2Builder(gc)
                        .text(
                          `# ${X} **__Nothing Playing__**\n\n` +
                            `> No playback to pause/resume.`,
                        )
                        .buildEphemeral(),
                    );
                  }

                  const wasPaused =
                    p.paused;

                  if (wasPaused) {
                    await p.resume();
                  } else {
                    await p.pause();
                  }

                  await refreshNP();

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        wasPaused
                          ? `#  **__ Resumed__**\n\n` +
                            `> **__Track__** **-** ${(p.queue.current?.info?.title || "").slice(0, 55)}\n\n` +
                            `-# **requested by:** <@${interaction.user.id}>`
                          : `#  **__Paused__**\n\n` +
                            `> **__Track__** **-** ${(p.queue.current?.info?.title || "").slice(0, 55)}\n\n` +
                            `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // SKIP
                // ------------------------------------------------------------

                case "np_skip": {
                  if (
                    !p.queue.current
                  ) {
                    return interaction.followUp(
                      new V2Builder(gc)
                        .text(
                          `# ${X} **__Nothing to Skip__**\n\n` +
                            `> No track currently playing.`,
                        )
                        .buildEphemeral(),
                    );
                  }

                  const skipped =
                    (
                      p.queue.current
                        .info?.title ||
                      "Unknown"
                    ).slice(
                      0,
                      55,
                    );

                  const auth =
                    p.queue.current
                      .info?.author ||
                    "Unknown";

                  const nextTrack =
                    p.queue
                      .tracks[0];

                  const qLeft =
                    p.queue.tracks
                      .length;

                  await p.skip();

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Skipped__**\n\n` +
                          `> **__Skipped Track__** **-** ${skipped} (From "${auth}")\n\n` +
                          `-# **Skipped by:** <@${interaction.user.id}>\n` +
                          `-# **__Queue__** **-** ${
                            nextTrack
                              ? `\`${qLeft}\` tracks remaining`
                              : "empty"
                          }`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // PREVIOUS
                // ------------------------------------------------------------

                case "np_prev": {
                  const prev =
                    p.queue.previous?.[0] ||
                    p.get(
                      "lastTrack",
                    );

                  if (
                    !prev?.info
                  ) {
                    return interaction.followUp(
                      new V2Builder(gc)
                        .text(
                          `#  **__No History Found__**\n\n` +
                            `> No previous track in history yet.`,
                        )
                        .buildEphemeral(),
                    );
                  }

                  await p.queue.add(
                    prev,
                    0,
                  );

                  await p.skip();

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__ Playing Previous Track__**\n\n` +
                          `> **__Track__:** ${(prev.info.title || "Unknown").slice(0, 55)}\n` +
                          `> **__requested by__:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // QUEUE LOOP
                // ------------------------------------------------------------

                case "np_loop_queue": {
                  const next =
                    p.repeatMode ===
                    "queue"
                      ? "off"
                      : "queue";

                  await p.setRepeatMode(
                    next,
                  );

                  await refreshNP();

                  const statusEmoji =
                    next === "queue"
                      ? "<:zeecheisuccess:1506685680737325076> enabled"
                      : "<:zeecheicancel:1506685701079564338> disabled";

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Queue Loop__**\n\n` +
                          `> **__Current status__** **-** ${statusEmoji}\n\n` +
                          `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // TRACK LOOP
                // ------------------------------------------------------------

                case "np_loop_track": {
                  const next =
                    p.repeatMode ===
                    "track"
                      ? "off"
                      : "track";

                  await p.setRepeatMode(
                    next,
                  );

                  await refreshNP();

                  const statusEmoji =
                    next === "track"
                      ? "<:zeecheisuccess:1506685680737325076> enabled"
                      : "<:zeecheicancel:1506685701079564338> disabled";

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Track Loop__**\n\n` +
                          `> **__Current Status__** **-** ${statusEmoji}\n\n` +
                          `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // SHUFFLE
                // ------------------------------------------------------------

                case "np_shuffle": {
                  if (
                    !p.queue
                      .tracks
                      .length
                  ) {
                    return interaction.followUp(
                      new V2Builder(gc)
                        .text(
                          `# ${X} **__Queue Empty__**\n\n` +
                            `> No tracks to shuffle.`,
                        )
                        .buildEphemeral(),
                    );
                  }

                  const count =
                    p.queue
                      .tracks
                      .length;

                  await p.queue.shuffle();

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Shuffled__**\n\n` +
                          `> Shuffled \`${count}\` tracks.\n\n` +
                          `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // VOLUME UP
                // ------------------------------------------------------------

                case "np_volup": {
                  const newVol =
                    Math.min(
                      (p.volume ??
                        80) + 10,
                      200,
                    );

                  await p.setVolume(
                    newVol,
                  );

                  await refreshNP();

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Volume Increased__**\n\n` +
                          `> **__Current Volume__** **-** \`${newVol}%\`\n\n` +
                          `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // VOLUME DOWN
                // ------------------------------------------------------------

                case "np_voldown": {
                  const newVol =
                    Math.max(
                      (p.volume ??
                        80) - 10,
                      10,
                    );

                  await p.setVolume(
                    newVol,
                  );

                  await refreshNP();

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Volume Decreased__**\n\n` +
                          `> **__Current Volume__** **-** \`${newVol}%\`\n\n` +
                          `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // QUEUE
                // ------------------------------------------------------------

                case "np_queue": {
                  const upcoming =
                    p.queue.tracks;

                  const cur =
                    p.queue.current;

                  const curTitle =
                    (
                      cur?.info
                        ?.title ||
                      "Unknown"
                    ).slice(
                      0,
                      55,
                    );

                  const curAuth =
                    cur?.info?.author ||
                    "Unknown";

                  const curLink =
                    cur?.info?.uri ||
                    "https://discord.gg";

                  let body =
                    `#  **__Current Queue__**\n\n` +
                    `> **__Currently Playing__** **-** [${curTitle} (From "${curAuth}")](${curLink})`;

                  if (
                    !upcoming.length
                  ) {
                    body +=
                      `\n\n⠀-# Queue is empty.`;
                  } else {
                    body +=
                      `\n\n**Tracks:**\n` +
                      upcoming
                        .slice(0, 10)
                        .map(
                          (
                            t,
                            i,
                          ) =>
                            `\`${i + 1}.\` [${(
                              t.info
                                ?.title ||
                              "Unknown"
                            ).slice(
                              0,
                              48,
                            )}](${t.info?.uri || "https://discord.gg"})`,
                        )
                        .join(
                          "\n",
                        );

                    if (
                      upcoming.length >
                      10
                    ) {
                      body +=
                        `\n\n-# ...and **${
                          upcoming.length -
                          10
                        }** more tracks`;
                    }
                  }

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(body)
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // CLEAR QUEUE
                // ------------------------------------------------------------

                case "np_clearqueue": {
                  const count =
                    p.queue.tracks
                      .length;

                  if (!count) {
                    return interaction.followUp(
                      new V2Builder(gc)
                        .text(
                          `# ${X} **__Queue Empty__**\n\n` +
                            `> Nothing to clear.`,
                        )
                        .buildEphemeral(),
                    );
                  }

                  p.queue.tracks.splice(
                    0,
                  );

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `#  **__Queue Cleared__**\n\n` +
                          `> **Removed:** \`${count}\` tracks.\n\n` +
                          `-# **requested by:** <@${interaction.user.id}>\n` +
                          `-# Current track will finish, then playback will stop.`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // AUTOPLAY
                // ------------------------------------------------------------

                case "np_autoplay": {
                  const wasOn =
                    p.get(
                      "autoplay",
                    ) || false;

                  p.set(
                    "autoplay",
                    !wasOn,
                  );

                  await refreshNP();

                  const statusEmoji =
                    !wasOn
                      ? "<:zeecheisuccess:1506685680737325076> Enabled"
                      : "<:zeecheicancel:1506685701079564338> Disabled";

                  return interaction.followUp(
                    new V2Builder(gc)
                      .text(
                        `# **__Autoplay__**\n\n` +
                          `> **__Current Status__** **-** ${statusEmoji}\n\n` +
                          `-# Related songs will play when queue ends.\n` +
                          `-# **requested by:** <@${interaction.user.id}>`,
                      )
                      .buildEphemeral(),
                  );
                }

                // ------------------------------------------------------------
                // DELETE NP
                // ------------------------------------------------------------

                case "np_delete": {
                  collector.stop(
                    "deleted",
                  );

                  clearInterval(
                    progressInterval,
                  );

                  player.set(
                    "npInterval",
                    null,
                  );

                  player.set(
                    "npMsg",
                    null,
                  );

                  player.set(
                    "npCollector",
                    null,
                  );

                  return msg
                    .delete()
                    .catch(
                      () => {},
                    );
                }

                default:
                  break;
              }
            } catch (error) {
              console.error(
                "[NP collector]",
                error,
              );
            }
          },
        );

        // ====================================================================
        // COLLECTOR END
        // ====================================================================

        collector.on(
          "end",
          (_, reason) => {
            clearInterval(
              progressInterval,
            );

            player.set(
              "npInterval",
              null,
            );

            if (
              reason ===
                "trackEnded" ||
              reason === "deleted" ||
              reason === "stopped"
            ) {
              return;
            }

            msg
              .edit({
                components: [],
              })
              .catch(() => {});
          },
        );
      } catch (error) {
        console.error(
          "[Lavalink trackStart]",
          error,
        );
      }
    },
  );

  // ==========================================================================
  // TRACK ERROR
  // ==========================================================================

  manager.on(
    "trackError",
    async (player, track) => {
      const ch =
        client.channels.cache.get(
          player.textChannelId,
        );

      const color =
        client.getColor(
          player.guildId,
        );

      if (!ch) return;

      ch.send(
        new V2Builder(color)
          .text(
            `#  **__Track Error__**`,
          )
          .sep()
          .text(
            `> Could not play: **${(
              track.info?.title ||
              "Unknown"
            ).slice(0, 55)}**\n\n` +
              `-# Skipping to next track.`,
          )
          .build(),
      ).catch(() => {});
    },
  );

  // ==========================================================================
  // TRACK STUCK
  // ==========================================================================

  manager.on(
    "trackStuck",
    async (player, track) => {
      const ch =
        client.channels.cache.get(
          player.textChannelId,
        );

      const color =
        client.getColor(
          player.guildId,
        );

      if (ch) {
        ch.send(
          new V2Builder(color)
            .text(
              `#  **__Track Stuck__**`,
            )
            .sep()
            .text(
              `> **${(
                track.info?.title ||
                "Unknown"
              ).slice(0, 55)}** got stuck — skipping.\n` +
                `-# This usually means the source is temporarily unavailable.`,
            )
            .build(),
        ).catch(() => {});
      }

      player.skip().catch(
        () => {},
      );
    },
  );

  // ==========================================================================
  // QUEUE END
  // ==========================================================================

  manager.on(
    "queueEnd",
    async (player) => {
      setVCStatus(
        config.token,
        getPlayerVoiceChannelId(client, player),
        `${emojis.nowplaying} Playing Nothing`,
      );

      const ch =
        client.channels.cache.get(
          player.textChannelId,
        );

      const color =
        client.getColor(
          player.guildId,
        );

      // ----------------------------------------------------------------------
      // 24/7 MODE
      // ----------------------------------------------------------------------

      if (
        enabled247.has(
          player.guildId,
        )
      ) {
        cancelDestroyTimer(
          player,
        );

        if (ch) {
          ch.send(
            new V2Builder(color)
              .text(
                `# **__Queue Ended__**`,
              )
              .sep()
              .text(
                `>  **24/7 mode is on** — staying in voice!\n\n` +
                  `-# Use \`+play\` to add more music.`,
              )
              .build(),
          ).catch(() => {});
        }

        return;
      }

      // ----------------------------------------------------------------------
      // AUTOPLAY
      // ----------------------------------------------------------------------

      if (
        player.get("autoplay")
      ) {
        return;
      }

      // ----------------------------------------------------------------------
      // NORMAL END
      // ----------------------------------------------------------------------

      if (ch) {
        ch.send(
          new V2Builder(color)
            .text(
              `#  **__Queue Ended__**`,
            )
            .sep()
            .text(
              `> All tracks have been played.\n\n` +
                `-# Use \`+autoplay\` to auto-play related songs, or \`+play\` to add more!`,
            )
            .build(),
        ).catch(() => {});
      }
    },
  );

  // ==========================================================================
  // PLAYER DESTROY
  // ==========================================================================

  manager.on(
    "playerDestroy",
    (player) => {
      cleanupNpMessage(
        player,
      );

      setVCStatus(
        config.token,
        getPlayerVoiceChannelId(client, player),
        "",
      );

      if (
        enabled247.has(
          player.guildId,
        ) &&
        player.voiceChannelId
      ) {
        setTimeout(
          async () => {
            try {
              const guild =
                client.guilds.cache.get(
                  player.guildId,
                );

              if (!guild) return;

              const newPlayer =
                manager.createPlayer({
                  guildId:
                    player.guildId,

                  voiceChannelId:
                    player.voiceChannelId,

                  textChannelId:
                    player.textChannelId,

                  selfDeaf: true,
                  selfMute: false,

                  volume:
                    player.volume ||
                    80,
                });

              await newPlayer.connect();
            } catch (_) {}
          },
          2_000,
        );
      }
    },
  );

  return manager;
}

// ============================================================================
// HELPERS
// ============================================================================

function getManager() {
  return manager;
}

function formatDuration(ms) {
  return convertTime(ms);
}

function buildBar(
  pos,
  dur,
  size = 14,
) {
  if (!dur || dur <= 0) {
    return "▬".repeat(size);
  }

  const filled = Math.min(
    Math.round(
      (pos / dur) * size,
    ),
    size,
  );

  return (
    "▬".repeat(filled) +
    "🔘" +
    "▬".repeat(
      Math.max(
        0,
        size - filled,
      ),
    )
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createManager,
  getManager,
  formatDuration,
  buildBar,
};