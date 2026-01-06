/**
 * Ballista Abilities
 * Heavy hitter ranged fighter with knockback mechanics
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

export class BallistaAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.damage = config.damage || 15;
        this.projectileSpeed = config.projectileSpeed || 16;
    }

    update(fighter, context) {
        const { game } = context;

        if (fighter.cooldowns.atk <= 0) {
            fighter.cooldowns.atk = this.cooldown;

            // Fire 2 bolts in small cone pattern
            const spreadAngle = 0.12; // ~7 degrees spread
            const angles = [fighter.angle - spreadAngle, fighter.angle + spreadAngle];

            angles.forEach((angle) => {
                const p = new Projectile(
                    fighter,
                    fighter.x + Math.cos(angle) * 30,
                    fighter.y + Math.sin(angle) * 30,
                    angle,
                    this.projectileSpeed,
                    this.damage,
                    game
                );

                p.isBallistaBolt = true;
                p.radius = 8;
                p.dragTarget = null;
                p.dragDuration = 25;

                game.projectiles.push(p);
            });

            game.particles.spawn(fighter.x + Math.cos(fighter.angle) * 30, fighter.y + Math.sin(fighter.angle) * 30, '#8B4513', 4);
            audioEngine.playGunshot();
        }
    }
}

export class BallistaDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.maxStunDuration = 45; // 0.75 seconds at 60fps
    }

    onDamage(fighter, amount, context) {
        const { game, isDoT } = context;

        // Don't trigger dash-back for DoT damage (bleed, etc)
        if (isDoT) {
            return amount;
        }

        // Dash back slightly on direct hit
        const dashBackDist = 35;
        const oldX = fighter.x;
        const oldY = fighter.y;
        const angle = fighter.angle + Math.PI; // Opposite direction

        fighter.x += Math.cos(angle) * dashBackDist;
        fighter.y += Math.sin(angle) * dashBackDist;

        // Keep in bounds
        const bounds = game.arenaBounds;
        fighter.x = Math.max(bounds.x + fighter.radius, Math.min(bounds.x + bounds.width - fighter.radius, fighter.x));
        fighter.y = Math.max(bounds.y + fighter.radius, Math.min(bounds.y + bounds.height - fighter.radius, fighter.y));

        // Particle trail effect for dash-back
        for (let i = 0; i < 6; i++) {
            const t = i / 6;
            const px = oldX + (fighter.x - oldX) * t;
            const py = oldY + (fighter.y - oldY) * t;
            game.particles.particles.push({
                x: px,
                y: py,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 0.6,
                decay: 0.08,
                size: 4 + Math.random() * 3,
                color: '#8B4513',
                type: 'dot'
            });
        }

        // Dust cloud at landing spot
        game.particles.spawn(fighter.x, fighter.y, '#D2691E', 5);
        game.particles.spawnText(fighter.x, fighter.y - 20, "RECOIL", "#8B4513");
        audioEngine.playBounce();

        return amount; // Still take damage
    }

    update(fighter, context) {
        // Reduce stun duration if > 0.75 seconds
        if (fighter.status.stun > this.maxStunDuration) {
            fighter.status.stun = this.maxStunDuration;
            context.game.particles.spawnText(fighter.x, fighter.y, "RESIST!", "#8B4513");
        }
    }
}

export class BallistaUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 150;
        this.damage = config.damage || 15;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.ult = this.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 30;

        // Fire 3 bolts in wider cone pattern
        const spreadAngle = 0.2; // ~12 degrees spread
        const angles = [
            fighter.angle - spreadAngle,
            fighter.angle,
            fighter.angle + spreadAngle
        ];

        angles.forEach((angle, index) => {
            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(angle) * 30,
                fighter.y + Math.sin(angle) * 30,
                angle,
                18, // Faster ult bolts
                this.damage,
                game
            );

            p.isBallistaBolt = true;
            p.isUltBolt = true;
            p.radius = 10;
            p.dragTarget = null;
            p.dragDuration = 30;
            p.boltIndex = index;

            game.projectiles.push(p);
        });

        game.particles.spawnText(fighter.x, fighter.y, "TRIPLE SHOT!", "#8B4513");
        audioEngine.playHeavyImpact();
    }
}
