const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const {
  createCanvas,
} = require("@napi-rs/canvas");

const {
  V2Builder,
} = require("../../utils/V2Builder");

const WIDTH = 1500;
const HEIGHT = 900;

const COLORS = {
  bg: "#050507",
  card: "#09090f",
  card2: "#0d0d14",
  border: "#20202a",
  border2: "#2a2a36",

  purple: "#8b5cf6",
  purple2: "#a78bfa",

  white: "#f5f5f7",
  text: "#d6d6df",
  muted: "#777784",
  dim: "#50505b",

  green: "#4ade80",
};

// ============================================================
// HELPERS
// ============================================================

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
  ctx.font = `${weight} ${size}px Arial`;

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
// GET LIVE SERVER USER DATA
// ============================================================

function getLiveUserStats(client) {
  const guilds = [
    ...client.guilds.cache.values(),
  ];

  let totalMembers = 0;

  let largestServer = null;

  for (const guild of guilds) {
    const members = Number(
      guild.memberCount || 0
    );

    totalMembers += members;

    if (
      !largestServer ||
      members > largestServer.members
    ) {
      largestServer = {
        name: guild.name,
        members,
      };
    }
  }

  return {
    guildCount: guilds.length,
    totalMembers,
    largestServer,
    timestamp: Date.now(),
  };
}

// ============================================================
// CREATE USERS BANNER
// ============================================================

