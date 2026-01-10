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
        this.deflect = 0;
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

        // Ginto Trap Lifetime
        if (this.isGintoTrap) {
            this.lifeTime -= 1 * timeScale;
            if (this.lifeTime <= 0) {
                this.active = false;
                return;
            }
            // Ginto is stationary
            this.dx = 0;
            this.dy = 0;
            return; // Don't move
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

        // Raining Arrow Logic (Licht Regen)
        if (this.isRainingArrow && this.active) {
            this.z += this.vz * timeScale;
            this.vz -= 0.5 * timeScale; // Gravity acceleration for "curved" fall

            // Spawn falling trail particles (smaller, less intrusive)
            if (this.z > 0 && Math.random() < 0.4) {
                this.game.particles.particles.push({
                    x: this.x + (Math.random() - 0.5) * 6,
                    y: this.y - this.z, // Offset visually by z height
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: 1.5, // Falling down
                    life: 0.4, decay: 0.06,
                    size: 1.5,
                    color: '#00BFFF',
                    type: 'square'
                });
            }

            // Arrow has landed
            if (this.z <= 0) {
                this.z = 0;
                this.isRainingArrow = false; // Stop falling, now act as normal arrow
                this.dx = 0; // Stop moving horizontally
                this.dy = 0;
                this.landedLifeTime = 60; // Disappear after 1 second

                // Impact effect
                this.game.particles.spawn(this.x, this.y, '#00BFFF', 5);
            }
            // Removed 'return' to allow x/y movement while airborne
        }

        // Landed Raining Arrow decay
        if (this.landedLifeTime !== undefined && this.landedLifeTime > 0) {
            this.landedLifeTime -= 1 * timeScale;
            if (this.landedLifeTime <= 0) {
                this.active = false;
                return;
            }
        }

        // Quincy Arrow - Spirit Trail (Reishi Particles) - PIXELATED STYLE
        if (this.isQuincyArrow && this.active) {
            // Spawn crisp pixel blocks instead of glowing clouds
            if (this.game.frameAccumulator % 2 === 0) { // Every other frame for discrete look
                // 1. Center Trail (The "Data Stream")
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 12,
                    y: this.y - this.z - Math.sin(this.angle) * 12,
                    vx: 0, vy: 0,
                    life: 0.3, decay: 0.1, // Quick vanish
                    size: 4, // Fixed pixel size
                    color: '#00BFFF',
                    type: 'square',
                    alpha: 1.0 // No transparency fade at start
                });

                // 2. Occasional "Glitch" Pixels
                if (Math.random() < 0.3) {
                    const offset = (Math.random() < 0.5 ? -1 : 1) * 8;
                    const perpAngle = this.angle + Math.PI / 2;
                    this.game.particles.particles.push({
                        x: this.x - Math.cos(this.angle) * 10 + Math.cos(perpAngle) * offset,
                        y: this.y - this.z - Math.sin(this.angle) * 10 + Math.sin(perpAngle) * offset,
                        vx: 0, vy: 0,
                        life: 0.2, decay: 0.1,
                        size: 2, // Smaller pixel
                        color: '#E0FFFF',
                        type: 'square'
                    });
                }
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

        // --- KING OF CURSES LOGIC ---
        if (this.isFugaArrow) {
            const travel = Math.hypot(this.x - (this.startX || this.x), this.y - (this.startY || this.y));

            // Check max range or wall hit (manual wall check if not covered by standard bullet logic?)
            // Standard logic above checks bounds but just kills it. We want to spawn ground burn.
            const bounds = this.game.arenaBounds;
            let hitWall = false;
            if (this.x < bounds.x || this.x > bounds.x + bounds.width || this.y < bounds.y || this.y > bounds.y + bounds.height) {
                hitWall = true;
            }

            if (travel >= (this.maxDistance || 300) || hitWall) {
                this.active = false;
                // Spawn Ground Burn
                this.game.spawnGroundBurn(this.x, this.y, this.owner);
                this.game.particles.spawnExplosion(this.x, this.y); // Fire effect
                audioEngine.playExplosion();
            }
        }

        if (this.isGroundBurn) {
            this.lifeTime -= 1 * timeScale;
            if (this.lifeTime <= 0) {
                this.active = false;
            }
            // Logic for applying burn is in Game.js collision
        }

        if (this.isWorldSlash) {
            // "Drag opponent along the projectile path"
            // This is best handled in collision (Game.js), constantly resetting enemy position while overlapping?
            // Or here, we can find overlapping enemies and pull them.
            // But collision logic is in Game.js. We'll handle drag there.

            // Visual particles for the slash
            if (Math.random() < 0.3) {
                this.game.particles.particles.push({
                    x: this.x + (Math.random() - 0.5) * 40,
                    y: this.y + (Math.random() - 0.5) * 40,
                    vx: 0, vy: 0,
                    life: 0.3, decay: 0.1,
                    size: 3, color: '#DC143C', type: 'square'
                });
            }
        }
    }

    draw(ctx) {
        // --- HIT INDICATORS (Cosmetic Landing Zone Preview) ---
        // Grenade: Faint red-filled circle at explosion zone
        if (this.isGrenade && this.z > 0 && this.destX !== undefined) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 50, 50, 0.15)';
            ctx.beginPath();
            ctx.arc(this.destX, this.destY, this.explosionRadius, 0, Math.PI * 2);
            ctx.fill();
            // Subtle ring outline
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        // Licht Regen Arrow: Blue stroke ring at landing spot
        if (this.isLichtRegen && this.z > 0 && this.destX !== undefined) {
            ctx.save();
            ctx.strokeStyle = 'rgba(30, 144, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.destX, this.destY, 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // --- KING OF CURSES DRAWING ---
        if (this.isFugaArrow) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            // Outer flame glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#FF4500';

            // Main arrow body (bigger)
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(18, 0); // Bigger tip
            ctx.lineTo(-12, 8);
            ctx.lineTo(-8, 0);
            ctx.lineTo(-12, -8);
            ctx.closePath();
            ctx.fill();

            // Inner hot core
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-4, 4);
            ctx.lineTo(-4, -4);
            ctx.closePath();
            ctx.fill();

            // Flame trail (animated flickering)
            const time = Date.now() / 50;
            ctx.fillStyle = '#FF4500';
            for (let i = 0; i < 5; i++) {
                const flicker = Math.sin(time + i * 1.5) * 3;
                const trailX = -15 - i * 6;
                const trailY = flicker;
                const size = 6 - i;
                ctx.beginPath();
                ctx.arc(trailX, trailY, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Sparks
            ctx.fillStyle = '#FFFF00';
            for (let i = 0; i < 3; i++) {
                const sparkX = -10 - Math.random() * 20;
                const sparkY = (Math.random() - 0.5) * 12;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            // Spawn trailing fire particles in game
            if (Math.random() < 0.4 && this.game) {
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 15,
                    y: this.y - Math.sin(this.angle) * 15,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2 - 1,
                    life: 0.5,
                    decay: 0.05,
                    size: 4 + Math.random() * 3,
                    color: Math.random() > 0.5 ? '#FF4500' : '#FFD700',
                    type: 'dot'
                });
            }

            return;
        }

        if (this.isWorldSlash) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            const slashWidth = this.radius || 40; // Uses the radius property for width

            // Glow effect
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#DC143C';

            // Main slash crescent (single forward arc)
            ctx.strokeStyle = '#DC143C';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';

            ctx.beginPath();
            // Draw a single clean crescent moving forward
            ctx.moveTo(0, -slashWidth);
            ctx.quadraticCurveTo(slashWidth * 0.4, 0, 0, slashWidth);
            ctx.stroke();

            // Inner bright edge
            ctx.strokeStyle = '#FF6B6B';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -slashWidth * 0.85);
            ctx.quadraticCurveTo(slashWidth * 0.3, 0, 0, slashWidth * 0.85);
            ctx.stroke();

            // Core white flash
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, -slashWidth * 0.7);
            ctx.quadraticCurveTo(slashWidth * 0.2, 0, 0, slashWidth * 0.7);
            ctx.stroke();

            ctx.restore();
            return;
        }

        if (this.isGroundBurn) {
            ctx.save();

            // Calculate fade based on remaining lifetime
            const fadeRatio = this.lifeTime / (this.maxLifeTime || 240);
            ctx.globalAlpha = 0.4 + fadeRatio * 0.4;

            // Outer glow ring
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            gradient.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
            gradient.addColorStop(1, 'rgba(139, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Animated flame tongues
            const time = Date.now() / 100;
            ctx.fillStyle = '#FF4500';
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + time * 0.3;
                const flicker = Math.sin(time * 2 + i) * 5;
                const flameLen = (this.radius * 0.6) + flicker;
                const fx = this.x + Math.cos(angle) * flameLen;
                const fy = this.y + Math.sin(angle) * flameLen;

                ctx.beginPath();
                ctx.arc(fx, fy, 4 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Central hot core
            ctx.fillStyle = '#FFFF00';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#FF4500';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
            ctx.fill();

            // Sparks/Embers rising
            ctx.fillStyle = '#FFAA00';
            for (let i = 0; i < 3; i++) {
                const sparkX = this.x + (Math.random() - 0.5) * this.radius;
                const sparkY = this.y + (Math.random() - 0.5) * this.radius - Math.random() * 10;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
            return;
        }

        // --- QUINCY ARROW DRAWING ---
        if (this.isQuincyArrow) {
            ctx.save();
            ctx.translate(this.x, this.y - this.z);

            // If landed (no z height) and is Licht Regen, plant it vertically
            if (this.isLichtRegen && this.z <= 0) {
                ctx.rotate(Math.PI / 2);
            } else {
                ctx.rotate(this.angle);
            }

            // 1. Intense Reishi Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00BFFF';

            // 2. The Arrow Shaft (Pure Energy Beam) - REDUCED SIZE 50%
            // Core (White)
            ctx.fillStyle = '#FFFFFF';
            // Original: -15, -1.5, 30, 3 -> New: -7.5, -0.75, 15, 1.5
            ctx.fillRect(-7.5, -0.75, 15, 1.5);

            // Outer Glow (Blue)
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 1; // 2 -> 1
            ctx.beginPath();
            ctx.moveTo(-7.5, 0); // -15 -> -7.5
            ctx.lineTo(7.5, 0);  // 15 -> 7.5
            ctx.stroke();

            // 3. The Cross-Guard (Quincy Cross shape at the back)
            ctx.strokeStyle = '#1E90FF';
            ctx.lineWidth = 1; // 2 -> 1
            ctx.beginPath();
            // Upper wing
            ctx.moveTo(-2.5, 0);    // -5 -> -2.5
            ctx.lineTo(-6, -4);     // -12, -8 -> -6, -4
            // Lower wing
            ctx.moveTo(-2.5, 0);    // -5 -> -2.5
            ctx.lineTo(-6, 4);      // -12, 8 -> -6, 4
            ctx.stroke();

            // 4. Arrow Head (Energy Diamond)
            ctx.fillStyle = '#E0FFFF';
            ctx.beginPath();
            ctx.moveTo(5, 0);       // 10 -> 5
            ctx.lineTo(7.5, -1.5);  // 15, -3 -> 7.5, -1.5
            ctx.lineTo(11, 0);      // 22 -> 11
            ctx.lineTo(7.5, 1.5);   // 15, 3 -> 7.5, 1.5
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
            ctx.fillStyle = '#ff6600';
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
            // Range indicator
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
        else if (this.isGintoTrap) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // 1. The Quincy Zeichen (Magic Seal on ground)
            // Slowly rotate the seal
            ctx.rotate(Date.now() * 0.002);

            // Glow Effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00BFFF';
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 2;

            // Draw 5-pointed Quincy Star (The Trap Radius)
            ctx.beginPath();
            const r = this.radius * 1.8; // Visual radius slightly larger than hitbox
            for (let i = 0; i < 5; i++) {
                // Outer points
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);

                // Inner connecting lines (Pentagram style)
                const nextIndex = (i + 2) % 5;
                const nextAngle = (Math.PI * 2 * nextIndex) / 5 - Math.PI / 2;
                ctx.lineTo(Math.cos(nextAngle) * r, Math.sin(nextAngle) * r);
            }
            ctx.closePath();
            ctx.stroke();

            // 2. The Ginto Tube (Physical Object in Center)
            // Counter-rotate so the tube stays upright relative to the seal
            ctx.rotate(-Date.now() * 0.002);

            // Silver Tube Body
            ctx.fillStyle = '#C0C0C0'; // Silver
            ctx.shadowColor = '#FFFFFF';
            ctx.beginPath();
            ctx.rect(-3, -8, 6, 16); // Small capsule/tube
            ctx.fill();

            // Liquid Reishi inside (Blue strip)
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.rect(-1, -6, 2, 12);
            ctx.fill();

            // Metallic Glint
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(-3, -8, 6, 16);

            ctx.restore();
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
            // Generic Fallback
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
