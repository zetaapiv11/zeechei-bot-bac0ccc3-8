const {
  AuditLogEvent,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("@napi-rs/canvas");

const SECURITY_ROLE_NAME = "Zeechei Zplus Security";
const DB_PATH = path.join(process.cwd(), "data", "zeechei.json");

const PROTECTION = {
  ban: "antiBan",
  kick: "antiKick",
  bot: "antiBotAdd",
  channelcreate: "antiChannelCreate",
  channeldelete: "antiChannelDelete",
  channelupdate: "antiChannelUpdate",
  rolecreate: "antiRoleCreate",
  roledelete: "antiRoleDelete",
  roleupdate: "antiRoleUpdate",
  webhookcreate: "antiWebhookCreate",
  webhookdelete: "antiWebhookDelete",
  webhookupdate: "antiWebhookUpdate",
  guildupdate: "antiGuildUpdate",
  memberupdate: "antiMemberUpdate",
  prune: "antiPrune",
  everyone: "antiEveryone",
  integration: "antiIntegration",
};

const dangerousRolePermissions = [
  "Administrator",
  "BanMembers",
  "KickMembers",
  "ManageGuild",
  "ManageChannels",
  "ManageRoles",
  "ManageWebhooks",
  "MentionEveryone",
];

const actionNames = new Map([
  [AuditLogEvent.MemberBanAdd, "Member Ban"],
  [AuditLogEvent.MemberKick, "Member Kick"],
  [AuditLogEvent.BotAdd, "Bot Add"],
  [AuditLogEvent.ChannelCreate, "Channel Create"],
  [AuditLogEvent.ChannelDelete, "Channel Delete"],
  [AuditLogEvent.ChannelUpdate, "Channel Update"],
  [AuditLogEvent.RoleCreate, "Role Create"],
  [AuditLogEvent.RoleDelete, "Role Delete"],
  [AuditLogEvent.RoleUpdate, "Role Update"],
  [AuditLogEvent.WebhookCreate, "Webhook Create"],
  [AuditLogEvent.WebhookDelete, "Webhook Delete"],
  [AuditLogEvent.WebhookUpdate, "Webhook Update"],
  [AuditLogEvent.GuildUpdate, "Guild Update"],
  [AuditLogEvent.MemberRoleUpdate, "Member Role Update"],
  [AuditLogEvent.MemberPrune, "Member Prune"],
  [AuditLogEvent.IntegrationCreate, "Integration Create"],
]);

const executorBuckets = new Map();
const auditLocks = new Set();
const installedClients = new WeakSet();

function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      mainOwnerId: "1443804231776862228",
      owners: [],
      developers: {},
      zplusSecurity: {},
    }, null, 2));
  }
}

function readDB() {
  ensureDB();
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid JSON database");
    data.zplusSecurity ||= {};
    return data;
  } catch (error) {
    console.error("[ZEECHEI ZPLUS] DB error:", error);
    return { mainOwnerId: "1443804231776862228", owners: [], developers: {}, zplusSecurity: {} };
  }
}

function writeDB(data) {
  ensureDB();
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DB_PATH);
}

function defaults() {
  return {
    enabled: false,
    roleId: null,
    trusted: [],
    extraOwners: [],
    whitelist: [],
    logs: { enabled: false, channelId: null },
    punishment: { ban: true, kick: false },
    recovery: { channels: true, roles: true },
    protection: {
      antiBan: true,
      antiKick: true,
      antiBotAdd: true,
      antiChannelCreate: true,
      antiChannelDelete: true,
      antiChannelUpdate: true,
      antiRoleCreate: true,
      antiRoleDelete: true,
      antiRoleUpdate: true,
      antiWebhookCreate: true,
      antiWebhookDelete: true,
      antiWebhookUpdate: true,
      antiGuildUpdate: true,
      antiMemberUpdate: true,
      antiPrune: true,
      antiEveryone: true,
      antiIntegration: true,
    },
    thresholds: {
      ban: 1,
      kick: 1,
      botAdd: 1,
      channelCreate: 1,
      channelDelete: 1,
      channelUpdate: 1,
      roleCreate: 1,
      roleDelete: 1,
      roleUpdate: 1,
      webhookCreate: 1,
      webhookDelete: 1,
      webhookUpdate: 1,
      guildUpdate: 1,
      memberUpdate: 1,
      prune: 1,
      integration: 1,
    },
    updatedAt: Date.now(),
  };
}

