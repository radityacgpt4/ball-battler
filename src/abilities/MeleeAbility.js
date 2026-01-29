/**
 * Melee Ability
 *
 * Handles melee attacks like Sword Master's sword swings
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { checkWeaponHit, checkWeaponHitTower } from '../data/weaponGeometry.js';

export class MeleeAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.range = config.range || 50;
        this.damage = config.damage || 5;
        this.procRate = config.procRate || 3;
        this.attackCooldown = config.attackCooldown || 20;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        const { enemies, game } = context;

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            // Use weapon geometry registry for collision
            if (checkWeaponHit('SWORD_MASTER_BLADE', fighter, enemy)) {
                if (fighter.cooldowns.atk <= 0) {
                    // Check if blocked by shield (only when actually attacking)
                    if (enemy.isBlockedByShield(fighter.x, fighter.y, this.damage)) {
                        const shieldX = enemy.x + Math.cos(enemy.angle) * (enemy.radius + 8);
                        const shieldY = enemy.y + Math.sin(enemy.angle) * (enemy.radius + 8);
                        game.combatText.blocked(enemy.x, enemy.y - enemy.radius);
                        game.particles.spawn(shieldX, shieldY, '#8b5cf6', 8);
                        audioEngine.playBlock();
                        logger.log(`${enemy.name} blocked attack from ${fighter.name}`, 'combat');
                        fighter.cooldowns.atk = this.attackCooldown;
                        continue;
                    }
                    fighter.meleeHits++;
                    enemy.takeDamage(this.damage, false, false, fighter);

                    const tipX = fighter.x + Math.cos(fighter.angle) * (fighter.radius + this.range);
                    const tipY = fighter.y + Math.sin(fighter.angle) * (fighter.radius + this.range);
                    game.particles.spawn(tipX, tipY, '#fff', 5);

                    audioEngine.playSwordSwing();
                    audioEngine.playHit();
                    logger.log(`${fighter.name} hit ${enemy.name} for ${this.damage} dmg`, 'combat');
                    fighter.cooldowns.atk = this.attackCooldown;

                    if (fighter.meleeHits % this.procRate === 0) {
                        enemy.applyStatus('BLEED', null, fighter);
                        game.combatText.bleed(enemy.x, enemy.y - enemy.radius);
                        game.particles.spawn(enemy.x, enemy.y, '#ff0000', 5);
                        logger.log(`${enemy.name} is BLEEDING!`, 'status');
                    }
                }
            }
        }

        // --- TOWER COLLISION (Ballista Defensive Towers) ---
        for (const ent of game.entities) {
            if (!ent.ballistaTowers || ent.ballistaTowers.length === 0) continue;
            if (ent.id === fighter.id) continue;

            for (const tower of ent.ballistaTowers) {
                if (tower.hp <= 0) continue;
                if (fighter.cooldowns.atk > 0) continue;

                if (checkWeaponHitTower('SWORD_MASTER_BLADE', fighter, tower, this.damage, game)) {
                    fighter.cooldowns.atk = this.attackCooldown;
                    break; // One tower per attack cycle
                }
            }
        }
    }
}
