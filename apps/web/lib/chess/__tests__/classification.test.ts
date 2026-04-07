import { describe, expect, it } from "vitest"
import { classifyMove, computeMoveDelta } from "@/lib/chess/classification"

describe("computeMoveDelta", () => {
  it("computes cp delta for white", () => {
    expect(
      computeMoveDelta(
        { type: "cp", value: 80 },
        { type: "cp", value: 10 },
        "white"
      )
    ).toBe(70)
  })

  it("computes cp delta for black with perspective", () => {
    expect(
      computeMoveDelta(
        { type: "cp", value: -120 },
        { type: "cp", value: -40 },
        "black"
      )
    ).toBe(80)
  })

  it("computes mate delta in ply space", () => {
    expect(
      computeMoveDelta(
        { type: "mate", value: 5 },
        { type: "mate", value: 2 },
        "white"
      )
    ).toBe(3)
  })
})

describe("classifyMove", () => {
  it("returns best for only legal move", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 0 },
      scoreAfter: { type: "cp", value: 0 },
      playedBy: "white",
      isOnlyLegalMove: true,
    })

    expect(result).toBe("best")
  })

  it("returns brilliant for sacrifice and near-best", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 120 },
      scoreAfter: { type: "cp", value: 100 },
      playedBy: "white",
      isMaterialSacrifice: true,
      isNearBest: true,
    })

    expect(result).toBe("brilliant")
  })

  it("returns great for tactical zero-loss move", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 60 },
      scoreAfter: { type: "cp", value: 60 },
      playedBy: "white",
      pvGapCp: 80,
    })

    expect(result).toBe("great")
  })

  it("returns best for 0-10 cp outside tactical great", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 40 },
      scoreAfter: { type: "cp", value: 35 },
      playedBy: "white",
      pvGapCp: 20,
    })

    expect(result).toBe("best")
  })

  it("returns good for small inaccuracy", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 200 },
      scoreAfter: { type: "cp", value: 170 },
      playedBy: "white",
    })

    expect(result).toBe("good")
  })

  it("returns mistake for medium loss", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 260 },
      scoreAfter: { type: "cp", value: 100 },
      playedBy: "white",
    })

    expect(result).toBe("mistake")
  })

  it("returns blunder for large loss", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 350 },
      scoreAfter: { type: "cp", value: 40 },
      playedBy: "white",
    })

    expect(result).toBe("blunder")
  })

  it("handles mate edge case", () => {
    const result = classifyMove({
      scoreBefore: { type: "mate", value: 5 },
      scoreAfter: { type: "mate", value: 1 },
      playedBy: "white",
    })

    expect(result).toBe("blunder")
  })
})
