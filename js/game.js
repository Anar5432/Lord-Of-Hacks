// ==========================================================================
// Lord of the Hacks â€” Game Engine (Canvas API)
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
        this.lives          = 3;

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

            // Invisibility / One Ring (Shift, R, or I)
            if (['Shift', 'r', 'R', 'i', 'I'].includes(e.key) && this.player && this.player.state !== 'death') {
                this.player.isInvisible = !this.player.isInvisible;
                if (window.audioManager) {
                    window.audioManager.playRingToggle(this.player.isInvisible);
                }
            }
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

        if (window.audioManager) window.audioManager.playMelee();

        // Spawn slash visual â€” placed in front of player
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

        if (window.audioManager) window.audioManager.playRanged();

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
        enemy.hitFlash = 12;
        if (enemy.health <= 0 && enemy.state !== 'death') {
            enemy.state = 'death';
            enemy.deathTimer = 40;
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
        this.lives        = 3;

        cfg.platforms.forEach(p =>
            this.platforms.push(new Platform(p.x, p.y, p.width, p.height, cfg.theme, p.type || 'stone'))
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
    // Update â€” physics, AI, collisions, interactions
    // -----------------------------------------------------------------------
    _update() {
        if (!this.player) return;

        const p     = this.player;
        const SPEED = (p.slowTimer && p.slowTimer > 0) ? 2 : 4;

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

        // --- Platform movement & Player riding ---
        let riderDeltaX = 0;
        this.platforms.forEach(pl => {
            if (pl.type === 'suspended-swing') {
                const prevX = pl.x;
                pl.x = pl.baseX + Math.sin(Date.now() / 800) * 45;
                const dx = pl.x - prevX;
                if (p.isGrounded && p.activePlatform === pl) {
                    riderDeltaX = dx;
                }
            } else if (pl.type === 'shaking-platform') {
                if (p.isGrounded && p.activePlatform === pl) {
                    if (!pl.isFalling) {
                        pl.shakeTimer++;
                        if (pl.shakeTimer >= 70) {
                            pl.isFalling = true;
                            p.isGrounded = false;
                            p.activePlatform = null;
                        }
                    }
                }
                if (pl.isFalling) {
                    pl.vy += this.gravity;
                    pl.y += pl.vy;
                }
            }
        });

        p.x += p.vx + riderDeltaX;
        this._resolveHorizontal();

        // Left world boundary
        if (p.x < 0) p.x = 0;

        // --- Gravity + vertical ---
        p.vy += this.gravity;
        p.y  += p.vy;
        this._resolveVertical();

        // Footstep sound timer when player is running on ground
        if (p.state === 'run' && p.isGrounded) {
            if (!this.stepTimer) this.stepTimer = 0;
            this.stepTimer--;
            if (this.stepTimer <= 0) {
                if (window.audioManager) window.audioManager.playStep();
                this.stepTimer = 22; // play every 22 frames (~360ms)
            }
        } else {
            this.stepTimer = 0;
        }

        // --- Enemy AI ---
        this.enemies.forEach(e => e.update(this.player, this));

        // --- Nazgul screams update ---
        if (this.screams) {
            for (let i = this.screams.length - 1; i >= 0; i--) {
                const s = this.screams[i];
                s.r += 3; // expand radius
                if (s.r >= s.maxR) {
                    this.screams.splice(i, 1);
                    continue;
                }
                
                // Hit check with player
                if (!p.isInvisible && p.health > 0) {
                    const dx = p.x + p.width/2 - s.x;
                    const dy = p.y + p.height/2 - s.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < s.r + 15 && dist > s.r - 15) {
                        p.slowTimer = 90; // slow player for 1.5s
                    }
                }
            }
        }

        // --- Burning patches update ---
        if (this.burningPatches) {
            for (let i = this.burningPatches.length - 1; i >= 0; i--) {
                const patch = this.burningPatches[i];
                patch.timeLeft--;
                if (patch.timeLeft <= 0) {
                    this.burningPatches.splice(i, 1);
                    continue;
                }
                
                // Contact/tick damage to player (every 12 frames)
                if (!p.isInvisible && p.health > 0) {
                    if (p.x + p.width > patch.x && p.x < patch.x + patch.width &&
                        Math.abs(p.y - patch.y) < 10) {
                        if (this.animationFrameId % 12 === 0 || Math.floor(Math.random() * 12) === 0) {
                            p.takeDamage(2, patch.x + patch.width/2);
                            this._updateHUD();
                            if (p.health <= 0) this.playerDie();
                        }
                    }
                }
            }
        }

        // --- Projectile physics ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(this.gravity);
            if (!proj.alive) { this.projectiles.splice(i, 1); continue; }

            // Fireball vs platforms hit
            if (proj.type === 'fireball') {
                for (let j = 0; j < this.platforms.length; j++) {
                    const pl = this.platforms[j];
                    if (this._aabb(proj, pl)) {
                        // Explode! Spawn a burning patch on the platform.
                        if (!this.burningPatches) this.burningPatches = [];
                        this.burningPatches.push({
                            x: proj.x - 20,
                            y: pl.y + pl.height,
                            width: 40,
                            height: 12,
                            timeLeft: 180
                        });
                        proj.alive = false;
                        if (window.audioManager && window.audioManager.playHit) window.audioManager.playHit();
                        break;
                    }
                }
            }

            // Rock vs enemy hit
            if (proj.type === 'rock' && proj.source === 'player') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const e = this.enemies[j];
                    if (e.state !== 'death' && this._aabb(proj, e)) {
                        e.health -= 15; // Increased from 5 to 15
                        this._onEnemyHit(e);
                        proj.alive = false;
                        break;
                    }
                }
            }
            // Enemy projectile vs player hit
            else if (proj.source === 'enemy' && !p.isInvisible && p.health > 0 && !p.invincibleTimer) {
                if (this._aabb(proj, p)) {
                    p.takeDamage(10, proj.x);
                    this._updateHUD();
                    proj.alive = false;
                    this.projectiles.splice(i, 1);
                    if (p.health <= 0) this.playerDie();
                    continue;
                }
            }
        }

        // --- Remove dead enemies after death collapse finishes ---
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.health <= 0) {
                if (e.state !== 'death') {
                    e.state = 'death';
                    e.deathTimer = e.type === 'EyeOfSauron' ? 240 : 40;
                }
                if (e.deathTimer <= 0) {
                    this.enemies.splice(i, 1);
                    if (e.type === 'EyeOfSauron') {
                        this._levelComplete();
                    }
                }
            }
        }

        // --- Sting proximity (Hobbit passive) ---
        if (p.charType === 'Hobbit') {
            p.stingGlowing = this.enemies.some(e =>
                e.state !== 'death' &&
                (e.type === 'Orc' || e.type === 'Troll' || e.type === 'UrukHai') &&
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
                if (window.audioManager) window.audioManager.playCoin();
            }
        }

        // --- Enemy contact damage (discrete 12hp hit = 3-4 hits to die at 40HP) ---
        if (!p.isInvisible) {
            this.enemies.forEach(e => {
                if (e.state !== 'death' && this._aabb(p, e)) {
                    p.takeDamage(12, e.x + e.width / 2); // pass attacker center for knockback direction
                    this._updateHUD();
                    if (p.health <= 0) this.playerDie();
                }
            });
        }

        // --- Flag / level complete ---
        if (this.flag && this._aabb(p, this.flag)) {
            const bossAlive = this.enemies.some(e => e.type === 'EyeOfSauron');
            if (!bossAlive) this._levelComplete();
        }

        // --- Fall off world ---
        if (p.y < -300) this.playerDie();

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
            if (pl.isFalling) return; // Skip collision if platform is falling
            if (!this._aabb(p, pl)) return;
            if (p.vx > 0) p.x = pl.x - p.width;
            else if (p.vx < 0) p.x = pl.x + pl.width;
        });
    }

    _resolveVertical() {
        const p = this.player;
        p.isGrounded = false;
        this.platforms.forEach(pl => {
            if (pl.isFalling) return; // Skip collision if platform is falling
            if (!this._aabb(p, pl)) return;
            if (p.vy <= 0) {
                // Falling â€” land on top
                p.y          = pl.y + pl.height;
                p.vy         = 0;
                p.isGrounded = true;
                p.activePlatform = pl;
            } else {
                // Rising â€” hit ceiling
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
    // Render â€” one clear then draw everything
    // -----------------------------------------------------------------------
    _render() {
        const ctx = this.ctx;
        const W   = this.VIEWPORT_W;
        const H   = this.VIEWPORT_H;
        ctx.clearRect(0, 0, W, H);

        ctx.save();
        // Screen shake implementation
        if (this.shakeDuration && this.shakeDuration > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
            this.shakeDuration--;
        }

        this._drawBackground();

        this.platforms.forEach(p  => p.draw(ctx, this.cameraX));
        if (this.flag)             this.flag.draw(ctx, this.cameraX);
        this.collectibles.forEach(c => c.draw(ctx, this.cameraX));
        this.enemies.forEach(e    => e.draw(ctx, this.cameraX));
        this.projectiles.forEach(p => p.draw(ctx, this.cameraX));
        if (this.player)           this.player.draw(ctx, this.cameraX);

        // Draw screams
        if (this.screams) {
            this.screams.forEach(s => {
                ctx.save();
                const sx = s.x - this.cameraX;
                const sy = H - s.y;
                ctx.strokeStyle = `rgba(160, 32, 240, ${1 - (s.r / s.maxR)})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            });
        }

        // Draw burning patches
        if (this.burningPatches) {
            this.burningPatches.forEach(patch => {
                const sx = Math.round(patch.x - this.cameraX);
                const sy = Math.round(H - patch.y - patch.height);
                ctx.save();
                // Draw flickering flame pixels
                ctx.fillStyle = `rgba(255, ${60 + Math.floor(Math.random() * 120)}, 0, 0.85)`;
                for (let px = 0; px < patch.width; px += 8) {
                    const h = 5 + Math.random() * 12;
                    ctx.fillRect(sx + px, sy + patch.height - h, 6, h);
                }
                ctx.restore();
            });
        }

        ctx.restore(); // Restore screen shake state

        // Draw white screen flash
        if (this.flashOpacity && this.flashOpacity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.flashOpacity})`;
            ctx.fillRect(0, 0, W, H);
            this.flashOpacity -= 0.015;
        }
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
                const camFar  = this.cameraX * 0.08;
                const camMid  = this.cameraX * 0.30;
                const camNear = this.cameraX * 0.65;

                // ── 1. SKY GRADIENT — deep ash-purple to blood-red ──────────────────
                const redFactor = Math.min(1.0, this.cameraX / 4000);
                let r1 = Math.round(12 + redFactor * 28);
                let g1 = Math.round(3);
                let b1 = Math.round(14 - redFactor * 10);
                let r2 = Math.round(45 + redFactor * 135);
                let g2 = Math.round(5);
                let b2 = Math.round(5);

                const boss = this.enemies.find(e => e.type === 'EyeOfSauron');
                let collapseProgress = 0;
                if (boss && boss.state === 'death') {
                    collapseProgress = (240 - boss.deathTimer) / 240;
                    r1 = Math.round(r1 * (1 - collapseProgress) + collapseProgress * 135);
                    g1 = Math.round(g1 * (1 - collapseProgress) + collapseProgress * 206);
                    b1 = Math.round(b1 * (1 - collapseProgress) + collapseProgress * 250);
                    r2 = Math.round(r2 * (1 - collapseProgress) + collapseProgress * 255);
                    g2 = Math.round(g2 * (1 - collapseProgress) + collapseProgress * 223);
                    b2 = Math.round(b2 * (1 - collapseProgress) + collapseProgress * 0);
                }

                const sky = ctx.createLinearGradient(0, 0, 0, H);
                sky.addColorStop(0,   `rgb(${r1},${g1},${b1})`);
                sky.addColorStop(0.55,`rgb(${Math.round(r1*1.6)},${g1},${b1})`);
                sky.addColorStop(1,   `rgb(${r2},${g2},${b2})`);
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, W, H);

                // ── 2. BLOOD MOON ───────────────────────────────────────────────────
                if (collapseProgress < 0.5) {
                    const moonX = 620 - camFar * 0.4;
                    const moonY = 58;
                    const moonGrd = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 36);
                    moonGrd.addColorStop(0,   `rgba(255,90,30,${0.9 - collapseProgress})`);
                    moonGrd.addColorStop(0.5, `rgba(200,20,0,${0.55 - collapseProgress*0.4})`);
                    moonGrd.addColorStop(1,   'rgba(120,0,0,0)');
                    ctx.fillStyle = moonGrd;
                    ctx.beginPath();
                    ctx.arc(moonX, moonY, 36, 0, Math.PI * 2);
                    ctx.fill();
                    // Moon core
                    ctx.fillStyle = `rgba(255,120,50,${0.8 - collapseProgress})`;
                    ctx.beginPath();
                    ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
                    ctx.fill();
                }

                // ── 3. ASH CLOUD LAYERS (3 parallax layers, rolling left) ───────────
                const ashSpeeds = [0.018, 0.028, 0.042];
                const ashColors = [
                    'rgba(18,8,8,0.55)',
                    'rgba(25,10,5,0.45)',
                    'rgba(35,12,4,0.35)'
                ];
                const ashYBands = [
                    { y: 10,  maxH: 55 },
                    { y: 30,  maxH: 70 },
                    { y: 0,   maxH: 45 }
                ];
                for (let layer = 0; layer < 3; layer++) {
                    ctx.fillStyle = ashColors[layer];
                    const band = ashYBands[layer];
                    for (let i = 0; i < 7; i++) {
                        const cloudW = 180 + (i * 53 % 120);
                        const cloudH = 30 + (i * 31 % band.maxH);
                        // scroll time-based + small parallax per layer
                        const cx2 = ((i * 230 - t * ashSpeeds[layer] + layer * 90) % (W + cloudW + 50) + W + cloudW + 50) % (W + cloudW + 50) - cloudW;
                        const cy  = band.y + (i * 17 % 35) + Math.sin(t / 1800 + i + layer) * 8;
                        ctx.beginPath();
                        ctx.ellipse(cx2 + cloudW/2, cy + cloudH/2, cloudW/2, cloudH/2, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // ── 4. LIGHTNING ────────────────────────────────────────────────────
                if (!this.lightningTimer) this.lightningTimer = 100;
                if (this.lightningActive === undefined) this.lightningActive = false;
                this.lightningTimer--;
                if (this.lightningTimer <= 0) {
                    this.lightningActive = Math.random() < 0.35;
                    this.lightningTimer = 80 + Math.random() * 150;
                }
                if (this.lightningActive && Math.floor(t / 70) % 2 === 0) {
                    ctx.fillStyle = `rgba(255,200,200,${0.12 + Math.random() * 0.18})`;
                    ctx.fillRect(0, 0, W, H);
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,235,235,0.82)';
                    ctx.lineWidth = 2.5;
                    ctx.shadowColor = '#FF3A00';
                    ctx.shadowBlur = 14;
                    ctx.beginPath();
                    let lx = 150 + (t % 500);
                    let ly = 0;
                    ctx.moveTo(lx, ly);
                    for (let step = 0; step < 7; step++) {
                        lx += -25 + Math.random() * 50;
                        ly += 30 + Math.random() * 20;
                        ctx.lineTo(lx, ly);
                    }
                    ctx.stroke();
                    ctx.restore();
                } else if (this.lightningActive && this.lightningTimer < 60) {
                    this.lightningActive = false;
                }

                // ── 5. MOUNT DOOM (far layer) ───────────────────────────────────────
                ctx.save();
                const mDoomX = 1100 - camFar;

                // Mountain silhouette
                ctx.fillStyle = '#050101';
                ctx.beginPath();
                ctx.moveTo(mDoomX - 280, H);
                ctx.lineTo(mDoomX - 55, H - 185);
                ctx.lineTo(mDoomX + 55, H - 185);
                ctx.lineTo(mDoomX + 280, H);
                ctx.fill();

                // Lava horizon glow around mountain base
                const mGrd = ctx.createRadialGradient(mDoomX, H, 0, mDoomX, H - 185, 280);
                mGrd.addColorStop(0,   'rgba(255,60,0,0.22)');
                mGrd.addColorStop(0.4, 'rgba(200,20,0,0.1)');
                mGrd.addColorStop(1,   'rgba(0,0,0,0)');
                ctx.fillStyle = mGrd;
                ctx.fillRect(mDoomX - 290, H - 280, 580, 280);

                // Glowing crater
                const craterGrd = ctx.createRadialGradient(mDoomX, H - 185, 0, mDoomX, H - 185, 68);
                craterGrd.addColorStop(0,   'rgba(255,200,50,0.95)');
                craterGrd.addColorStop(0.25,'rgba(255,80,0,0.85)');
                craterGrd.addColorStop(0.65,'rgba(200,20,0,0.4)');
                craterGrd.addColorStop(1,   'rgba(0,0,0,0)');
                ctx.fillStyle = craterGrd;
                ctx.beginPath();
                ctx.ellipse(mDoomX, H - 185, 68, 12, 0, 0, Math.PI * 2);
                ctx.fill();

                // Lava flows down the mountain
                ctx.save();
                ctx.strokeStyle = `rgba(255,${80 + Math.floor(Math.sin(t/300)*30)},0,0.85)`;
                ctx.lineWidth = 3;
                ctx.shadowColor = '#FF4500';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(mDoomX - 22, H - 185);
                ctx.bezierCurveTo(mDoomX - 38, H - 130, mDoomX - 60, H - 80, mDoomX - 100, H);
                ctx.moveTo(mDoomX + 18, H - 185);
                ctx.bezierCurveTo(mDoomX + 34, H - 120, mDoomX + 60, H - 75, mDoomX + 90, H);
                ctx.stroke();
                ctx.restore();

                // Eruption smoke billows (bigger, darker)
                for (let i = 0; i < 6; i++) {
                    const smokeProg = ((t / 55 + i * 22) % 120) / 120;
                    const smokeAlpha = 0.7 * (1 - smokeProg);
                    const smokeSz   = (18 + i * 10) * (0.4 + smokeProg * 0.8);
                    const smokeX    = mDoomX + Math.sin(t / 500 + i * 1.2) * (8 + i * 4);
                    const smokeY    = H - 195 - smokeProg * (80 + i * 14);
                    ctx.fillStyle   = `rgba(${22 + i * 4},${8 + i * 2},${5 + i},${smokeAlpha})`;
                    ctx.beginPath();
                    ctx.arc(smokeX, smokeY, smokeSz, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Lava sparks / eruption particles
                ctx.save();
                ctx.shadowColor = '#FF6600';
                ctx.shadowBlur = 6;
                for (let i = 0; i < 20; i++) {
                    const ang  = (i * 37 + t * 0.012) % (Math.PI * 2);
                    const dist = 12 + (i * 7 % 30);
                    const spLife = ((t * 0.09 + i * 28) % 100) / 100;
                    const spX  = mDoomX + Math.cos(ang) * dist * (0.3 + spLife);
                    const spY  = H - 185 - spLife * (60 + (i % 5) * 16);
                    const spSz = 2.5 * (1 - spLife);
                    ctx.fillStyle = `rgba(255,${100 + Math.floor(spLife * 155)},0,${0.9 * (1 - spLife)})`;
                    ctx.fillRect(spX, spY, spSz, spSz);
                }
                ctx.restore();
                ctx.restore();

                // ── 6. BARAD-DÛR TOWER (mid layer) ─────────────────────────────────
                const towerX      = 1800 - camMid;
                const towerOffset = collapseProgress * 350;
                ctx.save();
                ctx.fillStyle = '#040206';

                ctx.fillRect(towerX - 55, H - 350 + towerOffset, 110, 350);
                ctx.beginPath();
                ctx.moveTo(towerX - 90, H + towerOffset);
                ctx.lineTo(towerX - 55, H - 230 + towerOffset);
                ctx.lineTo(towerX - 55, H + towerOffset);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(towerX + 90, H + towerOffset);
                ctx.lineTo(towerX + 55, H - 230 + towerOffset);
                ctx.lineTo(towerX + 55, H + towerOffset);
                ctx.fill();
                ctx.fillRect(towerX - 40, H - 410 + towerOffset, 80, 60);
                ctx.beginPath();
                ctx.moveTo(towerX - 40, H - 410 + towerOffset);
                ctx.lineTo(towerX - 50, H - 460 + towerOffset);
                ctx.lineTo(towerX - 20, H - 410 + towerOffset);
                ctx.lineTo(towerX + 20, H - 410 + towerOffset);
                ctx.lineTo(towerX + 50, H - 460 + towerOffset);
                ctx.lineTo(towerX + 40, H - 410 + towerOffset);
                ctx.closePath();
                ctx.fill();

                // Glowing window slots on tower
                ctx.fillStyle = `rgba(255,60,0,${0.5 + Math.sin(t/280)*0.2})`;
                ctx.shadowColor = '#FF3000';
                ctx.shadowBlur = 8;
                for (let w = 0; w < 3; w++) {
                    ctx.fillRect(towerX - 4, H - 280 - w * 40 + towerOffset, 8, 14);
                }
                ctx.shadowBlur = 0;

                // Falling stones during collapse
                if (collapseProgress > 0 && boss && boss.deathTimer > 0) {
                    ctx.fillStyle = '#060307';
                    for (let sIdx = 0; sIdx < 12; sIdx++) {
                        const blockX = towerX + Math.sin(sIdx * 113 + t * 0.04) * 60;
                        const blockY = H - 350 + (collapseProgress * 500 + sIdx * 25) % 350;
                        ctx.fillRect(blockX - 4, blockY - 4, 8 + sIdx % 4, 8 + sIdx % 4);
                    }
                }

                // ── 7. EYE OF SAURON + SEARCHLIGHT ──────────────────────────────────
                const eyeX     = towerX;
                const eyeY     = H - 425 + towerOffset;
                const eyePulse = Math.sin(t / 220) * 3.5;

                if (collapseProgress < 0.9) {
                    if (collapseProgress > 0) {
                        ctx.fillStyle = `rgba(255,${150 + Math.floor(Math.random()*105)},200,${1 - collapseProgress})`;
                        ctx.beginPath();
                        ctx.arc(eyeX, eyeY, 15 + collapseProgress * 180, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Eye outer glow
                        const eyeOuter = ctx.createRadialGradient(eyeX, eyeY, 2, eyeX, eyeY, 35 + eyePulse);
                        eyeOuter.addColorStop(0,   'rgba(255,150,0,0.9)');
                        eyeOuter.addColorStop(0.35, 'rgba(230,30,0,0.55)');
                        eyeOuter.addColorStop(1,    'rgba(180,0,0,0)');
                        ctx.fillStyle = eyeOuter;
                        ctx.beginPath();
                        ctx.arc(eyeX, eyeY, 35 + eyePulse, 0, Math.PI * 2);
                        ctx.fill();

                        // Eye inner core
                        const eyeGrd = ctx.createRadialGradient(eyeX, eyeY, 1.5, eyeX, eyeY, 18 + eyePulse);
                        eyeGrd.addColorStop(0,   'rgba(255,200,50,1.0)');
                        eyeGrd.addColorStop(0.4,  'rgba(255,60,0,0.85)');
                        eyeGrd.addColorStop(1,    'rgba(255,0,0,0)');
                        ctx.fillStyle = eyeGrd;
                        ctx.beginPath();
                        ctx.arc(eyeX, eyeY, 22 + eyePulse, 0, Math.PI * 2);
                        ctx.fill();

                        // Slit pupil
                        ctx.fillStyle = '#050000';
                        ctx.beginPath();
                        ctx.ellipse(eyeX, eyeY, 2.5, 9, 0, 0, Math.PI * 2);
                        ctx.fill();

                        // Sweeping searchlight beam (wider, brighter)
                        ctx.save();
                        const sweepAngle = Math.sin(t / 1200) * 0.45 + 0.4;
                        ctx.translate(eyeX, eyeY);
                        ctx.rotate(sweepAngle);
                        const beamGrd = ctx.createLinearGradient(0, 0, 0, 600);
                        beamGrd.addColorStop(0,   'rgba(255,80,0,0.50)');
                        beamGrd.addColorStop(0.35, 'rgba(255,30,0,0.20)');
                        beamGrd.addColorStop(0.7,  'rgba(255,0,0,0.06)');
                        beamGrd.addColorStop(1,    'rgba(255,0,0,0)');
                        ctx.fillStyle = beamGrd;
                        ctx.beginPath();
                        ctx.moveTo(-6, 0);
                        ctx.lineTo(-90, 600);
                        ctx.lineTo(90, 600);
                        ctx.lineTo(6, 0);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                }
                ctx.restore();

                // ── 8. NAZGÛL FLYERS ────────────────────────────────────────────────
                ctx.fillStyle = '#020104';
                for (let n = 0; n < 3; n++) {
                    const speed = 1.4 + n * 0.55;
                    const nx = ((t * 0.038 * speed + n * 1500) % (W * 4)) - camMid * 0.25;
                    if (nx >= -70 && nx <= W + 70) {
                        const ny   = 62 + n * 45 + Math.sin(t / 300 + n) * 12;
                        const flap = Math.sin(t / 110 + n) * 8;
                        ctx.beginPath();
                        ctx.moveTo(nx, ny);
                        ctx.lineTo(nx - 18, ny - 6 + flap);
                        ctx.lineTo(nx - 7,  ny + 2);
                        ctx.lineTo(nx,      ny + 5);
                        ctx.lineTo(nx + 7,  ny + 2);
                        ctx.lineTo(nx + 18, ny - 6 + flap);
                        ctx.lineTo(nx, ny);
                        ctx.fill();
                    }
                }

                // ── 9. NEAR ROCK SILHOUETTES ────────────────────────────────────────
                ctx.fillStyle = '#030105';
                for (let k = 0; k < 12; k++) {
                    const kx = k * 450 - camNear;
                    if (kx >= -120 && kx <= W + 120) {
                        ctx.beginPath();
                        ctx.moveTo(kx - 90, H);
                        ctx.lineTo(kx,      H - 72);
                        ctx.lineTo(kx + 90, H);
                        ctx.fill();
                    }
                }

                // Hanging chains
                ctx.strokeStyle = '#100C16';
                ctx.lineWidth = 4;
                for (let c = 0; c < 6; c++) {
                    const cxc = c * 850 - camNear;
                    if (cxc >= -220 && cxc <= W + 220) {
                        ctx.beginPath();
                        ctx.moveTo(cxc, 0);
                        ctx.quadraticCurveTo(cxc + 120, H * 0.40, cxc + 240, 0);
                        ctx.stroke();
                    }
                }

                // ── 10. ANIMATED LAVA RIVER at ground level ─────────────────────────
                // 3 sub-layers: deep glow, wave surface, bright crest highlights
                const lavaPulse = 0.6 + Math.sin(t / 300) * 0.2;
                const lavaDeep = ctx.createLinearGradient(0, H - 22, 0, H);
                lavaDeep.addColorStop(0, `rgba(220,40,0,${lavaPulse * 0.7})`);
                lavaDeep.addColorStop(1, `rgba(255,100,0,${lavaPulse})`);
                ctx.fillStyle = lavaDeep;
                ctx.fillRect(0, H - 22, W, 22);

                // Wave surface shimmer
                ctx.save();
                ctx.globalAlpha = 0.55;
                for (let lv = 0; lv < 12; lv++) {
                    const waveX = ((lv * 90 + t * 0.04) % W);
                    const waveH = 3 + Math.sin(t / 200 + lv) * 2;
                    ctx.fillStyle = `rgba(255,${160 + lv * 5},30,0.7)`;
                    ctx.fillRect(waveX, H - 22 - waveH, 30 + lv * 3, waveH);
                }
                ctx.globalAlpha = 1;
                ctx.restore();

                // ── 11. FLOATING FIRE EMBERS ────────────────────────────────────────
                for (let i = 0; i < 45; i++) {
                    const px    = ((i * 137 - t * 0.048) % W + W) % W;
                    const py    = ((i * 61  + t * 0.060) % (H - 20));
                    const size  = 1.5 + (i % 3) * 0.8;
                    const alpha = 0.4 + (Math.sin(t / 300 + i) * 0.3);
                    const hue   = 20 + (i % 5) * 6;
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    if (i % 3 === 0) {
                        ctx.shadowColor = '#FF4500';
                        ctx.shadowBlur  = 5;
                    }
                    ctx.fillStyle = `hsl(${hue},100%,60%)`;
                    ctx.beginPath();
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // ── 12. LAVA HEAT GLOW at bottom ────────────────────────────────────
                const heatA = 0.28 + Math.sin(t / 420) * 0.07;
                const heatGrd = ctx.createLinearGradient(0, H - 110, 0, H);
                heatGrd.addColorStop(0, 'transparent');
                heatGrd.addColorStop(1, `rgba(255,40,0,${heatA})`);
                ctx.fillStyle = heatGrd;
                ctx.fillRect(0, H - 110, W, 110);

                // Radial lava heat pools
                for (let lp = 0; lp < 4; lp++) {
                    const lpx = (lp * 280 - camNear * 0.3 + W * 0.1) % (W + 200) - 100;
                    const lpGrd = ctx.createRadialGradient(lpx, H, 0, lpx, H, 80);
                    lpGrd.addColorStop(0,   `rgba(255,80,0,${0.35 + Math.sin(t/500 + lp)*0.1})`);
                    lpGrd.addColorStop(0.5, `rgba(180,20,0,0.12)`);
                    lpGrd.addColorStop(1,   'transparent');
                    ctx.fillStyle = lpGrd;
                    ctx.fillRect(lpx - 80, H - 80, 160, 80);
                }

                // ── 13. RED SCREEN TINT (deepens near Barad-dûr) ────────────────────
                const tintOpacity = Math.min(0.38, (this.cameraX / 4000) * 0.38);
                if (tintOpacity > 0.01) {
                    ctx.fillStyle = `rgba(210,0,0,${tintOpacity})`;
                    ctx.fillRect(0, 0, W, H);
                }
                break;
            }
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
        const lives = document.getElementById('hud-lives');

        if (this.player && fill)
            fill.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
        if (coins) coins.textContent = this.coins;
        if (gems)  gems.textContent  = this.hasArkenstone ? 'ðŸ’Ž' : '-';
        if (level) level.textContent = this.currentLevel;
        if (lives) lives.textContent = 'â¤ï¸'.repeat(this.lives) || 'ðŸ’€';
    }

    playerDie() {
        this.lives--;
        if (window.audioManager) window.audioManager.playHit();
        
        if (this.lives > 0) {
            this.respawnPlayer();
        } else {
            this._gameOver();
        }
        this._updateHUD();
    }

    respawnPlayer() {
        const p = this.player;
        p.health = p.maxHealth;
        p.state = 'idle';
        p.vx = 0;
        p.vy = 0;
        p.invincibleTimer = 120; // 2 seconds of invincibility
        p.isInvisible = false;   // disable invisibility on respawn

        // Reset all platforms (for shaking/falling platforms)
        this.platforms.forEach(pl => {
            if (typeof pl.reset === 'function') pl.reset();
        });
        
        // Move back horizontally (one step back)
        let targetX = Math.max(120, p.x - 200);
        
        // Find the closest platform that is near the targetX
        let bestPlatform = this.platforms[0];
        let minDist = Infinity;
        
        this.platforms.forEach(pl => {
            if (pl.type === 'broken-bridge' || pl.type === 'shaking-platform') return; // Skip unsafe platforms
            const dist = Math.abs(pl.x + pl.width / 2 - targetX);
            if (dist < minDist) {
                minDist = dist;
                bestPlatform = pl;
            }
        });
        
        // Place player safely on top of this platform
        p.x = bestPlatform.x + bestPlatform.width / 2 - p.width / 2;
        p.y = bestPlatform.y + bestPlatform.height + 5;
        p.isGrounded = true;
        
        this._updateHUD();
    }

    // -----------------------------------------------------------------------
    // Game over / level complete
    // -----------------------------------------------------------------------
    _gameOver() {
        this.stop();
        const score   = this.coins * 10;
        let savedHi = parseInt(localStorage.getItem('lotr_hiScore') || '0');
        if (isNaN(savedHi)) savedHi = 0;
        const hiScore = Math.max(score, savedHi);
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
            let unlocked = [1];
            try {
                const stored = localStorage.getItem('lotr_unlocked');
                if (stored) unlocked = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse unlocked levels:", e);
            }
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
            : 'ðŸŽ‰ You have defeated the Eye of Sauron! Middle-earth is saved!';

        const nBtn = document.getElementById('next-level-button');
        if (nBtn) nBtn.style.display = LEVELS_CONFIG[nextLevel] ? '' : 'none';

        const screen = document.getElementById('victory-screen');
        if (screen) screen.classList.remove('hidden');
    }
}

// Export singleton â€” main.js constructs and stores this
