# Release Checklist v1.0.0

## Quality Gate
- [ ] pnpm typecheck
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm build
- [ ] pnpm --filter web test:e2e

## Critical Validation
- [ ] Parser, reducer, classification, and navigation tests pass.
- [ ] Smoke scenarios pass for FEN, PGN, navigation, and persistence.
- [ ] No blocker or critical bugs open.

## Build Validation
- [ ] pnpm --filter web build succeeds.
- [ ] pnpm --filter web start serves app correctly.
- [ ] Stockfish assets load from public/stockfish.

## Scope Guardrails (Won't Have)
- [ ] No multiplayer features.
- [ ] No cloud storage features.
- [ ] Session persistence remains localStorage-only.

## Release Artifacts
- [ ] CHANGELOG updated.
- [ ] RELEASE_NOTES published.
- [ ] TECHNICAL_DECISIONS updated.
- [ ] CONSTRAINTS updated.
