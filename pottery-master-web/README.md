# Pottery Master

A pottery game. Customers come to your studio and ask for pots: a bowl for soup, a mug with a
handle, a tall vase with waves on it. Spin the potter's wheel, shape the clay with your hands,
paint it with glaze and fire it in the kiln. Make 15 pots, and the last one is the **Royal Vase**
for Queen Luna. Make it well and you become a **Pottery Master**!

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a mouse and keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **▶ Start**.

## How to make a pot

1. **Center** the clay. The lump wobbles on the wheel. Hold on it until the ring says 100%.
2. **Shape** it. Grab the edge of the clay and drag it in or out. Hold **⬆️ Pull up** to make it
   taller and thinner, or **⬇️ Press down** to make it shorter and wider. Try to fit the clay to the
   dotted line. The **Match** number shows how close you are.
   - The clay dries while you work. Tap **💧 Water** when the meter gets low, or it cracks.
   - Too much water and it slumps!
3. **Glaze** it. Pick a color, then a tool, then click the pot:
   **🪣 Dip** colors the whole pot, and **➖ Stripes**, **⚫ Dots** and **〰️ Waves** go where you click.
   **➰ Handle** adds a handle. Glaze looks pale until it's fired.
4. **Fire** it. Hold to pump the bellows and heat the kiln. Keep the red line in the green zone,
   which moves up and down. If it gets too hot for too long, your pot cracks!

The customer gives you up to 3 stars and pays you coins. Spend them in the **🛒 Shop** on new glaze
colors, new clay, better tools, and a cat for your studio. Your pots go on the shelves.

**🎨 Free clay** lets you make anything you like, with no customer.

| Control | What it does |
| --- | --- |
| Hold on the clay, or hold <kbd>Space</kbd> | center the clay, heat the kiln |
| Drag the edge of the clay | shape it |
| <kbd>W</kbd> / <kbd>S</kbd> (or arrows) | pull up / press down |
| <kbd>E</kbd> | water |
| <kbd>1</kbd>–<kbd>0</kbd> | pick a glaze color |
| <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd> | dip, stripes, dots, waves |
| <kbd>H</kbd> | handle on / off |
| <kbd>Enter</kbd> | next step |
| <kbd>Esc</kbd> | pause |
| <kbd>M</kbd> | sound on / off |

## How it works

1. **A pot is a list of 32 numbers.** Each number is how wide the pot is at one height, from the
   bottom to the top. There is one more number for how tall it is. That's all you need, because a
   pot on a wheel is round, so it's the same all the way around.
2. **Shaping:** when you drag, the slices near your finger move toward your finger. Slices further
   away move less, so the clay bends smoothly instead of making a step.
3. **Pulling up keeps the same amount of clay.** Taller means thinner: height × width × width
   stays the same.
4. **Drawing a round pot on a flat screen:** each slice is painted dark at the edges and light on
   the left, like light shining from the left. Dots and waves move around the pot as it spins,
   and they get squashed when they're near the edge.
5. **Scoring:** the game measures your pot at 21 heights and adds up how far it is from the
   dotted line. Then it checks the glaze and how long the kiln stayed in the green zone.
   Shape counts for half, glaze for 30% and firing for 20%.

`game.js` is split into numbered parts (1 to 21) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Start rich: change `START_COINS`.
- Clay that dries slower: make `DRY_SPEED` smaller.
- Longer in the kiln: make `FIRE_TIME` bigger.
- Make your own pot shapes in `SHAPES`, and your own customers and orders in `PEOPLE` and `LEVELS`.
- Invent new glaze colors in `GLAZES`. The numbers are red, green and blue, from 0 to 255.
- Make the Queen less picky: change `MASTER_STARS` to 1.
