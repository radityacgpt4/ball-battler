import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { GojoRedBehavior } from '../components/ProjectileBehaviors.js';
import { GojoRedRenderer } from '../components/ProjectileRenderers.js';

// ============================================================================
// ATK: Cursed Technique Reversal: Red
// ============================================================================
export class GojoRedAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.damage = config.damage || 7;
        this.critDamage = config.critDamage || 15;
        this.projectileSpeed = config.projectileSpeed || 16;
        this.knockback = config.knockback || 35;
        this.radius = config.radius || 12;
        this.range = config.range || 600;
        this.explosionRadius = config.explosionRadius || 60;

        this.aimError = 0.1;
    }

    update(fighter, context) {
        if (fighter.cooldowns.atk > 0) return;
        if (fighter.status.stun > 0) return;

        this.fireRed(fighter, context);
    }

    fireRed(fighter, context) {
        const { game, enemies } = context;

        // Visual: Charge up (Red glow)
        game.particles.spawn(fighter.x, fighter.y, '#FF0000', 5);

        // Target finding
        let target = null;
        let minDist = this.range;

        // Aim assist
        for (const enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;
            const dist = Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y);
            if (dist < minDist) {
                minDist = dist;
                target = enemy;
            }
        }

        let angle = fighter.angle;
        if (target) {
            angle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
        }

        // Projectile
        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(angle) * 30,
            fighter.y + Math.sin(angle) * 30,
            angle,
            this.projectileSpeed,
            this.damage,
            game
        );

        p.radius = this.radius;
        p.explodeOnWall = true;
        p.explosionRadius = this.explosionRadius;
        p.knockback = this.knockback;
        p.critDamage = this.critDamage;

        p.renderer = new GojoRedRenderer();
        p.addComponent(new GojoRedBehavior());

        p.impactSound = 'explosion';
        p.impactParticle = 'redOrbExplosion';

        game.projectiles.push(p);

        // Cooldown
        fighter.cooldowns.atk = this.cooldown;

        audioEngine.playGunshot(); // Placeholder for "Repelling" sound
        logger.log(`${fighter.name} fires Reversal Red!`, 'combat');
    }
}

