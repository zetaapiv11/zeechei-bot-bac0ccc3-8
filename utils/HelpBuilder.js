const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  TextDisplayBuilder
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");

const COMMANDS_PER_PAGE = 8;

const PREFIX =
  process.env.BOT_PREFIX ||
  process.env.PREFIX ||
  "+";


/* ================================================================
 * LIVE COMMANDS
 * ================================================================ */

function getCommands(client) {
  const map = new Map();

  if (!client?.commands) return [];

  for (const command of client.commands.values()) {
    if (!command) continue;

    const name = String(command.name || "").trim();

    if (!name) continue;

    if (!map.has(name)) {
      map.set(name, command);
    }
  }

  return [...map.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );
}


/* ================================================================
 * CATEGORY
 * ================================================================ */

function getCategory(command) {
  return String(
    command?.category ||
    command?.categoryName ||
    "General"
  ).trim() || "General";
}


function getCategories(client) {
  const map = new Map();

  for (const command of getCommands(client)) {
    const category = getCategory(command);
    const key = category.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        name: category,
        commands: []
      });
    }

    map.get(key).commands.push(command);
  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}


function findCategory(client, category) {
  if (!category) return null;

  const wanted = String(category).toLowerCase();

  return (
    getCategories(client).find(
      x => x.name.toLowerCase() === wanted
    ) || null
  );
}


function findCommand(client, name) {
  if (!name) return null;

  const wanted = String(name).toLowerCase();

  return (
    getCommands(client).find(
      x => String(x.name).toLowerCase() === wanted
    ) || null
  );
}


/* ================================================================
 * HELPERS
 * ================================================================ */

function safe(value, fallback = "Not specified") {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
}


function normalizeUsage(command) {
  if (!command) {
    return "No usage information available.";
  }

  if (Array.isArray(command.usage)) {
    if (!command.usage.length) {
      return "No usage information available.";
    }

    return command.usage
      .map(x =>
        `${PREFIX}${command.name} ${String(x).trim()}`
      )
      .join("\n");
  }

  if (typeof command.usage === "string") {
    const usage = command.usage.trim();

    if (!usage) {
      return "No usage information available.";
    }

    if (
      usage.startsWith("+") ||
      usage.startsWith("/") ||
      usage.startsWith("!")
    ) {
      return usage;
    }

    return `${PREFIX}${command.name} ${usage}`;
  }

  return `${PREFIX}${command.name}`;
}


function normalizeAliases(command) {
  if (!command?.aliases) {
    return [];
  }

  if (Array.isArray(command.aliases)) {
    return command.aliases
      .map(x => String(x).trim())
      .filter(Boolean);
  }

  if (typeof command.aliases === "string") {
    return command.aliases
      .split(/[,|\s]+/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  return [];
}


/* ================================================================
 * RED / BLACK BANNER
 * ================================================================ */

function makeBanner({
  title,
  subtitle,
  count,
  category,
  type = "help"
}) {
  const width = 1400;
  const height = 420;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(
    0,
    0,
    width,
    height
  );

  background.addColorStop(0, "#050505");
  background.addColorStop(0.55, "#0b0b0b");
  background.addColorStop(1, "#160000");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.78,
    height * 0.25,
    10,
    width * 0.78,
    height * 0.25,
    520
  );

  glow.addColorStop(
    0,
    "rgba(255,0,0,0.30)"
  );

  glow.addColorStop(
    0.45,
    "rgba(180,0,0,0.12)"
  );

  glow.addColorStop(
    1,
    "rgba(0,0,0,0)"
  );

  ctx.fillStyle = glow;
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.fillStyle = "#b40000";
  ctx.fillRect(
    0,
    0,
    12,
    height
  );

  ctx.fillStyle = "#ff1616";
  ctx.fillRect(
    55,
    48,
    1285,
    2
  );

  ctx.font = "700 22px Arial";
  ctx.fillStyle = "#ff3030";

  ctx.fillText(
    type === "command"
      ? "ZEECHEI COMMAND GUIDE"
      : "ZEECHEI HELP CENTER",
    70,
    100
  );

  ctx.font = "900 62px Arial";
  ctx.fillStyle = "#ffffff";

  const mainTitle =
    String(title).length > 30
      ? String(title).slice(0, 30)
      : String(title);

  ctx.fillText(
    mainTitle,
    70,
    175
  );

  ctx.font = "400 25px Arial";
  ctx.fillStyle = "#b8b8b8";

  ctx.fillText(
    String(subtitle).slice(0, 78),
    72,
    220
  );

  const boxX = 70;
  const boxY = 270;
  const boxW = 280;
  const boxH = 80;

  ctx.fillStyle = "#0e0e0e";

  ctx.fillRect(
    boxX,
    boxY,
    boxW,
    boxH
  );

  ctx.strokeStyle = "#550000";
  ctx.lineWidth = 2;

  ctx.strokeRect(
    boxX,
    boxY,
    boxW,
    boxH
  );

  ctx.font = "900 34px Arial";
  ctx.fillStyle = "#ff2222";

  ctx.fillText(
    String(count),
    boxX + 20,
    boxY + 50
  );

  ctx.font = "700 17px Arial";
  ctx.fillStyle = "#aaaaaa";

  ctx.fillText(
    category
      ? String(category).toUpperCase()
      : "COMMANDS",
    boxX + 105,
    boxY + 48
  );

  ctx.strokeStyle =
    "rgba(255,0,0,0.28)";

  ctx.lineWidth = 2;

  for (let i = 0; i < 8; i++) {
    ctx.beginPath();

    ctx.moveTo(
      870 + i * 58,
      285
    );

    ctx.lineTo(
      1040 + i * 35,
      105 + i * 22
    );

    ctx.stroke();
  }

  ctx.fillStyle =
    "rgba(255,0,0,0.08)";

  ctx.fillRect(
    900,
    110,
    380,
    190
  );

  ctx.fillStyle = "#ff1616";

  ctx.fillRect(
    70,
    370,
    1260,
    2
  );

  ctx.font = "500 17px Arial";
  ctx.fillStyle = "#777777";

  ctx.fillText(
    "LIVE COMMAND DATA",
    70,
    398
  );

  return canvas.toBuffer("image/png");
}


function createBannerFile(options) {
  return new AttachmentBuilder(
    makeBanner(options),
    {
      name: "zeechei-help-banner.png"
    }
  );
}


function makeMedia(url) {
  if (!url) return null;

  try {
    return new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(url)
    );
  } catch {
    return null;
  }
}


