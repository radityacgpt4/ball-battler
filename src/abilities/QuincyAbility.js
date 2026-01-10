/**
 * Quincy Abilities (Uryu Ishida - "The Last Quincy")
 *
 * ATK: Heilig Pfeil - Predictive arrows with distance-based damage scaling
 * DEF: Hirenkyaku - Auto-blink away from danger, leaves Ginto trap
 * ULT: Licht Regen - Rains a cone of piercing light arrows
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

// --- ATK: HEILIG PFEIL (Sacred Arrow) ---
export class QuincyAtkAbility extends Ability {
        constructor(config, slot) {
                super(config, slot);
                // All values from config (fighters.js)
                this.baseDamage = config.damage || 8;
                this.cooldown = config.cooldown || 60;
                this.projectileSpeed = config.projectileSpeed || 20;
                this.perfectLockSpeed = config.perfectLockSpeed || 25;

                // Lock-on system
                this.lockProgress = 0;
                this.lockTarget = null;
                this.lockChargeRate = config.lockChargeRate || 3;
                this.lockDecayRate = config.lockDecayRate || 0.92;
                this.perfectLockThreshold = config.perfectLockThreshold || 100;
                this.alignmentThreshold = config.alignmentThreshold || 0.3;
                this.predictionFrames = config.predictionFrames || 20;

                // Distance-based damage scaling
                this.farRangeThreshold = config.farRangeThreshold || 280;
                this.closeRangeThreshold = config.closeRangeThreshold || 120;
                this.farDamageMultiplier = config.farDamageMultiplier || 1.5;
                this.closeDamageMultiplier = config.closeDamageMultiplier || 0.6;
                this.lockBonusMultiplier = config.lockBonusMultiplier || 1.3;

                // Visual
                this.normalRadius = config.normalRadius || 4;
                this.perfectRadius = config.perfectRadius || 6;
        }

        update(fighter, context) {
                const { enemies, game } = context;

                if (fighter.status.stun > 0) return;

                // Find closest enemy
                let closestEnemy = null;
                let minDist = Infinity;

                for (const enemy of enemies) {
                        if (enemy === fighter || enemy.isDead) continue;
                        const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
                        if (dist < minDist) {
                                minDist = dist;
                                closestEnemy = enemy;
                        }
                }

                if (!closestEnemy) {
                        this.lockProgress = 0;
                        fighter.lockProgress = 0;
                        fighter.quincyTargetAngle = null;
                        return;
                }

                this.lockTarget = closestEnemy;

                // Calculate predicted position (lead-shot aiming)
                const predX = closestEnemy.x + (closestEnemy.dx * this.predictionFrames);
                const predY = closestEnemy.y + (closestEnemy.dy * this.predictionFrames);

                // Calculate angle to predicted position
                const targetAngle = Math.atan2(predY - fighter.y, predX - fighter.x);

                // Check angle alignment
                let angleDiff = targetAngle - fighter.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // Lock-on charging
                if (Math.abs(angleDiff) < this.alignmentThreshold) {
                        this.lockProgress = Math.min(this.lockProgress + this.lockChargeRate * 2, this.perfectLockThreshold);
                } else {
                        this.lockProgress *= this.lockDecayRate;
                }

                // Expose to renderer
                fighter.lockProgress = this.lockProgress;
                fighter.quincyTargetAngle = targetAngle;

                // Fire logic - ALWAYS fire when off cooldown
                if (fighter.cooldowns.atk <= 0) {
                        this.execute(fighter, context, minDist);
                }
        }

        execute(fighter, context, distance) {
                const { game } = context;

                const isPerfectLock = this.lockProgress >= this.perfectLockThreshold;

                // Distance-based damage scaling
                let damageMultiplier = 1.0;
                if (distance > this.farRangeThreshold) {
                        damageMultiplier = this.farDamageMultiplier;
                } else if (distance < this.closeRangeThreshold) {
                        damageMultiplier = this.closeDamageMultiplier;
                }

                // Lock bonus
                if (isPerfectLock) {
                        damageMultiplier *= this.lockBonusMultiplier;
                }

                const finalDamage = Math.ceil(this.baseDamage * damageMultiplier);
                const speed = isPerfectLock ? this.perfectLockSpeed : this.projectileSpeed;

                // Use the predicted angle we calculated
                const fireAngle = fighter.quincyTargetAngle || fighter.angle;

                const p = new Projectile(
                        fighter,
                        fighter.x + Math.cos(fireAngle) * 25,
                        fighter.y + Math.sin(fireAngle) * 25,
                        fireAngle,
                        speed,
                        finalDamage,
                        game
                );

                // Quincy arrow properties
                p.isQuincyArrow = true;
                p.isPerfectShot = isPerfectLock;
                p.radius = isPerfectLock ? this.perfectRadius : this.normalRadius;

                // Perfect shots pierce
                if (isPerfectLock) {
                        p.piercing = true;
                        p.hitList = [];
                }

                game.projectiles.push(p);

                // Visuals & Audio
                audioEngine.playZap();
                game.particles.spawnQuincyArrow(fighter.x, fighter.y);

                if (isPerfectLock) {
                        logger.log(`${fighter.name} fires a PERFECT Heilig Pfeil! (${finalDamage} dmg)`, 'combat');
                }

                // Reset lock and set cooldown
                this.lockProgress = 0;
                fighter.lockProgress = 0;
                fighter.cooldowns.atk = this.cooldown;
                fighter.maxCooldowns.atk = this.cooldown;
        }
}

// --- DEF: HIRENKYAKU (Flying Screen Step) ---
export class QuincyDefAbility extends Ability {
        constructor(config, slot) {
                super(config, slot);
                // All values from config (fighters.js)
                this.cooldown = config.cooldown || 180;
                this.dangerRadius = config.dangerRadius || 100;
                this.blinkDistance = config.blinkDistance || 150;
                this.trapDuration = config.trapDuration || 180;
                this.trapStunDuration = config.trapStunDuration || 30;
                this.trapRadius = config.trapRadius || 10;
        }

        update(fighter, context) {
                const { enemies, game } = context;

                if (fighter.status.stun > 0) return;
                if (fighter.cooldowns.def > 0) return;

                // Check if any enemy is in danger zone
                for (const enemy of enemies) {
                        if (enemy === fighter || enemy.isDead) continue;

                        const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);

                        if (dist < this.dangerRadius) {
                                this.execute(fighter, context, enemy);
                                break;
                        }
                }
        }

        execute(fighter, context, enemy) {
                const { game } = context;
                const oldX = fighter.x;
                const oldY = fighter.y;

                // Calculate escape direction (opposite of enemy)
                const escapeAngle = Math.atan2(fighter.y - enemy.y, fighter.x - enemy.x);

                // Calculate new position
                let newX = fighter.x + Math.cos(escapeAngle) * this.blinkDistance;
                let newY = fighter.y + Math.sin(escapeAngle) * this.blinkDistance;

                // Clamp to arena bounds
                const bounds = game.arenaBounds;
                const margin = fighter.radius + 10;
                newX = Math.max(bounds.x + margin, Math.min(bounds.x + bounds.width - margin, newX));
                newY = Math.max(bounds.y + margin, Math.min(bounds.y + bounds.height - margin, newY));

                // Teleport
                // Add a tiny random jitter to prevent exact 0-distance overlaps which cause physics explosions
                const jitter = (Math.random() - 0.5) * 2;
                fighter.x = newX + jitter;
                fighter.y = newY + jitter;

                // Reset velocity to baseSpeed in the direction of the blink
                fighter.dx = Math.cos(escapeAngle) * fighter.baseSpeed;
                fighter.dy = Math.sin(escapeAngle) * fighter.baseSpeed;

                // Visual effects at departure point
                game.particles.spawnHirenkyaku(oldX, oldY);

                // Visual effects at arrival point
                game.particles.spawnHirenkyaku(newX, newY);

                // Create Ginto Trap at old position
                const trap = new Projectile(
                        fighter,
                        oldX,
                        oldY,
                        0, // No movement
                        0,
                        0, // No direct damage
                        game
                );

                trap.isGintoTrap = true;
                trap.lifeTime = this.trapDuration;
                trap.stunDuration = this.trapStunDuration;
                trap.radius = this.trapRadius;
                trap.dx = 0;
                trap.dy = 0;

                game.projectiles.push(trap);

                // Audio
                audioEngine.playPowerUp();

                logger.log(`${fighter.name} used Hirenkyaku!`, 'info');

                // Set cooldown
                fighter.cooldowns.def = this.cooldown;
                fighter.maxCooldowns.def = this.cooldown;
        }
}

// --- ULT: LICHT REGEN (Light Rain) ---
export class QuincyUltAbility extends Ability {
        constructor(config, slot) {
                super(config, slot);
                // All values from config (fighters.js)
                this.cooldown = config.cooldown || 300;
                this.arrowCount = config.arrowCount || 4;
                this.arrowDamage = config.damage || 6;
                this.arrowSpeed = config.arrowSpeed || 18;
                this.arrowRadius = config.arrowRadius || 2; // Smaller arrows
                this.stunDuration = config.stunDuration || 30;
                this.rainHeight = config.rainHeight || 150;
                this.rainSpread = config.rainSpread || 120;
        }

        update(fighter, context) {
                // Trigger when off cooldown
                if (fighter.cooldowns.ult <= 0) {
                        const { enemies } = context;
                        const target = enemies.find(e => e !== fighter && !e.isDead);

                        if (target) {
                                this.execute(fighter, context, target);
                        }
                }
        }

        execute(fighter, context, target) {
                const { game, enemies } = context;

                // Fallback: find target if not passed
                if (!target) {
                        target = enemies.find(e => e !== fighter && !e.isDead);
                }
                if (!target) return; // No valid target

                // Spawn rain of arrows above the target
                for (let i = 0; i < this.arrowCount; i++) {
                        // Random spread around target position
                        const offsetX = (Math.random() - 0.5) * this.rainSpread;
                        const offsetY = (Math.random() - 0.5) * this.rainSpread;
                        const destX = target.x + offsetX;
                        const destY = target.y + offsetY;

                        // Calculate trajectory
                        const dist = Physics.dist(fighter.x, fighter.y, destX, destY);
                        const angle = Math.atan2(destY - fighter.y, destX - fighter.x);

                        // Physics: Time to land should match gravity arc
                        // z(t) = v0*t - 0.5*g*t^2. Land at t=60 if v0=15, g=0.5
                        const airTime = 40;
                        const speed = dist / airTime;

                        // Projectile starts at fighter
                        const p = new Projectile(
                                fighter,
                                fighter.x,
                                fighter.y,
                                angle,
                                speed,
                                this.arrowDamage,
                                game
                        );

                        p.isQuincyArrow = true;
                        p.isLichtRegen = true;
                        p.isRainingArrow = true;
                        p.radius = this.arrowRadius;
                        p.piercing = true;
                        p.hitList = [];
                        p.stunDuration = this.stunDuration;
                        // Store destination for hit indicator (cosmetic only)
                        p.destX = destX;
                        p.destY = destY;

                        // Vertical movement properties (curved arc)
                        // Start low, shoot up
                        p.z = 10;
                        p.vz = 15 + (Math.random() * 2); // Slight variation in height

                        game.projectiles.push(p);
                }

                // Visuals & Audio - "Throw" effect at fighter, "Rain" effect at target
                game.particles.spawn(fighter.x, fighter.y, '#1E90FF', 12); // Throw burst
                game.particles.spawnLichtRegen(target.x, target.y);
                audioEngine.playMissileLaunch();

                logger.log(`${fighter.name} unleashes LICHT REGEN!`, 'combat');

                // Set cooldown
                fighter.cooldowns.ult = this.cooldown;
                fighter.maxCooldowns.ult = this.cooldown;
        }
}
