import { describe, expect, it } from "vitest"
import { parseBestMoveLine, parseInfoLine } from "@/lib/engine/parser"

describe("parseInfoLine", () => {
  it("parses a full multipv 1 info line with cp score", () => {
    const line =
      "info depth 20 seldepth 25 multipv 1 score cp 35 nodes 1234567 nps 1500000 time 823 pv e2e4 e7e5 g1f3 b8c6"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 20,
      nps: 1500000,
      multipv: 1,
      score: { type: "cp", value: 35 },
      pv: ["e2e4", "e7e5", "g1f3", "b8c6"],
    })
  })

  it("parses a mate score", () => {
    const line =
      "info depth 15 multipv 2 score mate 3 nodes 500000 nps 1200000 pv d2d4 d7d5 c2c4"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 15,
      nps: 1200000,
      multipv: 2,
      score: { type: "mate", value: 3 },
      pv: ["d2d4", "d7d5", "c2c4"],
    })
  })

  it("parses negative mate score", () => {
    const line =
      "info depth 18 multipv 1 score mate -2 nodes 300000 nps 900000 pv e1g1"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 18,
      nps: 900000,
      multipv: 1,
      score: { type: "mate", value: -2 },
      pv: ["e1g1"],
    })
  })

  it("parses negative cp score", () => {
    const line =
      "info depth 12 multipv 1 score cp -150 nps 800000 pv a7a6 b2b4"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 12,
      nps: 800000,
      multipv: 1,
      score: { type: "cp", value: -150 },
      pv: ["a7a6", "b2b4"],
    })
  })

  it("parses multipv 3", () => {
    const line =
      "info depth 10 multipv 3 score cp -20 nps 600000 pv g1f3 d7d5"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 10,
      nps: 600000,
      multipv: 3,
      score: { type: "cp", value: -20 },
      pv: ["g1f3", "d7d5"],
    })
  })

  it("defaults multipv to 1 when absent", () => {
    const line = "info depth 8 score cp 10 nps 400000 pv e2e4"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 8,
      nps: 400000,
      multipv: 1,
      score: { type: "cp", value: 10 },
      pv: ["e2e4"],
    })
  })

  it("returns null for non-info lines", () => {
    expect(parseInfoLine("bestmove e2e4")).toBeNull()
    expect(parseInfoLine("uciok")).toBeNull()
    expect(parseInfoLine("readyok")).toBeNull()
    expect(parseInfoLine("")).toBeNull()
  })

  it("returns null for info line without pv", () => {
    const line = "info depth 5 score cp 10 nps 100000"
    expect(parseInfoLine(line)).toBeNull()
  })

  it("returns null for currmove info lines (depth 0, no pv)", () => {
    const line = "info depth 0 currmove e2e4 currmovenumber 1"
    expect(parseInfoLine(line)).toBeNull()
  })

  it("handles info string lines gracefully", () => {
    const line = "info string NNUE evaluation using nn-..."
    expect(parseInfoLine(line)).toBeNull()
  })

  it("handles line with hashfull and tbhits", () => {
    const line =
      "info depth 22 seldepth 30 multipv 1 score cp 42 nodes 5000000 nps 2000000 hashfull 500 tbhits 0 time 2500 pv e2e4 e7e5"
    const result = parseInfoLine(line)

    expect(result).toEqual({
      depth: 22,
      nps: 2000000,
      multipv: 1,
      score: { type: "cp", value: 42 },
      pv: ["e2e4", "e7e5"],
    })
  })
})

describe("parseBestMoveLine", () => {
  it("parses bestmove with ponder", () => {
    const result = parseBestMoveLine("bestmove e2e4 ponder e7e5")
    expect(result).toEqual({ move: "e2e4", ponder: "e7e5" })
  })

  it("parses bestmove without ponder", () => {
    const result = parseBestMoveLine("bestmove d2d4")
    expect(result).toEqual({ move: "d2d4", ponder: null })
  })

  it("returns null for bestmove (none)", () => {
    expect(parseBestMoveLine("bestmove (none)")).toBeNull()
  })

  it("returns null for non-bestmove lines", () => {
    expect(parseBestMoveLine("info depth 10 score cp 35 pv e2e4")).toBeNull()
    expect(parseBestMoveLine("uciok")).toBeNull()
    expect(parseBestMoveLine("")).toBeNull()
  })
})
