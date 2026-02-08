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

import { HomingBehavior, LinearMovement, BallisticBehavior, KunaiBehavior, GrenadeBehavior } from '../components/ProjectileBehaviors.js';
import { MissileRenderer, KunaiRenderer, GrenadeRenderer } from '../components/ProjectileRenderers.js';

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
        if (fighter.status.stun > 0) return;

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

    modifyRotation(fighter, rot) {
        if (fighter.activeEffects.burstCount > 0) return rot * 0.2;
        return rot;
    }

    modifySpeed(fighter, speed) {
        if (fighter.activeEffects.ultActive) return speed * 1.5;
        return speed;
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

            p.isKunai = true; // Keep for ID checks if needed, but renderer is swapped
            p.isUlt = isUlt;
            p.radius = 6;

            p.renderer = new KunaiRenderer();
            p.addComponent(new KunaiBehavior());
            p.maxDist = this.maxDist + Math.random() * this.maxDistVariance;

            game.projectiles.push(p);
            fighter.kunaiPending.push(p);
            audioEngine.playKunaiThrow();
        }
        game.particles.spawn(fighter.x, fighter.y, '#ffd700', 8);
    }

    update(fighter, context) {
        const { game, enemies, timeScale } = context;

        // 1. Handle Teleport Timer Logic (moved from Fighter.js)
        if (fighter.teleportDelayTimer > 0) {
            fighter.teleportDelayTimer = Math.max(0, fighter.teleportDelayTimer - 1 * timeScale);

            if (fighter.teleportDelayTimer <= 0 && fighter.kunaiPending && fighter.kunaiPending.length > 0) {
                fighter.chainDashQueue = [{ x: fighter.x, y: fighter.y }];
                fighter.kunaiPending.forEach(p => {
                    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                        fighter.chainDashQueue.push({ x: p.x, y: p.y });
                    }
                });
                fighter.kunaiPending = [];

                if (fighter.chainDashQueue.length > 1) {
                    fighter.isDashing = true;
                    fighter.dashHandler = this; // Set ourselves as handler
                    fighter.dashTimer = fighter.chainDashQueue.length * 4;
                    fighter.dashTimerStart = fighter.dashTimer;
                } else {
                    fighter.teleportDelayTimer = 0;
                    fighter.chainDashQueue = [];
                }
            }
        }

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
                enemy.kunaiZapImmune -= (context.timeScale || 1);
            }
        }

        if (this.canUse(fighter, context)) {
            this.execute(fighter, context, false);
        }
    }

    updateDash(fighter, timeScale) {
        const game = fighter.game;

        if (fighter.chainDashQueue.length > 1) {
            if (Math.floor(fighter.dashTimer) % 4 < timeScale) {
                const current = fighter.chainDashQueue.shift();
                const next = fighter.chainDashQueue[0];

                if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) {
                    fighter.dashTimer = 0;
                    fighter.isDashing = false;
                    fighter.dashHandler = null;
                    return;
                }

                // Visuals
                game.particles.particles.push({
                    x: current.x, y: current.y,
                    vx: 0, vy: 0,
                    life: 0.4, decay: 0.1,
                    size: fighter.radius, color: '#ffd700', type: 'dot', alpha: 0.15
                });

                game.particles.spawnBeam(current.x, current.y, next.x, next.y, '#ffd700', 8, 0.08);

                // Faint Parallel Lines
                const px = current.y - next.y;
                const py = next.x - current.x;
                const len = Math.hypot(px, py) || 1;
                const offX = (px / len) * 8;
                const offY = (py / len) * 8;

                game.particles.spawnBeam(
                    current.x + offX, current.y + offY,
                    next.x + offX, next.y + offY,
                    '#ffd700', 2, 0.1
                );

                game.particles.particles.push({
                    x: next.x, y: next.y,
                    vx: 0, vy: 0,
                    life: 0.3, decay: 0.1,
                    size: fighter.radius, color: '#ffd700', type: 'dot', alpha: 0.15
                });

                audioEngine.playTeleport();

                fighter.x = next.x;
                fighter.y = next.y;

                // Hit Detection - Hit ALL enemies in trajectory
                const enemies = game.entities.filter(e => e !== fighter && !e.isDead);
                let anyHit = false;

                for (const e of enemies) {
                    if (Physics.lineCircleIntersect(current.x, current.y, next.x, next.y, e.x, e.y, e.radius + 15)) {
                        anyHit = true;

                        // Apply damage to everyone in path
                        if (fighter.pendingRasengan) {
                            // While dashing with Rasengan, we trigger a smaller impact on everyone passed through
                            // The "Big impact" still happens at the end (timer <= 0) or we can trigger it on first?
                            // To follow "hit-them-all", we should NOT stop.
                            game.combatText.flash(e.x, e.y - e.radius);
                            e.takeDamage(this.damage * 1.5, true, false, fighter); // Direct-hit type damage but continues
                            game.particles.spawn(e.x, e.y, '#00BFFF', 10);
                            audioEngine.playHit();
                        } else {
                            // Normal Dash Hit
                            game.combatText.flash(e.x, e.y - e.radius);
                            e.takeDamage(8, false, false, fighter);
                            game.particles.spawn(e.x, e.y, '#ffd700', 5);
                        }
                    }
                }

                if (anyHit && !fighter.pendingRasengan) {
                    // General hit visual/sound if we hit someone during normal dash
                    audioEngine.playHit();
                }
            }
        }

        // End of Dash Check
        if (fighter.dashTimer <= 0) {
            fighter.isDashing = false;
            fighter.dashHandler = null;

            game.projectiles = game.projectiles.filter(p => !p.isKunai || p.owner !== fighter);

            if (fighter.pendingRasengan) {
                this.triggerRasengan(fighter, null);
                fighter.pendingRasengan = null;
            }
            fighter.chainDashQueue = [];
        }
    }

    triggerRasengan(fighter, directHitTarget) {
        const game = fighter.game;
        const rasenganDamage = fighter.pendingRasengan || 12;
        const rasenganRadius = 60;

        // Spiral
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const dist = 10 + Math.random() * 40;
            game.particles.particles.push({
                x: fighter.x + Math.cos(angle) * dist,
                y: fighter.y + Math.sin(angle) * dist,
                vx: Math.cos(angle + Math.PI / 2) * 8,
                vy: Math.sin(angle + Math.PI / 2) * 8,
                life: 0.8, decay: 0.04, size: 3 + Math.random() * 4,
                color: '#00BFFF', type: 'dot'
            });
        }
        game.particles.spawnExplosion(fighter.x, fighter.y);
        game.particles.spawn(fighter.x, fighter.y, '#00BFFF', 20);
        game.particles.spawn(fighter.x, fighter.y, '#ffffff', 10);

        game.particles.particles.push({
            type: 'shockwave', x: fighter.x, y: fighter.y,
            radius: 10, maxRadius: 100, life: 1.0, decay: 0.05, color: '#00BFFF'
        });

        audioEngine.playHeavyImpact();

        if (directHitTarget) {
            logger.log(`${fighter.name} RASENGAN DIRECT HIT on ${directHitTarget.name}!`, 'combat');
            directHitTarget.takeDamage(rasenganDamage * 1.5, true, false, fighter);
        } else {
            logger.log(`${fighter.name} Rasengan exploded!`, 'info');
        }

        const enemies = game.entities.filter(e => e !== fighter && !e.isDead);
        enemies.forEach(e => {
            const dist = Physics.dist(fighter.x, fighter.y, e.x, e.y);
            if (dist < rasenganRadius + e.radius) {
                // Avoid double damage if direct hit? Simplest is to just damage.
                if (e !== directHitTarget) e.takeDamage(rasenganDamage, true, false, fighter);

                const knockAngle = Math.atan2(e.y - fighter.y, e.x - fighter.x);
                e.dx = Math.cos(knockAngle) * 12;
                e.dy = Math.sin(knockAngle) * 12;
                e.applyStatus('STUN', 45);
            }
        });
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
        this.stunDuration = config.stunDuration || 60;
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
        // p.z = 10; // Handled by ballistic? No, need to init.
        p.z = 10;
        const t = this.airTime;
        p.vz = 0.25 * t - 10 / t;

        p.renderer = new GrenadeRenderer();
        p.addComponent(new BallisticBehavior(0.5));
        p.addComponent(new GrenadeBehavior());
        p.stunDuration = this.stunDuration;

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

            // Refactored to OCP Component System
            p.radius = this.radius;

            // Attach Behaviors
            p.addComponent(new HomingBehavior(this.turnSpeed));
            p.addComponent(new LinearMovement());

            p.renderer = new MissileRenderer();
            // Legacy flag (removed for Missile, keeping cosmetic fallback if needed?)
            // p.isMissile = true; // REMOVED - Logic is now in HomingComponent

            // p.isMissile = true; // Removed legacy flag as renderer handles it now

            // Unified impact properties
            p.impactSound = 'explosion';
            p.impactParticle = 'explosion';

            game.projectiles.push(p);
        }

        audioEngine.playMissileLaunch();
        fighter.cooldowns.ult = this.cooldown;
        game.particles.spawn(fighter.x, fighter.y, '#ff4400', 10);
        logger.log(`${fighter.name} launched Missile Barrage!`, 'combat');
    }
}
