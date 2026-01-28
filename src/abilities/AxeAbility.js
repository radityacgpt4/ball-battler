/**
 * Axeman Abilities
 *
 * ATK: Heavy Swing - Giant axe with bleed on combo
 * DEF: Berserker Rage - Speed scales with missing HP
 * ULT: Execution - Instant kill on low HP enemies
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { checkWeaponHit } from '../data/weaponGeometry.js';

export class AxeAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.range = config.range || 65;
        this.damage = config.damage || 9;
        this.bleedDuration = config.bleedDuration || 240;
        this.swingCooldown = config.swingCooldown || 15;
        this.blockedCooldown = config.blockedCooldown || 20;
        this.comboTimer = config.comboTimer || 90;
        this.comboThreshold = config.comboThreshold || 2;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        // Manage combo timer
        if (fighter.axemanComboTimer > 0) {
            fighter.axemanComboTimer--;
            if (fighter.axemanComboTimer <= 0) {
                fighter.axemanHits = 0;
            }
        }

        const { enemies, game } = context;

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            // Use weapon geometry registry for collision
            if (checkWeaponHit('AXEMAN_AXE', fighter, enemy)) {
                if (fighter.cooldowns.atk <= 0) {
                    // Check shield block (only when actually attacking)
                    if (enemy.isBlockedByShield(fighter.x, fighter.y, this.damage)) {
                        game.combatText.blocked(enemy.x, enemy.y - enemy.radius);
                        game.particles.spawn(enemy.x, enemy.y, '#ffffff', 5);
                        audioEngine.playBlock();
                        logger.log(`${enemy.name} blocked axe attack from ${fighter.name}`, 'combat');
                        fighter.cooldowns.atk = this.blockedCooldown;
                        continue;
                    }
                    fighter.cooldowns.atk = this.swingCooldown;

                    // Damage
                    enemy.takeDamage(this.damage, false, false, fighter);
                    const tipX = fighter.x + Math.cos(fighter.angle) * (fighter.radius + this.range);
                    const tipY = fighter.y + Math.sin(fighter.angle) * (fighter.radius + this.range);
                    game.particles.spawn(tipX, tipY, '#ff0000', 5);
                    audioEngine.playSwordSwing();
                    audioEngine.playHit();

                    // Change rotation direction
                    fighter.rotationSpeed *= -1;

                    // Track consecutive hits
                    fighter.axemanHits = (fighter.axemanHits || 0) + 1;
                    fighter.axemanComboTimer = this.comboTimer;

                    // Show combo hit text
                    game.combatText.combo(fighter.x, fighter.y - 30, fighter.axemanHits);
                    logger.log(`${fighter.name} combo: ${fighter.axemanHits} HIT!`, 'combat');

                    // Bleed condition
                    if (fighter.axemanHits >= this.comboThreshold) {
                        enemy.applyStatus('BLEED', this.bleedDuration);
                        game.combatText.bleed(enemy.x, enemy.y - enemy.radius);
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
        // All values from config (fighters.js)
        this.stackThreshold = config.stackThreshold || 0.1;
        this.speedBonusPerStack = config.speedBonusPerStack || 0.10;
        this.rotBonusPerStack = config.rotBonusPerStack || 0.18;

        this.initialized = false;
    }

    update(fighter, context) {
        if (!this.initialized) {
            fighter.originalBaseSpeed = fighter.baseSpeed;
            fighter.originalRotationSpeed = fighter.rotationSpeed;
            this.initialized = true;
        }

        const missingHpPct = (fighter.maxHp - fighter.hp) / fighter.maxHp;
        const stacks = Math.floor(missingHpPct / this.stackThreshold);

        if (stacks > 0) {
            const speedBonus = 1 + (stacks * this.speedBonusPerStack);
            const rotBonus = 1 + (stacks * this.rotBonusPerStack);

            fighter.baseSpeed = fighter.originalBaseSpeed * speedBonus;

            const currentDir = Math.sign(fighter.rotationSpeed) || 1;
            fighter.rotationSpeed = fighter.originalRotationSpeed * rotBonus * currentDir;

            if (fighter.lastBerserkerStacks !== stacks) {
                logger.log(`${fighter.name} BERSERKER RAGE! Stacks: ${stacks} (Speed: x${speedBonus.toFixed(2)}, Rot: x${rotBonus.toFixed(2)})`, 'info');
                fighter.lastBerserkerStacks = stacks;
            }
        } else {
            if (fighter.lastBerserkerStacks && fighter.lastBerserkerStacks > 0) {
                logger.log(`${fighter.name} Berserker Rage subsided.`, 'info');
                fighter.lastBerserkerStacks = 0;
            }
            const currentDir = Math.sign(fighter.rotationSpeed) || 1;
            fighter.baseSpeed = fighter.originalBaseSpeed;
            fighter.rotationSpeed = fighter.originalRotationSpeed * currentDir;
        }
    }
}

export class ExecuteUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.cooldown = config.cooldown || 60;
        this.executeRange = config.executeRange || 80;
        this.executeThreshold = config.executeThreshold || 30;
        this.stunDuration = config.stunDuration || 120;
        this.stunDamage = config.stunDamage || 10;
        this.ultVisualDuration = config.ultVisualDuration || 30;
        this.comboRequired = config.comboRequired || 2;
    }

    execute(fighter, context) {
        const { enemies, game } = context;
        const range = fighter.radius + this.executeRange;
        const hasCombo = (fighter.axemanHits || 0) >= this.comboRequired;

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
            return;
        }

        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = this.ultVisualDuration;
        fighter.cooldowns.ult = this.cooldown;

        game.combatText.execute(fighter.x, fighter.y);
        game.particles.spawn(fighter.x, fighter.y, '#ff0000', 10);
        logger.log(`${fighter.name} uses EXECUTE!`, 'combat');

        enemies.forEach(enemy => {
            if (enemy === fighter || enemy.isDead) return;
            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist <= range + enemy.radius) {
                if (enemy.hp <= this.executeThreshold) {
                    // Instant Kill - FATALITY
                    game.combatText.fatality(enemy.x, enemy.y - enemy.radius);
                    enemy.takeDamage(enemy.maxHp + 999, true, false, fighter);
                    audioEngine.playHeavyImpact();
                    logger.log(`${fighter.name} FATALITY on ${enemy.name}!`, 'error');
                } else {
                    // Stun
                    game.combatText.stunned(enemy.x, enemy.y - enemy.radius);
                    enemy.takeDamage(this.stunDamage, false, false, fighter);
                    enemy.applyStatus('STUN', this.stunDuration);
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
