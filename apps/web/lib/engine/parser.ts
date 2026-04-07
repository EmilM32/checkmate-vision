import type { EngineScore, ParsedBestMove, ParsedInfoLine } from "@/lib/engine/types"

export function parseInfoLine(line: string): ParsedInfoLine | null {
  if (!line.startsWith("info ")) return null

  const tokens = line.split(" ")
  let depth = 0
  let nps = 0
  let multipv = 1
  let score: EngineScore | null = null
  let pv: string[] = []

  let i = 1
  while (i < tokens.length) {
    switch (tokens[i]) {
      case "depth":
        depth = parseInt(tokens[++i]!, 10)
        break
      case "nps":
        nps = parseInt(tokens[++i]!, 10)
        break
      case "multipv": {
        const v = parseInt(tokens[++i]!, 10)
        if (v >= 1 && v <= 3) multipv = v
        break
      }
      case "score":
        if (tokens[i + 1] === "cp") {
          score = { type: "cp", value: parseInt(tokens[i + 2]!, 10) }
          i += 2
        } else if (tokens[i + 1] === "mate") {
          score = { type: "mate", value: parseInt(tokens[i + 2]!, 10) }
          i += 2
        }
        break
      case "pv":
        pv = tokens.slice(i + 1)
        i = tokens.length
        break
      default:
        break
    }
    i++
  }

  if (depth === 0 || pv.length === 0) return null

  return { depth, nps, multipv: multipv as 1 | 2 | 3, score, pv }
}

export function parseBestMoveLine(line: string): ParsedBestMove | null {
  if (!line.startsWith("bestmove ")) return null

  const tokens = line.split(" ")
  const move = tokens[1]
  if (!move || move === "(none)") return null

  const ponder = tokens[2] === "ponder" ? (tokens[3] ?? null) : null
  return { move, ponder }
}
