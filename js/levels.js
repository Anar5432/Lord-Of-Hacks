// ==========================================================================
// Lord of the Hacks - Levels Configuration Data
// ==========================================================================

const LEVELS_CONFIG = {
    1: {
        name: "Mordor Wasteland",
        theme: "mordor",
        width: 4800, // Very long horizontal composition
        height: 470,
        skyColor: "linear-gradient(180deg, #1C0505 0%, #050101 100%)",
        platforms: [
            // Left starting ground (top is y = 40)
            { x: 0, y: 0, width: 850, height: 40, type: "cliff-left" },
            
            // Starting area ruins (moderate heights for easy jumping)
            { x: 350, y: 50, width: 110, height: 30, type: "stone-island" },  // top is y = 80
            { x: 550, y: 90, width: 110, height: 30, type: "stone-island" }, // top is y = 120
            
            // First lava gap crossings (smooth step up/down flow)
            { x: 880, y: 25, width: 140, height: 20, type: "wooden-bridge" },  // top is y = 45
            { x: 1080, y: 55, width: 120, height: 30, type: "stone-island" },  // top is y = 85
            { x: 1250, y: 45, width: 120, height: 20, type: "suspended-swing" }, // top is y = 65
            { x: 1450, y: 75, width: 120, height: 30, type: "stone-island" },  // top is y = 105
            
            // Ruined stone bridge (top is y = 40)
            { x: 1700, y: 0, width: 600, height: 40, type: "stone" },
            
            // Tower ruins above the ruined bridge (vertical platforms)
            { x: 1850, y: 60, width: 120, height: 20, type: "wooden-bridge" },  // top is y = 80
            { x: 2000, y: 90, width: 100, height: 30, type: "shaking-platform" },   // top is y = 120
            { x: 2150, y: 70, width: 120, height: 20, type: "suspended-swing" }, // top is y = 90
            
            // Floating volcanic rock islands and chains section (varied heights)
            { x: 2450, y: 100, width: 110, height: 30, type: "stone-island" },  // top is y = 130
            { x: 2650, y: 35, width: 150, height: 20, type: "broken-bridge" },   // top is y = 55
            { x: 2900, y: 75, width: 130, height: 20, type: "suspended-swing" }, // top is y = 95
            
            // Mid-bridge before boss approach (top is y = 40)
            { x: 3200, y: 0, width: 600, height: 40, type: "stone" },
            // High pillars above mid-bridge
            { x: 3350, y: 50, width: 110, height: 30, type: "shaking-platform" },  // top is y = 80
            { x: 3550, y: 90, width: 110, height: 30, type: "stone-island" }, // top is y = 120
            
            // Final lava gap before tower
            { x: 3900, y: 30, width: 140, height: 20, type: "broken-bridge" },   // top is y = 50
            { x: 4050, y: 70, width: 120, height: 20, type: "suspended-swing" },  // top is y = 90
            
            // Boss arena (at the base of Barad-dûr)
            { x: 4200, y: 0, width: 600, height: 40, type: "cliff-right" }, // top is y = 40
            // Floating rock islands around the boss
            { x: 4300, y: 70, width: 100, height: 20, type: "stone-island" }, // top is y = 90
            { x: 4550, y: 70, width: 100, height: 20, type: "stone-island" }, // top is y = 90
            { x: 4425, y: 110, width: 100, height: 20, type: "stone-island" } // top is y = 130
        ],
        enemies: [
            // Start area patrol (ground level)
            { type: "Orc", x: 450, y: 40, patrolMinX: 200, patrolMaxX: 700 },
            { type: "Orc", x: 650, y: 40, patrolMinX: 300, patrolMaxX: 800 },
            
            // Mid bridge patrol (ground level)
            { type: "Orc", x: 1800, y: 40, patrolMinX: 1720, patrolMaxX: 2200 },
            { type: "UrukHai", x: 2100, y: 40, patrolMinX: 1950, patrolMaxX: 2280 },
            
            // Mid-bridge before boss (ground level)
            { type: "Orc", x: 3350, y: 40, patrolMinX: 3250, patrolMaxX: 3600 },
            { type: "UrukHai", x: 3600, y: 40, patrolMinX: 3450, patrolMaxX: 3800 },
            
            // Final Boss (positioned on top of the center floating island)
            { type: "EyeOfSauron", x: 4440, y: 130, patrolMinX: 4440, patrolMaxX: 4440 }
        ],
        collectibles: [
            // Coins in start area (some high, some low)
            { type: "coin", x: 300, y: 80, value: 5 },
            { type: "coin", x: 400, y: 120, value: 5 }, // on top of first pillar
            { type: "coin", x: 600, y: 160, value: 5 }, // on top of second pillar
            
            // Coins/Gems in first lava crossing
            { type: "coin", x: 950, y: 85, value: 5 },
            { type: "coin", x: 1140, y: 125, value: 5 },
            { type: "coin", x: 1310, y: 105, value: 5 },
            { type: "gem", x: 1510, y: 145, value: 20 },
            
            // Tower coins (positioned vertically)
            { type: "coin", x: 1910, y: 120, value: 5 },
            { type: "coin", x: 2050, y: 160, value: 5 },
            { type: "coin", x: 2210, y: 130, value: 5 },
            
            // Coins in floating chains section
            { type: "coin", x: 2500, y: 170, value: 5 },
            { type: "coin", x: 2720, y: 95, value: 5 },
            { type: "coin", x: 2960, y: 135, value: 5 },
            
            // Mid-bridge high area coins
            { type: "coin", x: 3400, y: 120, value: 5 },
            { type: "coin", x: 3600, y: 160, value: 5 },
            
            // Final Gorge crossing coins
            { type: "coin", x: 3970, y: 90, value: 5 },
            { type: "coin", x: 4110, y: 130, value: 5 }
        ],
        flag: { x: 4700, y: 40 }
    }
};
