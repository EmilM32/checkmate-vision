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

  it("rejects a position where the side not to move is in check", () => {
    for (const fen of [
      "4k3/4R3/8/8/8/8/8/4K3 w - - 0 1",
      "4K3/4r3/8/8/8/8/8/4k3 b - - 0 1",
    ]) {
      const result = validateFen(fen)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("errors.fenSideNotToMoveInCheck")
      }
    }
  })

  it("accepts check, stalemate, and mate against the side to move", () => {
    for (const fen of [
      "4k3/2N5/3N4/8/8/8/8/4K3 b - - 0 1",
      "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
      "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
    ]) {
      expect(validateFen(fen).ok).toBe(true)
    }
  })

  it("still accepts inconsistent castling rights and an en passant square", () => {
    for (const fen of [
      "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      "4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1",
      "r3k2r/8/8/8/8/8/8/R2K3R w KQkq - 0 1",
      "4k3/8/8/8/8/8/8/4K3 w - e6 0 1",
      "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 2",
    ]) {
      expect(validateFen(fen).ok).toBe(true)
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

  it("rejects a set-up PGN where the side not to move is in check", () => {
    const fen = "4k3/4R3/8/8/8/8/8/4K3 w - - 0 1"
    for (const pgn of [
      `[SetUp "1"]\n[FEN "${fen}"]`,
      `[SetUp "1"]\n[FEN "${fen}"]\n\n1. Ke2 *`,
    ]) {
      for (const result of [validatePgn(pgn), parsePgn(pgn)]) {
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBe("errors.pgnSideNotToMoveInCheck")
        }
      }
    }
  })

  it("loads a legal set-up PGN", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"
    const pgn = `[SetUp "1"]\n[FEN "${fen}"]\n\n40... Kd7 41. e4 Ke6 *`
    const validation = validatePgn(pgn)
    const parsed = parsePgn(pgn)

    expect(validation.ok).toBe(true)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.initialFen).toBe(fen)
      expect(parsed.data.moves.map((move) => move.san)).toEqual([
        "Kd7",
        "e4",
        "Ke6",
      ])
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
