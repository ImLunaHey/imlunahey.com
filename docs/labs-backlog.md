# Labs backlog

Deferred features for the games in `src/pages/labs/` — picked up when one
of the V1 games gets revisited.

## klondike (`/labs/klondike`)

- [x] Undo stack
- [x] Draw-3 mode toggle
- [x] Hint system (highlights a legal move for ~1.8s)
- [x] ATproto leaderboard (score = elapsed seconds, lower wins —
      consistent with sudoku/mahjong; moves shown but not ranked)
- [x] Fullscreen / focus mode (ported from `Mahjong.tsx`)
- [x] Auto-foundation sweep when only foundations are reachable
- [x] Drag-drop card movement (pointer events, mouse + touch, custom
      drag preview, 5px threshold separates click from drag)
- [x] Solvable-deal generator — thoughtful-klondike solver (DFS +
      transposition table) wraps deal() and retries with deterministic
      salts until a winnable deal is found.

## mahjong (`/labs/mahjong`)

- [ ] More layouts (turtle, dragon, fortress are the iconic Microsoft
      Mahjong Titans shapes — each ~144 tiles, half-tile shifts make the
      turtle work)
- [ ] Undo
- [ ] Per-deal "tip"/hint highlighting beyond the existing one-off
- [ ] Statistics dashboard (per-layout win-rate, fastest time)

## sudoku (`/labs/sudoku`)

- [ ] Undo
- [ ] Auto-pencilmarks toggle (fill candidates automatically)
- [ ] Highlight conflicts as you type (currently silent until win check)
- [ ] Daily puzzle mode (seeded by date, single shared puzzle per day —
      same flavour as the Wordle lab)
- [ ] Statistics (best time per difficulty)

## site-wide

- [ ] Shared `<LeaderboardPanel>` component — Snake/Sudoku/Mahjong all
      duplicate the row-rendering JSX + CSS. Pull it out once a fourth
      consumer appears.
- [ ] Shared OAuth + score-publish hook — same duplication as above
      (Snake's `startSignIn` + `publish` are copy-pasted into Sudoku
      and Mahjong).
