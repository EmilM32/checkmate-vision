import type { ParsedBestMove, ParsedInfoLine } from "@/lib/engine/types"

export function parseInfoLine(line: string): ParsedInfoLine | null {
  void line
  // TODO: parse UCI info output from Stockfish worker.
  return null
}

export function parseBestMoveLine(line: string): ParsedBestMove | null {
  void line
  // TODO: parse `bestmove` output from Stockfish worker.
  return null
}
