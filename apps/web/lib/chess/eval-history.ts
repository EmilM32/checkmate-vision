import type { MoveEntry } from "@/context/game-context"
import type { EngineScore } from "@/context/engine-context"
import type { MoveClassification } from "@/lib/chess/classification"
import { getSideToMove } from "@/lib/engine/eval"

export type EvalChartPoint = {
  moveIndex: number
  moveLabel: string
  eval: number
  rawScore: EngineScore
  classification: MoveClassification | null
}

function clampPawns(value: number): number {
  return Math.max(-10, Math.min(10, value))
}

// Scores are stored from White's perspective; `mate 0` means the side to move
// in `fenAfter` is checkmated.
function toChartPawns(score: EngineScore, fenAfter: string): number {
  if (!score) return 0

  if (score.type === "mate") {
    if (score.value === 0) return getSideToMove(fenAfter) === "w" ? -10 : 10
    return score.value > 0 ? 10 : -10
  }

  return clampPawns(score.value / 100)
}

export function buildEvalChartData(history: MoveEntry[]): EvalChartPoint[] {
  const points: EvalChartPoint[] = [
    {
      moveIndex: 0,
      moveLabel: "0",
      eval: 0,
      rawScore: null,
      classification: null,
    },
  ]

  history.forEach((move, index) => {
    const moveIndex = index + 1
    points.push({
      moveIndex,
      moveLabel: `${Math.ceil(moveIndex / 2)}`,
      eval: toChartPawns(move.scoreAfter, move.fen),
      rawScore: move.scoreAfter,
      classification: move.classification,
    })
  })

  return points
}
