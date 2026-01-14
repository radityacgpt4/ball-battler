/**
 * Particle Effects Templates
 * Defines visual effects as data to allow extending the game without modifying Particles.js
 * 
 * Template Structure:
 * key: {
 *   layers: [
 *     { type: 'burst'|'shockwave'|'beam'|'text', ...params }
 *   ]
 * }
 */
export const PARTICLE_TEMPLATES = {
    // ============================================
    // GENERIC EFFECTS
    // ============================================
    'explosion': {
        layers: [
            { type: 'burst', count: 15, color: ['#ff4400', '#ffaa00'], speed: 8, life: 1.0, shape: 'flame' }
        ]
    },
    'wallImpact': {
        layers: [
            { type: 'burst', count: 30, color: ['#ffffff', '#ff4444'], speed: 18, life: 1.0, shape: 'dot' },
            { type: 'shockwave', color: '#ff4444', maxRadius: 150, life: 1.0 }
        ]
    },
    'hit': {
        layers: [
            { type: 'burst', count: 5, color: '#ffffff', speed: 5, life: 0.5, shape: 'dot' }
        ]
    },
    'smoke': {
        layers: [
            { type: 'burst', count: 3, color: ['#888888', '#aaaaaa', '#cccccc'], speed: { min: 0.5, max: 2 }, life: 0.8, shape: 'dot' }
        ]
    },
    'sparkle': {
        layers: [
            { type: 'burst', count: 8, color: ['#ffffff', '#fff7e0'], speed: { min: 1, max: 4 }, life: 0.4, shape: 'dot' }
        ]
    },

    // ============================================
    // FIGHTER SPECIFIC: QUINCY (Spirit Archer)
    // ============================================
    'quincyArrow': {
        layers: [
            { type: 'burst', count: 1, color: '#1E90FF', speed: 0, life: 0.8, shape: 'flash', size: 8 }, // Flash
            { type: 'burst', count: 6, color: '#00BFFF', speed: 2, life: 0.6, shape: 'dot' } // Sparkles
        ]
    },
    'hirenkyaku': {
        layers: [
            { type: 'burst', count: 10, color: '#ffffff', speed: { min: 0, max: 0 }, life: 0.4, shape: 'dot', rise: -1 }, // Static
            { type: 'burst', count: 1, color: '#1E90FF', speed: 0, life: 0.8, shape: 'flash', size: 8 } // Flash
        ]
    },
    'lichtRegen': {
        layers: [
            { type: 'burst', count: 15, color: '#00BFFF', speed: 6, life: 0.8, shape: 'dot', angle: -Math.PI / 2, spread: 0.5 } // Upward burst
        ]
    },

    // ============================================
    // FIGHTER SPECIFIC: FRIEREN (Mage)
    // ============================================
    'zoltraakImpact': {
        layers: [
            { type: 'shockwave', color: '#4fc3f7', maxRadius: 45, life: 0.4, lineWidth: 3 }, // Quick shockwave
            { type: 'burst', count: 10, color: ['#4fc3f7', '#87CEEB', '#ffffff'], speed: { min: 4, max: 12 }, life: 0.5, shape: 'dot' }, // Cyan sparks
            { type: 'burst', count: 4, color: '#E0FFFF', speed: { min: 1, max: 3 }, life: 0.3, shape: 'flash', size: 6 } // Core flash
        ]
    },

    // ============================================
    // FIGHTER SPECIFIC: SORCERER (Brawler)
    // ============================================
    'blackFlash': {
        layers: [
            { type: 'shockwave', color: '#000000', maxRadius: 150, life: 1.0, lineWidth: 16 }, // Core distortion
            { type: 'lightning', count: 30, color: '#FF0000', spread: 140, life: 0.8, width: 4 }, // Red sparks
            { type: 'burst', count: 25, color: '#000000', speed: 15, life: 1.0, shape: 'dot' } // Debris
        ]
    },
    'superBlackFlash': {
        layers: [
            { type: 'shockwave', color: '#000000', maxRadius: 180, life: 1.4, lineWidth: 22 }, // Distortion
            { type: 'shockwave', color: '#FF0000', maxRadius: 210, life: 1.0, lineWidth: 6 }, // Red Ring
            { type: 'lightning', count: 40, color: '#FF0000', spread: 240, life: 1.0, width: 5 }, // Red Lightning
            { type: 'burst', count: 48, color: ['#FF0000', '#000000'], speed: 28, life: 1.2, shape: 'dot' }, // Debris
            { type: 'text', text: 'MAX BLACK FLASH!!', color: '#FF0000', offset: { x: 0, y: -60 } }
        ]
    }
};
