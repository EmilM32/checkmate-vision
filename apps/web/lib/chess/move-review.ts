import { Chess } from "chess.js"

import type { EngineScore } from "@/context/engine-context"
import type { MoveEntry } from "@/context/game-context"
import {
  getWinChance,
  type MoveClassification,
} from "@/lib/chess/classification"
import { getSideToMove } from "@/lib/engine/eval"

export type MoveReview = {
  ply: number
  san: string
  playedBy: "white" | "black"
  classification: MoveClassification
  // From White's perspective.
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  // Win chance the mover gave up, in percentage points (0 when none).
  winChanceLoss: number
  // The engine's choice when it differs from the played move.
  best: { uci: string; san: string; score: EngineScore } | null
}

/** What game analysis says about the move that reached ply `ply`. */
export function getMoveReview(
  history: MoveEntry[],
  ply: number,
  initialFen: string
): MoveReview | null {
  const move = history[ply - 1]
  if (!move?.classification || !move.scoreBefore || !move.scoreAfter) {
    return null
  }

  const fenBefore =
    ply === 1 ? initialFen : (history[ply - 2]?.fen ?? initialFen)
  const playedBy = getSideToMove(fenBefore) === "w" ? "white" : "black"

  let best: MoveReview["best"] = null
  try {
    const chess = new Chess(fenBefore)
    const played = chess.move(move.san)
    chess.undo()
    if (move.bestMove && move.bestMove !== played.lan) {
      const bestMove = chess.move({
        from: move.bestMove.slice(0, 2),
        to: move.bestMove.slice(2, 4),
        promotion: move.bestMove[4],
      })
      best = {
        uci: move.bestMove,
        san: bestMove.san,
        score: move.bestScore ?? move.scoreBefore,
      }
    }
  } catch {
    best = null
  }

  return {
    ply,
    san: move.san,
    playedBy,
    classification: move.classification,
    scoreBefore: move.scoreBefore,
    scoreAfter: move.scoreAfter,
    winChanceLoss: Math.max(
      0,
      getWinChance(move.scoreBefore, playedBy) -
        getWinChance(move.scoreAfter, playedBy)
    ),
    best,
  }
}
