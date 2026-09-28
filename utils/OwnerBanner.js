const { AttachmentBuilder } = require("discord.js");
const { createCanvas } = require("@napi-rs/canvas");
const { V2Builder } = require("./V2Builder");

function colorOf(client, guildId) {
  try {
    return client?.getColor?.(guildId) || "#8B5CF6";
  } catch {
    return "#8B5CF6";
  }
}

function truncate(value, max = 86) {
  const text = String(value ?? "");
  return text.length > max
    ? `${text.slice(0, max - 3)}...`
    : text;
}

function normalizeColor(color) {
  if (typeof color === "number") {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  if (typeof color === "string" && color.trim()) {
    return color;
  }

  return "#8B5CF6";
}

function buildBanner(
  client,
  message,
  {
    title,
    subtitle = "",
    lines = [],
    rows = [],
    height = 500,
    footer = "Zeechei Owner & Developer System",
  } = {}
) {
  const color = normalizeColor(
    colorOf(client, message?.guild?.id)
  );

  // Keep compatibility with commands that use `rows`.
  const finalLines = Array.isArray(lines) && lines.length
    ? lines
    : Array.isArray(rows)
      ? rows
      : [];

  const canvas = createCanvas(1100, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, 1100, height);

  ctx.fillStyle = "#0C0C12";
  ctx.fillRect(24, 24, 1052, height - 48);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 1052, height - 48);

  ctx.fillStyle = color;
  ctx.fillRect(24, 24, 1052, 7);

  ctx.strokeStyle = "#24242F";
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 42, 1016, height - 84);

  ctx.font = "900 38px Arial";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(truncate(title || "ZEECHEI", 42), 72, 88);

  if (subtitle) {
    ctx.font = "500 20px Arial";
    ctx.fillStyle = "#9999A8";
    ctx.fillText(truncate(subtitle, 90), 72, 121);
  }

  ctx.strokeStyle = "#292934";
  ctx.beginPath();
  ctx.moveTo(72, 150);
  ctx.lineTo(1028, 150);
  ctx.stroke();

  let y = 190;

  for (const line of finalLines) {
    if (y > height - 85) break;

    if (!line) {
      y += 18;
      continue;
    }

    if (typeof line === "string") {
      ctx.font = "700 20px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(truncate(line, 82), 72, y);
      y += 39;
      continue;
    }

    ctx.font = "800 17px Arial";
    ctx.fillStyle = color;
    ctx.fillText(
      truncate(line.label ?? "", 27),
      72,
      y
    );

    ctx.font = "500 18px Arial";
    ctx.fillStyle = "#DDDEE6";
    ctx.fillText(
      truncate(line.value ?? "", 70),
      340,
      y
    );

    y += 39;
  }

  ctx.font = "500 14px Arial";
  ctx.fillStyle = "#555562";
  ctx.fillText(
    footer,
    72,
    height - 50
  );

  const attachment = new AttachmentBuilder(
    canvas.toBuffer("image/png"),
    {
      name: "zeechei-owner.png",
    }
  );

  return new V2Builder(color)
    .media("attachment://zeechei-owner.png")
    .build([attachment]);
}

/*
|--------------------------------------------------------------------------
| replyBanner
|--------------------------------------------------------------------------
| Compatibility helper used by the settings owner commands.
|
| Supported:
|   replyBanner(message, data)
|   replyBanner(client, message, data)
|--------------------------------------------------------------------------
*/
async function replyBanner(...args) {
  let client;
  let message;
  let data;

  if (args.length === 2) {
    [message, data] = args;
    client = message?.client;
  } else {
    [client, message, data] = args;
  }

  if (!message) {
    throw new TypeError("replyBanner: message is required.");
  }

  const payload = buildBanner(
    client,
    message,
    data || {}
  );

  return message.reply(payload);
}

module.exports = {
  buildBanner,
  replyBanner,
  colorOf,
  truncate,
};
