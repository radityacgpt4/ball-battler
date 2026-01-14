/**
 * Pirate King Abilities (formerly Rubber Captain)
 *
 * ATK: Gomu Gomu Gatling (Rapid fire punches - locks rotation, targets enemy)
 * DEF: Balloon (Reflects projectiles and melee with inflation effect)
 * ULT: Conqueror Haki (Red aura explosion with shockwave)
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { Physics } from '../systems/Physics.js';
import { RubberFistRenderer } from '../components/ProjectileRenderers.js';
import { CurveBehavior } from '../components/ProjectileBehaviors.js';

export class GatlingAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.chargeTime = config.chargeTime || 30;
        this.duration = config.duration || 120;
        this.fistDamage = config.fistDamage || 2;
        this.fireRate = config.fireRate || 3; // Every 3 frames = very fast
        this.range = config.range || 280;
        this.spread = config.spread || 0.15; // Tighter spread when locked

        this.state = 'IDLE';
        this.timer = 0;
        this.lockedAngle = 0;
        this.originalRotationSpeed = 0;
    }

    execute(fighter, context) {
        if (this.state !== 'IDLE') return;

        this.state = 'CHARGING';
        this.timer = this.chargeTime;
        fighter.cooldowns.atk = 0;

        // Store original rotation
        this.originalRotationSpeed = fighter.rotationSpeed;

        audioEngine.playPowerUp();
    }

    update(fighter, context) {
        if (this.state === 'IDLE') {
            if (this.canUse(fighter, context)) {
                this.execute(fighter, context);
            }
            return;
        }

        // Interrupt logic if stunned
        if (fighter.status.stun > 0) {
            this.state = 'IDLE';
            fighter.rotationSpeed = this.originalRotationSpeed;
            fighter.cooldowns.atk = this.cooldown;
            fighter.isGatlingFiring = false;
            return;
        }

        if (this.state === 'CHARGING') {
            this.timer--;

            // Charge visuals - arms stretching back
            if (this.timer % 10 === 0) { // Reduced frequency from %6
                const angle = fighter.angle + Math.PI; // Behind fighter
                context.game.particles.particles.push({
                    x: fighter.x + Math.cos(angle) * 20,
                    y: fighter.y + Math.sin(angle) * 20,
                    vx: Math.cos(angle) * 2,
                    vy: Math.sin(angle) * 2,
                    life: 0.2, decay: 0.2, // Much faster decay
                    size: 4, color: '#ffccaa', type: 'dot'
                });
            }

            if (this.timer <= 0) {
                this.state = 'FIRING';
                this.timer = this.duration;

                // Lock rotation and aim at nearest enemy
                fighter.rotationSpeed = 0;
                fighter.isGatlingFiring = true;

                // Find target and lock angle
                const enemies = context.enemies.filter(e => e !== fighter && !e.isDead);
                if (enemies.length > 0) {
                    let closest = enemies[0];
                    let minDist = Infinity;
                    for (const e of enemies) {
                        const d = Physics.dist(fighter.x, fighter.y, e.x, e.y);
                        if (d < minDist) {
                            minDist = d;
                            closest = e;
                        }
                    }
                    this.lockedAngle = Math.atan2(closest.y - fighter.y, closest.x - fighter.x);
                    fighter.angle = this.lockedAngle;
                } else {
                    this.lockedAngle = fighter.angle;
                }

                logger.log(`${fighter.name} unleashes GATLING!`, 'combat');
                audioEngine.playHeavyImpact();
            }
        } else if (this.state === 'FIRING') {
            this.timer--;

            // Keep fighter locked
            fighter.angle = this.lockedAngle;
            fighter.rotationSpeed = 0;

            // Rapid fire!
            if (this.timer % this.fireRate === 0) {
                this.fireFist(fighter, context);
            }

            // Recoil pushback
            fighter.dx -= Math.cos(this.lockedAngle) * 0.3;
            fighter.dy -= Math.sin(this.lockedAngle) * 0.3;

            if (this.timer <= 0) {
                this.state = 'IDLE';
                fighter.rotationSpeed = this.originalRotationSpeed;
                fighter.cooldowns.atk = this.cooldown;
                fighter.isGatlingFiring = false;
                this.armSide = 1; // Reset arm side
            }
        }
    }

    fireFist(fighter, context) {
        if (!this.armSide) this.armSide = 1; // 1 for Right, -1 for Left

        // Target angle (Center line)
        const targetAngle = this.lockedAngle;
        const dist = this.range || 240;
        const speed = 18;

        // Offset Start Position (Shoulders)
        const shoulderOffset = 15 * this.armSide;
        const startX = fighter.x + Math.cos(targetAngle + Math.PI / 2) * shoulderOffset;
        const startY = fighter.y + Math.sin(targetAngle + Math.PI / 2) * shoulderOffset;

        // Calculate Angle to Converge (But not Dead Center)
        // We want the curve to land slightly offset to the side of the arm
        // Instead of aiming at (dist, 0), aim at (dist, shoulderOffset * 0.3)
        // This keeps distinct streams while focusing.

        const targetOffset = shoulderOffset * 0.5; // Maintain some width at impact

        const totalCurveRot = (dist / speed) * 0.05 * this.armSide;
        const convergenceAdj = Math.atan2(targetOffset - shoulderOffset, dist);
        const arcAdj = -totalCurveRot * 0.5;

        // Add spread variation
        const spreadAmt = (Math.random() - 0.5) * 0.15;
        const finalAngle = targetAngle + convergenceAdj + arcAdj + spreadAmt;

        const p = new Projectile(fighter, startX, startY, finalAngle, speed, this.fistDamage, context.game);
        p.startX = startX;
        p.startY = startY;

        // Curve mechanics
        p.curveSide = this.armSide;

        p.renderer = new RubberFistRenderer();
        p.addComponent(new CurveBehavior(this.armSide));

        // Toggle side
        this.armSide *= -1;

        context.game.projectiles.push(p);

        // Punch sound variation
        if (Math.random() < 0.3) audioEngine.playHit();

        // Arm trail particle (Reduced frequency/intensity)
        if (Math.random() < 0.2) { // 20% chance instead of 50%
            context.game.particles.particles.push({
                x: fighter.x + Math.cos(finalAngle) * fighter.radius,
                y: fighter.y + Math.sin(finalAngle) * fighter.radius,
                vx: Math.cos(finalAngle) * 2,
                vy: Math.sin(finalAngle) * 2,
                life: 0.15, decay: 0.2, // Even shorter life
                size: 4, color: '#ffddcc', type: 'dot'
            });
        }
    }
}

export class BalloonAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration || 60;
        this.active = false;
        this.timer = 0;
        this.inflateSize = config.inflateSize || 1.5;
        this.inflateProgress = 0; // For animation
    }

    execute(fighter, context) {
        this.active = true;
        this.timer = this.duration;
        this.inflateProgress = 0;
        fighter.isBalloonActive = true;
        fighter.originalRadius = fighter.radius;
        fighter.balloonTargetRadius = fighter.radius * this.inflateSize;

        // Big puff effect (Reduced count)
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            context.game.particles.particles.push({
                x: fighter.x + Math.cos(angle) * fighter.radius,
                y: fighter.y + Math.sin(angle) * fighter.radius,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                life: 0.4, decay: 0.1, // Faster decay
                size: 6 + Math.random() * 4,
                color: '#ffffff',
                type: 'dot'
            });
        }

        // Shockwave puff
        context.game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x, y: fighter.y,
            radius: fighter.radius,
            maxRadius: fighter.radius * 2,
            life: 0.4, decay: 0.1,
            color: '#ffcccc',
            width: 3
        });

        audioEngine.playBounce();
        logger.log(`${fighter.name} inflates BALLOON!`, 'info');

        fighter.cooldowns.def = this.cooldown + this.duration;
    }

    update(fighter, context) {
        if (this.canUse(fighter, context)) {
            this.execute(fighter, context);
        }

        if (this.active) {
            this.timer--;

            // Animate inflation
            if (this.inflateProgress < 1) {
                this.inflateProgress += 0.15;
                if (this.inflateProgress > 1) this.inflateProgress = 1;
                fighter.radius = fighter.originalRadius +
                    (fighter.balloonTargetRadius - fighter.originalRadius) * this.inflateProgress;
            }

            // Bouncy wobble effect - particles around body (Reduced frequency)
            if (this.timer % 15 === 0) {
                const wobbleAngle = Math.random() * Math.PI * 2;
                context.game.particles.particles.push({
                    x: fighter.x + Math.cos(wobbleAngle) * fighter.radius,
                    y: fighter.y + Math.sin(wobbleAngle) * fighter.radius,
                    vx: Math.cos(wobbleAngle) * 2,
                    vy: Math.sin(wobbleAngle) * 2,
                    life: 0.3, decay: 0.1,
                    size: 4, color: '#ffeeee', type: 'dot'
                });
            }

            // Deflation warning
            if (this.timer < 20 && this.timer % 5 === 0) {
                context.game.particles.spawn(fighter.x, fighter.y, '#cccccc', 3);
            }

            if (this.timer <= 0) {
                this.active = false;
                fighter.isBalloonActive = false;
                fighter.radius = fighter.originalRadius;

                // Deflation puff (Reduced count)
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI * 2 / 4) * i;
                    context.game.particles.particles.push({
                        x: fighter.x + Math.cos(angle) * fighter.radius * 1.5,
                        y: fighter.y + Math.sin(angle) * fighter.radius * 1.5,
                        vx: -Math.cos(angle) * 3,
                        vy: -Math.sin(angle) * 3,
                        life: 0.3, decay: 0.1,
                        size: 5, color: '#dddddd', type: 'dot'
                    });
                }
                audioEngine.playBounce();
                logger.log(`${fighter.name} Balloon deflated.`, 'info');
            }
        }
    }

    onDamage(fighter, amount, context) {
        if (!this.active) return amount;

        // Reflect 100% damage back to attacker (for non-blocked attacks like Cleave or DoTs)
        if (context.attacker && context.attacker !== fighter) {
            context.attacker.takeDamage(amount, false, false, fighter);

            // Visual feedback for reflection
            if (Math.random() < 0.2) {
                context.game.combatText.text(fighter.x, fighter.y - 30, "REFLECT!", '#ffffff');
            }
        }

        // Negate all damage to self while Balloon is active
        return false;
    }

    isBlocked(fighter, attackerX, attackerY, damage) {
        if (!this.active) return false;

        // Try to handle "Melee" reflection for abilities that check for blocks (like Sword Master)
        // If the blocking point is close to another fighter, it's likely a melee strike
        const attacker = fighter.game.entities.find(e =>
            e !== fighter &&
            !e.isDead &&
            Physics.dist(e.x, e.y, attackerX, attackerY) < 10
        );

        if (attacker && damage > 0) {
            attacker.takeDamage(damage, false, false, fighter);

            // Visual feedback (Reduced count)
            fighter.game.particles.spawn(attackerX, attackerY, '#ffffff', 1);
            if (Math.random() < 0.1) {
                fighter.game.combatText.text(fighter.x, fighter.y - 30, "REFLECT!", '#ffffff');
            }
        }

        return true; // Still "Block" it so standard engine handles projectile reflection
    }

    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        if (!this.active) return null;

        // Sphere hit (360 degree protection)
        const hit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, fighter.x, fighter.y, fighter.radius + 5);
        if (hit) {
            const hitAngle = Math.atan2(hit.y - fighter.y, hit.x - fighter.x);
            return {
                x: hit.x,
                y: hit.y,
                dist: hit.dist,
                nx: Math.cos(hitAngle),
                ny: Math.sin(hitAngle),
                enemy: fighter
            };
        }
        return null;
    }
    // Melee Reflection
    onCollide(fighter, other, game) {
        if (!this.active) return false;

        const angle = Math.atan2(other.y - fighter.y, other.x - fighter.x);
        const force = 22; // Massive bounce

        other.dx = Math.cos(angle) * force;
        other.dy = Math.sin(angle) * force;

        // Reflect 100% of their Attack Damage (or base 10)
        const reflectDmg = other.skills && other.skills.atk && other.skills.atk.damage ? other.skills.atk.damage : 10;
        other.takeDamage(reflectDmg, false, false, fighter);

        // Bounce Visual
        // Shockwave ring
        game.particles.particles.push({
            type: 'shockwave',
            x: other.x, y: other.y,
            radius: other.radius, maxRadius: other.radius * 2,
            life: 0.3, decay: 0.1,
            color: '#ffffff', width: 4
        });

        audioEngine.playBounce();
        logger.log(`${fighter.name} BALLOON reflected ${reflectDmg} dmg to ${other.name}!`, 'combat');

        return true; // Collision handled
    }
}

export class ConquerorHakiAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.radius = config.radius || 300;
        this.stunDuration = config.stunDuration || 90;
        this.knockback = config.knockback || 20;
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        logger.log(`${fighter.name} uses CONQUEROR HAKI!`, 'combat');
        audioEngine.playHeavyImpact();

        // === RED AURA EXPLOSION (Domain-style bomb shockwave) ===

        // 1. HAKI text
        game.combatText.text(fighter.x, fighter.y - 50, "HAKI!", '#ff0000');

        // 2. MAIN OUTER RED SHOCKWAVE (Slow expanding)
        game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x, y: fighter.y,
            radius: 10,
            maxRadius: this.radius,
            life: 1.5,  // Much longer life for visibility
            decay: 0.025, // Very slow decay
            color: '#ff0000',
            lineWidth: 10 // Thick
        });

        // 3. MIDDLE BLACK PRESSURE WAVE
        game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x, y: fighter.y,
            radius: 15,
            maxRadius: this.radius * 0.85,
            life: 1.3,
            decay: 0.03,
            color: '#000000',
            lineWidth: 7
        });

        // 4. INNER WHITE-HOT CORE BURST
        game.particles.particles.push({
            type: 'shockwave',
            x: fighter.x, y: fighter.y,
            radius: 20,
            maxRadius: this.radius * 0.5,
            life: 0.8,
            decay: 0.05,
            color: '#ffffff',
            lineWidth: 4
        });

        // 5. Lightning Bolts (Black/Red) radiating out
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 / 5) * i;
            game.particles.spawnBolt(
                [{ x: fighter.x, y: fighter.y },
                { x: fighter.x + Math.cos(angle) * this.radius, y: fighter.y + Math.sin(angle) * this.radius }],
                '#8b0000', 3
            );
        }

        // Apply effects to enemies
        enemies.forEach(e => {
            if (e === fighter || e.isDead) return;

            const dist = Physics.dist(fighter.x, fighter.y, e.x, e.y);
            if (dist <= this.radius) {
                e.applyStatus('STUN', this.stunDuration);

                const angle = Math.atan2(e.y - fighter.y, e.x - fighter.x);
                e.dx = Math.cos(angle) * this.knockback;
                e.dy = Math.sin(angle) * this.knockback;

                // Restored Haki impact effect (Red/Black burst)
                for (let i = 0; i < 12; i++) {
                    game.particles.particles.push({
                        x: e.x, y: e.y,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10,
                        life: 0.8, decay: 0.05,
                        size: Math.random() * 5 + 2,
                        color: Math.random() < 0.6 ? '#8b0000' : '#000000',
                        type: 'dot'
                    });
                }

                // Stun stars (Restored to 80%)
                for (let i = 0; i < 2; i++) {
                    game.particles.particles.push({
                        x: e.x + (Math.random() - 0.5) * 20,
                        y: e.y - e.radius - 10,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -2,
                        life: 0.8, decay: 0.05,
                        size: 4, color: '#ffff00', type: 'dot'
                    });
                }
            }
        });

        fighter.cooldowns.ult = this.cooldown;
    }
}
