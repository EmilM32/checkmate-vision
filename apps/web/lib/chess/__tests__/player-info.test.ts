import { describe, expect, it } from "vitest"
import { DEFAULT_POSITION } from "chess.js"

import type { MoveEntry } from "@/context/game-context"
import {
  formatClock,
  getClockAt,
  getMaterialSummary,
} from "@/lib/chess/player-info"

function move(san: string, clock: number | null): MoveEntry {
  return {
    san,
    fen: "",
    scoreBefore: null,
    scoreAfter: null,
    delta: null,
    classification: null,
    clock,
  }
}

describe("getMaterialSummary", () => {
  it("reports nothing captured at the start", () => {
    expect(getMaterialSummary(DEFAULT_POSITION)).toEqual({
      white: { captured: [], advantage: 0 },
      black: { captured: [], advantage: 0 },
    })
  })

  it("lists captured pieces and the material lead", () => {
    // White has captured a knight and a pawn, Black a pawn.
    const summary = getMaterialSummary(
      "r1bqkbnr/ppp2ppp/8/4p3/4P3/8/PPP2PPP/RNBQKBNR w KQkq - 0 5"
    )

    expect(summary.white).toEqual({ captured: ["n", "p"], advantage: 3 })
    expect(summary.black).toEqual({ captured: ["p"], advantage: 0 })
  })

  it("does not count promoted pieces as captures", () => {
    const summary = getMaterialSummary("4k3/8/8/8/8/8/8/QQ2K3 w - - 0 1")

    // Two white queens: the extra one is a promotion, not a missing piece.
    expect(summary.black.captured).not.toContain("q")
    expect(summary.black.captured).toEqual([
      "r",
      "r",
      "b",
      "b",
      "n",
      "n",
      ...Array(8).fill("p"),
    ])
    expect(summary.white.advantage).toBe(18)
  })
})

describe("getClockAt", () => {
  const history = [
    move("e4", 180),
    move("e5", 179),
    move("Nf3", 175),
    move("Nc6", null),
  ]

  it("returns the clock of the side's latest move", () => {
    expect(getClockAt(history, 3, DEFAULT_POSITION, "white")).toBe(175)
    expect(getClockAt(history, 3, DEFAULT_POSITION, "black")).toBe(179)
    expect(getClockAt(history, 2, DEFAULT_POSITION, "white")).toBe(180)
  })

  it("returns null before the side has moved or without a clock", () => {
    expect(getClockAt(history, 0, DEFAULT_POSITION, "white")).toBeNull()
    expect(getClockAt(history, 1, DEFAULT_POSITION, "black")).toBeNull()
    expect(getClockAt(history, 4, DEFAULT_POSITION, "black")).toBeNull()
  })

  it("uses the side to move of a set-up position", () => {
    const blackFirst = "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"
    expect(getClockAt(history, 1, blackFirst, "black")).toBe(180)
    expect(getClockAt(history, 1, blackFirst, "white")).toBeNull()
  })
})

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(65.7)).toBe("1:05")
    expect(formatClock(3723)).toBe("1:02:03")
    expect(formatClock(-3)).toBe("0:00")
  })
})
