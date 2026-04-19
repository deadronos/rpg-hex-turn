# Hexfall Tactics Prototype

Hexfall Tactics is a lightweight browser prototype for a turn-based fantasy RPG played on a 2D hex battlefield. It uses plain HTML, CSS, and JavaScript modules, so there is no build step.

## Features

- Playable turn loop with initiative-based turns
- Hex-grid movement and attacks
- Three hero classes:
  - Warrior with `Cleave`
  - Rogue with `Shadowstep`
  - Mage with `Fireball`
- Three enemy types with different behavior:
  - Goblin skirmishers
  - Orc bruiser
  - Skeleton archer
- Combat log, turn order, selected-unit panel, win/lose state, and restart button

## Run locally

Serve the repo with any static file server. For example:

```bash
cd /Users/openclaw/Github/rpg-hex-turn
python3 -m http.server 4173
```

Then open <http://localhost:4173> in a browser.

## How to play

- The current unit is highlighted in gold.
- On hero turns, use the action buttons and click highlighted hexes on the battlefield.
- Each hero gets one move and one action each turn.
- The warrior uses `Cleave` immediately from the action panel.
- The rogue uses `Shadowstep` by selecting an empty hex within 3.
- The mage uses `Fireball` by selecting a target hex within 3.
- Defeat every enemy to win. If all heroes fall, the battle is lost.

## Project structure

- `index.html` defines the UI shell
- `styles.css` provides the fantasy HUD and battlefield presentation
- `src/data.js` defines unit stats and the starting scenario
- `src/hex.js` contains hex-grid math helpers
- `src/game.js` contains turn flow, combat logic, AI, and canvas rendering
- `src/main.js` boots the game
