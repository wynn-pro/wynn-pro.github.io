# Pip's Quest

A side-scrolling jump-and-run game with **20 levels** across 5 worlds. Grumbo the Rock Beetle King
stole the Sun Bells. Help Pip the fox run, jump, bonk boxes and stomp beetles to ring every bell again.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a keyboard, and phones and tablets get on-screen buttons.

## Play it on your computer

Open `index.html` in a web browser, click **▶ Play**, then pick a level.

## How to play

| Key | What it does |
| --- | --- |
| ← → or A D | walk |
| Space, ↑ or Z | jump (hold it to jump higher) |
| Shift or X | run, and throw sparks when you have the Ember Flower |
| Esc or P | pause |
| M | sound on / off |
| Enter | next level (on the "clear" screen) |

- **Shiny gem boxes**: bonk them from below for coins, an **Acorn** (makes Pip big) or an
  **Ember Flower** (lets Pip throw sparks). Some hide a **1UP leaf**.
- **Big Pip** can smash bricks, and gets hit once without losing a life.
- **Stomp** beetles, bats, frogs and snails. A stomped snail turns into a shell you can kick!
  Never stomp the red spiky ones. Use sparks or a kicked shell on them instead.
- **Springs** throw you up high. Hold jump to go even higher.
- **The checkpoint flag** halfway through each level is where you come back if you lose a life.
- **The bell** at the end finishes the level. Grab the pole up high for more points!
- Every 4th level is a **fort** with Grumbo at the end. Stomp him until his health bar is empty
  to open the gate.
- 100 coins = 1 extra life. Levels you unlock stay unlocked, even after a game over.

## The 5 worlds

1. Sunny Meadow
2. Crystal Caves
3. Cloud Kingdom (watch out for gaps and moving clouds)
4. Dune Desert
5. Volcano Peak (lava and fire bars!)

## How it works

1. **The world is a grid of numbers.** Every 16 × 16 square holds a number: 0 is air, 1 is ground,
   2 is brick, and so on. Bonking a box just changes its number to "used box".
2. **Levels are snapped together from pieces**, like Lego: a flat bit, a gap, a row of boxes,
   stairs, a spring and a wall... A *seeded* random number picks the pieces, so level 7 is the
   same level 7 every time. Later levels pick harder pieces, wider gaps and more enemies.
3. **Bumping into walls:** first Pip moves sideways and gets pushed out of any wall, then moves
   up or down and gets pushed out again. Doing the two directions one at a time is the trick.
4. **Higher jumps when you hold the button:** gravity is weaker while you're holding jump on the
   way up.
5. **Stomp or ouch?** If Pip is falling and Pip's feet were above the beetle's head a moment
   ago, it's a stomp. Otherwise Pip gets hurt.
6. **The music is made up by the computer.** It wanders up and down a scale of notes that sound
   nice together. Each world has its own seed, so each world gets its own song.

`game.js` is split into numbered parts (1 to 15) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Super jumps: make `JUMP` bigger. Moon gravity: make `GRAVITY` smaller.
- Speedy Pip: make `RUN` bigger.
- More lives: `START_LIVES`.
- Rename the levels: `LEVEL_NAMES`.
- Change the colours of a world: `THEMES`.
- Make a world have more springs: in `PIECE_WEIGHTS`, make the `spring` number bigger.
