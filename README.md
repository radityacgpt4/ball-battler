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
    particles.spawn(projectile.impactParticleId, x, y);
    ```

### 2. Module Responsibilities (Where to Touch)

| Task | Files to Modify | Files NOT to Touch |
|------|-----------------|--------------------|
| **Add New Fighter** | `src/data/fighters.js`<br>`src/abilities/[New]Ability.js` | `Game.js`, `Fighter.js` |
| **Add New Projectile** | `src/abilities/[New]Ability.js` (Config properties) | `Game.js`, `Projectile.js` |
| **New Particle Effect** | `src/data/particleTemplates.js` | `Particles.js`, `Game.js` |
| **New Sound Effect** | `src/systems/Audio.js` (Add only if new synthesis needed) | `Game.js` |
| **New Status Effect** | `src/entities/Fighter.js` (Add logic), `src/systems/CombatText.js` | `Game.js` |

### 3. Tips for Avoiding Mistakes
1.  **Look for Registries First:** Use `particleTemplates`, `soundRegistry`, and `AbilityRegistry`. Do not hardcode values.
2.  **Configuration over Code:** Define behavior in the `Ability` class config or `Projectile` properties (`impactSound`, `piercing`, `statusEffect`).
3.  **Reuse Systems:** The `Particles` and `Audio` systems are generic renderers/synthesizers. Feed them data, don't change their logic unless adding a fundamental new *capability* (e.g., a new physics shape).

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
│   │   └── CollisionHandler.js # Generic Physics Resolver
│   ├── entities/
│   │   └── Projectile.js   # Composition container (Components/Properties)
│   ├── abilities/          # ALL fighter logic lives here
│   └── data/
│       ├── fighters.js     # Fighter balancing configs
│       └── particleTemplates.js # Visual effect definitions
```

## Features & Mechanics
*   **12+ Unique Fighters**: Distinct playstyles defined purely by Ability modules.
*   **Physics-Based Combat**: Mass, velocity, and elasticity drive gameplay.
*   **Data-Driven Visuals/Audio**: Procedural effects driven by configuration.

## Running the Game
```bash
npx serve .
```

## License
MIT
