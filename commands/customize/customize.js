const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  Routes,
} = require("discord.js");

const https = require("https");
const http = require("http");

const config = require("../../config");
const { V2Builder } = require("../../utils/V2Builder");
const {
  hasPremium,
  isPrivilegedUser,
} = require("../general/premium");

// ============================================================
// COLORS
// ============================================================

const GREEN = "#35F07F";
const GREEN_SOFT = "#8CFFB8";
const BG = "#06110B";
const PANEL = "#0A1A11";
const PANEL_2 = "#0E2417";
const WHITE = "#F1FFF6";
const MUTED = "#8AAE99";

// ============================================================
// SESSION
// ============================================================

const SESSION_TIME = 5 * 60 * 1000;

// ============================================================
// FIELDS
// ============================================================

const FIELDS = {
  avatar: {
    label: "Avatar",
    desc: "Direct PNG, JPG, GIF or WEBP image URL",
  },

  banner: {
    label: "Banner",
    desc: "Direct PNG, JPG, GIF or WEBP image URL",
  },

  bio: {
    label: "Bio",
    desc: "Server-specific bio, maximum 190 characters",
  },

  nickname: {
    label: "Nickname",
    desc: "Server-specific bot nickname, maximum 32 characters",
  },

  reset: {
    label: "Reset",
    desc: "Restore one or all customization values",
  },
};

// ============================================================
// RESET OPTIONS
// ============================================================

const RESET_OPTIONS = [
  {
    label: "Avatar",
    value: "avatar",
  },

  {
    label: "Banner",
    value: "banner",
  },

  {
    label: "Bio",
    value: "bio",
  },

  {
    label: "Nickname",
    value: "nickname",
  },

  {
    label: "Reset All",
    value: "all",
  },
];

// ============================================================
// OWNER IDS
// ============================================================

function ownerIds(client) {
  const ids = [];

  const add = value => {
    if (Array.isArray(value)) {
      value.forEach(add);
    } else if (value instanceof Set) {
      value.forEach(add);
    } else if (
      typeof value === "string" &&
      value.trim()
    ) {
      ids.push(value.trim());
    }
  };

  add(config?.ownerIds);
  add(client?.ownerIds);
  add(client?.ownerId);

  if (
    process.env.OWNER_ID
  ) {
    ids.push(
      process.env.OWNER_ID
    );
  }

  return [
    ...new Set(ids),
  ];
}

// ============================================================
// COLOR
// ============================================================

function safeColor(client) {
  try {
    return typeof client.getColor === "function"
      ? client.getColor(null)
      : 0x35F07F;
  } catch {
    return 0x35F07F;
  }
}

// ============================================================
// ROUNDED RECT
// ============================================================

function roundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {
  ctx.beginPath();

  ctx.roundRect(
    x,
    y,
    width,
    height,
    radius
  );
}

// ============================================================
// TEXT FIT
// ============================================================

function fit(
  ctx,
  text,
  maxWidth,
  font
) {
  ctx.font = font;

  let value =
    String(
      text ?? ""
    );

  while (
    value.length > 1 &&
    ctx.measureText(value).width >
      maxWidth
  ) {
    value =
      value.slice(
        0,
        -2
      ) + "…";
  }

  return value;
}

// ============================================================
// CREATE CUSTOMIZER BANNER
// ============================================================

