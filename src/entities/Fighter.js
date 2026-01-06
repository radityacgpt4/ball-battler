/**
 * Fighter Entity
 * Base class for all fighters, using the ability system
 */
import { CONSTANTS } from '../core/Constants.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

// Import ability classes
import { MeleeAbility } from '../abilities/MeleeAbility.js';
import { BurstFireAbility, KunaiAbility, GrenadeAbility, MissileBarrageAbility } from '../abilities/ProjectileAbility.js';
import { RaycastAbility, DoubleZapAbility, LaserAbility } from '../abilities/RaycastAbility.js';
import { DashAssaultAbility, RetreatAbility, FlashBarrageAbility } from '../abilities/DashAbility.js';
import { ParryPassiveAbility, EvasionAbility, StaticPassiveAbility, ShieldDeflectAbility, MomentumPassiveAbility, ForceFieldAbility } from '../abilities/PassiveAbility.js';
import { WallSlamAbility } from '../abilities/SpecialAbility.js';
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
        }

        return abilities;
    }

    update(allEntities) {
        if (this.isDead) return;

        if (this.collisionImmunity > 0) this.collisionImmunity--;
        if (this.cooldowns.atk > 0) this.cooldowns.atk--;
        if (this.cooldowns.def > 0) this.cooldowns.def--;
        if (this.cooldowns.ult > 0) this.cooldowns.ult--;

        let canMove = true;
        if (this.status.stun > 0) { this.status.stun--; canMove = false; }
        if (this.status.slow > 0) this.status.slow--;

        if (this.status.bleed > 0) {
            this.status.bleed--;
            this.status.bleedTick++;
            if (this.status.bleedTick >= 30) {
                this.takeDamage(1);
                this.game.particles.spawn(this.x, this.y, '#ff0000', 2);
                this.status.bleedTick = 0;
            }
        }

        // Ninja Teleport Trigger
        if (this.teleportDelayTimer > 0) {
            this.teleportDelayTimer--;
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
        if (this.activeEffects.evasionTimer > 0) this.activeEffects.evasionTimer--;

        if (this.isDashing) {
            this.handleDash();
        } else if (canMove) {
            this.handleMovement();
        }

        if (this.status.stun <= 0 && !this.isDashing) {
            let rot = this.rotationSpeed;
            if (this.typeKey === 'SOLDIER' && this.activeEffects.burstCount > 0) {
                rot *= 0.2;
            }
            this.angle += rot;
        }

        this.updateSkills(allEntities);
    }

    handleMovement() {
        this.x += this.dx;
        this.y += this.dy;

        let bounced = false;

        if (this.x < this.radius) { this.x = this.radius; this.dx = Math.abs(this.dx); bounced = true; }
        if (this.x > this.game.width - this.radius) { this.x = this.game.width - this.radius; this.dx = -Math.abs(this.dx); bounced = true; }
        if (this.y < this.radius) { this.y = this.radius; this.dy = Math.abs(this.dy); bounced = true; }
        if (this.y > this.game.height - this.radius) { this.y = this.game.height - this.radius; this.dy = -Math.abs(this.dy); bounced = true; }

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

    handleDash() {
        this.dashTimer--;

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
            }

            this.chainDashQueue = [];
            if (this.typeKey === 'SWORD_MASTER') {
                this.dx = Math.cos(this.angle) * this.baseSpeed;
                this.dy = Math.sin(this.angle) * this.baseSpeed;
            }
        }

        this.x = Math.max(this.radius, Math.min(this.game.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(this.game.height - this.radius, this.y));
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

    updateSkills(enemies) {
        if (this.status.stun > 0) return;

        const context = { enemies, game: this.game };

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

    takeDamage(amount) {
        if (this.isDashing) return;

        const context = { game: this.game };

        // Check defensive abilities
        if (this.abilities.def) {
            const result = this.abilities.def.onDamage(this, amount, context);
            if (result === false) return; // Damage was blocked
            amount = result;
        }

        const dmg = Math.ceil(amount);
        this.game.particles.spawnText(this.x, this.y - this.radius, `-${dmg}`, '#ff4444');
        this.hp -= amount;
        if (this.hp <= 0) { this.hp = 0; this.isDead = true; }
    }

    applyStatus(type) {
        if (type === 'BLEED') this.status.bleed = 180;
        if (type === 'STUN') this.status.stun = 60;
        if (type === 'SLOW') this.status.slow = 10; // Short duration, refreshed by beam
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
        }
        ctx.restore();

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
