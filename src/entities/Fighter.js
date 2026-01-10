/**
 * Fighter Entity
 * Base class for all fighters, using the ability system
 */
import { CONSTANTS } from '../core/Constants.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { AbilityRegistry } from '../core/AbilityRegistry.js';
import { Projectile } from './Projectile.js';

export class Fighter {
    constructor(id, x, y, typeKey, fighterTypes, gameRef) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.typeKey = typeKey;
        this.game = gameRef;

        const stats = fighterTypes[typeKey];
        this.name = stats.name;
        this.color = stats.color;
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.mass = stats.mass;
        this.baseSpeed = stats.speed;
        this.rotationSpeed = stats.rotationSpeed;
        this.radius = CONSTANTS.BALL_RADIUS;

        this.dx = (Math.random() < 0.5 ? -1 : 1) * this.baseSpeed;
        this.dy = (Math.random() < 0.5 ? -1 : 1) * this.baseSpeed;
        this.angle = 0;
        this.isDead = false;

        this.skills = stats.skills;
        this.cooldowns = { atk: 0, def: 0, ult: 0 };
        this.maxCooldowns = {
            atk: stats.skills.atk.cooldown || 0,
            def: stats.skills.def.cooldown || 0,
            ult: stats.skills.ult.cooldown || 0
        };

        this.status = { stun: 0, bleed: 0, bleedTick: 0, slow: 0 };
        this.isDashing = false;
        this.dashTimer = 0;
        this.activeEffects = {
            burstCount: 0,
            burstTimer: 0,
            ultActive: false,
            ultTimer: 0,
            evasionTimer: 0
        };

        this.meleeHits = 0;

        // Shieldbearer State
        this.wallBounceSpeed = this.baseSpeed;
        this.ultWallSlamActive = false;
        this.originalMass = this.mass;

        this.pendingWallSlam = null;

        // Ninja State
        this.kunaiPending = [];
        this.teleportDelayTimer = 0;
        this.chainDashQueue = [];
        this.dashTimerStart = 0;

        // Fairplay Mechanism
        this.collisionImmunity = 0;

        // Visuals
        this.wheelRotation = 0;

