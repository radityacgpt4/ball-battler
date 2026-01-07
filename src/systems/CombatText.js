/**
 * Combat Text Configuration
 * Controls which floating text pop-ups appear in the battle arena
 *
 * HOW TO USE:
 * - Set any property to `false` to disable that text type
 * - Set `enabled` to `false` to disable ALL combat text
 * - Import and modify at runtime: combatTextConfig.damage = false;
 */
export const combatTextConfig = {
    // Master toggle - set to false to disable all combat text
    enabled: true,

    // === DAMAGE & HEALING ===
    damage: true,           // "-15" damage numbers
    healing: true,          // "+10" healing numbers
    shieldRegen: true,      // "+1" shield regeneration

    // === DEFENSIVE ===
    blocked: true,          // "BLOCKED!" when shield blocks attack
    parried: true,          // "PARRY!" when parry triggers
    dodged: true,           // "DODGE!" when evasion triggers
    shieldBreak: true,      // "SHIELD BREAK!" when barrier destroyed

    // === STATUS EFFECTS ===
    bleed: true,            // "BLEED" when bleed applied
    stun: true,             // "STUNNED" when stun applied
    slow: true,             // "SLOWED" when slow applied

    // === COMBAT EVENTS ===
    comboHits: true,        // "2 HIT!", "3 HIT!" combo counters
    criticalHit: true,      // "CRITICAL!" for critical hits
    execute: true,          // "EXECUTE!" and "FATALITY!"
    wallSlam: true,         // "WALL SLAM!"

    // === MOVEMENT & BUFFS ===
    speedUp: true,          // "SPEED UP!" momentum gains
    berserk: true,          // Berserker rage indicators

    // === ARENA EVENTS ===
    arenaShrink: true,      // "ARENA SHRINKING!" warning
    knockout: true,         // "K.O.!" when fighter dies

    // === ABILITIES ===
    ultActivate: true,      // Ultimate ability activation text
    flash: true,            // "FLASH!" teleport damage
    rasengan: true,         // Rasengan hit effects
};

/**
 * Helper class for spawning combat text with config checks
 */
export class CombatTextHelper {
    constructor(particleSystem) {
        this.particles = particleSystem;
    }

    /**
     * Spawn text if the given type is enabled
     * @param {string} type - Key from combatTextConfig
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Text to display
     * @param {string} color - Text color
     * @returns {boolean} - Whether text was spawned
     */
    spawn(type, x, y, text, color) {
        if (!combatTextConfig.enabled) return false;
        if (!combatTextConfig[type]) return false;

        this.particles.spawnText(x, y, text, color);
        return true;
    }

    // === Convenience methods for common text types ===

    damage(x, y, amount) {
        return this.spawn('damage', x, y, `-${Math.ceil(amount)}`, '#ff4444');
    }

    healing(x, y, amount) {
        return this.spawn('healing', x, y, `+${Math.ceil(amount)}`, '#44ff44');
    }

    blocked(x, y) {
        return this.spawn('blocked', x, y, 'BLOCKED!', '#ffffff');
    }

    parried(x, y) {
        return this.spawn('parried', x, y, 'PARRY!', '#ffffff');
    }

    dodged(x, y) {
        return this.spawn('dodged', x, y, 'DODGE!', '#ffd700');
    }

    bleed(x, y) {
        return this.spawn('bleed', x, y, 'BLEED', '#ff0000');
    }

    stunned(x, y) {
        return this.spawn('stun', x, y, 'STUNNED', '#ffff00');
    }

    slowed(x, y) {
        return this.spawn('slow', x, y, 'SLOWED', '#cccccc');
    }

    combo(x, y, hits) {
        return this.spawn('comboHits', x, y, `${hits} HIT!`, '#ff6b6b');
    }

    execute(x, y) {
        return this.spawn('execute', x, y, 'EXECUTE!', '#ff0000');
    }

    fatality(x, y) {
        return this.spawn('execute', x, y, 'FATALITY!', '#880000');
    }

    wallSlam(x, y) {
        return this.spawn('wallSlam', x, y, 'WALL SLAM!', '#ff4444');
    }

    speedUp(x, y) {
        return this.spawn('speedUp', x, y, 'SPEED UP!', '#8b5cf6');
    }

    arenaShrink(x, y) {
        return this.spawn('arenaShrink', x, y, 'ARENA SHRINKING!', '#ff6600');
    }

    knockout(x, y, name) {
        return this.spawn('knockout', x, y, 'K.O.!', '#ff0000');
    }

    shieldBreak(x, y, side = '') {
        const text = side ? `${side} BREAK!` : 'SHIELD BREAK!';
        return this.spawn('shieldBreak', x, y, text, '#ff8800');
    }

    flash(x, y) {
        return this.spawn('flash', x, y, 'FLASH!', '#ffd700');
    }

    ultActivate(x, y, name) {
        return this.spawn('ultActivate', x, y, name, '#ffffff');
    }
}
