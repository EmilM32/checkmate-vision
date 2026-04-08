# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project follows semantic versioning.

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
