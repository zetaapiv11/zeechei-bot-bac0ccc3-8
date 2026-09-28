const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");
const config = require("../../config");
const Database = require("../../database/Database");
const { getDevelopers } = require("../../utils/DeveloperPermissions");

const WIDTH = 1400;
const CARD_W = 300;
const CARD_H = 150;
const GAP = 20;
const LEFT = 60;
const imageCache = new Map();

function safe(v, fallback = "Unknown") {
  if (v === undefined || v === null || v === "") return fallback;
  return String(v).replace(/@/g, "@\u200b").replace(/[\r\n]+/g, " ");
}
function owners() {
  const ids = [config.mainOwnerId, config.ownerId, ...(config.ownerIds || [])];
  try { ids.push(...(Database.getOwners?.() || [])); } catch {}
  return [...new Set(ids.filter(Boolean).map(String))];
}
function mainOwner() { return String(config.mainOwnerId || config.ownerId || ""); }
function getTeamConfig() {
  const team = config.team || config.teamInfo || config.bot?.team || {};
  return {
    name: team.name || team.title || "ZEECHEI DEVELOPMENT",
    description: team.description || team.bio || "The people behind Zeechei Music.",
    logo: team.logo || team.logoURL || team.logoUrl || team.icon || team.iconURL,
    banner: team.banner || team.bannerURL || team.bannerUrl,
    members: Array.isArray(team.members) ? team.members : [],
  };
}
async function user(id, client) {
  try { return await client.users.fetch(String(id)); } catch { return null; }
}
async function image(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  try { const i = await loadImage(url); imageCache.set(url, i); return i; } catch { return null; }
}
function round(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function fill(ctx,x,y,w,h,r,c){round(ctx,x,y,w,h,r);ctx.fillStyle=c;ctx.fill();}
function text(ctx,v,x,y,size,c="#fff",weight="500",align="left"){ctx.font=`${weight} ${size}px Arial`;ctx.fillStyle=c;ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(safe(v),x,y);}
async function drawCard(ctx, member, x, y, role, client) {
  fill(ctx,x,y,CARD_W,CARD_H,20,"#0B0B11");
  ctx.strokeStyle = role === "Owner" || role === "Lead Owner" ? "#8B5CF6" : "#242431";
  ctx.lineWidth = 1.5; round(ctx,x,y,CARD_W,CARD_H,20); ctx.stroke();

  const avatar = await image(member.displayAvatarURL({ extension:"png", size:128 }));
  if (avatar) { ctx.save(); ctx.beginPath(); ctx.arc(x+72,y+75,43,0,Math.PI*2);ctx.clip();ctx.drawImage(avatar,x+29,y+32,86,86);ctx.restore(); }
  else { fill(ctx,x+29,y+32,86,86,43,"#191923"); text(ctx,"?",x+72,y+75,30,"#777784","800","center"); }

  text(ctx, member.globalName || member.username, x+135,y+48,19,"#F4F4F5","800");
  text(ctx, `@${member.username}`, x+135,y+76,13,"#777784","500");
  text(ctx, role, x+135,y+105,14,role.includes("Owner") ? "#A78BFA" : "#B8B8C5","800");
  text(ctx,"ACTIVE",x+135,y+130,10,"#22C55E","800");
}

async function createTeamCard(client) {
  const team = getTeamConfig();
  const ownerIds = owners();
  const devEntries = getDevelopers().filter(d => d.enabled);

  const configured = team.members.map(m => typeof m === "string" ? {id:m,role:"Developer"} : m).filter(Boolean);
  const ownerMembers = [];
  for (const id of ownerIds) {
    const u = await user(id, client);
    if (u) ownerMembers.push({u, role: String(id) === mainOwner() ? "Lead Owner" : "Owner"});
  }
  const devMembers = [];
  for (const d of devEntries) {
    if (ownerIds.includes(String(d.userId))) continue;
    const u = await user(d.userId, client);
    if (u) devMembers.push({u, role:"Developer"});
  }
  for (const m of configured) {
    const id = String(m.id || m.userId || m.discordId || "");
    if (!id || ownerIds.includes(id) || devMembers.some(x=>x.u.id===id)) continue;
    const u = await user(id, client);
    if (u) devMembers.push({u, role:m.role || "Developer"});
  }

  const total = ownerMembers.length + devMembers.length;
  const rows = Math.max(1, Math.ceil(Math.max(ownerMembers.length, devMembers.length) / 4));
  const sectionGap = 105;
  const height = Math.max(650, 245 + (rows * (CARD_H+GAP)) * 2 + sectionGap);
  const canvas = createCanvas(WIDTH,height); const ctx=canvas.getContext("2d");

  const bg=ctx.createLinearGradient(0,0,WIDTH,height);bg.addColorStop(0,"#020203");bg.addColorStop(.5,"#06060A");bg.addColorStop(1,"#0A0710");ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,height);
  fill(ctx,25,25,WIDTH-50,height-50,28,"#07070C");ctx.strokeStyle="#1A1A24";ctx.lineWidth=2;round(ctx,25,25,WIDTH-50,height-50,28);ctx.stroke();
  if(team.banner){const b=await image(team.banner);if(b){ctx.save();round(ctx,45,45,WIDTH-90,180,24);ctx.clip();ctx.globalAlpha=.28;ctx.drawImage(b,45,45,WIDTH-90,180);ctx.restore();}}
  fill(ctx,45,45,WIDTH-90,180,24,"rgba(4,4,8,.68)");
  text(ctx,"ZEECHEI MUSIC",75,78,11,"#A78BFA","900");text(ctx,team.name,75,120,38,"#F4F4F5","900");text(ctx,team.description,75,155,15,"#B8B8C5","500");text(ctx,`${total} ACTIVE TEAM PROFILES`,WIDTH-75,120,13,"#666675","800","right");

  let y=270;
  text(ctx,"OWNERS",LEFT,y,14,"#A78BFA","900");ctx.strokeStyle="#8B5CF6";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(145,y);ctx.lineTo(WIDTH-LEFT,y);ctx.stroke();y+=32;
  const ownerStart=y;
  if(!ownerMembers.length) text(ctx,"No owners found",LEFT,y+45,16,"#666675","600");
  for(let i=0;i<ownerMembers.length;i++){const col=i%4,row=Math.floor(i/4);await drawCard(ctx,ownerMembers[i].u,LEFT+col*(CARD_W+GAP),ownerStart+row*(CARD_H+GAP),ownerMembers[i].role,client);}
  const ownerRows=Math.max(1,Math.ceil(ownerMembers.length/4));
  y=ownerStart+ownerRows*(CARD_H+GAP)+30;
  text(ctx,"DEVELOPERS",LEFT,y,14,"#A78BFA","900");ctx.strokeStyle="#8B5CF6";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(175,y);ctx.lineTo(WIDTH-LEFT,y);ctx.stroke();y+=32;
  if(!devMembers.length) text(ctx,"No developers added yet",LEFT,y+45,16,"#666675","600");
  for(let i=0;i<devMembers.length;i++){const col=i%4,row=Math.floor(i/4);await drawCard(ctx,devMembers[i].u,LEFT+col*(CARD_W+GAP),y+row*(CARD_H+GAP),devMembers[i].role,client);}
  const devRows=Math.max(1,Math.ceil(devMembers.length/4));
  const footer=y+devRows*(CARD_H+GAP)+25;
  ctx.strokeStyle="#17171F";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(LEFT,footer);ctx.lineTo(WIDTH-LEFT,footer);ctx.stroke();text(ctx,"ZEECHEI",LEFT,footer+27,10,"#555561","800");text(ctx,"TEAM DIRECTORY",WIDTH/2,footer+27,9,"#3D3D47","800","center");text(ctx,"LIVE",WIDTH-LEFT,footer+27,9,"#22C55E","800","right");
  return canvas.toBuffer("image/png");
}

module.exports={
  name:"team",aliases:["teaminfo","developers","devs","staff"],category:"settings",description:"Display Zeechei owners and developers separately.",usage:"team",argsRequired:false,
  data:new SlashCommandBuilder().setName("team").setDescription("Display the Zeechei development team."),
  getSlashArgs:()=>[],
  async execute({client,message}){const b=await createTeamCard(client);return message.reply({files:[new AttachmentBuilder(b,{name:"zeechei-team.png"})]});},
  async executeSlash(interaction,client){const b=await createTeamCard(client);return interaction.reply({files:[new AttachmentBuilder(b,{name:"zeechei-team.png"})]});},
};
