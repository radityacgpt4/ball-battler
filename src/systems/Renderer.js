/**
 * Renderer System
 * Handles all canvas drawing for fighters and their accessories.
 * Each fighter type has its own draw method registered here.
 */

export class Renderer {
    constructor() {
        // Map of typeKey -> accessory draw function
        this.accessoryRenderers = new Map();
        this.registerDefaults();
    }

    /**
     * Register an accessory renderer for a fighter type
     * @param {string} typeKey - Fighter type (e.g., 'SWORD_MASTER')
     * @param {Function} drawFn - Function(ctx, fighter) to draw accessories
     */
    registerAccessory(typeKey, drawFn) {
        this.accessoryRenderers.set(typeKey, drawFn);
    }

    /**
     * Draw a fighter with all its visual elements
     * @param {CanvasRenderingContext2D} ctx
     * @param {Fighter} fighter
     */
    drawFighter(ctx, fighter) {
        if (fighter.isDead) return;

        ctx.save();
        ctx.translate(fighter.x, fighter.y);

        // Apply evasion transparency
        if (fighter.activeEffects.evasionTimer > 0) {
            ctx.globalAlpha = 0.2;
        }

        // Status effect visuals
        this.drawStatusEffects(ctx, fighter);

        // Save for rotated accessories
        ctx.save();
        ctx.rotate(fighter.angle);

        // Draw type-specific accessories (weapons, shields, etc.)
        const accessoryRenderer = this.accessoryRenderers.get(fighter.typeKey);
        if (accessoryRenderer) {
            accessoryRenderer(ctx, fighter);
        }

        ctx.restore();

        // Draw ability-specific visuals
        this.drawAbilityVisuals(ctx, fighter);

        // Draw main ball body
        this.drawBody(ctx, fighter);

        // Draw direction indicator
        this.drawDirectionIndicator(ctx, fighter);

        // Draw HP text
        this.drawHPText(ctx, fighter);

        ctx.restore();
    }

    /**
     * Draw status effect indicators (stun, slow, knockback)
     */
    drawStatusEffects(ctx, fighter) {
        if (fighter.status.stun > 0) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (fighter.status.slow > 0) {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 2, 0, Math.PI * 2);
            ctx.fill();
        }

        if (fighter.beingPushed) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (fighter.isPushing) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    /**
     * Draw ability-specific visual elements (barriers, shields, etc.)
     */
    drawAbilityVisuals(ctx, fighter) {
        // Ballista Barriers
        if (fighter.ballistaBarriers) {
            this.drawBallistaBarriers(ctx, fighter);
        }

        // Force Field (Cyborg)
        if (fighter.shieldHp > 0) {
            this.drawForceField(ctx, fighter);
        }
    }

    /**
     * Draw the main ball body
     */
    drawBody(ctx, fighter) {
        ctx.fillStyle = fighter.color;

        if (fighter.activeEffects.ultActive) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = fighter.color;
        }

