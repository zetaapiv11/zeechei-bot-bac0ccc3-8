// Discord global limits: 100 chat-input, 15 user and 15 message commands.
const LIMITS = new Map([[1, 100], [2, 15], [3, 15]]);

function selectSlashCommands(registry) {
  const counts = new Map();
  const seen = new Set();
  const commands = [];
  const omitted = [];
  // Preserve all music controls in the slash menu. Overflow remains available
  // through the existing prefix command registry.
  const entries = [...registry.values()].sort((a, b) =>
    Number(Boolean(b.__zeecheiPoruMusic)) - Number(Boolean(a.__zeecheiPoruMusic)) ||
    String(a.name).localeCompare(String(b.name))
  );
  for (const command of entries) {
    if (typeof command.data?.toJSON !== "function") continue;
    const data = command.data.toJSON();
    const type = data.type ?? 1;
    const key = `${type}:${data.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const count = counts.get(type) ?? 0;
    if (!LIMITS.has(type) || count >= LIMITS.get(type)) {
      omitted.push(data.name);
      continue;
    }
    counts.set(type, count + 1);
    commands.push(data);
  }
  return { commands, omitted };
}

module.exports = { selectSlashCommands };
