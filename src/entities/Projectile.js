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

        // Deflection props
        this.isDeflected = false;
        this.deflect= 0;
    }

    update(timeScale = 1.0) {
        // Handle deflected projectile lifetime (even if embedded)
        if (this.isDeflected && this.deflectLifetime > 0) {
            this.deflectLifetime -= 1 * timeScale;
            if (this.deflectLifetime <= 0) {
                this.active = false;
                return;
            }
        }

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
            // Bolt follows and pushes the target
            this.x = this.dragTarget.x + Math.cos(this.angle) * 10;
            this.y = this.dragTarget.y + Math.sin(this.angle) * 10;

            this.dragDuration -= 1 * timeScale;

            if (this.dragDuration <= 0) {
                // Release after duration
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

        // --- QUINCY REISHI ARROW EFFECTS ---
        if (this.isQuincyArrow && this.active) {
            // 1. Central Energy Residue (fading blue dust)
            if (Math.random() < 0.3) {
                this.game.particles.particles.push({
                    x: this.x, 
                    y: this.y,
                    vx: (Math.random() - 0.5) * 0.5, 
                    vy: (Math.random() - 0.5) * 0.5,
                    life: 0.4, decay: 0.08, 
                    size: Math.random() * 3, 
                    color: '#00BFFF', 
                    type: 'dot',
                    alpha: 0.6
                });
            }

            // 2. Spiraling Helix Lines (Reishi strands)
            const t = Date.now() * 0.025; // Rotation speed
            const perpAngle = this.angle + Math.PI / 2;
            const spiralRadius = 6; // Width of the spiral

            // Helix Strand 1
            const offset1 = Math.sin(t) * spiralRadius;
            this.game.particles.particles.push({
                x: this.x - Math.cos(this.angle) * 10 + Math.cos(perpAngle) * offset1,
                y: this.y - Math.sin(this.angle) * 10 + Math.sin(perpAngle) * offset1,
                vx: 0, vy: 0, 
                life: 0.2, decay: 0.1, 
                size: 1.5, color: '#1E90FF', 
                type: 'dot' 
            });

            // Helix Strand 2 (Opposite phase)
            const offset2 = Math.sin(t + Math.PI) * spiralRadius;
            this.game.particles.particles.push({
                x: this.x - Math.cos(this.angle) * 10 + Math.cos(perpAngle) * offset2,
                y: this.y - Math.sin(this.angle) * 10 + Math.sin(perpAngle) * offset2,
                vx: 0, vy: 0, 
                life: 0.2, decay: 0.1, 
                size: 1.5, color: '#00FFFF', 
                type: 'dot'
            });
        }
    }

draw(ctx) {
        // --- QUINCY ARROW DRAWING ---
        if (this.isQuincyArrow) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            // 1. Intense Reishi Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00BFFF';
            
            // 2. The Arrow Shaft (Pure Energy Beam)
            // Core (White)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-15, -1.5, 30, 3);
            
            // Outer Glow (Blue)
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(15, 0);
            ctx.stroke();

            // 3. The Cross-Guard (Quincy Cross shape at the back)
            ctx.strokeStyle = '#1E90FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Upper wing
            ctx.moveTo(-5, 0);
            ctx.lineTo(-12, -8);
            // Lower wing
            ctx.moveTo(-5, 0);
            ctx.lineTo(-12, 8);
            ctx.stroke();

            // 4. Arrow Head (Energy Diamond)
            ctx.fillStyle = '#E0FFFF';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(15, -3);
            ctx.lineTo(22, 0); // Tip
            ctx.lineTo(15, 3);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
            return; 
        }

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

            // Draw Missile Body (Cylinder)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-8, -3, 16, 6);

            // Nose Cone (Red)
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.moveTo(8, -3);
            ctx.lineTo(14, 0);
            ctx.lineTo(8, 3);
            ctx.fill();

            // Fins (Dark Grey)
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(-12, 6);
            ctx.lineTo(-4, 3);
            ctx.lineTo(-4, -3);
            ctx.lineTo(-12, -6);
            ctx.fill();

            // Thruster/Engine Flame
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(-18 + Math.random() * -4, 0); // Flickering flame
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.restore();
        }
        else if (this.isClaymore) {
            ctx.fillStyle = '#ff6600'; // Orange for high contrast
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
