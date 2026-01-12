# Shieldbearer Knockback Update

The user requested that the Shieldbearer's "Momentum Strike" ability rely on standard physics ("bump mechanic") for knockback instead of applying a custom, overpowered velocity override.

## Changes Created

- Modified `src/core/Game.js`:
    - In `handleMomentumHit`, removed the custom velocity setting logic (`defender.dx = ...`).
    - Changed the return value from `true` to `false`.
    - This allows the code to "fall through" to the standard `if (!hit1 && !hit2)` block below, which executes the normal elastic collision resolution.
    - Preserved the damage calculation, visual particles, sound effects, and `pendingWallSlam` state setting, so the ability still deals damage and sets up wall slams, but the physical movement is now handled by the physics engine's natural mass/velocity resolution.

## Result
Shieldbearer collisions will now feel more consistent with the rest of the game physics, relying on mass differences for the "push" effect rather than artificial values.
