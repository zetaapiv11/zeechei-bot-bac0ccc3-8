const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("@napi-rs/canvas");
const { V2Builder } = require("../../utils/V2Builder");

const DATA_DIR = path.join(process.cwd(), "database");
const DATA_FILE = path.join(DATA_DIR, "premium.json");

const SKY = "#63D8FF";
const SKY_SOFT = "#B9EEFF";
const BG = "#061016";
const PANEL = "#0A1920";
const PANEL_2 = "#0E222B";
const WHITE = "#F1FBFF";
const MUTED = "#83A8B6";

const PAGE_SIZE = 4;
const COLLECTOR_TIME = 10 * 60 * 1000;

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ guilds: {} }, null, 2));
  }
}

function readDB() {
  ensureDB();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!data.guilds || typeof data.guilds !== "object") data.guilds = {};
    return data;
  } catch {
    return { guilds: {} };
  }
}

function writeDB(data) {
  ensureDB();
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, DATA_FILE);
}

function normalizeIds(value) {
  if (Array.isArray(value)) return value.flatMap(normalizeIds);
  if (value instanceof Set) return [...value].flatMap(normalizeIds);
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map(x => x.trim())
      .filter(Boolean);
  }
  return [];
}

function configuredIds(client, keys) {
  const values = [];
  for (const key of keys) {
    if (client && client[key] != null) values.push(...normalizeIds(client[key]));
  }
  return [...new Set(values)];
}

function botOwnerIds(client) {
  const ids = [
    ...normalizeIds(client?.ownerIds),
    ...normalizeIds(client?.ownerId),
    ...normalizeIds(client?.owners),
  ];

  try {
    const config = require("../../config");
    ids.push(...normalizeIds(config?.ownerIds));
    ids.push(...normalizeIds(config?.ownerId));
  } catch {}

  if (process.env.OWNER_ID) ids.push(process.env.OWNER_ID);
  return [...new Set(ids)];
}

function isBotOwner(client, userId) {
  return botOwnerIds(client).includes(userId);
}

/*
 * Compatibility layer for common Zeechei-style owner/trusted stores.
 * If your existing project exposes these arrays/maps, they are used automatically.
 */
function isExtraOwner(client, guildId, userId) {
  const direct = configuredIds(client, [
    "extraOwnerIds",
    "extraOwners",
    "extraownerIds",
    "extraowners",
  ]);
  if (direct.includes(userId)) return true;

  const guildMaps = [
    client?.extraOwnersByGuild,
    client?.extraOwnerIdsByGuild,
    client?.extraowners,
    client?.extraOwners,
  ];

  for (const map of guildMaps) {
    if (map && typeof map === "object" && !Array.isArray(map)) {
      const guildValue = map[guildId];
      if (normalizeIds(guildValue).includes(userId)) return true;
    }
  }

  return false;
}

function isTrusted(client, guildId, userId) {
  const direct = configuredIds(client, [
    "trustedIds",
    "trustedUsers",
    "trusteds",
    "trusted",
  ]);
  if (direct.includes(userId)) return true;

  const guildMaps = [
    client?.trustedByGuild,
    client?.trustedUsersByGuild,
    client?.trusteds,
    client?.trusted,
  ];

  for (const map of guildMaps) {
    if (map && typeof map === "object" && !Array.isArray(map)) {
      const guildValue = map[guildId];
      if (normalizeIds(guildValue).includes(userId)) return true;
    }
  }

  return false;
}

function isPrivilegedUser(client, message) {
  if (!message?.guild || !message?.author) return false;
  if (isBotOwner(client, message.author.id)) return true;
  if (message.guild.ownerId === message.author.id) return true;
  if (isExtraOwner(client, message.guild.id, message.author.id)) return true;
  if (isTrusted(client, message.guild.id, message.author.id)) return true;
  return false;
}

