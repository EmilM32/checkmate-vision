import type {
  EngineState,
  PersistableEngineState,
} from "@/context/engine-context"
import type { GameState } from "@/context/game-context"
import { initialUIState, type UIState } from "@/context/ui-context"

export const SESSION_STORAGE_KEY = "checkmate-vision:session"
export const SESSION_SCHEMA_VERSION = 3

type PersistedSessionShape<Version extends number> = {
  schemaVersion: Version
  savedAt: string
  game: GameState
  ui: UIState
  engine: PersistableEngineState
}

// v1 stored engine scores from the side-to-move perspective (and move
// classifications derived from them); v2 stores them from White's perspective;
// v3 classifies moves by win chance.
export type PersistedSessionV1 = PersistedSessionShape<1>
export type PersistedSessionV2 = PersistedSessionShape<2>
export type PersistedSessionV3 = PersistedSessionShape<3>

type PersistedSession = PersistedSessionV3

type PersistedSessionInput = {
  game: GameState
  ui: UIState
  engine: PersistableEngineState
}

type LegacyPersistedSession = {
  game?: unknown
  ui?: unknown
  engine?: unknown
}

// `ui` is checked field by field below. A wrong field must not fail this
// guard: that used to drop a game that could still be restored.
type PersistedEnvelope<Version extends number> = {
  schemaVersion: Version
  savedAt: string
  game: GameState
  ui: unknown
  engine: PersistableEngineState
}

const SQUARE_PATTERN = /^[a-h][1-8]$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isPersistedEnvelope<Version extends number>(
  value: unknown,
  version: Version
): value is PersistedEnvelope<Version> {
  if (!isObject(value)) return false
  if (value.schemaVersion !== version) return false
  return (
    isObject(value.game) &&
    isObject(value.engine) &&
    typeof value.savedAt === "string"
  )
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

// `null` means nothing is selected. Anything else must be a real square;
// "E4" and surrounding space are stored as "e4".
function sanitizeSquare(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== "string") return null
  const square = value.trim().toLowerCase()
  return SQUARE_PATTERN.test(square) ? square : null
}

function sanitizeUIState(value: unknown): UIState {
  if (!isObject(value)) return { ...initialUIState }

  const heatmapMode = value.heatmapMode

  return {
    showHeatmap: sanitizeBoolean(value.showHeatmap, initialUIState.showHeatmap),
    heatmapMode:
      heatmapMode === "net" || heatmapMode === "split"
        ? heatmapMode
        : initialUIState.heatmapMode,
    showInfluenceTrace: sanitizeBoolean(
      value.showInfluenceTrace,
      initialUIState.showInfluenceTrace
    ),
    selectedInfluenceSquare: sanitizeSquare(value.selectedInfluenceSquare),
    showArrows: sanitizeBoolean(value.showArrows, initialUIState.showArrows),
    guessMode: sanitizeBoolean(value.guessMode, initialUIState.guessMode),
    boardFlipped: sanitizeBoolean(
      value.boardFlipped,
      initialUIState.boardFlipped
    ),
    showEvalChart: sanitizeBoolean(
      value.showEvalChart,
      initialUIState.showEvalChart
    ),
    engineEnabled: sanitizeBoolean(
      value.engineEnabled,
      initialUIState.engineEnabled
    ),
  }
}

function uiNeedsRepair(stored: unknown, sanitized: UIState): boolean {
  if (!isObject(stored)) return true
  return (Object.keys(sanitized) as (keyof UIState)[]).some(
    (key) => stored[key] !== sanitized[key]
  )
}

// Scores saved before v2 use a different perspective and cannot be trusted,
// so the analysis is dropped and recomputed; the game itself is kept. From
// v2 the scores stay and only the classifications are dropped.
function dropStaleAnalysis(
  game: GameState,
  ui: UIState,
  engine: PersistableEngineState,
  keepScores = false
): PersistedSessionV3 {
  return {
    schemaVersion: 3,
    savedAt: new Date().toISOString(),
    game: {
      ...game,
      history: (Array.isArray(game.history) ? game.history : []).map(
        (move) => ({
          ...move,
          ...(keepScores
            ? {}
            : { scoreBefore: null, scoreAfter: null, delta: null }),
          classification: null,
        })
      ),
    },
    ui,
    engine: { guessRevealed: engine.guessRevealed === true },
  }
}

function migrateLegacySession(value: unknown): PersistedSessionV3 | null {
  if (!isObject(value)) return null

  const legacy = value as LegacyPersistedSession
  if (!isObject(legacy.game) || !isObject(legacy.engine)) {
    return null
  }

  return dropStaleAnalysis(
    legacy.game as GameState,
    sanitizeUIState(legacy.ui),
    legacy.engine as PersistableEngineState
  )
}

export function migratePersistedSession(
  value: unknown
): PersistedSession | null {
  if (isPersistedEnvelope(value, 3)) {
    return {
      schemaVersion: 3,
      savedAt: value.savedAt,
      game: value.game,
      ui: sanitizeUIState(value.ui),
      engine: value.engine,
    }
  }

  if (isPersistedEnvelope(value, 2)) {
    return dropStaleAnalysis(
      value.game,
      sanitizeUIState(value.ui),
      value.engine,
      true
    )
  }

  if (isPersistedEnvelope(value, 1)) {
    return dropStaleAnalysis(
      value.game,
      sanitizeUIState(value.ui),
      value.engine
    )
  }

  if (isObject(value) && "schemaVersion" in value) {
    return null
  }

  return migrateLegacySession(value)
}

function isBrowserStorageAvailable() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  )
}

export function selectPersistableEngineState(
  engineState: EngineState
): PersistableEngineState {
  return { guessRevealed: engineState.guessRevealed }
}

export function readPersistedSession(): PersistedSession | null {
  if (!isBrowserStorageAvailable()) return null

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    const migrated = migratePersistedSession(parsed)

    if (!migrated) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    // Write the repaired session back so the next refresh does not read the
    // bad value again. A game that cannot be read never reaches this branch.
    if (uiNeedsRepair(isObject(parsed) ? parsed.ui : undefined, migrated.ui)) {
      try {
        window.localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(migrated)
        )
      } catch {
        // The in-memory session is already safe. Ignore quota errors.
      }
    }

    return migrated
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function writePersistedSession(session: PersistedSessionInput): void {
  if (!isBrowserStorageAvailable()) return

  const payload: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    ...session,
  }

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota and serialization errors.
  }
}

export function clearPersistedSession(): void {
  if (!isBrowserStorageAvailable()) return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}
