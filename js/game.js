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
        this.currentLevel   = 4;
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
    // Update — physics, AI, collisions, interactions
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
                        e.health -= 5;
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
                p.activePlatform = pl;
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
                const camFar = this.cameraX * 0.1;
                const camMid = this.cameraX * 0.35;
                const camNear = this.cameraX * 0.70;
                
                // 1. SKY GRADIENT (Horizontal transition from deep ash-purple to blood-red as camera advances)
                const redFactor = Math.min(1.0, this.cameraX / 4000);
                let r1 = Math.round(12 + redFactor * 28);
                let g1 = Math.round(3 - redFactor * 2);
                let b1 = Math.round(14 - redFactor * 10);
                let r2 = Math.round(45 + redFactor * 135);
                let g2 = Math.round(5 + redFactor * 3);
                let b2 = Math.round(5 + redFactor * 3);
                
                // Final Cinematic: check if boss is collapsing and transition sky to gold/blue
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
                sky.addColorStop(0, `rgb(${r1},${g1},${b1})`);
                sky.addColorStop(1, `rgb(${r2},${g2},${b2})`);
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, W, H);

                // 2. LIGHTNING STORM EFFECT
                if (!this.lightningTimer) this.lightningTimer = 100;
                if (this.lightningActive === undefined) this.lightningActive = false;
                
                this.lightningTimer--;
                if (this.lightningTimer <= 0) {
                    this.lightningActive = Math.random() < 0.35;
                    this.lightningTimer = 80 + Math.random() * 150; // trigger check every 1.5-3 seconds
                }
                
                if (this.lightningActive && Math.floor(t / 70) % 2 === 0) {
                    // Flash the background
                    ctx.fillStyle = `rgba(255, 200, 200, ${0.15 + Math.random() * 0.2})`;
                    ctx.fillRect(0, 0, W, H);
                    
                    // Draw a lightning bolt
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 235, 235, 0.85)';
                    ctx.lineWidth = 2.5;
                    ctx.shadowColor = '#FF3A00';
                    ctx.shadowBlur = 12;
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
                    // Turn off active flash state after a short burst
                    this.lightningActive = false;
                }

                // 3. FAR LAYER: ERUPTING MOUNT DOOM (left/middle background)
                ctx.save();
                const mDoomX = 1100 - camFar;
                // Draw Mountain silhouette
                ctx.fillStyle = '#080203';
                ctx.beginPath();
                ctx.moveTo(mDoomX - 220, H);
                ctx.lineTo(mDoomX - 60, H - 170); // Crater rim left
                ctx.lineTo(mDoomX + 60, H - 170); // Crater rim right
                ctx.lineTo(mDoomX + 220, H);
                ctx.fill();
                
                // Glowing crater lava
                ctx.fillStyle = '#FF3C00';
                ctx.shadowColor = '#FF3C00';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.ellipse(mDoomX, H - 170, 60, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                // Lava flows running down mountain
                ctx.strokeStyle = '#FF4500';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(mDoomX - 25, H - 170);
                ctx.quadraticCurveTo(mDoomX - 45, H - 100, mDoomX - 80, H);
                ctx.moveTo(mDoomX + 15, H - 170);
                ctx.quadraticCurveTo(mDoomX + 35, H - 110, mDoomX + 55, H);
                ctx.stroke();
                
                // Erupting smoke billows
                ctx.fillStyle = 'rgba(38, 18, 18, 0.72)';
                for (let i = 0; i < 4; i++) {
                    const sx = mDoomX + Math.sin(t / 600 + i) * 12;
                    const sy = H - 180 - (i * 24) - ((t / 70) % 20);
                    ctx.beginPath();
                    ctx.arc(sx, sy, 18 + i * 6, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Lava sparks flying up
                ctx.fillStyle = 'rgba(255, 90, 0, 0.9)';
                for (let i = 0; i < 12; i++) {
                    const spX = mDoomX + Math.sin(i * 97 + t * 0.006) * (20 + (i * 5) % 35);
                    const spY = H - 180 - ((t * 0.07 + i * 40) % 100);
                    ctx.fillRect(spX, spY, 2.5, 2.5);
                }
                ctx.restore();

                // 4. MIDDLE LAYER: BARAD-DUR (Centered when cameraX reaches 4000)
                // At cameraX = 4000, camMid = 1400. To center it on screen (X=400), tower position = 1800.
                const towerX = 1800 - camMid;
                const towerOffset = collapseProgress * 350;
                
                ctx.save();
                ctx.fillStyle = '#060307';
                // Tower Base
                ctx.fillRect(towerX - 55, H - 350 + towerOffset, 110, 350);
                // Tower Side spikes
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
                // Mid tower block
                ctx.fillRect(towerX - 40, H - 410 + towerOffset, 80, 60);
                // Crown horns / battlements
                ctx.beginPath();
                ctx.moveTo(towerX - 40, H - 410 + towerOffset);
                ctx.lineTo(towerX - 50, H - 460 + towerOffset); // Left fork
                ctx.lineTo(towerX - 20, H - 410 + towerOffset);
                ctx.lineTo(towerX + 20, H - 410 + towerOffset);
                ctx.lineTo(towerX + 50, H - 460 + towerOffset); // Right fork
                ctx.lineTo(towerX + 40, H - 410 + towerOffset);
                ctx.closePath();
                ctx.fill();
                
                // Falling stone crumbles during collapse
                if (collapseProgress > 0 && boss && boss.deathTimer > 0) {
                    ctx.fillStyle = '#060307';
                    for (let sIdx = 0; sIdx < 12; sIdx++) {
                        const blockX = towerX + Math.sin(sIdx * 113 + t * 0.04) * 60;
                        const blockY = H - 350 + (collapseProgress * 500 + sIdx * 25) % 350;
                        ctx.fillRect(blockX - 4, blockY - 4, 8 + sIdx % 4, 8 + sIdx % 4);
                    }
                }

                // 5. THE EYE OF SAURON & SEARCHLIGHT (At top of Barad-dûr)
                const eyeX = towerX;
                const eyeY = H - 425 + towerOffset;
                const eyePulse = Math.sin(t / 220) * 3.5;
                
                // Skip drawing eye/searchlight if fully collapsed or exploding
                if (collapseProgress < 0.9) {
                    if (collapseProgress > 0) {
                        // Exploding eye expanding circles
                        ctx.fillStyle = `rgba(255, ${150 + Math.floor(Math.random()*105)}, 200, ${1 - collapseProgress})`;
                        ctx.beginPath();
                        ctx.arc(eyeX, eyeY, 15 + collapseProgress * 180, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Orange-red pupil glow
                        const eyeGrd = ctx.createRadialGradient(eyeX, eyeY, 1.5, eyeX, eyeY, 18 + eyePulse);
                        eyeGrd.addColorStop(0, 'rgba(255, 120, 0, 1.0)');
                        eyeGrd.addColorStop(0.4, 'rgba(230, 30, 0, 0.7)');
                        eyeGrd.addColorStop(1, 'rgba(255, 0, 0, 0)');
                        ctx.fillStyle = eyeGrd;
                        ctx.beginPath();
                        ctx.arc(eyeX, eyeY, 22 + eyePulse, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Slit black center
                        ctx.fillStyle = '#100000';
                        ctx.beginPath();
                        ctx.ellipse(eyeX, eyeY, 2.2, 8, 0, 0, Math.PI * 2);
                        ctx.fill();

                        // Sweeping Searchlight (only sweep if not dead/collapsing)
                        ctx.save();
                        // Angled downwards, sweeping left-right
                        const sweepAngle = Math.sin(t / 1400) * 0.32 + 0.35;
                        ctx.translate(eyeX, eyeY);
                        ctx.rotate(sweepAngle);
                        
                        const beamGrd = ctx.createLinearGradient(0, 0, 0, 550);
                        beamGrd.addColorStop(0, 'rgba(255, 60, 0, 0.40)');
                        beamGrd.addColorStop(0.5, 'rgba(255, 30, 0, 0.12)');
                        beamGrd.addColorStop(1, 'rgba(255, 0, 0, 0)');
                        ctx.fillStyle = beamGrd;
                        ctx.beginPath();
                        ctx.moveTo(-4, 0);
                        ctx.lineTo(-65, 550);
                        ctx.lineTo(65, 550);
                        ctx.lineTo(4, 0);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                }
                ctx.restore();

                // 6. MIDGROUND NOISE: Nazgûl flyer silhouettes
                ctx.fillStyle = '#030105';
                for (let n = 0; n < 2; n++) {
                    const speed = 1.6 + n * 0.6;
                    const nx = ((t * 0.04 * speed + n * 1400) % (4800 * 0.35)) - camMid;
                    if (nx >= -60 && nx <= W + 60) {
                        const ny = 70 + n * 50 + Math.sin(t / 320 + n) * 10;
                        const flap = Math.sin(t / 130 + n) * 6;
                        ctx.beginPath();
                        ctx.moveTo(nx, ny);
                        ctx.lineTo(nx - 16, ny - 5 + flap);
                        ctx.lineTo(nx - 6, ny + 1);
                        ctx.lineTo(nx, ny + 4);
                        ctx.lineTo(nx + 6, ny + 1);
                        ctx.lineTo(nx + 16, ny - 5 + flap);
                        ctx.lineTo(nx, ny);
                        ctx.fill();
                    }
                }

                // 7. NEAR LAYER: Background rock silhouettes & chains (cameraX * 0.70)
                ctx.fillStyle = '#050206';
                for (let k = 0; k < 12; k++) {
                    const kx = k * 450 - camNear;
                    if (kx >= -120 && kx <= W + 120) {
                        ctx.beginPath();
                        ctx.moveTo(kx - 90, H);
                        ctx.lineTo(kx, H - 65);
                        ctx.lineTo(kx + 90, H);
                        ctx.fill();
                    }
                }
                
                // Hanging background chains
                ctx.strokeStyle = '#120E16';
                ctx.lineWidth = 4;
                for (let c = 0; c < 6; c++) {
                    const cx = c * 850 - camNear;
                    if (cx >= -220 && cx <= W + 220) {
                        ctx.beginPath();
                        ctx.moveTo(cx, 0);
                        ctx.quadraticCurveTo(cx + 120, H * 0.40, cx + 240, 0);
                        ctx.stroke();
                    }
                }

                // 8. DYNAMIC PARTICLES: Drifting Ash & Fire Embers
                ctx.fillStyle = 'rgba(255, 75, 0, 0.7)';
                for (let i = 0; i < 35; i++) {
                    const px = ((i * 137 - t * 0.045) % W + W) % W;
                    const py = ((i * 61 + t * 0.055) % H);
                    const size = 1.5 + (i % 3);
                    ctx.save();
                    if (i % 3 === 0) {
                        ctx.shadowColor = '#FF3C00';
                        ctx.shadowBlur = 4;
                    }
                    ctx.fillRect(px, py, size, size);
                    ctx.restore();
                }

                // 9. LAVA HEAT RADIAL GLOW (Atmospheric light at the bottom)
                const heatA = 0.25 + Math.sin(t / 450) * 0.06;
                const heatGrd = ctx.createLinearGradient(0, H - 90, 0, H);
                heatGrd.addColorStop(0, 'transparent');
                heatGrd.addColorStop(1, `rgba(255, 35, 0, ${heatA})`);
                ctx.fillStyle = heatGrd;
                ctx.fillRect(0, H - 90, W, 90);

                // 10. SCREEN RED TINT (Gets deeper hellish red as the player approaches Barad-dûr)
                const tintOpacity = Math.min(0.40, (this.cameraX / 4000) * 0.40);
                if (tintOpacity > 0.01) {
                    ctx.fillStyle = `rgba(210, 0, 0, ${tintOpacity})`;
                    ctx.fillRect(0, 0, W, H);
                }
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
        const lives = document.getElementById('hud-lives');

        if (this.player && fill)
            fill.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
        if (coins) coins.textContent = this.coins;
        if (gems)  gems.textContent  = this.hasArkenstone ? '💎' : '-';
        if (level) level.textContent = this.currentLevel;
        if (lives) lives.textContent = '❤️'.repeat(this.lives) || '💀';
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
        
        // Move back horizontally (one step back)
        let targetX = Math.max(120, p.x - 200);
        
        // Find the closest platform that is near the targetX
        let bestPlatform = this.platforms[0];
        let minDist = Infinity;
        
        this.platforms.forEach(pl => {
            if (pl.type === 'broken-bridge') return; // Skip unsafe broken bridges
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
            let unlocked = [4];
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
            : '🎉 You have defeated the Eye of Sauron! Middle-earth is saved!';

        const nBtn = document.getElementById('next-level-button');
        if (nBtn) nBtn.style.display = LEVELS_CONFIG[nextLevel] ? '' : 'none';

        const screen = document.getElementById('victory-screen');
        if (screen) screen.classList.remove('hidden');
    }
}

// Export singleton — main.js constructs and stores this
