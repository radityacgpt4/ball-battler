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
import { updateBlackholes } from '../abilities/FrierenAbility.js';

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();
        this.combatText = new CombatTextHelper(this.particles);
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
                <div class="select-badges">
                    ${this.p1Type === key ? '<span class="p-badge p1">P1</span>' : ''}
                    ${this.p2Type === key ? '<span class="p-badge p2">P2</span>' : ''}
                </div>
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
        this.blackholes = [];
        this.particles = new ParticleSystem();
        this.combatText = new CombatTextHelper(this.particles);

        const f1 = new Fighter(1, 100, 250, this.p1Type, FIGHTER_TYPES, this);
        const f2 = new Fighter(2, 400, 250, this.p2Type, FIGHTER_TYPES, this);

        // Randomize starting angles with "Anti-Facing" logic to prevent early shot advantage.
        // F1 is on the left (x=100), facing right (0 rad) would hit F2.
        // We force F1 to face AWAY from F2 (between PI/2 and 3PI/2).
        f1.angle = Math.PI / 2 + Math.random() * Math.PI;

        // F2 is on the right (x=400), facing left (PI rad) would hit F1.
        // We force F2 to face AWAY from F1 (between -PI/2 and PI/2).
        f2.angle = (Math.random() - 0.5) * Math.PI;

        this.entities.push(f1);
        this.entities.push(f2);

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

            // 1. LIFECYCLE CHECK
            if (!p.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // 2. SELF-MANAGED COLLISION CHECK
            // Behaviors can opt-out of generic collision (e.g. WorldSlash, Grenade mid-air)
            // They handle hit detection inside their update() component.
            if (p.handlesOwnCollision) continue;

            // 3. GENERIC ENTITY COLLISION (Standard projectiles)
            for (let ent of this.entities) {
                if (ent === p.owner || ent.isDead) continue;

                // Z-Axis Check
                if (p.z !== undefined && p.z > (ent.height || 40)) continue;

                // Hit Detection
                if (Physics.dist(p.x, p.y, ent.x, ent.y) < ent.radius + p.radius) {

                    // 4. SHIELD BLOCK LOGIC
                    if (!p.isUnblockable && ent.isBlockedByShield(p.x, p.y, p.damage)) {
                        // Deflection Implementation
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

                        p.deflectLifetime = 120;
                        p.isDeflected = true;

                        // Reset specialized props
                        if (p.isKunai) p.maxDist = p.travelled + 300;
                        if (p.isMissile) { p.target = null; p.isMissile = false; }

                        this.particles.spawn(p.x, p.y, '#8b5cf6', 10);
                        audioEngine.playBlock();
                        logger.log(`${ent.name} DEFLECTED projectile from ${p.owner.name}`, 'warn');
                    } else {
                        // 5. IMPACT

                        // A) Trigger Component onImpact
                        p.triggerImpact(ent);

                        // B) Check if Component Handled Everything
                        if (p.hasHandledImpact) {
                            p.hasHandledImpact = false; // Reset for next target if piercing
                            if (!p.active) break; // Terminate if destroyed
                            continue; // Skip generic fallback if handled
                        }

                        // C) GENERIC FALLBACK (Unified Hit Handler)
                        // This handles simple projectiles without custom behaviors
                        if (!p.active) break; // If destroyed by something else

                        // Piercing Check
                        if (p.piercing) {
                            if (p.hitList && p.hitList.includes(ent.id)) continue;
                            if (!p.hitList) p.hitList = [];
                            p.hitList.push(ent.id);
                        }

                        // Apply Effects
                        ent.takeDamage(p.damage, p.isUnblockable, false, p.owner);

                        if (p.statusEffect) {
                            ent.applyStatus(p.statusEffect.type, p.statusEffect.duration);
                        } else if (p.stunDuration > 0) {
                            ent.applyStatus('STUN', p.stunDuration);
                        }

                        audioEngine.play(p.impactSound);

                        if (p.impactParticle) {
                            this.particles.spawnEffect(p.impactParticle, ent.x, ent.y);
                        }

                        // Destroy non-piercing
                        if (!p.piercing) {
                            p.active = false;
                            break;
                        }
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
                    const context = { game: this };
                    let hit1 = false;
                    let hit2 = false;

                    // OCP: Let abilities handle special collision effects
                    Object.values(e1.abilities).forEach(ability => {
                        if (ability && ability.onEntityCollision) {
                            const result = ability.onEntityCollision(e1, e2, context);
                            if (result === true) hit1 = true;
                        }
                    });

                    Object.values(e2.abilities).forEach(ability => {
                        if (ability && ability.onEntityCollision) {
                            const result = ability.onEntityCollision(e2, e1, context);
                            if (result === true) hit2 = true;
                        }
                    });

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
                        let nx, ny;
                        if (dist < 0.001) {
                            // Handle overlap/NaN prevention
                            nx = 1; ny = 0;
                        } else {
                            nx = (e2.x - e1.x) / dist;
                            ny = (e2.y - e1.y) / dist;
                        }

                        let p = 2 * (e1.dx * nx + e1.dy * ny - e2.dx * nx - e2.dy * ny) / (m1 + m2);
                        e1.dx -= p * m2 * nx;
                        e1.dy -= p * m2 * ny;
                        e2.dx += p * m1 * nx;
                        e2.dy += p * m1 * ny;
                        audioEngine.playHit();

                        // Safety Clamp to prevent physics explosions from impulse
                        const MAX_PHYSICS_SPEED = 25;
                        const clamp = (e) => {
                            const s = Math.hypot(e.dx, e.dy);
                            if (s > MAX_PHYSICS_SPEED) {
                                e.dx = (e.dx / s) * MAX_PHYSICS_SPEED;
                                e.dy = (e.dy / s) * MAX_PHYSICS_SPEED;
                            }
                        };
                        clamp(e1);
                        clamp(e2);
                    }
                }
            }
        }
    }

    checkWinCondition() {
        if (this.isMatchOver) {
            this.finishTimer++;
            // Wait 120 frames (approx 2s at 60fps, but effectively longer due to timescale)
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

            // Update blackholes (Frieren ULT)
            updateBlackholes(this, this.timeScale);

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

        // Draw blackholes (behind entities)
        if (this.blackholes && this.blackholes.length > 0) {
            for (const hole of this.blackholes) {
                this.ctx.save();
                this.ctx.translate(hole.x, hole.y);

                // Outer gravitational lensing effect
                const gradient = this.ctx.createRadialGradient(0, 0, hole.coreRadius || 0, 0, 0, hole.radius);
                gradient.addColorStop(0, 'rgba(75, 0, 130, 0.8)');
                gradient.addColorStop(0.3, 'rgba(128, 0, 255, 0.3)');
                gradient.addColorStop(0.7, 'rgba(200, 100, 255, 0.1)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, hole.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Accretion disk
                this.ctx.rotate(hole.rotation || 0);
                this.ctx.strokeStyle = '#ffab00';
                this.ctx.lineWidth = 2;
                this.ctx.globalAlpha = 0.6;

                for (let i = 0; i < 3; i++) {
                    const spiralAngle = (hole.rotation || 0) * 2 + (Math.PI * 2 / 3) * i;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, (hole.coreRadius || 0) + 5 + i * 8, spiralAngle, spiralAngle + 0.8);
                    this.ctx.stroke();
                }

                // Event horizon (black core)
                this.ctx.globalAlpha = 1;
                this.ctx.fillStyle = '#000000';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, hole.coreRadius || 0, 0, Math.PI * 2);
                this.ctx.fill();

                // Core glow edge
                this.ctx.strokeStyle = '#4a0080';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, hole.coreRadius || 0, 0, Math.PI * 2);
                this.ctx.stroke();

                this.ctx.restore();
            }
        }

        this.entities.forEach(ent => {
            renderer.drawFighter(this.ctx, ent);
            // NOTE: Ability visuals (barriers, etc.) are already drawn via
            // renderer.drawAbilityVisuals() inside drawFighter() with proper context
        });
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.particles.updateAndDraw(this.ctx);
        // console.timeEnd('render');

        if (this.running) requestAnimationFrame(this.loop.bind(this));
    }
}
