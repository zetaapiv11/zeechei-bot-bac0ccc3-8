const fs = require("fs");
const path = require("path");
const { ChannelType, PermissionFlagsBits } = require("discord.js");

const DB_PATH = path.join(process.cwd(), "data", "voicemaster.json");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
let cache = null;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
  catch { cache = {}; }
  return cache;
}
function save() { fs.writeFileSync(DB_PATH, JSON.stringify(load(), null, 2)); }
function get(guildId) { return load()[guildId] || null; }
function set(guildId, data) { load()[guildId] = data; save(); return data; }
function remove(guildId) { delete load()[guildId]; save(); }
function isManagedChannel(guildId, channelId) { return !!get(guildId)?.channels?.[channelId]; }
function ownerId(guildId, channelId) { return get(guildId)?.channels?.[channelId] || null; }
function setOwner(guildId, channelId, id) { const data = get(guildId); if (!data) return false; data.channels ||= {}; data.channels[channelId] = id; save(); return true; }
function deleteOwned(guildId, channelId) { const data = get(guildId); if (!data?.channels) return; delete data.channels[channelId]; save(); }
function getOwnedChannel(guildId, userId) {
  const channels = get(guildId)?.channels || {};
  return Object.entries(channels).find(([, owner]) => owner === userId)?.[0] || null;
}
function defaults() {
  return { categoryId: null, lobbyId: null, interfaceChannelId: null, interfaceMessageId: null, channelName: "{user}'s Room", userLimit: 0, channels: {} };
}

async function setup(guild) {
  const data = Object.assign(defaults(), get(guild.id) || {});
  let category = data.categoryId ? guild.channels.cache.get(data.categoryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = await guild.channels.create({ name: "VoiceMaster", type: ChannelType.GuildCategory, reason: "Zeechei VoiceMaster setup" });
    data.categoryId = category.id;
  }
  let lobby = data.lobbyId ? guild.channels.cache.get(data.lobbyId) : null;
  if (!lobby || lobby.type !== ChannelType.GuildVoice) {
    lobby = await guild.channels.create({ name: "Join to Create", type: ChannelType.GuildVoice, parent: category.id, reason: "Zeechei VoiceMaster setup" });
    data.lobbyId = lobby.id;
  }
  let text = data.interfaceChannelId ? guild.channels.cache.get(data.interfaceChannelId) : null;
  if (!text || text.type !== ChannelType.GuildText) {
    text = await guild.channels.create({ name: "voice-interface", type: ChannelType.GuildText, parent: category.id, reason: "Zeechei VoiceMaster interface" });
    data.interfaceChannelId = text.id;
    data.interfaceMessageId = null;
  }
  data.channels ||= {};
  return set(guild.id, data);
}

async function createUserChannel(guild, member, data) {
  const existingId = getOwnedChannel(guild.id, member.id);
  if (existingId) {
    const old = guild.channels.cache.get(existingId);
    if (old) return old;
    deleteOwned(guild.id, existingId);
  }
  const category = guild.channels.cache.get(data.categoryId);
  if (!category) return null;
  const name = String(data.channelName || "{user}'s Room").replace(/\{user\}/gi, member.displayName).slice(0, 100);
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: category.id,
    userLimit: Number(data.userLimit) || 0,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.UseVAD, PermissionFlagsBits.ManageChannels] },
    ],
    reason: "Zeechei VoiceMaster temporary channel",
  });
  setOwner(guild.id, channel.id, member.id);
  return channel;
}

function ownerIsPresent(channel, owner) { return !!owner && channel?.members?.has(owner); }

async function applyChannelAction(channel, action) {
  const everyone = channel.guild.roles.everyone.id;
  if (action === "lock") {
    await channel.permissionOverwrites.edit(everyone, { Connect: false });
    return "The channel is now locked. Existing members can stay, but new members cannot join.";
  }
  if (action === "unlock") {
    await channel.permissionOverwrites.edit(everyone, { Connect: true });
    return "The channel is now unlocked.";
  }
  if (action === "hide") {
    await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
    const owner = ownerId(channel.guild.id, channel.id);
    if (owner) await channel.permissionOverwrites.edit(owner, { ViewChannel: true, Connect: true });
    return "The channel is now hidden.";
  }
  if (action === "unhide") {
    await channel.permissionOverwrites.edit(everyone, { ViewChannel: true });
    return "The channel is visible again.";
  }
  throw new Error("Unknown channel action.");
}

