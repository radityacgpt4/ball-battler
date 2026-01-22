/**
 * Projectile Behaviors (Component System)
 * Defines isolated, reusable behaviors for projectiles.
 */
import { audioEngine } from '../systems/Audio.js';

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
        // Horizontal movement (x/y)
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;

        // Z-axis physics (vertical arc)
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

            // Trigger impact logic (e.g. Grenade explosion)
            p.triggerImpact(null);

            // Trigger impact immediately if defined
            if (p.impactParticle) {
                p.game.particles.spawnEffect(p.impactParticle, p.x, p.y);
            }
            if (p.impactSound) {
                audioEngine.play(p.impactSound);
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
        if (p.startX !== undefined && p.maxDist > 0) {
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

        // Bounds check - deactivate if outside arena
        const bounds = p.game.arenaBounds;
        if (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height) {
            p.active = false;
        }
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
        const isUlt = p.isSniperUltShot || p.isUnblockable;
        const trailColor = isUlt ? '#00FF88' : '#FF4444';
        const glowColor = isUlt ? '#00FFAA' : '#FF6666';

        // Main trail spark (40% chance per frame - lightweight)
        if (Math.random() < 0.4) {
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 12,
                y: p.y - Math.sin(p.angle) * 12,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                life: 0.35, decay: 0.12,
                size: isUlt ? 3 : 2,
                color: trailColor,
                type: 'square'
            });
        }

        // Secondary glow trail (20% chance - adds depth without heavy load)
        if (Math.random() < 0.2) {
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 8,
                y: p.y - Math.sin(p.angle) * 8,
                vx: 0, vy: 0,
                life: 0.2, decay: 0.15,
                size: isUlt ? 4 : 2,
                color: glowColor,
                type: 'dot'
            });
        }
    }
}





export class GrenadeBehavior {
    update(p) {
        p.handlesOwnCollision = true;
    }

    onImpact(p, target) {
        // Grenades explode on impact (ground or wall/target)
        p.game.particles.spawnExplosion(p.x, p.y);
        audioEngine.playExplosion();
        // logger.log(`${p.owner.name}'s Grenade EXPLODED!`, 'combat'); // Optional log

        const blastRadius = 60;
        const enemies = p.game.entities.filter(ent => !ent.isDead && ent !== p.owner);

        enemies.forEach(ent => {
            const d = Math.hypot(p.x - ent.x, p.y - ent.y);
            if (d < blastRadius + ent.radius) {
                ent.takeDamage(p.damage, false, false, p.owner);
                const angle = Math.atan2(ent.y - p.y, ent.x - p.x);
                const force = 12;
                ent.dx += Math.cos(angle) * force;
                ent.dy += Math.sin(angle) * force;
                ent.applyStatus('STUN');
            }
        });
    }
}

export class ClaymoreBehavior {
    update(p, timeScale) {
        p.handlesOwnCollision = true;

        // Proximity Check
        const enemies = p.game.entities.filter(ent => ent !== p.owner && !ent.isDead);
        for (let ent of enemies) {
            if (Math.hypot(p.x - ent.x, p.y - ent.y) < ent.radius + p.radius + 5) {
                // Trigger
                ent.takeDamage(p.damage, false, false, p.owner);
                if (p.slowDuration > 0) ent.applyStatus('SLOW', p.slowDuration);

                p.game.particles.spawnExplosion(p.x, p.y);
                audioEngine.playExplosion();
                // logger.log(`${ent.name} triggered ${p.owner.name}'s CLAYMORE!`, 'combat');

                p.active = false;
                break;
            }
        }
    }
}

export class GintoTrapBehavior {
    update(p, timeScale) {
        p.handlesOwnCollision = true;

        const enemies = p.game.entities.filter(ent => ent !== p.owner && !ent.isDead);
        for (let ent of enemies) {
            if (Math.hypot(p.x - ent.x, p.y - ent.y) < ent.radius + p.radius) {
                // Trigger
                if (p.stunDuration > 0) ent.applyStatus('STUN', p.stunDuration);

                p.game.particles.spawnHirenkyaku(p.x, p.y);
                audioEngine.playZap();
                // logger.log(`${ent.name} stepped on ${p.owner.name}'s GINTO TRAP!`, 'combat');

                p.active = false;
                break;
            }
        }
    }
}

