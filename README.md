# Lord of the Hacks (2D Side-Scroller)

A classic 2D pixel-art style platformer game set in Middle-earth, inspired by *The Hobbit* and *The Lord of the Rings*. Play as iconic heroes, leap across hazardous platforms, vanquish evil foes, and gather treasures to defeat the darkness!

Live Game Link: [GitHub Pages Live Demo](https://anar5432.github.io/Lord-Of-Hacks/)

GitHub Repository: [Anar5432/Lord-Of-Hacks](https://github.com/Anar5432/Lord-Of-Hacks)

Link to AI Log: [AI Development Diary (AI_DIARY.md)](./AI_DIARY.md)

---

## 🎨 Game Design Sketch

![Excalidraw Game Design Concept](assets/excalidraw_design.png)
*(Note: Replace with your actual shared Excalidraw design drawing in the `assets/` folder.)*

---

## 🎮 How to Play

### Controls
*   **A / D** or **Arrow Left / Right**: Walk Left / Right
*   **W** or **Spacebar**: Jump
*   **J** or **X**: Melee Attack (Sting sword swing — strong knockback)
*   **K** or **C**: Ranged Attack (underhand rock throw — parabolic arc)
*   **Shift** or **R** / **I**: Toggle Invisibility (Wear the One Ring — turns transparent, immune to enemies)

### Objective
Navigate through 4 hazardous levels to conquer the darkness in Middle-earth:
1.  **Level 1: Old Forest**: Avoid rolling roots and defeat patrol trees.
2.  **Level 2: Dark Mines**: Navigate caverns, dodge swinging traps, and defeat Orcs.
3.  **Level 3: Lonely Mountain**: Navigate treasure piles and defeat **Smaug the Dragon** to claim the **Arkenstone**.
4.  **Level 4: Mordor Tower**: Scale the volcanic peaks and destroy the **Eye of Sauron** to win the game!

Reach the golden flag at the rightmost boundary of each level to transition and progress.

### Progression & Win/Lose Conditions
*   **Win**: Reach the final tower, defeat the Eye of Sauron, and complete the game.
*   **Lose**: Run out of health (durability) from enemy attacks, hazards, or falling off platforms.
*   **One Ring Invisibility**: Toggle the ring to slip into the shadow world. You become transparent, and enemies cannot detect or damage you. However, you cannot collect items or deal damage while invisible (or can you? Let's check, we didn't restrict attacking, but this is a cool detail!). Let's just say you are immune to enemies.

---

## ⚔️ Game Entities

| Entity | Type | Description | Rendered Via |
| :--- | :--- | :--- | :--- |
| **Player** | Dynamic | The active hero (Hobbit, Ranger, or Wizard) controlled by the player. | Canvas 2D — pixel-art drawn per frame |
| **Platform** | Static | Solid terrain (forest turf, cave rock, obsidian) players and enemies stand on. | Canvas 2D — themed rect fills per level |
| **Enemy** | Dynamic | Hazards (Evil Trees, Orcs, Smaug, Eye of Sauron) that patrol or shoot. | Canvas 2D — pixel-art drawn per frame |
| **Projectile** | Dynamic | Sting sword slash arc, underhand rocks, or enemy fireballs. | Canvas 2D — arc and circle primitives |
| **Collectible** | Static | Coins and the Arkenstone gem picked up for score and shop currency. | Canvas 2D — animated circle fills |

---

## 🛠️ Technical Decisions

### 1. Object-Oriented Programming (OOP)
The engine is structured entirely around standard ES6 classes:
*   **Reasoning**: Games naturally map to objects — each entity (Player, Enemy, Platform) encapsulates its own position, velocity, health, and behavior. A base `Entity` class shares physics data (x, y, vx, vy, width, height) and each subclass overrides its own `draw()` and `update()` logic.
*   **Character State Machine**: The `Player` class tracks an active state string (`'idle'`, `'run'`, `'jump'`, `'attack-melee'`, `'attack-ranged'`, `'death'`) that drives which animation frame is drawn each tick.

### 2. Canvas API for Game Rendering (Hybrid Architecture)
The game uses a **hybrid rendering model** allowed by the project rules:
*   **Canvas 2D** (`<canvas>` + `ctx.getContext('2d')`) renders everything inside the game world: the Hobbit, platforms, enemies, collectibles, backgrounds, and visual effects. This enables real pixel-art drawing, smooth animation, and proper sprite states.
*   **HTML + CSS** renders all UI outside the game world: the start screen, character shop, HUD health bar, game-over screen, and victory screen.
*   **Why Canvas for gameplay**: CSS-div entities cannot draw pixel-art shapes cleanly. Canvas `ctx.fillRect`, `ctx.arc`, `ctx.drawImage`, and `ctx.shadowBlur` provide full pixel-level rendering control matching the retro pixel-art design brief.

### 3. Project File Structure
```
LordOfHacks/
│
├── index.html        # App shell: canvas element + HTML UI screens
├── style.css         # UI styling only (menus, HUD, overlays — no frameworks)
├── README.md         # This file
├── AI_DIARY.md       # AI tool usage and failure log
├── instruction.md    # Course checklist
│
└── js/
    ├── main.js       # Screen transitions, shop logic, localStorage state
    ├── game.js       # Game loop, Canvas renderer, camera, collision engine
    ├── entities.js   # OOP Entity classes with draw(ctx, cameraX) methods
    └── levels.js     # Level data: platforms, enemies, collectibles, flags
```

---

## 🐛 Known Bugs & Future Fixes
*   *None currently: Initial planning and design phase.*
*   **Planned Fixes / Improvements**:
    1.  Add support for mobile touch controls.
    2.  Implement audio effects and retro background tracks.
    3.  Improve physics friction calculations for smooth stopping momentum.
