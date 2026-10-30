# Pickaxe Miner

A dig-down mining game. Deep under the mountain glows the **Heart of the Mountain**. Dig down,
fill your bag with shiny ore, walk back to camp to sell it, and buy better gear until your
pickaxe is strong enough to reach the very bottom.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a keyboard, and phones and tablets get on-screen buttons.
Your mine is saved in the browser, so you can come back and keep digging.

## Play it on your computer

Open `index.html` in a web browser and click **▶ Play**.

## How to play

| Key | What it does |
| --- | --- |
| ← → or A D | walk, or dig sideways (hold it) |
| ↓ or S | dig down (hold it) |
| ↑ or W | climb up (puts down a ladder if there isn't one) |
| Space or B | drop dynamite, then run! |
| R | rescue rope: zip straight back to camp |
| Esc or P | pause |
| M | sound on / off |

- **Energy ⚡**: every square you dig uses 1 energy. Walking and climbing are free.
- **Camp**: walk into the camp door to sell all your ore and fill up your energy and hearts.
  The shop opens there too.
- **Ladders 🪜**: you can't jump, so climb! Each square you climb up uses one ladder, but
  ladders stay where you put them, so the way home gets easy.
- **Boulders**: dig out the square under a boulder and it wobbles, then falls. Get out of the way!
- **Lava**: glows in the dark, deep down. Don't touch it.
- **Treasure chests**: dig them open for money.
- **Falls**: falling 6 squares or more hurts.
- Run out of hearts and the camp crew carries you home, but you drop half your ore.

## The 6 layers

| Layer | Starts at | Pickaxe you need | Ores |
| --- | --- | --- | --- |
| Topsoil | 1 m | Wooden | Coal, Copper |
| Red Clay | 21 m | Copper | Iron, Silver |
| Grey Stone | 46 m | Iron | Gold, Emerald |
| Deep Slate | 76 m | Steel | Ruby |
| Magma Rock | 106 m | Crystal | Sapphire, Diamond |
| Crystal Depths | 136 m | Starforged | Starstone, and the Heart of the Mountain |

## How it works

1. **The mine is a grid of numbers.** Each square holds one number: 0 is air, 1 is ground,
   2 is a boulder, and so on, and 10 and up are ores. Digging just changes a number to 0.
2. **The mountain is made by a seeded random number maker.** Little "cave diggers" wander
   around and leave tunnels behind them. Then ore clumps are sprinkled in, picking only ores
   that belong at that depth.
3. **Falling**: every moment, the game asks "is there ground, or a ladder, under the miner?"
   If not, the miner drops one square.
4. **Boulders** do the same check. The game goes through them from the bottom up, so a boulder
   that just fell doesn't fall twice in one go.
5. **Darkness**: the game paints a dark layer over the whole mine, then rubs out a soft circle
   around your lamp, lava and the Heart. A better lamp means a bigger circle.
6. **Saving**: the whole grid is turned into a string of letters and kept in `localStorage`.

`game.js` is split into numbered parts (1 to 14) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- More money: make the `value` of an ore in `ORES` bigger.
- Diamonds everywhere: give Diamond a big `weight` and a small `from`.
- Cheaper gear: change the `cost` numbers in `UPGRADES`.
- A deeper mountain: make `CORE_DEPTH` bigger.
- Faster falling: make `FALL_SPEED` bigger. Tougher falls: make `HURT_FALL` smaller.
- More ladders to start with: `START_LADDERS`.
