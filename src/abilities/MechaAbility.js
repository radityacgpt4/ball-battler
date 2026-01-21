/**
 * Mecha Abilities (Gundam Wing Zero-One inspired)
 *
 * ATK: Beam Rifle - Energy projectile that explodes on impact, followed by melee dash
 * DEF: Thruster Dodge - Side dashes when enemies/projectiles approach
 * ULT: Counter Protocol - Every dodge triggers full attack sequence
 *
 * ALL configurable properties are loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

import { MechaBeamBehavior } from '../components/ProjectileBehaviors.js';
import { MechaBeamRenderer } from '../components/ProjectileRenderers.js';

// --- ATK: MECHA BEAM (Energy Gun + Melee Follow-up) ---
export class MechaAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // Ranged attack properties
        this.projectileDamage = config.projectileDamage || 10;
        this.explosionDamage = config.explosionDamage || 6;
        this.stunDuration = config.stunDuration || 90;
        this.projectileSpeed = config.projectileSpeed || 16;
        this.explosionRadius = config.explosionRadius || 60;

        // Melee dash properties
        this.meleeDamage = config.meleeDamage || 4;
        this.dashSpeed = config.dashSpeed || 18;
        this.dashDuration = config.dashDuration || 12;
        this.meleeRotationMultiplier = config.meleeRotationMultiplier || 3;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        const { game } = context;

        // Handle ongoing melee dash
        if (fighter.mechaDashActive) {
            this.handleMeleeDash(fighter, context);
            return;
        }

        // Check cooldown for firing
        if (fighter.cooldowns.atk > 0) return;

        // Fire the beam
        this.fireBeam(fighter, context);
    }

    fireBeam(fighter, context, isCounterAttack = false) {
        const { game } = context;

        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(fighter.angle) * 30,
            fighter.y + Math.sin(fighter.angle) * 30,
            fighter.angle,
            this.projectileSpeed,
            this.projectileDamage,
            game
        );

        p.radius = 8;
        p.isMechaBeam = true;
        p.explosionDamage = this.explosionDamage;
        p.explosionRadius = this.explosionRadius;
        p.stunDuration = this.stunDuration;
        p.explodeOnWall = true;

        // Custom renderer and behavior
        p.renderer = new MechaBeamRenderer();
        p.addComponent(new MechaBeamBehavior());

        // Unified impact properties
        p.impactSound = 'explosion';
        p.impactParticle = 'mechaExplosion';

        game.projectiles.push(p);

        // Muzzle flash effect
        game.particles.spawn(p.x, p.y, '#FFD700', 8);
        game.particles.spawnBeam(
            fighter.x, fighter.y,
            p.x, p.y,
            '#FFD700', 4, 0.15
        );

        audioEngine.playGunshot();

        // Store dash direction for melee follow-up
        fighter.mechaPendingDash = {
            angle: fighter.angle,
            triggered: false
        };

        // Start cooldown
        if (!isCounterAttack) {
            fighter.cooldowns.atk = this.cooldown;
            fighter.maxCooldowns.atk = this.cooldown;
        }

        logger.log(`${fighter.name} fired Beam Rifle!`, 'combat');
    }

    // Called when projectile hits something
    triggerMeleeDash(fighter, context) {
        if (!fighter.mechaPendingDash || fighter.mechaPendingDash.triggered) return;

        fighter.mechaPendingDash.triggered = true;
        fighter.mechaDashActive = true;
        fighter.mechaDashTimer = this.dashDuration;
        fighter.mechaDashAngle = fighter.mechaPendingDash.angle;

        // Store original values
        fighter.mechaOriginalRotSpeed = fighter.rotationSpeed;
        fighter.rotationSpeed *= this.meleeRotationMultiplier;

        // Set dash velocity
        fighter.dx = Math.cos(fighter.mechaDashAngle) * this.dashSpeed;
        fighter.dy = Math.sin(fighter.mechaDashAngle) * this.dashSpeed;

        // Spawn rocket boost effect
        this.spawnRocketBoost(fighter, context.game);

        audioEngine.playSpeedUp();
        logger.log(`${fighter.name} initiates melee follow-up!`, 'combat');
    }

    handleMeleeDash(fighter, context) {
        const { game, enemies } = context;

        fighter.mechaDashTimer--;

        // Rocket boost trail
        if (fighter.mechaDashTimer % 2 === 0) {
            this.spawnRocketBoost(fighter, game);
        }

        // Energy blade trail
        this.spawnBladeTrail(fighter, game);

        // Check for melee hits
        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            if (fighter.mechaHitList && fighter.mechaHitList.includes(enemy.id)) continue;

            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist < fighter.radius + enemy.radius + 25) {
                // Hit!
                if (!fighter.mechaHitList) fighter.mechaHitList = [];
                fighter.mechaHitList.push(enemy.id);

                enemy.takeDamage(this.meleeDamage, false, false, fighter);

                // Blade slash effect
                const slashAngle = Math.atan2(enemy.y - fighter.y, enemy.x - fighter.x);
                game.particles.spawnSlash(
                    fighter.x, fighter.y,
                    enemy.x, enemy.y,
                    '#00FFFF', 30
                );
                game.particles.spawn(enemy.x, enemy.y, '#00FFFF', 8);

                audioEngine.playSwordSwing();
                logger.log(`${fighter.name} landed a blade strike on ${enemy.name}!`, 'combat');
            }
        }

        // End dash
        if (fighter.mechaDashTimer <= 0) {
            fighter.mechaDashActive = false;
            fighter.mechaPendingDash = null;
            fighter.mechaHitList = [];

            // Restore rotation speed
            fighter.rotationSpeed = fighter.mechaOriginalRotSpeed || fighter.rotationSpeed / this.meleeRotationMultiplier;

            // Normalize velocity
            const speed = Math.hypot(fighter.dx, fighter.dy);
            if (speed > fighter.baseSpeed) {
                fighter.dx = (fighter.dx / speed) * fighter.baseSpeed;
                fighter.dy = (fighter.dy / speed) * fighter.baseSpeed;
            }
        }

        // Arena bounds
        const bounds = game.arenaBounds;
        if (fighter.x < bounds.x + fighter.radius) {
            fighter.x = bounds.x + fighter.radius;
            fighter.mechaDashTimer = 0;
        }
        if (fighter.x > bounds.x + bounds.width - fighter.radius) {
            fighter.x = bounds.x + bounds.width - fighter.radius;
            fighter.mechaDashTimer = 0;
        }
        if (fighter.y < bounds.y + fighter.radius) {
            fighter.y = bounds.y + fighter.radius;
            fighter.mechaDashTimer = 0;
        }
        if (fighter.y > bounds.y + bounds.height - fighter.radius) {
            fighter.y = bounds.y + bounds.height - fighter.radius;
            fighter.mechaDashTimer = 0;
        }
    }

    spawnRocketBoost(fighter, game) {
        const boostAngle = fighter.mechaDashAngle + Math.PI; // Behind the fighter

        // Main thruster flame
        for (let i = 0; i < 3; i++) {
            const spread = (Math.random() - 0.5) * 0.4;
            const speed = 4 + Math.random() * 3;
            game.particles.particles.push({
                x: fighter.x + Math.cos(boostAngle) * fighter.radius,
                y: fighter.y + Math.sin(boostAngle) * fighter.radius,
                vx: Math.cos(boostAngle + spread) * speed,
                vy: Math.sin(boostAngle + spread) * speed,
                life: 0.6,
                decay: 0.08,
                size: 4 + Math.random() * 3,
                color: Math.random() > 0.5 ? '#FF4500' : '#FFD700',
                type: 'dot'
            });
        }

        // Blue core flame
        game.particles.particles.push({
            x: fighter.x + Math.cos(boostAngle) * (fighter.radius - 5),
            y: fighter.y + Math.sin(boostAngle) * (fighter.radius - 5),
            vx: Math.cos(boostAngle) * 2,
            vy: Math.sin(boostAngle) * 2,
            life: 0.4,
            decay: 0.1,
            size: 5,
            color: '#00BFFF',
            type: 'dot'
        });
    }

    spawnBladeTrail(fighter, game) {
        // Energy blade trail particles
        const bladeAngle = fighter.angle;
        const bladeLength = 35;
        const tipX = fighter.x + Math.cos(bladeAngle) * (fighter.radius + bladeLength);
        const tipY = fighter.y + Math.sin(bladeAngle) * (fighter.radius + bladeLength);

        // Jittering glow effect for energy blade
        const jitter = (Math.random() - 0.5) * 4;
        game.particles.particles.push({
            x: tipX + jitter,
            y: tipY + jitter,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 0.3,
            decay: 0.1,
            size: 3 + Math.random() * 2,
            color: '#00FFFF',
            type: 'square'
        });

        // Trail beam
        if (Math.random() < 0.5) {
            game.particles.spawnBeam(
                fighter.x + Math.cos(bladeAngle) * fighter.radius,
                fighter.y + Math.sin(bladeAngle) * fighter.radius,
                tipX, tipY,
                '#00FFFF', 3, 0.15
            );
        }
    }
}

// --- DEF: THRUSTER DODGE (Side dash on approach) ---
export class MechaDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.detectionRadius = config.detectionRadius || 100;
        this.approachThreshold = config.approachThreshold || 0.6;
        this.dodgeDistance = config.dodgeDistance || 80;
        this.dodgeSpeed = config.dodgeSpeed || 12;
    }

    update(fighter, context) {
        if (fighter.cooldowns.def > 0) return;
        if (fighter.status.stun > 0) return;
        if (fighter.mechaDashActive) return; // Don't dodge during melee dash

        const { game, enemies } = context;

        // Priority 1: Check for approaching projectiles
        const threat = this.findApproachingThreat(fighter, context);

        if (threat) {
            this.executeDodge(fighter, threat, context);
            fighter.cooldowns.def = this.cooldown;
            fighter.maxCooldowns.def = this.cooldown;
        }
    }

    findApproachingThreat(fighter, context) {
        const { game, enemies } = context;

        // Check projectiles first (higher priority)
        for (const p of game.projectiles) {
            if (p.owner === fighter) continue;
            if (!p.active) continue;
            if (p.isClaymore || p.isGintoTrap) continue;

            const dist = Math.hypot(p.x - fighter.x, p.y - fighter.y);
            if (dist > this.detectionRadius) continue;

            // Check if projectile is moving towards fighter
            const speed = Math.hypot(p.dx, p.dy);
            if (speed < 1) continue;

            const toFighterX = fighter.x - p.x;
            const toFighterY = fighter.y - p.y;
            const toFighterDist = Math.hypot(toFighterX, toFighterY);

            const normToFighterX = toFighterX / toFighterDist;
            const normToFighterY = toFighterY / toFighterDist;
            const normDx = p.dx / speed;
            const normDy = p.dy / speed;

            const dot = normDx * normToFighterX + normDy * normToFighterY;

            if (dot > this.approachThreshold) {
                return { type: 'projectile', x: p.x, y: p.y, dx: p.dx, dy: p.dy };
            }
        }

        // Check approaching enemies
        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const dist = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
            if (dist > this.detectionRadius * 1.2) continue;

            const speed = Math.hypot(enemy.dx, enemy.dy);
            if (speed < 2) continue;

            const toFighterX = fighter.x - enemy.x;
            const toFighterY = fighter.y - enemy.y;
            const toFighterDist = Math.hypot(toFighterX, toFighterY);

            const normToFighterX = toFighterX / toFighterDist;
            const normToFighterY = toFighterY / toFighterDist;
            const normDx = enemy.dx / speed;
            const normDy = enemy.dy / speed;

            const dot = normDx * normToFighterX + normDy * normToFighterY;

            if (dot > this.approachThreshold) {
                return { type: 'enemy', x: enemy.x, y: enemy.y, dx: enemy.dx, dy: enemy.dy };
            }
        }

        return null;
    }

    executeDodge(fighter, threat, context) {
        const { game } = context;

        // Calculate perpendicular direction (side dodge)
        const threatAngle = Math.atan2(threat.dy, threat.dx);

        // Choose side based on which is more favorable (away from walls)
        const leftAngle = threatAngle + Math.PI / 2;
        const rightAngle = threatAngle - Math.PI / 2;

        const bounds = game.arenaBounds;
        const leftX = fighter.x + Math.cos(leftAngle) * this.dodgeDistance;
        const leftY = fighter.y + Math.sin(leftAngle) * this.dodgeDistance;
        const rightX = fighter.x + Math.cos(rightAngle) * this.dodgeDistance;
        const rightY = fighter.y + Math.sin(rightAngle) * this.dodgeDistance;

        // Check which direction is safer (more in bounds)
        const leftInBounds = leftX > bounds.x + 50 && leftX < bounds.x + bounds.width - 50 &&
                            leftY > bounds.y + 50 && leftY < bounds.y + bounds.height - 50;
        const rightInBounds = rightX > bounds.x + 50 && rightX < bounds.x + bounds.width - 50 &&
                             rightY > bounds.y + 50 && rightY < bounds.y + bounds.height - 50;

        let dodgeAngle;
        if (leftInBounds && !rightInBounds) {
            dodgeAngle = leftAngle;
        } else if (rightInBounds && !leftInBounds) {
            dodgeAngle = rightAngle;
        } else {
            // Random if both valid or both invalid
            dodgeAngle = Math.random() > 0.5 ? leftAngle : rightAngle;
        }

        // Store original position for visual
        const startX = fighter.x;
        const startY = fighter.y;

        // Execute dodge
        fighter.x += Math.cos(dodgeAngle) * this.dodgeDistance;
        fighter.y += Math.sin(dodgeAngle) * this.dodgeDistance;

        // Clamp to arena bounds
        fighter.x = Math.max(bounds.x + fighter.radius, Math.min(bounds.x + bounds.width - fighter.radius, fighter.x));
        fighter.y = Math.max(bounds.y + fighter.radius, Math.min(bounds.y + bounds.height - fighter.radius, fighter.y));

        // Set velocity in dodge direction
        fighter.dx = Math.cos(dodgeAngle) * this.dodgeSpeed;
        fighter.dy = Math.sin(dodgeAngle) * this.dodgeSpeed;

        // Visual effects
        // Afterimage at start
        game.particles.particles.push({
            x: startX, y: startY,
            vx: 0, vy: 0,
            life: 0.4, decay: 0.1,
            size: fighter.radius, color: '#1E90FF', type: 'dot', alpha: 0.3
        });

        // Thruster trail
        game.particles.spawnBeam(startX, startY, fighter.x, fighter.y, '#FF4500', 6, 0.12);
        game.particles.spawnBeam(startX, startY, fighter.x, fighter.y, '#FFD700', 3, 0.15);

        // Rocket boost at destination
        for (let i = 0; i < 5; i++) {
            game.particles.particles.push({
                x: fighter.x + (Math.random() - 0.5) * 20,
                y: fighter.y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 0.5,
                decay: 0.08,
                size: 4 + Math.random() * 2,
                color: Math.random() > 0.3 ? '#FFD700' : '#FF4500',
                type: 'dot'
            });
        }

        // Shockwave at both positions
        game.particles.spawnShockwave(startX, startY, '#1E90FF', 40, 0.3);
        game.particles.spawnShockwave(fighter.x, fighter.y, '#FFD700', 30, 0.3);

        audioEngine.playTeleport();

        logger.log(`${fighter.name} Thruster Dodge! (${threat.type})`, 'combat');

        // Mark that dodge was triggered (for ULT)
        fighter.mechaJustDodged = true;
    }
}

// --- ULT: COUNTER PROTOCOL (Passive - triggers ATK on dodge) ---
export class MechaUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
    }

    update(fighter, context) {
        // Check if dodge was just triggered
        if (fighter.mechaJustDodged) {
            fighter.mechaJustDodged = false;

            // Trigger counter attack
            this.triggerCounterAttack(fighter, context);
        }
    }

    triggerCounterAttack(fighter, context) {
        const { game } = context;

        // Reset ATK cooldown
        fighter.cooldowns.atk = 0;

        // Fire the beam as counter attack
        if (fighter.abilities.atk) {
            fighter.abilities.atk.fireBeam(fighter, context, true);
        }

        // Visual feedback
        game.particles.spawn(fighter.x, fighter.y, '#00FF00', 10);
        game.combatText.add(fighter.x, fighter.y - fighter.radius - 20, 'COUNTER!', '#00FF00');

        audioEngine.playPowerUp();
        logger.log(`${fighter.name} Counter Protocol activated!`, 'combat');
    }

    // Override execute to do nothing (passive ability)
    execute(fighter, context) {
        // Passive - does nothing on explicit execute
    }
}
