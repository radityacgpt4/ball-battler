# Ball Battler - 1v1 Fighter Ball Auto Battler

A modular, scalable auto-battler game engine featuring physics-based combat between unique fighter characters. Watch as two balls collide, unleash powerful abilities, and battle for supremacy in a shrinking arena.

## Project Structure

```
ball-battler/
├── index.html              # Entry point (Main UI + Canvas)
├── style.css               # Main application styles
│
└── src/
    ├── core/
    │   ├── Game.js         # Main Game Controller
    │   ├── Constants.js    # WIDTH, HEIGHT, BALL_RADIUS
    │   └── AbilityRegistry.js # Central factory for abilities
    │
    ├── systems/
    │   ├── Physics.js      # Physics calculations & collision detection
    │   ├── Audio.js        # AudioEngine (procedural sound generation)
    │   ├── Particles.js    # ParticleSystem for high-fidelity visual effects
    │   ├── Renderer.js     # Component-based rendering system
    │   ├── CombatText.js   # Floating text pop-ups (Damage, Stuns, etc.)
    │   └── CollisionHandler.# Logic for resolving entity/projectile hits
    │
    ├── entities/
    │   ├── Fighter.js      # Base Fighter class with state management
    │   └── Projectile.js   # Projectile entity (bullets, arrows, bolts, missiles)
    │
    ├── abilities/
    │   ├── Ability.js      # Base Ability class
    │   ├── AxeAbility.js   # Axeman's heavy swings and executions
    │   ├── BallistaAbility.js # Ballista's bolts and barricades
    │   ├── DashAbility.js  # Teleportation and dash-based strikes
    │   ├── DivineBrawlerAbility.js # Black Flash and Boogie Woogie
    │   ├── DivineGeneralAbility.js # Adaptation and Mahoraga wheel
    │   ├── MeleeAbility.js # Close-quarters combat logic
    │   ├── PassiveAbility.js # Shielding, evasion, and momentum logic
    │   ├── ProjectileAbility.# Ranged projectile logic (guns, grenades)
    │   ├── QuincyAbility.js # Predictive arrows and energy traps
    │   ├── RaycastAbility.js # Chain lightning and continuous lasers
    │   ├── SniperAbility.js # Long-range shots and traps
    │   └── SpecialAbility.js # Wall slams and environment interactions
    │
    └── data/
        └── fighters.js     # Fighter configuration database (Stats & Skill balance)
```

## Features

- **12 Unique Fighters**: A diverse roster ranging from the high-speed **Yellow Flash** to the massive **Ballista**.
- **Dynamic Ability System**: A deep Strategy-pattern implementation allowing for complex, reactive skills like teleportation, projectile hijacking, and healing.
- **Advanced Physics**: Precise circular and ray-based collision detection with elastic reflections and mass-based knockback.
- **High-Fidelity Visuals**: A robust particle system featuring glowing trails, razor-sharp beam effects, and stylized "Sakuga" bursts.
- **Procedural Soundscape**: An audio engine that generates impacts, zaps, and explosions dynamically via the Web Audio API.
- **Interactive UI**: Real-time HUD displaying HP, skill cooldowns, and a detailed character select screen.
- **Arena Shrinking**: Dynamic physical boundary reduction that forces engagement by constricting the playable area over time.

## Lineup

| Fighter | Role | Attack | Defense | Ultimate |
|---------|------|--------|---------|----------|
| **Sword Master** | Duelist | Melee Slash | Parry | Dash Assault |
| **Thundermage** | Mage | Lightning Bolt | Static Field | Double Zap |
| **Rifleman** | Marksman | Burst Fire | Tactical Retreat | Frag Grenade |
| **Shieldbearer** | Tank | Momentum Strike | Greatshield | Wall Slam |
| **Yellow Flash** | Assassin | Flying Raijin | Substitution | Flash Barrage |
| **Cyborg** | Artillery | Plasma Laser | Energy Shield | Missile Swarm |
| **Sniper** | Specialist | Sniper Shot | Claymore | Steady Aim |
| **Axeman** | Juggernaut | Heavy Swing | Berserker Rage | Execution |
| **Ballista** | Defender | Heavy Bolt | Gate Barrier | Siege Mode |
| **Divine General**| Adapter | Mahoraga Wheel | Healing Stance | Perfect Adaptation|
| **Sorcerer Brawler**| Fighter | Black Flash | Boogie Woogie | Pure Focus |
| **Spirit Archer** | Ranger | Heilig Pfeil | Hirenkyaku | Licht Regen |

## Mechanics

- **Status Effects**: Fighters can apply **STUN**, **BLEED**, **SLOW**, and more.
- **Unblockable Damage**: Certain high-tier abilities (like Ninja's Rasengan) bypass shields and parries.
- **Knockback Physics**: Impact force is determined by mass ratios and movement speed, enabling "Wall Slams".
- **Chain Reactions**: Thunderbolts bounce between targets, while Ninja's kunai create lightning traps.
- **Scaling Combat**: Arena boundaries physically shrink every 15 seconds, constricting the battle space and forcing intense close-quarters engagement.

## Running the Game

1. Serve the files using a local web server (ES6 modules require HTTP):
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```

2. Open `localhost` in your browser.
3. Select your fighters (Left-click for P1, Right-click for P2).
4. Click **FIGHT!** to start the match.

## License

MIT
