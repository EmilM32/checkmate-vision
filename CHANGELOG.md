# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project follows semantic versioning.

## [Unreleased]

### Added
- Promotion piece picker (queen, rook, bishop, knight) instead of automatic queening.
- PGN import of games set up from a FEN, with player names, ratings, result and
  `[%clk]` clocks; move numbering follows the initial position.
- Player bars with names, ratings, clocks, captured pieces and material lead.
- Accessible names for navigation buttons and classified moves.
- CI workflow (typecheck, lint, test, build, e2e).
- Game analysis runs in its own pool of engines (cores - 1, at most 4) next to the
  live engine, and classifies each move as soon as both of its positions are done.
- Engine results are cached per position: revisiting a position, or browsing an
  analysed game, shows its lines at once instead of searching again.
- Engine load and crash errors are shown in the analysis panel with a retry button.
- "Inaccuracy" (`?!`) move class.
- Game summary after a full analysis: accuracy per player (Lichess' formula) and the
  number of brilliant, great, inaccurate, mistaken and blundered moves.

### Fixed
- Polish texts had no diacritics because the font was loaded without its `latin-ext`
  subset; the Polish dictionary is now written properly (and uses Lichess' terms:
  niedokładność / błąd / gruby błąd).
- Evaluation chart: the y-axis labels were clipped, the line was light gray on white and
  the ±10 pawn scale flattened balanced games. It now plots White's win chance (the
  midline is an equal game), with a theme-aware line, green/red fill split exactly at
  the midline and one x-axis tick per full move.
- Guess mode showed the game summary (accuracy and move counts); it is hidden now.
- The heatmap help said a right-click shows the pieces influencing a square; it takes
  Alt + right-click.
- A finished game shows "Checkmate – game over" or "Stalemate – draw" instead of
  "No analysis"; the idle "Batch analysis inactive 0%" bar is gone (progress appears
  once a game analysis starts); board coordinates are bolder and higher-contrast.
- Engine scores were read from the side-to-move perspective as if they were White's:
  the eval bar, engine lines and move classification were inverted with Black to move.
- Move classification on a shared cp/mate scale (forced mates are no longer penalised).
- The engine hung after reaching a checkmate or stalemate position.
- Multi-PV never worked (`go ... multipv` is not valid UCI); three lines are now shown.
- Stockfish's default contempt biased evaluations by ~0.7 pawns per ply; it is now off.
- Game analysis overwrote the live engine view and left it stale afterwards.
- Engine results arriving back to back could drop a move's classification.
- Eval bar taller than the board; player bars detached from the board; player bars not
  swapped on a flipped board; hard-coded `10:00` clocks.
- Low-contrast move classification colours in the move list.
- Conditional hook call in the heatmap legend and other lint warnings.
- On phones and tablets the analysis panel was cut off below the screen; the page now
  scrolls there, and the toolbar wraps instead of overflowing.

### Changed
- Each engine line in the analysis panel has a bar in its arrow's colour (green best,
  blue second, orange third), and the help popover explains the arrows.
- Engine arrows are drawn as one filled shape each, with a head sized to the board (it
  was a thin line with a tiny marker head whose overlap doubled the opacity). Knight
  moves get an L-shaped arrow; the best line is bolder and drawn on top.
- First visit is calmer: the heatmap starts off, and the import section (PGN/FEN) is open
  while no game is loaded, with a hint in the empty move list. The engine still starts
  off, so a position can be worked out before looking at its evaluation.
- The always-visible legend column is gone (the board gets its width back); the same
  help is in a "?" popover in the toolbar. The control counts of the square picked with
  Alt + right-click are shown over the board.
- Toolbar icons have tooltips, accessible names and pressed states; the heatmap mode
  reads "Netto/Osobno" ("Net/Split"). Theme and language switches sit in the analysis
  panel header; the theme no longer needs the hidden D shortcut.
- Moves are classified by the loss of win chance (Lichess' model) instead of raw
  centipawns, so the same loss weighs less in a decided position; thresholds 2 / 5 / 10 /
  20 points for best, good, inaccuracy and mistake. The opening leniency is gone.
- "Great" now means the engine's only move: the second best would have lost at least
  10 points and turned a win into a draw or a draw into a loss (it was measured on the
  opponent's replies before).
- "Brilliant" now detects real sacrifices (a piece or the exchange left to be taken),
  played without loss; before, it compared the mover's own material and never fired.
- Session schema v3: classifications saved by v2 are dropped on load (scores are kept).
- Session schema v2: analysis saved by earlier versions is discarded on load (the game is
  kept).
- Stockfish 19 (lite NNUE, single-threaded, ~2 MB) replaces Stockfish 10: about 3-4x
  faster to the same depth. The engine files are copied from the `stockfish` package
  on install instead of being committed, and served with long-lived cache headers.
- Live analysis searches depth 22 (at most 12 s) with three lines. Game analysis
  searches 500k nodes per position on a cleared hash, with two lines: the same game now
  always gets the same classifications and accuracies (with a time limit and a shared
  hash, accuracies of one game differed by 10+ points between runs). A game takes
  about a third longer than before.
- Live analysis pauses while the tab is hidden.
- ESLint ignores the vendored Stockfish build in `public/`.

## [1.0.0] - 2026-04-08

### Added
- Critical QA tests for game state transitions in GameContext.
- UI reducer tests for toggle, restore, and reset behavior.
- Navigation controls tests for keyboard and button interactions.
- Playwright smoke scaffolding for key user flows.
- Release readiness documents: checklist, constraints, and technical decisions.

### Changed
- Vitest configuration now supports tsx tests in a browser-like environment.
- Workspace scripts include release gate commands.

### Known constraints
- No multiplayer support in v1.
- No cloud storage in v1 (localStorage only).
