import { describe, expect, it } from "vitest"
import {
  parseClockComment,
  parsePgn,
  validateFen,
  validatePgn,
} from "@/lib/chess/fen-pgn"

describe("fen-pgn helpers", () => {
  it("accepts valid FEN", () => {
    const result = validateFen(
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 2 4"
    )

    expect(result.ok).toBe(true)
  })

  it("rejects invalid FEN", () => {
    const result = validateFen("not a fen")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("errors.fenInvalid")
    }
  })

  it("accepts valid PGN with moves", () => {
    const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"
    const result = validatePgn(pgn)

    expect(result.ok).toBe(true)
  })

  it("rejects invalid PGN", () => {
    const result = validatePgn("1. e4 ???")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("errors.pgnInvalid")
    }
  })

  it("parses valid PGN into move list with FEN snapshots", () => {
    const result = parsePgn("1. d4 d5 2. c4 e6")

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.moves).toHaveLength(4)
      expect(result.data.moves[0]?.san).toBe("d4")
      expect(result.data.moves[3]?.fen).toContain(" w ")
      expect(result.data.finalFen).toContain(" w ")
    }
  })

  it("starts from the FEN header of a set-up game", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"
    const result = parsePgn(
      `[SetUp "1"]\n[FEN "${fen}"]\n\n40... Kd7 41. e4 Ke6 *`
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.initialFen).toBe(fen)
      expect(result.data.moves.map((move) => move.san)).toEqual([
        "Kd7",
        "e4",
        "Ke6",
      ])
      expect(result.data.moves[0]?.fen).toBe("8/3k4/8/8/8/8/4P3/4K3 w - - 1 41")
    }
  })

  it("reads player headers and ignores unknown values", () => {
    const result = parsePgn(
      [
        '[White "Carlsen, Magnus"]',
        '[Black "?"]',
        '[WhiteElo "2830"]',
        '[BlackElo "-"]',
        '[Result "1-0"]',
        "",
        "1. e4 e5 1-0",
      ].join("\n")
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.meta).toEqual({
        white: "Carlsen, Magnus",
        black: null,
        whiteElo: "2830",
        blackElo: null,
        result: "1-0",
      })
    }
  })

  it("treats an unfinished game result as unknown", () => {
    const result = parsePgn('[Result "*"]\n\n1. e4 *')

    expect(result.ok && result.data.meta.result).toBeNull()
  })

  it("reads clock comments per move", () => {
    const result = parsePgn(
      "1. e4 { [%clk 0:03:00] } e5 { [%clk 0:02:58.5] } 2. Nf3 Nc6 { [%clk 0:02:50] }"
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.moves.map((move) => move.clock)).toEqual([
        180,
        178.5,
        null,
        170,
      ])
    }
  })
})

describe("parseClockComment", () => {
  it("parses h:mm:ss clock annotations", () => {
    expect(parseClockComment("[%clk 1:02:03]")).toBe(3723)
    expect(parseClockComment("good move [%clk 0:00:09.4] !")).toBeCloseTo(9.4)
  })

  it("returns null without a clock annotation", () => {
    expect(parseClockComment(undefined)).toBeNull()
    expect(parseClockComment("just a comment")).toBeNull()
  })
})
