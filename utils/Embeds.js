const { EmbedBuilder } = require("discord.js");

const C = {
  ERROR:   0xED4245,
  SUCCESS: 0x57F287,
  MUSIC:   0x5865F2,
  INFO:    0x2F3136,
  WARN:    0xFEE75C,
  MOD:     0xE67E22,
  FUN:     0xEB459E,
  FILTER:  0x9B59B6,
  PLAY:    0x1DB954,
};

const FOOTER = "Zeechei Music • shaping rhythms";

/**
 * Base embed with color and timestamp.
 */
function base(color) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

/**
 * Quick embed builders used across every command.
 */
module.exports = {
  C,
  FOOTER,

  /** ❌ Red error embed */
  error(desc) {
    return base(C.ERROR)
      .setDescription(`> ❌  ${desc}`);
  },

  /** ✅ Green success embed */
  success(desc) {
    return base(C.SUCCESS)
      .setDescription(`> ✅  ${desc}`);
  },

  /** ⚠️ Yellow warning embed */
  warn(desc) {
    return base(C.WARN)
      .setDescription(`> ⚠️  ${desc}`);
  },

  /** ℹ️ Dark info embed — pass title + optional desc */
  info(title, desc) {
    const e = base(C.INFO).setTitle(title);
    if (desc) e.setDescription(desc);
    return e;
  },

  /**
   * Rich music embed — lily style.
   * Usage: E.music("Now Playing").setTitle(...).addFields(...)
   */
  music(header) {
    return base(C.MUSIC)
      .setAuthor({ name: `🎵  ${header}` });
  },

  /** Filter embed */
  filter(header) {
    return base(C.FILTER)
      .setAuthor({ name: `🎛️  ${header}` });
  },

  /** Moderation embed */
  mod(header) {
    return base(C.MOD)
      .setAuthor({ name: `🛡️  ${header}` });
  },

  /** Fun embed */
  fun(header) {
    return base(C.FUN)
      .setAuthor({ name: `🎉  ${header}` });
  },

  /** Play / add-to-queue embed — green accent */
  play(header) {
    return base(C.PLAY)
      .setAuthor({ name: `🎶  ${header}` });
  },

  /**
   * Lily-style "Now Playing" embed — rich with artwork, progress, fields.
   * @param {object} track  - lavalink track object
   * @param {object} player - lavalink player
   * @param {object} user   - discord User who requested
   */
  nowPlaying(track, player, user) {
    const pos   = player?.position   || 0;
    const dur   = track.info?.duration || 1;
    const bar   = buildBar(pos, dur, 14);
    const embed = base(C.MUSIC)
      .setAuthor({ name: "🎵  Now Playing", iconURL: user?.displayAvatarURL() })
      .setTitle(track.info.title.slice(0, 256))
      .setURL(track.info.uri || null)
      .setDescription(
        `${bar}\n` +
        `\`${fmt(pos)}\` ─── \`${fmt(dur)}\``
      )
      .addFields(
        { name: "🎤 Artist",       value: `\`${track.info.author || "Unknown"}\``, inline: true  },
        { name: "🔁 Loop",         value: `\`${player?.repeatMode || "none"}\``,   inline: true  },
        { name: "🔊 Volume",       value: `\`${player?.volume ?? 100}%\``,         inline: true  },
        { name: "📋 Queue",        value: `\`${player?.queue?.tracks?.length ?? 0} tracks\``, inline: true },
        { name: "🌐 Source",       value: `\`${track.info.sourceName || "unknown"}\``, inline: true },
        { name: "👤 Requested by", value: user ? `<@${user.id}>` : "Unknown",      inline: true  },
      )
      .setFooter({ text: FOOTER, iconURL: user?.displayAvatarURL() });
    if (track.info?.artworkUrl) embed.setThumbnail(track.info.artworkUrl);
    return embed;
  },
};

function fmt(ms) {
  const s   = Math.floor(ms / 1000);
  const hrs = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (hrs > 0) return `${hrs}:${p(min)}:${p(sec)}`;
  return `${min}:${p(sec)}`;
}

function p(n) { return String(n).padStart(2, "0"); }

function buildBar(pos, dur, size = 14) {
  const filled = Math.min(Math.round((pos / dur) * size), size);
  return "▬".repeat(filled) + "🔘" + "▬".repeat(size - filled);
}
