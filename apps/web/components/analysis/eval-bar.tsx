"use client"

import { useEngine } from "@/hooks/use-engine"
import { useUI } from "@/hooks/use-ui"
import { evalToPercent, formatEval } from "@/lib/engine/eval"

export function EvalBar() {
  const { state } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.sleuthMode || state.sleuthRevealed

  if (!analysisVisible) {
    return (
      <div className="eval-bar-gradient relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg opacity-55">
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] leading-none font-bold text-zinc-900">
          ?
        </span>
      </div>
    )
  }

  const pct = evalToPercent(state.evaluation)
  const label = formatEval(state.evaluation)
  const isWhiteBetter =
    !state.evaluation || state.evaluation.type === "cp"
      ? (state.evaluation?.value ?? 0) >= 0
      : state.evaluation.value > 0

  return (
    <div
      className="eval-bar-gradient relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg"
      style={{ "--eval-pct": `${pct}%` } as React.CSSProperties}
    >
      <span
        className={`absolute left-1/2 -translate-x-1/2 text-[10px] leading-none font-bold ${
          isWhiteBetter ? "bottom-1.5 text-zinc-100" : "top-1.5 text-zinc-900"
        }`}
      >
        {label}
      </span>
    </div>
  )
}
