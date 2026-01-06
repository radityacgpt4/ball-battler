/**
 * Special Abilities
 * Handles unique abilities like Wall Slam
 */
import { Ability } from './Ability.js';
import { audioEngine } from '../systems/Audio.js';

export class WallSlamAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.damage = config.damage;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.ultWallSlamActive = true;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 300; // 5 seconds

        // Increase Mass significantly
        fighter.mass = fighter.originalMass * 5.0;
        game.particles.spawnText(fighter.x, fighter.y, "ULTIMATE!", "#ffaa00");
        game.particles.spawnText(fighter.x, fighter.y + 20, "MASS UP!", "#8b5cf6");
        audioEngine.playHeavyImpact();

        // Activation burst
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            game.particles.particles.push({
                x: fighter.x, y: fighter.y,
                vx: Math.cos(angle) * 6,
                vy: Math.sin(angle) * 6,
                life: 1.0, decay: 0.04,
                size: 6, color: '#8b5cf6', type: 'dot'
            });
        }
        game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x, y: fighter.y,
            radius: fighter.radius,
            maxRadius: 120,
            life: 1.0,
            decay: 0.04,
            color: '#8b5cf6'
        });

        fighter.cooldowns.ult = this.cooldown;
    }
}

export class DoubleZapUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        // The actual raycast is handled by the fighter's updateUltimate
        // This just triggers the effect
        game.particles.spawnText(fighter.x, fighter.y, "ULTIMATE!", "#ffaa00");
        audioEngine.playThunder();

        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 120; // 2 seconds of storm

        fighter.cooldowns.ult = this.cooldown;
    }
}
