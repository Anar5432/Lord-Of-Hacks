// ==========================================================================
// Lord of the Hacks - Entity OOP System (Canvas API Renderer)
// All entities use draw(ctx, cameraX) instead of DOM elements.
// Physics data (x, y, vx, vy, width, height) live as plain JS properties.
// Coordinate system: y=0 is GROUND, y increases UPWARD (game space).
// Canvas conversion: canvasY = VIEWPORT_H - gameY - entityHeight
// ==========================================================================

const VIEWPORT_H = 470;

// --------------------------------------------------------------------------
// Base Entity — shared physics data + screen coordinate helper
// --------------------------------------------------------------------------
class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // Convert game-space (x, y) to canvas top-left pixel for drawing
    screenPos(cameraX) {
        return {
            sx: Math.round(this.x - cameraX),
            sy: Math.round(VIEWPORT_H - this.y - this.height)
        };
    }

    draw(ctx, cameraX) { /* override in subclasses */ }
}

// --------------------------------------------------------------------------
// Player — state machine + per-character draw methods
// --------------------------------------------------------------------------
class Player extends Entity {
    constructor(x, y, charType) {
        // Hobbit: smallest hitbox for tight platforming
        const dims = { Hobbit: [24, 36], Ranger: [28, 44], Wizard: [30, 48] };
        const [w, h] = dims[charType] || dims.Hobbit;
        super(x, y, w, h);

        this.charType   = charType;
        this.vx         = 0;
        this.vy         = 0;
        this.isGrounded = false;
        this.direction  = 1;        // 1 = facing right, -1 = facing left
        this.state      = 'idle';   // idle | run | jump | attack-melee | attack-ranged | death
        this.attackTimer      = 0;  // frames remaining for attack animation
        this.stingGlowing     = false; // Sting proximity passive
        this.lastAttackTime   = 0;
        this.invincibleTimer  = 0;  // brief invincibility frames after hit

        this.setupStats();
    }

    setupStats() {
        switch (this.charType) {
            case 'Wizard':
                this.maxHealth    = 100;
                this.damage       = 30;
                this.shootCooldown = 300;
                break;
            case 'Ranger':
                this.maxHealth    = 70;
                this.damage       = 15;
                this.shootCooldown = 450;
                break;
            default: // Hobbit
                this.maxHealth    = 40;
                this.damage       = 10;
                this.shootCooldown = 500;
        }
        this.health = this.maxHealth;
    }

    jump() {
        if (this.isGrounded) {
            this.vy = 11;
            this.isGrounded = false;
        }
    }

    takeDamage(amount) {
        if (this.invincibleTimer > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.invincibleTimer = 60; // 1 second of invincibility
    }

    updateState() {
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        if (this.health <= 0)  { this.state = 'death';  return; }
        if (this.attackTimer > 0) { this.attackTimer--;  return; }
        if (!this.isGrounded)  { this.state = 'jump';   return; }
        if (this.vx !== 0)     { this.state = 'run';    return; }
        this.state = 'idle';
    }

    // -----------------------------------------------------------------------
    // Main draw dispatcher
    // -----------------------------------------------------------------------
    draw(ctx, cameraX) {
        // Flash when invincible
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 5) % 2 === 0) return;