function createBanner({
  title,
  subtitle,
  rows = [],
  status = "PREMIUM ACTIVE",
  footer = "ZEECHEI • PREMIUM CUSTOMIZATION",
}) {
  const width = 1400;

  const height =
    Math.max(
      700,
      285 +
        rows.length *
          64
    );

  const {
    createCanvas,
  } = require("@napi-rs/canvas");

  const canvas =
    createCanvas(
      width,
      height
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  // ----------------------------------------------------------
  // BACKGROUND
  // ----------------------------------------------------------

  ctx.fillStyle =
    BG;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // ----------------------------------------------------------
  // GLOW
  // ----------------------------------------------------------

  const glow =
    ctx.createRadialGradient(
      width / 2,
      0,
      10,
      width / 2,
      0,
      850
    );

  glow.addColorStop(
    0,
    "rgba(53,240,127,0.25)"
  );

  glow.addColorStop(
    0.45,
    "rgba(53,240,127,0.07)"
  );

  glow.addColorStop(
    1,
    "rgba(53,240,127,0)"
  );

  ctx.fillStyle =
    glow;

  ctx.fillRect(
    0,
    0,
    width,
    430
  );

  // ----------------------------------------------------------
  // PANEL
  // ----------------------------------------------------------

  ctx.fillStyle =
    PANEL;

  roundedRect(
    ctx,
    30,
    30,
    width - 60,
    height - 60,
    26
  );

  ctx.fill();

  // ----------------------------------------------------------
  // BORDER
  // ----------------------------------------------------------

  ctx.strokeStyle =
    GREEN;

  ctx.lineWidth =
    2;

  ctx.stroke();

  // ----------------------------------------------------------
  // HEADER DOT
  // ----------------------------------------------------------

  ctx.fillStyle =
    GREEN;

  ctx.beginPath();

  ctx.arc(
    82,
    84,
    8,
    0,
    Math.PI * 2
  );

  ctx.fill();

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  ctx.fillStyle =
    GREEN_SOFT;

  ctx.font =
    "bold 13px Arial";

  ctx.fillText(
    "PREMIUM CUSTOMIZER",
    105,
    88
  );

  // ----------------------------------------------------------
  // TITLE
  // ----------------------------------------------------------

  ctx.fillStyle =
    WHITE;

  ctx.font =
    "bold 42px Arial";

  ctx.fillText(
    fit(
      ctx,
      title,
      900,
      "bold 42px Arial"
    ),
    105,
    135
  );

  // ----------------------------------------------------------
  // SUBTITLE
  // ----------------------------------------------------------

  ctx.fillStyle =
    MUTED;

  ctx.font =
    "17px Arial";

  ctx.fillText(
    fit(
      ctx,
      subtitle,
      1080,
      "17px Arial"
    ),
    105,
    166
  );

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  ctx.textAlign =
    "right";

  ctx.fillStyle =
    status.includes(
      "ACTIVE"
    ) ||
    status === "READY"
      ? GREEN
      : MUTED;

  ctx.font =
    "bold 15px Arial";

  ctx.fillText(
    fit(
      ctx,
      status,
      250,
      "bold 15px Arial"
    ),
    width - 78,
    88
  );

  ctx.textAlign =
    "left";

  // ----------------------------------------------------------
  // DIVIDER
  // ----------------------------------------------------------

  ctx.strokeStyle =
    "rgba(53,240,127,0.20)";

  ctx.lineWidth =
    1;

  ctx.beginPath();

  ctx.moveTo(
    75,
    205
  );

  ctx.lineTo(
    width - 75,
    205
  );

  ctx.stroke();

  // ----------------------------------------------------------
  // ROWS
  // ----------------------------------------------------------

  let y = 260;

  for (
    const row of rows
  ) {
    ctx.fillStyle =
      PANEL_2;

    roundedRect(
      ctx,
      70,
      y - 38,
      width - 140,
      50,
      14
    );

    ctx.fill();

    ctx.fillStyle =
      GREEN;

    ctx.beginPath();

    ctx.arc(
      92,
      y - 13,
      4,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      GREEN_SOFT;

    ctx.font =
      "bold 16px Arial";

    ctx.fillText(
      fit(
        ctx,
        row.label,
        330,
        "bold 16px Arial"
      ),
      115,
      y - 8
    );

    ctx.fillStyle =
      WHITE;

    ctx.font =
      "16px Arial";

    ctx.fillText(
      fit(
        ctx,
        row.value,
        830,
        "16px Arial"
      ),
      465,
      y - 8
    );

    y += 64;
  }

  // ----------------------------------------------------------
  // FOOTER DIVIDER
  // ----------------------------------------------------------

  ctx.strokeStyle =
    "rgba(53,240,127,0.15)";

  ctx.beginPath();

  ctx.moveTo(
    75,
    height - 88
  );

  ctx.lineTo(
    width - 75,
    height - 88
  );

  ctx.stroke();

  // ----------------------------------------------------------
  // FOOTER
  // ----------------------------------------------------------

  ctx.fillStyle =
    "#547A62";

  ctx.font =
    "bold 12px Arial";

  ctx.fillText(
    footer,
    78,
    height - 54
  );

  ctx.textAlign =
    "right";

  ctx.fillText(
    "SERVER-SPECIFIC",
    width - 78,
    height - 54
  );

  ctx.textAlign =
    "left";

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// V2 PAYLOAD
// ============================================================

function payload(
  client,
  buffer,
  fileName,
  components = []
) {
  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name: fileName,
      }
    );

  const builder =
    new V2Builder(
      safeColor(client)
    ).media(
      `attachment://${fileName}`
    );

  for (
    const row of components
  ) {
    builder.row(row);
  }

  const data =
    builder.build();

  data.files = [
    attachment,
  ];

  return data;
}

// ============================================================
// INFO PAYLOAD
// ============================================================

function info(
  client,
  title,
  subtitle,
  rows,
  fileName,
  components = [],
  status = "PREMIUM ACTIVE"
) {
  return payload(
    client,
    createBanner({
      title,
      subtitle,
      rows,
      status,
    }),
    fileName,
    components
  );
}

// ============================================================
// CANCEL ROW
// ============================================================

function cancelRow(
  userId
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `cust:cancel:${userId}`
        )
        .setLabel(
          "Cancel"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

// ============================================================
// CONFIRM ROW
// ============================================================

function confirmRow(
  userId
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `cust:confirm:${userId}`
        )
        .setLabel(
          "Confirm"
        )
        .setStyle(
          ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId(
          `cust:deny:${userId}`
        )
        .setLabel(
          "Cancel"
        )
        .setStyle(
          ButtonStyle.Danger
        )
    );
}

// ============================================================
// MAIN PAYLOAD
// ============================================================

function mainPayload(
  client,
  message,
  userId
) {
  const select =
    new StringSelectMenuBuilder()
      .setCustomId(
        `cust:main:${userId}`
      )
      .setPlaceholder(
        "Choose what to customize..."
      )
      .addOptions(
        Object.entries(
          FIELDS
        ).map(
          ([
            value,
            item,
          ]) => ({
            label:
              item.label,

            value,

            description:
              item.desc,
          })
        )
      );

  return info(
    client,
    "Bot Customizer",
    `${message.guild.name} • premium server customization`,
    [
      {
        label:
          "Avatar",
        value:
          "Change Zeechei's server avatar",
      },

      {
        label:
          "Banner",
        value:
          "Change Zeechei's server profile banner",
      },

      {
        label:
          "Bio",
        value:
          "Change Zeechei's server-specific bio",
      },

      {
        label:
          "Nickname",
        value:
          "Change Zeechei's nickname in this server",
      },

      {
        label:
          "Reset",
        value:
          "Restore one or all customization values",
      },
    ],
    "customize-main.png",
    [
      new ActionRowBuilder()
        .addComponents(
          select
        ),

      cancelRow(
        userId
      ),
    ]
  );
}

// ============================================================
// RESET PAYLOAD
// ============================================================

function resetPayload(
  client,
  message,
  userId
) {
  const select =
    new StringSelectMenuBuilder()
      .setCustomId(
        `cust:reset:${userId}`
      )
      .setPlaceholder(
        "Choose what to reset..."
      )
      .addOptions(
        RESET_OPTIONS
      );

  return info(
    client,
    "Reset Branding",
    `${message.guild.name} • restore customization values`,
    [
      {
        label:
          "Avatar",
        value:
          "Restore default avatar",
      },

      {
        label:
          "Banner",
        value:
          "Restore default banner",
      },

      {
        label:
          "Bio",
        value:
          "Restore default bio",
      },

      {
        label:
          "Nickname",
        value:
          "Restore default nickname",
      },

      {
        label:
          "Reset All",
        value:
          "Restore everything",
      },
    ],
    "customize-reset.png",
    [
      new ActionRowBuilder()
        .addComponents(
          select
        ),

      cancelRow(
        userId
      ),
    ]
  );
}

// ============================================================
// PROMPT PAYLOAD
// ============================================================

function promptPayload(
  client,
  message,
  field,
  userId
) {
  const prompts = {
    avatar:
      "Send a direct image URL beginning with http:// or https://",

    banner:
      "Send a direct image URL beginning with http:// or https://",

    bio:
      "Send the new bio text • maximum 190 characters",

    nickname:
      "Send the new nickname • maximum 32 characters • `none` clears it",
  };

  return info(
    client,
    FIELDS[field].label,
    `${message.guild.name} • waiting for your input`,
    [
      {
        label:
          "Input",
        value:
          prompts[field],
      },

      {
        label:
          "Cancel",
        value:
          "Click Cancel or send `cancel`",
      },

      {
        label:
          "Timeout",
        value:
          "60 seconds",
      },
    ],
    "customize-prompt.png",
    [
      cancelRow(
        userId
      ),
    ]
  );
}

// ============================================================
// CONFIRM PAYLOAD
// ============================================================

function confirmPayload(
  client,
  message,
  field,
  value,
  userId
) {
  let shown =
    value;

  if (
    field === "bio"
  ) {
    shown =
      value.slice(
        0,
        190
      );
  }

  if (
    field === "nickname"
  ) {
    shown =
      [
        "none",
        "clear",
      ].includes(
        value.toLowerCase()
      )
        ? "(cleared)"
        : value.slice(
            0,
            32
          );
  }

  return info(
    client,
    "Confirm Change",
    `${message.guild.name} • review before applying`,
    [
      {
        label:
          "Change",
        value:
          FIELDS[field]?.label ||
          field,
      },

      {
        label:
          "Value",
        value:
          shown,
      },

      {
        label:
          "Scope",
        value:
          "This server only",
      },

      {
        label:
          "Action",
        value:
          "Press Confirm to apply the change",
      },
    ],
    "customize-confirm.png",
    [
      confirmRow(
        userId
      ),
    ],
    "READY"
  );
}

// ============================================================
// RESULT PAYLOAD
// ============================================================

function resultPayload(
  client,
  message,
  field,
  result,
  error
) {
  return info(
    client,

    error
      ? "Customization Failed"
      : "Customization Updated",

    `${message.guild.name} • ${
      error
        ? "the change could not be applied"
        : "change applied successfully"
    }`,

    [
      {
        label:
          "Result",
        value:
          result,
      },

      {
        label:
          "Change",
        value:
          FIELDS[field]?.label ||
          field,
      },

      {
        label:
          "Details",
        value:
          error ||
          "The new value is active for this server.",
      },
    ],

    error
      ? "customize-failed.png"
      : "customize-success.png",

    [],

    error
      ? "FAILED"
      : "SUCCESS"
  );
}

// ============================================================
// PREMIUM DENIED
// ============================================================

function deniedPremium(
  client,
  message
) {
  return info(
    client,
    "Premium Required",
    "This server does not have an active premium subscription.",
    [
      {
        label:
          "Server",
        value:
          message.guild?.name ||
          "Unknown Server",
      },

      {
        label:
          "Status",
        value:
          "PREMIUM INACTIVE",
      },

      {
        label:
          "Access",
        value:
          "Ask a bot owner to activate premium",
      },
    ],
    "customize-premium.png",
    [],
    "LOCKED"
  );
}

// ============================================================
// PERMISSION DENIED
// ============================================================

function deniedPermission(
  client,
  message
) {
  return info(
    client,
    "Access Denied",
    "You are not authorized to customize Zeechei in this server.",
    [
      {
        label:
          "Allowed",
        value:
          "Server Owner / Extra Owner / Trusted",
      },

      {
        label:
          "Status",
        value:
          "ACCESS DENIED",
      },
    ],
    "customize-permission.png",
    [],
    "LOCKED"
  );
}

// ============================================================
// SERVER ONLY
// ============================================================

function deniedServer(
  client
) {
  return info(
    client,
    "Server Only",
    "This command requires a Discord server.",
    [
      {
        label:
          "Status",
        value:
          "DM USAGE NOT ALLOWED",
      },
    ],
    "customize-server-only.png",
    [],
    "LOCKED"
  );
}

// ============================================================
// IMAGE CONTENT TYPE
// ============================================================

function normalizeContentType(
  value
) {
  return String(
    value || ""
  )
    .split(";")[0]
    .trim()
    .toLowerCase();
}

// ============================================================
// MIME FROM URL
// ============================================================

function mimeFromUrl(
  url
) {
  try {
    const pathname =
      new URL(url)
        .pathname
        .toLowerCase();

    if (
      pathname.endsWith(
        ".png"
      )
    ) {
      return "image/png";
    }

    if (
      pathname.endsWith(
        ".jpg"
      ) ||
      pathname.endsWith(
        ".jpeg"
      )
    ) {
      return "image/jpeg";
    }

    if (
      pathname.endsWith(
        ".gif"
      )
    ) {
      return "image/gif";
    }

    if (
      pathname.endsWith(
        ".webp"
      )
    ) {
      return "image/webp";
    }
  } catch {}

  return null;
}

// ============================================================
// IMAGE MIME VALIDATION
// ============================================================

function detectImageMime(
  buffer
) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 12
  ) {
    return null;
  }

  // PNG
  if (
    buffer
      .subarray(
        0,
        8
      )
      .equals(
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ])
      )
  ) {
    return "image/png";
  }

  // JPEG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // GIF
  const gifHeader =
    buffer
      .subarray(
        0,
        6
      )
      .toString(
        "ascii"
      );

  if (
    gifHeader ===
      "GIF87a" ||
    gifHeader ===
      "GIF89a"
  ) {
    return "image/gif";
  }

  // WEBP
  if (
    buffer
      .subarray(
        0,
        4
      )
      .toString(
        "ascii"
      ) ===
      "RIFF" &&
    buffer
      .subarray(
        8,
        12
      )
      .toString(
        "ascii"
      ) ===
      "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

// ============================================================
// IMAGE DOWNLOAD
// ============================================================

function downloadImage(
  url,
  options = {}
) {
  const {
    maxBytes =
      10 * 1024 * 1024,

    timeout =
      10_000,

    redirects =
      6,
  } = options;

  return new Promise(
    resolve => {
      if (
        !isUrl(url)
      ) {
        return resolve(
          null
        );
      }

      const requestImage =
        (
          target,
          remainingRedirects
        ) => {
          let parsed;

          try {
            parsed =
              new URL(
                target
              );
          } catch {
            return resolve(
              null
            );
          }

          const protocol =
            parsed.protocol
              .toLowerCase();

          const transport =
            protocol ===
            "https:"
              ? https
              : protocol ===
                  "http:"
                ? http
                : null;

          if (
            !transport
          ) {
            return resolve(
              null
            );
          }

          const req =
            transport.get(
              target,
              {
                timeout,

                headers: {
                  "User-Agent":
                    "Mozilla/5.0 Zeechei-Discord-Bot/2.0",

                  Accept:
                    "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

                  "Accept-Encoding":
                    "identity",
                },
              },

              res => {
                const status =
                  Number(
                    res.statusCode ||
                      0
                  );

                // ------------------------------------------------
                // REDIRECT
                // ------------------------------------------------

                if (
                  [
                    301,
                    302,
                    303,
                    307,
                    308,
                  ].includes(
                    status
                  ) &&
                  res.headers.location
                ) {
                  const location =
                    new URL(
                      res.headers.location,
                      target
                    ).toString();

                  res.resume();

                  if (
                    remainingRedirects <=
                    0
                  ) {
                    return resolve(
                      null
                    );
                  }

                  return requestImage(
                    location,
                    remainingRedirects -
                      1
                  );
                }

                // ------------------------------------------------
                // HTTP ERROR
                // ------------------------------------------------

                if (
                  status !==
                  200
                ) {
                  res.resume();

                  return resolve(
                    null
                  );
                }

                // ------------------------------------------------
                // CONTENT TYPE
                // ------------------------------------------------

                const headerMime =
                  normalizeContentType(
                    res.headers[
                      "content-type"
                    ]
                  );

                const urlMime =
                  mimeFromUrl(
                    target
                  );

                const chunks =
                  [];

                let total =
                  0;

                let finished =
                  false;

                // ------------------------------------------------
                // SAFE RESOLVE
                // ------------------------------------------------

                const done =
                  value => {
                    if (
                      finished
                    ) {
                      return;
                    }

                    finished =
                      true;

                    resolve(
                      value
                    );
                  };

                // ------------------------------------------------
                // DATA
                // ------------------------------------------------

                res.on(
                  "data",
                  chunk => {
                    total +=
                      chunk.length;

                    if (
                      total >
                      maxBytes
                    ) {
                      req.destroy();

                      done(
                        null
                      );

                      return;
                    }

                    chunks.push(
                      chunk
                    );
                  }
                );

                // ------------------------------------------------
                // END
                // ------------------------------------------------

                res.on(
                  "end",
                  () => {
                    if (
                      finished
                    ) {
                      return;
                    }

                    const buffer =
                      Buffer.concat(
                        chunks
                      );

                    const detected =
                      detectImageMime(
                        buffer
                      );

                    const mime =
                      detected ||
                      (
                        headerMime.startsWith(
                          "image/"
                        )
                          ? headerMime
                          : null
                      ) ||
                      urlMime;

                    if (
                      !mime ||
                      ![
                        "image/png",
                        "image/jpeg",
                        "image/gif",
                        "image/webp",
                      ].includes(
                        mime
                      )
                    ) {
                      return done(
                        null
                      );
                    }

                    // ------------------------------------------------
                    // DISCORD DATA URI
                    // ------------------------------------------------

                    done(
                      `data:${mime};base64,${buffer.toString(
                        "base64"
                      )}`
                    );
                  }
                );

                res.on(
                  "error",
                  () => {
                    done(
                      null
                    );
                  }
                );
              }
            );

          // ------------------------------------------------------
          // TIMEOUT
          // ------------------------------------------------------

          req.on(
            "timeout",
            () => {
              req.destroy();

              resolve(
                null
              );
            }
          );

          // ------------------------------------------------------
          // REQUEST ERROR
          // ------------------------------------------------------

          req.on(
            "error",
            () => {
              resolve(
                null
              );
            }
          );
        };

      requestImage(
        url,
        redirects
      );
    }
  );
}

// ============================================================
// URL VALIDATION
// ============================================================

function isUrl(
  value
) {
  if (
    typeof value !==
    "string"
  ) {
    return false;
  }

  try {
    const parsed =
      new URL(
        value.trim()
      );

    return (
      parsed.protocol ===
        "http:" ||
      parsed.protocol ===
        "https:"
    );
  } catch {
    return false;
  }
}

// ============================================================
// APPLY CHANGE
// ============================================================

async function applyChange(
  client,
  message,
  field,
  value
) {
  const guildId =
    message.guild.id;

  // ==========================================================
  // AVATAR / BANNER
  // ==========================================================

  if (
    field === "avatar" ||
    field === "banner"
  ) {
    const maxBytes =
      field === "banner"
        ? 10 * 1024 * 1024
        : 8 * 1024 * 1024;

    const data =
      await downloadImage(
        value,
        {
          maxBytes,
          timeout:
            10_000,
          redirects:
            6,
        }
      );

    if (!data) {
      throw new Error(
        field === "banner"
          ? "Could not read the banner image. Use a direct PNG, JPG, GIF or WEBP image URL under 10 MB."
          : "Could not read the avatar image. Use a direct PNG, JPG, GIF or WEBP image URL under 8 MB."
      );
    }

    // --------------------------------------------------------
    // PATCH CURRENT GUILD MEMBER
    // --------------------------------------------------------

    await client.rest.patch(
      Routes.guildMember(
        guildId,
        "@me"
      ),
      {
        body: {
          [field]:
            data,
        },
      }
    );

    return `${
      field === "avatar"
        ? "Server avatar"
        : "Server banner"
    } updated successfully.`;
  }

  // ==========================================================
  // BIO
  // ==========================================================

  if (
    field === "bio"
  ) {
    const bio =
      String(
        value || ""
      ).slice(
        0,
        190
      );

    await client.rest.patch(
      Routes.guildMember(
        guildId,
        "@me"
      ),
      {
        body: {
          bio,
        },
      }
    );

    return "Server bio updated successfully.";
  }

  // ==========================================================
  // NICKNAME
  // ==========================================================

  if (
    field === "nickname"
  ) {
    const nickname =
      [
        "none",
        "clear",
      ].includes(
        value.toLowerCase()
      )
        ? null
        : value.slice(
            0,
            32
          );

    const me =
      await message.guild.members.fetchMe();

    await me.setNickname(
      nickname
    );

    return nickname
      ? `Bot nickname changed to "${nickname}".`
      : "Bot nickname reset to the default.";
  }

  // ==========================================================
  // RESET
  // ==========================================================

  if (
    field === "reset"
  ) {
    const body =
      {};

    if (
      value === "avatar" ||
      value === "all"
    ) {
      body.avatar =
        null;
    }

    if (
      value === "banner" ||
      value === "all"
    ) {
      body.banner =
        null;
    }

    if (
      value === "bio" ||
      value === "all"
    ) {
      body.bio =
        null;
    }

    if (
      Object.keys(
        body
      ).length
    ) {
      await client.rest.patch(
        Routes.guildMember(
          guildId,
          "@me"
        ),
        {
          body,
        }
      );
    }

    if (
      value === "nickname" ||
      value === "all"
    ) {
      const me =
        await message.guild.members.fetchMe();

      await me.setNickname(
        null
      );
    }

    return value ===
      "all"
      ? "Avatar, banner, bio and nickname were reset."
      : `${
          value[0].toUpperCase() +
          value.slice(1)
        } was reset.`;
  }

  // ==========================================================
  // UNKNOWN
  // ==========================================================

  throw new Error(
    "Unknown customization operation."
  );
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "customize",

  aliases: [
    "cust",
    "botcust",
  ],

  description:
    "Customize Zeechei's server-specific avatar, banner, bio and nickname.",

  category:
    "customize",

  usage:
    "+customize",

  argsRequired:
    false,

  examples: [
    "+customize",
  ],

  noDefer:
    true,

  // ==========================================================
  // SLASH COMMAND
  // ==========================================================

  data:
    new SlashCommandBuilder()
      .setName(
        "customize"
      )
      .setDescription(
        "Customize Zeechei's server-specific branding."
      ),

  // ==========================================================
  // EXECUTE
  // ==========================================================

  async execute({
    client,
    message,
  }) {
    // --------------------------------------------------------
    // SERVER CHECK
    // --------------------------------------------------------

    if (
      !message.guild
    ) {
      return message.reply(
        deniedServer(
          client
        )
      );
    }

    const guildId =
      message.guild.id;

    const userId =
      message.author.id;

    // --------------------------------------------------------
    // PREMIUM CHECK
    // --------------------------------------------------------

    if (
      !hasPremium(
        guildId
      )
    ) {
      return message.reply(
        deniedPremium(
          client,
          message
        )
      );
    }

    // --------------------------------------------------------
    // PERMISSION CHECK
    // --------------------------------------------------------

    if (
      !isPrivilegedUser(
        client,
        message
      )
    ) {
      return message.reply(
        deniedPermission(
          client,
          message
        )
      );
    }

    // --------------------------------------------------------
    // MAIN PANEL
    // --------------------------------------------------------

    const sent =
      await message.reply(
        mainPayload(
          client,
          message,
          userId
        )
      );

    // --------------------------------------------------------
    // STATE
    // --------------------------------------------------------

    let activeInput =
      null;

    let pending =
      null;

    let finished =
      false;

    // ========================================================
    // CANCEL PAYLOAD
    // ========================================================

    const cancelPayload =
      () =>
        info(
          client,

          "Cancelled",

          `${message.guild.name} • no changes were made`,

          [
            {
              label:
                "Status",
              value:
                "CANCELLED",
            },
          ],

          "customize-cancelled.png",

          [],

          "CANCELLED"
        );

    // ========================================================
    // EXPIRE PAYLOAD
    // ========================================================

    const expirePayload =
      () =>
        info(
          client,

          "Session Expired",

          `${message.guild.name} • customization panel expired`,

          [
            {
              label:
                "Status",
              value:
                "TIMED OUT",
            },

            {
              label:
                "Action",
              value:
                "Run +customize again",
            },
          ],

          "customize-timeout.png",

          [],

          "EXPIRED"
        );

    // ========================================================
    // INVALID PAYLOAD
    // ========================================================

    const invalidPayload = (
      title,
      subtitle,
      rows
    ) =>
      info(
        client,
        title,
        subtitle,
        rows,
        "customize-invalid.png",
        [
          cancelRow(
            userId
          ),
        ],
        "INVALID"
      );

    // ========================================================
    // COMPONENT COLLECTOR
    // ========================================================

    const componentCollector =
      sent.createMessageComponentCollector(
        {
          time:
            SESSION_TIME,

          filter:
            interaction =>
              interaction.user.id ===
              userId,
        }
      );

    // ========================================================
    // STOP FLOW
    // ========================================================

    const stopFlow =
      reason => {
        finished =
          true;

        activeInput?.stop(
          reason
        );

        activeInput =
          null;

        componentCollector.stop(
          reason
        );
      };

    // ========================================================
    // INPUT COLLECTOR
    // ========================================================

    const startInputCollector =
      async field => {
        if (
          finished
        ) {
          return;
        }

        activeInput?.stop(
          "replaced"
        );

        activeInput =
          null;

        // ----------------------------------------------------
        // SHOW PROMPT
        // ----------------------------------------------------

        await sent
          .edit(
            promptPayload(
              client,
              message,
              field,
              userId
            )
          )
          .catch(
            () => {}
          );

        // ----------------------------------------------------
        // MESSAGE COLLECTOR
        // ----------------------------------------------------

        const collector =
          message.channel.createMessageCollector(
            {
              max:
                1,

              time:
                60_000,

              filter:
                input =>
                  input.author.id ===
                  userId,
            }
          );

        activeInput =
          collector;

        // ====================================================
        // COLLECT
        // ====================================================

        collector.on(
          "collect",
          async input => {
            try {
              if (
                finished
              ) {
                return;
              }

              // ----------------------------------------------
              // PREMIUM RECHECK
              // ----------------------------------------------

              if (
                !hasPremium(
                  guildId
                )
              ) {
                stopFlow(
                  "premium-ended"
                );

                await sent
                  .edit(
                    deniedPremium(
                      client,
                      message
                    )
                  )
                  .catch(
                    () => {}
                  );

                return;
              }

              // ----------------------------------------------
              // VALUE
              // ----------------------------------------------

              let value =
                String(
                  input.content ||
                    ""
                ).trim();

              // ----------------------------------------------
              // ATTACHMENT SUPPORT
              // ----------------------------------------------

              if (
                !value &&
                (
                  field ===
                    "avatar" ||
                  field ===
                    "banner"
                )
              ) {
                const attachment =
                  input.attachments?.find(
                    a => {
                      const contentType =
                        String(
                          a.contentType ||
                            ""
                        ).toLowerCase();

                      const url =
                        String(
                          a.url ||
                            ""
                        );

                      return (
                        contentType.startsWith(
                          "image/"
                        ) ||
                        /\.(png|jpe?g|gif|webp)(?:\?|$)/i.test(
                          url
                        )
                      );
                    }
                  );

                if (
                  attachment?.url
                ) {
                  value =
                    attachment.url;
                }
              }

              // ----------------------------------------------
              // DELETE INPUT
              // ----------------------------------------------

              await input
                .delete()
                .catch(
                  () => {}
                );

              // ----------------------------------------------
              // CANCEL
              // ----------------------------------------------

              if (
                value
                  .toLowerCase() ===
                "cancel"
              ) {
                pending =
                  null;

                stopFlow(
                  "cancelled"
                );

                await sent
                  .edit(
                    cancelPayload()
                  )
                  .catch(
                    () => {}
                  );

                return;
              }

              // ----------------------------------------------
              // EMPTY
              // ----------------------------------------------

              if (!value) {
                await sent
                  .edit(
                    invalidPayload(
                      "Input Required",

                      `${message.guild.name} • no usable input was received`,

                      [
                        {
                          label:
                            "Status",
                          value:
                            "NO INPUT",
                        },

                        {
                          label:
                            "Action",
                          value:
                            "Send a value/image or click Cancel",
                        },
                      ]
                    )
                  )
                  .catch(
                    () => {}
                  );

                if (
                  !finished
                ) {
                  await startInputCollector(
                    field
                  );
                }

                return;
              }

              // ----------------------------------------------
              // IMAGE URL
              // ----------------------------------------------

              if (
                (
                  field ===
                    "avatar" ||
                  field ===
                    "banner"
                ) &&
                !isUrl(
                  value
                )
              ) {
                await sent
                  .edit(
                    invalidPayload(
                      "Invalid Image",

                      `${message.guild.name} • the image input was not accepted`,

                      [
                        {
                          label:
                            "Required",
                          value:
                            "Direct HTTP/HTTPS image URL or image attachment",
                        },

                        {
                          label:
                            "Action",
                          value:
                            "Send the image again or click Cancel",
                        },
                      ]
                    )
                  )
                  .catch(
                    () => {}
                  );

                if (
                  !finished
                ) {
                  await startInputCollector(
                    field
                  );
                }

                return;
              }

              // ----------------------------------------------
              // BIO LENGTH
              // ----------------------------------------------

              if (
                field ===
                  "bio" &&
                value.length >
                  190
              ) {
                await sent
                  .edit(
                    invalidPayload(
                      "Bio Too Long",

                      `${message.guild.name} • the supplied bio is too long`,

                      [
                        {
                          label:
                            "Maximum",
                          value:
                            "190 characters",
                        },

                        {
                          label:
                            "Received",
                          value:
                            `${value.length} characters`,
                        },

                        {
                          label:
                            "Action",
                          value:
                            "Send a shorter bio or click Cancel",
                        },
                      ]
                    )
                  )
                  .catch(
                    () => {}
                  );

                if (
                  !finished
                ) {
                  await startInputCollector(
                    field
                  );
                }

                return;
              }

              // ----------------------------------------------
              // NICKNAME LENGTH
              // ----------------------------------------------

              if (
                field ===
                  "nickname" &&
                ![
                  "none",
                  "clear",
                ].includes(
                  value.toLowerCase()
                ) &&
                value.length >
                  32
              ) {
                await sent
                  .edit(
                    invalidPayload(
                      "Nickname Too Long",

                      `${message.guild.name} • the supplied nickname is too long`,

                      [
                        {
                          label:
                            "Maximum",
                          value:
                            "32 characters",
                        },

                        {
                          label:
                            "Received",
                          value:
                            `${value.length} characters`,
                        },

                        {
                          label:
                            "Action",
                          value:
                            "Send a shorter nickname or click Cancel",
                        },
                      ]
                    )
                  )
                  .catch(
                    () => {}
                  );

                if (
                  !finished
                ) {
                  await startInputCollector(
                    field
                  );
                }

                return;
              }

              // ----------------------------------------------
              // PENDING
              // ----------------------------------------------

              pending = {
                field,
                value,
              };

              // ----------------------------------------------
              // CONFIRM
              // ----------------------------------------------

              await sent
                .edit(
                  confirmPayload(
                    client,
                    message,
                    field,
                    value,
                    userId
                  )
                )
                .catch(
                  () => {}
                );
            } catch (
              error
            ) {
              console.error(
                "[customize] input error:",
                error
              );

              if (
                !finished
              ) {
                await sent
                  .edit(
                    info(
                      client,

                      "Input Error",

                      `${message.guild.name} • the input could not be processed`,

                      [
                        {
                          label:
                            "Error",
                          value:
                            String(
                              error?.message ||
                                "Unknown error"
                            ).slice(
                              0,
                              160
                            ),
                        },

                        {
                          label:
                            "Action",
                          value:
                            "Send the input again or click Cancel",
                        },
                      ],

                      "customize-input-error.png",

                      [
                        cancelRow(
                          userId
                        ),
                      ],

                      "ERROR"
                    )
                  )
                  .catch(
                    () => {}
                  );

                if (
                  !finished
                ) {
                  await startInputCollector(
                    field
                  );
                }
              }
            }
          }
        );

        // ======================================================
        // INPUT END
        // ======================================================

        collector.on(
          "end",
          async (
            collected,
            reason
          ) => {
            if (
              activeInput ===
              collector
            ) {
              activeInput =
                null;
            }

            if (
              !collected.size &&
              reason ===
                "time" &&
              !finished
            ) {
              await sent
                .edit(
                  expirePayload()
                )
                .catch(
                  () => {}
                );
            }
          }
        );
      };

    // ==========================================================
    // COMPONENT INTERACTIONS
    // ==========================================================

    componentCollector.on(
      "collect",
      async interaction => {
        try {
          // ----------------------------------------------------
          // FINISHED
          // ----------------------------------------------------

          if (
            finished
          ) {
            if (
              !interaction.replied &&
              !interaction.deferred
            ) {
              await interaction
                .reply({
                  content:
                    "This customization session has ended.",

                  ephemeral:
                    true,
                })
                .catch(
                  () => {}
                );
            }

            return;
          }

          // ----------------------------------------------------
          // PREMIUM RECHECK
          // ----------------------------------------------------

          if (
            !hasPremium(
              guildId
            )
          ) {
            stopFlow(
              "premium-ended"
            );

            return interaction.update(
              deniedPremium(
                client,
                message
              )
            );
          }

          // ====================================================
          // CANCEL
          // ====================================================

          if (
            interaction.customId ===
              `cust:cancel:${userId}` ||
            interaction.customId ===
              `cust:deny:${userId}`
          ) {
            pending =
              null;

            stopFlow(
              "cancelled"
            );

            return interaction.update(
              cancelPayload()
            );
          }

          // ====================================================
          // MAIN SELECT
          // ====================================================

          if (
            interaction.customId ===
            `cust:main:${userId}`
          ) {
            const field =
              interaction.values?.[0];

            if (
              !FIELDS[field]
            ) {
              return interaction.update(
                mainPayload(
                  client,
                  message,
                  userId
                )
              );
            }

            pending =
              null;

            // ------------------------------------------------
            // RESET
            // ------------------------------------------------

            if (
              field ===
              "reset"
            ) {
              activeInput?.stop(
                "reset"
              );

              activeInput =
                null;

              return interaction.update(
                resetPayload(
                  client,
                  message,
                  userId
                )
              );
            }

            // ------------------------------------------------
            // PROMPT
            // ------------------------------------------------

            await interaction.update(
              promptPayload(
                client,
                message,
                field,
                userId
              )
            );

            await startInputCollector(
              field
            );

            return;
          }

          // ====================================================
          // RESET SELECT
          // ====================================================

          if (
            interaction.customId ===
            `cust:reset:${userId}`
          ) {
            const value =
              interaction.values?.[0];

            if (
              !RESET_OPTIONS.some(
                item =>
                  item.value ===
                  value
              )
            ) {
              return interaction.update(
                resetPayload(
                  client,
                  message,
                  userId
                )
              );
            }

            activeInput?.stop(
              "reset"
            );

            activeInput =
              null;

            pending = {
              field:
                "reset",

              value,
            };

            return interaction.update(
              confirmPayload(
                client,
                message,
                "reset",
                value,
                userId
              )
            );
          }

          // ====================================================
          // CONFIRM
          // ====================================================

          if (
            interaction.customId ===
            `cust:confirm:${userId}`
          ) {
            if (
              !pending
            ) {
              return interaction.update(
                info(
                  client,

                  "Session Error",

                  `${message.guild.name} • no pending customization was found`,

                  [
                    {
                      label:
                        "Action",
                      value:
                        "Run +customize again",
                    },
                  ],

                  "customize-session-error.png",

                  [
                    cancelRow(
                      userId
                    ),
                  ],

                  "ERROR"
                )
              );
            }

            const current =
              {
                ...pending,
              };

            // ------------------------------------------------
            // PROCESSING
            // ------------------------------------------------

            await interaction.update(
              info(
                client,

                "Applying Change",

                `${message.guild.name} • Zeechei is updating the server profile`,

                [
                  {
                    label:
                      "Change",
                    value:
                      FIELDS[
                        current.field
                      ]?.label ||
                      current.field,
                  },

                  {
                    label:
                      "Status",
                    value:
                      "PROCESSING",
                  },
                ],

                "customize-processing.png",

                [],

                "PROCESSING"
              )
            );

            // ------------------------------------------------
            // APPLY
            // ------------------------------------------------

            try {
              if (
                !hasPremium(
                  guildId
                )
              ) {
                stopFlow(
                  "premium-ended"
                );

                return sent.edit(
                  deniedPremium(
                    client,
                    message
                  )
                );
              }

              const result =
                await applyChange(
                  client,
                  message,
                  current.field,
                  current.value
                );

              pending =
                null;

              stopFlow(
                "completed"
              );

              // ------------------------------------------------
              // SUCCESS
              // ------------------------------------------------

              return sent.edit(
                resultPayload(
                  client,
                  message,
                  current.field,
                  result,
                  null
                )
              );
            } catch (
              error
            ) {
              console.error(
                "[customize] update failed:",
                error
              );

              pending =
                null;

              stopFlow(
                "failed"
              );

              // ------------------------------------------------
              // FAILURE
              // ------------------------------------------------

              return sent.edit(
                resultPayload(
                  client,
                  message,
                  current.field,
                  "UPDATE FAILED",
                  error?.message ||
                    "Unknown Discord/API error."
                )
              );
            }
          }
        } catch (
          error
        ) {
          console.error(
            "[customize] interaction error:",
            error
          );

          if (
            !interaction.replied &&
            !interaction.deferred
          ) {
            await interaction
              .reply({
                content:
                  "Unable to process this customization interaction.",

                ephemeral:
                  true,
              })
              .catch(
                () => {}
              );
          }
        }
      }
    );

    // ==========================================================
    // COMPONENT COLLECTOR END
    // ==========================================================

    componentCollector.on(
      "end",
      async (
        _,
        reason
      ) => {
        if (
          finished
        ) {
          return;
        }

        if (
          reason ===
          "time"
        ) {
          finished =
            true;

          activeInput?.stop(
            "expired"
          );

          activeInput =
            null;

          await sent
            .edit(
              expirePayload()
            )
            .catch(
              () => {}
            );
        }
      }
    );
  },
};