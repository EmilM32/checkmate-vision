import type { PieceSymbol } from "chess.js"

import type { MoveEntry } from "@/context/game-context"
import { getMoveNumbering, getPlyColor } from "@/lib/chess/move-numbering"

type CapturablePiece = Exclude<PieceSymbol, "k">
type Side = "white" | "black"

const START_COUNTS: Record<CapturablePiece, number> = {
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
}

const PIECE_VALUES: Record<CapturablePiece, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
}

const CAPTURE_ORDER: CapturablePiece[] = ["q", "r", "b", "n", "p"]

export type SideMaterial = {
  // Opponent pieces missing from the board, most valuable first.
  captured: CapturablePiece[]
  // Material lead in pawns; 0 for the side that is not ahead.
  advantage: number
}

function countPieces(fen: string) {
  const counts = {
    white: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    black: { q: 0, r: 0, b: 0, n: 0, p: 0 },
  } satisfies Record<Side, Record<CapturablePiece, number>>

  for (const char of fen.split(" ")[0] ?? "") {
    const type = char.toLowerCase() as CapturablePiece
    if (!(type in START_COUNTS)) continue
    counts[char === type ? "black" : "white"][type] += 1
  }

  return counts
}

export function getMaterialSummary(fen: string): Record<Side, SideMaterial> {
  const counts = countPieces(fen)

  const materialOf = (side: Side) =>
    CAPTURE_ORDER.reduce(
      (sum, type) => sum + counts[side][type] * PIECE_VALUES[type],
      0
    )
  // Promotions can leave more pieces than at the start; never count those
  // as captures.
  const capturedFrom = (side: Side) =>
    CAPTURE_ORDER.flatMap((type) =>
      Array<CapturablePiece>(
        Math.max(0, START_COUNTS[type] - counts[side][type])
      ).fill(type)
    )

  const lead = materialOf("white") - materialOf("black")

  return {
    white: { captured: capturedFrom("black"), advantage: Math.max(0, lead) },
    black: { captured: capturedFrom("white"), advantage: Math.max(0, -lead) },
  }
}

// Remaining time of `side` at the current position: the clock recorded with
// that side's latest move. Null until the side has moved or without clocks.
export function getClockAt(
  history: MoveEntry[],
  currentMoveIndex: number,
  initialFen: string,
  side: Side
): number | null {
  const numbering = getMoveNumbering(initialFen)

  for (let ply = Math.min(currentMoveIndex, history.length); ply >= 1; ply--) {
    if (getPlyColor(ply, numbering) !== side) continue
    return history[ply - 1]?.clock ?? null
  }

  return null
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = String(seconds % 60).padStart(2, "0")

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}`
    : `${minutes}:${secs}`
}
