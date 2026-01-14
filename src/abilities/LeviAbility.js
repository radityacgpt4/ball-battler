/**
 * Levi Ackerman Abilities
 * Physics-driven ODM gear system with speed-scaling combat.
 * Optimized for performance with minimal particle overhead.
 */

import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

/**
 * ATK: Sword Shred
 * Passive melee that scales rotation and attack speed with movement speed.
 * Max DPS ~26 when at maximum momentum.
 */
export class SwordShredAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.isPassive = true;
        this.attackTimer = 0;
    }

    update(fighter, context) {
        const { enemies, game, timeScale } = context;
        if (fighter.status.stun > 0) return;

        // Calculate current movement speed
        const currentSpeed = Math.hypot(fighter.dx, fighter.dy);

        // Scale rotation and attack speed
        if (fighter.odmStickActive) {
            // RETAIN: If sticking, we don't update rotation/cooldown based on current (slow) speed.
        } else {
            const baseRot = 0.08;
            const speedBonus = currentSpeed * this.config.speedScaleFactor;
            fighter.rotationSpeed = Math.min(baseRot + speedBonus, this.config.maxRotationSpeed);

            const speedRatio = currentSpeed / 14;
            const cooldownReduction = (this.config.attackCooldown - this.config.minCooldown) * speedRatio;
            fighter.currentAttackCooldown = Math.max(this.config.minCooldown, this.config.attackCooldown - cooldownReduction);
        }

        const effectiveCooldown = fighter.currentAttackCooldown || this.config.attackCooldown;

        if (this.attackTimer > 0) {
            this.attackTimer -= timeScale;
            return;
        }

        // --- PIXEL PERFECT BLADE COLLISION ---
        const bladeLen = this.config.range; // matches renderer 32-35
        const stanceAngle = -Math.PI / 4;

        // Helper to check line-circle collision
        const checkBladeHit = (target, offsetX, offsetY, extraRot = 0) => {
            // Calculate absolute start and end points of the blade
            const angle = fighter.angle + stanceAngle + extraRot;

            // Start point (at handle/edge of body)
            const sX = fighter.x + offsetX * Math.cos(fighter.angle) - offsetY * Math.sin(fighter.angle);
            const sY = fighter.y + offsetX * Math.sin(fighter.angle) + offsetY * Math.cos(fighter.angle);

            // End point (tip)
            const eX = sX + bladeLen * Math.cos(angle);
            const eY = sY + bladeLen * Math.sin(angle);

            return Physics.lineCircleIntersect(sX, sY, eX, eY, target.x, target.y, target.radius);
        };

        // Find targets hit by either blade
        const target = enemies.find(e => {
            if (e === fighter || e.isDead) return false;
            // Check Front Blade (12, -23)
            if (checkBladeHit(e, 12, -23)) return true;
            // Check Back Blade (-12, 23, +PI)
            if (checkBladeHit(e, -12, 23, Math.PI)) return true;
            return false;
        });

        if (target) {
            // Check if blocked by shield
            if (target.isBlockedByShield(fighter.x, fighter.y, this.config.baseDamage)) {
                audioEngine.playBlock();
                this.attackTimer = this.config.attackCooldown;
                return;
            }

            // Deal damage scaled slightly by speed
            const speedDamageBonus = currentSpeed > 8 ? 1 : 0;
            const damage = this.config.baseDamage + speedDamageBonus;

            target.takeDamage(damage, false, false, fighter);

            // Particles on hit
            if (currentSpeed < 8 || Math.random() < 0.5) {
                game.particles.spawn(target.x, target.y, '#CFD8DC', 2);
            }

            audioEngine.playSlash();
            this.attackTimer = effectiveCooldown;
        }
    }

    onDamage(fighter, amount, context) {
        return amount; // No damage modification
    }
}

/**
 * DEF: ODM Maneuver
 * Wall-hooking grapple that builds speed. Sticks to enemies on contact.
 */
