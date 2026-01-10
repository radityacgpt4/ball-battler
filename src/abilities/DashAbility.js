/**
 * Dash Abilities
 *
 * Dash Assault, Retreat, Flash Barrage
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class DashAssaultAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.damage = config.damage || 7;
        this.dashDistance = config.dashDistance || 400;
        this.dashTimer = config.dashTimer || 15;
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        // 1. Calculate trajectory
        const target = enemies.find(e => e !== fighter && !e.isDead);
        let aimAngle = fighter.angle;
        if (target) aimAngle = Math.atan2(target.y - fighter.y, target.x - fighter.x);

        fighter.angle = aimAngle; // Face target
        const startX = fighter.x;
        const startY = fighter.y;

        // Calculate max dash distance clamped to walls
        let moveDist = this.dashDistance;
        const destXRaw = startX + Math.cos(aimAngle) * moveDist;
        const destYRaw = startY + Math.sin(aimAngle) * moveDist;

        // Clamp destination to arena
        const finalX = Math.max(fighter.radius, Math.min(game.width - fighter.radius, destXRaw));
        const finalY = Math.max(fighter.radius, Math.min(game.height - fighter.radius, destYRaw));

        // 2. VISUALS: Thunderclap Flash (Instant)
        game.particles.spawnThunderclap(startX, startY, finalX, finalY, '#ff4444', 6);
        game.particles.spawnShockwave(startX, startY, '#ff4444');
        game.particles.spawnShockwave(finalX, finalY, '#ffffff');

        // Audio
        audioEngine.playTeleport(); // "Zip" sound
        audioEngine.playHeavyImpact(); // "Boom" sound

        // 3. COLLISION LOGIC (Instant Line Check)
        const hitWidth = fighter.radius + 20; // Generous hitbox

        enemies.forEach(e => {
            if (e !== fighter && !e.isDead) {
                if (Physics.lineCircleIntersect(startX, startY, finalX, finalY, e.x, e.y, hitWidth)) {
                    // HIT!
                    e.takeDamage(this.damage, false, false, fighter);
                    e.applyStatus('BLEED', 180);
                    e.applyStatus('STUN', 30); // Slight stun from impact

                    // Hit Visuals
                    game.particles.spawnSlash(e.x - 20, e.y - 20, e.x + 20, e.y + 20, '#ffffff', 5);
                    game.particles.spawnExplosion(e.x, e.y);

                    audioEngine.playHit();
                    logger.log(`${fighter.name} THUNDERCLAP HIT ${e.name}!`, 'combat');
                }
            }
        });

        // 4. TELEPORT
        // 4. TELEPORT
        // Robust Safe Position Solver
        // Goal: Find a spot touching the target but NOT overlapping any entity or wall

        let destX = finalX;
        let destY = finalY;
        const spacing = fighter.radius + 2; // Buffer

        // Helper to check if a position is valid (no overlaps, inside bounds)
        const isValidPos = (tx, ty, ignoreList = []) => {
            // 1. Check Bounds (Strict)
            if (tx < fighter.radius || tx > game.width - fighter.radius ||
                ty < fighter.radius || ty > game.height - fighter.radius) {
                return false;
            }

            // 2. Check Entity Overlaps
            for (const e of enemies) {
                if (e !== fighter && !e.isDead && !ignoreList.includes(e)) {
                    // Check strict overlap
                    if (Physics.dist(tx, ty, e.x, e.y) < fighter.radius + e.radius - 2) {
                        return false;
                    }
                }
            }
            return true;
        };

        // Find primary target (the one we aimed at or hit)
        // We used 'lineCircleIntersect' earlier, let's find the closest enemy to the ideal destination
        let closestTarget = null;
        let minDist = Infinity;
        for (const e of enemies) {
            if (e !== fighter && !e.isDead) {
                const d = Physics.dist(destX, destY, e.x, e.y);
                if (d < minDist) {
                    minDist = d;
                    closestTarget = e;
                }
            }
        }

        // Logic A: If we are landing ON someone, try to back off along approach vector
        if (closestTarget && minDist < fighter.radius + closestTarget.radius) {
            const angle = Math.atan2(closestTarget.y - startY, closestTarget.x - startX);
            // Proposed spot: Backed off from center
            const backOffDist = fighter.radius + closestTarget.radius + 2;

            let attemptX = closestTarget.x - Math.cos(angle) * backOffDist;
            let attemptY = closestTarget.y - Math.sin(angle) * backOffDist;

            if (isValidPos(attemptX, attemptY)) {
                destX = attemptX;
                destY = attemptY;
            } else {
                // Logic B: "Sandwich" detected (Wall or another enemy blocking back-off).
                // Spiral check around the target to find an open spot
                let foundSpot = false;
                // Check 8 directions around the target
                for (let i = 1; i < 8; i++) {
                    // Alternate sides: +45, -45, +90, -90...
                    const sign = i % 2 === 0 ? 1 : -1;
                    const step = Math.ceil(i / 2);
                    const offset = angle + (sign * step * (Math.PI / 4));

                    attemptX = closestTarget.x - Math.cos(offset) * backOffDist;
                    attemptY = closestTarget.y - Math.sin(offset) * backOffDist;

                    if (isValidPos(attemptX, attemptY)) {
                        destX = attemptX;
                        destY = attemptY;
                        foundSpot = true;
                        break;
                    }
                }

                // If totally trapped, default to the original back-off and let Velocity Clamp handle the squeeze
                if (!foundSpot) {
                    destX = closestTarget.x - Math.cos(angle) * backOffDist;
                    destY = closestTarget.y - Math.sin(angle) * backOffDist;
                    // Clamp to bounds at least
                    destX = Math.max(fighter.radius, Math.min(game.width - fighter.radius, destX));
                    destY = Math.max(fighter.radius, Math.min(game.height - fighter.radius, destY));
                }
            }
        }

        fighter.x = destX;
        fighter.y = destY;

        // Reset velocity to baseSpeed in the direction of the dash
        fighter.dx = Math.cos(aimAngle) * fighter.baseSpeed;
        fighter.dy = Math.sin(aimAngle) * fighter.baseSpeed;

        fighter.isDashing = false;
        fighter.cooldowns.ult = this.cooldown;
    }
}

export class RetreatAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.range = config.range || 150;
        this.dashSpeed = config.dashSpeed || 8;
        this.dashTimer = config.dashTimer || 20;
    }

    canUse(fighter, context) {
        if (!super.canUse(fighter, context)) return false;

        const { enemies } = context;
        const enemy = enemies.find(e => e !== fighter && !e.isDead);
        if (!enemy) return false;

        return Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y) < this.range;
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        const enemy = enemies.find(e => e !== fighter && !e.isDead);
        if (!enemy) return;

        fighter.isDashing = true;
        fighter.dashTimer = this.dashTimer;

        const angle = Math.atan2(fighter.y - enemy.y, fighter.x - enemy.x);
        fighter.dx = Math.cos(angle) * this.dashSpeed;
        fighter.dy = Math.sin(angle) * this.dashSpeed;

        // Force aim to enemy
        fighter.angle = Math.atan2(enemy.y - fighter.y, enemy.x - fighter.x);

        game.particles.spawn(fighter.x, fighter.y, '#54a0ff', 5);
        logger.log(`${fighter.name} used Retreat!`, 'info');
        fighter.cooldowns.def = this.cooldown;
        audioEngine.playSwordSwing();
    }

    update(fighter, context) {
        if (this.canUse(fighter, context)) {
            this.execute(fighter, context);
        }
    }
}

export class FlashBarrageAbility extends Ability {
    constructor(config, slot, kunaiConfig, ProjectileClass) {
        super(config, slot);
        this.kunaiConfig = kunaiConfig;
        this.ProjectileClass = ProjectileClass;
        // All values from config (fighters.js)
        this.rasenganDamage = config.rasenganDamage || 12;
        this.kunaiCount = config.kunaiCount || 2;
        this.kunaiSpeed = config.kunaiSpeed || 9;
        this.maxDistBase = config.maxDistBase || 350;
        this.maxDistRatio = config.maxDistRatio || 0.4;
    }

    execute(fighter, context) {
        const { game } = context;
        const Projectile = this.ProjectileClass;
        const count = this.kunaiCount;

        fighter.cooldowns.ult = this.cooldown;
        fighter.cooldowns.atk = Math.max(fighter.cooldowns.atk, this.kunaiConfig.delay + 10);

        fighter.teleportDelayTimer = this.kunaiConfig.delay;
        fighter.kunaiPending = [];

        fighter.pendingRasengan = this.rasenganDamage;

        const bounds = game.arenaBounds;
        const arenaDiagonal = Math.hypot(bounds.width, bounds.height);
        const maxAllowedDist = arenaDiagonal * this.maxDistRatio;
        const maxDist = Math.min(this.maxDistBase, maxAllowedDist);

        for (let i = 0; i < count; i++) {
            const throwAngle = fighter.angle + ((Math.PI * 2) / count) * i;
            const speed = this.kunaiSpeed;

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(throwAngle) * 20,
                fighter.y + Math.sin(throwAngle) * 20,
                throwAngle,
                speed,
                this.kunaiConfig.damage,
                game
            );

            p.isKunai = true;
            p.isUlt = true;
            p.radius = 6;
            p.maxDist = maxDist;

            game.projectiles.push(p);
            fighter.kunaiPending.push(p);
            audioEngine.playKunaiThrow();
        }

        game.particles.spawn(fighter.x, fighter.y, '#ffd700', 10);
        logger.log(`${fighter.name} used Flash Barrage!`, 'combat');
    }
}
