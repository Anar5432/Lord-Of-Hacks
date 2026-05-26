// ==========================================================================
// Lord of the Hacks — Game Engine (Canvas API)
// Handles: game loop, physics, AABB collisions, camera, input, rendering
// ==========================================================================

class Game {
    constructor() {
        this.canvas       = document.getElementById('game-canvas');
        this.ctx          = this.canvas.getContext('2d');
        this.VIEWPORT_W   = 800;
        this.VIEWPORT_H   = 470;

        // Disable canvas blur on pixel art
        this.ctx.imageSmoothingEnabled = false;

        // Game state
        this.isRunning        = false;
        this.animationFrameId = null;
        this.gravity          = -0.45;

        // Entities
        this.player      = null;
        this.platforms   = [];
        this.enemies     = [];
        this.projectiles = [];
        this.collectibles = [];
        this.flag        = null;

        // Camera
        this.cameraX  = 0;
        this.worldWidth = 3200;

        // Input map
        this.keys = {};

        // Persistent state
        this.currentLevel   = 1;
        this.coins          = 0;
        this.hasArkenstone  = false;
        this.selectedChar   = 'Hobbit';

        this._setupInput();
    }

    // -----------------------------------------------------------------------
    // Input
    // -----------------------------------------------------------------------
    _setupInput() {
        window.addEventListener('keydown', (e) => {
            if (!this.isRunning) return;
            // Prevent arrow / space page scroll
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))
                e.preventDefault();

            this.keys[e.key] = true;

            // Jump
            if (['ArrowUp', 'w', 'W', ' '].includes(e.key) && this.player)
                this.player.jump();

            // Melee (J or X)
            if (['j', 'J', 'x', 'X'].includes(e.key) && this.player)
                this._triggerMelee();

            // Ranged (K or C)
            if (['k', 'K', 'c', 'C'].includes(e.key) && this.player)
                this._triggerRanged();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    // -----------------------------------------------------------------------
    // Attack helpers
    // -----------------------------------------------------------------------
    _triggerMelee() {
        const p   = this.player;
        const now = Date.now();
        if (now - p.lastAttackTime < p.shootCooldown) return;
        p.lastAttackTime = now;
        p.state       = 'attack-melee';
        p.attackTimer = 22;

        // Spawn slash visual — placed in front of player
        const slashX = p.direction === 1 ? p.x + p.width : p.x - 44;
        this.projectiles.push(new Projectile(slashX, p.y + 4, 0, 0, 'slash', 'player'));

        // Immediate hit check within melee range
        const RANGE = 55;
        this.enemies.forEach(e => {
            if (Math.abs((e.x + e.width / 2) - (p.x + p.width / 2)) < RANGE) {
                e.health -= p.damage;
                e.applyKnockback(p.x);
                this._onEnemyHit(e);
            }
        });
    }

    _triggerRanged() {
        const p   = this.player;
        const now = Date.now();
        if (now - p.lastAttackTime < p.shootCooldown) return;
        p.lastAttackTime = now;
        p.state       = 'attack-ranged';
        p.attackTimer = 22;

        // Rock: starts at player center, travels in arc
        this.projectiles.push(new Projectile(
            p.x + p.width / 2 - 5,
            p.y + p.height * 0.55,
            7 * p.direction,
            4,          // initial upward velocity
            'rock',
            'player'
        ));
    }

    _onEnemyHit(enemy) {
        if (enemy.health <= 0) {
            this.coins += 10;
            this._updateHUD();
        }
    }

    // -----------------------------------------------------------------------
    // Level loading
    // -----------------------------------------------------------------------
    loadLevel(levelIndex) {
        this.currentLevel  = levelIndex;
        const cfg          = LEVELS_CONFIG[levelIndex];
        if (!cfg) return;

        this.platforms    = [];
        this.enemies      = [];
        this.projectiles  = [];
        this.collectibles = [];
        this.flag         = null;
        this.cameraX      = 0;
        this.coins        = 0;
        this.worldWidth   = cfg.width;

        cfg.platforms.forEach(p =>
            this.platforms.push(new Platform(p.x, p.y, p.width, p.height, cfg.theme))
        );
        cfg.enemies.forEach(e =>
            this.enemies.push(new Enemy(e.type, e.x, e.y, e.patrolMinX, e.patrolMaxX))
        );
        cfg.collectibles.forEach(c =>
            this.collectibles.push(new Collectible(c.type, c.x, c.y, c.value))
        );

        this.flag   = new Flag(cfg.flag.x, cfg.flag.y);

        // Spawn player on top of first platform
        const fp  = cfg.platforms[0];
        this.player = new Player(120, fp.y + fp.height + 1, this.selectedChar);

        this._updateHUD();
    }

    // -----------------------------------------------------------------------
    // Game loop
    // -----------------------------------------------------------------------
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._loop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    _loop() {
        if (!this.isRunning) return;
        this._update();
        this._render();
        this.animationFrameId = requestAnimationFrame(() => this._loop());
    }

    // -----------------------------------------------------------------------
    // Update — physics, AI, collisions, interactions
    // -----------------------------------------------------------------------
    _update() {
        if (!this.player) return;

        const p     = this.player;
        const SPEED = 4;

        // --- Player state machine ---
        p.updateState();

        // --- Horizontal movement ---
        if (this.keys['ArrowLeft']  || this.keys['a'] || this.keys['A']) {
            p.vx        = -SPEED;
            p.direction = -1;
        } else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            p.vx        =  SPEED;
            p.direction =  1;
        } else {
            p.vx = 0;
        }

        p.x += p.vx;
        this._resolveHorizontal();

        // Left world boundary
        if (p.x < 0) p.x = 0;

        // --- Gravity + vertical ---
        p.vy += this.gravity;
        p.y  += p.vy;
        this._resolveVertical();

        // --- Enemy AI ---
        this.enemies.forEach(e => e.update());

        // --- Projectile physics ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(this.gravity);
            if (!proj.alive) { this.projectiles.splice(i, 1); continue; }

            // Rock vs enemy hit
            if (proj.type === 'rock' && proj.source === 'player') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    if (this._aabb(proj, this.enemies[j])) {
                        this.enemies[j].health -= 5;
                        this._onEnemyHit(this.enemies[j]);
                        proj.alive = false;
                        break;
                    }
                }
            }
        }

        // --- Remove dead enemies ---
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].health <= 0) {
                this.enemies.splice(i, 1);
            }
        }

        // --- Sting proximity (Hobbit passive) ---
        if (p.charType === 'Hobbit') {
            p.stingGlowing = this.enemies.some(e =>
                (e.type === 'Orc' || e.type === 'Troll') &&
                Math.abs((e.x + e.width / 2) - (p.x + p.width / 2)) < 260
            );
        }

        // --- Collect items ---
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const item = this.collectibles[i];
            if (this._aabb(p, item)) {
                this.coins += item.value;
                if (item.type === 'gem') this.hasArkenstone = true;
                item.alive = false;
                this.collectibles.splice(i, 1);
                this._updateHUD();
            }
        }

        // --- Enemy contact damage (discrete 12hp hit = 3-4 hits to die at 40HP) ---
        this.enemies.forEach(e => {
            if (this._aabb(p, e)) {
                p.takeDamage(12, e.x + e.width / 2); // pass attacker center for knockback direction
                this._updateHUD();
                if (p.health <= 0) this._gameOver();
            }
        });

        // --- Flag / level complete ---
        if (this.flag && this._aabb(p, this.flag)) this._levelComplete();

        // --- Fall off world ---
        if (p.y < -300) this._gameOver();

        // --- Camera ---
        this._updateCamera();
    }

    // -----------------------------------------------------------------------
    // AABB collision resolution
    // -----------------------------------------------------------------------
    _aabb(a, b) {
        return (
            a.x < b.x + b.width  &&
            a.x + a.width  > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    _resolveHorizontal() {
        const p = this.player;
        this.platforms.forEach(pl => {
            if (!this._aabb(p, pl)) return;
            if (p.vx > 0) p.x = pl.x - p.width;
            else if (p.vx < 0) p.x = pl.x + pl.width;
        });
    }

    _resolveVertical() {
        const p = this.player;
        p.isGrounded = false;
        this.platforms.forEach(pl => {
            if (!this._aabb(p, pl)) return;
            if (p.vy <= 0) {
                // Falling — land on top
                p.y          = pl.y + pl.height;
                p.vy         = 0;
                p.isGrounded = true;
            } else {
                // Rising — hit ceiling
                p.y  = pl.y - p.height;
                p.vy = 0;
            }
        });
    }

    // -----------------------------------------------------------------------
    // Camera
    // -----------------------------------------------------------------------
    _updateCamera() {
        const target = this.player.x - this.VIEWPORT_W / 2 + this.player.width / 2;
        const maxCam = Math.max(0, this.worldWidth - this.VIEWPORT_W);
        this.cameraX = Math.max(0, Math.min(target, maxCam));
    }

    // -----------------------------------------------------------------------
    // Render — one clear then draw everything
    // -----------------------------------------------------------------------
    _render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.VIEWPORT_W, this.VIEWPORT_H);

        this._drawBackground();

        this.platforms.forEach(p  => p.draw(ctx, this.cameraX));
        if (this.flag)             this.flag.draw(ctx, this.cameraX);
        this.collectibles.forEach(c => c.draw(ctx, this.cameraX));
        this.enemies.forEach(e    => e.draw(ctx, this.cameraX));
        this.projectiles.forEach(p => p.draw(ctx, this.cameraX));
        if (this.player)           this.player.draw(ctx, this.cameraX);
    }

    // -----------------------------------------------------------------------
    // Themed background drawing (parallax + atmospheric layers)
    // -----------------------------------------------------------------------
    _drawBackground() {
        const ctx   = this.ctx;
        const W     = this.VIEWPORT_W;
        const H     = this.VIEWPORT_H;
        const t     = Date.now();
        const theme = (LEVELS_CONFIG[this.currentLevel] || {}).theme || 'forest';
        const camP1 = this.cameraX * 0.25; // near parallax layer
        const camP2 = this.cameraX * 0.1;  // far parallax layer

        switch (theme) {
            case 'forest': {
                // Deep purple-green night sky
                const sky = ctx.createLinearGradient(0, 0, 0, H);
                sky.addColorStop(0,   '#0A061A');
                sky.addColorStop(0.55,'#12082E');
                sky.addColorStop(1,   '#0A1A0F');
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, W, H);

                // Stars
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                for (let i = 0; i < 60; i++) {
                    // pseudo-random but deterministic per star index
                    const sx = ((i * 137 + 53) % W);
                    const sy = ((i * 89  + 17) % (H * 0.6));
                    const twinkle = 0.3 + Math.abs(Math.sin(t / 800 + i)) * 0.7;
                    ctx.globalAlpha = twinkle;
                    ctx.fillRect(sx, sy, 1.5, 1.5);
                }
                ctx.globalAlpha = 1;

                // Distant tree silhouettes (far layer)
                ctx.fillStyle = '#060E06';
                for (let i = -1; i < 10; i++) {
                    const tx = (i * 120 - camP2 % 120);
                    ctx.beginPath();
                    ctx.moveTo(tx + 10, H);
                    ctx.lineTo(tx + 30, H - 160);
                    ctx.lineTo(tx + 50, H);
                    ctx.fill();
                    ctx.fillRect(tx + 26, H - 100, 8, 100);
                }

                // Mid tree layer (lighter)
                ctx.fillStyle = '#0A1A0A';
                for (let i = -1; i < 14; i++) {
                    const tx = (i * 90 - camP1 % 90);
                    ctx.beginPath();
                    ctx.moveTo(tx + 5, H);
                    ctx.lineTo(tx + 22, H - 120);
                    ctx.lineTo(tx + 40, H);
                    ctx.fill();
                    ctx.fillRect(tx + 18, H - 75, 7, 75);
                }

                // Ground fog strip
                const fog = ctx.createLinearGradient(0, H - 55, 0, H);
                fog.addColorStop(0, 'transparent');
                fog.addColorStop(1, 'rgba(20,50,20,0.45)');
                ctx.fillStyle = fog;
                ctx.fillRect(0, H - 55, W, 55);
                break;
            }

            case 'mines': {
                ctx.fillStyle = '#040208';
                ctx.fillRect(0, 0, W, H);

                // Stalactite clusters on ceiling (far layer)
                ctx.fillStyle = 'rgba(20,22,30,0.9)';
                for (let i = -1; i < 8; i++) {
                    const tx = (i * 140 - camP2 % 140);
                    for (let j = 0; j < 4; j++) {
                        const bx = tx + j * 30;
                        const bh = 30 + (j * 17) % 40;
                        ctx.beginPath();
                        ctx.moveTo(bx, 0);
                        ctx.lineTo(bx + 12, bh);
                        ctx.lineTo(bx + 24, 0);
                        ctx.fill();
                    }
                }

                // Crystal veins on walls (near layer)
                const crystalPulse = 0.12 + Math.sin(t / 700) * 0.06;
                ctx.fillStyle   = `rgba(0,229,255,${crystalPulse})`;
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur  = 8;
                for (let i = -1; i < 7; i++) {
                    const tx = (i * 160 - camP1 % 160);
                    ctx.fillRect(tx, 20, 3, H - 80);
                    ctx.fillRect(tx + 80, 40, 3, H - 80);
                }
                ctx.shadowBlur = 0;

                // Ground lava-glow puddle
                const lavaGrd = ctx.createLinearGradient(0, H - 60, 0, H);
                lavaGrd.addColorStop(0, 'transparent');
                lavaGrd.addColorStop(1, 'rgba(0,60,80,0.3)');
                ctx.fillStyle = lavaGrd;
                ctx.fillRect(0, H - 60, W, 60);
                break;
            }

            case 'mountain': {
                const sky = ctx.createLinearGradient(0, 0, 0, H);
                sky.addColorStop(0, '#1A0602');
                sky.addColorStop(1, '#080100');
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, W, H);

                // Distant peaks (far)
                ctx.fillStyle = '#0F0301';
                ctx.beginPath();
                ctx.moveTo(0, H);
                ctx.lineTo(0, H * 0.45);
                ctx.lineTo(150 - camP2 % 50, H * 0.15);
                ctx.lineTo(300 - camP2 % 50, H * 0.5);
                ctx.lineTo(500 - camP2 % 50, H * 0.1);
                ctx.lineTo(700 - camP2 % 50, H * 0.4);
                ctx.lineTo(W, H * 0.3);
                ctx.lineTo(W, H);
                ctx.fill();

                // Treasure gold glow on ground
                const goldGrd = ctx.createLinearGradient(0, H - 80, 0, H);
                goldGrd.addColorStop(0, 'transparent');
                goldGrd.addColorStop(1, 'rgba(180,130,0,0.18)');
                ctx.fillStyle = goldGrd;
                ctx.fillRect(0, H - 80, W, 80);

                // Gold dust particles
                ctx.fillStyle = 'rgba(255,215,0,0.4)';
                for (let i = 0; i < 25; i++) {
                    const px = ((i * 113 + t * 0.02) % W);
                    const py = H - 80 + ((i * 47) % 60) + Math.sin(t / 400 + i) * 5;
                    ctx.fillRect(px, py, 2, 2);
                }
                break;
            }

            case 'mordor': {
                const sky = ctx.createLinearGradient(0, 0, 0, H);
                sky.addColorStop(0,   '#0C0000');
                sky.addColorStop(0.6, '#1E0300');
                sky.addColorStop(1,   '#3A0800');
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, W, H);

                // Ash clouds
                ctx.fillStyle = 'rgba(30,10,10,0.7)';
                for (let i = -1; i < 6; i++) {
                    const cx = (i * 200 - camP2 % 200);
                    const cy = 20 + (i * 37) % 60 + Math.sin(t / 1200 + i) * 10;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, 80, 28, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Barad-dûr tower silhouette (far background)
                ctx.fillStyle = '#080000';
                const towerX = W * 0.55 - camP2 % 20;
                ctx.fillRect(towerX - 18, 0, 36, H - 40);
                // Tower battlements
                for (let i = 0; i < 4; i++)
                    ctx.fillRect(towerX - 18 + i * 10, 0, 7, 20);

                // Lava glow (bottom)
                const lavaA = 0.35 + Math.sin(t / 600) * 0.12;
                const lavaGrd = ctx.createLinearGradient(0, H - 100, 0, H);
                lavaGrd.addColorStop(0, 'transparent');
                lavaGrd.addColorStop(1, `rgba(220,40,0,${lavaA})`);
                ctx.fillStyle = lavaGrd;
                ctx.fillRect(0, H - 100, W, 100);

                // Eye of Sauron glow on horizon (atmospheric)
                const eyeA = 0.15 + Math.sin(t / 500) * 0.08;
                ctx.fillStyle   = `rgba(255,60,0,${eyeA})`;
                ctx.shadowColor = '#FF3A00';
                ctx.shadowBlur  = 30;
                ctx.beginPath();
                ctx.ellipse(towerX, 12, 20, 14, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
            }
        }
    }

    // -----------------------------------------------------------------------
    // HUD update
    // -----------------------------------------------------------------------
    _updateHUD() {
        const fill  = document.getElementById('health-fill');
        const coins = document.getElementById('hud-coins');
        const gems  = document.getElementById('hud-gems');
        const level = document.getElementById('hud-level');

        if (this.player && fill)
            fill.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
        if (coins) coins.textContent = this.coins;
        if (gems)  gems.textContent  = this.hasArkenstone ? '💎' : '-';
        if (level) level.textContent = this.currentLevel;
    }

    // -----------------------------------------------------------------------
    // Game over / level complete
    // -----------------------------------------------------------------------
    _gameOver() {
        this.stop();
        const score   = this.coins * 10;
        const hiScore = Math.max(score, parseInt(localStorage.getItem('lotr_hiScore') || '0'));
        localStorage.setItem('lotr_hiScore', hiScore);

        const el = document.getElementById('summary-coins');
        const hs = document.getElementById('summary-high-score');
        if (el) el.textContent = this.coins;
        if (hs) hs.textContent = hiScore;

        const screen = document.getElementById('game-over-screen');
        if (screen) screen.classList.remove('hidden');
    }

    _levelComplete() {
        this.stop();
        const nextLevel = this.currentLevel + 1;

        // Save coins to persistent storage
        const saved = parseInt(localStorage.getItem('lotr_totalCoins') || '0');
        localStorage.setItem('lotr_totalCoins', saved + this.coins);

        // Unlock next level
        if (LEVELS_CONFIG[nextLevel]) {
            const unlocked = JSON.parse(localStorage.getItem('lotr_unlocked') || '[1]');
            if (!unlocked.includes(nextLevel)) {
                unlocked.push(nextLevel);
                localStorage.setItem('lotr_unlocked', JSON.stringify(unlocked));
            }
        }

        const vc = document.getElementById('victory-coins');
        const vm = document.getElementById('victory-message');
        if (vc) vc.textContent = this.coins;
        if (vm) vm.textContent = LEVELS_CONFIG[nextLevel]
            ? `Level ${this.currentLevel} complete! The next journey awaits...`
            : '🎉 You have defeated the Eye of Sauron! Middle-earth is saved!';

        const nBtn = document.getElementById('next-level-button');
        if (nBtn) nBtn.style.display = LEVELS_CONFIG[nextLevel] ? '' : 'none';

        const screen = document.getElementById('victory-screen');
        if (screen) screen.classList.remove('hidden');
    }
}

// Export singleton — main.js constructs and stores this
