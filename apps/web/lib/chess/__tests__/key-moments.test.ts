import { describe, expect, it } from "vitest"

import type { MoveEntry } from "@/context/game-context"
import type { MoveClassification } from "@/lib/chess/classification"
import { ERROR_CLASSES, findKeyMove } from "@/lib/chess/key-moments"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

const numbering = getMoveNumbering(
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
)

function game(classes: (MoveClassification | null)[]): MoveEntry[] {
  return classes.map((classification, i) => ({
    san: `m${i + 1}`,
    fen: "",
    scoreBefore: null,
    scoreAfter: null,
    delta: null,
    classification,
  }))
}

// Plies:           1       2          3       4         5
const history = game(["best", "mistake", "good", "blunder", "inaccuracy"])

describe("findKeyMove", () => {
  it("finds the next error after the current ply", () => {
    expect(
      findKeyMove(history, numbering, 0, 1, { classes: ERROR_CLASSES })
    ).toBe(2)
    expect(
      findKeyMove(history, numbering, 2, 1, { classes: ERROR_CLASSES })
    ).toBe(4)
  })

  it("goes backwards and wraps around the game", () => {
    expect(
      findKeyMove(history, numbering, 2, -1, { classes: ERROR_CLASSES })
    ).toBe(5)
    expect(
      findKeyMove(history, numbering, 5, 1, { classes: ERROR_CLASSES })
    ).toBe(2)
  })

  it("filters by side and class", () => {
    // White plays the odd plies.
    expect(
      findKeyMove(history, numbering, 0, 1, {
        classes: ["inaccuracy"],
        side: "white",
      })
    ).toBe(5)
    expect(
      findKeyMove(history, numbering, 0, 1, {
        classes: ["blunder"],
        side: "white",
      })
    ).toBeNull()
  })
})