function cleanupExpired() {
  const data = readDB();
  let changed = false;
  const now = Date.now();

  for (const [guildId, record] of Object.entries(data.guilds)) {
    if (!record) {
      delete data.guilds[guildId];
      changed = true;
      continue;
    }

    // Lifetime records intentionally have no expiry timestamp.
    if (record.lifetime === true) continue;

    if (!record.expiresAt || Number(record.expiresAt) <= now) {
      delete data.guilds[guildId];
      changed = true;
    }
  }

  if (changed) writeDB(data);
  return data;
}

function getRecord(guildId) {
  const data = cleanupExpired();
  return data.guilds[guildId] || null;
}

function hasPremium(guildId) {
  if (!guildId) return false;
  return Boolean(getRecord(guildId));
}

function parseDuration(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;

  if (["lifetime", "permanent", "perm", "forever"].includes(raw)) {
    return "lifetime";
  }

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(m|h|d|w|mo|month|months)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    mo: 30 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
  };

  const ms = amount * multipliers[unit];
  if (!Number.isFinite(ms) || ms <= 0) return null;

  return ms;
}

function humanDuration(ms) {
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.join(" ") || "<1m";
}

function humanDate(timestamp) {
  if (!timestamp) return "Never";
  return `<t:${Math.floor(Number(timestamp) / 1000)}:F>`;
}

function addPremium(guildId, durationMs, addedBy) {
  if (!guildId || !durationMs) return null;

  const data = cleanupExpired();
  const now = Date.now();
  const old = data.guilds[guildId];
  const lifetime = durationMs === "lifetime" || old?.lifetime === true;

  const base = old && old.lifetime !== true && Number(old.expiresAt) > now
    ? Number(old.expiresAt)
    : now;
  const expiresAt = lifetime ? null : base + Number(durationMs);

  data.guilds[guildId] = {
    guildId,
    active: true,
    lifetime,
    addedAt: old?.addedAt || now,
    expiresAt,
    addedBy: addedBy || old?.addedBy || null,
    updatedAt: now,
  };

  writeDB(data);
  return data.guilds[guildId];
}

function removePremium(guildId) {
  const data = cleanupExpired();
  const existed = Boolean(data.guilds[guildId]);
  delete data.guilds[guildId];
  writeDB(data);
  return existed;
}

