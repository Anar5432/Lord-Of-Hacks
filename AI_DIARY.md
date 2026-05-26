# AI Development Diary

This log documents the AI-assisted development workflow for the Vanilla JS Videogame project.

## AI Tools & Workflow

### 1. Grok (Creative Direction & Lore)
- **Role**: Designing the storyline, characters, enemies, and game structure.
- **Why**: Provided superior, highly detailed narrative answers during initial concepts.

### 2. Gemini (Visuals & Assets)
- **Role**: Generating concept art, images, and graphics.
- **Why**: Selected for its advanced image-creation capabilities.

### 3. Antigravity (Coding & Execution)
- **Role**: Writing, debugging, and implementing the Vanilla JS + Canvas API code.
- **Why**: Direct workspace access for code development and execution.

---

## Architecture Decision Log

### 2026-05-25 — Switched from DOM rendering to Canvas API

**Context:** Initial version built game entities as positioned HTML `div` elements styled with CSS. While functional for physics, the visual output was generic colored boxes — not matching the retro pixel-art design specification.

**Decision:** After re-reading the project rules, **Canvas API is explicitly in the Allowed list**. The game renderer was pivoted to use `<canvas>` + `ctx.getContext('2d')` for all in-game drawing.

**Impact on files:**
- `index.html` → `<canvas id="game-canvas">` replaces the `#game-world` div
- `js/entities.js` → Entities lose DOM elements; gain a `draw(ctx, cameraX)` method
- `js/game.js` → Main render loop calls `ctx.clearRect()` then draws all entities per frame
- `style.css` → Only styles HTML UI overlays now (menus, HUD, screens)

**Why this is better:** Canvas allows drawing the Hobbit with curly hair, a green cloak, sword slash arcs, and glowing effects — matching the Frodo-style design sheet. CSS divs cannot achieve this level of visual fidelity.

---

## AI Failure Log

*This section will log occurrences where an AI provided incorrect or broken code, requiring manual intervention.*

### Entry 1: 2026-05-26 - Programmatic Hobbit looked cartoonish/mushroom-like
**What I asked the AI:** Recreate the Hobbit character using Canvas drawing functions.
**What it gave me:** A draw method using basic circles (`ctx.arc`) and ovals (`ctx.ellipse`).
**What was wrong:** The visual output was too simple, smooth, and looked like a basic vector mushroom instead of retro 16-bit pixel art.
**How I fixed it:** Pivoted to generating a detailed sprite sheet, cropping the frames, removing the background, and rendering them via `ctx.drawImage` in Base64 data format.
**Time lost:** ~25 minutes

### Entry 2: 2026-05-26 - Headless Chrome DOM dump missed base64 value
**What I asked the AI:** Extract the base64 sprite sheet string from the DOM after rendering.
**What it gave me:** A script setting `textarea.value = base64` and taking the DOM dump.
**What was wrong:** DOM dump in Chrome headless only prints the serializable HTML, which doesn't include the dynamically updated value property of textareas.
**How I fixed it:** Updated the script to set `textarea.textContent = base64` which writes it directly to the DOM HTML tree.
**Time lost:** ~10 minutes

### Entry 3: 2026-05-26 - Regex extracted the wrong base64 image URL
**What I asked the AI:** Parse `dom_output.txt` and extract the base64 data URL.
**What it gave me:** A simple `/data:image\/png;base64,.../` regex.
**What was wrong:** It matched the first base64 image in the document, which was the original large white-background sprite sheet, instead of the cropped transparent one inside the textarea.
**How I fixed it:** Targeted the regex specifically inside the textarea tag: `/<textarea id="base64-output">([^<]+)<\/textarea>/.`
**Time lost:** ~15 minutes

### Entry 4: 2026-05-26 - Headless screenshot captured empty sprites on load
**What I asked the AI:** Render the canvas and take a screenshot of the Hobbit poses.
**What it gave me:** A script that drew the player immediately on load.
**What was wrong:** `new Image()` with a base64 source is still loaded asynchronously by the browser, resulting in blank/invisible sprites when screenshotted immediately.
**How I fixed it:** Wrapped the rendering logic in the `onload` handler of the sprite sheet image to guarantee it is complete before taking the screenshot.
**Time lost:** ~12 minutes

### Entry 5: 2026-05-26 - Sound effect timing lag
**What I asked the AI:** Implement synthesized retro sounds for walking and running.
**What it gave me:** Triggering a walking sound every frame the player velocity was non-zero.
**What was wrong:** Playing sound every frame created a high-frequency buzz/noise because too many sounds played simultaneously.
**How I fixed it:** Added a step timer (`stepTimer = 22` frames) to throttle footsteps to play only every ~360ms while running.
**Time lost:** ~8 minutes

## The images we got:
![alt text](design2.jpeg)

# The first referance image:
![alt text](image.png)
