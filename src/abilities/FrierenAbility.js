/**
 * Frieren Abilities (Mage of the Era)
 * 
 * ATK: Zoltraak (Fast homing beam projectile)
 * DEF: Hexagonal Barrier (Active shield with shatter)
 * ULT: Blackhole (Gravitational pull + projectile vacuum)
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

import { ZoltraakRenderer } from '../components/ProjectileRenderers.js';
import { ZoltraakBehavior } from '../components/ProjectileBehaviors.js';
// ATK: Zoltraak - Ordinary Offensive Magic (Homing Beam Projectile)
// ============================================================================
export class ZoltraakAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.damage = config.damage || 6;
        this.speed = config.speed || 22;
        this.range = config.range || 450;
        this.cooldown = config.cooldown || 25;
        this.homingStrength = config.homingStrength || 0.03;
        this.aimError = config.aimError || 0.22;
        this.recoil = config.recoil !== undefined ? config.recoil : 4.5;
        this.burstCount = config.burstCount || 1;
        this.burstDelay = config.burstDelay || 5;

        // State for burst
        this.currentBurst = 0;
        this.burstFrameTimer = 0;
        this.burstTarget = null;
    }

    update(fighter, context) {
        // Handle active burst
        if (this.currentBurst > 0) {
            this.burstFrameTimer--;
            if (this.burstFrameTimer <= 0) {
                this.fireProjectile(fighter, context.game, this.burstTarget);
                this.currentBurst--;
                this.burstFrameTimer = this.burstDelay;
            }
        }

        if (fighter.cooldowns.atk > 0) return;

        const { enemies } = context;

        // Aim Assist: Find best target
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist > this.range) continue;

            const angleToEnemy = Math.atan2(enemy.y - fighter.y, enemy.x - fighter.x);
            let angleDiff = Physics.normalizeAngle(angleToEnemy - fighter.angle);

            // Score prioritize angle slightly more
            const distScore = 1 - (dist / this.range);
            const angleScore = 1 - (Math.abs(angleDiff) / Math.PI);
            const score = distScore * 0.3 + angleScore * 0.7;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        }

        if (!bestTarget) return;

        // Start Burst
        this.currentBurst = this.burstCount;
        this.burstTarget = bestTarget;
        this.burstFrameTimer = 0; // Fire immediately
        fighter.cooldowns.atk = this.cooldown; // Full cooldown
    }

    fireProjectile(fighter, game, target) {
        if (!target || target.isDead) return;

        // Target angle with inaccuracy
        const targetAngle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
        const errorMargin = (Math.random() - 0.5) * this.aimError;
        const aimAngle = targetAngle + errorMargin;

        // Recoil (Push fighter back) - Smaller recoil per shot in burst
        const recoilForce = this.recoil / (this.burstCount > 1 ? 2 : 1);
        fighter.dx -= Math.cos(aimAngle) * recoilForce;
        fighter.dy -= Math.sin(aimAngle) * recoilForce;

        // Spawn projectile
        const startX = fighter.x + Math.cos(aimAngle) * (fighter.radius + 15);
        const startY = fighter.y + Math.sin(aimAngle) * (fighter.radius + 15);

        const p = new Projectile(fighter, startX, startY, aimAngle, this.speed, this.damage, game);
        p.target = target;

        p.renderer = new ZoltraakRenderer();
        p.addComponent(new ZoltraakBehavior(this.homingStrength, this.range));

        // Unified impact properties
        p.impactSound = 'hit';
        p.impactParticle = 'zoltraakImpact';

        game.projectiles.push(p);

        // Visual: Muzzle Flash (Lighter for rapid fire)
        game.particles.particles.push({
            type: 'shockwave',
            x: startX, y: startY,
            radius: 5, maxRadius: 15,
            life: 0.2, decay: 0.1,
            color: '#4fc3f7', width: 2
        });

        audioEngine.playZoltraak(); // Magical laser sound

        // Set Magic Circle Visual State
        fighter.magicCircleTimer = 20; // Lasts for 20 frames (approx cooldown)
        // Lock angle to firing direction (independent of body spin)
        fighter.magicCircleAngle = aimAngle;
    }
}

// ============================================================================
// DEF: Hexagonal Barrier Magic
// ============================================================================
export class HexBarrierAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.arcAngle = config.arcAngle || (Math.PI * 0.7); // 126 degrees
        this.shieldRadius = config.shieldRadius || 12;
        this.shatterChance = config.shatterChance || 0.5;
        this.shatterDamage = config.shatterDamage || 5;
    }

    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        const shieldRadius = fighter.radius + this.shieldRadius;
        const halfArc = this.arcAngle / 2;

        const hit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, fighter.x, fighter.y, shieldRadius);
        if (!hit) return null;

        const hitAngle = Math.atan2(hit.y - fighter.y, hit.x - fighter.x);
        const angleDiff = Physics.normalizeAngle(hitAngle - fighter.angle);

        if (Math.abs(angleDiff) > halfArc) return null;

        return {
            x: hit.x,
            y: hit.y,
            dist: hit.dist,
            nx: Math.cos(hitAngle),
            ny: Math.sin(hitAngle)
        };
    }

    isBlocked(fighter, attackerX, attackerY, damage = 0) {
        const angleToAttacker = Math.atan2(attackerY - fighter.y, attackerX - fighter.x);
        const angleDiff = Physics.normalizeAngle(angleToAttacker - fighter.angle);
        const halfArc = this.arcAngle / 2;

        const blocked = Math.abs(angleDiff) < halfArc;

        // Shatter mechanic for melee
        if (blocked && damage > 0 && Math.random() < this.shatterChance) {
            const attacker = fighter.game.entities.find(e =>
                e !== fighter &&
                !e.isDead &&
                Physics.dist(e.x, e.y, attackerX, attackerY) < 30
            );

            if (attacker) {
                attacker.takeDamage(this.shatterDamage, false, false, fighter);

                // Shatter visual
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 / 6) * i + Math.random() * 0.3;
                    fighter.game.particles.particles.push({
                        x: attackerX, y: attackerY,
                        vx: Math.cos(angle) * 8,
                        vy: Math.sin(angle) * 8,
                        life: 0.5, decay: 0.08,
                        size: 4, color: '#4fc3f7', type: 'square'
                    });
                }

                fighter.game.combatText.text(attackerX, attackerY - 20, "SHATTER!", '#4fc3f7');
                audioEngine.playBlock();
                logger.log(`${fighter.name}'s barrier shattered on ${attacker.name}!`, 'combat');
            }
        }

        return blocked;
    }

    // Draw visual for hexagonal shield
    draw(fighter, ctx) {
        if (!fighter || !ctx) return;

        const shieldRadius = fighter.radius + this.shieldRadius;
        const halfArc = this.arcAngle / 2;

        ctx.save();
        ctx.translate(fighter.x, fighter.y);
        ctx.rotate(fighter.angle);

        // Draw hexagonal segments
        const segments = 5;
        const segmentAngle = this.arcAngle / segments;

        for (let i = 0; i < segments; i++) {
            const startAngle = -halfArc + i * segmentAngle;
            const endAngle = startAngle + segmentAngle * 0.9;

            ctx.strokeStyle = '#4fc3f7';
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01 + i) * 0.2;

            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, startAngle, endAngle);
            ctx.stroke();

            // Hexagon nodes at segment edges
            const nodeX = Math.cos(startAngle) * shieldRadius;
            const nodeY = Math.sin(startAngle) * shieldRadius;

            ctx.fillStyle = '#4fc3f7';
            ctx.beginPath();
            ctx.arc(nodeX, nodeY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    update(fighter, context) {
        // Spawn occasional hexagon particles
        if (Math.random() < 0.03) {
            const angle = fighter.angle + (Math.random() - 0.5) * this.arcAngle;
            const dist = fighter.radius + this.shieldRadius;
            context.game.particles.particles.push({
                x: fighter.x + Math.cos(angle) * dist,
                y: fighter.y + Math.sin(angle) * dist,
                vx: 0, vy: 0,
                life: 0.3, decay: 0.1,
                size: 5, color: '#4fc3f7', type: 'square', alpha: 0.5
            });
        }
    }
}

// ============================================================================
// ULT: Blackhole - The Great Void
// ============================================================================
export class BlackholeAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration || 120;
        this.radius = config.radius || 200;
        this.pullStrength = config.pullStrength || 1.5;
        this.dotDamage = config.dotDamage || 1;
        this.dotRate = config.dotRate || 12;
        this.cooldown = config.cooldown || 360;
        this.launchSpeed = config.launchSpeed || 8;
        this.friction = config.friction || 0.98;
        this.growthSpeed = config.growthSpeed || 0.04;
    }

    execute(fighter, context) {
        const { game } = context;

        // Spawn blackhole at target location
        // Fire blackhole from staff tip
        const spawnDist = fighter.radius + 15;
        const holeX = fighter.x + Math.cos(fighter.angle) * spawnDist;
        const holeY = fighter.y + Math.sin(fighter.angle) * spawnDist;

        game.blackholes = game.blackholes || [];
        game.blackholes.push({
            x: holeX,
            y: holeY,
            vx: Math.cos(fighter.angle) * this.launchSpeed,
            vy: Math.sin(fighter.angle) * this.launchSpeed,
            radius: 0,
            maxRadius: this.radius,
            coreRadius: 0,
            maxCoreRadius: 25,
            pullStrength: this.pullStrength,
            dotDamage: this.dotDamage,
            dotRate: this.dotRate,
            timer: this.duration,
            owner: fighter,
            dotTimer: 0,
            rotation: 0,
            friction: this.friction,
            growthSpeed: this.growthSpeed
        });

        logger.log(`${fighter.name} casts BLACKHOLE!`, 'combat');
        audioEngine.playBlackhole(); // Custom sound effect

        // Muzzle Flash: Optimized performance
        for (let i = 0; i < 10; i++) {
            const pAngle = fighter.angle + (Math.random() - 0.5) * 1.5;
            const pSpeed = 3 + Math.random() * 12;
            game.particles.particles.push({
                x: holeX, y: holeY,
                vx: Math.cos(pAngle) * pSpeed,
                vy: Math.sin(pAngle) * pSpeed,
                life: 0.5, decay: 0.08, // Clears slightly faster
                size: 3, color: i % 2 === 0 ? '#4a0080' : '#ffffff', type: 'dot'
            });
        }

        game.particles.particles.push({
            type: 'shockwave',
            x: holeX, y: holeY,
            radius: 5, maxRadius: 80,
            life: 0.8, decay: 0.04,
            color: '#8000ff', width: 4
        });

        fighter.cooldowns.ult = this.cooldown;
    }
}

// ============================================================================
// Blackhole Update Logic (Called from Game.js)
// ============================================================================
export function updateBlackholes(game, timeScale = 1) {
    if (!game.blackholes) return;

    game.blackholes = game.blackholes.filter(hole => {
        hole.timer -= timeScale;
        hole.dotTimer -= timeScale;
        hole.rotation += 0.1 * timeScale;

        // Growth spawning effect (Birth of the Void)
        if (hole.radius < hole.maxRadius) {
            hole.radius += (hole.maxRadius - hole.radius) * (hole.growthSpeed || 0.04) * timeScale;
            hole.coreRadius += (hole.maxCoreRadius - hole.coreRadius) * (hole.growthSpeed || 0.04) * timeScale;

            if (hole.radius > hole.maxRadius - 0.5) hole.radius = hole.maxRadius;
            if (hole.coreRadius > hole.maxCoreRadius - 0.5) hole.coreRadius = hole.maxCoreRadius;
        }

        // Move the blackhole
        hole.x += (hole.vx || 0) * timeScale;
        hole.y += (hole.vy || 0) * timeScale;

        // Slow down move speed slightly over time (friction in air)
        const friction = hole.friction !== undefined ? hole.friction : 0.98;
        hole.vx *= friction;
        hole.vy *= friction;

        if (hole.timer <= 0) {
            // Collapse visual
            game.particles.particles.push({
                type: 'shockwave',
                x: hole.x, y: hole.y,
                radius: hole.radius, maxRadius: 20,
                life: 0.3, decay: 0.1,
                color: '#ffffff', width: 3
            });
            audioEngine.playExplosion();
            return false;
        }

        // Pull enemies
        for (const entity of game.entities) {
            if (entity === hole.owner || entity.isDead) continue;

            const dist = Physics.dist(hole.x, hole.y, entity.x, entity.y);
            if (dist < hole.radius && dist > 10) {
                const angle = Math.atan2(hole.y - entity.y, hole.x - entity.x);
                // Stronger pull as you get closer (inverse square-ish)
                const strength = hole.pullStrength * Math.pow(1 - dist / hole.radius, 0.5);

                entity.dx += Math.cos(angle) * strength;
                entity.dy += Math.sin(angle) * strength;

                // Strong Slowing Effect (Anti-whirling)
                // Drastically reduce velocity preservation to prevent orbiting
                entity.dx *= 0.6; // Heavy friction
                entity.dy *= 0.6;

                // DoT in core
                if (hole.dotTimer <= 0 && dist < hole.radius * 0.4) {
                    entity.takeDamage(hole.dotDamage, false, true, hole.owner);
                }
            }
        }

        // Reset DoT timer
        if (hole.dotTimer <= 0) {
            hole.dotTimer = hole.dotRate;
        }

        // Vacuum projectiles
        game.projectiles = game.projectiles.filter(p => {
            if (p.owner === hole.owner) return true;

            const dist = Physics.dist(hole.x, hole.y, p.x, p.y);
            if (dist < hole.coreRadius) {
                game.particles.spawn(p.x, p.y, '#9c27b0', 3);
                return false;
            } else if (dist < hole.radius) {
                const angle = Math.atan2(hole.y - p.y, hole.x - p.x);
                const strength = 3;
                p.dx += Math.cos(angle) * strength;
                p.dy += Math.sin(angle) * strength;
            }
            return true;
        });

        return true;
    });
}

// ============================================================================
// Blackhole Draw Logic (Called from Renderer or Game draw loop)
// ============================================================================
export function drawBlackholes(game, ctx) {
    if (!game.blackholes) return;

    for (const hole of game.blackholes) {
        ctx.save();
        ctx.translate(hole.x, hole.y);

        // Outer gravitational lensing effect
        const gradient = ctx.createRadialGradient(0, 0, hole.coreRadius, 0, 0, hole.radius);
        gradient.addColorStop(0, 'rgba(75, 0, 130, 0.8)');
        gradient.addColorStop(0.3, 'rgba(128, 0, 255, 0.3)');
        gradient.addColorStop(0.7, 'rgba(200, 100, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, hole.radius, 0, Math.PI * 2);
        ctx.fill();

        // Accretion disk (swirling particles)
        ctx.rotate(hole.rotation);
        ctx.strokeStyle = '#ffab00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;

        for (let i = 0; i < 3; i++) {
            const spiralAngle = hole.rotation * 2 + (Math.PI * 2 / 3) * i;
            const innerR = hole.coreRadius + 5;
            const outerR = hole.coreRadius + 30;

            ctx.beginPath();
            ctx.arc(0, 0, innerR + i * 8, spiralAngle, spiralAngle + 0.8);
            ctx.stroke();
        }

        // Event horizon (black core)
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, hole.coreRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core glow edge
        ctx.strokeStyle = '#4a0080';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, hole.coreRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
