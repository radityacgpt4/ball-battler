/**
 * Ability Registry
 * Central factory for creating abilities from type strings.
 * Eliminates switch statements and allows dynamic ability registration.
 */

// Import all ability classes
import { MeleeAbility } from '../abilities/MeleeAbility.js';
import { BurstFireAbility, KunaiAbility, GrenadeAbility, MissileBarrageAbility } from '../abilities/ProjectileAbility.js';
import { RaycastAbility, DoubleZapAbility, LaserAbility } from '../abilities/RaycastAbility.js';
import { DashAssaultAbility, RetreatAbility, FlashBarrageAbility } from '../abilities/DashAbility.js';
import { ParryPassiveAbility, EvasionAbility, StaticPassiveAbility, ShieldDeflectAbility, MomentumPassiveAbility, ForceFieldAbility } from '../abilities/PassiveAbility.js';
import { WallSlamAbility } from '../abilities/SpecialAbility.js';
import { SniperAtkAbility, ClaymoreAbility, SniperUltAbility } from '../abilities/SniperAbility.js';
import { AxeAtkAbility, BerserkerDefAbility, ExecuteUltAbility } from '../abilities/AxeAbility.js';
import { BallistaAtkAbility, BallistaDefAbility, BallistaUltAbility } from '../abilities/BallistaAbility.js';
import { DivineGeneralAtkAbility, DivineGeneralDefAbilityWithUlt, DivineGeneralUltAbility } from '../abilities/DivineGeneralAbility.js';
import { DivineBrawlerAtkAbility, DivineBrawlerDefAbility, DivineBrawlerUltAbility } from '../abilities/DivineBrawlerAbility.js';
import { QuincyAtkAbility, QuincyDefAbility, QuincyUltAbility } from '../abilities/QuincyAbility.js';
import { KingOfCursesAtkAbility, KingOfCursesDefAbility, KingOfCursesUltAbility } from '../abilities/KingOfCursesAbility.js';
import { GatlingAbility, BalloonAbility, ConquerorHakiAbility } from '../abilities/RubberCaptainAbility.js';
import { ZoltraakAbility, HexBarrierAbility, BlackholeAbility } from '../abilities/FrierenAbility.js';

class AbilityRegistryClass {
    constructor() {
        this.registry = new Map();
        this.registerDefaults();
    }

    /**
     * Register an ability constructor
     * @param {string} type - Ability type string (e.g., 'MELEE_PASSIVE')
     * @param {Function} constructor - The ability class constructor
     */
    register(type, constructor) {
        this.registry.set(type, constructor);
    }

    /**
     * Create an ability instance from type string
     * @param {string} type - Ability type string
     * @param {Object} config - Ability configuration
     * @param {string} slot - Ability slot ('atk', 'def', 'ult')
     * @param {Object} extraArgs - Additional arguments for specific abilities
     * @returns {Ability|null} The created ability instance
     */
    create(type, config, slot, extraArgs = {}) {
        const Constructor = this.registry.get(type);
        if (!Constructor) {
            console.warn(`AbilityRegistry: Unknown ability type "${type}"`);
            return null;
        }

        // Handle abilities that need extra constructor arguments
        if (type === 'DOUBLE_ZAP' && extraArgs.atkConfig) {
            return new Constructor(config, slot, extraArgs.atkConfig);
        }
        if (type === 'FLASH_BARRAGE' && extraArgs.atkConfig && extraArgs.ProjectileClass) {
            return new Constructor(config, slot, extraArgs.atkConfig, extraArgs.ProjectileClass);
        }

        return new Constructor(config, slot);
    }

    /**
     * Check if an ability type is registered
     * @param {string} type - Ability type string
     * @returns {boolean}
     */
    has(type) {
        return this.registry.has(type);
    }

    /**
     * Get all registered ability types
     * @returns {string[]}
     */
    getTypes() {
        return Array.from(this.registry.keys());
    }

    /**
     * Register all default abilities
     */
    registerDefaults() {
        // Attack abilities
        this.register('MELEE_PASSIVE', MeleeAbility);
        this.register('RAYCAST', RaycastAbility);
        this.register('BURST_FIRE', BurstFireAbility);
        this.register('KUNAI_MARK', KunaiAbility);
        this.register('MOMENTUM_PASSIVE', MomentumPassiveAbility);
        this.register('LASER_BEAM', LaserAbility);
        this.register('SNIPER_SHOT', SniperAtkAbility);
        this.register('AXE_SWING', AxeAtkAbility);
        this.register('BALLISTA_SHOT', BallistaAtkAbility);
        this.register('EIGHTFOLD_STRIKE', DivineGeneralAtkAbility);
        this.register('BLACK_FLASH', DivineBrawlerAtkAbility);
        this.register('HEILIG_PFEIL', QuincyAtkAbility);
        this.register('DISMANTLE_SLASH', KingOfCursesAtkAbility);
        this.register('GATLING_PUNCH', GatlingAbility);

        // Defense abilities
        this.register('PARRY_PASSIVE', ParryPassiveAbility);
        this.register('STATIC_PASSIVE', StaticPassiveAbility);
        this.register('RETREAT', RetreatAbility);
        this.register('SHIELD_DEFLECT', ShieldDeflectAbility);
        this.register('EVASION', EvasionAbility);
        this.register('FORCE_FIELD', ForceFieldAbility);
        this.register('CLAYMORE', ClaymoreAbility);
        this.register('BERSERKER_RAGE', BerserkerDefAbility);
        this.register('BARRIER_SHIELD', BallistaDefAbility);
        this.register('ADAPTATION_HEAL', DivineGeneralDefAbilityWithUlt);
        this.register('BOOGIE_WOOGIE', DivineBrawlerDefAbility);
        this.register('HIRENKYAKU', QuincyDefAbility);
        this.register('DOMAIN_EXPANSION', KingOfCursesDefAbility);
        this.register('BALLOON_DEFLECT', BalloonAbility);

        // Ultimate abilities
        this.register('DASH_ASSAULT', DashAssaultAbility);
        this.register('DOUBLE_ZAP', DoubleZapAbility);
        this.register('GRENADE', GrenadeAbility);
        this.register('WALL_SLAM', WallSlamAbility);
        this.register('FLASH_BARRAGE', FlashBarrageAbility);
        this.register('MISSILE_BARRAGE', MissileBarrageAbility);
        this.register('SNIPER_MODE', SniperUltAbility);
        this.register('EXECUTE', ExecuteUltAbility);
        this.register('SIEGE_MODE', BallistaUltAbility);
        this.register('ADAPTATION_ULT', DivineGeneralUltAbility);
        this.register('UNSHAKEABLE_FOCUS', DivineBrawlerUltAbility);
        this.register('LICHT_REGEN', QuincyUltAbility);
        this.register('WORLD_SLASH_MODE', KingOfCursesUltAbility);
        this.register('CONQUEROR_HAKI', ConquerorHakiAbility);

        // Frieren abilities
        this.register('ZOLTRAAK', ZoltraakAbility);
        this.register('HEX_BARRIER', HexBarrierAbility);
        this.register('BLACKHOLE', BlackholeAbility);
    }
}

// Export singleton instance
export const AbilityRegistry = new AbilityRegistryClass();
