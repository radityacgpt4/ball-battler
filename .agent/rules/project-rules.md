---
trigger: model_decision
description: Apply these rules when adding/modifying fighters, creating abilities, defining weapon visuals/hitboxes, or editing core engine modules (Game.js, Physics.js, CollisionHandler.js) to ensure Scalable-First (OCP) architecture.
---

# Ball Battler - Project Rules & Architecture Guidelines
## 🏗 Core Architecture: Scalable-First (OCP)
This project follows a strict **Open-Closed Principle (OCP)**. The core engine should be **open for extension but closed for modification**.
### 1. No Fighter-Specific Logic in Core
**STRICT RULE:** Do NOT use `if/else`, `switch`, or any conditional checks for specific fighter types, ability names, or projectile types in core engine files.
*   **Core Files:** `src/core/Game.js`, `src/core/Physics.js`, `src/core/CollisionHandler.js`.
*   **Violations:** `if (fighter.type === 'GOJO')`, `if (projectile.isQuincyArrow)`.
*   **Correct Pattern:** Use polymorphic methods, registries, or data-driven configurations.
### 2. Projectile Component System
Projectiles are composed of behaviors and renderers. Never use boolean flags for behavior logic.
*   **Composition:** `p.addComponent(new HomingBehavior(target))` + `p.renderer = new MissileRenderer()`.
*   **Behaviors:** Define in `src/components/ProjectileBehaviors.js`.
*   **Renderers:** Define in `src/components/ProjectileRenderers.js`.
### 3. Melee Weapon Geometry (Single Source of Truth)
All melee weapon visuals and hitboxes MUST be defined in `src/data/weaponGeometry.js`.
*   **Consistency:** This ensures hitboxes and visuals are perfectly synchronized.
*   **Usage:** Always use `checkWeaponHit(weaponId, fighter, enemy)` in ability files.
*   **Supported Types:** `single_blade`, `dual_blades`, `orb_ring`, `dual_fists`.
### 4. Registry & Template Usage
Never hardcode visual or audio parameters inside logic. Use the following registries:
*   **Particles:** `src/data/particleTemplates.js`
*   **Abilities:** `src/core/AbilityRegistry.js`
*   **Fighter Stats:** `src/data/fighters.js`
*   **Weapon Shapes:** `src/data/weaponGeometry.js`
### 5. Modification Guide (Where to touch)
| Task | Location | Forbidden |
| :--- | :--- | :--- |
| **New Fighter** | `src/data/fighters.js`, `src/abilities/` | `Game.js`, `Fighter.js` |
| **New Projectile** | `src/abilities/`, `src/components/` | `Projectile.js` core logic |
| **New Visual Effect** | `src/data/particleTemplates.js` | `Particles.js` core logic |
| **New Melee Weapon** | `src/data/weaponGeometry.js` | `Physics.js`, `CollisionHandler.js` |
### 6. Sound & Visual Excellence
*   Use `Particles.js` for all visual effects.
*   Use `Audio.js` for sound synthesis.
*   Visuals should feel "Premium" and "Anime-accurate" (gradients, high-quality particles, smooth transitions).
---
**Note to AI Agents:** If you find yourself modifying `Game.js` to add a specific feature for one fighter, you are likely doing it wrong. Find a way to make the core system support that feature generically via components or registry data.