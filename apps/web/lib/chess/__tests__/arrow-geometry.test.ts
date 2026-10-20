import { describe, expect, it } from "vitest"

import { buildArrowPath, getArrowRoute } from "@/lib/chess/arrow-geometry"

const SHAPE = {
  shaftWidth: 0.2,
  headWidth: 0.5,
  headLength: 0.4,
  tailOffset: 0.2,
}

function points(path: string) {
  return path
    .replace(/[MZ]/g, "")
    .split("L")
    .map((pair) => pair.trim().split(" ").map(Number) as [number, number])
}

describe("getArrowRoute", () => {
  it("is straight for sliding and pawn moves", () => {
    const from = { x: 4.5, y: 6.5 }
    const to = { x: 4.5, y: 4.5 }
    expect(getArrowRoute(from, to)).toEqual([from, to])
  })

  it("bends a knight's jump along its longer leg first", () => {
    // g1-f3 on an unflipped board.
    expect(getArrowRoute({ x: 6.5, y: 7.5 }, { x: 5.5, y: 5.5 })).toEqual([
      { x: 6.5, y: 7.5 },
      { x: 6.5, y: 5.5 },
      { x: 5.5, y: 5.5 },
    ])
  })
})

describe("buildArrowPath", () => {
  it("outlines shaft and head as one closed shape ending at the target", () => {
    // e2-e4: straight up.
    const outline = points(
      buildArrowPath({ x: 4.5, y: 6.5 }, { x: 4.5, y: 4.5 }, SHAPE)
    )
    expect(outline).toHaveLength(7)
    // The tip sits on the target square's centre.
    expect(outline[3]).toEqual([4.5, 4.5])
    // Head base 0.4 before the tip, 0.5 wide.
    expect(outline[2]).toEqual([4.25, 4.9])
    expect(outline[4]).toEqual([4.75, 4.9])
    // The tail starts 0.2 away from the source centre, 0.2 wide.
    expect(outline[0]).toEqual([4.4, 6.3])
    expect(outline[6]).toEqual([4.6, 6.3])
  })

  it("mitres the corner of a knight's arrow", () => {
    const outline = points(
      buildArrowPath({ x: 6.5, y: 7.5 }, { x: 5.5, y: 5.5 }, SHAPE)
    )
    // Tail, corner and head base on each side, plus the head's three points.
    expect(outline).toHaveLength(9)
    expect(outline[4]).toEqual([5.5, 5.5])
  })
})
