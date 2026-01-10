# Fix Spirit Arrow (Licht Regen) Animation & Tuning

The user requested adjustments to the previously fixed Spirit Arrow ULT.

## Adjustments

- **Refined Visuals (Projectile.js):**
    - Reduced the rendering size of all Quincy arrows (Heilig Pfeil & Licht Regen) by 50% to make them less intrusive.
    - Implemented "planted" logic: When a Licht Regen arrow lands (`z <= 0`), it now renders vertically (`Math.PI / 2` rotation) to look like it is stuck in the ground, rather than lying flat.

- **Game Balance (fighters.js):**
    - Increased `arrowCount` for the Spirit Archer's Ultimate from 4 to 6 projectiles.

## Verification
- The arrow count is now 6.
- The visual model is 50% smaller.
- Arrows that hit the ground appear vertically planted.
- The parabolic arc animation from the previous fix remains intact.
