module.exports = {
  name: "raw",
  once: false,
  execute(client, data) {
    if (client.lavalink) client.lavalink.sendRawData(data);
  },
};
