# Cosmo Crates

An endless space puzzle. Cosmo the little astronaut has to load the cargo: push every crate onto a
**glowing landing pad**. The puzzles never run out. Each new level is a bit bigger, with more crates.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **▶ Play**.

## How to play

| Control | What it does |
| --- | --- |
| ← ↑ ↓ → or W A S D | move (walk into a crate to push it) |
| Z, U or Backspace | undo your last move |
| R | start the level again |
| Esc or P | pause |
| M | sound and music on / off |
| Enter | next level (on the "Cargo loaded!" screen) |

On a phone or tablet, use the arrow buttons or swipe on the puzzle. The round ↶ button is undo.

- You can only **push** crates, never pull them. A crate pushed into a corner is stuck, so undo!
- **Stars:** finish in the 🎯 number of moves (or fewer) for ⭐⭐⭐. Take a few more and you get ⭐⭐.
- **Score:** every new level gives points for each crate, plus bonus points for stars.
  Use **Try for more stars** to replay a level and earn the stars you missed.
- **Stuck on a level?** Pause and press **🔀 Different puzzle** to get a new one.

## How the endless levels are made

The computer builds each level **backwards**. It starts with every crate already on its pad, then
walks Cosmo around randomly, *pulling* crates off the pads. Every pull could be undone by a push,
so every puzzle can always be solved. It builds 40 puzzles and keeps the trickiest one.

Then a solver tries every possible move, one step at a time, to find the fewest moves to win.
That number sets the 🎯 3-star goal. On very big levels, where checking everything would take too
long, it uses the moves from the way the puzzle was built instead.

Your progress is saved in the browser, so you can come back to the same level later.
