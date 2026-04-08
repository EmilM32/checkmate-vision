import { describe, expect, it } from "vitest"

import { buildHeatmap } from "@/lib/chess/heatmap"

describe("buildHeatmap", () => {
  it("returns exactly 64 squares", () => {
    const cells = buildHeatmap("k7/8/8/4n3/3N4/8/8/7K w - - 0 1")

    expect(cells).toHaveLength(64)
  })

  it("falls back to a neutral board for invalid FEN", () => {
    const cells = buildHeatmap("not-a-fen")

    expect(cells).toHaveLength(64)
    expect(cells.every((cell) => cell.side === "neutral")).toBe(true)
    expect(cells.every((cell) => cell.intensity === 0)).toBe(true)
  })

  it("computes signed control balance and raw attack counts", () => {
    const cells = buildHeatmap("k7/8/8/4n3/3N4/8/8/7K w - - 0 1")

    const bySquare = new Map(cells.map((cell) => [cell.square, cell]))

    expect(bySquare.get("b5")).toMatchObject({
      side: "white",
      intensity: 0.25,
      whiteControl: 1,
      blackControl: 0,
      balance: 1,
    })
    expect(bySquare.get("d3")).toMatchObject({
      side: "black",
      intensity: 0.25,
      whiteControl: 0,
      blackControl: 1,
      balance: -1,
    })
    expect(bySquare.get("c6")).toMatchObject({
      side: "neutral",
      intensity: 0,
      whiteControl: 1,
      blackControl: 1,
      balance: 0,
    })
  })

  it("tracks contested squares with multiple attackers", () => {
    const cells = buildHeatmap("k7/6n1/8/8/3N1N2/8/8/7K w - - 0 1")

    const bySquare = new Map(cells.map((cell) => [cell.square, cell]))

    expect(bySquare.get("e6")).toMatchObject({
      side: "white",
      whiteControl: 2,
      blackControl: 1,
      balance: 1,
    })
  })
})
