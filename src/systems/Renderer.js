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

        // Apply evasion transparency ("Ghost" effect)
        if (fighter.activeEffects.evasionTimer > 0) {
            ctx.globalAlpha = 0.5; // 50% opacity as requested
        }

        // Status effect visuals
        this.drawStatusEffects(ctx, fighter);

        // Team indicator (colored ring around fighter)
        this.drawTeamIndicator(ctx, fighter);

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

        // Burn stack indicator (independent of rotation, like Divine General)
        if (fighter.status.burn > 0 && fighter.status.burnStacks > 0) {
            ctx.save();
            const text = `🔥x${fighter.status.burnStacks}`;
            ctx.fillStyle = "#FF4500";
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

        ctx.restore();
    }

    /**
     * Draw status effect indicators (stun, slow, knockback, burn)
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

        // BURN effect - orange/red pulsing glow and stack indicator
        if (fighter.status.burn > 0 && fighter.status.burnStacks > 0) {
            const pulse = (Math.sin(Date.now() / 150) + 1) * 0.3;
            ctx.save();
            ctx.globalAlpha = 0.4 + pulse;
            ctx.strokeStyle = '#FF4500';
            ctx.lineWidth = 2 + fighter.status.burnStacks;

            // Optimized Burn Glow (Zero-Blur)
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineWidth = 6 + fighter.status.burnStacks;
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 4, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
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
     * Draw team indicator (colored ring to identify teams)
     */
    drawTeamIndicator(ctx, fighter) {
        const teamColor = fighter.id === 1 ? '#4fc3f7' : '#ff6b6b';

        // Draw team badge
        ctx.save();
        ctx.fillStyle = teamColor;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Position badge above the fighter
        const badgeY = -fighter.radius - 18;

        // Background for badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const badgeText = `T${fighter.id}`;
        const textWidth = ctx.measureText(badgeText).width;
        ctx.fillRect(-textWidth / 2 - 4, badgeY - 8, textWidth + 8, 16);

        // Badge text
        ctx.fillStyle = teamColor;
        ctx.fillText(badgeText, 0, badgeY);
        ctx.restore();
    }

    /**
     * Draw ability-specific visual elements (barriers, shields, etc.)
     */
    drawAbilityVisuals(ctx, fighter) {
        // OCP: Let abilities handle their own visual effects
        Object.values(fighter.abilities).forEach(ability => {
            if (ability && ability.draw) {
                ability.draw(fighter, ctx);
            }
        });
    }

    /**
     * Draw the main ball body
     */
    drawBody(ctx, fighter) {
        ctx.fillStyle = fighter.color;

        if (fighter.activeEffects.ultActive && !(fighter.typeKey === 'SOUL_REAPER' && fighter.activeEffects.bankaiActive)) {
            // Optimized Ult Aura (Zero-Blur)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = fighter.color;
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(0, 0, fighter.radius, 0, Math.PI * 2);
        ctx.fill();
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
     * Register default accessory renderers for all fighter types
     */
    registerDefaults() {
        // Sword Master - Premium Katana Design
        this.registerAccessory('SWORD_MASTER', (ctx, fighter) => {
            const range = fighter.skills.atk.range;
            const hiltLen = 15;
            const guardSize = 10;
            const bladeLen = range - 5; // Adjust so total reach remains the same

            ctx.save();

            // 1. Hilt (Tsuka) - Traditional wrapped look
            ctx.fillStyle = '#1a1a1a'; // Black wrap
            ctx.fillRect(fighter.radius - hiltLen, -3, hiltLen, 6);

            // Hilt details (Diamond wrap pattern)
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            for (let i = 0; i < hiltLen; i += 4) {
                ctx.beginPath();
                ctx.moveTo(fighter.radius - hiltLen + i, -3);
                ctx.lineTo(fighter.radius - hiltLen + i + 2, 3);
                ctx.stroke();
            }

            // 2. Guard (Tsuba)
            ctx.fillStyle = '#FFD700'; // Gold-ish
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(fighter.radius - 2, -guardSize / 2, 4, guardSize, 2);
            ctx.fill();
            ctx.stroke();

            // 3. Blade (Nagasa) - Curved & Sharp
            ctx.beginPath();
            ctx.moveTo(fighter.radius + 2, -2.5); // Back edge start

            // Curve the blade slightly
            ctx.quadraticCurveTo(
                fighter.radius + bladeLen / 2, -3.5, // Control point (slight curve up)
                fighter.radius + bladeLen, -1.5     // Tip (back edge side)
            );

            // Tip shape
            ctx.lineTo(fighter.radius + bladeLen + 4, 1); // Sharp tip point

            // Cutting edge (Ha)
            ctx.quadraticCurveTo(
                fighter.radius + bladeLen / 2, 3.5,
                fighter.radius + 2, 2.5
            );
            ctx.closePath();

            // Blade Metal Gradient
            const gradient = ctx.createLinearGradient(0, -3, 0, 3);
            gradient.addColorStop(0, '#B0BEC5'); // Steel Back
            gradient.addColorStop(0.5, '#ECEFF1'); // Middle
            gradient.addColorStop(1, '#90A4AE'); // Edge Side
            ctx.fillStyle = gradient;
            ctx.fill();

            // 4. Premium Details: Hamon & Edge Highlight
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // Edge Highlight (Super Sharp Look)
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.moveTo(fighter.radius + 10, 2); // Start after guard
            ctx.quadraticCurveTo(
                fighter.radius + bladeLen / 2, 2.8,
                fighter.radius + bladeLen + 2.5, 0.5
            );
            ctx.stroke();

            // Hamon (Temper Line - Wavy pattern)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.moveTo(fighter.radius + 5, 0.5);
            for (let x = 5; x < bladeLen; x += 5) {
                ctx.lineTo(fighter.radius + x, 0.5 + Math.sin(x * 0.5) * 1);
            }
            ctx.stroke();

            ctx.restore();

            ctx.restore();
        });

        // Soldier - Gun
        this.registerAccessory('SOLDIER', (ctx, fighter) => {
            ctx.fillStyle = '#333';
            ctx.fillRect(fighter.radius - 5, -6, 20, 12);
        });

        // Shieldbearer - Shield
        this.registerAccessory('SHIELDBEARER', (ctx, fighter) => {
            const halfArc = fighter.skills.def.arcAngle / 2;

            if (fighter.wallBounceSpeed > fighter.baseSpeed || fighter.ultWallSlamActive) {
                // Optimized Bounce Glow (Zero-Blur)
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = fighter.ultWallSlamActive ? '#ff4444' : '#8b5cf6';
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, fighter.radius + 8, -halfArc, halfArc);
                ctx.stroke();
                ctx.restore();
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

            // End shieldbearer draw
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

                // Add some glow (Zero-Blur)
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 4 + ratio * 8;
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
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.strokeStyle = fighter.laserColor;
                    ctx.lineWidth = 6;
                    ctx.globalAlpha = 0.4;
                    ctx.beginPath();
                    ctx.moveTo(0, 0); ctx.lineTo(fighter.laserDist, 0);
                    ctx.stroke();
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

        // Ballista - Premium Compact Crossbow
        this.registerAccessory('BALLISTA', (ctx, fighter) => {
            const bowStart = fighter.radius - 3;

            // Stock - Slimmer, darker wood with grain
            const stockGrad = ctx.createLinearGradient(bowStart, -3, bowStart + 28, 3);
            stockGrad.addColorStop(0, '#3E2723');
            stockGrad.addColorStop(0.5, '#5D4037');
            stockGrad.addColorStop(1, '#4E342E');
            ctx.fillStyle = stockGrad;
            ctx.beginPath();
            ctx.roundRect(bowStart, -3, 28, 6, 2);
            ctx.fill();

            // Stock edge highlight
            ctx.strokeStyle = '#8D6E63';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bowStart, -3);
            ctx.lineTo(bowStart + 28, -3);
            ctx.stroke();

            // Metallic trigger guard
            ctx.strokeStyle = '#78909C';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bowStart + 10, 4, 3, 0, Math.PI);
            ctx.stroke();

            // Arms - More elegant curved limbs
            const armGrad = ctx.createLinearGradient(bowStart + 20, -22, bowStart + 24, 0);
            armGrad.addColorStop(0, '#2E2017');
            armGrad.addColorStop(0.5, '#4E342E');
            armGrad.addColorStop(1, '#3E2723');
            ctx.strokeStyle = armGrad;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            // Top arm
            ctx.beginPath();
            ctx.moveTo(bowStart + 24, 0);
            ctx.quadraticCurveTo(bowStart + 28, -18, bowStart + 16, -22);
            ctx.stroke();

            // Bottom arm
            ctx.beginPath();
            ctx.moveTo(bowStart + 24, 0);
            ctx.quadraticCurveTo(bowStart + 28, 18, bowStart + 16, 22);
            ctx.stroke();

            // Arm tips - metallic caps
            ctx.fillStyle = '#90A4AE';
            ctx.beginPath();
            ctx.arc(bowStart + 16, -22, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bowStart + 16, 22, 2, 0, Math.PI * 2);
            ctx.fill();

            // Bowstring - elegant thin line
            ctx.strokeStyle = '#BCAAA4';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(bowStart + 16, -22);
            ctx.lineTo(bowStart + 8, 0);
            ctx.lineTo(bowStart + 16, 22);
            ctx.stroke();

            // Nocked bolt - compact with silver tip
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(bowStart + 6, -1.5, 22, 3);

            // Bolt silver tip
            const tipGrad = ctx.createLinearGradient(bowStart + 28, -3, bowStart + 32, 0);
            tipGrad.addColorStop(0, '#888888');
            tipGrad.addColorStop(0.5, '#E8E8E8');
            tipGrad.addColorStop(1, '#B0B0B0');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.moveTo(bowStart + 32, 0);
            ctx.lineTo(bowStart + 26, -3);
            ctx.lineTo(bowStart + 26, 3);
            ctx.closePath();
            ctx.fill();

            // Central mechanism - ornate gold accent
            ctx.fillStyle = '#B8860B';
            ctx.beginPath();
            ctx.arc(bowStart + 24, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        });

        // Divine General - Golden 8-Spoke Wheel
        this.registerAccessory('DIVINE_GENERAL', (ctx, fighter) => {
            ctx.save();
            ctx.rotate(-fighter.angle + (fighter.wheelRotation || 0));

            const wheelRadius = fighter.radius + 15;

            // Optimized Wheel Glow (Zero-Blur)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 6; // Reduced from 10
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Outer Ring
            ctx.beginPath();
            ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
            ctx.lineWidth = 3; // Reduced from 6
            ctx.strokeStyle = '#B8860B';
            ctx.stroke();

            // Inner Highlight (Orb)
            ctx.beginPath();
            ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
            ctx.lineWidth = 2; // Reduced from 3
            ctx.strokeStyle = '#FFD700';
            ctx.stroke();

            const startR = fighter.radius + 3;
            const endR = fighter.radius + 18;

            ctx.lineWidth = 2; // Reduced from 4
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

                // Orb size
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(ex, ey, 4, 0, Math.PI * 2); // Restored to 3
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
            const isFocusActive = fighter.activeEffects && fighter.activeEffects.focusActive;

            // ULT Stance Visual - Cursed Energy Aura (when Focus is active)
            if (isFocusActive) {
                ctx.save();
                ctx.rotate(-fighter.angle); // Decouple from fighter rotation

                // Pulsing aura effect
                const pulse = (Math.sin(Date.now() / 150) + 1) * 0.15;

                // Outer cursed energy ring
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#4B0082';
                ctx.lineWidth = 8;
                ctx.globalAlpha = 0.4 + pulse;
                ctx.beginPath();
                ctx.arc(0, 0, fighter.radius + 12, 0, Math.PI * 2);
                ctx.stroke();

                // Inner intense glow
                ctx.strokeStyle = '#8B008B';
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.6 + pulse;
                ctx.beginPath();
                ctx.arc(0, 0, fighter.radius + 8, 0, Math.PI * 2);
                ctx.stroke();

                // "Immovable" indicator text
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#FF00FF';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textY = -fighter.radius - 25;
                ctx.strokeText('FOCUS', 0, textY);
                ctx.fillText('FOCUS', 0, textY);

                ctx.restore();
            }

            ctx.fillStyle = fighter.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;

            // Fist glow when Focus is active
            if (isFocusActive) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = '#4B0082';
                ctx.globalAlpha = 0.5;
                // Right fist glow
                ctx.beginPath();
                ctx.roundRect(fistDist - 2, -separation - fistSize / 2 - 2, fistSize + 8, fistSize + 4, 6);
                ctx.fill();
                // Left fist glow
                ctx.beginPath();
                ctx.roundRect(fistDist - 2, separation - fistSize / 2 - 2, fistSize + 8, fistSize + 4, 6);
                ctx.fill();
                ctx.restore();
            }

            // Right Fist
            ctx.fillStyle = isFocusActive ? '#6B238E' : fighter.color; // Purple when focused
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
            ctx.fillStyle = isFocusActive ? 'rgba(255, 0, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(fistDist + 8, -separation, 2, 0, Math.PI * 2);
            ctx.arc(fistDist + 8, separation, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Quincy - Ginrei Kojaku (Spirit Bow - Anime Accurate)
        this.registerAccessory('QUINCY', (ctx, fighter) => {
            ctx.save();

            // Decouple from fighter rotation and aim at target
            ctx.rotate(-fighter.angle);
            const aimAngle = (fighter.quincyTargetAngle !== undefined && fighter.quincyTargetAngle !== null)
                ? fighter.quincyTargetAngle
                : fighter.angle;
            ctx.rotate(aimAngle);

            // PERSPECTIVE TRANSFORM: Squash X (depth), Scale Y (width)
            // This makes it look like a vertical bow facing the target
            ctx.scale(0.3, 0.9);

            const bowDist = fighter.radius + 75;
            const lockRatio = (fighter.lockProgress || 0) / 100;

            // === GINREI KOJAKU DESIGN ===
            // 1. Concentric Reishi Rings (Background glow)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.15 + lockRatio * 0.15;
            ctx.strokeStyle = '#00BFFF';
            for (let i = 0; i < 3; i++) {
                ctx.lineWidth = 2 - i * 0.5;
                ctx.beginPath();
                ctx.arc(bowDist + 5, 0, 35 + i * 8, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            // 2. Main Bow Arms (Energy Limbs - Flaming Translucent)
            ctx.globalAlpha = 0.85 + lockRatio * 0.15;

            // Outer glow
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#1E90FF';
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(bowDist, -30);
            ctx.quadraticCurveTo(bowDist + 25, -15, bowDist + 30, 0);
            ctx.quadraticCurveTo(bowDist + 25, 15, bowDist, 30);
            ctx.stroke();
            ctx.restore();

            // Main bow shape (curved limbs)
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(bowDist - 5, -32);
            ctx.quadraticCurveTo(bowDist + 28, -18, bowDist + 35, 0);
            ctx.quadraticCurveTo(bowDist + 28, 18, bowDist - 5, 32);
            ctx.stroke();

            // Inner highlight
            ctx.strokeStyle = '#E0FFFF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bowDist - 3, -30);
            ctx.quadraticCurveTo(bowDist + 25, -16, bowDist + 32, 0);
            ctx.quadraticCurveTo(bowDist + 25, 16, bowDist - 3, 30);
            ctx.stroke();

            // 3. Quincy Cross (Center of bow - The Zeichen)
            ctx.save();
            ctx.translate(bowDist - 8, 0);
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#1E90FF';
            ctx.lineWidth = 1;
            // Vertical bar
            ctx.fillRect(-2, -8, 4, 16);
            // Horizontal bar
            ctx.fillRect(-6, -2, 12, 4);
            // Glow
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5;
            ctx.strokeRect(-2, -8, 4, 16);
            ctx.strokeRect(-6, -2, 12, 4);
            ctx.restore();

            // 4. Bowstring (Reishi Thread)
            ctx.strokeStyle = '#B0E0E6';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(bowDist - 5, -32);
            ctx.lineTo(bowDist - 12, 0); // Pulled back
            ctx.lineTo(bowDist - 5, 32);
            ctx.stroke();

            // 5. Nocked Arrow (when charging)
            if (fighter.lockProgress > 15) {
                // Arrow glow
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = '#00BFFF';
                ctx.globalAlpha = lockRatio * 0.6;
                ctx.beginPath();
                ctx.arc(bowDist + 10, 0, 8 + lockRatio * 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Arrow shape (Heilig Pfeil - Sacred Arrow)
                ctx.fillStyle = `rgba(224, 255, 255, ${0.6 + lockRatio * 0.4})`;
                ctx.beginPath();
                ctx.moveTo(bowDist + 25, 0);  // Tip
                ctx.lineTo(bowDist - 10, -4);
                ctx.lineTo(bowDist - 10, 4);
                ctx.closePath();
                ctx.fill();

                // Arrow core
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(bowDist + 22, 0);
                ctx.lineTo(bowDist - 8, -2);
                ctx.lineTo(bowDist - 8, 2);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        });

        // King of Curses - Domain Expansion Visual
        this.registerAccessory('KING_OF_CURSES', (ctx, fighter) => {
            // Domain Expansion Visual (always active)
            if (fighter.domainActive) {
                const radius = fighter.domainRadius || 125;

                ctx.save();

                // Pulsing effect - slowed down from 300 to 600, reduced intensity from 0.15 to 0.1
                const pulse = (Math.sin(Date.now() / 600) + 1) * 0.1;
                ctx.globalAlpha = 0.35 + pulse;

                // Dark semi-transparent red fill
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
                gradient.addColorStop(0, 'rgba(50, 0, 0, 0.4)');
                gradient.addColorStop(0.7, 'rgba(139, 0, 0, 0.3)');
                gradient.addColorStop(1, 'rgba(220, 20, 60, 0.1)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fill();

                // Jagged edge (force-field like)
                ctx.globalAlpha = 0.6 + pulse;
                ctx.strokeStyle = '#DC143C';
                ctx.lineWidth = 3;

                // Optimized Domain Glow (Zero-Blur)
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#DC143C';
                ctx.lineWidth = 8;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                const segmentsGlow = 18; // Simpler glow circle
                for (let i = 0; i <= segmentsGlow; i++) {
                    const angle = (i / segmentsGlow) * Math.PI * 2;
                    const r = radius;
                    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
                ctx.stroke();
                ctx.restore();

                ctx.beginPath();
                const segments = 36;
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    // Jagged variation - reduced from 8 to 3, and slowed down oscillation
                    const jag = Math.sin(i * 3 + Date.now() / 400) * 3;
                    const r = radius + jag;
                    if (i === 0) {
                        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                    } else {
                        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                    }
                }
                ctx.closePath();
                ctx.stroke();

                // Inner dark ring
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
                ctx.stroke();

                ctx.restore();
            }
        });

        // Captain Levi - Twin Blades (Lore Accurate Box Cutter Stance)
        this.registerAccessory('LEVI', (ctx, fighter) => {
            const currentSpeed = Math.hypot(fighter.dx || 0, fighter.dy || 0);
            const isHighSpeed = currentSpeed > 8;

            ctx.save();

            // Blade properties - Lore accurate box cutter shape
            const bladeLength = 35;
            const bladeWidth = 7;
            const handleLength = 14;

            // Helper function to draw a single box-cutter blade
            const drawBlade = (isBackBlade = false) => {
                ctx.save();

                // Mirror the blade vertically so sharp edge is on top
                ctx.scale(1, -1);

                // Box cutter shape: Rectangular with a single angled tip
                // Start from handle
                ctx.fillStyle = '#B0BEC5'; // Steel body
                ctx.strokeStyle = '#455A64';
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(0, -bladeWidth / 2); // Top left (at handle)
                ctx.lineTo(bladeLength, -bladeWidth / 2); // Top edge
                ctx.lineTo(bladeLength + 8, bladeWidth / 2); // Angled tip (Box cutter signature)
                ctx.lineTo(0, bladeWidth / 2); // Bottom edge
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Blade segment lines (box cutter blades are segmented)
                ctx.beginPath();
                ctx.strokeStyle = '#90A4AE';
                ctx.lineWidth = 0.5;
                for (let x = 8; x < bladeLength; x += 6) {
                    ctx.moveTo(x, -bladeWidth / 2);
                    ctx.lineTo(x + 2, bladeWidth / 2);
                }
                ctx.stroke();

                // Handle (Survey Corps trigger handle)
                ctx.fillStyle = '#212121';
                ctx.fillRect(-handleLength, -bladeWidth / 2 - 1, handleLength, bladeWidth + 2);
                // Trigger guard
                ctx.strokeStyle = '#757575';
                ctx.strokeRect(-handleLength, -bladeWidth / 2 - 1, handleLength, bladeWidth + 2);

                // Sharp edge highlight
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(bladeLength, -bladeWidth / 2 + 1);
                ctx.lineTo(bladeLength + 7, bladeWidth / 2 - 1); // Tip edge
                ctx.lineTo(0, bladeWidth / 2 - 1); // Bottom sharp edge
                ctx.stroke();

                ctx.restore();
            };

            // Stance: Vertical (blades pointing up/down)
            const stanceAngle = Math.PI / 3.2;

            const renderStance = () => {
                // Top Blade (pointing upward)
                ctx.save();
                ctx.translate(0, -16); // Centered, sticking up
                ctx.rotate(stanceAngle - Math.PI / 2); // Point upward
                drawBlade();
                ctx.restore();

                // Bottom Blade (pointing downward)
                ctx.save();
                ctx.translate(0, 16); // Centered, sticking down
                ctx.rotate(stanceAngle + Math.PI / 2); // Point downward
                drawBlade();
                ctx.restore();
            };

            // High speed visual: Circular Saw afterimages
            if (isHighSpeed) {
                ctx.globalAlpha = 0.15;
                for (let i = 1; i <= 3; i++) {
                    ctx.save();
                    ctx.rotate(-fighter.rotationSpeed * i * 3);
                    renderStance();
                    ctx.restore();
                }
                ctx.globalAlpha = 1.0;
                // Optimized Glow (Zero-Blur)
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.3;
                renderStance();
            }

            renderStance();

            // End stance draw
            ctx.restore();
        });

        // Mecha - Energy Blade + Counter Protocol Visual
        this.registerAccessory('MECHA', (ctx, fighter) => {
            // === MECHA UNIT DESIGN (Wing Zero inspired) ===
            const time = Date.now();
            const isUlt = fighter.mechaUltActive;

            // 1. Rocket boosters on back (Wing Zero style)
            const boosterAngle = Math.PI; // Directly behind
            const boosterX = Math.cos(boosterAngle) * (fighter.radius - 5);
            const boosterY = Math.sin(boosterAngle) * (fighter.radius - 5);

            // Booster housing (Grey metal)
            ctx.fillStyle = '#4A4A4A';
            ctx.beginPath();
            ctx.ellipse(boosterX, boosterY - 4, 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(boosterX, boosterY + 4, 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();



            // 2. Twin Shoulder Cannons (Only visible during ULT)
            if (isUlt) {
                ctx.fillStyle = '#757575';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;

                // Left shoulder cannon
                ctx.fillRect(5, -18, 25, 6);
                ctx.strokeRect(5, -18, 25, 6);

                // Right shoulder cannon
                ctx.fillRect(5, 12, 25, 6);
                ctx.strokeRect(5, 12, 25, 6);

                // Muzzle glow
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = '#00BFFF';
                ctx.globalAlpha = 0.5 + Math.sin(time * 0.01) * 0.2;
                ctx.beginPath();
                ctx.arc(30, -15, 3, 0, Math.PI * 2);
                ctx.arc(30, 15, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 3. Energy Blade visual (Lightsaber Style)
            const bladeLength = 51.25; // Aligns visual tip with hitbox (52.5 length + 2 offset)
            const startX = fighter.radius + 2;

            // Hilt Glow
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowColor = '#39FF14';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#CCFFCC';
            ctx.beginPath();
            ctx.arc(startX, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Draw Energy Blade (Lightsaber)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';

            // 1. Outer Aura (Neon Green - Thinner & Softer)
            ctx.strokeStyle = '#39FF14';
            ctx.shadowColor = '#39FF14';
            ctx.shadowBlur = 8;        // Reduced from 15
            ctx.lineWidth = 8;         // Reduced from 14
            ctx.globalAlpha = 0.3;     // Slightly lower alpha for softness
            ctx.beginPath();
            ctx.moveTo(startX, 0);
            ctx.lineTo(startX + bladeLength, 0);
            ctx.stroke();
            // 2. Inner Glow (Brighter/Lighter)
            ctx.strokeStyle = '#88FF88';
            ctx.shadowBlur = 4;        // Reduced from 5
            ctx.lineWidth = 5;         // Reduced from 10
            ctx.globalAlpha = 0.5;
            ctx.stroke();
            // 3. Core (Solid White)
            ctx.strokeStyle = '#FFFFFF';
            ctx.shadowBlur = 2;
            ctx.lineWidth = 2.5;       // Reduced from 5 (The actual "beam" width)
            ctx.globalAlpha = 0.9;
            ctx.stroke();

            ctx.restore();

            // OLD LOGIC (Skipped)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // Function to draw the blade shape
            const drawPlasmaBlade = (widthScale, color, alpha, isCore) => {
                ctx.fillStyle = color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(startX, 0); // Center start

                const segments = 20;

                // Top edge
                for (let i = 0; i <= segments; i++) {
                    const ratio = i / segments; // 0 to 1
                    const x = startX + ratio * bladeLength;

                    // Width profile: Thick base -> Needle point
                    // Base thickness is high, tapers quickly then gradually to 0
                    const baseWidth = isCore ? 4 : 10;
                    const taper = Math.pow(1 - ratio, 1.5); // Concave taper for needle point
                    let currentWidth = baseWidth * taper * widthScale;

                    // Jagged effect (Raw, vibrating appearance)
                    // Stronger at base, zero at tip (needle-fine)
                    const jagIntensity = isCore ? 0 : (2.5 * (1 - ratio));
                    const jag = (Math.random() - 0.5) * jagIntensity;
                    const flicker = Math.sin(time * 0.05 + i * 1.5) * jagIntensity;

                    const y = -(currentWidth / 2) + jag + flicker;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }

                ctx.lineTo(startX + bladeLength, 0); // Tip

                // Bottom edge
                for (let i = segments; i >= 0; i--) {
                    const ratio = i / segments;
                    const x = startX + ratio * bladeLength;

                    const baseWidth = isCore ? 4 : 10;
                    const taper = Math.pow(1 - ratio, 1.5);
                    let currentWidth = baseWidth * taper * widthScale;

                    const jagIntensity = isCore ? 0 : (2.5 * (1 - ratio));
                    const jag = (Math.random() - 0.5) * jagIntensity;
                    const flicker = Math.sin(time * 0.05 + i * 1.5 + Math.PI) * jagIntensity; // Opposing flicker

                    const y = (currentWidth / 2) + jag + flicker;
                    ctx.lineTo(x, y);
                }

                ctx.closePath();
                ctx.fill();
            };

            /* // Outer Aura (Neon Green)
            drawPlasmaBlade(1.2, '#39FF14', 0.4, false);

            // Mid glow
            drawPlasmaBlade(0.8, '#AAFF88', 0.6, false);

            // Bright White Core
            drawPlasmaBlade(0.6, '#FFFFFF', 0.9, true);

            */
            ctx.restore();

            // 4. Counter Indicator (If ULT is active)
            if (isUlt) {
                ctx.save();
                ctx.rotate(-fighter.angle);
                const pulseIntensity = Math.sin(time * 0.008) * 0.5 + 0.5;
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#00BFFF';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textY = -fighter.radius - 22;
                ctx.strokeText('TWIN-CANNON', 0, textY);
                ctx.fillText('TWIN-CANNON', 0, textY);
                ctx.restore();
            }
        });

        // Soul Reaper (Ichigo) - Zangetsu / Tensa Zangetsu
        this.registerAccessory('SOUL_REAPER', (ctx, fighter) => {
            const isBankai = fighter.activeEffects && fighter.activeEffects.bankaiActive;

            ctx.save();

            if (isBankai) {
                // ================================================================
                // BANKAI: Tensa Zangetsu - Long Black Katana
                // ================================================================
                const bladeLength = 60; // Same length as Shikai for balance
                const bladeWidth = 4;
                const hiltLen = 15;

                // 1. Hilt (Tsuka) - Black wrapped
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(fighter.radius - hiltLen, -3, hiltLen, 6);

                // Hilt detail (Red under-wrap)
                ctx.fillStyle = '#8B0000';
                for (let i = 0; i < hiltLen; i += 4) {
                    ctx.fillRect(fighter.radius - hiltLen + i + 1, -1, 2, 2);
                }

                // 2. Guard (Tsuba) - Manji shape (simplified as 4 prongs)
                ctx.fillStyle = '#111';
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                // Vertical bar
                ctx.fillRect(fighter.radius - 2, -10, 4, 20);
                // Horizontal bar
                ctx.fillRect(fighter.radius - 6, -3, 12, 6);

                // 3. Blade - Long, thin, pure black
                ctx.beginPath();
                ctx.fillStyle = '#050505'; // Vantablack style
                ctx.strokeStyle = '#333';

                // Katana shape
                ctx.moveTo(fighter.radius + 2, -2);
                ctx.lineTo(fighter.radius + bladeLength - 5, -2); // Spine
                ctx.lineTo(fighter.radius + bladeLength, 0);      // Tip
                ctx.lineTo(fighter.radius + bladeLength - 8, 2);  // Edge curve start
                ctx.lineTo(fighter.radius + 2, 2);                // Edge back to guard
                ctx.fill();
                ctx.stroke();

                // Energy edge (Subtle purple shimmer on the cutting edge)

                // No duplicate fill here

                // Energy edge (purple glow on cutting edge only)
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#8B00FF';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                // Follow the cutting edge curve
                ctx.moveTo(fighter.radius + bladeLength, 0); // Tip
                ctx.lineTo(fighter.radius + bladeLength - 8, 2); // Curve start
                ctx.lineTo(fighter.radius + 2, 2); // To guard
                ctx.stroke();
                ctx.restore();

                // White highlight on edge
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(fighter.radius + 8, 0);
                ctx.lineTo(fighter.radius + bladeLength - 2, 0);
                ctx.stroke();

                // Bankai aura effect
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#4a0080';
                ctx.lineWidth = 6;
                ctx.globalAlpha = 0.2 + Math.sin(Date.now() * 0.01) * 0.1;
                ctx.beginPath();
                // Aura follows the full blade shape
                ctx.moveTo(fighter.radius + 2, -2);
                ctx.lineTo(fighter.radius + bladeLength - 5, -2);
                ctx.lineTo(fighter.radius + bladeLength, 0);
                ctx.lineTo(fighter.radius + bladeLength - 8, 2);
                ctx.lineTo(fighter.radius + 2, 2);
                ctx.stroke();
                ctx.restore();

            } else {
                // ================================================================
                // SHIKAI: Zangetsu - Oversized Khyber Knife
                // ================================================================
                const bladeLength = 60; // Increased from 55
                const baseWidth = 12;  // Wider base
                const tipWidth = 5;    // Tapered tip
                const handleLength = 18;

                // Handle (wrapped in white bandage)
                ctx.fillStyle = '#f5f5f5';
                ctx.fillRect(fighter.radius - handleLength, -3.5, handleLength, 7);
                // Handle wrapping lines
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;
                for (let i = 0; i < handleLength; i += 4) {
                    ctx.beginPath();
                    ctx.moveTo(fighter.radius - handleLength + i, -3.5);
                    ctx.lineTo(fighter.radius - handleLength + i + 2, 3.5);
                    ctx.stroke();
                }

                // Guard (rugged darkened metal)
                ctx.fillStyle = '#222';
                ctx.fillRect(fighter.radius - 2, -baseWidth / 2 - 2, 4, baseWidth + 4);

                // Blade Shape: True Oversized Khyber Knife
                // Heavy spine, dramatic taper to a sharp edge and point at the TOP spine
                ctx.beginPath();

                // Spine - Straight top edge
                ctx.moveTo(fighter.radius + 2, -baseWidth / 2);
                ctx.lineTo(fighter.radius + bladeLength, -baseWidth / 2); // Tip is ALIGNED with spine (Top)

                // Cutting edge - Curves from the base up to the tip
                // Control points to create the deep belly curve
                ctx.lineTo(fighter.radius + bladeLength, -baseWidth / 2); // Ensure we are at tip
                ctx.quadraticCurveTo(
                    fighter.radius + bladeLength * 0.6, baseWidth / 2 + 5, // Belly bulges out
                    fighter.radius + 2, baseWidth / 2             // Back to base
                );
                ctx.closePath();

                // Premium Blade Gradient
                const shikaiGrad = ctx.createLinearGradient(0, -baseWidth / 2, 0, baseWidth / 2);
                shikaiGrad.addColorStop(0, '#444');     // Dark spine
                shikaiGrad.addColorStop(0.2, '#888');   // Mid spine
                shikaiGrad.addColorStop(0.4, '#C0C0C0'); // Steel face
                shikaiGrad.addColorStop(0.8, '#F0F0F0'); // Sharp edge highlight
                shikaiGrad.addColorStop(1, '#B0B0B0');   // Reflected light at very edge
                ctx.fillStyle = shikaiGrad;
                ctx.fill();

                // Edge outline (fine detail)
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.restore();

            // Spiritual Pressure Aura (when below 50% HP)
            if (!isBankai && fighter.hp < fighter.maxHp * 0.5) {
                ctx.save();
                ctx.rotate(-fighter.angle);
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = '#FF6600';
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.2 + Math.sin(Date.now() * 0.005) * 0.1;
                ctx.beginPath();
                ctx.arc(0, 0, fighter.radius + 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        });
    }
}

// Export singleton
export const renderer = new Renderer();
