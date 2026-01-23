/**
 * Death God Swordsman Abilities (Ichigo Kurosaki inspired)
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
import { checkWeaponHit } from '../data/weaponGeometry.js';
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

            // Use weapon geometry registry for collision
            if (checkWeaponHit('ICHIGO_ZANGETSU', fighter, enemy)) {
                // Check if blocked by shield
                if (enemy.isBlockedByShield(fighter.x, fighter.y, this.damage)) {
                    if (fighter.cooldowns.atk <= 0) {
                        const shieldX = enemy.x + Math.cos(enemy.angle) * (enemy.radius + 8);
                        const shieldY = enemy.y + Math.sin(enemy.angle) * (enemy.radius + 8);
                        game.combatText.blocked(enemy.x, enemy.y - enemy.radius);
                        game.particles.spawn(shieldX, shieldY, '#1E90FF', 8);
                        audioEngine.playBlock();
                        logger.log(`${enemy.name} blocked attack from ${fighter.name}`, 'combat');
                        fighter.cooldowns.atk = this.attackCooldown;
                    }
                    continue;
                }

                if (fighter.cooldowns.atk <= 0) {
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
        this.pulseInterval = config.bankaiPulseInterval || 180;
        this.pulseRadius = config.bankaiPulseRadius || 120;
        this.pulseStun = config.bankaiPulseStun || 60;
    }

    canUse(fighter, context) {
        if (!super.canUse(fighter, context)) return false;
        // Only activate when HP is below 50%
        return fighter.hp < fighter.maxHp * 0.5;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.ult = this.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.bankaiActive = true;
        fighter.activeEffects.bankaiTimer = this.duration;

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
        // Handle Bankai duration
        if (fighter.activeEffects.bankaiActive) {
            fighter.activeEffects.bankaiTimer--;

            if (fighter.activeEffects.bankaiTimer <= 0) {
                fighter.activeEffects.bankaiActive = false;
                fighter.activeEffects.ultActive = false;
                logger.log(`${fighter.name}'s Bankai expires!`, 'combat');
            }

            // --- Pulsating Stun Logic ---
            fighter.activeEffects.bankaiPulseTimer++;
            if (fighter.activeEffects.bankaiPulseTimer >= this.pulseInterval) {
                fighter.activeEffects.bankaiPulseTimer = 0;

                const { game, enemies } = context;

                // Visual & Audio
                game.particles.spawnEffect('bankaiPulse', fighter.x, fighter.y, {
                    maxRadius: this.pulseRadius
                });
                audioEngine.playZap(); // Spiritual pressure crackle

                // Apply stun to nearby enemies
                for (const enemy of enemies) {
                    if (enemy === fighter || enemy.isDead) continue;

                    const dist = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
                    if (dist < this.pulseRadius + enemy.radius) {
                        enemy.applyStatus('STUN', this.pulseStun);
                        game.particles.spawnShockwave(enemy.x, enemy.y, '#8B00FF');
                    }
                }
            }
        }
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