export class ODMDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.isPassive = false;
        this.hookActive = false;
        this.hookX = 0;
        this.hookY = 0;
        this.hookTargetX = 0;
        this.hookTargetY = 0;
        this.hookTravelled = 0;
        this.isReeling = false;
        this.stickTarget = null;
        this.stickTimer = 0;
        this.stickOffset = { x: 0, y: 0 };
    }

    update(fighter, context) {
        const { enemies, game, timeScale } = context;

        // Handle "Stick" state
        if (this.stickTarget && this.stickTimer > 0) {
            this.handleStickState(fighter, game, timeScale);
            return;
        }

        // Handle active hook
        if (this.hookActive) {
            this.handleHookFlight(fighter, enemies, game, timeScale);
            return;
        }

        // Auto-fire hook when ready
        if (fighter.cooldowns.def <= 0 && fighter.status.stun <= 0) {
            this.fireHook(fighter, game);
        }
    }

    fireHook(fighter, game) {
        // Fire hook in facing direction
        this.hookX = fighter.x;
        this.hookY = fighter.y;

        const ultActive = fighter.activeEffects.ultActive && fighter.typeKey === 'LEVI';
        const hookSpeed = ultActive
            ? this.config.hookSpeed * (fighter.skills.ult.hookSpeedMultiplier || 2.0)
            : this.config.hookSpeed;

        this.hookDx = Math.cos(fighter.angle) * hookSpeed;
        this.hookDy = Math.sin(fighter.angle) * hookSpeed;
        this.hookTravelled = 0;
        this.hookActive = true;
        this.isReeling = false;

        audioEngine.playZap(); // Hook fire sound
        logger.log(`${fighter.name} fired ODM hook!`, 'info');
    }

    handleHookFlight(fighter, enemies, game, timeScale) {
        const bounds = game.arenaBounds;

        // Move hook
        this.hookX += this.hookDx * timeScale;
        this.hookY += this.hookDy * timeScale;
        this.hookTravelled += Math.hypot(this.hookDx, this.hookDy) * timeScale;

        // Check wall collision for hook HEAD (clamp before rendering tip)
        let hitWall = false;
        const hookPadding = 2; // Attachment point slightly inside the wall visual
        if (this.hookX <= bounds.x + hookPadding || this.hookX >= bounds.x + bounds.width - hookPadding) {
            this.hookX = Math.max(bounds.x, Math.min(bounds.x + bounds.width, this.hookX));
            hitWall = true;
        }
        if (this.hookY <= bounds.y + hookPadding || this.hookY >= bounds.y + bounds.height - hookPadding) {
            this.hookY = Math.max(bounds.y, Math.min(bounds.y + bounds.height, this.hookY));
            hitWall = true;
        }

        // Draw hook rope (VISIBLE STEEL WIRE)
        game.particles.particles.push({
            type: 'bolt',
            segments: [
                { x: fighter.x, y: fighter.y },
                { x: this.hookX, y: this.hookY }
            ],
            life: 1.0, decay: 0.1,
            width: 1.6, color: '#34495E'
        });

        // Hook Head particle for extra visibility (now perfectly on the wall)
        game.particles.particles.push({
            x: this.hookX, y: this.hookY,
            vx: 0, vy: 0,
            life: 1.0, decay: 0.1,
            size: 4, color: '#7F8C8D', type: 'dot'
        });

        if (hitWall && !this.isReeling) {
            this.isReeling = true;
            audioEngine.playHit();
            logger.log(`${fighter.name} ODM hooked wall!`, 'info');
        }

        // Reel in fighter towards wall
        if (this.isReeling) {
            const angle = Math.atan2(this.hookY - fighter.y, this.hookX - fighter.x);
            const dist = Physics.dist(fighter.x, fighter.y, this.hookX, this.hookY);

            // Build speed based on distance travelled
            const ultActive = fighter.activeEffects.ultActive && fighter.typeKey === 'LEVI';
            const maxSpeed = ultActive
                ? (fighter.skills.ult.maxSpeedBoost || 15)
                : this.config.maxSpeed;

            const speedGain = this.hookTravelled * this.config.speedBuildupPerUnit;
            const targetSpeed = Math.min(fighter.baseSpeed + speedGain, maxSpeed);

            fighter.dx = Math.cos(angle) * targetSpeed;
            fighter.dy = Math.sin(angle) * targetSpeed;

            // Evasion chance while in flight
            fighter.odmEvasionActive = true;

            // Check if Levi's BODY collides with enemy while reeling (this triggers stick)
            for (const enemy of enemies) {
                if (enemy === fighter || enemy.isDead) continue;
                const collisionDist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
                if (collisionDist < fighter.radius + enemy.radius + 5) {
                    // Start stick state - Levi latches onto the enemy
                    this.stickTarget = enemy;
                    this.stickTimer = this.config.stickDuration;
                    this.stickOffset = {
                        x: fighter.x - enemy.x,
                        y: fighter.y - enemy.y
                    };
                    this.hookActive = false;
                    fighter.odmStickActive = true; // Flag for ATK ability to retain speed

                    // Transfer momentum to enemy (knock them in Levi's direction)
                    enemy.dx += fighter.dx * 0.5;
                    enemy.dy += fighter.dy * 0.5;

                    audioEngine.playHeavyImpact();
                    logger.log(`${fighter.name} STUCK to ${enemy.name}!`, 'combat');
                    return;
                }
            }

            // Reached hook point on wall - BOUNCE off
            // BUG FIX: Ball radius is 25. Edge clamping happens at radius distance.
            // Using 50 to ensure the bounce triggers before the physics engine traps the fighter.
            if (dist < 50) {
                this.hookActive = false;
                fighter.odmEvasionActive = false;

                // Calculate cooldown based on ult
                const baseCooldown = this.config.cooldown;
                const cooldown = ultActive
                    ? baseCooldown / (fighter.skills.ult.fireRateMultiplier || 1.5)
                    : baseCooldown;
                fighter.cooldowns.def = cooldown;

                // BOUNCE physics
                let normalX = 0, normalY = 0;
                const tolerance = 25;
                if (this.hookX <= bounds.x + tolerance) normalX = 1;
                else if (this.hookX >= bounds.x + bounds.width - tolerance) normalX = -1;

                if (this.hookY <= bounds.y + tolerance) normalY = 1;
                else if (this.hookY >= bounds.y + bounds.height - tolerance) normalY = -1;

                // If corner, normalize
                const normalLen = Math.hypot(normalX, normalY);
                if (normalLen > 0) {
                    normalX /= normalLen;
                    normalY /= normalLen;
                } else {
                    // Fallback to simple reflection toward center if normal detection failed
                    normalX = (bounds.x + bounds.width / 2 - fighter.x) / 100;
                    normalY = (bounds.y + bounds.height / 2 - fighter.y) / 100;
                    const l = Math.hypot(normalX, normalY) || 1;
                    normalX /= l; normalY /= l;
                }

                // PUSH Levi away from wall to prevent being trapped in collision logic
                fighter.x += normalX * 10;
                fighter.y += normalY * 10;

                // Reflect velocity: v' = v - 2(v·n)n
                const dot = fighter.dx * normalX + fighter.dy * normalY;
                // If moving towards wall (dot < 0), reflect. Otherwise just add impulse.
                if (dot < 0) {
                    fighter.dx = (fighter.dx - 2 * dot * normalX) * 0.95;
                    fighter.dy = (fighter.dy - 2 * dot * normalY) * 0.95;
                } else {
                    fighter.dx += normalX * 6;
                    fighter.dy += normalY * 6;
                }

                game.particles.spawn(fighter.x, fighter.y, '#4A5D4E', 8);
                audioEngine.playBounce();
                logger.log(`${fighter.name} bounced off wall!`, 'info');
            }
        }

        // Hook expired (missed wall)
        if (this.hookTravelled > this.config.hookRange && !this.isReeling) {
            this.hookActive = false;
            fighter.odmEvasionActive = false;
            fighter.cooldowns.def = this.config.cooldown;
        }
    }

    handleStickState(fighter, game, timeScale) {
        const target = this.stickTarget;

        if (!target || target.isDead) {
            this.endStick(fighter, game);
            return;
        }

        this.stickTimer -= timeScale;
        fighter.odmEvasionActive = true; // Ensure evasion remains active while stuck

        // Lock position relative to target (ride them)
        const offsetDist = Math.hypot(this.stickOffset.x, this.stickOffset.y);
        const normalizedDist = Math.min(offsetDist, target.radius + fighter.radius + 5);
        const offsetAngle = Math.atan2(this.stickOffset.y, this.stickOffset.x);

        fighter.x = target.x + Math.cos(offsetAngle) * normalizedDist;
        fighter.y = target.y + Math.sin(offsetAngle) * normalizedDist;
        fighter.dx = target.dx;
        fighter.dy = target.dy;

        // Spawn minimal sparks for "shredding" visual (performance optimized)
        if (Math.random() < 0.3) {
            game.particles.particles.push({
                x: fighter.x + (Math.random() - 0.5) * 10,
                y: fighter.y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 0.2,
                decay: 0.1,
                size: 2,
                color: '#B0BEC5',
                type: 'dot'
            });
        }

        // End stick
        if (this.stickTimer <= 0) {
            this.endStick(fighter, game);
        }
    }

    endStick(fighter, game) {
        const target = this.stickTarget;
        fighter.odmEvasionActive = false; // Evasion ends after jump-away

        if (target && !target.isDead) {
            // Jump away - calculate escape direction
            const awayAngle = Math.atan2(fighter.y - target.y, fighter.x - target.x);

            // Push Levi slightly away to prevent immediate re-collision
            const pushDist = fighter.radius + target.radius + 10;
            fighter.x = target.x + Math.cos(awayAngle) * pushDist;
            fighter.y = target.y + Math.sin(awayAngle) * pushDist;

            // Apply jump-away velocity
            fighter.dx = Math.cos(awayAngle) * this.config.jumpAwayForce;
            fighter.dy = Math.sin(awayAngle) * this.config.jumpAwayForce;

            // Visual feedback
            game.particles.spawn(fighter.x, fighter.y, '#4A5D4E', 5);
            game.particles.particles.push({
                type: 'shockwave',
                x: fighter.x, y: fighter.y,
                radius: 10, maxRadius: 40,
                life: 0.4, decay: 0.1,
                color: '#4A5D4E'
            });

            audioEngine.playTeleport();
            logger.log(`${fighter.name} jumped away from ${target.name}!`, 'info');
        } else {
            // Target died or is gone - just reset velocity
            const randomAngle = Math.random() * Math.PI * 2;
            fighter.dx = Math.cos(randomAngle) * fighter.baseSpeed;
            fighter.dy = Math.sin(randomAngle) * fighter.baseSpeed;
        }

        this.stickTarget = null;
        this.stickTimer = 0;
        fighter.odmStickActive = false; // Reset rotation/speed retention
        fighter.cooldowns.def = this.config.cooldown;
    }

    onDamage(fighter, amount, context) {
        // Evasion check while in ODM flight or sticking
        if (fighter.odmEvasionActive && Math.random() < this.config.evasionChance) {
            // Visual feedback - "MISS" pop-up
            context.game.particles.spawnText(fighter.x, fighter.y - 40, "MISS", "#4A5D4E");

            // Minimal particles for the dodge
            context.game.particles.spawn(fighter.x, fighter.y, '#ffffff', 5);

            audioEngine.playSwordSwing(); // Whoosh sound for evasion

            logger.log(`>> ${fighter.name} EVADED using ODM maneuvers!`, 'combat');
            return false; // Damage negated
        }
        return amount;
    }

    isBlocked(fighter, attackerX, attackerY, damage) {
        return false; // No shield blocking
    }
}

/**
 * ULT: Godspeed ODM
 * Buffs hook fire rate and rope speed for a duration.
 */
export class GodspeedODMAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.isPassive = false;
    }

    execute(fighter, context) {
        if (fighter.cooldowns.ult > 0) return;
        if (fighter.hp >= fighter.maxHp * 0.5) return; // Only below 50% HP

        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = this.config.duration;
        fighter.cooldowns.ult = this.config.cooldown;

        // Visual feedback
        context.game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x, y: fighter.y,
            radius: 20, maxRadius: 100,
            life: 0.8, decay: 0.05,
            color: '#4A5D4E'
        });

        audioEngine.playHeavyImpact();
        logger.log(`${fighter.name} activated GODSPEED ODM!`, 'combat');
    }
}
