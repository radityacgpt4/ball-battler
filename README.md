# Ball Battler - 1v1 Fighter Ball Auto Battler

> [!IMPORTANT]
> **ATTENTION AI AGENTS AND DEVELOPERS**
> This project follows a strict **Scalable-First (Open-Closed Principle)** architecture.
> **DO NOT** use `if/else` or `switch` statements to check for specific fighter types or ability names in core files (`Game.js`, `Physics.js`, `CollisionHandler.js`).
>
> If you find yourself writing `if (projectile.isQuincyArrow) { ... }` in a core file, **STOP**. You are breaking the architecture.

## 🤖 AI Development Guidelines

### 1. The Core Principle: Open for Extension, Closed for Modification
This engine is designed to support 50+ fighters. We cannot modify `Game.js` every time a new fighter is added.

*   **Bad Pattern (Do Not Use):**
    ```javascript
    // src/core/Game.js
    if (projectile.type === 'FIRE_BALL') {
        particles.spawnFire(x, y);
    } else if (projectile.type === 'ICE_SHARD') {
        particles.spawnIce(x, y);
    }
    ```
*   **Good Pattern (Use This):**
    ```javascript
    // src/core/Game.js
    // The engine doesn't care WHAT the particle is, just that it has an ID.
    particles.spawnEffect(projectile.impactParticle, x, y);
    ```

### 2. Projectile Component System
Projectiles no longer use "flags" (like `isMissile`) for behavior. Instead, they use a **Component Architecture**.

*   **Logic components:** Attach behaviors to projectiles in the ability class.
*   **Renderer components:** Define how the projectile looks (e.g., `new MissileRenderer()`).
*   **Example (Homing Missile):**
    ```javascript
    const p = new Projectile(...);
    p.renderer = new MissileRenderer();
    p.addComponent(new HomingBehavior(target));
    p.addComponent(new LinearMovement()); // Components run in order
    ```
*   **Extensions:**
    *   **Behaviors:** `src/components/ProjectileBehaviors.js`
    *   **Renderers:** `src/components/ProjectileRenderers.js`

### 3. Weapon Geometry Registry
**Problem Solved:** Weapon visuals and hitboxes were defined separately, causing sync issues and pixel-imperfect collisions.

**Solution:** `src/data/weaponGeometry.js` is now the **single source of truth** for all weapon shapes.

*   **How to Use in Abilities:**
    ```javascript
    // src/abilities/MyFighterAbility.js
    import { checkWeaponHit } from '../data/weaponGeometry.js';

    update(fighter, context) {
        for (const enemy of context.enemies) {
            if (checkWeaponHit('MY_WEAPON', fighter, enemy)) {
                // Pixel-perfect hit detected!
                enemy.takeDamage(this.damage, false, false, fighter);
            }
        }
    }
    ```

*   **Adding New Melee Weapons:**
    1. Define geometry in `weaponGeometry.js`:
       ```javascript
       MY_NEW_WEAPON: {
           type: 'single_blade',      // or 'dual_blades', 'orb_ring', 'dual_fists'
           bladeLength: 45,
           bladeWidth: 8,
           bladeOffsets: [{ x: 0, y: 0, rotation: 0 }]
       }
       ```
    2. Use in ability: `checkWeaponHit('MY_NEW_WEAPON', fighter, enemy)`
    3. Hitbox automatically matches visual (no manual sync needed!)

*   **Benefits:**
    - ✅ Hitboxes **automatically** match visuals
    - ✅ Change geometry once, updates everywhere
    - ✅ No manual synchronization needed
    - ✅ Pixel-perfect collision guaranteed

*   **Supported Weapon Types:**
    - `single_blade` / `dual_blades` - Line-based collision (swords, axes)
    - `orb_ring` - Multiple point collisions (Divine General's wheel)
    - `dual_fists` - Circle collision (Divine Brawler's melee range)

### 4. Module Responsibilities (Where to Touch)

| Task | Files to Modify | Files NOT to Touch |
|------|-----------------|--------------------|
| **Add New Fighter** | `src/data/fighters.js`<br>`src/abilities/[New]Ability.js` | `Game.js`, `Fighter.js` |
| **Add New Projectile** | `src/abilities/[New]Ability.js` (Config/Components) | `Game.js`, `Projectile.js` |
| **New Projectile Renderer** | `src/components/ProjectileRenderers.js` | `Projectile.js`, `Game.js` |
| **New Projectile Behavior** | `src/components/ProjectileBehaviors.js` | `Projectile.js`, `Game.js` |
| **New Particle Effect** | `src/data/particleTemplates.js` | `Particles.js`, `Game.js` |
| **New Sound Effect** | `src/systems/Audio.js` (Add only if new synthesis needed) | `Game.js` |
| **New Status Effect** | `src/entities/Fighter.js` (Add logic), `src/systems/CombatText.js` | `Game.js` |
| **New Melee Weapon** | `src/data/weaponGeometry.js`<br>`src/abilities/[Fighter]Ability.js` (Use `checkWeaponHit`) | `Game.js`, `Physics.js` |

### 5. Tips for Avoiding Mistakes
1.  **Look for Registries First:** Use `particleTemplates`, `soundRegistry`, `AbilityRegistry`, and `weaponGeometry`. Do not hardcode values.
2.  **Configuration over Code:** Define behavior in the `Ability` class config or `Projectile` properties (`impactSound`, `piercing`, `statusEffect`).
3.  **Reuse Systems:** The `Particles` and `Audio` systems are generic renderers/synthesizers. Feed them data, don't change their logic unless adding a fundamental new *capability* (e.g., a new physics shape).
4.  **Weapon Collisions:** Always use `checkWeaponHit()` from `weaponGeometry.js` for melee attacks. Never hardcode blade lengths, angles, or offsets in ability files.

---

## Project Structure

```
ball-battler/
├── index.html              # Entry point
├── src/
│   ├── core/
│   │   ├── Game.js         # Main Loop (Closed for modification)
│   │   └── AbilityRegistry.js
│   ├── systems/
│   │   ├── Particles.js    # Generic Particle Renderer
│   │   ├── Audio.js        # Generic Sound Synthesizer
│   │   ├── Physics.js      # Math/physics utilities
│   │   └── CollisionHandler.js # Generic Physics Resolver
│   ├── entities/
│   │   └── Projectile.js   # Composition container (Components/Properties)
│   ├── components/     # Reusable logic/visuals
│   │   ├── ProjectileBehaviors.js
│   │   └── ProjectileRenderers.js
│   ├── abilities/          # ALL fighter logic lives here
│   └── data/
│       ├── fighters.js     # Fighter balancing configs
│       ├── particleTemplates.js # Visual effect definitions
│       └── weaponGeometry.js # Weapon hitbox/visual registry (NEW!)
```

## Features & Mechanics
*   **12+ Unique Fighters**: Distinct playstyles defined purely by Ability modules.
*   **Physics-Based Combat**: Mass, velocity, and elasticity drive gameplay.
*   **Pixel-Perfect Hitboxes**: Weapon collisions automatically match visual representations via `weaponGeometry.js`.
*   **Data-Driven Visuals/Audio**: Procedural effects driven by configuration.

## Running the Game
```bash
npx serve .
```

## License
MIT
