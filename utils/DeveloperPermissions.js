const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "developers.json");

/*
 * Zeechei owner/developer access map.
 *
 * Developers receive exactly the selected half of owner commands below.
 * Commands marked mainOwnerOnly are never available to developers.
 */
const DEVELOPER_OWNER_COMMANDS = new Set([
  "botinfo",
  "guilds",
  "userinfo",
  "commandstats",
  "setstatus",
]);

const NEVER_DEVELOPER = new Set([
  "dev",
  "devperm",
  "announce",
  "reload",
  "restart",
  "leave",
  "config",
  "addowner",
  "removeowner",
  "blacklist",
  "noprefix",
  "noprefixpanel",
]);

function ensure() {
  const dir = path.dirname(FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify({ developers: {} }, null, 2),
      "utf8"
    );
  }
}

function read() {
  ensure();

  try {
    const data = JSON.parse(
      fs.readFileSync(FILE, "utf8")
    );

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return { developers: {} };
    }

    if (
      !data.developers ||
      typeof data.developers !== "object" ||
      Array.isArray(data.developers)
    ) {
      data.developers = {};
    }

    return data;
  } catch {
    return { developers: {} };
  }
}

function write(data) {
  ensure();

  const tmp = `${FILE}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(tmp, FILE);
}

function getDeveloper(userId) {
  const data = read();
  const entry = data.developers[String(userId)];

  if (!entry || entry.enabled === false) {
    return null;
  }

  return {
    userId: String(userId),
    ...entry,
  };
}

function isDeveloper(userId) {
  return Boolean(getDeveloper(userId));
}

function developerCanUse(userId, command) {
  const developer = getDeveloper(userId);

  if (!developer) {
    return false;
  }

  const commandName = String(
    command?.name || ""
  ).toLowerCase();

  if (
    command?.mainOwnerOnly ||
    NEVER_DEVELOPER.has(commandName)
  ) {
    return false;
  }

  if (!command?.ownerOnly) {
    return false;
  }

  const custom = Array.isArray(
    developer.allowedCommands
  )
    ? developer.allowedCommands
    : null;

  if (custom) {
    return custom.includes(commandName);
  }

  return DEVELOPER_OWNER_COMMANDS.has(commandName);
}

function addDeveloper(userId, addedBy) {
  const data = read();
  const id = String(userId);

  if (data.developers[id]) {
    return false;
  }

  data.developers[id] = {
    enabled: true,
    allowedCommands: [
      ...DEVELOPER_OWNER_COMMANDS,
    ],
    addedBy: addedBy
      ? String(addedBy)
      : null,
    addedAt: Date.now(),
  };

  write(data);

  return true;
}

function removeDeveloper(userId) {
  const data = read();
  const id = String(userId);

  if (!data.developers[id]) {
    return false;
  }

  delete data.developers[id];

  write(data);

  return true;
}

function setDeveloperPermission(
  userId,
  commandName,
  enabled
) {
  const data = read();
  const id = String(userId);
  const name = String(commandName || "").toLowerCase();

  if (!data.developers[id]) {
    return false;
  }

  if (!DEVELOPER_OWNER_COMMANDS.has(name)) {
    return false;
  }

  let commands = Array.isArray(
    data.developers[id].allowedCommands
  )
    ? data.developers[id].allowedCommands
    : [...DEVELOPER_OWNER_COMMANDS];

  commands = commands
    .map(String)
    .map(v => v.toLowerCase())
    .filter(v => DEVELOPER_OWNER_COMMANDS.has(v));

  if (enabled && !commands.includes(name)) {
    commands.push(name);
  }

  if (!enabled) {
    commands = commands.filter(
      v => v !== name
    );
  }

  data.developers[id].allowedCommands = [
    ...new Set(commands),
  ];

  write(data);

  return true;
}

function setDeveloperEnabled(
  userId,
  enabled
) {
  const data = read();
  const id = String(userId);

  if (!data.developers[id]) {
    return false;
  }

  data.developers[id].enabled = Boolean(
    enabled
  );

  write(data);

  return true;
}

function resetDeveloperPermissions(
  userId
) {
  const data = read();
  const id = String(userId);

  if (!data.developers[id]) {
    return false;
  }

  data.developers[id].allowedCommands = [
    ...DEVELOPER_OWNER_COMMANDS,
  ];

  data.developers[id].enabled = true;

  write(data);

  return true;
}

function getDevelopers() {
  const data = read();

  return Object.entries(
    data.developers
  ).map(([userId, value]) => ({
    userId,
    ...(value || {}),
    enabled: value?.enabled !== false,
    allowedCommands:
      Array.isArray(
        value?.allowedCommands
      )
        ? value.allowedCommands
        : [...DEVELOPER_OWNER_COMMANDS],
  }));
}

module.exports = {
  FILE,
  DEVELOPER_OWNER_COMMANDS,
  NEVER_DEVELOPER,
  isDeveloper,
  getDeveloper,
  developerCanUse,
  addDeveloper,
  removeDeveloper,
  setDeveloperPermission,
  setDeveloperEnabled,
  resetDeveloperPermissions,
  getDevelopers,
};
