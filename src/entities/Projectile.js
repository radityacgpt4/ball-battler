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
    }

    update() {
        if (this.isEmbedded) return; // Stop moving if embedded

        // Missile Homing Logic
        if (this.isMissile && this.active) {
            // Smoke Trail
            if (Math.random() < 0.5) {
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
                if (Math.abs(angleDiff) < this.turnSpeed) {
                    this.angle = targetAngle;
                } else {
                    this.angle += Math.sign(angleDiff) * this.turnSpeed;
                }

                // Update velocity vector based on new angle
                const speed = Math.hypot(this.dx, this.dy);
                this.dx = Math.cos(this.angle) * speed;
                this.dy = Math.sin(this.angle) * speed;
            }
        }

        this.x += this.dx;
        this.y += this.dy;

        if (this.isKunai) {
            this.travelled += Math.hypot(this.dx, this.dy);

            // Stop if hit wall
            if (this.x < 0 || this.x > this.game.width || this.y < 0 || this.y > this.game.height || this.travelled >= this.maxDist) {
                this.dx = 0;
                this.dy = 0;
                this.isEmbedded = true;
                // Clamp to screen
                this.x = Math.max(5, Math.min(this.game.width - 5, this.x));
                this.y = Math.max(5, Math.min(this.game.height - 5, this.y));
                if (this.travelled < this.maxDist) audioEngine.playHit(); // Wall tick
            }
        }
        else if (this.isGrenade) {
            this.z += this.vz;
            this.vz -= 0.5;
            if (this.x < 0 || this.x > this.game.width) {
                this.x = Math.max(0, Math.min(this.game.width, this.x));
                this.dx *= -0.5;
            }
            if (this.y < 0 || this.y > this.game.height) {
                this.y = Math.max(0, Math.min(this.game.height, this.y));
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
            if (this.x < 0 || this.x > this.game.width || this.y < 0 || this.y > this.game.height) {
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
        else {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
