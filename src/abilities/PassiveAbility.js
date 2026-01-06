/**
 * Passive Abilities
 * Handles defensive passives like Parry, Evasion, Static, and Shield Deflect
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

export class ParryPassiveAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.chance = config.chance;
    }

    onDamage(fighter, damage, context) {
        if (Math.random() < this.chance) {
            context.game.particles.spawnText(fighter.x, fighter.y, "BLOCK", "#ffffff");
            audioEngine.playBlock();
            return false; // Block the damage
        }
        return damage;
    }
}

export class EvasionAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration;
    }

    onDamage(fighter, damage, context) {
        if (fighter.cooldowns.def <= 0) {
            fighter.activeEffects.evasionTimer = this.duration; // 0.2s visual
            fighter.cooldowns.def = this.cooldown;
            context.game.particles.spawnText(fighter.x, fighter.y, "DODGE", "#ffd700");
            audioEngine.playSwordSwing();
            return false; // Block the damage
        }
        return damage;
    }
}

export class StaticPassiveAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
    }

    // Static is handled in collision resolution
    // This is just a marker ability
}

export class ShieldDeflectAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.arcAngle = config.arcAngle;
    }

    /**
     * Check if a ray hits the shield arc
     * @returns {Object|null} Hit data or null
     */
    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        const shieldRadius = fighter.radius + 8; // Shield is slightly outside body
        const halfArc = this.arcAngle / 2;

        // Find ray-circle intersection
        const hit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, fighter.x, fighter.y, shieldRadius);
        if (!hit) return null;

        // Check if hit point is within shield arc
        const hitAngle = Math.atan2(hit.y - fighter.y, hit.x - fighter.x);
        const angleDiff = Physics.normalizeAngle(hitAngle - fighter.angle);

        if (Math.abs(angleDiff) > halfArc) return null;

        // Return hit with normal pointing outward
        return {
            x: hit.x,
            y: hit.y,
            dist: hit.dist,
            nx: Math.cos(hitAngle),
            ny: Math.sin(hitAngle)
        };
    }

    /**
     * Check if attacker position is blocked by shield
     */
    isBlocked(fighter, attackerX, attackerY) {
        const angleToAttacker = Math.atan2(attackerY - fighter.y, attackerX - fighter.x);
        const angleDiff = Physics.normalizeAngle(angleToAttacker - fighter.angle);
        const halfArc = this.arcAngle / 2;

        return Math.abs(angleDiff) < halfArc;
    }
}

export class MomentumPassiveAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.maxSpeed = config.maxSpeed;
        this.speedGain = config.speedGain;
        this.damagePerTier = config.damagePerTier;
        this.knockback = config.knockback;
    }

    // Momentum is handled in Fighter movement and collision
    // This stores the config values
}

export class ForceFieldAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.maxShield = config.maxShield || 75;
        this.regenRate = config.regenRate || 2; // HP per sec
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
            if (this.regenTimer >= 30) { // 0.5 sec (assuming 60fps)
                this.currentShield = Math.min(this.currentShield + 1, this.maxShield);
                this.regenTimer = 0;
                
                // Visual feedback (small +1)
                if (Math.random() < 0.3) {
                     context.game.particles.spawnText(fighter.x, fighter.y - 20, "+1", "#00ffff");
                     audioEngine.playRegen();
                }
            }
        }
    }

    onDamage(fighter, damage, context) {
        if (this.currentShield > 0) {
            const absorbed = Math.min(this.currentShield, damage);
            this.currentShield -= absorbed;
            damage -= absorbed;
            
            context.game.particles.spawnText(fighter.x, fighter.y, "SHIELD", "#00ffff");
            audioEngine.playBlock();
            
            // Visual feedback for shield hit
            context.game.particles.spawn(fighter.x, fighter.y, '#00ffff', 5);

            if (damage <= 0) return false; // Fully absorbed
        }
        return damage;
    }
}
