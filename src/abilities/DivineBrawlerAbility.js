/**
 * Divine Brawler Abilities (Aoi Todo - Sorcerer Brawler)
 *
 * ATK: Black Flash - Every 4th hit deals massive crit damage
 * DEF: Boogie Woogie - Swaps positions with enemy, hijacks projectiles
 * ULT: Unshakeable Focus - Becomes immovable, doubles attack speed
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { checkWeaponHit } from '../data/weaponGeometry.js';

// --- ATK: BLACK FLASH (Passive) ---
export class DivineBrawlerAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.baseDamage = config.damage || 5;
        this.range = config.range || 15;
        this.hitCountForCrit = config.hitCountForCrit || 4;
        this.critMultHigh = config.critMultHigh || 6;
        this.critMultMid = config.critMultMid || 4;
        this.critMultLow = config.critMultLow || 3;
        this.hpThresholdHigh = config.hpThresholdHigh || 0.75;
        this.hpThresholdMid = config.hpThresholdMid || 0.5;
        this.baseKnockback = config.baseKnockback || 25;
        this.knockbackPerMult = config.knockbackPerMult || 2;
        this.baseAttackCooldown = config.baseAttackCooldown || 20;
        this.focusAttackCooldown = config.focusAttackCooldown || 10;

        this.hitCounter = 0;
    }

    update(fighter, context) {
        let hit = false;

        if (fighter.cooldowns.atk > 0) return;

        for (const enemy of context.enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            // Use weapon geometry registry for fist collision
            if (checkWeaponHit('DIVINE_BRAWLER_FISTS', fighter, enemy)) {
                this.performAttack(fighter, enemy);
                hit = true;
                break;
            }
        }
    }

    performAttack(fighter, enemy) {
        this.hitCounter++;
        let damage = this.baseDamage;
        let isBlackFlash = false;
        let finalCritMult = 1;

        // Black Flash Logic (Every Nth hit based on config)
        if (this.hitCounter >= this.hitCountForCrit) {
            const hpPercent = fighter.hp / fighter.maxHp;

            // Scaling based on HP left
            if (hpPercent > this.hpThresholdHigh) {
                finalCritMult = this.critMultHigh;
            } else if (hpPercent >= this.hpThresholdMid) {
                finalCritMult = this.critMultMid;
            } else {
                finalCritMult = this.critMultLow;
            }

            damage *= finalCritMult;
            isBlackFlash = true;
            this.hitCounter = 0;

            // Visuals
            if (finalCritMult === this.critMultHigh) {
                fighter.game.particles.spawnSuperBlackFlash(enemy.x, enemy.y);
            } else {
                fighter.game.particles.spawnBlackFlash(enemy.x, enemy.y);
            }
            logger.log(`${fighter.name} land a BLACK FLASH (${finalCritMult}x)!`, 'combat');
        }

        // Knockback for Black Flash - FIXED LOGIC
        if (isBlackFlash) {
            const angle = Math.atan2(enemy.y - fighter.y, enemy.x - fighter.x);
            const forceVal = 12; // Standardized Force
            const speed = forceVal / enemy.mass;
            enemy.dx += Math.cos(angle) * speed;
            enemy.dy += Math.sin(angle) * speed;
        }

        enemy.takeDamage(damage, false, false, fighter);

        // Standard Visuals
        audioEngine.playHit();
        if (!isBlackFlash) {
            fighter.game.particles.spawn(enemy.x, enemy.y, '#4B0082', 5);
        }

        // Attack cooldown (halved during focus)
        let cd = this.baseAttackCooldown;
        if (fighter.activeEffects.focusActive) {
            cd = this.focusAttackCooldown;
        }
        fighter.cooldowns.atk = cd;
    }
}

// --- DEF: BOOGIE WOOGIE (Active Swap) ---
export class DivineBrawlerDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.projectileCooldown = config.projectileCooldown || 120;
        this.fallbackCooldown = config.fallbackCooldown || 240;
        this.detectionRadius = config.detectionRadius || 100;
        this.approachThreshold = config.approachThreshold || 0.7;
        this.deflectLifetime = config.deflectLifetime || 180;
    }

    update(fighter, context) {
        // Manage Focus buff timer (from ULT) - handled here since DEF.update() is called every frame
        if (fighter.activeEffects.focusActive) {
            fighter.activeEffects.focusTimer--;

            // Particle aura
            if (fighter.activeEffects.focusTimer % 10 === 0) {
                fighter.game.particles.spawn(fighter.x, fighter.y, '#4B0082', 1);
            }

            if (fighter.activeEffects.focusTimer <= 0) {
                fighter.activeEffects.focusActive = false;
                fighter.mass = fighter.originalMass || 1.6;
                logger.log(`${fighter.name}'s Focus fades.`, 'info');
            }
        }

        if (fighter.cooldowns.def > 0) return;
        if (fighter.status.stun > 0) return;

        const enemy = context.enemies.find(e => e !== fighter && !e.isDead);
        if (!enemy) return;

        // Priority 1: Check for approaching projectiles
        const approachingProjectile = this.findApproachingProjectile(fighter, context.game);

        if (approachingProjectile) {
            this.execute(fighter, { enemy, game: context.game, triggeredByProjectile: true });
            fighter.cooldowns.def = this.projectileCooldown;
            fighter.maxCooldowns.def = this.projectileCooldown;
            return;
        }

        // Priority 2: Fallback swap
        if (!fighter._fallbackSwapTimer) fighter._fallbackSwapTimer = 0;
        fighter._fallbackSwapTimer++;

        if (fighter._fallbackSwapTimer >= this.fallbackCooldown) {
            this.execute(fighter, { enemy, game: context.game, triggeredByProjectile: false });
            fighter.cooldowns.def = this.projectileCooldown;
            fighter.maxCooldowns.def = this.projectileCooldown;
            fighter._fallbackSwapTimer = 0;
        }
    }

    findApproachingProjectile(fighter, game) {
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
                return p;
            }
        }
        return null;
    }

    execute(fighter, context) {
        const enemy = context.enemy;
        if (!enemy) return;

        // 1. SWAP POSITIONS
        const oldX = fighter.x;
        const oldY = fighter.y;

        // Visuals Pre-Swap
        context.game.particles.spawn(fighter.x, fighter.y, '#4B0082', 10);
        context.game.particles.spawn(enemy.x, enemy.y, '#FF0000', 10);

        // SWAP PHYSICS
        fighter.x = enemy.x;
        fighter.y = enemy.y;
        enemy.x = oldX;
        enemy.y = oldY;

        // 2. PROJECTILE HIJACK
        let hijackedCount = 0;
        context.game.projectiles.forEach(p => {
            if (p.owner === enemy) {
                p.owner = fighter;
                p.isDeflected = true;
                p.deflectLifetime = this.deflectLifetime;
                p.isHijacked = true;
                hijackedCount++;
            }
        });

        // 3. VISUALS & AUDIO
        context.game.particles.spawnShockwave(fighter.x, fighter.y, '#4B0082');
        context.game.particles.spawnShockwave(enemy.x, enemy.y, '#4B0082');

        audioEngine.playPowerUp();

        let logMsg = `${fighter.name} CLAPPED & Swapped!`;
        if (context.triggeredByProjectile) logMsg += ' (Dodged projectile!)';
        if (hijackedCount > 0) logMsg += ` Hijacked ${hijackedCount} projectiles!`;
        logger.log(logMsg, 'combat');
    }
}

// --- ULT: UNSHAKEABLE FOCUS (Active Buff) ---
export class DivineBrawlerUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.duration = config.duration || 300;
        this.cooldown = config.cooldown || 600;
        this.immovableMass = config.immovableMass || 20;
    }

    execute(fighter, context) {
        // Activate Buff
        fighter.activeEffects.focusActive = true;
        fighter.activeEffects.focusTimer = this.duration;

        // Massive Mass Increase
        fighter.originalMass = fighter.mass;
        fighter.mass = this.immovableMass;

        // Visuals
        audioEngine.playPowerUp();
        fighter.game.particles.spawn(fighter.x, fighter.y, '#4B0082', 30);
        logger.log(`${fighter.name} enters UNSHAKEABLE FOCUS!`, 'combat');

        // Set CD
        fighter.cooldowns.ult = this.cooldown;
        fighter.maxCooldowns.ult = this.cooldown;
    }

    // NOTE: ULT triggers via execute() from Fighter.js when HP < 50%
    // Buff timer management is handled in DivineBrawlerDefAbility.update()
}
