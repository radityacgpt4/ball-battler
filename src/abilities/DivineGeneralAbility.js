import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { logger } from '../systems/Logger.js';
import { audioEngine } from '../systems/Audio.js';

// --- ATK: EIGHTFOLD STRIKE ---
export class DivineGeneralAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.baseDamage = 1;
        this.maxBonusDamage = 10;
        this.currentBonus = 0;
        this.lastHitTime = 0;
        this.resetTime = 300; // 5 seconds @ 60fps
    }

    update(fighter, context) {
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
            // Auto-attack logic (Melee with short range)
            const range = fighter.radius + 15;
            let hit = false;
            
            for (const enemy of context.enemies) {
                const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
                if (dist < fighter.radius + enemy.radius) {
                    // Check cooldown again to be safe
                    if (fighter.cooldowns.atk <= 0) {
                        this.performAttack(fighter, enemy);
                        hit = true;
                        break; // Hit one enemy per frame
                    }
                }
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
        
        // Visuals & Audio
        audioEngine.playHit();
        fighter.game.combatText.damage(enemy.x, enemy.y, damage, '#FFD700'); // Gold text
        fighter.game.particles.spawnSlash(fighter.x, fighter.y, enemy.x, enemy.y, '#FFD700', 3);
        
        // Increment Bonus
        if (this.currentBonus < this.maxBonusDamage) {
            this.currentBonus++;
        }
        this.lastHitTime = 0;
        
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
            }
        }
    }

    // Called when fighter takes damage
    onDamage(fighter, damage, context) {
        // Track incoming damage
        // Does NOT reduce damage, just tracks it
        this.storedDamage += damage;
        this.healDelayTimer = 0; // Reset timer on new damage (burst window logic or rolling window? Prompt says "Track burst damage... after 5s delay". Usually means 5s after LAST damage)
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
        fighter.cooldowns.ult = this.config.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = this.duration;
        
        // Custom effect state for Divine General
        fighter.activeEffects.adaptationAbsorbing = true;
        fighter.activeEffects.adaptationStoredDamage = 0;
        
        // Visuals
        audioEngine.playPowerUp();
        fighter.game.particles.spawn(fighter.x, fighter.y, '#FFD700', 20);
        fighter.game.particles.spawnShockwave(fighter.x, fighter.y, '#B8860B');
        
        logger.log(`${fighter.name} activates ADAPTATION!`, 'combat');
    }
    
    // NOTE: The actual damage absorption logic needs to be hooked into fighter.takeDamage
    // Since Ability.onDamage is only for DEF abilities usually, we might need to rely on the Fighter class checking for this state
    // OR we can make the DEF ability aware of the ULT state if they share data.
    // BUT Fighter.js calls `abilities.def.onDamage`. It doesn't call ult.onDamage.
    // However, we can use the `activeEffects` on the fighter to communicate.
    // We will need to modify DivineGeneralDefAbility.onDamage to check for the ULT state.
}

// Re-write DEF ability to handle ULT interaction
export class DivineGeneralDefAbilityWithUlt extends DivineGeneralDefAbility {
    onDamage(fighter, damage, context) {
        // Prevent self-damage (e.g. from the wheel visual or any self-inflicted sources if miscalculated)
        if (context && context.attacker === fighter) {
             return 0;
        }

        // Check for ULT Invincibility/Absorption
        if (fighter.activeEffects.ultActive && fighter.activeEffects.adaptationAbsorbing) {
            // Absorb damage
            const absorbed = Math.min(damage, 30); // Max 30 per hit? Or total? "max 30" implies cap.
            // Let's assume max 30 TOTAL stored, or max 30 per hit. Prompt: "absorb damage (max 30)".
            // Usually means cap on the buff.
            
            fighter.activeEffects.adaptationStoredDamage = (fighter.activeEffects.adaptationStoredDamage || 0) + damage;
            if (fighter.activeEffects.adaptationStoredDamage > 30) {
                fighter.activeEffects.adaptationStoredDamage = 30;
            }
            
            // Blue popup for absorbed
            fighter.game.combatText.text(fighter.x, fighter.y - 40, `Absorb ${Math.ceil(damage)}`, '#00BFFF');
            
            // Invincible -> Return 0 damage
            return 0;
        }
        
        // Normal behavior
        return super.onDamage(fighter, damage, context);
    }
}