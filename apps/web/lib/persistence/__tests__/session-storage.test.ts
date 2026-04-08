import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_POSITION } from "chess.js"

import {
  clearPersistedSession,
  migratePersistedSession,
  readPersistedSession,
  SESSION_SCHEMA_VERSION,
  SESSION_STORAGE_KEY,
  selectPersistableEngineState,
  writePersistedSession,
} from "@/lib/persistence/session-storage"
import { initialEngineState } from "@/context/engine-context"
import { initialGameState } from "@/context/game-context"
import { initialUIState } from "@/context/ui-context"

class LocalStorageMock {
  private store = new Map<string, string>()

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}

describe("session storage migration", () => {
  it("accepts v1 payload", () => {
    const payload = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      game: initialGameState,
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    }

    const migrated = migratePersistedSession(payload)
    expect(migrated).not.toBeNull()
    expect(migrated?.schemaVersion).toBe(1)
  })

  it("migrates legacy payload without schema version", () => {
    const legacyPayload = {
      game: {
        ...initialGameState,
        fen: DEFAULT_POSITION,
      },
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    }

    const migrated = migratePersistedSession(legacyPayload)

    expect(migrated).not.toBeNull()
    expect(migrated?.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
  })

  it("rejects invalid payload", () => {
    const migrated = migratePersistedSession({ schemaVersion: 1 })
    expect(migrated).toBeNull()
  })
})

describe("session storage read/write", () => {
  const localStorage = new LocalStorageMock()

  beforeEach(() => {
    ;(
      globalThis as unknown as {
        window: { localStorage: LocalStorageMock }
      }
    ).window = { localStorage }

    localStorage.clear()
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it("writes and reads session round-trip", () => {
    writePersistedSession({
      game: initialGameState,
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    })

    const restored = readPersistedSession()
    expect(restored).not.toBeNull()
    expect(restored?.game.fen).toBe(DEFAULT_POSITION)
    expect(restored?.ui.showArrows).toBe(true)
  })

  it("clears stored session", () => {
    writePersistedSession({
      game: initialGameState,
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    })

    clearPersistedSession()

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it("drops invalid json payload", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "not-json")

    const restored = readPersistedSession()
    expect(restored).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })
})
