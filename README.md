# Popcorn Panic

A tiny browser game prototype inspired by a corn kernel dodging pan bosses.

## How to play

1. Open `index.html` in a browser, or run a quick local web server from this folder.
2. Choose a kernel in the lobby.
3. Move with arrow keys or WASD.
4. Press Space to activate your special move.
5. Survive all four rounds: Butter, Salt, Fire, and Magnetron.

## Controls

- Move: Arrow keys / WASD
- Ability: Space
- Restart: button on the defeat screen

## Game notes

- Shield Kernel: defensive bubble that deflects nearby attacks.
- Heal Kernel: absorbs nearby damage and restores HP.
- Catch & Throw: launches nearby projectiles back at the boss.

## Run locally

If you want a quick local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Files

- `index.html` — menu screens and canvas
- `style.css` — game styling and responsive layout
- `game.js` — game loop, movement, enemies, boss logic, abilities
