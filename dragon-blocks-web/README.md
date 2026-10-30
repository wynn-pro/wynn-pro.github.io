# Dragon Blocks

A 3D world made completely of blocks. Dig, build whatever you like, and find the 5 Dragon Crystals
buried deep underground so the dragon egg can hatch.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It needs a keyboard and a mouse.

## Play it on your computer

Open `index.html` in a web browser, then click **▶ Play**.

## How to play

| Key | What it does |
| --- | --- |
| W A S D | walk |
| Mouse | look around |
| Space | jump (or go up when flying) |
| Shift | run (or go down when flying) |
| Left click | dig the block you're pointing at |
| Right click (or Ctrl + click) | build a block |
| 1 to 9, or scroll | pick which block to build with |
| F | fly on / off |
| M | sound on / off |
| Esc | pause |

The 📡 **radar** at the top says **Cold**, **Cool**, **Warm** or **HOT!** as you get closer to the
nearest crystal. Crystals are hidden way down near the bottom of the world, so you'll have to dig.
You can't dig through the dark **bedrock** at the very bottom.

Your world saves by itself, so the next time you open the game you can keep building.

## How it works

1. **The world is a big box of numbers.** It's 96 × 96 × 48 spots, and each spot holds one number:
   0 is air, 1 is grass, 3 is stone, and so on. Digging just changes a number to 0. Building
   changes a 0 into the block you picked.
2. **Hills come from "noise",** which is randomness that changes smoothly. Big bumps plus medium
   bumps plus small bumps make hills that look natural.
3. **Graphics cards only draw triangles.** Each side of a block is a square made of 2 triangles.
   The game skips any side that is touching another block, because nobody can see it.
4. **The pictures on the blocks are only 16 × 16 pixels,** and they're painted by the code itself.
5. **Pointing at a block** works by shooting an invisible laser from your eyes. It hops one block at
   a time until it hits something.
6. **Falling and bumping into things:** every frame, gravity pulls you down a little. If your body
   box would end up inside a block, you get pushed back out.

`game.js` is split into numbered parts (1 to 13) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Make the world taller or wider: `W`, `D` and `H` at the top.
- Jump higher: `JUMP`. Moon gravity: make `GRAVITY` smaller.
- Make days shorter: `DAY_LENGTH`.
- Hide more crystals: `CRYSTALS_TO_FIND`.
- More trees: in `generateWorld`, change `0.012` to `0.03`.
