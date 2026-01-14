/**
 * Particle System
 * Handles all visual effects and particle rendering
 */
import { Physics } from './Physics.js';
import { PARTICLE_TEMPLATES } from '../data/particleTemplates.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    /**
     * GENERIC SPAWNER (OCP Compliant)
     * Spawns an effect based on a string ID defined in particleTemplates.js
     */
    spawnEffect(id, x, y) {
        const template = PARTICLE_TEMPLATES[id];
        if (!template) {
            console.warn(`ParticleSystem: Unknown effect ID '${id}'`);
            return;
        }

        for (let layer of template.layers) {
            this.processLayer(layer, x, y);
        }
    }

    processLayer(layer, x, y) {
        if (layer.type === 'burst') {
            const count = layer.count || 10;
            const colors = Array.isArray(layer.color) ? layer.color : [layer.color];

            for (let i = 0; i < count; i++) {
                const color = colors[Math.floor(Math.random() * colors.length)];

                // Determine velocity
                let vx, vy;
                if (layer.angle !== undefined) {
                    // Directional burst (e.g. Licht Regen)
                    const angle = layer.angle + (Math.random() - 0.5) * (layer.spread || 1);
                    const speed = layer.speed || 5;
                    vx = Math.cos(angle) * speed;
                    vy = Math.sin(angle) * speed;
                } else {
                    // Omni-directional burst
                    const speed = typeof layer.speed === 'object' ?
                        (layer.speed.min + Math.random() * (layer.speed.max - layer.speed.min)) :
                        (layer.speed || 5);
                    vx = (Math.random() - 0.5) * speed;
                    vy = (Math.random() - 0.5) * speed;
                }

                if (layer.rise) vy += layer.rise; // Add vertical rise (e.g. Hirenkyaku)

                this.particles.push({
                    x, y, color,
                    vx, vy,
                    life: layer.life,
                    decay: 0.05 + Math.random() * 0.05, // Slight variance
                    size: layer.size || (Math.random() * 3 + 2),
                    type: layer.shape // dot, square, flash
                });
            }
        }
        else if (layer.type === 'shockwave') {
            this.particles.push({
                type: 'shockwave',
                x, y,
                radius: 5,
                maxRadius: layer.maxRadius,
                life: layer.life,
                decay: 1 / (layer.life * 60), // approx decay to finish in life
                color: layer.color,
                lineWidth: layer.lineWidth || 6
            });
        }
        else if (layer.type === 'lightning') {
            for (let i = 0; i < layer.count; i++) {
                this.particles.push({
                    type: 'bolt',
                    segments: [
                        { x: x, y: y },
                        { x: x + (Math.random() - 0.5) * layer.spread, y: y + (Math.random() - 0.5) * layer.spread }
                    ],
                    life: layer.life,
                    decay: 0.08,
                    color: layer.color,
                    width: layer.width
                });
            }
        }
        else if (layer.type === 'text') {
            this.spawnText(x + (layer.offset?.x || 0), y + (layer.offset?.y || 0), layer.text, layer.color);
        }
    }

    // ==========================================
    // LEGACY ADAPTERS (For Backward Compatibility)
    // ==========================================

    spawn(x, y, color, count) {
        // Primitive spawner kept for simple needs
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y, color,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1.0, decay: 0.05, size: 3, type: 'dot'
            });
        }
    }

    spawnExplosion(x, y) { this.spawnEffect('explosion', x, y); }
    spawnWallImpact(x, y) { this.spawnEffect('wallImpact', x, y); }
    spawnQuincyArrow(x, y) { this.spawnEffect('quincyArrow', x, y); }
    spawnHirenkyaku(x, y) { this.spawnEffect('hirenkyaku', x, y); }
    spawnLichtRegen(x, y) { this.spawnEffect('lichtRegen', x, y); }
    spawnZoltraakImpact(x, y) { this.spawnEffect('zoltraakImpact', x, y); }
    spawnBlackFlash(x, y) { this.spawnEffect('blackFlash', x, y); }
    spawnSuperBlackFlash(x, y) { this.spawnEffect('superBlackFlash', x, y); }


    updateAndDraw(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= p.decay;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }

            if (p.type === 'text') {
                p.x += p.vx; p.y += p.vy;
                ctx.save(); ctx.globalAlpha = p.life;
                ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
                ctx.lineWidth = 2; ctx.strokeStyle = "black"; ctx.strokeText(p.text, p.x, p.y);
                ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
                ctx.restore();
            }
            else if (p.type === 'slash') {
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.lineCap = 'round';
                ctx.globalCompositeOperation = 'lighter';

                // Layer 1: Wide Outer Glow
                ctx.strokeStyle = p.color;
                ctx.lineWidth = (p.width || 40) * 1.5 * p.life;
                ctx.globalAlpha = p.life * 0.3;
                ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();

                // Layer 2: Main Slash
                ctx.lineWidth = (p.width || 40) * p.life;
                ctx.globalAlpha = p.life * 0.7;
                ctx.stroke();

                // Layer 3: Sharp White Core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.globalAlpha = p.life;
                ctx.stroke();

                ctx.restore();
            }
            else if (p.type === 'beam') {
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.lineCap = 'round';

                // Use 'lighter' for a natural additive glow effect (ZERO blur cost)
                ctx.globalCompositeOperation = 'lighter';

                // Layer 1: Wide faint halo (The Bloom)
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.width * 2.5;
                ctx.globalAlpha = p.life * 0.15;
                ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();

                // Layer 2: Medium glow (The Plasma)
                ctx.lineWidth = p.width * 1.5;
                ctx.globalAlpha = p.life * 0.4;
                ctx.stroke();

                // Layer 3: Solid blue core
                ctx.lineWidth = p.width;
                ctx.globalAlpha = p.life;
                ctx.stroke();

                // Layer 4: White hot center (Lore accurate)
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = p.width * 0.4;
                ctx.stroke();

                ctx.restore();
            }
            else if (p.type === 'bolt') {
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.globalCompositeOperation = 'lighter';

                // Layer 1: Outer Lightning Glow
                ctx.strokeStyle = p.color;
                ctx.lineWidth = (p.width || 5) * 2;
                ctx.globalAlpha = p.life * 0.4;
                ctx.beginPath();
                if (p.segments.length > 0) {
                    ctx.moveTo(p.segments[0].x, p.segments[0].y);
                    for (let j = 1; j < p.segments.length; j++) {
                        ctx.lineTo(p.segments[j].x, p.segments[j].y);
                    }
                }
                ctx.stroke();

                // Layer 2: Sharp Core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = p.life;
                ctx.stroke();

                ctx.restore();
            }
            else if (p.type === 'flame') {
                p.x += p.vx; p.y += p.vy;
                ctx.save(); ctx.globalAlpha = p.life;
                ctx.fillStyle = p.life > 0.5 ? '#ffff00' : '#ff0000';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            else if (p.type === 'shockwave') {
                p.radius += (p.maxRadius - p.radius) * 0.08;
                ctx.save();
                ctx.globalAlpha = p.life * 0.8;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = (p.lineWidth || p.width || 6) * p.life;
                ctx.globalCompositeOperation = 'lighter';

                // Single wide stroke (lighter does the 'glow' work now)
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.stroke();

                // Subtle inner ring
                ctx.lineWidth = 1;
                ctx.globalAlpha *= 0.5;
                ctx.stroke();

                ctx.restore();
            }
            else if (p.type === 'square') {
                p.x += p.vx; p.y += p.vy;
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.life * 5);

                // Optimized Square: Simple fill + small inner white square for "glow" look
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);

                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = p.life * 0.5;
                ctx.fillRect(-p.size / 4, -p.size / 4, p.size / 2, p.size / 2);

                ctx.restore();
            }
            else {
                p.x += p.vx; p.y += p.vy;
                ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    }
}