function getConfig(guildId) {
  const data = readDB();
  const base = defaults();
  const saved = data.zplusSecurity[guildId] || {};
  return {
    ...base,
    ...saved,
    logs: { ...base.logs, ...(saved.logs || {}) },
    punishment: { ...base.punishment, ...(saved.punishment || {}) },
    recovery: { ...base.recovery, ...(saved.recovery || {}) },
    protection: { ...base.protection, ...(saved.protection || {}) },
    thresholds: { ...base.thresholds, ...(saved.thresholds || {}) },
    trusted: Array.isArray(saved.trusted) ? saved.trusted : [],
    extraOwners: Array.isArray(saved.extraOwners) ? saved.extraOwners : [],
    whitelist: Array.isArray(saved.whitelist) ? saved.whitelist : [],
  };
}

function getMainOwnerId() {
  const data = readDB();
  try {
    const config = require("../config");
    return String(data.mainOwnerId || config.mainOwnerId || process.env.MAIN_OWNER_ID || "1443804231776862228");
  } catch {
    return String(data.mainOwnerId || process.env.MAIN_OWNER_ID || "1443804231776862228");
  }
}

function isAuthority(guild, userId, cfg) {
  if (!guild || !userId) return false;
  if (String(userId) === getMainOwnerId()) return true;
  if (String(userId) === String(guild.ownerId)) return true;
  return cfg.extraOwners.includes(String(userId)) || cfg.trusted.includes(String(userId));
}

function isIgnored(guild, userId, cfg) {
  const id = String(userId || "");
  return id === String(guild.ownerId) || id === String(guild.client?.user?.id) ||
    id === getMainOwnerId() || cfg.extraOwners.includes(id) || cfg.trusted.includes(id) || cfg.whitelist.includes(id);
}

function colorOf(client, guildId) {
  try {
    const c = client?.getColor?.(guildId);
    if (typeof c === "number") return `#${c.toString(16).padStart(6, "0").slice(-6)}`;
    if (typeof c === "string" && /^#?[0-9a-f]{6}$/i.test(c)) return c.startsWith("#") ? c : `#${c}`;
  } catch {}
  return "#5865f2";
}

function textFit(value, max = 90) {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function makeBanner({ title, subtitle, lines, color }) {
  const width = 1400;
  const height = Math.max(390, Math.min(1050, 245 + lines.length * 55));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#111522");
  bg.addColorStop(1, "#07080d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(48, 48, width - 96, 7);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, width - 96, height - 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 42px Sans";
  ctx.fillText(textFit(title, 48), 82, 112);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 21px Sans";
  ctx.fillText(textFit(subtitle, 92), 82, 151);
  let y = 218;
  for (const line of lines) {
    if (!line) { y += 18; continue; }
    ctx.fillStyle = color;
    ctx.font = "750 18px Sans";
    ctx.fillText(textFit(line.label, 30), 82, y);
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = "550 19px Sans";
    ctx.fillText(textFit(line.value, 88), 380, y);
    y += 55;
  }
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(82, height - 88);
  ctx.lineTo(width - 82, height - 88);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.50)";
  ctx.font = "600 16px Sans";
  ctx.fillText("Zeechei Zplus Security", 82, height - 56);
  return canvas.toBuffer("image/png");
}

function bannerPayload(client, guild, data) {
  const buffer = makeBanner({ ...data, color: colorOf(client, guild.id) });
  const attachment = new AttachmentBuilder(buffer, { name: "zeechei-zplus-security.png" });
  const container = new ContainerBuilder()
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL("attachment://zeechei-zplus-security.png")))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Zeechei Zplus Security"));
  return { components: [container], files: [attachment], flags: MessageFlags.IsComponentsV2 };
}

