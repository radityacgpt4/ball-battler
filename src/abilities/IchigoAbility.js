/**
 * Soul Reaper Abilities (Ichigo Kurosaki inspired)
 *
 * ATK: Zangetsu Slash - Rotation-based melee attack with oversized khyber knife
 * DEF: Getsuga Tenshou - Every 5 HP missing, unleash crescent-shaped projectile
 * ULT: Bankai Tensa Zangetsu - Transform sword to thin black blade, boost speed/rotation
 *
 * ALL configurable properties are loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { checkWeaponHit, checkWeaponHitTower } from '../data/weaponGeometry.js';
import { Projectile } from '../entities/Projectile.js';
import { LinearMovement, GetsugaBehavior } from '../components/ProjectileBehaviors.js';
import { GetsugaTenshouRenderer } from '../components/ProjectileRenderers.js';

// =============================================================================
// ATK: Zangetsu Slash (Melee Passive)
// =============================================================================
export class IchigoAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.range = config.range || 55;
        this.damage = config.damage || 6;
        this.attackCooldown = config.attackCooldown || 18;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        const { enemies, game } = context;

        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const isBankai = fighter.activeEffects && fighter.activeEffects.bankaiActive;
            const weaponKey = isBankai ? 'SOUL_REAPER_TENSA' : 'SOUL_REAPER_ZANGETSU';

            // Use weapon geometry registry for collision
            if (checkWeaponHit(weaponKey, fighter, enemy)) {
                if (fighter.cooldowns.atk <= 0) {
                    // Check if blocked by shield (only when actually attacking)
                    if (enemy.isBlockedByShield(fighter.x, fighter.y, this.damage)) {
                        const shieldX = enemy.x + Math.cos(enemy.angle) * (enemy.radius + 8);
                        const shieldY = enemy.y + Math.sin(enemy.angle) * (enemy.radius + 8);
                        game.combatText.blocked(enemy.x, enemy.y - enemy.radius);
                        game.particles.spawn(shieldX, shieldY, '#1E90FF', 8);
                        audioEngine.playBlock();
                        logger.log(`${enemy.name} blocked attack from ${fighter.name}`, 'combat');
                        fighter.cooldowns.atk = this.attackCooldown;
                        continue;
                    }
                    fighter.meleeHits++;
                    enemy.takeDamage(this.damage, false, false, fighter);

                    const tipX = fighter.x + Math.cos(fighter.angle) * (fighter.radius + this.range);
                    const tipY = fighter.y + Math.sin(fighter.angle) * (fighter.radius + this.range);
                    game.particles.spawn(tipX, tipY, '#fff', 5);

                    audioEngine.playRealisticSlash();
                    audioEngine.playHit();
                    logger.log(`${fighter.name} hit ${enemy.name} for ${this.damage} dmg`, 'combat');
                    fighter.cooldowns.atk = this.attackCooldown;
                }
            }
        }

        // --- TOWER COLLISION (Ballista Defensive Towers) ---
        for (const ent of game.entities) {
            if (!ent.ballistaTowers || ent.ballistaTowers.length === 0) continue;
            if (ent.id === fighter.id) continue;

            for (const tower of ent.ballistaTowers) {
                if (tower.hp <= 0) continue;
                if (fighter.cooldowns.atk > 0) continue;

                const isBankai = fighter.activeEffects && fighter.activeEffects.bankaiActive;
                const weaponKey = isBankai ? 'SOUL_REAPER_TENSA' : 'SOUL_REAPER_ZANGETSU';

                if (checkWeaponHitTower(weaponKey, fighter, tower, this.damage, game)) {
                    fighter.cooldowns.atk = this.attackCooldown;
                    break;
                }
            }
        }
    }
}

// =============================================================================
// DEF: Getsuga Tenshou (Reactive Projectile on Damage)
// =============================================================================
export class IchigoDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.hpThreshold = config.hpThreshold || 5; // Every 5 HP missing
        this.damage = config.damage || 6;
        this.ultDamage = config.ultDamage || 8;
        this.projectileSpeed = config.projectileSpeed || 14;
        this.explosionRadius = config.explosionRadius || 60;
        this.stunDuration = config.stunDuration || 60; // 1 second
        this.getsugaDelay = config.getsugaDelay || 10; // Frames between each getsuga
        this.explosionDamage = config.explosionDamage || 12;
        this.explosionUltDamage = config.explosionUltDamage || 15;
        this.explodeOnWall = config.explodeOnWall || false;

        // Track HP thresholds crossed
        this.lastThresholdHP = null;

        // Queue system for delayed firing
        this.getsugaQueue = 0; // Number of getsugas pending
        this.getsugaCooldown = 0; // Current cooldown timer
    }

    update(fighter, context) {
        // Initialize threshold tracking based on total damage taken
        if (this.lastThresholdHP === null) {
            this.lastThresholdHP = fighter.hp;
        }

        // Calculate thresholds based on damage taken (e.g. 5, 10, 15...)
        const lastDamageTaken = fighter.maxHp - this.lastThresholdHP;
        const currentDamageTaken = fighter.maxHp - fighter.hp;

        const lastThreshold = Math.floor(lastDamageTaken / this.hpThreshold);
        const currentThreshold = Math.floor(currentDamageTaken / this.hpThreshold);

        if (currentThreshold > lastThreshold) {
            // We crossed a new 5-HP loss boundary
            const getsugaCount = currentThreshold - lastThreshold;
            this.getsugaQueue += getsugaCount;
        }

        this.lastThresholdHP = fighter.hp;

        // Process queued getsugas with delay
        if (this.getsugaQueue > 0 && this.getsugaCooldown <= 0) {
            this.fireGetsuga(fighter, context);
            this.getsugaQueue--;
            this.getsugaCooldown = this.getsugaDelay;
        }

        // Decrement cooldown
        if (this.getsugaCooldown > 0) {
            this.getsugaCooldown--;
        }
    }

    fireGetsuga(fighter, context) {
        const { game } = context;
        const isBankai = fighter.activeEffects && fighter.activeEffects.bankaiActive;

        const spawnDist = fighter.radius + 15;
        const spawnX = fighter.x + Math.cos(fighter.angle) * spawnDist;
        const spawnY = fighter.y + Math.sin(fighter.angle) * spawnDist;

        const damage = isBankai ? this.ultDamage : this.damage;

        const projectile = new Projectile(
            fighter,
            spawnX,
            spawnY,
            fighter.angle,
            this.projectileSpeed,
            damage,
            game
        );

        // Configure Getsuga properties - larger radius to match wider crescent
        projectile.radius = 15;
        projectile.isGetsugaTenshou = true;
        projectile.isBankaiGetsuga = isBankai;
        projectile.explosionRadius = this.explosionRadius;
        projectile.explosionDamage = isBankai ? this.explosionUltDamage : this.explosionDamage;
        projectile.deflectRadius = this.explosionRadius * 0.75; // Logic-visual bridge
        projectile.stunDuration = this.stunDuration;
        projectile.explodeOnWall = this.explodeOnWall;

        // Impact properties
        projectile.impactSound = isBankai ? 'getsugaBankai' : 'getsuga';
        projectile.impactParticle = isBankai ? 'getsugaBankai' : 'getsugaBlue';
        projectile.statusEffect = { type: 'STUN', duration: this.stunDuration };
        projectile.piercing = false;

        // Set up renderer and behaviors (LinearMovement + GetsugaBehavior for deflection)
        projectile.renderer = new GetsugaTenshouRenderer(isBankai);
        projectile.addComponent(new LinearMovement());
        projectile.addComponent(new GetsugaBehavior());

        game.projectiles.push(projectile);

        // Visual and audio effects
        game.particles.spawnEffect('getsugaMuzzle', spawnX, spawnY);

        if (isBankai) {
            audioEngine.playGetsugaBankai();
        } else {
            audioEngine.playGetsuga();
        }

        logger.log(`${fighter.name} fires ${isBankai ? 'Black ' : ''}Getsuga Tenshou!`, 'combat');
    }
}

// =============================================================================
// ULT: Bankai Tensa Zangetsu (Transform State)
// =============================================================================
export class IchigoUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 240;
        this.duration = config.duration || 480; // 8 seconds
        this.speedBoost = config.speedBoost || 0.5; // 50% increase
        this.rotationBoost = config.rotationBoost || 0.75; // 75% increase

        // Pulsating Stun properties
        this.pulseInterval = config.bankaiPulseInterval || 120;
        this.pulseRadius = config.bankaiPulseRadius || 180;
        this.pulseStun = config.bankaiPulseStun || 60;

        // Evasion properties
        this.baseEvasion = config.baseEvasion || 0.15;
        this.extraEvasionPerStep = config.extraEvasionPerStep || 0.03;
        this.hpStep = config.hpStep || 5;
        this.maxEvasion = config.maxEvasion || 0.85;
        this.evasionHPThreshold = config.evasionHPThreshold || 0.5;
    }

    canUse(fighter, context) {
        return super.canUse(fighter, context);
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.ult = this.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 999999; // Permanent once activated
        fighter.activeEffects.bankaiActive = true;

        // Store original values
        fighter.activeEffects.bankaiSpeedBoost = this.speedBoost;
        fighter.activeEffects.bankaiRotationBoost = this.rotationBoost;
        fighter.activeEffects.bankaiPulseTimer = 0;

        // Visual effects
        game.particles.spawnEffect('bankaiTransform', fighter.x, fighter.y);

        // Audio
        audioEngine.playBankai();

        logger.log(`${fighter.name} activates BANKAI: Tensa Zangetsu!`, 'combat');
    }

    update(fighter, context) {
        // --- Pulsating Stun Logic ---
        if (fighter.activeEffects.bankaiActive) {
            fighter.activeEffects.bankaiPulseTimer++;
            if (fighter.activeEffects.bankaiPulseTimer >= this.pulseInterval) {
                fighter.activeEffects.bankaiPulseTimer = 0;

                const { game, enemies } = context;

                // Visual & Audio
                game.particles.spawnEffect('bankaiPulse', fighter.x, fighter.y, {
                    maxRadius: this.pulseRadius
                });
                audioEngine.playBankaiPulse(); // Spiritual pressure crackle

                // Apply stun to nearby enemies
                for (const enemy of enemies) {
                    if (enemy === fighter || enemy.isDead) continue;

                    const dist = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
                    if (dist < this.pulseRadius + enemy.radius) {
                        enemy.applyStatus('STUN', this.pulseStun);
                        // Visual feedback on enemy (small impact effect)
                        game.particles.spawn(enemy.x, enemy.y, '#8B00FF', 6);
                    }
                }
            }
        }
    }

    stop(fighter, context) {
        // Bankai is permanent once activated — this should not be called
    }

    onDamage(fighter, damage, context) {
        // Evasion logic (Only during Bankai and NOT while stunned)
        if (fighter.activeEffects && fighter.activeEffects.bankaiActive && fighter.status.stun <= 0) {
            // Scale from the configured HP baseline (default 50% HP)
            const hpBaseline = fighter.maxHp * this.evasionHPThreshold;
            const hpBelowThreshold = Math.max(0, hpBaseline - fighter.hp);
            const extraEvasion = Math.floor(hpBelowThreshold / this.hpStep) * this.extraEvasionPerStep;
            const totalEvasion = Math.min(this.maxEvasion, this.baseEvasion + extraEvasion);

            if (Math.random() < totalEvasion) {
                const { game } = context;
                game.combatText.dodged(fighter.x, fighter.y - fighter.radius);

                // --- SHUNPO AFTERIMAGE EFFECT ---
                // Create a fading afterimage of the fighter
                game.particles.particles.push({
                    x: fighter.x, y: fighter.y,
                    vx: 0, vy: 0,
                    life: 0.4, decay: 0.1,
                    size: fighter.radius,
                    color: '#8B00FF', type: 'dot', alpha: 0.4
                });

                game.particles.spawn(fighter.x, fighter.y, '#8B00FF', 8);

                // Trigger visual transparency (ghosting)
                fighter.activeEffects.evasionTimer = 10;

                audioEngine.playSwordSwing(); // Whoosh sound
                logger.log(`${fighter.name} DODGED! (Chance: ${Math.round(totalEvasion * 100)}%)`, 'combat');
                return false; // Negate damage
            } else {
                // Log the failure too, so user can see their current stats
                logger.log(`${fighter.name} failed to dodge. (Current Evasion: ${Math.round(totalEvasion * 100)}%)`, 'combat');
            }
        }
        return damage;
    }

    modifySpeed(fighter, speed) {
        if (fighter.activeEffects && fighter.activeEffects.bankaiActive) {
            return speed * (1 + this.speedBoost);
        }
        return speed;
    }

    modifyRotation(fighter, rotationSpeed) {
        if (fighter.activeEffects && fighter.activeEffects.bankaiActive) {
            return rotationSpeed * (1 + this.rotationBoost);
        }
        return rotationSpeed;
    }
}
