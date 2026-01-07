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
        this.barrierMaxHp = 30;
        this.barrierCount = 4;
        this.initialized = false;
    }

    update(fighter, context) {
        const { game } = context;

        // Initialize barriers on first update
        if (!this.initialized) {
            fighter.ballistaBarriers = [];
            for (let i = 0; i < this.barrierCount; i++) {
                fighter.ballistaBarriers.push({
                    hp: this.barrierMaxHp,
                    maxHp: this.barrierMaxHp,
                    angle: (Math.PI * 2 / this.barrierCount) * i, // 0, 90, 180, 270 degrees
                    destroyed: false
                });
            }
            this.initialized = true;
        }
    }

    onDamage(fighter, amount, context) {
        const { game, isDoT } = context;

        // DoT bypasses barriers
        if (isDoT) {
            return amount;
        }

        // Check if any barrier can block
        if (!fighter.ballistaBarriers) return amount;

        // Use context.attacker if available, otherwise fallback to fighter's back
        const attacker = context.attacker;
        let attackAngle;
        
        if (attacker) {
            attackAngle = Math.atan2(attacker.y - fighter.y, attacker.x - fighter.x);
        } else {
            attackAngle = fighter.angle + Math.PI; // Opposite of facing direction
        }

        let closestBarrier = null;
        let closestAngleDiff = Infinity;

        for (const barrier of fighter.ballistaBarriers) {
            if (barrier.destroyed) continue;

            // Barrier faces world direction = fighter.angle + barrier.angle
            const barrierWorldAngle = fighter.angle + barrier.angle;
            let angleDiff = Math.abs(barrierWorldAngle - attackAngle);
            // Normalize angle difference
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            // Check if within barrier arc (72 degrees visual = ~PI/2.5 total width)
            // So we need +/- PI/5 from center (36 degrees)
            if (angleDiff < Math.PI / 5 && angleDiff < closestAngleDiff) {
                closestAngleDiff = angleDiff;
                closestBarrier = barrier;
            }
        }

        if (closestBarrier) {
            // Barrier absorbs damage
            const absorbed = Math.min(closestBarrier.hp, amount);
            closestBarrier.hp -= absorbed;
            amount -= absorbed;

            // Logging
            const sides = ["FRONT", "RIGHT", "BACK", "LEFT"];
            const sideName = sides[fighter.ballistaBarriers.indexOf(closestBarrier)];
            logger.log(`${fighter.name} Barrier (${sideName}) absorbed ${Math.ceil(absorbed)} dmg. Remaining: ${Math.ceil(closestBarrier.hp)}`, 'combat');

            // Spawn particles at shield surface (radius + 15 to match visual/Shieldbearer feel)
            // Use attackAngle (angle from fighter to attacker)
            // Note: attackAngle was calculated relative to attacker, so we point TOWARDS attacker
            const hitDist = fighter.radius + 15;
            // attackAngle is atan2(attacker - fighter), so it points to attacker
            const hitX = fighter.x + Math.cos(attackAngle) * hitDist;
            const hitY = fighter.y + Math.sin(attackAngle) * hitDist;

            game.particles.spawn(hitX, hitY, '#D2691E', 8);
            audioEngine.playBlock();

            if (closestBarrier.hp <= 0) {
                closestBarrier.destroyed = true;
                game.particles.spawnExplosion(fighter.x, fighter.y);
                audioEngine.playExplosion();
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
