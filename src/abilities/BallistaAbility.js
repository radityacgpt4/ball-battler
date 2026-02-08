/**
 * Ballista Abilities
 *
 * ATK: Heavy Bolt - Piercing bolts that pin enemies
 * DEF: Gate Barrier - Protective barriers on sides
 * ULT: Siege Mode - Enhanced volleys
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';
import { BallistaBoltRenderer, TowerBoltRenderer } from '../components/ProjectileRenderers.js';
import { LinearMovement, DragBehavior, BallistaBehavior } from '../components/ProjectileBehaviors.js';

export class BallistaAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.damage = config.damage || 15;
        this.projectileSpeed = config.projectileSpeed || 16;
        this.spreadAngle = config.spreadAngle || 0.15;
        this.boltRadius = config.boltRadius || 8;
        this.dragDuration = config.dragDuration || 25;
        this.normalBoltCount = config.normalBoltCount || 2;
    }

    update(fighter, context) {
        if (fighter.status.stun > 0) return;

        const { game } = context;

        if (fighter.cooldowns.atk <= 0) {
            fighter.cooldowns.atk = this.cooldown;

            const angles = [];
            for (let i = 0; i < this.normalBoltCount; i++) {
                const t = this.normalBoltCount === 1 ? 0 : (i / (this.normalBoltCount - 1) - 0.5);
                angles.push(fighter.angle + t * this.spreadAngle);
            }

            angles.forEach((angle) => {
                const p = new Projectile(
                    fighter,
                    fighter.x + Math.cos(angle) * 30,
                    fighter.y + Math.sin(angle) * 30,
                    angle,
                    this.projectileSpeed,
                    this.damage,
                    game
                );

                p.isBallistaBolt = true;
                p.radius = this.boltRadius;
                p.dragTarget = null;
                p.dragDuration = this.dragDuration;

                p.renderer = new BallistaBoltRenderer();
                p.addComponent(new LinearMovement());
                p.addComponent(new BallistaBehavior());
                p.addComponent(new DragBehavior());

                game.projectiles.push(p);
            });

            game.particles.spawn(fighter.x + Math.cos(fighter.angle) * 30, fighter.y + Math.sin(fighter.angle) * 30, '#8B4513', 4);
            audioEngine.playGunshot();
        }
    }
}

export class BallistaDefAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.barrierMaxHp = config.barrierMaxHp || 30;
        this.barrierCount = config.barrierCount || 4;
        this.arcAngle = config.arcAngle || 1.22;
        this.shieldRadius = config.shieldRadius || 8;

        this.initialized = false;
    }

    update(fighter, context) {
        if (!this.initialized) {
            fighter.ballistaBarriers = [];

            // Create barriers evenly spaced around sides
            const angles = [];
            for (let i = 0; i < this.barrierCount; i++) {
                angles.push(Math.PI / 2 - (Math.PI / (this.barrierCount - 1 || 1)) * i);
            }

            for (const angle of angles) {
                fighter.ballistaBarriers.push({
                    hp: this.barrierMaxHp,
                    maxHp: this.barrierMaxHp,
                    angle: angle,
                    destroyed: false
                });
            }
            this.initialized = true;
        }
    }

    getBarrierIndex(localAngle) {
        if (!this.initialized) return -1;

        localAngle = Physics.normalizeAngle(localAngle);

        const halfArc = this.arcAngle / 2;
        const barrierAngles = [];
        for (let i = 0; i < this.barrierCount; i++) {
            barrierAngles.push(Math.PI / 2 - (Math.PI / (this.barrierCount - 1 || 1)) * i);
        }

        for (let i = 0; i < barrierAngles.length; i++) {
            const diff = Physics.normalizeAngle(localAngle - barrierAngles[i]);
            if (Math.abs(diff) < halfArc) {
                return i;
            }
        }

        return -1;
    }

    damageBarrier(fighter, barrier, amount) {
        barrier.hp -= amount;

        const game = fighter.game;
        const barrierWorldAngle = fighter.angle + barrier.angle;
        const effectX = fighter.x + Math.cos(barrierWorldAngle) * (fighter.radius + 15);
        const effectY = fighter.y + Math.sin(barrierWorldAngle) * (fighter.radius + 15);

        game.particles.spawn(effectX, effectY, '#D2691E', 4);

        if (barrier.hp <= 0 && !barrier.destroyed) {
            barrier.destroyed = true;
            barrier.hp = 0;

            game.combatText.shieldBreak(effectX, effectY, this.getSideName(barrier.angle));
            game.particles.spawnExplosion(effectX, effectY);
            audioEngine.playExplosion();
            logger.log(`${fighter.name} Barrier (${this.getSideName(barrier.angle)}) BROKEN!`, 'error');
        }
    }

    getSideName(angle) {
        angle = Physics.normalizeAngle(angle);
        if (Math.abs(angle) < 0.1) return "FRONT";
        if (Math.abs(angle - Math.PI / 2) < 0.1) return "RIGHT";
        if (Math.abs(angle + Math.PI / 2) < 0.1) return "LEFT";
        return "BACK";
    }

    getShieldHit(fighter, rayX, rayY, dirX, dirY) {
        if (!fighter.ballistaBarriers) return null;

        const shieldRadius = fighter.radius + this.shieldRadius;
        const hit = Physics.rayCircleIntersect(rayX, rayY, dirX, dirY, fighter.x, fighter.y, shieldRadius);
        if (!hit) return null;

        const hitAngle = Math.atan2(hit.y - fighter.y, hit.x - fighter.x);
        const localAngle = Physics.normalizeAngle(hitAngle - fighter.angle);

        const index = this.getBarrierIndex(localAngle);
        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                return {
                    x: hit.x,
                    y: hit.y,
                    dist: hit.dist,
                    nx: Math.cos(hitAngle),
                    ny: Math.sin(hitAngle)
                };
            }
        }
        return null;
    }

    isBlocked(fighter, attackerX, attackerY, damage = 0) {
        if (!fighter.ballistaBarriers) return false;

        const angleToAttacker = Math.atan2(attackerY - fighter.y, attackerX - fighter.x);
        const localAngle = Physics.normalizeAngle(angleToAttacker - fighter.angle);

        const index = this.getBarrierIndex(localAngle);
        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                if (damage > 0) {
                    this.damageBarrier(fighter, barrier, damage);
                }
                return true;
            }
        }
        return false;
    }

    onDamage(fighter, amount, context) {
        const { isDoT, attacker } = context;

        if (isDoT) return amount;
        if (!attacker) return amount;
        if (!fighter.ballistaBarriers) return amount;

        const angleToAttacker = Math.atan2(attacker.y - fighter.y, attacker.x - fighter.x);
        const localAngle = Physics.normalizeAngle(angleToAttacker - fighter.angle);

        const index = this.getBarrierIndex(localAngle);

        if (index !== -1) {
            const barrier = fighter.ballistaBarriers[index];
            if (!barrier.destroyed) {
                const absorbed = Math.min(barrier.hp, amount);
                this.damageBarrier(fighter, barrier, absorbed);

                amount -= absorbed;

                logger.log(`${fighter.name} Barrier absorbed ${Math.ceil(absorbed)} dmg (Remaining: ${Math.ceil(amount)})`, 'combat');

                if (amount <= 0) return false;
            }
        }

        return amount;
    }

    draw(fighter, ctx) {
        if (!fighter.ballistaBarriers) return;

        const barrierDist = fighter.radius + 3; // Closer to body like Shieldbearer
        const arcAngle = 1.22;
        const halfArc = arcAngle / 2;

        for (const barrier of fighter.ballistaBarriers) {
            if (barrier.destroyed) continue;

            const hpRatio = barrier.hp / barrier.maxHp;
            const adjustedAngle = barrier.angle + fighter.angle;

            if (hpRatio < 1.0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = hpRatio > 0.5 ? '#DAA520' : '#FF0000';
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.3 * (1 - hpRatio);
                ctx.beginPath();
                ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
                ctx.stroke();
                ctx.restore();
            }

            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
            ctx.lineWidth = 12;
            ctx.strokeStyle = `rgba(210, 180, 140, ${0.6 + hpRatio * 0.4})`;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#8B4513';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, barrierDist + 7, adjustedAngle - halfArc * 0.85, adjustedAngle + halfArc * 0.85);
            ctx.lineWidth = 2;
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
            ctx.restore();
        }
    }
}

export class BallistaUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.spawnInterval = config.spawnInterval || 120;
        this.maxTowers = config.maxTowers || 3;
        this.towerHp = config.towerHp || 20;
        this.towerLifetime = config.towerLifetime || 240;
        this.towerFireRate = config.towerFireRate || 60;
        this.towerRotationSpeed = config.towerRotationSpeed || 0.04;
        this.towerBoltDamage = config.towerBoltDamage || 8;
        this.towerBoltSpeed = config.towerBoltSpeed || 10;
        this.towerRadius = config.towerRadius || 15;

        this.spawnTimer = 0;
    }

    execute(fighter, context) {
        // No-op: towers spawn passively via update once ULT is available
    }

    canUse() {
        // Disable the default execute trigger — tower spawning is handled in update()
        return false;
    }

    update(fighter, context) {
        const { game } = context;

        if (!fighter.ballistaTowers) fighter.ballistaTowers = [];

        // Clean up all towers if owner is dead
        if (fighter.isDead) {
            fighter.ballistaTowers.forEach(t => game.particles.spawn(t.x, t.y, '#8B4513', 5));
            fighter.ballistaTowers = [];
            return;
        }

        // Clean up dead/expired towers
        fighter.ballistaTowers = fighter.ballistaTowers.filter(t => t.hp > 0 && t.timer > 0);

        // Spawn timer — towers drop passively every spawnInterval frames once HP <= 50%
        const ultAvailable = fighter.hp <= fighter.maxHp * 0.5;
        if (ultAvailable) {
            this.spawnTimer += (context.timeScale || 1);

            // Sync cooldown UI to show spawn progress
            fighter.maxCooldowns.ult = this.spawnInterval;
            fighter.cooldowns.ult = Math.max(0, this.spawnInterval - this.spawnTimer);

            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0;
                this.spawnTower(fighter, game);
            }
        }

        // Update all active towers
        for (const tower of fighter.ballistaTowers) {
            tower.timer -= (context.timeScale || 1);
            tower.angle += tower.rotationSpeed * (context.timeScale || 1);
            tower.fireTimer -= (context.timeScale || 1);

            // Fire bolt
            if (tower.fireTimer <= 0) {
                tower.fireTimer = this.towerFireRate;
                this.fireTowerBolt(tower, game);
            }
        }
    }

    spawnTower(fighter, game) {
        // Enforce max tower cap — remove oldest if at limit
        while (fighter.ballistaTowers.length >= this.maxTowers) {
            const oldest = fighter.ballistaTowers.shift();
            // Despawn particle
            game.particles.spawn(oldest.x, oldest.y, '#8B4513', 5);
        }

        const tower = {
            x: fighter.x,
            y: fighter.y,
            hp: this.towerHp,
            maxHp: this.towerHp,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: this.towerRotationSpeed,
            timer: this.towerLifetime,
            fireTimer: this.towerFireRate,
            owner: fighter,
            id: fighter.id, // Same team
            radius: this.towerRadius
        };

        fighter.ballistaTowers.push(tower);

        // Spawn visual feedback
        game.particles.spawn(tower.x, tower.y, '#8B4513', 8);
        audioEngine.playHeavyImpact();
        logger.log(`${fighter.name} deployed a Defensive Tower!`, 'info');
    }

    fireTowerBolt(tower, game) {
        const p = new Projectile(
            tower.owner,
            tower.x + Math.cos(tower.angle) * (tower.radius + 5),
            tower.y + Math.sin(tower.angle) * (tower.radius + 5),
            tower.angle,
            this.towerBoltSpeed,
            this.towerBoltDamage,
            game
        );

        p.isBallistaBolt = true;
        p.radius = 4;
        p.dragTarget = null;
        p.dragDuration = 20;
        p.impactSound = 'hit';
        p.renderer = new TowerBoltRenderer();
        p.addComponent(new LinearMovement());
        p.addComponent(new BallistaBehavior());
        p.addComponent(new DragBehavior());

        game.projectiles.push(p);
    }

    draw(fighter, ctx) {
        if (!fighter.ballistaTowers) return;

        for (const tower of fighter.ballistaTowers) {
            // Renderer calls draw() with ctx translated to fighter position,
            // so offset back to get absolute tower coordinates
            const dx = tower.x - fighter.x;
            const dy = tower.y - fighter.y;

            // Tower body — dark brown circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(dx, dy, tower.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#5C3A1E';
            ctx.fill();
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Aiming direction indicator
            const tipX = dx + Math.cos(tower.angle) * (tower.radius + 6);
            const tipY = dy + Math.sin(tower.angle) * (tower.radius + 6);
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(tipX, tipY);
            ctx.strokeStyle = '#D2691E';
            ctx.lineWidth = 3;
            ctx.stroke();

            // HP bar
            const barW = tower.radius * 2;
            const barH = 3;
            const barX = dx - barW / 2;
            const barY = dy - tower.radius - 8;
            const hpRatio = tower.hp / tower.maxHp;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.25 ? '#FF9800' : '#F44336';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);

            ctx.restore();
        }
    }
}
