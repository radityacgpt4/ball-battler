/**
 * Raycast Ability
 * Handles Thunder Mage's lightning attacks
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class RaycastAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.range = config.range;
        this.damage = config.damage;
        this.bounces = config.bounces;
    }

    /**
     * ROBUST RAYCAST SYSTEM
     * - Properly handles wall bounces, enemy hits, and shield deflections
     * - Shield deflection transfers ownership (deflected ray can hit original caster)
     * - Points array captures full path for visual
     */
    execute(fighter, context, angleOffset = 0, isUlt = false) {
        const { enemies, game } = context;
        const MAX_BOUNCES = this.bounces;

        let rayX = fighter.x;
        let rayY = fighter.y;
        let dirX = Math.cos(fighter.angle + angleOffset);
        let dirY = Math.sin(fighter.angle + angleOffset);

        // Normalize direction
        const dirLen = Math.hypot(dirX, dirY);
        dirX /= dirLen;
        dirY /= dirLen;

        let points = [{x: rayX, y: rayY}];
        let currentDamage = this.damage;
        let rayOwner = fighter;
        let hitEntities = new Set();

        if(!isUlt) audioEngine.playZap();

        for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
            // Find closest hit among walls, enemies, and shields
            let closest = { dist: Infinity, type: null, data: null, x: 0, y: 0 };

            // Check wall
            const bounds = game.arenaBounds;
            const wallHit = Physics.rayBoxIntersect(rayX, rayY, dirX, dirY, bounds.x, bounds.y, bounds.width, bounds.height);
            if (wallHit && wallHit.dist < closest.dist) {
                closest = { dist: wallHit.dist, type: 'wall', data: wallHit, x: wallHit.x, y: wallHit.y };
            }

            // Check each enemy
            for (let enemy of enemies) {
                if (enemy === rayOwner || enemy.isDead) continue;
                if (hitEntities.has(enemy)) continue;

                // Check shield first (shield is outside body)
                const shieldHit = enemy.getShieldHit(rayX, rayY, dirX, dirY);
                if (shieldHit && shieldHit.dist < closest.dist) {
                    closest = {
                        dist: shieldHit.dist,
                        type: 'shield',
                        data: { enemy, nx: shieldHit.nx, ny: shieldHit.ny },
                        x: shieldHit.x,
                        y: shieldHit.y
                    };
                }

                // Check body (only if shield didn't block from this direction)
                const bodyHit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, enemy.x, enemy.y, enemy.radius);
                if (bodyHit && bodyHit.dist < closest.dist) {
                    // Only count body hit if ray origin isn't blocked by shield
                    if (!enemy.isBlockedByShield(rayX, rayY)) {
                        closest = {
                            dist: bodyHit.dist,
                            type: 'enemy',
                            data: enemy,
                            x: bodyHit.x,
                            y: bodyHit.y
                        };
                    }
                }
            }

            // No hit found (shouldn't happen in bounded arena)
            if (closest.type === null) {
                points.push({ x: rayX + dirX * 1000, y: rayY + dirY * 1000 });
                break;
            }

            // Add hit point to path
            points.push({ x: closest.x, y: closest.y });

            // Process hit
            if (closest.type === 'enemy') {
                closest.data.takeDamage(currentDamage);
                game.particles.spawnExplosion(closest.x, closest.y);
                audioEngine.playHit();
                logger.log(`${rayOwner.name} Zap Hit ${closest.data.name} for ${currentDamage} dmg`, 'combat');
                hitEntities.add(closest.data);
                break; // Ray stops

            } else if (closest.type === 'wall') {
                // Wall bounce
                game.particles.spawn(closest.x, closest.y, '#00FFFF', 5);
                audioEngine.playBounce();
                const reflected = Physics.reflect(dirX, dirY, closest.data.nx, closest.data.ny);
                dirX = reflected.dx;
                dirY = reflected.dy;
                rayX = closest.x + closest.data.nx * 2;
                rayY = closest.y + closest.data.ny * 2;
                currentDamage *= 0.8;

            } else if (closest.type === 'shield') {
                // Shield deflection - transfers ownership!
                const enemy = closest.data.enemy;
                game.particles.spawnText(enemy.x, enemy.y, "DEFLECT!", "#8b5cf6");
                game.particles.spawn(closest.x, closest.y, '#ffffff', 15);
                audioEngine.playBlock();
                logger.log(`${enemy.name} DEFLECTED lightning from ${rayOwner.name}! Ownership transferred!`, 'warn');

                // Big spark effect
                for (let i = 0; i < 8; i++) {
                    const sparkAngle = Math.random() * Math.PI * 2;
                    game.particles.particles.push({
                        x: closest.x, y: closest.y,
                        vx: Math.cos(sparkAngle) * 8,
                        vy: Math.sin(sparkAngle) * 8,
                        life: 1.0, decay: 0.1,
                        size: 3, color: '#00ffff', type: 'dot'
                    });
                }

                const reflected = Physics.reflect(dirX, dirY, closest.data.nx, closest.data.ny);
                dirX = reflected.dx;
                dirY = reflected.dy;
                rayX = closest.x + closest.data.nx * 5;
                rayY = closest.y + closest.data.ny * 5;

                // IMPORTANT: Transfer ownership so ray can hit original caster
                rayOwner = enemy;
                hitEntities.add(enemy);
                currentDamage *= 0.9;
            }
        }

        // Draw the complete bolt path
        game.particles.spawnBolt(points, '#00FFFF');

        // Only reset cooldown if this is a normal attack, not an Ult proc
        if (!isUlt) {
            fighter.cooldowns.atk = this.cooldown;
        }
    }

    update(fighter, context) {
        if (this.canUse(fighter, context)) {
            this.execute(fighter, context, 0, false);
        }
    }
}