/* ================================================================
 * CATEGORY DROPDOWN
 * ================================================================ */

function makeCategoriesMenu(
  client,
  ownerId,
  selectedCategory = null
) {
  const categories =
    getCategories(client);

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `zeechei_help:category:${ownerId}`
      )
      .setPlaceholder(
        selectedCategory
          ? `Category: ${selectedCategory}`
          : "Select a category..."
      )
      .setMinValues(1)
      .setMaxValues(1);

  for (const category of categories.slice(0, 25)) {
    menu.addOptions({
      label: category.name.slice(0, 100),

      description:
        `${category.commands.length} command${
          category.commands.length === 1
            ? ""
            : "s"
        }`.slice(0, 100),

      value: encodeURIComponent(
        category.name
      ),

      /*
       * FIX:
       * default:null was causing:
       *
       * Expected a boolean primitive
       * Received: null
       *
       * Ab selectedCategory na ho to default property
       * bilkul send nahi hogi.
       */
      ...(selectedCategory
        ? {
            default:
              category.name.toLowerCase() ===
              String(
                selectedCategory
              ).toLowerCase()
          }
        : {})
    });
  }

  return new ActionRowBuilder()
    .addComponents(menu);
}


/* ================================================================
 * COMMAND DROPDOWN
 * ================================================================ */

function makeCommandMenu(
  client,
  ownerId,
  category,
  page
) {
  const commands =
    category?.commands || [];

  const start =
    page * COMMANDS_PER_PAGE;

  const visible =
    commands.slice(
      start,
      start + COMMANDS_PER_PAGE
    );

  if (!visible.length) {
    return null;
  }

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `zeechei_help:command:${ownerId}:${encodeURIComponent(
          category.name
        )}:${page}`
      )
      .setPlaceholder(
        "Select a command..."
      )
      .setMinValues(1)
      .setMaxValues(1);

  for (const command of visible) {
    const description =
      safe(
        command.description,
        "No description available."
      );

    menu.addOptions({
      label:
        `${PREFIX}${command.name}`
          .slice(0, 100),

      description:
        description.slice(0, 100),

      value:
        encodeURIComponent(
          String(command.name)
        )
    });
  }

  return new ActionRowBuilder()
    .addComponents(menu);
}


/* ================================================================
 * PAGE BUTTONS
 * ================================================================ */

function makePageButtons(
  ownerId,
  category,
  page,
  totalPages
) {
  const row =
    new ActionRowBuilder();

  const previous =
    new ButtonBuilder()
      .setCustomId(
        `zeechei_help:page:${ownerId}:${encodeURIComponent(
          category.name
        )}:${page - 1}`
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
        `zeechei_help:pageinfo:${ownerId}`
      )
      .setLabel(
        `Page ${page + 1} / ${totalPages}`
      )
      .setStyle(
        ButtonStyle.Danger
      )
      .setDisabled(true);

  const next =
    new ButtonBuilder()
      .setCustomId(
        `zeechei_help:page:${ownerId}:${encodeURIComponent(
          category.name
        )}:${page + 1}`
      )
      .setLabel("Next")
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page >= totalPages - 1
      );

  const home =
    new ButtonBuilder()
      .setCustomId(
        `zeechei_help:home:${ownerId}`
      )
      .setLabel("Home")
      .setStyle(
        ButtonStyle.Secondary
      );

  row.addComponents(
    previous,
    pageButton,
    next,
    home
  );

  return row;
}


