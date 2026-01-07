/**
 * Sniper Abilities
 * Handles Laser Sight, Sniper Shot, and Claymore
 */
import { Ability } from './Ability.js';
import { Projectile } from '../entities/Projectile.js';
import { Physics } from '../systems/Physics.js';
import { audioEngine } from '../systems/Audio.js';

export class SniperAtkAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 90; // 1.5s
        this.damage = config.damage || 12;
        this.stunDuration = config.stun || 60; // 1s
        this.projectileSpeed = config.projectileSpeed || 20;
        this.laserColor = '#ff0000';
    }

    // Passive update to show laser sight
    update(fighter, context) {
        const { game } = context;

        // Sync laser color with Ult state
        this.laserColor = fighter.activeEffects.ultActive ? '#00ff00' : '#ff0000';

        // Draw Laser Sight
        if (fighter.cooldowns.atk <= 0) {
            this.drawLaserSight(fighter, game);
            this.checkLaserTrigger(fighter, context);
        }
    }

    drawLaserSight(fighter, game) {
        const angle = fighter.angle;
        const dist = 800;
        const endX = fighter.x + Math.cos(angle) * dist;
        const endY = fighter.y + Math.sin(angle) * dist;

        // Perform raycast to stop at walls
        const bounds = game.arenaBounds;
        const hit = Physics.rayBoxIntersect(fighter.x, fighter.y, Math.cos(angle), Math.sin(angle), bounds.x, bounds.y, bounds.width, bounds.height);
        
        let targetX = endX;
        let targetY = endY;

        if (hit) {
            targetX = hit.x;
            targetY = hit.y;
        }

        const ctx = game.ctx;
        ctx.save();
        ctx.strokeStyle = this.laserColor;
        ctx.lineWidth = fighter.activeEffects.ultActive ? 3 : 1;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(fighter.x, fighter.y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    checkLaserTrigger(fighter, context) {
        const { enemies, game } = context;
        const angle = fighter.angle;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        // Check if any enemy is touching the laser line
        for (let enemy of enemies) {
            if (enemy === fighter || enemy.isDead) continue;

            const hit = Physics.rayCircleIntersect(fighter.x, fighter.y, dirX, dirY, enemy.x, enemy.y, enemy.radius);
            
            if (hit) {
                // Ensure no wall in between
                const distToEnemy = hit.dist;
                const bounds = game.arenaBounds;
                const wallHit = Physics.rayBoxIntersect(fighter.x, fighter.y, dirX, dirY, bounds.x, bounds.y, bounds.width, bounds.height);
                
                if (!wallHit || wallHit.dist > distToEnemy) {
                    // Trigger Shot!
                    this.execute(fighter, context);
                    break;
                }
            }
        }
    }

    execute(fighter, context) {
        const { game } = context;
        
        fighter.cooldowns.atk = this.cooldown;

        const p = new Projectile(
            fighter,
            fighter.x + Math.cos(fighter.angle) * 20,
            fighter.y + Math.sin(fighter.angle) * 20,
            fighter.angle,
            this.projectileSpeed,
            this.damage,
            game
        );

        p.isSniperShot = true;
        p.stunDuration = this.stunDuration;
        p.radius = 5;

        // Check for ULT buff (Sniper Mode)
        if (fighter.activeEffects.ultActive) {
            p.isUnblockable = true;
            p.damage = this.damage; // Damage stays same, but unblockable
            p.radius = 8; // Bigger caliber
            // Note: Ult visual change handled in Projectile.draw or here
            this.laserColor = '#00ff00';
        } else {
            this.laserColor = '#ff0000';
        }

        game.projectiles.push(p);
        
        audioEngine.playGunshot(); // Or a bigger sound
        game.particles.spawn(fighter.x, fighter.y, '#ffffff', 5);
        
        // Recoil
        fighter.dx -= Math.cos(fighter.angle) * 2;
        fighter.dy -= Math.sin(fighter.angle) * 2;
    }
}

export class ClaymoreAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.cooldown = config.cooldown || 180; // 3 seconds
        this.damage = config.damage || 5;
        this.lifeTime = config.lifeTime || 360; // 6 seconds
        this.slowDuration = config.slowDuration || 120; // 2 seconds
    }

    update(fighter, context) {
        // Auto-drop every 3 seconds if available
        if (this.canUse(fighter, context)) {
            this.execute(fighter, context);
        }
    }

    execute(fighter, context) {
        const { game } = context;
        fighter.cooldowns.def = this.cooldown;

        const p = new Projectile(
            fighter,
            fighter.x,
            fighter.y,
            fighter.angle + Math.PI, // Drop behind
            2, // Slight slide speed
            this.damage,
            game
        );

        p.isClaymore = true;
        p.lifeTime = this.lifeTime;
        p.slowDuration = this.slowDuration;
        p.radius = 10; // Trigger radius

        game.projectiles.push(p);
        audioEngine.playTone(600, 'sine', 0.1, 0.1); // Beep
    }
}

export class SniperUltAbility extends Ability {
    constructor(config, slot) {
        super(config, slot);
        this.duration = config.duration || 300; // 5s maybe? Not specified, assume until toggle or duration
        // The prompt implies a mode switch: "Change the laser pointer... change the firing projectile"
        // Let's make it a duration buff
    }

    execute(fighter, context) {
        const { game } = context;
        
        fighter.activeEffects.ultActive = true;
        fighter.activeEffects.ultTimer = 600; // 10 seconds of Sniper Mode
        fighter.cooldowns.ult = this.cooldown;

        game.particles.spawn(fighter.x, fighter.y, '#00ff00', 10);
        audioEngine.playPowerUp(); 
        
        // Update Laser Color immediately for visual feedback
        if (fighter.abilities.atk instanceof SniperAtkAbility) {
            fighter.abilities.atk.laserColor = '#00ff00';
        }
    }
}