        ctx.beginPath();
        ctx.arc(0, 0, fighter.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    /**
     * Draw direction indicator (small dot)
     */
    drawDirectionIndicator(ctx, fighter) {
        ctx.rotate(fighter.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(fighter.radius / 2, 0, fighter.radius / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(-fighter.angle);
    }

    /**
     * Draw HP text in center
     */
    drawHPText(ctx, fighter) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(Math.ceil(fighter.hp), 0, 1);
        ctx.fillText(Math.ceil(fighter.hp), 0, 1);
    }

    /**
     * Draw Ballista barrier shields
     */
    drawBallistaBarriers(ctx, fighter) {
        const barrierDist = fighter.radius + 3;  // Closer to body like Shieldbearer
        const arcAngle = 1.22;
        const halfArc = arcAngle / 2;

        for (const barrier of fighter.ballistaBarriers) {
            if (barrier.destroyed) continue;

            const hpRatio = barrier.hp / barrier.maxHp;
            const adjustedAngle = barrier.angle + fighter.angle;

            ctx.shadowBlur = 5 + hpRatio * 10;
            ctx.shadowColor = '#8B4513';

            ctx.beginPath();
            ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
            ctx.lineWidth = 12;
            ctx.strokeStyle = `rgba(210, 180, 140, ${0.6 + hpRatio * 0.4})`;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, barrierDist + 3, adjustedAngle - halfArc, adjustedAngle + halfArc);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#8B4513';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, barrierDist + 7, adjustedAngle - halfArc * 0.85, adjustedAngle + halfArc * 0.85);
            ctx.lineWidth = 2;
            ctx.strokeStyle = hpRatio > 0.5 ? '#DAA520' : (hpRatio > 0.25 ? '#FF8C00' : '#FF0000');
            ctx.stroke();

            // Draw HP text (same font size as Cyborg: 12px, no shield icon)
            const textX = Math.cos(adjustedAngle) * (barrierDist + 18);
            const textY = Math.sin(adjustedAngle) * (barrierDist + 18);
            ctx.fillStyle = '#DAA520';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeText(Math.ceil(barrier.hp), textX, textY);
            ctx.fillText(Math.ceil(barrier.hp), textX, textY);

            ctx.shadowBlur = 0;
        }
    }

    /**
     * Draw Cyborg force field
     */
    drawForceField(ctx, fighter) {
        ctx.save();
        ctx.globalAlpha = 0.3 + (fighter.shieldHp / fighter.maxShield) * 0.3;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, fighter.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();
        ctx.restore();

        // Shield HP UI
        ctx.save();
        ctx.fillStyle = "#00ffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.strokeText(`🛡️${Math.ceil(fighter.shieldHp)}`, 0, -fighter.radius - 15);
        ctx.fillText(`🛡️${Math.ceil(fighter.shieldHp)}`, 0, -fighter.radius - 15);
        ctx.restore();
    }

    /**
     * Register default accessory renderers for all fighter types
     */
    registerDefaults() {
        // Sword Master - Sword
        this.registerAccessory('SWORD_MASTER', (ctx, fighter) => {
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(fighter.radius - 5, -4, fighter.skills.atk.range, 8);
        });

        // Soldier - Gun
        this.registerAccessory('SOLDIER', (ctx, fighter) => {
            ctx.fillStyle = '#333';
            ctx.fillRect(fighter.radius - 5, -6, 20, 12);
        });

        // Shieldbearer - Shield
        this.registerAccessory('SHIELDBEARER', (ctx, fighter) => {
            const halfArc = fighter.skills.def.arcAngle / 2;

            if (fighter.wallBounceSpeed > fighter.baseSpeed) {
                ctx.shadowBlur = fighter.wallBounceSpeed * 4;
                ctx.shadowColor = '#8b5cf6';
            }

            if (fighter.ultWallSlamActive) {
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ff4444';
            }

            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 8, -halfArc, halfArc);
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#c4b5fd';
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 8, -halfArc, halfArc);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#8b5cf6';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 12, -halfArc * 0.85, halfArc * 0.85);
            ctx.lineWidth = 2;
            ctx.strokeStyle = fighter.ultWallSlamActive ? '#ff6666' : '#a78bfa';
            ctx.stroke();

            ctx.shadowBlur = 0;
        });

        // Thunder Mage - Orb
        this.registerAccessory('THUNDER_MAGE', (ctx, fighter) => {
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(fighter.radius, 0, 6, 0, Math.PI * 2);
            ctx.fill();
        });

