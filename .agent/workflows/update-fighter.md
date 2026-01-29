---
description: Update an existing fighter (modify abilities, rework visuals, or tune stats) following OCP principles.
---

1. **Locate Target Fighter**
   Identify the fighter's configuration in `src/data/fighters.js` and their logic in `src/abilities/[FighterName]Ability.js`.
2. **Modify Ability Logic**
   Update the `update()` method in the fighter's specific ability class. 
   **STRICT:** Do not move this logic into `Game.js`. If you need new generic behavior, add a component to `src/components/ProjectileBehaviors.js` instead.
3. **Rework Visuals / Particles**
   If updating visual effects, modify the templates in `src/data/particleTemplates.js`. 
   If changing a projectile's look, update its `renderer` in the ability class or add a new renderer to `src/components/ProjectileRenderers.js`.
4. **Update Weapon Geometry**
   If the melee weapon's length, width, or offset needs changing, modify the entry in `src/data/weaponGeometry.js`. 
   The hitbox and visual will update automatically.
5. **Tune Stats**
   Adjust health, speed, mass, or ability cooldowns in `src/data/fighters.js`.
6. **Verify and Test**
   // turbo
   Run the game to verify that the changes feel "Premium" and do not break the physics of other fighters.
