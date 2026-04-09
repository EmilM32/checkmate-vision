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

  const whiteOnBottom = !uiState.boardFlipped
  const evalDir = whiteOnBottom ? "0deg" : "180deg"
  const labelOnTop = isWhiteBetter === whiteOnBottom

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
          style={{ "--eval-dir": evalDir } as React.CSSProperties}
        >
          <span
            className={`absolute left-1/2 -translate-x-1/2 text-[10px] leading-none font-bold text-zinc-900 ${
              whiteOnBottom ? "bottom-1.5" : "top-1.5"
            }`}
          >
            ?
          </span>
        </motion.div>
      ) : (
        <motion.div
          key="eval-visible"
          className="eval-bar-gradient relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg"
          style={{ "--eval-dir": evalDir } as React.CSSProperties}
          animate={{ "--eval-pct": `${pct}%` } as Record<string, string>}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.span
            key={isWhiteBetter ? "white" : "black"}
            initial={{ opacity: 0, y: labelOnTop ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: labelOnTop ? 4 : -4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`absolute left-1/2 -translate-x-1/2 text-[10px] leading-none font-bold ${
              labelOnTop ? "top-1.5" : "bottom-1.5"
            } ${isWhiteBetter ? "text-zinc-100" : "text-zinc-900"}`}
          >
            {label}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