export class DoubleZapAbility extends Ability {
    constructor(config, slot, raycastConfig) {
        super(config, slot);
        this.raycastConfig = raycastConfig;
    }

    execute(fighter, context) {
        const { game } = context;

        // Create temporary raycast ability for the double zap
        const raycast = new RaycastAbility(this.raycastConfig, 'atk');

        // Fire two rays at angles
        raycast.execute(fighter, context, -0.15, true);
        raycast.execute(fighter, context, 0.15, true);

        audioEngine.playThunder();
        fighter.cooldowns.ult = this.cooldown;
        game.particles.spawnText(fighter.x, fighter.y, "ULTIMATE!", "#ffaa00");
        logger.log(`${fighter.name} cast DOUBLE ZAP!`, 'combat');
    }
}

export class LaserAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration || 60; // 1 second firing
        this.damage = config.damage || 1;
        this.range = config.range || 800;
        this.active = false;
        this.timer = 0;
        this.originalRotation = 0;
        this.hitBuffer = new Set(); // Stores unique enemies hit between damage ticks
    }

    execute(fighter, context) {
        this.active = true;
        this.timer = this.duration;
        fighter.cooldowns.atk = this.cooldown;
        this.hitBuffer.clear();
        
        // Boost rotation speed
        this.originalRotation = fighter.rotationSpeed;
        fighter.rotationSpeed *= 1.5;
        
        audioEngine.playZap();
    }

    update(fighter, context) {
        if (this.active) {
            this.timer--;
            
            // Scan every frame and buffer hits
            this.scanBeam(fighter, context);

            // Apply damage every 3 frames (0.05s) to anything in the buffer
            if (this.timer % 3 === 0) {
                this.applyBufferedDamage(fighter, context);
            }

            if (this.timer <= 0) {
                this.active = false;
                fighter.rotationSpeed = this.originalRotation; // Revert
                this.hitBuffer.clear();
            }
        } else if (this.canUse(fighter, context)) {
            // Auto-fire
            this.execute(fighter, context);
        }
    }

    scanBeam(fighter, context) {
        const { enemies, game } = context;
        let rayX = fighter.x;
        let rayY = fighter.y;
        let dirX = Math.cos(fighter.angle);
        let dirY = Math.sin(fighter.angle);

        let closest = { dist: this.range, type: null, data: null };

        // Check Wall
        const bounds = game.arenaBounds;
        const wallHit = Physics.rayBoxIntersect(rayX, rayY, dirX, dirY, bounds.x, bounds.y, bounds.width, bounds.height);
        if (wallHit && wallHit.dist < closest.dist) {
            closest = { dist: wallHit.dist, type: 'wall', data: wallHit };
        }

        // Check Enemies
        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            // Shield check
            const shieldHit = enemy.getShieldHit(rayX, rayY, dirX, dirY);
            if (shieldHit && shieldHit.dist < closest.dist) {
                closest = { dist: shieldHit.dist, type: 'shield', data: { enemy, ...shieldHit } };
            }

            // Body check
            const bodyHit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, enemy.x, enemy.y, enemy.radius);
            if (bodyHit && bodyHit.dist < closest.dist) {
                 if (!enemy.isBlockedByShield(rayX, rayY)) {
                    closest = { dist: bodyHit.dist, type: 'enemy', data: enemy };
                 }
            }
        }

        const hitX = rayX + dirX * closest.dist;
        const hitY = rayY + dirY * closest.dist;

        // Draw Beam
        game.particles.spawnBeam(fighter.x, fighter.y, hitX, hitY, '#ffdd00');

        // Buffer the hit
        if (closest.type === 'enemy') {
            closest.data.applyStatus('SLOW'); // Apply Slow effect instantly
            this.hitBuffer.add(closest.data);
            this.lastHitPos = {x: hitX, y: hitY}; // Store for particle
        } else if (closest.type === 'shield') {
            this.hitBuffer.add({ type: 'shield', data: closest.data });
            this.lastHitPos = {x: hitX, y: hitY};
        } else if (closest.type === 'wall') {
            if (this.timer % 3 === 0) game.particles.spawn(hitX, hitY, '#ffff00', 2);
        }
    }

    applyBufferedDamage(fighter, context) {
        if (this.hitBuffer.size === 0) return;

        this.hitBuffer.forEach(target => {
            if (target.type === 'shield') {
                const enemy = target.data.enemy;
                context.game.particles.spawnText(enemy.x, enemy.y, "BLOCK", "#ffffff");
                if (this.lastHitPos) context.game.particles.spawn(this.lastHitPos.x, this.lastHitPos.y, '#ffffff', 3);
                audioEngine.playBlock();
                // To avoid spamming logs every frame, only log periodically or on first hit
                if (Math.random() < 0.1) logger.log(`${enemy.name} is blocking Laser`, 'info');
            } else {
                // Enemy
                target.takeDamage(this.damage);
                if (this.lastHitPos) context.game.particles.spawn(this.lastHitPos.x, this.lastHitPos.y, '#ff4400', 3);
            }
        });

        this.hitBuffer.clear();
    }
}
