import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

// --- ATK: BLACK FLASH (Passive) ---
export class DivineBrawlerAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.hitCounter = 0;
        this.critMult = config.critMult || 5;
        this.baseDamage = config.damage || 4;

        // No cooldown on passive, but we track hit rate limits via main loop if needed
        // For melee passive, cooldown usually dictates hit frequency
    }

    // Called via update loop (Auto-Attack)
    update(fighter, context) {
        // Melee logic: Check distance
        const range = fighter.radius + 15;
        let hit = false;

        if (fighter.cooldowns.atk > 0) return;

        for (const enemy of context.enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist < range + enemy.radius) {
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

        // Black Flash Logic (Every 4th hit)
        if (this.hitCounter >= 4) {
            const hpPercent = fighter.hp / fighter.maxHp;

            // Scaling based on HP left:
            // > 75% -> 6x
            // 50-75% -> 4x
            // < 50% -> 3x
            if (hpPercent > 0.75) {
                finalCritMult = 6;
            } else if (hpPercent >= 0.5) {
                finalCritMult = 4;
            } else {
                finalCritMult = 3;
            }

            damage *= finalCritMult;
            isBlackFlash = true;
            this.hitCounter = 0;

            // Visuals: Red/Black Lightning
            if (finalCritMult === 6) {
                fighter.game.particles.spawnSuperBlackFlash(enemy.x, enemy.y);
            } else {
                fighter.game.particles.spawnBlackFlash(enemy.x, enemy.y);
            }
            logger.log(`${fighter.name} land a BLACK FLASH (${finalCritMult}x)!`, 'combat');
        }

        // Apply Damage
        // Increased knockback for Black Flash handled by game physics? 
        // We can manually add impulse if needed, but high damage usually feels heavy.
        // Let's add manual impulse for Black Flash
        if (isBlackFlash) {
            const angle = Math.atan2(enemy.y - fighter.y, enemy.x - fighter.x);
            const force = 25 + (finalCritMult * 2); // Scaling knockback
            enemy.dx += Math.cos(angle) * force;
            enemy.dy += Math.sin(angle) * force;
        }

        enemy.takeDamage(damage, false, false, fighter);

        // Standard Visuals
        audioEngine.playHit();
        if (!isBlackFlash) {
            fighter.game.particles.spawn(enemy.x, enemy.y, '#4B0082', 5);
        }

        // Reset CD (Attack speed)
        // If ULT is active (Unshakeable Focus), CD is halved
        let cd = 20; // ~3 hits/sec baseline
        if (fighter.activeEffects.focusActive) {
            cd = 10;
        }
        fighter.cooldowns.atk = cd;
    }
}

// --- DEF: BOOGIE WOOGIE (Active Swap) ---
export class DivineBrawlerDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.projectileCooldown = 120;  // 2s CD when dodging projectiles
        this.fallbackCooldown = 240;    // 4s CD for fallback swap
    }

    update(fighter, context) {
        if (fighter.cooldowns.def > 0) return;
        if (fighter.status.stun > 0) return;

        const enemy = context.enemies.find(e => e !== fighter && !e.isDead);
        if (!enemy) return;

        // Priority 1: Check for approaching projectiles
        const approachingProjectile = this.findApproachingProjectile(fighter, context.game);

        if (approachingProjectile) {
            // Swap to dodge the projectile!
            this.execute(fighter, { enemy, game: context.game, triggeredByProjectile: true });
            fighter.cooldowns.def = this.projectileCooldown;
            fighter.maxCooldowns.def = this.projectileCooldown;
            return;
        }

        // Priority 2: Fallback - swap anyway if cooldown allows
        // Use a separate internal timer for fallback
        if (!fighter._fallbackSwapTimer) fighter._fallbackSwapTimer = 0;
        fighter._fallbackSwapTimer++;

        if (fighter._fallbackSwapTimer >= this.fallbackCooldown) {
            this.execute(fighter, { enemy, game: context.game, triggeredByProjectile: false });
            fighter.cooldowns.def = this.projectileCooldown; // Short CD after any swap
            fighter.maxCooldowns.def = this.projectileCooldown;
            fighter._fallbackSwapTimer = 0;
        }
    }

    findApproachingProjectile(fighter, game) {
        const detectionRadius = 100; // How close projectile must be
        const approachThreshold = 0.7; // Dot product threshold (facing towards fighter)

        for (const p of game.projectiles) {
            if (p.owner === fighter) continue; // Ignore own projectiles
            if (!p.active) continue;
            if (p.isClaymore || p.isGintoTrap) continue; // Ignore traps

            const dist = Math.hypot(p.x - fighter.x, p.y - fighter.y);
            if (dist > detectionRadius) continue;

            // Check if projectile is moving towards fighter
            const speed = Math.hypot(p.dx, p.dy);
            if (speed < 1) continue; // Ignore stationary

            const toFighterX = fighter.x - p.x;
            const toFighterY = fighter.y - p.y;
            const toFighterDist = Math.hypot(toFighterX, toFighterY);

            // Normalize
            const normToFighterX = toFighterX / toFighterDist;
            const normToFighterY = toFighterY / toFighterDist;
            const normDx = p.dx / speed;
            const normDy = p.dy / speed;

            // Dot product: if positive and high, projectile is heading towards fighter
            const dot = normDx * normToFighterX + normDy * normToFighterY;

            if (dot > approachThreshold) {
                return p; // Found an approaching projectile!
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

        // Visuals Pre-Swap (Disappear)
        context.game.particles.spawn(fighter.x, fighter.y, '#4B0082', 10);
        context.game.particles.spawn(enemy.x, enemy.y, '#FF0000', 10);

        // SWAP PHYSICS
        fighter.x = enemy.x;
        fighter.y = enemy.y;
        enemy.x = oldX;
        enemy.y = oldY;

        // 2. PROJECTILE HIJACK (The "Hit Yourself" trick)
        let hijackedCount = 0;
        context.game.projectiles.forEach(p => {
            if (p.owner === enemy) {
                p.owner = fighter; // Hijack ownership
                p.isDeflected = true;
                p.deflectLifetime = 180;
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
        this.duration = config.duration || 300;
        this.cooldown = config.cooldown || 600;
    }

    execute(fighter, context) {
        // Activate Buff
        fighter.activeEffects.focusActive = true;
        fighter.activeEffects.focusTimer = this.duration;

        // Massive Mass Increase (Immovable)
        fighter.originalMass = fighter.mass;
        fighter.mass = 20.0; // Unmoveable object

        // Visuals
        audioEngine.playPowerUp();
        fighter.game.particles.spawn(fighter.x, fighter.y, '#4B0082', 30);
        logger.log(`${fighter.name} enters UNSHAKEABLE FOCUS!`, 'combat');

        // Set CD
        fighter.cooldowns.ult = this.cooldown;
        fighter.maxCooldowns.ult = this.cooldown;
    }

    update(fighter, context) {
        // Trigger logic
        if (fighter.cooldowns.ult <= 0 && !fighter.activeEffects.focusActive) {
            this.execute(fighter, context);
        }

        // Buff Management
        if (fighter.activeEffects.focusActive) {
            fighter.activeEffects.focusTimer--;

            // Particle aura
            if (fighter.activeEffects.focusTimer % 10 === 0) {
                fighter.game.particles.spawn(fighter.x, fighter.y, '#4B0082', 1);
            }

            if (fighter.activeEffects.focusTimer <= 0) {
                fighter.activeEffects.focusActive = false;
                fighter.mass = fighter.originalMass || 1.6; // Revert mass
                logger.log(`${fighter.name}'s Focus fades.`, 'info');
            }
        }
    }
}
