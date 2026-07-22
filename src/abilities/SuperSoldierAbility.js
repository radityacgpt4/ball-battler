/**
 * Super Soldier Abilities
 *
 * ATK: Shield Throw   - A ricocheting shield that ramps damage per bounce and
 *                       returns to hand. Re-throw is gated on the shield returning.
 * DEF: Vibranium Guard- Wide front arc that blocks & reflects projectiles
 *                       (reuses the generic SHIELD_DEFLECT type, no custom class).
 * ULT: Mjolnir Throw  - Hurls Mjolnir in a cone along the shield's heading.
 *                       Direct hits deal heavy damage; striking the airborne
 *                       shield mid-air detonates a stunning shockwave.
 *
 * ALL configurable properties are loaded from fighters.js (Open-Closed).
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { ShieldRenderer, MjolnirRenderer } from '../components/ProjectileRenderers.js';
import { ShieldThrowBehavior, MjolnirBehavior } from '../components/ProjectileBehaviors.js';

// --- ATK: SHIELD THROW ---
export class SuperSoldierAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.config = config;
        this.cooldown = config.cooldown || 90;
        this.speed = config.speed || 11;
        this.radius = config.radius || 9;
        this.knockback = config.knockback || 4;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;
        if (fighter.shieldOut) return;          // Return-gated: only one shield in play
        if (fighter.cooldowns.atk > 0) return;  // Recovery buffer after catch
        this.execute(fighter, context);
    }

    execute(fighter, context) {
        const { game, enemies } = context;

        // Aim at nearest enemy
        let target = null, min = Infinity;
        for (const e of enemies) {
            if (e === fighter || e.isDead) continue;
            const d = Physics.dist(fighter.x, fighter.y, e.x, e.y);
            if (d < min) { min = d; target = e; }
        }
        const angle = target
            ? Math.atan2(target.y - fighter.y, target.x - fighter.x)
            : fighter.angle;

        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(angle) * 20,
            fighter.y + Math.sin(angle) * 20,
            angle,
            this.speed,
            this.config.baseDamage || 8,
            game
        );
        p.radius = this.radius;
        p.knockbackForce = this.knockback;
        p.impactSound = 'hit';
        p.renderer = new ShieldRenderer();
        p.addComponent(new ShieldThrowBehavior(this.config));

        game.projectiles.push(p);

        // Track shield state for the return-gate and the Mjolnir combo
        fighter.shieldOut = true;
        fighter.activeShieldProjectile = p;
        fighter.lastShieldDir = angle;

        audioEngine.playSwordSwing();
        game.particles.spawn(fighter.x, fighter.y, '#3d5a9e', 6);
    }
}

// --- ULT: MJOLNIR THROW ---
export class SuperSoldierUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.config = config;
        this.cooldown = config.cooldown || 180;
        this.speed = config.speed || 13;
        this.radius = config.radius || 10;
        this.coneSpread = config.coneSpread || 0.45; // radians
    }

    // Uses the base Ability.canUse ult rule: only triggers once HP drops below
    // the 50% threshold (and off cooldown / not stunned).

    execute(fighter, context) {
        const { game, enemies } = context;

        // Base heading follows the shield: aim at the live shield if airborne,
        // else reuse the last shield direction, else fall back to nearest enemy.
        let baseAngle;
        const shield = fighter.activeShieldProjectile;
        if (fighter.shieldOut && shield && shield.active) {
            baseAngle = Math.atan2(shield.y - fighter.y, shield.x - fighter.x);
        } else if (fighter.lastShieldDir !== undefined) {
            baseAngle = fighter.lastShieldDir;
        } else {
            let target = null, min = Infinity;
            for (const e of enemies) {
                if (e === fighter || e.isDead) continue;
                const d = Physics.dist(fighter.x, fighter.y, e.x, e.y);
                if (d < min) { min = d; target = e; }
            }
            baseAngle = target
                ? Math.atan2(target.y - fighter.y, target.x - fighter.x)
                : fighter.angle;
        }

        // Cone spread (slight randomness biases toward intersecting the shield)
        const angle = baseAngle + (Math.random() - 0.5) * this.coneSpread;

        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(angle) * 20,
            fighter.y + Math.sin(angle) * 20,
            angle,
            this.speed,
            this.config.directDamage || 28,
            game
        );
        p.radius = this.radius;
        p.renderer = new MjolnirRenderer();
        p.addComponent(new MjolnirBehavior(this.config));

        game.projectiles.push(p);

        game.particles.spawn(fighter.x, fighter.y, '#7db8ff', 8);
        audioEngine.play('explosion');
        logger.log(`${fighter.name} hurls Mjolnir!`, 'combat');

        fighter.cooldowns.ult = this.cooldown;
        fighter.maxCooldowns.ult = this.cooldown;
    }
}
