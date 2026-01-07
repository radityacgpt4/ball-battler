/**
 * Fighter Entity
 * Base class for all fighters, using the ability system
 */
import { CONSTANTS } from '../core/Constants.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

// Import ability classes
import { MeleeAbility } from '../abilities/MeleeAbility.js';
import { BurstFireAbility, KunaiAbility, GrenadeAbility, MissileBarrageAbility } from '../abilities/ProjectileAbility.js';
import { RaycastAbility, DoubleZapAbility, LaserAbility } from '../abilities/RaycastAbility.js';
import { DashAssaultAbility, RetreatAbility, FlashBarrageAbility } from '../abilities/DashAbility.js';
import { ParryPassiveAbility, EvasionAbility, StaticPassiveAbility, ShieldDeflectAbility, MomentumPassiveAbility, ForceFieldAbility } from '../abilities/PassiveAbility.js';
import { WallSlamAbility } from '../abilities/SpecialAbility.js';
import { SniperAtkAbility, ClaymoreAbility, SniperUltAbility } from '../abilities/SniperAbility.js';
import { AxeAtkAbility, BerserkerDefAbility, ExecuteUltAbility } from '../abilities/AxeAbility.js';
import { BallistaAtkAbility, BallistaDefAbility, BallistaUltAbility } from '../abilities/BallistaAbility.js';
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

        // Initialize abilities
        this.abilities = this.createAbilities(stats.skills);
    }

    createAbilities(skills) {
        const abilities = { atk: null, def: null, ult: null };

        // Attack abilities
        switch (skills.atk.type) {
            case 'MELEE_PASSIVE':
                abilities.atk = new MeleeAbility(skills.atk, 'atk');
                break;
            case 'RAYCAST':
                abilities.atk = new RaycastAbility(skills.atk, 'atk');
                break;
            case 'BURST_FIRE':
                abilities.atk = new BurstFireAbility(skills.atk, 'atk');
                break;
            case 'KUNAI_MARK':
                abilities.atk = new KunaiAbility(skills.atk, 'atk');
                break;
            case 'MOMENTUM_PASSIVE':
                abilities.atk = new MomentumPassiveAbility(skills.atk, 'atk');
                break;
            case 'LASER_BEAM':
                abilities.atk = new LaserAbility(skills.atk, 'atk');
                break;
            case 'SNIPER_SHOT':
                abilities.atk = new SniperAtkAbility(skills.atk, 'atk');
                break;
            case 'AXE_SWING':
                abilities.atk = new AxeAtkAbility(skills.atk, 'atk');
                break;
            case 'BALLISTA_SHOT':
                abilities.atk = new BallistaAtkAbility(skills.atk, 'atk');
                break;
        }

        // Defense abilities
        switch (skills.def.type) {
            case 'PARRY_PASSIVE':
                abilities.def = new ParryPassiveAbility(skills.def, 'def');
                break;
            case 'STATIC_PASSIVE':
                abilities.def = new StaticPassiveAbility(skills.def, 'def');
                break;
            case 'RETREAT':
                abilities.def = new RetreatAbility(skills.def, 'def');
                break;
            case 'SHIELD_DEFLECT':
                abilities.def = new ShieldDeflectAbility(skills.def, 'def');
                break;
            case 'EVASION':
                abilities.def = new EvasionAbility(skills.def, 'def');
                break;
            case 'FORCE_FIELD':
                abilities.def = new ForceFieldAbility(skills.def, 'def');
                break;
            case 'CLAYMORE':
                abilities.def = new ClaymoreAbility(skills.def, 'def');
                break;
            case 'BERSERKER_RAGE':
                abilities.def = new BerserkerDefAbility(skills.def, 'def');
                break;
            case 'BARRIER_SHIELD':
                abilities.def = new BallistaDefAbility(skills.def, 'def');
                break;
        }

        // Ultimate abilities
        switch (skills.ult.type) {
            case 'DASH_ASSAULT':
                abilities.ult = new DashAssaultAbility(skills.ult, 'ult');
                break;
            case 'DOUBLE_ZAP':
                abilities.ult = new DoubleZapAbility(skills.ult, 'ult', skills.atk);
                break;
            case 'GRENADE':
                abilities.ult = new GrenadeAbility(skills.ult, 'ult');
                break;
            case 'WALL_SLAM':
                abilities.ult = new WallSlamAbility(skills.ult, 'ult');
                break;
            case 'FLASH_BARRAGE':
                abilities.ult = new FlashBarrageAbility(skills.ult, 'ult', skills.atk, Projectile);
                break;
            case 'MISSILE_BARRAGE':
                abilities.ult = new MissileBarrageAbility(skills.ult, 'ult');
                break;
            case 'SNIPER_MODE':
                abilities.ult = new SniperUltAbility(skills.ult, 'ult');
                break;
            case 'EXECUTE':
                abilities.ult = new ExecuteUltAbility(skills.ult, 'ult');
                break;
            case 'SIEGE_MODE':
                abilities.ult = new BallistaUltAbility(skills.ult, 'ult');
                break;
        }

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

        // Ninja Teleport Trigger
        if (this.teleportDelayTimer > 0) {
            this.teleportDelayTimer = tick(this.teleportDelayTimer);
            if (this.teleportDelayTimer <= 0 && this.kunaiPending.length > 0) {
                this.chainDashQueue = [{x: this.x, y: this.y}];
                this.kunaiPending.forEach(p => this.chainDashQueue.push({x: p.x, y: p.y}));
                this.kunaiPending = [];
                this.isDashing = true;
                this.dashTimer = this.chainDashQueue.length * 4;
                this.dashTimerStart = this.dashTimer;
            }
        }

        // Evasion visual fade back
        if (this.activeEffects.evasionTimer > 0) this.activeEffects.evasionTimer = tick(this.activeEffects.evasionTimer);

        if (this.isDashing) {
            this.handleDash(timeScale);
        } else if (canMove) {
            this.handleMovement(timeScale);
        }

        if (this.status.stun <= 0 && !this.isDashing) {
            let rot = this.rotationSpeed * timeScale;
            if (this.typeKey === 'SOLDIER' && this.activeEffects.burstCount > 0) {
                rot *= 0.2;
            }
            this.angle += rot;
        }

        this.updateSkills(allEntities, timeScale);
    }

    handleMovement(timeScale) {
        this.x += this.dx * timeScale;
        this.y += this.dy * timeScale;

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

            this.game.particles.spawnText(this.x, this.y - 30, "WALL SLAM!", "#ff4444");
            this.game.particles.spawnWallImpact(this.x, this.y);

            const vAngle = Math.atan2(this.dy, this.dx);
            this.dx = Math.cos(vAngle) * this.baseSpeed;
            this.dy = Math.sin(vAngle) * this.baseSpeed;

            if (attacker && !attacker.isDead) {
                const aAngle = Math.random() * Math.PI * 2;
                attacker.dx = Math.cos(aAngle) * attacker.baseSpeed;
                attacker.dy = Math.sin(aAngle) * attacker.baseSpeed;
                this.game.particles.spawnText(attacker.x, attacker.y, "RESET", "#ffffff");
            }

            this.pendingWallSlam = null;
        }

        // BALLISTA PIN Logic (when knocked into wall by bolt)
        if (bounced && this.pendingBallistaPinned) {
            // Stun for 0.5 sec (30 frames)
            this.status.stun = 30;

            audioEngine.playHeavyImpact();

            this.game.particles.spawnText(this.x, this.y - 30, "PINNED!", "#8B4513");
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
                this.game.particles.spawnText(this.x, this.y, "SPEED UP!", "#8b5cf6");
                audioEngine.playSpeedUp();
                this.spawnSonicBoom();
            }
        }

        const speed = Math.hypot(this.dx, this.dy);
        if (speed > 0) {
            let mod = (this.activeEffects.ultActive && this.typeKey === 'SOLDIER') ? 1.5 : 1.0;
            if (this.status.slow > 0) mod *= 0.75; // 25% slow

            let targetSpeed = (this.typeKey === 'SHIELDBEARER') ? this.wallBounceSpeed : this.baseSpeed;
            this.dx = (this.dx / speed) * targetSpeed * mod;
            this.dy = (this.dy / speed) * targetSpeed * mod;
        }
    }

    handleDash(timeScale) {
        this.dashTimer -= 1 * timeScale;

        if (this.typeKey === 'NINJA' && this.chainDashQueue.length > 1) {
            if (this.dashTimer % 4 === 0) {
                const current = this.chainDashQueue.shift();
                const next = this.chainDashQueue[0];

                this.game.particles.spawnSlash(current.x, current.y, next.x, next.y, '#ffd700');
                this.game.particles.spawn(next.x, next.y, '#ffd700', 5);
                audioEngine.playTeleport();

                this.x = next.x;
                this.y = next.y;

                const enemies = this.game.entities.filter(e => e !== this && !e.isDead);
                enemies.forEach(e => {
                    if (Physics.lineCircleIntersect(current.x, current.y, next.x, next.y, e.x, e.y, e.radius + 10)) {
                        e.takeDamage(8);
                        this.game.particles.spawnText(e.x, e.y, "FLASH!", "#ffd700");
                    }
                });
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

                // Rasengan effect at final position (ULT only)
                if (this.pendingRasengan) {
                    const rasenganDamage = this.pendingRasengan;
                    const rasenganRadius = 50; // Small AOE

                    // Visual: Rasengan spiral effect
                    this.game.particles.spawnText(this.x, this.y - 20, "RASENGAN!", "#00BFFF");
                    for (let i = 0; i < 20; i++) {
                        const angle = (Math.PI * 2 / 20) * i;
                        const dist = 15 + Math.random() * 20;
                        this.game.particles.particles.push({
                            x: this.x + Math.cos(angle) * dist,
                            y: this.y + Math.sin(angle) * dist,
                            vx: Math.cos(angle + Math.PI / 2) * 4,
                            vy: Math.sin(angle + Math.PI / 2) * 4,
                            life: 0.6,
                            decay: 0.05,
                            size: 4 + Math.random() * 3,
                            color: '#00BFFF',
                            type: 'dot'
                        });
                    }
                    // Inner glow
                    for (let i = 0; i < 8; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        this.game.particles.particles.push({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * 6,
                            vy: Math.sin(angle) * 6,
                            life: 0.4,
                            decay: 0.08,
                            size: 6,
                            color: '#FFFFFF',
                            type: 'dot'
                        });
                    }

                    audioEngine.playHeavyImpact();

                    // AOE damage to nearby enemies
                    const enemies = this.game.entities.filter(e => e !== this && !e.isDead);
                    enemies.forEach(e => {
                        const dist = Physics.dist(this.x, this.y, e.x, e.y);
                        if (dist < rasenganRadius + e.radius) {
                            e.takeDamage(rasenganDamage);
                            this.game.particles.spawnText(e.x, e.y, `-${rasenganDamage}`, "#00BFFF");
                            // Knockback from rasengan
                            const knockAngle = Math.atan2(e.y - this.y, e.x - this.x);
                            e.dx = Math.cos(knockAngle) * 8;
                            e.dy = Math.sin(knockAngle) * 8;
                        }
                    });

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
        if (this.abilities.def && this.abilities.def instanceof ShieldDeflectAbility) {
            return this.abilities.def.getShieldHit(this, rayX, rayY, dirX, dirY);
        }
        return null;
    }

    /**
     * Check if attacker position is blocked by shield
     */
    isBlockedByShield(attackerX, attackerY) {
        if (this.abilities.def && this.abilities.def instanceof ShieldDeflectAbility) {
            return this.abilities.def.isBlocked(this, attackerX, attackerY);
        }
        return false;
    }

    updateSkills(enemies, timeScale) {
        if (this.status.stun > 0) return;

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
        if (this.hp < this.maxHp * 0.5 && this.cooldowns.ult <= 0 && this.abilities.ult) {
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
            }

            if (this.typeKey === 'THUNDER_MAGE') {
                if (this.activeEffects.ultTimer % 10 === 0) {
                    const rx = this.x + (Math.random()-0.5)*300;
                    const ry = this.y + (Math.random()-0.5)*300;
                    this.game.particles.spawnBolt([{x:rx, y:ry-200}, {x:rx, y:ry}], '#ffaa00');
                    audioEngine.playZap();
                    enemies.forEach(e => {
                        if(e !== this && !e.isDead && Physics.dist(rx, ry, e.x, e.y) < e.radius + 20) {
                            e.takeDamage(5);
                            e.applyStatus('STUN');
                        }
                    });
                }
            }
        }
    }

    takeDamage(amount, isUnblockable = false, isDoT = false) {
        if (this.isDashing && !isUnblockable) return;

        const context = { game: this.game, isDoT };

        // Check defensive abilities (skip for DoT unless ability handles it)
        if (this.abilities.def && !isUnblockable) {
            const result = this.abilities.def.onDamage(this, amount, context);
            if (result === false) return; // Damage was blocked
            amount = result;
        }

        const dmg = Math.ceil(amount);
        this.game.particles.spawnText(this.x, this.y - this.radius, `-${dmg}`, '#ff4444');
        this.hp -= amount;
        
        logger.log(`${this.name} took ${dmg} dmg. HP: ${Math.ceil(this.hp)}/${this.maxHp}`, 'combat');

        if (this.hp <= 0) {
            this.hp = 0;
            if (!this.isDead) {
                this.isDead = true;
                logger.log(`${this.name} was KNOCKED OUT!`, 'error');
                this.game.particles.spawnExplosion(this.x, this.y);
                this.game.particles.spawnText(this.x, this.y, "KO!", "#ff0000");
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
                this.game.particles.spawnText(this.x, this.y, "SLOW", "#cccccc");
            }
            this.status.slow = duration || 30;
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

        // Ballista Barriers Visual (4 sides)
        if (this.ballistaBarriers) {
            ctx.save();
            ctx.translate(this.x, this.y);

            const barrierDist = this.radius + 12;
            const arcAngle = Math.PI / 4; // 45 degree arc per barrier

            for (const barrier of this.ballistaBarriers) {
                if (barrier.destroyed) continue;

                const hpRatio = barrier.hp / barrier.maxHp;
                const startAngle = barrier.angle - arcAngle / 2;
                const endAngle = barrier.angle + arcAngle / 2;

                // Barrier glow based on HP
                ctx.shadowBlur = 5 + hpRatio * 10;
                ctx.shadowColor = '#8B4513';

                // Outer arc (border)
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 4, startAngle, endAngle);
                ctx.lineWidth = 8;
                ctx.strokeStyle = `rgba(139, 69, 19, ${0.3 + hpRatio * 0.4})`;
                ctx.lineCap = 'round';
                ctx.stroke();

                // Inner arc (main barrier)
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 4, startAngle, endAngle);
                ctx.lineWidth = 4;
                ctx.strokeStyle = `rgba(210, 105, 30, ${0.5 + hpRatio * 0.5})`;
                ctx.stroke();

                // HP indicator line
                const hpArc = arcAngle * hpRatio;
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 8, barrier.angle - hpArc / 2, barrier.angle + hpArc / 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = hpRatio > 0.5 ? '#4CAF50' : (hpRatio > 0.25 ? '#FFC107' : '#F44336');
                ctx.stroke();

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