        if (this.charType === 'Hobbit') this._drawHobbit(ctx, cameraX);
        // Ranger and Wizard will be added in future phases
    }

    // -----------------------------------------------------------------------
    // HOBBIT (Frodo-style) — full pixel-art Canvas drawing
    // Visual is 2× physics hitbox (48×72) bottom-aligned and centered
    // -----------------------------------------------------------------------
    _drawHobbit(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        const t = Date.now();

        // Draw visual larger than hitbox, bottom-aligned
        const VW = 48, VH = 72;
        const ox = sx - (VW - this.width)  / 2;  // center horizontally
        const oy = sy - (VH - this.height);       // align bottoms

        ctx.save();

        // Flip horizontally when facing left
        if (this.direction === -1) {
            ctx.translate(ox + VW, oy);
            ctx.scale(-1, 1);
            ctx.translate(0, 0);
        } else {
            ctx.translate(ox, oy);
        }

        // Death: rotate and fade
        if (this.state === 'death') {
            ctx.globalAlpha = 0.5;
            ctx.translate(VW / 2, VH / 2);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-VH / 2, -VW / 2);
        }

        // Animation offsets
        const runCycle  = Math.sin(t / 80);
        const idleBob   = Math.sin(t / 700) * 1;
        const bobY      = this.state === 'run'  ? runCycle * 3  : idleBob;
        const legSwing  = this.state === 'run'  ? runCycle * 8  : 0;
        const jumpStretch = this.state === 'jump' ? -4 : 0;

        // ---- CLOAK (back layer, drawn first) ----
        ctx.fillStyle = '#1B4332';
        ctx.beginPath();
        ctx.moveTo(4,  28 + bobY);
        ctx.lineTo(44, 28 + bobY);
        ctx.lineTo(48, VH);
        ctx.lineTo(0,  VH);
        ctx.closePath();
        ctx.fill();

        // Cloak highlight / fold
        ctx.fillStyle = '#2D6A4F';
        ctx.beginPath();
        ctx.moveTo(8,  28 + bobY);
        ctx.lineTo(40, 28 + bobY);
        ctx.lineTo(36, VH - 4);
        ctx.lineTo(12, VH - 4);
        ctx.closePath();
        ctx.fill();

        // ---- LEGS ----
        const legColor1 = '#4A3520', legColor2 = '#5C4430';
        // Left leg
        ctx.fillStyle = legColor1;
        ctx.fillRect(10, 50 + bobY - legSwing * 0.4, 12, 16 + jumpStretch);
        // Right leg
        ctx.fillStyle = legColor2;
        ctx.fillRect(26, 50 + bobY + legSwing * 0.4, 12, 16 + jumpStretch);

        // ---- HAIRY HOBBIT FEET ----
        ctx.fillStyle = '#E8C49A'; // skin
        ctx.fillRect(8,  65 + bobY, 14, 5);
        ctx.fillRect(26, 65 + bobY, 14, 5);
        // Foot hair (dark wisps)
        ctx.fillStyle = '#5C3A1E';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(8  + i * 2.5, 63 + bobY, 2, 3);
            ctx.fillRect(26 + i * 2.5, 63 + bobY, 2, 3);
        }

        // ---- VEST / SHIRT BODY ----
        // Brown leather vest
        ctx.fillStyle = '#7A4F3A';
        ctx.fillRect(10, 28 + bobY, 28, 24);
        // Cream shirt showing through center
        ctx.fillStyle = '#F0E0C0';
        ctx.fillRect(16, 28 + bobY, 16, 24);
        // Vest lapels (left / right)
        ctx.fillStyle = '#7A4F3A';
        ctx.fillRect(10, 28 + bobY, 6, 24);
        ctx.fillRect(32, 28 + bobY, 6, 24);
        // Belt
        ctx.fillStyle = '#2C1A0E';
        ctx.fillRect(10, 48 + bobY, 28, 4);
        // Belt buckle
        ctx.fillStyle = '#C8A000';
        ctx.fillRect(21, 49 + bobY, 6, 2);

        // ---- ARMS ----
        if (this.state === 'attack-melee') {
            // Right arm thrusting forward with Sting
            ctx.fillStyle = '#E8C49A';
            ctx.fillRect(38, 30 + bobY, 10, 8);

            // STING SWORD
            if (this.stingGlowing) {
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur  = 16;
            }
            ctx.fillStyle = '#B8C8D8'; // blade
            ctx.fillRect(44, 18 + bobY, 5, 22);
            ctx.fillStyle = '#DAA520'; // crossguard
            ctx.fillRect(41, 32 + bobY, 11, 4);
            ctx.fillStyle = '#6B3A2A'; // handle
            ctx.fillRect(45, 36 + bobY, 3, 8);
            ctx.shadowBlur = 0;

            // Slash arc effect
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 240, 150, 0.9)';
            ctx.lineWidth   = 3;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur  = 14;
            ctx.beginPath();
            ctx.arc(52, 28 + bobY, 18, -Math.PI * 0.6, Math.PI * 0.3);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(52, 28 + bobY, 15, -Math.PI * 0.6, Math.PI * 0.3);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

        } else if (this.state === 'attack-ranged') {
            // Left arm winding back, right arm throwing
            ctx.fillStyle = '#E8C49A';
            ctx.fillRect(-4, 24 + bobY, 14, 8);  // wind-back arm
            ctx.fillRect(38, 28 + bobY, 12, 8);  // throw arm
            // Rock in hand (about to release)
            ctx.fillStyle = '#8A8A8A';
            ctx.shadowColor = '#666';
            ctx.shadowBlur = 3;
            ctx.beginPath();
            ctx.arc(50, 26 + bobY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

        } else {
            // Normal idle / run arms swinging
            ctx.fillStyle = '#E8C49A';
            // Left arm (swings forward when right leg goes back)
            ctx.fillRect(0,  30 + bobY + legSwing * 0.3, 10, 18);
            // Right arm
            ctx.fillRect(38, 30 + bobY - legSwing * 0.3, 10, 18);

            // Sting sword at hip (passive carry)
            if (this.stingGlowing) {
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur  = 10;
                ctx.fillStyle   = '#B8C8D8';
                ctx.fillRect(40, 38 + bobY, 4, 20);
                ctx.fillStyle   = '#DAA520';
                ctx.fillRect(37, 45 + bobY, 10, 3);
                ctx.shadowBlur  = 0;
            }
        }

        // ---- HEAD ----
        // Clear shadow before drawing face for clean look
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Neck
        ctx.fillStyle = '#E8C49A';
        ctx.fillRect(19, 18 + bobY, 10, 12);

        // Head (round, skin tone)
        ctx.fillStyle = '#E8C49A';
        ctx.beginPath();
        ctx.arc(24, 14 + bobY, 13, 0, Math.PI * 2);
        ctx.fill();

        // ---- CURLY HAIR ----
        ctx.fillStyle = '#5C3A1E';
        // Main hair mass
        ctx.beginPath();
        ctx.arc(24, 5 + bobY, 12, Math.PI, 0);
        ctx.fill();
        // Left curl
        ctx.beginPath();
        ctx.arc(13, 9 + bobY, 7, Math.PI * 0.5, Math.PI * 1.8);
        ctx.fill();
        // Right curl
        ctx.beginPath();
        ctx.arc(35, 9 + bobY, 7, Math.PI * 1.2, Math.PI * 0.5);
        ctx.fill();
        // Top tuft
        ctx.beginPath();
        ctx.arc(24, 0 + bobY, 5, Math.PI, 0);
        ctx.fill();

        // ---- EYES ----
        // Whites
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(16, 12 + bobY, 6, 5);
        ctx.fillRect(26, 12 + bobY, 6, 5);
        // Pupils (look slightly forward = toward direction of facing)
        ctx.fillStyle = '#2C1510';
        ctx.fillRect(18, 13 + bobY, 3, 3);
        ctx.fillRect(28, 13 + bobY, 3, 3);
        // Eye shine
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(20, 13 + bobY, 1, 1);
        ctx.fillRect(30, 13 + bobY, 1, 1);

        // ---- NOSE ----
        ctx.fillStyle = '#C8956A';
        ctx.fillRect(22, 18 + bobY, 4, 3);

        // ---- MOUTH ----
        // Slight smile when alive
        ctx.fillStyle = '#9B5A3C';
        if (this.state === 'death') {
            ctx.fillRect(19, 22 + bobY, 10, 2); // flat line
        } else {
            ctx.fillRect(19, 22 + bobY, 3, 2);
            ctx.fillRect(26, 22 + bobY, 3, 2);
        }

        // ---- STING GLOW AURA (outer ring when near Orcs) ----
        if (this.stingGlowing && this.state !== 'attack-melee') {
            const pulse = 0.3 + Math.sin(t / 200) * 0.2;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth   = 3;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur  = 20;
            ctx.beginPath();
            ctx.ellipse(VW / 2, VH / 2, VW / 2 + 4, VH / 2 + 4, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }
}

// --------------------------------------------------------------------------
// Platform — themed Canvas drawing per level theme
// --------------------------------------------------------------------------
class Platform extends Entity {
    constructor(x, y, width, height, theme = 'forest') {
        super(x, y, width, height);
        this.theme = theme;
    }

    draw(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        // Frustum cull — skip platforms off screen
        if (sx + this.width < 0 || sx > 800) return;

        const t = Date.now();
        ctx.save();

        switch (this.theme) {
            case 'forest': {
                // Earth base
                ctx.fillStyle = '#3B2510';
                ctx.fillRect(sx, sy, this.width, this.height);
                // Root texture lines
                ctx.fillStyle = '#2A1A0A';
                for (let i = 0; i < this.width; i += 18)
                    ctx.fillRect(sx + i, sy + 6, 2, this.height - 6);
                // Grass top strip
                ctx.fillStyle = '#1B4332';
                ctx.fillRect(sx, sy, this.width, 10);
                ctx.fillStyle = '#2D6A4F';
                ctx.fillRect(sx, sy, this.width, 5);
                // Bright grass tips
                ctx.fillStyle = '#52B788';
                for (let i = 4; i < this.width; i += 8) {
                    ctx.fillRect(sx + i,     sy - 4, 2, 5);
                    ctx.fillRect(sx + i + 4, sy - 6, 2, 7);
                }
                break;
            }
            case 'mines': {
                // Slate rock
                ctx.fillStyle = '#1A1D24';
                ctx.fillRect(sx, sy, this.width, this.height);
                // Rock cracks
                ctx.fillStyle = '#252830';
                for (let i = 0; i < this.width; i += 22)
                    ctx.fillRect(sx + i, sy, 2, this.height);
                // Cyan crystal veins (pulsing)
                const crystalGlow = 0.2 + Math.sin(t / 600) * 0.1;
                ctx.globalAlpha = crystalGlow;
                ctx.fillStyle   = '#00E5FF';
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur  = 6;
                for (let i = 10; i < this.width; i += 45) {
                    ctx.fillRect(sx + i, sy + 2, 3, this.height - 4);
                }
                ctx.globalAlpha = 1;
                ctx.shadowBlur  = 0;
                break;
            }
            case 'mountain': {
                // Treasure gold pile
                const grad = ctx.createLinearGradient(sx, sy, sx, sy + this.height);
                grad.addColorStop(0, '#FFD700');
                grad.addColorStop(0.4, '#DAA520');
                grad.addColorStop(1, '#7A5800');
                ctx.fillStyle = grad;
                ctx.fillRect(sx, sy, this.width, this.height);
                // Shine sweep
                ctx.fillStyle = 'rgba(255,255,220,0.35)';
                ctx.fillRect(sx, sy, this.width, 5);
                // Coin bumps
                ctx.fillStyle = '#C8980A';
                for (let i = 8; i < this.width; i += 16)
                    ctx.beginPath(), ctx.arc(sx + i, sy + 3, 4, 0, Math.PI * 2), ctx.fill();
                break;
            }
            case 'mordor': {
                // Volcanic obsidian
                ctx.fillStyle = '#0C090F';
                ctx.fillRect(sx, sy, this.width, this.height);
                // Dark fissures
                ctx.fillStyle = '#1A0F20';
                for (let i = 0; i < this.width; i += 28)
                    ctx.fillRect(sx + i, sy, 2, this.height);
                // Lava crack at bottom edge
                const lavaAlpha = 0.6 + Math.sin(t / 250) * 0.3;
                ctx.globalAlpha = lavaAlpha;
                ctx.fillStyle   = '#FF3A00';
                ctx.shadowColor = '#FF3A00';
                ctx.shadowBlur  = 10;
                ctx.fillRect(sx, sy + this.height - 4, this.width, 4);
                for (let i = 6; i < this.width; i += 24)
                    ctx.fillRect(sx + i, sy + this.height - 10, 10, 6);
                ctx.globalAlpha = 1;
                ctx.shadowBlur  = 0;
                break;
            }
            default: {
                ctx.fillStyle = '#4A3577';
                ctx.fillRect(sx, sy, this.width, this.height);
            }
        }
        ctx.restore();
    }
}

// --------------------------------------------------------------------------
// Enemy — patrol AI + per-type Canvas drawing
// --------------------------------------------------------------------------
class Enemy extends Entity {
    constructor(type, x, y, patrolMinX, patrolMaxX) {
        const dims = {
            Tree: [36, 60], Orc: [36, 52],
            Troll: [52, 64], Smaug: [90, 70], EyeOfSauron: [80, 80]
        };
        const [w, h] = dims[type] || [36, 52];
        super(x, y, w, h);

        this.type        = type;
        this.patrolMinX  = patrolMinX;
        this.patrolMaxX  = patrolMaxX;
        this.vx          = type === 'Troll' ? 0.8 : type === 'Smaug' ? 1.2 : 1.5;
        this.direction   = 1;
        this.health      = this.getMaxHealth();
        this.knockbackVx = 0;
    }

    getMaxHealth() {
        return { Smaug: 150, EyeOfSauron: 200, Troll: 60, Orc: 30, Tree: 20 }[this.type] || 30;
    }

    applyKnockback(playerX) {
        this.knockbackVx = (this.x > playerX ? 1 : -1) * 9;
    }

    update() {
        // Knockback decay
        if (Math.abs(this.knockbackVx) > 0.1) {
            this.x += this.knockbackVx;
            this.knockbackVx *= 0.65;
        } else {
            this.knockbackVx = 0;
        }

        // Patrol
        this.x += this.vx * this.direction;
        if (this.x >= this.patrolMaxX) { this.direction = -1; this.x = this.patrolMaxX; }
        if (this.x <= this.patrolMinX) { this.direction =  1; this.x = this.patrolMinX; }
    }

    draw(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        if (sx + this.width < 0 || sx > 800) return;

        const t = Date.now();
        ctx.save();
        // Flip direction
        ctx.translate(sx + this.width / 2, sy + this.height);
        if (this.direction === -1) ctx.scale(-1, 1);
        ctx.translate(-this.width / 2, -this.height);

        switch (this.type) {
            case 'Tree':        this._drawTree(ctx, t);        break;
            case 'Orc':         this._drawOrc(ctx, t);         break;
            case 'Troll':       this._drawTroll(ctx, t);       break;
            case 'Smaug':       this._drawSmaug(ctx, t);       break;
            case 'EyeOfSauron': this._drawEyeOfSauron(ctx, t); break;
        }

        // Health bar above enemy
        if (this.health < this.getMaxHealth()) {
            const barW = this.width;
            const hp   = this.health / this.getMaxHealth();
            ctx.fillStyle = '#3D0000';
            ctx.fillRect(0, -10, barW, 5);
            ctx.fillStyle = hp > 0.5 ? '#39FF14' : hp > 0.25 ? '#FFD700' : '#FF3A00';
            ctx.fillRect(0, -10, barW * hp, 5);
        }

        ctx.restore();
    }

    _drawTree(ctx, t) {
        const wobble = Math.sin(t / 700) * 4;
        const W = this.width, H = this.height;
        // Gnarled trunk
        ctx.fillStyle = '#4A2E10';
        ctx.fillRect(W / 2 - 7, H * 0.4, 14, H * 0.6);
        // Knotholes
        ctx.fillStyle = '#2E1A08';
        ctx.beginPath(); ctx.ellipse(W/2 - 3, H * 0.6, 3, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(W/2 + 4, H * 0.75, 3, 3, 0, 0, Math.PI*2); ctx.fill();
        // Foliage (wobbles)
        ctx.save();
        ctx.translate(W / 2, H * 0.4);
        ctx.rotate(wobble * Math.PI / 180);
        ctx.fillStyle = '#1B3A1F';
        ctx.fillRect(-W/2, -H * 0.45, W, H * 0.45);
        ctx.fillStyle = '#2D6A4F';
        ctx.fillRect(-W/2 + 4, -H * 0.38, W - 8, H * 0.3);
        ctx.restore();
        // Glowing evil eyes
        ctx.fillStyle = '#FF0000';
        ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 8;
        ctx.fillRect(W/2 - 10, H * 0.28, 6, 6);
        ctx.fillRect(W/2 + 4,  H * 0.28, 6, 6);
        ctx.shadowBlur = 0;
        // Root claws
        ctx.fillStyle = '#3A2008';
        ctx.fillRect(W/2 - 14, H - 6, 8, 6);
        ctx.fillRect(W/2 + 6,  H - 6, 8, 6);
    }

    _drawOrc(ctx, t) {
        const W = this.width, H = this.height;
        const stomp = Math.abs(this.knockbackVx) > 1 ? Math.sin(t / 40) * 4 : 0;
        // Legs
        ctx.fillStyle = '#2A3520';
        ctx.fillRect(W/2 - 10, H * 0.65 + stomp,  10, H * 0.35);
        ctx.fillRect(W/2,      H * 0.65 - stomp,  10, H * 0.35);
        // Body
        ctx.fillStyle = '#3A5E30';
        ctx.fillRect(W/2 - 13, H * 0.3, 26, H * 0.38);
        // Iron shoulder pads
        ctx.fillStyle = '#607080';
        ctx.fillRect(W/2 - 16, H * 0.28, 8, 10);
        ctx.fillRect(W/2 + 8,  H * 0.28, 8, 10);
        // Iron shield (left side)
        ctx.fillStyle = '#4E606E';
        ctx.fillRect(0, H * 0.3, 8, H * 0.35);
        ctx.fillStyle = '#6A7E8C';
        ctx.fillRect(1, H * 0.32, 6, H * 0.3);
        ctx.fillStyle = '#A0B0B8'; // shield boss
        ctx.beginPath(); ctx.arc(4, H * 0.47, 3, 0, Math.PI * 2); ctx.fill();
        // Steel helmet
        ctx.fillStyle = '#607080';
        ctx.beginPath(); ctx.ellipse(W/2, H * 0.18, 14, 12, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#505E6C';
        ctx.fillRect(W/2 - 14, H * 0.2, 28, 6); // helm rim
        // Face (green, angry)
        ctx.fillStyle = '#3A5E30';
        ctx.fillRect(W/2 - 10, H * 0.2, 20, 14);
        // Eyes (red glowing)
        ctx.fillStyle = '#FF2200'; ctx.shadowColor = '#FF2200'; ctx.shadowBlur = 5;
        ctx.fillRect(W/2 - 8, H * 0.22, 5, 5);
        ctx.fillRect(W/2 + 3, H * 0.22, 5, 5);
        ctx.shadowBlur = 0;
        // Tusks
        ctx.fillStyle = '#EEE8D0';
        ctx.fillRect(W/2 - 6, H * 0.31, 4, 7);
        ctx.fillRect(W/2 + 2, H * 0.31, 4, 7);
    }

    _drawTroll(ctx, t) {
        const W = this.width, H = this.height;
        const bob = Math.sin(t / 400) * 2;
        // Legs (thick)
        ctx.fillStyle = '#505050';
        ctx.fillRect(W/2 - 14, H * 0.62 + bob, 14, H * 0.38);
        ctx.fillRect(W/2,      H * 0.62 - bob, 14, H * 0.38);
        // Body (huge)
        ctx.fillStyle = '#6A6A6A';
        ctx.fillRect(W/2 - 18, H * 0.3, 36, H * 0.36);
        // Club arm
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(W - 8, H * 0.25, 12, 10); // upper arm
        ctx.fillStyle = '#4A2E10'; // club handle
        ctx.fillRect(W - 4, H * 0.1, 8, H * 0.28);
        ctx.fillStyle = '#3A2008'; // club head
        ctx.fillRect(W - 12, 0, 20, 16);
        // Head
        ctx.fillStyle = '#7A7A7A';
        ctx.beginPath(); ctx.arc(W/2, H * 0.22, 18, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#FF5500'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 6;
        ctx.fillRect(W/2 - 12, H * 0.15, 8, 8);
        ctx.fillRect(W/2 + 4,  H * 0.15, 8, 8);
        ctx.shadowBlur = 0;
        // Nose
        ctx.fillStyle = '#606060';
        ctx.beginPath(); ctx.arc(W/2, H * 0.24, 5, 0, Math.PI * 2); ctx.fill();
    }

    _drawSmaug(ctx, t) {
        const W = this.width, H = this.height;
        const float = Math.sin(t / 500) * 6;
        // Body
        ctx.fillStyle = '#7A0000';
        ctx.beginPath();
        ctx.ellipse(W/2, H * 0.5 + float, W * 0.4, H * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wing (left)
        ctx.fillStyle = '#5A0000';
        ctx.beginPath();
        ctx.moveTo(W * 0.3, H * 0.4 + float);
        ctx.lineTo(-10, H * 0.1 + float);
        ctx.lineTo(W * 0.1, H * 0.6 + float);
        ctx.closePath(); ctx.fill();
        // Spines
        ctx.fillStyle = '#FF4500';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(W * 0.25 + i * 14, H * 0.32 + float);
            ctx.lineTo(W * 0.28 + i * 14, H * 0.12 + float);
            ctx.lineTo(W * 0.35 + i * 14, H * 0.32 + float);
            ctx.fill();
        }
        // Head
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.moveTo(W * 0.65, H * 0.35 + float);
        ctx.lineTo(W + 10,   H * 0.45 + float);
        ctx.lineTo(W * 0.65, H * 0.58 + float);
        ctx.closePath(); ctx.fill();
        // Eye
        ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(W * 0.82, H * 0.44 + float, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Fire breath
        const fAlpha = 0.5 + Math.sin(t / 80) * 0.3;
        ctx.globalAlpha = fAlpha;
        ctx.fillStyle   = '#FF4500'; ctx.shadowColor = '#FF4500'; ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(W + 8, H * 0.44 + float);
        ctx.lineTo(W + 45, H * 0.38 + float);
        ctx.lineTo(W + 40, H * 0.52 + float);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    _drawEyeOfSauron(ctx, t) {
        const W = this.width, H = this.height;
        const cx = W / 2, cy = H / 2;
        const pulse = Math.sin(t / 300) * 6;

        // Outer fire aura
        const aura = ctx.createRadialGradient(cx, cy, 5, cx, cy, 38 + pulse);
        aura.addColorStop(0,   'rgba(255,80,0,0.9)');
        aura.addColorStop(0.6, 'rgba(180,30,0,0.5)');
        aura.addColorStop(1,   'rgba(255,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, cy, 44 + pulse, 0, Math.PI * 2); ctx.fill();

        // Eye white (ellipse, orange glow)
        ctx.fillStyle   = '#FF8C00'; ctx.shadowColor = '#FF6000'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.ellipse(cx, cy, 32, 22, 0, 0, Math.PI * 2); ctx.fill();

        // Slit pupil
        ctx.fillStyle  = '#100000'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(cx, cy, 9, 20, 0, 0, Math.PI * 2); ctx.fill();

        // Inner iris ring
        ctx.strokeStyle = '#FF2200'; ctx.lineWidth = 2;
        ctx.shadowColor = '#FF2200'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.ellipse(cx, cy, 30, 20, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Rotating fire sparks
        for (let i = 0; i < 10; i++) {
            const angle = (t / 250 + i * (Math.PI * 2 / 10));
            const r     = 36 + pulse;
            const px    = cx + Math.cos(angle) * r;
            const py    = cy + Math.sin(angle) * r * 0.55;
            ctx.fillStyle = `rgba(255,${80 + Math.floor(Math.sin(angle)*60)},0,0.8)`;
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// --------------------------------------------------------------------------
// Projectile — rock (parabolic) or slash arc (short-lived)
// --------------------------------------------------------------------------
class Projectile extends Entity {
    constructor(x, y, vx, vy, type, source) {
        const size = type === 'rock' ? 10 : 4;
        super(x, y, size, size);
        this.vx      = vx;
        this.vy      = vy || 0;
        this.type    = type;   // 'rock' | 'slash'
        this.source  = source; // 'player' | 'enemy'
        this.alive   = true;
        this.maxLife = type === 'slash' ? 10 : 140;
        this.frame   = 0;
    }

    update(gravity) {
        this.frame++;
        if (this.frame >= this.maxLife) { this.alive = false; return; }
        this.x += this.vx;
        if (this.type === 'rock') {
            this.vy += gravity; // parabolic arc
            this.y  += this.vy;
            if (this.y < -50) this.alive = false; // off screen bottom
        }
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const { sx, sy } = this.screenPos(cameraX);
        const progress   = this.frame / this.maxLife;

        if (this.type === 'rock') {
            ctx.save();
            ctx.fillStyle   = '#909090';
            ctx.shadowColor = '#555';
            ctx.shadowBlur  = 4;
            ctx.beginPath();
            ctx.arc(sx + 5, sy + 5, 5, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#C0C0C0';
            ctx.beginPath();
            ctx.arc(sx + 3, sy + 3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

        } else if (this.type === 'slash') {
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.strokeStyle = '#FFE566';
            ctx.lineWidth   = 3;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur  = 16;
            ctx.beginPath();
            ctx.arc(sx + 24, sy + 14, 22, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.arc(sx + 24, sy + 14, 18, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}

// --------------------------------------------------------------------------
// Collectible — floating coin or gem
// --------------------------------------------------------------------------
class Collectible extends Entity {
    constructor(type, x, y, value) {
        const size = type === 'gem' ? 18 : 16;
        super(x, y, size, size);
        this.type      = type;
        this.value     = value;
        this.alive     = true;
        this.spawnTime = Date.now();
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const { sx, sy } = this.screenPos(cameraX);
        const t          = Date.now() - this.spawnTime;
        const floatY     = Math.sin(t / 500) * 5;

        ctx.save();
        if (this.type === 'coin') {
            const shine     = 0.6 + Math.sin(t / 280) * 0.3;
            ctx.fillStyle   = '#FFD700';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur  = 8;
            ctx.beginPath();
            ctx.arc(sx + 8, sy + 8 + floatY, 8, 0, Math.PI * 2);
            ctx.fill();
            // Inner face
            ctx.fillStyle = `rgba(255,220,50,${shine})`;
            ctx.beginPath();
            ctx.arc(sx + 8, sy + 8 + floatY, 5, 0, Math.PI * 2);
            ctx.fill();
            // G letter
            ctx.fillStyle   = '#B8860B';
            ctx.font        = 'bold 9px monospace';
            ctx.textAlign   = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G', sx + 8, sy + 8 + floatY);
            ctx.shadowBlur  = 0;

        } else if (this.type === 'gem') {
            const glow      = 0.5 + Math.sin(t / 350) * 0.35;
            ctx.fillStyle   = `rgba(0,229,255,${glow})`;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur  = 14 + glow * 10;
            // Diamond shape
            ctx.beginPath();
            ctx.moveTo(sx + 9,  sy + floatY);
            ctx.lineTo(sx + 18, sy + 9 + floatY);
            ctx.lineTo(sx + 9,  sy + 18 + floatY);
            ctx.lineTo(sx + 0,  sy + 9 + floatY);
            ctx.closePath();
            ctx.fill();
            // Highlight facet
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.moveTo(sx + 9,  sy + floatY);
            ctx.lineTo(sx + 14, sy + 6 + floatY);
            ctx.lineTo(sx + 9,  sy + 9 + floatY);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur  = 0;
        }
        ctx.restore();
    }
}

// --------------------------------------------------------------------------
// Flag — level completion marker
// --------------------------------------------------------------------------
class Flag extends Entity {
    constructor(x, y) {
        super(x, y, 20, 60);
        this.spawnTime = Date.now();
    }

    draw(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        const t          = Date.now() - this.spawnTime;
        const wave       = Math.sin(t / 250) * 6;

        ctx.save();
        // Pole
        ctx.fillStyle = '#BDBDBD';
        ctx.fillRect(sx + 2, sy, 4, this.height);

        // Waving banner
        ctx.fillStyle   = '#39FF14';
        ctx.shadowColor = '#39FF14';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(sx + 6, sy + 4);
        ctx.quadraticCurveTo(sx + 22 + wave, sy + 12, sx + 6, sy + 22);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}
