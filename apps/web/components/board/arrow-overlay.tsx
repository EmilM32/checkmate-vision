"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"

import { useEngine } from "@/hooks/use-engine"
import { useUI } from "@/hooks/use-ui"
import {
  buildMultiPvArrows,
  squareCenterUnits,
} from "@/lib/chess/board-coordinates"

const ARROW_STYLES: Record<1 | 2 | 3, { color: string; opacity: number }> = {
  1: { color: "#10b981", opacity: 0.8 },
  2: { color: "#60a5fa", opacity: 0.5 },
  3: { color: "#f59e0b", opacity: 0.35 },
}

export function ArrowOverlay() {
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()

  const arrows = useMemo(
    () => buildMultiPvArrows(engineState.pvLines),
    [engineState.pvLines]
  )

  const positionedArrows = useMemo(() => {
    return arrows.flatMap((arrow) => {
      const from = squareCenterUnits(arrow.from, uiState.boardFlipped)
      const to = squareCenterUnits(arrow.to, uiState.boardFlipped)
      if (!from || !to) return []

      return [{ ...arrow, from, to }]
    })
  }, [arrows, uiState.boardFlipped])

  if (!uiState.showArrows || positionedArrows.length === 0) {
    return null
  }

  return (
    <svg
      className="board-overlay board-overlay-arrows size-full"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {([1, 2, 3] as const).map((id) => {
          const style = ARROW_STYLES[id]
          return (
            <marker
              key={id}
              id={`pv-arrow-head-${id}`}
              markerWidth="2"
              markerHeight="2"
              refX="1.6"
              refY="1"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 2 1 L 0 2 z" fill={style.color} />
            </marker>
          )
        })}
      </defs>

      {positionedArrows.map((arrow) => {
        const style = ARROW_STYLES[arrow.id]

        return (
          <motion.line
            key={`${arrow.id}-${arrow.uci}`}
            x1={arrow.from.x}
            y1={arrow.from.y}
            x2={arrow.to.x}
            y2={arrow.to.y}
            stroke={style.color}
            strokeWidth={6}
            markerEnd={`url(#pv-arrow-head-${arrow.id})`}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: style.opacity }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        )
      })}
    </svg>
  )
}
