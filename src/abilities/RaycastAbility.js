/**
 * Raycast Ability
 * Handles Thunder Mage's lightning attacks
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

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
            const wallHit = Physics.rayBoxIntersect(rayX, rayY, dirX, dirY, game.width, game.height);
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
    }
}
