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

  it("softens early opening swings near equality", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 20 },
      scoreAfter: { type: "cp", value: -40 },
      playedBy: "white",
      plyIndex: 1,
    })

    expect(result).toBe("good")
  })

  it("softens early opening swings near equality for black", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: -10 },
      scoreAfter: { type: "cp", value: 60 },
      playedBy: "black",
      plyIndex: 2,
    })

    expect(result).toBe("good")
  })

  it("keeps larger opening losses as mistakes", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 30 },
      scoreAfter: { type: "cp", value: -130 },
      playedBy: "white",
      plyIndex: 1,
    })

    expect(result).toBe("mistake")
  })

  it("does not apply opening leniency later in the game", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 20 },
      scoreAfter: { type: "cp", value: -40 },
      playedBy: "white",
      plyIndex: 10,
    })

    expect(result).toBe("mistake")
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

  it("treats a faster forced mate as best", () => {
    const result = classifyMove({
      scoreBefore: { type: "mate", value: 5 },
      scoreAfter: { type: "mate", value: 1 },
      playedBy: "white",
    })

    expect(result).toBe("best")
  })

  it("treats a slower but still forced mate as best", () => {
    const result = classifyMove({
      scoreBefore: { type: "mate", value: -2 },
      scoreAfter: { type: "mate", value: -4 },
      playedBy: "black",
    })

    expect(result).toBe("best")
  })

  it("does not punish finding a forced mate", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 300 },
      scoreAfter: { type: "mate", value: 3 },
      playedBy: "white",
    })

    expect(result).toBe("best")
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
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 40 },
      scoreAfter: { type: "mate", value: -2 },
      playedBy: "white",
    })

    expect(result).toBe("blunder")
  })

  it("flags a black move that hands white a winning score as a blunder", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: -20 },
      scoreAfter: { type: "cp", value: 600 },
      playedBy: "black",
    })

    expect(result).toBe("blunder")
  })

  it("rates a black move that keeps white's score unchanged as best", () => {
    const result = classifyMove({
      scoreBefore: { type: "cp", value: 30 },
      scoreAfter: { type: "cp", value: 30 },
      playedBy: "black",
      pvGapCp: 10,
    })

    expect(result).toBe("best")
  })
})
