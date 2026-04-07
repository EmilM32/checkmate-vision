import { describe, expect, it } from "vitest"

import {
  buildMultiPvArrows,
  firstMoveArrowFromUci,
  squareCenterPixels,
  squareCenterUnits,
} from "@/lib/chess/board-coordinates"

describe("squareCenterUnits", () => {
  it("maps squares correctly for white orientation", () => {
    expect(squareCenterUnits("a1", false)).toEqual({ x: 0.5, y: 7.5 })
    expect(squareCenterUnits("h8", false)).toEqual({ x: 7.5, y: 0.5 })
    expect(squareCenterUnits("e4", false)).toEqual({ x: 4.5, y: 4.5 })
  })

  it("maps squares correctly for black orientation", () => {
    expect(squareCenterUnits("a1", true)).toEqual({ x: 7.5, y: 0.5 })
    expect(squareCenterUnits("h8", true)).toEqual({ x: 0.5, y: 7.5 })
    expect(squareCenterUnits("e4", true)).toEqual({ x: 3.5, y: 3.5 })
  })

  it("returns null for invalid square", () => {
    expect(squareCenterUnits("z9", false)).toBeNull()
  })
})

describe("squareCenterPixels", () => {
  it("converts to pixel coordinates", () => {
    expect(squareCenterPixels("a1", 800, false)).toEqual({ x: 50, y: 750 })
    expect(squareCenterPixels("h8", 800, false)).toEqual({ x: 750, y: 50 })
  })

  it("returns null for invalid board size", () => {
    expect(squareCenterPixels("e4", 0, false)).toBeNull()
  })
})

describe("firstMoveArrowFromUci", () => {
  it("parses regular uci move", () => {
    expect(firstMoveArrowFromUci("e2e4")).toEqual({
      from: "e2",
      to: "e4",
      uci: "e2e4",
    })
  })

  it("parses promotion uci move", () => {
    expect(firstMoveArrowFromUci("e7e8q")).toEqual({
      from: "e7",
      to: "e8",
      uci: "e7e8q",
    })
  })

  it("returns null for malformed uci", () => {
    expect(firstMoveArrowFromUci("bad")).toBeNull()
    expect(firstMoveArrowFromUci("e9e4")).toBeNull()
  })
})

describe("buildMultiPvArrows", () => {
  it("builds up to 3 arrows from pv lines", () => {
    const arrows = buildMultiPvArrows([
      { id: 1, pv: ["e2e4", "e7e5"] },
      { id: 2, pv: ["d2d4"] },
      { id: 3, pv: ["g1f3"] },
    ])

    expect(arrows).toEqual([
      { id: 1, from: "e2", to: "e4", uci: "e2e4" },
      { id: 2, from: "d2", to: "d4", uci: "d2d4" },
      { id: 3, from: "g1", to: "f3", uci: "g1f3" },
    ])
  })

  it("skips lines without a valid first move", () => {
    const arrows = buildMultiPvArrows([
      { id: 1, pv: [] },
      { id: 2, pv: ["bad"] },
      { id: 3, pv: ["c2c4"] },
    ])

    expect(arrows).toEqual([{ id: 3, from: "c2", to: "c4", uci: "c2c4" }])
  })

  it("limits to first three multipv lines", () => {
    const arrows = buildMultiPvArrows([
      { id: 1, pv: ["e2e4"] },
      { id: 2, pv: ["d2d4"] },
      { id: 3, pv: ["g1f3"] },
      { id: 1, pv: ["a2a4"] },
    ])

    expect(arrows).toHaveLength(3)
  })
})
