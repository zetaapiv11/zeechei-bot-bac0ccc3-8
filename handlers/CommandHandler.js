const fs = require("fs");
const path = require("path");

function loadCommands(client) {
  client.commands = new Map();
  client.aliases  = new Map();

  const categoriesPath = path.join(__dirname, "../commands");
  const categories = fs.readdirSync(categoriesPath);

  for (const cat of categories) {
    const catPath = path.join(categoriesPath, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;

    const files = fs.readdirSync(catPath).filter(f => f.endsWith(".js") && !(cat === "settings" && f === "Shards.js"));
    for (const file of files) {
      try {
        const cmd = require(path.join(catPath, file));
        const commandName = String(cmd.name || cmd.data?.name || "").toLowerCase().trim();
        if (!commandName || typeof cmd.execute !== "function") {
          console.warn(`[Commands] Skipping invalid command: ${cat}/${file}`);
          continue;
        }

        // LEO/Zeechei music commands use SlashCommandBuilder metadata and an
        // interaction-compatible execute() function. Keep Zeechei's existing
        // command architecture untouched for every other category.
        cmd.name = commandName;
        if (cat === "music" && cmd.data) {
          cmd.category = cmd.category || "Music";
          cmd.__zeecheiPoruMusic = true;
        }

        client.commands.set(commandName, cmd);
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            client.aliases.set(String(alias).toLowerCase(), commandName);
          }
        }
      } catch (error) {
        console.error(`[Commands] Failed loading ${cat}/${file}:`, error.message);
      }
    }
  }

  console.log(`[Commands] Loaded ${client.commands.size} commands.`);
}

module.exports = { loadCommands };
