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
        ctx.save();
        // Handle z-height if present
        const z = p.z || 0;
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

        // Arrow shaft
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-20, -2, 35, 4);

        // Arrow head
        ctx.fillStyle = p.isUltBolt ? '#FFD700' : '#4A4A4A';
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

        // Fletching
        ctx.fillStyle = p.isUltBolt ? '#8B0000' : '#2E7D32';
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
