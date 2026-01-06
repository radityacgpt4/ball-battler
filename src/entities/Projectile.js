/**
 * Projectile Entity
 * Handles bullets, grenades, kunai and other projectiles
 */
import { audioEngine } from '../systems/Audio.js';

export class Projectile {
    constructor(owner, x, y, angle, speed, damage, gameRef) {
        this.owner = owner;
        this.x = x;
        this.y = y;
        this.angle = angle; // Store angle for drawing rotation
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
        this.damage = damage;
        this.radius = 4;
        this.active = true;
        this.game = gameRef;

        // Grenade props
        this.isGrenade = false;
        this.z = 0;
        this.vz = 0;
        this.hasExploded = false;

        // Kunai props
        this.isKunai = false;
        this.maxDist = 0;
        this.travelled = 0;
        this.hitList = []; // For piercing (ID tracking)
        this.isEmbedded = false;

        // Missile props
        this.isMissile = false;
        this.target = null;
        this.turnSpeed = 0.05; // Weak homing

        // Sniper/Claymore props
        this.isClaymore = false;
        this.stunDuration = 0;
        this.slowDuration = 0;
        this.lifeTime = 0;
        this.isSniperShot = false;
        this.isUnblockable = false;

        // Ballista bolt props
        this.isBallistaBolt = false;
        this.isUltBolt = false;
        this.dragTarget = null;
        this.dragDuration = 0;
        this.boltIndex = 0;
    }

    update(timeScale = 1.0) {
        if (this.isEmbedded) return; // Stop moving if embedded

        if (this.isClaymore) {
            this.lifeTime -= 1 * timeScale;
            if (this.lifeTime <= 0) {
                this.active = false;
                return;
            }
            // Claymore friction (stops sliding)
            this.dx *= 0.9;
            this.dy *= 0.9;
        }

        // Ballista Bolt Drag Logic
        if (this.isBallistaBolt && this.dragTarget && !this.dragTarget.isDead) {
            this.dragDuration -= 1 * timeScale;

            // Drag the target along with the bolt
            this.dragTarget.x = this.x;
            this.dragTarget.y = this.y;

            // Check if target hit wall while being dragged
            const bounds = this.game.arenaBounds;
            const hitWall = (
                this.dragTarget.x <= bounds.x + this.dragTarget.radius ||
                this.dragTarget.x >= bounds.x + bounds.width - this.dragTarget.radius ||
                this.dragTarget.y <= bounds.y + this.dragTarget.radius ||
                this.dragTarget.y >= bounds.y + bounds.height - this.dragTarget.radius
            );

            if (hitWall) {
                // Clamp position
                this.dragTarget.x = Math.max(bounds.x + this.dragTarget.radius, Math.min(bounds.x + bounds.width - this.dragTarget.radius, this.dragTarget.x));
                this.dragTarget.y = Math.max(bounds.y + this.dragTarget.radius, Math.min(bounds.y + bounds.height - this.dragTarget.radius, this.dragTarget.y));

                // Stun for 0.5 sec (30 frames)
                this.dragTarget.applyStatus('STUN', 30);
                this.game.particles.spawnText(this.dragTarget.x, this.dragTarget.y, "PINNED!", "#8B4513");
                this.game.particles.spawnWallImpact(this.dragTarget.x, this.dragTarget.y);
                audioEngine.playHeavyImpact();

                // Release and deactivate
                this.dragTarget.beingDragged = false;
                this.dragTarget = null;
                this.active = false;
                return;
            }

            if (this.dragDuration <= 0) {
                // Release target after drag duration
                this.dragTarget.beingDragged = false;
                this.dragTarget = null;
                this.active = false;
                return;
            }
        }

        // Missile Homing Logic
        if (this.isMissile && this.active) {
            // Smoke Trail
            if (Math.random() < 0.5 * timeScale) {
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 10,
                    y: this.y - Math.sin(this.angle) * 10,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    life: 0.8, decay: 0.05,
                    size: Math.random() * 4 + 2,
                    color: '#888888',
                    type: 'dot'
                });
            }