async function sendLog(client, guild, title, subtitle, lines) {
  const cfg = getConfig(guild.id);
  if (!cfg.logs.enabled || !cfg.logs.channelId) return;
  const channel = guild.channels.cache.get(cfg.logs.channelId);
  if (!channel?.isTextBased?.()) return;
  try {
    await channel.send(bannerPayload(client, guild, { title, subtitle, lines }));
  } catch (error) {
    console.error("[ZEECHEI ZPLUS] Log error:", error.message);
  }
}

async function auditEntry(guild, type, targetId = null) {
  const lock = `${guild.id}:${type}:${targetId || "guild"}`;
  if (auditLocks.has(lock)) return null;
  auditLocks.add(lock);
  try {
    const entries = await guild.fetchAuditLogs({ type, limit: 8 });
    const now = Date.now();
    for (const entry of entries.entries.values()) {
      if (targetId && entry.target?.id && String(entry.target.id) !== String(targetId)) continue;
      const age = now - entry.createdTimestamp;
      if (age >= 0 && age <= 8000) return entry;
    }
    return null;
  } catch (error) {
    console.error("[ZEECHEI ZPLUS] Audit lookup error:", error.message);
    return null;
  } finally {
    auditLocks.delete(lock);
  }
}

function shouldReact(guild, executorId, moduleKey) {
  const cfg = getConfig(guild.id);
  if (!cfg.enabled || !cfg.protection[moduleKey]) return { ok: false, cfg };
  if (isIgnored(guild, executorId, cfg)) return { ok: false, cfg };
  const key = `${guild.id}:${executorId}:${moduleKey}`;
  const now = Date.now();
  const bucket = executorBuckets.get(key) || [];
  const recent = bucket.filter(t => now - t <= 10000);
  recent.push(now);
  executorBuckets.set(key, recent);
  const threshold = Math.max(1, Number(cfg.thresholds[moduleKey.replace(/^anti/, "").toLowerCase()] || 1));
  return { ok: recent.length >= threshold, cfg };
}

async function punish(guild, executor, reason, cfg) {
  if (!executor || executor.id === guild.client.user.id || isIgnored(guild, executor.id, cfg)) return false;
  let acted = false;
  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me) return false;
  try {
    if (cfg.punishment.ban && me.permissions.has("BanMembers") && guild.members.cache.get(executor.id)?.bannable !== false) {
      await guild.members.ban(executor.id, { reason, deleteMessageSeconds: 0 });
      acted = true;
    } else if (cfg.punishment.kick && me.permissions.has("KickMembers")) {
      await guild.members.kick(executor.id, reason);
      acted = true;
    }
  } catch (error) {
    console.error("[ZEECHEI ZPLUS] Punishment error:", error.message);
  }
  return acted;
}

async function recoverChannel(channel) {
  if (!channel?.guild) return null;
  try {
    const options = {
      name: channel.name || "recovered-channel",
      type: channel.type,
      reason: "Zeechei Zplus Security automatic channel recovery",
    };
    if (channel.parentId) options.parent = channel.parentId;
    if (channel.topic !== undefined) options.topic = channel.topic || undefined;
    if (channel.nsfw !== undefined) options.nsfw = !!channel.nsfw;
    if (channel.rateLimitPerUser !== undefined) options.rateLimitPerUser = channel.rateLimitPerUser;
    if (channel.permissionOverwrites?.cache?.size) {
      options.permissionOverwrites = [...channel.permissionOverwrites.cache.values()].map(x => ({
        id: x.id,
        allow: x.allow.bitfield.toString(),
        deny: x.deny.bitfield.toString(),
        type: x.type,
      }));
    }
    if (channel.bitrate !== undefined) options.bitrate = channel.bitrate;
    if (channel.userLimit !== undefined) options.userLimit = channel.userLimit;
    const restored = await channel.guild.channels.create(options);
    if (channel.rawPosition !== undefined) await restored.setPosition(channel.rawPosition).catch(() => {});
    return restored;
  } catch (error) {
    console.error("[ZEECHEI ZPLUS] Channel recovery error:", error.message);
    return null;
  }
}

