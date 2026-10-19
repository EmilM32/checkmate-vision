import type { EngineScore } from "@/context/engine-context"

export type SideToMove = "w" | "b"

export function getSideToMove(fen: string): SideToMove {
  return fen.split(" ")[1] === "b" ? "b" : "w"
}

// UCI reports scores from the side-to-move perspective. The app stores and
// renders every score from White's perspective, so flip when Black is to move.
// A `mate 0` score (side to move is checkmated) has no sign and is kept as is;
// consumers resolve it with the side to move of the evaluated position.
export function toWhitePerspective(
  score: EngineScore,
  sideToMove: SideToMove
): EngineScore {
  if (!score || sideToMove === "w" || score.value === 0) return score
  return { type: score.type, value: -score.value }
}

export function isCheckmatedScore(score: EngineScore): boolean {
  return score?.type === "mate" && score.value === 0
}

export function evalToPercent(
  score: EngineScore,
  sideToMove: SideToMove = "w"
): number {
  if (!score) return 50
  if (score.type === "mate") {
    if (score.value === 0) return sideToMove === "w" ? 1 : 99
    return score.value > 0 ? 99 : 1
  }
  return 50 + 50 * Math.tanh(score.value / 500)
}

export function isWhiteBetter(
  score: EngineScore,
  sideToMove: SideToMove = "w"
): boolean {
  if (!score) return true
  if (score.type === "mate") {
    if (score.value === 0) return sideToMove === "b"
    return score.value > 0
  }
  return score.value >= 0
}

export function formatEval(score: EngineScore): string {
  if (!score) return "0.0"
  if (score.type === "mate") {
    return score.value === 0 ? "#" : `M${Math.abs(score.value)}`
  }
  return (Math.abs(score.value) / 100).toFixed(1)
}
