"use client"

import { useMemo } from "react"

import { useGame } from "@/hooks/use-game"
import { useUI } from "@/hooks/use-ui"
import { buildHeatmap } from "@/lib/chess/heatmap"
import { squareCenterUnits } from "@/lib/chess/board-coordinates"

const HEATMAP_COLORS = {
  white: "#22c55e",
  black: "#ef4444",
} as const

type PositionedCell = {
  key: string
  x: number
  y: number
  opacity: number
  color: string
}

export function HeatmapOverlay() {
  const { state: gameState } = useGame()
  const { state: uiState } = useUI()

  const cells = useMemo(() => buildHeatmap(gameState.fen), [gameState.fen])

  const positionedCells = useMemo<PositionedCell[]>(() => {
    return cells.flatMap((cell) => {
      if (cell.side === "neutral" || cell.intensity <= 0) return []

      const center = squareCenterUnits(cell.square, uiState.boardFlipped)
      if (!center) return []

      return [
        {
          key: cell.square,
          x: center.x - 0.5,
          y: center.y - 0.5,
          opacity: Math.min(cell.intensity, 1),
          color: HEATMAP_COLORS[cell.side],
        },
      ]
    })
  }, [cells, uiState.boardFlipped])

  if (!uiState.showHeatmap || positionedCells.length === 0) {
    return null
  }

  return (
    <svg
      className="board-overlay board-overlay-heatmap size-full"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {positionedCells.map((cell) => (
        <rect
          key={cell.key}
          x={cell.x}
          y={cell.y}
          width={1}
          height={1}
          fill={cell.color}
          opacity={cell.opacity}
        />
      ))}
    </svg>
  )
}
