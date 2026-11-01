# Star Snackers

An arcade space shooter. Hungry space blobs called **snackers** are swooping down to steal the
cookies from your moon bakery! Fly your little rocket along the bottom, zap every snacker, and keep
the cookie jar safe for all 15 waves. Every fifth wave is a boss, and the last one is **King Cruncher**.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is. It works with a keyboard, a mouse, or your finger on a phone or tablet.

## Play it on your computer

Open `index.html` in a web browser and click **🚀 Play**.

## How to play

| Control | What it does |
| --- | --- |
| ← → or A D | move |
| Space (hold) | shoot |
| Hold your finger or mouse down and slide | move and shoot |
| P or Esc | pause |
| M | sound on / off |

- You have **3 hearts**. Goo, zaps and snackers crashing into you each cost a heart.
- The jar starts with **10 cookies**. If the snackers eat them all, the game is over too!
- Zap a snacker that is carrying a cookie and the cookie goes back in the jar.
- The swarm slowly creeps down. If it gets too low, snackers start grabbing cookies.
- **🔥 Combo:** every 5 hits in a row without missing makes each snacker worth more, up to x5.
  Snackers that are swooping are worth double.
- At the end of each wave you get 25 bonus points for every cookie still in the jar.
- Your best score is saved in this browser.

## The snackers

| Snacker | Points | What it does |
| --- | --- | --- |
| 🟢 Muncher | 10 | drops goo straight down |
| 🟣 Zapper | 20 | shoots zaps aimed right at you |
| 🟠 Diver | 30 | swoops down at your rocket |
| 🔵 Tank | 40 | takes 3 hits, drops heavy balls |
| 🩷 Splitter | 25 | pops into two babies that dive at you |
| 🟡 Snatcher | 50 | wears a bandit mask and flies down to steal cookies |

## Power-ups

Zapped snackers sometimes drop one. Fly into it to catch it.

| Power-up | What it does |
| --- | --- |
| ⚡ Rapid Fire | shoot much faster for 10 seconds |
| 🌟 Triple Shot | shoot 3 at once for 10 seconds |
| 🛡️ Bubble Shield | blocks the next hit |
| ❤️ Heart | +1 heart (up to 5) |
| 🍪 Cookie | +1 cookie back in the jar |

## How it works

1. **The game is always 600 x 800 inside.** `resize()` works out how much to stretch it to fit
   your window, so it looks the same on a phone and a big screen.
2. **Waves are made of letters.** In `WAVES`, each letter is one snacker (`m` is a Muncher, `t` is
   a Tank and so on) and each string is one row of the swarm.
3. **Every snacker has a state:** `enter` (flying in along a curve), `form` (in the swarm),
   `dive` (swooping at you), `snatch` (going for the jar), `escape` (flying off with a cookie) and
   `return` (flying back to its spot). Each frame, the code moves it depending on its state.
4. **The swarm sways** with a sine wave, so it glides left and right smoothly, and creeps down a
   little more every second.
5. **Hits are circles.** A shot hits a snacker when the distance between them is smaller than
   the snacker's size. The boss is an oval, so it uses the oval version of the same sum.
6. **All the sounds are made with code** using the browser's synthesizer, so there are no sound
   files.

`game.js` is split into numbered parts (1 to 19) with comments, so you can read it one part at a time.

## Things to try changing in game.js

- More hearts: change `START_HEARTS`.
- A faster rocket: make `PLAYER_SPEED` bigger.
- Shoot faster all the time: make `FIRE_DELAY` smaller.
- More power-ups: make `DROP_CHANCE` bigger (1 means every time).
- Design your own wave: add a row of letters to `WAVES`.
- A tougher boss: change `hp` in `BOSSES`.
- Invent a new snacker: add a letter to `TYPES` and use it in a wave.
