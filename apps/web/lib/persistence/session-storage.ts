import type {
  EngineState,
  PersistableEngineState,
} from "@/context/engine-context"
import type { GameState } from "@/context/game-context"
import type { UIState } from "@/context/ui-context"

export const SESSION_STORAGE_KEY = "checkmate-vision:session"
export const SESSION_SCHEMA_VERSION = 2

type PersistedSessionShape<Version extends number> = {
  schemaVersion: Version
  savedAt: string
  game: GameState
  ui: UIState
  engine: PersistableEngineState
}

// v1 stored engine scores from the side-to-move perspective (and move
// classifications derived from them); v2 stores them from White's perspective.
export type PersistedSessionV1 = PersistedSessionShape<1>
export type PersistedSessionV2 = PersistedSessionShape<2>

type PersistedSession = PersistedSessionV2

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isPersistedSessionOfVersion<Version extends number>(
  value: unknown,
  version: Version
): value is PersistedSessionShape<Version> {
  if (!isObject(value)) return false
  if (value.schemaVersion !== version) return false
  return (
    isObject(value.game) &&
    isObject(value.ui) &&
    isObject(value.engine) &&
    typeof value.savedAt === "string"
  )
}

// Scores saved before v2 use a different perspective and cannot be trusted,
// so the analysis is dropped and recomputed; the game itself is kept.
function dropStaleAnalysis(
  game: GameState,
  ui: UIState,
  engine: PersistableEngineState
): PersistedSessionV2 {
  return {
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    game: {
      ...game,
      history: (Array.isArray(game.history) ? game.history : []).map(
        (move) => ({
          ...move,
          scoreBefore: null,
          scoreAfter: null,
          delta: null,
          classification: null,
        })
      ),
    },
    ui,
    engine: { guessRevealed: engine.guessRevealed === true },
  }
}

function migrateLegacySession(value: unknown): PersistedSessionV2 | null {
  if (!isObject(value)) return null

  const legacy = value as LegacyPersistedSession
  if (
    !isObject(legacy.game) ||
    !isObject(legacy.ui) ||
    !isObject(legacy.engine)
  ) {
    return null
  }

  return dropStaleAnalysis(
    legacy.game as GameState,
    legacy.ui as UIState,
    legacy.engine as PersistableEngineState
  )
}

export function migratePersistedSession(
  value: unknown
): PersistedSession | null {
  if (isPersistedSessionOfVersion(value, 2)) {
    return value
  }

  if (isPersistedSessionOfVersion(value, 1)) {
    return dropStaleAnalysis(value.game, value.ui, value.engine)
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

    return migrated
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function writePersistedSession(session: PersistedSessionInput): void {
  if (!isBrowserStorageAvailable()) return

  const payload: PersistedSession = {
    schemaVersion: 2,
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
