/**
 * Raycast Ability
 *
 * ATK: Lightning Bolt - Chain lightning with bounces
 * ULT: Double Zap - Fire two lightning bolts
 * Laser: Continuous beam attack
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class RaycastAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.range = config.range || 800;
        this.damage = config.damage || 15;
        this.bounces = config.bounces || 3;
        this.damageDecayWall = config.damageDecayWall || 0.8;
        this.damageDecayShield = config.damageDecayShield || 0.9;
    }

    execute(fighter, context, angleOffset = 0, isUlt = false) {
        const { enemies, game } = context;
        const MAX_BOUNCES = this.bounces;

        let rayX = fighter.x;
        let rayY = fighter.y;
        let dirX = Math.cos(fighter.angle + angleOffset);
        let dirY = Math.sin(fighter.angle + angleOffset);

        const dirLen = Math.hypot(dirX, dirY);
        dirX /= dirLen;
        dirY /= dirLen;

        let points = [{ x: rayX, y: rayY }];
        let currentDamage = this.damage;
        let rayOwner = fighter;
        let hitEntities = new Set();

        if (!isUlt) audioEngine.playZap();

        for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
            let closest = { dist: Infinity, type: null, data: null, x: 0, y: 0 };

            // Check wall
            const bounds = game.arenaBounds;
            const wallHit = Physics.rayBoxIntersect(rayX, rayY, dirX, dirY, bounds.x, bounds.y, bounds.width, bounds.height);
            if (wallHit && wallHit.dist < closest.dist) {
                closest = { dist: wallHit.dist, type: 'wall', data: wallHit, x: wallHit.x, y: wallHit.y };
            }

            // Check enemies
            for (let enemy of enemies) {
                if (enemy === rayOwner || enemy.isDead) continue;
                if (hitEntities.has(enemy)) continue;

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

                const bodyHit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, enemy.x, enemy.y, enemy.radius);
                if (bodyHit && bodyHit.dist < closest.dist) {
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

            if (closest.type === null) {
                points.push({ x: rayX + dirX * 1000, y: rayY + dirY * 1000 });
                break;
            }

            points.push({ x: closest.x, y: closest.y });

            if (closest.type === 'enemy') {
                closest.data.takeDamage(currentDamage, false, false, fighter);
                game.particles.spawnExplosion(closest.x, closest.y);
                audioEngine.playHit();
                logger.log(`${rayOwner.name} Zap Hit ${closest.data.name} for ${currentDamage} dmg`, 'combat');
                hitEntities.add(closest.data);
                break;

            } else if (closest.type === 'wall') {
                game.particles.spawn(closest.x, closest.y, '#00FFFF', 5);
                audioEngine.playBounce();
                const reflected = Physics.reflect(dirX, dirY, closest.data.nx, closest.data.ny);
                dirX = reflected.dx;
                dirY = reflected.dy;
                rayX = closest.x + closest.data.nx * 2;
                rayY = closest.y + closest.data.ny * 2;
                currentDamage *= this.damageDecayWall;

            } else if (closest.type === 'shield') {
                const enemy = closest.data.enemy;
                game.particles.spawn(closest.x, closest.y, '#8b5cf6', 15);
                audioEngine.playBlock();
                logger.log(`${enemy.name} DEFLECTED lightning from ${rayOwner.name}! Ownership transferred!`, 'warn');

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

                rayOwner = enemy;
                hitEntities.add(enemy);
                currentDamage *= this.damageDecayShield;
            }
        }

        game.particles.spawnBolt(points, '#00FFFF');

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
        this.angleSpread = config.angleSpread || 0.15;
    }

    execute(fighter, context) {
        const { game } = context;

        const raycast = new RaycastAbility(this.raycastConfig, 'atk');

        raycast.execute(fighter, context, -this.angleSpread, true);
        raycast.execute(fighter, context, this.angleSpread, true);

        audioEngine.playThunder();
        fighter.cooldowns.ult = this.cooldown;
        game.particles.spawn(fighter.x, fighter.y, '#00FFFF', 15);
        logger.log(`${fighter.name} cast DOUBLE ZAP!`, 'combat');
    }
}

export class LaserAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.duration = config.duration || 180;
        this.chargeTime = config.chargeTime || 150;
        this.damage = config.damage || 1;
        this.range = config.range || 2000;
        this.rotationSlow = config.rotationSlow || 0.1;
        this.speedSlow = config.speedSlow || 0.25;
        this.beamWidth = config.beamWidth || 20;
        this.coreWidth = config.coreWidth || 8;
        this.tickRate = config.tickRate || 3;
        this.slowDuration = config.slowDuration || 45;

        this.state = 'IDLE';
        this.timer = 0;
        this.originalRotation = 0;
        this.hitBuffer = new Set();
    }

    execute(fighter, context) {
        this.state = 'CHARGING';
        this.timer = this.chargeTime;

        fighter.cooldowns.atk = 0;

        this.originalRotation = fighter.rotationSpeed;

        audioEngine.playPowerUp();
    }

    update(fighter, context) {
        // Interrupt on stun
        if ((this.state === 'CHARGING' || this.state === 'FIRING') && fighter.status.stun > 0) {
            this.state = 'IDLE';
            fighter.rotationSpeed = this.originalRotation;
            fighter.laserSpeedMult = 1.0;
            this.hitBuffer.clear();
            fighter.cooldowns.atk = 1;
            return;
        }

        if (this.state === 'CHARGING') {
            this.timer--;

            const chargeRatio = 1 - (this.timer / this.chargeTime);
            fighter.laserState = 'CHARGING';
            fighter.laserChargeRatio = chargeRatio;

            const { game } = context;
            if (this.timer % 10 === 0) {
                game.particles.particles.push({
                    x: fighter.x + (Math.random() - 0.5) * 40,
                    y: fighter.y + (Math.random() - 0.5) * 40,
                    vx: (fighter.x - (fighter.x + (Math.random() - 0.5) * 40)) * 0.05,
                    vy: (fighter.y - (fighter.y + (Math.random() - 0.5) * 40)) * 0.05,
                    life: 0.5, decay: 0.05,
                    size: 2, color: '#ffaa00', type: 'dot'
                });
            }

            if (this.timer <= 0) {
                this.state = 'FIRING';
                fighter.laserState = 'FIRING';
                this.timer = this.duration;

                fighter.rotationSpeed = this.originalRotation * this.rotationSlow;
                fighter.laserSpeedMult = this.speedSlow;

                if (typeof audioEngine.playLaser === 'function') {
                    audioEngine.playLaser(this.duration / 60);
                } else {
                    audioEngine.playZap();
                }
                this.hitBuffer.clear();
            }

        } else if (this.state === 'FIRING') {
            fighter.laserState = 'FIRING';
            this.timer--;

            this.scanBeam(fighter, context);

            if (this.timer % this.tickRate === 0) {
                this.applyBufferedDamage(fighter, context);
            }



            if (this.timer <= 0) {
                this.state = 'IDLE';
                fighter.rotationSpeed = this.originalRotation;
                fighter.laserSpeedMult = 1.0;
                this.hitBuffer.clear();
                fighter.cooldowns.atk = 1;
            }
        } else if (this.canUse(fighter, context)) {
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

        const bounds = game.arenaBounds;
        const wallHit = Physics.rayBoxIntersect(rayX, rayY, dirX, dirY, bounds.x, bounds.y, bounds.width, bounds.height);
        if (wallHit && wallHit.dist < closest.dist) {
            closest = { dist: wallHit.dist, type: 'wall', data: wallHit };
        }

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const shieldHit = enemy.getShieldHit(rayX, rayY, dirX, dirY);
            if (shieldHit && shieldHit.dist < closest.dist) {
                closest = { dist: shieldHit.dist, type: 'shield', data: { enemy, ...shieldHit } };
            }

            const bodyHit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, enemy.x, enemy.y, enemy.radius);
            if (bodyHit && bodyHit.dist < closest.dist) {
                if (!enemy.isBlockedByShield(rayX, rayY)) {
                    closest = { dist: bodyHit.dist, type: 'enemy', data: enemy };
                }
            }
        }

        const hitX = rayX + dirX * closest.dist;
        const hitY = rayY + dirY * closest.dist;

        // 1. Wide heat halo (Faint outer glow)
        game.particles.spawnBeam(fighter.x, fighter.y, hitX, hitY, '#ff2200', this.beamWidth * 1.5, 0.2);

        // 2. Main energy beam
        game.particles.spawnBeam(fighter.x, fighter.y, hitX, hitY, '#ff4400', this.beamWidth);

        // 3. Flickering hot core
        const flicker = Math.sin(Date.now() * 0.05) * 2;
        game.particles.spawnBeam(fighter.x, fighter.y, hitX, hitY, '#ffff00', this.coreWidth + flicker);

        // 4. White-hot center (Lethal visual)
        game.particles.spawnBeam(fighter.x, fighter.y, hitX, hitY, '#ffffff', this.coreWidth * 0.4);

        // 5. Impact flare
        if (this.timer % 2 === 0) {
            game.particles.particles.push({
                x: hitX, y: hitY,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 0.4, decay: 0.1,
                size: 3 + Math.random() * 4,
                color: Math.random() > 0.5 ? '#ffff00' : '#ff4400',
                type: 'dot'
            });
        }

        // Spiral Effect
        const beamDist = closest.dist;
        const step = 25;
        const time = Date.now() * 0.012;

        for (let d = 0; d < beamDist; d += step) {
            const offset1 = Math.sin(time + d * 0.05) * 12;
            const offset2 = Math.sin(time + d * 0.05 + Math.PI) * 12;

            const perpX = -dirY;
            const perpY = dirX;

            const spawnSpiral = (off) => {
                game.particles.particles.push({
                    x: fighter.x + dirX * d + perpX * off,
                    y: fighter.y + dirY * d + perpY * off,
                    vx: 0, vy: 0,
                    life: 0.6, decay: 0.06,
                    size: 2 + Math.random() * 2,
                    color: '#ffcc00', type: 'dot'
                });
            };

            if (this.timer % 2 === 0) {
                spawnSpiral(offset1);
                spawnSpiral(offset2);
            }
        }

        if (closest.type === 'enemy') {
            closest.data.applyStatus('SLOW', this.slowDuration);
            this.hitBuffer.add(closest.data);
            this.lastHitPos = { x: hitX, y: hitY };
        } else if (closest.type === 'shield') {
            this.hitBuffer.add({ type: 'shield', data: closest.data });
            this.lastHitPos = { x: hitX, y: hitY };
        } else if (closest.type === 'wall') {
            if (this.timer % 3 === 0) game.particles.spawn(hitX, hitY, '#ffff00', 5);
        }
    }

    applyBufferedDamage(fighter, context) {
        if (this.hitBuffer.size === 0) return;

        this.hitBuffer.forEach(target => {
            if (target.type === 'shield') {
                const enemy = target.data.enemy;
                if (this.lastHitPos) context.game.particles.spawn(this.lastHitPos.x, this.lastHitPos.y, '#ffffff', 5);
                audioEngine.playBlock();
                if (Math.random() < 0.1) logger.log(`${enemy.name} is blocking Laser`, 'info');
            } else {
                target.takeDamage(this.damage, false, false, fighter);
                if (this.lastHitPos) context.game.particles.spawn(this.lastHitPos.x, this.lastHitPos.y, '#ff4400', 3);
            }
        });

        this.hitBuffer.clear();
    }
}
