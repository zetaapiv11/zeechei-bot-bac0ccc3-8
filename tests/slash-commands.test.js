const test = require("node:test");
const assert = require("node:assert/strict");
const { selectSlashCommands } = require("../utils/slashCommands");
function command(name, type = 1, music = false) {
  return { name, __zeecheiPoruMusic: music, data: { toJSON: () => ({ name, type }) } };
}
test("global limits preserve music and leave excess commands in the prefix registry", () => {
  const entries = Array.from({ length: 140 }, (_, i) => command("general" + i));
  entries.push(command("play", 1, true), command("pause", 1, true), command("stop", 1, true));
  entries.push(...Array.from({ length: 18 }, (_, i) => command("user" + i, 2)));
  entries.push(...Array.from({ length: 18 }, (_, i) => command("message" + i, 3)));
  const registry = new Map(entries.map(c => [c.name, c]));
  const { commands, omitted } = selectSlashCommands(registry);
  assert.equal(commands.filter(c => c.type === 1).length, 100);
  assert.equal(commands.filter(c => c.type === 2).length, 15);
  assert.equal(commands.filter(c => c.type === 3).length, 15);
  for (const name of ["play", "pause", "stop"]) assert.ok(commands.some(c => c.name === name));
  assert.equal(omitted.length, 49);
  assert.equal(registry.size, 179);
});
test("aliases and prefix-only commands do not duplicate slash registration", () => {
  const play = command("play", 1, true);
  const { commands } = selectSlashCommands(new Map([["play", play], ["p", play], ["prefix", { name: "prefix" }]]));
  assert.equal(commands.length, 1);
});