async function recoverRole(role) {
  if (!role?.guild) return null;
  try {
    const recreated = await role.guild.roles.create({
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions,
      reason: "Zeechei Zplus Security automatic role recovery",
    });
    const me = role.guild.members.me || await role.guild.members.fetchMe().catch(() => null);
    if (me?.roles?.highest) await recreated.setPosition(Math.min(role.position, me.roles.highest.position - 1)).catch(() => {});
    return recreated;
  } catch (error) {
    console.error("[ZEECHEI ZPLUS] Role recovery error:", error.message);
    return null;
  }
}

async function handleAudit(guild, moduleKey, auditType, targetId, target, recovery) {
  const entry = await auditEntry(guild, auditType, targetId);
  if (!entry?.executor) return;
  const executor = entry.executor;
  const reaction = shouldReact(guild, executor.id, moduleKey);
  if (!reaction.ok) return;
  const cfg = reaction.cfg;
  const actionName = actionNames.get(auditType) || moduleKey;
  const reason = `${actionName} | Zeechei Zplus Security | Untrusted executor`;
  let restored = false;
  if (moduleKey === "antiChannelCreate" && target) {
    restored = await target.delete("Zeechei Zplus Security | Unauthorized channel creation").then(() => true).catch(() => false);
  } else if (moduleKey === "antiRoleCreate" && target) {
    restored = await target.delete("Zeechei Zplus Security | Unauthorized role creation").then(() => true).catch(() => false);
  } else if (moduleKey === "antiWebhookCreate" && entry.target) {
    restored = await entry.target.delete("Zeechei Zplus Security | Unauthorized webhook creation").then(() => true).catch(() => false);
  } else if (moduleKey === "antiWebhookUpdate" && entry.target) {
    restored = await entry.target.delete("Zeechei Zplus Security | Unauthorized webhook update").then(() => true).catch(() => false);
  } else if (recovery && cfg.recovery[recovery] && target) {
    const result = recovery === "channels" ? await recoverChannel(target) : await recoverRole(target);
    restored = !!result;
  }
  const punished = await punish(guild, executor, reason, cfg);
  await sendLog(guild.client, guild, "SECURITY ACTION", "Zeechei Zplus Security blocked a dangerous guild action", [
    { label: "Threat", value: actionName },
    { label: "Executor", value: `${executor.tag || executor.username || executor.id} (${executor.id})` },
    { label: "Punishment", value: punished ? (cfg.punishment.ban ? "Ban" : "Kick") : "Not possible with current hierarchy" },
    { label: "Recovery", value: restored ? "Restored" : "Not required / failed" },
  ]);
}

async function onMessage(message) {
  if (!message.guild || message.author?.bot) return;
  const cfg = getConfig(message.guild.id);
  if (!cfg.enabled || !cfg.protection.antiEveryone || isIgnored(message.guild, message.author.id, cfg)) return;
  if (!message.mentions?.everyone) return;
  try { if (message.deletable) await message.delete(); } catch {}
  const member = message.member;
  if (member?.moderatable) await member.timeout(60 * 60 * 1000, "Zeechei Zplus Security | Mass mention").catch(() => {});
  await sendLog(message.client, message.guild, "MASS MENTION BLOCKED", "Everyone / Here mention protection", [
    { label: "User", value: `${message.author.tag} (${message.author.id})` },
    { label: "Action", value: "Message deleted + 1 hour timeout" },
  ]);
}

