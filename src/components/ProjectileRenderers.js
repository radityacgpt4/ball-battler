/**
 * Projectile Renderers
 * Pure rendering components that handle visual representation on the canvas.
 * Extracting monolithic draw() logic from Projectile.js.
 */

export class BaseRenderer {
    draw(ctx, projectile) { }
}

export class GenericRenderer {
    draw(ctx, p) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class MissileRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

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
}

export class QuincyArrowRenderer {
    draw(ctx, p) {
        const z = p.z || 0;

        // --- PREMIUM: Vibrating Spirit Lines (Licht Regen Connection) ---
        // Connect nearby arrows ONLY when LANDED to form a static web
        if (p.isLichtRegen && z <= 0) {
            const others = p.game.projectiles.filter(other =>
                other !== p &&
                other.isLichtRegen &&
                other.active &&
                (other.z === undefined || other.z <= 0) && // Must be landed
                other.owner === p.owner
            );

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // Thinner, sharper bolt look
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#00FFFF'; // Pure Cyan
            ctx.shadowColor = '#00BFFF';
            ctx.shadowBlur = 4;

            others.forEach(other => {
                const myIdx = p.game.projectiles.indexOf(p);
                const otherIdx = p.game.projectiles.indexOf(other);

                // Draw connection only once per pair (prevent double draw)
                // And check distance
                if (myIdx < otherIdx) {
                    const dist = Math.hypot(p.x - other.x, p.y - other.y);
                    const connectionRange = 180; // Increased from 100 to match spread
                    if (dist < connectionRange) { // Connection range
                        ctx.globalAlpha = 0.8 * (1 - Math.pow(dist / connectionRange, 2)); // Use power for slower fade near source, steeper near max

                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);

                        // Jittery thunder zigzag
                        const midX = (p.x + other.x) / 2;
                        const midY = (p.y + other.y) / 2;

                        // Chaotic jitter based on time + index
                        const time = Date.now() * 0.05;
                        const jitterX = Math.sin(time + myIdx * 123) * 2; // Reduced jitter from 5 to 2
                        const jitterY = Math.cos(time + otherIdx * 321) * 2;

                        ctx.lineTo(midX + jitterX, midY + jitterY);
                        ctx.lineTo(other.x, other.y);
                        ctx.stroke();
                    }
                }
            });
            ctx.restore();
        }

        ctx.save();
        // Handle z-height if present
        ctx.translate(p.x, p.y - z);

        // If landed (no z height) and is Licht Regen, plant it vertically
        if (p.isLichtRegen && z <= 0) {
            ctx.rotate(Math.PI / 2);
        } else {
            ctx.rotate(p.angle);
        }

        // 1. Outer Glow (additive blending for laser-like effect)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.isPerfectShot ? '#00BFFF' : '#1E90FF';
        ctx.lineWidth = p.isPerfectShot ? 12 : 8;
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

