import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

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
                fighter.cleaveTimer = 6; // Fixed 10 DPS rate (6 frames)
                audioEngine.playCleaveHit();
            }
        } else {
            fighter.cleaveTimer--;
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
                p.dragTarget = true;
                p.dragStrength = drag;

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
            // Check radius (Domain Radius + small buffer or strict?) 
            const inDomain = dist < this.domainRadius + enemy.radius;

            if (inDomain) {
                // Tracking
                let data = this.enemiesInDomain.get(enemy.id);
                if (!data) {
                    data = 0; // Just frames count
                    this.enemiesInDomain.set(enemy.id, data);
                }

                const frames = data + 1;
                this.enemiesInDomain.set(enemy.id, frames);

                // Apply slow (20%)
                enemy.status.domainSlow = 10;

                // Random visual
                if (Math.random() < 0.05) {
                    this.spawnDomainSlash(fighter, enemy);
                }

                // Stun Logic
                if (frames >= this.stunDelay && enemy.status.stun <= 0) {
                    enemy.applyStatus('STUN', this.stunDuration);
                    logger.log(`${enemy.name} STUNNED by Malevolent Shrine!`, 'combat');

                    game.particles.spawnShockwave(enemy.x, enemy.y, '#DC143C');
                    this.spawnDomainSlash(fighter, enemy);
                    this.spawnDomainSlash(fighter, enemy);

                    // Reset timer for next stun cycle
                    this.enemiesInDomain.set(enemy.id, 0);
                }
            } else {
                this.enemiesInDomain.delete(enemy.id);
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
        fighter.activeEffects.kingOfCursesUltActive = true;
        fighter.activeEffects.kingOfCursesUltTimer = this.duration;

        game.particles.spawnShockwave(fighter.x, fighter.y, '#DC143C');
        audioEngine.playPowerUp();
    }
}
