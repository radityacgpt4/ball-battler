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
import { checkWeaponHit, checkWeaponHitTower } from '../data/weaponGeometry.js';

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
        this.twinBarrelOffset = config.twinBarrelOffset || 12;

        // Melee dash properties
        this.meleeDamage = config.meleeDamage || 4;
        this.dashSpeed = config.dashSpeed || 18;
        this.dashDistance = config.dashDistance || 600;
        this.ultDashDistance = config.ultDashDistance || 800;
        this.dashDelay = config.dashDelay || 15;
        this.aimError = config.aimError !== undefined ? config.aimError : 0.4;
        this.meleeRotationMultiplier = config.meleeRotationMultiplier || 5;
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
            fighter.mechaDashDelayTimer -= (context.timeScale || 1);

            // Visual charging effect
            if (Math.floor(fighter.mechaDashDelayTimer) % 10 < (context.timeScale || 1)) {
                game.particles.particles.push({
                    x: fighter.x + (Math.random() - 0.5) * 40,
                    y: fighter.y + (Math.random() - 0.5) * 40,
                    vx: (fighter.x - (fighter.x + (Math.random() - 0.5) * 40)) * 0.1,
                    vy: (fighter.y - (fighter.y + (Math.random() - 0.5) * 40)) * 0.1,
                    life: 0.4, decay: 0.05,
                    size: 3, color: '#39FF14', type: 'dot'
                });
            }

            if (fighter.mechaDashDelayTimer <= 0) {
                this.executeMeleeDash(fighter, context);
            }
            return;
        }

        // Auto-aim logic (Smooth position tracking - eliminates jitter)
        const target = this.findBestTarget(fighter, enemies);

        if (target) {
            // Initialize smooth tracking position if not set
            if (fighter.mechaTrackX === undefined) {
                fighter.mechaTrackX = target.x;
                fighter.mechaTrackY = target.y;
            }

            // Smoothly lerp tracked position towards target (not angle!)
            // This handles moving targets much better than angle lerping
            const trackingSpeed = 0.06; // Lower = smoother but slower tracking
            fighter.mechaTrackX += (target.x - fighter.mechaTrackX) * trackingSpeed;
            fighter.mechaTrackY += (target.y - fighter.mechaTrackY) * trackingSpeed;

            // Calculate angle from smoothed position (stable, no jitter)
            fighter.mechaTargetAngle = Math.atan2(
                fighter.mechaTrackY - fighter.y,
                fighter.mechaTrackX - fighter.x
            );

            // Store target for firing
            fighter.mechaCurrentTarget = target;
        } else {
            // No target - smoothly return to body angle
            if (fighter.mechaTargetAngle !== undefined) {
                let angleDiff = fighter.angle - fighter.mechaTargetAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                fighter.mechaTargetAngle += angleDiff * 0.03;
            }
            fighter.mechaCurrentTarget = null;
            // Reset tracking position
            fighter.mechaTrackX = undefined;
            fighter.mechaTrackY = undefined;
        }

        // Check cooldown for firing
        if (fighter.cooldowns.atk > 0) return;

        // Fire the beam (error applied only when firing, not every frame)
        this.fireBeam(fighter, context);
    }

    findBestTarget(fighter, enemies) {
        // Simple nearest target (no angle in scoring to prevent flip-flopping)
        let bestTarget = null;
        let minDist = 600; // Range

        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist < minDist) {
                minDist = dist;
                bestTarget = enemy;
            }
        }

        return bestTarget;
    }

    fireBeam(fighter, context, isCounterAttack = false) {
        const { game } = context;

        // Base angle from smooth tracking
        const baseAngle = fighter.mechaTargetAngle !== undefined ? fighter.mechaTargetAngle : fighter.angle;

        // Apply error only when firing
        const errorMargin = (Math.random() - 0.5) * this.aimError;
        const fireAngle = baseAngle + errorMargin;

        // ULT: Twin Cannon Protocol - Fire 2 projectiles from side barrels
        if (fighter.mechaUltActive) {
            const offsets = [-this.twinBarrelOffset, this.twinBarrelOffset];

            offsets.forEach(offsetY => {
                // Calculate barrel position relative to fighter
                const localX = 30;
                const localY = offsetY;

                // Rotate barrel position to match fireAngle
                const cos = Math.cos(fireAngle);
                const sin = Math.sin(fireAngle);
                const worldX = fighter.x + (localX * cos - localY * sin);
                const worldY = fighter.y + (localX * sin + localY * cos);

                const p = new Projectile(
                    fighter,
                    worldX,
                    worldY,
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

                p.renderer = new MechaBeamRenderer();
                p.addComponent(new MechaBeamBehavior());
                p.impactSound = 'explosion';
                p.impactParticle = 'mechaExplosion';

                game.projectiles.push(p);

                // Muzzle flash for each barrel
                game.particles.spawn(worldX, worldY, '#00BFFF', 10);
                game.particles.spawnBeam(
                    worldX - cos * 10, worldY - sin * 10,
                    worldX, worldY,
                    '#FFFFFF', 5, 0.15
                );
            });

            audioEngine.playGunshot();
            audioEngine.playGunshot(); // Double sound for twin barrels
        } else {
            // Regular single Beam Rifle
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

            p.renderer = new MechaBeamRenderer();
            p.addComponent(new MechaBeamBehavior());
            p.impactSound = 'explosion';
            p.impactParticle = 'mechaExplosion';

            game.projectiles.push(p);

            // Muzzle flash
            game.particles.spawn(p.x, p.y, '#FFD700', 8);
            game.particles.spawnBeam(
                fighter.x, fighter.y,
                p.x, p.y,
                '#FFD700', 4, 0.15
            );

            audioEngine.playGunshot();
        }

        // Store dash direction for melee follow-up
        fighter.mechaPendingDash = {
            angle: fireAngle,
            triggered: false
        };

        // Start cooldown
        if (!isCounterAttack) {
            fighter.cooldowns.atk = this.cooldown;
            fighter.maxCooldowns.atk = this.cooldown;
        }

        logger.log(`${fighter.name} fired ${fighter.mechaUltActive ? 'Twin Cannons' : 'Beam Rifle'}!`, 'combat');
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

        // Calculate duration based on Distance / Speed
        const distance = fighter.mechaUltActive ? this.ultDashDistance : this.dashDistance;
        const duration = Math.ceil(distance / this.dashSpeed);
        fighter.mechaDashTimer = duration;

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

        fighter.mechaDashTimer -= (timeScale || 1);

        // Track rotation for multi-hit (resets hit list every 360 degrees)
        let angleDiff = fighter.angle - fighter.mechaLastAngle;
        // Handle angle wrapping
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        fighter.mechaRotationAccumulator += Math.abs(angleDiff);
        fighter.mechaLastAngle = fighter.angle;

        if (fighter.mechaRotationAccumulator >= Math.PI * 2) {
            fighter.mechaHitList = [];
            fighter.mechaTowerHitList = []; // Reset tower hits as well
            fighter.mechaRotationAccumulator -= Math.PI * 2;
        }

        // Rocket boost trail (Spawn every frame for smooth trail)
        this.spawnRocketBoost(fighter, game);

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

                const dealt = enemy.takeDamage(this.meleeDamage, false, false, fighter);
                if (dealt !== false) {
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
        }

        // --- TOWER COLLISION (Ballista Defensive Towers) ---
        // Check all entities for their towers
        for (const ent of game.entities) {
            if (!ent.ballistaTowers || ent.ballistaTowers.length === 0) continue;
            // Only enemy towers can be hit
            if (ent.id === fighter.id) continue;

            for (const tower of ent.ballistaTowers) {
                if (tower.hp <= 0) continue;

                // Use the tower hit list to prevent multi-hit per rotation
                if (!fighter.mechaTowerHitList) fighter.mechaTowerHitList = [];

                checkWeaponHitTower('MECHA_BLADE', fighter, tower, this.meleeDamage, game, fighter.mechaTowerHitList);
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
        // High-intensity Afterburner (Wing Zero Style)
        const boostAngle = fighter.mechaDashAngle + Math.PI; // Behind the fighter
        const offsets = [-0.65, 0.65]; // Twin thruster offsets (Wider stance for "Thick" look)

        offsets.forEach(offset => {
            // Calculate nozzle position
            const angle = boostAngle + offset;
            const startX = fighter.x + Math.cos(angle) * (fighter.radius - 2);
            const startY = fighter.y + Math.sin(angle) * (fighter.radius - 2);

            const flameLen = 70; // Longer flame

            // Main Afterburner Flame Particle
            game.particles.particles.push({
                x: startX,
                y: startY,
                vx: (Math.random() - 0.5) * 2, // Slight drift
                vy: (Math.random() - 0.5) * 2,
                life: 0.35, // Live long enough to trail
                decay: 0.08,
                size: 20, // Thicker base
                color: '#00BFFF',
                type: 'custom',
                draw: (ctx, p) => {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(angle);
                    ctx.globalCompositeOperation = 'lighter'; // Key for "Energy" look

                    const lifeRatio = p.life / 0.35; // Normalized 0-1
                    const scale = 1 + (1 - lifeRatio) * 0.5; // Expands slightly as it dies
                    const currentLen = flameLen * lifeRatio * scale;
                    const currentWidth = 12 * lifeRatio * scale; // Thicker base (12px)

                    // 1. Outer Plasma Cone (Blue)
                    const gradient = ctx.createLinearGradient(0, 0, currentLen, 0);
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                    gradient.addColorStop(0.2, 'rgba(0, 191, 255, 0.8)'); // Deep Sky Blue
                    gradient.addColorStop(0.7, 'rgba(0, 0, 255, 0.4)');
                    gradient.addColorStop(1, 'rgba(0, 0, 100, 0)');

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.moveTo(0, -currentWidth / 2); // Nozzle top
                    ctx.lineTo(currentLen, 0); // Tip
                    ctx.lineTo(0, currentWidth / 2); // Nozzle bottom
                    ctx.arc(0, 0, currentWidth / 2, Math.PI / 2, -Math.PI / 2); // Round nozzle base
                    ctx.fill();

                    // 2. Mach Diamonds (Bright shockwaves in the flow)
                    // Only visible if flame is healthy
                    if (lifeRatio > 0.3) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

                        // Diamond 1
                        const d1Pos = currentLen * 0.3;
                        const d1Size = currentWidth * 0.6;
                        ctx.beginPath();
                        ctx.moveTo(d1Pos, -d1Size / 2);
                        ctx.lineTo(d1Pos + d1Size, 0);
                        ctx.lineTo(d1Pos, d1Size / 2);
                        ctx.lineTo(d1Pos - d1Size, 0);
                        ctx.fill();

                        // Diamond 2
                        const d2Pos = currentLen * 0.6;
                        const d2Size = currentWidth * 0.4;
                        ctx.beginPath();
                        ctx.moveTo(d2Pos, -d2Size / 2);
                        ctx.lineTo(d2Pos + d2Size, 0);
                        ctx.lineTo(d2Pos, d2Size / 2);
                        ctx.lineTo(d2Pos - d2Size, 0);
                        ctx.fill();
                    }

                    ctx.restore();
                }
            });

            // Occasional high-speed sparks for "Force"
            if (Math.random() < 0.3) {
                const speed = 10 + Math.random() * 10;
                game.particles.particles.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(angle + (Math.random() - 0.5) * 0.2) * speed,
                    vy: Math.sin(angle + (Math.random() - 0.5) * 0.2) * speed,
                    life: 0.2,
                    decay: 0.1,
                    size: 2,
                    color: '#FFFFFF',
                    type: 'line', // Streaks
                    length: 15
                });
            }
        });
    }

    spawnBladeTrail(fighter, game) {
        // Energy blade trail particles - Synchronized with hitbox and renderer
        const bladeAngle = fighter.angle;
        const startOffset = 2; // Matches Renderer startX offset
        const totalHitLength = 54.5; // (Hitbox 52.5 + Offset 2)

        const startX = fighter.x + Math.cos(bladeAngle) * (fighter.radius + startOffset);
        const startY = fighter.y + Math.sin(bladeAngle) * (fighter.radius + startOffset);
        const tipX = fighter.x + Math.cos(bladeAngle) * (fighter.radius + totalHitLength);
        const tipY = fighter.y + Math.sin(bladeAngle) * (fighter.radius + totalHitLength);

        // Jittering glow effect for energy blade
        const jitter = (Math.random() - 0.5) * 2;
        game.particles.particles.push({
            x: tipX + jitter,
            y: tipY + jitter,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 0.25,
            decay: 0.1,
            size: 3 + Math.random() * 2,
            color: '#39FF14', // Neon Green
            type: 'square'
        });

        // Continuous Trail beam
        game.particles.spawnBeam(
            startX, startY,
            tipX, tipY,
            '#39FF14', 6, 0.15 // Neon Green Beam
        );

        // Inner white core
        game.particles.spawnBeam(
            startX, startY,
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
        const { game, enemies } = context;

        // Counter Protocol: Trigger counter-attack after dodge (when ULT is active)
        if (fighter.mechaJustDodged && fighter.mechaUltActive) {
            fighter.mechaJustDodged = false;
            this.triggerCounterAttack(fighter, context);
        } else if (fighter.mechaJustDodged) {
            // Clear flag even if Counter Protocol isn't active
            fighter.mechaJustDodged = false;
        }

        if (fighter.cooldowns.def > 0) return;
        if (fighter.status.stun > 0) return;
        if (fighter.mechaDashActive) return; // Don't dodge during melee dash

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

        // Shockwave at both positions
        game.particles.spawnShockwave(startX, startY, '#1E90FF', 40, 0.3);
        game.particles.spawnShockwave(fighter.x, fighter.y, '#FFD700', 30, 0.3);

        // --- ANIME ACCURATE THRUSTER DODGE VISUAL ---
        const boostAngle = dodgeAngle + Math.PI;
        const offsets = [-0.6, 0.6];
        offsets.forEach(offset => {
            const angle = boostAngle + offset;
            const sX = fighter.x + Math.cos(angle) * (fighter.radius - 4);
            const sY = fighter.y + Math.sin(angle) * (fighter.radius - 4);

            const flameLen = 40;
            game.particles.particles.push({
                x: sX, y: sY, vx: 0, vy: 0,
                life: 0.2, decay: 0.08, size: 12,
                color: '#E0FFFF', type: 'custom',
                draw: (ctx, p) => {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(angle);
                    const width = 6 * (1 - p.life);
                    const length = flameLen * (1 - p.life);
                    const gradient = ctx.createLinearGradient(0, 0, length, 0);
                    gradient.addColorStop(0, '#FFFFFF');
                    gradient.addColorStop(0.3, '#00BFFF');
                    gradient.addColorStop(1, 'rgba(0, 0, 139, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.moveTo(0, -width * 0.2);
                    ctx.lineTo(0, width * 0.2);
                    ctx.lineTo(length * 0.7, width);
                    ctx.lineTo(length, 0);
                    ctx.lineTo(length * 0.7, -width);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            });
        });

        audioEngine.playTeleport();

        logger.log(`${fighter.name} Thruster Dodge! (${threat.type})`, 'combat');

        // Mark that dodge was triggered (for ULT counter-attack)
        fighter.mechaJustDodged = true;
    }

    // Counter Protocol counter-attack (called when dodge triggers with ULT active)
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
        logger.log(`${fighter.name} Counter Protocol triggered!`, 'combat');
    }
}

// --- ULT: TWIN CANNON PROTOCOL (Active - fires 2 lasers and increases dash range) ---
export class MechaUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration || 600;
        this.cooldown = config.cooldown || 1800; // 30 seconds
    }

    update(fighter, context) {
        // Permanent ULT — visual pulse every 60 frames while active
        if (fighter.mechaUltActive) {
            this.pulseTimer = (this.pulseTimer || 0) + (context.timeScale || 1);
            if (Math.floor(this.pulseTimer) % 60 < (context.timeScale || 1)) {
                context.game.particles.spawnShockwave(fighter.x, fighter.y, '#00BFFF', 40, 0.2);
            }
        }
    }

    execute(fighter, context) {
        const { game } = context;

        // Activate Twin Cannon Protocol
        fighter.mechaUltActive = true;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 999999; // Permanent once activated

        // Activation visuals
        game.particles.spawnShockwave(fighter.x, fighter.y, '#FFFFFF', 80, 0.5);
        game.particles.spawn(fighter.x, fighter.y, '#00BFFF', 20);
        game.combatText.text(fighter.x, fighter.y - fighter.radius - 30, 'TWIN CANNON PROTOCOL', '#00BFFF');
        audioEngine.playPowerUp();

        // Set cooldown
        fighter.cooldowns.ult = this.cooldown;
        fighter.maxCooldowns.ult = this.cooldown;

        logger.log(`${fighter.name} Twin Cannon Protocol ACTIVATED!`, 'combat');
    }

    deactivate(fighter, context) {
        // Permanent ULT — this should not be called
    }
}
