import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { logger } from '../systems/Logger.js';
import { audioEngine } from '../systems/Audio.js';

// --- ATK: EIGHTFOLD STRIKE ---
export class DivineGeneralAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.baseDamage = 2;
        this.currentBonus = 0;
        this.lastHitTime = 0;
        this.resetTime = 300; // 5 seconds @ 60fps
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        // Reset bonus damage if idle for too long
        if (this.currentBonus > 0) {
            this.lastHitTime++;
            if (this.lastHitTime > this.resetTime) {
                this.currentBonus = 0;
                logger.log(`${fighter.name} Eightfold Strike reset`, 'info');
            }
        }

        // Cooldown management handled by fighter update mostly, but we check specific triggers
        if (this.canUse(fighter, context)) {
            // Orb-based collision: 8 orbs at radius+18, spaced 45° apart
            const orbRadius = 3; // Visual orb size
            const orbDistance = fighter.radius + 18;
            let hit = false;

            for (const enemy of context.enemies) {
                if (enemy === fighter || enemy.isDead) continue;

                // Check each of the 8 orbs for collision
                for (let i = 0; i < 8; i++) {
                    const orbAngle = fighter.angle + (fighter.wheelRotation || 0) + (Math.PI * 2 * i) / 8;
                    const orbX = fighter.x + Math.cos(orbAngle) * orbDistance;
                    const orbY = fighter.y + Math.sin(orbAngle) * orbDistance;

                    const distToEnemy = Physics.dist(orbX, orbY, enemy.x, enemy.y);
                    if (distToEnemy < orbRadius + enemy.radius) {
                        if (fighter.cooldowns.atk <= 0) {
                            this.performAttack(fighter, enemy);
                            hit = true;
                            break;
                        }
                    }
                }
                if (hit) break;
            }
        }
    }

    performAttack(fighter, enemy) {
        // Calculate Damage
        let damage = this.baseDamage + this.currentBonus;

        // Consume ULT absorbed damage if available
        if (fighter.activeEffects.adaptationStoredDamage > 0) {
            damage += fighter.activeEffects.adaptationStoredDamage;
            fighter.activeEffects.adaptationStoredDamage = 0; // Consumed

            // Visual for consumed power
            fighter.game.particles.spawn(fighter.x, fighter.y, '#FFD700', 10);
            logger.log(`${fighter.name} unleashed ADAPTED POWER!`, 'combat');
        }

        // Apply Damage
        enemy.takeDamage(damage, false, false, fighter);

        // Visuals & Audio (combatText handled by takeDamage)
        audioEngine.playHit();
        fighter.game.particles.spawnSlash(fighter.x, fighter.y, enemy.x, enemy.y, '#FFD700', 3);

        // Reset Bonus - NERFED: Always 2 damage (fixed)
        this.currentBonus = 0;
        this.lastHitTime = 0;

        // --- TRIGGER ADAPTATION (ULT) ON HIT (ONLY IF <50% HP) ---
        // Once activated, it stays activated
        if (!fighter.activeEffects.adaptationActivated && fighter.hp < fighter.maxHp * 0.5) {
            const ultAbility = fighter.abilities.ult;
            if (ultAbility) {
                ultAbility.execute(fighter, { enemies: [enemy], game: fighter.game });
            }
        }

        // Set Cooldown (0.2s = 12 frames)
        fighter.cooldowns.atk = 12;
    }
}

// --- DEF: ADAPTATION HEAL ---
export class DivineGeneralDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.storedDamage = 0;
        this.healDelayTimer = 0;
        this.healDelay = 300; // 5 seconds
        this.accumulating = false;
    }

    // Passive update to handle the delayed heal
    update(fighter, context) {
        if (this.storedDamage > 0) {
            this.healDelayTimer++;

            // Sync with UI cooldown system (counts DOWN from max)
            fighter.cooldowns.def = this.healDelay - this.healDelayTimer;
            fighter.maxCooldowns.def = this.healDelay;

            if (this.healDelayTimer >= this.healDelay) {
                // Trigger Heal
                const healAmount = this.storedDamage * 0.9; // 90%
                if (healAmount > 0) {
                    const oldHp = fighter.hp;
                    fighter.hp = Math.min(fighter.hp + healAmount, fighter.maxHp);
                    const healed = fighter.hp - oldHp;

                    if (healed > 0) {
                        fighter.game.combatText.healing(fighter.x, fighter.y, Math.ceil(healed));
                        fighter.game.particles.spawn(fighter.x, fighter.y, '#00FF00', 8);
                        logger.log(`${fighter.name} Adapted & Healed ${Math.ceil(healed)} HP`, 'info');
                    }
                }

                // Reset
                this.storedDamage = 0;
                this.healDelayTimer = 0;
                fighter.cooldowns.def = 0;
            }
        } else {
            // No damage stored - show as ready
            fighter.cooldowns.def = 0;
        }
    }

    // Called when fighter takes damage
    onDamage(fighter, damage, context) {
        // Track incoming damage
        // Does NOT reduce damage, just tracks it
        this.storedDamage += damage;
        // Fixed: Removed healDelayTimer = 0 reset. 
        // This allows the 5s timer to fulfill even if taking continuous damage.
        return damage;
    }
}

// --- ULT: ADAPTATION ---
export class DivineGeneralUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = 60; // 1 second
    }

    execute(fighter, context) {
        // Proc-ed manually by ATK
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 999999; // Practically infinite

        // Custom effect state for Divine General
        fighter.activeEffects.adaptationActivated = true; // NEW: Persistent flag
        fighter.activeEffects.adaptationAbsorbing = true;
        fighter.activeEffects.adaptationStoredDamage = 0;

        // Visuals
        audioEngine.playPowerUp();
        fighter.game.particles.spawn(fighter.x, fighter.y, '#FFD700', 20);
        fighter.game.particles.spawnShockwave(fighter.x, fighter.y, '#B8860B');

        logger.log(`${fighter.name} activates PERSISTENT ADAPTATION!`, 'combat');
    }
}

// Re-write DEF ability to handle ULT interaction
export class DivineGeneralDefAbilityWithUlt extends DivineGeneralDefAbility {
    update(fighter, context) {
        super.update(fighter, context);

        // --- ABSORBED DAMAGE DECAY REMOVED ---
        // Stored damage stays until next hit connected

        // --- UI UPDATED EVERY FRAME (Real-time) ---
        fighter.activeEffects.displayStoredDamage = Math.ceil(fighter.activeEffects.adaptationStoredDamage || 0);
    }

    onDamage(fighter, damage, context) {
        // Check for ULT condition:
        // 1. Stance already activated permanently OR
        // 2. Currently below 50% HP (start absorbing immediately)
        if (fighter.activeEffects.adaptationActivated || fighter.hp < fighter.maxHp * 0.5) {
            // Activate permanently if not already
            if (!fighter.activeEffects.adaptationActivated) {
                fighter.activeEffects.adaptationActivated = true;
                logger.log(`${fighter.name} ADAPTATION ACTIVATED (HP < 50%)`, 'combat');
            }

            // Absorb damage
            const prevStored = fighter.activeEffects.adaptationStoredDamage || 0;
            fighter.activeEffects.adaptationStoredDamage = Math.min(prevStored + damage, 15);
            logger.log(`${fighter.name} absorbed ${Math.ceil(damage)} dmg. Stored: ${Math.ceil(fighter.activeEffects.adaptationStoredDamage)}/15`, 'info');
        }

        // Normal behavior
        // "it only stores damage, not perfectly resistant to damage"
        return super.onDamage(fighter, damage, context);
    }
}