const {
  AttachmentBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const { V2Builder } = require("../../utils/V2Builder");

/* =========================================================
   CONFIG
========================================================= */

const DB_PATH = path.join(
  process.cwd(),
  "data",
  "zeechei.json"
);

/*
 * Main owner IDs.
 *
 * MAIN_OWNER_ID environment variable is supported.
 * The ID below is also accepted as the main owner.
 */
const MAIN_OWNER_IDS = new Set([
  "1443804231776862228",
]);

if (process.env.MAIN_OWNER_ID) {
  MAIN_OWNER_IDS.add(
    String(process.env.MAIN_OWNER_ID).trim()
  );
}

/* =========================================================
   DEVELOPER PERMISSIONS
========================================================= */

const DEV_PERMISSIONS = [
  "music",
  "general",
  "moderation",
  "utility",
  "special",
];

const DEFAULT_DEVELOPER_PERMISSIONS = {
  music: false,
  general: false,
  moderation: false,
  utility: false,
  special: false,
};

/* =========================================================
   DATABASE
========================================================= */

function ensureDatabase() {
  const dataDir = path.dirname(DB_PATH);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {
      recursive: true,
    });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      owners: [],
      mainOwnerId:
        process.env.MAIN_OWNER_ID ||
        "1443804231776862228",
      developers: {},
    };

    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(initialData, null, 2),
      "utf8"
    );
  }
}

function loadDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(
      DB_PATH,
      "utf8"
    );

    if (!raw.trim()) {
      return {};
    }

    const data = JSON.parse(raw);

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return {};
    }

    return data;
  } catch (error) {
    console.error(
      "[DEV] Database read error:",
      error
    );

    return {};
  }
}

