const fs = require("fs");
const path = require("path");
const config = require("../config");

const FILE = path.resolve(process.cwd(), config.developerFile || "./data/developers.json");

function ensure() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ developers: {} }, null, 2));
}

function read() {
  ensure();
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return { developers: {} }; }
}

function write(data) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

function isMainOwner(id) {
  return String(id || "") === String(config.mainOwnerId || "");
}

function isOwner(id, Database) {
  const uid = String(id || "");
  const owners = Array.isArray(config.ownerIds) ? config.ownerIds.map(String) : [];
  if (isMainOwner(uid) || owners.includes(uid) || uid === String(config.ownerId || "")) return true;
  try {
    return Boolean(Database && typeof Database.isOwner === "function" && Database.isOwner(uid));
  } catch { return false; }
}

function getDevelopers() {
  const data = read();
  return Object.entries(data.developers || {})
    .filter(([, d]) => d && d.enabled !== false)
    .map(([userId, d]) => ({ userId, ...d }));
}

function getDeveloper(id) {
  const d = read().developers?.[String(id)];
  return d && d.enabled !== false ? { userId: String(id), ...d } : null;
}

function addDeveloper(id, addedBy, commands) {
  const data = read();
  id = String(id);
  if (data.developers[id]) return false;
  data.developers[id] = {
    enabled: true,
    addedBy: String(addedBy || ""),
    addedAt: Date.now(),
    allowedCommands: commands
  };
  write(data);
  return true;
}

function removeDeveloper(id) {
  const data = read();
  id = String(id);
  if (!data.developers[id]) return false;
  delete data.developers[id];
  write(data);
  return true;
}

function developerCanUse(id, commandName) {
  const d = getDeveloper(id);
  return Boolean(d && Array.isArray(d.allowedCommands) &&
    d.allowedCommands.includes(String(commandName || "").toLowerCase()));
}

module.exports = {
  isMainOwner, isOwner, getDevelopers, getDeveloper,
  addDeveloper, removeDeveloper, developerCanUse
};
