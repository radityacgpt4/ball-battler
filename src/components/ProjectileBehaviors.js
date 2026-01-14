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

        // Homing missiles usually use LinearMovement as well, but if they don't, we need to move them 
        // to check bounds. IF LinearMovement is attached, it will handle movement and bounds.
        // BUT, MissileBarrage attaches BOTH. Homing adjusts angle/velocity, Linear moves.
        // If the projectile has NO LinearMovement, we should check bounds here.
        // However, checking bounds here is safe regardless.

        const bounds = p.game.arenaBounds;
        if (!p.ignoreBounds && (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height)) {
            p.active = false;
        }
    }
}

export class BallisticBehavior {
    /**
     * @param {number} gravity - Gravity force (e.g. 0.5)
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

export class QuincyTrailBehavior {
    update(p, timeScale) {
        if (!p.active) return;

        const z = p.z || 0;

        // Spawn trailing beam segments
        if (p.lastTrailX !== undefined) {
            const distSq = (p.x - p.lastTrailX) ** 2 + ((p.y - z) - p.lastTrailY) ** 2;
            if (distSq > 25) { // Every 5px
                p.game.particles.particles.push({
                    type: 'beam',
                    x1: p.lastTrailX, y1: p.lastTrailY,
                    x2: p.x, y2: p.y - z,
                    color: p.isPerfectShot ? '#00BFFF' : '#1E90FF',
                    life: 0.4, decay: 0.1, width: p.isPerfectShot ? 4 : 3
                });
                p.lastTrailX = p.x;
                p.lastTrailY = p.y - z;
            }
        } else {
            p.lastTrailX = p.x;
            p.lastTrailY = p.y - z;
        }

        // Spawn crisp pixel blocks for sparkle effect
        if (p.game.frameAccumulator % 2 === 0) {
            // 1. Center Trail
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 12,
                y: p.y - z - Math.sin(p.angle) * 12,
                vx: 0, vy: 0,
                life: 0.3, decay: 0.1,
                size: 3,
                color: '#00BFFF',
                type: 'square',
                alpha: 1.0
            });

            // 2. Occasional "Glitch" Pixels
            if (Math.random() < 0.4) {
                const offset = (Math.random() < 0.5 ? -1 : 1) * 6;
                const perpAngle = p.angle + Math.PI / 2;
                p.game.particles.particles.push({
                    x: p.x - Math.cos(p.angle) * 10 + Math.cos(perpAngle) * offset,
                    y: p.y - z - Math.sin(p.angle) * 10 + Math.sin(perpAngle) * offset,
                    vx: Math.cos(perpAngle) * offset * 0.3,
                    vy: Math.sin(perpAngle) * offset * 0.3,
                    life: 0.25, decay: 0.1,
                    size: 2,
                    color: '#E0FFFF',
                    type: 'dot'
                });
            }
        }

        // Perfect shot gets extra sparkle
        if (p.isPerfectShot && Math.random() < 0.15) {
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 8,
                y: p.y - z - Math.sin(p.angle) * 8,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 0.3, decay: 0.1,
                size: 3, color: '#ffffff', type: 'dot'
            });
        }
    }
}

export class CurveBehavior {
    constructor(curveSide = 0, curveAmount = 0.05) {
        this.curveSide = curveSide;
        this.curveAmount = curveAmount;
    }

    update(p, timeScale) {
        // Curve to velocity vector
        const curveSpeed = this.curveAmount * (p.curveSide || this.curveSide);

        // Rotate dx, dy
        const cos = Math.cos(curveSpeed);
        const sin = Math.sin(curveSpeed);

        // Range Limit check (Rubber Fist)
        if (p.startX && p.maxDist) {
            const travel = Math.hypot(p.x - p.startX, p.y - p.startY);
            if (travel >= p.maxDist) {
                p.active = false;
                p.game.particles.spawn(p.x, p.y, '#ffccaa', 1);
                return;
            }
        }

        const newDx = p.dx * cos - p.dy * sin;
        const newDy = p.dx * sin + p.dy * cos;

        p.dx = newDx;
        p.dy = newDy;

        // Sync angle
        p.angle += curveSpeed;

        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;
    }
}

export class ZoltraakBehavior {
    constructor(homingStrength = 0.03, maxDist = 450) {
        this.homingStrength = homingStrength;
        this.maxDist = maxDist;
    }

    update(p, timeScale) {
        // p.ignoreBounds = true; // REMOVED: Should obey bounds unless intentional

        // Range Limit check
        const travel = Math.hypot(p.x - p.startX, p.y - p.startY);
        if (travel >= this.maxDist) {
            p.active = false;
            p.game.particles.spawn(p.x, p.y, '#4fc3f7', 2);
            return;
        }

        // Homing
        if (p.target && !p.target.isDead) {
            const targetAngle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            let angleDiff = targetAngle - p.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            const turn = Math.max(-this.homingStrength, Math.min(this.homingStrength, angleDiff));
            p.angle += turn;

            const speed = Math.hypot(p.dx, p.dy);
            p.dx = Math.cos(p.angle) * speed;
            p.dy = Math.sin(p.angle) * speed;
        }

        // Move
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;

        // Bounds Check
        const bounds = p.game.arenaBounds;
        if (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height) {
            p.active = false;
            p.game.particles.spawn(p.x, p.y, '#4fc3f7', 2);
            return;
        }

        // Visuals (Laser Trail)
        if (p.lastX !== undefined) {
            const distSq = (p.x - p.lastX) ** 2 + (p.y - p.lastY) ** 2;
            if (distSq > 36) {
                p.game.particles.spawnBeam(
                    p.lastX, p.lastY,
                    p.x, p.y,
                    '#4fc3f7', 4, 0.05
                );
                p.lastX = p.x;
                p.lastY = p.y;
            }
        } else {
            p.lastX = p.x;
            p.lastY = p.y;
        }

        // Sparkles
        if (Math.random() < 0.25) {
            const perpAngle = p.angle + Math.PI / 2;
            const offsetDir = Math.random() < 0.5 ? 1 : -1;
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 8,
                y: p.y - Math.sin(p.angle) * 8,
                vx: Math.cos(perpAngle) * offsetDir * 2 + (Math.random() - 0.5) * 2,
                vy: Math.sin(perpAngle) * offsetDir * 2 + (Math.random() - 0.5) * 2,
                life: 0.4, decay: 0.08,
                size: Math.random() < 0.3 ? 3 : 2,
                color: Math.random() < 0.5 ? '#ffffff' : '#87CEEB',
                type: 'dot'
            });
        }

        // Rune-like square particles
        if (Math.random() < 0.08) {
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 6,
                y: p.y - Math.sin(p.angle) * 6,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 0.3, decay: 0.1,
                size: 4, color: '#4fc3f7', type: 'square'
            });
        }
    }
}

export class LichtRegenBehavior {
    update(p, timeScale) {
        p.ignoreBounds = true;

        // 1. Airborne
        if (p.z > 0) {
            p.z += p.vz * timeScale;
            p.vz -= 0.5 * timeScale; // Gravity

            // Move X/Y
            p.x += p.dx * timeScale;
            p.y += p.dy * timeScale;

            // Trail
            if (Math.random() < 0.4) {
                p.game.particles.particles.push({
                    x: p.x + (Math.random() - 0.5) * 6,
                    y: p.y - p.z,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: 1.5,
                    life: 0.4, decay: 0.06,
                    size: 1.5,
                    color: '#00BFFF',
                    type: 'square'
                });
            }

            // Landing Logic
            if (p.z <= 0) {
                p.z = 0;
                // Transition to Landed State
                p.landedLifeTime = p.plantedArrowLifeTime || 60;
                p.dx = 0;
                p.dy = 0;
                // Impact
                p.game.particles.spawn(p.x, p.y, '#00BFFF', 5);
                p.isRainingArrow = false;
            }
        }
        // 2. Landed
        else {
            if (p.landedLifeTime > 0) {
                p.landedLifeTime -= 1 * timeScale;
                if (p.landedLifeTime <= 0) {
                    p.active = false;
                }
            } else {
                p.active = false;
            }
        }
    }
}

export class StaticLifetimeBehavior {
    constructor(duration) {
        this.lifeTime = duration;
    }

    update(p, timeScale) {
        p.dx = 0;
        p.dy = 0;
        p.lifeTime -= 1 * timeScale;
        if (p.lifeTime <= 0) {
            p.active = false;
        }
        p.ignoreBounds = true;
    }
}

export class DragBehavior {
    update(p, timeScale) {
        if (p.dragTarget && !p.dragTarget.isDead) {
            // Bolt follows and pushes the target
            p.x = p.dragTarget.x + Math.cos(p.angle) * 10;
            p.y = p.dragTarget.y + Math.sin(p.angle) * 10;

            p.dragDuration = (p.dragDuration || 0) - 1 * timeScale;

            if (p.dragDuration <= 0) {
                p.dragTarget = null;
                p.active = false;
            } else {
                p.ignoreBounds = true; // Don't die on wall while pinning
            }
        }
    }
}

export class MineBehavior {
    constructor(friction = 0.9) {
        this.friction = friction;
    }

    update(p, timeScale) {
        p.lifeTime = (p.lifeTime || 0) - 1 * timeScale;
        if (p.lifeTime <= 0) {
            p.active = false;
            return;
        }
        // Friction
        p.dx *= this.friction;
        p.dy *= this.friction;

        // Move
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;
    }
}

export class SniperTrailBehavior {
    update(p, timeScale) {
        // Frequent small sparks
        if (Math.random() < 0.4) {
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 15, // Trail behind
                y: p.y - Math.sin(p.angle) * 15,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 0.4, decay: 0.1,
                size: Math.random() < 0.5 ? 2 : 1, // Small crisp pixels
                color: '#00FF00', // Neon Green
                type: 'square'
            });
        }
    }
}

export class WorldSlashBehavior {
    update(p, timeScale) {
        // Visual particles
        if (Math.random() < 0.3) {
            p.game.particles.particles.push({
                x: p.x + (Math.random() - 0.5) * 40,
                y: p.y + (Math.random() - 0.5) * 40,
                vx: 0, vy: 0,
                life: 0.3, decay: 0.1,
                size: 3, color: '#DC143C', type: 'square'
            });
        }
        // Linear movement handled by separated component
    }
}

export class KunaiBehavior {
    update(p, timeScale) {
        if (p.isEmbedded) return; // Already stuck

        // Manually move if not using LinearMovement, OR just let LinearMovement handle it?
        // Issue: LinearMovement kills on wall. We want to STICK on wall.
        // Solution: Use LinearMovement logic but override the kill.
        // Or: Don't use LinearMovement for Kunai, use this.

        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;

        p.travelled = (p.travelled || 0) + Math.hypot(p.dx, p.dy) * timeScale;

        // Bounds Check -> Stick
        const bounds = p.game.arenaBounds;
        let hitWall = false;

        if (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height) {
            hitWall = true;
        }

        if (hitWall || (p.maxDist && p.travelled >= p.maxDist)) {
            // Stick!
            p.dx = 0;
            p.dy = 0;
            p.isEmbedded = true;

            // Clamp
            p.x = Math.max(bounds.x + 5, Math.min(bounds.x + bounds.width - 5, p.x));
            p.y = Math.max(bounds.y + 5, Math.min(bounds.y + bounds.height - 5, p.y));

            p.ignoreBounds = true; // Tell other systems not to kill it

            if (!p.hasPlayedStickSound) {
                p.game.audioEngine.playHit();
                p.hasPlayedStickSound = true;
            }
        }
    }
}
