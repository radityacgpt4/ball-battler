---
description: Create a new fighter following the Scalable-First architecture
---

1. **Define Fighter Configuration**
   Add the new fighter's stats (HP, speed, base damage, color) to `src/data/fighters.js`.
   
2. **Create Ability Module**
   // turbo
   Create a new file `src/abilities/[FighterName]Ability.js`. This file should contain the logic for the fighter's ATK, DEF, and ULT abilities.
   ```javascript
   import { Ability } from '../core/Ability.js';
   import { checkWeaponHit } from '../data/weaponGeometry.js';
   export class [FighterName]Ability extends Ability {
       update(fighter, context) {
           // Implement behavior here
       }
   }
   ```
3. **Define Weapon Geometry (Melee Only)**
   If the fighter uses a melee weapon, define its shape and hitboxes in `src/data/weaponGeometry.js`.
4. **Register the Ability**
   Import and add the new ability class to the registry in `src/core/AbilityRegistry.js`.
5. **Define Visual Effects**
   Add any new particle effect templates required for the fighter's abilities to `src/data/particleTemplates.js`.
6. **Test the Fighter**
   Run the game and select the new fighter to verify physics, hitboxes, and special effects.
