/**
 * Fighter Configuration Data
 */
export const FIGHTER_TYPES = {
    SWORD_MASTER: {
        name: "Sword Master",
        color: "#ff6b6b",
        hp: 100, mass: 1.0, speed: 4.5, rotationSpeed: 0.15,
        skills: {
            atk: { name: "Melee Slash", desc: "Fast melee strikes with a high proc rate.", type: "MELEE_PASSIVE", range: 50, damage: 5, procRate: 3, isPassive: true },
            def: { name: "Parry", desc: "17% chance to block and negate incoming damage.", type: "PARRY_PASSIVE", chance: 0.17, isPassive: true },
            ult: { name: "Dash Assault", desc: "A powerful lunge that deals heavy damage.", type: "DASH_ASSAULT", cooldown: 150, damage: 7, isPassive: false }
        }
    },
    THUNDER_MAGE: {
        name: "Thundermage",
        color: "#4ecdc4",
        hp: 100, mass: 2.0, speed: 4, rotationSpeed: 0.12,
        skills: {
            atk: { name: "Lightning Bolt", desc: "Chain lightning that bounces between enemies.", type: "RAYCAST", cooldown: 90, range: 800, damage: 15, bounces: 3, isPassive: false },
            def: { name: "Static Field", desc: "Deals damage to nearby enemies passively.", type: "STATIC_PASSIVE", isPassive: true },
            ult: { name: "Double Zap", desc: "Fires two lightning bolts simultaneously.", type: "DOUBLE_ZAP", cooldown: 160, isPassive: false }
        }
    },
    SOLDIER: {
        name: "Rifleman",
        color: "#54a0ff",
        hp: 100, mass: 1.2, speed: 4, rotationSpeed: 0.12,
        skills: {
            atk: { name: "Burst Fire", desc: "Fires a rapid 10-shot burst of bullets.", type: "BURST_FIRE", cooldown: 100, count: 10, damage: 3, isPassive: false },
            def: { name: "Tactical Retreat", desc: "Dashes backward to gain distance from enemies.", type: "RETREAT", cooldown: 120, range: 150, isPassive: false },
            ult: { name: "Frag Grenade", desc: "Throws a grenade dealing massive AOE damage.", type: "GRENADE", cooldown: 60, damage: 20, isPassive: false }
        }
    },
    SHIELDBEARER: {
        name: "Shieldbearer",
        color: "#8b5cf6",
        hp: 100, mass: 1.8, speed: 4, rotationSpeed: 0.10,
        skills: {
            atk: { name: "Momentum Strike", desc: "Damage increases with movement speed.", type: "MOMENTUM_PASSIVE", maxSpeed: 8, speedGain: 1, damagePerTier: 5, knockback: 15, isPassive: true },
            def: { name: "Greatshield", desc: "Blocks all projectiles from a wide front arc.", type: "SHIELD_DEFLECT", arcAngle: Math.PI * 0.65, isPassive: true },
            ult: { name: "Wall Slam", desc: "Smashes enemies into walls for bonus damage.", type: "WALL_SLAM", cooldown: 120, damage: 10, isPassive: false }
        }
    },
    NINJA: {
        name: "Yellow Flash",
        color: "#ffd700",
        hp: 100, mass: 1.0, speed: 5, rotationSpeed: 0.16,
        skills: {
            atk: { name: "Flying Raijin", desc: "Throws marked kunai and teleports to them.", type: "KUNAI_MARK", cooldown: 120, count: 2, damage: 5, delay: 90, zapDuration: 45, isPassive: false },
            def: { name: "Substitution", desc: "Briefly becomes invincible and boosts speed.", type: "EVASION", cooldown: 102, duration: 12, isPassive: false },
            ult: { name: "Flash Barrage", desc: "A series of high-speed teleportation strikes.", type: "FLASH_BARRAGE", cooldown: 180, rasenganDamage: 12, isPassive: false }
        }
    },
    CYBORG: {
        name: "Cyborg",
        color: "#c0c0c0",
        hp: 75, mass: 1.4, speed: 4.5, rotationSpeed: 0.10,
        skills: {
            atk: { name: "Plasma Laser", desc: "Fires a continuous high-damage laser beam.", type: "LASER_BEAM", cooldown: 120, duration: 60, damage: 1, range: 360, isPassive: false },
            def: { name: "Energy Shield", desc: "Passive shield that regenerates over time.", type: "FORCE_FIELD", maxShield: 75, regenRate: 0.033, isPassive: true },
            ult: { name: "Missile Swarm", desc: "Launches a volley of homing missiles.", type: "MISSILE_BARRAGE", cooldown: 120, damage: 9, isPassive: false }
        }
    },
    SNIPER: {
        name: "Sniper",
        color: "#556b2f",
        hp: 100, mass: 1.1, speed: 4.2, rotationSpeed: 0.08,
        skills: {
            atk: { name: "Sniper Shot", desc: "High damage shot that stuns the target.", type: "SNIPER_SHOT", cooldown: 90, damage: 12, stun: 60, projectileSpeed: 25, isPassive: false },
            def: { name: "Claymore", desc: "Places a trap that slows and damages enemies.", type: "CLAYMORE", cooldown: 180, damage: 5, lifeTime: 360, slowDuration: 120, isPassive: false },
            ult: { name: "Steady Aim", desc: "Passively increases projectile speed and crit chance.", type: "SNIPER_MODE", cooldown: 300, isPassive: true }
        }
    },
    AXEMAN: {
        name: "Axeman",
        color: "#800000",
        hp: 100, mass: 1.5, speed: 4.2, rotationSpeed: 0.13,
        skills: {
            atk: { name: "Heavy Swing", desc: "Wields a giant axe with massive knockback.", type: "AXE_SWING", isPassive: true },
            def: { name: "Berserker Rage", desc: "Takes reduced damage but loses HP over time.", type: "BERSERKER_RAGE", isPassive: true },
            ult: { name: "Execution", desc: "Instantly kills low HP enemies.", type: "EXECUTE", cooldown: 60, isPassive: true }
        }
    },
    BALLISTA: {
        name: "Ballista",
        color: "#8B4513",
        hp: 100, mass: 2, speed: 3.5, rotationSpeed: 0.09,
        skills: {
            atk: { name: "Heavy Bolt", desc: "Piercing bolts that pin enemies to walls.", type: "BALLISTA_SHOT", cooldown: 90, damage: 15, projectileSpeed: 16, isPassive: false },
            def: { name: "Gate Barrier", desc: "Summons a series of protective barriers.", type: "BARRIER_SHIELD", barrierMaxHp: 30, barrierCount: 4, arcAngle: 1.22, isPassive: true },
            ult: { name: "Siege Mode", desc: "Doubles fire rate but disables movement.", type: "SIEGE_MODE", cooldown: 120, damage: 15, isPassive: false }
        }
    },
    DIVINE_GENERAL: {
        name: "Divine General",
        color: "#ffffff",
        hp: 100, mass: 1.3, speed: 4.8, rotationSpeed: 0.18,
        skills: {
            atk: { name: "Mahoraga Wheel", desc: "8 orbs act as melee hitboxes with large range.", type: "EIGHTFOLD_STRIKE", isPassive: true },
            def: { name: "Healing Stance", desc: "Stores 90% of damage taken and heals it after 5s.", type: "ADAPTATION_HEAL", isPassive: false },
            ult: { name: "Perfect Adaptation", desc: "Stores incoming damage to boost the next attack.", type: "ADAPTATION_ULT", cooldown: 180, isPassive: true }
        }
    },
    DIVINE_BRAWLER: {
        name: "Sorcerer Brawler",
        color: "#4B0082",
        hp: 110, mass: 1.6, speed: 5.4, rotationSpeed: 0.15,
        skills: {
            atk: { name: "Black Flash", desc: "Every 4th hit deals up to 6x damage based on HP.", type: "BLACK_FLASH", damage: 5, isPassive: true },
            def: { name: "Boogie Woogie", desc: "Claps to swap places and hijack enemy projectiles.", type: "BOOGIE_WOOGIE", cooldown: 150, isPassive: false },
            ult: { name: "Pure Focus", desc: "Becomes immovable and doubles attack speed.", type: "UNSHAKEABLE_FOCUS", cooldown: 600, duration: 300, isPassive: false }
        }
    },
    QUINCY: {
        name: "Spirit Archer",
        color: "#1E90FF",
        hp: 90, mass: 0.9, speed: 4.8, rotationSpeed: 0.12,
        skills: {
            atk: { name: "Heilig Pfeil", desc: "Predictive arrows that deal more damage at range.", type: "HEILIG_PFEIL", cooldown: 60, damage: 8, isPassive: false },
            def: { name: "Hirenkyaku", desc: "Blinks away from danger, leaving a stun trap.", type: "HIRENKYAKU", cooldown: 180, isPassive: false },
            ult: { name: "Licht Regen", desc: "Rains a cone of piercing light arrows.", type: "LICHT_REGEN", cooldown: 300, damage: 3, isPassive: false }
        }
    }
};