function parseMemberId(value) {
  const m = String(value || "").match(/\d{15,25}/);
  return m ? m[0] : null;
}

async function applyMemberAction(channel, member, action) {
  if (!member) throw new Error("Member not found.");
  if (["mute", "unmute", "deafen", "undeafen"].includes(action) && !channel.members.has(member.id)) {
    throw new Error("That member must be in your voice channel.");
  }
  if (action === "mute") { await member.voice.setMute(true, "VoiceMaster owner action"); return `${member} was muted.`; }
  if (action === "unmute") { await member.voice.setMute(false, "VoiceMaster owner action"); return `${member} was unmuted.`; }
  if (action === "deafen") { await member.voice.setDeaf(true, "VoiceMaster owner action"); return `${member} was deafened.`; }
  if (action === "undeafen") { await member.voice.setDeaf(false, "VoiceMaster owner action"); return `${member} was undeafened.`; }
  if (action === "permit") { await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true, Speak: true }); return `${member} can now join this channel.`; }
  if (action === "ban") { await channel.permissionOverwrites.edit(member.id, { ViewChannel: false, Connect: false }); if (member.voice.channelId === channel.id) await member.voice.disconnect("VoiceMaster ban").catch(() => {}); return `${member} is blocked from this channel.`; }
  if (action === "kick") { if (member.voice.channelId !== channel.id) throw new Error("That member is not in your channel."); await member.voice.disconnect("VoiceMaster kick"); return `${member} was kicked from the channel.`; }
  throw new Error("Unknown member action.");
}

async function transfer(channel, fromId, toMember) {
  if (!toMember) throw new Error("Member not found.");
  if (!channel.members.has(toMember.id)) throw new Error("The new owner must be in your voice channel.");
  if (fromId === toMember.id) throw new Error("You already own this channel.");
  await channel.permissionOverwrites.edit(fromId, { ManageChannels: false });
  await channel.permissionOverwrites.edit(toMember.id, { ViewChannel: true, Connect: true, Speak: true, Stream: true, UseVAD: true, ManageChannels: true });
  setOwner(channel.guild.id, channel.id, toMember.id);
  return `${toMember} is now the channel owner.`;
}

async function claim(channel, member) {
  const current = ownerId(channel.guild.id, channel.id);
  if (!current) { setOwner(channel.guild.id, channel.id, member.id); return "You are now the channel owner."; }
  if (current === member.id) return "You already own this channel.";
  if (ownerIsPresent(channel, current)) throw new Error("The current owner is still in the channel.");
  return transfer(channel, current, member);
}

async function handleVoiceState(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;
  const data = get(guild.id);
  if (!data) return;

  if (newState.channelId === data.lobbyId && oldState.channelId !== data.lobbyId) {
    const channel = await createUserChannel(guild, newState.member, data).catch(err => { console.error("[VoiceMaster] Create failed:", err.message); return null; });
    if (channel) await newState.setChannel(channel).catch(() => {});
  }

  if (oldState.channelId && isManagedChannel(guild.id, oldState.channelId)) {
    const oldChannel = guild.channels.cache.get(oldState.channelId);
    if (oldChannel && oldChannel.members.filter(m => !m.user.bot).size === 0) {
      deleteOwned(guild.id, oldChannel.id);
      await oldChannel.delete("VoiceMaster temporary channel empty").catch(() => {});
    }
  }
}

module.exports = {
  load, save, get, set, remove, defaults, setup, createUserChannel, getOwnedChannel,
  ownerId, setOwner, deleteOwned, isManagedChannel, ownerIsPresent, parseMemberId,
  applyChannelAction, applyMemberAction, transfer, claim, handleVoiceState,
};
