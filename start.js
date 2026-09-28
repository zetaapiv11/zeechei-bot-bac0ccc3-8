const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const NODE_MODULES = path.join(ROOT, "node_modules");
const PACKAGE_JSON = path.join(ROOT, "package.json");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log("========================================");
  console.log("        ZEECHEI BOT — STARTING");
  console.log("========================================");

  if (!fs.existsSync(PACKAGE_JSON)) {
    console.error("[Zeechei] package.json not found.");
    process.exit(1);
  }

  /*
   * Dependencies are installed only when
   * node_modules does not exist.
   *
   * This prevents Pterodactyl from running
   * npm install on every restart.
   */

  if (!fs.existsSync(NODE_MODULES)) {
    console.log("[Zeechei] node_modules not found.");
    console.log("[Zeechei] Installing dependencies...");

    try {
      await run("npm", [
        "install",
        "--no-audit",
        "--no-fund",
        "--progress=false",
      ]);
    } catch (error) {
      console.error("[Zeechei] Dependency installation failed.");
      console.error(error.message);
      process.exit(1);
    }
  }

  console.log("[Zeechei] Dependencies ready.");
  console.log("[Zeechei] Starting shard.js...");

  const bot = spawn(
    process.execPath,
    [path.join(ROOT, "shard.js")],
    {
      cwd: ROOT,
      stdio: "inherit",
    }
  );

  bot.on("error", (error) => {
    console.error("[Zeechei] Failed to start shard.js:", error);
    process.exit(1);
  });

  bot.on("close", (code) => {
    console.log(`[Zeechei] shard.js exited with code ${code}`);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[Zeechei] Fatal error:", error);
  process.exit(1);
});