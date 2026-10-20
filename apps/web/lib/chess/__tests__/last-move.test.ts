import { describe, expect, it } from "vitest"

import type { MoveEntry } from "@/context/game-context"
import { getLastMove } from "@/lib/chess/last-move"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

function entry(san: string, fen: string): MoveEntry {
  return {
    san,
    fen,
    scoreBefore: null,
    scoreAfter: null,
    delta: null,
    classification: null,
  }
}

const history = [
  entry("e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"),
  entry("Nf6", "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2"),
]

describe("getLastMove", () => {
  it("returns the squares of the move that reached the position", () => {
    expect(getLastMove(history, 1, START)).toEqual({ from: "e2", to: "e4" })
    expect(getLastMove(history, 2, START)).toEqual({ from: "g8", to: "f6" })
  })

  it("is empty at the start of the game", () => {
    expect(getLastMove(history, 0, START)).toBeNull()
  })

  it("handles castling", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"
    const castled = [entry("O-O", "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1")]
    expect(getLastMove(castled, 1, fen)).toEqual({ from: "e1", to: "g1" })
  })
})
