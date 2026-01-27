/**
 * Special Abilities
 * Handles unique abilities like Wall Slam
 */
import { Ability } from './Ability.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

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
        audioEngine.playHeavyImpact();
        logger.log(`${fighter.name} activated WALL SLAM! Mass increased!`, 'combat');

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

    stop(fighter, context) {
        fighter.ultWallSlamActive = false;
        fighter.mass = fighter.originalMass;
    }
}

export class DoubleZapUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        game.particles.spawn(fighter.x, fighter.y, '#00FFFF', 15);
        audioEngine.playThunder();
        logger.log(`${fighter.name} unleashed DOUBLE ZAP Storm!`, 'combat');

        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 120; // 2 seconds of storm

        fighter.cooldowns.ult = this.cooldown;
    }

    update(fighter, context) {
        if (!fighter.activeEffects.ultActive) return;
        const { enemies, game } = context;

        if (fighter.activeEffects.ultTimer % 10 === 0) {
            const rx = fighter.x + (Math.random() - 0.5) * 300;
            const ry = fighter.y + (Math.random() - 0.5) * 300;
            game.particles.spawnBolt([{ x: rx, y: ry - 200 }, { x: rx, y: ry }], '#ffaa00');
            audioEngine.playZap();
            enemies.forEach(e => {
                if (e !== fighter && !e.isDead && Physics.dist(rx, ry, e.x, e.y) < e.radius + 20) {
                    e.takeDamage(5);
                    e.applyStatus('STUN');
                }
            });
        }
    }
}
