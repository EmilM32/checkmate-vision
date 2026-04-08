import { describe, expect, it } from "vitest"

import { buildHeatmap, buildSquareInfluence } from "@/lib/chess/heatmap"

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

  it("returns piece-level contributors for a selected square", () => {
    const influence = buildSquareInfluence(
      "k7/6n1/8/8/3N1N2/8/8/7K w - - 0 1",
      "e6"
    )

    expect(influence).toMatchObject({
      square: "e6",
      whiteControl: 2,
      blackControl: 1,
      balance: 1,
    })

    expect(influence?.whiteContributors).toEqual([
      { fromSquare: "d4", pieceType: "n", color: "white" },
      { fromSquare: "f4", pieceType: "n", color: "white" },
    ])
    expect(influence?.blackContributors).toEqual([
      { fromSquare: "g7", pieceType: "n", color: "black" },
    ])
  })

  it("handles blocked sliders while tracing influence", () => {
    const influence = buildSquareInfluence(
      "k7/8/8/8/8/8/4P3/4R2K w - - 0 1",
      "e8"
    )

    expect(influence).toMatchObject({
      square: "e8",
      whiteControl: 0,
      blackControl: 0,
      balance: 0,
    })
    expect(influence?.whiteContributors).toEqual([])
  })

  it("returns null for invalid square or invalid FEN", () => {
    expect(buildSquareInfluence("not-a-fen", "e4")).toBeNull()
    expect(buildSquareInfluence("k7/8/8/8/8/8/8/7K w - - 0 1", "z9")).toBeNull()
  })
})
