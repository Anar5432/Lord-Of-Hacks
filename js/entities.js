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
        const dims = { Hobbit: [24, 36], Ranger: [28, 44], Wizard: [30, 48] };
        const [w, h] = dims[charType] || dims.Hobbit;
        super(x, y, w, h);

        this.charType        = charType;
        this.vx              = 0;
        this.vy              = 0;
        this.isGrounded      = false;
        this.direction       = 1;       // 1 = right, -1 = left
        this.state           = 'idle';  // idle|run|jump|attack-melee|attack-ranged|death
        this.attackTimer     = 0;
        this.stingGlowing    = false;
        this.lastAttackTime  = 0;
        this.invincibleTimer = 0;       // invincibility frames after a hit
        this.hitFlash        = 0;       // flash frames for hit feedback (12 frames)
        this.knockbackVx     = 0;       // player stumble-back on hit

        this.setupStats();
    }

    setupStats() {
        switch (this.charType) {
            case 'Wizard':
                this.maxHealth     = 100;
                this.damage        = 30;
                this.shootCooldown = 400;
                break;
            case 'Ranger':
                this.maxHealth     = 70;
                this.damage        = 15;
                this.shootCooldown = 600;
                break;
            default: // Hobbit — design spec: 3-4 hits, slow fire rate
                this.maxHealth     = 40;
                this.damage        = 10;
                this.shootCooldown = 1200; // 1 attack per 1.2 seconds
        }
        this.health = this.maxHealth;
    }

    jump() {
        if (this.isGrounded) {
            this.vy = 11;
            this.isGrounded = false;
        }
    }

    // Discrete hit: 12 damage per contact → 3–4 hits = death at 40HP
    takeDamage(amount, attackerX) {
        if (this.invincibleTimer > 0) return;
        this.health          = Math.max(0, this.health - amount);
        this.invincibleTimer = 60;  // 1 s immunity
        this.hitFlash        = 12;  // 12-frame red flash
        // Full knockback — stumble backward from attacker
        if (attackerX !== undefined) {
            this.knockbackVx = (this.x > attackerX ? 1 : -1) * 5;
        }
    }

    updateState() {
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        if (this.hitFlash       > 0) this.hitFlash--;

        // Apply player knockback decay
        if (Math.abs(this.knockbackVx) > 0.1) {
            this.x          += this.knockbackVx;
            this.knockbackVx *= 0.7;
        } else {
            this.knockbackVx = 0;
        }

        if (this.health <= 0)    { this.state = 'death';  return; }
        if (this.attackTimer > 0){ this.attackTimer--;     return; }
        if (!this.isGrounded)    { this.state = 'jump';   return; }
        if (this.vx !== 0)       { this.state = 'run';    return; }
        this.state = 'idle';
    }

    draw(ctx, cameraX) {
        // Blink during invincibility frames
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 5) % 2 === 0) return;
        if (this.charType === 'Hobbit') this._drawHobbit(ctx, cameraX);
        // Ranger and Wizard to be added later
    }

    // -------------------------------------------------------------------------
    // HOBBIT — Frodo-style chibi pixel art (48×72 visual on 24×36 hitbox)
    //
    // Proportions (72px total visual height):
    //   Hair+Head : y  0–35   (large chibi head = ~48% of body)
    //   Body      : y 35–56
    //   Legs+Feet : y 56–72
    // -------------------------------------------------------------------------
    _drawHobbit(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        const t  = Date.now();
        const VW = 48, VH = 72;

        const ox = sx - (VW - this.width)  / 2;
        const oy = sy - (VH - this.height);

        ctx.save();

        if (this.direction === -1) {
            ctx.translate(ox + VW, oy);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(ox, oy);
        }

        if (this.state === 'death') {
            ctx.globalAlpha = 0.55;
            ctx.translate(VW / 2, VH * 0.62);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-VH * 0.62, -VW / 2);
        }

        const runCycle = Math.sin(t / 85);
        const idleBob  = Math.sin(t / 1000) * 0.8;
        const bobY     = this.state === 'run'  ? runCycle * 3  : idleBob;
        const legSwing = this.state === 'run'  ? runCycle * 10 : 0;
        const armSwing = this.state === 'run'  ? runCycle * 9  : 0;
        const jumpBob  = this.state === 'jump' ? -2 : 0;

        // ===== KEY COLORS (matching reference image) =====
        const CLOAK_DARK   = '#1A7A40';  // shadow fold
        const CLOAK_MID    = '#27AE60';  // main cloak — vivid green
        const CLOAK_LIGHT  = '#2ECC71';  // highlight area
        const SKIN         = '#F0C080';  // light peachy skin for contrast
        const HAIR         = '#1C0E06';  // near-black dark brown (KEY FIX)
        const HAIR_CURL    = '#2E1810';  // slightly lighter for curl detail
        const VEST         = '#7A4020';  // reddish-brown leather vest
        const VEST_SHADOW  = '#5A2E14';  // vest shadow side
        const SHIRT        = '#F5EDD6';  // cream shirt
        const TROUSER      = '#4E3020';  // dark brown trousers

        // =================================================================
        // 1. CLOAK — DOMINANT VISUAL, VIVID BRIGHT GREEN
        //    Drawn FIRST (behind everything), wide trapezoid shape
        // =================================================================
        // Outer shadow edge (dark fold, left)
        ctx.fillStyle = CLOAK_DARK;
        ctx.beginPath();
        ctx.moveTo(0,  36 + bobY);
        ctx.lineTo(10, 36 + bobY);
        ctx.lineTo(4,  VH);
        ctx.lineTo(-6, VH);
        ctx.closePath();
        ctx.fill();

        // Main cloak body — fills most of the lower character
        ctx.fillStyle = CLOAK_MID;
        ctx.beginPath();
        ctx.moveTo(2,  36 + bobY);
        ctx.lineTo(46, 36 + bobY);
        ctx.lineTo(50, VH);
        ctx.lineTo(-2, VH);
        ctx.closePath();
        ctx.fill();

        // Highlight on left face (lighter green panel)
        ctx.fillStyle = CLOAK_LIGHT;
        ctx.beginPath();
        ctx.moveTo(4,  36 + bobY);
        ctx.lineTo(18, 36 + bobY);
        ctx.lineTo(14, VH);
        ctx.lineTo(2,  VH);
        ctx.closePath();
        ctx.fill();

        // Dark shadow fold on right side of cloak
        ctx.fillStyle = CLOAK_DARK;
        ctx.beginPath();
        ctx.moveTo(34, 36 + bobY);
        ctx.lineTo(46, 36 + bobY);
        ctx.lineTo(50, VH);
        ctx.lineTo(38, VH);
        ctx.closePath();
        ctx.fill();

        // Cloak hem (bright highlight line at bottom)
        ctx.fillStyle = CLOAK_LIGHT;
        ctx.fillRect(-6, VH - 4, 58, 4);

        // Cloak shoulder clasp (small gold pin)
        ctx.fillStyle = '#DAA520';
        ctx.beginPath();
        ctx.arc(24, 37 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(24, 37 + bobY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // =================================================================
        // 2. LEGS — dark brown trousers visible below vest
        // =================================================================
        const leftLegY  = 56 + bobY - legSwing * 0.3;
        const rightLegY = 56 + bobY + legSwing * 0.3;

        ctx.fillStyle = TROUSER;
        ctx.fillRect(14, leftLegY,  10, 16);
        ctx.fillStyle = '#5E3A22';
        ctx.fillRect(24, rightLegY, 10, 16);

        // =================================================================
        // 3. BARE HOBBIT FEET — wide oval, hairy
        // =================================================================
        ctx.fillStyle = SKIN;
        ctx.beginPath();
        ctx.ellipse(17, 71 + bobY, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(31, 71 + bobY, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Foot hair wisps
        ctx.fillStyle = HAIR;
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(9  + i * 3, 67 + bobY, 1.5, 4);
            ctx.fillRect(23 + i * 3, 67 + bobY, 1.5, 4);
        }

        // =================================================================
        // 4. BODY — brown vest + cream shirt + belt
        // =================================================================
        ctx.fillStyle = VEST;
        ctx.fillRect(13, 36 + bobY, 22, 22);

        // Shirt center
        ctx.fillStyle = SHIRT;
        ctx.fillRect(18, 36 + bobY, 12, 22);

        // Vest left/right shadow panels
        ctx.fillStyle = VEST_SHADOW;
        ctx.fillRect(13, 36 + bobY, 6,  22);
        ctx.fillRect(29, 36 + bobY, 6,  22);

        // Belt
        ctx.fillStyle = '#1A0C06';
        ctx.fillRect(13, 53 + bobY, 22, 4);
        ctx.fillStyle = '#DAA520';  // gold buckle
        ctx.fillRect(21, 54 + bobY, 6, 2);

        // Vest buttons
        ctx.fillStyle = VEST_SHADOW;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(24, 40 + bobY + i * 5, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // =================================================================
        // 5. ONE RING CHAIN
        // =================================================================
        ctx.strokeStyle = '#C8A020';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(24, 39 + bobY, 6, Math.PI * 0.28, Math.PI * 0.72);
        ctx.stroke();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur  = 5;
        ctx.beginPath();
        ctx.arc(24, 45 + bobY, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // =================================================================
        // 6. ARMS
        // =================================================================
        if (this.state === 'attack-melee') {
            ctx.fillStyle = SKIN;
            ctx.fillRect(33, 38 + bobY, 9, 5);
            ctx.fillRect(39, 40 + bobY, 7, 6);

            if (this.stingGlowing) { ctx.shadowColor = '#00E5FF'; ctx.shadowBlur = 14; }
            ctx.fillStyle = '#9B6A3C';
            ctx.fillRect(43, 33 + bobY, 4, 8);
            ctx.fillStyle = '#C8D8E0';
            ctx.fillRect(44, 13 + bobY, 3, 22);
            ctx.fillStyle = '#DAA520';
            ctx.fillRect(40, 33 + bobY, 10, 3);
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.strokeStyle = 'rgba(240,230,130,0.9)';
            ctx.lineWidth   = 2.5;
            ctx.shadowColor = '#FFE566';
            ctx.shadowBlur  = 12;
            ctx.beginPath();
            ctx.arc(44, 26 + bobY, 16, -Math.PI * 0.7, Math.PI * 0.15);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

            ctx.fillStyle = SKIN;
            ctx.fillRect(11, 38 + bobY, 6, 14);

        } else if (this.state === 'attack-ranged') {
            ctx.fillStyle = SKIN;
            ctx.save();
            ctx.translate(13, 40 + bobY);
            ctx.rotate(-0.5);
            ctx.fillRect(-3, -6, 6, 14);
            ctx.restore();
            ctx.save();
            ctx.translate(35, 40 + bobY);
            ctx.rotate(0.6);
            ctx.fillRect(-2, 0, 6, 14);
            ctx.restore();
            ctx.fillStyle = '#909090';
            ctx.beginPath();
            ctx.arc(41, 52 + bobY, 4.5, 0, Math.PI * 2);
            ctx.fill();

        } else if (this.state === 'jump') {
            ctx.fillStyle = SKIN;
            ctx.save();
            ctx.translate(13, 40 + bobY);
            ctx.rotate(-Math.PI * 0.48);
            ctx.fillRect(-3, 0, 6, 15);
            ctx.restore();
            ctx.save();
            ctx.translate(35, 40 + bobY);
            ctx.rotate(Math.PI * 0.48);
            ctx.fillRect(-3, 0, 6, 15);
            ctx.restore();

            if (this.stingGlowing) { ctx.shadowColor = '#00E5FF'; ctx.shadowBlur = 8; }
            ctx.fillStyle = '#9B6A3C';
            ctx.save();
            ctx.translate(35, 40 + bobY);
            ctx.rotate(Math.PI * 0.48);
            ctx.fillRect(-1, 14, 3, 16);
            ctx.fillStyle = '#C8D8E0';
            ctx.fillRect(-1, 0, 3, 16);
            ctx.restore();
            ctx.shadowBlur = 0;

        } else {
            ctx.fillStyle = SKIN;
            ctx.save();
            ctx.translate(13, 40 + bobY);
            ctx.rotate((armSwing * 0.6) * Math.PI / 180);
            ctx.fillRect(-3, 0, 6, 14);
            ctx.restore();
            ctx.save();
            ctx.translate(35, 40 + bobY);
            ctx.rotate((-armSwing * 0.6) * Math.PI / 180);
            ctx.fillRect(-3, 0, 6, 14);
            ctx.restore();

            if (this.stingGlowing) { ctx.shadowColor = '#00E5FF'; ctx.shadowBlur = 10; }
            ctx.save();
            ctx.translate(39, 37 + bobY);
            ctx.rotate(-0.15);
            ctx.fillStyle = '#9B6A3C';
            ctx.fillRect(-2, 12, 4, 8);
            ctx.fillStyle = '#C8D8E0';
            ctx.fillRect(-2, -8, 4, 22);
            ctx.fillStyle = '#DAA520';
            ctx.fillRect(-5, 12, 10, 2);
            ctx.restore();
            ctx.shadowBlur = 0;
        }

        // =================================================================
        // 7. NECK
        // =================================================================
        ctx.fillStyle = SKIN;
        ctx.fillRect(20, 31 + bobY, 8, 7);

        // =================================================================
        // 8. HEAD — large chibi circle
        // =================================================================
        ctx.fillStyle = SKIN;
        ctx.beginPath();
        ctx.arc(24, 17 + bobY + jumpBob, 16, 0, Math.PI * 2);
        ctx.fill();

        // Chin shadow
        ctx.fillStyle = 'rgba(180, 100, 40, 0.12)';
        ctx.beginPath();
        ctx.arc(24, 28 + bobY + jumpBob, 10, 0, Math.PI);
        ctx.fill();

        // Rosy cheeks
        ctx.fillStyle = 'rgba(220, 90, 60, 0.2)';
        ctx.beginPath();
        ctx.arc(11, 21 + bobY + jumpBob, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(37, 21 + bobY + jumpBob, 7, 0, Math.PI * 2);
        ctx.fill();

        // =================================================================
        // 9. HAIR — NEAR-BLACK DARK BROWN (KEY FIX from reference)
        //    The reference shows very dark, almost-black curly hair
        // =================================================================
        const HY = bobY + jumpBob;

        // Main dark hair mass — covers top and sides completely
        ctx.fillStyle = HAIR;
        ctx.beginPath();
        ctx.arc(24, 9 + HY, 17, Math.PI * 0.88, Math.PI * 0.12);
        ctx.fill();

        // Left side curl — large rounded chunk
        ctx.beginPath();
        ctx.arc(8, 14 + HY, 11, Math.PI * 0.35, Math.PI * 1.9);
        ctx.fill();

        // Right side curl — mirror
        ctx.beginPath();
        ctx.arc(40, 14 + HY, 11, Math.PI * 1.1, Math.PI * 0.65);
        ctx.fill();

        // Small bottom curl tufts (curly texture)
        ctx.beginPath();
        ctx.arc(15, 22 + HY, 5, Math.PI, Math.PI * 1.95);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(33, 22 + HY, 5, Math.PI * 1.05, 0);
        ctx.fill();

        // Curl highlight (slightly lighter) — shows curl texture
        ctx.fillStyle = HAIR_CURL;
        ctx.beginPath();
        ctx.arc(18, 5 + HY, 6, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(30, 4 + HY, 5, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9,  12 + HY, 5, Math.PI * 0.5, Math.PI * 1.7);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(39, 12 + HY, 5, Math.PI * 1.3, Math.PI * 0.5);
        ctx.fill();

        // =================================================================
        // 10. EYES — big, green, friendly
        // =================================================================
        const EY = 19 + bobY + jumpBob;

        // Whites
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.ellipse(16, EY, 5.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(32, EY, 5.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();

        // Green irises
        ctx.fillStyle = '#388E3C';
        ctx.beginPath(); ctx.ellipse(16, EY, 4,   4,   0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(32, EY, 4,   4,   0, 0, Math.PI * 2); ctx.fill();

        // Dark pupils
        ctx.fillStyle = '#0D0600';
        ctx.beginPath(); ctx.ellipse(16.5, EY, 2.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(32.5, EY, 2.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();

        // Shine
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(17, EY - 2, 2, 2);
        ctx.fillRect(33, EY - 2, 2, 2);

        // Eyebrows (dark, expressive)
        ctx.fillStyle = HAIR;
        ctx.fillRect(11, EY - 6, 10, 2);
        ctx.fillRect(27, EY - 6, 10, 2);

        // =================================================================
        // 11. NOSE & MOUTH
        // =================================================================
        const NY = 25 + bobY + jumpBob;
        ctx.fillStyle = '#C07840';
        ctx.beginPath(); ctx.arc(24, NY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9B5A30';
        ctx.fillRect(22, NY + 1, 2, 2);
        ctx.fillRect(26, NY + 1, 2, 2);

        const MY = NY + 5;
        ctx.strokeStyle = '#9B5A3C';
        ctx.lineWidth   = 1.8;
        if (this.state === 'death') {
            ctx.beginPath(); ctx.arc(24, MY + 2, 4, Math.PI, 0); ctx.stroke();
        } else if (this.state === 'attack-melee' || this.state === 'attack-ranged') {
            ctx.fillStyle = '#8B4020';
            ctx.fillRect(19, MY, 10, 2);
        } else if (this.state === 'jump') {
            ctx.beginPath(); ctx.ellipse(24, MY, 3, 4, 0, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(24, MY - 1, 4, 0.2, Math.PI - 0.2); ctx.stroke();
        }

        // =================================================================
        // 12. STING GLOW AURA
        // =================================================================
        if (this.stingGlowing) {
            const pulse = 0.18 + Math.sin(t / 200) * 0.1;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth   = 3;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur  = 28;
            ctx.beginPath();
            ctx.ellipse(VW / 2, VH / 2 + 4, VW / 2 + 7, VH / 2 + 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // =================================================================
        // 13. HIT FEEDBACK
        // =================================================================
        if (this.hitFlash > 0) {
            const progress = this.hitFlash / 12;
            ctx.save();
            ctx.globalAlpha = progress * 0.5;
            ctx.fillStyle   = '#FF2200';
            ctx.beginPath();
            ctx.ellipse(VW / 2, VH * 0.55, VW / 2 + 4, VH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = progress * 0.8;
            for (let i = 0; i < 7; i++) {
                const angle = (i / 7) * Math.PI * 2;
                const r     = (1 - progress) * 22 + 8;
                const px    = VW / 2 + Math.cos(angle) * r;
                const py    = VH * 0.65 + Math.sin(angle) * r * 0.4;
                ctx.fillStyle = i % 2 === 0 ? '#D4B48A' : '#C8956A';
                ctx.beginPath();
                ctx.arc(px, py, 3 * progress, 0, Math.PI * 2);
                ctx.fill();
            }
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
        if (sx + this.width < 0 || sx > 800) return;

        const t = Date.now();
        ctx.save();

        switch (this.theme) {
            case 'forest': {
                ctx.fillStyle = '#3B2510';
                ctx.fillRect(sx, sy, this.width, this.height);
                // Root texture lines
                ctx.fillStyle = '#2A1A0A';
                for (let i = 0; i < this.width; i += 18)
                    ctx.fillRect(sx + i, sy + 8, 2, this.height - 8);
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
                ctx.fillStyle = '#1A1D24';
                ctx.fillRect(sx, sy, this.width, this.height);
                ctx.fillStyle = '#252830';
                for (let i = 0; i < this.width; i += 22)
                    ctx.fillRect(sx + i, sy, 2, this.height);
                const crystalGlow = 0.2 + Math.sin(t / 600) * 0.1;
                ctx.globalAlpha = crystalGlow;
                ctx.fillStyle   = '#00E5FF';
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur  = 6;
                for (let i = 10; i < this.width; i += 45)
                    ctx.fillRect(sx + i, sy + 2, 3, this.height - 4);
                ctx.globalAlpha = 1;
                ctx.shadowBlur  = 0;
                break;
            }
            case 'mountain': {
                const grad = ctx.createLinearGradient(sx, sy, sx, sy + this.height);
                grad.addColorStop(0, '#FFD700');
                grad.addColorStop(0.4, '#DAA520');
                grad.addColorStop(1, '#7A5800');
                ctx.fillStyle = grad;
                ctx.fillRect(sx, sy, this.width, this.height);
                ctx.fillStyle = 'rgba(255,255,220,0.35)';
                ctx.fillRect(sx, sy, this.width, 5);
                ctx.fillStyle = '#C8980A';
                for (let i = 8; i < this.width; i += 16) {
                    ctx.beginPath();
                    ctx.arc(sx + i, sy + 3, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'mordor': {
                ctx.fillStyle = '#0C090F';
                ctx.fillRect(sx, sy, this.width, this.height);
                ctx.fillStyle = '#1A0F20';
                for (let i = 0; i < this.width; i += 28)
                    ctx.fillRect(sx + i, sy, 2, this.height);
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
        if (Math.abs(this.knockbackVx) > 0.1) {
            this.x += this.knockbackVx;
            this.knockbackVx *= 0.65;
        } else {
            this.knockbackVx = 0;
        }
        this.x += this.vx * this.direction;
        if (this.x >= this.patrolMaxX) { this.direction = -1; this.x = this.patrolMaxX; }
        if (this.x <= this.patrolMinX) { this.direction =  1; this.x = this.patrolMinX; }
    }

    draw(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        if (sx + this.width < 0 || sx > 800) return;

        const t = Date.now();
        ctx.save();
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
        ctx.fillStyle = '#4A2E10';
        ctx.fillRect(W / 2 - 7, H * 0.4, 14, H * 0.6);
        ctx.fillStyle = '#2E1A08';
        ctx.beginPath(); ctx.ellipse(W/2 - 3, H * 0.6, 3, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(W/2 + 4, H * 0.75, 3, 3, 0, 0, Math.PI*2); ctx.fill();
        ctx.save();
        ctx.translate(W / 2, H * 0.4);
        ctx.rotate(wobble * Math.PI / 180);
        ctx.fillStyle = '#1B3A1F';
        ctx.fillRect(-W/2, -H * 0.45, W, H * 0.45);
        ctx.fillStyle = '#2D6A4F';
        ctx.fillRect(-W/2 + 4, -H * 0.38, W - 8, H * 0.3);
        ctx.restore();
        ctx.fillStyle = '#FF0000'; ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 8;
        ctx.fillRect(W/2 - 10, H * 0.28, 6, 6);
        ctx.fillRect(W/2 + 4,  H * 0.28, 6, 6);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3A2008';
        ctx.fillRect(W/2 - 14, H - 6, 8, 6);
        ctx.fillRect(W/2 + 6,  H - 6, 8, 6);
    }

    _drawOrc(ctx, t) {
        const W = this.width, H = this.height;
        const stomp = Math.abs(this.knockbackVx) > 1 ? Math.sin(t / 40) * 4 : 0;
        ctx.fillStyle = '#2A3520';
        ctx.fillRect(W/2 - 10, H * 0.65 + stomp, 10, H * 0.35);
        ctx.fillRect(W/2,      H * 0.65 - stomp, 10, H * 0.35);
        ctx.fillStyle = '#3A5E30';
        ctx.fillRect(W/2 - 13, H * 0.3, 26, H * 0.38);
        ctx.fillStyle = '#607080';
        ctx.fillRect(W/2 - 16, H * 0.28, 8, 10);
        ctx.fillRect(W/2 + 8,  H * 0.28, 8, 10);
        ctx.fillStyle = '#4E606E';
        ctx.fillRect(0, H * 0.3, 8, H * 0.35);
        ctx.fillStyle = '#6A7E8C';
        ctx.fillRect(1, H * 0.32, 6, H * 0.3);
        ctx.fillStyle = '#A0B0B8';
        ctx.beginPath(); ctx.arc(4, H * 0.47, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#607080';
        ctx.beginPath(); ctx.ellipse(W/2, H * 0.18, 14, 12, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#505E6C';
        ctx.fillRect(W/2 - 14, H * 0.2, 28, 6);
        ctx.fillStyle = '#3A5E30';
        ctx.fillRect(W/2 - 10, H * 0.2, 20, 14);
        ctx.fillStyle = '#FF2200'; ctx.shadowColor = '#FF2200'; ctx.shadowBlur = 5;
        ctx.fillRect(W/2 - 8, H * 0.22, 5, 5);
        ctx.fillRect(W/2 + 3, H * 0.22, 5, 5);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#EEE8D0';
        ctx.fillRect(W/2 - 6, H * 0.31, 4, 7);
        ctx.fillRect(W/2 + 2, H * 0.31, 4, 7);
    }

    _drawTroll(ctx, t) {
        const W = this.width, H = this.height;
        const bob = Math.sin(t / 400) * 2;
        ctx.fillStyle = '#505050';
        ctx.fillRect(W/2 - 14, H * 0.62 + bob, 14, H * 0.38);
        ctx.fillRect(W/2,      H * 0.62 - bob, 14, H * 0.38);
        ctx.fillStyle = '#6A6A6A';
        ctx.fillRect(W/2 - 18, H * 0.3, 36, H * 0.36);
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(W - 8, H * 0.25, 12, 10);
        ctx.fillStyle = '#4A2E10';
        ctx.fillRect(W - 4, H * 0.1, 8, H * 0.28);
        ctx.fillStyle = '#3A2008';
        ctx.fillRect(W - 12, 0, 20, 16);
        ctx.fillStyle = '#7A7A7A';
        ctx.beginPath(); ctx.arc(W/2, H * 0.22, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FF5500'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 6;
        ctx.fillRect(W/2 - 12, H * 0.15, 8, 8);
        ctx.fillRect(W/2 + 4,  H * 0.15, 8, 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#606060';
        ctx.beginPath(); ctx.arc(W/2, H * 0.24, 5, 0, Math.PI * 2); ctx.fill();
    }

    _drawSmaug(ctx, t) {
        const W = this.width, H = this.height;
        const float = Math.sin(t / 500) * 6;
        ctx.fillStyle = '#7A0000';
        ctx.beginPath();
        ctx.ellipse(W/2, H * 0.5 + float, W * 0.4, H * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A0000';
        ctx.beginPath();
        ctx.moveTo(W * 0.3, H * 0.4 + float);
        ctx.lineTo(-10, H * 0.1 + float);
        ctx.lineTo(W * 0.1, H * 0.6 + float);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FF4500';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(W * 0.25 + i * 14, H * 0.32 + float);
            ctx.lineTo(W * 0.28 + i * 14, H * 0.12 + float);
            ctx.lineTo(W * 0.35 + i * 14, H * 0.32 + float);
            ctx.fill();
        }
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.moveTo(W * 0.65, H * 0.35 + float);
        ctx.lineTo(W + 10,   H * 0.45 + float);
        ctx.lineTo(W * 0.65, H * 0.58 + float);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(W * 0.82, H * 0.44 + float, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        const fAlpha = 0.5 + Math.sin(t / 80) * 0.3;
        ctx.globalAlpha = fAlpha;
        ctx.fillStyle = '#FF4500'; ctx.shadowColor = '#FF4500'; ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(W + 8,  H * 0.44 + float);
        ctx.lineTo(W + 45, H * 0.38 + float);
        ctx.lineTo(W + 40, H * 0.52 + float);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    _drawEyeOfSauron(ctx, t) {
        const W = this.width, H = this.height;
        const cx = W / 2, cy = H / 2;
        const pulse = Math.sin(t / 300) * 6;

        const aura = ctx.createRadialGradient(cx, cy, 5, cx, cy, 38 + pulse);
        aura.addColorStop(0,   'rgba(255,80,0,0.9)');
        aura.addColorStop(0.6, 'rgba(180,30,0,0.5)');
        aura.addColorStop(1,   'rgba(255,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, cy, 44 + pulse, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#FF8C00'; ctx.shadowColor = '#FF6000'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.ellipse(cx, cy, 32, 22, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#100000'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(cx, cy, 9, 20, 0, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#FF2200'; ctx.lineWidth = 2;
        ctx.shadowColor = '#FF2200'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.ellipse(cx, cy, 30, 20, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

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
// Projectile — rock (parabolic arc) or slash (short-lived melee)
// --------------------------------------------------------------------------
class Projectile extends Entity {
    constructor(x, y, vx, vy, type, source) {
        const size = type === 'rock' ? 10 : 4;
        super(x, y, size, size);
        this.vx      = vx;
        this.vy      = vy || 0;
        this.type    = type;
        this.source  = source;
        this.alive   = true;
        this.maxLife = type === 'slash' ? 10 : 140;
        this.frame   = 0;
    }

    update(gravity) {
        this.frame++;
        if (this.frame >= this.maxLife) { this.alive = false; return; }
        this.x += this.vx;
        if (this.type === 'rock') {
            this.vy += gravity;
            this.y  += this.vy;
            if (this.y < -80) this.alive = false;
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
            ctx.lineWidth   = 2.5;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur  = 12;
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
// Collectible — floating coin or Arkenstone gem
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
            ctx.fillStyle = `rgba(255,220,50,${shine})`;
            ctx.beginPath();
            ctx.arc(sx + 8, sy + 8 + floatY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle    = '#B8860B';
            ctx.font         = 'bold 9px monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G', sx + 8, sy + 8 + floatY);
            ctx.shadowBlur   = 0;

        } else if (this.type === 'gem') {
            const glow      = 0.5 + Math.sin(t / 350) * 0.35;
            ctx.fillStyle   = `rgba(0,229,255,${glow})`;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur  = 14 + glow * 10;
            ctx.beginPath();
            ctx.moveTo(sx + 9,  sy + floatY);
            ctx.lineTo(sx + 18, sy + 9 + floatY);
            ctx.lineTo(sx + 9,  sy + 18 + floatY);
            ctx.lineTo(sx + 0,  sy + 9 + floatY);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.moveTo(sx + 9,  sy + floatY);
            ctx.lineTo(sx + 14, sy + 6 + floatY);
            ctx.lineTo(sx + 9,  sy + 9 + floatY);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
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
        ctx.fillStyle = '#BDBDBD';
        ctx.fillRect(sx + 2, sy, 4, this.height);

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
