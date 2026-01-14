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
        this.isSniperUltShot = false;
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

        // ============================================
        // UNIFIED IMPACT PROPERTIES (De-spaghettification)
        // ============================================
        // These properties allow the collision handler to process
        // all projectile types with a single generic code path.
        this.impactSound = 'hit';           // Sound ID: 'hit', 'zap', 'explosion', etc.
        this.impactParticle = null;         // Particle spawner: 'quincyArrow', 'zoltraakImpact', 'explosion', etc.
        this.statusEffect = null;           // Status effect: { type: 'STUN', duration: 30 } or null
        this.piercing = false;              // If true, projectile continues after hitting
        this.knockbackForce = 0;            // Force applied to hit entity
        // ============================================
        // COMPONENT SYSTEM (Phase 2 Refactor)
        // ============================================
        this.components = [];
    }

    addComponent(component) {
        this.components.push(component);
        return this;
    }

    update(timeScale = 1.0) {
        // 1. BEHAVIOR SYSTEM (New Path)
        if (this.components.length > 0) {
            for (const component of this.components) {
                component.update(this, timeScale);
            }
            return; // Pure Component Entities skip legacy logic entirely
        }

        // 2. LEGACY LOGIC (Old Path)
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

        // Quincy Arrow - Spirit Trail (Reishi Particles) - WITH GLOW EFFECT
        if (this.isQuincyArrow && this.active) {
            // Spawn trailing beam segments (like Cyborg's laser)
            if (this.lastTrailX !== undefined) {
                const distSq = (this.x - this.lastTrailX) ** 2 + ((this.y - this.z) - this.lastTrailY) ** 2;
                if (distSq > 25) { // Every 5px
                    // Beam trail segment (creates glowing trail effect)
                    this.game.particles.particles.push({
                        type: 'beam',
                        x1: this.lastTrailX, y1: this.lastTrailY,
                        x2: this.x, y2: this.y - this.z,
                        color: this.isPerfectShot ? '#00BFFF' : '#1E90FF',
                        life: 0.4, decay: 0.1, width: this.isPerfectShot ? 4 : 3
                    });
                    this.lastTrailX = this.x;
                    this.lastTrailY = this.y - this.z;
                }
            } else {
                this.lastTrailX = this.x;
                this.lastTrailY = this.y - this.z;
            }

            // Spawn crisp pixel blocks for sparkle effect
            if (this.game.frameAccumulator % 2 === 0) {
                // 1. Center Trail (The "Data Stream")
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 12,
                    y: this.y - this.z - Math.sin(this.angle) * 12,
                    vx: 0, vy: 0,
                    life: 0.3, decay: 0.1,
                    size: 3,
                    color: '#00BFFF',
                    type: 'square',
                    alpha: 1.0
                });

                // 2. Occasional "Glitch" Pixels (side sparkles)
                if (Math.random() < 0.4) {
                    const offset = (Math.random() < 0.5 ? -1 : 1) * 6;
                    const perpAngle = this.angle + Math.PI / 2;
                    this.game.particles.particles.push({
                        x: this.x - Math.cos(this.angle) * 10 + Math.cos(perpAngle) * offset,
                        y: this.y - this.z - Math.sin(this.angle) * 10 + Math.sin(perpAngle) * offset,
                        vx: Math.cos(perpAngle) * offset * 0.3,
                        vy: Math.sin(perpAngle) * offset * 0.3,
                        life: 0.25, decay: 0.1,
                        size: 2,
                        color: '#E0FFFF',
                        type: 'dot'
                    });
                }
            }

            // Perfect shot gets extra sparkle
            if (this.isPerfectShot && Math.random() < 0.15) {
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 8,
                    y: this.y - this.z - Math.sin(this.angle) * 8,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    life: 0.3, decay: 0.1,
                    size: 3, color: '#ffffff', type: 'dot'
                });
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

        // Rubber Fist Logic (Curve & Range)
        if (this.isRubberFist) {
            // 1. Calculate travel stats
            const dx_total = this.x - this.startX;
            const dy_total = this.y - this.startY;
            const travel = Math.hypot(dx_total, dy_total);

            // 2. Range Limit
            if (travel >= (this.maxDist || 280)) {
                this.active = false;
                this.game.particles.spawn(this.x, this.y, '#ffccaa', 1); // Reduced from 3
                return;
            }

            // 3. Apply Curve to Velocity (Arcing Path)
            // Rotate velocity vector slightly each frame to create an arc
            const curveSpeed = 0.05 * (this.curveSide || 0); // Radians per frame

            // Rotate dx, dy
            const cos = Math.cos(curveSpeed);
            const sin = Math.sin(curveSpeed);

            const newDx = this.dx * cos - this.dy * sin;
            const newDy = this.dx * sin + this.dy * cos;

            this.dx = newDx;
            this.dy = newDy;

            // Sync angle for rendering orientation
            this.angle += curveSpeed;
        }

        // Zoltraak Logic (Gentle Homing + Range)
        if (this.isZoltraak) {
            // Range limit
            const travel = Math.hypot(this.x - this.startX, this.y - this.startY);
            if (travel >= (this.maxDist || 450)) {
                this.active = false;
                this.game.particles.spawn(this.x, this.y, '#4fc3f7', 2);
                return;
            }

            // Gentle homing towards target
            if (this.target && !this.target.isDead) {
                const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                let angleDiff = targetAngle - this.angle;

                // Normalize angle difference
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // Apply gentle curve (limit turn rate)
                const maxTurn = this.homingStrength || 0.03;
                const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));

                this.angle += turn;

                // Update velocity based on new angle
                const speed = Math.hypot(this.dx, this.dy);
                this.dx = Math.cos(this.angle) * speed;
                this.dy = Math.sin(this.angle) * speed;
            }

            // Laser Trail: Optimized for High-Performance (ZERO Blur)
            if (this.lastX !== undefined) {
                const distSq = (this.x - this.lastX) ** 2 + (this.y - this.lastY) ** 2;
                if (distSq > 36) { // Spawning segments every 6px (was 4px)
                    const decay = 0.05; // Fast clearing for performance

                    // Single call: The new 'beam' type handles layers internally
                    this.game.particles.spawnBeam(
                        this.lastX, this.lastY,
                        this.x, this.y,
                        '#4fc3f7', 4, decay
                    );

                    this.lastX = this.x;
                    this.lastY = this.y;
                }
            } else {
                this.lastX = this.x;
                this.lastY = this.y;
            }

            // Magical mana trail sparks (Improved)
            if (Math.random() < 0.25) {
                // Sparkle particles that float outward
                const perpAngle = this.angle + Math.PI / 2;
                const offsetDir = Math.random() < 0.5 ? 1 : -1;
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 8,
                    y: this.y - Math.sin(this.angle) * 8,
                    vx: Math.cos(perpAngle) * offsetDir * 2 + (Math.random() - 0.5) * 2,
                    vy: Math.sin(perpAngle) * offsetDir * 2 + (Math.random() - 0.5) * 2,
                    life: 0.4, decay: 0.08,
                    size: Math.random() < 0.3 ? 3 : 2,
                    color: Math.random() < 0.5 ? '#ffffff' : '#87CEEB',
                    type: 'dot'
                });
            }

            // Rune-like square particles (magical effect)
            if (Math.random() < 0.08) {
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 6,
                    y: this.y - Math.sin(this.angle) * 6,
                    vx: (Math.random() - 0.5) * 3,
                    vy: (Math.random() - 0.5) * 3,
                    life: 0.3, decay: 0.1,
                    size: 4, color: '#4fc3f7', type: 'square'
                });
            }
        }

        // Sniper Ult Particles (High-tech energy trail)
        if (this.isSniperUltShot && this.active) {
            // Frequent small sparks
            if (Math.random() < 0.4) {
                this.game.particles.particles.push({
                    x: this.x - Math.cos(this.angle) * 15, // Trail behind
                    y: this.y - Math.sin(this.angle) * 15,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    life: 0.4, decay: 0.1,
                    size: Math.random() < 0.5 ? 2 : 1, // Small crisp pixels
                    color: '#00FF00', // Neon Green
                    type: 'square'
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


        if (this.isWorldSlash) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            const slashWidth = this.radius || 40; // Uses the radius property for width

            // Main slash crescent (single forward arc)
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
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

            // 1. Outer Glow (additive blending for laser-like effect)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = this.isPerfectShot ? '#00BFFF' : '#1E90FF';
            ctx.lineWidth = this.isPerfectShot ? 12 : 8;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(10, 0);
            ctx.stroke();
            ctx.restore();

            // 2. The Arrow Shaft (Pure Energy Beam)
            // Outer Edge (Blue glow)
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(-7.5, 0);
            ctx.lineTo(7.5, 0);
            ctx.stroke();

            // Core (White)
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-7.5, -0.75, 15, 1.5);

            // 3. The Cross-Guard (Quincy Cross shape at the back)
            ctx.strokeStyle = '#1E90FF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Upper wing
            ctx.moveTo(-2.5, 0);
            ctx.lineTo(-6, -4);
            // Lower wing
            ctx.moveTo(-2.5, 0);
            ctx.lineTo(-6, 4);
            ctx.stroke();

            // 4. Arrow Head (Energy Diamond with glow)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#00BFFF';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(7.5, -2.5);
            ctx.lineTo(13, 0);
            ctx.lineTo(7.5, 2.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = '#E0FFFF';
            ctx.beginPath();
            ctx.moveTo(5, 0);
            ctx.lineTo(7.5, -1.5);
            ctx.lineTo(11, 0);
            ctx.lineTo(7.5, 1.5);
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

            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 2;
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;

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
            ctx.beginPath();
            ctx.roundRect(-3, -8, 6, 16, 3); // Small rounded capsule
            ctx.fill();

            // Liquid Reishi inside (Blue strip)
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.roundRect(-1, -6, 2, 12, 1);
            ctx.fill();

            // Metallic Glint
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(-3, -8, 6, 16);

            ctx.restore();
        }
        else if (this.isSniperUltShot) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            // UNIQUE ULT VISUAL: Sleek "Railgun" Needle
            // Not bulky, but long and sharp.

            // 1. Energy Shockwave Rings (Mach cones)
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, -8);
            ctx.lineTo(0, -4);
            ctx.lineTo(0, 4);
            ctx.lineTo(-10, 8);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(-20, -6);
            ctx.lineTo(-12, -3);
            ctx.lineTo(-12, 3);
            ctx.lineTo(-20, 6);
            ctx.stroke();

            // 2. Main Beam / Needle Body

            // Core Shaft (Long and thin)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-25, -1.5, 50, 3); // 50px long, 3px thin

            // 3. Tip Flash
            ctx.fillStyle = '#E0FFFF';
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(25, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        else if (this.isSniperShot) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            const bulletColor = this.isUnblockable ? '#00ff00' : '#ff0000';
            // 2. Motion Trail (Speed Streak)
            const trailGrad = ctx.createLinearGradient(-30, 0, 10, 0);
            trailGrad.addColorStop(0, 'transparent');
            trailGrad.addColorStop(1, bulletColor);
            ctx.fillStyle = trailGrad;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-45, -1.5, 45, 3);

            // 3. Bullet Shape (Sharp Tip / Aerodynamic)
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = this.isUnblockable ? '#00ff88' : '#ff4444';
            ctx.beginPath();
            ctx.moveTo(12, 0); // Sharp Point
            ctx.quadraticCurveTo(8, -3, 0, -3); // Ogive curve
            ctx.lineTo(-12, -3); // Body
            ctx.lineTo(-12, 3); // Base
            ctx.lineTo(0, 3); // Body
            ctx.quadraticCurveTo(8, 3, 12, 0); // Ogive curve
            ctx.closePath();
            ctx.fill();

            // 4. White-Hot Energy Core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(2, -1);
            ctx.lineTo(-10, -1);
            ctx.lineTo(-10, 1);
            ctx.lineTo(2, 1);
            ctx.closePath();
            ctx.fill();

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
        else if (this.isRubberFist) {
            // Draw Arm Curve (Global Space)
            ctx.save();

            // Calculate Control Point for Curve
            // Midpoint
            const midX = (this.startX + this.x) / 2;
            const midY = (this.startY + this.y) / 2;

            // Vector from Start to End
            const dx = this.x - this.startX;
            const dy = this.y - this.startY;
            const dist = Math.hypot(dx, dy);

            // Perpendicular Vector (normalized)
            // Right-hand normal: (dy, -dx) or (-dy, dx)?
            // Let's use (-dy, dx) normalized * curveAmount
            const nx = -dy / (dist || 1);
            const ny = dx / (dist || 1);

            // Curve amount based on "curveSide" and distance
            // We want a nice bow. 
            // The projectile physics curves it, but the arm needs to "fit" the arc.
            // Since the projectile IS arc-ing, the straight line Start->End cuts the corner.
            // We want to bulge OUT same side as curve.
            // curveSide = 1 (Right). Normal should be Right.
            // (-dy, dx) is Right.
            const curveAmt = (this.curveSide || 0) * (dist * 0.2); // Curvature scales with length

            const cpX = midX + nx * curveAmt;
            const cpY = midY + ny * curveAmt;

            // Draw Arm Skin
            ctx.strokeStyle = '#ffccaa';
            ctx.lineWidth = 3; // Thinner arm (Reduced from 4)
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.startX, this.startY);
            ctx.quadraticCurveTo(cpX, cpY, this.x, this.y);
            ctx.stroke();

            // Draw Inner Muscle/Shadow
            ctx.strokeStyle = '#eebba0';
            ctx.lineWidth = 1; // Thinner muscle (Reduced from 1.5)
            ctx.beginPath();
            ctx.moveTo(this.startX, this.startY);
            ctx.quadraticCurveTo(cpX, cpY, this.x, this.y);
            ctx.stroke();

            // Draw FIST at tip (Local Space transform)
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ffccaa';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();

            // Knuckles
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(1.5, -1.5 + i * 1.5, 1, 0, Math.PI * 2); // Thinner knuckles
                ctx.fill();
            }

            ctx.restore();
        }
        else if (this.isZoltraak) {
            // Zoltraak: Magical glowing orb head
            ctx.save();
            ctx.translate(this.x, this.y);

            // Outer glow (additive blending)
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#4fc3f7';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            // Mid glow
            ctx.fillStyle = '#87CEEB';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();

            // Bright core
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
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
