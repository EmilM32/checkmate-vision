import { describe, expect, it } from "vitest"

import { getPromotionCells, isPromotionMove } from "@/lib/chess/promotion"

describe("isPromotionMove", () => {
  const fen = "8/4P1k1/8/8/8/8/1p6/4K3 w - - 0 1"

  it("detects a legal pawn promotion", () => {
    expect(isPromotionMove(fen, "e7", "e8")).toBe(true)
  })

  it("rejects illegal or non-promotion moves", () => {
    expect(isPromotionMove(fen, "e7", "f8")).toBe(false)
    expect(isPromotionMove(fen, "e1", "e2")).toBe(false)
    // Black pawn cannot move while white is to move.
    expect(isPromotionMove(fen, "b2", "b1")).toBe(false)
  })
})

describe("getPromotionCells", () => {
  it("stacks downward from the top edge", () => {
    expect(getPromotionCells("e8", false)).toEqual([
      { piece: "q", x: 4, y: 0 },
      { piece: "r", x: 4, y: 1 },
      { piece: "b", x: 4, y: 2 },
      { piece: "n", x: 4, y: 3 },
    ])
  })

  it("stacks upward from the bottom edge", () => {
    expect(getPromotionCells("b1", false).map((cell) => cell.y)).toEqual([
      7, 6, 5, 4,
    ])
  })

  it("follows a flipped board", () => {
    expect(getPromotionCells("e8", true)[0]).toEqual({ piece: "q", x: 3, y: 7 })
    expect(getPromotionCells("e8", true)[3]?.y).toBe(4)
  })
})
