/**
 * Divine General Abilities
 *
 * ATK: Eightfold Strike - 8 orbs act as melee hitboxes
 * DEF: Adaptation Heal - Stores damage and heals after delay
 * ULT: Perfect Adaptation - Stores incoming damage for bonus attack
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { logger } from '../systems/Logger.js';
import { audioEngine } from '../systems/Audio.js';
import { checkWeaponHit } from '../data/weaponGeometry.js';

// --- ATK: EIGHTFOLD STRIKE ---
export class DivineGeneralAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.baseDamage = config.baseDamage || 2;
        this.resetTime = config.resetTime || 300;
        this.orbCount = config.orbCount || 8;
        this.orbRadius = config.orbRadius || 3;
        this.orbDistance = config.orbDistance || 18;
        this.attackCooldown = config.attackCooldown || 12;

        this.currentBonus = 0;
        this.lastHitTime = 0;
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

        // Orb-based collision using weapon geometry registry
        if (this.canUse(fighter, context)) {
            let hit = false;

            for (const enemy of context.enemies) {
                if (enemy === fighter || enemy.isDead) continue;

                // Use weapon geometry registry for orb collision
                if (checkWeaponHit('DIVINE_GENERAL_WHEEL', fighter, enemy)) {
                    if (fighter.cooldowns.atk <= 0) {
                        this.performAttack(fighter, enemy);
                        hit = true;
                        break;
                    }
                }
                if (hit) break;
            }
        }
    }

    performAttack(fighter, enemy) {
        // Calculate Damage
        let damage = this.baseDamage + this.currentBonus;

        // Check for Buff (Ult/Stored Damage)
        const isBuffed = fighter.activeEffects.adaptationStoredDamage > 0;

        // Consume ULT absorbed damage if available
        if (isBuffed) {
            damage += fighter.activeEffects.adaptationStoredDamage;
            fighter.activeEffects.adaptationStoredDamage = 0;
            logger.log(`${fighter.name} unleashed ADAPTED POWER!`, 'combat');
        }

        // Apply Damage
        enemy.takeDamage(damage, false, false, fighter);

        // Visuals & Audio
        audioEngine.playRealisticSlash();

        // === RANDOM SLASHING SPECIAL EFFECT (Updated) ===
        // Config based on buff state
        const slashColor = isBuffed ? '#00BFFF' : '#FFD700'; // Blue for Adaptation/Ult, Gold for normal
        const slashThickness = isBuffed ? 8 : 4;
        const slashCount = 3; // Reduced count (halved)

        // Generate slashes ON THE ENEMY
        for (let i = 0; i < slashCount; i++) {
            // Center strictly on enemy with small variation
            const cx = enemy.x + (Math.random() - 0.5) * 40;
            const cy = enemy.y + (Math.random() - 0.5) * 40;
            const angle = Math.random() * Math.PI * 2;
            const len = 30 + Math.random() * 20;

            fighter.game.particles.spawnSlash(
                cx - Math.cos(angle) * len,
                cy - Math.sin(angle) * len,
                cx + Math.cos(angle) * len,
                cy + Math.sin(angle) * len,
                slashColor,
                slashThickness
            );
        }

        // Burst of particles
        if (isBuffed) {
            // Blue explosion for buffed hit
            fighter.game.particles.spawn(enemy.x, enemy.y, '#00BFFF', 15);
            fighter.game.particles.spawnShockwave(enemy.x, enemy.y, '#00BFFF');
            // Extra sparks
            for (let k = 0; k < 5; k++) {
                fighter.game.particles.spawnBolt([
                    { x: enemy.x, y: enemy.y },
                    { x: enemy.x + (Math.random() - 0.5) * 50, y: enemy.y + (Math.random() - 0.5) * 50 }
                ], '#00BFFF', 2);
            }
        } else {
            // Normal Gold burst
            fighter.game.particles.spawn(enemy.x, enemy.y, '#FFD700', 8);
        }

        // Reset Bonus
        this.currentBonus = 0;
        this.lastHitTime = 0;

        // Trigger adaptation on hit (only if <50% HP and not already activated)
        if (!fighter.activeEffects.adaptationActivated && fighter.hp < fighter.maxHp * 0.5) {
            const ultAbility = fighter.abilities.ult;
            if (ultAbility) {
                ultAbility.execute(fighter, { enemies: [enemy], game: fighter.game });
            }
        }

        // Set Cooldown
        fighter.cooldowns.atk = this.attackCooldown;
    }
}

// --- DEF: ADAPTATION HEAL ---
export class DivineGeneralDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.healDelay = config.healDelay || 300;
        this.healPercent = config.healPercent || 0.9;

        this.storedDamage = 0;
        this.healDelayTimer = 0;
        this.accumulating = false;
    }

    update(fighter, context) {
        if (this.storedDamage > 0) {
            this.healDelayTimer++;

            // Sync with UI cooldown system
            fighter.cooldowns.def = this.healDelay - this.healDelayTimer;
            fighter.maxCooldowns.def = this.healDelay;

            if (this.healDelayTimer >= this.healDelay) {
                // Trigger Heal
                const healAmount = this.storedDamage * this.healPercent;
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
            fighter.cooldowns.def = 0;
        }
    }

    onDamage(fighter, damage, context) {
        this.storedDamage += damage;
        return damage;
    }
}

// --- ULT: ADAPTATION ---
export class DivineGeneralUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.duration = config.duration || 60;
        this.adaptationMaxStored = config.adaptationMaxStored || 15;
        this.hpThreshold = config.hpThreshold || 0.5;
    }

    execute(fighter, context) {
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 999999; // Practically infinite

        // Custom effect state for Divine General
        fighter.activeEffects.adaptationActivated = true;
        fighter.activeEffects.adaptationAbsorbing = true;
        fighter.activeEffects.adaptationStoredDamage = 0;

        // Visuals
        audioEngine.playPowerUp();
        fighter.game.particles.spawn(fighter.x, fighter.y, '#FFD700', 20);
        fighter.game.particles.spawnShockwave(fighter.x, fighter.y, '#B8860B');

        logger.log(`${fighter.name} activates PERSISTENT ADAPTATION!`, 'combat');
    }

    stop(fighter, context) {
        fighter.activeEffects.adaptationAbsorbing = false;
    }
}

// DEF ability with ULT interaction
export class DivineGeneralDefAbilityWithUlt extends DivineGeneralDefAbility {
    constructor(config, slot, ultConfig) {
        super(config, slot);
        // Store ULT config for accessing thresholds
        this.adaptationMaxStored = (ultConfig && ultConfig.adaptationMaxStored) || 15;
        this.hpThreshold = (ultConfig && ultConfig.hpThreshold) || 0.5;
    }

    update(fighter, context) {
        super.update(fighter, context);

        // UI update every frame
        fighter.activeEffects.displayStoredDamage = Math.ceil(fighter.activeEffects.adaptationStoredDamage || 0);
    }

    onDamage(fighter, damage, context) {
        // Check for ULT condition
        if (fighter.activeEffects.adaptationActivated || fighter.hp < fighter.maxHp * this.hpThreshold) {
            // Activate permanently if not already
            if (!fighter.activeEffects.adaptationActivated) {
                fighter.activeEffects.adaptationActivated = true;
                logger.log(`${fighter.name} ADAPTATION ACTIVATED (HP < ${this.hpThreshold * 100}%)`, 'combat');
            }

            // Absorb damage
            const prevStored = fighter.activeEffects.adaptationStoredDamage || 0;
            fighter.activeEffects.adaptationStoredDamage = Math.min(prevStored + damage, this.adaptationMaxStored);
            logger.log(`${fighter.name} absorbed ${Math.ceil(damage)} dmg. Stored: ${Math.ceil(fighter.activeEffects.adaptationStoredDamage)}/${this.adaptationMaxStored}`, 'info');
        }

        return super.onDamage(fighter, damage, context);
    }
}
