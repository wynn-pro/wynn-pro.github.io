# Zipper Dash

A super-fast running game. Zipper the armadillo races through 4 zones: **Wavy Cave**, **Spooky
Cave**, the **Plains** and the **Jungle**. Run down hills, curl up and roll, go round loops,
bounce on springs, and beat the boss at the end of every zone to become Champion of the Dash!

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **▶ Play**, then pick a level.

## How to play

| Control | What it does |
| --- | --- |
| ← → or A D | run |
| Space, ↑, W or Z | jump (hold it to jump higher) |
| ↓ or S while running | curl up and roll |
| Esc or P | pause |
| M | sound on / off |
| Enter | next level (on the "clear" screen) |

On a phone or tablet, use the ◀ ▶ ▼ and A buttons.

- **Jump or roll into enemies** to bash them. You can also land on their heads.
- **Spiky enemies** hurt if you jump on them. Roll into them instead!
- **Hearts:** you have 3. Getting hit costs one. Red berries give one back.
- **Glow seeds:** grab 100 for an extra life. Every seed is worth points at the end of a level.
- **Loops:** you need to be going fast to run all the way round. Speed pads (the yellow arrows)
  give you a big boost.
- **Springs** bounce you up cliffs that are too tall to jump.
- **Lanterns** are checkpoints. Run past one to light it, and you'll start there if you fall.
- **Bosses:** jump on King Pinch and Rumble's heads. Lady Lantern and Captain Beak fly high, so wait
  for them to swoop down, then jump into them.
- The faster you finish, the bigger your speed bonus. Your best time for every level is saved.

## The zones

| Zone | Enemies | Boss |
| --- | --- | --- |
| Wavy Cave | crabs, jellyfish, jumping fish, sea urchins | King Pinch the Crab |
| Spooky Cave | bone beetles, ghosts, hopping pumpkins, spike mushrooms | Lady Lantern |
| Plains | ladybugs, bees, frogs, thorn beetles | Rumble the Ram |
| Jungle | snails, parrots, red frogs, spiky beetles | Captain Beak |

Each zone has Act 1, Act 2 and a Boss level. Beat a level to unlock the next one.

## How it works

1. **The ground is a list of heights**, one for every column 16 pixels wide. Small changes between
   columns are slopes and hills, big changes are walls, and a very, very deep column is a pit.
2. **Levels are snapped together from pieces**: hills, gaps, floating platforms, cliffs with a spring,
   spikes, downhill runs and loops. A *seeded* random number picks the pieces, so each level is the
   same every time. After a speed pad or anything dangerous, the next piece is always safe ground.
3. **Slopes push you.** Running uphill slows you down, rolling downhill speeds you up a lot. When you
   land on a slope, your fall turns into speed.
4. **Ramps throw you.** If you go over the top of a bump faster than you can run, the ground curves
   away and you fly into the air.
5. **Loops** are circles. If you're going fast enough, Zipper follows the circle all the way round.
6. **The game moves in tiny steps** (120 every second), so even at top speed Zipper never skips
   through a wall.
7. **The music is made up by the computer.** It wanders up and down a scale of notes. Each zone has
   its own seed, so each zone gets its own song.

`game.js` is split into numbered parts (1 to 18) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Super speed: make `TOP_RUN` or `PAD_SPEED` bigger.
- Moon jumps: make `JUMP` bigger or `GRAVITY` smaller.
- More loops in a zone: in `ZONES`, make that zone's `loop` weight bigger.
- Tougher bosses: make the numbers in `BOSS_HP` bigger.
- More lives: `START_LIVES`.
