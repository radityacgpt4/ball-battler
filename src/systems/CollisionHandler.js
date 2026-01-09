/**
 * Collision Handler System
 * Delegates collision resolution to entities via event hooks.
 * Removes character-specific logic from Game.js.
 */
import { Physics } from './Physics.js';
import { audioEngine } from './Audio.js';

export class CollisionHandler {
    constructor(game) {
        this.game = game;
    }

    /**
     * Resolve all entity-to-entity collisions
     * @param {Fighter[]} entities - All fighter entities
     */
    resolveEntityCollisions(entities) {
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const e1 = entities[i];
                const e2 = entities[j];

                if (e1.isDead || e2.isDead) continue;
                if (e1.isDashing || e2.isDashing) continue;

                const dist = Physics.dist(e1.x, e1.y, e2.x, e2.y);
                const minDist = e1.radius + e2.radius;

                if (dist < minDist) {
                    // Delegate to entity collision handlers
                    const handled1 = this.handleEntityCollision(e1, e2, dist);
                    const handled2 = this.handleEntityCollision(e2, e1, dist);

                    // Separation (always happens)
                    this.separateEntities(e1, e2, dist, minDist);

                    // Normal elastic collision (only if no special handling)
                    if (!handled1 && !handled2) {
                        this.elasticCollision(e1, e2, dist);
                        audioEngine.playHit();
                    }
                }
            }
        }
    }

    /**
     * Handle collision between two entities
     * Delegates to ability onCollide hooks
     * @returns {boolean} True if collision was specially handled
     */
    handleEntityCollision(attacker, defender, dist) {
        // Check attacker's abilities for collision handlers
        for (const slot of ['atk', 'def', 'ult']) {
            const ability = attacker.abilities[slot];
            if (ability && typeof ability.onCollide === 'function') {
                const result = ability.onCollide(attacker, defender, this.game);
                if (result === true) return true;
            }
        }
        return false;
    }

    /**
     * Separate overlapping entities based on mass
     */
    separateEntities(e1, e2, dist, minDist) {
        const angle = Math.atan2(e2.y - e1.y, e2.x - e1.x);
        const overlap = (minDist - dist) + 1;
        const m1 = e1.mass, m2 = e2.mass;
        const r1 = m2 / (m1 + m2), r2 = m1 / (m1 + m2);

        e1.x -= Math.cos(angle) * overlap * r1;
        e1.y -= Math.sin(angle) * overlap * r1;
        e2.x += Math.cos(angle) * overlap * r2;
        e2.y += Math.sin(angle) * overlap * r2;
    }

    /**
     * Apply elastic collision physics with restitution (bounciness)
     */
    elasticCollision(e1, e2, dist) {
        const m1 = e1.mass, m2 = e2.mass;
        let nx, ny;

        if (dist < 0.001) {
            nx = 1; ny = 0;
        } else {
            nx = (e2.x - e1.x) / dist;
            ny = (e2.y - e1.y) / dist;
        }

        // Relative velocity
        const v1n = e1.dx * nx + e1.dy * ny;
        const v2n = e2.dx * nx + e2.dy * ny;
        
        // Skip if moving apart
        if (v1n - v2n < 0) return;

        // Coefficient of restitution (0.8 = somewhat bouncy, 1.0 = superball)
        const restitution = 0.85;

        // Impulse scalar
        const j = -(1 + restitution) * (v1n - v2n) / (1/m1 + 1/m2);

        // Apply impulse
        e1.dx += (j * nx) / m1;
        e1.dy += (j * ny) / m1;
        e2.dx -= (j * nx) / m2;
        e2.dy -= (j * ny) / m2;
    }
