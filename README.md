# CheckMate Vision

CheckMate Vision is a browser-based chess analysis app focused on visual learning.
Instead of only showing raw engine text, it explains positions through interactive board
overlays, evaluation views, move navigation, and game-history analysis.

The app runs Stockfish (WASM) in the browser worker layer, so core analysis does not
require a backend.

## Table of Contents

1. [What This App Is](#what-this-app-is)
2. [How It Works](#how-it-works)
3. [Core Features](#core-features)
4. [Tech Stack and Architecture](#tech-stack-and-architecture)
5. [Repository Structure](#repository-structure)
6. [Quick Start](#quick-start)
7. [Development Commands](#development-commands)
8. [Testing and Release Quality Gate](#testing-and-release-quality-gate)
9. [v1 Scope Constraints](#v1-scope-constraints)
10. [Project Documentation](#project-documentation)

## What This App Is

CheckMate Vision is designed for players who want to understand why moves are good or bad,
not just what the best move is.

Product goals:
- Education through visual explanation (board control, candidate lines, eval trend).
- Performance through in-browser Stockfish worker execution.
- Smooth UX with responsive layout and modern interaction patterns.

## How It Works

High-level flow:

1. You input or reach a position (play moves, paste FEN, or load PGN).
2. Game state updates through context reducers.
3. Engine layer sends UCI commands to Stockfish in a Web Worker.
4. Streaming engine output is parsed into eval, depth, NPS, best move, and PV lines.
5. UI components render analysis views (evaluation bar, move list, chart, overlays).

The architecture follows three state layers:
- `GameProvider`: board state, history, FEN/PGN lifecycle.
- `EngineProvider`: Stockfish analysis state and parsed output.
- `UIProvider`: display toggles and layout preferences.

## Core Features

- Interactive chessboard with legal move handling and move navigation.
- FEN and PGN input for loading positions and full games.
- In-browser Stockfish analysis via worker (no required analysis backend).
- Evaluation display and game evaluation history chart.
- Multi-PV visualization (candidate lines and first-move overlays).
- Move quality classification pipeline for post-move feedback.
- Session persistence via localStorage (restore after refresh).
- Export workflow for board visualization snapshots.

Note: The product vision and design spec cover additional visual/UX enhancements that may
evolve incrementally across releases.

## Tech Stack and Architecture

Current repository implementation:
- Framework: Next.js 16 (App Router) + React 19.
- Language: TypeScript.
- Monorepo tooling: pnpm workspaces + Turbo.
- Chess logic: `chess.js`.
- Board UI: `react-chessboard`.
- Engine: `stockfish.js` (WASM) running in worker context.
- Charts: `recharts`.
- Motion: `framer-motion`.
- UI system: shared `@workspace/ui` package (shadcn-style component setup).

## Repository Structure

```text
apps/
	web/                 # Main Next.js app
packages/
	ui/                  # Shared UI components
	eslint-config/       # Shared ESLint configuration
	typescript-config/   # Shared TypeScript configuration
```

## Quick Start

Prerequisites:
- Node.js 20+
- pnpm 9.15.9+

From repository root:

```bash
pnpm install
pnpm dev
```

This starts workspace development (Turbo), including the web app.

To run only the web app:

```bash
pnpm --filter web dev
```

Production build and run:

```bash
pnpm build
pnpm --filter web start
```

## Development Commands

Root-level commands:

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm typecheck
pnpm release:check
```

Web app commands:

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web start
pnpm --filter web test
pnpm --filter web test:watch
pnpm --filter web test:e2e
pnpm --filter web test:e2e:headed
pnpm --filter web lint
pnpm --filter web typecheck
```

### Stockfish Asset Setup

The web package includes a `postinstall` script that copies Stockfish WASM assets into
`apps/web/public/stockfish`, so the engine can be loaded at runtime in the browser.

## Testing and Release Quality Gate

Run the full release gate from repository root:

```bash
pnpm release:check
```

Run smoke E2E checks for the web app:

```bash
pnpm --filter web test:e2e
```

Release readiness is tracked in `RELEASE_CHECKLIST.md` and includes:
- Type checking
- Linting
- Unit/integration tests
- Build validation
- E2E smoke scenarios

## v1 Scope Constraints

Explicitly out of scope for v1:
- Multiplayer gameplay
- Cloud storage

Persistence and privacy boundaries for v1:
- Session persistence is localStorage-only.
- Core engine analysis is local in-browser (worker-based).

## Project Documentation

- `CONSTRAINTS.md`: explicit scope boundaries for v1.
- `TECHNICAL_DECISIONS.md`: architecture and implementation rationale.
- `RELEASE_CHECKLIST.md`: release validation gates.
- `CHANGELOG.md`: change history and release entries.
- `apps/web/RELEASE_NOTES.md`: web-app release summary.
- `.docs/prd.md`: product requirements and roadmap.
- `.docs/design-vision.md`: target UX, architecture, and feature design.
