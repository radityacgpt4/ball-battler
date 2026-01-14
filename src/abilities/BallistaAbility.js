/**
 * Ballista Abilities
 *
 * ATK: Heavy Bolt - Piercing bolts that pin enemies
 * DEF: Gate Barrier - Protective barriers on sides
 * ULT: Siege Mode - Enhanced volleys
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { BallistaBoltRenderer } from '../components/ProjectileRenderers.js';
import { LinearMovement, DragBehavior } from '../components/ProjectileBehaviors.js';

export class BallistaAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.damage = config.damage || 15;
        this.projectileSpeed = config.projectileSpeed || 16;
        this.spreadAngle = config.spreadAngle || 0.15;
        this.boltRadius = config.boltRadius || 8;
        this.dragDuration = config.dragDuration || 25;
        this.normalBoltCount = config.normalBoltCount || 2;
        this.ultBoltCount = config.ultBoltCount || 3;
    }

    update(fighter, context) {
        const { game } = context;

        if (fighter.cooldowns.atk <= 0) {
            fighter.cooldowns.atk = this.cooldown;

            // Check if ULT is active
            const isUltActive = fighter.ballistaUltShots > 0;

            let angles;
            if (isUltActive) {
                // ULT: more bolts in cone
                angles = [];
                for (let i = 0; i < this.ultBoltCount; i++) {
                    const offset = (i - (this.ultBoltCount - 1) / 2) * this.spreadAngle;
                    angles.push(fighter.angle + offset);
                }
                fighter.ballistaUltShots--;
            } else {
                // Normal: 2 bolts
                angles = [
                    fighter.angle - this.spreadAngle / 2,
                    fighter.angle + this.spreadAngle / 2
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
                p.radius = this.boltRadius;
                p.dragTarget = null;
                p.dragDuration = this.dragDuration;

                p.renderer = new BallistaBoltRenderer();
                p.addComponent(new LinearMovement());
                p.addComponent(new DragBehavior());

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
        // All values from config (fighters.js)
        this.barrierMaxHp = config.barrierMaxHp || 30;
        this.barrierCount = config.barrierCount || 4;
        this.arcAngle = config.arcAngle || 1.22;
        this.shieldRadius = config.shieldRadius || 8;

        this.initialized = false;
    }

    update(fighter, context) {
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

    getBarrierIndex(localAngle) {
        if (!this.initialized) return -1;

        localAngle = Physics.normalizeAngle(localAngle);

        const halfArc = this.arcAngle / 2;
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

        const game = fighter.game;
        const barrierWorldAngle = fighter.angle + barrier.angle;
        const effectX = fighter.x + Math.cos(barrierWorldAngle) * (fighter.radius + 15);
        const effectY = fighter.y + Math.sin(barrierWorldAngle) * (fighter.radius + 15);

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
        angle = Physics.normalizeAngle(angle);
        if (Math.abs(angle) < 0.1) return "FRONT";
        if (Math.abs(angle - Math.PI / 2) < 0.1) return "RIGHT";
        if (Math.abs(angle + Math.PI / 2) < 0.1) return "LEFT";
        return "BACK";
    }

    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        if (!fighter.ballistaBarriers) return null;

        const shieldRadius = fighter.radius + this.shieldRadius;
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

    isBlocked(fighter, attackerX, attackerY, damage = 0) {
        if (!fighter.ballistaBarriers) return false;

        const angleToAttacker = Math.atan2(attackerY - fighter.y, attackerX - fighter.x);
        const localAngle = Physics.normalizeAngle(angleToAttacker - fighter.angle);

        const index = this.getBarrierIndex(localAngle);
        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                if (damage > 0) {
                    this.damageBarrier(fighter, barrier, damage);
                }
                return true;
            }
        }
        return false;
    }

    onDamage(fighter, amount, context) {
        const { isDoT, attacker } = context;

        if (isDoT) return amount;
        if (!attacker) return amount;
        if (!fighter.ballistaBarriers) return amount;

        const angleToAttacker = Math.atan2(attacker.y - fighter.y, attacker.x - fighter.x);
        const localAngle = Physics.normalizeAngle(angleToAttacker - fighter.angle);

        const index = this.getBarrierIndex(localAngle);

        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                const absorbed = Math.min(barrier.hp, amount);
                this.damageBarrier(fighter, barrier, absorbed);

                amount -= absorbed;

                logger.log(`${fighter.name} Barrier absorbed ${Math.ceil(absorbed)} dmg (Remaining: ${Math.ceil(amount)})`, 'combat');

                if (amount <= 0) return false;
            }
        }

        return amount;
    }
}

export class BallistaUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.cooldown = config.cooldown || 120;
        this.damage = config.damage || 15;
        this.ultShots = config.ultShots || 3;
        this.ultVisualDuration = config.ultVisualDuration || 60;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.ult = this.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = this.ultVisualDuration;

        // ULT buffs ATK - next few shots are enhanced
        fighter.ballistaUltShots = this.ultShots;

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
