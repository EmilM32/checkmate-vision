"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { useEngine } from "@/hooks/use-engine"
import { useUI } from "@/hooks/use-ui"
import { buildArrowPath, type ArrowShape } from "@/lib/chess/arrow-geometry"
import {
  buildMultiPvArrows,
  squareCenterUnits,
} from "@/lib/chess/board-coordinates"
import { PV_LINE_COLORS } from "@/lib/chess/pv-line-colors"

// The best line is the boldest and most opaque; sizes are in squares.
const BEST_SHAPE: ArrowShape = {
  shaftWidth: 0.2,
  headWidth: 0.52,
  headLength: 0.42,
  tailOffset: 0.18,
}
const ALTERNATIVE_SHAPE: ArrowShape = {
  shaftWidth: 0.15,
  headWidth: 0.42,
  headLength: 0.34,
  tailOffset: 0.18,
}

const ARROW_STYLES: Record<
  1 | 2 | 3,
  { color: string; opacity: number; shape: ArrowShape }
> = {
  1: { color: PV_LINE_COLORS[1], opacity: 0.85, shape: BEST_SHAPE },
  2: { color: PV_LINE_COLORS[2], opacity: 0.6, shape: ALTERNATIVE_SHAPE },
  3: { color: PV_LINE_COLORS[3], opacity: 0.45, shape: ALTERNATIVE_SHAPE },
}

export function ArrowOverlay() {
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed

  const arrows = useMemo(
    () => buildMultiPvArrows(engineState.pvLines),
    [engineState.pvLines]
  )

  const positionedArrows = useMemo(() => {
    return (
      arrows
        .flatMap((arrow) => {
          const from = squareCenterUnits(arrow.from, uiState.boardFlipped)
          const to = squareCenterUnits(arrow.to, uiState.boardFlipped)
          if (!from || !to) return []

          return [
            {
              ...arrow,
              path: buildArrowPath(from, to, ARROW_STYLES[arrow.id].shape),
            },
          ]
        })
        // The best line is drawn last, on top of the alternatives.
        .reverse()
    )
  }, [arrows, uiState.boardFlipped])

  const shouldShow =
    analysisVisible && uiState.showArrows && positionedArrows.length > 0

  return (
    <AnimatePresence>
      {shouldShow ? (
        <motion.svg
          key="arrow-overlay"
          className="board-overlay board-overlay-arrows size-full"
          viewBox="0 0 8 8"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {positionedArrows.map((arrow) => {
            const style = ARROW_STYLES[arrow.id]
            const arrowOpacity = uiState.showHeatmap
              ? style.opacity * 0.72
              : style.opacity
            const effectiveOpacity =
              uiState.showInfluenceTrace && uiState.selectedInfluenceSquare
                ? arrowOpacity * 0.65
                : arrowOpacity

            return (
              <motion.path
                key={`${arrow.id}-${arrow.uci}`}
                d={arrow.path}
                fill={style.color}
                initial={{ opacity: 0 }}
                animate={{ opacity: effectiveOpacity }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.25,
                  delay: (arrow.id - 1) * 0.04,
                  ease: "easeOut",
                }}
              />
            )
          })}
        </motion.svg>
      ) : null}
    </AnimatePresence>
  )
}
