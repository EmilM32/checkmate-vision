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
  it("accepts current payload unchanged", () => {
    const payload = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      game: initialGameState,
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    }

    expect(migratePersistedSession(payload)).toEqual(payload)
  })

  it("keeps the game but drops stale analysis from v1 payload", () => {
    const fenAfterE4 =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    const payload = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      game: {
        ...initialGameState,
        fen: fenAfterE4,
        history: [
          {
            san: "e4",
            fen: fenAfterE4,
            scoreBefore: { type: "cp", value: 30 },
            scoreAfter: { type: "cp", value: -30 },
            delta: 60,
            classification: "good",
          },
        ],
        currentMoveIndex: 1,
        turn: "b",
      },
      ui: { ...initialUIState, engineEnabled: true },
      engine: {
        ...selectPersistableEngineState(initialEngineState),
        evaluation: { type: "cp", value: -30 },
        bestMove: "e7e5",
        pvLines: [{ id: 1, score: { type: "cp", value: -30 }, pv: ["e7e5"] }],
        batch: { ...initialEngineState.batch, requestId: 5, status: "done" },
      },
    }

    const migrated = migratePersistedSession(payload)

    expect(migrated?.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(migrated?.game.fen).toBe(fenAfterE4)
    expect(migrated?.game.history).toEqual([
      {
        san: "e4",
        fen: fenAfterE4,
        scoreBefore: null,
        scoreAfter: null,
        delta: null,
        classification: null,
      },
    ])
    expect(migrated?.ui.engineEnabled).toBe(true)
    expect(migrated?.engine).toEqual({ guessRevealed: false })
  })

  it("keeps v2 scores but drops classifications from the old model", () => {
    const fenAfterE4 =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    const move = {
      san: "e4",
      fen: fenAfterE4,
      scoreBefore: { type: "cp" as const, value: 30 },
      scoreAfter: { type: "cp" as const, value: 30 },
      delta: 0,
      classification: "great" as const,
    }
    const migrated = migratePersistedSession({
      schemaVersion: 2,
      savedAt: new Date().toISOString(),
      game: { ...initialGameState, fen: fenAfterE4, history: [move] },
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    })

    expect(migrated?.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(migrated?.game.history).toEqual([{ ...move, classification: null }])
  })

  it("rejects payload with an unknown schema version", () => {
    const payload = {
      schemaVersion: 99,
      savedAt: new Date().toISOString(),
      game: initialGameState,
      ui: initialUIState,
      engine: selectPersistableEngineState(initialEngineState),
    }

    expect(migratePersistedSession(payload)).toBeNull()
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

const fenAfterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"

const gameAfterE4 = {
  ...initialGameState,
  fen: fenAfterE4,
  history: [
    {
      san: "e4",
      fen: fenAfterE4,
      scoreBefore: null,
      scoreAfter: null,
      delta: null,
      classification: null,
    },
  ],
  currentMoveIndex: 1,
  turn: "b" as const,
}

function sessionWithUi(ui: unknown) {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: "2026-01-01T00:00:00.000Z",
    game: gameAfterE4,
    ui,
    engine: { guessRevealed: false },
  }
}

describe("corrupt persisted ui", () => {
  it.each([
    ["a number", 4],
    ["an object", { square: "e4" }],
    ["an array", ["e4"]],
    ["a square off the board", "z9"],
  ])(
    "replaces selectedInfluenceSquare when it is %s and keeps the game",
    (_label, square) => {
      const migrated = migratePersistedSession(
        sessionWithUi({
          ...initialUIState,
          showHeatmap: true,
          boardFlipped: true,
          selectedInfluenceSquare: square,
        })
      )

      expect(migrated?.ui.selectedInfluenceSquare).toBeNull()
      expect(migrated?.ui.showHeatmap).toBe(true)
      expect(migrated?.ui.boardFlipped).toBe(true)
      expect(migrated?.game).toEqual(gameAfterE4)
      expect(migrated?.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    }
  )

  it("keeps null and a real square, and stores the square in lowercase", () => {
    const squareOf = (square: unknown) =>
      migratePersistedSession(
        sessionWithUi({ ...initialUIState, selectedInfluenceSquare: square })
      )?.ui.selectedInfluenceSquare

    expect(squareOf(null)).toBeNull()
    expect(squareOf("a1")).toBe("a1")
    expect(squareOf("h8")).toBe("h8")
    expect(squareOf("E4")).toBe("e4")
    expect(squareOf(" e4 ")).toBe("e4")
    expect(squareOf("a9")).toBeNull()
    expect(squareOf("i1")).toBeNull()
    expect(squareOf("")).toBeNull()
  })

  it("replaces every ui field of the wrong type and keeps the valid ones", () => {
    const migrated = migratePersistedSession(
      sessionWithUi({
        showHeatmap: "yes",
        heatmapMode: 1,
        showInfluenceTrace: "true",
        selectedInfluenceSquare: "d5",
        showArrows: null,
        guessMode: 0,
        boardFlipped: "false",
        showEvalChart: [],
        engineEnabled: true,
      })
    )

    expect(migrated?.ui).toEqual({
      ...initialUIState,
      selectedInfluenceSquare: "d5",
      engineEnabled: true,
    })
    expect(migrated?.game.currentMoveIndex).toBe(1)
    expect(migrated?.game.history[0]?.san).toBe("e4")
  })

  it.each([
    ["a number", 4],
    ["null", null],
    ["a string", "ui"],
  ])(
    "replaces ui when the whole value is %s and keeps the game",
    (_label, ui) => {
      const migrated = migratePersistedSession(sessionWithUi(ui))

      expect(migrated?.ui).toEqual(initialUIState)
      expect(migrated?.game).toEqual(gameAfterE4)
    }
  )
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

    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    const restored = readPersistedSession()
    expect(restored).not.toBeNull()
    expect(restored?.game.fen).toBe(DEFAULT_POSITION)
    expect(restored?.ui.showArrows).toBe(true)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(raw)
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

  it("writes a repaired ui back and leaves the game in place", () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(
        sessionWithUi({
          showHeatmap: true,
          heatmapMode: "split",
          showInfluenceTrace: "yes",
          selectedInfluenceSquare: { file: "e", rank: 4 },
          showArrows: true,
          guessMode: false,
          boardFlipped: 1,
          showEvalChart: false,
          engineEnabled: false,
        })
      )
    )

    const restored = readPersistedSession()

    expect(restored?.ui).toEqual({
      ...initialUIState,
      showHeatmap: true,
      heatmapMode: "split",
      showArrows: true,
    })
    expect(restored?.game.history).toEqual(gameAfterE4.history)
    expect(restored?.game.currentMoveIndex).toBe(1)

    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    const stored = JSON.parse(raw ?? "null") as {
      ui: { selectedInfluenceSquare: unknown; boardFlipped: unknown }
      game: { history: { san: string }[]; currentMoveIndex: number }
    }
    expect(stored.ui.selectedInfluenceSquare).toBeNull()
    expect(stored.ui.boardFlipped).toBe(false)
    expect(stored.game.history[0]?.san).toBe("e4")
    expect(stored.game.currentMoveIndex).toBe(1)

    expect(readPersistedSession()?.ui.selectedInfluenceSquare).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(raw)
  })

  it.each([
    ["null", null],
    ["a string", "fen"],
    ["a number", 1],
  ])("removes the key when the game is %s", (_label, game) => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SESSION_SCHEMA_VERSION,
        savedAt: "2026-01-01T00:00:00.000Z",
        game,
        ui: { ...initialUIState, selectedInfluenceSquare: 4 },
        engine: { guessRevealed: false },
      })
    )

    expect(readPersistedSession()).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })
})
