const zeecheiConfig = require('../config');
const { normalizeLavalink } = require('../utils/lavalinkConfig');

const lavalink = normalizeLavalink(zeecheiConfig.lavalink || {});

module.exports = {
  LAVALINK: {
    HOSTS: lavalink.host,
    PORTS: String(lavalink.port),
    PASSWORDS: lavalink.password,
    SECURES: String(lavalink.secure),
  },
  MUSIC: {
    DEFAULT_PLATFORM: 'ytsearch',
    AUTOCOMPLETE_LIMIT: 5,
    PLAYLIST_LIMIT: 3,
    ARTWORK_STYLE: 'MusicCard',
  },
  GENIUS: {
    API_KEY: process.env.GENIUS_API_KEY || '',
  },
};