function createUsersBanner(client) {
  const stats =
    getLiveUserStats(client);

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
    0.45,
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
      180,
      120,
      20,
      180,
      120,
      620
    );

  glow.addColorStop(
    0,
    "rgba(139,92,246,0.18)"
  );

  glow.addColorStop(
    0.45,
    "rgba(139,92,246,0.06)"
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
  // OUTER CARD
  // ==========================================================

  fillRound(
    ctx,
    30,
    30,
    WIDTH - 60,
    HEIGHT - 60,
    34,
    "#08080d"
  );

  strokeRound(
    ctx,
    30,
    30,
    WIDTH - 60,
    HEIGHT - 60,
    34,
    "#1b1b24",
    2
  );

  // ==========================================================
  // HEADER
  // ==========================================================

  text(
    ctx,
    "ZEECHEI",
    75,
    76,
    30,
    COLORS.white,
    "900"
  );

  text(
    ctx,
    "USER STATISTICS",
    75,
    108,
    11,
    COLORS.purple2,
    "800"
  );

  text(
    ctx,
    "LIVE NETWORK DATA",
    75,
    132,
    8,
    COLORS.dim,
    "700"
  );

  // Online status

  text(
    ctx,
    "LIVE SYSTEM",
    WIDTH - 75,
    78,
    10,
    COLORS.muted,
    "800",
    "right"
  );

  fillRound(
    ctx,
    WIDTH - 170,
    100,
    95,
    30,
    15,
    "#0c1911"
  );

  text(
    ctx,
    "ONLINE",
    WIDTH - 122,
    115,
    9,
    COLORS.green,
    "800",
    "center"
  );

  // ==========================================================
  // HEADER LINE
  // ==========================================================

  ctx.beginPath();

  ctx.moveTo(
    75,
    160
  );

  ctx.lineTo(
    WIDTH - 75,
    160
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
    "TOTAL USERS",
    75,
    215,
    29,
    COLORS.white,
    "900"
  );

  text(
    ctx,
    "Combined member count across every server Zeechei is currently in.",
    75,
    247,
    12,
    COLORS.muted,
    "500"
  );

  // ==========================================================
  // MAIN TOTAL CARD
  // ==========================================================

  const mainX = 75;
  const mainY = 285;
  const mainW = WIDTH - 150;
  const mainH = 185;

  fillRound(
    ctx,
    mainX,
    mainY,
    mainW,
    mainH,
    28,
    "#0c0c13"
  );

  strokeRound(
    ctx,
    mainX,
    mainY,
    mainW,
    mainH,
    28,
    COLORS.border2,
    1
  );

  // Accent line

  fillRound(
    ctx,
    mainX + 30,
    mainY + 30,
    5,
    125,
    3,
    COLORS.purple
  );

  text(
    ctx,
    "ALL SERVER MEMBERS",
    mainX + 65,
    mainY + 48,
    11,
    COLORS.muted,
    "800"
  );

  text(
    ctx,
    number(stats.totalMembers),
    mainX + 65,
    mainY + 105,
    52,
    COLORS.white,
    "900"
  );

  text(
    ctx,
    "CURRENT TOTAL",
    mainX + 68,
    mainY + 145,
    10,
    COLORS.purple2,
    "800"
  );

  // Right side

  fillRound(
    ctx,
    mainX + mainW - 330,
    mainY + 30,
    280,
    125,
    22,
    "#0a0a10"
  );

  strokeRound(
    ctx,
    mainX + mainW - 330,
    mainY + 30,
    280,
    125,
    22,
    COLORS.border,
    1
  );

  text(
    ctx,
    "SERVERS",
    mainX + mainW - 300,
    mainY + 62,
    10,
    COLORS.muted,
    "800"
  );

  text(
    ctx,
    number(stats.guildCount),
    mainX + mainW - 300,
    mainY + 100,
    30,
    COLORS.white,
    "900"
  );

  text(
    ctx,
    "CONNECTED SERVERS",
    mainX + mainW - 300,
    mainY + 130,
    8,
    COLORS.dim,
    "700"
  );

  // ==========================================================
  // STAT CARDS
  // ==========================================================

  const cardY = 505;

  const cardGap = 22;

  const cardW =
    (mainW - cardGap * 2) / 3;

  const cardH = 145;

  const cards = [
    {
      title: "TOTAL MEMBERS",
      value: number(
        stats.totalMembers
      ),
      sub: "Across all servers",
    },
    {
      title: "TOTAL SERVERS",
      value: number(
        stats.guildCount
      ),
      sub: "Currently connected",
    },
    {
      title: "LARGEST SERVER",
      value: stats.largestServer
        ? number(
            stats.largestServer.members
          )
        : "0",
      sub: stats.largestServer
        ? stats.largestServer.name
        : "No servers",
    },
  ];

  for (
    let i = 0;
    i < cards.length;
    i++
  ) {
    const x =
      mainX +
      i *
        (cardW + cardGap);

    fillRound(
      ctx,
      x,
      cardY,
      cardW,
      cardH,
      24,
      "#0d0d14"
    );

    strokeRound(
      ctx,
      x,
      cardY,
      cardW,
      cardH,
      24,
      COLORS.border,
      1
    );

    text(
      ctx,
      cards[i].title,
      x + 25,
      cardY + 32,
      9,
      COLORS.muted,
      "800"
    );

    text(
      ctx,
      cards[i].value,
      x + 25,
      cardY + 78,
      27,
      COLORS.white,
      "900"
    );

    text(
      ctx,
      cards[i].sub.length > 34
        ? cards[i].sub.slice(0, 31) + "..."
        : cards[i].sub,
      x + 25,
      cardY + 113,
      9,
      COLORS.dim,
      "600"
    );
  }

  // ==========================================================
  // LIVE INFO PANEL
  // ==========================================================

  const infoY = 680;

  fillRound(
    ctx,
    mainX,
    infoY,
    mainW,
    110,
    22,
    "#0a0a10"
  );

  strokeRound(
    ctx,
    mainX,
    infoY,
    mainW,
    110,
    22,
    COLORS.border,
    1
  );

  text(
    ctx,
    "LIVE DATABASE VIEW",
    mainX + 28,
    infoY + 34,
    10,
    COLORS.purple2,
    "800"
  );

  text(
    ctx,
    "Member totals are calculated directly from the bot's current guild cache.",
    mainX + 28,
    infoY + 61,
    11,
    COLORS.text,
    "500"
  );

  text(
    ctx,
    "Use the Refresh button to recalculate the current total.",
    mainX + 28,
    infoY + 83,
    9,
    COLORS.muted,
    "500"
  );

  // ==========================================================
  // FOOTER
  // ==========================================================

  text(
    ctx,
    "ZEECHEI USER SYSTEM",
    75,
    838,
    9,
    COLORS.dim,
    "700"
  );

  text(
    ctx,
    "LIVE USER COUNT",
    WIDTH - 75,
    838,
    9,
    COLORS.dim,
    "700",
    "right"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// V2 PAYLOAD
// ============================================================

function createPayload(
  client,
  ephemeral = false
) {
  const buffer =
    createUsersBanner(client);

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name: "zeechei-users.png",
      }
    );

  const refresh =
    new ButtonBuilder()
      .setCustomId(
        "zeechei_users_refresh"
      )
      .setLabel("Refresh")
      .setStyle(
        ButtonStyle.Secondary
      );

  const row =
    new ActionRowBuilder()
      .addComponents(
        refresh
      );

  const builder =
    new V2Builder();

  builder
    .text(
      "**Zeechei User Statistics**\nLive combined member count across all connected servers."
    )
    .media(
      "attachment://zeechei-users.png"
    )
    .row(row);

  return ephemeral
    ? builder.buildEphemeral([
        attachment,
      ])
    : builder.build([
        attachment,
      ]);
}