/* ================================================================
 * CATEGORY BACK BUTTONS
 * ================================================================ */

function makeCategoryBackButton(
  ownerId,
  category
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `zeechei_help:categorypage:${ownerId}:${encodeURIComponent(
            category.name
          )}:0`
        )
        .setLabel(
          "Back to Category"
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `zeechei_help:home:${ownerId}`
        )
        .setLabel("Home")
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}


/* ================================================================
 * HOME
 * ================================================================ */

function buildHome(
  client,
  ownerId,
  username = "User"
) {
  const commands =
    getCommands(client);

  const categories =
    getCategories(client);

  const banner =
    createBannerFile({
      title: "HELP CENTER",

      subtitle:
        "Complete live command guide for Zeechei",

      count:
        commands.length,

      category:
        `${categories.length} CATEGORIES`,

      type: "help"
    });

  const media =
    makeMedia(
      "attachment://zeechei-help-banner.png"
    );

  const container =
    new ContainerBuilder();

  if (media) {
    container.addMediaGalleryComponents(
      media
    );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        [
          "# ZEECHEI HELP CENTER",

          "Complete live command guide",

          "",

          `**Prefix:** \`${PREFIX}\``,

          `**Commands:** \`${commands.length}\``,

          `**Categories:** \`${categories.length}\``,

          "",

          "Select a category below to explore Zeechei's commands."
        ].join("\n")
      )
  );

  container.addActionRowComponents(
    makeCategoriesMenu(
      client,
      ownerId
    )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        `Requested by ${username}`
      )
  );

  return {
    components: [container],

    files: [banner],

    flags:
      MessageFlags.IsComponentsV2
  };
}


/* ================================================================
 * CATEGORY PAGE
 * ================================================================ */

function buildCategory(
  client,
  ownerId,
  categoryName,
  page = 0
) {
  const category =
    findCategory(
      client,
      categoryName
    );

  if (!category) {
    return buildHome(
      client,
      ownerId
    );
  }

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        category.commands.length /
          COMMANDS_PER_PAGE
      )
    );

  page = Math.max(
    0,
    Math.min(
      Number(page) || 0,
      totalPages - 1
    )
  );

  const start =
    page * COMMANDS_PER_PAGE;

  const visible =
    category.commands.slice(
      start,
      start + COMMANDS_PER_PAGE
    );

  const banner =
    createBannerFile({
      title:
        category.name.toUpperCase(),

      subtitle:
        `Live ${category.name} command guide`,

      count:
        category.commands.length,

      category:
        "COMMANDS",

      type:
        "help"
    });

  const media =
    makeMedia(
      "attachment://zeechei-help-banner.png"
    );

  const container =
    new ContainerBuilder();

  if (media) {
    container.addMediaGalleryComponents(
      media
    );
  }

  const commandLines =
    visible.length
      ? visible
          .map(
            (command, index) =>
              `**${start + index + 1}.** \`${PREFIX}${command.name}\` — ${safe(
                command.description,
                "No description."
              )}`
          )
          .join("\n")
      : "No commands found.";

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        [
          `# ${category.name.toUpperCase()}`,

          "",

          `**Commands in category:** \`${category.commands.length}\``,

          `**Page:** \`${page + 1}/${totalPages}\``,

          "",

          commandLines,

          "",

          "Select a command below for its complete guide."
        ].join("\n")
      )
  );

  const commandMenu =
    makeCommandMenu(
      client,
      ownerId,
      category,
      page
    );

  if (commandMenu) {
    container.addActionRowComponents(
      commandMenu
    );
  }

  container.addActionRowComponents(
    makePageButtons(
      ownerId,
      category,
      page,
      totalPages
    )
  );

  container.addActionRowComponents(
    makeCategoriesMenu(
      client,
      ownerId,
      category.name
    )
  );

  return {
    components: [container],

    files: [banner],

    flags:
      MessageFlags.IsComponentsV2
  };
}


/* ================================================================
 * COMMAND PAGE
 * ================================================================ */

