/**
 * Passive Abilities
 *
 * Parry, Evasion, Static Field, Shield Deflect, Momentum, Force Field
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class ParryPassiveAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.chance = config.chance || 0.17;
    }

    onDamage(fighter, damage, context) {
        if (Math.random() < this.chance) {
            context.game.combatText.parried(fighter.x, fighter.y - fighter.radius);
            context.game.particles.spawn(fighter.x, fighter.y, '#ffffff', 5);
            audioEngine.playBlock();
            logger.log(`${fighter.name} PARRIED incoming damage!`, 'info');
            return false;
        }
        return damage;
    }
}

export class EvasionAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.duration = config.duration || 12;
        this.cooldown = config.cooldown || 102;
    }

    onDamage(fighter, damage, context) {
        if (fighter.cooldowns.def <= 0) {
            fighter.activeEffects.evasionTimer = this.duration;
            fighter.cooldowns.def = this.cooldown;
            context.game.combatText.dodged(fighter.x, fighter.y - fighter.radius);
            context.game.particles.spawn(fighter.x, fighter.y, '#ffd700', 5);
            audioEngine.playSwordSwing();
            logger.log(`${fighter.name} DODGED incoming damage!`, 'info');
            return false;
        }
        return damage;
    }
}

export class StaticPassiveAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.radius = config.radius || 60;
        this.damage = config.damage || 2;
        this.tickRate = config.tickRate || 30;
    }

    // Static is handled in collision resolution
    // This stores the config values
}

export class ShieldDeflectAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.arcAngle = config.arcAngle || (Math.PI * 0.65);
        this.shieldRadius = config.shieldRadius || 8;
    }

    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        const shieldRadius = fighter.radius + this.shieldRadius;
        const halfArc = this.arcAngle / 2;

        const hit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, fighter.x, fighter.y, shieldRadius);
        if (!hit) return null;

        const hitAngle = Math.atan2(hit.y - fighter.y, hit.x - fighter.x);
        const angleDiff = Physics.normalizeAngle(hitAngle - fighter.angle);

        if (Math.abs(angleDiff) > halfArc) return null;

        return {
            x: hit.x,
            y: hit.y,
            dist: hit.dist,
            nx: Math.cos(hitAngle),
            ny: Math.sin(hitAngle)
        };
    }

    isBlocked(fighter, attackerX, attackerY, damage = 0) {
        const angleToAttacker = Math.atan2(attackerY - fighter.y, attackerX - fighter.x);
        const angleDiff = Physics.normalizeAngle(angleToAttacker - fighter.angle);
        const halfArc = this.arcAngle / 2;

        return Math.abs(angleDiff) < halfArc;
    }
}

export class MomentumPassiveAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.maxSpeed = config.maxSpeed || 8;
        this.speedGain = config.speedGain || 1;
        this.damagePerTier = config.damagePerTier || 5;
        this.knockback = config.knockback || 15;
    }

    // Momentum is handled in Fighter movement and collision
    // This stores the config values
}

export class ForceFieldAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.maxShield = config.maxShield || 75;
        this.regenRate = config.regenRate || 0.033;
        this.regenTickFrames = config.regenTickFrames || 30;

        this.currentShield = this.maxShield;
        this.regenTimer = 0;
    }

    update(fighter, context) {
        // Expose shield HP to fighter for rendering/logic
        fighter.shieldHp = this.currentShield;
        fighter.maxShield = this.maxShield;

        // Regen logic
        if (this.currentShield < this.maxShield && fighter.hp > 0) {
            this.regenTimer++;
            if (this.regenTimer >= this.regenTickFrames) {
                this.currentShield = Math.min(this.currentShield + 1, this.maxShield);
                this.regenTimer = 0;

                // Visual feedback
                if (Math.random() < 0.3) {
                    context.game.particles.spawnText(fighter.x, fighter.y - 20, "+1", "#00ffff");
                    audioEngine.playRegen();
                }

                if (this.currentShield % 10 === 0 && this.currentShield < this.maxShield) {
                    logger.log(`${fighter.name} Force Field regenerating... (${Math.floor(this.currentShield)}/${this.maxShield})`, 'info');
                }
            }
        }
    }

    onDamage(fighter, damage, context) {
        if (this.currentShield > 0) {
            const absorbed = Math.min(this.currentShield, damage);
            this.currentShield -= absorbed;
            damage -= absorbed;

            audioEngine.playBlock();

            context.game.particles.spawn(fighter.x, fighter.y, '#00ffff', 8);

            if (damage <= 0) {
                logger.log(`${fighter.name} Force Field absorbed full damage (${absorbed})`, 'info');
                return false;
            } else {
                logger.log(`${fighter.name} Force Field absorbed ${absorbed} damage`, 'info');
            }
        }
        return damage;
    }
}
