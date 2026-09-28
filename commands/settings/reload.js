const fs   = require("fs");
const path = require("path");
const config = require("../../config");

function findCommandFile(name) {
  const cmdsDir = path.join(__dirname, "../../commands");
  for (const cat of fs.readdirSync(cmdsDir)) {
    const catPath = path.join(cmdsDir, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;
    for (const file of fs.readdirSync(catPath)) {
      if (!file.endsWith(".js")) continue;
      const filePath = path.join(catPath, file);
      try {
        const cmd = require(filePath);
        if (
          cmd.name?.toLowerCase() === name ||
          cmd.aliases?.map(a => a.toLowerCase()).includes(name)
        ) return filePath;
      } catch (_) {}
    }
  }
  return null;
}

async function dmMainOwner(client, content) {
  try {
    const owner = await client.users.fetch(config.mainOwnerId);
    if (owner) await owner.send(content).catch(() => {});
  } catch (_) {}
}

module.exports = {
  name: "reload",
  aliases: ["rl"],
  description: "Reload a single command (main owner only).",
  category: "settings",
  usage: "+reload <command>",
  mainOwnerOnly: true,
  argsRequired: true,

  async execute({ client, message, args }) {
    const { tick, cross, rightsort: R, warning } = client.emoji;
    const color  = client.getColor(message.guild?.id);
    const target = args[0]?.toLowerCase();
    if (!target) return message.reply(client.util.v2msg(color, `${cross} Provide a command name.`));

    const filePath = findCommandFile(target);
    if (!filePath) return message.reply(client.util.v2msg(color, `${cross} Command **\`${target}\`** not found.`));

    // ── DM main owner: reloading started ─────────────────────────────────────
    await dmMainOwner(client,
      client.util.v2msg(client.getColor(null),
        `${warning} **Command Reload Started**\n\n`
        + `${R} **Command:** \`${target}\`\n`
        + `${R} **By:** ${message.author.tag}\n`
        + `${R} **Server:** ${message.guild?.name || "DM"}\n`
        + `-# Reloading from disk...`,
      ),
    );

    try {
      delete require.cache[require.resolve(filePath)];
      const newCmd = require(filePath);

      for (const [k] of client.commands) {
        if (k === target) client.commands.delete(k);
      }
      for (const [alias, cmdName] of client.aliases) {
        if (cmdName === target) client.aliases.delete(alias);
      }

      client.commands.set(newCmd.name.toLowerCase(), newCmd);
      if (newCmd.aliases) {
        for (const alias of newCmd.aliases) {
          client.aliases.set(alias.toLowerCase(), newCmd.name.toLowerCase());
        }
      }

      // ── DM main owner: reload succeeded ──────────────────────────────────
      await dmMainOwner(client,
        client.util.v2msg(client.getColor(null),
          `${tick} **Command Reloaded Successfully**\n\n`
          + `${R} **Command:** \`${newCmd.name}\`\n`
          + `${R} **By:** ${message.author.tag}\n`
          + `-# Hot-reloaded from disk — no restart needed`,
        ),
      );

      return message.reply(client.util.v2msg(color,
        `### ${tick} Command Reloaded\n\n`
        + `${R} **Command:** \`${newCmd.name}\`\n`
        + `-# Hot-reloaded from disk — no restart needed`,
      ));
    } catch (err) {
      // ── DM main owner: reload failed ────────────────────────────────────
      await dmMainOwner(client,
        client.util.v2msg(client.getColor(null),
          `${cross} **Command Reload Failed**\n\n`
          + `${R} **Command:** \`${target}\`\n`
          + `${R} **Error:** \`${err.message}\``,
        ),
      );

      return message.reply(client.util.v2msg(color,
        `### ${cross} Reload Failed\n\n`
        + `${R} **Error:** \`${err.message}\``,
      ));
    }
  },
};
