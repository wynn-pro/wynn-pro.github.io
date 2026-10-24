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

## How to play

- Pick **Easy**, **Medium** or **Hard** to start. Each wave starts as soon as the last one is cleared.
- Buy soldiers with the buttons at the top. They line up in front of the castle and shoot by themselves.
- Click an enemy to hit it yourself.
- Dead enemies drop coins. **Click a coin** to turn it into money. Enemies that walk over a coin pick it
  up, and drop everything they carried when they die.
- Enemies shoot back. Every soldier has a health bar, and a soldier with no health left is destroyed.
- **Sell soldier**, then click a soldier, gives you all of its money back.
  **Delete soldier** (top right) removes one with no money back.
- Every 2nd wave ends with a heavy tank. Every 3rd wave ends with a **giant boss** with 90,000 health
  that crushes soldiers it drives over. Only a **Mech** (top right) can beat it: two hits destroy it.
- Press **Tab** to wipe out every enemy on the field.

| Soldier | Cost | Health | What it does |
| --- | --- | --- | --- |
| Rifleman | $35 | 30 | Fast, accurate bullets |
| Archer | $40 | 25 | Arrows lobbed in an arc; a floppy ragdoll |
| Gas grenadier | $45 | 25 | Poison gas canisters, plus a big toxic cloud every 20 seconds |
| Tear gas | $50 | 25 | Slows every enemy near where the canister lands |
| Sniper | $70 | 20 | One shot kills an armored car |
| Mech | $200 | 9,000 | Exploding cannon shells; two hits kill the giant boss |
