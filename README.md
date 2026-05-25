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
*   **A / D** or **Left / Right Arrow**: Walk Left / Right
*   **W** or **Spacebar**: Jump
*   **J** or **X**: Shoot (attack style changes based on character class)

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
*   **Unlocks**: Collect gold coins from fallen enemies and search for hidden treasures. Use coins and the legendary **Arkenstone** to unlock stronger heroes at the character select screen!

---

## ⚔️ Game Entities

| Entity | Type | Description | Representation |
| :--- | :--- | :--- | :--- |
| **Player** | Dynamic | The active hero (Hobbit, Ranger, or Wizard) controlled by the player. | Animated character sprite div |
| **Platform** | Static | Solid terrain (forest turf, cave rock, obsidian) players and enemies stand on. | Styled terrain block div |
| **Enemy** | Dynamic | Hazards (Evil Trees, Orcs, Smaug, Eye of Sauron) that patrol or shoot. | Animated enemy sprite div |
| **Projectile** | Dynamic | Arrows, magic blasts, or enemy fireballs traveling through the air. | Small glowing orb or arrow div |
| **Collectible** | Static | Coins and the Arkenstone gem that players pick up for score and shop currency. | Rotating gold coin or sparkling gem div |

---

## 🛠️ Technical Decisions

### 1. Object-Oriented Programming (OOP)
The engine is structured entirely around standard ES6 classes:
*   **Reasoning**: An OOP design scales perfectly for games. By encapsulating state (e.g., coordinates, health, velocities) and behavior (e.g., movement, physics updates, collision resolution) into specific classes (`Player`, `Enemy`, `Platform`), the codebase remains highly modular, organized, and extensible.
*   **Base Class Inheritance**: A parent `Entity` class coordinates core DOM positioning and dimension attributes, allowing specific subclasses to inherit standard mechanics while defining unique update cycles.

### 2. Pure DOM Manipulation (No Canvas API)
Rather than rendering pixels on a 2D canvas, the game is built entirely using HTML5 DOM manipulation:
*   **Reasoning**: This conforms to learning DOM operations by dynamically generating, updating, and removing standard `div` tags.
*   **Performance Optimization**: To maintain a buttery smooth 60 FPS, the engine uses CSS `transform: translate3d(x, y, 0)` instead of updating layout properties like `left` or `top`. This leverages the GPU for compositing, eliminating layout thrashing and reflows.

---

## 🐛 Known Bugs & Future Fixes
*   *None currently: Initial planning and design phase.*
*   **Planned Fixes / Improvements**:
    1.  Add support for mobile touch controls.
    2.  Implement audio effects and retro background tracks.
    3.  Improve physics friction calculations for smooth stopping momentum.
