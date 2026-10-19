import { describe, expect, it } from "vitest"
import {
  classifyMove,
  computeMoveDelta,
  getWinChance,
} from "@/lib/chess/classification"

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

describe("getWinChance", () => {
  it("is even at 0 and symmetric for both sides", () => {
    expect(getWinChance({ type: "cp", value: 0 }, "white")).toBe(50)
    expect(getWinChance({ type: "cp", value: 150 }, "white")).toBeCloseTo(
      100 - getWinChance({ type: "cp", value: 150 }, "black")
    )
  })

  it("saturates for decided positions and mates", () => {
    expect(getWinChance({ type: "cp", value: 900 }, "white")).toBeGreaterThan(
      95
    )
    expect(getWinChance({ type: "mate", value: 3 }, "white")).toBe(100)
    expect(getWinChance({ type: "mate", value: 3 }, "black")).toBe(0)
    // Checkmate delivered by the mover.
    expect(getWinChance({ type: "mate", value: 0 }, "black")).toBe(100)
  })
})

describe("classifyMove", () => {
  const cp = (value: number) => ({ type: "cp" as const, value })

  it("returns best for only legal move", () => {
    expect(
      classifyMove({
        scoreBefore: cp(300),
        scoreAfter: cp(-300),
        playedBy: "white",
        isOnlyLegalMove: true,
      })
    ).toBe("best")
  })

  it.each([
    [40, 35, "best"],
    [200, 170, "good"],
    [20, -40, "inaccuracy"],
    [260, 100, "mistake"],
    [350, 40, "blunder"],
  ] as const)("rates %i -> %i cp as %s", (before, after, expected) => {
    expect(
      classifyMove({
        scoreBefore: cp(before),
        scoreAfter: cp(after),
        playedBy: "white",
      })
    ).toBe(expected)
  })

  it("weighs the same loss less once the position is decided", () => {
    expect(
      classifyMove({
        scoreBefore: cp(0),
        scoreAfter: cp(-150),
        playedBy: "white",
      })
    ).toBe("mistake")
    expect(
      classifyMove({
        scoreBefore: cp(900),
        scoreAfter: cp(750),
        playedBy: "white",
      })
    ).toBe("good")
  })

  it("returns great when the second-best move would have given up the win", () => {
    expect(
      classifyMove({
        scoreBefore: cp(250),
        scoreAfter: cp(250),
        playedBy: "white",
        secondBestScore: cp(50),
      })
    ).toBe("great")
  })

  it("returns best when the alternatives were about as good", () => {
    expect(
      classifyMove({
        scoreBefore: cp(60),
        scoreAfter: cp(60),
        playedBy: "white",
        secondBestScore: cp(20),
      })
    ).toBe("best")
  })

  it("returns brilliant for a sound sacrifice", () => {
    expect(
      classifyMove({
        scoreBefore: cp(120),
        scoreAfter: cp(110),
        playedBy: "white",
        sacrificedMaterial: 3,
      })
    ).toBe("brilliant")
  })

  it("calls a sacrifice that forces mate brilliant", () => {
    expect(
      classifyMove({
        scoreBefore: { type: "mate", value: 2 },
        scoreAfter: { type: "mate", value: 1 },
        playedBy: "white",
        sacrificedMaterial: 9,
      })
    ).toBe("brilliant")
  })

  it("does not call a move great when the alternative wins too", () => {
    // +8 versus +4: a big gap, but both are winning.
    expect(
      classifyMove({
        scoreBefore: cp(800),
        scoreAfter: cp(800),
        playedBy: "white",
        secondBestScore: cp(400),
      })
    ).toBe("best")
  })

  it("calls the only move that holds a lost position great", () => {
    expect(
      classifyMove({
        scoreBefore: cp(150),
        scoreAfter: cp(150),
        playedBy: "black",
        secondBestScore: cp(400),
      })
    ).toBe("great")
  })

  it("does not call a sacrifice brilliant when it leaves the mover worse", () => {
    expect(
      classifyMove({
        scoreBefore: cp(200),
        scoreAfter: cp(200),
        playedBy: "black",
        sacrificedMaterial: 3,
      })
    ).toBe("best")
  })

  it("does not call a sacrifice brilliant when it loses", () => {
    expect(
      classifyMove({
        scoreBefore: cp(50),
        scoreAfter: cp(-250),
        playedBy: "white",
        sacrificedMaterial: 3,
      })
    ).toBe("blunder")
  })

  it("treats a faster forced mate as best", () => {
    expect(
      classifyMove({
        scoreBefore: { type: "mate", value: 5 },
        scoreAfter: { type: "mate", value: 1 },
        playedBy: "white",
      })
    ).toBe("best")
  })

  it("treats a slower but still forced mate as best", () => {
    expect(
      classifyMove({
        scoreBefore: { type: "mate", value: -2 },
        scoreAfter: { type: "mate", value: -4 },
        playedBy: "black",
      })
    ).toBe("best")
  })

  it("does not punish finding a forced mate", () => {
    expect(
      classifyMove({
        scoreBefore: cp(300),
        scoreAfter: { type: "mate", value: 3 },
        playedBy: "white",
      })
    ).toBe("best")
  })

  it("treats delivering checkmate (mate 0 after the move) as best", () => {
    expect(
      classifyMove({
        scoreBefore: { type: "mate", value: -1 },
        scoreAfter: { type: "mate", value: 0 },
        playedBy: "black",
      })
    ).toBe("best")
  })

  it("flags allowing a forced mate as a blunder", () => {
    expect(
      classifyMove({
        scoreBefore: cp(40),
        scoreAfter: { type: "mate", value: -2 },
        playedBy: "white",
      })
    ).toBe("blunder")
  })

  it("flags a black move that hands white a winning score as a blunder", () => {
    expect(
      classifyMove({
        scoreBefore: cp(-20),
        scoreAfter: cp(600),
        playedBy: "black",
      })
    ).toBe("blunder")
  })

  it("rates a black move that keeps white's score unchanged as best", () => {
    expect(
      classifyMove({
        scoreBefore: cp(30),
        scoreAfter: cp(30),
        playedBy: "black",
      })
    ).toBe("best")
  })
})
