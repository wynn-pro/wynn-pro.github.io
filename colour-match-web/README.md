# Colour Match

A paint-mixing game. Every level shows you a colour, and you drop red, yellow, blue, white and
black paint into a bowl until your mix looks just the same. The closer you get, the more stars
you win. Then try **Colour Rush**: match as many colours as you can in 90 seconds!

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a mouse and keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **🎨 Levels** or **⏱️ Colour Rush**.

## How to play

| Control | What it does |
| --- | --- |
| Click a paint pot, or press 1 to 5 | add a drop of red, yellow, blue, white or black |
| ↩️ Undo, or Z | take out the last drop |
| 🫗 Empty, or X | tip the whole bowl out |
| 💡 Hint, or H | show which paints the colour uses (you can only get 2 stars after that) |
| ✅ Done!, or Enter | see how close you got |
| ⏭️ Skip, or S | Colour Rush only: get a new colour, but lose 3 seconds |
| Esc | back to the menu |
| M | sound on / off |

- **Stars:** a 75% match passes the level, 88% gets 2 stars and 95% gets 3 stars.
- Passing a level opens the next one. Your stars are saved in this browser.
- The first 12 levels teach you one idea at a time. After that you get all 5 paints, and you
  have to work out which ones you need.
- In **Colour Rush** you don't press Done. As soon as your bowl is a 95% match, it counts
  by itself and a new colour appears.

## Paint tricks

- Red + yellow = orange. Yellow + blue = green. Red + blue = purple.
- Red + yellow + blue all together = brown.
- White makes a colour paler. Black makes it darker. A little black goes a long way!
- Only the amounts compared to each other matter: 2 red + 2 yellow is the same orange as 1 + 1.

## How it works

1. **Paint isn't light.** On a screen, blue light + yellow light makes grey. But blue PAINT +
   yellow PAINT makes green. So the game pretends you have a cube of colours called **RYB**
   (red, yellow, blue). Each corner of the cube is a colour picked by hand, like white, red,
   orange, green and brown. Any mix in between is worked out by sliding smoothly between the
   corners.
2. **White and black** are added afterwards. White slides the colour toward white, and black
   makes every part of the colour darker.
3. **How close is it?** The game turns both colours into **Lab**, a way of writing colours where
   the distance between two colours is about how different they look to your eyes. A small
   distance means a high match %.
4. **Tips:** if you don't pass, the game checks if your mix is too light, too dark, too red, not
   yellow enough and so on, and tells you the biggest problem.
5. **Levels 13 to 20** are made up by a random number maker with a *seed*, so they are the same
   every time you play. Made-up colours that look too much like an earlier level are thrown away.

`game.js` is split into numbered parts (1 to 17) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Make it easier or harder: change `PASS`, `STAR2` and `STAR3`.
- A longer Colour Rush: make `RUSH_TIME` bigger.
- A bigger bowl: make `MAX_DROPS` bigger.
- Change how paint mixes: try different colours in `RYB_CUBE`.
- Add your own levels to `LEVELS`, or make `LEVEL_COUNT` bigger for more made-up ones.
- Give colours new names in `colourName`.
