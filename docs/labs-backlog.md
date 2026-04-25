# Labs backlog

Deferred features for the games in `src/pages/labs/` — picked up when one
of the V1 games gets revisited.

## klondike (`/labs/klondike`)

- [ ] Drag-drop card movement (current UX is click-to-select, click-to-place)
- [ ] Undo (single step or stack)
- [ ] Draw-3 mode toggle
- [ ] Hint system (highlight a legal move)
- [ ] Solvable-deal generator — currently uses random shuffles, ~80% are
      solvable with optimal play. A Yan-Lan-style solver could verify
      and retry until winnable.
- [ ] ATproto leaderboard (score = `moves * 1000 + seconds`, lower wins —
      mirrors how Microsoft Solitaire ranks)
- [ ] Fullscreen / focus mode (port from `Mahjong.tsx`)
- [ ] Auto-foundation sweep when only foundations are reachable (the
      "tap to finish" people expect at the end of every winnable hand)

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