        // Ninja - Kunai holders
        this.registerAccessory('NINJA', (ctx, fighter) => {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-fighter.radius - 10, -5, 15, 4);
            ctx.fillRect(-fighter.radius - 10, 1, 15, 4);
        });

        // Cyborg - Eye + Charging Visual
        this.registerAccessory('CYBORG', (ctx, fighter) => {
            // Charge Visual (Kamehameha charge peak)
            if (fighter.laserState === 'CHARGING') {
                const ratio = fighter.laserChargeRatio || 0;
                ctx.save();
                ctx.fillStyle = `rgba(255, 170, 0, ${0.3 + ratio * 0.4})`;
                ctx.beginPath();
                ctx.ellipse(20, 0, 10 + ratio * 20, 10 + ratio * 10, 0, 0, Math.PI * 2);
                ctx.fill();

                // Add some glow
                ctx.shadowBlur = 10 + ratio * 20;
                ctx.shadowColor = '#ffaa00';
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(fighter.radius, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Sniper - Rifle + Laser Sight
        this.registerAccessory('SNIPER', (ctx, fighter) => {
            // Laser Sight (Rendered in render loop so it's not wiped by update)
            if (fighter.laserDist > 0) {
                ctx.save();
                ctx.strokeStyle = fighter.laserColor || '#ff0000';
                ctx.lineWidth = fighter.activeEffects.ultActive ? 4 : 2;
                ctx.setLineDash([5, 5]);
                ctx.globalAlpha = fighter.activeEffects.ultActive ? 1.0 : 0.6;

                if (fighter.activeEffects.ultActive) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = fighter.laserColor;
                }

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(fighter.laserDist, 0);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#2F4F2F';
            ctx.fillRect(fighter.radius - 5, -3, 35, 6);
            ctx.fillStyle = '#1C1C1C';
            ctx.fillRect(fighter.radius + 25, -4, 8, 8);
        });

        // Axeman - Complex axe (simplified for now)
        this.registerAccessory('AXEMAN', (ctx, fighter) => {
            const handleLength = 48;
            const handleStart = fighter.radius - 5;
            const bladeCenter = handleStart + handleLength - 5;

            // Handle
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(handleStart, -2, handleLength, 4);

            // Top blade
            ctx.beginPath();
            ctx.moveTo(bladeCenter - 2, -4);
            ctx.quadraticCurveTo(bladeCenter - 5, -12, bladeCenter + 8, -18);
            ctx.quadraticCurveTo(bladeCenter + 26, -14, bladeCenter + 24, -5);
            ctx.quadraticCurveTo(bladeCenter + 16, -4, bladeCenter + 2, -4);
            ctx.closePath();
            ctx.fillStyle = '#B0BEC5';
            ctx.fill();

            // Bottom blade
            ctx.beginPath();
            ctx.moveTo(bladeCenter - 2, 4);
            ctx.quadraticCurveTo(bladeCenter - 5, 12, bladeCenter + 8, 18);
            ctx.quadraticCurveTo(bladeCenter + 26, 14, bladeCenter + 24, 5);
            ctx.quadraticCurveTo(bladeCenter + 16, 4, bladeCenter + 2, 4);
            ctx.closePath();
            ctx.fillStyle = '#B0BEC5';
            ctx.fill();

            // Blood effect
            if (fighter.axemanHits > 0) {
                ctx.globalAlpha = 0.6 + (fighter.axemanHits * 0.1);
                ctx.fillStyle = '#8B0000';
                ctx.beginPath();
                ctx.ellipse(bladeCenter + 16, -10, 3, 4, 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
        });

        // Ballista - Crossbow
        this.registerAccessory('BALLISTA', (ctx, fighter) => {
            const bowStart = fighter.radius - 5;

            // Stock
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(bowStart, -4, 35, 8);

            // Arms
            ctx.strokeStyle = '#3E2723';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(bowStart + 30, 0);
            ctx.quadraticCurveTo(bowStart + 35, -25, bowStart + 20, -30);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bowStart + 30, 0);
            ctx.quadraticCurveTo(bowStart + 35, 25, bowStart + 20, 30);
            ctx.stroke();

            // Bowstring
            ctx.strokeStyle = '#D7CCC8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bowStart + 20, -30);
            ctx.lineTo(bowStart + 10, 0);
            ctx.lineTo(bowStart + 20, 30);
            ctx.stroke();

            // Bolt
            ctx.fillStyle = '#4A4A4A';
            ctx.fillRect(bowStart + 8, -2, 28, 4);
            ctx.fillStyle = '#757575';
            ctx.beginPath();
            ctx.moveTo(bowStart + 38, 0);
            ctx.lineTo(bowStart + 32, -4);
            ctx.lineTo(bowStart + 32, 4);
            ctx.closePath();
            ctx.fill();
        });

        // Divine General - Golden 8-Spoke Wheel
        this.registerAccessory('DIVINE_GENERAL', (ctx, fighter) => {
            ctx.save();
            ctx.rotate(-fighter.angle + (fighter.wheelRotation || 0));

            const wheelRadius = fighter.radius + 15;

            ctx.shadowBlur = 12;
            ctx.shadowColor = '#FFD700';

            // Outer Ring
            ctx.beginPath();
            ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#B8860B';
            ctx.stroke();

            // Inner Highlight
            ctx.beginPath();
            ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FFD700';
            ctx.stroke();

            const startR = fighter.radius + 3;
            const endR = fighter.radius + 18;

            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#B8860B';

            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8;
                const sx = Math.cos(angle) * startR;
                const sy = Math.sin(angle) * startR;
                const ex = Math.cos(angle) * endR;
                const ey = Math.sin(angle) * endR;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();

                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(ex, ey, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            if (fighter.hp < fighter.maxHp * 0.5 || fighter.activeEffects.adaptationActivated) {
                ctx.save();
                ctx.rotate(-fighter.angle);
                const stored = fighter.activeEffects.displayStoredDamage || 0;
                const text = `${stored}/15`;
                ctx.fillStyle = "#00BFFF";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2;
                ctx.font = "bold 16px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const textY = -fighter.radius - 40;
                ctx.strokeText(text, 0, textY);
                ctx.fillText(text, 0, textY);
                ctx.restore();
            }
        });

        // Divine Brawler - Fists
        this.registerAccessory('DIVINE_BRAWLER', (ctx, fighter) => {
            const fistSize = 10;
            const fistDist = fighter.radius - 2;
            const separation = 12;

            ctx.fillStyle = fighter.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;

            // Right Fist
            ctx.beginPath();
            ctx.roundRect(fistDist, -separation - fistSize / 2, fistSize + 4, fistSize, 4);
            ctx.fill();
            ctx.stroke();

            // Left Fist
            ctx.beginPath();
            ctx.roundRect(fistDist, separation - fistSize / 2, fistSize + 4, fistSize, 4);
            ctx.fill();
            ctx.stroke();

            // Knuckle highlights for "tech/fighter" look
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(fistDist + 8, -separation, 2, 0, Math.PI * 2);
            ctx.arc(fistDist + 8, separation, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Quincy - Spirit Bow (Energia)
        this.registerAccessory('QUINCY', (ctx, fighter) => {
            const bowDist = fighter.radius + 5;

            ctx.save();

            // Decouple from fighter rotation and aim at target
            ctx.rotate(-fighter.angle);
            const aimAngle = (fighter.quincyTargetAngle !== undefined && fighter.quincyTargetAngle !== null)
                ? fighter.quincyTargetAngle
                : fighter.angle;
            ctx.rotate(aimAngle);

            // Glow effect based on lock progress
            const lockRatio = (fighter.lockProgress || 0) / 100;

            // Main bow arc (translucent blue energy)
            ctx.strokeStyle = '#1E90FF';
            ctx.lineWidth = 3 + lockRatio * 2;
            ctx.shadowBlur = 10 + lockRatio * 15;
            ctx.shadowColor = '#00BFFF';
            ctx.globalAlpha = 0.7 + lockRatio * 0.3;

            // Draw curved bow arms
            ctx.beginPath();
            ctx.arc(bowDist, 0, 22, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.stroke();

            // Inner energy glow
            ctx.strokeStyle = '#87CEEB';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5 + lockRatio * 0.5;
            ctx.beginPath();
            ctx.arc(bowDist, 0, 20, -Math.PI * 0.4, Math.PI * 0.4);
            ctx.stroke();

            // Bowstring (energy thread)
            ctx.strokeStyle = '#B0E0E6';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.8;
            ctx.shadowBlur = 5;

            const topX = bowDist + Math.cos(-Math.PI * 0.45) * 22;
            const topY = Math.sin(-Math.PI * 0.45) * 22;
            const botX = bowDist + Math.cos(Math.PI * 0.45) * 22;
            const botY = Math.sin(Math.PI * 0.45) * 22;

            ctx.beginPath();
            ctx.moveTo(topX, topY);
            ctx.lineTo(bowDist - 8, 0); // Pulled back
            ctx.lineTo(botX, botY);
            ctx.stroke();

            // Charging arrow (visible when locking)
            if (fighter.lockProgress > 20) {
                ctx.fillStyle = `rgba(30, 144, 255, ${lockRatio * 0.8})`;
                ctx.shadowBlur = 20 * lockRatio;
                ctx.shadowColor = '#1E90FF';

                // Arrow shape
                ctx.beginPath();
                ctx.moveTo(bowDist + 15, 0);  // Tip
                ctx.lineTo(bowDist - 5, -3);
                ctx.lineTo(bowDist - 5, 3);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        });
    }
}

// Export singleton
export const renderer = new Renderer();
