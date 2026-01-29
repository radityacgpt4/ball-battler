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
import { battleLogger, trackTowerDamage } from '../systems/BattleLogger.js';

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.entities = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();
        this.combatText = new CombatTextHelper(this.particles);
        this.running = false;

        // Game mode and team selections
        this.gameMode = '1v1'; // '1v1', '2v2', '3v3'
        this.p1Team = ['THUNDER_MAGE']; // Array of fighter types for team 1
        this.p2Team = ['SHIELDBEARER']; // Array of fighter types for team 2

        // Mobile player toggle state (1 = P1, 2 = P2)
        this.selectingPlayer = 1;

        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
        this.arenaBounds = {
            x: 0,
            y: 0,
            width: CONSTANTS.WIDTH,
            height: CONSTANTS.HEIGHT
        };
        this.arenaTimer = 0;
        this.noHitTimer = 0;
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
        this.setupModeSelector();
        this.setupPlayerToggle();
        this.showSelect();
    }

    setupModeSelector() {
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                modeButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                // Update game mode
                this.gameMode = btn.dataset.mode;
                // Reset team selections based on mode
                const teamSize = parseInt(this.gameMode[0]);
                this.p1Team = Array(teamSize).fill('THUNDER_MAGE');
                this.p2Team = Array(teamSize).fill('SHIELDBEARER');
                this.renderCharSelect();
            });
        });
    }

    setupPlayerToggle() {
        const toggleP1 = document.getElementById('toggle-p1');
        const toggleP2 = document.getElementById('toggle-p2');
        if (!toggleP1 || !toggleP2) return;

        toggleP1.addEventListener('click', () => {
            this.selectingPlayer = 1;
            toggleP1.className = 'player-toggle-btn active-p1';
            toggleP2.className = 'player-toggle-btn';
        });
        toggleP2.addEventListener('click', () => {
            this.selectingPlayer = 2;
            toggleP2.className = 'player-toggle-btn active-p2';
            toggleP1.className = 'player-toggle-btn';
        });
    }

    showSelect() {
        this.running = false;
        document.getElementById('char-select').style.display = 'flex';
        document.getElementById('end-screen').style.display = 'none';

        // Default selections if none
        const teamSize = parseInt(this.gameMode[0]);
        if (!this.p1Team || this.p1Team.length === 0) {
            this.p1Team = Array(teamSize).fill('SWORD_MASTER');
        }
        if (!this.p2Team || this.p2Team.length === 0) {
            this.p2Team = Array(teamSize).fill('SNIPER');
        }

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

            // Count how many times this fighter appears in each team
            const p1Count = this.p1Team.filter(t => t === key).length;
            const p2Count = this.p2Team.filter(t => t === key).length;

            // Highlight selections
            if (p1Count > 0 && p2Count > 0) item.classList.add('selected-both');
            else if (p1Count > 0) item.classList.add('selected-p1');
            else if (p2Count > 0) item.classList.add('selected-p2');

            item.innerHTML = `
                <div class="grid-icon" style="background:${data.color}"></div>
                <div class="grid-name">${data.name}</div>
                <div class="select-badges">
                    ${p1Count > 0 ? `<span class="p-badge p1">P1${p1Count > 1 ? 'x' + p1Count : ''}</span>` : ''}
                    ${p2Count > 0 ? `<span class="p-badge p2">P2${p2Count > 1 ? 'x' + p2Count : ''}</span>` : ''}
                </div>
            `;

            // Click handler: on mobile uses toggle, on desktop left=P1 right=P2
            item.onclick = (e) => {
                const isMobile = window.matchMedia('(max-width: 900px)').matches;
                if (isMobile && this.selectingPlayer === 2) {
                    // Mobile P2 selection via toggle
                    let slotIndex = this.p2Team.findIndex((t, i) => t !== key);
                    if (slotIndex === -1) slotIndex = 0;
                    this.p2Team[slotIndex] = key;
                } else {
                    // P1 selection (desktop left-click or mobile P1 toggle)
                    let slotIndex = this.p1Team.findIndex((t, i) => t !== key);
                    if (slotIndex === -1) slotIndex = 0;
                    this.p1Team[slotIndex] = key;
                }
                this.renderCharSelect();
            };

            // Right click: P2 team slots (desktop only)
            item.oncontextmenu = (e) => {
                e.preventDefault();
                let slotIndex = this.p2Team.findIndex((t, i) => t !== key);
                if (slotIndex === -1) slotIndex = 0;
                this.p2Team[slotIndex] = key;
                this.renderCharSelect();
            };

            grid.appendChild(item);
        });

        this.updateDetailPanels();
    }

    updateDetailPanels() {
        // Update Player 1 panel
        const p1Panel = document.getElementById('p1-detail-name');
        const p1Stats = document.getElementById('p1-detail-stats');
        const p1Skills = document.getElementById('p1-detail-skills');

        p1Panel.innerText = `Team 1 (${this.gameMode})`;
        p1Panel.style.color = '#4fc3f7';

        // Show team roster
        p1Stats.innerHTML = this.p1Team.map((type, idx) => {
            const data = FIGHTER_TYPES[type];
            return `<div class="team-member" style="color: ${data.color}">${idx + 1}. ${data.name}</div>`;
        }).join('');

        p1Skills.innerHTML = '<div class="d-skill-desc">Left-click fighters to add to Team 1</div>';

        // Update Player 2 panel
        const p2Panel = document.getElementById('p2-detail-name');
        const p2Stats = document.getElementById('p2-detail-stats');
        const p2Skills = document.getElementById('p2-detail-skills');

        p2Panel.innerText = `Team 2 (${this.gameMode})`;
        p2Panel.style.color = '#ff6b6b';

        // Show team roster
        p2Stats.innerHTML = this.p2Team.map((type, idx) => {
            const data = FIGHTER_TYPES[type];
            return `<div class="team-member" style="color: ${data.color}">${idx + 1}. ${data.name}</div>`;
        }).join('');

        p2Skills.innerHTML = '<div class="d-skill-desc">Right-click fighters to add to Team 2</div>';
    }

    startMatch() {
        audioEngine.init();
        logger.clear();
        logger.log(`MATCH START: ${this.gameMode} - Team 1 vs Team 2`, 'system');

        document.getElementById('char-select').style.display = 'none';

        // Arena size varies by mode
        const arenaSizes = { '1v1': [550, 550], '2v2': [750, 550], '3v3': [850, 550] };
        const [w, h] = arenaSizes[this.gameMode] || [800, 500];
        this.width = w;
        this.height = h;

        // Reset Arena Bounds
        this.arenaBounds = {
            x: 0,
            y: 0,
            width: this.width,
            height: this.height
        };

        this.arenaTimer = 0;
        this.noHitTimer = 0; // Frames since last damage between fighters
        this.timeScale = 1.0;
        this.finishTimer = 0;
        this.isMatchOver = false;
        this.updateCanvasSize();

        this.entities = [];
        this.projectiles = [];
        this.blackholes = [];
        this.particles = new ParticleSystem();
        this.combatText = new CombatTextHelper(this.particles);

        // Spawn Team 1 fighters (left side)
        const teamSize = this.p1Team.length;
        const spacing = teamSize === 1 ? 0 : Math.min(80, 200 / (teamSize - 1));
        const p1StartX = 120;
        const p1StartY = this.height / 2;

        this.p1Team.forEach((type, idx) => {
            const yOffset = (idx - (teamSize - 1) / 2) * spacing;
            const fighter = new Fighter(
                1,
                p1StartX,
                p1StartY + yOffset,
                type,
                FIGHTER_TYPES,
                this
            );
            // Face away from enemies (right side)
            fighter.angle = Math.PI / 2 + Math.random() * Math.PI;
            this.entities.push(fighter);
        });

        // Spawn Team 2 fighters (right side)
        const p2StartX = this.width - 120;
        const p2StartY = this.height / 2;

        this.p2Team.forEach((type, idx) => {
            const yOffset = (idx - (teamSize - 1) / 2) * spacing;
            const fighter = new Fighter(
                2,
                p2StartX,
                p2StartY + yOffset,
                type,
                FIGHTER_TYPES,
                this
            );
            // Face away from enemies (left side)
            fighter.angle = (Math.random() - 0.5) * Math.PI;
            this.entities.push(fighter);
        });

        logger.log(`Team 1: ${this.p1Team.join(', ')}`, 'system');
        logger.log(`Team 2: ${this.p2Team.join(', ')}`, 'system');

        this.createUI();

        this.running = true;
        this.lastFrameTime = performance.now();
        this.frameAccumulator = 0;

        battleLogger.startBattle(this.entities);

        requestAnimationFrame(this.loop.bind(this));
    }

    updateCanvasSize() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        // Sync CSS aspect ratio and max-width so the canvas isn't stretched
        this.canvas.style.setProperty('--canvas-aspect', `${this.width} / ${this.height}`);
        this.canvas.style.setProperty('--canvas-max-width', `${this.width}px`);
    }

    handleArenaShrink() {
        // Timed shrink (every 15 seconds)
        this.arenaTimer++;
        if (this.arenaTimer >= 900) {
            this.arenaTimer = 0;
            this.shrinkArena();
        }

        // No-hit shrink: if no damage dealt for 5 seconds (300 frames), force shrink
        this.noHitTimer++;
        if (this.noHitTimer >= 300) {
            this.noHitTimer = 0;
            this.shrinkArena();
            logger.log('No hits detected — arena shrinks to force engagement!', 'warn');
        }
    }

    /** Called from Fighter.takeDamage to reset the no-hit timer */
    registerHit() {
        this.noHitTimer = 0;
    }

    shrinkArena() {
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

    createUI() {
        const uiHeader = document.getElementById('ui-header');
        uiHeader.innerHTML = '';

        this.entities.forEach((ent, idx) => {
            const div = document.createElement('div');
            div.className = 'hud-card';
            const isRight = ent.id === 2;
            div.style.alignItems = isRight ? 'flex-end' : 'flex-start';

            // Use unique index-based IDs so each fighter gets its own HUD
            const uid = `ent${idx}`;
            const skillsHTML = `
                <div class="skills-container" style="flex-direction: ${isRight ? 'row-reverse' : 'row'}">
                    <div id="${uid}-atk" class="skill-node skill-atk"><div class="skill-progress"></div><div class="skill-inner"><span class="skill-label">ATK</span></div></div>
                    <div id="${uid}-def" class="skill-node skill-def"><div class="skill-progress"></div><div class="skill-inner"><span class="skill-label">DEF</span></div></div>
                    <div id="${uid}-ult" class="skill-node skill-ult"><div class="skill-progress"></div><div class="skill-inner"><span class="skill-label">ULT</span></div></div>
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
        this.entities.forEach((ent, idx) => {
            const uid = `ent${idx}`;
            const updateCircle = (type, current, max, isPassive) => {
                const el = document.getElementById(`${uid}-${type}`);
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

            // 2b. TOWER COLLISION — enemy projectiles can damage Ballista towers
            if (!p.active) continue;
            for (const ent of this.entities) {
                if (!ent.ballistaTowers || ent.ballistaTowers.length === 0) continue;
                // Only enemy projectiles damage towers
                if (p.owner && p.owner.id === ent.id) continue;
                for (const tower of ent.ballistaTowers) {
                    if (tower.hp <= 0) continue;
                    if (Physics.dist(p.x, p.y, tower.x, tower.y) < tower.radius + p.radius) {
                        trackTowerDamage(tower, p.damage, p.owner);
                        this.particles.spawn(tower.x, tower.y, '#8B4513', 4);
                        audioEngine.playHit();
                        if (tower.hp <= 0) {
                            this.particles.spawnExplosion(tower.x, tower.y);
                            logger.log(`${ent.name}'s tower was destroyed!`, 'combat');
                        }
                        if (!p.piercing) {
                            p.active = false;
                            break;
                        }
                    }
                }
                if (!p.active) break;
            }

            // 3. GENERIC ENTITY COLLISION (Standard projectiles)
            if (!p.active) continue;
            for (let ent of this.entities) {
                if (ent === p.owner || ent.isDead) continue;
                // Team check: prevent friendly fire in 2v2/3v3 modes
                if (p.owner && ent.id === p.owner.id) continue;

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

                        // Piercing Check (only applies to piercing projectiles like arrows)
                        // NOTE: Most projectiles (missiles, bullets, etc.) are NOT piercing
                        if (p.piercing) {
                            // Use entity reference for tracking, not ID (which is team ID in team battles)
                            if (p.hitList && p.hitList.includes(ent)) continue;
                            if (!p.hitList) p.hitList = [];
                            p.hitList.push(ent);
                        }

                        // Apply Effects
                        ent.takeDamage(p.damage, p.isUnblockable, false, p.owner);

                        if (p.statusEffect) {
                            ent.applyStatus(p.statusEffect.type, p.statusEffect.duration, p.owner);
                        } else if (p.stunDuration > 0) {
                            ent.applyStatus('STUN', p.stunDuration, p.owner);
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

    resolveTowerCollisions() {
        // Entity vs Tower — towers are immobile solid obstacles
        for (const ent of this.entities) {
            if (ent.isDead) continue;
            // Check all fighters' towers
            for (const owner of this.entities) {
                if (!owner.ballistaTowers) continue;
                for (const tower of owner.ballistaTowers) {
                    if (tower.hp <= 0) continue;
                    const dist = Physics.dist(ent.x, ent.y, tower.x, tower.y);
                    const minDist = ent.radius + tower.radius;
                    if (dist < minDist && dist > 0.001) {
                        // Push entity out (tower is immobile)
                        const nx = (ent.x - tower.x) / dist;
                        const ny = (ent.y - tower.y) / dist;
                        const overlap = minDist - dist + 1;
                        ent.x += nx * overlap;
                        ent.y += ny * overlap;

                        // Bounce entity velocity off the tower
                        const dot = ent.dx * nx + ent.dy * ny;
                        if (dot < 0) {
                            ent.dx -= 2 * dot * nx;
                            ent.dy -= 2 * dot * ny;
                            // Dampen slightly
                            ent.dx *= 0.8;
                            ent.dy *= 0.8;
                        }
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
                const team1Alive = this.entities.filter(e => !e.isDead && e.id === 1);
                const team2Alive = this.entities.filter(e => !e.isDead && e.id === 2);
                const overlay = document.getElementById('end-screen');
                const msg = document.getElementById('win-msg');

                // Finalize battle logging
                const winLabel = (team1Alive.length === 0 && team2Alive.length === 0) ? 'Draw'
                    : team1Alive.length > 0 ? 'Team 1' : 'Team 2';
                battleLogger.endBattle(winLabel, this.entities);

                // Update export badge
                const badge = document.getElementById('battle-count-badge');
                if (badge) badge.textContent = `${battleLogger.getBattleCount()} battle(s) recorded`;

                overlay.style.display = 'flex';

                if (team1Alive.length === 0 && team2Alive.length === 0) {
                    msg.innerText = "DRAW";
                    msg.style.color = "white";
                    logger.log("MATCH END: DRAW", 'system');
                } else if (team1Alive.length > 0) {
                    msg.innerText = `TEAM 1 WINS!`;
                    msg.style.color = '#4fc3f7';
                    logger.log(`MATCH END: TEAM 1 WINS! (${team1Alive.length} survivors)`, 'system');
                } else {
                    msg.innerText = `TEAM 2 WINS!`;
                    msg.style.color = '#ff6b6b';
                    logger.log(`MATCH END: TEAM 2 WINS! (${team2Alive.length} survivors)`, 'system');
                }
            }
            return;
        }

        // Check if entire team is eliminated
        const team1Alive = this.entities.filter(e => !e.isDead && e.id === 1);
        const team2Alive = this.entities.filter(e => !e.isDead && e.id === 2);

        if (team1Alive.length === 0 || team2Alive.length === 0) {
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
            this.resolveTowerCollisions();
            // console.timeEnd('collisions');

            this.projectiles.forEach(p => p.update(this.timeScale));

            // Update blackholes (Frieren ULT)
            updateBlackholes(this, this.timeScale);

            battleLogger.recordInterval(this.entities);
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
