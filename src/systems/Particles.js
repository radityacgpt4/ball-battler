/**
 * Particle System
 * Handles all visual effects and particle rendering
 */
import { Physics } from './Physics.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawn(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y, color,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.03,
                size: Math.random() * 3 + 1,
                type: 'dot'
            });
        }
    }

    spawnSlash(x1, y1, x2, y2, color, width = 40) {
        this.particles.push({
            type: 'slash', x1, y1, x2, y2, color,
            life: 1.0, decay: 0.08, width: width
        });
    }

    spawnBeam(x1, y1, x2, y2, color, width = 6) {
        this.particles.push({
            type: 'beam', x1, y1, x2, y2, color,
            life: 1.0, decay: 0.5, width: width // Fast decay for no trails
        });
    }

    spawnText(x, y, text, color) {
        this.particles.push({
            x, y, text, color,
            vx: (Math.random() - 0.5) * 1, vy: -2,
            life: 1.0, decay: 0.01, type: 'text'
        });
    }

    spawnExplosion(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x, y,
                color: Math.random() < 0.5 ? '#ff4400' : '#ffaa00',
                vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                life: 1.0, decay: 0.05, size: Math.random() * 4 + 2, type: 'flame'
            });
        }
    }

    spawnShockwave(x, y, color = '#ffffff') {
        this.particles.push({
            type: 'shockwave',
            x: x, y: y,
            radius: 10,
            maxRadius: 100,
            life: 1.0,
            decay: 0.05,
            color: color
        });
    }

    spawnWallImpact(x, y) {
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x, y,
                color: Math.random() < 0.3 ? '#ffffff' : '#ff4444',
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.5) * 18,
                life: 1.0, decay: 0.03,
                size: Math.random() * 8 + 2,
                type: 'dot'
            });
        }
        this.particles.push({
            type: 'shockwave',
            x: x, y: y,
            radius: 10,
            maxRadius: 150,
            life: 1.0,
            decay: 0.04,
            color: '#ff4444'
        });
    }

    spawnBlackFlash(x, y) {
        // Core Black Hole Distortion
        this.particles.push({
            type: 'shockwave',
            x: x, y: y,
            radius: 5,
            maxRadius: 120,
            life: 1.0,
            decay: 0.05,
            color: '#000000', // Black Core
            lineWidth: 10
        });

        // Red Cursed Energy Sparks
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                type: 'bolt',
                segments: [
                    { x: x, y: y },
                    { x: x + (Math.random() - 0.5) * 100, y: y + (Math.random() - 0.5) * 100 }
                ],
                life: 0.8,
                decay: 0.1,
                color: '#FF0000', // Red Lightning
                width: 3
            });
        }

        // Debris
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x, y,
                color: '#000000',
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                life: 1.0, decay: 0.04,
                size: Math.random() * 6 + 2,
                type: 'dot'
            });
        }
    }

    spawnSuperBlackFlash(x, y) {
        // Massive Distortion Ring
        this.particles.push({
            type: 'shockwave',
            x: x, y: y,
            radius: 5,
            maxRadius: 180,
            life: 1.5,
            decay: 0.03,
            color: '#000000',
            lineWidth: 22
        });

        // Glowing red outer ring
        this.particles.push({
            type: 'shockwave',
            x: x, y: y,
            radius: 10,
            maxRadius: 200,
            life: 1.0,
            decay: 0.05,
            color: '#FF0000',
            lineWidth: 5
        });

        // Thick Red Lightning Bolts
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                type: 'bolt',
                segments: [
                    { x: x, y: y },
                    { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 }
                ],
                life: 1.2,
                decay: 0.05,
                color: '#FF0000',
                width: 5
            });
        }

        // Huge Debris Burst
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x, y,
                color: Math.random() < 0.3 ? '#FF0000' : '#000000',
                vx: (Math.random() - 0.5) * 25,
                vy: (Math.random() - 0.5) * 25,
                life: 1.5, decay: 0.02,
                size: Math.random() * 12 + 4,
                type: 'dot'
            });
        }

        // Screenshake simulated via particles if we had it, but here we just add text
        this.spawnText(x, y - 50, "MAX BLACK FLASH!!", "#FF0000");
    }

    spawnBolt(segments, color, width = 5) {
        if (segments.length < 2) return;

        let jagged = [];
        jagged.push(segments[0]);

        for (let i = 0; i < segments.length - 1; i++) {
            let p1 = segments[i];
            let p2 = segments[i + 1];
            let dist = Physics.dist(p1.x, p1.y, p2.x, p2.y);
            let steps = Math.max(1, Math.floor(dist / 15));
            let dx = (p2.x - p1.x) / steps;
            let dy = (p2.y - p1.y) / steps;
            let perpX = -dy; let perpY = dx;
            let len = Math.hypot(perpX, perpY) || 1;
            perpX /= len; perpY /= len;

            for (let j = 1; j < steps; j++) {
                let jitter = (Math.random() - 0.5) * 15;
                jagged.push({ x: p1.x + dx * j + perpX * jitter, y: p1.y + dy * j + perpY * jitter });
            }
            jagged.push(p2);
        }

        this.particles.push({ type: 'bolt', segments: jagged, life: 1.0, decay: 0.08, color: color, width: width });
    }

        spawnQuincyArrow(x, y) {
        // Blue energy flash
        this.spawn(x, y, '#1E90FF', 8);
        // Sparkles
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                life: 0.6, decay: 0.1,
                size: 2, color: '#00BFFF', type: 'dot'
            });
        }
    }

    spawnHirenkyaku(x, y) {
        // Static/Glitch effect for teleport
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: 0, vy: -1,
                life: 0.4, decay: 0.1,
                size: 2, color: '#ffffff', type: 'dot'
            });
        }
        this.spawn(x, y, '#1E90FF', 8);
    }

    spawnLichtRegen(x, y) {
        // Upward burst indicating arrow rain launch
        for (let i = 0; i < 15; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5);
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * 6,
                vy: Math.sin(angle) * 6,
                life: 0.8, decay: 0.05,
                size: 3, color: '#00BFFF', type: 'dot'
            });
        }
    }

    updateAndDraw(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= p.decay;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }

            if (p.type === 'text') {
                p.x += p.vx; p.y += p.vy;
                ctx.save(); ctx.globalAlpha = p.life;
                ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
                ctx.lineWidth = 3; ctx.strokeStyle = "black"; ctx.strokeText(p.text, p.x, p.y);
                ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
                ctx.restore();
            }
            else if (p.type === 'slash') {
                ctx.save(); ctx.globalAlpha = p.life; ctx.lineCap = 'round';
                ctx.strokeStyle = p.color; ctx.lineWidth = 10 * p.life;
                ctx.shadowBlur = 20; ctx.shadowColor = p.color;
                ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
                ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
                ctx.restore();
            }
            else if (p.type === 'beam') {
                ctx.save(); ctx.globalAlpha = p.life; ctx.lineCap = 'butt';
                ctx.strokeStyle = p.color; ctx.lineWidth = p.width;
                ctx.shadowBlur = 10; ctx.shadowColor = p.color;
                ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();

                // Core
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = p.width / 2; ctx.shadowBlur = 0;
                ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
                ctx.restore();
            }
            else if (p.type === 'bolt') {
                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.width || 5;
                ctx.shadowBlur = 20;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                if (p.segments.length > 0) {
                    ctx.moveTo(p.segments[0].x, p.segments[0].y);
                    for (let j = 1; j < p.segments.length; j++) {
                        ctx.lineTo(p.segments[j].x, p.segments[j].y);
                    }
                }
                ctx.stroke();
                // Inner white core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
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
                p.radius += (p.maxRadius - p.radius) * 0.15;
                ctx.save();
                ctx.globalAlpha = p.life * 0.6;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 6 * p.life;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.stroke();
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
