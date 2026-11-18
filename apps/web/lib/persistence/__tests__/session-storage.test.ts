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

function sessionWithGame(
  game: unknown,
  patch: { engine?: unknown; savedAt?: unknown } = {}
) {
  return {
    ...sessionWithUi(initialUIState),
    game,
    ...patch,
  }
}

describe("corrupt persisted game", () => {
  const move = gameAfterE4.history[0]!

  it.each([
    ["an object", { a: 1 }],
    ["an unknown label", "zzz"],
  ])(
    "drops a classification that is %s and keeps the move",
    (_label, classification) => {
      const migrated = migratePersistedSession(
        sessionWithGame({
          ...gameAfterE4,
          history: [{ ...move, classification }],
        })
      )

      expect(migrated?.game.history[0]).toEqual(move)
      expect(migrated?.game.currentMoveIndex).toBe(1)
      expect(migrated?.game.initialFen).toBe(gameAfterE4.initialFen)
    }
  )

  it("drops an evaluation that is not a score and keeps a real classification", () => {
    const migrated = migratePersistedSession(
      sessionWithGame({
        ...gameAfterE4,
        history: [
          {
            ...move,
            classification: "good",
            scoreBefore: {},
            scoreAfter: "abc",
            delta: "no",
            bestMove: { uci: "e2e4" },
            bestScore: [],
            clock: "1:00",
          },
        ],
      })
    )

    expect(migrated?.game.history[0]).toEqual({
      ...move,
      classification: "good",
      bestScore: null,
    })
    expect(migrated?.game.history[0]).not.toHaveProperty("bestMove")
    expect(migrated?.game.history[0]).not.toHaveProperty("clock")
  })

  it("replaces meta values that cannot be rendered as text and keeps the game", () => {
    const migrated = migratePersistedSession(
      sessionWithGame({
        ...gameAfterE4,
        meta: {
          white: {},
          black: 5,
          whiteElo: "x",
          blackElo: [],
          result: 7,
        },
      })
    )

    expect(migrated?.game.meta).toEqual({
      white: null,
      black: null,
      whiteElo: null,
      blackElo: null,
      result: null,
    })
    expect(migrated?.game.history).toEqual(gameAfterE4.history)
  })

  it("keeps player names, a numeric rating and a result", () => {
    const migrated = migratePersistedSession(
      sessionWithGame({
        ...gameAfterE4,
        meta: {
          white: "Kasparov, Garry",
          black: "Topalov, Veselin",
          whiteElo: "2830",
          blackElo: 2700,
          result: "1-0",
        },
      })
    )

    expect(migrated?.game.meta).toEqual({
      white: "Kasparov, Garry",
      black: "Topalov, Veselin",
      whiteElo: "2830",
      blackElo: "2700",
      result: "1-0",
    })
  })

  it.each([
    ["2.5", 2.5],
    ["-1", -1],
    ["null", null],
  ])(
    "moves currentMoveIndex %s to the last move",
    (_label, currentMoveIndex) => {
      const migrated = migratePersistedSession(
        sessionWithGame({ ...gameAfterE4, currentMoveIndex })
      )

      expect(migrated?.game.currentMoveIndex).toBe(gameAfterE4.history.length)
      expect(migrated?.game.history).toEqual(gameAfterE4.history)
    }
  )

  it.each([
    ["a string", "x"],
    ["null", null],
  ])("replaces engine %s and keeps the moves", (_label, engine) => {
    const migrated = migratePersistedSession(
      sessionWithGame(gameAfterE4, { engine })
    )

    expect(migrated?.engine).toEqual({ guessRevealed: false })
    expect(migrated?.game).toEqual(gameAfterE4)
  })

  it("replaces a numeric savedAt and keeps the moves", () => {
    const before = Date.now()
    const migrated = migratePersistedSession(
      sessionWithGame(gameAfterE4, { savedAt: 5 })
    )

    expect(migrated?.game).toEqual(gameAfterE4)
    expect(Date.parse(migrated?.savedAt ?? "")).toBeGreaterThanOrEqual(before)
  })

  it.each([
    ["initialFen is not a position", { ...gameAfterE4, initialFen: 5 }],
    ["history is not a list", { ...gameAfterE4, history: { san: "e4" } }],
    [
      "a move has no san",
      { ...gameAfterE4, history: [{ ...move, san: null }] },
    ],
    ["a move is null", { ...gameAfterE4, history: [null] }],
  ])("drops the game when %s", (_label, game) => {
    expect(migratePersistedSession(sessionWithGame(game))).toBeNull()
  })

  it.each([
    ["not a position", "x"],
    ["a different position", DEFAULT_POSITION],
  ])("rebuilds a move fen that is %s from the moves", (_label, fen) => {
    const migrated = migratePersistedSession(
      sessionWithGame({
        ...gameAfterE4,
        history: [{ ...move, fen }],
      })
    )

    expect(migrated?.game.history).toEqual(gameAfterE4.history)
    expect(migrated?.game.fen).toBe(fenAfterE4)
    expect(migrated?.game.currentMoveIndex).toBe(1)
  })

  it("rebuilds fen, turn and isGameOver from the move at the current index", () => {
    const fenAfterE5 =
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
    const migrated = migratePersistedSession(
      sessionWithGame({
        ...gameAfterE4,
        fen: 5,
        turn: "x",
        isGameOver: "yes",
        currentMoveIndex: 1,
        history: [
          move,
          {
            san: "e5",
            fen: "x",
            scoreBefore: null,
            scoreAfter: null,
            delta: null,
            classification: null,
          },
        ],
      })
    )

    expect(migrated?.game.history.map((entry) => entry.fen)).toEqual([
      fenAfterE4,
      fenAfterE5,
    ])
    expect(migrated?.game.fen).toBe(fenAfterE4)
    expect(migrated?.game.turn).toBe("b")
    expect(migrated?.game.isGameOver).toBe(false)
    expect(migrated?.game.currentMoveIndex).toBe(1)
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

  it("writes a repaired game back once and leaves the moves in place", () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(
        sessionWithGame({
          ...gameAfterE4,
          history: [{ ...gameAfterE4.history[0], classification: { a: 1 } }],
          meta: {
            white: {},
            black: 5,
            whiteElo: "x",
            blackElo: [],
            result: 7,
          },
          currentMoveIndex: 2.5,
        })
      )
    )

    const restored = readPersistedSession()

    expect(restored?.game.history[0]?.san).toBe("e4")
    expect(restored?.game.history[0]?.classification).toBeNull()
    expect(restored?.game.meta.white).toBeNull()
    expect(restored?.game.meta.result).toBeNull()
    expect(restored?.game.currentMoveIndex).toBe(1)

    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    const stored = JSON.parse(raw ?? "null") as {
      game: {
        history: { san: string; classification: unknown }[]
        meta: { white: unknown; result: unknown }
        currentMoveIndex: number
      }
    }
    expect(stored.game.history[0]?.classification).toBeNull()
    expect(stored.game.meta.white).toBeNull()
    expect(stored.game.currentMoveIndex).toBe(1)

    expect(readPersistedSession()?.game.history[0]?.san).toBe("e4")
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(raw)
  })

  it.each([
    ["engine is a string", { engine: "x" }],
    ["engine is null", { engine: null }],
    ["savedAt is a number", { savedAt: 5 }],
  ])("keeps the stored game when %s", (_label, patch) => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ ...sessionWithUi(initialUIState), ...patch })
    )

    const restored = readPersistedSession()
    expect(restored?.game.history[0]?.san).toBe("e4")
    expect(restored?.engine).toEqual({ guessRevealed: false })
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()

    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    expect(readPersistedSession()?.game.currentMoveIndex).toBe(1)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(raw)
  })

  it.each([
    ["history is not a list", { ...gameAfterE4, history: null }],
    ["initialFen is not a position", { ...gameAfterE4, initialFen: 5 }],
    [
      "a move cannot be replayed",
      { ...gameAfterE4, history: [{ ...gameAfterE4.history[0], san: 4 }] },
    ],
  ])("removes the key when %s", (_label, game) => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(sessionWithGame(game))
    )

    expect(readPersistedSession()).toBeNull()
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
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