        // Licht Regen Landing Indicator
        if (p.isLichtRegen && z > 0 && p.destX !== undefined) {
            ctx.save();
            ctx.strokeStyle = 'rgba(30, 144, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.destX, p.destY, 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

export class RubberFistRenderer {
    draw(ctx, p) {
        ctx.save();

        // Calculate Control Point for Curve
        // Midpoint
        const midX = (p.startX + p.x) / 2;
        const midY = (p.startY + p.y) / 2;

        // Vector from Start to End
        const dx = p.x - p.startX;
        const dy = p.y - p.startY;
        const dist = Math.hypot(dx, dy);

        // Perpendicular Vector (normalized)
        // Right-hand normal concept
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);

        // Curve amount based on "curveSide" and distance
        const curveAmt = (p.curveSide || 0) * (dist * 0.2); // Curvature scales with length

        const cpX = midX + nx * curveAmt;
        const cpY = midY + ny * curveAmt;

        // Draw Arm Skin
        ctx.strokeStyle = '#ffccaa';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.startX, p.startY);
        ctx.quadraticCurveTo(cpX, cpY, p.x, p.y);
        ctx.stroke();

        // Draw Inner Muscle/Shadow
        ctx.strokeStyle = '#eebba0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.startX, p.startY);
        ctx.quadraticCurveTo(cpX, cpY, p.x, p.y);
        ctx.stroke();

        // Draw FIST at tip (Local Space transform)
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffccaa';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Knuckles
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(1.5, -1.5 + i * 1.5, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

export class ZoltraakRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // === SEAMLESS LASER BEAM (like Mecha) ===
        // Grows from 0 to maxLength based on distance traveled
        const maxBeamLen = 200;
        const distFromStart = Math.hypot(p.x - p.startX, p.y - p.startY);
        const beamLen = Math.min(maxBeamLen, distFromStart);

        ctx.globalCompositeOperation = 'lighter';

        // 1. Wide Bloom (Magical Cyan Aura) - Slimmer than Mecha
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 12; // Slimmer than Mecha's 16
        ctx.globalAlpha = 0.15;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(-beamLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 2. High-Energy Layer (Light Cyan)
        ctx.strokeStyle = '#87CEEB';
        ctx.lineWidth = 6; // Slimmer than Mecha's 8
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-beamLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 3. Sharp Core (Laser Line)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2; // Slimmer than Mecha's 3
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.moveTo(-beamLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 4. Premium: Flight Particle Trail
        if (Math.random() < 0.6 && beamLen > 5) {
            const trailX = -beamLen * (0.3 + Math.random() * 0.6);
            const trailY = (Math.random() - 0.5) * 3;

            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#E0FFFF';
            ctx.beginPath();
            ctx.arc(trailX, trailY, 1 + Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

export class GrenadeRenderer {
    draw(ctx, p) {
        // Hit indicator
        if (p.z > 0 && p.destX !== undefined) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 50, 50, 0.15)';
            ctx.beginPath();
            ctx.arc(p.destX, p.destY, p.explosionRadius, 0, Math.PI * 2);
            ctx.fill();
            // Subtle ring outline
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        // Shadow on ground
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Grenade body (in air)
        const z = p.z || 0;
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(p.x, p.y - z, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Blink light
        if (Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(p.x, p.y - z, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

}

export class KunaiRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Draw Kunai (Diamond Shape)
        ctx.fillStyle = p.isEmbedded ? '#b8860b' : '#ffd700';
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
}

export class ClaymoreRenderer {
    draw(ctx, p) {
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        // Blink light
        if (Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Range indicator
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.stroke();
    }
}

export class GintoTrapRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);

        // 1. The Quincy Zeichen (Magic Seal on ground)
        // Slowly rotate the seal
        ctx.rotate(Date.now() * 0.002);

        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Draw 5-pointed Quincy Star (The Trap Radius)
        ctx.beginPath();
        const r = p.radius * 1.8;
        for (let i = 0; i < 5; i++) {
            // Outer points
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            // Inner connecting lines
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
        ctx.roundRect(-3, -8, 6, 16, 3);
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
}

export class SniperRenderer {
    draw(ctx, p) {
        if (p.isSniperUltShot) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);

            // 1. Energy Shockwave Rings
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
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-25, -1.5, 50, 3);

            // 3. Tip Flash
            ctx.fillStyle = '#E0FFFF';
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(25, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } else {
            // Standard Sniper Shot
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);

            const bulletColor = p.isUnblockable ? '#00ff00' : '#ff0000';
            // 2. Motion Trail
            const trailGrad = ctx.createLinearGradient(-30, 0, 10, 0);
            trailGrad.addColorStop(0, 'transparent');
            trailGrad.addColorStop(1, bulletColor);
            ctx.fillStyle = trailGrad;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-45, -1.5, 45, 3);

            // 3. Bullet Shape
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = p.isUnblockable ? '#00ff88' : '#ff4444';
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.quadraticCurveTo(8, -3, 0, -3);
            ctx.lineTo(-12, -3);
            ctx.lineTo(-12, 3);
            ctx.lineTo(0, 3);
            ctx.quadraticCurveTo(8, 3, 12, 0);
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
    }
}

export class BallistaBoltRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Scale down by 20% (0.8x original size)
        const scale = 0.8;

        // Arrow shaft
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-20 * scale, -2 * scale, 35 * scale, 4 * scale);

        // Arrow head - Silver metallic tip with gradient
        const tipGrad = ctx.createLinearGradient(8 * scale, -6 * scale, 18 * scale, 0);
        tipGrad.addColorStop(0, '#888888');
        tipGrad.addColorStop(0.5, '#E8E8E8'); // Bright silver
        tipGrad.addColorStop(1, '#C0C0C0'); // Silver
        ctx.fillStyle = p.isUltBolt ? '#FFD700' : tipGrad;
        ctx.beginPath();
        ctx.moveTo(18 * scale, 0);
        ctx.lineTo(8 * scale, -6 * scale);
        ctx.lineTo(10 * scale, 0);
        ctx.lineTo(8 * scale, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Metallic edge highlight
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(18 * scale, 0);
        ctx.lineTo(8 * scale, -6 * scale);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Silver edge outline
        ctx.strokeStyle = '#A0A0A0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(18 * scale, 0);
        ctx.lineTo(8 * scale, 6 * scale);
        ctx.stroke();

        // Fletching
        ctx.fillStyle = p.isUltBolt ? '#8B0000' : '#2E7D32';
        ctx.beginPath();
        ctx.moveTo(-15 * scale, -2 * scale);
        ctx.lineTo(-22 * scale, -8 * scale);
        ctx.lineTo(-18 * scale, -2 * scale);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15 * scale, 2 * scale);
        ctx.lineTo(-22 * scale, 8 * scale);
        ctx.lineTo(-18 * scale, 2 * scale);
        ctx.fill();

        ctx.restore();
    }
}

// Tower Defensive Bolt - 50% smaller with bronze tip
export class TowerBoltRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Scale down to 0.65x original size (slightly smaller than Ballista bolt's 0.8x)
        const scale = 0.65;

        // Arrow shaft - darker wood
        ctx.fillStyle = '#4A3728';
        ctx.fillRect(-20 * scale, -2 * scale, 35 * scale, 4 * scale);

        // Arrow head - Bronze metallic tip with gradient
        const tipGrad = ctx.createLinearGradient(8 * scale, -6 * scale, 18 * scale, 0);
        tipGrad.addColorStop(0, '#8B5A2B'); // Dark bronze
        tipGrad.addColorStop(0.4, '#CD853F'); // Peru/mid bronze
        tipGrad.addColorStop(0.7, '#D4A574'); // Light bronze highlight
        tipGrad.addColorStop(1, '#CD7F32'); // Bronze
        ctx.fillStyle = tipGrad;
        ctx.beginPath();
        ctx.moveTo(18 * scale, 0);
        ctx.lineTo(8 * scale, -6 * scale);
        ctx.lineTo(10 * scale, 0);
        ctx.lineTo(8 * scale, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Bronze edge highlight
        ctx.strokeStyle = '#DAA520'; // Goldenrod highlight
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(18 * scale, 0);
        ctx.lineTo(8 * scale, -6 * scale);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Bronze edge outline
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(18 * scale, 0);
        ctx.lineTo(8 * scale, 6 * scale);
        ctx.stroke();

        // Fletching - smaller, earthy brown
        ctx.fillStyle = '#6B4423';
        ctx.beginPath();
        ctx.moveTo(-15 * scale, -2 * scale);
        ctx.lineTo(-22 * scale, -8 * scale);
        ctx.lineTo(-18 * scale, -2 * scale);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15 * scale, 2 * scale);
        ctx.lineTo(-22 * scale, 8 * scale);
        ctx.lineTo(-18 * scale, 2 * scale);
        ctx.fill();

        ctx.restore();
    }
}

export class WorldSlashRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        const slashWidth = p.radius || 40;

        // Main slash crescent
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';

        ctx.beginPath();
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
    }
}

