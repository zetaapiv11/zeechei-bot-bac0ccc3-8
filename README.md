# Discord Bot
Managed by ZetaPanel.
Remember to set DISCORD_TOKEN in the Environment tab!
## Music startup and Resonance credentials

Music commands use a single Poru instance. Do not start the legacy
`MusicManager` alongside it: Resonance allows one WebSocket per client
credential and rejects a second connection with HTTP 409. Create a separate
credential for another bot/process or node, using that bot's Discord user ID.

Use `LAVALINK_HOST`, `LAVALINK_PORT=443`, `LAVALINK_SECURE=true` and a
dashboard-issued `LAVALINK_PASSWORD`. Existing environment values are retained;
this fix does not require rotating the credential or Discord token. If using
`LAVALINK_NODES`, each entry must have the matching node's credential.

Poru reconnects after transient disconnects (five retries, ten seconds apart).
This configuration opens a fresh Lavalink v4 session. Playback may need to be
started again; it does not promise seamless playback recovery or failover.
A rolling deployment can briefly return 409 while the previous process exits.

### Command registration

All loaded prefix commands remain available. Global slash registration
prioritizes music commands and respects Discord's per-type limits; omitted
slash names are printed at startup and remain available as prefix commands.
The obsolete `commands/settings/Shards.js` bootstrap is not loaded as a command.
The supported startup command remains `npm start` (`shard.js`).

### Verification

Run `npm ci` and `npm test` with Node 24. Tests use synthetic local
WebSocket/HTTP and Discord event fixtures. They cover one music engine,
authentication headers, Lavalink v4 voice and playback control requests,
reconnect, emoji export handling, and slash registration limits.
They do **not** prove Discord audio delivery.

After deployment, confirm one Poru connection and no repeated 409 failures in
Render logs. Join a Discord voice channel and use `play` with a valid SoundCloud
track URL; then verify audible audio, pause/resume, volume, skip and stop.
YouTube availability depends on the source plugin and upstream restrictions.
Keep tokens and client credentials out of screenshots and logs.
