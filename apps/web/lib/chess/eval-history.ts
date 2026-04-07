import type { MoveEntry } from "@/context/game-context"
import type { EngineScore } from "@/context/engine-context"
import type { MoveClassification } from "@/lib/chess/classification"

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

function toWhitePerspectivePawns(score: EngineScore, fenAfter: string): number {
  if (!score) return 0

  const sideToMove = fenAfter.split(" ")[1]
  const whiteToMove = sideToMove === "w"

  if (score.type === "mate") {
    const mateValue = score.value > 0 ? 10 : -10
    return clampPawns(whiteToMove ? mateValue : -mateValue)
  }

  const cp = whiteToMove ? score.value : -score.value
  return clampPawns(cp / 100)
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
      eval: toWhitePerspectivePawns(move.scoreAfter, move.fen),
      rawScore: move.scoreAfter,
      classification: move.classification,
    })
  })

  return points
}
