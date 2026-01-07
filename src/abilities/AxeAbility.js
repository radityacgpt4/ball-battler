/**
 * Axeman Abilities
 * Contains specific logic for the Axeman fighter
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class AxeAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.range = 65;
        this.damage = 9;
        this.bleedDuration = 240; // 4 seconds
    }

    update(fighter, context) {
        // Manage combo timer
        if (fighter.axemanComboTimer > 0) {
            fighter.axemanComboTimer--;
            if (fighter.axemanComboTimer <= 0) {
                fighter.axemanHits = 0;
                // Optional: visual feedback for combo reset
            }
        }

        const { enemies, game } = context;
        const range = fighter.radius + this.range;
        const tipX = fighter.x + Math.cos(fighter.angle) * range;
        const tipY = fighter.y + Math.sin(fighter.angle) * range;

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            
            if (Physics.lineCircleIntersect(fighter.x, fighter.y, tipX, tipY, enemy.x, enemy.y, enemy.radius + 5)) {
                 if (enemy.isBlockedByShield(tipX, tipY)) {
                    if (fighter.cooldowns.atk <= 0) {
                        game.particles.spawn(enemy.x, enemy.y, '#ffffff', 5);
                        audioEngine.playBlock();
                        fighter.cooldowns.atk = 20;
                    }
                    continue;
                }

                if (fighter.cooldowns.atk <= 0) {
                    // Hit connect
                    fighter.cooldowns.atk = 15; // Swing cooldown
                    
                    // Damage
                    enemy.takeDamage(this.damage);
                    game.particles.spawn(tipX, tipY, '#ff0000', 5);
                    audioEngine.playSwordSwing();
                    audioEngine.playHit();

                    // 1. Change rotation direction rapidly
                    fighter.rotationSpeed *= -1;
                    
                    // 2. Track consecutive hits
                    fighter.axemanHits = (fighter.axemanHits || 0) + 1;
                    fighter.axemanComboTimer = 90; // 1.5 second to land next hit

                    // 3. Bleed condition (If 2 consecutive hits connected)
                    if (fighter.axemanHits >= 2) {
                       enemy.applyStatus('BLEED', this.bleedDuration);
                       game.particles.spawn(enemy.x, enemy.y, '#ff0000', 5);
                       logger.log(`${enemy.name} is BLEEDING from Axeman combo!`, 'status');
                   }
               }
            }
        }
    }
}

export class BerserkerDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.initialized = false;
    }

    update(fighter, context) {
        if (!this.initialized) {
            fighter.originalBaseSpeed = fighter.baseSpeed;
            fighter.originalRotationSpeed = fighter.rotationSpeed;
            this.initialized = true;
        }

        const missingHpPct = (fighter.maxHp - fighter.hp) / fighter.maxHp;
        const stacks = Math.floor(missingHpPct / 0.1); // Each 10%

        if (stacks > 0) {
            const speedBonus = 1 + (stacks * 0.10);
            const rotBonus = 1 + (stacks * 0.18);

            // We apply the multiplier to the ORIGINAL stats to avoid compounding infinite growth
            fighter.baseSpeed = fighter.originalBaseSpeed * speedBonus;
            
            // For rotation, we need to respect the current direction (sign)
            const currentDir = Math.sign(fighter.rotationSpeed) || 1;
            fighter.rotationSpeed = fighter.originalRotationSpeed * rotBonus * currentDir;

            // Log Berserker state change (throttle to avoid spam)
            if (fighter.lastBerserkerStacks !== stacks) {
                logger.log(`${fighter.name} BERSERKER RAGE! Stacks: ${stacks} (Speed: x${speedBonus.toFixed(2)}, Rot: x${rotBonus.toFixed(2)})`, 'info');
                fighter.lastBerserkerStacks = stacks;
            }
        } else {
            if (fighter.lastBerserkerStacks && fighter.lastBerserkerStacks > 0) {
                logger.log(`${fighter.name} Berserker Rage subsided.`, 'info');
                fighter.lastBerserkerStacks = 0;
            }
            // Reset to base
            const currentDir = Math.sign(fighter.rotationSpeed) || 1;
            fighter.baseSpeed = fighter.originalBaseSpeed;
            fighter.rotationSpeed = fighter.originalRotationSpeed * currentDir;
        }
    }
}

export class ExecuteUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 180;
    }

    execute(fighter, context) {
        const { enemies, game } = context;
        const range = fighter.radius + 80; // Execution range
        const hasCombo = (fighter.axemanHits || 0) >= 2;

        // Check if any enemy is in range first
        let targetInRange = false;
        enemies.forEach(enemy => {
            if (enemy === fighter || enemy.isDead) return;
            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist <= range + enemy.radius) {
                targetInRange = true;
            }
        });

        // Only proceed if combo requirement met AND target in range
        if (!hasCombo || !targetInRange) {
            return; // No cooldown triggered, silently skip
        }

        // Combo ready AND target in range - execute!
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 30; // 0.5 second visual
        fighter.cooldowns.ult = this.cooldown; // NOW apply cooldown

        game.particles.spawn(fighter.x, fighter.y, '#ff0000', 10);

        enemies.forEach(enemy => {
            if (enemy === fighter || enemy.isDead) return;
            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist <= range + enemy.radius) {
                if (enemy.hp <= 30) {
                    // Instant Kill - FATALITY
                    enemy.takeDamage(enemy.maxHp + 999, true);
                    audioEngine.playHeavyImpact();
                } else {
                    // Stun
                    enemy.takeDamage(10);
                    enemy.applyStatus('STUN', 120); // 2 sec
                    audioEngine.playHeavyImpact();
                }

                game.particles.spawnExplosion(enemy.x, enemy.y);
            }
        });

        // Reset combo after successful execute
        fighter.axemanHits = 0;
        fighter.axemanComboTimer = 0;
    }
}
