/**
 * Quincy Abilities (Uryu Ishida - "The Last Quincy")
 * 
 * ATK: Heilig Pfeil - Predictive arrows with distance-based damage scaling
 * DEF: Hirenkyaku - Auto-blink away from danger, leaves Ginto trap
 * ULT: Licht Regen - Rains a cone of piercing light arrows
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
        this.baseDamage = config.damage || 8;
        this.cooldown = config.cooldown || 60;
        this.projectileSpeed = 20;

        // Lock-on system
        this.lockProgress = 0;
        this.lockTarget = null;
        this.lockChargeRate = 3;  // Per frame when aligned
        this.lockDecayRate = 0.92; // Multiplier when not aligned
        this.perfectLockThreshold = 100;
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
            fighter.quincyTargetAngle = null; // Reset visual aim
            return;
        }

        this.lockTarget = closestEnemy;

        // Calculate predicted position (lead-shot aiming)
        const predictionFrames = 20;
        const predX = closestEnemy.x + (closestEnemy.dx * predictionFrames);
        const predY = closestEnemy.y + (closestEnemy.dy * predictionFrames);

        // Calculate angle to predicted position
        const targetAngle = Math.atan2(predY - fighter.y, predX - fighter.x);

        // Check angle alignment
        let angleDiff = targetAngle - fighter.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Lock-on charging (lenient threshold - 0.3 radians = ~17 degrees)
        if (Math.abs(angleDiff) < 0.3) {
            // Reasonably aligned, charge up faster
            this.lockProgress = Math.min(this.lockProgress + this.lockChargeRate * 2, this.perfectLockThreshold);
        } else {
            // Not aligned, decay
            this.lockProgress *= this.lockDecayRate;
        }

        // Expose to renderer
        fighter.lockProgress = this.lockProgress;
        fighter.quincyTargetAngle = targetAngle;

        // Fire logic - ALWAYS fire when off cooldown (lock is just a bonus)
        if (fighter.cooldowns.atk <= 0) {
            this.execute(fighter, context, minDist);
        }
    }

    execute(fighter, context, distance) {
        const { game } = context;

        const isPerfectLock = this.lockProgress >= this.perfectLockThreshold;

        // Distance-based damage scaling
        let damageMultiplier = 1.0;
        if (distance > 280) {
            damageMultiplier = 1.5; // Far range bonus
        } else if (distance < 120) {
            damageMultiplier = 0.6; // Close range penalty
        }

        // Lock bonus
        if (isPerfectLock) {
            damageMultiplier *= 1.3; // 30% perfect lock bonus
        }

        const finalDamage = Math.ceil(this.baseDamage * damageMultiplier);
        const speed = isPerfectLock ? 25 : this.projectileSpeed;

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
        p.radius = isPerfectLock ? 6 : 4;

        // Perfect shots pierce
        if (isPerfectLock) {
            p.piercing = true;
            p.hitList = [];
        }

        game.projectiles.push(p);

        // Visuals & Audio
        audioEngine.playZap(); // Energy bow sound
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
        this.cooldown = config.cooldown || 180;
        this.dangerRadius = 100; // Trigger blink when enemy enters this range
        this.blinkDistance = 150;
        this.trapDuration = 180; // 3 seconds
        this.trapStunDuration = 30; // 0.5 second stun
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
        fighter.x = newX;
        fighter.y = newY;

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
        trap.radius = 15;
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
        this.cooldown = config.cooldown || 300;
        this.arrowCount = 12;
        this.arrowDamage = config.damage || 3;
        this.coneAngle = Math.PI / 3; // 60 degree cone
    }

    update(fighter, context) {
        // Trigger when off cooldown
        if (fighter.cooldowns.ult <= 0) {
            const { enemies } = context;
            const hasTarget = enemies.some(e => e !== fighter && !e.isDead);

            if (hasTarget) {
                this.execute(fighter, context);
            }
        }
    }

    execute(fighter, context) {
        const { game } = context;

        // Spawn rain of arrows in a cone
        const startAngle = fighter.angle - this.coneAngle / 2;
        const angleStep = this.coneAngle / (this.arrowCount - 1);

        for (let i = 0; i < this.arrowCount; i++) {
            const arrowAngle = startAngle + angleStep * i;

            // Slight random variation
            const finalAngle = arrowAngle + (Math.random() - 0.5) * 0.1;

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(finalAngle) * 20,
                fighter.y + Math.sin(finalAngle) * 20,
                finalAngle,
                22, // High speed
                this.arrowDamage,
                game
            );

            p.isQuincyArrow = true;
            p.isLichtRegen = true;
            p.radius = 3;
            p.piercing = true;
            p.hitList = [];

            game.projectiles.push(p);
        }

        // Visuals & Audio
        game.particles.spawnLichtRegen(fighter.x, fighter.y);
        audioEngine.playMissileLaunch(); // Big sound for ult

        logger.log(`${fighter.name} unleashes LICHT REGEN!`, 'combat');

        // Set cooldown
        fighter.cooldowns.ult = this.cooldown;
        fighter.maxCooldowns.ult = this.cooldown;
    }
}