function buildCommand(
  client,
  ownerId,
  categoryName,
  commandName,
  page = 0
) {
  const command =
    findCommand(
      client,
      commandName
    );

  const category =
    findCategory(
      client,
      categoryName
    );

  if (!command || !category) {
    return buildHome(
      client,
      ownerId
    );
  }

  const aliases =
    normalizeAliases(command);

  const usage =
    normalizeUsage(command);

  const banner =
    createBannerFile({
      title:
        `${PREFIX}${command.name}`,

      subtitle:
        safe(
          command.description,
          "Zeechei command"
        ),

      count:
        1,

      category:
        category.name,

      type:
        "command"
    });

  const media =
    makeMedia(
      "attachment://zeechei-help-banner.png"
    );

  const container =
    new ContainerBuilder();

  if (media) {
    container.addMediaGalleryComponents(
      media
    );
  }

  const aliasText =
    aliases.length
      ? aliases
          .map(
            x => `\`${PREFIX}${x}\``
          )
          .join(", ")
      : "None";

  const argsRequired =
    command.argsRequired === true
      ? "Yes"
      : command.argsRequired === false
        ? "No"
        : "Not specified";

  const commandData =
    [
      `# ${PREFIX}${command.name}`,

      "",

      "**Description**",

      safe(
        command.description,
        "No description available."
      ),

      "",

      `**Category:** \`${category.name}\``,

      `**Aliases:** ${aliasText}`,

      `**Arguments required:** \`${argsRequired}\``,

      "",

      "**Usage**",

      "```text",

      usage,

      "```"
    ].join("\n");

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        commandData
      )
  );

  if (command.permissions) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `**Permissions:** ${safe(
            command.permissions
          )}`
        )
    );
  }

  if (
    command.cooldown !== undefined
  ) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `**Cooldown:** ${safe(
            command.cooldown
          )}`
        )
    );
  }

  container.addActionRowComponents(
    makeCategoryBackButton(
      ownerId,
      category
    )
  );

  return {
    components: [container],

    files: [banner],

    flags:
      MessageFlags.IsComponentsV2
  };
}


/* ================================================================
 * INTERACTION PAYLOAD
 *
 * IMPORTANT:
 * Yahan interaction.update() NAHI hai.
 * helpInteractions.js deferUpdate() karta hai.
 * ================================================================ */

function handleInteractionPayload(
  client,
  interaction
) {
  const customId =
    interaction.customId || "";

  const parts =
    customId.split(":");

  if (
    parts[0] !== "zeechei_help"
  ) {
    return null;
  }

  const action =
    parts[1];

  const ownerId =
    parts[2];

  if (
    ownerId &&
    ownerId !== interaction.user.id
  ) {
    return null;
  }


  /* --------------------------------------------------------------
   * HOME
   * -------------------------------------------------------------- */

  if (action === "home") {
    return buildHome(
      client,
      interaction.user.id,
      interaction.user.username
    );
  }


  /* --------------------------------------------------------------
   * CATEGORY SELECT
   * -------------------------------------------------------------- */

  if (action === "category") {
    const selected =
      interaction.values?.[0];

    if (!selected) {
      return buildHome(
        client,
        interaction.user.id
      );
    }

    const category =
      decodeURIComponent(
        selected
      );

    return buildCategory(
      client,
      interaction.user.id,
      category,
      0
    );
  }


  /* --------------------------------------------------------------
   * CATEGORY PAGE
   * -------------------------------------------------------------- */

  if (
    action === "categorypage"
  ) {
    const category =
      decodeURIComponent(
        parts[3] || ""
      );

    const page =
      Number(parts[4]) || 0;

    return buildCategory(
      client,
      interaction.user.id,
      category,
      page
    );
  }


  /* --------------------------------------------------------------
   * COMMAND SELECT
   * -------------------------------------------------------------- */

  if (action === "command") {
    const category =
      decodeURIComponent(
        parts[3] || ""
      );

    const page =
      Number(parts[4]) || 0;

    const command =
      interaction.values?.[0];

    if (!command) {
      return buildCategory(
        client,
        interaction.user.id,
        category,
        page
      );
    }

    return buildCommand(
      client,
      interaction.user.id,
      category,
      decodeURIComponent(
        command
      ),
      page
    );
  }


  /* --------------------------------------------------------------
   * PAGE
   * -------------------------------------------------------------- */

  if (action === "page") {
    const category =
      decodeURIComponent(
        parts[3] || ""
      );

    const page =
      Number(parts[4]) || 0;

    return buildCategory(
      client,
      interaction.user.id,
      category,
      page
    );
  }


  return null;
}


/* ================================================================
 * EXPORTS
 * ================================================================ */

module.exports = {
  COMMANDS_PER_PAGE,

  getCommands,

  getCategories,

  buildHome,

  buildCategory,

  buildCommand,

  handleInteraction:
    handleInteractionPayload
};