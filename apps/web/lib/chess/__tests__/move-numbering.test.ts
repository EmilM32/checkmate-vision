import { describe, expect, it } from "vitest"
import { DEFAULT_POSITION } from "chess.js"

import {
  formatPlyLabel,
  getMoveNumbering,
  getPlyColor,
  getPlyMoveNumber,
} from "@/lib/chess/move-numbering"

describe("move numbering", () => {
  it("numbers a game from the standard start position", () => {
    const numbering = getMoveNumbering(DEFAULT_POSITION)

    expect(numbering).toEqual({ firstMoveNumber: 1, blackMovesFirst: false })
    expect([1, 2, 3].map((ply) => getPlyMoveNumber(ply, numbering))).toEqual([
      1, 1, 2,
    ])
    expect(getPlyColor(2, numbering)).toBe("black")
    expect(formatPlyLabel(3, numbering)).toBe("2.")
  })

  it("numbers a game set up with black to move", () => {
    const numbering = getMoveNumbering("4k3/8/8/8/8/8/4P3/4K3 b - - 0 40")

    expect(numbering).toEqual({ firstMoveNumber: 40, blackMovesFirst: true })
    expect(getPlyColor(1, numbering)).toBe("black")
    expect(formatPlyLabel(1, numbering)).toBe("40...")
    expect(formatPlyLabel(2, numbering)).toBe("41.")
    expect(getPlyMoveNumber(3, numbering)).toBe(41)
  })

  it("falls back to move 1 for malformed full-move counters", () => {
    expect(getMoveNumbering("8/8/8/8/8/8/8/K6k w - - 0 x")).toEqual({
      firstMoveNumber: 1,
      blackMovesFirst: false,
    })
  })
})
