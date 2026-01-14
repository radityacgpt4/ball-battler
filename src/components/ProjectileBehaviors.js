/**
 * Projectile Behaviors (Component System)
 * Defines isolated, reusable behaviors for projectiles.
 */

// BASE COMPONENT INTERFACE
// class Behavior {
//     update(projectile, timeScale) {}
//     draw(ctx, projectile) {} // Optional
// }

export class LinearMovement {
    constructor() { }

    update(p, timeScale) {
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;

        // Standard bounds check
        const bounds = p.game.arenaBounds;
        if (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height) {

            // Allow behaviors to override "die on wall" (e.g. bounce)
            if (!p.ignoreBounds) {
                p.active = false;
            }
        }
    }
}

export class HomingBehavior {
    /**
     * @param {number} turnSpeed - Radians per frame (e.g. 0.05)
     * @param {string} targetType - 'ENEMY' (default) or specific entity
     */
    constructor(turnSpeed = 0.05) {
        this.turnSpeed = turnSpeed;
    }

    update(p, timeScale) {
        // Smoke Trail Effect (Visuals are technically behaviors too, or just side effects)
        if (Math.random() < 0.5 * timeScale) {
            p.game.particles.spawnEffect('smoke', p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10);
        }

        // 1. Acquire Target
        if (!p.target || p.target.isDead) {
            const enemies = p.game.entities.filter(e => e !== p.owner && !e.isDead);
            let closest = null;
            let minDist = Infinity;
            for (const e of enemies) {
                const d = Math.hypot(e.x - p.x, e.y - p.y);
                if (d < minDist) {
                    minDist = d;
                    closest = e;
                }
            }
            p.target = closest;
        }

        // 2. Turn towards target
        if (p.target) {
            const targetAngle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            let angleDiff = targetAngle - p.angle;

            // Normalize
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Turn
            const turn = this.turnSpeed * timeScale;
            if (Math.abs(angleDiff) < turn) {
                p.angle = targetAngle;
            } else {
                p.angle += Math.sign(angleDiff) * turn;
            }

            // Apply new velocity
            const speed = Math.hypot(p.dx, p.dy);
            p.dx = Math.cos(p.angle) * speed;
            p.dy = Math.sin(p.angle) * speed;
        }
    }
}

export class BallisticBehavior {
    /**
     * @param {number} gravity - Gravity force (e.g. 0.5)
     * @param {boolean} bounce - Whether to bounce on ground/walls
     */
    constructor(gravity = 0.5) {
        this.gravity = gravity;
    }

    update(p, timeScale) {
        // Z-axis physics
        p.z = p.z || 0;
        p.vz = p.vz || 0;

        p.z += p.vz * timeScale;
        p.vz -= this.gravity * timeScale;

        // Wall Bounce Logic (Grenade style)
        const bounds = p.game.arenaBounds;
        if (p.x < bounds.x || p.x > bounds.x + bounds.width) {
            p.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width, p.x));
            p.dx *= -0.5;
        }
        if (p.y < bounds.y || p.y > bounds.y + bounds.height) {
            p.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height, p.y));
            p.dy *= -0.5;
        }

        // Ground Hit
        if (p.z <= 0) {
            p.z = 0;
            p.active = false;
            p.hasExploded = true; // Signals explosion spawner in Ability or Projectile

            // Trigger impact immediately if defined
            if (p.impactParticle) {
                p.game.particles.spawnEffect(p.impactParticle, p.x, p.y);
            }
            if (p.impactSound) {
                p.game.audioEngine.play(p.impactSound);
            }
        }

        p.ignoreBounds = true; // Disable standard linear cleanup
    }
}
