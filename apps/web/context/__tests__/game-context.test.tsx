import React from "react"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  GameProvider,
  initialGameState,
  useGameContext,
  type GameState,
  type MoveAnalysisPatch,
} from "@/context/game-context"
import { parsePgn } from "@/lib/chess/fen-pgn"

type GameApi = ReturnType<typeof useGameContext>

function renderGameHarness() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  )

  const { result } = renderHook(() => useGameContext(), { wrapper })

  return {
    getApi() {
      return result.current as GameApi
    },
  }
}

function movePatch(
  scoreBefore = { type: "cp", value: 20 } as const,
  scoreAfter = { type: "cp", value: 55 } as const,
  delta = 35
): MoveAnalysisPatch {
  return {
    scoreBefore,
    scoreAfter,
    delta,
    classification: "good",
  }
}

function playMoves(harness: ReturnType<typeof renderGameHarness>) {
  act(() => {
    harness.getApi().makeMove("e2", "e4")
  })
  act(() => {
    harness.getApi().makeMove("e7", "e5")
  })
}

describe("GameContext", () => {
  it("makeMove appends history and updates index", () => {
    const harness = renderGameHarness()

    let result = false
    act(() => {
      result = harness.getApi().makeMove("e2", "e4")
    })

    const state = harness.getApi().state
    expect(result).toBe(true)
    expect(state.history).toHaveLength(1)
    expect(state.currentMoveIndex).toBe(1)
    expect(state.history[0]?.san).toBe("e4")
  })

  it("makeMove returns false for illegal moves", () => {
    const harness = renderGameHarness()

    let result = true
    act(() => {
      result = harness.getApi().makeMove("e2", "e5")
    })

    expect(result).toBe(false)
    expect(harness.getApi().state).toEqual(initialGameState)
  })

  it("goToMove clamps index boundaries", () => {
    const harness = renderGameHarness()

    playMoves(harness)

    act(() => {
      harness.getApi().goToMove(-5)
    })
    expect(harness.getApi().state.currentMoveIndex).toBe(0)

    act(() => {
      harness.getApi().goToMove(999)
    })
    expect(harness.getApi().state.currentMoveIndex).toBe(2)
  })

  it("keeps the game and starts a variation for a different move mid-game", () => {
    const harness = renderGameHarness()

    playMoves(harness)
    act(() => {
      harness.getApi().makeMove("g1", "f3")
    })
    act(() => {
      harness.getApi().goToMove(1)
    })
    act(() => {
      harness.getApi().makeMove("d7", "d5")
    })

    const state = harness.getApi().state
    // The game itself is untouched.
    expect(state.history.map((move) => move.san)).toEqual(["e4", "e5", "Nf3"])
    expect(state.variation?.branchIndex).toBe(1)
    expect(state.variation?.moves.map((move) => move.san)).toEqual(["d5"])
    expect(state.variationIndex).toBe(1)
    expect(state.currentMoveIndex).toBe(1)
    expect(state.fen).toBe(
      "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
    )
  })

  it("steps forward instead of branching when the game's move is played", () => {
    const harness = renderGameHarness()

    playMoves(harness)
    act(() => {
      harness.getApi().goToMove(1)
    })
    act(() => {
      harness.getApi().makeMove("e7", "e5")
    })

    const state = harness.getApi().state
    expect(state.variation).toBeNull()
    expect(state.currentMoveIndex).toBe(2)
    expect(state.history).toHaveLength(2)
  })

  it("walks a variation and returns to the game from its first move", () => {
    const harness = renderGameHarness()

    playMoves(harness)
    act(() => {
      harness.getApi().goToMove(1)
    })
    act(() => {
      harness.getApi().makeMove("c7", "c5")
    })
    act(() => {
      harness.getApi().makeMove("g1", "f3")
    })
    expect(harness.getApi().state.variationIndex).toBe(2)

    act(() => {
      harness.getApi().stepBack()
    })
    expect(harness.getApi().state.variationIndex).toBe(1)

    act(() => {
      harness.getApi().stepBack()
    })
    const state = harness.getApi().state
    // Back on the main line at the branch point; the variation stays listed.
    expect(state.variationIndex).toBeNull()
    expect(state.currentMoveIndex).toBe(1)
    expect(state.variation?.moves).toHaveLength(2)

    act(() => {
      harness.getApi().goToVariationMove(2)
    })
    act(() => {
      harness.getApi().goToEnd()
    })
    expect(harness.getApi().state.variationIndex).toBe(2)
  })

  it("replaces later variation moves when playing from inside it", () => {
    const harness = renderGameHarness()

    playMoves(harness)
    act(() => {
      harness.getApi().goToMove(1)
    })
    act(() => {
      harness.getApi().makeMove("c7", "c5")
    })
    act(() => {
      harness.getApi().makeMove("g1", "f3")
    })
    act(() => {
      harness.getApi().goToVariationMove(1)
    })
    act(() => {
      harness.getApi().makeMove("b1", "c3")
    })

    expect(
      harness.getApi().state.variation?.moves.map((move) => move.san)
    ).toEqual(["c5", "Nc3"])
  })

  it("deletes the variation and returns to its branch point", () => {
    const harness = renderGameHarness()

    playMoves(harness)
    act(() => {
      harness.getApi().goToMove(1)
    })
    act(() => {
      harness.getApi().makeMove("c7", "c5")
    })
    act(() => {
      harness.getApi().deleteVariation()
    })

    const state = harness.getApi().state
    expect(state.variation).toBeNull()
    expect(state.variationIndex).toBeNull()
    expect(state.currentMoveIndex).toBe(1)
    expect(state.history).toHaveLength(2)
  })

  it("annotateMove updates only valid move indexes", () => {
    const harness = renderGameHarness()

    act(() => {
      harness.getApi().makeMove("e2", "e4")
    })

    act(() => {
      harness.getApi().annotateMove(0, movePatch())
    })
    expect(harness.getApi().state.history[0]?.classification).toBeNull()

    act(() => {
      harness.getApi().annotateMove(1, movePatch())
    })

    const updated = harness.getApi().state.history[0]
    expect(updated?.classification).toBe("good")
    expect(updated?.delta).toBe(35)
  })

  it("keeps every annotation issued before a re-render", () => {
    const harness = renderGameHarness()
    playMoves(harness)

    // The engine can report two results before React re-renders; both calls
    // then come from the same (stale) API object.
    const api = harness.getApi()
    act(() => {
      api.annotateMove(1, movePatch())
      api.annotateMove(2, { ...movePatch(), classification: "blunder" })
    })

    const { history } = harness.getApi().state
    expect(history[0]?.classification).toBe("good")
    expect(history[1]?.classification).toBe("blunder")
  })

  it("ignores annotations for a position no longer at that index", () => {
    const harness = renderGameHarness()
    playMoves(harness)

    act(() => {
      harness.getApi().annotateMove(1, movePatch(), "not-the-fen-of-e4")
    })

    expect(harness.getApi().state.history[0]?.classification).toBeNull()
  })

  it("setPositionFromFen replaces position and clears move history", () => {
    const harness = renderGameHarness()
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"

    act(() => {
      harness.getApi().makeMove("e2", "e4")
    })

    let result = false
    act(() => {
      result = harness.getApi().setPositionFromFen(fen)
    })

    const state = harness.getApi().state
    expect(result).toBe(true)
    expect(state.fen).toBe(fen)
    expect(state.initialFen).toBe(fen)
    expect(state.history).toHaveLength(0)
    expect(state.currentMoveIndex).toBe(0)
  })

  it("setPositionFromFen rejects invalid fen", () => {
    const harness = renderGameHarness()

    let result = true
    act(() => {
      result = harness.getApi().setPositionFromFen("invalid-fen")
    })

    expect(result).toBe(false)
    expect(harness.getApi().state).toEqual(initialGameState)
  })

  it("loadPgnGame loads game and points current move to the end", () => {
    const harness = renderGameHarness()
    const parsed = parsePgn("1. e4 e5 2. Nf3 Nc6")

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      throw new Error("PGN parsing failed in test fixture")
    }

    let result = false
    act(() => {
      result = harness.getApi().loadPgnGame(parsed.data)
    })

    const state = harness.getApi().state
    expect(result).toBe(true)
    expect(state.history).toHaveLength(4)
    expect(state.currentMoveIndex).toBe(4)
    expect(state.fen).toBe(state.history[3]?.fen)
  })

  it("undo rewinds one move and newGame resets state", () => {
    const harness = renderGameHarness()

    playMoves(harness)
    act(() => {
      harness.getApi().undo()
    })

    expect(harness.getApi().state.currentMoveIndex).toBe(1)

    act(() => {
      harness.getApi().newGame()
    })

    expect(harness.getApi().state).toEqual(initialGameState)
  })

  it("restoreState clamps index and reconstructs board position", () => {
    const harness = renderGameHarness()

    const snapshot: GameState = {
      ...initialGameState,
      initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      history: [
        {
          san: "e4",
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          scoreBefore: null,
          scoreAfter: null,
          delta: null,
          classification: null,
        },
        {
          san: "e5",
          fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
          scoreBefore: null,
          scoreAfter: null,
          delta: null,
          classification: null,
        },
      ],
      currentMoveIndex: 99,
      fen: "",
      pgn: "",
      turn: "w",
      isGameOver: false,
    }

    let result = false
    act(() => {
      result = harness.getApi().restoreState(snapshot)
    })

    const state = harness.getApi().state
    expect(result).toBe(true)
    expect(state.currentMoveIndex).toBe(2)
    expect(state.history).toHaveLength(2)
    expect(state.fen).toBe(snapshot.history[1]?.fen)
  })
})