// ============================================================================
// DEF: Cursed Technique Amplification: Blue
// ============================================================================
export class GojoBlueAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 180;
        this.duration = config.duration || 180;
        this.radius = config.radius || 140;
        this.pullStrength = config.pullStrength || 2.2;
        this.damage = config.damage || 0; // Should be 0
        this.launchSpeed = config.launchSpeed || 4;
        this.friction = config.friction || 0.92;
        this.growthSpeed = config.growthSpeed || 0.05;
    }

    update(fighter, context) {
        this.updateBlueOrbs(fighter, context);

        if (fighter.cooldowns.def > 0) return;

        if (this.canUse(fighter, context)) {
            this.execute(fighter, context);
        }
    }

    execute(fighter, context) {
        const { game } = context;

        // Spawn Blue Orb (Blackhole equivalent)
        const spawnDist = fighter.radius + 15;
        const holeX = fighter.x + Math.cos(fighter.angle) * spawnDist;
        const holeY = fighter.y + Math.sin(fighter.angle) * spawnDist;

        fighter.blueOrbs = fighter.blueOrbs || [];
        // Size matched to Red projectile (10% of base to get final radius of ~12)
        const smallerRadius = this.radius * 0.25;
        const smallerCore = 30 * 0.25;
        fighter.blueOrbs.push({
            x: holeX,
            y: holeY,
            vx: Math.cos(fighter.angle) * this.launchSpeed,
            vy: Math.sin(fighter.angle) * this.launchSpeed,
            radius: 0,
            maxRadius: smallerRadius,  // Visual size only
            pullRadius: this.radius,   // ACTUAL pull/attraction radius (from config)
            coreRadius: 0,
            maxCoreRadius: smallerCore,
            pullStrength: this.pullStrength,
            damage: this.damage,
            timer: this.duration,
            owner: fighter,
            rotation: 0,
            growthSpeed: this.growthSpeed
            // No friction - continuous movement
        });

        fighter.cooldowns.def = this.cooldown;

        logger.log(`${fighter.name} casts BLUE!`, 'combat');
        audioEngine.playPowerUp();

        // Visual
        game.particles.spawnShockwave(holeX, holeY, '#0000FF', 30, 0.5);
    }

    updateBlueOrbs(fighter, context) {
        if (!fighter.blueOrbs) return;
        const { game } = context;
        const timeScale = 1; // context.timeScale || 1

        fighter.blueOrbs = fighter.blueOrbs.filter(orb => {
            orb.timer -= timeScale;
            orb.rotation += 0.1 * timeScale;

            // Growth
            if (orb.radius < orb.maxRadius) {
                orb.radius += (orb.maxRadius - orb.radius) * orb.growthSpeed;
                orb.coreRadius += (orb.maxCoreRadius - orb.coreRadius) * orb.growthSpeed;
            }

            // Continuous Movement (No friction - orb keeps moving)
            orb.x += orb.vx;
            orb.y += orb.vy;

            if (orb.timer <= 0) {
                // Collapse visual
                game.particles.spawnShockwave(orb.x, orb.y, '#0000FF', 20, 0.2);
                return false;
            }

            // PULL MECHANIC (The "Blue" Logic)
            for (const entity of game.entities) {
                if (entity === fighter || entity.isDead) continue;

                const dist = Physics.dist(orb.x, orb.y, entity.x, entity.y);
                // Use pullRadius (config value), not visual radius
                if (dist < orb.pullRadius && dist > 10) {
                    const angle = Math.atan2(orb.y - entity.y, orb.x - entity.x);
                    const strength = orb.pullStrength * Math.pow(1 - dist / orb.pullRadius, 0.5);

                    entity.dx += Math.cos(angle) * strength;
                    entity.dy += Math.sin(angle) * strength;

                    // Anti-orbit friction
                    entity.dx *= 0.6;
                    entity.dy *= 0.6;

                    // STATUS APPLICATION ("Event Horizon")
                    // Used by Red to Crit
                    entity.status.isTrappedInBlue = true;
                    entity.status.blueTrapTimer = 5; // Reset timer constantly while in radius
                }
            }

            // Clean up old status
            context.enemies.forEach(e => {
                if (e.status.blueTrapTimer > 0) {
                    e.status.blueTrapTimer--;
                    if (e.status.blueTrapTimer <= 0) e.status.isTrappedInBlue = false;
                }
            });

            return true;
        });
    }

    draw(fighter, ctx) {
        // Draw Blue Orbs
        // NOTE: ctx is already translated to fighter position by Renderer.drawFighter()
        // So we need to offset by (orb.x - fighter.x, orb.y - fighter.y) to draw at absolute coords
        if (!fighter.blueOrbs) return;

        for (const orb of fighter.blueOrbs) {
            ctx.save();
            // Translate to orb position relative to fighter (since ctx is at fighter pos)
            ctx.translate(orb.x - fighter.x, orb.y - fighter.y);

            const time = Date.now() * 0.001;
            const pulse = 1 + Math.sin(time * 3) * 0.05;

            // === 1. OUTER BLUE AURA ===
            ctx.globalAlpha = 0.25;
            const gradient = ctx.createRadialGradient(0, 0, orb.coreRadius, 0, 0, orb.radius);
            gradient.addColorStop(0, 'rgba(135, 206, 250, 0.5)');
            gradient.addColorStop(0.5, 'rgba(30, 144, 255, 0.25)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, orb.radius * pulse, 0, Math.PI * 2);
            ctx.fill();

            // === 2. ROTATING ARCS (Simple, Anime-style) ===
            ctx.save();
            ctx.rotate(orb.rotation);
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;

            // Draw 2 rotating arcs
            for (let i = 0; i < 2; i++) {
                const offset = i * Math.PI;
                ctx.beginPath();
                ctx.arc(0, 0, orb.coreRadius * 1.8, offset, offset + Math.PI * 0.7);
                ctx.stroke();
            }
            ctx.restore();

            // === 3. CORE (Bright white-blue) ===
            ctx.globalAlpha = 1;

            // Core gradient
            const coreGradient = ctx.createRadialGradient(
                -orb.coreRadius * 0.3, -orb.coreRadius * 0.3, 0,
                0, 0, orb.coreRadius * pulse
            );
            coreGradient.addColorStop(0, '#FFFFFF');
            coreGradient.addColorStop(0.5, '#E0F6FF');
            coreGradient.addColorStop(1, '#87CEEB');

            ctx.fillStyle = coreGradient;
            ctx.beginPath();
            ctx.arc(0, 0, orb.coreRadius * pulse, 0, Math.PI * 2);
            ctx.fill();

            // === 4. CORE EDGE ===
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(0, 0, orb.coreRadius * pulse, 0, Math.PI * 2);
            ctx.stroke();

            // === 5. SUBTLE ENERGY PARTICLES ===
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            const sparkCount = 3;
            for (let i = 0; i < sparkCount; i++) {
                const angle = (Math.PI * 2 / sparkCount) * i + time * 2;
                const distance = orb.coreRadius * 1.3;
                const size = 1 + Math.sin(time * 4 + i * 2) * 0.3;

                ctx.beginPath();
                ctx.arc(
                    Math.cos(angle) * distance,
                    Math.sin(angle) * distance,
                    size,
                    0, Math.PI * 2
                );
                ctx.fill();
            }

            ctx.restore();
        }
    }
}

