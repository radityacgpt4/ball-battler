/**
 * Fighter Configuration Data
 *
 * ALL ability properties are configured here for easy balancing.
 * Each skill config contains ALL adjustable parameters used by its ability class.
 */
export const FIGHTER_TYPES = {
    SWORD_MASTER: {
        name: "Sword Master",
        color: "#ff6b6b",
        hp: 100, mass: 1.0, speed: 4.5, rotationSpeed: 0.15,
        skills: {
            atk: {
                name: "Melee Slash",
                desc: "Fast melee strikes with a high proc rate.",
                type: "MELEE_PASSIVE",
                isPassive: true,
                // Configurable properties
                range: 50,
                damage: 7,
                procRate: 3,
                attackCooldown: 20
            },
            def: {
                name: "Parry",
                desc: "17% chance to block and negate incoming damage.",
                type: "PARRY_PASSIVE",
                isPassive: true,
                // Configurable properties
                chance: 0.17
            },
            ult: {
                name: "Dash Assault",
                desc: "A powerful lunge that deals heavy damage.",
                type: "DASH_ASSAULT",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                damage: 8,
                dashDistance: 300,
                dashTimer: 15
            }
        }
    },
    THUNDER_MAGE: {
        name: "Thundermage",
        color: "#4ecdc4",
        hp: 100, mass: 1.5, speed: 4, rotationSpeed: 0.12,
        skills: {
            atk: {
                name: "Lightning Bolt",
                desc: "Chain lightning that bounces between enemies.",
                type: "RAYCAST",
                isPassive: false,
                // Configurable properties
                cooldown: 60,
                range: 800,
                damage: 15,
                bounces: 2,
                damageDecayWall: 0.9,
                damageDecayShield: 0.9
            },
            def: {
                name: "Static Field",
                desc: "Deals damage to nearby enemies passively.",
                type: "STATIC_PASSIVE",
                isPassive: true,
                // Configurable properties
                radius: 60,
                damage: 5,
                tickRate: 30
            },
            ult: {
                name: "Double Zap",
                desc: "Fires two lightning bolts simultaneously.",
                type: "DOUBLE_ZAP",
                isPassive: false,
                // Configurable properties
                cooldown: 100,
                angleSpread: 0.20
            }
        }
    },
    SOLDIER: {
        name: "Rifleman",
        color: "#54a0ff",
        hp: 100, mass: 1.2, speed: 4, rotationSpeed: 0.12,
        skills: {
            atk: {
                name: "Burst Fire",
                desc: "Fires a rapid 10-shot burst of bullets.",
                type: "BURST_FIRE",
                isPassive: false,
                // Configurable properties
                cooldown: 100,
                count: 10,
                damage: 3,
                projectileSpeed: 15,
                spreadAmount: 0.15,
                burstDelay: 2
            },
            def: {
                name: "Tactical Retreat",
                desc: "Dashes backward to gain distance from enemies.",
                type: "RETREAT",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                range: 150,
                dashSpeed: 8,
                dashTimer: 30
            },
            ult: {
                name: "Frag Grenade",
                desc: "Throws a grenade dealing massive AOE damage.",
                type: "GRENADE",
                isPassive: false,
                // Configurable properties
                cooldown: 60,
                damage: 20,
                explosionRadius: 80,
                airTime: 45,
                maxDistance: 400,
                radius: 6
            }
        }
    },
    SHIELDBEARER: {
        name: "Shieldbearer",
        color: "#8b5cf6",
        hp: 100, mass: 1.6, speed: 4, rotationSpeed: 0.10,
        skills: {
            atk: {
                name: "Momentum Strike",
                desc: "Damage increases with movement speed.",
                type: "MOMENTUM_PASSIVE",
                isPassive: true,
                // Configurable properties
                maxSpeed: 8,
                speedGain: 1,
                damagePerTier: 5,
                knockback: 12
            },
            def: {
                name: "Greatshield",
                desc: "Blocks all projectiles from a wide front arc.",
                type: "SHIELD_DEFLECT",
                isPassive: true,
                // Configurable properties
                arcAngle: Math.PI * 0.65,
                shieldRadius: 8
            },
            ult: {
                name: "Wall Slam",
                desc: "Smashes enemies into walls for bonus damage.",
                type: "WALL_SLAM",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                damage: 10,
                stunDuration: 60,
                wallBonusDamage: 15
            }
        }
    },
    NINJA: {
        name: "Yellow Flash",
        color: "#ffd700",
        hp: 100, mass: 1.0, speed: 5, rotationSpeed: 0.16,
        skills: {
            atk: {
                name: "Flying Raijin",
                desc: "Throws marked kunai and teleports to them.",
                type: "KUNAI_MARK",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                count: 2,
                damage: 7,
                delay: 90,
                zapDuration: 60,
                zapImmunityDuration: 60,
                kunaiSpeed: 7,
                kunaiSpeedVariance: 2,
                coneAngle: Math.PI,
                maxDist: 220,
                maxDistVariance: 40
            },
            def: {
                name: "Substitution",
                desc: "Briefly becomes invincible and boosts speed.",
                type: "EVASION",
                isPassive: false,
                // Configurable properties
                cooldown: 102,
                duration: 12
            },
            ult: {
                name: "Flash Barrage",
                desc: "A series of high-speed teleportation strikes.",
                type: "FLASH_BARRAGE",
                isPassive: false,
                // Configurable properties
                cooldown: 180,
                rasenganDamage: 12,
                kunaiCount: 2,
                kunaiSpeed: 9,
                maxDistBase: 350,
                maxDistRatio: 0.4
            }
        }
    },
    CYBORG: {
        name: "Cyborg",
        color: "#c0c0c0",
        hp: 75, mass: 1.4, speed: 4.5, rotationSpeed: 0.10,
        skills: {
            atk: {
                name: "Plasma Laser",
                desc: "Fires a continuous high-damage laser beam.",
                type: "LASER_BEAM",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                duration: 180,
                chargeTime: 120,
                damage: 1,
                range: 2000,
                rotationSlow: 0.15,
                speedSlow: 0.50,
                beamWidth: 14,
                coreWidth: 5,
                tickRate: 3,
                slowDuration: 45
            },
            def: {
                name: "Energy Shield",
                desc: "Passive shield that regenerates over time.",
                type: "FORCE_FIELD",
                isPassive: true,
                // Configurable properties
                maxShield: 75,
                regenRate: 0.033,
                regenTickFrames: 30
            },
            ult: {
                name: "Missile Swarm",
                desc: "Launches a volley of homing missiles.",
                type: "MISSILE_BARRAGE",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                damage: 7,
                count: 5,
                spreadAngle: 0.5,
                projectileSpeed: 6,
                turnSpeed: 0.08,
                radius: 6
            }
        }
    },
    SNIPER: {
        name: "Sniper",
        color: "#556b2f",
        hp: 100, mass: 1.1, speed: 4.2, rotationSpeed: 0.08,
        skills: {
            atk: {
                name: "Sniper Shot",
                desc: "High damage shot that stuns the target.",
                type: "SNIPER_SHOT",
                isPassive: false,
                // Configurable properties
                cooldown: 90,
                damage: 12,
                stun: 45,
                projectileSpeed: 21,
                ultProjectileSpeed: 24, // Faster during Steady Aim
                projectileRadius: 5,
                ultProjectileRadius: 8,
                recoilForce: 22,
                laserMaxDist: 800
            },
            def: {
                name: "Claymore",
                desc: "Places a trap that slows and damages enemies.",
                type: "CLAYMORE",
                isPassive: false,
                // Configurable properties
                cooldown: 180,
                damage: 5,
                lifeTime: 360,
                slowDuration: 120,
                triggerRadius: 10,
                slideSpeed: 2
            },
            ult: {
                name: "Steady Aim",
                desc: "Passively increases projectile speed and crit chance.",
                type: "SNIPER_MODE",
                isPassive: true,
                // Configurable properties
                cooldown: 300,
                duration: 600
            }
        }
    },
    AXEMAN: {
        name: "Axeman",
        color: "#800000",
        hp: 100, mass: 1.4, speed: 4.2, rotationSpeed: 0.13,
        skills: {
            atk: {
                name: "Heavy Swing",
                desc: "Wields a giant axe with massive knockback.",
                type: "AXE_SWING",
                isPassive: true,
                // Configurable properties
                range: 65,
                damage: 9,
                bleedDuration: 240,
                swingCooldown: 15,
                blockedCooldown: 20,
                comboTimer: 90,
                comboThreshold: 2
            },
            def: {
                name: "Berserker Rage",
                desc: "Takes reduced damage but loses HP over time.",
                type: "BERSERKER_RAGE",
                isPassive: true,
                // Configurable properties
                stackThreshold: 0.1,
                speedBonusPerStack: 0.11,
                rotBonusPerStack: 0.17
            },
            ult: {
                name: "Execution",
                desc: "Instantly kills low HP enemies.",
                type: "EXECUTE",
                isPassive: true,
                // Configurable properties
                cooldown: 60,
                executeRange: 80,
                executeThreshold: 30,
                stunDuration: 45,
                stunDamage: 5,
                ultVisualDuration: 30,
                comboRequired: 2
            }
        }
    },
    BALLISTA: {
        name: "Ballista",
        color: "#8B4513",
        hp: 100, mass: 1.6, speed: 3.5, rotationSpeed: 0.1,
        skills: {
            atk: {
                name: "Heavy Bolt",
                desc: "Piercing bolts that pin enemies to walls.",
                type: "BALLISTA_SHOT",
                isPassive: false,
                // Configurable properties
                cooldown: 90,
                damage: 15,
                projectileSpeed: 16,
                spreadAngle: 0.15,
                boltRadius: 8,
                dragDuration: 25,
                normalBoltCount: 2
            },
            def: {
                name: "Gate Barrier",
                desc: "Summons a series of protective barriers.",
                type: "BARRIER_SHIELD",
                isPassive: true,
                // Configurable properties
                barrierMaxHp: 30,
                barrierCount: 4,
                arcAngle: 1.22,
                shieldRadius: 8
            },
            ult: {
                name: "Defensive Tower",
                desc: "Deploys auto-firing towers (max 3). Towers last 4s and have 20 HP.",
                type: "SIEGE_MODE",
                isPassive: false,
                // Tower properties
                spawnInterval: 120,
                maxTowers: 3,
                towerHp: 20,
                towerLifetime: 240,
                towerFireRate: 60,
                towerRotationSpeed: 0.04,
                towerBoltDamage: 8,
                towerBoltSpeed: 10,
                towerRadius: 15
            }
        }
    },
    DIVINE_GENERAL: {
        name: "Divine General",
        color: "#ffffff",
        hp: 100, mass: 1.6, speed: 4.8, rotationSpeed: 0.18,
        skills: {
            atk: {
                name: "Mahoraga Wheel",
                desc: "8 orbs act as melee hitboxes with large range.",
                type: "EIGHTFOLD_STRIKE",
                isPassive: true,
                // Configurable properties
                baseDamage: 2,
                resetTime: 300,
                orbCount: 8,
                orbRadius: 3,
                orbDistance: 18,
                attackCooldown: 12
            },
            def: {
                name: "Healing Stance",
                desc: "Stores 90% of damage taken and heals it after 5.5s.",
                type: "ADAPTATION_HEAL",
                isPassive: false,
                // Configurable properties
                healDelay: 330,
                healPercent: 0.9
            },
            ult: {
                name: "Perfect Adaptation",
                desc: "Stores incoming damage to boost the next attack.",
                type: "ADAPTATION_ULT",
                isPassive: true,
                // Configurable properties
                cooldown: 180,
                duration: 60,
                adaptationMaxStored: 15,
                hpThreshold: 0.5
            }
        }
    },
    DIVINE_BRAWLER: {
        name: "Sorcerer Brawler",
        color: "#4B0082",
        hp: 100, mass: 1.5, speed: 5.4, rotationSpeed: 0.15,
        skills: {
            atk: {
                name: "Black Flash",
                desc: "Every 4th hit deals up to 6x damage based on HP.",
                type: "BLACK_FLASH",
                isPassive: true,
                // Configurable properties
                damage: 5,
                range: 15,
                hitCountForCrit: 4,
                critMultHigh: 6,
                critMultMid: 3,
                critMultLow: 2,
                hpThresholdHigh: 0.8,
                hpThresholdMid: 0.5,
                baseKnockback: 12,
                knockbackPerMult: 0,
                baseAttackCooldown: 20,
                focusAttackCooldown: 10
            },
            def: {
                name: "Boogie Woogie",
                desc: "Claps to swap places and hijack enemy projectiles.",
                type: "BOOGIE_WOOGIE",
                isPassive: false,
                // Configurable properties
                cooldown: 150,
                projectileCooldown: 120,
                fallbackCooldown: 240,
                detectionRadius: 120,
                approachThreshold: 0.7,
                deflectLifetime: 180
            },
            ult: {
                name: "Pure Focus",
                desc: "Becomes immovable and doubles attack speed.",
                type: "UNSHAKEABLE_FOCUS",
                isPassive: false,
                // Configurable properties
                cooldown: 240,
                duration: 180,
                immovableMass: 16
            }
        }
    },
    QUINCY: {
        name: "Spirit Archer",
        color: "#1E90FF",
        hp: 90, mass: 0.9, speed: 4.8, rotationSpeed: 0.12,
        skills: {
            atk: {
                name: "Heilig Pfeil",
                desc: "Predictive arrows that deal more damage at range.",
                type: "HEILIG_PFEIL",
                isPassive: false,
                // Configurable properties
                cooldown: 60,
                damage: 8,
                projectileSpeed: 18,
                perfectLockSpeed: 20,
                lockChargeRate: 3,
                lockDecayRate: 0.92,
                perfectLockThreshold: 100,
                alignmentThreshold: 0.3,
                predictionFrames: 20,
                farRangeThreshold: 280,
                closeRangeThreshold: 120,
                farDamageMultiplier: 1.5,
                closeDamageMultiplier: 0.6,
                lockBonusMultiplier: 1.3,
                normalRadius: 4,
                perfectRadius: 6
            },
            def: {
                name: "Hirenkyaku",
                desc: "Blinks away from danger, leaving a stun trap.",
                type: "HIRENKYAKU",
                isPassive: false,
                // Configurable properties
                cooldown: 180,
                dangerRadius: 100,
                blinkDistance: 150,
                trapDuration: 180,
                trapStunDuration: 30,
                trapRadius: 8
            },
            ult: {
                name: "Licht Regen",
                desc: "Rains piercing arrows from above.",
                type: "LICHT_REGEN",
                isPassive: false,
                // Configurable properties
                cooldown: 180,
                damage: 5,
                arrowCount: 5,
                stunDuration: 45,
                arrowSpeed: 22,
                arrowRadius: 2,
                rainHeight: 150,
                rainSpread: 120,
                plantedArrowLifeTime: 120
            }
        }
    },
    KING_OF_CURSES: {
        name: "King of Curses",
        color: "#DC143C", // Crimson/Blood Red
        hp: 100, mass: 1.5, speed: 5.0, rotationSpeed: 0.16,
        skills: {
            atk: {
                name: "Cleave",
                desc: "Relentless cuts that shred enemies within the Domain.",
                type: "DISMANTLE_SLASH",
                isPassive: false,
                // Configurable properties
                cooldown: 6, // 10 hits per second (10 DPS)
                damage: 1,
                range: 125
            },
            def: {
                name: "Domain Expansion: Malevolent Shrine",
                desc: "A domain that slows and stuns enemies who stay too long.",
                type: "DOMAIN_EXPANSION",
                isPassive: true,
                // Configurable properties
                domainRadius: 125, // Diameter 250
                slowAmount: 0.2, // 20% slow
                stunDelay: 60, // 1 second before stun
                stunDuration: 60 // 1 second stun
            },
            ult: {
                name: "World Cutting Slash",
                desc: "Transforms attack into a dimension-cutting slash.",
                type: "WORLD_SLASH_MODE",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                duration: 360,
                slashDamage: 8,
                slashSpeed: 18,
                slashFireRate: 60,
                slashWidth: 160, // Parabolic width
                dragStrength: 0.15 // Drag factor
            }
        }
    },
    RUBBER_CAPTAIN: {
        name: "Pirate King",
        color: "#ff4500", // Orange/Red
        hp: 100, mass: 1.2, speed: 5.2, rotationSpeed: 0.14,
        skills: {
            atk: {
                name: "Gomu Gomu Gatling",
                desc: "Rapid fire punches that keep enemies at bay.",
                type: "GATLING_PUNCH",
                isPassive: false,
                // Configurable properties
                chargeTime: 15,
                duration: 120,
                fistDamage: 1,
                fireRate: 3,
                range: 240,
                spread: 0.25,
                cooldown: 120
            },
            def: {
                name: "Balloon",
                desc: "Inflates body to deflect projectiles and bounce melee attackers.",
                type: "BALLOON_DEFLECT",
                isPassive: true, // It's an active toggle usually, but config style? 
                // Config:
                isPassive: false, // Auto-cast when ready
                cooldown: 180,
                duration: 120,
                inflateSize: 1.5
            },
            ult: {
                name: "Conqueror Haki",
                desc: "Stuns and knocks back all nearby enemies.",
                type: "CONQUEROR_HAKI",
                isPassive: false,
                // Configurable properties
                cooldown: 300,
                radius: 350,
                stunDuration: 120, // 2 seconds
                knockback: 25
            }
        }
    },
    MAGE_OF_ERA: {
        name: "Mage of the Era",
        color: "#4fc3f7", // Light blue
        hp: 90, mass: 0.9, speed: 5.2, rotationSpeed: 0.14,
        skills: {
            atk: {
                name: "Zoltraak",
                desc: "Ordinary offensive magic. Heavy high-speed mana beams.",
                type: "ZOLTRAAK",
                isPassive: false,
                // Configurable properties
                damage: 5,
                speed: 50,
                range: 500,
                cooldown: 180, // Full cooldown after burst finishes
                homingStrength: 0.018,
                aimError: 0.55,
                recoil: 3.5,
                burstCount: 4,  // Firing 4 times
                burstDelay: 6   // Frames between shots
            },
            def: {
                name: "Hexagonal Barrier",
                desc: "A modular magic shield that can shatter on melee attackers.",
                type: "HEX_BARRIER",
                isPassive: true,
                // Configurable properties
                arcAngle: 1.8,
                shieldRadius: 10,
                shatterChance: 0.5,
                shatterDamage: 5
            },
            ult: {
                name: "The Great Void",
                desc: "Creates a blackhole that pulls enemies and slows movement.",
                type: "BLACKHOLE",
                isPassive: false,
                // Configurable properties
                cooldown: 360,
                duration: 240,
                radius: 120,
                pullStrength: 1.8,
                dotDamage: 1,
                dotRate: 10,
                launchSpeed: 4,  // Initial fire velocity
                friction: 0.95,  // Deceleration speed (1 = none)
                growthSpeed: 0.04 // Speed of "birth" animation
            }
        }
    },
    MECHA: {
        name: "Mecha",
        color: "#1E90FF", // Gundam Blue (Wing Zero inspired)
        hp: 100, mass: 1.3, speed: 4.2, rotationSpeed: 0.14,
        skills: {
            atk: {
                name: "Beam Rifle",
                desc: "Fires an energy projectile that explodes on impact, followed by a melee dash.",
                type: "MECHA_BEAM",
                isPassive: false,
                // Configurable properties
                cooldown: 90,
                projectileDamage: 6,
                explosionDamage: 4,
                stunDuration: 30, //
                projectileSpeed: 36,
                explosionRadius: 80,
                // Melee dash properties
                meleeDamage: 3,
                dashSpeed: 24,
                dashDistance: 1000,
                ultDashDistance: 1400,
                dashDelay: 12,
                aimError: 0.5,
                meleeRotationMultiplier: 5,
                twinBarrelOffset: 10
            },
            def: {
                name: "Thruster Dodge",
                desc: "Side dashes when enemies or projectiles approach.",
                type: "MECHA_DODGE",
                isPassive: false,
                // Configurable properties
                cooldown: 90,
                detectionRadius: 90,
                approachThreshold: 0.6,
                dodgeDistance: 30,
                dodgeSpeed: 14
            },
            ult: {
                name: "Twin Cannon Protocol",
                desc: "Activates twin-barreled cannons and boosted thrusters. Fires 2 lasers at once and increases melee dash range by 30%.",
                type: "MECHA_ULT_MODE",
                isPassive: false,
                cooldown: 300,
                duration: 600 // 10 seconds
            }
        }
    },
    LEVI: {
        name: "Titan Killer",
        color: "#4A5D4E", // Survey Corps Green
        hp: 90, mass: 0.8, speed: 4.0, rotationSpeed: 0.08,
        skills: {
            atk: {
                name: "Sword Shred",
                desc: "Rotation speed scales with movement speed. Every 8th hit is CRITICAL.",
                type: "SWORD_SHRED",
                isPassive: true,
                // Configurable properties
                baseDamage: 2,
                range: 35, // Matches visual blade length (updated from 33)
                attackCooldown: 12, // Base cooldown (decreases with speed)
                minCooldown: 2,     // Minimum cooldown at max speed
                maxRotationSpeed: 0.6, // Cap for rotation speed scaling
                speedScaleFactor: 0.0372, // How much rotation increases per speed unit
                // Critical hit system
                criticalHitCount: 8, // Every 8th hit is critical
                criticalBonusDamage: 5, // +5 damage on critical
                criticalResetTimer: 120 // 2 seconds to reset hit count
            },
            def: {
                name: "ODM Maneuver",
                desc: "15% base evasion. +50% during flight. 1s linger after sticking.",
                type: "ODM_MANEUVER",
                isPassive: false,
                // Configurable properties
                cooldown: 45,
                hookRange: 500,
                hookSpeed: 22,
                speedBuildupPerUnit: 0.025, // Reach max speed in 400 range ( (14-4)/400 )
                maxSpeed: 14,
                baseEvasionChance: 0.15, // 15% base evasion always active
                flightEvasionBonus: 0.50, // +50% during flight (total 65%)
                evasionLingerTime: 60, // 1 second linger after sticking
                stickDuration: 90, // 1.5 second
                jumpAwayForce: 8
            },
            ult: {
                name: "Godspeed ODM",
                desc: "Fires hooks 1.5x faster. Rope speed doubled.",
                type: "GODSPEED_ODM",
                isPassive: false,
                // Configurable properties
                cooldown: 240,
                duration: 300, // 5 seconds
                fireRateMultiplier: 1.5,
                hookSpeedMultiplier: 2.0,
                maxSpeedBoost: 18 // Increased max speed cap during ult
            }
        }
    },
    SOUL_REAPER: {
        name: "Soul Reaper",
        color: "#FF6600", // Ichigo's orange spiritual pressure
        hp: 100, mass: 1.2, speed: 4.8, rotationSpeed: 0.16,
        skills: {
            atk: {
                name: "Zangetsu Slash",
                desc: "Rotation-based melee attack with an oversized khyber knife.",
                type: "ZANGETSU_SLASH",
                isPassive: true,
                // Configurable properties
                range: 60,
                damage: 7,
                attackCooldown: 12
            },
            def: {
                name: "Getsuga Tenshou",
                desc: "Every 5 HP missing, unleash a crescent energy wave in facing direction.",
                type: "GETSUGA_TENSHOU",
                isPassive: true,
                // Configurable properties
                hpThreshold: 5,
                damage: 8,
                ultDamage: 10, // Damage in Bankai form
                projectileSpeed: 16,
                explosionRadius: 75,
                explosionDamage: 6,
                explosionUltDamage: 8,
                stunDuration: 60, // 1 second stun
                getsugaDelay: 8, // Frames between each getsuga
                explodeOnWall: true
            },
            ult: {
                name: "Bankai: Tensa Zangetsu",
                desc: "Transform into Bankai. Grants 15% base evasion (+3% per 5 HP lost) and pulsing spiritual pressure.",
                type: "BANKAI_MODE",
                isPassive: false,
                // Configurable properties
                cooldown: 300,
                duration: 480, // 8 seconds
                speedBoost: 0.75, // 75% increase
                rotationBoost: 0.75, // 75% increase
                bankaiPulseInterval: 90, // Every 1.5 seconds
                bankaiPulseRadius: 180,
                bankaiPulseStun: 45, // 0.75 second stun
                // Evasion properties
                baseEvasion: 0.15,
                extraEvasionPerStep: 0.05, // +3% evasion
                hpStep: 5,                 // for every 5 HP lost
                maxEvasion: 0.6,          // Cap
                evasionHPThreshold: 0.5    // Starts scaling below 50% HP
            }
        }
    },
    SORCERER_INFINITY: {
        name: "Sorcerer of Infinity",
        color: "#ffffff", // Pure White / Light Blue Eyes theme
        hp: 100, mass: 1.1, speed: 4.8, rotationSpeed: 0.14,
        skills: {
            atk: {
                name: "Cursed Technique Reversal: Red",
                desc: "Fires a repelling red orb. Deals massive damage to enemies trapped in Blue.",
                type: "GOJO_RED",
                isPassive: false,
                // Configurable properties
                cooldown: 90,
                damage: 7,
                critDamage: 15,
                projectileSpeed: 11,
                knockback: 18,
                radius: 12,
                range: 400,
                explosionRadius: 60,
                explodeOnWall: true
            },
            def: {
                name: "Cursed Technique Amplification: Blue",
                desc: "Creates a powerful attractive force that traps enemies.",
                type: "GOJO_BLUE",
                isPassive: false,
                // Configurable properties
                cooldown: 120,
                duration: 180,
                radius: 120,
                pullStrength: 2.1,
                damage: 0,
                launchSpeed: 2.9,
                friction: 0.87,
                growthSpeed: 0.3
            },
            ult: {
                name: "Limitless: Infinity",
                desc: "Stops projectiles and slows enemies within range. Frozen projectiles expire after 2s.",
                type: "INFINITY_VOID",
                isPassive: false,
                // Configurable properties
                cooldown: 240,
                activeDuration: 180,
                rechargeTime: 90,
                stopRadius: 100,
                slowRadius: 200,
                slowAmount: 0.8,
                projectileExpiry: 120
            }
        }
    }
};
