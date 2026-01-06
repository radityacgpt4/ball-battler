/**
 * Axeman Abilities
 * Contains specific logic for the Axeman fighter
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

export class AxeAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.range = 55;
        this.damage = 7;
        this.bleedDuration = 180; // 3 seconds
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
                        game.particles.spawnText(enemy.x, enemy.y, "BLOCKED!", "#ffffff");
                        audioEngine.playBlock();
                        fighter.cooldowns.atk = 20;
                    }
                    continue;
                }

                if (fighter.cooldowns.atk <= 0) {
                    // Hit connect
                    fighter.cooldowns.atk = 20; // Swing cooldown
                    
                    // Damage
                    enemy.takeDamage(this.damage);
                    game.particles.spawn(tipX, tipY, '#ff0000', 5);
                    audioEngine.playSwordSwing();
                    audioEngine.playHit();

                    // 1. Change rotation direction rapidly
                    fighter.rotationSpeed *= -1;
                    
                    // 2. Track consecutive hits
                    fighter.axemanHits = (fighter.axemanHits || 0) + 1;
                    fighter.axemanComboTimer = 60; // 1 second to land next hit (Strict window)
                    
                    game.particles.spawnText(fighter.x, fighter.y - 30, `${fighter.axemanHits} HIT!`, "#ff6b6b");

                    // 3. Bleed condition (If 2 consecutive hits connected)
                    if (fighter.axemanHits >= 2) {
                        enemy.applyStatus('BLEED', this.bleedDuration);
                        game.particles.spawnText(enemy.x, enemy.y, "BLEED", "#ff0000");
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
            const rotBonus = 1 + (stacks * 0.15);

            // We apply the multiplier to the ORIGINAL stats to avoid compounding infinite growth
            fighter.baseSpeed = fighter.originalBaseSpeed * speedBonus;
            
            // For rotation, we need to respect the current direction (sign)
            const currentDir = Math.sign(fighter.rotationSpeed) || 1;
            fighter.rotationSpeed = fighter.originalRotationSpeed * rotBonus * currentDir;
        } else {
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
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 30; // 0.5 second visual
        
        fighter.cooldowns.ult = this.cooldown;

        const { enemies, game } = context;
        const range = fighter.radius + 80; // Execution range
        
        // Find targets in range
        let hit = false;
        
        game.particles.spawnText(fighter.x, fighter.y, "EXECUTE!", "#ff0000");

        enemies.forEach(enemy => {
            if (enemy === fighter || enemy.isDead) return;
            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist <= range + enemy.radius) {
                hit = true;
                
                // Logic based on hits
                if ((fighter.axemanHits || 0) >= 2) {
                    if (enemy.hp <= 30) {
                        // Instant Kill
                        // Deal massive unblockable damage to ensure death
                        enemy.takeDamage(enemy.maxHp + 999, true); 
                        game.particles.spawnText(enemy.x, enemy.y, "FATALITY!", "#880000");
                        audioEngine.playHeavyImpact();
                    } else {
                        // Stun
                        enemy.takeDamage(10);
                        enemy.applyStatus('STUN', 120); // 2 sec
                        game.particles.spawnText(enemy.x, enemy.y, "STUNNED", "#ffff00");
                        audioEngine.playHeavyImpact();
                    }
                } else {
                    // Normal Ult Hit if combo not ready (fallback)
                    enemy.takeDamage(15);
                    game.particles.spawnText(enemy.x, enemy.y, "SMASH!", "#ffffff");
                    audioEngine.playHeavyImpact();
                }
                
                game.particles.spawnExplosion(enemy.x, enemy.y);
            }
        });
        
        if (!hit) {
            audioEngine.playSwordSwing(); // Whiff sound
        }
    }
}