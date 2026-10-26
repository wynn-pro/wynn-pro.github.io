# Castle Defense

Defend the castle from waves of angry enemy soldiers, armored cars, heavy tanks and a giant boss.
Buy riflemen, ragdoll archers, gas grenadiers, tear gas, snipers and a giant Mech, then watch real
physics do the rest: arrows arc and can miss, shells explode, and fallen enemies flop like ragdolls.

This is the web version of `defence.py`. It is plain HTML, CSS and JavaScript, with no build
step and no downloads, so it runs on GitHub Pages as is.

## Play it on your computer

Open `index.html` in a web browser. That's it.

## Publish it on GitHub Pages

1. Create a new repository on GitHub (for example `castle-defense`). Make it **public**.
2. Upload the files in this folder (`index.html`, `style.css`, `game.js`, `README.md`) to the
   repository: on the repository page, click **Add file → Upload files**, drag them in, and click
   **Commit changes**.
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick the branch
   **main** and the folder **/ (root)**, then click **Save**.
5. Wait a minute or two. The page shows your game's address, which looks like
   `https://YOUR-USERNAME.github.io/castle-defense/`.

Every time you upload changed files, GitHub Pages updates the game automatically.

### Making sure players get the new version

Browsers save copies of `style.css` and `game.js`, so after an update some players can still see
the old game. To stop that, change the version number in `index.html` every time you release:

- `style.css?v=1.02.0` and `game.js?v=1.02.0` (for example to `?v=1.03.0`)
- the version shown at the bottom of the page, `v1.02.0`

The new number makes the browser download the new files. GitHub Pages can take up to 10 minutes
to show a new `index.html`; to see it right away, press **Ctrl+Shift+R** (**Cmd+Shift+R** on a Mac).

## How to play

- Pick **Easy**, **Medium** or **Hard** to start. Each wave starts as soon as the last one is cleared.
- Buy soldiers with the cards at the top. A card that's greyed out shows why: not enough money, or the army is full. They line up in front of the castle and shoot by themselves.
- Click an enemy to hit it yourself.
- Dead enemies drop coins. **Click a coin** to turn it into money. Enemies that walk over a coin pick it
  up, and drop everything they carried when they die.
- Enemies shoot back. Every soldier has a health bar, and a soldier with no health left is destroyed.
- **Sell**, then click a soldier, gives you all of its money back.
  **Delete** removes one with no money back. Press **Esc** to cancel either mode.
- Every **6th wave** ends with the **giant giant boss** instead: 900,000 health and bigger than the giant
  boss. A Golem's boulder takes a third of its health (3 hits); a Mech's shell only a twentieth (20 hits).
- Every **7th wave** ends with the **giant gorilla**: 9,000,000 health, and each boulder it throws does
  300,000 damage. A Golem's boulder takes a tenth of its health (10 hits); a Mech's shell a hundredth (100 hits).
- From **wave 5** on, every enemy has **10× health** (except the giant boss).
- Every 2nd wave ends with a heavy tank. Every 3rd wave ends with a **giant boss** with 90,000 health
  that crushes soldiers it drives over. Only a **Mech** (the blue card in the shop glows while it's out) can beat it: two hits destroy it.
- With **2 or more Mechs**, press **Collector**, then click one of them. That Mech walks the battlefield
  picking up coins for you. It does not shoot, and enemies can still destroy it. Buy **Mech armor**
  (+20,000 for $50, up to 200,000) to make it tougher: armor is used up before its health.
  Click the collector again in Collector mode to send it back to fight.
- With **3 or more soldiers**, press **Combine** (twice, to confirm) to merge every soldier into one giant
  stone **Golem**. It gets all their health plus 60,000 for each soldier, throws exploding boulders, smashes
  the giant boss in **one hit**, and is too big to be driven over. Recruit more soldiers later and press
  Combine again to add them to it. Selling the Golem gives back what all its soldiers cost.
- Press **Tab** to wipe out every enemy on the field.
- The game pauses by itself when you switch tabs, and remembers your best score.
- If your score makes the **top 10**, write your name when the game ends and it goes on the
  **leaderboard**. Everyone who plays shares the same leaderboard.

### The online leaderboard

Scores are stored in a free [Supabase](https://supabase.com) database (table `scores`). The
Project URL and publishable key at the top of the leaderboard section in `game.js` are safe to
publish: the database only lets them read scores and add new ones. Never put the `service_role`
or secret key in the game. To remove a fake or rude score, delete its row in Supabase's
**Table Editor**. If Supabase can't be reached, the game shows the scores saved on that computer.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| 1–6 | Recruit Rifleman, Archer, Gas grenadier, Tear gas, Sniper, Mech |
| U / A / B | Upgrade weapons / buy armor / buy sniper ammo |
| S / D | Sell mode / delete mode |
| C / K | Pick a collector Mech / buy Mech armor |
| G | Combine every soldier into a Golem (press twice) |
| P or Space | Pause |
| F | Change enemy speed (1×, 2×, 3×) |
| M | Sound on or off |
| Esc | Cancel sell or delete, or pause |
| Tab | Wipe out every enemy |

| Soldier | Cost | Health | What it does |
| --- | --- | --- | --- |
| Rifleman | $35 | 30 | Fast, accurate bullets |
| Archer | $40 | 25 | Arrows lobbed in an arc; a floppy ragdoll |
| Gas grenadier | $45 | 25 | Poison gas canisters, plus a big toxic cloud every 20 seconds |
| Tear gas | $50 | 25 | Slows every enemy near where the canister lands |
| Sniper | $70 | 20 | One shot kills an armored car |
| Mech | $200 | 9,000 | Exploding cannon shells; two hits kill the giant boss |
