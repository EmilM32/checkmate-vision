"use client"

import { useMemo } from "react"

import { getCurrentLine } from "@/context/game-context"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import { squareCenterUnits } from "@/lib/chess/board-coordinates"
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABEL_KEYS,
  CLASSIFICATION_SYMBOLS,
} from "@/lib/chess/classification"
import { getLastMove } from "@/lib/chess/last-move"

/**
 * The class of the move just played (!!, !, ?!, ?, ??) in the top-right
 * corner of its target square, as in chess.com's game review.
 */
export function MoveBadge() {
  const { t } = useI18n()
  const { state } = useGame()
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed

  const line = useMemo(() => getCurrentLine(state), [state])
  const classification = line.at(-1)?.classification ?? null
  const target = useMemo(() => {
    const lastMove = getLastMove(line, line.length, state.initialFen)
    return lastMove
      ? squareCenterUnits(lastMove.to, uiState.boardFlipped)
      : null
  }, [line, state.initialFen, uiState.boardFlipped])

  if (!analysisVisible || !classification || !target) return null
  const symbol = CLASSIFICATION_SYMBOLS[classification]
  if (!symbol) return null

  return (
    <span
      role="img"
      aria-label={t(CLASSIFICATION_LABEL_KEYS[classification])}
      data-testid="move-badge"
      className="absolute z-10 flex size-[4.6cqw] -translate-x-[85%] -translate-y-[15%] items-center justify-center rounded-full font-mono text-[2.1cqw] leading-none font-bold text-white shadow-md ring-2 ring-white/80"
      style={{
        left: `${((target.x + 0.5) / 8) * 100}%`,
        top: `${((target.y - 0.5) / 8) * 100}%`,
        backgroundColor: CLASSIFICATION_COLORS[classification],
      }}
    >
      {symbol}
    </span>
  )
}
