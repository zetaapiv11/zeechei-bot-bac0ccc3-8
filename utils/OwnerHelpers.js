"use strict";

const fs = require("fs");
const path = require("path");

const config = require("../config");

const developerFile = path.resolve(
  process.cwd(),
  config.developerFile || "./data/developers.json"
);

function ensureDeveloperFile() {
  const directory = path.dirname(developerFile);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }

  if (!fs.existsSync(developerFile)) {
    fs.writeFileSync(
      developerFile,
      JSON.stringify(
        {
          developers: {}
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readDevelopers() {
  ensureDeveloperFile();

  try {
    const raw = fs.readFileSync(
      developerFile,
      "utf8"
    );

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object") {
      return {
        developers: {}
      };
    }

    if (!data.developers || typeof data.developers !== "object") {
      data.developers = {};
    }

    return data;
  } catch (error) {
    console.error(
      "[OwnerHelpers] Failed to read developers.json:",
      error.message
    );

    return {
      developers: {}
    };
  }
}

function writeDevelopers(data) {
  ensureDeveloperFile();

  fs.writeFileSync(
    developerFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

/* ------------------------------------------------------- */
/* OWNER CHECKS                                             */
/* ------------------------------------------------------- */

function getConfiguredOwners() {
  const owners = new Set();

  if (config.mainOwnerId) {
    owners.add(String(config.mainOwnerId));
  }

  if (config.ownerId) {
    owners.add(String(config.ownerId));
  }

  if (Array.isArray(config.ownerIds)) {
    for (const id of config.ownerIds) {
      if (!id) continue;
      owners.add(String(id));
    }
  }

  return [...owners];
}

function isMainOwner(userId) {
  if (!userId) return false;

  return (
    String(userId) ===
    String(config.mainOwnerId || "")
  );
}

function isOwner(userId) {
  if (!userId) return false;

  return getConfiguredOwners().includes(
    String(userId)
  );
}

/* ------------------------------------------------------- */
/* DEVELOPERS                                               */
/* ------------------------------------------------------- */

function getDevelopers() {
  const data = readDevelopers();

  return Object.entries(data.developers)
    .filter(
      ([, developer]) =>
        developer &&
        developer.enabled !== false
    )
    .map(([userId, developer]) => ({
      userId,
      ...developer
    }));
}

function getDeveloper(userId) {
  if (!userId) return null;

  const data = readDevelopers();

  const developer =
    data.developers[String(userId)];

  if (
    !developer ||
    developer.enabled === false
  ) {
    return null;
  }

  return {
    userId: String(userId),
    ...developer
  };
}

function isDeveloper(userId) {
  return Boolean(getDeveloper(userId));
}

/* ------------------------------------------------------- */
/* DEVELOPER COMMAND PERMISSIONS                            */
/* ------------------------------------------------------- */

function getDeveloperCommands(userId) {
  const developer = getDeveloper(userId);

  if (!developer) {
    return [];
  }

  if (!Array.isArray(developer.allowedCommands)) {
    return [];
  }

  return developer.allowedCommands.map(command =>
    String(command).toLowerCase()
  );
}

function developerCanUse(
  userId,
  commandName
) {
  if (!userId || !commandName) {
    return false;
  }

  const commands =
    getDeveloperCommands(userId);

  return commands.includes(
    String(commandName).toLowerCase()
  );
}

/* ------------------------------------------------------- */
/* ADD / REMOVE                                             */
/* ------------------------------------------------------- */

function addDeveloper(
  userId,
  addedBy,
  allowedCommands = []
) {
  if (!userId) {
    return {
      success: false,
      reason: "INVALID_USER"
    };
  }

  const data = readDevelopers();

  const id = String(userId);

  if (isMainOwner(id)) {
    return {
      success: false,
      reason: "MAIN_OWNER"
    };
  }

  if (data.developers[id]) {
    return {
      success: false,
      reason: "ALREADY_DEVELOPER"
    };
  }

  data.developers[id] = {
    enabled: true,
    addedBy: String(addedBy || ""),
    addedAt: Date.now(),
    allowedCommands:
      Array.isArray(allowedCommands)
        ? allowedCommands.map(command =>
            String(command).toLowerCase()
          )
        : []
  };

  writeDevelopers(data);

  return {
    success: true,
    developer: data.developers[id]
  };
}

function removeDeveloper(userId) {
  if (!userId) {
    return {
      success: false,
      reason: "INVALID_USER"
    };
  }

  const data = readDevelopers();

  const id = String(userId);

  if (!data.developers[id]) {
    return {
      success: false,
      reason: "NOT_DEVELOPER"
    };
  }

  delete data.developers[id];

  writeDevelopers(data);

  return {
    success: true
  };
}

/* ------------------------------------------------------- */
/* PERMISSION MANAGEMENT                                    */
/* ------------------------------------------------------- */

function grantDeveloperCommand(
  userId,
  commandName
) {
  const data = readDevelopers();

  const id = String(userId);

  if (!data.developers[id]) {
    return {
      success: false,
      reason: "NOT_DEVELOPER"
    };
  }

  const command =
    String(commandName).toLowerCase();

  if (
    !Array.isArray(
      data.developers[id].allowedCommands
    )
  ) {
    data.developers[id].allowedCommands = [];
  }

  if (
    data.developers[id].allowedCommands.includes(
      command
    )
  ) {
    return {
      success: false,
      reason: "ALREADY_GRANTED"
    };
  }

  data.developers[id].allowedCommands.push(
    command
  );

  writeDevelopers(data);

  return {
    success: true
  };
}

function revokeDeveloperCommand(
  userId,
  commandName
) {
  const data = readDevelopers();

  const id = String(userId);

  if (!data.developers[id]) {
    return {
      success: false,
      reason: "NOT_DEVELOPER"
    };
  }

  const command =
    String(commandName).toLowerCase();

  const current =
    Array.isArray(
      data.developers[id].allowedCommands
    )
      ? data.developers[id].allowedCommands
      : [];

  if (!current.includes(command)) {
    return {
      success: false,
      reason: "NOT_GRANTED"
    };
  }

  data.developers[id].allowedCommands =
    current.filter(
      item => item !== command
    );

  writeDevelopers(data);

  return {
    success: true
  };
}

function resetDeveloperPermissions(
  userId,
  defaultCommands = []
) {
  const data = readDevelopers();

  const id = String(userId);

  if (!data.developers[id]) {
    return {
      success: false,
      reason: "NOT_DEVELOPER"
    };
  }

  data.developers[id].allowedCommands =
    Array.isArray(defaultCommands)
      ? defaultCommands.map(command =>
          String(command).toLowerCase()
        )
      : [];

  writeDevelopers(data);

  return {
    success: true
  };
}

/* ------------------------------------------------------- */
/* EXPORTS                                                  */
/* ------------------------------------------------------- */

module.exports = {
  config,

  developerFile,

  getConfiguredOwners,

  isMainOwner,
  isOwner,

  getDevelopers,
  getDeveloper,
  isDeveloper,

  getDeveloperCommands,
  developerCanUse,

  addDeveloper,
  removeDeveloper,

  grantDeveloperCommand,
  revokeDeveloperCommand,
  resetDeveloperPermissions
};