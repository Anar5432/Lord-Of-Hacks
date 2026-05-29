# Lord of the Hacks (2D Side-Scroller)

A classic 2D pixel-art style platformer game set in Middle-earth, inspired by *The Hobbit* and *The Lord of the Rings*. Play as a Hobbit hero, leap across hazardous volcanic platforms, vanquish evil Orcs, and collect treasures to defeat the dark forces of Mordor!

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
Navigate through the hazardous Mordor Wasteland (Level 1) to conquer the darkness:
1.  **Mordor Wasteland**: Scale the volcanic peaks, leap across swinging chain platforms, dodge flying Nazgûls, and destroy the **Eye of Sauron** at the top of the dark tower to win the game!

Reach the golden flag at the rightmost boundary of the level after defeating the boss to claim victory.

### Progression & Win/Lose Conditions
*   **Win**: Reach the final tower, defeat the Eye of Sauron, and complete the game.
*   **Lose**: Run out of health (durability) from enemy attacks, hazards, or falling off platforms.
*   **One Ring Invisibility**: Toggle the ring to slip into the shadow world. You become transparent, and enemies cannot detect or damage you. However, you cannot collect items or deal damage while invisible (or can you? Let's check, we didn't restrict attacking, but this is a cool detail!). Let's just say you are immune to enemies.

---

## ⚔️ Game Entities

| Entity | Type | Description | Rendered Via |
| :--- | :--- | :--- | :--- |
| **Player** | Dynamic | The active Hobbit hero (Frodo) controlled by the player. | Canvas 2D — custom transparent pixel-art sprite sheet |
| **Platform** | Static | Solid terrain (obsidian stone slabs, swinging chain platforms, and wooden bridges) players and enemies stand on. | Canvas 2D — high-fidelity image-based 3-slice tiling |
| **Enemy** | Dynamic | Hazards (Orcs, Uruk-hai Berserkers, flying Nazgûls, and the Eye of Sauron) that patrol, charge, swoop, or shoot. | Canvas 2D — custom transparent pixel-art sprite sheets |
| **Projectile** | Dynamic | Sting sword slash arc, underhand rocks, or enemy fireballs. | Canvas 2D — custom drawings and particle trails |
| **Collectible** | Static | Coins and the Arkenstone gem picked up for score and high score. | Canvas 2D — animated circle fills |

---

## 🛠️ Technical Decisions

### 1. Object-Oriented Programming (OOP)
The engine is structured entirely around standard ES6 classes:
*   **Reasoning**: Games naturally map to objects — each entity (Player, Enemy, Platform) encapsulates its own position, velocity, health, and behavior. A base `Entity` class shares physics data (x, y, vx, vy, width, height) and each subclass overrides its own `draw()` and `update()` logic.
*   **Character State Machine**: The `Player` class tracks an active state string (`'idle'`, `'run'`, `'jump'`, `'attack-melee'`, `'attack-ranged'`, `'death'`) that drives which animation frame is drawn each tick.

### 2. Canvas API for Game Rendering (Hybrid Architecture)
The game uses a **hybrid rendering model** allowed by the project rules:
*   **Canvas 2D** (`<canvas>` + `ctx.getContext('2d')`) renders everything inside the game world: the Hobbit, platforms, enemies, collectibles, backgrounds, and visual effects. This enables real pixel-art drawing, smooth animation, and proper sprite states.
*   **HTML + CSS** renders all UI outside the game world: the start screen, HUD health bar (lives, score, and Ring invisibility meter), game-over screen, and victory screen.
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
*   **Resolved**:
    1.  Fixed potential crash on player death during canvas context balance loops.
    2.  Prevented infinite death loops by excluding broken bridges from respawn platform targets.
    3.  Balanced platform vertical heights to ensure all jumps are easy and comfortable under stuns/fear states (jump gap < 40px).
    4.  Overhauled procedural block rendering with high-fidelity, custom image-based 3-slice tiling matching original pixel coordinates.
*   **Planned Improvements**:
    1.  Add support for mobile touch controls.
    2.  Improve physics friction calculations for smooth stopping momentum.
