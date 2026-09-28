const { EmbedBuilder } = require("discord.js");
const VM = require("./VoiceMaster");
const VMCommand = require("../commands/voice/voicemaster");

const E = VMCommand.EMOJIS;
const WHITE = 0xffffff;

function reply(interaction, title, body, type = "info") {
  const icon = E[type] || E.info;
  const payload = { embeds: [new EmbedBuilder().setColor(WHITE).setTitle(`${icon} ${title}`).setDescription(body).setFooter({ text: "Zeechei • VoiceMaster" })], ephemeral: true };
  return interaction.reply(payload);
}

function getChannel(interaction) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) throw new Error("Join your VoiceMaster channel first.");
  if (!VM.isManagedChannel(interaction.guildId, channel.id)) throw new Error("This is not an Zeechei VoiceMaster channel.");
  return channel;
}

async function resolveMember(interaction, value) {
  const id = VM.parseMemberId(value);
  if (!id) throw new Error("Use a member mention or user ID.");
  return interaction.guild.members.fetch(id).catch(() => null);
}

async function handleButton(client, interaction) {
  const action = interaction.customId.split(":")[1];
  const channel = getChannel(interaction);
  const owner = VM.ownerId(interaction.guildId, channel.id);

  if (action === "claim") {
    try { return await reply(interaction, "Channel Claim", await VM.claim(channel, interaction.member), "claim"); }
    catch (e) { return reply(interaction, "Cannot Claim", e.message, "error"); }
  }

  if (action === "info") {
    return reply(interaction, "My Channel", `**Channel:** ${channel}\n**Owner:** ${owner ? `<@${owner}>` : "No owner"}\n**Members:** ${channel.members.size}\n**Limit:** ${channel.userLimit || "Unlimited"}\n**Region:** ${channel.rtcRegion || "Automatic"}\n**Bitrate:** ${Math.round(channel.bitrate / 1000)} kbps`, "info");
  }

  if (!owner || owner !== interaction.user.id) return reply(interaction, "Access Denied", "Only the current channel owner can use this control.", "error");

  if (["lock", "unlock", "hide", "unhide"].includes(action)) {
    try { return await reply(interaction, "Channel Updated", await VM.applyChannelAction(channel, action), "success"); }
    catch (e) { return reply(interaction, "Action Failed", e.message, "error"); }
  }

  const modal = VMCommand.buildModal(action);
  if (!modal) return reply(interaction, "Unknown Control", "This VoiceMaster control is unavailable.", "error");
  return interaction.showModal(modal);
}

async function handleModal(client, interaction) {
  const action = interaction.customId.split(":")[1];
  const channel = getChannel(interaction);
  const owner = VM.ownerId(interaction.guildId, channel.id);
  if (!owner || owner !== interaction.user.id) return reply(interaction, "Access Denied", "Only the current channel owner can use this control.", "error");

  const value = interaction.fields.getTextInputValue("value");

  if (action === "rename") {
    const name = value.trim().slice(0, 100);
    if (!name) throw new Error("Channel name cannot be empty.");
    await channel.setName(name, "VoiceMaster owner rename");
    return reply(interaction, "Renamed", `Your channel is now **${name}**.`, "rename");
  }

  if (action === "limit") {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 0 || amount > 99) throw new Error("User limit must be between 0 and 99.");
    await channel.setUserLimit(amount, "VoiceMaster owner limit");
    return reply(interaction, "Limit Updated", `User limit: **${amount === 0 ? "Unlimited" : amount}**.`, "limit");
  }

  if (action === "region") {
    const region = value.trim().toLowerCase();
    const allowed = new Set(["auto", "brazil", "hongkong", "india", "japan", "rotterdam", "russia", "singapore", "southafrica", "sydney", "us-central", "us-east", "us-south", "us-west", "europe"]);
    if (!allowed.has(region)) throw new Error("Unsupported region. Use a Discord-supported region or `auto`.");
    await channel.setRTCRegion(region === "auto" ? null : region, "VoiceMaster owner region");
    return reply(interaction, "Region Updated", `Voice region: **${region === "auto" ? "Automatic" : region}**.`, "region");
  }

  if (action === "bitrate") {
    const kbps = Number(value);
    if (!Number.isInteger(kbps) || kbps < 8 || kbps > 384) throw new Error("Enter a bitrate from 8 to 384 kbps. Server boost limits still apply.");
    await channel.setBitrate(kbps * 1000, "VoiceMaster owner bitrate");
    return reply(interaction, "Bitrate Updated", `Bitrate: **${kbps} kbps**.`, "bitrate");
  }

  const member = await resolveMember(interaction, value);
  if (!member) throw new Error("Member not found.");

  if (action === "transfer") return reply(interaction, "Ownership Transferred", await VM.transfer(channel, owner, member), "transfer");
  return reply(interaction, "VoiceMaster Updated", await VM.applyMemberAction(channel, member, action), "success");
}

async function handle(client, interaction) {
  try {
    if (interaction.isButton() && interaction.customId.startsWith("vm:")) return handleButton(client, interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith("vm_modal:")) return handleModal(client, interaction);
  } catch (error) {
    console.error("[VoiceMaster Interaction]", error);
    const body = String(error?.message || error).slice(0, 500);
    if (interaction.replied || interaction.deferred) return interaction.followUp({ embeds: [new EmbedBuilder().setColor(WHITE).setTitle(`${E.error} VoiceMaster Error`).setDescription(body)], ephemeral: true }).catch(() => {});
    return reply(interaction, "VoiceMaster Error", body, "error");
  }
}

module.exports = { handle };