function activeGuilds(client) {
  const data = cleanupExpired();
  const now = Date.now();

  return Object.values(data.guilds)
    .filter(r => r?.lifetime === true || Number(r.expiresAt) > now)
    .sort((a, b) => Number(b.expiresAt) - Number(a.expiresAt))
    .map(r => {
      const guild = client?.guilds?.cache?.get(r.guildId);
      return {
        ...r,
        name: guild?.name || `Unknown Server (${r.guildId})`,
        memberCount: guild?.memberCount || 0,
      };
    });
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fit(ctx, text, maxWidth, font) {
  ctx.font = font;
  let value = String(text ?? "");
  while (value.length > 1 && ctx.measureText(value).width > maxWidth) {
    value = value.slice(0, -2) + "…";
  }
  return value;
}

function createBanner({ title, subtitle, rows = [], status = "PREMIUM", footer = "ZEECHEI • PREMIUM CONTROL" }) {
  const width = 1400;
  const height = Math.max(700, 285 + rows.length * 64);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, 0, 10, width / 2, 0, 850);
  glow.addColorStop(0, "rgba(99,216,255,0.25)");
  glow.addColorStop(0.45, "rgba(99,216,255,0.07)");
  glow.addColorStop(1, "rgba(99,216,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 450);

  ctx.fillStyle = PANEL;
  roundedRect(ctx, 30, 30, width - 60, height - 60, 26);
  ctx.fill();

  ctx.strokeStyle = SKY;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = SKY;
  ctx.beginPath();
  ctx.arc(82, 84, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SKY_SOFT;
  ctx.font = "bold 13px Arial";
  ctx.fillText("ZEECHEI PREMIUM", 105, 88);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 42px Arial";
  ctx.fillText(fit(ctx, title, 920, "bold 42px Arial"), 105, 135);

  ctx.fillStyle = MUTED;
  ctx.font = "17px Arial";
  ctx.fillText(fit(ctx, subtitle, 1100, "17px Arial"), 105, 166);

  ctx.textAlign = "right";
  ctx.fillStyle = status === "ACTIVE" || status === "SUCCESS" ? SKY : MUTED;
  ctx.font = "bold 15px Arial";
  ctx.fillText(status, width - 78, 88);
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(99,216,255,0.20)";
  ctx.beginPath();
  ctx.moveTo(75, 205);
  ctx.lineTo(width - 75, 205);
  ctx.stroke();

  let y = 260;
  for (const row of rows) {
    ctx.fillStyle = PANEL_2;
    roundedRect(ctx, 70, y - 38, width - 140, 50, 14);
    ctx.fill();

    ctx.fillStyle = SKY;
    ctx.beginPath();
    ctx.arc(92, y - 13, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = SKY_SOFT;
    ctx.font = "bold 16px Arial";
    ctx.fillText(fit(ctx, row.label, 330, "bold 16px Arial"), 115, y - 8);

    ctx.fillStyle = WHITE;
    ctx.font = "16px Arial";
    ctx.fillText(fit(ctx, row.value, 830, "16px Arial"), 465, y - 8);

    y += 64;
  }

  ctx.strokeStyle = "rgba(99,216,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(75, height - 88);
  ctx.lineTo(width - 75, height - 88);
  ctx.stroke();

  ctx.fillStyle = "#587E8C";
  ctx.font = "bold 12px Arial";
  ctx.fillText(footer, 78, height - 54);

  ctx.textAlign = "right";
  ctx.fillText("SKY BLUE EDITION", width - 78, height - 54);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

function createGuildsBanner(guilds, page, totalPages) {
  const width = 1400;
  const height = 760;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, 0, 10, width / 2, 0, 900);
  glow.addColorStop(0, "rgba(99,216,255,0.24)");
  glow.addColorStop(1, "rgba(99,216,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 430);

  ctx.fillStyle = PANEL;
  roundedRect(ctx, 30, 30, width - 60, height - 60, 26);
  ctx.fill();

  ctx.strokeStyle = SKY;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = SKY;
  ctx.beginPath();
  ctx.arc(82, 84, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = WHITE;
  ctx.font = "bold 42px Arial";
  ctx.fillText("Premium Guilds", 105, 95);

  ctx.fillStyle = MUTED;
  ctx.font = "17px Arial";
  ctx.fillText("All currently active premium servers", 105, 126);

  ctx.textAlign = "right";
  ctx.fillStyle = SKY;
  ctx.font = "bold 16px Arial";
  ctx.fillText(`PAGE ${page + 1} / ${totalPages}`, width - 78, 88);
  ctx.textAlign = "left";

  const cards = guilds.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  cards.forEach((guild, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 70 + col * 660;
    const y = 185 + row * 225;

    ctx.fillStyle = PANEL_2;
    roundedRect(ctx, x, y, 620, 190, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(99,216,255,0.22)";
    ctx.stroke();

    ctx.fillStyle = SKY;
    ctx.font = "bold 14px Arial";
    ctx.fillText(`#${String(page * PAGE_SIZE + index + 1).padStart(2, "0")}`, x + 25, y + 34);

    ctx.fillStyle = WHITE;
    ctx.font = "bold 22px Arial";
    ctx.fillText(fit(ctx, guild.name, 520, "bold 22px Arial"), x + 25, y + 68);

    ctx.fillStyle = SKY_SOFT;
    ctx.font = "15px Arial";
    ctx.fillText(`Guild ID: ${guild.guildId}`, x + 25, y + 98);

    ctx.fillStyle = MUTED;
    ctx.fillText(`Expires: ${new Date(Number(guild.expiresAt)).toLocaleString()}`, x + 25, y + 126);
    ctx.fillText(`Added by: ${guild.addedBy || "Unknown"}`, x + 25, y + 151);
    ctx.fillText(`Members: ${Number(guild.memberCount).toLocaleString("en-US")}`, x + 25, y + 176);
  });

  if (!cards.length) {
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = "22px Arial";
    ctx.fillText("No active premium guilds found.", width / 2, 430);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(99,216,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(75, height - 88);
  ctx.lineTo(width - 75, height - 88);
  ctx.stroke();

  ctx.fillStyle = "#587E8C";
  ctx.font = "bold 12px Arial";
  ctx.fillText("ZEECHEI • PREMIUM GUILD CONTROL", 78, height - 54);

  return canvas.toBuffer("image/png");
}

function attachmentPayload(client, buffer, fileName, components = []) {
  const attachment = new AttachmentBuilder(buffer, { name: fileName });
  const builder = new V2Builder(0x63D8FF).media(`attachment://${fileName}`);
  for (const row of components) builder.row(row);
  const data = builder.build();
  data.files = [attachment];
  return data;
}

function navRow(prefix, userId, page, totalPages, close = true) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:first:${userId}`)
      .setLabel("First")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev:${userId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
  );

  if (close) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}:close:${userId}`)
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:next:${userId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}:last:${userId}`)
      .setLabel("Last")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return row;
}

function guidePayload(client, userId, prefix, activated = null) {
  const rows = activated
    ? [
        { label: "Premium", value: "ACTIVATED" },
        { label: "Server", value: activated.name || activated.guildId },
        { label: "Expires", value: activated.lifetime ? "LIFETIME" : humanDate(activated.expiresAt) },
        { label: "Guide", value: "Premium command guide is ready below" },
      ]
    : [
        { label: `${prefix}premium addtemp`, value: "Activate/extend premium • bot owner only" },
        { label: `${prefix}premium removetemp`, value: "Remove premium • bot owner only" },
        { label: `${prefix}premiumstats`, value: "View premium stats for a server" },
        { label: `${prefix}premiumguilds`, value: "List all active premium guilds • bot owner only" },
      ];

  const components = activated
    ? [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`pguide:open:${userId}`)
            .setLabel("Open Guide")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`pguide:close:${userId}`)
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger),
        ),
      ]
    : [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`pguide:open:${userId}`)
            .setLabel("Commands")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`pguide:close:${userId}`)
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger),
        ),
      ];

  return attachmentPayload(
    client,
    createBanner({
      title: "Premium Guide",
      subtitle: activated
        ? "Premium has been activated successfully"
        : "Zeechei premium control and server commands",
      rows,
      status: activated ? "SUCCESS" : "ACTIVE",
      footer: "ZEECHEI • PREMIUM GUIDE",
    }),
    "premium-guide.png",
    components,
  );
}

function errorPayload(client, title, subtitle, rows, fileName = "premium-error.png") {
  return attachmentPayload(
    client,
    createBanner({
      title,
      subtitle,
      rows,
      status: "ERROR",
      footer: "ZEECHEI • PREMIUM CONTROL",
    }),
    fileName,
  );
}

function statsPayload(client, guild, record) {
  const active = Boolean(record);
  const lifetime = active && record.lifetime === true;
  const remaining = active && !lifetime
    ? Math.max(0, Number(record.expiresAt) - Date.now())
    : 0;

  return attachmentPayload(
    client,
    createBanner({
      title: "Premium Stats",
      subtitle: `${guild.name} • complete premium status`,
      rows: [
        { label: "Status", value: active ? "ACTIVE" : "INACTIVE" },
        { label: "Guild ID", value: guild.id },
        { label: "Added At", value: active ? humanDate(record.addedAt) : "—" },
        { label: "Expires At", value: active ? (lifetime ? "LIFETIME" : humanDate(record.expiresAt)) : "—" },
        { label: "Remaining", value: active ? (lifetime ? "LIFETIME" : humanDuration(remaining)) : "—" },
        { label: "Added By", value: active ? String(record.addedBy || "Unknown") : "—" },
      ],
      status: active ? "ACTIVE" : "INACTIVE",
      footer: "ZEECHEI • PREMIUM STATS",
    }),
    "premium-stats.png",
  );
}

async function resolveGuild(client, id, message) {
  const target = id || message.guild?.id;
  if (!target) return null;

  let guild = client.guilds.cache.get(target);
  if (!guild) {
    guild = await client.guilds.fetch(target).catch(() => null);
  }
  return guild;
}

function getCommandName(message, args) {
  return String(
    message?.commandName ||
    message?.command ||
    args?.[-1] ||
    "",
  ).toLowerCase();
}

module.exports = {
  name: "premium",
  aliases: [
    "premiumaddtemp",
    "premiumremovetemp",
    "premiumstats",
    "premiumguilds",
  ],
  description: "Manage Zeechei server premium access.",
  category: "general",
  usage: "+premium [addtemp|removetemp|stats|guilds]",
  argsRequired: false,
  examples: [
    "+premium",
    "+premium addtemp 123456789012345678 30d",
    "+premium removetemp 123456789012345678",
    "+premiumstats",
    "+premiumguilds",
  ],
  noDefer: true,

  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Manage Zeechei server premium access.")
    .addSubcommand(sub => sub
      .setName("addtemp")
      .setDescription("Activate or extend premium for a server.")
      .addStringOption(opt => opt
        .setName("guild")
        .setDescription("Server ID")
        .setRequired(true))
      .addStringOption(opt => opt
        .setName("duration")
        .setDescription("Examples: 7d, 30d, 12h, 1w, 2mo or lifetime")
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName("removetemp")
      .setDescription("Remove premium from a server.")
      .addStringOption(opt => opt
        .setName("guild")
        .setDescription("Server ID")
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName("stats")
      .setDescription("View premium stats for a server.")
      .addStringOption(opt => opt
        .setName("guild")
        .setDescription("Optional server ID")))
    .addSubcommand(sub => sub
      .setName("guilds")
      .setDescription("List all active premium servers.")),

  getSlashArgs: opts => {
    const sub = opts.options?.getSubcommand?.(false) || "guide";

    if (sub === "addtemp") {
      return [
        "addtemp",
        opts.getString("guild"),
        opts.getString("duration"),
      ];
    }

    if (sub === "removetemp") {
      return ["removetemp", opts.getString("guild")];
    }

    if (sub === "stats") {
      return ["stats", opts.getString("guild") || ""];
    }

    if (sub === "guilds") return ["guilds"];
    return [];
  },

  async execute({ client, message, args = [] }) {
    const command = getCommandName(message, args);
    let action = String(args[0] || "").toLowerCase();

    if (command === "premiumaddtemp") action = "addtemp";
    if (command === "premiumremovetemp") action = "removetemp";
    if (command === "premiumstats") action = "stats";
    if (command === "premiumguilds") action = "guilds";

    const prefix = message.prefix || "+";
    const userId = message.author.id;

    // +premium => interactive guide
    if (!action || action === "guide" || action === "help") {
      const sent = await message.reply(guidePayload(client, userId, prefix));

      const collector = sent.createMessageComponentCollector({
        time: COLLECTOR_TIME,
        filter: i => i.user.id === userId,
      });

      collector.on("collect", async i => {
        if (i.customId === `pguide:close:${userId}`) {
          collector.stop("closed");
          return i.update(attachmentPayload(
            client,
            createBanner({
              title: "Premium Guide Closed",
              subtitle: "No changes were made.",
              rows: [{ label: "Status", value: "CLOSED" }],
              status: "CLOSED",
            }),
            "premium-closed.png",
          ));
        }

        if (i.customId === `pguide:open:${userId}`) {
          return i.update(guidePayload(client, userId, prefix));
        }
      });

      collector.on("end", (_, reason) => {
        if (reason !== "closed") sent.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    if (action === "addtemp") {
      if (!isBotOwner(client, userId)) {
        return message.reply(errorPayload(
          client,
          "Bot Owner Only",
          "Only Zeechei bot owners can grant premium.",
          [
            { label: "Command", value: `${prefix}premium addtemp <guildId> <duration>` },
            { label: "Required", value: "Bot Owner" },
            { label: "Status", value: "ACCESS DENIED" },
          ],
        ));
      }

      const guildId = args[1];
      const duration = parseDuration(args[2]);

      if (!/^\d{17,20}$/.test(String(guildId || ""))) {
        return message.reply(errorPayload(
          client,
          "Invalid Guild ID",
          "A valid Discord server ID is required.",
          [{ label: "Example", value: `${prefix}premium addtemp 123456789012345678 30d` }],
        ));
      }

      if (!duration) {
        return message.reply(errorPayload(
          client,
          "Invalid Duration",
          "Use 7d, 30d, 12h, 1w, 2mo or lifetime.",
          [{ label: "Duration", value: "7d / 30d / 12h / 1w / 2mo / lifetime" }],
        ));
      }

      const guild = await resolveGuild(client, guildId, message);
      const record = addPremium(guildId, duration, userId);

      const activated = {
        ...record,
        name: guild?.name || `Unknown Server (${guildId})`,
      };

      const sent = await message.reply(guidePayload(client, userId, prefix, activated));

      const collector = sent.createMessageComponentCollector({
        time: COLLECTOR_TIME,
        filter: i => i.user.id === userId,
      });

      collector.on("collect", async i => {
        if (i.customId === `pguide:close:${userId}`) {
          collector.stop("closed");
          return i.update(attachmentPayload(
            client,
            createBanner({
              title: "Premium Activated",
              subtitle: `${activated.name} • activation completed`,
              rows: [
                { label: "Status", value: "ACTIVE" },
                { label: "Expires", value: humanDate(record.expiresAt) },
                { label: "Duration Added", value: duration === "lifetime" ? "LIFETIME" : humanDuration(duration) },
              ],
              status: "SUCCESS",
            }),
            "premium-added.png",
          ));
        }

        if (i.customId === `pguide:open:${userId}`) {
          return i.update(guidePayload(client, userId, prefix, activated));
        }
      });

      collector.on("end", (_, reason) => {
        if (reason !== "closed") sent.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    if (action === "removetemp") {
      if (!isBotOwner(client, userId)) {
        return message.reply(errorPayload(
          client,
          "Bot Owner Only",
          "Only Zeechei bot owners can remove premium.",
          [
            { label: "Command", value: `${prefix}premium removetemp <guildId>` },
            { label: "Required", value: "Bot Owner" },
            { label: "Status", value: "ACCESS DENIED" },
          ],
        ));
      }

      const guildId = args[1];
      if (!/^\d{17,20}$/.test(String(guildId || ""))) {
        return message.reply(errorPayload(
          client,
          "Invalid Guild ID",
          "A valid Discord server ID is required.",
          [{ label: "Example", value: `${prefix}premium removetemp 123456789012345678` }],
        ));
      }

      const removed = removePremium(guildId);
      const guild = await resolveGuild(client, guildId, message);

      return message.reply(
        errorPayload(
          client,
          removed ? "Premium Removed" : "Premium Not Found",
          guild ? `${guild.name} • premium status updated` : `Guild ${guildId} • premium status checked`,
          [
            { label: "Guild ID", value: guildId },
            { label: "Status", value: removed ? "REMOVED" : "NO ACTIVE PREMIUM" },
            { label: "Action", value: removed ? "Server premium is now inactive" : "Nothing was changed" },
          ],
          removed ? "premium-removed.png" : "premium-not-found.png",
        ),
      );
    }

    if (action === "stats") {
      const requestedGuildId = args[1] || message.guild?.id;

      if (!requestedGuildId) {
        return message.reply(errorPayload(
          client,
          "Guild Required",
          "Use premiumstats inside a server or provide a guild ID.",
          [{ label: "Example", value: `${prefix}premiumstats <guildId>` }],
        ));
      }

      const guild = await resolveGuild(client, requestedGuildId, message);
      if (!guild) {
        return message.reply(errorPayload(
          client,
          "Server Not Found",
          "Zeechei could not resolve that guild.",
          [{ label: "Guild ID", value: requestedGuildId }],
        ));
      }

      const owner = isBotOwner(client, userId);
      const privileged = guild.id === message.guild?.id && isPrivilegedUser(client, message);

      if (!owner && !privileged) {
        return message.reply(errorPayload(
          client,
          "Access Denied",
          "Premium stats are restricted to the bot owner or this server's privileged users.",
          [
            { label: "Allowed", value: "Bot Owner / Server Owner / Extra Owner / Trusted" },
            { label: "Status", value: "ACCESS DENIED" },
          ],
        ));
      }

      return message.reply(statsPayload(client, guild, getRecord(guild.id)));
    }

    if (action === "guilds") {
      if (!isBotOwner(client, userId)) {
        return message.reply(errorPayload(
          client,
          "Bot Owner Only",
          "The premium guild list is private to Zeechei bot owners.",
          [
            { label: "Command", value: `${prefix}premiumguilds` },
            { label: "Required", value: "Bot Owner" },
            { label: "Status", value: "ACCESS DENIED" },
          ],
        ));
      }

      const all = activeGuilds(client);
      let page = 0;
      const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));

      const render = currentPage => attachmentPayload(
        client,
        createGuildsBanner(all, currentPage, totalPages),
        "premium-guilds.png",
        totalPages > 1 ? [navRow("pguilds", userId, currentPage, totalPages)] : [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`pguilds:close:${userId}`)
              .setLabel("Close")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      );

      const sent = await message.reply(render(page));

      const collector = sent.createMessageComponentCollector({
        time: COLLECTOR_TIME,
        filter: i => i.user.id === userId,
      });

      collector.on("collect", async i => {
        switch (i.customId) {
          case `pguilds:first:${userId}`:
            page = 0;
            break;
          case `pguilds:prev:${userId}`:
            page = Math.max(0, page - 1);
            break;
          case `pguilds:next:${userId}`:
            page = Math.min(totalPages - 1, page + 1);
            break;
          case `pguilds:last:${userId}`:
            page = totalPages - 1;
            break;
          case `pguilds:close:${userId}`:
            collector.stop("closed");
            return i.update(attachmentPayload(
              client,
              createBanner({
                title: "Premium Guilds Closed",
                subtitle: "The premium guild panel has been closed.",
                rows: [{ label: "Active Guilds", value: String(all.length) }],
                status: "CLOSED",
              }),
              "premium-guilds-closed.png",
            ));
          default:
            return;
        }

        await i.update(render(page)).catch(() => {});
      });

      collector.on("end", (_, reason) => {
        if (reason !== "closed") sent.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    return message.reply(errorPayload(
      client,
      "Unknown Premium Command",
      "Choose a supported premium action.",
      [
        { label: "Guide", value: `${prefix}premium` },
        { label: "Add", value: `${prefix}premium addtemp <guildId> <duration>` },
        { label: "Remove", value: `${prefix}premium removetemp <guildId>` },
        { label: "Stats", value: `${prefix}premiumstats [guildId]` },
        { label: "Guilds", value: `${prefix}premiumguilds` },
      ],
    ));
  },

  hasPremium,
  isPrivilegedUser,
  addPremium,
  removePremium,
  getRecord,
  activeGuilds,
};
