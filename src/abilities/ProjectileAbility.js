/**
 * Projectile Abilities
 *
 * Burst Fire, Kunai, Grenade, Missile Barrage
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class BurstFireAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.count = config.count || 10;
        this.damage = config.damage || 3;
        this.projectileSpeed = config.projectileSpeed || 15;
        this.spreadAmount = config.spreadAmount || 0.1;
        this.burstDelay = config.burstDelay || 2;
    }

    update(fighter, context) {
        const { game, timeScale } = context;

        if (fighter.cooldowns.atk <= 0 && fighter.activeEffects.burstCount === 0) {
            fighter.activeEffects.burstCount = this.count;
            if (fighter.activeEffects.ultActive) fighter.activeEffects.burstCount *= 2;
            fighter.cooldowns.atk = this.cooldown;
        }

        if (fighter.activeEffects.burstCount > 0) {
            if (fighter.activeEffects.burstTimer > 0) {
                fighter.activeEffects.burstTimer -= 1 * timeScale;
            } else {
                const spread = (Math.random() - 0.5) * this.spreadAmount;
                const p = new Projectile(
                    fighter,
                    fighter.x + Math.cos(fighter.angle) * 25,
                    fighter.y + Math.sin(fighter.angle) * 25,
                    fighter.angle + spread,
                    this.projectileSpeed,
                    this.damage,
                    game
                );
                game.projectiles.push(p);
                game.particles.spawn(p.x, p.y, '#ffff00', 2);
                audioEngine.playGunshot();

                fighter.activeEffects.burstCount--;
                fighter.activeEffects.burstTimer = this.burstDelay;
            }
        }
    }
}

export class KunaiAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.count = config.count || 2;
        this.damage = config.damage || 5;
        this.delay = config.delay || 90;
        this.zapStunDuration = config.zapDuration || 45;
        this.zapImmunityDuration = config.zapImmunityDuration || 60;
        this.kunaiSpeed = config.kunaiSpeed || 7;
        this.kunaiSpeedVariance = config.kunaiSpeedVariance || 2;
        this.coneAngle = config.coneAngle || Math.PI;
        this.maxDist = config.maxDist || 220;
        this.maxDistVariance = config.maxDistVariance || 50;
    }

    canUse(fighter, context) {
        return super.canUse(fighter, context);
    }

    execute(fighter, context, isUlt = false) {
        const { game } = context;
        const count = isUlt ? 5 : this.count;

        fighter.cooldowns.atk = this.cooldown;
        fighter.teleportDelayTimer = this.delay;
        fighter.kunaiPending = [];

        for (let i = 0; i < count; i++) {
            let throwAngle;
            let speed;

            if (isUlt) {
                throwAngle = fighter.angle + ((Math.PI * 2) / count) * i;
                speed = 9;
            } else {
                const offset = (Math.random() - 0.5) * this.coneAngle;
                throwAngle = fighter.angle + offset;
                speed = this.kunaiSpeed + Math.random() * this.kunaiSpeedVariance;
            }

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(fighter.angle) * 20,
                fighter.y + Math.sin(fighter.angle) * 20,
                throwAngle,
                speed,
                this.damage,
                game
            );

            p.isKunai = true;
            p.isUlt = isUlt;
            p.radius = 6;
            p.maxDist = this.maxDist + Math.random() * this.maxDistVariance;

            game.projectiles.push(p);
            fighter.kunaiPending.push(p);
            audioEngine.playKunaiThrow();
        }
        game.particles.spawn(fighter.x, fighter.y, '#ffd700', 8);
    }

    update(fighter, context) {
        const { game, enemies } = context;

        // Check for electricity zap between embedded kunai
        if (fighter.kunaiPending && fighter.kunaiPending.length >= 2) {
            const embeddedKunai = fighter.kunaiPending.filter(k => k.isEmbedded && k.active !== false);

            if (embeddedKunai.length >= 2) {
                for (let i = 0; i < embeddedKunai.length - 1; i++) {
                    const k1 = embeddedKunai[i];
                    const k2 = embeddedKunai[i + 1];

                    if (k1.isUlt || k2.isUlt) continue;

                    // Visual: continuous lightning bolt between kunai
                    if (Math.random() < 0.15) {
                        game.particles.spawnBolt([{ x: k1.x, y: k1.y }, { x: k2.x, y: k2.y }], '#00FFFF', 3);
                    }

                    // Check if enemies cross the line
                    for (const enemy of enemies) {
                        if (enemy === fighter || enemy.isDead) continue;
                        if (enemy.kunaiZapImmune > 0) continue;

                        if (Physics.lineCircleIntersect(k1.x, k1.y, k2.x, k2.y, enemy.x, enemy.y, enemy.radius)) {
                            enemy.applyStatus('STUN', this.zapStunDuration);
                            enemy.kunaiZapImmune = this.zapImmunityDuration;
                            game.particles.spawnBolt([{ x: k1.x, y: k1.y }, { x: enemy.x, y: enemy.y }, { x: k2.x, y: k2.y }], '#00FFFF', 3);
                            audioEngine.playZap();
                        }
                    }
                }
            }
        }

        // Decrease zap immunity
        for (const enemy of enemies) {
            if (enemy.kunaiZapImmune > 0) {
                enemy.kunaiZapImmune--;
            }
        }

        if (this.canUse(fighter, context)) {
            this.execute(fighter, context, false);
        }
    }
}

export class GrenadeAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.damage = config.damage || 20;
        this.explosionRadius = config.explosionRadius || 80;
        this.airTime = config.airTime || 60;
        this.maxDistance = config.maxDistance || 400;
        this.radius = config.radius || 6;
    }

    execute(fighter, context) {
        const { enemies, game } = context;
        const target = enemies.find(e => e !== fighter && !e.isDead);
        let dist = 300;
        if (target) dist = Physics.dist(fighter.x, fighter.y, target.x, target.y);

        dist = Math.min(dist, this.maxDistance);

        const speed = dist / this.airTime;

        const p = new Projectile(
            fighter,
            fighter.x,
            fighter.y,
            fighter.angle,
            speed,
            this.damage,
            game
        );

        p.radius = this.radius;
        p.isGrenade = true;
        p.explosionRadius = this.explosionRadius;
        p.z = 10;
        // Calculate vz so it lands exactly at t = airTime
        // 0 = 10 + v0*t - 0.5*0.5*t^2  => v0 = 0.25*t - 10/t
        const t = this.airTime;
        p.vz = 0.25 * t - 10 / t;

        // Store destination for hit indicator (cosmetic only)
        p.destX = fighter.x + Math.cos(fighter.angle) * dist;
        p.destY = fighter.y + Math.sin(fighter.angle) * dist;

        game.projectiles.push(p);
        audioEngine.playGrenadeThrow();

        logger.log(`${fighter.name} threw a GRENADE!`, 'combat');

        fighter.cooldowns.ult = this.cooldown;
    }
}

export class MissileBarrageAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.count = config.count || 5;
        this.damage = config.damage || 9;
        this.spreadAngle = config.spreadAngle || 0.5;
        this.projectileSpeed = config.projectileSpeed || 6;
        this.turnSpeed = config.turnSpeed || 0.08;
        this.radius = config.radius || 5;
    }

    execute(fighter, context) {
        const { game } = context;

        for (let i = 0; i < this.count; i++) {
            const spread = (i - (this.count - 1) / 2) * this.spreadAngle;
            const angle = fighter.angle + spread;

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(angle) * 20,
                fighter.y + Math.sin(angle) * 20,
                angle,
                this.projectileSpeed,
                this.damage,
                game
            );

            p.isMissile = true;
            p.radius = this.radius;
            p.turnSpeed = this.turnSpeed;

            game.projectiles.push(p);
        }

        audioEngine.playMissileLaunch();
        fighter.cooldowns.ult = this.cooldown;
        game.particles.spawn(fighter.x, fighter.y, '#ff4400', 10);
        logger.log(`${fighter.name} launched Missile Barrage!`, 'combat');
    }
}
