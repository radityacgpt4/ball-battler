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
     * Apply elastic collision physics
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

        const p = 2 * (e1.dx * nx + e1.dy * ny - e2.dx * nx - e2.dy * ny) / (m1 + m2);
        e1.dx -= p * m2 * nx;
        e1.dy -= p * m2 * ny;
        e2.dx += p * m1 * nx;
        e2.dy += p * m1 * ny;
    }
}