// ============================================================================
// ULT: Limitless: Infinity
// ============================================================================
export class GojoUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.activeDuration = config.activeDuration || 180;
        this.rechargeTime = config.rechargeTime || 90;
        this.stopRadius = config.stopRadius || 100;
        this.slowRadius = config.slowRadius || 200;
        this.slowAmount = config.slowAmount || 0.8;
        this.projectileExpiry = config.projectileExpiry || 180;

        this.isActive = false;
        this.timer = 0;
        // Visual animation state
        this.visualRadius = 0; // Current animated radius (0 to 1 scale)
        this.fadeInSpeed = 0.03; // Speed of radius expansion
        this.fadeOutSpeed = 0.05; // Speed of radius collapse
    }

    execute(fighter, context) {
        this.isActive = true;
        this.timer = this.activeDuration;
        fighter.infinityActive = true;

        context.game.particles.spawnEffect('infinityAura', fighter.x, fighter.y);
        audioEngine.playPowerUp();
        logger.log(`${fighter.name} expands Infinity!`, 'combat');

        fighter.cooldowns.ult = 9999;
    }

    update(fighter, context) {
        const { game } = context;

        if (fighter.isDead) {
            this.isActive = false;
            fighter.infinityActive = false;
            // Clean up frozen projectiles on death
            this.cleanupFrozenProjectiles(game);
            return;
        }

        if (this.isActive) {
            this.timer--;

            // Projectile Stop Logic
            game.projectiles.forEach(p => {
                if (p.owner === fighter) return;
                if (!p.active) return; // Skip inactive projectiles

                const dist = Physics.dist(fighter.x, fighter.y, p.x, p.y);

                // Slow zone (between slow and stop radius)
                if (dist < this.slowRadius && dist > this.stopRadius) {
                    // If projectile was frozen and escaped, despawn it
                    if (p.isFrozenByInfinity) {
                        this.despawnFrozenProjectile(p, game);
                        return;
                    }
                    p.dx *= (1 - this.slowAmount * 0.1);
                    p.dy *= (1 - this.slowAmount * 0.1);
                }

                // Stop zone (inside stop radius)
                if (dist <= this.stopRadius) {
                    p.dx = 0;
                    p.dy = 0;
                    p.isFrozenByInfinity = true;
                    p.frozenTimer = (p.frozenTimer || 0) + 1;

                    // Despawn after expiry
                    if (p.frozenTimer > this.projectileExpiry) {
                        this.despawnFrozenProjectile(p, game);
                        return;
                    }
                }

                // Outside slow radius - if was frozen, despawn
                if (dist >= this.slowRadius && p.isFrozenByInfinity) {
                    this.despawnFrozenProjectile(p, game);
                    return;
                }
            });

            // Enemy Slow/Stop
            context.enemies.forEach(e => {
                if (e === fighter || e.isDead) return;
                const dist = Physics.dist(fighter.x, fighter.y, e.x, e.y);

                // Slow zone (outer radius) - Apply SLOW once
                if (dist < this.slowRadius && dist > this.stopRadius) {
                    // Only apply SLOW status once when entering zone
                    if (!e.status.infinitySlowed) {
                        e.applyStatus('SLOW', 30); // Apply with longer duration
                        e.status.infinitySlowed = true;
                    } else {
                        // Silently refresh SLOW timer while inside
                        if (e.status.slow < 20) {
                            e.status.slow = 20;
                        }
                    }
                    // Clear frozen flag if they escape to slow zone
                    if (e.status.infinityFrozen) {
                        e.status.infinityFrozen = false;
                    }
                }

                // Stop zone (inner radius) - Direct freeze without status spam
                if (dist <= this.stopRadius) {
                    e.dx = 0;
                    e.dy = 0;
                    e.omega = 0;

                    // Only log once when first frozen
                    if (!e.status.infinityFrozen) {
                        e.status.infinityFrozen = true;
                        // Apply initial stun silently (or don't log)
                        if (e.applyStatus) {
                            e.status.stun = 15; // Set stun directly without logging
                        }
                    } else {
                        // Keep refreshing stun timer silently while inside
                        if (e.status.stun < 10) {
                            e.status.stun = 10;
                        }
                    }
                }

                // Outside all zones - clear flags
                if (dist >= this.slowRadius) {
                    if (e.status.infinityFrozen) {
                        e.status.infinityFrozen = false;
                    }
                    if (e.status.infinitySlowed) {
                        e.status.infinitySlowed = false;
                    }
                }
            });

            // End of Infinity
            if (this.timer <= 0) {
                this.isActive = false;
                fighter.infinityActive = false;
                fighter.cooldowns.ult = this.rechargeTime;

                // Clean up all remaining frozen projectiles
                this.cleanupFrozenProjectiles(game);

                // Clear infinityFrozen and infinitySlowed flags from all enemies
                context.enemies.forEach(e => {
                    if (e.status.infinityFrozen) {
                        e.status.infinityFrozen = false;
                    }
                    if (e.status.infinitySlowed) {
                        e.status.infinitySlowed = false;
                    }
                });
            }
        }
    }

    /**
     * Despawn a single frozen projectile with visual effect
     */
    despawnFrozenProjectile(p, game) {
        if (!p.active) return; // Already despawned
        p.active = false;
        p.isFrozenByInfinity = false;
        game.particles.spawn(p.x, p.y, '#ffffff', 5);
        game.particles.spawnShockwave(p.x, p.y, '#ADD8E6', 15, 0.3);
    }

    /**
     * Clean up all frozen projectiles when Infinity ends
     */
    cleanupFrozenProjectiles(game) {
        game.projectiles.forEach(p => {
            if (p.isFrozenByInfinity) {
                this.despawnFrozenProjectile(p, game);
            }
        });
    }


    draw(fighter, ctx) {
        // Animate visualRadius (gradual summon/de-summon)
        if (this.isActive) {
            // Fade in
            if (this.visualRadius < 1) {
                this.visualRadius += this.fadeInSpeed;
                if (this.visualRadius > 1) this.visualRadius = 1;
            }
        } else {
            // Fade out
            if (this.visualRadius > 0) {
                this.visualRadius -= this.fadeOutSpeed;
                if (this.visualRadius < 0) this.visualRadius = 0;
            }
        }

        // Don't draw if fully faded out
        if (this.visualRadius <= 0) return;

        // NOTE: ctx is already translated to fighter position by Renderer.drawFighter()
        ctx.save();

        // Current animated radii
        const currentSlowRadius = this.slowRadius * this.visualRadius;
        const currentStopRadius = this.stopRadius * this.visualRadius;

        // Base alpha affected by animation progress
        const baseAlpha = this.visualRadius * 0.35;
        const pulse = (Math.sin(Date.now() / 800) + 1) * 0.05;

        // 1. SLOW RADIUS - Outer gradient fill (Very subtle)
        ctx.globalAlpha = baseAlpha + pulse;
        const gradientSlow = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSlowRadius);
        gradientSlow.addColorStop(0, 'rgba(220, 240, 255, 0.05)');
        gradientSlow.addColorStop(0.6, 'rgba(135, 206, 250, 0.08)');
        gradientSlow.addColorStop(1, 'rgba(100, 180, 255, 0.03)');

        ctx.fillStyle = gradientSlow;
        ctx.beginPath();
        ctx.arc(0, 0, currentSlowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. STOP RADIUS - Inner gradient fill (Cleaner, less intense)
        const gradientStop = ctx.createRadialGradient(0, 0, 0, 0, 0, currentStopRadius);
        gradientStop.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        gradientStop.addColorStop(0.5, 'rgba(200, 230, 255, 0.15)');
        gradientStop.addColorStop(1, 'rgba(150, 200, 255, 0.05)');

        ctx.fillStyle = gradientStop;
        ctx.beginPath();
        ctx.arc(0, 0, currentStopRadius, 0, Math.PI * 2);
        ctx.fill();

        // 3. Slow Radius Outline (Thin, clean)
        ctx.globalAlpha = (0.4 + pulse) * this.visualRadius;
        ctx.strokeStyle = '#ADD8E6'; // Light Blue
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, currentSlowRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Stop Radius Glow (Very subtle)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#E0F0FF';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.15 * this.visualRadius;
        ctx.beginPath();
        ctx.arc(0, 0, currentStopRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 5. Stop Radius Outline (Clean thin line)
        ctx.globalAlpha = 0.5 * this.visualRadius;
        ctx.strokeStyle = 'rgba(220, 235, 255, 0.7)';
        ctx.lineWidth = 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, currentStopRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
