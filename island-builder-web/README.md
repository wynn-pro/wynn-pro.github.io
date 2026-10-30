# Island Builder

A town-building game on a wild island. You start with 3 islanders, a tent and a campfire. Build
homes, farms, docks, lumber camps and quarries, raise new land from the sea, and grow your camp
into a busy town. When 40 islanders live there, you can build the **Great Lighthouse**!

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a mouse and keyboard, and on phones and tablets with your fingers.

## Play it on your computer

Open `index.html` in a web browser and click **🏝️ New island**. Every island is different.

## How to play

| Control | What it does |
| --- | --- |
| Click a button at the bottom | pick a building or tool |
| Click the island | build it there |
| Drag | move around the island |
| Mouse wheel, ➕ ➖ or pinch | zoom |
| W A S D or arrows | move around |
| 1 to 9 | pick a building |
| R, T, C | Raise Land, Plant Tree, Clear |
| Esc or right-click | stop building (Esc again pauses) |
| M | sound on / off |

- **🎯 Goals** in the top corner tell you what to do next, and give you a reward.
- **Homes** (huts and stone houses) let new islanders arrive, if there is food.
- **Jobs**: farms, docks, camps, quarries, markets and the harbor need workers. If you have fewer
  islanders than jobs, everything works slower. The 💼 box turns orange when that happens.
- **Food**: every islander eats. With no food, islanders sail away!
- **Lumber Camps** make more wood when there is lots of forest around them. **Quarries** make
  more stone when there are lots of rocks. You can plant more trees with 🌳.
- **🏝️ Raise Land** turns shallow sea into sand, and deep sea into shallow sea. Make your island bigger!
- **Bottles** float in near the beach now and then. Click one for a present.
- Your island is saved in this browser, so you can come back later and click **▶ Continue**.

## The buildings

| Building | Cost | What it does |
| --- | --- | --- |
| 🛖 Hut | 10 wood | home for 4 |
| 🌾 Farm | 15 wood | food, goes on grass |
| 🐟 Fish Dock | 20 wood | food, goes on sand next to the sea |
| 🪓 Lumber Camp | 10 wood | wood, goes close to a forest |
| ⛏️ Quarry | 25 wood | stone, goes close to rocks |
| 🏠 Stone House | 15 wood, 20 stone | home for 10 |
| 🏪 Market | 30 wood, 20 stone | gold |
| ⛵ Harbor | 50 wood, 40 stone, 30 gold | gold and food, goes on sand next to the sea |
| 🗼 Great Lighthouse | 150 wood, 200 stone, 120 gold | you win! Needs 40 islanders |

## How it works

1. **The island is a grid of numbers.** Every square holds a number: 0 is deep sea, 1 is shallow
   sea, 2 is sand, 3 is grass, 4 is forest and 5 is rocks.
2. **Making the island:** each square gets a height. It's high in the middle and low at the edges,
   plus some smooth random bumps called *noise*. Low squares become sea, then sand, then grass,
   and the highest bits become rocks. A second noise map decides where forests grow.
3. **The ground is painted once.** The game paints the whole island onto a hidden picture and copies
   it to the screen every frame. When you raise land or plant a tree, it repaints only those squares.
   The waves and foam are drawn fresh every frame so they can move.
4. **Every second**, each building adds what it makes, times how many jobs are filled. Then
   every islander eats a little food.
5. **Front and back:** buildings are drawn one row at a time from the top of the map down, so
   things closer to you cover things behind them.
6. **Day and night:** a see-through dark blue layer goes over everything at night, and then the
   windows and campfire glow on top of it.

`game.js` is split into numbered parts (1 to 20) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- Start rich: change the numbers in `START`.
- Hungrier islanders: make `EAT` bigger.
- Faster-growing town: make `GROW_EVERY` smaller.
- Longer days: make `DAY_LENGTH` bigger.
- Need fewer islanders for the lighthouse: make `LIGHTHOUSE_POP` smaller.
- Bigger islands: make `MAP_W` and `MAP_H` bigger.
- Change what a building costs or makes in `DEFS`.
- Add your own goals to `QUESTS`.
