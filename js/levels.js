// ==========================================================================
// Lord of the Hacks - Levels Configuration Data
// ==========================================================================

const LEVELS_CONFIG = {
    1: {
        name: "Old Forest",
        theme: "forest",
        width: 3200, // World width in pixels
        height: 470, // World height in pixels
        skyColor: "linear-gradient(180deg, #1C133A 0%, #0D0820 100%)",
        platforms: [
            // { x, y, width, height }
            { x: 0, y: 0, width: 800, height: 40 },
            { x: 900, y: 0, width: 600, height: 40 },
            { x: 1200, y: 120, width: 200, height: 30 },
            { x: 1600, y: 0, width: 1000, height: 40 },
            { x: 1900, y: 150, width: 300, height: 30 },
            { x: 2700, y: 0, width: 500, height: 40 }
        ],
        enemies: [
            // { type, x, y, patrolMinX, patrolMaxX }
            { type: "Tree", x: 400, y: 40, patrolMinX: 200, patrolMaxX: 600 },
            { type: "Tree", x: 1000, y: 40, patrolMinX: 920, patrolMaxX: 1300 },
            { type: "Tree", x: 2000, y: 40, patrolMinX: 1700, patrolMaxX: 2200 }
        ],
        collectibles: [
            // { type, x, y, value }
            { type: "coin", x: 300, y: 100, value: 5 },
            { type: "coin", x: 350, y: 100, value: 5 },
            { type: "coin", x: 1250, y: 180, value: 5 },
            { type: "coin", x: 1300, y: 180, value: 5 },
            { type: "coin", x: 1950, y: 220, value: 5 },
            { type: "coin", x: 2050, y: 220, value: 5 }
        ],
        flag: { x: 3100, y: 40 } // Level completion goal coordinate
    },
    2: {
        name: "Dark Mines",
        theme: "mines",
        width: 3600,
        height: 470,
        skyColor: "linear-gradient(180deg, #090615 0%, #030206 100%)",
        platforms: [
            { x: 0, y: 0, width: 600, height: 40 },
            { x: 700, y: 80, width: 150, height: 30 },
            { x: 950, y: 160, width: 150, height: 30 },
            { x: 1200, y: 0, width: 800, height: 40 },
            { x: 2100, y: 100, width: 250, height: 30 },
            { x: 2450, y: 0, width: 1150, height: 40 }
        ],
        enemies: [
            { type: "Orc", x: 300, y: 40, patrolMinX: 100, patrolMaxX: 500 },
            { type: "Orc", x: 1400, y: 40, patrolMinX: 1300, patrolMaxX: 1800 },
            { type: "Troll", x: 2800, y: 40, patrolMinX: 2550, patrolMaxX: 3000 }
        ],
        collectibles: [
            { type: "coin", x: 750, y: 150, value: 5 },
            { type: "coin", x: 1000, y: 230, value: 5 },
            { type: "gem", x: 1600, y: 120, value: 20 }
        ],
        flag: { x: 3500, y: 40 }
    },
    3: {
        name: "Lonely Mountain",
        theme: "mountain",
        width: 2500,
        height: 470,
        skyColor: "linear-gradient(180deg, #1C0A0A 0%, #080303 100%)",
        platforms: [
            { x: 0, y: 0, width: 1000, height: 40 },
            { x: 1100, y: 100, width: 300, height: 40 },
            { x: 1500, y: 0, width: 1000, height: 40 }
        ],
        enemies: [
            { type: "Smaug", x: 1800, y: 40, patrolMinX: 1600, patrolMaxX: 2300 } // Level 3 Boss
        ],
        collectibles: [
            { type: "coin", x: 400, y: 80, value: 5 },
            { type: "coin", x: 600, y: 80, value: 5 }
        ],
        flag: { x: 2400, y: 40 }
    },
    4: {
        name: "Mordor Tower",
        theme: "mordor",
        width: 3000,
        height: 470,
        skyColor: "linear-gradient(180deg, #250909 0%, #0B0303 100%)",
        platforms: [
            { x: 0, y: 0, width: 700, height: 40 },
            { x: 800, y: 120, width: 200, height: 30 },
            { x: 1100, y: 200, width: 200, height: 30 },
            { x: 1400, y: 120, width: 200, height: 30 },
            { x: 1700, y: 0, width: 1300, height: 40 }
        ],
        enemies: [
            { type: "Orc", x: 400, y: 40, patrolMinX: 200, patrolMaxX: 600 },
            { type: "EyeOfSauron", x: 2300, y: 40, patrolMinX: 2000, patrolMaxX: 2800 } // Final Boss
        ],
        collectibles: [
            { type: "coin", x: 900, y: 200, value: 5 },
            { type: "gem", x: 1200, y: 280, value: 20 }
        ],
        flag: { x: 2900, y: 40 }
    }
};
