const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const {
  createCanvas,
  loadImage,
} = require("@napi-rs/canvas");

const WIDTH = 1400;
const HEIGHT = 900;

const SERVERS_PER_PAGE = 6;

const COLORS = {
  background: "#050507",
  background2: "#09090d",
  card: "#0c0c12",
  card2: "#101018",
  border: "#20202a",
  border2: "#292936",

  purple: "#8b5cf6",
  purple2: "#a78bfa",

  white: "#f5f5f7",
  text: "#d7d7df",
  muted: "#858591",
  dim: "#555560",

  green: "#4ade80",
  red: "#f87171",
};

// ============================================================
// HELPERS
// ============================================================

function safe(value, fallback = "Unknown") {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return String(value)
    .replace(/@/g, "@\u200b")
    .replace(/\r?\n/g, " ")
    .trim();
}

function truncate(value, max) {
  const str = String(value || "");

  if (str.length <= max) {
    return str;
  }

  return str.slice(0, max - 1) + "…";
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();

  ctx.moveTo(x + r, y);

  ctx.arcTo(
    x + w,
    y,
    x + w,
    y + h,
    r
  );

  ctx.arcTo(
    x + w,
    y + h,
    x,
    y + h,
    r
  );

  ctx.arcTo(
    x,
    y + h,
    x,
    y,
    r
  );

  ctx.arcTo(
    x,
    y,
    x + w,
    y,
    r
  );

  ctx.closePath();
}

