import { describe, expect, it } from "vitest"
import {
  evalToPercent,
  formatEval,
  getSideToMove,
  isWhiteBetter,
  toWhitePerspective,
} from "@/lib/engine/eval"

describe("toWhitePerspective", () => {
  it("keeps scores unchanged when white is to move", () => {
    expect(toWhitePerspective({ type: "cp", value: 35 }, "w")).toEqual({
      type: "cp",
      value: 35,
    })
  })

  it("flips cp scores when black is to move", () => {
    expect(toWhitePerspective({ type: "cp", value: -30 }, "b")).toEqual({
      type: "cp",
      value: 30,
    })
  })

  it("flips mate scores when black is to move", () => {
    expect(toWhitePerspective({ type: "mate", value: 3 }, "b")).toEqual({
      type: "mate",
      value: -3,
    })
  })

  it("keeps mate 0 and null untouched", () => {
    expect(toWhitePerspective({ type: "mate", value: 0 }, "b")).toEqual({
      type: "mate",
      value: 0,
    })
    expect(toWhitePerspective(null, "b")).toBeNull()
  })
})

describe("getSideToMove", () => {
  it("reads the side to move from FEN", () => {
    expect(
      getSideToMove(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
      )
    ).toBe("b")
    expect(getSideToMove("8/8/8/8/8/8/8/K6k w - - 0 1")).toBe("w")
  })
})

describe("isWhiteBetter", () => {
  it("uses the sign of white-perspective scores", () => {
    expect(isWhiteBetter({ type: "cp", value: 20 })).toBe(true)
    expect(isWhiteBetter({ type: "cp", value: -20 })).toBe(false)
    expect(isWhiteBetter({ type: "mate", value: -2 })).toBe(false)
  })

  it("resolves mate 0 from the side to move", () => {
    expect(isWhiteBetter({ type: "mate", value: 0 }, "b")).toBe(true)
    expect(isWhiteBetter({ type: "mate", value: 0 }, "w")).toBe(false)
  })
})

describe("evalToPercent", () => {
  it("returns 50 for null (no evaluation)", () => {
    expect(evalToPercent(null)).toBe(50)
  })

  it("returns 50 for cp 0 (equal position)", () => {
    expect(evalToPercent({ type: "cp", value: 0 })).toBe(50)
  })

  it("returns >50 for positive cp (white advantage)", () => {
    const pct = evalToPercent({ type: "cp", value: 100 })
    expect(pct).toBeGreaterThan(55)
    expect(pct).toBeLessThan(65)
  })

  it("returns <50 for negative cp (black advantage)", () => {
    const pct = evalToPercent({ type: "cp", value: -300 })
    expect(pct).toBeGreaterThan(15)
    expect(pct).toBeLessThan(30)
  })

  it("approaches 100 for large positive cp", () => {
    const pct = evalToPercent({ type: "cp", value: 1000 })
    expect(pct).toBeGreaterThan(96)
    expect(pct).toBeLessThan(100)
  })

  it("approaches 0 for large negative cp", () => {
    const pct = evalToPercent({ type: "cp", value: -1000 })
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(4)
  })

  it("returns 99 for positive mate", () => {
    expect(evalToPercent({ type: "mate", value: 3 })).toBe(99)
  })

  it("returns 1 for negative mate", () => {
    expect(evalToPercent({ type: "mate", value: -2 })).toBe(1)
  })

  it("resolves mate 0 against the side to move", () => {
    expect(evalToPercent({ type: "mate", value: 0 }, "b")).toBe(99)
    expect(evalToPercent({ type: "mate", value: 0 }, "w")).toBe(1)
  })

  it("is symmetric around 50 for opposite cp values", () => {
    const pos = evalToPercent({ type: "cp", value: 200 })
    const neg = evalToPercent({ type: "cp", value: -200 })
    expect(pos + neg).toBeCloseTo(100, 10)
  })
})

describe("formatEval", () => {
  it("returns '0.0' for null", () => {
    expect(formatEval(null)).toBe("0.0")
  })

  it("formats positive cp as absolute value with 1 decimal", () => {
    expect(formatEval({ type: "cp", value: 135 })).toBe("1.4")
  })

  it("formats negative cp as absolute value with 1 decimal", () => {
    expect(formatEval({ type: "cp", value: -50 })).toBe("0.5")
  })

  it("formats zero cp", () => {
    expect(formatEval({ type: "cp", value: 0 })).toBe("0.0")
  })

  it("formats positive mate", () => {
    expect(formatEval({ type: "mate", value: 3 })).toBe("M3")
  })

  it("formats a checkmated position", () => {
    expect(formatEval({ type: "mate", value: 0 })).toBe("#")
  })

  it("formats negative mate as absolute value", () => {
    expect(formatEval({ type: "mate", value: -1 })).toBe("M1")
  })
})
