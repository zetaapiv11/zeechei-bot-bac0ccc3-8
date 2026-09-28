const {
  AttachmentBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const {
  createCanvas,
} = require("@napi-rs/canvas");

const fs = require("fs");
const path = require("path");

const V2BuilderModule = require("../../utils/V2Builder");
const V2Builder =
  V2BuilderModule?.V2Builder ||
  (typeof V2BuilderModule === "function" ? V2BuilderModule : null);

if (typeof V2Builder !== "function") {
  throw new TypeError(
    "V2Builder export is invalid. Expected { V2Builder } or a constructor."
  );
}

const DEV_PERMISSIONS = [
  "music",
  "general",
  "moderation",
  "utility",
  "special",
];

const DATA_DIR = path.join("/home/container", "data");
const DEVELOPERS_FILE = path.join(DATA_DIR, "developers.json");

function ensureDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true,
      });
    }

    if (!fs.existsSync(DEVELOPERS_FILE)) {
      fs.writeFileSync(
        DEVELOPERS_FILE,
        JSON.stringify(
          {
            developers: {},
          },
          null,
          2
        ),
        "utf8"
      );
    }
  } catch (error) {
    console.error(
      "[DEVCONFIG] Failed to initialize developers storage:",
      error
    );
  }
}

function readDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(DEVELOPERS_FILE, "utf8");

    if (!raw.trim()) {
      return {
        developers: {},
      };
    }

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object") {
      return {
        developers: {},
      };
    }

    if (!data.developers || typeof data.developers !== "object") {
      data.developers = {};
    }

    return data;
  } catch (error) {
    console.error(
      "[DEVCONFIG] Failed to read developers storage:",
      error
    );

    return {
      developers: {},
    };
  }
}

function writeDatabase(data) {
  ensureDatabase();

  try {
    fs.writeFileSync(
      DEVELOPERS_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error(
      "[DEVCONFIG] Failed to write developers storage:",
      error
    );

    return false;
  }
}

function getMainOwnerIds() {
  const ids = new Set();

  const envValues = [
    process.env.MAIN_OWNER_ID,
    process.env.OWNER_ID,
    process.env.MAIN_OWNER,
    process.env.DEVELOPER_OWNER_ID,
  ];

  for (const value of envValues) {
    if (!value) continue;

    for (const id of String(value).split(",")) {
      const clean = id.trim();

      if (/^\d{15,25}$/.test(clean)) {
        ids.add(clean);
      }
    }
  }

  const ownerList = [
    process.env.OWNER_IDS,
    process.env.MAIN_OWNER_IDS,
    process.env.DEVELOPERS,
  ];

  for (const value of ownerList) {
    if (!value) continue;

    for (const id of String(value).split(",")) {
      const clean = id.trim();

      if (/^\d{15,25}$/.test(clean)) {
        ids.add(clean);
      }
    }
  }

  const configPaths = [
    path.join("/home/container", "config.js"),
    path.join("/home/container", "config.json"),
    path.join("/home/container", "src", "config.js"),
    path.join("/home/container", "src", "config.json"),
    path.join("/home/container", "utils", "config.js"),
    path.join("/home/container", "utils", "config.json"),
  ];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;

      if (configPath.endsWith(".json")) {
        const config = JSON.parse(
          fs.readFileSync(configPath, "utf8")
        );

        collectOwnerIds(config, ids);
      } else {
        const config = require(configPath);
        collectOwnerIds(config, ids);
      }
    } catch (_) {}
  }

  return ids;
}

function collectOwnerIds(object, ids) {
  if (!object || typeof object !== "object") return;

  const possibleKeys = [
    "owner",
    "ownerId",
    "ownerID",
    "mainOwner",
    "mainOwnerId",
    "mainOwnerID",
    "owners",
    "ownerIds",
    "ownerIDs",
    "mainOwners",
    "mainOwnerIds",
    "mainOwnerIDs",
  ];

  for (const key of possibleKeys) {
    const value = object[key];

    if (!value) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        const id = String(item).trim();

        if (/^\d{15,25}$/.test(id)) {
          ids.add(id);
        }
      }

      continue;
    }

    const id = String(value).trim();

    if (/^\d{15,25}$/.test(id)) {
      ids.add(id);
    }

    if (typeof value === "string" && value.includes(",")) {
      for (const item of value.split(",")) {
        const splitId = item.trim();

        if (/^\d{15,25}$/.test(splitId)) {
          ids.add(splitId);
        }
      }
    }
  }

  for (const value of Object.values(object)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      collectOwnerIds(value, ids);
    }
  }
}

