/**
 * Projectile Entity
 * Handles bullets, grenades, kunai and other projectiles
 */
import { audioEngine } from '../systems/Audio.js';

export class Projectile {
    constructor(owner, x, y, angle, speed, damage, gameRef) {
        this.owner = owner;
        this.x = x;
        this.y = y;
        this.startX = x; // Store initial position for range calculations
        this.startY = y;
        this.angle = angle; // Store angle for drawing rotation
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
        this.damage = damage;
        this.radius = 4;
        this.active = true;
        this.game = gameRef;

        // Grenade props
        this.isGrenade = false;
        this.z = 0;
        this.vz = 0;
        this.hasExploded = false;

        // Kunai props
        this.isKunai = false;
        this.maxDist = 0;
        this.travelled = 0;
        this.hitList = []; // For piercing (tracks entity references, not IDs)
        this.isEmbedded = false;

        // Missile props
        this.isMissile = false;
        this.target = null;
        this.turnSpeed = 0.05; // Weak homing

        // Sniper/Claymore props
        this.isClaymore = false;
        this.stunDuration = 0;
        this.slowDuration = 0;
        this.lifeTime = 0;
        this.isSniperShot = false;
        this.isSniperUltShot = false;
        this.isUnblockable = false;

        // Ballista bolt props
        this.isBallistaBolt = false;
        this.isUltBolt = false;
        this.dragTarget = null;
        this.dragDuration = 0;
        this.boltIndex = 0;

        // Deflection props
        this.isDeflected = false;
        this.deflect = 0;

        // ============================================
        // UNIFIED IMPACT PROPERTIES (De-spaghettification)
        // ============================================
        // These properties allow the collision handler to process
        // all projectile types with a single generic code path.
        this.impactSound = 'hit';           // Sound ID: 'hit', 'zap', 'explosion', etc.
        this.impactParticle = null;         // Particle spawner: 'quincyArrow', 'zoltraakImpact', 'explosion', etc.
        this.statusEffect = null;           // Status effect: { type: 'STUN', duration: 30 } or null
        this.piercing = false;              // If true, projectile continues after hitting
        this.knockbackForce = 0;            // Force applied to hit entity
        // ============================================
        // COMPONENT SYSTEM (Phase 2 Refactor)
        // ============================================
        this.components = [];

        // ============================================
        // IMMOBILIZATION TRACKING (Generic Stuck Projectile Cleanup)
        // ============================================
        // Tracks projectiles that lose velocity due to external factors
        // (e.g., Limitless, shields, etc.) and despawns them after threshold
        this.immobilizedTimer = 0;
        this.immobilizationThreshold = 120; // Frames (~2 seconds at 60fps)
        this.velocityThreshold = 0.1; // Speed below this is considered immobilized
    }

    addComponent(component) {
        this.components.push(component);
        return this;
    }

    update(timeScale = 1.0) {
        // 0. IMMOBILIZATION CHECK (Generic Stuck Projectile Cleanup)
        // Prevents projectiles from hanging indefinitely when immobilized by external factors
        const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);

        if (speed < this.velocityThreshold && !this.isEmbedded && !this.isClaymore && !this.isGrenade) {
            // Projectile is immobilized (not counting embedded kunai or placed claymores)
            this.immobilizedTimer++;

            if (this.immobilizedTimer >= this.immobilizationThreshold) {
                // Despawn with visual feedback
                this.active = false;
                if (this.game && this.game.particles) {
                    this.game.particles.spawn(this.x, this.y, '#888888', 3);
                }
                return;
            }
        } else {
            // Projectile is moving, reset timer
            this.immobilizedTimer = 0;
        }

        // 1. BEHAVIOR SYSTEM
        if (this.components.length > 0) {
            for (const component of this.components) {
                component.update(this, timeScale);
            }
            return;
        }

        // 2. FALLBACK LEGACY LOGIC (Deprecated, for safety/tests only)
        // Basic movement for projectiles without components
        this.x += this.dx * timeScale;
        this.y += this.dy * timeScale;

        // Basic bounds check
        const bounds = this.game.arenaBounds;
        if (this.x < bounds.x || this.x > bounds.x + bounds.width ||
            this.y < bounds.y || this.y > bounds.y + bounds.height) {
            this.active = false;
        }
    }

    /**
     * Trigger impact hook on all components
     * @param {Entity} target - The entity hit (null if wall)
     */
    triggerImpact(target = null) {
        for (const component of this.components) {
            if (typeof component.onImpact === 'function') {
                component.onImpact(this, target);
            }
        }
    }

    draw(ctx) {
        // 0. COMPONENT RENDERER
        if (this.renderer) {
            this.renderer.draw(ctx, this);
            return;
        }

        // Fallback Renderer
        ctx.fillStyle = typeof this.color === 'string' ? this.color : '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius || 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
