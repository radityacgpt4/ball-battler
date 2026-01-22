/**
 * Base Ability Class
 * All abilities inherit from this class
 */
export class Ability {
    constructor(config, slot) {
        this.config = config;
        this.slot = slot; // 'atk', 'def', or 'ult'
        this.type = config.type;
        this.cooldown = config.cooldown || 0;
        this.isPassive = this.type.includes('PASSIVE') || this.type === 'SHIELD_DEFLECT';
    }

    /**
     * Check if ability can be used
     * @param {Fighter} fighter - The fighter using the ability
     * @param {Object} context - Game context (enemies, game ref, etc.)
     * @returns {boolean}
     */
    canUse(fighter, context) {
        if (fighter.status.stun > 0) return false;
        if (fighter.cooldowns[this.slot] > 0) return false;
        return true;
    }

    /**
     * Execute the ability
     * @param {Fighter} fighter - The fighter using the ability
     * @param {Object} context - Game context
     */
    execute(fighter, context) {
        // Override in subclasses
    }

    /**
     * Update passive abilities (called every frame)
     * @param {Fighter} fighter - The fighter
     * @param {Object} context - Game context
     */
    update(fighter, context) {
        // Override in subclasses for passive abilities
    }

    /**
     * Called when fighter takes damage (for defensive abilities)
     * @param {Fighter} fighter - The fighter
     * @param {number} damage - Incoming damage
     * @param {Object} context - Game context
     * @returns {number|false} Modified damage or false if blocked
     */
    onDamage(fighter, damage, context) {
        return damage;
    }

    /**
     * Hook called when the fighter bounces off a wall.
     * @param {Fighter} fighter 
     */
    onWallBounce(fighter) { }

    /**
     * Hook called when the fighter is dashing (fighter.isDashing = true).
     * @param {Fighter} fighter 
     * @param {number} timeScale 
     */
    updateDash(fighter, timeScale) { }

    /**
     * Hook to modify fighter's movement speed.
     * @param {Fighter} fighter 
     * @param {number} speed - Current calculated speed
     * @returns {number} Modified speed
     */
    modifySpeed(fighter, speed) {
        return speed;
    }

    /**
     * Hook to modify fighter's rotation speed.
     * @param {Fighter} fighter 
     * @param {number} rotationSpeed 
     * @returns {number}
     */
    modifyRotation(fighter, rotationSpeed) {
        return rotationSpeed;
    }

    /**
     * Hook called when the fighter collides with another fighter.
     * @param {Fighter} fighter - The fighter owning this ability
     * @param {Fighter} other - The other fighter in the collision
     * @param {Object} context - Game context
     */
    onEntityCollision(fighter, other, context) { }

    /**
     * Hook called for rendering ability-specific effects.
     * @param {Fighter} fighter - The fighter owning this ability
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(fighter, ctx) { }
}
