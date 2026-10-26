# Neon Flip

A space block-stacking game made by Wynn. It plays like Tetris, but **gravity can flip to any of
the 4 sides of the board**. Open `index.html` in a browser to play.

## How to play

- Fill a whole line to clear it. The **glowing edge** of the board is the floor.
- At random times a **3‑2‑1 countdown** appears with a big arrow, and gravity flips: down, up,
  left or right. Every block falls to the new floor, and lines that fill up then count **double**.
- Arrow keys follow the screen: the arrow pointing at the floor makes the block fall faster, the
  opposite arrow turns it, and the other two move it. The **Controls** box shows what they do right now.
- Clear lines to call a **boss**. Every line you clear hurts it. Bosses fight back with junk rows
  and meteors. Beat one for lots of coins and points.
- Coins are saved between games. Spend them in the **shop**.

### Difficulty

| | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Block speed | slow | normal | fast |
| Gravity flips | every 35–50 s | every 25–40 s | every 15–28 s |
| Boss arrives after | 10 lines | 12 lines | 12 lines |
| Boss health | 8 | 14 | 22 |
| Boss attacks every | 16 s | 11 s | 7 s |
| Boss attacks | 1 junk row | 1 junk row, 3 meteors | 2 junk rows, 5 meteors |
| Coins and score | ×1 | ×1.5 | ×2 |

Each new boss has 50% more health than the one before. The bosses are **Zorb the Blob**,
**Squidra** and the **Black Hole King**.

### Shop

| Item | Price | What it does |
| --- | --- | --- |
| 🔫 Laser | 40 | Blasts away the whole line on the floor (key 1) |
| 🐢 Slow-mo | 30 | Blocks fall half as fast for 10 seconds (key 2) |
| 📦 Extra Hold slot | 150 | Hold a second piece (key V) |
| 🛸 Scout Ship | 120 | Pet: zaps the highest block every 20 s |
| 🚀 Laser Wing | 300 | Pet: zaps a block every 12 s |
| 🌟 Mothership | 600 | Pet: zaps 2 blocks every 8 s |

Pets hurt bosses too.

### Keys

| Key | Action |
| --- | --- |
| Arrow keys or WASD | Move, turn and fall faster (they change with gravity) |
| Space | Drop the block straight to the floor |
| X / Z | Turn right / turn left |
| C or Shift | Hold |
| V | Second hold slot |
| 1 / 2 | Laser / Slow-mo |
| P or Esc | Pause |
| M | Sound on or off |

On phones and tablets, touch buttons appear under the board.

## The online leaderboard

Scores use the same Supabase project as Castle Defense, in a separate table called
`neon_flip_scores`. Until that table exists, the game shows the scores saved on that computer.
To make the table, open Supabase's **SQL Editor** and run this once:

```sql
create table neon_flip_scores (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 16),
  score integer not null check (score >= 0),
  lines integer not null default 0 check (lines >= 0),
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard'))
);

alter table neon_flip_scores enable row level security;
create policy "Anyone can read scores" on neon_flip_scores for select using (true);
create policy "Anyone can add a score" on neon_flip_scores for insert with check (true);
```

To remove a fake or rude score, delete its row in Supabase's **Table Editor**.
