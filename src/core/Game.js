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
import { CombatTextHelper } from '../systems/CombatText.js';
import { renderer } from '../systems/Renderer.js';
import { CollisionHandler } from '../systems/CollisionHandler.js';
import { Fighter } from '../entities/Fighter.js';
import { Projectile } from '../entities/Projectile.js';

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();
        this.combatText = new CombatTextHelper(this.particles);
        this.collisionHandler = new CollisionHandler(this);
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

        // FPS standardization
        this.targetFPS = CONSTANTS.TARGET_FPS || 60;
        this.frameTime = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
        this.frameAccumulator = 0;
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

        // Default selections if none
        if (!this.p1Type) this.p1Type = 'SWORD_MASTER';
        if (!this.p2Type) this.p2Type = 'SNIPER';

        this.renderCharSelect();
    }

    renderCharSelect() {
        const types = Object.keys(FIGHTER_TYPES);
        const grid = document.getElementById('char-grid');
        grid.innerHTML = '';

        types.forEach(key => {
            const data = FIGHTER_TYPES[key];
            const item = document.createElement('div');
            item.className = 'grid-item';

            // Highlight selections
            if (this.p1Type === key && this.p2Type === key) item.classList.add('selected-both');
            else if (this.p1Type === key) item.classList.add('selected-p1');
            else if (this.p2Type === key) item.classList.add('selected-p2');

            item.innerHTML = `
                <div class="grid-icon" style="background:${data.color}"></div>
                <div class="grid-name">${data.name}</div>
            `;

            item.onclick = (e) => {
                // simple toggle: click selects for P1, right-click (or special modifier) for P2?
                // Let's do: if left side of button click P1, right side P2? 
                // Or just alternate? Let's just do left-click P1, right-click P2 for ease of use in dev,
                // but for "AI automation" maybe a simpler toggle.
                // Let's use a clear P1/P2 button inside or just click order.
                // Better: If already P1, move to P2.
                if (this.p1Type !== key) {
                    this.p1Type = key;
                } else {
                    this.p2Type = key;
                }
                this.renderCharSelect();
            };

            // Right click for P2 selection
            item.oncontextmenu = (e) => {
                e.preventDefault();
                this.p2Type = key;
                this.renderCharSelect();
            };

            grid.appendChild(item);
        });

        this.updateDetailPanel(1, this.p1Type);
        this.updateDetailPanel(2, this.p2Type);
    }

    updateDetailPanel(playerNum, type) {
        const data = FIGHTER_TYPES[type];
        const prefix = `p${playerNum}`;

        document.getElementById(`${prefix}-detail-name`).innerText = data.name;
        document.getElementById(`${prefix}-detail-name`).style.color = data.color;

        // Stats
        const statsEl = document.getElementById(`${prefix}-detail-stats`);
        statsEl.innerHTML = `
            <div class="stat-item">HP <span class="stat-val">${data.hp}</span></div>
            <div class="stat-item">SPD <span class="stat-val">${data.speed}</span></div>
            <div class="stat-item">MASS <span class="stat-val">${data.mass}</span></div>
        `;

        // Skills
        const skillsEl = document.getElementById(`${prefix}-detail-skills`);
        skillsEl.innerHTML = '';

        ['atk', 'def', 'ult'].forEach(slot => {
            const skill = data.skills[slot];
            const div = document.createElement('div');
            div.className = 'detail-skill-item';
            div.innerHTML = `
                <div class="d-skill-title">${slot}</div>
                <div class="d-skill-name">${skill.name || slot.toUpperCase()}</div>
                <div class="d-skill-desc">${skill.desc || 'No description available.'}</div>
            `;
            skillsEl.appendChild(div);
        });
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
        this.lastFrameTime = performance.now();
        this.frameAccumulator = 0;
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

            // Log and visual feedback for arena shrink
            logger.log(`ARENA SHRINKING! New size: ${newW}x${newH}`, 'error');
            this.combatText.arenaShrink(this.width / 2, this.height / 2);
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
                <div class="hud-name" style="color:${ent.color}">P${ent.id} - ${ent.name}</div>
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

            updateCircle('atk', ent.cooldowns.atk, ent.maxCooldowns.atk, ent.skills.atk.isPassive);
            updateCircle('def', ent.cooldowns.def, ent.maxCooldowns.def, ent.skills.def.isPassive);
            updateCircle('ult', ent.cooldowns.ult, ent.maxCooldowns.ult, ent.skills.ult.isPassive);
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
                            // Explosion impulse based on mass
                            const force = 15 / ent.mass;
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
                        if (!p.isUnblockable && ent.isBlockedByShield(p.x, p.y, p.damage)) {
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

                            // FIX: Add lifetime to deflected projectiles so they don't litter arena
                            p.deflectLifetime = 120; // 2 seconds at 60fps
                            p.isDeflected = true;

                            // Reset kunai max distance for deflected travel
                            if (p.isKunai) {
                                p.maxDist = p.travelled + 300; // Allow more travel distance
                            }
                            // Disable missile homing after deflection
                            if (p.isMissile) {
                                p.target = null;
                                p.isMissile = false; // Convert to dumb projectile
                            }

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
                                    // Apply knockback IMPULSE (Additive)
                                    // Physics: Force = Mass * Acceleration
                                    // Heavier targets resist knockback more
                                    const knockbackForce = 18 / Math.sqrt(ent.mass); 
                                    
                                    ent.dx += Math.cos(p.angle) * knockbackForce;
                                    ent.dy += Math.sin(p.angle) * knockbackForce;

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
                            } else if (p.isMissile) {
                                ent.takeDamage(p.damage, p.isUnblockable, false, p.owner);
                                this.particles.spawnExplosion(ent.x, ent.y); // Small explosion
                                p.active = false;
                                audioEngine.playExplosion(); // Or lighter explosion sound
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

            if (!p.isKunai || (!p.isUnblockable && ent.isBlockedByShield(p.x, p.y, p.damage))) break;
                    }
                }
            }
        }

        // Entities - Delegate to Physics System
        this.collisionHandler.resolveEntityCollisions(this.entities);
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
                    msg.innerText = `P${alive[0].id} - ${alive[0].name} WINS`;
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

    loop(currentTime) {
        if (!this.running) return;

        if (!currentTime) currentTime = performance.now();

        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        this.frameAccumulator += deltaTime;

        // Prevent spiral of death
        if (this.frameAccumulator > 200) {
            this.frameAccumulator = this.frameTime;
        }

        // Fixed time step updates
        while (this.frameAccumulator >= this.frameTime) {
            // Only shrink arena if match is not over
            if (!this.isMatchOver) {
                this.handleArenaShrink();
            }

            // Performance profiling (check console for stutter sources)
            // console.time('entities');
            this.entities.forEach(ent => ent.update(this.entities, this.timeScale));
            // console.timeEnd('entities');

            // console.time('collisions');
            this.resolveCollisions();
            // console.timeEnd('collisions');

            this.projectiles.forEach(p => p.update(this.timeScale));
            this.updateUI();
            this.checkWinCondition();

            this.frameAccumulator -= this.frameTime;
        }

        // Render at monitor refresh rate
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

        // console.time('render');
        this.entities.forEach(ent => renderer.drawFighter(this.ctx, ent));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.particles.updateAndDraw(this.ctx);
        // console.timeEnd('render');

        if (this.running) requestAnimationFrame(this.loop.bind(this));
    }
}
