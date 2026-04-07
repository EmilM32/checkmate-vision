import type { EngineScore } from "@/context/engine-context"

export function evalToPercent(score: EngineScore): number {
  if (!score) return 50
  if (score.type === "mate") return score.value > 0 ? 99 : 1
  return 50 + 50 * Math.tanh(score.value / 500)
}

export function formatEval(score: EngineScore): string {
  if (!score) return "0.0"
  if (score.type === "mate") return `M${Math.abs(score.value)}`
  return (Math.abs(score.value) / 100).toFixed(1)
}
