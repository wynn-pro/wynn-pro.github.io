# Block Blaster

An aim-and-bounce blasting game. The number blocks are creeping down towards **Blip the robot**!
Aim the blaster, fire a stream of bouncing energy balls, and knock every block down to zero before
it reaches the red line. There are 4 worlds, **Candy Cubes**, **Lava Lab**, **Frost Peaks** and
**Star Station**, with a giant boss block at the end of each one.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a mouse, a keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **▶ Play**, then pick a level.

## How to play

| Control | What it does |
| --- | --- |
| Move the mouse / drag your finger | aim (the dotted line shows the first bounce) |
| Click / let go | fire |
| ← → or A D | aim (hold Shift to aim slowly) |
| Space, Enter, ↑ or W | fire |
| R, ↓ or S (or the ⏬ button) | bring all the balls back |
| Esc or P | pause |
| M | sound on / off |

- **Every hit takes 1 off a block's number.** At zero, the block pops.
- **All your balls fire in a row**, and they bounce off the walls, the ceiling and the blocks.
- **The first ball to land** decides where Blip stands for the next shot.
- **After every turn the blocks move down one row.** If a block crosses the red line it smashes one
  of your 3 shields. Lose all 3 and the blocks win.
- **+1 rings** give you an extra ball for the rest of the level. **Coins** are worth 25 points.
- If a turn takes a long time, the balls speed up (⏩ ×2, then ×3).
- **Stars:** you get one star for every shield you still have when you clear the level.
- Clear a level to unlock the next one. Your stars and best scores are saved.

## The worlds

| World | New thing | Boss |
| --- | --- | --- |
| Candy Cubes | +1 rings and coins | King Gumdrop |
| Lava Lab | **bomb blocks**: they blow up every block around them, and can set off other bombs | Magma Max |
| Frost Peaks | **zappers**: every ball that touches one zaps the whole row (or column) | The Ice Fortress |
| Star Station | **splitter blocks**: they break into two half-size blocks | The Mothercube |

Bosses are giant blocks that sit at the top of the board and shuffle to a new spot every turn.
Bring their health bar down to zero to win. Bombs and zappers hurt bosses too!

## How it works

1. **The board is a grid** 7 blocks wide. Blocks and goodies live in grid spaces, and every turn
   they all move down one row and a new row appears at the top.
2. **Levels are made by a *seeded* random number**, so each level is the same every time you play.
   Block numbers grow with the number of balls you're likely to have.
3. **Bouncing:** the game finds the point on the block that is closest to the ball. The line from
   that point to the ball is the way the ball bounces. That's why hitting a corner sends the ball
   off at an angle.
4. **The game moves in tiny steps** (240 every second, more when it speeds up), so the balls never
   skip through a block.
5. **A ball going almost flat** gets a little push up or down, so it can't bounce sideways forever.
6. **All sounds are made by the computer** with the Web Audio API. There are no sound files.

`game.js` is split into numbered parts (1 to 16) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Super-fast balls: make `BALL_SPEED` bigger.
- A machine gun: make `FIRE_GAP` smaller.
- Bigger balls: make `BALL_R` bigger.
- More room before the red line: make `ROWS` bigger.
- Tougher bosses: make the numbers in `BOSS_HP` bigger.
- More bombs everywhere: in `WORLDS`, make a world's `bomb` number bigger (try `0.5`!).
