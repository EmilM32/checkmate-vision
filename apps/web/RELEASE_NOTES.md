# Checkmate Vision v1.0.0 Release Notes

Release date: 2026-04-08

## Highlights
- Stabilized critical game state flows with additional automated tests.
- Added smoke E2E framework for key user scenarios.
- Hardened release process with explicit quality gates.

## Quality
- Unit and integration test coverage expanded for reducers and navigation.
- Smoke tests cover app boot, FEN input, and PGN load basics.

## Scope Boundaries
- Multiplayer is not included in v1.
- Cloud storage is not included in v1.
- Persistence remains localStorage only.

## Operational Notes
- Run full gate via: pnpm release:check
- Run web smoke E2E via: pnpm --filter web test:e2e
