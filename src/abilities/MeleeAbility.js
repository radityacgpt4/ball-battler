/**
 * Melee Ability
 * Handles melee attacks like Sword Master's sword swings
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class MeleeAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.range = config.range;
        this.damage = config.damage;
        this.procRate = config.procRate;
    }

    update(fighter, context) {
        const { enemies, game } = context;
        const range = fighter.radius + this.range;
        const tipX = fighter.x + Math.cos(fighter.angle) * range;
        const tipY = fighter.y + Math.sin(fighter.angle) * range;

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            if (Physics.lineCircleIntersect(fighter.x, fighter.y, tipX, tipY, enemy.x, enemy.y, enemy.radius + 5)) {
                // Check if blocked by shield - use sword tip position
                if (enemy.isBlockedByShield(tipX, tipY)) {
                    if (fighter.cooldowns.atk <= 0) {
                        game.particles.spawnText(enemy.x, enemy.y, "BLOCKED!", "#ffffff");
                        const shieldX = enemy.x + Math.cos(enemy.angle) * (enemy.radius + 8);
                        const shieldY = enemy.y + Math.sin(enemy.angle) * (enemy.radius + 8);
                        game.particles.spawn(shieldX, shieldY, '#8b5cf6', 8);
                        audioEngine.playBlock();
                        logger.log(`${enemy.name} blocked attack from ${fighter.name}`, 'combat');
                        fighter.cooldowns.atk = 20;
                    }
                    continue;
                }

                if (fighter.cooldowns.atk <= 0) {
                    fighter.meleeHits++;
                    enemy.takeDamage(this.damage);
                    game.particles.spawn(tipX, tipY, '#fff', 5);
                    audioEngine.playSwordSwing();
                    audioEngine.playHit();
                    logger.log(`${fighter.name} hit ${enemy.name} for ${this.damage} dmg`, 'combat');
                    fighter.cooldowns.atk = 20;

                    if (fighter.meleeHits % this.procRate === 0) {
                        enemy.applyStatus('BLEED');
                        game.particles.spawnText(enemy.x, enemy.y, "BLEED", "#ff0000");
                        logger.log(`${enemy.name} is BLEEDING!`, 'status');
                    }
                }
            }
        }
    }
}
