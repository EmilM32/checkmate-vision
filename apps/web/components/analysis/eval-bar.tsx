"use client"

import { useEngine } from "@/hooks/use-engine"
import { evalToPercent, formatEval } from "@/lib/engine/eval"

export function EvalBar() {
  const { state } = useEngine()
  const pct = evalToPercent(state.evaluation)
  const label = formatEval(state.evaluation)
  const isWhiteBetter = !state.evaluation || state.evaluation.type === "cp"
    ? (state.evaluation?.value ?? 0) >= 0
    : state.evaluation.value > 0

  return (
    <div
      className="eval-bar-gradient relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg"
      style={{ "--eval-pct": `${pct}%` } as React.CSSProperties}
    >
      <span
        className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-bold leading-none ${
          isWhiteBetter ? "bottom-1.5 text-zinc-100" : "top-1.5 text-zinc-900"
        }`}
      >
        {label}
      </span>
    </div>
  )
}