        // Initialize abilities
        this.abilities = this.createAbilities(stats.skills);
    }

    createAbilities(skills) {
        const abilities = { atk: null, def: null, ult: null };

        // Use AbilityRegistry for dynamic ability creation
        abilities.atk = AbilityRegistry.create(skills.atk.type, skills.atk, 'atk');
        abilities.def = AbilityRegistry.create(skills.def.type, skills.def, 'def');
        abilities.ult = AbilityRegistry.create(skills.ult.type, skills.ult, 'ult', {
            atkConfig: skills.atk,
            ProjectileClass: Projectile
        });

        return abilities;
    }

    update(allEntities, timeScale = 1.0) {
        if (this.isDead) return;

        // Apply timescale to timers (rounding for integer timers)
        const tick = (val) => Math.max(0, val - 1 * timeScale);

        if (this.collisionImmunity > 0) this.collisionImmunity = tick(this.collisionImmunity);
        if (this.cooldowns.atk > 0) this.cooldowns.atk = tick(this.cooldowns.atk);
        if (this.cooldowns.def > 0) this.cooldowns.def = tick(this.cooldowns.def);
        if (this.cooldowns.ult > 0) this.cooldowns.ult = tick(this.cooldowns.ult);

        let canMove = true;
        if (this.status.stun > 0) { this.status.stun = tick(this.status.stun); canMove = false; }
        if (this.status.slow > 0) this.status.slow = tick(this.status.slow);

        if (this.status.bleed > 0) {
            this.status.bleed = tick(this.status.bleed);
            this.status.bleedTick += 1 * timeScale;
            if (this.status.bleedTick >= 30) {
                this.takeDamage(1, false, true); // isDoT = true
                this.game.particles.spawn(this.x, this.y, '#ff0000', 2);
                this.status.bleedTick = 0;
            }
        }

        // BURN Logic (King of Curses) - fixed 2 dmg/sec (stacks increase duration, not damage)
        if (this.status.burn > 0) {
            this.status.burn = tick(this.status.burn);
            if (this.status.burn <= 0) {
                this.status.burnStacks = 0;
            }
            if (typeof this.status.burnTick === 'undefined') this.status.burnTick = 0;
            this.status.burnTick += 1 * timeScale;

            // Tick every 0.5 seconds (30 frames) - deals fixed 1 dmg per tick = 2 dmg/sec
            if (this.status.burnTick >= 30) {
                this.takeDamage(1, false, true); // Fixed 1 damage per tick
                this.game.particles.spawn(this.x, this.y, '#FF4500', 3);
                this.status.burnTick = 0;
            }

            // Burning particle effect on fighter (constant while burning)
            if (Math.random() < 0.15) {
                this.game.particles.particles.push({
                    x: this.x + (Math.random() - 0.5) * this.radius * 1.5,
                    y: this.y + (Math.random() - 0.5) * this.radius,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -1 - Math.random() * 2, // Rise up
                    life: 0.4,
                    decay: 0.03,
                    size: 3 + Math.random() * 3,
                    color: Math.random() > 0.5 ? '#FF4500' : '#FFD700',
                    type: 'dot'
                });
            }
        }

        // Ninja Teleport Trigger
        if (this.teleportDelayTimer > 0) {
            this.teleportDelayTimer = tick(this.teleportDelayTimer);
            if (this.teleportDelayTimer <= 0 && this.kunaiPending.length > 0) {
                this.chainDashQueue = [{ x: this.x, y: this.y }];
                this.kunaiPending.forEach(p => {
                    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                        this.chainDashQueue.push({ x: p.x, y: p.y });
                    }
                });
                this.kunaiPending = [];
                if (this.chainDashQueue.length > 1) {
                    this.isDashing = true;
                } else {
                    // Fail safe: if no valid targets, cancel dash
                    this.teleportDelayTimer = 0;
                    this.chainDashQueue = [];
                }
                this.dashTimer = this.chainDashQueue.length * 4;
                this.dashTimerStart = this.dashTimer;
            }
        }

        // Evasion visual fade back
        if (this.activeEffects.evasionTimer > 0) this.activeEffects.evasionTimer = tick(this.activeEffects.evasionTimer);

        if (this.isDashing) {
            this.handleDash(timeScale);
        } else {
            // Always allow physics/movement processing (stun now handled inside handleMovement)
            this.handleMovement(timeScale);
        }

        if (this.status.stun <= 0 && !this.isDashing) {
            let rot = this.rotationSpeed * timeScale;
            if (this.typeKey === 'SOLDIER' && this.activeEffects.burstCount > 0) {
                rot *= 0.2;
            }

            // King of Curses: Slow rotation by 60% when facing opponent (aiming mechanic)
            if (this.typeKey === 'KING_OF_CURSES') {
                const opponent = allEntities.find(e => e !== this && !e.isDead);
                if (opponent) {
                    const angleToOpponent = Math.atan2(opponent.y - this.y, opponent.x - this.x);
                    let angleDiff = Math.abs(this.angle - angleToOpponent);
                    // Normalize angle difference to [0, PI]
                    while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

                    // If facing opponent (within ~45 degrees), slow rotation
                    if (angleDiff < Math.PI / 4) {
                        rot *= 0.4; // 60% slow
                    }
                }
            }

            this.angle += rot;
        }

        // Update visual rotation for wheel
        this.wheelRotation += 0.05 * timeScale;

        this.updateSkills(allEntities, timeScale);
    }

    handleMovement(timeScale) {
        let speedMult = this.laserSpeedMult || 1.0;
        if (this.status.slow > 0) speedMult *= 0.3; // 70% slow (Cumulative)

        // Domain slow (20% reduction)
        if (this.status.domainSlow > 0) {
            speedMult *= 0.8;
            this.status.domainSlow--;
        }

        this.x += this.dx * speedMult * timeScale;
        this.y += this.dy * speedMult * timeScale;

        let bounced = false;

        const bounds = this.game.arenaBounds;
        if (this.x < bounds.x + this.radius) { this.x = bounds.x + this.radius; this.dx = Math.abs(this.dx); bounced = true; }
        if (this.x > bounds.x + bounds.width - this.radius) { this.x = bounds.x + bounds.width - this.radius; this.dx = -Math.abs(this.dx); bounced = true; }
        if (this.y < bounds.y + this.radius) { this.y = bounds.y + this.radius; this.dy = Math.abs(this.dy); bounced = true; }
        if (this.y > bounds.y + bounds.height - this.radius) { this.y = bounds.y + bounds.height - this.radius; this.dy = -Math.abs(this.dy); bounced = true; }

        if (bounced) audioEngine.playBounce();

        // WALL SLAM Logic (Shieldbearer Ult)
        if (bounced && this.pendingWallSlam) {
            const attacker = this.pendingWallSlam.owner;
            const damage = attacker.skills.ult.damage;

            this.takeDamage(damage);
            audioEngine.playHeavyImpact();

            this.status.stun = 30;

            this.game.combatText.wallSlam(this.x, this.y - 30);
            this.game.particles.spawnWallImpact(this.x, this.y);
            logger.log(`${this.name} hit the WALL SLAM!`, 'combat');

            const vAngle = Math.atan2(this.dy, this.dx);
            this.dx = Math.cos(vAngle) * this.baseSpeed;
            this.dy = Math.sin(vAngle) * this.baseSpeed;

            if (attacker && !attacker.isDead) {
                const aAngle = Math.random() * Math.PI * 2;
                attacker.dx = Math.cos(aAngle) * attacker.baseSpeed;
                attacker.dy = Math.sin(aAngle) * attacker.baseSpeed;
                this.game.particles.spawn(attacker.x, attacker.y, '#ffffff', 5);
            }

            this.pendingWallSlam = null;
        }

        // BALLISTA PIN Logic (when knocked into wall by bolt)
        if (bounced && this.pendingBallistaPinned) {
            // Stun for 0.5 sec (30 frames)
            this.status.stun = 30;

            audioEngine.playHeavyImpact();
            this.game.particles.spawnWallImpact(this.x, this.y);

            // Reset to normal speed
            const vAngle = Math.atan2(this.dy, this.dx);
            this.dx = Math.cos(vAngle) * this.baseSpeed;
            this.dy = Math.sin(vAngle) * this.baseSpeed;

            this.pendingBallistaPinned = null;
        }

        // SHIELDBEARER: Momentum on wall bounce
        if (bounced && this.typeKey === 'SHIELDBEARER') {
            const config = this.skills.atk;
            if (this.wallBounceSpeed < config.maxSpeed) {
                this.wallBounceSpeed = Math.min(this.wallBounceSpeed + config.speedGain, config.maxSpeed);
                this.game.combatText.speedUp(this.x, this.y);
                this.game.particles.spawn(this.x, this.y, '#8b5cf6', 5);
                audioEngine.playSpeedUp();
                this.spawnSonicBoom();
                logger.log(`${this.name} SPEED UP! (${this.wallBounceSpeed.toFixed(1)}/${config.maxSpeed})`, 'info');
            }
        }

        let speed = Math.hypot(this.dx, this.dy);

        // If STUNNED, apply friction/decay instead of driving velocity
        if (this.status.stun > 0) {
            if (speed > 0) {
                // Apply friction (lower decay to allow sliding/bouncing)
                this.dx *= 0.88;
                this.dy *= 0.88;
                if (speed < 0.1) {
                    this.dx = 0;
                    this.dy = 0;
                }
            }
        } else {
            // RECOVERY: If speed dropped to 0 (e.g. after stun), restart movement
            if (speed <= 0.1 && !this.isDead) {
                const restartAngle = Math.random() * Math.PI * 2;
                this.dx = Math.cos(restartAngle) * this.baseSpeed;
                this.dy = Math.sin(restartAngle) * this.baseSpeed;
            } else if (speed > 0) {
                // Normal movement driving
                let mod = (this.activeEffects.ultActive && this.typeKey === 'SOLDIER') ? 1.5 : 1.0;
                if (this.status.slow > 0) mod *= 0.75; // 25% slow

                // Burn Slow (10% per stack)
                if (this.status.burn > 0) {
                    const burnSlow = (this.status.burnStacks || 1) * 0.1;
                    mod *= (1 - burnSlow);
                }

                let targetSpeed = (this.typeKey === 'SHIELDBEARER') ? this.wallBounceSpeed : this.baseSpeed;
                targetSpeed *= mod;

                // GLOBAL SPEED CAP: Prevent physics "explosions" from overlapping teleports/dashes
                const MAX_SPEED = 20;
                if (speed > MAX_SPEED) {
                    this.dx = (this.dx / speed) * MAX_SPEED;
                    this.dy = (this.dy / speed) * MAX_SPEED;
                    speed = MAX_SPEED;
                }

                // Soft Clamp / Friction for Knockback
                if (speed > targetSpeed) {
                    // We are flying from knockback - apply friction
                    const friction = 0.92;
                    this.dx *= friction;
                    this.dy *= friction;
                } else {
                    // Normal driving force to maintain speed
                    this.dx = (this.dx / speed) * targetSpeed;
                    this.dy = (this.dy / speed) * targetSpeed;
                }
            }
        }
    }


    handleDash(timeScale) {
        this.dashTimer -= 1 * timeScale;

        if (this.typeKey === 'NINJA' && this.chainDashQueue.length > 1) {
            if (this.dashTimer % 4 === 0) {
                const current = this.chainDashQueue.shift();
                const next = this.chainDashQueue[0];

                // Validate coordinates
                if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) {
                    this.dashTimer = 0;
                    this.isDashing = false;
                    return;
                }

                // === The Yellow Flash (Lore Accurate) ===
                // 1. Afterimage at start
                this.game.particles.particles.push({
                    x: current.x, y: current.y,
                    vx: 0, vy: 0,
                    life: 0.4, decay: 0.1,
                    size: this.radius, color: '#ffd700', type: 'dot', alpha: 0.15
                });

                // 2. Yellow Flash Streak (Solid Beam)
                // Use 'beam' type for a cohesive glowing line with white core
                // Decay 0.08 means it lasts ~12 frames (0.2s), much more visible than 2 frames
                // Width 8: Sharp and thin, distinct from the ball body (diameter 50)
                this.game.particles.spawnBeam(current.x, current.y, next.x, next.y, '#ffd700', 8, 0.08);

                // Add faint parallel lines for speed illusion
                const px = current.y - next.y; // Perpendicular vector (simple approximation)
                const py = next.x - current.x;
                const len = Math.hypot(px, py) || 1;
                const offX = (px / len) * 8;
                const offY = (py / len) * 8;

                // Secondary faint beam
                this.game.particles.spawnBeam(
                    current.x + offX, current.y + offY,
                    next.x + offX, next.y + offY,
                    '#ffd700', 2, 0.1 // Thin line decays slightly faster
                );

                // 3. Subtle destination marker (No explosion)
                this.game.particles.particles.push({
                    x: next.x, y: next.y,
                    vx: 0, vy: 0,
                    life: 0.3, decay: 0.1,
                    size: this.radius, color: '#ffd700', type: 'dot', alpha: 0.15
                });

                audioEngine.playTeleport();

                this.x = next.x;
                this.y = next.y;

                const enemies = this.game.entities.filter(e => e !== this && !e.isDead);
                let hitTarget = null;

                // Check collisions
                for (const e of enemies) {
                    if (Physics.lineCircleIntersect(current.x, current.y, next.x, next.y, e.x, e.y, e.radius + 15)) {
                        hitTarget = e;
                        if (this.pendingRasengan) break; // Priority hit for Ult
                    }
                }

                if (hitTarget) {
                    if (this.pendingRasengan) {
                        // === TRIGGER RASENGAN HIT ===
                        // Move to impact point (not center, to avoid physics NaN issues)
                        const impactAngle = Math.atan2(hitTarget.y - current.y, hitTarget.x - current.x);
                        const stopDist = hitTarget.radius + this.radius + 1;
                        this.x = hitTarget.x - Math.cos(impactAngle) * stopDist;
                        this.y = hitTarget.y - Math.sin(impactAngle) * stopDist;

                        this.triggerRasengan(hitTarget);

                        // Stop Dash Immediately
                        this.chainDashQueue = [];
                        this.dashTimer = 0;
                        this.isDashing = false;
                        this.pendingRasengan = null;
                        this.game.projectiles = this.game.projectiles.filter(p => !p.isKunai || p.owner !== this);
                        return;
                    } else {
                        // Normal dash damage
                        this.game.combatText.flash(hitTarget.x, hitTarget.y - hitTarget.radius);
                        hitTarget.takeDamage(8);
                        this.game.particles.spawn(hitTarget.x, hitTarget.y, '#ffd700', 5);
                    }
                }
            }
        } else if (this.typeKey === 'SWORD_MASTER') {
            this.x += this.dx; this.y += this.dy;
            if (Math.random() < 0.5) this.game.particles.spawn(this.x, this.y, '#ff0000', 1);
        } else {
            this.x += this.dx; this.y += this.dy;
            this.game.particles.spawn(this.x, this.y, '#aaa', 1);
        }

        if (this.dashTimer <= 0) {
            this.isDashing = false;

            if (this.typeKey === 'NINJA') {
                this.game.projectiles = this.game.projectiles.filter(p => !p.isKunai || p.owner !== this);

                // Rasengan effect at final position (if missed)
                if (this.pendingRasengan) {
                    this.triggerRasengan(null); // Null target = AOE at location
                    this.pendingRasengan = null;
                }
            }

            this.chainDashQueue = [];
            if (this.typeKey === 'SWORD_MASTER') {
                this.dx = Math.cos(this.angle) * this.baseSpeed;
                this.dy = Math.sin(this.angle) * this.baseSpeed;
            }
        }

        const bounds = this.game.arenaBounds;
        this.x = Math.max(bounds.x + this.radius, Math.min(bounds.x + bounds.width - this.radius, this.x));
        this.y = Math.max(bounds.y + this.radius, Math.min(bounds.y + bounds.height - this.radius, this.y));
    }

    triggerRasengan(directHitTarget = null) {
        const rasenganDamage = this.pendingRasengan;
        const rasenganRadius = 60;

        // === Spectacular Visuals ===
        // 1. Spiral
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const dist = 10 + Math.random() * 40;
            this.game.particles.particles.push({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: Math.cos(angle + Math.PI / 2) * 8, // Faster spin
                vy: Math.sin(angle + Math.PI / 2) * 8,
                life: 0.8,
                decay: 0.04,
                size: 3 + Math.random() * 4,
                color: '#00BFFF',
                type: 'dot'
            });
        }
        // 2. Core Burst
        this.game.particles.spawnExplosion(this.x, this.y); // Add fiery burst center
        this.game.particles.spawn(this.x, this.y, '#00BFFF', 20); // Blue burst
        this.game.particles.spawn(this.x, this.y, '#ffffff', 10); // White core

        // 3. Shockwave
        this.game.particles.particles.push({
            type: 'shockwave', x: this.x, y: this.y,
            radius: 10, maxRadius: 100,
            life: 1.0, decay: 0.05, color: '#00BFFF'
        });

        audioEngine.playHeavyImpact();

        if (directHitTarget) {
            logger.log(`${this.name} RASENGAN DIRECT HIT on ${directHitTarget.name}!`, 'combat');
            directHitTarget.takeDamage(rasenganDamage * 1.5, true); // Bonus dmg for direct hit? Or just ensure hit.
            // Let's stick to base damage or slight bonus. Prompt didn't specify bonus but direct hit usually implies it.
            // I'll stick to rasenganDamage to be safe, but apply it.
            // Actually, let's just do AOE to ensure everyone near gets hit, including target.
        } else {
            logger.log(`${this.name} Rasengan exploded!`, 'info');
        }

        // AOE damage
        const enemies = this.game.entities.filter(e => e !== this && !e.isDead);
        enemies.forEach(e => {
            const dist = Physics.dist(this.x, this.y, e.x, e.y);
            if (dist < rasenganRadius + e.radius) {
                // If direct hit, we already logged, but maybe didn't damage yet.
                // To avoid double damage, we can check.
                // Simple approach: Just deal damage here to all in AOE.
                e.takeDamage(rasenganDamage, true); // Unblockable? Rasengan breaks guards usually.

                // Heavy Knockback
                const knockAngle = Math.atan2(e.y - this.y, e.x - this.x);
                e.dx = Math.cos(knockAngle) * 12;
                e.dy = Math.sin(knockAngle) * 12;
                e.applyStatus('STUN', 45); // Add stun
            }
        });
    }

    spawnSonicBoom() {
        const moveAngle = Math.atan2(this.dy, this.dx);
        for (let i = 0; i < 12; i++) {
            const angle = moveAngle + Math.PI + (Math.random() - 0.5) * 1.5;
            const speed = 3 + Math.random() * 3;
            this.game.particles.particles.push({
                x: this.x - Math.cos(moveAngle) * this.radius,
                y: this.y - Math.sin(moveAngle) * this.radius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.06,
                size: 4 + Math.random() * 4,
                color: '#ffffff',
                type: 'dot'
            });
        }
        this.game.particles.particles.push({
            type: 'shockwave',
            x: this.x,
            y: this.y,
            radius: this.radius,
            maxRadius: 80,
            life: 1.0,
            decay: 0.08,
            color: '#8b5cf6'
        });
    }

    /**
     * SHIELD SYSTEM - Check if a ray hits the shield arc
     */
    getShieldHit(rayX, rayY, dirX, dirY) {
        if (this.abilities.def && typeof this.abilities.def.getShieldHit === 'function') {
            return this.abilities.def.getShieldHit(this, rayX, rayY, dirX, dirY);
        }
        return null;
    }

    /**
     * Check if attacker position is blocked by shield
     */
    isBlockedByShield(attackerX, attackerY, damage = 0) {
        if (this.abilities.def && typeof this.abilities.def.isBlocked === 'function') {
            return this.abilities.def.isBlocked(this, attackerX, attackerY, damage);
        }
        return false;
    }

    updateSkills(enemies, timeScale) {
        // Passive updates (DEF/ULT) should run even while stunned
        // to handle timers like healing or absorption counters.
        // Physical activities (ATK) are blocked inside the abilities.

        const context = { enemies, game: this.game, timeScale };

        // Update attack ability
        if (this.abilities.atk && this.abilities.atk.update) {
            this.abilities.atk.update(this, context);
        }

        // Update defense ability
        if (this.abilities.def && this.abilities.def.update) {
            this.abilities.def.update(this, context);
        }

        // Check ultimate condition (HP < 50%)
        // Divine General (Mahoraga) triggers ULT on attack hit instead
        if (this.hp < this.maxHp * 0.5 && this.cooldowns.ult <= 0 && this.abilities.ult && this.typeKey !== 'DIVINE_GENERAL') {
            this.abilities.ult.execute(this, context);
        }

        // Handle active ultimate effects
        if (this.activeEffects.ultActive) {
            this.activeEffects.ultTimer--;
            if (this.activeEffects.ultTimer <= 0) {
                this.activeEffects.ultActive = false;
                if (this.typeKey === 'SHIELDBEARER') {
                    this.ultWallSlamActive = false;
                    this.mass = this.originalMass;
                }
                if (this.typeKey === 'DIVINE_GENERAL') {
                    this.activeEffects.adaptationAbsorbing = false;
                }
            }

            if (this.typeKey === 'THUNDER_MAGE') {
                if (this.activeEffects.ultTimer % 10 === 0) {
                    const rx = this.x + (Math.random() - 0.5) * 300;
                    const ry = this.y + (Math.random() - 0.5) * 300;
                    this.game.particles.spawnBolt([{ x: rx, y: ry - 200 }, { x: rx, y: ry }], '#ffaa00');
                    audioEngine.playZap();
                    enemies.forEach(e => {
                        if (e !== this && !e.isDead && Physics.dist(rx, ry, e.x, e.y) < e.radius + 20) {
                            e.takeDamage(5);
                            e.applyStatus('STUN');
                        }
                    });
                }
            }
        }
    }

    takeDamage(amount, isUnblockable = false, isDoT = false, attacker = null) {
        if (this.isDashing && !isUnblockable) return;

        const context = { game: this.game, isDoT, attacker };

        // Check defensive abilities (skip for DoT unless ability handles it)
        if (this.abilities.def && !isUnblockable) {
            const result = this.abilities.def.onDamage(this, amount, context);
            if (result === false) return; // Damage was blocked
            amount = result;
        }

        const dmg = Math.ceil(amount);
        this.game.combatText.damage(this.x, this.y - this.radius, dmg);
        this.hp -= amount;

        logger.log(`${this.name} took ${dmg} dmg. HP: ${Math.ceil(this.hp)}/${this.maxHp}`, 'combat');

        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.isDead) {
                this.isDead = true;
                this.game.combatText.knockout(this.x, this.y - this.radius, this.name);
                logger.log(`${this.name} was KNOCKED OUT!`, 'error');
                this.game.particles.spawnExplosion(this.x, this.y);
                audioEngine.playExplosion();

                // Ghost effect
                this.game.particles.particles.push({
                    x: this.x, y: this.y,
                    vx: 0, vy: -1,
                    life: 2.0, decay: 0.02,
                    size: this.radius, color: '#ffffff',
                    type: 'dot',
                    alpha: 0.5
                });
            }
        }
    }

    applyStatus(type, duration = null) {
        logger.log(`${this.name} applied status: ${type}`, 'info');
        if (type === 'BLEED') this.status.bleed = duration || 180;
        if (type === 'STUN') this.status.stun = duration || 60;
        if (type === 'SLOW') {
            if (this.status.slow <= 0) {
                this.game.particles.spawn(this.x, this.y, '#cccccc', 5);
            }
            this.status.slow = duration || 30;
        }
        if (type === 'BURN') {
            this.status.burn = duration || 180;
            if (!this.status.burnStacks) this.status.burnStacks = 1;
        }
    }

    draw(ctx) {
        if (this.isDead) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Evasion Transparency
        if (this.activeEffects.evasionTimer > 0) {
            ctx.globalAlpha = 0.2;
        }

        if (this.status.stun > 0) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Slow effect visual
        if (this.status.slow > 0) {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Wall slam knockback indicator
        if (this.beingPushed) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Pushing indicator
        if (this.isPushing) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.save();
        ctx.rotate(this.angle);
        if (this.typeKey === 'SWORD_MASTER') {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(this.radius - 5, -4, this.skills.atk.range, 8);
        } else if (this.typeKey === 'SOLDIER') {
            ctx.fillStyle = '#333';
            ctx.fillRect(this.radius - 5, -6, 20, 12);
        } else if (this.typeKey === 'SHIELDBEARER') {
            const halfArc = this.skills.def.arcAngle / 2;

            if (this.wallBounceSpeed > this.baseSpeed) {
                ctx.shadowBlur = this.wallBounceSpeed * 4;
                ctx.shadowColor = '#8b5cf6';
            }

            if (this.ultWallSlamActive) {
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ff4444';
            }

            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, -halfArc, halfArc);
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#c4b5fd';
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, -halfArc, halfArc);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#8b5cf6';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 12, -halfArc * 0.85, halfArc * 0.85);
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.ultWallSlamActive ? '#ff6666' : '#a78bfa';
            ctx.stroke();

            ctx.shadowBlur = 0;
        } else if (this.typeKey === 'THUNDER_MAGE') {
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(this.radius, 0, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.typeKey === 'NINJA') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-this.radius - 10, -5, 15, 4);
            ctx.fillRect(-this.radius - 10, 1, 15, 4);
        } else if (this.typeKey === 'CYBORG') {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(this.radius, 0, 5, 0, Math.PI * 2); // Eye/Core
            ctx.fill();
        } else if (this.typeKey === 'AXEMAN') {
            // === DOUBLE-SIDED BATTLEAXE (Slim & Long) ===
            const handleLength = 48;
            const handleStart = this.radius - 5;
            const bladeCenter = handleStart + handleLength - 5;

            // Handle shadow (depth)
            ctx.fillStyle = '#3E2723';
            ctx.fillRect(handleStart, -1, handleLength, 4);

            // Main wooden handle (slimmer)
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(handleStart, -2, handleLength, 4);

            // Handle grip wrapping
            ctx.strokeStyle = '#4E342E';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const gx = handleStart + 8 + i * 6;
                ctx.beginPath();
                ctx.moveTo(gx, -2);
                ctx.lineTo(gx + 2, 2);
                ctx.stroke();
            }

            // Handle end cap (pommel - smaller)
            ctx.fillStyle = '#757575';
            ctx.beginPath();
            ctx.arc(handleStart + 2, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#9E9E9E';
            ctx.beginPath();
            ctx.arc(handleStart + 2, -1, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Metal collar where blades attach (slimmer)
            ctx.fillStyle = '#616161';
            ctx.fillRect(bladeCenter - 3, -4, 6, 8);
            ctx.fillStyle = '#9E9E9E';
            ctx.fillRect(bladeCenter - 2, -3, 4, 6);

            // === TOP BLADE (slimmer, longer) ===
            ctx.beginPath();
            ctx.moveTo(bladeCenter - 2, -4);
            // Curve up to blade peak (reduced height from 26 to 18)
            ctx.quadraticCurveTo(bladeCenter - 5, -12, bladeCenter + 8, -18);
            // Sharp cutting edge curving to tip (extended reach)
            ctx.quadraticCurveTo(bladeCenter + 26, -14, bladeCenter + 24, -5);
            // Blade beard (lower edge curves back)
            ctx.quadraticCurveTo(bladeCenter + 16, -4, bladeCenter + 2, -4);
            ctx.closePath();

            // Blade gradient fill
            const topGrad = ctx.createLinearGradient(bladeCenter, -18, bladeCenter + 24, -4);
            topGrad.addColorStop(0, '#78909C');
            topGrad.addColorStop(0.5, '#B0BEC5');
            topGrad.addColorStop(1, '#ECEFF1');
            ctx.fillStyle = topGrad;
            ctx.fill();

            // Blade edge highlight
            ctx.strokeStyle = '#ECEFF1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bladeCenter + 8, -18);
            ctx.quadraticCurveTo(bladeCenter + 26, -14, bladeCenter + 24, -5);
            ctx.stroke();

            // === BOTTOM BLADE (mirror) ===
            ctx.beginPath();
            ctx.moveTo(bladeCenter - 2, 4);
            ctx.quadraticCurveTo(bladeCenter - 5, 12, bladeCenter + 8, 18);
            ctx.quadraticCurveTo(bladeCenter + 26, 14, bladeCenter + 24, 5);
            ctx.quadraticCurveTo(bladeCenter + 16, 4, bladeCenter + 2, 4);
            ctx.closePath();

            const botGrad = ctx.createLinearGradient(bladeCenter, 18, bladeCenter + 24, 4);
            botGrad.addColorStop(0, '#78909C');
            botGrad.addColorStop(0.5, '#B0BEC5');
            botGrad.addColorStop(1, '#ECEFF1');
            ctx.fillStyle = botGrad;
            ctx.fill();

            // Bottom blade edge highlight
            ctx.strokeStyle = '#ECEFF1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bladeCenter + 8, 18);
            ctx.quadraticCurveTo(bladeCenter + 26, 14, bladeCenter + 24, 5);
            ctx.stroke();

            // Blood effect on axe if combo hits > 0
            if (this.axemanHits > 0) {
                ctx.globalAlpha = 0.6 + (this.axemanHits * 0.1);
                // Blood drips on top blade
                ctx.fillStyle = '#8B0000';
                ctx.beginPath();
                ctx.ellipse(bladeCenter + 16, -10, 3, 4, 0.3, 0, Math.PI * 2);
                ctx.fill();
                // Blood drips on bottom blade
                ctx.beginPath();
                ctx.ellipse(bladeCenter + 14, 8, 2, 4, -0.3, 0, Math.PI * 2);
                ctx.fill();
                // Dripping effect
                if (this.axemanHits >= 3) {
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.ellipse(bladeCenter + 18, -15, 1.5, 3, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            }
        } else if (this.typeKey === 'BALLISTA') {
            // === BALLISTA CROSSBOW ===
            const bowLength = 50;
            const bowStart = this.radius - 5;

            // Crossbow stock (wooden base)
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(bowStart, -4, 35, 8);

            // Stock detail
            ctx.fillStyle = '#4E342E';
            ctx.fillRect(bowStart + 5, -3, 25, 6);

            // Crossbow arms (bent bow shape)
            ctx.strokeStyle = '#3E2723';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(bowStart + 30, 0);
            ctx.quadraticCurveTo(bowStart + 35, -25, bowStart + 20, -30);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bowStart + 30, 0);
            ctx.quadraticCurveTo(bowStart + 35, 25, bowStart + 20, 30);
            ctx.stroke();

            // Bow arms inner (lighter wood)
            ctx.strokeStyle = '#6D4C41';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bowStart + 30, 0);
            ctx.quadraticCurveTo(bowStart + 34, -22, bowStart + 22, -28);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bowStart + 30, 0);
            ctx.quadraticCurveTo(bowStart + 34, 22, bowStart + 22, 28);
            ctx.stroke();

            // Bowstring
            ctx.strokeStyle = '#D7CCC8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bowStart + 20, -30);
            ctx.lineTo(bowStart + 10, 0);
            ctx.lineTo(bowStart + 20, 30);
            ctx.stroke();

            // Loaded bolt
            ctx.fillStyle = '#4A4A4A';
            ctx.fillRect(bowStart + 8, -2, 28, 4);

            // Bolt head
            ctx.fillStyle = '#757575';
            ctx.beginPath();
            ctx.moveTo(bowStart + 38, 0);
            ctx.lineTo(bowStart + 32, -4);
            ctx.lineTo(bowStart + 32, 4);
            ctx.closePath();
            ctx.fill();

            // Metal reinforcement at center
            ctx.fillStyle = '#616161';
            ctx.fillRect(bowStart + 28, -6, 6, 12);
        }
        ctx.restore();

        // Ballista Barriers Visual (4 sides) - rotate with fighter
        if (this.ballistaBarriers) {
            ctx.save();
            // ctx.translate(this.x, this.y); // Removed double translation

            // Visual copy of Shieldbearer shield style
            const barrierDist = this.radius + 3;  // Closer to body like Shieldbearer
            // Shieldbearer is Math.PI * 0.65 (117 degrees)
            // We need 4 shields fitting in 360 without overlap. 360/4 = 90.
            // Let's use 70 degrees (approx 1.22 rad) to leave gaps
            const arcAngle = 1.22;
            const halfArc = arcAngle / 2;

            for (const barrier of this.ballistaBarriers) {
                if (barrier.destroyed) continue;

                const hpRatio = barrier.hp / barrier.maxHp;
                // Add fighter's angle so barriers rotate with the fighter
                const adjustedAngle = barrier.angle + this.angle;

                // --- Shieldbearer 1:1 Visual Style ---

                // Glow
                ctx.shadowBlur = 5 + hpRatio * 10;
                ctx.shadowColor = '#8B4513';

                // 1. Thick Outer Base (lighter)
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
                ctx.lineWidth = 12;
                ctx.strokeStyle = `rgba(210, 180, 140, ${0.6 + hpRatio * 0.4})`; // Tan/Wood light color
                ctx.lineCap = 'round';
                ctx.stroke();

                // 2. Main Inner Shield (darker core)
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#8B4513'; // SaddleBrown
                ctx.stroke();

                // 3. Detail Line (HP Indicator / Rim)
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 7, adjustedAngle - halfArc * 0.85, adjustedAngle + halfArc * 0.85);
                ctx.lineWidth = 2;
                // Color change based on HP state
                ctx.strokeStyle = hpRatio > 0.5 ? '#DAA520' : (hpRatio > 0.25 ? '#FF8C00' : '#FF0000');
                ctx.stroke();

                // Draw HP text (same font size as Cyborg: 12px, no shield icon)
                const textX = Math.cos(adjustedAngle) * (barrierDist + 18);
                const textY = Math.sin(adjustedAngle) * (barrierDist + 18);
                ctx.fillStyle = '#DAA520';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeText(Math.ceil(barrier.hp), textX, textY);
                ctx.fillText(Math.ceil(barrier.hp), textX, textY);

                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }

        // Force Field Visual
        if (this.shieldHp > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3 + (this.shieldHp / this.maxShield) * 0.3;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fill();
            ctx.restore();

            // Sticky Shield HP UI
            ctx.save();
            ctx.fillStyle = "#00ffff";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "center";
            ctx.strokeText(`🛡️${Math.ceil(this.shieldHp)}`, 0, -this.radius - 15);
            ctx.fillText(`🛡️${Math.ceil(this.shieldHp)}`, 0, -this.radius - 15);
            ctx.restore();
        }

        // Cursed Shield Visual (King of Curses)
        if (this.cursedShield > 0) {
            ctx.save();
            // Pulsing/Sinister effect
            const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5; // 0 to 1
            ctx.globalAlpha = 0.4 + pulse * 0.2;

            // Dark Red / Crimson jagged aura
            ctx.strokeStyle = '#DC143C';
            ctx.lineWidth = 3;
            ctx.beginPath();
            // Jagged circle
            const shieldRadius = this.radius + 8;
            for (let i = 0; i <= 360; i += 10) {
                const angle = i * Math.PI / 180;
                const r = shieldRadius + (Math.random() * 4 - 2); // Jitter
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.fillStyle = 'rgba(220, 20, 60, 0.15)';
            ctx.fill();

            ctx.restore();

            // Shield HP UI
            ctx.save();
            ctx.fillStyle = "#DC143C";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "center";
            ctx.strokeText(`👹${Math.ceil(this.cursedShield)}`, 0, -this.radius - 15);
            ctx.fillText(`👹${Math.ceil(this.cursedShield)}`, 0, -this.radius - 15);
            ctx.restore();
        }

        ctx.fillStyle = this.color;
        if (this.activeEffects.ultActive) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
        }
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(this.radius / 2, 0, this.radius / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(-this.angle);

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(Math.ceil(this.hp), 0, 1);
        ctx.fillText(Math.ceil(this.hp), 0, 1);

        ctx.restore();
    }
}
