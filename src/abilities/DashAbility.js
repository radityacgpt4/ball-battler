/**
 * Dash Abilities
 *
 * Dash Assault, Retreat, Flash Barrage
 *
 * ALL configurable properties are now loaded from fighters.js
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';
import { logger } from '../systems/Logger.js';

export class DashAssaultAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.damage = config.damage || 7;
        this.dashDistance = config.dashDistance || 400;
        this.dashTimer = config.dashTimer || 15;
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        fighter.isDashing = true;
        fighter.dashTimer = this.dashTimer;

        const target = enemies.find(e => e !== fighter && !e.isDead);
        let aimAngle = fighter.angle;
        if (target) aimAngle = Math.atan2(target.y - fighter.y, target.x - fighter.x);

        fighter.angle = aimAngle;
        const dist = this.dashDistance;
        const destX = fighter.x + Math.cos(aimAngle) * dist;
        const destY = fighter.y + Math.sin(aimAngle) * dist;

        game.particles.spawnSlash(fighter.x, fighter.y, destX, destY, '#ff0000');
        audioEngine.playSwordSwing();

        if (target && Physics.lineCircleIntersect(fighter.x, fighter.y, destX, destY, target.x, target.y, target.radius + 15)) {
            target.takeDamage(this.damage, false, false, fighter);
            target.applyStatus('BLEED');
            audioEngine.playHit();
            logger.log(`${fighter.name} Dash Assault HIT ${target.name}!`, 'combat');
        }

        fighter.x = Math.max(fighter.radius, Math.min(game.width - fighter.radius, destX));
        fighter.y = Math.max(fighter.radius, Math.min(game.height - fighter.radius, destY));

        fighter.cooldowns.ult = this.cooldown;
    }
}

export class RetreatAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        // All values from config (fighters.js)
        this.range = config.range || 150;
        this.dashSpeed = config.dashSpeed || 8;
        this.dashTimer = config.dashTimer || 20;
    }

    canUse(fighter, context) {
        if (!super.canUse(fighter, context)) return false;

        const { enemies } = context;
        const enemy = enemies.find(e => e !== fighter && !e.isDead);
        if (!enemy) return false;

        return Physics.dist(fighter.x, fighter.y, enemy.x, enemy.y) < this.range;
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        const enemy = enemies.find(e => e !== fighter && !e.isDead);
        if (!enemy) return;

        fighter.isDashing = true;
        fighter.dashTimer = this.dashTimer;

        const angle = Math.atan2(fighter.y - enemy.y, fighter.x - enemy.x);
        fighter.dx = Math.cos(angle) * this.dashSpeed;
        fighter.dy = Math.sin(angle) * this.dashSpeed;

        // Force aim to enemy
        fighter.angle = Math.atan2(enemy.y - fighter.y, enemy.x - fighter.x);

        game.particles.spawn(fighter.x, fighter.y, '#54a0ff', 5);
        logger.log(`${fighter.name} used Retreat!`, 'info');
        fighter.cooldowns.def = this.cooldown;
        audioEngine.playSwordSwing();
    }

    update(fighter, context) {
        if (this.canUse(fighter, context)) {
            this.execute(fighter, context);
        }
    }
}

export class FlashBarrageAbility extends Ability {
    constructor(config, slot, kunaiConfig, ProjectileClass) {
        super(config, slot);
        this.kunaiConfig = kunaiConfig;
        this.ProjectileClass = ProjectileClass;
        // All values from config (fighters.js)
        this.rasenganDamage = config.rasenganDamage || 12;
        this.kunaiCount = config.kunaiCount || 2;
        this.kunaiSpeed = config.kunaiSpeed || 9;
        this.maxDistBase = config.maxDistBase || 350;
        this.maxDistRatio = config.maxDistRatio || 0.4;
    }

    execute(fighter, context) {
        const { game } = context;
        const Projectile = this.ProjectileClass;
        const count = this.kunaiCount;

        fighter.cooldowns.ult = this.cooldown;
        fighter.cooldowns.atk = Math.max(fighter.cooldowns.atk, this.kunaiConfig.delay + 10);

        fighter.teleportDelayTimer = this.kunaiConfig.delay;
        fighter.kunaiPending = [];

        fighter.pendingRasengan = this.rasenganDamage;

        const bounds = game.arenaBounds;
        const arenaDiagonal = Math.hypot(bounds.width, bounds.height);
        const maxAllowedDist = arenaDiagonal * this.maxDistRatio;
        const maxDist = Math.min(this.maxDistBase, maxAllowedDist);

        for (let i = 0; i < count; i++) {
            const throwAngle = fighter.angle + ((Math.PI * 2) / count) * i;
            const speed = this.kunaiSpeed;

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(throwAngle) * 20,
                fighter.y + Math.sin(throwAngle) * 20,
                throwAngle,
                speed,
                this.kunaiConfig.damage,
                game
            );

            p.isKunai = true;
            p.isUlt = true;
            p.radius = 6;
            p.maxDist = maxDist;

            game.projectiles.push(p);
            fighter.kunaiPending.push(p);
            audioEngine.playKunaiThrow();
        }

        game.particles.spawn(fighter.x, fighter.y, '#ffd700', 10);
        logger.log(`${fighter.name} used Flash Barrage!`, 'combat');
    }
}
