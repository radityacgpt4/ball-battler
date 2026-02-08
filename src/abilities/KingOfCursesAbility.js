import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { WorldSlashRenderer } from '../components/ProjectileRenderers.js';
import { LinearMovement, WorldSlashBehavior } from '../components/ProjectileBehaviors.js';

export class KingOfCursesAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // Dismantle Properties
        this.damage = config.damage || 1;
        this.range = config.range || 125;
        this.slashWidth = config.slashWidth || 40;
        this.slashColor = config.slashColor || '#DC143C';

        // ULT Properties (World Cutting Slash)
        this.slashDamage = config.slashDamage || 10;
        this.slashSpeed = config.slashSpeed || 12;
        this.slashFireRate = config.slashFireRate || 90; // Default 1.5s
        this.ultSlashWidth = config.slashWidth || 50;
        this.dragStrength = config.dragStrength || 0.2;
    }

    update(fighter, context) {
        const { game, enemies } = context;

        // --- 1. PASSIVE: Cleave (Rapid Domain Shred) ---
        // Runs independently of ATK cooldown
        if (typeof fighter.cleaveTimer === 'undefined') fighter.cleaveTimer = 0;

        if (fighter.cleaveTimer <= 0) {
            let hit = false;
            for (const enemy of enemies) {
                if (enemy === fighter || enemy.isDead) continue;

                const dist = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
                if (dist > this.range) continue;

                hit = true;
                enemy.takeDamage(this.damage, false, false, fighter);

                // Visuals (small random slash on target)
                const cx = enemy.x + (Math.random() - 0.5) * 20;
                const cy = enemy.y + (Math.random() - 0.5) * 20;
                game.particles.spawnSlash(cx - 10, cy - 10, cx + 10, cy + 10, '#DC143C', 3);
            }

            if (hit) {
                fighter.cleaveTimer = this.cooldown;
                audioEngine.playRealisticSlash();
            }
        } else {
            fighter.cleaveTimer -= (context.timeScale || 1);
        }

        // --- 2. ACTIVE: World Cutting Slash (Ult Mode) ---
        // Controlled by Main ATK Cooldown
        if (fighter.cooldowns.atk <= 0) {
            const isUltActive = fighter.activeEffects.kingOfCursesUltActive;

            if (isUltActive) {
                // Read from ULT config dynamically for live updates
                const u = fighter.skills.ult || {};
                const fireRate = u.slashFireRate || this.slashFireRate;
                const speed = u.slashSpeed || this.slashSpeed;
                const damage = u.slashDamage || this.slashDamage;
                const width = u.slashWidth || this.ultSlashWidth;
                const drag = u.dragStrength || this.dragStrength;

                fighter.cooldowns.atk = fireRate;

                // ULT: World Cutting Slash (Projectile)
                const p = new Projectile(
                    fighter,
                    fighter.x + Math.cos(fighter.angle) * 30,
                    fighter.y + Math.sin(fighter.angle) * 30,
                    fighter.angle,
                    speed,
                    damage,
                    game
                );

                p.isWorldSlash = true;
                p.radius = width / 2;
                p.dragStrength = drag;
                p.dragTarget = true; // Enables drag logic in Game.js collision

                p.renderer = new WorldSlashRenderer();
                p.addComponent(new LinearMovement());
                p.addComponent(new WorldSlashBehavior());

                // Visuals for slash
                game.particles.spawnSlash(
                    fighter.x, fighter.y,
                    fighter.x + Math.cos(fighter.angle) * 100,
                    fighter.y + Math.sin(fighter.angle) * 100,
                    '#DC143C',
                    width
                );

                game.projectiles.push(p);
                audioEngine.playSlash();
            } else {
                // Normal mode active attack is disabled (Cleave is handled passively above)
            }
        }
    }

    modifyRotation(fighter, rotationSpeed) {
        // Slow rotation when facing opponent (Aim Assist)
        const enemies = fighter.game.entities;
        for (const e of enemies) {
            if (e === fighter || e.isDead) continue;

            const angleToOpponent = Math.atan2(e.y - fighter.y, e.x - fighter.x);
            let angleDiff = Math.abs(fighter.angle - angleToOpponent);
            while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

            if (angleDiff < Math.PI / 4) {
                return rotationSpeed * 0.4;
            }
        }
        return rotationSpeed;
    }
}


export class KingOfCursesDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.domainRadius = config.domainRadius || 125;
        this.slowAmount = config.slowAmount || 0.22;
        this.stunDelay = config.stunDelay || 60;
        this.stunDuration = config.stunDuration || 60;

        this.enemiesInDomain = new Map(); // entityId -> frames inside
    }

    update(fighter, context) {
        const { game, enemies } = context;

        // Initialize domain active state
        if (typeof fighter.domainActive === 'undefined') {
            fighter.domainActive = true;
            fighter.domainRadius = this.domainRadius;
        }

        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const dist = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
            // Check radius (Domain Radius + small buffer) 
            const inDomain = dist < (this.domainRadius + enemy.radius);

            if (inDomain) {
                // Tracking - only increment frames if the enemy is NOT already stunned
                // This prevents "charging" the next stun while already stunned (Stun-lock safeguard)
                let frames = this.enemiesInDomain.get(enemy) || 0;
                if (enemy.status.stun <= 0) {
                    frames += 1 * (context.timeScale || 1.0);
                    this.enemiesInDomain.set(enemy, frames);
                }

                // Apply slow
                enemy.status.domainSlow = 10;
                enemy.status.domainSlowAmount = this.slowAmount;

                // Random visual
                if (Math.random() < 0.05) {
                    this.spawnDomainSlash(fighter, enemy);
                }

                // Stun Logic - triggers after staying in domain for stunDelay
                if (frames >= this.stunDelay && enemy.status.stun <= 0) {
                    enemy.applyStatus('STUN', this.stunDuration);
                    logger.log(`${enemy.name} STUNNED by Malevolent Shrine!`, 'combat');

                    game.particles.spawnShockwave(enemy.x, enemy.y, '#DC143C');
                    this.spawnDomainSlash(fighter, enemy);
                    this.spawnDomainSlash(fighter, enemy);

                    // Reset timer for this specific enemy for next stun cycle
                    this.enemiesInDomain.set(enemy, 0);
                }
            } else {
                // Reset timer for this specific enemy if they leave
                this.enemiesInDomain.delete(enemy);
            }
        }
    }

    spawnDomainSlash(fighter, enemy) {
        // Multi-slash effect like Divine General
        const cx = enemy.x + (Math.random() - 0.5) * 60;
        const cy = enemy.y + (Math.random() - 0.5) * 60;
        const angle = Math.random() * Math.PI * 2;
        const len = 25 + Math.random() * 25;

        // Red-black with glowing edge
        fighter.game.particles.spawnSlash(
            cx - Math.cos(angle) * len,
            cy - Math.sin(angle) * len,
            cx + Math.cos(angle) * len,
            cy + Math.sin(angle) * len,
            '#DC143C', // Red-black
            6
        );
    }
}

export class KingOfCursesUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration || 300;
    }

    execute(fighter, context) {
        const { game } = context;

        fighter.cooldowns.ult = this.cooldown;
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 999999; // Permanent once activated
        fighter.activeEffects.kingOfCursesUltActive = true;

        game.particles.spawnShockwave(fighter.x, fighter.y, '#DC143C');
        audioEngine.playPowerUp();
    }
}
