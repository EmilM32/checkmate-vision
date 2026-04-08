# Technical Decisions for v1

## Decision Log

1. Context + useReducer architecture
- Why: keeps state transitions explicit and testable.
- Traceability: spec sections 1-3.

2. In-browser Stockfish worker
- Why: no backend dependency, lower operational complexity.
- Traceability: PRD 3.4 and spec sections 3-4.

3. localStorage persistence with schema versioning
- Why: explicit v1 scope excludes cloud storage.
- Traceability: PRD 3.4 and spec sections 9-10.

4. Smoke E2E with Playwright
- Why: verify critical user flows beyond unit tests.
- Traceability: AI-10 quality gate.

5. Guardrail documentation in release artifacts
- Why: preserve explicit scope boundaries and prevent scope drift.
- Traceability: PRD 3.4 and section 7.
