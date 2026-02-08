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
        this.stunDuration = config.stunDuration || 60;
    }

    // Static is handled in collision resolution
    // This stores the config values
    onEntityCollision(fighter, other, context) {
        // Only damage enemies (different team)
        if (fighter.id === other.id) return false;

        if (fighter.status.stun <= 0 && other.status.stun <= 0) {
            other.takeDamage(this.damage, false, false, fighter);
            other.applyStatus('STUN', this.stunDuration);

            // Visuals
            context.game.particles.spawnBolt([{ x: fighter.x, y: fighter.y }, { x: other.x, y: other.y }], '#00FFFF', 4);
            context.game.particles.spawn(other.x, other.y, '#00FFFF', 8);

            audioEngine.playZap();
            logger.log(`${fighter.name} STATIC PASSIVE zapped ${other.name} for ${this.damage} dmg!`, 'combat');
        }
    }
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

        this.currentSpeed = 0; // Will be synced with fighter base speed
    }

    onWallBounce(fighter) {
        // Init if needed
        if (this.currentSpeed === 0) this.currentSpeed = fighter.baseSpeed;

        if (this.currentSpeed < this.maxSpeed) {
            this.currentSpeed = Math.min(this.currentSpeed + this.speedGain, this.maxSpeed);

            // Visuals
            fighter.game.combatText.speedUp(fighter.x, fighter.y);
            fighter.game.particles.spawn(fighter.x, fighter.y, '#8b5cf6', 5);
            audioEngine.playSpeedUp();
            this.spawnSonicBoom(fighter);
            logger.log(`${fighter.name} SPEED UP! (${this.currentSpeed.toFixed(1)}/${this.maxSpeed})`, 'info');
        }
    }

    modifySpeed(fighter, speed) {
        if (this.currentSpeed === 0) this.currentSpeed = speed; // Sync initial
        // If we are faster than base, use our speed
        return Math.max(speed, this.currentSpeed);
    }

    spawnSonicBoom(fighter) {
        const moveAngle = Math.atan2(fighter.dy, fighter.dx);
        for (let i = 0; i < 12; i++) {
            const angle = moveAngle + Math.PI + (Math.random() - 0.5) * 1.5;
            const speed = 3 + Math.random() * 3;
            fighter.game.particles.particles.push({
                x: fighter.x - Math.cos(moveAngle) * fighter.radius,
                y: fighter.y - Math.sin(moveAngle) * fighter.radius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.06,
                size: 4 + Math.random() * 4,
                color: '#ffffff',
                type: 'dot'
            });
        }
        fighter.game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x,
            y: fighter.y,
            radius: fighter.radius,
            maxRadius: 80,
            life: 1.0,
            decay: 0.08,
            color: '#8b5cf6'
        });
    }

    /**
     * @returns {boolean} True if a special collision was handled (e.g. slam result)
     */
    onEntityCollision(fighter, other, context) {
        // Only damage enemies (different team)
        if (fighter.id === other.id) return false;

        if (other.collisionImmunity > 0) return false;

        const speedTier = Math.floor((this.currentSpeed - fighter.baseSpeed) / this.speedGain);

        if (speedTier <= 0 && !fighter.ultWallSlamActive) return false;

        // Calculate potential damage for shield check
        let damage = speedTier * this.damagePerTier;
        if (fighter.ultWallSlamActive) damage = Math.max(damage, 10);

        if (other.isBlockedByShield(fighter.x, fighter.y, damage)) {
            logger.log(`${other.name} blocked momentum slam from ${fighter.name}`, 'combat');
            this.currentSpeed = fighter.baseSpeed;
            const reverseAngle = Math.atan2(fighter.y - other.y, fighter.x - other.x);
            fighter.dx = Math.cos(reverseAngle) * 10;
            fighter.dy = Math.sin(reverseAngle) * 10;
            context.game.particles.spawn(
                other.x + Math.cos(other.angle) * 30,
                other.y + Math.sin(other.angle) * 30,
                '#8b5cf6', 10
            );
            audioEngine.playBlock();
            return true;
        }

        // Damage calculation
        other.takeDamage(damage, false, false, fighter);
        context.game.particles.spawn(other.x, other.y, '#8b5cf6', 8);
        logger.log(`${fighter.name} SLAMMED ${other.name} for ${damage} dmg (SpeedTier: ${speedTier})`, 'combat');
        audioEngine.playHeavyImpact();

        if (fighter.ultWallSlamActive) {
            other.pendingWallSlam = { owner: fighter };
            for (let i = 0; i < 10; i++) {
                context.game.particles.spawn(other.x, other.y, '#ff4444', 1);
            }
        }

        this.currentSpeed = fighter.baseSpeed;

        for (let k = 0; k < 15; k++) {
            context.game.particles.spawn(other.x, other.y, '#8b5cf6', 1);
        }

        return false; // Let standard physics bump happen
    }
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
            this.regenTimer += (context.timeScale || 1);
            if (this.regenTimer >= this.regenTickFrames) {
                this.currentShield = Math.min(this.currentShield + this.regenRate, this.maxShield);
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

    draw(fighter, ctx) {
        if (!fighter || !ctx || fighter.shieldHp <= 0) return;

        ctx.save();
        ctx.globalAlpha = 0.3 + (fighter.shieldHp / (this.maxShield || 75)) * 0.3;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, fighter.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();
        ctx.restore();

        // Shield HP UI
        ctx.save();
        ctx.fillStyle = "#00ffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.strokeText(`🛡️${Math.ceil(fighter.shieldHp)}`, 0, -fighter.radius - 15);
        ctx.fillText(`🛡️${Math.ceil(fighter.shieldHp)}`, 0, -fighter.radius - 15);
        ctx.restore();
    }
}