function saveDatabase(data) {
  ensureDatabase();

  const tempPath = `${DB_PATH}.tmp`;

  fs.writeFileSync(
    tempPath,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(
    tempPath,
    DB_PATH
  );
}

/* =========================================================
   OWNER CHECK
========================================================= */

function getMainOwner(data) {
  const envOwner =
    process.env.MAIN_OWNER_ID;

  if (
    typeof envOwner === "string" &&
    /^\d{15,25}$/.test(
      envOwner.trim()
    )
  ) {
    return envOwner.trim();
  }

  if (
    typeof data?.mainOwnerId === "string" &&
    /^\d{15,25}$/.test(
      data.mainOwnerId.trim()
    )
  ) {
    return data.mainOwnerId.trim();
  }

  if (
    Array.isArray(data?.owners)
  ) {
    const owner =
      data.owners.find(
        id =>
          typeof id === "string" &&
          /^\d{15,25}$/.test(
            id.trim()
          )
      );

    if (owner) {
      return owner.trim();
    }
  }

  return "1443804231776862228";
}

function isMainOwner(userId) {
  if (!userId) {
    return false;
  }

  const normalizedId =
    String(userId).trim();

  /*
   * First check configured owner IDs.
   */
  if (
    MAIN_OWNER_IDS.has(
      normalizedId
    )
  ) {
    return true;
  }

  /*
   * Then check the database.
   */
  const data =
    loadDatabase();

  const mainOwner =
    getMainOwner(data);

  if (
    mainOwner &&
    String(mainOwner).trim() ===
      normalizedId
  ) {
    return true;
  }

  /*
   * Also check owners array.
   */
  if (
    Array.isArray(data?.owners) &&
    data.owners.some(
      id =>
        String(id).trim() ===
        normalizedId
    )
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   DEVELOPER STORAGE
========================================================= */

function ensureDeveloperStorage(data) {
  if (
    !Array.isArray(data.owners)
  ) {
    data.owners = [];
  }

  if (
    !data.developers ||
    typeof data.developers !== "object" ||
    Array.isArray(data.developers)
  ) {
    data.developers = {};
  }

  if (
    typeof data.mainOwnerId !== "string" ||
    !data.mainOwnerId.trim()
  ) {
    data.mainOwnerId =
      process.env.MAIN_OWNER_ID ||
      "1443804231776862228";
  }
}

function isDeveloper(userId) {
  if (!userId) {
    return false;
  }

  const data =
    loadDatabase();

  ensureDeveloperStorage(data);

  const developer =
    data.developers[
      String(userId)
    ];

  return (
    !!developer &&
    developer.enabled !== false
  );
}

function getDeveloper(userId) {
  if (!userId) {
    return null;
  }

  const data =
    loadDatabase();

  ensureDeveloperStorage(data);

  const developer =
    data.developers[
      String(userId)
    ];

  if (!developer) {
    return null;
  }

  return {
    userId: String(userId),

    enabled:
      developer.enabled !== false,

    permissions: {
      ...DEFAULT_DEVELOPER_PERMISSIONS,
      ...(developer.permissions || {}),
    },

    addedBy:
      developer.addedBy || null,

    addedAt:
      developer.addedAt || null,
  };
}

function getDevelopers() {
  const data =
    loadDatabase();

  ensureDeveloperStorage(data);

  return Object.entries(
    data.developers
  ).map(
    ([userId, developer]) => ({
      userId,

      enabled:
        developer?.enabled !== false,

      permissions: {
        ...DEFAULT_DEVELOPER_PERMISSIONS,
        ...(developer?.permissions || {}),
      },

      addedBy:
        developer?.addedBy || null,

      addedAt:
        developer?.addedAt || null,
    })
  );
}

function addDeveloper(
  userId,
  addedBy
) {
  if (!userId) {
    return false;
  }

  const data =
    loadDatabase();

  ensureDeveloperStorage(data);

  const normalizedId =
    String(userId).trim();

  if (
    data.developers[
      normalizedId
    ]
  ) {
    return false;
  }

  data.developers[
    normalizedId
  ] = {
    enabled: true,

    permissions: {
      ...DEFAULT_DEVELOPER_PERMISSIONS,
    },

    addedBy:
      addedBy || null,

    addedAt:
      Date.now(),
  };

  saveDatabase(data);

  return true;
}

function removeDeveloper(userId) {
  if (!userId) {
    return false;
  }

  const data =
    loadDatabase();

  ensureDeveloperStorage(data);

  const normalizedId =
    String(userId).trim();

  if (
    !data.developers[
      normalizedId
    ]
  ) {
    return false;
  }

  delete data.developers[
    normalizedId
  ];

  saveDatabase(data);

  return true;
}

/* =========================================================
   HELPERS
========================================================= */

function truncate(
  text,
  max = 60
) {
  const value =
    String(text ?? "");

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(
    0,
    max - 3
  )}...`;
}

function getColor(
  client,
  guildId
) {
  try {
    const color =
      client?.getColor?.(
        guildId
      );

    if (color) {
      return color;
    }
  } catch {}

  return "#ff0000";
}

function getUserId(
  message,
  args
) {
  const raw =
    args?.[1];

  if (raw) {
    const mention =
      raw.match(
        /^<@!?(\d+)>$/
      );

    if (mention) {
      return mention[1];
    }

    if (
      /^\d{15,25}$/.test(raw)
    ) {
      return raw;
    }
  }

  const mentionedUser =
    message?.mentions?.users?.first?.();

  if (mentionedUser) {
    return mentionedUser.id;
  }

  return null;
}

/* =========================================================
   CANVAS
========================================================= */

function createBanner({
  title,
  subtitle = "",
  lines = [],
  color = "#ff0000",
  width = 1100,
  height = 620,
}) {
  const canvas =
    createCanvas(
      width,
      height
    );

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle =
    "#070707";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.fillStyle =
    "#101010";

  ctx.fillRect(
    25,
    25,
    width - 50,
    height - 50
  );

  ctx.strokeStyle =
    color;

  ctx.lineWidth = 2;

  ctx.strokeRect(
    25,
    25,
    width - 50,
    height - 50
  );

  ctx.fillStyle =
    color;

  ctx.fillRect(
    25,
    25,
    width - 50,
    8
  );

  ctx.font =
    "bold 38px Arial";

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    truncate(
      title,
      42
    ),
    60,
    90
  );

  if (subtitle) {
    ctx.font =
      "22px Arial";

    ctx.fillStyle =
      "#999999";

    ctx.fillText(
      truncate(
        subtitle,
        75
      ),
      60,
      128
    );
  }

  let y = 180;

  for (
    const line of lines
  ) {
    if (
      y >=
      height - 80
    ) {
      break;
    }

    if (
      typeof line ===
      "string"
    ) {
      if (
        !line.trim()
      ) {
        y += 20;
        continue;
      }

      ctx.font =
        "bold 23px Arial";

      ctx.fillStyle =
        "#ffffff";

      ctx.fillText(
        truncate(
          line,
          72
        ),
        60,
        y
      );

      y += 42;

      continue;
    }

    const label =
      truncate(
        line?.label ?? "",
        28
      );

    const value =
      truncate(
        line?.value ?? "",
        62
      );

    ctx.font =
      "bold 21px Arial";

    ctx.fillStyle =
      color;

    ctx.fillText(
      label,
      60,
      y
    );

    ctx.font =
      "21px Arial";

    ctx.fillStyle =
      "#dddddd";

    ctx.fillText(
      value,
      350,
      y
    );

    y += 42;
  }

  ctx.font =
    "18px Arial";

  ctx.fillStyle =
    "#555555";

  ctx.fillText(
    "Zeechei Developer System",
    60,
    height - 55
  );

  return canvas.toBuffer(
    "image/png"
  );
}

/* =========================================================
   V2 RESPONSE
========================================================= */

function buildBanner(
  client,
  message,
  data
) {
  const color =
    getColor(
      client,
      message?.guild?.id
    );

  const buffer =
    createBanner({
      ...data,
      color,
    });

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name:
          "dev-response.png",
      }
    );

  return new V2Builder(
    color
  )
    .media(
      "attachment://dev-response.png"
    )
    .build([
      attachment,
    ]);
}

/* =========================================================
   GUIDE
========================================================= */

function guide(
  client,
  message
) {
  return message.reply(
    buildBanner(
      client,
      message,
      {
        title:
          "DEVELOPER SYSTEM",

        subtitle:
          "Main owner developer management",

        lines: [
          "dev add @user",
          "dev remove @user",
          "dev list",
          "dev info @user",
          "",
          "devconfig addperm @user music",
          "devconfig removeperm @user music",
          "devconfig permissions @user",
          "devconfig enable @user",
          "devconfig disable @user",
          "devconfig reset @user",
        ],

        height: 680,
      }
    )
  );
}

/* =========================================================
   COMMAND
========================================================= */

module.exports = {
  name: "dev",

  aliases: [
    "developer",
    "developers",
  ],

  description:
    "Manage Zeechei developers",

  category:
    "general",

  usage:
    "dev <add|remove|list|info> [user]",

  argsRequired:
    false,

  data:
    new SlashCommandBuilder()
      .setName("dev")
      .setDescription(
        "Manage Zeechei developers"
      )

      .addStringOption(
        option =>
          option
            .setName("action")
            .setDescription(
              "Developer action"
            )
            .setRequired(true)

            .addChoices(
              {
                name: "Add",
                value: "add",
              },
              {
                name: "Remove",
                value: "remove",
              },
              {
                name: "List",
                value: "list",
              },
              {
                name: "Info",
                value: "info",
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
      ),

  getSlashArgs(
    interaction
  ) {
    const action =
      interaction.options.getString(
        "action"
      );

    const user =
      interaction.options.getString(
        "user"
      );

    return [
      action,
      ...(user
        ? [user]
        : []),
    ];
  },

  async execute({
    client,
    message,
    args,
  }) {
    try {
      const authorId =
        message?.author?.id;

      /* =====================================================
         MAIN OWNER CHECK
      ===================================================== */

      if (
        !isMainOwner(
          authorId
        )
      ) {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "ACCESS DENIED",

              subtitle:
                "Developer system is restricted",

              lines: [
                {
                  label:
                    "Access",

                  value:
                    "Main Owner Only",
                },

                {
                  label:
                    "User",

                  value:
                    authorId ||
                    "Unknown",
                },

                {
                  label:
                    "Owner Config",

                  value:
                    "Configured",
                },
              ],

              height: 360,
            }
          )
        );
      }

      /* =====================================================
         ACTION
      ===================================================== */

      const action =
        String(
          args?.[0] || ""
        )
          .toLowerCase()
          .trim();

      /*
       * `dev` with no arguments = guide.
       */
      if (!action) {
        return guide(
          client,
          message
        );
      }

      /* =====================================================
         ADD
      ===================================================== */

      if (
        action === "add"
      ) {
        const userId =
          getUserId(
            message,
            args
          );

        if (!userId) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "INVALID USER",

                subtitle:
                  "Developer could not be added",

                lines: [
                  {
                    label:
                      "Usage",

                    value:
                      "dev add @user",
                  },

                  {
                    label:
                      "Status",

                    value:
                      "User ID required",
                  },
                ],

                height: 370,
              }
            )
          );
        }

        /*
         * Main owner cannot be added as developer.
         */
        if (
          isMainOwner(
            userId
          )
        ) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "INVALID ACTION",

                subtitle:
                  "Main Owner cannot be added as developer",

                lines: [
                  {
                    label:
                      "User ID",

                    value:
                      userId,
                  },

                  {
                    label:
                      "Role",

                    value:
                      "Main Owner",
                  },
                ],

                height: 370,
              }
            )
          );
        }

        /*
         * Check whether already registered.
         */
        const existing =
          getDeveloper(
            userId
          );

        if (existing) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "ALREADY DEVELOPER",

                subtitle:
                  "This user is already registered",

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
                      existing.enabled
                        ? "Enabled"
                        : "Disabled",
                  },
                ],

                height: 370,
              }
            )
          );
        }

        const added =
          addDeveloper(
            userId,
            authorId
          );

        if (!added) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "ADD FAILED",

                subtitle:
                  "Developer could not be added",

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
                      "Database rejected request",
                  },
                ],

                height: 370,
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
                "DEVELOPER ADDED",

              subtitle:
                "Developer account created successfully",

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
                    "Enabled",
                },

                {
                  label:
                    "Permissions",

                  value:
                    "None",
                },

                {
                  label:
                    "Added By",

                  value:
                    authorId,
                },
              ],

              height: 420,
            }
          )
        );
      }

      /* =====================================================
         REMOVE
      ===================================================== */

      if (
        action === "remove"
      ) {
        const userId =
          getUserId(
            message,
            args
          );

        if (!userId) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "INVALID USER",

                subtitle:
                  "Developer could not be removed",

                lines: [
                  {
                    label:
                      "Usage",

                    value:
                      "dev remove @user",
                  },
                ],

                height: 350,
              }
            )
          );
        }

        if (
          !getDeveloper(
            userId
          )
        ) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "NOT A DEVELOPER",

                subtitle:
                  "No developer record was found",

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

                height: 370,
              }
            )
          );
        }

        const removed =
          removeDeveloper(
            userId
          );

        if (!removed) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "REMOVE FAILED",

                subtitle:
                  "Developer could not be removed",

                lines: [
                  {
                    label:
                      "User ID",

                    value:
                      userId,
                  },
                ],

                height: 330,
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
                "DEVELOPER REMOVED",

              subtitle:
                "Developer access removed",

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
                    "Removed",
                },
              ],

              height: 350,
            }
          )
        );
      }

      /* =====================================================
         LIST
      ===================================================== */

      if (
        action === "list"
      ) {
        const developers =
          getDevelopers();

        if (
          !developers.length
        ) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "NO DEVELOPERS",

                subtitle:
                  "Developer database is empty",

                lines: [
                  {
                    label:
                      "Developers",

                    value:
                      "0",
                  },
                ],

                height: 340,
              }
            )
          );
        }

        const lines = [];

        for (
          let i = 0;
          i < developers.length;
          i++
        ) {
          const developer =
            developers[i];

          const permissions =
            DEV_PERMISSIONS
              .filter(
                permission =>
                  developer
                    ?.permissions?.[
                    permission
                  ] === true
              )
              .join(", ") ||
            "None";

          lines.push({
            label:
              `Developer ${i + 1}`,

            value:
              developer.userId,
          });

          lines.push({
            label:
              "Status",

            value:
              developer.enabled
                ? "Enabled"
                : "Disabled",
          });

          lines.push({
            label:
              "Permissions",

            value:
              permissions,
          });

          if (
            i !==
            developers.length - 1
          ) {
            lines.push("");
          }
        }

        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "DEVELOPER LIST",

              subtitle:
                `${developers.length} developer account(s)`,

              lines,

              height: Math.min(
                1000,
                Math.max(
                  460,
                  220 +
                    developers.length *
                      145
                )
              ),
            }
          )
        );
      }

      /* =====================================================
         INFO
      ===================================================== */

      if (
        action === "info"
      ) {
        const userId =
          getUserId(
            message,
            args
          );

        if (!userId) {
          return message.reply(
            buildBanner(
              client,
              message,
              {
                title:
                  "INVALID USER",

                subtitle:
                  "Developer information requires a user",

                lines: [
                  {
                    label:
                      "Usage",

                    value:
                      "dev info @user",
                  },
                ],

                height: 340,
              }
            )
          );
        }

        const developer =
          getDeveloper(
            userId
          );

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

                  {
                    label:
                      "Status",

                    value:
                      "Not Registered",
                  },
                ],

                height: 370,
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
                "DEVELOPER INFORMATION",

              subtitle:
                "Developer configuration",

              lines: [
                {
                  label:
                    "User ID",

                  value:
                    developer.userId,
                },

                {
                  label:
                    "Status",

                  value:
                    developer.enabled
                      ? "Enabled"
                      : "Disabled",
                },

                {
                  label:
                    "Music",

                  value:
                    developer
                      .permissions
                      .music
                      ? "Enabled"
                      : "Disabled",
                },

                {
                  label:
                    "General",

                  value:
                    developer
                      .permissions
                      .general
                      ? "Enabled"
                      : "Disabled",
                },

                {
                  label:
                    "Moderation",

                  value:
                    developer
                      .permissions
                      .moderation
                      ? "Enabled"
                      : "Disabled",
                },

                {
                  label:
                    "Utility",

                  value:
                    developer
                      .permissions
                      .utility
                      ? "Enabled"
                      : "Disabled",
                },

                {
                  label:
                    "Special",

                  value:
                    developer
                      .permissions
                      .special
                      ? "Enabled"
                      : "Disabled",
                },

                {
                  label:
                    "Added By",

                  value:
                    developer.addedBy ||
                    "Unknown",
                },
              ],

              height: 650,
            }
          )
        );
      }

      /* =====================================================
         UNKNOWN ACTION
      ===================================================== */

      return message.reply(
        buildBanner(
          client,
          message,
          {
            title:
              "UNKNOWN ACTION",

            subtitle:
              "Invalid developer command",

            lines: [
              "dev add @user",
              "dev remove @user",
              "dev list",
              "dev info @user",
            ],

            height: 430,
          }
        )
      );
    } catch (error) {
      console.error(
        "[DEV COMMAND ERROR]",
        error
      );

      try {
        return message.reply(
          buildBanner(
            client,
            message,
            {
              title:
                "COMMAND ERROR",

              subtitle:
                "Developer command failed",

              lines: [
                {
                  label:
                    "Error",

                  value:
                    truncate(
                      error?.message ||
                        "Unknown error",
                      70
                    ),
                },

                {
                  label:
                    "Status",

                  value:
                    "Check console logs",
                },
              ],

              height: 380,
            }
          )
        );
      } catch {
        return message.reply(
          "Developer command failed."
        );
      }
    }
  },
};