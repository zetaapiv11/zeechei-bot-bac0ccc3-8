/**
 * ============================================================
 * ZEECHEI BOT
 * HYBRID SHARD MANAGER
 * ============================================================
 *
 * IMPORTANT:
 * Only this file should start the ClusterManager.
 *
 * Do NOT run:
 *   index.js
 *   Shard(1).js
 *   another ClusterManager file
 *
 * Start only:
 *   node Shard.js
 * ============================================================
 */

const { ClusterManager } = require("discord-hybrid-sharding");
const config = require("./src/config");


// ============================================================
// CONFIG CHECK
// ============================================================

if (!config || !config.token) {
    throw new Error(
        "[SHARDING] Bot token is missing in ./src/config.js"
    );
}


// ============================================================
// PREVENT DUPLICATE MANAGER
// ============================================================

if (global.__ZEECHEI_SHARD_MANAGER__) {
    console.log(
        "[SHARDING] Manager is already running. Duplicate start ignored."
    );

    process.exit(0);
}

global.__ZEECHEI_SHARD_MANAGER__ = true;


// ============================================================
// CLUSTER MANAGER
// ============================================================

const manager = new ClusterManager(
    "./index.js",
    {
        token: config.token,

        // Discord automatically decides
        // the required number of shards.
        totalShards: "auto",

        // Keep your Zeechei setup.
        shardsPerClusters: 2,

        // Worker mode.
        mode: "worker",

        // Automatically restart crashed clusters.
        respawn: true,

        // Restart protection.
        restarts: {
            max: 5,
            interval: 10000
        }
    }
);


// ============================================================
// CLUSTER CREATED
// ============================================================

manager.on(
    "clusterCreate",
    (cluster) => {

        console.log(
            `[SHARDING] Cluster ${cluster.id} started.`
        );

    }
);


// ============================================================
// DEBUG
// ============================================================

manager.on(
    "debug",
    (message) => {

        console.log(
            `[SHARDING] ${message}`
        );

    }
);


// ============================================================
// ERROR
// ============================================================

manager.on(
    "error",
    (error) => {

        console.error(
            "[SHARDING ERROR]",
            error?.message || error
        );

    }
);


// ============================================================
// SPAWN
// ============================================================

(async () => {

    try {

        console.log(
            "============================================================"
        );

        console.log(
            "                 ZEECHEI BOT — SHARDING"
        );

        console.log(
            "============================================================"
        );

        console.log(
            "[SHARDING] Starting ClusterManager..."
        );

        await manager.spawn({
            timeout: -1
        });

        console.log(
            "[SHARDING] All clusters spawned successfully."
        );

    } catch (error) {

        console.error(
            "[SHARDING] Failed to spawn clusters:",
            error?.message || error
        );

        process.exit(1);
    }

})();