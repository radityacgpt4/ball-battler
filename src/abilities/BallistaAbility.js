/**
 * Ballista Abilities
 * Heavy hitter ranged fighter with knockback mechanics
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class BallistaAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.damage = config.damage || 15;
        this.projectileSpeed = config.projectileSpeed || 16;
    }

    update(fighter, context) {
        const { game } = context;

        if (fighter.cooldowns.atk <= 0) {
            fighter.cooldowns.atk = this.cooldown;

            // Check if ULT is active - fire 3 bolts, otherwise 2
            const isUltActive = fighter.ballistaUltShots > 0;
            const spreadAngle = 0.15; // ~9 degrees spread

            let angles;
            if (isUltActive) {
                // ULT: 3 bolts in cone
                angles = [
                    fighter.angle - spreadAngle,
                    fighter.angle,
                    fighter.angle + spreadAngle
                ];
                fighter.ballistaUltShots--;
            } else {
                // Normal: 2 bolts
                angles = [
                    fighter.angle - spreadAngle / 2,
                    fighter.angle + spreadAngle / 2
                ];
            }

            angles.forEach((angle) => {
                const p = new Projectile(
                    fighter,
                    fighter.x + Math.cos(angle) * 30,
                    fighter.y + Math.sin(angle) * 30,
                    angle,
                    this.projectileSpeed,
                    this.damage,
                    game
                );

                p.isBallistaBolt = true;
                p.isUltBolt = isUltActive;
                p.radius = 8;
                p.dragTarget = null;
                p.dragDuration = 25;

                game.projectiles.push(p);
            });

            game.particles.spawn(fighter.x + Math.cos(fighter.angle) * 30, fighter.y + Math.sin(fighter.angle) * 30, '#8B4513', 4);
            audioEngine.playGunshot();
        }
    }
}

export class BallistaDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.barrierMaxHp = config.barrierMaxHp || 30;
        this.barrierCount = config.barrierCount || 4;
        this.initialized = false;
        // Visual arc is ~1.22 rad (~70 degrees).
        // We use this to determine hit detection to match visual gaps.
        this.arcAngle = config.arcAngle || 1.22;
    }

    update(fighter, context) {
        // Initialize barriers on first update
        if (!this.initialized) {
            fighter.ballistaBarriers = [];

            // Create 2 barriers: Right (PI/2) and Left (-PI/2)
            const angles = [Math.PI / 2, -Math.PI / 2];

            for (const angle of angles) {
                fighter.ballistaBarriers.push({
                    hp: this.barrierMaxHp,
                    maxHp: this.barrierMaxHp,
                    angle: angle,
                    destroyed: false
                });
            }
            this.initialized = true;
        }
    }

    /**
     * Helper to find which barrier (if any) is hit by an angle relative to fighter
     */
    getBarrierIndex(localAngle) {
        if (!this.initialized) return -1;

        // Normalize angle to -PI to PI
        localAngle = Physics.normalizeAngle(localAngle);

        // Check each barrier
        // Barriers are at 0, PI/2 (1.57), PI (3.14), -PI/2 (-1.57)
        // We check if angle is within arcAngle/2 of barrier angle

        const halfArc = this.arcAngle / 2;
        // Angles corresponding to the barriers we created: Right (PI/2), Left (-PI/2)
        const barrierAngles = [Math.PI / 2, -Math.PI / 2];

        for (let i = 0; i < barrierAngles.length; i++) {
            const diff = Physics.normalizeAngle(localAngle - barrierAngles[i]);
            if (Math.abs(diff) < halfArc) {
                return i;
            }
        }

        return -1;
    }

    damageBarrier(fighter, barrier, amount) {
        barrier.hp -= amount;

        // Log sparingly? Or always for feedback
        // logger.log(`${fighter.name} Shield took ${Math.ceil(amount)} dmg.`, 'combat');

        const game = fighter.game;
        const barrierWorldAngle = fighter.angle + barrier.angle;
        const effectX = fighter.x + Math.cos(barrierWorldAngle) * (fighter.radius + 15);
        const effectY = fighter.y + Math.sin(barrierWorldAngle) * (fighter.radius + 15);

        // Block Effect
        game.particles.spawn(effectX, effectY, '#D2691E', 4);

        if (barrier.hp <= 0 && !barrier.destroyed) {
            barrier.destroyed = true;
            barrier.hp = 0;

            game.combatText.shieldBreak(effectX, effectY, this.getSideName(barrier.angle));
            game.particles.spawnExplosion(effectX, effectY);
            audioEngine.playExplosion();
            logger.log(`${fighter.name} Barrier (${this.getSideName(barrier.angle)}) BROKEN!`, 'error');
        }
    }

    getSideName(angle) {
        // approx check
        angle = Physics.normalizeAngle(angle);
        if (Math.abs(angle) < 0.1) return "FRONT";
        if (Math.abs(angle - Math.PI / 2) < 0.1) return "RIGHT";
        if (Math.abs(angle + Math.PI / 2) < 0.1) return "LEFT";
        return "BACK";
    }

    /**
     * Raycast Hit Detection (for Thundermage etc)
     */
    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        if (!fighter.ballistaBarriers) return null;

        const shieldRadius = fighter.radius + 8;
        const hit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, fighter.x, fighter.y, shieldRadius);
        if (!hit) return null;

        const hitAngle = Math.atan2(hit.y - fighter.y, hit.x - fighter.x);
        const localAngle = Physics.normalizeAngle(hitAngle - fighter.angle);

        const index = this.getBarrierIndex(localAngle);
        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                return {
                    x: hit.x,
                    y: hit.y,
                    dist: hit.dist,
                    nx: Math.cos(hitAngle),
                    ny: Math.sin(hitAngle)
                };
            }
        }
        return null;
    }

    /**
     * Projectile/Melee Block Detection
     */
    isBlocked(fighter, attackerX, attackerY, damage = 0) {
        if (!fighter.ballistaBarriers) return false;

        const angleToAttacker = Math.atan2(attackerY - fighter.y, attackerX - fighter.x);
        const localAngle = Physics.normalizeAngle(angleToAttacker - fighter.angle);

        const index = this.getBarrierIndex(localAngle);
        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                // Apply damage to shield
                if (damage > 0) {
                    this.damageBarrier(fighter, barrier, damage);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Fallback Damage Handler (Explosions, AoE)
     */
    onDamage(fighter, amount, context) {
        const { isDoT, attacker } = context;

        // DoT bypasses barriers
        if (isDoT) return amount;

        // If we don't know where damage came from, can't block directionally
        if (!attacker) return amount;

        // If barriers not init
        if (!fighter.ballistaBarriers) return amount;

        const angleToAttacker = Math.atan2(attacker.y - fighter.y, attacker.x - fighter.x);
        const localAngle = Physics.normalizeAngle(angleToAttacker - fighter.angle);

        const index = this.getBarrierIndex(localAngle);

        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                // Absorb damage
                const absorbed = Math.min(barrier.hp, amount);
                this.damageBarrier(fighter, barrier, absorbed);

                amount -= absorbed;

                logger.log(`${fighter.name} Barrier absorbed ${Math.ceil(absorbed)} dmg (Remaining: ${Math.ceil(amount)})`, 'combat');

                if (amount <= 0) return false; // Fully blocked
            }
        }

        return amount;
    }
}

export class BallistaUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 150;
        this.damage = config.damage || 15;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.ult = this.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 60; // 1 second buff

        // ULT now buffs ATK - next few shots are enhanced
        fighter.ballistaUltShots = 3; // 3 enhanced volleys

        game.particles.spawn(fighter.x, fighter.y, '#8B4513', 10);
        audioEngine.playHeavyImpact();

        // Visual effect
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            game.particles.particles.push({
                x: fighter.x + Math.cos(angle) * 30,
                y: fighter.y + Math.sin(angle) * 30,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 0.8,
                decay: 0.05,
                size: 6,
                color: '#8B4513',
                type: 'dot'
            });
        }
    }
}
