/**
 * Dash Ability
 * Handles dash-based abilities like Sword Master's Dash Assault and Soldier's Retreat
 */
import { Ability } from './Ability.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

export class DashAssaultAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.damage = config.damage;
    }

    execute(fighter, context) {
        const { enemies, game } = context;

        fighter.isDashing = true;
        fighter.dashTimer = 15;

        const target = enemies.find(e => e !== fighter && !e.isDead);
        let aimAngle = fighter.angle;
        if (target) aimAngle = Math.atan2(target.y - fighter.y, target.x - fighter.x);

        fighter.angle = aimAngle;
        const dist = 400;
        const destX = fighter.x + Math.cos(aimAngle) * dist;
        const destY = fighter.y + Math.sin(aimAngle) * dist;

        game.particles.spawnSlash(fighter.x, fighter.y, destX, destY, '#ff0000'); // Red Slash
        game.particles.spawnText(fighter.x, fighter.y, "ULTIMATE!", "#ffaa00");
        audioEngine.playSwordSwing();

        if (target && Physics.lineCircleIntersect(fighter.x, fighter.y, destX, destY, target.x, target.y, target.radius + 15)) {
            target.takeDamage(this.damage);
            target.applyStatus('BLEED');
            audioEngine.playHit();
        }

        fighter.x = Math.max(fighter.radius, Math.min(game.width - fighter.radius, destX));
        fighter.y = Math.max(fighter.radius, Math.min(game.height - fighter.radius, destY));

        fighter.cooldowns.ult = this.cooldown;
    }
}

export class RetreatAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.range = config.range;
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
        fighter.dashTimer = 20;

        const angle = Math.atan2(fighter.y - enemy.y, fighter.x - enemy.x);
        const dashSpeed = 8;
        fighter.dx = Math.cos(angle) * dashSpeed;
        fighter.dy = Math.sin(angle) * dashSpeed;

        game.particles.spawnText(fighter.x, fighter.y, "RETREAT!", "#54a0ff");
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
    }

    execute(fighter, context) {
        const { game } = context;
        const Projectile = this.ProjectileClass;
        const count = 5;

        fighter.cooldowns.ult = this.cooldown;
        fighter.teleportDelayTimer = this.kunaiConfig.delay;
        fighter.kunaiPending = [];

        for (let i = 0; i < count; i++) {
            // ULT: 360 Degree Spread (Evenly spaced)
            const throwAngle = fighter.angle + ((Math.PI * 2) / count) * i;
            const speed = 9;

            const p = new Projectile(
                fighter,
                fighter.x + Math.cos(fighter.angle) * 20,
                fighter.y + Math.sin(fighter.angle) * 20,
                throwAngle,
                speed,
                this.kunaiConfig.damage,
                game
            );

            // Kunai specific props
            p.isKunai = true;
            p.radius = 6;
            p.maxDist = 220 + Math.random() * 50;

            game.projectiles.push(p);
            fighter.kunaiPending.push(p);
            audioEngine.playKunaiThrow();
        }

        game.particles.spawnText(fighter.x, fighter.y, "ULTIMATE!", "#ffaa00");
        game.particles.spawnText(fighter.x, fighter.y + 20, "BARRAGE!", "#ffd700");
    }
}
