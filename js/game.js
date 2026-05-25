// ==========================================================================
// Lord of the Hacks - Core Game Engine
// ==========================================================================

class Game {
    constructor() {
        this.viewportElement = document.getElementById('game-viewport');
        this.worldElement = document.getElementById('game-world');
        
        // Loop State
        this.isRunning = false;
        this.animationFrameId = null;
        this.gravity = -0.5; // Downward gravity force
        
        // Game Entities
        this.player = null;
        this.platforms = [];
        this.enemies = [];
        this.projectiles = [];
        this.collectibles = [];
        this.flag = null;
        
        // Camera Position
        this.cameraX = 0;
        
        // User Inputs
        this.keys = {
            left: false,
            right: false,
            jump: false,
            shoot: false
        };
        
        // Game Settings & Progression
        this.currentLevel = 1;
        this.coins = 0;
        this.hasArkenstone = false;
        this.selectedCharacter = 'Hobbit';
        
        // Event Listeners setup
        this.setupInputListeners();
    }

    setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.isRunning) return;
            
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
                this.keys.jump = true;
                if (this.player) this.player.jump();
            }
            if (e.key === 'x' || e.key === 'X' || e.key === 'j' || e.key === 'J') {
                this.keys.shoot = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') this.keys.jump = false;
            if (e.key === 'x' || e.key === 'X' || e.key === 'j' || e.key === 'J') this.keys.shoot = false;
        });
    }

    loadLevel(levelIndex) {
        this.currentLevel = levelIndex;
        const config = LEVELS_CONFIG[levelIndex];
        if (!config) return;

        // Clear previous entities
        this.clearWorld();
        
        // Load background
        this.viewportElement.style.background = config.skyColor;
        this.worldElement.style.width = `${config.width}px`;
        
        // Reset camera
        this.cameraX = 0;
        this.updateCamera();
        
        // Load platforms
        config.platforms.forEach(p => {
            const platform = new Platform(p.x, p.y, p.width, p.height, config.theme);
            this.platforms.push(platform);
            this.worldElement.appendChild(platform.element);
        });

        // Load enemies
        config.enemies.forEach(e => {
            const enemy = new Enemy(e.type, e.x, e.y, e.patrolMinX, e.patrolMaxX);
            this.enemies.push(enemy);
            this.worldElement.appendChild(enemy.element);
        });

        // Load collectibles
        config.collectibles.forEach(c => {
            const collectible = new Collectible(c.type, c.x, c.y, c.value);
            this.collectibles.push(collectible);
            this.worldElement.appendChild(collectible.element);
        });

        // Load level end flag
        this.flag = new Entity(config.flag.x, config.flag.y, 16, 120, 'flag-entity');
        this.worldElement.appendChild(this.flag.element);

        // Load player
        this.player = new Player(100, 100, this.selectedCharacter);
        this.worldElement.appendChild(this.player.element);

        // Render Initial HUD
        this.updateHUD();
    }

    clearWorld() {
        if (this.player) this.player.destroy();
        this.platforms.forEach(p => p.destroy());
        this.enemies.forEach(e => e.destroy());
        this.projectiles.forEach(p => p.destroy());
        this.collectibles.forEach(c => c.destroy());
        if (this.flag) this.flag.destroy();

        this.platforms = [];
        this.enemies = [];
        this.projectiles = [];
        this.collectibles = [];
        this.player = null;
        this.flag = null;
        this.worldElement.innerHTML = '';
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (!this.player) return;

        // 1. Horizontal Movement & Collision Resolution
        const speed = 4;
        if (this.keys.left) {
            this.player.vx = -speed;
        } else if (this.keys.right) {
            this.player.vx = speed;
        } else {
            this.player.vx = 0;
        }
        
        this.player.x += this.player.vx;
        this.resolveHorizontalCollisions();

        // 2. Vertical Movement, Gravity & Collision Resolution
        this.player.vy += this.gravity;
        this.player.y += this.player.vy;
        this.resolveVerticalCollisions();

        // 3. Keep player inside left boundary
        if (this.player.x < 0) this.player.x = 0;

        // 4. Update enemies patrol AI
        this.enemies.forEach(enemy => enemy.update());

        // 5. Check other interactions (collectibles, hazards, flag)
        this.checkInteractions();

        // 6. Render player in DOM
        this.player.updateDOM();

        // 7. Dynamic Camera Scroll
        this.updateCamera();
    }

    resolveHorizontalCollisions() {
        this.platforms.forEach(platform => {
            if (this.checkAABB(this.player, platform)) {
                // If player is moving right into a platform
                if (this.player.vx > 0) {
                    this.player.x = platform.x - this.player.width;
                }
                // If player is moving left into a platform
                else if (this.player.vx < 0) {
                    this.player.x = platform.x + platform.width;
                }
            }
        });
    }

    resolveVerticalCollisions() {
        this.player.isGrounded = false;
        
        this.platforms.forEach(platform => {
            if (this.checkAABB(this.player, platform)) {
                // Falling onto the top of the platform
                if (this.player.vy < 0) {
                    this.player.y = platform.y + platform.height;
                    this.player.vy = 0;
                    this.player.isGrounded = true;
                }
                // Hitting the bottom of the platform (ceiling head-bonk)
                else if (this.player.vy > 0) {
                    this.player.y = platform.y - this.player.height;
                    this.player.vy = 0;
                }
            }
        });

        // Die if falling off the screen
        if (this.player.y < -100) {
            this.triggerGameOver();
        }
    }

    checkInteractions() {
        // Collectibles collision
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const item = this.collectibles[i];
            if (this.checkAABB(this.player, item)) {
                this.coins += item.value;
                if (item.type === 'gem') this.hasArkenstone = true;
                item.destroy();
                this.collectibles.splice(i, 1);
                this.updateHUD();
            }
        }

        // Enemy collision damage
        this.enemies.forEach(enemy => {
            if (this.checkAABB(this.player, enemy)) {
                this.player.takeDamage(1);
                this.updateHUD();
                
                if (this.player.health <= 0) {
                    this.triggerGameOver();
                }
            }
        });

        // Level end flag check
        if (this.flag && this.checkAABB(this.player, this.flag)) {
            this.triggerVictory();
        }
    }

    checkAABB(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    updateCamera() {
        if (!this.player) return;
        
        // Focus player in the center of the 800px viewport
        const targetCameraX = this.player.x - 400 + (this.player.width / 2);
        
        // Clamping camera to world bounds
        const config = LEVELS_CONFIG[this.currentLevel];
        const maxCameraX = config.width - 800;
        this.cameraX = Math.max(0, Math.min(targetCameraX, maxCameraX));
        
        // Translate world container leftward to emulate camera scroll
        this.worldElement.style.transform = `translate3d(${-this.cameraX}px, 0, 0)`;
    }

    updateHUD() {
        const hpFill = document.getElementById('health-fill');
        const coinsVal = document.getElementById('hud-coins');
        const levelVal = document.getElementById('hud-level');
        const gemsVal = document.getElementById('hud-gems');

        if (this.player && hpFill) {
            const healthPct = (this.player.health / this.player.maxHealth) * 100;
            hpFill.style.width = `${healthPct}%`;
        }
        if (coinsVal) coinsVal.textContent = this.coins;
        if (levelVal) levelVal.textContent = this.currentLevel;
        if (gemsVal) gemsVal.textContent = this.hasArkenstone ? "💎" : "-";
    }

    triggerGameOver() {
        this.stop();
        document.getElementById('summary-coins').textContent = this.coins;
        
        // Read high score
        const hiScore = localStorage.getItem('hiScore') || 0;
        const currentScore = this.coins * 10;
        if (currentScore > hiScore) {
            localStorage.setItem('hiScore', currentScore);
            document.getElementById('summary-high-score').textContent = `${currentScore} (New!)`;
        } else {
            document.getElementById('summary-high-score').textContent = hiScore;
        }

        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    triggerVictory() {
        this.stop();
        document.getElementById('victory-coins').textContent = this.coins;
        document.getElementById('victory-screen').classList.remove('hidden');
        
        // Unlock next level in select screen
        const nextLevel = this.currentLevel + 1;
        if (LEVELS_CONFIG[nextLevel]) {
            const unlockedLevels = JSON.parse(localStorage.getItem('unlockedLevels')) || [1];
            if (!unlockedLevels.includes(nextLevel)) {
                unlockedLevels.push(nextLevel);
                localStorage.setItem('unlockedLevels', JSON.stringify(unlockedLevels));
            }
        }
    }
}