export class BallistaBehavior {
    onImpact(p, target) {
        if (!target) return; // Ignore walls
        p.hasHandledImpact = true;

        target.takeDamage(p.damage, false, false, p.owner);
        p.game.particles.spawn(target.x, target.y, '#8B4513', 5);
        audioEngine.playHit();

        // Pin Logic
        if (!target.pendingBallistaPinned && !p.dragTarget) {
            const knockbackForce = 12;
            const speed = knockbackForce / target.mass;
            target.dx = Math.cos(p.angle) * speed;
            target.dy = Math.sin(p.angle) * speed;

            target.pendingBallistaPinned = { owner: p.owner };
            p.dragTarget = target;

            // Trails
            for (let i = 0; i < 8; i++) {
                p.game.particles.particles.push({
                    x: target.x, y: target.y,
                    vx: -Math.cos(p.angle) * (2 + Math.random() * 2),
                    vy: -Math.sin(p.angle) * (2 + Math.random() * 2),
                    life: 0.6, decay: 0.05, size: 4, color: '#8B4513', type: 'dot'
                });
            }
        } else {
            p.active = false;
        }
    }
}

export class KunaiBehavior {
    update(p, timeScale) {
        if (p.isEmbedded) return;

        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;
        p.travelled = (p.travelled || 0) + Math.hypot(p.dx, p.dy) * timeScale;

        // Wall Logic
        const bounds = p.game.arenaBounds;
        let hitWall = false;
        if (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height) {
            hitWall = true;
        }

        if (hitWall || (p.maxDist && p.travelled >= p.maxDist)) {
            p.dx = 0; p.dy = 0;
            p.isEmbedded = true;
            p.x = Math.max(bounds.x + 5, Math.min(bounds.x + bounds.width - 5, p.x));
            p.y = Math.max(bounds.y + 5, Math.min(bounds.y + bounds.height - 5, p.y));
            p.ignoreBounds = true;

            if (!p.hasPlayedStickSound) {
                audioEngine.playHit();
                p.hasPlayedStickSound = true;
            }
        }
    }

    onImpact(p, target) {
        if (!target) return;
        p.hasHandledImpact = true;

        if (!p.hitList.includes(target.id)) {
            target.takeDamage(p.damage, false, false, p.owner);
            p.hitList.push(target.id);
            p.game.particles.spawn(target.x, target.y, '#ffd700', 3);
            audioEngine.playHit();
        }
    }
}

export class WorldSlashBehavior {
    update(p, timeScale) {
        p.handlesOwnCollision = true;

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

        // Deflect enemy projectiles
        for (let j = p.game.projectiles.length - 1; j >= 0; j--) {
            const other = p.game.projectiles[j];
            if (other === p || !other.active) continue;
            if (other.owner === p.owner) continue; // Don't deflect own
            if (other.isGroundBurn) continue; // Don't deflect ground burns

            if (Physics.dist(p.x, p.y, other.x, other.y) < (p.radius || 40) + (other.radius || 4)) {
                // Deflect
                other.owner = p.owner;
                other.hitList = [];

                const speed = Math.hypot(other.dx, other.dy);
                other.dx = Math.cos(p.angle) * speed * 1.2;
                other.dy = Math.sin(p.angle) * speed * 1.2;
                other.angle = p.angle;

                other.isDeflected = true;
                other.deflectLifetime = 180;

                p.game.particles.spawn(other.x, other.y, '#DC143C', 6);
                audioEngine.playBlock();
                // logger.log(`World Cutting Slash DEFLECTED projectile!`, 'combat');
            }
        }

        // Hit entities
        const enemies = p.game.entities.filter(ent => ent !== p.owner && !ent.isDead);
        for (let ent of enemies) {
            if (Physics.dist(p.x, p.y, ent.x, ent.y) < (p.radius || 40) + ent.radius) {
                // Drag Logic
                if (p.dragTarget) { // Wait, dragTarget logic? WorldSlash usually pulls.
                    // The old code had: if (p.dragTarget). But WorldSlash usually just applies drag.
                    // Actually, let's just apply drag to everyone hit.
                    ent.dx = p.dx * (p.dragStrength || 0.3) + (p.x - ent.x) * 0.1;
                    ent.dy = p.dy * (p.dragStrength || 0.3) + (p.y - ent.y) * 0.1;
                }

                // Damage
                if (!p.hitList) p.hitList = [];
                if (!p.hitList.includes(ent.id)) {
                    ent.takeDamage(p.damage, true, false, p.owner); // Unblockable
                    p.hitList.push(ent.id);
                    p.game.particles.spawnSlash(ent.x, ent.y, ent.x + (Math.random() - 0.5) * 20, ent.y + (Math.random() - 0.5) * 20, '#DC143C', 30);
                    audioEngine.playSlash();
                }
            }
        }
    }
}

