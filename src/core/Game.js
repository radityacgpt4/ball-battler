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
        this.particles = new ParticleSystem();
        this.combatText = new CombatTextHelper(this.particles);

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

            // Ginto Trap (Quincy)
            if (p.isGintoTrap) {
                for (let ent of this.entities) {
                    if (ent === p.owner || ent.isDead) continue;
                    if (Physics.dist(p.x, p.y, ent.x, ent.y) < ent.radius + p.radius) {
                        // Trigger Ginto - stun the enemy
                        if (p.stunDuration > 0) ent.applyStatus('STUN', p.stunDuration);

                        this.particles.spawnHirenkyaku(p.x, p.y);
                        audioEngine.playZap();
                        logger.log(`${ent.name} stepped on ${p.owner.name}'s GINTO TRAP!`, 'combat');

                        p.active = false;
                        break;
                    }
                }
                continue;
            }

            if (!p.isGrenade && !p.isFugaArrow && !p.isGroundBurn && !p.isWorldSlash) {
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
                            } else if (p.isQuincyArrow) {
                                // Quincy arrows - piercing if perfect shot or Licht Regen
                                if (p.piercing) {
                                    if (!p.hitList.includes(ent.id)) {
                                        ent.takeDamage(p.damage, false, false, p.owner);
                                        p.hitList.push(ent.id);
                                        this.particles.spawnQuincyArrow(ent.x, ent.y);
                                        audioEngine.playZap();
                                    }
                                } else {
                                    ent.takeDamage(p.damage, false, false, p.owner);
                                    this.particles.spawnQuincyArrow(ent.x, ent.y);
                                    audioEngine.playZap();
                                    p.active = false;
                                }
                            } else if (p.isBallistaBolt) {
                                // Ballista bolt - damage and knockback
                                ent.takeDamage(p.damage, false, false, p.owner);
                                this.particles.spawn(ent.x, ent.y, '#8B4513', 5);
                                audioEngine.playHit();

                                // Only knockback if not already being knocked back
                                if (!ent.pendingBallistaPinned && !p.dragTarget) {
                                    // Apply knockback velocity in bolt direction (Force / Mass)
                                    const knockbackForce = 12;
                                    const speed = knockbackForce / ent.mass;
                                    ent.dx = Math.cos(p.angle) * speed;
                                    ent.dy = Math.sin(p.angle) * speed;

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
                            } else if (p.isZoltraak) {
                                ent.takeDamage(p.damage, p.isUnblockable, false, p.owner);
                                this.particles.spawnZoltraakImpact(ent.x, ent.y);
                                audioEngine.playHit();
                                p.active = false;
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

                        if (!p.isKunai && !(p.isQuincyArrow && p.piercing)) {
                            if (!p.isUnblockable && ent.isBlockedByShield(p.x, p.y, p.damage)) break;
                            if (!p.piercing) break;
                        }
                    }
                }
            }




            if (p.isWorldSlash && p.active) {
                // Deflect enemy projectiles
                for (let j = this.projectiles.length - 1; j >= 0; j--) {
                    const other = this.projectiles[j];
                    if (other === p || !other.active) continue;
                    if (other.owner === p.owner) continue; // Don't deflect own projectiles
                    if (other.isGroundBurn) continue; // Don't deflect ground burns

                    if (Physics.dist(p.x, p.y, other.x, other.y) < (p.radius || 40) + (other.radius || 4)) {
                        // Deflect the projectile
                        other.owner = p.owner;
                        other.hitList = [];

                        // Reverse and redirect
                        const speed = Math.hypot(other.dx, other.dy);
                        other.dx = Math.cos(p.angle) * speed * 1.2;
                        other.dy = Math.sin(p.angle) * speed * 1.2;
                        other.angle = p.angle;

                        other.isDeflected = true;
                        other.deflectLifetime = 180;

                        // Visual effect
                        this.particles.spawn(other.x, other.y, '#DC143C', 6);
                        audioEngine.playBlock();
                        logger.log(`World Cutting Slash DEFLECTED projectile!`, 'combat');
                    }
                }

                // Hit entities
                for (let ent of this.entities) {
                    if (ent === p.owner || ent.isDead) continue;
                    // Wide hitbox check
                    if (Physics.dist(p.x, p.y, ent.x, ent.y) < (p.radius || 40) + ent.radius) {
                        // Drag Logic
                        if (p.dragTarget) {
                            // Pull entity towards projectile center + forward motion
                            ent.dx = p.dx * (p.dragStrength || 0.3) + (p.x - ent.x) * 0.1;
                            ent.dy = p.dy * (p.dragStrength || 0.3) + (p.y - ent.y) * 0.1;
                        }

                        // Damage once per enemy
                        if (!p.hitList) p.hitList = [];
                        if (!p.hitList.includes(ent.id)) {
                            ent.takeDamage(p.damage, true, false, p.owner); // Unblockable
                            p.hitList.push(ent.id);
                            this.particles.spawnSlash(ent.x, ent.y, ent.x + (Math.random() - 0.5) * 20, ent.y + (Math.random() - 0.5) * 20, '#DC143C', 30);
                            audioEngine.playSlash();
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
                    // Static passive (Volt's zap on contact)
                    if (e1.skills.def.type === 'STATIC_PASSIVE' && e2.status.stun <= 0) {
                        const dmg = e1.skills.def.damage || 5;
                        e2.takeDamage(dmg, false, false, e1);
                        e2.applyStatus('STUN');

                        // Visuals
                        this.particles.spawnBolt([{ x: e1.x, y: e1.y }, { x: e2.x, y: e2.y }], '#00FFFF', 4);
                        this.particles.spawn(e2.x, e2.y, '#00FFFF', 8);

                        audioEngine.playZap();
                        logger.log(`${e1.name} STATIC PASSIVE zapped ${e2.name} for ${dmg} dmg!`, 'combat');
                    }
                    if (e2.skills.def.type === 'STATIC_PASSIVE' && e1.status.stun <= 0) {
                        const dmg = e2.skills.def.damage || 5;
                        e1.takeDamage(dmg, false, false, e2);
                        e1.applyStatus('STUN');

                        // Visuals
                        this.particles.spawnBolt([{ x: e2.x, y: e2.y }, { x: e1.x, y: e1.y }], '#00FFFF', 4);
                        this.particles.spawn(e1.x, e1.y, '#00FFFF', 8);

                        audioEngine.playZap();
                        logger.log(`${e2.name} STATIC PASSIVE zapped ${e1.name} for ${dmg} dmg!`, 'combat');
                    }

                    // SHIELDBEARER: Momentum Collision
                    const handleMomentumHit = (attacker, defender) => {
                        if (attacker.typeKey !== 'SHIELDBEARER') return false;

                        if (defender.collisionImmunity > 0) return false;

                        const config = attacker.skills.atk;
                        const speedTier = Math.floor((attacker.wallBounceSpeed - attacker.baseSpeed) / config.speedGain);

                        if (speedTier <= 0 && !attacker.ultWallSlamActive) return false;

                        // Calculate potential damage for shield check
                        let damage = speedTier * config.damagePerTier;
                        if (attacker.ultWallSlamActive) damage = Math.max(damage, 10);

                        if (defender.isBlockedByShield(attacker.x, attacker.y, damage)) {
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

                        // Damage already calculated above
                        defender.takeDamage(damage, false, false, attacker);
                        this.particles.spawn(defender.x, defender.y, '#8b5cf6', 8);
                        logger.log(`${attacker.name} SLAMMED ${defender.name} for ${damage} dmg (SpeedTier: ${speedTier})`, 'combat');
                        audioEngine.playHeavyImpact();

                        if (attacker.ultWallSlamActive) {
                            defender.pendingWallSlam = { owner: attacker };
                            for (let i = 0; i < 10; i++) {
                                this.particles.spawn(defender.x, defender.y, '#ff4444', 1);
                            }
                        }

                        attacker.wallBounceSpeed = attacker.baseSpeed;

                        for (let k = 0; k < 15; k++) {
                            this.particles.spawn(defender.x, defender.y, '#8b5cf6', 1);
                        }

                        // We used to return 'true' to skip physics and set velocity manually.
                        // Now we return 'false' so the standard elastic collision (bump) happens below,
                        // which naturally handles mass-based knockback.
                        return false;
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

            // Draw Hex Barrier if fighter has it
            if (ent.abilities && ent.abilities.def && ent.abilities.def.draw) {
                ent.abilities.def.draw(ent, this.ctx);
            }
        });
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.particles.updateAndDraw(this.ctx);
        // console.timeEnd('render');

        if (this.running) requestAnimationFrame(this.loop.bind(this));
    }
}