export class MechaBeamRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // === GROWING LASER BEAM ===
        // Grows from 0 to 300px based on distance traveled
        const maxBeamLen = 300;
        const distFromStart = Math.hypot(p.x - p.startX, p.y - p.startY);
        const beamLen = Math.min(maxBeamLen, distFromStart);

        ctx.globalCompositeOperation = 'lighter';

        // 1. Wide Bloom (Golden Aura)
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 16;
        ctx.globalAlpha = 0.15;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(-beamLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 2. High-Energy Layer (Yellow)
        ctx.strokeStyle = '#FFFFBB';
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-beamLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 3. Sharp Core (Laser Line)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.moveTo(-beamLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.restore();
    }
}

export class GojoRedRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);

        const time = Date.now();

        // Pulsing Effect
        const pulseScale = 1 + Math.sin(time * 0.015) * 0.15;
        const pulseAlpha = 0.6 + Math.sin(time * 0.02) * 0.2;

        // === 1. OUTER REPULSIVE FORCE RINGS (Animated) ===
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Expanding ring 1 (Reduced from 2.5 to 2.0)
        const ring1Radius = p.radius * 2.0 + (time % 600) / 600 * p.radius * 0.8;
        const ring1Alpha = 0.25 - (time % 600) / 600 * 0.25;
        ctx.globalAlpha = ring1Alpha;
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, ring1Radius, 0, Math.PI * 2);
        ctx.stroke();

        // Expanding ring 2 (offset timing, reduced)
        const ring2Radius = p.radius * 2.0 + ((time + 300) % 600) / 600 * p.radius * 0.8;
        const ring2Alpha = 0.25 - ((time + 300) % 600) / 600 * 0.25;
        ctx.globalAlpha = ring2Alpha;
        ctx.beginPath();
        ctx.arc(0, 0, ring2Radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // === 2. OUTER AURA GLOW ===
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.2;
        const auraGradient = ctx.createRadialGradient(0, 0, p.radius, 0, 0, p.radius * 2.0);
        auraGradient.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
        auraGradient.addColorStop(0.5, 'rgba(220, 20, 60, 0.3)');
        auraGradient.addColorStop(1, 'rgba(139, 0, 0, 0)');
        ctx.fillStyle = auraGradient;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 2.0 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        // === 3. ROTATING ENERGY LINES ===
        ctx.save();
        ctx.rotate(time * 0.003);
        ctx.strokeStyle = '#FF6666';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * p.radius * 1.3, Math.sin(angle) * p.radius * 1.3);
            ctx.lineTo(Math.cos(angle) * p.radius * 1.6, Math.sin(angle) * p.radius * 1.6);
            ctx.stroke();
        }
        ctx.restore();

        // === 4. STATIC RED RING ===
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = pulseAlpha * 0.6;
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.3 * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        // === 5. CORE ORB (Radial Gradient) ===
        ctx.globalAlpha = 1.0;
        const coreGradient = ctx.createRadialGradient(
            -p.radius * 0.2, -p.radius * 0.2, 0,
            0, 0, p.radius * pulseScale
        );
        coreGradient.addColorStop(0, '#FF4444');
        coreGradient.addColorStop(0.5, '#CC0000');
        coreGradient.addColorStop(1, '#660000');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        // === 6. CORE EDGE HIGHLIGHT ===
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        // === 7. INNER SPECULARITY (3D Effect) ===
        ctx.globalAlpha = 0.9;
        const specGradient = ctx.createRadialGradient(
            -p.radius * 0.3, -p.radius * 0.3, 0,
            -p.radius * 0.3, -p.radius * 0.3, p.radius * 0.5
        );
        specGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        specGradient.addColorStop(0.5, 'rgba(255, 200, 200, 0.4)');
        specGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
        ctx.fillStyle = specGradient;
        ctx.beginPath();
        ctx.arc(-p.radius * 0.25, -p.radius * 0.25, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // === 8. INNER ENERGY CORE ===
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.3 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
// =============================================================================
// ICHIGO - Getsuga Tenshou (Crescent Moon Fang)
// =============================================================================
export class GetsugaTenshouRenderer {
    constructor(isBankai = false) {
        this.isBankai = isBankai;
    }

    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Modeled after WorldSlash curvature but with Ichigo layers
        // Using "crescentHeight" as the span (like WorldSlash's slashWidth)
        const span = 60;
        const bulge = span * 1; // Matching WorldSlash control point ratio
        const thickness = 14; // Blade thickness

        // Determine colors based on Bankai state
        const isBankai = p.isBankaiGetsuga || this.isBankai;
        const primaryColor = isBankai ? '#1a1a2e' : '#1E90FF'; // Black or Blue
        const secondaryColor = isBankai ? '#4a0080' : '#00BFFF'; // Purple accent or Cyan
        const coreColor = isBankai ? '#8B00FF' : '#E0FFFF'; // Violet or Light Cyan
        const glowColor = isBankai ? '#9400D3' : '#00BFFF'; // Dark Violet or Deep Sky Blue

        // 1. Phatom Trail (Additional Visual Flare)
        const time = Date.now() * 0.01;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.2 + Math.sin(time) * 0.1;
        ctx.translate(-15, 0); // Shadow slightly behind
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -span * 0.8);
        ctx.quadraticCurveTo(bulge * 0.8, 0, 0, span * 0.8);
        ctx.stroke();
        ctx.restore();

        // 2. Outer Glow (Additive blending for energy effect)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, -span);
        ctx.quadraticCurveTo(bulge, 0, 0, span);
        ctx.stroke();
        ctx.restore();

        // 3. Main Crescent Body (Energy Wave)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        // Leading Edge
        ctx.moveTo(0, -span);
        ctx.quadraticCurveTo(bulge, 0, 0, span);
        // Trailing Edge (Closed shape using thickness)
        ctx.lineTo(-thickness * 0.5, span * 0.9);
        ctx.quadraticCurveTo(bulge - thickness, 0, -thickness * 0.5, -span * 0.9);
        ctx.closePath();
        ctx.fill();

        // 4. Secondary Layer (Energy highlight)
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.moveTo(-thickness * 0.2, -span * 0.8);
        ctx.quadraticCurveTo(bulge - thickness * 0.4, 0, -thickness * 0.2, span * 0.8);
        ctx.quadraticCurveTo(bulge - thickness * 0.8, 0, -thickness * 0.2, -span * 0.8);
        ctx.fill();

        // 5. Core (Brightest center)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.moveTo(0, -span * 0.5);
        ctx.quadraticCurveTo(bulge * 0.6, 0, 0, span * 0.5);
        ctx.quadraticCurveTo(bulge * 0.4, 0, 0, -span * 0.5);
        ctx.fill();

        // 6. Edge highlight (Sharp white leading edge)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(0, -span * 0.95);
        ctx.quadraticCurveTo(bulge * 0.95, 0, 0, span * 0.95);
        ctx.stroke();

        // 7. Energy Crackle (Additional Visual Flare)
        if (Math.random() < 0.4) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const startY = (Math.random() - 0.5) * span;
            ctx.moveTo(bulge * 0.5, startY);
            ctx.lineTo(bulge * 0.5 + (Math.random() - 0.5) * 10, startY + (Math.random() - 0.5) * 10);
            ctx.stroke();
            ctx.restore();
        }

        // 8. Energy trail particles
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glowColor;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 4; i++) {
            const trailX = -i * 12 - Math.random() * 5;
            const trailY = (Math.random() - 0.5) * span * 0.8;
            const trailSize = 1 + Math.random() * 3;
            ctx.beginPath();
            ctx.arc(trailX, trailY, trailSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}


export class BlueOrbRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Date.now() * 0.005); // Rotate slowly

        // 1. Attraction Field (Faint)
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 100, 0, Math.PI * 2); // Effect Radius Visual
        ctx.stroke();

        // 2. Swirling Matter
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#1E90FF';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const startIdx = (Date.now() / 200 + i * 2) % (Math.PI * 2);
            ctx.arc(0, 0, 15 + i * 5, startIdx, startIdx + Math.PI);
            ctx.stroke();
        }

        // 3. Core
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#00BFFF'; // Deep Sky Blue
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // 4. Inner Bright Core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class RedOrbRenderer {
    draw(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);

        // Pulsing
        const pulse = 1 + Math.sin(Date.now() * 0.02) * 0.2;
        ctx.scale(pulse, pulse);

        // 1. Crimson Aura
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // 2. Black Core (Menacing)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // 3. Red Sparks/Cracks
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
        ctx.moveTo(4, -4); ctx.lineTo(-4, 4);
        ctx.stroke();

        ctx.restore();
    }
}

