/**
 * Game Controller
 * Main game engine that coordinates all systems
 */
import { CONSTANTS } from './Constants.js';
import { FIGHTER_TYPES } from '../data/fighters.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { ParticleSystem } from '../systems/Particles.js';
import { BattleRecorder } from '../systems/BattleRecorder.js';
import { Fighter } from '../entities/Fighter.js';
import { Projectile } from '../entities/Projectile.js';

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();
        this.recorder = new BattleRecorder();
        this.running = false;
        this.p1Type = 'THUNDER_MAGE';
        this.p2Type = 'SHIELDBEARER';

        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
        this.arenaTimer = 0;

        this.isRecording = false;
    }

    init() {
        this.canvas = document.getElementById('arena');
        this.ctx = this.canvas.getContext('2d');
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

        document.getElementById('char-select').style.display = 'none';
        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
        this.arenaTimer = 0;
        this.updateCanvasSize();

        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();

        this.entities.push(new Fighter(1, 100, 250, this.p1Type, FIGHTER_TYPES, this));
        this.entities.push(new Fighter(2, 400, 250, this.p2Type, FIGHTER_TYPES, this));

        this.createUI();

        // Initialize recorder with canvas and audio
        if (BattleRecorder.isSupported()) {
            this.recorder.init(this.canvas, audioEngine.getStream());
            this.recorder.start();
            this.isRecording = true;
            this.showRecordingIndicator(true);
        }

        this.running = true;
        requestAnimationFrame(this.loop.bind(this));
    }

    updateCanvasSize() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        document.documentElement.style.setProperty('--game-width', `${this.width}px`);
    }

    handleArenaShrink() {
        this.arenaTimer++;
        if (this.arenaTimer >= 900) {
            this.arenaTimer = 0;
            this.width = Math.floor(this.width * 0.85);
            this.height = Math.floor(this.height * 0.85);
            this.updateCanvasSize();
            this.particles.spawnText(this.width / 2, this.height / 2, "ARENA SHRINK!", "#ff0000");
            audioEngine.playHeavyImpact();

            this.entities.forEach(e => {
                e.x = Math.min(e.x, this.width - e.radius);
                e.y = Math.min(e.y, this.height - e.radius);
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
        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.update();

            if (p.isGrenade && p.hasExploded) {
                this.particles.spawnExplosion(p.x, p.y);
                this.particles.spawnText(p.x, p.y, "BOOM!", "#ffaa00");
                audioEngine.playExplosion();
                const blastRadius = 60;

                this.entities.forEach(ent => {
                    if (!ent.isDead && ent !== p.owner) {
                        const d = Physics.dist(p.x, p.y, ent.x, ent.y);
                        if (d < blastRadius + ent.radius) {
                            ent.takeDamage(p.damage);
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

            if (!p.isGrenade) {
                for (let ent of this.entities) {
                    if (ent === p.owner || ent.isDead) continue;
                    if (Physics.dist(p.x, p.y, ent.x, ent.y) < ent.radius + p.radius) {

                        // Check if projectile is blocked by shield
                        if (ent.isBlockedByShield(p.x, p.y)) {
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
                            this.particles.spawnText(ent.x, ent.y, "DEFLECT!", "#8b5cf6");
                            this.particles.spawn(p.x, p.y, '#ffffff', 10);
                            audioEngine.playBlock();
                        } else {
                            if (p.isKunai) {
                                if (!p.hitList.includes(ent.id)) {
                                    ent.takeDamage(p.damage);
                                    p.hitList.push(ent.id);
                                    this.particles.spawn(ent.x, ent.y, '#ffd700', 3);
                                    audioEngine.playHit();
                                }
                            } else {
                                ent.takeDamage(p.damage);
                                p.active = false;
                                audioEngine.playHit();
                            }
                        }
                        if (!p.isKunai || ent.isBlockedByShield(p.x, p.y)) break;
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
                        this.particles.spawnText(e2.x, e2.y, "ZAP!", "#00FFFF");
                        audioEngine.playZap();
                    }
                    if (e2.skills.def.type === 'STATIC_PASSIVE' && e1.status.stun <= 0) {
                        e1.applyStatus('STUN');
                        this.particles.spawnText(e1.x, e1.y, "ZAP!", "#00FFFF");
                        audioEngine.playZap();
                    }

                    // SHIELDBEARER: Momentum Collision
                    const handleMomentumHit = (attacker, defender) => {
                        if (attacker.typeKey !== 'SHIELDBEARER') return false;

                        if (defender.collisionImmunity > 0) return false;

                        const config = attacker.skills.atk;
                        const speedTier = Math.floor((attacker.wallBounceSpeed - attacker.baseSpeed) / config.speedGain);

                        if (speedTier <= 0 && !attacker.ultWallSlamActive) return false;

                        if (defender.isBlockedByShield(attacker.x, attacker.y)) {
                            this.particles.spawnText(defender.x, defender.y, "BLOCKED!", "#ffffff");
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

                        defender.takeDamage(damage);
                        this.particles.spawnText(defender.x, defender.y, `SLAM ${damage}!`, "#8b5cf6");
                        audioEngine.playHeavyImpact();

                        const massRatio = attacker.mass / defender.mass;
                        const baseKnock = config.knockback * massRatio;
                        const speedBonus = speedTier * 5;
                        let totalKnock = baseKnock + speedBonus;

                        if (attacker.ultWallSlamActive) {
                            const angle = Math.atan2(defender.y - attacker.y, defender.x - attacker.x);

                            const superSpeed = 18;
                            defender.dx = Math.cos(angle) * superSpeed;
                            defender.dy = Math.sin(angle) * superSpeed;

                            defender.pendingWallSlam = { owner: attacker };
                            this.particles.spawnText(defender.x, defender.y, "FLY!", "#ff4444");

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

    showRecordingIndicator(show) {
        let indicator = document.getElementById('recording-indicator');
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'recording-indicator';
                indicator.className = 'recording-indicator';
                indicator.innerHTML = '<div class="recording-dot"></div><span class="recording-text">REC</span>';
                document.getElementById('game-wrapper').appendChild(indicator);
            }
            indicator.style.display = 'flex';
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    }

    async checkWinCondition() {
        const alive = this.entities.filter(e => !e.isDead);
        if (alive.length <= 1) {
            if (this.running) audioEngine.playWin();
            this.running = false;

            // Stop recording and offer download
            if (this.isRecording) {
                this.recorder.stop();
                this.isRecording = false;
                this.showRecordingIndicator(false);

                // Wait a moment for recorder to finalize
                await new Promise(resolve => setTimeout(resolve, 500));

                // Auto-download the recording
                try {
                    await this.recorder.export();
                } catch (err) {
                    console.error('Failed to export recording:', err);
                }
            }

            const overlay = document.getElementById('end-screen');
            const msg = document.getElementById('win-msg');
            overlay.style.display = 'flex';
            if (alive.length === 0) {
                msg.innerText = "DRAW";
                msg.style.color = "white";
            } else {
                msg.innerText = `${alive[0].name} WINS`;
                msg.style.color = alive[0].color;
            }
        }
    }

    loop() {
        if (!this.running) return;
        this.handleArenaShrink();
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.entities.forEach(ent => ent.update(this.entities));
        this.resolveCollisions();
        this.updateUI();

        this.entities.forEach(ent => ent.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.particles.updateAndDraw(this.ctx);

        this.checkWinCondition();
        if (this.running) requestAnimationFrame(this.loop.bind(this));
    }
}
