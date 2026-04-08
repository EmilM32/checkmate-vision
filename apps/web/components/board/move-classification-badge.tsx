"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Badge } from "@workspace/ui/components/badge"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import {
  CLASSIFICATION_LABEL_KEYS,
  CLASSIFICATION_COLORS,
} from "@/lib/chess/classification"

export function MoveClassificationBadgePlaceholder() {
  const { t } = useI18n()
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
            {t(CLASSIFICATION_LABEL_KEYS[classification])}
          </Badge>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
