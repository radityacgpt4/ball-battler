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
    },

    // ============================================
    // FIGHTER SPECIFIC: MECHA (Gundam)
    // ============================================
    'mechaExplosion': {
        layers: [
            // Fire/Energy explosion - Amplified for better impact visibility
            { type: 'shockwave', color: '#FF8C00', maxRadius: 120, life: 0.8, lineWidth: 12 }, // Larger orange ring
            { type: 'shockwave', color: '#FFD700', maxRadius: 90, life: 0.6, lineWidth: 6 }, // Larger gold inner ring
            { type: 'burst', count: 35, color: ['#FF4500', '#FFD700', '#FFFF00'], speed: { min: 12, max: 24 }, life: 0.8, shape: 'flame' }, // More & faster fire sparks
            { type: 'burst', count: 12, color: '#FFFFFF', speed: { min: 6, max: 12 }, life: 0.5, shape: 'dot', size: 5 }, // Bigger white core projectiles
            { type: 'lightning', count: 12, color: '#FFD700', spread: 100, life: 0.5, width: 3 } // More intense energy crackle
        ]
    },
    'fragGrenadeExplosion': {
        layers: [
            // HE Frag Explosion (Higher count of debris + thick smoke)
            { type: 'shockwave', color: '#FF4500', maxRadius: 130, life: 1.0, lineWidth: 15 }, // Fiery orange shockwave
            { type: 'shockwave', color: '#8B0000', maxRadius: 150, life: 1.2, lineWidth: 2 },  // Outer dark red pressure wave
            { type: 'burst', count: 40, color: ['#FF0000', '#FF4500', '#2F4F4F'], speed: { min: 14, max: 28 }, life: 1.2, shape: 'flame' }, // Fire + Charcoal debris
            { type: 'burst', count: 20, color: ['#555555', '#777777'], speed: { min: 2, max: 6 }, life: 1.5, shape: 'dot', size: 8 }, // Thick smoke clouds
            { type: 'burst', count: 15, color: '#FFFFFF', speed: { min: 10, max: 20 }, life: 0.4, shape: 'dot', size: 3 }, // Shrapnel flashes
            { type: 'lightning', count: 8, color: '#FF0000', spread: 120, life: 0.4, width: 3 } // Heat crackle
        ]
    },
    'mechaDodge': {
        layers: [
            { type: 'shockwave', color: '#1E90FF', maxRadius: 40, life: 0.3, lineWidth: 4 },
            { type: 'burst', count: 8, color: ['#FFD700', '#FF4500'], speed: { min: 4, max: 8 }, life: 0.4, shape: 'dot' }
        ]
    },
    'mechaBoost': {
        layers: [
            { type: 'burst', count: 5, color: ['#FF4500', '#FFD700'], speed: { min: 2, max: 5 }, life: 0.5, shape: 'dot' },
            { type: 'burst', count: 2, color: '#00BFFF', speed: { min: 1, max: 3 }, life: 0.3, shape: 'dot' }
        ]
    },

    // ============================================
    // FIGHTER SPECIFIC: DEATH GOD SWORDSMAN (Ichigo)
    // ============================================
    'getsugaBlue': {
        layers: [
            // Modeled after frag grenade but with blue energy
            { type: 'shockwave', color: '#1E90FF', maxRadius: 130, life: 0.8, lineWidth: 12 }, // Strong blue shockwave
            { type: 'shockwave', color: '#00BFFF', maxRadius: 150, life: 1.0, lineWidth: 4 },  // Outer cyan pressure wave
            { type: 'burst', count: 35, color: ['#1E90FF', '#00BFFF', '#E0FFFF'], speed: { min: 12, max: 25 }, life: 0.8, shape: 'flame' }, // Energy "flames"
            { type: 'burst', count: 15, color: ['#FFFFFF', '#E0FFFF'], speed: { min: 4, max: 10 }, life: 0.6, shape: 'dot' }, // Spiritual dust
            { type: 'burst', count: 10, color: '#FFFFFF', speed: { min: 2, max: 4 }, life: 0.4, shape: 'flash', size: 10 } // Core flashes
        ]
    },
    'getsugaBankai': {
        layers: [
            // More intense, darker, and longer lasting for Bankai
            { type: 'shockwave', color: '#1a1a2e', maxRadius: 150, life: 1.2, lineWidth: 15 }, // Massive black void shockwave
            { type: 'shockwave', color: '#8B00FF', maxRadius: 180, life: 1.0, lineWidth: 6 },  // Intense purple energy ring
            { type: 'burst', count: 50, color: ['#1a1a2e', '#4a0080', '#8B00FF'], speed: { min: 15, max: 30 }, life: 1.2, shape: 'flame' }, // Dark energy "flames"
            { type: 'lightning', count: 20, color: '#9400D3', spread: 140, life: 0.7, width: 4 }, // Extreme energy discharge
            { type: 'burst', count: 12, color: '#FFFFFF', speed: { min: 6, max: 15 }, life: 0.5, shape: 'flash', size: 12 } // Blinding flashes
        ]
    },
    'getsugaMuzzle': {
        layers: [
            { type: 'burst', count: 8, color: ['#1E90FF', '#00BFFF'], speed: { min: 3, max: 8 }, life: 0.4, shape: 'dot' },
            { type: 'burst', count: 1, color: '#E0FFFF', speed: 0, life: 0.3, shape: 'flash', size: 12 }
        ]
    },
    'bankaiTransform': {
        layers: [
            { type: 'shockwave', color: '#1a1a2e', maxRadius: 150, life: 1.2, lineWidth: 15 },
            { type: 'shockwave', color: '#8B00FF', maxRadius: 180, life: 1.0, lineWidth: 6 },
            { type: 'burst', count: 40, color: ['#1a1a2e', '#4a0080', '#8B00FF'], speed: { min: 12, max: 28 }, life: 1.0, shape: 'dot' },
            { type: 'lightning', count: 25, color: '#9400D3', spread: 160, life: 0.8, width: 4 },
            { type: 'text', text: 'BANKAI!', color: '#8B00FF', offset: { x: 0, y: -50 } }
        ]
    },
    'bankaiPulse': {
        layers: [
            // 1. Core Energy Burst (Dark Purple/Black)
            { type: 'burst', count: 30, color: ['#1a1a2e', '#4a0080', '#8B00FF'], speed: { min: 10, max: 20 }, life: 0.8, shape: 'flame' },
            // 2. Thick Void Shockwave (Main aura)
            { type: 'shockwave', color: '#1a1a2e', maxRadius: 180, life: 1.0, lineWidth: 20 },
            // 3. Spiritual Pressure Ring (Purple)
            { type: 'shockwave', color: '#8B00FF', maxRadius: 160, life: 0.8, lineWidth: 10 },
            // 4. White-hot Core Burst
            { type: 'burst', count: 10, color: '#FFFFFF', speed: { min: 5, max: 15 }, life: 0.5, shape: 'flash', size: 8 },
            // 5. Intense Lightning crackles
            { type: 'lightning', count: 15, color: '#9400D3', spread: 180, life: 0.6, width: 4 },
            // 6. Combat Text Feedback
            { type: 'text', text: 'TENSA ZANGETSU!', color: '#8B00FF', offset: { x: 0, y: -60 } }
        ]
    }
};
