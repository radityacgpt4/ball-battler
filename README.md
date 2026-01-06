# Ball Battler - 1v1 Fighter Ball Auto Battler

A modular, scalable auto-battler game engine featuring physics-based combat between unique fighter characters.

## Project Structure

```
ball-battler/
├── index.html              # Entry point (Main UI + Canvas)
├── style.css               # Extracted CSS styles
│
└── src/
    ├── core/
    │   ├── Game.js         # Main Game Controller
    │   └── Constants.js    # WIDTH, HEIGHT, BALL_RADIUS
    │
    ├── systems/
    │   ├── Physics.js      # Physics calculations (preserved logic)
    │   ├── Audio.js        # AudioEngine (procedural sound generation)
    │   └── Particles.js    # ParticleSystem for visual effects
    │
    ├── entities/
    │   ├── Fighter.js      # Base Fighter class with ability system
    │   └── Projectile.js   # Projectile entity (bullets, kunai, grenades)
    │
    ├── abilities/
    │   ├── Ability.js      # Base Ability class
    │   ├── MeleeAbility.js # Sword Master melee attacks
    │   ├── ProjectileAbility.js # Burst fire, kunai, grenades
    │   ├── RaycastAbility.js # Thunder Mage lightning
    │   ├── DashAbility.js  # Dash assault, retreat, flash barrage
    │   ├── PassiveAbility.js # Parry, evasion, static, shield, momentum
    │   └── SpecialAbility.js # Wall slam and other unique abilities
    │
    └── data/
        └── fighters.js     # Fighter configuration database
```

## Features

- **5 Unique Fighters**: Sword Master, Thundermage, Rifleman, Shieldbearer, Yellow Flash
- **Ability System**: Strategy pattern for modular skill implementation
- **Physics Engine**: Preserved collision detection and resolution
- **Procedural Audio**: All sounds generated via Web Audio API
- **Arena Shrinking**: Dynamic arena size reduction during long battles

## Fighters

| Fighter | HP | Mass | Speed | Attack | Defense | Ultimate |
|---------|-----|------|-------|--------|---------|----------|
| Sword Master | 100 | 1.0 | 4.5 | Melee Passive | Parry (15%) | Dash Assault |
| Thundermage | 100 | 2.0 | 4.0 | Raycast Lightning | Static Stun | Double Zap |
| Rifleman | 100 | 1.2 | 4.0 | Burst Fire | Retreat | Grenade |
| Shieldbearer | 100 | 1.8 | 4.0 | Momentum Passive | Shield Deflect | Wall Slam |
| Yellow Flash | 100 | 1.0 | 5.0 | Kunai Mark | Evasion | Flash Barrage |

## Running the Game

1. Serve the files using a local web server (ES6 modules require HTTP):
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```

2. Open `http://localhost:8000` in your browser

3. Select fighters for both players and click "FIGHT!"

## Adding New Fighters

1. Add fighter data to `src/data/fighters.js`:
   ```javascript
   NEW_FIGHTER: {
       name: "Fighter Name",
       color: "#hexcolor",
       hp: 100,
       mass: 1.0,
       speed: 4.0,
       rotationSpeed: 0.12,
       skills: {
           atk: { type: "ABILITY_TYPE", /* params */ },
           def: { type: "ABILITY_TYPE", /* params */ },
           ult: { type: "ABILITY_TYPE", cooldown: 180, /* params */ }
       }
   }
   ```

2. Create new ability classes in `src/abilities/` if needed

3. Register abilities in `Fighter.createAbilities()` method

## License

MIT
