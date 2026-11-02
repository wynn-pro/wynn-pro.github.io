# Sugar Pipes

A candy-land pipe puzzle. The cupcakes are hungry! Turn the candy-cane pipes so the syrup flows
from the **lollipops** to every **cupcake**. Clear 5 sweet worlds (30 levels), then beat the
**Sour King**, who twists your pipes while you're trying to fix them.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a mouse, a keyboard, or your fingers on a phone or tablet.

## Play it on your computer

Open `index.html` in a web browser, click **▶ Play**, then pick a level.

## How to play

| Control | What it does |
| --- | --- |
| tap / click a pipe | turn it clockwise |
| right-click (or Shift + click) | turn it the other way |
| ↶ Undo or Z | take back your last move |
| 💡 Hint or H | turns one pipe the right way for you (3 per level) |
| ↻ or R | start the level again |
| ← → ↑ ↓ then Space / Enter | play with the keyboard |
| Esc or P | pause |
| M | sound on / off |

- Syrup fills a pipe as soon as it's joined up to a lollipop, so you can see how far it reaches.
- **Sour drops** (grumpy green gummies) block the way.
- **Wrapped candies** (gold stripes and a little sweet in the corner) can't be turned.
- **T-pipes** split the syrup, so one lollipop can fill 2 or 3 cupcakes.
- **Two flavours:** strawberry syrup goes to pink cupcakes and blueberry to blue ones. If they touch,
  they mix and go yucky!
- **The timer:** fill every cupcake before it runs out. It stops while you're paused.
- **Stars:** finish in the number of moves shown next to ⭐⭐⭐ to get 3 stars. Each hint counts
  as 3 moves. In the boss fight, stars depend on how much time you have left.

## The worlds

| World | Levels | What's new |
| --- | --- | --- |
| 🍬 Gumdrop Garden | 1 to 6 | how to play |
| 🍭 Lollipop Lane | 7 to 12 | sour drops and wrapped candies |
| 🍫 Chocolate Falls | 13 to 18 | 2 or 3 cupcakes, split with T-pipes |
| ☁️ Cotton Candy Clouds | 19 to 24 | two flavours that must not mix |
| 🌴 Jellybean Jungle | 25 to 30 | everything at once, on big boards |
| 🍋 Sour King's Castle | Boss | 3 boards in a row, and the king zaps a pipe every few seconds |

Beat a level to unlock the next one. Your stars and best times are saved in the browser.

## How it works

1. **Every pipe is one number.** North is 1, east is 2, south is 4 and west is 8, so a corner
   going north and east is 3. Turning a pipe just shifts the number round.
2. **Levels are built backwards.** The code puts down a lollipop and a cupcake, digs a twisty path
   between them, and remembers it as the answer. More cupcakes get a branch that joins the path.
   Then it fills the gaps with sour drops and spare pipes, and spins everything. Because it started
   from an answer, every level can be solved.
3. **Seeds** make the random numbers the same every time, so level 12 is always the same puzzle.
4. **The syrup** is worked out by starting at each lollipop and following every pipe that joins up
   with its neighbour. If a tile gets both flavours, they're mixed.
5. **Hints** look at the answer and fix the wrong pipe that's closest to a lollipop.
6. **Undo** remembers which way you turned each pipe, so it still works after the Sour King zaps one.
7. **The music** is made up by the computer from a seed, so each world has its own tune.

`game.js` is split into numbered parts (1 to 15) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- More hints: `HINTS_PER_LEVEL`.
- A slower, kinder Sour King: make `ZAP_EVERY` bigger.
- More time for the boss: `BOSS_TIME`.
- Your own level: add an `L(...)` to a world's `levels` list. For example `L(9, 9, [2, 2], 0.6, 6, 4, 2)`
  is a 9 by 9 board with two flavours, 2 cupcakes each, 6 sour drops and 4 wrapped candies.
