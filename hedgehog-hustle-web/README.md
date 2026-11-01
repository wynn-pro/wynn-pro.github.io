# Hedgehog Hustle

A maze-chase game in a garden. Hazel the hedgehog is hungry! Help her eat every berry in the hedge
maze before the foxes catch her. Eat a 🍄 mushroom and Hazel curls into a spiky ball. Any fox that
bumps into her then runs home dizzy.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **▶ Play**.

## How to play

| Control | What it does |
| --- | --- |
| W A S D or arrows | walk |
| Space | roll: zoom extra fast for a moment (then wait for the 💨 bar to fill up) |
| Esc or P | pause |
| M | sound on / off |
| Swipe (phone) | walk |
| Tap, or the ROLL button (phone) | roll |

- Eat every **berry** and **mushroom** to clear the garden.
- **Mushrooms** make Hazel a spiky ball for a few seconds. Foxes turn blue and run away. Bump into
  them for 200, 400, 800 and then 1600 points! When Hazel starts blinking, it's nearly over.
- An **apple** drops somewhere in the garden twice per garden. Grab it for 500 points before it's gone.
- You get an **extra life** every 5000 points.
- Your best score is saved in this browser.

## The foxes

| Fox | What it does |
| --- | --- |
| 🟠 Rusty | runs straight at you |
| ⚪ Silver | runs to where you are *going*, to cut you off |
| 🟡 Dozy | wanders about, and sometimes stops for a nap 💤 |

## The gardens

1. **Berry Patch**: Rusty and Dozy
2. **Cabbage Rows**: Silver joins in
3. **Duck Pond**: a big pond in the middle
4. **Twisty Thicket**: two Rustys!
5. **Moonlit Meadow**: night time, two Rustys and two Silvers

Clear all five and you win! Then you can keep going, with faster foxes every time.

## Changing the game

All the numbers you might want to change are at the top of `game.js` (how fast Hazel and the foxes
run, how long a roll lasts, how many lives you start with). The gardens are just text. Each one is
drawn as its left half, and the game mirrors it to make the right half:

```
# hedge   ~ pond   . berry   o mushroom   F fox den   H where Hazel starts
```

Try making your own garden!
