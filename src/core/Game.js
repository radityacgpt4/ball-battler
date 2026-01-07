/**
 * Game Controller
 * Main game engine that coordinates all systems
 */
import { CONSTANTS } from './Constants.js';
import { FIGHTER_TYPES } from '../data/fighters.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { ParticleSystem } from '../systems/Particles.js';
import { logger } from '../systems/Logger.js';
import { Fighter } from '../entities/Fighter.js';
import { Projectile } from '../entities/Projectile.js';

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();
        this.running = false;
        this.p1Type = 'THUNDER_MAGE';
        this.p2Type = 'SHIELDBEARER';

        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
        this.arenaBounds = {
            x: 0,
            y: 0,
            width: CONSTANTS.WIDTH,
            height: CONSTANTS.HEIGHT
        };
        this.arenaTimer = 0;
        this.timeScale = 1.0;
        this.finishTimer = 0;
        this.isMatchOver = false;
    }

    init() {
        this.canvas = document.getElementById('arena');
        this.ctx = this.canvas.getContext('2d');
        logger.init();
        this.showSelect();
    }

    showSelect() {
        this.running = false;
        document.getElementById('char-select').style.display = 'flex';
        document.getElementById('end-screen').style.display = 'none';
        this.renderCharSelect();
    }

    renderCharSelect() {
        const types = Object.keys(FIGHTER_TYPES);
        const self = this;

        const createBtns = (col, playerNum) => {
            col.innerHTML = `<div class="p-title">PLAYER ${playerNum}</div>`;
            types.forEach(key => {
                const data = FIGHTER_TYPES[key];
                const btn = document.createElement('div');
                btn.className = 'char-btn';
                const current = playerNum === 1 ? self.p1Type : self.p2Type;
                if (current === key) btn.classList.add('active');
                btn.innerHTML = `<span class="char-icon" style="background:${data.color}"></span> ${data.name}`;
                btn.onclick = () => {
                    if (playerNum === 1) self.p1Type = key;
                    else self.p2Type = key;
                    self.renderCharSelect();
                };
                col.appendChild(btn);
            });
        };

        createBtns(document.getElementById('p1-col'), 1);
        createBtns(document.getElementById('p2-col'), 2);
    }

    startMatch() {
        audioEngine.init();
        logger.clear();
        logger.log(`MATCH START: ${this.p1Type} vs ${this.p2Type}`, 'system');

        document.getElementById('char-select').style.display = 'none';
        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
        
        // Reset Arena Bounds
        this.arenaBounds = {
            x: 0,
            y: 0,
            width: CONSTANTS.WIDTH,
            height: CONSTANTS.HEIGHT
        };

        this.arenaTimer = 0;
        this.timeScale = 1.0;
        this.finishTimer = 0;
        this.isMatchOver = false;
        this.updateCanvasSize();

        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();

        this.entities.push(new Fighter(1, 100, 250, this.p1Type, FIGHTER_TYPES, this));
        this.entities.push(new Fighter(2, 400, 250, this.p2Type, FIGHTER_TYPES, this));

        this.createUI();

        this.running = true;
        requestAnimationFrame(this.loop.bind(this));
    }

    updateCanvasSize() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        // Note: Do NOT update --game-width here to prevent UI from shrinking
    }

    handleArenaShrink() {
        this.arenaTimer++;
        if (this.arenaTimer >= 900) {
            this.arenaTimer = 0;
            
            // Shrink bounds towards center
            const shrinkFactor = 0.85;
            const newW = Math.floor(this.arenaBounds.width * shrinkFactor);
            const newH = Math.floor(this.arenaBounds.height * shrinkFactor);
            const dW = (this.arenaBounds.width - newW) / 2;
            const dH = (this.arenaBounds.height - newH) / 2;

            this.arenaBounds.x += dW;
            this.arenaBounds.y += dH;
            this.arenaBounds.width = newW;
            this.arenaBounds.height = newH;

            this.particles.spawnExplosion(this.width / 2, this.height / 2);
            audioEngine.playHeavyImpact();

            // Push entities inside
            this.entities.forEach(e => {
                e.x = Math.max(this.arenaBounds.x + e.radius, Math.min(e.x, this.arenaBounds.x + this.arenaBounds.width - e.radius));
                e.y = Math.max(this.arenaBounds.y + e.radius, Math.min(e.y, this.arenaBounds.y + this.arenaBounds.height - e.radius));
            });
        }
    }

    createUI() {
        const uiHeader = document.getElementById('ui-header');
        uiHeader.innerHTML = '';

        this.entities.forEach(ent => {
            const div = document.createElement('div');
            div.className = 'hud-card';
            const isRight = ent.id === 2;
            div.style.alignItems = isRight ? 'flex-end' : 'flex-start';

            const skillsHTML = `
                <div class="skills-container" style="flex-direction: ${isRight ? 'row-reverse' : 'row'}">
                    <div id="p${ent.id}-atk" class="skill-node skill-atk"><div class="skill-progress"></div><div class="skill-inner"><span class="skill-label">ATK</span></div></div>
                    <div id="p${ent.id}-def" class="skill-node skill-def"><div class="skill-progress"></div><div class="skill-inner"><span class="skill-label">DEF</span></div></div>
                    <div id="p${ent.id}-ult" class="skill-node skill-ult"><div class="skill-progress"></div><div class="skill-inner"><span class="skill-label">ULT</span></div></div>
                </div>
            `;
            
            div.innerHTML = `
                <div class="hud-name" style="color:${ent.color}">${ent.name}</div>
                ${skillsHTML}
            `;
            uiHeader.appendChild(div);
        });
    }

    updateUI() {
        this.entities.forEach(ent => {
            const updateCircle = (type, current, max, isPassive) => {
                const el = document.getElementById(`p${ent.id}-${type}`);
                if (!el) return;

                if (isPassive) {
                    el.classList.add('passive-skill');
                    el.querySelector('.skill-progress').style.background = `var(--skill-color)`;
                } else {
                    el.classList.remove('passive-skill');
                    let pct = 0;
                    if (max > 0) pct = ((max - current) / max) * 100;
                    else pct = 100;

                    if (type === 'ult' && ent.hp > ent.maxHp * 0.5) {
                        el.querySelector('.skill-progress').style.background = `#333`;
                    } else {
                        el.querySelector('.skill-progress').style.background =
                            `conic-gradient(var(--skill-color) ${pct}%, #333 ${pct}%)`;
                    }
                }
            };

            updateCircle('atk', ent.cooldowns.atk, ent.maxCooldowns.atk, ent.skills.atk.type.includes('PASSIVE'));
            updateCircle('def', ent.cooldowns.def, ent.maxCooldowns.def, ent.skills.def.type.includes('PASSIVE') || ent.skills.def.type === 'SHIELD_DEFLECT');
            updateCircle('ult', ent.cooldowns.ult, ent.maxCooldowns.ult, false);
        });
    }

    resolveCollisions() {
        // Projectiles Collision Logic (Moved update to loop for timescale control)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            // p.update(); // Removed, called in loop with timeScale

            if (p.isGrenade && p.hasExploded) {
                this.particles.spawnExplosion(p.x, p.y);
                audioEngine.playExplosion();
                logger.log(`${p.owner.name}'s Grenade EXPLODED!`, 'combat');
                const blastRadius = 60;

                this.entities.forEach(ent => {
                    if (!ent.isDead && ent !== p.owner) {
                        const d = Physics.dist(p.x, p.y, ent.x, ent.y);
                        if (d < blastRadius + ent.radius) {
                            ent.takeDamage(p.damage, false, false, p.owner);
                            const angle = Math.atan2(ent.y - p.y, ent.x - p.x);
                            const force = 12;
                            ent.dx += Math.cos(angle) * force;
                            ent.dy += Math.sin(angle) * force;
                            ent.applyStatus('STUN');
                        }
                    }
                });

                this.projectiles.splice(i, 1);
                continue;
            }

            if (!p.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.isClaymore) {
                for (let ent of this.entities) {
                    if (ent === p.owner || ent.isDead) continue;
                    if (Physics.dist(p.x, p.y, ent.x, ent.y) < ent.radius + p.radius + 5) {
                        // Trigger Claymore
                        ent.takeDamage(p.damage, false, false, p.owner);
                        if (p.slowDuration > 0) ent.applyStatus('SLOW', p.slowDuration);

                        this.particles.spawnExplosion(p.x, p.y);
                        audioEngine.playExplosion();
                        logger.log(`${ent.name} triggered ${p.owner.name}'s CLAYMORE!`, 'combat');
                        
                        p.active = false;
                        break;
                    }
                }
                continue;
            }

            if (!p.isGrenade) {
                for (let ent of this.entities) {
                    if (ent === p.owner || ent.isDead) continue;
                    if (Physics.dist(p.x, p.y, ent.x, ent.y) < ent.radius + p.radius) {

                        // Check if projectile is blocked by shield
                        if (!p.isUnblockable && ent.isBlockedByShield(p.x, p.y)) {
                            p.owner = ent;
                            p.hitList = [];
                            p.travelled = 0;
                            p.isEmbedded = false;

                            const reflectAngle = ent.angle;
                            const speed = Math.hypot(p.dx, p.dy);
                            p.dx = Math.cos(reflectAngle) * speed;
                            p.dy = Math.sin(reflectAngle) * speed;
                            p.angle = reflectAngle;
                            p.x = ent.x + Math.cos(reflectAngle) * (ent.radius + 15);
                            p.y = ent.y + Math.sin(reflectAngle) * (ent.radius + 15);
                            this.particles.spawn(p.x, p.y, '#8b5cf6', 10);
                            audioEngine.playBlock();
                            logger.log(`${ent.name} DEFLECTED projectile from ${p.owner.name}`, 'warn');
                        } else {
                            if (p.isKunai) {
                                if (!p.hitList.includes(ent.id)) {
                                    ent.takeDamage(p.damage, false, false, p.owner);
                                    p.hitList.push(ent.id);
                                    this.particles.spawn(ent.x, ent.y, '#ffd700', 3);
                                    audioEngine.playHit();
                                }
                            } else if (p.isBallistaBolt) {
                                // Ballista bolt - damage and knockback
                                ent.takeDamage(p.damage, false, false, p.owner);
                                this.particles.spawn(ent.x, ent.y, '#8B4513', 5);
                                audioEngine.playHit();

                                // Only knockback if not already being knocked back
                                if (!ent.pendingBallistaPinned && !p.dragTarget) {
                                    // Apply knockback velocity in bolt direction (fixed speed)
                                    const knockbackSpeed = 8;
                                    ent.dx = Math.cos(p.angle) * knockbackSpeed;
                                    ent.dy = Math.sin(p.angle) * knockbackSpeed;

                                    // Set pending pin for wall collision
                                    ent.pendingBallistaPinned = { owner: p.owner };
                                    p.dragTarget = ent;

                                    // Spawn knockback trail particles
                                    for (let i = 0; i < 8; i++) {
                                        this.particles.particles.push({
                                            x: ent.x,
                                            y: ent.y,
                                            vx: -Math.cos(p.angle) * (2 + Math.random() * 2),
                                            vy: -Math.sin(p.angle) * (2 + Math.random() * 2),
                                            life: 0.6,
                                            decay: 0.05,
                                            size: 4 + Math.random() * 3,
                                            color: '#8B4513',
                                            type: 'dot'
                                        });
                                    }
                                } else {
                                    // Already being knocked - just damage, deactivate bolt
                                    p.active = false;
                                }
                            } else {
                                ent.takeDamage(p.damage, p.isUnblockable, false, p.owner);
                                if (p.stunDuration > 0) ent.applyStatus('STUN', p.stunDuration);

                                p.active = false;
                                audioEngine.playHit();
                            }
                        }
                        // Unblockable shots destroy shield logic (pierce through? or just ignore?)
                        // Current logic: if unblockable, we skipped the shield block block.
                        // So we are here.
                        
                        if (!p.isKunai || (!p.isUnblockable && ent.isBlockedByShield(p.x, p.y))) break;
                    }
                }
            }
        }

        // Entities
        for (let i = 0; i < this.entities.length; i++) {
            for (let j = i + 1; j < this.entities.length; j++) {
                let e1 = this.entities[i];
                let e2 = this.entities[j];
                if (e1.isDead || e2.isDead) continue;
                if (e1.isDashing || e2.isDashing) continue;

                let dist = Physics.dist(e1.x, e1.y, e2.x, e2.y);
                let minDist = e1.radius + e2.radius;

                if (dist < minDist) {
                    // Static passive (Volt's zap on contact)
                    if (e1.skills.def.type === 'STATIC_PASSIVE' && e2.status.stun <= 0) {
                        e2.applyStatus('STUN');
                        this.particles.spawn(e2.x, e2.y, '#00FFFF', 8);
                        audioEngine.playZap();
                        logger.log(`${e1.name} STATIC PASSIVE stunned ${e2.name}!`, 'combat');
                    }
                    if (e2.skills.def.type === 'STATIC_PASSIVE' && e1.status.stun <= 0) {
                        e1.applyStatus('STUN');
                        this.particles.spawn(e1.x, e1.y, '#00FFFF', 8);
                        audioEngine.playZap();
                        logger.log(`${e2.name} STATIC PASSIVE stunned ${e1.name}!`, 'combat');
                    }

                    // SHIELDBEARER: Momentum Collision
                    const handleMomentumHit = (attacker, defender) => {
                        if (attacker.typeKey !== 'SHIELDBEARER') return false;

                        if (defender.collisionImmunity > 0) return false;

                        const config = attacker.skills.atk;
                        const speedTier = Math.floor((attacker.wallBounceSpeed - attacker.baseSpeed) / config.speedGain);

                        if (speedTier <= 0 && !attacker.ultWallSlamActive) return false;

                        if (defender.isBlockedByShield(attacker.x, attacker.y)) {
                            logger.log(`${defender.name} blocked momentum slam from ${attacker.name}`, 'combat');
                            attacker.wallBounceSpeed = attacker.baseSpeed;
                            const reverseAngle = Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
                            attacker.dx = Math.cos(reverseAngle) * 10;
                            attacker.dy = Math.sin(reverseAngle) * 10;
                            this.particles.spawn(
                                defender.x + Math.cos(defender.angle) * 30,
                                defender.y + Math.sin(defender.angle) * 30,
                                '#8b5cf6', 10
                            );
                            audioEngine.playBlock();
                            return true;
                        }

                        let damage = speedTier * config.damagePerTier;

                        if (attacker.ultWallSlamActive) {
                            damage = Math.max(damage, 10);
                        }

                        defender.takeDamage(damage, false, false, attacker);
                        this.particles.spawn(defender.x, defender.y, '#8b5cf6', 8);
                        logger.log(`${attacker.name} SLAMMED ${defender.name} for ${damage} dmg (SpeedTier: ${speedTier})`, 'combat');
                        audioEngine.playHeavyImpact();

                        const massRatio = attacker.mass / defender.mass;
                        const baseKnock = config.knockback * massRatio;
                        const speedBonus = speedTier * 5;
                        let totalKnock = baseKnock + speedBonus;

                        if (attacker.ultWallSlamActive) {
                            const angle = Math.atan2(defender.y - attacker.y, defender.x - attacker.x);

                            const knockbackSpeed = 8; // Fixed knockback speed
                            defender.dx = Math.cos(angle) * knockbackSpeed;
                            defender.dy = Math.sin(angle) * knockbackSpeed;

                            defender.pendingWallSlam = { owner: attacker };

                            for (let i = 0; i < 10; i++) {
                                this.particles.spawn(defender.x, defender.y, '#ff4444', 1);
                            }
                        } else {
                            const angle = Math.atan2(defender.y - attacker.y, defender.x - attacker.x);
                            defender.dx = Math.cos(angle) * totalKnock;
                            defender.dy = Math.sin(angle) * totalKnock;
                        }

                        attacker.wallBounceSpeed = attacker.baseSpeed;

                        for (let k = 0; k < 15; k++) {
                            this.particles.spawn(defender.x, defender.y, '#8b5cf6', 1);
                        }

                        defender.collisionImmunity = 30;

                        return true;
                    };

                    const hit1 = handleMomentumHit(e1, e2);
                    const hit2 = handleMomentumHit(e2, e1);

                    // Separation
                    let angle = Math.atan2(e2.y - e1.y, e2.x - e1.x);
                    let overlap = (minDist - dist) + 1;
                    let m1 = e1.mass, m2 = e2.mass;
                    let r1 = m2 / (m1 + m2), r2 = m1 / (m1 + m2);

                    e1.x -= Math.cos(angle) * overlap * r1;
                    e1.y -= Math.sin(angle) * overlap * r1;
                    e2.x += Math.cos(angle) * overlap * r2;
                    e2.y += Math.sin(angle) * overlap * r2;

                    // Normal elastic collision (only if no special hit happened)
                    if (!hit1 && !hit2) {
                        let nx = (e2.x - e1.x) / dist, ny = (e2.y - e1.y) / dist;
                        let p = 2 * (e1.dx * nx + e1.dy * ny - e2.dx * nx - e2.dy * ny) / (m1 + m2);
                        e1.dx -= p * m2 * nx;
                        e1.dy -= p * m2 * ny;
                        e2.dx += p * m1 * nx;
                        e2.dy += p * m1 * ny;
                        audioEngine.playHit();
                    }
                }
            }
        }
    }

    checkWinCondition() {
        if (this.isMatchOver) {
            this.finishTimer++;
            // Wait 120 frames (approx 2s at 60fps, but effectively longer due to timescale)
            // We want real-time waiting, so if timescale is 0.2, we need fewer ticks or check real time
            // Let's just count frames, at 0.2 scale it looks cool.
            if (this.finishTimer > 150) {
                this.running = false;
                const alive = this.entities.filter(e => !e.isDead);
                const overlay = document.getElementById('end-screen');
                const msg = document.getElementById('win-msg');
                overlay.style.display = 'flex';
                if (alive.length === 0) {
                    msg.innerText = "DRAW";
                    msg.style.color = "white";
                    logger.log("MATCH END: DRAW", 'system');
                } else {
                    msg.innerText = `${alive[0].name} WINS`;
                    msg.style.color = alive[0].color;
                    logger.log(`MATCH END: ${alive[0].name} WINS!`, 'system');
                }
            }
            return;
        }

        const alive = this.entities.filter(e => !e.isDead);
        if (alive.length <= 1) {
            this.isMatchOver = true;
            this.timeScale = 0.2; // SLOW MOTION
            audioEngine.playWin();
        }
    }

    loop() {
        if (!this.running) return;
        
        // Only shrink arena if match is not over
        if (!this.isMatchOver) {
            this.handleArenaShrink();
        }

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Arena Bounds
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.arenaBounds.x, this.arenaBounds.y, this.arenaBounds.width, this.arenaBounds.height);

        // Draw Danger Zone
        if (this.arenaBounds.width < this.width) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
            this.ctx.fillRect(0, 0, this.width, this.arenaBounds.y); // Top
            this.ctx.fillRect(0, this.arenaBounds.y + this.arenaBounds.height, this.width, this.height - (this.arenaBounds.y + this.arenaBounds.height)); // Bottom
            this.ctx.fillRect(0, this.arenaBounds.y, this.arenaBounds.x, this.arenaBounds.height); // Left
            this.ctx.fillRect(this.arenaBounds.x + this.arenaBounds.width, this.arenaBounds.y, this.width - (this.arenaBounds.x + this.arenaBounds.width), this.arenaBounds.height); // Right
        }

        this.entities.forEach(ent => ent.update(this.entities, this.timeScale));
        this.resolveCollisions(); // Physics resolution is usually instantaneous position fix, so timeScale optional depending on implementation
        this.updateUI();

        this.entities.forEach(ent => ent.draw(this.ctx));
        this.projectiles.forEach(p => p.update(this.timeScale)); // Update projectiles first
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.particles.updateAndDraw(this.ctx);

        this.checkWinCondition();
        if (this.running) requestAnimationFrame(this.loop.bind(this));
    }
}
