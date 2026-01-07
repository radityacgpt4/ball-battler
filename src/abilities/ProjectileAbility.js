/**
 * Projectile Ability
 * Handles burst fire, kunai throws, and grenades
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class BurstFireAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.count = config.count;
        this.damage = config.damage;
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
                const spread = (Math.random() - 0.5) * 0.1;
                const p = new Projectile(
                    fighter,
                    fighter.x + Math.cos(fighter.angle) * 25,
                    fighter.y + Math.sin(fighter.angle) * 25,
                    fighter.angle + spread,
                    15,
                    this.damage,
                    game
                );
                game.projectiles.push(p);
                game.particles.spawn(p.x, p.y, '#ffff00', 2);
                audioEngine.playGunshot();

                fighter.activeEffects.burstCount--;
                fighter.activeEffects.burstTimer = 2;
            }
        }
    }
}

export class KunaiAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.count = config.count;
        this.damage = config.damage;
        this.delay = config.delay;
        this.zapStunDuration = config.zapDuration || 30; // 0.5 second stun
        this.zapImmunityDuration = 60; // 1 second immunity
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

        const coneAngle = Math.PI / 1; // 60 degrees for Normal atk

        for (let i = 0; i < count; i++) {
            let throwAngle;
            let speed;

            if (isUlt) {
                // ULT: 360 Degree Spread (Evenly spaced)
                throwAngle = fighter.angle + ((Math.PI * 2) / count) * i;
                speed = 9;
            } else {
                // NORMAL: Random Cone in front
                const offset = (Math.random() - 0.5) * coneAngle;
                throwAngle = fighter.angle + offset;
                speed = 7 + Math.random() * 2;
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

            // Kunai specific props
            p.isKunai = true;
            p.isUlt = isUlt;
            p.radius = 6;
            p.maxDist = 220 + Math.random() * 50;

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
                // Draw electricity and check for hits between pairs
                for (let i = 0; i < embeddedKunai.length - 1; i++) {
                    const k1 = embeddedKunai[i];
                    const k2 = embeddedKunai[i + 1];

                    // Skip if either kunai is from Ultimate (Rasengan instead)
                    if (k1.isUlt || k2.isUlt) continue;

                    // Skip if either kunai is from Ultimate (Rasengan instead)
                    if (k1.isUlt || k2.isUlt) {
                        // Rasengan Effect (Bomb/Swirl) for ULT Kunai
                        if (Math.random() < 0.3) {
                            const k = k1.isUlt ? k1 : k2;
                            game.particles.particles.push({
                                x: k.x, y: k.y,
                                vx: (Math.random() - 0.5) * 2,
                                vy: (Math.random() - 0.5) * 2,
                                life: 0.5, decay: 0.05,
                                size: 3, color: '#00BFFF',
                                type: 'dot'
                            });
                        }
                        continue;
                    }

                    // Skip if either kunai is from Ultimate (Rasengan instead)
                    if (k1.isUlt || k2.isUlt) {
                        // Rasengan Effect (Bomb/Swirl) for ULT Kunai
                        if (Math.random() < 0.3) {
                            const k = k1.isUlt ? k1 : k2;
                            game.particles.particles.push({
                                x: k.x, y: k.y,
                                vx: (Math.random() - 0.5) * 2,
                                vy: (Math.random() - 0.5) * 2,
                                life: 0.5, decay: 0.05,
                                size: 3, color: '#00BFFF',
                                type: 'dot'
                            });
                        }
                        continue;
                    }

                    // Visual: continuous lightning bolt between kunai (Reduced intensity - 30% thinner)
                    if (Math.random() < 0.15) {
                        game.particles.spawnBolt([{ x: k1.x, y: k1.y }, { x: k2.x, y: k2.y }], '#00FFFF', 3);
                    }

                    // Check if enemies cross the line
                    for (const enemy of enemies) {
                        if (enemy === fighter || enemy.isDead) continue;
                        if (enemy.kunaiZapImmune > 0) continue; // Prevent repeated stuns

                        if (Physics.lineCircleIntersect(k1.x, k1.y, k2.x, k2.y, enemy.x, enemy.y, enemy.radius)) {
                            enemy.applyStatus('STUN', 45); // 0.75s stun
                            enemy.kunaiZapImmune = this.zapImmunityDuration; // Immunity frames (1s)
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
        this.damage = config.damage;
    }

    execute(fighter, context) {
        const { enemies, game } = context;
        const target = enemies.find(e => e !== fighter && !e.isDead);
        let dist = 300;
        if (target) dist = Physics.dist(fighter.x, fighter.y, target.x, target.y);

        dist = Math.min(dist, 400);

        const airTime = 60;
        const speed = dist / airTime;

        const p = new Projectile(
            fighter,
            fighter.x,
            fighter.y,
            fighter.angle,
            speed,
            this.damage,
            game
        );

        p.radius = 6;
        p.isGrenade = true;
        p.z = 10;
        p.vz = 15;

        game.projectiles.push(p);
        audioEngine.playGrenadeThrow();

        logger.log(`${fighter.name} threw a GRENADE!`, 'combat');

        fighter.cooldowns.ult = this.cooldown;
    }
}

export class MissileBarrageAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.count = 5;
        this.damage = config.damage;
    }

    execute(fighter, context) {
        const { game } = context;

        for (let i = 0; i < this.count; i++) {
            // Spread missiles in an arc
            const spread = (i - (this.count - 1) / 2) * 0.5; // 0.5 rad spread
            const angle = fighter.angle + spread;

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(angle) * 20,
                fighter.y + Math.sin(angle) * 20,
                angle,
                6, // Initial speed
                this.damage,
                game
            );

            p.isMissile = true;
            p.radius = 5;
            p.turnSpeed = 0.08; // Weak homing

            game.projectiles.push(p);
        }

        audioEngine.playMissileLaunch();
        fighter.cooldowns.ult = this.cooldown;
        game.particles.spawn(fighter.x, fighter.y, '#ff4400', 10);
        logger.log(`${fighter.name} launched Missile Barrage!`, 'combat');
    }
}
