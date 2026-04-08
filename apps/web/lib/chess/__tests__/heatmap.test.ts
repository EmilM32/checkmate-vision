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

  it("computes signed control balance and intensity", () => {
    const cells = buildHeatmap("k7/8/8/4n3/3N4/8/8/7K w - - 0 1")

    const bySquare = new Map(cells.map((cell) => [cell.square, cell]))

    expect(bySquare.get("b5")).toMatchObject({ side: "white", intensity: 0.25 })
    expect(bySquare.get("d3")).toMatchObject({ side: "black", intensity: 0.25 })
    expect(bySquare.get("c6")).toMatchObject({ side: "neutral", intensity: 0 })
  })
})
