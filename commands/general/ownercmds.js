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

// ============================================================
// CONFIG
// ============================================================

const WIDTH = 1500;
const HEIGHT = 920;

const COMMANDS_PER_PAGE = 8;

const COLORS = {
  background: "#050507",
  background2: "#08080d",

  card: "#0b0b11",
  card2: "#0e0e15",
  card3: "#111119",

  border: "#20202a",
  border2: "#292934",

  purple: "#8b5cf6",
  purple2: "#a78bfa",

  white: "#f5f5f7",
  text: "#d6d6df",
  muted: "#777784",
  dim: "#50505b",

  green: "#4ade80",
  yellow: "#facc15",
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

function roundedRect(
  ctx,
  x,
  y,
  w,
  h,
  r
) {
  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

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

function drawText(
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
// GET OWNER COMMANDS
// ============================================================

function getOwnerCommands(client) {
  const commands = [
    ...client.commands.values(),
  ];

  const unique = new Map();

  for (const command of commands) {
    if (!command) {
      continue;
    }

    const isOwner =
      command.ownerOnly === true;

    const isMainOwner =
      command.mainOwnerOnly === true;

    if (
      !isOwner &&
      !isMainOwner
    ) {
      continue;
    }

    const name =
      String(
        command.name || ""
      )
        .trim()
        .toLowerCase();

    if (!name) {
      continue;
    }

    if (!unique.has(name)) {
      unique.set(
        name,
        {
          ...command,
          name,
          ownerType:
            isMainOwner
              ? "MAIN OWNER"
              : "OWNER",
        }
      );
    }
  }

  return [
    ...unique.values(),
  ].sort(
    (a, b) =>
      a.name.localeCompare(
        b.name
      )
  );
}

// ============================================================
// DRAW COMMAND ROW
// ============================================================

function drawCommandRow(
  ctx,
  command,
  index,
  x,
  y,
  width
) {
  const height = 82;

  fillRound(
    ctx,
    x,
    y,
    width,
    height,
    18,
    COLORS.card2
  );

  strokeRound(
    ctx,
    x,
    y,
    width,
    height,
    18,
    COLORS.border,
    1
  );

  // Number

  drawText(
    ctx,
    String(index + 1).padStart(
      2,
      "0"
    ),
    x + 25,
    y + 41,
    11,
    COLORS.dim,
    "800"
  );

  // Command name

  drawText(
    ctx,
    `+${truncate(
      command.name,
      30
    )}`,
    x + 72,
    y + 29,
    17,
    COLORS.white,
    "800"
  );

  // Description

  drawText(
    ctx,
    truncate(
      safe(
        command.description,
        "No description provided."
      ),
      78
    ),
    x + 72,
    y + 57,
    10,
    COLORS.muted,
    "500"
  );

  // Access badge

  const badgeWidth =
    command.ownerType ===
    "MAIN OWNER"
      ? 125
      : 90;

  fillRound(
    ctx,
    x + width - badgeWidth - 24,
    y + 27,
    badgeWidth,
    29,
    14,
    command.ownerType ===
      "MAIN OWNER"
      ? "#17120a"
      : "#100c1b"
  );

  drawText(
    ctx,
    command.ownerType,
    x +
      width -
      badgeWidth / 2 -
      24,
    y + 41,
    8,
    command.ownerType ===
      "MAIN OWNER"
      ? COLORS.yellow
      : COLORS.purple2,
    "800",
    "center"
  );
}

// ============================================================
// CREATE OWNER COMMANDS BANNER
// ============================================================

function createOwnerCommandsBanner(
  client,
  page,
  commands
) {
  const totalCommands =
    commands.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalCommands /
          COMMANDS_PER_PAGE
      )
    );

  const currentPage =
    Math.min(
      Math.max(
        Number(page) || 1,
        1
      ),
      totalPages
    );

  const start =
    (currentPage - 1) *
    COMMANDS_PER_PAGE;

  const visible =
    commands.slice(
      start,
      start +
        COMMANDS_PER_PAGE
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
  // GLOW
  // ==========================================================

  const glow =
    ctx.createRadialGradient(
      180,
      110,
      20,
      180,
      110,
      650
    );

  glow.addColorStop(
    0,
    "rgba(139,92,246,0.19)"
  );

  glow.addColorStop(
    0.45,
    "rgba(139,92,246,0.055)"
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

  drawText(
    ctx,
    "ZEECHEI",
    75,
    77,
    30,
    COLORS.white,
    "900"
  );

  drawText(
    ctx,
    "OWNER COMMANDS",
    75,
    108,
    11,
    COLORS.purple2,
    "800"
  );

  drawText(
    ctx,
    "RESTRICTED COMMAND ACCESS",
    75,
    132,
    8,
    COLORS.dim,
    "700"
  );

  // Right header

  drawText(
    ctx,
    "OWNER SYSTEM",
    WIDTH - 75,
    77,
    10,
    COLORS.muted,
    "800",
    "right"
  );

  fillRound(
    ctx,
    WIDTH - 180,
    98,
    105,
    30,
    15,
    "#0c1911"
  );

  drawText(
    ctx,
    "PROTECTED",
    WIDTH - 127,
    113,
    8,
    COLORS.green,
    "800",
    "center"
  );

  // ==========================================================
  // HEADER DIVIDER
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

  drawText(
    ctx,
    "OWNER COMMAND DIRECTORY",
    75,
    207,
    27,
    COLORS.white,
    "900"
  );

  drawText(
    ctx,
    "Every command marked as Owner Only or Main Owner Only is shown here automatically.",
    75,
    239,
    11,
    COLORS.muted,
    "500"
  );

  // ==========================================================
  // STAT CARDS
  // ==========================================================

  const statY = 270;

  const statGap = 18;

  const statW =
    (WIDTH - 150 - statGap * 2) /
    3;

  const statH = 92;

  const ownerCount =
    commands.filter(
      command =>
        command.ownerType ===
        "OWNER"
    ).length;

  const mainOwnerCount =
    commands.filter(
      command =>
        command.ownerType ===
        "MAIN OWNER"
    ).length;

  const stats = [
    [
      "TOTAL PROTECTED",
      totalCommands,
      COLORS.white,
    ],
    [
      "OWNER COMMANDS",
      ownerCount,
      COLORS.purple2,
    ],
    [
      "MAIN OWNER",
      mainOwnerCount,
      COLORS.yellow,
    ],
  ];

  for (
    let i = 0;
    i < stats.length;
    i++
  ) {
    const x =
      75 +
      i *
        (statW + statGap);

    fillRound(
      ctx,
      x,
      statY,
      statW,
      statH,
      20,
      COLORS.card2
    );

    strokeRound(
      ctx,
      x,
      statY,
      statW,
      statH,
      20,
      COLORS.border,
      1
    );

    drawText(
      ctx,
      stats[i][0],
      x + 22,
      statY + 29,
      9,
      COLORS.muted,
      "800"
    );

    drawText(
      ctx,
      number(stats[i][1]),
      x + 22,
      statY + 63,
      23,
      stats[i][2],
      "900"
    );
  }

  // ==========================================================
  // COMMAND PANEL
  // ==========================================================

  const panelX = 75;
  const panelY = 390;
  const panelW = WIDTH - 150;
  const panelH = 405;

  fillRound(
    ctx,
    panelX,
    panelY,
    panelW,
    panelH,
    26,
    "#09090f"
  );

  strokeRound(
    ctx,
    panelX,
    panelY,
    panelW,
    panelH,
    26,
    "#1b1b24",
    1
  );

  // Panel heading

  drawText(
    ctx,
    "PROTECTED COMMANDS",
    panelX + 28,
    panelY + 31,
    15,
    COLORS.white,
    "900"
  );

  drawText(
    ctx,
    `PAGE ${currentPage} / ${totalPages}`,
    panelX + panelW - 28,
    panelY + 31,
    9,
    COLORS.muted,
    "800",
    "right"
  );

  fillRound(
    ctx,
    panelX + 28,
    panelY + 53,
    55,
    3,
    2,
    COLORS.purple
  );

  // ==========================================================
  // EMPTY
  // ==========================================================

  if (!visible.length) {
    drawText(
      ctx,
      "NO OWNER COMMANDS",
      WIDTH / 2,
      panelY + 175,
      20,
      COLORS.text,
      "800",
      "center"
    );

    drawText(
      ctx,
      "No commands with owner-only access were found.",
      WIDTH / 2,
      panelY + 210,
      11,
      COLORS.muted,
      "500",
      "center"
    );
  } else {
    const rowX =
      panelX + 28;

    const rowW =
      panelW - 56;

    const rowStart =
      panelY + 73;

    for (
      let i = 0;
      i < visible.length;
      i++
    ) {
      drawCommandRow(
        ctx,
        visible[i],
        start + i,
        rowX,
        rowStart +
          i * 40 +
          i * 42,
        rowW
      );
    }
  }

  // ==========================================================
  // PAGE INFORMATION
  // ==========================================================

  const showingStart =
    totalCommands === 0
      ? 0
      : start + 1;

  const showingEnd =
    Math.min(
      start +
        COMMANDS_PER_PAGE,
      totalCommands
    );

  drawText(
    ctx,
    `Showing ${number(
      showingStart
    )}–${number(
      showingEnd
    )} of ${number(
      totalCommands
    )} protected commands`,
    panelX + 28,
    panelY + panelH - 22,
    9,
    COLORS.dim,
    "600"
  );

  // ==========================================================
  // FOOTER
  // ==========================================================

  drawText(
    ctx,
    "ZEECHEI OWNER CONTROL",
    75,
    846,
    9,
    COLORS.dim,
    "700"
  );

  drawText(
    ctx,
    "RESTRICTED ACCESS",
    WIDTH - 75,
    846,
    9,
    COLORS.dim,
    "700",
    "right"
  );

  drawText(
    ctx,
    "LIVE COMMAND REGISTRY",
    WIDTH / 2,
    875,
    8,
    "#3a3a44",
    "600",
    "center"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// BUTTON ROW
// ============================================================

function createButtons(
  page,
  totalPages
) {
  const previous =
    new ButtonBuilder()
      .setCustomId(
        "zeechei_owner_previous"
      )
      .setLabel("Previous")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page <= 1
      );

  const pageButton =
    new ButtonBuilder()
      .setCustomId(
        "zeechei_owner_page"
      )
      .setLabel(
        `Page ${page}/${totalPages}`
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(true);

  const next =
    new ButtonBuilder()
      .setCustomId(
        "zeechei_owner_next"
      )
      .setLabel("Next")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page >= totalPages
      );

  return new ActionRowBuilder()
    .addComponents(
      previous,
      pageButton,
      next
    );
}

// ============================================================
// CREATE MESSAGE PAYLOAD
// ============================================================

function createPayload(
  client,
  page,
  commands
) {
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        commands.length /
          COMMANDS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      Math.max(
        Number(page) || 1,
        1
      ),
      totalPages
    );

  const buffer =
    createOwnerCommandsBanner(
      client,
      safePage,
      commands
    );

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name:
          `zeechei-owner-${safePage}.png`,
      }
    );

  const row =
    createButtons(
      safePage,
      totalPages
    );

  const builder =
    new V2Builder();

  builder
    .text(
      "**Zeechei Owner Commands**\nLive command registry with restricted access levels."
    )
    .media(
      `attachment://zeechei-owner-${safePage}.png`
    )
    .row(row);

  return {
    payload: builder.build([
      attachment,
    ]),
    page: safePage,
    totalPages,
  };
}

// ============================================================
// HANDLE COLLECTOR
// ============================================================

function attachCollector(
  sent,
  commands,
  client,
  ownerId
) {
  const collector =
    sent.createMessageComponentCollector({
      time:
        15 * 60 * 1000,
    });

  collector.on(
    "collect",
    async interaction => {
      if (
        ![
          "zeechei_owner_previous",
          "zeechei_owner_next",
        ].includes(
          interaction.customId
        )
      ) {
        return;
      }

      if (
        interaction.user.id !==
        ownerId
      ) {
        return interaction.reply({
          content:
            "Only the command user can change this page.",
          ephemeral: true,
        });
      }

      try {
        const currentPage =
          Number(
            interaction.message
              ?.components?.[0]
              ?.components?.[1]
              ?.label
              ?.match(/\d+/)?.[0]
          ) || 1;

        const totalPages =
          Math.max(
            1,
            Math.ceil(
              commands.length /
                COMMANDS_PER_PAGE
            )
          );

        let nextPage =
          currentPage;

        if (
          interaction.customId ===
          "zeechei_owner_next"
        ) {
          nextPage++;
        }

        if (
          interaction.customId ===
          "zeechei_owner_previous"
        ) {
          nextPage--;
        }

        nextPage =
          Math.min(
            Math.max(
              nextPage,
              1
            ),
            totalPages
          );

        await interaction.deferUpdate();

        const result =
          createPayload(
            client,
            nextPage,
            commands
          );

        await sent.edit(
          result.payload
        );
      } catch (error) {
        console.error(
          "[OWNER COMMANDS PAGINATION ERROR]",
          error
        );
      }
    }
  );

  collector.on(
    "end",
    async () => {
      try {
        const totalPages =
          Math.max(
            1,
            Math.ceil(
              commands.length /
                COMMANDS_PER_PAGE
            )
          );

        const lastPage =
          totalPages;

        const buffer =
          createOwnerCommandsBanner(
            client,
            lastPage,
            commands
          );

        const attachment =
          new AttachmentBuilder(
            buffer,
            {
              name:
                `zeechei-owner-${lastPage}.png`,
            }
          );

        const row =
          createButtons(
            lastPage,
            totalPages
          );

        const builder =
          new V2Builder();

        builder
          .text(
            "**Zeechei Owner Commands**\nThis owner command panel has expired."
          )
          .media(
            `attachment://zeechei-owner-${lastPage}.png`
          )
          .row(row);

        await sent.edit(
          builder.build([
            attachment,
          ])
        );
      } catch (_) {}
    }
  );

  return collector;
}

// ============================================================
// PREFIX EXECUTE
// ============================================================

async function execute({
  client,
  message,
}) {
  try {
    const commands =
      getOwnerCommands(
        client
      );

    const result =
      createPayload(
        client,
        1,
        commands
      );

    const sent =
      await message.reply(
        result.payload
      );

    attachCollector(
      sent,
      commands,
      client,
      message.author.id
    );

    return sent;
  } catch (error) {
    console.error(
      "[OWNER COMMANDS ERROR]",
      error
    );

    return message.reply(
      "The owner command panel could not be generated."
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
    const commands =
      getOwnerCommands(
        client
      );

    const result =
      createPayload(
        client,
        1,
        commands
      );

    await interaction.reply(
      result.payload
    );

    const sent =
      await interaction.fetchReply();

    attachCollector(
      sent,
      commands,
      client,
      interaction.user.id
    );
  } catch (error) {
    console.error(
      "[OWNER COMMANDS SLASH ERROR]",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      return interaction.reply({
        content:
          "The owner command panel could not be generated.",
        ephemeral: true,
      });
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  name: "ownercmds",

  aliases: [
    "ownercommands",
    "ownercommandslist",
    "ocmds",
    "oc",
  ],

  description:
    "Shows all protected owner commands.",

  category:
    "general",

  usage:
    "+ownercmds",

  argsRequired:
    false,

  ownerOnly:
    true,

  data:
    new SlashCommandBuilder()
      .setName(
        "ownercmds"
      )
      .setDescription(
        "Shows all protected owner commands."
      ),

  getSlashArgs: () => [],

  execute,

  executeSlash,
};