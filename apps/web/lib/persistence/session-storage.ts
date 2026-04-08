import type {
  EngineState,
  PersistableEngineState,
} from "@/context/engine-context"
import type { GameState } from "@/context/game-context"
import type { UIState } from "@/context/ui-context"

export const SESSION_STORAGE_KEY = "checkmate-vision:session"
export const SESSION_SCHEMA_VERSION = 1

export type PersistedSessionV1 = {
  schemaVersion: 1
  savedAt: string
  game: GameState
  ui: UIState
  engine: PersistableEngineState
}

type PersistedSession = PersistedSessionV1

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

function isPersistedSessionV1(value: unknown): value is PersistedSessionV1 {
  if (!isObject(value)) return false
  if (value.schemaVersion !== 1) return false
  return (
    isObject(value.game) &&
    isObject(value.ui) &&
    isObject(value.engine) &&
    typeof value.savedAt === "string"
  )
}

function migrateLegacySession(value: unknown): PersistedSessionV1 | null {
  if (!isObject(value)) return null

  const legacy = value as LegacyPersistedSession
  if (
    !isObject(legacy.game) ||
    !isObject(legacy.ui) ||
    !isObject(legacy.engine)
  ) {
    return null
  }

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    game: legacy.game as GameState,
    ui: legacy.ui as UIState,
    engine: legacy.engine as PersistableEngineState,
  }
}

export function migratePersistedSession(
  value: unknown
): PersistedSession | null {
  if (isPersistedSessionV1(value)) {
    return value
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
  return {
    evaluation: engineState.evaluation,
    depth: engineState.depth,
    nps: engineState.nps,
    bestMove: engineState.bestMove,
    pvLines: engineState.pvLines,
    sleuthRevealed: engineState.sleuthRevealed,
    batch: engineState.batch,
  }
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