async function onMemberJoin(member) {
  if (!member.guild || !member.user?.bot) return;
  const cfg = getConfig(member.guild.id);
  if (!cfg.enabled || !cfg.protection.antiBotAdd) return;
  const entry = await auditEntry(member.guild, AuditLogEvent.BotAdd, member.id);
  if (!entry?.executor || isIgnored(member.guild, entry.executor.id, cfg)) return;
  const punished = await punish(member.guild, entry.executor, "Bot Add | Zeechei Zplus Security | Untrusted executor", cfg);
  await member.kick("Zeechei Zplus Security | Untrusted bot added").catch(() => {});
  await sendLog(member.client, member.guild, "BOT ADD BLOCKED", "Untrusted bot invitation was detected", [
    { label: "Bot", value: `${member.user.tag} (${member.id})` },
    { label: "Executor", value: `${entry.executor.tag || entry.executor.id} (${entry.executor.id})` },
    { label: "Punishment", value: punished ? "Executor punished" : "Hierarchy prevented punishment" },
  ]);
}

async function onMemberRemove(member) {
  if (!member.guild) return;
  const cfg = getConfig(member.guild.id);
  if (!cfg.enabled) return;
  let type = null;
  let moduleKey = null;
  if (cfg.protection.antiKick) {
    type = AuditLogEvent.MemberKick; moduleKey = "antiKick";
  }
  const kick = type ? await auditEntry(member.guild, type, member.id) : null;
  if (kick?.executor) {
    const reaction = shouldReact(member.guild, kick.executor.id, moduleKey);
    if (reaction.ok) {
      const punished = await punish(member.guild, kick.executor, "Member Kick | Zeechei Zplus Security", cfg);
      await sendLog(member.client, member.guild, "KICK BLOCKED", "Untrusted executor detected", [
        { label: "Executor", value: `${kick.executor.tag || kick.executor.id} (${kick.executor.id})` },
        { label: "Target", value: `${member.user?.tag || member.id} (${member.id})` },
        { label: "Punishment", value: punished ? "Ban/Kick applied" : "Punishment unavailable" },
      ]);
    }
  }
  if (cfg.protection.antiPrune) {
    const prune = await auditEntry(member.guild, AuditLogEvent.MemberPrune);
    if (prune?.executor) {
      const reaction = shouldReact(member.guild, prune.executor.id, "antiPrune");
      if (reaction.ok) {
        const punished = await punish(member.guild, prune.executor, "Member Prune | Zeechei Zplus Security", cfg);
        await sendLog(member.client, member.guild, "PRUNE BLOCKED", "Mass member prune detected", [
          { label: "Executor", value: `${prune.executor.tag || prune.executor.id} (${prune.executor.id})` },
          { label: "Punishment", value: punished ? "Executor punished" : "Punishment unavailable" },
        ]);
      }
    }
  }
}

async function onMemberBan(guild, user) {
  const cfg = getConfig(guild.id);
  if (!cfg.enabled || !cfg.protection.antiBan) return;
  const entry = await auditEntry(guild, AuditLogEvent.MemberBanAdd, user.id);
  if (!entry?.executor) return;
  const reaction = shouldReact(guild, entry.executor.id, "antiBan");
  if (!reaction.ok) return;
  await guild.members.unban(user.id, "Zeechei Zplus Security | Revert untrusted ban").catch(() => {});
  const punished = await punish(guild, entry.executor, "Member Ban | Zeechei Zplus Security", cfg);
  await sendLog(guild.client, guild, "BAN BLOCKED", "Untrusted member ban was reverted", [
    { label: "Executor", value: `${entry.executor.tag || entry.executor.id} (${entry.executor.id})` },
    { label: "Target", value: `${user.tag || user.id} (${user.id})` },
    { label: "Punishment", value: punished ? "Executor punished" : "Punishment unavailable" },
  ]);
}

