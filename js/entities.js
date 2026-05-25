// ==========================================================================
// Lord of the Hacks - Entity OOP System
// ==========================================================================

class Entity {
    constructor(x, y, width, height, className) {
        this.x = x;
        this.y = y; // y is distance from ground up (bottom-up coordinate system)
        this.width = width;
        this.height = height;
        this.className = className;
        this.element = null;
        
        this.createDOMElement();
    }

    createDOMElement() {
        this.element = document.createElement('div');
        this.element.className = `entity ${this.className}`;
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        
        // Initial DOM render
        this.updateDOM();
    }

    updateDOM() {
        if (!this.element) return;
        
        // bottom coordinate matches bottom of the element (inverting height because DOM is top-down)
        // In our game coordinates, y=0 is the bottom of the level (y grows upward)
        const renderX = this.x;
        const renderY = 470 - this.y - this.height; // viewport height is 470px
        
        this.element.style.transform = `translate3d(${renderX}px, ${renderY}px, 0)`;
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

// ==========================================================================
// Player Entity Class
// ==========================================================================
class Player extends Entity {
    constructor(x, y, charType) {
        // Character type specs: Hobbit, Ranger, Wizard
        let width = 32;
        let height = 48;
        super(x, y, width, height, 'player-entity');
        
        this.charType = charType;
        this.vx = 0;
        this.vy = 0;
        this.isGrounded = false;
        
        // Add visual class for the selected character sprite
        if (this.element) {
            this.element.classList.add(`player-${charType.toLowerCase()}`);
        }
        
        // Stats based on character levels
        this.setupStats();
    }

    setupStats() {
        switch (this.charType) {
            case 'Wizard':
                this.maxHealth = 100;
                this.shootCooldown = 300; // ms
                this.damage = 30;
                break;
            case 'Ranger':
                this.maxHealth = 70;
                this.shootCooldown = 450; // ms
                this.damage = 15;
                break;
            case 'Hobbit':
            default:
                this.maxHealth = 40;
                this.shootCooldown = 600; // ms
                this.damage = 8;
                break;
        }
        this.health = this.maxHealth;
    }

    jump() {
        if (this.isGrounded) {
            this.vy = 12; // Initial upward jump force
            this.isGrounded = false;
        }
    }

    shoot() {
        // Implement projectile spawn logic returning a Projectile entity
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
    }
}

// ==========================================================================
// Platform Entity Class
// ==========================================================================
class Platform extends Entity {
    constructor(x, y, width, height, type = 'default') {
        super(x, y, width, height, 'platform-entity');
        this.type = type;
        if (this.element) {
            this.element.classList.add(`platform-${type}`);
        }
    }
}

// ==========================================================================
// Enemy Entity Class
// ==========================================================================
class Enemy extends Entity {
    constructor(type, x, y, patrolMinX, patrolMaxX) {
        let width = 36;
        let height = 44;
        super(x, y, width, height, 'enemy-entity');
        
        this.type = type;
        this.patrolMinX = patrolMinX;
        this.patrolMaxX = patrolMaxX;
        this.vx = 1.5; // Patrol speed
        this.direction = 1; // 1 = Right, -1 = Left
        
        if (this.element) {
            this.element.classList.add(`enemy-${type.toLowerCase()}`);
        }
    }

    update() {
        // Basic patrol AI logic
        this.x += this.vx * this.direction;
        if (this.x >= this.patrolMaxX) {
            this.direction = -1;
            this.x = this.patrolMaxX;
        } else if (this.x <= this.patrolMinX) {
            this.direction = 1;
            this.x = this.patrolMinX;
        }
        this.updateDOM();
    }
}

// ==========================================================================
// Projectile Entity Class
// ==========================================================================
class Projectile extends Entity {
    constructor(x, y, vx, source) {
        super(x, y, 8, 8, 'projectile-entity');
        this.vx = vx;
        this.source = source; // 'player' or 'enemy'
    }

    update() {
        this.x += this.vx;
        this.updateDOM();
    }
}

// ==========================================================================
// Collectible Entity Class
// ==========================================================================
class Collectible extends Entity {
    constructor(type, x, y, value) {
        let size = type === 'gem' ? 16 : 12;
        super(x, y, size, size, 'collectible-entity');
        this.type = type; // 'coin', 'gem', or 'arkenstone'
        this.value = value;
        
        if (this.element && type === 'gem') {
            this.element.classList.add('gem');
        }
    }
}