export class MechaBeamBehavior {
    update(p, timeScale) {
        // Move projectile
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;

        // Energy trail effect (Yellow Flash style but tangible)
        if (p.lastTrailX !== undefined) {
            const distSq = (p.x - p.lastTrailX) ** 2 + (p.y - p.lastTrailY) ** 2;
            if (distSq > 64) { // Every 8px
                p.game.particles.spawnBeam(
                    p.lastTrailX, p.lastTrailY,
                    p.x, p.y,
                    '#FFD700', 5, 0.08
                );
                p.lastTrailX = p.x;
                p.lastTrailY = p.y;
            }
        } else {
            p.lastTrailX = p.x;
            p.lastTrailY = p.y;
        }

        // Sparkle trail
        if (Math.random() < 0.4) {
            p.game.particles.particles.push({
                x: p.x - Math.cos(p.angle) * 10,
                y: p.y - Math.sin(p.angle) * 10,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 0.35, decay: 0.1,
                size: 3 + Math.random() * 2,
                color: Math.random() > 0.5 ? '#FFD700' : '#FFFFFF',
                type: 'dot'
            });
        }

        // Energy crackle particles
        if (Math.random() < 0.15) {
            const perpAngle = p.angle + Math.PI / 2;
            const offset = (Math.random() > 0.5 ? 1 : -1) * 6;
            p.game.particles.particles.push({
                x: p.x + Math.cos(perpAngle) * offset,
                y: p.y + Math.sin(perpAngle) * offset,
                vx: Math.cos(perpAngle) * offset * 0.3,
                vy: Math.sin(perpAngle) * offset * 0.3,
                life: 0.25, decay: 0.1,
                size: 2,
                color: '#FFFF00',
                type: 'square'
            });
        }

        // Wall collision - explode on wall
        const bounds = p.game.arenaBounds;
        if (p.x < bounds.x || p.x > bounds.x + bounds.width ||
            p.y < bounds.y || p.y > bounds.y + bounds.height) {

            if (p.explodeOnWall && !p.hasExploded) {
                // Clamp position to wall
                p.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width, p.x));
                p.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height, p.y));

                // Trigger impact (generic)
                p.triggerImpact(null);
            } else {
                p.active = false;
            }
        }
    }

    onImpact(p, target) {
        if (p.hasExploded) return;
        p.hasHandledImpact = true;
        p.hasExploded = true;
        p.active = false;

        // If hitting a target, apply direct damage + stun first
        if (target) {
            target.takeDamage(p.damage, false, false, p.owner);
            target.applyStatus('STUN', p.stunDuration);
        }

        this.triggerExplosion(p, target);
    }

    triggerExplosion(p, directTarget = null) {
        const game = p.game;

        // Spawn explosion effect
        game.particles.spawnEffect('mechaExplosion', p.x, p.y);

        // AOE damage
        const enemies = game.entities.filter(e => e !== p.owner && !e.isDead);
        for (const enemy of enemies) {
            // Avoid double-hitting the direct target if it exists
            if (directTarget && enemy === directTarget) continue;

            const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (dist < p.explosionRadius + enemy.radius) {
                enemy.takeDamage(p.explosionDamage, false, false, p.owner);
                enemy.applyStatus('STUN', p.stunDuration);

                // Knockback
                const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
                enemy.dx += Math.cos(angle) * 6;
                enemy.dy += Math.sin(angle) * 6;
            }
        }

        audioEngine.playExplosion();

        // Trigger melee follow-up on owner
        if (p.owner && p.owner.abilities && p.owner.abilities.atk && typeof p.owner.abilities.atk.triggerMeleeDash === 'function') {
            p.owner.abilities.atk.triggerMeleeDash(p.owner, { game });
        }
    }
}
