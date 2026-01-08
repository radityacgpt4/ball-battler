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
        this.cooldown = config.cooldown || 210;
    }

    update(fighter, context) {
        // Logic handled in execute() or canUse()?
        // Active abilities are usually triggered. But this is an auto-battler.
        // We need a trigger condition. 
        // Trigger: Whenever off cooldown AND enemy is alive.

        if (fighter.cooldowns.def <= 0) {
            const enemy = context.enemies.find(e => e !== fighter && !e.isDead);
            if (enemy) {
                this.execute(fighter, { enemy, game: context.game });
                fighter.cooldowns.def = this.cooldown;
                fighter.maxCooldowns.def = this.cooldown;
            }
        }
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

        // SWAP PHYCIS
        fighter.x = enemy.x;
        fighter.y = enemy.y;
        enemy.x = oldX;
        enemy.y = oldY;

        // 2. PROJECTILE HIJACK (The "Hit Yourself" trick)
        let hijackedCount = 0;
        context.game.projectiles.forEach(p => {
            if (p.owner === enemy) {
                p.owner = fighter; // Hijack ownership
                p.isDeflected = true; // Optional: use existing deflect logic traits
                p.deflectLifetime = 180;

                // Visual Feedback: Turn it deep purple
                // Projectile.draw() might need to check for this or we just accept default
                // We can flag it
                p.isHijacked = true; // Custom flag for renderer if needed
                hijackedCount++;
            }
        });

        // 3. VISUALS & AUDIO
        context.game.particles.spawnShockwave(fighter.x, fighter.y, '#4B0082'); // New pos
        context.game.particles.spawnShockwave(enemy.x, enemy.y, '#4B0082');   // New pos

        // CLAP SOUND (Using PowerUp as placeholder or specific if added)
        audioEngine.playPowerUp();

        let logMsg = `${fighter.name} CLAPPED & Swapped!`;
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
