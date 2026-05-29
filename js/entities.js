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
        super(x, y, 24, 36);

        this.charType        = 'Hobbit';
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
        this.isInvisible     = false;   // Ring invisibility state
        this.ringTimeMax     = 600;     // 10 seconds at 60 FPS
        this.ringTimeLeft    = 600;
        this.slowTimer       = 0;
        this.fearTimer       = 0;

        this.setupStats();
    }

    setupStats() {
        // Hobbit stats — design spec: 3-4 hits, slow fire rate
        this.maxHealth     = 40;
        this.damage        = 10;
        this.shootCooldown = 1200; // 1 attack per 1.2 seconds
        this.health = this.maxHealth;
    }

    jump() {
        if (this.isGrounded) {
            this.vy = (this.fearTimer && this.fearTimer > 0) ? 7.5 : 11;
            this.isGrounded = false;
            this.activePlatform = null;
            if (window.audioManager) window.audioManager.playJump();
        }
    }

    // Discrete hit: 12 damage per contact → 3–4 hits = death at 40HP
    takeDamage(amount, attackerX) {
        if (this.invincibleTimer > 0) return;
        this.health          = Math.max(0, this.health - amount);
        this.invincibleTimer = 60;  // 1 s immunity
        this.hitFlash        = 12;  // 12-frame red flash
        if (window.audioManager) window.audioManager.playHit();
        // Full knockback — stumble backward from attacker
        if (attackerX !== undefined) {
            this.knockbackVx = (this.x > attackerX ? 1 : -1) * 5;
        }
    }

    updateState() {
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        if (this.slowTimer > 0) this.slowTimer--;
        if (this.fearTimer > 0) this.fearTimer--;
        if (this.fearTimer === undefined) this.fearTimer = 0;
        if (this.slowTimer === undefined) this.slowTimer = 0;
        if (this.hitFlash       > 0) this.hitFlash--;

        // Update Ring active time or recharge
        if (this.isInvisible && this.health > 0) {
            this.ringTimeLeft--;
            if (this.ringTimeLeft <= 0) {
                this.ringTimeLeft = 0;
                this.isInvisible = false;
                if (window.audioManager) window.audioManager.playRingToggle(false);
            }
        } else {
            this.ringTimeLeft = Math.min(this.ringTimeMax, this.ringTimeLeft + 0.3);
        }

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
        this._drawHobbit(ctx, cameraX);
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

        if (!Player.hobbitSpriteSheet) {
            Player.hobbitSpriteSheet = new Image();
            Player.hobbitSpriteSheet.src = "data:image/png;base64,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";
        }

        ctx.save();
        if (this.direction === -1) { ctx.translate(ox + VW, oy); ctx.scale(-1, 1); }
        else { ctx.translate(ox, oy); }

        if (this.state === 'death') {
            ctx.globalAlpha = 0.9;
            ctx.translate(VW / 2, VH * 0.65);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-VH * 0.65, -VW / 2);
        }

        // --- Ring Invisibility Visuals (Transparency + Feet Ripple) ---
        if (this.isInvisible && this.state !== 'death') {
            // Draw golden ripple at feet
            ctx.save();
            ctx.globalAlpha = 0.4 + Math.sin(t / 250) * 0.15;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(VW / 2, VH - 1, 16 + Math.sin(t / 250) * 3, 4 + Math.sin(t / 250) * 1, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            
            // Turn character transparent
            ctx.globalAlpha = 0.35;
        }

        // Frame indices: 0 = idle, 1 = jump, 2 = run, 3 = melee, 4 = ranged, 5 = death
        let frameIndex = 0;
        switch (this.state) {
            case 'idle':
                frameIndex = 0;
                break;
            case 'jump':
                frameIndex = 1;
                break;
            case 'run':
                // Bouncing run: alternate between frame 2 (run) and frame 0 (idle)
                frameIndex = (Math.floor(t / 120) % 2 === 0) ? 2 : 0;
                break;
            case 'attack-melee':
                frameIndex = 3;
                break;
            case 'attack-ranged':
                frameIndex = 4;
                break;
            case 'death':
                frameIndex = 5;
                break;
            default:
                frameIndex = 0;
        }

        // Draw cropped pixel-art sprite
        if (Player.hobbitSpriteSheet.complete) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                Player.hobbitSpriteSheet,
                frameIndex * VW, 0, VW, VH,
                0, 0, VW, VH
            );
        }

        // STING GLOW AURA
        if (this.stingGlowing && this.state !== 'death') {
            const STING_GLOW = '#4FC3F7';
            const pulse = 0.2 + Math.sin(t / 180) * 0.12;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = STING_GLOW;
            ctx.lineWidth = 3;
            ctx.shadowColor = STING_GLOW;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.ellipse(VW / 2, VH / 2 + 4, VW / 2 + 7, VH / 2 + 6, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            
            const pT = t / 200;
            for (let i = 0; i < 5; i++) {
                const pa = pT + i * (Math.PI * 2 / 5);
                const pr = 8 + Math.sin(pT + i) * 3;
                ctx.save();
                ctx.globalAlpha = 0.5 + Math.sin(pT + i) * 0.3;
                ctx.fillStyle = STING_GLOW;
                ctx.shadowColor = STING_GLOW;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(38 + Math.cos(pa) * pr, 35 + Math.sin(pa) * pr, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // HIT FEEDBACK
        if (this.hitFlash > 0) {
            const p = this.hitFlash / 12;
            ctx.save();
            ctx.globalAlpha = p * 0.65;
            ctx.fillStyle = p > 0.6 ? '#FFFFFF' : '#FF2200';
            ctx.beginPath();
            ctx.ellipse(VW / 2, VH * 0.5, VW / 2 + 6, VH / 2 + 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw hovering One Ring above head if invisible
        if (this.isInvisible && this.state !== 'death') {
            ctx.save();
            const pct = this.ringTimeLeft / this.ringTimeMax;
            const isLow = this.ringTimeLeft < 180; // less than 3 seconds remaining
            const flash = isLow && Math.floor(t / 150) % 2 === 0;
            
            ctx.globalAlpha = 1.0;
            ctx.shadowColor = flash ? '#FF0000' : '#FFD700';
            ctx.shadowBlur = isLow ? 15 : 10;
            ctx.strokeStyle = flash ? '#FF2200' : '#FFD700';
            ctx.lineWidth = 2;
            
            const ringY = -18 + Math.sin(t / 200) * 3; // bobbing
            
            // Draw central ring
            ctx.beginPath();
            ctx.arc(VW / 2, ringY, 6, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw diamond glint on ring
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(VW / 2 + 3, ringY - 3, 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw circular timer progress bar around the ring
            ctx.strokeStyle = flash ? '#FF0000' : 'rgba(255, 215, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Start at top (-Math.PI/2) and draw clockwise based on pct
            ctx.arc(VW / 2, ringY, 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
            ctx.stroke();
            
            // If time is low, draw a warning indicator
            if (isLow) {
                ctx.fillStyle = '#FF3300';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(Math.ceil(this.ringTimeLeft / 60) + 's', VW / 2, ringY + 23);
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
    constructor(x, y, width, height, theme = 'forest', type = 'stone') {
        super(x, y, width, height);
        this.theme = theme;
        this.type = type;
        this.baseX = x;
    }

    draw(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        if (sx + this.width < 0 || sx > 800) return;

        ctx.save();

        if (this.theme === 'mordor') {
            if (!Platform.stoneSprite) {
                Platform.stoneSprite = new Image();
                Platform.stoneSprite.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAYCAYAAABKtPtEAAABUUlEQVR4nO2XsW6DMBCGL9eiWiy8hpWqS5a8QZY8b5Y8BFsjFmbUiIUFIaE6lZEcIcvGNpjEVfwtto7Tfz58hw1AJBKJvDAblfFwON5kW5Zl0DQNXK8/sN1+Ql3XSsG+7yFJEmNglU6aptC2rVMCQoevjcfWcT6flLm+q4x8USJhDp+XZQmM/Q7BiqK428c+LvOpWHN0qqqa9NeBugfjAHIwk4/N/Fk6xhew2+1vWmd8G0ZKKSyFa10u34u1bHV0eaFLMN4CHNECS5Db6Vk6CP8cl0pSVQGaHHzvWGigyUEcab569h7Yo94SLTTtvjhbQ64Al7XJeSIEDiFkVX2EB8BveHPpus57C4yrAGXDGuiutyF8B9DGaa3+96k7VwvX3v1QEXmj+MqbRoGt/6N15+psKP2yqgBCPoYSy/PceG+Y+i1doi1gjAEietGKROC1+QOtuVSIkgQyogAAAABJRU5ErkJggg==";
            }
            if (!Platform.woodSprite) {
                Platform.woodSprite = new Image();
                Platform.woodSprite.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAcCAYAAAD2izi6AAABsElEQVR4nGNgGAWjYBSMgpELGHFJpDgq/wfRXKzMDN9+/wWLzdl/F6f64QaI9T/TALhtWAEWbIJNobr/H735hlXDxHgjcMzgAm8+fmNo3nCDkZC6/IXnwLGJrO73738MrKxMBNVhA99+/mCoXHGNLHufv//CICnIgyJPUQDWrb7MCEvC6ADkSXygecMNRmLU4TIPlz5C5oECj1x7RXi4iNZHVACCwLffv1FoGLjx/DODnAgXdj0/fw4Ldfj8jw5Gy0AKATwFurkFoGRZrt+XGdBroZEEuFhZwfQjVl0Gud+XwbSbG6Lc3LVrAyNKAMIEYABXGTjSgAbDNQZQdQoKxNFmDA3AaBlIz54IDOCr5d58/juk1aG3fynuiQzGCuT5++8MgwVgDUBHR+//yDFAKXjzEdH+ogaQFORkGAiAHC50LQNF+NkZhivAGYB3GTQwxIgZjZmz/y7jUFYHk8fmf5K6cpK/L4PbP4S6MsMVYPU/pG09spsxUTZyVO0gsBDqygy3rtyyI4+IGq4i1v9YU+D+/VtHzMgzKQBbuIwO6eMAo0P6dAIjrhIZBaOAYVgBAHS0GdyQkpA3AAAAAElFTkSuQmCC";
            }

            const W = this.width;
            const H = this.height;

            if (this.type === 'wooden-bridge') {
                const img = Platform.woodSprite;
                const leftCapW = 12;
                const rightCapW = 12;
                const midSrcW = 56;

                // Left post/chain
                ctx.drawImage(img, 0, 0, leftCapW, 28, sx, sy, leftCapW, H);

                // Middle planks tiled
                const midDestW = W - leftCapW - rightCapW;
                let currentX = sx + leftCapW;
                for (let mx = 0; mx < midDestW; mx += midSrcW) {
                    const chunkW = Math.min(midSrcW, midDestW - mx);
                    ctx.drawImage(img, leftCapW, 0, chunkW, 28, currentX, sy, chunkW, H);
                    currentX += chunkW;
                }

                // Right post/chain
                ctx.drawImage(img, 68, 0, rightCapW, 28, sx + W - rightCapW, sy, rightCapW, H);
            }
            else if (this.type === 'broken-bridge') {
                const img = Platform.woodSprite;
                const leftCapW = 12;
                const rightCapW = 12;
                const midSrcW = 56;
                const leftW = Math.round(W * 0.35);
                const rightStart = Math.round(W * 0.65);

                // Left segment: left cap + middle planks up to leftW
                ctx.drawImage(img, 0, 0, leftCapW, 28, sx, sy, leftCapW, H);
                const leftMidDestW = leftW - leftCapW;
                let currentX = sx + leftCapW;
                for (let mx = 0; mx < leftMidDestW; mx += midSrcW) {
                    const chunkW = Math.min(midSrcW, leftMidDestW - mx);
                    ctx.drawImage(img, leftCapW, 0, chunkW, 28, currentX, sy, chunkW, H);
                    currentX += chunkW;
                }

                // Right segment: planks from rightStart to W - rightCapW + right cap
                const rightMidDestW = W - rightStart - rightCapW;
                currentX = sx + rightStart;
                for (let mx = 0; mx < rightMidDestW; mx += midSrcW) {
                    const chunkW = Math.min(midSrcW, rightMidDestW - mx);
                    ctx.drawImage(img, leftCapW, 0, chunkW, 28, currentX, sy, chunkW, H);
                    currentX += chunkW;
                }
                ctx.drawImage(img, 68, 0, rightCapW, 28, sx + W - rightCapW, sy, rightCapW, H);

                // Dangling rope / plank decoration
                ctx.strokeStyle = '#5A3C1E'; // rope color
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(sx + leftW, sy + 4);
                ctx.quadraticCurveTo(sx + leftW + 8, sy + 20, sx + leftW + 4, sy + 24);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(sx + rightStart, sy + 4);
                ctx.quadraticCurveTo(sx + rightStart - 8, sy + 20, sx + rightStart - 4, sy + 24);
                ctx.stroke();

                ctx.save();
                ctx.translate(sx + leftW, sy + 6);
                ctx.rotate(0.5);
                ctx.drawImage(img, leftCapW, 0, 10, 20, 0, 0, 10, 16);
                ctx.restore();

                ctx.save();
                ctx.translate(sx + rightStart - 10, sy + 6);
                ctx.rotate(-0.5);
                ctx.drawImage(img, leftCapW, 0, 10, 20, 0, 0, 10, 16);
                ctx.restore();
            }
            else if (this.type === 'suspended-swing') {
                const img = Platform.woodSprite;
                const leftCapW = 12;
                const rightCapW = 12;
                const midSrcW = 56;

                // Left post/chain
                ctx.drawImage(img, 0, 0, leftCapW, 28, sx, sy, leftCapW, H);

                // Middle planks tiled
                const midDestW = W - leftCapW - rightCapW;
                let currentX = sx + leftCapW;
                for (let mx = 0; mx < midDestW; mx += midSrcW) {
                    const chunkW = Math.min(midSrcW, midDestW - mx);
                    ctx.drawImage(img, leftCapW, 0, chunkW, 28, currentX, sy, chunkW, H);
                    currentX += chunkW;
                }

                // Right post/chain
                ctx.drawImage(img, 68, 0, rightCapW, 28, sx + W - rightCapW, sy, rightCapW, H);

                // Long hanging metal chains to anchors
                const drawChainLink = (cx, cy) => {
                    ctx.fillStyle = '#464650';
                    ctx.fillRect(cx - 2, cy - 4, 4, 8);
                    ctx.fillStyle = '#787880';
                    ctx.fillRect(cx - 1, cy - 3, 2, 6);
                    ctx.fillStyle = '#282830';
                    ctx.fillRect(cx, cy - 2, 1, 4);
                };
                const drawChainLine = (x1, y1, x2, y2) => {
                    const dist = Math.hypot(x2 - x1, y2 - y1);
                    const steps = Math.ceil(dist / 8);
                    for (let i = 0; i <= steps; i++) {
                        const px = x1 + (x2 - x1) * (i / steps);
                        const py = y1 + (y2 - y1) * (i / steps);
                        drawChainLink(px, py);
                    }
                };
                drawChainLine(sx + 10, sy + 2, sx + 25, sy - 140);
                drawChainLine(sx + W - 10, sy + 2, sx + W - 25, sy - 140);
            }
            else {
                // Stone platforms: cliff-left, cliff-right, stone-island, stone (default)
                const img = Platform.stoneSprite;
                const leftCapW = 8;
                const rightCapW = 8;
                const midSrcW = 48;

                // Draw left sloped edge
                ctx.drawImage(img, 0, 0, leftCapW, 24, sx, sy, leftCapW, H);

                // Draw middle stone repeating
                const midDestW = W - leftCapW - rightCapW;
                let currentX = sx + leftCapW;
                for (let mx = 0; mx < midDestW; mx += midSrcW) {
                    const chunkW = Math.min(midSrcW, midDestW - mx);
                    ctx.drawImage(img, leftCapW, 0, chunkW, 24, currentX, sy, chunkW, H);
                    currentX += chunkW;
                }

                // Draw right sloped edge
                ctx.drawImage(img, 56, 0, rightCapW, 24, sx + W - rightCapW, sy, rightCapW, H);

                // If it is a floating island, draw layered craggy bottom rocks
                if (this.type === 'stone-island') {
                    // Layer 1: medium crag
                    const subW = Math.round(W * 0.7);
                    const subX = sx + (W - subW) / 2;
                    ctx.drawImage(img, leftCapW, 6, midSrcW, 14, subX, sy + H, subW, 14);

                    // Layer 2: small crag
                    const tinyW = Math.round(W * 0.4);
                    const tinyX = sx + (W - tinyW) / 2;
                    ctx.drawImage(img, leftCapW, 12, midSrcW, 10, tinyX, sy + H + 10, tinyW, 10);

                    // Lava drips
                    const t = Date.now();
                    const lavaAlpha = 0.5 + Math.sin(t / 200) * 0.4;
                    ctx.fillStyle = `rgba(255, 80, 20, ${lavaAlpha})`;
                    const step = W / 3;
                    for (let i = 0; i < 3; i++) {
                        const midX = sx + i * step + step / 2;
                        const peakY = sy + H + 18 + (i % 2 === 0 ? 6 : 2);
                        ctx.fillRect(midX - 2, peakY + ((t / 8) % 15), 4, 5);
                    }
                }
            }
        }
        else {
            // Keep original drawing code for other themes...
            const t = Date.now();
            switch (this.theme) {
                case 'forest': {
                    ctx.fillStyle = '#3B2510';
                    ctx.fillRect(sx, sy, this.width, this.height);
                    ctx.fillStyle = '#2A1A0A';
                    for (let i = 0; i < this.width; i += 18)
                        ctx.fillRect(sx + i, sy + 8, 2, this.height - 8);
                    ctx.fillStyle = '#1B4332';
                    ctx.fillRect(sx, sy, this.width, 10);
                    ctx.fillStyle = '#2D6A4F';
                    ctx.fillRect(sx, sy, this.width, 5);
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
            }
        }

        ctx.restore();
    }
}
class Enemy extends Entity {
    constructor(type, x, y, patrolMinX, patrolMaxX) {
        const dims = {
            Tree: [36, 60], Orc: [36, 52], UrukHai: [40, 58],
            Troll: [52, 64], Smaug: [90, 70], EyeOfSauron: [80, 80], NazgulRider: [64, 48]
        };
        const [w, h] = dims[type] || [36, 52];
        super(x, y, w, h);

        this.type        = type;
        this.patrolMinX  = patrolMinX;
        this.patrolMaxX  = patrolMaxX;
        this.vx          = type === 'Troll' ? 0.8 : type === 'Smaug' ? 1.2 : type === 'UrukHai' ? 1.0 : 1.5;
        this.direction   = 1;
        this.health      = this.getMaxHealth();
        this.knockbackVx = 0;

        // Extended state machine for Orc / other enemies
        this.state          = 'patrol'; // patrol | chase | attack-slash | attack-mace | attack-charge | death
        this.attackTimer    = 0;
        this.attackCooldown = 0;
        this.deathTimer     = 0;
        this.hitFlash       = 0;
    }

    getMaxHealth() {
        return { Smaug: 150, EyeOfSauron: 200, Troll: 60, UrukHai: 60, Orc: 30, Tree: 20, NazgulRider: 45 }[this.type] || 30;
    }

    applyKnockback(playerX) {
        this.knockbackVx = (this.x > playerX ? 1 : -1) * 9;
    }

    update(player, game) {
        if (this.type === 'EyeOfSauron') {
            this._updateEyeOfSauron(player, game);
            return;
        }
        if (this.type === 'NazgulRider') {
            this._updateNazgulRider(player, game);
            return;
        }
        // Apply knockback decay
        if (Math.abs(this.knockbackVx) > 0.1) {
            this.x += this.knockbackVx;
            this.knockbackVx *= 0.65;
        } else {
            this.knockbackVx = 0;
        }

        if (this.state === 'death') {
            this.deathTimer--;
            return; // no logic updates when dead
        }

        if (this.hitFlash > 0) this.hitFlash--;
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.attackCooldown > 0) this.attackCooldown--;

        // If health is depleted, transition to death state
        if (this.health <= 0) {
            this.state = 'death';
            this.deathTimer = 40; // 40-frame collapse animation
            return;
        }

        const distToPlayer = player ? Math.abs((player.x + player.width/2) - (this.x + this.width/2)) : Infinity;
        const playerOnSameLevel = player ? Math.abs(player.y - this.y) < 80 : false;
        
        // Orc AI behaviors
        if (this.type === 'Orc') {
            const isPlayerTargetable = player && !player.isInvisible && player.health > 0;
            
            if (isPlayerTargetable && distToPlayer < 240 && playerOnSameLevel) {
                // Chase mode
                this.state = 'chase';
                this.direction = (player.x + player.width/2 > this.x + this.width/2) ? 1 : -1;
                
                // If in close range, execute melee sword slash
                if (distToPlayer < 45 && this.attackCooldown <= 0) {
                    this.state = 'attack-slash';
                    this.attackTimer = 30;
                    this.attackCooldown = 90;
                    
                    // Deal damage mid-animation
                    setTimeout(() => {
                        if (game.player && !game.player.isInvisible && game.player.health > 0) {
                            const d = Math.abs((game.player.x + game.player.width/2) - (this.x + this.width/2));
                            if (d < 55) {
                                game.player.takeDamage(10, this.x + this.width/2);
                                game._updateHUD();
                                if (game.player.health <= 0) game.playerDie();
                            }
                        }
                    }, 250);
                } 
                // If further away, occasionally throw mace
                else if (distToPlayer > 100 && distToPlayer < 220 && this.attackCooldown <= 0 && Math.random() < 0.015) {
                    this.state = 'attack-mace';
                    this.attackTimer = 40;
                    this.attackCooldown = 120;
                    
                    const projX = this.direction === 1 ? this.x + this.width : this.x - 10;
                    const dx = player.x - projX;
                    const dy = player.y - this.y;
                    const angle = Math.atan2(dy, dx);
                    
                    game.projectiles.push(new Projectile(
                        projX,
                        this.y + this.height * 0.6,
                        Math.cos(angle) * 6.5,
                        Math.sin(angle) * 6.5, // straight line velocity
                        'spiked-mace',
                        'enemy'
                    ));
                }
            } else {
                this.state = 'patrol';
            }
        }

        // Uruk-hai Berserker AI behaviors
        if (this.type === 'UrukHai') {
            const isPlayerTargetable = player && !player.isInvisible && player.health > 0;

            if (isPlayerTargetable && distToPlayer < 300 && playerOnSameLevel) {
                // If not charging or cooldown active, chase
                if (this.state !== 'attack-charge') {
                    this.state = 'chase';
                    this.direction = (player.x + player.width/2 > this.x + this.width/2) ? 1 : -1;
                }

                // Melee overhead axe slam
                if (distToPlayer < 50 && this.attackCooldown <= 0 && this.state !== 'attack-charge') {
                    this.state = 'attack-slash'; // Reuse attack-slash state for rendering overhead slam
                    this.attackTimer = 35;
                    this.attackCooldown = 100;

                    // Deal heavy damage mid-animation
                    setTimeout(() => {
                        if (game.player && !game.player.isInvisible && game.player.health > 0) {
                            const d = Math.abs((game.player.x + game.player.width/2) - (this.x + this.width/2));
                            if (d < 60) {
                                game.player.takeDamage(16, this.x + this.width/2);
                                game._updateHUD();
                                if (game.player.health <= 0) game.playerDie();
                            }
                        }
                    }, 280);
                }
                // Charge attack (runs forward with axe raised)
                else if (distToPlayer > 120 && distToPlayer < 260 && this.attackCooldown <= 0 && Math.random() < 0.02 && this.state !== 'attack-charge') {
                    this.state = 'attack-charge';
                    this.attackTimer = 45; // 45 frames of charge
                    this.attackCooldown = 150;
                }
            } else if (this.state !== 'attack-charge') {
                this.state = 'patrol';
            }

            // Charge movement physics
            if (this.state === 'attack-charge') {
                const chargeSpeed = 4.2;
                this.x += chargeSpeed * this.direction;
                
                // Contact damage during charge
                if (player && !player.isInvisible && player.health > 0 && !player.invincibleTimer) {
                    const overlap = Math.abs((player.x + player.width/2) - (this.x + this.width/2)) < 35;
                    if (overlap) {
                        player.takeDamage(18, this.x + this.width/2);
                        game._updateHUD();
                        this.state = 'chase';
                        this.attackTimer = 0; // stop charge
                        if (player.health <= 0) game.playerDie();
                    }
                }
                
                if (this.attackTimer <= 0) {
                    this.state = 'chase';
                }
            }
        }

        // Movement application
        if (this.state === 'patrol') {
            const speed = this.type === 'Troll' ? 0.8 : this.type === 'Smaug' ? 1.2 : this.type === 'UrukHai' ? 1.0 : 1.4;
            this.x += speed * this.direction;
            if (this.x >= this.patrolMaxX) { this.direction = -1; this.x = this.patrolMaxX; }
            if (this.x <= this.patrolMinX) { this.direction =  1; this.x = this.patrolMinX; }
        } else if (this.state === 'chase') {
            const chaseSpeed = this.type === 'UrukHai' ? 2.2 : 1.9;
            this.x += chaseSpeed * this.direction;
            // Bound inside patrol range
            if (this.x > this.patrolMaxX) { this.x = this.patrolMaxX; this.state = 'patrol'; }
            if (this.x < this.patrolMinX) { this.x = this.patrolMinX; this.state = 'patrol'; }
        }
    }

    draw(ctx, cameraX) {
        const { sx, sy } = this.screenPos(cameraX);
        if (sx + this.width < 0 || sx > 800) return;

        const t = Date.now();
        ctx.save();
        ctx.translate(sx + this.width / 2, sy + this.height);
        if (this.direction === -1) ctx.scale(-1, 1);
        ctx.translate(-this.width / 2, -this.height);

        // Death collapse rotation
        if (this.state === 'death') {
            const progress = (40 - this.deathTimer) / 40;
            ctx.globalAlpha = 1 - progress;
            ctx.translate(this.width / 2, this.height);
            ctx.rotate(progress * Math.PI / 2); // fall flat on back
            ctx.translate(-this.width / 2, -this.height);
        }

        switch (this.type) {
            case 'Tree':        this._drawTree(ctx, t);        break;
            case 'Orc':         this._drawOrc(ctx, t);         break;
            case 'UrukHai':     this._drawUrukHai(ctx, t);     break;
            case 'Troll':       this._drawTroll(ctx, t);       break;
            case 'Smaug':       this._drawSmaug(ctx, t);       break;
            case 'EyeOfSauron': this._drawEyeOfSauron(ctx, t); break;
            case 'NazgulRider': this._drawNazgulRider(ctx, t); break;
        }

        // Draw smoke/bones when dead
        if (this.state === 'death') {
            const progress = (40 - this.deathTimer) / 40;
            ctx.fillStyle = `rgba(130, 130, 130, ${0.4 * (1 - progress)})`;
            for (let i = 0; i < 4; i++) {
                const px = this.width / 2 - 10 + Math.sin(t / 80 + i) * 10;
                const py = this.height - 10 - progress * 25 - i * 4;
                ctx.beginPath();
                ctx.arc(px, py, 3 + i, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Health bar above enemy
        if (this.health < this.getMaxHealth() && this.state !== 'death') {
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

        if (!Enemy.orcSpriteSheet) {
            Enemy.orcSpriteSheet = new Image();
            Enemy.orcSpriteSheet.src = "data:image/png;base64,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";
        }

        if (Enemy.orcSpriteSheet && Enemy.orcSpriteSheet.complete) {
            const sW = 48;
            const sH = 52;
            
            let frameIndex = 0;
            switch (this.state) {
                case 'idle':
                    frameIndex = 0;
                    break;
                case 'patrol':
                    // simple walk frame alternate using time
                    frameIndex = (Math.floor(t / 120) % 2 === 0) ? 1 : 0;
                    break;
                case 'chase':
                    frameIndex = (Math.floor(t / 80) % 2 === 0) ? 2 : 0;
                    break;
                case 'attack-slash':
                    frameIndex = 3;
                    break;
                case 'attack-mace':
                    frameIndex = 4;
                    break;
                case 'death':
                    frameIndex = 5;
                    break;
            }
            
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                Enemy.orcSpriteSheet,
                frameIndex * sW, 0, sW, sH,
                0, 0, W, H
            );
        } else {
            // Fallback drawing if sheet not loaded
            ctx.fillStyle = '#2E352C';
            ctx.fillRect(0, 0, W, H);
        }
    }

    _drawUrukHai(ctx, t) {
        const W = this.width, H = this.height;

        if (!Enemy.urukSpriteSheet) {
            Enemy.urukSpriteSheet = new Image();
            Enemy.urukSpriteSheet.src = "data:image/png;base64,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";
        }

        if (Enemy.urukSpriteSheet && Enemy.urukSpriteSheet.complete) {
            const sW = 52;
            const sH = 58;
            
            let frameIndex = 0;
            switch (this.state) {
                case 'idle':
                    frameIndex = 0;
                    break;
                case 'patrol':
                    // simple walk frame alternate using time
                    frameIndex = (Math.floor(t / 140) % 2 === 0) ? 1 : 0;
                    break;
                case 'chase':
                    frameIndex = (Math.floor(t / 100) % 2 === 0) ? 2 : 0;
                    break;
                case 'attack-slash':
                    frameIndex = 3;
                    break;
                case 'attack-charge':
                    frameIndex = 4;
                    break;
                case 'death':
                    frameIndex = 5;
                    break;
            }
            
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                Enemy.urukSpriteSheet,
                frameIndex * sW, 0, sW, sH,
                0, 0, W, H
            );
        } else {
            // Fallback drawing if sheet not loaded
            ctx.fillStyle = '#3C3F42';
            ctx.fillRect(0, 0, W, H);
        }
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

        if (!Enemy.eyeSpriteSheet) {
            Enemy.eyeSpriteSheet = new Image();
            Enemy.eyeSpriteSheet.src = "data:image/png;base64,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";
        }

        if (Enemy.eyeSpriteSheet && Enemy.eyeSpriteSheet.complete) {
            const sW = 80;
            const sH = 80;
            
            let frameIndex = 0;
            if (this.state === 'death') {
                // Defeated collapse: Frame 4 (defeated) then Frame 5 (collapse)
                frameIndex = this.deathTimer < 120 ? 5 : 4;
            } else {
                switch (this.bossState) {
                    case 'idle':
                        frameIndex = 0;
                        break;
                    case 'gaze-charge':
                    case 'shockwave':
                    case 'summon':
                        frameIndex = 1; // active/glow
                        break;
                    case 'gaze-beam':
                        frameIndex = 2; // gaze-beam
                        break;
                    case 'fireballs':
                        frameIndex = 3; // fireballs
                        break;
                    default:
                        frameIndex = 0;
                }
            }
            
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                Enemy.eyeSpriteSheet,
                frameIndex * sW, 0, sW, sH,
                0, 0, W, H
            );
        } else {
            // Fallback drawing if sheet not loaded
            ctx.fillStyle = '#2A1A1A';
            ctx.fillRect(0, 0, W, H);
        }
    }

    _drawNazgulRider(ctx, t) {
        const W = this.width, H = this.height;
        const flap = Math.sin(t / 100) * 14;
        
        ctx.save();
        ctx.translate(W / 2, H / 2);
        
        // Face drawing direction
        if (this.direction === -1) ctx.scale(-1, 1);
        
        // Draw wing shadow/blur
        ctx.fillStyle = 'rgba(25, 20, 35, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-15, -10 + flap * 0.5, 12, 25, Math.PI / 6, 0, Math.PI * 2);
        ctx.ellipse(15, -10 + flap * 0.5, 12, 25, -Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Main body (Fell Beast) - Dark gray/purple
        ctx.fillStyle = '#1A1820';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Neck and head
        ctx.beginPath();
        ctx.moveTo(15, -2);
        ctx.quadraticCurveTo(25, -15, 30, -12); // Neck
        ctx.lineTo(28, -5);
        ctx.closePath();
        ctx.fill();
        
        // Head
        ctx.fillStyle = '#100E14';
        ctx.beginPath();
        ctx.arc(30, -12, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Glowing red eye (evil!)
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(31, -14, 2, 2);
        
        // Wings (front layer) - flapping
        ctx.fillStyle = '#100E14';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-24, -25 + flap);
        ctx.lineTo(-12, -2);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(24, -25 + flap);
        ctx.lineTo(12, -2);
        ctx.closePath();
        ctx.fill();
        
        // Tail
        ctx.strokeStyle = '#1A1820';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-18, 2);
        ctx.quadraticCurveTo(-28, 12, -35, 10);
        ctx.stroke();
        
        // Rider (Nazgul) on back
        ctx.fillStyle = '#050406'; // Blackest black for the wraith
        ctx.beginPath();
        // Cloak/torso
        ctx.moveTo(-5, -6);
        ctx.lineTo(0, -18);
        ctx.lineTo(5, -6);
        ctx.closePath();
        ctx.fill();
        // Hooded head
        ctx.beginPath();
        ctx.arc(0, -18, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    _updateNazgulRider(player, game) {
        if (this.hitFlash > 0) this.hitFlash--;

        if (this.health <= 0) {
            this.state = 'death';
            this.deathTimer = 40;
            return;
        }

        if (!this.nazgulState) {
            this.nazgulState = 'fly';
            this.nazgulTimer = 120; // 2 seconds of fly
            this.targetY = 280;
        }
        
        this.nazgulTimer--;
        
        if (this.nazgulState === 'fly') {
            // Move towards target position above player
            const tx = player.x + (this.direction * 100);
            const ty = 280;
            this.x += (tx - this.x) * 0.03;
            this.y += (ty - this.y) * 0.03;
            
            if (this.nazgulTimer <= 0) {
                // Start dive attack
                this.nazgulState = 'dive';
                this.nazgulTimer = 90; // dive duration
                // Play scream sound
                if (window.audioManager && window.audioManager.playScream) window.audioManager.playScream();
                // Create slow/scream shockwave visual
                if (!game.screams) game.screams = [];
                game.screams.push({
                    x: this.x + 32,
                    y: this.y + 24,
                    r: 10,
                    maxR: 120,
                    alive: true
                });
            }
        } else if (this.nazgulState === 'dive') {
            // Dive fast towards player center
            const tx = player.x;
            const ty = player.y;
            this.x += (tx - this.x) * 0.06;
            this.y += (ty - this.y) * 0.06;
            
            // Deal contact damage if overlapping
            if (game._aabb(this, player) && !player.isInvisible && !player.invincibleTimer) {
                player.takeDamage(12, this.x + 32);
                game._updateHUD();
                this.nazgulState = 'retreat';
                this.nazgulTimer = 60;
                if (player.health <= 0) game.playerDie();
            }
            
            if (this.nazgulTimer <= 0) {
                this.nazgulState = 'retreat';
                this.nazgulTimer = 60;
            }
        } else if (this.nazgulState === 'retreat') {
            // Rise back up quickly
            this.y += (320 - this.y) * 0.05;
            if (this.nazgulTimer <= 0) {
                this.nazgulState = 'fly';
                this.nazgulTimer = 150 + Math.random() * 60;
            }
        }
        
        // Face movement direction
        if (player.x > this.x) {
            this.direction = 1;
        } else {
            this.direction = -1;
        }
    }

    _updateEyeOfSauron(player, game) {
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.attackCooldown > 0) this.attackCooldown--;

        if (this.health <= 0) {
            if (this.state !== 'death') {
                this.state = 'death';
                this.deathTimer = 240; // 4 seconds death collapse
                game.flashOpacity = 1.0; // trigger white screen flash
                if (window.audioManager && window.audioManager.playExplosion) window.audioManager.playExplosion();
            }
            this.deathTimer--;
            
            // Screen shake during collapse
            game.shakeDuration = Math.max(game.shakeDuration || 0, 5);
            game.shakeIntensity = Math.max(game.shakeIntensity || 0, 10);
            return;
        }

        // --- Boss Active State Machine ---
        if (!this.bossState) {
            this.bossState = 'idle';
            this.stateTimer = 180;
        }

        this.stateTimer--;

        // Determine current phase based on HP
        const hpPct = this.health / this.getMaxHealth();
        const phase = hpPct <= 0.6 ? 2 : 1;

        if (this.stateTimer <= 0) {
            if (this.bossState === 'idle') {
                // Choose attack state
                const r = Math.random();
                if (r < 0.35) {
                    this.bossState = 'gaze-charge';
                    this.stateTimer = 60; // 1 second warning
                } else if (r < 0.70) {
                    this.bossState = 'fireballs';
                    this.stateTimer = 150; // 2.5 seconds fireballs
                } else {
                    if (phase === 2 && Math.random() < 0.5) {
                        this.bossState = 'shockwave';
                        this.stateTimer = 120; // 2 seconds shockwave
                        game.shakeDuration = 120;
                        game.shakeIntensity = 6;
                    } else {
                        this.bossState = 'summon';
                        this.stateTimer = 60; // 1 second summoning
                    }
                }
            } else if (this.bossState === 'gaze-charge') {
                this.bossState = 'gaze-beam';
                this.stateTimer = 240; // 4 seconds sweep
                this.laserSweepProgress = 0;
                this.laserDirection = player.x < this.x ? -1 : 1;
            } else {
                this.bossState = 'idle';
                this.stateTimer = phase === 2 ? 80 : 140; // shorter idle in phase 2
            }
        }

        // Execute active state actions
        if (this.bossState === 'gaze-beam') {
            const progress = (240 - this.stateTimer) / 240;
            // Sweep beam X coordinate
            let startX = 4480;
            let sweepRange = 600;
            let endX;
            if (this.laserDirection === -1) {
                endX = 4780 - progress * sweepRange;
            } else {
                endX = 4180 + progress * sweepRange;
            }
            this.beamEndX = endX;
            
            // Check collision with player
            const playerCenterY = player.y + player.height / 2;
            const t = (playerCenterY - 290) / (0 - 290);
            if (t >= 0 && t <= 1) {
                const laserX = 4480 + t * (endX - 4480);
                const playerCenterX = player.x + player.width / 2;
                if (Math.abs(playerCenterX - laserX) < 25 && !player.isInvisible) {
                    player.takeDamage(12, laserX);
                    game._updateHUD();
                    if (player.health <= 0) game.playerDie();
                }
            }
        } else if (this.bossState === 'fireballs') {
            if (this.stateTimer % 30 === 0) {
                // Aim at player
                const fbX = 4480;
                const fbY = 290;
                const dx = player.x - fbX;
                const dy = player.y - fbY;
                const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.15;
                const speed = phase === 2 ? 6.5 : 5.0;
                game.projectiles.push(new Projectile(
                    fbX,
                    fbY,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    'fireball',
                    'enemy' // set source to 'enemy' so it hits player
                ));
            }
        } else if (this.bossState === 'shockwave') {
            // Screen shake active, periodically stun/fear player if grounded
            if (this.stateTimer % 20 === 0 && player.isGrounded && !player.isInvisible) {
                player.takeDamage(4, player.x);
                player.knockbackVx = (Math.random() - 0.5) * 6;
                player.fearTimer = 90; // scare player: jump height reduced
                game._updateHUD();
                if (player.health <= 0) game.playerDie();
            }
        } else if (this.bossState === 'summon') {
            if (this.stateTimer === 30) { // spawn mid-animation
                if (phase === 2) {
                    // Phase 2: summon Nazgul Rider
                    const spawnLeft = Math.random() < 0.5;
                    const spawnX = player.x + (spawnLeft ? -300 : 300);
                    // Spawn flying minion
                    game.enemies.push(new Enemy(
                        'NazgulRider',
                        spawnX,
                        300,
                        4000,
                        4800
                    ));
                } else {
                    // Phase 1: summon Orc or Uruk-hai
                    const spawnLeft = Math.random() < 0.5;
                    const spawnX = player.x + (spawnLeft ? -250 : 250);
                    const spawnType = Math.random() < 0.4 ? 'UrukHai' : 'Orc';
                    game.enemies.push(new Enemy(
                        spawnType,
                        spawnX,
                        40,
                        4200,
                        4800
                    ));
                }
            }
        }
    }
}

// --------------------------------------------------------------------------
// Projectile — rock (parabolic arc) or slash (short-lived melee)
// --------------------------------------------------------------------------
class Projectile extends Entity {
    constructor(x, y, vx, vy, type, source) {
        const size = type === 'spiked-mace' ? 14 : type === 'rock' ? 10 : 4;
        super(x, y, size, size);
        this.vx      = vx;
        this.vy      = vy || 0;
        this.type    = type;
        this.source  = source;
        this.alive   = true;
        this.maxLife = type === 'slash' ? 10 : type === 'spiked-mace' ? 360 : 160;
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
        } else if (this.type === 'spiked-mace' || this.type === 'fireball') {
            this.y  += this.vy; // straight movement, no gravity
        }
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const { sx, sy } = this.screenPos(cameraX);
        const progress   = this.frame / this.maxLife;
        const t          = Date.now();

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

        } else if (this.type === 'spiked-mace' || this.type === 'fireball') {
            ctx.save();
            ctx.translate(sx + 7, sy + 7);
            ctx.rotate(t * 0.015); // spin spiked mace
            
            // Core ball (5x5 pixels)
            ctx.fillStyle = '#4A4A50';
            ctx.fillRect(-2.5, -2.5, 5, 5);
            // Highlight
            ctx.fillStyle = '#8A8A90';
            ctx.fillRect(-1.5, -1.5, 2, 2);
            
            // Spikes (1x2 blocks at 4 cardinals)
            ctx.fillStyle = '#7A7A80';
            ctx.fillRect(-4.5, -0.5, 2, 1); // left spike
            ctx.fillRect(2.5, -0.5, 2, 1);  // right spike
            ctx.fillRect(-0.5, -4.5, 1, 2); // top spike
            ctx.fillRect(-0.5, 2.5, 1, 2);  // bottom spike
            
            // Diagonal spikes
            ctx.fillRect(-3.5, -3.5, 1, 1);
            ctx.fillRect(2.5, -3.5, 1, 1);
            ctx.fillRect(-3.5, 2.5, 1, 1);
            ctx.fillRect(2.5, 2.5, 1, 1);
            
            ctx.restore();
            
            // Tail chain links (trailing behind, drawn as retro pixel blocks)
            ctx.save();
            ctx.fillStyle = 'rgba(80, 80, 85, 0.75)';
            for (let trail = 1; trail <= 4; trail++) {
                const tx = sx + 7 - this.vx * trail * 1.6;
                const ty = sy + 7 - this.vy * trail * 1.6;
                ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
            }
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
