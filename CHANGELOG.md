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

### Fixed
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

### Changed
- Session schema v2: analysis saved by earlier versions is discarded on load (the game is
  kept).
- Game analysis searches depth 16 with two lines; live analysis depth 20 with three.
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