function fillRound(
  ctx,
  x,
  y,
  w,
  h,
  r,
  color
) {
  roundedRect(
    ctx,
    x,
    y,
    w,
    h,
    r
  );

  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRound(
  ctx,
  x,
  y,
  w,
  h,
  r,
  color,
  width = 1
) {
  roundedRect(
    ctx,
    x,
    y,
    w,
    h,
    r
  );

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function text(
  ctx,
  value,
  x,
  y,
  size,
  color = COLORS.white,
  weight = "500",
  align = "left"
) {
  ctx.font =
    `${weight} ${size}px Arial`;

  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  ctx.fillText(
    String(value),
    x,
    y
  );
}

// ============================================================
// SERVER ICON
// ============================================================

async function drawGuildIcon(
  ctx,
  guild,
  x,
  y,
  size
) {
  const centerX =
    x + size / 2;

  const centerY =
    y + size / 2;

  try {
    const icon =
      guild.iconURL({
        extension: "png",
        size: 128,
        forceStatic: true,
      });

    if (icon) {
      const image =
        await loadImage(icon);

      ctx.save();

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        size / 2,
        0,
        Math.PI * 2
      );

      ctx.clip();

      ctx.drawImage(
        image,
        x,
        y,
        size,
        size
      );

      ctx.restore();

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        size / 2 + 2,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        COLORS.border2;

      ctx.lineWidth = 3;

      ctx.stroke();

      return;
    }
  } catch (_) {}

  fillRound(
    ctx,
    x,
    y,
    size,
    size,
    18,
    COLORS.card2
  );

  const first =
    safe(guild.name, "S")
      .charAt(0)
      .toUpperCase();

  text(
    ctx,
    first,
    centerX,
    centerY,
    32,
    COLORS.purple2,
    "900",
    "center"
  );
}

// ============================================================
// SERVER CARD
// ============================================================

async function drawServerCard(
  ctx,
  guild,
  index,
  x,
  y,
  width,
  height
) {
  fillRound(
    ctx,
    x,
    y,
    width,
    height,
    22,
    COLORS.card
  );

  strokeRound(
    ctx,
    x,
    y,
    width,
    height,
    22,
    COLORS.border,
    1
  );

  // Number

  text(
    ctx,
    String(index + 1).padStart(2, "0"),
    x + 22,
    y + 25,
    10,
    COLORS.dim,
    "800"
  );

  // Icon

  await drawGuildIcon(
    ctx,
    guild,
    x + 22,
    y + 47,
    72
  );

  // Name

  text(
    ctx,
    truncate(
      safe(guild.name, "Unknown Server"),
      28
    ),
    x + 112,
    y + 67,
    17,
    COLORS.white,
    "900"
  );

  // Server ID

  text(
    ctx,
    `ID  ${safe(guild.id)}`,
    x + 112,
    y + 92,
    10,
    COLORS.muted,
    "500"
  );

  // Divider

  ctx.beginPath();

  ctx.moveTo(
    x + 22,
    y + 137
  );

  ctx.lineTo(
    x + width - 22,
    y + 137
  );

  ctx.strokeStyle =
    COLORS.border;

  ctx.lineWidth = 1;

  ctx.stroke();

  // Members

  text(
    ctx,
    "MEMBERS",
    x + 22,
    y + 164,
    9,
    COLORS.muted,
    "800"
  );

  text(
    ctx,
    number(guild.memberCount),
    x + 22,
    y + 189,
    18,
    COLORS.white,
    "900"
  );

  // Channels

  text(
    ctx,
    "CHANNELS",
    x + 175,
    y + 164,
    9,
    COLORS.muted,
    "800"
  );

  text(
    ctx,
    number(
      guild.channels?.cache?.size || 0
    ),
    x + 175,
    y + 189,
    18,
    COLORS.white,
    "900"
  );

  // Owner

  text(
    ctx,
    "OWNER",
    x + 22,
    y + 220,
    9,
    COLORS.muted,
    "800"
  );

  text(
    ctx,
    `<@${safe(guild.ownerId, "Unknown")}>`,
    x + 22,
    y + 245,
    11,
    COLORS.text,
    "600"
  );

  // Status

  fillRound(
    ctx,
    x + width - 110,
    y + 218,
    86,
    28,
    14,
    "#0b1911"
  );

  text(
    ctx,
    "ACTIVE",
    x + width - 67,
    y + 232,
    9,
    COLORS.green,
    "800",
    "center"
  );
}

// ============================================================
// GET LIVE SERVERS
// ============================================================

function getLiveGuilds(client) {
  return [
    ...client.guilds.cache.values(),
  ].sort(
    (a, b) =>
      (b.memberCount || 0) -
      (a.memberCount || 0)
  );
}

// ============================================================
// CREATE SERVER PAGE
// ============================================================

async function createServerPage(
  client,
  page
) {
  const guilds =
    getLiveGuilds(client);

  const totalServers =
    guilds.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalServers /
          SERVERS_PER_PAGE
      )
    );

  const currentPage =
    Math.min(
      Math.max(
        Number(page) || 0,
        0
      ),
      totalPages - 1
    );

  const start =
    currentPage *
    SERVERS_PER_PAGE;

  const visibleGuilds =
    guilds.slice(
      start,
      start +
        SERVERS_PER_PAGE
    );

  const canvas =
    createCanvas(
      WIDTH,
      HEIGHT
    );

  const ctx =
    canvas.getContext("2d");

  // ==========================================================
  // BACKGROUND
  // ==========================================================

  const background =
    ctx.createLinearGradient(
      0,
      0,
      WIDTH,
      HEIGHT
    );

  background.addColorStop(
    0,
    "#030305"
  );

  background.addColorStop(
    0.5,
    "#07070c"
  );

  background.addColorStop(
    1,
    "#0b0710"
  );

  ctx.fillStyle =
    background;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // ==========================================================
  // PURPLE GLOW
  // ==========================================================

  const glow =
    ctx.createRadialGradient(
      170,
      100,
      20,
      170,
      100,
      600
    );

  glow.addColorStop(
    0,
    "rgba(139,92,246,0.18)"
  );

  glow.addColorStop(
    0.45,
    "rgba(139,92,246,0.05)"
  );

  glow.addColorStop(
    1,
    "rgba(139,92,246,0)"
  );

  ctx.fillStyle =
    glow;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // ==========================================================
  // MAIN CARD
  // ==========================================================

  fillRound(
    ctx,
    28,
    28,
    WIDTH - 56,
    HEIGHT - 56,
    32,
    "#08080d"
  );

  strokeRound(
    ctx,
    28,
    28,
    WIDTH - 56,
    HEIGHT - 56,
    32,
    "#1b1b24",
    2
  );

  // ==========================================================
  // HEADER
  // ==========================================================

  text(
    ctx,
    "ZEECHEI",
    70,
    70,
    27,
    COLORS.white,
    "900"
  );

  text(
    ctx,
    "SERVER MANAGEMENT",
    70,
    99,
    10,
    COLORS.purple2,
    "800"
  );

  text(
    ctx,
    "LIVE SERVER DATABASE",
    70,
    121,
    8,
    COLORS.dim,
    "700"
  );

  text(
    ctx,
    "LIVE SYSTEM",
    WIDTH - 70,
    72,
    10,
    COLORS.muted,
    "800",
    "right"
  );

  fillRound(
    ctx,
    WIDTH - 145,
    94,
    75,
    28,
    14,
    "#0c1911"
  );

  text(
    ctx,
    "ONLINE",
    WIDTH - 107,
    108,
    9,
    COLORS.green,
    "800",
    "center"
  );

  ctx.beginPath();

  ctx.moveTo(
    70,
    145
  );

  ctx.lineTo(
    WIDTH - 70,
    145
  );

  ctx.strokeStyle =
    "#1a1a22";

  ctx.lineWidth = 1;

  ctx.stroke();

  // ==========================================================
  // TITLE
  // ==========================================================

  text(
    ctx,
    "SERVER LIST",
    70,
    184,
    25,
    COLORS.white,
    "900"
  );

  text(
    ctx,
    "All servers currently connected to Zeechei.",
    70,
    213,
    11,
    COLORS.muted,
    "500"
  );

  // ==========================================================
  // STATS
  // ==========================================================

  const totalMembers =
    guilds.reduce(
      (total, guild) =>
        total +
        (guild.memberCount || 0),
      0
    );

  const totalChannels =
    guilds.reduce(
      (total, guild) =>
        total +
        (guild.channels?.cache?.size || 0),
      0
    );

  const stats = [
    [
      "TOTAL SERVERS",
      totalServers,
    ],
    [
      "TOTAL MEMBERS",
      totalMembers,
    ],
    [
      "TOTAL CHANNELS",
      totalChannels,
    ],
    [
      "CURRENT PAGE",
      `${currentPage + 1}/${totalPages}`,
    ],
  ];

  const statWidth = 250;
  const statHeight = 78;
  const statGap = 18;
  const statY = 245;

  for (
    let i = 0;
    i < stats.length;
    i++
  ) {
    const x =
      70 +
      i *
        (statWidth + statGap);

    fillRound(
      ctx,
      x,
      statY,
      statWidth,
      statHeight,
      19,
      "#0d0d14"
    );

    strokeRound(
      ctx,
      x,
      statY,
      statWidth,
      statHeight,
      19,
      COLORS.border,
      1
    );

    text(
      ctx,
      stats[i][0],
      x + 18,
      statY + 24,
      8,
      COLORS.muted,
      "800"
    );

    text(
      ctx,
      typeof stats[i][1] === "number"
        ? number(stats[i][1])
        : stats[i][1],
      x + 18,
      statY + 53,
      19,
      COLORS.white,
      "900"
    );
  }

  // ==========================================================
  // SERVER GRID
  // ==========================================================

  const gridX = 70;
  const gridY = 345;

  const gridGap = 18;

  const cardWidth =
    (WIDTH -
      140 -
      gridGap) /
    2;

  const cardHeight = 153;

  if (!visibleGuilds.length) {
    fillRound(
      ctx,
      gridX,
      gridY,
      WIDTH - 140,
      330,
      24,
      "#09090f"
    );

    strokeRound(
      ctx,
      gridX,
      gridY,
      WIDTH - 140,
      330,
      24,
      COLORS.border,
      1
    );

    text(
      ctx,
      "NO SERVERS FOUND",
      WIDTH / 2,
      gridY + 145,
      20,
      COLORS.text,
      "800",
      "center"
    );

    text(
      ctx,
      "Zeechei is currently not connected to any servers.",
      WIDTH / 2,
      gridY + 180,
      11,
      COLORS.muted,
      "500",
      "center"
    );
  } else {
    for (
      let i = 0;
      i < visibleGuilds.length;
      i++
    ) {
      const column =
        i % 2;

      const row =
        Math.floor(i / 2);

      const x =
        gridX +
        column *
          (cardWidth + gridGap);

      const y =
        gridY +
        row *
          (cardHeight + gridGap);

      await drawServerCard(
        ctx,
        visibleGuilds[i],
        start + i,
        x,
        y,
        cardWidth,
        cardHeight
      );
    }
  }

  // ==========================================================
  // FOOTER
  // ==========================================================

  text(
    ctx,
    `SERVERS ${start + 1}-${Math.min(
      start + visibleGuilds.length,
      totalServers
    )} OF ${totalServers}`,
    70,
    805,
    9,
    COLORS.dim,
    "700"
  );

  text(
    ctx,
    `PAGE ${currentPage + 1} / ${totalPages}`,
    WIDTH / 2,
    805,
    9,
    COLORS.dim,
    "700",
    "center"
  );

  text(
    ctx,
    "LIVE DATABASE VIEW",
    WIDTH - 70,
    805,
    9,
    COLORS.dim,
    "700",
    "right"
  );

  text(
    ctx,
    "ZEECHEI SERVER SYSTEM",
    WIDTH / 2,
    840,
    8,
    "#3a3a44",
    "600",
    "center"
  );

  return {
    buffer:
      canvas.toBuffer(
        "image/png"
      ),
    page: currentPage,
    totalPages,
    totalServers,
  };
}