async function onMemberUpdate(oldMember, newMember) {
  const guild = newMember.guild;
  const cfg = getConfig(guild.id);
  if (!cfg.enabled || !cfg.protection.antiMemberUpdate) return;
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const dangerous = added.find(role => dangerousRolePermissions.some(p => role.permissions.has(p)));
  if (!dangerous) return;
  const entry = await auditEntry(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
  if (!entry?.executor) return;
  const reaction = shouldReact(guild, entry.executor.id, "antiMemberUpdate");
  if (!reaction.ok) return;
  await newMember.roles.remove(dangerous, "Zeechei Zplus Security | Dangerous role grant reverted").catch(() => {});
  const punished = await punish(guild, entry.executor, "Member Role Update | Dangerous permission grant", cfg);
  await sendLog(guild.client, guild, "DANGEROUS ROLE GRANT BLOCKED", "A privileged role was granted by an untrusted executor", [
    { label: "Executor", value: `${entry.executor.tag || entry.executor.id} (${entry.executor.id})` },
    { label: "Member", value: `${newMember.user.tag} (${newMember.id})` },
    { label: "Role", value: `${dangerous.name} (${dangerous.id})` },
    { label: "Punishment", value: punished ? "Executor punished" : "Punishment unavailable" },
  ]);
}


async function revertRoleUpdate(before, after) {
  const changes = {};
  if (before.name !== after.name) changes.name = before.name;
  if (before.color !== after.color) changes.color = before.color;
  if (before.hoist !== after.hoist) changes.hoist = before.hoist;
  if (before.mentionable !== after.mentionable) changes.mentionable = before.mentionable;
  if (before.permissions.bitfield !== after.permissions.bitfield) changes.permissions = before.permissions;
  if (!Object.keys(changes).length) return false;
  return after.edit(changes, "Zeechei Zplus Security | Role change recovery").then(() => true).catch(() => false);
}

async function revertChannelUpdate(before, after) {
  const changes = {};
  if (before.name !== after.name) changes.name = before.name;
  if (before.topic !== after.topic && after.topic !== undefined) changes.topic = before.topic || undefined;
  if (before.nsfw !== after.nsfw && after.nsfw !== undefined) changes.nsfw = before.nsfw;
  if (before.rateLimitPerUser !== after.rateLimitPerUser && after.rateLimitPerUser !== undefined) changes.rateLimitPerUser = before.rateLimitPerUser;
  if (before.bitrate !== after.bitrate && after.bitrate !== undefined) changes.bitrate = before.bitrate;
  if (before.userLimit !== after.userLimit && after.userLimit !== undefined) changes.userLimit = before.userLimit;
  if (!Object.keys(changes).length) return false;
  return after.edit(changes, "Zeechei Zplus Security | Channel change recovery").then(() => true).catch(() => false);
}

async function onGuildUpdate(before, after) {
  const cfg = getConfig(after.id);
  if (!cfg.enabled || !cfg.protection.antiGuildUpdate) return;
  const entry = await auditEntry(after, AuditLogEvent.GuildUpdate, after.id);
  if (!entry?.executor) return;
  const reaction = shouldReact(after, entry.executor.id, "antiGuildUpdate");
  if (!reaction.ok) return;
  const changes = {};
  if (before.name !== after.name) changes.name = before.name;
  if (before.verificationLevel !== after.verificationLevel) changes.verificationLevel = before.verificationLevel;
  if (before.defaultMessageNotifications !== after.defaultMessageNotifications) changes.defaultMessageNotifications = before.defaultMessageNotifications;
  if (Object.keys(changes).length) await after.edit(changes, "Zeechei Zplus Security | Guild change recovery").catch(() => {});
  const punished = await punish(after, entry.executor, "Guild Update | Zeechei Zplus Security", cfg);
  await sendLog(after.client, after, "GUILD CHANGE BLOCKED", "Untrusted server setting change detected", [
    { label: "Executor", value: `${entry.executor.tag || entry.executor.id} (${entry.executor.id})` },
    { label: "Recovery", value: Object.keys(changes).length ? "Applied" : "No reversible change" },
    { label: "Punishment", value: punished ? "Executor punished" : "Punishment unavailable" },
  ]);
}

function install(client) {
  if (!client || installedClients.has(client)) return;
  installedClients.add(client);

  client.on("messageCreate", onMessage);
  client.on("guildMemberAdd", onMemberJoin);
  client.on("guildMemberRemove", onMemberRemove);
  client.on("guildMemberUpdate", onMemberUpdate);
  client.on("guildBanAdd", (ban) => onMemberBan(ban.guild, ban.user));
  client.on("guildUpdate", onGuildUpdate);

  client.on("channelCreate", channel => handleAudit(channel.guild, "antiChannelCreate", channel.id, AuditLogEvent.ChannelCreate, channel, null).catch(() => {}));
  client.on("channelDelete", channel => handleAudit(channel.guild, "antiChannelDelete", channel.id, AuditLogEvent.ChannelDelete, channel, "channels").catch(() => {}));
  client.on("channelUpdate", async (before, after) => {
    const cfg = getConfig(after.guild.id);
    if (!cfg.enabled || !cfg.protection.antiChannelUpdate) return;
    const entry = await auditEntry(after.guild, AuditLogEvent.ChannelUpdate, after.id);
    if (!entry?.executor) return;
    const reaction = shouldReact(after.guild, entry.executor.id, "antiChannelUpdate");
    if (!reaction.ok) return;
    const restored = await revertChannelUpdate(before, after);
    const punished = await punish(after.guild, entry.executor, "Channel Update | Zeechei Zplus Security", cfg);
    await sendLog(after.client, after.guild, "CHANNEL CHANGE BLOCKED", "Untrusted channel modification was reverted", [
      { label: "Executor", value: `${entry.executor.tag || entry.executor.id} (${entry.executor.id})` },
      { label: "Channel", value: `${after.name} (${after.id})` },
      { label: "Recovery", value: restored ? "Restored" : "No reversible change" },
      { label: "Punishment", value: punished ? "Executor punished" : "Punishment unavailable" },
    ]);
  });

  client.on("roleCreate", role => handleAudit(role.guild, "antiRoleCreate", role.id, AuditLogEvent.RoleCreate, role, null).catch(() => {}));
  client.on("roleDelete", role => handleAudit(role.guild, "antiRoleDelete", role.id, AuditLogEvent.RoleDelete, role, "roles").catch(() => {}));
  client.on("roleUpdate", async (before, after) => {
    const cfg = getConfig(after.guild.id);
    if (!cfg.enabled || !cfg.protection.antiRoleUpdate || after.name === SECURITY_ROLE_NAME) return;
    const entry = await auditEntry(after.guild, AuditLogEvent.RoleUpdate, after.id);
    if (!entry?.executor) return;
    const reaction = shouldReact(after.guild, entry.executor.id, "antiRoleUpdate");
    if (!reaction.ok) return;
    const restored = await revertRoleUpdate(before, after);
    const punished = await punish(after.guild, entry.executor, "Role Update | Zeechei Zplus Security", cfg);
    await sendLog(after.client, after.guild, "ROLE CHANGE BLOCKED", "Untrusted role modification was reverted", [
      { label: "Executor", value: `${entry.executor.tag || entry.executor.id} (${entry.executor.id})` },
      { label: "Role", value: `${after.name} (${after.id})` },
      { label: "Recovery", value: restored ? "Restored" : "No reversible change" },
      { label: "Punishment", value: punished ? "Executor punished" : "Punishment unavailable" },
    ]);
  });

  client.on("webhookUpdate", channel => {
    Promise.all([
      handleAudit(channel.guild, "antiWebhookCreate", channel.id, AuditLogEvent.WebhookCreate, null, null),
      handleAudit(channel.guild, "antiWebhookDelete", channel.id, AuditLogEvent.WebhookDelete, null, null),
      handleAudit(channel.guild, "antiWebhookUpdate", channel.id, AuditLogEvent.WebhookUpdate, null, null),
    ]).catch(() => {});
  });

  client.on("guildIntegrationsUpdate", guild => handleAudit(guild, "antiIntegration", null, AuditLogEvent.IntegrationCreate, null, null).catch(() => {}));
  console.log("[Zeechei Zplus Security] Runtime installed");
}

module.exports = { install, getConfig, SECURITY_ROLE_NAME, PROTECTION };
