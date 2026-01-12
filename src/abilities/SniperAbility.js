/**
 * Sniper Abilities
 *
 * ATK: Sniper Shot - High damage shot with stun
 * DEF: Claymore - Trap that slows and damages
 * ULT: Steady Aim - Mode that makes shots unblockable
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

export class SniperAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.cooldown = config.cooldown || 90;
        this.damage = config.damage || 12;
        this.stunDuration = config.stun || 60;
        this.projectileSpeed = config.projectileSpeed || 20;
        this.projectileRadius = config.projectileRadius || 5;
        this.ultProjectileRadius = config.ultProjectileRadius || 8;
        this.recoilForce = config.recoilForce || 5;
        this.laserMaxDist = config.laserMaxDist || 800;

        this.laserColor = '#ff0000';
    }

    update(fighter, context) {
        const { game } = context;

        // Sync laser color with Ult state
        this.laserColor = fighter.activeEffects.ultActive ? '#00ff00' : '#ff0000';

        if (fighter.cooldowns.atk <= 0) {
            this.updateLaserSight(fighter, game);
            this.checkLaserTrigger(fighter, context);
        } else {
            fighter.laserDist = 0;
        }
    }

    updateLaserSight(fighter, game) {
        const angle = fighter.angle;
        const bounds = game.arenaBounds;
        const hit = Physics.rayBoxIntersect(fighter.x, fighter.y, Math.cos(angle), Math.sin(angle), bounds.x, bounds.y, bounds.width, bounds.height);

        if (hit) {
            fighter.laserDist = hit.dist;
        } else {
            fighter.laserDist = this.laserMaxDist;
        }
        fighter.laserColor = this.laserColor;
    }

    checkLaserTrigger(fighter, context) {
        const { enemies, game } = context;
        const angle = fighter.angle;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const hit = Physics.rayCircleIntersect(fighter.x, fighter.y, dirX, dirY, enemy.x, enemy.y, enemy.radius);

            if (hit) {
                const distToEnemy = hit.dist;
                const bounds = game.arenaBounds;
                const wallHit = Physics.rayBoxIntersect(fighter.x, fighter.y, dirX, dirY, bounds.x, bounds.y, bounds.width, bounds.height);

                if (!wallHit || wallHit.dist > distToEnemy) {
                    this.execute(fighter, context);
                    break;
                }
            }
        }
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.atk = this.cooldown;

        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(fighter.angle) * 20,
            fighter.y + Math.sin(fighter.angle) * 20,
            fighter.angle,
            this.projectileSpeed,
            this.damage,
            game
        );

        p.isSniperShot = true;
        p.stunDuration = this.stunDuration;
        p.radius = this.projectileRadius;

        // Check for ULT buff
        if (fighter.activeEffects.ultActive) {
            p.isUnblockable = true;
            p.isSniperUltShot = true; // Distinct visual flag
            p.radius = this.ultProjectileRadius;
            this.laserColor = '#00ff00';
        } else {
            this.laserColor = '#ff0000';
        }

        game.projectiles.push(p);

        audioEngine.playGunshot();
        game.particles.spawn(fighter.x, fighter.y, '#ffffff', 5);

        // Recoil
        fighter.dx -= Math.cos(fighter.angle) * this.recoilForce;
        fighter.dy -= Math.sin(fighter.angle) * this.recoilForce;
    }
}

export class ClaymoreAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.cooldown = config.cooldown || 180;
        this.damage = config.damage || 5;
        this.lifeTime = config.lifeTime || 360;
        this.slowDuration = config.slowDuration || 120;
        this.triggerRadius = config.triggerRadius || 10;
        this.slideSpeed = config.slideSpeed || 2;
    }

    update(fighter, context) {
        if (this.canUse(fighter, context)) {
            this.execute(fighter, context);
        }
    }

    execute(fighter, context) {
        const { game } = context;
        fighter.cooldowns.def = this.cooldown;

        const p = new Projectile(
            fighter,
            fighter.x,
            fighter.y,
            fighter.angle + Math.PI,
            this.slideSpeed,
            this.damage,
            game
        );

        p.isClaymore = true;
        p.lifeTime = this.lifeTime;
        p.slowDuration = this.slowDuration;
        p.radius = this.triggerRadius;

        game.projectiles.push(p);
        audioEngine.playTone(600, 'sine', 0.1, 0.1);
    }
}

export class SniperUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.duration = config.duration || 600;
        this.cooldown = config.cooldown || 300;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = this.duration;
        fighter.cooldowns.ult = this.cooldown;

        game.particles.spawn(fighter.x, fighter.y, '#00ff00', 10);
        audioEngine.playPowerUp();

        // Update Laser Color immediately
        if (fighter.abilities.atk instanceof SniperAtkAbility) {
            fighter.abilities.atk.laserColor = '#00ff00';
        }
    }
}
