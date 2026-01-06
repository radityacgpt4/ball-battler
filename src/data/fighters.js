/**
 * Fighter Configuration Data
 * CRITICAL: Do not change any values - HP, Mass, Speed, Colors, and Skill parameters
 * must match the original code exactly
 */
export const FIGHTER_TYPES = {
    SWORD_MASTER: {
        name: "Sword Master",
        color: "#ff6b6b",
        hp: 100,
        mass: 1.0,
        speed: 4.5,
        rotationSpeed: 0.15,
        skills: {
            atk: { type: "MELEE_PASSIVE", range: 50, damage: 5, procRate: 3 },
            def: { type: "PARRY_PASSIVE", chance: 0.15 },
            ult: { type: "DASH_ASSAULT", cooldown: 180, damage: 5 }
        }
    },
    THUNDER_MAGE: {
        name: "Thundermage",
        color: "#4ecdc4",
        hp: 100,
        mass: 2.0,
        speed: 4,
        rotationSpeed: 0.12,
        skills: {
            atk: { type: "RAYCAST", cooldown: 90, range: 800, damage: 15, bounces: 3 },
            def: { type: "STATIC_PASSIVE" },
            ult: { type: "DOUBLE_ZAP", cooldown: 180 }
        }
    },
    SOLDIER: {
        name: "Rifleman",
        color: "#54a0ff",
        hp: 100,
        mass: 1.2,
        speed: 4,
        rotationSpeed: 0.12,
        skills: {
            atk: { type: "BURST_FIRE", cooldown: 100, count: 10, damage: 3 },
            def: { type: "RETREAT", cooldown: 120, range: 150 },
            ult: { type: "GRENADE", cooldown: 90, damage: 20 }
        }
    },
    SHIELDBEARER: {
        name: "Shieldbearer",
        color: "#8b5cf6",
        hp: 100,
        mass: 1.8,
        speed: 4,
        rotationSpeed: 0.10,
        skills: {
            atk: { type: "MOMENTUM_PASSIVE", maxSpeed: 8, speedGain: 1, damagePerTier: 5, knockback: 15 },
            def: { type: "SHIELD_DEFLECT", arcAngle: Math.PI * 0.65 },
            ult: { type: "WALL_SLAM", cooldown: 120, damage: 10 }
        }
    },
    NINJA: {
        name: "Yellow Flash",
        color: "#ffd700",
        hp: 100,
        mass: 1.0,
        speed: 5,
        rotationSpeed: 0.16,
        skills: {
            atk: { type: "KUNAI_MARK", cooldown: 120, count: 2, damage: 5, delay: 90 }, // 1.5s total
            def: { type: "EVASION", cooldown: 120, duration: 12 },
            ult: { type: "FLASH_BARRAGE", cooldown: 180 }
        }
    },
    CYBORG: {
        name: "Cyborg",
        color: "#c0c0c0",
        hp: 75,
        mass: 1.4,
        speed: 4.5,
        rotationSpeed: 0.07,
        skills: {
            atk: { type: "LASER_BEAM", cooldown: 120, duration: 60, damage: 1, range: 360 }, // 1s active, 1s cooldown
            def: { type: "FORCE_FIELD", maxShield: 75, regenRate: 0.033 }, // 2 HP/sec @ 60fps
            ult: { type: "MISSILE_BARRAGE", cooldown: 120, damage: 9 }
        }
    },
    SNIPER: {
        name: "Sniper",
        color: "#556b2f",
        hp: 100,
        mass: 1.1,
        speed: 4.2,
        rotationSpeed: 0.08,
        skills: {
            atk: { type: "SNIPER_SHOT", cooldown: 90, damage: 12, stun: 60, projectileSpeed: 25 },
            def: { type: "CLAYMORE", cooldown: 180, damage: 5, lifeTime: 360, slowDuration: 120 },
            ult: { type: "SNIPER_MODE", cooldown: 300 }
        }
    },
    AXEMAN: {
        name: "Axeman",
        color: "#800000",
        hp: 100,
        mass: 1.5,
        speed: 4.2,
        rotationSpeed: 0.13,
        skills: {
            atk: { type: "AXE_SWING" },
            def: { type: "BERSERKER_RAGE" },
            ult: { type: "EXECUTE", cooldown: 180 }
        }
    }
};