// ============================================================
// BUTTONS
// ============================================================

function createButtons(
  page,
  totalPages
) {
  const previous =
    new ButtonBuilder()
      .setCustomId(
        `slist_prev_${page}`
      )
      .setLabel("Previous")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page <= 0
      );

  const pageButton =
    new ButtonBuilder()
      .setCustomId(
        `slist_page_${page}`
      )
      .setLabel(
        `Page ${page + 1} / ${totalPages}`
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(true);

  const next =
    new ButtonBuilder()
      .setCustomId(
        `slist_next_${page}`
      )
      .setLabel("Next")
      .setStyle(
        ButtonStyle.Primary
      )
      .setDisabled(
        page >= totalPages - 1
      );

  const close =
    new ButtonBuilder()
      .setCustomId(
        `slist_close_${page}`
      )
      .setLabel("Close")
      .setStyle(
        ButtonStyle.Danger
      );

  return [
    new ActionRowBuilder().addComponents(
      previous,
      pageButton,
      next,
      close
    ),
  ];
}

// ============================================================
// SEND SERVER LIST
// ============================================================

async function sendServerList(
  message,
  client
) {
  const data =
    await createServerPage(
      client,
      0
    );

  const attachment =
    new AttachmentBuilder(
      data.buffer,
      {
        name:
          "zeechei-server-list.png",
      }
    );

  const sent =
    await message.reply({
      files: [attachment],
      components:
        createButtons(
          data.page,
          data.totalPages
        ),
    });

  // ==========================================================
  // BUTTON COLLECTOR
  // ==========================================================

  const collector =
    sent.createMessageComponentCollector({
      time: 10 * 60 * 1000,

      filter: interaction =>
        interaction.user.id ===
        message.author.id,
    });

  collector.on(
    "collect",
    async interaction => {
      try {
        const customId =
          interaction.customId;

        if (
          customId.startsWith(
            "slist_close_"
          )
        ) {
          await interaction.update({
            components:
              createButtons(
                data.totalPages > 0
                  ? data.page
                  : 0,
                data.totalPages
              ).map(row => {
                row.components.forEach(
                  button =>
                    button.setDisabled(
                      true
                    )
                );

                return row;
              }),
          });

          collector.stop(
            "closed"
          );

          return;
        }

        let newPage =
          data.page;

        if (
          customId.startsWith(
            "slist_prev_"
          )
        ) {
          newPage =
            Math.max(
              0,
              data.page - 1
            );
        }

        if (
          customId.startsWith(
            "slist_next_"
          )
        ) {
          newPage =
            Math.min(
              data.totalPages - 1,
              data.page + 1
            );
        }

        const fresh =
          await createServerPage(
            client,
            newPage
          );

        const freshAttachment =
          new AttachmentBuilder(
            fresh.buffer,
            {
              name:
                "zeechei-server-list.png",
            }
          );

        await interaction.update({
          files: [
            freshAttachment,
          ],
          components:
            createButtons(
              fresh.page,
              fresh.totalPages
            ),
        });

        data.page =
          fresh.page;

        data.totalPages =
          fresh.totalPages;

        data.totalServers =
          fresh.totalServers;
      } catch (error) {
        console.error(
          "[SLIST BUTTON ERROR]",
          error
        );

        try {
          if (
            !interaction.replied &&
            !interaction.deferred
          ) {
            await interaction.reply({
              content:
                "The server list could not be updated.",
              ephemeral: true,
            });
          }
        } catch (_) {}
      }
    }
  );

  collector.on(
    "end",
    async () => {
      try {
        const disabled =
          createButtons(
            data.page,
            data.totalPages
          );

        for (
          const row of disabled
        ) {
          for (
            const button of row.components
          ) {
            button.setDisabled(
              true
            );
          }
        }

        await sent.edit({
          components:
            disabled,
        });
      } catch (_) {}
    }
  );

  return sent;
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "slist",

  aliases: [
    "serverlist",
    "servers",
  ],

  description:
    "Shows all servers the bot is currently in.",

  category:
    "general",

  usage:
    "+slist",

  argsRequired: false,

  ownerOnly: true,

  data:
    new SlashCommandBuilder()
      .setName("slist")
      .setDescription(
        "Shows all servers the bot is currently in."
      ),

  getSlashArgs: () => [],

  // ==========================================================
  // PREFIX
  // ==========================================================

  async execute({
    client,
    message,
  }) {
    try {
      return await sendServerList(
        message,
        client
      );
    } catch (error) {
      console.error(
        "[SLIST ERROR]",
        error
      );

      return message.reply(
        "The server list could not be generated."
      );
    }
  },

  // ==========================================================
  // SLASH
  // ==========================================================

  async executeSlash(
    interaction,
    client
  ) {
    try {
      const data =
        await createServerPage(
          client,
          0
        );

      const attachment =
        new AttachmentBuilder(
          data.buffer,
          {
            name:
              "zeechei-server-list.png",
          }
        );

      const reply =
        await interaction.reply({
          files: [attachment],
          components:
            createButtons(
              data.page,
              data.totalPages
            ),
          fetchReply: true,
        });

      const collector =
        reply.createMessageComponentCollector({
          time:
            10 * 60 * 1000,

          filter:
            buttonInteraction =>
              buttonInteraction.user.id ===
              interaction.user.id,
        });

      let currentPage =
        data.page;

      collector.on(
        "collect",
        async buttonInteraction => {
          try {
            const id =
              buttonInteraction.customId;

            if (
              id.startsWith(
                "slist_close_"
              )
            ) {
              const rows =
                createButtons(
                  currentPage,
                  data.totalPages
                );

              for (
                const row of rows
              ) {
                for (
                  const button of row.components
                ) {
                  button.setDisabled(
                    true
                  );
                }
              }

              await buttonInteraction.update({
                components: rows,
              });

              collector.stop(
                "closed"
              );

              return;
            }

            if (
              id.startsWith(
                "slist_prev_"
              )
            ) {
              currentPage =
                Math.max(
                  0,
                  currentPage - 1
                );
            }

            if (
              id.startsWith(
                "slist_next_"
              )
            ) {
              currentPage =
                Math.min(
                  data.totalPages - 1,
                  currentPage + 1
                );
            }

            const fresh =
              await createServerPage(
                client,
                currentPage
              );

            currentPage =
              fresh.page;

            const freshAttachment =
              new AttachmentBuilder(
                fresh.buffer,
                {
                  name:
                    "zeechei-server-list.png",
                }
              );

            await buttonInteraction.update({
              files: [
                freshAttachment,
              ],
              components:
                createButtons(
                  fresh.page,
                  fresh.totalPages
                ),
            });
          } catch (error) {
            console.error(
              "[SLIST SLASH BUTTON ERROR]",
              error
            );

            try {
              if (
                !buttonInteraction.replied &&
                !buttonInteraction.deferred
              ) {
                await buttonInteraction.reply({
                  content:
                    "The server list could not be updated.",
                  ephemeral: true,
                });
              }
            } catch (_) {}
          }
        }
      );

      collector.on(
        "end",
        async () => {
          try {
            const rows =
              createButtons(
                currentPage,
                data.totalPages
              );

            for (
              const row of rows
            ) {
              for (
                const button of row.components
              ) {
                button.setDisabled(
                  true
                );
              }
            }

            await reply.edit({
              components: rows,
            });
          } catch (_) {}
        }
      );
    } catch (error) {
      console.error(
        "[SLIST SLASH ERROR]",
        error
      );

      try {
        if (
          !interaction.replied &&
          !interaction.deferred
        ) {
          return interaction.reply({
            content:
              "The server list could not be generated.",
            ephemeral: true,
          });
        }
      } catch (_) {}
    }
  },
};