// ============================================================
// REFRESH MESSAGE
// ============================================================

async function updateUsersMessage(
  message,
  client
) {
  try {
    const payload =
      createPayload(
        client,
        false
      );

    await message.edit(
      payload
    );

    return true;
  } catch (error) {
    console.error(
      "[USERS REFRESH ERROR]",
      error
    );

    return false;
  }
}

// ============================================================
// PREFIX EXECUTE
// ============================================================

async function execute({
  client,
  message,
}) {
  try {
    const payload =
      createPayload(
        client,
        false
      );

    const sent =
      await message.reply(
        payload
      );

    // ========================================================
    // BUTTON COLLECTOR
    // ========================================================

    const collector =
      sent.createMessageComponentCollector({
        time: 10 * 60 * 1000,
      });

    collector.on(
      "collect",
      async interaction => {
        if (
          interaction.customId !==
          "zeechei_users_refresh"
        ) {
          return;
        }

        // Owner check
        if (
          interaction.user.id !==
          message.author.id
        ) {
          return interaction.reply({
            content:
              "Only the command user can refresh this panel.",
            ephemeral: true,
          });
        }

        try {
          await interaction.deferUpdate();

          const newPayload =
            createPayload(
              client,
              false
            );

          await sent.edit(
            newPayload
          );
        } catch (error) {
          console.error(
            "[USERS BUTTON ERROR]",
            error
          );
        }
      }
    );

    collector.on(
      "end",
      async () => {
        try {
          const disabledButton =
            new ButtonBuilder()
              .setCustomId(
                "zeechei_users_refresh"
              )
              .setLabel(
                "Refresh Expired"
              )
              .setStyle(
                ButtonStyle.Secondary
              )
              .setDisabled(true);

          const disabledRow =
            new ActionRowBuilder()
              .addComponents(
                disabledButton
              );

          const expiredBuilder =
            new V2Builder();

          const buffer =
            createUsersBanner(
              client
            );

          const attachment =
            new AttachmentBuilder(
              buffer,
              {
                name:
                  "zeechei-users.png",
              }
            );

          expiredBuilder
            .text(
              "**Zeechei User Statistics**\nLive combined member count across all connected servers."
            )
            .media(
              "attachment://zeechei-users.png"
            )
            .row(disabledRow);

          await sent.edit(
            expiredBuilder.build([
              attachment,
            ])
          );
        } catch (_) {}
      }
    );

    return sent;
  } catch (error) {
    console.error(
      "[USERS COMMAND ERROR]",
      error
    );

    return message.reply(
      "The user statistics panel could not be generated."
    );
  }
}

// ============================================================
// SLASH EXECUTE
// ============================================================

async function executeSlash(
  interaction,
  client
) {
  try {
    const payload =
      createPayload(
        client,
        false
      );

    const sent =
      await interaction.reply({
        ...payload,
        withResponse: true,
      });

    const message =
      sent?.resource?.message ||
      await interaction.fetchReply();

    // ========================================================
    // BUTTON COLLECTOR
    // ========================================================

    const collector =
      message.createMessageComponentCollector({
        time: 10 * 60 * 1000,
      });

    collector.on(
      "collect",
      async component => {
        if (
          component.customId !==
          "zeechei_users_refresh"
        ) {
          return;
        }

        if (
          component.user.id !==
          interaction.user.id
        ) {
          return component.reply({
            content:
              "Only the command user can refresh this panel.",
            ephemeral: true,
          });
        }

        try {
          await component.deferUpdate();

          const newPayload =
            createPayload(
              client,
              false
            );

          await message.edit(
            newPayload
          );
        } catch (error) {
          console.error(
            "[USERS SLASH REFRESH ERROR]",
            error
          );
        }
      }
    );

    return;
  } catch (error) {
    console.error(
      "[USERS SLASH ERROR]",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      return interaction.reply({
        content:
          "The user statistics panel could not be generated.",
        ephemeral: true,
      });
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  name: "users",

  aliases: [
    "userlist",
    "userstats",
    "botusers",
  ],

  description:
    "Shows live combined user statistics across all servers.",

  category:
    "general",

  usage:
    "+users",

  argsRequired:
    false,

  ownerOnly:
    true,

  data:
    new SlashCommandBuilder()
      .setName("users")
      .setDescription(
        "Shows live combined user statistics across all servers."
      ),

  getSlashArgs: () => [],

  execute,

  executeSlash,
};