// =============================================================================
// SUPER SOLDIER RENDERERS
// =============================================================================
export class ShieldRenderer {
    draw(ctx, p) {
        const r = p.radius || 9;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin || 0);

        // Concentric rings (red / white / red / blue center)
        const rings = ['#c0392b', '#f5f5f5', '#c0392b', '#2e5cb8'];
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, r * (1 - i * 0.22), 0, Math.PI * 2);
            ctx.fillStyle = rings[i];
            ctx.fill();
        }

        // White star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
            const outer = r * 0.34, inner = r * 0.16;
            ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
            const a2 = a + Math.PI / 5;
            ctx.lineTo(Math.cos(a2) * inner, Math.sin(a2) * inner);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

export class MjolnirRenderer {
    draw(ctx, p) {
        const r = p.radius || 10;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin || 0);

        // Handle
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = Math.max(2, r * 0.28);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r * 1.7);
        ctx.stroke();

        // Head
        ctx.fillStyle = '#9aa4b2';
        ctx.fillRect(-r * 0.95, -r * 0.7, r * 1.9, r * 1.0);
        ctx.strokeStyle = '#5b6470';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r * 0.95, -r * 0.7, r * 1.9, r * 1.0);

        // Enchanted glow band
        ctx.fillStyle = 'rgba(125,184,255,0.55)';
        ctx.fillRect(-r * 0.95, -r * 0.7, r * 1.9, r * 0.22);

        ctx.restore();
    }
}
