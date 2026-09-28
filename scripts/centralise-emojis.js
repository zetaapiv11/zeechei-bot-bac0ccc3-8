#!/usr/bin/env node
/**
 * One-time migration: replace every hardcoded custom-emoji string in
 * commands/ with a reference to TXT from utils/emojis.js.
 *
 * Run:  node scripts/centralise-emojis.js
 */
const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ── Emoji replacements ────────────────────────────────────────────────────────
const REPLACEMENTS = [
  { raw: "<a:arrow_arrow:1535813458056978472>",        key: "arrow"  },
  { raw: "<:Zeechei:1535687335490883644>",         key: "zeechei"  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeEmojiImport(filePath) {
  const emojiAbs = path.join(ROOT, "utils", "emojis");
  let rel = path.relative(path.dirname(filePath), emojiAbs);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function getAllJs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") out.push(...getAllJs(full));
    else if (entry.isFile() && entry.name.endsWith(".js"))    out.push(full);
  }
  return out;
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Process one file ──────────────────────────────────────────────────────────
function processFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const original = src;

  // Skip files with none of the target emojis
  if (!REPLACEMENTS.some(r => src.includes(r.raw))) return;

  const importPath = relativeEmojiImport(filePath);

  // ── Ensure TXT: E import ──────────────────────────────────────────────────
  if (!src.includes("TXT")) {
    if (src.match(/require\([^)]*emojis[^)]*\)/)) {
      // Already imports emojis.js — inject TXT: E into the existing destructure
      src = src.replace(
        /const\s*\{([^}]+)\}\s*=\s*require\(([^)]*emojis[^)]*)\)/,
        (match, imports, reqArg) => {
          const cleaned = imports.trim().replace(/,\s*$/, "");
          return `const { ${cleaned}, TXT: E } = require(${reqArg})`;
        },
      );
    } else {
      // No emojis import yet — insert one after the last top-level require line
      const lines = src.split("\n");
      let lastIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^const\s+.+\s*=\s*require\(/.test(lines[i])) lastIdx = i;
      }
      const insertLine = `const { TXT: E } = require("${importPath}");`;
      if (lastIdx >= 0) lines.splice(lastIdx + 1, 0, insertLine);
      else              lines.unshift(insertLine);
      src = lines.join("\n");
    }
  }

  // ── Replace each emoji ────────────────────────────────────────────────────
  for (const { raw, key } of REPLACEMENTS) {
    if (!src.includes(raw)) continue;
    const esc = escapeRe(raw);

    // 1. .setEmoji("raw") or .setEmoji('raw') → .setEmoji(E.key)
    src = src.replace(new RegExp(`\\.setEmoji\\(["']${esc}["']\\)`, "g"),
      `.setEmoji(E.${key})`);

    // 2. label: "raw ..." in plain-string objects → strip emoji from label
    //    (custom emojis don't render in Discord select-menu labels)
    src = src.replace(new RegExp(`(label:\\s*["'])${esc}\\s*`, "g"), "$1");

    // 3. Every remaining occurrence is inside a template literal → ${E.key}
    src = src.split(raw).join(`\${E.${key}}`);
  }

  if (src !== original) {
    fs.writeFileSync(filePath, src);
    console.log("✔", path.relative(ROOT, filePath));
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
const targets = getAllJs(path.join(ROOT, "commands"));
for (const f of targets) processFile(f);
console.log("Done.");
