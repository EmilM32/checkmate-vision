import { Chess } from "chess.js"

import type { MoveEntry } from "@/context/game-context"

export type LastMove = { from: string; to: string }

/**
 * Squares of the move that led to the position at `moveIndex` (1-based), so
 * the board can show what was just played while browsing a game.
 */
export function getLastMove(
  history: MoveEntry[],
  moveIndex: number,
  initialFen: string
): LastMove | null {
  const move = history[moveIndex - 1]
  if (!move) return null

  const fenBefore =
    moveIndex === 1 ? initialFen : (history[moveIndex - 2]?.fen ?? initialFen)
  try {
    const played = new Chess(fenBefore).move(move.san)
    return { from: played.from, to: played.to }
  } catch {
    return null
  }
}
