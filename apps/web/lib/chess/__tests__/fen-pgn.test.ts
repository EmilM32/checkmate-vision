import { describe, expect, it } from "vitest"
import { parsePgn, validateFen, validatePgn } from "@/lib/chess/fen-pgn"

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
})
