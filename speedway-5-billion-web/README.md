# Speedway 5 Billion

A monster kart racing game. Six monsters race their karts round 3 tropical tracks: **Coconut Beach**,
**Jungle Jumble** and **Pirate Cove**. Drift round corners for a spark boost, smash item boxes, and be
the first monster over the line after 3 laps. Race the computer, or a friend on a split screen!

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. The road is "pseudo-3D", like old arcade racers: it is drawn as lots of flat strips
that get smaller the further away they are.

## Play it on your computer

Open `index.html` in a web browser, pick 1 or 2 players, pick your monster, then pick a track.

## How to play

Your kart drives forward by itself, so you just steer.

| | Player 1 | Player 2 |
| --- | --- | --- |
| steer | A D | ← → |
| drift (hold while turning) | Space or Left Shift | / or Right Shift |
| use item | W, E or Q | ↑ or Enter |
| brake | S | ↓ |

Playing on your own? Both sets of keys work. Esc pauses and M turns the sound on and off. On a phone
or tablet, use the buttons on the screen.

- **Drifting:** hold drift while turning. White sparks turn **blue** (small boost) and then **orange**
  (big boost). Let go of drift to zoom off!
- **Sand, grass and water** slow you down, and bumping into trees, huts and rocks slows you down a lot.
- **Item boxes** give you one of these. The further back you are, the better your items:
  - 🚀 **Rocket boost**: super speed, even through the sand
  - 🟢 **Slime splat**: drops a slime puddle behind you that spins out anyone who drives into it
  - 🔴 **Bouncy ball**: bounces forward and chases the kart in front of you
  - 🛡️ **Shield bubble**: saves you from one hit

## The monsters

| Monster | Speed | Pickup | Turning |
| --- | --- | --- | --- |
| Blorp the slime | 3 | 3 | 3 |
| Fuzzle the fuzzball | 2 | 5 | 2 |
| Chompo the big mouth | 5 | 2 | 2 |
| Zib the cyclops | 2 | 2 | 5 |
| Grumble the horned grump | 4 | 3 | 2 |
| Wisp the ghost | 2 | 3 | 4 |

## Races and speeds

- **Single race** on any track. Your best race time and best lap are saved.
- **Monster Cup**: all 3 tracks in a row. 1st place gets 10 points, then 8, 6, 4, 2 and 1. Most points
  wins the golden trophy!
- Three speeds: **Chill**, **Zoom** and **5 Billion** (the fastest and toughest).

## Changing the game

The numbers at the top of `game.js` are easy to change: how many laps, how fast the karts go, how
long drifts take to charge, and more. The tracks are lists of pieces in `TRACKS`, so you can make the
corners sharper or the hills bigger, or add new pieces.
