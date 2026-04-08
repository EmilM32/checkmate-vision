"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Badge } from "@workspace/ui/components/badge"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useUI } from "@/hooks/use-ui"
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
} from "@/lib/chess/classification"

export function MoveClassificationBadgePlaceholder() {
  const { state } = useGame()
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.sleuthMode || engineState.sleuthRevealed
  const currentMove =
    state.currentMoveIndex > 0
      ? state.history[state.currentMoveIndex - 1]
      : null

  const classification = currentMove?.classification

  const shouldShow = analysisVisible && Boolean(classification)

  return (
    <AnimatePresence>
      {shouldShow && classification ? (
        <motion.div
          key={classification}
          className="absolute right-3 bottom-3 z-30"
          initial={{ opacity: 0, scale: 0.86, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Badge
            variant="secondary"
            className="border border-white/20 text-zinc-900"
            style={{
              backgroundColor: CLASSIFICATION_COLORS[classification],
            }}
          >
            {CLASSIFICATION_LABELS[classification]}
          </Badge>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
