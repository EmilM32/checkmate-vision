"use client"

import { AnimatePresence, motion } from "framer-motion"

import { useEngine } from "@/hooks/use-engine"
import { useUI } from "@/hooks/use-ui"
import { evalToPercent, formatEval } from "@/lib/engine/eval"

export function EvalBar() {
  const { state } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.sleuthMode || state.sleuthRevealed

  const pct = evalToPercent(state.evaluation)
  const label = formatEval(state.evaluation)
  const isWhiteBetter =
    !state.evaluation || state.evaluation.type === "cp"
      ? (state.evaluation?.value ?? 0) >= 0
      : state.evaluation.value > 0

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!analysisVisible ? (
        <motion.div
          key="eval-hidden"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0.55 }}
          exit={{ opacity: 0.1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="eval-bar-gradient relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg"
        >
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] leading-none font-bold text-zinc-900">
            ?
          </span>
        </motion.div>
      ) : (
        <motion.div
          key="eval-visible"
          className="eval-bar-gradient relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg"
          animate={{ "--eval-pct": `${pct}%` } as Record<string, string>}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.span
            key={isWhiteBetter ? "white" : "black"}
            initial={{ opacity: 0, y: isWhiteBetter ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isWhiteBetter ? 4 : -4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`absolute left-1/2 -translate-x-1/2 text-[10px] leading-none font-bold ${
              isWhiteBetter
                ? "bottom-1.5 text-zinc-100"
                : "top-1.5 text-zinc-900"
            }`}
          >
            {label}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
