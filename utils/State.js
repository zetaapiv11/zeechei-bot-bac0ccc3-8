/** Shared in-memory state — 247 guilds are seeded from the DB on startup */
const Database = require("../database/Database");

const enabled247 = new Set(Database.getAll247Guilds());

module.exports = { enabled247 };
