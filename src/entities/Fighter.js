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
        this.angle = Math.random() * Math.PI * 2;
        this.isDead = false;

        this.skills = stats.skills || {};
        this.cooldowns = { atk: 0, def: 0, ult: 0 };
        this.maxCooldowns = {
            atk: (this.skills.atk && this.skills.atk.cooldown) || 0,
            def: (this.skills.def && this.skills.def.cooldown) || 0,
            ult: (this.skills.ult && this.skills.ult.cooldown) || 0
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

        // Battle stats tracking
        this.battleStats = {
            damageDealt: 0,
            damageReceived: 0,
            damageBlocked: 0,
            kills: 0,
            healingDone: 0,
            abilityUsage: { atk: 0, def: 0, ult: 0 },
            _abilityActivated: { atk: false, def: false, ult: false },
            statusesApplied: {},
            statusesReceived: {},
            damageByAbility: {},
            damageTakenBySource: {}
        };

        // Initialize abilities
        this.abilities = this.createAbilities(stats.skills);
    }

    createAbilities(skills) {
        const abilities = { atk: null, def: null, ult: null };

        // Use AbilityRegistry for dynamic ability creation
        abilities.atk = skills.atk ? AbilityRegistry.create(skills.atk.type, skills.atk, 'atk') : null;
        abilities.def = skills.def ? AbilityRegistry.create(skills.def.type, skills.def, 'def') : null;
        abilities.ult = skills.ult ? AbilityRegistry.create(skills.ult.type, skills.ult, 'ult', {
            atkConfig: skills.atk,
            ProjectileClass: Projectile
        }) : null;

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
                this.takeDamage(1, false, true, this.status.bleedSource); // isDoT = true
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
                this.takeDamage(1, false, true, this.status.burnSource); // Fixed 1 damage per tick
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

            // OCP: Allow abilities to modify rotation (e.g. Soldier Burst, KOC Aim)
            Object.values(this.abilities).forEach(ability => {
                if (ability && ability.modifyRotation) {
                    rot = ability.modifyRotation(this, rot);
                }
            });

            this.angle += rot;
        }

        // Update visual rotation for wheel
        this.wheelRotation += 0.05 * timeScale;

        // Filter to only enemies (different team ID)
        const enemies = allEntities.filter(e => e.id !== this.id && !e.isDead);
        this.updateSkills(enemies, timeScale);
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

            this.takeDamage(damage, false, false, attacker);
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

        // OCP: Notify abilities of wall bounce
        if (bounced) {
            Object.values(this.abilities).forEach(ability => {
                if (ability && ability.onWallBounce) ability.onWallBounce(this);
            });
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
                let mod = 1.0;
                if (this.status.slow > 0) mod *= 0.75; // 25% slow

                // Burn Slow (10% per stack)
                if (this.status.burn > 0) {
                    const burnSlow = (this.status.burnStacks || 1) * 0.1;
                    mod *= (1 - burnSlow);
                }

                let targetSpeed = this.baseSpeed;

                // OCP: Allow abilities to modify base target speed (e.g. Shieldbearer Momentum)
                Object.values(this.abilities).forEach(ability => {
                    if (ability && ability.modifySpeed) {
                        targetSpeed = ability.modifySpeed(this, targetSpeed);
                    }
                });

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

        // OCP: Delegate dash logic to handling ability (e.g. Ninja Teleport)
        if (this.dashHandler && this.dashHandler.updateDash) {
            this.dashHandler.updateDash(this, timeScale);
        } else {
            // Generic Dash Movement (Soldier Retreat, etc.)
            this.x += this.dx;
            this.y += this.dy;

            // Simple visual trail
            if (this.typeKey === 'SWORD_MASTER') {
                if (Math.random() < 0.5) this.game.particles.spawn(this.x, this.y, '#ff0000', 1);
            } else {
                this.game.particles.spawn(this.x, this.y, '#aaa', 1);
            }
        }

        if (this.dashTimer <= 0) {
            this.isDashing = false;
            this.dashHandler = null; // Clear handler

            // Reset specialized queues if any remain (safety)
            this.chainDashQueue = [];

            // Sword Master stop? (Legacy logic)
            if (this.typeKey === 'SWORD_MASTER') {
                this.dx = Math.cos(this.angle) * this.baseSpeed;
                this.dy = Math.sin(this.angle) * this.baseSpeed;
            }
        }

        const bounds = this.game.arenaBounds;
        this.x = Math.max(bounds.x + this.radius, Math.min(bounds.x + bounds.width - this.radius, this.x));
        this.y = Math.max(bounds.y + this.radius, Math.min(bounds.y + bounds.height - this.radius, this.y));
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

        // Track cooldown states before updates for ability usage counting
        const prevCd = { atk: this.cooldowns.atk, def: this.cooldowns.def, ult: this.cooldowns.ult };
        const prevUltActive = this.activeEffects.ultActive;

        // Update attack ability
        if (this.abilities.atk && this.abilities.atk.update) {
            this.abilities.atk.update(this, context);
        }

        // Update defense ability
        if (this.abilities.def && this.abilities.def.update) {
            this.abilities.def.update(this, context);
        }

        // Check ultimate condition (Auto-trigger when possible)
        if (this.abilities.ult && this.abilities.ult.canUse && this.abilities.ult.canUse(this, context)) {
            this.abilities.ult.execute(this, context);
        }

        // Count ability usages
        for (const slot of ['atk', 'def', 'ult']) {
            const ability = this.abilities[slot];
            if (!ability) continue;

            if (ability.isPassive) {
                // Passive: count once on first activation
                if (!this.battleStats._abilityActivated[slot]) {
                    if (prevCd[slot] <= 0 && this.cooldowns[slot] > 0) {
                        this.battleStats.abilityUsage[slot]++;
                        this.battleStats._abilityActivated[slot] = true;
                    }
                }
            } else {
                // Active: count each cooldown transition
                if (prevCd[slot] <= 0 && this.cooldowns[slot] > 0) {
                    this.battleStats.abilityUsage[slot]++;
                }
            }
        }

        // Detect ultActive going false→true (covers ults like DivineGeneral that set ultActive without cooldown)
        if (!prevUltActive && this.activeEffects.ultActive) {
            if (!this.battleStats._abilityActivated.ult || !this.abilities.ult || !this.abilities.ult.isPassive) {
                // Only count if we didn't already count it via cooldown transition above
                if (!(prevCd.ult <= 0 && this.cooldowns.ult > 0)) {
                    this.battleStats.abilityUsage.ult++;
                }
            }
        }

        // Update active ultimate ability
        if (this.abilities.ult && this.abilities.ult.update) {
            this.abilities.ult.update(this, context);
        }

        // Handle active ultimate effects
        if (this.activeEffects.ultActive) {
            this.activeEffects.ultTimer--;
            if (this.activeEffects.ultTimer <= 0) {
                this.activeEffects.ultActive = false;
                // OCP Compliant: Call stop on the ultimate ability to reset unique flags
                if (this.abilities.ult && this.abilities.ult.stop) {
                    this.abilities.ult.stop(this, context);
                }
            }
        }
    }

    takeDamage(amount, isUnblockable = false, isDoT = false, attacker = null) {
        if (this.isDashing && !isUnblockable) return;

        const context = { game: this.game, isDoT, attacker };

        // Check all abilities for onDamage hooks (e.g. defense, evasion)
        if (!isUnblockable) {
            for (const ability of Object.values(this.abilities)) {
                if (ability && ability.onDamage) {
                    const result = ability.onDamage(this, amount, context);
                    if (result === false) {
                        this.battleStats.damageBlocked += amount;
                        return;
                    }
                    amount = result;
                }
            }
        }

        const dmg = Math.ceil(amount);
        this.battleStats.damageReceived += amount;
        if (attacker && attacker.battleStats) {
            attacker.battleStats.damageDealt += amount;
            const srcName = attacker.name || 'Unknown';
            this.battleStats.damageTakenBySource[srcName] = (this.battleStats.damageTakenBySource[srcName] || 0) + amount;
        }
        this.game.combatText.damage(this.x, this.y - this.radius, dmg);
        this.hp -= amount;

        // Notify game of hit for no-hit arena shrink timer
        if (this.game.registerHit) this.game.registerHit();

        logger.log(`${this.name} took ${dmg} dmg. HP: ${Math.ceil(this.hp)}/${this.maxHp}`, 'combat');

        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.isDead) {
                this.isDead = true;
                if (attacker && attacker.battleStats) attacker.battleStats.kills++;
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
        return amount; // Return final damage dealt
    }

    applyStatus(type, duration = null, applier = null) {
        this.battleStats.statusesReceived[type] = (this.battleStats.statusesReceived[type] || 0) + 1;
        logger.log(`${this.name} applied status: ${type}`, 'info');
        if (type === 'BLEED') {
            this.status.bleed = duration || 180;
            if (applier) this.status.bleedSource = applier;
        }
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
            if (applier) this.status.burnSource = applier;
        }
    }

    heal(amount) {
        const actual = Math.min(amount, this.maxHp - this.hp);
        this.battleStats.healingDone += actual;
        this.hp = Math.min(this.hp + amount, this.maxHp);
        this.game.combatText.healing(this.x, this.y - 20, amount);
        logger.log(`${this.name} healed ${amount}. HP: ${this.hp}/${this.maxHp}`, 'combat');
    }
}