function isMainOwner(userId) {
  if (!userId) return false;

  const ownerIds = getMainOwnerIds();

  return ownerIds.has(String(userId));
}

function normalizeDeveloper(developer) {
  if (!developer || typeof developer !== "object") {
    return null;
  }

  if (!developer.permissions || typeof developer.permissions !== "object") {
    developer.permissions = {};
  }

  for (const permission of DEV_PERMISSIONS) {
    developer.permissions[permission] =
      Boolean(developer.permissions[permission]);
  }

  developer.enabled =
    developer.enabled === undefined
      ? true
      : Boolean(developer.enabled);

  return developer;
}

function getDeveloper(userId) {
  const db = readDatabase();

  return normalizeDeveloper(
    db.developers[String(userId)]
  );
}

function isDeveloper(userId) {
  return Boolean(getDeveloper(userId));
}

function createDeveloper(userId) {
  const db = readDatabase();

  const id = String(userId);

  if (db.developers[id]) {
    return false;
  }

  db.developers[id] = {
    userId: id,
    enabled: true,
    permissions: {
      music: false,
      general: false,
      moderation: false,
      utility: false,
      special: false,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return writeDatabase(db);
}

function setDeveloperPermission(
  userId,
  permission,
  enabled
) {
  const db = readDatabase();

  const id = String(userId);

  if (!db.developers[id]) {
    return false;
  }

  if (
    !db.developers[id].permissions ||
    typeof db.developers[id].permissions !== "object"
  ) {
    db.developers[id].permissions = {};
  }

  db.developers[id].permissions[permission] =
    Boolean(enabled);

  db.developers[id].updatedAt = Date.now();

  return writeDatabase(db);
}

function setDeveloperEnabled(userId, enabled) {
  const db = readDatabase();

  const id = String(userId);

  if (!db.developers[id]) {
    return false;
  }

  db.developers[id].enabled =
    Boolean(enabled);

  db.developers[id].updatedAt = Date.now();

  return writeDatabase(db);
}

function resetDeveloperPermissions(userId) {
  const db = readDatabase();

  const id = String(userId);

  if (!db.developers[id]) {
    return false;
  }

  db.developers[id].permissions = {
    music: false,
    general: false,
    moderation: false,
    utility: false,
    special: false,
  };

  db.developers[id].updatedAt = Date.now();

  return writeDatabase(db);
}

function addDeveloper(userId) {
  if (isDeveloper(userId)) {
    return false;
  }

  return createDeveloper(userId);
}

function removeDeveloper(userId) {
  const db = readDatabase();

  const id = String(userId);

  if (!db.developers[id]) {
    return false;
  }

  delete db.developers[id];

  return writeDatabase(db);
}

function truncate(text, max = 48) {
  text = String(text ?? "");

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 3)}...`;
}

function getColor(client, guildId) {
  try {
    if (
      client &&
      typeof client.getColor === "function"
    ) {
      return client.getColor(guildId) || "#ff0000";
    }
  } catch (_) {}

  return "#ff0000";
}

function createBanner({
  title,
  subtitle = "",
  lines = [],
  color = "#ff0000",
  width = 1100,
  height = 620,
}) {
  const canvas = createCanvas(
    width,
    height
  );

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#080808";
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.fillStyle = "#101010";
  ctx.fillRect(
    25,
    25,
    width - 50,
    height - 50
  );

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.strokeRect(
    25,
    25,
    width - 50,
    height - 50
  );

  ctx.fillStyle = color;

  ctx.fillRect(
    25,
    25,
    width - 50,
    8
  );

  ctx.font = "bold 38px Arial";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    truncate(title, 40),
    60,
    90
  );

  if (subtitle) {
    ctx.font = "22px Arial";
    ctx.fillStyle = "#aaaaaa";

    ctx.fillText(
      truncate(subtitle, 70),
      60,
      128
    );
  }

  let y = 180;

  for (const line of lines) {
    if (y > height - 70) {
      break;
    }

    if (typeof line === "string") {
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#ffffff";

      ctx.fillText(
        truncate(line, 70),
        60,
        y
      );

      y += 42;
      continue;
    }

    const label = truncate(
      line.label ?? "",
      28
    );

    const value = truncate(
      line.value ?? "",
      58
    );

    ctx.font = "bold 22px Arial";
    ctx.fillStyle = color;

    ctx.fillText(
      label,
      60,
      y
    );

    ctx.font = "22px Arial";
    ctx.fillStyle = "#dddddd";

    ctx.fillText(
      value,
      350,
      y
    );

    y += 42;
  }

  ctx.font = "18px Arial";
  ctx.fillStyle = "#666666";

  ctx.fillText(
    "Zeechei Developer Configuration",
    60,
    height - 55
  );

  return canvas.toBuffer("image/png");
}

function buildBanner(
  client,
  message,
  data
) {
  const color = getColor(
    client,
    message?.guild?.id
  );

  const buffer = createBanner({
    ...data,
    color,
  });

  const attachment =
    new AttachmentBuilder(buffer, {
      name: "devconfig-response.png",
    });

  return new V2Builder(color)
    .media(
      "attachment://devconfig-response.png"
    )
    .build([attachment]);
}

function getUserId(args) {
  const raw = args[1];

  if (!raw) {
    return null;
  }

  const mention =
    String(raw).match(
      /^<@!?(\d+)>$/
    );

  if (mention) {
    return mention[1];
  }

  if (
    /^\d{15,25}$/.test(
      String(raw)
    )
  ) {
    return String(raw);
  }

  return null;
}

module.exports = {
  name: "devconfig",

  aliases: [
    "devcfg",
    "developerconfig",
  ],

  description:
    "Configure developer permissions",

  category: "general",

  usage:
    "devconfig <addperm|removeperm|permissions|enable|disable|reset> [user] [permission]",

  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("devconfig")
    .setDescription(
      "Configure developer permissions"
    )

    .addStringOption(
      option =>
        option
          .setName("action")
          .setDescription(
            "Configuration action"
          )
          .setRequired(true)
          .addChoices(
            {
              name: "Add Permission",
              value: "addperm",
            },
            {
              name: "Remove Permission",
              value: "removeperm",
            },
            {
              name: "Permissions",
              value: "permissions",
            },
            {
              name: "Enable",
              value: "enable",
            },
            {
              name: "Disable",
              value: "disable",
            },
            {
              name: "Reset",
              value: "reset",
            }
          )
    )

    .addStringOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Developer user ID or mention"
          )
          .setRequired(false)
    )

    .addStringOption(
      option =>
        option
          .setName("permission")
          .setDescription(
            "Permission category"
          )
          .setRequired(false)
          .addChoices(
            {
              name: "Music",
              value: "music",
            },
            {
              name: "General",
              value: "general",
            },
            {
              name: "Moderation",
              value: "moderation",
            },
            {
              name: "Utility",
              value: "utility",
            },
            {
              name: "Special",
              value: "special",
            }
          )
    ),

  getSlashArgs(interaction) {
    const action =
      interaction.options.getString(
        "action"
      );

    const user =
      interaction.options.getString(
        "user"
      );

    const permission =
      interaction.options.getString(
        "permission"
      );

    return [
      action,
      ...(user ? [user] : []),
      ...(permission
        ? [permission]
        : []),
    ];
  },

  async execute({
    client,
    message,
    args,
  }) {
    const authorId =
      message?.author?.id;

    if (!authorId) {
      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "ACCESS DENIED",
            subtitle:
              "Developer configuration is restricted",
            lines: [
              {
                label: "Access",
                value:
                  "Main Owner Only",
              },
            ],
            height: 320,
          }
        )
      );
    }

    if (!isMainOwner(authorId)) {
      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "ACCESS DENIED",
            subtitle:
              "Developer configuration is restricted",
            lines: [
              {
                label: "Access",
                value:
                  "Main Owner Only",
              },
              {
                label: "User",
                value:
                  authorId,
              },
              {
                label: "Owner Config",
                value:
                  "Set MAIN_OWNER_ID in environment",
              },
            ],
            height: 400,
          }
        )
      );
    }

    const action =
      String(args?.[0] || "")
        .toLowerCase()
        .trim();

    if (!action) {
      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "DEVELOPER CONFIG",
            subtitle:
              "Permission configuration system",
            lines: [
              "devconfig addperm @user music",
              "devconfig removeperm @user music",
              "devconfig permissions @user",
              "devconfig enable @user",
              "devconfig disable @user",
              "devconfig reset @user",
            ],
            height: 500,
          }
        )
      );
    }

    const userId =
      getUserId(args);

    if (action === "addperm") {
      if (!userId) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID USER",
              subtitle:
                "Developer user is required",
              lines: [
                {
                  label:
                    "Usage",
                  value:
                    "devconfig addperm @user music",
                },
              ],
              height: 340,
            }
          )
        );
      }

      if (!isDeveloper(userId)) {
        const created =
          addDeveloper(userId);

        if (!created) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "DEVELOPER ERROR",
                subtitle:
                  "Developer record could not be created",
                lines: [
                  {
                    label:
                      "User ID",
                    value:
                      userId,
                  },
                ],
                height: 340,
              }
            )
          );
        }
      }

      const permission =
        String(args?.[2] || "")
          .toLowerCase()
          .trim();

      if (
        !DEV_PERMISSIONS.includes(
          permission
        )
      ) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID PERMISSION",
              subtitle:
                "Unknown developer permission",
              lines: [
                {
                  label:
                    "Allowed",
                  value:
                    DEV_PERMISSIONS.join(
                      ", "
                    ),
                },
              ],
              height: 340,
            }
          )
        );
      }

      const changed =
        setDeveloperPermission(
          userId,
          permission,
          true
        );

      if (!changed) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "CONFIGURATION FAILED",
              subtitle:
                "Permission could not be updated",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
                {
                  label:
                    "Permission",
                  value:
                    permission,
                },
              ],
              height: 360,
            }
          )
        );
      }

      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "PERMISSION ADDED",
            subtitle:
              "Developer permission updated",
            lines: [
              {
                label:
                  "User ID",
                value:
                  userId,
              },
              {
                label:
                  "Permission",
                value:
                  permission,
              },
              {
                label:
                  "Status",
                value:
                  "Enabled",
              },
            ],
            height: 380,
          }
        )
      );
    }

    if (
      action === "removeperm"
    ) {
      if (!userId) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID USER",
              subtitle:
                "Developer user is required",
              lines: [
                {
                  label:
                    "Usage",
                  value:
                    "devconfig removeperm @user music",
                },
              ],
              height: 340,
            }
          )
        );
      }

      if (!isDeveloper(userId)) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "DEVELOPER NOT FOUND",
              subtitle:
                "Add the user as a developer first",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
                {
                  label:
                    "Status",
                  value:
                    "Not Registered",
                },
              ],
              height: 360,
            }
          )
        );
      }

      const permission =
        String(args?.[2] || "")
          .toLowerCase()
          .trim();

      if (
        !DEV_PERMISSIONS.includes(
          permission
        )
      ) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID PERMISSION",
              subtitle:
                "Unknown developer permission",
              lines: [
                {
                  label:
                    "Allowed",
                  value:
                    DEV_PERMISSIONS.join(
                      ", "
                    ),
                },
              ],
              height: 340,
            }
          )
        );
      }

      const changed =
        setDeveloperPermission(
          userId,
          permission,
          false
        );

      if (!changed) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "CONFIGURATION FAILED",
              subtitle:
                "Permission could not be updated",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
                {
                  label:
                    "Permission",
                  value:
                    permission,
                },
              ],
              height: 360,
            }
          )
        );
      }

      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "PERMISSION REMOVED",
            subtitle:
              "Developer permission updated",
            lines: [
              {
                label:
                  "User ID",
                value:
                  userId,
              },
              {
                label:
                  "Permission",
                value:
                  permission,
              },
              {
                label:
                  "Status",
                value:
                  "Disabled",
              },
            ],
            height: 380,
          }
        )
      );
    }

    if (
      action === "permissions"
    ) {
      if (!userId) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID USER",
              subtitle:
                "Developer user is required",
              lines: [
                {
                  label:
                    "Usage",
                  value:
                    "devconfig permissions @user",
                },
              ],
              height: 340,
            }
          )
        );
      }

      const developer =
        getDeveloper(userId);

      if (!developer) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "DEVELOPER NOT FOUND",
              subtitle:
                "No developer record exists",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
              ],
              height: 320,
            }
          )
        );
      }

      const lines = [
        {
          label:
            "User ID",
          value:
            userId,
        },
        {
          label:
            "Status",
          value:
            developer.enabled
              ? "Enabled"
              : "Disabled",
        },
      ];

      for (
        const permission of DEV_PERMISSIONS
      ) {
        lines.push({
          label:
            permission.toUpperCase(),
          value:
            developer.permissions?.[
              permission
            ]
              ? "Enabled"
              : "Disabled",
        });
      }

      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "DEVELOPER PERMISSIONS",
            subtitle:
              "Current permission configuration",
            lines,
            height: 500,
          }
        )
      );
    }

    if (
      action === "enable" ||
      action === "disable"
    ) {
      if (!userId) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID USER",
              subtitle:
                "Developer user is required",
              lines: [
                {
                  label:
                    "Usage",
                  value:
                    `devconfig ${action} @user`,
                },
              ],
              height: 340,
            }
          )
        );
      }

      if (!isDeveloper(userId)) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "DEVELOPER NOT FOUND",
              subtitle:
                "No developer record exists",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
              ],
              height: 320,
            }
          )
        );
      }

      const enabled =
        action === "enable";

      const changed =
        setDeveloperEnabled(
          userId,
          enabled
        );

      if (!changed) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "CONFIGURATION FAILED",
              subtitle:
                "Developer status could not be updated",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
              ],
              height: 340,
            }
          )
        );
      }

      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              enabled
                ? "DEVELOPER ENABLED"
                : "DEVELOPER DISABLED",
            subtitle:
              "Developer account status updated",
            lines: [
              {
                label:
                  "User ID",
                value:
                  userId,
              },
              {
                label:
                  "Status",
                value:
                  enabled
                    ? "Enabled"
                    : "Disabled",
              },
            ],
            height: 340,
          }
        )
      );
    }

    if (
      action === "reset"
    ) {
      if (!userId) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "INVALID USER",
              subtitle:
                "Developer user is required",
              lines: [
                {
                  label:
                    "Usage",
                  value:
                    "devconfig reset @user",
                },
              ],
              height: 340,
            }
          )
        );
      }

      if (!isDeveloper(userId)) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "DEVELOPER NOT FOUND",
              subtitle:
                "No developer record exists",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
              ],
              height: 320,
            }
          )
        );
      }

      const reset =
        resetDeveloperPermissions(
          userId
        );

      if (!reset) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "RESET FAILED",
              subtitle:
                "Permissions could not be reset",
              lines: [
                {
                  label:
                    "User ID",
                  value:
                    userId,
                },
              ],
              height: 320,
            }
          )
        );
      }

      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "PERMISSIONS RESET",
            subtitle:
              "All developer permissions disabled",
            lines: [
              {
                label:
                  "User ID",
                value:
                  userId,
              },
              {
                label:
                  "Music",
                value:
                  "Disabled",
              },
              {
                label:
                  "General",
                value:
                  "Disabled",
              },
              {
                label:
                  "Moderation",
                value:
                  "Disabled",
              },
              {
                label:
                  "Utility",
                value:
                  "Disabled",
              },
              {
                label:
                  "Special",
                value:
                  "Disabled",
              },
            ],
            height: 500,
          }
        )
      );
    }

    return message.reply(
      buildBanner(
        client,
        message,
        {
          title:
            "UNKNOWN ACTION",
          subtitle:
            "Invalid developer configuration command",
          lines: [
            "devconfig addperm @user music",
            "devconfig removeperm @user music",
            "devconfig permissions @user",
            "devconfig enable @user",
            "devconfig disable @user",
            "devconfig reset @user",
          ],
          height: 500,
        }
      )
    );
  },
};