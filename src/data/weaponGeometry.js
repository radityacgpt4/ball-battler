/**
 * Weapon Geometry Registry
 *
 * Single source of truth for all weapon visual and collision geometry.
 * Ensures hitboxes perfectly match visual representations.
 *
 * ARCHITECTURE RULE: When adding a new weapon, define its geometry here ONCE.
 * Both Renderer and Ability files will reference this registry.
 */

import { Physics } from '../systems/Physics.js';

// ============================================================================
// WEAPON GEOMETRY DEFINITIONS
// ============================================================================

export const weaponGeometry = {
    // ========================================================================
    // LEVI (Titan Killer) - Dual Box Cutter Blades
    // ========================================================================
    LEVI_BLADES: {
        type: 'dual_blades',
        bladeLength: 35,
        bladeWidth: 7,
        handleLength: 14,
        stanceAngle: Math.PI / 3.2, // 56.25° - vertical stance

        // Visual-only properties
        segmentSpacing: 6, // Box cutter blade segments

        // Collision offsets - [x, y, rotation]
        bladeOffsets: [
            { x: 12, y: 16, rotation: 0 },      // Front blade (pointing up-right)
            { x: -12, y: -16, rotation: Math.PI } // Back blade (pointing down-left)
        ]
    },

    // ========================================================================
    // MECHA - Energy Blade
    // ========================================================================
    MECHA_BLADE: {
        type: 'single_blade',
        bladeLength: 52.5, // 55 (base) + 2 (offset) + 0.5 (rounded core tip)
        bladeWidth: 7,
        glowSize: 2,
        startFromEdge: true, // Blade starts from fighter's edge (radius), not center

        // Single blade extending forward from fighter angle
        bladeOffsets: [
            { x: 2, y: 0, rotation: 0 } // Offset by 2 to match renderer's startX
        ]
    },

    // ========================================================================
    // SWORD_MASTER - Knight's Sword
    // ========================================================================
    SWORD_MASTER_BLADE: {
        type: 'single_blade',
        bladeLength: 50, // From config: fighter.skills.atk.range
        bladeWidth: 8,

        // Simple sword extending forward
        bladeOffsets: [
            { x: 0, y: 0, rotation: 0 }
        ]
    },

    // ========================================================================
    // AXEMAN - Heavy Battle Axe
    // ========================================================================
    AXEMAN_AXE: {
        type: 'single_blade',
        handleLength: 48,
        handleWidth: 4,
        bladeLength: 65, // From config: fighter.skills.atk.range
        bladeCenterOffset: 43, // handleStart + handleLength - 5

        // Top blade curve control points
        topBlade: {
            start: { x: -2, y: -4 },
            cp1: { x: -5, y: -12 },
            cp2: { x: 8, y: -18 },
            cp3: { x: 26, y: -14 },
            cp4: { x: 24, y: -5 },
            end: { x: 2, y: -4 }
        },

        // Bottom blade curve control points
        bottomBlade: {
            start: { x: -2, y: 4 },
            cp1: { x: -5, y: 12 },
            cp2: { x: 8, y: 18 },
            cp3: { x: 26, y: 14 },
            cp4: { x: 24, y: 5 },
            end: { x: 2, y: 4 }
        },

        // Simplified line collision (from fighter center to tip)
        bladeOffsets: [
            { x: 0, y: 0, rotation: 0 }
        ]
    },

    // ========================================================================
    // DIVINE_GENERAL - Golden 8-Spoke Wheel
    // ========================================================================
    DIVINE_GENERAL_WHEEL: {
        type: 'orb_ring',
        orbCount: 8,
        orbRadius: 4, // Visual orb size (was 3 in code)
        orbDistance: 18, // Distance from fighter center
        wheelRadius: 15, // Visual outer ring radius (fighter.radius + 15)

        // Wheel visual properties
        spokeStartRadius: 3, // fighter.radius + 3
        spokeEndRadius: 18,  // fighter.radius + 18
        ringLineWidth: 3,
        spokeLineWidth: 2,

        // Collision: Each orb is a point collision
        orbCollisionRadius: 3 // Actual collision radius from config
    },

    // ========================================================================
    // DIVINE_BRAWLER - Dual Fists
    // ========================================================================
    DIVINE_BRAWLER_FISTS: {
        type: 'dual_fists',
        fistSize: 10,
        fistWidth: 4, // fistSize + 4
        fistDistance: 0, // Distance forward from fighter edge (fistDist - 2)
        fistSeparation: 12, // Perpendicular distance between fists

        // Collision: Circle around fighter (melee range)
        meleeRange: 15, // From config: fighter.skills.atk.range

        // Visual properties
        knuckleRadius: 2
    },

    // ========================================================================
    // ICHIGO (Death God Swordsman) - Zangetsu (Shikai)
    // Right-angled trapezoid / scalene triangle with truncated base
    // ========================================================================
    SOUL_REAPER_ZANGETSU: {
        type: 'single_blade',
        bladeLength: 60, // Oversized khyber knife
        bladeWidth: 16, // Wide blade at base
        tipWidth: 5, // Narrower tip
        startFromEdge: true,

        // Blade shape: Oversized Khyber Knife
        bladeOffsets: [
            { x: 0, y: 0, rotation: 0 }
        ]
    },

    // ========================================================================
    // ICHIGO (Death God Swordsman) - Tensa Zangetsu (Bankai)
    // Thin black blade - compressed power
    // ========================================================================
    SOUL_REAPER_TENSA: {
        type: 'single_blade',
        bladeLength: 60, // Synced with Shikai
        bladeWidth: 4, // Very thin
        startFromEdge: true,

        bladeOffsets: [
            { x: 0, y: 0, rotation: 0 }
        ]
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get weapon hitbox data for collision detection
 * @param {string} weaponKey - Key from weaponGeometry
 * @param {object} fighter - Fighter instance
 * @returns {Array<object>} Array of collision shapes
 */
export function getWeaponHitboxes(weaponKey, fighter) {
    const weapon = weaponGeometry[weaponKey];
    if (!weapon) {
        console.error(`Weapon geometry not found: ${weaponKey}`);
        return [];
    }

    switch (weapon.type) {
        case 'single_blade':
        case 'dual_blades':
            return getBladeHitboxLines(weapon, fighter);

        case 'orb_ring':
            return getOrbHitboxPoints(weapon, fighter);

        case 'dual_fists':
            return getFistHitboxCircle(weapon, fighter);

        default:
            console.error(`Unknown weapon type: ${weapon.type}`);
            return [];
    }
}

/**
 * Get blade hitbox lines for line-circle collision
 * @private
 */
function getBladeHitboxLines(weapon, fighter) {
    const lines = [];

    for (const offset of weapon.bladeOffsets) {
        // Calculate blade direction angle
        const bladeAngle = fighter.angle + (weapon.stanceAngle || 0) + offset.rotation;

        // Calculate blade start position (relative to fighter)
        let startX = offset.x * Math.cos(fighter.angle) - offset.y * Math.sin(fighter.angle);
        let startY = offset.x * Math.sin(fighter.angle) + offset.y * Math.cos(fighter.angle);

        // If startFromEdge is true, start blade from fighter's edge (radius) instead of center
        if (weapon.startFromEdge) {
            startX += Math.cos(bladeAngle) * fighter.radius;
            startY += Math.sin(bladeAngle) * fighter.radius;
        }

        // Calculate blade end position (relative to fighter)
        const endX = startX + weapon.bladeLength * Math.cos(bladeAngle);
        const endY = startY + weapon.bladeLength * Math.sin(bladeAngle);

        lines.push({
            type: 'line',
            startX: fighter.x + startX,
            startY: fighter.y + startY,
            endX: fighter.x + endX,
            endY: fighter.y + endY,
            angle: bladeAngle
        });
    }

    return lines;
}

/**
 * Get orb hitbox points for point-circle collision
 * @private
 */
function getOrbHitboxPoints(weapon, fighter) {
    const orbs = [];
    const orbDistance = fighter.radius + weapon.orbDistance;

    for (let i = 0; i < weapon.orbCount; i++) {
        const orbAngle = fighter.angle + (fighter.wheelRotation || 0) + (Math.PI * 2 * i) / weapon.orbCount;
        const orbX = fighter.x + Math.cos(orbAngle) * orbDistance;
        const orbY = fighter.y + Math.sin(orbAngle) * orbDistance;

        orbs.push({
            type: 'orb',
            x: orbX,
            y: orbY,
            radius: weapon.orbCollisionRadius,
            angle: orbAngle
        });
    }

    return orbs;
}

/**
 * Get fist hitbox circle for circle-circle collision
 * @private
 */
function getFistHitboxCircle(weapon, fighter) {
    return [{
        type: 'circle',
        x: fighter.x,
        y: fighter.y,
        radius: fighter.radius + weapon.meleeRange
    }];
}

/**
 * Check if weapon hits target
 * @param {string} weaponKey - Key from weaponGeometry
 * @param {object} fighter - Fighter instance
 * @param {object} target - Target enemy instance
 * @returns {boolean} True if weapon hits target
 */
export function checkWeaponHit(weaponKey, fighter, target) {
    const hitboxes = getWeaponHitboxes(weaponKey, fighter);

    for (const hitbox of hitboxes) {
        switch (hitbox.type) {
            case 'line':
                if (Physics.lineCircleIntersect(
                    hitbox.startX, hitbox.startY,
                    hitbox.endX, hitbox.endY,
                    target.x, target.y, target.radius
                )) {
                    return true;
                }
                break;

            case 'orb':
                const dist = Physics.dist(hitbox.x, hitbox.y, target.x, target.y);
                if (dist < hitbox.radius + target.radius) {
                    return true;
                }
                break;

            case 'circle':
                const distToCenter = Physics.dist(hitbox.x, hitbox.y, target.x, target.y);
                if (distToCenter < hitbox.radius + target.radius) {
                    return true;
                }
                break;
        }
    }

    return false;
}

/**
 * Get weapon visual rendering data
 * @param {string} weaponKey - Key from weaponGeometry
 * @returns {object} Weapon geometry for rendering
 */
export function getWeaponGeometry(weaponKey) {
    return weaponGeometry[weaponKey];
}