            if (!this.target || this.target.isDead) {
                // Find new target
                const enemies = this.game.entities.filter(e => e !== this.owner && !e.isDead);
                let closest = null;
                let minDist = Infinity;
                for (const e of enemies) {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < minDist) {
                        minDist = d;
                        closest = e;
                    }
                }
                this.target = closest;
            }

            if (this.target) {
                const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                let angleDiff = targetAngle - this.angle;
                
                // Normalize angle
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // Turn towards target
                const turn = this.turnSpeed * timeScale;
                if (Math.abs(angleDiff) < turn) {
                    this.angle = targetAngle;
                } else {
                    this.angle += Math.sign(angleDiff) * turn;
                }

                // Update velocity vector based on new angle
                const speed = Math.hypot(this.dx, this.dy);
                this.dx = Math.cos(this.angle) * speed;
                this.dy = Math.sin(this.angle) * speed;
            }
        }

        this.x += this.dx * timeScale;
        this.y += this.dy * timeScale;

        if (this.isKunai) {
            this.travelled += Math.hypot(this.dx, this.dy);

            // Stop if hit wall
            const bounds = this.game.arenaBounds;
            if (this.x < bounds.x || this.x > bounds.x + bounds.width || this.y < bounds.y || this.y > bounds.y + bounds.height || this.travelled >= this.maxDist) {
                this.dx = 0;
                this.dy = 0;
                this.isEmbedded = true;
                // Clamp to screen
                this.x = Math.max(bounds.x + 5, Math.min(bounds.x + bounds.width - 5, this.x));
                this.y = Math.max(bounds.y + 5, Math.min(bounds.y + bounds.height - 5, this.y));
                if (this.travelled < this.maxDist) audioEngine.playHit(); // Wall tick
            }
        }
        else if (this.isGrenade) {
            this.z += this.vz * timeScale;
            this.vz -= 0.5 * timeScale;
            const bounds = this.game.arenaBounds;
            if (this.x < bounds.x || this.x > bounds.x + bounds.width) {
                this.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width, this.x));
                this.dx *= -0.5;
            }
            if (this.y < bounds.y || this.y > bounds.y + bounds.height) {
                this.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height, this.y));
                this.dy *= -0.5;
            }
            if (this.z <= 0) {
                this.z = 0;
                this.active = false;
                this.hasExploded = true;
            }
        }
        else {
            // Standard Bullet
            const bounds = this.game.arenaBounds;
            if (this.x < bounds.x || this.x > bounds.x + bounds.width || this.y < bounds.y || this.y > bounds.y + bounds.height) {
                this.active = false;
            }
        }
    }

    draw(ctx) {
        if (this.isKunai) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            // Draw Kunai (Diamond Shape)
            ctx.fillStyle = this.isEmbedded ? '#b8860b' : '#ffd700'; // Darker gold if stuck
            ctx.beginPath();
            ctx.moveTo(10, 0);  // Tip
            ctx.lineTo(-6, 5);  // Back Right
            ctx.lineTo(-2, 0);  // Handle start
            ctx.lineTo(-6, -5); // Back Left
            ctx.closePath();
            ctx.fill();

            // Handle/Ring
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-2, 0);
            ctx.lineTo(-12, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-14, 0, 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }
        else if (this.isGrenade) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.z, this.radius, 0, Math.PI * 2);
            ctx.fill();
            if (Math.floor(Date.now() / 100) % 2 === 0) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(this.x, this.y - this.z, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        else if (this.isMissile) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            
            // Fins
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-10, 8);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-10, -8);
            ctx.fill();

            // Draw Missile Body (Bigger)
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.moveTo(10, 0); // Longer nose
            ctx.lineTo(-6, 5); // Wider body
            ctx.lineTo(-6, -5);
            ctx.fill();

            // Thruster/Engine
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-14, 0); // Longer flame
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.restore();
        }
        else if (this.isClaymore) {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Blink light
            if (Math.floor(Date.now() / 200) % 2 === 0) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Range indicator (faint)
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
        else if (this.isSniperShot) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            
            ctx.fillStyle = this.isUnblockable ? '#00ff00' : '#ff0000';
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
            
            ctx.beginPath();
            ctx.fillRect(-10, -2, 20, 4); // Long bullet
            ctx.restore();
        }
        else if (this.isBallistaBolt) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            // Arrow shaft
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(-20, -2, 35, 4);

            // Arrow head (triangular)
            ctx.fillStyle = this.isUltBolt ? '#FFD700' : '#4A4A4A';
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(8, -6);
            ctx.lineTo(10, 0);
            ctx.lineTo(8, 6);
            ctx.closePath();
            ctx.fill();

            // Metallic edge
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(8, -6);
            ctx.moveTo(18, 0);
            ctx.lineTo(8, 6);
            ctx.stroke();

            // Fletching (feathers)
            ctx.fillStyle = this.isUltBolt ? '#8B0000' : '#2E7D32';
            ctx.beginPath();
            ctx.moveTo(-15, -2);
            ctx.lineTo(-22, -8);
            ctx.lineTo(-18, -2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-15, 2);
            ctx.lineTo(-22, 8);
            ctx.lineTo(-18, 2);
            ctx.fill();

            ctx.restore();
        }
        else {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
