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
import { checkWeaponHit } from '../data/weaponGeometry.js';

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
        this.dashDelay = config.dashDelay || 60;
        this.aimError = config.aimError || 0;
        this.meleeRotationMultiplier = config.meleeRotationMultiplier || 3;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        const { game, enemies } = context;

        // Handle ongoing melee dash
        if (fighter.mechaDashActive) {
            this.handleMeleeDash(fighter, context);
            return;
        }

        // Handle dash delay after projectile impact (1-second delay)
        if (fighter.mechaDashDelayTimer > 0) {
            fighter.mechaDashDelayTimer--;

            // Visual charging effect
            if (fighter.mechaDashDelayTimer % 10 === 0) {
                game.particles.particles.push({
                    x: fighter.x + (Math.random() - 0.5) * 40,
                    y: fighter.y + (Math.random() - 0.5) * 40,
                    vx: (fighter.x - (fighter.x + (Math.random() - 0.5) * 40)) * 0.1,
                    vy: (fighter.y - (fighter.y + (Math.random() - 0.5) * 40)) * 0.1,
                    life: 0.4, decay: 0.05,
                    size: 3, color: '#00FFFF', type: 'dot'
                });
            }

            if (fighter.mechaDashDelayTimer <= 0) {
                this.executeMeleeDash(fighter, context);
            }
            return;
        }

        // Auto-aim logic (Aimbot style)
        // Track nearest opponent - store target angle separately from body rotation
        const target = this.findAutoAimTarget(fighter, enemies);
        if (target) {
            const dx = target.x - fighter.x;
            const dy = target.y - fighter.y;
            const targetAngle = Math.atan2(dy, dx);

            // Random error based on config
            const error = (Math.random() - 0.5) * this.aimError;
            // Store targeting angle separately - don't modify body rotation
            fighter.mechaTargetAngle = targetAngle + error;
        } else {
            // No target - use body angle for firing
            fighter.mechaTargetAngle = fighter.angle;
        }

        // Check cooldown for firing
        if (fighter.cooldowns.atk > 0) return;

        // Fire the beam
        this.fireBeam(fighter, context);
    }

    findAutoAimTarget(fighter, enemies) {
        let nearest = null;
        let minDist = 700; // Search range

        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            const d = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
            if (d < minDist) {
                minDist = d;
                nearest = enemy;
            }
        }
        return nearest;
    }

    fireBeam(fighter, context, isCounterAttack = false) {
        const { game } = context;

        // Use targeting angle for projectile (not body angle)
        const fireAngle = fighter.mechaTargetAngle !== undefined ? fighter.mechaTargetAngle : fighter.angle;

        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(fireAngle) * 30,
            fighter.y + Math.sin(fireAngle) * 30,
            fireAngle,
            this.projectileSpeed,
            this.projectileDamage,
            game
        );

        p.radius = 8;
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

        // Store dash direction for melee follow-up (uses targeting angle)
        fighter.mechaPendingDash = {
            angle: fireAngle,
            triggered: false
        };

        // Start cooldown
        if (!isCounterAttack) {
            fighter.cooldowns.atk = this.cooldown;
            fighter.maxCooldowns.atk = this.cooldown;
        }

        logger.log(`${fighter.name} fired Beam Rifle!`, 'combat');
    }

    // Called when projectile hits something - starts the delay from config
    triggerMeleeDash(fighter, context) {
        if (!fighter.mechaPendingDash || fighter.mechaPendingDash.triggered) return;

        fighter.mechaPendingDash.triggered = true;

        // Start delay from config
        fighter.mechaDashDelayTimer = this.dashDelay;
        fighter.mechaDashAngle = fighter.mechaPendingDash.angle;

        logger.log(`${fighter.name} preparing melee follow-up...`, 'combat');
    }

    // Actually executes the dash after the delay
    executeMeleeDash(fighter, context) {
        fighter.mechaDashActive = true;
        fighter.mechaDashTimer = this.dashDuration;
        fighter.mechaHitList = [];
        fighter.mechaRotationAccumulator = 0;
        fighter.mechaLastAngle = fighter.angle;

        // Store original values for rotation
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
        const { game, enemies, timeScale = 1.0 } = context;

        fighter.mechaDashTimer--;

        // Track rotation for multi-hit (resets hit list every 360 degrees)
        let angleDiff = fighter.angle - fighter.mechaLastAngle;
        // Handle angle wrapping
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        fighter.mechaRotationAccumulator += Math.abs(angleDiff);
        fighter.mechaLastAngle = fighter.angle;

        if (fighter.mechaRotationAccumulator >= Math.PI * 2) {
            fighter.mechaHitList = [];
            fighter.mechaRotationAccumulator -= Math.PI * 2;
        }

        // Rocket boost trail
        if (fighter.mechaDashTimer % 2 === 0) {
            this.spawnRocketBoost(fighter, game);
        }

        // Energy blade trail
        this.spawnBladeTrail(fighter, game);

        // --- PIXEL PERFECT DIRECTIONAL BLADE COLLISION (Using Weapon Geometry Registry) ---
        // Check for melee hits using weapon registry
        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            if (fighter.mechaHitList && fighter.mechaHitList.includes(enemy.id)) continue;

            // Directional blade collision check using registry
            if (checkWeaponHit('MECHA_BLADE', fighter, enemy)) {
                // Hit!
                if (!fighter.mechaHitList) fighter.mechaHitList = [];
                fighter.mechaHitList.push(enemy.id);

                enemy.takeDamage(this.meleeDamage, false, false, fighter);

                // Blade slash effect
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
        const offsets = [-0.5, 0.5]; // Twin thruster offsets (radians)

        offsets.forEach(offset => {
            const angle = boostAngle + offset;
            const startX = fighter.x + Math.cos(angle) * (fighter.radius - 5);
            const startY = fighter.y + Math.sin(angle) * (fighter.radius - 5);

            // Main thruster flame - Bigger and longer
            for (let i = 0; i < 3; i++) {
                const spread = (Math.random() - 0.5) * 0.3;
                const speed = 6 + Math.random() * 4;
                game.particles.particles.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(angle + spread) * speed,
                    vy: Math.sin(angle + spread) * speed,
                    life: 0.5,
                    decay: 0.05,
                    size: 6 + Math.random() * 4,
                    color: Math.random() > 0.4 ? '#FF4500' : '#FFD700',
                    type: 'dot'
                });
            }

            // Blue core flame
            game.particles.particles.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 0.3,
                decay: 0.08,
                size: 8,
                color: '#00BFFF',
                type: 'dot'
            });
        });
    }

    spawnBladeTrail(fighter, game) {
        // Energy blade trail particles - Compact size
        const bladeAngle = fighter.angle;
        const bladeLength = 40; // 30% smaller feel
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

        // Continuous Trail beam
        game.particles.spawnBeam(
            fighter.x + Math.cos(bladeAngle) * fighter.radius,
            fighter.y + Math.sin(bladeAngle) * fighter.radius,
            tipX, tipY,
            '#00FFFF', 6, 0.15 // Thinner beam
        );

        // Inner white core
        game.particles.spawnBeam(
            fighter.x + Math.cos(bladeAngle) * fighter.radius,
            fighter.y + Math.sin(bladeAngle) * fighter.radius,
            tipX, tipY,
            '#FFFFFF', 2, 0.15
        );
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

        // Twin Afterburner effect (like dash rocket boost)
        const boostAngle = dodgeAngle + Math.PI; // Behind the fighter
        const offsets = [-0.5, 0.5]; // Twin thruster offsets
        offsets.forEach(offset => {
            const angle = boostAngle + offset;
            for (let i = 0; i < 4; i++) {
                const spread = (Math.random() - 0.5) * 0.3;
                const speed = 5 + Math.random() * 4;
                game.particles.particles.push({
                    x: fighter.x + Math.cos(angle) * (fighter.radius - 5),
                    y: fighter.y + Math.sin(angle) * (fighter.radius - 5),
                    vx: Math.cos(angle + spread) * speed,
                    vy: Math.sin(angle + spread) * speed,
                    life: 0.5,
                    decay: 0.06,
                    size: 6 + Math.random() * 4,
                    color: Math.random() > 0.4 ? '#FF4500' : '#FFD700',
                    type: 'dot'
                });
            }
            // Blue core
            game.particles.particles.push({
                x: fighter.x + Math.cos(angle) * (fighter.radius - 5),
                y: fighter.y + Math.sin(angle) * (fighter.radius - 5),
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 0.3,
                decay: 0.08,
                size: 8,
                color: '#00BFFF',
                type: 'dot'
            });
        });

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
        const { game } = context;

        // Only active when HP is below 50%
        if (fighter.hp > fighter.maxHp * 0.5) {
            // Reset visual state when above threshold
            if (fighter.mechaCounterProtocolActive) {
                fighter.mechaCounterProtocolActive = false;
            }
            return;
        }

        // Mark Counter Protocol as active
        if (!fighter.mechaCounterProtocolActive) {
            fighter.mechaCounterProtocolActive = true;
            // Initial activation flash
            game.particles.spawnShockwave(fighter.x, fighter.y, '#00FF00', 60, 0.5);
            game.combatText.text(fighter.x, fighter.y - fighter.radius - 30, 'COUNTER PROTOCOL ACTIVE', '#00FF00');
            audioEngine.playPowerUp();
            logger.log(`${fighter.name} Counter Protocol VISUAL EFFECT ACTIVATED! HP: ${fighter.hp}/${fighter.maxHp}`, 'combat');
        }

        // Spawn occasional energy particles for ambient effect
        if (Math.random() < 0.15) {
            const angle = Math.random() * Math.PI * 2;
            const radius = fighter.radius + 15 + Math.random() * 10;
            game.particles.particles.push({
                x: fighter.x + Math.cos(angle) * radius,
                y: fighter.y + Math.sin(angle) * radius,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 0.5,
                decay: 0.1,
                size: 3 + Math.random() * 3,
                color: '#00FF00',
                type: 'dot',
                alpha: 0.8
            });
        }

        // Check if dodge was just triggered
        if (fighter.mechaJustDodged) {
            fighter.mechaJustDodged = false;

            // Trigger counter attack
            this.triggerCounterAttack(fighter, context);
        }
    }

    // NOTE: Counter Protocol visual effect is now rendered in Renderer.js
    // via the MECHA accessory renderer (following Divine Brawler pattern)

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
        game.combatText.text(fighter.x, fighter.y - fighter.radius - 20, 'COUNTER!', '#00FF00');

        audioEngine.playPowerUp();
        logger.log(`${fighter.name} Counter Protocol activated!`, 'combat');
    }

    // Override execute to do nothing (passive ability)
    execute(fighter, context) {
        // Passive - does nothing on explicit execute
    }
}
