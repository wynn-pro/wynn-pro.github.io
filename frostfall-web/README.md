# Frostfall

The world has frozen. Keep a tiny town alive for 30 days around a coal-burning beacon: dig coal,
chop wood, hunt for food, build shelters and fight off wolves while every day gets colder than the
last. Survive the Whiteout at the end and the thaw comes.

It is plain HTML, CSS and JavaScript, with no build step and no downloads, so it runs on GitHub
Pages as is.

## Play it on your computer

Open `index.html` in a web browser. That's it.

The game saves itself every morning (on that computer only). Press **Continue** on the title screen
to carry on.

## How to play

- Pick **Easy**, **Medium** or **Hard** to start. One day lasts one minute at 1× speed.
- **The beacon** in the middle keeps everyone warm. Click it to set its power: **Low**, **High** or
  **Overdrive**. More power is more heat but burns more coal. Overdrive strains the beacon, and at
  100% strain it cracks and goes cold for 20 seconds.
- The dashed circle shows how far the heat reaches. Upgrading the beacon makes it hotter and reach
  farther. Plots close to the beacon are warmer, so put shelters there.
- **Click an empty plot** to build. **Click a building** and press **+** to give it workers.
  People work from 7:00 to 19:00, then walk home to sleep.
- Every building shows its temperature. Colder than **-5°** and people start to freeze. Freezing or
  hungry people get sick and can't work; an **Infirmary** heals them fast. If their health runs out,
  they die.
- Everyone eats 1 food a day. People without a bed sleep outside next to the beacon (cold!).
- **Hope** goes up after a good day and down when people go hungry, sleep outside, get sick or die.
  If it reaches 0, everyone leaves. New survivors only come while hope is 25 or more and there are
  free beds.
- From day 3, **wolves** raid some nights at 21:00. They steal food and bite people. Click them to
  chase them with a torch, or build a **Watchtower** with a night guard. Each wolf you beat gives
  food. On days 15, 24 and 30 an **alpha wolf** leads the pack.
- Scouts warn you a day before a **blizzard** (15° colder). Days 28–30 are the **Whiteout**, the
  coldest of all.

| Building | Cost | What it does |
| --- | --- | --- |
| Shelter | 30 🪵 | Beds for 4 / 6 / 8 people, warmer inside |
| Sawmill | 20 🪵 | 10 wood a day per worker |
| Coal Pit | 30 🪵 | 5 coal a day per worker |
| Hunters' Lodge | 25 🪵 | 6 food a day per worker |
| Steelworks | 40 🪵 10 🪨 | 4 steel a day per worker, using 2 wood for each steel |
| Infirmary | 40 🪵 5 🔩 | 3 / 5 / 7 beds where sick people heal fast |
| Watchtower | 30 🪵 5 🔩 | A night guard shoots arrows at wolves |

Every building can be upgraded twice (level 2 and 3) for more workers or beds and 20% more output.
Work is slower in cold buildings.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| B | Select the beacon |
| 1–4 | Beacon power: Off, Low, High, Overdrive |
| + / − | Add or remove a worker from the selected building |
| P or Space | Pause |
| F | Change speed (1×, 2×, 3×) |
| M | Sound on or off |
| Esc | Close the panel |

## Publishing a new version

Browsers save copies of `style.css` and `game.js`. When you change them, change `?v=1.00.0` on both
lines in `index.html`, and the version at the bottom of the page, so players get the new files.
