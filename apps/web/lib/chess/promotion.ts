import { Chess, type Square } from "chess.js"

import { squareCenterUnits } from "@/lib/chess/board-coordinates"

export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const
export type PromotionPiece = (typeof PROMOTION_PIECES)[number]

export function isPromotionMove(fen: string, from: string, to: string) {
  try {
    return new Chess(fen)
      .moves({ square: from as Square, verbose: true })
      .some((move) => move.to === to && Boolean(move.promotion))
  } catch {
    return false
  }
}

export type PromotionCell = {
  piece: PromotionPiece
  // Top-left corner in board square units (0-8).
  x: number
  y: number
}

// Lays the choices out as a column starting on the promotion square and
// growing towards the middle of the board, as most chess UIs do.
export function getPromotionCells(
  square: string,
  boardFlipped: boolean
): PromotionCell[] {
  const center = squareCenterUnits(square, boardFlipped)
  if (!center) return []

  const x = center.x - 0.5
  const startY = center.y - 0.5
  const step = startY < 4 ? 1 : -1

  return PROMOTION_PIECES.map((piece, index) => ({
    piece,
    x,
    y: startY + index * step,
  }))
}
